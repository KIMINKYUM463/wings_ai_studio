import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")

// find definition of _n - search for patterns like function _n( or _n=( or const _n=
const patterns = [
  /function _n\([^)]*\)\{/,
  /_n=function\([^)]*\)\{/,
  /,_n=\([^)]*\)=>/,
  /function _n\(/,
]

for (const p of patterns) {
  const m = s.match(p)
  console.log(String(p), m ? s.indexOf(m[0]) : -1)
}

// search for cursor:help near chip styles
const idx = s.indexOf("cursor:help")
console.log("cursor:help", idx)
if (idx > 0) console.log(s.slice(idx - 300, idx + 200))

// search for backdrop-filter which chips often use
let i = -1
let c = 0
while ((i = s.indexOf("backdrop-filter", i + 1)) !== -1 && c < 5) {
  console.log("\nbackdrop@", i)
  console.log(s.slice(i - 200, i + 250))
  c++
}
