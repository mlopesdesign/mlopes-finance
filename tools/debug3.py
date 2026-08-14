import re
text = open('src/js/telas/contextos.js', encoding='utf-8').read()
text2 = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
text2 = re.sub(r'//[^\n]*', '', text2)
text2 = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text2)
text2 = re.sub(r"'(?:[^'\\]|\\.)*'", "''", text2)
text2 = re.sub(r'`(?:[^`\\]|\\.)*`', '``', text2)
# print pos 6450-6520
print('pos 6450-6520:')
print(repr(text2[6450:6520]))
