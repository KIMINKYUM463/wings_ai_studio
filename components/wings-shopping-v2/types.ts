import type { Project } from '@/lib/wings-shopping-v2/types';

export type StepProps = {
  project: Project;
  setProject: (p: Project) => void;
  refresh: () => Promise<Project | null>;
  goNext: () => void;
  /** 영상 템플릿을 별도 단계로 뺐으면 대본 화면에서는 템플릿을 숨긴다 */
  separateTemplates?: boolean;
  /** true면 대본 단계의 Flow AI 장면 패널을 숨긴다 (썰쇼핑숏폼) */
  hideFlow?: boolean;
  /** true면 내보내기 단계를 캡컷식 편집 화면으로 보여준다 (썰 v2) */
  exportEditor?: boolean;
  /** 자동편집의 '썸네일 생성' 탭에 들어갈 화면 (썰쇼핑숏폼은 스토리쇼핑숏폼 썸네일 기능을 넣는다) */
  thumbnailSlot?: import('react').ReactNode;
  /** 한국어 원본·해외판 전환 (썰쇼핑숏폼: 같은 화면 안에서 바꿈) */
  onOpenVersion?: (projectId: string) => void;
};
