# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')
intr = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube-interceptor.js').read_text(encoding='utf-8')

for s in ['hd-yt', 'wings-ext', 'wings-yt', 'source!==', 'source===']:
    print('YT', s, yt.count(s))
    for m in re.finditer(re.escape(s), yt):
        print(' ', repr(yt[max(0,m.start()-40):m.start()+80]))
        if s.startswith('source'):
            break

print('INTR source const')
print(re.findall(r'const [A-Z]="[^"]+"', intr[:500]))
# how does interceptor send data to content script?
print(intr[intr.find('function d('):intr.find('function d(')+800] if 'function d(' in intr else 'no d')
# find kind data dispatch
for m in re.finditer(r'kind:"data"|kind:"cfg"|d\("data"|d\("cfg"', intr):
    print('dispatch', repr(intr[m.start()-30:m.start()+100]))
