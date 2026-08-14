"""Debug: ver colunas reais do banco de teste."""
import sqlite3
import os

# Tenta conectar no banco do Marcio
db = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
if os.path.exists(db):
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    print('=== COLUNAS DE lancamentos NO BANCO DO MARCIO ===')
    for row in cur.execute("PRAGMA table_info(lancamentos)"):
        print(row)
    print()
    print('=== MIGRATION ===')
    for row in cur.execute("SELECT * FROM meta"):
        print(row)
    conn.close()
else:
    print('Banco do Marcio nao existe')
