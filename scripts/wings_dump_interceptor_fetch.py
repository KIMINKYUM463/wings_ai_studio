# -*- coding: utf-8 -*-
from pathlib import Path
import sys
sys.stdout.reconfigure(encoding='utf-8')
t = Path(r'c:\Users\a\Downloads\duplicate-of\extensions\wings-research\content-scripts\interceptor.js').read_text(encoding='utf-8')
i = t.find('if(V(location.pathname))return;window.fetch=')
print(t[i:i+2500])
