import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const i = s.indexOf("function _n(")
console.log(s.slice(i - 450, i + 350))

// grade colors Ll
const j = s.indexOf("Ll=")
console.log("\nLl@", j)
console.log(s.slice(j, j + 500))

// find where html is mounted - flex-direction column
const k = s.indexOf('flex-direction:column')
console.log("\nflex-col count")
let idx = -1, c = 0
while ((idx = s.indexOf("flex-direction:column", idx + 1)) !== -1 && c < 8) {
  console.log("\n@", idx, s.slice(idx - 120, idx + 180))
  c++
}
