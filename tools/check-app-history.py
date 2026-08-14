#!/usr/bin/env python
import subprocess
result = subprocess.run(['git', 'log', '--oneline', '--all', '--', 'src/js/app.js'], capture_output=True, text=True)
commits = [l.split()[0] for l in result.stdout.strip().split('\n')][:20]
for c in commits:
    r = subprocess.run(['git', 'show', f'{c}:src/js/app.js'], capture_output=True, text=True, encoding='utf-8', errors='ignore')
    if r.stdout is None:
        print(f'{c}: ERRO')
        continue
    lines = r.stdout.count('\n')
    print(f'{c}: {lines} linhas')
