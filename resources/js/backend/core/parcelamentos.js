// MLopes Finance — Parcelamentos (v0.11.0)
// Compra em Nx (ex: iPhone 12x R$ 250) gera N parcelas automaticas, cada uma
// vinculada a uma fatura especifica do cartao (calculada pelo dia_vencimento
// e ciclo do cartao). O sistema gera os lancamentos (natureza='despesa') e
// vincula cada parcela a fatura do mes.
//
// v0.11.0: calendario COMPLETO de parcelas (range DINAMICO do mes atual ate o
// mes da ULTIMA parcela, nao fixo em 12) + visao individual detalhada de
// um parcelamento (datas inicio/fim/quitação, total pago, etc) + 3 grupos
// na UI (ativos, pausados, quitados) com drill-down completo.
//
// Projecao: retorna as proximas N meses com o que vai vencer (parcelas + faturas
// em aberto + custos fixos), ate a ultima parcela.
//
// Regra de centavos: valorTotal / numParcelas pode dar dízima. A primeira
// parcela recebe o resto (1 centavo a mais) e as outras sao exatas. Garante
// que a soma das parcelas == valorTotal.

import { criarLancamento } from './lancamentos.js';
import { calcularCicloDaCompra, abrirFatura } from './cartoes.js';

function adicionarMeses(dataISO, meses) {
  const [y, m, d] = dataISO.split('-').map(Number);
  const ny = y + Math.floor((m - 1 + meses) / 12);
  const nm = ((m - 1 + meses) % 12) + 1;
  const ultimo = new Date(ny, nm, 0).getDate();
  const nd = Math.min(d, ultimo);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

/**
 * Cria um parcelamento. Materializa as N parcelas como lancamentos na hora
 * (assim ja aparecem no extrato do cartao e na fatura do mes). Cada parcela
 * eh vinculada a fatura do ciclo correto via calcularCicloDaCompra + abrirFatura.
 *
 * Retorna { id, totalParcelas, totalCentavos, valorParcelaPadraoCentavos,
 *          primeiraParcelaCentavos }.
 */
export function criarParcelamento(db, {
  contextoId, descricao, valorTotalCentavos, numParcelas,
  cartaoId = null, categoriaId = null, contaPagamentoId = null,
  diaVencimento = 10, dataPrimeiraParcela, observacoes = '',
  agora = new Date().toISOString(),
}) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!descricao?.trim()) throw new Error('Descricao obrigatoria.');
  if (!Number.isInteger(valorTotalCentavos) || valorTotalCentavos <= 0) throw new Error('valorTotalCentavos deve ser > 0.');
  if (!Number.isInteger(numParcelas) || numParcelas < 2) throw new Error('numParcelas deve ser >= 2.');
  if (!Number.isInteger(diaVencimento) || diaVencimento < 1 || diaVencimento > 31) throw new Error('diaVencimento 1..31.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataPrimeiraParcela || '')) throw new Error('dataPrimeiraParcela YYYY-MM-DD.');
  if (cartaoId != null && !Number.isInteger(cartaoId)) throw new Error('cartaoId invalido.');

  // Calcula valor de cada parcela (com ajuste de 1 centavo na primeira)
  const valorBase = Math.floor(valorTotalCentavos / numParcelas);
  const resto = valorTotalCentavos - valorBase * numParcelas;

  db.run('BEGIN');
  try {
    // 1. Cria o parcelamento
    db.run(
      `INSERT INTO parcelamentos (contexto_id, descricao, valor_total_centavos, num_parcelas, cartao_id, categoria_id, conta_pagamento_id, dia_vencimento, data_primeira_parcela, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [contextoId, String(descricao).trim(), valorTotalCentavos, numParcelas, cartaoId, categoriaId, contaPagamentoId, diaVencimento, dataPrimeiraParcela, String(observacoes)]
    );
    const parcelamentoId = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);

    // 2. Cria as N parcelas
    const valores = [];
    for (let i = 0; i < numParcelas; i++) {
      const dataVenc = adicionarMeses(dataPrimeiraParcela, i);
      const valor = valorBase + (i === 0 ? resto : 0);
      valores.push({ dataVenc, valor, numero: i + 1 });
      db.run(
        `INSERT INTO parcelas (parcelamento_id, numero, data_vencimento, valor_centavos, status) VALUES (?, ?, ?, ?, 'pendente')`,
        [parcelamentoId, i + 1, dataVenc, valor]
      );
    }

    // 3. Se cartaoId foi passado, gera 1 lancamento por parcela (na fatura do mes)
    if (cartaoId != null) {
      const cartao = db.exec('SELECT conta_associada_id FROM cartoes WHERE id = ?', [cartaoId])[0]?.values?.[0];
      if (!cartao) throw new Error('Cartao nao encontrado.');
      const contaId = Number(cartao[0]);
      const tipoConta = db.exec('SELECT tipo FROM contas WHERE id = ?', [contaId])[0]?.values?.[0]?.[0];
      if (tipoConta !== 'cartao') throw new Error('Conta associada ao cartao nao e tipo "cartao".');

      for (let i = 0; i < valores.length; i++) {
        const p = valores[i];
        const { ciclo, dataFechamento, dataVencimento } = calcularCicloDaCompra(db, { cartaoId, dataCompra: p.dataVenc });
        const faturaId = abrirFatura(db, { cartaoId, ciclo, dataFechamento, dataVencimento });
        const idLanc = criarLancamento(db, {
          contextoId,
          contaId,
          cartaoId,
          faturaId,
          categoriaId: categoriaId || null,
          natureza: 'despesa',
          valorCentavos: p.valor,
          dataCompetencia: p.dataVenc,
          descricao: `${String(descricao).trim()} (parcela ${p.numero}/${numParcelas})`,
          observacoes: `Parcela ${p.numero}/${numParcelas} do parcelamento #${parcelamentoId}.`,
        }, agora);
        db.run('UPDATE parcelas SET lancamento_id = ?, fatura_id = ? WHERE parcelamento_id = ? AND numero = ?',
          [idLanc, faturaId, parcelamentoId, p.numero]);
        // Recalcula o total da fatura
        db.run("UPDATE faturas SET valor_total_centavos = (SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos WHERE fatura_id = ? AND status != 'estornado') WHERE id = ?", [faturaId, faturaId]);
      }
    }

    db.run('COMMIT');
    return {
      id: parcelamentoId,
      totalParcelas: numParcelas,
      totalCentavos: valorTotalCentavos,
      valorParcelaPadraoCentavos: valorBase,
      primeiraParcelaCentavos: valorBase + resto,
    };
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

/**
 * Lista parcelamentos do contexto com info consolidada.
 * Retorna: [{ id, descricao, valorTotal, numParcelas, parcelasPagas, valorPago, proximaParcela, ativo, cartaoNome, categoriaNome }]
 */
export function listarParcelamentos(db, contextoId, { incluirInativos = false } = {}) {
  if (!Number.isInteger(contextoId)) return [];
  const condAtivo = incluirInativos ? '' : 'AND pa.ativo = 1';
  const rows = db.exec(`
    SELECT pa.id, pa.descricao, pa.valor_total_centavos, pa.num_parcelas, pa.ativo,
           pa.dia_vencimento, pa.data_primeira_parcela, pa.observacoes,
           COALESCE(ca.nome, '') AS cartao_nome, pa.cartao_id,
           COALESCE(cat.nome, '') AS categoria_nome, pa.categoria_id
    FROM parcelamentos pa
    LEFT JOIN cartoes ca ON ca.id = pa.cartao_id
    LEFT JOIN categorias cat ON cat.id = pa.categoria_id
    WHERE pa.contexto_id = ? ${condAtivo}
    ORDER BY pa.ativo DESC, pa.criado_em DESC
  `, [contextoId])[0]?.values ?? [];

  return rows.map(([id, desc, total, num, ativo, dia, dataPrimeira, obs, cartaoNome, cartaoId, catNome, catId]) => {
    const stats = db.exec(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'paga' THEN 1 ELSE 0 END) AS pagas,
              SUM(CASE WHEN status = 'paga' THEN valor_centavos ELSE 0 END) AS pago,
              MIN(CASE WHEN status = 'pendente' THEN data_vencimento ELSE NULL END) AS proxVenc
       FROM parcelas WHERE parcelamento_id = ?`,
      [id]
    )[0]?.values?.[0] ?? [0, 0, 0, null];
    return {
      id: Number(id),
      descricao: String(desc),
      valorTotalCentavos: Number(total),
      numParcelas: Number(num),
      ativo: Number(ativo) === 1,
      diaVencimento: Number(dia),
      dataPrimeiraParcela: String(dataPrimeira),
      observacoes: String(obs),
      cartaoId: cartaoId != null ? Number(cartaoId) : null,
      cartaoNome: String(cartaoNome) || '(sem cartao)',
      categoriaId: catId != null ? Number(catId) : null,
      categoriaNome: String(catNome) || '',
      parcelasPagas: Number(stats[1] || 0),
      parcelasPendentes: Number(stats[0] || 0) - Number(stats[1] || 0),
      valorPagoCentavos: Number(stats[2] || 0),
      proximaParcela: stats[3] ? String(stats[3]) : null,
    };
  });
}

/**
 * Lista as parcelas individuais de um parcelamento (drill-down).
 * Retorna rows: [id, numero, dataVencimento, valorCentavos, status, lancamentoId, faturaId, pagaEm]
 */
export function listarParcelas(db, parcelamentoId) {
  if (!Number.isInteger(parcelamentoId)) return [];
  return db.exec(`
    SELECT id, numero, data_vencimento, valor_centavos, status, lancamento_id, fatura_id, paga_em
    FROM parcelas WHERE parcelamento_id = ? ORDER BY numero
  `, [parcelamentoId])[0]?.values ?? [];
}

/**
 * Marca uma parcela como paga. Se ja tem lancamento vinculado, marca como
 * conciliado e recalcula valor_pago da fatura. Se nao tem lancamento (parcelamento
 * criado sem cartaoId), cria um lancamento agora na conta_pagamentoId.
 */
export function pagarParcela(db, parcelaId, dataPagamento = null, agora = new Date().toISOString()) {
  if (!Number.isInteger(parcelaId)) throw new Error('parcelaId obrigatorio.');
  const p = db.exec(`
    SELECT pc.id, pc.parcelamento_id, pc.numero, pc.data_vencimento, pc.valor_centavos,
           pc.status, pc.lancamento_id, pc.fatura_id,
           pa.contexto_id, pa.cartao_id, pa.categoria_id, pa.conta_pagamento_id, pa.descricao
    FROM parcelas pc JOIN parcelamentos pa ON pa.id = pc.parcelamento_id
    WHERE pc.id = ?
  `, [parcelaId])[0]?.values?.[0];
  if (!p) throw new Error('Parcela nao encontrada.');
  const [id, parcelamentoId, numero, dataVenc, valor, status, lancId, fatId,
         contextoId, cartaoId, categoriaId, contaPagId, descParcelamento] = p;
  if (status === 'paga') throw new Error('Parcela ja foi paga.');
  const dataPg = dataPagamento || dataVenc;

  db.run('BEGIN');
  try {
    if (lancId != null) {
      db.run("UPDATE lancamentos SET status = 'conciliado' WHERE id = ?", [lancId]);
      if (fatId != null) {
        const pagoAtual = Number(db.exec('SELECT valor_pago_centavos FROM faturas WHERE id = ?', [fatId])[0]?.values?.[0]?.[0] ?? 0);
        const novoPago = pagoAtual + Number(valor);
        const totalFat = Number(db.exec('SELECT valor_total_centavos FROM faturas WHERE id = ?', [fatId])[0]?.values?.[0]?.[0] ?? 0);
        const novoStatus = novoPago >= totalFat ? 'paga' : (novoPago > 0 ? 'fechada' : 'aberta');
        db.run('UPDATE faturas SET valor_pago_centavos = ?, status = ? WHERE id = ?', [novoPago, novoStatus, fatId]);
      }
    } else {
      if (contaPagId == null) throw new Error('Parcela sem lancamento e sem conta de pagamento. Exclua e recrie o parcelamento com cartao OU conta de pagamento.');
      const idLanc = criarLancamento(db, {
        contextoId,
        contaId: Number(contaPagId),
        categoriaId: categoriaId != null ? Number(categoriaId) : null,
        natureza: 'despesa',
        valorCentavos: Number(valor),
        dataCompetencia: dataPg,
        descricao: `${String(descParcelamento)} (parcela ${numero})`,
        observacoes: `Parcela ${numero} do parcelamento #${parcelamentoId}.`,
      }, agora);
      db.run("UPDATE lancamentos SET status = 'conciliado' WHERE id = ?", [idLanc]);
      db.run('UPDATE parcelas SET lancamento_id = ? WHERE id = ?', [idLanc, id]);
    }
    db.run("UPDATE parcelas SET status = 'paga', paga_em = ? WHERE id = ?", [dataPg, id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, parcelaId: id, dataPaga: dataPg };
}

/**
 * Exclui um parcelamento. cascade=true apaga tambem as parcelas e desvincula os
 * lancamentos. Sem cascade: BLOQUEIA se tem parcelas pagas.
 */
export function excluirParcelamento(db, parcelamentoId, { cascade = false } = {}) {
  if (!Number.isInteger(parcelamentoId)) throw new Error('parcelamentoId obrigatorio.');
  const p = db.exec('SELECT id, descricao FROM parcelamentos WHERE id = ?', [parcelamentoId])[0]?.values?.[0];
  if (!p) throw new Error('Parcelamento nao encontrado.');
  const pagas = Number(db.exec("SELECT COUNT(*) FROM parcelas WHERE parcelamento_id = ? AND status = 'paga'", [parcelamentoId])[0]?.values?.[0]?.[0] ?? 0);
  if (pagas > 0 && !cascade) {
    return {
      ok: false,
      bloqueadoPor: 'parcelasPagas',
      mensagem: `${pagas} parcela(s) ja paga(s). Exclua com cascade se quiser apagar tudo.`,
    };
  }
  db.run('BEGIN');
  try {
    // Desvincula os lancamentos das parcelas (sql.js nao enforce ON DELETE SET NULL)
    db.run(`UPDATE lancamentos SET fatura_id = NULL, cartao_id = NULL
            WHERE id IN (
              SELECT p.lancamento_id FROM parcelas p
              WHERE p.parcelamento_id = ? AND p.lancamento_id IS NOT NULL
            )`, [parcelamentoId]);
    // Apaga parcelamento (cascade em parcelas via FK ON DELETE CASCADE)
    db.run('DELETE FROM parcelamentos WHERE id = ?', [parcelamentoId]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, parcelamentoId, cascade };
}

/**
 * Projecao mensal: para cada mes dos proximos N meses, retorna o que vai
 * vencer em parcelas (cartao de credito). Nao inclui faturas de compras
 * avulsas nem custos fixos (esses ficam em outras funcoes).
 *
 * Retorna: [{ mes: 'YYYY-MM', parcelas: [{parcelamentoId, descricao, parcelaNumero, totalParcelas, valorCentavos, dataVencimento}], totalCentavos }]
 */
export function projecaoParcelasPorMes(db, contextoId, mesesFuturos = 12, aPartirDe = null) {
  if (!Number.isInteger(contextoId)) return [];
  const hoje = new Date();
  const inicio = aPartirDe || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const fimDate = new Date(hoje.getFullYear(), hoje.getMonth() + mesesFuturos, 0);
  const fim = fimDate.toISOString().slice(0, 10);
  const rows = db.exec(`
    SELECT pc.id, pc.parcelamento_id, pc.numero, pc.data_vencimento, pc.valor_centavos, pc.status,
           pa.descricao, pa.num_parcelas
    FROM parcelas pc JOIN parcelamentos pa ON pa.id = pc.parcelamento_id
    WHERE pa.contexto_id = ? AND pa.ativo = 1
      AND pc.data_vencimento BETWEEN ? AND ?
    ORDER BY pc.data_vencimento, pc.numero
  `, [contextoId, inicio, fim])[0]?.values ?? [];

  const porMes = new Map();
  for (const [id, parcelamentoId, numero, dataVenc, valor, status, desc, total] of rows) {
    const mes = String(dataVenc).slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push({
      parcelaId: Number(id),
      parcelamentoId: Number(parcelamentoId),
      parcelaNumero: Number(numero),
      totalParcelas: Number(total),
      descricao: String(desc),
      valorCentavos: Number(valor),
      dataVencimento: String(dataVenc),
      status: String(status),
    });
  }

  const resultado = [];
  for (let i = 0; i < mesesFuturos; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const parcelas = porMes.get(mes) || [];
    const total = parcelas.reduce((s, p) => s + p.valorCentavos, 0);
    resultado.push({ mes, parcelas, totalCentavos: total });
  }
  return resultado;
}

/**
 * Resumo consolidado dos proximos N meses: parcelas + faturas em aberto + custos fixos.
 * O user ve num lugar so: "esse mes voce tem R$ X a vencer, sendo R$ Y de parcelas + R$ Z de faturas + R$ W de custos fixos".
 *
 * Retorna: [{ mes, parcelas: {...}, faturas: {...}, custosFixos: {...}, totalCentavos }]
 */
export function resumoCompletoPorMes(db, contextoId, mesesFuturos = 12) {
  if (!Number.isInteger(contextoId)) return [];
  // 1. Parcelas
  const parcelas = projecaoParcelasPorMes(db, contextoId, mesesFuturos);
  // 2. Faturas em aberto
  const hoje = new Date();
  const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const fimDate = new Date(hoje.getFullYear(), hoje.getMonth() + mesesFuturos, 0);
  const fim = fimDate.toISOString().slice(0, 10);
  const fatRows = db.exec(`
    SELECT f.ciclo, f.data_vencimento, f.valor_total_centavos, f.valor_pago_centavos, ca.nome
    FROM faturas f JOIN cartoes ca ON ca.id = f.cartao_id
    WHERE ca.contexto_id = ? AND f.data_vencimento BETWEEN ? AND ? AND f.status IN ('aberta','fechada')
    ORDER BY f.data_vencimento
  `, [contextoId, inicio, fim])[0]?.values ?? [];
  const faturasPorMes = new Map();
  for (const [ciclo, dataVenc, total, pago, cartaoNome] of fatRows) {
    const mes = String(dataVenc).slice(0, 7);
    if (!faturasPorMes.has(mes)) faturasPorMes.set(mes, []);
    faturasPorMes.get(mes).push({
      ciclo: String(ciclo),
      dataVencimento: String(dataVenc),
      cartao: String(cartaoNome),
      restanteCentavos: Number(total) - Number(pago),
      totalCentavos: Number(total),
      pagoCentavos: Number(pago),
    });
  }
  // 3. Custos fixos ativos
  const cfRows = db.exec(`
    SELECT l.id, l.descricao, l.valor_centavos, l.data_competencia
    FROM lancamentos l
    JOIN recorrencias r ON r.lancamento_template_id = l.id
    WHERE r.contexto_id = ? AND r.ativa = 1 AND r.periodicidade = 'mensal' AND l.descricao LIKE '%[custo fixo]%'
  `, [contextoId])[0]?.values ?? [];
  const totalCustosFixosMes = cfRows.reduce((s, c) => s + Number(c[2]), 0);

  // 4. Junta tudo por mes
  const resultado = [];
  for (let i = 0; i < mesesFuturos; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const ps = parcelas.find(p => p.mes === mes) || { parcelas: [], totalCentavos: 0 };
    const fs = faturasPorMes.get(mes) || [];
    const totalFaturas = fs.reduce((s, f) => s + f.restanteCentavos, 0);
    const total = ps.totalCentavos + totalFaturas + totalCustosFixosMes;
    resultado.push({
      mes,
      parcelas: { itens: ps.parcelas, totalCentavos: ps.totalCentavos },
      faturas: { itens: fs, totalCentavos: totalFaturas },
      custosFixos: { totalCentavos: totalCustosFixosMes },
      totalCentavos: total,
    });
  }
  return resultado;
}

/**
 * v0.11.0: Calendario COMPLETO de parcelas (ativas E quitadas) agrupadas por mes.
 * Range: do mes atual ate o mes da ULTIMA parcela (de TODOS os parcelamentos do
 * contexto, inclusive quitados). Se nenhuma parcela existir, cai pro minimo de
 * mesesMinimos meses a partir de hoje.
 *
 * Retorna: [{ mes: 'YYYY-MM', parcelas: [{parcelamentoId, descricao, parcelaNumero,
 *   totalParcelas, valorCentavos, dataVencimento, status, pagaEm, parcelamentoAtivo,
 *   cartaoNome}], totalCentavos, totalPagasCentavos, totalPendentesCentavos, qtdParcelas }]
 */
export function calendarioCompletoParcelas(db, contextoId, mesesMinimos = 6) {
  if (!Number.isInteger(contextoId)) return [];
  // Descobre a ULTIMA data de vencimento de TODAS as parcelas (ativas e quitadas)
  const ultVenc = db.exec(`
    SELECT MAX(pc.data_vencimento) FROM parcelas pc
    JOIN parcelamentos pa ON pa.id = pc.parcelamento_id
    WHERE pa.contexto_id = ?
  `, [contextoId])[0]?.values?.[0]?.[0];
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  let fim;
  if (ultVenc) {
    const [y, m] = String(ultVenc).split('-').map(Number);
    fim = new Date(y, m - 1, 1);
  } else {
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + mesesMinimos - 1, 1);
  }
  // Garante pelo menos mesesMinimos meses a partir de hoje
  const minFim = new Date(hoje.getFullYear(), hoje.getMonth() + mesesMinimos - 1, 1);
  if (fim < minFim) fim = minFim;
  const inicioISO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-01`;
  const fimDate = new Date(fim.getFullYear(), fim.getMonth() + 1, 0);
  const fimISO = `${fimDate.getFullYear()}-${String(fimDate.getMonth() + 1).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`;
  const rows = db.exec(`
    SELECT pc.id, pc.parcelamento_id, pc.numero, pc.data_vencimento, pc.valor_centavos, pc.status,
           pc.paga_em, pa.descricao, pa.num_parcelas, pa.ativo, COALESCE(ca.nome, '') AS cartao_nome
    FROM parcelas pc
    JOIN parcelamentos pa ON pa.id = pc.parcelamento_id
    LEFT JOIN cartoes ca ON ca.id = pa.cartao_id
    WHERE pa.contexto_id = ? AND pc.data_vencimento BETWEEN ? AND ?
    ORDER BY pc.data_vencimento, pc.numero
  `, [contextoId, inicioISO, fimISO])[0]?.values ?? [];

  const porMes = new Map();
  for (const [pid, parcelamentoId, numero, dataVenc, valor, status, pagaEm, desc, total, ativo, cartaoNome] of rows) {
    const mes = String(dataVenc).slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes).push({
      parcelaId: Number(pid),
      parcelamentoId: Number(parcelamentoId),
      parcelaNumero: Number(numero),
      totalParcelas: Number(total),
      descricao: String(desc),
      valorCentavos: Number(valor),
      dataVencimento: String(dataVenc),
      status: String(status),
      pagaEm: pagaEm ? String(pagaEm) : null,
      parcelamentoAtivo: Number(ativo) === 1,
      cartaoNome: String(cartaoNome) || '(sem cartao)',
    });
  }

  const resultado = [];
  const totalMeses = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth()) + 1;
  for (let i = 0; i < totalMeses; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const itens = porMes.get(mes) || [];
    const total = itens.reduce((s, p) => s + p.valorCentavos, 0);
    const totalPagas = itens.filter(p => p.status === 'paga').reduce((s, p) => s + p.valorCentavos, 0);
    resultado.push({
      mes,
      parcelas: itens,
      totalCentavos: total,
      totalPagasCentavos: totalPagas,
      totalPendentesCentavos: total - totalPagas,
      qtdParcelas: itens.length,
    });
  }
  return resultado;
}

/**
 * v0.11.0: Visao INDIVIDUAL completa de UM parcelamento.
 * Retorna: dados cadastrais + TODAS as parcelas (com pagaEm) + resumo estatistico
 * (qtdPagas, qtdPendentes, totalPago, totalPendente, percentualPago,
 *  primeiroVencimento, ultimoVencimento, dataQuitacao, duracaoMeses).
 */
export function obterParcelamentoCompleto(db, parcelamentoId) {
  if (!Number.isInteger(parcelamentoId)) throw new Error('parcelamentoId obrigatorio.');
  const pa = db.exec(`
    SELECT pa.id, pa.descricao, pa.valor_total_centavos, pa.num_parcelas, pa.ativo,
           pa.dia_vencimento, pa.data_primeira_parcela, pa.observacoes, pa.criado_em,
           COALESCE(ca.nome, '') AS cartao_nome, pa.cartao_id,
           COALESCE(cat.nome, '') AS categoria_nome, pa.categoria_id,
           COALESCE(co.nome, '') AS conta_pagamento_nome, pa.conta_pagamento_id
    FROM parcelamentos pa
    LEFT JOIN cartoes ca ON ca.id = pa.cartao_id
    LEFT JOIN categorias cat ON cat.id = pa.categoria_id
    LEFT JOIN contas co ON co.id = pa.conta_pagamento_id
    WHERE pa.id = ?
  `, [parcelamentoId])[0]?.values?.[0];
  if (!pa) return null;
  const [id, desc, total, num, ativo, dia, dataPrim, obs, criadoEm, cartaoNome, cartaoId, catNome, catId, contaNome, contaId] = pa;

  const parcelasRows = db.exec(`
    SELECT pc.id, pc.numero, pc.data_vencimento, pc.valor_centavos, pc.status,
           pc.lancamento_id, pc.fatura_id, pc.paga_em
    FROM parcelas pc WHERE pc.parcelamento_id = ? ORDER BY pc.numero
  `, [parcelamentoId])[0]?.values ?? [];
  const parcelas = parcelasRows.map(([pid, numero, dataVenc, valor, status, lancId, fatId, pagaEm]) => ({
    id: Number(pid),
    numero: Number(numero),
    dataVencimento: String(dataVenc),
    valorCentavos: Number(valor),
    status: String(status),
    lancamentoId: lancId != null ? Number(lancId) : null,
    faturaId: fatId != null ? Number(fatId) : null,
    pagaEm: pagaEm ? String(pagaEm) : null,
  }));

  const qtdPagas = parcelas.filter(p => p.status === 'paga').length;
  const qtdPendentes = parcelas.length - qtdPagas;
  const totalPago = parcelas.filter(p => p.status === 'paga').reduce((s, p) => s + p.valorCentavos, 0);
  const datasVenc = parcelas.map(p => p.dataVencimento).sort();
  // dataQuitacao = data da ULTIMA parcela paga, SOMENTE se todas estao pagas
  const datasPagas = qtdPagas === parcelas.length && parcelas.length > 0
    ? parcelas.filter(p => p.pagaEm).map(p => p.pagaEm).sort()
    : [];

  return {
    id: Number(id),
    descricao: String(desc),
    valorTotalCentavos: Number(total),
    numParcelas: Number(num),
    ativo: Number(ativo) === 1,
    diaVencimento: Number(dia),
    dataPrimeiraParcela: String(dataPrim),
    observacoes: String(obs),
    criadoEm: String(criadoEm),
    cartaoId: cartaoId != null ? Number(cartaoId) : null,
    cartaoNome: String(cartaoNome) || '(sem cartao)',
    categoriaId: catId != null ? Number(catId) : null,
    categoriaNome: String(catNome) || '',
    contaPagamentoId: contaId != null ? Number(contaId) : null,
    contaPagamentoNome: String(contaNome) || '',
    parcelas,
    resumo: {
      qtdPagas,
      qtdPendentes,
      totalPagoCentavos: totalPago,
      totalPendenteCentavos: Number(total) - totalPago,
      percentualPago: Number(total) > 0 ? (totalPago / Number(total)) * 100 : 0,
      primeiroVencimento: datasVenc[0] || null,
      ultimoVencimento: datasVenc[datasVenc.length - 1] || null,
      dataQuitacao: datasPagas[datasPagas.length - 1] || null,
      duracaoMeses: (datasVenc[0] && datasVenc[datasVenc.length - 1])
        ? Math.max(1, Math.round((new Date(datasVenc[datasVenc.length - 1]) - new Date(datasVenc[0])) / (1000 * 60 * 60 * 24 * 30.44)) + 1)
        : 0,
    },
  };
}

/**
 * v0.11.1: Detecta parcelamentos a partir dos lancamentos ja importados do
 * cartao. Procura o padrao "Nome - Parcela N/M" na descricao (formato tipico
 * do Nubank) e agrupa por (nome base normalizado, total de parcelas).
 *
 * NAO cria nada — so retorna os candidatos pra o user confirmar.
 *
 * Retorna: [{ nomeBase, totalParcelas, valorTotalCentavos, parcelasDetectadas,
 *   completo (true se N/M == totalParcelas), itens: [{lancamentoId, numero, dataCompetencia, valorCentavos}] }]
 */
export function detectarParcelamentosDoExtrato(db, contextoId, cartaoId) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!Number.isInteger(cartaoId)) throw new Error('cartaoId obrigatorio.');
  // Pega todos os lancamentos do cartao (ja no DB) que tem "Parcela" na descricao
  const rows = db.exec(`
    SELECT id, data_competencia, valor_centavos, descricao
    FROM lancamentos
    WHERE contexto_id = ? AND cartao_id = ?
      AND descricao LIKE '%Parcela %'
    ORDER BY data_competencia
  `, [contextoId, cartaoId])[0]?.values ?? [];
  // Regex: "Nome - Parcela N/M" (case-insensitive, com ou sem espacos)
  // Aceita: "Amazon - Parcela 3/10", "IFOOD*IFOOD - Parcela  03/12", "Loja - parcela 1/3"
  const re = /^(.+?)\s*-\s*[Pp]arcela\s+(\d+)\s*\/\s*(\d+)\s*$/;
  // Agrupa por (nomeBase normalizado, totalParcelas)
  const grupos = new Map();
  for (const [id, dataComp, valor, desc] of rows) {
    const m = re.exec(String(desc).trim());
    if (!m) continue;
    const nomeBase = m[1].trim();
    const numero = Number(m[2]);
    const total = Number(m[3]);
    // Normaliza nome: tira espacos extras + lowercase pra agrupar variantes
    const chave = `${nomeBase.toLowerCase()}|${total}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        nomeBase,
        totalParcelas: total,
        itens: [],
      });
    }
    grupos.get(chave).itens.push({
      lancamentoId: Number(id),
      dataCompetencia: String(dataComp),
      valorCentavos: Number(valor),
      numero,
    });
  }
  // Monta os candidatos
  const candidatos = [];
  for (const g of grupos.values()) {
    g.itens.sort((a, b) => a.numero - b.numero);
    const valorTotal = g.itens.reduce((s, i) => s + i.valorCentavos, 0);
    candidatos.push({
      nomeBase: g.nomeBase,
      totalParcelas: g.totalParcelas,
      valorTotalCentavos: valorTotal,
      parcelasDetectadas: g.itens.length,
      completo: g.itens.length === g.totalParcelas,
      itens: g.itens,
    });
  }
  // Ordena: incompletos primeiro (mais urgentes de criar), depois completos, ordem alfabetica
  candidatos.sort((a, b) => {
    if (a.completo !== b.completo) return a.completo ? 1 : -1;
    return a.nomeBase.localeCompare(b.nomeBase);
  });
  return candidatos;
}

/**
 * v0.11.1: Cria os parcelamentos a partir dos candidatos selecionados.
 * Cada candidato vira 1 parcelamento com N parcelas (N = totalParcelas).
 * As parcelas existentes (ja no DB) sao vinculadas via `lancamento_id`.
 * Parcelas faltantes sao criadas com status='pendente' e dataVencimento
 * inferida pelo padrao mensal (data da 1a parcela + k meses).
 *
 * Se ja existe um parcelamento com a mesma descricao, IGNORA (nao duplica).
 *
 * `cartaoId` e `contextoId` precisam bater com os lancamentos detectados.
 *
 * Retorna: [{ parcelamentoId, descricao, parcelasCriadas, parcelasVinculadas, jaExistia }]
 */
export function criarParcelamentosDetectados(db, contextoId, cartaoId, candidatos) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!Number.isInteger(cartaoId)) throw new Error('cartaoId obrigatorio.');
  if (!Array.isArray(candidatos) || candidatos.length === 0) return [];
  const resultados = [];
  for (const c of candidatos) {
    if (!c || !c.nomeBase || !c.totalParcelas || !Array.isArray(c.itens) || c.itens.length === 0) {
      resultados.push({ ok: false, erro: 'candidato invalido', candidato: c });
      continue;
    }
    // Verifica se ja existe parcelamento com mesmo nome (case-insensitive)
    const jaExiste = db.exec(
      `SELECT id FROM parcelamentos WHERE contexto_id = ? AND LOWER(descricao) = LOWER(?) LIMIT 1`,
      [contextoId, c.nomeBase]
    )[0]?.values?.[0];
    if (jaExiste) {
      resultados.push({ ok: false, jaExistia: true, parcelamentoId: Number(jaExiste), descricao: c.nomeBase });
      continue;
    }
    // Calcula valor base e resto (igual criarParcelamento)
    const valorBase = Math.floor(c.valorTotalCentavos / c.totalParcelas);
    const resto = c.valorTotalCentavos - valorBase * c.totalParcelas;
    // Pega a 1a parcela (menor numero) pra inferir data de inicio
    const itensOrdenados = [...c.itens].sort((a, b) => a.numero - b.numero);
    const primeiraData = itensOrdenados[0].dataCompetencia;
    db.run('BEGIN');
    try {
      // 1. Cria o parcelamento
      db.run(
        `INSERT INTO parcelamentos (contexto_id, descricao, valor_total_centavos, num_parcelas, cartao_id, dia_vencimento, data_primeira_parcela, observacoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [contextoId, c.nomeBase, c.valorTotalCentavos, c.totalParcelas, cartaoId, 10, primeiraData, 'Detectado automaticamente do extrato.']
      );
      const parcelamentoId = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
      // 2. Cria as N parcelas
      for (let k = 0; k < c.totalParcelas; k++) {
        const dataVenc = adicionarMeses(primeiraData, k);
        const valor = valorBase + (k === 0 ? resto : 0);
        db.run(
          `INSERT INTO parcelas (parcelamento_id, numero, data_vencimento, valor_centavos, status) VALUES (?, ?, ?, ?, 'pendente')`,
          [parcelamentoId, k + 1, dataVenc, valor]
        );
      }
      // 3. Vincula as parcelas detectadas (que ja tem lancamento_id) aos lancamentos existentes
      let parcelasVinculadas = 0;
      for (const it of itensOrdenados) {
        // Encontra a parcela correspondente (mesmo numero)
        const pRow = db.exec(
          `SELECT id, lancamento_id FROM parcelas WHERE parcelamento_id = ? AND numero = ?`,
          [parcelamentoId, it.numero]
        )[0]?.values?.[0];
        if (pRow && pRow[1] == null) {
          db.run('UPDATE parcelas SET lancamento_id = ? WHERE id = ?', [it.lancamentoId, pRow[0]]);
          parcelasVinculadas++;
        }
      }
      // 4. Se a parcela ja foi paga (status conciliado/estornado no lancamento), marca a parcela como paga tambem
      for (const it of itensOrdenados) {
        const statusLanc = db.exec('SELECT status FROM lancamentos WHERE id = ?', [it.lancamentoId])[0]?.values?.[0]?.[0];
        if (statusLanc === 'conciliado' || statusLanc === 'estornado') {
          db.run(`UPDATE parcelas SET status = 'paga', paga_em = ? WHERE parcelamento_id = ? AND numero = ?`,
            [it.dataCompetencia, parcelamentoId, it.numero]);
        }
      }
      db.run('COMMIT');
      resultados.push({
        ok: true,
        parcelamentoId,
        descricao: c.nomeBase,
        totalParcelas: c.totalParcelas,
        parcelasVinculadas,
        parcelasCriadas: c.totalParcelas - parcelasVinculadas,
        jaExistia: false,
      });
    } catch (e) {
      db.run('ROLLBACK');
      throw e;
    }
  }
  return resultados;
}
