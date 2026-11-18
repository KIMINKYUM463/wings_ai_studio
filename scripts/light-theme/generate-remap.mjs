// node scripts/light-theme/generate-remap.mjs
// Tailwind 팔레트를 명도 반전한 CSS 변수 세트를 app/light-remap.css 로 생성한다.
import fs from 'node:fs'

const theme = fs.readFileSync('node_modules/tailwindcss/theme.css', 'utf8')
const colors = {}
for (const [, name, shade, value] of theme.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  ;(colors[name] ??= {})[shade] = value.trim()
}
const palettes = Object.keys(colors)

const MIRROR = { 50: 950, 100: 900, 200: 800, 300: 700, 400: 600, 500: 500, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 }
const NEUTRAL = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone'])
// 무채색은 카드(900)가 흰색, 페이지(950)가 옅은 회색이 되도록 맨 위 단계만 따로 정한다.
const NEUTRAL_TOP = { 950: (n) => colors[n][100], 900: () => '#fff', 800: (n) => colors[n][100], 700: (n) => colors[n][200] }

// 강조색은 파랑 하나로. 일반 요소에서는 빨강·호박색·로즈를 경고/주의 의미로 남기고,
// 장식용인 그라데이션 안에서는 이 따뜻한 색들도 파랑으로 바꾼다.
const ACCENT_TO_BLUE = new Set(['indigo', 'violet', 'purple', 'fuchsia', 'pink', 'orange'])
const GRADIENT_TO_BLUE = new Set([...ACCENT_TO_BLUE, 'amber', 'yellow', 'rose'])

const decl = (names, fn) =>
  names.flatMap((name) => Object.keys(colors[name]).map((s) => `  --color-${name}-${s}: ${fn(name, s)};`)).join('\n')

const inverted = (toBlue) => (name, s) =>
  NEUTRAL.has(name) && NEUTRAL_TOP[s] ? NEUTRAL_TOP[s](name) : colors[toBlue.has(name) ? 'blue' : name][MIRROR[s]]
const original = (toBlue) => (name, s) => colors[toBlue.has(name) ? 'blue' : name][s]

// 진한 유채색 면(버튼·아이콘 타일)은 반전하지 않아야 흰 글자가 유지된다.
// 반투명(bg-blue-600/20 등)은 클래스명이 달라 여기 걸리지 않고 연하게 반전된다.
const solidClasses = (prefixes) =>
  palettes
    .filter((name) => !NEUTRAL.has(name))
    .flatMap((name) => ['500', '600', '700'].flatMap((s) => prefixes.map((p) => `.${p}-${name}-${s}`)))
    .join(', ')

const KEEP_BW = `  --color-white: #fff;\n  --color-black: #000;`

const css = `/* 자동 생성 파일: scripts/light-theme/generate-remap.mjs — 직접 수정하지 마세요. */

/* 모든 화면 공통: shadcn 강조 토큰을 파랑 하나로 (:root 보다 우선하도록 html:root) */
html:root {
  --primary: #2c5fd6;
  --primary-foreground: #fff;
  --secondary: ${colors.zinc[100]};
  --secondary-foreground: ${colors.zinc[900]};
  --accent: #eaf0fd;
  --accent-foreground: #1f4fc4;
  --ring: rgb(44 95 214 / 0.45);
}

/* 원래 밝았던 화면: 명도는 그대로 두고 보라·분홍·주황 강조색만 같은 단계의 파랑으로 */
html:not(.light-remap) {
${decl([...ACCENT_TO_BLUE], original(ACCENT_TO_BLUE))}
}

html:not(.light-remap) :is([class*="bg-gradient-to-"], [class*="bg-linear-to-"]) {
${decl([...GRADIENT_TO_BLUE], original(GRADIENT_TO_BLUE))}
}

/* html.light-remap 이 붙은 화면(원래 다크 UI)은 Tailwind 팔레트를 명도 반전해 밝은 테마로 보인다. */
html.light-remap {
${decl(palettes, inverted(ACCENT_TO_BLUE))}
  --color-white: ${colors.zinc[900]};
  --color-black: #fff;
  color-scheme: light;

  --background: #f6f7f9;
  --foreground: ${colors.zinc[900]};
  --card: #fff;
  --card-foreground: ${colors.zinc[900]};
  --popover: #fff;
  --popover-foreground: ${colors.zinc[900]};
  --muted: ${colors.zinc[100]};
  --muted-foreground: ${colors.zinc[500]};
  --border: #e2e6ed;
  --input: #cdd4df;
}

html.light-remap :is([class*="bg-gradient-to-"], [class*="bg-linear-to-"]) {
${decl([...GRADIENT_TO_BLUE], inverted(GRADIENT_TO_BLUE))}
}

html.light-remap :is(${solidClasses(['bg'])}) {
${decl(palettes, original(ACCENT_TO_BLUE))}
${KEEP_BW}
}

html.light-remap :is(${solidClasses(['from', 'via', 'to'])}) {
${decl(palettes, original(GRADIENT_TO_BLUE))}
${KEEP_BW}
}

/* 영상·썸네일 미리보기처럼 원래 색이 보여야 하는 영역. 다크 UI에서 bg-black 은 영상 레터박스 용도로만 쓰였다. */
html.light-remap :is(.light-keep, .bg-black),
html:not(.light-remap) .light-keep {
${decl(palettes, original(new Set()))}
${KEEP_BW}
}
`

fs.writeFileSync('app/light-remap.css', css)
console.log('app/light-remap.css written')
