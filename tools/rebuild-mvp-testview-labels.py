# -*- coding: utf-8 -*-
"""Replace corrupted inline Korean in MvpTestView.tsx with L.* label references."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "app/WingsAIStudioShotForm/shortform-studio/MvpTestView.tsx"
text = p.read_text(encoding="utf-8", errors="replace")

IMPORT = """import {
  formatProductSourceLabel,
  formatSearchRetryNotice,
  formatVideoPickLabel,
  MVP_LABELS as L,
} from "./mvp-test-view-labels\""""

text = re.sub(
    r'import \{ MVP_LABELS as L \} from "\./mvp-test-view-labels"',
    IMPORT,
    text,
    count=1,
)
if "formatVideoPickLabel" not in text:
    text = text.replace(
        'import { MVP_LABELS as L } from "./mvp-test-view-labels"',
        IMPORT,
        1,
    )

# --- SourceVideoCard title ---
text = re.sub(
    r'title=\{\s*presenterLikely\s*\?[^}]+\}',
    """title={
              presenterLikely
                ? L.videoCard.presenterTitle
                : selected
                  ? L.videoCard.deselect
                  : L.videoCard.add
            }""",
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace(
    '{isDouyin ? "??" : "???"}',
    "{isDouyin ? L.videoCard.douyin : L.videoCard.xhs}",
)
text = re.sub(
    r'<span className="pointer-events-none absolute left-2 top-8[^>]*>\s*[^<]+\s*</span>',
    '<span className="pointer-events-none absolute left-2 top-8 rounded bg-amber-950/90 px-1 py-0.5 text-[9px] text-amber-200">\n            {L.videoCard.presenterBadge}\n          </span>',
    text,
    count=1,
)

text = re.sub(r"<span>\?\? \{durationLabel\}</span>", "<span>{L.videoCard.length} {durationLabel}</span>", text)
text = re.sub(r"<span>\?\? \{formatCount\(video\.viewCount\)\}</span>", "<span>{L.videoCard.views} {formatCount(video.viewCount)}</span>", text)
text = re.sub(r"<span>\?\?\? \{formatCount\(video\.likeCount\)\}</span>", "<span>{L.videoCard.likes} {formatCount(video.likeCount)}</span>", text)
text = re.sub(
    r"\?\?\? \{video\.relevanceScore\}",
    "{L.videoCard.relevance} {video.relevanceScore}",
    text,
)

text = re.sub(
    r'<ExternalLink className="h-3 w-3" />\s*\?\? \?\?',
    '<ExternalLink className="h-3 w-3" />\n            {L.videoCard.openOriginal}',
    text,
)

# --- PlatformResultSection header ---
text = re.sub(
    r'<p className=\{studio\.label\}>\s*\{isDouyin \? "[^"]+" : "[^"]+"\}[^<]*</p>',
    """<p className={studio.label}>
          {isDouyin ? L.platform.douyinTitle : L.platform.xhsTitle} · {L.platform.videoCount}{" "}
          {result.videos.length}
          {L.platform.countUnit}
        </p>""",
    text,
    count=1,
)

# retry buttons - replace whole Button children blocks
text = re.sub(
    r'\{retrying \? \(\s*<>\s*<Loader2[^}]+\{isDouyin \? "[^"]+" : `[^`]+`\}\s*</>\s*\) : \(\s*<>\s*<RefreshCw[^}]+\{isDouyin \? "[^"]+" : `[^`]+`\}\s*</>\s*\)\}',
    """{retrying ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {isDouyin
                ? L.platform.retrying
                : `${L.platform.retrying} (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)`}
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {isDouyin
                ? L.platform.retry
                : `${L.platform.retry} (${MVP_XHS_PLATFORM_RETRY_MAX}회)`}
            </>
          )}""",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r'\{isDouyin \? "[^"]+" : `[^`]+`\}\s*</div>\s*\) : empty \? \(',
    """{isDouyin
            ? L.platform.retryingEmpty
            : `${L.platform.retryingEmpty} (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회 시도)`}
        </div>
      ) : empty ? (""",
    text,
    count=1,
)

text = re.sub(
    r'<p className="text-sm text-slate-500">[^<]{3,40}</p>\s*<p className="mt-1 text-xs text-slate-600">\s*\{isDouyin\s*\? "[^"]+"\s*: `[^`]+`\}',
    """<p className="text-sm text-slate-500">{L.platform.empty}</p>
          <p className="mt-1 text-xs text-slate-600">
            {isDouyin
              ? L.platform.emptyDouyin
              : L.platform.emptyXhs.replace("{max}", String(MVP_XHS_PLATFORM_RETRY_MAX))}""",
    text,
    count=1,
    flags=re.DOTALL,
)

# --- formatSaveError ---
text = re.sub(r'return "[^"]*저장[^"]*\.?"', 'return L.errors.saveFailed', text)
text = re.sub(r'return "\?\?\?[^"]*"', 'return L.errors.saveFailed', text)

# --- keyword hint paragraph ---
text = re.sub(
    r'<p className="mt-4 text-xs text-slate-500">\s*[^<]{10,300}</p>\s*<label className="mt-3 flex items-center',
    '<p className="mt-4 text-xs text-slate-500">{L.keywordHint}</p>\n\n            <label className="mt-3 flex items-center',
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace('placeholder={"??? ???\\n?? ?? ???"}', 'placeholder={"차량용 청소기\\n무선 차량 청소기"}')
text = text.replace('placeholder="?: ??? ???"', 'placeholder="예: 차량용 청소기"')
text = re.sub(r"\{p\.ko\} \? <span", "{p.ko} → <span", text)

# --- notice on retry ---
text = re.sub(
    r"notice: `[^`]+`,",
    "notice: formatSearchRetryNotice(prev.searchQueries, next.douyin.videos.length, next.xhs.videos.length),",
    text,
    count=1,
)

# --- Step badge grids ---
DIRECT_GRID = """          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.urlInput} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.urlResolve} />
            <StepBadge done={stepsDone.s3} n={3} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s4} n={4} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.thumbnail} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>"""

PRODUCT_GRID = """          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.productUrl} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.aiAnalysis} />
            <StepBadge done={stepsDone.s3} n={3} label={formatProductSourceLabel(productSearchResult.results.length)} />
            <StepBadge done={stepsDone.s4} n={4} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>"""

KEYWORD_GRID = """            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StepBadge done={stepsDone.s1} n={1} label={L.steps.keywordInput} />
              <StepBadge done={stepsDone.s2} n={2} label={L.steps.zhConvert} />
              <StepBadge done={stepsDone.s3} n={3} label={L.steps.sourceSearch} />
              <StepBadge done={stepsDone.s4} n={4} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
              <StepBadge done={stepsDone.s5} n={5} label={L.steps.aiEdit} />
              <StepBadge done={stepsDone.s6} n={6} label={L.steps.videoEdit} />
              <StepBadge done={stepsDone.s7} n={7} label={L.steps.scriptSubtitle} />
              <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
            </div>"""

text = re.sub(
    r'<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">.*?</div>',
    DIRECT_GRID,
    text,
    count=1,
    flags=re.DOTALL,
)
text = re.sub(
    r'<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">.*?</div>',
    PRODUCT_GRID,
    text,
    count=1,
    flags=re.DOTALL,
)
text = re.sub(
    r'<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">.*?</div>',
    KEYWORD_GRID,
    text,
    count=1,
    flags=re.DOTALL,
)

# error strings -> L.errors
replacements = [
    (r'setSaveError\("[^"]+"\)', 'setSaveError(L.errors.noUserId)'),
    (r'setPickHint\("[^"]+"\)', 'setPickHint(L.errors.presenterPick)'),
    (r'setPickHint\(`[^`]+`\)', None),  # handle separately
    (r'setErr\("[^"]+"\)', None),
    (r'const msg = "[^"]+"', None),
    (r'setErr\(json\.error \|\| `[^`]+`\)', 'setErr(json.error || `${L.errors.sourceFail} (${res.status})`)'),
    (r'setErr\(e instanceof Error \? e\.message : "[^"]+"\)', 'setErr(e instanceof Error ? e.message : L.errors.network)'),
    (r'throw new Error\(json\.error \|\| `[^`]+`\)', 'throw new Error(json.error || `${L.errors.retryFail} (${res.status})`)'),
    (r'const msg = e instanceof Error \? e\.message : "[^"]+"', 'const msg = e instanceof Error ? e.message : L.errors.retryFail'),
]

text = re.sub(r'setSaveError\("로그인[^"]+"\)|setSaveError\("\?\?\?[^"]+"\)', 'setSaveError(L.errors.noUserId)', text)
text = re.sub(
    r'setPickHint\("口播[^"]+"\)|setPickHint\("\?\?[^"]+"\)',
    'setPickHint(L.errors.presenterPick)',
    text,
)
text = re.sub(
    r'setPickHint\(`최대 \$\{MAX_AUTO_EDIT_VIDEOS\}[^`]+`\)',
    'setPickHint(L.errors.maxPicks.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))',
    text,
)
text = re.sub(
    r'setPickHint\(`짜집기는[^`]+`\)',
    'setPickHint(L.errors.maxEdit.replace("{max}", String(MAX_AUTO_EDIT_VIDEOS)))',
    text,
)
text = re.sub(
    r'setErr\("키워드를[^"]+"\)|setErr\("\?\?\?\?[^"]+"\)',
    'setErr(L.errors.keywordRequired)',
    text,
)
text = re.sub(
    r'setErr\("ShotForm 설정에서 OpenAI[^"]+"\)|setErr\("ShotForm \?\?\?\? OpenAI[^"]+"\)',
    'setErr(L.errors.openaiKey)',
    text,
)
text = re.sub(
    r'setErr\("ShotForm 설정에서 소스[^"]+"\)|setErr\("ShotForm \?\?\?\?[^"]+apify[^"]+"\)',
    'setErr(L.errors.apifyToken)',
    text,
)
text = re.sub(
    r'setErr\("먼저[^"]+"\)|setErr\("\?\? \?\?\?\?\?[^"]+"\)',
    'setErr(L.errors.searchFirst)',
    text,
)
text = re.sub(
    r'const msg = "소스 검색[^"]+"|const msg = "\?\? \?\?[^"]+"',
    'const msg = L.errors.apifyRequired',
    text,
)

p.write_text(text, encoding="utf-8")
remaining = len(re.findall(r"\?\?+", text))
print(f"Wrote {p} - remaining ?? clusters: {remaining}")
