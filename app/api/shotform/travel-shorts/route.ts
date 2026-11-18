import { NextResponse, type NextRequest } from "next/server"
import type {
  TravelAngle,
  TravelInfo,
  TravelPhotoRole,
  TravelPublishMeta,
} from "@/lib/travel-shorts/types"
import { TRAVEL_MAX_PHOTOS, TRAVEL_PHOTO_ROLES } from "@/lib/travel-shorts/types"
import { fetchCoupangTravelProduct } from "@/lib/travel-shorts/coupang-travel"

const ROLE_IDS = TRAVEL_PHOTO_ROLES.map((r) => r.id)
const ANGLES: TravelAngle[] = ["price", "secret", "compare"]

type ImportBody = { action: "import"; url?: string; openaiApiKey?: undefined }

type ClassifyBody = {
  action: "classify"
  openaiApiKey?: string
  photos?: Array<{ id: string; dataUrl: string }>
}

type ScriptBody = {
  action: "script"
  openaiApiKey?: string
  info?: TravelInfo
  photos?: Array<{ id: string; role: TravelPhotoRole; note?: string }>
}

const CLASSIFY_SYSTEM = `너는 숙소·여행 숏폼 편집자다. 사진마다 역할을 하나 고르고, 영상 첫 컷으로 얼마나 눈길을 끄는지 점수를 매긴다.
역할: hero(수영장·바다뷰·야경 등 압도적인 장면), room(객실·욕실), unique(그 숙소만의 시설·공간), food(식사·카페), around(주변 풍경·관광지)
JSON만 출력:
{"photos":[{"id":"입력 id 그대로","role":"hero|room|unique|food|around","note":"보이는 것 한 줄(20자 이내, 사실만)","hook":1~10}]}`

const SCRIPT_SYSTEM = `너는 한국 숏폼(릴스·쇼츠) 여행 제휴 마케터다. 사진 순서대로 장면마다 나레이션 한 마디를 쓴다.
규칙:
- 장면 수 = 사진 수, 순서 그대로. line은 소리 내어 읽는 말이자 자막이다.
- line은 1~2줄(줄바꿈 \\n), 한 줄 16자 이내. 반드시 해요체(~요, ~예요, ~더라고요). 반말 금지.
- 사진 설명을 그대로 읽지 말고, 그곳에 있는 사람이 느낄 장면·이득으로 말한다.
- 1번 장면은 3초 안에 스크롤을 멈추게 하는 한마디. 평범한 소개("여기는 ~곳이에요") 금지.
  질문·반전·숫자·대상 지목 중 하나로 시작한다. (방식 예: "이 뷰가 국내라고요?", "부모님 모시고 갈 곳 찾았어요")
- 마지막 장면은 정확히 두 줄: 첫 줄은 그 사진에 대한 완결된 한 문장, 둘째 줄은 댓글을 남기면 링크를 보내준다는 말.
- 같은 어미·같은 표현을 연달아 쓰지 않는다. 비슷한 객실 사진이 이어지면 각각 다른 포인트(뷰·크기·침구·채광)를 말한다.
- 사진 설명·사용자 메모에 없는 시설·가격·혜택은 지어내지 않는다. 가격은 주어졌을 때만 쓴다.
- 과장 표현(최저가 보장, 무조건, 100%) 금지.
- headline: 영상 내내 화면 위에 떠 있는 두 줄, 각 14자 이내. 두 번째 줄이 핵심 한 방.
JSON만 출력: {"headline":["",""],"scenes":[{"n":1,"line":""}, ...장면 수만큼]}`

const ANGLE_BRIEF: Record<TravelAngle, string> = {
  price: "접근: 가격 대비 놀라움. 가격이 없으면 '생각보다 부담 없다' 수준으로만 말한다.",
  secret: "접근: 아직 덜 알려진 곳을 친구에게 몰래 귀띔하는 느낌.",
  compare: "접근: 해외·유명 여행지와 견줘도 꿀리지 않는다는 비교.",
}

const PUBLISH_SYSTEM = `너는 한국 인스타그램 릴스·유튜브 쇼츠 여행 계정 운영자다. 업로드용 문구를 쓴다.
- titles: 클릭하고 싶은 제목 3개(각 30자 이내, 서로 다른 접근)
- caption: 게시글 본문 2~4줄, 해요체, 마지막 줄은 댓글로 링크를 받으라는 안내
- hashtags: # 없이 8~12개, 여행·숙소 관련 검색어 위주
- commentKeyword: 댓글로 받을 2~4자 단어 (예: 지역 이름이나 '예약')
사용자 메모에 없는 사실은 지어내지 않는다.
JSON만 출력: {"titles":[],"caption":"","hashtags":[],"commentKeyword":""}`

async function callOpenAi(apiKey: string, messages: unknown[], maxTokens: number) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw Object.assign(new Error(`OpenAI 오류 (${res.status}): ${errText.slice(0, 200)}`), { status: 502 })
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = json.choices?.[0]?.message?.content
  return content ? (JSON.parse(content) as Record<string, unknown>) : {}
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

async function classify(body: ClassifyBody, apiKey: string) {
  const photos = (body.photos ?? []).slice(0, TRAVEL_MAX_PHOTOS).filter((p) => p.id && p.dataUrl)
  if (!photos.length) return NextResponse.json({ error: "사진이 없습니다." }, { status: 400 })
  const content: unknown[] = [{ type: "text", text: "아래 사진들을 분류해줘." }]
  for (const p of photos) {
    content.push({ type: "text", text: `id: ${p.id}` })
    content.push({ type: "image_url", image_url: { url: p.dataUrl, detail: "low" } })
  }
  const raw = await callOpenAi(
    apiKey,
    [
      { role: "system", content: CLASSIFY_SYSTEM },
      { role: "user", content },
    ],
    900
  )
  const known = new Set(photos.map((p) => p.id))
  const list = Array.isArray(raw.photos) ? raw.photos : []
  const result = list
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>
      const id = str(o.id, 80)
      const role = ROLE_IDS.includes(o.role as TravelPhotoRole) ? (o.role as TravelPhotoRole) : "around"
      const hook = Math.min(10, Math.max(1, Number(o.hook) || 5))
      return { id, role, note: str(o.note, 40), hook }
    })
    .filter((p) => known.has(p.id))
  return NextResponse.json({ photos: result })
}

function sceneLine(item: unknown): string {
  const value = typeof item === "string" ? item : (item as Record<string, unknown> | null)?.line
  return str(value, 60).replace(/\\n/g, "\n")
}

type ParsedVariant = { angle: TravelAngle; headline: [string, string]; lines: string[] }

/** 한 버전씩 따로 요청 — 장면이 빠지면 한 번 더 시도하고, 그래도 안 되면 그 버전만 빼고 반환 */
async function writeVariant(
  apiKey: string,
  angle: TravelAngle,
  brief: string,
  sceneCount: number
): Promise<ParsedVariant | null> {
  const messages = [
    { role: "system", content: SCRIPT_SYSTEM },
    { role: "user", content: `${brief}\n\n${ANGLE_BRIEF[angle]}\nscenes는 정확히 ${sceneCount}개.` },
  ]
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callOpenAi(apiKey, messages, 1200)
    const head = Array.isArray(raw.headline) ? raw.headline : []
    const scenes = Array.isArray(raw.scenes) ? raw.scenes : []
    const lines = Array.from({ length: sceneCount }, (_, i) => sceneLine(scenes[i]))
    if (lines.every(Boolean)) {
      return { angle, headline: [str(head[0], 20), str(head[1], 20)], lines }
    }
  }
  return null
}

async function writePublish(apiKey: string, brief: string): Promise<TravelPublishMeta> {
  const pub = await callOpenAi(
    apiKey,
    [
      { role: "system", content: PUBLISH_SYSTEM },
      { role: "user", content: brief },
    ],
    700
  )
  return {
    titles: (Array.isArray(pub.titles) ? pub.titles : []).map((t) => str(t, 60)).filter(Boolean).slice(0, 3),
    caption: str(pub.caption, 500),
    hashtags: (Array.isArray(pub.hashtags) ? pub.hashtags : [])
      .map((t) => str(t, 30).replace(/^#/, "").replace(/\s+/g, ""))
      .filter(Boolean)
      .slice(0, 12),
    commentKeyword: str(pub.commentKeyword, 8) || "링크",
  }
}

async function writeScript(body: ScriptBody, apiKey: string) {
  const info = body.info
  const photos = (body.photos ?? []).slice(0, TRAVEL_MAX_PHOTOS)
  if (!info || photos.length < 2) {
    return NextResponse.json({ error: "사진을 2장 이상 넣어 주세요." }, { status: 400 })
  }
  const nameRule = info.hideName
    ? "숙소 이름과 지역명은 나레이션·헤드라인·제목에 절대 쓰지 말고 '여기', '이곳'으로 부른다. 해시태그에도 넣지 않는다."
    : `숙소 이름(${info.placeName || "미입력"})은 꼭 필요할 때 한 번만, 지역(${info.region || "미입력"})은 자연스럽게 써도 된다.`
  const brief = [
    `숙소/상품: ${info.placeName || "(미입력)"}`,
    `지역: ${info.region || "(미입력)"}`,
    `가격: ${info.priceText || "(없음)"}`,
    `사용자가 아는 장점:\n${info.highlights || "(없음)"}`,
    nameRule,
    "",
    `사진 ${photos.length}장 (= 장면 ${photos.length}개):`,
    ...photos.map((p, i) => `${i + 1}. [${p.role}] ${p.note || "설명 없음"}`),
  ].join("\n")

  const [publish, ...drafts] = await Promise.all([
    writePublish(apiKey, brief),
    ...ANGLES.map((angle) => writeVariant(apiKey, angle, brief, photos.length)),
  ])
  const variants = drafts.filter((v): v is ParsedVariant => v !== null)
  if (!variants.length) {
    return NextResponse.json({ error: "대본을 만들지 못했습니다. 다시 시도해 주세요." }, { status: 422 })
  }
  return NextResponse.json({ variants, publish })
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClassifyBody | ScriptBody | ImportBody
    if (body.action === "import") {
      return NextResponse.json(await fetchCoupangTravelProduct(body.url ?? ""))
    }
    const apiKey = body.openaiApiKey?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API 키가 필요합니다. (설정에서 입력)" }, { status: 400 })
    }
    if (body.action === "classify") return await classify(body, apiKey)
    if (body.action === "script") return await writeScript(body, apiKey)
    return NextResponse.json({ error: "알 수 없는 요청입니다." }, { status: 400 })
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500
    return NextResponse.json({ error: e instanceof Error ? e.message : "요청 실패" }, { status })
  }
}
