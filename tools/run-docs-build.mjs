import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const userProfile = process.env.USERPROFILE || '';
const bundledPython = path.join(userProfile, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const candidates = [process.env.PYTHON, existsSync(bundledPython) ? bundledPython : null, 'python'].filter(Boolean);

let lastError;
for (const python of candidates) {
  try {
    execFileSync(python, ['tools/build-docs.py'], { cwd: root, stdio: 'inherit' });
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

console.error('Não foi possível encontrar um Python com reportlab instalado.');
console.error('Instale reportlab no Python usado pelo projeto e execute novamente: npm run docs:build');
process.exit(lastError?.status || 1);
