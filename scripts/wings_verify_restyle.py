# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.css').read_text(encoding='utf-8')
for name in ['background','primary','brand-500','point','chart-1','chart-4','shadow-duck']:
    ms=list(re.finditer(rf'--{name}:([^;]+);', c))
    print(name, [m.group(1)[:40] for m in ms[:3]])

# count leftover hypeduck colors
for hexv in ['#2f7fc7','#ffc93c','#ff8a00','#9a7bff','#0f766e','#14b8a6']:
    print(hexv, c.lower().count(hexv.lower()))

js = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
print('title', 'WINGS 릴스 리서치' in js)
print('NC', 'border-left:3px solid #14b8a6' in js)
print('grade', '#0f766e' in js and '폭발:{fg:' in js)
m=re.search(r'폭발:\{fg:"[^"]+",bg:"[^"]+"\},강력:\{fg:"[^"]+",bg:"[^"]+"\},우수:\{fg:"[^"]+",bg:"[^"]+"\}', js)
print('grade now', m.group(0) if m else None)
