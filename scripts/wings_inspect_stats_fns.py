# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
for name in ['function bj(', 'function Aj(', 'function am(', 'function Sj(', 'function bj', 'e.add=']:
    i=sort.find(name)
    print(name, i)
    if i>=0: print(sort[i:i+450]); print('---')

# find normalize reel
i=sort.find('playCount:')
print('playCount context', sort[i-80:i+200])
