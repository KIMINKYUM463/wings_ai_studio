import fs from "node:fs"
const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const k = s.indexOf("function _S(")
console.log(s.slice(k, k + 1200))

// tool click handlers
let idx = -1, c = 0
while ((idx = s.indexOf("data-hd-yt-tool", idx + 1)) !== -1 && c < 8) {
  console.log("\n@", idx, s.slice(idx - 30, idx + 100))
  c++
}

const m = s.indexOf('ht==="video"')
console.log("\n--- handler ---")
console.log(s.slice(m - 100, m + 400))

const n = s.indexOf('ht==="csv"')
console.log("\n--- csv ---")
console.log(s.slice(n - 50, n + 200))
