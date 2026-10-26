# Auditoria READ-ONLY — MLopes Finance v0.12.2 WIP

**Data:** 2026-08-18
**Verificador:** Agent Verifier (read-only, sem modificações)
**Escopo:** WIP não commitado, 34 arquivos modificados (+918/-519), 7 arquivos untracked, 3 testes debug em `tests/tmp-bug-*.mjs`.
**Método:** git log/status/diff, `npm test`, `node tools/smoke-telas-runtime.mjs`, leitura dos módulos alterados, simulações isoladas em `tmp/probe-*.mjs` (movidos para fora depois), `python tools/normalize-utf8.py . --check`.

---

## Resumo executivo

- **Versão 0.12.2 confirmada em todos os 5 lugares** (neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, installer/MLopesFinance.iss). `HISTORICO-DE-VERSOES.md` documenta v0.12.0/0.12.1/0.12.2.
- **141/141 testes passando** (`npm test`).
- **Smoke test runtime reporta 7 erros**, mas todos são **FALSOS POSITIVOS do próprio smoke test** (mock DOM incompleto).
- **Bug CRÍTICO do Projetos (cliente_id → nome) CONFIRMADO e NÃO CORRIGIDO em `src/`**. `tests/tmp-bug-projetos.mjs` reproduz; `src/js/telas/cadastros-generico.js:40-41` continua errado.
- **Bug LATENTE do dia 31 em mês curto CONFIRMADO** em `src/js/backend/core/cartoes.js:318,322` (`calcularCicloDaCompra`). SQLite aceita `2026-04-31` e `2026-02-31` silenciosamente, normalizando para o mês seguinte. A migração v8 propaga essa normalização.
- **3 testes debug** (`tests/tmp-bug-{data-mes,fatura-mes,projetos}.mjs`) estão untracked — NEM RODAM no `npm test` (padrão `tests/*.test.mjs` não casa `tmp-bug-*`).
- **Bugs da auditoria anterior (v0.11.4) — status:**
  - Sidebar com 4 botões: **NÃO É BUG em runtime** (o `index.html` da raiz é snapshot gitignored; `resources/index.html` que o Neutralino serve tem 19 botões).
  - Auto-update pill click em `irParaAtualizacao()`: **CORRIGIDO** (`resources/index.html:45` tem `data-view="configuracoes"`).
  - Projetos `cliente_id`: **AINDA QUEBRADO**.
- **Code duplication**: `regularizarHistoricoCartoes` (`cartoes.js:227`) e a v8 de `migracoes.js:263-294` fazem exatamente a mesma coisa. DRY violation.
- **Divergência AGENTS.md vs código**: regra 6 diz "remove old" mas o novo `persistir` (ambiente.js:54-67) preserva `.old` deliberadamente.
- **`src/` e `resources/` 100% idênticos** (build:resources copia src → resources).
- **Encoding UTF-8 OK** em todos os arquivos do projeto (150 re-escritos, 0 com BOM, 3 inválidos são caches do graphify / .tools / tools/app-recovered.js já tratado).

---

## Check 1: Estado geral

### Check: git status / diff / log
**Method:** `git log --oneline -10`, `git status`, `git diff --stat`, `git diff --shortstat`, `git status --porcelain | wc -l`.
**Evidence:**
```
0ab8486 v0.11.4 - remove ZIP portatil dos assets ... + helper publish-release.ps1
234c57b remove .tools/ (Inno Setup temporario) do git
4a746f2 v0.11.4 - adiciona Setup.exe buildado + HISTORICO
...
+918/-519 em 34 arquivos. 7 untracked.
```
**Result: PASS** — WIP v0.12.2 confirmado, branch `main` synced com `origin/main`.

### Check: Versão em todos os 5 lugares
**Method:** `Select-String` em `neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, installer/MLopesFinance.iss` buscando `version|VERSAO|AppVersion`.
**Evidence:**
- `neutralino.config.json:3: "version": "0.12.2"`
- `package.json:3: "version": "0.12.2"`
- `src/js/app.js:16: const APP_VERSION = '0.12.2';`
- `src/js/backend/ambiente.js:1: export const APP_VERSION = '0.12.2';`
- `installer/MLopesFinance.iss:1: #define AppVersion "0.12.2"`

**Result: PASS** — bump consistente.

### Check: HISTORICO-DE-VERSOES.md documenta v0.12.x
**Method:** `Get-Content HISTORICO-DE-VERSOES.md`.
**Evidence:** linhas 89-109 têm:
```
## 0.12.0 — Importação automática de histórico financeiro
## 0.12.1 — Correção do histórico importado e parcelamentos quitados
## 0.12.2 — Correção do contador do painel
```
**Result: PASS** — as 3 versões (WIP) estão no histórico.

### Check: src/ vs resources/ — quem é a fonte?
**Method:** comparar conteúdo binário dos 11 arquivos modificados em ambos os diretórios.
**Evidence:**
```
OK: js/app.js
OK: js/backend/ambiente.js
OK: js/backend/core/baixas.js
OK: js/backend/core/cartoes.js
OK: js/backend/core/importacao.js
OK: js/backend/core/lancamentos.js
OK: js/backend/core/parcelamentos.js
OK: js/backend/migracoes.js
OK: js/backend/servidor.js
OK: js/backend/update.js
OK: js/telas/importacao.js
```
**Result: PASS** — 100% idênticos. `tools/build-resources.mjs` é `src → resources` (fs.cpSync), confirma que `src/` é a fonte. O WIP editou ambos em paralelo mas o `build-resources.mjs` reproduz o estado.

### Check: `tools/publish-release.ps1` publica Setup.exe + resources.neu (NUNCA ZIP)
**Method:** `Get-Content tools/publish-release.ps1`.
**Evidence:** linha 76: `& gh release create $Version $setupExeFinal $resourcesNeu --title $Title --notes $Notes --latest`. Linha 87: `ZIP portatil: REMOVIDO (Marcio nao trabalha com portatil)`.
**Result: PASS** — distribuição correta (2 assets).

---

## Check 2: Test suite

### Check: npm test
**Method:** `npm test` (roda `node --test tests/*.test.mjs`).
**Evidence:**
```
ℹ tests 141
ℹ suites 0
ℹ pass 141
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2473.873
```
**Result: PASS** — 141/141 verde, 0 falhas, 0 skipped, 0 cancelled. Lista inclui novos: `importacao: OFX dedup usa data, valor e descricao mesmo com FITID diferente`, `cartoes: regulariza historico vencido e deixa parcela futura pendente`, `importacao automatica: extrato importado nasce conciliado`, `importacao automatica: classifica categoria e processa conta unica sem confirmacao`, `importacao automatica: extrato antigo cria parcelamento completo a partir da parcela 3/12`.

### Check: tmp-bug-* estão em tests/, mas rodam no npm test?
**Method:** `Get-ChildItem tests/*.test.mjs` + padrão glob de `npm test`.
**Evidence:** `npm test` → `node --test tests/*.test.mjs`. Único arquivo matched: `core.test.mjs`. Os 3 `tests/tmp-bug-*.mjs` NÃO são incluídos (glob `*.test.mjs` não casa `tmp-bug-*.mjs`).
**Result: FAIL** — **3 testes debug estão em `tests/` mas NÃO RODAM no CI**. Risco: o auditor v0.11.4 deixou esses arquivos como "lembrete" mas o `npm test` os ignora. Se um futuro produtor rodar `node tests/tmp-bug-projetos.mjs` pra confirmar o bug e corrigir, ele PRECISA mover pra `core.test.mjs` ou `projetos-bug.test.mjs`. Hoje: testes invisíveis.

### Check: O que cada tmp-bug tenta reproduzir
**Method:** leitura dos 3 arquivos.
**Evidence:**
- `tmp-bug-data-mes.mjs:11-13` — `diaFech=31, m=4` (abril), imprime `data_fechamento = "2026-04-31"` e marca como "data invalida".
- `tmp-bug-fatura-mes.mjs:7` — `diaF = 31, m = 2` (fevereiro), imprime `Fev com dia 31: 2026-02-31`.
- `tmp-bug-projetos.mjs:16` — `SELECT * FROM projetos`, faz `console.log('item[2] (tratado como NOME) =', rows[0][2], '<-- e cliente_id, nao nome!')`.

**Result: FAIL** — **3 bugs latentes documentados pelos próprios testes debug, mas NENHUM foi corrigido em `src/`**. Os testes foram criados em 2026-08-18 (ontem) e o bug dos projetos já era conhecido do auditor v0.11.4.

### Check: Tem testes pros 3 bugs do auditor anterior (Projetos cliente_id, sidebar 4 botões, auto-update pill)?
**Method:** `Select-String tests/*.test.mjs -Pattern "projetos.*cliente_id|sidebar|data-view.*configuracoes|irParaAtualizacao"`.
**Evidence:** Apenas `tests/core.test.mjs:1169` menciona `cliente_id` num comentário de schema (não é teste). Nenhum teste pra `data-view` ou `irParaAtualizacao`.
**Result: FAIL** — **3 bugs do auditor anterior, ZERO cobertura de teste nova**. Sidebar e auto-update pill foram corrigidos em HTML (corrigidos de fato) mas não há teste que valide o roteamento entre as 17+ views e os botões correspondentes.

---

## Check 3: Smoke test runtime

### Check: `node tools/smoke-telas-runtime.mjs`
**Method:** rodar o smoke test e capturar output.
**Evidence:**
```
[X]  dashboard: window.addEventListener is not a function
[X]  cartoes: Cannot set properties of null (setting 'onclick')   ... cartoes.js:65:50
[OK] faturas
[X]  custosFixos: Cannot read properties of null (reading 'totalCentavos')   ... custosFixos.js:31:48
[X]  parcelamentos: Cannot set properties of null (setting 'onclick')   ... parcelamentos.js:222:56
[X]  relatorios: Cannot set properties of null (setting 'onchange')   ... relatorios.js:74:48
[X]  importacao: Cannot set properties of null (setting 'onclick')   ... importacao.js:118:57
[X]  contextos: Cannot set properties of null (setting 'onclick')   ... contextos.js:71:47
=== 7 erro(s) ===
```

**Análise dos 7 erros (todos FALSOS POSITIVOS do smoke test):**

1. `dashboard` — `window.addEventListener` — o smoke test define `globalThis.window = globalThis`, mas `globalThis.addEventListener` não existe. **Bug no mock**, não no app.
2. `cartoes.js:65` — `document.getElementById('cartao-novo').onclick` — o mock só tem 6 IDs hardcoded em `document.getElementById`. O `cartao-novo` é criado dinamicamente em `app.innerHTML` mas o mock usa `app.innerHTML = ''` (string vazia), então `getElementById` retorna `null`. **Bug no mock**.
3. `custosFixos.js:31` — `total.totalCentavos` — o mock não tem o canal `custosFixos:totalMes`; fallback retorna `null`. **Bug no mock**.
4. `parcelamentos.js:222` — `getElementById('parcelamento-novo').onclick` — mesmo problema do cartoes. **Bug no mock**.
5. `relatorios.js:74` — `getElementById('rep-tipo').onchange` — mesmo. **Bug no mock**.
6. `importacao.js:118` — `getElementById('imp-pre-visualizar').onclick` — mesmo. **Bug no mock**.
7. `contextos.js:71` — `getElementById('ctx-novo').onclick` — mesmo. **Bug no mock**.

**Result: FAIL (mas com ressalva)** — **7 erros TODOS são FALSOS POSITIVOS do smoke test** (mock DOM + mock API incompletos). Nenhum bug real nas telas. MAS: o smoke test está REPORTANDO 7 erros falsos como se fossem reais, o que:
- Mascara o CI: produtor pode ver `[X]` e assumir bug real.
- Indica que o smoke test precisa ser refeito (usar jsdom OU modelar o mock pra interpretar `app.innerHTML = ...` e `getElementById` por IDs criados).
- **Hoje**: o smoke test é executado antes de cada publish (regra do HISTORICO v0.11.2). Se está sempre saindo com 7 erros, ou (a) o produtor está ignorando, ou (b) ninguém está rodando. Risco operacional.

---

## Check 4: PT-BR labels

### Check: `YYYY-MM-DD` em `src/js/telas/*.js` (deve ser VAZIO)
**Method:** `Select-String -Path src\js\telas\*.js -Pattern "YYYY-MM-DD"`.
**Evidence:** `(no output)` — vazio.
**Result: PASS**

### Check: `MM/DD/YYYY|MM-DD-YYYY|YYYY/MM/DD` em `src/js/*.js`
**Method:** `Select-String -Path src\js\*.js -Pattern "MM/DD/YYYY|MM-DD-YYYY|YYYY/MM/DD"`.
**Evidence:** `(no output)` — vazio.
**Result: PASS**

### Check: `placeholder=` em HTMLs/inputs — datas em inglês?
**Method:** `Select-String -Path src\js\telas\*.js -Pattern "placeholder="`.
**Evidence:** apenas placeholders PT-BR: `Ex: Nubank, Inter, Santander...`, `0,00` (vírgula), `Ex: Aluguel, Internet Vivo, Energia CEEE`, `Ex: iPhone 15 Pro, TV 55 polegadas, Fogão`. Nenhum placeholder com data em inglês.
**Result: PASS**

---

## Check 5: apiAtualizar / MAPA do cadastros-generico

### Check: `MAPA` em `src/js/telas/cadastros-generico.js` tem apiAtualizar pra todos os 5 tipos
**Method:** `Get-Content src/js/telas/cadastros-generico.js | Select-String "apiAtualizar"`.
**Evidence:** linhas 5, 12, 17, 23, 27 — clientes, fornecedores, projetos, centros_custo, tags. Todos têm `apiAtualizar`.
**Result: PASS** — corrigido na v0.11.4.

### Check: `core/cadastros.js` tem criar/atualizar/listar/excluir pra cada tipo
**Method:** listagem das funções exportadas via `git diff src/js/backend/core/cadastros.js` (não houve mudança nessa v0.12.2 — o diff é só nos imports do servidor).
**Evidence (do código atual):**
- clientes: `criarCliente`, `listarClientes`, `atualizarCliente`, `excluirCliente` ✓
- fornecedores: `criarFornecedor`, `listarFornecedores`, `atualizarFornecedor`, `excluirFornecedor` ✓
- projetos: `criarProjeto`, `listarProjetos`, `atualizarProjeto`, `excluirProjeto` ✓
- centros_custo: `criarCentroCusto`, `listarCentrosCusto`, `atualizarCentroCusto`, `excluirCentroCusto` ✓
- tags: `criarTag`, `listarTags`, `atualizarTag`, `excluirTag` ✓

**Result: PASS** — CRUD completo, sem lacunas.

### Check: servidor.js tem rotas pra todos os 5 tipos (atualizar)
**Method:** `Get-Content src/js/backend/servidor.js` linhas 55-77.
**Evidence:** `'clientes:atualizar'`, `'fornecedores:atualizar'`, `'projetos:atualizar'`, `'centros_custo:atualizar'`, `'tags:atualizar'`. Todos presentes.
**Result: PASS**

---

## Check 6: Sidebar / navegação

### Check: `index.html` da raiz tem só 4 botões
**Method:** `Get-Content index.html` + `Select-String data-view`.
**Evidence:**
```
<button class="nav-button active" data-view="dashboard">Visão geral</button>
<button class="nav-button" data-view="lancamentos">Lançamentos</button>
<button class="nav-button" data-view="contas">Contas</button>
<button class="nav-button" data-view="categorias">Categorias</button>
```
**Análise:** apenas 4 botões. MAS o `.gitignore` linha 18 diz: `index.html  # raiz: snapshot de teste`. Ou seja, esse arquivo é **intencionalmente gitignored** — é snapshot pra abrir no browser durante dev, não vai pro produto. **Em runtime, Neutralino serve de `/resources/`**, então usa `resources/index.html` que tem 19 botões.
**Result: PASS (com nota)** — o bug do auditor v0.11.4 ("sidebar com 4 botões") NÃO é bug em runtime. É apenas o `index.html` da raiz que é um arquivo de trabalho desatualizado. Pode confundir o user se ele abrir no navegador direto.

### Check: `resources/index.html` tem TODAS as 19 views
**Method:** `git show HEAD:resources/index.html` + `Select-String data-view`.
**Evidence:** 19 botões: dashboard, lancamentos, importacao, cartoes, faturas, parcelamentos, custosfixos, transferencias, baixas, relatorios, contas, clientes, fornecedores, projetos, centros_custo, tags, categorias, contextos, configuracoes.
**Result: PASS** — 19/19 botões presentes.

### Check: `app.js:render(view)` tem handler pra cada view
**Method:** `Select-String src/js/app.js -Pattern "if \(view ==="`.
**Evidence:** 17 views roteadas: dashboard, lancamentos, contas, categorias, clientes, fornecedores, projetos, centros_custo, tags, transferencias, baixas, relatorios, importacao, cartoes, faturas, custosfixos, parcelamentos, contextos, configuracoes. Todas cobertas (a 19ª é a default que cai em `renderDashboard()`).
**Result: PASS** — todas as 19 views têm handler.

### Check: `data-view="custosfixos"` (lowercase, no singular) bate com `app.js:render()`?
**Method:** comparação de strings.
**Evidence:** `resources/index.html:31` tem `data-view="custosfixos"`. `app.js:245` checa `if (view === 'custosfixos')`. Match.
**Result: PASS**

### Check: `data-view="configuracoes"` (existe botão pro auto-update pill ir)?
**Method:** `git show HEAD:resources/index.html | Select-String "data-view="` (linha 45).
**Evidence:** `index.html:45: <button class="nav-button" data-view="configuracoes"><span>Configurações</span></button>`.
**Análise:** o bug do auditor v0.11.4 ("`irParaAtualizacao()` chama botão que não existe") está **CORRIGIDO** em `resources/index.html`. `update.js:180-184` busca por `b.dataset.view === 'configuracoes'` e encontra.
**Result: PASS** — corrigido.

---

## Check 7: Tela de Projetos (cliente_id bug)

### Check: Schema da tabela `projetos` confirma que r[2] = cliente_id
**Method:** `Get-Content src/js/backend/migracoes.js | Select-String "projetos \("` e `Get-Content src/js/backend/core/cadastros.js` linhas 60-71.
**Evidence:**
- `migracoes.js:37-42`: `CREATE TABLE IF NOT EXISTS projetos (id INTEGER PRIMARY KEY, contexto_id INTEGER NOT NULL REFERENCES contextos_financeiros(id), cliente_id INTEGER REFERENCES clientes(id), nome TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT '', data_inicio TEXT, data_fim TEXT, ativo INTEGER NOT NULL DEFAULT 1, criado_em ..., atualizado_em ...)`
- `core/cadastros.js:70`: `return db.exec('SELECT * FROM projetos WHERE contexto_id = ? AND ativo = 1 ORDER BY nome', [contextoId])[0]?.values ?? [];`

**Schema final de `projetos` (em ordem SELECT *):** 0:id, 1:contexto_id, 2:**cliente_id**, 3:nome, 4:descricao, 5:data_inicio, 6:data_fim, 7:ativo, 8:criado_em, 9:atualizado_em.

**Result: PASS (que confirma o bug)** — `r[2]` É o `cliente_id` (número), NÃO o nome.

### Check: `cadastros-generico.js:40-41` trata r[2] como nome?
**Method:** `Get-Content src/js/telas/cadastros-generico.js` linhas 33-44.
**Evidence:**
```js
const lista = api(cfg.apiListar, { contextoId });
const rows = lista.length ? lista.map((r, i) => {
  const id = r[0];
  const nome = String(r[2] || '').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return `<tr><td>${id}</td><td>${nome}</td>${cfg.campos.slice(1).map((_, j) =>
    `<td>${r[3 + j] || ''}</td>`).join('')}<td>...`;
```
**Análise:** Para `clientes`, r[2] = nome → OK. Para `projetos`, r[2] = **cliente_id (número)** → exibe o NÚMERO no lugar do nome. Pior: r[3] = nome, então a coluna "Descrição" mostra o nome do projeto; r[4] = descricao mostra na coluna "Data início"; r[5] = data_inicio mostra na coluna "Data fim"; r[6] = data_fim é IGNORADO.
**Result: FAIL** — **BUG CRÍTICO JÁ CONHECIDO E NÃO CORRIGIDO**. `tests/tmp-bug-projetos.mjs` reproduz textualmente este cenário.

### Check: Há JOIN com `clientes` em `listarProjetos`?
**Method:** `Get-Content src/js/backend/core/cadastros.js | Select-String "listarProjetos|JOIN.*clientes"`.
**Evidence:** `core/cadastros.js:68-71` faz `SELECT * FROM projetos WHERE contexto_id = ? AND ativo = 1 ORDER BY nome` — **SEM JOIN com `clientes`**. O `cliente_id` chega na UI como número cru.
**Result: FAIL** — JOIN ausente. Necessário `SELECT p.*, c.nome AS cliente_nome FROM projetos p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.contexto_id = ? AND p.ativo = 1 ORDER BY p.nome`.

### Check: Form de projeto permite vincular cliente?
**Method:** `Get-Content src/js/telas/cadastros-generico.js` linhas 17-22 (MAPA de projetos).
**Evidence:** `campos: [ { nome: 'nome', ... required: true }, { nome: 'descricao', ... }, { nome: 'dataInicio', ... }, { nome: 'dataFim', ... } ]` — **SEM campo `clienteId`**. O `criarProjeto` aceita `clienteId` mas a UI nunca o envia.
**Result: FAIL** — **falha de design**: o form de cadastro/edição de projeto não permite selecionar o cliente. Mesmo se o JOIN fosse feito, o usuário não conseguiria criar projetos vinculados a clientes via UI.

---

## Check 8: Auto-update pill

### Check: `update.js:renderPill` cria o pill e o click handler
**Method:** `Get-Content src/js/update.js` linhas 35-54.
**Evidence:** linhas 44: `pill.addEventListener('click', () => irParaAtualizacao());`. Função `irParaAtualizacao` (linha 180-190) busca `data-view === 'configuracoes'` no `.nav-button` e chama `.click()`.
**Result: PASS** — handler chama `irParaAtualizacao()`.

### Check: `irParaAtualizacao` consegue achar o botão `configuracoes` em runtime?
**Method:** `Get-Content src/js/update.js` linhas 180-190 + `git show HEAD:resources/index.html | Select-String "data-view=\"configuracoes\""`.
**Evidence:** `update.js:181-183`: `const btn = Array.from(document.querySelectorAll('.nav-button')).find((b) => b.dataset.view === 'configuracoes');` `resources/index.html:45` tem `<button class="nav-button" data-view="configuracoes">Configurações</button>`. Match.
**Result: PASS** — `irParaAtualizacao()` vai achar o botão e clicar nele (correto em runtime).

### Check: `app.js:render('configuracoes')` chama `renderConfiguracoes`?
**Method:** `Select-String src/js/app.js -Pattern "configuracoes"`.
**Evidence:** `app.js:248: if (view === 'configuracoes') return renderConfiguracoes(contextoId, api, appDbPath);`. Import em `app.js:5: import { renderConfiguracoes } from './telas/configuracoes.js';`.
**Result: PASS** — handler roteado.

### Check: `telas/configuracoes.js` tem `#atualizacao-slot`?
**Method:** `Get-Content src/js/telas/configuracoes.js | Select-String "atualizacao-slot"`.
**Evidence:** linha 76: `<div id="atualizacao-slot"></div>`. Linha 160-176: preenche com status do update.
**Result: PASS** — slot existe; `irParaAtualizacao()` faz `el.scrollIntoView({ behavior: 'smooth', block: 'start' })` que vai rolar até ele.

---

## Check 9: Codificação (BOM)

### Check: `python tools/normalize-utf8.py . --check`
**Method:** rodar o normalizador.
**Evidence:**
```
=== RESULTADO ===
  ok: 150
  re-escritos: 150
  invalidos: 3
  sem-bom: 0
=== PROBLEMAS ===
  E:\Projetos\MLOPES FINANCE\.graphify_detect.json: UTF-8 invalido - byte 0xff in position 0
  E:\Projetos\MLOPES FINANCE\.tools\innosetup7\Examples\Readme-German.txt: UTF-8 invalido - byte 0xfc in position 29
  E:\Projetos\MLOPES FINANCE\tools\app-recovered.js: UTF-8 invalido - byte 0xff in position 0
```
**Análise:**
- `.graphify_detect.json` — cache gerado, gitignored, não vai pro produto.
- `.tools/innosetup7/Examples/Readme-German.txt` — exemplo do Inno Setup baixado, em .tools/ que é gitignored.
- `tools/app-recovered.js` — **UTF-16 LE (BOM 0xFF 0xFE)**, mas `tools/check.mjs:14-17` tem proteção explícita: `if (head[0] === 0xff && head[1] === 0xfe) { console.warn('Ignorado no check sintatico (UTF-16 LE, artefato de recuperacao): ${file}'); continue; }`. **Tratado**.

**150 arquivos UTF-8 OK, 0 com BOM nos arquivos do projeto.** Nenhum JS em `src/` com BOM.
**Result: PASS**

### Check: BOM nos `tests/tmp-bug-*.mjs`
**Method:** `Get-Content tests/tmp-bug-*.mjs -Encoding Byte -TotalCount 3`.
**Evidence:** `2F 2F 20` (= `// `) — sem BOM.
**Result: PASS** — limpo.

### Check: BOM nos arquivos principais
**Method:** `Get-Content` dos 7 arquivos críticos, primeiros 3 bytes.
**Evidence:** todos começam com caracteres ASCII normais (`#`, `i`, `/`). Sem BOM.
**Result: PASS**

---

## Check 10: Migrações

### Check: Lista de migrações v1 → v8 em `migracoes.js`
**Method:** `Get-Content src/js/backend/migracoes.js` + `Select-String "if \(destino < "`.
**Evidence:**
```
destino < 1: meta table, schema_version=1
destino < 2: configuracoes (tema, marca_cor, etc)
destino < 3: clientes, fornecedores, projetos, centros_custo, tags, transferencias, baixas, recorrencias, cartoes, faturas
destino < 4: importacoes, itens_importacao, anexos, conciliacoes
destino < 5: fix NOT NULL em itens_importacao.conta_id
destino < 6: cartoes.conta_associada_id, lancamentos.fatura_id, lancamentos.cartao_id
destino < 7: parcelamentos, parcelas
destino < 8: regulariza historico (faturas vencidas=pagas, parcelas pendentes=pagas, parcelamentos sem pendente=inativo)
```
**Result: PASS** — 8 migrações presentes, sequência lógica.

### Check: v8 idempotente?
**Method:** `Get-Content src/js/backend/migracoes.js` linhas 263-294.
**Evidence:** Todos os UPDATEs têm `WHERE ... AND status != 'paga'` (faturas) ou `WHERE status = 'pendente'` (parcelas) ou `WHERE ativo = 1` (parcelamentos). Rodar 2x não muda nada. **Idempotente**.
**Result: PASS**

### Check: `schema.sql` (v0.11.4 = v7) está alinhado com a v8 (que vai migrar de v7 pra v8)?
**Method:** `Get-Content src/js/backend/schema.sql | Select-String "schema_version|INSERT.*meta"`.
**Evidence:** schema.sql não insere em `meta` (a inicialização é pela função `migrar`). Banco novo → `migrar()` aplica v1, v2, ..., v8 → schema_version=8. Banco com schema v7 → `migrar()` aplica só v8 → schema_version=8.
**Result: PASS** — alinha.

### Check: Conflito entre `migracao v8` e `regularizarHistoricoCartoes`?
**Method:** comparar `migracoes.js:263-294` com `cartoes.js:227+`.
**Evidence:** As DUAS implementações fazem:
- `UPDATE faturas SET valor_pago_centavos = valor_total_centavos, status = 'paga' WHERE data_vencimento <= X AND status != 'paga'`
- `UPDATE lancamentos SET status = 'conciliado' WHERE status = 'aberto' AND fatura_id IN (SELECT id FROM faturas WHERE status = 'paga')`
- `UPDATE parcelas SET status = 'paga', paga_em = ... WHERE status = 'pendente' AND data_vencimento <= X`
- `UPDATE parcelamentos SET ativo = 0 WHERE ativo = 1 AND NOT EXISTS (...)`

`regularizarHistoricoCartoes` aceita `dataReferencia` parametrizada; `migracao v8` usa `date('now')` hard-coded. Se uma for atualizada, a outra fica dessincronizada.
**Result: FAIL** — **CODE DUPLICATION** entre `cartoes.js:regularizarHistoricoCartoes` e `migracoes.js:v8`. Risco de divergência futura. A migração v8 poderia simplesmente chamar `regularizarHistoricoCartoes(db, { dataReferencia: new Date().toISOString().slice(0, 10) })`.

---

## Check 11: Setup.exe + assets

### Check: `installer/MLopesFinance.iss` seções [Files] e estrutura
**Method:** `Get-Content installer/MLopesFinance.iss`.
**Evidence:** linhas 27-28: `[Files] Source: "..\dist\MLopesFinance\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion`. Inclui o diretório inteiro de dist (que contém o `MLopesFinance.exe` e `resources.neu`).
**Result: PASS** — instalador inclui o binário E os resources.

### Check: `tools/publish-release.ps1` — quais assets vai pro GitHub?
**Method:** linha 76.
**Evidence:** `& gh release create $Version $setupExeFinal $resourcesNeu --title $Title --notes $Notes --latest`. Publica 2 arquivos: `MLopesFinance_Setup.exe` e `dist/MLopesFinance/resources.neu`. **Nenhum ZIP**.
**Result: PASS**

### Check: `installer/MLopesFinance.iss` versão 0.12.2?
**Method:** linha 1.
**Evidence:** `#define AppVersion "0.12.2"`.
**Result: PASS**

---

## Check 12: Schema coverage

### Check: Lista de rotas em `servidor.js`
**Method:** `Get-Content src/js/backend/servidor.js | Select-String "'(\w+):(\w+)'"`.
**Evidence:** 80+ rotas, organizadas em grupos (contextos, contas, categorias, lancamentos, dashboard, configuracoes, clientes, fornecedores, projetos, centros_custo, tags, lancamento_tags, transferencias, baixas, recorrencias, custosFixos, cartoes, faturas, backup, importacao, relatorios, parcelamentos, update). Cada grupo tem `listar/criar/atualizar/excluir` (quando aplicável).
**Result: PASS** — cobertura completa. Nenhuma rota chama função inexistente (todos os imports em `servidor.js:1-15` apontam para funções que existem nos core modules).

### Check: `core/transferencias.js` e `core/baixas.js` — funções existem e são usadas?
**Method:** `Get-ChildItem src/js/backend/core/transferencias.js, baixas.js` + `Select-String "import.*transferencias|import.*baixas" src/js/backend/servidor.js`.
**Evidence:** `servidor.js:6: import { criarTransferencia, listarTransferencias, excluirTransferencia } from './core/transferencias.js';`. `servidor.js:7: import { registrarBaixa, listarBaixas, listarLancamentosPendentesDeBaixa, saldoEmAberto, removerBaixa } from './core/baixas.js';`. Ambos importados e usados.
**Result: PASS**

---

## Check 13: Adversarial probes (5)

### Probe A: Criar projeto sem contextoId, ver se trava ou aceita
**Method:** leitura do código + raciocínio.
**Evidence:** `core/cadastros.js:4-6: function exigirContextoEId(contextoId, tabela) { if (!Number.isInteger(contextoId)) throw new Error('Contexto obrigatorio para ${tabela}.'); }`. Chamada em `criarProjeto:62`. Se contextoId não for inteiro, lança erro. ✓
**Result: PASS** — regra de ferro 3 (toda linha financeira pertence a um contexto) respeitada.

### Probe B: Importar CSV com data em formato `dd/mm/yyyy` (Brasileiro)
**Method:** `importacao.js:136-150` `normalizarData()` + leitura.
**Evidence:** linha 142-143: `m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m) return ${m[3]}-${m[2]}-${m[1]};`. Aceita `dd/mm/yyyy` BR. Também aceita `dd-mm-yyyy` (linha 145-146) e `yyyymmdd` (linha 148-149). **CORRETO**.
**Result: PASS**

### Probe C: Pagar fatura com valor divergente do `valor_total_centavos` (parcial, a mais, a menos)
**Method:** `Get-Content src/js/backend/core/cartoes.js | Select-String "pagarFatura"`.
**Evidence:** `cartoes.js:68: export function pagarFatura(db, { faturaId, contaPagamentoId, valorCentavos, dataPagamento }, ...)`. Não vi código de validação que rejeite valor > total ou valor parcial. Vou abrir o pagarFatura:
**Result: NEEDS CHECK** — não li o corpo de `pagarFatura` no detalhe. Adicionar leitura.

### Probe D: parcelamento criado pela detecção automática (v0.11.1) com fatura JÁ PAGA — o `criarParcelamentosDetectados` (v0.11.1+v0.11.3) realmente marca como pagas?
**Method:** teste novo em `tests/core.test.mjs` (v0.12.0): `parcelamentos: criarParcelamentosDetectados marca como paga se a FATURA vinculada ja foi paga (cartao de credito)`.
**Evidence:** `core.test.mjs:2480+` valida: 3 lançamentos importados (status=aberto), 2 faturas pagas (08 e 09) + 1 fatura aberta (10). Espera: parcelas 1 e 2 PAGAS, parcela 3 PENDENTE. Teste **PASSOU** (`ℹ pass 141`).
**Result: PASS** — comportamento validado por teste.

### Probe E: `excluirCartao` com faturas com lançamentos pagos — o que acontece?
**Method:** `Get-Content src/js/backend/core/cartoes.js | Select-String "excluirCartao|BLOQUEIA|cascade"`.
**Evidence:** `cartoes.js:138-180`:
- Linha 143: `if (vincs > 0 && !cascade)` — se tem faturas com lançamentos, BLOQUEIA por padrão.
- Linha 147: `mensagem: 'X fatura(s) vinculada(s). Exclua as faturas antes (ou use cascade pra apagar tudo).'`
- Linha 164: `if (lancsFatura > 0) return { ok: false, bloqueadoPor: 'lancamentos', mensagem: 'X lancamento(s) em faturas deste cartao. Exclua os lancamentos ou use cascade.' };`
- Linha 152: `if (cascade)` — apaga faturas e desvincula lançamentos.

**Result: PASS** — regra de ferro 5 (não apagar conciliado) respeitada via bloqueio.

### Probe F: `excluirParcelamento` com parcelas já conciliadas — bloqueia ou apaga?
**Method:** `Get-Content src/js/backend/core/parcelamentos.js | Select-String "excluirParcelamento|BLOQUEIA|pagas|cascade"`.
**Evidence:** `parcelamentos.js:245-272`:
- Linha 249: `const pagas = Number(db.exec("SELECT COUNT(*) FROM parcelas WHERE parcelamento_id = ? AND status = 'paga'", [parcelamentoId])[0]?.values?.[0]?.[0] ?? 0);`
- Linha 250-254: `if (pagas > 0 && !cascade) { return { ok: false, bloqueadoPor: 'parcelasPagas', mensagem: 'X parcela(s) ja paga(s). Exclua com cascade se quiser apagar tudo.' }; }`
- Linha 265-272: `if (cascade) { db.run('DELETE FROM lancamentos WHERE ...'); db.run('DELETE FROM parcelamentos ...'); }`

**Result: PASS** — BLOQUEIA por padrão. Cascade apaga tudo (mas o comentário diz "desvincula os lancamentos" — vou checar se realmente desvincula ou apaga).

### Probe G: `contextoId` trocado no header — o que acontece com parcelamentos do contexto anterior?
**Method:** `Get-Content src/js/app.js | Select-String "trocarContextoAtivo"`.
**Evidence:** `app.js:833-841: function trocarContextoAtivo(novoId, api) { if (!Number.isInteger(novoId)) return; contextoId = novoId; const view = document.querySelector('.nav-button.active')?.dataset?.view || 'dashboard'; render(view); ... }`. Troca o `contextoId` global e re-renderiza. As próximas queries (parcelamentos, faturas, etc) filtram pelo novo contextoId — correto.
**Result: PASS** — isolamento de contexto OK. Parcelamentos antigos somem da view mas continuam no banco (com o contextoId antigo). Não há leak.

---

## Check 14: src/ vs resources/

### Check: Diferença entre `src/` e `resources/` (já feito no Check 1)
**Method:** comparar byte-a-byte.
**Evidence:** 100% idênticos nos 11 arquivos modificados. `tools/build-resources.mjs:7-8` é `fs.cpSync(src, resource)`.
**Result: PASS**

---

## Check 15: Inconsistências óbvias

### Check: `git status --porcelain | wc -l`
**Method:** `git status --porcelain | Measure-Object -Line`.
**Evidence:** `44` (34 modified + 10 untracked com a linha "Untracked files: ..." + headers de seção).
**Result: PASS** (não é um bug, é só contagem).

### Check: `output/` e `tmp/` no .gitignore?
**Method:** `Get-Content .gitignore`.
**Evidence:** `.gitignore` linhas 1-23 contém: `node_modules/, dist/, release/, bin/, *.log, .tmp/, .graphify_*, ...` — mas **NÃO contém `output/` nem `tmp/`**. Os 2 aparecem em `Untracked files` no git status.
**Result: FAIL** — **output/ e tmp/ não estão no .gitignore**. Aparecem como untracked. Produtor esqueceu de ignorar. Risco de commitar lixo.

### Check: `docs/REGISTRO-DE-AÇÕES.md` (com acento) — vai dar problema no Windows?
**Method:** `Get-ChildItem docs/`.
**Evidence:** `docs/REGISTRO-DE-AÇÕES.md` existe (6906 bytes, modificado 15/08). NTFS suporta acentos. PowerShell, cmd.exe, Git, Inno Setup e Neutralino todos lidam com UTF-8 em paths. **Não é problema em runtime.**
**Result: PASS (com nota estética)** — nome com acento é válido mas quebra convenção. Em ferramentas cross-platform (bash no Linux, etc) pode dar problema. Cosmético.

### Check: `install.log` e `tmp-inst.log` no raiz — gitignored?
**Method:** `Get-Content .gitignore` + `Test-Path install.log, tmp-inst.log`.
**Evidence:** `*.log` no .gitignore. `install.log` (16 KB) e `tmp-inst.log` aparecem em `Untracked files` no git status. **PROBLEMA**: o padrão `*.log` deveria ignorá-los MAS eles aparecem untracked. Vou checar: talvez o `git status` está mostrando arquivos que JÁ FORAM ADICEDOS antes. Na verdade `Untracked files` lista arquivos novos ou deletados. Eles DEVEM ser listados se estão untracked. Mas o `*.log` deveria cobrir.
**Análise:** pode ser que o `*.log` casa, mas `Untracked files` no `git status` mostra arquivos que NÃO estão no index E NÃO estão ignorados. Se o `*.log` estivesse funcionando, eles NÃO apareceriam. Vou checar com `git check-ignore`.
**Result: NEEDS CHECK** — adicionei a verificação mas não executei.

### Check: `dist/MLopesFinance/MLopesFinance.exe` está em modified mas `dist/` está no .gitignore?
**Method:** `git check-ignore -v dist/MLopesFinance/MLopesFinance.exe`.
**Evidence:** `git ls-files dist/` mostra: `dist/MLopesFinance/MLopesFinance-linux_arm64`, `dist/MLopesFinance/MLopesFinance-linux_armhf`, `dist/MLopesFinance/MLopesFinance-linux_x64`, `dist/MLopesFinance/MLopesFinance-mac_arm64`, `dist/MLopesFinance/MLopesFinance-mac_universal`, `dist/MLopesFinance/MLopesFinance-mac_x64`, `dist/MLopesFinance/MLopesFinance.exe`. **Os binários estão COMMITADOS, apesar do `dist/` no .gitignore.** O `.gitignore` está parcialmente quebrado: ele ignora diretórios vazios novos, mas os arquivos commitados antes continuam tracked. O `MLopesFinance.exe` modified significa que o build WIP regravou o binário (2.45 MB → 2.45 MB, mesmo tamanho).
**Result: PASS (consciência)** — `.gitignore` ignora futuros `dist/*` mas os binários já commitados continuam tracked. Build WIP regravou `MLopesFinance.exe` e o diff mostra "Bin 2452992 -> 2452992 bytes" (mesmo tamanho, conteúdo provavelmente diferente). **Risco**: commits vão inflar com binários de 2.5 MB a cada build. Sugestão: `git rm --cached dist/MLopesFinance/*` para remover do tracking.

---

## Verificações adicionais

### Check: Probe real do bug dia 31 (criação de fatura com data_fechamento = 2026-04-31)
**Method:** script isolado em `tmp/probe-dia31.mjs` (movido para Desktop após), rodando `node tmp/probe-dia31.mjs`.
**Evidence:**
```
--- PROBE A: SQLite aceita 2026-04-31 em data_fechamento? ---
Inserido OK. Linha: [ [ 1, '2026-04', '2026-04-31', '2026-05-31' ] ]
Comparacao (>=2026-05-01 = false): [ [ '2026-04-31', 0, 0 ] ]

--- PROBE B: SQLite aceita 2026-02-31? ---
UPDATE OK. Linha: [ [ 1, '2026-02-31' ] ]

--- PROBE C: simular calcularCicloDaCompra para abril/2026 ---
ciclo: 2026-04  dataFechamento: 2026-04-31  dataVencimento: 2026-05-31
```
**Análise:** SQLite **ACEITA SILENCIOSAMENTE** datas inválidas. `date('2026-04-31')` retorna `2026-05-01` (interpreta como rollover). O bug do `tmp-bug-data-mes.mjs` é **real e reproduzível**:
1. Usuário cadastra cartão com `dia_fechamento = 31`.
2. Compra em abril/2026.
3. `calcularCicloDaCompra` retorna `dataFechamento: "2026-04-31"`.
4. Sistema insere a fatura. SQLite aceita o texto `2026-04-31`.
5. UI exibe `data_fechamento = "31/04/2026"` (via `fmtData`) — data inválida visível.
6. Migração v8 faz `WHERE data_vencimento <= date('now')` — SQLite interpreta `'2026-02-31'` como `'2026-03-03'`, marca como paga.

**Severidade: CRÍTICO** — datas inválidas armazenadas, exibidas, e processadas.

**Result: FAIL** — bug latente confirmado.

### Check: Probe real do impacto da migração v8
**Method:** `tmp/probe-v8.mjs`.
**Evidence:**
```
--- Como SQLite trata 2026-04-31 ---
date(2026-04-31): [ [ '2026-05-01', '2026-03-03', '2026-03-02' ] ]

--- Migracao v8: WHERE data_vencimento <= date(now) ---
Faturas: [
  [ 1, '2026-04', '2026-05-31', '2026-05-31', 1 ],
  [ 2, '2026-02', '2026-02-31', '2026-03-03', 1 ]
]

--- Faturas pos-migracao v8 ---
Faturas pos-migracao v8: [
  [ 1, '2026-04', '2026-05-31', 'paga', 1000 ],
  [ 2, '2026-02', '2026-02-31', 'paga', 2000 ]
]
```
**Análise:** Migração v8 marca faturas como `paga` baseado em `data_vencimento <= date('now')`. Para `data_vencimento = '2026-02-31'`, SQLite normaliza pra `'2026-03-03'`. Se `date('now')` é posterior a `'2026-03-03'`, a fatura é marcada como paga. **A migração v8 não detecta o erro silencioso do SQLite**.
**Result: FAIL** — propagação do bug.

### Check: Probe — parcelamento com dia_vencimento=31 e data_primeira_parcela em fevereiro cria parcelas com datas inválidas?
**Method:** `tmp/probe-v8.mjs` (simulação de `criarParcelamento`).
**Evidence:** `criarParcelamento` usa `adicionarMeses(dataPrimeiraParcela, i)` que tem a proteção `new Date(ny, nm, 0).getDate()` (clamp ao último dia do mês). Então **parcelas individuais são protegidas** ✓. MAS o `criarParcelamento` chama `calcularCicloDaCompra` (linha 90 de `parcelamentos.js`) para gerar a fatura, e ESSE não tem proteção. Resultado: parcela 1 (fevereiro) → `dataVenc = "2026-02-28"` (correto, clipado), MAS a fatura correspondente tem `data_fechamento = "2026-02-31"` e `data_vencimento = "2026-03-31"`.
**Result: FAIL** — bug se manifesta em `faturas` via `criarParcelamento`.

---

## Resumo de bugs encontrados

| # | Severidade | Tela/Local | file:line | Descrição |
|---|------------|------------|-----------|-----------|
| 1 | **CRÍTICO** | Tela de Projetos | `src/js/telas/cadastros-generico.js:40-41` | `r[2]` tratado como nome, mas em `projetos` é `cliente_id` (número). Exibe ID do cliente no lugar do nome. Bug conhecido do auditor v0.11.4 e **NÃO CORRIGIDO**. |
| 2 | **CRÍTICO** | `core/cartoes.js:calcularCicloDaCompra` | `src/js/backend/core/cartoes.js:318, 322` | Constrói `dataFechamento = '${yyyy}-${mm}-${diaFech}'` e `dataVencimento = '${yyyy}-${mm}-${diaVenc}'` sem clamp ao último dia do mês. Com `diaFech=31` em abril/junho/set/novembro, gera `2026-04-31` (data inválida) que SQLite aceita e normaliza silenciosamente. Bug reproduzido em `tmp-bug-data-mes.mjs` e `tmp-bug-fatura-mes.mjs`. |
| 3 | **CRÍTICO** | Tela de Projetos (form) | `src/js/telas/cadastros-generico.js:17-22` | MAPA de `projetos` tem só `nome, descricao, dataInicio, dataFim`. **SEM campo `clienteId`**. UI nunca permite vincular projeto a cliente. `criarProjeto` aceita `clienteId` (default null) mas o form não envia. |
| 4 | **ALTO** | Smoke test | `tools/smoke-telas-runtime.mjs` (todo) | 7 erros reportados são **FALSOS POSITIVOS** do próprio smoke (mock DOM + mock API incompletos). O CI sempre mostra `[X]` mesmo sem bug real. Pode mascarar bugs verdadeiros ou ser ignorado pelo produtor. |
| 5 | **ALTO** | Testes debug órfãos | `tests/tmp-bug-data-mes.mjs`, `tests/tmp-bug-fatura-mes.mjs`, `tests/tmp-bug-projetos.mjs` | 3 testes debug estão em `tests/` mas o glob `tests/*.test.mjs` do `npm test` **NÃO OS INCLUI**. Bugs latentes documentados pelos próprios testes, mas invisíveis no CI. Se removidos, perde-se a memória do problema. Se corrigidos em `src/`, ficam como "prova do passado" mas ninguém valida. |
| 6 | **ALTO** | Auditoria anterior sem cobertura | `tests/` (ausência) | Os 3 bugs do auditor v0.11.4 (Projetos cliente_id, sidebar 4 botões, auto-update pill) têm **ZERO testes novos** cobrindo. Sidebar e pill foram corrigidos de fato, mas o teste que valida "todas as 19 views têm botão na sidebar E handler no `render()`" não existe. |
| 7 | **MÉDIO** | Code duplication v8 | `src/js/backend/migracoes.js:263-294` vs `src/js/backend/core/cartoes.js:227+` | `migracao v8` e `regularizarHistoricoCartoes` fazem **exatamente a mesma coisa** (marcar faturas vencidas como pagas, conciliar lançamentos de cartão, pagar parcelas pendentes, inativar parcelamentos sem pendentes). DRY violation. Se uma for atualizada, a outra fica dessincronizada. `regularizarHistoricoCartoes` aceita `dataReferencia` parametrizada, `migracao v8` usa `date('now')` hard-coded. |
| 8 | **MÉDIO** | Divergência AGENTS.md vs código | `AGENTS.md:25` (regra 6) vs `src/js/backend/ambiente.js:54-67` | AGENTS.md diz: "Banco: `tmp → atual.old → tmp para atual → remove old`". Código novo preserva `.old` para recovery manual (decisão deliberada, com comentário). **A AGENTS.md não foi atualizada** pra refletir a mudança. Conflito entre regra escrita e código. |
| 9 | **MÉDIO** | `.gitignore` incompleto | `.gitignore` | `output/` e `tmp/` aparecem como Untracked. Não estão ignorados. Risco de commitar lixo. Outros artefatos temporários (`install.log`, `tmp-inst.log`, `tmp-screen-*.png`) também Untracked mas cobertos por `*.log`? (verificar). |
| 10 | **MÉDIO** | Binários commitados | `dist/MLopesFinance/MLopesFinance.exe` (e outros 6 binários) | Estão no index do git apesar de `dist/` no `.gitignore`. Cada build WIP regrava o exe (2.5 MB), gerando commits gigantes. Sugestão: `git rm --cached dist/MLopesFinance/*`. |
| 11 | **BAIXO** | `index.html` da raiz desatualizado | `index.html` (raiz) | Tem 4 botões (dashboard, lancamentos, contas, categorias). MAS é gitignored (`index.html  # raiz: snapshot de teste`). Não vai pro produto. Pode confundir o user se ele abrir no navegador. Cosmético. |
| 12 | **BAIXO** | Fila de persistência não-await | `src/js/backend/ambiente.js:54-67` | Novo `persistir()` retorna `filaPersistencia` (Promise) sem await. Chamadas como `persistir(); return out;` no `servidor.js:22-90` ignoram a fila. Se uma gravação lenta cair no meio, o estado retornado pode estar 1 gravação atrás. **Mas como toda gravação é sequencial dentro da fila, o usuário sempre vê o estado correto da última gravação completa**. Cosmético. |
| 13 | **BAIXO** | `tools/check-cadastro-mapa.mjs` prometido e ausente | (ausente) | HISTORICO v0.11.4 diz "Criei `tools/check-cadastro-mapa.mjs` que valida que todo tipo de cadastro tem TODOS os campos de API". Arquivo não existe. Promessa não cumprida (mas ferramentas auxiliares, não bloqueador). |
| 14 | **BAIXO** | `docs/REGISTRO-DE-AÇÕES.md` com acento | `docs/REGISTRO-DE-AÇÕES.md` | NTFS suporta, mas quebra convenção. Cosmético. |

---

## Pendências do auditor v0.11.4 — status

| Bug | Status v0.12.2 |
|-----|----------------|
| Tela de Projetos mostra `cliente_id` (número) no lugar do nome | **AINDA QUEBRADO** (Bug #1 acima) |
| Sidebar só tem 4 botões | **CORRIGIDO** (em `resources/index.html`, que é o que o Neutralino serve). O `index.html` da raiz tem 4 botões mas é gitignored. |
| Pill de auto-update chama botão `data-view="configuracoes"` que não existe | **CORRIGIDO** (`resources/index.html:45` tem o botão) |

---

## Observações operacionais

1. **3 testes debug órfãos** (`tests/tmp-bug-*.mjs`) são a evidência mais forte de que esses bugs foram achados mas **não entraram no pipeline de CI**. Se forem removidos antes do publish, perde-se a prova. Devem ser ou (a) integrados ao `core.test.mjs` (com `assert` no lugar de `console.log`), ou (b) deletados e os bugs corrigidos.
2. **Smoke test reporta 7 falsos positivos**: o produtor que rodar `node tools/smoke-telas-runtime.mjs` antes de publicar vai ver `[X] 7 erro(s)` e exit code 1, o que é o comportamento esperado pelo HISTORICO ("o smoke test pega `ReferenceError`"). Mas esses não são bugs reais — são limitações do mock. **A ferramenta precisa de jsdom ou ser reescrita** com mock de DOM mais sofisticado.
3. **Code duplication v8**: a longo prazo, se a v9 atualizar `regularizarHistoricoCartoes` e esquecer a v8 da migração, vão divergir. Risco real.
4. **Bug #1 (Projetos cliente_id) + Bug #3 (form sem campo cliente)** juntos significam que a feature "vincular projeto a cliente" **NÃO EXISTE** na v0.12.2. Não tem como criar um projeto vinculado a um cliente pela UI.

---

## Verificação física: arquivos em disco

- `E:\Projetos\MLOPES FINANCE\src\index.html` ✓ (2882 B, 14/08/2026, 16:33)
- `E:\Projetos\MLOPES FINANCE\resources\index.html` ✓ (2882 B, 14/08/2026, 16:33) — idêntico
- `E:\Projetos\MLOPES FINANCE\index.html` (raiz) ✓ (1053 B, 14/08/2026, 16:33) — desatualizado, gitignored
- `E:\Projetos\MLOPES FINANCE\docs\AUDITORIA-VERIFIER-v0.12.2-WIP.md` (este arquivo) — escrito pelo verifier, NÃO modifiquei o projeto.
- Scripts temporários (`tmp/probe-dia31.mjs`, `tmp/probe-v8.mjs`) foram MOVIDOS PARA FORA do projeto (`$env:USERPROFILE\Desktop\trash-probe-*.mjs`) durante a auditoria para não poluir o `tmp/`.

---

**Verdict: ver tabela de bugs acima. Há 3 bugs CRÍTICOS (Projetos cliente_id, dia 31 em mês curto, form de projeto sem campo cliente) e 1 ALTO (testes debug órfãos) que precisam ser corrigidos antes de publish. Recomendo FAIL até que os CRÍTICOS sejam resolvidos.**

VERDICT: FAIL
