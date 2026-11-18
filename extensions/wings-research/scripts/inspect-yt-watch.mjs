import fs from "node:fs"
const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const i = s.indexOf('setAttribute(Wi,"watch")')
console.log(s.slice(i, i + 400))
const j = s.indexOf("Bl(!0)")
console.log("---loading---")
console.log(s.slice(j - 100, j + 220))
