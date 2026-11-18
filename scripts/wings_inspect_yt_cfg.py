# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

intr = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube-interceptor.js').read_text(encoding='utf-8')
# dump more of interceptor around cfg/apiKey
for pat in ['apiKey', 'INNERTUBE', 'kind:"cfg"', 'ytcfg', 'clientName', 'WEB', 'context']:
    for m in re.finditer(pat, intr):
        print(pat, repr(intr[max(0,m.start()-50):m.start()+120]))
        break

print('==== full interceptor length', len(intr))
# print sections mentioning postMessage payload
for m in re.finditer(r'postMessage\(\{[^}]{0,400}', intr):
    print('PM', m.group(0)[:300])

yt = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube.js').read_text(encoding='utf-8')
# message handler for cfg
i = yt.find('bt.kind==="cfg"')
print('==== cfg handler', yt[i-200:i+400])
i = yt.find('It){const kt=NS(bt.json)')
print('==== NS set', yt[i-300:i+200])

# credentials in DS fetch?
i = yt.find('async function DS(')
print('==== DS fetch', yt[i:i+700])
