import { startJob, type Ctx } from '@/lib/wings-shopping-v2/api';
import { runSearch } from '@/lib/wings-shopping-v2/pipeline';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: Ctx) {
  return startJob(ctx, 'search', runSearch);
}
