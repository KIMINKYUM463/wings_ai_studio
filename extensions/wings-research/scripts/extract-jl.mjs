import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")
const start = s.indexOf("function jl(n,r,i,l,s,c,f,d=!1)")
const end = s.indexOf("function AS()", start)
const fn = s.slice(start, end)
fs.writeFileSync("extensions/wings-research/scripts/_jl-extract.js", fn)
console.log("len", fn.length)
console.log(fn.slice(0, 500))
console.log("...")
console.log(fn.slice(-400))
