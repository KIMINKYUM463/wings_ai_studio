import fs from "node:fs"

const path = "extensions/wings-research/content-scripts/youtube.js"
let s = fs.readFileSync(path, "utf8")

const oldCu =
  'Cu="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;box-sizing:border-box;border-radius:0;padding:8px 10px;font-size:11px;font-weight:650;line-height:1.25;white-space:nowrap;background:transparent;border-bottom:1px solid rgba(15,28,26,0.08);pointer-events:auto;";'

const newCu =
  'Cu="display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:148px;box-sizing:border-box;border-radius:10px;padding:8px 10px;font-size:11px;font-weight:650;line-height:1.25;white-space:nowrap;background:rgba(255,255,255,.97);border:1px solid rgba(15,28,26,.1);box-shadow:0 8px 18px -12px rgba(15,28,26,.35);pointer-events:auto;";'

if (!s.includes(oldCu)) {
  console.error("Cu missing")
  process.exit(1)
}
s = s.replace(oldCu, newCu)

const oldShorts =
  'F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:168px;max-width:200px;padding:8px;background:rgba(255,255,255,.97);border:1px solid rgba(15,28,26,.1);border-radius:14px;box-shadow:0 18px 40px -18px rgba(15,28,26,.42);font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;"'

const newShorts =
  'F.style.cssText="position:fixed;z-index:2200;display:flex;flex-direction:column;align-items:stretch;gap:6px;min-width:160px;max-width:196px;padding:0;background:transparent;border:none;box-shadow:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;pointer-events:none;"'

if (!s.includes(oldShorts)) {
  console.error("shorts missing")
  process.exit(1)
}
s = s.replace(oldShorts, newShorts)

const oldThumb =
  'nt.style.cssText="position:absolute;left:4px;bottom:4px;z-index:12;display:flex;flex-direction:column;align-items:stretch;gap:0;min-width:132px;max-width:170px;padding:6px;background:rgba(255,255,255,.96);border:1px solid rgba(15,28,26,.1);border-radius:12px;box-shadow:0 10px 24px -12px rgba(15,28,26,.4);pointer-events:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;"'

const newThumb =
  'nt.style.cssText="position:absolute;left:4px;bottom:4px;z-index:12;display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:132px;max-width:170px;padding:0;background:transparent;border:none;box-shadow:none;pointer-events:none;font-family:Pretendard,Apple SD Gothic Neo,system-ui,sans-serif;"'

if (s.includes(oldThumb)) {
  s = s.replace(oldThumb, newThumb)
  console.log("ok thumb")
}

// hero should be full width of stack
s = s.replace(
  'width:100%;box-sizing:border-box;border-radius:10px;padding:9px 12px;margin-bottom:4px;font-size:13px;',
  'min-width:148px;width:100%;box-sizing:border-box;border-radius:10px;padding:9px 12px;font-size:13px;'
)

fs.writeFileSync(path, s)
console.log("done")
