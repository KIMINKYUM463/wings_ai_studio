import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const start = s.indexOf("function jl(n,r,i,l,s,c,f,d=!1)")
const end = s.indexOf("function AS()", start)
if (start < 0 || end < 0) {
  console.error("jl missing")
  process.exit(1)
}

const newJl = `function jl(n,r,i,l,s,c,f,d=!1){
  const esc=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
  const row=(k,v,tip="")=>v==null||v===""?"":\`<div class="wings-ai-row"\${tip?\` \${ao}="\${esc(tip)}" style="cursor:help"\`:""}><span class="wings-ai-k">\${k}</span><span class="wings-ai-v">\${v}</span></div>\`;
  if(!r||n.viewCount==null)return\`<div class="wings-ai-panel wings-ai-panel--loading"><div class="wings-ai-top"><span class="wings-ai-badge"><i></i>WINGS AI</span><span class="wings-ai-pulse">Analyzing…</span></div><div class="wings-ai-skel"></div></div>\`;
  const m=rp(n,r,l),p=r.grade;
  const ch=n.channelName?esc(n.channelName):esc(Et("채널 미확인","Unknown channel"));
  const likeVal=n.likeCount!=null?Bn(n.likeCount):r.likeRatio!=null?El(r.likeRatio):null;
  const bars=[Math.min(100,Math.log10((n.viewCount||1)+1)*18),Math.min(100,(r.likeRatio||0)*800),Math.min(100,Math.log10((r.vph||1)+1)*25),Math.min(100,Math.min(r.reachMultiple||0,80)*1.2),Math.min(100,(r.engagementRate||0)*1200)].map(v=>Math.max(14,Math.round(v)));
  const chart=\`<svg class="wings-ai-svg" viewBox="0 0 58 96" width="58" height="96" aria-hidden="true">\${bars.map((bh,ix)=>{const h=(bh/100)*84;const x=5+ix*10;const y=90-h;return \`<rect class="wings-ai-bar" x="\${x}" y="\${y}" width="7" height="\${h}" rx="2" style="animation-delay:\${ix*.07}s"/>\`}).join("")}</svg>\`;
  const grade=p&&r.outlierMultiple!=null?\`<span class="wings-ai-grade"\${m.mult?\` \${ao}="\${esc(m.mult)}" style="cursor:help"\`:""}>\${esc(Al(p))} \${esc(Pi(r.outlierMultiple))}</span>\`:\`<span class="wings-ai-grade wings-ai-grade--soft">\${esc(Et("평소값 계산 중…","computing baseline…"))}</span>\`;
  const rows=[
    row(Et("채널명","Channel"),\`<span class="wings-ai-channel">\${ch}</span>\`),
    i!=null?row(Et("구독자","Subscribers"),Bn(i)):"",
    row(Et("조회수","Views"),Bn(n.viewCount),m.views),
    likeVal!=null?row(Et("좋아요","Likes"),likeVal,m.like):"",
    r.vph!=null?row(Et("시간당 조회","Views/hr"),Bn(r.vph),m.vph):"",
    r.reachMultiple!=null?row(Et("도달","Reach"),Pi(r.reachMultiple),m.reach):"",
    r.engagementRate!=null?row(Et("참여율","Engagement"),El(r.engagementRate),m.eng):""
  ].filter(Boolean).join("");
  const analyzeBtn=\`<button type="button" class="wings-ai-analyze-btn" data-wings-ai-analyze="1" data-video-id="\${esc(n.videoId||"")}" data-title="\${esc(n.title||"")}" data-channel="\${esc(n.channelName||"")}" data-views="\${esc(n.viewCount??"")}" data-subs="\${esc(i??"")}" data-likes="\${esc(n.likeCount??r.likeRatio??"")}" data-vph="\${esc(r.vph??"")}" data-reach="\${esc(r.reachMultiple??"")}" data-eng="\${esc(r.engagementRate??"")}" data-grade="\${esc(p||"")}">AI 분석</button>\`;
  const tools=[analyzeBtn,s?xS(n.videoId,s,c):"",_S(n,f??null,d)].filter(Boolean).join("");
  return\`<div class="wings-ai-panel"><div class="wings-ai-top"><span class="wings-ai-badge"><i></i>WINGS AI</span>\${grade}</div><div class="wings-ai-body"><div class="wings-ai-chart"><div class="wings-ai-chart-label">Signal</div>\${chart}</div><div class="wings-ai-rows">\${rows}</div></div><div class="wings-ai-tools">\${tools}</div></div>\`;
}`

try {
  new Function(newJl)
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

s = s.slice(0, start) + newJl.replace(/\n\s*/g, "") + s.slice(end)
fs.writeFileSync(path, s)
console.log("ok", s.includes("data-wings-ai-analyze"))
