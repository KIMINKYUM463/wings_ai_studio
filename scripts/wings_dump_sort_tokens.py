# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

c = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.css').read_text(encoding='utf-8')
# find --xxx: value pairs for brand-ish tokens
for m in re.finditer(r'--([a-z0-9-]+):(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|[^;]{1,80});', c):
    name=m.group(1)
    if any(k in name for k in ['brand','primary','point','chart','shadow','card','background','foreground','secondary','muted','accent','ring']):
        print(f'--{name}: {m.group(2)[:60]}')
