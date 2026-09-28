import {
  STATIC_PATHS,
  arrowPath,
  circleStrokePath,
  doubleCircleStrokePath,
  ellipseRingPath,
  ellipseStrokePath,
  linePath,
  ringPath,
  regularPolygonPath,
  starPath,
} from './elementPathBuilders'
export type ElementPresetCategory =
  | 'arrow'
  | 'line'
  | 'shape'
  | 'badge'
  | 'bubble'
  | 'frame'
  | 'icon'
  | 'decoration'
  | 'youtube'

export type ElementPresetDef = {
  id: string
  label: string
  category: ElementPresetCategory
  /** AI 누끼 스티커 생성용 영문 주제 (없으면 resolveStickerSubject) */
  stickerSubject?: string
  pathD: string
  viewBoxW: number
  viewBoxH: number
  defaultColor: string
  defaultFill?: string | null
  defaultLineWidth: number
  strokeOnly?: boolean
  /** 초기 회전(도) — 화살표 방향 등 */
  defaultRotation?: number
  /** 캔버스 기준 기본 크기 비율 */
  defaultWidthRatio: number
  defaultHeightRatio: number
  tags: string[]
}

const CATEGORY_LABELS: Record<ElementPresetCategory, string> = {
  arrow: '화살표',
  line: '선',
  shape: '도형',
  badge: '배지',
  bubble: '말풍선',
  frame: '프레임',
  icon: '아이콘',
  decoration: '장식',
  youtube: '유튜브',
}

export function elementCategoryLabel(cat: ElementPresetCategory): string {
  return CATEGORY_LABELS[cat]
}

export const ELEMENT_PRESET_CATEGORIES: ElementPresetCategory[] = [
  'arrow',
  'line',
  'shape',
  'badge',
  'bubble',
  'frame',
  'icon',
  'decoration',
  'youtube',
]

function pushArrowPresets(out: ElementPresetDef[]): void {
  const styles = ['block', 'thin', 'chevron', 'double', 'curved', 'hand'] as const
  const styleLabels = ['블록', '얇은', '쉐vron', '양방향', '곡선', '손가락']
  const angles = [0, 45, 90, 135, 180, 225, 270, 315]
  const angleLabels = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗']

  for (let si = 0; si < styles.length; si++) {
    const style = styles[si]
    const sLabel = styleLabels[si]
    for (let ai = 0; ai < angles.length; ai++) {
      const strokeOnly = style === 'thin' || style === 'double'
      out.push({
        id: `arrow_${style}_${angles[ai]}`,
        label: `${sLabel} ${angleLabels[ai]}`,
        category: 'arrow',
        pathD: arrowPath(style),
        viewBoxW: 100,
        viewBoxH: 100,
        defaultColor: style === 'hand' ? '#fbbf24' : '#ef4444',
        defaultFill: strokeOnly ? null : style === 'hand' ? '#fbbf24' : '#ef4444',
        defaultLineWidth: strokeOnly ? 6 : 2,
        strokeOnly,
        defaultRotation: angles[ai],
        defaultWidthRatio: style === 'hand' ? 0.22 : 0.28,
        defaultHeightRatio: style === 'hand' ? 0.2 : 0.14,
        tags: ['화살표', 'arrow', sLabel, angleLabels[ai]],
      })
    }
  }
}

function pushLinePresets(out: ElementPresetDef[]): void {
  const variants = [
    { id: 'h', label: '가로선', tags: ['선', '가로'] },
    { id: 'v', label: '세로선', tags: ['선', '세로'] },
    { id: 'diag', label: '대각 ↗', tags: ['선', '대각'] },
    { id: 'diag2', label: '대각 ↘', tags: ['선', '대각'] },
    { id: 'zigzag', label: '지그재그', tags: ['선', '지그재그'] },
    { id: 'wave', label: '물결', tags: ['선', '물결'] },
    { id: 'dash', label: '점선', tags: ['선', '점선'] },
  ] as const

  for (const v of variants) {
    out.push({
      id: `line_${v.id}`,
      label: v.label,
      category: 'line',
      pathD: linePath(v.id),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#fbbf24',
      defaultFill: null,
      defaultLineWidth: 5,
      strokeOnly: true,
      defaultWidthRatio: v.id === 'v' ? 0.04 : 0.45,
      defaultHeightRatio: v.id === 'v' ? 0.35 : v.id === 'h' ? 0.04 : 0.25,
      tags: [...v.tags],
    })
  }

  const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316']
  for (let i = 0; i < 5; i++) {
    out.push({
      id: `line_thick_${i}`,
      label: `굵은 가로선 ${i + 1}`,
      category: 'line',
      pathD: linePath('h'),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: colors[i],
      defaultFill: null,
      defaultLineWidth: 8 + i * 3,
      strokeOnly: true,
      defaultWidthRatio: 0.5,
      defaultHeightRatio: 0.02 + i * 0.008,
      tags: ['선', '굵은'],
    })
  }

  const extraLines: {
    id: string
    label: string
    variant: Parameters<typeof linePath>[0]
    color: string
    w: number
    h: number
    tags: string[]
  }[] = [
    { id: 'brush', label: '브러시 선', variant: 'brush', color: '#fbbf24', w: 0.45, h: 0.08, tags: ['선', '브러시'] },
    { id: 'swoosh', label: '스우시 ↗', variant: 'swoosh', color: '#ef4444', w: 0.42, h: 0.12, tags: ['선', '스우시'] },
    { id: 'swoosh2', label: '스우시 ↘', variant: 'swoosh2', color: '#3b82f6', w: 0.42, h: 0.12, tags: ['선', '스우시'] },
    { id: 'scribble', label: '낙서 선', variant: 'scribble', color: '#ffffff', w: 0.4, h: 0.06, tags: ['선', '낙서'] },
    { id: 'double', label: '이중선', variant: 'double', color: '#fbbf24', w: 0.48, h: 0.05, tags: ['선', '이중'] },
    { id: 'arrowEnd', label: '화살 끝 선', variant: 'arrowEnd', color: '#ef4444', w: 0.45, h: 0.06, tags: ['선', '화살표'] },
    { id: 'connector', label: '연결 곡선', variant: 'connector', color: '#22c55e', w: 0.4, h: 0.18, tags: ['선', '곡선'] },
    { id: 'bracketH', label: '텍스트 박스선', variant: 'bracketH', color: '#ffffff', w: 0.5, h: 0.14, tags: ['선', '박스'] },
  ]
  for (const v of extraLines) {
    out.push({
      id: `line_${v.id}`,
      label: v.label,
      category: 'line',
      pathD: linePath(v.variant),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: v.color,
      defaultFill: null,
      defaultLineWidth: 5,
      strokeOnly: true,
      defaultWidthRatio: v.w,
      defaultHeightRatio: v.h,
      tags: v.tags,
    })
  }

  const neonColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#a855f7']
  for (let i = 0; i < neonColors.length; i++) {
    out.push({
      id: `line_neon_${i}`,
      label: `네온 가로선 ${i + 1}`,
      category: 'line',
      pathD: linePath('h'),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: neonColors[i],
      defaultFill: null,
      defaultLineWidth: 6,
      strokeOnly: true,
      defaultWidthRatio: 0.52,
      defaultHeightRatio: 0.025,
      tags: ['선', '네온', '강조'],
    })
  }
}

function pushShapePresets(out: ElementPresetDef[]): void {
  const staticShapes: { key: keyof typeof STATIC_PATHS; label: string; fill?: boolean }[] = [
    { key: 'circle', label: '원', fill: true },
    { key: 'square', label: '정사각형', fill: true },
    { key: 'roundedRect', label: '둥근 사각형', fill: true },
    { key: 'diamond', label: '다이아몬드', fill: true },
    { key: 'triangleUp', label: '세모 ▲', fill: true },
    { key: 'triangleDown', label: '세모 ▼', fill: true },
    { key: 'triangleLeft', label: '세모 ◀', fill: true },
    { key: 'triangleRight', label: '세모 ▶', fill: true },
    { key: 'heart', label: '하트', fill: true },
    { key: 'cross', label: '십자', fill: true },
    { key: 'plus', label: '플러스', fill: true },
    { key: 'minus', label: '마이너스', fill: true },
    { key: 'ring', label: '링', fill: false },
    { key: 'semicircle', label: '반원', fill: true },
    { key: 'dot', label: '점', fill: true },
  ]

  for (const s of staticShapes) {
    out.push({
      id: `shape_${s.key}`,
      label: s.label,
      category: 'shape',
      pathD: STATIC_PATHS[s.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#ffffff',
      defaultFill: s.fill ? '#ef4444' : null,
      defaultLineWidth: s.fill ? 3 : 5,
      strokeOnly: !s.fill,
      defaultWidthRatio: 0.18,
      defaultHeightRatio: 0.18,
      tags: ['도형', s.label],
    })
  }

  for (let sides = 3; sides <= 12; sides++) {
    out.push({
      id: `shape_polygon_${sides}`,
      label: `${sides}각형`,
      category: 'shape',
      pathD: regularPolygonPath(sides),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#22d3ee',
      defaultFill: 'rgba(34, 211, 238, 0.35)',
      defaultLineWidth: 4,
      defaultWidthRatio: 0.16,
      defaultHeightRatio: 0.16,
      tags: ['도형', '다각형', `${sides}각`],
    })
  }

  for (const pts of [4, 5, 6, 7, 8, 10, 12]) {
    out.push({
      id: `shape_star_${pts}`,
      label: `${pts}각 별`,
      category: 'shape',
      pathD: starPath(pts),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#fbbf24',
      defaultFill: '#fbbf24',
      defaultLineWidth: 2,
      defaultWidthRatio: 0.2,
      defaultHeightRatio: 0.2,
      tags: ['도형', '별', `${pts}각`],
    })
  }

  pushRingPresets(out)
}

/** 가운데가 뚫린 원형·타원 링 — 테두리 두께(lineWidth)·색상(color) 조절 */
function pushRingPresets(out: ElementPresetDef[]): void {
  const strokeRings: {
    id: string
    label: string
    pathD: string
    color: string
    lineWidth: number
    w: number
    h: number
  }[] = [
    {
      id: 'ring_stroke_thin',
      label: '원형 링 (가는 테두리)',
      pathD: circleStrokePath(40),
      color: '#ef4444',
      lineWidth: 4,
      w: 0.2,
      h: 0.2,
    },
    {
      id: 'ring_stroke_medium',
      label: '원형 링 (보통)',
      pathD: circleStrokePath(40),
      color: '#fbbf24',
      lineWidth: 8,
      w: 0.2,
      h: 0.2,
    },
    {
      id: 'ring_stroke_bold',
      label: '원형 링 (굵은 테두리)',
      pathD: circleStrokePath(40),
      color: '#22d3ee',
      lineWidth: 14,
      w: 0.22,
      h: 0.22,
    },
    {
      id: 'ring_stroke_heavy',
      label: '원형 링 (매우 굵음)',
      pathD: circleStrokePath(38),
      color: '#ffffff',
      lineWidth: 22,
      w: 0.24,
      h: 0.24,
    },
    {
      id: 'ring_stroke_large',
      label: '큰 원형 링',
      pathD: circleStrokePath(44),
      color: '#ef4444',
      lineWidth: 10,
      w: 0.32,
      h: 0.32,
    },
    {
      id: 'ring_ellipse',
      label: '타원 링',
      pathD: ellipseStrokePath(44, 30),
      color: '#a855f7',
      lineWidth: 8,
      w: 0.28,
      h: 0.2,
    },
    {
      id: 'ring_double_stroke',
      label: '이중 원형 링',
      pathD: doubleCircleStrokePath(42, 30),
      color: '#f97316',
      lineWidth: 6,
      w: 0.24,
      h: 0.24,
    },
  ]

  for (const r of strokeRings) {
    out.push({
      id: `shape_${r.id}`,
      label: r.label,
      category: 'shape',
      pathD: r.pathD,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: r.color,
      defaultFill: null,
      defaultLineWidth: r.lineWidth,
      strokeOnly: true,
      defaultWidthRatio: r.w,
      defaultHeightRatio: r.h,
      tags: ['도형', '링', '원형', '테두리', r.label],
    })
  }

  const compoundRings: {
    id: string
    label: string
    pathD: string
    color: string
    lineWidth: number
    w: number
    h: number
  }[] = [
    {
      id: 'ring_hole_small',
      label: '뚫린 원 (작은 구멍)',
      pathD: ringPath(44, 34),
      color: '#ef4444',
      lineWidth: 5,
      w: 0.2,
      h: 0.2,
    },
    {
      id: 'ring_hole_medium',
      label: '뚫린 원 (보통 구멍)',
      pathD: ringPath(44, 28),
      color: '#fbbf24',
      lineWidth: 5,
      w: 0.2,
      h: 0.2,
    },
    {
      id: 'ring_hole_large',
      label: '뚫린 원 (큰 구멍)',
      pathD: ringPath(44, 20),
      color: '#22d3ee',
      lineWidth: 5,
      w: 0.2,
      h: 0.2,
    },
    {
      id: 'ring_ellipse_hole',
      label: '뚫린 타원 링',
      pathD: ellipseRingPath(44, 32, 28, 18),
      color: '#a855f7',
      lineWidth: 5,
      w: 0.28,
      h: 0.2,
    },
  ]

  for (const r of compoundRings) {
    out.push({
      id: `shape_${r.id}`,
      label: r.label,
      category: 'shape',
      pathD: r.pathD,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: r.color,
      defaultFill: null,
      defaultLineWidth: r.lineWidth,
      strokeOnly: true,
      defaultWidthRatio: r.w,
      defaultHeightRatio: r.h,
      tags: ['도형', '링', '원형', '뚫린', r.label],
    })
  }

  const ringColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff']
  for (let i = 0; i < ringColors.length; i++) {
    out.push({
      id: `shape_ring_color_${i}`,
      label: `강조 원 ${i + 1}`,
      category: 'decoration',
      pathD: circleStrokePath(36),
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: ringColors[i],
      defaultFill: null,
      defaultLineWidth: 7,
      strokeOnly: true,
      defaultWidthRatio: 0.18,
      defaultHeightRatio: 0.18,
      tags: ['장식', '링', '원형', '강조', '테두리'],
    })
  }

  const decoRings: { id: string; label: string; pathD: string; color: string; lw: number; w: number; h: number }[] = [
    {
      id: 'deco_ring_focus',
      label: '포커스 링 (굵음)',
      pathD: circleStrokePath(38),
      color: '#ffffff',
      lw: 12,
      w: 0.26,
      h: 0.26,
    },
    {
      id: 'deco_ring_target',
      label: '타깃 링',
      pathD: doubleCircleStrokePath(40, 28),
      color: '#ef4444',
      lw: 5,
      w: 0.22,
      h: 0.22,
    },
    {
      id: 'deco_ring_soft',
      label: '얇은 강조 원',
      pathD: circleStrokePath(34),
      color: '#fbbf24',
      lw: 3,
      w: 0.16,
      h: 0.16,
    },
  ]
  for (const r of decoRings) {
    out.push({
      id: r.id,
      label: r.label,
      category: 'decoration',
      pathD: r.pathD,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: r.color,
      defaultFill: null,
      defaultLineWidth: r.lw,
      strokeOnly: true,
      defaultWidthRatio: r.w,
      defaultHeightRatio: r.h,
      tags: ['장식', '링', '원형', r.label],
    })
  }
}

function pushBadgePresets(out: ElementPresetDef[]): void {
  const badges: { key: keyof typeof STATIC_PATHS; label: string; color: string }[] = [
    { key: 'ribbon', label: '리본', color: '#ef4444' },
    { key: 'tag', label: '태그', color: '#3b82f6' },
    { key: 'burst', label: '버스트', color: '#f97316' },
    { key: 'pill', label: '알약형', color: '#22c55e' },
    { key: 'banner', label: '배너', color: '#a855f7' },
  ]
  for (const b of badges) {
    out.push({
      id: `badge_${b.key}`,
      label: b.label,
      category: 'badge',
      pathD: STATIC_PATHS[b.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: b.color,
      defaultFill: b.color,
      defaultLineWidth: 2,
      defaultWidthRatio: 0.35,
      defaultHeightRatio: 0.12,
      tags: ['배지', b.label],
    })
  }

  const badgeColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']
  for (let i = 0; i < badgeColors.length; i++) {
    out.push({
      id: `badge_circle_${i}`,
      label: `원형 배지 ${i + 1}`,
      category: 'badge',
      pathD: STATIC_PATHS.circle,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: badgeColors[i],
      defaultFill: badgeColors[i],
      defaultLineWidth: 2,
      defaultWidthRatio: 0.12,
      defaultHeightRatio: 0.12,
      tags: ['배지', '원'],
    })
  }
}

function pushBubblePresets(out: ElementPresetDef[]): void {
  const bubbles: { key: keyof typeof STATIC_PATHS; label: string }[] = [
    { key: 'speechRound', label: '말풍선(둥근)' },
    { key: 'speechSquare', label: '말풍선(각진)' },
    { key: 'speechShout', label: '외침 말풍선' },
    { key: 'thought', label: '생각 말풍선' },
  ]
  for (const b of bubbles) {
    out.push({
      id: `bubble_${b.key}`,
      label: b.label,
      category: 'bubble',
      pathD: STATIC_PATHS[b.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#ffffff',
      defaultFill: '#ffffff',
      defaultLineWidth: 3,
      defaultWidthRatio: 0.32,
      defaultHeightRatio: 0.22,
      tags: ['말풍선', b.label],
    })
  }
}

function pushFramePresets(out: ElementPresetDef[]): void {
  const frames: { key: keyof typeof STATIC_PATHS; label: string; w: number; h: number }[] = [
    { key: 'frameFull', label: '이중 프레임', w: 0.85, h: 0.55 },
    { key: 'frameCorner', label: '코너 프레임', w: 0.4, h: 0.35 },
    { key: 'bracketL', label: '브래킷 [', w: 0.12, h: 0.45 },
    { key: 'bracketR', label: '브래킷 ]', w: 0.12, h: 0.45 },
    { key: 'focusRing', label: '포커스 링', w: 0.28, h: 0.28 },
  ]
  for (const f of frames) {
    out.push({
      id: `frame_${f.key}`,
      label: f.label,
      category: 'frame',
      pathD: STATIC_PATHS[f.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: '#ffffff',
      defaultFill: f.key === 'focusRing' ? null : null,
      defaultLineWidth: f.key === 'frameFull' ? 4 : 5,
      strokeOnly: true,
      defaultWidthRatio: f.w,
      defaultHeightRatio: f.h,
      tags: ['프레임', f.label],
    })
  }

  for (let i = 0; i < 4; i++) {
    out.push({
      id: `frame_rect_${i}`,
      label: `사각 프레임 ${i + 1}`,
      category: 'frame',
      pathD: STATIC_PATHS.square,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24'][i],
      defaultFill: null,
      defaultLineWidth: 4 + i * 2,
      strokeOnly: true,
      defaultWidthRatio: 0.35 + i * 0.08,
      defaultHeightRatio: 0.22 + i * 0.05,
      tags: ['프레임', '사각'],
    })
  }
}

function pushIconPresets(out: ElementPresetDef[]): void {
  const icons: { key: keyof typeof STATIC_PATHS; label: string; color: string; stroke?: boolean }[] =
    [
      { key: 'lightning', label: '번개', color: '#fbbf24' },
      { key: 'sun', label: '태양', color: '#fbbf24', stroke: true },
      { key: 'moon', label: '달', color: '#e2e8f0' },
      { key: 'cloud', label: '구름', color: '#94a3b8' },
      { key: 'check', label: '체크', color: '#22c55e', stroke: true },
      { key: 'xmark', label: 'X', color: '#ef4444', stroke: true },
      { key: 'question', label: '?', color: '#3b82f6', stroke: true },
      { key: 'exclamation', label: '!', color: '#f97316', stroke: true },
      { key: 'play', label: '재생', color: '#ef4444' },
      { key: 'pause', label: '일시정지', color: '#ffffff' },
      { key: 'sparkle', label: '반짝', color: '#fbbf24' },
    ]
  for (const ic of icons) {
    out.push({
      id: `icon_${ic.key}`,
      label: ic.label,
      category: 'icon',
      pathD: STATIC_PATHS[ic.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: ic.color,
      defaultFill: ic.stroke ? null : ic.color,
      defaultLineWidth: ic.stroke ? 6 : 2,
      strokeOnly: !!ic.stroke,
      defaultWidthRatio: 0.14,
      defaultHeightRatio: 0.14,
      tags: ['아이콘', ic.label],
    })
  }
}

function pushDecorationPresets(out: ElementPresetDef[]): void {
  const decos: { key: keyof typeof STATIC_PATHS; label: string; strokeOnly?: boolean }[] = [
    { key: 'underline', label: '밑줄' },
    { key: 'underlineWavy', label: '물결 밑줄' },
    { key: 'underlineDouble', label: '이중 밑줄' },
    { key: 'underlineScribble', label: '낙서 밑줄' },
    { key: 'strikethrough', label: '취소선', strokeOnly: true },
    { key: 'highlight', label: '형광펜' },
    { key: 'brushMark', label: '마커 터치', strokeOnly: true },
    { key: 'circleMark', label: '동그라미 강조', strokeOnly: true },
    { key: 'cornerBrackets', label: '코너 괄호', strokeOnly: true },
    { key: 'speedLines', label: '속도선', strokeOnly: true },
    { key: 'shockBurst', label: '충격 버스트' },
    { key: 'swooshLeft', label: '스우시 ◀' },
    { key: 'swooshRight', label: '스우시 ▶' },
    { key: 'sparkle', label: '스파클' },
  ]
  for (const d of decos) {
    const isLine =
      d.key === 'underline' ||
      d.key === 'underlineWavy' ||
      d.key === 'underlineDouble' ||
      d.key === 'underlineScribble' ||
      d.key === 'strikethrough' ||
      d.key === 'brushMark'
    out.push({
      id: `deco_${d.key}`,
      label: d.label,
      category: 'decoration',
      pathD: STATIC_PATHS[d.key],
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor:
        d.key === 'highlight' || d.key === 'brushMark'
          ? 'rgba(250, 204, 21, 0.55)'
          : d.key === 'shockBurst' || d.key === 'swooshLeft' || d.key === 'swooshRight'
            ? '#ef4444'
            : '#fbbf24',
      defaultFill:
        d.key === 'highlight' || d.key === 'brushMark'
          ? 'rgba(250, 204, 21, 0.55)'
          : d.key === 'sparkle' || d.key === 'shockBurst' || d.key === 'swooshLeft' || d.key === 'swooshRight'
            ? '#ef4444'
            : null,
      defaultLineWidth: isLine ? 5 : d.strokeOnly ? 4 : 2,
      strokeOnly: d.strokeOnly ?? isLine,
      defaultWidthRatio:
        d.key === 'sparkle' || d.key === 'shockBurst'
          ? 0.14
          : d.key === 'circleMark'
            ? 0.22
            : isLine
              ? 0.42
              : 0.38,
      defaultHeightRatio:
        isLine ? 0.03 : d.key === 'sparkle' || d.key === 'shockBurst' ? 0.14 : d.key === 'circleMark' ? 0.22 : 0.1,
      tags: ['장식', d.label],
    })
  }

  const markerColors = [
    { id: 'marker_red', label: '빨간 마커 밑줄', color: '#ef4444' },
    { id: 'marker_yellow', label: '노란 마커 밑줄', color: '#fbbf24' },
    { id: 'marker_blue', label: '파란 마커 밑줄', color: '#3b82f6' },
    { id: 'marker_green', label: '초록 마커 밑줄', color: '#22c55e' },
  ]
  for (const m of markerColors) {
    out.push({
      id: `deco_${m.id}`,
      label: m.label,
      category: 'decoration',
      pathD: STATIC_PATHS.underline,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: m.color,
      defaultFill: null,
      defaultLineWidth: 6,
      strokeOnly: true,
      defaultWidthRatio: 0.44,
      defaultHeightRatio: 0.035,
      tags: ['장식', '밑줄', '마커'],
    })
  }

  for (let i = 0; i < 8; i++) {
    out.push({
      id: `deco_dot_row_${i}`,
      label: `점 장식 ${i + 1}`,
      category: 'decoration',
      pathD: `M${10 + i * 2},50 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M30,50 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M50,50 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M70,50 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M90,50 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0`,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#94a3b8'][i],
      defaultFill: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#94a3b8'][i],
      defaultLineWidth: 1,
      defaultWidthRatio: 0.35,
      defaultHeightRatio: 0.05,
      tags: ['장식', '점'],
    })
  }
}

function pushYoutubePresets(out: ElementPresetDef[]): void {
  const badges: { id: string; label: string; subject: string; color: string; tags: string[] }[] = [
    { id: 'new', label: 'NEW 뱃지', subject: 'red NEW badge sticker bold 3D', color: '#ef4444', tags: ['유튜브', 'NEW'] },
    { id: 'hot', label: 'HOT 뱃지', subject: 'orange HOT fire badge sticker bold 3D', color: '#f97316', tags: ['유튜브', 'HOT'] },
    { id: 'free', label: 'FREE 뱃지', subject: 'green FREE badge sticker bold 3D', color: '#22c55e', tags: ['유튜브', 'FREE'] },
    { id: 'sale', label: 'SALE 뱃지', subject: 'red SALE discount badge sticker bold 3D', color: '#ef4444', tags: ['유튜브', 'SALE'] },
    { id: 'vs', label: 'VS 뱃지', subject: 'VS versus comparison badge sticker split design', color: '#a855f7', tags: ['유튜브', 'VS'] },
    { id: 'live', label: 'LIVE 뱃지', subject: 'red LIVE streaming badge with dot sticker', color: '#ef4444', tags: ['유튜브', 'LIVE'] },
    { id: 'pct100', label: '100% 뱃지', subject: 'golden 100 percent badge sticker bold', color: '#fbbf24', tags: ['유튜브', '100%'] },
    { id: 'top1', label: '1위 뱃지', subject: 'golden number 1 rank trophy badge sticker', color: '#fbbf24', tags: ['유튜브', '1위'] },
    { id: 'top2', label: '2위 뱃지', subject: 'silver number 2 rank badge sticker', color: '#94a3b8', tags: ['유튜브', '2위'] },
    { id: 'top3', label: '3위 뱃지', subject: 'bronze number 3 rank badge sticker', color: '#d97706', tags: ['유튜브', '3위'] },
    { id: 'hd', label: 'HD 뱃지', subject: 'blue HD quality badge sticker', color: '#3b82f6', tags: ['유튜브', 'HD'] },
    { id: 'secret', label: 'SECRET 뱃지', subject: 'mysterious SECRET black gold badge sticker', color: '#1e293b', tags: ['유튜브', '비밀'] },
    { id: 'real', label: 'REAL 뱃지', subject: 'verified REAL authentic stamp badge sticker', color: '#22c55e', tags: ['유튜브', '진짜'] },
    { id: 'step1', label: 'STEP 1', subject: 'blue STEP 1 number badge sticker', color: '#3b82f6', tags: ['유튜브', '단계'] },
    { id: 'step2', label: 'STEP 2', subject: 'blue STEP 2 number badge sticker', color: '#3b82f6', tags: ['유튜브', '단계'] },
    { id: 'step3', label: 'STEP 3', subject: 'blue STEP 3 number badge sticker', color: '#3b82f6', tags: ['유튜브', '단계'] },
  ]

  for (const b of badges) {
    out.push({
      id: `youtube_${b.id}`,
      label: b.label,
      category: 'youtube',
      stickerSubject: b.subject,
      pathD: STATIC_PATHS.pill,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: b.color,
      defaultFill: b.color,
      defaultLineWidth: 2,
      defaultWidthRatio: 0.22,
      defaultHeightRatio: 0.1,
      tags: b.tags,
    })
  }

  const icons: { id: string; label: string; subject: string; color: string; tags: string[] }[] = [
    { id: 'bell', label: '구독 종', subject: 'golden YouTube subscribe notification bell icon sticker 3D', color: '#fbbf24', tags: ['유튜브', '구독'] },
    { id: 'thumbs_up', label: '좋아요', subject: 'blue thumbs up like icon sticker glossy 3D', color: '#3b82f6', tags: ['유튜브', '좋아요'] },
    { id: 'fire', label: '불꽃', subject: 'orange fire flame icon sticker hot trending', color: '#f97316', tags: ['유튜브', '불'] },
    { id: 'money', label: '돈주머니', subject: 'green money bag dollar icon sticker 3D', color: '#22c55e', tags: ['유튜브', '돈'] },
    { id: 'timer', label: '타이머', subject: 'red countdown timer clock icon sticker urgent', color: '#ef4444', tags: ['유튜브', '시간'] },
    { id: 'trending', label: '트렌딩', subject: 'green upward trending arrow chart icon sticker', color: '#22c55e', tags: ['유튜브', '트렌드'] },
    { id: 'play_btn', label: '재생 버튼', subject: 'big red YouTube play button triangle icon sticker 3D', color: '#ef4444', tags: ['유튜브', '재생'] },
    { id: 'shocked', label: '충격 표정', subject: 'shocked surprised emoji face sticker cartoon 3D', color: '#fbbf24', tags: ['유튜브', '표정'] },
    { id: 'pointing', label: '가리키는 손', subject: 'cartoon pointing hand finger at viewer sticker 3D', color: '#fbbf24', tags: ['유튜브', '손'] },
    { id: 'red_stamp', label: '빨간 도장', subject: 'red circular emphasis stamp circle outline sticker', color: '#ef4444', tags: ['유튜브', '강조'] },
    { id: 'question_big', label: '큰 물음표', subject: 'giant blue question mark icon sticker bold 3D', color: '#3b82f6', tags: ['유튜브', '물음'] },
    { id: 'exclamation_big', label: '큰 느낌표', subject: 'giant red exclamation mark icon sticker bold 3D', color: '#ef4444', tags: ['유튜브', '느낌'] },
    { id: 'won', label: '원화', subject: 'Korean won currency coin money icon sticker gold', color: '#fbbf24', tags: ['유튜브', '돈'] },
    { id: 'percent', label: '할인율', subject: 'red discount percent tag icon sticker sale', color: '#ef4444', tags: ['유튜브', '할인'] },
    { id: 'before_after', label: 'Before/After', subject: 'before and after comparison split arrow sticker', color: '#a855f7', tags: ['유튜브', '비교'] },
    { id: 'alert', label: '경고', subject: 'yellow warning alert triangle icon sticker', color: '#eab308', tags: ['유튜브', '경고'] },
    { id: 'prohibit', label: '금지', subject: 'red prohibition no sign circle slash icon sticker', color: '#ef4444', tags: ['유튜브', '금지'] },
    { id: 'crown', label: '왕관', subject: 'golden crown king premium icon sticker 3D', color: '#fbbf24', tags: ['유튜브', '왕관'] },
    { id: 'gift', label: '선물', subject: 'red gift box present icon sticker 3D', color: '#ef4444', tags: ['유튜브', '선물'] },
    { id: 'megaphone', label: '확성기', subject: 'red megaphone announcement icon sticker loud', color: '#ef4444', tags: ['유튜브', '공지'] },
  ]

  for (const ic of icons) {
    out.push({
      id: `youtube_${ic.id}`,
      label: ic.label,
      category: 'youtube',
      stickerSubject: ic.subject,
      pathD: STATIC_PATHS.circle,
      viewBoxW: 100,
      viewBoxH: 100,
      defaultColor: ic.color,
      defaultFill: ic.color,
      defaultLineWidth: 2,
      defaultWidthRatio: 0.16,
      defaultHeightRatio: 0.16,
      tags: ic.tags,
    })
  }
}

function buildAllPresets(): ElementPresetDef[] {
  const out: ElementPresetDef[] = []
  pushArrowPresets(out)
  pushLinePresets(out)
  pushShapePresets(out)
  pushBadgePresets(out)
  pushBubblePresets(out)
  pushFramePresets(out)
  pushIconPresets(out)
  pushDecorationPresets(out)
  pushYoutubePresets(out)
  return out
}

export const ELEMENT_PRESETS: readonly ElementPresetDef[] = buildAllPresets()

const presetById = new Map(ELEMENT_PRESETS.map((p) => [p.id, p]))

export function getElementPreset(id: string): ElementPresetDef | undefined {
  return presetById.get(id)
}

export function countElementPresets(): number {
  return ELEMENT_PRESETS.length
}

const ARROW_DIR: Record<number, string> = {
  0: 'pointing right',
  45: 'pointing down-right',
  90: 'pointing down',
  135: 'pointing down-left',
  180: 'pointing left',
  225: 'pointing up-left',
  270: 'pointing up',
  315: 'pointing up-right',
}

const ARROW_STYLE: Record<string, string> = {
  block: 'bold glossy red 3D arrow',
  thin: 'minimal red arrow line',
  chevron: 'red chevron arrow',
  double: 'red double-headed arrow',
  curved: 'curved glossy red arrow',
  hand: 'cartoon yellow pointing hand cursor',
}

/** presetId·라벨 → Replicate 프롬프트용 영문 주제 */
export function resolveStickerSubject(p: ElementPresetDef): string {
  if (p.stickerSubject?.trim()) return p.stickerSubject.trim()

  const id = p.id
  if (id.startsWith('arrow_')) {
    const [, style, angleStr] = id.split('_')
    const angle = Number(angleStr)
    return `${ARROW_STYLE[style] ?? 'bold red arrow'} ${ARROW_DIR[angle] ?? 'pointing right'}`
  }
  if (id.startsWith('line_')) {
    const kind = id.replace('line_', '')
    if (kind.startsWith('thick')) return `thick ${p.label} accent bar`
    const map: Record<string, string> = {
      h: 'horizontal yellow highlight line',
      v: 'vertical yellow highlight line',
      diag: 'diagonal yellow line',
      diag2: 'diagonal yellow line',
      zigzag: 'red zigzag lightning line',
      wave: 'blue wavy line',
      dash: 'dashed white line',
      brush: 'yellow brush stroke paint line',
      swoosh: 'red dynamic swoosh speed line',
      swoosh2: 'blue dynamic swoosh speed line',
      scribble: 'white hand-drawn scribble line',
      double: 'double parallel accent lines',
      arrowEnd: 'red line ending with arrow head',
      connector: 'green curved connector line',
      bracketH: 'white horizontal text box outline bracket',
    }
    if (kind.startsWith('neon')) return `glowing neon ${p.label} accent bar`
    return map[kind] ?? 'bold accent line'
  }
  if (id.startsWith('shape_')) {
    if (id.includes('polygon')) return `${p.label} geometric shape badge`
    if (id.includes('star')) return `${p.label} golden star badge`
    const key = id.replace('shape_', '')
    const map: Record<string, string> = {
      circle: 'solid red circle badge',
      square: 'red square frame',
      roundedRect: 'rounded rectangle badge',
      diamond: 'red diamond gem',
      triangleUp: 'red upward triangle',
      triangleDown: 'red downward triangle',
      triangleLeft: 'red left triangle',
      triangleRight: 'red right triangle',
      heart: 'glossy red heart',
      cross: 'bold red plus cross',
      plus: 'bold white plus sign',
      minus: 'bold white minus bar',
      ring: 'golden ring circle outline',
      semicircle: 'red semicircle badge',
      dot: 'solid red circle dot',
    }
    return map[key] ?? `${p.label} shape sticker`
  }
  if (id.startsWith('badge_')) {
    if (id.includes('circle')) return `round ${p.label} sticker badge`
    return `${p.label} ribbon banner badge`
  }
  if (id.startsWith('bubble_')) return `comic ${p.label} speech bubble`
  if (id.startsWith('frame_')) return `${p.label} photo frame outline`
  if (id.startsWith('icon_')) return `${p.label} glossy icon sticker`
  if (id.startsWith('deco_')) {
    if (id.includes('marker')) return `${p.label} marker pen underline sticker`
    const key = id.replace('deco_', '')
    const map: Record<string, string> = {
      underline: 'yellow text underline marker sticker',
      underlineWavy: 'wavy yellow underline decoration sticker',
      underlineDouble: 'double yellow underline decoration sticker',
      underlineScribble: 'hand-drawn scribble underline sticker',
      strikethrough: 'red strikethrough line decoration sticker',
      highlight: 'yellow highlighter marker stroke sticker',
      brushMark: 'yellow brush highlight mark sticker',
      circleMark: 'red hand-drawn circle emphasis sticker',
      cornerBrackets: 'white corner bracket text highlight sticker',
      speedLines: 'manga speed lines motion sticker',
      shockBurst: 'comic shock burst explosion sticker',
      swooshLeft: 'red left swoosh motion sticker',
      swooshRight: 'red right swoosh motion sticker',
      sparkle: 'golden sparkle star decoration sticker',
    }
    if (key.startsWith('dot_row')) return `colorful dot row decoration sticker`
    return map[key] ?? `${p.label} highlight decoration sticker`
  }
  if (id.startsWith('youtube_')) {
    return p.stickerSubject?.trim() || `${p.label} YouTube thumbnail sticker`
  }

  return `${p.label} YouTube thumbnail sticker`
}

export function elementStickerPublicPath(presetId: string): string {
  const safe = presetId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `/thumbnail-studio/elements/${safe}.png`
}
