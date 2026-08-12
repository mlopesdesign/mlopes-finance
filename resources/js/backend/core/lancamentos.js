import { validarData, validarValorCentavos } from './financeiro.js';

export function criarLancamento(db, input, agora = new Date().toISOString()) {
  const { contextoId, contaId, categoriaId = null, natureza, valorCentavos, dataCompetencia, descricao, observacoes = '' } = input;
  if (!Number.isInteger(contextoId) || !Number.isInteger(contaId)) throw new Error('Contexto e conta são obrigatórios.');
  if (!['receita', 'despesa'].includes(natureza)) throw new Error('Natureza deve ser receita ou despesa.');
  validarValorCentavos(valorCentavos); validarData(dataCompetencia);
  if (!descricao?.trim()) throw new Error('Descrição é obrigatória.');
  db.run(`INSERT INTO lancamentos (contexto_id, conta_id, categoria_id, natureza, valor_centavos, data_competencia, descricao, observacoes, status, criado_em)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aberto', ?)`, [contextoId, contaId, categoriaId, natureza, valorCentavos, dataCompetencia, descricao.trim(), observacoes.trim(), agora]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)', ['lancamentos', id, 'criado', JSON.stringify(input), agora]);
  return id;
}

export function conciliarLancamento(db, id, agora = new Date().toISOString()) {
  const rows = db.exec('SELECT id, status FROM lancamentos WHERE id = ?', [id]);
  if (!rows.length || !rows[0].values.length) throw new Error('Lançamento não encontrado.');
  if (rows[0].values[0][1] === 'conciliado') return false;
  db.run('UPDATE lancamentos SET status = \'conciliado\', atualizado_em = ? WHERE id = ?', [agora, id]);
  db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)', ['lancamentos', id, 'conciliado', '{}', agora]);
  return true;
}

export function resumo(db, contextoId) {
  const rows = db.exec(`SELECT natureza, COALESCE(SUM(valor_centavos), 0) total FROM lancamentos WHERE contexto_id = ? GROUP BY natureza`, [contextoId]);
  const out = { receitas: 0, despesas: 0 };
  for (const [natureza, total] of rows[0]?.values ?? []) out[natureza === 'receita' ? 'receitas' : 'despesas'] = Number(total);
  return { ...out, saldo: out.receitas - out.despesas };
}
