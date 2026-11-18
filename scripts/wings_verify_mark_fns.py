# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")
for p in root.glob("*.js"):
    t = p.read_text(encoding="utf-8")
    if 'data-wings-mark="1"' not in t:
        continue
    # show function signatures near mark helpers
    for m in re.finditer(r"function (\w+)\([^)]*\)\{return`<span data-wings-mark", t):
        start = m.start()
        print(p.name, t[start:start+220].replace("\n"," "))
