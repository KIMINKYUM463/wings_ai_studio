/** 배경음악: Google Lyria(lyria-3.5)로 영상마다 새로 생성 → 저작권 걱정 없는 BGM */
export const BGM_MOODS = [
  { id: 'upbeat', name: '밝고 경쾌한 팝', prompt: 'Bright upbeat pop for a Korean shopping short video: bouncy plucked synths, claps, light four-on-the-floor drums, happy and catchy' },
  { id: 'chill', name: '잔잔한 로파이', prompt: 'Chill lo-fi hip hop beat: warm keys, soft vinyl texture, relaxed laid-back drums, cozy' },
  { id: 'tension', name: '궁금증·반전 긴장감', prompt: 'Mysterious suspenseful pulse for a reveal story: ticking percussion, low synth bass, building curiosity, modern and sleek' },
  { id: 'tropical', name: '트로피컬 여행', prompt: 'Tropical house travel vibe: marimba, airy pads, steel-drum accents, sunny beach energy, feel-good vacation' },
  { id: 'cinematic', name: '감성 시네마틱', prompt: 'Inspiring cinematic travel score: soft piano, warm strings, gentle uplifting build, emotional but light' },
  { id: 'funky', name: '유쾌한 펑키', prompt: 'Playful funky groove: slap bass, muted guitar, quirky percussion, comedic and energetic' },
] as const;
export type BgmMood = (typeof BGM_MOODS)[number]['id'];

export const defaultMood = (mode?: string): BgmMood => (mode === 'travel' ? 'tropical' : mode === 'ssul' ? 'upbeat' : 'upbeat');

