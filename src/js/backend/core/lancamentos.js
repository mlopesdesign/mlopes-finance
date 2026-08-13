import { validarData, validarValorCentavos } from './financeiro.js';

export function criarLancamento(db, input, agora = new Date().toISOString()) {
  const { contextoId, contaId, categoriaId = null, clienteId = null, projetoId = null, centroCustoId = null, natureza, valorCentavos, dataCompetencia, descricao, observacoes = '' } = input;
  if (!Number.isInteger(contextoId) || !Number.isInteger(contaId)) throw new Error('Contexto e conta são obrigatórios.');
  if (!['receita', 'despesa'].includes(natureza)) throw new Error('Natureza deve ser receita ou despesa.');
  validarValorCentavos(valorCentavos); validarData(dataCompetencia);
  if (!descricao?.trim()) throw new Error('Descrição é obrigatória.');
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id, natureza, valor_centavos, data_competencia, descricao, observacoes, status, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)`, [contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId, natureza, valorCentavos, dataCompetencia, descricao.trim(), observacoes.trim(), agora]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)', ['lancamentos', id, 'criado', JSON.stringify(input), agora]);
  return id;
}

export function conciliarLancamento(db, id, agora = new Date().toISOString()) {
  const rows = db.exec('SELECT id, status FROM lancamentos WHERE id = ?', [id]);
  if (!rows.length || !rows[0].values.length) throw new Error('Lançamento não encontrado.');
  if (rows[0].values[0][1] === 'conciliado') return false;
  db.run('UPDATE lancamentos SET status = \'conciliado\', atualizado_em = ? WHERE id = ?', [agora, id]);
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)', ['lancamentos', id, 'conciliado', '{}', agora]);
  return true;
}

export function resumo(db, contextoId) {
  const rows = db.exec(`SELECT natureza, COALESCE(SUM(valor_centavos), 0) total FROM lancamentos WHERE contexto_id = ? GROUP BY natureza`, [contextoId]);
  const out = { receitas: 0, despesas: 0 };
  for (const [natureza, total] of rows[0]?.values ?? []) out[natureza === 'receita' ? 'receitas' : 'despesas'] = Number(total);
  return { ...out, saldo: out.receitas - out.despesas };
}

// === EXCLUSAO / ESTORNO ===
// Regra do PADRAO/AGENTS: lancamento CONCILIADO NAO pode ser apagado.
// Correcoes em lancamentos conciliados sao por ESTORNO (cria lancamento inverso
// e marca o original como 'estornado').

export function excluirLancamento(db, id, agora = new Date().toISOString()) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, status, transferencia_id FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  const [_, status, transferenciaId] = r;
  if (status === 'conciliado') {
    throw new Error('Lancamento conciliado nao pode ser excluido. Use estornar (cria lancamento inverso).');
  }
  if (status === 'estornado') {
    throw new Error('Lancamento ja foi estornado.');
  }
  if (transferenciaId != null) {
    throw new Error('Lancamento faz parte de uma transferencia. Exclua a transferencia (ou use cascade).');
  }
  db.run('BEGIN');
  try {
    // Baixas vinculadas (cascade opcional via FK? NAO, schema nao tem cascade)
    db.run('DELETE FROM baixas WHERE lancamento_id = ?', [id]);
    // itens_importacao.lancamento_id -> NULL
    db.run('UPDATE itens_importacao SET lancamento_id = NULL, status = ? WHERE lancamento_id = ?', ['ignorado', id]);
    // Anexos: FK com ON DELETE SET NULL ja cuida
    // Auditoria: mantem registro
    db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
      ['lancamentos', id, 'excluido', JSON.stringify({}), agora]);
    // lancamento_tags tem cascade
    db.run('DELETE FROM lancamentos WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, statusAnterior: status };
}

/**
 * Estorna um lancamento criando um lancamento inverso (mesmo valor, natureza oposta).
 * O lancamento original e' marcado como 'estornado'. Mantem o historico (auditoria).
 * Usado para corrigir lancamentos CONCILIADOS (regra do PADRAO).
 */
export function estornarLancamento(db, id, dataEstorno = null, agora = new Date().toISOString()) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, contexto_id, conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id, natureza, valor_centavos, data_competencia, descricao, observacoes, status, transferencia_id FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  const [_, contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId, natureza, valorCentavos, dataComp, descricao, observacoes, status, transferenciaId] = r;
  if (status === 'estornado') throw new Error('Lancamento ja foi estornado.');
  if (transferenciaId != null) throw new Error('Lancamento de transferencia. Estorne via transferencias.');
  if (natureza === 'transferencia') throw new Error('Lancamento de transferencia nao pode ser estornado por aqui.');
  const naturezaInversa = natureza === 'receita' ? 'despesa' : 'receita';
  const dataEst = dataEstorno || new Date().toISOString().slice(0, 10);
  db.run('BEGIN');
  try {
    // Cria o lancamento inverso
    const idEstorno = criarLancamento(db, {
      contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId,
      natureza: naturezaInversa, valorCentavos: Number(valorCentavos),
      dataCompetencia: dataEst,
      descricao: `ESTORNO de #${id}: ${descricao}`,
      observacoes: observacoes || `Estorno automatico do lancamento #${id}.`,
    }, agora);
    // Marca o original como estornado
    db.run("UPDATE lancamentos SET status = 'estornado', atualizado_em = ? WHERE id = ?", [agora, id]);
    db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
      ['lancamentos', id, 'estornado', JSON.stringify({ lancamentoEstornoId: idEstorno }), agora]);
    db.run('COMMIT');
    return { ok: true, idOriginal: id, idEstorno, naturezaOriginal: natureza, naturezaEstorno: naturezaInversa };
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

/** Edita um lancamento. Bloqueia se conciliado (use estornar). */
export function editarLancamento(db, id, campos, agora = new Date().toISOString()) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT status, transferencia_id FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  const [status, transferenciaId] = r;
  if (status === 'conciliado') throw new Error('Lancamento conciliado nao pode ser editado. Use estornar.');
  if (status === 'estornado') throw new Error('Lancamento estornado nao pode ser editado.');
  if (transferenciaId != null) throw new Error('Lancamento de transferencia. Edite via transferencias.');
  const permitidos = ['conta_id', 'categoria_id', 'cliente_id', 'projeto_id', 'centro_custo_id',
                      'natureza', 'valor_centavos', 'data_competencia', 'descricao', 'observacoes', 'data_vencimento'];
  const sets = []; const vals = [];
  for (const k of permitidos) {
    if (k in campos) {
      if (k === 'valor_centavos') {
        if (!Number.isSafeInteger(campos[k]) || campos[k] <= 0) throw new Error('valor_centavos deve ser inteiro positivo.');
      }
      if (k === 'data_competencia' || k === 'data_vencimento') {
        validarData(campos[k]);
      }
      if (k === 'natureza' && !['receita', 'despesa'].includes(campos[k])) throw new Error('Natureza invalida.');
      // Mapear snake_case do DB para camelCase do param de entrada
      const dbCol = k;
      sets.push(`${dbCol} = ?`);
      vals.push(campos[k] == null ? null : String(campos[k]));
    }
  }
  if (!sets.length) return false;
  sets.push('atualizado_em = ?');
  vals.push(agora);
  vals.push(id);
  db.run(`UPDATE lancamentos SET ${sets.join(', ')} WHERE id = ?`, vals);
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
    ['lancamentos', id, 'editado', JSON.stringify(campos), agora]);
  return true;
}

export function listarLancamentos(db, contextoId, { incluirEstornados = false, limite = 500 } = {}) {
  if (!Number.isInteger(contextoId)) return [];
  const condEstornado = incluirEstornados ? '' : "AND status != 'estornado'";
  return db.exec(
    `SELECT * FROM lancamentos WHERE contexto_id = ? ${condEstornado} ORDER BY data_competencia DESC, id DESC LIMIT ?`,
    [contextoId, Number(limite)]
  )[0]?.values ?? [];
}

export function obterLancamento(db, id) {
  if (!Number.isInteger(id)) return null;
  return db.exec('SELECT * FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0] ?? null;
}
