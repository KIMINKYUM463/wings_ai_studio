# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\feed.js").read_text(encoding="utf-8")

for pat in [r"za=\(\)=>", r"Xo=\(\)=>", r"\$n=\(\)=>", r"function za", r"const za", r"za=e=>", r"_o=", r"ko=", r"vo="]:
    for m in re.finditer(pat, t):
        i=m.start()
        print(pat, i, repr(t[i:i+120]))
        break

# also find La and Na
for name in ["function La(", "function Na(", "function ge("]:
    i=t.find(name)
    print(name, i, repr(t[i:i+180]) if i>=0 else None)
