"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function AIVoiceStudioPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker")}
            className="mb-4"
          >
            ← 메인으로
          </Button>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">AI 보이스 스튜디오</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">AI 보이스 스튜디오 기능이 곧 제공될 예정입니다.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}


import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export default function AIVoiceStudioPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/youmaker")}
            className="mb-4"
          >
            ← 메인으로
          </Button>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">AI 보이스 스튜디오</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600">AI 보이스 스튜디오 기능이 곧 제공될 예정입니다.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

