# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")
# bump version
man = root / "manifest.json"
t = man.read_text(encoding="utf-8")
t2 = t.replace('"version": "0.3.65.7"', '"version": "0.3.65.8"')
man.write_text(t2, encoding="utf-8")
print("manifest", "0.3.65.8" in t2)

bg = root / "background.js"
bt = bg.read_text(encoding="utf-8")
bt = bt.replace('wings_version: "0.3.65.7"', 'wings_version: "0.3.65.8"')
bg.write_text(bt, encoding="utf-8")

# final scan
patterns = [
    r"하입덕",
    r"HypeDuck",
    r"hypeduck\.ai",
    r"(?i)hypeduck(?!Overlay)",  # allow legacy storage key names only
    r"#6[Dd]4[Aa][Ff][Ff]",
    r"youtube\.com/pricing",
    r"data-duck-mood\"]\)",
]
for p in root.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".js", ".css", ".html", ".json", ".svg", ".md"}:
        continue
    text = p.read_text(encoding="utf-8", errors="replace")
    hits = []
    for pat in patterns:
        ms = re.findall(pat, text)
        if ms:
            hits.append((pat, len(ms), list(dict.fromkeys(ms))[:3]))
    if hits:
        print(p.relative_to(root))
        for h in hits:
            print(" ", h)

# list expression pngs still present
assets = root / "assets"
if assets.exists():
    expr = list(assets.rglob("*hypeduck*")) + list(assets.rglob("*expression*"))
    print("asset leftovers", len(expr))
    for e in expr[:20]:
        print(" ", e.relative_to(root))
