import type { Voice } from './elevenlabs';

/** 클라이언트에서도 쓰는 Gemini 기본 목소리 목록 (서버 전용 모듈 import 없이) */
export const GEMINI_VOICES: Voice[] = [
  { id: 'Puck', name: 'Puck (남성, 경쾌·업비트)' },
  { id: 'Charon', name: 'Charon (남성, 차분한 정보 전달)' },
  { id: 'Fenrir', name: 'Fenrir (남성, 흥분·텐션)' },
  { id: 'Orus', name: 'Orus (남성, 단단함)' },
  { id: 'Enceladus', name: 'Enceladus (남성, 숨소리 섞인 부드러움)' },
  { id: 'Iapetus', name: 'Iapetus (남성, 또렷함)' },
  { id: 'Algenib', name: 'Algenib (남성, 거친 질감)' },
  { id: 'Sadachbia', name: 'Sadachbia (남성, 활기)' },
  { id: 'Kore', name: 'Kore (여성, 단단·자신감)' },
  { id: 'Aoede', name: 'Aoede (여성, 산뜻·경쾌)' },
  { id: 'Leda', name: 'Leda (여성, 젊고 발랄)' },
  { id: 'Zephyr', name: 'Zephyr (여성, 밝음)' },
  { id: 'Autonoe', name: 'Autonoe (여성, 또렷함)' },
  { id: 'Despina', name: 'Despina (여성, 부드러움)' },
  { id: 'Laomedeia', name: 'Laomedeia (여성, 업비트)' },
  { id: 'Sulafat', name: 'Sulafat (여성, 따뜻함)' },
];
