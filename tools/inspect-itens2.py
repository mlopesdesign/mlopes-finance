import sqlite3
import os

db = os.path.join(os.environ['APPDATA'], 'MLopesFinance', 'dados', 'mlopes-finance.sqlite')
conn = sqlite3.connect(db)
cur = conn.cursor()

print('=== IMPORTACOES ===')
for row in cur.execute('SELECT id, contexto_id, arquivo_origem, formato, hash_arquivo, total_registros, total_importados, status, criado_em FROM importacoes ORDER BY id'):
    print(row)
print()

print('=== STATUS ITENS POR IMPORTACAO ===')
for row in cur.execute('SELECT importacao_id, status, COUNT(*) FROM itens_importacao GROUP BY importacao_id, status ORDER BY importacao_id, status'):
    print(row)
print()

print('=== ITENS IMP1 ===')
for row in cur.execute('SELECT id, conta_id, data_transacao, valor_centavos, descricao, status, lancamento_id FROM itens_importacao WHERE importacao_id=1 ORDER BY id LIMIT 3'):
    print(row)
print()

print('=== ITENS IMP2 ===')
for row in cur.execute('SELECT id, conta_id, data_transacao, valor_centavos, descricao, status, lancamento_id FROM itens_importacao WHERE importacao_id=2 ORDER BY id LIMIT 3'):
    print(row)
print()

print('=== LANCAMENTOS COUNT ===')
print('total:', cur.execute('SELECT COUNT(*) FROM lancamentos').fetchone())
print()

print('=== CONTAS ===')
for row in cur.execute('SELECT id, contexto_id, nome, tipo, ativo FROM contas ORDER BY id'):
    print(row)
print()

print('=== CHAVES EXTERNAS: IMP1 vs IMP2 (mesma?) ===')
chaves1 = set([r[0] for r in cur.execute('SELECT chave_externa FROM itens_importacao WHERE importacao_id=1')])
chaves2 = set([r[0] for r in cur.execute('SELECT chave_externa FROM itens_importacao WHERE importacao_id=2')])
print('IMP1 chaves:', len(chaves1))
print('IMP2 chaves:', len(chaves2))
print('intersecao:', len(chaves1 & chaves2))
print('IMP1 so:', len(chaves1 - chaves2))
print('IMP2 so:', len(chaves2 - chaves1))

conn.close()
