import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

// 1) Replace tools line in jl: remove xS/_S FAB, add download buttons
const oldTools =
  'const tools=[analyzeBtn,s?xS(n.videoId,s,c):"",_S(n,f??null,d)].filter(Boolean).join("");'
const newTools =
  'const vidBusy=s==="video-run",cmtBusy=s==="csv-run"||s==="xls-run";const dlVideo=`<button type="button" class="wings-ai-dl-btn" data-hd-yt-tool="video" data-hd-yt-vid="${esc(n.videoId||"")}" ${vidBusy?"disabled":""}>${vidBusy?Et("영상 준비 중…","Preparing…"):Et("영상 다운로드","Download video")}</button>`;const dlCmt=`<button type="button" class="wings-ai-dl-btn wings-ai-dl-btn--ghost" data-hd-yt-tool="csv" data-hd-yt-vid="${esc(n.videoId||"")}" ${cmtBusy?"disabled":""}>${cmtBusy?Et("댓글 추출 중…","Fetching…"):Et("댓글 다운로드","Download comments")}</button>`;const tools=[analyzeBtn,dlVideo,dlCmt].join("");'

if (!s.includes(oldTools)) {
  console.error("tools line missing")
  process.exit(1)
}
s = s.replace(oldTools, newTools)
console.log("ok tools")

// 2) Fix shorts overlay position/size so it sits beside the player
const oldPos = `F||(F=document.createElement("div"),F.setAttribute(Wi,"shorts"),F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:280px;max-width:320px;padding:0;background:transparent;border:none;box-shadow:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;",document.body.appendChild(F));const V=z.getBoundingClientRect(),C=i.density==="compact",Z=C?150:180,q=10,Y=Mw(i.corner);F.style.left=Y==="left"?\`\${Math.round(Math.max(V.left-Z-q,8))}px\`:\`\${Math.round(Math.max(8,Math.min(V.right+q,window.innerWidth-Z-8)))}px\`;const J=Ow(i.corner);J==="top"?(F.style.top=\`\${Math.round(Math.max(V.top+8,70))}px\`,F.style.bottom=""):(F.style.bottom=\`\${Math.round(Math.max(window.innerHeight-V.bottom+8,8))}px\`,F.style.top=""),F.style.width=\`\${Z}px\`;`

// The above uses template literals incorrectly for search. Use exact file substring.
const oldPosExact =
  'F||(F=document.createElement("div"),F.setAttribute(Wi,"shorts"),F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:280px;max-width:320px;padding:0;background:transparent;border:none;box-shadow:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;",document.body.appendChild(F));const V=z.getBoundingClientRect(),C=i.density==="compact",Z=C?150:180,q=10,Y=Mw(i.corner);F.style.left=Y==="left"?`${Math.round(Math.max(V.left-Z-q,8))}px`:`${Math.round(Math.max(8,Math.min(V.right+q,window.innerWidth-Z-8)))}px`;const J=Ow(i.corner);J==="top"?(F.style.top=`${Math.round(Math.max(V.top+8,70))}px`,F.style.bottom=""):(F.style.bottom=`${Math.round(Math.max(window.innerHeight-V.bottom+8,8))}px`,F.style.top=""),F.style.width=`${Z}px`;'

const newPosExact =
  'F||(F=document.createElement("div"),F.setAttribute(Wi,"shorts"),F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:260px;max-width:300px;padding:0;background:transparent;border:none;box-shadow:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;",document.body.appendChild(F));const V=z.getBoundingClientRect(),C=i.density==="compact",Z=C?260:300,q=14,leftRoom=V.left,rightRoom=window.innerWidth-V.right;let placeLeft=leftRoom>=Z+q+8;let placeRight=!placeLeft&&rightRoom>=Z+q+8;if(placeLeft)F.style.left=`${Math.round(V.left-Z-q)}px`;else if(placeRight)F.style.left=`${Math.round(V.right+q)}px`;else F.style.left=`${Math.round(Math.max(8,window.innerWidth-Z-12))}px`;F.style.top=`${Math.round(Math.min(Math.max(V.top+12,72),Math.max(72,window.innerHeight-Z*1.8)))}px`;F.style.bottom="";F.style.width=`${Z}px`;'

if (!s.includes(oldPosExact)) {
  console.error("pos block missing")
  const i = s.indexOf('F.setAttribute(Wi,"shorts")')
  console.log(s.slice(i, i + 650))
  process.exit(1)
}
s = s.replace(oldPosExact, newPosExact)
console.log("ok position")

fs.writeFileSync(path, s)
console.log("done", {
  hasDl: s.includes("wings-ai-dl-btn"),
  noFamInJlTools: !s.includes('const tools=[analyzeBtn,s?xS'),
})
