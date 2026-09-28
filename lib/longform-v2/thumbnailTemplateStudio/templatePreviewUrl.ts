/** 템플릿 카드·라이트박스용 미리보기 PNG 절대 URL (데스크톱 file: / Vite base 대응) */
export function resolveTemplatePreviewAssetUrl(path: string): string {
  const p = path.trim()
  if (!p) return p
  if (/^https?:\/\//i.test(p) || p.startsWith('data:')) return p
  if (typeof window === 'undefined') return p

  const normPath = p.startsWith('/') ? p : `/${p}`
  const base = ((typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_PATH) || '/') ?? '/'
  const basePrefix = base.endsWith('/') && base.length > 1 ? base.slice(0, -1) : base.replace(/\/$/, '')

  const { protocol, origin } = window.location
  if (protocol === 'file:') {
    const injected = (window as unknown as { __WINGS_API_ORIGIN__?: string }).__WINGS_API_ORIGIN__
    const serverOrigin = (injected?.trim() || 'http://127.0.0.1:8787').replace(/\/$/, '')
    return `${serverOrigin}${normPath}`
  }

  return `${origin}${basePrefix}${normPath}`
}
