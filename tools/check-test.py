import sqlite3, os
b = os.path.expandvars(r'%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite')
c = sqlite3.connect(b).cursor()
print('TESTE-HOTFIX?', c.execute("SELECT id, nome FROM categorias WHERE nome='TESTE-HOTFIX'").fetchone())
print('total categorias:', c.execute('SELECT COUNT(*) FROM categorias').fetchone()[0])
print('todas:', list(c.execute('SELECT id, contexto_id, nome FROM categorias')))
