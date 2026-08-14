#!/usr/bin/env python
import subprocess, sys, json
r = subprocess.run(['gh', 'release', 'view', 'v0.11.4', '--json', 'assets'], capture_output=True, text=True)
data = json.loads(r.stdout)
print('=== v0.11.4 - Assets disponiveis ===')
for a in data['assets']:
    size_mb = a['size'] / 1024 / 1024
    print(f"  {a['name']}: {a['size']:,} bytes ({size_mb:.1f} MB)")
    print(f"    {a['url']}")
    print()
print('Link direto do instalador portatil:')
print('  https://github.com/mlopesdesign/mlopes-finance/releases/download/v0.11.4/MLopesFinance-release.zip')
print()
print('Tambem disponivel via Setup.exe (Inno Setup):')
print('  https://github.com/mlopesdesign/mlopes-finance/releases/download/v0.11.4/MLopesFinance_Setup.exe')
print('  ^^^ esse NAO existe ainda (o installer.iss precisa ser buildado localmente)')
