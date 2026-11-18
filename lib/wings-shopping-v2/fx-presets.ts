/** 효과음·모션그래픽 템플릿 (효과음 탭에서 고르고, 미리보기·렌더가 같이 쓴다) */
export type SfxPreset = 'viral' | 'soft' | 'minimal';
export type MotionPreset = 'full' | 'clean' | 'badge';

export const SFX_PRESETS: { id: SfxPreset; name: string; description: string }[] = [
  { id: 'viral', name: '바이럴', description: '오프닝 훅·장면 전환·문장 중간 포인트까지 또렷하게 (기본)' },
  { id: 'soft', name: '잔잔하게', description: '오프닝·장면 전환·마무리만 작게' },
  { id: 'minimal', name: '최소', description: '오프닝 한 번과 마무리 띵동만' },
];

export const MOTION_PRESETS: { id: MotionPreset; name: string; description: string }[] = [
  { id: 'full', name: '풀 모션', description: '장면 전환(줌·빛) · 제품 강조 스냅 줌 · 숫자 스티커 · 핵심 확대샷 · POINT·CTA 배지 (기본)' },
  { id: 'clean', name: '깔끔하게', description: '핵심 확대샷과 마지막 CTA 배지만' },
  { id: 'badge', name: '배지만', description: '영상은 그대로 두고 POINT·CTA 배지만' },
];

export const isSfxPreset = (v: unknown): v is SfxPreset => SFX_PRESETS.some((x) => x.id === v);
export const isMotionPreset = (v: unknown): v is MotionPreset => MOTION_PRESETS.some((x) => x.id === v);
