# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')
start = yt.find('async function DS(')
# print until next function after return{rows
end = yt.find('function cp(', start)
print(yt[start:end])
print('\n==== helpers ====')
for name in ['function RS(', 'function zS(', 'function OS(', 'function NS(', 'function MS(', 'function PS(', 'function QS(', 'function WS(']:
    i = yt.find(name)
    if i < 0:
        # try nearby letter combos around DS
        continue
    print(name, 'at', i)
    print(yt[i:i+500])
    print('---')

# find all functions just before DS
chunk = yt[start-8000:start]
import re
funcs = re.findall(r'function ([A-Za-z0-9_]+)\(', chunk)
print('funcs before DS', funcs[-20:])
