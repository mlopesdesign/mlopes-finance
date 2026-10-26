## MLopes Finance v0.12.6 — HOTFIX Selecionar/Desmarcar todos

### O que mudou

Modais de detecção (Recorrências e Parcelamentos) agora têm botões explícitos de seleção em massa + contador em tempo real:

- **☑ Selecionar todos** — marca todos os candidatos
- **☐ Desmarcar todos** — desmarca todos
- **⇄ Inverter** — inverte a seleção atual
- Contador "X de N selecionados" no topo (atualiza ao vivo)

Antes só tinha o checkbox-mestre (que nem era clicável pra desmarcar). Marcar/desmarcar 1 a 1 em lista de 20+ era foda. Agora é 1 clique.

### Como o user instala

1. **Auto-update**: app já detecta v0.12.6 e baixa.
2. Sidebar → **Recorrências** → **🔍 Detectar recorrências** → use os botões "Selecionar todos" / "Desmarcar todos" / "Inverter".

### Estatísticas

- 2 telas modificadas: `telas/recorrencias.js`, `telas/parcelamentos.js`.
- 161/161 testes verde (não mudou — feature de UI).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu`.
