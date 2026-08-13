import sqlite3, os
b = os.path.expandvars(r'%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite')
c = sqlite3.connect(b)
c.execute("DELETE FROM categorias WHERE nome='TESTE-HOTFIX'")
c.commit()
print('TESTE-HOTFIX removida')
print('total categorias agora:', c.execute('SELECT COUNT(*) FROM categorias').fetchone()[0])
c.close()
