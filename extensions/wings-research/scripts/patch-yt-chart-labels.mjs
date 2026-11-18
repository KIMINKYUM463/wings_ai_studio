import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const start = s.indexOf("const bars=[Math.min(100,Math.log10")
if (start < 0) {
  console.error("bars not found")
  process.exit(1)
}
const chartEnd = s.indexOf("const grade=", start)
if (chartEnd < 0) {
  console.error("grade not found")
  process.exit(1)
}

const replacement = `const barMeta=[{k:"조회",full:Et("조회수","Views"),v:Math.min(100,Math.log10((n.viewCount||1)+1)*18)},{k:"좋아요",full:Et("좋아요","Likes"),v:Math.min(100,(r.likeRatio||0)*800)},{k:"시간당",full:Et("시간당 조회","Views/hr"),v:Math.min(100,Math.log10((r.vph||1)+1)*25)},{k:"도달",full:Et("도달","Reach"),v:Math.min(100,Math.min(r.reachMultiple||0,80)*1.2)},{k:"참여",full:Et("참여율","Engagement"),v:Math.min(100,(r.engagementRate||0)*1200)}].map(b=>({...b,v:Math.max(14,Math.round(b.v))}));const chart=\`<div class="wings-ai-chart-wrap"><svg class="wings-ai-svg" viewBox="0 0 58 96" width="58" height="96" aria-hidden="true"><defs><linearGradient id="wingsAiBarGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#0f766e"/><stop offset="55%" stop-color="#14b8a6"/><stop offset="100%" stop-color="#99f6e4"/></linearGradient></defs><g class="wings-ai-grid" opacity=".35">\${[18,36,54,72].map(y=>\`<line x1="4" x2="54" y1="\${y}" y2="\${y}" stroke="#0f766e" stroke-width=".6" stroke-dasharray="2 3"/>\`).join("")}</g>\${barMeta.map((b,ix)=>{const h=(b.v/100)*84;const x=5+ix*10;const y=90-h;return \`<g class="wings-ai-bar-group" style="animation-delay:\${ix*.08}s"><rect class="wings-ai-bar" x="\${x}" y="\${y}" width="7" height="\${h}" rx="2"/><rect class="wings-ai-bar-glow" x="\${x}" y="\${y}" width="7" height="\${Math.max(4,h*0.22)}" rx="2"/></g>\`}).join("")}<rect class="wings-ai-scan" x="3" y="6" width="52" height="2" rx="1"/></svg><div class="wings-ai-chart-keys">\${barMeta.map((b,ix)=>\`<span class="wings-ai-chart-key" style="animation-delay:\${.12+ix*.06}s" title="\${esc(b.full)}">\${esc(b.k)}</span>\`).join("")}</div></div>\`;`

s = s.slice(0, start) + replacement + s.slice(chartEnd)

// update chart label text in HTML
s = s.replace(
  '<div class="wings-ai-chart-label">Signal</div>${chart}',
  '<div class="wings-ai-chart-label">Signal Mix</div><div class="wings-ai-chart-sub">조회·반응·속도</div>${chart}'
)

fs.writeFileSync(path, s)
console.log("ok", s.includes("wings-ai-chart-keys"), s.includes("Signal Mix"))
