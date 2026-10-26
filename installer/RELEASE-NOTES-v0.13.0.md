## MLopes Finance v0.13.0 — Lançamentos individuais + Baixa automática de faturas

### O que mudou

**1. Tela de Palavras-chave agora mostra os lançamentos individuais**

Cada card de palavra-chave tem um botão **📋 Ver lançamentos individuais** que expande uma tabela com todos os lançamentos que casaram com a palavra: data, descrição, valor, conta.

Antes: você via só o total ("R$ 945 no ano"). Agora: você vê os 5 lançamentos do Adobe (R$ 189 cada, fev-jun/2026) e a conta de onde saiu.

**2. Baixa automática de faturas de cartão**

Marcio pediu: "todas as contas oriundas dos cartões, depois do vencimento dos mesmos já estão pagas, essa baixa tem que ser automática".

Agora, sempre que o app inicia, ele:
- Olha todas as faturas com `data_vencimento <= hoje` e `status != 'paga'`
- Pra cada uma, cria automaticamente um lançamento de saída na conta de pagamento
- Marca a fatura como paga
- Grava na auditoria

**Idempotente**: se rodar de novo, não duplica. Pode rodar 100x que só paga 1 vez.

### Como o user usa

1. **Auto-update**: baixa v0.13.0
2. Abre o app — toast aparece: "X fatura(s) paga(s) automaticamente" (se houver)
3. Sidebar → **Palavras-chave** → qualquer card → **📋 Ver lançamentos individuais**

### Estatísticas

- **170/170 testes verde** (+3 novos pra baixa automática).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.

### Pra desenvolvedor

- Backend `core/cartoes.js:pagarFaturasVencidasAutomaticamente(db, contextoId, { dataReferencia })` — função pura, idempotente, testada.
- Servidor: rota `cartoes:sincronizarBaixasAutomaticas`.
- App.js: chama no boot (1x/dia, controlado por `configuracoes.ultima_baixa_automatica`).
