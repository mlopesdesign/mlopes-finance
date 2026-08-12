"""Normaliza encoding de todos os arquivos fonte pra UTF-8 sem BOM (exceto .exe/.png/.wasm/.ico/.zip).
   Re-grava arquivos in-place. Garante que o source é UTF-8 válido antes de salvar.
"""
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
EXTENSOES = {'.html', '.js', '.mjs', '.css', '.sql', '.json', '.md', '.txt', '.iss', '.tsv', '.csv', '.xml', '.svg'}
EXCLUIR_DIRS = {'node_modules', 'dist', 'release', 'bin', '.git', '.tmp', '.graphify-out', 'graphify-out', 'graphify_cache', '__pycache__'}

contador = {'ok': 0, 're-escritos': 0, 'invalidos': 0, 'sem-bom': 0}
problemas = []

def normalize(path: Path) -> None:
    try:
        raw = path.read_bytes()
    except Exception as e:
        problemas.append(f'{path}: erro de leitura {e}')
        return
    # Detecta e remove BOM UTF-8
    had_bom = raw.startswith(b'\xef\xbb\xbf')
    if had_bom:
        raw = raw[3:]
        contador['sem-bom'] += 1
    # Valida como UTF-8
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError as e:
        contador['invalidos'] += 1
        problemas.append(f'{path}: UTF-8 invalido - {e}')
        return
    # Re-grava SEM BOM, com \n consistente (LF)
    # Mantem CRLF se tinha (detecta a partir do original)
    if b'\r\n' in raw[:1024]:
        text = text.replace('\r\n', '\n').replace('\n', '\r\n')  # preserva CRLF no final
    path.write_bytes(text.encode('utf-8'))
    contador['re-escritos'] += 1
    contador['ok'] += 1

for dirpath, dirnames, filenames in os.walk(ROOT):
    # Filtra dirs excluidos in-place
    dirnames[:] = [d for d in dirnames if d not in EXCLUIR_DIRS]
    for fn in filenames:
        p = Path(dirpath) / fn
        if p.suffix.lower() in EXTENSOES:
            normalize(p)

print('=== RESULTADO ===')
for k, v in contador.items():
    print(f'  {k}: {v}')
if problemas:
    print('\n=== PROBLEMAS ===')
    for p in problemas[:50]:
        print(f'  {p}')
    if len(problemas) > 50:
        print(f'  ... +{len(problemas)-50} mais')
else:
    print('\nNenhum problema de encoding detectado.')
