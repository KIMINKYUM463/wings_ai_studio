import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/coupang-image-badge.js"
let s = fs.readFileSync(path, "utf8")
const before = s.length

function mustReplace(from, to, label) {
  if (!s.includes(from)) {
    console.error("NOT FOUND:", label)
    process.exit(1)
  }
  s = s.replace(from, to)
  console.log("ok:", label)
}

mustReplace(
  'h(U.products??[]),o("results")',
  'h((U.products??[]).slice(0,5)),o("results")',
  "limit fetch to 5"
)

mustReplace(
  'rt.jsx(sp,{products:f,onClose:()=>o("idle")})',
  'rt.jsx(sp,{products:(Array.isArray(f)?f:[]).slice(0,5),onClose:()=>o("idle")})',
  "limit render to 5"
)

mustReplace(
  'src:chrome.runtime.getURL("icons/wings-32.png"),alt:"WINGS",width:28,height:28,style:{width:28,height:28,borderRadius:"50%",background:"#05070a",border:"1px solid #2a3545",objectFit:"cover",flex:"none"}',
  'src:chrome.runtime.getURL("icons/wings-btn-32.png"),alt:"WINGS",width:28,height:28,style:{width:28,height:28,borderRadius:"50%",background:"#ffffff",border:"1px solid rgba(15,118,110,0.25)",objectFit:"contain",flex:"none"}',
  "white logo"
)

const toggleStart =
  'rt.jsxs("button",{type:"button",onClick:b,"aria-pressed":s,className:"flex items-center justify-between gap-2 border-b border-border px-5 py-3 text-left transition-colors hover:bg-muted",children:[rt.jsxs("span",{className:"min-w-0",children:[rt.jsx("span",{className:"block text-sm font-medium",children:"공정위 문구까지 같이 복사"}),rt.jsx("span",{className:"block truncate text-xs text-muted-foreground",children:Uf})]}),rt.jsx(Zy,{variant:s?"default":"secondary",className:"shrink-0 rounded-full",children:s?"켜짐":"꺼짐"})]}),'

mustReplace(toggleStart, "", "remove FTC toggle UI")

mustReplace(
  "O.useEffect(()=>{chrome.storage.local.get(Rc).then(y=>o((y==null?void 0:y[Rc])!==!1)).catch(()=>{})},[]),",
  "",
  "remove FTC storage sync"
)

// Keep disclosure always on: const[s,o]=O.useState(!0) already; force s=true in product rows by leaving state true.
// Also force copy path: if somewhere uses s from storage, ensure default stays true.
// Change useState init remains !0.

fs.writeFileSync(path, s)
console.log(
  JSON.stringify({
    before,
    after: s.length,
    hasToggle: s.includes("공정위 문구까지 같이 복사"),
    hasSlice: s.includes(".slice(0,5)"),
  })
)
