# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
# find anchor / mount position for wings-sort
for pat in ['wings-sort', 'anchor:', 'append:', 'createShadowRootUi', 'querySelector("main"', 'header', 'max-w-5xl', 'position:"inline"']:
    ms=list(re.finditer(pat, sort))
    print(pat, len(ms))
    for m in ms[:2]:
        print(' ', repr(sort[max(0,m.start()-60):m.start()+160]))

# pro dashboard ensureRoot
pro = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\wings-pro-dashboard.js').read_text(encoding='utf-8')
i=pro.find('function ensureRoot')
print('\nensureRoot', pro[i:i+500])
i=pro.find('trend')
print('\ntrend bits', [m.start() for m in re.finditer('trend', pro)][:8])
