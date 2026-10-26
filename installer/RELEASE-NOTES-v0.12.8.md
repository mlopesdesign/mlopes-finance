## MLopes Finance v0.12.8 — HOTFIX layout dos cards + gráfico em HTML

### Correções (v0.12.7 tinha 2 bugs visuais)

- **Cards de totais apertados**: "ESTA SEMANA" / "ESTE MÊS" / "ESTE ANO" estavam quebrando em 2 linhas ("ESTA / SEMANA") e o período "a 2026-08-23" vazava pra fora. **Fix**: label em uma linha (white-space: nowrap, ellipsis), grid com mais espaço, valor com fonte menor mas legível.

- **Gráfico só mostrava 1 palavra (Adobe)**: o SVG com `viewBox` dinâmico + `overflow: visible` tava clipando as outras 2 palavras no WebView2. **Fix**: troquei SVG por HTML+CSS (barras com `width: %`). Cada palavra = 1 linha com 2 barras (ano A cinza + ano B brand) + variação à direita.

### Estatísticas

- **166/166 testes verde** (não mudou — feature de UI).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.

### Como o user instala

1. **Auto-update**: app já detecta v0.12.8 e baixa.
2. Sidebar → **Palavras-chave** — cards e gráfico devem aparecer bem agora.
