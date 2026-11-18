import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")

// shorts overlay positioning
const i = s.indexOf('F.setAttribute(Wi,"shorts")')
console.log("--- shorts mount ---")
console.log(s.slice(i, i + 900))

// corner preferences
for (const k of ["top-left", "top-right", "bottom-left", "bottom-right", "corner", "getBoundingClientRect"]) {
  let idx = -1, c = 0
  while ((idx = s.indexOf(k, idx + 1)) !== -1 && c < 2) {
    if (idx > 298000 && idx < 305000) console.log(k, idx, s.slice(idx - 40, idx + 100).replace(/\n/g, " "))
    c++
  }
}

// tools / download related
const j = s.indexOf("wings-ai-tools")
console.log("\n--- tools in jl ---", j)
const jlStart = s.indexOf("function jl(")
const jlEnd = s.indexOf("function AS()", jlStart)
console.log(s.slice(jlStart, jlEnd).slice(-800))

// _S and xS
const k = s.indexOf("function _S(")
console.log("\n--- _S ---")
console.log(s.slice(k, k + 500))
const m = s.indexOf("function xS(")
console.log("\n--- xS ---")
console.log(s.slice(m, m + 400))
