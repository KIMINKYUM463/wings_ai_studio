/**
 * 다른 언어 버전(해외판) 프로젝트로 가는 주소. 지금 화면 계열을 벗어나지 않는다
 * (윙스쇼핑숏폼 버전2 화면으로는 절대 보내지 않음: 썰은 썰 화면, 리믹스는 리믹스 화면).
 */
export function v2ProjectHref(pathname: string | null, projectId: string, mode?: string): string {
  const m = pathname?.match(/^(.*\/projects\/)[^/?#]+/);
  if (m && !m[1]!.includes('/wings-shopping-v2/')) return `${m[1]}${projectId}`;
  const base = mode === 'remix' ? '/WingsAIStudioShotForm/remix-shopping-v2' : '/WingsAIStudioShotForm/story-shopping-v2';
  return `${base}/projects/${projectId}`;
}

/** 버전2 진입 경로·사이드바 브랜딩 (pathname 기준) */

export type V2NavKind = 'story' | 'remix' | 'all';

export function v2NavFromPath(pathname: string | null): {
  kind: V2NavKind;
  base: string;
  title: string;
  /** 사이드바에 보여줄 프로젝트 mode 필터. null이면 전체 */
  modeFilter: string[] | null;
} {
  if (pathname?.includes('/story-shopping-v2')) {
    return {
      kind: 'story',
      base: '/WingsAIStudioShotForm/story-shopping-v2',
      title: 'AI 썰쇼핑숏폼',
      modeFilter: ['ssul'],
    };
  }
  if (pathname?.includes('/remix-shopping-v2')) {
    return {
      kind: 'remix',
      base: '/WingsAIStudioShotForm/remix-shopping-v2',
      title: 'AI 리믹스 쇼핑숏폼',
      modeFilter: ['remix'],
    };
  }
  return {
    kind: 'all',
    base: '/WingsAIStudioShotForm/wings-shopping-v2',
    title: '윙스쇼핑숏폼 버전2',
    modeFilter: null,
  };
}
