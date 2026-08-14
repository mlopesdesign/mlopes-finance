#!/usr/bin/env python
"""Re-quebra src/js/app.js que o PowerShell juntou em 1 linha."""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'src/js/app.js'

with open(path, 'rb') as f:
    raw = f.read()

# Detecta BOM
has_bom = raw[:3] == b'\xef\xbb\xbf'
text = raw[3:].decode('utf-8') if has_bom else raw.decode('utf-8')

# Insere quebra de linha ANTES de cada statement top-level
# Cuidado pra nao quebrar dentro de template strings

# 1) Quebra antes de import / export function / function
text = re.sub(r'(?<![\w$])import\s+', r'\nimport ', text)
text = re.sub(r'(?<![\w$])export\s+function\s+(\w+)', r'\nexport function \1', text)
text = re.sub(r'(?<![\w$])function\s+(\w+)', r'\nfunction \1', text)
text = re.sub(r'(?<![\w$])const\s+([A-Z_]\w*)\s*=', r'\nconst \1 =', text)
text = re.sub(r'(?<![\w$])const\s+(\w+)\s*=\s*\(', r'\nconst \1 = (', text)
text = re.sub(r'(?<![\w$])let\s+(\w+)', r'\nlet \1', text)

# 2) Remove duplicadas
text = re.sub(r'\n{3,}', '\n\n', text)

with open(path, 'wb') as f:
    if has_bom:
        f.write(b'\xef\xbb\xbf')
    f.write(text.encode('utf-8'))

print(f'Reformatado: {path}')
