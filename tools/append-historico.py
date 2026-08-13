import os
path = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
append = """

## 0.8.8-hotfix2 — `persistir()` quebrado (importação some) + toasts em todas as ações + UI da Importação reescrita

- **Bug GRAVE (raiz do "importei e os dados sumiram")**: o `persistir()` em `ambiente.js` usava `Neutralino.filesystem.move(tmp, arquivo)`. No Windows, `move` NÃO sobrescreve o destino. Quando o `<banco>.old` já existia (de uma gravação anterior), o passo `atual → .old` falhava silenciosamente no try/catch. Aí o passo `tmp → atual` também falhava (porque o `atual` ainda existia). O `persistir()` abortava sem erro visível. Resultado: tudo que o user fez (cadastros, edições, **importações OFX/CSV**) ficava só em memória e NUNCA chegava ao disco. O log do app mostrou `unhandledrejection: Cannot perform move: .tmp -> .sqlite` em 2026-08-13 às 00:33-00:34.
- **Fix**: `persistir()` agora usa `cmd.exe /c move /Y` (sobrescreve destino, confiável em Windows). Fluxo atômico da seção 4.3 do PADRAO agora funciona de verdade: 1) escreve em `.tmp`, 2) `move /Y atual → .old` (sobrescreve), 3) `move /Y .tmp → atual` (sobrescreve), 4) `.old` preservado para recovery manual.
- **Toast global**: novo helper `globalThis.toast(msg, tipo)` (tipos: `ok`, `err`, `warn`, `info`). Substitui todos os `alert()` por toasts não-bloqueantes. Usado em: salvar/cancelar/resetar de Configurações, criar/editar de Cadastros, criar Lançamento, registrar Baixa, criar Transferência, importar/cancelar Importação, exportar/restaurar Backup.
- **Tela de Importação reescrita**: novo painel "📍 Para onde vão os dados" no topo mostrando contexto financeiro + conta de destino (atualiza em tempo real) + resumo da prévia. Sem esse painel, o user não sabia pra onde os dados iam. Feedback ao vivo em todos os pontos (prévia criada, importar OK, importar cancelado, erro).
- **36/36 testes verde.** Hotfix aplicado direto no `resources.neu` instalado.
"""
if "0.8.8-hotfix2" not in content:
    with open(path, 'a', encoding='utf-8') as f:
        f.write(append)
    print('anexado')
else:
    print('ja tinha hotfix2')
# Verificar sem BOM
with open(path, 'rb') as f:
    head = f.read(3)
print('BOM?', head == b'\xef\xbb\xbf')
