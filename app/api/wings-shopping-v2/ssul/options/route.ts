import { NextResponse } from 'next/server';
import { getPlaybook } from '@/lib/wings-shopping-v2/ssul/playbook';
import { ALL_TEMPLATES, FAMILIES } from '@/lib/wings-shopping-v2/templates/catalog';
import { listCustomStructures } from '@/lib/wings-shopping-v2/ssul/custom-structures';

export const runtime = 'nodejs';

/** 썰 설정 화면용 선택지: 대본 구조·각도·말투·CTA·템플릿 */
export async function GET(req: Request) {
  const mode = new URL(req.url).searchParams.get('mode') ?? 'ssul';
  const PLAYBOOK = getPlaybook(mode);
  const keepFamily = (familyId: string) => {
    if (mode === 'travel') return true;
    if (mode === 'review') return true;
    // ssul(스토리)에서는 ver1 프레임 포함, travel/review 전용 패밀리만 제외
    return familyId !== 'travel' && familyId !== 'review';
  };
  const order = (f: string) =>
    f === 'storyv1' ? -2
      : (mode === 'travel' && f === 'travel') || (mode === 'review' && f === 'review') ? -1
        : f === 'remix' ? 1 : 0;

  const families = FAMILIES.filter((f) => keepFamily(f.id)).sort((a, b) => order(a.id) - order(b.id));
  const templates = ALL_TEMPLATES.filter((t) => keepFamily(t.family))
    .sort((a, b) => order(a.family) - order(b.family))
    .map(({ id, name, family, description, video, caption, canvas, introPoster, posterStyle, posterColors }) => ({ id, name, family, description, video, caption, canvas, introPoster, posterStyle, posterColors }));

  return NextResponse.json({
    productTypes: ['숙소', '투어·액티비티', '입장권·패스', '여행템', '항공권', '패키지', 'eSIM·통신'],
    structures: PLAYBOOK.structures.map(({ id, name, oneLiner, whenToUse, evidence, beats }) => ({
      id,
      name,
      oneLiner,
      whenToUse,
      evidence,
      roles: beats.map((b) => b.role),
    })).concat((await listCustomStructures()).map(({ id, name, oneLiner, whenToUse, evidence, beats }) => ({
      id, name, oneLiner, whenToUse, evidence, roles: beats.map((b) => b.role), custom: true,
    }))),
    angles: PLAYBOOK.angles.map(({ id, name, description }) => ({ id, name, description })),
    tones: PLAYBOOK.toneProfiles.map(({ id, name, register, endings, example }) => ({
      id,
      name,
      register,
      endings,
      example,
    })),
    ctaTypes: ['없음', '댓글키워드', '프로필링크', '구매처안내', '궁금증유발'],
    families,
    templates,
  });
}
