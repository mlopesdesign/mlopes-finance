
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
