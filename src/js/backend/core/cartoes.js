// MLopes Finance — cartoes de credito e faturas
// Cadastro, fatura por ciclo, parcelas, pagamento (sem dupla despesa).

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export function criarCartao(db, { contextoId, nome, instituicao = '', limiteCentavos = 0, diaFechamento, diaVencimento, contaPagamentoId = null }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio.');
  if (!nome?.trim()) throw new Error('Nome do cartao obrigatorio.');
  if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) throw new Error('dia_fechamento deve ser 1..31.');
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) throw new Error('dia_vencimento deve ser 1..31.');
  db.run(`INSERT INTO cartoes (contexto_id, nome, instituicao, limite_centavos, dia_fechamento, dia_vencimento, conta_pagamento_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [contextoId, String(nome).trim(), String(instituicao), Number(limiteCentavos), diaFechamento, diaVencimento, contaPagamentoId]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

export function listarCartoes(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec(`SELECT * FROM cartoes WHERE contexto_id = ? AND ativo = 1 ORDER BY nome`, [contextoId])[0]?.values ?? [];
}

export function calcularCiclo(dataISO, diaFechamento) {
  // Retorna o ciclo YYYY-MM do fechamento dessa data
  const [y, m, d] = dataISO.split('-').map(Number);
  if (d >= diaFechamento) {
    const next = m === 12 ? 1 : m + 1;
    return `${y}-${MESES[next - 1]}`;
  }
  return `${y}-${MESES[m - 1]}`;
}

export function abrirFatura(db, { cartaoId, ciclo, dataFechamento, dataVencimento }) {
  if (!Number.isInteger(cartaoId)) throw new Error('Cartao obrigatorio.');
  if (!ciclo || !/^\d{4}-\d{2}$/.test(ciclo)) throw new Error('Ciclo deve ser YYYY-MM.');
  // Tenta achar; se nao existir, cria
  let f = db.exec('SELECT id FROM faturas WHERE cartao_id = ? AND ciclo = ?', [cartaoId, ciclo])[0]?.values?.[0]?.[0];
  if (f) return f;
  db.run(`INSERT INTO faturas (cartao_id, ciclo, data_fechamento, data_vencimento, valor_total_centavos, valor_pago_centavos, status) VALUES (?, ?, ?, ?, 0, 0, 'aberta')`,
    [cartaoId, ciclo, dataFechamento, dataVencimento]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

export function adicionarLancamentoNaFatura(db, faturaId, valorCentavos) {
  db.run('UPDATE faturas SET valor_total_centavos = valor_total_centavos + ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
    [Number(valorCentavos), faturaId]);
  return true;
}

export function pagarFatura(db, { faturaId, contaPagamentoId, valorCentavos, dataPagamento }, agora = new Date().toISOString()) {
  // O pagamento da fatura e' uma transferencia interna: nao gera despesa duplicada.
  // Cria um lancamento de saida na conta de pagamento.
  if (!Number.isInteger(faturaId)) throw new Error('Fatura obrigatoria.');
  if (!Number.isInteger(contaPagamentoId)) throw new Error('Conta de pagamento obrigatoria.');
  if (valorCentavos <= 0) throw new Error('Valor do pagamento deve ser positivo.');
  const fatura = db.exec('SELECT * FROM faturas WHERE id = ?', [faturaId])[0]?.values?.[0];
  if (!fatura) throw new Error('Fatura nao encontrada.');
  const cartao = db.exec('SELECT * FROM cartoes WHERE id = ?', [fatura[1]])[0]?.values?.[0];
  if (!cartao) throw new Error('Cartao nao encontrado.');
  // Verifica que a conta de pagamento pertence ao mesmo contexto
  const ctxConta = db.exec('SELECT contexto_id FROM contas WHERE id = ?', [contaPagamentoId])[0]?.values?.[0]?.[0];
  if (ctxConta !== cartao[1]) throw new Error('Conta de pagamento nao pertence ao contexto.');
  // Cria lancamento de saida na conta de pagamento
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, natureza, valor_centavos, data_competencia, descricao, status, criado_em) VALUES (?, ?, 'despesa', ?, ?, ?, 'conciliado', ?)`,
    [cartao[1], contaPagamentoId, valorCentavos, dataPagamento, `Pagamento fatura ${cartao[3]} ciclo ${fatura[2]}`, agora]);
  const idLanc = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  // Atualiza fatura
  const novoPago = Number(fatura[5]) + valorCentavos;
  const status = novoPago >= Number(fatura[4]) ? 'paga' : (novoPago > 0 ? 'fechada' : fatura[6]);
  db.run('UPDATE faturas SET valor_pago_centavos = ?, status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
    [novoPago, status, faturaId]);
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
    ['faturas', faturaId, 'pagamento', JSON.stringify({ contaPagamentoId, valorCentavos, lancamentoId: idLanc }), agora]);
  return { lancamentoId: idLanc, valorPago: novoPago, status };
}

export function listarFaturas(db, cartaoId) {
  if (!Number.isInteger(cartaoId)) return [];
  return db.exec('SELECT * FROM faturas WHERE cartao_id = ? ORDER BY ciclo DESC', [cartaoId])[0]?.values ?? [];
}
