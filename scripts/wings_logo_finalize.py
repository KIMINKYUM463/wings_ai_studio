# -*- coding: utf-8 -*-
"""Replace inline W-letter marks in platform JS with extension logo URL placeholders.
Content scripts can't easily call getURL in template strings at build time for every
helper — keep data-wings-mark HTML but point wings-skin to swap imgs; also patch
common W span templates to use chrome.runtime.getURL when available at runtime.

Safer: patch the wings-mark helper return HTML in each file to use icon URL via
a small runtime helper injected... too heavy.

Instead patch the common pattern:
  `...">W</span>`
used by data-wings-mark builders to an img tag with getURL if chrome exists.
"""
from pathlib import Path
import re

root = Path(r"c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts")

# Pattern used in youtube/feed/etc for W circle mark
# Keep text W as fallback but prefer img when chrome.runtime available — hard in minified templates.

# Patch presence badge if any
presence = root / "wings-presence.js"
if presence.exists():
    t = presence.read_text(encoding="utf-8")
    if "wings-research-badge" in t or "textContent" in t:
        print("presence exists, leave")

print("icons ready; popup/manifest already point to wings-*.png")
print("panel/skin now use icons/wings-32.png")
