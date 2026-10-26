# Política de documentação viva

## Regra

Toda ação do projeto que mudar código, banco, regra de negócio, interface, testes, instalador ou fluxo do usuário deve atualizar a documentação no mesmo movimento. O documento editável é a fonte; os PDFs são derivados e devem ser regenerados antes da entrega.

## Rotina obrigatória

1. Atualizar `docs/GUIA-RAPIDO.md` quando a mudança alterar uma tarefa comum.
2. Atualizar `docs/MANUAL-DO-USUARIO.md` quando a mudança alterar regra, fluxo, limite ou solução de problema.
3. Executar `npm run docs:build`.
4. Conferir visualmente os dois PDFs em `output/pdf/`.
5. Registrar o que foi feito, o resultado, os testes e os artefatos em `docs/REGISTRO-DE-AÇÕES.md`.
6. Atualizar `HISTORICO-DE-VERSOES.md` e `GRAPHIFY.md` quando houver mudança de versão ou arquitetura.

## Comando único

```powershell
npm run docs:build
```

O comando gera PDFs estáveis em:

- `output/pdf/GUIA-RAPIDO.pdf`
- `output/pdf/MANUAL-DO-USUARIO.pdf`

Arquivos temporários ficam em `tmp/pdfs/` e não são artefatos de entrega.

## Critério de conclusão

Uma ação só é considerada documentada quando existe registro no histórico, as fontes editáveis refletem o comportamento atual e os dois PDFs foram regenerados sem erro.

Última revisão: 2026-08-15 - versão 0.12.2.
