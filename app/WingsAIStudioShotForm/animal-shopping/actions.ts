"use server"

import { fetchNaverTrendingKeywordsForCategory } from "@/lib/shotform-naver-datalab"
import type { ThumbnailHookingText } from "@/lib/shotform-mvp-thumbnail"
import {
  generateShortsThumbnail as generateShortsThumbnailLib,
  generateThumbnailHookingText as generateThumbnailHookingTextLib,
} from "@/lib/shotform-mvp-thumbnail"
import {
  animalSceneBeatRules,
  buildAnimalVisualDna,
  characterNarrationHint,
  inferAnimalProductUsage,
  resolveAnimalCharacter,
  type AnimalCharacter,
} from "./animal-character"
import {
  ANIMAL_SCENE_LABELS,
  buildProductCloseupImagePrompt,
  getAnimalStoryArc,
  suggestAnimalSceneCount,
} from "./animal-studio-types"

export type { AnimalCharacter }

// 네이버 데이터랩 API를 사용하여 인기 키워드 가져오기
export async function getNaverTrendingKeywords(category: string = "쇼핑"): Promise<string[]> {
  try {
    return await fetchNaverTrendingKeywordsForCategory(category)
  } catch (error) {
    console.error("[Naver Datalab] 키워드 조회 실패:", error)
    return [
      "난로",
      "패딩",
      "코트",
      "목도리",
      "장갑",
      "부츠",
      "히트텍",
      "내복",
      "담요",
      "전기장판",
    ]
  }
}

// 대본을 3개 장면으로 나누는 함수
export async function splitScriptIntoScenes(script: string): Promise<string[]> {
  // 대본을 3개 섹션으로 나누기
  // 각 섹션은 대본의 내용에 맞게 균등하게 분할
  
  // 먼저 문장 부호로 나누기
  const sentences = script
    .split(/[.!?。！？]\s*/)
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
  
  if (sentences.length === 0) {
    // 문장이 없으면 전체를 3등분
    const sectionLength = Math.ceil(script.length / 3)
    return [
      script.substring(0, sectionLength),
      script.substring(sectionLength, sectionLength * 2),
      script.substring(sectionLength * 2)
    ].filter(s => s.trim().length > 0)
  }
  
  // 3개 섹션으로 나누기 (대본의 내용에 맞게 균등 분할)
  const sections: string[] = []
  const totalLength = script.length
  const sectionLength = Math.ceil(totalLength / 3)
  
  // 문장 단위로 섹션 나누기 (의미 단위 유지)
  let currentSection = ""
  let currentSectionLength = 0
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.length + 1 // 공백 포함
    
    // 현재 섹션이 비어있거나, 섹션 길이가 목표 길이보다 작으면 추가
    if (sections.length === 0 || currentSectionLength + sentenceLength <= sectionLength) {
      // 현재 섹션에 추가
      currentSection += (currentSection ? " " : "") + sentence
      currentSectionLength += sentenceLength
    } else {
      // 현재 섹션 완료, 새 섹션 시작
      if (currentSection.trim()) {
        sections.push(currentSection.trim())
      }
      currentSection = sentence
      currentSectionLength = sentenceLength
    }
  }
  
  // 마지막 섹션 추가
  if (currentSection.trim()) {
    sections.push(currentSection.trim())
  }
  
  // 정확히 3개 섹션이 되도록 조정
  while (sections.length < 3 && sections.length > 0) {
    sections.push(sections[sections.length - 1])
  }
  
  // 정확히 3개만 반환
  const finalSections = sections.slice(0, 3)
  
  if (finalSections.length !== 3) {
    throw new Error(`섹션은 정확히 3개여야 합니다. 현재: ${finalSections.length}개`)
  }
  
  console.log("[Shopping] 대본 3분할 완료:")
  finalSections.forEach((section, index) => {
    console.log(`  섹션 ${index + 1} (${section.length}자): ${section.substring(0, 50)}...`)
  })
  
  return finalSections
}

// 제품 유형에 따라 적절한 배경과 구도를 반환하는 함수
function getProductSceneConfigs(productName: string, productDescription?: string): Array<{
  background: string
  angle: string
  camera: string
  lighting: string
  composition: string
}> {
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  // 청소기, 바닥 청소용품
  if (combined.includes("청소기") || combined.includes("청소") || combined.includes("vacuum") || combined.includes("cleaner")) {
    return [
      {
        background: "실내 바닥 배경, 깨끗한 바닥 타일이나 나무 바닥, 카펫이나 매트, 현대적인 거실이나 복도, 생활감 있는 공간",
        angle: "바닥에서 제품을 사용하는 각도, floor level view, 제품이 바닥에 닿아있는 모습, 손으로 제품을 잡고 있는 시점",
        camera: "medium shot, 제품과 바닥이 모두 보이는 구도, 바닥에서 약간 위로 올려다보는 각도",
        lighting: "실내 조명, 창문에서 들어오는 자연광, 밝고 깨끗한 조명",
        composition: "바닥 중심 배치, 제품이 바닥에서 사용되는 자연스러운 구도"
      },
      {
        background: "거실 바닥 배경, 카펫이나 러그, 소파와 가구가 보이는 생활 공간, 따뜻한 인테리어",
        angle: "제품을 측면에서 본 각도, side view, 바닥에서 제품을 사용하는 모습, 손으로 잡고 있는 자세",
        camera: "wide shot, 제품과 주변 환경이 모두 보이는 넓은 화면",
        lighting: "따뜻한 실내 조명, 자연광과 인공 조명의 조화",
        composition: "바닥에서 사용되는 자연스러운 구도, 생활감 있는 배치"
      },
      {
        background: "주방이나 복도 바닥 배경, 깨끗한 타일 바닥, 현대적인 인테리어, 밝은 공간",
        angle: "제품을 위에서 약간 내려다보는 각도, top-down view, 바닥에서 제품을 사용하는 모습",
        camera: "close-up shot, 제품과 손이 명확하게 보이는 근접 촬영",
        lighting: "밝은 실내 조명, 선명한 그림자",
        composition: "바닥 중심, 제품 사용 맥락이 명확한 구도"
      }
    ]
  }
  
  // 주방용품 (믹서, 블렌더, 에어프라이어 등)
  if (combined.includes("믹서") || combined.includes("블렌더") || combined.includes("에어프라이어") || 
      combined.includes("전기밥솥") || combined.includes("전기주전자") || combined.includes("커피머신") ||
      combined.includes("mixer") || combined.includes("blender") || combined.includes("air fryer") ||
      combined.includes("주방") || combined.includes("kitchen")) {
    return [
      {
        background: "현대적인 주방 배경, 조리대 위, 주방 가구와 싱크대, 깨끗한 주방 인테리어",
        angle: "조리대 위에서 제품을 사용하는 각도, counter level view, 제품이 조리대 위에 있는 모습",
        camera: "medium shot, 제품과 주방 배경이 모두 보이는 구도",
        lighting: "밝은 주방 조명, 자연광이 들어오는 창문, 깨끗한 조명",
        composition: "조리대 위 중앙 배치, 주방 환경이 보이는 자연스러운 구도"
      },
      {
        background: "주방 테이블 배경, 나무 테이블이나 대리석 테이블, 주방 식탁, 따뜻한 분위기",
        angle: "테이블 위에서 제품을 사용하는 각도, table level view, 제품이 테이블 위에 있는 모습",
        camera: "wide shot, 제품과 테이블, 주방 환경이 모두 보이는 넓은 화면",
        lighting: "따뜻한 주방 조명, 테이블 램프, 부드러운 그림자",
        composition: "테이블 위 배치, 생활감 있는 주방 구도"
      },
      {
        background: "주방 조리대 배경, 현대적인 주방 인테리어, 싱크대와 가스레인지, 깨끗한 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 조리대 위 제품의 상단면이 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 주방 배경이 살짝 보임",
        lighting: "밝은 주방 조명, 선명한 그림자",
        composition: "조리대 위 중심 배치, 제품이 명확하게 보이는 구도"
      }
    ]
  }
  
  // 화장품, 스킨케어
  if (combined.includes("화장품") || combined.includes("세럼") || combined.includes("크림") || 
      combined.includes("로션") || combined.includes("에센스") || combined.includes("토너") ||
      combined.includes("cosmetic") || combined.includes("serum") || combined.includes("cream")) {
    return [
      {
        background: "화장대 배경, 거울과 화장품 정리함, 깨끗한 욕실이나 화장실, 미니멀한 인테리어",
        angle: "화장대 위에서 제품을 보는 각도, vanity level view, 제품이 화장대 위에 있는 모습",
        camera: "medium shot, 제품과 화장대 배경이 모두 보이는 구도",
        lighting: "밝은 화장대 조명, 거울 반사광, 깨끗한 조명",
        composition: "화장대 위 중앙 배치, 미니멀하고 세련된 구도"
      },
      {
        background: "욕실 배경, 현대적인 욕실 인테리어, 깨끗한 타일, 미니멀한 공간",
        angle: "제품을 정면에서 본 각도, front view, 화장대나 선반 위에 있는 모습",
        camera: "wide shot, 제품과 욕실 환경이 모두 보이는 넓은 화면",
        lighting: "밝은 욕실 조명, 자연광과 인공 조명",
        composition: "욕실 공간 내 자연스러운 배치"
      },
      {
        background: "밝고 깨끗한 배경, 흰색이나 밝은 색상의 미니멀한 배경, 세련된 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 제품의 상단면이 명확하게 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 배경이 흐릿하게 보임",
        lighting: "부드러운 자연광, 밝고 깨끗한 조명",
        composition: "중앙 배치, 미니멀하고 세련된 구도"
      }
    ]
  }
  
  // 전자기기 (스마트폰, 태블릿, 노트북 등)
  if (combined.includes("스마트폰") || combined.includes("태블릿") || combined.includes("노트북") ||
      combined.includes("키보드") || combined.includes("마우스") || combined.includes("이어폰") ||
      combined.includes("smartphone") || combined.includes("tablet") || combined.includes("laptop")) {
    return [
      {
        background: "책상이나 테이블 위 배경, 깨끗한 작업 공간, 현대적인 오피스 인테리어",
        angle: "테이블 위에서 제품을 보는 각도, desk level view, 제품이 테이블 위에 있는 모습",
        camera: "medium shot, 제품과 책상 배경이 모두 보이는 구도",
        lighting: "밝은 작업 조명, 자연광이 들어오는 창문, 깨끗한 조명",
        composition: "테이블 위 중앙 배치, 작업 공간이 보이는 자연스러운 구도"
      },
      {
        background: "현대적인 사무실 배경, 깨끗한 책상, 모던한 인테리어, 미니멀한 공간",
        angle: "제품을 정면에서 본 각도, front view, 테이블 위에 있는 모습",
        camera: "wide shot, 제품과 사무실 환경이 모두 보이는 넓은 화면",
        lighting: "밝은 사무실 조명, 자연광과 인공 조명의 조화",
        composition: "책상 위 배치, 전문적이고 세련된 구도"
      },
      {
        background: "밝고 깨끗한 배경, 흰색이나 밝은 색상의 미니멀한 배경, 세련된 공간",
        angle: "제품을 위에서 내려다보는 각도, top view, 제품의 상단면이 명확하게 보이는 각도",
        camera: "close-up shot, 제품에 집중된 구도, 배경이 흐릿하게 보임",
        lighting: "부드러운 자연광, 밝고 깨끗한 조명",
        composition: "중앙 배치, 미니멀하고 세련된 구도"
      }
    ]
  }
  
  // 기본 설정 (범용 제품)
  return [
    {
      background: "밝고 깔끔한 실내 배경, 흰색 벽, 자연광이 들어오는 창문, 미니멀한 인테리어, 깨끗한 공간",
      angle: "제품을 위에서 본 각도, top view, bird's eye view, 제품의 상단면이 명확하게 보이는 각도, 공중에서 내려다보는 시점",
      camera: "wide shot, 전체적인 구도, 제품과 배경이 모두 보이는 넓은 화면",
      lighting: "부드러운 자연광, 창문에서 들어오는 햇빛, 밝고 깨끗한 조명",
      composition: "중앙 배치, 대칭적 구도, 미니멀한 구성"
    },
    {
      background: "현대적인 주방이나 거실 배경, 나무 테이블, 따뜻한 조명, 세련된 인테리어, 아늑한 분위기, 생활감 있는 공간",
      angle: "제품을 정면에서 본 각도, front view, 제품의 정면이 명확하게 보이는 각도, 눈높이 시점",
      camera: "medium shot, 제품에 집중된 구도, 배경이 살짝 보이는 중간 거리",
      lighting: "따뜻한 실내 조명, 테이블 램프, 부드러운 그림자",
      composition: "우측 또는 좌측 배치, 비대칭적 구도, 자연스러운 배치"
    },
    {
      background: "야외나 밝은 실외 배경, 파란 하늘, 자연스러운 햇빛, 깔끔한 환경, 신선한 느낌, 공원이나 테라스",
      angle: "제품을 측면에서 본 각도, side view, 45도 각도, 제품의 측면과 정면이 모두 보이는 각도, 약간 위에서 내려다보는 시점",
      camera: "close-up shot, 제품에 매우 집중된 구도, 배경이 흐릿하게 보이는 근접 촬영",
      lighting: "자연스러운 햇빛, 밝은 낮, 선명한 그림자",
      composition: "대각선 구도, 역동적인 배치, 시선을 끄는 구성"
    }
  ]
}

// 제품 유형에 따라 손이 필요한지 판단하는 함수
function needsHandsInImage(productName: string, productDescription?: string): boolean {
  const name = productName.toLowerCase()
  const description = (productDescription || "").toLowerCase()
  const combined = `${name} ${description}`
  
  // 손이 필요한 제품 키워드
  const handsRequiredKeywords = [
    "청소기", "청소", "로봇청소기", "무선청소기", "진공청소기",
    "드라이기", "헤어드라이기", "고데기", "다리미",
    "믹서", "블렌더", "제빵기", "에어프라이어", "전기밥솥",
    "전기주전자", "커피머신", "그라인더",
    "전동드릴", "전동공구", "전동톱", "전동드라이버",
    "마사지기", "안마기", "지압기",
    "스마트폰", "태블릿", "노트북", "키보드", "마우스",
    "게임패드", "조이스틱",
    "운동기구", "덤벨", "바벨", "요가매트",
    "공구", "망치", "드라이버", "렌치",
    "가위", "칼", "도구",
    "vacuum", "cleaner", "blender", "mixer", "drill", "tool", "appliance"
  ]
  
  // 손이 필요하지 않은 제품 키워드
  const handsNotRequiredKeywords = [
    "화장품", "세럼", "크림", "로션", "에센스", "토너",
    "마스크팩", "팩", "스킨케어",
    "의류", "옷", "상의", "하의", "바지", "치마", "원피스",
    "신발", "운동화", "구두", "부츠",
    "가방", "백", "지갑", "벨트",
    "침구", "이불", "베개", "담요",
    "cosmetic", "clothing", "apparel", "bag", "shoes"
  ]
  
  // 손이 필요하지 않은 제품이면 false
  if (handsNotRequiredKeywords.some(keyword => combined.includes(keyword))) {
    return false
  }
  
  // 손이 필요한 제품이면 true
  if (handsRequiredKeywords.some(keyword => combined.includes(keyword))) {
    return true
  }
  
  // 기본값: 제품 설명이나 대본에 "사용", "사용법", "사용하기" 같은 단어가 있으면 손 필요
  const usageKeywords = ["사용", "사용법", "사용하기", "조작", "사용하는", "use", "using"]
  if (usageKeywords.some(keyword => combined.includes(keyword))) {
    return true
  }
  
  // 기본값: 손 없이 제품만 (보수적 접근)
  return false
}

/** Replicate nano-banana: 过大 data URL → E006 invalid input */
const MAX_REPLICATE_DATA_URL_CHARS = 2_800_000

function isUsableReplicateImageRef(url?: string | null): url is string {
  if (!url?.trim()) return false
  if (url.startsWith("https://") || url.startsWith("http://")) return true
  if (url.startsWith("data:image/")) {
    return url.length <= MAX_REPLICATE_DATA_URL_CHARS
  }
  return false
}

function toDataUrlMaybe(image?: string | null): string | undefined {
  if (!image) return undefined
  if (image.startsWith("https://") || image.startsWith("http://")) {
    return image
  }
  if (image.startsWith("data:image/")) {
    if (image.length > MAX_REPLICATE_DATA_URL_CHARS) {
      console.warn(
        `[Shopping] data URL too large for Replicate (${Math.round(image.length / 1024)}KB) — skip`
      )
      return undefined
    }
    return image
  }
  // public 경로: 배포 URL(HTTPS) 우선 — base64 임베드는 E006/용량 문제
  if (image.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    if (base) {
      const origin = base.startsWith("http") ? base : `https://${base}`
      return `${origin.replace(/\/$/, "")}${image}`
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as typeof import("fs")
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path") as typeof import("path")
      const filePath = path.join(process.cwd(), "public", image.replace(/^\//, ""))
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath)
        if (buf.length > 2_000_000) {
          console.warn("[Shopping] public 이미지 파일이 커서 Replicate에 넣지 않음:", image)
          return undefined
        }
        const ext = path.extname(filePath).toLowerCase()
        const mime =
          ext === ".png"
            ? "image/png"
            : ext === ".webp"
              ? "image/webp"
              : ext === ".gif"
                ? "image/gif"
                : "image/jpeg"
        const dataUrl = `data:${mime};base64,${buf.toString("base64")}`
        return isUsableReplicateImageRef(dataUrl) ? dataUrl : undefined
      }
    } catch (err) {
      console.warn("[Shopping] public 이미지 로드 실패:", image, err)
    }
    return undefined
  }
  const mimeType = image.includes("/9j/") ? "image/jpeg" : "image/png"
  const dataUrl = `data:${mimeType};base64,${image}`
  return isUsableReplicateImageRef(dataUrl) ? dataUrl : undefined
}

/**
 * nano-banana용 프롬프트 정제.
 * 한글/특수문자가 남으면 자막으로 그려지거나 E006 invalid input 이 날 수 있음.
 */
function neutralizeCaptionLeakInImagePrompt(prompt: string): string {
  return prompt
    .replace(/[\uAC00-\uD7A3]+/g, " ")
    .replace(/[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]+/g, " ")
    .replace(/[「」『』【】·…—–]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4500)
}

function englishProductLabel(productName?: string): string {
  const raw = String(productName || "").trim()
  if (!raw) return "the featured product"
  const ascii = raw.replace(/[\uAC00-\uD7A3]+/g, " ").replace(/\s+/g, " ").trim()
  return ascii.length >= 2 ? ascii : "the featured product"
}

// 나노바나나를 사용한 이미지 생성 (제품 + 캐릭터 레퍼런스 참고)
export async function generateImageWithNanobanana(
  sceneScript: string,
  productName: string,
  productImageBase64: string | undefined,
  replicateApiKey?: string,
  sceneIndex?: number, // 섹션 인덱스 — 폴백 비트용
  productDescription?: string, // 제품 설명
  aspectRatio?: string, // 원본 이미지 비율 (예: "1:1", "9:16", "16:9")
  character?: AnimalCharacter | null,
  /** problem | travel | store | detail | use ... — 씬과 안 맞는 마트/제품 강제 방지 */
  sceneType?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  const resolvedCharacter = resolveAnimalCharacter(character)
  const productLabelEn = englishProductLabel(productName)
  const usageAction = inferAnimalProductUsage(productName, productDescription)
  // 프롬프트 텍스트에 story beat가 있으면 타입 추론 (재생성 호환)
  const inferredType =
    sceneType ||
    (() => {
      const t = sceneScript || ""
      if (/\bproblem\b/i.test(t) || /문제/.test(t)) return "problem"
      if (/\btravel\b/i.test(t) || /이동/.test(t)) return "travel"
      if (/\bdetail\b/i.test(t) || /제품 확대/.test(t)) return "detail"
      if (/\b(store|compare|buy)\b/i.test(t) || /마트|구매|비교/.test(t)) return "store"
      if (/\bhome\b/i.test(t) || /귀가/.test(t)) return "home"
      if (/\b(use|delight)\b/i.test(t) || /활용|만족/.test(t)) return "use"
      return undefined
    })()
  const beatRules = animalSceneBeatRules(inferredType, productLabelEn, usageAction)
  const visualDna = buildAnimalVisualDna(
    {
      ...resolvedCharacter,
      // DNA에 한글 이름/성격이 들어가지 않게 영문 외형만 사용
      name: "shopper",
      personality: "cheerful shopping animal",
      breedOrLook: "",
    },
    {
      productName: productLabelEn,
      productDescription: undefined,
      sceneType: inferredType,
    }
  )

  try {
    // sceneScript가 제공되면 그것을 사용 (재생성 시 추가 프롬프트 포함)
    let imagePrompt: string
    
    if (sceneScript && sceneScript.trim() && sceneScript.length > 50) {
      imagePrompt = `${sceneScript}

${visualDna}
Keep character identity locked to: ${resolvedCharacter.visualPromptEn}.
STORY BEAT LOCK (do not ignore): ${beatRules.beat}. Setting: ${beatRules.setting}.
${beatRules.includeProductRef ? `Product action: ${beatRules.action}` : "No product demo in this beat."}`
      console.log(
        "[Shopping] 제공된 프롬프트 사용 (씬 비트:",
        inferredType || "unknown",
        "):",
        sceneScript.substring(0, 100) + "..."
      )
    } else {
      const sceneConfigs = getProductSceneConfigs(productName, productDescription)
      
      const currentSceneIndex = sceneIndex !== undefined ? sceneIndex : 0
      const config = sceneConfigs[currentSceneIndex] || sceneConfigs[0]
      imagePrompt = `${productLabelEn} animal shopping short-form still.

${visualDna}

Scene beat: ${beatRules.beat}
Setting: ${beatRules.setting}
Props: ${beatRules.props}
Product rule: ${beatRules.product}
Action: ${beatRules.action}
Camera: ${config.angle}; ${config.camera}; ${config.lighting}; ${config.composition}
The animal MUST be the shopper (standing bipedal), NOT a tiny pet on the floor.`
    }
    
    // problem/travel 은 제품 레퍼런스를 넣지 않음 — 모델이 텀블러를 손에 쥐게 만듦
    const useProductRef = Boolean(productImageBase64) && beatRules.includeProductRef

    if (useProductRef) {
      imagePrompt = `${imagePrompt}

PRODUCT REFERENCE LOCK (image_input #1):
- Match the attached product photo EXACTLY: silhouette, colors, packaging, labels, buttons, materials.
- Do NOT invent features that are not in the reference.
- Product must be readable in frame for THIS beat (${beatRules.beat}).
- Background must match the story beat setting (not the plain reference photo backdrop).
- ${beatRules.action}`
    } else if (productImageBase64) {
      imagePrompt = `${imagePrompt}

PRODUCT ABSENCE LOCK (this beat is ${beatRules.beat}):
- Do NOT place the featured product in the animal's paws.
- Do NOT copy the product reference into this frame.
- Empty basket is OK; supermarket interior aisle is FORBIDDEN for travel/problem.`
    }

    if (resolvedCharacter.referenceImage) {
      imagePrompt = `${imagePrompt}

CHARACTER REFERENCE LOCK (image_input #${useProductRef ? "2" : "1"}):
- Match the attached character photo EXACTLY: face, fur pattern, colors, ears, body proportions.
- Same character identity as visual DNA. Do not invent a different animal species or pattern.`
    }

    if (useProductRef && resolvedCharacter.referenceImage) {
      imagePrompt = `${imagePrompt}

DUAL REFERENCE RULE: image_input[0]=PRODUCT, image_input[1]=CHARACTER. Both must appear together matching the story beat (${beatRules.beat}).
ANATOMY SELF-CHECK: Count arms/paws - must be exactly two arms and two paws. Basket on floor only if shown.`
    }

    // Always append anatomy + no-text + beat guards
    imagePrompt = `${imagePrompt}

ANATOMY GUARD (HIGHEST PRIORITY):
- Exactly 2 arms, 2 paws, 2 legs, 1 head. Zero extra limbs.
- ${
      beatRules.includeProductRef
        ? "Hold only the featured product if holding something. Basket on floor only."
        : "Do NOT hold the featured product. Empty hands or empty basket only."
    }
- No hand tucked in a pocket while another hand on that same side holds an object.

BEAT LOCATION GUARD (HIGHEST PRIORITY):
- ${beatRules.setting}
- Wrong location for this beat is a hard fail (e.g. indoor aisle during travel/problem).

NO TEXT / NO SUBTITLES GUARD (HIGHEST PRIORITY - HARD FAIL IF VIOLATED):
- Do NOT render any text, letters, Hangul, captions, subtitles, speech bubbles, lower-thirds, watermarks, or UI overlays.
- Do NOT add a dark translucent bar or rounded box at the bottom of the frame with words.
- Product packaging may keep its real printed labels from the reference photo only - invent no extra writing.
- Output must look like a clean still photograph with zero burned-in captions.`

    imagePrompt = neutralizeCaptionLeakInImagePrompt(imagePrompt)

    const imageAspectRatio = aspectRatio && aspectRatio !== "auto" ? aspectRatio : "9:16"
    console.log(`[Shopping] 이미지 생성 비율: ${imageAspectRatio}`)

    const productUrl = useProductRef ? toDataUrlMaybe(productImageBase64) : null
    const characterUrl = toDataUrlMaybe(resolvedCharacter.referenceImage)
    const fullImageInput = [productUrl, characterUrl].filter(isUsableReplicateImageRef)
    console.log(
      `[Shopping] nano-banana refs: product=${Boolean(productUrl)} character=${Boolean(characterUrl)} usable=${fullImageInput.length}`
    )

    const shortPrompt = neutralizeCaptionLeakInImagePrompt(
      `${resolvedCharacter.visualPromptEn}, ${beatRules.beat}, ${beatRules.setting}, ${beatRules.action}, vertical 9:16 photo, no text no subtitles no captions`
    )

    const strategies: Array<{ label: string; prompt: string; images: string[] }> = [
      { label: "full-refs", prompt: imagePrompt, images: fullImageInput },
      {
        label: "product-only",
        prompt: imagePrompt,
        images: productUrl && isUsableReplicateImageRef(productUrl) ? [productUrl] : [],
      },
      {
        label: "character-only",
        prompt: imagePrompt,
        images:
          characterUrl && isUsableReplicateImageRef(characterUrl) ? [characterUrl] : [],
      },
      { label: "text-only", prompt: shortPrompt, images: [] },
    ].filter(
      (strategy, index, all) =>
        // 동일 images 전략 중복 제거
        all.findIndex(
          (other) =>
            other.prompt === strategy.prompt &&
            other.images.join("|") === strategy.images.join("|")
        ) === index
    )

    const extractOutputUrl = (output: unknown): string => {
      let imageUrl = ""
      if (typeof output === "string") imageUrl = output
      else if (Array.isArray(output) && output.length > 0) {
        const first = output[0]
        imageUrl =
          typeof first === "string"
            ? first
            : String((first as { url?: string })?.url || first || "")
      } else if (output && typeof output === "object" && "url" in output) {
        imageUrl = String((output as { url?: string }).url || "")
      } else imageUrl = String(output || "")
      if (!imageUrl.startsWith("http")) {
        throw new Error("이미지 URL이 유효하지 않습니다.")
      }
      return imageUrl
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt < strategies.length; attempt++) {
      const strategy = strategies[attempt]!
      try {
        if (attempt > 0) {
          console.log(
            `[Shopping] nano-banana fallback ${attempt}/${strategies.length - 1}: ${strategy.label}`
          )
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
        }

        const response = await fetch(
          "https://api.replicate.com/v1/models/google/nano-banana/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                prompt: strategy.prompt,
                aspect_ratio: imageAspectRatio,
                ...(strategy.images.length > 0
                  ? { image_input: strategy.images }
                  : {}),
              },
            }),
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          const retryable =
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504 ||
            response.status === 400 ||
            response.status === 422 ||
            /E006|invalid input|input was invalid/i.test(errorText)
          lastError = new Error(
            `이미지 생성 실패: ${response.status} - ${errorText.substring(0, 200)}`
          )
          if (retryable && attempt < strategies.length - 1) continue
          throw lastError
        }

        const data = await response.json()

        if (data.status === "succeeded" && data.output) {
          const imageUrl = extractOutputUrl(data.output)
          console.log(`[Shopping] 나노바나나 완료 (${strategy.label}):`, imageUrl)
          return imageUrl
        }

        if (data.status === "failed") {
          const errMsg = String(data.error || "알 수 없는 오류")
          lastError = new Error(`이미지 생성 실패: ${errMsg}`)
          if (/E006|invalid input/i.test(errMsg) && attempt < strategies.length - 1) {
            continue
          }
          throw lastError
        }

        if (data.status === "processing" || data.status === "starting") {
          const predictionId = data.id
          let polls = 0
          while (polls < 120) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
            const statusResponse = await fetch(
              `https://api.replicate.com/v1/predictions/${predictionId}`,
              {
                headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
              }
            )
            if (!statusResponse.ok) {
              throw new Error(`상태 확인 실패: ${statusResponse.status}`)
            }
            const statusData = await statusResponse.json()
            if (statusData.status === "succeeded" && statusData.output) {
              const imageUrl = extractOutputUrl(statusData.output)
              console.log(
                `[Shopping] 나노바나나 완료 폴링 (${strategy.label}):`,
                imageUrl
              )
              return imageUrl
            }
            if (statusData.status === "failed") {
              const errMsg = String(statusData.error || "알 수 없는 오류")
              lastError = new Error(`이미지 생성 실패: ${errMsg}`)
              if (/E006|invalid input/i.test(errMsg) && attempt < strategies.length - 1) {
                break
              }
              throw lastError
            }
            if (statusData.status === "canceled") {
              throw new Error("이미지 생성이 취소되었습니다.")
            }
            polls++
          }
          if (lastError && /E006|invalid input/i.test(lastError.message)) {
            continue
          }
          throw lastError || new Error("이미지 생성 시간 초과")
        }

        lastError = new Error(
          `이미지 생성 실패: ${data.error || data.status || "알 수 없는 오류"}`
        )
        if (attempt < strategies.length - 1) continue
        throw lastError
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (
          attempt < strategies.length - 1 &&
          /E006|invalid input|TypeError|fetch|502|503|504/i.test(lastError.message)
        ) {
          continue
        }
        throw lastError
      }
    }

    throw lastError || new Error("이미지 생성 실패: 모든 재시도 실패")
  } catch (error) {
    console.error("[Shopping] 나노바나나 이미지 생성 실패:", error)
    throw error
  }
}

// 대본 기반으로 영상 생성 프롬프트 생성 (제품 변형 최소화 · 어색한 동작 배제)
export async function generateVideoPromptFromScript(
  sceneScript: string,
  productName: string,
  duration: number, // 초 단위
  productDescription?: string,
  character?: AnimalCharacter | null,
  sceneType?: string
): Promise<string> {
  void sceneScript
  void productDescription
  const c = resolveAnimalCharacter(character)
  const isCloseup = sceneType === "detail"

  if (isCloseup) {
    return [
      `Image-to-video from the input still. Duration exactly ${duration} seconds.`,
      `Keep "${productName}" EXACTLY as shown — rigid geometry, size, colors, logos, packaging locked for the entire clip.`,
      `Nearly static product close-up: only tiny light shimmer or 1% micro camera drift.`,
      `FORBIDDEN: morphing, melting, warping, bending, stretching, squashing, growing, shrinking, dissolving, cracking, liquid deformation.`,
      `FORBIDDEN: new objects, crushing grip, dramatic motion, zoom punches, pans, orbits, cuts, text, subtitles, humans.`,
      `Result must look like a real locked-off camera filmed the same still product.`,
    ].join(" ")
  }

  return [
    `Image-to-video from the input still. Duration exactly ${duration} seconds.`,
    `Preserve the input frame: same composition, lighting, background, animal identity (${c.visualPromptEn}), and product "${productName}".`,
    `PRODUCT LOCK (HIGHEST PRIORITY): The product keeps EXACT rigid shape/size/colors from frame 1 to the last frame — never morph, melt, warp, bend, stretch, squash, or change silhouette.`,
    `Motion budget (subtle only): soft blink, tiny head tilt, gentle breathing. Paws may make a very small adjustment without squeezing or bending the product.`,
    `Do NOT invent big new actions (no tossing, crushing, spinning the product, or dramatic gestures).`,
    `FORBIDDEN: product deformation, morphing, melting, extra limbs, humans, human hands, text, subtitles, captions, sudden zooms, cuts, camera orbit.`,
    `Prefer a locked-off or near-locked camera. Photorealistic, vertical 9:16.`,
  ].join(" ")
}

export async function generateVideoPromptForImage(
  imageIndex: 0 | 1 | 2,
  productName: string,
  productDescription?: string,
  duration?: number,
  apiKey?: string,
  character?: AnimalCharacter | null
): Promise<string> {
  void apiKey
  void productDescription

  if (!duration || duration <= 0) {
    console.warn("[Shopping] generateVideoPromptForImage: invalid duration, fallback 4s")
    duration = 4
  }

  const c = resolveAnimalCharacter(character)
  const usage = inferAnimalProductUsage(productName, productDescription)
  const motionBeats = [
    `wide shot: the animal shopper discovers "${productName}" on the shelf, slight head turn and gentle reach to pick it up — keep exact product shape`,
    `medium shot: the animal ACTIVELY uses the product — ${usage}; subtle paw motion, shopping basket nearby`,
    `alternate angle: the animal continues demonstrating "${productName}" — ${usage}; small body sway; product fully visible and undeformed`,
  ] as const

  return [
    "Animal shopping I2V from input still. Duration EXACTLY " + duration + " seconds (not " + duration * 3 + ").",
    "Subject: " + c.visualPromptEn + '. Name vibe "' + c.name + '" — ' + c.personality + ".",
    "IDENTITY LOCK: Keep the SAME animal face, fur pattern, colors, and bipedal shopper pose as the input image. Do not morph into a different animal or a human.",
    "PRODUCT LOCK: " + productName + " must stay fully visible and UNDEFORMED — exact shape/colors as input image.",
    "USAGE: " + usage,
    "Scene beat: " + motionBeats[imageIndex],
    "Subtle natural animal motion only (blink, micro head tilt, gentle use). Soft horizontal camera drift allowed.",
    "FORBIDDEN: humans, human faces, human hands, text/watermarks, product deformation, swapping species, extreme morphing.",
    "Preserve supermarket background from input. Photorealistic viral short-form, vertical 9:16.",
  ].join(" ")
}

export async function generateVideoPromptFor3Scenes(
  sceneType: "product" | "closeup" | "angle",
  productName: string,
  productDescription?: string,
  script?: string,
  apiKey?: string,
  character?: AnimalCharacter | null
): Promise<string> {
  void script
  const imageIndex = sceneType === "product" ? 0 : sceneType === "closeup" ? 1 : 2
  return generateVideoPromptForImage(imageIndex, productName, productDescription, undefined, apiKey, character)
}

function getProductSpecificActions(
  productName: string,
  productDescription?: string
): { allowedActions: string; forbiddenActions: string; needsHands: boolean } {
  const usage = inferAnimalProductUsage(productName, productDescription)
  return {
    allowedActions: usage,
    forbiddenActions: "humans, human hands, product deformation, idle product-only still life without the animal using it",
    needsHands: false,
  }
}



// (레거시) 제품 행동 프롬프트 — 동물 쇼핑 I2V는 generateVideoPromptForImage 사용
async function generateProductActionPromptWithAI(
  productName: string,
  productDescription: string | undefined,
  _imageIndex: 0 | 1 | 2,
  _apiKey?: string
): Promise<{ allowedActions: string; forbiddenActions: string; needsHands: boolean }> {
  return getProductSpecificActions(productName, productDescription)
}

export type GeneratedAnimalScenes = {
  scenes: Array<{
    type: string
    title: string
    narration: string
  }>
  fullScript: string
  sceneCount: number
}

/** 문제→(이동)→마트→활용 스토리. 씬 수는 영상 길이에 비례(3~8) */
export async function generateShoppingScenes(
  productName: string,
  productDescription: string,
  apiKey?: string,
  duration: number = 30,
  character?: AnimalCharacter | null,
  sceneCount?: number
): Promise<GeneratedAnimalScenes> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY
  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  const resolvedCharacter = resolveAnimalCharacter(character)
  const characterHint = characterNarrationHint(resolvedCharacter)
  const safeDuration = Math.max(10, Math.min(60, Math.round(duration) || 30))
  const count = Math.max(
    3,
    Math.min(8, sceneCount || suggestAnimalSceneCount(safeDuration))
  )
  const arc = getAnimalStoryArc(count)
  const targetLength = Math.round(safeDuration * 6.7)
  const perScene = Math.round(targetLength / count)
  const arcGuide = arc
    .map((type, i) => `${i + 1}. ${type} (${ANIMAL_SCENE_LABELS[type] || type})`)
    .join("\n")
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: [
                "당신은 'AI 동물 쇼핑 숏폼' 스토리 대본 전문가입니다.",
                "시청자가 좋아하는 전개: 주인공 동물에게 문제가 생김 → 마트/매장으로 이동·구매 → 집이나 밖에서 제품을 잘 활용해 해결.",
                "컷이 많을수록 후킹이 강해지므로, 요청한 씬 개수를 정확히 지켜 장면을 촘촘히 나누세요.",
                characterHint,
                "",
                "규칙:",
                "- 사람 인플루언서 리뷰가 아님. 동물 캐릭터(" + resolvedCharacter.name + ") 시점.",
                "- 정확히 " + count + "개 씬. 아래 타입 순서를 지키세요:",
                arcGuide,
                "- problem: 일상 불편·니즈 훅 (제품 구매 전)",
                "- travel: 마트/매장으로 이동 (있을 때만)",
                "- store: 매장에서 제품 발견",
                "- compare: 고민·비교 (있을 때만)",
                "- detail: 제품 확대·디테일 훅 (제품 특징을 짧게)",
                "- buy: 구매·담기 (있을 때만)",
                "- home: 귀가·개봉 준비 (있을 때만)",
                "- use: 집/밖에서 제품 활용으로 문제 해결",
                "- delight: 만족·여운 (있을 때만)",
                "- 각 narration은 쇼츠 톤, 성격(" + resolvedCharacter.personality + ") 반영",
                "- 전체 합쳐 약 " + targetLength + "자 (" + safeDuration + "초), 씬당 약 " + perScene + "자",
                "- CTA·링크 유도 금지",
                "- JSON만 출력: {\"scenes\":[{\"type\":\"...\",\"title\":\"...\",\"narration\":\"...\"}, ...]}",
              ].join("\n"),
            },
            {
              role: "user",
              content: [
                "제품명: " + productName,
                "제품 설명: " + productDescription,
                characterHint,
                "",
                safeDuration + "초 / 정확히 " + count + "씬 스토리를 JSON으로 작성해주세요.",
                "type 순서: " + arc.join(" → "),
              ].join("\n"),
            },
          ],
          max_tokens: Math.min(1400, 280 + count * 140),
          temperature: 0.85,
        }),
      })

      if (!response.ok) {
        let errorMessage = "API 호출 실패: " + response.status
        try {
          const errorData = await response.text()
          if (errorData) {
            const errorJson = JSON.parse(errorData)
            errorMessage = errorJson.error?.message || errorData || errorMessage
          }
        } catch (_e) {}

        if ((response.status === 502 || response.status === 503 || response.status === 504 || response.status === 429) && attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
          lastError = new Error(errorMessage)
          continue
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content
      if (!content) throw new Error("대본 생성에 실패했습니다.")

      const parsed = JSON.parse(content) as {
        scenes?: Array<{ type?: string; title?: string; narration?: string }>
      }
      const raw = Array.isArray(parsed.scenes) ? parsed.scenes : []
      const scenes = arc.map((type, index) => {
        const hit =
          raw.find((s) => s.type === type) ||
          raw[index] ||
          { title: ANIMAL_SCENE_LABELS[type] || type, narration: "" }
        const narration = String(hit.narration || "")
          .replace(/^\d+[\.\)]\s*/gm, "")
          .replace(/^\[.*?\]\s*/gm, "")
          .trim()
        return {
          type,
          title: String(hit.title || ANIMAL_SCENE_LABELS[type] || type).trim(),
          narration,
        }
      })

      if (scenes.some((s) => !s.narration)) {
        throw new Error("씬 대본이 비어 있습니다. 다시 생성해주세요.")
      }

      const fullScript = scenes.map((s) => s.narration).join(" ")
      console.log(
        `[Shopping] 씬 대본 생성 완료: ${scenes.length}씬, 전체 ${fullScript.length}자 (목표 ${safeDuration}초)`
      )
      return { scenes, fullScript, sceneCount: count }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000))
        continue
      }
    }
  }

  throw lastError || new Error("대본 생성에 실패했습니다.")
}

export async function generateShoppingScript(
  productName: string,
  productDescription: string,
  apiKey?: string,
  duration: number = 30,
  character?: AnimalCharacter | null
) {
  const result = await generateShoppingScenes(
    productName,
    productDescription,
    apiKey,
    duration,
    character
  )
  return result.fullScript
}

// 대본을 파트별로 분석하는 함수
export async function analyzeScriptParts(
  script: string,
  apiKey?: string
): Promise<Array<{ part: string; text: string; startIndex: number; endIndex: number }>> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 쇼핑 영상 대본 분석 전문가입니다. 주어진 대본을 다음 파트로 분석해주세요:

1. 인트로/후킹: 시청자의 관심을 끄는 시작 부분
2. 제품 소개: 제품에 대한 기본 정보
3. 제품 장점: 제품의 특징과 장점
4. 마무리: 마무리 멘트

각 파트의 시작 위치와 끝 위치를 정확히 찾아서 JSON 형식으로 반환해주세요.

JSON 형식:
{
  "parts": [
    {
      "part": "인트로/후킹",
      "text": "해당 파트의 텍스트",
      "startIndex": 시작_인덱스,
      "endIndex": 끝_인덱스
    },
    ...
  ]
}`,
          },
          {
            role: "user",
            content: `다음 대본을 분석해주세요:\n\n${script}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    return parsed.parts || []
  } catch (error) {
    console.error("대본 분석 실패:", error)
    // 분석 실패 시 기본 분할 반환
    const parts = []
    const sentences = script.split(/[.!?。！？]\s*/).filter(s => s.trim().length > 0)
    const totalSentences = sentences.length
    
    if (totalSentences > 0) {
      const introEnd = Math.ceil(totalSentences * 0.25)
      const introEndIndex = script.indexOf(sentences[Math.min(introEnd - 1, sentences.length - 1)]) + sentences[Math.min(introEnd - 1, sentences.length - 1)].length
      
      const productEnd = Math.ceil(totalSentences * 0.5)
      const productEndIndex = script.indexOf(sentences[Math.min(productEnd - 1, sentences.length - 1)]) + sentences[Math.min(productEnd - 1, sentences.length - 1)].length
      
      const advantageEnd = Math.ceil(totalSentences * 0.75)
      const advantageEndIndex = script.indexOf(sentences[Math.min(advantageEnd - 1, sentences.length - 1)]) + sentences[Math.min(advantageEnd - 1, sentences.length - 1)].length
      
      parts.push(
        { part: "인트로/후킹", text: script.substring(0, introEndIndex), startIndex: 0, endIndex: introEndIndex },
        { part: "제품 소개", text: script.substring(introEndIndex, productEndIndex), startIndex: introEndIndex, endIndex: productEndIndex },
        { part: "제품 장점", text: script.substring(productEndIndex, advantageEndIndex), startIndex: productEndIndex, endIndex: advantageEndIndex },
        { part: "마무리", text: script.substring(advantageEndIndex), startIndex: advantageEndIndex, endIndex: script.length }
      )
    }
    
    return parts.filter(p => p.text.trim().length > 0)
  }
}

// 추가 프롬프트를 반영하여 이미지 프롬프트를 AI로 재작성
export async function refineImagePromptWithCustomInput(
  originalPrompt: string,
  customPrompt: string,
  productName: string,
  productDescription?: string,
  apiKey?: string
): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    // API 키가 없으면 단순히 연결
    return `${originalPrompt}, ${customPrompt}`
  }

  try {
    console.log("[Shopping] AI를 사용하여 프롬프트 재작성 시작")
    console.log("[Shopping] 원본 프롬프트:", originalPrompt.substring(0, 100))
    console.log("[Shopping] 추가 프롬프트:", customPrompt)

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 이미지 생성 프롬프트 전문가입니다. 사용자가 제공한 기존 프롬프트와 추가 요구사항을 바탕으로, Replicate의 nano-banana 모델에 최적화된 영어 프롬프트를 작성해주세요.

중요 규칙:
- 기존 프롬프트의 핵심 내용은 유지하되, 추가 요구사항을 자연스럽게 통합
- 제품의 실제 모습을 정확하게 보여주는 것이 중요
- 영어로 작성하되, 한국어 요구사항의 의미를 정확히 반영
- 구체적이고 시각적으로 묘사할 수 있는 표현 사용
- 프롬프트는 명확하고 간결하게 작성
- 제품 이미지가 참고 이미지로 제공된 경우, 원본 제품의 기능, 버튼, 스위치, 조절 장치를 정확하게 유지해야 함
- 원본 제품에 없는 새로운 기능, 버튼, 스위치, 조절 장치를 절대 추가하지 않음 (no additional features, no extra buttons, no new switches, no new controls)
- 제품의 원본 디자인과 구조를 정확하게 보존 (exact product design preservation, maintain original product structure)
- 주인공이 동물이면 동물 정체성(얼굴·털무늬)을 유지하고, 동물이 제품을 실제로 활용·시연하는 동작을 유지
- 인간/인간 손 금지`,
          },
          {
            role: "user",
            content: `기존 프롬프트:
${originalPrompt}

추가 요구사항 (한국어):
${customPrompt}

제품명: ${productName}
${productDescription ? `제품 설명: ${productDescription}` : ''}

위 정보를 바탕으로 개선된 이미지 생성 프롬프트를 작성해주세요. 기존 프롬프트의 핵심은 유지하되, 추가 요구사항을 자연스럽게 통합한 영어 프롬프트를 작성해주세요.`,
          },
        ],
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 프롬프트 재작성 API 오류:", errorText)
      // API 오류 시 단순히 연결
      return `${originalPrompt}, ${customPrompt}`
    }

    const data = await response.json()
    const refinedPrompt = data.choices[0]?.message?.content?.trim()

    if (!refinedPrompt) {
      console.warn("[Shopping] 프롬프트 재작성 응답이 비어있음, 기본 연결 사용")
      return `${originalPrompt}, ${customPrompt}`
    }

    console.log("[Shopping] ✅ AI가 재작성한 프롬프트:", refinedPrompt.substring(0, 150))
    return refinedPrompt
  } catch (error) {
    console.error("[Shopping] 프롬프트 재작성 실패:", error)
    // 오류 시 단순히 연결
    return `${originalPrompt}, ${customPrompt}`
  }
}

// 대본에 맞는 이미지 프롬프트 생성 (대본 전체를 분석하여 3개의 프롬프트 생성)
export async function generateImagePromptsFromScript(
  script: string,
  productName: string,
  productDescription: string,
  productImageBase64: string | undefined,
  apiKey?: string,
  character?: AnimalCharacter | null,
  sceneCount?: number
): Promise<Array<{ type: string; prompt: string; description: string; scriptText: string }>> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  const resolvedCharacter = resolveAnimalCharacter(character)
  const visualDna = buildAnimalVisualDna(resolvedCharacter, {
    productName,
    productDescription,
  })
  const usageAction = inferAnimalProductUsage(productName, productDescription)
  const hasProductRef = Boolean(productImageBase64?.trim())
  const count = Math.max(3, Math.min(8, sceneCount || suggestAnimalSceneCount(30)))
  const arc = getAnimalStoryArc(count)

  const fallback = (): Array<{ type: string; prompt: string; description: string; scriptText: string }> => {
    const scriptLength = script.length
    const look = resolvedCharacter.visualPromptEn
    const refHint = hasProductRef
      ? "exact product from reference photo, preserve packaging shape and colors"
      : "product clearly recognizable"
    const chunk = Math.max(1, Math.floor(scriptLength / count))
    return arc.map((type, index) => {
      const start = index * chunk
      const end = index === count - 1 ? scriptLength : (index + 1) * chunk
      const beat =
        type === "problem"
          ? `PROBLEM beat home/outdoor, no product in hands yet`
          : type === "travel"
            ? `TRAVEL beat: outdoor sunny street/path walking toward supermarket exterior, empty basket OK, NO ${productName} in hands, NOT inside aisle`
            : type === "detail"
              ? `PRODUCT CLOSE-UP hero shot of ${productName} filling most of the frame, ${refHint}, shallow DOF`
              : type === "store" || type === "compare" || type === "buy"
                ? `STORE beat supermarket aisle with ${productName}, ${refHint}, basket on floor`
                : type === "home"
                  ? `HOME beat arriving home with ${productName}, ${refHint}`
                  : `USE/DELIGHT beat using ${productName}, ${usageAction}, ${refHint}`
      return {
        type: ANIMAL_SCENE_LABELS[type] || type,
        prompt: `${look}, ${beat}, exactly two arms two paws, photorealistic viral short-form still, 9:16, clean photo only, absolutely no text no subtitles no captions no Hangul no letters no lower-thirds no speech bubbles, no humans, no extra limbs`,
        description: `${resolvedCharacter.name} · ${ANIMAL_SCENE_LABELS[type]}`,
        scriptText: script.substring(start, end),
        sceneBeat: type,
      }
    })
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 'AI 동물 쇼핑 숏폼' 이미지 프롬프트 전문가입니다. 대본을 분석해 세로 9:16용 이미지 프롬프트를 정확히 ${count}장 만드세요.

제품 정보:
- 제품명: ${productName}
${productDescription ? `- 제품 설명: ${productDescription}` : ""}
- 제품 레퍼런스 이미지: ${hasProductRef ? "있음 — 형태·색·패키지를 정확히 유지" : "없음"}
캐릭터: ${resolvedCharacter.name} / ${resolvedCharacter.breedOrLook} / ${resolvedCharacter.personality}
영문 외형: ${resolvedCharacter.visualPromptEn}
제품 활용 동작(필수): ${usageAction}

${visualDna}

중요 규칙:
- 주인공은 항상 위 캐릭터(${resolvedCharacter.name})만. 인간/인간 손 금지.
- ANATOMY: 팔 2개·손 2개만. 여분 팔/손 금지.
- PROPS: 손에 드는 것은 제품 1개만. 장바구니는 바닥.
- problem: 집/일상 밖 — 제품 손에 없음. 마트 진열장 금지.
- travel: 야외에서 마트 건물로 걸어가는 길(햇빛) — 빈 장바구니 OK, 제품 손에 없음, 매장 내부 금지.
- detail: 제품 확대 클로즈업.
- store/compare/buy: 마트 내부에서 제품 발견·구매.
- home/use/delight: 집/밖에서 제품 활용.
- 절대 모든 컷을 마트 진열장으로 만들지 말 것.
- 이미지 안 글자·자막·캡션·말풍선 절대 금지. 프롬프트에 "no text, no subtitles, no captions, no Hangul overlays"를 반드시 포함.
- prompt 필드는 영어만. 한국어 대본 문장을 프롬프트에 그대로 넣지 말 것(모델이 자막으로 그리기 때문). 분위기는 영어로 요약.
- 정확히 ${count}개, 타입 순서: ${arc.join(" → ")}
- arc에 detail이 있으면 그 슬롯은 반드시 제품 확대 클로즈업이어야 함.

JSON:
{"images":[{"type":"...","prompt":"English only, end with: no text no subtitles no captions...","description":"...","scriptText":"..."}, ... ${count}개 ]}`,
          },
          {
            role: "user",
            content: `다음 대본으로 ${count}장의 동물 쇼핑 이미지 프롬프트를 생성해주세요. 타입 순서: ${arc.map((t) => ANIMAL_SCENE_LABELS[t]).join(" → ")}
대본은 분위기 참고용이며, prompt에 한국어 문장을 복사하지 마세요. 이미지에 글자/자막이 나오면 안 됩니다.

${script}

${resolvedCharacter.name}와 ${productName}. 활용 동작: ${usageAction}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    const images = parsed.images || []
    const fb = fallback()

    if (images.length !== count) {
      console.warn(`프롬프트가 ${count}개가 아닙니다: ${images.length}개`)
      while (images.length < count) {
        images.push(fb[images.length] || fb[fb.length - 1])
      }
    }

    return images.slice(0, count).map(
      (
        img: { type?: string; prompt?: string; description?: string; scriptText?: string },
        index: number
      ) => {
        const arcType = arc[index]
        const isDetail = arcType === "detail"
        const closeup = isDetail
          ? buildProductCloseupImagePrompt(productName, resolvedCharacter, hasProductRef)
          : null
        return {
          type: isDetail
            ? ANIMAL_SCENE_LABELS.detail
            : img.type || fb[index]?.type || `씬${index + 1}`,
          prompt: isDetail
            ? closeup!.prompt
            : img.prompt || fb[index]?.prompt || "",
          description: isDetail
            ? closeup!.description
            : img.description || fb[index]?.description || "",
          scriptText: img.scriptText || fb[index]?.scriptText || "",
          sceneBeat: isDetail ? "detail" : arcType,
        }
      }
    )
  } catch (error) {
    console.error("대본 기반 이미지 프롬프트 생성 실패:", error)
    return fallback()
  }
}

// 제품 분석 및 이미지 생성 프롬프트 생성 (레거시 - 사용 안 함)
async function analyzeProductAndGeneratePrompts(
  productName: string,
  productDescription: string,
  productImageBase64: string | undefined,
  apiKey?: string
): Promise<Array<{ type: string; prompt: string; description: string }>> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 제품 이미지 생성 전문가입니다. 주어진 제품 정보를 분석하여 숏폼 영상 제작용 3장의 이미지를 위한 프롬프트를 생성해주세요.

제품 카테고리 예시: 주방용품, 욕실용품, 청소템, 정리수납, 살림템, 생활용품 등

생성할 이미지 유형:
1. 연출샷: 제품 전체가 잘 보이는 연출 사진 (제품의 전체적인 모습과 사용 맥락을 보여주는 샷, 제품 전체가 화면에 가득 차야 함)
2. 배경 변경: 제품은 동일하지만 완전히 다른 배경의 사진 (제품의 활용 공간을 다양하게 보여주는 샷, 제품 전체가 화면에 가득 차야 함)
3. 디테일샷: 제품 전체가 화면에 가득 차면서 디테일이 강조된 사진 (제품 전체가 보이면서 품질과 특징을 자세히 보여주는 샷, 클로즈업이나 매크로 샷이 아닌 제품 전체가 화면에 가득 찬 사진)

중요 규칙:
- 제품은 반드시 보존되어야 하며, 제품의 모양과 특징이 정확하게 유지되어야 함
- 손이나 사람이 나오지 않아도 됨 (제품 중심)
- 각 이미지는 제품 소개에 최적화되어야 함
- 배경은 제품 카테고리에 맞게 설정
- 숏폼 영상 제작용이므로 제품이 명확하게 보여야 함

JSON 형식으로 응답:
{
  "images": [
    {
      "type": "연출샷",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    },
    {
      "type": "배경 변경",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    },
    {
      "type": "디테일샷",
      "prompt": "이미지 생성 프롬프트 (영어)",
      "description": "이 이미지의 설명"
    }
  ]
}`,
          },
          {
            role: "user",
            content: `제품명: ${productName}
${productDescription ? `제품 설명: ${productDescription}` : ''}
${productImageBase64 ? '제품 이미지가 참고 이미지로 제공됩니다.' : ''}

위 제품을 분석하여 숏폼 영상 제작용 3장의 이미지 프롬프트를 생성해주세요.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("응답 내용이 없습니다.")
    }

    const parsed = JSON.parse(content)
    return parsed.images || []
  } catch (error) {
    console.error("제품 분석 실패:", error)
    // 기본 프롬프트 반환
    return [
      {
        type: "연출샷",
        prompt: `${productName} product, full product shot, clean background, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품 전체 연출샷"
      },
      {
        type: "배경 변경",
        prompt: `${productName} product, different background, lifestyle setting, professional product photography, high quality, 9:16 aspect ratio`,
        description: "다른 배경의 제품 사진"
      },
      {
        type: "디테일샷",
        prompt: `${productName} product, full product visible, entire product fills the frame, product details emphasized, highlighting product features, NOT close-up, NOT macro shot, entire product must be visible, professional product photography, high quality, 9:16 aspect ratio`,
        description: "제품 전체가 화면에 가득 차면서 디테일이 강조된 사진"
      }
    ]
  }
}

// 대본에 맞는 3장의 이미지 생성 (전체 샷, 디테일 샷, 각도와 배경 다르게)
export async function generateImage(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string,
  productDescription?: string,
  apiKey?: string,
  imagePrompts?: Array<{
    type: string
    prompt: string
    description: string
    scriptText: string
    sceneBeat?: string
  }>,
  aspectRatio?: string, // 원본 이미지 비율
  character?: AnimalCharacter | null
): Promise<string[]> {
  void script
  void apiKey
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  if (!imagePrompts || imagePrompts.length < 3) {
    throw new Error("이미지 프롬프트가 최소 3개 필요합니다. 먼저 프롬프트를 생성해주세요.")
  }

  try {
    console.log(`[Shopping] 대본 기반 ${imagePrompts.length}장 이미지 생성 시작`)

    const imageUrls: string[] = []

    for (let i = 0; i < imagePrompts.length; i++) {
      const prompt = imagePrompts[i]
      console.log(
        `[Shopping] 이미지 ${i + 1}/${imagePrompts.length} 생성 중... (타입: ${prompt.type}, beat: ${prompt.sceneBeat || "?"})`
      )

      const imageUrl = await generateImageWithNanobanana(
        prompt.prompt,
        productName,
        productImageBase64,
        REPLICATE_API_TOKEN,
        i,
        productDescription,
        aspectRatio,
        character,
        prompt.sceneBeat
      )
      
      imageUrls.push(imageUrl)
      console.log(`[Shopping] 이미지 ${i + 1}/${imagePrompts.length} 생성 완료:`, imageUrl)
    }
    
    console.log(`[Shopping] ${imageUrls.length}장 이미지 생성 완료`)
    return imageUrls
  } catch (error) {
    console.error("[Shopping] 이미지 생성 실패:", error)
    throw error
  }
}


/** 캐릭터 레퍼런스 시트 생성 (얼굴·무늬 고정용) */
export async function convertImageToVideoWithWan(
  imageUrl: string,
  prompt: string, // 프롬프트 (필수)
  audioUrl?: string, // 오디오 URL (선택, wan-2.2-i2v-fast는 오디오 불필요)
  replicateApiKey?: string,
  duration?: number, // 영상 길이 (초 단위, 선택) - 레거시 호환성
  sampleShift?: number // sample_shift 값 (TTS 길이에 맞게 설정, 선택)
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    console.log(`[Shopping] wan-video/wan-2.2-i2v-fast 모델로 이미지를 영상으로 변환 시작:`, imageUrl)
    console.log(`[Shopping] 프롬프트:`, prompt)
    
    // 이미지 URL 유효성 확인
    let validImageUrl = imageUrl
    
    // 이미지 URL이 유효한지 확인 (404 방지)
    try {
      const imageCheckResponse = await fetch(imageUrl, { method: "HEAD" })
      if (!imageCheckResponse.ok) {
        console.warn(`[Shopping] 이미지 URL 접근 실패 (${imageCheckResponse.status}), URL 재확인:`, imageUrl)
        // URL이 유효하지 않으면 그대로 진행 (Replicate가 직접 확인할 수 있음)
      } else {
        console.log(`[Shopping] 이미지 URL 유효성 확인 완료`)
      }
    } catch (checkError) {
      console.warn(`[Shopping] 이미지 URL 확인 중 오류 (계속 진행):`, checkError)
      // 확인 실패해도 계속 진행 (Replicate가 직접 확인할 수 있음)
    }
    
    // Replicate API 경로: wan-video/wan-2.2-i2v-fast 모델 사용
    const apiUrl = "https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-fast/predictions"
    
    // wan-2.2-i2v-fast 모델 입력: 이미지, 프롬프트, sample_shift
    // sample_shift는 TTS 길이에 맞게 설정되어야 함
    const modelInput: any = {
      image: validImageUrl, // 이미지 URL (공개 접근 가능해야 함, 9:16 비율)
      prompt: prompt, // 프롬프트 (필수)
    }
    
    // sample_shift가 제공되면 추가 (TTS 길이에 맞게 설정)
    if (sampleShift !== undefined && sampleShift > 0) {
      modelInput.sample_shift = sampleShift
      console.log(`[Shopping] ✅ sample_shift 설정: ${sampleShift} (TTS 길이 기반)`)
    } else {
      // sample_shift가 없으면 기본값 12 사용
      modelInput.sample_shift = 12
      console.log(`[Shopping] ⚠️ sample_shift가 제공되지 않아 기본값 12 사용`)
    }
    
    // duration은 레거시 호환성을 위해 로그만 남김 (실제로는 sample_shift 사용)
    if (duration !== undefined && duration > 0) {
      console.log(`[Shopping] 📝 duration 파라미터: ${duration}초 (참고용, 실제로는 sample_shift 사용)`)
    }
    
    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input (duration 포함):`, JSON.stringify(modelInput, null, 2))
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: modelInput,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 영상 변환 오류 응답:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        apiUrl: apiUrl,
        requestBody: JSON.stringify({ input: modelInput }, null, 2)
      })
      
      // 404 오류인 경우 모델 경로 문제일 수 있음
      if (response.status === 404) {
        throw new Error(`모델을 찾을 수 없습니다 (404). 모델 이름이나 버전을 확인해주세요. API URL: ${apiUrl}`)
      }
      
      throw new Error(`영상 변환 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[Shopping] 영상 변환 응답:", JSON.stringify(data, null, 2))

    if (data.status === "succeeded" && data.output) {
      // wan-2.2-i2v-fast는 output.url() 메서드를 가진 객체로 반환됨
      let videoUrl: string
      if (typeof data.output === "string") {
        videoUrl = data.output
      } else if (data.output && typeof data.output === "object") {
        // .url() 메서드가 있으면 호출, 없으면 직접 사용
        videoUrl = (data.output as any).url?.() || (data.output as any).url || data.output
      } else {
        videoUrl = String(data.output)
      }
      console.log(`[Shopping] 영상 생성 완료:`, videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 10분 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          // wan-2.2-i2v-fast는 output.url() 메서드를 가진 객체로 반환됨
          let videoUrl: string
          if (typeof statusData.output === "string") {
            videoUrl = statusData.output
          } else if (statusData.output && typeof statusData.output === "object") {
            // .url() 메서드가 있으면 호출, 없으면 직접 사용
            videoUrl = (statusData.output as any).url?.() || (statusData.output as any).url || statusData.output
          } else {
            videoUrl = String(statusData.output)
          }
          console.log(`[Shopping] 영상 생성 완료 (폴링):`, videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          // 에러 메시지에 이미지 URL 관련 정보가 있으면 더 자세한 에러 메시지 제공
          const errorMessage = statusData.error || "알 수 없는 오류"
          if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
            throw new Error(`영상 변환 실패: 이미지 URL에 접근할 수 없습니다 (404). 이미지 URL: ${imageUrl}. 원인: 이미지가 만료되었거나 삭제되었을 수 있습니다. 이미지를 다시 생성해주세요.`)
          }
          throw new Error(`영상 변환 실패: ${errorMessage}`)
        }

        attempts++
      }

      throw new Error("영상 변환 시간 초과")
    } else {
      throw new Error(`영상 변환 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] 영상 변환 실패:", error)
    throw error
  }
}

export async function convertImagesToVideosWithScript(
  imageUrls: string[],
  script: string,
  productName: string,
  replicateApiKey?: string,
  productDescription?: string,
  scriptLines?: Array<{ startTime: number; endTime: number; text: string }> // TTS 시간 정보 (선택)
): Promise<Array<{ index: number; videoUrl: string; duration: number; sceneScript: string }>> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  if (imageUrls.length !== 3) {
    throw new Error("이미지는 정확히 3개여야 합니다.")
  }

  try {
    console.log("[Shopping] 대본 기반 3개 이미지 영상 변환 시작")
    console.log("[Shopping] 대본 전체 길이:", script.length, "자")
    
    // 1. 대본을 3개 장면으로 나누기
    const scenes = await splitScriptIntoScenes(script)
    console.log("[Shopping] 대본 3분할 완료, 각 장면 길이:")
    scenes.forEach((scene, index) => {
      console.log(`  장면 ${index + 1}: ${scene.length}자 - "${scene.substring(0, 50)}..."`)
    })
    
    // 2. 각 장면의 길이 계산
    // scriptLines가 있으면 실제 TTS 오디오 시간을 사용, 없으면 글자 수 기반 계산
    let sceneDurations: number[]
    
    if (scriptLines && scriptLines.length > 0) {
      // TTS 오디오의 실제 시간 정보 사용
      console.log("[Shopping] TTS 오디오 시간 정보 사용하여 duration 계산")
      const linesPerScene = Math.ceil(scriptLines.length / scenes.length)
      sceneDurations = []
      
      for (let i = 0; i < scenes.length; i++) {
        const startLineIndex = i * linesPerScene
        const endLineIndex = Math.min((i + 1) * linesPerScene, scriptLines.length)
        
        if (startLineIndex < scriptLines.length) {
          const startTime = scriptLines[startLineIndex].startTime / 1000 // 초 단위
          const endTime = endLineIndex < scriptLines.length
            ? scriptLines[endLineIndex - 1].endTime / 1000
            : scriptLines[scriptLines.length - 1].endTime / 1000
          const duration = Math.max(3, Math.ceil(endTime - startTime)) // 최소 3초
          sceneDurations.push(duration)
          console.log(`[Shopping] 장면 ${i + 1} 길이: ${scenes[i].length}자 → ${duration}초 (TTS 오디오 시간 기반)`)
        } else {
          // 폴백: 글자 수 기반
          const charactersPerSecond = 6.7
          const duration = Math.max(3, Math.ceil(scenes[i].length / charactersPerSecond))
          sceneDurations.push(duration)
          console.log(`[Shopping] 장면 ${i + 1} 길이: ${scenes[i].length}자 → ${duration}초 (글자 수 기반, 폴백)`)
        }
      }
    } else {
      // 글자 수 기반 계산 (폴백)
      console.log("[Shopping] 글자 수 기반으로 duration 계산 (TTS 시간 정보 없음)")
      const charactersPerSecond = 6.7
      sceneDurations = scenes.map((scene, index) => {
        const duration = Math.max(3, Math.ceil(scene.length / charactersPerSecond)) // 최소 3초
        console.log(`[Shopping] 장면 ${index + 1} 길이: ${scene.length}자 → ${duration}초 (글자 수 기반)`)
        return duration
      })
    }
    
    const totalDuration = sceneDurations.reduce((sum, dur) => sum + dur, 0)
    console.log(`[Shopping] 전체 영상 길이: ${totalDuration}초 (대본: ${script.length}자)`)
    console.log(`[Shopping] 각 장면 duration:`, sceneDurations.map((d, i) => `장면${i + 1}=${d}초`).join(", "))
    
    // 3. 각 이미지를 해당 장면 길이에 맞게 영상으로 변환
    const videoResults: Array<{ index: number; videoUrl: string; duration: number; sceneScript: string }> = []
    
    for (let i = 0; i < 3; i++) {
      const imageUrl = imageUrls[i]
      const sceneScript = scenes[i]
      const duration = sceneDurations[i]
      
      console.log(`[Shopping] 장면 ${i + 1}/3 영상 변환 시작 (길이: ${duration}초)`)
      console.log(`[Shopping] 장면 대본: "${sceneScript.substring(0, 50)}..."`)
      
      // 대본 기반으로 영상 생성 프롬프트 생성
      const videoPrompt = await generateVideoPromptFromScript(sceneScript, productName, duration, productDescription)
      console.log(`[Shopping] 영상 프롬프트: ${videoPrompt}`)
      
      // 이미지를 영상으로 변환
      const videoUrl = await convertImageToVideoWithWan(
        imageUrl,
        videoPrompt,
        undefined, // audioUrl
        REPLICATE_API_TOKEN,
        duration // duration 전달
      )
      
      console.log(`[Shopping] ✅ 장면 ${i + 1} 영상 변환 완료:`, videoUrl)
      console.log(`[Shopping] 📊 장면 ${i + 1} 정보: duration=${duration}초, URL=${videoUrl.substring(0, 50)}...`)
      
      videoResults.push({
        index: i,
        videoUrl,
        duration,
        sceneScript
      })
    }
    
    console.log(`[Shopping] 대본 기반 3개 영상 변환 완료 (총 ${totalDuration}초)`)
    return videoResults
  } catch (error) {
    console.error("[Shopping] 이미지 영상 변환 실패:", error)
    throw error
  }
}

// 3개의 영상을 하나로 합치기 (클라이언트 측에서 처리)
// MediaRecorder API를 사용하여 각 영상을 순차적으로 녹화하여 합칩니다.
// 각 영상의 duration 정보를 받아서 해당 길이만큼 반복 재생합니다.
export async function mergeVideos(
  videoUrls: string[],
  durations?: number[] // 각 영상의 목표 duration (초 단위)
): Promise<string> {
  if (videoUrls.length === 0) {
    throw new Error("합칠 영상이 없습니다.")
  }
  
  if (videoUrls.length === 1) {
    return videoUrls[0]
  }
  
  console.log(`[Shopping] ${videoUrls.length}개 영상 합치기 시작`)
  
  // 각 영상을 비디오 엘리먼트로 로드
  const videoPromises = videoUrls.map((url, index) => {
    return new Promise<HTMLVideoElement>((resolve, reject) => {
      const video = document.createElement("video")
      video.crossOrigin = "anonymous"
      video.preload = "auto"
      video.muted = true // 음소거하여 자동 재생 가능하게
      video.playsInline = true
      video.src = url
      
      video.onloadedmetadata = () => {
        console.log(`[Shopping] 영상 ${index + 1} 로드 완료: ${video.duration.toFixed(2)}초 (${video.videoWidth}x${video.videoHeight})`)
        resolve(video)
      }
      
      video.onerror = (error) => {
        console.error(`[Shopping] 영상 ${index + 1} 로드 실패:`, error)
        reject(new Error(`영상 ${index + 1} 로드 실패: ${url}`))
      }
    })
  })
  
  const videos = await Promise.all(videoPromises)
  
  // 전체 길이 계산
  const totalDuration = videos.reduce((sum, video) => sum + video.duration, 0)
  console.log(`[Shopping] 전체 영상 길이: ${totalDuration.toFixed(2)}초`)
  
  // 첫 번째 영상의 해상도 사용
  const width = videos[0].videoWidth || 540
  const height = videos[0].videoHeight || 960
  
  // Canvas 생성
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  
  if (!ctx) {
    throw new Error("Canvas 컨텍스트를 가져올 수 없습니다.")
  }
  
  // MediaRecorder 설정
  const stream = canvas.captureStream(30) // 30fps
  let mimeType = 'video/webm;codecs=vp9'
  
  // 지원되는 MIME 타입 확인
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/mp4'
    }
  }
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: mimeType,
    videoBitsPerSecond: 2500000 // 2.5Mbps
  })
  
  const chunks: Blob[] = []
  
  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data)
      console.log(`[Shopping] 데이터 청크 수신: ${(event.data.size / 1024).toFixed(2)}KB`)
    }
  }
  
  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const mergedBlob = new Blob(chunks, { type: mimeType })
      const mergedUrl = URL.createObjectURL(mergedBlob)
      console.log(`[Shopping] 영상 합치기 완료: ${(mergedBlob.size / 1024 / 1024).toFixed(2)}MB`)
      // 스트림 정리
      stream.getTracks().forEach(track => track.stop())
      resolve(mergedUrl)
    }
    
    mediaRecorder.onerror = (event) => {
      console.error("[Shopping] MediaRecorder 오류:", event)
      stream.getTracks().forEach(track => track.stop())
      reject(new Error("영상 녹화 중 오류가 발생했습니다."))
    }
    
    // 녹화 시작
    mediaRecorder.start(100) // 100ms마다 데이터 수집
    console.log("[Shopping] 영상 녹화 시작...")
    
    // 각 영상을 순차적으로 재생하면서 Canvas에 그리기
    let currentVideoIndex = 0
    let animationFrameId: number | null = null
    
    // 각 영상의 목표 duration (초 단위)
    const targetDurations = durations || videos.map(v => v.duration) // duration이 없으면 실제 영상 길이 사용
    
    const playNextVideo = async () => {
      if (currentVideoIndex >= videos.length) {
        // 모든 영상 재생 완료
        console.log("[Shopping] 모든 영상 재생 완료, 녹화 종료 중...")
        setTimeout(() => {
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          mediaRecorder.stop()
        }, 500) // 마지막 프레임을 위해 약간 대기
        return
      }
      
      const video = videos[currentVideoIndex]
      const targetDuration = targetDurations[currentVideoIndex] || video.duration
      const videoActualDuration = video.duration
      
      console.log(`[Shopping] 영상 ${currentVideoIndex + 1} 재생 시작: 실제 길이 ${videoActualDuration.toFixed(2)}초, 목표 길이 ${targetDuration.toFixed(2)}초`)
      
      video.currentTime = 0
      
      // 목표 duration까지 재생할 시간 추적
      let elapsedTime = 0
      const startTime = Date.now()
      let videoLoopCount = 0 // 영상 반복 횟수
      
      // 영상 재생 완료 이벤트 리스너 (반복 재생용)
      const onVideoEnded = () => {
        // 목표 duration에 도달했는지 확인
        elapsedTime = (Date.now() - startTime) / 1000
        
        if (elapsedTime >= targetDuration) {
          // 목표 duration 도달, 다음 영상으로
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
        } else {
          // 목표 duration에 도달하지 않았으면 영상 반복 재생
          videoLoopCount++
          video.currentTime = 0
          video.play().catch((error) => {
            console.error(`[Shopping] 영상 반복 재생 실패:`, error)
            // 재생 실패해도 다음 영상으로 진행
            video.removeEventListener('ended', onVideoEnded)
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId)
            }
            currentVideoIndex++
            playNextVideo()
          })
        }
      }
      
      video.addEventListener('ended', onVideoEnded)
      
      const drawFrame = () => {
        elapsedTime = (Date.now() - startTime) / 1000
        
        // 목표 duration에 도달했는지 확인
        if (elapsedTime >= targetDuration) {
          // 목표 duration 도달, 다음 영상으로
          video.pause()
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
          return
        }
        
        // 목표 duration이 실제 영상 길이보다 짧은 경우, 특정 시간에 도달하면 중지
        if (targetDuration < videoActualDuration && video.currentTime >= targetDuration) {
          video.pause()
          video.removeEventListener('ended', onVideoEnded)
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId)
          }
          currentVideoIndex++
          playNextVideo()
          return
        }
        
        if (video.ended || video.paused) {
          return
        }
        
        try {
          // Canvas에 현재 프레임 그리기
          ctx.drawImage(video, 0, 0, width, height)
          
          // 다음 프레임 요청
          animationFrameId = requestAnimationFrame(drawFrame)
        } catch (error) {
          console.error(`[Shopping] 프레임 그리기 오류:`, error)
          // 오류가 발생해도 계속 진행
          animationFrameId = requestAnimationFrame(drawFrame)
        }
      }
      
      // 영상 재생 시작
      try {
        await video.play()
        drawFrame()
      } catch (error) {
        console.error(`[Shopping] 영상 ${currentVideoIndex + 1} 재생 실패:`, error)
        // 재생 실패해도 다음 영상으로 진행
        video.removeEventListener('ended', onVideoEnded)
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        currentVideoIndex++
        playNextVideo()
      }
    }
    
    // 첫 번째 영상 재생 시작
    playNextVideo()
  })
}

export async function generateCharacterReferenceImage(
  character: AnimalCharacter,
  replicateApiKey?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN
  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  const c = resolveAnimalCharacter(character)
  const prompt = [
    "Character reference sheet for viral animal shopping short-form.",
    c.visualPromptEn,
    'Name vibe: "' + c.name + '" — ' + c.personality + ". Look: " + (c.breedOrLook || c.visualPromptEn) + ".",
    "Full-body portrait of the anthropomorphic animal standing upright on hind legs, facing camera, plain soft studio background, soft key light, photorealistic fur, expressive face, no product, no humans, no text, vertical 9:16.",
    "This image will be used as identity lock for later shopping scenes.",
  ].join("\n")

  const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana/predictions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + REPLICATE_API_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "9:16",
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error("캐릭터 레퍼런스 생성 실패: " + response.status + " - " + errorText.substring(0, 200))
  }

  let data = await response.json()
  if (data.status === "succeeded" && data.output) {
    const out = Array.isArray(data.output) ? data.output[0] : data.output
    const url = typeof out === "string" ? out : out?.url || String(out)
    if (typeof url === "string" && url.startsWith("http")) return url
  }

  if (data.status === "processing" || data.status === "starting" || data.id) {
    const predictionId = data.id
    let attempts = 0
    while (attempts < 90) {
      await new Promise((r) => setTimeout(r, 2000))
      const poll = await fetch("https://api.replicate.com/v1/predictions/" + predictionId, {
        headers: { Authorization: "Bearer " + REPLICATE_API_TOKEN },
      })
      data = await poll.json()
      if (data.status === "succeeded" && data.output) {
        const out = Array.isArray(data.output) ? data.output[0] : data.output
        const url = typeof out === "string" ? out : out?.url || String(out)
        if (typeof url === "string" && url.startsWith("http")) return url
      }
      if (data.status === "failed" || data.status === "canceled") {
        throw new Error(data.error || "캐릭터 레퍼런스 생성 실패")
      }
      attempts++
    }
  }

  throw new Error("캐릭터 레퍼런스 생성 타임아웃")
}

/** 썸네일 후킹 문구 (Server Action — lib 래퍼) */
export async function generateThumbnailHookingText(productName: string, apiKey?: string) {
  return generateThumbnailHookingTextLib(productName, apiKey)
}

/** Replicate 9:16 쇼츠 썸네일 (Server Action — lib 래퍼) */
export async function generateShortsThumbnail(
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string,
  hookingText?: ThumbnailHookingText
) {
  return generateShortsThumbnailLib(productName, replicateApiKey, productImageBase64, hookingText)
}

// 새로운 방식: 대본을 3개 장면으로 나누고 각각 이미지 생성만 수행 (레거시 - 사용 안 함)
export async function generateImagesWith3Scenes(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string[]> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    console.log("[Shopping] 3개 장면으로 이미지 생성 시작")
    
    // 1. 대본을 3개 장면으로 나누기
    const scenes = await splitScriptIntoScenes(script)
    console.log("[Shopping] 장면 분할 완료:", scenes.length, "개 장면")
    
    // 2. 각 장면에 대해 이미지 생성만 수행 (정확히 3개만)
    const imageUrls: string[] = []
    const maxScenes = 3 // 정확히 3개 장면만
    
    // scenes가 3개보다 많으면 처음 3개만 사용
    const scenesToProcess = scenes.slice(0, maxScenes)
    
    for (let i = 0; i < scenesToProcess.length; i++) {
      console.log(`[Shopping] 장면 ${i + 1}/${maxScenes} 이미지 생성 중...`)
      
      // 이미지 생성 (나노바나나) - 섹션 인덱스 전달하여 각기 다른 배경 적용
      const imageUrl = await generateImageWithNanobanana(
        scenesToProcess[i],
        productName,
        productImageBase64,
        REPLICATE_API_TOKEN,
        i // 섹션 인덱스 (0, 1, 2) 전달
      )
      console.log(`[Shopping] 장면 ${i + 1} 이미지 생성 완료:`, imageUrl)
      
      imageUrls.push(imageUrl)
    }
    
    // 정확히 3개가 아니면 에러
    if (imageUrls.length !== 3) {
      throw new Error(`이미지는 정확히 3개만 생성되어야 합니다. 현재: ${imageUrls.length}개`)
    }
    
    console.log("[Shopping] 3개 장면 이미지 생성 완료:", imageUrls.length, "개")
    return imageUrls
  } catch (error) {
    console.error("[Shopping] 3개 장면 이미지 생성 실패:", error)
    throw error
  }
}

export async function generateVideoWithSora2(
  script: string,
  productName: string,
  replicateApiKey?: string,
  productImageBase64?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
  }

  try {
    // Sora2 모델을 사용한 비디오 생성
    // Replicate에서 Sora2 모델이 정확히 무엇인지 확인 필요
    // 일반적으로 "stability-ai/sora" 또는 유사한 모델 사용
    // 여기서는 예시로 "anotherjesse/zeroscope-v2-xl" 또는 실제 Sora2 모델 사용
    
    console.log("[Shopping] Sora2 비디오 생성 시작")
    console.log("[Shopping] 대본:", script.substring(0, 100) + "...")
    console.log("[Shopping] 제품명:", productName)
    console.log("[Shopping] 제품 이미지:", productImageBase64 ? "있음" : "없음")

    // 비디오 생성 프롬프트 생성 (대본 기반)
    let videoPrompt = `${script}. ${productName} 제품을 홍보하는 쇼핑 영상. 고품질, 전문적, 매력적.`
    
    // 이미지가 있으면 프롬프트에 추가
    if (productImageBase64) {
      videoPrompt = `${videoPrompt} 제품 이미지를 참고하여 제품의 실제 모습을 정확하게 보여주세요.`
    }
    
    // Sora2 모델이 아직 공개되지 않았을 수 있으므로, 대체 모델 사용
    // 실제로는 Replicate에서 사용 가능한 비디오 생성 모델 확인 필요
    // 예: "stability-ai/sora", "anotherjesse/zeroscope-v2-xl" 등

    // Replicate API 호출
    // 참고: 실제 Sora2 모델명은 Replicate 문서를 확인해야 함
    // 예시: "stability-ai/sora" 또는 다른 비디오 생성 모델
    const response = await fetch("https://api.replicate.com/v1/models/stability-ai/sora/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: videoPrompt,
          duration: 15, // 15초
          aspect_ratio: "9:16", // 쇼츠 비율
          // 이미지가 있으면 이미지 입력 추가 (Sora2가 이미지 입력을 지원하는 경우)
          ...(productImageBase64 && {
            image: productImageBase64, // base64 이미지 또는 URL
          }),
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] Replicate API 오류:", errorText)
      
      // Sora2가 아직 공개되지 않았을 수 있으므로, 대체 모델 사용
      // 예: "anotherjesse/zeroscope-v2-xl" 또는 다른 비디오 생성 모델
      throw new Error(`Replicate API 호출 실패: ${response.status}. Sora2 모델이 아직 사용 불가능할 수 있습니다.`)
    }

    const data = await response.json()

    if (data.status === "succeeded" && data.output) {
      const videoUrl = Array.isArray(data.output) ? data.output[0] : data.output
      console.log("[Shopping] Sora2 비디오 생성 완료:", videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300 // 최대 5분 대기 (비디오 생성은 시간이 오래 걸림)

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000)) // 2초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output) {
          const videoUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output
          console.log("[Shopping] Sora2 비디오 생성 완료 (폴링):", videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          throw new Error(`비디오 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("비디오 생성 시간 초과")
    } else {
      throw new Error(`비디오 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Shopping] Sora2 비디오 생성 실패:", error)
    
    // Sora2가 사용 불가능한 경우, 대체 모델 시도
    // 예: "anotherjesse/zeroscope-v2-xl" 사용
    console.log("[Shopping] 대체 비디오 생성 모델 시도...")
    
    // 비디오 생성 프롬프트 생성 (대본 기반)
    const videoPrompt = `${script}. ${productName} 제품을 홍보하는 쇼핑 영상. 고품질, 전문적, 매력적.`
    
    try {
      const fallbackResponse = await fetch("https://api.replicate.com/v1/models/anotherjesse/zeroscope-v2-xl/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: videoPrompt,
            num_frames: 30, // 약 1초 (30fps 기준)
            num_inference_steps: 50,
          },
        }),
      })

      if (!fallbackResponse.ok) {
        throw new Error("대체 모델도 사용 불가능합니다.")
      }

      const fallbackData = await fallbackResponse.json()
      
      if (fallbackData.status === "succeeded" && fallbackData.output) {
        const videoUrl = Array.isArray(fallbackData.output) ? fallbackData.output[0] : fallbackData.output
        console.log("[Shopping] 대체 모델 비디오 생성 완료:", videoUrl)
        return videoUrl
      }
    } catch (fallbackError) {
      console.error("[Shopping] 대체 모델도 실패:", fallbackError)
    }
    
    throw error
  }
}

export type AnimalVideoGenerationModel = "seedance-1-pro-fast" | "seedance-1.5-pro"

/** 기본: Seedance 1.5 Pro (무음 · 480p) — AI 쇼핑과 동일 */
export async function generateVideoWithSeedance(
  imageUrl: string,
  prompt: string,
  duration: number,
  replicateApiKey?: string,
  model: AnimalVideoGenerationModel = "seedance-1.5-pro"
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`영상 길이 파라미터가 유효하지 않습니다: ${duration}초`)
  }

  const requestedDuration = duration
  const minimumDuration = model === "seedance-1.5-pro" ? 4 : 1
  const maximumDuration = 12
  duration = Math.min(maximumDuration, Math.max(minimumDuration, Math.round(duration)))
  if (requestedDuration !== duration) {
    console.warn(
      `[Shopping] ${model} 지원 범위에 맞춰 영상 길이를 ${requestedDuration}초에서 ${duration}초로 조정합니다.`
    )
  }

  try {
    const replicateModel =
      model === "seedance-1.5-pro"
        ? "bytedance/seedance-1.5-pro"
        : "bytedance/seedance-1-pro-fast"
    console.log(`[Shopping] ${replicateModel} 모델로 영상 생성 시작:`, imageUrl)
    console.log(`[Shopping] 프롬프트:`, prompt)
    console.log(`[Shopping] duration:`, duration, "초")

    let validImageUrl = imageUrl

    try {
      const imageCheckResponse = await fetch(imageUrl, { method: "HEAD" })
      if (!imageCheckResponse.ok) {
        console.warn(`[Shopping] 이미지 URL 접근 실패 (${imageCheckResponse.status}), URL 재확인:`, imageUrl)
      } else {
        console.log(`[Shopping] 이미지 URL 유효성 확인 완료`)
      }
    } catch (checkError) {
      console.warn(`[Shopping] 이미지 URL 확인 중 오류 (계속 진행):`, checkError)
    }

    const apiUrl = `https://api.replicate.com/v1/models/${replicateModel}/predictions`

    const modelInput: Record<string, unknown> = {
      image: validImageUrl,
      prompt,
      resolution: model === "seedance-1.5-pro" ? "480p" : "480p",
      aspect_ratio: "9:16",
      // 제품 형태 유지를 위해 카메라 고정 (어색한 패닝/오빗 감소)
      camera_fixed: true,
      duration,
    }

    if (model === "seedance-1.5-pro") {
      // AI 쇼핑과 동일: 무음 · 480p · $0.013/초
      modelInput.generate_audio = false
      modelInput.resolution = "480p"
      modelInput.fps = 24
    }

    console.log(`[Shopping] ✅ duration 파라미터 추가: ${duration}초 (각 영상 길이, TTS/3)`)

    const motionGuardrails = `

FINAL IMAGE-TO-VIDEO MOTION CONTRACT — HIGHEST PRIORITY:
Create one stable, continuous, locked-off shot based strictly on the input image.
Keep the original composition, framing, perspective, lighting, background, and every existing object's location consistent from the first frame to the last frame.
PRODUCT GEOMETRY LOCK: The featured product must keep identical rigid shape, silhouette, size, colors, and packaging for every frame. Never morph, melt, warp, bend, stretch, squash, grow, shrink, dissolve, or reshape the product.
The animal character remains the same identity with no extra limbs.
Use only subtle, physically plausible micro-motion (breathing, blinking). Avoid big gestures that would crush or bend the product.
No cuts, transitions, reframing, zoom punches, pan, tilt, orbit, sudden motion, morphing, deformation, or humans.
No text, subtitles, or captions.
The result should look like a real locked-off camera recorded the existing scene for ${duration} seconds.`

    const enhancedPrompt = `VIDEO DURATION: exactly ${duration} seconds. ${prompt}${motionGuardrails}`
    modelInput.prompt = enhancedPrompt

    console.log(`[Shopping] Replicate API URL:`, apiUrl)
    console.log(`[Shopping] Input:`, JSON.stringify(modelInput, null, 2))

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: modelInput,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Shopping] 영상 생성 오류 응답:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        apiUrl: apiUrl,
        requestBody: JSON.stringify({ input: modelInput }, null, 2)
      })

      if (response.status === 404) {
        throw new Error(`모델을 찾을 수 없습니다 (404). 모델 이름이나 버전을 확인해주세요. API URL: ${apiUrl}`)
      }

      throw new Error(`영상 생성 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("[Shopping] 영상 생성 응답:", JSON.stringify(data, null, 2))

    const extractVideoUrl = (output: any): string | null => {
      if (!output) return null

      if (Array.isArray(output)) {
        if (output.length > 0) {
          const first = output[0]
          if (typeof first === "string") {
            return first
          } else if (first && typeof first === "object") {
            return (first as any).url?.() || (first as any).url || String(first)
          }
        }
        return null
      }

      if (typeof output === "string") {
        return output
      }

      if (output && typeof output === "object") {
        if (typeof (output as any).url === "function") {
          return (output as any).url()
        }
        if ((output as any).url) {
          return (output as any).url
        }
        return String(output)
      }

      return String(output)
    }

    if (data.status === "succeeded" && data.output) {
      const videoUrl = extractVideoUrl(data.output)
      if (!videoUrl) {
        throw new Error("영상 URL을 추출할 수 없습니다.")
      }
      console.log(`[Shopping] ✅ 영상 생성 완료 (즉시):`, videoUrl)
      return videoUrl
    } else if (data.status === "processing" || data.status === "starting" || data.status === "queued") {
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 300

      console.log(`[Shopping] 🔄 폴링 시작 (predictionId: ${predictionId}, 최대 ${maxAttempts}회 시도)`)

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++

        console.log(`[Shopping] 🔄 폴링 시도 ${attempts}/${maxAttempts}...`)

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          console.error(`[Shopping] ❌ 상태 확인 실패: ${statusResponse.status}`)
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()
        console.log(`[Shopping] 📊 폴링 응답 (시도 ${attempts}): status=${statusData.status}`)

        if (statusData.status === "succeeded" && statusData.output) {
          const videoUrl = extractVideoUrl(statusData.output)
          if (!videoUrl) {
            throw new Error("영상 URL을 추출할 수 없습니다.")
          }
          console.log(`[Shopping] ✅ 영상 생성 완료 (폴링, 시도 ${attempts}회):`, videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          const errorMessage = statusData.error || "알 수 없는 오류"
          console.error(`[Shopping] ❌ 영상 생성 실패: ${errorMessage}`)
          throw new Error(`영상 생성 실패: ${errorMessage}`)
        } else if (statusData.status === "canceled") {
          console.error(`[Shopping] ❌ 영상 생성 취소됨`)
          throw new Error("영상 생성이 취소되었습니다.")
        }
      }

      console.error(`[Shopping] ❌ 영상 생성 시간 초과 (${maxAttempts}회 시도 후)`)
      throw new Error(`영상 생성 시간 초과 (최대 ${maxAttempts * 2}초 대기 후 실패)`)
    } else {
      const errorMsg = data.error || "알 수 없는 오류"
      console.error(`[Shopping] ❌ 영상 생성 실패: status=${data.status}, error=${errorMsg}`)
      throw new Error(`영상 생성 실패: ${errorMsg}`)
    }
  } catch (error) {
    console.error("[Shopping] 영상 생성 실패:", error)
    throw error
  }
}

// 유튜브 제목, 설명, 태그 자동 생성
export async function generateYouTubeMetadata(
  productName: string,
  productDescription: string,
  script: string,
  apiKey?: string
): Promise<{ title: string; description: string; tags: string[] }> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `당신은 유튜브 쇼츠 영상 메타데이터 작성 전문가입니다. 제품 홍보 영상에 최적화된 제목, 설명, 태그를 생성해주세요.

규칙:
1. 제목: 50자 이내, 클릭을 유도하는 강력한 후킹 문구, 이모지 사용 가능
2. 설명: 500자 이내, 제품 특징과 장점을 간결하게, 관련 링크 공간 확보
3. 태그: 10-15개, 제품명, 카테고리, 키워드 포함, 쉼표로 구분

JSON 형식으로 응답:
{
  "title": "제목",
  "description": "설명",
  "tags": ["태그1", "태그2", ...]
}`,
          },
          {
            role: "user",
            content: `제품명: ${productName}
제품 설명: ${productDescription}
영상 대본: ${script}

위 정보를 바탕으로 유튜브 쇼츠 영상용 제목, 설명, 태그를 생성해주세요.`,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("메타데이터 생성에 실패했습니다.")
    }

    const parsed = JSON.parse(content)
    
    return {
      title: parsed.title || `${productName} 추천!`,
      description: parsed.description || `${productDescription}\n\n${script}`,
      tags: Array.isArray(parsed.tags) ? parsed.tags : (parsed.tags ? parsed.tags.split(",").map((t: string) => t.trim()) : [productName]),
    }
  } catch (error) {
    console.error("[Shopping] 메타데이터 생성 실패:", error)
    // 실패 시 기본값 반환
    return {
      title: `${productName} 추천!`,
      description: `${productDescription}\n\n${script}`,
      tags: [productName, "쇼핑", "추천", "리뷰"],
    }
  }
}

/** 프로덕션에서 throw 메시지가 숨겨지지 않도록 결과 객체로 반환 */
export type AnimalActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

function animalActionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim()
    // Next가 덮어쓴 일반 문구면 원인 힌트로 교체
    if (/Server Components render|digest property/i.test(msg)) {
      return fallback
    }
    return msg
  }
  return fallback
}

/** 이미지 프롬프트 생성 — 실패 시 메시지가 클라이언트에 전달됨 */
export async function generateAnimalImagePromptsSafe(
  script: string,
  productName: string,
  productDescription: string,
  hasProductImage: boolean,
  apiKey?: string,
  character?: AnimalCharacter | null,
  sceneCount?: number
): Promise<
  AnimalActionResult<
    Array<{
      type: string
      prompt: string
      description: string
      scriptText: string
      sceneBeat?: string
    }>
  >
> {
  try {
    const prompts = await generateImagePromptsFromScript(
      script,
      productName,
      productDescription,
      // 프롬프트 단계에서는 실제 이미지 바이트가 필요 없음 (용량·타임아웃 방지)
      hasProductImage ? "has-ref" : undefined,
      apiKey,
      character
        ? {
            ...character,
            // 레퍼런스 data URL은 프롬프트 생성에 불필요
            referenceImage: character.referenceImage?.startsWith("data:")
              ? undefined
              : character.referenceImage,
          }
        : character,
      sceneCount
    )
    if (!prompts?.length) {
      return {
        ok: false,
        error: "이미지 프롬프트를 만들지 못했습니다. OpenAI API 키를 확인해주세요.",
      }
    }
    return { ok: true, data: prompts }
  } catch (error) {
    console.error("[AnimalShopping] 프롬프트 생성 실패:", error)
    return {
      ok: false,
      error: animalActionError(
        error,
        "이미지 프롬프트 생성에 실패했습니다. 설정에 OpenAI(GPT) API 키가 있는지 확인해주세요."
      ),
    }
  }
}

/** 씬 1컷 이미지 생성 — 컷별로 호출해 서버 타임아웃을 피함 */
export async function generateAnimalSceneImageSafe(
  prompt: string,
  productName: string,
  productImageBase64: string | undefined,
  replicateApiKey: string | undefined,
  sceneIndex: number,
  productDescription: string,
  character: AnimalCharacter | null | undefined,
  sceneBeat?: string
): Promise<AnimalActionResult<string>> {
  try {
    if (!(replicateApiKey || process.env.REPLICATE_API_TOKEN)) {
      return {
        ok: false,
        error: "Replicate API 키가 없습니다. 설정에서 shotform_replicate_api_key를 저장해주세요.",
      }
    }
    const url = await generateImageWithNanobanana(
      prompt,
      productName,
      productImageBase64,
      replicateApiKey,
      sceneIndex,
      productDescription,
      "9:16",
      character,
      sceneBeat
    )
    if (!url?.startsWith("http")) {
      return { ok: false, error: "이미지 URL이 유효하지 않습니다. 다시 시도해주세요." }
    }
    return { ok: true, data: url }
  } catch (error) {
    console.error("[AnimalShopping] 씬 이미지 생성 실패:", error)
    return {
      ok: false,
      error: animalActionError(
        error,
        "이미지 생성에 실패했습니다. Replicate API 키·잔액과 네트워크를 확인한 뒤 다시 시도해주세요."
      ),
    }
  }
}
