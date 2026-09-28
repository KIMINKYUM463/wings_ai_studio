/** WingsStudio 장면 스타일 + 이미지 모델 (샘플 webp: /scene-style-samples) */

export type StyleCategory =
  | "실사"
  | "애니메이션"
  | "일러스트"
  | "캐릭터"
  | "전통화"
  | "NEW"

export type StyleItem = {
  id: string
  label: string
  hue: number
  hint: string
  recommended?: boolean
}

/** WingsStudio sceneStyleCatalog 별칭 (확장 카테고리 포함) */
export type SceneStyleCategory =
  | StyleCategory
  | "정보성 캐릭터"
  | "ppt-korean-explain"
export type SceneStyleItem = StyleItem


export const STYLE_CATEGORIES: { id: StyleCategory; label: string; slug: string }[] = [
  { id: "실사", label: "실사화", slug: "realistic" },
  { id: "애니메이션", label: "애니메이션", slug: "animation" },
  { id: "일러스트", label: "일러스트", slug: "illustration" },
  { id: "캐릭터", label: "캐릭터", slug: "informational" },
  { id: "전통화", label: "옛날풍", slug: "traditional" },
  { id: "NEW", label: "NEW", slug: "new-presets" },
]

const CATEGORY_SLUG: Record<StyleCategory, string> = {
  실사: "realistic",
  애니메이션: "animation",
  일러스트: "illustration",
  캐릭터: "informational",
  전통화: "traditional",
  NEW: "new-presets",
}

function hintFrom(label: string, extra = ""): string {
  const base = `${label} visual style, high quality cinematic still, 16:9 aspect ratio`
  return extra ? `${extra}, ${base}` : base
}

function S(id: string, label: string, hue: number, extraHint = ""): StyleItem {
  return { id, label, hue, hint: hintFrom(label, extraHint) }
}

export const STYLE_CATALOG: Record<StyleCategory, StyleItem[]> = {
  실사: [
    S("senior", "시니어 라이프", 25, "photorealistic senior lifestyle"),
    S("docu-interview", "다큐·인터뷰", 188, "documentary interview still"),
    S("mystery-noir", "미스테리 느와르", 235, "mystery noir photography"),
    S("food-product-closeup", "푸드·제품 클로즈업", 32, "food product close-up"),
    S("festival", "축제·경사", 35, "festival celebration photography"),
    S("sports-action-still", "스포츠·액션 스틸", 118, "sports action still"),
    S("war-military", "전쟁·밀리터리 드라마", 28, "war military drama cinema"),
    S("kr-drama", "한국 드라마 시네마", 220, "korean drama cinematic"),
    S("sci-fi-epic", "우주 SF 에픽", 265, "sci-fi epic cinema"),
    S("fashion", "패션 화보", 320, "fashion editorial photography"),
    S("horror", "호러·공포", 260, "horror atmosphere photography"),
    S("realistic", "리얼리스틱 실사", 210, "cinematic photorealistic documentary"),
    S("comedy", "코미디·예능", 45, "comedy variety show still"),
    S("historical-drama", "역사극·사극", 38, "historical drama cinema"),
    S("greek-roman-myth-cinema", "그리스·로마 신화 시네마", 52),
    S("ancient-greece-temple-photo", "고대 그리스·신전 실사", 48),
    S("roman-empire-epic-photo", "로마 제국 에픽 실사", 22),
    S("world-history-docu-photo", "세계사 다큐 실사", 195),
    S("ancient-civilization-ruins", "고대 문명 유적 실사", 34),
    S("medieval-knight-cinema", "중세 유럽·기사 실사", 240),
    S("egypt-pyramid-desert-photo", "고대 이집트·사막 실사", 40),
    S("renaissance-palace-photo", "르네상스·궁전 실사", 355),
    S("romance", "로맨틱 드라마", 330),
    S("thriller", "스릴러", 245),
    S("disaster", "재난·아포칼립스", 15),
    S("fantasy", "에픽 판타지 전투", 280),
    S("epic-3d-game-trailer", "3D 게임 시네마", 268),
    S("info", "정보 전달 실사", 200),
    S("wedding-lifestyle-photo", "웨딩·스냅 실사", 348),
    S("newborn-family-soft", "신생아·가족 소프트 실사", 325),
    S("corporate-portrait-pro", "기업 프로필 실사", 208),
    S("real-estate-interior-photo", "인테리어 실사", 182),
    S("travel-vlog-still-photo", "여행 브이로그 스틸", 158),
    S("street-candid-photo", "스트리트 스냅 실사", 238),
    S("macro-nature-photo", "자연 매크로 사진", 112),
    S("nature-no-people-photo", "무인 자연 풍경 실사", 98),
    S("space-universe-photo", "우주·코스모스 실사", 248),
    S("planetary-space-photo", "행성·태양계 실사", 222),
    S("cinematic-anamorphic-photo", "시네마 아나모픽 실사", 262),
    S("golden-hour-portrait-photo", "골든아워 인물 실사", 32),
    S("neon-night-city-photo", "야간 네온 도시 실사", 292),
    S("infrared-landscape-photo", "환상적 적외선 풍경", 128),
    S("double-exposure-portrait-photo", "겹쳐진 인물 합성 실사", 278),
    S("wes-anderson-symmetry-photo", "대칭 파스텔 영화 실사", 42),
  ],
  캐릭터: [
    S("silhouette", "실루엣 캐릭터", 340),
    S("clay-stopmotion", "클레이·스톱모션", 162),
    S("isometric", "아이소메트릭 캐릭터", 175),
    S("minimal-infographic", "미니멀 인포 그래픽", 292),
    S("flat-design", "플랫 디자인 캐릭터", 200),
    S("chalkboard", "칠판 분필 캐릭터", 145),
    S("pixel-art", "픽셀아트 캐릭터", 285),
    S("stickman", "스틱맨", 210),
    S("skeleton-xray-char", "골격 투시 캐릭터", 195),
    S("watercolor-char", "수채화 캐릭터", 195),
    S("paper-cutout", "종이 컷아웃 캐릭터", 25),
    S("doodle", "두들 스타일 캐릭터", 48),
    S("line-art", "라인아트 캐릭터", 220),
  ],
  일러스트: [
    S("editorial-press", "에디토리얼 일러스트", 198),
    S("concept-art", "컨셉 아트", 265),
    S("childrens-watercolor", "어린이책 수채", 318),
    S("cute-character", "귀여운 캐릭터", 330),
    S("korean-webtoon-illust", "한국 웹툰풍", 230),
    S("book-cover", "북 커버", 350),
    S("gouache-poster", "구아슈 포스터 일러스트", 42),
    S("risograph-print", "리소그래프 인쇄풍", 305),
    S("vintage-magazine-illust", "빈티지 잡지 일러스트", 28),
    S("retro-scifi-pulp", "레트로 SF 펄프 일러", 212),
    S("botanical-scientific", "보태니컬 과학 일러", 102),
    S("art-nouveau-illust", "아르누보 장식 일러", 288),
    S("digital-collage-illust", "디지털 콜라주 일러", 18),
    S("surreal-painterly", "초현실 페인터리", 268),
    S("midcentury-flat-illust", "미드센추리 플랫 일러", 38),
    S("manga-ink-tone", "만화 먹선 톤 일러", 8),
    S("steampunk-victorian-illust", "증기 시대 모험 일러", 34),
    S("synthwave-outrun-illust", "네온 그리드 레트로", 298),
    S("art-deco-poster-illust", "기하 장식 포스터", 48),
    S("stained-glass-illust", "채색 유리창 일러", 252),
    S("bauhaus-graphic-illust", "기능주의 기하 일러", 14),
    S("moebius-scifi-illust", "얇은 선 SF 풍경", 188),
    S("glitch-digital-illust", "RGB 노이즈 글리치", 312),
    S("propaganda-poster-illust", "대담한 복고 포스터", 6),
    S("embroidery-textile-illust", "바느질 질감 일러", 338),
    S("graphite-pencil-sketch", "연필 스케치", 28),
  ],
  애니메이션: [
    S("school-anime", "학원물", 252),
    S("isekai-anime", "이세카이", 168),
    S("mecha-anime", "메카", 95),
    S("historical-comedy-webtoon", "사극 코미디 웹툰", 42),
    S("cyberpunk-anime", "사이버펑크 애니", 305),
    S("modern-anime", "모던 애니", 275),
    S("martial-fantasy-webtoon", "무협·판타지 웹툰", 20),
    S("romance-webtoon", "로맨스·순정 웹툰", 325),
    S("thriller-horror-webtoon", "스릴러·공포 웹툰", 265),
    S("daily-comedy-webtoon", "일상·코미디 웹툰", 45),
    S("superhero-action", "슈퍼히어로 액션", 215),
    S("joseon-tale-anime", "조선야담 애니", 28),
    S("historical-rural-webtoon", "역사 시골 웹툰", 88),
    S("korean-history-illust", "한국 역사 풍", 55),
    S("rotoscope-animation", "실사 추적 애니풍", 142),
    S("rubber-hose-1930s-cartoon", "통통한 30년대 만화", 62),
    S("dieselpunk-animation", "기계 시대 모험 애니", 38),
    S("jib-painterly-anime", "지브 풍 애니", 118),
    S("retro-us-tv-cartoon", "옛날 TV 만화 컬러", 52),
  ],
  전통화: [
    S("ink-landscape-wide", "산수 장경", 172),
    S("buddhist-gold-art", "불화·금색", 52),
    S("korean-folk", "한국 민화", 48),
    S("east-asian-ink", "동아시아 수묵", 210),
    S("joseon-folk", "조선야담 민화", 32),
    S("hanji-folk-texture", "한지 질감 민화", 36),
    S("dancheong-ornament", "단청 문양 화풍", 198),
    S("crane-pine-classic", "학·소나무 고전", 178),
    S("scholar-studio-scene", "서재 문인 풍경", 218),
    S("tiger-minhwa-bold", "호랑이 민화 선명", 26),
    S("peony-screen-panel", "모란·새 병풍", 332),
    S("temple-mural-mood", "사찰 벽화 분위기", 46),
    S("folk-play-festival", "민속 놀이 장면", 58),
    S("lotus-pond-sumook", "연못 수묵", 165),
    S("palace-royal-palette", "궁궐 왕실 색채", 14),
  ],
  NEW: [
    S("oil-impressionist", "유화풍", 38, "impressionist oil painting"),
    S("myth-2d-animation", "2D 신화 애니", 220),
    S("joseon-oriental", "동양풍", 42),
    S("beige-stickman-selfhelp", "베이지 스틱맨", 35),
    S("emotional-3d-illustration", "감성 3D 일러", 28),
    S("korean-realistic-portrait", "한국인 실사", 210),
    S("pixel-art", "픽셀", 285),
    S("blender-3d", "Blender 3D", 175),
    S("nordic-docu", "노르딕 다큐", 195),
    S("watercolor-storybook", "수채화 스토리북", 318),
    S("crayon-pastel-sketch", "크레용·파스텔", 48),
    S("film-noir", "필름 누아르", 245),
    S("dark-classical-oil", "어두운 유화", 32),
    S("low-poly-diorama", "로우폴리 디오라마", 118),
    S("space-planet", "우주·행성", 248),
    S("european-romanticism", "유럽·중세풍", 14),
    S("cinematic-realistic-photo", "시네마 실사", 208),
    S("hq-stickman", "고퀄 스틱맨", 210),
    S("low-poly-diorama-dark", "로우폴리 다크", 265),
  ],
}

/** WingsStudio SCENE_IMAGE_MODEL_OPTIONS 와 동일 */
export const IMAGE_MODEL_GROUPS: {
  id: string
  label: string
  hint: string
  models: { id: string; label: string; desc: string; badge?: string }[]
}[] = [
  {
    id: "featured",
    label: "추천",
    hint: "Z-Image Turbo · Qwen · 나노바나나 2",
    models: [
      {
        id: "prunaai/z-image-turbo",
        label: "Z-Image Turbo",
        desc: "Replicate · 추천모델 (1920×1080)",
        badge: "Turbo",
      },
      {
        id: "qwen/qwen-image",
        label: "Qwen Image",
        desc: "Replicate · 베이직모델 (반실사)",
        badge: "Qwen",
      },
      {
        id: "nano2",
        label: "나노바나나 2",
        desc: "Gemini 나노바나나 2 (기본 권장)",
        badge: "한글",
      },
    ],
  },
  {
    id: "gemini",
    label: "Gemini",
    hint: "Google API 키",
    models: [
      {
        id: "standard",
        label: "나노바나나 1",
        desc: "Gemini 나노바나나 1",
        badge: "Gemini",
      },
    ],
  },
  {
    id: "replicate",
    label: "Replicate",
    hint: "Replicate API 키",
    models: [
      {
        id: "black-forest-labs/flux-pro",
        label: "FLUX Pro",
        desc: "Replicate · 고품질",
        badge: "FLUX",
      },
      {
        id: "black-forest-labs/flux-schnell",
        label: "FLUX Schnell",
        desc: "Replicate · 빠른 생성",
        badge: "FLUX",
      },
      { id: "google/imagen-4-fast", label: "Imagen 4 Fast", desc: "Replicate" },
      { id: "prunaai/hidream-l1-fast", label: "HiDream L1 Fast", desc: "Replicate" },
      {
        id: "minimax/image-01",
        label: "MiniMax Image-01",
        desc: "Replicate · 16:9",
      },
    ],
  },
]

export const DEFAULT_IMAGE_STYLE_ID = "realistic"
export const DEFAULT_IMAGE_STYLE_LABEL = "리얼리스틱 실사"
export const DEFAULT_IMAGE_MODEL = "nano2"

export function sceneStyleSampleUrl(category: StyleCategory, styleId: string): string {
  return `/scene-style-samples/${CATEGORY_SLUG[category]}/${styleId}.webp`
}

export function styleThumbDataUrl(hue: number, label: string, styleId: string): string {
  const gid = `sg_${hue}_${styleId.replace(/[^a-zA-Z0-9_-]/g, "_")}`
  const title = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 55% 28%)"/>
      <stop offset="55%" stop-color="hsl(${(hue + 28) % 360} 48% 18%)"/>
      <stop offset="100%" stop-color="hsl(${(hue + 60) % 360} 40% 12%)"/>
    </linearGradient>
  </defs>
  <rect width="320" height="200" fill="url(#${gid})"/>
  <rect x="12" y="12" width="296" height="176" rx="10" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.12)"/>
  <text x="24" y="168" fill="rgba(255,255,255,0.92)" font-family="Segoe UI, Noto Sans KR, sans-serif" font-size="16" font-weight="700">${title}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function findStyleById(id: string): (StyleItem & { category: StyleCategory }) | null {
  for (const cat of Object.keys(STYLE_CATALOG) as StyleCategory[]) {
    const hit = STYLE_CATALOG[cat].find((s) => s.id === id)
    if (hit) return { ...hit, category: cat }
  }
  return null
}

export function categoryOfStyle(id: string): StyleCategory {
  return findStyleById(id)?.category || "실사"
}

/** WingsStudio `sceneStyleCatalog` 호환 별칭 */
export const SCENE_STYLE_CATALOG: Record<string, SceneStyleItem[]> = {
  ...STYLE_CATALOG,
  "정보성 캐릭터": STYLE_CATALOG["캐릭터"],
  "ppt-korean-explain": STYLE_CATALOG["일러스트"] ?? STYLE_CATALOG["실사"],
}

export function sceneStyleCategoryLabel(category: string): string {
  const hit = STYLE_CATEGORIES.find((c) => c.id === category)
  if (hit) return hit.label
  if (category === "정보성 캐릭터") return "캐릭터"
  if (category === "ppt-korean-explain") return "PPT 설명"
  return category
}

export function sceneStyleSampleDataUrl(category: StyleCategory, styleId: string): string {
  const item = (STYLE_CATALOG[category] ?? STYLE_CATALOG["실사"]).find((s) => s.id === styleId)
  if (item) return styleThumbDataUrl(item.hue, item.label, item.id)
  return styleThumbDataUrl(210, styleId, styleId)
}

