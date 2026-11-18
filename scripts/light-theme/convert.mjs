// node scripts/light-theme/convert.mjs [--write] [--base <git ref>]
// 원래 다크 UI였던 파일의 "직접 지정한 색"을 밝은 테마 색으로 바꾼다.
//  - TSX: bg-[#0a0b0d] 같은 Tailwind 임의값 색 클래스, shadow-[...] 의 검은 그림자
//  - CSS: 색 값 전부 (text-shadow·filter, 색 견본·라이트박스 규칙은 제외)
// --base 없이 이미 변환된 파일에 다시 돌리면 색이 두 번 뒤집히므로, 재실행은 다크 원본 커밋을 --base 로 준다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COLOR_TOKEN_RE, convertColorToken, isNearWhite, isVividSurface, softenShadowColor } from './color.mjs'

const WRITE = process.argv.includes('--write')

const TSX_ROOTS = ['app/WingsAIStudioShotForm', 'app/main', 'app/moneytaker/blog-ai']
const TSX_SKIP_DIRS = ['shopping', 'ai-editor', 'youtube-analytics', 'youtube-trends'].map((d) =>
  path.normalize(`app/WingsAIStudioShotForm/${d}`),
)
const CSS_FILES = [
  'app/WingsAIStudio/longform-v2/longform-v2.css',
  'app/WingsAIStudio/longform-v2/styles/thumbnail-template-studio.css',
  'app/WingsAIStudio/longform-v2/styles/thumbnail-verification.css',
  'app/WingsAIStudioShotForm/shortform-studio/MvpPostEditStudio.module.css',
]

const COLOR_UTILITY =
  '(?:bg|from|via|to|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|outline|divide|decoration|accent|caret|placeholder)'
const CLASS_COLOR_RE = new RegExp(`(?<![\\w-])(${COLOR_UTILITY}-\\[)(#[0-9a-fA-F]{3,8}|(?:rgba?|oklch)\\([^\\]\\s"'\`]*\\))(\\])`, 'g')

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (!TSX_SKIP_DIRS.includes(path.normalize(full))) walk(full, out)
    } else if (/\.(tsx|ts)$/.test(ent.name)) out.push(full)
  }
  return out
}

const SHADOW_CLASS_RE = /(?<![\w-])(shadow-\[)([^\]\s"'`]+)(\])/g

const VIVID_BG_CLASS_RE = /(?<![\w-])(?:bg|from|via|to)-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]\s"'`]*\))\]/g

// 진한 면(임의값 배경) 위 text-white 는 리맵으로 진한 글자가 되지 않도록 고정 흰색으로 바꾼다.
const pinWhiteTextOnVivid = (src) =>
  src.replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, (str) => {
    const vivid = [...str.matchAll(VIVID_BG_CLASS_RE)].some((m) => isVividSurface(m[1].replace(/_/g, ' ')))
    return vivid ? str.replace(/(?<![\w:-])text-white(?![\w/-])/g, 'text-[#fff]') : str
  })

function convertTsx(src) {
  let n = 0
  const out = pinWhiteTextOnVivid(src)
    .replace(CLASS_COLOR_RE, (_, pre, color, post) => {
      n++
      const surface = /^(bg|from|via|to)-/.test(pre)
      const converted = convertColorToken(color.replace(/_/g, ' '), { surface })
      return pre + converted.replace(/,\s*/g, ',').replace(/\s+/g, '_') + post
    })
    .replace(SHADOW_CLASS_RE, (m, pre, value, post) => {
      const v = value.replace(COLOR_TOKEN_RE, softenShadowColor)
      if (v !== value) n++
      return pre + v + post
    })
  return [out, n]
}

// text-shadow·drop-shadow 는 영상 위 자막 가독성용이라 건드리지 않는다.
const KEEP_PROP = /text-shadow|^filter$/i
const BOX_SHADOW_PROP = /shadow/i
const SKIP_SELECTOR = /swatch|lightbox/i

const DECL_RE = /([\w-]+)(\s*:\s*)([^;{}]+)(;|$)/g
const isSurfaceProp = (prop) => prop.startsWith('background') || prop === 'fill'

// 가장 안쪽 규칙 블록 단위로 색을 바꾼다. 같은 블록에 진한 배경이 있으면 흰 글자색은 그대로 둔다.
function convertCss(src) {
  let n = 0
  const out = src.replace(/([^{}]*)\{([^{}]*)\}/g, (block, selector, body) => {
    if (SKIP_SELECTOR.test(selector)) return block
    const vividBg = [...body.matchAll(DECL_RE)].some(
      ([, prop, , value]) => isSurfaceProp(prop) && (value.match(COLOR_TOKEN_RE) ?? []).some(isVividSurface),
    )
    const newBody = body.replace(DECL_RE, (m, prop, colon, value, end) => {
      if (KEEP_PROP.test(prop)) return m
      const surface = isSurfaceProp(prop)
      const v = value.replace(COLOR_TOKEN_RE, (tok) => {
        if (vividBg && prop === 'color' && isNearWhite(tok)) return tok
        const c = BOX_SHADOW_PROP.test(prop) ? softenShadowColor(tok) : convertColorToken(tok, { surface })
        if (c !== tok) n++
        return c
      })
      return prop + colon + v + end
    })
    return `${selector}{${newBody}}`
  })
  return [out, n]
}

// Windows 에서 dev 서버 감시자가 파일을 잠깐 잡고 있으면 쓰기가 실패하므로 몇 번 재시도한다.
function writeWithRetry(file, data, tries = 10) {
  for (let i = 1; ; i++) {
    try {
      return fs.writeFileSync(file, data)
    } catch (err) {
      if (i >= tries) throw err
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200)
    }
  }
}

// 변환 뒤 손으로 다듬은 파일(아이콘 교체 등). --base 재실행 때 덮어쓰면 그 수정이 사라지므로 건너뛴다.
const HAND_EDITED = new Set([
  'app/WingsAIStudioShotForm/page.tsx',
  'app/WingsAIStudioShotForm/shorts/page.tsx',
  'app/WingsAIStudioShotForm/youtube-trends/page.tsx',
  'app/WingsAIStudioShotForm/story-shopping/StoryWinningContentPanel.tsx',
  'app/WingsAIStudioShotForm/animal-shopping/AnimalProductPanel.tsx',
  'app/WingsAIStudioShotForm/animal-shopping/AnimalVoicePanel.tsx',
  'app/WingsAIStudioShotForm/shortform-studio/XhsActorBenchmarkPanel.tsx',
  'app/WingsAIStudioShotForm/shortform-studio/DouyinActorBenchmarkPanel.tsx',
  'app/WingsAIStudio/longform-v2/longform-v2.css',
  // 원래부터 밝게 설계된 편집기(light-keep): 변환하면 밝은 색이 오히려 어둡게 뒤집힌다
  'app/WingsAIStudioShotForm/components/ShotFormEditorDialogShell.tsx',
  'app/WingsAIStudioShotForm/shortform-studio/MvpCapCutEditor.tsx',
  'app/WingsAIStudioShotForm/shortform-studio/MvpPostEditStudio.module.css',
  'app/WingsAIStudioShotForm/shortform-studio/mvpInspectorUi.ts',
  'app/WingsAIStudioShotForm/story-shopping/StoryEditorWorkspace.tsx',
  'app/WingsAIStudioShotForm/story-shopping/page.tsx',
  'app/WingsAIStudioShotForm/story-shopping/StoryProductSearchPanel.tsx',
  'app/WingsAIStudioShotForm/ai-shopping/CoupangShoppingRankPanel.tsx',
  'app/WingsAIStudioShotForm/ai-shopping/NaverShoppingTrendPanel.tsx',
])

// --base <git ref>: 원본(다크) 내용을 해당 커밋에서 읽어 변환한다. 여러 번 돌려도 결과가 같다.
const baseRef = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : null

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 })
// git show 는 저장소 원본(LF)을 주므로, autocrlf 체크아웃과 같은 줄바꿈으로 맞춘다.
const useCrlf = baseRef !== null && git('config', 'core.autocrlf').trim() === 'true'

function readSource(file) {
  if (!baseRef) return fs.readFileSync(file, 'utf8')
  try {
    const src = git('show', `${baseRef}:${file.replace(/\\/g, '/')}`)
    return useCrlf ? src.replace(/\r?\n/g, '\r\n') : src
  } catch {
    return fs.readFileSync(file, 'utf8')
  }
}

let total = 0
function run(file, convert) {
  if (baseRef && HAND_EDITED.has(file.replace(/\\/g, '/'))) {
    console.log(`  skip  ${file} (hand-edited)`)
    return
  }
  const [out, n] = convert(readSource(file))
  if (n) {
    total += n
    console.log(`${String(n).padStart(5)}  ${file}`)
  }
  if (WRITE && out !== fs.readFileSync(file, 'utf8')) writeWithRetry(file, out)
}

for (const file of TSX_ROOTS.flatMap((r) => walk(r))) run(file, convertTsx)
for (const file of CSS_FILES) run(file, convertCss)
console.log(`${WRITE ? 'converted' : 'would convert'} ${total} colors`)
