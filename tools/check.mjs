import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd(); const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory() && e.name !== 'node_modules') walk(p); else if (e.isFile() && p.endsWith('.js')) files.push(p); } }
walk(path.join(root, 'src')); walk(path.join(root, 'scripts')); walk(path.join(root, 'tools'));
for (const file of files) {
  const head = fs.readFileSync(file).subarray(0, 2);
  // app-recovered.js e um snapshot UTF-16 de recuperacao, nao e enviado no
  // produto. O Node nao aceita essa codificacao diretamente em --check.
  if (head[0] === 0xff && head[1] === 0xfe) {
    console.warn(`Ignorado no check sintatico (UTF-16 LE, artefato de recuperacao): ${file}`);
    continue;
  }
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); }
}
console.log(`${files.length} arquivos JavaScript passaram no node --check.`);
