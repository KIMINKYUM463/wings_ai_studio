# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

t = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\interceptor.js').read_text(encoding='utf-8')

# find function B (media code from path?), N, H, k, fetch override body
for name in ['function B(', 'function N(', 'function H(', 'function k(', 'function A(', 'n.call(window', 'window.fetch=']:
    i=t.find(name)
    print(name, i)
    if i>=0:
        print(repr(t[i:i+350]))
        print('---')

# coupang gp definition
t3=Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\coupang-image-badge.js').read_text(encoding='utf-8')
i=t3.find('const gp=')
if i<0: i=t3.find('gp={')
print('gp', i, repr(t3[i:i+400]) if i>=0 else None)
# find async main function inside
m=re.search(r'async \w+\(\w+\)\{', t3[310000:311400])
print('near matches', t3[310680:311400])
