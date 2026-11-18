import fs from "node:fs"

const p = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(p, "utf8")

const old = 'const vidBusy=s==="video-run",cmtBusy=s==="csv-run"||s==="xls-run";'
const neu = 'const vidBusy=f==="video-run",cmtBusy=f==="csv-run"||f==="xls-run";'
if (!s.includes(old)) {
  console.error("busy missing")
  process.exit(1)
}
s = s.replace(old, neu)

const bad =
  "F.style.top=`${Math.round(Math.min(Math.max(V.top+12,72),Math.max(72,window.innerHeight-Z*1.8)))}px`"
const good = "F.style.top=`${Math.round(Math.max(V.top+12,72))}px`"
if (s.includes(bad)) {
  s = s.replace(bad, good)
  console.log("ok top")
} else {
  console.log("top already simplified?", s.includes("V.top+12"))
}

fs.writeFileSync(p, s)
console.log("ok busy")
