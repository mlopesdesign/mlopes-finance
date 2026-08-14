#!/usr/bin/env python
"""Bump de versao SEGURO: faz a troca sem juntar quebras de linha."""
import sys

if len(sys.argv) < 3:
    print("Uso: python bump-version-safe.py <arquivo> <de> <para>")
    sys.exit(1)

path = sys.argv[1]
de = sys.argv[2]
para = sys.argv[3]

with open(path, 'rb') as f:
    raw = f.read()

# Detecta BOM
has_bom = raw[:3] == b'\xef\xbb\xbf'
content = raw[3:] if has_bom else raw

text = content.decode('utf-8')
new_text = text.replace(de, para)

if text == new_text:
    print(f"  Nenhuma mudanca em {path}")
    sys.exit(0)

# Escreve SEM BOM
with open(path, 'wb') as f:
    if has_bom:
        f.write(b'\xef\xbb\xbf')
    f.write(new_text.encode('utf-8'))

print(f"  OK: {path} ({de} -> {para})")
