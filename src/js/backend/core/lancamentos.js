import { validarData, validarValorCentavos } from './financeiro.js';
import { calcularCicloDaCompra, abrirFatura } from './cartoes.js';

export function criarLancamento(db, input, agora = new Date().toISOString()) {
  let { contextoId, contaId, categoriaId = null, clienteId = null, projetoId = null, centroCustoId = null, natureza, valorCentavos, dataCompetencia, descricao, observacoes = '', cartaoId = null, faturaId = null, status = 'aberto' } = input;
  if (!Number.isInteger(contextoId) || !Number.isInteger(contaId)) throw new Error('Contexto e conta são obrigatórios.');
  if (!['receita', 'despesa'].includes(natureza)) throw new Error('Natureza deve ser receita ou despesa.');
  if (!['aberto', 'conciliado', 'estornado'].includes(status)) throw new Error('Status invalido.');
  validarValorCentavos(valorCentavos); validarData(dataCompetencia);
  if (!descricao?.trim()) throw new Error('Descrição é obrigatória.');
  // v0.9.0: se a conta e' tipo 'cartao' e o user NAO passou cartaoId/faturaId
  // explicitamente, auto-descobrir o cartao via cartoes.conta_associada_id e
  // abrir/vincular a fatura do ciclo. Isso faz com que toda compra no cartao
  // caia na fatura certa, sem o user ter que pensar nisso.
  if (faturaId == null && cartaoId == null) {
    const tipoConta = db.exec('SELECT tipo FROM contas WHERE id = ?', [contaId])[0]?.values?.[0]?.[0];
    if (tipoConta === 'cartao') {
      const cart = db.exec('SELECT id FROM cartoes WHERE conta_associada_id = ? AND ativo = 1', [contaId])[0]?.values?.[0];
      if (cart) {
        cartaoId = Number(cart[0]);
        const { ciclo, dataFechamento, dataVencimento } = calcularCicloDaCompra(db, { cartaoId, dataCompra: dataCompetencia });
        faturaId = abrirFatura(db, { cartaoId, ciclo, dataFechamento, dataVencimento });
      }
    }
  }
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id, natureza, valor_centavos, data_competencia, descricao, observacoes, cartao_id, fatura_id, status, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId, natureza, valorCentavos, dataCompetencia, descricao.trim(), observacoes.trim(), cartaoId, faturaId, status, agora]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  // v0.9.0: atualiza valor_total_centavos da fatura (soma os lancamentos vinculados)
  if (faturaId != null) {
    db.run('UPDATE faturas SET valor_total_centavos = (SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos WHERE fatura_id = ? AND status != \'estornado\') WHERE id = ?', [faturaId, faturaId]);
  }
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
  const r = db.exec('SELECT id, status, transferencia_id, fatura_id, valor_centavos FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  const [_, status, transferenciaId, faturaId, valorCentavos] = r;
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
    // lancamento_tags tem cascade
    db.run('DELETE FROM lancamentos WHERE id = ?', [id]);
    // v0.9.0: recalcula valor_total_centavos da fatura APOS excluir o lancamento
    // (a query precisa rodar DEPOIS do DELETE pra nao contar o proprio lancamento)
    if (faturaId != null) {
      db.run('UPDATE faturas SET valor_total_centavos = (SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos WHERE fatura_id = ? AND status != \'estornado\') WHERE id = ?', [faturaId, faturaId]);
    }
    // Auditoria: mantem registro
    db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
      ['lancamentos', id, 'excluido', JSON.stringify({}), agora]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, statusAnterior: status };
}

/**
 * Estorna um lancamento criando um lancamento inverso (mesmo valor, natureza oposta).
 * O lancamento original E o inverso ficam com status='estornado' (assim o saldo
 * nao muda — os 2 sao ignorados pela query de saldo). Mantem o historico (auditoria).
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
    // Cria o lancamento inverso com status='estornado' direto (assim o saldo nao
    // muda — os 2 lancamentos ficam invisiveis pro calculo de saldo, mas aparecem
    // na auditoria e na lista de "incluir estornados")
    const idEstorno = criarLancamento(db, {
      contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId,
      natureza: naturezaInversa, valorCentavos: Number(valorCentavos),
      dataCompetencia: dataEst,
      descricao: `ESTORNO de #${id}: ${descricao}`,
      observacoes: observacoes || `Estorno automatico do lancamento #${id}.`,
      status: 'estornado',
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

/**
 * Lista lancamentos COM nomes relacionados (conta, categoria, cliente, projeto, centro de custo)
 * via LEFT JOIN. Retorna 22 colunas: 17 de `lancamentos` + 5 nomes.
 * Schema das colunas de retorno:
 *   0  id | 1  contexto_id | 2  conta_id | 3  categoria_id | 4  cliente_id |
 *   5  projeto_id | 6  centro_custo_id | 7  natureza | 8  valor_centavos |
 *   9  data_competencia | 10 data_vencimento | 11 descricao | 12 observacoes |
 *   13 transferencia_id | 14 status | 15 criado_em | 16 atualizado_em |
 *   17 conta_nome | 18 categoria_nome | 19 cliente_nome | 20 projeto_nome | 21 centro_custo_nome
 * Lancamentos de transferencia NAO aparecem (sao "movimentacao interna", nao
 * receita/despesa do contexto). Sao geridos pela tela de Transferencias.
 */
/**
 * Exclui TODOS os lancamentos de um contexto (com cascade: baixas, transferências
 * vinculadas, tags). NAO apaga os cadastros (contas, categorias, clientes, etc).
 * Uso: botao "Excluir todos" da tela de Lancamentos, para limpar a tela sem resetar
 * o banco inteiro (o user mantem os cadastros, so limpa os movimentos).
 */
export function excluirTodosLancamentos(db, contextoId, agora = new Date().toISOString()) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  // Coleta IDs antes (pq o DELETE cascata pode bagunçar a contagem)
  const ids = db.exec('SELECT id FROM lancamentos WHERE contexto_id = ?', [contextoId])[0]?.values?.map(r => r[0]) ?? [];
  if (!ids.length) return { ok: true, excluidos: 0 };
  // v0.9.0: coleta faturas afetadas pra recalcular valor_total_centavos
  const faturasAfetadas = db.exec('SELECT DISTINCT fatura_id FROM lancamentos WHERE contexto_id = ? AND fatura_id IS NOT NULL', [contextoId])[0]?.values?.map(r => r[0]) ?? [];
  db.run('BEGIN');
  try {
    // 1. Limpar transferencia_id dos lancamentos deste contexto PRIMEIRO
    //    (FK lancamentos.transferencia_id -> transferencias.id e' NO ACTION; sem
    //    isso, o DELETE da transferencia falha com FK constraint).
    db.run('UPDATE lancamentos SET transferencia_id = NULL WHERE contexto_id = ? AND transferencia_id IS NOT NULL', [contextoId]);
    // 2. Excluir transferencias deste contexto
    db.run('DELETE FROM transferencias WHERE contexto_id = ?', [contextoId]);
    // 3. Limpar referencias nos itens_importacao
    db.run('UPDATE itens_importacao SET lancamento_id = NULL, status = ? WHERE lancamento_id IN (' + ids.map(() => '?').join(',') + ')', ['ignorado', ...ids]);
    // 4. Excluir baixas vinculadas
    db.run('DELETE FROM baixas WHERE lancamento_id IN (' + ids.map(() => '?').join(',') + ')', ids);
    // 5. Excluir lancamentos (cascade: lancamento_tags via FK ON DELETE CASCADE)
    db.run('DELETE FROM lancamentos WHERE id IN (' + ids.map(() => '?').join(',') + ')', ids);
    // 6. v0.9.0: recalcula valor_total_centavos das faturas afetadas
    for (const faturaId of faturasAfetadas) {
      db.run('UPDATE faturas SET valor_total_centavos = (SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos WHERE fatura_id = ? AND status != \'estornado\') WHERE id = ?', [faturaId, faturaId]);
    }
    // 7. v0.8.20: Auditoria consolidada (1 linha resumo, NAO 1 por lancamento —
    //    seria 63+ linhas e polui a tabela). O user pode ver os IDs especificos
    //    via consulta direta se precisar.
    db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
      ['lancamentos', contextoId, 'excluidosEmMassa', JSON.stringify({ quantidade: ids.length, ids }), agora]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, excluidos: ids.length };
}

export function listarLancamentosDetalhados(db, contextoId, { incluirEstornados = false, limite = 500 } = {}) {
  if (!Number.isInteger(contextoId)) return [];
  const condEstornado = incluirEstornados ? '' : "AND l.status != 'estornado'";
  return db.exec(
    `SELECT l.*,
            COALESCE(c.nome, '')   AS conta_nome,
            COALESCE(ca.nome, '')  AS categoria_nome,
            COALESCE(cl.nome, '')  AS cliente_nome,
            COALESCE(p.nome, '')   AS projeto_nome,
            COALESCE(cc.nome, '')  AS centro_custo_nome
     FROM lancamentos l
     LEFT JOIN contas c        ON c.id  = l.conta_id
     LEFT JOIN categorias ca   ON ca.id = l.categoria_id
     LEFT JOIN clientes cl     ON cl.id = l.cliente_id
     LEFT JOIN projetos p      ON p.id  = l.projeto_id
     LEFT JOIN centros_custo cc ON cc.id = l.centro_custo_id
     WHERE l.contexto_id = ? ${condEstornado}
       AND l.natureza IN ('receita', 'despesa')
       AND l.transferencia_id IS NULL
     ORDER BY l.data_competencia DESC, l.id DESC
     LIMIT ?`,
    [contextoId, Number(limite)]
  )[0]?.values ?? [];
}

export function obterLancamento(db, id) {
  if (!Number.isInteger(id)) return null;
  return db.exec('SELECT * FROM lancamentos WHERE id = ?', [id])[0]?.values?.[0] ?? null;
}
