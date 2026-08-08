import { redirect } from "next/navigation"

/**
 * 급상승·성과 리포트 등 허브 탭은 일시 숨김.
 * 클라이언트에서 replace 하면 한 프레임 trending이 보이므로 서버에서 바로 진단으로 보냄.
 * (탭 복구 시 이 파일을 다시 허브 UI로 되돌리면 됨)
 */
export default function ChannelBenchmarkPage() {
  redirect("/WingsAIStudioShotForm/channel-analysis/deep-dive")
}
