// MLopes Finance — atualizacao online (parte PURA: sem DOM, sem Neutralino, sem Node APIs).
// As funcoes aqui rodam em qualquer ambiente. A parte que fala com curl.exe
// e com o filesystem do app deve ficar em `backend/update.js` (e as rotas
// em `backend/servidor.js`).

// Compara duas strings de versao semver (X.Y.Z). Aceita prefixo "v"/"V" e
// sufixo "-rc1" (IGNORADO na comparacao, conforme regra do projeto: trata
// pre-release como igual a release). Retorna:
//   -1 se a < b
//    0 se a == b
//    1 se a > b
export function compararVersao(a, b) {
  const na = extrairTagVersion(a);
  const nb = extrairTagVersion(b);
  if (na === null || nb === null) {
    if (na === nb) return 0;
    return na === null ? -1 : 1;
  }
  // Ignora o sufixo "-rc1" etc. Compara apenas X.Y.Z.
  const ma = na.split('-')[0];
  const mb = nb.split('-')[0];
  const pa = ma.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = mb.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

// Remove prefixo "v" ou "V". Retorna null se entrada vazia/invalida.
export function extrairTagVersion(tag) {
  if (tag === null || tag === undefined) return null;
  const t = String(tag).trim();
  if (t === '') return null;
  const semPrefixo = t.replace(/^[vV]/, '');
  // exige X.Y.Z no minimo
  if (!/^\d+(\.\d+){0,2}(-.+)?$/.test(semPrefixo)) return null;
  return semPrefixo;
}

// Extrai do JSON de `releases/latest` do GitHub o asset com o `name` exato.
// Retorna { tagName, asset } ou null se nao achar.
export function escolherAsset(release, nomeDesejado) {
  if (!release || !Array.isArray(release.assets)) return null;
  for (const a of release.assets) {
    if (a && a.name === nomeDesejado) {
      return { tagName: release.tag_name, asset: a };
    }
  }
  return null;
}

// Converte o body markdown de um release do GitHub em HTML simples para
// exibicao na UI. NAO usa libs externas. Tags suportadas: h1-h3, p, ul/li,
// code, strong, em, hr, a (com rel=noopener). Escapa HTML basico.
export function renderizarMarkdownSimples(md) {
  if (!md || typeof md !== 'string') return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linhas = md.split(/\r?\n/);
  const out = [];
  let emLista = false;
  for (let linha of linhas) {
    linha = linha.trimEnd();
    if (/^#{1,3}\s+/.test(linha)) {
      if (emLista) { out.push('</ul>'); emLista = false; }
      const nivel = linha.match(/^#+/)[0].length;
      const texto = linha.replace(/^#+\s+/, '');
      out.push(`<h${nivel + 1}>${formatarInline(esc(texto))}</h${nivel + 1}>`);
    } else if (/^---+$/.test(linha)) {
      if (emLista) { out.push('</ul>'); emLista = false; }
      out.push('<hr>');
    } else if (/^[-*]\s+/.test(linha)) {
      if (!emLista) { out.push('<ul>'); emLista = true; }
      const item = linha.replace(/^[-*]\s+/, '');
      out.push(`<li>${formatarInline(esc(item))}</li>`);
    } else if (linha === '') {
      if (emLista) { out.push('</ul>'); emLista = false; }
    } else {
      if (emLista) { out.push('</ul>'); emLista = false; }
      out.push(`<p>${formatarInline(esc(linha))}</p>`);
    }
  }
  if (emLista) out.push('</ul>');
  return out.join('\n');
}

function formatarInline(s) {
  // code, strong, em, a
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
}
