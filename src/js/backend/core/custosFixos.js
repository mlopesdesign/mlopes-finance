// MLopes Finance — Custos Fixos (v0.10.0)
// Um custo fixo e' uma recorrencia mensal (aluguel, internet, luz, etc) que
// o user cadastra UMA vez. O sistema gera os lancamentos automaticamente.
//
// Estrutura: cada custo fixo gera 2 coisas:
// 1. Um lancamento "template" (data = primeiro mes, valor e descricao)
// 2. Uma recorrencia mensal vinculada ao template
// Quando o user clica "Gerar recorrencias de MM/AAAA", o sistema chama
// gerarProximaOcorrencia pra cada custo fixo ativo ate a data desejada.

import { criarLancamento, listarLancamentos } from './lancamentos.js';
import { criarRecorrencia, gerarProximaOcorrencia, listarRecorrencias, desativarRecorrencia, excluirRecorrencia } from './recorrencias.js';

function dataDoMes(diaDoMes) {
  // Data do MES ATUAL com o diaDoMes (ou ultimo dia do mes se o dia nao existir)
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth(); // 0-11
  const ultimo = new Date(y, m + 1, 0).getDate();
  const dia = Math.min(diaDoMes, ultimo);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function mesAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Cria um custo fixo. Internamente:
 * 1. Cria um lancamento "template" com a data do proximo mes (diaDoMes)
 * 2. Cria uma recorrencia mensal vinculada
 * Retorna { id, recorrenciaId, lancamentoTemplateId }.
 */
export function criarCustoFixo(db, { contextoId, descricao, valorCentavos, contaId, categoriaId = null, diaDoMes = 1, clienteId = null, projetoId = null, centroCustoId = null, ativo = true }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio.');
  if (!descricao?.trim()) throw new Error('Descricao obrigatoria.');
  if (!Number.isInteger(contaId)) throw new Error('Conta obrigatoria.');
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) throw new Error('valorCentavos deve ser > 0.');
  if (!Number.isInteger(diaDoMes) || diaDoMes < 1 || diaDoMes > 31) throw new Error('diaDoMes deve ser 1..31.');
  // Verifica conta existe
  const conta = db.exec('SELECT tipo FROM contas WHERE id = ? AND contexto_id = ?', [contaId, contextoId])[0]?.values?.[0];
  if (!conta) throw new Error('Conta nao encontrada neste contexto.');
  db.run('BEGIN');
  try {
    // 1. Cria o template (lancamento) com a data do MES ATUAL
    //    (o "gerar mes atual" depois cria 1 lancamento por recorrencia nesta data)
    const dataTpl = dataDoMes(diaDoMes);
    const templateId = criarLancamento(db, {
      contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId,
      natureza: 'despesa', valorCentavos, dataCompetencia: dataTpl,
      descricao: `${descricao.trim()} [custo fixo]`,
      observacoes: 'Custo fixo gerado automaticamente todo mes.',
    });
    // 2. Cria a recorrencia mensal (template, NAO gera lancamentos automaticamente)
    const recorrenciaId = criarRecorrencia(db, {
      contextoId,
      lancamentoTemplateId: templateId,
      periodicidade: 'mensal',
      proximaGeracao: dataTpl, // proximaGeracao = mes atual
    });
    if (!ativo) {
      // Se pediu inativo, desativa
      desativarRecorrencia(db, recorrenciaId);
    }
    db.run('COMMIT');
    return { id: templateId, recorrenciaId, lancamentoTemplateId: templateId };
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
}

/**
 * Lista os custos fixos do contexto. Cada item: detalhes do template + recorrencia.
 * Retorna: [{ custoFixoId, recorrenciaId, descricao, valorCentavos, diaDoMes, contaId, contaNome, tipoConta, categoriaId, categoriaNome, ativo, dataInicio, proximaGeracao }]
 */
export function listarCustosFixos(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  // Cada recorrencia do contexto (com template)
  const rows = db.exec(`
    SELECT r.id AS recorrenciaId, r.ativa, r.proxima_geracao, r.criado_em,
           l.id AS templateId, l.descricao, l.valor_centavos, l.conta_id, l.categoria_id,
           c.nome AS conta_nome, c.tipo AS conta_tipo,
           ca.nome AS categoria_nome
    FROM recorrencias r
    JOIN lancamentos l ON l.id = r.lancamento_template_id
    LEFT JOIN contas c ON c.id = l.conta_id
    LEFT JOIN categorias ca ON ca.id = l.categoria_id
    WHERE r.contexto_id = ? AND r.periodicidade = 'mensal' AND l.descricao LIKE '%[custo fixo]%'
    ORDER BY l.descricao
  `, [contextoId])[0]?.values ?? [];
  return rows.map(([recId, ativa, proxGer, , tplId, desc, valor, contaId, catId, contaNome, contaTipo, catNome]) => {
    // Extrai o diaDoMes do template (data do template)
    const tplData = db.exec('SELECT data_competencia FROM lancamentos WHERE id = ?', [tplId])[0]?.values?.[0]?.[0];
    const diaDoMes = tplData ? Number(tplData.split('-')[2]) : 1;
    return {
      custoFixoId: Number(tplId),
      recorrenciaId: Number(recId),
      descricao: String(desc).replace(/ \[custo fixo\]$/, ''),
      valorCentavos: Number(valor),
      diaDoMes,
      contaId: Number(contaId),
      contaNome: String(contaNome || ''),
      tipoConta: String(contaTipo || 'bancaria'),
      categoriaId: catId,
      categoriaNome: String(catNome || ''),
      ativo: Number(ativa) === 1,
      proximaGeracao: String(proxGer || ''),
    };
  });
}

/**
 * Total mensal de custos fixos ATIVOS (somando o valor de cada um).
 * Retorna { totalCentavos, qtdCustosFixos }.
 */
export function totalCustosFixosMes(db, contextoId) {
  const lista = listarCustosFixos(db, contextoId).filter(c => c.ativo);
  const total = lista.reduce((s, c) => s + c.valorCentavos, 0);
  return { totalCentavos: total, qtdCustosFixos: lista.length };
}

/**
 * Resumo do mes atual: lista de custos fixos + quanto ja foi pago (lancamentos gerados nesse mes).
 * Retorna { mes, totalPrevistoCentavos, totalPagoCentavos, percentualPago, custosFixos: [...] }.
 */
export function resumoCustosFixosMes(db, contextoId) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const mes = mesAtual();
  const lista = listarCustosFixos(db, contextoId);
  // Pega os lancamentos gerados pelas recorrencias no mes atual
  const inicioMes = `${mes}-01`;
  const fimMes = `${mes}-31`;
  const gerados = db.exec(`
    SELECT l.id, l.descricao, l.valor_centavos, l.conta_id, l.categoria_id, l.data_competencia, l.status
    FROM lancamentos l
    WHERE l.contexto_id = ? AND l.data_competencia BETWEEN ? AND ?
      AND l.descricao LIKE '%[rec %]%' AND l.status != 'estornado'
  `, [contextoId, inicioMes, fimMes])[0]?.values ?? [];
  const pago = gerados.reduce((s, l) => s + Number(l[2]), 0);
  const totalPrev = lista.filter(c => c.ativo).reduce((s, c) => s + c.valorCentavos, 0);
  // Cruza cada custo fixo com os lancamentos gerados
  const detalhado = lista.map(c => {
    const match = gerados.find(l => String(l[1]).includes(`[rec ${c.recorrenciaId}]`));
    return {
      ...c,
      gerado: !!match,
      lancamentoId: match ? Number(match[0]) : null,
      statusGerado: match ? String(match[6]) : null,
    };
  });
  return {
    mes,
    totalPrevistoCentavos: totalPrev,
    totalPagoCentavos: pago,
    percentualPago: totalPrev > 0 ? (pago / totalPrev) * 100 : 0,
    custosFixos: detalhado,
  };
}

/**
 * Gera 1 lancamento para o custo fixo, na data alvo (ex: dia 10 do mes atual).
 * Internamente: pega o template, clona os campos, cria novo lancamento
 * com dataAlvo, e atualiza a recorrencia para apontar pro proximo mes.
 * v0.10.0: versao customizada (a `gerarProximaOcorrencia` em recorrencias.js
 * adiciona 1 mes automaticamente, mas a gente quer gerar NA data alvo do mes).
 */
function gerarLancamentoCustoFixo(db, recorrenciaId, dataAlvo, agora = new Date().toISOString()) {
  const r = db.exec('SELECT contexto_id, lancamento_template_id, ativa FROM recorrencias WHERE id = ?', [recorrenciaId])[0]?.values?.[0];
  if (!r) return null;
  const [contextoId, templateId, ativa] = r;
  if (!ativa) return null;
  const tpl = db.exec('SELECT conta_id, categoria_id, cliente_id, projeto_id, centro_custo_id, valor_centavos, descricao, observacoes FROM lancamentos WHERE id = ?', [templateId])[0]?.values?.[0];
  if (!tpl) return null;
  const [contaId, categoriaId, clienteId, projetoId, centroCustoId, valor, descricao, observacoes] = tpl;
  // Cria novo lancamento com a data alvo
  // IMPORTANTE: adiciona "[rec N]" no nome pra o resumoCustosFixosMes conseguir
  // identificar qual custo fixo gerou cada lancamento (mesma logica do
  // gerarProximaOcorrencia em recorrencias.js)
  const idLanc = criarLancamento(db, {
    contextoId, contaId, categoriaId, clienteId, projetoId, centroCustoId,
    natureza: 'despesa', valorCentavos: Number(valor),
    dataCompetencia: dataAlvo,
    descricao: `${String(descricao).replace(/ \[custo fixo\]$/, '')} [rec ${recorrenciaId}]`,
    observacoes: String(observacoes || ''),
  }, agora);
  // Avanca proximaGeracao pro proximo mes
  const proxMes = (() => {
    const [y, m, d] = dataAlvo.split('-').map(Number);
    let ny = y, nm = m + 1;
    if (nm > 12) { nm = 1; ny++; }
    return `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  })();
  db.run('UPDATE recorrencias SET proxima_geracao = ? WHERE id = ?', [proxMes, recorrenciaId]);
  return { id: idLanc, data: dataAlvo };
}

/**
 * Gera as ocorrencias de TODOS os custos fixos ativos que ainda nao foram gerados no mes atual.
 * Retorna { gerados: [{ custoFixoId, descricao, data, lancamentoId }] }.
 */
export function gerarOcorrenciasMesAtual(db, contextoId, agora = new Date().toISOString()) {
  if (!Number.isInteger(contextoId)) throw new Error('contextoId obrigatorio.');
  const resumo = resumoCustosFixosMes(db, contextoId);
  const gerados = [];
  for (const c of resumo.custosFixos) {
    if (c.ativo && !c.gerado) {
      try {
        // Calcula a data alvo: diaDoMes do mes atual
        const hoje = new Date();
        const y = hoje.getFullYear();
        const m = hoje.getMonth();
        const ultimo = new Date(y, m + 1, 0).getDate();
        const dia = Math.min(c.diaDoMes, ultimo);
        const dataAlvo = `${y}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const r = gerarLancamentoCustoFixo(db, c.recorrenciaId, dataAlvo, agora);
        if (r) gerados.push({ custoFixoId: c.custoFixoId, descricao: c.descricao, data: r.data, lancamentoId: r.id });
      } catch (e) {
        // Continua mesmo se um falhar
      }
    }
  }
  return { gerados, totalGerado: gerados.length };
}

/**
 * v0.10.0: Altera o estado ativo/inativo de um custo fixo (via recorrencia).
 */
export function alternarCustoFixo(db, custoFixoId, ativo) {
  if (!Number.isInteger(custoFixoId)) throw new Error('custoFixoId obrigatorio.');
  const rec = db.exec(`
    SELECT r.id FROM recorrencias r
    JOIN lancamentos l ON l.id = r.lancamento_template_id
    WHERE l.id = ?`, [custoFixoId])[0]?.values?.[0];
  if (!rec) throw new Error('Custo fixo nao encontrado.');
  if (ativo) {
    db.run("UPDATE recorrencias SET ativa = 1 WHERE id = ?", [rec[0]]);
  } else {
    desativarRecorrencia(db, rec[0]);
  }
  return { ok: true, custoFixoId, ativo };
}

/**
 * v0.10.0: Exclui um custo fixo. cascade=true apaga o template tbm.
 * Por padrao so desativa (mantem historico).
 */
export function excluirCustoFixo(db, custoFixoId, { cascade = false } = {}) {
  if (!Number.isInteger(custoFixoId)) throw new Error('custoFixoId obrigatorio.');
  const rec = db.exec(`
    SELECT r.id FROM recorrencias r
    JOIN lancamentos l ON l.id = r.lancamento_template_id
    WHERE l.id = ?`, [custoFixoId])[0]?.values?.[0];
  if (!rec) throw new Error('Custo fixo nao encontrado.');
  if (cascade) {
    // Apaga o template e a recorrencia
    db.run('DELETE FROM recorrencias WHERE id = ?', [rec[0]]);
    db.run('DELETE FROM lancamentos WHERE id = ?', [custoFixoId]);
    return { ok: true, custoFixoId, cascade, ativa: false };
  }
  // Sem cascade: so desativa
  desativarRecorrencia(db, rec[0]);
  return { ok: true, custoFixoId, ativa: false };
}
