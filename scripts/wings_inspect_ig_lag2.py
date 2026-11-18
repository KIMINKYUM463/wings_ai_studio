# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts')
t = (root/'interceptor.js').read_text(encoding='utf-8')
i = t.find('world:"MAIN",main(){')
print('interceptor main start:')
print(t[i:i+800])
print('====')
# find V and Q
i = t.find('function V(e)')
print(t[i-200:i+200])
print('==== coupang end/start')
t3=(root/'coupang-image-badge.js').read_text(encoding='utf-8')
# look for matches and entry near end
for key in ['matches:', 'runAt:', '.main(', 'main:', 'va={', 'createRoot', 'instagram']:
    j=t3.find(key)
    print(key, j)
print('tail', t3[-500:])
print('head', t3[:300])
