## MLopes Finance v0.12.9 — Sparkline de 12 meses em cada card de palavra-chave

### O que mudou

Cada card de palavra-chave agora tem um **mini-gráfico de 12 meses** (sparkline) embaixo dos 3 totais. Resolve a confusão "ano tem valor mas mês/semana estão zerados" — agora você vê a distribuição.

Antes: você via `R$ 945 ANO` mas `R$ 0 ESTE MÊS` e `R$ 0 ESTA SEMANA` (sem entender por quê).

Agora: você vê que os R$ 945 estão distribuídos em fev-jun/2026, e jul-ago estão zerados (mês corrente ainda não tem gasto).

### Como funciona

- 12 barras (1 por mês, do mais antigo ao mais recente)
- Mês corrente destacado em verde
- Meses sem gasto ficam cinza-claro
- Hover em cada barra mostra o valor exato

### Estatísticas

- **167/167 testes verde** (+1 teste pra `ultimos12MesesPorPalavra`).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.

### Como o user instala

1. **Auto-update**: app já detecta v0.12.9 e baixa.
2. Sidebar → **Palavras-chave** — agora cada card tem o sparkline embaixo dos 3 cards de totais.
