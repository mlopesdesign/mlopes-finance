// MLopes Finance — baixas (pagamentos) de lancamentos
// Regras: baixa parcial nunca excede o saldo em aberto. Lancamento conciliado nao pode ser baixado de novo.

import { validarData, validarValorCentavos } from './financeiro.js';

export function saldoEmAberto(db, lancamentoId) {
  const r = db.exec('SELECT valor_centavos, status FROM lancamentos WHERE id = ?', [lancamentoId])[0]?.values?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  const valor = r[0]; const status = r[1];
  if (status === 'estornado') return 0;
  const total = Number(db.exec('SELECT COALESCE(SUM(valor_centavos),0) FROM baixas WHERE lancamento_id = ?', [lancamentoId])[0]?.values?.[0]?.[0] ?? 0);
  return Number(valor) - total;
}

export function registrarBaixa(db, { lancamentoId, valorCentavos, dataBaixa, formaPagamento = 'dinheiro', observacoes = '' }, agora = new Date().toISOString()) {
  if (!Number.isInteger(lancamentoId)) throw new Error('Lancamento obrigatorio.');
  validarValorCentavos(valorCentavos);
  validarData(dataBaixa);
  const r = db.exec('SELECT status FROM lancamentos WHERE id = ?', [lancamentoId])[0]?.values?.[0]?.[0];
  if (!r) throw new Error('Lancamento nao encontrado.');
  if (r === 'estornado') throw new Error('Lancamento estornado, nao recebe baixa.');
  const saldo = saldoEmAberto(db, lancamentoId);
  if (valorCentavos > saldo) throw new Error(`Baixa (${valorCentavos}) excede saldo em aberto (${saldo}).`);
  db.run(`INSERT INTO baixas (lancamento_id, valor_centavos, data_baixa, forma_pagamento, observacoes) VALUES (?, ?, ?, ?, ?)`,
    [lancamentoId, valorCentavos, dataBaixa, String(formaPagamento), String(observacoes)]);
  const idBaixa = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  // Audita
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
    ['baixas', idBaixa, 'criada', JSON.stringify({ lancamentoId, valorCentavos, dataBaixa }), agora]);
  // Se a baixa quita o saldo, marca como conciliado (conceito amplo: pago)
  if (valorCentavos === saldo) {
    db.run("UPDATE lancamentos SET status = 'conciliado', atualizado_em = ? WHERE id = ?", [agora, lancamentoId]);
  }
  return { id: idBaixa, saldoRestante: saldo - valorCentavos };
}

export function listarBaixas(db, lancamentoId) {
  return db.exec('SELECT * FROM baixas WHERE lancamento_id = ? ORDER BY data_baixa DESC, id DESC', [lancamentoId])[0]?.values ?? [];
}

/** Lista apenas compromissos que realmente admitem baixa manual. */
export function listarLancamentosPendentesDeBaixa(db, contextoId, limite = 500) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec(`
    SELECT l.*,
           COALESCE(c.nome, '') AS conta_nome,
           COALESCE(ca.nome, '') AS categoria_nome,
           COALESCE(cl.nome, '') AS cliente_nome,
           COALESCE(p.nome, '') AS projeto_nome,
           COALESCE(cc.nome, '') AS centro_custo_nome
    FROM lancamentos l
    JOIN contas c ON c.id = l.conta_id
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    LEFT JOIN clientes cl ON cl.id = l.cliente_id
    LEFT JOIN projetos p ON p.id = l.projeto_id
    LEFT JOIN centros_custo cc ON cc.id = l.centro_custo_id
    WHERE l.contexto_id = ? AND l.status = 'aberto'
      AND c.tipo != 'cartao'
      AND l.natureza IN ('receita', 'despesa')
      AND l.transferencia_id IS NULL
      AND l.valor_centavos > (SELECT COALESCE(SUM(b.valor_centavos), 0) FROM baixas b WHERE b.lancamento_id = l.id)
    ORDER BY l.data_competencia DESC, l.id DESC
    LIMIT ?
  `, [contextoId, Number(limite)])[0]?.values ?? [];
}

export function removerBaixa(db, idBaixa, agora = new Date().toISOString()) {
  const r = db.exec('SELECT lancamento_id, valor_centavos FROM baixas WHERE id = ?', [idBaixa])[0]?.values?.[0];
  if (!r) throw new Error('Baixa nao encontrada.');
  const lancamentoId = r[0]; const valor = r[1];
  db.run('DELETE FROM baixas WHERE id = ?', [idBaixa]);
  // Se lancamento estava conciliado por causa dessa baixa, volta para aberto
  const r2 = db.exec('SELECT status FROM lancamentos WHERE id = ?', [lancamentoId])[0]?.values?.[0]?.[0];
  if (r2 === 'conciliado') {
    db.run("UPDATE lancamentos SET status = 'aberto', atualizado_em = ? WHERE id = ?", [agora, lancamentoId]);
  }
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
    ['baixas', idBaixa, 'removida', JSON.stringify({ lancamentoId, valor }), agora]);
  return true;
}
