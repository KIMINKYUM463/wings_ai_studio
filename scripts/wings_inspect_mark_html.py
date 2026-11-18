# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js").read_text(encoding="utf-8")
for m in re.finditer(r'data-wings-slot.*?style="[^"]{0,200}', t):
    print(m.group(0)[:250])
    print('---')
for m in re.finditer(r'data-wings-mark="1"[^>]{0,220}', t):
    print('MARK', m.group(0)[:250])
    print('---')
