# MLopes Finance — Regras do projeto

## Identidade de pré-lançamento

- Produto: MLopes Finance
- Plataforma: Windows 10/11, local-first
- Linguagem do cliente: JavaScript ES modules puro
- Empacotamento: Neutralino 6 + WebView2
- Banco local: SQLite em `%APPDATA%/MLopesFinance/dados/mlopes-finance.sqlite`

Antes da primeira instalação comercial, nome, `applicationId`, binário e caminho de dados podem ser revisados juntos. Depois da primeira distribuição, são imutáveis.

## Regras obrigatórias

1. A regra de negócio fica em `src/js/backend/core/`, sem DOM, `window` ou Neutralino.
2. Toda ação da interface passa por uma API; autorização pertence ao backend.
3. Toda linha financeira pertence a um contexto financeiro. Contextos, clientes, contas, categorias e centros de custo são cadastros editáveis.
4. Valores monetários são inteiros em centavos. Datas operacionais usam `YYYY-MM-DD`.
5. Não apagar nem alterar lançamento conciliado; correções são por estorno/ajuste auditável.
6. Arquivo de banco: `tmp → atual.old → tmp para atual → remove old`; jamais remover o atual antes.
7. Migrações são idempotentes e testadas contra banco anterior.
8. Cada build sobe a versão e atualiza testes, documentação, mapa técnico e histórico.

## Limites e módulos

O núcleo atende contas, cartões, investimentos, contas a pagar/receber, comercial, importação OFX/CSV e conciliação. Fiscal é opcional e desacoplado: NFS-e requer configuração por município, regime e certificado; não bloqueia o financeiro.
