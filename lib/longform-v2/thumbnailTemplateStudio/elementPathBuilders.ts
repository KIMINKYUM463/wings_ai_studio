/** SVG path (viewBox 0–100) 생성 유틸 */

export function regularPolygonPath(sides: number, cx = 50, cy = 50, r = 44): string {
  const n = Math.max(3, Math.min(12, sides))
  const pts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `${pts.join(' ')} Z`
}

export function starPath(points: number, cx = 50, cy = 50, outerR = 44, innerR = 18): string {
  const n = Math.max(4, Math.min(12, points))
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = (Math.PI * i) / n - Math.PI / 2
    const x = cx + r * Math.cos(a)
    const y = cy + r * Math.sin(a)
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `${pts.join(' ')} Z`
}

/** 오른쪽을 가리키는 화살표 (viewBox 100×100) */
export function arrowPath(
  style: 'block' | 'thin' | 'chevron' | 'double' | 'curved' | 'hand',
): string {
  switch (style) {
    case 'thin':
      return 'M8,50 L72,50 M72,50 L58,38 M72,50 L58,62'
    case 'chevron':
      return 'M15,50 L55,50 L55,30 L85,50 L55,70 L55,50 Z'
    case 'double':
      return 'M10,50 L45,50 M45,50 L35,40 M45,50 L35,60 M55,50 L90,50 M90,50 L80,40 M90,50 L80,60'
    case 'curved':
      return 'M12,65 C12,35 35,25 55,35 C70,42 75,48 82,50 C75,52 70,58 55,65 C35,75 12,65 12,65 Z M78,50 L92,50 M92,50 L84,44 M92,50 L84,56'
    case 'hand':
      return 'M18,52 L55,52 C58,52 60,50 60,47 L60,38 C60,35 58,33 55,33 C52,33 50,35 50,38 L50,45 L48,45 L48,36 C48,33 46,31 43,31 C40,31 38,33 38,36 L38,45 L36,45 L36,34 C36,31 34,29 31,29 C28,29 26,31 26,34 L26,52 C26,62 34,70 44,70 L62,70 C72,70 80,62 80,52 L80,48 C80,45 78,43 75,43 C72,43 70,45 70,48 L70,52 Z M72,50 L88,50 M88,50 L80,43 M88,50 L80,57'
    case 'block':
    default:
      return 'M8,42 L62,42 L62,30 L92,50 L62,70 L62,58 L8,58 Z'
  }
}

export function linePath(
  variant:
    | 'h'
    | 'v'
    | 'diag'
    | 'diag2'
    | 'zigzag'
    | 'wave'
    | 'dash'
    | 'brush'
    | 'swoosh'
    | 'swoosh2'
    | 'scribble'
    | 'double'
    | 'arrowEnd'
    | 'connector'
    | 'bracketH',
): string {
  switch (variant) {
    case 'v':
      return 'M50,8 L50,92'
    case 'diag':
      return 'M12,88 L88,12'
    case 'diag2':
      return 'M12,12 L88,88'
    case 'zigzag':
      return 'M8,50 L25,30 L42,70 L58,30 L75,70 L92,50'
    case 'wave':
      return 'M8,50 C20,20 30,80 42,50 S64,20 76,50 S92,80 92,50'
    case 'dash':
      return 'M10,50 L30,50 M40,50 L60,50 M70,50 L90,50'
    case 'brush':
      return 'M8,58 C25,42 35,62 50,48 C65,34 75,54 92,38'
    case 'swoosh':
      return 'M8,65 C30,35 55,75 92,30'
    case 'swoosh2':
      return 'M8,30 C35,70 60,25 92,65'
    case 'scribble':
      return 'M10,52 L22,48 L18,56 L32,50 L28,58 L42,52 L38,60 L52,54 L48,62 L62,56 L58,64 L72,58 L68,66 L82,60 L78,68 L92,62'
    case 'double':
      return 'M8,44 L92,44 M8,56 L92,56'
    case 'arrowEnd':
      return 'M8,50 L78,50 M78,50 L64,38 M78,50 L64,62'
    case 'connector':
      return 'M8,50 C35,50 35,20 50,20 C65,20 65,50 92,50'
    case 'bracketH':
      return 'M8,30 L8,70 M8,30 L92,30 M92,30 L92,70 M8,70 L92,70'
    case 'h':
    default:
      return 'M8,50 L92,50'
  }
}

/** 원형 테두리(가운데 뚫림) — lineWidth로 두께 조절 */
export function circleStrokePath(r = 40, cx = 50, cy = 50): string {
  return `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
}

/** 타원형 테두리(가운데 뚫림) */
export function ellipseStrokePath(rx = 44, ry = 30, cx = 50, cy = 50): string {
  return `M${cx},${cy - ry} A${rx},${ry} 0 1,1 ${cx - 0.01},${cy - ry} Z`
}

/** 이중 원형 테두리 */
export function doubleCircleStrokePath(outerR = 42, innerR = 30, cx = 50, cy = 50): string {
  return `${circleStrokePath(outerR, cx, cy)} ${circleStrokePath(innerR, cx, cy)}`
}

/** 속이 빈 링(고정 구멍 비율) — compound path */
export function ringPath(outerR = 44, innerR = 28, cx = 50, cy = 50): string {
  return `M${cx},${cy - outerR} A${outerR},${outerR} 0 1,1 ${cx - 0.01},${cy - outerR} Z M${cx},${cy - innerR} A${innerR},${innerR} 0 1,0 ${cx + 0.01},${cy - innerR} Z`
}

/** 타원 링 */
export function ellipseRingPath(outerRx = 44, outerRy = 32, innerRx = 30, innerRy = 20, cx = 50, cy = 50): string {
  return `M${cx},${cy - outerRy} A${outerRx},${outerRy} 0 1,1 ${cx - 0.01},${cy - outerRy} Z M${cx},${cy - innerRy} A${innerRx},${innerRy} 0 1,0 ${cx + 0.01},${cy - innerRy} Z`
}

export const STATIC_PATHS = {
  heart: 'M50,88 C50,88 12,62 12,38 C12,22 24,12 38,12 C46,12 50,18 50,18 C50,18 54,12 62,12 C76,12 88,22 88,38 C88,62 50,88 50,88 Z',
  cross: 'M42,8 L58,8 L58,42 L92,42 L92,58 L58,58 L58,92 L42,92 L42,58 L8,58 L8,42 L42,42 Z',
  plus: 'M42,8 L58,8 L58,42 L92,42 L92,58 L58,58 L58,92 L42,92 L42,58 L8,58 L8,42 L42,42 Z',
  minus: 'M8,46 L92,46 L92,54 L8,54 Z',
  diamond: 'M50,8 L92,50 L50,92 L8,50 Z',
  ring: 'M50,12 C30,12 14,28 14,48 C14,68 30,84 50,84 C70,84 86,68 86,48 C86,28 70,12 50,12 Z M50,24 C64,24 74,34 74,48 C74,62 64,72 50,72 C36,72 26,62 26,48 C26,34 36,24 50,24 Z',
  semicircle: 'M10,55 A40,40 0 0 1 90,55 L90,92 L10,92 Z',
  roundedRect: 'M20,12 H80 A8,8 0 0 1 88,20 V80 A8,8 0 0 1 80,88 H20 A8,8 0 0 1 12,80 V20 A8,8 0 0 1 20,12 Z',
  square: 'M12,12 H88 V88 H12 Z',
  circle: 'M50,8 A42,42 0 1 1 49.99,8 Z',
  triangleUp: 'M50,10 L90,88 L10,88 Z',
  triangleDown: 'M50,90 L10,12 L90,12 Z',
  triangleLeft: 'M10,50 L88,10 L88,90 Z',
  triangleRight: 'M90,50 L12,10 L12,90 Z',
  lightning: 'M58,8 L28,52 L48,52 L38,92 L72,42 L52,42 Z',
  sun: 'M50,22 A28,28 0 1 1 49.99,22 Z M50,4 L50,12 M50,88 L50,96 M4,50 L12,50 M88,50 L96,50 M18,18 L24,24 M76,76 L82,82 M82,18 L76,24 M24,76 L18,82',
  moon: 'M62,12 C42,12 26,30 26,50 C26,70 42,88 62,88 C52,78 46,65 46,50 C46,35 52,22 62,12 Z',
  cloud: 'M28,62 C18,62 10,54 10,44 C10,34 18,26 28,26 C30,18 38,12 48,12 C60,12 70,22 72,34 C82,36 90,44 90,54 C90,64 82,72 72,72 L28,72 C18,72 10,64 10,54',
  check: 'M18,52 L42,76 L82,28',
  xmark: 'M22,22 L78,78 M78,22 L22,78',
  question: 'M38,38 C38,28 46,22 56,22 C66,22 74,28 74,38 C74,48 62,52 56,58 L56,68 M56,78 L56,82',
  exclamation: 'M50,22 L50,24 M50,38 L50,72',
  play: 'M32,18 L78,50 L32,82 Z',
  pause: 'M32,18 H48 V82 H32 Z M52,18 H68 V82 H52 Z',
  speechRound: 'M12,18 H88 A10,10 0 0 1 98,28 V58 A10,10 0 0 1 88,68 H42 L28,82 L32,68 H12 A10,10 0 0 1 2,58 V28 A10,10 0 0 1 12,18 Z',
  speechSquare: 'M12,15 H88 V65 H45 L30,80 L34,65 H12 Z',
  speechShout: 'M50,8 L62,28 L84,22 L72,42 L92,50 L72,58 L84,78 L62,72 L50,92 L38,72 L16,78 L28,58 L8,50 L28,42 L16,22 L38,28 Z',
  thought: 'M20,20 H80 A15,15 0 0 1 95,35 V55 A15,15 0 0 1 80,70 H55 L40,85 L44,70 H20 A15,15 0 0 1 5,55 V35 A15,15 0 0 1 20,20 Z M22,88 A6,6 0 1 1 21.99,88 Z M12,92 A4,4 0 1 1 11.99,92 Z',
  ribbon: 'M12,28 H88 V58 H12 Z M12,28 L5,18 L18,28 M88,28 L95,18 L82,28 M12,58 L5,68 L18,58 M88,58 L95,68 L82,58',
  tag: 'M12,35 L55,35 L88,50 L55,65 L12,65 Z M72,42 A6,6 0 1 1 71.99,42 Z',
  burst: 'M50,5 L58,28 L82,18 L68,42 L92,50 L68,58 L82,82 L58,72 L50,95 L42,72 L18,82 L32,58 L8,50 L32,42 L18,18 L42,28 Z',
  pill: 'M25,35 H75 A15,15 0 0 1 75,65 H25 A15,15 0 0 1 25,35 Z',
  banner: 'M5,35 L95,35 L88,50 L95,65 L5,65 L12,50 Z',
  frameFull: 'M8,8 H92 V92 H8 Z M18,18 H82 V82 H18 Z',
  frameCorner: 'M8,8 H35 V18 H18 V35 H8 Z M92,8 H65 V18 H82 V35 H92 Z M8,92 H35 V82 H18 V65 H8 Z M92,92 H65 V82 H82 V65 H92 Z',
  bracketL: 'M28,8 V92 M28,8 H8 M28,92 H8',
  bracketR: 'M72,8 V92 M72,8 H92 M72,92 H92',
  focusRing: 'M50,15 A35,35 0 1 1 49.99,15 Z M50,28 A22,22 0 1 1 49.99,28 Z',
  underline: 'M12,72 L88,72',
  underlineWavy: 'M12,72 C28,62 38,82 50,72 S72,62 88,72',
  underlineDouble: 'M12,68 L88,68 M12,76 L88,76',
  underlineScribble: 'M10,74 L20,70 L30,76 L40,68 L50,74 L60,70 L70,76 L80,68 L90,74',
  strikethrough: 'M8,50 L92,50',
  circleMark: 'M50,50 m-32,0 a32,32 0 1,0 64,0 a32,32 0 1,0 -64,0',
  cornerBrackets: 'M18,18 H8 V28 M82,18 H92 V28 M18,82 H8 V72 M82,82 H92 V72',
  speedLines: 'M8,30 L92,30 M12,50 L88,50 M8,70 L92,70',
  shockBurst: 'M50,8 L58,32 L84,22 L68,42 L92,50 L68,58 L84,78 L58,68 L50,92 L42,68 L16,78 L32,58 L8,50 L32,42 L16,22 L42,32 Z',
  swooshLeft: 'M88,50 C60,50 40,20 8,25 C40,35 60,65 88,50 Z',
  swooshRight: 'M12,50 C40,50 60,20 92,25 C60,35 40,65 12,50 Z',
  brushMark: 'M10,58 Q30,42 50,55 Q70,68 90,48',
  highlight: 'M10,55 Q50,48 90,55 L88,68 Q50,75 12,68 Z',
  sparkle: 'M50,8 L54,38 L84,42 L54,46 L50,76 L46,46 L16,42 L46,38 Z',
  dot: 'M50,50 m-20,0 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0',
} as const
