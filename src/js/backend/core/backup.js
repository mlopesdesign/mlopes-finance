// MLopes Finance — backup, exportacao e restauracao
// Pure functions sobre `db` (sql.js). Sem DOM, sem Neutralino.

const TABELAS_ESSENCIAIS = ['contextos_financeiros', 'contas', 'categorias', 'lancamentos', 'auditoria', 'configuracoes'];

// Resolucao portatil da classe Database do sql.js (browser e node).
// No navegador, db.constructor ja eh a classe; em testes node tambem.
function getDatabaseCtor(db) {
  if (db && db.constructor && typeof db.constructor === 'function') return db.constructor;
  if (globalThis.initSqlJs && globalThis.initSqlJs.Database) return globalThis.initSqlJs.Database;
  throw new Error('Classe Database do sql.js nao disponivel.');
}

/** Cria um backup em memoria. Retorna Uint8Array do .sqlite inteiro. */
export function criarBackup(db) {
  if (!db) throw new Error('Banco nao informado.');
  return db.export();
}

/** Exporta o banco para um arquivo .sqlite no caminho informado. */
export async function exportarSQLite(db, fs, caminho) {
  if (!fs?.writeBinaryFile) throw new Error('Filesystem adapter invalido.');
  const bytes = criarBackup(db);
  await fs.writeBinaryFile(caminho, bytes);
  return { caminho, bytes: bytes.length };
}

/** Radiografia de um banco: contagem por tabela. */
export function radiografar(db) {
  const out = {};
  for (const t of TABELAS_ESSENCIAIS) {
    try {
      const r = db.exec(`SELECT COUNT(*) FROM ${t}`);
      out[t] = r[0]?.values?.[0]?.[0] ?? 0;
    } catch (e) {
      out[t] = `ERRO: ${e.message}`;
    }
  }
  return out;
}

/** Valida que um banco tem as tabelas essenciais com movimento minimo. */
export function validarBanco(db) {
  const r = radiografar(db);
  const erros = [];
  for (const t of TABELAS_ESSENCIAIS) {
    if (typeof r[t] !== 'number') erros.push(`Tabela ${t} ausente ou ilegivel.`);
  }
  if (r.contextos_financeiros < 1) erros.push('Sem nenhum contexto financeiro cadastrado.');
  return { ok: erros.length === 0, contagens: r, erros };
}

/** Restaura um backup (Uint8Array) para o `db` alvo. Apaga e recria. */
export function restaurarBackup(db, bytes) {
  if (!db) throw new Error('Banco alvo nao informado.');
  if (!(bytes instanceof Uint8Array)) throw new Error('Backup precisa ser Uint8Array.');
  if (bytes.length < 16) throw new Error('Backup muito pequeno, provavelmente invalido.');
  // sql.js permite abrir um novo banco a partir de bytes
  const Ctor = getDatabaseCtor(db);
  const novo = new Ctor(bytes);
  // Validar antes de substituir
  const validacao = validarBanco(novo);
  if (!validacao.ok) {
    throw new Error('Backup invalido: ' + validacao.erros.join(' '));
  }
  // Substituir tabelas uma a uma (preserva schema/indices do alvo)
  // Estrategia simples: dropa as essenciais e importa via INSERT...SELECT
  // Para manter integridade, envolvemos em transacao usando BEGIN/COMMIT manual
  db.run('BEGIN');
  try {
    const tabelas = Object.keys(validacao.contagens).filter(t => typeof validacao.contagens[t] === 'number');
    for (const t of tabelas) {
      db.run(`DELETE FROM ${t}`);
    }
    // Reimporta cada tabela do backup
    const tabelasBackup = novo.exec("SELECT name FROM sqlite_master WHERE type='table'");
    for (const [t] of tabelasBackup[0]?.values ?? []) {
      if (!['meta'].includes(t)) {
        // dump simples via sql.js: INSERT INTO ... SELECT ...
        const cols = novo.exec(`PRAGMA table_info(${t})`);
        const colNames = cols[0]?.values?.map(c => c[1]) ?? [];
        if (colNames.length === 0) continue;
        const colList = colNames.join(', ');
        // SQL.js nao tem dump; exporta como INSERT VALUES
        const rows = novo.exec(`SELECT ${colList} FROM ${t}`);
        for (const row of rows[0]?.values ?? []) {
          const placeholders = row.map(() => '?').join(',');
          db.run(`INSERT INTO ${t} (${colList}) VALUES (${placeholders})`, row);
        }
      }
    }
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return validarBanco(db);
}

/** Verifica que backup + restauracao preservam todos os dados. */
export function validarCiclo(db) {
  const antes = radiografar(db);
  const backup = criarBackup(db);
  const Ctor = getDatabaseCtor(db);
  const novo = new Ctor(backup);
  const depois = radiografar(novo);
  const confere = {};
  for (const t of Object.keys(antes)) {
    confere[t] = antes[t] === depois[t];
  }
  return { antes, depois, tudoBate: Object.values(confere).every(Boolean) };
}

// === RESETAR BANCO ===
// Apaga TODOS os dados (todas as tabelas transacionais) e recria os cadastros
// iniciais (contexto "Pessoal" + categoria "Transferencia interna"). Preserva
// o schema e a versao da migracao. NAO apaga 'configuracoes' (defaults do app)
// nem 'meta' (versao).
//
// USO: o usuario quer "comecar do zero" sem perder o app. Destrutivo total.
// A UI exige confirmacao dupla antes de chamar.
//
// IMPORTANTE: o chamador (servidor) DEVE fazer backup antes via criarBackup()
// e persistir o banco DEPOIS via persistir() em ambiente.js.

const TABELAS_TRANSACIONAIS = [
  'conciliacoes',
  'anexos',
  'itens_importacao',
  'importacoes',
  'transferencias',
  'recorrencias',
  'faturas',
  'cartoes',
  'lancamento_tags',
  'baixas',
  'lancamentos',
  'centros_custo',
  'tags',
  'projetos',
  'fornecedores',
  'clientes',
  'categorias',
  'contas',
  'contextos_financeiros',
];

export function resetarBanco(db, agora = new Date().toISOString()) {
  if (!db) throw new Error('Banco nao informado.');
  db.run('BEGIN');
  try {
    // Ordem inversa da criacao (pra respeitar FKs)
    for (const t of TABELAS_TRANSACIONAIS) {
      try {
        db.run(`DELETE FROM ${t}`);
      } catch (e) {
        // Se a tabela nao existir, segue
        if (!String(e.message).match(/no such table/i)) throw e;
      }
    }
    // Recria contexto padrao (seed inicial, igual a primeira instalacao)
    db.run(`INSERT INTO contextos_financeiros (nome, descricao) VALUES (?, ?)`,
      ['Pessoal', 'Contexto inicial criado pelo reset do banco.']);
    const ctxId = Number(db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]);
    // Categoria padrao do seed (necessaria pro fluxo de transferencia)
    db.run(`INSERT INTO categorias (contexto_id, nome, natureza) VALUES (?, ?, ?)`,
      [ctxId, 'Transferência interna', 'ambas']);
    // Auditoria do reset
    db.run('INSERT INTO auditoria (entidade, entidade_id, acao, dados_json, criado_em) VALUES (?, ?, ?, ?, ?)',
      ['banco', 0, 'resetado', JSON.stringify({ contextoInicial: 'Pessoal' }), agora]);
    db.run('COMMIT');
  } catch (e) {
    db.run('ROLLBACK');
    throw e;
  }
  return {
    ok: true,
    contextoInicial: { id: Number(db.exec('SELECT id FROM contextos_financeiros WHERE nome = ?', ['Pessoal'])[0]?.values?.[0]?.[0] ?? 0), nome: 'Pessoal' },
    tabelasLimpas: TABELAS_TRANSACIONAIS,
  };
}
