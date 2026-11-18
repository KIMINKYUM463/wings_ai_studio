# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')

# Find DS function definition - likely async function DS or const DS=
for pat in [r'async function DS\(', r'function DS\(', r'const DS=', r'DS=async', r'DS=e\.', r'DS=function']:
    ms=list(re.finditer(pat, yt))
    print(pat, len(ms), [m.start() for m in ms[:3]])

# Also search for 'rows:' return of comments
for pat in [r'rows:\w+', r'truncated:', r'publishedTime', r'replyCount', r'likeCount:Number', r'Innertube', r'INNERTUBE', r'ytcfg', r'continuation', r'get_comment']:
    ms=list(re.finditer(pat, yt))
    print(pat, len(ms))
    if ms:
        print(' ', repr(yt[max(0,ms[0].start()-50):ms[0].start()+180]))

# Find nearby DS( definition by searching "Fetching comments" related DS usage already known
# Search for function that returns {rows, total, truncated}
idx = yt.find('{rows:')
print('first {rows:', idx)
# find all rows: arrays related to comments
for m in re.finditer(r'return\{rows:([^}]+)\}', yt):
    print('return rows', repr(yt[m.start()-100:m.end()+40]))
