import fs from "fs/promises"
import path from "path"
import {
  runVmakeVideoScreenClear,
  verifyVmakeSkillCredentials,
  VmakeSkillError,
} from "@/lib/vmake-skill-client"

/** Vmake Skill WAPI — MT_AK / MT_SK (UI에서는 API Key / Secret Access Key) */
export type VmakeCredentials = {
  apiKey: string
  secretAccessKey: string
  /** @deprecated WAPI Skill API에서는 불필요 */
  subtitleCreatePath?: string
  /** @deprecated WAPI Skill API에서는 불필요 */
  subtitlePollPath?: string
}

export type VmakeSubtitleMode = "subtitle" | "standard" | "advanced"

export class VmakeRouteNotFoundError extends Error {
  readonly kind = "vmake_route_not_found" as const

  constructor(message: string) {
    super(message)
    this.name = "VmakeRouteNotFoundError"
  }
}

export function isVmakeRouteNotFoundError(err: unknown): err is VmakeRouteNotFoundError {
  return err instanceof VmakeRouteNotFoundError
}

export function resolveVmakeCredentials(input?: Partial<VmakeCredentials>): VmakeCredentials {
  return {
    apiKey: (
      input?.apiKey?.trim() ||
      process.env.MT_AK ||
      process.env.shotform_vmake_api_key ||
      process.env.VMAKE_API_KEY ||
      ""
    ).trim(),
    secretAccessKey: (
      input?.secretAccessKey?.trim() ||
      process.env.MT_SK ||
      process.env.shotform_vmake_secret_access_key ||
      process.env.VMAKE_SECRET_ACCESS_KEY ||
      ""
    ).trim(),
    subtitleCreatePath: input?.subtitleCreatePath?.trim() || undefined,
    subtitlePollPath: input?.subtitlePollPath?.trim() || undefined,
  }
}

function assertVmakeCredentials(creds: VmakeCredentials): void {
  if (!creds.apiKey) {
    throw new Error("Vmake AI API Key(MT_AK / shotform_vmake_api_key)가 필요합니다.")
  }
  if (!creds.secretAccessKey) {
    throw new Error("Vmake AI Secret Key(MT_SK / shotform_vmake_secret_access_key)가 필요합니다.")
  }
}

export type VmakeVerifyResult = {
  ok: boolean
  message: string
  suggestedCreatePath?: string
  suggestedPollPath?: string
  suggestedBaseUrl?: string
}

/** 설정 화면 — WAPI Skill API 연결 확인 (키만 필요) */
export async function verifyVmakeApiKey(
  creds: Partial<VmakeCredentials>
): Promise<VmakeVerifyResult> {
  const resolved = resolveVmakeCredentials(creds)
  const result = await verifyVmakeSkillCredentials(resolved.apiKey, resolved.secretAccessKey)
  return {
    ok: result.ok,
    message: result.message,
    suggestedBaseUrl: result.ok ? "https://wapi-skill.vmake.ai" : undefined,
  }
}

async function processLocalVideo(input: {
  creds: VmakeCredentials
  sourcePath: string
  outputPath: string
}): Promise<void> {
  assertVmakeCredentials(input.creds)
  try {
    await runVmakeVideoScreenClear({
      accessKey: input.creds.apiKey,
      secretKey: input.creds.secretAccessKey,
      sourcePath: input.sourcePath,
      outputPath: input.outputPath,
    })
  } catch (e) {
    if (e instanceof VmakeSkillError && e.message.includes("preset")) {
      throw new VmakeRouteNotFoundError(e.message)
    }
    throw e
  }
}

/** 중국어 하드 자막 제거 — Vmake Skill API (videoscreenclear) */
export async function removeChineseSubtitlesWithVmake(input: {
  apiKey?: string
  secretAccessKey?: string
  subtitleCreatePath?: string
  subtitlePollPath?: string
  videoUrl: string
  outputPath: string
  mode?: VmakeSubtitleMode
}): Promise<void> {
  const creds = resolveVmakeCredentials(input)
  const tmpDir = path.join(path.dirname(input.outputPath), `_vmake_dl_${Date.now()}`)
  const tmpPath = path.join(tmpDir, "source.mp4")
  try {
    await fs.mkdir(tmpDir, { recursive: true })
    const res = await fetch(input.videoUrl, { cache: "no-store", signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`Vmake 입력 영상 다운로드 실패 (${res.status})`)
    await fs.writeFile(tmpPath, Buffer.from(await res.arrayBuffer()))
    await processLocalVideo({ creds, sourcePath: tmpPath, outputPath: input.outputPath })
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** 로컬 MP4 → Vmake 영상 화면 지우기(자막/워터마크) */
export async function removeChineseSubtitlesFromLocalFile(input: {
  apiKey?: string
  secretAccessKey?: string
  subtitleCreatePath?: string
  subtitlePollPath?: string
  sourcePath: string
  outputPath: string
  /** @deprecated WAPI는 OSS 업로드 사용 — 로컬 파일만 필요 */
  videoUrl?: string
  mode?: VmakeSubtitleMode
}): Promise<void> {
  const creds = resolveVmakeCredentials(input)
  await processLocalVideo({
    creds,
    sourcePath: input.sourcePath,
    outputPath: input.outputPath,
  })
}

/** @deprecated WAPI Skill API — 경로 탐색 불필요 */
export async function discoverVmakeSubtitleEndpoint(): Promise<{
  endpoint: null
  probes: []
}> {
  return { endpoint: null, probes: [] }
}

/** @deprecated WAPI Skill API — 경로 탐색 불필요 */
export async function probeVmakeSubtitleEndpoints(): Promise<
  Array<{ baseUrl: string; path: string; status: number; snippet: string }>
> {
  return []
}
