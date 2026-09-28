/** 배경 이미지에서 대표 색 5개 추출 (클라이언트 전용, Canva Magic Design 팔레트) */
export async function extractPaletteFromImage(imageDataUrl: string, count = 5): Promise<string[]> {
  const img = await loadImage(imageDataUrl)
  const w = 96
  const h = Math.round((img.height / img.width) * w) || 54
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 만들 수 없습니다.')
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>()
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]
    if (a < 128) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    if (lum < 0.08 || lum > 0.95) continue
    const key =
      (Math.floor(r / 32) << 10) | (Math.floor(g / 32) << 5) | Math.floor(b / 32)
    const prev = buckets.get(key)
    if (prev) {
      prev.r += r
      prev.g += g
      prev.b += b
      prev.n += 1
    } else {
      buckets.set(key, { r, g, b, n: 1 })
    }
  }

  const sorted = [...buckets.values()]
    .map((b) => ({
      r: Math.round(b.r / b.n),
      g: Math.round(b.g / b.n),
      b: Math.round(b.b / b.n),
      n: b.n,
      sat: saturation(b.r / b.n, b.g / b.n, b.b / b.n),
    }))
    .sort((a, b) => b.n * (0.5 + b.sat) - a.n * (0.5 + a.sat))

  const picked: string[] = []
  for (const c of sorted) {
    const hex = rgbToHex(c.r, c.g, c.b)
    if (picked.some((p) => colorDistance(p, hex) < 36)) continue
    picked.push(hex)
    if (picked.length >= count) break
  }

  while (picked.length < count) {
    const fallbacks = ['#ffffff', '#fbbf24', '#ef4444', '#3b82f6', '#22c55e']
    const next = fallbacks[picked.length]
    if (!picked.includes(next)) picked.push(next)
    else break
  }
  return picked
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러올 수 없습니다.'))
    img.src = src
  })
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0'))
      .join('')
  )
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function colorDistance(a: string, b: string): number {
  const pa = hexToRgb(a)
  const pb = hexToRgb(b)
  if (!pa || !pb) return 999
  return Math.sqrt((pa.r - pb.r) ** 2 + (pa.g - pb.g) ** 2 + (pa.b - pb.b) ** 2)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
