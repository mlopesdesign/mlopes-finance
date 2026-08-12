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
