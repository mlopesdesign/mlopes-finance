"""Reescreve o HISTORICO-DE-VERSOES.md com o v0.9.0 correto no topo."""
import os

HIST = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'

with open(HIST, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove o cabecalho v0.9.0 errado (linhas 2 ate "## 0.8.19" exclusive)
import re
# Pega tudo a partir de "## 0.8.19"
idx = content.find('## 0.8.19')
rest = content[idx:]

novo_top = """## 0.9.0 — Tela de Cartões e Faturas

- **Motivação do user**: "senti falta do cartão de credito, ele é muito importante pra eu controlar meus gastos e fazer previsões de parcelamento". O backend (tabelas `cartoes` + `faturas` + 7 funções em `core/cartoes.js`) já existia desde a v0.6.0 mas nunca teve UI. O user só conseguia cadastrar cartão via SQL, então a feature era invisível. Agora v0.9.0 entrega as 2 telas + toda a infra de vinculação automática.
- **Migração v5 → v6** (`migracoes.js`): adiciona 3 colunas novas (todas nullable, idempotente):
  - `cartoes.conta_associada_id INTEGER REFERENCES contas(id) ON DELETE SET NULL` — a conta do tipo 'cartao' que o cartao "representa" (criada automaticamente pelo `criarCartao`).
  - `lancamentos.cartao_id INTEGER REFERENCES cartoes(id) ON DELETE SET NULL` — atalho pro cartao (queries tipo "compras deste cartao").
  - `lancamentos.fatura_id INTEGER REFERENCES faturas(id) ON DELETE SET NULL` — vincula o lancamento a uma fatura especifica.
  - Indices: `idx_lancamentos_cartao`, `idx_lancamentos_fatura`.
- **`criarCartao` agora cria a conta automaticamente** (`core/cartoes.js`): quando o user cadastra um cartao, o sistema cria uma `conta` tipo 'cartao' com o mesmo nome e vincula via `cartoes.conta_associada_id`. Vantagem: o user só cadastra o cartao, a conta aparece automaticamente no select de "Conta" do form de lancamento. Retorna `{ cartaoId, contaId }` em vez de só o `cartaoId` (breaking change do backend, mas a UI/rotas foram atualizadas).
- **`criarLancamento` agora AUTO-VINCULA à fatura do ciclo** (`core/lancamentos.js`): se a conta for tipo 'cartao' e o user NAO passou `cartaoId`/`faturaId` explícito, o sistema descobre o cartao via `cartoes.conta_associada_id`, calcula o ciclo pelo `dia_fechamento` (compra antes do fechamento → ciclo atual; depois → próximo ciclo), e abre/vincula a fatura automaticamente. O user só precisa dizer "conta do cartão X" e a compra cai na fatura certa, sem ele pensar nisso.
- **`valor_total_centavos` da fatura é mantido em sincronia automaticamente**: `criarLancamento` recalcula o total (SUM dos lancamentos nao-estornados) ao criar cada compra. `excluirLancamento` e `excluirTodosLancamentos` recalculam ao excluir. `pagarFatura` atualiza `valor_pago_centavos` e o `status` da fatura ('paga' quando pago >= total, 'fechada' quando pago > 0 mas < total, 'aberta' caso contrario).
- **Bug fix** em `pagarFatura`: usava `fatura[4]` (que era `data_vencimento`) em vez de `fatura[5]` (`valor_total_centavos`) na comparacao `pago >= total`. Resultado: faturas com pagamento parcial ficavam com status 'paga' incorretamente. Corrigido pra usar o indice certo + comentario explicando o schema.
- **Novas funções backend** em `core/cartoes.js`:
  - `atualizarCartao(db, id, campos)` — atualiza dados cadastrais (nome, limite, dia fechamento, etc).
  - `excluirCartao(db, id, { cascade })` — soft-deleta a conta associada (preserva historico) e apaga faturas vazias. Padrao: BLOQUEIA se tem faturas com lancamentos. Com cascade: apaga faturas + desvincula lancamentos (UPDATE MANUAL `fatura_id=NULL, cartao_id=NULL` pq sql.js nao enforca ON DELETE SET NULL).
  - `listarFaturasDetalhadas(db, cartaoId)` — lista com `qtd_lancamentos` e `soma_lancamentos_centavos` agregados (subqueries).
  - `listarLancamentosDaFatura(db, faturaId)` — drill-down dos lancamentos da fatura.
  - `calcularCicloDaCompra(db, { cartaoId, dataCompra })` — calcula ciclo YYYY-MM e data_fechamento/data_vencimento baseado no `dia_fechamento` do cartao. Trata virada de ano (compra 31/12/2026 → ciclo 2027-01).
- **Novas rotas servidor** (`servidor.js`): `cartoes:atualizar`, `cartoes:excluir`, `faturas:listarDetalhadas`, `faturas:listarLancamentos`, `faturas:calcularCiclo`. `cartoes:criar` agora retorna `{ cartaoId, contaId }` (nao so o id).
- **Novas telas**:
  - `telas/cartoes.js` (CRUD): lista cartoes do contexto (nome, instituicao, limite formatado em R$, dia fechamento, dia vencimento, conta de pagamento). Botoes: "+ Novo cartão", "Editar", "Faturas" (navega pra tela de faturas filtrada), "Excluir" (com dialog explicando o cascade). Form de cadastro com validacao (dia 1-31, valor em R$ com conversao pra centavos).
  - `telas/faturas.js` (lista + drill-down + pagar): select de cartao no topo. Pra cada cartao, tabela de faturas com: ciclo, data fechamento, data vencimento, qtd de lancamentos, total, pago, status (paga/fechada/aberta). Botoes: "Ver lançamentos" (abre painel com tabela detalhada dos lancamentos da fatura), "Pagar" (modal com select de conta bancaria + valor + data). Modal de pagamento valida que valor > 0 e <= restante, e mostra preview do total/pago/restante.
- **Sidebar** (`index.html`): adicionados 2 botoes "Cartões" e "Faturas" entre "Importar extrato" e "Transferências". Navegação via `data-view` igual as outras telas.
- **App.js**: `render(view)` agora roteia `view === 'cartoes'` e `view === 'faturas'`. Tela de faturas aceita `cartaoFiltro` via `dataset.cartaoFiltro` no botão da nav (permite a tela de cartões navegar direto pras faturas de um cartão especifico).
- **Mudança no `listarLancamentosDetalhados`**: agora retorna **24 colunas** (eram 22) por causa das 2 colunas novas (`cartao_id` e `fatura_id`). Posicao dos JOINs mudou de 17-21 pra 19-23. UI de `renderLancamentos` ainda nao mostra essas colunas (escopo do v0.9.0 enxuto era so a tela de cartões), mas o backend tá pronto pra v0.9.1 exibir badge "💳 cartao" / "📄 fatura X".
- **10 testes novos** (101/101 verde): criarCartao cria conta associada tipo 'cartao', excluirCartao sem cascade BLOQUEIA + com cascade apaga + desativa conta, criarLancamento auto-vincula à fatura do ciclo (antes/depois do fechamento), criarLancamento em conta bancaria NAO vincula, valor_total_centavos atualiza ao criar/excluir, pagarFatura marca fatura_id e status='paga', listarFaturasDetalhadas com qtd/soma, listarLancamentosDaFatura filtra certo, atualizarCartao muda cadastro, calcularCicloDaCompra trata virada de ano.
- **Bump v0.8.20 → v0.9.0** (7 lugares). Bundle v0.9.0 (~6 MB) em publicacao no GH. Auto-update ja ta programado.
- **Motivação do user** (gravado pra nunca repetir): "senti falta do cartão de credito, ele é muito importante pra eu controlar meus gastos e fazer previsões de parcelamento". Escolheu o escopo "enxuto" (sem parcelamento com projeção), entao v0.9.1 pode trazer parcelamento (compra parcelada em Nx → N lancamentos automaticos nas faturas futuras, com projecao visual "R$ 250 x 12 = R$ 3.000, termina em 2027-03"). Ja tem `calcularCicloDaCompra` que vai ser util pra projetar a fatura de cada parcela.

"""

novo = novo_top + rest
with open(HIST, 'w', encoding='utf-8') as f:
    f.write(novo)
print(f"OK: {len(novo)} bytes escritos")
