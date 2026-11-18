# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts')
for name in ['tiktok.js','rednote.js','douyin.js','threads.js','youtube.js','sort.js']:
    p = root/name
    if not p.exists():
        print('missing', name); continue
    t = p.read_text(encoding='utf-8')
    print('====', name, 'len', len(t))
    for pat in [
        r'전체 .*분석', r'검색 분석', r'틱톡', r'샤오홍', r'小红书', r'name:"wings-', r'name:"hd-',
        r'data-wxt-shadow-root', r'mood:"brand"', r'border-radius:9999px',
        r'폭발:\{fg:', r'\.css', r'getURL\("/content-scripts/',
    ]:
        ms=list(re.finditer(pat,t))
        if not ms: continue
        print(' ', pat, len(ms))
        for m in ms[:2]:
            print('   ', repr(t[max(0,m.start()-20):m.end()+80]))
