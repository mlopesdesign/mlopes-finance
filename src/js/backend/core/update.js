// MLopes Finance — Auto-update via GitHub Releases (Fase Hardening)
// API publica: https://api.github.com/repos/{owner}/{repo}/releases/latest
// Auth: anonymous (60 req/h por IP). Cache local em localStorage (4h).

const DEFAULT_OWNER = 'mlopesdesign';
const DEFAULT_REPO = 'mlopes-finance';
const CACHE_KEY_PREFIX = 'mlopes-update-check';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas
const ASSET_NAME_PATTERN = /^MLopes\s*Finance\s*Setup.*\.exe$/i;

/** Compara duas versoes semver. Retorna -1, 0 ou 1. */
export function compararVersao(a, b) {
  const parse = (v) => String(v).replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const [am, ai, ap] = parse(a);
  const [bm, bi, bp] = parse(b);
  if (am !== bm) return am < bm ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  if (ap !== bp) return ap < bp ? -1 : 1;
  return 0;
}

/** Cache local em localStorage */
function lerCache(owner, repo) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}-${owner}-${repo}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}
function salvarCache(owner, repo, data) {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}-${owner}-${repo}`, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch { /* sem espaco, ignora */ }
}

/** Encontra o asset .exe da release (matching case-insensitive). */
function encontrarAssetInstalador(assets) {
  if (!Array.isArray(assets)) return null;
  return assets.find(a => a?.name && ASSET_NAME_PATTERN.test(a.name)) || null;
}

/** Compara a versao atual com a ultima release. */
export async function checarAtualizacao({ owner = DEFAULT_OWNER, repo = DEFAULT_REPO, versaoAtual, force = false } = {}) {
  if (!versaoAtual) throw new Error('versaoAtual obrigatoria.');

  // Tenta cache primeiro (se nao for force)
  if (!force) {
    const cached = lerCache(owner, repo);
    if (cached) return cached;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  let resp;
  try {
    const ctrl = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 10000);
    // Token opcional do GitHub: le de GH_TOKEN (env var) ou MLOPES_GH_TOKEN. Com token, 5000 req/h. Sem, 60 req/h (rate limit estourou nas ultimas 24h).
    let ghToken = '';
    try { ghToken = (globalThis.Neutralino?.os?.getEnv && (await globalThis.Neutralino.os.getEnv('GH_TOKEN'))) || ''; } catch { /* sem permission */ }
    if (!ghToken) try { ghToken = (globalThis.Neutralino?.os?.getEnv && (await globalThis.Neutralino.os.getEnv('MLOPES_GH_TOKEN'))) || ''; } catch { /* */ }
    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'MLopesFinance' };
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;
    resp = await fetch(url, { headers, signal: ctrl.signal });
    clearTimeout(timeoutId);
  } catch (e) {
    return { erro: 'Sem conexao: ' + e.message, temAtualizacao: false };
  }

  if (resp.status === 403) {
    return { erro: 'Rate limit do GitHub excedido. Tente novamente em 1 hora.', temAtualizacao: false };
  }
  if (resp.status === 404) {
    return { erro: `Repositorio ${owner}/${repo} nao encontrado.`, temAtualizacao: false };
  }
  if (!resp.ok) {
    return { erro: `GitHub retornou ${resp.status}`, temAtualizacao: false };
  }

  const data = await resp.json();
  const tag = (data.tag_name || '').replace(/^v/i, '');
  const asset = encontrarAssetInstalador(data.assets);
  const cmp = compararVersao(tag, versaoAtual);
  const resultado = {
    temAtualizacao: cmp > 0,
    versao: tag,
    versaoAtual,
    url: data.html_url,
    changelog: data.body || '(sem notas de release)',
    publicadoEm: data.published_at,
    asset: asset ? {
      nome: asset.name,
      url: asset.browser_download_url,
      tamanhoMB: Math.round(asset.size / 1024 / 1024 * 10) / 10,
      sha256: asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : null,
    } : null,
    erro: null,
  };
  salvarCache(owner, repo, resultado);
  return resultado;
}

/** Baixa o asset .exe para um path temp no disco local. */
export async function baixarAtualizacao(assetUrl, destino) {
  if (!assetUrl) throw new Error('assetUrl obrigatoria.');
  if (!destino) throw new Error('destino obrigatorio.');
  const NL = globalThis.Neutralino;
  if (!NL?.net) throw new Error('Neutralino.net nao disponivel.');
  // Neutralino.net nao expoe download binario com progresso; usamos fetch no browser e gravamos via filesystem
  const resp = await fetch(assetUrl, { headers: { 'User-Agent': 'MLopesFinance' } });
  if (!resp.ok) throw new Error(`Download falhou: HTTP ${resp.status}`);
  const buf = new Uint8Array(await resp.arrayBuffer());
  await NL.filesystem.writeBinaryFile(destino, buf);
  return { caminho: destino, bytes: buf.length };
}

/** Fecha o app e abre o instalador. O instalador detecta a versao anterior e atualiza. */
export async function aplicarAtualizacao(caminhoInstalador) {
  const NL = globalThis.Neutralino;
  if (!NL?.os?.open) throw new Error('Neutralino.os.open nao disponivel.');
  if (!caminhoInstalador) throw new Error('caminhoInstalador obrigatorio.');
  // Abre o instalador no app de instalacao padrao (Inno Setup trata o upgrade automaticamente)
  await NL.os.open(caminhoInstalador);
  // Encerra o app atual
  if (NL.app?.exit) {
    setTimeout(() => NL.app.exit(), 1000);
  }
  return { sucesso: true, mensagem: 'Instalador aberto. O app sera fechado para completar a atualizacao.' };
}

/** Compara versao semantica entre duas strings (teste puro). */
export function extrairTagVersion(tag) {
  if (!tag) return null;
  return String(tag).replace(/^v/i, '');
}

/** Computa o path temp onde baixar o instalador. */
export function pathTempInstalador(NL = globalThis.Neutralino) {
  // Tenta usar getEnv('TEMP') via Neutralino.os
  // Em fallback, usa 'C:\\Windows\\Temp'
  try {
    // O Neutralino nao expoe getEnv de forma sync; mantemos estatico
    return 'C:\\Windows\\Temp\\MLopesFinance-Update.exe';
  } catch {
    return 'C:\\Windows\\Temp\\MLopesFinance-Update.exe';
  }
}
