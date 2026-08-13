// MLopes Finance — atualizacao online (parte IMPURA: usa Neutralino + curl.exe).
// Esta e a camada que fala com GitHub e com o filesystem do app. As funcoes
// puras (compararVersao, extrairTagVersion, escolherAsset,
// renderizarMarkdownSimples) ficam em `core/update.js`.
//
// PADRAO ML LOPES DESIGN secao 5:
//   - asset de update = resources.neu (bundle Neutralino), NUNCA instalador .exe
//   - GitHub Releases anonimo, 60 req/h
//   - download via curl.exe (WebView2 bloqueia fetch por CORS)
//   - substitui <installDir>\\resources.neu via move /Y
//   - Neutralino.app.restartProcess() no fim
//   - BACKUP do banco antes de aplicar
//   - SEM suporte a GH_TOKEN / gh CLI (cliente final nao tem)

import { compararVersao, escolherAsset, renderizarMarkdownSimples } from './core/update.js';

const REPO_OWNER = 'mlopesdesign';
const REPO_NAME = 'mlopes-finance';
const ASSET_NAME = 'resources.neu';
const API_BASE = 'https://api.github.com';
const APP_DIR = '%LOCALAPPDATA%\\Programs\\MLopes Finance';
const RESOURCE_PATH = `${APP_DIR}\\resources.neu`;
const TEMP_PATH = `${APP_DIR}\\resources.neu.tmp`;

// Caminho temporario onde o .neu eh baixado antes de substituir o oficial.
export function pathTempInstalador() {
  return TEMP_PATH;
}

// Caminho final do bundle instalado (usado por aplicarAtualizacao).
export function pathRecursoInstalado() {
  return RESOURCE_PATH;
}

// GET via curl.exe (secao 5.2 do PADRAO). Retorna o body como string.
async function curlGet(url) {
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  // -s: silent, -S: mostra erros, -L: segue redirect, --max-time 30s, -A: User-Agent
  const cmd = `curl.exe -sSL --max-time 30 -A "MLopesFinance" "${url}"`;
  const result = await Neutralino.os.execCommand(cmd, { background: false });
  if (result.exitCode !== 0) {
    const err = (result.stdErr || '').trim();
    throw new Error(`curl GET ${url} falhou (exit ${result.exitCode}): ${err}`);
  }
  return result.stdOut;
}

// Download via curl.exe (secao 5.2 do PADRAO). Salva em `destino`.
async function curlDownload(url, destino) {
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  // Remove destino se existir (curl -o nao trunca bem em alguns casos)
  try { await Neutralino.filesystem.remove(destino); } catch { /* ok */ }
  // -sS: silencioso mas mostra erros, -L: redirect, -o: output file
  const cmd = `curl.exe -sSL --max-time 120 -A "MLopesFinance" -o "${destino}" "${url}"`;
  const result = await Neutralino.os.execCommand(cmd, { background: false });
  if (result.exitCode !== 0) {
    const err = (result.stdErr || '').trim();
    throw new Error(`curl download ${url} falhou (exit ${result.exitCode}): ${err}`);
  }
  // Verifica que o arquivo nao esta vazio
  const stat = await Neutralino.filesystem.getStats(destino);
  if (!stat || stat.size === 0) {
    try { await Neutralino.filesystem.remove(destino); } catch { /* ok */ }
    throw new Error(`download vazio: ${url}`);
  }
  return { ok: true, caminho: destino, size: stat.size };
}

// Consulta o release mais recente no GitHub. Compara com a versao atual e
// retorna { temAtualizacao, tagName, asset, body, bodyHtml, publicadoEm }.
export async function checarAtualizacao({ versaoAtual, owner = REPO_OWNER, repo = REPO_NAME, asset = ASSET_NAME } = {}) {
  if (!versaoAtual) throw new Error('versaoAtual obrigatoria');
  const url = `${API_BASE}/repos/${owner}/${repo}/releases/latest`;
  let release;
  try {
    const json = await curlGet(url);
    release = JSON.parse(json);
  } catch (e) {
    // Nao foi possivel consultar. Retorna erro explicito (sem amadorismo de
    // mascarar como "404" ou "repositorio nao encontrado").
    throw new Error(`Falha ao consultar GitHub: ${e.message}`);
  }
  if (!release || !release.tag_name) {
    return { temAtualizacao: false, motivo: 'nenhum-release' };
  }
  const escolha = escolherAsset(release, asset);
  if (!escolha) {
    return { temAtualizacao: false, motivo: 'asset-nao-encontrado', tagName: release.tag_name };
  }
  const cmp = compararVersao(versaoAtual, escolha.tagName);
  return {
    temAtualizacao: cmp < 0,
    versaoAtual,
    tagName: escolha.tagName,
    asset: {
      name: escolha.asset.name,
      url: escolha.asset.browser_download_url,
      size: escolha.asset.size,
    },
    body: release.body || '',
    bodyHtml: renderizarMarkdownSimples(release.body || ''),
    publicadoEm: release.published_at,
  };
}

// Lista releases (limitado) para o painel "O que mudou". Mais recentes primeiro.
export async function listarReleases({ owner = REPO_OWNER, repo = REPO_NAME, limite = 8 } = {}) {
  const url = `${API_BASE}/repos/${owner}/${repo}/releases?per_page=${limite}`;
  let arr;
  try {
    const json = await curlGet(url);
    arr = JSON.parse(json);
  } catch (e) {
    throw new Error(`Falha ao listar releases: ${e.message}`);
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((r) => r && r.tag_name)
    .map((r) => ({
      tagName: r.tag_name,
      publicadoEm: r.published_at,
      body: r.body || '',
      bodyHtml: renderizarMarkdownSimples(r.body || ''),
      prerelease: !!r.draft || !!r.prerelease,
    }));
}

// Baixa o asset do GitHub para o path temporario. Retorna { caminho, size }.
export async function baixarAtualizacao(assetUrl, destino = pathTempInstalador()) {
  if (!assetUrl) throw new Error('assetUrl obrigatorio');
  return await curlDownload(assetUrl, destino);
}

// Substitui o resources.neu instalado pelo novo e reinicia o processo.
// ATENCAO: o backup do banco deve ser feito ANTES de chamar esta funcao
// (a rota `update:aplicar` em servidor.js cuida disso, usando criarBackup).
export async function aplicarAtualizacao(caminho = pathTempInstalador()) {
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  // Verifica que o arquivo existe e tem tamanho razoavel (> 1 KB).
  let stat;
  try {
    stat = await Neutralino.filesystem.getStats(caminho);
  } catch {
    throw new Error(`Arquivo baixado nao encontrado: ${caminho}`);
  }
  if (!stat || stat.size < 1024) {
    throw new Error(`Arquivo baixado invalido (${stat?.size || 0} bytes): ${caminho}`);
  }
  // Substitui o resources.neu oficial via move /Y (sobrescreve destino).
  // cmd.exe /c "move /Y" e' a forma portavel no Windows. -Y suprime prompt.
  const moveCmd = `cmd.exe /c move /Y "${caminho}" "${RESOURCE_PATH}"`;
  const mv = await Neutralino.os.execCommand(moveCmd, { background: false });
  if (mv.exitCode !== 0) {
    throw new Error(`move /Y falhou (exit ${mv.exitCode}): ${(mv.stdErr || '').trim()}`);
  }
  // Reinicia o app para carregar o novo bundle.
  try {
    await Neutralino.app.restartProcess();
  } catch (e) {
    // Se nao conseguir reiniciar, devolve caminho novo mesmo assim
    return { ok: true, caminho: RESOURCE_PATH, reiniciado: false, erro: e.message };
  }
  return { ok: true, caminho: RESOURCE_PATH, reiniciado: true };
}
