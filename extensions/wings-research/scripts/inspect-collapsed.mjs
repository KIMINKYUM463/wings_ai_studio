import fs from "node:fs"
const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
let idx = -1, c = 0
while ((idx = s.indexOf("collapsed", idx + 1)) !== -1 && c < 12) {
  console.log("---", idx)
  console.log(s.slice(Math.max(0, idx - 80), idx + 160).replace(/\n/g, " "))
  c++
}

const j = s.indexOf('return`<div class="wings-ai-panel">')
console.log("\njl return", s.slice(j, j + 350))
