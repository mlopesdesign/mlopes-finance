import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const required = ['MLopesFinance.exe', 'resources.neu'];
const dir = path.join(root, 'dist', 'MLopesFinance');
if (!fs.existsSync(dir)) throw new Error(`Saída instalada não encontrada: ${dir}`);
for (const file of required) if (!fs.existsSync(path.join(dir, file))) throw new Error(`Arquivo obrigatório ausente: ${file}`);
console.log('Conteúdo mínimo do pacote validado:', required.join(', '));
