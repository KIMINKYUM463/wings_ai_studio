# -*- coding: utf-8 -*-
from pathlib import Path
import sys,re
sys.stdout.reconfigure(encoding='utf-8')
sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
# find dH definition
for m in re.finditer(r'function dH\(|dH=function|const dH=|dH=\(', sort):
    print('at', m.start())
    print(sort[m.start():m.start()+800])
    print('====')
# also search dH=
idx=0
while True:
    j=sort.find('dH=', idx)
    if j<0: break
    print('dH= at', j, sort[max(0,j-50):j+200])
    idx=j+1
    if idx>5: break
