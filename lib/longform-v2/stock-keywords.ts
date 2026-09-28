/** 실사(스톡) 검색어 — WingsStudio detailModeStockKeywords 대응 */

import {
  extractStockKeywordsFromScriptLine,
  resolveStockSearchKeywordsKo,
} from "@/lib/longform-v2/stock-keywords-ko"

export {
  extractStockKeywordsFromScriptLine,
  isPrimarilyLatinText,
  isWeakStockKeywords,
  resolveStockSearchKeywordsKo,
} from "@/lib/longform-v2/stock-keywords-ko"

/** 장면 대본에서 스톡 검색용 한글 키워드 도출 */
export function deriveStockKeywordsKo(scene: {
  text?: string
  prompt?: string
  stockSearchKeywordsKo?: string
}): string {
  return resolveStockSearchKeywordsKo({
    stockSearchKeywordsKo: scene.stockSearchKeywordsKo,
    scriptLine: scene.text,
    narrationText: scene.text,
    promptKo: scene.prompt?.startsWith("stock:") ? undefined : scene.prompt,
  })
}
