import { isCosmicOrScienceAbstractTopic } from './noPeopleSceneVisualPrompt'

/** 우주·천체·추상 과학 — 인물 없이 연출하는 것이 기본 */
export function narrationIsCosmicOrAstronomyTopic(text: string): boolean {
  return isCosmicOrScienceAbstractTopic(text)
}

/** 나레이션·프롬프트가 화면 인물을 명시적으로 요구하는지 */
export function narrationExplicitlyRequiresOnScreenHumans(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (
    /우주비행사|우주\s*유영|우주복|국제우주정거장|우주\s*정거장|승무원|우주\s*탑승|인터뷰|프로필|인물\s*소개|얼굴\s*클로즈|표정|미소|울음|눈물|대화|만나\s*서|손\s*을\s*잡|안아|포옹|인물\s*중심|주인공|할머니|할아버지|역사\s*적\s*인물|실존\s*인물|그\s*는\s*말|그녀\s*는\s*말|노인\s*한\s*명|남자\s*한\s*명|여자\s*한\s*명|소년|소녀/i.test(
      t,
    )
  ) {
    return true
  }
  return /\b(astronaut|cosmonaut|taikonaut|spacewalk|space\s*suit|ISS|international\s*space\s*station|crew\s*member|nasa\s*engineer|mission\s*control|interview|portrait\s*of|biography|hero\s*shot|talking\s*head|presenter|anchor|narrator\s*on\s*camera|documentary\s*subject)\b/i.test(
    t,
  )
}

/** 나레이션이 지리·지도·통계·풍경만 다루는지 (인물 불필요) */
export function narrationIsGeographyMapStatisticsOrLandscapeTopic(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (narrationExplicitlyRequiresOnScreenHumans(t)) return false

  if (
    /몽골|유럽|아시아|대륙|나라|국가|국토|영토|지형|지도|오버레이|스케일|크기|넓|면적|제곱|인구|역설|밀도|울란바토르|거대|광활|고립|프랑스|몰도바|대서양|연안|뻗어|비교|대비|초원|유르트|게르|가축|산맥|지평선/.test(
      t,
    )
  ) {
    return true
  }

  if (
    /\b(Mongolia|Europe|Asia|Africa|continent|country|territory|landmass|landscape|steppe|desert|terrain|map|overlay|superimpos|scale|area|square\s*km|population\s*density|population|paradox|density|per\s*capita|urban\s*concentration|Ulaanbaatar|vast|immense|emptiness|isolated|France|Moldova|Atlantic|coast|stretch(?:es|ing)?\s*across|compare|comparison|contrast|ger|yurt|livestock|grazing|graze|mountain|horizon|vastness|serene|diorama of the)\b/i.test(
      t,
    )
  ) {
    return true
  }

  if (
    /이야기를\s*(?:풀|풀어|써|전|이야)|살펴보|알아\s*보|소개(?:하|해)|들어보|explore|let'?s (?:explore|look|examine|talk about)|today (?:we|I) (?:will|'ll) (?:explore|look|examine|tell|talk)/i.test(
      t,
    ) &&
    !narrationExplicitlyRequiresOnScreenHumans(t)
  ) {
    return true
  }

  if (
    /\b(ger|yurt|livestock|grazing|graze|steppe|mountain|horizon|vastness|serene|emptiness|landscape)\b/i.test(
      t,
    ) &&
    !/사람|인물|남자|여자|man|woman|person|human|walking|걸어|서\s*있|stands?|walked|그\s*는|그녀\s*는/i.test(t)
  ) {
    return true
  }

  return false
}

/** 나레이션이 로봇·탐사선·무인 기계만 다루는지 */
export function narrationIsMachineOrVehicleOnlyTopic(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return /\b(rover|robot|로봇|탐사(?:선|로)|무인(?:\s*탐사)?|드론|drone|spacecraft|satellite|위성|탐사\s*차량|vehicle sits inactive|기계(?:만|만\s*)|machine-only|opportunity|curiosity|perseverance)\b/i.test(
    t,
  )
}

/** 로봇·탐사선·무인 장비 장면 — 사람 금지 가드 */
export function buildMachineOnlySceneGuardBlock(combinedText: string): string | null {
  const t = combinedText.trim()
  if (!t) return null
  if (!narrationIsMachineOrVehicleOnlyTopic(t)) return null
  if (narrationExplicitlyRequiresOnScreenHumans(t)) return null
  return [
    'MACHINE-ONLY SCENE (mandatory):',
    'This scene is about a robot, rover, drone, satellite, or unmanned vehicle — NOT people.',
    'Do NOT add humans, human figures, astronauts, operators, or people standing on/sitting on/in/merged with the machine.',
    'No human heads or torsos protruding from robots; no passengers unless the script explicitly names a crew.',
    'Show ONLY the machine/vehicle/environment/symbolic props described in the prompt.',
  ].join('\n')
}

/** 우주·과학 주제 — 레거시 호환 (상세 판단은 humanPlacementJudgment 사용) */
export function buildTopicHumanPlacementGuardBlock(combinedText: string): string | null {
  const t = combinedText.trim()
  if (!t) return null

  if (narrationIsCosmicOrAstronomyTopic(t) && !narrationExplicitlyRequiresOnScreenHumans(t)) {
    return [
      'TOPIC–SUBJECT MATCH (mandatory):',
      'This narration is about space, cosmos, astronomy, or abstract physics — NOT a human drama.',
      'Do NOT add humans floating freely in open vacuum. Crew ONLY inside spacecraft/station interior if narration says so.',
      'Use: deep space vistas, nebulae, planets, light beams, rovers, symbolic objects — not stock person in space.',
    ].join('\n')
  }

  if (
    /경제|economics|finance|금융|주식|증시|인플레|GDP|금리|환율|비트코인|crypto|부동산|연준|재정|fiscal|monetary/i.test(
      t,
    ) &&
    !narrationExplicitlyRequiresOnScreenHumans(t)
  ) {
    return [
      'TOPIC–SUBJECT MATCH (mandatory):',
      'Finance/economics narration — use charts, currency, trading screens, buildings, documents.',
      'Do NOT add random businesspeople handshaking, generic office workers, or unrelated human stock unless the script names a person or interview.',
    ].join('\n')
  }

  if (narrationIsGeographyMapStatisticsOrLandscapeTopic(t)) {
    return [
      'TOPIC–SUBJECT MATCH (mandatory):',
      'Geography/map/statistics/landscape narration — show maps, terrain, cities, architecture, animals, symbolic overlays ONLY.',
      'Do NOT add humans, narrator busts, presenters, observers, or foreground stock figures — even for expository “today we explore” beats.',
      'No giant person towering over map or city; no casual figure when narration is about land area, population, or country facts.',
    ].join('\n')
  }

  if (
    /역사\s*(?:적|적\s*인|적\s*배경|적\s*사건)|ancient\s*history|고대|중세|조선|삼국|유적|museum|박물관|artifact|유물/i.test(
      t,
    ) &&
    !narrationExplicitlyRequiresOnScreenHumans(t) &&
    !/(인물|왕|장군|황제|대통령|scientist|Einstein|아인슈타인|Newton|뉴턴|인터뷰|portrait)/i.test(t)
  ) {
    return [
      'TOPIC–SUBJECT MATCH (mandatory):',
      'History/archaeology narration without a named figure — prefer artifacts, maps, ruins, manuscripts, period objects.',
      'Do NOT add modern-dress presenters, random tourists, or unrelated cosmic/sci-fi backgrounds.',
    ].join('\n')
  }

  return null
}

/** AI 티·스톡 이미지 느낌 억제 */
export function buildAntiAiSlopVisualBlock(kind: 'scene' | 'thumbnail'): string {
  const shared = [
    'ANTI–AI-SLOP (mandatory):',
    '- Must look like a real photograph or premium documentary still — NOT generic AI art, NOT plastic CGI, NOT oversaturated HDR glow.',
    '- Avoid uncanny faces, extra fingers, melted features, warped anatomy, duplicate limbs, floating objects, impossible physics.',
    '- No random watermark-style composition, no “AI thumbnail” clichés (neon rim on generic face, unrelated galaxy behind office worker).',
    '- Single coherent 16:9 frame, one clear subject, natural color grading, subtle film grain acceptable.',
  ]
  if (kind === 'thumbnail') {
    shared.push(
      '- Thumbnail: ONE scroll-stopping focal subject that literally matches the video topic — not a unrelated stock person or random space background.',
      '- Include a visible person ONLY if the topic is about that person, human drama, or interview — otherwise use objects, landscapes, or cosmic vistas without humans.',
    )
  } else {
    shared.push(
      '- Scene: depict ONLY what the narration describes — do not embellish with unrelated humans, astronauts, or cosmic B-roll when the beat is not about them.',
    )
  }
  return shared.join('\n')
}

/** Replicate negative_prompt 보강 */
export const TOPIC_COHERENCE_NEGATIVE_PROMPT =
  'ai generated look, plastic skin, uncanny valley, extra fingers, deformed hands, melted face, duplicate limbs, generic stock photo, random astronaut, floating person in space, human in space suit when not requested, unrelated galaxy background, neon oversaturation, fake HDR, 3d render, cgi, illustration when photoreal requested, collage, split screen, watermark, text, letters'

/** 장면 프롬프트 JSON 생성 — 파이프라인 system 규칙 */
export function scenePipelineTopicCoherenceRules(): string[] {
  return [
    '- TOPIC ANCHOR (mandatory): Every promptKo/promptEn MUST literally depict the narration beat and subject domain — not a generic “YouTube” or “AI” image.',
    '- Do NOT default to unrelated space, galaxy, astronaut, nebula, ancient history montage, or tech circuit stock unless the narration explicitly discusses that topic.',
    '- Do NOT add on-screen humans, faces, or crowds when the narration is about abstract science, cosmos, data, policy, or landscape — use environments and objects instead.',
    '- Add visible people ONLY when the narration names a person, shows dialogue, interview, biography, or clear human drama — never as filler.',
    '- Avoid AI-slop: photoreal when style is live-action; no uncanny faces, no random stock humans in wrong contexts.',
  ]
}
