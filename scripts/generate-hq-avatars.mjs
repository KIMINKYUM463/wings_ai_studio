import fs from "fs"
import path from "path"

const dir = path.join(process.cwd(), "public", "hq-avatars")
fs.mkdirSync(dir, { recursive: true })

const avatars = [
  ["kr-f-10s-sua", "#f472b6", "#9f1239", "수"],
  ["kr-m-10s-minjun", "#38bdf8", "#1d4ed8", "민"],
  ["kr-f-20s-jiwoo", "#e879f9", "#6d28d9", "지"],
  ["kr-m-20s-hyunwoo", "#22d3ee", "#4338ca", "현"],
  ["kr-f-30s-seoyeon", "#fbbf24", "#c2410c", "서"],
  ["kr-m-30s-junho", "#34d399", "#115e59", "준"],
  ["kr-f-40s-mikyeong", "#fda4af", "#9f1239", "미"],
  ["kr-m-40s-seongmin", "#94a3b8", "#1e293b", "성"],
  ["kr-f-50s-yeonghui", "#bef264", "#166534", "영"],
  ["kr-m-50s-cheolho", "#a8a29e", "#292524", "철"],
]

for (const [id, c1, c2, initial] of avatars) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#0c0d10"/>
  <circle cx="256" cy="256" r="210" fill="url(#g)" opacity="0.35"/>
  <circle cx="256" cy="200" r="88" fill="#f5e6d3"/>
  <ellipse cx="256" cy="360" rx="130" ry="110" fill="url(#g)"/>
  <circle cx="226" cy="195" r="8" fill="#1f2937"/>
  <circle cx="286" cy="195" r="8" fill="#1f2937"/>
  <path d="M230 230 Q256 248 282 230" stroke="#9a3412" stroke-width="6" fill="none" stroke-linecap="round"/>
  <text x="256" y="470" text-anchor="middle" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="#fafafa">${initial}</text>
</svg>`
  fs.writeFileSync(path.join(dir, `${id}.svg`), svg)
}

console.log(`wrote ${avatars.length} avatars`)
