# GRAPHIFY — Mapa técnico do MLopes Finance

> Gerado automaticamente por `node tools/graphify.mjs` em 2026-08-14T12:45:19.027Z.
> Não editar manualmente. Fonte da verdade: `src/` e `tools/`.

## Resumo

| Categoria | Quantidade |
|---|---|
| core | 13 |
| tela | 8 |
| backend | 5 |
| sql | 1 |
| vendor | 0 |
| tool | 8 |

Total: 38 módulos.

## core (13)

### `src/js/backend/core/backup.js`

MLopes Finance — backup, exportacao e restauracao

**Exports:** `criarBackup`, `exportarSQLite`, `radiografar`, `validarBanco`, `restaurarBackup`, `validarCiclo`, `resetarBanco`

### `src/js/backend/core/baixas.js`

MLopes Finance — baixas (pagamentos) de lancamentos

**Exports:** `saldoEmAberto`, `registrarBaixa`, `listarBaixas`, `removerBaixa`

**Imports:** validarData, validarValorCentavos ← `./financeiro.js`

### `src/js/backend/core/cadastros.js`

MLopes Finance — cadastros editaveis (clientes, fornecedores, projetos, centros_custo, tags)

**Exports:** `criarCliente`, `listarClientes`, `atualizarCliente`, `criarFornecedor`, `listarFornecedores`, `atualizarFornecedor`, `criarProjeto`, `listarProjetos`, `atualizarProjeto`, `criarCentroCusto`, `listarCentrosCusto`, `criarTag`, `listarTags`, `vincularTagLancamento`, `listarTagsDoLancamento`, `excluirCliente`, `excluirFornecedor`, `excluirProjeto`, `excluirCentroCusto`, `excluirTag`, `desvincularTagLancamento`

### `src/js/backend/core/cartoes.js`

MLopes Finance — cartoes de credito e faturas

**Exports:** `criarCartao`, `listarCartoes`, `calcularCiclo`, `abrirFatura`, `adicionarLancamentoNaFatura`, `pagarFatura`, `listarFaturas`, `atualizarCartao`, `excluirCartao`, `listarFaturasDetalhadas`, `listarLancamentosDaFatura`, `calcularCicloDaCompra`, `faturaAtualDoCartao`

**Imports:** criarConta ← `./financeiro.js`

### `src/js/backend/core/configuracoes.js`

MLopes Finance — backend de configurações

**Exports:** `getConfig`, `setConfig`, `getAllConfig`, `deleteConfig`, `resetConfig`

### `src/js/backend/core/custosFixos.js`

MLopes Finance — Custos Fixos (v0.10.0)

**Exports:** `criarCustoFixo`, `listarCustosFixos`, `totalCustosFixosMes`, `resumoCustosFixosMes`, `gerarOcorrenciasMesAtual`, `alternarCustoFixo`, `excluirCustoFixo`

**Imports:** criarLancamento, listarLancamentos ← `./lancamentos.js`; criarRecorrencia, gerarProximaOcorrencia, listarRecorrencias, desativarRecorrencia, excluirRecorrencia ← `./recorrencias.js`

### `src/js/backend/core/financeiro.js`

* Retorna saldos agregados do contexto: total receitas, despesas, contas, clientes, etc.

**Exports:** `validarValorCentavos`, `validarData`, `criarContexto`, `listarContextos`, `obterContexto`, `atualizarContexto`, `alternarContextoAtivo`, `resumoContexto`, `saldoPorConta`, `criarConta`, `atualizarConta`, `criarCategoria`, `atualizarCategoria`, `excluirContexto`, `excluirConta`, `excluirCategoria`

### `src/js/backend/core/importacao.js`

MLopes Finance — importacao de extratos OFX e CSV

**Exports:** `parsearOFX`, `parsearCSV`, `criarPreviaImportacao`, `inferirNaturezaItem`, `confirmarImportacao`, `listarImportacoes`, `reciclarImportacao`, `cancelarImportacao`, `excluirImportacao`, `excluirLancamentosImportacao`

**Imports:** criarLancamento ← `./lancamentos.js`

### `src/js/backend/core/lancamentos.js`

=== EXCLUSAO / ESTORNO ===

**Exports:** `criarLancamento`, `conciliarLancamento`, `resumo`, `excluirLancamento`, `estornarLancamento`, `editarLancamento`, `listarLancamentos`, `excluirTodosLancamentos`, `listarLancamentosDetalhados`, `obterLancamento`

**Imports:** validarData, validarValorCentavos ← `./financeiro.js`; calcularCicloDaCompra, abrirFatura ← `./cartoes.js`

### `src/js/backend/core/recorrencias.js`

MLopes Finance — recorrencias

**Exports:** `criarRecorrencia`, `gerarProximaOcorrencia`, `listarRecorrencias`, `desativarRecorrencia`, `excluirRecorrencia`

**Imports:** criarLancamento ← `./lancamentos.js`

### `src/js/backend/core/relatorios.js`

MLopes Finance — Relatorios e balancete (Fase 6)

**Exports:** `calcularPeriodo`, `balancete`, `comparativo`, `exportaCSV`, `gastosPorMes`, `topCategorias`, `topDespesas`, `gastosPorConta`, `faturasAVencer`, `variacaoMensal`, `alertas`, `exportarMovimentosCSV`

**Imports:** validarData ← `./financeiro.js`

### `src/js/backend/core/transferencias.js`

MLopes Finance — transferencias entre contas do mesmo contexto

**Exports:** `criarTransferencia`, `listarTransferencias`, `excluirTransferencia`

**Imports:** validarData, validarValorCentavos ← `./financeiro.js`; criarLancamento ← `./lancamentos.js`

### `src/js/backend/core/update.js`

MLopes Finance — atualizacao online (parte PURA: sem DOM, sem Neutralino, sem Node APIs).

**Exports:** `compararVersao`, `extrairTagVersion`, `escolherAsset`, `renderizarMarkdownSimples`

## backend (5)

### `src/js/backend/ambiente.js`

**Exports:** `APP_VERSION`, `abrirBancoLocal`

### `src/js/backend/db.js`

**Exports:** `abrirBanco`, `salvarBancoSeguro`

**Imports:** fileURLToPath ← `node:url`

### `src/js/backend/migracoes.js`

**Exports:** `migrar`

### `src/js/backend/servidor.js`

**Exports:** `criarApi`

**Imports:** criarCategoria, criarConta, criarContexto, listarContextos, obterContexto, atualizarContexto, alternarContextoAtivo, resumoContexto, atualizarConta, atualizarCategoria, excluirContexto, excluirConta, excluirCategoria, saldoPorConta ← `./core/financeiro.js`; conciliarLancamento, criarLancamento, resumo, excluirLancamento, excluirTodosLancamentos, estornarLancamento, editarLancamento, listarLancamentos, listarLancamentosDetalhados, obterLancamento ← `./core/lancamentos.js`; getAllConfig, getConfig, setConfig, deleteConfig, resetConfig ← `./core/configuracoes.js`; criarBackup, radiografar, restaurarBackup, validarCiclo, resetarBanco ← `./core/backup.js`; criarCliente, listarClientes, atualizarCliente, criarFornecedor, listarFornecedores, atualizarFornecedor, criarProjeto, listarProjetos, atualizarProjeto, criarCentroCusto, listarCentrosCusto, criarTag, listarTags, vincularTagLancamento, listarTagsDoLancamento, excluirCliente, excluirFornecedor, excluirProjeto, excluirCentroCusto, excluirTag, desvincularTagLancamento ← `./core/cadastros.js`; criarTransferencia, listarTransferencias, excluirTransferencia ← `./core/transferencias.js`; registrarBaixa, listarBaixas, saldoEmAberto, removerBaixa ← `./core/baixas.js`; criarRecorrencia, gerarProximaOcorrencia, listarRecorrencias, excluirRecorrencia, desativarRecorrencia ← `./core/recorrencias.js`; criarCustoFixo, listarCustosFixos, totalCustosFixosMes, resumoCustosFixosMes, gerarOcorrenciasMesAtual, alternarCustoFixo, excluirCustoFixo ← `./core/custosFixos.js`; criarCartao, listarCartoes, abrirFatura, pagarFatura, listarFaturas, adicionarLancamentoNaFatura, atualizarCartao, excluirCartao, listarFaturasDetalhadas, listarLancamentosDaFatura, calcularCicloDaCompra, faturaAtualDoCartao ← `./core/cartoes.js`; criarPreviaImportacao, confirmarImportacao, listarImportacoes, cancelarImportacao, excluirImportacao, excluirLancamentosImportacao, reciclarImportacao ← `./core/importacao.js`; balancete, comparativo, exportaCSV, gastosPorMes, topCategorias, topDespesas, gastosPorConta, faturasAVencer, variacaoMensal, alertas, exportarMovimentosCSV ← `./core/relatorios.js`; compararVersao ← `./core/update.js`; checarAtualizacao, baixarAtualizacao, aplicarAtualizacao, listarReleases, pathTempInstalador ← `./update.js`; APP_VERSION ← `./ambiente.js`

### `src/js/backend/update.js`

MLopes Finance — atualizacao online (parte IMPURA: usa Neutralino + curl.exe).

**Exports:** `pathCacheWebView2Async`, `invalidarCacheWebView2`, `pathTempInstalador`, `pathRecursoInstalado`, `checarAtualizacao`, `listarReleases`, `baixarAtualizacao`, `aplicarAtualizacao`

**Imports:** compararVersao, escolherAsset, renderizarMarkdownSimples ← `./core/update.js`

## tela (8)

### `src/js/telas/cadastros-generico.js`

MLopes Finance — tela generica para cadastros (clientes, fornecedores, projetos, centros_custo, tags

**Exports:** `renderCadastroGenerico`

### `src/js/telas/cartoes.js`

MLopes Finance — Tela de Cartoes de Credito (CRUD)

**Exports:** `renderCartoes`

**API calls:** `cartoes:listar`, `contas:listar`, `cartoes:atualizar`, `cartoes:criar`, `cartoes:excluir`

### `src/js/telas/configuracoes.js`

MLopes Finance — Tela de Configurações

**Exports:** `renderConfiguracoes`

**API calls:** `configuracoes:listar`, `configuracoes:salvar`, `configuracoes:resetar`, `backup:exportar`, `backup:restaurar`, `backup:radiografar`, `backup:resetar`

### `src/js/telas/contextos.js`

MLopes Finance — Tela de Contextos Financeiros (CRUD)

**Exports:** `renderContextos`

**API calls:** `contextos:listar`, `contextos:resumo`, `contextos:alternarAtivo`, `contextos:excluir`, `contextos:obter`, `contextos:atualizar`, `contextos:criar`

### `src/js/telas/custosFixos.js`

MLopes Finance — Tela de Custos Fixos (v0.10.0)

**Exports:** `renderCustosFixos`

**API calls:** `contas:listar`, `categorias:listar`, `custosFixos:resumoMes`, `custosFixos:totalMes`, `custosFixos:gerarMesAtual`, `custosFixos:alternar`, `custosFixos:excluir`, `custosFixos:criar`

### `src/js/telas/faturas.js`

MLopes Finance — Tela de Faturas de Cartao

**Exports:** `renderFaturas`

**API calls:** `cartoes:listar`, `contas:listar`, `faturas:listarDetalhadas`, `faturas:listarLancamentos`, `faturas:pagar`

### `src/js/telas/importacao.js`

MLopes Finance — Tela de Importação de Extratos (OFX / CSV)

**Exports:** `renderImportacao`

**API calls:** `contas:listar`, `contextos:listar`, `importacao:criarPrevia`, `importacao:listarItens`, `importacao:confirmar`, `importacao:cancelar`, `importacao:listar`, `importacao:contarPorStatus`, `importacao:excluir`, `importacao:reciclar`, `importacao:excluirLancamentos`

### `src/js/telas/relatorios.js`

MLopes Finance — Tela de Relatórios e Balancete (Fase 6)

**Exports:** `renderRelatorios`

**API calls:** `relatorios:comparativo`, `relatorios:balancete`, `relatorios:exportarCSV`

## tool (8)

### `tools/build-resources.mjs`

Imagens extras (logo, favicon) usadas no header

**Imports:** fileURLToPath ← `node:url`

### `tools/check.mjs`

**Imports:** spawnSync ← `node:child_process`

### `tools/debug-cf.mjs`

Debug: testar criarCustoFixo isolado

**Imports:** fileURLToPath ← `node:url`; migrar ← `../src/js/backend/migracoes.js`; criarContexto, criarConta ← `../src/js/backend/core/financeiro.js`; criarCustoFixo, listarCustosFixos ← `../src/js/backend/core/custosFixos.js`

### `tools/debug-cf2.mjs`

**Imports:** fileURLToPath ← `node:url`; migrar ← `../src/js/backend/migracoes.js`; criarContexto, criarConta ← `../src/js/backend/core/financeiro.js`; criarCustoFixo, listarCustosFixos ← `../src/js/backend/core/custosFixos.js`

### `tools/debug-cf3.mjs`

**Imports:** fileURLToPath ← `node:url`; migrar ← `../src/js/backend/migracoes.js`; criarContexto, criarConta ← `../src/js/backend/core/financeiro.js`; criarCustoFixo, listarCustosFixos ← `../src/js/backend/core/custosFixos.js`

### `tools/debug-cols2.mjs`

Debug: cria um banco via novoBanco e checa colunas de lancamentos

**Imports:** fileURLToPath ← `node:url`; migrar ← `../src/js/backend/migracoes.js`

### `tools/debug-ofx-nubank.mjs`

Debug: testa o parser OFX atual no arquivo do Marcio

**Imports:** parsearOFX ← `../src/js/backend/core/importacao.js`

### `tools/graphify.mjs`

MLopes Finance — GRAPHIFY.md generator

**Imports:** fileURLToPath ← `node:url`

## sql (1)

### `src/js/backend/schema.sql`

**Tabelas:** `meta`, `contextos_financeiros`, `contas`, `categorias`, `lancamentos`, `auditoria`, `configuracoes`, `clientes`, `fornecedores`, `projetos`, `centros_custo`, `tags`, `lancamento_tags`, `transferencias`, `baixas`, `recorrencias`, `cartoes`, `faturas`, `importacoes`, `itens_importacao`, `anexos`, `conciliacoes`

**Indices:** `idx_lancamentos_contexto_data`, `idx_baixas_lancamento`, `idx_clientes_contexto`, `idx_fornecedores_contexto`, `idx_projetos_contexto`, `idx_centros_custo_contexto`, `idx_tags_contexto`, `idx_faturas_cartao`, `idx_importacoes_contexto`, `idx_itens_importacao_status`, `idx_itens_importacao_chave`, `idx_anexos_lancamento`, `idx_conciliacoes_conta`

