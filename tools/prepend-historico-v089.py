import os
path = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
novo = """## 0.8.9 — Hotfixes 1-4 consolidados + auto-update testável

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
# Insere o novo bloco no inicio (depois da primeira linha em branco)
prefix = content.split('\n', 1)[0]  # primeira linha (vazia)
resto = content.split('\n', 1)[1] if '\n' in content else ''
with open(path, 'w', encoding='utf-8') as f:
    f.write(prefix + '\n' + novo + resto)
print('anexado v0.8.9 no inicio')
with open(path, 'rb') as f:
    head = f.read(3)
print('BOM?', head == b'\xef\xbb\xbf')
