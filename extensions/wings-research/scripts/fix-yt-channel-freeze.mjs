/**
 * Emergency fix: YouTube channel pages freeze ("응답 없는 페이지").
 * Root cause: document.documentElement.innerHTML full serialization on a timer,
 * plus aggressive channel-dashboard remount loops.
 */
import fs from "node:fs"

const yt = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(yt, "utf8")

// 1) Kill full-page HTML scrapes (main freeze cause)
const scrapes = s.split("document.documentElement.innerHTML").length - 1
s = s.replaceAll("document.documentElement.innerHTML", '""')
console.log("neutralized innerHTML scrapes:", scrapes)

// 2) Disable channel dashboard mount path entirely (At no-op)
const atOld =
  "async function At(){if(it)return;if(!K())return;"
const atNew =
  "async function At(){return;if(it)return;if(!K())return;"
if (!s.includes(atOld)) {
  console.error("At patch miss")
  process.exit(1)
}
s = s.replace(atOld, atNew)
console.log("At disabled")

// 3) Stop MutationObserver + interval hammering $t → At
const stOld =
  'function $t(){if(K()){if(!q){try{const html="";'
// after innerHTML neutralize, $t starts with const html=""
if (!s.includes("function $t(){if(K()){")) {
  console.error("$t miss")
  process.exit(1)
}

// Replace entire $t body start to early-return when we just want silence:
// Safer: make $t a no-op
const stStart = s.indexOf("function $t(){")
const stEnd = s.indexOf("setTimeout($t,600)", stStart)
if (stStart < 0 || stEnd < 0) {
  console.error("$t range miss", stStart, stEnd)
  process.exit(1)
}
const before = s.slice(0, stStart)
const after = s.slice(stEnd)
s =
  before +
  "function $t(){/* channel dash disabled — was freezing YT */}" +
  after
console.log("$t disabled")

// Also clear the interval/timeout callers? Keep setTimeout($t) — no-op is fine.
fs.writeFileSync(yt, s)

// 4) Disable light-dom qstat script (remove from manifest)
const manPath = "extensions/wings-research/manifest.json"
const man = JSON.parse(fs.readFileSync(manPath, "utf8"))
for (const cs of man.content_scripts || []) {
  if (!Array.isArray(cs.js)) continue
  cs.js = cs.js.filter((j) => !j.includes("wings-channel-qstat.js"))
}
man.version = "0.3.65.42"
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n")
console.log("manifest", man.version)

const bgPath = "extensions/wings-research/background.js"
let bg = fs.readFileSync(bgPath, "utf8")
bg = bg.replace(/wings_version:\s*"0\.3\.65\.\d+"/, 'wings_version: "0.3.65.42"')
fs.writeFileSync(bgPath, bg)

// 5) Make qstat a hard no-op even if cached
fs.writeFileSync(
  "extensions/wings-research/content-scripts/wings-channel-qstat.js",
  "/* disabled 0.3.65.42 — caused YouTube main-thread freezes */\n"
)
console.log("done")
