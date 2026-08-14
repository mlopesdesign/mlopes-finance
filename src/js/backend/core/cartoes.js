// MLopes Finance — cartoes de credito e faturas
// Cadastro, fatura por ciclo, parcelas, pagamento (sem dupla despesa).

import { criarConta } from './financeiro.js';

const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/**
 * v0.9.0: Cria cartao E sua conta associada (tipo 'cartao') automaticamente.
 * Retorna { cartaoId, contaId }.
 * A conta associada e' o que aparece no select de "Conta" do formulario de
 * lancamentos — facilita o user (ele so cadastra o cartao, nao precisa criar
 * conta separada).
 */
export function criarCartao(db, { contextoId, nome, instituicao = '', limiteCentavos = 0, diaFechamento, diaVencimento, contaPagamentoId = null }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio.');
  if (!nome?.trim()) throw new Error('Nome do cartao obrigatorio.');
  if (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31) throw new Error('dia_fechamento deve ser 1..31.');
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) throw new Error('dia_vencimento deve ser 1..31.');
  db.run('BEGIN');
  try {
    // 1. Cria a conta tipo 'cartao' associada
    const contaId = criarConta(db, { contextoId, nome: String(nome).trim(), tipo: 'cartao', saldoInicialCentavos: 0 });
    // 2. Cria o cartao
    db.run(`INSERT INTO cartoes (contexto_id, nome, instituicao, limite_centavos, dia_fechamento, dia_vencimento, conta_pagamento_id, conta_associada_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [contextoId, String(nome).trim(), String(instituicao), Number(limiteCentavos), diaFechamento, diaVencimento, contaPagamentoId, contaId]);
    const cartaoId = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    db.run('COMMIT');
    return { cartaoId, contaId };
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
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
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, natureza, valor_centavos, data_competencia, descricao, status, fatura_id, criado_em) VALUES (?, ?, 'despesa', ?, ?, ?, 'conciliado', ?, ?)`,
    [cartao[1], contaPagamentoId, valorCentavos, dataPagamento, `Pagamento fatura ${cartao[3]} ciclo ${fatura[2]}`, faturaId, agora]);
  const idLanc = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  // Atualiza fatura. Schema faturas: 0:id, 1:cartao_id, 2:ciclo, 3:data_fechamento,
  // 4:data_vencimento, 5:valor_total_centavos, 6:valor_pago_centavos, 7:status
  const novoPago = Number(fatura[6]) + valorCentavos;
  const status = novoPago >= Number(fatura[5]) ? 'paga' : (novoPago > 0 ? 'fechada' : fatura[7]);
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

/**
 * v0.9.0: Atualiza os dados cadastrais de um cartao.
 * Nao mexe em faturas/lancamentos vinculados.
 */
export function atualizarCartao(db, id, { nome, instituicao, limiteCentavos, diaFechamento, diaVencimento, contaPagamentoId }) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id FROM cartoes WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Cartao nao encontrado.');
  if (nome != null && !String(nome).trim()) throw new Error('Nome do cartao nao pode ser vazio.');
  if (diaFechamento != null && (!Number.isInteger(diaFechamento) || diaFechamento < 1 || diaFechamento > 31)) throw new Error('dia_fechamento deve ser 1..31.');
  if (diaVencimento != null && (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31)) throw new Error('dia_vencimento deve ser 1..31.');
  const sets = [];
  const vals = [];
  if (nome != null) { sets.push('nome = ?'); vals.push(String(nome).trim()); }
  if (instituicao != null) { sets.push('instituicao = ?'); vals.push(String(instituicao)); }
  if (limiteCentavos != null) { sets.push('limite_centavos = ?'); vals.push(Number(limiteCentavos)); }
  if (diaFechamento != null) { sets.push('dia_fechamento = ?'); vals.push(diaFechamento); }
  if (diaVencimento != null) { sets.push('dia_vencimento = ?'); vals.push(diaVencimento); }
  if (contaPagamentoId !== undefined) { sets.push('conta_pagamento_id = ?'); vals.push(contaPagamentoId); }
  if (!sets.length) return false;
  sets.push('atualizado_em = CURRENT_TIMESTAMP');
  vals.push(id);
  db.run(`UPDATE cartoes SET ${sets.join(', ')} WHERE id = ?`, vals);
  return true;
}

/**
 * v0.9.0: Exclui um cartao.
 * - Padrao: BLOQUEIA se tem faturas com lancamentos vinculados (regra do PADRAO).
 * - cascade:true: apaga o cartao + TODAS as faturas + desvincula lancamentos (lancamento.fatura_id=NULL,
 *   lancamento.cartao_id=NULL). O lancamento permanece, so perde o vinculo com a fatura/cartao.
 * - SEMPRE: desativa (soft delete, ativo=0) a conta associada, pra preservar o
 *   historico de lancamentos que existiam nela. A conta some dos selects de
 *   "Conta" para novos lancamentos, mas o historico fica intacto.
 * v0.9.0: sql.js nao enforce FK ON DELETE SET NULL, entao a gente faz o UPDATE manual
 * antes do DELETE da fatura pra nao deixar orfaos.
 */
export function excluirCartao(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const cartao = db.exec('SELECT id, nome, conta_associada_id FROM cartoes WHERE id = ?', [id])[0]?.values?.[0];
  if (!cartao) throw new Error('Cartao nao encontrado.');
  const vincs = db.exec('SELECT COUNT(*) FROM faturas WHERE cartao_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0;
  if (vincs > 0 && !cascade) {
    return {
      ok: false,
      bloqueadoPor: 'faturas',
      mensagem: `${vincs} fatura(s) vinculada(s). Exclua as faturas antes (ou use cascade pra apagar tudo).`,
    };
  }
  db.run('BEGIN');
  try {
    if (cascade) {
      // 1. Desvincular lancamentos das faturas e do cartao (SET NULL manual pq sql.js
      //    nao enforce FK ON DELETE SET NULL)
      db.run('UPDATE lancamentos SET fatura_id = NULL WHERE fatura_id IN (SELECT id FROM faturas WHERE cartao_id = ?)', [id]);
      db.run('UPDATE lancamentos SET cartao_id = NULL WHERE cartao_id = ?', [id]);
      // 2. Apagar faturas
      db.run('DELETE FROM faturas WHERE cartao_id = ?', [id]);
    } else {
      // Sem cascade: garante que nao ha vinculo (defensivo)
      const lancsFatura = db.exec('SELECT COUNT(*) FROM lancamentos WHERE fatura_id IN (SELECT id FROM faturas WHERE cartao_id = ?)', [id])[0]?.values?.[0]?.[0] ?? 0;
      if (lancsFatura > 0) {
        db.run('ROLLBACK');
        return { ok: false, bloqueadoPor: 'lancamentos', mensagem: `${lancsFatura} lancamento(s) em faturas deste cartao. Exclua os lancamentos ou use cascade.` };
      }
      // Remove faturas vazias (sem lancamentos) para que o cartao possa ser excluido
      db.run('DELETE FROM faturas WHERE cartao_id = ?', [id]);
    }
    // 3. Apagar cartao
    db.run('DELETE FROM cartoes WHERE id = ?', [id]);
    // 4. Desativar a conta associada (soft delete — preserva historico)
    if (cartao[2] != null) {
      db.run('UPDATE contas SET ativo = 0 WHERE id = ?', [cartao[2]]);
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, faturasRemovidas: vincs, cascade, contaDesativada: cartao[2] };
}

/**
 * v0.9.0: Lista faturas com info agregada (valor dos lancamentos vinculados, qtd).
 * Colunas: id, cartao_id, ciclo, data_fechamento, data_vencimento, valor_total_centavos,
 *          valor_pago_centavos, status, qtd_lancamentos, soma_lancamentos_centavos
 * (qtd/soma vem de lancamentos.fatura_id = fatura.id).
 */
export function listarFaturasDetalhadas(db, cartaoId) {
  if (!Number.isInteger(cartaoId)) return [];
  return db.exec(`
    SELECT f.*,
           (SELECT COUNT(*) FROM lancamentos l WHERE l.fatura_id = f.id) AS qtd_lancamentos,
           (SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l WHERE l.fatura_id = f.id) AS soma_lancamentos_centavos
    FROM faturas f
    WHERE f.cartao_id = ?
    ORDER BY f.ciclo DESC
  `, [cartaoId])[0]?.values ?? [];
}

/**
 * v0.9.0: Lista os lancamentos de uma fatura especifica.
 * JOIN com categoria pra mostrar o nome.
 */
export function listarLancamentosDaFatura(db, faturaId) {
  if (!Number.isInteger(faturaId)) return [];
  return db.exec(`
    SELECT l.id, l.contexto_id, l.conta_id, l.categoria_id, l.natureza, l.valor_centavos,
           l.data_competencia, l.data_vencimento, l.descricao, l.observacoes, l.status,
           l.criado_em, COALESCE(ca.nome, '') AS categoria_nome, COALESCE(c.nome, '') AS conta_nome
    FROM lancamentos l
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    LEFT JOIN contas c ON c.id = l.conta_id
    WHERE l.fatura_id = ?
    ORDER BY l.data_competencia, l.id
  `, [faturaId])[0]?.values ?? [];
}

/**
 * v0.9.0: Calcula o ciclo (YYYY-MM) e as datas de fechamento/vencimento de uma fatura
 * para uma data de compra. Usado pelo criarLancamento quando a conta for tipo 'cartao'
 * e o user nao informar a fatura explicitamente.
 *
 * Regras:
 * - Se data_compra.dia >= dia_fechamento: ciclo e' o MES SEGUINTE (a compra cai na
 *   proxima fatura).
 * - Caso contrario: ciclo e' o MES ATUAL.
 * - data_fechamento: dia_fechamento do mes do ciclo (ou do mes anterior se a compra
 *   foi depois do fechamento).
 * - data_vencimento: dia_vencimento do mes seguinte ao ciclo.
 */
export function calcularCicloDaCompra(db, { cartaoId, dataCompra }) {
  if (!Number.isInteger(cartaoId)) throw new Error('cartaoId obrigatorio.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) throw new Error('dataCompra deve ser YYYY-MM-DD.');
  const cartao = db.exec('SELECT dia_fechamento, dia_vencimento FROM cartoes WHERE id = ?', [cartaoId])[0]?.values?.[0];
  if (!cartao) throw new Error('Cartao nao encontrado.');
  const [y, m, d] = dataCompra.split('-').map(Number);
  const diaFech = Number(cartao[0]);
  const diaVenc = Number(cartao[1]);
  // Calcula ciclo (YYYY-MM)
  let cicloY = y, cicloM = m;
  if (d >= diaFech) {
    cicloM = m + 1;
    if (cicloM > 12) { cicloM = 1; cicloY = y + 1; }
  }
  const ciclo = `${cicloY}-${String(cicloM).padStart(2, '0')}`;
  // data_fechamento: dia_fechamento do mes do ciclo
  const dataFechamento = `${cicloY}-${String(cicloM).padStart(2, '0')}-${String(diaFech).padStart(2, '0')}`;
  // data_vencimento: dia_vencimento do mes seguinte ao ciclo
  let vencY = cicloY, vencM = cicloM + 1;
  if (vencM > 12) { vencM = 1; vencY = cicloY + 1; }
  const dataVencimento = `${vencY}-${String(vencM).padStart(2, '0')}-${String(diaVenc).padStart(2, '0')}`;
  return { ciclo, dataFechamento, dataVencimento };
}

/**
 * v0.9.0 (dashboard): retorna a fatura ATUAL de um cartao (ciclo = mes corrente ou
 * proximo ciclo aberto), com total, pago, restante e status. Se nao tem fatura
 * aberta no ciclo atual, retorna null (UI mostra "Sem fatura este mes").
 *
 * Regra do "ciclo atual": o ciclo cujo mes >= mes corrente. Pega a fatura com
 * status='aberta' (ou 'fechada') mais proxima. Se nao tem nenhuma aberta,
 * retorna a proxima fatura (mes seguinte).
 */
export function faturaAtualDoCartao(db, cartaoId) {
  if (!Number.isInteger(cartaoId)) return null;
  const cartao = db.exec('SELECT id, nome, limite_centavos FROM cartoes WHERE id = ?', [cartaoId])[0]?.values?.[0];
  if (!cartao) return null;
  // Pega a fatura aberta (ou fechada) mais recente, e se nao tem, a proxima
  const hoje = new Date();
  const cicloAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  // Tenta fatura do mes atual
  let fatura = db.exec(
    `SELECT id, ciclo, data_fechamento, data_vencimento, valor_total_centavos, valor_pago_centavos, status
     FROM faturas WHERE cartao_id = ? AND ciclo >= ? AND status IN ('aberta','fechada','vencida')
     ORDER BY ciclo ASC LIMIT 1`,
    [cartaoId, cicloAtual]
  )[0]?.values?.[0];
  // Se nao tem, pega a ultima fechada/paga (para mostrar historico)
  if (!fatura) {
    fatura = db.exec(
      `SELECT id, ciclo, data_fechamento, data_vencimento, valor_total_centavos, valor_pago_centavos, status
       FROM faturas WHERE cartao_id = ?
       ORDER BY ciclo DESC LIMIT 1`,
      [cartaoId]
    )[0]?.values?.[0];
  }
  if (!fatura) return { cartaoId, nome: String(cartao[1]), limiteCentavos: Number(cartao[2]), fatura: null };
  const [fId, ciclo, dataF, dataV, total, pago, status] = fatura;
  return {
    cartaoId,
    nome: String(cartao[1]),
    limiteCentavos: Number(cartao[2]),
    fatura: {
      id: Number(fId),
      ciclo: String(ciclo),
      dataFechamento: String(dataF),
      dataVencimento: String(dataV),
      totalCentavos: Number(total),
      pagoCentavos: Number(pago),
      restanteCentavos: Math.max(0, Number(total) - Number(pago)),
      status: String(status),
    },
  };
}
