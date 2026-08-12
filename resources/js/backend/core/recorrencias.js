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
