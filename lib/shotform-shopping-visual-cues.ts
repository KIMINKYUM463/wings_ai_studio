/** 화면 설명에서 쇼핑숏폼 나레이션에 쓸 구체 시각 단서 추출 */

export type VisualNarrationCue = {
  /** 나레이션에 넣을 짧은 화면 요소 (예: 퍼즐 모양 거치대) */
  label: string
  /** 후킹·데모에 쓸 장소 (욕실/책상 등) */
  place?: string
  /** 화면 유형 */
  kind: "wall_mount" | "puzzle_holder" | "cup_organizer" | "toothbrush_holder" | "desk" | "bathroom" | "generic"
}

const STOPWORDS =
  /^(장면|모습|보입니다|보임|담긴|함께|여러|가지|두|세|개의|있습니다|재미있는|다채로운|디자인의|모양)$/i

export function isToothbrushHolderProduct(blob: string): boolean {
  const t = blob.trim()
  if (!t) return false
  if (/전동\s*칫솔|电动牙刷|칫솔질|플라크|닦(?:아|여|으)/i.test(t) && !/거치대|꽂|스탠드|홀더|holder|벽걸이|수납/i.test(t)) {
    return false
  }
  return /거치대|꽂|스탠드|홀더|holder|벽걸이|수납|정리|收纳|트레이/i.test(t) && /칫솔|牙刷/i.test(t)
}

export function isOrganizerOrStorageProduct(blob: string): boolean {
  return /거치대|수납|정리|트레이|홀더|organiz|收纳|정돈|보관/i.test(blob)
}

/** 반복 장면·메타 나레이션 (「몇 번 봐도」「아까 말한」 등) */
export function isRepeatMetaNarration(text: string): boolean {
  const t = text.trim().replace(/\n/g, " ")
  if (!t) return false
  return REPEAT_META_PATTERNS.some((re) => re.test(t))
}

export const REPEAT_META_PATTERNS = [
  /몇\s*번\s*봐도/,
  /아까\s*말한/,
  /반복\s*봐도/,
  /이어서\s*보면/,
  /이\s*화면에서도\s*그대로/,
  /포인트,?\s*이\s*화면에서도/,
  /또\s*나와도/,
  /여러\s*번\s*확인해도/,
  /같은\s*제품인데/,
  /꾸준히\s*느껴져요/,
  /방금\s*그\s*.+?,?\s*여기서도\s*똑같이/,
  /앞\s*장면\s*이어서\s*보면/,
  /반복\s*장면이지만/,
  /여기서도\s*체감/,
  /그대로\s*예요$/,
  /동일해요$/,
] as const

export function extractVisualNarrationCue(visualDesc: string): VisualNarrationCue {
  const d = visualDesc.trim()
  if (/벽에\s*걸|벽걸이|걸린|wall/i.test(d)) {
    return { label: "벽에 거는 수납", place: "욕실", kind: "wall_mount" }
  }
  if (/퍼즐|puzzle/i.test(d) && /칫솔|거치대|꽂/i.test(d)) {
    return { label: "퍼즐 모양 칫솔 거치대", place: "세면대", kind: "puzzle_holder" }
  }
  if (/퍼즐|puzzle/i.test(d)) {
    return { label: "퍼즐 모양 디자인", place: "욕실", kind: "puzzle_holder" }
  }
  if (/거치대|꽂혀|꽂아|스탠드/i.test(d) && /칫솔/i.test(d)) {
    return { label: "칫솔 거치대", place: "욕실", kind: "toothbrush_holder" }
  }
  if (/컵|필기구|펜|연필|pen|pencil/i.test(d)) {
    return { label: "컵형 수납", place: "책상", kind: "cup_organizer" }
  }
  if (/욕실|화장실|세면대|싱크/i.test(d)) {
    return { label: "욕실 정리", place: "욕실", kind: "bathroom" }
  }
  if (/책상|데스크|desk/i.test(d)) {
    return { label: "책상 정리", place: "책상", kind: "desk" }
  }

  const words = (d.match(/[\uac00-\ud7a3]{2,6}/g) ?? []).filter((w) => !STOPWORDS.test(w))
  const label = words.slice(0, 2).join(" ") || "이 장면"
  return { label, kind: "generic" }
}

/** [화면 단서] + [제품명] 결합 한 줄 후보 */
export function combineVisualAndProductNarration(args: {
  visualDesc: string
  productName: string
  cutIndex: number
  occurrence?: number
  role?: "hook" | "demo" | "repeat" | "cta"
}): string {
  const { visualDesc, productName, cutIndex, occurrence = 1, role = "demo" } = args
  const product = productName.trim() || "이 제품"
  const cue = extractVisualNarrationCue(visualDesc)
  const idx = (cutIndex + occurrence * 5) % 12

  if (role === "hook" || (cutIndex === 0 && occurrence === 1)) {
    const hooks = [
      `욕실 칫솔 뒤죽박죽이신 분? ${product} 하나면 끝이에요`,
      `세면대 위 어지러우셨죠? ${product}로 한번에 정리해보세요`,
      `젖은 칫솔 바닥에 두시나요? ${product} 쓰면 바로 달라져요`,
      `이거 몰랐으면 욕실 정리 시간만 늘었어요`,
    ]
    if (cue.kind === "wall_mount") {
      return `바닥에 젖은 칫솔 두던 분? ${product} 벽에 걸면 깔끔해요`
    }
    return hooks[idx % hooks.length]!
  }

  if (cue.kind === "wall_mount") {
    const lines = [
      `${product} 벽에 걸어두니 세면대 위가 한눈에 정리돼요`,
      `벽 활용하니 바닥 물기·젖은 칫솔 분리하기 좋아요`,
      `걸어두기만 해도 욕실이 훨씬 넓어 보여요`,
      `${product} 벽걸이형이라 공간 차지도 거의 없어요`,
    ]
    return lines[idx % lines.length]!
  }

  if (cue.kind === "puzzle_holder") {
    const lines = [
      `퍼즐 모양 ${product}, 귀여운데 칫솔 꽂기도 딱이에요`,
      `${product} 퍼즐 디자인이라 욕실 인테리어 포인트돼요`,
      `세면대 위에 두니 칫솔·치약이 한곳에 모여요`,
      `이 각도 보면 ${product} 수납 슬롯이 잘 보여요`,
    ]
    return lines[idx % lines.length]!
  }

  if (cue.kind === "cup_organizer") {
    if (isToothbrushHolderProduct(product)) {
      const lines = [
        `욕실 소품도 ${product}처럼 한곳에 모아두면 찾기 쉬워요`,
        `이런 식으로 정리하면 세면대가 훨씬 깔끔해져요`,
        `작은 소품까지 ${product}로 정돈하면 끝이에요`,
      ]
      return lines[idx % lines.length]!
    }
    const lines = [
      `컵 하나에 필기구 쏙 넣으니 책상이 바로 정리돼요`,
      `색감도 예쁘고 수납도 되는 구성이에요`,
      `책상 위 어지러운 펜·소품, 이렇게 모아두세요`,
    ]
    return lines[idx % lines.length]!
  }

  if (cue.kind === "toothbrush_holder") {
    const lines = [
      `${product}에 칫솔 꽂아두니 세면대가 깔끔해요`,
      `칫솔 두 개 동시에 꽂아도 흔들림 없이 안정적이에요`,
      `${product} 덕분에 칫솔·치약 찾기가 훨씬 쉬워져요`,
      `꽂아두기만 해도 욕실이 정돈된 느낌이에요`,
    ]
    return lines[idx % lines.length]!
  }

  if (occurrence > 1) {
    const lines = [
      `${cue.label} 보면 ${product} 수납력이 또 보여요`,
      `다른 각도인데도 ${product} 정리 포인트는 같아요`,
      `${product}, ${cue.label}에서도 쓰임이 확실해요`,
    ]
    return lines[idx % lines.length]!
  }

  const lines = [
    `${cue.label} 보니까 ${product} 쓰임이 바로 와닿아요`,
    `${product}로 ${cue.place || "공간"} 정리가 이렇게 쉬워요`,
    `이 장면에서 ${product} 포인트가 딱 보여요`,
  ]
  return lines[idx % lines.length]!
}
