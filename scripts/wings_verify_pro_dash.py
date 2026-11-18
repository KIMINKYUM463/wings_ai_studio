# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
# find reel field assignment in sort or interceptor IG
for f in ['sort.js','interceptor.js','feed.js']:
    t=Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts')
    p=t/f if f!='interceptor.js' else Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\interceptor.js')
    if not p.exists(): continue
    s=p.read_text(encoding='utf-8')
    for pat in ['taken_at','takenAt','play_count','playCount','media_type','engagementRate','grade:']:
        if pat in s:
            i=s.find(pat)
            print(f, pat, repr(s[max(0,i-30):i+80][:110]))

man=Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\manifest.json').read_text(encoding='utf-8')
print('ver', re.search(r'"version": "[^"]+"', man).group(0))
print('has pro', 'wings-pro-dashboard' in man)
print('has chart', 'chart.umd' in man)
