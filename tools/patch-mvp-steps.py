# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "app/WingsAIStudioShotForm/shortform-studio/MvpTestView.tsx"
text = p.read_text(encoding="utf-8", errors="replace")

DIRECT = """          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.urlInput} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.urlResolve} />
            <StepBadge done={stepsDone.s3} n={3} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s4} n={4} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.thumbnail} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>"""

PRODUCT = """          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label={L.steps.productUrl} />
            <StepBadge done={stepsDone.s2} n={2} label={L.steps.aiAnalysis} />
            <StepBadge done={stepsDone.s3} n={3} label={formatProductSourceLabel(productSearchResult.results.length)} />
            <StepBadge done={stepsDone.s4} n={4} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
            <StepBadge done={stepsDone.s5} n={5} label={L.steps.aiEdit} />
            <StepBadge done={stepsDone.s6} n={6} label={L.steps.videoEdit} />
            <StepBadge done={stepsDone.s7} n={7} label={L.steps.scriptSubtitle} />
            <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
          </div>"""

KEYWORD = """            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StepBadge done={stepsDone.s1} n={1} label={L.steps.keywordInput} />
              <StepBadge done={stepsDone.s2} n={2} label={L.steps.zhConvert} />
              <StepBadge done={stepsDone.s3} n={3} label={L.steps.sourceSearch} />
              <StepBadge done={stepsDone.s4} n={4} label={formatVideoPickLabel(editPicks.length, MAX_AUTO_EDIT_VIDEOS)} />
              <StepBadge done={stepsDone.s5} n={5} label={L.steps.aiEdit} />
              <StepBadge done={stepsDone.s6} n={6} label={L.steps.videoEdit} />
              <StepBadge done={stepsDone.s7} n={7} label={L.steps.scriptSubtitle} />
              <StepBadge done={stepsDone.s8} n={8} label={L.steps.export} />
            </div>"""

GRID_RE = r'<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">.*?</div>'

text = re.sub(
    rf'\{{sourceMode === "direct_url" && editPicks\.length > 0 \? \(\s*<StudioPageCard className="bg-white/\[0\.02\]">\s*{GRID_RE}',
    '{sourceMode === "direct_url" && editPicks.length > 0 ? (\n        <StudioPageCard className="bg-white/[0.02]">\n' + DIRECT,
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    rf'\{{sourceMode === "product_url" && productSearchResult \? \(\s*<StudioPageCard className="bg-white/\[0\.02\]">\s*{GRID_RE}',
    '{sourceMode === "product_url" && productSearchResult ? (\n        <StudioPageCard className="bg-white/[0.02]">\n' + PRODUCT,
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    rf'\{{sourceMode === "keyword" && data \? \(\s*<>\s*<StudioPageCard className="bg-white/\[0\.02\]">\s*{GRID_RE}',
    '{sourceMode === "keyword" && data ? (\n        <>\n          <StudioPageCard className="bg-white/[0.02]">\n' + KEYWORD,
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r'<p className="mt-4 text-xs text-slate-500">\s*[^<{][^<]{5,300}</p>\s*<label className="mt-3 flex items-center gap-2 text-sm text-slate-300">',
    '<p className="mt-4 text-xs text-slate-500">{L.keywordHint}</p>\n\n            <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">',
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace(
    'const msg = e instanceof Error ? e.message : "영상에 추가"',
    "const msg = e instanceof Error ? e.message : L.errors.retryFail",
)

p.write_text(text, encoding="utf-8", newline="\n")
print("patched OK")
