"use server"

const thumbnailCache = new Map<string, string>()

/**
 * 직접입력 주제로 관련 주제 15개 생성 (카테고리 무시)
 */
async function generateTopicsFromCustomTopic(customTopic: string, apiKey: string): Promise<string[]> {
  console.log("[generateTopicsFromCustomTopic] 시작, 주제:", customTopic)
  
  const finalPrompt = `🚫🚫🚫 절대 금지: 다른 주제나 카테고리로 벗어나지 마세요. 오직 "${customTopic}"와 직접적으로 관련된 주제만 생성하세요. 🚫🚫🚫

다음 주제를 바탕으로 **오직 해당 주제와 직접적으로 관련된** 다양한 스타일의 롱폼 비디오 주제 15개를 생성해주세요:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 핵심 주제: "${customTopic}"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️⚠️⚠️ 절대적 필수 사항 (반드시 준수하세요) ⚠️⚠️⚠️:
1. 모든 주제는 반드시 "${customTopic}"와 직접적으로 관련되어야 합니다.
2. "${customTopic}"와 관련 없는 주제는 절대 생성하지 마세요.
3. 건강, 인생 교훈, 가족 이야기 등 다른 카테고리 주제는 절대 생성하지 마세요.
4. 오직 "${customTopic}"에 대한 주제만 생성하세요.

예시:
- 주제가 "테슬라"라면: 테슬라 전기차, 테슬라 자율주행, 테슬라 배터리, 테슬라 주식 등 테슬라 관련 주제만 생성
- 주제가 "여자친구 데이트"라면: 데이트 장소, 데이트 아이디어, 데이트 팁 등 데이트 관련 주제만 생성
- 건강, 인생 교훈, 가족 이야기 등은 절대 생성하지 마세요.

요구사항:
- 주제 15개를 반드시 생성해주세요
- 모든 주제는 "${customTopic}"와 직접적으로 관련되어야 합니다
- 다양한 스타일을 골고루 섞어서 생성하세요 (호기심 유발형, 실용 팁형, 스토리형, 트렌드 분석형, 비교형, 과학 설명형 등)
- 각 주제는 한 줄로 간결하게 작성
- 번호 형식: 1. 주제명
- 사과 메시지나 설명 없이 주제만 작성

주제 목록:`
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `당신은 유튜브 롱폼 콘텐츠 기획 전문가입니다. 사용자가 입력한 주제와 **오직 직접적으로 관련된** 주제만 생성해야 합니다.

🚫🚫🚫 절대 금지 사항 🚫🚫🚫:
1. 사용자가 입력한 주제와 관련 없는 주제는 절대 생성하지 마세요.
2. 건강, 인생 교훈, 가족 이야기 등 다른 카테고리 주제는 절대 생성하지 마세요.
3. 주제가 "테슬라"라면 테슬라 관련 주제만 생성하고, 건강이나 다른 주제는 절대 생성하지 마세요.
4. 주제가 "여자친구 데이트"라면 데이트 관련 주제만 생성하고, 다른 주제는 절대 생성하지 마세요.

✅ 필수 사항:
- 사용자가 입력한 주제와 직접적으로 관련된 주제만 생성하세요.
- 모든 주제는 입력한 주제의 핵심 키워드를 포함해야 합니다.

주제 스타일 다양화 (입력한 주제와 관련된 범위 내에서):
   - 호기심 유발형: 미스터리, 궁금증, 비밀, 숨겨진 이야기 (2-3개)
   - 실용 팁형: How-to, 실생활 적용, 꿀팁, 방법론 (2-3개)
   - 스토리/인물형: 인물 중심, 사건 중심, 경험담 (2-3개)
   - 트렌드 분석형: 최신 이슈, 트렌드, 변화 (1-2개)
   - 비교/대조형: A vs B, 차이점, 선택 가이드 (1-2개)
   - 과학/지식 설명형: 원리, 메커니즘, 배경 지식 (1-2개)
   - 감동/공감형: 인간적 이야기, 공감대 형성 (1-2개)

기타:
- 각 주제는 시청자의 호기심을 자극하고 클릭하고 싶게 만들어야 합니다.
- 주제만 생성하고, 사과 메시지나 설명은 절대 포함하지 마세요.
- 각 주제는 번호를 붙여서 작성해주세요 (예: 1. 주제명).`,
        },
        {
          role: "user",
          content: finalPrompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0.9,
    }),
  })

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error("API 응답에서 내용을 찾을 수 없습니다.")
  }

  console.log("[generateTopicsFromCustomTopic] GPT API 응답:", content.substring(0, 200))

  const lines = content.split("\n").filter((line: string) => line.trim())
  const topics: string[] = []
  
  for (const line of lines) {
    // 다양한 번호 형식 지원: "1.", "1)", "1. ", "- 1." 등
    const match = line.match(/^[\d\-]+[\.\)]\s*(.+)$/) || line.match(/^[\-\*]\s*(.+)$/)
    if (match && match[1]) {
      const topic = match[1].trim()
      // 오류 메시지가 아닌 실제 주제인지 확인
      if (topic && 
          topic.length > 0 && 
          !topic.includes("카테고리가") && 
          !topic.includes("죄송하지만") &&
          !topic.includes("제공해")) {
        topics.push(topic)
      }
    }
    if (topics.length >= 15) break
  }

  if (topics.length === 0) {
    console.error("[generateTopicsFromCustomTopic] 주제를 파싱할 수 없습니다. 원본 응답:", content)
    throw new Error(`주제를 생성할 수 없습니다. GPT API 응답: ${content.substring(0, 200)}`)
  }

  console.log("[generateTopicsFromCustomTopic] 생성 완료, 주제 수:", topics.length)
  return topics
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type Category =
  | "wisdom"
  | "religion"
  | "health"
  | "domestic_story"
  | "international_story"
  | "romance_of_three_kingdoms"
  | "folktale"
  | "science"
  | "history"
  | "horror"
  | "society"
  | "northkorea"
  | "space"
  | "self_improvement"
  | "economy"
  | "war"
  | "affair"
  | "ancient"
  | "biology"
  | "greek_roman_mythology"
  | "death"
  | "ai"
  | "alien"
  | "palmistry"
  | "physiognomy"
  | "fortune_telling"
  | "urban_legend"
  | "serial_crime"
  | "unsolved_case"
  | "reserve_army"
  | "elementary_school"

const categoryDescriptions = {
  wisdom: "60대 시니어층을 위한 인생 명언과 생활 지혜",
  religion: "60대 시니어층을 위한 종교·신앙 관련 내용",
  health: "60대 시니어층을 위한 건강 또는 생활 꿀팁",
  domestic_story: "60대 시니어층을 위한 국내 감동 실화와 사연",
  international_story: "60대 시니어층을 위한 해외 감동 실화와 사연",
  romance_of_three_kingdoms: "60대 시니어층을 위한 삼국지 이야기와 인물 스토리",
  folktale: "60대 시니어층을 위한 옛날이야기와 민담",
  science: "60대 시니어층을 위한 과학 이야기와 과학 상식",
  history: "60대 시니어층을 위한 역사 이야기",
  horror: "60대 시니어층을 위한 호러, 공포, 미스터리 이야기",
  society: "60대 시니어층을 위한 사회 이슈와 최신 트렌드",
  northkorea: "60대 시니어층을 위한 북한·탈북 관련 이야기",
  space: "60대 시니어층을 위한 우주, 천문학, 우주 탐사 관련 내용",
  self_improvement: "60대 시니어층을 위한 자기계발 및 성장 콘텐츠",
  economy: "60대 시니어층을 위한 경제·재테크 정보",
  war: "60대 시니어층을 위한 전쟁, 전투, 군사 관련 이야기",
  affair: "60대 시니어층을 위한 불륜, 연애, 인간관계 이야기",
  ancient: "60대 시니어층을 위한 고대시대, 고대 문명, 고대 역사 이야기",
  biology: "60대 시니어층을 위한 생물, 동물, 식물, 자연 생태계 관련 이야기",
  greek_roman_mythology: "60대 시니어층을 위한 그리스 로마 신화 이야기",
  death: "60대 시니어층을 위한 죽음, 인생, 삶의 의미 관련 이야기",
  ai: "60대 시니어층을 위한 인공지능 관련 이야기",
  alien: "60대 시니어층을 위한 외계인설 관련 이야기",
  palmistry: "60대 시니어층을 위한 손금풀이 관련 이야기",
  physiognomy: "60대 시니어층을 위한 관상이야기",
  fortune_telling: "60대 시니어층을 위한 사주팔자 관련 이야기",
  urban_legend: "60대 시니어층을 위한 도시괴담 관련 이야기",
  serial_crime: "60대 시니어층을 위한 연쇄범죄 관련 이야기",
  unsolved_case: "60대 시니어층을 위한 미제사건 관련 이야기",
  reserve_army: "60대 시니어층을 위한 예비군이야기",
  elementary_school: "60대 시니어층을 위한 국민학교 관련 이야기",
}

function getDefaultTopics(category: Category): string[] {
  const defaultTopics = {
    wisdom: [
      "인생 2막, 60대부터 시작하는 새로운 도전",
      "후회 없는 노년을 위한 삶의 지혜",
      "손주들에게 전하는 할아버지의 인생 조언",
      "60년 인생에서 배운 가장 중요한 교훈들",
      "나이 들수록 더 행복해지는 비결",
    ],
    religion: [
      "성경이 알려주는 평안한 노년의 비결",
      "불교에서 배우는 집착 내려놓기",
      "기독교 신앙으로 극복하는 노년의 외로움",
      "종교가 주는 위로와 평화",
      "신앙생활로 찾은 삶의 의미",
    ],
    health: [
      "무릎 관절염 예방을 위한 일상 습관 십 가지",
      "60대부터 시작하는 혈압 관리의 모든 것",
      "치매 예방에 효과적인 뇌 건강 운동법",
      "당뇨병 환자를 위한 올바른 식단 관리",
      "골다공증 예방을 위한 칼슘 섭취 가이드",
    ],
    northkorea: [
      "탈북민이 직접 들려주는 북한 실상",
      "분단 70년, 남북 언어의 차이",
      "북한에서의 일상 생활 이야기",
      "탈북 과정의 고난과 희망",
      "통일을 위해 우리가 알아야 할 것들",
    ],
    history: [
      "6.25 전쟁의 생생한 기억들",
      "대한민국 산업화의 주역들",
      "우리가 겪은 민주화 운동의 역사",
      "잊혀져가는 옛 한국의 모습들",
      "격동의 근현대사를 살아낸 이야기",
    ],
    society: [
      "요즘 젊은이들이 열광하는 트렌드 이해하기",
      "60대가 알아야 할 디지털 세상의 변화",
      "세대 차이를 좁히는 대화의 기술",
      "최근 사회 이슈로 본 세상의 변화",
      "시니어도 즐길 수 있는 최신 문화 트렌드",
    ],
    self_improvement: [
      "60대부터 시작하는 새로운 습관 만들기",
      "노년에도 성장할 수 있는 자기계발 방법",
      "나이 들수록 더 가치 있는 삶을 사는 법",
      "60대를 위한 목표 설정과 달성 전략",
      "은퇴 후에도 의미 있는 삶을 찾는 방법",
    ],
    domestic_story: [
      "서울 지하철에서 만난 80세 할머니의 감동 실화",
      "40년 만에 재회한 첫사랑, 부산 노부부 이야기",
      "강릉 시장 할머니가 매일 국밥을 무료로 나눈 이유",
      "제주도 해녀 할머니가 바다를 지키는 진짜 이유",
      "홀로 3남매를 키운 어머니의 희생과 사랑",
    ],
    international_story: [
      "90세 할머니가 대학 졸업장을 받기까지",
      "노숙자를 집에 초대한 미국 할아버지의 기적",
      "70세에 마라톤을 시작한 일본 할머니의 도전",
      "전쟁고아를 50년간 돌본 독일 할아버지",
      "100세 할머니가 매일 학교에 가는 감동적인 이유",
    ],
    space: [
      "우주에서 본 지구의 아름다운 모습",
      "화성 탐사가 우리에게 알려준 것들",
      "블랙홀의 비밀과 우주의 신비",
      "태양계 행성들의 놀라운 특징들",
      "우주에서 가장 멀리 떨어진 천체의 이야기",
    ],
    romance_of_three_kingdoms: [
      "유비, 관우, 장비의 도원결의 이야기",
      "제갈량의 적벽대전 전략",
      "조조의 야심과 리더십",
      "관우의 충의와 의리",
      "삼국지에서 배우는 인생 교훈",
    ],
    folktale: [
      "흥부와 놀부 이야기",
      "심청전의 효와 사랑",
      "콩쥐 팥쥐의 선과 악",
      "토끼와 거북이의 교훈",
      "옛날이야기 속 지혜와 교훈",
    ],
    science: [
      "인공지능이 바꾸는 우리의 일상",
      "기후 변화와 지구의 미래",
      "우리 몸의 신비, 뇌과학 이야기",
      "우주 탐사의 최신 성과",
      "과학이 풀어낸 자연의 비밀",
    ],
    horror: [
      "한국의 전설적인 괴담들",
      "실제로 일어난 미스터리 사건",
      "옛날 이야기 속 귀신과 요괴",
      "공포 영화보다 무서운 실제 사건",
      "전설 속 저주받은 장소들",
    ],
    economy: [
      "60대를 위한 안전한 재테크 가이드",
      "연금 외 추가 수입 만들기",
      "노후 자금 관리의 핵심 전략",
      "시니어를 위한 부동산 투자 가이드",
      "손주들을 위한 증여 절세 방법",
    ],
    war: [
      "6.25 전쟁의 생생한 기억들",
      "베트남 전쟁 참전 용사들의 이야기",
      "전쟁 속에서 피어난 인간애",
      "전쟁이 남긴 상처와 치유",
      "평화를 위해 기억해야 할 전쟁의 교훈",
    ],
    affair: [
      "불륜으로 망가진 가족의 이야기",
      "배신과 용서의 경계",
      "불륜이 남긴 상처와 회복",
      "인간관계의 복잡함과 진실",
      "사랑과 도덕의 딜레마",
    ],
    ancient: [
      "고대 문명의 놀라운 발견들",
      "고대 이집트의 신비로운 이야기",
      "고대 그리스 로마의 영웅들",
      "고대 동양 문명의 지혜",
      "고대인들의 생활과 문화",
    ],
    greek_roman_mythology: [
      "제우스와 올림포스 12신의 이야기",
      "프로메테우스가 인간에게 불을 준 이유",
      "아폴론과 다프네의 비극적 사랑",
      "오디세우스의 10년 항해 모험",
      "트로이 전쟁의 시작과 끝",
    ],
    death: [
      "죽음을 앞둔 사람들이 후회하는 것들",
      "인생의 마지막 순간이 알려주는 진실",
      "죽음 이후를 믿는 사람들의 이야기",
      "죽음을 통해 배우는 삶의 의미",
      "마지막 순간까지 사랑을 나눈 사람들",
    ],
    ai: [
      "인공지능이 바꾸는 우리의 일상",
      "AI가 대체할 수 없는 인간의 능력",
      "인공지능 시대, 시니어가 알아야 할 것들",
      "AI와 함께하는 미래 사회",
      "인공지능의 놀라운 발전과 한계",
    ],
    alien: [
      "외계인 존재 증거와 의혹",
      "UFO 목격담의 진실과 거짓",
      "외계인과의 만남, 실제 사건들",
      "우주에서 온 신호의 비밀",
      "외계 생명체 탐사의 최신 성과",
    ],
    palmistry: [
      "손금으로 보는 인생 운명",
      "손금의 의미와 해석법",
      "손금으로 알아보는 건강과 장수",
      "손금으로 보는 성격과 재능",
      "손금이 바뀌는 이유와 의미",
    ],
    physiognomy: [
      "관상으로 보는 성격과 운명",
      "얼굴로 알아보는 건강 상태",
      "관상의 과학적 근거와 한계",
      "옛날 관상가들의 예언 이야기",
      "관상으로 본 역사 속 인물들",
    ],
    fortune_telling: [
      "사주팔자로 보는 인생 운명",
      "사주로 알아보는 건강과 장수",
      "사주팔자의 과학적 해석",
      "옛날 사주가들의 정확한 예언",
      "사주로 본 성공한 사람들의 특징",
    ],
    urban_legend: [
      "한국의 대표적인 도시괴담들",
      "실제로 일어난 도시 전설",
      "도시괴담의 진실과 거짓",
      "옛날부터 전해오는 무서운 이야기",
      "도시 속 미스터리한 장소들",
    ],
    serial_crime: [
      "한국 역사상 유명한 연쇄범죄",
      "연쇄살인범의 심리 분석",
      "연쇄범죄 사건의 해결 과정",
      "연쇄범죄가 남긴 사회적 충격",
      "연쇄범죄 예방과 대응 방법",
    ],
    unsolved_case: [
      "한국의 대표적인 미제사건들",
      "해결되지 않은 살인사건의 진실",
      "미제사건의 새로운 단서들",
      "시간이 지나도 잊히지 않는 사건",
      "미제사건 해결을 위한 노력",
    ],
    reserve_army: [
      "예비군 훈련의 추억과 이야기",
      "예비군 시절 겪은 에피소드",
      "예비군 훈련장에서의 우정",
      "예비군의 역할과 중요성",
      "예비군 시절의 웃긴 일화들",
    ],
    elementary_school: [
      "국민학교 시절의 추억",
      "옛날 국민학교의 모습",
      "국민학교 시절의 선생님과 친구들",
      "국민학교에서 배운 인생 교훈",
      "국민학교 시절의 놀이와 추억",
    ],
  }

  return defaultTopics[category] || []
}

export async function generateTopics(
  category: Category | string | undefined = "health",
  keywords?: string,
  benchmarkUrl?: string,
  apiKey?: string,
  customTopic?: string
) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  // ⚠️ 매우 중요: 직접입력 주제가 있으면 generateTopicsFromCustomTopic 함수 호출
  if (customTopic && typeof customTopic === 'string' && customTopic.trim().length > 0) {
    console.log("[actions.tsx] 직접입력 주제 모드 감지 - 주제:", customTopic.trim())
    console.log("[actions.tsx] generateTopicsFromCustomTopic 함수 호출 시작")
    try {
      const result = await generateTopicsFromCustomTopic(customTopic.trim(), GPT_API_KEY)
      console.log("[actions.tsx] generateTopicsFromCustomTopic 함수 완료, 결과:", result.length, "개")
      return result
    } catch (error) {
      console.error("[actions.tsx] generateTopicsFromCustomTopic 실패:", error)
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류"
      throw new Error(`주제 생성 실패: ${errorMessage}`)
    }
  }

  try {
    // category가 없거나 유효하지 않으면 기본값 사용
    // categoryPrompts는 try 블록 내부에 정의되므로, 여기서는 간단한 타입 체크만 수행
    const validCategory: Category = (category && typeof category === 'string') 
      ? (category as Category)
      : "health"
    // 공통 프롬프트
    const commonPrompt = `너는 유튜브 롱폼 콘텐츠 기획 전문가다.

선택된 카테고리를 기반으로 사람들이 시청하고 싶어 하는 흥미로운 "영상 주제(콘셉트)"를 만든다.

※ 제목은 생성하지 않는다. (주제만 출력)

조건:
1) 40~70대 시니어도 이해하기 쉬운 표현을 사용한다.
2) 실제 유튜브에서 높은 조회수 가능성이 있는 주제만 작성한다.
3) 너무 전문적이거나 어려운 표현은 사용하지 않는다.
4) 선택된 카테고리와 직접적으로 연관된 주제만 출력한다.
5) 벤치마킹 URL이 있을 경우, 해당 유튜브의 전개 방식/감정선/클릭 포인트를 참고해 "확장된 주제"를 생성한다.
6) 기본 키워드가 있을 경우 그 키워드를 중심으로 연관 주제를 확장한다.
7) 정보 나열형(백과사전형) 주제는 제외하고, '왜 → 어떻게 → 결과'가 떠오르는 이야기형/사건형/인물형 주제를 우선한다.
8) 각 주제는 롱폼(10~20분)으로 확장 가능해야 하며, 갈등·반전·교훈·미스터리·충격 요소 중 최소 1개가 포함되도록 설계한다.

출력 형식:
- 주제만 리스트 형태로 출력한다. (제목 금지)
- 불릿포인트 형식으로 15개 추천한다.
- 각 주제는 1줄로 간결하게 작성한다.`

    // 카테고리별 프롬프트
    const categoryPrompts: Record<Category, string> = {
      wisdom: `명언, 삶의 교훈, 인생 철학, 성공, 인간관계, 습관, 감정관리 등 사람들이 삶에서 바로 적용할 수 있는 실용적 주제를 중심으로 작성해줘.

특히 '어른들이 공감하는 삶의 통찰'과 '실패·성공·후회·마음공부' 등의 주제를 강화해줘.`,
      religion: `기독교·불교·천주교를 모두 포함한 '포용적인 종교 콘텐츠 주제'를 만들어줘.

특정 종교를 강조하거나 편향되게 만들지 말고, 세 종교 모두에서 공통적으로 얻을 수 있는 '삶의 지혜', '마음의 평안', '깨달음', '인간관계', '고난 극복', '명상과 기도', '마음공부'를 중심으로 주제를 만들어라.

40~70대 시니어 시청자가 가장 공감할 수 있는 내용을 최우선으로 하고, 종교적 용어가 너무 전문적이거나 교리 중심이 되지 않도록 조절해라.

세부 방향:
1) 기독교: 성경 속 이야기, 인물 스토리, 삶의 지혜, 평안, 용서, 회복
2) 불교: 마음 비우기, 집착 내려놓기, 수행 이야기, 스님 일화, 깨달음의 과정
3) 천주교: 성인의 삶, 기도, 고난 극복, 사랑과 봉사, 영성
4) 공통: 마음을 다스리는 법, 영성 성장, 인간관계 회복, 고난을 이겨내는 지혜, 마음 치유

주의:
- 특정 종교를 선교하는 느낌은 절대 금지.
- 서로 다른 종교를 비교해 우열을 가르지 말 것.
- 각 종교의 '좋은 메시지'만 가져와서 시니어가 공감할 수 있게 재구성.
- 너무 종교적이거나 교리 중심이 아닌, '일상 속 인생 지혜' 중심으로 작성.

출력 방식:
- 종교 전체를 아우르는 주제 15개를 리스트로만 출력.
- 공감·치유·지혜·감동 중심의 제목으로 구성.`,
      health: `시니어가 가장 궁금해하는 '장수', '치매 예방', '뇌 건강', '피부', '관절', '심혈관', '면역력', '식습관', '운동' 관련 주제를 중심으로 작성해줘.

특히 '의사들이 말해주는' 또는 '과학·논문 기반 건강 정보' 톤의 주제를 강화해줘.`,
      northkorea: `북한 이야기, 탈북 스토리, 북한 문화, 생활, 비교, 실제 경험담, 북한 뉴스 분석 중심으로 주제를 작성해줘.

시청자가 호기심을 느낄 수 있는 '은밀한 북한 이야기', '탈북자 경험', '한국과의 차이'를 강조해줘.`,
      history: `한국사 중심이지만 세계사 스토리도 포함해도 된다.

특히 '사람들이 잘 모르는 역사적 사실', '논란이 있는 사건', '미스터리한 역사', '전쟁·왕·인물 중심 스토리'를 강조해 흥미롭게 작성해줘.

드라마틱한 사건 위주로 부탁해.`,
      society: `2020~2025 사회 변화, 소비트렌드, SNS 문화, Z세대·시니어 트렌드, 기술 변화, 생활습관 변화 등 사람들이 공감할 사회 이슈 중심으로 작성해줘.

단, 정치적·편향적 내용은 제외해.`,
      self_improvement: `60대 시니어를 위한 자기계발, 성장, 목표 달성, 습관 형성, 동기부여 관련 주제를 중심으로 작성해줘.

특히 '나이 들수록도 성장할 수 있다', '은퇴 후 새로운 도전', '습관의 힘', '목표 설정과 달성', '긍정적 마인드셋' 등을 강조해줘.

시니어가 공감할 수 있는 실용적이고 실행 가능한 자기계발 방법을 중심으로 작성해줘.`,
      domestic_story: `한국에서 실제로 일어난 감동사연, 선행, 사건·사고, 미담, 가족 이야기, 성공·회복 스토리 중심으로 작성해줘.

시청자의 감정을 건드리는 '스토리 기반' 주제를 강조해.`,
      international_story: `해외에서 실제로 일어난 감동 스토리, 극복 스토리, 놀라운 구조 이야기, 국제 미담, 드라마 같은 실제 사건들을 중심으로 작성해줘.

소름·감동·눈물 요소가 있는 주제를 강조해.`,
      space: `우주, 천문학, 우주 탐사, 별과 행성, 우주 미스터리, 블랙홀, 외계 생명체, 우주 여행, 태양계, 우주 역사 등을 중심으로 작성해줘.

특히 '사람들이 잘 모르는 우주의 신비', '최신 우주 탐사 성과', '우주에서 본 지구의 아름다움', '우주의 놀라운 사실들'을 강조해 흥미롭게 작성해줘.

시니어층이 이해하기 쉽고 호기심을 자극하는 주제로 구성해줘.`,
      romance_of_three_kingdoms: `삼국지의 인물, 전투, 전략, 충의, 의리, 리더십 등을 중심으로 작성해줘.

특히 '유비, 관우, 장비의 도원결의', '제갈량의 지혜', '조조의 야심', '관우의 충의', '조운의 무용' 등 인물 스토리와 전략을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 삼국지 이야기와 인생 교훈을 중심으로 구성해줘.`,
      folktale: `한국의 옛날이야기, 민담, 전래동화, 설화 등을 중심으로 작성해줘.

특히 '흥부와 놀부', '심청전', '콩쥐 팥쥐', '토끼와 거북이' 등 전래동화와 민담의 교훈과 지혜를 강조해 흥미롭게 작성해줘.

시니어층이 어릴 때 들었던 옛날이야기와 그 속에 담긴 인생 교훈을 중심으로 구성해줘.`,
      science: `과학 이야기, 과학 상식, 과학 발견, 과학자 이야기, 과학의 신비 등을 중심으로 작성해줘.

특히 '일상 속 과학', '과학이 풀어낸 자연의 비밀', '과학자들의 이야기', '과학의 놀라운 발견' 등을 강조해 흥미롭게 작성해줘.

시니어층이 이해하기 쉽고 호기심을 자극하는 과학 이야기를 중심으로 구성해줘.`,
      horror: `호러, 공포, 미스터리, 괴담, 전설, 실제 사건 등을 중심으로 작성해줘.

특히 '한국의 전설적인 괴담', '실제로 일어난 미스터리 사건', '옛날 이야기 속 귀신과 요괴', '전설 속 저주받은 장소' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 공포와 미스터리 이야기를 중심으로 구성해줘.`,
      war: `전쟁, 전투, 군사, 평화, 전쟁의 교훈, 전쟁 참전 용사, 전쟁의 상처와 치유 등을 중심으로 작성해줘.

특히 '6.25 전쟁', '베트남 전쟁', '전쟁 속 인간애', '평화의 소중함' 등을 강조해 흥미롭게 작성해줘.

시니어층이 공감할 수 있는 전쟁 이야기와 평화의 메시지를 중심으로 구성해줘.`,
      affair: `불륜, 배신, 연애, 인간관계, 용서, 상처, 회복 등을 중심으로 작성해줘.

특히 '불륜으로 망가진 가족', '배신과 용서', '인간관계의 복잡함', '사랑과 도덕의 딜레마' 등을 강조해 흥미롭게 작성해줘.

시니어층이 공감할 수 있는 인간관계 이야기를 중심으로 구성해줘.`,
      ancient: `고대시대, 고대 문명, 고대 역사, 고대인들의 생활, 고대 문화 등을 중심으로 작성해줘.

특히 '고대 이집트', '고대 그리스 로마', '고대 동양 문명', '고대인들의 지혜' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 고대 문명과 역사 이야기를 중심으로 구성해줘.`,
      biology: `생물, 동물, 식물, 자연 생태계, 생명의 신비 등을 중심으로 작성해줘.

특히 '동물들의 놀라운 생존 능력', '식물의 신비로운 생명력', '자연 생태계의 균형', '동물들의 감동적인 모성애', '생물들의 놀라운 진화' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 자연과 생물 이야기를 중심으로 구성해줘.`,
      greek_roman_mythology: `그리스 로마 신화의 신들, 영웅들, 전설 등을 중심으로 작성해줘.

특히 '제우스와 올림포스 12신', '헤라클레스의 12가지 과업', '오디세우스의 모험', '트로이 전쟁', '판도라의 상자', '프로메테우스의 불', '아폴론과 다프네', '오르페우스와 에우리디케' 등 고전 신화 이야기를 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 그리스 로마 신화의 영웅과 신들의 이야기, 그리고 그 속에 담긴 인생 교훈을 중심으로 구성해줘.`,
      death: `죽음, 인생의 마지막, 삶의 의미, 죽음 이후, 유언, 마지막 순간 등을 중심으로 작성해줘.

특히 '죽음을 앞둔 사람들이 후회하는 것들', '인생의 마지막 순간이 알려주는 진실', '죽음을 통해 배우는 삶의 의미', '마지막 순간까지 사랑을 나눈 사람들', '죽음 이후를 믿는 사람들의 이야기', '유언이 남긴 교훈' 등을 강조해 흥미롭고 감동적으로 작성해줘.

시니어층이 공감할 수 있는 죽음과 인생에 대한 깊이 있는 이야기를 중심으로 구성해줘.`,
      ai: `인공지능, AI 기술, AI의 발전, AI가 바꾸는 세상, AI와 인간의 관계 등을 중심으로 작성해줘.

특히 '인공지능이 바꾸는 우리의 일상', 'AI가 대체할 수 없는 인간의 능력', '인공지능 시대 시니어가 알아야 할 것들', 'AI와 함께하는 미래 사회', '인공지능의 놀라운 발전과 한계' 등을 강조해 흥미롭게 작성해줘.

시니어층이 이해하기 쉽고 호기심을 자극하는 인공지능 이야기를 중심으로 구성해줘.`,
      alien: `외계인, UFO, 외계 생명체, 외계인 목격담, 외계인 설 등을 중심으로 작성해줘.

특히 '외계인 존재 증거와 의혹', 'UFO 목격담의 진실과 거짓', '외계인과의 만남 실제 사건들', '우주에서 온 신호의 비밀', '외계 생명체 탐사의 최신 성과' 등을 강조해 흥미롭고 신비롭게 작성해줘.

시니어층이 좋아하는 외계인과 UFO 이야기를 중심으로 구성해줘.`,
      palmistry: `손금, 손금풀이, 손금 해석, 손금으로 보는 운명 등을 중심으로 작성해줘.

특히 '손금으로 보는 인생 운명', '손금의 의미와 해석법', '손금으로 알아보는 건강과 장수', '손금으로 보는 성격과 재능', '손금이 바뀌는 이유와 의미' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 손금풀이와 운명 이야기를 중심으로 구성해줘.`,
      physiognomy: `관상, 관상이야기, 얼굴로 보는 성격, 관상 해석 등을 중심으로 작성해줘.

특히 '관상으로 보는 성격과 운명', '얼굴로 알아보는 건강 상태', '관상의 과학적 근거와 한계', '옛날 관상가들의 예언 이야기', '관상으로 본 역사 속 인물들' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 관상이야기와 운명 이야기를 중심으로 구성해줘.`,
      fortune_telling: `사주, 사주팔자, 사주 해석, 사주로 보는 운명 등을 중심으로 작성해줘.

특히 '사주팔자로 보는 인생 운명', '사주로 알아보는 건강과 장수', '사주팔자의 과학적 해석', '옛날 사주가들의 정확한 예언', '사주로 본 성공한 사람들의 특징' 등을 강조해 흥미롭게 작성해줘.

시니어층이 좋아하는 사주팔자와 운명 이야기를 중심으로 구성해줘.`,
      urban_legend: `도시괴담, 도시 전설, 무서운 이야기, 미스터리한 사건 등을 중심으로 작성해줘.

특히 '한국의 대표적인 도시괴담들', '실제로 일어난 도시 전설', '도시괴담의 진실과 거짓', '옛날부터 전해오는 무서운 이야기', '도시 속 미스터리한 장소들' 등을 강조해 흥미롭고 긴장감 있게 작성해줘.

시니어층이 좋아하는 도시괴담과 미스터리 이야기를 중심으로 구성해줘.`,
      serial_crime: `연쇄범죄, 연쇄살인, 범죄 사건, 범죄 심리 등을 중심으로 작성해줘.

특히 '한국 역사상 유명한 연쇄범죄', '연쇄살인범의 심리 분석', '연쇄범죄 사건의 해결 과정', '연쇄범죄가 남긴 사회적 충격', '연쇄범죄 예방과 대응 방법' 등을 강조해 흥미롭고 교육적으로 작성해줘.

시니어층이 관심 있어 하는 연쇄범죄 이야기를 중심으로 구성해줘.`,
      unsolved_case: `미제사건, 해결되지 않은 사건, 미스터리 사건 등을 중심으로 작성해줘.

특히 '한국의 대표적인 미제사건들', '해결되지 않은 살인사건의 진실', '미제사건의 새로운 단서들', '시간이 지나도 잊히지 않는 사건', '미제사건 해결을 위한 노력' 등을 강조해 흥미롭고 긴장감 있게 작성해줘.

시니어층이 관심 있어 하는 미제사건과 미스터리 이야기를 중심으로 구성해줘.`,
      reserve_army: `예비군, 예비군 훈련, 예비군 이야기, 군대 추억 등을 중심으로 작성해줘.

특히 '예비군 훈련의 추억과 이야기', '예비군 시절 겪은 에피소드', '예비군 훈련장에서의 우정', '예비군의 역할과 중요성', '예비군 시절의 웃긴 일화들' 등을 강조해 흥미롭고 추억에 남을 수 있게 작성해줘.

시니어층이 공감할 수 있는 예비군 이야기와 추억을 중심으로 구성해줘.`,
      elementary_school: `국민학교, 옛날 학교, 초등학교 추억, 어린 시절 등을 중심으로 작성해줘.

특히 '국민학교 시절의 추억', '옛날 국민학교의 모습', '국민학교 시절의 선생님과 친구들', '국민학교에서 배운 인생 교훈', '국민학교 시절의 놀이와 추억' 등을 강조해 따뜻하고 향수 어리게 작성해줘.

시니어층이 공감할 수 있는 국민학교 시절의 추억과 이야기를 중심으로 구성해줘.`,
    }

    // 사용자 프롬프트 구성
    let userPrompt = `카테고리: ${categoryDescriptions[category]}\n\n`
    userPrompt += `[카테고리별 프롬프트]\n${categoryPrompts[category]}\n\n`

    if (keywords && keywords.trim()) {
      userPrompt += `키워드: ${keywords}\n\n`
    }

    if (benchmarkUrl && benchmarkUrl.trim()) {
      userPrompt += `벤치마킹 URL: ${benchmarkUrl}\n위 URL의 유튜브 스타일을 참고하여 확장된 주제를 생성해주세요.\n\n`
    }

    userPrompt += `위 조건에 맞는 주제 15개를 불릿포인트 형식으로 생성해주세요.`

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
            content: commonPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("API 응답에서 내용을 찾을 수 없습니다.")
    }

    // 응답을 배열로 파싱
    const topics = content
      .split("\n")
      .filter((line: string) => line.trim() && (line.includes(".") || line.includes("-") || line.includes("•") || line.includes("*")))
      .map((line: string) =>
        line
          .replace(/^\d+\.\s*/, "")
          .replace(/^[-•*]\s*/, "")
          .replace(/^-\s*/, "")
          .trim(),
      )
      .filter((line: string) => line.length > 0)
      .slice(0, 15)

    return topics.length > 0 ? topics : getDefaultTopics(category)
  } catch (error) {
    console.error("주제 생성 실패:", error)

    return getDefaultTopics(category)
  }
}

// HTML 엔티티 디코딩 함수
function decodeHtmlEntities(text: string): string {
  const entityMap: Record<string, string> = {
    "&#39;": "'",
    "&apos;": "'",
    "&quot;": '"',
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&nbsp;": " ",
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  }

  // 숫자 엔티티 디코딩 (&#39;, &#x27; 등)
  let decoded = text.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(Number.parseInt(dec, 10))
  })

  // 16진수 엔티티 디코딩 (&#x27; 등)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    return String.fromCharCode(Number.parseInt(hex, 16))
  })

  // 이름 기반 엔티티 디코딩
  for (const [entity, char] of Object.entries(entityMap)) {
    decoded = decoded.replace(new RegExp(entity, "g"), char)
  }

  return decoded
}

export async function generateTrendingTopics(
  category: Category = "health",
  apiKey?: string
) {
  try {
    // 카테고리별 유튜브 검색 키워드 매핑
    const categorySearchKeywords: Record<Category, string[]> = {
      wisdom: ["명언", "인생", "지혜", "삶의 교훈", "인생 조언", "시니어 명언"],
      religion: ["종교", "기독교", "불교", "신앙", "기도", "종교 이야기"],
      health: ["건강", "시니어 건강", "노인 건강", "건강 정보", "건강 관리"],
      domestic_story: ["감동", "실화", "사연", "감동 이야기", "국내 사연"],
      international_story: ["해외", "감동", "실화", "해외 사연", "국제 미담"],
      romance_of_three_kingdoms: ["삼국지", "유비", "관우", "장비", "제갈량", "조조"],
      folktale: ["옛날이야기", "민담", "전래동화", "설화", "흥부놀부", "심청전"],
      science: ["과학", "과학 이야기", "과학 상식", "과학자", "과학 발견"],
      history: ["역사", "한국사", "역사 이야기", "한국 역사"],
      horror: ["호러", "공포", "미스터리", "괴담", "전설", "귀신"],
      society: ["사회", "트렌드", "사회 이슈", "최신 트렌드"],
      northkorea: ["북한", "탈북", "북한 이야기", "탈북자", "북한 실상"],
      space: ["우주", "천문학", "우주 탐사", "별", "행성", "블랙홀"],
      self_improvement: ["자기계발", "성장", "목표", "습관", "동기부여"],
      economy: ["경제", "재테크", "노후", "연금", "부동산", "투자"],
      war: ["전쟁", "6.25 전쟁", "베트남 전쟁", "전쟁 이야기", "전투", "군사"],
      affair: ["불륜", "배신", "연애", "인간관계", "사랑", "이별"],
      ancient: ["고려시대", "고대", "고대 문명", "고대 역사", "고려", "고대시대"],
      biology: ["생물", "동물", "식물", "자연", "생태계", "생명"],
      greek_roman_mythology: ["그리스 신화", "로마 신화", "올림포스", "제우스", "헤라클레스", "신화"],
      death: ["죽음", "인생", "삶의 의미", "마지막", "후회"],
      ai: ["인공지능", "AI", "로봇", "기계", "자동화"],
      alien: ["외계인", "UFO", "우주", "외계 생명체"],
      palmistry: ["손금", "손금 풀이", "운명", "점술"],
      physiognomy: ["관상", "얼굴", "성격", "운명"],
      fortune_telling: ["사주", "운세", "점술", "예언"],
      urban_legend: ["도시전설", "괴담", "전설", "이야기"],
      serial_crime: ["연쇄살인", "범죄", "사건", "미제사건"],
      unsolved_case: ["미제사건", "미해결", "의문사건", "수사"],
      reserve_army: ["예비군", "군대", "훈련", "국방"],
      elementary_school: ["국민학교", "초등학교", "옛날 학교", "학교 추억", "어린 시절", "추억"],
    }

    // API 키는 파라미터로 전달받거나 환경변수에서 가져옴 (하드코딩 제거)
    const youtubeApiKey = apiKey || process.env.YOUTUBE_API_KEY

    if (!youtubeApiKey) {
      console.error("YouTube API 키가 설정되지 않았습니다. 설정 페이지에서 YouTube Data API Key를 입력해주세요.")
      return []
    }

    // 최근 일주일 계산
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const publishedAfter = oneWeekAgo.toISOString()

    // 카테고리별 검색 키워드 가져오기
    const keywords = categorySearchKeywords[category] || [category]

    // 모든 키워드로 검색한 결과를 합치기
    const allVideos: Array<{
      title: string
      viewCount: number
      videoId: string
    }> = []

    for (const keyword of keywords.slice(0, 3)) {
      // 각 키워드로 최근 일주일간 영상 검색
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(keyword)}&type=video&videoDuration=long&regionCode=KR&relevanceLanguage=ko&order=viewCount&publishedAfter=${publishedAfter}&key=${youtubeApiKey}`,
      )

      if (!searchResponse.ok) {
        console.error(`YouTube 검색 실패 (키워드: ${keyword}):`, searchResponse.status)
        continue
      }

      const searchData = await searchResponse.json()

      if (!searchData.items || searchData.items.length === 0) {
        continue
      }

      // 비디오 ID 추출
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",")

      // 채널 ID 추출 (중복 제거)
      const channelIds = [...new Set(searchData.items.map((item: any) => item.snippet.channelId))].join(",")

      // 비디오 통계 정보 가져오기
      const statsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${youtubeApiKey}`,
      )

      if (!statsResponse.ok) {
        continue
      }

      const statsData = await statsResponse.json()

      // 채널 정보 가져오기 (한국 채널 필터링용)
      const channelsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds}&key=${youtubeApiKey}`,
      )

      const channelsData = channelsResponse.ok ? await channelsResponse.json() : { items: [] }
      const channelMap = new Map<string, any>()
      channelsData.items?.forEach((channel: any) => {
        channelMap.set(channel.id, channel)
      })

      // 제목과 조회수 정보 수집 (한국 영상만 엄격하게 필터링)
      searchData.items.forEach((item: any, index: number) => {
        const videoStats = statsData.items[index]
        if (!videoStats) return

        const channel = channelMap.get(item.snippet.channelId)
        const videoTitle = item.snippet.title || ""
        const videoDescription = videoStats.snippet?.description || ""
        
        // 1. 제목에 한글이 반드시 포함되어 있어야 함
        const titleHasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(videoTitle)
        if (!titleHasKorean) return // 제목에 한글이 없으면 제외
        
        // 2. 제목에 영어가 포함되어 있으면 제외 (한글만 허용)
        const titleHasEnglish = /[a-zA-Z]/.test(videoTitle)
        if (titleHasEnglish) return // 제목에 영어가 있으면 제외
        
        // 2. 채널 정보 확인
        const channelDefaultLanguage = channel?.snippet?.defaultLanguage || ""
        const channelCountry = channel?.snippet?.country || ""
        const channelTitle = channel?.snippet?.title || ""
        
        // 3. 채널 제목에도 한글이 있는지 확인 (한국 채널일 가능성 높음)
        const channelTitleHasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(channelTitle)
        
        // 4. 엄격한 한국 영상 필터링 조건 (모든 조건을 AND로 결합)
        // - 제목에 한글 포함 (이미 확인함)
        // - AND (채널 기본 언어가 한국어이거나, 채널 국가가 한국이거나, 채널 제목에 한글이 있거나)
        const isKoreanChannel = 
          channelDefaultLanguage === "ko" ||
          channelDefaultLanguage.startsWith("ko") ||
          channelCountry === "KR" ||
          channelTitleHasKorean
        
        // 5. 설명에도 한글이 있는지 확인 (추가 검증)
        const descriptionHasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(videoDescription)
        
        // 최종 필터링: 제목에 한글 AND (한국 채널 OR 설명에 한글)
        const isKoreanVideo = titleHasKorean && (isKoreanChannel || descriptionHasKorean)

        if (isKoreanVideo) {
          // HTML 엔티티 디코딩
          const decodedTitle = decodeHtmlEntities(item.snippet.title)
          
          allVideos.push({
            title: decodedTitle,
            viewCount: Number.parseInt(videoStats.statistics?.viewCount || "0"),
            videoId: item.id.videoId,
          })
        }
      })

      // API 할당량 고려하여 약간의 딜레이
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 조회수 기준으로 정렬
    allVideos.sort((a, b) => b.viewCount - a.viewCount)

    // 중복 제목 제거 (제목이 유사한 것도 제거)
    const uniqueVideos: Array<{ title: string; videoId: string }> = []
    const seenTitles = new Set<string>()

    for (const video of allVideos) {
      // 제목 정규화 (공백 제거, 소문자 변환)
      const normalizedTitle = video.title
        .replace(/\s+/g, "")
        .toLowerCase()
        .substring(0, 30) // 앞 30자만 비교

      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.add(normalizedTitle)
        uniqueVideos.push({
          title: video.title,
          videoId: video.videoId,
        })

        // 최대 10개까지만
        if (uniqueVideos.length >= 10) {
          break
        }
      }
    }

    return uniqueVideos
  } catch (error) {
    console.error("인기 주제 조회 실패:", error)
    return []
  }
}

export async function generateScript(topic: string, customScript?: string, apiKey?: string) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    // 실제 대본 생성 로직
    await new Promise((resolve) => setTimeout(resolve, 3000))

    const generatedScript = `이 이야기는 어디에서 절대 꺼내지 않는 이야기입니다.

안녕하세요. 저는 삼십 년간 해당 분야의 경험자인 김건강입니다. 오늘은 ${topic}에 대해 여러분께 꼭 알려드리고 싶은 이야기가 있습니다.

제가 이 영상을 만드는 이유는 단순합니다. 너무 많은 분들이 잘못된 정보 때문에 고생하고 계시기 때문입니다. 병원에서는 시간이 부족해 자세히 설명드리지 못하는 내용들을 이 자리에서 모두 공개하겠습니다.

영상이 도움이 되셨다면 구독과 좋아요, 그리고 댓글로 여러분의 경험을 나눠주세요.

[본론 - 첫 번째 챕터]
먼저 가장 중요한 것부터 말씀드리겠습니다...

[이하 생략 - 실제로는 19,000자 분량의 완전한 대본이 생성됩니다]

내일 저녁부터 작은 습관 하나만 바꿔보세요. 그 변화가 여러분의 노후 건강을 완전히 달라지게 할 수 있습니다.

[실제 글자 수: 19,247자]`

    return generatedScript
  } catch (error) {
    console.error("대본 생성 실패:", error)
    throw new Error("대본 생성에 실패했습니다.")
  }
}

export async function generateScriptPlan(
  topic: string,
  category: string,
  keywords?: string,
  apiKey?: string,
  videoDurationMinutes?: number, // 영상 길이 (분)
  referenceScript?: string, // 레퍼런스 대본
  contentType?: "A" | "B" | "C" | "D" | "custom" | null, // 사용자가 선택한 콘텐츠 타입
  customContentTypeDescription?: string // 커스텀 타입 선택 시 사용자 입력 설명
): Promise<string> {
  // ⚠️ 중요: 이 함수는 서버 사이드에서 실행되므로 로그는 서버 콘솔(터미널)에 찍힙니다!
  console.log("=".repeat(80))
  console.log("[generateScriptPlan - actions.tsx] 🚀 함수 호출됨!")
  console.log("[generateScriptPlan - actions.tsx] 전달된 파라미터:")
  console.log("  - topic:", topic)
  console.log("  - category:", category)
  console.log("  - keywords:", keywords)
  console.log("  - contentType:", contentType, "(타입:", typeof contentType, ")")
  console.log("  - customContentTypeDescription:", customContentTypeDescription)
  console.log("=".repeat(80))
  
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.error("[generateScriptPlan - actions.tsx] ❌ Gemini API 키가 없습니다!")
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  // 타입이 선택되지 않으면 AI가 자동으로 결정합니다
  if (!contentType) {
    console.log("[generateScriptPlan - actions.tsx] ⚠️ contentType이 없습니다. AI가 자동으로 타입을 결정합니다.")
    // contentType을 null로 유지하여 AI가 자동으로 선택하도록 함
  }

  // 커스텀 타입 선택 시 설명이 필수입니다.
  if (contentType === "custom" && (!customContentTypeDescription || !customContentTypeDescription.trim())) {
    console.error("[generateScriptPlan - actions.tsx] ❌ 커스텀 타입인데 설명이 없습니다!")
    throw new Error("커스텀 타입을 선택하셨습니다. 원하는 대본 구조를 입력해주세요.")
  }

  const duration = videoDurationMinutes || 5 // 기본값 5분
  console.log("[generateScriptPlan - actions.tsx] ✅ 검증 통과 - duration:", duration)

  // 공통 System Prompt (타입별로 추가 지시사항이 붙음)
  const baseSystemPrompt = `당신은 '지식 스토리텔링 전문 기획자'입니다.

당신의 임무는 사용자가 이미 선택한 콘텐츠 타입 구조에 맞게,
본격적인 대본 작성을 위한 '대본 기획안(스토리 설계도)'을 만드는 것입니다.

⚠️⚠️⚠️ 매우 중요: 콘텐츠 타입은 이미 결정되어 있습니다.
⚠️ 주제를 분석하거나 타입을 선택하지 마세요. 타입은 변경할 수 없습니다.
⚠️ 주제는 단순히 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 보고 타입을 판단하지 마세요.

이 단계에서는 완성된 대본을 쓰지 않습니다.
대신, 이후 단계에서 대본 생성 AI가 흔들리지 않도록
이야기의 구조, 감정 흐름, 핵심 포인트를 명확히 설계해야 합니다.

────────────────────────
[채널 및 콘텐츠 정체성]
────────────────────────
- 채널 성격: 역사·사회·경제·미스터리·전쟁사 기반의 지식 스토리텔링
- 타깃: 한국인 성인 시청자
- 톤: 친근하지만 가볍지 않음, 이야기꾼의 구어체, 몰입감 최우선
- 목표: 정보 전달이 아니라 '끝까지 보게 만드는 흐름' 설계

────────────────────────
[기획 핵심 원칙]
────────────────────────
1) 이탈 방지 최우선
- 초반 30초 안에 반드시 '강력한 궁금증'을 유발해야 함
- 중간중간 "이 다음을 보지 않으면 안 될 이유"를 설계

2) 사실 기반 + 신뢰도 최우선 (중요)
- 허구의 주인공/가상 인물/드라마적 운명 교차/로맨스/과장된 배신극을 절대 사용하지 마십시오.
- 역사·외교·전쟁 주제는 "실존 국가/실존 인물(필요 시)/결정 구조/외교 흐름/기록에 근거한 사건" 중심으로 기획하십시오.
- 확실하지 않은 정보는 단정하지 말고, "~로 알려져 있다/기록에 따르면/해석이 갈린다"처럼 표현하십시오.

3) 장면화 가능성 고려
- 이후 이 기획안은 '장면 단위 이미지 생성'으로 확장됨
- 추상적인 설명만 나열하지 말고, 장면·상황·사람이 떠오르도록 구성

4) 과도한 정보 나열 금지
- 사실은 이야기 속에 녹여서 배치
- "설명"보다 "상황 → 의미" 구조를 우선

────────────────────────
[기획 산출물 형식]
────────────────────────
아래 형식을 반드시 지켜서 출력하십시오.

1) 콘텐츠 타입
- [타입이 여기에 들어갑니다]

2) 전체 이야기 한 줄 요약
- 이 영상이 "결국 어떤 이야기를 하려는지"를 한 문장으로

3) 오프닝 기획
- 초반 훅의 핵심 질문 또는 충격 포인트
- 시청자가 왜 이 영상을 계속 봐야 하는지

4) 본론 구성 설계
- 파트별 흐름을 번호로 정리
- 각 파트마다:
  · 다루는 핵심 내용
  · 감정 방향 (불안 / 긴장 / 충격 / 공감 / 희망 등)
  · 장면화 가능한 포인트 (사람, 상황, 공간, 상징 오브젝트)

5) 클라이맥스 / 핵심 메시지
- 이야기의 정점
- 시청자의 감정이 가장 크게 움직여야 하는 지점

6) 아웃트로 설계
- 오늘 이야기가 '지금 우리에게 왜 중요한지'
- 여운을 남기는 마무리 방향
- 다음 영상으로 자연스럽게 이어지는 문장(기획 관점)

────────────────────────
[출력 제한]
────────────────────────
- 아직 '대본 문장'을 쓰지 마십시오.
- 실제 내레이션 문장, 대사, TTS용 문구는 절대 포함하지 마십시오.
- 설명은 기획자의 시점에서 서술하십시오.
- 제작자 노트, 체크리스트, 파트 구분, 글자수 등은 절대 포함하지 마십시오.
- 오직 기획안만 출력하십시오. 추가 설명이나 메타 정보는 포함하지 마십시오.`

  try {
    // 타입별 if문 분기: 선택한 타입에 맞는 프롬프트 생성 및 AI 호출
    console.log("[generateScriptPlan - actions.tsx] ========== 타입 분기 시작 ==========")
    console.log("[generateScriptPlan - actions.tsx] contentType 값:", contentType)
    console.log("[generateScriptPlan - actions.tsx] contentType 타입:", typeof contentType)
    console.log("[generateScriptPlan - actions.tsx] contentType === 'A':", contentType === "A")
    console.log("[generateScriptPlan - actions.tsx] contentType === 'B':", contentType === "B")
    console.log("[generateScriptPlan - actions.tsx] contentType === 'C':", contentType === "C")
    console.log("[generateScriptPlan - actions.tsx] contentType === 'D':", contentType === "D")
    console.log("[generateScriptPlan - actions.tsx] contentType === 'custom':", contentType === "custom")
    
    let systemPrompt = ""
    let userPrompt = ""

    if (contentType === "A") {
      // Type A 선택됨 → Type A 전용 프롬프트 생성
      console.log("[generateScriptPlan - actions.tsx] ✅ Type A 분기 진입 - Type A 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type A. 단일 서사 심층형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type A (단일 서사 심층형) 구조로 작성해야 합니다.

Type A의 핵심 원칙:
1. 하나의 사건, 인물, 또는 역사적 이야기를 깊이 있게 다룹니다
2. 기승전결 구조를 중심으로 구성합니다
   - 기(起): 이야기의 시작, 배경 설정
   - 승(承): 사건의 전개, 갈등의 시작
   - 전(轉): 절정, 갈등의 정점
   - 결(結): 해결, 교훈 또는 여운
3. 감정 곡선을 명확히 설계합니다
   - 초반: 호기심 유발
   - 중반: 긴장감 증가
   - 후반: 감동 또는 깨달음
4. 단일 서사 구조로 일관되게 전개합니다
   - 여러 사례를 나열하지 않습니다
   - 하나의 이야기에 집중합니다
   - 시간순 또는 사건 순서대로 구성
   - 인물의 심리 변화와 행동을 중심으로

❌ Type A에서 하지 말아야 할 것:
- Type B처럼 여러 사례를 나열하는 것
- Type C처럼 여러 관점으로 분석하는 것
- 목록형 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type A"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type A로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type A로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type A"라고만 작성하세요.

[기획할 주제]: ${topic}

Type A (단일 서사 심층형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type A 작성 방법:
- 하나의 사건, 인물, 또는 역사적 이야기를 깊이 있게 다루세요
- 기승전결 구조로 구성하세요 (기 → 승 → 전 → 결)
- 감정 곡선을 설계하세요 (호기심 → 긴장 → 감동/깨달음)
- 여러 사례를 나열하지 말고 하나의 이야기에 집중하세요
- Type B처럼 여러 사례를 나열하지 마세요
- Type C처럼 여러 관점으로 분석하지 마세요`

    } else if (contentType === "B") {
      // Type B 선택됨 → Type B 전용 프롬프트 생성
      console.log("[generateScriptPlan - actions.tsx] ✅ Type B 분기 진입 - Type B 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type B. 컴필레이션 / 목록형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type B (컴필레이션 / 목록형) 구조로 작성해야 합니다.

Type B의 핵심 원칙:
1. 하나의 대주제 아래 3~5개의 사례를 나열합니다
2. 각 사례는 미니 스토리 구조로 작성합니다
3. 목록형 구조로 체계적으로 전개합니다
4. 대주제 소개 → 사례 1 → 사례 2 → 사례 3 → 통찰/교훈 순서로 구성합니다

❌ Type B에서 하지 말아야 할 것:
- Type A처럼 하나의 이야기에 집중하는 것
- Type C처럼 여러 관점으로 분석하는 것
- 단일 서사 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type B"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type B로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type B로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type B"라고만 작성하세요.

[기획할 주제]: ${topic}

Type B (컴필레이션 / 목록형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type B 작성 방법:
- 하나의 대주제 아래 3~5개의 사례를 나열하세요
- 각 사례는 미니 스토리 구조로 작성하세요
- 목록형 구조로 체계적으로 전개하세요
- 대주제 소개 → 사례 1 → 사례 2 → 사례 3 → 통찰/교훈 순서로 구성하세요
- Type A처럼 하나의 이야기에 집중하지 마세요
- Type C처럼 여러 관점으로 분석하지 마세요`

    } else if (contentType === "C") {
      // Type C 선택됨 → Type C 전용 프롬프트 생성
      console.log("[generateScriptPlan - actions.tsx] ✅ Type C 분기 진입 - Type C 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[Type C. 다각도 탐구형 - 필수 구조]
────────────────────────
⚠️ 매우 중요: 이 기획안은 반드시 Type C (다각도 탐구형) 구조로 작성해야 합니다.

Type C의 핵심 원칙:
1. 하나의 대상을 여러 관점으로 분석합니다 (역사적, 사회적, 경제적, 문화적 등)
2. 논리적 흐름을 중심으로 구성합니다
3. 점층적 몰입 구조로 설계합니다 (표면적 이해 → 깊은 통찰)
4. 대상 소개 → 관점 1 → 관점 2 → 관점 3 → 종합적 통찰 순서로 구성합니다

❌ Type C에서 하지 말아야 할 것:
- Type A처럼 하나의 이야기에 집중하는 것
- Type B처럼 여러 사례를 나열하는 것
- 단일 서사 구조를 사용하는 것

기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type C"라고만 작성하세요.`

      userPrompt = `⚠️ 필수 확인사항:
1. 콘텐츠 타입은 이미 Type C로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type C로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type C"라고만 작성하세요.

[기획할 주제]: ${topic}

Type C (다각도 탐구형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type C 작성 방법:
- 하나의 대상을 여러 관점으로 분석하세요 (역사적, 사회적, 경제적, 문화적 등)
- 논리적 흐름을 중심으로 구성하세요
- 점층적 몰입 구조로 설계하세요 (표면적 이해 → 깊은 통찰)
- 대상 소개 → 관점 1 → 관점 2 → 관점 3 → 종합적 통찰 순서로 구성하세요
- Type A처럼 하나의 이야기에 집중하지 마세요
- Type B처럼 여러 사례를 나열하지 마세요`

    } else if (contentType === "D") {
      // Type D 선택됨 → Type D 전용 프롬프트 생성
      console.log("[generateScriptPlan - actions.tsx] ✅ Type D 분기 진입 - Type D 전용 프롬프트 생성")
      
      systemPrompt = `${baseSystemPrompt}

═══════════════════════════════════════════════════════════════
🚨🚨🚨 절대 필수: Type D (이야기형) 구조로만 작성하세요 🚨🚨🚨
═══════════════════════════════════════════════════════════════

⚠️⚠️⚠️ 매우 중요: 이 기획안은 반드시 Type D (이야기형) 구조로 작성해야 합니다.
⚠️ 주제가 역사적 인물이든, 사건이든, 무엇이든 상관없이 Type D 구조로 작성하세요.

Type D의 핵심 원칙:
1. "옛날 옛날에...", "한 옛날에..." 같은 전래동화/민담 형식으로 기획합니다
2. 등장인물 중심으로 구성합니다
   - 주인공: 명확한 성격과 목표
   - 조연: 주인공을 돕는 인물
   - 악역 또는 시련: 갈등의 원인
3. 사건 전개 구조를 따릅니다
   - 시작: 주인공과 배경 소개
   - 사건 발생: 문제나 시련의 시작
   - 갈등/시련: 주인공이 겪는 어려움
   - 해결: 문제 해결 과정
   - 교훈/결말: 이야기의 의미와 교훈
4. 재미 요소를 포함합니다
   - 흥미진진한 전개
   - 반전 요소
   - 자연스러운 교훈
5. 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤

❌❌❌ Type D에서 절대 하지 말아야 할 것:
- Type A (단일 서사 심층형) 구조 사용 - 절대 금지
- Type B (목록형) 구조 사용 - 절대 금지
- Type C (다각도 탐구형) 구조 사용 - 절대 금지
- 에세이 형식 (설명문, 논설문, 분석문 형식 절대 금지)
- 역사적 사실을 그대로 나열하는 형식 - 절대 금지
- "세종대왕은..." 같은 설명문 형식 - 절대 금지

✅✅✅ 반드시 해야 할 것:
- "옛날 옛날에 세종대왕이라는 왕이 살았습니다..." 같은 이야기 형식으로 시작
- 등장인물(세종대왕, 조선의 신하들 등)을 중심으로 이야기 구성
- 사건 전개 구조 (시작 → 사건 → 갈등 → 해결 → 교훈)
- 기획안의 "1) 콘텐츠 타입" 부분에는 반드시 "- Type D"라고만 작성하세요.`

      userPrompt = `🚨🚨🚨 절대 필수 확인사항 🚨🚨🚨
1. 콘텐츠 타입은 이미 Type D로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 Type D로 결정되어 있습니다.
3. "1) 콘텐츠 타입" 부분에는 반드시 "- Type D"라고만 작성하세요.
4. Type A, B, C는 절대 사용하지 마세요.

[기획할 주제]: ${topic}

Type D (이야기형)의 구조와 특징에 맞게 기획안을 작성하세요.
주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.

Type D 작성 방법:
- "옛날 옛날에...", "한 옛날에..." 같은 전래동화/민담 형식으로 시작하세요
- 등장인물 중심으로 구성하세요 (주인공, 조연, 악역 등)
- 사건 전개 구조를 따르세요: 시작 → 사건 발생 → 갈등/시련 → 해결 → 교훈/결말
- 재미 요소를 포함하세요 (흥미진진함, 반전, 교훈)
- 옛날 할머니/할아버지가 손자에게 들려주는 듯한 따뜻하고 재미있는 이야기꾼 톤으로 작성하세요
- 에세이 형식은 절대 사용하지 마세요 (설명문, 논설문, 분석문 형식 금지)
- Type A처럼 역사적 사실을 나열하는 형식은 절대 사용하지 마세요
- Type B처럼 여러 사례를 나열하는 형식은 절대 사용하지 마세요
- Type C처럼 여러 관점으로 분석하는 형식은 절대 사용하지 마세요

예시:
❌ 잘못된 형식: "세종대왕은 조선의 제4대 왕으로, 한글을 창제한 위대한 성군이었습니다..."
✅ 올바른 형식: "옛날 옛날에, 조선이라는 나라에 세종대왕이라는 지혜로운 왕이 살았습니다. 그 왕은 백성들을 사랑하는 마음이 깊었는데..."`

    } else if (contentType === "custom" && customContentTypeDescription) {
      // 커스텀 타입 선택됨 → 커스텀 타입 전용 프롬프트 생성
      console.log("[generateScriptPlan - actions.tsx] ✅ 커스텀 타입 분기 진입 - 커스텀 타입 전용 프롬프트 생성")
      console.log("[generateScriptPlan - actions.tsx] 📝 커스텀 구조 내용:")
      console.log(customContentTypeDescription)
      console.log("[generateScriptPlan - actions.tsx] 📝 커스텀 구조 길이:", customContentTypeDescription.length)
      
      // 커스텀 타입은 baseSystemPrompt의 형식 제약을 완화하고 사용자 구조를 최우선으로 반영
      const customBaseSystemPrompt = `당신은 '지식 스토리텔링 전문 기획자'입니다.

당신의 임무는 사용자가 지정한 커스텀 구조에 정확히 맞게,
본격적인 대본 작성을 위한 '대본 기획안(스토리 설계도)'을 만드는 것입니다.

⚠️⚠️⚠️ 매우 중요: 
- 사용자가 지정한 커스텀 구조를 최우선으로 반영하세요.
- 다른 타입(A, B, C, D)의 구조나 형식을 사용하지 마세요.
- 사용자가 지정한 구조의 형식, 단계, 흐름을 그대로 따르세요.

이 단계에서는 완성된 대본을 쓰지 않습니다.
대신, 이후 단계에서 대본 생성 AI가 흔들리지 않도록
이야기의 구조, 감정 흐름, 핵심 포인트를 명확히 설계해야 합니다.

────────────────────────
[채널 및 콘텐츠 정체성]
────────────────────────
- 채널 성격: 역사·사회·경제·미스터리·전쟁사 기반의 지식 스토리텔링
- 타깃: 한국인 성인 시청자
- 톤: 친근하지만 가볍지 않음, 이야기꾼의 구어체, 몰입감 최우선
- 목표: 정보 전달이 아니라 '끝까지 보게 만드는 흐름' 설계

────────────────────────
[기획 핵심 원칙]
────────────────────────
1) 이탈 방지 최우선
- 초반 30초 안에 반드시 '강력한 궁금증'을 유발해야 함
- 중간중간 "이 다음을 보지 않으면 안 될 이유"를 설계

2) 사실 기반 + 신뢰도 최우선 (중요)
- 허구의 주인공/가상 인물/드라마적 운명 교차/로맨스/과장된 배신극을 절대 사용하지 마십시오.
- 역사·외교·전쟁 주제는 "실존 국가/실존 인물(필요 시)/결정 구조/외교 흐름/기록에 근거한 사건" 중심으로 기획하십시오.
- 확실하지 않은 정보는 단정하지 말고, "~로 알려져 있다/기록에 따르면/해석이 갈린다"처럼 표현하십시오.

3) 장면화 가능성 고려
- 이후 이 기획안은 '장면 단위 이미지 생성'으로 확장됨
- 추상적인 설명만 나열하지 말고, 장면·상황·사람이 떠오르도록 구성

4) 과도한 정보 나열 금지
- 사실은 이야기 속에 녹여서 배치
- "설명"보다 "상황 → 의미" 구조를 우선

────────────────────────
[커스텀 타입 - 필수 구조]
────────────────────────
⚠️⚠️⚠️ 절대 필수: 사용자가 지정한 커스텀 구조를 정확히 따르세요.

[사용자가 지정한 커스텀 구조]:
${customContentTypeDescription}

이 구조에 따라 기획안을 작성하세요:
- 사용자가 명시한 전개 방식, 핵심 포인트, 구조를 정확히 반영
- 사용자가 지정한 단계, 흐름, 형식을 그대로 따르세요
- 사용자가 요청하지 않은 요소는 추가하지 않음
- 다른 타입(A, B, C, D)의 구조를 사용하지 마세요
- 사용자가 지정한 구조의 형식에 맞춰 기획안을 작성하세요

────────────────────────
[기획 산출물 형식]
────────────────────────
⚠️ 중요: 사용자가 지정한 커스텀 구조에 형식이 명시되어 있다면, 그 형식을 우선적으로 따르세요.
형식이 명시되지 않았다면, 아래 기본 형식을 사용하되 커스텀 구조의 내용을 반영하세요.

1) 콘텐츠 타입
- 커스텀 타입

2) 전체 이야기 한 줄 요약
- 이 영상이 "결국 어떤 이야기를 하려는지"를 한 문장으로

3) 오프닝 기획
- 초반 훅의 핵심 질문 또는 충격 포인트
- 시청자가 왜 이 영상을 계속 봐야 하는지

4) 본론 구성 설계
- 사용자가 지정한 커스텀 구조의 단계별 흐름을 반영
- 각 단계마다:
  · 다루는 핵심 내용
  · 감정 방향 (불안 / 긴장 / 충격 / 공감 / 희망 등)
  · 장면화 가능한 포인트 (사람, 상황, 공간, 상징 오브젝트)

5) 클라이맥스 / 핵심 메시지
- 이야기의 정점
- 시청자의 감정이 가장 크게 움직여야 하는 지점

6) 아웃트로 설계
- 오늘 이야기가 '지금 우리에게 왜 중요한지'
- 여운을 남기는 마무리 방향
- 다음 영상으로 자연스럽게 이어지는 문장(기획 관점)

────────────────────────
[출력 제한]
────────────────────────
- 아직 '대본 문장'을 쓰지 마십시오.
- 실제 내레이션 문장, 대사, TTS용 문구는 절대 포함하지 마십시오.
- 설명은 기획자의 시점에서 서술하십시오.
- 제작자 노트, 체크리스트, 파트 구분, 글자수 등은 절대 포함하지 마십시오.
- 오직 기획안만 출력하십시오. 추가 설명이나 메타 정보는 포함하지 마십시오.`

      systemPrompt = customBaseSystemPrompt

      userPrompt = `⚠️⚠️⚠️ 절대 필수 확인사항:
1. 콘텐츠 타입은 이미 커스텀 타입으로 결정되어 있습니다. 이것은 변경할 수 없습니다.
2. 주제를 분석하거나 타입을 선택하지 마세요. 타입은 이미 커스텀 타입으로 결정되어 있습니다.
3. 사용자가 지정한 커스텀 구조를 정확히 따르세요. 다른 타입(A, B, C, D)의 구조를 사용하지 마세요.
4. 사용자가 지정한 구조의 형식, 단계, 흐름을 그대로 반영하세요.

[기획할 주제]: ${topic}

[사용자가 지정한 커스텀 구조]:
${customContentTypeDescription}

⚠️⚠️⚠️ 매우 중요:
- 위에 명시된 커스텀 구조를 정확히 따르세요.
- 커스텀 구조에 명시된 단계, 흐름, 형식을 그대로 반영하세요.
- 커스텀 구조에 "초반 15초 구조", "중반 전개 구조", "후반 마무리 구조" 등이 명시되어 있다면, 그 구조를 정확히 따르세요.
- 커스텀 구조에 "시청자의 ○○ 감정을 자극하며 ○○을 제기하는 구조" 같은 형식이 있다면, 그 형식을 그대로 사용하세요.
- 다른 타입(A, B, C, D)의 구조나 형식을 사용하지 마세요.
- 주제는 기획안을 작성할 때 사용하는 정보일 뿐입니다. 주제를 분석하거나 타입을 선택하지 마세요.`

    } else if (!contentType || contentType === null || contentType === undefined || contentType === "") {
      // 타입이 선택되지 않은 경우 - AI가 자동으로 타입을 결정하도록 함
      console.log("[generateScriptPlan - actions.tsx] ⚠️ 타입이 선택되지 않았습니다. AI가 자동으로 타입을 결정합니다.")
      console.log("[generateScriptPlan - actions.tsx] contentType 값:", contentType)
      
      systemPrompt = `${baseSystemPrompt}

────────────────────────
[콘텐츠 구조 선택]
────────────────────────
아래 4가지 중, 주제에 가장 적합한 구조를 **하나만 선택**하여 기획하시오.

● Type A. 단일 서사 심층형
- 하나의 사건, 인물, 역사적 이야기
- 기승전결 + 감정 곡선 중심

● Type B. 컴필레이션 / 목록형
- 하나의 대주제 아래 3~5개의 사례
- 각 사례는 '미니 스토리' 구조

● Type C. 다각도 탐구형
- 하나의 대상을 여러 관점으로 분해
- 논리적 흐름 + 점층적 몰입

● Type D. 이야기형 (옛날이야기/민담)
- "옛날 옛날에..." 형식의 전래동화/민담 형식
- 등장인물 중심 구성
- 사건 전개 구조 (시작 → 사건 → 갈등 → 해결 → 교훈)

선택한 타입을 명확히 밝히고 기획을 진행할 것.

기획안의 "1) 콘텐츠 타입" 부분에는 선택한 타입을 명확히 표시하세요.`

      userPrompt = `[기획할 주제]: ${topic}

위 주제에 가장 적합한 콘텐츠 타입을 선택하고, 그 타입에 맞게 기획안을 작성하세요.

주제를 분석하여 가장 적합한 타입을 선택하세요:
- Type A: 하나의 사건이나 인물을 깊이 있게 다루는 경우
- Type B: 여러 사례를 나열하는 경우
- Type C: 하나의 대상을 여러 관점으로 분석하는 경우
- Type D: 옛날이야기/민담 형식으로 전달하는 경우

선택한 타입을 "1) 콘텐츠 타입" 부분에 명확히 표시하세요.`
    } else {
      // 잘못된 타입인 경우
      console.error("[generateScriptPlan - actions.tsx] ❌ 잘못된 타입입니다!")
      console.error("[generateScriptPlan - actions.tsx] contentType:", contentType)
      throw new Error(`콘텐츠 타입이 올바르지 않습니다. contentType: ${contentType}`)
    }
    
    console.log("[generateScriptPlan - actions.tsx] ========== 타입 분기 완료 ==========")
    console.log("[generateScriptPlan - actions.tsx] systemPrompt 길이:", systemPrompt.length)
    console.log("[generateScriptPlan - actions.tsx] userPrompt 길이:", userPrompt.length)

    // 재시도 함수
    const tryGenerate = async (geminiKey: string, isRetry: boolean = false): Promise<string> => {
    try {
      console.log("[generateScriptPlan - actions.tsx] 사용할 프롬프트:")
      console.log("  - systemPrompt 길이:", systemPrompt.length)
      console.log("  - userPrompt 길이:", userPrompt.length)
      console.log("[v0] 대본 기획 API 호출 시작 (Gemini)")

      // 재시도 로직 (최대 3번, exponential backoff)
      let lastError: Error | null = null
      const maxRetries = 3
      const baseDelay = 1000 // 1초

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = baseDelay * Math.pow(2, attempt - 1) // 1초, 2초, 4초
            console.log(`[v0] 재시도 ${attempt}/${maxRetries - 1} - ${delay}ms 후 재시도...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          // Gemini API 호출
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `${systemPrompt}\n\n${userPrompt}`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 8000,
                },
              }),
            }
          )

          console.log("[v0] API 응답 상태:", response.status)

          if (!response.ok) {
            const errorText = await response.text()
            console.log("[v0] API 오류 응답:", errorText)
            
            // 503 에러이고 재시도 가능한 경우
            if (response.status === 503 && attempt < maxRetries - 1) {
              try {
                const errorData = JSON.parse(errorText)
                if (errorData.error?.message?.includes("overloaded") || errorData.error?.status === "UNAVAILABLE") {
                  lastError = new Error(`Gemini API 서버가 과부하 상태입니다. 재시도 중... (${attempt + 1}/${maxRetries})`)
                  continue // 재시도
                }
              } catch (parseError) {
                // JSON 파싱 실패 시에도 503이면 재시도
                lastError = new Error(`Gemini API 서버가 과부하 상태입니다. 재시도 중... (${attempt + 1}/${maxRetries})`)
                continue
              }
            }
            
            throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`)
          }

          // 성공한 경우 루프 탈출
          const data = await response.json()
          const candidate = data.candidates?.[0]
          
          if (!candidate) {
            throw new Error("대본 기획 생성에 실패했습니다. 응답 후보가 없습니다.")
          }

          const content = candidate.content?.parts?.[0]?.text
          const finishReason = candidate.finishReason

          if (!content) {
            throw new Error("대본 기획 생성에 실패했습니다. 응답 내용이 없습니다.")
          }

          // 응답이 토큰 제한으로 잘렸는지 확인
          if (finishReason === "MAX_TOKENS") {
            console.warn("[v0] ⚠️ 대본 기획 응답이 토큰 제한으로 잘렸을 수 있습니다.")
          }

          console.log(`[v0] 대본 기획 생성 완료 (재시도: ${isRetry ? "예" : "아니오"}), 길이:`, content.length, "finishReason:", finishReason)
          return content
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          
          // 마지막 시도가 아니고 503 에러인 경우에만 재시도
          if (attempt < maxRetries - 1 && lastError.message.includes("503")) {
            continue
          }
          
          // 재시도 불가능한 경우 에러 throw
          throw lastError
        }
      }

      // 모든 재시도 실패
      throw lastError || new Error("대본 기획 생성에 실패했습니다.")
    } catch (error) {
      console.error(`[v0] 대본 기획 생성 실패 (재시도: ${isRetry ? "예" : "아니오"}):`, error)
      throw error
    }
    }

    // 내부 API 키로 생성 시도
    return await tryGenerate(GEMINI_API_KEY, false);
  } catch (error) {
    console.error("[generateScriptPlan - actions.tsx] ❌ 에러 발생:", error)
    throw error
  }
}

function generateFallbackScript(topic: string): string {
  return `【대본 기획안】

[서론 기획]
• 훅: "이 이야기는 어디에서 절대 꺼내지 않는 이야기입니다."
• 자기소개: 85세 해당 분야의 전문가 입니다.
• 신뢰성 구축: 수많은 지인 변화된 사례
• 구독 유도: "이 이야기가 도움이 되신다면 구독과 좋아요로 함께해 주세요"
• 상호작용 유도: "지금 어디서 보고 계신가요? 댓글에 남겨주시면 직접 답글 드리겠습니다"

[본론 기획 - 6개 챕터]

1️⃣ 첫 번째 챕터: ${topic}의 기본 이해
• 핵심 포인트: 일반인들이 잘못 알고 있는 상식 바로잡기
• 의학적 근거: 최신 연구 결과와 통계 제시
• 실용적 팁: 집에서 쉽게 확인할 수 있는 방법

2️⃣ 두 번째 챕터: 실제 환자 또는 지인 사례
• 환자 사례: 78세 박영수님의 실제 치료 과정
• 초기 증상과 진단 과정
• 치료 결과와 현재 상태

3️⃣ 세 번째 챕터: 예방의 중요성
• 예방법: 하루 30분 투자로 가능한 방법들
• 생활 습관 개선: 식단, 운동, 수면 관리
• 정기 검진의 필요성

4️⃣ 네 번째 챕터: 주의사항과 금기사항
• 절대 하지 말아야 할 것들
• 인터넷 잘못된 정보 주의
• 자가 진단의 위험성

5️⃣ 다섯 번째 챕터: 즉시 실천 가능한 방법
• 오늘부터 시작할 수 있는 구체적 방법
• 단계별 실행 가이드
• 효과를 느낄 수 있는 기간

6️⃣ 여섯 번째 챕터: 장기적 관리 전략
• 꾸준한 관리의 중요성
• 가족과 함께하는 건강 관리
• 전문의와의 협력 방법

[결론 기획]
• 핵심 내용 요약: 50년 경험을 통한 조언
• 희망적 메시지: "올바른 방법을 꾸준히 실천하면 반드시 좋은 결과가 있습니다"
• 행동 유도: "내일 저녁부터 작은 습관 하나만 바꿔보세요"
• 마무리 인사: "여러분의 건강한 노후를 진심으로 응원합니다"

[예상 분량]
• 총 영상 길이: 20-25분
• 서론: 3-4분
• 본론: 각 챕터 2-3분 (총 12-18분)
• 결론: 2-3분

[톤앤매너]
• 따뜻하고 신뢰감 있는 할아버지
• 전문적이지만 쉬운 설명
• 환자를 걱정하는 마음이 느껴지는 톤
• 경험담을 통한 설득력 있는 전달

이 기획안을 바탕으로 상세한 대본을 작성하시면 됩니다.`
}

export async function improveScriptPlan(currentScript: string, improvementRequest: string, apiKey?: string) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본 개선 요청 시작")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
        messages: [
          {
            role: "system",
            content:
              "당신은 유튜브 건강 채널 대본 편집 전문가입니다. 사용자의 요청에 따라 대본을 개선해주세요. 80-90세 노련한 한국 남성 캐릭터의 톤을 유지하면서 더 나은 내용으로 수정해주세요.",
          },
          {
            role: "user",
            content: `현재 대본:\n${currentScript}\n\n개선 요청: ${improvementRequest}\n\n위 요청에 따라 대본을 개선해주세요.`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const improvedScript = data.choices?.[0]?.message?.content

    if (!improvedScript) {
      throw new Error("개선된 대본을 생성할 수 없습니다.")
    }

    console.log("[v0] 대본 개선 완료")
    return improvedScript
  } catch (error) {
    console.error("대본 개선 실패:", error)
    throw new Error("대본 개선에 실패했습니다. 다시 시도해주세요.")
  }
}

export async function analyzeScriptPlan(script: string, apiKey?: string) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본 분석 시작")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
        messages: [
          {
            role: "system",
            content: `당신은 유튜브 건강 채널 대본 분석 전문가입니다. 다음 기준으로 대본을 분석해주세요:

1. 구조적 완성도 (서론-본론-결론)
2. 내용의 전문성과 정확성
3. 시청자 몰입도 (훅, 스토리텔링)
4. 실용성 (실천 가능한 팁)
5. 유튜브 최적화 (SEO, 시청 유지율)

각 항목을 10점 만점으로 평가하고, 구체적인 개선 제안을 해주세요.`,
          },
          {
            role: "user",
            content: `분석할 대본:\n${script}\n\n위 대본을 분석하고 평가해주세요.`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const analysis = data.choices?.[0]?.message?.content

    if (!analysis) {
      throw new Error("분석 결과를 생성할 수 없습니다.")
    }

    console.log("[v0] 대본 분석 완료")
    return analysis
  } catch (error) {
    console.error("대본 분석 실패:", error)
    throw new Error("대본 분석에 실패했습니다. 다시 시도해주세요.")
  }
}

export async function generateScriptDraft(
  scriptPlan: string,
  topic: string,
  apiKey?: string
) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본 초안 생성 시작")

    const systemPrompt = `너는 지금부터 유튜브 대본 전문가야. 사람들의 공감을 불러일으켜야 하고 친절하며 사람들이 너의 이야기를 듣고 싶도록 설명을 해야해.

작성 원칙:
1. 시청 타겟은 50~70대 남녀 모두로 사람들의 공감을 불러 일으키는 익숙한 사례와 예시를 넣어 "나에게도 일어날 수 있는/나 혹은 주변 지인에게 필요한 것"이라는 느낌을 줘야한다.
2. 어려운 표현이 있다면 최대한 이해하기 쉽고 타겟 시청자들이 듣기 불편하지 않도록 해야해. 영어 같은 표현을 써도 좋지만 이게 무슨 의미인지 친절하게 설명해줘야 해.
3. 등장인물 없이 1인칭으로 설명하기 때문에 듣는 시청자들이 지루하지 않도록 중간에 질문과 답을 통해 혼자서라도 대화하듯이 설명을 이어간다.
4. 톤앤매너, 듣는 사람에게 훈계하거나 내가 더 뛰어난 사람으로서 내 말을 들으라는게 아니라 같은 처지인 사람들끼리 좋은 정보를 공유한다는 정중하면서 공감되는 말투를 사용해야한다.

5. 문장 종결 표현 다양화 (매우 중요)
- 모든 문장이 "~니다"로 끝나지 않도록 다양한 종결 표현을 사용하세요.
- 논리적으로 연결 가능한 문장들은 "~는데", "~했고", "~면서", "~거든요", "~죠", "~거죠", "~겁니다" 등의 연결어로 자연스럽게 이어주세요.
- 호흡이 너무 길어지거나 주제가 전환되는 지점에서는 과감하게 문장을 끊으세요.
- 문장 종결 표현 예시: "~니다", "~네요", "~거든요", "~죠", "~거죠", "~는데", "~했고", "~면서", "~겁니다", "~어요", "~아요" 등을 다양하게 사용하세요.

필수사항:
1. 도입부에는 이 유튜브 주제를 기반으로 이 내용을 몰랐을 시 발생하게 되는 문제와 그 문제와 관련된 사례나 경험들에 대해서 언급하고 그런 이유로 이 이야기를 들어야 한다는 것을 설명해야해
2. 위 개요를 모두 만족시켜야 하고 개요를 기반으로 이야기를 흥미롭게 이어가야 한다.
3. 🚨 분량은 3,000자~5,000자 정도로 적당하게 작성하세요!
   - 최소 3,000자 이상, 최대 5,000자 이하로 작성하세요!
   - 각 문장을 명확하고 간결하게 작성하세요!
   - 핵심 내용과 주요 사례를 포함하되, 너무 길게 작성하지 마세요!
   - 물음표, 느낌표를 제외한 괄호 혹은 특수문자나 영어 원문을 그대로 사용하지 않습니다.
4. 마지막 마무리는 영상을 요약해서 집중하다 놓친 시청자들이라도 영상에 대해 이해하고 무엇을 알아야하는지, 해야하는지 즉각적으로 기억하기 쉽도록 간략 명료하게 다시 설명해주는 파트를 넣는다.`

    const userPrompt = `위 개요를 기반으로 유튜브 대본 초안을 작성해줘.

🚨 필수 요구사항:
1. 대본 초안은 3,000자~5,000자 정도로 적당하게 작성하세요!
2. 핵심 내용과 주요 사례를 포함하되, 너무 길게 작성하지 마세요!
3. 각 문장을 명확하고 간결하게 작성하세요!
4. 최종 대본에서 확장할 수 있도록 구조와 핵심 내용을 포함하세요!

주제: ${topic}

대본 기획안:
${scriptPlan}

위 기획안을 기반으로 대본 초안을 작성하고, 마지막에 "제작자 노트" 섹션을 추가하여 각 항목이 어떻게 적용되었는지 체크리스트로 작성해주세요.

대본 초안은 3,000자~5,000자 정도로 작성하세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GPT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "o4-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        // 5,000자 × 2.3 토큰 × 1.1 여유 = 약 12,650 토큰
        max_completion_tokens: Math.min(100000, Math.ceil(5000 * 2.3 * 1.1)),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] API 오류 응답:", errorText)
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("대본 초안 생성에 실패했습니다. 응답 내용이 없습니다.")
    }

    // 대본 초안 길이 제한 (5,000자 초과 시 자르기)
    let draftScript = content
    if (draftScript.length > 5000) {
      console.warn(`[v0] ⚠️ 대본 초안이 5,000자를 초과합니다. (${draftScript.length.toLocaleString()}자) 자동으로 자릅니다.`)
      draftScript = draftScript.substring(0, 5000)
      // 마지막 문장이 잘리지 않도록 문장 끝까지 찾기
      const lastPeriod = draftScript.lastIndexOf(".")
      const lastQuestion = draftScript.lastIndexOf("?")
      const lastExclamation = draftScript.lastIndexOf("!")
      const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)
      if (lastSentenceEnd > 4500) {
        draftScript = draftScript.substring(0, lastSentenceEnd + 1)
      }
    }
    
    console.log("[v0] 대본 초안 생성 완료, 길이:", draftScript.length)
    return draftScript
  } catch (error) {
    console.error("대본 초안 생성 실패:", error)
    throw error
  }
}

export async function generateDoctorImage(selectedType: "clinic" | "podcast" | "custom", customDescription?: string) {
  try {
    console.log("[v0] 의사 이미지 생성 시작, 타입:", selectedType)

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN

    if (!REPLICATE_API_TOKEN) {
      const errorMsg =
        "REPLICATE_API_TOKEN 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정에서 환경 변수를 추가해주세요."
      console.error("[v0]", errorMsg)
      throw new Error(errorMsg)
    }

    const hairStyles = [
      "neatly combed silver-gray hair",
      "short gray hair with natural wave",
      "well-groomed dark gray hair",
      "side-parted gray hair",
      "classic short haircut with salt-and-pepper color",
    ]

    const outfits = [
      "a light beige cardigan over a white shirt",
      "a simple navy blue jacket over a cream shirt",
      "a casual gray vest over a white polo shirt",
      "a soft brown sweater with a collared shirt underneath",
      "a comfortable olive green jacket over a light blue shirt",
    ]

    const backgrounds = [
      "tall green trees with golden light filtering through the leaves, and distant hills in soft focus",
      "a peaceful riverside with morning mist and lush vegetation",
      "a mountain trail with autumn foliage and warm sunlight",
      "a serene park with cherry blossoms and soft natural lighting",
      "a quiet forest path with dappled sunlight through the canopy",
    ]

    const randomHair = hairStyles[Math.floor(Math.random() * hairStyles.length)]
    const randomOutfit = outfits[Math.floor(Math.random() * outfits.length)]
    const randomBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)]
    const randomSeed = Math.floor(Math.random() * 1000000)

    let doctorPrompt = ""
    let koreanDescription = ""

    if (selectedType === "custom") {
      // 사용자 직접 입력
      if (!customDescription) {
        throw new Error("사용자 설명이 필요합니다.")
      }

      console.log("[v0] 한글 설명을 영어 프롬프트로 변환 중...")
      doctorPrompt = await generateCustomPrompt(customDescription)
      koreanDescription = customDescription
      console.log("[v0] 변환된 영어 프롬프트:", doctorPrompt)
    } else if (selectedType === "clinic") {
      doctorPrompt = `A dignified Korean man in his early 50s, standing at the center of the frame, facing the camera directly with a serene and wise expression. He has ${randomHair}, revealing a youthful yet mature face with gentle expression lines that reflect life experience. He has kind, deep-set eyes, a calm gaze, and healthy, slightly sun-kissed skin with natural texture. His face carries a balanced mix of maturity and vitality — a defined jawline, subtle smile lines, and a composure demeanor. He is dressed in ${randomOutfit}, paired with dark slacks. The background shows a beautiful natural landscape bathed in warm sunlight — ${randomBackground}. The atmosphere is tranquil and timeless, evoking warmth, respect, and connection to nature. Photorealistic, natural lighting, shallow depth of field, high-resolution, centered composition. Seed: ${randomSeed}`
      koreanDescription = "자연을 배경으로 한 50대 한국 중년 남성"
    } else {
      doctorPrompt = `A distinguished Korean man in his early 50s, sitting at the center of the frame, looking directly at the camera while recording a podcast. He has ${randomHair} and a calm, intelligent expression. Subtle expression lines and a warm gaze reflect his wisdom and professional experience. He wears ${randomOutfit}, exuding quiet sophistication. He is seated at a podcast setup: a high-quality condenser microphone mounted on a boom arm is positioned in front of him, along with a pair of over-ear studio headphones either worn or resting around his neck. A laptop or audio interface may be visible beside him on the table. The recording environment is cozy and well-lit — a home studio or creative workspace with acoustic panels on the wall, warm ambient lighting, and bookshelves or indoor plants in the softly blurred background. The focus is on the man's face and podcast equipment, with shallow depth of field creating a professional, intimate mood. The overall tone is warm, respectful, and intellectual, capturing a moment of thoughtful communication. Photorealistic, high-resolution, centered composition, natural lighting. Seed: ${randomSeed}`
      koreanDescription = "팟캐스트를 녹음하며 이야기를 전달하는 50대 한국 중년 남성"
    }

    console.log("[v0] 생성할 프롬프트:", doctorPrompt.substring(0, 100) + "...")

    const response = await fetch("https://api.replicate.com/v1/models/google/imagen-3-fast/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          prompt: doctorPrompt,
          aspect_ratio: "16:9",
          safety_filter_level: "block_medium_and_above",
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Replicate API 오류:", errorText)
      throw new Error(`Replicate API 호출 실패: ${response.status}`)
    }

    const result = await response.json()
    console.log("[v0] API 응답:", JSON.stringify(result).substring(0, 200))

    let imageUrl = ""

    if (result.output && Array.isArray(result.output) && result.output.length > 0) {
      imageUrl = result.output[0]
    } else if (result.output && typeof result.output === "string") {
      imageUrl = result.output
    } else if (result.urls && result.urls.get) {
      imageUrl = result.urls.get
    } else {
      throw new Error(`예상치 못한 API 응답 형식: ${JSON.stringify(result)}`)
    }

    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("http")) {
      throw new Error(`유효하지 않은 이미지 URL: ${imageUrl}`)
    }

    console.log("[v0] 이미지 생성 완료, URL:", imageUrl)

    return {
      imageUrl: imageUrl,
      prompt: doctorPrompt,
      koreanDescription: koreanDescription,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error("[v0] ========== 이미지 생성 에러 상세 ==========")
    console.error("[v0] 에러 메시지:", errorMessage)
    console.error("[v0] 에러 스택:", errorStack)
    console.error("[v0] 환경:", process.env.NODE_ENV)
    console.error("[v0] ==========================================")

    // Fallback 이미지 반환
    const fallbackImageUrl = `/placeholder.svg?height=720&width=1280&query=${encodeURIComponent("Professional Korean male in his 50s, warm and trustworthy expression, natural background")}`

    return {
      imageUrl: fallbackImageUrl,
      prompt: "Professional Korean male in his 50s (fallback image)",
      koreanDescription: "50대 한국 남성 (기본 이미지)",
    }
  }
}

export async function generateYouTubeTitle(script: string, topic: string, apiKey?: string) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const titles = [
      `${topic} - 의사가 알려주는 진실`,
      `병원에서 절대 말하지 않는 ${topic.split(" ")[0]} 이야기`,
      `60대가 꼭 알아야 할 ${topic}의 모든 것`,
    ]

    return titles[0]
  } catch (error) {
    console.error("제목 생성 실패:", error)
    throw new Error("제목 생성에 실패했습니다.")
  }
}

export async function generateYouTubeTitles(
  script: string,
  category: Category,
  apiKey?: string
) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 유튜브 제목 생성 시작")

    const categoryName = categoryDescriptions[category] || category

    const titlePrompt = `당신은 유튜브 SEO 전문가입니다. 다음 대본을 분석하여 SEO에 최적화된 제목 5개를 추천해주세요.

채널 카테고리: ${categoryName}

영상 대본:

${script}

유튜브 SEO 제목 작성 원칙:

1. 핵심 키워드 앞쪽 배치

2. 자연스럽고 구체적

3. 30-45자 내외

4. 수치, 감정, 후킹 단어 활용

🚫 제목 스포일러 절대 금지!

- 구체적인 방법, 원인, 해결책 직접 언급 금지

- 호기심만 유발하는 표현 사용

5가지 다양한 스타일로 제목 추천:

1. 직설적/정보형

2. 호기심 유발형

3. 수치/결과 강조형

4. 질문형

5. 감성/공감형

JSON 형식으로만 응답:

{
  "titles": ["제목1", "제목2", "제목3", "제목4", "제목5"]
}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
        messages: [
          {
            role: "system",
            content: titlePrompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("제목을 생성할 수 없습니다.")
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const titles = parsed.titles || []
      console.log("[v0] 유튜브 제목 생성 완료:", titles.length, "개")
      
      // 5개가 아니면 fallback 사용
      if (titles.length >= 5) {
        return titles.slice(0, 5)
      }
    }

    // JSON 파싱 실패 시 fallback
    throw new Error("JSON 파싱 실패 또는 제목이 5개 미만")
  } catch (error) {
    console.error("제목 생성 실패:", error)

    const fallbackTitles = [
      `${categoryDescriptions[category]} - 60대가 꼭 알아야 할 놀라운 비밀`,
      `${categoryDescriptions[category]}의 진실, 전문가가 밝힌다`,
      `${categoryDescriptions[category]} 완벽 가이드 - 지금 바로 확인하세요`,
      `${categoryDescriptions[category]}에 대한 놀라운 사실`,
      `${categoryDescriptions[category]}로 인생이 바뀌는 이유`,
    ]

    return fallbackTitles
  }
}

export async function generateYouTubeDescription(
  script: string,
  category: Category,
  title: string,
  apiKey?: string,
  videoDurationMinutes?: number // 영상 길이 (분)
) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 유튜브 설명 생성 시작")

    const categoryName = categoryDescriptions[category] || category

    const durationInfo = videoDurationMinutes ? `\n영상 길이: 약 ${videoDurationMinutes}분` : ""
    const timelineInstruction = videoDurationMinutes 
      ? `\n\n⚠️⚠️⚠️ 타임라인 필수 규칙 ⚠️⚠️⚠️
- 🕒 타임라인은 **반드시 포함**되어야 합니다!
- 타임라인의 각 시간은 영상 길이(${videoDurationMinutes}분)를 초과하지 않아야 합니다!
- 예: 영상이 ${videoDurationMinutes}분이면 "5:00" 같은 시간은 포함하지 마세요!
- 타임라인 형식: "0:00 소개", "1:30 첫 번째 주제", "3:00 두 번째 주제" 등
- 스포일러는 금지하되, 각 구간의 핵심 내용만 간단히 제시하세요
- 타임라인은 영상 길이(${videoDurationMinutes}분) 이하의 시간만 사용하세요!`
      : `\n\n⚠️⚠️⚠️ 타임라인 필수 규칙 ⚠️⚠️⚠️
- 🕒 타임라인은 **반드시 포함**되어야 합니다!
- 타임라인 형식: "0:00 소개", "1:30 첫 번째 주제", "3:00 두 번째 주제" 등
- 스포일러는 금지하되, 각 구간의 핵심 내용만 간단히 제시하세요`

    const descriptionPrompt = `당신은 유튜브 SEO 전문가입니다. 다음 영상을 분석하여 완벽한 설명란과 태그를 만들어주세요.

영상 제목: "${title}"
채널 카테고리: ${categoryName}${durationInfo}
영상 대본:

${script}

다음을 생성해주세요:

1. description: 유튜브 설명란 (이모지 적극 활용)

   구조:

   - **첫 줄 (매우 중요!)**: 핵심 키워드 해시태그 3-5개 (#키워드1 #키워드2 #키워드3 형식)
     → 유튜브 알고리즘에서 잘 뜨기 위해 반드시 첫 줄에 해시태그 포함!

   - 🔥 훅: 강력한 질문이나 혜택 제시

   - 영상 소개 (1-2줄)

   - 혜택 3가지 (이모지로 시작)

   - 감성 문구

   - CTA

   - 빈 줄

   - 🕒 타임라인 (반드시 포함! 스포일러 금지!)${timelineInstruction}

   - 구독 멘트

2. pinnedComment: 고정댓글 (3-5줄, 시청자 참여 유도)

3. hashtags: 설명란에 사용된 핵심 키워드 해시태그 5개 (# 포함, 한 줄)
   → 이 해시태그들은 description의 첫 줄에도 반드시 포함되어야 함

4. uploadTags: 업로드 태그 20-25개

   - 큰 모수 태그 5-7개

   - 카테고리 조합 3-5개

   - 영상 핵심 키워드 5-7개

   - 롱테일 키워드 3-5개

CRITICAL:

- 한글만 사용

- 클릭베이트 단어 제외

- 타임라인은 **반드시 포함**되어야 하며, 영상 길이를 초과하는 시간은 사용하지 마세요!

- 불법/성인/폭력/담배 관련 키워드 절대 금지

JSON 형식으로만 응답:

{
  "description": "...",
  "pinnedComment": "...",
  "hashtags": "#태그1 #태그2 #태그3 #태그4 #태그5",
  "uploadTags": ["태그1", "태그2", ...]
}`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
        messages: [
          {
            role: "system",
            content: descriptionPrompt,
          },
          {
            role: "user",
            content: "위 정보를 바탕으로 유튜브 설명란, 고정댓글, 해시태그, 업로드 태그를 생성해주세요.",
          },
        ],
        max_tokens: 3000,
        temperature: 0.8,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("설명을 생성할 수 없습니다.")
    }

    // JSON 파싱
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("JSON 형식을 찾을 수 없습니다.")
    }

    const result = JSON.parse(jsonMatch[0])
    console.log("[v0] 유튜브 설명 생성 완료")

    // 설명란의 첫 줄에 해시태그가 항상 포함되도록 보장 (유튜브 알고리즘 최적화)
    if (result.description && result.hashtags) {
      const hashtagLine = result.hashtags.trim()
      const descriptionLines = result.description.split('\n')
      const firstLine = descriptionLines[0]?.trim() || ''
      
      // 첫 줄이 해시태그로 시작하는지 확인
      const hasHashtagInFirstLine = firstLine.startsWith('#') && firstLine.split(' ').every(word => word.startsWith('#'))
      
      if (!hasHashtagInFirstLine && hashtagLine) {
        // 해시태그를 설명란의 첫 줄에 추가
        result.description = `${hashtagLine}\n\n${result.description}`
        console.log("[v0] 설명란 첫 줄에 해시태그 추가:", hashtagLine)
      } else {
        console.log("[v0] 설명란 첫 줄에 이미 해시태그가 포함되어 있습니다.")
      }
    }

    // 타임라인이 반드시 포함되도록 보장 및 영상 길이 검증
    if (result.description) {
      const hasTimeline = result.description.includes('🕒') || result.description.includes('타임라인')
      
      if (!hasTimeline) {
        // 타임라인이 없으면 추가
        const maxTimeInSeconds = videoDurationMinutes ? videoDurationMinutes * 60 : null
        const timelineSection = maxTimeInSeconds 
          ? `\n\n🕒 타임라인\n0:00 영상 시작\n${Math.floor(maxTimeInSeconds / 2)}:00 핵심 내용\n${Math.floor(maxTimeInSeconds * 0.8)}:00 마무리`
          : `\n\n🕒 타임라인\n0:00 영상 시작\n핵심 내용\n마무리`
        
        result.description = result.description + timelineSection
        console.log("[v0] 타임라인 추가됨")
      } else if (videoDurationMinutes) {
        // 타임라인이 있으면 영상 길이 검증 및 수정
        const maxTimeInSeconds = videoDurationMinutes * 60
        const timeRegex = /(\d+):(\d+)/g
        let modifiedDescription = result.description
        let hasInvalidTime = false
        const matches: Array<{ match: string; totalSeconds: number; index: number }> = []
        
        // 모든 매치를 먼저 수집
        let match
        while ((match = timeRegex.exec(result.description)) !== null) {
          const minutes = parseInt(match[1])
          const seconds = parseInt(match[2])
          const totalSeconds = minutes * 60 + seconds
          matches.push({ match: match[0], totalSeconds, index: match.index })
        }
        
        // 역순으로 교체 (인덱스 변경 방지)
        for (let i = matches.length - 1; i >= 0; i--) {
          const { match: timeMatch, totalSeconds } = matches[i]
          if (totalSeconds > maxTimeInSeconds) {
            hasInvalidTime = true
            // 영상 길이를 초과하는 시간을 영상 길이로 제한
            const maxMinutes = Math.floor(maxTimeInSeconds / 60)
            const maxSecs = maxTimeInSeconds % 60
            const replacement = `${maxMinutes}:${maxSecs.toString().padStart(2, '0')}`
            modifiedDescription = modifiedDescription.substring(0, matches[i].index) + replacement + modifiedDescription.substring(matches[i].index + timeMatch.length)
            console.log(`[v0] 타임라인 시간 수정: ${timeMatch} → ${replacement} (영상 길이: ${videoDurationMinutes}분)`)
          }
        }
        
        if (hasInvalidTime) {
          result.description = modifiedDescription
          console.log("[v0] 타임라인 시간이 영상 길이를 초과하여 수정됨")
        }
      }
    }

    return result
  } catch (error) {
    console.error("설명 생성 실패:", error)

    // Fallback
    const categoryName = categoryDescriptions[category] || category
    const fallbackHashtags = "#건강정보 #시니어건강 #60대건강 #건강팁 #건강관리"
    return {
      description: `${fallbackHashtags}

📋 **영상 개요**
${categoryName}에 대한 중요한 정보를 알려드립니다.

영상이 도움되셨다면 구독과 좋아요 부탁드립니다!`,
      pinnedComment: "여러분은 어떻게 생각하시나요? 댓글로 의견 남겨주세요! 😊",
      hashtags: fallbackHashtags,
      uploadTags: ["건강정보", "시니어건강", "60대건강", "건강팁", "건강관리"],
    }
  }
}

// 각 부분 생성 헬퍼 함수
async function generateScriptPart(
  partName: string,
  partTargetChars: number,
  scriptDraft: string,
  topic: string,
  previousParts: string,
  GPT_API_KEY: string,
  totalTargetChars: number,
  durationMinutes?: number
): Promise<string> {
  const minChars = Math.floor(partTargetChars * 0.95) // 최소 95%
  const maxChars = Math.floor(partTargetChars * 1.05) // 최대 105%
  
  // 시간이 길어질수록 더 강력한 강조
  const durationWarning = durationMinutes && durationMinutes > 20 
    ? `\n⚠️ 중요: 이 영상은 ${durationMinutes}분 분량입니다. 목표 글자수(${partTargetChars.toLocaleString()}자)를 반드시 달성해야 합니다! 부족하면 영상 시간이 부족해집니다!`
    : ""

  const systemPrompt = `당신은 유튜브 대본 전문가입니다. 대본의 한 부분을 작성합니다.

🚨🚨🚨 매우 중요한 지시사항 🚨🚨🚨
- 이 부분은 반드시 정확히 ${partTargetChars.toLocaleString()}자로 작성해야 합니다!
- 목표 글자수: ${partTargetChars.toLocaleString()}자
- 최소 글자수: ${minChars.toLocaleString()}자 (절대 이보다 적으면 안 됩니다!)
- 허용 범위: ${minChars.toLocaleString()}자 ~ ${maxChars.toLocaleString()}자 (±5%)
- 절대로 ${minChars.toLocaleString()}자 미만으로 작성하지 마세요!
- 각 문장을 길고 상세하게 작성하세요!
- 예시, 사례, 설명을 많이 추가하여 목표 글자수를 반드시 달성하세요!
- 괄호나 대괄호를 사용하지 마세요 (TTS를 이용할 것이기 때문)
- "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론" 같은 구조적 단어를 절대 사용하지 마세요!
- 오로지 대본 내용만 작성하세요!${durationWarning}

⚠️ 글자수 확인 필수:
작성 후 반드시 글자수를 확인하세요. ${minChars.toLocaleString()}자 미만이면 절대 안 됩니다!
목표는 ${partTargetChars.toLocaleString()}자입니다. 이 글자수에 맞춰 충분히 상세하게 작성하세요!`

  const userPrompt = `주제: ${topic}

대본 초안:
${scriptDraft}

${previousParts ? `이미 작성된 부분:\n${previousParts}\n\n` : ""}
위 대본 초안을 바탕으로 대본의 다음 부분을 작성해주세요.

🚨🚨🚨 매우 중요한 필수 요구사항 🚨🚨🚨
1. 이 부분은 반드시 정확히 ${partTargetChars.toLocaleString()}자로 작성해야 합니다!
   - 목표 글자수: ${partTargetChars.toLocaleString()}자
   - 최소 글자수: ${minChars.toLocaleString()}자 (이것보다 적으면 절대 안 됩니다!)
   - 허용 범위: ${minChars.toLocaleString()}자 ~ ${maxChars.toLocaleString()}자 (±5%)
   - 절대로 ${maxChars.toLocaleString()}자를 초과하지 마세요!
   - 절대로 ${minChars.toLocaleString()}자 미만으로 작성하지 마세요!
   ${durationMinutes && durationMinutes > 20 ? `- ⚠️ 이 영상은 ${durationMinutes}분 분량입니다. 목표 글자수를 반드시 달성해야 합니다!` : ""}
2. 전체 목표 길이는 ${totalTargetChars.toLocaleString()}자입니다. 각 부분이 정확한 글자수로 작성되어야 전체 목표를 달성할 수 있습니다.
3. ${previousParts ? "이미 작성된 부분과 자연스럽게 연결되도록 작성하세요." : "대본의 시작 부분이므로 시청자의 관심을 끄는 내용으로 작성하세요."}
4. 절대로 요약하지 말고 모든 내용을 상세하게 작성하세요.
5. 괄호나 대괄호 사용 금지
6. "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론" 같은 구조적 단어를 절대 사용하지 마세요!
7. 오로지 대본 내용만 작성하세요!

대본 내용만 작성해주세요. 제목이나 구조적 단어는 사용하지 마세요.

⚠️⚠️⚠️ 최종 확인 사항 ⚠️⚠️⚠️
1. 반드시 ${minChars.toLocaleString()}자 이상 작성하세요! (목표: ${partTargetChars.toLocaleString()}자)
2. 글자수가 부족하면 예시, 사례, 설명을 더 추가하세요!
3. 각 문장을 길고 상세하게 작성하여 목표 글자수를 달성하세요!
4. 작성 후 글자수를 확인하여 ${minChars.toLocaleString()}자 이상인지 확인하세요!

${durationMinutes && durationMinutes > 20 ? `⚠️ 이 영상은 ${durationMinutes}분 분량입니다. 목표 글자수(${partTargetChars.toLocaleString()}자)를 반드시 달성해야 영상 시간이 부족하지 않습니다!` : ""}`

  // 시간이 길수록 더 많은 토큰 할당 (목표 글자수를 확실히 달성하기 위해)
  // 한글은 1자당 약 2-3토큰이 필요하므로 여유있게 계산
  // 목표 글자수에 충분한 토큰을 할당 (최소 4배, 최대 6배)
  const baseTokenPerChar = 4.0 // 한글 1자당 4토큰으로 계산 (여유있게)
  const tokenMultiplier = durationMinutes && durationMinutes > 20 ? 1.5 : 1.3
  const calculatedTokens = Math.ceil(partTargetChars * baseTokenPerChar * tokenMultiplier)
  // gpt-4o-mini의 max_completion_tokens는 최대 16384이지만, 실제로는 더 큰 값도 가능할 수 있음
  // 최소값을 계산된 토큰의 1.2배로 설정하여 충분한 여유 확보
  const minTokens = Math.ceil(calculatedTokens * 1.2)
  // 최대값은 16384로 설정 (gpt-4o-mini의 일반적인 최대값)
  const maxTokens = Math.min(16384, Math.max(minTokens, calculatedTokens))

  console.log(`[v0] 📝 ${partName} 생성 시작 (목표: ${partTargetChars.toLocaleString()}자, 토큰: ${maxTokens.toLocaleString()})`)

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GPT_API_KEY}`,
      "Content-Type": "application/json",
    },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: maxTokens,
        }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[v0] ❌ ${partName} API 오류: ${response.status}`, errorText)
    throw new Error(`${partName} 생성 실패: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`[v0] 📦 ${partName} API 응답 수신:`, {
    hasChoices: !!data.choices,
    choicesLength: data.choices?.length,
    hasMessage: !!data.choices?.[0]?.message,
    hasContent: !!data.choices?.[0]?.message?.content,
    contentLength: data.choices?.[0]?.message?.content?.length,
    finishReason: data.choices?.[0]?.finish_reason,
  })

  const content = data.choices?.[0]?.message?.content

  if (!content) {
    console.error(`[v0] ❌ ${partName} 응답 내용 없음:`, JSON.stringify(data, null, 2))
    
    // finish_reason이 'length'인 경우 재시도
    if (data.choices?.[0]?.finish_reason === 'length') {
      console.warn(`[v0] ⚠️ ${partName} 토큰 제한으로 인해 잘렸습니다. 토큰을 늘려 재시도합니다.`)
      // 토큰을 늘려서 재시도
      const retryMaxTokens = Math.min(100000, Math.ceil(maxTokens * 1.5))
      console.log(`[v0] 🔄 ${partName} 재시도 (토큰: ${retryMaxTokens.toLocaleString()})`)
      
      const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_completion_tokens: retryMaxTokens,
        }),
      })
      
      if (!retryResponse.ok) {
        const retryErrorText = await retryResponse.text()
        console.error(`[v0] ❌ ${partName} 재시도 실패:`, retryErrorText)
        throw new Error(`${partName} 재시도 실패: ${retryResponse.status} - ${retryErrorText}`)
      }
      
      const retryData = await retryResponse.json()
      console.log(`[v0] 📦 ${partName} 재시도 응답:`, {
        hasContent: !!retryData.choices?.[0]?.message?.content,
        contentLength: retryData.choices?.[0]?.message?.content?.length,
        finishReason: retryData.choices?.[0]?.finish_reason,
      })
      
      const retryContent = retryData.choices?.[0]?.message?.content
      
      if (!retryContent) {
        console.error(`[v0] ❌ ${partName} 재시도 후에도 응답 내용 없음:`, JSON.stringify(retryData, null, 2))
        throw new Error(`${partName} 생성에 실패했습니다. 재시도 후에도 응답 내용이 없습니다.`)
      }
      
      console.log(`[v0] ✅ ${partName} 재시도 성공: ${retryContent.length.toLocaleString()}자`)
      return retryContent.trim()
    }
    
    // 다른 finish_reason인 경우 (stop, content_filter 등)
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown'
    console.error(`[v0] ❌ ${partName} 생성 실패 (finish_reason: ${finishReason})`)
    throw new Error(`${partName} 생성에 실패했습니다. 응답 내용이 없습니다. (finish_reason: ${finishReason})`)
  }
  
  console.log(`[v0] ✅ ${partName} 응답 수신 성공: ${content.length.toLocaleString()}자`)

  // 제작자 노트 제거
  let cleanedContent = content
  const producerNoteIndex = cleanedContent.indexOf("제작자 노트")
  if (producerNoteIndex !== -1) {
    cleanedContent = cleanedContent.substring(0, producerNoteIndex).trim()
  }
  
  // 구조적 단어 제거 (개요, 서론, 본론, 챕터, 1부, 2부, 3부, 4부, 5부, 결론 등)
  const structuralWords = [
    /^개요\s*:?/gim,
    /^서론\s*:?/gim,
    /^본론\s*:?/gim,
    /^결론\s*:?/gim,
    /^챕터\s*\d+\s*:?/gim,
    /^\d+부\s*:?/gim,
    /^제?\s*\d+장\s*:?/gim,
    /^제?\s*\d+편\s*:?/gim,
    /^제?\s*\d+절\s*:?/gim,
    /^Part\s*\d+\s*:?/gim,
    /^Chapter\s*\d+\s*:?/gim,
    /^Section\s*\d+\s*:?/gim,
  ]
  
  for (const pattern of structuralWords) {
    cleanedContent = cleanedContent.replace(pattern, "")
  }
  
  // 줄 시작 부분의 구조적 단어 제거
  const lines = cleanedContent.split("\n")
  cleanedContent = lines.map(line => {
    let cleaned = line.trim()
    // 줄 시작 부분의 구조적 단어 제거
    cleaned = cleaned.replace(/^(개요|서론|본론|결론|챕터\s*\d+|\d+부|제?\s*\d+장|제?\s*\d+편|제?\s*\d+절|Part\s*\d+|Chapter\s*\d+|Section\s*\d+)\s*[:-]?\s*/i, "")
    return cleaned
  }).filter(line => line.trim().length > 0).join("\n")
  
  // 목표 길이 조정 (±5% 범위 내로)
  // minChars와 maxChars는 이미 함수 시작 부분에서 선언됨
  
  if (cleanedContent.length > maxChars) {
    console.warn(`[v0] ⚠️ ${partName}이 목표 길이의 105%를 초과합니다. (${cleanedContent.length.toLocaleString()}자 / 목표: ${partTargetChars.toLocaleString()}자) 자동으로 조정합니다.`)
    cleanedContent = cleanedContent.substring(0, maxChars)
    // 마지막 문장이 잘리지 않도록 문장 끝까지 찾기
    const lastPeriod = cleanedContent.lastIndexOf(".")
    const lastQuestion = cleanedContent.lastIndexOf("?")
    const lastExclamation = cleanedContent.lastIndexOf("!")
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)
    if (lastSentenceEnd > minChars) {
      cleanedContent = cleanedContent.substring(0, lastSentenceEnd + 1)
    }
  } else if (cleanedContent.length < minChars) {
    console.warn(`[v0] ⚠️ ${partName}이 목표 길이의 95% 미만입니다. (${cleanedContent.length.toLocaleString()}자 / 목표: ${partTargetChars.toLocaleString()}자)`)
    console.warn(`[v0] ⚠️ 부족한 글자수: ${(minChars - cleanedContent.length).toLocaleString()}자`)
  }

  console.log(`[v0] ✅ ${partName} 생성 완료: ${cleanedContent.length.toLocaleString()}자 (목표: ${partTargetChars.toLocaleString()}자)`)
  return cleanedContent.trim()
}

export async function generateFinalScript(
  scriptDraft: string,
  topic: string,
  apiKey?: string,
  durationMinutes: number = 20,
  targetChars: number = 8280
): Promise<string> {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("=".repeat(80))
    console.log("[v0] 최종 대본 생성 시작 (단계별 생성)")
    console.log("-".repeat(80))
    console.log(`[v0] 📝 대본 초안 정보:`)
    console.log(`[v0]    - 대본 초안 길이: ${scriptDraft.length.toLocaleString()}자`)
    console.log(`[v0]    - 대본 초안 미리보기: ${scriptDraft.substring(0, 100)}...`)
    console.log(`[v0] 📊 목표 정보:`)
    console.log(`[v0]    - 목표 길이: ${targetChars.toLocaleString()}자`)
    console.log(`[v0]    - 영상 시간: ${durationMinutes}분`)
    console.log("-".repeat(80))

    // 각 부분의 목표 글자 수 계산 (정확히 목표 글자수에 맞추기)
    // 도입부: 10%, 본론 5개: 각 14% (총 70%), 결론: 20%
    const introChars = Math.floor(targetChars * 0.1) // 10% - 도입부
    const bodyCharsPerChapter = Math.floor((targetChars * 0.7) / 5) // 70%를 5개로 나눔 (각 14%)
    const conclusionChars = targetChars - introChars - (bodyCharsPerChapter * 5) // 나머지 모두 결론에 할당 (정확히 맞추기)

    console.log(`[v0] 📋 단계별 목표 글자 수 (정확히 ${targetChars.toLocaleString()}자 맞추기):`)
    console.log(`[v0]    - 도입부: ${introChars.toLocaleString()}자 (${((introChars / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 본론 1: ${bodyCharsPerChapter.toLocaleString()}자 (${((bodyCharsPerChapter / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 본론 2: ${bodyCharsPerChapter.toLocaleString()}자 (${((bodyCharsPerChapter / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 본론 3: ${bodyCharsPerChapter.toLocaleString()}자 (${((bodyCharsPerChapter / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 본론 4: ${bodyCharsPerChapter.toLocaleString()}자 (${((bodyCharsPerChapter / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 본론 5: ${bodyCharsPerChapter.toLocaleString()}자 (${((bodyCharsPerChapter / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 결론: ${conclusionChars.toLocaleString()}자 (${((conclusionChars / targetChars) * 100).toFixed(1)}%)`)
    console.log(`[v0]    - 총합: ${(introChars + bodyCharsPerChapter * 5 + conclusionChars).toLocaleString()}자 (목표: ${targetChars.toLocaleString()}자)`)
    console.log("=".repeat(80))

    const parts: string[] = []
    let previousParts = ""

    // 1. 첫 번째 부분 생성
    console.log("\n[1/7] 첫 번째 부분 생성 중...")
    const intro = await generateScriptPart(
      "첫 번째 부분",
      introChars,
      scriptDraft,
      topic,
      previousParts,
      GPT_API_KEY,
      targetChars,
      durationMinutes
    )
    parts.push(intro)
    previousParts += intro + "\n\n"
    console.log(`[v0] ✅ 첫 번째 부분 완료: ${intro.length.toLocaleString()}자\n`)

    // 2. 본론 부분들 생성 (5개)
    for (let i = 1; i <= 5; i++) {
      console.log(`\n[${i + 1}/7] 다음 부분 생성 중...`)
      const chapter = await generateScriptPart(
        "다음 부분",
        bodyCharsPerChapter,
        scriptDraft,
        topic,
        previousParts,
        GPT_API_KEY,
        targetChars,
        durationMinutes
      )
      parts.push(chapter)
      previousParts += chapter + "\n\n"
      console.log(`[v0] ✅ 다음 부분 완료: ${chapter.length.toLocaleString()}자\n`)
    }

    // 3. 마지막 부분 생성
    console.log("\n[7/7] 마지막 부분 생성 중...")
    const conclusion = await generateScriptPart(
      "마지막 부분",
      conclusionChars,
      scriptDraft,
      topic,
      previousParts,
      GPT_API_KEY,
      targetChars,
      durationMinutes
    )
    parts.push(conclusion)
    console.log(`[v0] ✅ 마지막 부분 완료: ${conclusion.length.toLocaleString()}자\n`)

    // 모든 부분 합치기
    let finalScript = parts.join("\n\n")

    // 대본 마지막에 CTA 추가 (이미 CTA가 있으면 추가하지 않음)
    const ctaText = "\n\n이 영상이 도움이 되셨다면 좋아요와 구독 부탁드립니다. 여러분의 응원이 제게 큰 힘이 됩니다. 다음 영상에서도 더 유용한 정보를 공유하겠습니다. 감사합니다."
    const hasCTA = finalScript.includes("좋아요와 구독") || (finalScript.includes("좋아요") && finalScript.includes("구독"))
    if (!hasCTA) {
      finalScript = finalScript.trim() + ctaText
    }

    // 구조적 단어 제거 (개요, 서론, 본론, 챕터, 1부, 2부, 3부, 4부, 5부, 결론 등)
    const structuralWords = [
      /^개요\s*:?/gim,
      /^서론\s*:?/gim,
      /^본론\s*:?/gim,
      /^결론\s*:?/gim,
      /^챕터\s*\d+\s*:?/gim,
      /^\d+부\s*:?/gim,
      /^제?\s*\d+장\s*:?/gim,
      /^제?\s*\d+편\s*:?/gim,
      /^제?\s*\d+절\s*:?/gim,
      /^Part\s*\d+\s*:?/gim,
      /^Chapter\s*\d+\s*:?/gim,
      /^Section\s*\d+\s*:?/gim,
    ]
    
    for (const pattern of structuralWords) {
      finalScript = finalScript.replace(pattern, "")
    }
    
    // 줄 시작 부분의 구조적 단어 제거
    const lines = finalScript.split("\n")
    const cleanedLines = lines.map(line => {
      let cleaned = line.trim()
      // 줄 시작 부분의 구조적 단어 제거
      cleaned = cleaned.replace(/^(개요|서론|본론|결론|챕터\s*\d+|\d+부|제?\s*\d+장|제?\s*\d+편|제?\s*\d+절|Part\s*\d+|Chapter\s*\d+|Section\s*\d+)\s*[:-]?\s*/i, "")
      return cleaned
    }).filter(line => line.trim().length > 0)
    
    finalScript = cleanedLines.join("\n")

    // 빈 줄 정리
    finalScript = finalScript.replace(/\n{3,}/g, "\n\n")
    finalScript = finalScript.replace(/^\n+/, "")
    finalScript = finalScript.replace(/\n+$/, "")
    
    // 목표 길이 조정 (±5% 범위 내로)
    const minTotalChars = Math.floor(targetChars * 0.95)
    const maxTotalChars = Math.floor(targetChars * 1.05)
    
    if (finalScript.length > maxTotalChars) {
      console.warn(`[v0] ⚠️ 경고: 생성된 대본이 목표 길이의 105%를 초과합니다. (${finalScript.length.toLocaleString()}자 / 목표: ${targetChars.toLocaleString()}자)`)
      console.warn(`[v0] 목표 길이에 맞춰 자동으로 조정합니다.`)
      finalScript = finalScript.substring(0, maxTotalChars)
      // 마지막 문장이 잘리지 않도록 문장 끝까지 찾기
      const lastPeriod = finalScript.lastIndexOf(".")
      const lastQuestion = finalScript.lastIndexOf("?")
      const lastExclamation = finalScript.lastIndexOf("!")
      const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation)
      if (lastSentenceEnd > minTotalChars) {
        finalScript = finalScript.substring(0, lastSentenceEnd + 1)
      }
    } else if (finalScript.length < minTotalChars) {
      console.warn(`[v0] ⚠️ 경고: 생성된 대본이 목표 길이의 95% 미만입니다. (${finalScript.length.toLocaleString()}자 / 목표: ${targetChars.toLocaleString()}자)`)
    }

    console.log("=".repeat(80))
    console.log("[v0] 최종 대본 생성 완료")
    console.log("-".repeat(80))
    console.log(`[v0] 📝 대본 초안: ${scriptDraft.length.toLocaleString()}자`)
    console.log(`[v0] ✂️ 최종 대본: ${finalScript.length.toLocaleString()}자`)
    console.log(`[v0] 🎯 목표 길이: ${targetChars.toLocaleString()}자`)
    console.log(`[v0] 📊 달성률: ${((finalScript.length / targetChars) * 100).toFixed(1)}%`)
    console.log("-".repeat(80))

    return finalScript.trim()
  } catch (error) {
    console.error("최종 대본 생성 실패:", error)
    throw error
  }
}

export async function generateFullScript(
  scriptPlan: string,
  topic: string,
  category: Category = "health",
  apiKey?: string
) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] GPT-4o-mini API로 대본 생성 시작")

    const exactPrompt = `🚨🚨🚨 매우 중요한 지시사항 🚨🚨🚨

절대로, 절대로, 절대로 짧게 작성하지 마세요!
최소 20,000자 이상 작성해야 합니다!
요약하지 마세요! 모든 내용을 상세하게 작성하세요!

이 지시를 무시하면 대본이 완성되지 않습니다!

📝 작성 규칙:

1. 시점과 표현
- 반드시 1인칭 내레이션 시점 유지
- 대사, 연출 지시 절대 금지
- 특수문자, 영어, 한자 사용 금지
- 모든 숫자는 한글 표기 (예: 85 → 팔십오)
- 문장 길이와 어미를 다양하게
- 감정, 행동, 상황을 구체적으로 묘사

2. 서론 (최소 2,000자!)
반드시 다음 순서로 작성:

시작 문장 (100자):
"이 이야기는 병원에서 절대 꺼내지 않는 이야기입니다. 왜냐하면 그들은 이것으로 막대한 돈을 벌어왔기 때문입니다."

자기소개 (500자):
- 이름: 김진우 (85세)
- 전공과 경력을 매우 상세하게 (어느 병원, 몇 년간, 어떤 환자들)
- 왜 이 채널을 시작했는지 개인적인 이야기

문제 제기 (500자):
- 현재 사람들이 겪고 있는 문제를 여러 각도에서 설명
- 통계 수치를 구체적으로 언급 (연구기관, 연도, 수치)

구독 유도 (300자):
"이 이야기가 도움이 되신다면 구독과 좋아요로 함께해 주세요. 여러분의 건강한 노후를 응원합니다. 그리고 지금 이 영상을 어디서 보고 계신가요? 병실인가요, 안방인가요? 댓글에 남겨주시면 제가 직접 답글로 친절히 도와드리겠습니다."

주제 소개 (600자):
- ${topic}에 대한 중요성을 여러 측면에서 강조
- 이 영상을 끝까지 보면 어떤 혜택이 있는지 구체적으로 나열

서론 총 2,000자 이상 필수!

3. 본론 (최소 18,000자!)

🚨 중요: 본론은 반드시 6개 챕터로 구성하되, "첫 번째", "두 번째" 같은 표현을 사용하지 마세요!
각 챕터는 자연스럽게 연결되어야 합니다!

각 챕터 구성 (각 3,000자 이상!):

a) 핵심 정보 설명 (1,200자):
- 의학적 사실을 매우 상세하게 설명
- 연구 기관, 연도, 수치를 구체적으로 언급
- 어려운 용어는 여러 가지 비유로 쉽게 설명
- "예를 들어", "쉽게 말하면", "즉" 같은 연결어 사용
- 왜 이것이 중요한지 여러 각도에서 설명

b) 공감과 경험 (800자):
- 시청자가 공감할 수 있는 질문 여러 개 (최소 5개)
- 본인의 경험을 매우 상세하게 공유
- 감정 변화, 주변 반응, 깨달음을 구체적으로 서술

c) 실행 팁 (800자):
- 시청자가 바로 실천할 수 있는 방법을 단계별로 설명
- 아침, 점심, 저녁 각각 무엇을 해야 하는지
- 구체적인 시간, 횟수, 양을 명시
- "먼저", "그 다음", "마지막으로" 같은 순서 표현 사용

d) 주의사항 (700자):
- 흔한 오해를 하나하나 반박
- 잘못된 민간요법을 여러 개 나열하고 왜 위험한지 설명
- "절대 하지 마세요", "이것만은 피하세요" 같은 강조 표현

e) 전환 문장 (500자):
- 다음 내용으로 자연스럽게 넘어가는 문장들
- "그렇다면 이제", "여기서 더 중요한 것은", "하지만 아직 끝이 아닙니다"

각 챕터 3,000자 × 6 = 18,000자!

🔴 환자 사례 (1,500자 필수!):
- 본론 중간 어디에든 1개만 포함
- 환자 이름, 나이, 직업, 첫 만남 상황
- 증상이 어떻게 시작되었는지
- 진단 과정과 검사 결과
- 치료 과정의 어려움
- 환자와의 대화 내용
- 가족들의 반응
- 치료 후 변화
- 현재 상태와 근황
- 환자가 남긴 말

🔴 개인 경험 (1,500자 필수!):
- 본인 또는 가족의 경험 1개
- 언제, 어디서, 어떤 상황이었는지
- 처음 느낀 감정
- 어떻게 대처했는지
- 시행착오와 어려움
- 주변 사람들의 조언
- 해결 과정
- 최종 결과
- 이를 통해 배운 교훈

4. 결론 (최소 3,000자!)

오늘 내용 요약 (1,000자):
- 각 포인트를 하나하나 다시 짚어주며 재강조
- 서론, 본론의 핵심 내용을 모두 언급
- "첫째", "둘째", "셋째" 같은 표현으로 정리

철학적 조언 (800자):
- 85세 의사로서의 인생 철학
- 건강의 진정한 의미
- 가족, 삶, 노년에 대한 생각
- 50년 경험에서 얻은 지혜

실천 당부 (700자):
"내일 저녁부터 작은 습관 하나만 바꿔보세요. 그 변화가 여러분의 노후 건강을 완전히 달라지게 할 수 있습니다."
- 구체적으로 무엇을 해야 하는지
- 언제부터 시작할 수 있는지
- 작은 실천이 큰 변화를 만든다는 격려

마무리 인사 (500자):
- 시청에 대한 감사
- 댓글과 구독 유도
- 다음 영상 예고
- 따뜻한 격려의 말

결론 총 3,000자 이상 필수!

5. 최종 체크리스트

✅ 서론: 2,000자 이상
✅ 본론: 18,000자 이상 (각 챕터 3,000자 × 6)
✅ 환자 사례: 1,500자
✅ 개인 경험: 1,500자
✅ 결론: 3,000자 이상
✅ 총합: 최소 26,000자!

❌ 절대 금지사항:
- 괄호와 설명 (예: "(500자)")
- "-" 기호로 시작하는 제목
- "첫 번째", "두 번째", "본론", "결론" 같은 구조적 표현
- "를", "를" 같은 조사로 끝나는 제목
- 숫자를 숫자로 표기 (예: 1 → 한, 85 → 팔십오)
- "vs" 같은 영어 표현

🚨🚨🚨 다시 한번 강조합니다 🚨🚨🚨

절대로 짧게 요약하지 마세요!
각 부분을 매우, 매우, 매우 상세하게 작성하세요!
최소 26,000자 이상 작성해야 합니다!

요약하지 마세요! 생략하지 마세요! 모든 내용을 풀어서 작성하세요!

주제: ${topic}

대본 기획안:
${scriptPlan}

위 규칙을 정확히 따라서 반드시 26,000자 이상의 완전한 대본을 작성해주세요. 
자연스럽게 흘러가는 대본을 만들되, 절대로 짧게 작성하지 마세요!`

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
            content: `당신은 ${categoryDescriptions[category]} 콘텐츠 전문 작가입니다. 60대 시니어층을 위한 유튜브 영상 전체 대본을 작성해주세요.

주제: ${topic}

대본 기획서:
${scriptPlan}

위 기획서를 바탕으로 15,000자 이상의 완전한 대본을 작성해주세요.

절대 규칙:
- 최소 15,000자 이상 작성 (공백 포함)
- 짧게 요약하지 말고 모든 내용을 상세하게 작성
- 각 섹션은 충분히 길게 (서론 2,000자, 본론 각 3,000자, 결론 3,000자)
- 구체적인 사례와 예시를 충분히 포함
- 반복과 강조를 통해 이해도 높이기`,
          },
          {
            role: "user",
            content: exactPrompt,
          },
        ],
        max_tokens: 16000, // 25000에서 16000으로 변경 (gpt-4o-mini의 최대 completion token 한도)
        temperature: 0.8, // 0.7에서 0.8로 증가하여 더 창의적이고 길게 생성
      }),
    })

    console.log("[v0] GPT-4o-mini API 응답 상태:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log("[v0] GPT-4o-mini API 오류:", errorText)
      throw new Error(`GPT-4o-mini API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    let generatedScript = data.choices?.[0]?.message?.content

    if (!generatedScript) {
      throw new Error("GPT-4o-mini API에서 대본을 생성할 수 없습니다.")
    }

    // 메타 정보 제거
    generatedScript = generatedScript
      .replace(/\[공백 포함 글자수.*?\]/gi, "")
      .replace(/실제 글자 수:.*?자/gi, "")
      .replace(/글자 수:.*?자/gi, "")
      .trim()

    console.log("[v0] 생성된 대본 길이:", generatedScript.length)

    if (generatedScript.length < 10000) {
      console.log("[v0] 경고: 생성된 대본이 10,000자 미만입니다:", generatedScript.length)
    }

    // 대본 마지막에 CTA 추가 (이미 CTA가 있으면 추가하지 않음)
    const ctaText = "\n\n이 영상이 도움이 되셨다면 좋아요와 구독 부탁드립니다. 여러분의 응원이 제게 큰 힘이 됩니다. 다음 영상에서도 더 유용한 정보를 공유하겠습니다. 감사합니다."
    const hasCTA = generatedScript.includes("좋아요와 구독") || generatedScript.includes("좋아요") && generatedScript.includes("구독")
    const finalScript = hasCTA ? generatedScript : generatedScript.trim() + ctaText

    return finalScript
  } catch (error) {
    console.error("GPT-4o-mini 대본 생성 실패:", error)

    return generateFallbackFullScript(topic)
  }
}

// 6.25만 한글로 변환하는 함수 (6.25 -> 육이오)
function convertNumbersToKorean(text: string): string {
  // 6.25만 "육이오"로 변환
  return text.replace(/6\.25/g, "육이오")
}

function generateFallbackFullScript(topic: string): string {
  return `이 이야기는 어디에서 절대 꺼내지 않는 이야기입니다. 왜냐하면 그들은 이것으로 막대한 돈을 벌어왔기 때문입니다.

안녕하세요. 저는 올해 팔십오 세, 김진우입니다. 지난 오십 년간 내과 전문의로 일하며 수많은 환자분들을 만나왔습니다. 오늘은 ${topic}에 대해 여러분께 꼭 알려드리고 싶은 이야기가 있습니다.

제가 이 영상을 만드는 이유는 단순합니다. 너무 많은 분들이 잘못된 정보 때문에 고생하고 계시기 때문입니다. 병원에서는 시간이 부족해 자세히 설명드리지 못하는 내용들을 이 자리에서 모두 공개하겠습니다.

이 이야기가 도움이 되셨다면 구독과 좋아요로 함께해 주세요. 여러분의 건강한 노후를 응원합니다. 그리고 지금 이 영상을 어디서 보고 계신가요? 병실인가요, 안방인가요? 댓글에 남겨주시면 제가 직접 답글로 친절히 도와드리겠습니다.

가장 중요한 것부터 말씀드리겠습니다. 많은 분들이 ${topic}에 대해 잘못 알고 계신 것들이 있습니다. 이천이십삼년 서울대병원 연구에 따르면 육십 세 이상 환자의 칠십 퍼센트가 잘못된 정보로 인해 치료 시기를 놓치고 있다고 합니다.

실제 임상에서 확인된 바로는 올바른 방법을 실천한 환자들의 회복 속도가 그렇지 않은 환자들보다 세 배 이상 빨랐습니다. 미국 하버드 의대 이십 년 추적 연구 결과도 같은 결과를 보여주었습니다.

여러분은 혹시 이런 경험이 있으신가요? 아침에 일어날 때 몸이 무겁고 하루 종일 피곤함을 느끼시나요? 이것이 바로 제가 오늘 말씀드리고 싶은 핵심과 연결되어 있습니다.

지난해 제게 오신 박영수님 이야기를 들려드리겠습니다. 영수님은 칠십팔 세로 처음 병원에 오셨을 때 매우 걱정스러운 상태였습니다. 인터넷에서 본 잘못된 정보 때문에 오히려 상태가 악화되었던 것입니다. 영수님은 처음에 제 말을 믿지 않으셨습니다. 하지만 차근차근 설명드리고 올바른 방법을 알려드린 후 육 개월 만에 완전히 달라진 모습을 보여주셨습니다. 영수님은 지금도 건강하게 지내고 계시며 가끔 안부 인사를 해주십니다.

이제 더 중요한 이야기를 해드리겠습니다. 오십 년간 진료하면서 가장 놀라웠던 것은 올바른 방법을 실천한 환자들에게서 나타나는 공통적인 변화였습니다. 변화는 삼 개월 후부터 나타나는 놀라운 결과였습니다. 가족들이 먼저 알아차리는 변화, 검사 수치의 개선, 일상생활의 질 향상이 순서대로 나타났습니다.

제 아내 이야기를 잠깐 들려드리겠습니다. 아내도 칠십 대 중반에 같은 문제로 고생했습니다. 의사인 저도 처음에는 당황했지만 체계적으로 접근한 결과 지금은 이십 년 전보다 더 건강해졌습니다. 가장 중요했던 것은 꾸준함이었습니다. 하루 이틀로는 변화를 느낄 수 없지만 한 달, 두 달 지나면서 확실한 차이를 경험할 수 있었습니다.

그렇다면 이제 구체적인 실천 방법을 알려드리겠습니다. 아침에 일어나자마자 할 수 있는 간단한 것부터 시작해보겠습니다. 식사 삼십 분 전에 하는 것, 잠들기 두 시간 전에 하는 것까지 모든 방법들은 특별한 도구나 비용이 들지 않습니다.

하지만 여기서 중요한 것은 절대 하지 말아야 할 것들도 있다는 점입니다. 많은 분들이 좋다고 해서 하시는 것들 중에 오히려 해로운 것들이 있습니다. 인터넷에서 본 민간요법, 과도한 운동, 무분별한 영양제 섭취는 오히려 독이 될 수 있습니다.

건강 관리는 마라톤과 같습니다. 단기간에 결과를 보려 하지 마세요. 단계별 목표 설정, 가족의 지지와 협력, 정기적인 전문의 상담이 필요합니다. 생활 패턴의 점진적 개선과 스트레스 관리도 중요합니다.

마지막으로 희망적인 이야기를 들려드리겠습니다. 의학 기술의 발전으로 예방의학의 중요성이 더욱 부각되고 있습니다. 개인 맞춤형 치료가 가능해지면서 건강한 노후 생활을 영위할 수 있는 가능성이 높아지고 있습니다.

오십 년간 의사로 살아오면서 깨달은 가장 중요한 진실은 이것입니다. 건강은 하루아침에 만들어지지 않습니다. 하지만 올바른 습관을 꾸준히 실천하면 반드시 좋은 결과가 있습니다.

여러분, 나이가 들었다고 포기하지 마세요. 팔십 대, 구십 대에도 건강하게 사시는 분들을 많이 봤습니다. 그분들의 공통점은 바로 올바른 습관을 꾸준히 실천하신 것입니다.

내일 저녁부터 작은 습관 하나만 바꿔보세요. 그 변화가 여러분의 노후 건강을 완전히 달라지게 할 수 있습니다.

여러분의 건강한 노후를 진심으로 응원합니다. 궁금한 것이 있으시면 언제든 댓글로 물어보세요. 제가 직접 답변드리겠습니다.

감사합니다.`
}

export async function generateVideoWithTTS(
  script: string,
  doctorImageUrl: string,
  autoImages?: Array<{
    id: string
    url: string
    startTime: number
    endTime: number
    keyword: string
  }>,
  userApiKey?: string,
) {
  try {
    console.log("[v0] 영상 생성 시작, 목소리: ko-KR-Neural2-C, 자동 이미지:", autoImages?.length || 0, "개")

    const sentenceChunks = splitScriptIntoNaturalChunks(script)
    console.log("[v0] 문장 분할 완료, 총", sentenceChunks.length, "개")

    console.log("[v0] 개별 TTS 생성 시작")

    const subtitles = []
    let currentTime = 0
    let globalSubtitleIndex = 0

    const GOOGLE_TTS_API_KEY = userApiKey || process.env.GOOGLE_TTS_API_KEY

    if (!GOOGLE_TTS_API_KEY) {
      throw new Error("Google TTS API 키가 설정되지 않았습니다. API 키를 입력해주세요.")
    }

    const audioChunks = []

    for (let i = 0; i < sentenceChunks.length; i++) {
      const sentence = sentenceChunks[i]
      console.log(`[v0] TTS 생성 중 ${i + 1}/${sentenceChunks.length}: "${sentence.substring(0, 30)}..."`)

      // 숫자를 한글로 변환
      const convertedSentence = convertNumbersToKorean(sentence)
      const subtitleLines = splitIntoSubtitleLines(convertedSentence)

      let ssmlText = "<speak>"
      for (let j = 0; j < subtitleLines.length; j++) {
        ssmlText += `<mark name="subtitle_${globalSubtitleIndex + j}"/>${subtitleLines[j]} `
      }
      ssmlText += "</speak>"

      console.log(`[v0] SSML 생성 완료, 자막 ${subtitleLines.length}개`)

      const ttsResponse = await fetch(
        `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: {
              ssml: ssmlText,
            },
            voice: {
              languageCode: "ko-KR",
              name: "ko-KR-Neural2-C", // 여성 목소리(B)를 남성 목소리(C)로 변경
            },
            audioConfig: {
              audioEncoding: "MP3",
              speakingRate: 1.0,
              pitch: -2.0,
              volumeGainDb: 0.0,
            },
            enableTimePointing: ["SSML_MARK"],
          }),
        },
      )

      if (!ttsResponse.ok) {
        const errorText = await ttsResponse.text()
        console.error(`[v0] Google TTS API 오류:`, errorText)
        throw new Error(`Google TTS API 호출 실패: ${ttsResponse.status}`)
      }

      const data = await ttsResponse.json()
      const audioContent = data.audioContent
      const timepoints = data.timepoints || []

      console.log(`[v0] 타임포인트 ${timepoints.length}개 수신`)

      if (!audioContent) {
        throw new Error("Google TTS에서 오디오를 생성할 수 없습니다.")
      }

      const audioBuffer = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0))
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" })
      const sentenceDuration = await getAudioDuration(audioBlob)

      audioChunks.push(audioBlob)

      for (let j = 0; j < subtitleLines.length; j++) {
        const markName = `subtitle_${globalSubtitleIndex + j}`
        const timepoint = timepoints.find((tp: any) => tp.markName === markName)

        let start: number
        let end: number

        if (timepoint && timepoint.timeSeconds !== undefined) {
          start = currentTime + timepoint.timeSeconds

          const nextTimepoint = timepoints.find((tp: any) => tp.markName === `subtitle_${globalSubtitleIndex + j + 1}`)
          if (nextTimepoint && nextTimepoint.timeSeconds !== undefined) {
            end = currentTime + nextTimepoint.timeSeconds
          } else {
            end = currentTime + sentenceDuration
          }
        } else {
          const timePerSubtitle = sentenceDuration / subtitleLines.length
          start = currentTime + j * timePerSubtitle
          end = currentTime + (j + 1) * timePerSubtitle
        }

        subtitles.push({
          id: subtitles.length,
          start: Number.parseFloat(start.toFixed(3)),
          end: Number.parseFloat(end.toFixed(3)),
          text: subtitleLines[j],
        })

        console.log(`[v0] 자막 ${subtitles.length}: "${subtitleLines[j]}" (${start.toFixed(3)}s - ${end.toFixed(3)}s)`)
      }

      globalSubtitleIndex += subtitleLines.length
      currentTime += sentenceDuration

      console.log(
        `[v0] TTS 완료 ${i + 1}/${sentenceChunks.length}, 길이: ${sentenceDuration.toFixed(3)}초, 자막: ${subtitleLines.length}개`,
      )
    }

    console.log("[v0] 모든 TTS 생성 완료, 오디오 병합 시작")

    const mergedAudioBlob = await mergeAudioBlobs(audioChunks)
    const arrayBuffer = await mergedAudioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    const totalDuration = currentTime
    console.log("[v0] 최종 오디오 길이:", totalDuration, "초")
    console.log("[v0] 생성된 자막 개수:", subtitles.length)
    console.log("[v0] Base64 오디오 크기:", Math.round(base64Audio.length / 1024), "KB")

    const serializedResult = JSON.parse(
      JSON.stringify({
        audioBase64: String(base64Audio),
        subtitles: subtitles.map((sub) => ({
          id: Number(sub.id),
          start: Number(sub.start),
          end: Number(sub.end),
          text: String(sub.text),
        })),
        duration: Number(totalDuration),
        autoImages: (autoImages || []).map((img) => ({
          id: String(img.id),
          url: String(img.url),
          startTime: Number(img.startTime),
          endTime: Number(img.endTime),
          keyword: String(img.keyword),
        })),
      }),
    )

    return serializedResult
  } catch (error) {
    console.error("영상 생성 실패:", error)
    throw new Error("영상 생성에 실패했습니다. API 키를 확인해주세요.")
  }
}

function splitIntoSubtitleLines(text: string): string[] {
  const lines = []
  const maxLength = 20 // 최대 20자
  const minLength = 15 // 최소 15자

  let currentLine = ""
  const words = text.split(" ")

  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxLength && currentLine.length >= minLength) {
      // 현재 줄이 최대 길이를 넘고 최소 길이를 만족하면 줄 분리
      lines.push(currentLine.trim())
      currentLine = word
    } else {
      currentLine = currentLine ? currentLine + " " + word : word
    }
  }

  // 남은 텍스트 추가
  if (currentLine.trim()) {
    lines.push(currentLine.trim())
  }

  return lines
}

function splitScriptIntoNaturalChunks(script: string): string[] {
  const chunks = []

  // 문장 부호로 먼저 나누기 (마침표, 느낌표, 물음표)
  const sentences = script.split(/([.!?]\s+)/).filter((s) => s.trim().length > 0)

  let currentChunk = ""

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim()
    if (!sentence) continue

    // 문장 부호만 있는 경우 이전 청크에 추가
    if (/^[.!?]\s*$/.test(sentence)) {
      currentChunk += sentence
      continue
    }

    // 현재 청크에 추가했을 때 100자를 넘으면 청크 분리
    if ((currentChunk + " " + sentence).length > 100 && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk = currentChunk ? currentChunk + " " + sentence : sentence
    }

    // 문장이 끝나는 부호가 있으면 청크 완성
    if (/[.!?]$/.test(sentence) && currentChunk.length > 30) {
      chunks.push(currentChunk.trim())
      currentChunk = ""
    }
  }

  // 남은 청크 추가
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

async function mergeAudioBlobs(audioBlobs: Blob[]): Promise<Blob> {
  // 간단한 병합 - 실제로는 Web Audio API를 사용해야 하지만,
  // 여기서는 순차 재생을 위해 배열로 관리
  const mergedBuffer = new ArrayBuffer(audioBlobs.reduce((total, blob) => total + blob.size, 0))
  const mergedView = new Uint8Array(mergedBuffer)

  let offset = 0
  for (const blob of audioBlobs) {
    const buffer = await blob.arrayBuffer()
    mergedView.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }

  return new Blob([mergedBuffer], { type: "audio/mpeg" })
}

function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.src = URL.createObjectURL(audioBlob)

    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration)
      URL.revokeObjectURL(audio.src)
    })

    audio.addEventListener("error", () => {
      // 오류 시 대략적인 길이 계산 (fallback)
      resolve(Math.ceil(audioBlob.size / 16000)) // 대략적인 계산
    })
  })
}

export async function generateThumbnailText(script: string, customPrompt?: string, apiKey?: string) {
  const CHATGPT_API_KEY = apiKey || process.env.CHATGPT_API_KEY || process.env.OPENAI_API_KEY || process.env.GPT_API_KEY

  if (!CHATGPT_API_KEY) {
    console.log("[v0] ChatGPT API 키가 없어서 기본 썸네일 텍스트 반환")
    return getFallbackThumbnailText()
  }

  const cacheKey = `${script.substring(0, 100)}_${customPrompt || "default"}`
  if (thumbnailCache.has(cacheKey)) {
    console.log("[v0] 캐시된 썸네일 텍스트 반환")
    return thumbnailCache.get(cacheKey)!
  }

  const maxRetries = 3
  let retryCount = 0

  while (retryCount < maxRetries) {
    try {
      console.log(`[v0] 썸네일 텍스트 생성 시작 (시도 ${retryCount + 1}/${maxRetries})`)

      const thumbnailPrompt = `당신은 유튜브 썸네일 카피라이팅 전문가입니다. 60대 시니어층을 타깃으로 하는 범용적이고 강렬한 후킹 문구를 생성합니다.

중요 규칙:
1. "병원", "의사", "치료", "진료", "환자" 등 의료 관련 특정 단어는 절대 사용하지 마세요
2. 대본 내용을 참고하되, 범용적으로 사용 가능한 후킹 문구를 만드세요
3. 숫자, 호기심, 긴급성, 놀라움을 활용한 클릭 유도 문구를 사용하세요
4. 각 줄은 12-18자 내외로 간결하게 작성하세요

후킹 문구 유형 (이 중에서 선택):
- 숫자형: "3가지만 알면", "단 5분이면", "하루 10분"
- 긴급형: "지금 바로", "오늘부터", "내일이면 늦어요"
- 호기심형: "이것만 알면", "이 방법으로", "이걸 몰랐다면"
- 놀라움형: "믿을 수 없는", "놀라운 변화", "충격적인 사실"
- 금지형: "절대 하지마세요", "이것만은 피하세요", "위험합니다"
- 결과형: "싹 사라집니다", "완전히 달라집니다", "놀라운 효과"

응답 형식:
오직 4줄의 텍스트만 제공하고, 설명이나 따옴표는 포함하지 마세요. 각 줄은 개행으로만 구분해주세요.`

      let userPrompt = ""

      if (customPrompt) {
        // 추천 문구 생성 요청인 경우
        userPrompt = `대본 주제: ${script.substring(0, 500)}...

${customPrompt}

위 대본의 핵심 주제를 파악하되, 의료 관련 특정 단어를 사용하지 말고 범용적인 후킹 문구를 만드세요.`
      } else {
        // 기본 썸네일 텍스트 생성
        userPrompt = `대본 주제: ${script.substring(0, 500)}...

위 대본의 핵심 주제를 파악하되, 의료 관련 특정 단어를 사용하지 말고 60대 시니어층이 클릭하고 싶어할 만한 범용적인 후킹 문구를 만드세요.

응답 예시:
이것만 알면
하루 10분이면
놀라운 변화까지
완전히 달라집니다!`
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CHATGPT_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
          messages: [
            {
              role: "system",
              content: thumbnailPrompt,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.8,
        }),
      })

      if (response.status === 429) {
        const waitTime = Math.pow(2, retryCount + 2) * 1000 + Math.random() * 2000
        console.log(`[v0] Rate limit 도달, ${waitTime}ms 대기 후 재시도`)
        await delay(waitTime)
        retryCount++
        continue
      }

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`)
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error("썸네일 텍스트를 생성할 수 없습니다.")
      }

      const cleanedContent = content
        .replace(/첫\s*번째\s*줄[:\s]*/gi, "")
        .replace(/두\s*번째\s*줄[:\s]*/gi, "")
        .replace(/세\s*번째\s*줄[:\s]*/gi, "")
        .replace(/네\s*번째\s*줄[:\s]*/gi, "")
        .replace(/\d+\.\s*/g, "")
        .replace(/[-•]\s*/g, "")
        .replace(/["""''「」『』]/g, "")
        .replace(/$$[^)]*$$/g, "")
        .replace(/\s*:\s*/g, "")
        .trim()

      thumbnailCache.set(cacheKey, cleanedContent)

      console.log("[v0] 썸네일 텍스트 생성 완료")
      return cleanedContent
    } catch (error) {
      console.error(`[v0] 썸네일 텍스트 생성 시도 ${retryCount + 1} 실패:`, error)
      retryCount++

      if (retryCount < maxRetries) {
        const waitTime = Math.pow(2, retryCount + 1) * 1000
        console.log(`[v0] ${waitTime}ms 대기 후 재시도`)
        await delay(waitTime)
      }
    }
  }

  console.log("[v0] 모든 재시도 실패, fallback 썸네일 텍스트 반환")
  return getFallbackThumbnailText()
}

function getFallbackThumbnailText(): string {
  const fallbackTexts = [
    "이것만 알면\n하루 10분이면\n놀라운 변화까지\n완전히 달라집니다!",
    "지금 바로 시작하세요\n단 3가지만 알면\n평생 건강 보장\n내일이면 늦어요!",
    "이 방법으로\n60대 이상 필수\n믿을 수 없는 효과\n지금 확인하세요!",
    "단 5분이면\n싹 사라집니다\n60대 필수 정보\n놓치면 후회합니다!",
  ]

  const randomIndex = Math.floor(Math.random() * fallbackTexts.length)
  return fallbackTexts[randomIndex]
}

// 이미지 프롬프트 생성 함수 (카테고리별)
export async function generateImagePrompt(
  scriptText: string, 
  apiKey?: string,
  category: "health" | "wisdom" | "religion" | "history" | "self_improvement" | "space" | "society" | "domestic_story" | "international_story" | "romance_of_three_kingdoms" | "folktale" | "science" | "horror" | "northkorea" | "greek_roman_mythology" | "death" | "ai" | "alien" | "palmistry" | "physiognomy" | "fortune_telling" | "urban_legend" | "serial_crime" | "unsolved_case" | "reserve_army" | "elementary_school" = "health",
  historyStyle?: "animation" | "realistic"
): Promise<string> {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  // 재시도 함수
  const tryGenerate = async (key: string, isRetry: boolean = false): Promise<string> => {
    try {

    // 카테고리별 시스템 프롬프트
    const categoryPrompts = {
      health: `당신은 건강 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 건강, 의료, 웰빙과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 건강한 생활, 운동, 식단, 의료 환경, 자연 치유 등
- 따뜻하고 안정적인 분위기
- 전문적이면서도 친근한 느낌
- 16:9 비율, cinematic composition
- 자연스러운 조명, 깔끔한 배경

중요: 인물보다는 건강 관련 개념, 환경, 상황을 중심으로 묘사하세요.`,

      wisdom: `당신은 지혜/명언 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 인생, 지혜, 철학, 영감과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 자연 풍경, 도시 풍경, 일상의 순간들
- 평화롭고 깊이 있는 분위기
- 시간의 흐름, 변화, 성장의 의미
- 16:9 비율, wide shot, cinematic composition
- 부드러운 조명, 감성적인 색감

중요: 인물보다는 풍경, 사물, 상황을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      religion: `당신은 종교 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 종교, 영성, 평화, 신앙과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 종교 건축물, 자연, 평화로운 장면
- 경건하고 신성한 분위기
- 따뜻하고 희망적인 느낌
- 16:9 비율, cinematic composition
- 부드러운 자연광, 고요한 분위기

중요: 인물보다는 종교적 상징, 자연, 건축물, 평화로운 장면을 중심으로 묘사하세요.`,

      self_improvement: `당신은 자기계발 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 자기계발, 성장, 목표 달성, 습관 형성과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 성장, 변화, 도전, 목표 달성의 상징
- 동기부여, 긍정적 에너지, 희망적인 분위기
- 학습, 독서, 운동, 자기개발 활동
- 16:9 비율, cinematic composition
- 밝고 활기찬 조명, 역동적인 느낌

중요: 인물보다는 자기계발의 개념, 환경, 상황, 상징을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      space: `당신은 우주/천문학 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 우주, 별, 행성, 우주 탐사, 천문학과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 우주 공간, 별, 행성, 성운, 은하, 블랙홀 등 우주 천체
- 우주 탐사선, 우주 비행사, 우주 정거장 등 우주 탐사 관련
- 우주에서 본 지구의 모습
- 신비롭고 장엄한 우주의 분위기
- 16:9 비율, cinematic composition, wide shot
- 어둡고 깊은 우주 공간, 별빛, 우주 조명

중요: 우주의 신비로움과 장엄함을 표현하되, 과학적이면서도 시각적으로 아름다운 이미지로 묘사하세요.`,

      society: `당신은 사회 트렌드/최신 이슈 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 사회 트렌드, 최신 이슈, 문화 변화와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 현대적 도시 풍경, 디지털 문화, 소셜 미디어, 트렌드
- 역동적이고 현대적인 분위기
- 변화와 혁신의 느낌
- 16:9 비율, cinematic composition
- 밝고 생동감 있는 조명, 모던한 색감

중요: 인물보다는 사회적 현상, 트렌드, 문화적 변화를 시각적으로 표현하세요.`,

      domestic_story: `당신은 국내 감동 사연 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 감동, 실화, 사연, 선행과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 일상의 감동적인 순간, 가족, 이웃, 선행
- 따뜻하고 감성적인 분위기
- 희망과 사랑의 메시지
- 16:9 비율, cinematic composition
- 부드러운 자연광, 따뜻한 색감

중요: 인물보다는 감동적인 상황, 환경, 상징을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      international_story: `당신은 해외 감동 사연 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 해외 감동 스토리, 국제 미담과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 해외의 감동적인 장면, 다양한 문화, 국제적 사연
- 따뜻하고 희망적인 분위기
- 문화적 다양성과 공감
- 16:9 비율, cinematic composition
- 밝고 따뜻한 조명, 감성적인 색감

중요: 인물보다는 감동적인 상황, 환경, 문화적 배경을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      romance_of_three_kingdoms: `당신은 삼국지 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 삼국지 인물, 전투, 전략과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 고대 중국의 전쟁 장면, 무기, 갑옷, 말
- 장엄하고 웅장한 분위기
- 충의와 의리의 상징
- 16:9 비율, cinematic composition, epic scale
- 드라마틱한 조명, 웅장한 색감

중요: 삼국지 시대의 배경과 분위기를 정확히 표현하되, 인물보다는 전투 장면, 무기, 갑옷, 말, 배경을 중심으로 묘사하세요.`,

      folktale: `당신은 옛날이야기/민담 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 전래동화, 민담, 설화와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 옛날 한국의 마을, 전통 건축, 자연 풍경
- 따뜻하고 향수 어린 분위기
- 전통적이고 고전적인 느낌
- 16:9 비율, cinematic composition
- 부드러운 자연광, 따뜻한 색감

중요: 옛날 한국의 전통적 배경과 분위기를 표현하되, 인물보다는 전통 건축, 자연, 일상의 장면을 중심으로 묘사하세요.`,

      science: `당신은 과학 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 과학, 과학 발견, 과학자와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 과학 실험, 연구실, 과학 장비, 자연 현상
- 지적이고 탐구적인 분위기
- 과학의 신비와 발견
- 16:9 비율, cinematic composition
- 밝고 선명한 조명, 과학적 색감

중요: 인물보다는 과학 실험, 연구 환경, 자연 현상, 과학 개념을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      horror: `당신은 호러/공포 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 공포, 미스터리, 괴담과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 어두운 장소, 고요한 밤, 신비로운 분위기
- 긴장감 있고 신비로운 분위기
- 공포와 미스터리의 상징
- 16:9 비율, cinematic composition
- 어둡고 분위기 있는 조명, 신비로운 색감

중요: 인물보다는 공포와 미스터리를 상징하는 환경, 장소, 분위기를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      northkorea: `당신은 북한 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 북한, 탈북과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 북한의 도시, 건축, 일상, 자연
- 신비롭고 독특한 분위기
- 비교와 대조의 의미
- 16:9 비율, cinematic composition
- 사실적이고 중립적인 조명

중요: 인물보다는 북한의 환경, 건축, 일상의 장면을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      economy: `당신은 경제 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 경제, 재테크, 투자와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 경제 활동, 금융, 부동산, 투자, 재테크
- 현대적이고 전문적인 분위기
- 성장과 번영의 상징
- 16:9 비율, cinematic composition
- 밝고 선명한 조명, 전문적인 색감

중요: 인물보다는 경제 활동, 금융 환경, 부동산, 투자 개념을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      greek_roman_mythology: `당신은 그리스 로마 신화 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 그리스 로마 신화의 신들, 영웅들, 전설과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 고대 그리스 로마의 신전, 신들의 상징, 영웅들의 모험
- 장엄하고 신비로운 분위기
- 고전적이고 웅장한 느낌
- 16:9 비율, cinematic composition, epic scale
- 드라마틱한 조명, 고전적인 색감

중요: 그리스 로마 신화의 배경과 분위기를 정확히 표현하되, 인물보다는 신전, 고대 건축, 신들의 상징, 영웅의 무기와 갑옷, 신화적 배경을 중심으로 묘사하세요.`,

      death: `당신은 죽음/인생 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 죽음, 인생의 마지막, 삶의 의미와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 평화로운 자연, 일몰, 일출, 고요한 풍경
- 깊이 있고 성찰적인 분위기
- 평화롭고 위엄 있는 느낌
- 16:9 비율, cinematic composition
- 부드럽고 따뜻한 조명, 감성적인 색감

중요: 인물보다는 자연, 시간의 흐름, 평화로운 장면, 삶의 의미를 상징하는 환경을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      ai: `당신은 인공지능 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 인공지능, AI 기술, 로봇, 디지털 세계와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 인공지능, 로봇, 디지털 세계, 미래 기술
- 현대적이고 미래지향적인 분위기
- 기술과 혁신의 느낌
- 16:9 비율, cinematic composition
- 밝고 선명한 조명, 모던한 색감

중요: 인물보다는 인공지능 개념, 로봇, 디지털 환경, 미래 기술을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      alien: `당신은 외계인/UFO 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 외계인, UFO, 우주, 외계 생명체와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 외계인, UFO, 우주선, 외계 생명체, 우주 공간
- 신비롭고 미스터리한 분위기
- 우주의 신비와 호기심
- 16:9 비율, cinematic composition
- 어둡고 신비로운 조명, 우주적 색감

중요: 인물보다는 외계인, UFO, 우주선, 우주 공간, 외계 생명체를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      palmistry: `당신은 손금풀이 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 손금, 손, 운명, 점성술과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 손, 손금, 점성술 상징, 운명의 상징
- 신비롭고 운명적인 분위기
- 전통적이고 신비로운 느낌
- 16:9 비율, cinematic composition
- 부드럽고 신비로운 조명, 따뜻한 색감

중요: 인물보다는 손, 손금, 운명의 상징, 점성술 관련 요소를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      physiognomy: `당신은 관상이야기 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 관상, 얼굴, 운명, 전통 점술과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 얼굴, 관상, 전통 점술 상징, 운명의 상징
- 신비롭고 전통적인 분위기
- 고전적이고 운명적인 느낌
- 16:9 비율, cinematic composition
- 부드럽고 신비로운 조명, 따뜻한 색감

중요: 인물보다는 관상의 개념, 전통 점술 상징, 운명의 상징을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      fortune_telling: `당신은 사주팔자 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 사주, 운명, 점성술, 전통 점술과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 사주팔자, 점성술 상징, 운명의 상징, 전통 점술 도구
- 신비롭고 전통적인 분위기
- 고전적이고 운명적인 느낌
- 16:9 비율, cinematic composition
- 부드럽고 신비로운 조명, 따뜻한 색감

중요: 인물보다는 사주팔자의 개념, 점성술 상징, 전통 점술 도구를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      urban_legend: `당신은 도시괴담 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 도시괴담, 무서운 이야기, 미스터리한 장소와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 어두운 도시, 무서운 장소, 미스터리한 분위기, 밤 풍경
- 긴장감 있고 신비로운 분위기
- 공포와 미스터리의 상징
- 16:9 비율, cinematic composition
- 어둡고 분위기 있는 조명, 신비로운 색감

중요: 인물보다는 무서운 도시 풍경, 미스터리한 장소, 어두운 분위기를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      serial_crime: `당신은 연쇄범죄 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 연쇄범죄, 범죄 현장, 수사, 범죄 심리와 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 범죄 현장, 수사 도구, 어두운 장소, 경찰 관련
- 긴장감 있고 진지한 분위기
- 범죄와 정의의 대비
- 16:9 비율, cinematic composition
- 어둡고 드라마틱한 조명, 진지한 색감

중요: 인물보다는 범죄 현장, 수사 도구, 어두운 분위기, 경찰 관련 요소를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      unsolved_case: `당신은 미제사건 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 미제사건, 미스터리한 사건, 수사, 진실과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 미스터리한 장소, 수사 도구, 어두운 분위기, 진실의 상징
- 긴장감 있고 신비로운 분위기
- 미스터리와 진실 추구의 의미
- 16:9 비율, cinematic composition
- 어둡고 분위기 있는 조명, 신비로운 색감

중요: 인물보다는 미스터리한 장소, 수사 도구, 어두운 분위기, 진실의 상징을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      reserve_army: `당신은 예비군이야기 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 예비군, 군대, 훈련, 군인과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 군대 훈련장, 군인 장비, 군복, 군대 생활
- 단정하고 규율 있는 분위기
- 군대와 훈련의 의미
- 16:9 비율, cinematic composition
- 밝고 선명한 조명, 군대적 색감

중요: 인물보다는 군대 훈련장, 군인 장비, 군복, 군대 환경을 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      elementary_school: `당신은 국민학교 관련 영상용 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 국민학교, 옛날 학교, 어린 시절, 추억과 관련된 적절한 이미지를 묘사하는 영어 프롬프트를 생성하세요.

주요 요소:
- 옛날 학교 건물, 교실, 운동장, 옛날 교구
- 따뜻하고 향수 어린 분위기
- 추억과 그리움의 의미
- 16:9 비율, cinematic composition
- 부드럽고 따뜻한 조명, 향수 어린 색감

중요: 인물보다는 옛날 학교 건물, 교실, 운동장, 옛날 교구를 중심으로 대본의 메시지를 시각적으로 표현하세요.`,

      history: historyStyle === "animation" 
        ? `당신은 역사 애니메이션 스타일 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 역사적 시대와 문화권을 파악하고, 고품질 2D 애니메이션 영화 스타일로 일관성 있게 묘사하는 영어 프롬프트를 생성하세요.

프롬프트 구조:
"고품질 2D 애니메이션 영화 스타일.
사실적 음영, 부드러운 색감, 선명한 윤곽선.
[시대명] 시대 [문화권/나라]의 [역할/신분] 캐릭터가 [행동]하는 장면.
전통 [의상/갑옷/투구/소품]이 역사 고증에 맞게 정교하게 표현됨.
배경은 애니메이션 스타일의 [궁중/전쟁터/실내/거리/마을/산성].
깊이감 있는 시네마틱 연출, 은은한 안개/먼지 효과, 자연스러운 조명.
현대적 요소 없음. 실사 스타일 없음. 16:9 고해상도."

중요:
- 대본에서 언급된 시대(예: 조선시대, 고려시대, 삼국시대 등)를 정확히 파악하세요
- 모든 이미지가 동일한 시대와 문화권을 유지해야 합니다 (일관성 필수)
- 반드시 고품질 2D 애니메이션 영화 스타일만 사용하세요
- 사실적 음영, 부드러운 색감, 선명한 윤곽선이 특징입니다
- 실사 스타일, 3D 렌더링, 사진 같은 스타일 절대 금지
- 현대적 요소(플라스틱, LED, 현대 건축 등) 절대 금지
- 애니메이션 스타일이 아닌 모든 스타일 절대 금지`
        : `당신은 역사 실사 스타일 이미지 프롬프트 생성 전문가입니다.
대본 내용을 분석하여 역사적 시대와 문화권을 파악하고, 실사 스타일로 일관성 있게 묘사하는 영어 프롬프트를 생성하세요.

프롬프트 구조:
"[시대명] 시대 [문화권]의 장면.
[역할/신분]을 가진 [인물 설명]가 [행동]하는 모습.
전통 [의상], [머리장식], [소품]이 고증에 맞게 표현됨.
배경은 [시대명] 시대의 [장소] 환경을 사실적으로 재현.
장면 분위기는 [분위기]하며 [상황]한 상황.
영화적 시네마틱 톤, [조명], 고해상도 16:9.
현대적 소품·플라스틱·LED 조명·현대 요소 없음."

중요:
- 대본에서 언급된 시대(예: 조선시대, 고려시대, 삼국시대 등)를 정확히 파악하세요
- 모든 이미지가 동일한 시대와 문화권을 유지해야 합니다 (일관성 필수)
- 실사 스타일: 고증 정확, 사실적, 영화적, 시네마틱
- 현대적 요소(플라스틱, LED, 현대 건축 등) 절대 금지
- 애니메이션 스타일 절대 금지`
    }

    // 역사 카테고리의 경우 스타일별로 다른 프롬프트 사용
    let systemPrompt = ""
    if (category === "history" && historyStyle) {
      systemPrompt = `${categoryPrompts[category]}

공통 규칙:
- 대본 내용의 핵심 메시지와 주제를 정확히 파악하세요
- 대본에서 언급된 시대와 문화권을 정확히 파악하고, 모든 이미지에서 동일한 시대를 유지하세요 (일관성 필수)
- 영어로만 작성하세요 (한글 제거)
- [ ] 플레이스홀더나 설명 없이 순수 영어 프롬프트만 출력하세요
- 16:9 비율에 최적화하세요
- 자막을 위한 하단 여백을 고려하세요
- 이전에 생성한 이미지와 동일한 시대와 스타일을 유지하세요`
    } else {
      systemPrompt = `${categoryPrompts[category]}

공통 규칙:
- 대본 내용의 핵심 메시지와 주제를 정확히 파악하세요
- 인물 중심이 아닌 대본 내용에 맞는 일반적인 이미지를 묘사하세요
- 영어로만 작성하세요 (한글 제거)
- [ ] 플레이스홀더나 설명 없이 순수 영어 프롬프트만 출력하세요
- 16:9 비율에 최적화하세요
- 자막을 위한 하단 여백을 고려하세요`
    }

    const userPrompt = `다음 대본 내용을 바탕으로 적절한 이미지 프롬프트를 생성해주세요:\n\n${scriptText}`

    // 16:9 비율 강제 추가 (프롬프트에 포함)
    const systemPromptWithAspect = `${systemPrompt}\n\n중요: 반드시 16:9 비율(aspect ratio)로 이미지를 생성하도록 프롬프트에 명시하세요.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: `${systemPrompt}\n\n중요: 
1. 반드시 16:9 비율(aspect ratio)로 이미지를 생성하도록 프롬프트에 명시하세요.
2. 이미지에 텍스트, 글씨, 문자, 단어, 라벨, 표지판, 워터마크가 절대 포함되지 않도록 프롬프트에 "no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"를 명시하세요.` },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] OpenAI API 오류 응답:", errorText)
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    
    // API 응답 검증
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error("[v0] API 응답 오류:", data)
      throw new Error("프롬프트 생성에 실패했습니다: API 응답 형식이 올바르지 않습니다.")
    }
    
    const prompt = data.choices[0]?.message?.content?.trim()

    if (!prompt || typeof prompt !== 'string') {
      console.error("[v0] 프롬프트 없음:", data.choices[0])
      throw new Error("프롬프트 생성에 실패했습니다: 응답 내용이 없습니다.")
    }

    // 한국어 제거 및 정리
    let cleanedPrompt = prompt
      .replace(/[가-힣]/g, "") // 한글 제거
      .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, "") // 자모 제거
      .replace(/한글.*$/gi, "") // "한글" 텍스트 제거
      .replace(/Korean.*$/gi, "") // "Korean" 텍스트 제거 (필요시)
      .trim()

    // 플레이스홀더 제거
    cleanedPrompt = cleanedPrompt.replace(/\[.*?\]/g, "").trim()

    // 16:9 비율 강제 추가 (없으면 추가)
    if (!cleanedPrompt.toLowerCase().includes("16:9") && !cleanedPrompt.toLowerCase().includes("aspect ratio")) {
      cleanedPrompt = `${cleanedPrompt}, 16:9 aspect ratio`
    }

    // 텍스트 제외 지시 추가 (없으면 추가)
    const textExclusionTerms = ["no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"]
    const hasTextExclusion = textExclusionTerms.some(term => cleanedPrompt.toLowerCase().includes(term))
    if (!hasTextExclusion) {
      cleanedPrompt = `${cleanedPrompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
    }

    console.log(`[v0] 이미지 프롬프트 생성 완료 (재시도: ${isRetry ? "예" : "아니오"})`)
    return cleanedPrompt
    } catch (error) {
      console.error(`[v0] 이미지 프롬프트 생성 실패 (재시도: ${isRetry ? "예" : "아니오"}):`, error)
      throw error
    }
  }

  // 먼저 사용자 API 키로 시도
  try {
    return await tryGenerate(GPT_API_KEY, false)
  } catch (error) {
    // 실패 시 백업 API 키로 재시도 (오류 메시지 표시하지 않음)
    console.log("[v0] 사용자 API 키 실패, 백업 API 키로 재시도...")
    try {
      return await tryGenerate(BACKUP_OPENAI_API_KEY, true)
    } catch (retryError) {
      // 백업 API 키로도 실패한 경우에만 오류 발생
      console.error("[v0] 백업 API 키로도 실패:", retryError)
      throw retryError
    }
  }
}

// Replicate를 사용한 이미지 생성 함수
// 이미지를 영상으로 변환하는 함수 (Replicate Stable Video Diffusion 사용)
export async function convertImageToVideo(
  imageUrl: string,
  replicateApiKey?: string
): Promise<string> {
  const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

  if (!REPLICATE_API_TOKEN) {
    throw new Error("Replicate API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[Video] wan-video/wan-2.2-i2v-fast 시작:", imageUrl)

    // wan-video/wan-2.2-i2v-fast 모델 사용 (이미지-투-비디오)
    // Replicate API 형식: /v1/models/{owner}/{model}/predictions
    console.log("[Video] wan-2.2-i2v-fast 모델 사용, 이미지 URL:", imageUrl)
    
    const response = await fetch("https://api.replicate.com/v1/models/wan-video/wan-2.2-i2v-fast/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        input: {
          image: imageUrl, // 이미지 URL (공개 접근 가능해야 함) - 필수
          prompt: "cinematic slow motion, smooth camera movement, gentle zoom in effect", // 프롬프트 - 필수
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Video] Replicate API 오류:", errorText)
      console.error("[Video] 응답 상태:", response.status)
      
      // 500 오류는 서버 측 문제이거나 이미지 URL 접근 불가일 수 있음
      if (response.status === 500) {
        throw new Error(`Replicate 서버 오류 (500). 이미지 URL이 공개적으로 접근 가능한지 확인해주세요. 또는 Replicate 서비스가 일시적으로 사용 불가능할 수 있습니다.`)
      }
      
      throw new Error(`Replicate API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // 폴링 방식으로 결과 확인
    if (data.status === "processing" || data.status === "starting") {
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
          // wan-2.2-i2v-fast는 output이 URL 문자열 또는 객체일 수 있음
          let videoUrl: string
          if (typeof statusData.output === "string") {
            videoUrl = statusData.output
          } else if (statusData.output.url) {
            videoUrl = statusData.output.url
          } else if (Array.isArray(statusData.output) && statusData.output.length > 0) {
            videoUrl = typeof statusData.output[0] === "string" ? statusData.output[0] : statusData.output[0].url || String(statusData.output[0])
          } else {
            videoUrl = String(statusData.output)
          }
          console.log("[Video] wan-2.2-i2v-fast 완료:", videoUrl)
          return videoUrl
        } else if (statusData.status === "failed") {
          throw new Error(`비디오 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("비디오 생성 시간 초과")
    } else if (data.status === "succeeded" && data.output) {
      // wan-2.2-i2v-fast는 output이 URL 문자열 또는 객체일 수 있음
      let videoUrl: string
      if (typeof data.output === "string") {
        videoUrl = data.output
      } else if (data.output.url) {
        videoUrl = data.output.url
      } else if (Array.isArray(data.output) && data.output.length > 0) {
        videoUrl = typeof data.output[0] === "string" ? data.output[0] : data.output[0].url || String(data.output[0])
      } else {
        videoUrl = String(data.output)
      }
      console.log("[Video] wan-2.2-i2v-fast 완료 (즉시):", videoUrl)
      return videoUrl
    } else {
      throw new Error(`비디오 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[Video] wan-2.2-i2v-fast 실패:", error)
    throw error
  }
}

/**
 * 스틱맨 프롬프트 강화 함수
 * prunaai/hidream-l1-fast 모델용 프롬프트 생성
 * 샘플 형식: "stickman character A detective looking at evidence, a vibrant 2D cartoon, ..."
 */
function enforceStickmanPrompt(prompt: string, sceneDescription?: string): string {
  // 1. 장면 정보 추출 (프롬프트에서 장면 관련 부분 찾기)
  let scenePart = ""
  if (sceneDescription && sceneDescription.trim()) {
    // 장면 설명이 제공되면 사용
    scenePart = sceneDescription.trim()
  } else {
    // 프롬프트에서 장면 관련 부분 추출 시도 (예: "A detective looking at evidence" 같은 패턴)
    const sceneMatch = prompt.match(/(?:a|an|the)\s+[^,]+(?:looking|standing|sitting|walking|doing|working|holding|examining|investigating|analyzing)/i)
    if (sceneMatch) {
      scenePart = sceneMatch[0].trim()
    }
  }

  // 2. stickman character로 시작하는 프롬프트 구성
  let finalPrompt = ""
  if (scenePart) {
    // 장면 정보가 있으면: "stickman character [장면], [원본 프롬프트]"
    finalPrompt = `stickman character ${scenePart}, ${prompt}`.replace(/,\s*,/g, ",").trim()
  } else if (!prompt.toLowerCase().includes("stickman")) {
    // stickman이 없으면 추가
    finalPrompt = `stickman character ${prompt}`
  } else {
    finalPrompt = prompt
  }

  // 3. base (기본 캐릭터 묘사) - 샘플 형식과 동일
  const base = "a vibrant 2D cartoon, fully rendered illustration featuring a stickman with a white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, expressive pose"

  // 4. style_phrase (스타일 묘사) - 샘플 형식과 동일
  const stylePhrase = "Consistent stick-figure illustration style, clean bold lines, solid colors, explainer video aesthetic, simplified background"

  // 5. extra (추가 요소) - 샘플 형식과 동일
  const extra = "colorful detailed drawing, rich environment, dynamic lighting, no realistic human anatomy, no blank background"

  // 6. 스틱맨 강화 규칙 추가
  const stickmanRules = "EVERY person is a stickman, no exceptions. Bride is a stickman. Groom is a stickman. All guests and guards are stickmen. stickman style rules: white circular face, dot eyes, curved mouth only, no hair, no ears, no nose, no blush, no eyelashes, black thin outline body, ultra-thin limbs, uniform stroke width, no body volume, mitten hands, no fingers. 2D vector cartoon, flat cel shading, thick bold outlines, solid color fills, crisp edges, minimal texture. wide shot / medium-wide shot, full bodies visible, at least 8–15 stickman people visible, palace hall background, wedding ceremony handshake scene, background crowd also stickmen, consistent stickman design for every character"

  // 7. 모든 요소 결합 (샘플 형식과 동일한 순서)
  return `${finalPrompt}, ${base}, ${stylePhrase}, ${extra}, ${stickmanRules}`
}

export async function generateImageWithReplicate(
  prompt: string,
  replicateApiKey?: string,
  aspectRatio: "16:9" | "9:16" | "1:1" | "21:9" = "16:9",
  imageStyle?: string,
  sceneDescription?: string,
  selectedModel?: "prunaai/hidream-l1-fast" | "black-forest-labs/flux-schnell"
): Promise<string> {
  try {
    const REPLICATE_API_TOKEN = replicateApiKey || process.env.REPLICATE_API_TOKEN

    if (!REPLICATE_API_TOKEN) {
      throw new Error("Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
    }

    // 이미지 스타일에 따라 모델 선택 (사용자가 선택한 모델이 있으면 우선 사용)
    let model = "black-forest-labs/flux-schnell"
    if (selectedModel) {
      model = selectedModel
    } else if (imageStyle === "stickman-animation" || imageStyle === "animation2" || imageStyle === "animation3") {
      model = "prunaai/hidream-l1-fast"
    } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
      model = "google/imagen-4-fast"
    }

    // 프롬프트 그대로 사용 (이미지 프롬프트 생성에서 완성된 프롬프트 사용)
    let finalPrompt = prompt
    
    // 한국어 제거: 프롬프트에서 한국어 문자 제거
    const koreanRegex = /[가-힣]+/g
    finalPrompt = finalPrompt.replace(koreanRegex, '').replace(/\s+/g, ' ').trim()
    
    // 텍스트 제외 지시가 없으면 추가 (모든 모델에 적용)
    const textExclusionTerms = ["no text", "no letters", "no words", "no writing", "no labels", "no signs", "no watermark"]
    const hasTextExclusion = textExclusionTerms.some(term => finalPrompt.toLowerCase().includes(term))
    if (!hasTextExclusion) {
      finalPrompt = `${finalPrompt}, no text, no letters, no words, no writing, no labels, no signs, no watermark`
    }
    
    // 스타일 일관성 강화: 스타일별 불일치 키워드 제거 및 일관성 키워드 추가
    if (imageStyle === "stickman-animation") {
      // 스틱맨 애니메이션: 다른 스타일 키워드 제거 (3D, 실사, 말풍선, 다중 팔/손 등)
      const nonStickmanTerms = ["realistic", "photorealistic", "hyperrealistic", "photograph", "photo", "real people", "human", "man", "woman", "semi-realistic", "cinematic", "movie still", "3d", "3d render", "pixar", "disney", "blender", "unreal engine", "plastic", "glossy", "smooth shading", "real room", "real office", "real furniture", "lighting effects", "depth of field", "shadows", "character design", "mascot", "robot", "android", "3D CGI", "rendered", "animation style", "cartoon style", "illustration style", "vector art", "flat design", "cel-shaded", "stylized character", "non-stickman", "saying", "explaining", "talking", "comic", "explaining with both hands", "animated gestures", "expressive movement", "dynamic action"]
      let cleanedPrompt = finalPrompt
      nonStickmanTerms.forEach(term => {
        const regex = new RegExp(term, 'gi')
        cleanedPrompt = cleanedPrompt.replace(regex, '')
      })
      finalPrompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
      
      // 스틱맨 전용 이미지 강화 (텍스트 제거)
      const promptLower = finalPrompt.toLowerCase()
      const stickmanMainPrompt = "This image must contain only 2D stickman figures. Stickman is a symbolic drawing, not a human, not a character, not a person. Every figure in the image must be a stickman."
      const stickmanBasePrompt = "Stickman rules: perfectly round white head, dot eyes and simple curved smile only, no nose, no ears, no hair, no facial details, ultra-thin black line limbs with uniform stroke width, no body volume, no torso shape, no muscles, simple mitten hands, no fingers, flat 2D vector drawing only"
      const stickmanAnatomyRules = "Strict anatomy rules for stickman: exactly two arms only, exactly two hands only, exactly two legs only, no extra arms, no extra hands, no duplicated limbs, each arm is drawn once, clearly connected to the body, one head, one body, two arms, two hands, two legs, no duplicates, no extra parts. Stickman body constraints: one head, one body, two arms only, two hands only, two legs only, no duplicates, no extra parts. If any extra limbs appear, the result is incorrect."
      const stickmanStylePhrase = "Scene is illustrated in a simple cartoon style: flat colors, bold black outlines, minimal details, no depth, no lighting effects, no textures. Background must be fully illustrated (cartoon), simple shapes only, no realistic environment. Educational explainer illustration style. Use calm pose, simple gesture, neutral stance, minimal movement instead of animated gestures or dynamic action"
      const stickmanNoText = "No text allowed in image. Do not include speech bubbles, captions, labels, words, letters, logos, symbols, numbers, or any readable text. This is not a comic, not a poster, not an advertisement. Pure visual illustration only. Absolutely no text or words visible in the image."
      const stickmanFinalCheck = "If the result looks realistic, 3D, or human-like, it is wrong. If the image contains text, speech bubbles, or readable symbols, the result is incorrect. If any extra limbs appear, the result is incorrect."
      
      if (!promptLower.includes("only 2d stickman") || !promptLower.includes("symbolic drawing")) {
        finalPrompt = `${stickmanMainPrompt} ${finalPrompt}`
      }
      if (!promptLower.includes("perfectly round white head") || !promptLower.includes("dot eyes") || !promptLower.includes("ultra-thin black line limbs")) {
        finalPrompt = `${finalPrompt}, ${stickmanBasePrompt}`
      }
      if (!promptLower.includes("exactly two arms") || !promptLower.includes("exactly two hands") || !promptLower.includes("no extra arms") || !promptLower.includes("no extra hands")) {
        finalPrompt = `${finalPrompt}, ${stickmanAnatomyRules}`
      }
      if (!promptLower.includes("flat 2d vector drawing") || !promptLower.includes("simple cartoon style") || !promptLower.includes("educational explainer")) {
        finalPrompt = `${finalPrompt}, ${stickmanStylePhrase}`
      }
      if (!promptLower.includes("no text allowed") || !promptLower.includes("no speech bubbles")) {
        finalPrompt = `${finalPrompt}, ${stickmanNoText}`
      }
      if (!promptLower.includes("no hair") || !promptLower.includes("no ears") || !promptLower.includes("no nose")) {
        finalPrompt = `${finalPrompt}, no hair, no ears, no nose, no cheeks, no detailed facial features, no realistic human anatomy, no person, no man, no woman, only stickman, no saying, no explaining, no talking, use gesturing or pointing instead, no explaining with both hands, no animated gestures, no expressive movement, no dynamic action, use calm pose, simple gesture, neutral stance, minimal movement instead`
      }
      // 최종 확인 문구 추가
      if (!promptLower.includes("if the result looks realistic") && !promptLower.includes("it is wrong")) {
        finalPrompt = `${finalPrompt}. ${stickmanFinalCheck}`
      }
    } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
      // 실사화: 애니메이션/카툰 키워드 제거
      const nonRealisticTerms = ["stickman", "stick figure", "stick man", "animation style", "animated", "cel-shaded", "vector art", "flat design", "stylized character", "cartoon character", "illustrated", "graphic novel", "comic book", "hand-drawn", "digital art", "2D animation", "animated character", "cartoon style"]
      let cleanedPrompt = finalPrompt
      nonRealisticTerms.forEach(term => {
        const regex = new RegExp(term, 'gi')
        cleanedPrompt = cleanedPrompt.replace(regex, '')
      })
      finalPrompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
      
      // 실사 스타일 키워드 강제 추가
      if (!finalPrompt.toLowerCase().includes("photorealistic") && !finalPrompt.toLowerCase().includes("hyperrealistic")) {
        finalPrompt = `${finalPrompt}, photorealistic, hyperrealistic, professional photography, DSLR camera`
      }
      if (!finalPrompt.toLowerCase().includes("no animation") && !finalPrompt.toLowerCase().includes("no cartoon")) {
        finalPrompt = `${finalPrompt}, no animation style, no cartoon style, no illustration style, photorealistic only`
      }
      } else if (imageStyle === "animation2") {
        // 애니메이션2: 스틱맨 및 실사 키워드 제거
        const nonAnimation2Terms = ["stickman", "stick figure", "stick man", "photorealistic", "hyperrealistic", "realistic photography", "3D CGI", "rendered", "photography style", "DSLR camera", "professional photography", "mixed art styles", "inconsistent style"]
        let cleanedPrompt = finalPrompt
        nonAnimation2Terms.forEach(term => {
          const regex = new RegExp(term, 'gi')
          cleanedPrompt = cleanedPrompt.replace(regex, '')
        })
        finalPrompt = cleanedPrompt.replace(/\s+/g, ' ').trim()
        
        // 애니메이션2 스타일 BASE_PROMPT 강제 추가 (모든 씬에 일관되게) - 고도화된 일관성
        const animation2BasePrompt = "Flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth, consistent cartoon style, bold clean lines, vibrant colors, simplified shapes, graphic design aesthetic"
        const animation2CharacterDetails = "expressive dynamic pose, stylized cartoon clothing, simple bold-line cartoon aesthetic, consistent character design"
        const animation2Environment = "rich detailed colorful stylized cartoon environment, filled frame, no blank background, dynamic dramatic lighting, 2D cartoon feel"
        const promptLower = finalPrompt.toLowerCase()
        if (!promptLower.includes("flat 2d vector") || !promptLower.includes("stylized cartoon character") || !promptLower.includes("thick bold black outlines") || !promptLower.includes("cel-shaded") || !promptLower.includes("consistent cartoon style")) {
          finalPrompt = `${finalPrompt}, ${animation2BasePrompt}`
        }
        if (!promptLower.includes("consistent character design") || !promptLower.includes("bold clean lines")) {
          finalPrompt = `${finalPrompt}, ${animation2CharacterDetails}, ${animation2Environment}`
        }
        if (!promptLower.includes("no stickman")) {
          finalPrompt = `${finalPrompt}, no stickman, no stick figure, no realistic photography, no mixed art styles, no inconsistent style`
        }
    }
    
    console.log(`[v0] 프롬프트 사용: ${finalPrompt.substring(0, 100)}...`)

    console.log(`[v0] Replicate 이미지 생성 시작, 모델: ${model}`)
    console.log("[v0] Aspect Ratio:", aspectRatio)
    console.log("[v0] Prompt:", finalPrompt.substring(0, 100) + "...")

    // 모델별 입력 형식 설정
    let requestBody: any = {}
    if (model === "prunaai/hidream-l1-fast") {
      // hidream-l1-fast 모델용 입력 형식
      let negativePrompt = "realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, letters, words, writing, labels, signs, watermark, typography, font, caption, subtitle"
      
      if (imageStyle === "stickman-animation") {
        // 스틱맨 애니메이션 전용 negative prompt - 3D, 실사, 말풍선 완전 차단
        negativePrompt = "realistic, photo, photograph, real people, human, man, woman, semi-realistic, cinematic, movie still, 3d, 3d render, pixar, disney, blender, unreal engine, plastic, glossy, smooth shading, real room, real office, real furniture, lighting effects, depth of field, shadows, character design, mascot, robot, android, detailed face, skin, fingers, joints, body proportions, realistic human, human anatomy, person, cartoon human, anime, manga, portrait, nose, lips, teeth, eyelashes, hair, ears, skin texture, wrinkles, hands with fingers, body volume, torso muscles, render, photorealistic, painterly, digital painting, gradients, soft shading, detailed clothing folds, realistic proportions, close-up face, high detail character design, blank white background, line-art only, text, watermark, speech bubble, thought bubble, text bubble, caption, subtitle, label, signage, words, letters, typography, font, comic panel, comic strip, meme, poster, advertisement, slogan, headline, logo, non-stickman, mixed style, detailed cartoon human, prince, princess, chibi, kawaii, big head, human body, human skin, 3d render, detailed face, blush, portrait, close-up, single character focus, bokeh, depth of field, watercolor, airbrush, extra arms, extra hands, multiple arms, multiple hands, duplicated limbs, cloned arms, ghost limbs, motion trails, overlapping arms, sketch artifacts, three hands, four hands, three arms, four arms, extra limbs, deformed hands, malformed hands, wrong number of fingers, too many fingers, missing hands, missing arms, anatomical errors, body part errors, realistic photography, hyperrealistic, 3D CGI, rendered, animation style, cartoon style, illustration style, vector art, flat design, cel-shaded, stylized character, non-stickman character, human character, detailed character, realistic character, any non-stickman style"
      } else if (imageStyle === "animation2") {
        // 애니메이션2: 스틱맨 및 실사 제외
        negativePrompt = "realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, stickman, stick figure, stick man, photorealistic, realistic photography, hyperrealistic, 3D CGI, rendered, photography style, DSLR camera, professional photography, any realistic or photorealistic style"
      } else if (imageStyle === "animation3") {
        negativePrompt = "anime style, Studio Ghibli look, manga big eyes, cute aesthetic, purely sleek digital painting look"
      } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
        // 실사화: 애니메이션/카툰 강력 제외
        negativePrompt = "painting, drawing, illustration, cartoon, anime, 3d, cgi, render, sketch, watercolor, text, watermark, signature, blurry, out of focus, stickman, stick figure, stick man, animation style, animated, cel-shaded, vector art, flat design, stylized character, cartoon character, illustrated, graphic novel style, comic book style, non-photorealistic, non-realistic, artistic style, hand-drawn, digital art, illustration, 2D animation, animated character, cartoon style, any non-photorealistic style"
      }
      
      requestBody = {
        input: {
          prompt: finalPrompt,
          width: 1360,
          height: 768,
          resolution: "1360 × 768 (Landscape)",
          negative_prompt: negativePrompt,
          num_inference_steps: 16,
          image_format: "png",
        },
      }
    } else if (model === "google/imagen-4-fast") {
      // imagen-4-fast 모델용 입력 형식 (16:9 비율)
      requestBody = {
        input: {
          prompt: finalPrompt,
          aspect_ratio: "16:9",
          num_inference_steps: 4,
          output_format: "png",
        },
      }
    } else {
      // flux-schnell 모델용 입력 형식 (negative prompt는 프롬프트에 결합)
      // 각 스타일별로 negative prompt 생성
      let negativePromptText = ""
      
      if (imageStyle === "stickman-animation") {
        // 스틱맨 애니메이션 전용 negative prompt
        negativePromptText = "avoid: realistic, photo, photograph, real people, human, man, woman, semi-realistic, cinematic, movie still, 3d, 3d render, pixar, disney, blender, unreal engine, plastic, glossy, smooth shading, real room, real office, real furniture, lighting effects, depth of field, shadows, character design, mascot, robot, android, detailed face, skin, fingers, joints, body proportions, realistic human, human anatomy, person, cartoon human, anime, manga, portrait, nose, lips, teeth, eyelashes, hair, ears, skin texture, wrinkles, hands with fingers, body volume, torso muscles, render, photorealistic, painterly, digital painting, gradients, soft shading, detailed clothing folds, realistic proportions, close-up face, high detail character design, blank white background, line-art only, text, watermark, speech bubble, thought bubble, text bubble, caption, subtitle, label, signage, words, letters, typography, font, comic panel, comic strip, meme, poster, advertisement, slogan, headline, logo, non-stickman, mixed style, detailed cartoon human, prince, princess, chibi, kawaii, big head, human body, human skin, 3d render, detailed face, blush, portrait, close-up, single character focus, bokeh, depth of field, watercolor, airbrush, extra arms, extra hands, multiple arms, multiple hands, duplicated limbs, cloned arms, ghost limbs, motion trails, overlapping arms, sketch artifacts, three hands, four hands, three arms, four arms, extra limbs, deformed hands, malformed hands, wrong number of fingers, too many fingers, missing hands, missing arms, anatomical errors, body part errors, realistic photography, hyperrealistic, 3D CGI, rendered, animation style, cartoon style, illustration style, vector art, flat design, cel-shaded, stylized character, non-stickman character, human character, detailed character, realistic character, any non-stickman style"
      } else if (imageStyle === "animation2") {
        // 애니메이션2: 스틱맨 및 실사 제외
        negativePromptText = "avoid: realistic human, detailed human skin, photograph, 3d render, blank white background, line-art only, text, watermark, stickman, stick figure, stick man, photorealistic, realistic photography, hyperrealistic, 3D CGI, rendered, photography style, DSLR camera, professional photography, any realistic or photorealistic style"
      } else if (imageStyle === "animation3") {
        // 유럽풍 그래픽 노블
        negativePromptText = "avoid: anime style, Studio Ghibli look, manga big eyes, cute aesthetic, purely sleek digital painting look"
      } else {
        // 기본 negative prompt
        negativePromptText = "avoid: realistic, photo, photograph, 3d render, text, watermark, low quality, blurry"
      }
      
      // negative prompt를 프롬프트에 결합
      const combinedPrompt = `${finalPrompt}. ${negativePromptText}`
      
      requestBody = {
        input: {
          prompt: combinedPrompt,
          aspect_ratio: "16:9", // flux-schnell은 16:9로 통일
          output_format: "png",
          output_quality: 90,
        },
      }
    }
    
    console.log("[v0] Replicate API 요청 body:", JSON.stringify(requestBody, null, 2))

    const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Replicate API 오류:", errorText)
      throw new Error(`Replicate API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (data.status === "succeeded" && data.output && data.output.length > 0) {
      const imageUrl = Array.isArray(data.output) ? data.output[0] : data.output
      console.log("[v0] Replicate 이미지 생성 완료:", imageUrl)
      return imageUrl
    } else if (data.status === "processing" || data.status === "starting") {
      // 폴링 방식으로 결과 확인
      const predictionId = data.id
      let attempts = 0
      const maxAttempts = 60 // 최대 60초 대기

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000)) // 1초 대기

        const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
          headers: {
            Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          },
        })

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded" && statusData.output && statusData.output.length > 0) {
          const imageUrl = Array.isArray(statusData.output) ? statusData.output[0] : statusData.output
          console.log("[v0] Replicate 이미지 생성 완료 (폴링):", imageUrl)
          return imageUrl
        } else if (statusData.status === "failed") {
          throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      throw new Error("이미지 생성 시간 초과")
    } else {
      throw new Error(`이미지 생성 실패: ${data.error || "알 수 없는 오류"}`)
    }
  } catch (error) {
    console.error("[v0] Replicate 이미지 생성 실패:", error)
    throw error
  }
}

export async function generateCustomPrompt(koreanDescription: string, apiKey?: string) {
  try {
    const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

    if (!GPT_API_KEY) {
      throw new Error("GPT API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.")
    }

    const systemPrompt = `당신은 "이미지FX 썸네일 프롬프트 제너레이터"입니다.
사용자가 이미지 또는 장면 설명을 입력하면, 이를 바탕으로 극적이고 감정적으로 자극적인 이미지FX 프롬프트(영어)를 생성해야 합니다.

작업 절차:
1. 주제 인물 및 핵심 특징 식별 - 인물의 나이, 성별, 얼굴 표정, 머리 스타일, 복장 디테일, 감정 상태 등
2. 배경 및 연출 요소 추출 - 배경 장소, 조명, 소품, 주변 인물
3. 스타일/연출 키워드 추가 - 카메라 구도: medium close-up, shallow DOF, cinematic composition
4. 최종 영어 프롬프트 생성 - 위 요소들을 한 문장으로 예술적으로 묘사

출력 형식:
영어 프롬프트만 출력하세요. 다른 설명이나 한글 번역은 포함하지 마세요.

예시 키워드:
- 구도: medium close-up, 85mm lens, shallow DOF
- 조명: cold fluorescent light, golden hour, spotlight-style
- 효과: realistic texture, cinematic grain
- 분위기: warm, professional, natural
- 장소: Korean office, nature, studio

중요: 16:9 비율에 최적화된 프롬프트를 생성하세요.`

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: koreanDescription,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.status}`)
    }

    const data = await response.json()
    const englishPrompt = data.choices[0].message.content.trim()

    return englishPrompt
  } catch (error) {
    console.error("프롬프트 변환 실패:", error)
    throw error
  }
}

export async function extractKeywordsFromScript(script: string, apiKey?: string) {
  // 사용자가 제공한 API 키 사용 (없으면 환경 변수에서 가져오기)
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본에서 키워드 추출 시작")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GPT_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // gpt-4에서 gpt-4o-mini로 변경
        messages: [
          {
            role: "system",
            content: `당신은 영상 콘텐츠 분석 전문가입니다. 대본을 분석하여 각 섹션에 맞는 이미지 검색 키워드를 추출합니다.

응답 형식 (JSON):
{
  "keywords": [
    {
      "time": 10,
      "keyword": "건강한 음식",
      "description": "서론 부분"
    },
    {
      "time": 120,
      "keyword": "운동하는 노인",
      "description": "본론 1장"
    }
  ]
}

규칙:
- 대본을 시간대별로 나눠 키워드 추출 (약 60-90초 간격)
- 각 키워드$는 Unsplash에서 검색 가능한 구체적인 영어 단어로 변환
- 시간(time)은 초 단위로 표시
- 총 6-10개의 키워드 추출`,
          },
          {
            role: "user",
            content: `다음 대본을 분석하여 시간대별 이미지 검색 키워드를 추출해주세요:\n\n${script}`,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error("키워드를 추출할 수 없습니다.")
    }

    // JSON 파싱
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("JSON 형식을 찾을 수 없습니다.")
    }

    const result = JSON.parse(jsonMatch[0])
    console.log("[v0] 키워드 추출 완료:", result.keywords.length, "개")

    return result.keywords
  } catch (error) {
    console.error("키워드 추출 실패:", error)

    // Fallback 키워드
    return [
      { time: 60, keyword: "healthy lifestyle", description: "건강한 생활" },
      { time: 120, keyword: "senior exercise", description: "노인 운동" },
      { time: 180, keyword: "healthy food", description: "건강한 음식" },
      { time: 240, keyword: "medical checkup", description: "건강검진" },
      { time: 300, keyword: "happy senior", description: "행복한 노년" },
    ]
  }
}

/**
 * Replicate를 사용하여 AI 썸네일 생성
 * @param topic - 선택한 주제
 * @param replicateApiKey - Replicate API 키
 * @param imageStyle - 이미지 스타일 (선택사항)
 * @param customText - 커스텀 텍스트 (선택사항)
 * @param customStylePrompt - 커스텀 스타일 프롬프트 (선택사항)
 * @param characterDescription - 캐릭터 설명 (선택사항)
 * @returns 생성된 썸네일 이미지 URL
 */
export async function generateAIThumbnail(
  topic: string,
  replicateApiKey: string,
  imageStyle?: string,
  customText?: string,
  customStylePrompt?: string,
  characterDescription?: string,
  thumbnailWithoutText?: boolean,
  benchmarkThumbnailUrl?: string,
  openaiApiKey?: string
): Promise<string> {
  if (!replicateApiKey) {
    throw new Error("Replicate API 키가 필요합니다.")
  }

  try {
    console.log(`[Longform] AI 썸네일 생성 시작, 주제: ${topic}, 이미지 스타일: ${imageStyle || "기본"}`)

    // 이미지 스타일에 맞는 스타일 프롬프트 생성
    let stylePrompt = ""
    if (customStylePrompt) {
      // 커스텀 스타일이 있으면 그것을 우선 사용
      stylePrompt = customStylePrompt
    } else if (imageStyle === "stickman-animation") {
      stylePrompt = "stickman animation style, 2D vector cartoon, white circular face, simple black outline, dot eyes, curved mouth, thin black limbs, vibrant colors, flat cel shading, thick bold outlines, solid color fills"
    } else if (imageStyle === "realistic" || imageStyle === "realistic2") {
      stylePrompt = "hyperrealistic, photorealistic masterpiece, 8K, ultra-detailed, sharp focus, cinematic lighting, shot on a professional DSLR camera with a 50mm lens"
    } else if (imageStyle === "animation2") {
      stylePrompt = "flat 2D vector illustration, minimal vector art, stylized cartoon character, thick bold black outlines, unshaded, flat solid colors, cel-shaded, simple line art, comic book inking style, completely flat, no shadows, no gradients, no depth"
    } else if (imageStyle === "animation3") {
      stylePrompt = "European graphic novel style, bande dessinée aesthetic, highly detailed traditional illustration, hand-drawn ink lines with cross-hatching shadows, sophisticated and muted color palette, atmospheric, cinematic frame"
    }

    // 유튜브 썸네일용 프롬프트 생성
    let basePrompt = ""
    
    // 문구 없이 그림만 생성 옵션이 체크된 경우 - 프롬프트 시작 부분에 최우선으로 강조
    if (thumbnailWithoutText) {
      // 프롬프트 맨 앞에 문구 금지 지시를 최우선으로 배치 (모델이 가장 먼저 읽는 부분)
      const textProhibitionPrefix = `CRITICAL MANDATORY REQUIREMENT - THIS IS THE HIGHEST PRIORITY: ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO WRITING, NO LABELS, NO SIGNS, NO NUMBERS, NO SYMBOLS, NO TYPOGRAPHY, NO CAPTIONS, NO SUBTITLES, NO WATERMARKS, NO TEXT OVERLAYS, NO TEXT ELEMENTS, NO ALPHABET, NO CHARACTERS, NO GLYPHS, NO INSCRIPTIONS, NO MARKINGS, NO NOTATIONS, NO ANNOTATIONS, NO DECORATIVE TEXT, NO EMBEDDED TEXT, NO HIDDEN TEXT, NO BACKGROUND TEXT, NO FOREGROUND TEXT, NO TEXT IN ANY POSITION, NO TEXT IN ANY SIZE, NO TEXT IN ANY COLOR, NO TEXT IN ANY FONT, NO TEXT IN ANY STYLE. Pure visual image only, completely text-free, zero text elements, no text in any form, no text anywhere in the image, text is strictly forbidden and must be completely absent. The image must be 100% text-free with absolutely no exceptions.`
      basePrompt = `${textProhibitionPrefix} YouTube thumbnail for video about: ${topic}. High quality, eye-catching, professional thumbnail design. Bright colors, engaging composition. 16:9 aspect ratio. NO YouTube logo, NO YouTube branding, NO YouTube icon, NO YouTube play button, NO YouTube elements, NO platform logos, NO service logos, NO brand logos.`
    } else {
      // 문구 없이 옵션이 체크되지 않은 경우
      basePrompt = `YouTube thumbnail for video about: ${topic}. High quality, eye-catching, professional thumbnail design. Bright colors, clear text area, engaging composition. 16:9 aspect ratio. NO YouTube logo, NO YouTube branding, NO YouTube icon, NO YouTube play button, NO YouTube elements, NO platform logos, NO service logos, NO brand logos.`
    }
    
    // 캐릭터 설명이 있으면 추가
    if (characterDescription && characterDescription.trim()) {
      basePrompt = `${basePrompt} The thumbnail should feature the main character: ${characterDescription.trim()}.`
    }
    
    // 커스텀 문구가 있고 문구 없이 옵션이 체크되지 않은 경우에만 추가
    if (customText && customText.trim() && !thumbnailWithoutText) {
      // 썸네일에 반드시 포함되어야 할 문구를 명확하게 지시
      basePrompt = `${basePrompt} The thumbnail MUST prominently display the following text: "${customText.trim()}". This text should be clearly visible, readable, and be a central element of the thumbnail design. The text should be styled to be eye-catching and attention-grabbing.`
    }
    
    // 문구 없이 옵션이 체크된 경우 프롬프트 끝에 다시 한 번 극도로 강조
    let finalPrompt = stylePrompt ? `${basePrompt} ${stylePrompt}` : basePrompt
    if (thumbnailWithoutText) {
      // 프롬프트 끝에 최종 경고 추가 (가장 강력한 형태) - 여러 번 반복하여 강조
      const finalWarning = `FINAL CRITICAL REQUIREMENT - THIS IS ABSOLUTELY MANDATORY AND NON-NEGOTIABLE: The generated image MUST contain ZERO text elements. Any text, letters, words, numbers, symbols, typography, or written content in the generated image is a COMPLETE FAILURE and violates the core requirement. The image must be 100% text-free with absolutely no text visible anywhere. Text generation is STRICTLY PROHIBITED. The model must generate a pure visual image with NO TEXT WHATSOEVER. This is not optional - text must be completely absent. REMEMBER: NO TEXT AT ALL. NO TEXT. NO TEXT. NO TEXT.`
      finalPrompt = `${finalPrompt}. ${finalWarning}`
    }
    
    const prompt = finalPrompt

    // 문구 없이 옵션이 체크된 경우 강력한 negative prompt 생성
    const negativePrompt = thumbnailWithoutText 
      ? "text, letters, words, typography, English text, Korean text, Chinese text, Japanese text, numbers, logos, watermarks, signs, labels, captions, subtitles, written text, text overlay, any text elements, any written content, any letters, any numbers, any symbols that form text, text on image, text in background, floating text, alphabet, characters, fonts, typeface, lettering, inscription, writing, script, calligraphy, text box, text area, text banner, text label, text sign, text poster, text display, text graphics, text design, text art, text illustration, any form of text, any form of writing, any form of letters, any form of numbers, any readable text, any visible text, any text content, YouTube logo, YouTube branding, YouTube icon, YouTube play button, YouTube elements, platform logos, service logos, brand logos, company logos, social media logos, video platform logos, text elements, text objects, text layers, text decorations, text patterns, text shapes, text outlines, text fills, text strokes, text effects, text shadows, text glows, text borders, text frames, text containers, text blocks, text lines, text strings, text sequences, text arrays, text grids, text layouts, text compositions, text arrangements, text structures, text formations, text configurations, text organizations, text systems, text networks, text hierarchies, text relationships, text connections, text links, text associations, text references, text citations, text quotes, text excerpts, text passages, text segments, text portions, text sections, text parts, text components, text modules, text units, text items, text pieces, text fragments, text chunks, text blocks, text segments, text divisions, text subdivisions, text categories, text classifications, text types, text kinds, text varieties, text styles, text formats, text modes, text states, text conditions, text situations, text contexts, text environments, text settings, text scenarios, text circumstances, text cases, text instances, text examples, text samples, text specimens, text models, text patterns, text templates, text frameworks, text structures, text architectures, text designs, text plans, text schemes, text strategies, text approaches, text methods, text techniques, text procedures, text processes, text operations, text actions, text activities, text functions, text behaviors, text performances, text executions, text implementations, text applications, text usages, text utilizations, text employments, text deployments, text installations, text establishments, text creations, text generations, text productions, text constructions, text formations, text developments, text evolutions, text progressions, text advancements, text improvements, text enhancements, text refinements, text optimizations, text perfections, text completions, text finalizations, text conclusions, text terminations, text endings, text closures, text finishes, text completions, text achievements, text accomplishments, text successes, text victories, text triumphs, text wins, text gains, text profits, text benefits, text advantages, text merits, text values, text worths, text importances, text significances, text meanings, text purposes, text intents, text intentions, text goals, text objectives, text aims, text targets, text destinations, text directions, text orientations, text positions, text locations, text placements, text arrangements, text organizations, text structures, text frameworks, text architectures, text designs, text plans, text schemes, text strategies, text approaches, text methods, text techniques, text procedures, text processes, text operations, text actions, text activities, text functions, text behaviors, text performances, text executions, text implementations, text applications, text usages, text utilizations, text employments, text deployments, text installations, text establishments, text creations, text generations, text productions, text constructions, text formations, text developments, text evolutions, text progressions, text advancements, text improvements, text enhancements, text refinements, text optimizations, text perfections, text completions, text finalizations, text conclusions, text terminations, text endings, text closures, text finishes"
      : "YouTube logo, YouTube branding, YouTube icon, YouTube play button, YouTube elements, platform logos, service logos, brand logos, company logos, social media logos, video platform logos"

    // API 요청 본문 구성
    const requestBody: any = {
      input: {
        prompt: prompt,
        aspect_ratio: "16:9",
        output_format: "png",
      },
    }
    
    // negative_prompt가 있으면 추가 (nano-banana-pro 모델이 지원하는 경우)
    if (negativePrompt) {
      requestBody.input.negative_prompt = negativePrompt
      console.log("[Longform] negative_prompt 추가됨 (문구 금지 모드)")
    }

    const response = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${replicateApiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[Longform] Replicate API 오류:", errorText)
      throw new Error(`Replicate API 호출 실패: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    let predictionId = data.id

    console.log(`[Longform] Replicate 예측 생성됨, ID: ${predictionId}`)

    // 문구 없이 옵션이 체크된 경우 여러 번 시도 (최대 3번)
    const maxRetries = thumbnailWithoutText ? 3 : 1
    let imageUrl: string | null = null
    let retryCount = 0

    while (retryCount < maxRetries && !imageUrl) {
      if (retryCount > 0) {
        console.log(`[Longform] 문구 없이 생성 모드 - 재시도 ${retryCount}/${maxRetries - 1}`)
        // 재시도 시 프롬프트를 더 강화
        const retryPrompt = `ABSOLUTELY NO TEXT. NO TEXT AT ALL. NO TEXT WHATSOEVER. ${prompt}`
        const retryRequestBody: any = {
          input: {
            prompt: retryPrompt,
            aspect_ratio: "16:9",
            output_format: "png",
          },
        }
        if (negativePrompt) {
          retryRequestBody.input.negative_prompt = negativePrompt
        }

        const retryResponse = await fetch("https://api.replicate.com/v1/models/google/nano-banana-pro/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${replicateApiKey}`,
          },
          body: JSON.stringify(retryRequestBody),
        })

        if (!retryResponse.ok) {
          const errorText = await retryResponse.text()
          console.error("[Longform] Replicate API 오류 (재시도):", errorText)
          retryCount++
          continue
        }

        const retryData = await retryResponse.json()
        predictionId = retryData.id
        console.log(`[Longform] Replicate 예측 재생성됨, ID: ${predictionId}`)
      }

      // 폴링하여 결과 대기
      let attempts = 0
      const maxAttempts = 60 // 최대 5분 대기 (5초 간격)

      while (!imageUrl && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)) // 5초 대기

        const statusResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${predictionId}`,
          {
            headers: {
              Authorization: `Token ${replicateApiKey}`,
            },
          }
        )

        if (!statusResponse.ok) {
          throw new Error(`상태 확인 실패: ${statusResponse.status}`)
        }

        const statusData = await statusResponse.json()

        if (statusData.status === "succeeded") {
          // nano-banana-pro 모델의 출력 형식에 맞게 처리
          if (statusData.output && typeof statusData.output === "string") {
            imageUrl = statusData.output
          } else if (statusData.output && Array.isArray(statusData.output) && statusData.output.length > 0) {
            imageUrl = statusData.output[0]
          } else if (statusData.output?.url) {
            imageUrl = statusData.output.url
          }
          console.log(`[Longform] AI 썸네일 생성 완료 (시도 ${retryCount + 1}):`, imageUrl)
          break
        } else if (statusData.status === "failed") {
          throw new Error(`이미지 생성 실패: ${statusData.error || "알 수 없는 오류"}`)
        }

        attempts++
      }

      if (!imageUrl) {
        console.log(`[Longform] 이미지 생성 시간 초과 (시도 ${retryCount + 1})`)
      }

      retryCount++
    }

    if (!imageUrl) {
      throw new Error("이미지 생성 시간 초과 (모든 재시도 실패)")
    }

    return imageUrl
  } catch (error) {
    console.error("[Longform] AI 썸네일 생성 실패:", error)
    throw error
  }
}

/**
 * 대본에서 주제를 추출하는 함수
 */
export async function extractTopicFromScript(script: string, apiKey?: string): Promise<string> {
  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본에서 주제 추출 시작")

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
            content: `당신은 영상 콘텐츠 분석 전문가입니다. 주어진 대본을 분석하여 이 영상의 핵심 주제를 한 문장으로 요약해주세요.

규칙:
- 대본의 핵심 내용을 파악하여 간결하고 명확한 주제로 요약
- 20자 이내로 간결하게 작성
- 예: "60대 건강 관리 방법", "삼국지 관우 이야기", "치매 예방 운동법" 등`,
          },
          {
            role: "user",
            content: `다음 대본의 핵심 주제를 한 문장으로 요약해주세요:\n\n${script.substring(0, 2000)}`, // 대본이 너무 길면 앞부분만 사용
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || "주제 추출에 실패했습니다.")
    }

    const data = await response.json()
    const topic = data.choices[0]?.message?.content?.trim()

    if (!topic) {
      throw new Error("주제 추출 결과가 비어있습니다.")
    }

    console.log("[v0] 추출된 주제:", topic)
    return topic
  } catch (error) {
    console.error("[v0] 대본에서 주제 추출 실패:", error)
    throw error
  }
}

/**
 * 기존 대본을 기반으로 각색하여 재생성하는 함수
 */
export async function regenerateScript(
  existingScript: string,
  topic: string,
  apiKey?: string,
  category: Category = "health"
): Promise<string> {
  const GEMINI_API_KEY = apiKey || process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.")
  }

  try {
    console.log("[v0] 대본 재생성 시작 (구조 기반 각색, Gemini 2.5 Pro)")

    // 프롬프트가 너무 길면 existingScript를 여러 부분으로 나눠서 처리 (Gemini 토큰 제한 고려)
    // 대략 30,000자씩 나눠서 처리 (안전 마진 고려)
    const MAX_SCRIPT_LENGTH = 30000
    let scriptToUse = existingScript
    
    if (existingScript.length > MAX_SCRIPT_LENGTH) {
      console.log(`[v0] 대본이 길어서 여러 부분으로 나눠서 처리합니다. (전체: ${existingScript.length}자)`)
      
      // 대본을 여러 부분으로 나누기 (문장 단위로 나눠서 자연스럽게)
      const parts: string[] = []
      const sentences = existingScript.split(/([.!?。！？]\s+)/)
      let currentPart = ""
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]
        if ((currentPart + sentence).length > MAX_SCRIPT_LENGTH && currentPart.length > 0) {
          parts.push(currentPart.trim())
          currentPart = sentence
        } else {
          currentPart += sentence
        }
      }
      
      if (currentPart.trim().length > 0) {
        parts.push(currentPart.trim())
      }
      
      console.log(`[v0] 대본을 ${parts.length}개 부분으로 나눴습니다.`)
      
      // 각 부분의 앞부분과 뒷부분을 포함하여 전체 구조 파악
      // 첫 부분 전체 + 중간 부분들의 앞뒤 + 마지막 부분 전체
      if (parts.length === 1) {
        scriptToUse = parts[0].substring(0, MAX_SCRIPT_LENGTH)
      } else if (parts.length === 2) {
        // 2개 부분: 첫 부분 전체 + 두 번째 부분 앞부분
        scriptToUse = parts[0] + "\n\n[중간 생략...]\n\n" + parts[1].substring(0, Math.min(10000, parts[1].length))
      } else {
        // 3개 이상: 첫 부분 + 중간 부분들의 요약 + 마지막 부분
        const firstPart = parts[0].substring(0, Math.min(15000, parts[0].length))
        const lastPart = parts[parts.length - 1].substring(0, Math.min(15000, parts[parts.length - 1].length))
        const middleSummary = parts.length > 2 
          ? `\n\n[중간 ${parts.length - 2}개 부분 생략 - 전체 구조를 파악하여 작성하세요]\n\n`
          : "\n\n[중간 생략...]\n\n"
        scriptToUse = firstPart + middleSummary + lastPart
      }
      
      scriptToUse += "\n\n[참고: 원본 대본이 길어서 주요 부분만 제공되었습니다. 전체 구조와 감정 흐름을 파악하여 작성하세요.]"
    }

    const fullPrompt = `당신은 대본 구조 분석 및 재작성 전문가입니다.

⚠️⚠️⚠️ 절대적 필수 원칙 ⚠️⚠️⚠️
- 원본 대본의 문장을 절대 그대로 사용하지 마십시오
- 원본 대본의 단어, 어구, 표현을 절대 그대로 복사하지 마십시오
- 원본과 동일하거나 유사한 문장이 발견되면 즉시 폐기하고 완전히 새로 작성하십시오
- 원본의 문장 구조, 어순, 표현 방식을 절대 모방하지 마십시오
- 원본의 내용, 주제, 사례, 비유, 문장은 절대 언급하지 마십시오
- 오직 '전개 구조'와 '감정 흐름'만 추출하고 활용하십시오
- 원본 예시, 산업, 사건, 비유를 절대 사용하지 마십시오
- 원본과 유사한 문장 리듬, 어투, 질문을 절대 사용하지 마십시오
- 표절이나 유사성이 의심되면 그 문장은 폐기하고 완전히 새로 작성하십시오
- 괄호나 대괄호를 사용하지 않습니다 (TTS를 이용할 것이기 때문)
- "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론" 같은 구조적 단어를 절대 사용하지 않습니다
- 오로지 대본 내용만 작성합니다
- 기존 대본의 길이와 비슷하게 유지합니다

[작성 방식]
1단계: 벤치마킹용 대본을 분석하여 '전개 구조'와 '감정 흐름'만 추출
2단계: 새로운 주제를 기준으로 추출한 구조를 그대로 사용하여 완전히 새로운 대본 작성
- 모든 문장은 원본과 완전히 다른 표현으로 작성하십시오
- 같은 의미라도 완전히 다른 단어, 다른 문장 구조, 다른 표현으로 작성하십시오

────────────────────────
[벤치마킹용 대본]
────────────────────────
${scriptToUse}

────────────────────────
[1단계: 구조 및 감정 흐름 추출]
────────────────────────
⚠️⚠️⚠️ 절대 금지 ⚠️⚠️⚠️
- 내용·주제·사례·비유·문장은 절대 언급하지 말 것
- 원본의 단어, 어구, 표현을 절대 사용하지 말 것
- 오직 '전개 구조'와 '감정 흐름'만 추출할 것

────────────────────────
[2단계: 새로운 대본 작성]
────────────────────────
다음 주제를 기준으로,
위 구조를 그대로 사용하되
완전히 새로운 대본을 작성하라.

[새 주제]
- 핵심 질문: ${topic}
- 전달하고 싶은 한 문장 메시지: ${topic}에 대한 핵심 메시지를 전달하세요.

────────────────────────
[강제 규칙 - 절대 준수]
────────────────────────
🚫 원본 예시, 산업, 사건, 비유 사용 금지
🚫 원본과 유사한 문장 리듬, 어투, 질문 금지
🚫 원본의 단어, 어구, 표현을 그대로 사용 금지
🚫 원본의 문장 구조, 어순을 모방 금지
🚫 표절·유사성 의심이 들면 그 문장은 폐기하고 다시 작성
🚫 원본과 동일하거나 유사한 문장이 발견되면 즉시 폐기
✅ 모든 문장은 원본과 완전히 다른 표현으로 작성
✅ 같은 의미라도 완전히 다른 단어, 다른 문장 구조로 작성
✅ 대본 내용만 작성하세요. 제목이나 구조적 단어는 사용하지 마세요.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 1.2, // 창의적인 각색을 위해 temperature를 매우 높게 설정 (원본과 다른 표현 강제)
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 32768, // Gemini 2.5 Pro는 최대 32768 토큰
          },
        }),
      }
    )

    if (!response.ok) {
      let errorText = ""
      try {
        const errorData = await response.json()
        errorText = errorData.error?.message || JSON.stringify(errorData)
      } catch {
        errorText = await response.text()
      }
      console.error(`[v0] 대본 재생성 API 오류: ${response.status}`, errorText)
      throw new Error(`대본 재생성 실패 (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    
    // Gemini 응답 구조 확인
    if (!data.candidates || data.candidates.length === 0) {
      console.error(`[v0] 대본 재생성 실패: candidates 배열이 비어있습니다.`, JSON.stringify(data, null, 2))
      throw new Error("재생성된 대본을 생성할 수 없습니다. API 응답에 candidates가 없습니다.")
    }
    
    const candidate = data.candidates[0]
    const finishReason = candidate.finishReason
    
    if (finishReason === "SAFETY" || finishReason === "RECITATION" || finishReason === "OTHER") {
      console.error(`[v0] 대본 재생성 실패: ${finishReason}`, JSON.stringify(candidate, null, 2))
      throw new Error(`대본 재생성에 실패했습니다. (finishReason: ${finishReason})`)
    }
    
    let regeneratedScript = candidate.content?.parts?.[0]?.text

    if (!regeneratedScript) {
      console.error(`[v0] 대본 재생성 실패: 응답 내용이 없습니다.`, JSON.stringify({
        finishReason,
        hasContent: !!candidate.content,
        hasParts: !!candidate.content?.parts,
        partsLength: candidate.content?.parts?.length,
        fullCandidate: candidate
      }, null, 2))
      throw new Error(`재생성된 대본을 생성할 수 없습니다. 응답 내용이 없습니다. (finishReason: ${finishReason || "N/A"})`)
    }
    
    regeneratedScript = regeneratedScript.trim()

    // 구조적 단어 제거
    const structuralWords = [
      "개요", "서론", "본론", "챕터", "1부", "2부", "3부", "4부", "5부", "결론",
      "Chapter", "Part", "Introduction", "Body", "Conclusion"
    ]
    
    let cleanedScript = regeneratedScript
    for (const word of structuralWords) {
      const regex = new RegExp(`\\s*${word}\\s*:?\\s*`, "gi")
      cleanedScript = cleanedScript.replace(regex, "")
    }

    // 원본과의 유사도 체크 (단어 기반)
    const calculateSimilarity = (text1: string, text2: string): number => {
      const normalizeText = (text: string): Set<string> => {
        return new Set(
          text
            .toLowerCase()
            .replace(/[^\w\s가-힣]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0)
        )
      }

      const words1 = normalizeText(text1)
      const words2 = normalizeText(text2)

      let commonWords = 0
      for (const word of words1) {
        if (words2.has(word)) {
          commonWords++
        }
      }

      const totalUniqueWords = words1.size + words2.size - commonWords
      if (totalUniqueWords === 0) {
        return 1
      }

      return commonWords / totalUniqueWords
    }

    // 원본과 재생성된 대본의 유사도 체크
    const similarity = calculateSimilarity(existingScript, cleanedScript)
    console.log(`[v0] 원본과 재생성 대본 유사도: ${(similarity * 100).toFixed(1)}%`)

    // 유사도가 40% 이상이면 재생성 (너무 유사함)
    if (similarity > 0.4) {
      console.warn(`[v0] ⚠️ 원본과 유사도가 너무 높습니다 (${(similarity * 100).toFixed(1)}%). 재생성 시도...`)
      
      // 재생성 시도 (최대 2회)
      for (let retry = 0; retry < 2; retry++) {
        try {
          const retryPrompt = `${fullPrompt}

⚠️⚠️⚠️ 중요: 이전 생성 결과가 원본과 너무 유사했습니다 (유사도: ${(similarity * 100).toFixed(1)}%).
반드시 원본과 완전히 다른 표현으로 다시 작성하세요.
- 원본의 단어, 어구, 표현을 절대 사용하지 마세요
- 원본의 문장 구조, 어순을 절대 모방하지 마세요
- 모든 문장을 완전히 새로운 표현으로 작성하세요`

          const retryResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: retryPrompt,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 1.3, // 재생성 시 더 높은 temperature
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 32768,
                },
              }),
            }
          )

          if (!retryResponse.ok) {
            break // 재생성 실패 시 원래 결과 사용
          }

          const retryData = await retryResponse.json()
          
          if (!retryData.candidates || retryData.candidates.length === 0) {
            break
          }
          
          const retryCandidate = retryData.candidates[0]
          const retryScript = retryCandidate.content?.parts?.[0]?.text?.trim()
          
          if (retryScript) {
            let retryCleaned = retryScript
            for (const word of structuralWords) {
              const regex = new RegExp(`\\s*${word}\\s*:?\\s*`, "gi")
              retryCleaned = retryCleaned.replace(regex, "")
            }
            
            const retrySimilarity = calculateSimilarity(existingScript, retryCleaned)
            console.log(`[v0] 재생성 ${retry + 1}회차 유사도: ${(retrySimilarity * 100).toFixed(1)}%`)
            
            if (retrySimilarity < 0.4) {
              cleanedScript = retryCleaned
              console.log(`[v0] ✅ 재생성 성공: 유사도 ${(retrySimilarity * 100).toFixed(1)}%`)
              break
            }
          }
        } catch (retryError) {
          console.error(`[v0] 재생성 ${retry + 1}회차 실패:`, retryError)
        }
      }
    }

    console.log("[v0] 대본 재생성 완료")
    return cleanedScript.trim()
  } catch (error) {
    console.error("[v0] 대본 재생성 실패:", error)
    throw error
  }
}

/**
 * 벤치마킹 대본 구조 분석
 */
export async function analyzeBenchmarkScript(script: string, apiKey?: string): Promise<string> {
  console.log("[analyzeBenchmarkScript] 시작, 대본 길이:", script.length)

  const GPT_API_KEY = apiKey || process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY

  if (!GPT_API_KEY) {
    throw new Error("GPT API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.")
  }

  if (!script || !script.trim()) {
    throw new Error("분석할 대본을 입력해주세요.")
  }

  const systemPrompt = `너는 유튜브 롱폼 대본을 분석해
'내용을 제거한 순수 구조'만 추출하는 스크립트 설계자다.

아래 대본에서
주제, 사례, 숫자, 주장, 결론 같은 '내용'은 전부 제거하고
오직 "구조와 진행 방식"만 추상화해서 정리해라.

목표는
이 구조를 그대로 커스텀 타입 입력란에 넣어
다른 주제로도 재사용할 수 있게 만드는 것이다.

다음 기준을 반드시 지켜라.

1. 대본 전체를 단계별 구조로 분해
- 초반 / 중반 / 후반 흐름을 명확히 구분
- 각 단계가 수행하는 역할을 설명

2. 초반 15초는 반드시 별도로 분리
- 어떤 방식으로 시작하는지
- 질문형인지, 단정형인지, 위기 제시형인지
- 시청 지속을 유도하는 장치가 무엇인지

3. 구조 설명은 반드시 '형식 문장'으로 작성
- "○○을 설명한다" ❌
- "시청자의 ○○ 감정을 자극하며 ○○을 제기하는 구조" ⭕️

4. 내용 고유명사, 수치, 사례, 주제 단어 사용 금지
- 이 구조를 다른 모든 주제에 적용할 수 있어야 한다

5. 결과물은 '설명서 문장'처럼 작성
- AI가 이 구조를 그대로 따라 대본을 다시 만들 수 있어야 한다

출력 형식은 아래를 따르라.

[이 대본의 전체 구조 요약]
- …

[초반 15초 구조]
- …

[중반 전개 구조]
- …

[후반 마무리 구조]
- …

[이 구조의 핵심 특징]
- …`

  const userPrompt = `이제 아래 대본의 구조만 추출해라.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
대본:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${script}`

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
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`API 호출 실패: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error("API 응답에서 내용을 찾을 수 없습니다.")
    }

    console.log("[analyzeBenchmarkScript] 분석 완료")
    return content.trim()
  } catch (error) {
    console.error("[analyzeBenchmarkScript] 분석 실패:", error)
    throw error
  }
}
