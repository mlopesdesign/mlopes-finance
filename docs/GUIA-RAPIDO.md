# Guia rápido - MLopes Finance v0.12.2

Este guia é para importar seu histórico e acompanhar o resultado sem lançar tudo manualmente.

## 1. Antes de começar

1. Abra o aplicativo e escolha o contexto no topo: por exemplo, `Pessoal` ou `ML Lopes Design`.
2. Em `Contas`, confirme as contas bancárias, cartões e investimentos.
3. Faça um backup em `Configurações > Avançado > Exportar backup...`.

Cada contexto tem seu próprio saldo, lançamentos e relatórios. Não misture PF e PJ no mesmo contexto.

## 2. Importar extrato automaticamente

1. Abra `Importar extrato`.
2. Selecione o arquivo OFX, QFX ou CSV.
3. Clique em `Pré-visualizar` e depois em `Importar automaticamente`.

O sistema identifica automaticamente:

- entrada ou despesa pelo sinal do valor;
- conta pelo nome/identificador do arquivo ou quando existe uma única conta compatível;
- categoria pela descrição, criando a categoria quando necessário;
- cartão, fatura e parcelas quando o extrato contém essa informação;
- duplicidades por data, valor absoluto e descrição normalizada.

Extrato antigo não deve gerar uma lista de contas a pagar. Movimentos importados entram como `conciliado`, pois já foram registrados no banco/cartão. No cartão, faturas e parcelas vencidas são regularizadas como pagas; somente valores atuais ou futuros continuam pendentes.

## 3. Como conferir se deu certo

- `Visão geral`: confira o total de lançamentos e os saldos do contexto.
- `Lançamentos`: filtre pelo período importado e confirme descrições, datas e valores.
- `Parcelamentos`: histórico antigo deve aparecer como quitado; compras atuais/futuras ficam ativas.
- `Baixas e saldos`: deve mostrar somente compromissos bancários realmente abertos. Compra de cartão não aparece aqui como nova dívida.
- `Relatórios`: selecione o mês ou ano para ver receitas, despesas e saldo separados por contexto.

## 4. Regras importantes

- Não importe o mesmo arquivo repetidamente. O hash do arquivo e a chave data + valor + descrição evitam duplicação.
- Se o arquivo tiver várias contas e não houver identificação suficiente, o sistema para para evitar lançar na conta errada.
- O cartão representa uma compra já registrada; a obrigação futura é a fatura, não uma segunda despesa em aberto.
- Não apague o banco SQLite. Use backup e correção auditável.

## 5. Backup e atualização

- Banco: `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite`.
- Antes de atualizar ou fazer uma grande importação, exporte um backup.
- Em `Configurações > Avançado`, use `Verificar agora` para buscar uma nova versão.
- O atualizador faz backup antes de aplicar `resources.neu` e reinicia o app.

## 6. Resultado esperado no fim do mês

Use o contexto correto, abra `Relatórios`, escolha `Este mês` e confira:

1. receitas;
2. despesas;
3. saldo do mês;
4. agrupamento por categoria, conta, projeto ou centro de custo.

Para o resultado anual, escolha `Este ano`. Troque o contexto para gerar o balancete pessoal e o empresarial separadamente.

Fonte editável: `docs/GUIA-RAPIDO.md`. Regeneração dos PDFs: `npm run docs:build`.
