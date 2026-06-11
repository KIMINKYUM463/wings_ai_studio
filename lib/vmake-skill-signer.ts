import crypto from "crypto"

export const VMMAKE_SKILL_ALGORITHM = "SDK-HMAC-SHA256"
export const VMMAKE_HEADER_X_DATE = "X-Sdk-Date"
export const VMMAKE_HEADER_HOST = "Host"
export const VMMAKE_HEADER_CONTENT_SHA256 = "X-Sdk-Content-Sha256"

function hashSha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex")
}

function hmacSha256Hex(key: string | Buffer, data: string): string {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex")
}

function canonicalUri(path: string): string {
  if (!path || !path.endsWith("/")) return `${path}/`
  return path
}

function canonicalQueryString(search: string): string {
  if (!search) return ""
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
}

function utcTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

export function signVmakeRequest(input: {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  accessKey: string
  secretKey: string
}): Record<string, string> {
  const headers = { ...input.headers }
  if (!headers[VMMAKE_HEADER_X_DATE]) {
    headers[VMMAKE_HEADER_X_DATE] = utcTimestamp()
  }
  if (!headers[VMMAKE_HEADER_CONTENT_SHA256]) {
    headers[VMMAKE_HEADER_CONTENT_SHA256] = hashSha256(input.body)
  }

  const parsed = new URL(input.url)
  const signedHeaderNames = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()

  const lowHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    lowHeaders[key.toLowerCase()] = value.trim()
  }

  const canonicalHeaders = signedHeaderNames.map((key) => `${key}:${lowHeaders[key]}`).join("\n")
  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(parsed.pathname),
    canonicalQueryString(parsed.search),
    canonicalHeaders,
    signedHeaderNames.join(";"),
    headers[VMMAKE_HEADER_CONTENT_SHA256],
  ].join("\n")

  const stringToSign = [
    VMMAKE_SKILL_ALGORITHM,
    headers[VMMAKE_HEADER_X_DATE],
    hashSha256(canonicalRequest),
  ].join("\n")

  const signature = hmacSha256Hex(input.secretKey, stringToSign)
  const authValue = `${VMMAKE_SKILL_ALGORITHM} Access=${input.accessKey}, SignedHeaders=${signedHeaderNames.join(";")}, Signature=${signature}`
  headers.Authorization = `Bearer ${Buffer.from(authValue, "utf8").toString("base64")}`

  return headers
}
