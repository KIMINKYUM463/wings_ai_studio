// Quick verify: npx tsx scripts/verify-yt-transcript.ts PRZYrqXYGfc
import { fetchYoutubeTranscript } from "../lib/youtube-transcript"

async function main() {
  const videoId = process.argv[2] || "PRZYrqXYGfc"
  const text = await fetchYoutubeTranscript(videoId)
  console.log("len:", text.length)
  console.log("sample:", text.slice(0, 300))
}

main().catch(console.error)
