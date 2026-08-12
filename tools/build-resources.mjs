import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resource = path.join(root, 'resources');
fs.rmSync(resource, { recursive: true, force: true });
fs.cpSync(path.join(root, 'src'), resource, { recursive: true });
fs.mkdirSync(path.join(resource, 'js', 'vendor'), { recursive: true });
fs.copyFileSync(path.join(root, 'neutralino.js'), path.join(resource, 'js', 'vendor', 'neutralino.js'));
fs.copyFileSync(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.js'), path.join(resource, 'js', 'vendor', 'sql-wasm.js'));
fs.copyFileSync(path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'), path.join(resource, 'js', 'vendor', 'sql-wasm.wasm'));
fs.mkdirSync(path.join(resource, 'icons'), { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'icons', 'appIcon.ico'), path.join(resource, 'icons', 'appIcon.ico'));
fs.copyFileSync(path.join(root, 'src', 'icons', 'appIcon.png'), path.join(resource, 'icons', 'appIcon.png'));
// Imagens extras (logo, favicon) usadas no header
if (fs.existsSync(path.join(root, 'images'))) {
  fs.mkdirSync(path.join(resource, 'images'), { recursive: true });
  for (const f of fs.readdirSync(path.join(root, 'images'))) {
    fs.copyFileSync(path.join(root, 'images', f), path.join(resource, 'images', f));
  }
}
console.log('Resources preparados:', resource);
