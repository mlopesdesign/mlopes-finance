// Debug: testar criarCustoFixo isolado
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
console.log('cid:', cid, 'cb:', cb);
console.log('contas:', db.exec('SELECT * FROM contas').length);

const r = criarCustoFixo(db, { contextoId: cid, descricao: 'Aluguel', valorCentavos: 150000, contaId: cb, diaDoMes: 10 });
console.log('Resultado:', r);

console.log('Lancamentos:');
for (const l of db.exec('SELECT id, descricao, valor_centavos, natureza FROM lancamentos')) {
  console.log(' ', l);
}
console.log('Recorrencias:');
for (const re of db.exec('SELECT * FROM recorrencias')) {
  console.log(' ', re);
}

const lista = listarCustosFixos(db, cid);
console.log('Lista custos fixos:', lista);
