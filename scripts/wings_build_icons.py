# -*- coding: utf-8 -*-
"""Build extension icons from the new WINGS research logo."""
from pathlib import Path
from PIL import Image
import re

SRC = Path(
    r"C:\Users\a\.cursor\projects\c-Users-a-Downloads-duplicate-of\assets"
    r"\c__Users_a_AppData_Roaming_Cursor_User_workspaceStorage_29e68a9c2887805b115fdb2268dcd6df_images___________.__40_-6f87cd02-9da2-42c4-95e7-ee5637ac756e.png"
)
ICONS = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\icons")
ASSETS = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\assets")
ROOT = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research")

ICONS.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
pixels = img.load()
w, h = img.size

# Make near-black background transparent (keep logo strokes)
for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        # pure/near black bg
        if r < 28 and g < 28 and b < 28:
            pixels[x, y] = (r, g, b, 0)

# Trim transparent margins
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Pad to square
side = max(img.size)
square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
ox = (side - img.size[0]) // 2
oy = (side - img.size[1]) // 2
square.paste(img, (ox, oy), img)

# Master copies
master = square.resize((512, 512), Image.Resampling.LANCZOS)
master.save(ASSETS / "wings-logo.png", optimize=True)
master.save(ICONS / "wings-logo.png", optimize=True)

for size in (16, 32, 48, 64, 128):
    out = square.resize((size, size), Image.Resampling.LANCZOS)
    out.save(ICONS / f"wings-{size}.png", optimize=True)
    print("wrote", f"wings-{size}.png", out.size)

# Also keep a solid-dark circular badge variant for light UIs (popup etc.)
badge = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
# dark circle bg
from PIL import ImageDraw
draw = ImageDraw.Draw(badge)
draw.ellipse((16, 16, 496, 496), fill=(10, 14, 20, 255))
logo512 = square.resize((512, 512), Image.Resampling.LANCZOS)
badge.alpha_composite(logo512)
badge.save(ASSETS / "wings-logo-badge.png", optimize=True)
for size in (32, 48, 128):
    badge.resize((size, size), Image.Resampling.LANCZOS).save(
        ICONS / f"wings-badge-{size}.png", optimize=True
    )

# bump version
man = ROOT / "manifest.json"
mt = man.read_text(encoding="utf-8")
mt = re.sub(r'"version": "0\.3\.65\.\d+"', '"version": "0.3.65.14"', mt)
man.write_text(mt, encoding="utf-8")
bg = ROOT / "background.js"
bt = bg.read_text(encoding="utf-8")
bt = re.sub(r'wings_version: "0\.3\.65\.\d+"', 'wings_version: "0.3.65.14"', bt)
bg.write_text(bt, encoding="utf-8")
print("version 0.3.65.14")
print("done")
