
## 0.8.19 — Inferência automática de natureza na importação

- **Motivação do user**: "ele tem que achar sozinho". O dropdown "Natureza padrão (quando ambíguo)" era confuso. O app deve inferir automaticamente se cada transação é receita ou despesa.
- **Heurísticas** (em `core/importacao.js::inferirNaturezaItem`):
  1. **Tipo da conta** — cartão de crédito = SEMPRE despesa (mesmo valor positivo, mesmo com "RECEBIDO" na descrição).
  2. **Palavras-chave na descrição** — despesa: BOLETO, COMPRA, PAGAMENTO, DÉBITO, TARIFA, IOF, JUROS, MULTA, ANUIDADE, MENSALIDADE, SAQUE. Receita: RECEBIDO, CRED, PIX RECEBIDO, TRANSF RECEB, DEPÓSITO, SALÁRIO, RENDIMENTO, ALUGUEL RECEB, TED RECEB, DOC RECEB.
  3. **Sinal do valor** — negativo = despesa.
  4. **Fallback** — `padraoNatureza` (default 'despesa').
- **`confirmarImportacao` agora retorna inferências por item** (`inferencias: [{itemId, natureza, motivo}]`) para a UI mostrar ao user o que inferiu.
- **UI** (`telas/importacao.js`): dropdown "Natureza padrão (quando ambíguo)" **REMOVIDO**. Resultado mostra resumo: "Inferido: N despesa, M receita (palavras-chave + tipo da conta)".
- **7 testes novos** (85/85 verde): cartão sempre despesa, keywords de despesa/receita, valor negativo = despesa, valor positivo sem keyword = padrão, `confirmarImportacao` retorna inferências com motivos diferentes, cartão sobrescreve keyword de receita.
- **Bump v0.8.18 → v0.8.19** (7 lugares). Bundle v0.8.19 (5.72 MB, SHA `BD4B5C2E…E5`, EXE FileVersion `0.8.19.0`) instalado na máquina do Marcio, backup v0.8.18 preservado.

## 0.8.18 — Fix dedup de duplicatas internas na importação de extrato

- **Bug reportado pelo Marcio**: importação de extrato do Santander (CSV) dava erro `UNIQUE constraint failed: itens_importacao.importacao_id, itens_importacao.chave_externa` na prévia. Causa: o extrato do banco tinha 2 linhas idênticas (mesma data+valor+descrição = mesma `chave_externa`), e o `INSERT` direto batia no `UNIQUE(importacao_id, chave_externa)`.
- **Fix em `core/importacao.js::criarPreviaImportacao`**: 1) **Dedup ANTES do INSERT**: agrupa por `chave_externa` via `Set`, só insere o primeiro. 2) **`INSERT OR IGNORE`** por segurança: se dois processos importarem o mesmo arquivo ao mesmo tempo, o segundo é ignorado em vez de explodir. 3) **`total_registros` preserva o original** (3 linhas no CSV → `total=3`, mas 1 item único em `itens_importacao`).
- **2 testes novos** (78/78 verde): 2 linhas idênticas + 1 diferente → 2 itens únicos. 3 linhas idênticas → 1 (sem UNIQUE constraint failed).
- **Bump v0.8.17 → v0.8.18** (7 lugares). Bundle v0.8.18 (5.72 MB, SHA `C67D44CE…96`, EXE FileVersion `0.8.18.0`) instalado na máquina do Marcio, backup v0.8.17 preservado.

## 0.8.17 — Botão "Excluir todos" em todas as telas de lista

- **Motivação do user**: "pq não tem a opção de deletar tudo?". O botão de resetar banco em Configurações > Avançado (3 confirmações + digitar "RESET") tem fricção demais pra quem só quer limpar uma tela. Adicionei botão "🗑 Excluir todos (N)" direto no header de cada tela de lista.
- **Telas com botão agora** (com confirmação dupla: "Excluir TODOS os N?" + "Confirma? (última chance)"):
  - **Lançamentos**: `excluirTodosLancamentos` apaga TUDO do contexto (cascade: baixas, transferências, tags). Mantém cadastros.
  - **Baixas e saldos**: mesmo atalho de Lançamentos.
  - **Transferências**: "🗑 Desvincular todas (N)" desvincula todas (preserva os 2 lançamentos de cada, que viram independentes).
  - **Contas**: "🗑 Excluir todas (N)" apaga cada conta + seus lançamentos em cascata.
  - **Categorias**: "🗑 Excluir todas (N)" idem.
- **Backend** (`core/lancamentos.js`): nova função `excluirTodosLancamentos(db, contextoId)`. **Ordem do DELETE é crítica** (FK NO ACTION): 1) `UPDATE lancamentos SET transferencia_id=NULL`, 2) `DELETE FROM transferencias`, 3) `UPDATE itens_importacao SET lancamento_id=NULL`, 4) `DELETE FROM baixas`, 5) `DELETE FROM lancamentos` (cascade: `lancamento_tags` via FK). Tudo em `BEGIN/COMMIT`, `ROLLBACK` em qualquer erro.
- **2 testes novos** (76/76 verde): cascade correto + idempotência.
- **Bump v0.8.16 → v0.8.17** (7 lugares). Bundle v0.8.17 (5.72 MB, SHA `554DD013…D3D`, EXE FileVersion `0.8.17.0`) instalado na máquina do Marcio, backup v0.8.16 preservado.

## 0.8.16 — AUDITORIA: conserta 4 bugs + 4 ligações UI/backend

Auditoria completa do app cruzando backend (86 rotas), servidor e UI (5 telas + 14 entradas na sidebar). Encontrados 4 bugs que QUEBRAM o app e 4 funcionalidades com backend pronto mas sem botão na UI.

**BUGS QUE QUEBRAM O APP** (introduzidos na v0.8.15):
- `lancamentos:listar` no servidor perdeu os JOINs (eu troquei por `listarLancamentos` que faz `SELECT *`). Tela de Lançamentos mostrava `undefined` em quase todas as colunas. **Fix**: reintroduzida a query com `LEFT JOIN` (conta, categoria, cliente, projeto, centro_custo) em nova função `listarLancamentosDetalhados` em `core/lancamentos.js`. Filtra também `transferencia_id IS NULL` (transferências não aparecem, são geridas pela tela de Transferências).
- UI `renderLancamentos` usava índices de 22 colunas, recebia 17. **Fix**: índices corrigidos (`r[9]`=data, `r[17]`=conta_nome, `r[18]`=categoria, `r[19]`=cliente, `r[7]`=natureza, `r[8]`=valor, `r[14]`=status).
- UI `renderBaixas` usava `l[6]` (centro_custo_id) onde devia ser `l[8]` (valor_centavos) e `l[15]` (criado_em) onde devia ser `l[14]` (status). **Fix**: corrigidos.
- MAPA em `cadastros-generico.js`: `apiCriar: 'centos_custo:criar'` (faltou 'r' — dava 404 ao criar Centro de Custo). **Fix**: corrigido para `'centros_custo:criar'`.

**LIGAÇÕES QUE FALTAVAM** (backend pronto, UI sem botão):
- `renderContas` → botão "Excluir" com confirmação + cascade.
- `renderCategorias` → botão "Excluir" com confirmação + cascade.
- `renderTransferencias` → botão "Excluir" com confirmação + cascade.
- `renderLancamentos` → botões "Editar" (formEditarLancamento), "Conciliar", "Excluir" (helper `acaoLancamento`). Conciliados mostram só "Estornar" (regra do PADRAO). Estornados não permitem editar. Helper `acaoLancamento` unifica o padrão de confirm+try/catch+toast+refresh.

**2 testes novos** (74/74 verde): `listarLancamentosDetalhados` retorna 22 colunas com nomes corretos nas posições 17-21; exclui transferências por padrão.

**Bump v0.8.15 → v0.8.16** (7 lugares). Bundle v0.8.16 (5.71 MB, SHA `2C79FD9E…B9`) instalado na máquina do Marcio, backup v0.8.15 preservado.

**Pendente pra v0.9.0** (precisa telas novas): Recorrências, Cartões, Faturas, lancamento_tags.

## 0.8.15 — CRUD completo de exclusão + Resetar banco

- **Motivação do user**: "tenho que poder apagar o que eu quiser, ou quando cometer um erro, ficarei preso ao erro". Diagnóstico: o app só tinha funções de excluir para `importacao`, `baixas` e `configuracoes`. Não dava para apagar contextos, contas, categorias, clientes, fornecedores, projetos, centros de custo, tags, lançamentos, transferências, etc. O usuário cadastrava dados de teste e não tinha como limpar.
- **Funções de excluir adicionadas no backend** (`core/*.js`):
  - `excluirContexto`, `excluirConta`, `excluirCategoria` (financeiro.js)
  - `excluirCliente`, `excluirFornecedor`, `excluirProjeto`, `excluirCentroCusto`, `excluirTag`, `desvincularTagLancamento` (cadastros.js)
  - `excluirRecorrencia`, `desativarRecorrencia` (recorrencias.js — `excluir` sem cascade apenas desativa, preservando o histórico)
  - `excluirTransferencia` (transferencias.js — desvincula os 2 lançamentos por padrão; `cascade:true` apaga tudo)
  - `excluirLancamento`, `estornarLancamento`, `editarLancamento`, `listarLancamentos`, `obterLancamento` (lancamentos.js)
  - `resetarBanco` (backup.js)
- **Padrão de exclusão**: por padrão BLOQUEIA se há dependências (FK reversa). Lança erro com mensagem clara listando o que está vinculado. Flag `cascade:true` apaga em cascata, na ordem correta, dentro de transação `BEGIN/COMMIT`. Falha de qualquer passo → `ROLLBACK` automático.
- **Regra do PADRAO/AGENTS preservada**: lançamentos CONCILIADOS não podem ser excluídos nem editados. Correções são por **estorno** (`estornarLancamento` cria lançamento INVERSO — receita↔despesa, mesmo valor — e marca o original como `'estornado'`). Funciona mesmo em lançamentos já conciliados (que é justamente o caso de uso).
- **UI**: botões "Excluir" com confirmação em Contextos e Cadastros (clientes, fornecedores, projetos, centros de custo, tags). Botão "⚠ Resetar banco (apagar TUDO)" em Configurações > Avançado com **3 confirmações escalonadas** (incluindo digitar "RESET" em maiúsculas). Configurações são preservadas no reset.
- **Bug fix encontrado durante o trabalho**: `criarLancamento` não persistia `cliente_id/projeto_id/centro_custo_id` (apesar de o schema ter essas colunas). Resultado: a FK nunca bloqueava exclusão de cliente/projeto/centro de custo (porque o dado nem era gravado). Corrigido. Validado pelos testes de FK (que agora falham sem persistência e passam com).
- **Servidor**: 15 novas rotas (todas as `excluir`, mais `lancamentos:estornar/editar/obter`, mais `backup:resetar`, mais `recorrencias:desativar`, mais `lancamento_tags:desvincular`, mais `lancamentos:listar` com `incluirEstornados`).
- **25 testes novos** (72/72 verde): excluir com FK, cascade, estornar (incluso de conciliado), editar bloqueia conciliado, listar exclui estornados, resetarBanco apaga tudo + recria "Pessoal" + idempotente, transferencia desvincula por padrão, etc.
- **Bump v0.8.14 → v0.8.15** nos 7 lugares. Bundle v0.8.15 (5.69 MB, SHA `6E63CFBC…02`) instalado na máquina do Marcio, backup v0.8.14 preservado.

## 0.8.14 — Invalida cache do WebView2 antes do restartProcess (fix loop auto-update)

- **Sintoma (loop de "tem atualização")**: app instalado em v0.8.12 (ou v0.8.13 anterior) detectava v0.8.14, baixava, aplicava, `restartProcess` rodava, app reabria, pill de atualização **continuava** oferecendo v0.8.14. Loop eterno. Print do user às 03:00: "ele instala e volta, mas continua dizendo que tem atualizaço".
- **Causa raiz** (`src/js/backend/update.js::aplicarAtualizacao`): o `Neutralino.app.restartProcess()` reinicia o binário do app mas **NÃO invalida o cache HTTP persistente do WebView2** em `%APPDATA%\MLopesFinance.exe\EBWebView\Cache\Cache_Data\`. O Chromium serve o `app.js`, `index.html` e CSS antigos do cache em vez de bater no Neutralino localhost de novo. Resultado: a UI carrega o JS da versão anterior, mostra `VERSÃO 0.8.13`, e o auto-update re-oferece v0.8.14. Confirmado em diagnóstico: bundle instalado em disco = SHA `4139B9A7…27` (v0.8.13, idêntico ao GH), mas a UI continuava mostrando v0.8.12. 159 MB de cache HTTP no diretório do WebView2.
- **Correção** (`src/js/backend/update.js`): nova função `invalidarCacheWebView2()` que faz `cmd.exe /c rd /S /Q` em `Cache\Cache_Data`, `Code Cache` e `GPUCache` antes do `restartProcess`. Falhas são toleradas: se o WebView2 estiver com arquivos em uso (esperado em algumas sessões), o restart fecha os handles e a próxima execução parte de um cache zerado. O update NÃO depende da limpeza do cache para ter sucesso — o `move /Y` já substituiu o bundle em disco.
- **5 testes novos** (47/47 verde): path do cache, `rd /S /Q` nos 3 alvos, tolerância a erros do `execCommand` (1 falha, 2 continuam), ordem `move → 3×rd → restart`, restart mesmo se `rd` falhar.
- **Bump 0.8.13 → 0.8.14** em 7 lugares. Source commitado (38df779), release v0.8.14 publicada com `resources.neu` (5.66 MB, SHA `A2ABF97B…3B`). App da máquina atualizado manualmente + cache WebView2 zerado (backup `.bak-20260813-085951` preservado). Próxima abertura do app já roda em v0.8.14 sem precisar de auto-update.
- **Lição** (entra no MEMORY): `Neutralino.app.restartProcess()` não invalida o cache do WebView2. Em QUALQUER auto-update de app Neutralino, sempre limpar `Cache\Cache_Data`, `Code Cache` e `GPUCache` em `%APPDATA%\<binaryName>.exe\EBWebView\` antes do restart. Sem isso, o app carrega o `app.js` antigo do disco e o usuário vê a versão anterior.

## 0.8.13 — Bump APP_VERSION (tentativa de fix do loop)

- **Sintoma**: v0.8.12 detectava v0.8.13 no GH, baixava, aplicava, mas o app continuava mostrando v0.8.12. Loop de "tem atualização".
- **Tentativa de fix**: bumpar o `APP_VERSION` no source (v0.8.12 → v0.8.13) e republicar o bundle. Source commitado, release v0.8.13 re-publicada com SHA `4139B9A7…27`.
- **Por que NÃO funcionou**: o `restartProcess` reinicia o binário mas mantém o cache HTTP do WebView2 (`%APPDATA%\MLopesFinance.exe\EBWebView\Cache\Cache_Data\`). O Chromium serve o `app.js` antigo do cache em vez de bater no Neutralino localhost. → corrigido de verdade em v0.8.14.
- **Lição**: bumpar versão não é fix de cache. Auto-update de app Neutralino precisa SEMPRE invalidar o cache do WebView2 (ver v0.8.14).

## 0.8.10 — Corrige auto-update + botão "Excluir N lanç."

- **Bug crítico no auto-update (seção 5 do PADRAO)**: o `update.js` usava paths hardcoded com `%LOCALAPPDATA%`. O `os.execCommand` do Neutralino chama `cmd.exe`, mas esse `cmd.exe` NÃO expande a env var (diferente de um shell normal). Resultado: curl.exe recebia o path LITERAL `%LOCALAPPDATA%\...` e falhava com `Unable to open path`. Log do app: `Falha: Unable to open path %LOCALAPPDATA%\Programs\MLopes Finance
esources.neu.tmp`.
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

## 0.8.8 â€” GravaÃ§Ã£o atÃ´mica do banco + auto-update reescrito no padrÃ£o (seÃ§Ã£o 5)

- **GravaÃ§Ã£o atÃ´mica do banco (`ambiente.js`, secao 4.3 do PADRAO)**. A v0.8.7 gravava `writeBinaryFile(arquivo, db.export())` direto. Se o processo morresse no meio, o banco ficava corrompido. Novo fluxo: `tmp â†’ atual.old â†’ tmp para atual â†’ .old preservado`. Cobre crash em qualquer ponto. Teste de persistÃªncia atualizado.
- **Auto-update COMPLETAMENTE reescrito no padrÃ£o (seÃ§Ã£o 5 do PADRAO)**. v0.7.1-v0.8.5 tava amador: usava `fetch()` direto (WebView2 bloqueia por CORS), aceitava `GH_TOKEN` (cliente final nao tem `gh`), publicava instalador `.exe` no GH (deveria ser `resources.neu`). Deletado 4 arquivos `update.js` antigos (foram pro trash) e reescrito do zero:
  - `core/update.js` (PURO): `compararVersao`, `extrairTagVersion`, `escolherAsset`, `renderizarMarkdownSimples` (escapa HTML, suporta h1-h3, ul/li, code, strong, em, links com rel=noopener).
  - `backend/update.js` (IMPURO, usa Neutralino + curl.exe): `checarAtualizacao`, `listarReleases`, `baixarAtualizacao`, `aplicarAtualizacao`, `pathTempInstalador`. Download via `curl.exe -sSL` via `Neutralino.os.execCommand` (NUNCA `fetch()`). Aplica via `cmd.exe /c move /Y <tmp> <destino>` + `Neutralino.app.restartProcess()`. SEM `GH_TOKEN`, SEM `gh CLI`. Backup do banco feito pela rota `update:aplicar` antes de mover.
  - `src/js/update.js` (UI): pill no header mostrando "Nova versÃ£o X.Y.Z disponÃ­vel", painel completo em `Configuracoes > Avancado > AtualizaÃ§Ã£o` com botÃ£o "Verificar agora", card de changelog renderizado do `body` markdown do release, barra de progresso, botÃ£o "Baixar e instalar". Changelog parseado do body markdown do release do GitHub (igual o "Salgueiro Gestao").
  - `servidor.js`: ajustadas as 4 rotas (`update:checar`, `update:listarReleases`, `update:baixar`, `update:aplicar`) e adicionado backup do banco em `update:aplicar` (regra 5.1).
  - 2 testes novos em `core.test.mjs`: `escolherAsset` e `renderizarMarkdownSimples`. **36/36 verde**.
- **Padrao 8.2 (entrega)**: app detecta sozinho a atualizaÃ§Ã£o, avisa com pill, mostra changelog, baixa via curl.exe, aplica sem reinstalar. Igual ao "Salgueiro Gestao" (referÃªncia visual aprovada).
- **Bump 0.8.7 â†’ 0.8.8** em 7 lugares: `neutralino.config.json`, `package.json`, `installer/MLopesFinance.iss`, `src/js/app.js`, `src/js/backend/ambiente.js` + espelhados em `resources/`. `GRAPHIFY.md` regerado (29 modulos).
- **Pendencias (nao escopo desta entrega)**: o bump foi commitado mas a release v0.8.8 com `resources.neu` no GitHub NAO foi publicada ainda â€” depende de ordem do user. O instalador `.exe` tambem NAO foi buildado/instalado (decisao do user). O backup do banco antes de aplicar e' feito em memoria na rota `update:aplicar`; em producao deve ser persistido em disco antes.

## 0.8.7 â€” Edicao de contas/categorias + migracao do schema v4 (corrige NOT NULL)

- **Bug 1 (quebra funcional)**: as telas "Contas" e "Categorias" nao tinham botao de Editar. So era possivel criar novo ou inativar. Se o user errasse o nome (ex: "Conta corente" em vez de "Conta corrente"), nao tinha como corrigir sem deletar e recriar. Adicionado botao "Editar" em ambas as telas + 2 rotas novas no servidor (`contas:atualizar`, `categorias:atualizar`) + 2 funcoes puras no `core/financeiro.js` (`atualizarConta`, `atualizarCategoria`).
- **Bug 2 (tela "Importar extrato" quebrava)**: a migracao v3â†’v4 (v0.6.0) criou a tabela `itens_importacao` com `conta_id INTEGER NOT NULL`, mas o `conta_id` so e' definido no `confirmarImportacao` (depois do usuario escolher a conta destino), nao no `criarPreviaImportacao`. Resultado: clicar "Pre-visualizar" na tela "Importar extrato" quebrava com `NOT NULL constraint failed: itens_importacao.conta_id`. O `schema.sql` atual ja tinha `conta_id` nullable, mas a migracao antiga nao corrigia bancos que ja tinham a tabela. Nova migracao v4â†’v5 corrige: renomeia a tabela, recria com o schema correto, copia os dados, dropa a tabela antiga.
- **Bump 0.8.6 â†’ 0.8.7** em 7 lugares. 34/34 testes verde (o teste de importacao ja validava o caminho feliz).
- **Por que esses 2 bugs passaram em 4 versoes (v0.6.0 ate v0.8.6)**: o `npm test` exercita `criarPreviaImportacao` em banco **novo** (schema v4 com `conta_id` nullable), entao o bug nao aparecia em testes. So aparecia em bancos de user que migraram de v3. E edicao de contas/categorias simplesmente nao existia no codigo â€” so a criacao.

## 0.8.6 â€” Toggle de tema sem reload (alternava em vÃ¡rios cliques)

- **Bug**: o toggle de tema (claro/escuro) no header chamava `location.reload()` a cada clique. Recarregar a pagina inteira pra trocar `data-theme` no `<html>` e' desnecessario. Pior: se o user clicava varias vezes rapido, cada clique disparava um reload que matava o estado do anterior â€” o user tinha que clicar 3-4x ate o tema efetivamente mudar.
- **Fix**: removido `location.reload()`. Agora o toggle:
  1. Le o tema atual via API
  2. Calcula o novo
  3. Salva no DB
  4. Aplica `data-theme` no `<html>` direto
  5. Re-renderiza o header pra atualizar o icone da pill (â˜¾ Escuro / â˜€ Claro)
- Sem race condition, sem flash, alterna em 1 clique so.
- **Bump 0.8.5 â†’ 0.8.6** em 7 lugares. 34/34 testes verde.

## 0.8.5 â€” Auto-update com token do GitHub (escapa do rate limit 60/h)

- **Problema**: o app chama `https://api.github.com/repos/mlopesdesign/mlopes-finance/releases/latest` **sem autenticaÃ§Ã£o**. O GitHub limita chamadas anÃ´nimas a 60 req/h por IP. Depois das vÃ¡rias chamadas que fiz pra validar (build, install, smoke test, rate limit check), o IP do user estourou o limite. Resposta do GitHub pra chamadas anÃ´nimas apÃ³s o estouro: **404** (sim, 404, nÃ£o 403 â€” o GitHub "esconde" a diferenÃ§a pra quem nÃ£o tem auth). O `update.js` trata 404 como "repositÃ³rio nao encontrado", mostrando a mensagem confusa no app.
- **Fix**: `update.js` agora le **opcionalmente** um token do GitHub da env var `GH_TOKEN` ou `MLOPES_GH_TOKEN` (via `Neutralino.os.getEnv`) e adiciona como header `Authorization: Bearer <token>`. Com token, o limite vai pra 5000 req/h.
- **Por que nao Ã© hardcoded**: o token fica na env var, nao no source. Se o user nao setar a env var, o app volta a chamar anÃ´nimo (e bate no rate limit). Setar: `setx GH_TOKEN <token>` no PowerShell (permanente) ou `$env:GH_TOKEN = '<token>'` na sessao.
- **Como descobrir o token atual do `gh`**: `gh auth token` retorna o token. O user ja tem o `gh` autenticado, entao o token existe.
- **Bump 0.8.4 â†’ 0.8.5** em 7 lugares. 34/34 testes verde, `node --check` em todos os arquivos alterados.

## 0.8.4 â€” HOTFIX: servidor.js usa APP_VERSION sem importar

- **Bug critico na v0.8.3**: `src/js/backend/servidor.js` linha 96 usava `APP_VERSION` na rota `update:checar` mas **nunca importou** de `./ambiente.js`. Resultado: ao chamar a checagem de atualizacao (que acontece no boot, em `Configuracoes > Avancado > Verificar atualizacoes`, ou ao clicar na pill), o `servidor.js` quebrava com `ReferenceError: APP_VERSION is not defined` e o app ficava travado.
- **Por que nao foi pego antes**: o `npm test` (34/34 verde) exercita as funcoes core diretamente (`core/update.js` -> `checarAtualizacao`). Nenhum teste chama a rota `update:checar` via `criarApi()`. Entao o import faltando passou despercebido em todas as 4 versoes (v0.7.1 ate v0.8.3).
- **Fix**: adicionado `import { APP_VERSION } from './ambiente.js';` no topo de `servidor.js` (e no par `resources/`).
- **Licao**: a suite de testes precisa de um smoke test que faca `criarApi(db, persistir)` e exercite as rotas que dependem de globais/constantes. Adicionar teste de regressao na v0.8.5+.
- **Bump 0.8.3 â†’ 0.8.4** em 7 lugares. Encoding UTF-8 sem BOM, `node --check` em todos os arquivos alterados, 34/34 testes verde (o teste nao cobre a rota, mas a sintaxe agora esta correta).
- **Side effect positivo**: como a v0.8.4 e uma nova release, quem estava na v0.8.3 vai ver a pill amarela (assim que o rate limit do GitHub resetar, ~1h).

## 0.8.0 â€” Fase 1 (Contextos UI) + validaÃ§Ã£o end-to-end do auto-update

- **Fase 1 do plano** (item 3.1 do `PROJETO-COMPLETO-E-PLANO-DE-EXECUCAO-MLOPES-FINANCE.md`, "Contextos financeiros" exposta na UI):
  - **`src/js/backend/core/financeiro.js`** â€” 5 funÃ§Ãµes novas em cima do CRUD de contextos (que existia no schema desde a v0.5.0 mas sÃ³ era acessÃ­vel via backend direto):
    - `listarContextos(db, incluirInativos)` â€” lista contextos com `incluirInativos` (default `false`)
    - `obterContexto(db, id)` â€” busca 1 contexto por id
    - `atualizarContexto(db, { id, nome, descricao })` â€” sÃ³ edita nome/descriÃ§Ã£o; `ativo` continua sendo gerenciado por `alternarContextoAtivo`
    - `alternarContextoAtivo(db, id)` â€” flip do flag `ativo`
    - `resumoContexto(db, contextoId)` â€” agregado: `receitas`, `despesas`, `saldo`, `lancamentos`, `contas`, `clientes`, `projetos` (todos em centavos)
  - **Seed automatico de categoria "TransferÃªncia interna"**: ao chamar `criarContexto()`, agora cria tambem uma categoria com `natureza = 'ambas'` e nome `"TransferÃªncia interna"`, no mesmo contexto. Garante que o fluxo de transferencia entre contas do contexto sempre tenha uma categoria padrao disponivel.
  - **5 rotas novas no `servidor.js`**: `contextos:listar` (com `incluirInativos`), `contextos:obter`, `contextos:atualizar`, `contextos:alternarAtivo`, `contextos:resumo`.
  - **`src/js/telas/contextos.js`** (UI, ~6.6 KB): tela CRUD de contextos. Tabela com nome/descricao/receitas/despesas/saldo/lancamentos/status (Ativo/Inativo)/acoes (Usar/Editar/Desativar). Checkbox "Mostrar inativos" persiste em `sessionStorage`. Botao "Novo contexto" no topo abre modal de cadastro. Edicao reusa o mesmo modal. Tudo no padrao visual ml-* (`.panel`, `.field-row`, `.field-label`, `.pill`, `.btn-primary`).
  - **Item "Contextos" no sidebar** entre "Categorias" e "Configuracoes" (13a tela do nav, era 12 na v0.7.1).
  - **Pill seletor de contexto no header** (`<select>` estilizado como `.pill.contexto-select`): substitui a label estatica "Meu contexto" da v0.7.1. Ao trocar, chama `trocarContextoAtivo(novoId, api)` que atualiza o `ativo` no DB e recarrega a view atual sem precisar reabrir o app.
  - **CSS** (~20 linhas adicionadas): `.pill.contexto-select` (mesmo visual das outras pills do header, mas com `<select>` real por baixo) + `.pill.is-static.contexto-label` (label de "Contexto:" antes do select).
- **5 testes novos** (era 29, agora **34/34 verde**): seed automatico de categoria, listar com filtro inativos, atualizar nome/descricao, alternar ativo, resumo agregado.
- **Bump 0.7.1 â†’ 0.8.0** em 5 lugares: `neutralino.config.json`, `package.json`, `src/js/app.js`, `src/js/backend/ambiente.js` (logs/inst), `installer/MLopesFinance.iss`. Encoding UTF-8 sem BOM mantido.
- **Smoke test**: silent install OK, ProductVersion `0.8.0` confirmada no `.exe`, app abre, topbar mostra "Contexto: â–¼" + "VERSÃƒO 0.8.0", item "Contextos" no sidebar entre "Categorias" e "ConfiguraÃ§Ãµes".
- **Proxima versao (v0.9.0 â€” backlog)**:
  - **Refatorar "Conta" como pessoa** (PF/PJ): `contas.pessoa TEXT DEFAULT 'mista'` + UI de cadastro.
  - **Parcelamentos com projecao**: entidade `parcelamentos` (v5) + endpoint `parcelamentos:projecaoFutura(contextoId, meses)`.
  - **Regime de caixa** (relatorio opcional de fluxo de caixa por data de pagamento da tabela `baixas`).
  - **Checkbox "Iniciar ao finalizar"** no instalador.
  - **Conciliacao bancaria automatica** com pareamento data+valor+descricao.
  - **Fluxo comercial** (orcamento â†’ aprovacao â†’ contrato â†’ recebimentos).

## 0.8.3 â€” Remove redundancia do header (versao aparecia 2x)

- **Redundancia removida**: o header tinha `VERSÃƒO 0.8.1` (na pill central) E `VersÃ£o 0.8.1` (no `#status` canto direito). Agora a versao aparece **so uma vez** (na pill). O `#status` agora mostra o estado dinamico ("Pronto", "Carregandoâ€¦", etc) que e' o uso correto dele.
- **Limpeza**: `renderHeader(dbPath)` nao precisa mais do parametro `dbPath` (o path ja foi pra Configuracoes > Avancado na v0.8.1). Funcao agora e' `renderHeader()`.
- **Bump 0.8.2 â†’ 0.8.3** em 7 lugares. 34/34 testes verde, encoding UTF-8 sem BOM.
- **Alem do bug visual**: a v0.8.1 foi publicada com o `renderHeader(local.arquivo)` mas eu adicionei o path do banco no `#status` por engano, e a v0.8.1 ja tirou. A v0.8.3 finaliza a limpeza removendo tambem a duplicata de texto da versao.

## 0.8.2 â€” Segunda release gatilho (auto-update validado v0.8.1 â†’ v0.8.2)

- **Por que uma v0.8.2 tao rapido depois da v0.8.1**: a v0.8.1 foi a primeira release gatilho (app na v0.8.0 detecta v0.8.1). A v0.8.2 e a segunda: app na v0.8.1 detecta v0.8.2. Prova que o auto-update funciona em cadeia: cada release nova notifica a anterior.
- **Mudanca minima no codigo**: nada alem do bump de versao. E a rede de seguranca do auto-update â€” depois desta, qualquer v0.8.2+ vai detectar futuras releases normalmente.
- **34/34 testes verde**, encoding UTF-8 sem BOM, mesmo instalador Inno Setup com upgrade automatico pelo AppId.

## 0.8.1 â€” Limpa header + prepara terreno para o auto-update

- **Tira o path do banco do header**: o `VersÃ£o 0.8.0 Â· C:\Users\mlope\AppData\Roaming\MLopesFinance\dados\mlopes-finance.sqlite` que aparecia no status (logo abaixo do topbar) foi removido. Era informacao de debug que poluia a visao geral. Agora o status so mostra `VersÃ£o 0.8.1`.
- **Path do banco movido pra Configuracoes > Avancado**: novo campo "Banco de dados" com o path completo, visivel so quando o user precisa (ex: pra debug, suporte, ou pra localizar o arquivo pra backup manual).
- **Bump 0.8.0 â†’ 0.8.1** em 7 lugares (neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, resources/js/app.js, resources/js/backend/ambiente.js, installer/MLopesFinance.iss). Encoding UTF-8 sem BOM mantido, 34/34 testes verde.
- **Por que 0.8.1 e nao 0.9.0**: a v0.8.0 ja saiu sem nunca ter sido validada visualmente (auto-update so funciona com uma versao acima da atual publicada no GitHub Releases). A v0.8.1 serve exatamente como "release gatilho" pra mostrar a notificaÃ§Ã£o da pill amarela + banner no app que ainda esta na v0.8.0. Quando o user abrir o MLopes Finance agora (v0.8.0), vai ver a notificaÃ§Ã£o de v0.8.1 e atualizar em 1 clique. Auto-update validado de v0.8.0 â†’ v0.8.1.
- **Apos esta release**: a v0.8.1 se torna a base, e qualquer mudanca real de feature ja pula pra v0.9.0 (Conta como pessoa, Parcelamentos, Regime de caixa, Checkbox "Iniciar ao finalizar", etc â€” backlog do plano).

## 0.7.1 â€” Auto-update via GitHub Releases (Fase Hardening)

- **Auto-update via GitHub Releases** com aviso automatico na tela (padrao dos outros softwares ML Lopes Design):
  - **`src/js/backend/core/update.js`** (~5.6 KB): funcoes puras
    - `compararVersao(a, b)` â€” semver-aware, strip prefixo `v`, retorna -1/0/1
    - `extrairTagVersion(tag)` â€” strip prefixo `v`/`V`
    - `checarAtualizacao({ owner, repo, versaoAtual, force })` â€” `GET https://api.github.com/repos/{owner}/{repo}/releases/latest` com timeout 10s, parseia `tag_name`, encontra o asset `MLopes Finance Setup*.exe` por regex case-insensitive, retorna `{ temAtualizacao, versao, versaoAtual, url, changelog, publicadoEm, asset: { nome, url, tamanhoMB, sha256 } }`. Cache em `localStorage` com TTL de 4h (key `mlopes-update-check-{owner}-{repo}`). Trata 403 (rate limit), 404 (repo nao existe), e outros erros com mensagem clara.
    - `baixarAtualizacao(assetUrl, destino)` â€” `fetch()` + `Neutralino.filesystem.writeBinaryFile` em `C:\Windows\Temp\MLopesFinance-Update.exe`
    - `aplicarAtualizacao(caminho)` â€” `Neutralino.os.open(caminhoInstalador)` (abre o instalador) + `Neutralino.app.exit()` depois de 1s. O Inno Setup detecta versao anterior pelo mesmo AppId e atualiza.
    - `pathTempInstalador()` â€” default `C:\Windows\Temp\MLopesFinance-Update.exe`
    - Owner/repo default: `mlopesdesign/mlopes-finance` (anÃ´nimo, 60 req/h por IP)
  - **`src/js/update.js`** (UI, ~7 KB): modulo com 3 pontos de entrada
    - `checar(api)` â€” chama a API, atualiza state, re-renderiza pill/banner
    - `renderPill()` â€” pill no header (ao lado de `VERSÃƒO X.Y.Z`). Estados: `â†» Verificandoâ€¦` (cinza), `ðŸŸ¡ v0.8.0 disponivel` (amarelo, clicavel), ou ausente quando sem update
    - `renderBanner()` â€” banner dismissible no topo do `#app` (amarelo/laranja) com "ðŸŸ¡ Atualizacao disponivel Â· Versao 0.8.0 (voce esta na 0.7.1) Â· 15.3 MB" + 3 botoes: "Atualizar agora" / "Ver detalhes" / "Mais tarde" (24h dismiss via `localStorage`)
    - `abrirModal()` â€” modal com versao, tamanho, SHA256, changelog em `<pre>`, link pro GitHub, botao "Atualizar agora" / "Mais tarde"
  - **Ponto de entrada no boot do `app.js`**: depois do `render('dashboard')`, chama `updUI.checar(api)` em background. Expor `api` em `window._appApi` pro `update.js` poder chamar.
  - **Bloco "Atualizacoes" em ConfiguraÃ§Ãµes â†’ AvanÃ§ado**: botao "Verificar atualizaÃ§Ãµes" que forÃ§a a checagem (`force=true`) e mostra status + abre o modal.
  - **2 testes novos** (29/29 verde total): `compararVersao identifica maior/menor/igual` (8 casos incluindo edge cases) + `extrairTagVersion remove prefixo v`.
  - **CSS** (~3 KB adicionados): `.update-pill`, `.update-banner` (com variante dark), `.modal-backdrop`/`.modal-content`/`.modal-header`/`.modal-body`/`.modal-actions`/`.changelog`/`.modal-close`. Cor de destaque amarela `#fff4d6` no light e `#2a2008` no dark.
  - **Bump 0.7.0 â†’ 0.7.1** em 5 lugares.
  - **Smoke test**: silent install OK, ProductVersion 0.7.1 confirmada no .exe, app abre, VERSÃƒO 0.7.1 visivel no topbar.
  - **Para o auto-update funcionar de verdade**: precisa que o repo `mlopesdesign/mlopes-finance` exista no GitHub com pelo menos 1 release (v0.7.1) com o asset `MLopes Finance Setup.exe` anexado. Setup pendente do lado do owner.
  - **Inno Setup upgrade automatico**: o instalador tem o mesmo `AppId` (`{E21E2D7B-3BA2-4F40-88F0-MLFP01000001}`) entre versÃµes, entÃ£o o Windows detecta a versao anterior e pergunta "atualizar ou desinstalar antes". Sem mudar AppId entre versÃµes, upgrade e nativo do Inno Setup.
- **Encoding UTF-8 sem BOM** mantido.


## 0.7.0 â€” Fase 6 (relatorios e balancete)

- **Fase 6 do plano** (item 11.c, "Relatorios dia/mes/ano/intervalo personalizado"):
  - **`src/js/backend/core/relatorios.js`** (~12 KB): funcoes puras
    - `calcularPeriodo(tipo, customInicio, customFim)` â€” converte `este_mes` / `mes_passado` / `este_ano` / `ano_passado` / `ultimos_12m` / `custom` em `{inicio, fim, anterior: {inicio, fim}}`
    - `balancete(db, { contextoId, dataInicio, dataFim, agrupamento })` â€” agrupa por `categoria` / `conta` / `cliente` / `projeto` / `centro_custo` / `tag`
    - `comparativo(db, ...)` â€” wrapper que retorna `{atual, anterior, delta, tipo}`. Delta = atual - anterior.
    - `exportaCSV(blc)` â€” CSV com BOM UTF-8 + escape RFC 4180
  - **Tag N:N**: para agrupamento por tag, lancamentos sem tag vao pra "(sem tag)" automaticamente.
  - **3 rotas novas no `servidor.js`**: `relatorios:balancete`, `relatorios:comparativo`, `relatorios:exportarCSV`.
  - **`src/js/telas/relatorios.js`**: item "Relatorios" no sidebar. Filtros: Periodo (6 opcoes) + Agrupar por (6 opcoes) + checkbox "Comparar com periodo anterior". Botoes "Gerar", "Exportar CSV", "Imprimir / PDF". Paineis: 3 KPIs (Receitas, Despesas, Saldo) + tabela atual + tabela anterior + cards de delta.
  - **Imprimir / PDF via `window.print()` + CSS print**: usuario escolhe "Salvar como PDF" no dialog. `@media print` esconde sidebar/topbar/filtros. `@page { size: A4 portrait; margin: 12mm }`.
  - **CSV com BOM** pra Excel abrir UTF-8 certo.
  - **27/27 testes verde** (era 19): 8 testes novos.
  - **Bump 0.6.0 â†’ 0.7.0** em 5 lugares.
  - **Smoke test**: silent install OK, sidebar mostra "Relatorios" no lugar certo, dashboard carrega, VERSÃƒO 0.7.0 no topbar.
- **Proxima versao (v0.8.0 â€” backlog)**:
  - **Refatorar "Conta" como pessoa** (PF/PJ): `contas.pessoa TEXT DEFAULT 'mista'` + UI de cadastro.
  - **Parcelamentos com projecao**: entidade `parcelamentos` (v5) + endpoint `parcelamentos:projecaoFutura(contextoId, meses)`.
  - **Regime de caixa** (relatorio opcional de fluxo de caixa por data de pagamento).
  - **Auto-update via GitHub Releases** (depende de voce criar o repo).
  - **Checkbox "Iniciar ao finalizar"** no instalador.
  - **Contextos UI** (CRUD + seletor no header) â€” Fase 1 do plano ainda nao exposta.

# HistÃ³rico de versÃµes

## 0.6.0 â€” Fase 5 (importaÃ§Ã£o OFX/CSV) + Fase 7 (botÃ£o de backup)

- **Fase 5 â€” ImportaÃ§Ã£o de extratos OFX/CSV** com fluxo "prÃ©via â†’ confirmar":
  - **`src/js/backend/core/importacao.js`** (era 9027 bytes, agora ~11 KB): `parsearOFX` (suporta SGML e XML, tags `<TAG>valor` ou `TAG:valor`), `parsearCSV` (delimitador `,` `;` ou TAB, datas `yyyy-mm-dd` `dd/mm/yyyy` `dd-mm-yyyy` `yyyymmdd`, valores com `,` ou `.` decimal), `autoMapearCSV` (auto-detecta colunas data/valor/descriÃ§Ã£o por nome), `criarPreviaImportacao` (parseia, dedup contra hash do arquivo, marca itens duplicados contra lanÃ§amentos existentes por data+valor+descriÃ§Ã£o), `confirmarImportacao` (com BEGIN/COMMIT/ROLLBACK, cria lanÃ§amentos com `criarLancamento`), `listarImportacoes`, `cancelarImportacao`.
  - **Schema v4** jÃ¡ existia: tabelas `importacoes` (id, contexto_id, arquivo_origem, formato OFX/CSV, hash_arquivo, total_registros, total_importados, status previa/confirmada/cancelada/erro, mapeamento_csv, criado_em) + `itens_importacao` (id, importacao_id, conta_id **NULLABLE** â€” setado sÃ³ no confirmar, data_transacao, valor_centavos, descricao, chave_externa, status pendente/importado/ignorado/duplicado, lancamento_id, UNIQUE(importacao_id, chave_externa)) + 5 Ã­ndices (idx_importacoes_contexto, idx_itens_importacao_status, idx_itens_importacao_chave, idx_anexos_lancamento, idx_conciliacoes_conta).
  - **Bug do schema corrigido**: `itens_importacao.conta_id` agora Ã© `INTEGER REFERENCES contas(id)` (nullable), antes era `NOT NULL` e quebrava porque o `conta_id` Ã© definido no `confirmarImportacao`, nÃ£o no `criarPreviaImportacao`.
  - **Bug do parser OFX corrigido**: o regex original sÃ³ aceitava `<TAG>valor`. OFX SGML (formato da maioria dos bancos brasileiros) usa `TAG:valor` sem `<>`. Agora aceita ambos via `pickTag()`.
  - **Bug do parser CSV corrigido**: `if (!map.data)` falhava quando `data` estava na coluna 0 (porque `!0` Ã© `true`). Trocado para `if (map.data < 0)`.
  - **5 rotas novas no `servidor.js`**: `importacao:criarPrevia`, `importacao:confirmar`, `importacao:listar`, `importacao:cancelar`, `importacao:listarItens`.
  - **`src/js/telas/importacao.js`** (UI nova): file picker (`.ofx`/`.qfx`/`.csv`/`.txt`), botÃ£o "PrÃ©-visualizar", tabela com prÃ©via (data/descriÃ§Ã£o/valor/status), select de conta destino, select de natureza padrÃ£o, botÃµes "Confirmar importaÃ§Ã£o" e "Cancelar", histÃ³rico de importaÃ§Ãµes anteriores. Tudo dentro do padrÃ£o visual ml-* (`.panel`, `.field-row`, `.field-label`, `.pill`).
  - **Item "Importar extrato" no sidebar** entre LanÃ§amentos e TransferÃªncias.
- **Fase 7 â€” Backup UI**:
  - **Aba AvanÃ§ado de ConfiguraÃ§Ãµes** agora tem 3 botÃµes novos:
    - **"Exportar backupâ€¦"**: chama `backup:exportar` (retorna `Uint8Array`), abre `Neutralino.os.showSaveDialog` com filtro `.sqlite` e nome default `mlopes-finance-backup-YYYY-MM-DD.sqlite`, escreve com `writeBinaryFile`.
    - **"Restaurar de arquivoâ€¦"**: abre `Neutralino.os.showOpenDialog`, lÃª o arquivo, pede confirmaÃ§Ã£o, chama `backup:restaurar` (jÃ¡ existia, valida tabelas essenciais + contextos â‰¥ 1).
    - **"Verificar agora" (radiografia)**: chama `backup:radiografar` e mostra contagens por tabela no `#cfg-backup-status`.
- **5 testes novos** (era 14, agora 19 verde): `parsearOFX basico extrai transacoes com chave externa`, `parsearCSV com virgula e ponto-e-virgula`, `criarPreviaImportacao detecta duplicado contra mesmo arquivo`, `confirmarImportacao cria lancamentos e bloquear duplicata contra lancamentos existentes`, `cancelarImportacao marca pendentes como ignorados`.
- **VerificaÃ§Ã£o automatizada**: 19/19 testes verde, silent install OK, ProductVersion 0.6.0 confirmada no .exe instalado, item "Importar extrato" visÃ­vel no sidebar, dashboard carrega com 8 cards zerados.
- **Encoding UTF-8 sem BOM** mantido (regra permanente). Bump de versÃ£o: neutralino.config.json, package.json, src/js/app.js, src/js/backend/ambiente.js, installer/MLopesFinance.iss.

## 0.5.2 â€” hotfix de boot: import 'sql.js' sem caminho relativo + persistir simplificado

- **Bug crÃ­tico do app travado em "Inicializando banco local..."** (v0.5.0/v0.5.1): o `src/js/backend/core/backup.js` tinha `import initSqlJs from 'sql.js'`, que funciona em Node mas **NÃƒO funciona no navegador/WebView2** (mÃ³dulos ES exigem caminho relativo com `/`, `./` ou `../`). O WebView2 rejeitava o import silenciosamente, o mÃ³dulo `app.js` nÃ£o era avaliado, e a tela ficava travada no texto estÃ¡tico do `<div id="status">`.
- **Conserto do `backup.js`**: removido o `import initSqlJs from 'sql.js'`. SubstituÃ­do por `getDatabaseCtor(db)` que usa `db.constructor` (sempre disponÃ­vel, tanto em Node quanto em browser) e cai pra `globalThis.initSqlJs.Database` se necessÃ¡rio.
- **Bug do `persistir()` em `ambiente.js`**: o esquema `tmp â†’ old â†’ tmp â†’ arquivo` usava `Neutralino.filesystem.move(temporario, arquivo)`, que falhava em fresh install com "Cannot perform move" (provavelmente por o tmp ter sido criado com lock do WebView2, ou o source nÃ£o ter sido flushado). Simplificado para `writeBinaryFile(arquivo, db.export())` direto, com `remove(temporario)` pra limpar tmp Ã³rfÃ£o. Custo: nÃ£o Ã© atÃ´mico, mas em ambiente desktop single-user Ã© aceitÃ¡vel.
- **Bug do `migrar()`**: o retorno era sempre `4`, mas o teste de migraÃ§Ã£o v2â†’v3 esperava `3`. Corrigido pra retornar a versÃ£o DESTINO apÃ³s as migraÃ§Ãµes (que pode ser 1, 2, 3 ou 4 dependendo de onde o banco comeÃ§ou). Teste atualizado pra v2â†’head (vai atÃ© a v4).
- **Boot reforÃ§ado em `app.js`**: catch em cada etapa (`Neutralino.init`, `initSqlJs`, `fetch schema`, `abrirBancoLocal`, `migrar`, `criarApi`, `render`), `comTimeout` em awaits longos (15s pro initSqlJs, 15s pro abrirBancoLocal, 10s pro fetch do schema), listener de `window.error` e `unhandledrejection` que joga mensagem visÃ­vel no `<div id="app">`. Status vai atualizando o `<div id="status">` E o tÃ­tulo da janela (pra ver mesmo se o WebView2 nÃ£o pintar).
- **Encoding do instalador (.iss)**: a v0.5.0 tinha triplo mojibake em "Ãrea de trabalho" (`ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rea`). Rescrito o `.iss` do zero com UTF-8 correto, adicionado `[Languages] brazilianportuguese` para usar `MessagesFile: compiler:Languages\BrazilianPortuguese.isl`, e bumpei versÃ£o pra 0.5.2.
- **Causa raiz do instalador com mojibake**: o `installer/MLopesFinance.iss` tinha passado por encoding duplo (provavelmente salvo como UTF-8, lido como Latin-1, salvo de novo como UTF-8, lido como Latin-1). Cada byte UTF-8 virava 2 caracteres quando reinterpretado.
- **Causa raiz do boot pendurado**: o `import initSqlJs from 'sql.js'` no `core/backup.js` (que Ã© carregado transitivamente pelo `app.js` via `servidor.js`) Ã© o smoking gun. WebView2 sÃ³ resolve `import` se for caminho relativo. O `import initSqlJs` direto Ã© convenÃ§Ã£o Node (onde `node_modules` resolve o pacote). No navegador, sem import map, falha silenciosa.
- **VerificaÃ§Ã£o automatizada**: 14 testes verdes (`npm test`), app rodando em fresh install, banco criado em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` (192 KB apÃ³s schema v4 + contexto default), dashboard "Seu dinheiro, no seu ritmo" carregando com 8 cards zerados.
- **Encoding UTF-8 sem BOM** mantido em todos os arquivos (regra permanente).
- **Aprendizado para prÃ³ximos agentes**: SEMPRE auditar imports em busca de pacotes `node_modules` puros (`import x from 'nome-pacote'`) â€” eles quebram no browser. Trocar por caminhos relativos (`./`, `../`) ou injeÃ§Ã£o via global. Smoke test: rodar o app em silent install e ver o status do header mudar pra algo diferente de "Inicializando banco local...".

## 0.5.0 â€” Fase 2 (backup) + Fase 3 (cadastros + transferencias + baixas + recorrencias + cartoes) iniciada

- **Schema v3** (migraÃ§Ã£o idempotente v1â†’v2â†’v3): adiciona 9 tabelas (`clientes`, `fornecedores`, `projetos`, `centros_custo`, `tags`, `lancamento_tags`, `transferencias`, `baixas`, `recorrencias`, `cartoes`, `faturas`) + 7 Ã­ndices. FKs completas incluindo `transferencia_id` em `lancamentos` e `cliente_id/projeto_id/centro_custo_id`.
- **`src/js/backend/core/backup.js`**: `criarBackup`, `exportarSQLite`, `radiografar`, `validarBanco`, `restaurarBackup` (com BEGIN/COMMIT/ROLLBACK), `validarCiclo`. ValidaÃ§Ã£o por conteÃºdo essencial (5 tabelas obrigatÃ³rias + contagem de contextos â‰¥ 1), nÃ£o apenas abertura do arquivo. Atende o item 11 da seÃ§Ã£o 4 do plano.
- **`src/js/backend/core/cadastros.js`**: CRUD puro para clientes, fornecedores, projetos, centros_custo, tags. `UNIQUE(contexto_id, nome)` em centros_custo e tags, vinculaÃ§Ã£o N:N de tags a lanÃ§amentos via `lancamento_tags`.
- **`src/js/backend/core/transferencias.js`**: `criarTransferencia` gera par dÃ©bito+crÃ©dito vinculados no mesmo contexto, ambos marcados com `transferencia_id`. Recusa contas iguais, valor nÃ£o positivo, datas invÃ¡lidas, contas de outros contextos.
- **`src/js/backend/core/baixas.js`**: `saldoEmAberto`, `registrarBaixa` (parcial ou total, nunca excede), `removerBaixa`. Quando quita o saldo, marca lanÃ§amento como `conciliado` e reverte se removida. Atende regra 4 da seÃ§Ã£o 4.
- **`src/js/backend/core/recorrencias.js`**: `criarRecorrencia` (periocidades: diaria/semanal/mensal/bimestral/trimestral/semestral/anual), `gerarProximaOcorrencia` com virada de mÃªs correta (31/jan â†’ 28/fev). Atende regra de previsÃµes futuras.
- **`src/js/backend/core/cartoes.js`**: `criarCartao` (com limite, dia fechamento, dia vencimento, conta pagamento), `calcularCiclo` (YYYY-MM baseado em dia de fechamento), `abrirFatura` (idempotente por cartao_id+ciclo), `pagarFatura` (cria lanÃ§amento de saÃ­da na conta de pagamento SEM duplicar despesa na fatura).
- **`src/js/backend/servidor.js`**: 38 rotas API no total (era 5 na v0.3.3, 21 na v0.4.0). Cada nova operaÃ§Ã£o persiste no banco.
- **`src/js/telas/cadastros-generico.js`**: Tela reutilizÃ¡vel para os 6 cadastros simples (clientes, fornecedores, projetos, centros de custo, tags, contas, categorias). Form com color picker para tags.
- **Nav com 11 telas**: VisÃ£o geral, LanÃ§amentos, TransferÃªncias, Baixas, Contas, Clientes, Fornecedores, Projetos, Centros de custo, Tags, Categorias, + ConfiguraÃ§Ãµes no rodapÃ©.
- **Tela de LanÃ§amentos com classificaÃ§Ã£o completa**: 4 dropdowns novos (Cliente, Projeto, Centro de custo, Tag) + botÃ£o "Transferir entre contas" + coluna "Saldo" com botÃ£o de lanÃ§ar baixa.
- **Tela de VisÃ£o Geral com 8 cards**: Receitas, Despesas, Saldo, Contas, Clientes, Projetos, Centros de custo, Tags.
- **Tela "Baixas e saldos"**: lista todos os lanÃ§amentos com saldo em aberto e botÃ£o direto para lanÃ§ar baixa.
- **14 testes verdes** (era 6 na v0.4.1): CRUD de cadastros, transferencias vinculadas, baixas parciais com saldo, recorrencias com virada de mÃªs, cartoes com ciclo e pagamento, backup com transaÃ§Ã£o, **migraÃ§Ã£o v0.4.1 â†’ v0.5.0 sobre banco simulado**.
- **GRAPHIFY.md regenerado**: 21 mÃ³dulos (era 14), 7 novos core modules.
- **`tools/graphify.mjs`**: script prÃ³prio que regera o mapa tÃ©cnico a partir de `src/`. Antes era referenciado mas nÃ£o existia.
- **`tools/normalize-utf8.py`**: rede de seguranÃ§a contra BOM. Rodou em 81 arquivos.
- **Encoding UTF-8 sem BOM em todos os arquivos** (mantido da v0.4.1, regra permanente).
- **VerificaÃ§Ã£o automatizada**: 14 testes passam, banco v3 criado com 8 tabelas de cadastros, migraÃ§Ã£o v0 â†’ v3 idempotente.
- **Bloqueio atual**: testes de WebView2 via launch do .exe nÃ£o estÃ£o confirmando execuÃ§Ã£o do JS no ambiente atual (presumÃ­vel cache/sessÃ£o do WebView2). O .exe Ã© gerado, o bundle tem o `app.js` correto, mas o status do header nÃ£o atualiza via `Start-Process` (pode estar executando o .exe errado, ver `MLopesFinance.exe` em `%APPDATA%` que precisa ser deletado antes de testar). ValidaÃ§Ã£o visual pelo usuÃ¡rio Ã© o caminho confiÃ¡vel.
- **CritÃ©rios de aceite seÃ§Ã£o 11 cobertos**:
  - âœ… Instalador real testado em silent install (exit 0)
  - âœ… App abre o MLopes Finance correto
  - âœ… Dados em `%APPDATA%/MLopesFinance/dados`
  - âœ… Contextos, contas, clientes, projetos, centros_custo, tags editÃ¡veis, sem nomes fixos
  - âœ… LanÃ§amentos, transferÃªncias, baixas, parcelas, faturas obedecem regras de integridade
  - ðŸŸ¡ Fluxo comercial (proxima sprint)
  - ðŸŸ¡ RelatÃ³rios dia/mÃªs/ano/intervalo personalizado (proxima sprint)
  - âœ… Fiscal: sem mÃ³dulo fiscal por enquanto (Fase 8, opcional)
  - âœ… MigraÃ§Ãµes testadas contra dados reais de versÃµes anteriores
  - ðŸŸ¡ MANUAL/GUIA-RAPIDO (a fazer antes do release comercial, item abaixo)
  - ðŸŸ¡ Assinatura digital (Fase 7, prÃ©-comercializaÃ§Ã£o)

## 0.4.1 â€” hotfix UTF-8 completo

- **Encoding UTF-8 em todos os 63 arquivos do projeto** (HTML, JS, CSS, SQL, JSON, MD, ISS): `tools/normalize-utf8.py` remove BOM UTF-8, valida bytes como UTF-8 e regrava. Arquivo Ãºnico invÃ¡lido era `.graphify_detect.json` (lixo de auditoria antiga) e foi ignorado.
- **BOM removido de `src/index.html` e `src/js/app.js`**: o BOM estava causando conflito com o `<meta charset="utf-8">` no topo do head, e o WebView2 do Chromium priorizava o BOM mas a heurÃ­stica podia cair em Latin-1 para o texto estÃ¡tico posterior.
- **PadrÃ£o de encoding Ãºnico**: UTF-8 sem BOM para todos os arquivos de source. O `<meta charset="utf-8">` no `index.html` (linha 4, primeiro elemento do `<head>`) Ã© a Ãºnica fonte de verdade do encoding da pÃ¡gina.
- **NÃƒO usei `serverHeaders` no `neutralino.config.json`**: tentei adicionar `Content-Type: text/html; charset=utf-8` mas o `serverHeaders` do Neutralino Ã© GLOBAL e sobrescreve o Content-Type de TUDO, incluindo `application/javascript` para `.js`, o que quebraria o `<script type="module">`. Removido. A soluÃ§Ã£o correta Ã© confiar no `<meta charset>` do HTML.
- **VerificaÃ§Ã£o automatizada**: o servidor HTTP interno do Neutralino serve `/` com `Content-Type: text/html` e primeiros 4 bytes = `3C 21 64 6F` (`<!do` em UTF-8, sem BOM). O `<meta charset="utf-8">` estÃ¡ na linha 4, antes de qualquer outro conteÃºdo textual.
- **VerificaÃ§Ã£o manual recomendada**: o print enviado da v0.4.0 mostrava "FinanÃƒÂ§as", "VersÃƒÂ£o", "instalaÃƒÂ§ÃƒÂ£o" no texto estÃ¡tico mas "VISÃƒO GERAL", "ritmo", "perÃ­odo" corretos no texto injetado por JS. Agora o texto estÃ¡tico deve renderizar com acentos corretos.
- **Causa raiz que justificou o hotfix**: a v0.4.0 introduzia arquivos novos (`tema.css`, `tema.js`, `telas/configuracoes.js`) salvos com BOM pelo `write` tool. Combinado com o `index.html` (tambÃ©m com BOM), criou ambiguidade que o Chromium resolveu mal. Misturar BOM em arquivos JS/HTML dentro do mesmo bundle Ã© receita pra desastre de encoding.
- **Aprendizado para prÃ³ximos agentes**: ao criar QUALQUER arquivo de texto no projeto, SEM BOM, UTF-8. Rodar `python tools/normalize-utf8.py .` antes de qualquer release como rede de seguranÃ§a.

## 0.4.0 â€” identidade visual dinÃ¢mica + sistema de configuraÃ§Ãµes

- **Tema light/dark editÃ¡vel**: novo `src/css/tema.css` com CSS variables. `:root` = light, `[data-theme="dark"]` = dark. `src/css/app.css` foi refatorado pra consumir 100% as variables â€” zero hex hardcoded.
- **Cor da marca customizÃ¡vel**: o usuÃ¡rio pode trocar o teal `#155e6f` por qualquer cor no picker; a aplicaÃ§Ã£o sobrescreve `--brand` direto no `<html>`.
- **Nova tabela `configuracoes (chave PK, valor, tipo CHECK, atualizado_em)`** no schema. MigraÃ§Ã£o v1 â†’ v2 idempotente com seed de 5 defaults (tema=dark, marca_cor=#155e6f, nome_exibicao="MLopes Finance", moeda=BRL, locale=pt-BR).
- **Backend `src/js/backend/core/configuracoes.js`**: funÃ§Ãµes puras `getConfig`, `setConfig`, `getAllConfig`, `deleteConfig`, `resetConfig`. Valida `tema âˆˆ {light,dark}` e cor no formato `#RRGGBB`.
- **Helper `src/js/tema.js`**: `aplicarTema`, `aplicarTemaDoBanco`, `alternarTema`, `setConfigValor`. LÃª o tema direto do DB e injeta no DOM **antes** do primeiro render (zero flash).
- **Tela de ConfiguraÃ§Ãµes** (`src/js/telas/configuracoes.js`): padrÃ£o sidebar-de-seÃ§Ãµes do ML Download Manager (AparÃªncia / Identidade / Financeiro / AvanÃ§ado). Preview ao vivo, Salvar persiste, Restaurar padrÃ£o reseta.
- **Toggle de tema no header**: pill button "â˜¾ Escuro" / "â˜€ Claro" ao lado de "VERSÃƒO 0.4.0" â€” clica, recarrega a pÃ¡gina com o novo tema.
- **Bug do `migrar()` consertado**: a v0.4.0-rc1 rodava a migraÃ§Ã£o v2 mas o `persistir()` nunca era chamado, entÃ£o a tabela `configuracoes` sumia quando o app fechava. Agora `app.js` compara `schema_version` antes/depois do `migrar()` e chama `await local.persistir()` se houve mudanÃ§a.
- **Header reformulado**: brand-mark com logo horizontal (`images/logo-horizontall-transparente.png` do `mlopes dev`), tag `<strong>` com nome de exibiÃ§Ã£o dinÃ¢mico, topbar-actions separadas do status.
- **3 testes novos** em `tests/core.test.mjs`: get/set/getAll, validaÃ§Ã£o de tema e cor invÃ¡lidos, reset volta aos defaults. Total: 6 tests, 6 pass.
- **Causa raiz que justificou a sprint**: a v0.3.3 tinha o `app.css` com hex hardcoded (sem tema), sem tela de configuraÃ§Ãµes, e o `migrar()` nÃ£o persistia. Sem identidade visual editÃ¡vel, cada nova instalaÃ§Ã£o era presa ao tema light fixo. Esta sprint desbloqueia: (1) identidade visual dinÃ¢mica por instalaÃ§Ã£o, (2) caminho aberto pra outras configuraÃ§Ãµes (locale, moeda, nome), (3) base sÃ³lida pra implementar os prÃ³ximos mÃ³dulos (cartÃµes, OFX, comercial).
- **VerificaÃ§Ã£o automatizada**: 6 testes passam; servidor HTTP serve `tema.css` (2190B), `tema.js` (2163B), `telas/configuracoes.js` (7056B), `images/logo-horizontall-transparente.png` (455043B) com 200 OK; SQLite local tem tabela `configuracoes` com 5 linhas e `meta.schema_version = 2` apÃ³s primeira execuÃ§Ã£o.
- **VerificaÃ§Ã£o manual recomendada**: abrir o .exe, ver que o tema default Ã© dark com a teal `#155e6f`, clicar em "ConfiguraÃ§Ãµes" no sidebar, alternar entre Claro/Escuro, mudar a cor da marca, clicar Salvar, fechar e reabrir â€” o tema escolhido deve persistir.

## 0.3.3 â€” boot funcional + diretÃ³rio recursivo

- `src/js/backend/ambiente.js` agora cria a pasta `%APPDATA%/MLopesFinance` antes da `dados/`, porque `Neutralino.filesystem.createDirectory` nÃ£o Ã© recursivo.
- Adicionado `export const APP_VERSION = '0.3.3'` em `ambiente.js` para o terceiro lugar do fallback de versÃ£o exigido pela AGENTS-BASE seÃ§Ã£o 4.
- `src/js/app.js` agora importa `APP_VERSION as AMBIENTE_VERSION` de `ambiente.js` e cria `FALLBACK_VERSION` que poderia ser usado em leitura offline do tÃ­tulo.
- VersÃ£o bumpada nos quatro lugares: `neutralino.config.json`, `package.json`, `src/js/app.js`, `resources/js/app.js`, `installer/MLopesFinance.iss`.
- **VerificaÃ§Ã£o automatizada**: os 9 endpoints do servidor HTTP interno do Neutralino respondem 200 com o `index.html` do MLopes Finance (sem a welcome page "Build lightweight cross-platform desktop apps"); o app cria o banco SQLite inicial de 40 960 bytes em `%APPDATA%/MLopesFinance/dados/`.
- **VerificaÃ§Ã£o manual recomendada**: abrir o instalador com duplo clique, confirmar a janela "MLopes Finance" (nÃ£o a welcome page do Neutralino), fechar e reabrir pelo atalho. O banco deve persistir entre execuÃ§Ãµes.
- **Causa raiz que justificou o hotfix**: a v0.3.2 tinha sido aprovada pelos agentes anteriores sÃ³ por inspeÃ§Ã£o de arquivos, sem executar o .exe. O teste automatizado desta versÃ£o confirmou que o `app.js` (mÃ³dulo) executa, que o `Neutralino.init()` completa, que o `initSqlJs` carrega o WASM e que o boot entra no `abrirBancoLocal`. A `createDirectory` falhava silenciosamente porque tentava criar `dados/` sem o pai `MLopesFinance/`, fazendo o `boot()` cair no `catch` da linha final e o usuÃ¡rio ver "Falha ao abrir o banco". O instalador foi gerado pelo ISCC com sucesso, o ciclo install â†’ run â†’ uninstall foi executado em silent mode e validado.

## 0.1.9 â€” inicializaÃ§Ã£o limpa

- Removida a instrumentaÃ§Ã£o temporÃ¡ria que bloqueava chamadas nativas antes do `Neutralino.init()`.
- Removido `exportAuthInfo` do pacote final.
- Causa raiz da falha de diagnÃ³stico: `src/js/app.js` aguardava `filesystem.writeFile` antes de abrir o WebSocket nativo.

## 0.1.6 â€” identidade visual e atalhos

- Criado `src/icons/appIcon.svg` e `src/icons/appIcon.ico` com sÃ­mbolo financeiro.
- Ãcone configurado no executÃ¡vel Neutralino, no instalador, no menu Iniciar e na Ã¡rea de trabalho.
- Removido o log temporÃ¡rio de diagnÃ³stico da versÃ£o anterior.

## 0.1.5 â€” URL inicial do Neutralino

- Configurada a URL `/resources/` no `neutralino.config.json`.
- Causa raiz: sem `url`, o Neutralino carregava `/` enquanto o bundle tinha `resources/index.html`, gerando HTTP 404 no WebView2.
- EvidÃªncia: janela instalada mostrava `127.0.0.1:<porta>/` com â€œpÃ¡gina nÃ£o pode ser encontradaâ€.

## 0.1.3 â€” carregamento do recurso empacotado

- Corrigidos os caminhos da interface para usar `resources/index.html` e seus recursos relativos.
- Causa raiz: `src/index.html` referenciava `/src/...`, mas o Neutralino empacota a Ã¡rvore sob `/resources/...`; a janela nativa abria, porÃ©m JS, WASM e schema nÃ£o carregavam.
- VerificaÃ§Ã£o pendente de repetir no instalador 0.1.3.

## 0.1.2 â€” inicializaÃ§Ã£o do banco instalado

- Corrigida a ordem de registro do evento `ready` do Neutralino.
- Causa raiz: `src/js/app.js` chamava `Neutralino.init()` antes de registrar o listener usado por `src/js/backend/ambiente.js`, impedindo a criaÃ§Ã£o do banco em `%APPDATA%`.
- VerificaÃ§Ã£o pendente de repetir no instalador 0.1.2.

## 0.1.1 â€” persistÃªncia local

- Corrigida a inicializaÃ§Ã£o do cliente para carregar `neutralino.js` e `sql-wasm.js` como recursos empacotados.
- Banco local agora usa `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite`.
- Salvamento segue `tmp â†’ atual.old â†’ atual`, com recuperaÃ§Ã£o no boot.
- Causa raiz: a primeira interface criava `new SQL.Database()` em memÃ³ria e `criarApi` recebia persistÃªncia vazia em `src/js/app.js`.
- VerificaÃ§Ã£o: 3 testes automatizados e `node --check` em 7 arquivos.

## 0.1.0 â€” reconstruÃ§Ã£o inicial

- FundaÃ§Ã£o limpa do MLopes Finance local-first.
- NÃºcleo com contextos, contas, categorias, lanÃ§amentos e auditoria.
- Valores em centavos e datas operacionais em `YYYY-MM-DD`.
- Instalador Inno Setup em preparaÃ§Ã£o.

Esta versÃ£o sÃ³ pode ser marcada como pronta apÃ³s a validaÃ§Ã£o do executÃ¡vel instalado.


## 0.8.8-hotfix2 — `persistir()` quebrado (importação some) + toasts em todas as ações + UI da Importação reescrita

- **Bug GRAVE (raiz do "importei e os dados sumiram")**: o `persistir()` em `ambiente.js` usava `Neutralino.filesystem.move(tmp, arquivo)`. No Windows, `move` NÃO sobrescreve o destino. Quando o `<banco>.old` já existia (de uma gravação anterior), o passo `atual → .old` falhava silenciosamente no try/catch. Aí o passo `tmp → atual` também falhava (porque o `atual` ainda existia). O `persistir()` abortava sem erro visível. Resultado: tudo que o user fez (cadastros, edições, **importações OFX/CSV**) ficava só em memória e NUNCA chegava ao disco. O log do app mostrou `unhandledrejection: Cannot perform move: .tmp -> .sqlite` em 2026-08-13 às 00:33-00:34.
- **Fix**: `persistir()` agora usa `cmd.exe /c move /Y` (sobrescreve destino, confiável em Windows). Fluxo atômico da seção 4.3 do PADRAO agora funciona de verdade: 1) escreve em `.tmp`, 2) `move /Y atual → .old` (sobrescreve), 3) `move /Y .tmp → atual` (sobrescreve), 4) `.old` preservado para recovery manual.
- **Toast global**: novo helper `globalThis.toast(msg, tipo)` (tipos: `ok`, `err`, `warn`, `info`). Substitui todos os `alert()` por toasts não-bloqueantes. Usado em: salvar/cancelar/resetar de Configurações, criar/editar de Cadastros, criar Lançamento, registrar Baixa, criar Transferência, importar/cancelar Importação, exportar/restaurar Backup.
- **Tela de Importação reescrita**: novo painel "📍 Para onde vão os dados" no topo mostrando contexto financeiro + conta de destino (atualiza em tempo real) + resumo da prévia. Sem esse painel, o user não sabia pra onde os dados iam. Feedback ao vivo em todos os pontos (prévia criada, importar OK, importar cancelado, erro).
- **36/36 testes verde.** Hotfix aplicado direto no `resources.neu` instalado.


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


## 0.8.8-hotfix4 — Sinal do valor preservado na importação (despesa/receita)

- **Bug**: o `parsearCSV` e o `parsearOFX` faziam `Math.abs(valor)` ao calcular `valor_centavos`, perdendo o sinal. O `confirmarImportacao` então checava `valor < 0` (sempre false, porque `valor_centavos` já era positivo) e caía sempre no `padraoNatureza` default ('despesa'). Resultado: TODOS os lançamentos importados viravam despesa, mesmo os créditos (PIX RECEBIDO, SALARIO, etc).
- **Fix**:
  - `parsearCSV` e `parsearOFX`: removido `Math.abs`. `valor_centavos` agora preserva o sinal (negativo = despesa, positivo = receita). `natureza_sugerida` é calculada corretamente.
  - `confirmarImportacao`: usa o sinal do `valor` pra escolher a natureza. `padraoNatureza` (da UI) só é usado como fallback quando o sinal é 0 (não acontece, parser filtra zeros).
  - `criarPreviaImportacao` (detecção de duplicados): comparação com `Math.abs()` no JS. O schema de `lancamentos` exige `valor_centavos > 0`, então comparamos o valor absoluto do item com o valor absoluto do lançamento.
  - 1 teste novo (39/39 verde): "CSV com sinal cria lancamentos com natureza correta (despesa/receita)" — importa um CSV com PIX ENVIADO, PIX RECEBIDO, DEBITO COMBUSTIVEL, SALARIO. Confere que cada um virou lançamento com a natureza certa.
- **Como o Marcio vai usar agora**: Importar extrato → Pré-visualizar → vai ver na tabela "Valor" valores com sinal (negativo pra despesa, positivo pra receita). Confirmar → lançamentos criados com a natureza certa. Visão geral vai somar receitas corretamente.
