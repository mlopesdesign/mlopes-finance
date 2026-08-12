# Manual do Usuário — MLopes Finance v0.7.1

Bem-vindo ao **MLopes Finance**, o sistema de gestão financeira pessoal e empresarial para Windows 10/11, 100% local e auditável. Este manual cobre a versão **0.7.1**.

---

## 1. O que é o MLopes Finance

O MLopes Finance é um aplicativo de gestão financeira que roda **100% local** no seu computador. Seus dados ficam em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` e **nunca saem da sua máquina** — não tem servidor, não tem nuvem, não tem telemetria.

### O que ele faz (v0.6.0)

- Lançamentos de receitas, despesas e transferências entre contas.
- Cadastros editáveis: contas, clientes, fornecedores, projetos, centros de custo, tags e categorias.
- Baixas parciais e totais com controle automático de saldo.
- Recorrências (mensal, semanal, anual, etc.).
- Cartões de crédito com faturas por ciclo.
- **Importação de extratos OFX/CSV** com detecção automática de duplicidades.
- **Backup e restauração** do banco via interface gráfica.
- Tema claro/escuro e cor da marca customizáveis.
- Configurações persistentes por instalação.

### O que ele **não** faz nesta versão

- Conciliação bancária automática (só manual).
- Fluxo comercial completo (orçamento → aprovação → contrato → recebimentos).
- Relatórios gerenciais com comparativos temporais (DRE, fluxo de caixa).
- Integração fiscal NFS-e.
- Sincronização na nuvem.

---

## 2. Instalação e primeira execução

1. Execute o instalador `MLopes Finance Setup.exe` baixado do seu fornecedor.
2. Siga o assistente. O padrão instala em `%LOCALAPPDATA%\Programs\MLopes Finance`.
3. Ao final, o atalho "MLopes Finance" aparece no menu Iniciar e (opcional) na área de trabalho.
4. Clique no atalho. A janela 1280×820 abre mostrando a **Visão geral** do contexto financeiro padrão ("Meu contexto").

**Importante:** o banco de dados é criado automaticamente em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` na primeira execução. Apagar este arquivo apaga todos os seus dados — só faça backup antes.

---

## 3. Conceitos fundamentais

### 3.1 Contexto financeiro

Um **contexto** é uma divisão lógica do seu dinheiro: "Pessoal", "ML Lopes Design", "Filial SP", "Projeto Apartamento", etc. Cada lançamento, conta, cliente ou projeto pertence a **um** contexto. Isso impede misturar saldos de empresas ou pessoas diferentes.

A v0.6.0 vem com um contexto padrão "Meu contexto". Para criar mais, use a tela de configurações ou o backend direto.

### 3.2 Valor monetário

Todo valor é armazenado em **centavos inteiros** (Regra 4 do plano). Internamente o app usa `valor_centavos` como INTEGER. Na interface, você digita em reais com vírgula ou ponto, e o app converte.

### 3.3 Data

Toda data operacional usa o formato `YYYY-MM-DD` (ISO 8601). Exemplo: `2026-08-12`. Não digite `12/08/2026` — o app rejeita.

### 3.4 Lançamentos

Um **lançamento** é uma movimentação financeira: receita (entrou dinheiro), despesa (saiu dinheiro) ou transferência (movido entre contas do mesmo contexto).

Cada lançamento tem, no mínimo:

- **Contexto** financeiro.
- **Conta** (qual conta bancária / cartão / investimento foi afetado).
- **Natureza** (receita ou despesa; transferência é gerada pelo fluxo "Transferir entre contas").
- **Valor** positivo em centavos.
- **Data de competência** (quando aconteceu, `YYYY-MM-DD`).
- **Descrição** obrigatória.

Opcionalmente: categoria, cliente, projeto, centro de custo, data de vencimento, observações, anexo.

### 3.5 Status do lançamento

- **Aberto**: lançado mas ainda não pago.
- **Conciliado**: pago (manualmente ou via baixa total) ou marcado como tal.
- **Estornado**: anulado por estorno (futuro).

### 3.6 Saldo em aberto

Para cada lançamento, o app calcula `valor_original - soma(baixas)`. A coluna "Saldo" na tela de Lançamentos mostra esse valor. Quando o saldo zera, o status vira `conciliado` automaticamente.

---

## 4. Navegação

A barra lateral esquerda tem **12 itens** + Configurações no rodapé:

| Item | O que faz |
|---|---|
| **Visão geral** | Dashboard com 8 cards (Receitas, Despesas, Saldo, Contas, Clientes, Projetos, Centros de custo, Tags) + lembrete de "Próximo passo". |
| **Lançamentos** | Lista paginada de lançamentos, com botão "Novo lançamento", "Transferir entre contas" e botão de saldo para abrir baixas. |
| **Importar extrato** | Importar OFX/CSV do banco com prévia e detecção de duplicidades. |
| **Transferências** | Lista de débitos+créditos vinculados entre contas. |
| **Baixas e saldos** | Lista de lançamentos não-estornados com saldo em aberto e botão "Lançar baixa". |
| **Contas** | Cadastro de contas (bancária, cartão, investimento). |
| **Clientes** | Cadastro de clientes. |
| **Fornecedores** | Cadastro de fornecedores. |
| **Projetos** | Cadastro de projetos (vinculáveis a clientes). |
| **Centros de custo** | Cadastro de centros de custo. |
| **Tags** | Cadastro de tags (vinculáveis a lançamentos). |
| **Categorias** | Cadastro de categorias (receita, despesa ou ambas). |
| **Configurações** | Aparência (tema, cor da marca), Identidade (nome, locale), Financeiro (moeda), Avançado (reset + backup). |

---

## 5. Fluxos comuns

### 5.1 Cadastrar uma conta

1. Sidebar → **Contas** → **Nova conta**.
2. Preencha: Nome (obrigatório), Tipo (`Conta bancária` / `Cartão de crédito` / `Investimento`), Saldo inicial (R$).
3. **Salvar**. A conta aparece na lista.

### 5.2 Cadastrar um cliente

1. Sidebar → **Clientes** → **Novo**.
2. Preencha: Nome (obrigatório), Documento (CPF/CNPJ), E-mail, Telefone, Observações.
3. **Salvar**.

### 5.3 Lançar uma despesa simples

1. Sidebar → **Lançamentos** → **Novo lançamento**.
2. Descrição (obrigatório), Natureza = "Despesa", Valor (R$, use ponto ou vírgula), Data (calendário).
3. Conta: selecione a conta bancária que será debitada.
4. Categoria / Cliente / Projeto / Centro de custo / Tag: opcionais.
5. **Salvar**. A despesa aparece na lista com status "aberto" e saldo = valor total.

### 5.4 Transferir entre contas

1. Sidebar → **Lançamentos** → **Transferir entre contas**.
2. Conta origem, Conta destino (devem ser diferentes), Valor, Data, Descrição.
3. **Transferir**. O app gera **dois lançamentos** vinculados (um débito na origem, um crédito no destino) e registra na tabela `transferencias` com referência cruzada.

### 5.5 Lançar uma baixa (pagamento parcial ou total)

1. Na lista de Lançamentos, clique no valor da coluna "Saldo" do lançamento que quer pagar.
2. OU vá em **Baixas e saldos** e clique em "Lançar baixa" na linha.
3. Valor (R$, default = saldo restante), Data, Forma (pix, boleto, dinheiro...), Observações.
4. **Registrar baixa**. O saldo é atualizado. Se quitar o saldo, o status vira `conciliado`.

### 5.6 Importar extrato bancário (OFX/CSV)

1. Sidebar → **Importar extrato**.
2. Clique em **Selecionar arquivo** e escolha um `.ofx`, `.qfx` ou `.csv` do seu banco.
3. Clique em **Pré-visualizar**. O app parseia, detecta duplicidades (mesma data + valor + descrição já existe?) e mostra uma tabela com cada transação e seu status:
   - **Pendente**: vai virar lançamento quando você confirmar.
   - **Duplicado**: já existe no banco, será ignorado.
4. Escolha a **conta de destino** e a **natureza padrão** (quando ambíguo).
5. Clique em **Confirmar importação** para criar os lançamentos. Ou **Cancelar importação** para descartar.

**Formato CSV esperado** (auto-detecta separador e data):

- Colunas: `data`, `valor`, `descricao` (case-insensitive, busca por nome).
- Separadores: `,`, `;` ou TAB.
- Datas: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` ou `YYYYMMDD`.
- Valores: `150.50` ou `150,50` (negativos viram despesa, positivos viram receita).

**Formato OFX esperado**: SGML (maioria dos bancos brasileiros) ou XML. Suporta tags `<TAG>valor` ou `TAG:valor`.

### 5.7 Alternar tema (claro/escuro)

1. **Pill** "☾ Escuro" (ou "☀ Claro") no topo da janela, ao lado de "VERSÃO 0.6.0".
2. Clique. A página recarrega no outro tema. A escolha é salva no banco.

### 5.8 Mudar a cor da marca

1. Sidebar → **Configurações** → aba "Aparência".
2. Clique no color picker "Cor da marca". A cor é aplicada em tempo real.
3. **Salvar alterações** (botão no rodapé). Persistido.

### 5.9 Configurar nome de exibição

1. Sidebar → **Configurações** → aba "Identidade".
2. Mude "Nome de exibição" (ex: "MLopes Finance - Pessoal"). Aparece no header.
3. **Salvar alterações**.

---

## 6. Backup e restauração

Acesse **Configurações → Avançado**.

- **Exportar backup…**: gera um arquivo `.sqlite` do estado atual. Escolha onde salvar.
- **Restaurar de arquivo…**: escolhe um backup anterior e substitui o banco atual (com validação — verifica tabelas essenciais e exige ≥ 1 contexto cadastrado).
- **Verificar agora**: mostra a contagem de registros por tabela (radiografia).

O backup é a forma mais segura de migrar entre máquinas, ou de ter um ponto de restauração antes de mudanças grandes.

---

## 7. Boas práticas

- **Faça backup do banco** regularmente: use o botão "Exportar backup…" em Configurações → Avançado. Guarde os `.sqlite` em local seguro (HD externo, OneDrive pessoal, etc).
- **Nunca edite o `.sqlite` com ferramentas externas enquanto o app está aberto**. Pode corromper.
- **Concilie mensalmente**: use a tela de Lançamentos, filtre por mês, e marque os pagos.
- **Use contextos separados para PJ e PF** para não misturar saldos.
- **Não apague cadastros com histórico** — o app tem campo `ativo` para inativar sem perder.
- **Importe extratos com cuidado**: sempre faça a prévia e confira o que está como "Duplicado" antes de confirmar.

---

## 8. Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| App abre mas fica na tela "Inicializando banco local..." | Cache do WebView2 corrompido | Feche o app, apague `%LOCALAPPDATA%\MLopes Design\` (cache do WebView2) e reabra pelo atalho. |
| "Falha ao abrir o banco" | Banco corrompido | Copie o `.sqlite.old` (se existir) para `.sqlite` e reabra. Senão, delete o `.sqlite` (perde os dados) e reabra. |
| Caracteres com acento errados | Encoding da página | Verifique se o `<meta charset="utf-8">` está presente no `index.html`. Se estiver, force recarregue com Ctrl+F5. |
| Instalador não roda | SmartScreen bloqueando | Clique em "Mais informações" → "Executar mesmo assim". Assinatura digital virá em release futura. |
| Botão de baixa não aparece | Lançamento já está estornado | Use a tela "Baixas e saldos" para ver todos os com saldo. |
| Importação OFX vazia | Arquivo com encoding diferente | Salve o OFX como UTF-8 antes de importar. |
| Importação CSV rejeitada | Cabeçalho não detectado | Garanta que a primeira linha tem colunas `data`, `valor`, `descricao` (ou nomes equivalentes em qualquer caso). |

---

## 9. Onde os dados ficam

| Item | Caminho |
|---|---|
| Banco SQLite | `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` |
| Backup .old (última versão antes da atual) | mesmo dir, `mlopes-finance.sqlite.old` |
| Temp de gravação (durante save) | mesmo dir, `mlopes-finance.sqlite.tmp` |
| Cache do WebView2 | `%LOCALAPPDATA%\MLopes Design\` |
| Logs (apenas dev) | mesmo dir, `app.log` |
| Backups exportados | onde o user escolheu no "Exportar backup…" |

**Não apague o `.sqlite` sem backup.**

---

## 10. Versão

Este manual cobre a **v0.6.0**. Funcionalidades das próximas versões (conciliação automática, comercial, relatórios avançados, NFS-e) virão em releases futuros. Veja `HISTORICO-DE-VERSOES.md` no diretório do projeto.

## 11. Relatórios e balancete (v0.7.0)

Acesse **Relatórios** no menu lateral (entre "Baixas e saldos" e "Contas").

### 11.1 Filtros

No topo da tela, escolha:

- **Período** (6 opções): Este mês, Mês passado, Este ano, Ano passado, Últimos 12 meses, Personalizado (com campos "De" e "até" para data inicial e final).
- **Agrupar por** (6 opções): Categoria, Conta, Cliente, Projeto, Centro de custo, Tag.
- **Comparar com período anterior**: marque para ver o balancete do período equivalente anterior (ex: este mês vs mês passado) e o delta (variação) entre eles.

Clique em **Gerar relatório** para ver os resultados.

### 11.2 O que aparece

- **3 KPIs** no topo: Receitas (verde), Despesas (vermelho), Saldo (verde se positivo, vermelho se negativo).
- **Tabela do balancete atual** com uma linha por grupo + linha de total.
- **Tabela do balancete anterior** (se "Comparar" estiver marcado).
- **3 cards de delta** mostrando a variação (Receitas, Despesas, Saldo) com cores verde/vermelho.

### 11.3 Exportar

- **Exportar CSV**: gera um arquivo `.csv` com UTF-8 + BOM (abre certo no Excel). Inclui header + linhas + total + meta info (período, contexto, agrupamento).
- **Imprimir / PDF**: abre o dialog de impressão do Windows. Escolha "Salvar como PDF" como destino para gerar um PDF com a mesma cara da tela (sidebar e filtros escondidos no print).

### 11.4 Regime de competência

Os relatórios usam **data de competência** (data em que o lançamento foi registrado), não data de pagamento. Para regime de caixa, virá na v0.8 com a coluna `data_pagamento` da tabela `baixas`.

### 11.5 Balancete pessoal e empresarial

O sistema de **contextos** (item 3.1) isola os saldos. Para ver o balancete pessoal vs empresarial:

1. Crie dois contextos (em v0.7.0 só via backend; em v0.8.0 via UI): "Pessoal" e "ML Lopes Design".
2. Em "Relatórios", o contexto é o ativo. Troque no seletor (em v0.8.0) ou reabra o app com o contexto desejado.

Mesmo relatório, dois cliques, saldos isolados.

## 12. Atualizações automáticas (v0.7.1)

O MLopes Finance verifica novas versões no GitHub Releases automaticamente:

- **Ao abrir o app**, faz uma chamada a `https://api.github.com/repos/mlopesdesign/mlopes-finance/releases/latest` (timeout 10s, anônimo, 60 req/h por IP).
- **Cache local em `localStorage`** com TTL de 4h — não fica martelando a API.
- **Se tem versão nova**: aparece um **banner amarelo no topo da tela** com "🟡 Atualização disponível" + botão "Atualizar agora" / "Ver detalhes" / "Mais tarde" (este último esconde por 24h).
- **Pill no header** ao lado de "VERSÃO X.Y.Z" mostra "🟡 v0.8.0 disponível" clicável.
- **Clicar** abre um modal com changelog, tamanho do download, SHA256, link pro GitHub, e botão "Atualizar agora".
- **"Atualizar agora"** baixa o instalador via `Neutralino.net` pro temp, fecha o app, e abre o instalador. O Inno Setup detecta a versão anterior (mesmo AppId) e atualiza — **sem desinstalar antes**.
- **Verificação manual** em **Configurações → Avançado → Atualizações → "Verificar atualizações"**.

**Para o auto-update funcionar**, o owner precisa:
1. Criar o repo `github.com/mlopesdesign/mlopes-finance`
2. Push do source + tag `v0.7.1`
3. Criar uma Release com o `MLopes Finance Setup.exe` como asset
4. O user, ao abrir o app na v0.7.0 ou anterior, recebe a notificação automaticamente.
