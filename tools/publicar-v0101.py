"""Publica a v0.10.1 no GitHub Releases."""
import os, sys, subprocess, hashlib

ROOT = r'E:\Projetos\MLOPES FINANCE'
NEU = os.path.join(ROOT, 'dist', 'MLopesFinance', 'resources.neu')
VERSION = '0.10.1'
TAG = f'v{VERSION}'

if not os.path.exists(NEU):
    sys.exit(f'ERRO: {NEU} nao existe')

r = subprocess.run(['git', 'log', '--oneline', '-1'], cwd=ROOT, capture_output=True, text=True)
print('HEAD:', r.stdout.strip())
size = os.path.getsize(NEU)
sha = hashlib.sha256(open(NEU, 'rb').read()).hexdigest()
print(f'Bundle: {size} bytes, SHA: {sha}')

r = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    subprocess.run(['git', 'add', '-A'], cwd=ROOT, check=True)
    subprocess.run(['git', 'commit', '-m', f'v{VERSION} - PT-BR: datas em dd/mm/aaaa na UI'], cwd=ROOT, check=True)

subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)

print(f'=== Tag {TAG} ===')
r = subprocess.run(['git', 'tag', '-l', TAG], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    subprocess.run(['git', 'tag', '-d', TAG], cwd=ROOT, check=True)
    subprocess.run(['git', 'push', 'origin', ':refs/tags/' + TAG], cwd=ROOT)
subprocess.run(['git', 'tag', TAG], cwd=ROOT, check=True)
subprocess.run(['git', 'push', 'origin', TAG], cwd=ROOT, check=True)

notes = f'''## v{VERSION} — Localização PT-BR (datas em dd/mm/aaaa)

### Motivacao
Tu pediu: "Eu sou brasileiro, tudo que fizermos tem que ser nos moldes do meu pais". Ate entao as datas apareciam em formato ISO (YYYY-MM-DD) no schema, mas a UI tava exibindo-as cru. Agora a UI formata em PT-BR.

### Mudancas
- **Novos helpers de data em PT-BR** (em `src/js/app.js` e em cada tela):
  - `fmtData(iso)` — `2026-08-14` -> `14/08/2026`
  - `fmtMes(iso)` — `2026-08` -> `08/2026` (ciclos de fatura)
  - `fmtDataHora(iso)` — `2026-08-14T09:35Z` -> `14/08/2026 09:35`
  - `fmtDataCurta(iso)` — `2026-08-14` -> `14/08` (pra tabelas densas)
- **Aplicado em todas as telas**:
  - `renderLancamentos` — tabela principal de lancamentos
  - `renderBaixas` — coluna "Vencimento"
  - `renderTransferencias` — coluna "Data"
  - `renderDashboard` — "Vence" dos cartoes
  - `telas/faturas.js` — colunas "Fechamento" e "Vencimento" da tabela de faturas + tabela de lancamentos da fatura
  - `telas/importacao.js` — coluna "Data" do historico de importacoes
- **Storage continua ISO (YYYY-MM-DD)** — padrao do schema SQL, nao muda. So a EXIBICAO mudou.
- **Inputs HTML5 `<input type="date">` continuam YYYY-MM-DD** — isso e' o formato que o navegador espera, e o usuario brasileiro ta acostumado (a maioria dos sistemas brasileiros usa ISO internamente). Pra mudar isso ia requerer um datepicker custom, fora de escopo.

### Bundle
- `resources.neu` ({size} bytes, SHA-256 `{sha[:16]}...`)
- Auto-update ja ta programado.
'''

r = subprocess.run([
    'gh', 'release', 'create', TAG, NEU,
    '--title', f'v{VERSION} — PT-BR: datas em dd/mm/aaaa',
    '--notes', notes,
    '--repo', 'mlopesdesign/mlopes-finance',
], capture_output=True, text=True)
if r.returncode != 0:
    print('gh stderr:', r.stderr)
else:
    print(r.stdout)
print(f'Pronto! Release {TAG} publicada.')
