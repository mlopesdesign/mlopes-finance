import re
text = open('src/js/telas/contextos.js', encoding='utf-8').read()
text2 = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text2 = re.sub(r'//[^\n]*', '', text2)
# Acha o match de string " maior
matches = list(re.finditer(r'"(?:[^"\\]|\\.)*"', text2))
matches.sort(key=lambda m: len(m.group(0)), reverse=True)
for m in matches[:3]:
    print(f'len={len(m.group(0))}, pos {m.start()}-{m.end()}:')
    print(f'  {m.group(0)[:200]}...')
    print()
