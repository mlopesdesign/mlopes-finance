# GRAPHIFY — Mapa técnico do MLopes Finance

> Gerado automaticamente por `node tools/graphify.mjs` em 2026-08-14T02:46:39.801Z.
> Não editar manualmente. Fonte da verdade: `src/` e `tools/`.

## Resumo

| Categoria | Quantidade |
|---|---|
| core | 12 |
| tela | 5 |
| backend | 5 |
| sql | 1 |
| vendor | 0 |
| tool | 3 |

Total: 29 módulos.

## core (12)

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

**Exports:** `criarCartao`, `listarCartoes`, `calcularCiclo`, `abrirFatura`, `adicionarLancamentoNaFatura`, `pagarFatura`, `listarFaturas`

### `src/js/backend/core/configuracoes.js`

MLopes Finance — backend de configurações

**Exports:** `getConfig`, `setConfig`, `getAllConfig`, `deleteConfig`, `resetConfig`

### `src/js/backend/core/financeiro.js`

* Retorna saldos agregados do contexto: total receitas, despesas, contas, clientes, etc.

**Exports:** `validarValorCentavos`, `validarData`, `criarContexto`, `listarContextos`, `obterContexto`, `atualizarContexto`, `alternarContextoAtivo`, `resumoContexto`, `criarConta`, `atualizarConta`, `criarCategoria`, `atualizarCategoria`, `excluirContexto`, `excluirConta`, `excluirCategoria`

### `src/js/backend/core/importacao.js`

MLopes Finance — importacao de extratos OFX e CSV

**Exports:** `parsearOFX`, `parsearCSV`, `criarPreviaImportacao`, `inferirNaturezaItem`, `confirmarImportacao`, `listarImportacoes`, `cancelarImportacao`, `excluirImportacao`, `excluirLancamentosImportacao`

**Imports:** criarLancamento ← `./lancamentos.js`

### `src/js/backend/core/lancamentos.js`

=== EXCLUSAO / ESTORNO ===

**Exports:** `criarLancamento`, `conciliarLancamento`, `resumo`, `excluirLancamento`, `estornarLancamento`, `editarLancamento`, `listarLancamentos`, `excluirTodosLancamentos`, `listarLancamentosDetalhados`, `obterLancamento`

**Imports:** validarData, validarValorCentavos ← `./financeiro.js`

### `src/js/backend/core/recorrencias.js`

MLopes Finance — recorrencias

**Exports:** `criarRecorrencia`, `gerarProximaOcorrencia`, `listarRecorrencias`, `desativarRecorrencia`, `excluirRecorrencia`

**Imports:** criarLancamento ← `./lancamentos.js`

### `src/js/backend/core/relatorios.js`

MLopes Finance — Relatorios e balancete (Fase 6)

**Exports:** `calcularPeriodo`, `balancete`, `comparativo`, `exportaCSV`

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

**Imports:** criarCategoria, criarConta, criarContexto, listarContextos, obterContexto, atualizarContexto, alternarContextoAtivo, resumoContexto, atualizarConta, atualizarCategoria, excluirContexto, excluirConta, excluirCategoria ← `./core/financeiro.js`; conciliarLancamento, criarLancamento, resumo, excluirLancamento, excluirTodosLancamentos, estornarLancamento, editarLancamento, listarLancamentos, listarLancamentosDetalhados, obterLancamento ← `./core/lancamentos.js`; getAllConfig, getConfig, setConfig, deleteConfig, resetConfig ← `./core/configuracoes.js`; criarBackup, radiografar, restaurarBackup, validarCiclo, resetarBanco ← `./core/backup.js`; criarCliente, listarClientes, atualizarCliente, criarFornecedor, listarFornecedores, atualizarFornecedor, criarProjeto, listarProjetos, atualizarProjeto, criarCentroCusto, listarCentrosCusto, criarTag, listarTags, vincularTagLancamento, listarTagsDoLancamento, excluirCliente, excluirFornecedor, excluirProjeto, excluirCentroCusto, excluirTag, desvincularTagLancamento ← `./core/cadastros.js`; criarTransferencia, listarTransferencias, excluirTransferencia ← `./core/transferencias.js`; registrarBaixa, listarBaixas, saldoEmAberto, removerBaixa ← `./core/baixas.js`; criarRecorrencia, gerarProximaOcorrencia, listarRecorrencias, excluirRecorrencia, desativarRecorrencia ← `./core/recorrencias.js`; criarCartao, listarCartoes, abrirFatura, pagarFatura, listarFaturas, adicionarLancamentoNaFatura ← `./core/cartoes.js`; criarPreviaImportacao, confirmarImportacao, listarImportacoes, cancelarImportacao, excluirImportacao, excluirLancamentosImportacao ← `./core/importacao.js`; balancete, comparativo, exportaCSV ← `./core/relatorios.js`; compararVersao ← `./core/update.js`; checarAtualizacao, baixarAtualizacao, aplicarAtualizacao, listarReleases, pathTempInstalador ← `./update.js`; APP_VERSION ← `./ambiente.js`

### `src/js/backend/update.js`

MLopes Finance — atualizacao online (parte IMPURA: usa Neutralino + curl.exe).

**Exports:** `pathCacheWebView2Async`, `invalidarCacheWebView2`, `pathTempInstalador`, `pathRecursoInstalado`, `checarAtualizacao`, `listarReleases`, `baixarAtualizacao`, `aplicarAtualizacao`

**Imports:** compararVersao, escolherAsset, renderizarMarkdownSimples ← `./core/update.js`

## tela (5)

### `src/js/telas/cadastros-generico.js`

MLopes Finance — tela generica para cadastros (clientes, fornecedores, projetos, centros_custo, tags

**Exports:** `renderCadastroGenerico`

### `src/js/telas/configuracoes.js`

MLopes Finance — Tela de Configurações

**Exports:** `renderConfiguracoes`

**API calls:** `configuracoes:listar`, `configuracoes:salvar`, `configuracoes:resetar`, `backup:exportar`, `backup:restaurar`, `backup:radiografar`, `backup:resetar`

### `src/js/telas/contextos.js`

MLopes Finance — Tela de Contextos Financeiros (CRUD)

**Exports:** `renderContextos`

**API calls:** `contextos:listar`, `contextos:resumo`, `contextos:alternarAtivo`, `contextos:excluir`, `contextos:obter`, `contextos:atualizar`, `contextos:criar`

### `src/js/telas/importacao.js`

MLopes Finance — Tela de Importação de Extratos (OFX / CSV)

**Exports:** `renderImportacao`

**API calls:** `contas:listar`, `contextos:listar`, `importacao:criarPrevia`, `importacao:listarItens`, `importacao:confirmar`, `importacao:cancelar`, `importacao:listar`, `importacao:excluir`, `importacao:excluirLancamentos`

### `src/js/telas/relatorios.js`

MLopes Finance — Tela de Relatórios e Balancete (Fase 6)

**Exports:** `renderRelatorios`

**API calls:** `relatorios:comparativo`, `relatorios:balancete`, `relatorios:exportarCSV`

## tool (3)

### `tools/build-resources.mjs`

Imagens extras (logo, favicon) usadas no header

**Imports:** fileURLToPath ← `node:url`

### `tools/check.mjs`

**Imports:** spawnSync ← `node:child_process`

### `tools/graphify.mjs`

MLopes Finance — GRAPHIFY.md generator

**Imports:** fileURLToPath ← `node:url`

## sql (1)

### `src/js/backend/schema.sql`

**Tabelas:** `meta`, `contextos_financeiros`, `contas`, `categorias`, `lancamentos`, `auditoria`, `configuracoes`, `clientes`, `fornecedores`, `projetos`, `centros_custo`, `tags`, `lancamento_tags`, `transferencias`, `baixas`, `recorrencias`, `cartoes`, `faturas`, `importacoes`, `itens_importacao`, `anexos`, `conciliacoes`

**Indices:** `idx_lancamentos_contexto_data`, `idx_baixas_lancamento`, `idx_clientes_contexto`, `idx_fornecedores_contexto`, `idx_projetos_contexto`, `idx_centros_custo_contexto`, `idx_tags_contexto`, `idx_faturas_cartao`, `idx_importacoes_contexto`, `idx_itens_importacao_status`, `idx_itens_importacao_chave`, `idx_anexos_lancamento`, `idx_conciliacoes_conta`

