"""Publica a v0.9.0 no GitHub Releases."""
import os, sys, subprocess, hashlib

ROOT = r'E:\Projetos\MLOPES FINANCE'
NEU = os.path.join(ROOT, 'dist', 'MLopesFinance', 'resources.neu')
VERSION = '0.9.0'
TAG = f'v{VERSION}'

if not os.path.exists(NEU):
    print(f'ERRO: {NEU} nao existe. Rode npm run build:portable antes.')
    sys.exit(1)

print('=== Verificando estado do git ===')
r = subprocess.run(['git', 'log', '--oneline', '-1'], cwd=ROOT, capture_output=True, text=True)
print('HEAD:', r.stdout.strip())

size = os.path.getsize(NEU)
sha = hashlib.sha256(open(NEU, 'rb').read()).hexdigest()
print(f'Bundle: {NEU}')
print(f'Size: {size} bytes')
print(f'SHA-256: {sha}')

r = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    print('STATUS:')
    print(r.stdout)
    print('Fazendo commit...')
    subprocess.run(['git', 'add', '-A'], cwd=ROOT, check=True)
    subprocess.run(['git', 'commit', '-m', f'v{VERSION} - Tela de Cartoes e Faturas (CRUD + auto-vinculacao de fatura)'], cwd=ROOT, check=True)
else:
    print('Sem mudancas novas.')

print('=== git push ===')
subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)

print(f'=== Tag {TAG} ===')
r = subprocess.run(['git', 'tag', '-l', TAG], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    subprocess.run(['git', 'tag', '-d', TAG], cwd=ROOT, check=True)
    subprocess.run(['git', 'push', 'origin', ':refs/tags/' + TAG], cwd=ROOT)
subprocess.run(['git', 'tag', TAG], cwd=ROOT, check=True)
subprocess.run(['git', 'push', 'origin', TAG], cwd=ROOT, check=True)

print(f'=== Release {TAG} ===')
notes = f'''## v{VERSION} — Tela de Cartões e Faturas

### O que tem nessa versão
- Tela de **Cartões** (CRUD): cadastre cartões com nome, instituição, limite, dia de fechamento, dia de vencimento e conta de pagamento. O sistema cria a conta automática (tipo "cartao") pra você.
- Tela de **Faturas**: selecione o cartão, veja as faturas (ciclo, fechamento, vencimento, total, pago, status), drill-down dos lançamentos e pagar.
- **Auto-vinculação à fatura**: ao criar um lançamento com a conta do cartão, o sistema descobre o ciclo certo pelo dia de fechamento e joga na fatura. Tu só diz "conta do cartão X" e o sistema faz o resto.
- Migração automática v5 → v6 (adiciona colunas nullable, idempotente).
- Bug fix no `pagarFatura` (usava índice errado do schema, podia marcar faturas parciais como "paga").

### Bundle
- `resources.neu` (6.03 MB, SHA-256 `{sha[:16]}...`)
- Auto-update já tá programado pra buscar essa versão.
'''

r = subprocess.run([
    'gh', 'release', 'create', TAG, NEU,
    '--title', f'v{VERSION}',
    '--notes', notes,
    '--repo', 'mlopesdesign/mlopes-finance',
], capture_output=True, text=True)
if r.returncode != 0:
    print('gh stdout:', r.stdout)
    print('gh stderr:', r.stderr)
else:
    print(r.stdout)
print(f'Pronto! Release {TAG} publicada.')
