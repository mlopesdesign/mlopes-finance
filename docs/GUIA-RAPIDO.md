# Guia Rápido — MLopes Finance v0.5.0

Para o dia a dia. 1 página.

## Atalhos da sidebar

| Onde | O que faz |
|---|---|
| **Visão geral** | 8 cards de resumo (receitas, despesas, saldo, contas, clientes, projetos, centros de custo, tags). |
| **Lançamentos** | Todos os lançamentos. Botão "Novo" (despesa/receita) e "Transferir" (entre contas). |
| **Transferências** | Lista de débitos+créditos vinculados. |
| **Baixas e saldos** | Lista de lançamentos com saldo em aberto. Clique em "Lançar baixa" para pagar. |
| **Contas / Clientes / Fornecedores / Projetos / Centros de custo / Tags / Categorias** | Cadastros. Botão "Novo" + lista + edição. |
| **Configurações** | Tema, cor da marca, nome, moeda, reset. |

## Tarefas mais comuns

### Lançar uma despesa
`Lançamentos` → `Novo lançamento` → Preencher (descrição, valor, data, conta) → `Salvar`.

### Pagar um lançamento
`Lançamentos` → clicar no valor da coluna "Saldo" do lançamento → preencher valor pago (parcial ou total) → `Registrar baixa`.

### Transferir entre contas
`Lançamentos` → `Transferir entre contas` → escolher origem, destino, valor → `Transferir`.

### Cadastrar um cliente
`Clientes` → `Novo` → nome (obrigatório), documento, e-mail → `Salvar`.

### Mudar tema
Topo da janela → clicar na pill `☾ Escuro` ou `☀ Claro`.

### Mudar cor da marca
`Configurações` → aba "Aparência" → color picker "Cor da marca" → `Salvar alterações`.

### Restaurar padrão de fábrica
`Configurações` → aba "Avançado" → `Restaurar padrão de fábrica`. **Apaga todas as configurações e volta aos defaults.**

## Regras de ouro

- **Valor sempre em R$** com vírgula ou ponto. O app converte pra centavos.
- **Data sempre `AAAA-MM-DD`**. Use o calendário, não digite.
- **Não apague o `.sqlite`** em `%APPDATA%\MLopesFinance\dados\`. É o banco inteiro.
- **Concilie mensalmente**: clique no "Saldo" dos lançamentos pagos pra registrar baixas.
- **Para backup**: copie o `mlopes-finance.sqlite` para lugar seguro. (Botão de backup na UI virá na próxima sprint.)
- **Em caso de erro "Falha ao abrir o banco"**: delete `%LOCALAPPDATA%\MLopes Design\` (cache do WebView2) e reabra.

## Atalhos de teclado (em breve)

Por enquanto, use mouse. Atalhos de teclado estão planejados para v0.6.0.

## Onde os dados ficam

```
%APPDATA%\MLopesFinance\dados\
  ├── mlopes-finance.sqlite   ← seu banco (NÃO apague)
  ├── mlopes-finance.sqlite.old  ← versão anterior (auto-backup)
  └── mlopes-finance.sqlite.tmp  ← temp durante gravação
```


- **Importar extrato**: OFX/CSV com detecção de duplicidade (item 5 do manual).
- **Backup e restauração** em Configurações → Avançado (item 6 do manual).
