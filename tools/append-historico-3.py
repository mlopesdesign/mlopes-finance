import os
path = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
append = """

## 0.8.8-hotfix3 — Excluir importação do histórico (libera reimportação)

- **Pedido do user**: "se eu quiser importar novamente, não tem como deletá-la". A tela de Importação mostrava as importações no histórico mas não tinha botão de Excluir. Se a importação ficasse em `status='confirmada'` e o user quisesse reimportar o mesmo arquivo, o check de duplicidade por `hash_arquivo` bloqueava.
- **Fix**:
  - Nova função `excluirImportacao(db, importacaoId)` em `core/importacao.js`. Faz `DELETE FROM importacoes WHERE id = ?` (cascade em `itens_importacao` via `ON DELETE CASCADE`). **Lançamentos criados permanecem intactos** (regra de auditoria: correção é por estorno/ajuste, não por exclusão).
  - Nova rota `importacao:excluir` no `servidor.js`.
  - Botão "Excluir" em cada linha do histórico de importações, com confirmação prévia. Toast de sucesso/erro.
  - Status `confirmada` agora renderiza com pill verde; `cancelada` com pill cinza; `previa` com pill amarela (antes era texto puro).
  - CSS `.button.ghost.small` adicionado.
- **2 testes novos** (38/38 verde): `excluirImportacao remove cascade` + `excluirImportacao rejeita id inválido`. O teste cobre o cenário do user: excluir uma importação confirmada + reimportar o mesmo arquivo (hash bate) — agora funciona, e os itens vêm como "duplicado" contra os lançamentos já existentes.
- **Como usar**: Importar extrato → role até o final → Histórico de importações → clique "Excluir" na linha que quer remover. Toast verde confirma. A próxima pré-visualização do mesmo arquivo vai funcionar.
"""
if "0.8.8-hotfix3" not in content:
    with open(path, 'a', encoding='utf-8') as f:
        f.write(append)
    print('anexado')
else:
    print('ja tinha hotfix3')
# SEM BOM
with open(path, 'rb') as f:
    head = f.read(3)
print('BOM?', head == b'\xef\xbb\xbf')
