# -*- coding: utf-8 -*-
from pathlib import Path
import re

feed = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\feed.js")
t = feed.read_text(encoding="utf-8")

# Find key functions
for name in ["function mt(", "function Ba(", "function Wo(", "function Ua(", "function za(", "function Xo(", "function $n(", "function Wi(", "Vi=new Set", "const Vi="]:
    i = t.find(name)
    print(name, i)
    if i >= 0:
        print(repr(t[i:i+220]))
        print("---")

rescue = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\wings-ig-rescue.js")
print("RESCUE")
print(rescue.read_text(encoding="utf-8")[:1500])
