#!/usr/bin/env python
"""Debug: quantos candidatos o regex esta achando no banco do Marcio?"""
import sqlite3
import re
import os
from collections import Counter, defaultdict

db_path = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
if not os.path.exists(db_path):
    print(f"Banco NAO encontrado: {db_path}")
    exit(0)
con = sqlite3.connect(db_path)
cur = con.cursor()

# Pega todos os lancamentos de cartao com "Parcela" na descricao
cur.execute("""
    SELECT l.id, l.data_competencia, l.valor_centavos, l.descricao, c.nome
    FROM lancamentos l LEFT JOIN cartoes c ON c.id = l.cartao_id
    WHERE l.cartao_id IS NOT NULL
      AND l.descricao LIKE '%Parcela %'
    ORDER BY c.nome, l.descricao
""")
rows = cur.fetchall()
print(f"Total lancamentos com 'Parcela': {len(rows)}")

# Regex
re_parcela = re.compile(r'^(.+?)\s*-\s*[Pp]arcela\s+(\d+)\s*\/\s*(\d+)\s*$')

# Agrupa por cartao
por_cartao = defaultdict(list)
sem_match = []
for id_, data, valor, desc, cartao in rows:
    m = re_parcela.match(desc.strip())
    if not m:
        sem_match.append((cartao, desc))
        continue
    por_cartao[cartao].append({
        'id': id_, 'data': data, 'valor': valor, 'desc': desc,
        'nome': m.group(1).strip(), 'num': int(m.group(2)), 'total': int(m.group(3))
    })

print(f"\nPor cartao:")
for cartao, items in por_cartao.items():
    print(f"  {cartao}: {len(items)} lancamentos")

# Agrupa por (nome, total)
grupos = defaultdict(list)
for cartao, items in por_cartao.items():
    for it in items:
        chave = (it['nome'].lower(), it['total'])
        grupos[chave].append({**it, 'cartao': cartao})

print(f"\nTotal grupos (nome+total): {len(grupos)}")
print("\nGrupos com mais de 1 cartao (suspeito de bug):")
for chave, items in grupos.items():
    cartoes = set(it['cartao'] for it in items)
    if len(cartoes) > 1:
        print(f"  {chave}: cartoes={cartoes}, qtd={len(items)}")

print("\nTodos os grupos (primeiros 20):")
for i, ((nome, total), items) in enumerate(grupos.items()):
    if i >= 20: break
    cartoes = set(it['cartao'] for it in items)
    print(f"  {i+1}. '{nome}' {total}x -> {len(items)} lancamento(s), {len(cartoes)} cartao(oes)")
    for it in items[:3]:
        print(f"     - {it['cartao']} | {it['data']} | R$ {it['valor']/100:.2f} | {it['desc'][:60]}")

print(f"\nLancamentos SEM match do regex: {len(sem_match)}")
for cartao, desc in sem_match[:10]:
    print(f"  {cartao}: {desc[:80]}")
