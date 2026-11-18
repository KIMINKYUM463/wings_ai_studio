import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const oldCu =
  'Cu="display:inline-flex;align-items:center;gap:2px;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;line-height:1.5;white-space:nowrap;background:rgba(0,0,0,0.72);filter:drop-shadow(0 1px 3px rgba(0,0,0,0.32));pointer-events:auto;";'

const newCu =
  'Cu="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;box-sizing:border-box;border-radius:0;padding:8px 10px;font-size:11px;font-weight:650;line-height:1.25;white-space:nowrap;background:transparent;border-bottom:1px solid rgba(15,28,26,0.08);pointer-events:auto;";'

const oldFn =
  'function _n(n,r,i="",l=""){return`<span${l?` ${ao}="${l.replace(/"/g,"&quot;")}"`:""} style="${Cu}color:${r};${i}${l?"cursor:help;":""}">${n}</span>`}'

const newFn = `function _n(n,r,i="",l=""){const tip=l?\` \${ao}="\${l.replace(/"/g,"&quot;")}"\`:"";const hero=/background\\s*:/.test(i);if(hero)return\`<span\${tip} class="wings-metric wings-metric--hero" style="display:inline-flex;align-items:center;justify-content:center;gap:4px;width:100%;box-sizing:border-box;border-radius:10px;padding:9px 12px;margin-bottom:4px;font-size:13px;font-weight:800;line-height:1.2;white-space:nowrap;box-shadow:0 8px 18px -12px rgba(15,118,110,.45);pointer-events:auto;color:\${r};\${i}\${l?"cursor:help;":""}">\${n}</span>\`;let label="",value=String(n??"");const known=["시간당 조회","Views/hr","평소값 계산 중…","computing baseline…"];for(const k of known){if(value===k){label=k;value="";break}if(value.startsWith(k+" ")){label=k;value=value.slice(k.length).trim();break}}if(!label){const sp=value.lastIndexOf(" ");if(sp>0){label=value.slice(0,sp);value=value.slice(sp+1)}}return\`<span\${tip} class="wings-metric" style="\${Cu}\${l?"cursor:help;":""}"><span class="wings-metric-k" style="color:#5b6b66;font-weight:600;font-size:10px;letter-spacing:.02em;">\${label}</span><span class="wings-metric-v" style="color:#0f1c1a;font-weight:800;font-variant-numeric:tabular-nums;border-bottom:2px solid \${r};padding-bottom:1px;">\${value}</span></span>\`}`

if (!s.includes(oldCu)) {
  console.error("Cu not found")
  process.exit(1)
}
if (!s.includes(oldFn)) {
  console.error("_n not found")
  process.exit(1)
}

s = s.replace(oldCu, newCu)
s = s.replace(oldFn, newFn)

const oldShorts =
  'F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:flex-end;gap:5px;font-family:Pretendard,system-ui,sans-serif;pointer-events:none;"'

const newShorts =
  'F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:168px;max-width:200px;padding:8px;background:rgba(255,255,255,.97);border:1px solid rgba(15,28,26,.1);border-radius:14px;box-shadow:0 18px 40px -18px rgba(15,28,26,.42);font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;"'

if (!s.includes(oldShorts)) {
  console.error("shorts style not found")
  process.exit(1)
}
s = s.replace(oldShorts, newShorts)

// thumbnail corner overlay - make a compact white card too
const oldThumb =
  'nt.style.cssText="position:absolute;left:4px;bottom:4px;z-index:12;display:flex;flex-direction:column;align-items:flex-start;gap:3px;pointer-events:none;font-family:Pretendard,system-ui,sans-serif;"'

const newThumb =
  'nt.style.cssText="position:absolute;left:4px;bottom:4px;z-index:12;display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:132px;max-width:170px;padding:6px;background:rgba(255,255,255,.96);border:1px solid rgba(15,28,26,.1);border-radius:12px;box-shadow:0 10px 24px -12px rgba(15,28,26,.4);pointer-events:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;"'

if (s.includes(oldThumb)) {
  s = s.replace(oldThumb, newThumb)
  console.log("ok thumb card")
} else {
  console.warn("thumb style not found (skip)")
}

// header row with icon+grade should not force flex-end
const oldHead =
  '`<div style="display:flex;align-items:center;gap:6px;">${Bl(!1,p)}${p&&r.outlierMultiple!=null?_n(`${Al(p)} ${Pi(r.outlierMultiple)}`,Ll[p].fg,`background:${Ll[p].bg};font-weight:800;`,m.mult):_n(Et("평소값 계산 중…","computing baseline…"),"#ffffff")}</div>`'

const newHead =
  '`<div class="wings-metric-head" style="display:flex;align-items:center;gap:8px;width:100%;margin-bottom:2px;">${Bl(!1,p)}${p&&r.outlierMultiple!=null?_n(`${Al(p)} ${Pi(r.outlierMultiple)}`,Ll[p].fg,`background:${Ll[p].bg};font-weight:800;`,m.mult):_n(Et("평소값 계산 중…","computing baseline…"),"#0f1c1a","background:#eef6f4;color:#0f1c1a;")}</div>`'

if (s.includes(oldHead)) {
  s = s.replace(oldHead, newHead)
  console.log("ok head")
} else {
  console.warn("head not found")
  // try partial
  const partial = '`<div style="display:flex;align-items:center;gap:6px;">${Bl(!1,p)}'
  const idx = s.indexOf(partial)
  console.log("partial idx", idx)
  if (idx >= 0) console.log(s.slice(idx, idx + 280))
}

fs.writeFileSync(path, s)
console.log("patched youtube.js", s.includes("wings-metric-k"))
