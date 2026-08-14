#!/usr/bin/env python
import subprocess
# Recupera src/js/app.js de 3cc7c34 (842 linhas) — versão multi-linha
r = subprocess.run(['git', 'show', '3cc7c34:src/js/app.js'], capture_output=True)
data = r.stdout
# Detecta BOM
has_bom = data[:3] == b'\xef\xbb\xbf'
if has_bom:
    data = data[3:]
with open('src/js/app.js', 'wb') as f:
    if has_bom:
        f.write(b'\xef\xbb\xbf')
    f.write(data)
print(f'Recuperado: {len(data)} bytes, {data.decode("utf-8").count(chr(10))} linhas')
