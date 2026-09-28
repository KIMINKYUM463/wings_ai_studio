export type ThumbnailAiOverlayPhase = 'analyze' | 'full' | 'background' | 'text' | 'layout' | 'verify' | 'remix'

const COPY: Record<
  ThumbnailAiOverlayPhase,
  { title: string; hint: string; steps: string[] }
> = {
  analyze: {
    title: '템플릿 스타일 분석 중',
    hint: '사진 구도 · 문구 위치 · 색상을 읽고 있습니다',
    steps: ['레이아웃 인식', '색상 추출', '슬롯 매핑'],
  },
  full: {
    title: 'AI 썸네일 생성 중',
    hint: '템플릿 구도에 맞는 배경과 CTR 문구를 만듭니다',
    steps: ['배경 생성', '카피 작성', '슬롯 배치'],
  },
  background: {
    title: 'AI 배경 생성 중',
    hint: '템플릿과 같은 구도로 배경만 그립니다',
    steps: ['프롬프트 구성', '이미지 생성', '적용'],
  },
  text: {
    title: 'AI 문구 작성 중',
    hint: '대본·제목을 바탕으로 썸네일 카피를 씁니다',
    steps: ['대본 분석', '카피 생성', '레이어 반영'],
  },
  layout: {
    title: '문구 배치 분석 중',
    hint: '배경 사진의 빈 영역·피사체 위치에 맞춰 글자 크기·위치를 조정합니다',
    steps: ['배경 분석', '슬롯 배치', '가독성 보정'],
  },
  verify: {
    title: '썸네일 CTR 검증 중',
    hint: '후킹·가독성·구도·사진 품질을 전문가 관점으로 분석합니다',
    steps: ['캔버스 캡처', '비전 분석', '리포트 생성'],
  },
  remix: {
    title: '참고 썸네일 리믹스 중',
    hint: '글자 제거·인물 변형·화이트 테두리 배경과 하단 2줄 문구를 만듭니다',
    steps: ['문구 읽기', '배경 생성', '하단 카피 작성'],
  },
}

type Props = {
  phase: ThumbnailAiOverlayPhase
}

export function ThumbnailStudioAiOverlay({ phase }: Props) {
  const { title, hint, steps } = COPY[phase]

  return (
    <div className="thumb-ai-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="thumb-ai-overlay__backdrop" aria-hidden />
      <div className="thumb-ai-overlay__mesh" aria-hidden />
      <div className="thumb-ai-overlay__orb thumb-ai-overlay__orb--a" aria-hidden />
      <div className="thumb-ai-overlay__orb thumb-ai-overlay__orb--b" aria-hidden />
      <div className="thumb-ai-overlay__orb thumb-ai-overlay__orb--c" aria-hidden />

      <div className="thumb-ai-overlay__scan" aria-hidden />

      <div className="thumb-ai-overlay__panel">
        <div className="thumb-ai-overlay__icon-wrap" aria-hidden>
          <span className="thumb-ai-overlay__ring" />
          <span className="thumb-ai-overlay__core">✦</span>
        </div>
        <p className="thumb-ai-overlay__title">{title}</p>
        <p className="thumb-ai-overlay__hint">{hint}</p>

        <ul className="thumb-ai-overlay__steps">
          {steps.map((label, i) => (
            <li
              key={label}
              className="thumb-ai-overlay__step"
              style={{ animationDelay: `${i * 0.55}s` }}
            >
              <span className="thumb-ai-overlay__step-dot" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="thumb-ai-overlay__bar" role="progressbar" aria-valuetext={title}>
          <div className="thumb-ai-overlay__bar-fill" />
        </div>
      </div>
    </div>
  )
}

export function resolveThumbnailAiOverlayPhase(opts: {
  tplAnalyzeBusy: boolean
  genBusy: boolean
  bgOnlyBusy: boolean
  layoutFitBusy?: boolean
  verifyBusy?: boolean
  textOnlyBusy: boolean
  textRewriteBusy?: boolean
  textRegenerateBusy?: boolean
  benchmarkRemixBusy?: boolean
}): ThumbnailAiOverlayPhase | null {
  if (opts.benchmarkRemixBusy) return 'remix'
  if (opts.tplAnalyzeBusy) return 'analyze'
  if (opts.genBusy) return 'full'
  if (opts.bgOnlyBusy) return 'background'
  if (opts.layoutFitBusy) return 'layout'
  if (opts.verifyBusy) return 'verify'
  if (opts.textOnlyBusy || opts.textRewriteBusy || opts.textRegenerateBusy) return 'text'
  return null
}
