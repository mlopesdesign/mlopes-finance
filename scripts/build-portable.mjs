import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const result = spawnSync(process.execPath, [path.join(root, 'tools', 'build-resources.mjs')], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const build = spawnSync(process.execPath, [path.join(root, 'node_modules', '@neutralinojs', 'neu', 'bin', 'neu.js'), 'build', '--release'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const candidates = [path.join(root, 'dist'), path.join(root, 'build')];
const found = candidates.find((p) => fs.existsSync(p));
if (!found) throw new Error('O Neutralino não gerou uma pasta de saída conhecida.');
const packageDir = path.join(found, 'MLopesFinance');
const platformExe = path.join(packageDir, 'MLopesFinance-win_x64.exe');
const commercialExe = path.join(packageDir, 'MLopesFinance.exe');
if (fs.existsSync(platformExe)) {
  fs.renameSync(platformExe, commercialExe);
}
console.log('Build portátil concluído em', found);
