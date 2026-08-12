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
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  // Seed: cria categoria padrao "Transferencia" (natureza ambas) usada pelo fluxo transferencia
  db.run('INSERT INTO categorias (contexto_id, nome, natureza) VALUES (?, ?, ?)', [id, 'Transferência interna', 'ambas']);
  return id;
}

export function listarContextos(db, incluirInativos = false) {
  const cond = incluirInativos ? '' : 'WHERE ativo = 1';
  return db.exec(`SELECT id, nome, descricao, ativo, criado_em FROM contextos_financeiros ${cond} ORDER BY ativo DESC, nome`)[0]?.values ?? [];
}

export function obterContexto(db, id) {
  if (!Number.isInteger(id)) return null;
  const rows = db.exec('SELECT id, nome, descricao, ativo, criado_em FROM contextos_financeiros WHERE id = ?', [id])[0]?.values ?? [];
  return rows[0] || null;
}

export function atualizarContexto(db, { id, nome, descricao }) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const ctx = obterContexto(db, id);
  if (!ctx) throw new Error('Contexto nao encontrado.');
  const novoNome = (nome ?? ctx[1]).trim();
  const novaDescricao = (descricao ?? ctx[2]).trim();
  if (!novoNome) throw new Error('Nome do contexto nao pode ser vazio.');
  db.run('UPDATE contextos_financeiros SET nome = ?, descricao = ? WHERE id = ?', [novoNome, novaDescricao, id]);
  return id;
}

export function alternarContextoAtivo(db, id) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const ctx = obterContexto(db, id);
  if (!ctx) throw new Error('Contexto nao encontrado.');
  const novoAtivo = ctx[3] ? 0 : 1;
  db.run('UPDATE contextos_financeiros SET ativo = ? WHERE id = ?', [novoAtivo, id]);
  return novoAtivo === 1;
}

/** Retorna saldos agregados do contexto: total receitas, despesas, contas, clientes, etc. */
export function resumoContexto(db, contextoId) {
  if (!Number.isInteger(contextoId)) return null;
  const out = { contextoId };
  const rec = db.exec('SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE contexto_id = ? AND natureza = ? AND status != ?', [contextoId, 'receita', 'estornado'])[0]?.values?.[0]?.[0] ?? 0;
  const desp = db.exec('SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE contexto_id = ? AND natureza = ? AND status != ?', [contextoId, 'despesa', 'estornado'])[0]?.values?.[0]?.[0] ?? 0;
  out.receitas = Number(rec);
  out.despesas = Number(desp);
  out.saldo = out.receitas - out.despesas;
  out.lancamentos = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.contas = Number(db.exec('SELECT COUNT(*) FROM contas WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.clientes = Number(db.exec('SELECT COUNT(*) FROM clientes WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.projetos = Number(db.exec('SELECT COUNT(*) FROM projetos WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  return out;
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
