import sqlite3
import os
banco = os.path.expandvars(r'%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite')
con = sqlite3.connect(banco)
c = con.cursor()
print('=== CONTEXTOS ===')
for r in c.execute('SELECT id, nome, ativo FROM contextos_financeiros'): print(' ', r)
print('=== CONTAS ===')
for r in c.execute('SELECT id, contexto_id, nome, tipo, ativo FROM contas'): print(' ', r)
print('=== IMPORTACOES ===')
for r in c.execute('SELECT id, contexto_id, arquivo_origem, formato, total_registros, total_importados, status FROM importacoes ORDER BY id'): print(' ', r)
print('=== ITENS_IMPORTACAO (todos) ===')
for r in c.execute('SELECT id, importacao_id, conta_id, data_transacao, valor_centavos, substr(descricao,1,40), status, lancamento_id FROM itens_importacao ORDER BY id DESC'): print(' ', r)
print('=== LANCAMENTOS (todos) ===')
for r in c.execute('SELECT id, contexto_id, conta_id, natureza, valor_centavos, data_competencia, substr(descricao,1,40), status FROM lancamentos ORDER BY id'): print(' ', r)
print('=== TOTAL POR TABELA ===')
for t in ['contextos_financeiros','contas','lancamentos','importacoes','itens_importacao']:
    n = c.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]
    print(f'  {t}: {n}')
con.close()
