# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')
i = yt.find('function NS(n)')
print('=== NS ===')
print(yt[i:i+600])
i = yt.find('function zS(n)')
print('=== zS ===')
print(yt[i:i+900])
i = yt.find('function RS(n)')
print('=== RS ===')
print(yt[i:i+350])
i = yt.find('function ro(n,')
print('=== ro ===')
print(yt[i:i+400])

# interceptor
intr = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube-interceptor.js').read_text(encoding='utf-8')
print('\n=== interceptor keys ===')
for s in ['comment', 'continuation', 'next', 'shorts', 'postMessage', 'kind']:
    print(s, intr.lower().count(s.lower()))
print(intr[:1500])
