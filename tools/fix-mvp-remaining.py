# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "app/WingsAIStudioShotForm/shortform-studio/MvpTestView.tsx"
text = p.read_text(encoding="utf-8", errors="replace")

text = re.sub(r'placeholder="[^"]*"', "placeholder={L.keywordPlaceholder}", text, count=1)
text = text.replace(
    "const msg = e instanceof Error ? e.message : L.errors.retryFail",
    "const msg = e instanceof Error ? e.message : L.errors.retryFail",
)

# rebuild script replacements for error handlers
subs = [
    (r'setPickHint\(`[^`]+`\)', 'setPickHint(L.errors.maxPicks.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))'),
    (r'setPickHint\(`짜집기는[^`]+`\)', 'setPickHint(L.errors.maxEdit.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))'),
    (r'setPickHint\(`\$\{result\.refreshedCount\}[^`]+`\)', 'setPickHint(L.errors.urlRefreshed.replace("{count}", String(result.refreshedCount)))'),
    (r': `\$\{result\.errors\[0\]\}[^`]+`', ': L.errors.urlRefreshFail.replace("{first}", result.errors[0]).replace("{rest}", String(result.errors.length - 1))'),
    (r'parts\.push\(`\$\{result\.refreshedCount\}[^`]+`\)', 'parts.push(L.errors.urlRefreshDone.replace("{count}", String(result.refreshedCount)))'),
    (r'parts\.push\(`\$\{result\.errors\.length\}[^`]+`\)', 'parts.push(L.errors.urlRefreshErrors.replace("{count}", String(result.errors.length)))'),
    (r'setErr\(json\.error \|\| `[^`]+`\)', 'setErr(json.error || `${L.errors.sourceFail} (${res.status})`)'),
    (r'setErr\(e instanceof Error \? e\.message : "[^"]+"\)', 'setErr(e instanceof Error ? e.message : L.errors.network)'),
    (r'throw new Error\(json\.error \|\| `[^`]+`\)', 'throw new Error(json.error || `${L.errors.retryFail} (${res.status})`)'),
    (r'\(?? \$\{MVP_XHS_PLATFORM_RETRY_MAX\}\?\)', '(최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)'),
    (r'\(?? \$\{MVP_XHS_PLATFORM_RETRY_MAX\}\? ??\)', '(최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회 시도)'),
]

# fix max picks - only first occurrence with MAX_AUTO_EDIT_VIDEOS
text = re.sub(
    r'setPickHint\(`[^`]*MAX_AUTO_EDIT_VIDEOS[^`]*`\)',
    'setPickHint(L.errors.maxPicks.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))',
    text,
    count=1,
)
text = re.sub(
    r'setPickHint\(`[^`]*MAX_AUTO_EDIT_VIDEOS[^`]*`\)',
    'setPickHint(L.errors.maxEdit.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))',
    text,
    count=1,
)

for pat, rep in subs[2:]:
    text = re.sub(pat, rep, text)

text = text.replace(
    "`${L.platform.retrying} (?? ${MVP_XHS_PLATFORM_RETRY_MAX}?`)",
    "`${L.platform.retrying} (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)`",
)
text = text.replace(
    "`${L.platform.retryingEmpty} (?? ${MVP_XHS_PLATFORM_RETRY_MAX}? ??)`",
    "`${L.platform.retryingEmpty} (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회 시도)`",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("fixed remaining")
