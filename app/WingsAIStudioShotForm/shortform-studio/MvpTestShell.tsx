"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Lock } from "lucide-react"
import { ShotFormTrendResearchShell } from "../components/ShotFormTrendResearchShell"
import { MvpProjectManager } from "./MvpProjectManager"

const SHORTFORM_STUDIO_AUTH_KEY = "wingsaistudio_shortform_studio_password_auth"
const SHORTFORM_STUDIO_PASSWORD = "9999"

export function MvpTestShell() {
  const router = useRouter()
  const [projectListKey, setProjectListKey] = useState(0)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")

  useEffect(() => {
    const passwordAuth = sessionStorage.getItem(SHORTFORM_STUDIO_AUTH_KEY)
    if (passwordAuth === "true") {
      setIsAuthenticated(true)
    } else {
      setShowPasswordDialog(true)
    }
    setIsCheckingAuth(false)
  }, [])

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setPasswordError("")

    if (password === SHORTFORM_STUDIO_PASSWORD) {
      sessionStorage.setItem(SHORTFORM_STUDIO_AUTH_KEY, "true")
      setIsAuthenticated(true)
      setShowPasswordDialog(false)
      setPassword("")
      return
    }

    setPasswordError("비밀번호가 올바르지 않습니다.")
    setPassword("")
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-fuchsia-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mb-4" />
          <p className="text-slate-600">인증 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          if (!open) {
            router.push("/WingsAIStudioShotForm")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              숏폼 스튜디오 접근 인증
            </DialogTitle>
            <DialogDescription>
              숏폼 스튜디오에 접근하려면 비밀번호를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="shortform-studio-password">비밀번호</Label>
                <Input
                  id="shortform-studio-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setPasswordError("")
                  }}
                  placeholder="비밀번호를 입력하세요"
                  autoFocus
                  className={passwordError ? "border-red-500" : ""}
                />
                {passwordError && (
                  <p className="text-sm text-red-500">{passwordError}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/WingsAIStudioShotForm")}
              >
                취소
              </Button>
              <Button type="submit">확인</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <ShotFormTrendResearchShell
      activeRoute="shortform-studio"
      hideSidebar
      appTitle="Wings AI ShotForm"
      logoHref="/WingsAIStudioShotForm/shortform-studio"
      onLogoClick={() => setProjectListKey((k) => k + 1)}
      onProjectListClick={() => setProjectListKey((k) => k + 1)}
    >
      <MvpProjectManager key={projectListKey} />
    </ShotFormTrendResearchShell>
  )
}
