## MLopes Finance v0.12.5 — Relatório de Recorrências por categoria

### O que mudou

Tela **Recorrências** ganhou novo botão **📂 Por categoria** que mostra o total gasto agrupado por categoria (Transporte, Telefonia, Energia, Software, etc).

Antes: você via lista de cada gasto (Uber R$25, Vivo R$99, Adobe R$50...).
Agora: você vê **quanto gasta com cada categoria por mês e por ano**:

| Categoria | Qtd | Mensal | Anual |
|-----------|-----|--------|-------|
| Telefonia / Internet | 1 | R$ 99,90 | R$ 1.198,80 |
| Transporte / App | 2 | R$ 75,00 | R$ 900,00 |
| Energia | 1 | R$ 250,00 | R$ 3.000,00 |
| Software | 3 | R$ 95,00 | R$ 1.140,00 |

### Como funciona

- **Já só conta saída (despesas)** — o detector filtra `natureza = 'despesa'` por padrão.
- **Auto-categorização**: Uber/99/Cabify → Transporte, Vivo/Claro → Telefonia, CPFL → Energia, Adobe/Figma → Software, iFood → Delivery, etc.
- **Sem categoria detectada** → agrupa em "Outros" pra você editar manualmente.
- **Cálculo**: valor mensal = `valor_unitario × fator_periodicidade` (semanal: 4.33x, mensal: 1x, anual: 0.083x). Valor anual = mensal × 12.

### Estatísticas

- **161/161 testes verde** (+2 testes pro relatorioPorCategoria).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu` (sem ZIP).

### Como o user instala

1. **Auto-update**: app já detecta v0.12.5 e baixa.
2. Sidebar → **Recorrências** → **🔍 Detectar recorrências** (se ainda não tem) → **📂 Por categoria**.
