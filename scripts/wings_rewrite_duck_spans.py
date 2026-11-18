# -*- coding: utf-8 -*-
"""Force overlay HTML to emit W mark spans instead of data-duck spans."""
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")
pat = re.compile(
    r'<span data-duck="\$\{[^}]+\}" data-duck-expression="\$\{[^}]+\}" data-duck-size="\$\{[^}]+\}"[^>]*>'
)

nfiles = 0
for p in root.glob("*.js"):
    t = p.read_text(encoding="utf-8")
    # Find the helper that already builds wings-mark and see duck template nearby
    if 'data-duck="' not in t:
        continue
    # Replace attribute names so skin/CSS treat as mark; keep size attr via data-duck-size → style already inline
    o = t
    t = t.replace('data-duck="', 'data-wings-slot="')
    t = t.replace("data-duck-expression=", "data-wings-expression=")
    t = t.replace("data-duck-size=", "data-wings-size=")
    if t != o:
        p.write_text(t, encoding="utf-8")
        nfiles += 1
        print("rewrote attrs", p.name)
print("done", nfiles)
