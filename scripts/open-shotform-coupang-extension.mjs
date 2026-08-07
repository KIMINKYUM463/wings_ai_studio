/**
 * Chrome 확장 폴더를 탐색기로 열고 설치 안내를 출력
 */
import { spawn } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extDir = path.join(__dirname, "..", "extensions", "shotform-coupang-collector")

if (process.platform === "win32") {
  spawn("explorer", [extDir], { detached: true, stdio: "ignore" }).unref()
} else if (process.platform === "darwin") {
  spawn("open", [extDir], { detached: true, stdio: "ignore" }).unref()
} else {
  spawn("xdg-open", [extDir], { detached: true, stdio: "ignore" }).unref()
}

console.log("")
console.log("[Wings 숏폼 쿠팡 수집기] 확장 폴더:")
console.log(" ", extDir)
console.log("")
console.log("설치:")
console.log("  1) Chrome 주소창 → chrome://extensions")
console.log("  2) 오른쪽 위 「개발자 모드」 ON")
console.log("  3) 「압축해제된 확장 프로그램을 로드합니다」")
console.log("  4) 위 폴더 선택")
console.log("")
console.log("사용:")
console.log("  1) npm run shotform:local-agent")
console.log("  2) 일반 Chrome에서 쿠팡 상품평이 보이게 열기")
console.log("  3) 확장 아이콘 → 「이 페이지 수집 & 전송」")
console.log("  4) ShotForm ver2 → 「전송된 리뷰 불러오기」")
console.log("")
