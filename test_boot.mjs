// Simula o boot em Node para ver o erro
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrar } from './src/js/backend/migracoes.js';
import { abrirBancoLocal } from './src/js/backend/ambiente.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

// Mock Neutralino
const tmp = fs.mkdtempSync(path.join(root, '.tmp', 'boot-'));
globalThis.Neutralino = {
  events: { on: (_e, cb) => cb() },
  os: { getEnv: async () => tmp },
  filesystem: {
    createDirectory: async (p) => fs.mkdirSync(p, { recursive: true }),
    readBinaryFile: async (p) => fs.readFileSync(p),
    writeBinaryFile: async (p, b) => fs.writeFileSync(p, Buffer.from(b)),
    remove: async (p) => fs.rmSync(p),
    move: async (a, b) => fs.renameSync(a, b),
  },
};

const SQL = await initSqlJs({ locateFile: () => path.join(root, 'node_modules/sql.js/dist/sql-wasm.wasm') });
const schema = fs.readFileSync(path.join(root, 'src/js/backend/schema.sql'), 'utf8');

try {
  const local = await abrirBancoLocal(SQL, schema);
  console.log('abrirBancoLocal OK, arquivo:', local.arquivo);
  const versaoAntes = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  console.log('versaoAntes:', versaoAntes);
  migrar(local.db);
  const versaoDepois = Number(local.db.exec("SELECT valor FROM meta WHERE chave = 'schema_version'")[0]?.values?.[0]?.[0] ?? '0');
  console.log('versaoDepois:', versaoDepois);
  if (versaoDepois > versaoAntes) {
    await local.persistir();
    console.log('persistido');
  }
  // criar contexto via API
  const { criarApi } = await import('./src/js/backend/servidor.js');
  const api = criarApi(local.db, () => local.persistir());
  const ctx = api('contextos:criar', { nome: 'Test boot' });
  console.log('contexto criado:', ctx);
} catch (e) {
  console.error('ERRO:', e.message);
  console.error(e.stack);
}
