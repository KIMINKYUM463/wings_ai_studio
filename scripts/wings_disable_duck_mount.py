# -*- coding: utf-8 -*-
from pathlib import Path

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
n = 0
for p in (root / "content-scripts").glob("*.js"):
    t = p.read_text(encoding="utf-8")
    o = t
    t = t.replace('querySelectorAll("[data-duck-mood]")', 'querySelectorAll("[data-wings-no-duck]")')
    t = t.replace("querySelectorAll('[data-duck-mood]')", "querySelectorAll('[data-wings-no-duck]')")
    if t != o:
        p.write_text(t, encoding="utf-8")
        n += 1
        print("patched", p.name)
print("count", n)

p = root / "chunks" / "DuckBotMood-Dr_0mqIB.js"
if p.exists():
    t = p.read_text(encoding="utf-8")
    t2 = t.replace("하입덕 오리", "WINGS").replace("하입덕", "WINGS")
    if t2 != t:
        p.write_text(t2, encoding="utf-8")
        print("duckbot mood label fixed")
    else:
        print("duckbot already clean")
