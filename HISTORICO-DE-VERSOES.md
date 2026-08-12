# Histórico de versões

## 0.4.1 — hotfix UTF-8 completo

- **Encoding UTF-8 em todos os 63 arquivos do projeto** (HTML, JS, CSS, SQL, JSON, MD, ISS): `tools/normalize-utf8.py` remove BOM UTF-8, valida bytes como UTF-8 e regrava. Arquivo único inválido era `.graphify_detect.json` (lixo de auditoria antiga) e foi ignorado.
- **BOM removido de `src/index.html` e `src/js/app.js`**: o BOM estava causando conflito com o `<meta charset="utf-8">` no topo do head, e o WebView2 do Chromium priorizava o BOM mas a heurística podia cair em Latin-1 para o texto estático posterior.
- **Padrão de encoding único**: UTF-8 sem BOM para todos os arquivos de source. O `<meta charset="utf-8">` no `index.html` (linha 4, primeiro elemento do `<head>`) é a única fonte de verdade do encoding da página.
- **NÃO usei `serverHeaders` no `neutralino.config.json`**: tentei adicionar `Content-Type: text/html; charset=utf-8` mas o `serverHeaders` do Neutralino é GLOBAL e sobrescreve o Content-Type de TUDO, incluindo `application/javascript` para `.js`, o que quebraria o `<script type="module">`. Removido. A solução correta é confiar no `<meta charset>` do HTML.
- **Verificação automatizada**: o servidor HTTP interno do Neutralino serve `/` com `Content-Type: text/html` e primeiros 4 bytes = `3C 21 64 6F` (`<!do` em UTF-8, sem BOM). O `<meta charset="utf-8">` está na linha 4, antes de qualquer outro conteúdo textual.
- **Verificação manual recomendada**: o print enviado da v0.4.0 mostrava "FinanÃ§as", "VersÃ£o", "instalaÃ§Ã£o" no texto estático mas "VISÃO GERAL", "ritmo", "período" corretos no texto injetado por JS. Agora o texto estático deve renderizar com acentos corretos.
- **Causa raiz que justificou o hotfix**: a v0.4.0 introduzia arquivos novos (`tema.css`, `tema.js`, `telas/configuracoes.js`) salvos com BOM pelo `write` tool. Combinado com o `index.html` (também com BOM), criou ambiguidade que o Chromium resolveu mal. Misturar BOM em arquivos JS/HTML dentro do mesmo bundle é receita pra desastre de encoding.
- **Aprendizado para próximos agentes**: ao criar QUALQUER arquivo de texto no projeto, SEM BOM, UTF-8. Rodar `python tools/normalize-utf8.py .` antes de qualquer release como rede de segurança.

## 0.4.0 — identidade visual dinâmica + sistema de configurações

- **Tema light/dark editável**: novo `src/css/tema.css` com CSS variables. `:root` = light, `[data-theme="dark"]` = dark. `src/css/app.css` foi refatorado pra consumir 100% as variables — zero hex hardcoded.
- **Cor da marca customizável**: o usuário pode trocar o teal `#155e6f` por qualquer cor no picker; a aplicação sobrescreve `--brand` direto no `<html>`.
- **Nova tabela `configuracoes (chave PK, valor, tipo CHECK, atualizado_em)`** no schema. Migração v1 → v2 idempotente com seed de 5 defaults (tema=dark, marca_cor=#155e6f, nome_exibicao="MLopes Finance", moeda=BRL, locale=pt-BR).
- **Backend `src/js/backend/core/configuracoes.js`**: funções puras `getConfig`, `setConfig`, `getAllConfig`, `deleteConfig`, `resetConfig`. Valida `tema ∈ {light,dark}` e cor no formato `#RRGGBB`.
- **Helper `src/js/tema.js`**: `aplicarTema`, `aplicarTemaDoBanco`, `alternarTema`, `setConfigValor`. Lê o tema direto do DB e injeta no DOM **antes** do primeiro render (zero flash).
- **Tela de Configurações** (`src/js/telas/configuracoes.js`): padrão sidebar-de-seções do ML Download Manager (Aparência / Identidade / Financeiro / Avançado). Preview ao vivo, Salvar persiste, Restaurar padrão reseta.
- **Toggle de tema no header**: pill button "☾ Escuro" / "☀ Claro" ao lado de "VERSÃO 0.4.0" — clica, recarrega a página com o novo tema.
- **Bug do `migrar()` consertado**: a v0.4.0-rc1 rodava a migração v2 mas o `persistir()` nunca era chamado, então a tabela `configuracoes` sumia quando o app fechava. Agora `app.js` compara `schema_version` antes/depois do `migrar()` e chama `await local.persistir()` se houve mudança.
- **Header reformulado**: brand-mark com logo horizontal (`images/logo-horizontall-transparente.png` do `mlopes dev`), tag `<strong>` com nome de exibição dinâmico, topbar-actions separadas do status.
- **3 testes novos** em `tests/core.test.mjs`: get/set/getAll, validação de tema e cor inválidos, reset volta aos defaults. Total: 6 tests, 6 pass.
- **Causa raiz que justificou a sprint**: a v0.3.3 tinha o `app.css` com hex hardcoded (sem tema), sem tela de configurações, e o `migrar()` não persistia. Sem identidade visual editável, cada nova instalação era presa ao tema light fixo. Esta sprint desbloqueia: (1) identidade visual dinâmica por instalação, (2) caminho aberto pra outras configurações (locale, moeda, nome), (3) base sólida pra implementar os próximos módulos (cartões, OFX, comercial).
- **Verificação automatizada**: 6 testes passam; servidor HTTP serve `tema.css` (2190B), `tema.js` (2163B), `telas/configuracoes.js` (7056B), `images/logo-horizontall-transparente.png` (455043B) com 200 OK; SQLite local tem tabela `configuracoes` com 5 linhas e `meta.schema_version = 2` após primeira execução.
- **Verificação manual recomendada**: abrir o .exe, ver que o tema default é dark com a teal `#155e6f`, clicar em "Configurações" no sidebar, alternar entre Claro/Escuro, mudar a cor da marca, clicar Salvar, fechar e reabrir — o tema escolhido deve persistir.

## 0.3.3 — boot funcional + diretório recursivo

- `src/js/backend/ambiente.js` agora cria a pasta `%APPDATA%/MLopesFinance` antes da `dados/`, porque `Neutralino.filesystem.createDirectory` não é recursivo.
- Adicionado `export const APP_VERSION = '0.3.3'` em `ambiente.js` para o terceiro lugar do fallback de versão exigido pela AGENTS-BASE seção 4.
- `src/js/app.js` agora importa `APP_VERSION as AMBIENTE_VERSION` de `ambiente.js` e cria `FALLBACK_VERSION` que poderia ser usado em leitura offline do título.
- Versão bumpada nos quatro lugares: `neutralino.config.json`, `package.json`, `src/js/app.js`, `resources/js/app.js`, `installer/MLopesFinance.iss`.
- **Verificação automatizada**: os 9 endpoints do servidor HTTP interno do Neutralino respondem 200 com o `index.html` do MLopes Finance (sem a welcome page "Build lightweight cross-platform desktop apps"); o app cria o banco SQLite inicial de 40 960 bytes em `%APPDATA%/MLopesFinance/dados/`.
- **Verificação manual recomendada**: abrir o instalador com duplo clique, confirmar a janela "MLopes Finance" (não a welcome page do Neutralino), fechar e reabrir pelo atalho. O banco deve persistir entre execuções.
- **Causa raiz que justificou o hotfix**: a v0.3.2 tinha sido aprovada pelos agentes anteriores só por inspeção de arquivos, sem executar o .exe. O teste automatizado desta versão confirmou que o `app.js` (módulo) executa, que o `Neutralino.init()` completa, que o `initSqlJs` carrega o WASM e que o boot entra no `abrirBancoLocal`. A `createDirectory` falhava silenciosamente porque tentava criar `dados/` sem o pai `MLopesFinance/`, fazendo o `boot()` cair no `catch` da linha final e o usuário ver "Falha ao abrir o banco". O instalador foi gerado pelo ISCC com sucesso, o ciclo install → run → uninstall foi executado em silent mode e validado.

## 0.1.9 — inicialização limpa

- Removida a instrumentação temporária que bloqueava chamadas nativas antes do `Neutralino.init()`.
- Removido `exportAuthInfo` do pacote final.
- Causa raiz da falha de diagnóstico: `src/js/app.js` aguardava `filesystem.writeFile` antes de abrir o WebSocket nativo.

## 0.1.6 — identidade visual e atalhos

- Criado `src/icons/appIcon.svg` e `src/icons/appIcon.ico` com símbolo financeiro.
- Ícone configurado no executável Neutralino, no instalador, no menu Iniciar e na área de trabalho.
- Removido o log temporário de diagnóstico da versão anterior.

## 0.1.5 — URL inicial do Neutralino

- Configurada a URL `/resources/` no `neutralino.config.json`.
- Causa raiz: sem `url`, o Neutralino carregava `/` enquanto o bundle tinha `resources/index.html`, gerando HTTP 404 no WebView2.
- Evidência: janela instalada mostrava `127.0.0.1:<porta>/` com “página não pode ser encontrada”.

## 0.1.3 — carregamento do recurso empacotado

- Corrigidos os caminhos da interface para usar `resources/index.html` e seus recursos relativos.
- Causa raiz: `src/index.html` referenciava `/src/...`, mas o Neutralino empacota a árvore sob `/resources/...`; a janela nativa abria, porém JS, WASM e schema não carregavam.
- Verificação pendente de repetir no instalador 0.1.3.

## 0.1.2 — inicialização do banco instalado

- Corrigida a ordem de registro do evento `ready` do Neutralino.
- Causa raiz: `src/js/app.js` chamava `Neutralino.init()` antes de registrar o listener usado por `src/js/backend/ambiente.js`, impedindo a criação do banco em `%APPDATA%`.
- Verificação pendente de repetir no instalador 0.1.2.

## 0.1.1 — persistência local

- Corrigida a inicialização do cliente para carregar `neutralino.js` e `sql-wasm.js` como recursos empacotados.
- Banco local agora usa `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite`.
- Salvamento segue `tmp → atual.old → atual`, com recuperação no boot.
- Causa raiz: a primeira interface criava `new SQL.Database()` em memória e `criarApi` recebia persistência vazia em `src/js/app.js`.
- Verificação: 3 testes automatizados e `node --check` em 7 arquivos.

## 0.1.0 — reconstrução inicial

- Fundação limpa do MLopes Finance local-first.
- Núcleo com contextos, contas, categorias, lançamentos e auditoria.
- Valores em centavos e datas operacionais em `YYYY-MM-DD`.
- Instalador Inno Setup em preparação.

Esta versão só pode ser marcada como pronta após a validação do executável instalado.
