export function validarValorCentavos(valor) {
  if (!Number.isSafeInteger(valor) || valor <= 0) throw new Error('O valor deve ser um inteiro positivo em centavos.');
  return valor;
}

export function validarData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('A data deve usar o formato YYYY-MM-DD.');
  const d = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== data) throw new Error('Data operacional inválida.');
  return data;
}

export function criarContexto(db, { nome, descricao = '' }) {
  if (!nome?.trim()) throw new Error('Nome do contexto é obrigatório.');
  db.run('INSERT INTO contextos_financeiros (nome, descricao) VALUES (?, ?)', [nome.trim(), descricao.trim()]);
  return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
}

export function criarConta(db, { contextoId, nome, tipo = 'bancaria', saldoInicialCentavos = 0 }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto financeiro é obrigatório.');
  if (!nome?.trim()) throw new Error('Nome da conta é obrigatório.');
  if (!['bancaria', 'cartao', 'investimento'].includes(tipo)) throw new Error('Tipo de conta inválido.');
  if (!Number.isSafeInteger(saldoInicialCentavos)) throw new Error('Saldo inicial deve estar em centavos.');
  db.run('INSERT INTO contas (contexto_id, nome, tipo, saldo_inicial_centavos) VALUES (?, ?, ?, ?)', [contextoId, nome.trim(), tipo, saldoInicialCentavos]);
  return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
}

export function criarCategoria(db, { contextoId, nome, natureza = 'ambas' }) {
  if (!Number.isInteger(contextoId) || !nome?.trim()) throw new Error('Contexto e nome da categoria são obrigatórios.');
  if (!['receita', 'despesa', 'ambas'].includes(natureza)) throw new Error('Natureza inválida.');
  db.run('INSERT INTO categorias (contexto_id, nome, natureza) VALUES (?, ?, ?)', [contextoId, nome.trim(), natureza]);
  return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
}
