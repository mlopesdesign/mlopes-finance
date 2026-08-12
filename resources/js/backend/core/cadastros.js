// MLopes Finance — cadastros editaveis (clientes, fornecedores, projetos, centros_custo, tags)
// Pure functions sobre `db`. Sem DOM. Sem Neutralino.

function exigirContextoEId(contextoId, tabela) {
  if (!Number.isInteger(contextoId)) throw new Error(`Contexto obrigatorio para ${tabela}.`);
}

function exigirNome(nome) {
  if (!nome || !String(nome).trim()) throw new Error('Nome obrigatorio.');
  return String(nome).trim();
}

// === CLIENTES ===
export function criarCliente(db, { contextoId, nome, documento = '', email = '', telefone = '', observacoes = '' }) {
  exigirContextoEId(contextoId, 'cliente');
  const n = exigirNome(nome);
  db.run(`INSERT INTO clientes (contexto_id, nome, documento, email, telefone, observacoes) VALUES (?, ?, ?, ?, ?, ?)`,
    [contextoId, n, String(documento), String(email), String(telefone), String(observacoes)]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
export function listarClientes(db, contextoId, { incluirInativos = false } = {}) {
  exigirContextoEId(contextoId, 'clientes');
  const where = incluirInativos ? 'contexto_id = ?' : 'contexto_id = ? AND ativo = 1';
  return db.exec(`SELECT * FROM clientes WHERE ${where} ORDER BY nome`, [contextoId])[0]?.values ?? [];
}
export function atualizarCliente(db, id, campos) {
  const permitidos = ['nome', 'documento', 'email', 'telefone', 'observacoes', 'ativo'];
  const sets = []; const vals = [];
  for (const k of permitidos) if (k in campos) { sets.push(`${k} = ?`); vals.push(String(campos[k])); }
  if (!sets.length) return false;
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  vals.push(id);
  db.run(`UPDATE clientes SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

// === FORNECEDORES ===
export function criarFornecedor(db, { contextoId, nome, documento = '', observacoes = '' }) {
  exigirContextoEId(contextoId, 'fornecedor');
  const n = exigirNome(nome);
  db.run(`INSERT INTO fornecedores (contexto_id, nome, documento, observacoes) VALUES (?, ?, ?, ?)`,
    [contextoId, n, String(documento), String(observacoes)]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
export function listarFornecedores(db, contextoId) {
  exigirContextoEId(contextoId, 'fornecedores');
  return db.exec(`SELECT * FROM fornecedores WHERE contexto_id = ? AND ativo = 1 ORDER BY nome`, [contextoId])[0]?.values ?? [];
}
export function atualizarFornecedor(db, id, campos) {
  const permitidos = ['nome', 'documento', 'observacoes', 'ativo'];
  const sets = []; const vals = [];
  for (const k of permitidos) if (k in campos) { sets.push(`${k} = ?`); vals.push(String(campos[k])); }
  if (!sets.length) return false;
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  vals.push(id);
  db.run(`UPDATE fornecedores SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

// === PROJETOS ===
export function criarProjeto(db, { contextoId, clienteId = null, nome, descricao = '', dataInicio = null, dataFim = null }) {
  exigirContextoEId(contextoId, 'projeto');
  const n = exigirNome(nome);
  db.run(`INSERT INTO projetos (contexto_id, cliente_id, nome, descricao, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?)`,
    [contextoId, clienteId, n, String(descricao), dataInicio, dataFim]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
export function listarProjetos(db, contextoId) {
  exigirContextoEId(contextoId, 'projetos');
  return db.exec(`SELECT * FROM projetos WHERE contexto_id = ? AND ativo = 1 ORDER BY nome`, [contextoId])[0]?.values ?? [];
}
export function atualizarProjeto(db, id, campos) {
  const permitidos = ['cliente_id', 'nome', 'descricao', 'data_inicio', 'data_fim', 'ativo'];
  const sets = []; const vals = [];
  for (const k of permitidos) if (k in campos) { sets.push(`${k} = ?`); vals.push(campos[k] == null ? null : String(campos[k])); }
  if (!sets.length) return false;
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  vals.push(id);
  db.run(`UPDATE projetos SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

// === CENTROS DE CUSTO ===
export function criarCentroCusto(db, { contextoId, nome, descricao = '' }) {
  exigirContextoEId(contextoId, 'centro_custo');
  const n = exigirNome(nome);
  try {
    db.run(`INSERT INTO centros_custo (contexto_id, nome, descricao) VALUES (?, ?, ?)`,
      [contextoId, n, String(descricao)]);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error(`Ja existe um centro de custo "${n}" neste contexto.`);
    throw e;
  }
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
export function listarCentrosCusto(db, contextoId) {
  exigirContextoEId(contextoId, 'centros_custo');
  return db.exec(`SELECT * FROM centros_custo WHERE contexto_id = ? AND ativo = 1 ORDER BY nome`, [contextoId])[0]?.values ?? [];
}

// === TAGS ===
export function criarTag(db, { contextoId, nome, cor = '#155e6f' }) {
  exigirContextoEId(contextoId, 'tag');
  const n = exigirNome(nome);
  try {
    db.run(`INSERT INTO tags (contexto_id, nome, cor) VALUES (?, ?, ?)`,
      [contextoId, n, cor]);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error(`Ja existe uma tag "${n}" neste contexto.`);
    throw e;
  }
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}
export function listarTags(db, contextoId) {
  exigirContextoEId(contextoId, 'tags');
  return db.exec(`SELECT * FROM tags WHERE contexto_id = ? AND ativo = 1 ORDER BY nome`, [contextoId])[0]?.values ?? [];
}
export function vincularTagLancamento(db, lancamentoId, tagId) {
  try {
    db.run(`INSERT INTO lancamento_tags (lancamento_id, tag_id) VALUES (?, ?)`, [lancamentoId, tagId]);
    return true;
  } catch (e) { return false; }
}
export function listarTagsDoLancamento(db, lancamentoId) {
  return db.exec(`SELECT t.* FROM tags t JOIN lancamento_tags lt ON lt.tag_id = t.id WHERE lt.lancamento_id = ?`, [lancamentoId])[0]?.values ?? [];
}
