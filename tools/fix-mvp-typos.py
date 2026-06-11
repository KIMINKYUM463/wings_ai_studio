# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "app/WingsAIStudioShotForm/shortform-studio/MvpTestView.tsx"
text = p.read_text(encoding="utf-8")

text = text.replace(
    "`${L.platform.retrying} (??(최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)`",
    "`${L.platform.retrying} (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)`",
)
text = text.replace(
    "`${L.platform.retry} (${MVP_XHS_PLATFORM_RETRY_MAX}?)`",
    "`${L.platform.retry} (${MVP_XHS_PLATFORM_RETRY_MAX}회)`",
)
text = text.replace('setPickHint(parts.join(" ? "))', 'setPickHint(parts.join(" · "))')

p.write_text(text, encoding="utf-8", newline="\n")
print("typos fixed")
