import { NextResponse } from 'next/server'
import { err } from '@/lib/wings-shopping-v2/api'
import { syncRemixPicksToProject, type RemixHandoffPick } from '@/lib/wings-shopping-v2/from-remix'
import { isRunning, runSources, withLiveJobs } from '@/lib/wings-shopping-v2/pipeline'
import type { Project } from '@/lib/wings-shopping-v2/types'

export const runtime = 'nodejs'

type Body = {
  projectId?: unknown
  projectName?: unknown
  keywords?: unknown
  picks?: unknown
  mosaicMode?: unknown
  scriptTemplateId?: unknown
  customVoice?: unknown
}

function asPicks(raw: unknown): RemixHandoffPick[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as {
      videoId?: unknown
      url?: unknown
      videoUrl?: unknown
      title?: unknown
      platform?: unknown
    }
    const videoUrl = typeof row.videoUrl === 'string' ? row.videoUrl.trim() : ''
    const url = (typeof row.url === 'string' ? row.url.trim() : '') || videoUrl
    if (!url) return []
    return [{
      videoId: typeof row.videoId === 'string' ? row.videoId : undefined,
      url,
      videoUrl: videoUrl || undefined,
      title: typeof row.title === 'string' ? row.title : undefined,
      platform: typeof row.platform === 'string' ? row.platform : undefined,
    }]
  })
}

function asCustomVoice(raw: unknown): Project['customVoice'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as { voiceId?: unknown; style?: unknown; speed?: unknown }
  const voiceId = typeof v.voiceId === 'string' ? v.voiceId.trim() : ''
  if (!voiceId) return undefined
  return {
    voiceId,
    style: typeof v.style === 'string' ? v.style : '',
    speed: Math.min(1.5, Math.max(0.7, Number(v.speed) || 1.1)),
  }
}

/** 기존 리믹스 1~3단계에서 고른 영상으로 버전2 중간 단계 프로젝트를 동기화하고 장면 나누기를 시작합니다. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.filter((item): item is string => typeof item === 'string')
    : []
  const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : undefined
  const projectName = typeof body.projectName === 'string' && body.projectName.trim() ? body.projectName.trim() : undefined
  const mosaicMode = body.mosaicMode === 'vmake' ? 'vmake' : body.mosaicMode === 'v2' ? 'v2' : undefined
  const scriptTemplateId = typeof body.scriptTemplateId === 'string' && body.scriptTemplateId.trim()
    ? body.scriptTemplateId.trim()
    : undefined

  try {
    const project = await syncRemixPicksToProject({
      projectId,
      projectName,
      keywords,
      picks: asPicks(body.picks),
      mosaicMode,
      scriptTemplateId,
      customVoice: asCustomVoice(body.customVoice),
    })
    const needsSources = project.sources.some(
      (s) => s.status !== 'ready' || !project.clips.some((c) => c.sourceId === s.id),
    )
    if (needsSources && !isRunning(project.id, 'sources')) {
      void runSources(project.id)
    }
    return NextResponse.json(withLiveJobs(project), { status: 201 })
  } catch (e) {
    return err(e instanceof Error ? e.message : '프로젝트를 만들지 못했습니다')
  }
}
