# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
i = sort.find('name:"wings-sort"')
print(sort[i-800:i+400])
print('\n====')
# find function that sets z=
for needle in ['function z=', 'z=document', 'const z=', 'let z=', 'z=e.query', 'z=document.query']:
    j=sort.find(needle)
    print(needle, j)
