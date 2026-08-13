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
//   - INVALIDAR cache do WebView2 antes do restartProcess (senao o app
//     continua mostrando a versao antiga: o Chromium serve o app.js do
//     cache HTTP em %APPDATA%\\<binaryName>.exe\\EBWebView, e o restart
//     nao limpa isso. Sem invalidar, loop eterno de "tem atualizacao").

import { compararVersao, escolherAsset, renderizarMarkdownSimples } from './core/update.js';

const REPO_OWNER = 'mlopesdesign';
const REPO_NAME = 'mlopes-finance';
const ASSET_NAME = 'resources.neu';
const API_BASE = 'https://api.github.com';

// Paths sao resolvidos em runtime via Neutralino.os.getEnv('LOCALAPPDATA'),
// porque o `os.execCommand` do Neutralino NAO expande %LOCALAPPDATA% em cmd.exe
// (resultado: literal "%LOCALAPPDATA%" no comando, falha do curl.exe).
let _appDirCache = null;
async function getAppDir() {
  if (_appDirCache) return _appDirCache;
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  const localAppData = await Neutralino.os.getEnv('LOCALAPPDATA');
  if (!localAppData) throw new Error('Variavel LOCALAPPDATA nao disponivel no ambiente.');
  _appDirCache = `${localAppData}\\Programs\\MLopes Finance`;
  return _appDirCache;
}
async function pathTempInstaladorAsync() {
  return `${await getAppDir()}\\resources.neu.tmp`;
}
async function pathRecursoInstaladoAsync() {
  return `${await getAppDir()}\\resources.neu`;
}

// Cache persistente do WebView2 do app. No Windows, o WebView2 cria uma
// pasta `<binaryName>.exe\\EBWebView` em %APPDATA% (padrao Chromium). Esse
// cache guarda o app.js, index.html, css etc. servidos pelo Neutralino via
// HTTP localhost. O `Neutralino.app.restartProcess()` reinicia o binario
// mas NAO invalida esse cache: a proxima execucao continua lendo o app.js
// antigo do disco. Resultado: o app mostra a versao anterior mesmo apos
// a substituicao do resources.neu. O `binaryName` vem de neutralino.config.json
// (`cli.binaryName = 'MLopesFinance'`) -> pasta `%APPDATA%\\MLopesFinance.exe\\EBWebView`.
export async function pathCacheWebView2Async() {
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  const appdata = await Neutralino.os.getEnv('APPDATA');
  if (!appdata) throw new Error('Variavel APPDATA nao disponivel no ambiente.');
  return `${appdata}\\MLopesFinance.exe\\EBWebView`;
}

// Limpa o cache HTTP e o code cache do WebView2 do app. Roda `rd /S /Q`
// em cmd.exe (forma portavel no Windows, mesma restricao do move /Y:
// cmd.exe nao expande %APPDATA%, por isso a chamada passa o path completo
// ja resolvido via `Neutralino.os.getEnv('APPDATA')`).
// Falhas sao toleradas: se o WebView2 estiver com arquivos abertos
// (esperado em algumas sessoes), o restartProcess fecha os handles e a
// proxima execucao parte de um cache zerado. O update NAO depende
// disso para ter sucesso: o move /Y ja' substituiu o bundle em disco.
export async function invalidarCacheWebView2() {
  if (!globalThis.Neutralino) return { ok: false, motivo: 'sem-neutralino' };
  const root = await pathCacheWebView2Async();
  const alvos = [
    `${root}\\Cache\\Cache_Data`, // cache HTTP (app.js, index.html, css)
    `${root}\\Code Cache`,        // cache V8 bytecode
    `${root}\\GPUCache`,          // cache GPU
  ];
  const resultados = [];
  for (const alvo of alvos) {
    try {
      const r = await Neutralino.os.execCommand(`cmd.exe /c rd /S /Q "${alvo}"`, { background: false });
      resultados.push({ alvo, exitCode: r.exitCode });
    } catch (e) {
      resultados.push({ alvo, erro: e.message });
    }
  }
  return { ok: true, root, resultados };
}

// Wrappers sincronos (pathTempInstalador/pathRecursoInstalado) para o caso
// de testes/ambientes sem Neutralino. Em producao, use as versoes async.
export function pathTempInstalador() {
  return _appDirCache ? `${_appDirCache}\\resources.neu.tmp` : '%LOCALAPPDATA%\\Programs\\MLopes Finance\\resources.neu.tmp';
}
export function pathRecursoInstalado() {
  return _appDirCache ? `${_appDirCache}\\resources.neu` : '%LOCALAPPDATA%\\Programs\\MLopes Finance\\resources.neu';
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
export async function baixarAtualizacao(assetUrl, destino = null) {
  if (!assetUrl) throw new Error('assetUrl obrigatorio');
  const dest = destino || await pathTempInstaladorAsync();
  return await curlDownload(assetUrl, dest);
}

// Substitui o resources.neu instalado pelo novo e reinicia o processo.
// ATENCAO: o backup do banco deve ser feito ANTES de chamar esta funcao
// (a rota `update:aplicar` em servidor.js cuida disso, usando criarBackup).
export async function aplicarAtualizacao(caminho = null) {
  if (!globalThis.Neutralino) throw new Error('Neutralino nao disponivel');
  const caminhoFinal = caminho || await pathTempInstaladorAsync();
  const recursoFinal = await pathRecursoInstaladoAsync();
  // Verifica que o arquivo existe e tem tamanho razoavel (> 1 KB).
  let stat;
  try {
    stat = await Neutralino.filesystem.getStats(caminhoFinal);
  } catch {
    throw new Error(`Arquivo baixado nao encontrado: ${caminhoFinal}`);
  }
  if (!stat || stat.size < 1024) {
    throw new Error(`Arquivo baixado invalido (${stat?.size || 0} bytes): ${caminhoFinal}`);
  }
  // Substitui o resources.neu oficial via move /Y (sobrescreve destino).
  // cmd.exe /c "move /Y" e' a forma portavel no Windows. -Y suprime prompt.
  const moveCmd = `cmd.exe /c move /Y "${caminhoFinal}" "${recursoFinal}"`;
  const mv = await Neutralino.os.execCommand(moveCmd, { background: false });
  if (mv.exitCode !== 0) {
    throw new Error(`move /Y falhou (exit ${mv.exitCode}): ${(mv.stdErr || '').trim()}`);
  }
  // Invalida o cache do WebView2 ANTES do restartProcess. Sem isso, o
  // Chromium serve o app.js antigo do cache HTTP em
  // %APPDATA%\\MLopesFinance.exe\\EBWebView\\Cache\\Cache_Data e o app
  // continua mostrando a versao anterior (loop de "tem atualizacao").
  // Falhas aqui NAO bloqueiam o restart: o `invalidarCacheWebView2()`
  // ja e' tolerante a erros por design.
  try {
    await invalidarCacheWebView2();
  } catch { /* nao-bloqueante: melhor reiniciar com cache velho do que nao reiniciar */ }
  // Reinicia o app para carregar o novo bundle.
  try {
    await Neutralino.app.restartProcess();
  } catch (e) {
    // Se nao conseguir reiniciar, devolve caminho novo mesmo assim
    return { ok: true, caminho: recursoFinal, reiniciado: false, erro: e.message };
  }
  return { ok: true, caminho: recursoFinal, reiniciado: true };
}
