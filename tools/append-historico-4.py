import os
path = r'E:\Projetos\MLOPES FINANCE\HISTORICO-DE-VERSOES.md'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
append = """

## 0.8.8-hotfix4 — Sinal do valor preservado na importação (despesa/receita)

- **Bug**: o `parsearCSV` e o `parsearOFX` faziam `Math.abs(valor)` ao calcular `valor_centavos`, perdendo o sinal. O `confirmarImportacao` então checava `valor < 0` (sempre false, porque `valor_centavos` já era positivo) e caía sempre no `padraoNatureza` default ('despesa'). Resultado: TODOS os lançamentos importados viravam despesa, mesmo os créditos (PIX RECEBIDO, SALARIO, etc).
- **Fix**:
  - `parsearCSV` e `parsearOFX`: removido `Math.abs`. `valor_centavos` agora preserva o sinal (negativo = despesa, positivo = receita). `natureza_sugerida` é calculada corretamente.
  - `confirmarImportacao`: usa o sinal do `valor` pra escolher a natureza. `padraoNatureza` (da UI) só é usado como fallback quando o sinal é 0 (não acontece, parser filtra zeros).
  - `criarPreviaImportacao` (detecção de duplicados): comparação com `Math.abs()` no JS. O schema de `lancamentos` exige `valor_centavos > 0`, então comparamos o valor absoluto do item com o valor absoluto do lançamento.
  - 1 teste novo (39/39 verde): "CSV com sinal cria lancamentos com natureza correta (despesa/receita)" — importa um CSV com PIX ENVIADO, PIX RECEBIDO, DEBITO COMBUSTIVEL, SALARIO. Confere que cada um virou lançamento com a natureza certa.
- **Como o Marcio vai usar agora**: Importar extrato → Pré-visualizar → vai ver na tabela "Valor" valores com sinal (negativo pra despesa, positivo pra receita). Confirmar → lançamentos criados com a natureza certa. Visão geral vai somar receitas corretamente.
"""
if "0.8.8-hotfix4" not in content:
    with open(path, 'a', encoding='utf-8') as f:
        f.write(append)
    print('anexado')
else:
    print('ja tinha hotfix4')
with open(path, 'rb') as f:
    head = f.read(3)
print('BOM?', head == b'\xef\xbb\xbf')
