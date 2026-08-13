import sqlite3, os
banco = os.path.expandvars(r'%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite')
con = sqlite3.connect(banco)
c = con.cursor()
try:
    c.execute("INSERT INTO categorias (contexto_id, nome, natureza) VALUES (1, 'TESTE-HOTFIX', 'despesa')")
    con.commit()
    print('INSERT OK')
    r = c.execute("SELECT id, nome FROM categorias WHERE nome='TESTE-HOTFIX'").fetchone()
    print('SELECT:', r)
except Exception as e:
    print('ERRO:', e)
con.close()
