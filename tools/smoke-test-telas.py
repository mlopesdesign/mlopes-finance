#!/usr/bin/env python
"""
Smoke test focado: pra cada tela, verifica se os 4 helpers criticos
(fmtData, fmtMes, money, escapeHtml) sao USADOS e se estao DEFINIDOS localmente.

Modulo ES module NAO compartilha escopo. Se a tela chama fmtData() e nao
define function fmtData(), quebra em runtime com ReferenceError.
"""
import re
import sys
from pathlib import Path

TELAS_DIR = Path('src/js/telas')
HELPERS = ['fmtData', 'fmtMes', 'fmtDataHora', 'fmtDataCurta', 'money', 'escapeHtml']

def strip_strings_and_comments(text):
    """Remove strings e comentarios pra nao contar false-positive."""
    # Remove /* ... */ e // ate fim da linha
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
    text = re.sub(r'//[^\n]*', '', text)
    # Remove strings (simples e duplas e crases)
    text = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text)
    text = re.sub(r"'(?:[^'\\]|\\.)*'", "''", text)
    text = re.sub(r'`(?:[^`\\]|\\.)*`', '``', text)
    return text

def has_call(text, name):
    """Detecta se NAME( e chamado no codigo (fora de strings/comentarios)."""
    return bool(re.search(r'\b' + re.escape(name) + r'\s*\(', text))

def has_definition(text, name):
    """Detecta se NAME e definido localmente (function NAME, const NAME=, etc)."""
    patterns = [
        r'\bfunction\s+' + re.escape(name) + r'\b',
        r'\b(?:const|let|var)\s+' + re.escape(name) + r'\s*=',
        r'\bimport\s*\{[^}]*\b' + re.escape(name) + r'\b[^}]*\}\s*from',
    ]
    for p in patterns:
        if re.search(p, text):
            return True
    return False

def main():
    if not TELAS_DIR.exists():
        print(f"ERRO: {TELAS_DIR} nao existe")
        sys.exit(1)
    print(f"=== Smoke test de TELAS: helpers criticos ===\n")
    total_erros = 0
    for f in sorted(TELAS_DIR.glob('*.js')):
        raw = f.read_text(encoding='utf-8')
        code = strip_strings_and_comments(raw)
        used = [h for h in HELPERS if has_call(code, h)]
        defined = [h for h in HELPERS if has_definition(code, h)]
        missing = [h for h in used if not has_definition(code, h)]
        # Filtra: so mostra os que sao USADOS mas nao definidos
        if missing:
            print(f"[X] {f.name}: USA mas NAO DEFINE: {missing}")
            for fn in missing:
                print(f"     - {fn}() chamada sem definicao local")
            total_erros += len(missing)
        else:
            status = "OK" if used else "(sem helpers)"
            usado_str = f" usa {used}" if used else ""
            print(f"[OK] {f.name}: {status}{usado_str}")
    print(f"\n=== TOTAL: {total_erros} erro(s) REAL(is) ===")
    sys.exit(0 if total_erros == 0 else 1)

if __name__ == '__main__':
    main()
