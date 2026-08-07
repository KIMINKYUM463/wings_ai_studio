/** 동물 쇼핑 숏폼 — 캐릭터(동물 쇼퍼) 도메인 */

export type AnimalSpecies = "cat" | "dog" | "rabbit" | "bear" | "panda" | "custom"

export interface AnimalCharacter {
  id: string
  /** 화면/대본에 쓸 이름 (예: 나비, 뭉치) */
  name: string
  species: AnimalSpecies
  /** 외형 한글 설명 (예: 주황흰 줄무늬 고양이) */
  breedOrLook: string
  /** 성격·톤 (예: 진지한 장보기 고양이) */
  personality: string
  /** 이미지/영상 DNA에 넣을 영문 외형 */
  visualPromptEn: string
  /** 얼굴 일관성용 레퍼런스 (data URL 또는 https URL) */
  referenceImage?: string
  /** 프리셋 id (custom이면 사용자 정의) */
  presetId: string
}

export interface AnimalCharacterPreset {
  id: string
  label: string
  emoji: string
  /** 프리셋 카드·기본 레퍼런스용 샘플 이미지 (public 경로) */
  sampleImage?: string
  character: Omit<AnimalCharacter, "id" | "referenceImage">
}

export const ANIMAL_CHARACTER_PRESETS: AnimalCharacterPreset[] = [
  {
    id: "tabby-cat",
    label: "장보기 고양이",
    emoji: "🐱",
    sampleImage: "/animal-shopping/characters/tabby-cat.png",
    character: {
      name: "나비",
      species: "cat",
      breedOrLook: "주황·흰 줄무늬 탭비 고양이",
      personality: "진지하고 꼼꼼한 장보기 고양이",
      visualPromptEn:
        "cute anthropomorphic orange/white tabby cat standing upright on hind legs like a human shopper, expressive face, soft fur, bipedal posture",
      presetId: "tabby-cat",
    },
  },
  {
    id: "golden-dog",
    label: "해맑은 강아지",
    emoji: "🐶",
    sampleImage: "/animal-shopping/characters/golden-dog.png",
    character: {
      name: "뭉치",
      species: "dog",
      breedOrLook: "골든 리트리버 느낌의 밝은 강아지",
      personality: "해맑고 들뜬 쇼핑 강아지",
      visualPromptEn:
        "cute anthropomorphic golden retriever dog standing upright on hind legs like a human shopper, fluffy golden fur, cheerful expression, bipedal posture",
      presetId: "golden-dog",
    },
  },
  {
    id: "bunny",
    label: "꼼꼼 토끼",
    emoji: "🐰",
    sampleImage: "/animal-shopping/characters/bunny.png",
    character: {
      name: "모모",
      species: "rabbit",
      breedOrLook: "크림색 솜털 토끼",
      personality: "꼼꼼하고 신중한 쇼핑 토끼",
      visualPromptEn:
        "cute anthropomorphic cream rabbit standing upright on hind legs like a human shopper, soft fluffy fur, long ears, careful expression, bipedal posture",
      presetId: "bunny",
    },
  },
  {
    id: "red-panda",
    label: "호기심 레서판다",
    emoji: "🦊",
    sampleImage: "/animal-shopping/characters/red-panda.png",
    character: {
      name: "초코",
      species: "panda",
      breedOrLook: "붉은 털의 레서판다",
      personality: "호기심 많은 쇼핑 레서판다",
      visualPromptEn:
        "cute anthropomorphic red panda standing upright on hind legs like a human shopper, rusty-orange fur, curious eyes, bipedal posture",
      presetId: "red-panda",
    },
  },
  {
    id: "custom",
    label: "직접 만들기",
    emoji: "✨",
    character: {
      name: "나의 캐릭터",
      species: "custom",
      breedOrLook: "",
      personality: "개성 있는 동물 쇼퍼",
      visualPromptEn: "cute anthropomorphic animal standing upright on hind legs like a human shopper, bipedal posture",
      presetId: "custom",
    },
  },
]

export function getPresetSampleImage(presetId: string): string | undefined {
  return ANIMAL_CHARACTER_PRESETS.find((p) => p.id === presetId)?.sampleImage
}

export function createDefaultAnimalCharacter(): AnimalCharacter {
  const preset = ANIMAL_CHARACTER_PRESETS[0]
  return {
    id: `char_${preset.id}_default`,
    ...preset.character,
    // 기본 프리셋은 샘플을 레퍼런스로 미리 넣어 바로 쓸 수 있게
    referenceImage: preset.sampleImage,
  }
}

export function createCharacterFromPreset(presetId: string): AnimalCharacter {
  const preset = ANIMAL_CHARACTER_PRESETS.find((p) => p.id === presetId) ?? ANIMAL_CHARACTER_PRESETS[0]
  return {
    id: `char_${preset.id}_${Date.now()}`,
    ...preset.character,
    // 샘플이 있으면 기본 레퍼런스로 사용 (AI 재생성·업로드로 교체 가능)
    referenceImage: preset.sampleImage,
  }
}

/** 커스텀 입력으로 visualPromptEn 보강 */
export function buildCustomVisualPromptEn(breedOrLook: string, species: AnimalSpecies): string {
  const look = breedOrLook.trim()
  if (!look) {
    return "cute anthropomorphic animal standing upright on hind legs like a human shopper, bipedal posture"
  }
  const speciesHint =
    species === "cat"
      ? "cat"
      : species === "dog"
        ? "dog"
        : species === "rabbit"
          ? "rabbit"
          : species === "bear"
            ? "bear"
            : species === "panda"
              ? "red panda"
              : "animal"
  return `cute anthropomorphic ${look} (${speciesHint}) standing upright on hind legs like a human shopper, expressive face, bipedal posture, photorealistic fur`
}

export function resolveAnimalCharacter(character?: AnimalCharacter | null): AnimalCharacter {
  if (character?.visualPromptEn?.trim()) return character
  return createDefaultAnimalCharacter()
}

/** 카테고리별 — 동물이 제품을 '활용·시연'하는 동작 (들고만 있기 금지) */
export function inferAnimalProductUsage(
  productName: string,
  productDescription?: string
): string {
  const c = `${productName} ${productDescription || ""}`.toLowerCase()
  // 공통: 한 번에 손에 드는 물건은 제품 1개만 (장바구니는 바닥/옆에 두어 팔 복제 방지)
  const handsRule =
    "EXACTLY two arms and two paws only; hold ONLY this product in one or both paws; shopping basket rests on the floor nearby (NOT held in a third hand)"
  if (/이어폰|헤드폰|이어버드|earbuds|airpods|headphone|earphone/.test(c)) {
    return `${handsRule}; carefully placing earbuds near its ears / wearing headphones to demo audio gear`
  }
  if (/텀블러|물병|보틀|컵|mug|tumbler|bottle|flask/.test(c)) {
    return `${handsRule}; holding the bottle/tumbler with both paws and demonstrating a drinking motion (straw near mouth)`
  }
  if (/청소기|vacuum|cleaner|로봇청소기/.test(c)) {
    return `${handsRule}; guiding/pushing the vacuum across the floor as a shopper demo`
  }
  if (/충전기|케이블|cable|charger|adapter|선/.test(c)) {
    return `${handsRule}; carefully plugging the cable into a device to demo charging`
  }
  if (/화장품|크림|세럼|로션|토너|skincare|serum|cosmetic|화장/.test(c)) {
    return `${handsRule}; holding the bottle and mimicking applying product with one paw (no human hands)`
  }
  if (/간식|사료|treat|pet food|강아지간식|고양이간식/.test(c)) {
    return `${handsRule}; opening/holding the package and sniffing the treat excitedly`
  }
  if (/장난감|toy|공|ball|인형/.test(c)) {
    return `${handsRule}; actively playing with / demonstrating the toy`
  }
  if (/가방|백팩|파우치|bag|backpack|tote/.test(c)) {
    return `${handsRule}; carrying the bag on one arm or putting items inside — bag counts as the single held product`
  }
  if (/선반|정리|수납|마그네틱|shelf|organizer|rack|거치/.test(c)) {
    return `${handsRule}; installing, attaching, or arranging items on the organizer product`
  }
  if (/키보드|마우스|노트북|keyboard|mouse|laptop/.test(c)) {
    return `${handsRule}; typing or clicking to demo the gadget on a desk`
  }
  if (/조명|램프|light|lamp|무드등/.test(c)) {
    return `${handsRule}; turning on the light / adjusting the lamp to demo brightness`
  }
  if (/쿠션|베개|담요|blanket|pillow|cushion/.test(c)) {
    return `${handsRule}; fluffing or wrapping itself with the soft product`
  }
  return `${handsRule}; actively USING and demonstrating the product like a real shopper (not idle posing)`
}

/** 스토리 비트별 배경·제품 노출 규칙 (problem/travel은 마트·제품 강제 금지) */
export function animalSceneBeatRules(
  sceneType: string | undefined,
  productName: string,
  usageAction: string
): {
  beat: string
  setting: string
  props: string
  product: string
  action: string
  composition: string
  includeProductRef: boolean
} {
  const product = (productName || "the featured product").trim()
  const type = (sceneType || "").toLowerCase()

  if (!type) {
    return {
      beat: "Follow the specific story beat written in the prompt (problem/travel/store/detail/use)",
      setting: "Match ONLY the story beat location — never force supermarket aisle for every shot.",
      props: "Props must match the beat (no product before purchase; product only in store/use/detail).",
      product: `Respect beat rules for "${product}" — absent in problem/travel; visible in store/detail/use.`,
      action: "Match the beat action; do not always demonstrate the product.",
      composition: "Character clear; location matches beat.",
      includeProductRef: false,
    }
  }

  if (type === "problem") {
    return {
      beat: "PROBLEM / empathy — BEFORE buying",
      setting:
        "Home room OR outdoor everyday spot (sidewalk, park, porch). NOT inside a supermarket aisle.",
      props:
        "Empty hands or everyday prop only. Optional empty shopping basket on the floor. Do NOT hold the featured product.",
      product: `Do NOT show "${product}" in hands. Product is not purchased yet (absent or far/blurred only).`,
      action: "Expressive thirst/discomfort/need — the problem that motivates shopping.",
      composition: "Character is the hero; emotion readable; no product demo.",
      includeProductRef: false,
    }
  }
  if (type === "travel") {
    return {
      beat: "TRAVEL / arriving — on the way to the store",
      setting:
        "Outdoor path, street, or parking lot walking TOWARD a supermarket exterior under daylight/sunny sky. NOT inside store shelves.",
      props:
        "May carry an EMPTY shopping basket. Do NOT hold the featured product yet.",
      product: `Do NOT show "${product}" being held or used. The product is still inside the store ahead.`,
      action: "Cheerful bipedal walk toward the market entrance; travel energy.",
      composition: "Character + outdoor path + store exterior hint; sunny outdoor light.",
      includeProductRef: false,
    }
  }
  if (type === "detail") {
    return {
      beat: "PRODUCT DETAIL close-up",
      setting: "Soft retail or clean blurred background; product fills most of the 9:16 frame.",
      props: "Product is the hero. Optional tiny paws at frame edge only.",
      product: `"${product}" exact shape/colors from reference; large and sharp.`,
      action: "Static hero product shot — not a full lifestyle demo.",
      composition: "Product dominates the frame.",
      includeProductRef: true,
    }
  }
  if (type === "store" || type === "compare" || type === "buy") {
    return {
      beat: "STORE / discover / buy",
      setting: "Real supermarket grocery aisle / retail shelves; bright store lighting.",
      props:
        "At most ONE held object — the featured product. Basket on the floor only if shown.",
      product: `"${product}" must match reference; clearly visible while discovering/buying.`,
      action: "Discovering, comparing, or picking up the product in the aisle.",
      composition: "Animal + product both visible in store context.",
      includeProductRef: true,
    }
  }
  if (type === "home") {
    return {
      beat: "HOME — arriving / unpacking",
      setting: "Home interior entryway/kitchen/living room — NOT supermarket aisle.",
      props: `Holding or placing "${product}". Basket optional on floor.`,
      product: `"${product}" exact reference look; clearly visible.`,
      action: "Arriving home with the purchased product; preparing to use it.",
      composition: "Character + product at home.",
      includeProductRef: true,
    }
  }
  // use / delight / default
  return {
    beat: "USE / delight — solving the problem",
    setting: "Home OR outdoor leisure spot where the product is used — not a random unrelated aisle pose.",
    props: `Holding/using only "${product}". Basket optional on floor.`,
    product: `"${product}" exact reference look; fully visible while in use.`,
    action: `${usageAction}. Happily using the product and solving the earlier problem.`,
    composition: "Character actively using the product; product readable.",
    includeProductRef: true,
  }
}

/** 이미지/영상/대본에 공통으로 쓰는 비주얼 DNA (씬 비트에 맞춰 배경·제품 규칙 변경) */
export function buildAnimalVisualDna(
  character?: AnimalCharacter | null,
  opts?: {
    productName?: string
    productDescription?: string
    /** problem | travel | store | detail | use ... */
    sceneType?: string
  }
): string {
  const c = resolveAnimalCharacter(character)
  const usage = inferAnimalProductUsage(
    opts?.productName || "product",
    opts?.productDescription
  )
  const productLabel = (opts?.productName || "the featured Coupang product").trim()
  const beat = animalSceneBeatRules(opts?.sceneType, productLabel, usage)

  return `
STYLE: Viral AI animal shopping short-form (not human influencer review).
MAIN SUBJECT: ${c.visualPromptEn}. Character name vibe: "${c.name}" — ${c.personality}. Look: ${c.breedOrLook || c.visualPromptEn}.
IDENTITY LOCK: Keep the SAME animal face, fur pattern, colors, ear shape, and body proportions in EVERY shot. Never swap species or pattern.
ANATOMY LOCK (CRITICAL): Exactly ONE head, TWO ears, TWO arms, TWO paws/hands, TWO legs, ONE torso. Count the limbs before finishing the image. Never add a third arm, duplicate left/right paw, extra hand in a pocket plus another holding something, fused limbs, or floating detached paws. Clothing pockets must NOT create an extra fake hand.
STORY BEAT (HIGHEST PRIORITY — overrides generic shopping tropes): ${beat.beat}
SETTING (MUST MATCH BEAT): ${beat.setting}
HANDS / PROPS: ${beat.props}
PRODUCT RULE: ${beat.product}
ACTION: ${beat.action}
COMPOSITION: ${beat.composition}
FORBIDDEN: Extra limbs/hands/paws, three arms, duplicated left hand, human people, human faces, human hands, product deformation / melting / morphing, changing animal identity, wrong location for this beat (e.g. supermarket aisle during travel/problem).
ABSOLUTE NO TEXT (CRITICAL): Zero on-image text of any kind — no subtitles, captions, closed captions, lower-thirds, speech bubbles, Korean/Hangul, English letters, numbers, watermarks, logos as readable text overlays, UI bars, or dark subtitle boxes at the bottom. Clean photo only; any readable writing is a hard fail.
FORMAT: Vertical 9:16, high saturation, polished look suitable for YouTube Shorts / TikTok (but WITHOUT burned-in captions).
`.trim()
}

export function characterNarrationHint(character?: AnimalCharacter | null): string {
  const c = resolveAnimalCharacter(character)
  return `주인공 동물: 이름 "${c.name}", 외형 "${c.breedOrLook || c.species}", 성격 "${c.personality}"`
}
