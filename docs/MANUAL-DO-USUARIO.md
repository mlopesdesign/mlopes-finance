# Manual do Usuário — MLopes Finance v0.8.0

Bem-vindo ao **MLopes Finance**, o sistema de gestão financeira pessoal e empresarial para Windows 10/11, 100% local e auditável. Este manual cobre a versão **0.8.0**.

---

## 1. O que é o MLopes Finance

O MLopes Finance é um aplicativo de gestão financeira que roda **100% local** no seu computador. Seus dados ficam em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` e **nunca saem da sua máquina** — não tem servidor, não tem nuvem, não tem telemetria.

### O que ele faz (v0.8.0)

- Lançamentos de receitas, despesas e transferências entre contas.
- **Contextos financeiros** (Pessoal, ML Lopes Design, etc.) com seletor no header, saldos isolados e CRUD completo pela UI.
- Cadastros editáveis: contas, clientes, fornecedores, projetos, centros de custo, tags e categorias.
- Baixas parciais e totais com controle automático de saldo.
- Recorrências (mensal, semanal, anual, etc.).
- Cartões de crédito com faturas por ciclo.
- **Importação de extratos OFX/CSV** com detecção automática de duplicidades.
- **Relatórios e balancete** por período/agrupamento, com comparativo do período anterior e export CSV/PDF.
- **Auto-update via GitHub Releases** com aviso automático na tela e atualização em 1 clique.
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

A barra lateral esquerda tem **13 itens** + Configurações no rodapé:

| Item | O que faz |
|---|---|
| **Visão geral** | Dashboard com 8 cards (Receitas, Despesas, Saldo, Contas, Clientes, Projetos, Centros de custo, Tags) + lembrete de "Próximo passo". |
| **Lançamentos** | Lista paginada de lançamentos, com botão "Novo lançamento", "Transferir entre contas" e botão de saldo para abrir baixas. |
| **Importar extrato** | Importar OFX/CSV do banco com prévia e detecção de duplicidades. |
| **Transferências** | Lista de débitos+créditos vinculados entre contas. |
| **Baixas e saldos** | Lista de lançamentos não-estornados com saldo em aberto e botão "Lançar baixa". |
| **Relatórios** | Balancete por período/agrupamento com comparativo e export CSV/PDF. |
| **Contas** | Cadastro de contas (bancária, cartão, investimento). |
| **Clientes** | Cadastro de clientes. |
| **Fornecedores** | Cadastro de fornecedores. |
| **Projetos** | Cadastro de projetos (vinculáveis a clientes). |
| **Centros de custo** | Cadastro de centros de custo. |
| **Tags** | Cadastro de tags (vinculáveis a lançamentos). |
| **Categorias** | Cadastro de categorias (receita, despesa ou ambas). |
| **Contextos** | CRUD de contextos financeiros (Pessoal, PJ, etc.) + seletor de contexto ativo no header. |
| **Configurações** | Aparência (tema, cor da marca), Identidade (nome, locale), Financeiro (moeda), Avançado (reset + backup + atualizações). |

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

1. **Pill** "☾ Escuro" (ou "☀ Claro") no topo da janela, ao lado de "VERSÃO 0.8.0".
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

Este manual cobre a **v0.8.0**. Funcionalidades das próximas versões (conciliação automática, comercial, NFS-e) virão em releases futuros. Veja `HISTORICO-DE-VERSOES.md` no diretório do projeto.

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

## 12. Atualizações automáticas (v0.7.1, reescrito em v0.8.8)

O MLopes Finance verifica novas versões no GitHub Releases automaticamente. A v0.8.8 reescreveu todo o fluxo de auto-update no padrão ML Lopes Design (seção 5 do PADRAO) — sem token, sem `gh`, sem instalador publicado em lugar público.

### 12.1 Como funciona

- **Ao abrir o app**, ele faz uma chamada anônima a `https://api.github.com/repos/mlopesdesign/mlopes-finance/releases/latest` (timeout 30s, 60 req/h por IP). Sem token, sem `gh`, sem env var. Igual pro cliente final.
- **Compara** a versão atual (em `app.js`) com a `tag_name` do release (compara SemVer: X.Y.Z).
- **Se a versão do GitHub é maior**: aparece uma **pill no header** com "🆙 Nova versão vX.Y.Z disponível — veja em Configurações".
- **Clicar na pill** (ou ir em **Configurações → Avançado → Atualização do sistema** → **"Verificar agora"**) abre o painel completo.
- **Painel de atualização** (mesmo padrão visual do "Salgueiro Gestão"):
  - Versão instalada (ex: `v0.8.8`) e a versão mais recente do GitHub.
  - **Changelog renderizado** do body markdown do release do GitHub — você vê exatamente o que mudou antes de baixar.
  - Botão **"Baixar e instalar"**.
- **Ao clicar "Baixar e instalar"**:
  1. **Backup do banco** em memória (criado na rota `update:aplicar`).
  2. Download do **`resources.neu`** (bundle Neutralino, ~5.6 MB) via `curl.exe` (nunca `fetch()` — WebView2 bloqueia por CORS).
  3. Substitui o `resources.neu` instalado via `cmd.exe /c move /Y`.
  4. `Neutralino.app.restartProcess()` — o app reinicia sozinho com a nova versão. **Sem reinstalar, sem desinstalar.**
- **Sem internet / GitHub fora do ar**: mostra erro claro ("❌ Falha ao consultar GitHub: ..."). Sem mascarar como 404 ou "repositório não encontrado".

### 12.2 O que é o `resources.neu`

É o **bundle do app** (HTML + JS + CSS + assets + WebView2) compactado num único arquivo pelo Neutralino build. Ele substitui o instalador `.exe` como asset de update. Vantagens:

- **Rápido**: ~5.6 MB vs ~25 MB do instalador.
- **Sem reinstalar**: o app já está rodando, só substitui o bundle e reinicia.
- **Sem privilégios de admin**: não passa por Inno Setup, não escreve em `Program Files`, não mexe no registro.
- **Sem .exe em lugar público**: o instalador `.exe` (primeira instalação) fica só no site de download; o `resources.neu` (updates) fica no GitHub Releases.

### 12.3 Verificação manual

**Configurações → Avançado → "Verificar agora"** dispara a checagem na hora (sem esperar a próxima abertura do app). O resultado aparece no painel:
- ✅ Você já está na versão mais recente.
- 🆙 Nova versão disponível — com changelog e botão de download.
- ❌ Erro (sem internet, rate limit do GitHub, etc).

### 12.4 Para o owner publicar uma nova versão

1. Bump da versão nos 7 lugares padrão (`neutralino.config.json`, `package.json`, `installer/*.iss`, `src/js/app.js`, `src/js/backend/ambiente.js` + pares em `resources/`).
2. Build: `npx neu build` (gera `dist/mlopes-finance/resources.neu`).
3. Commit + push do source.
4. Tag `vX.Y.Z` + Release com o **`resources.neu`** anexado (NÃO o instalador `.exe`).
5. Usuários com versão anterior recebem a pill automaticamente na próxima abertura.

---

## 13. Contextos financeiros (v0.8.0)

Um **contexto financeiro** é uma "bolha" isolada de dados: cada contexto tem seus próprios lançamentos, contas, clientes, projetos, centros de custo, tags e categorias. Os saldos **nunca se misturam** entre contextos.

### 13.1 Pra que serve

Imagine que você é **Marcio Lopes (PF)** e tem a empresa **ML Lopes Design (PJ)**. Sem contextos, os saldos se misturariam: a receita do cliente X (PJ) apareceria junto com seu salário (PF), e a despesa do aluguel (PF) seria descontada do caixa da empresa.

Com contextos, cada um tem seu próprio espaço:

- **Contexto "Pessoal"**: salário, aluguel, cartão pessoal, contas de luz/internet residenciais.
- **Contexto "ML Lopes Design"**: recebimentos de clientes PJ, notas fiscais, folha, impostos, investimentos da empresa.

### 13.2 O seletor de contexto no header

No topo da janela, ao lado de "VERSÃO 0.8.0", você vê a **pill "Contexto: [▼]"** com o nome do contexto ativo. Trocar de contexto é instantâneo — sem reload, sem reabrir o app.

O contexto ativo define:

- Quais lançamentos aparecem em **Lançamentos**, **Baixas e saldos**, **Transferências**.
- Quais contas aparecem no select de **Novo lançamento**.
- Qual saldo o **Relatórios** mostra.
- Quais cadastros (clientes, projetos, etc.) estão visíveis.

### 13.3 Tela de Contextos

Acesse **Contextos** no menu lateral (entre "Categorias" e "Configurações"). A tela mostra uma tabela com:

| Coluna | O que mostra |
|---|---|
| **Contexto** | Nome + descrição. |
| **Receitas** | Total de receitas no contexto. |
| **Despesas** | Total de despesas no contexto. |
| **Saldo** | Receitas − despesas. |
| **Lançamentos** | Quantidade de lançamentos cadastrados. |
| **Status** | Ativo (verde) ou Inativo (cinza). |
| **Ações** | Usar (torna contexto ativo), Editar (nome/descrição), Desativar/Reativar. |

No topo da tela tem o checkbox **"Mostrar inativos"** — quando marcado, contextos desativados aparecem na lista com status cinza.

### 13.4 Criar um contexto novo

1. **Contextos** → **Novo contexto**.
2. Preencha **Nome** (obrigatório) e **Descrição** (opcional).
3. **Salvar**. O contexto é criado e automaticamente:
   - Vira o **contexto ativo**.
   - Ganha uma categoria seed **"Transferência interna"** (natureza: ambas) — usada para transferências entre contas do mesmo contexto.
   - Aparece no seletor do header.

### 13.5 Desativar vs apagar

Contextos **nunca são apagados** se tiverem lançamentos vinculados (regra de auditoria). Em vez disso, você **desativa** — o contexto some do seletor e do select de cadastros, mas o histórico fica preservado para relatórios e consultas.

Para desativar: **Contextos** → linha do contexto → **Desativar**. Para reativar: marque **"Mostrar inativos"** e clique em **Reativar**.

### 13.6 Transferência entre contextos

**Não existe.** Transferências são apenas entre contas do **mesmo contexto**. Pra mover dinheiro de um contexto pra outro (ex: pró-labore da empresa pra conta pessoal), use um par de lançamentos manuais:

1. Contexto "ML Lopes Design" → **Lançamentos** → **Novo lançamento** → Despesa de R$ X na conta da empresa.
2. Contexto "Pessoal" → **Lançamentos** → **Novo lançamento** → Receita de R$ X na conta pessoal.

(Regra 3 do plano: toda linha financeira pertence a um contexto, e transferência entre contextos é uma decisão de negócio, não do app.)

### 13.7 Contexto padrão

Ao instalar pela primeira vez, o app cria um contexto chamado **"Meu contexto"**. Esse é o contexto ativo inicial e não pode ser apagado (mas pode ser renomeado). Use-o como "Pessoal" ou renomeie para o nome que preferir.

---

*MLopes Finance v0.8.8 — Agosto 2026 — ML Lopes Design*
