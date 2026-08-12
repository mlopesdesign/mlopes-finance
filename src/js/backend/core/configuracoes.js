// MLopes Finance — backend de configurações
// Pure functions, recebem `db` como primeiro parâmetro. Sem DOM. Sem Neutralino.

const VALORES_PERMITIDOS = {
  tema: new Set(['light', 'dark']),
};

export function getConfig(db, chave) {
  if (!chave || typeof chave !== 'string') throw new Error('Chave inválida.');
  const r = db.exec('SELECT valor, tipo, atualizado_em FROM configuracoes WHERE chave = ?', [chave]);
  if (!r[0]?.values?.length) return null;
  const [valor, tipo, atualizado_em] = r[0].values[0];
  return { chave, valor, tipo, atualizado_em };
}

export function setConfig(db, chave, valor, tipo = 'texto') {
  if (!chave || typeof chave !== 'string') throw new Error('Chave inválida.');
  if (valor === null || valor === undefined) throw new Error('Valor não pode ser nulo.');
  const valorStr = String(valor);
  if (chave in VALORES_PERMITIDOS && !VALORES_PERMITIDOS[chave].has(valorStr)) {
    throw new Error(`Valor inválido para ${chave}: ${valorStr}. Permitidos: ${[...VALORES_PERMITIDOS[chave]].join(', ')}`);
  }
  if (tipo === 'cor' && !/^#[0-9a-fA-F]{6}$/.test(valorStr)) {
    throw new Error(`Cor inválida: ${valorStr}. Use formato #RRGGBB.`);
  }
  db.run(
    `INSERT INTO configuracoes (chave, valor, tipo, atualizado_em)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, tipo = excluded.tipo, atualizado_em = CURRENT_TIMESTAMP`,
    [chave, valorStr, tipo]
  );
  return { chave, valor: valorStr, tipo };
}

export function getAllConfig(db) {
  const r = db.exec('SELECT chave, valor, tipo, atualizado_em FROM configuracoes ORDER BY chave');
  const out = {};
  for (const row of r[0]?.values ?? []) {
    const [chave, valor, tipo, atualizado_em] = row;
    out[chave] = { valor, tipo, atualizado_em };
  }
  return out;
}

export function deleteConfig(db, chave) {
  db.run('DELETE FROM configuracoes WHERE chave = ?', [chave]);
  return true;
}

/** Reseta para os defaults da migração v0.4.0. Apaga tudo e re-seed. */
export function resetConfig(db) {
  db.run('DELETE FROM configuracoes');
  const defaults = [
    ['tema', 'dark', 'texto'],
    ['marca_cor', '#155e6f', 'cor'],
    ['nome_exibicao', 'MLopes Finance', 'texto'],
    ['moeda', 'BRL', 'texto'],
    ['locale', 'pt-BR', 'texto'],
  ];
  for (const [chave, valor, tipo] of defaults) {
    db.run(`INSERT INTO configuracoes (chave, valor, tipo) VALUES (?, ?, ?)`, [chave, valor, tipo]);
  }
  return getAllConfig(db);
}
