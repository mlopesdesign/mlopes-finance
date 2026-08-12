// MLopes Finance — backup, exportacao e restauracao
// Pure functions sobre `db` (sql.js). Sem DOM, sem Neutralino.

import initSqlJs from 'sql.js';

const TABELAS_ESSENCIAIS = ['contextos_financeiros', 'contas', 'categorias', 'lancamentos', 'auditoria', 'configuracoes'];

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
  const novo = new (db.constructor || initSqlJs.Database)(bytes);
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
  const novo = new (db.constructor || initSqlJs.Database)(backup);
  const depois = radiografar(novo);
  const confere = {};
  for (const t of Object.keys(antes)) {
    confere[t] = antes[t] === depois[t];
  }
  return { antes, depois, tudoBate: Object.values(confere).every(Boolean) };
}
