# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')

for pat in [r'k\.set\(', r'k\.get\(', r'NS\(', r'comment-item-section', r'apiKey', r'INNERTUBE_API_KEY', r'ytcfg\.data_', r'context:']:
    ms=list(re.finditer(pat, yt))
    print(pat, len(ms))
    for m in ms[:4]:
        print(' ', repr(yt[max(0,m.start()-60):m.start()+160]))

# find Map named k near youtube overlay main
# look for ",k=new Map" or "k=new Map"
for m in re.finditer(r'[^A-Za-z]k=new Map', yt):
    print('k=new Map', m.start(), repr(yt[m.start()-40:m.start()+80]))
