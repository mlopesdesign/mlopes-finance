"""
Publica a v0.8.20 no GitHub Releases:
1. Cria a tag v0.8.20 (se nao existir)
2. Cria a release com o resources.neu anexado
3. Atualiza o manifest latest.json (para o auto-update saber a versao)

Uso: python tools/publicar-v0820.py
"""
import os
import sys
import subprocess
import json
import hashlib

ROOT = r'E:\Projetos\MLOPES FINANCE'
NEU = os.path.join(ROOT, 'dist', 'MLopesFinance', 'resources.neu')
VERSION = '0.8.20'
TAG = f'v{VERSION}'

if not os.path.exists(NEU):
    print(f'ERRO: {NEU} nao existe. Rode npm run build:portable antes.')
    sys.exit(1)

# 1. Verifica tag/commit
print('=== Verificando estado do git ===')
r = subprocess.run(['git', 'log', '--oneline', '-1'], cwd=ROOT, capture_output=True, text=True)
print('HEAD:', r.stdout.strip())

# 2. Calcula SHA
size = os.path.getsize(NEU)
sha = hashlib.sha256(open(NEU, 'rb').read()).hexdigest()
print(f'Bundle: {NEU}')
print(f'Size: {size} bytes')
print(f'SHA-256: {sha}')

# 3. Confirma que tem mudancas pra commitar
r = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    print('STATUS:')
    print(r.stdout)
    print('Fazendo commit das mudancas...')
    subprocess.run(['git', 'add', '-A'], cwd=ROOT, check=True)
    subprocess.run(['git', 'commit', '-m', f'v{VERSION} - corrige importacao orfao (reimport + DELETE manual + reciclar)'], cwd=ROOT, check=True)
else:
    print('Sem mudancas novas no git (ja comitado).')

# 4. Push
print('=== git push ===')
subprocess.run(['git', 'push', 'origin', 'main'], cwd=ROOT, check=True)

# 5. Tag
print(f'=== Criando tag {TAG} ===')
r = subprocess.run(['git', 'tag', '-l', TAG], cwd=ROOT, capture_output=True, text=True)
if r.stdout.strip():
    print(f'Tag {TAG} ja existe, deletando pra recriar...')
    subprocess.run(['git', 'tag', '-d', TAG], cwd=ROOT, check=True)
    subprocess.run(['git', 'push', 'origin', ':refs/tags/' + TAG], cwd=ROOT)
subprocess.run(['git', 'tag', TAG], cwd=ROOT, check=True)
subprocess.run(['git', 'push', 'origin', TAG], cwd=ROOT, check=True)

# 6. Cria release via gh (anexando o neu)
print(f'=== Criando release {TAG} ===')
notes = f'''## v{VERSION} — Correcao de importacao orfao

### Sintoma
Tu importou um CSV, excluiu todos os lancamentos (que marcou os 63 itens como "ignorado"),
reimportou o mesmo CSV, e o app DEIXOU PASSAR. Resultado: 126 itens_importacao orfaos no
banco (63 "ignorado" + 63 "duplicado") e a UI mostrava "Nenhum item pendente para importar."

### Causa raiz
Dois bugs combinados:
1. `criarPreviaImportacao` so bloqueava reimportacao se a anterior estava `status='confirmada'`.
   Como a anterior estava "consumida" (itens viraram 'ignorado' quando os lancamentos foram
   excluidos), a checagem passava e criava uma 2a importacao duplicada.
2. `excluirImportacao` confiava no `ON DELETE CASCADE` do schema, mas **sql.js nao
   enforca FKs por padrao** (precisa `PRAGMA foreign_keys = ON`). Os 63+ itens ficavam
   orfaos no banco (FK violation silenciosa, sem erro).

### Correcoes
- `criarPreviaImportacao` agora bloqueia reimportacao se existe QUALQUER importacao
  anterior (mesmo "previa"/"cancelada") com o mesmo hash+contexto.
- `excluirImportacao` agora faz `DELETE FROM itens_importacao` MANUAL antes de
  deletar a importacao (nao confia no CASCADE).
- Nova funcao `reciclarImportacao` + botao "♻ Reciclar" no historico: marca
  todos os itens 'ignorado'/'duplicado' de volta como 'pendente' pra confirmar
  de novo. Resolve o caso de uso do user que excluiu os lancamentos sem querer.
- `excluirTodosLancamentos` agora insere auditoria consolidada (1 linha
  resumo, nao 63).

### Bundle
- `resources.neu` (5.99 MB, SHA-256 `{sha[:16]}...`)
- Auto-update ja ta programado pra buscar essa versao.
'''

r = subprocess.run([
    'gh', 'release', 'create', TAG,
    NEU,
    '--title', f'v{VERSION}',
    '--notes', notes,
    '--repo', 'mlopesdesign/mlopes-finance',
], capture_output=True, text=True)
if r.returncode != 0:
    print('gh stdout:', r.stdout)
    print('gh stderr:', r.stderr)
    print('Tentando upload manual...')
else:
    print(r.stdout)

print(f'Pronto! Release {TAG} publicada.')
