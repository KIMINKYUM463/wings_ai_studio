# -*- coding: utf-8 -*-
from pathlib import Path
import re
import sys
sys.stdout.reconfigure(encoding='utf-8')

root = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research')
yt = (root/'content-scripts'/'youtube.js').read_text(encoding='utf-8')

needles = [
    '추출할 댓글이 없어요',
    '댓글 내보내기',
    'CSV',
    'Excel',
    'comment',
    'Comments',
    'ytd-comment',
    'shorts',
    'exportComment',
    'EXPORT',
    '댓글이',
]
for n in needles:
    ms = list(re.finditer(re.escape(n), yt, re.I))
    print(n, len(ms))
    for m in ms[:3]:
        i=m.start()
        print(' ', repr(yt[max(0,i-80):i+160]))

# also search background
bg = (root/'background.core.js').read_text(encoding='utf-8')
for n in ['댓글', 'comment', 'EXPORT', 'CSV', 'Excel']:
    ms=list(re.finditer(re.escape(n), bg, re.I))
    if ms:
        print('BG', n, len(ms))
        print(' ', repr(bg[max(0,ms[0].start()-60):ms[0].start()+120]))
