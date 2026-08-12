// Testa a migracao do zero manualmente
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from './src/js/backend/migracoes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') });
const db = new SQL.Database();
const schema = fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8');
db.exec(schema);
console.log('After schema.sql:');
for (const r of db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")) {
  console.log(' ', r.values[0][0]);
}
console.log('meta:', db.exec("SELECT * FROM meta").length === 0 ? 'vazia' : 'tem dados');

const v = migrar(db);
console.log('migrar returned:', v);
console.log('After migrar:');
for (const r of db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")) {
  console.log(' ', r.values[0][0]);
}
console.log('schema_version:', db.exec("SELECT valor FROM meta WHERE chave='schema_version'")[0].values[0][0]);
console.log('contagem clientes:', db.exec('SELECT COUNT(*) FROM clientes').length);
console.log('contagem cartoes:', db.exec('SELECT COUNT(*) FROM cartoes').length);
console.log('contagem transferencias:', db.exec('SELECT COUNT(*) FROM transferencias').length);
console.log('contagem recorrencias:', db.exec('SELECT COUNT(*) FROM recorrencias').length);
