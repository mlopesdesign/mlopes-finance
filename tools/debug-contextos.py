#!/usr/bin/env python
import re
text = open('src/js/telas/contextos.js', encoding='utf-8').read()
text2 = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text2 = re.sub(r'//[^\n]*', '', text2)
text2 = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text2)
text2 = re.sub(r"'(?:[^'\\]|\\.)*'", "''", text2)
text2 = re.sub(r'`(?:[^`\\]|\\.)*`', '``', text2)
print('Has call money(:', bool(re.search(r'\bmoney\s*\(', text2)))
print('Has def function money:', bool(re.search(r'\bfunction\s+money\b', text2)))
print('Has def const money:', bool(re.search(r'\b(?:const|let|var)\s+money\s*=', text2)))
# print lines with money
for i, line in enumerate(text2.split('\n'), 1):
    if 'money' in line and 'function' not in line and '//' not in line:
        print(f'{i}: {line.strip()[:100]}')
