/** 리믹스 편집기에서 한 문장을 버전2 Gemini 목소리로 읽습니다. */
export async function synthesizeRemixGeminiLine(text: string, speed?: number): Promise<string> {
  const res = await fetch("/api/shotform/mvp-gemini-tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, speed }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || "음성 생성 실패")
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
