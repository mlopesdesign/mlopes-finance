// MLopes Finance — Palavras-chave
// v0.12.7: User cadastra palavras (ex: "Uber", "Vivo", "99") e o sistema
// busca em todos os lancamentos de DESPESA do contexto (substring
// case-insensitive em descricao). Mostra totais da semana, mes, ano
// e comparativo entre anos (grafico de barras).
//
// Diferente de recorrencias (que detecta padrao automaticamente por valor+nome
// normalizado), aqui o user CONTROLA quais palavras quer monitorar.

function exigirContextoEId(contextoId, tabela) {
  if (!Number.isInteger(contextoId)) throw new Error(`Contexto obrigatorio para ${tabela}.`);
}

function normalizarPalavra(nome) {
  return String(nome || '').trim().toLowerCase();
}

export function criarPalavraChave(db, { contextoId, nome }) {
  exigirContextoEId(contextoId, 'palavra_chave');
  const n = String(nome || '').trim();
  if (n.length < 2) throw new Error('Nome da palavra-chave deve ter pelo menos 2 caracteres.');
  if (n.length > 50) throw new Error('Nome da palavra-chave deve ter no maximo 50 caracteres.');
  try {
    db.run(`INSERT INTO palavras_chave (contexto_id, nome) VALUES (?, ?)`, [contextoId, n]);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error(`Ja existe a palavra-chave "${n}" neste contexto.`);
    throw e;
  }
  return Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
}

export function listarPalavrasChave(db, contextoId, { incluirInativas = false } = {}) {
  exigirContextoEId(contextoId, 'palavras_chave');
  const where = incluirInativas ? 'contexto_id = ?' : 'contexto_id = ? AND ativo = 1';
  return db.exec(`SELECT id, contexto_id, nome, ativo, criado_em FROM palavras_chave WHERE ${where} ORDER BY nome`, [contextoId])[0]?.values ?? [];
}

export function atualizarPalavraChave(db, id, { nome, ativo }) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const sets = [];
  const vals = [];
  if (nome != null) {
    const n = String(nome).trim();
    if (n.length < 2 || n.length > 50) throw new Error('Nome invalido.');
    sets.push('nome = ?'); vals.push(n);
  }
  if (ativo != null) { sets.push('ativo = ?'); vals.push(ativo ? 1 : 0); }
  if (!sets.length) return false;
  vals.push(id);
  try {
    db.run(`UPDATE palavras_chave SET ${sets.join(', ')} WHERE id = ?`, vals);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) throw new Error('Ja existe outra palavra-chave com esse nome neste contexto.');
    throw e;
  }
  return true;
}

/** Exclui (soft) uma palavra-chave. */
export function excluirPalavraChave(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM palavras_chave WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Palavra-chave nao encontrada.');
  if (!cascade) {
    db.run('UPDATE palavras_chave SET ativo = 0 WHERE id = ?', [id]);
    return { ok: true, id, ativo: false, soft: true };
  }
  db.run('DELETE FROM palavras_chave WHERE id = ?', [id]);
  return { ok: true, id, cascade };
}

/**
 * Busca os lancamentos de despesa que casam com a palavra (substring
 * case-insensitive em descricao). Nao filtra por data (deixa o user usar
 * { ano } se quiser).
 */
export function buscarLancamentosPorPalavra(db, contextoId, palavra, { ano = null, limite = 200 } = {}) {
  exigirContextoEId(contextoId, 'palavras_chave');
  const norm = normalizarPalavra(palavra);
  if (!norm) return [];
  // LIKE e' case-insensitive por default em sqlite pra ASCII. Acentos?
  // Nao, LIKE nao normaliza acentos. Mas pra substring simples funciona.
  const where = [
    'contexto_id = ?',
    'natureza = \'despesa\'',
    'status != \'estornado\'',
    'LOWER(descricao) LIKE ?',
  ];
  const params = [contextoId, `%${norm}%`];
  if (ano) { where.push('substr(data_competencia, 1, 4) = ?'); params.push(String(ano)); }
  const rows = db.exec(`
    SELECT id, data_competencia, valor_centavos, descricao, categoria_id, conta_id
    FROM lancamentos
    WHERE ${where.join(' AND ')}
    ORDER BY data_competencia DESC
    LIMIT ?
  `, [...params, Number(limite)])[0]?.values ?? [];
  return rows;
}

/**
 * Totais por palavra: soma na semana, mes e ano correntes.
 * Semana = ISO week (segunda a domingo) baseado no timezone UTC.
 */
export function totaisPorPalavra(db, contextoId, palavra) {
  exigirContextoEId(contextoId, 'palavras_chave');
  const norm = normalizarPalavra(palavra);
  if (!norm) return { palavra, totalSemanaCentavos: 0, totalMesCentavos: 0, totalAnoCentavos: 0, qtdLancamentos: 0 };
  const hoje = new Date();
  // Calcula inicio da semana (segunda) e fim (domingo)
  const diaSemana = hoje.getUTCDay(); // 0=domingo, 1=segunda, ..., 6=sabado
  const offsetSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  const seg = new Date(hoje); seg.setUTCDate(hoje.getUTCDate() + offsetSegunda);
  const dom = new Date(seg); dom.setUTCDate(seg.getUTCDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const segISO = fmt(seg);
  const domISO = fmt(dom);
  const mesISO = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}`;
  const anoISO = String(hoje.getUTCFullYear());
  // Total da semana
  const totSemana = Number(db.exec(`
    SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
      AND LOWER(descricao) LIKE ? AND data_competencia BETWEEN ? AND ?
  `, [contextoId, `%${norm}%`, segISO, domISO])[0]?.values?.[0]?.[0] ?? 0);
  // Total do mes
  const totMes = Number(db.exec(`
    SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
      AND LOWER(descricao) LIKE ? AND substr(data_competencia, 1, 7) = ?
  `, [contextoId, `%${norm}%`, mesISO])[0]?.values?.[0]?.[0] ?? 0);
  // Total do ano
  const totAno = Number(db.exec(`
    SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
      AND LOWER(descricao) LIKE ? AND substr(data_competencia, 1, 4) = ?
  `, [contextoId, `%${norm}%`, anoISO])[0]?.values?.[0]?.[0] ?? 0);
  // Qtd de lancamentos (todos os tempos)
  const qtd = Number(db.exec(`
    SELECT COUNT(*) FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
      AND LOWER(descricao) LIKE ?
  `, [contextoId, `%${norm}%`])[0]?.values?.[0]?.[0] ?? 0);
  return {
    palavra,
    totalSemanaCentavos: Number(totSemana),
    totalMesCentavos: Number(totMes),
    totalAnoCentavos: Number(totAno),
    qtdLancamentos: qtd,
    periodoSemana: { inicio: segISO, fim: domISO },
    periodoMes: mesISO,
    periodoAno: anoISO,
  };
}

/**
 * v0.12.9: Mini-grafico de 12 meses pra uma palavra. Retorna array de
 * { mes: 'YYYY-MM', totalCentavos, qtdLancamentos, isMesCorrente }.
 * Util pra entender a distribuicao do gasto (se ta concentrado em
 * poucos meses ou espalhado).
 */
export function ultimos12MesesPorPalavra(db, contextoId, palavra) {
  exigirContextoEId(contextoId, 'palavras_chave');
  const norm = normalizarPalavra(palavra);
  if (!norm) return [];
  const hoje = new Date();
  const meses = [];
  // Gera 12 meses: do mais antigo (mes-11) ate o corrente (mes)
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoje);
    d.setUTCMonth(d.getUTCMonth() - i);
    const aaaa = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    meses.push({ mes: `${aaaa}-${mm}`, totalCentavos: 0, qtdLancamentos: 0, isMesCorrente: i === 0 });
  }
  // Pega todos os lancamentos em 12 meses de uma vez (1 query)
  const inicio = meses[0].mes + '-01';
  // Calcula fim do mes corrente
  const fimMesAtual = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, '0')}-${String(new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, 0)).getUTCDate()).padStart(2, '0')}`;
  const rows = db.exec(`
    SELECT substr(data_competencia, 1, 7) AS mes, valor_centavos
    FROM lancamentos
    WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
      AND LOWER(descricao) LIKE ?
      AND data_competencia BETWEEN ? AND ?
  `, [contextoId, `%${norm}%`, inicio, fimMesAtual])[0]?.values ?? [];
  // Soma por mes
  const mapa = new Map(meses.map((m) => [m.mes, m]));
  for (const [mes, valor] of rows) {
    const target = mapa.get(mes);
    if (target) {
      target.totalCentavos += Number(valor);
      target.qtdLancamentos += 1;
    }
  }
  return meses;
}

/**
 * Comparativo anual: para cada palavra cadastrada, retorna o total de
 * cada ano. Usado pelo grafico de barras "Uber 2025 vs 2026".
 */
export function comparativoAnualPorPalavra(db, contextoId, { anoA = null, anoB = null } = {}) {
  exigirContextoEId(contextoId, 'palavras_chave');
  const hoje = new Date();
  const anoDefaultB = anoB || hoje.getUTCFullYear();
  const anoDefaultA = anoA || (anoDefaultB - 1);
  const palavras = listarPalavrasChave(db, contextoId);
  const out = [];
  for (const [id, contextoIdRow, nome] of palavras) {
    const totA = Number(db.exec(`
      SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
      WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
        AND LOWER(descricao) LIKE ? AND substr(data_competencia, 1, 4) = ?
    `, [contextoId, `%${normalizarPalavra(nome)}%`, String(anoDefaultA)])[0]?.values?.[0]?.[0] ?? 0);
    const totB = Number(db.exec(`
      SELECT COALESCE(SUM(valor_centavos), 0) FROM lancamentos
      WHERE contexto_id = ? AND natureza = 'despesa' AND status != 'estornado'
        AND LOWER(descricao) LIKE ? AND substr(data_competencia, 1, 4) = ?
    `, [contextoId, `%${normalizarPalavra(nome)}%`, String(anoDefaultB)])[0]?.values?.[0]?.[0] ?? 0);
    const variacaoAbs = Number(totB) - Number(totA);
    const variacaoPct = Number(totA) > 0 ? Math.round((variacaoAbs / Number(totA)) * 100) : (Number(totB) > 0 ? null : 0);
    out.push({
      id: Number(id),
      nome: String(nome),
      totalAnoACentavos: Number(totA),
      totalAnoBCentavos: Number(totB),
      variacaoAbsCentavos: variacaoAbs,
      variacaoPercentual: variacaoPct,
    });
  }
  return { anoA: anoDefaultA, anoB: anoDefaultB, palavras: out };
}
