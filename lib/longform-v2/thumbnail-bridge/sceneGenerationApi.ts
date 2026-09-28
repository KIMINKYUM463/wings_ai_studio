/** 장면 이미지 — 웹 longform-v2는 프로젝트 scenes에서 부모가 넘김. 스튜디오 폴백용 빈 목록 */
export async function getSceneImages(_projectId: string): Promise<{ images: string[] }> {
  return { images: [] }
}
