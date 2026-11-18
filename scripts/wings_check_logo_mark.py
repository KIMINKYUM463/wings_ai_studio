# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
t = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')
m = re.search(r'data-wings-mark="1".{0,280}', t)
print(m.group(0) if m else 'none')
