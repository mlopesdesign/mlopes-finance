// MLopes Finance — tema dinâmico (light/dark + cor da marca customizada).
// Aplica no DOM via data-theme no <html>. Cor da marca sobrescreve --brand
// direto no <html>. Tudo persistido no banco (configuracoes.tema / marca).

const KEY_TEMA = 'tema';
const KEY_MARCA = 'marca_cor';
const TEMAS_VALIDOS = new Set(['light', 'dark']);

export const DEFAULTS = Object.freeze({
  tema: 'dark',
  marca: '#155e6f',
});

/** Aplica o tema no DOM. Idempotente. */
export function aplicarTema({ tema = DEFAULTS.tema, marca = DEFAULTS.marca } = {}) {
  const t = TEMAS_VALIDOS.has(tema) ? tema : DEFAULTS.tema;
  document.documentElement.setAttribute('data-theme', t);
  if (typeof marca === 'string' && /^#[0-9a-fA-F]{6}$/.test(marca)) {
    document.documentElement.style.setProperty('--brand', marca);
  } else {
    document.documentElement.style.removeProperty('--brand');
  }
  return { tema: t, marca };
}

/** Aplica inline a partir do banco (usado no boot, antes do primeiro render). */
export function aplicarTemaDoBanco(db) {
  const tema = getConfigValor(db, KEY_TEMA) || DEFAULTS.tema;
  const marca = getConfigValor(db, KEY_MARCA) || DEFAULTS.marca;
  return aplicarTema({ tema, marca });
}

/** Helper que lê direto do DB sem precisar de API. */
function getConfigValor(db, chave) {
  const r = db.exec('SELECT valor FROM configuracoes WHERE chave = ?', [chave]);
  return r[0]?.values?.[0]?.[0];
}

/** Alterna entre light e dark. Retorna o novo tema. */
export function alternarTema(db) {
  const atual = getConfigValor(db, KEY_TEMA) || DEFAULTS.tema;
  const proximo = atual === 'dark' ? 'light' : 'dark';
  setConfigValor(db, KEY_TEMA, proximo);
  aplicarTema({ tema: proximo, marca: getConfigValor(db, KEY_MARCA) || DEFAULTS.marca });
  return proximo;
}

/** Escreve direto no DB (sem passar pela API). Usado pelo boot e por testes. */
export function setConfigValor(db, chave, valor) {
  db.run(
    `INSERT INTO configuracoes (chave, valor, tipo, atualizado_em)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = CURRENT_TIMESTAMP`,
    [chave, String(valor), 'texto']
  );
}
