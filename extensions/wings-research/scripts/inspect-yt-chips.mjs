import fs from "node:fs"

const s = fs.readFileSync("extensions/wings-research/content-scripts/youtube.js", "utf8")

for (const k of ["hd-rv-chip", "hd-native-chip", "hd-rv", "구독자", "참여율", "시간당 조회", "도달"]) {
  console.log(k, s.indexOf(k))
}

const i = s.indexOf("hd-rv-chip")
console.log("\n--- chip class ---")
console.log(s.slice(Math.max(0, i - 250), i + 500))

const j = s.indexOf('Et("조회"')
console.log("\n--- views ---")
console.log(s.slice(Math.max(0, j - 80), j + 1200))

// find function that wraps colored chips
const m = s.match(/function [A-Za-z_$][\w$]*\([^)]*\)\{[^}]{0,80}border-radius:9999px[^}]{0,200}\}/)
console.log("\n--- pill fn match ---", Boolean(m))
if (m) console.log(m[0].slice(0, 400))

const k = s.indexOf("border-radius:9999px")
console.log("\n--- 9999px ---")
console.log(s.slice(Math.max(0, k - 200), k + 350))
