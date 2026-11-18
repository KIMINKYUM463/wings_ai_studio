import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const replacements = [
  // loaded head: remove Bl icon next to grade badge
  [
    '`<div class="wings-metric-head" style="display:flex;align-items:center;gap:8px;width:100%;margin-bottom:2px;">${Bl(!1,p)}${p&&r.outlierMultiple!=null?_n(`${Al(p)} ${Pi(r.outlierMultiple)}`,Ll[p].fg,`background:${Ll[p].bg};font-weight:800;`,m.mult):_n(Et("평소값 계산 중…","computing baseline…"),"#0f1c1a","background:#eef6f4;color:#0f1c1a;")}</div>`',
    '`<div class="wings-metric-head" style="display:flex;align-items:center;gap:8px;width:100%;margin-bottom:2px;">${p&&r.outlierMultiple!=null?_n(`${Al(p)} ${Pi(r.outlierMultiple)}`,Ll[p].fg,`background:${Ll[p].bg};font-weight:800;`,m.mult):_n(Et("평소값 계산 중…","computing baseline…"),"#0f1c1a","background:#eef6f4;color:#0f1c1a;")}</div>`',
    "remove Bl from loaded head",
  ],
  // loading head
  [
    'return`<div style="display:flex;align-items:center;gap:6px;">${Bl(!0)}${_n(`${Et("조회","Views")} …`,"#14b8a6")}</div>`',
    'return`<div class="wings-metric-head" style="display:flex;align-items:center;gap:8px;width:100%;">${_n(`${Et("조회","Views")} …`,"#14b8a6")}</div>`',
    "remove Bl from loading head",
  ],
]

// compact mode helper that also uses Bl
const compactOld =
  'return[c&&r.outlierMultiple!=null?`<div style="display:flex;align-items:center;gap:4px;">${Bl(!1,c,20)}${_n(`${Al(c)} ${Pi(r.outlierMultiple)}`,Ll[c].fg,`background:${Ll[c].bg};font-weight:800;`,s.mult)}</div>`:"",r.vph!=null?_n(`${Et("시간당 조회","Views/hr")} ${Bn(r.vph)}`,"#8ec8f0","",s.vph):""].filter(Boolean).join("")'
const compactNew =
  'return[c&&r.outlierMultiple!=null?_n(`${Al(c)} ${Pi(r.outlierMultiple)}`,Ll[c].fg,`background:${Ll[c].bg};font-weight:800;`,s.mult):"",r.vph!=null?_n(`${Et("시간당 조회","Views/hr")} ${Bn(r.vph)}`,"#8ec8f0","",s.vph):""].filter(Boolean).join("")'

if (s.includes(compactOld)) {
  s = s.replace(compactOld, compactNew)
  console.log("ok compact")
} else {
  console.warn("compact pattern not exact, trying softer")
  const soft = "${Bl(!1,c,20)}"
  if (s.includes(soft)) {
    s = s.replace(soft, "")
    console.log("ok soft compact Bl remove")
  }
}

for (const [from, to, label] of replacements) {
  if (!s.includes(from)) {
    console.error("NOT FOUND:", label)
    process.exit(1)
  }
  s = s.replace(from, to)
  console.log("ok:", label)
}

// also remove any remaining head Bl(!1,p) occurrences near metric head
const leftovers = (s.match(/\$\{Bl\(!1,p\)\}/g) || []).length
const leftovers2 = (s.match(/\$\{Bl\(!0\)\}/g) || []).length
console.log({ leftovers, leftovers2 })

fs.writeFileSync(path, s)

// bump version
const manPath = "extensions/wings-research/manifest.json"
const man = JSON.parse(fs.readFileSync(manPath, "utf8"))
man.version = "0.3.65.25"
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n")
console.log("version", man.version)
