# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
intr = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\youtube-interceptor.js').read_text(encoding='utf-8')
# find main and source channel name
i = intr.find('main(){')
print(intr[i:i+2500])
