"""Publica a v0.10.0 no GitHub Releases."""
import os, sys, subprocess, hashlib

ROOT = r'E:\Projetos\MLOPES FINANCE'
NEU = os.path.join(ROOT, 'dist', 'MLopesFinance', 'resources.neu')
VERSION = '0.10.0'
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
    subprocess.run(['git', 'commit', '-m', f'v{VERSION} - Motor Financeiro: relatorios avancados + custos fixos'], cwd=ROOT, check=True)
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

notes = f'''## v{VERSION} — Motor Financeiro (Custos Fixos + Relatórios Avançados)

### Mudanças principais
- **Tela de Custos Fixos** (nova, na sidebar): cadastre aluguel, internet, luz, etc. com descricao, valor mensal, dia do mes, conta/cartao de pagamento. Sistema gera os lancamentos automaticamente todo mes.
  - 3 cards no topo: Total previsto / Ja gerado no mes / A pagar
  - Tabela com 1 linha por custo: dia, conta/cartao, categoria, valor, status do mes
  - Botao "Gerar MM/AAAA": gera os lancamentos do mes atual que ainda nao foram gerados
  - Pausar (mantem historico) / Excluir (cascade) por custo
- **Bloco "Custos fixos" no Dashboard** (entre Suas contas e Cartoes):
  - 3 cards: Total previsto / Ja gerado / A pagar no mes atual
  - Top 5 custos fixos com status (gerado ou pendente)
- **Motor de Relatorios** (backend completo em `core/relatorios.js`, exposto no servidor):
  - `gastosPorMes(contextoId, meses=12)` — serie temporal com receitas/despesas/saldo
  - `topCategorias(contextoId, inicio, fim, limite=10)` — top categorias por despesa
  - `topDespesas(contextoId, inicio, fim, limite=10)` — top 10 despesas individuais
  - `gastosPorConta(contextoId, inicio, fim)` — gastos por conta (cartao vs bancaria)
  - `faturasAVencer(contextoId, dias=30)` — faturas que vencem nos proximos 30 dias
  - `variacaoMensal(contextoId)` — variacao % vs mes anterior
  - `alertas(contextoId)` — lista de banners contextuais (fatura proxima, limite estourado, variacao de gasto)
  - `exportarMovimentosCSV(contextoId, inicio, fim)` — CSV detalhado de todos os lancamentos
- **Backend `core/custosFixos.js`** (novo, 7 funcoes):
  - `criarCustoFixo` — cria template + recorrencia em 1 passo
  - `listarCustosFixos` — lista com valor, dia, conta, categoria, ativo
  - `totalCustosFixosMes` / `resumoCustosFixosMes` — total previsto vs gerado
  - `gerarOcorrenciasMesAtual` — gera os lancamentos que faltam no mes
  - `alternarCustoFixo` / `excluirCustoFixo` (cascade opcional)

### Testes
- **13 testes novos** (118/118 verde): 7 de custos fixos (criar, total, gerar, alternar, excluir cascade, etc) + 6 de relatorios avancados (gastosPorMes, topCategorias, topDespesas, variacaoMensal, alertas, exportarMovimentosCSV)

### Proxima versao (v0.11.0)
- Entidade `parcelamentos` (compra parcelada em Nx → N lancamentos automaticos nas faturas futuras, com projecao visual "esse mes voce tem R$ X a vencer, sendo R$ Y de parcelas e R$ Z de faturas")

### Bundle
- `resources.neu` (6.09 MB, SHA-256 `{sha[:16]}...`)
- Auto-update ja ta programado pra buscar essa versao.
'''

r = subprocess.run([
    'gh', 'release', 'create', TAG, NEU,
    '--title', f'v{VERSION} — Motor Financeiro',
    '--notes', notes,
    '--repo', 'mlopesdesign/mlopes-finance',
], capture_output=True, text=True)
if r.returncode != 0:
    print('gh stdout:', r.stdout)
    print('gh stderr:', r.stderr)
else:
    print(r.stdout)
print(f'Pronto! Release {TAG} publicada.')
