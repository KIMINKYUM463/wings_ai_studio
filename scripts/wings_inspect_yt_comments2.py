# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')

# Find the export function and comment collection
i = yt.find('추출할 댓글이 없어요')
print('=== export context ===')
print(yt[i-1200:i+800])
print('\n=== search comment fetch ===')
for pat in [r'commentThread', r'get_comments', r'next\?pretty', r'browse\?pretty', r'rows\.push', r'authorText', r'commentRenderer', r'function .{0,5}\(.*comment', r'qt=', r'kt\(', r'loadComments', r'scrapeComment']:
    ms=list(re.finditer(pat, yt, re.I))
    print(pat, len(ms))
    if ms:
        print(repr(yt[max(0,ms[0].start()-40):ms[0].start()+140]))
