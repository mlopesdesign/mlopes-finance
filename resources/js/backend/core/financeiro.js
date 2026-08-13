export function validarValorCentavos(valor) {
  if (!Number.isSafeInteger(valor) || valor <= 0) throw new Error('O valor deve ser um inteiro positivo em centavos.');
  return valor;
}

export function validarData(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('A data deve usar o formato YYYY-MM-DD.');
  const d = new Date(`${data}T00:00:00Z`);
  if (Number.isNaN(d.valueOf()) || d.toISOString().slice(0, 10) !== data) throw new Error('Data operacional inválida.');
  return data;
}

export function criarContexto(db, { nome, descricao = '' }) {
  if (!nome?.trim()) throw new Error('Nome do contexto é obrigatório.');
  db.run('INSERT INTO contextos_financeiros (nome, descricao) VALUES (?, ?)', [nome.trim(), descricao.trim()]);
  const id = db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
  // Seed: cria categoria padrao "Transferencia" (natureza ambas) usada pelo fluxo transferencia
  db.run('INSERT INTO categorias (contexto_id, nome, natureza) VALUES (?, ?, ?)', [id, 'Transferência interna', 'ambas']);
  return id;
}

export function listarContextos(db, incluirInativos = false) {
  const cond = incluirInativos ? '' : 'WHERE ativo = 1';
  return db.exec(`SELECT id, nome, descricao, ativo, criado_em FROM contextos_financeiros ${cond} ORDER BY ativo DESC, nome`)[0]?.values ?? [];
}

export function obterContexto(db, id) {
  if (!Number.isInteger(id)) return null;
  const rows = db.exec('SELECT id, nome, descricao, ativo, criado_em FROM contextos_financeiros WHERE id = ?', [id])[0]?.values ?? [];
  return rows[0] || null;
}

export function atualizarContexto(db, { id, nome, descricao }) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const ctx = obterContexto(db, id);
  if (!ctx) throw new Error('Contexto nao encontrado.');
  const novoNome = (nome ?? ctx[1]).trim();
  const novaDescricao = (descricao ?? ctx[2]).trim();
  if (!novoNome) throw new Error('Nome do contexto nao pode ser vazio.');
  db.run('UPDATE contextos_financeiros SET nome = ?, descricao = ? WHERE id = ?', [novoNome, novaDescricao, id]);
  return id;
}

export function alternarContextoAtivo(db, id) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const ctx = obterContexto(db, id);
  if (!ctx) throw new Error('Contexto nao encontrado.');
  const novoAtivo = ctx[3] ? 0 : 1;
  db.run('UPDATE contextos_financeiros SET ativo = ? WHERE id = ?', [novoAtivo, id]);
  return novoAtivo === 1;
}

/** Retorna saldos agregados do contexto: total receitas, despesas, contas, clientes, etc. */
export function resumoContexto(db, contextoId) {
  if (!Number.isInteger(contextoId)) return null;
  const out = { contextoId };
  const rec = db.exec('SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE contexto_id = ? AND natureza = ? AND status != ?', [contextoId, 'receita', 'estornado'])[0]?.values?.[0]?.[0] ?? 0;
  const desp = db.exec('SELECT COALESCE(SUM(valor_centavos),0) FROM lancamentos WHERE contexto_id = ? AND natureza = ? AND status != ?', [contextoId, 'despesa', 'estornado'])[0]?.values?.[0]?.[0] ?? 0;
  out.receitas = Number(rec);
  out.despesas = Number(desp);
  out.saldo = out.receitas - out.despesas;
  out.lancamentos = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE contexto_id = ?', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.contas = Number(db.exec('SELECT COUNT(*) FROM contas WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.clientes = Number(db.exec('SELECT COUNT(*) FROM clientes WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  out.projetos = Number(db.exec('SELECT COUNT(*) FROM projetos WHERE contexto_id = ? AND ativo = 1', [contextoId])[0]?.values?.[0]?.[0] ?? 0);
  return out;
}

export function criarConta(db, { contextoId, nome, tipo = 'bancaria', saldoInicialCentavos = 0 }) {
  if (!Number.isInteger(contextoId)) throw new Error('Contexto financeiro é obrigatório.');
  if (!nome?.trim()) throw new Error('Nome da conta é obrigatório.');
  if (!['bancaria', 'cartao', 'investimento'].includes(tipo)) throw new Error('Tipo de conta inválido.');
  if (!Number.isSafeInteger(saldoInicialCentavos)) throw new Error('Saldo inicial deve estar em centavos.');
  db.run('INSERT INTO contas (contexto_id, nome, tipo, saldo_inicial_centavos) VALUES (?, ?, ?, ?)', [contextoId, nome.trim(), tipo, saldoInicialCentavos]);
  return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
}

export function atualizarConta(db, { id, nome, tipo, saldoInicialCentavos }) {
  if (!Number.isInteger(id)) throw new Error('ID da conta é obrigatório.');
  if (nome != null) {
    if (!String(nome).trim()) throw new Error('Nome da conta é obrigatório.');
    db.run('UPDATE contas SET nome = ? WHERE id = ?', [String(nome).trim(), id]);
  }
  if (tipo != null) {
    if (!['bancaria', 'cartao', 'investimento'].includes(tipo)) throw new Error('Tipo de conta inválido.');
    db.run('UPDATE contas SET tipo = ? WHERE id = ?', [tipo, id]);
  }
  if (saldoInicialCentavos != null) {
    if (!Number.isSafeInteger(saldoInicialCentavos)) throw new Error('Saldo inicial deve estar em centavos.');
    db.run('UPDATE contas SET saldo_inicial_centavos = ? WHERE id = ?', [saldoInicialCentavos, id]);
  }
  return true;
}

export function criarCategoria(db, { contextoId, nome, natureza = 'ambas' }) {
  if (!Number.isInteger(contextoId) || !nome?.trim()) throw new Error('Contexto e nome da categoria são obrigatórios.');
  if (!['receita', 'despesa', 'ambas'].includes(natureza)) throw new Error('Natureza inválida.');
  db.run('INSERT INTO categorias (contexto_id, nome, natureza) VALUES (?, ?, ?)', [contextoId, nome.trim(), natureza]);
  return db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];
}

export function atualizarCategoria(db, { id, nome, natureza }) {
  if (!Number.isInteger(id)) throw new Error('ID da categoria é obrigatório.');
  if (nome != null) {
    if (!String(nome).trim()) throw new Error('Nome da categoria é obrigatório.');
    db.run('UPDATE categorias SET nome = ? WHERE id = ?', [String(nome).trim(), id]);
  }
  if (natureza != null) {
    if (!['receita', 'despesa', 'ambas'].includes(natureza)) throw new Error('Natureza inválida.');
    db.run('UPDATE categorias SET natureza = ? WHERE id = ?', [natureza, id]);
  }
  return true;
}

// === EXCLUSAO ===
// Regra: por padrao, bloqueia exclusao se houver dependencias (lancamentos, etc).
// A flag `cascade: true` apaga em cascata, na ordem correta, dentro de uma
// transacao. Usado pela UI quando o usuario confirma a exclusao destrutiva.

// Lista as dependencias de um contexto (o que impede excluir limpo).
// Ignora a categoria "Transferencia interna" (seed automatico do criarContexto)
// porque ela e' recriada em qualquer novo contexto — nao conta como dado do user.
function _dependenciasContexto(db, id) {
  const tabelas = [
    ['contas', 'contas'],
    ['lancamentos', 'lancamentos'],
    ['clientes', 'clientes'],
    ['fornecedores', 'fornecedores'],
    ['projetos', 'projetos'],
    ['centros_custo', 'centros de custo'],
    ['tags', 'tags'],
    ['cartoes', 'cartoes'],
    ['transferencias', 'transferencias'],
    ['importacoes', 'importacoes'],
    ['anexos', 'anexos'],
    ['conciliacoes', 'conciliacoes'],
  ];
  const achados = [];
  for (const [t, label] of tabelas) {
    const n = Number(db.exec(`SELECT COUNT(*) FROM ${t} WHERE contexto_id = ?`, [id])[0]?.values?.[0]?.[0] ?? 0);
    if (n > 0) achados.push({ tabela: t, label, total: n });
  }
  // Categoria: conta quantas NAO-seed
  const catNaoSeed = Number(db.exec(
    `SELECT COUNT(*) FROM categorias WHERE contexto_id = ? AND nome != ? AND natureza = ?`,
    [id, 'Transferência interna', 'ambas']
  )[0]?.values?.[0]?.[0] ?? 0);
  if (catNaoSeed > 0) achados.push({ tabela: 'categorias', label: 'categorias (excluindo seed)', total: catNaoSeed });
  return achados;
}

export function excluirContexto(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const ctx = obterContexto(db, id);
  if (!ctx) throw new Error('Contexto nao encontrado.');
  const deps = _dependenciasContexto(db, id);
  if (deps.length > 0 && !cascade) {
    const resumo = deps.map((d) => `${d.total} ${d.label}`).join(', ');
    throw new Error(`Contexto tem dados vinculados: ${resumo}. Use cascade:true para excluir tudo.`);
  }
  db.run('BEGIN');
  try {
    if (cascade) {
      // Ordem importa por causa das FKs
      // 1. limpar referencias circulares (lancamentos, recorrencias template)
      db.run('DELETE FROM conciliacoes WHERE contexto_id = ?', [id]);
      db.run('DELETE FROM anexos WHERE contexto_id = ?', [id]);
      db.run('DELETE FROM importacoes WHERE contexto_id = ?', [id]);
      // transferencias: nao tem FK cascade dos lancamentos, entao apaga primeiro
      db.run('DELETE FROM transferencias WHERE contexto_id = ?', [id]);
      // limpar lancamento.transferencia_id orfaos
      db.run(`UPDATE lancamentos SET transferencia_id = NULL WHERE contexto_id = ? AND transferencia_id IS NOT NULL`, [id]);
      // recorrencias (template lancamento fica orfao, mas o lancamento em si e' do contexto)
      db.run('DELETE FROM recorrencias WHERE contexto_id = ?', [id]);
      // cartoes: tem faturas (cascade via cartao_id? NAO, faturas nao tem cascade). Apaga faturas primeiro.
      db.run('DELETE FROM faturas WHERE cartao_id IN (SELECT id FROM cartoes WHERE contexto_id = ?)', [id]);
      db.run('DELETE FROM cartoes WHERE contexto_id = ?', [id]);
      // tags: cascade via tag_id
      db.run('DELETE FROM tags WHERE contexto_id = ?', [id]);
      // clientes: nao tem cascade de projetos/lancamentos
      db.run('UPDATE lancamentos SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE contexto_id = ?)', [id]);
      db.run('UPDATE projetos SET cliente_id = NULL WHERE cliente_id IN (SELECT id FROM clientes WHERE contexto_id = ?)', [id]);
      db.run('DELETE FROM clientes WHERE contexto_id = ?', [id]);
      // fornecedores, projetos, centros_custo, categorias: sem filhos problematicos
      db.run('DELETE FROM fornecedores WHERE contexto_id = ?', [id]);
      db.run('DELETE FROM centros_custo WHERE contexto_id = ?', [id]);
      // projetos: lancamentos.projeto_id vira NULL (sem cascade)
      db.run('UPDATE lancamentos SET projeto_id = NULL WHERE projeto_id IN (SELECT id FROM projetos WHERE contexto_id = ?)', [id]);
      db.run('DELETE FROM projetos WHERE contexto_id = ?', [id]);
      // categorias (incluindo a seed "Transferencia interna")
      db.run('UPDATE lancamentos SET categoria_id = NULL WHERE categoria_id IN (SELECT id FROM categorias WHERE contexto_id = ?)', [id]);
      db.run('DELETE FROM categorias WHERE contexto_id = ?', [id]);
      // centros_custo
      db.run('UPDATE lancamentos SET centro_custo_id = NULL WHERE centro_custo_id IN (SELECT id FROM centros_custo WHERE contexto_id = ?)', [id]);
      // (centros_custo ja deletado acima)
      // contas: lancamentos.conta_id e cartoes.conta_pagamento_id
      db.run('UPDATE cartoes SET conta_pagamento_id = NULL WHERE conta_pagamento_id IN (SELECT id FROM contas WHERE contexto_id = ?)', [id]);
      db.run('DELETE FROM lancamentos WHERE contexto_id = ?', [id]); // cascade: baixas, lancamento_tags
      db.run('DELETE FROM contas WHERE contexto_id = ?', [id]);
    } else {
      // Sem cascade: apaga APENAS a categoria seed (Transferencia interna, ambas).
      // Ela e' recriada em qualquer novo contexto, nao conta como dado do usuario.
      // Sem isso, o DELETE do contexto falha por FK da categoria apontar pro contexto.
      db.run('DELETE FROM categorias WHERE contexto_id = ? AND nome = ? AND natureza = ?',
        [id, 'Transferência interna', 'ambas']);
    }
    db.run('DELETE FROM contextos_financeiros WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade, dependenciasRemovidas: deps.map((d) => d.tabela) };
}

function _dependenciasConta(db, id) {
  const lancs = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE conta_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  const faturas = Number(db.exec('SELECT COUNT(*) FROM cartoes WHERE conta_pagamento_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  const achados = [];
  if (lancs > 0) achados.push({ tabela: 'lancamentos', label: 'lancamentos', total: lancs });
  if (faturas > 0) achados.push({ tabela: 'cartoes', label: 'cartoes usando como pagamento', total: faturas });
  return achados;
}

export function excluirConta(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, contexto_id, nome FROM contas WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Conta nao encontrada.');
  const deps = _dependenciasConta(db, id);
  if (deps.length > 0 && !cascade) {
    throw new Error(`Conta "${r[2]}" tem dados vinculados: ${deps.map((d) => `${d.total} ${d.label}`).join(', ')}.`);
  }
  db.run('BEGIN');
  try {
    if (cascade) {
      db.run('DELETE FROM lancamentos WHERE conta_id = ?', [id]);
      db.run('UPDATE cartoes SET conta_pagamento_id = NULL WHERE conta_pagamento_id = ?', [id]);
    }
    db.run('DELETE FROM contas WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade };
}

function _dependenciasCategoria(db, id) {
  const n = Number(db.exec('SELECT COUNT(*) FROM lancamentos WHERE categoria_id = ?', [id])[0]?.values?.[0]?.[0] ?? 0);
  return n > 0 ? [{ tabela: 'lancamentos', label: 'lancamentos', total: n }] : [];
}

export function excluirCategoria(db, id, { cascade = false } = {}) {
  if (!Number.isInteger(id)) throw new Error('id obrigatorio.');
  const r = db.exec('SELECT id, nome FROM categorias WHERE id = ?', [id])[0]?.values?.[0];
  if (!r) throw new Error('Categoria nao encontrada.');
  const deps = _dependenciasCategoria(db, id);
  if (deps.length > 0 && !cascade) {
    throw new Error(`Categoria "${r[1]}" tem ${deps[0].total} lancamento(s) vinculado(s).`);
  }
  db.run('BEGIN');
  try {
    if (cascade) db.run('UPDATE lancamentos SET categoria_id = NULL WHERE categoria_id = ?', [id]);
    db.run('DELETE FROM categorias WHERE id = ?', [id]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return { ok: true, id, cascade };
}
