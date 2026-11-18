# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research')
sort = (root/'content-scripts'/'sort.js').read_text(encoding='utf-8')
for pat in ['wings-sort', 'hd-sort-reels', 'scoreOf', 'median', 'engagement', 'grade', 'surfaceLabel', 'onMount', 'localStorage', 'wings-dashboard']:
    ms=list(re.finditer(pat, sort))
    print(pat, len(ms))
    if ms:
        print(' ', repr(sort[max(0,ms[0].start()-40):ms[0].start()+120]))

# package.json for available chart libs in monorepo?
pkg = root.parent.parent / 'package.json'
if not pkg.exists():
    pkg = Path(r'c:\Users\a\Downloads\duplicate-of\package.json')
print('pkg', pkg.exists(), pkg)
