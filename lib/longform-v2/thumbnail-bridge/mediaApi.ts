/** 웹: 프로젝트 썸네일은 부모 onSaved(dataUrl)로 전달 */

export async function saveProjectThumbnail(
  _projectId: string,
  input: { file: File } | { imageBase64: string } | Blob | File,
): Promise<{ status: string; path: string; thumbnailUrl: string; project: unknown }> {
  let dataUrl = ""

  if (typeof File !== "undefined" && input instanceof File) {
    dataUrl = await blobToDataUrl(input)
  } else if (typeof Blob !== "undefined" && input instanceof Blob) {
    dataUrl = await blobToDataUrl(input)
  } else if (input && typeof input === "object" && "file" in input && input.file) {
    dataUrl = await blobToDataUrl(input.file)
  } else if (input && typeof input === "object" && "imageBase64" in input) {
    const b64 = String(input.imageBase64 || "").trim()
    if (!b64) throw new Error("썸네일 데이터가 비어 있습니다.")
    dataUrl = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`
  } else {
    throw new Error("지원하지 않는 썸네일 입력입니다.")
  }

  if (!dataUrl) throw new Error("썸네일 데이터가 비어 있습니다.")

  const hook = (globalThis as unknown as { __lfv2SaveThumbnail?: (url: string) => void })
    .__lfv2SaveThumbnail
  hook?.(dataUrl)

  return {
    status: "ok",
    path: "",
    thumbnailUrl: dataUrl,
    project: null,
  }
}

function blobToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(reader.error || new Error("썸네일 인코딩 실패"))
    reader.readAsDataURL(file)
  })
}

export async function getUploadedImages(_projectId: string) {
  return { images: [], count: 0, imageTimeline: null }
}
