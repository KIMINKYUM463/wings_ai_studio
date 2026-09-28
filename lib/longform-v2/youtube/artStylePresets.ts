/** 그림체.docx — NEW 탭 프리셋 (장면·썸네일·인트로 공통 SSOT) */
import { HQ_STICKMAN_STYLE_TAG } from './hqStickmanAnatomy'
import {
  LOW_POLY_DIORAMA_DARK_STYLE_PROMPT,
  LOW_POLY_DIORAMA_STYLE_PROMPT,
} from './lowPolyDioramaStyle'

export const ART_STYLE_PRESET_CATEGORY = 'NEW' as const

export const BEIGE_STICKMAN_STYLE_ID = 'beige-stickman-selfhelp' as const

export type BeigeStickmanFigureColor = 'black' | 'white'

const BEIGE_STICKMAN_BLACK_PROMPT =
  'simple emotional stickman illustration, thin black stick figure with round head, no detailed facial features except minimal eyes and mouth for emotion, standing beside a large object or obstacle, thick clean outlines, slightly rough hand-drawn line texture, background can vary depending on the scene theme, subtle shading and grain texture, no color except black lines and light background tone, empty space for text placement, cinematic framing, inspirational and minimal storytelling style, no text, no icon, no numbers, no chart'

const BEIGE_STICKMAN_WHITE_PROMPT =
  'simple emotional stickman illustration, thin white stick figure with solid white (#FFFFFF) round head and white limbs, subtle thin dark-gray outline for edge readability only, minimal dark dot eyes and simple line mouth for emotion, no flesh tone or peach skin color on the figure, standing beside a large object or obstacle, thick clean outlines, slightly rough hand-drawn line texture, warm medium beige-to-tan paper background (darker than the black-line variant so the white figure reads clearly), background can vary depending on the scene theme, subtle shading and grain texture, figure rendered in white only, empty space for text placement, cinematic framing, inspirational and minimal storytelling style, no text, no icon, no numbers, no chart'

export function isBeigeStickmanStyleTemplate(templateId: string | undefined): boolean {
  return (templateId ?? '').trim() === BEIGE_STICKMAN_STYLE_ID
}

export function normalizeBeigeStickmanFigureColor(raw: unknown): BeigeStickmanFigureColor {
  return raw === 'white' ? 'white' : 'black'
}

export function resolveBeigeStickmanStylePrompt(color: BeigeStickmanFigureColor = 'black'): string {
  return color === 'white' ? BEIGE_STICKMAN_WHITE_PROMPT : BEIGE_STICKMAN_BLACK_PROMPT
}

export type ArtStylePreset = {
  id: string
  label: string
  hue: number
  promptEn: string
  recommendKo?: string
}

export const ART_STYLE_PRESETS: ArtStylePreset[] = [
  {
    id: 'oil-impressionist',
    label: '유화풍',
    hue: 38,
    promptEn:
      'ultra realistic impressionist oil painting style, thick visible brushstrokes, rich canvas texture, soft warm sunlight, cinematic atmosphere and depth, subtle diffusion of light and shadow, muted pastel tones with gentle gold and ivory highlights, artistic realism with painterly texture, inspired by John Singer Sargent and Edward Hopper, balanced composition and storytelling perspective, elegant color harmony, high-resolution fine art, 4K oil on canvas aesthetic, high quality digital reproduction, realistic lighting and natural skin tones, no text, no icon, no numbers, no chart',
    recommendKo: '예술, 문화, 역사, 철학, 문학, 스토리텔링, 명언, 세계사 (예: 1920년대 미국, 파리 등)',
  },
  {
    id: 'myth-2d-animation',
    label: '2D 신화 애니',
    hue: 220,
    promptEn:
      'Cinematic mythological animation style inspired by "Blood of Zeus" and "Castlevania". A detailed, hand-drawn look with expressive eyes, realistic proportions, and elegant shading. Smooth cel-shaded texture with soft gradient lighting and painterly depth. Warm, slightly desaturated color palette — ivory, bronze, ocean blue, and golden sunlight tones. Camera framed in a cinematic composition, emphasizing atmosphere and emotion. Lighting: balanced between divine glow and natural realism. Mood: reflective, noble, mythic, timeless. 4K ultra-clean animation texture with subtle linework and cinematic color grading. No text, no icons, no graphs, no charts, with Greek and Roman mythology as the background',
    recommendKo: '그리스·로마 신화, 북유럽 신화, 성경·고대 종교, 고대 전쟁, 영웅 스토리, 동양 신화, 삼국지, 고대 사극',
  },
  {
    id: 'joseon-oriental',
    label: '동양풍',
    hue: 42,
    promptEn:
      'traditional Joseon dynasty inspired illustration, realistic historical Korean painting style, beige aged parchment or hanji paper background, soft muted earthy colors, subtle ink and brushstroke texture, cinematic wide composition, calm and timeless historical atmosphere, traditional architecture, mountains or palace scenery in the background, natural lighting with gentle shadows, no text, no icon, no numbers, no chart',
    recommendKo: '한국 역사, 동양사, 세계사',
  },
  {
    id: 'beige-stickman-selfhelp',
    label: '베이지 스틱맨',
    hue: 35,
    promptEn:
      'simple emotional stickman illustration, thin black stick figure with round head, no detailed facial features except minimal eyes and mouth for emotion, standing beside a large object or obstacle, thick clean outlines, slightly rough hand-drawn line texture, background can vary depending on the scene’s theme, subtle shading and grain texture, no color except black lines and light background tone, empty space for text placement, cinematic framing, inspirational and minimal storytelling style, no text, no icon, no numbers, no chart',
    recommendKo: '한국·동양·세계사, 철학·심리, 동기부여, 자기계발',
  },
  {
    id: 'emotional-3d-illustration',
    label: '감성 3D 일러',
    hue: 28,
    promptEn:
      'realistic emotional illustration, soft cinematic lighting, gentle shadows, natural skin texture, detailed facial expressions, slightly desaturated warm tones, subtle film grain, painterly realism with hand-drawn texture, story-driven composition, background softly blurred for depth, inspired by realistic digital illustration and emotional storytelling artworks, no cartoon exaggeration, no anime features, natural proportions, high resolution, 4K digital painting, no text, no icon, no numbers, no chart',
    recommendKo: '역사, 세계사, 동기부여, 심리·감정, 문학·스토리텔링, 예술, 철학, 종교·신화',
  },
  {
    id: 'korean-realistic-portrait',
    label: '한국인 실사',
    hue: 210,
    promptEn:
      'highly realistic photograph of a Korean person, natural facial features, smooth and clean skin with no moles or freckles, no blemishes, even skin tone, calm neutral expression, cinematic lighting, shot on 85mm lens, shallow depth of field, realistic eyes and facial proportions, looks like a real photo from a Korean drama, clean realistic background, no surreal or abstract elements, no text, no icon, no numbers, no chart',
    recommendKo: '스토리텔링, 감동 실화, 다큐, 인물 중심, 드라마풍, 심리·감정, 인터뷰',
  },
  {
    id: 'pixel-art',
    label: '픽셀',
    hue: 285,
    promptEn:
      'high-resolution pixel art style, 2D side-scroller or RPG game aesthetic, clear pixel grid, limited color palette, clean shading with soft gradients, detailed characters and background but still pixelated, retro SNES / indie game vibe, smooth lighting and shadow in pixel format, minimal outlines, no blur or painterly texture, evokes nostalgic game atmosphere, no text, no icon, no numbers, no chart',
  },
  {
    id: 'blender-3d',
    label: 'Blender 3D',
    hue: 175,
    promptEn:
      'high-quality Blender 3D render style, realistic PBR materials, physically accurate lighting and shadows, detailed textures, cinematic camera composition, depth of field, subtle atmospheric fog or light scattering, natural color grading, smooth geometry with realistic surface imperfections, looks like a frame from a 3D animated film or Unreal Engine render, no cartoon outlines, no flat shading, no text, no icon, no numbers, no chart',
  },
  {
    id: 'nordic-docu',
    label: '노르딕 다큐',
    hue: 195,
    promptEn:
      'cinematic nordic documentary style, cold desaturated color palette, wide landscape composition, misty mountains, pine forests, foggy lakes, natural soft lighting, realistic textures, subtle grain and atmospheric depth, quiet and melancholic mood, inspired by Scandinavian nature photography, no fantasy elements, no text, no icon, no numbers, no chart',
  },
  {
    id: 'watercolor-storybook',
    label: '수채화 스토리북',
    hue: 318,
    promptEn:
      'soft watercolor illustration, textured paper background, light bleeding edges, hand-painted brush strokes, muted pastel colors, gentle gradients, calm and poetic atmosphere, storybook style, minimal linework, historical or emotional storytelling tone, no text, no icon, no numbers, no chart',
  },
  {
    id: 'crayon-pastel-sketch',
    label: '크레용·파스텔',
    hue: 48,
    promptEn:
      'rough crayon and pastel drawing style, hand-drawn texture with visible strokes, uneven pressure marks, soft dusty colors, childlike yet emotional expression, slightly messy lines, paper grain visible, no digital polish, raw and honest mood, no text, no icon, no numbers, no chart',
  },
  {
    id: 'film-noir',
    label: '필름 누아르',
    hue: 245,
    promptEn:
      'film noir style, high-contrast black and white, dramatic shadows, vintage 1940s lighting, cinematic composition, moody atmosphere, subtle film grain, wet city streets or dim alleyways, melancholic and mysterious tone, no text, no icon, no numbers, no chart',
  },
  {
    id: 'dark-classical-oil',
    label: '어두운 유화',
    hue: 32,
    promptEn:
      'classical oil painting style, expressive thick brush strokes, rich layered background, detailed environment depth, architectural or atmospheric background elements, dynamic composition, balanced color palette, neutral white lighting, realistic skin tones, cool-neutral highlights, natural contrast, deep but true shadows, high detail, painterly texture without canvas cracks, vivid but refined colors, no yellow cast, no sepia tone, no muted earthy dominance, no warm filter, no vintage wash, no haze, no heavy brown tint, no text, no icon, no numbers, no chart',
  },
  {
    id: 'low-poly-diorama',
    label: '로우폴리 디오라마',
    hue: 118,
    promptEn: LOW_POLY_DIORAMA_STYLE_PROMPT,
  },
  {
    id: 'space-planet',
    label: '우주·행성',
    hue: 248,
    promptEn:
      'A cinematic wide-angle space illustration featuring a planet or celestial body (according to script context), viewed from near orbit or deep space, soft glowing atmosphere edge, subtle sunlight over the horizon, realistic cosmic lighting and volumetric depth, detailed surface textures and atmospheric scattering, surrounded by distant stars, nebulae, and galaxies, deep blue and dark violet color palette with luminous highlights, film-like contrast, ultra-realistic yet slightly stylized composition, wide panoramic framing, immersive scale, no text, no watermark, 4K clarity, consistent artistic style across variations, no text, no icon, no numbers, no chart',
  },
  {
    id: 'european-romanticism',
    label: '유럽·중세풍',
    hue: 14,
    promptEn:
      'A dramatic romanticism-style historical oil painting, dynamic composition filled with movement and emotion, characters (based on script context) portrayed in heroic or tragic poses, strong chiaroscuro lighting with warm highlights and deep shadows, expressive facial detail and textured brushstrokes, period-accurate costumes and props according to the era or story, dusty atmosphere with diffused sunlight and smoke, rich color palette of ochre, crimson, deep blue, and muted gray tones, painted on canvas with visible brush texture, grand sense of struggle and passion, cinematic realism, no text, no watermark, 4K clarity, consistent painterly style, no text, no icon, no numbers, no chart',
  },
  {
    id: 'cinematic-realistic-photo',
    label: '시네마 실사',
    hue: 208,
    promptEn:
      'realistic cinematic photo, drama style, soft natural lighting, shallow depth of field, detailed realistic textures, professional film still, muted color palette, 4K resolution, ultra high quality, natural composition, emotional tone, subtle contrast, realistic indoor atmosphere, no text, no icon, no numbers, no chart',
  },
  {
    id: 'hq-stickman',
    label: '고퀄 스틱맨',
    hue: 210,
    promptEn:
      `${HQ_STICKMAN_STYLE_TAG} Simple clothing, flat colors, Cyanide-and-Happiness tone, white (#FFF) face fill (no flesh tone), mid/wide shots focused on situation. Same stick-figure design every frame; 2 arms & 2 hands only. Background-only scenes OK when narration fits — match topic (not generic living room). No text, charts, or icons.`,
  },
  {
    id: 'low-poly-diorama-dark',
    label: '로우폴리 다크',
    hue: 265,
    promptEn: LOW_POLY_DIORAMA_DARK_STYLE_PROMPT,
  },
]

const presetById = new Map(ART_STYLE_PRESETS.map((p) => [p.id, p]))

export function isArtStylePresetCategory(category: string | undefined): boolean {
  return (category ?? '').trim() === ART_STYLE_PRESET_CATEGORY
}

export function resolveArtStylePresetPrompt(templateId: string | undefined): string | null {
  const id = (templateId ?? '').trim()
  if (!id) return null
  if (id === BEIGE_STICKMAN_STYLE_ID) return BEIGE_STICKMAN_BLACK_PROMPT
  return presetById.get(id)?.promptEn ?? null
}

export function resolveArtStylePresetRecommend(templateId: string | undefined): string | null {
  const id = (templateId ?? '').trim()
  if (!id) return null
  return presetById.get(id)?.recommendKo?.trim() || null
}

/** 저장된 customStylePrompt 없을 때 NEW 카테고리 프리셋에서 복원 */
export function resolveEffectiveCustomStylePrompt(
  category: string | undefined,
  templateId: string | undefined,
  storedPrompt?: string | null,
): string {
  const stored = (storedPrompt ?? '').trim()
  if (stored) return stored
  if (!isArtStylePresetCategory(category)) return ''
  return resolveArtStylePresetPrompt(templateId) ?? ''
}
