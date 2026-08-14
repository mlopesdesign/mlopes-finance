#!/usr/bin/env python
"""Inspeciona o banco do Marcio pra entender o que tem."""
import sqlite3
import os
import sys
from collections import Counter

db_path = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
if not os.path.exists(db_path):
    print(f"Banco NAO encontrado: {db_path}")
    sys.exit(0)
print(f"Banco: {db_path} ({os.path.getsize(db_path)} bytes)")

con = sqlite3.connect(db_path)
cur = con.cursor()

print("\n=== importacoes ===")
for r in cur.execute("SELECT id, arquivo_origem, formato, status, total_registros, total_importados, criado_em FROM importacoes ORDER BY criado_em DESC"):
    print(r)

print("\n=== cartoes ===")
for r in cur.execute("SELECT id, nome, dia_fechamento, dia_vencimento, ativo FROM cartoes"):
    print(r)

print("\n=== contas ===")
for r in cur.execute("SELECT id, nome, tipo, ativo FROM contas"):
    print(r)

print("\n=== total lancamentos ===")
cur.execute("SELECT COUNT(*) FROM lancamentos")
print(cur.fetchone()[0])

print("\n=== lancamentos de cartao (cartao_id NOT NULL) ===")
cur.execute("SELECT COUNT(*) FROM lancamentos WHERE cartao_id IS NOT NULL")
print("Total:", cur.fetchone()[0])

print("\n=== ultimos 20 lancamentos de cartao ===")
for r in cur.execute("""
  SELECT l.id, l.data_competencia, l.valor_centavos, l.descricao, c.nome
  FROM lancamentos l LEFT JOIN cartoes c ON c.id = l.cartao_id
  WHERE l.cartao_id IS NOT NULL
  ORDER BY l.data_competencia DESC LIMIT 20
"""):
    print(r)

print("\n=== descricoes mais comuns (>=2x) ===")
for r in cur.execute("""
  SELECT substr(descricao, 1, 50) as d, COUNT(*) c, MIN(valor_centavos) vmin, MAX(valor_centavos) vmax
  FROM lancamentos WHERE cartao_id IS NOT NULL
  GROUP BY substr(descricao, 1, 50) HAVING c >= 2
  ORDER BY c DESC LIMIT 25
"""):
    print(r)

print("\n=== padroes 'N/M' (possivel parcela) ===")
for r in cur.execute("""
  SELECT id, data_competencia, valor_centavos, descricao
  FROM lancamentos
  WHERE descricao GLOB '*[0-9]/[0-9]*'
     OR descricao LIKE '%parcela%'
     OR descricao LIKE '%PARCELA%'
     OR descricao LIKE '%PARC%'
  ORDER BY descricao
  LIMIT 30
"""):
    print(r)
