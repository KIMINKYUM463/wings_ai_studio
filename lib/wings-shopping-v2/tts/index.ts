import type { CharAlignment } from '../types';
import * as eleven from './elevenlabs';
import { googleTts, listGoogleVoices } from './google';
import { geminiTts, listGeminiVoices } from './gemini';
import { geminiApiKey } from '../gemini-key';
import type { Voice } from './elevenlabs';

export type { Voice };

/** TTS_PROVIDER: gemini(기본) | google | elevenlabs */
export function provider(): 'gemini' | 'google' | 'elevenlabs' {
  const p = process.env.TTS_PROVIDER;
  if (p === 'gemini' || p === 'google' || p === 'elevenlabs') return p;
  if (geminiApiKey()) return 'gemini';
  return process.env.GOOGLE_TTS_API_KEY ? 'google' : 'elevenlabs';
}

export function synthesize(
  text: string, voiceId: string, speed: number, ctx: { prev?: string; next?: string; style?: string; lang?: string }, outMp3: string,
): Promise<{ duration: number; alignment: CharAlignment }> {
  const p = provider();
  if (p === 'gemini') return geminiTts(text, voiceId, speed, ctx.style ?? '', outMp3, ctx.lang ?? 'ko');
  if (ctx.lang && ctx.lang !== 'ko') return Promise.reject(new Error('해외판 음성은 Gemini TTS에서만 지원합니다 (TTS_PROVIDER=gemini)'));
  return p === 'google' ? googleTts(text, voiceId, speed, outMp3) : eleven.tts(text, voiceId, speed, ctx, outMp3);
}

export function listVoices(): Promise<Voice[]> {
  const p = provider();
  if (p === 'gemini') return listGeminiVoices();
  return p === 'google' ? listGoogleVoices() : eleven.listVoices();
}

/** 모드별 Gemini TTS 말투 지시 (실측: 썰 초당 8.1자 빠른 호흡, 여행은 존댓말 정보 톤) */
export function voiceStyle(mode?: string): string {
  if (mode === 'ssul') return '빠르고 리듬감 있는 한국 쇼핑 쇼츠 내레이터처럼, 신나고 자신감 있게, 문장 사이를 짧게 끊어서';
  if (mode === 'travel') return '밝고 친절한 여행 정보 쇼츠 내레이터처럼, 경쾌하고 또렷한 존댓말로';
  return '활기찬 쇼핑 쇼츠 내레이터처럼 또렷하고 빠르게';
}

/** 공급자별 기본 목소리 */
export function defaultVoice(mode?: string): { voiceId: string; speed: number } {
  const p = provider();
  // 리뷰·랭킹 실측: 사람 여성 목소리·존댓말이 가장 많음
  if (p === 'gemini') return mode === 'travel' ? { voiceId: 'Aoede', speed: 1.1 } : mode === 'review' ? { voiceId: 'Kore', speed: 1.1 } : { voiceId: 'Puck', speed: 1.15 };
  if (p === 'google') return mode === 'travel' || mode === 'review' ? { voiceId: 'ko-KR-Neural2-A', speed: 1.15 } : { voiceId: 'ko-KR-Neural2-C', speed: 1.2 };
  return { voiceId: '', speed: 1.1 };
}
