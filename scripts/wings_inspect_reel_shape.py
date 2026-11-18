# -*- coding: utf-8 -*-
from pathlib import Path
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
sort = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\sort.js').read_text(encoding='utf-8')
# find reel object fields
for pat in [r'playCount', r'likeCount', r'commentCount', r'engagementRate', r'postedAt', r'multiple', r'code:', r'username', r'takenAt', r'viewCount']:
    print(pat, sort.count(pat))

# sample around getAll subscribe
i = sort.find('hd-sort-reels')
print(sort[i-200:i+500])

# kP props
i = sort.find('function kP({reels:')
print('\nKP', sort[i:i+800])
