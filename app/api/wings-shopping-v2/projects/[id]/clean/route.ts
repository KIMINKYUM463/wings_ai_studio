import { startJob, type Ctx } from '@/lib/wings-shopping-v2/api';
import { runClean } from '@/lib/wings-shopping-v2/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 자막 지우기: 장면을 이어 붙이고 글자를 지운 영상을 미리 만들어 미리보기·렌더가 같이 쓴다 */
export async function POST(req: Request, ctx: Ctx) {
  const body = (await req.json().catch(() => ({}))) as { vmakeApiKey?: unknown; vmakeSecretAccessKey?: unknown };
  const key = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  return startJob(ctx, 'clean', (projectId) =>
    runClean(projectId, { vmakeApiKey: key(body.vmakeApiKey), vmakeSecretAccessKey: key(body.vmakeSecretAccessKey) }),
  );
}
