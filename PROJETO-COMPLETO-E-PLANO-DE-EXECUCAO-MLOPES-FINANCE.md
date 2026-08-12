# MLopes Finance — Projeto completo e plano de execução

**Produto:** MLopes Finance  
**Situação em 12 de agosto de 2026:** especificação consolidada. A fundação existente não está aprovada para uso, venda ou instalação.  
**Objetivo:** entregar um aplicativo financeiro profissional, local-first, instalável no Windows 10/11 e comercializável para diferentes clientes.

---

## 1. Visão do produto

O MLopes Finance é um sistema de gestão financeira pessoal e empresarial. Ele não é um simples controle de gastos: deve reunir rotina financeira, previsões, cartões, contas a pagar e receber, operação comercial, importação bancária, conciliação, investimentos e análise gerencial.

Na instalação do proprietário poderão existir os contextos **Pessoal** e **ML Lopes Design**, totalmente separados. Esses nomes são apenas configuração inicial: o produto comercial não pode conter empresa, banco, categoria, cliente, cidade, prefeitura ou plano de contas fixo como regra de sistema.

Cada cliente deve criar, editar, ordenar, desativar e usar os próprios contextos financeiros, contas, cartões, investimentos, clientes, projetos, categorias, centros de custo e classificações.

### Princípios de produto

- O sistema precisa ser completo, mas campos de classificação não devem ser obrigatórios sem necessidade real.
- O contexto financeiro é sempre obrigatório e impede mistura de saldos, lançamentos e relatórios.
- O financeiro funciona sem emissão fiscal. Fiscal é um módulo opcional e desacoplado.
- Toda informação financeira relevante precisa ter histórico e rastreabilidade.
- Nada conciliado é apagado ou alterado diretamente.
- A interface deve estar integralmente em português e servir a pessoas não técnicas.

---

## 2. Plataforma e arquitetura aprovada

| Item | Decisão |
| --- | --- |
| Plataforma | Windows 10 e Windows 11 |
| Modelo | Local-first; uso principal sem depender de internet |
| Cliente | JavaScript ES modules puro, HTML e CSS, sem framework de front-end |
| Contêiner desktop | Neutralino 6 + WebView2 |
| Banco local | SQLite em `%APPDATA%/MLopesFinance/dados/mlopes-finance.sqlite` |
| Sincronização futura | Somente por API autenticada; o aplicativo nunca acessa banco remoto diretamente |
| Regra de negócio | `src/js/backend/core/`, isolada de DOM, `window` e Neutralino |
| Acesso da interface | Uma única API de backend; autorização conferida no backend |
| Valores | Inteiros em centavos |
| Datas operacionais | `YYYY-MM-DD` |
| Atualizações | Releases versionadas, backup antes da atualização e persistência gravada antes do reinício |

Antes da primeira instalação comercial podem ser revisados em conjunto o nome, `applicationId`, nome do executável, pasta de dados e nome do banco. Depois da primeira distribuição comercial, esses itens são imutáveis.

---

## 3. Escopo funcional aprovado

### 3.1 Contextos financeiros e cadastros

Cada linha financeira pertence a um contexto financeiro. Contextos são cadastros editáveis e podem representar uma pessoa, empresa, filial, projeto ou outra divisão financeira.

Cadastros editáveis necessários:

- Contextos financeiros
- Contas bancárias
- Cartões de crédito
- Investimentos
- Clientes
- Projetos
- Categorias e subcategorias
- Centros de custo
- Tags
- Fornecedores e favorecidos
- Formas de pagamento
- Regras de recorrência

O sistema deve permitir inativação sem destruir dados históricos. Um cadastro que possui lançamento não pode simplesmente desaparecer.

### 3.2 Lançamentos e contas a pagar/receber

O núcleo financeiro deve controlar:

- Receitas, despesas e transferências entre contas do mesmo contexto.
- Contas a pagar e contas a receber, à vista ou parceladas.
- Competência, vencimento, previsão, liquidação e situação do lançamento.
- Baixas totais e parciais, sem exceder o saldo em aberto.
- Recorrências editáveis, com geração controlada das ocorrências futuras.
- Anexos, documentos, observações e histórico de alterações.
- Classificação opcional por cliente, projeto, categoria, centro de custo e tags.
- Estorno e ajuste auditáveis para correção de lançamentos protegidos.

Campos mínimos obrigatórios em um lançamento: contexto financeiro, natureza, valor positivo em centavos, data de competência e conta ou destino financeiro aplicável. Cliente, projeto, categoria, centro de custo, tags, documento/anexo e observações ficam disponíveis conforme a necessidade de cada lançamento.

### 3.3 Contas bancárias

Para cada conta bancária o sistema deve manter:

- Instituição, nome da conta, titularidade e contexto financeiro.
- Saldo inicial controlado e histórico de saldo calculado por movimentações.
- Lançamentos previstos, realizados, pendentes de conciliação e conciliados.
- Transferências com contrapartida vinculada e rastreável.
- Importação OFX/CSV com prévia antes de qualquer gravação.
- Extrato por período e conciliação bancária.

### 3.4 Cartões de crédito

O cartão precisa ser um módulo financeiro real, não apenas uma categoria de despesa.

- Cadastro de limite total, conta de pagamento, dia de fechamento e vencimento.
- Faturas por ciclo, com situação, total, pagamento e itens vinculados.
- Limite total, usado, disponível e comprometimento das parcelas futuras.
- Compras à vista e parceladas.
- Parcelas futuras previstas e vinculadas à compra original.
- Pagamento da fatura por conta bancária, sem duplicar despesa.
- Ajustes de fatura, estornos e auditoria.

Uma parcela já liquidada não pode ser silenciosamente modificada por alteração posterior da compra.

### 3.5 Investimentos

O sistema deve tratar investimentos como contas próprias, pertencentes a um contexto financeiro, com:

- Aportes, resgates, rendimentos, taxas e impostos.
- Instituição, produto, classificação e conta de origem/destino.
- Saldo financeiro, custo acumulado e resultado por período.
- Transferências entre conta bancária e investimento vinculadas, sem dupla contagem.
- Registro manual inicial e arquitetura preparada para importações futuras quando houver fonte confiável.

### 3.6 Comercial: orçamento até recebimento

Para a operação empresarial, o fluxo deve ser completo e conectado ao financeiro sem confundir os dois domínios:

1. Cadastro de cliente e projeto.
2. Orçamento/proposta com itens, validade, condições e anexos.
3. Aprovação, recusa, expiração ou revisão versionada.
4. Contrato e/ou recorrência quando aplicável.
5. Geração de conta a receber prevista.
6. Recebimentos totais ou parciais.
7. Baixa financeira e conciliação bancária.
8. Indicadores por cliente, projeto, categoria e centro de custo.

Também deve ser possível criar uma receita ou despesa diretamente, sem obrigar o uso do fluxo comercial.

### 3.7 Importação e conciliação

Entradas inicialmente aprovadas:

- Lançamento manual.
- Importação OFX.
- Importação CSV configurável por mapeamento de colunas.

Regras obrigatórias:

- A importação mostra prévia, validações e possíveis duplicidades antes de gravar.
- Nenhum item importado é gravado automaticamente sem confirmação explícita.
- A origem, arquivo, data, conta e chave externa são registradas para impedir reimportação.
- O usuário pode classificar, ignorar, vincular ou criar lançamento a partir de cada item importado.
- A conciliação deve comparar extrato e lançamentos, registrar a decisão e ser reversível com auditoria.
- Lançamento conciliado não é apagado nem alterado diretamente; correções são por estorno ou ajuste auditável.

### 3.8 Relatórios e visão gerencial

Relatórios e painéis precisam respeitar o contexto financeiro escolhido e permitir filtros por período, conta, cliente, projeto, categoria e centro de custo. A consulta temporal é requisito obrigatório: o usuário deve poder analisar o **dia**, o **mês**, o **ano** e qualquer intervalo personalizado, sem depender de relatório separado ou exportação manual.

O painel inicial deve permitir alternar, no mínimo, entre:

- Hoje e intervalo diário selecionado.
- Mês atual, meses anteriores e comparativo mensal.
- Ano atual, anos anteriores e comparativo anual.
- Intervalo personalizado, incluindo períodos que atravessam meses ou anos.

Cada visão deve separar previsto, realizado, pendente, vencido e conciliado quando esses estados forem aplicáveis. Comparativos devem preservar o mesmo conjunto de filtros para que o resultado seja confiável.

- Fluxo de caixa previsto versus realizado.
- Saldos por conta, cartão e investimento, por dia, mês, ano ou período.
- Contas a pagar e receber por vencimento e situação, com visão diária, mensal e anual.
- Inadimplência e recebimentos parciais por período.
- Faturas, limite disponível e parcelas futuras, por ciclo mensal e projeção anual.
- Receitas, despesas e resultado por cliente/projeto, por dia, mês, ano ou período personalizado.
- DRE gerencial parametrizável mensal e anual, sem confundir com escrituração contábil oficial.
- Rentabilidade por projeto, cliente, categoria e centro de custo, com comparativos mensais e anuais.
- Relatórios exportáveis em formato adequado para uso e conferência.

### 3.9 Fiscal opcional

Fiscal é opcional, desativado por padrão e não bloqueia nenhuma função financeira.

Na primeira entrega fiscal, o produto deve permitir registrar documentos emitidos externamente: número, série quando aplicável, chave, status, PDF/XML, vínculo com cliente, projeto e recebimento.

A emissão integrada deve ser desenvolvida em módulo separado. Para serviços, o caminho prioritário é a NFS-e, que exigirá pesquisa e configuração por município, regime tributário e certificado. NF-e e NFC-e são documentos independentes e não devem ser incluídos por suposição.

---

## 4. Regras de integridade e segurança

1. Toda movimentação financeira tem contexto financeiro obrigatório.
2. Valores monetários são sempre inteiros em centavos; não usar ponto flutuante para cálculo financeiro.
3. Uma transferência cria débito e crédito vinculados e pertence a um único contexto.
4. Uma baixa parcial nunca excede o saldo em aberto.
5. Compra parcelada cria previsões vinculadas; parcelas liquidadas permanecem preservadas.
6. Importação requer prévia e confirmação; a chave externa impede reimportação indevida.
7. Conciliação é reversível e auditada.
8. Lançamento conciliado não é apagado nem alterado diretamente.
9. Cadastros com histórico são inativados, não apagados.
10. Toda ação relevante registra auditoria: quem, quando, ação, valores anteriores e novos valores quando aplicável, e origem da ação.
11. O banco é gravado de forma segura: `tmp → atual.old → tmp para atual → remove old`. O arquivo atual nunca é removido antes de haver substituto válido.
12. Backup, exportação e restauração precisam validar conteúdo essencial, não apenas confirmar que o arquivo abre.
13. Migrações são idempotentes e testadas sobre banco real de versão anterior.

---

## 5. Modelo de dados inicial

Entidades mínimas previstas:

`contextos_financeiros`, `usuarios`, `perfis`, `permissoes`, `contas`, `cartoes`, `faturas`, `investimentos`, `clientes`, `fornecedores`, `projetos`, `categorias`, `centros_custo`, `tags`, `lancamentos`, `parcelas`, `baixas`, `transferencias`, `recorrencias`, `importacoes`, `itens_importacao`, `conciliacoes`, `anexos`, `documentos_fiscais` e `auditoria`.

O schema deve conter chaves primárias, chaves estrangeiras, índices para filtros recorrentes, restrições de integridade e campos de criação/atualização. Antes de congelar o schema, o responsável técnico deve revisar cada relação e cada regra de exclusão/inativação contra este documento.

---

## 6. Interface e experiência de uso

A aplicação precisa ser limpa, moderna e profissional, com informações financeiras legíveis. Não são aceitos botões sem função, telas fictícias ou campos desconectados do banco.

Telas mínimas:

- Visão geral: saldos, próximos vencimentos, caixa previsto/realizado e alertas úteis.
- Visão temporal diária, mensal e anual, com seletor de período e comparativos.
- Contextos financeiros e configurações.
- Contas bancárias, cartões e investimentos.
- Lançamentos, contas a pagar, contas a receber e recorrências.
- Faturas e compras parceladas.
- Importação OFX/CSV e conciliação.
- Clientes, projetos, categorias, centros de custo, tags e fornecedores.
- Propostas, contratos/recorrências e recebimentos.
- Relatórios gerenciais.
- Backup, exportação, restauração, auditoria e dados da instalação.
- Fiscal, somente quando o módulo estiver ativado.

Regras de interface:

- Nenhuma autorização pode depender apenas de esconder um botão; a conferência é do backend.
- Campos numéricos devem permitir digitação sem redesenhar a tela a cada caractere; a normalização ocorre ao sair do campo ou confirmar.
- Ações sensíveis devem ter confirmação clara e resultado visual persistente.
- A interface não pode redesenhar área vizinha em um `blur` a ponto de destruir o item clicado.
- O HTML deve ter UTF-8 com BOM e `<meta charset>`; manter `<meta name="viewport">`.

---

## 7. Estado atual do projeto e itens reprovados

Existe uma fundação de código com schema, migrações, parte do núcleo financeiro, API, interface inicial, testes e scripts de build. Ela é referência de análise, não base aprovada para venda.

Arquivos principais encontrados:

| Caminho | Estado informado |
| --- | --- |
| `src/js/backend/core/financeiro.js` e `lancamentos.js` | Fundação de regras de lançamentos, baixas, transferências e parcelas |
| `src/js/backend/servidor.js` | Porta única de API `processar(canal, dados)` |
| `src/js/backend/db.js` | Persistência SQLite/sql.js e rotina de arquivo seguro |
| `src/js/backend/schema.sql`, `migracoes.js` | Schema e migrações iniciais |
| `tests/*.test.mjs` | Testes iniciais do núcleo e migração |
| `tools/check.mjs`, `tools/graphify.mjs` | Verificação e mapa técnico |
| `scripts/build-portable.mjs`, `scripts/build-installer.mjs`, `installer/MLopesFinance.nsi` | Tentativas de empacotamento |

Os instaladores já gerados são **reprovados e não podem ser distribuídos**. O executável chegou a abrir a página padrão do Neutralino em vez do MLopes Finance. Isso prova que a validação anterior comprovou apenas a existência do pacote, não o funcionamento real do aplicativo instalado.

Também foram identificados diretórios duplicados gerados nas tentativas de build. Eles precisam ser inventariados e reorganizados, sem apagar nada antes de separar fonte de verdade, resíduos de build e artefatos inválidos.

---

## 8. Planejamento de execução obrigatório

O desenvolvimento segue sem converter etapas pendentes em “produto pronto”. Uma fase só avança quando seus critérios de aceite e verificações forem concluídos.

### Fase 0 — Auditoria e recuperação controlada da fundação

**Objetivo:** conhecer o código existente antes de editar e tornar o repositório confiável.

1. Ler integralmente `AGENTS.md`, esta especificação, documentação, histórico, scripts, configuração, schema e testes.
2. Inventariar arquivos, dependências, versões, fontes de recursos, executáveis e diretórios duplicados.
3. Identificar a fonte de verdade para `src`, configuração Neutralino, recursos, banco, scripts e documentação.
4. Criar ou confirmar repositório Git local, branch `main` e remoto no GitHub. Material bruto e artefatos regeneráveis ficam fora do Git; recursos de entrega e banco inicial validado, se existirem, têm regra explícita de versionamento.
5. Atualizar o diagnóstico com evidência de arquivo e linha. Nenhuma hipótese deve ser apresentada como causa.

**Aceite:** inventário assinado no projeto, árvore consolidada, Git com remoto configurado e nenhum artefato inválido confundido com fonte de verdade.

### Fase 1 — Corrigir a cadeia de build antes de implementar módulos

**Objetivo:** produzir um aplicativo mínimo que abra os recursos corretos, usando a cadeia oficial do Neutralino 6.

1. Reproduzir o defeito da página padrão e identificar, com arquivo e linha, por que os recursos do produto não são carregados.
2. Abandonar substituições não comprovadas para o formato de recursos; usar ou comprovar a compatibilidade do fluxo oficial do Neutralino 6.
3. Manter uma única origem para recursos da interface e configuração do aplicativo.
4. Empacotar incluindo executável, `resources.neu`, `WebView2Loader.dll` e todos os arquivos exigidos pela distribuição oficial.
5. Instalar em ambiente limpo e abrir pelo instalador, atalho e menu Iniciar.
6. Confirmar visualmente e funcionalmente que a tela aberta é o MLopes Finance, não a página padrão do framework.

**Aceite:** instalador de teste funciona em Windows 10/11, abre a interface correta, fecha e reabre sem erro, e os dados são criados em `%APPDATA%/MLopesFinance/dados`.

### Fase 2 — Banco, migrações, backup e auditoria

**Objetivo:** tornar o dado financeiro seguro antes de expandir a interface.

1. Revisar schema completo contra os módulos aprovados.
2. Formalizar versões de schema e migrações idempotentes.
3. Implementar dados iniciais editáveis, sem nomes comerciais obrigatórios no produto.
4. Implementar escrita atômica do banco, backup, exportação e restauração.
5. Criar auditoria de ações financeiras e administrativas.
6. Testar migração sobre banco de versão anterior e restauração com conferência de tabelas e contagens essenciais.

**Aceite:** banco preservado após falha simulada de gravação, backup/restauração conferidos por conteúdo e todas as migrações repetíveis sem corromper dados.

### Fase 3 — Cadastros e núcleo financeiro

**Objetivo:** concluir o caminho financeiro básico de ponta a ponta.

1. Entregar cadastros de contextos, contas, clientes, projetos, categorias, centros de custo, tags, fornecedores e formas de pagamento.
2. Implementar receitas, despesas, transferências, contas a pagar/receber e baixas parciais/totais.
3. Implementar recorrências e status de previsão/realizado.
4. Implementar anexos, observações e auditoria visível.
5. Construir telas operacionais conectadas à API e ao banco real.

**Aceite:** usuário cria, filtra, liquida, estorna e audita operações sem misturar contextos financeiros; testes cobrem o caminho mínimo e o caminho completo.

### Fase 4 — Cartões, parcelas e investimentos

**Objetivo:** tratar crédito e investimentos com integridade financeira.

1. Implementar cartões, ciclos, faturas, limites e pagamento de fatura.
2. Implementar compra parcelada, previsões futuras e alteração segura de compra.
3. Implementar investimentos, aportes, resgates, rendimentos, taxas e impostos.
4. Validar transferências vinculadas entre conta bancária e investimento.

**Aceite:** faturas, limites e parcelas fecham corretamente; não há duplicidade de despesa no pagamento; resultado de investimentos é conferível por lançamento.

### Fase 5 — Importação OFX/CSV e conciliação

**Objetivo:** reduzir trabalho manual sem arriscar dados.

1. Implementar leitor OFX com validações e prévia.
2. Implementar importador CSV com mapeamento salvo por origem quando necessário.
3. Criar mecanismo de identidade externa, identificação de duplicidade e bloqueio de reimportação.
4. Criar fila de triagem: ignorar, classificar, vincular ou gerar lançamento.
5. Implementar conciliação, reversão e auditoria.

**Aceite:** nenhum extrato grava automaticamente; reimportação é bloqueada; conciliação e reversão preservam histórico e saldo.

### Fase 6 — Comercial, previsões e relatórios

**Objetivo:** completar o ciclo da receita e a leitura gerencial.

1. Implementar propostas/orçamentos, versões, aprovação e conversão para conta a receber.
2. Implementar contratos e recorrências comerciais sem exigir esse fluxo em receitas diretas.
3. Implementar dashboards e relatórios aprovados, com filtros diários, mensais, anuais, intervalo personalizado, comparativos e exportação.
4. Validar rentabilidade, fluxo previsto versus realizado, vencimentos e inadimplência em cada visão temporal.

**Aceite:** proposta aprovada pode gerar recebíveis; recebimentos parciais chegam à conciliação; relatórios respeitam todos os filtros e contextos.

### Fase 7 — Produto comercial, permissões e operação

**Objetivo:** tornar a instalação segura, recuperável e comercializável.

1. Implementar usuários, perfis e permissões de backend se houver uso por mais de uma pessoa na mesma instalação.
2. Fechar backup automatizado/manual, exportação, restauração e checagem de integridade.
3. Criar configurações de marca e dados da instalação sem dados fixos do proprietário.
4. Definir atualização por release, backup obrigatório e rollback seguro quando possível.
5. Preparar assinatura digital de código para reduzir alertas de reputação do Windows. O aviso do SmartScreen não é defeito funcional, mas assinatura e reputação são requisito de lançamento comercial.

**Aceite:** atualização preserva banco; desinstalação não remove dados sem escolha explícita; permissões são efetivas no backend; backups são restauráveis.

### Fase 8 — Fiscal opcional

**Objetivo:** adicionar fiscal sem fragilizar o financeiro.

1. Entregar registro de nota emitida externamente com anexos e vínculo financeiro.
2. Pesquisar, por fontes oficiais, a viabilidade vigente de NFS-e para os municípios e regimes prioritários.
3. Projetar credenciais, certificados, logs, contingência, cancelamento e tratamento de retorno sem expor segredos no cliente.
4. Implementar a integração por adaptadores municipais/provedores, com configuração explícita por cliente.

**Aceite:** o financeiro permanece totalmente funcional com o módulo desligado; nenhuma emissão é configurada por suposição.

---

## 9. Testes, documentação e release

Cada alteração estrutural deve gerar, na mesma entrega:

- Testes automatizados novos ou atualizados contra SQLite real.
- Teste de migração sobre banco de versão anterior.
- Teste do caminho mínimo, inclusive formulários preenchidos parcialmente quando aplicável.
- `node --check` em cada JavaScript alterado.
- Execução isolada de cada comando do `schema.sql`.
- `GRAPHIFY.md` regerado por `node tools/graphify.js`; jamais editado manualmente.
- `docs/MANUAL-DO-USUARIO.md` completo, em linguagem simples.
- `docs/GUIA-RAPIDO.md` resumido para a rotina diária.
- PDFs atualizados dos dois manuais para distribuição.
- Bloco de novidades visível no sistema.
- Histórico de versões com sintoma, causa com arquivo/linha, correção, motivo de não ter sido percebido, verificação e lição/armadilha descoberta.

Antes de qualquer release:

1. Versão conferida nos três pontos definidos como fonte de verdade.
2. Testes automatizados e de migração verdes.
3. Instalação limpa validada em Windows.
4. Aplicativo aberto, utilizado e reaberto após instalação.
5. Banco criado e persistido em `%APPDATA%/MLopesFinance/dados`.
6. Conteúdo efetivo do instalador conferido: executável, recursos corretos, DLLs e atalho.
7. Manual, guia, PDFs, `GRAPHIFY.md`, changelog e release notes correspondem à versão entregue.
8. SHA-256 gerado do instalador final.

O único artefato apresentado como entrega para instalação é um instalador real, por exemplo `MLopes Finance Setup.exe`, aprovado pelos critérios acima. ZIP de fonte, `resources.neu` isolado ou executável sem teste instalado jamais podem ser apresentados como produto pronto.

---

## 10. Armadilhas já identificadas

| Área | Armadilha | Regra permanente |
| --- | --- | --- |
| Empacotamento | Validar arquivos presentes não comprova que o aplicativo correto abre | Testar em instalação limpa, visualmente e de ponta a ponta |
| Neutralino | O executável pode carregar a página padrão do framework | Confirmar fonte de recursos e fluxo oficial de empacotamento |
| Dados | Apagar arquivo atual antes de mover o novo pode deixar banco inexistente | Usar sempre `tmp → .old → move → remove .old` |
| SQLite | Alterações de restrições nem sempre são diretas | Reconstruir tabela em transação e conferir contagens |
| Formulários | Redesenhar tela no `blur` pode cancelar o clique seguinte | Recalcular somente o necessário e preservar o elemento clicado |
| Campos numéricos | Redesenhar no `change` ou a cada ação pode matar o cursor | Aceitar vazio enquanto digita e normalizar no `blur`/Enter |
| Testes | Um teste mal escrito pode reportar defeito inexistente | Conferir que o teste usa o mesmo formato da aplicação |
| Atualização | Alterar arquivo de release publicada não atualiza clientes | Todo build alterado recebe nova versão |
| Windows | SmartScreen sem assinatura reduz confiança | Planejar certificado de assinatura antes da comercialização |

---

## 11. Critérios finais de aceite comercial

O MLopes Finance só é considerado pronto quando todos os itens abaixo forem verdadeiros:

- Há instalador Windows real, testado em instalação limpa.
- O aplicativo instalado abre o MLopes Finance correto, nunca tela padrão de framework.
- Dados ficam em `%APPDATA%/MLopesFinance/dados` e sobrevivem a atualização e desinstalação.
- Contextos, contas, cartões, investimentos, classificações e nomes são editáveis e não há dados empresariais fixos como regra do produto.
- Lançamentos, baixas, transferências, parcelas, faturas, investimentos, importação e conciliação obedecem às regras de integridade.
- Fluxo comercial completo funciona, sem impedir lançamento financeiro direto.
- Painel e relatórios exibem resultados por dia, mês, ano e intervalo personalizado, com filtros preservados nos comparativos.
- Fiscal externo é opcional; emissão integrada não bloqueia o núcleo financeiro.
- Backup, restauração e migrações foram testados contra dados reais de versões anteriores.
- Testes, documentação, PDFs, mapa técnico, histórico, release notes e hash correspondem exatamente ao instalador entregue.
- A assinatura digital de código está planejada ou aplicada de acordo com o momento de comercialização.

---

## 12. Mandato para o responsável técnico

O responsável por continuar este projeto atua como **Principal Software Architect & Technical Lead**, acumulando responsabilidade por arquitetura, regras de negócio, banco, segurança, interface, testes, build, instalador, documentação, release e diagnóstico.

Ele deve ler este documento e `AGENTS.md` integralmente antes de editar. Todo diagnóstico precisa apontar evidência em arquivo e linha. Se faltar informação para uma decisão irreversível, deve pedir definição; fora disso, deve executar, validar e entregar sem transferir trabalho manual ao proprietário.
