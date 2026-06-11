import { redirect } from "next/navigation"

/** @deprecated `/shortform-studio` 로 이동 */
export default function LegacyMvpTestRedirect() {
  redirect("/WingsAIStudioShotForm/shortform-studio")
}
