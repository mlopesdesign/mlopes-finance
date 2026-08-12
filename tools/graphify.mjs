// MLopes Finance — GRAPHIFY.md generator
// Varre src/ e tools/, identifica modulos JS e tabelas SQL, gera um mapa tecnico em Markdown.
// Padrao: cada arquivo vira um no com: tipo (core/tela/vendor/sql), exports, imports, descricao inferida.
// Saida: GRAPHIFY.md na raiz do projeto.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const TOOLS = path.join(root, 'tools');
const OUT = path.join(root, 'GRAPHIFY.md');

const out = [];
const seen = new Set();

function walk(dir, type) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, type); continue; }
    if (e.name.endsWith('.js') || e.name.endsWith('.mjs')) { extractFile(p, type === 'tools' ? 'tool' : 'src'); }
    else if (e.name.endsWith('.sql')) { extractSql(p); }
  }
}

function extractFile(file, type) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (seen.has(rel)) return;
  seen.add(rel);
  const text = fs.readFileSync(file, 'utf-8');
  const exports = [...text.matchAll(/export\s+(?:async\s+)?function\s+(\w+)|export\s+const\s+(\w+)|export\s+class\s+(\w+)/g)].map(m => m[1] || m[2] || m[3]);
  const imports = [...text.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)].map(m => ({ symbols: m[1].split(',').map(s => s.trim()).filter(Boolean), from: m[2] }));
  const calls = [...text.matchAll(/api\(['"]([\w:]+)['"]/g)].map(m => m[1]);
  const desc = inferDescription(rel, exports, text);
  out.push({
    file: rel,
    type: rel.includes('vendor/') ? 'vendor' : (rel.includes('backend/core/') ? 'core' : (rel.includes('telas/') ? 'tela' : (rel.includes('backend/') ? 'backend' : (rel.includes('tools/') ? 'tool' : type)))),
    exports,
    imports,
    apiCalls: [...new Set(calls)],
    desc,
  });
}

function extractSql(file) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (seen.has(rel)) return;
  seen.add(rel);
  const text = fs.readFileSync(file, 'utf-8');
  const tables = [...text.matchAll(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/g)].map(m => m[1]);
  const indexes = [...text.matchAll(/CREATE\s+INDEX(?:\s+IF NOT EXISTS)?\s+(\w+)/g)].map(m => m[1]);
  out.push({ file: rel, type: 'sql', tables, indexes });
}

function inferDescription(file, exports, text) {
  const m = text.match(/^\/\*[\s\S]*?\*\/|^\/\/.*$/m);
  return m ? m[0].replace(/^\/\*\s*|\s*\*\/$|^\/\/\s*/g, '').split('\n')[0].trim().slice(0, 100) : '';
}

walk(SRC, 'src');
walk(TOOLS, 'tools');

const now = new Date().toISOString();
let md = `# GRAPHIFY — Mapa técnico do MLopes Finance\n\n`;
md += `> Gerado automaticamente por \`node tools/graphify.mjs\` em ${now}.\n`;
md += `> Não editar manualmente. Fonte da verdade: \`src/\` e \`tools/\`.\n\n`;

const groups = { core: [], tela: [], backend: [], sql: [], vendor: [], tool: [] };
for (const n of out) groups[n.type]?.push(n);

md += `## Resumo\n\n`;
md += `| Categoria | Quantidade |\n|---|---|\n`;
for (const k of Object.keys(groups)) md += `| ${k} | ${groups[k].length} |\n`;
md += `\nTotal: ${out.length} módulos.\n\n`;

for (const k of ['core', 'backend', 'tela', 'tool', 'sql', 'vendor']) {
  if (!groups[k].length) continue;
  md += `## ${k} (${groups[k].length})\n\n`;
  for (const n of groups[k].sort((a, b) => a.file.localeCompare(b.file))) {
    md += `### \`${n.file}\`\n\n`;
    if (n.desc) md += `${n.desc}\n\n`;
    if (n.exports?.length) md += `**Exports:** ${n.exports.map(e => '`' + e + '`').join(', ')}\n\n`;
    if (n.apiCalls?.length) md += `**API calls:** ${n.apiCalls.map(c => '`' + c + '`').join(', ')}\n\n`;
    if (n.imports?.length) md += `**Imports:** ${n.imports.map(i => `${i.symbols.join(', ')} ← \`${i.from}\``).join('; ')}\n\n`;
    if (n.tables?.length) md += `**Tabelas:** ${n.tables.map(t => '`' + t + '`').join(', ')}\n\n`;
    if (n.indexes?.length) md += `**Indices:** ${n.indexes.map(i => '`' + i + '`').join(', ')}\n\n`;
  }
}

fs.writeFileSync(OUT, md, 'utf-8');
console.log(`GRAPHIFY.md escrito: ${out.length} modulos, ${path.relative(root, OUT)}`);
