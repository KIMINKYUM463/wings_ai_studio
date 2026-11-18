import type { Project, SsulSettings, StoryMode } from '../types';
import { isStoryMode } from '../types';
import type { TemplateData } from '../templates/types';
import { getPlaybook } from './playbook';
import { defaultVoice } from '../tts';
import { ssulFontFamily } from '../templates/fonts';

type Defaults = SsulSettings & { voice: { voiceId: string; speed: number } };

/**
 * 모드별 기본값 (리서치 기준)
 * - 썰: 남성 TTS(83%)·빠른 호흡 1.2배, 게시판형 연두
 * - 여행: 여행 쇼츠 80개 분석 기준 (docs/travel-stats.json) — 위치 핀 + 가격표 템플릿
 */
export function modeDefaults(mode: StoryMode = 'ssul'): Defaults {
  const pb = getPlaybook(mode);
  if (mode === 'review') {
    // 리뷰·랭킹 56개 실측: 존댓말 64%, CTA는 구매처 안내가 가장 많음, 랭킹형이 가장 흔함
    return {
      structureId: 'auto', angleId: '', toneId: (pb.toneProfiles.find((t) => t.register.includes('존댓말')) ?? pb.toneProfiles[0]).id, ctaType: '구매처안내',
      templateId: 'review-rank-full', channelName: '꿀템 랭킹', introPoster: false,
      voice: defaultVoice('review'),
    };
  }
  if (mode === 'travel') {
    return {
      // 여행 쇼츠 70%가 존댓말 → 존댓말 말투를 기본으로
      structureId: 'auto', angleId: '', toneId: (pb.toneProfiles.find((t) => t.register.includes('존댓말')) ?? pb.toneProfiles[0]).id, ctaType: '프로필링크',
      templateId: 'travel-pin', channelName: '여행각', introPoster: false,
      voice: defaultVoice('travel'),
    };
  }
  return {
    structureId: 'auto', angleId: '', toneId: pb.toneProfiles[0].id, ctaType: '없음',
    templateId: 'board-green', channelName: '오늘의 꿀템', introPoster: false,
    voice: defaultVoice('ssul'),
  };
}

export const ssulDefaults = () => modeDefaults('ssul');

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** 템플릿에 들어갈 글자들 (채널명·제목 2줄·메타·코멘트, 여행이면 지역·가격·기간) */
export function templateData(p: Project, totalSeconds: number): TemplateData {
  const channel = p.ssul?.channelName?.trim() || modeDefaults(isStoryMode(p.mode) ? p.mode : 'ssul').channelName;
  const [a = '', b = ''] = p.script?.headcopy ?? ['', ''];
  const t = p.travelInfo;
  return {
    firstSentence: (p.script?.beats[0]?.text ?? '').replace(/\s*\n\s*/g, ' ').trim(),
    channel, title: [a, b], meta: `${channel} | ${mmss(totalSeconds)} |`, comment: p.script?.comment ?? '',
    ...(t ? { location: t.location ?? '', price: t.price ?? '', period: t.period ?? '' } : {}),
    footer:
      p.localText?.footer ??
      (t?.howToBuy
        ? `예약 · ${t.howToBuy}`
        : isStoryMode(p.mode)
          ? '구매방법 > 프로필 링크 클릭'
          : '▶ 상세 정보는 댓글 · 프로필 링크 확인'),
    ...(p.localText?.statics ? { statics: p.localText.statics } : {}),
    titleScale: p.ssul?.titleScale ?? 1,
    channelScale: p.ssul?.channelScale ?? 1.5, // 채널명은 기본 150%
    // 해외판(lang 있음)은 언어별 글꼴을 써야 하므로 한국어일 때만
    ...(!p.lang && ssulFontFamily(p.ssul?.font) ? { font: ssulFontFamily(p.ssul?.font) } : {}),
  };
}
