"""
Limpa o banco do Marcio:
- Remove todos os itens_importacao orfaos (importacao_id=2 e demais que nao existem)
- Remove a importacao 1 (que tem 63 itens 'ignorado' sem chance de confirmar)
- Mantem cadastros (1 contexto, 3 contas)
- Roda VACUUM pra liberar espaco

Uso: python tools/limpar-importacao-orfaos.py
"""
import sqlite3
import os
import sys

db = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')

if not os.path.exists(db):
    print('ERRO: banco nao existe em', db)
    sys.exit(1)

print('Banco:', db)
print('Tamanho:', os.path.getsize(db), 'bytes')

conn = sqlite3.connect(db)
cur = conn.cursor()

# Diagnostico antes
print()
print('=== ANTES ===')
print('Importacoes:', cur.execute('SELECT COUNT(*) FROM importacoes').fetchone()[0])
print('Itens_importacao total:', cur.execute('SELECT COUNT(*) FROM itens_importacao').fetchone()[0])
print('Itens orfaos (sem importacao):', cur.execute('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id NOT IN (SELECT id FROM importacoes)').fetchone()[0])
print('Itens status=ignorado:', cur.execute("SELECT COUNT(*) FROM itens_importacao WHERE status='ignorado'").fetchone()[0])
print('Lancamentos:', cur.execute('SELECT COUNT(*) FROM lancamentos').fetchone()[0])
print('Contas:', cur.execute('SELECT COUNT(*) FROM contas').fetchone()[0])
print('Contextos:', cur.execute('SELECT COUNT(*) FROM contextos_financeiros').fetchone()[0])
print('Auditoria:', cur.execute('SELECT COUNT(*) FROM auditoria').fetchone()[0])

# Limpar
print()
print('=== EXECUTANDO LIMPEZA ===')

# 1. Deletar itens orfaos (importacao_id que nao existe em importacoes)
orfaos = cur.execute('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id NOT IN (SELECT id FROM importacoes)').fetchone()[0]
cur.execute('DELETE FROM itens_importacao WHERE importacao_id NOT IN (SELECT id FROM importacoes)')
print(f'1. {orfaos} itens orfaos removidos')

# 2. Deletar TODOS os itens da importacao 1 (que esta com 63 'ignorado')
itens_imp1 = cur.execute('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id=1').fetchone()[0]
cur.execute('DELETE FROM itens_importacao WHERE importacao_id=1')
print(f'2. {itens_imp1} itens da importacao #1 removidos')

# 3. Deletar a importacao 1
cur.execute('DELETE FROM importacoes WHERE id=1')
print('3. Importacao #1 removida')

# 4. Limpar auditoria das importacoes / itens (manter auditoria de lancamentos como historico)
cur.execute("DELETE FROM auditoria WHERE entidade IN ('importacoes', 'itens_importacao')")
print('4. Auditoria de importacoes/itens limpa')

conn.commit()

# 5. VACUUM pra liberar espaco (precisa rodar fora de transacao)
cur.execute('VACUUM')
print('5. VACUUM executado')

# Diagnostico depois
print()
print('=== DEPOIS ===')
print('Importacoes:', cur.execute('SELECT COUNT(*) FROM importacoes').fetchone()[0])
print('Itens_importacao total:', cur.execute('SELECT COUNT(*) FROM itens_importacao').fetchone()[0])
print('Itens orfaos:', cur.execute('SELECT COUNT(*) FROM itens_importacao WHERE importacao_id NOT IN (SELECT id FROM importacoes)').fetchone()[0])
print('Lancamentos:', cur.execute('SELECT COUNT(*) FROM lancamentos').fetchone()[0])
print('Contas:', cur.execute('SELECT COUNT(*) FROM contas').fetchone()[0])
print('Contextos:', cur.execute('SELECT COUNT(*) FROM contextos_financeiros').fetchone()[0])
print('Auditoria (restante):', cur.execute('SELECT COUNT(*) FROM auditoria').fetchone()[0])

conn.close()

# Tamanho final
print()
print('Tamanho final:', os.path.getsize(db), 'bytes')
print()
print('PRONTO! Banco limpo. Pode reimportar o CSV pela UI agora.')
print('OBS: a v0.8.20 vai chegar via auto-update com fixes pra evitar isso acontecer de novo.')
