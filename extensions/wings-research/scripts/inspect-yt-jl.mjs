import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")

// jl calls
let idx = -1, c = 0
while ((idx = s.indexOf("jl(", idx + 1)) !== -1 && c < 15) {
  const snip = s.slice(idx, idx + 120)
  if (/jl\([a-z]/.test(snip)) console.log(c, snip.replace(/\n/g, " "))
  c++
}

// video object shape around channelName / likeCount
for (const k of ["channelName:", "likeCount:", "likeRatio", "author:", ".channel"]) {
  const i = s.indexOf(k)
  console.log("\n", k, i)
  if (i > 0) console.log(s.slice(i - 80, i + 160))
}

// El Bn Pi formatters
const i = s.indexOf("function El(")
console.log("\nEl", s.slice(i, i + 120))
const j = s.indexOf("function Bn(")
console.log("\nBn", s.slice(j, j + 120))
