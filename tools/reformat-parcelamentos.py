#!/usr/bin/env python
"""Re-quebra o parcelamentos.js (que foi juntado em 1 linha pelo PowerShell Set-Content)."""
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'src/js/backend/core/parcelamentos.js'

with open(path, 'rb') as f:
    text = f.read().decode('utf-8')

# 1) export function / function NOME — quebra antes
text = re.sub(r'(?<![\w$])(export\s+function\s+\w+|\bfunction\s+\w+)', r'\n\1', text)
# 2) /**  — quebra antes
text = re.sub(r'(/\*\*)', r'\n\1', text)
# 3) */  — quebra depois
text = re.sub(r'(\*/)', r'\1\n', text)
# 4) // ate fim de linha — quebra depois
text = re.sub(r'(//[^\n]*)', r'\1\n', text)
# 5) try { catch (e) { — quebra antes
text = re.sub(r'(\btry\s*\{)', r'\n    \1', text)
text = re.sub(r'(\}\s*catch\s*\()', r'\n  \1', text)
# 6) db.run('BEGIN'); — quebra depois
text = re.sub(r"(db\.run\('(BEGIN|COMMIT|ROLLBACK)'\)\;)", r'\1\n', text)
# 7) db.run(` — quebra antes
text = re.sub(r"(db\.run\(`)", r'\n      \1', text)
# 8) return — quebra antes
text = re.sub(r'(\s)(return\s+)', r'\n  \2', text)
# 9) throw new Error — quebra antes
text = re.sub(r'(\bthrow\s+new\s+Error)', r'\n    \1', text)
# 10) if — quebra antes
text = re.sub(r'(\s)(if\s*\()', r'\n  \2', text)
# 11) db.exec(` — quebra antes
text = re.sub(r"(db\.exec\(`)", r'\n      \1', text)
# 12) const = ... ; no body — separa
text = re.sub(r'(\;)(\s*const\s)', r'\1\n  \2', text)
text = re.sub(r'(\;)(\s*let\s)', r'\1\n  \2', text)

# Remove quebras duplicadas
text = re.sub(r'\n{3,}', '\n\n', text)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print(f'Reformatado: {path}')
