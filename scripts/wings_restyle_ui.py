# -*- coding: utf-8 -*-
"""Apply WINGS-distinct UI tokens to sort panel + overlay chips."""
from pathlib import Path
import re

ROOT = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")

# --- sort.css token remap ---
css_path = ROOT / "content-scripts" / "sort.css"
css = css_path.read_text(encoding="utf-8")
replacements = {
    "--background: #fff": "--background: #f3f6f5",
    "--foreground: #191f28": "--foreground: #0f1c1a",
    "--card: #fff": "--card: #fbfcfb",
    "--card-foreground: #191f28": "--card-foreground: #0f1c1a",
    "--primary: #2f7fc7": "--primary: #0f766e",
    "--secondary: #f2f4f6": "--secondary: #e4eeeb",
    "--secondary-foreground: #191f28": "--secondary-foreground: #0f1c1a",
    "--muted: #f2f4f6": "--muted: #e8efed",
    "--muted-foreground: #8b95a1": "--muted-foreground: #5b6b66",
    "--accent: #fff6dd": "--accent: #d9f3ee",
    "--accent-foreground: #a66a00": "--accent-foreground: #115e59",
    "--ring: #2f7fc7": "--ring: #0f766e",
    "--brand-50: #f1edff": "--brand-50: #ecfdf8",
    "--brand-100: #e4dcff": "--brand-100: #d1faf0",
    "--brand-500: #2f7fc7": "--brand-500: #0f766e",
    "--brand-600: #5a36e6": "--brand-600: #0d9488",
    "--point: #ffc93c": "--point: #14b8a6",
    "--point-bg: #fff4d6": "--point-bg: #ccfbf1",
    "--point-ink: #9a6800": "--point-ink: #115e59",
    "--shadow-duck: 0 6px 18px -6px #ffc93c80": "--shadow-duck: 0 6px 18px -6px #0f766e55",
    "--chart-1: #2f7fc7": "--chart-1: #0f766e",
    "--chart-2: #9a7bff": "--chart-2: #0e7490",
    "--chart-3: #c0a8ff": "--chart-3: #5eead4",
    "--chart-4: #ff8a00": "--chart-4: #0369a1",
    "--chart-5: #ffc93c": "--chart-5: #4d7c0f",
    "--chart-ring-background: #2f7fc71f": "--chart-ring-background: #0f766e1f",
    "--chart-crosshair: var(--brand-500)": "--chart-crosshair: var(--brand-500)",
}
for a, b in replacements.items():
    if a not in css:
        print("WARN missing", a[:40])
    else:
        css = css.replace(a, b)
# soften premium shadow blue tint
css = css.replace("#2f7fc72e", "#0f766e2e")
css = css.replace("#2f7fc7", "#0f766e")  # any leftover brand blue in css
css_path.write_text(css, encoding="utf-8")
print("sort.css tokens updated")

# --- sort.js: title, NC pill radius, grade colors ---
js_path = ROOT / "content-scripts" / "sort.js"
js = js_path.read_text(encoding="utf-8")

js = js.replace('ct("전체 릴스 분석","All Reels")', 'ct("WINGS 릴스 리서치","WINGS Reels Research")')
js = js.replace(
    'NC="display:inline-flex;align-items:center;gap:2px;border-radius:9999px;padding:2px 9px;font-size:13px;font-weight:700;',
    'NC="display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:3px 8px;font-size:12px;font-weight:650;letter-spacing:0.02em;font-variant-numeric:tabular-nums;border-left:3px solid #14b8a6;',
)

# grade color map _C — find and replace common HD colors used in overlays
# 폭발 blue, 강력 orange, 우수 yellow
old_grades = '폭발:{fg:"#ffffff",bg:"#2f7fc7"},강력:{fg:"#ffffff",bg:"#ff8a00"},우수:{fg:"#191f28",bg:"#ffc93c"}'
# might already be wings blue from earlier debrand
for cand in [
    '폭발:{fg:"#ffffff",bg:"#2f7fc7"},강력:{fg:"#ffffff",bg:"#ff8a00"},우수:{fg:"#191f28",bg:"#ffc93c"}',
    '폭발:{fg:"#fff",bg:"#2f7fc7"},강력:{fg:"#fff",bg:"#ff8a00"},우수:{fg:"#191f28",bg:"#ffc93c"}',
    '폭발:{fg:"#ffffff",bg:"#0f766e"},강력:{fg:"#ffffff",bg:"#ff8a00"},우수:{fg:"#191f28",bg:"#ffc93c"}',
]:
    if cand in js:
        print("found grade map variant")
        
# broader search
m = re.search(r'폭발:\{fg:"[^"]+",bg:"[^"]+"\},강력:\{fg:"[^"]+",bg:"[^"]+"\},우수:\{fg:"[^"]+",bg:"[^"]+"\}', js)
if m:
    print("grade snippet", m.group(0))
    js = js.replace(
        m.group(0),
        '폭발:{fg:"#ecfdf8",bg:"#0f766e"},강력:{fg:"#e0f2fe",bg:"#0369a1"},우수:{fg:"#f7fee7",bg:"#4d7c0f"}',
        1,
    )
else:
    print("WARN grade map not found")

# also replace rounded-full on header count if easy - many occurrences; CSS will override

# Kill brand duck component usage in header: replace mood brand with a static W via size still
# Harder. Skin JS will handle.

js_path.write_text(js, encoding="utf-8")
print("sort.js patched")

# feed.js similar chip styles if present
feed = ROOT / "content-scripts" / "feed.js"
ft = feed.read_text(encoding="utf-8")
ft2 = ft
ft2 = ft2.replace("border-radius:9999px", "border-radius:4px")
# grade colors in feed
m = re.search(r'폭발:\{fg:"[^"]+",bg:"[^"]+"\},강력:\{fg:"[^"]+",bg:"[^"]+"\},우수:\{fg:"[^"]+",bg:"[^"]+"\}', ft2)
if m:
    print("feed grade", m.group(0))
    ft2 = ft2.replace(
        m.group(0),
        '폭발:{fg:"#ecfdf8",bg:"#0f766e"},강력:{fg:"#e0f2fe",bg:"#0369a1"},우수:{fg:"#f7fee7",bg:"#4d7c0f"}',
        1,
    )
if ft2 != ft:
    feed.write_text(ft2, encoding="utf-8")
    print("feed.js patched")

# youtube too
yt = ROOT / "content-scripts" / "youtube.js"
yt_t = yt.read_text(encoding="utf-8")
yt2 = yt_t.replace("border-radius:9999px", "border-radius:4px")
m = re.search(r'폭발:\{fg:"[^"]+",bg:"[^"]+"\},강력:\{fg:"[^"]+",bg:"[^"]+"\},우수:\{fg:"[^"]+",bg:"[^"]+"\}', yt2)
if m:
    yt2 = yt2.replace(
        m.group(0),
        '폭발:{fg:"#ecfdf8",bg:"#0f766e"},강력:{fg:"#e0f2fe",bg:"#0369a1"},우수:{fg:"#f7fee7",bg:"#4d7c0f"}',
        1,
    )
    print("youtube grade patched")
if yt2 != yt_t:
    yt.write_text(yt2, encoding="utf-8")
    print("youtube.js patched")

print("done")
