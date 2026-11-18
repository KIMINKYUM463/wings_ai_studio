import fs from "node:fs"
const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
for (const k of ["description", "title:", ".title", "publishedText", "function Gi("]) {
  console.log(k, s.indexOf(k))
}
const i = s.indexOf("channelName:null,likeCount:null")
console.log(s.slice(i - 200, i + 120))
const j = s.indexOf("function Gi(")
console.log("\nGi", s.slice(j, j + 200))

// find how videos map stores fields
const k = s.indexOf("i.channelName=")
console.log("\nset channel", s.slice(k - 50, k + 250))
