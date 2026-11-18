# -*- coding: utf-8 -*-
"""Point old duck-slot HTML builders at the W mark builder if possible; else leave skin."""
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")

# Pattern: empty slot span returned by helper — replace with wings-mark style span using same size var
# We can't easily rename functions across minified code, but we can replace the slot HTML template
# with the mark HTML template pattern used nearby.

slot_re = re.compile(
    r"`<span data-wings-slot=\"\$\{[^}]+\}\" data-wings-expression=\"\$\{[^}]+\}\" data-wings-size=\"\$\{([^}]+)\}\" style=\"width:\$\{\1\}px;height:\$\{\1\}px;display:inline-block;line-height:0;flex:none;\$\{[^}]+\}`></span>`"
)

# Simpler approach: for each file, find mark template and slot template
for p in root.glob("*.js"):
    t = p.read_text(encoding="utf-8")
    if "data-wings-slot=" not in t:
        continue
    # Extract mark inner style snippet once
    m = re.search(
        r'`<span data-wings-mark="1" style="([^`]{20,400})`>([^<]*)</span>`',
        t,
    )
    if not m:
        print("no mark template", p.name)
        continue
    style = m.group(1)
    # size var in mark is usually first ${n} or ${e} etc — keep as-is from mark template
    # Replace slot templates with mark template, adapting size param names is hard.
    # Instead strip slot to call same visual: replace data-wings-slot blocks with mark-like span using size from data-wings-size var.
    def repl(match):
        # match groups from a looser regex
        return match.group(0)

    # Loose replace: change slot opening to wings-mark and inject W letter content
    t2, count = re.subn(
        r'`<span data-wings-slot="\$\{([^}]+)\}" data-wings-expression="\$\{([^}]+)\}" data-wings-size="\$\{([^}]+)\}" style="width:\$\{\3\}px;height:\$\{\3\}px;display:inline-block;line-height:0;flex:none;\$\{([^}]+)\}`></span>`',
        r'`<span data-wings-mark="1" style="width:${\3}px;height:${\3}px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(145deg,#2f7fc7,#1f5f96);color:#fff;font:700 ${Math.max(8,Math.floor(\3*.45))}px/1 Pretendard,system-ui,sans-serif;\4">W</span>`',
        t,
    )
    if count:
        p.write_text(t2, encoding="utf-8")
        print(p.name, "slots->marks", count)
    else:
        # dump a short sample for debug
        i = t.find("data-wings-slot=")
        print(p.name, "no replace", repr(t[i - 5 : i + 180]))
