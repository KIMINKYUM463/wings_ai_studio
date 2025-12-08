export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query) {
    return Response.json({ error: "검색어가 필요합니다." }, { status: 400 })
  }

  try {
    const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "zAwX6mkPBA3GFR_ekAUmXMyjUis7aWlmXIqG7lVP6K8"

    console.log("[v0] Unsplash API 호출:", query)

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      },
    )

    if (!response.ok) {
      const errorBody = await response.text()
      console.error("[v0] Unsplash API 에러:", response.status, errorBody)
      throw new Error("Unsplash API 호출 실패")
    }

    const data = await response.json()
    console.log("[v0] Unsplash API 응답:", data.results?.length, "개 이미지 발견")

    return Response.json({
      images: data.results.map((photo: any) => ({
        id: photo.id,
        url: photo.urls.regular,
        thumbnail: photo.urls.small,
        description: photo.description || photo.alt_description,
        photographer: photo.user.name,
      })),
    })
  } catch (error) {
    console.error("[v0] 이미지 검색 실패:", error)
    return Response.json({ error: "이미지 검색에 실패했습니다." }, { status: 500 })
  }
}
