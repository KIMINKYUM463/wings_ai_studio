import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const i = s.indexOf('setAttribute(Wi,"shorts")')
console.log(s.slice(i - 200, i + 100))
const j = s.indexOf("Wi=")
console.log("Wi@", j, s.slice(j, j + 80))

// thumbnail overlay similar
const k = s.indexOf('setAttribute(Wi,')
let idx = k, c = 0
while (idx !== -1 && c < 6) {
  console.log("\nsetAttr@", idx, s.slice(idx, idx + 80))
  idx = s.indexOf("setAttribute(Wi,", idx + 1)
  c++
}
