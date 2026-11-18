# -*- coding: utf-8 -*-
from pathlib import Path
t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\feed.js").read_text(encoding="utf-8")
for s in ["function Pi(e)", "z&&Pi(location.pathname)?Ba():Wo()", "if(!Pi(location.pathname))return", "za()||Xo()||$n()"]:
    print(s, s in t)
# show mt and Ua snippets
i=t.find("function mt()")
print("mt", t[i:i+90])
i=t.find("function Ua()")
print("ua", t[i:i+180])
i=t.find("function Pi(e)")
print("pi", t[i:i+200])
