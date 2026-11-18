import { nanoid } from 'nanoid'
import { canonicalUrl, sameVideo } from './search/search'
import { detectPlatform } from './media/ytdlp'
import { createProject, getProject, updateProject } from './store'
import { markStale } from './pipeline'
import { defaultVoice } from './tts'
import type { Analysis, Platform, Project, SearchResult, Source } from './types'

export type RemixHandoffPick = {
  videoId?: string
  url: string
  /** 리믹스 선택 단계에서 해석된 직접 MP4 주소 */
  videoUrl?: string
  title?: string
  platform?: string
}

const PLATFORMS = new Set<Platform>(['youtube', 'tiktok', 'instagram', 'douyin', 'xiaohongshu'])

function asPlatform(value: string | undefined, url: string): Platform | 'other' {
  if (value && PLATFORMS.has(value as Platform)) return value as Platform
  const detected = detectPlatform(url)
  return detected === 'other' ? 'other' : detected
}

/** 리믹스에서 고른 제품 키워드로, 버전2 대본이 필요로 하는 분석 정보를 만듭니다. */
export function analysisFromKeywords(keywords: string[], productName?: string, duration = 32): Analysis {
  const cleaned = keywords.map((k) => k.trim()).filter(Boolean)
  const name = (productName || cleaned[0] || '쇼핑 제품').trim()
  return {
    productName: name,
    category: '쇼핑',
    keywords: cleaned.length ? cleaned : [name],
    searchQueries: { youtube: [], tiktok: [], instagram: [], douyin: [], xiaohongshu: [] },
    structure: {
      hook: '첫 문장에서 이 제품이 필요한 상황이나 결과를 짧게 던진다',
      body: '사용 장면과 특징을 하나씩 보여주며 설명한다',
      cta: '마지막에 구매나 댓글을 짧게 유도한다',
    },
    scenes: [],
    narrationTone: '반말 구어체, 짧은 문장, 자연스러운 쇼핑 쇼츠 말투',
    duration,
  }
}

function normalizePicks(rawPicks: RemixHandoffPick[]): RemixHandoffPick[] {
  const seen = new Set<string>()
  return rawPicks.filter((pick) => {
    const primary = (pick.url || pick.videoUrl || '').trim()
    if (!/^https?:\/\//.test(primary)) return false
    const key = canonicalUrl(primary)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function matchExistingSource(sources: Source[], pick: RemixHandoffPick): Source | undefined {
  const pageUrl = pick.url.trim()
  const directUrl = pick.videoUrl?.trim()
  return sources.find((s) => {
    if (s.url && pageUrl && sameVideo(s.url, pageUrl)) return true
    if (directUrl && (s.directUrl === directUrl || s.url === directUrl)) return true
    if (s.url && pageUrl && canonicalUrl(s.url) === canonicalUrl(pageUrl)) return true
    return false
  })
}

/**
 * 기존 리믹스 1~3단계에서 고른 영상 목록을 버전2 프로젝트에 동기화합니다.
 * 기존 projectId가 있으면 이미 나눈 장면·대본·음성을 보존한 채 바뀐 영상만 반영합니다.
 */
export async function syncRemixPicksToProject(args: {
  projectId?: string
  projectName?: string
  keywords?: string[]
  picks: RemixHandoffPick[]
  mosaicMode?: 'v2' | 'vmake'
  scriptTemplateId?: string
  customVoice?: Project['customVoice']
}): Promise<Project> {
  const picks = normalizePicks(args.picks)
  if (!picks.length) throw new Error('선택한 영상 주소가 없습니다')

  const fallbackName = args.projectName?.trim() || picks[0]?.title
  let existing: Project | null = null
  if (args.projectId && /^[A-Za-z0-9_-]+$/.test(args.projectId)) {
    existing = await getProject(args.projectId).catch(() => null)
  }

  const baseProject = existing ?? (await createProject((picks[0]!.url || picks[0]!.videoUrl)!.trim(), 'remix'))
  const searchResults: SearchResult[] = picks.flatMap((pick) => {
    const pageUrl = (pick.url || pick.videoUrl || '').trim()
    const platform = asPlatform(pick.platform, pageUrl)
    if (platform === 'other') return []
    return [{
      platform,
      url: pageUrl,
      title: pick.title?.trim() || fallbackName || '쇼핑 제품',
    }]
  })

  await updateProject(baseProject.id, (project) => {
    const prevDuration = project.analysis?.duration || 32
    const analysis = analysisFromKeywords(args.keywords ?? [], fallbackName, prevDuration)
    project.name = args.projectName?.trim() || analysis.productName || project.name
    project.analysis = {
      ...analysis,
      scenes: project.analysis?.scenes?.length ? project.analysis.scenes : analysis.scenes,
    }
    project.selected = picks.map((pick) => (pick.url || pick.videoUrl)!.trim())
    project.searchResults = searchResults

    // 사용자가 직접 파일로 추가한 upload 소스는 유지하고, 선택 목록의 소스는 매칭해서 보존한다
    const uploadSources = project.sources.filter((s) => !s.url && s.platform === 'upload')
    const nextSources: Source[] = picks.map((pick) => {
      const pageUrl = (pick.url || pick.videoUrl)!.trim()
      const directUrl = pick.videoUrl?.trim() || undefined
      const matched = matchExistingSource(project.sources, pick)
      if (matched) {
        return {
          ...matched,
          url: pageUrl,
          directUrl: directUrl ?? matched.directUrl,
          title: matched.title || pick.title?.trim() || analysis.productName,
        }
      }
      return {
        id: nanoid(8).replace(/[^A-Za-z0-9]/g, 'x'),
        url: pageUrl,
        directUrl,
        platform: asPlatform(pick.platform, pageUrl),
        title: pick.title?.trim() || analysis.productName,
        status: 'pending' as const,
      }
    })
    project.sources = [...nextSources, ...uploadSources]

    const validSourceIds = new Set(project.sources.map((s) => s.id))
    project.clips = project.clips.filter((c) => validSourceIds.has(c.sourceId))

    if (args.mosaicMode) {
      project.mosaicMode = args.mosaicMode
      project.mosaic = args.mosaicMode === 'v2'
    } else if (!project.mosaicMode) {
      project.mosaicMode = project.mosaic === false ? 'vmake' : 'v2'
    }
    if (args.scriptTemplateId) {
      project.scriptTemplateId = args.scriptTemplateId
    }
    if (args.customVoice?.voiceId) {
      project.customVoice = args.customVoice
      project.voice = { voiceId: args.customVoice.voiceId, speed: args.customVoice.speed }
    } else if (!existing) {
      project.voice = defaultVoice('remix')
    }

    project.jobs.analyze = { stage: 'analyze', state: 'done', progress: 1, message: '리믹스에서 고른 영상으로 시작합니다' }
    project.jobs.search = { stage: 'search', state: 'done', progress: 1 }
    markStale(project)
  })
  return getProject(baseProject.id)
}

/**
 * 기존 리믹스에서 고른 영상으로 버전2 리믹스 프로젝트를 만듭니다.
 * 영상 검색은 건너뛰고, 이어서 장면 나누기·대본·음성을 버전2가 처리합니다.
 */
export async function createRemixFromPicks(args: {
  keywords?: string[]
  picks: RemixHandoffPick[]
}): Promise<Project> {
  return syncRemixPicksToProject(args)
}
