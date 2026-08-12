import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export async function abrirBanco({ arquivo, wasmPath = path.resolve(root, '../../../../node_modules/sql.js/dist/sql-wasm.wasm') } = {}) {
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const existe = arquivo && fs.existsSync(arquivo);
  const db = new SQL.Database(existe ? new Uint8Array(fs.readFileSync(arquivo)) : undefined);
  if (!existe) db.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
  return db;
}

export function salvarBancoSeguro(db, arquivo) {
  const dir = path.dirname(arquivo); fs.mkdirSync(dir, { recursive: true });
  const tmp = `${arquivo}.tmp`; const old = `${arquivo}.old`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  if (fs.existsSync(old)) fs.rmSync(old);
  if (fs.existsSync(arquivo)) fs.renameSync(arquivo, old);
  fs.renameSync(tmp, arquivo);
  if (fs.existsSync(old)) fs.rmSync(old);
}
