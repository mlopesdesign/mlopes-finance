import os, subprocess, hashlib
os.chdir(r'E:\Projetos\MLOPES FINANCE')
neu = r'dist\MLopesFinance\resources.neu'
with open(neu, 'rb') as f:
    sha = hashlib.sha256(f.read()).hexdigest()
size = os.path.getsize(neu)
body = f"""## v0.8.13 - bump trivial (teste auto-update)

Esta versao existe apenas para o Marcio testar o ciclo completo do auto-update.
O source contem o fix do v0.8.12 (path via Neutralino.os.getEnv + remover fallback sincrono).

**Como testar**:

1. O bundle v0.8.13 ja foi substituido na maquina dele. App estara em v0.8.13 ao abrir.
2. Mas a latest no GH tambem sera v0.8.13. Sem atualizacao.
3. Pra ver o ciclo, va em Configuracoes > Avancado > Atualizacao e clique 'Tentar novamente' (se aparecer o erro antigo do v0.8.10).
4. Ou instale uma versao anterior via Setup.exe e teste.

### SHA256

```
{sha}
```

### Tamanho

{size} bytes
"""
body_path = os.path.join(os.environ['TEMP'], 'mlopes-release-notes-v0.8.13.md')
with open(body_path, 'w', encoding='utf-8') as f:
    f.write(body)
# Substituir o bundle instalado
import shutil
dest = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'MLopes Finance', 'resources.neu')
shutil.copyfile(neu, dest)
# Publicar
r = subprocess.run(['gh', 'release', 'create', 'v0.8.13', '--title', 'v0.8.13 - bump (teste auto-update)', '--notes-file', body_path, neu], capture_output=True, text=True)
print('STDOUT:', r.stdout)
print('STDERR:', r.stderr)
print('rc:', r.returncode)
