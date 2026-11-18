import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const i = s.indexOf('F.style.width=`${Z}px`;const W=')
console.log(s.slice(i, i + 700))

console.log("\n--- Mw Ow ---")
console.log("Mw", s.indexOf("function Mw("), s.slice(s.indexOf("function Mw("), s.indexOf("function Mw(") + 120))
console.log("Ow", s.indexOf("function Ow("), s.slice(s.indexOf("function Ow("), s.indexOf("function Ow(") + 120))
