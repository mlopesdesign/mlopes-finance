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
