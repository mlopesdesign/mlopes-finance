"""Publica a v0.9.1 no GitHub Releases."""
import os, sys, subprocess, hashlib

ROOT = r'E:\Projetos\MLOPES FINANCE'
NEU = os.path.join(ROOT, 'dist', 'MLopesFinance', 'resources.neu')
VERSION = '0.9.1'
TAG = f'v{VERSION}'

if not os.path.exists(NEU):
    print(f'ERRO: {NEU} nao existe. Rode npm run build:portable antes.')
    sys.exit(1)

r = subprocess.run(['git', 'log', '--oneline', '-1'], cwd=ROOT, capture_output=True, text=True)
print('HEAD:', r.stdout.strip())

size = os.path.getsize(NEU)
sha = hashlib.sha256(open(NEU, 'rb').read()).hexdigest()
print(f'Bundle: {size} bytes, SHA: {sha}')

r = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    print('STATUS:\n' + r.stdout)
    subprocess.run(['git', 'add', '-A'], cwd=ROOT, check=True)
    subprocess.run(['git', 'commit', '-m', f'v{VERSION} - dashboard separado por conta + fatura do cartao'], cwd=ROOT, check=True)
else:
    print('Sem mudancas.')

subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)

print(f'=== Tag {TAG} ===')
r = subprocess.run(['git', 'tag', '-l', TAG], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    subprocess.run(['git', 'tag', '-d', TAG], cwd=ROOT, check=True)
    subprocess.run(['git', 'push', 'origin', ':refs/tags/' + TAG], cwd=ROOT)
subprocess.run(['git', 'tag', TAG], cwd=ROOT, check=True)
subprocess.run(['git', 'push', 'origin', TAG], cwd=ROOT, check=True)

notes = f'''## v{VERSION} — Dashboard separado por conta + cartão

### Mudancas
- **Visao geral (dashboard) reformulada** com 2 novos blocos:
  - **"Suas contas"**: tabela com cada conta bancaria/investimento, saldo inicial, qtd de lancamentos e saldo atual. Linha de total no fim (so aparece se tem mais de 1 conta).
  - **"Cartoes de credito"**: card pra cada cartao com limite, fatura atual (ciclo, total, pago, restante, vencimento, status), barra de progresso de uso (verde <50%, amarelo 50-80%, vermelho >80%), e disponivel restante.
- Botoes "Gerenciar contas" e "Gerenciar cartoes" em cada bloco (navega direto pra tela).
- Mantem o resumo do periodo (Receitas, Despesas, Saldo, Lancamentos) no topo + cards de cadastros auxiliares no fim.

### Bug fixes incluidos
- **`estornarLancamento` agora zera o saldo corretamente**: antes o estorno criava 1 lancamento de natureza oposta COM status='aberto' (contava no saldo). Agora cria o inverso com status='estornado' direto, e o original tambem vai pra 'estornado'. Resultado: os 2 somem do calculo de saldo, mantendo o numero correto.
- **`saldoPorConta` nova rota** (`dashboard:saldoPorConta`): retorna o saldo atual por conta somando com sinal (receita=+, despesa=-) e ignorando estornados. Transferencias se auto-anulam (1 receita + 1 despesa). Testes provam que transferencia entre 2 contas zera o efeito total.

### Bundle
- `resources.neu` (6.05 MB, SHA-256 `{sha[:16]}...`)
- Auto-update ja ta programado.
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
