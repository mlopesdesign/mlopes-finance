import re
text = open('src/js/telas/contextos.js', encoding='utf-8').read()
print(f'Original len: {len(text)}')
# Step 1: strip /* */
text2 = re.sub(r'/\*.*?\*/', '', text, flags=re.DOTALL)
print(f'Apos /* */ strip: {len(text2)}')
# Step 2: strip //
text2 = re.sub(r'//[^\n]*', '', text2)
print(f'Apos // strip: {len(text2)}')
# Step 3: strip strings "
text2b = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text2)
print(f'Apos " " strip: {len(text2b)} (diff={len(text2)-len(text2b)})')
# Step 4: strip strings '
text2c = re.sub(r"'(?:[^'\\]|\\.)*'", "''", text2b)
print(f"Apos ' ' strip: {len(text2c)} (diff={len(text2b)-len(text2c)})")
# Step 5: strip strings `
text2d = re.sub(r'`(?:[^`\\]|\\.)*`', '``', text2c)
print(f'Apos ` ` strip: {len(text2d)} (diff={len(text2c)-len(text2d)})')
# Acha function money
m = re.search(r'function\s+money', text2d)
print(f'function money em text2d: {m}')
