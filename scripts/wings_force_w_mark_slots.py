# -*- coding: utf-8 -*-
from pathlib import Path

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")

OLD = 'return`<span data-wings-slot="${r}" data-wings-expression="${i}" data-wings-size="${n}" style="width:${n}px;height:${n}px;display:inline-block;line-height:0;flex:none;${l}"></span>`'
NEW = 'return`<span data-wings-mark="1" style="width:${n}px;height:${n}px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(145deg,#2f7fc7,#1f5f96);color:#fff;font:700 ${Math.max(8,Math.floor(n*.45))}px/1 Pretendard,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.2);${l}">W</span>`'

# feed uses e,t,n,o and different param order: (e,t,n,o) size first
# Need per-file variants from dump

variants = []
for p in root.glob("*.js"):
    t = p.read_text(encoding="utf-8")
    i = t.find("data-wings-slot=")
    if i < 0:
        continue
    # extract full return`...` statement
    start = t.rfind("return`", 0, i)
    end = t.find("</span>`", i)
    if start < 0 or end < 0:
        print("parse fail", p.name)
        continue
    end += len("</span>`")
    old = t[start:end]
    # detect size var: data-wings-size="${X}"
    import re
    m = re.search(r'data-wings-size="\$\{([^}]+)\}"', old)
    style_extra = re.search(r"flex:none;\$\{([^}]+)\}", old)
    if not m or not style_extra:
        print("vars fail", p.name, old[:120])
        continue
    size = m.group(1)
    extra = style_extra.group(1)
    new = (
        'return`<span data-wings-mark="1" style="width:${'
        + size
        + "}px;height:${"
        + size
        + "}px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(145deg,#2f7fc7,#1f5f96);color:#fff;font:700 ${Math.max(8,Math.floor("
        + size
        + '*.45))}px/1 Pretendard,system-ui,sans-serif;box-shadow:0 1px 2px rgba(0,0,0,.2);${'
        + extra
        + '}">W</span>`'
    )
    t2 = t[:start] + new + t[end:]
    p.write_text(t2, encoding="utf-8")
    print("ok", p.name, "size", size)
