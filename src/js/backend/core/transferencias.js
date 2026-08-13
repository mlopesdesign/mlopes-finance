// MLopes Finance — transferencias entre contas do mesmo contexto
// Cria um par debito/credito vinculado. Regras: mesmo contexto, valor positivo em centavos, contas distintas.

import { validarData, validarValorCentavos } from './financeiro.js';
import { criarLancamento } from './lancamentos.js';

export function criarTransferencia(db, { contextoId, contaOrigemId, contaDestinoId, valorCentavos, dataCompetencia, descricao = 'Transferencia entre contas' }, agora = new Date().toISOString()) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio.');
  if (!Number.isInteger(contaOrigemId) || !Number.isInteger(contaDestinoId)) throw new Error('Conta origem e destino sao obrigatorias.');
  if (contaOrigemId === contaDestinoId) throw new Error('Conta de origem e destino devem ser diferentes.');
  validarValorCentavos(valorCentavos);
  validarData(dataCompetencia);
  // Validar que ambas as contas existem e pertecem ao contexto
  const origem = db.exec('SELECT contexto_id FROM contas WHERE id = ?', [contaOrigemId])[0]?.values?.[0]?.[0];
  const destino = db.exec('SELECT contexto_id FROM contas WHERE id = ?', [contaDestinoId])[0]?.values?.[0]?.[0];
  if (origem !== contextoId) throw new Error('Conta origem nao pertence ao contexto.');
  if (destino !== contextoId) throw new Error('Conta destino nao pertence ao contexto.');

  // Cria lancamento de saida (despesa) na origem
  const idSaida = criarLancamento(db, {
    contextoId, contaId: contaOrigemId, natureza: 'despesa', valorCentavos,
    dataCompetencia, descricao: `${descricao} (saida)`,
  }, agora);
  // Cria lancamento de entrada (receita) no destino
  const idEntrada = criarLancamento(db, {
    contextoId, contaId: contaDestinoId, natureza: 'receita', valorCentavos,
    dataCompetencia, descricao: `${descricao} (entrada)`,
  }, agora);
  // Vincula na tabela transferencias
  db.run(`INSERT INTO transferencias (contexto_id, lancamento_origem_id, lancamento_destino_id, valor_centavos, data_transferencia) VALUES (?, ?, ?, ?, ?)`,
    [contextoId, idSaida, idEntrada, valorCentavos, dataCompetencia]);
  const idTransf = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
  // Marca os dois lancamentos como transferencia e referencia cruzada
  db.run('UPDATE lancamentos SET transferencia_id = ? WHERE id IN (?, ?)', [idTransf, idSaida, idEntrada]);
  return { id: idTransf, idSaida, idEntrada };
}

export function listarTransferencias(db, contextoId) {
  if (!Number.isInteger(contextoId)) return [];
  return db.exec(`SELECT t.*, co.nome AS conta_origem_nome, cd.nome AS conta_destino_nome
                  FROM transferencias t
                  JOIN contas co ON co.id = (SELECT conta_id FROM lancamentos WHERE id = t.lancamento_origem_id)
                  JOIN contas cd ON cd.id = (SELECT conta_id FROM lancamentos WHERE id = t.lancamento_destino_id)
                  WHERE t.contexto_id = ?
                  ORDER BY t.data_transferencia DESC`, [contextoId])[0]?.values ?? [];
}

// === EXCLUSAO ===
// Exclui a transferencia e DESVINcula os 2 lancamentos (origem/destino).
// Os lancamentos em si NAO sao apagados: o usuario pode ter registrado
// aquela movimentacao por outros motivos. Apenas perdem o vinculo com a
// transferencia. cascade:true apaga TUDO (lancamentos + baixas + tag links).

export function excluirTransferencia(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, lancamento_origem_id, lancamento_destino_id FROM transferencias WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Transferencia nao encontrada.');
  const [_, idSaida, idEntrada] = r;
  db.run('BEGIN');
  try {
    if (cascade) {
      // Apaga as baixas e os 2 lancamentos
      for (const lid of [idSaida, idEntrada]) {
        if (lid == null) continue;
        db.run('DELETE FROM baixas WHERE lancamento_id = ?', [lid]);
        // lancamento_tags tem cascade
        db.run('UPDATE itens_importacao SET lancamento_id = NULL, status = ? WHERE lancamento_id = ?', ['ignorado', lid]);
        db.run('DELETE FROM lancamentos WHERE id = ?', [lid]);
      }
    } else {
      // Apenas desvincula
      db.run('UPDATE lancamentos SET transferencia_id = NULL WHERE id IN (?, ?)', [idSaida, idEntrada]);
    }
    db.run('DELETE FROM transferencias WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade, lancamentosDesvinculados: [idSaida, idEntrada].filter(Boolean) };
}
