## MLopes Finance v0.13.1 — Botão "Sincronizar baixas" na tela de Faturas

### O que mudou

Adicionado botão **🔄 Sincronizar baixas automáticas** na tela de Faturas, ao lado do título.

Antes: a baixa automática só rodava no boot do app (1x por dia). Se você fechou o app antes da hora, faturas ficavam em aberto até o próximo boot.

Agora: você pode forçar a sincronização manualmente em **qualquer momento**, sem precisar reiniciar o app.

### Quando usar

- Faturas com vencimento no passado que estão em aberto (`status='aberta'`)
- A baixa automática do boot não rodou ainda hoje
- Você quer pagar várias faturas de uma vez sem clicar em cada uma

### O que acontece quando clica

- Para cada fatura com `data_vencimento <= hoje` e `status != 'paga'`:
  - Cria lançamento de saída (despesa, conciliado) na conta de pagamento
  - Marca fatura como paga
  - Grava na auditoria
- Toast final: "X fatura(s) paga(s), Y já estavam pagas, Z com erro"
- Idempotente (pode rodar 100x sem duplicar)

### Estatísticas

- **170/170 testes verde** (não mudou — feature de UI).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.
