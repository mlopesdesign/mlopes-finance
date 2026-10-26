## MLopes Finance v0.12.7 — Tela de Palavras-chave (busca controlada + dashboard)

### O que mudou

Nova tela **Palavras-chave** na sidebar (entre Recorrências e Transferências).

Você cadastra palavras (Uber, Vivo, 99, Adobe, iFood) e o sistema busca em **todos os lançamentos de despesa** (substring case-insensitive em `descricao`).

**Pra cada palavra cadastrada, mostra:**
- Card com total **desta semana** (segunda a domingo)
- Card com total **deste mês**
- Card com total **deste ano**
- Quantidade de lançamentos com essa palavra

**Gráfico comparativo anual:** pra cada palavra, mostra barra de 2025 vs barra de 2026 + variação % (verde = subiu, vermelho = desceu).

### Pra que serve

Diferente das Recorrências (que detecta padrão automático por valor+nome), aqui **você controla quais palavras quer monitorar**. Quer saber se 2026 tá mais caro que 2025 em Uber? Clica em "Palavras-chave" e o gráfico responde.

### Exemplo de uso

1. Clica em **+ Nova palavra-chave**
2. Digita "Uber" → Salvar
3. Card "Uber" aparece com R$ X semana / R$ Y mês / R$ Z ano
4. Clica em "Atualizar" no comparativo (ou troca o ano) pra ver 2025 vs 2026
5. Adiciona "Vivo", "99", "Adobe" pra ter visão completa

### Estatísticas

- **166/166 testes verde** (+5 testes pra palavras-chave).
- Schema v10: tabela `palavras_chave` + migration idempotente.
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.

### Como o user instala

1. **Auto-update**: app já detecta v0.12.7 e baixa.
2. Sidebar → **Palavras-chave** → **+ Nova palavra-chave**.
