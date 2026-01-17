"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Home, Edit, Loader2 } from "lucide-react"
import Link from "next/link"

export default function AIEditorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/WingsAIStudioShotForm">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                뒤로가기
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                AI 편집 프로그램
              </h1>
              <p className="text-muted-foreground mt-1">AI로 자동 편집하는 영상 편집 프로그램</p>
            </div>
          </div>
          <Link href="/WingsAIStudioShotForm">
            <Button variant="ghost" size="sm">
              <Home className="w-4 h-4 mr-2" />
              홈
            </Button>
          </Link>
        </div>

        {/* 메인 컨텐츠 */}
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border-b-2 border-purple-100">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent flex items-center gap-2">
              <Edit className="w-6 h-6 text-purple-600" />
              AI 편집 프로그램
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-6">
                <Edit className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">준비 중입니다</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                AI 편집 프로그램 기능은 현재 개발 중입니다. 곧 만나보실 수 있습니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


