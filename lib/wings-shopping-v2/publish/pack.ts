import { z } from 'zod';
import type { Project, UploadPack } from '../types';
import { localDisclosure, type Affiliate } from './disclosure';

/**
 * 플랫폼별 업로드 문구 (제목·설명·해시태그·고정댓글)
 * - YouTube Shorts: 제목 100자 이하(앞 40자가 보임), 설명 첫 줄에 표기, 해시태그 3~5개
 * - Instagram Reels: 캡션 첫 줄 표기, 해시태그 5개 이하(2025.12부터 최대 5개)
 * - TikTok: 캡션 짧게 + 해시태그 3~5개
 */
export const PackSchema = z.object({
  youtube: z.object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()).default([]) }),
  instagram: z.object({ caption: z.string(), hashtags: z.array(z.string()).default([]) }),
  tiktok: z.object({ caption: z.string(), hashtags: z.array(z.string()).default([]) }),
  pinnedComment: z.string().default(''),
});

export function packPrompt(p: Project): string {
  const a = (p.publish?.affiliate ?? 'none') as Affiliate;
  const beats = (p.script?.beats ?? []).map((b) => b.text.replace(/\n/g, ' ')).join(' / ');
  const lang = p.lang && p.lang !== 'ko' ? p.lang : 'ko';
  return `너는 쇼핑 숏폼 업로드 담당자다. 아래 영상의 업로드 문구를 플랫폼별로 써라. 언어: ${lang === 'ko' ? '한국어' : `${lang} (현지 시청자용 자연스러운 표현)`}.

[영상]
상품: ${p.analysis?.productName ?? ''} (${p.analysis?.category ?? ''})
상단 제목: ${(p.script?.headcopy ?? []).join(' ')}
대본: ${beats}
${p.travelInfo ? `여행 정보: ${[p.travelInfo.location, p.travelInfo.price, p.travelInfo.period].filter(Boolean).join(' · ')}` : ''}
구매 링크: ${p.publish?.link ? '있음 — 실제 주소를 쓰지 말고 YouTube 설명·TikTok 캡션·고정댓글에 [링크] 자리표시자를 한 번씩만 넣어라. Instagram은 링크 대신 "프로필 링크"로 안내.' : '없음 (프로필 링크로 안내)'}

[규칙]
- 제목·캡션 첫 줄은 대본의 후킹을 살려서 궁금하게. 과장·허위(1위·최저가·효과 보장 등 확인 안 된 말) 금지.
- 해시태그는 #없이 단어만. 상품명·카테고리·상황 키워드 위주. YouTube 3~5개, Instagram 최대 5개, TikTok 3~5개.
- YouTube 제목 60자 이내, 설명 3~6줄. Instagram 캡션 2~4줄. TikTok 캡션 1~2줄.
- pinnedComment: 시청자가 댓글 달고 싶게 만드는 질문 + 구매 안내 한 줄.
- 광고 표기 문구는 코드가 자동으로 맨 앞에 붙이니 너는 넣지 마라.

JSON만:
{"youtube":{"title":"","description":"","hashtags":[]},"instagram":{"caption":"","hashtags":[]},"tiktok":{"caption":"","hashtags":[]},"pinnedComment":""}`;
}

const tag = (s: string) => `#${s.replace(/^#/, '').replace(/\s+/g, '')}`;

/** AI 결과에 광고 표기·링크·해시태그 개수 규칙을 강제로 적용 */
export function finalizePack(raw: z.infer<typeof PackSchema>, affiliate: Affiliate, link?: string, lang?: string): UploadPack {
  const { line: disc, prefix: pre, linkLabel, profile } = localDisclosure(affiliate, lang);
  const withLink = (s: string, l = link) => (l ? s.replace(/\[링크\]/g, l) : s.replace(/\[링크\]/g, profile));
  // 링크는 한 번만: AI가 이미 [링크]를 넣었으면 덧붙이지 않는다
  const addLink = (s: string, fmt: (l: string) => string) => (link && !s.includes(link) ? `${s}${fmt(link)}` : s);
  const head = (s: string) => (disc ? `${disc}\n\n${s}` : s);
  const ht = (arr: string[], max: number) => [...new Set(arr.map(tag).filter((t) => t.length > 1))].slice(0, max);
  const ytTitle = `${pre}${raw.youtube.title.replace(/^\[[^\]]{1,20}\]\s*/, '')}`.slice(0, 100);
  const yt = ht(raw.youtube.hashtags, 5);
  const ig = ht(raw.instagram.hashtags, 5);
  const tt = ht(raw.tiktok.hashtags, 5);
  const ytDesc = addLink(withLink(head(raw.youtube.description)), (l) => `\n\n${linkLabel}: ${l}`);
  return {
    youtube: { title: ytTitle, description: `${ytDesc}\n\n${yt.join(' ')}`, hashtags: yt },
    // 인스타 캡션의 링크는 눌리지 않는다 → 항상 '프로필 링크'로 안내
    instagram: { caption: `${pre}${withLink(head(raw.instagram.caption), '').replace(/https?:\/\/\S+/g, profile).trim()}\n\n${ig.join(' ')}`, hashtags: ig },
    tiktok: { caption: `${pre}${withLink(raw.tiktok.caption)} ${tt.join(' ')}${disc ? `\n${disc}` : ''}`, hashtags: tt },
    pinnedComment: addLink(withLink(`${disc ? `${disc}\n` : ''}${raw.pinnedComment}`), (l) => `\n👉 ${l}`),
    at: Date.now(),
  };
}

/** 업로드용 텍스트 파일 내용 */
export function packText(p: UploadPack): string {
  return [
    '■ YouTube Shorts', `제목: ${p.youtube.title}`, '설명:', p.youtube.description, '',
    '■ Instagram Reels', p.instagram.caption, '',
    '■ TikTok', p.tiktok.caption, '',
    '■ 고정 댓글', p.pinnedComment, '',
  ].join('\n');
}
