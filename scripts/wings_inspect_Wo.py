# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\feed.js").read_text(encoding="utf-8")
i = t.find('function Wo()')
print(repr(t[i:i+700]))
