# -*- coding: utf-8 -*-
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")
# Replace letter-W mark payloads with logo img. Match the common ending of data-wings-mark spans.
pat = re.compile(r'(data-wings-mark="1"[^>]*>)W(</span>)')

repl = (
    r'\1<img alt="WINGS" src="${chrome.runtime.getURL("icons/wings-32.png")}" '
    r'style="width:100%;height:100%;object-fit:contain;display:block;border-radius:50%"/>\2'
)

for p in root.glob("*.js"):
    t = p.read_text(encoding="utf-8")
    t2, n = pat.subn(repl, t)
    if n:
        p.write_text(t2, encoding="utf-8")
        print(p.name, n)
print("done")
