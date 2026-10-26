# Registro de ações

## 2026-08-15 - documentação viva e PDFs v0.12.2

- **Entregue:** guia rápido e manual completo revisados para o fluxo automatizado atual: importação histórica conciliada, cartão sem dívida duplicada, parcelamentos antigos quitados e balancetes separados por contexto.
- **Fontes:** `docs/GUIA-RAPIDO.md`, `docs/MANUAL-DO-USUARIO.md` e `docs/POLITICA-DE-DOCUMENTACAO.md`.
- **Automação:** criado `npm run docs:build`, usando `tools/build-docs.py` para gerar os PDFs canônicos em `output/pdf/`; cópias atualizadas também em `docs/`.
- **Execução reproduzível:** `tools/run-docs-build.mjs` localiza o Python com `reportlab` no runtime do workspace e mantém fallback para instalação local.
- **Validação:** PDFs gerados e renderizados com Poppler; páginas conferidas visualmente sem texto cortado ou sobreposição.
- **Regra permanente:** toda alteração futura de comportamento, dados, interface, testes ou empacotamento deve atualizar as fontes, regenerar os dois PDFs e registrar a ação neste arquivo.

## 2026-08-15 — v0.12.2: contador do painel

- **Correção:** `dashboard:resumo` agora retorna `lancamentos`; o painel deixou de exibir `undefined`.
- **Validação:** comportamento verificado no executável instalado v0.12.1 antes do novo pacote; banco preservado. Depois, v0.12.2 foi instalado e o painel mostrou `766` lançamentos.

## 2026-08-15 — v0.12.1: correção de importação quitada e parcelamentos históricos

- **Problema confirmado:** banco atual tinha 559 lançamentos em contas de cartão e 207 em contas bancárias com status `aberto`; 57 parcelamentos estavam com `0/N` parcelas pagas.
- **Correção:** importação automática grava movimentos como `conciliado`; a tela de baixas lista somente compromissos bancários realmente abertos; faturas vencidas e parcelas históricas são regularizadas por migração idempotente v8.
- **Preservação:** nenhum lançamento foi apagado; a correção mantém auditoria e deixa faturas/parcelas futuras pendentes.
- **Skills aplicadas:** Caveman e Graphify.
- **Testes:** `npm test` concluído com **141 aprovados, 0 falhas**.
- **Banco real corrigido:** backup em `%APPDATA%/MLopesFinance/dados/mlopes-finance.sqlite.bak-20260815-pre-correcao`; migração aplicada com banco na v8. Resultado: 207 lançamentos bancários conciliados, 557/559 lançamentos de cartão conciliados, 8 faturas pagas, 209 parcelas pagas e 0 itens na tela de Baixas.
- **Instalação/fluxo:** Setup v0.12.2 compilado e instalado; tela de Baixas e Parcelamentos verificada no executável instalado. SHA-256 do Setup: `984efae58ec4eb34808f0d5938f8e1cf35a51aa0401c4bfe54c78dab2deccb85`.

## 2026-08-14 — Auditoria integral do projeto

- **Objetivo:** auditar arquitetura, automações, persistência, testes, build, empacotamento e lacunas funcionais do MLopes Finance.
- **Skills aplicadas:** Caveman e Graphify.
- **Estado inicial:** checkout `main` limpo; versão declarada `0.11.4`.
- **Graphify:** executado pelo projeto; mapa `GRAPHIFY.md` atualizado. O relatório histórico em `graphify-out/` permanece com extração anterior e precisa de rebuild completo para não divergir do código atual.
- **Testes:** `npm test` concluído com **136 testes aprovados, 0 falhas**.
- **Verificador:** `npm run check` **falhou** em `tools/app-recovered.js`, que está em UTF-16 LE e não é JavaScript UTF-8 válido para `node --check`.
- **Build de resources:** concluído com sucesso.
- **Build portátil:** primeira tentativa concorrente com outro build falhou com `ENOTEMPTY` durante remoção de `resources/`; o pipeline serializado foi repetido e concluiu com sucesso.
- **Pacote mínimo:** `scripts/verify-installer.mjs` aprovou a presença de `MLopesFinance.exe` e `resources.neu` em `dist/MLopesFinance`.
- **Validação pendente:** instalação real, inicialização do executável instalado, versão exibida e fluxo funcional completo no Windows não foram executados nesta auditoria.
- **Falhas prioritárias encontradas:** persistência assíncrona disparada sem `await` em rotas mutáveis; automações de recorrências/custos fixos dependentes de botão; pipeline de build não reentrante; verificador sintático inclui artefato inválido; mapa Graphify pode ficar stale; cobertura sem testes de UI/instalador/concorrência/recuperação real.
- **Alterações de produto:** nenhuma. Apenas artefatos gerados/atualizados pela auditoria e este registro.

## 2026-08-14 — v0.12.0: importação automática de histórico

- **Objetivo:** eliminar confirmação manual da importação e classificar automaticamente extratos históricos.
- **Implementado:** rota `importacao:automatizar`, processamento automático na tela, resolução da conta única/nome do arquivo, classificação por natureza, criação de categorias sob demanda, associação de cartão/fatura e detecção automática de parcelamentos.
- **Histórico antigo:** parcelamentos incompletos agora reconstroem a primeira data usando o número da parcela; `3/12` importada em março gera janeiro como parcela 1 e mantém as parcelas futuras.
- **Parser:** valores brasileiros `1.234,56` e CSV com colunas separadas de débito/crédito.
- **Persistência:** gravações foram serializadas em fila no banco local para evitar colisão de `.tmp` em importações/ações consecutivas.
- **Verificador:** artefato UTF-16 de recuperação passou a ser explicitamente ignorado pelo check sintático; 32 JavaScript válidos continuam verificados.
- **Versão:** atualizada para `0.12.0` em package, Neutralino, app, ambiente, installer e histórico.
- **Testes:** `npm test` concluído com **138 aprovados, 0 falhas**.
- **Build:** resources e pacote Neutralino concluídos; `scripts/verify-installer.mjs` aprovou `MLopesFinance.exe` e `resources.neu`.
- **Graphify:** mapa técnico atualizado.
- **Exceção conhecida:** com várias contas ativas e arquivo sem nome/identificador compatível, o sistema para apenas para evitar colocar o extrato na conta errada.

## 2026-08-14 — correção do auto-update e entrega instalada

- **Atualizador:** caminhos literais `%LOCALAPPDATA%` não são mais tratados como caminhos reais; o destino agora é resolvido pelo diretório efetivo da instalação antes de baixar/aplicar `resources.neu`.
- **Validação:** instalador `release/MLopes Finance Setup.exe` compilado com sucesso para v0.12.0.
- **Instalação:** executável instalado em `%LOCALAPPDATA%/Programs/MLopes Finance` e iniciado com sucesso; processo observado em execução.
- **Integridade:** hashes SHA-256 do executável e de `resources.neu` instalados são idênticos aos artefatos de `dist/MLopesFinance`.
- **Preservação:** nenhum módulo de produto foi removido; alterações ficaram restritas à automação de importação, parser, parcelamentos, persistência, atualização, testes, documentação e artefatos de build.
