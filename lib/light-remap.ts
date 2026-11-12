export const LIGHT_REMAP_CLASS = "light-remap"

// 원래 다크 UI로 만들어진 화면 경로. 여기 걸리면 app/light-remap.css 로 밝은 테마가 적용된다.
// 인라인 스크립트로도 직렬화되므로 바깥 변수를 참조하지 않는 자급식 함수로 유지해야 한다.
export function isLightRemapPath(pathname: string): boolean {
  const SHOTFORM = "/WingsAIStudioShotForm"
  const SHOTFORM_ALREADY_LIGHT = ["shopping", "ai-editor", "youtube-analytics", "youtube-trends"]
  if (pathname === SHOTFORM || pathname.startsWith(SHOTFORM + "/")) {
    const segment = pathname.slice(SHOTFORM.length + 1).split("/")[0]
    return !SHOTFORM_ALREADY_LIGHT.includes(segment)
  }
  return ["/main", "/moneytaker/blog-ai"].some((p) => pathname === p || pathname.startsWith(p + "/"))
}

/** 첫 페인트 전에 <html> 에 클래스를 붙이는 인라인 스크립트 본문 */
export const LIGHT_REMAP_BOOT_SCRIPT = `try{if((${isLightRemapPath.toString()})(location.pathname))document.documentElement.classList.add("${LIGHT_REMAP_CLASS}")}catch(e){}`
