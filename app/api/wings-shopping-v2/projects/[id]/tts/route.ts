import { startJob, type Ctx } from '@/lib/wings-shopping-v2/api';
import { runTts } from '@/lib/wings-shopping-v2/pipeline';
import { updateProject } from '@/lib/wings-shopping-v2/store';

export const runtime = 'nodejs';

type Body = {
  customVoice?: { voiceId?: unknown; style?: unknown; speed?: unknown };
  typecastApiKey?: unknown;
  elevenlabsApiKey?: unknown;
};

export async function POST(req: Request, ctx: Ctx) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { id } = await ctx.params;

  if (body.customVoice && typeof body.customVoice === 'object') {
    const voiceId = typeof body.customVoice.voiceId === 'string' ? body.customVoice.voiceId.trim() : '';
    const style = typeof body.customVoice.style === 'string' ? body.customVoice.style : '';
    const speed = Math.min(1.5, Math.max(0.7, Number(body.customVoice.speed) || 1.1));
    if (voiceId) {
      await updateProject(id, (x) => {
        x.customVoice = { voiceId, style, speed };
        x.voice = { voiceId, speed };
      }).catch(() => {});
    }
  }

  const typecastApiKey = typeof body.typecastApiKey === 'string' && body.typecastApiKey.trim()
    ? body.typecastApiKey.trim()
    : undefined;
  const elevenlabsApiKey = typeof body.elevenlabsApiKey === 'string' && body.elevenlabsApiKey.trim()
    ? body.elevenlabsApiKey.trim()
    : undefined;

  return startJob(ctx, 'tts', (projectId) => runTts(projectId, { typecastApiKey, elevenlabsApiKey }));
}
