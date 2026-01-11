"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Save, Lock, Loader2 } from "lucide-react"
import Link from "next/link"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [announcements, setAnnouncements] = useState<Array<{
    id: string
    title: string
    content: string
    image_url?: string
    link_url?: string
    created_at: string
    is_active: boolean
  }>>([])

  // 비밀번호 확인
  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    setPasswordError("")
    
    if (password === "7777") {
      setIsAuthenticated(true)
      setPassword("")
    } else {
      setPasswordError("비밀번호가 올바르지 않습니다.")
      setPassword("")
    }
  }

  // 기존 업데이트 사항 불러오기
  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const response = await fetch('/api/announcements/all')
        if (response.ok) {
          const data = await response.json()
          if (data.announcements) {
            setAnnouncements(data.announcements)
          }
        }
      } catch (error) {
        console.error("[Admin] 업데이트 사항 불러오기 실패:", error)
      }
    }
    
    loadAnnouncements()
  }, [])


  // 업데이트 사항 저장
  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해주세요.")
      return
    }

    setIsSaving(true)
    try {
      // 업데이트 사항 저장
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': '7777',
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          link_url: linkUrl.trim() || undefined,
          is_active: true,
        }),
      })

      if (response.ok) {
        alert("업데이트 사항이 저장되었습니다.")
        setTitle("")
        setContent("")
        setLinkUrl("")
        
        // 목록 새로고침
        const listResponse = await fetch('/api/announcements/all')
        if (listResponse.ok) {
          const listData = await listResponse.json()
          if (listData.announcements) {
            setAnnouncements(listData.announcements)
          }
        }
      } else {
        const errorData = await response.json()
        alert(`저장 실패: ${errorData.error || "알 수 없는 오류"}`)
      }
    } catch (error) {
      console.error("[Admin] 저장 실패:", error)
      alert("저장 중 오류가 발생했습니다.")
    } finally {
      setIsSaving(false)
    }
  }

  // 비밀번호 인증이 안 되어 있으면 인증 화면 표시
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              관리자 인증
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
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
              <Button type="submit" className="w-full">
                인증
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">관리자 페이지</h1>
            <p className="text-gray-600">롱폼 페이지 업데이트 사항을 관리합니다.</p>
          </div>
          <Link href="/WingsAIStudio/longform">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              돌아가기
            </Button>
          </Link>
        </div>

        {/* 작성 폼 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>새 업데이트 사항 작성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">제목</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="업데이트 제목을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">내용</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="업데이트 내용을 입력하세요"
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkUrl">링크 URL (선택사항)</Label>
              <Input
                id="linkUrl"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
              />
              <p className="text-xs text-gray-500">사용자가 클릭할 수 있는 링크를 입력하세요</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || !title.trim() || !content.trim()}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 기존 업데이트 사항 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>기존 업데이트 사항</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-gray-500 text-center py-8">등록된 업데이트 사항이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="p-4 border border-gray-200 rounded-lg bg-white"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{announcement.title}</h3>
                      <span className="text-xs text-gray-500">
                        {new Date(announcement.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap mb-2">
                      {announcement.content}
                    </p>
                    {announcement.link_url && (
                      <a
                        href={announcement.link_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 underline"
                      >
                        링크 열기
                        <ArrowLeft className="w-4 h-4 rotate-[-135deg]" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

