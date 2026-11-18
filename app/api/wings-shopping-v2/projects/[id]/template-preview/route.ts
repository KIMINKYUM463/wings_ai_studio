import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProject, projectDir } from '@/lib/wings-shopping-v2/store';
import { getTemplate, projectTemplateId } from '@/lib/wings-shopping-v2/templates/catalog';
import { applyVideoFit } from '@/lib/wings-shopping-v2/templates/video-fit';
import { renderTemplatePreview, runFfmpeg } from '@/lib/wings-shopping-v2/media/ffmpeg';
import { templateData } from '@/lib/wings-shopping-v2/ssul/settings';
import { ssulFontFamily } from '@/lib/wings-shopping-v2/templates/fonts';
import { badgeLines, badgeStyle, parseItem } from '@/lib/wings-shopping-v2/review/badge';

export const runtime = 'nodejs';

const FONTS = process.env.FONTS_DIR || path.join(process.cwd(), 'public', 'fonts');
const exists = (f: string) => fs.access(f).then(() => true, () => false);

/** 프로젝트 장면·제목으로 템플릿 미리보기 (540x960 jpg, 내용이 같으면 캐시) */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  let p;
  try {
    p = await getProject(id);
  } catch {
    return new Response('not found', { status: 404 });
  }
  const base = getTemplate(url.searchParams.get('templateId') ?? projectTemplateId(p));
  // 렌더와 같게 "영상 시작 표지" 설정을 반영 (poster=1 이면 표지 화면, poster=0 이면 본 장면)
  const posterParam = url.searchParams.get('poster');
  const poster = posterParam === '1' ? true : posterParam === '0' ? false : !!p.ssul?.introPoster;
  // 썸네일 스튜디오: cover=<모양> 이면 그 모양의 'top' 표지로, hd=1 이면 1080x1920
  const coverParam = url.searchParams.get('cover');
  const variant = coverParam || p.ssul?.coverVariant;
  const hd = url.searchParams.get('hd') === '1';
  const t = applyVideoFit({
    ...base,
    introPoster: posterParam === '0' ? false : base.introPoster || poster || !!coverParam,
    ...(variant ? { posterStyle: 'top' as const, posterVariant: variant } : {}),
    posterBottomFill: !!p.ssul?.coverBottomFill,
    posterZoom: !!p.ssul?.coverZoom,
  }, p.ssul?.videoFit);
  const d = templateData(p, 25);
  // ?font=<id> 로 저장 전 글꼴 미리보기 (pretendard = 기본)
  const fontParam = url.searchParams.get('font');
  if (fontParam) d.font = ssulFontFamily(fontParam);
  if (!d.title[0]) d.title = ['침대 밖은 위험해', '사각 난방 텐트'];
  if (!d.comment) d.comment = '이건 진짜 사야 함';
  if (!d.footer || d.footer === '구매방법 > 프로필 링크 클릭') {
    d.footer = '▶ 지금 댓글 · 프로필 링크에서 확인하기';
  }
  if (p.mode === 'travel') {
    d.location ||= '여행지 이름';
    d.price ||= '가격 정보';
    d.period ||= '기간 한정';
  }
  const firstBeat = p.script?.beats[0];
  const caption = url.searchParams.get('caption') === '0' ? '' : firstBeat?.text.split('\n')[0] ?? '자막이 이 위치에 나와요';
  const clipId = firstBeat?.clipId ?? p.clips.find((c) => !c.excluded)?.id;
  const dir = path.join(projectDir(id), 'previews');
  let frame = clipId ? path.join(projectDir(id), 'frames', `${clipId}.jpg`) : '';
  if (!frame || !(await exists(frame))) {
    frame = path.join(dir, 'blank.jpg');
    await fs.mkdir(dir, { recursive: true });
    if (!(await exists(frame))) await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'color=c=0x888888:s=720x1280', '-frames:v', '1', frame]);
  }
  // 리뷰·랭킹형은 순위 배지·상품명 카드까지 보여준다
  const firstItem = p.script?.beats.find((b) => b.item)?.item ?? p.reviewInfo?.items.split('\n')[0]?.split('|')[0]?.trim();
  const badges = t.family === 'review' || p.mode === 'review'
    ? badgeLines(badgeStyle(t), [{ ...parseItem(firstItem ? (/^\s*(\d|TOP|[A-Z]\s*·)/i.test(firstItem) ? firstItem : `1위 · ${firstItem}`) : '1위 · 상품 이름'), start: 0, end: 5 }], false)
    : [];
  // layer=1: 영상 영역에 겹치는 요소만 투명 PNG 로 (풀스크린 템플릿의 제목 카드가 영상 뒤에 가려지지 않게)
  if (url.searchParams.get('layer') === '1') {
    const v = t.video;
    const inVideo = (l: (typeof t.layers)[number]) => l.kind === 'rect' || l.kind === 'rrect'
      ? l.x < v.x + v.w && l.x + l.w > v.x && l.y < v.y + v.h && l.y + l.h > v.y
      : l.kind === 'text' || l.kind === 'icon' ? l.x >= v.x && l.x <= v.x + v.w && l.y >= v.y && l.y <= v.y + v.h : false;
    const lt = { ...t, layers: t.layers.filter(inVideo), introPoster: false };
    const lkey = crypto.createHash('sha1').update(JSON.stringify([lt.layers, d, 'layer'])).digest('hex').slice(0, 12);
    const lout = path.join(dir, `${t.id}-${lkey}-layer.png`);
    if (!lt.layers.length) return new Response(null, { status: 204 });
    if (!(await exists(lout))) await renderTemplatePreview(lt, d, '', frame, FONTS, lout, [], { w: 540, h: 960 }, true);
    return new Response(new Uint8Array(await fs.readFile(lout)), { headers: { 'content-type': 'image/png', 'cache-control': 'max-age=3600' } });
  }
  const key = crypto.createHash('sha1').update(JSON.stringify([t, d, caption, frame, badges, hd])).digest('hex').slice(0, 12);
  const out = path.join(dir, `${t.id}-${key}${hd ? '-hd' : ''}.jpg`);
  if (!(await exists(out))) await renderTemplatePreview(t, d, caption, frame, FONTS, out, badges, hd ? { w: 1080, h: 1920 } : undefined);
  return new Response(new Uint8Array(await fs.readFile(out)), { headers: { 'content-type': 'image/jpeg', 'cache-control': 'max-age=3600' } });
}
