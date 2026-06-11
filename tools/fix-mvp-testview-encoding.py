# -*- coding: utf-8 -*-
"""Restore Korean UI strings in MvpTestView.tsx (encoding corruption fix)."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / "app/WingsAIStudioShotForm/shortform-studio/MvpTestView.tsx"
text = p.read_text(encoding="utf-8", errors="replace").replace("\ufffd", "·")

def R(old, new):
    global text
    if old in text:
        text = text.replace(old, new)

R('if (n == null || !Number.isFinite(n)) return "?"', 'if (n == null || !Number.isFinite(n)) return "—"')
R('return "??? ??????."', 'return "저장에 실패했습니다."')

for old, new in [
    ('? "??·??? ?? ?? (??? ??)"', '? "口播·블로거 소개 영상 (짜집기 제외)"'),
    ('? "?????? ?? ?? (??? ??)"', '? "口播·블로거 소개 영상 (짜집기 제외)"'),
    ('? "?? ??"', '? "선택 해제"'),
    (': "??? ??"', ': "영상에 추가"'),
    ('{isDouyin ? "??" : "???"}', '{isDouyin ? "抖音" : "小红书"}'),
    ("            ?? ??\n          </span>", "            口播 추정\n          </span>"),
]:
    R(old, new)

R("<span>?? {durationLabel}</span>", "<span>길이 {durationLabel}</span>")
R("<span>?? {formatCount(video.viewCount)}</span>", "<span>조회 {formatCount(video.viewCount)}</span>")
R("<span>??? {formatCount(video.likeCount)}</span>", "<span>좋아요 {formatCount(video.likeCount)}</span>")
R("              ??? {video.relevanceScore}", "              관련도 {video.relevanceScore}")
R("            ?? ??\n          </a>", "            원본 보기\n          </a>")

R('{isDouyin ? "?? Douyin" : "??? XHS"} · ?? {result.videos.length}?', '{isDouyin ? "抖音 Douyin" : "小红书 XHS"} · 영상 {result.videos.length}건')
R('{isDouyin ? "?? Douyin" : "??? XHS"} ? ?? {result.videos.length}?', '{isDouyin ? "抖音 Douyin" : "小红书 XHS"} · 영상 {result.videos.length}건')

for a,b in [
    ('{isDouyin ? "?? ?? ?" : `?? ?? ? (?? ${MVP_XHS_PLATFORM_RETRY_MAX}?)`}', '{isDouyin ? "다시 찾는 중" : `다시 찾는 중 (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회)`}'),
    ('{isDouyin ? "?? ?? ??" : `?? ?? ?? (${MVP_XHS_PLATFORM_RETRY_MAX}?)`}', '{isDouyin ? "다시 소스 찾기" : `다시 소스 찾기 (${MVP_XHS_PLATFORM_RETRY_MAX}회)`}'),
    ('{isDouyin ? "?? ?? ?? ?" : `?? ?? ?? ? (?? ${MVP_XHS_PLATFORM_RETRY_MAX}? ??)`}', '{isDouyin ? "다시 소스 찾는 중" : `다시 소스 찾는 중 (최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회 시도)`}'),
]:
    R(a,b)

R("??? ??? ????.", "표시할 영상이 없습니다.")
R('? "??? ?? ???? ??? ?? ???? ?? ?????."', '? "「다시 소스 찾기」를 누르면 같은 검색어로 다시 시도합니다."')
R('`??? ?? ???? ?? ${MVP_XHS_PLATFORM_RETRY_MAX}??? ???? ? ????.`', '`「다시 소스 찾기」로 최대 ${MVP_XHS_PLATFORM_RETRY_MAX}회까지 재시도할 수 있습니다.`')

R('setSaveError("??? ??? ID? ????. ?? ??? ? ??? ???.")', 'setSaveError("로그인 사용자 ID가 없습니다. 다시 로그인 후 시도해 주세요.")')
R('setPickHint("??·??? ?? ??? ???? ?? ? ????. ?? ??? ?? ???.")', 'setPickHint("口播·블로거 소개 영상은 짜집기에 넣을 수 없습니다. 다른 영상을 골라 주세요.")')
R('setPickHint("?????? ?? ??? ???? ?? ? ????. ?? ??? ?? ???.")', 'setPickHint("口播·블로거 소개 영상은 짜집기에 넣을 수 없습니다. 다른 영상을 골라 주세요.")')
R('setPickHint(`?? ${MAX_AUTO_EDIT_VIDEOS}???? ??? ? ????.`)', 'setPickHint(`최대 ${MAX_AUTO_EDIT_VIDEOS}개까지만 선택할 수 있습니다.`)')
R('setPickHint(`???? ?? ${MAX_AUTO_EDIT_VIDEOS}? ????? ?????.`)', 'setPickHint(`짜집기는 최대 ${MAX_AUTO_EDIT_VIDEOS}개 영상까지만 가능합니다.`)')
R('setPickHint(`${result.refreshedCount}? ??? ??? URL? ??????.`)', 'setPickHint(`${result.refreshedCount}개 영상의 만료된 URL을 갱신했습니다.`)')
R(': `${result.errors[0]} ? ${result.errors.length - 1}? URL ?? ??`', ': `${result.errors[0]} 외 ${result.errors.length - 1}개 URL 갱신 실패`')
R('parts.push(`${result.refreshedCount}? URL ?? ??`)', 'parts.push(`${result.refreshedCount}개 URL 갱신 완료`)')
R('parts.push(`${result.errors.length}? ?? ??`)', 'parts.push(`${result.errors.length}개 갱신 실패`)')
R('parts.join("  ")', 'parts.join(" · ")')

R('setErr("???? ??? ???.")', 'setErr("키워드를 입력해 주세요.")')
R('setErr("ShotForm ???? OpenAI API ?? ??? ???.")', 'setErr("ShotForm 설정에서 OpenAI API 키를 저장해 주세요.")')
R('setErr("ShotForm ???? ?? ?? ??(shotform_apify_token)? ??? ???.")', 'setErr("ShotForm 설정에서 소스 검색 토큰(shotform_apify_token)을 저장해 주세요.")')
R('setErr(json.error || `?? ?? ?? (${res.status})`)', 'setErr(json.error || `소스 찾기 실패 (${res.status})`)')
R('setErr(e instanceof Error ? e.message : "???? ??")', 'setErr(e instanceof Error ? e.message : "네트워크 오류")')
R('setErr("?? ????? ??? ???.")', 'setErr("먼저 소스찾기를 실행해 주세요.")')
R('const msg = "?? ?? ??? ?????."', 'const msg = "소스 검색 토큰이 필요합니다."')
R('throw new Error(json.error || `??? ?? (${res.status})`)', 'throw new Error(json.error || `재시도 실패 (${res.status})`)')
R('const msg = e instanceof Error ? e.message : "??? ??"', 'const msg = e instanceof Error ? e.message : "재시도 실패"')
R("notice: `??? '${prev.searchQueries.join('  ')}' ? ?? ${next.douyin.videos.length}?  ??? ${next.xhs.videos.length}?`,",
  "notice: `검색어 '${prev.searchQueries.join(' · ')}' — 抖音 ${next.douyin.videos.length}건 · 小红书 ${next.xhs.videos.length}건`,")

R('<p className={studio.label}>1. ?? ??</p>', '<p className={studio.label}>1. 소스 찾기</p>')
R("            ???? ?? ??\n          </button>", "            키워드로 소스 찾기\n          </button>")
R("            ?? URL ?? (Lite)\n          </button>", "            상품 URL 검색 (Lite)\n          </button>")
R("            URL ?? ?? (????, ?? 3?)\n          </button>", "            URL 직접 입력 (多源混剪, 최대 3개)\n          </button>")
R('<span>?? ??? (??????)</span>', '<span>여러 키워드 (줄바꿈·쉼표)</span>')
R('placeholder={"??? ???\\n?? ?? ???"}', 'placeholder={"차량용 청소기\\n무선 차량 청소기"}')
R('placeholder="?: ??? ???"', 'placeholder="예: 차량용 청소기"')
R('<p className="mt-2 text-xs text-slate-500">?? ?? ??</p>', '<p className="mt-2 text-xs text-slate-500">中文 변환 중…</p>')
R("{p.ko} ? <span", "{p.ko} → <span")
R("                    ?? ?? ??\n                  </>", "                    소스 찾는 중…\n                  </>")
R("                    ????\n                  </>", "                    소스찾기\n                  </>")

# keyword description paragraph - fuzzy
text = re.sub(
    r'<p className="mt-4 text-xs text-slate-500">\s*[^<]{10,200}</p>',
    """<p className="mt-4 text-xs text-slate-500">
              한국어로 입력하면 GPT가 간체 中文로 바꿉니다. 「소스찾기」를 누르면 抖音·小红书에서 비슷한 영상을
              동시에 찾습니다.
            </p>""",
    text,
    count=1,
)

text = re.sub(
    r'<span className="text-xs text-slate-500">OpenAI[^<]+</span>',
    '<span className="text-xs text-slate-500">OpenAI + Apify 토큰 필요</span>',
    text,
    count=1,
)

text = re.sub(
    r'<p className="mt-2 text-xs text-amber-400/90">OpenAI[^<]+</p>',
    '<p className="mt-2 text-xs text-amber-400/90">OpenAI 키 저장 시 中文 변환 미리보기가 표시됩니다.</p>',
    text,
    count=1,
)

text = re.sub(
    r'<p className="mt-3 text-xs text-slate-500">\s*[^<]{40,400}</p>\s*<MvpDirectUrlPickPanel',
    """<p className="mt-3 text-xs text-slate-500">
              抖音·小红书 URL을 입력한 뒤 「URL 해석」으로 영상을 확인하세요. 하단 「AI 짜집기」로 편집을 시작합니다.
              기본 2칸, + 버튼으로 최대 3개까지 넣을 수 있으며, 짜집기는 버튼을 눌러야 시작됩니다.
            </p>
            <MvpDirectUrlPickPanel""",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r'<span>[^<]{5,80}Apify[^<]{5,40}</span>',
    '<span>抖音 · 小红书 Apify 검색 중… (최대 수 분)</span>',
    text,
    count=1,
)

DIRECT = """          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <StepBadge done={stepsDone.s1} n={1} label="URL 입력" />
            <StepBadge done={stepsDone.s2} n={2} label="URL 해석" />
            <StepBadge done={stepsDone.s3} n={3} label={`영상 선택 (${editPicks.length}/${MAX_AUTO_EDIT_VIDEOS})`} />
            <StepBadge done={stepsDone.s4} n={4} label="AI 짜집기" />
            <StepBadge done={stepsDone.s5} n={5} label="영상 편집" />
            <StepBadge done={stepsDone.s6} n={6} label="자막·대본" />
            <StepBadge done={stepsDone.s7} n={7} label="썸네일" />
            <StepBadge done={stepsDone.s8} n={8} label="보내기" />
          </div>"""
PRODUCT = DIRECT.replace("URL 입력", "상품 URL", 1).replace('label="URL 해석"', 'label="AI 분석"').replace(
    'label={`영상 선택 (${editPicks.length}/${MAX_AUTO_EDIT_VIDEOS})`}',
    'label={`소스 수집 (${productSearchResult.results.length})`}',
    1,
).replace(
    'label="AI 짜집기"',
    'label={`영상 선택 (${editPicks.length}/${MAX_AUTO_EDIT_VIDEOS})`}',
    1,
)
KEYWORD = """            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
              <StepBadge done={stepsDone.s1} n={1} label="키워드 입력" />
              <StepBadge done={stepsDone.s2} n={2} label="中文 변환" />
              <StepBadge done={stepsDone.s3} n={3} label="소스 검색" />
              <StepBadge done={stepsDone.s4} n={4} label={`영상 선택 (${editPicks.length}/${MAX_AUTO_EDIT_VIDEOS})`} />
              <StepBadge done={stepsDone.s5} n={5} label="영상 편집" />
              <StepBadge done={stepsDone.s6} n={6} label="자막·대본" />
              <StepBadge done={stepsDone.s7} n={7} label="썸네일" />
              <StepBadge done={stepsDone.s8} n={8} label="보내기" />
            </div>"""

for mode, grid in [("direct_url", DIRECT), ("product_url", PRODUCT), ("keyword", KEYWORD)]:
    text = re.sub(
        rf'\{{sourceMode === "{mode}"[^}}]+\? \(\s*<>\s*<StudioPageCard className="bg-white/\[0\.02\]">\s*<div className="grid gap-2[^"]*">.*?</div>',
        rf'{{sourceMode === "{mode}" && {"editPicks.length > 0" if mode=="direct_url" else ("productSearchResult" if mode=="product_url" else "data")} ? (\n        <>\n          <StudioPageCard className="bg-white/[0.02]">\n' + grid,
        text,
        count=1,
        flags=re.DOTALL,
    )

# simpler block replace for step grids
text = re.sub(
    r'<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">\s*<StepBadge done=\{stepsDone\.s1\}.*?</div>',
    DIRECT,
    text,
    count=3,
    flags=re.DOTALL,
)

p.write_text(text, encoding="utf-8")
print("OK", p)
