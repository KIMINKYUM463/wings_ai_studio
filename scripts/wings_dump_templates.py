# -*- coding: utf-8 -*-
from pathlib import Path

t = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js").read_text(encoding="utf-8")
i = t.find('data-wings-mark="1"')
print(repr(t[i-20:i+350]))
print('====')
j = t.find('data-wings-slot=')
print(repr(t[j-20:j+280]))
