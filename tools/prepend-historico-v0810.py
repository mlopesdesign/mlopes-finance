import os
path = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
novo = """## 0.8.10 — Corrige auto-update + botão "Excluir N lanç."

- **Bug crítico no auto-update (seção 5 do PADRAO)**: o `update.js` usava paths hardcoded com `%LOCALAPPDATA%`. O `os.execCommand` do Neutralino chama `cmd.exe`, mas esse `cmd.exe` NÃO expande a env var (diferente de um shell normal). Resultado: curl.exe recebia o path LITERAL `%LOCALAPPDATA%\...` e falhava com `Unable to open path`. Log do app: `Falha: Unable to open path %LOCALAPPDATA%\Programs\MLopes Finance\resources.neu.tmp`.
- **Fix**: `update.js` resolve o path em runtime via `Neutralino.os.getEnv('LOCALAPPDATA')` e cacheia. `cmd.exe` recebe o path ABSOLUTO. Fallbacks sincronos preservados pra testes.
- **Botão "Excluir N lanç."**: nova função `excluirLancamentosImportacao(db, importacaoId)` que deleta todos os lançamentos vinculados a uma importação (baixas em cascade). **BLOQUEIA** se algum lançamento estiver conciliado (regra de auditoria do PADRAO/AGENTS). UI com botão em cada linha do histórico de importações.
- **Correção de FK**: a ordem de operações no cascade foi ajustada pra evitar `FOREIGN KEY constraint failed` (`itens_importacao.lancamento_id` é limpa ANTES de deletar os lançamentos).
- **3 testes novos** (42/42 verde): exclusão em massa funciona, bloqueio por conciliação, edge case sem lançamentos vinculados.
- **Bump 0.8.9 → 0.8.10** em 7 lugares. Source commitado, release v0.8.10 publicada com `resources.neu` (5.66 MB).

## 0.8.9 — Hotfixes 1-4 consolidados + auto-update testável

Esta versao bate o source em v0.8.9 (era v0.8.8 com hotfixes aplicados direto no bundle instalado). Publicada como release no GitHub para TESTAR o auto-update. O `resources.neu` da v0.8.9 contem os mesmos 4 hotfixes que ja foram aplicados direto no `resources.neu` da v0.8.8 instalado na maquina.

- **Conteudo**: identico a v0.8.8 + hotfixes 1-4 (tela branca, persistir com cmd.exe move /Y, toasts, tela de Importacao reescrita, botao Excluir no historico, sinal do valor preservado)
- **Como testar o auto-update**:
  1. Abra o app instalado (v0.8.8 com hotfixes aplicados direto). O boot faz a checagem em background.
  2. Espere a pill "Nova versao v0.8.9 disponivel" aparecer no header.
  3. Clique na pill OU Configuracoes > Avancado > Atualizacao > "Verificar agora".
  4. Confirme "Baixar e instalar".
  5. O app baixa o `resources.neu` via curl.exe, faz backup do banco, substitui o bundle, e reinicia.
  6. Ao reabrir, vera "VERSÃO 0.8.9" no header.
- **Fallback**: se o auto-update falhar, abre o app e clica em "Verificar agora" — mostra o erro explicito (sem mascarar 404 como "repositorio nao encontrado").
- **NÃO muda o instalador**: o `Setup.exe` em `release/` continua sendo a v0.8.8 (sem os hotfixes). Se o user precisar de um fresh install com tudo corrigido, eu rebuildo o instalador depois. Pra atualizar via auto-update, o `resources.neu` da v0.8.9 ja basta.
- **Bump 0.8.8 -> 0.8.9** em 7 lugares: `neutralino.config.json`, `package.json`, `installer/MLopesFinance.iss`, `src/js/app.js`, `src/js/backend/ambiente.js` + pares em `resources/`.
- **39/39 testes verde.**

"""
prefix = content.split('\n', 1)[0]
resto = content.split('\n', 1)[1] if '\n' in content else ''
with open(path, 'w', encoding='utf-8') as f:
    f.write(prefix + '\n' + novo + resto)
print('anexado v0.8.10 no inicio (acima do v0.8.9)')
with open(path, 'rb') as f:
    head = f.read(3)
print('BOM?', head == b'\xef\xbb\xbf')
