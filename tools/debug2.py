import re
text = open('src/js/telas/contextos.js', encoding='utf-8').read()
text2 = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text2 = re.sub(r'//[^\n]*', '', text2)
text2 = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text2)
text2 = re.sub(r"'(?:[^'\\]|\\.)*'", "''", text2)
text2 = re.sub(r'`(?:[^`\\]|\\.)*`', '``', text2)
matches = list(re.finditer(r'function\s+money', text2))
print('Depois do strip, matches de function money:', len(matches))
for m in matches:
    print(f'  pos {m.start()}: ...{text2[max(0,m.start()-20):m.end()+30]}...')
