import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const old =
  "const V=z.getBoundingClientRect(),C=i.density===\"compact\",Z=C?260:300,q=14,leftRoom=V.left,rightRoom=window.innerWidth-V.right;"
const neu =
  "const V=z.getBoundingClientRect(),C=i.density===\"compact\",Z=C?260:300,q=14,Y=Mw(i.corner),J=Ow(i.corner),leftRoom=V.left,rightRoom=window.innerWidth-V.right;"

if (!s.includes(old)) {
  console.error("target missing")
  process.exit(1)
}
s = s.replace(old, neu)
fs.writeFileSync(path, s)

// syntax check the shorts region by extracting a bit and verifying Y/J defined before use
const i = s.indexOf('F.setAttribute(Wi,"shorts")')
const chunk = s.slice(i, i + 900)
console.log("has Y def", chunk.includes("Y=Mw(i.corner)"))
console.log("has J def", chunk.includes("J=Ow(i.corner)"))
console.log("stamp still uses Y", s.includes("${Y}:${J}:${C?"))

// bump version
const manPath = "extensions/wings-research/manifest.json"
const man = JSON.parse(fs.readFileSync(manPath, "utf8"))
man.version = "0.3.65.31"
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n")
console.log("version", man.version)
