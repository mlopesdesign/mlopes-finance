## MLopes Finance v0.12.4 — HOTFIX botão Recorrências + Contexto obrigatório

### Correções (v0.12.3 tinha 2 bugs introduzidos)

- **Botão "Recorrências" não aparecia na sidebar**: editei o `resources/index.html` (gerado) em vez do `src/index.html` (fonte). O `build:resources` sobrescreveu meu edit. **Fix**: botão adicionado no `src/index.html` (a fonte). Agora aparece.

- **"Uncaught Error: Contexto obrigatorio para clientes"** ao abrir Projetos/Clientes/Fornecedores: o `carregarSelectOptions` do `cadastros-generico.js` (novo na v0.12.3) chamava `api('clientes:listar', {})` sem passar `contextoId`. Mas `listarClientes` exige. **Fix**: passa `contextoId` no payload + cacheia por contexto.

### Estatísticas

- **159/159 testes verde** (+1 regressão: `listarClientes` exige `contextoId`).
- 2 assets: `MLopesFinance_Setup.exe` + `resources.neu` (sem ZIP).

### Como o user instala

1. **Auto-update**: app já detecta v0.12.4 e baixa sozinho.
2. **Manual**: baixa o `MLopesFinance_Setup.exe` (único instalador, NUNCA o `resources.neu` que é só pra auto-update).
