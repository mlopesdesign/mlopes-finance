"""Debug: cria um banco novo e checa as colunas."""
import asyncio
import sys
sys.path.insert(0, r'E:\Projetos\MLOPES FINANCE')
sys.path.insert(0, r'E:\Projetos\MLOPES FINANCE\tests')

import subprocess
result = subprocess.run(['node', '-e', '''
import('file:///E:/Projetos/MLOPES FINANCE/tests/core.test.mjs').catch(e => console.error('err:', e.message));
'''], capture_output=True, text=True)
print('STDOUT:', result.stdout)
print('STDERR:', result.stderr)
