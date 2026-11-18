import { startJob, type Ctx } from '@/lib/wings-shopping-v2/api'
import { updateProject } from '@/lib/wings-shopping-v2/store'
import { runStudioRender } from '@/lib/wings-shopping-v2/studio-bridge'

export const runtime = 'nodejs'
export const maxDuration = 300

type Body = {
  mosaicMode?: unknown
  vmakeApiKey?: unknown
  vmakeSecretAccessKey?: unknown
}

export async function POST(req: Request, ctx: Ctx) {
  const body = (await req.json().catch(() => ({}))) as Body
  const { id } = await ctx.params

  if (body.mosaicMode === 'v2' || body.mosaicMode === 'vmake') {
    const nextMode = body.mosaicMode
    await updateProject(id, (x) => {
      x.mosaicMode = nextMode
      x.mosaic = nextMode === 'v2'
    }).catch(() => {})
  }

  const vmakeApiKey =
    typeof body.vmakeApiKey === 'string' && body.vmakeApiKey.trim() ? body.vmakeApiKey.trim() : undefined
  const vmakeSecretAccessKey =
    typeof body.vmakeSecretAccessKey === 'string' && body.vmakeSecretAccessKey.trim()
      ? body.vmakeSecretAccessKey.trim()
      : undefined

  return startJob(ctx, 'render', (projectId) =>
    runStudioRender(projectId, { vmakeApiKey, vmakeSecretAccessKey }),
  )
}
