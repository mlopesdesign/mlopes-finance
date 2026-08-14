// Debug: cria um banco via novoBanco e checa colunas de lancamentos
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from '../src/js/backend/migracoes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const schemaPath = path.join(root, 'src/js/backend/schema.sql');

const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database();
db.exec(fs.readFileSync(schemaPath, 'utf8'));
migrar(db);

const cols = db.exec("PRAGMA table_info(lancamentos)")[0].values;
console.log('COLUNAS DE lancamentos:');
for (const c of cols) console.log('  ', c[1], '(notnull:', c[3] + ')');
console.log('Total colunas:', cols.length);
console.log('schema_version:', db.exec("SELECT valor FROM meta WHERE chave='schema_version'")[0].values[0][0]);
