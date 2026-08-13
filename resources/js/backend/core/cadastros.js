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

// === EXCLUSAO ===
// Regra: bloqueia exclusao se houver dependencias (lancamentos, etc).
// A flag `cascade: true` apaga em cascata, na ordem correta.

export function excluirCliente(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM clientes WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Cliente nao encontrado.');
  const lancs = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE cliente_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  const projs = Number(db.exec('SELECT COUNT(*) FROM projetos WHERE cliente_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  const deps = [];
  if (lancs > 0) deps.push({ label: 'lancamentos', total: lancs });
  if (projs > 0) deps.push({ label: 'projetos', total: projs });
  if (deps.length > 0 && !cascade) {
    throw new Error(`Cliente "${r[1]}" tem dados vinculados: ${deps.map((d) => `${d.total} ${d.label}`).join(', ')}.`);
  }
  db.run('BEGIN');
  try {
    if (cascade) {
      // projetos do cliente: cascateia nos lancamentos
      const projIds = db.exec('SELECT id FROM projetos WHERE cliente_id = ?', [id])[0]?.values?.map((p) => p[0]) ?? [];
      for (const pid of projIds) {
        db.run('UPDATE lancamentos SET projeto_id = NULL WHERE projeto_id = ?', [pid]);
        db.run('DELETE FROM projetos WHERE id = ?', [pid]);
      }
      db.run('UPDATE lancamentos SET cliente_id = NULL WHERE cliente_id = ?', [id]);
    }
    db.run('DELETE FROM clientes WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade };
}

export function excluirFornecedor(db, id) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM fornecedores WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Fornecedor nao encontrado.');
  db.run('DELETE FROM fornecedores WHERE id = ?', [id]);
  return { ok: true, id };
}

export function excluirProjeto(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM projetos WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Projeto nao encontrado.');
  const lancs = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE projeto_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  if (lancs > 0 && !cascade) {
    throw new Error(`Projeto "${r[1]}" tem ${lancs} lancamento(s) vinculado(s).`);
  }
  db.run('BEGIN');
  try {
    if (cascade) db.run('UPDATE lancamentos SET projeto_id = NULL WHERE projeto_id = ?', [id]);
    db.run('DELETE FROM projetos WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade };
}

export function excluirCentroCusto(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM centros_custo WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Centro de custo nao encontrado.');
  const lancs = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE centro_custo_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  if (lancs > 0 && !cascade) {
    throw new Error(`Centro de custo "${r[1]}" tem ${lancs} lancamento(s) vinculado(s).`);
  }
  db.run('BEGIN');
  try {
    if (cascade) db.run('UPDATE lancamentos SET centro_custo_id = NULL WHERE centro_custo_id = ?', [id]);
    db.run('DELETE FROM centros_custo WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade };
}

export function excluirTag(db, id) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM tags WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Tag nao encontrada.');
  // cascade: lancamento_tags apaga junto (FK ON DELETE CASCADE)
  db.run('DELETE FROM tags WHERE id = ?', [id]);
  return { ok: true, id };
}

export function desvincularTagLancamento(db, lancamentoId, tagId) {
  if (!Number.isInteger(lancamentoId) || !Number.isInteger(tagId)) throw new Error('ids obrigatorios.');
  db.run('DELETE FROM lancamento_tags WHERE lancamento_id = ? AND tag_id = ?', [lancamentoId, tagId]);
  return true;
}
