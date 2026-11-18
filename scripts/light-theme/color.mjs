// 다크 UI 색을 밝은 UI 색으로 바꾸는 공용 변환 (OKLCH 명도 반전 + 보라/분홍 계열 → 파랑)

// (다크 명도 → 라이트 명도) 대응점. 가장 어두운 페이지 배경은 옅은 회색, 그 위 카드·다이얼로그 면은 흰색이 되도록
// 맨 앞 구간만 뒤집고, 나머지는 Tailwind zinc 50↔950 반전 곡선을 따른다.
const L_POINTS = [
  [0, 0.975],
  [0.16, 0.975],
  [0.19, 1],
  [0.235, 1],
  [0.274, 0.95],
  [0.37, 0.9],
  [0.442, 0.75],
  [0.552, 0.552],
  [0.705, 0.442],
  [0.871, 0.37],
  [0.92, 0.274],
  [0.967, 0.25],
  [0.985, 0.22],
  [1, 0.21],
]

const BLUE_HUE = 262
// 보라·분홍(268~12°)과 주황(38~66°)을 파랑으로. 빨강·로즈(경고)·호박색(주의)은 유지.
const isAccentHue = (h, c) => c > 0.04 && (h >= 268 || h <= 12 || (h >= 38 && h <= 66))
// 채도 높은 배경(버튼·배지 면)은 명도를 유지해야 '진한 면 → 어두운 덩어리'가 되지 않는다.
const VIVID_SURFACE_CHROMA = 0.08

function invertL(l) {
  for (let i = 1; i < L_POINTS.length; i++) {
    const [x0, y0] = L_POINTS[i - 1]
    const [x1, y1] = L_POINTS[i]
    if (l <= x1) return y0 + ((l - x0) / (x1 - x0)) * (y1 - y0)
  }
  return L_POINTS.at(-1)[1]
}

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function rgbToOklch([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255))
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const h = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  return [L, Math.hypot(A, B), h]
}

function oklchToRgb([L, C, h]) {
  const rad = (h * Math.PI) / 180
  const A = C * Math.cos(rad)
  const B = C * Math.sin(rad)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((v) => Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255))
}

export const lightenRgb = (rgb, opts) => oklchToRgb(lightenOklch(rgbToOklch(rgb), opts))

function lightenOklch([L, C, h], { surface = false } = {}) {
  if (!(surface && C >= VIVID_SURFACE_CHROMA)) L = invertL(L)
  if (isAccentHue(h, C)) h = BLUE_HUE
  if (L > 0.9) C = Math.min(C, 0.03)
  // 밝은 배경 위에서 너무 연한 채도 높은 색은 살짝 진하게 (가독성)
  if (C > 0.08 && L > 0.8) L = 0.8 - (L - 0.8) * 0.2
  return [L, C, h]
}

const round = (v, d) => +v.toFixed(d)

export function convertOklchFunc(str, opts) {
  const m = str.match(/^oklch\(\s*([\d.]+)(%?)[\s_]+([\d.]+)[\s_]+([\d.]+)\s*(.*)\)$/)
  if (!m) return str
  const [L, C, h] = lightenOklch([m[2] ? +m[1] / 100 : +m[1], +m[3], +m[4]], opts)
  const sep = str.includes('_') ? '_' : ' '
  return `oklch(${[round(L, 3), round(C, 3), round(h, 1)].join(sep)}${m[5]})`
}

const hex2 = (n) => n.toString(16).padStart(2, '0')

export function convertHex(hex, opts) {
  let h = hex.slice(1)
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  if (h.length !== 6 && h.length !== 8) return hex
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  const alpha = h.length === 8 ? h.slice(6) : ''
  return '#' + lightenRgb(rgb, opts).map(hex2).join('') + alpha
}

export function convertRgbFunc(str, opts) {
  const m = str.match(/^rgba?\(\s*([\d.]+)[\s,_]+([\d.]+)[\s,_]+([\d.]+)\s*(?:[,/_]\s*_?([\d.]+%?))?\s*\)$/)
  if (!m) return str
  const [r, g, b] = lightenRgb([+m[1], +m[2], +m[3]], opts)
  const sep = str.includes(', ') ? ', ' : ','
  return m[4] !== undefined ? `rgba(${r}${sep}${g}${sep}${b}${sep}${m[4]})` : `rgb(${r}${sep}${g}${sep}${b})`
}

function parseColor(tok) {
  const m = tok.match(/^rgba?\(\s*([\d.]+)[\s,_]+([\d.]+)[\s,_]+([\d.]+)/)
  if (m) return [+m[1], +m[2], +m[3]]
  let h = tok.startsWith('#') ? tok.slice(1) : ''
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  return h.length >= 6 ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null
}

/** 흰 글자를 얹을 만한 진한 면(불투명에 가까운 채도 높은 배경)인지. 반투명 틴트는 밝은 배경에 섞여 연해지므로 제외. */
export function isVividSurface(tok) {
  const rgb = parseColor(tok)
  const hexAlpha = tok.match(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/)?.[1]
  const alpha = hexAlpha ? parseInt(hexAlpha, 16) / 255 : tok.match(/^rgba?\([^)]*[,/_]\s*_?([\d.]+)\s*\)$/)?.[1]
  if (!rgb || (alpha !== undefined && +alpha < 0.6)) return false
  return rgbToOklch(rgb)[1] >= VIVID_SURFACE_CHROMA
}

/** 흰색에 가까운 글자색인지 (진한 면 위 글자는 반전하지 않고 흰색으로 둔다) */
export function isNearWhite(tok) {
  const rgb = parseColor(tok)
  return !!rgb && rgbToOklch(rgb)[0] > 0.9
}

// 밝은 배경에서 검은 그림자는 탁해 보이므로 옅은 남색으로. 컬러 글로우는 그대로 둔다.
export function softenShadowColor(tok) {
  const m = tok.match(/^rgba?\(\s*([\d.]+)[\s,_]+([\d.]+)[\s,_]+([\d.]+)\s*(?:[,/_]\s*_?([\d.]+))?\s*\)$/)
  const hex = tok.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/)
  let rgb, alpha
  if (m) [rgb, alpha] = [[+m[1], +m[2], +m[3]], m[4] === undefined ? 1 : +m[4]]
  else if (hex) [rgb, alpha] = [[0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), hex[2] ? parseInt(hex[2], 16) / 255 : 1]
  else return tok
  if (rgbToOklch(rgb)[0] > 0.25) return tok
  const sep = tok.includes(', ') ? ', ' : ','
  return `rgba(20${sep}35${sep}70${sep}${+(alpha * 0.35).toFixed(3)})`
}

export const COLOR_TOKEN_RE = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|oklch)\([^()]*\)/g

export function convertColorToken(tok, opts) {
  if (tok.startsWith('#')) return convertHex(tok, opts)
  if (tok.startsWith('oklch')) return convertOklchFunc(tok, opts)
  return convertRgbFunc(tok, opts)
}

export { rgbToOklch }
