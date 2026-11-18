import data from './playbook.json';
import travelData from '../travel/playbook.json';
import reviewData from '../review/playbook.json';

/**
 * 썰 쇼핑숏폼 대본 플레이북.
 * 유튜브 썰 쇼핑 채널 10곳의 조회수 상위 쇼츠 117개를 문장 단위로 분석해 만든 구조·패턴 모음
 * (docs/ssul-stats.json, docs/ssul-templates-observed.md 참고).
 */
export type Beat = { role: string; purpose: string; share: number; sentences: number; guidance: string; patterns: string[] };
export type Structure = {
  id: string; name: string; oneLiner: string; whenToUse: string; evidence: string; targetSeconds: number; register: string; beats: Beat[];
};
export type Angle = { id: string; name: string; description: string; titlePattern: string; bestStructures: string[] };
export type Pattern = { pattern: string; example?: string; type?: string; whyItWorks?: string; note?: string };
export type Tone = { id: string; name: string; register: string; endings: string[]; sentenceChars: string; example: string; whenToUse: string };

export type Playbook = {
  genre: string;
  summary: string;
  structures: Structure[];
  angles: Angle[];
  hookPatterns: Pattern[];
  titleFormulas: Pattern[];
  productTransitions: Pattern[];
  twistDevices: Pattern[];
  proofDevices: Pattern[];
  ctaPatterns: Pattern[];
  toneProfiles: Tone[];
  pacing: { charsPerSecond: number; sentencesPerVideo: string; productFirstMentionSec: string; notes: string[] };
  rules: { do: string[]; dont: string[] };
};

export const PLAYBOOK = { genre: '썰 쇼핑 숏폼', ...(data as object) } as unknown as Playbook;
export const TRAVEL_PLAYBOOK = { genre: '여행 쇼핑 숏폼', ...(travelData as object) } as unknown as Playbook;

/** 리뷰·랭킹 쇼핑 숏폼: 국내 36 + 해외 20개 상위 쇼츠 실측 (docs/review-stats.json) */
export const REVIEW_PLAYBOOK = { genre: '리뷰·랭킹 쇼핑 숏폼', ...(reviewData as object) } as unknown as Playbook;

export const getPlaybook = (mode?: string): Playbook => (mode === 'travel' ? TRAVEL_PLAYBOOK : mode === 'review' ? REVIEW_PLAYBOOK : PLAYBOOK);

export const getStructure = (id?: string, pb: Playbook = PLAYBOOK) => pb.structures.find((s) => s.id === id) ?? pb.structures[0];
export const getTone = (id?: string, pb: Playbook = PLAYBOOK) => pb.toneProfiles.find((t) => t.id === id) ?? pb.toneProfiles[0];
export const getAngle = (id?: string, pb: Playbook = PLAYBOOK) => pb.angles.find((a) => a.id === id) ?? null;
