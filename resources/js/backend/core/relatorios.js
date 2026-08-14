// MLopes Finance — Relatorios e balancete (Fase 6)
// Funcoes puras sobre `db` (sql.js). Sem DOM, sem Neutralino.

import { validarData } from './financeiro.js';

const AGRUPAMENTOS_VALIDOS = new Set(['conta', 'categoria', 'cliente', 'projeto', 'centro_custo', 'tag']);

// Configuracao de cada agrupamento: tabela de lookup + coluna de nome
const AGRUPAMENTO_CONFIG = {
  conta:        { tabela: 'contas',         idCol: 'id', nomeCol: 'nome' },
  categoria:    { tabela: 'categorias',     idCol: 'id', nomeCol: 'nome' },
  cliente:      { tabela: 'clientes',       idCol: 'id', nomeCol: 'nome' },
  projeto:      { tabela: 'projetos',       idCol: 'id', nomeCol: 'nome' },
  centro_custo: { tabela: 'centros_custo',  idCol: 'id', nomeCol: 'nome' },
  tag:          { tabela: 'tags',           idCol: 'id', nomeCol: 'nome' },
};

/** Calcula o intervalo de datas baseado no tipo. Retorna {inicio, fim, anterior: {inicio, fim}}. */
export function calcularPeriodo(tipo, customInicio = null, customFim = null) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth(); // 0-11

  const fmt = (d) => d.toISOString().slice(0, 10);
  const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
  const addYears = (date, n) => { const d = new Date(date); d.setFullYear(d.getFullYear() + n); return d; };
  const lastDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

  switch (tipo) {
    case 'este_mes': {
      const inicio = new Date(y, m, 1);
      const fim = lastDayOfMonth(inicio);
      const antInicio = new Date(y, m - 1, 1);
      const antFim = lastDayOfMonth(antInicio);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    case 'mes_passado': {
      const inicio = new Date(y, m - 1, 1);
      const fim = lastDayOfMonth(inicio);
      const antInicio = new Date(y, m - 2, 1);
      const antFim = lastDayOfMonth(antInicio);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    case 'este_ano': {
      const inicio = new Date(y, 0, 1);
      const fim = new Date(y, 11, 31);
      const antInicio = new Date(y - 1, 0, 1);
      const antFim = new Date(y - 1, 11, 31);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    case 'ano_passado': {
      const inicio = new Date(y - 1, 0, 1);
      const fim = new Date(y - 1, 11, 31);
      const antInicio = new Date(y - 2, 0, 1);
      const antFim = new Date(y - 2, 11, 31);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    case 'ultimos_12m': {
      const fim = hoje;
      const inicio = addMonths(fim, -12);
      const antFim = inicio;
      const antInicio = addMonths(antFim, -12);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    case 'custom': {
      if (!customInicio || !customFim) throw new Error('Periodo custom exige dataInicio e dataFim.');
      const inicio = new Date(customInicio);
      const fim = new Date(customFim);
      // Anterior: mesma duracao, imediatamente antes
      const dias = Math.round((fim - inicio) / (1000 * 60 * 60 * 24)) + 1;
      const antFim = new Date(inicio);
      antFim.setDate(antFim.getDate() - 1);
      const antInicio = new Date(antFim);
      antInicio.setDate(antInicio.getDate() - dias + 1);
      return { inicio, fim, anterior: { inicio: antInicio, fim: antFim } };
    }
    default:
      throw new Error(`Tipo de periodo invalido: ${tipo}`);
  }
}

/** Busca todos os lancamentos do contexto dentro do periodo. */
function buscarLancamentos(db, contextoId, dataInicio, dataFim) {
  return db.exec(
    `SELECT id, conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id,
            natureza, valor_centavos, data_competencia, descricao
       FROM lancamentos
      WHERE contexto_id = ? AND data_competencia BETWEEN ? AND ?
        AND status != 'estornado'
      ORDER BY data_competencia, id`,
    [contextoId, dataInicio, dataFim]
  )[0]?.values ?? [];
}

/** Busca tag_ids de cada lancamento (N:N). */
function buscarTagsPorLancamento(db, lancamentoIds) {
  if (!lancamentoIds.length) return new Map();
  const placeholders = lancamentoIds.map(() => '?').join(',');
  const rows = db.exec(
    `SELECT lancamento_id, tag_id FROM lancamento_tags WHERE lancamento_id IN (${placeholders})`,
    lancamentoIds
  )[0]?.values ?? [];
  const map = new Map();
  for (const [lancId, tagId] of rows) {
    if (!map.has(lancId)) map.set(lancId, []);
    map.get(lancId).push(tagId);
  }
  return map;
}

/** Busca nomes das tags em batch. */
function buscarNomesPorGrupo(db, tabela, idCol, nomeCol, ids) {
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.exec(
    `SELECT ${idCol}, ${nomeCol} FROM ${tabela} WHERE ${idCol} IN (${placeholders})`,
    ids
  )[0]?.values ?? [];
  const map = new Map();
  for (const [id, nome] of rows) map.set(id, nome);
  return map;
}

/** Gera o balancete agrupado. */
export function balancete(db, { contextoId, dataInicio, dataFim, agrupamento }) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!dataInicio || !dataFim) throw new Error('dataInicio e dataFim obrigatorios.');
  validarData(dataInicio); validarData(dataFim);
  if (!AGRUPAMENTOS_VALIDOS.has(agrupamento)) {
    throw new Error(`Agrupamento invalido: ${agrupamento}. Use: ${[...AGRUPAMENTOS_VALIDOS].join(', ')}`);
  }
  if (dataInicio > dataFim) throw new Error('dataInicio deve ser <= dataFim.');

  const lancamentos = buscarLancamentos(db, contextoId, dataInicio, dataFim);
  if (!lancamentos.length) {
    return {
      contextoId, dataInicio, dataFim, agrupamento,
      linhas: [],
      totais: { totalReceitas: 0, totalDespesas: 0, saldo: 0, lancamentos: 0 },
    };
  }

  // Coleta o ID do grupo pra cada lancamento dependendo do agrupamento
  const colIdx = {
    conta: 1, categoria: 2, cliente: 3, projeto: 4, centro_custo: 5, tag: null,
  }[agrupamento];

  // Pra tag, eh N:N — busca separado
  let tagsPorLanc = new Map();
  if (agrupamento === 'tag') {
    tagsPorLanc = buscarTagsPorLancamento(db, lancamentos.map(r => r[0]));
  }

  // Agrupa
  const grupos = new Map(); // grupoId -> { receitas, despesas, qtd }
  for (const l of lancamentos) {
    const [id, contaId, categoriaId, clienteId, projetoId, ccId, natureza, valor] = l;
    let grupoId;
    if (agrupamento === 'tag') {
      const tags = tagsPorLanc.get(id) ?? [];
      // Cria uma entrada "sem tag" pra lancamentos sem tag
      if (!tags.length) tags.push(null);
      for (const t of tags) {
        grupoId = t === null ? 'SEM_TAG' : `tag:${t}`;
        if (!grupos.has(grupoId)) grupos.set(grupoId, { receitas: 0, despesas: 0, qtd: 0 });
        const g = grupos.get(grupoId);
        g.qtd++;
        if (natureza === 'receita') g.receitas += valor;
        else g.despesas += valor;
      }
      continue;
    } else {
      grupoId = l[colIdx];
      if (grupoId === null || grupoId === undefined) grupoId = 'SEM_GRUPO';
      if (!grupos.has(grupoId)) grupos.set(grupoId, { receitas: 0, despesas: 0, qtd: 0 });
      const g = grupos.get(grupoId);
      g.qtd++;
      if (natureza === 'receita') g.receitas += valor;
      else g.despesas += valor;
    }
  }

  // Resolve nomes
  const cfg = AGRUPAMENTO_CONFIG[agrupamento];
  let nomes = new Map();
  if (agrupamento !== 'tag') {
    const idsNumericos = [...grupos.keys()].filter(k => typeof k === 'number');
    if (idsNumericos.length) {
      nomes = buscarNomesPorGrupo(db, cfg.tabela, cfg.idCol, cfg.nomeCol, idsNumericos);
    }
  } else {
    const tagIds = [...grupos.keys()].map(k => k === 'SEM_TAG' ? null : Number(k.split(':')[1])).filter(x => x !== null);
    if (tagIds.length) nomes = buscarNomesPorGrupo(db, 'tags', 'id', 'nome', tagIds);
  }

  // Monta linhas
  const linhas = [...grupos.entries()].map(([grupoId, g]) => {
    let nome;
    if (grupoId === 'SEM_GRUPO' || grupoId === 'SEM_TAG') nome = '(sem ' + (agrupamento === 'tag' ? 'tag' : 'vinculo') + ')';
    else if (typeof grupoId === 'number') nome = nomes.get(grupoId) || `(removido #${grupoId})`;
    else if (agrupamento === 'tag' && grupoId.startsWith('tag:')) {
      const tagId = Number(grupoId.split(':')[1]);
      nome = nomes.get(tagId) || `(removido #${tagId})`;
    }
    return {
      grupoId,
      grupo: nome,
      totalReceitas: g.receitas,
      totalDespesas: g.despesas,
      saldo: g.receitas - g.despesas,
      lancamentos: g.qtd,
    };
  });

  // Ordena por saldo decrescente (receitas primeiro, despesas depois)
  linhas.sort((a, b) => b.saldo - a.saldo);

  const totais = linhas.reduce(
    (acc, l) => ({
      totalReceitas: acc.totalReceitas + l.totalReceitas,
      totalDespesas: acc.totalDespesas + l.totalDespesas,
      saldo: acc.saldo + l.saldo,
      lancamentos: acc.lancamentos + l.lancamentos,
    }),
    { totalReceitas: 0, totalDespesas: 0, saldo: 0, lancamentos: 0 }
  );

  return {
    contextoId, dataInicio, dataFim, agrupamento,
    linhas,
    totais,
  };
}

/** Retorna o balancete atual + anterior + delta, baseado no tipo de periodo. */
export function comparativo(db, { contextoId, tipo, customInicio, customFim, agrupamento }) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!agrupamento) agrupamento = 'categoria';

  const { inicio, fim, anterior } = calcularPeriodo(tipo, customInicio, customFim);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const atual = balancete(db, {
    contextoId,
    dataInicio: fmt(inicio),
    dataFim: fmt(fim),
    agrupamento,
  });
  const ant = balancete(db, {
    contextoId,
    dataInicio: fmt(anterior.inicio),
    dataFim: fmt(anterior.fim),
    agrupamento,
  });

  return {
    agrupamento,
    tipo,
    atual: { ...atual, label: `${fmt(inicio)} a ${fmt(fim)}` },
    anterior: { ...ant, label: `${fmt(anterior.inicio)} a ${fmt(anterior.fim)}` },
    delta: {
      totalReceitas: atual.totais.totalReceitas - ant.totais.totalReceitas,
      totalDespesas: atual.totais.totalDespesas - ant.totais.totalDespesas,
      saldo: atual.totais.saldo - ant.totais.saldo,
      lancamentos: atual.totais.lancamentos - ant.totais.lancamentos,
    },
  };
}

/** Gera string CSV a partir de um balancete. */
export function exportaCSV(blc) {
  if (!blc || !blc.linhas) throw new Error('Balancete invalido.');
  const fmtBRL = (centavos) => (Number(centavos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const escape = (s) => {
    const str = String(s ?? '');
    if (/[",\n;]/.test(str)) return '"' + str.replaceAll('"', '""') + '"';
    return str;
  };

  const header = ['Grupo', 'Receitas (R$)', 'Despesas (R$)', 'Saldo (R$)', 'Lancamentos'];
  const linhas = blc.linhas.map((l) => [
    l.grupo,
    fmtBRL(l.totalReceitas),
    fmtBRL(l.totalDespesas),
    fmtBRL(l.saldo),
    l.lancamentos,
  ]);
  const totais = ['TOTAL', fmtBRL(blc.totais.totalReceitas), fmtBRL(blc.totais.totalDespesas), fmtBRL(blc.totais.saldo), blc.totais.lancamentos];

  const sep = ';';
  const headerLinha = header.map(escape).join(sep);
  const corpoLinhas = linhas.map((row) => row.map(escape).join(sep));
  const totalLinha = totais.map(escape).join(sep);
  const meta = [
    `# MLopes Finance - Relatorio de Balancete`,
    `# Contexto: ${blc.contextoId}`,
    `# Periodo: ${blc.dataInicio} a ${blc.dataFim}`,
    `# Agrupamento: ${blc.agrupamento}`,
    ``,
  ];

  return meta.join('\n') + [headerLinha, ...corpoLinhas, totalLinha].join('\n') + '\n';
}

// === v0.10.0: Motor Financeiro (relatorios avancados + alertas) ===

/**
 * Retorna os ultimos N meses em serie temporal com receitas/despesas/saldo por mes.
 * Formato: [{ mes: 'YYYY-MM', receitas, despesas, saldo, qtdLancamentos }].
 * Os meses SEM lancamentos vem com zeros (preenche gaps).
 */
export function gastosPorMes(db, contextoId, meses = 12) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!Number.isInteger(meses) || meses < 1 || meses > 60) throw new Error('meses deve ser 1..60.');
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
  const inicioISO = inicio.toISOString().slice(0, 10);
  // Query unica agrega por mes
  const rows = db.exec(`
    SELECT substr(data_competencia, 1, 7) AS mes,
           SUM(CASE WHEN natureza = 'receita' THEN valor_centavos ELSE 0 END) AS receitas,
           SUM(CASE WHEN natureza = 'despesa' THEN valor_centavos ELSE 0 END) AS despesas,
           COUNT(*) AS qtd
    FROM lancamentos
    WHERE contexto_id = ? AND data_competencia >= ? AND status != 'estornado'
    GROUP BY mes
    ORDER BY mes
  `, [contextoId, inicioISO])[0]?.values ?? [];
  const map = new Map(rows.map(([mes, rec, desp, qtd]) => [mes, { mes, receitas: Number(rec), despesas: Number(desp), qtd: Number(qtd) }]));
  // Preenche gaps
  const resultado = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const r = map.get(mes) ?? { mes, receitas: 0, despesas: 0, qtd: 0 };
    r.saldo = r.receitas - r.despesas;
    resultado.push(r);
  }
  return resultado;
}

/**
 * Top N categorias por despesa no periodo.
 * Retorna: [{ categoriaId, categoria, totalCentavos, qtd, percentual }].
 * percentual = quanto do total de despesas essa categoria representa.
 */
export function topCategorias(db, contextoId, dataInicio, dataFim, limite = 10) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const rows = db.exec(`
    SELECT l.categoria_id, COALESCE(ca.nome, '(sem categoria)') AS categoria,
           SUM(l.valor_centavos) AS total, COUNT(*) AS qtd
    FROM lancamentos l
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    WHERE l.contexto_id = ? AND l.natureza = 'despesa'
      AND l.data_competencia BETWEEN ? AND ? AND l.status != 'estornado'
    GROUP BY l.categoria_id
    ORDER BY total DESC
    LIMIT ?
  `, [contextoId, dataInicio, dataFim, limite])[0]?.values ?? [];
  // Calcula total de despesas pra percentual
  const totalGeral = db.exec(
    `SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
     WHERE contexto_id = ? AND natureza = 'despesa' AND data_competencia BETWEEN ? AND ? AND status != 'estornado'`,
    [contextoId, dataInicio, dataFim]
  )[0]?.values?.[0]?.[0] ?? 0;
  const totalNum = Number(totalGeral);
  return rows.map(([id, nome, total, qtd]) => ({
    categoriaId: id == null ? null : Number(id),
    categoria: String(nome),
    totalCentavos: Number(total),
    qtd: Number(qtd),
    percentual: totalNum > 0 ? (Number(total) / totalNum) * 100 : 0,
  }));
}

/**
 * Top N despesas individuais (lancamentos) no periodo.
 * Retorna: [{ lancamentoId, data, descricao, categoria, totalCentavos }].
 */
export function topDespesas(db, contextoId, dataInicio, dataFim, limite = 10) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const rows = db.exec(`
    SELECT l.id, l.data_competencia, l.descricao,
           COALESCE(ca.nome, '(sem)') AS categoria, l.valor_centavos
    FROM lancamentos l
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    WHERE l.contexto_id = ? AND l.natureza = 'despesa'
      AND l.data_competencia BETWEEN ? AND ? AND l.status != 'estornado'
    ORDER BY l.valor_centavos DESC
    LIMIT ?
  `, [contextoId, dataInicio, dataFim, limite])[0]?.values ?? [];
  return rows.map(([id, data, desc, cat, valor]) => ({
    lancamentoId: Number(id),
    data: String(data),
    descricao: String(desc),
    categoria: String(cat),
    totalCentavos: Number(valor),
  }));
}

/**
 * Gastos por conta no periodo, separado por tipo (bancaria/investimento/cartao).
 * Retorna: [{ contaId, conta, tipo, totalDespesas, qtd, cartaoFatura }].
 * cartaoFatura so vem preenchido se a conta for tipo 'cartao'.
 */
export function gastosPorConta(db, contextoId, dataInicio, dataFim) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const rows = db.exec(`
    SELECT c.id, c.nome, c.tipo,
           COALESCE(SUM(CASE WHEN l.natureza = 'despesa' THEN l.valor_centavos ELSE 0 END), 0) AS totalDespesas,
           COUNT(l.id) AS qtd
    FROM contas c
    LEFT JOIN lancamentos l ON l.conta_id = c.id
      AND l.data_competencia BETWEEN ? AND ? AND l.status != 'estornado'
    WHERE c.contexto_id = ? AND c.ativo = 1
    GROUP BY c.id
    ORDER BY totalDespesas DESC
  `, [dataInicio, dataFim, contextoId])[0]?.values ?? [];
  return rows.map(([id, nome, tipo, total, qtd]) => ({
    contaId: Number(id),
    conta: String(nome),
    tipo: String(tipo),
    totalDespesas: Number(total),
    qtd: Number(qtd),
  }));
}

/**
 * Faturas de cartao que vencem nos proximos N dias (a partir de hoje).
 * Considera faturas com status 'aberta' ou 'fechada' e data_vencimento entre hoje e hoje+N.
 * Retorna: [{ cartaoId, cartao, faturaId, ciclo, dataVencimento, totalCentavos, pagoCentavos, restanteCentavos, diasAteVencer }].
 */
export function faturasAVencer(db, contextoId, diasFuturos = 30) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date();
  limite.setDate(limite.getDate() + diasFuturos);
  const limiteISO = limite.toISOString().slice(0, 10);
  const rows = db.exec(`
    SELECT f.id, f.cartao_id, ca.nome, f.ciclo, f.data_vencimento,
           f.valor_total_centavos, f.valor_pago_centavos, f.status
    FROM faturas f
    JOIN cartoes ca ON ca.id = f.cartao_id
    WHERE ca.contexto_id = ?
      AND f.data_vencimento BETWEEN ? AND ?
      AND f.status IN ('aberta', 'fechada')
    ORDER BY f.data_vencimento
  `, [contextoId, hoje, limiteISO])[0]?.values ?? [];
  const hojeDate = new Date(hoje);
  return rows.map(([fId, cId, cNome, ciclo, dataVenc, total, pago, status]) => {
    const vencDate = new Date(dataVenc);
    const dias = Math.round((vencDate - hojeDate) / (1000 * 60 * 60 * 24));
    return {
      faturaId: Number(fId),
      cartaoId: Number(cId),
      cartao: String(cNome),
      ciclo: String(ciclo),
      dataVencimento: String(dataVenc),
      totalCentavos: Number(total),
      pagoCentavos: Number(pago),
      restanteCentavos: Math.max(0, Number(total) - Number(pago)),
      status: String(status),
      diasAteVencer: dias,
    };
  });
}

/**
 * Variacao mensal: receitas, despesas e saldo do mes atual vs mes anterior, com delta % e sinal.
 * Retorna: { mesAtual: {inicio, fim, receitas, despesas, saldo}, mesAnterior: {...}, delta: {receitas, despesas, saldo, variacaoReceitas%, variacaoDespesas%, variacaoSaldo%} }.
 */
export function variacaoMensal(db, contextoId) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const { inicio, fim, anterior } = calcularPeriodo('este_mes');
  const fmt = (d) => d.toISOString().slice(0, 10);
  const sum = (ini, fi) => {
    const r = db.exec(
      `SELECT
         COALESCE(SUM(CASE WHEN natureza = 'receita' THEN valor_centavos ELSE 0 END), 0) AS receitas,
         COALESCE(SUM(CASE WHEN natureza = 'despesa' THEN valor_centavos ELSE 0 END), 0) AS despesas
       FROM lancamentos
       WHERE contexto_id = ? AND data_competencia BETWEEN ? AND ? AND status != 'estornado'`,
      [contextoId, ini, fi]
    )[0]?.values?.[0] ?? [0, 0];
    const receitas = Number(r[0]);
    const despesas = Number(r[1]);
    return { receitas, despesas, saldo: receitas - despesas };
  };
  const atual = { ...sum(fmt(inicio), fmt(fim)), inicio: fmt(inicio), fim: fmt(fim) };
  const ant = { ...sum(fmt(anterior.inicio), fmt(anterior.fim)), inicio: fmt(anterior.inicio), fim: fmt(anterior.fim) };
  const pct = (a, b) => {
    if (b === 0) return a === 0 ? 0 : 100;
    return ((a - b) / b) * 100;
  };
  return {
    mesAtual: atual,
    mesAnterior: ant,
    delta: {
      receitas: atual.receitas - ant.receitas,
      despesas: atual.despesas - ant.despesas,
      saldo: atual.saldo - ant.saldo,
      variacaoReceitasPct: pct(atual.receitas, ant.receitas),
      variacaoDespesasPct: pct(atual.despesas, ant.despesas),
      variacaoSaldoPct: pct(atual.saldo, ant.saldo),
    },
  };
}

/**
 * v0.10.0: Lista de alertas contextuais pra mostrar no topo da app.
 * Cada alerta: { tipo: 'fatura'|'cartao'|'gasto', severidade: 'info'|'warn'|'crit', titulo, mensagem, acao? }.
 * - Fatura: vence em <= 3 dias OU valor_total > 50% do limite do cartao
 * - Cartao: limite usado > 80%
 * - Gasto: variacao de despesa > 30% vs mes anterior
 */
export function alertas(db, contextoId) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const out = [];
  // 1. Faturas proximas do vencimento (3 dias) ou com valor alto
  const faturas = faturasAVencer(db, contextoId, 30);
  for (const f of faturas) {
    if (f.diasAteVencer <= 3 && f.diasAteVencer >= 0 && f.restanteCentavos > 0) {
      out.push({
        tipo: 'fatura',
        severidade: f.diasAteVencer <= 1 ? 'crit' : 'warn',
        titulo: `Fatura ${f.cartao} ${f.ciclo} ${f.diasAteVencer === 0 ? 'vence hoje' : 'vence em ' + f.diasAteVencer + ' dia(s)'}`,
        mensagem: `R$ ${(f.restanteCentavos / 100).toFixed(2)} em aberto, vencimento ${f.dataVencimento}.`,
        acao: { view: 'faturas', cartaoId: f.cartaoId },
      });
    }
  }
  // 2. Cartoes com limite usado > 80%
  const cartoes = db.exec(`
    SELECT ca.id, ca.nome, ca.limite_centavos,
           COALESCE((SELECT SUM(valor_total_centavos - valor_pago_centavos) FROM faturas WHERE cartao_id = ca.id AND status IN ('aberta','fechada')), 0) AS emAberto
    FROM cartoes ca WHERE ca.contexto_id = ? AND ca.ativo = 1 AND ca.limite_centavos > 0
  `, [contextoId])[0]?.values ?? [];
  for (const [id, nome, limite, emAberto] of cartoes) {
    const lim = Number(limite);
    const emA = Number(emAberto);
    if (lim > 0 && emA / lim > 0.8) {
      const pct = Math.round((emA / lim) * 100);
      out.push({
        tipo: 'cartao',
        severidade: emA / lim > 0.95 ? 'crit' : 'warn',
        titulo: `Cartao ${nome} com ${pct}% do limite usado`,
        mensagem: `R$ ${(emA / 100).toFixed(2)} em aberto de R$ ${(lim / 100).toFixed(2)} (limite).`,
        acao: { view: 'faturas', cartaoId: Number(id) },
      });
    }
  }
  // 3. Variacao de gasto > 30%
  const v = variacaoMensal(db, contextoId);
  if (v.mesAnterior.despesas > 0 && Math.abs(v.delta.variacaoDespesasPct) > 30) {
    const sinal = v.delta.variacaoDespesasPct > 0 ? 'a mais' : 'a menos';
    out.push({
      tipo: 'gasto',
      severidade: v.delta.variacaoDespesasPct > 50 ? 'warn' : 'info',
      titulo: `Voce gastou ${Math.abs(v.delta.variacaoDespesasPct).toFixed(0)}% ${sinal} esse mes`,
      mensagem: `Despesa atual R$ ${(v.mesAtual.despesas / 100).toFixed(2)} vs anterior R$ ${(v.mesAnterior.despesas / 100).toFixed(2)}.`,
    });
  }
  return out;
}

/**
 * v0.10.0: Exporta TODOS os lancamentos do periodo (nao so o balancete) como CSV detalhado.
 * Colunas: Data, Descricao, Categoria, Conta, Natureza, Valor, Status.
 */
export function exportarMovimentosCSV(db, contextoId, dataInicio, dataFim) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!dataInicio || !dataFim) throw new Error('dataInicio e dataFim obrigatorios.');
  const rows = db.exec(`
    SELECT l.data_competencia, l.descricao,
           COALESCE(ca.nome, '') AS categoria, COALESCE(c.nome, '') AS conta,
           l.natureza, l.valor_centavos, l.status
    FROM lancamentos l
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    LEFT JOIN contas c ON c.id = l.conta_id
    WHERE l.contexto_id = ? AND l.data_competencia BETWEEN ? AND ?
    ORDER BY l.data_competencia, l.id
  `, [contextoId, dataInicio, dataFim])[0]?.values ?? [];
  const escape = (s) => {
    const str = String(s ?? '');
    if (/[",\n;]/.test(str)) return '"' + str.replaceAll('"', '""') + '"';
    return str;
  };
  const fmtBRL = (c) => (Number(c) / 100).toFixed(2).replace('.', ',');
  const header = ['Data', 'Descricao', 'Categoria', 'Conta', 'Natureza', 'Valor (R$)', 'Status'];
  const linhas = rows.map(([data, desc, cat, conta, nat, valor, status]) => [
    data, desc, cat, conta, nat, fmtBRL(valor), status,
  ]);
  const sep = ';';
  const meta = [
    `# MLopes Finance - Movimentos detalhados`,
    `# Contexto: ${contextoId}`,
    `# Periodo: ${dataInicio} a ${dataFim}`,
    `# Total de lancamentos: ${rows.length}`,
    ``,
  ];
  return meta.join('\n') + [header.map(escape).join(sep), ...linhas.map(r => r.map(escape).join(sep))].join('\n') + '\n';
}
