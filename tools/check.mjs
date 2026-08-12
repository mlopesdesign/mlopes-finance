import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd(); const files = [];
function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory() && e.name !== 'node_modules') walk(p); else if (e.isFile() && p.endsWith('.js')) files.push(p); } }
walk(path.join(root, 'src')); walk(path.join(root, 'scripts')); walk(path.join(root, 'tools'));
for (const file of files) { const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (r.status !== 0) { console.error(r.stderr); process.exit(r.status ?? 1); } }
console.log(`${files.length} arquivos JavaScript passaram no node --check.`);
