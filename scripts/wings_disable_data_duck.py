# -*- coding: utf-8 -*-
from pathlib import Path

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
n = 0
for p in (root / "content-scripts").glob("*.js"):
    t = p.read_text(encoding="utf-8")
    o = t
    t = t.replace('querySelectorAll("[data-duck]")', 'querySelectorAll("[data-wings-no-duck-span]")')
    t = t.replace("querySelectorAll('[data-duck]')", "querySelectorAll('[data-wings-no-duck-span]')")
    if t != o:
        p.write_text(t, encoding="utf-8")
        n += 1
        print("patched", p.name)
print("count", n)

# remove leftover brand icons/react images
for p in list((root / "icons").glob("hypeduck*")) + list((root / "assets").glob("duck-react*")):
    p.unlink()
    print("deleted", p.relative_to(root))
