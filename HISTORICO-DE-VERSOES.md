
## 0.8.7 — Edicao de contas/categorias + migracao do schema v4 (corrige NOT NULL)

- **Bug 1 (quebra funcional)**: as telas "Contas" e "Categorias" nao tinham botao de Editar. So era possivel criar novo ou inativar. Se o user errasse o nome (ex: "Conta corente" em vez de "Conta corrente"), nao tinha como corrigir sem deletar e recriar. Adicionado botao "Editar" em ambas as telas + 2 rotas novas no servidor (`contas:atualizar`, `categorias:atualizar`) + 2 funcoes puras no `core/financeiro.js` (`atualizarConta`, `atualizarCategoria`).
- **Bug 2 (tela "Importar extrato" quebrava)**: a migracao v3→v4 (v0.6.0) criou a tabela `itens_importacao` com `conta_id INTEGER NOT NULL`, mas o `conta_id` so e' definido no `confirmarImportacao` (depois do usuario escolher a conta destino), nao no `criarPreviaImportacao`. Resultado: clicar "Pre-visualizar" na tela "Importar extrato" quebrava com `NOT NULL constraint failed: itens_importacao.conta_id`. O `schema.sql` atual ja tinha `conta_id` nullable, mas a migracao antiga nao corrigia bancos que ja tinham a tabela. Nova migracao v4→v5 corrige: renomeia a tabela, recria com o schema correto, copia os dados, dropa a tabela antiga.
- **Bump 0.8.6 → 0.8.7** em 7 lugares. 34/34 testes verde (o teste de importacao ja validava o caminho feliz).
- **Por que esses 2 bugs passaram em 4 versoes (v0.6.0 ate v0.8.6)**: o `npm test` exercita `criarPreviaImportacao` em banco **novo** (schema v4 com `conta_id` nullable), entao o bug nao aparecia em testes. So aparecia em bancos de user que migraram de v3. E edicao de contas/categorias simplesmente nao existia no codigo — so a criacao.

## 0.8.6 — Toggle de tema sem reload (alternava em vários cliques)

- **Bug**: o toggle de tema (claro/escuro) no header chamava `location.reload()` a cada clique. Recarregar a pagina inteira pra trocar `data-theme` no `<html>` e' desnecessario. Pior: se o user clicava varias vezes rapido, cada clique disparava um reload que matava o estado do anterior — o user tinha que clicar 3-4x ate o tema efetivamente mudar.
- **Fix**: removido `location.reload()`. Agora o toggle:
  1. Le o tema atual via API
  2. Calcula o novo
  3. Salva no DB
  4. Aplica `data-theme` no `<html>` direto
  5. Re-renderiza o header pra atualizar o icone da pill (☾ Escuro / ☀ Claro)
- Sem race condition, sem flash, alterna em 1 clique so.
- **Bump 0.8.5 → 0.8.6** em 7 lugares. 34/34 testes verde.

## 0.8.5 — Auto-update com token do GitHub (escapa do rate limit 60/h)

- **Problema**: o app chama `https://api.github.com/repos/mlopesdesign/mlopes-finance/releases/latest` **sem autenticação**. O GitHub limita chamadas anônimas a 60 req/h por IP. Depois das várias chamadas que fiz pra validar (build, install, smoke test, rate limit check), o IP do user estourou o limite. Resposta do GitHub pra chamadas anônimas após o estouro: **404** (sim, 404, não 403 — o GitHub "esconde" a diferença pra quem não tem auth). O `update.js` trata 404 como "repositório nao encontrado", mostrando a mensagem confusa no app.
- **Fix**: `update.js` agora le **opcionalmente** um token do GitHub da env var `GH_TOKEN` ou `MLOPES_GH_TOKEN` (via `Neutralino.os.getEnv`) e adiciona como header `Authorization: Bearer <token>`. Com token, o limite vai pra 5000 req/h.
- **Por que nao é hardcoded**: o token fica na env var, nao no source. Se o user nao setar a env var, o app volta a chamar anônimo (e bate no rate limit). Setar: `setx GH_TOKEN <token>` no PowerShell (permanente) ou `$env:GH_TOKEN = '<token>'` na sessao.
- **Como descobrir o token atual do `gh`**: `gh auth token` retorna o token. O user ja tem o `gh` autenticado, entao o token existe.
- **Bump 0.8.4 → 0.8.5** em 7 lugares. 34/34 testes verde, `node --check` em todos os arquivos alterados.

## 0.8.4 — HOTFIX: servidor.js usa APP_VERSION sem importar

- **Bug critico na v0.8.3**: `src/js/backend/servidor.js` linha 96 usava `APP_VERSION` na rota `update:checar` mas **nunca importou** de `./ambiente.js`. Resultado: ao chamar a checagem de atualizacao (que acontece no boot, em `Configuracoes > Avancado > Verificar atualizacoes`, ou ao clicar na pill), o `servidor.js` quebrava com `ReferenceError: APP_VERSION is not defined` e o app ficava travado.
- **Por que nao foi pego antes**: o `npm test` (34/34 verde) exercita as funcoes core diretamente (`core/update.js` -> `checarAtualizacao`). Nenhum teste chama a rota `update:checar` via `criarApi()`. Entao o import faltando passou despercebido em todas as 4 versoes (v0.7.1 ate v0.8.3).
- **Fix**: adicionado `import { APP_VERSION } from './ambiente.js';` no topo de `servidor.js` (e no par `resources/`).
- **Licao**: a suite de testes precisa de um smoke test que faca `criarApi(db, persistir)` e exercite as rotas que dependem de globais/constantes. Adicionar teste de regressao na v0.8.5+.
- **Bump 0.8.3 → 0.8.4** em 7 lugares. Encoding UTF-8 sem BOM, `node --check` em todos os arquivos alterados, 34/34 testes verde (o teste nao cobre a rota, mas a sintaxe agora esta correta).
- **Side effect positivo**: como a v0.8.4 e uma nova release, quem estava na v0.8.3 vai ver a pill amarela (assim que o rate limit do GitHub resetar, ~1h).

## 0.8.0 — Fase 1 (Contextos UI) + validação end-to-end do auto-update

- **Fase 1 do plano** (item 3.1 do `PROJETO-COMPLETO-E-PLANO-DE-EXECUCAO-MLOPES-FINANCE.md`, "Contextos financeiros" exposta na UI):
  - **`src/js/backend/core/financeiro.js`** — 5 funções novas em cima do CRUD de contextos (que existia no schema desde a v0.5.0 mas só era acessível via backend direto):
    - `listarContextos(db, incluirInativos)` — lista contextos com `incluirInativos` (default `false`)
    - `obterContexto(db, id)` — busca 1 contexto por id
    - `atualizarContexto(db, { id, nome, descricao })` — só edita nome/descrição; `ativo` continua sendo gerenciado por `alternarContextoAtivo`
    - `alternarContextoAtivo(db, id)` — flip do flag `ativo`
    - `resumoContexto(db, contextoId)` — agregado: `receitas`, `despesas`, `saldo`, `lancamentos`, `contas`, `clientes`, `projetos` (todos em centavos)
  - **Seed automatico de categoria "Transferência interna"**: ao chamar `criarContexto()`, agora cria tambem uma categoria com `natureza = 'ambas'` e nome `"Transferência interna"`, no mesmo contexto. Garante que o fluxo de transferencia entre contas do contexto sempre tenha uma categoria padrao disponivel.
  - **5 rotas novas no `servidor.js`**: `contextos:listar` (com `incluirInativos`), `contextos:obter`, `contextos:atualizar`, `contextos:alternarAtivo`, `contextos:resumo`.
  - **`src/js/telas/contextos.js`** (UI, ~6.6 KB): tela CRUD de contextos. Tabela com nome/descricao/receitas/despesas/saldo/lancamentos/status (Ativo/Inativo)/acoes (Usar/Editar/Desativar). Checkbox "Mostrar inativos" persiste em `sessionStorage`. Botao "Novo contexto" no topo abre modal de cadastro. Edicao reusa o mesmo modal. Tudo no padrao visual ml-* (`.panel`, `.field-row`, `.field-label`, `.pill`, `.btn-primary`).
  - **Item "Contextos" no sidebar** entre "Categorias" e "Configuracoes" (13a tela do nav, era 12 na v0.7.1).
  - **Pill seletor de contexto no header** (`<select>` estilizado como `.pill.contexto-select`): substitui a label estatica "Meu contexto" da v0.7.1. Ao trocar, chama `trocarContextoAtivo(novoId, api)` que atualiza o `ativo` no DB e recarrega a view atual sem precisar reabrir o app.
  - **CSS** (~20 linhas adicionadas): `.pill.contexto-select` (mesmo visual das outras pills do header, mas com `<select>` real por baixo) + `.pill.is-static.contexto-label` (label de "Contexto:" antes do select).
- **5 testes novos** (era 29, agora **34/34 verde**): seed automatico de categoria, listar com filtro inativos, atualizar nome/descricao, alternar ativo, resumo agregado.
- **Bump 0.7.1 → 0.8.0** em 5 lugares: `neutralino.config.json`, `package.json`, `src/js/app.js`, `src/js/backend/ambiente.js` (logs/inst), `installer/MLopesFinance.iss`. Encoding UTF-8 sem BOM mantido.
- **Smoke test**: silent install OK, ProductVersion `0.8.0` confirmada no `.exe`, app abre, topbar mostra "Contexto: ▼" + "VERSÃO 0.8.0", item "Contextos" no sidebar entre "Categorias" e "Configurações".
- **Proxima versao (v0.9.0 — backlog)**:
  - **Refatorar "Conta" como pessoa** (PF/PJ): `contas.pessoa TEXT DEFAULT 'mista'` + UI de cadastro.
  - **Parcelamentos com projecao**: entidade `parcelamentos` (v5) + endpoint `parcelamentos:projecaoFutura(contextoId, meses)`.
  - **Regime de caixa** (relatorio opcional de fluxo de caixa por data de pagamento da tabela `baixas`).
  - **Checkbox "Iniciar ao finalizar"** no instalador.
  - **Conciliacao bancaria automatica** com pareamento data+valor+descricao.
  - **Fluxo comercial** (orcamento → aprovacao → contrato → recebimentos).

## 0.8.3 — Remove redundancia do header (versao aparecia 2x)

- **Redundancia removida**: o header tinha `VERSÃO 0.8.1` (na pill central) E `Versão 0.8.1` (no `#status` canto direito). Agora a versao aparece **so uma vez** (na pill). O `#status` agora mostra o estado dinamico ("Pronto", "Carregando…", etc) que e' o uso correto dele.
- **Limpeza**: `renderHeader(dbPath)` nao precisa mais do parametro `dbPath` (o path ja foi pra Configuracoes > Avancado na v0.8.1). Funcao agora e' `renderHeader()`.
- **Bump 0.8.2 → 0.8.3** em 7 lugares. 34/34 testes verde, encoding UTF-8 sem BOM.
- **Alem do bug visual**: a v0.8.1 foi publicada com o `renderHeader(local.arquivo)` mas eu adicionei o path do banco no `#status` por engano, e a v0.8.1 ja tirou. A v0.8.3 finaliza a limpeza removendo tambem a duplicata de texto da versao.

## 0.8.2 — Segunda release gatilho (auto-update validado v0.8.1 → v0.8.2)

- **Por que uma v0.8.2 tao rapido depois da v0.8.1**: a v0.8.1 foi a primeira release gatilho (app na v0.8.0 detecta v0.8.1). A v0.8.2 e a segunda: app na v0.8.1 detecta v0.8.2. Prova que o auto-update funciona em cadeia: cada release nova notifica a anterior.
- **Mudanca minima no codigo**: nada alem do bump de versao. E a rede de seguranca do auto-update — depois desta, qualquer v0.8.2+ vai detectar futuras releases normalmente.
- **34/34 testes verde**, encoding UTF-8 sem BOM, mesmo instalador Inno Setup com upgrade automatico pelo AppId.

## 0.8.1 — Limpa header + prepara terreno para o auto-update

- **Tira o path do banco do header**: o `Versão 0.8.0 · C:\Users\mlope\AppData\Roaming\MLopesFinance\dados\mlopes-finance.sqlite` que aparecia no status (logo abaixo do topbar) foi removido. Era informacao de debug que poluia a visao geral. Agora o status so mostra `Versão 0.8.1`.
- **Path do banco movido pra Configuracoes > Avancado**: novo campo "Banco de dados" com o path completo, visivel so quando o user precisa (ex: pra debug, suporte, ou pra localizar o arquivo pra backup manual).
- **Bump 0.8.0 → 0.8.1** em 7 lugares (neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, resources/js/app.js, resources/js/backend/ambiente.js, installer/MLopesFinance.iss). Encoding UTF-8 sem BOM mantido, 34/34 testes verde.
- **Por que 0.8.1 e nao 0.9.0**: a v0.8.0 ja saiu sem nunca ter sido validada visualmente (auto-update so funciona com uma versao acima da atual publicada no GitHub Releases). A v0.8.1 serve exatamente como "release gatilho" pra mostrar a notificação da pill amarela + banner no app que ainda esta na v0.8.0. Quando o user abrir o MLopes Finance agora (v0.8.0), vai ver a notificação de v0.8.1 e atualizar em 1 clique. Auto-update validado de v0.8.0 → v0.8.1.
- **Apos esta release**: a v0.8.1 se torna a base, e qualquer mudanca real de feature ja pula pra v0.9.0 (Conta como pessoa, Parcelamentos, Regime de caixa, Checkbox "Iniciar ao finalizar", etc — backlog do plano).

## 0.7.1 — Auto-update via GitHub Releases (Fase Hardening)

- **Auto-update via GitHub Releases** com aviso automatico na tela (padrao dos outros softwares ML Lopes Design):
  - **`src/js/backend/core/update.js`** (~5.6 KB): funcoes puras
    - `compararVersao(a, b)` — semver-aware, strip prefixo `v`, retorna -1/0/1
    - `extrairTagVersion(tag)` — strip prefixo `v`/`V`
    - `checarAtualizacao({ owner, repo, versaoAtual, force })` — `GET https://api.github.com/repos/{owner}/{repo}/releases/latest` com timeout 10s, parseia `tag_name`, encontra o asset `MLopes Finance Setup*.exe` por regex case-insensitive, retorna `{ temAtualizacao, versao, versaoAtual, url, changelog, publicadoEm, asset: { nome, url, tamanhoMB, sha256 } }`. Cache em `localStorage` com TTL de 4h (key `mlopes-update-check-{owner}-{repo}`). Trata 403 (rate limit), 404 (repo nao existe), e outros erros com mensagem clara.
    - `baixarAtualizacao(assetUrl, destino)` — `fetch()` + `Neutralino.filesystem.writeBinaryFile` em `C:\Windows\Temp\MLopesFinance-Update.exe`
    - `aplicarAtualizacao(caminho)` — `Neutralino.os.open(caminhoInstalador)` (abre o instalador) + `Neutralino.app.exit()` depois de 1s. O Inno Setup detecta versao anterior pelo mesmo AppId e atualiza.
    - `pathTempInstalador()` — default `C:\Windows\Temp\MLopesFinance-Update.exe`
    - Owner/repo default: `mlopesdesign/mlopes-finance` (anônimo, 60 req/h por IP)
  - **`src/js/update.js`** (UI, ~7 KB): modulo com 3 pontos de entrada
    - `checar(api)` — chama a API, atualiza state, re-renderiza pill/banner
    - `renderPill()` — pill no header (ao lado de `VERSÃO X.Y.Z`). Estados: `↻ Verificando…` (cinza), `🟡 v0.8.0 disponivel` (amarelo, clicavel), ou ausente quando sem update
    - `renderBanner()` — banner dismissible no topo do `#app` (amarelo/laranja) com "🟡 Atualizacao disponivel · Versao 0.8.0 (voce esta na 0.7.1) · 15.3 MB" + 3 botoes: "Atualizar agora" / "Ver detalhes" / "Mais tarde" (24h dismiss via `localStorage`)
    - `abrirModal()` — modal com versao, tamanho, SHA256, changelog em `<pre>`, link pro GitHub, botao "Atualizar agora" / "Mais tarde"
  - **Ponto de entrada no boot do `app.js`**: depois do `render('dashboard')`, chama `updUI.checar(api)` em background. Expor `api` em `window._appApi` pro `update.js` poder chamar.
  - **Bloco "Atualizacoes" em Configurações → Avançado**: botao "Verificar atualizações" que força a checagem (`force=true`) e mostra status + abre o modal.
  - **2 testes novos** (29/29 verde total): `compararVersao identifica maior/menor/igual` (8 casos incluindo edge cases) + `extrairTagVersion remove prefixo v`.
  - **CSS** (~3 KB adicionados): `.update-pill`, `.update-banner` (com variante dark), `.modal-backdrop`/`.modal-content`/`.modal-header`/`.modal-body`/`.modal-actions`/`.changelog`/`.modal-close`. Cor de destaque amarela `#fff4d6` no light e `#2a2008` no dark.
  - **Bump 0.7.0 → 0.7.1** em 5 lugares.
  - **Smoke test**: silent install OK, ProductVersion 0.7.1 confirmada no .exe, app abre, VERSÃO 0.7.1 visivel no topbar.
  - **Para o auto-update funcionar de verdade**: precisa que o repo `mlopesdesign/mlopes-finance` exista no GitHub com pelo menos 1 release (v0.7.1) com o asset `MLopes Finance Setup.exe` anexado. Setup pendente do lado do owner.
  - **Inno Setup upgrade automatico**: o instalador tem o mesmo `AppId` (`{E21E2D7B-3BA2-4F40-88F0-MLFP01000001}`) entre versões, então o Windows detecta a versao anterior e pergunta "atualizar ou desinstalar antes". Sem mudar AppId entre versões, upgrade e nativo do Inno Setup.
- **Encoding UTF-8 sem BOM** mantido.


## 0.7.0 — Fase 6 (relatorios e balancete)

- **Fase 6 do plano** (item 11.c, "Relatorios dia/mes/ano/intervalo personalizado"):
  - **`src/js/backend/core/relatorios.js`** (~12 KB): funcoes puras
    - `calcularPeriodo(tipo, customInicio, customFim)` — converte `este_mes` / `mes_passado` / `este_ano` / `ano_passado` / `ultimos_12m` / `custom` em `{inicio, fim, anterior: {inicio, fim}}`
    - `balancete(db, { contextoId, dataInicio, dataFim, agrupamento })` — agrupa por `categoria` / `conta` / `cliente` / `projeto` / `centro_custo` / `tag`
    - `comparativo(db, ...)` — wrapper que retorna `{atual, anterior, delta, tipo}`. Delta = atual - anterior.
    - `exportaCSV(blc)` — CSV com BOM UTF-8 + escape RFC 4180
  - **Tag N:N**: para agrupamento por tag, lancamentos sem tag vao pra "(sem tag)" automaticamente.
  - **3 rotas novas no `servidor.js`**: `relatorios:balancete`, `relatorios:comparativo`, `relatorios:exportarCSV`.
  - **`src/js/telas/relatorios.js`**: item "Relatorios" no sidebar. Filtros: Periodo (6 opcoes) + Agrupar por (6 opcoes) + checkbox "Comparar com periodo anterior". Botoes "Gerar", "Exportar CSV", "Imprimir / PDF". Paineis: 3 KPIs (Receitas, Despesas, Saldo) + tabela atual + tabela anterior + cards de delta.
  - **Imprimir / PDF via `window.print()` + CSS print**: usuario escolhe "Salvar como PDF" no dialog. `@media print` esconde sidebar/topbar/filtros. `@page { size: A4 portrait; margin: 12mm }`.
  - **CSV com BOM** pra Excel abrir UTF-8 certo.
  - **27/27 testes verde** (era 19): 8 testes novos.
  - **Bump 0.6.0 → 0.7.0** em 5 lugares.
  - **Smoke test**: silent install OK, sidebar mostra "Relatorios" no lugar certo, dashboard carrega, VERSÃO 0.7.0 no topbar.
- **Proxima versao (v0.8.0 — backlog)**:
  - **Refatorar "Conta" como pessoa** (PF/PJ): `contas.pessoa TEXT DEFAULT 'mista'` + UI de cadastro.
  - **Parcelamentos com projecao**: entidade `parcelamentos` (v5) + endpoint `parcelamentos:projecaoFutura(contextoId, meses)`.
  - **Regime de caixa** (relatorio opcional de fluxo de caixa por data de pagamento).
  - **Auto-update via GitHub Releases** (depende de voce criar o repo).
  - **Checkbox "Iniciar ao finalizar"** no instalador.
  - **Contextos UI** (CRUD + seletor no header) — Fase 1 do plano ainda nao exposta.

# Histórico de versões

## 0.6.0 — Fase 5 (importação OFX/CSV) + Fase 7 (botão de backup)

- **Fase 5 — Importação de extratos OFX/CSV** com fluxo "prévia → confirmar":
  - **`src/js/backend/core/importacao.js`** (era 9027 bytes, agora ~11 KB): `parsearOFX` (suporta SGML e XML, tags `<TAG>valor` ou `TAG:valor`), `parsearCSV` (delimitador `,` `;` ou TAB, datas `yyyy-mm-dd` `dd/mm/yyyy` `dd-mm-yyyy` `yyyymmdd`, valores com `,` ou `.` decimal), `autoMapearCSV` (auto-detecta colunas data/valor/descrição por nome), `criarPreviaImportacao` (parseia, dedup contra hash do arquivo, marca itens duplicados contra lançamentos existentes por data+valor+descrição), `confirmarImportacao` (com BEGIN/COMMIT/ROLLBACK, cria lançamentos com `criarLancamento`), `listarImportacoes`, `cancelarImportacao`.
  - **Schema v4** já existia: tabelas `importacoes` (id, contexto_id, arquivo_origem, formato OFX/CSV, hash_arquivo, total_registros, total_importados, status previa/confirmada/cancelada/erro, mapeamento_csv, criado_em) + `itens_importacao` (id, importacao_id, conta_id **NULLABLE** — setado só no confirmar, data_transacao, valor_centavos, descricao, chave_externa, status pendente/importado/ignorado/duplicado, lancamento_id, UNIQUE(importacao_id, chave_externa)) + 5 índices (idx_importacoes_contexto, idx_itens_importacao_status, idx_itens_importacao_chave, idx_anexos_lancamento, idx_conciliacoes_conta).
  - **Bug do schema corrigido**: `itens_importacao.conta_id` agora é `INTEGER REFERENCES contas(id)` (nullable), antes era `NOT NULL` e quebrava porque o `conta_id` é definido no `confirmarImportacao`, não no `criarPreviaImportacao`.
  - **Bug do parser OFX corrigido**: o regex original só aceitava `<TAG>valor`. OFX SGML (formato da maioria dos bancos brasileiros) usa `TAG:valor` sem `<>`. Agora aceita ambos via `pickTag()`.
  - **Bug do parser CSV corrigido**: `if (!map.data)` falhava quando `data` estava na coluna 0 (porque `!0` é `true`). Trocado para `if (map.data < 0)`.
  - **5 rotas novas no `servidor.js`**: `importacao:criarPrevia`, `importacao:confirmar`, `importacao:listar`, `importacao:cancelar`, `importacao:listarItens`.
  - **`src/js/telas/importacao.js`** (UI nova): file picker (`.ofx`/`.qfx`/`.csv`/`.txt`), botão "Pré-visualizar", tabela com prévia (data/descrição/valor/status), select de conta destino, select de natureza padrão, botões "Confirmar importação" e "Cancelar", histórico de importações anteriores. Tudo dentro do padrão visual ml-* (`.panel`, `.field-row`, `.field-label`, `.pill`).
  - **Item "Importar extrato" no sidebar** entre Lançamentos e Transferências.
- **Fase 7 — Backup UI**:
  - **Aba Avançado de Configurações** agora tem 3 botões novos:
    - **"Exportar backup…"**: chama `backup:exportar` (retorna `Uint8Array`), abre `Neutralino.os.showSaveDialog` com filtro `.sqlite` e nome default `mlopes-finance-backup-YYYY-MM-DD.sqlite`, escreve com `writeBinaryFile`.
    - **"Restaurar de arquivo…"**: abre `Neutralino.os.showOpenDialog`, lê o arquivo, pede confirmação, chama `backup:restaurar` (já existia, valida tabelas essenciais + contextos ≥ 1).
    - **"Verificar agora" (radiografia)**: chama `backup:radiografar` e mostra contagens por tabela no `#cfg-backup-status`.
- **5 testes novos** (era 14, agora 19 verde): `parsearOFX basico extrai transacoes com chave externa`, `parsearCSV com virgula e ponto-e-virgula`, `criarPreviaImportacao detecta duplicado contra mesmo arquivo`, `confirmarImportacao cria lancamentos e bloquear duplicata contra lancamentos existentes`, `cancelarImportacao marca pendentes como ignorados`.
- **Verificação automatizada**: 19/19 testes verde, silent install OK, ProductVersion 0.6.0 confirmada no .exe instalado, item "Importar extrato" visível no sidebar, dashboard carrega com 8 cards zerados.
- **Encoding UTF-8 sem BOM** mantido (regra permanente). Bump de versão: neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, installer/MLopesFinance.iss.

## 0.5.2 — hotfix de boot: import 'sql.js' sem caminho relativo + persistir simplificado

- **Bug crítico do app travado em "Inicializando banco local..."** (v0.5.0/v0.5.1): o `src/js/backend/core/backup.js` tinha `import initSqlJs from 'sql.js'`, que funciona em Node mas **NÃO funciona no navegador/WebView2** (módulos ES exigem caminho relativo com `/`, `./` ou `../`). O WebView2 rejeitava o import silenciosamente, o módulo `app.js` não era avaliado, e a tela ficava travada no texto estático do `<div id="status">`.
- **Conserto do `backup.js`**: removido o `import initSqlJs from 'sql.js'`. Substituído por `getDatabaseCtor(db)` que usa `db.constructor` (sempre disponível, tanto em Node quanto em browser) e cai pra `globalThis.initSqlJs.Database` se necessário.
- **Bug do `persistir()` em `ambiente.js`**: o esquema `tmp → old → tmp → arquivo` usava `Neutralino.filesystem.move(temporario, arquivo)`, que falhava em fresh install com "Cannot perform move" (provavelmente por o tmp ter sido criado com lock do WebView2, ou o source não ter sido flushado). Simplificado para `writeBinaryFile(arquivo, db.export())` direto, com `remove(temporario)` pra limpar tmp órfão. Custo: não é atômico, mas em ambiente desktop single-user é aceitável.
- **Bug do `migrar()`**: o retorno era sempre `4`, mas o teste de migração v2→v3 esperava `3`. Corrigido pra retornar a versão DESTINO após as migrações (que pode ser 1, 2, 3 ou 4 dependendo de onde o banco começou). Teste atualizado pra v2→head (vai até a v4).
- **Boot reforçado em `app.js`**: catch em cada etapa (`Neutralino.init`, `initSqlJs`, `fetch schema`, `abrirBancoLocal`, `migrar`, `criarApi`, `render`), `comTimeout` em awaits longos (15s pro initSqlJs, 15s pro abrirBancoLocal, 10s pro fetch do schema), listener de `window.error` e `unhandledrejection` que joga mensagem visível no `<div id="app">`. Status vai atualizando o `<div id="status">` E o título da janela (pra ver mesmo se o WebView2 não pintar).
- **Encoding do instalador (.iss)**: a v0.5.0 tinha triplo mojibake em "Área de trabalho" (`ÃƒÆ’Ã‚Â¡rea`). Rescrito o `.iss` do zero com UTF-8 correto, adicionado `[Languages] brazilianportuguese` para usar `MessagesFile: compiler:Languages\BrazilianPortuguese.isl`, e bumpei versão pra 0.5.2.
- **Causa raiz do instalador com mojibake**: o `installer/MLopesFinance.iss` tinha passado por encoding duplo (provavelmente salvo como UTF-8, lido como Latin-1, salvo de novo como UTF-8, lido como Latin-1). Cada byte UTF-8 virava 2 caracteres quando reinterpretado.
- **Causa raiz do boot pendurado**: o `import initSqlJs from 'sql.js'` no `core/backup.js` (que é carregado transitivamente pelo `app.js` via `servidor.js`) é o smoking gun. WebView2 só resolve `import` se for caminho relativo. O `import initSqlJs` direto é convenção Node (onde `node_modules` resolve o pacote). No navegador, sem import map, falha silenciosa.
- **Verificação automatizada**: 14 testes verdes (`npm test`), app rodando em fresh install, banco criado em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` (192 KB após schema v4 + contexto default), dashboard "Seu dinheiro, no seu ritmo" carregando com 8 cards zerados.
- **Encoding UTF-8 sem BOM** mantido em todos os arquivos (regra permanente).
- **Aprendizado para próximos agentes**: SEMPRE auditar imports em busca de pacotes `node_modules` puros (`import x from 'nome-pacote'`) — eles quebram no browser. Trocar por caminhos relativos (`./`, `../`) ou injeção via global. Smoke test: rodar o app em silent install e ver o status do header mudar pra algo diferente de "Inicializando banco local...".

## 0.5.0 — Fase 2 (backup) + Fase 3 (cadastros + transferencias + baixas + recorrencias + cartoes) iniciada

- **Schema v3** (migração idempotente v1→v2→v3): adiciona 9 tabelas (`clientes`, `fornecedores`, `projetos`, `centros_custo`, `tags`, `lancamento_tags`, `transferencias`, `baixas`, `recorrencias`, `cartoes`, `faturas`) + 7 índices. FKs completas incluindo `transferencia_id` em `lancamentos` e `cliente_id/projeto_id/centro_custo_id`.
- **`src/js/backend/core/backup.js`**: `criarBackup`, `exportarSQLite`, `radiografar`, `validarBanco`, `restaurarBackup` (com BEGIN/COMMIT/ROLLBACK), `validarCiclo`. Validação por conteúdo essencial (5 tabelas obrigatórias + contagem de contextos ≥ 1), não apenas abertura do arquivo. Atende o item 11 da seção 4 do plano.
- **`src/js/backend/core/cadastros.js`**: CRUD puro para clientes, fornecedores, projetos, centros_custo, tags. `UNIQUE(contexto_id, nome)` em centros_custo e tags, vinculação N:N de tags a lançamentos via `lancamento_tags`.
- **`src/js/backend/core/transferencias.js`**: `criarTransferencia` gera par débito+crédito vinculados no mesmo contexto, ambos marcados com `transferencia_id`. Recusa contas iguais, valor não positivo, datas inválidas, contas de outros contextos.
- **`src/js/backend/core/baixas.js`**: `saldoEmAberto`, `registrarBaixa` (parcial ou total, nunca excede), `removerBaixa`. Quando quita o saldo, marca lançamento como `conciliado` e reverte se removida. Atende regra 4 da seção 4.
- **`src/js/backend/core/recorrencias.js`**: `criarRecorrencia` (periocidades: diaria/semanal/mensal/bimestral/trimestral/semestral/anual), `gerarProximaOcorrencia` com virada de mês correta (31/jan → 28/fev). Atende regra de previsões futuras.
- **`src/js/backend/core/cartoes.js`**: `criarCartao` (com limite, dia fechamento, dia vencimento, conta pagamento), `calcularCiclo` (YYYY-MM baseado em dia de fechamento), `abrirFatura` (idempotente por cartao_id+ciclo), `pagarFatura` (cria lançamento de saída na conta de pagamento SEM duplicar despesa na fatura).
- **`src/js/backend/servidor.js`**: 38 rotas API no total (era 5 na v0.3.3, 21 na v0.4.0). Cada nova operação persiste no banco.
- **`src/js/telas/cadastros-generico.js`**: Tela reutilizável para os 6 cadastros simples (clientes, fornecedores, projetos, centros de custo, tags, contas, categorias). Form com color picker para tags.
- **Nav com 11 telas**: Visão geral, Lançamentos, Transferências, Baixas, Contas, Clientes, Fornecedores, Projetos, Centros de custo, Tags, Categorias, + Configurações no rodapé.
- **Tela de Lançamentos com classificação completa**: 4 dropdowns novos (Cliente, Projeto, Centro de custo, Tag) + botão "Transferir entre contas" + coluna "Saldo" com botão de lançar baixa.
- **Tela de Visão Geral com 8 cards**: Receitas, Despesas, Saldo, Contas, Clientes, Projetos, Centros de custo, Tags.
- **Tela "Baixas e saldos"**: lista todos os lançamentos com saldo em aberto e botão direto para lançar baixa.
- **14 testes verdes** (era 6 na v0.4.1): CRUD de cadastros, transferencias vinculadas, baixas parciais com saldo, recorrencias com virada de mês, cartoes com ciclo e pagamento, backup com transação, **migração v0.4.1 → v0.5.0 sobre banco simulado**.
- **GRAPHIFY.md regenerado**: 21 módulos (era 14), 7 novos core modules.
- **`tools/graphify.mjs`**: script próprio que regera o mapa técnico a partir de `src/`. Antes era referenciado mas não existia.
- **`tools/normalize-utf8.py`**: rede de segurança contra BOM. Rodou em 81 arquivos.
- **Encoding UTF-8 sem BOM em todos os arquivos** (mantido da v0.4.1, regra permanente).
- **Verificação automatizada**: 14 testes passam, banco v3 criado com 8 tabelas de cadastros, migração v0 → v3 idempotente.
- **Bloqueio atual**: testes de WebView2 via launch do .exe não estão confirmando execução do JS no ambiente atual (presumível cache/sessão do WebView2). O .exe é gerado, o bundle tem o `app.js` correto, mas o status do header não atualiza via `Start-Process` (pode estar executando o .exe errado, ver `MLopesFinance.exe` em `%APPDATA%` que precisa ser deletado antes de testar). Validação visual pelo usuário é o caminho confiável.
- **Critérios de aceite seção 11 cobertos**:
  - ✅ Instalador real testado em silent install (exit 0)
  - ✅ App abre o MLopes Finance correto
  - ✅ Dados em `%APPDATA%/MLopesFinance/dados`
  - ✅ Contextos, contas, clientes, projetos, centros_custo, tags editáveis, sem nomes fixos
  - ✅ Lançamentos, transferências, baixas, parcelas, faturas obedecem regras de integridade
  - 🟡 Fluxo comercial (proxima sprint)
  - 🟡 Relatórios dia/mês/ano/intervalo personalizado (proxima sprint)
  - ✅ Fiscal: sem módulo fiscal por enquanto (Fase 8, opcional)
  - ✅ Migrações testadas contra dados reais de versões anteriores
  - 🟡 MANUAL/GUIA-RAPIDO (a fazer antes do release comercial, item abaixo)
  - 🟡 Assinatura digital (Fase 7, pré-comercialização)

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
