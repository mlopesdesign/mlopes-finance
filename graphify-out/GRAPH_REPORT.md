# Graph Report - E:\Projetos\MLOPES FINANCE  (2026-08-12)

## Corpus Check
- 47 files · ~92,998 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 167 nodes · 228 edges · 26 communities (10 shown, 16 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Persistência e Identidade do Banco
- Pipeline de Build e Instalação (ISCC + neu)
- Escopo do Produto (entidades v1 + gaps)
- Camada de UI (app.js monolítico)
- Regras Obrigatórias + Core de Negócio
- Validações e Cadastros Básicos
- Identidade da Aplicação e Stack
- Dívidas de Versionamento e Git
- Bugs Históricos de Build/Path
- Wrapper Node do DB (db.js)
- Verificação de Instalador
- Wrapper DB Espelhado (resources/)
- Verificador Sintático (check.mjs)
- Bug de Inicialização (v0.1.2/v0.1.9)
- Tooling Graphify Ausente
- Proibições de Build CSS
- BOM UTF-8 e Entry HTML
- Updater de Versões (GH release)
- Armadilha ';' no Schema SQL
- Cobertura de Testes Insuficiente
- Documentação Vazia/Minima
- Ícone Candidato (lixo de agente)
- Módulo Fiscal (desacoplado)
- Proibição npm no Cliente
- Alerta Visual (não só som)
- Meta Viewport / Font 16px

## God Nodes (most connected - your core abstractions)
1. `Schema.sql só tem 5 tabelas: meta, contextos, contas, categorias, lancamentos, auditoria. Faltam TODAS as outras 10+ entidades do escopo` - 12 edges
2. `criarApi()` - 10 edges
3. `criarApi()` - 9 edges
4. `abrirBancoLocal()` - 8 edges
5. `criarLancamento()` - 7 edges
6. `render()` - 6 edges
7. `render()` - 6 edges
8. `src/js/backend/schema.sql (5 tabelas: meta, contextos, contas, categorias, lancamentos, auditoria)` - 6 edges
9. `boot()` - 5 edges
10. `criarLancamento()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `DB: alta frequência usa runVolatil() (polling de 4s com .run() multiplicou gravações e APAGOU banco de cliente)` --applies_to--> `abrirBancoLocal()`  [INFERRED]
  AGENTS-BASE-PROJETO-NOVO.md → src/js/backend/ambiente.js
- `Regra 7: migrações idempotentes e testadas contra banco anterior` --implements--> `migrar()`  [INFERRED]
  AGENTS.md → src/js/backend/migracoes.js
- `tools/build-resources.mjs: espelha src/ → resources/ para empacotar` --causes--> `dist/ e release/ commitados (artefatos de build não deveriam ir pro git)`  [INFERRED]
  tools/build-resources.mjs → AGENTS-BASE-PROJETO-NOVO.md
- `Regra 1: regra de negócio em core/, sem DOM/window/Neutralino` --implements--> `criarContexto()`  [INFERRED]
  AGENTS.md → src/js/backend/core/financeiro.js
- `Regra 1: regra de negócio em core/, sem DOM/window/Neutralino` --implements--> `criarLancamento()`  [INFERRED]
  AGENTS.md → src/js/backend/core/lancamentos.js

## Import Cycles
- None detected.

## Communities (26 total, 16 thin omitted)

### Community 0 - "Persistência e Identidade do Banco"
Cohesion: 0.12
Nodes (24): DB: alta frequência usa runVolatil() (polling de 4s com .run() multiplicou gravações e APAGOU banco de cliente), DB: validar backup = radiografar todas as tabelas + exigir movimento, DB: filesystem.move no Windows falha se destino existir (por isso o .old), Pasta de dados: %APPDATA%/MLopesFinance/dados/, Arquivo de banco: mlopes-finance.sqlite, Regra 6: tmp → atual.old → tmp para atual → remove old; jamais remover o atual antes, app, boot() (+16 more)

### Community 1 - "Pipeline de Build e Instalação (ISCC + neu)"
Cohesion: 0.10
Nodes (17): Installer: ISCC.exe (Inno Setup 6), Build: neu build --release (oficial Neutralino 6), tools/build-resources.mjs: espelha src/ → resources/ para empacotar, installer/MLopesFinance.iss (script Inno Setup), portable, result, root, build (+9 more)

### Community 2 - "Escopo do Produto (entidades v1 + gaps)"
Cohesion: 0.11
Nodes (19): Schema.sql só tem 5 tabelas: meta, contextos, contas, categorias, lancamentos, auditoria. Faltam TODAS as outras 10+ entidades do escopo, Anexos (vinculado a lançamento), Auditoria (rastreabilidade de toda ação), Baixas (parciais não podem ultrapassar o aberto), Cartões: fatura por ciclo, parcelas, limite, usado, disponível, comprometimento, Categorias (receita/despesa/ambas), Centros de custo, Clientes (cadastro editável) (+11 more)

### Community 3 - "Camada de UI (app.js monolítico)"
Cohesion: 0.20
Nodes (16): app, boot(), categorias, contas, formCategoria(), formConta(), formLancamento(), money() (+8 more)

### Community 4 - "Regras Obrigatórias + Core de Negócio"
Cohesion: 0.28
Nodes (14): Regra 2: toda UI passa por API; autorização no backend, Regra 4: valores em centavos inteiros, datas YYYY-MM-DD, Regra 5: lançamento conciliado não apaga nem altera (estorno/ajuste), Regra 1: regra de negócio em core/, sem DOM/window/Neutralino, criarCategoria(), criarConta(), criarContexto(), validarData() (+6 more)

### Community 5 - "Validações e Cadastros Básicos"
Cohesion: 0.42
Nodes (9): criarCategoria(), criarConta(), criarContexto(), validarData(), validarValorCentavos(), conciliarLancamento(), criarLancamento(), resumo() (+1 more)

### Community 6 - "Identidade da Aplicação e Stack"
Cohesion: 0.25
Nodes (8): applicationId: com.mlopesdesign.mlopesfinance, binaryName: MLopesFinance, Stack: JS ES modules + Neutralino 6 + WebView2 + sql.js, neutralino.config.json (versão 0.2.2, applicationId, modes), PROIBIDO: Electron (vetado, quebrou versão anterior), PROIBIDO: Java (exige runtime no cliente), PROIBIDO: React, Vue, Angular, Svelte, PROIBIDO: TypeScript (dono do projeto lê e edita o código)

### Community 7 - "Dívidas de Versionamento e Git"
Cohesion: 0.33
Nodes (7): DB: SQLite não altera CHECK; reconstruir tabela em transação conferindo contagem, Branch é 'master', AGENTS.md seção 9 obriga 'main', dist/ e release/ commitados (artefatos de build não deveriam ir pro git), Repositorio git SEM COMMITS (.git existe mas master vazio), Versão 0.2.2 (atual) NAO está documentada no HISTORICO-DE-VERSOES (para em 0.1.9), Regra 8: cada build sobe versão + testes + docs + mapa + histórico, Regra 7: migrações idempotentes e testadas contra banco anterior

### Community 8 - "Bugs Históricos de Build/Path"
Cohesion: 0.50
Nodes (4): v0.1.3: index.html referenciava /src/... em vez de /resources/..., v0.1.5: neutralino.config.json sem url; carregava / enquanto bundle tinha /resources/, v0.3.2: build usa asar.createPackage (não oficial do Neutralino 6), v0.3.2 REPROVADO: instalador abre página default do Neutralino em vez do app

### Community 10 - "Verificação de Instalador"
Cohesion: 0.50
Nodes (3): dir, required, root

## Knowledge Gaps
- **63 isolated node(s):** `contas`, `categorias`, `app`, `root`, `root` (+58 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tools/build-resources.mjs: espelha src/ → resources/ para empacotar` connect `Pipeline de Build e Instalação (ISCC + neu)` to `Persistência e Identidade do Banco`, `Dívidas de Versionamento e Git`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `abrirBancoLocal()` connect `Persistência e Identidade do Banco` to `Regras Obrigatórias + Core de Negócio`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `contas`, `categorias`, `app` to the rest of the system?**
  _63 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Persistência e Identidade do Banco` be split into smaller, more focused modules?**
  _Cohesion score 0.11965811965811966 - nodes in this community are weakly interconnected._
- **Should `Pipeline de Build e Instalação (ISCC + neu)` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Escopo do Produto (entidades v1 + gaps)` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._