'use client';
import { useEffect, useState } from 'react';
import { useProject } from '@/lib/wings-shopping-v2/client';
import { modeLabel } from '@/lib/wings-shopping-v2/modes';
import { STEPS, Stepper, stepAvailable } from '@/components/wings-shopping-v2/ui';
import { loadSsulOptions } from '@/components/wings-shopping-v2/SsulPanel';
import { isStoryMode } from '@/lib/wings-shopping-v2/types';
import AnalyzeStep from '@/components/wings-shopping-v2/AnalyzeStep';
import RemixTemplateStep from '@/components/wings-shopping-v2/RemixTemplateStep';
import SearchStep from '@/components/wings-shopping-v2/SearchStep';
import SourcesStep from '@/components/wings-shopping-v2/SourcesStep';
import ScriptStep from '@/components/wings-shopping-v2/ScriptStep';
import ExportStep from '@/components/wings-shopping-v2/ExportStep';
import TemplateStep from '@/components/wings-shopping-v2/TemplateStep';

/** 버전2 5단계 작업실 (스토리·리믹스·통합 진입 경로가 공유) */
export default function ProjectWorkspace({
  projectId,
  /** 스토리 ver2 핸드오프처럼 분석(0)을 건너뛸 때 사용 */
  initialStep,
  /** true면 상단 제목·모드 배지 숨김 (바깥 셸이 이미 헤더를 가질 때) */
  embedded,
  /** 바깥 셸이 단계를 관리할 때(좌측 단계 목록 등). 주면 내부 단계 버튼은 숨김 */
  step: controlledStep,
  onStepChange,
  /** 단계별 열림 여부를 바깥 단계 목록에 알려줌 */
  onAvailableChange,
  /** 분석 화면의 다음 버튼 문구 (기본: 같은 상품 영상 찾기) */
  analyzeNextLabel,
  /** true면 영상 템플릿을 대본에서 빼서 단계 5(대본 3 → 템플릿 5 → 내보내기 4)로 보여준다 */
  separateTemplateStep,
  /** true면 대본 단계에서 Flow AI 장면 패널을 숨긴다 */
  hideFlowPanel,
  /** true면 내보내기 단계를 편집 화면(ExportEditor)으로 보여준다 */
  exportEditor,
  /** 자동편집 '썸네일 생성' 탭에 넣을 화면 */
  thumbnailSlot,
  onOpenVersion,
  onProject,
}: {
  projectId: string;
  initialStep?: number;
  embedded?: boolean;
  step?: number;
  onStepChange?: (step: number) => void;
  onAvailableChange?: (available: boolean[]) => void;
  analyzeNextLabel?: string;
  separateTemplateStep?: boolean;
  hideFlowPanel?: boolean;
  exportEditor?: boolean;
  thumbnailSlot?: import('react').ReactNode;
  onOpenVersion?: (projectId: string) => void;
  /** 바깥 셸이 진행 상황(썸네일·작업 상태)을 그릴 수 있게 프로젝트를 알려줌 */
  onProject?: (project: import('@/lib/wings-shopping-v2/types').Project) => void;
}) {
  const { project, setProject, error, refresh } = useProject(projectId);
  const [innerStep, setInnerStep] = useState<number | null>(null);
  const controlled = onStepChange !== undefined;
  const step = controlled ? (controlledStep ?? 0) : innerStep;
  const setStep = onStepChange ?? setInnerStep;

  // 썰 설정·템플릿 선택지를 미리 받아 둬서 해당 단계를 열면 바로 보이게
  const storyMode = isStoryMode(project?.mode) ? project?.mode ?? 'ssul' : null;
  useEffect(() => {
    if (storyMode) void loadSsulOptions(storyMode).catch(() => {});
  }, [storyMode]);

  useEffect(() => {
    if (project && onAvailableChange) onAvailableChange([...STEPS.map((_, i) => stepAvailable(project, i)), stepAvailable(project, 3)]);
  }, [project, onAvailableChange]);
  useEffect(() => { if (project && onProject) onProject(project); }, [project, onProject]);

  useEffect(() => {
    if (project && !controlled && innerStep === null) {
      if (typeof initialStep === 'number') {
        setInnerStep(Math.max(0, Math.min(4, initialStep)));
        return;
      }
      let s = 0;
      for (let i = 0; i < 5; i++) if (stepAvailable(project, i)) s = i;
      setInnerStep(s === 1 && !project.searchResults ? 1 : s);
    }
  }, [project, controlled, innerStep, initialStep]);

  if (error && !project) return <p className="p-10 text-danger">{error}</p>;
  if (!project || step === null) return <p className="p-10 text-muted">불러오는 중...</p>;

  const nextStep = separateTemplateStep && step === 3 ? 5 : step === 5 ? 4 : Math.min(4, step + 1);
  const props = { project, setProject, refresh, goNext: () => setStep(nextStep), separateTemplates: separateTemplateStep, hideFlow: hideFlowPanel, exportEditor, thumbnailSlot, onOpenVersion };

  return (
    <div className={embedded ? 'min-w-0' : 'mx-auto max-w-6xl min-w-0 px-4 py-8 md:px-8'}>
      {!embedded && (
        <header className="mb-6 flex flex-col gap-4">
          <div>
            <span className="rounded-md bg-panel-2 px-2 py-0.5 text-xs text-muted">{modeLabel(project.mode, project.lang)}</span>
            <h1 className="mt-2 line-clamp-2 font-display text-3xl leading-tight md:text-4xl" title={project.name}>{project.name}</h1>
          </div>
          <Stepper project={project} current={step} onSelect={setStep} />
        </header>
      )}
      {embedded && !controlled && (
        <div className="mb-5">
          <Stepper project={project} current={step} onSelect={setStep} />
        </div>
      )}
      {step === 0 && <AnalyzeStep {...props} nextLabel={analyzeNextLabel} />}
      {step === 1 && <SearchStep {...props} />}
      {step === 2 && <SourcesStep {...props} />}
      {step === 3 && <ScriptStep {...props} />}
      {step === 4 && <ExportStep {...props} editor={exportEditor} />}
      {step === 5 && (project.mode === 'remix' ? <RemixTemplateStep {...props} /> : <TemplateStep {...props} />)}
    </div>
  );
}
