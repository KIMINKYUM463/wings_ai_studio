import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const i = s.indexOf('F.setAttribute(Wi,"shorts")')
console.log("shorts idx", i)
console.log(s.slice(i, i + 1000))

const chunk = s.slice(i, i + 1400)
for (const m of chunk.matchAll(/\bY\b/g)) {
  console.log("Y@", i + m.index, chunk.slice(Math.max(0, m.index - 40), m.index + 50))
}

// also search for leftover ,Y= or Y=== after our patch
const j = s.indexOf("placeLeft=")
console.log("\nplaceLeft", j)
console.log(s.slice(j - 100, j + 500))
