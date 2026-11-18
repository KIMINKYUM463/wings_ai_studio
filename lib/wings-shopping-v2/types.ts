export type Stage = 'analyze' | 'search' | 'sources' | 'script' | 'tts' | 'clean' | 'render';

export type JobStatus = {
  stage: Stage;
  state: 'idle' | 'running' | 'done' | 'error';
  message?: string;
  progress?: number;
};

export type Scene = { start: number; end: number; description: string; onScreenText?: string };

export type Analysis = {
  productName: string;
  category: string;
  keywords: string[];
  searchQueries: { youtube: string[]; tiktok: string[]; instagram: string[]; douyin?: string[]; xiaohongshu?: string[] };
  structure: { hook: string; body: string; cta: string };
  scenes: Scene[];
  narrationTone: string;
  duration: number;
  /** story-bridge 등에서 보강하는 선택 필드 */
  brandOrModel?: string;
  keySellingPoints?: string[];
  targetAudience?: string;
  hookStyle?: string;
  narrativeArc?: string;
  estimatedDurationSec?: number;
  productDescription?: string;
};

export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'douyin' | 'xiaohongshu';

export type SearchResult = { platform: Platform; url: string; title: string; thumbnail?: string; author?: string };

export type Source = {
  id: string;
  url?: string;
  /** 리믹스 선택 단계에서 이미 해석된 직접 MP4 스트림 주소 (우선 다운로드용) */
  directUrl?: string;
  platform?: string;
  title?: string;
  file?: string;
  duration?: number;
  status: 'pending' | 'ready' | 'needsUpload' | 'error';
  /** 템플릿 영상일 때 실제 푸티지 영역 [ymin,xmin,ymax,xmax] (0~1000) */
  contentBox?: number[];
  error?: string;
};

export type Clip = {
  id: string;
  sourceId: string;
  start: number;
  end: number;
  /** 좌우반전: 이 장면이 나오는 구간을 미리보기·완성 영상에서 뒤집는다 */
  flip?: boolean;
  description: string;
  shotType: string;
  hasBurnedText: boolean;
  quality: number;
  excluded?: boolean;
  /** Flow·Veo로 만든 AI 영상 */
  aiGenerated?: boolean;
  /** 화면에 박힌 글자·로고 위치 (Gemini 0~1000 [ymin,xmin,ymax,xmax]) — 렌더 때 모자이크 */
  textBoxes?: number[][];
};

export type CharAlignment = { chars: string[]; starts: number[]; ends: number[] };

export type BeatTts = { file: string; duration: number; alignment: CharAlignment; textHash: string };

export type Beat = { id: string; text: string; clipId: string | null; tts?: BeatTts; role?: string; /** 리뷰·랭킹: 화면 순위·상품명 라벨 (예: '3위 · 상품명') */ item?: string };

export type FlowBeatPrompt = { beatId: string; shot: string; subject: string; action: string; setting: string; camera: string; seconds: number; safe: boolean; note?: string; text: string };

export type FlowSettings = { styleBible: string; style: string; prompts: Record<string, FlowBeatPrompt> };

export type ThumbOption = { lines: string[]; highlight: string; type: string };

export type ThumbnailSettings = {
  clipId?: string;
  styleId: string;
  lines: string[];
  highlight: string;
  /** 완성 영상 맨 앞 첫 프레임(0.01초)으로 붙이기 */
  prepend: boolean;
  file?: string;
  at?: number;
  options?: ThumbOption[];
  /** 썸네일 스튜디오 디자인 (다시 열 때 복원) */
  studioDesign?: unknown;
};

export type TravelInfo = {
  productType: string; // 숙소 | 투어·액티비티 | 입장권·패스 | 여행템 | 항공권 | 패키지 | eSIM·통신
  productName?: string;
  location?: string;
  price?: string;
  period?: string;
  howToBuy?: string;
  /** 직접 이용·방문했는지 (아니면 체험담처럼 쓰지 않는다) */
  firsthand?: boolean;
};

/** 리뷰·랭킹 모드: 사용자가 넣는 상품 목록 (한 줄에 하나, '상품명 | 가격 | 한줄 특징') */
export type ReviewInfo = {
  items: string;
  /** 순위·추천의 근거 (예: '올리브영 랭킹 11월 기준', '제 피부 기준'). 비우면 근거를 말하지 않는다 */
  basis?: string;
  /** 직접 써본 상품인지 (아니면 내돈내산·사용 후기처럼 쓰지 않는다) */
  firsthand?: boolean;
};

export type StoryMode = 'ssul' | 'travel' | 'review';
export const isStoryMode = (m?: string): m is StoryMode => m === 'ssul' || m === 'travel' || m === 'review';

/** 썰 쇼핑숏폼 설정 */
export type SsulSettings = {
  structureId: string; // 'auto' 또는 플레이북 구조 id
  angleId: string; // '' = AI가 정함
  toneId: string;
  ctaType: string;
  /** 마무리가 '댓글키워드'일 때 시청자에게 남기라고 할 단어 (비우면 AI가 정함) */
  ctaKeyword?: string;
  templateId: string;
  channelName: string;
  introPoster: boolean;
  /** 영상 자리 비율: default(템플릿 그대로) · square(1:1) · fill(아래까지 꽉 차게) */
  videoFit?: 'default' | 'square' | 'fill';
  /** 첫 화면 표지·썸네일 모양 (cover-variants.ts 의 id) */
  coverVariant?: string;
  /** 표지·썸네일: 영상 아래 빈 곳도 위 띠 색으로 채우기 */
  coverBottomFill?: boolean;
  /** 표지 동안 첫 문장 줄 줌인 */
  coverZoom?: boolean;
  /** 자막·템플릿 글꼴 id (templates/fonts SSUL_FONTS, 없으면 Pretendard) */
  font?: string;
  /** 템플릿 제목·채널명 글자 크기 배율 (1 = 템플릿 그대로) */
  titleScale?: number;
  channelScale?: number;
};

export type FxSettings = {
  bgm: boolean;
  /** BGM 분위기 id (lib/audio/bgm BGM_MOODS) */
  mood?: string;
  /** 내장 BGM 카탈로그 트랙 id. 비어 있으면 AI 작곡을 사용 */
  bgmTrackId?: string;
  /** 0~1 */
  bgmVolume: number;
  sfx: boolean;
  motion: boolean;
  /** 효과음 템플릿 (fx-presets.ts) */
  sfxPreset?: import('./fx-presets').SfxPreset;
  /** 모션그래픽 템플릿 (fx-presets.ts) */
  motionPreset?: import('./fx-presets').MotionPreset;
  /** 효과음·모션 조합 번호 ('다시 만들기'를 누르면 바뀐다) */
  seed?: number;
};

export type UploadPack = {
  youtube: { title: string; description: string; hashtags: string[] };
  instagram: { caption: string; hashtags: string[] };
  tiktok: { caption: string; hashtags: string[] };
  pinnedComment: string;
  at: number;
};

export type PublishSettings = {
  /** 광고·제휴 종류 (lib/publish/disclosure AFFILIATES) */
  affiliate: string;
  link?: string;
  /** 화면 광고 표기 문구 (비우면 기본 문구) */
  bannerText?: string;
  /** 화면에 광고·AI 표기 넣기 (기본 켜짐) */
  onScreen?: boolean;
  pack?: UploadPack;
};

/** 업로드 탭: 플랫폼별 업로드 문구 (title은 YouTube만) */
export type PlatformCopyEntry = { title?: string; description: string; tags: string; comment: string };
export type PlatformCopy = { youtube?: PlatformCopyEntry; instagram?: PlatformCopyEntry; tiktok?: PlatformCopyEntry; at?: number };

export type Project = {
  /** remix = 레퍼런스 재편집, ssul = 썰 쇼핑숏폼 */
  mode?: 'remix' | StoryMode;
  reviewInfo?: ReviewInfo;
  /** 여행 모드: 사용자가 입력한 상품 사실 정보 (대본은 이 정보만 사실로 씀) */
  travelInfo?: TravelInfo;
  ssul?: SsulSettings;
  id: string;
  name: string;
  createdAt: string;
  referenceUrl: string;
  referenceSourceId?: string;
  analysis?: Analysis;
  searchResults?: SearchResult[];
  /** 검색 중 실패한 플랫폼 안내 (예: TikHub 잔액 부족) */
  searchWarnings?: string[];
  selected: string[];
  sources: Source[];
  clips: Clip[];
  script?: { headcopy: [string, string]; beats: Beat[]; comment?: string; structureId?: string; structureReason?: string };
  voice: { voiceId: string; speed: number };
  /** 썸네일 */
  thumbnail?: ThumbnailSettings;
  /** Google Flow(Veo) 연동: 문장별 AI 영상 프롬프트 */
  flow?: FlowSettings;
  /** 원본 글자 모자이크 (없으면 켜짐) */
  mosaic?: boolean;
  /** 유료 모자이크 방식: v2(Gemini 위치 모자이크) | vmake(Vmake AI 자막 제거) */
  mosaicMode?: 'v2' | 'vmake' | 'sttn';
  /** Vmake 자막 제거 마스터 영상(vmake-clean.mp4)이 이미 생성·보관된 시각 (있으면 템플릿 변경·재생성 시 Vmake 재과금 없음) */
  vmakeCleanedAt?: number;
  /** 리믹스 영상 템플릿 id (기본값: remix-glass-default) */
  remixTemplateId?: string;
  /** 리믹스 대본 구조 템플릿 id */
  scriptTemplateId?: string;
  /** 기존 스튜디오 음성 선택기(타입캐스트·수퍼토닉·ElevenLabs·아담)로 고른 목소리 */
  customVoice?: { voiceId: string; style: string; speed: number };
  /** 기존 편집기(MvpPostEditStudio) 전달용 최신 렌더 결과 */
  studioResult?: import('@/lib/shotform-auto-edit-types').AutoEditJobResult;
  /** 배경음악·효과음·모션그래픽 (없으면 전부 켜짐) */
  fx?: FxSettings;
  /** 업로드 문구·광고 표기 */
  publish?: PublishSettings;
  /** 업로드 탭 플랫폼별 제목·설명·태그·고정 댓글 */
  platformCopy?: PlatformCopy;
  /** 영상 언어 (없으면 ko). 해외판은 원본을 복제해 번역한 프로젝트 */
  lang?: string;
  /** 해외판이면 원본 프로젝트 id */
  localizedFrom?: string;
  /** 해외판: 화면 고정 문구 번역 */
  localText?: { footer?: string; statics?: Record<string, string> };
  /** 완성본 파일 (output.mp4: 버전2 자체 완성본) */
  output?: { file: string; stale: boolean; at?: number; notes?: string[] };
  /** 자막 지운 영상(clean/video.mp4)·문장별 음성(clean/tts_000.wav). key가 지금 프로젝트와 같을 때만 쓴다 */
  clean?: { key: string; at: number; durations: number[]; switchTimes: number[] };
  /** 서버 응답에만 붙음: clean 이 지금 장면·음성과 맞는지 */
  cleanFresh?: boolean;
  /** 기존 편집기 전달용 무음 그림 파일 (studio-output.mp4) */
  studioVideoAt?: number;
  jobs: Partial<Record<Stage, JobStatus>>;
};
