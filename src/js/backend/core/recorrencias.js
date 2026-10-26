// MLopes Finance — recorrencias
// Define periodicidade de um lancamento-template. Geracao das ocorrencias futuras e' sob demanda.

import { criarLancamento } from './lancamentos.js';

const PERIODICIDADES_VALIDAS = ['diaria', 'semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'];

function adicionarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function adicionarMeses(dataISO, meses) {
  const d = new Date(`${dataISO}T00:00:00Z`);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString().slice(0, 10);
}
function proximaData(dataISO, periodicidade) {
  switch (periodicidade) {
    case 'diaria': return adicionarDias(dataISO, 1);
    case 'semanal': return adicionarDias(dataISO, 7);
    case 'mensal': return adicionarMeses(dataISO, 1);
    case 'bimestral': return adicionarMeses(dataISO, 2);
    case 'trimestral': return adicionarMeses(dataISO, 3);
    case 'semestral': return adicionarMeses(dataISO, 6);
    case 'anual': {
      const d = new Date(`${dataISO}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d.toISOString().slice(0, 10);
    }
    default: throw new Error(`Periodicidade invalida: ${periodicidade}`);
  }
}

export function criarRecorrencia(db, { contextoId, lancamentoTemplateId, periodicidade, totalOcorrencias = null, proximaGeracao = null }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio.');
  if (!Number.isInteger(lancamentoTemplateId)) throw new Error('Lancamento template obrigatorio.');
  if (!PERIODICIDADES_VALIDAS.includes(periodicidade)) throw new Error(`Periodicidade deve ser uma de: ${PERIODICIDADES_VALIDAS.join(', ')}`);
  if (totalOcorrencias != null && (!Number.isInteger(totalOcorrencias) || totalOcorrencias < 1)) throw new Error('total_ocorrencias deve ser inteiro >= 1.');
  db.run(`INSERT INTO recorrencias (contexto_id, lancamento_template_id, periodicidade, total_ocorrencias, proxima_geracao) VALUES (?, ?, ?, ?, ?)`,
    [contextoId, lancamentoTemplateId, periodicidade, totalOcorrencias, proximaGeracao]);
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

/** Gera a proxima ocorrencia a partir do template. Retorna o id do novo lancamento ou null se atingiu o limite. */
export function gerarProximaOcorrencia(db, recorrenciaId, agora = new Date().toISOString()) {
  const r = db.exec('SELECT contexto_id, lancamento_template_id, periodicidade, total_ocorrencias, ativa, proxima_geracao FROM recorrencias WHERE id = ?', [recorrenciaId])[0]?.values?.[0];
  if (!r) throw new Error('Recorrencia nao encontrada.');
  const [contextoId, templateId, periodicidade, totalOcorrencias, ativa, proximaGeracao] = r;
  if (!ativa) return null;
  // Conta ocorrencias ja geradas
  const geradas = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE descricao LIKE ? AND contexto_id = ?',
    [`%[rec ${recorrenciaId}]%`, contextoId])[0]?.values?.[0]?.[0] ?? 0);
  if (totalOcorrencias != null && geradas >= totalOcorrencias) return null;
  // Le o template
  const tpl = db.exec('SELECT conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id, valor_centavos, data_competencia, descricao, observacoes FROM lancamentos WHERE id = ?', [templateId])[0]?.values?.[0];
  if (!tpl) throw new Error('Lancamento template nao encontrado mais.');
  const [contaId, categoriaId, clienteId, projetoId, centroCustoId, valor, dataCompetencia, descricao, observacoes] = tpl;
  const dataNova = proximaGeracao || proximaData(dataCompetencia, periodicidade);
  // Cria novo lancamento
  const novoId = criarLancamento(db, {
    contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId,
    natureza: 'receita', valorCentavos: Number(valor), dataCompetencia: dataNova,
    descricao: `${descricao} [rec ${recorrenciaId}]`, observacoes,
  }, agora);
  db.run('UPDATE recorrencias SET proxima_geracao = ? WHERE id = ?', [proximaData(dataNova, periodicidade), recorrenciaId]);
  return { id: novoId, data: dataNova };
}

export function listarRecorrencias(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec('SELECT * FROM recorrencias WHERE contexto_id = ? AND ativa = 1 ORDER BY id', [contextoId])[0]?.values ?? [];
}

// === EXCLUSAO ===
// Por padrao, desativa a recorrencia (marca ativa=0) sem perder o historico.
// A flag `cascade: true` apaga de verdade (lancamentos ja gerados NAO sao
// apagados - isso e' decisao do usuario, separada).

export function desativarRecorrencia(db, id) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id FROM recorrencias WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Recorrencia nao encontrada.');
  db.run('UPDATE recorrencias SET ativa = 0 WHERE id = ?', [id]);
  return { ok: true, id, ativa: false };
}

export function excluirRecorrencia(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id FROM recorrencias WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Recorrencia nao encontrada.');
  if (!cascade) {
    // Seguro: desativa em vez de apagar
    return desativarRecorrencia(db, id);
  }
  db.run('DELETE FROM recorrencias WHERE id = ?', [id]);
  return { ok: true, id, cascade, ativa: false };
}

// =============================================================================
// v0.12.3 — GASTOS RECORRENTES DETECTADOS
// =============================================================================
// Diferente de recorrencias (que e' template+geracao de ocorrencias futuras),
// gastos_recorrentes detecta PADROES nos lancamentos existentes (Uber, 99,
// Adobe, Netflix, etc) e produz relatorios mensais/anuais.
//
// Heuristica:
// 1. Varre todos os lancamentos de DESPESA do contexto
// 2. Normaliza a descricao (lowercase, remove prefixos, remove numeros, trim)
// 3. Agrupa por (nome_normalizado, valor_centavos)
// 4. Filtra grupos com >= minOcorrencias (default 2)
// 5. Calcula intervalo medio entre datas -> classifica em periodicidade
// 6. Match de keyword -> sugere categoria (Uber/99 -> Transporte, etc)
// =============================================================================

// Dicionario de keyword -> categoria sugerida. Usado pra auto-classificar.
// Regex case-insensitive. Casa em qualquer parte da descricao normalizada.
const CATEGORIAS_KEYWORD = [
  { regex: /\b(uber|99|99app|cabify)\b/, categoria: 'Transporte / App' },
  { regex: /\b(netflix|spotify|amazon prime|disney|hbo|youtube|apple tv|deezer|tidal|globoplay|paramount)\b/, categoria: 'Assinatura / Streaming' },
  { regex: /\b(adobe|figma|notion|github|jetbrains|microsoft|office 365|dropbox|google one|icloud|1password|bitwarden|lastpass|chatgpt|openai|claude)\b/, categoria: 'Assinatura / Software' },
  { regex: /\b(ifood|rappi|uber eats|aiqfome|james delivery|ze delivery)\b/, categoria: 'Delivery' },
  { regex: /\b(vivo|claro|tim|oi|algar)\b/, categoria: 'Telefonia / Internet' },
  { regex: /\b(aluguel|condominio|iptu)\b/, categoria: 'Moradia' },
  { regex: /\b(academia|smart fit|just fit|selfit)\b/, categoria: 'Saúde / Academia' },
  { regex: /\b(petlove|petshop|petz|cobasi)\b/, categoria: 'Pet' },
  { regex: /\b(shell|ipiranga|br mania|ale combustiveis)\b/, categoria: 'Combustivel' },
  { regex: /\b(estapar|zona azul|multa)\b/, categoria: 'Estacionamento / Multa' },
  { regex: /\b(cpfl|elektro|energisa|equatorial|light|ceee|cemig|enel|edp|rge)\b/, categoria: 'Energia' },
  { regex: /\b(sabesp|copasa|agua|caesb)\b/, categoria: 'Agua' },
  { regex: /\b(supermercado|extra|carrefour|pão de acucar|pao de acucar|assaí|atacadao|atacadão|big|fort)\b/, categoria: 'Supermercado' },
  { regex: /\b(amazon|mercado livre|mercadolivre|aliexpress|shopee|magalu|americanas|casas bahia)\b/, categoria: 'Compras Online' },
];

/**
 * Normaliza a descricao de um lancamento pra agrupar variacoes do mesmo gasto.
 * Ex: "UBER *TRIP 12:34" -> "uber *trip"
 * Ex: "Pagto Uber Brasil" -> "uber brasil"
 * Ex: "Pix enviado Maria 100,00" -> "pix enviado maria ,"
 * (Nao eh perfeito, mas o suficiente pra pegar o que importa.)
 */
export function normalizarNomeLancamento(desc) {
  if (!desc || typeof desc !== 'string') return '';
  let s = desc.toLowerCase();
  // Remove numeros (IDs, datas, valores)
  s = s.replace(/\d+/g, ' ');
  // Remove pontuacao (mantem letras, espacos e acentuacao)
  s = s.replace(/[^\p{L}\s]/gu, ' ');
  // Colapsa espacos
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Classifica o intervalo medio em dias para uma periodicidade textual. */
export function classificarPeriodicidade(intervaloMedioDias) {
  if (intervaloMedioDias == null || intervaloMedioDias <= 0) return 'irregular';
  if (intervaloMedioDias >= 5 && intervaloMedioDias <= 9) return 'semanal';
  if (intervaloMedioDias >= 12 && intervaloMedioDias <= 17) return 'quinzenal';
  if (intervaloMedioDias >= 25 && intervaloMedioDias <= 35) return 'mensal';
  if (intervaloMedioDias >= 55 && intervaloMedioDias <= 70) return 'bimestral';
  if (intervaloMedioDias >= 80 && intervaloMedioDias <= 100) return 'trimestral';
  if (intervaloMedioDias >= 170 && intervaloMedioDias <= 200) return 'semestral';
  if (intervaloMedioDias >= 350 && intervaloMedioDias <= 380) return 'anual';
  return 'irregular';
}

/** Calcula o intervalo medio (em dias) entre datas ordenadas. */
function calcularIntervaloMedio(datas) {
  if (!datas || datas.length < 2) return 0;
  const ord = [...datas].sort();
  let totalDias = 0;
  for (let i = 1; i < ord.length; i++) {
    const d1 = new Date(`${ord[i - 1]}T00:00:00Z`);
    const d2 = new Date(`${ord[i]}T00:00:00Z`);
    totalDias += Math.round((d2 - d1) / 86400000);
  }
  return Math.round(totalDias / (ord.length - 1));
}

/** Sugere uma categoria a partir do nome normalizado. */
export function sugerirCategoria(nomeNormalizado) {
  if (!nomeNormalizado) return '';
  for (const { regex, categoria } of CATEGORIAS_KEYWORD) {
    if (regex.test(nomeNormalizado)) return categoria;
  }
  return '';
}

/**
 * Detecta gastos recorrentes nos lancamentos do contexto.
 * Retorna array de candidatos (ainda NAO salvos no banco).
 * Cada candidato tem: { nomeExibicao, nomeNormalizado, valorCentavos,
 *                       periodicidade, intervaloMedioDias, dataPrimeira,
 *                       dataUltima, ocorrencias, lancamentoIds, categoriaSugerida }
 */
export function detectarGastosRecorrentes(db, contextoId, { minOcorrencias = 2, janelaDias = 365 } = {}) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  // Pega todos os lancamentos de DESPESA (exclui transferencias e receitas) na janela
  const dataLimite = new Date();
  dataLimite.setUTCDate(dataLimite.getUTCDate() - janelaDias);
  const dataLimiteISO = dataLimite.toISOString().slice(0, 10);
  const lancs = db.exec(`
    SELECT id, descricao, valor_centavos, data_competencia
    FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND data_competencia >= ?
      AND status != 'estornado'
    ORDER BY data_competencia
  `, [contextoId, dataLimiteISO])[0]?.values ?? [];
  // Agrupa por (nome_normalizado, valor_centavos)
  const grupos = new Map();
  for (const [id, desc, valor, data] of lancs) {
    const nomeNorm = normalizarNomeLancamento(desc);
    if (!nomeNorm) continue;
    const valorCents = Number(valor);
    const chave = `${nomeNorm}::${valorCents}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, { datas: [], ids: [], descricoes: new Set(), nomeNormalizado: nomeNorm, valorCentavos: valorCents });
    }
    const g = grupos.get(chave);
    g.datas.push(String(data));
    g.ids.push(Number(id));
    g.descricoes.add(String(desc));
  }
  // Filtra, calcula metricas e gera candidatos
  const candidatos = [];
  for (const g of grupos.values()) {
    if (g.ids.length < minOcorrencias) continue;
    const datasOrd = [...g.datas].sort();
    const intervaloMedioDias = calcularIntervaloMedio(g.datas);
    const periodicidade = classificarPeriodicidade(intervaloMedioDias);
    // Pega a descricao mais comum (primeira) como exibicao
    const nomesExibicao = [...g.descricoes].sort();
    const nomeExibicao = nomesExibicao[0] || g.nomeNormalizado;
    candidatos.push({
      nomeExibicao,
      nomeNormalizado: g.nomeNormalizado,
      valorCentavos: g.valorCentavos,
      periodicidade,
      intervaloMedioDias,
      dataPrimeira: datasOrd[0],
      dataUltima: datasOrd[datasOrd.length - 1],
      ocorrencias: g.ids.length,
      lancamentoIds: g.ids,
      categoriaSugerida: sugerirCategoria(g.nomeNormalizado),
    });
  }
  // Ordena por valor (maior primeiro) pra mostrar os mais relevantes no topo
  candidatos.sort((a, b) => b.valorCentavos - a.valorCentavos);
  return candidatos;
}

/** Salva N candidatos detectados como gastos recorrentes confirmados. */
export function salvarGastosRecorrentesDetectados(db, contextoId, candidatos) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  if (!Array.isArray(candidatos)) throw new Error('candidatos deve ser array.');
  const ids = [];
  db.run('BEGIN');
  try {
    for (const c of candidatos) {
      // v0.12.3: idempotente — se ja existe (contexto, nome_normalizado, valor_centavos), reusa
      const existente = db.exec(
        'SELECT id FROM gastos_recorrentes WHERE contexto_id = ? AND nome_normalizado = ? AND valor_centavos = ? AND ativo = 1',
        [contextoId, c.nomeNormalizado, c.valorCentavos]
      )[0]?.values?.[0]?.[0];
      let id;
      if (existente) {
        id = Number(existente);
        db.run(`UPDATE gastos_recorrentes
                SET ocorrencias = ?, data_primeira = ?, data_ultima = ?, periodicidade = ?,
                    intervalo_medio_dias = ?, categoria_sugerida = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?`, [c.ocorrencias, c.dataPrimeira, c.dataUltima, c.periodicidade, c.intervaloMedioDias, c.categoriaSugerida || '', id]);
      } else {
        db.run(`INSERT INTO gastos_recorrentes
                (contexto_id, nome_normalizado, nome_exibicao, valor_centavos, periodicidade,
                 intervalo_medio_dias, data_primeira, data_ultima, ocorrencias, categoria_sugerida)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [contextoId, c.nomeNormalizado, c.nomeExibicao, c.valorCentavos, c.periodicidade,
           c.intervaloMedioDias, c.dataPrimeira, c.dataUltima, c.ocorrencias, c.categoriaSugerida || '']);
        id = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
      }
      // Vincula os lancamentos (idempotente — UNIQUE PK)
      if (Array.isArray(c.lancamentoIds)) {
        for (const lancId of c.lancamentoIds) {
          try {
            db.run('INSERT INTO gastos_recorrentes_lancamentos (gastos_recorrente_id, lancamento_id) VALUES (?, ?)', [id, lancId]);
          } catch (e) {
            // UNIQUE constraint = ja vinculado, ignora
            if (!String(e.message).includes('UNIQUE')) throw e;
          }
        }
      }
      ids.push(id);
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, salvos: ids.length, ids };
}

export function listarGastosRecorrentes(db, contextoId, { incluirInativos = false } = {}) {
  if (!Number.isInteger(contextoId)) return [];
  const where = incluirInativos ? 'contexto_id = ?' : 'contexto_id = ? AND ativo = 1';
  // v0.12.3: agrega por (nome_normalizado, valor_centavos) pra evitar duplicatas
  // de deteccoes antigas. Tambem conta os lancamentos vinculados.
  return db.exec(`
    SELECT g.id, g.contexto_id, g.nome_exibicao, g.nome_normalizado, g.valor_centavos,
           g.periodicidade, g.intervalo_medio_dias, g.data_primeira, g.data_ultima,
           g.ocorrencias, g.categoria_sugerida, g.categoria_id, g.conta_id, g.ativo,
           (SELECT COUNT(*) FROM gastos_recorrentes_lancamentos l WHERE l.gastos_recorrente_id = g.id) AS qtd_lancamentos_vinculados
    FROM gastos_recorrentes g
    WHERE ${where}
    ORDER BY g.valor_centavos DESC, g.nome_exibicao
  `, [contextoId])[0]?.values ?? [];
}

export function obterGastoRecorrente(db, id) {
  if (!Number.isInteger(id)) return null;
  const row = db.exec(`
    SELECT g.*, (SELECT COUNT(*) FROM gastos_recorrentes_lancamentos l WHERE l.gastos_recorrente_id = g.id) AS qtd_vinculados
    FROM gastos_recorrentes g WHERE g.id = ?
  `, [id])[0]?.values?.[0];
  if (!row) return null;
  const lancs = db.exec(`
    SELECT l.id, l.data_competencia, l.valor_centavos, l.descricao, l.status
    FROM lancamentos l
    JOIN gastos_recorrentes_lancamentos gl ON gl.lancamento_id = l.id
    WHERE gl.gastos_recorrente_id = ?
    ORDER BY l.data_competencia
  `, [id])[0]?.values ?? [];
  return { ...row, lancamentos: lancs };
}

/** Exclui um gasto recorrente (cascade remove os vinculos com lancamentos). */
export function excluirGastoRecorrente(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome_exibicao FROM gastos_recorrentes WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Gasto recorrente nao encontrado.');
  if (!cascade) {
    // Soft delete
    db.run('UPDATE gastos_recorrentes SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    return { ok: true, id, ativo: false, soft: true };
  }
  // Hard delete (cascade apaga os vinculos)
  db.run('DELETE FROM gastos_recorrentes WHERE id = ?', [id]);
  return { ok: true, id, cascade, ativo: false };
}

/**
 * Relatorio mensal: 12 meses (do mesInicio pra frente) com o total estimado
 * por mes e o total real (dos lancamentos confirmados).
 *
 * Cada mes: { mes: 'YYYY-MM', totalEstimadoCentavos, totalRealCentavos,
 *             qtdGastos: N, detalhes: [{nome, valor, periodicidade}] }
 */
export function relatorioGastosRecorrentesMensal(db, contextoId, { mesInicio = null, ano = null } = {}) {
  if (!Number.isInteger(contextoId)) return [];
  const hoje = new Date();
  const anoBase = ano || hoje.getUTCFullYear();
  const mesBaseNum = mesInicio ? Number(mesInicio.split('-')[1]) : (hoje.getUTCMonth() + 1);
  const meses = [];
  for (let i = 0; i < 12; i++) {
    let m = mesBaseNum + i;
    let a = anoBase;
    if (m > 12) { m -= 12; a += 1; }
    meses.push(`${a}-${String(m).padStart(2, '0')}`);
  }
  const gastos = listarGastosRecorrentes(db, contextoId);
  // Fator de ocorrencias por mes pra cada periodicidade
  const FATOR_MES = {
    semanal: 4.33, quinzenal: 2.17, mensal: 1, bimestral: 0.5, trimestral: 0.33,
    semestral: 0.17, anual: 0.083, irregular: 1,
  };
  // Para cada mes, calcula o total estimado e o real
  const out = meses.map((mes) => {
    const detalhes = [];
    let totalEstimado = 0;
    for (const g of gastos) {
      // v0.12.3: listarGastosRecorrentes retorna array posicional, nao objeto.
      // Shape: [id, contextoId, nomeExibicao, nomeNormalizado, valorCentavos, periodicidade, intervaloMedioDias, dataPrimeira, dataUltima, ocorrencias, categoriaSugerida, categoriaId, contaId, ativo, qtdVinculados]
      const [, , nomeExibicao, , valorCentavos, periodicidade, , dataPrimeira] = g;
      const fator = FATOR_MES[periodicidade] ?? 1;
      // So conta se a primeira ocorrencia ja passou
      if (dataPrimeira && dataPrimeira <= `${mes}-31`) {
        const estimado = Math.round(valorCentavos * fator);
        totalEstimado += estimado;
        detalhes.push({ nome: nomeExibicao, valorCentavos, periodicidade, estimadoCentavos: estimado });
      }
    }
    // Total real: soma dos lancamentos vinculados que caem nesse mes
    const mesIni = `${mes}-01`;
    const [yy, mm] = mes.split('-').map(Number);
    const mesFim = `${yy}-${String(mm).padStart(2, '0')}-${new Date(Date.UTC(yy, mm, 0)).getUTCDate()}`;
    const real = Number(db.exec(`
      SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l
      JOIN gastos_recorrentes_lancamentos gl ON gl.lancamento_id = l.id
      JOIN gastos_recorrentes g ON g.id = gl.gastos_recorrente_id
      WHERE g.contexto_id = ? AND l.data_competencia BETWEEN ? AND ? AND l.status != 'estornado'
    `, [contextoId, mesIni, mesFim])[0]?.values?.[0]?.[0] ?? 0);
    return { mes, totalEstimadoCentavos: totalEstimado, totalRealCentavos: Number(real), qtdGastos: detalhes.length, detalhes };
  });
  return out;
}

/**
 * Relatorio anual: soma do ano especificado, ranking de top 10 por valor total,
 * comparativo com ano anterior.
 */
export function relatorioGastosRecorrentesAnual(db, contextoId, { ano = null } = {}) {
  if (!Number.isInteger(contextoId)) return null;
  const hoje = new Date();
  const anoRef = ano || hoje.getUTCFullYear();
  const anoAnt = anoRef - 1;
  // Total do ano
  const totalAno = Number(db.exec(`
    SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l
    JOIN gastos_recorrentes_lancamentos gl ON gl.lancamento_id = l.id
    JOIN gastos_recorrentes g ON g.id = gl.gastos_recorrente_id
    WHERE g.contexto_id = ? AND substr(l.data_competencia, 1, 4) = ? AND l.status != 'estornado'
  `, [contextoId, String(anoRef)])[0]?.values?.[0]?.[0] ?? 0);
  const totalAnoAnt = Number(db.exec(`
    SELECT COALESCE(SUM(l.valor_centavos), 0) FROM lancamentos l
    JOIN gastos_recorrentes_lancamentos gl ON gl.lancamento_id = l.id
    JOIN gastos_recorrentes g ON g.id = gl.gastos_recorrente_id
    WHERE g.contexto_id = ? AND substr(l.data_competencia, 1, 4) = ? AND l.status != 'estornado'
  `, [contextoId, String(anoAnt)])[0]?.values?.[0]?.[0] ?? 0);
  // Ranking top 10 do ano
  const ranking = db.exec(`
    SELECT g.id, g.nome_exibicao, g.nome_normalizado, g.valor_centavos, g.periodicidade,
           g.categoria_sugerida, COUNT(l.id) AS ocorrencias,
           COALESCE(SUM(l.valor_centavos), 0) AS total_centavos
    FROM gastos_recorrentes g
    LEFT JOIN gastos_recorrentes_lancamentos gl ON gl.gastos_recorrente_id = g.id
    LEFT JOIN lancamentos l ON l.id = gl.lancamento_id
      AND substr(l.data_competencia, 1, 4) = ? AND l.status != 'estornado'
    WHERE g.contexto_id = ? AND g.ativo = 1
    GROUP BY g.id
    ORDER BY total_centavos DESC
    LIMIT 10
  `, [String(anoRef), contextoId])[0]?.values ?? [];
  // Por periodicidade (visao geral)
  const porPeriodicidade = db.exec(`
    SELECT g.periodicidade, COUNT(DISTINCT g.id) AS qtd_gastos,
           COALESCE(SUM(l.valor_centavos), 0) AS total_centavos
    FROM gastos_recorrentes g
    LEFT JOIN gastos_recorrentes_lancamentos gl ON gl.gastos_recorrente_id = g.id
    LEFT JOIN lancamentos l ON l.id = gl.lancamento_id
      AND substr(l.data_competencia, 1, 4) = ? AND l.status != 'estornado'
    WHERE g.contexto_id = ? AND g.ativo = 1
    GROUP BY g.periodicidade
    ORDER BY total_centavos DESC
  `, [String(anoRef), contextoId])[0]?.values ?? [];
  // Variacao ano a ano (%)
  const variacao = totalAnoAnt > 0 ? Math.round(((totalAno - totalAnoAnt) / totalAnoAnt) * 100) : null;
  return {
    ano: anoRef,
    anoAnterior: anoAnt,
    totalCentavos: Number(totalAno),
    totalAnoAnteriorCentavos: Number(totalAnoAnt),
    variacaoPercentual: variacao,
    ranking: ranking.map((r) => ({
      id: Number(r[0]),
      nome: String(r[1]),
      valorUnitarioCentavos: Number(r[3]),
      periodicidade: String(r[4]),
      categoriaSugerida: String(r[5] || ''),
      ocorrencias: Number(r[6]),
      totalCentavos: Number(r[7]),
    })),
    porPeriodicidade: porPeriodicidade.map((p) => ({
      periodicidade: String(p[0]),
      qtd: Number(p[1]),
      totalCentavos: Number(p[2]),
    })),
  };
}

/**
 * v0.12.5: Relatorio agrupado por CATEGORIA.
 * Retorna { categorias: [{categoria, qtdGastos, valorMensalCentavos, valorAnualCentavos, gastos: [...]}], total }.
 *
 * Marcio pediu (2026-08-19): "recorrencias tem que ser só saida, quero ver o custo
 * que tenho com transportes, vivo, etc" — ou seja, agregado por categoria, nao
 * lista de cada gasto individual.
 *
 * Saida: gastos_recorrentes (ja sao despesas, regra do projeto) sao agrupados
 * por categoria_sugerida (Uber/99 -> Transporte, Vivo -> Telefonia, etc).
 * Valor mensal = valor_unitario * fator_periodicidade.
 * Valor anual = valor_mensal * 12.
 */
export function relatorioGastosRecorrentesPorCategoria(db, contextoId, { ano = null } = {}) {
  if (!Number.isInteger(contextoId)) return { categorias: [], total: { qtdGastos: 0, valorMensalCentavos: 0, valorAnualCentavos: 0 } };
  const hoje = new Date();
  const anoRef = ano || hoje.getUTCFullYear();
  const gastos = listarGastosRecorrentes(db, contextoId);
  const FATOR_MES = {
    semanal: 4.33, quinzenal: 2.17, mensal: 1, bimestral: 0.5, trimestral: 0.33,
    semestral: 0.17, anual: 0.083, irregular: 1,
  };
  // Agrupa por categoria_sugerida. "Sem categoria" agrupada em "Outros" pra nao poluir.
  const grupos = new Map();
  for (const g of gastos) {
    // Shape: [id, contextoId, nomeExibicao, nomeNormalizado, valorCentavos, periodicidade, intervaloMedioDias, dataPrimeira, dataUltima, ocorrencias, categoriaSugerida, categoriaId, contaId, ativo, qtdVinculados]
    const [, , nomeExibicao, , valorCentavos, periodicidade, , , , , categoriaSugerida] = g;
    const cat = (categoriaSugerida && String(categoriaSugerida).trim()) || 'Outros';
    const fator = FATOR_MES[periodicidade] ?? 1;
    const valorMensal = Math.round(valorCentavos * fator);
    if (!grupos.has(cat)) grupos.set(cat, { categoria: cat, qtdGastos: 0, valorMensalCentavos: 0, valorAnualCentavos: 0, gastos: [] });
    const grp = grupos.get(cat);
    grp.qtdGastos += 1;
    grp.valorMensalCentavos += valorMensal;
    grp.valorAnualCentavos += valorMensal * 12;
    grp.gastos.push({ nome: nomeExibicao, valorUnitarioCentavos: valorCentavos, periodicidade, valorMensalCentavos: valorMensal });
  }
  // Ordena por valor mensal desc
  const categorias = [...grupos.values()].sort((a, b) => b.valorMensalCentavos - a.valorMensalCentavos);
  const total = categorias.reduce((acc, c) => ({
    qtdGastos: acc.qtdGastos + c.qtdGastos,
    valorMensalCentavos: acc.valorMensalCentavos + c.valorMensalCentavos,
    valorAnualCentavos: acc.valorAnualCentavos + c.valorAnualCentavos,
  }), { qtdGastos: 0, valorMensalCentavos: 0, valorAnualCentavos: 0 });
  return { ano: anoRef, categorias, total };
}
