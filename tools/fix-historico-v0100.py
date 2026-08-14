"""Reescreve HISTORICO-DE-VERSOES.md com o v0.10.0 correto no topo."""
HIST = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(HIST, 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('## 0.9.1')
rest = content[idx:]

novo_top = """## 0.10.0 — Motor Financeiro (Custos Fixos + Relatórios Avançados)

- **Motivação do user**: "preciso de um motor que controle, que me apresente os resumos, gasto total por mês, por ano, total de prestações a vencer, por mês, resumos, enfim, tudo que um programa desses deveria ter, não quero um programa que mostre, quero que seja funcional". Backend já tinha `core/recorrencias.js` mas era genérico (exigia 2 passos: criar template + criar recorrencia). Backend de relatórios tinha `balancete` e `comparativo` mas faltava o "motor" (gastos por mês, top categorias, top despesas, variação mensal, alertas).
- **Tela de Custos Fixos** (nova, na sidebar): interface simples pra cadastrar aluguel, internet, luz, etc. — com descrição, valor mensal, dia do mês, conta/cartão de pagamento, categoria. Sistema gera os lançamentos automaticamente todo mês. Botão "⚡ Gerar 2026-09" gera os lançamentos do mês atual que ainda não foram criados.
- **Backend `core/custosFixos.js`** (novo, 7 funções): interface simplificada em cima de `core/recorrencias.js`. `criarCustoFixo` cria o template (lançamento com natureza='despesa' e sufixo `[custo fixo]`) e a recorrencia mensal em 1 passo. `gerarOcorrenciasMesAtual` gera os lançamentos do mês que faltam (criando 1 lançamento por custo fixo ativo, na data certa). `resumoCustosFixosMes` retorna `{totalPrevisto, totalPago, percentualPago, custosFixos: [...]}` com flag `gerado` em cada um.
- **Bloco "📌 Custos fixos do mês" no Dashboard** (entre "Suas contas" e "Cartões de crédito"): 3 cards (Total previsto / Já gerado / A pagar) + top 5 custos com status do mês. Botão "Gerenciar custos fixos" navega pra tela.
- **Backend `core/relatorios.js` estendido** (8 funções novas, sem mexer nas existentes):
  - `gastosPorMes(db, contextoId, meses=12)` — série temporal com receitas/despesas/saldo por mês. Preenche meses sem lançamento com zeros. Retorna `[{mes, receitas, despesas, saldo, qtdLancamentos}]`.
  - `topCategorias(db, contextoId, inicio, fim, limite=10)` — top N categorias por despesa, com `percentual` do total.
  - `topDespesas(db, contextoId, inicio, fim, limite=10)` — top N despesas individuais, ordenadas por valor decrescente.
  - `gastosPorConta(db, contextoId, inicio, fim)` — gastos por conta, ordenado por despesa total (cartao vs bancaria).
  - `faturasAVencer(db, contextoId, dias=30)` — faturas com vencimento entre hoje e hoje+N, com `diasAteVencer` calculado.
  - `variacaoMensal(db, contextoId)` — receitas/despesas/saldo do mês atual vs anterior, com `delta.variacaoXxxPct` (% em ponto flutuante).
  - `alertas(db, contextoId)` — array de banners contextuais: faturas vencendo em <=3 dias (severidade 'crit' ou 'warn'), cartão com >80% do limite (ou >95% 'crit'), gasto 30% acima/abaixo do mês anterior ('warn' se >50%, 'info' se 30-50%). Cada alerta tem `{tipo, severidade, titulo, mensagem, acao?}`.
  - `exportarMovimentosCSV(db, contextoId, inicio, fim)` — CSV detalhado com TODOS os lançamentos do período (não só o balancete).
- **8 novas rotas no servidor** (`servidor.js`): `relatorios:gastosPorMes`, `:topCategorias`, `:topDespesas`, `:gastosPorConta`, `:faturasAVencer`, `:variacaoMensal`, `:alertas`, `:exportarMovimentosCSV`. + 7 rotas de `custosFixos:*` (criar, listar, totalMes, resumoMes, gerarMesAtual, alternar, excluir).
- **13 testes novos** (118/118 verde): 7 de custos fixos (criar template+recorrencia, total mensal só ativos, gerar mes atual idempotente, resumo com flag gerado, excluir sem cascade pausa, excluir com cascade apaga template+recorrencia, rejeita diaDoMes 0/32) + 6 de relatórios avançados (gastosPorMes preenche gaps, topCategorias ordena por total e calcula percentual, topDespesas retorna top N, variacaoMensal calcula delta %, alertas detecta fatura próxima, exportarMovimentosCSV gera CSV com header).
- **Bump v0.9.1 → v0.10.0** (6 lugares). Bundle 6.09 MB. Auto-update já programado.
- **Motivação do user** (gravado pra nunca repetir): "não quero um programa que mostre, quero que seja funcional". User quer SOFTWARE funcional (gera, calcula, alerta, lembra), não só visualização. Sempre que o user pedir "resumo" ou "motor", pensar em: agregação, comparação temporal, alertas proativos, geração automática de dados (recorrências, parcelamentos).

## """

with open(HIST, 'w', encoding='utf-8') as f:
    f.write(novo_top + rest)
print(f'OK: {len(novo_top) + len(rest)} bytes')
