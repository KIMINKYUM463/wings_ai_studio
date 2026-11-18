/**
 * 유료 스톡 사이트의 미리보기 이미지는 워터마크가 박혀 있고 라이선스도 없어
 * 완성 영상에 쓰면 품질·저작권 모두 문제가 된다.
 */
const WATERMARKED_STOCK_HOSTS = [
  "shutterstock.com",
  "123rf.com",
  "alamy.com",
  "gettyimages.",
  "istockphoto.com",
  "dreamstime.com",
  "depositphotos.com",
  "ftcdn.net",
  "stock.adobe.com",
  "bigstockphoto.com",
  "canstockphoto.",
  "pond5.com",
  "vectorstock.com",
  "pngtree.com",
  "agefotostock.com",
  "superstock.com",
  "colourbox.com",
  "yayimages.com",
  "storyblocks.com",
]

/** SNS 페이지·로그인 게이트 URL이라 <img>·비전 AI 모두 이미지를 받지 못함 */
const UNLOADABLE_IMAGE_HOSTS = [
  "lookaside.instagram.com",
  "lookaside.fbsbx.com",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
]

function hostMatches(url: string | undefined, hosts: string[]): boolean {
  if (!url) return false
  let host = ""
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  return hosts.some((entry) =>
    entry.endsWith(".") ? host.includes(entry) : host === entry || host.endsWith(`.${entry}`)
  )
}

export function isWatermarkedStockUrl(...urls: Array<string | undefined>): boolean {
  return urls.some((url) => hostMatches(url, WATERMARKED_STOCK_HOSTS))
}

export function isUnloadableImageUrl(imageUrl: string | undefined): boolean {
  return hostMatches(imageUrl, UNLOADABLE_IMAGE_HOSTS)
}
