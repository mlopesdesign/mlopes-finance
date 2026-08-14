import sqlite3
import os

db = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
conn = sqlite3.connect(db)
cur = conn.cursor()

print('=== TODAS AS IMPORTACOES (count + lista) ===')
print('count:', cur.execute('SELECT COUNT(*) FROM importacoes').fetchone())
for row in cur.execute('SELECT id, contexto_id, arquivo_origem, formato, hash_arquivo, total_registros, total_importados, status, criado_em FROM importacoes ORDER BY id'):
    print(row)
print()

print('=== ITENS POR IMPORTACAO_ID ===')
for row in cur.execute('SELECT importacao_id, status, COUNT(*) FROM itens_importacao GROUP BY importacao_id, status ORDER BY importacao_id'):
    print(row)
print()

print('=== SCHEMA: itens_importacao (FKs) ===')
for row in cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='itens_importacao'"):
    print(row[0])
print()

print('=== SCHEMA: importacoes ===')
for row in cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='importacoes'"):
    print(row[0])
print()

print('=== foreign_key_check ===')
for row in cur.execute('PRAGMA foreign_key_check'):
    print(row)
print()

print('=== FOREIGN KEYS DO itens_importacao ===')
for row in cur.execute('PRAGMA foreign_key_list(itens_importacao)'):
    print(row)
print()

print('=== TODAS AS TABELAS ===')
for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(row[0])

conn.close()
