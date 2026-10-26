## MLopes Finance v0.12.3 — HOTFIX auditor + Detecção de gastos recorrentes

### Correções críticas (auditor v0.11.4)

- **Projetos com clienteId**: tela de Projetos agora exibe o **nome do cliente** (via LEFT JOIN) e o form tem **select** de cliente. Antes mostrava o `cliente_id` (número) no lugar do nome.
- **Clamp do dia 31 em meses curtos**: `calcularCicloDaCompra` agora clampa ao último dia do mês. Sem o fix, com `dia_fechamento=31` em abril, gerava `2026-04-31` que o SQLite normalizava silenciosamente para `2026-05-01`, propagando datas erradas em faturas.
- **DRY entre migração v8 e `regularizarHistoricoCartoes`**: a migração v8 agora delega para o helper em `cartoes.js` em vez de duplicar o SQL.

### Nova feature: Detecção automática de gastos recorrentes

Detecta padrões como **Uber, 99, Adobe, Netflix, Spotify, iFood, Vivo, CPFL, etc** nos lançamentos existentes e gera relatórios mensais e anuais.

- **Heurística**: agrupa por (nome normalizado + valor) com mínimo de 2 ocorrências.
- **Periodicidade detectada automaticamente**: semanal, quinzenal, mensal, bimestral, trimestral, semestral, anual, irregular.
- **Auto-categorização por keyword**: Transporte, Streaming, Software, Delivery, Telefonia, Energia, Água, Moradia, Saúde, Pet, etc.
- **Tela "Recorrências"** na sidebar com:
  - Botão "🔍 Detectar recorrências" + modal de confirmação
  - Lista de recorrentes confirmados
  - **📊 Relatório mensal** (próximos 12 meses: estimado vs real)
  - **📈 Relatório anual** (top 10 + comparativo YoY)
- **Idempotente**: salvar a mesma detecção 2x atualiza, nunca duplica.

### Outras correções

- AGENTS.md regra 6 atualizada (preserva `.old` em vez de remover).
- `.gitignore` ganhou `output/` e `tmp/`.
- 3 testes debug órfãos movidos para `core.test.mjs` como testes reais.
- Schema v9: tabelas `gastos_recorrentes` + `gastos_recorrentes_lancamentos`.

### Estatísticas

- **158/158 testes verde** (10 testes novos).
- Bump v0.12.2 → v0.12.3.
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu` (sem ZIP).

### Download

**`MLopesFinance_Setup.exe`** (instalador) — baixar este.

O `resources.neu` é apenas o bundle de auto-update para quem já tem o app instalado. NÃO é o instalador.
