# Manual do usuário - MLopes Finance v0.12.2

## 1. Propósito

O MLopes Finance é um aplicativo local-first para cuidar das finanças pessoais e empresariais. Ele importa extratos, classifica movimentos, acompanha cartões e parcelamentos e produz balancetes por mês ou ano.

O banco fica em `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite`. O app não depende de uma nuvem para manter seus dados.

## 2. Modelo financeiro

### Contextos

Contextos separam universos financeiros. Crie pelo menos `Pessoal` e `Empresa` em `Contextos`. O contexto ativo aparece no topo e controla lançamentos, contas, cadastros e relatórios exibidos.

Transferências entre contextos não são automáticas: registre a saída no contexto de origem e a entrada no contexto de destino. Dentro do mesmo contexto, use `Transferir entre contas` para criar os dois lados vinculados.

### Contas e cartões

Em `Contas`, cadastre contas bancárias, cartões de crédito e investimentos. Uma compra no cartão é uma despesa já registrada na origem. A fatura representa o compromisso de pagamento futuro; ela não deve criar outra despesa igual.

### Lançamentos e status

Um lançamento tem contexto, conta, natureza, valor em centavos, data e descrição. `Receita` representa entrada, `Despesa` representa saída e transferências são pares vinculados.

- `Aberto`: compromisso ainda não baixado.
- `Conciliado`: movimento já pago ou confirmado no extrato.
- `Estornado`: anulação auditável, quando aplicável.

Lançamentos conciliados não devem ser apagados ou alterados diretamente. Use estorno ou ajuste auditável.

## 3. Primeiro uso

1. Abra o app instalado pelo atalho do Windows.
2. Crie ou renomeie os contextos.
3. Cadastre contas, cartões e categorias essenciais.
4. Exporte um backup antes da primeira importação grande.
5. Importe um extrato por vez e confira o resultado no período correspondente.

## 4. Importação automática

### Arquivos aceitos

O app aceita OFX, QFX e CSV. No CSV, são reconhecidas colunas de data, valor e descrição, com separadores vírgula, ponto e vírgula ou TAB. Datas podem estar em `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` ou `YYYYMMDD`. Valores brasileiros como `1.234,56` são aceitos.

### Fluxo

1. Entre em `Importar extrato`.
2. Escolha o arquivo.
3. Use `Pré-visualizar` para verificar a leitura.
4. Execute `Importar automaticamente`.

O processamento determina a natureza pelo sinal, resolve a conta pelo identificador/nome quando possível, cria ou associa categorias e reconhece descrições de parcela no padrão `N/M`.

### Histórico antigo

Importações históricas são gravadas como `conciliado`. Assim, um extrato antigo constrói o histórico sem criar centenas de baixas manuais. Para cartões, faturas vencidas e parcelas passadas são marcadas como pagas; faturas e parcelas atuais ou futuras permanecem abertas para planejamento.

### Proteção contra duplicidade

O arquivo é protegido por hash. Além disso, cada movimento é comparado por data, valor absoluto e descrição normalizada. Reimportar o mesmo extrato não deve duplicar lançamentos.

Se houver várias contas compatíveis e o arquivo não trouxer identificação suficiente, o app interrompe apenas a resolução da conta para impedir erro de alocação. Corrija o cadastro ou o nome do arquivo e importe novamente.

## 5. Conferência pós-importação

Faça esta sequência:

1. `Visão geral`: confirme a quantidade total de lançamentos.
2. `Lançamentos`: filtre data, conta e natureza; compare amostras com o extrato.
3. `Parcelamentos`: confira progresso, parcelas pagas e próximas datas.
4. `Baixas e saldos`: confira apenas compromissos bancários realmente em aberto.
5. `Relatórios`: gere o mês importado e depois o ano.

Uma compra antiga no cartão não deve aparecer em `Baixas e saldos`. Uma fatura atual ou futura pode continuar aberta, porque ainda precisa ser paga.

## 6. Operações manuais que permanecem disponíveis

### Novo lançamento

Em `Lançamentos > Novo lançamento`, informe descrição, natureza, valor, data e conta. Categoria, cliente, projeto, centro de custo e tag podem complementar a classificação.

### Baixa parcial ou total

Use `Baixas e saldos` somente para compromissos efetivamente abertos. Informe o valor, a data e a forma de pagamento. Ao zerar o saldo, o lançamento fica conciliado.

### Transferência

Em `Lançamentos > Transferir entre contas`, escolha origem, destino, valor e data. O app gera os dois lançamentos vinculados no mesmo contexto.

## 7. Relatórios e balancete

Em `Relatórios`, escolha `Este mês`, `Este ano`, período anterior, últimos 12 meses ou período personalizado. Agrupe por categoria, conta, cliente, projeto, centro de custo ou tag.

O relatório apresenta receitas, despesas, saldo e, quando solicitado, comparação com o período anterior. Exporte CSV ou use a impressão do Windows para salvar uma cópia em PDF.

Para separar pessoal e empresa, altere o contexto no topo e gere cada relatório separadamente. O mesmo banco pode conter os dois contextos sem misturar os totais.

## 8. Cadastros e manutenção

Contas, clientes, fornecedores, projetos, centros de custo, tags e categorias são editáveis pela sidebar. Prefira desativar um cadastro sem histórico a apagá-lo. Toda linha financeira deve continuar ligada a um contexto.

## 9. Backup, restauração e segurança

Em `Configurações > Avançado`:

- `Exportar backup...` cria uma cópia SQLite escolhida por você.
- `Restaurar de arquivo...` valida o banco e substitui o estado atual.
- `Verificar agora` procura atualização do sistema.

Feche o app antes de copiar ou restaurar o banco por fora. Mantenha mais de uma cópia de backup em local seguro. O armazenamento usa gravação temporária e preserva uma versão anterior para reduzir risco de corrupção.

## 10. Solução de problemas

### Importação sem registros

Confira o cabeçalho do CSV e se o arquivo contém data, valor e descrição. Para OFX, tente exportar novamente pelo banco em OFX/QFX e mantenha o arquivo original.

### Conta não identificada

Cadastre a conta no contexto correto ou use um nome de arquivo que contenha o nome/identificador da conta. Com múltiplas contas, o app evita adivinhar.

### Parcelamento antigo aparece ativo

Atualize para a versão instalada mais recente, reabra o app e confira as datas das parcelas. A regularização histórica mantém como abertas apenas parcelas atuais ou futuras.

### Aplicativo não abre o banco

Não apague o banco antes de exportar ou copiar um backup. Feche o app, preserve o arquivo atual e procure a cópia `.old` somente com uma cópia de segurança disponível.

## 11. Caminhos importantes

| Recurso | Caminho |
|---|---|
| Banco | `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite` |
| Backup automático anterior | `%APPDATA%\MLopesFinance\dados\mlopes-finance.sqlite.old` |
| Instalador local | `%LOCALAPPDATA%\Programs\MLopes Finance` |

## 12. Atualizações do sistema

Ao abrir, o app pode consultar o release mais recente no GitHub. Em `Configurações > Avançado`, leia o changelog antes de baixar. O auto-update troca o `resources.neu`, faz backup do banco e reinicia o app. Para uma instalação do zero, use o instalador `MLopes Finance Setup.exe`.

## 13. Limites conhecidos da versão 0.12.2

- Conciliação bancária automática além da importação ainda não substitui revisão do usuário.
- NFS-e, sincronização em nuvem e DRE gerencial não fazem parte deste escopo.
- A resolução automática para quando não há informação suficiente para escolher a conta com segurança.

## 14. Manutenção da documentação

Os arquivos editáveis deste manual são `docs/GUIA-RAPIDO.md` e `docs/MANUAL-DO-USUARIO.md`. Após qualquer movimento do projeto que altere comportamento, dados, interface, testes ou empacotamento:

1. atualize os dois textos se a mudança for visível ao usuário;
2. execute `npm run docs:build`;
3. confira os PDFs gerados;
4. registre a ação em `docs/REGISTRO-DE-AÇÕES.md`;
5. atualize o histórico e o mapa técnico quando aplicável.

Processo detalhado: `docs/POLITICA-DE-DOCUMENTACAO.md`.

Última revisão: 2026-08-15 - versão 0.12.2.
