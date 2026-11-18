# -*- coding: utf-8 -*-
from pathlib import Path
import re

css_path = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.css")
css = css_path.read_text(encoding="utf-8")

token_map = {
    "background": "#f3f6f5",
    "foreground": "#0f1c1a",
    "card": "#fbfcfb",
    "card-foreground": "#0f1c1a",
    "popover-foreground": "#0f1c1a",
    "primary": "#0f766e",
    "secondary": "#e4eeeb",
    "secondary-foreground": "#0f1c1a",
    "muted": "#e8efed",
    "muted-foreground": "#5b6b66",
    "accent": "#d9f3ee",
    "accent-foreground": "#115e59",
    "ring": "#0f766e",
    "brand-50": "#ecfdf8",
    "brand-100": "#d1faf0",
    "brand-500": "#0f766e",
    "brand-600": "#0d9488",
    "point": "#14b8a6",
    "point-bg": "#ccfbf1",
    "point-ink": "#115e59",
    "chart-1": "#0f766e",
    "chart-2": "#0e7490",
    "chart-3": "#5eead4",
    "chart-4": "#0369a1",
    "chart-5": "#4d7c0f",
    "chart-ring-background": "#0f766e1f",
}

for name, val in token_map.items():
    css, n = re.subn(rf"(--{re.escape(name)}:)([^;]+);", rf"\1{val};", css, count=1)
    print(name, "replaced" if n else "MISS")

css = re.sub(r"(--shadow-duck:)([^;]+);", r"\10 6px 18px -6px #0f766e55;", css, count=1)
css = re.sub(r"(--shadow-premium:)([^;]+);", r"\10 1px 2px #0f1c1a0a, 0 8px 24px -8px #0f766e2e, 0 24px 48px -20px #0f1c1a14;", css, count=1)

css_path.write_text(css, encoding="utf-8")
print("ok")
