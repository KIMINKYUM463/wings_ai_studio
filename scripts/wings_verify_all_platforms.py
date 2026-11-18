# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research')
man = (root/'manifest.json').read_text(encoding='utf-8')
print('manifest version', re.search(r'"version": "[^"]+"', man).group(0))

for name in ['tiktok.js','rednote.js','douyin.js']:
    t=(root/'content-scripts'/name).read_text(encoding='utf-8')
    print('====', name)
    for s in ['WINGS 틱톡','틱톡 검색 분석','WINGS 샤오홍','샤오홍슈 검색','#0f766e','#2f7fc7','border-left:3px solid #14b8a6','border-radius:9999px']:
        print(' ', s, t.count(s))

for name in ['tiktok.css','rednote.css']:
    c=(root/'content-scripts'/name).read_text(encoding='utf-8')
    print('====', name)
    for tok in ['--point:','--brand-500:','--primary:']:
        m=re.search(rf'{tok}([^;]+);', c)
        print(' ', tok, m.group(1) if m else None)
