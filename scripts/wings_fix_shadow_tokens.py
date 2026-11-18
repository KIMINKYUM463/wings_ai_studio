# -*- coding: utf-8 -*-
from pathlib import Path
import re

css_path = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.css")
css = css_path.read_text(encoding="utf-8")
css = re.sub(
    r"(--shadow-duck:)([^;]+);",
    lambda m: m.group(1) + "0 6px 18px -6px #0f766e55;",
    css,
    count=1,
)
css = re.sub(
    r"(--shadow-premium:)([^;]+);",
    lambda m: m.group(1)
    + "0 1px 2px #0f1c1a0a, 0 8px 24px -8px #0f766e2e, 0 24px 48px -20px #0f1c1a14;",
    css,
    count=1,
)
css_path.write_text(css, encoding="utf-8")

# verify
for name in ["background", "point", "chart-4", "shadow-duck", "brand-500"]:
    m = re.search(rf"--{name}:([^;]+);", css)
    print(name, m.group(1) if m else None)
