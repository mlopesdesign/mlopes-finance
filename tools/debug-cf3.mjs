import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from '../src/js/backend/migracoes.js';
import { criarContexto, criarConta } from '../src/js/backend/core/financeiro.js';
import { criarCustoFixo, listarCustosFixos } from '../src/js/backend/core/custosFixos.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wasmPath = path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
const schemaPath = path.join(root, 'src/js/backend/schema.sql');
const SQL = await initSqlJs({ locateFile: () => wasmPath });
const db = new SQL.Database();
db.exec(fs.readFileSync(schemaPath, 'utf8'));
migrar(db);
const cid = criarContexto(db, { nome: 'C' });
const cb = criarConta(db, { contextoId: cid, nome: 'BB', tipo: 'bancaria' });
criarCustoFixo(db, { contextoId: cid, descricao: 'Aluguel', valorCentavos: 150000, contaId: cb, diaDoMes: 10 });

const lista = listarCustosFixos(db, cid);
console.log('Lista:', JSON.stringify(lista, null, 2));
console.log('Length:', lista.length);
