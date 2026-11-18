# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\feed.js").read_text(encoding="utf-8")

# find article forEach ge and _o ko vo Wi Vi
for pat in [r"function _o\(", r"_o=e=>", r"function ko\(", r"function vo\(", r"querySelectorAll\(\"article\"\)\.forEach\(ge\)", r"hd-feed-chip", r"function ge\(a\)"]:
    ms=list(re.finditer(pat,t))
    print(pat, len(ms))
    for m in ms[:2]:
        print(' ', repr(t[m.start():m.start()+200]))

# Find Wi and nearby - add isIgProfile after Wi
i=t.find('function Wi(e){')
print('Wi block', repr(t[i:i+400]))
print('Ua', repr(t[t.find('function Ua()'):t.find('function Ua()')+280]))
print('mt', repr(t[t.find('function mt()'):t.find('function mt()')+120]))
