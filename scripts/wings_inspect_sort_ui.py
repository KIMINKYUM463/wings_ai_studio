# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js')
t = sort.read_text(encoding='utf-8')

# find CSS var definitions and key strings
for pat in [r'--brand-500', r'--point:', r'--shadow-premium', r'전체 릴스 분석', r'hd-rv-chip', r'border-radius:9999px', r'NC=', r'function Vl\(', r'uS,\{mood:"brand"']:
    ms=list(re.finditer(pat,t))
    print(pat, len(ms))
    if ms:
        i=ms[0].start()
        print(' ', repr(t[max(0,i-30):i+120]))

css = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.css')
c = css.read_text(encoding='utf-8')
print('css len', len(c))
# print first :root block
m=re.search(r':root\{[^}]{0,2000}', c)
if m:
    print(m.group(0)[:1500])
