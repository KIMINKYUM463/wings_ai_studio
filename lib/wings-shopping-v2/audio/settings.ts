import type { FxSettings, Project } from '../types';
import { BGM_MOODS, defaultMood } from './moods';
import { isMotionPreset, isSfxPreset } from '../fx-presets';

/** 프로젝트 효과 설정 (저장된 값이 없으면 전부 켜짐 + 모드별 분위기) */
export function fxSettings(p: Pick<Project, 'fx' | 'mode'>): Required<FxSettings> {
  const f = p.fx;
  return {
    bgm: f?.bgm ?? true,
    mood: f?.mood && BGM_MOODS.some((m) => m.id === f.mood) ? f.mood : defaultMood(p.mode),
    bgmTrackId: typeof f?.bgmTrackId === 'string' ? f.bgmTrackId : '',
    bgmVolume: f?.bgmVolume ?? 0.18,
    sfx: f?.sfx ?? true,
    motion: f?.motion ?? true,
    sfxPreset: isSfxPreset(f?.sfxPreset) ? f.sfxPreset : 'viral',
    motionPreset: isMotionPreset(f?.motionPreset) ? f.motionPreset : 'full',
    seed: typeof f?.seed === 'number' ? f.seed : 0,
  };
}

/** 편집기 미리보기 배경음악 크기: 렌더는 나레이션 동안 배경음악을 크게 눌러 주므로(sidechain) 미리보기도 그만큼 작게 */
export const previewBgmVolume = (v: number) => Math.min(1, Math.max(0, v * 0.55));

/** PATCH 입력 → 안전한 설정 */
export function mergeFx(cur: Required<FxSettings>, n: Partial<FxSettings>): Required<FxSettings> {
  return {
    bgm: typeof n.bgm === 'boolean' ? n.bgm : cur.bgm,
    mood: typeof n.mood === 'string' && BGM_MOODS.some((m) => m.id === n.mood) ? n.mood : cur.mood,
    bgmTrackId: typeof n.bgmTrackId === 'string' ? n.bgmTrackId.slice(0, 80) : cur.bgmTrackId,
    bgmVolume: typeof n.bgmVolume === 'number' && Number.isFinite(n.bgmVolume) ? Math.min(0.5, Math.max(0.03, n.bgmVolume)) : cur.bgmVolume,
    sfx: typeof n.sfx === 'boolean' ? n.sfx : cur.sfx,
    motion: typeof n.motion === 'boolean' ? n.motion : cur.motion,
    sfxPreset: isSfxPreset(n.sfxPreset) ? n.sfxPreset : cur.sfxPreset,
    motionPreset: isMotionPreset(n.motionPreset) ? n.motionPreset : cur.motionPreset,
    seed: typeof n.seed === 'number' && Number.isFinite(n.seed) ? Math.abs(Math.floor(n.seed)) % 100000 : cur.seed,
  };
}
