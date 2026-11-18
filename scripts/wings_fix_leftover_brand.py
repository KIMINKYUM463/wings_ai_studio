# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts')

# Fix leftover rednote title
rn = (root/'rednote.js').read_text(encoding='utf-8')
for m in re.finditer(r'.{0,40}샤오홍슈.{0,40}', rn):
    print('RN', m.group(0))

dy = (root/'douyin.js').read_text(encoding='utf-8')
for m in re.finditer(r'.{0,40}도우인.{0,40}', dy):
    print('DY', m.group(0))

# Replace leftover #2f7fc7 in grade/badge contexts across platform js
for name in ['tiktok.js','rednote.js','douyin.js','threads.js','youtube.js','sort.js','feed.js']:
    p = root/name
    t = p.read_text(encoding='utf-8')
    n = t.count('#2f7fc7')
    if n:
        t2 = t.replace('#2f7fc7', '#0f766e').replace('#FF8A00', '#0369a1').replace('#ff8a00', '#0369a1').replace('#ffc93c', '#14b8a6').replace('#FFC93C', '#14b8a6')
        p.write_text(t2, encoding='utf-8')
        print('hexfix', name, n)
