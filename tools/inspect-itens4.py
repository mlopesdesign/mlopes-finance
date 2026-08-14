import sqlite3
import os
import json

db = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
conn = sqlite3.connect(db)
cur = conn.cursor()

print('=== AUDITORIA (todas acoes) ===')
for row in cur.execute('SELECT id, entidade, entidade_id, acao, dados_json, criado_em FROM auditoria ORDER BY id'):
    print(row)
print()

print('=== CHAVES EXTERNAS ITENS IMP1 ===')
chaves1 = cur.execute('SELECT chave_externa, status, valor_centavos FROM itens_importacao WHERE importacao_id=1 ORDER BY id LIMIT 5').fetchall()
for c in chaves1:
    print(c)
print()

print('=== CHAVES EXTERNAS ITENS IMP2 (orfãos) ===')
chaves2 = cur.execute('SELECT chave_externa, status, valor_centavos FROM itens_importacao WHERE importacao_id=2 ORDER BY id LIMIT 5').fetchall()
for c in chaves2:
    print(c)
print()

print('=== META ===')
for row in cur.execute('SELECT * FROM meta'):
    print(row)
print()

print('=== HISTORICO ITENS: existe coluna criado_em? ===')
for row in cur.execute('SELECT id, importacao_id, status, criado_em FROM itens_importacao WHERE id IN (1, 64, 126) ORDER BY id'):
    print(row)

conn.close()
