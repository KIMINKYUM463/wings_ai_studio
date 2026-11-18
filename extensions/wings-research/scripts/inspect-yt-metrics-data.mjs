import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")

// find main metrics builder around 조회/구독자
const keys = ["channelTitle", "channelName", "subscriberCount", "likeCount", "viewCount", "function rp(", "scoreOf", "outlierMultiple"]
for (const k of keys) console.log(k, s.indexOf(k))

const i = s.indexOf('Et("조회","Views")')
// find the function containing the full metrics return
const start = s.lastIndexOf("function ", i)
console.log("\nfn start", start)
console.log(s.slice(start, start + 80))

// extract the big return array for metrics
const marker = "const m=rp(n,r,l),p=r.grade;return["
const j = s.indexOf(marker)
console.log("\n--- builder ---")
console.log(s.slice(j, j + 1600))

// channel fields near video object
const k = s.indexOf("subscriberCount")
console.log("\n--- sub context ---")
console.log(s.slice(k - 100, k + 200))
