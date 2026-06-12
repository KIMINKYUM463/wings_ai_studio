import fs from "fs/promises"
import path from "path"
import OSS from "ali-oss"
import {
  signVmakeRequest,
  VMMAKE_HEADER_CONTENT_SHA256,
  VMMAKE_HEADER_HOST,
  VMMAKE_HEADER_X_DATE,
} from "@/lib/vmake-skill-signer"

const WAPI_ENDPOINT = "wapi-skill.vmake.ai"
const USER_AGENT = "action-web-skill-v1.3.0"
const DEFAULT_VIDEO_TASK_PRESET = "videoscreenclear"
const DEFAULT_TASK_PARAMS = { parameter: { rsp_media_type: "url" } }

type WapiEnvelope<T = Record<string, unknown>> = {
  meta?: { code?: number | string; msg?: string }
  response?: T
}

type InvokePreset = {
  task: string
  params?: Record<string, unknown>
  task_type?: string
}

type TokenPolicyCloud = {
  url?: string
  push_path?: string
  sync_timeout?: number
  status_query?: { path?: string; durations?: string }
  credentials?: {
    access_key: string
    secret_key: string
    session_token?: string
  }
  bucket?: string
  key?: string
  data?: unknown
  region?: string
}

type AiStrategy = TokenPolicyCloud & {
  task_type?: string
}

let cachedGid = ""
let cachedInvoke: Record<string, InvokePreset> = {}
let cachedRegions: Record<string, string> = {}
let cachedEndpoint: string | undefined

export class VmakeSkillError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = "VmakeSkillError"
    this.code = code
  }
}

function wapiMetaCode(meta: WapiEnvelope["meta"]): number {
  const code = meta?.code
  if (code === undefined || code === null || code === 0 || code === "0") return 0
  const n = Number(code)
  return Number.isFinite(n) ? n : -1
}

function normalizeMediaUrl(value: unknown): string {
  if (typeof value === "string" && value.startsWith("http")) return value
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const url = obj.url ?? obj.uri
    if (typeof url === "string" && url.startsWith("http")) return url
  }
  throw new Error("Vmake 업로드 URL을 확인할 수 없습니다.")
}

function normalizeOssEndpoint(url: string): string {
  const u = url.includes("://") ? url : `https://${url}`
  const parsed = new URL(u)
  return `${parsed.protocol}//${parsed.host}`
}

function regionFromOssHost(host: string): string | undefined {
  const h = host.toLowerCase()
  if (h.includes(".oss-") && h.includes("aliyuncs.com")) {
    const reg = h.split(".oss-")[1]?.split(".aliyuncs.com")[0]
    if (reg) return reg.replace(/-internal$/, "")
  }
  if (h.startsWith("oss-") && h.includes("aliyuncs.com")) {
    const seg = h.split(".")[0]?.slice(4)
    if (seg) return seg.replace(/-internal$/, "")
  }
  return undefined
}

function resolveOssRegion(policy: TokenPolicyCloud, fallback?: string): string {
  const endpoint = policy.url || ""
  const host = new URL(endpoint.includes("://") ? endpoint : `https://${endpoint}`).hostname
  return regionFromOssHost(host) || policy.region || fallback || "cn-north-4"
}

function deepMergeParams(
  base: Record<string, unknown> | undefined,
  override: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!base) return { ...(override || {}) }
  if (!override) return { ...base }
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (
      key in out &&
      out[key] &&
      typeof out[key] === "object" &&
      !Array.isArray(out[key]) &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      out[key] = deepMergeParams(out[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out
}

async function signedFetch(input: {
  url: string
  method: string
  accessKey: string
  secretKey: string
  body?: string
  headers?: Record<string, string>
  timeoutMs?: number
}): Promise<Response> {
  const body = input.body ?? ""
  const headers = signVmakeRequest({
    url: input.url,
    method: input.method,
    headers: {
      "User-Agent": USER_AGENT,
      ...(input.body ? { "Content-Type": "application/json" } : {}),
      ...(input.headers || {}),
    },
    body,
    accessKey: input.accessKey,
    secretKey: input.secretKey,
  })

  return fetch(input.url, {
    method: input.method,
    headers,
    body: input.body,
    signal: AbortSignal.timeout(input.timeoutMs ?? 30_000),
    cache: "no-store",
  })
}

async function wapiRequest<T>(
  accessKey: string,
  secretKey: string,
  apiPath: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `https://${WAPI_ENDPOINT}${apiPath}`
  const bodyStr = body ? JSON.stringify(body) : ""
  const res = await signedFetch({
    url,
    method: "POST",
    accessKey,
    secretKey,
    body: bodyStr || undefined,
  })
  if (res.status !== 200) {
    throw new VmakeSkillError(res.status, `Vmake WAPI HTTP ${res.status} (${apiPath})`)
  }
  const data = (await res.json()) as WapiEnvelope<T>
  const code = wapiMetaCode(data.meta)
  if (code !== 0) {
    throw new VmakeSkillError(code, data.meta?.msg || `Vmake WAPI 오류 (${apiPath})`)
  }
  return (data.response || {}) as T
}

type SkillConfigResponse = {
  gid?: string
  algorithm?: {
    regions?: Record<string, string>
    invoke?: Record<string, InvokePreset>
  }
}

export async function fetchVmakeSkillConfig(accessKey: string, secretKey: string): Promise<SkillConfigResponse> {
  const response = await wapiRequest<SkillConfigResponse>(accessKey, secretKey, "/skill/config.json", {
    gid: cachedGid || "",
    version: "v1.3.0",
  })
  if (response.gid) cachedGid = response.gid
  if (response.algorithm?.regions) cachedRegions = { ...cachedRegions, ...response.algorithm.regions }
  if (response.algorithm?.invoke) cachedInvoke = { ...cachedInvoke, ...response.algorithm.invoke }
  cachedEndpoint = cachedRegions["cn-north-4"] || Object.values(cachedRegions)[0]
  return response
}

async function getTokenPolicy(
  accessKey: string,
  secretKey: string,
  kind: "upload" | "ai",
  region = "cn-north-4"
): Promise<TokenPolicyCloud> {
  const endpoint = cachedEndpoint || cachedRegions[region]
  if (!endpoint) {
    throw new Error("Vmake AI endpoint가 설정되지 않았습니다. fetchVmakeSkillConfig()를 먼저 호출하세요.")
  }

  const type = kind === "upload" ? "mtai" : "mtai"
  const url = `https://${endpoint}/ai/token_policy?type=${type}`
  const host = endpoint
  const res = await signedFetch({
    url,
    method: "GET",
    accessKey,
    secretKey,
    headers: { [VMMAKE_HEADER_HOST]: host },
  })
  if (res.status !== 200) {
    throw new VmakeSkillError(res.status, `Vmake token_policy 실패 (${kind})`)
  }

  const payload = (await res.json()) as { data?: { mtai?: Record<string, unknown> } }
  const mtai = payload.data?.mtai as
    | {
        api?: Record<string, unknown>
        upload?: Record<string, unknown>
      }
    | undefined
  if (!mtai) throw new Error("Vmake token_policy 응답 형식이 올바르지 않습니다.")

  const section = kind === "upload" ? mtai.upload : mtai.api
  if (!section || typeof section !== "object") {
    throw new Error(`Vmake token_policy ${kind} 섹션이 없습니다.`)
  }
  const order = (section.order as string[] | undefined)?.[0]
  if (!order) throw new Error(`Vmake token_policy ${kind} order가 없습니다.`)
  const cloud = section[order] as TokenPolicyCloud | undefined
  if (!cloud) throw new Error(`Vmake token_policy ${kind} 설정을 찾을 수 없습니다.`)
  return cloud
}

async function uploadLocalFileToOss(
  accessKey: string,
  secretKey: string,
  filePath: string,
  region = "cn-north-4"
): Promise<string> {
  const policy = await getTokenPolicy(accessKey, secretKey, "upload", region)
  const creds = policy.credentials
  if (!creds?.access_key || !creds.secret_key || !policy.bucket || !policy.key) {
    throw new Error("Vmake OSS 업로드 정책(credentials/bucket/key)이 없습니다.")
  }

  const client = new OSS({
    region: resolveOssRegion(policy, region),
    accessKeyId: creds.access_key,
    accessKeySecret: creds.secret_key,
    stsToken: creds.session_token,
    bucket: policy.bucket,
    endpoint: normalizeOssEndpoint(policy.url || ""),
  })

  const result = await client.put(policy.key, filePath)
  if (result.res.status !== 200) {
    throw new Error(`Vmake OSS 업로드 실패 (HTTP ${result.res.status})`)
  }

  return normalizeMediaUrl(policy.data)
}

async function consumeQuota(
  accessKey: string,
  secretKey: string,
  mediaUrl: string,
  taskPreset: string
): Promise<string> {
  const response = await wapiRequest<{ context?: string }>(accessKey, secretKey, "/skill/consume.json", {
    url: mediaUrl,
    task: taskPreset,
    gid: cachedGid || "",
  })
  return response.context || ""
}

function resolveVideoTaskPreset(): string {
  const fromEnv = process.env.VMAKE_VIDEO_TASK_PRESET?.trim()
  if (fromEnv) return fromEnv
  if (cachedInvoke[DEFAULT_VIDEO_TASK_PRESET]) return DEFAULT_VIDEO_TASK_PRESET
  const fallback = Object.keys(cachedInvoke).find((name) =>
    /video|screen|eraser|watermark|subtitle|text/i.test(name)
  )
  return fallback || DEFAULT_VIDEO_TASK_PRESET
}

function extractOutputUrls(body: Record<string, unknown>): string[] {
  const data = body.data
  if (!data || typeof data !== "object") return []
  const result = (data as Record<string, unknown>).result
  if (!result || typeof result !== "object") return []

  const ordered: string[] = []
  const seen = new Set<string>()
  const push = (value: unknown) => {
    if (typeof value === "string" && value.startsWith("http") && !seen.has(value)) {
      seen.add(value)
      ordered.push(value)
    }
  }

  const r = result as Record<string, unknown>
  for (const key of ["urls", "images", "videos"]) {
    const arr = r[key]
    if (Array.isArray(arr)) arr.forEach(push)
  }
  push(r.url)

  const mediaLists = [r.media_info_list]
  const nested = r.data
  if (nested && typeof nested === "object") {
    mediaLists.push((nested as Record<string, unknown>).media_info_list)
  }
  for (const list of mediaLists) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      if (item && typeof item === "object") {
        push((item as Record<string, unknown>).media_data)
      }
    }
  }

  const mtlab = r.mtlab_res
  if (mtlab && typeof mtlab === "object") {
    const mil = (mtlab as Record<string, unknown>).media_info_list
    if (Array.isArray(mil)) {
      for (const item of mil) {
        if (item && typeof item === "object") {
          push((item as Record<string, unknown>).media_data)
        }
      }
    }
  }

  return ordered
}

function isTaskSuccess(status: unknown): boolean {
  return status === 10 || status === 2 || status === 20
}

function isTaskFailure(status: unknown): boolean {
  return status === 3
}

async function submitAlgorithmTask(input: {
  accessKey: string
  secretKey: string
  mediaUrl: string
  presetName: string
  context: string
  params?: Record<string, unknown>
  region?: string
}): Promise<Record<string, unknown>> {
  const preset = cachedInvoke[input.presetName]
  if (!preset?.task) {
    throw new Error(
      `Vmake 작업 preset '${input.presetName}'을 찾을 수 없습니다. VMAKE_VIDEO_TASK_PRESET을 확인하세요.`
    )
  }

  const policy = (await getTokenPolicy(input.accessKey, input.secretKey, "ai", input.region)) as AiStrategy
  const host = (policy.url || "").replace(/^https?:\/\//, "")
  const mergedParams = deepMergeParams(preset.params || DEFAULT_TASK_PARAMS, input.params)
  const payload = {
    params: JSON.stringify(mergedParams),
    context: input.context,
    task: preset.task,
    task_type: preset.task_type?.trim() || "mtlab",
    sync_timeout: policy.sync_timeout ?? 60,
    init_images: [{ url: input.mediaUrl }],
  }

  const uri = `${policy.url}/${policy.push_path}`
  const res = await signedFetch({
    url: uri,
    method: "POST",
    accessKey: input.accessKey,
    secretKey: input.secretKey,
    body: JSON.stringify(payload),
    headers: { [VMMAKE_HEADER_HOST]: host },
    timeoutMs: ((policy.sync_timeout ?? 60) + 10) * 1000,
  })

  if (res.status !== 200) {
    throw new VmakeSkillError(res.status, `Vmake 알고리즘 제출 실패 (HTTP ${res.status})`)
  }

  const taskResult = (await res.json()) as Record<string, unknown>
  const data = taskResult.data as Record<string, unknown> | undefined
  if (data?.status === 9) {
    const result = data.result as Record<string, unknown> | undefined
    const taskId = String(result?.id || "").trim()
    if (!taskId) throw new Error("Vmake 비동기 작업 ID를 받지 못했습니다.")
    return pollAlgorithmTask(input.accessKey, input.secretKey, taskId, policy)
  }

  const urls = extractOutputUrls(taskResult)
  if (urls.length) return { ...taskResult, output_urls: urls }
  return taskResult
}

async function queryAlgorithmStatus(
  accessKey: string,
  secretKey: string,
  uri: string,
  policy: AiStrategy
): Promise<{ finished: boolean; failed: boolean; result: Record<string, unknown> | string }> {
  const host = (policy.url || "").replace(/^https?:\/\//, "")
  const res = await signedFetch({
    url: uri,
    method: "GET",
    accessKey,
    secretKey,
    headers: { [VMMAKE_HEADER_HOST]: host },
    timeoutMs: 120_000,
  })

  if (res.status !== 200) {
    return { finished: false, failed: false, result: `task query failure: HTTP ${res.status}` }
  }

  const taskResult = (await res.json()) as Record<string, unknown>
  const meta = taskResult.meta as Record<string, unknown> | undefined
  const metaCode = meta?.code
  if (metaCode !== undefined && metaCode !== 0 && metaCode !== "0") {
    return { finished: true, failed: true, result: taskResult }
  }

  const data = taskResult.data as Record<string, unknown> | undefined
  if (!data) return { finished: false, failed: false, result: taskResult }

  const status = data.status
  if (isTaskSuccess(status)) return { finished: true, failed: false, result: taskResult }
  if (isTaskFailure(status)) return { finished: true, failed: true, result: taskResult }
  return { finished: false, failed: false, result: taskResult }
}

async function pollAlgorithmTask(
  accessKey: string,
  secretKey: string,
  taskId: string,
  policy: AiStrategy
): Promise<Record<string, unknown>> {
  const statusPath = policy.status_query?.path
  const durationsRaw = policy.status_query?.durations || "3000,5000,8000"
  const durations = durationsRaw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => Math.max(1000, Number(d) || 3000))

  const minTotalMs = Number(process.env.VMAKE_POLL_MIN_TOTAL_MS || 600_000)
  let total = durations.reduce((sum, d) => sum + d, 0)
  const extended = [...durations]
  while (total < minTotalMs) {
    extended.push(30_000)
    total += 30_000
  }

  const uri = `${policy.url}/${statusPath}?task_id=${encodeURIComponent(taskId)}`
  for (let i = 0; i < extended.length; i++) {
    const query = await queryAlgorithmStatus(accessKey, secretKey, uri, policy)
    if (query.finished) {
      if (query.failed) {
        const raw = typeof query.result === "object" ? query.result : { meta: { msg: String(query.result) } }
        const meta = (raw.meta as Record<string, unknown> | undefined) || {}
        throw new Error(String(meta.msg || meta.message || "Vmake 영상 처리 작업이 실패했습니다."))
      }
      const body = query.result as Record<string, unknown>
      const urls = extractOutputUrls(body)
      if (!urls.length) {
        throw new Error("Vmake 작업은 완료됐지만 결과 URL이 없습니다.")
      }
      return { ...body, output_urls: urls, task_id: taskId }
    }
    await new Promise((r) => setTimeout(r, extended[i]))
  }

  throw new Error("Vmake 영상 처리 시간 초과. 잠시 후 다시 시도해 주세요.")
}

async function downloadRemoteVideo(url: string, outputPath: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(120_000) })
  if (!res.ok) throw new Error(`Vmake 결과 MP4 다운로드 실패 (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 20_000) throw new Error("Vmake 결과 MP4가 비어 있거나 너무 작습니다.")
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buf)
}

/** Vmake Skill WAPI — 연결 확인 (키만 필요) */
export async function verifyVmakeSkillCredentials(accessKey: string, secretKey: string): Promise<{
  ok: boolean
  message: string
  videoTaskPreset?: string
}> {
  if (!accessKey.trim()) return { ok: false, message: "Vmake AI API Key(MT_AK)를 입력해 주세요." }
  if (!secretKey.trim()) return { ok: false, message: "Vmake AI Secret Key(MT_SK)를 입력해 주세요." }

  try {
    const config = await fetchVmakeSkillConfig(accessKey.trim(), secretKey.trim())
    const preset = resolveVideoTaskPreset()
    const presetInfo = cachedInvoke[preset]
    const invokeCount = Object.keys(cachedInvoke).length
    const gid = config.gid || cachedGid || "(none)"
    return {
      ok: true,
      message:
        `Vmake Skill API 연결 확인 (wapi-skill.vmake.ai). ` +
        `영상 preset: ${preset}` +
        (presetInfo?.task ? ` → ${presetInfo.task}` : "") +
        `, invoke ${invokeCount}개, gid=${gid}`,
      videoTaskPreset: preset,
    }
  } catch (e) {
    if (e instanceof VmakeSkillError && (e.code === 401 || e.code === 403)) {
      return { ok: false, message: "Vmake AI API Key 또는 Secret Key가 유효하지 않습니다." }
    }
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Vmake Skill API 연결 실패",
    }
  }
}

/** 로컬 MP4 → Vmake 영상 화면 지우기(자막/워터마크) → outputPath */
export async function runVmakeVideoScreenClear(input: {
  accessKey: string
  secretKey: string
  sourcePath: string
  outputPath: string
  taskPreset?: string
  params?: Record<string, unknown>
}): Promise<void> {
  const accessKey = input.accessKey.trim()
  const secretKey = input.secretKey.trim()
  if (!accessKey || !secretKey) {
    throw new Error("Vmake AI API Key와 Secret Key가 필요합니다.")
  }

  await fetchVmakeSkillConfig(accessKey, secretKey)
  const mediaUrl = await uploadLocalFileToOss(accessKey, secretKey, input.sourcePath)
  const taskPreset = input.taskPreset?.trim() || resolveVideoTaskPreset()
  const context = await consumeQuota(accessKey, secretKey, mediaUrl, taskPreset)
  const result = await submitAlgorithmTask({
    accessKey,
    secretKey,
    mediaUrl,
    presetName: taskPreset,
    context,
    params: input.params,
  })

  const outputUrls = (result.output_urls as string[] | undefined) || extractOutputUrls(result)
  const resultUrl = outputUrls[0]
  if (!resultUrl) throw new Error("Vmake 처리 결과 URL을 찾지 못했습니다.")
  await downloadRemoteVideo(resultUrl, input.outputPath)
}
