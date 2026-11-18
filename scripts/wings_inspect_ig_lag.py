# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts')

# interceptor entry
t = (root/'interceptor.js').read_text(encoding='utf-8')
for pat in [r'function main\(', r'function V\(', r'location.pathname', r'accounts/login', r'window\.fetch', r'XMLHttpRequest']:
    ms=list(re.finditer(pat,t))
    print('interceptor', pat, len(ms))
    if ms:
        i=ms[0].start(); print(' ', repr(t[i:i+180]))

# content.js hd
t2=(root/'content.js').read_text(encoding='utf-8')
for pat in [r'function hd\(', r'hd\(\);', r'async function main', r'function main\(']:
    ms=list(re.finditer(pat,t2))
    print('content', pat, len(ms))
    if ms:
        i=ms[-1].start() if pat=='hd();' else ms[0].start()
        print(' ', repr(t2[max(0,i-40):i+160]))

# coupang badge start
t3=(root/'coupang-image-badge.js').read_text(encoding='utf-8')
for pat in [r'async function main', r'\(async \(\) =>', r'function main\(']:
    ms=list(re.finditer(pat,t3))
    print('coupang', pat, len(ms))
    if ms:
        i=ms[0].start(); print(' ', repr(t3[i:i+200]))
