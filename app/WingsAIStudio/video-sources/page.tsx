"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Folder, Download, ExternalLink, Home, ArrowLeft, Video, Search, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getProducts, getVideosByProduct, ensureDefaultProducts } from "./actions"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Product {
  id: number
  name: string
  storage_folder: string | null
  coupang_url: string | null
  benchmark_video_url: string | null
  created_at: string
}

interface VideoFile {
  id: string
  name: string
  title: string
  video_url: string
  created_at: string
}

export default function VideoSourcesPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [videos, setVideos] = useState<VideoFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState("")
  const [rightClickCount, setRightClickCount] = useState(0)
  const [rightClickTimer, setRightClickTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      setRightClickCount((prev) => prev + 1)

      if (rightClickTimer) {
        clearTimeout(rightClickTimer)
      }

      const timer = setTimeout(() => {
        setRightClickCount(0)
      }, 500)

      setRightClickTimer(timer)
    }

    document.addEventListener("contextmenu", handleContextMenu)

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu)
      if (rightClickTimer) {
        clearTimeout(rightClickTimer)
      }
    }
  }, [rightClickTimer])

  useEffect(() => {
    if (rightClickCount >= 2) {
      setShowPasswordDialog(true)
      setRightClickCount(0)
    }
  }, [rightClickCount])

  const handlePasswordSubmit = () => {
    if (password === "7777") {
      router.push("/video-sources/admin")
    } else {
      alert("비밀번호가 올바르지 않습니다.")
      setPassword("")
    }
  }

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      console.log("[v0] loadProducts 시작")
      await ensureDefaultProducts()
      const result = await getProducts()
      console.log("[v0] loadProducts 결과:", result)
      setProducts(result)
    } catch (error) {
      console.error("제품 목록 로드 실패:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProduct = async (product: Product) => {
    if (!product.storage_folder) {
      alert("이 제품은 Storage 폴더가 설정되지 않았습니다. Supabase에서 storage_folder 값을 설정해주세요.")
      return
    }

    setSelectedProduct(product)
    setIsLoading(true)
    try {
      console.log("[v0] handleSelectProduct 시작, product:", product)
      const result = await getVideosByProduct(product.storage_folder)
      console.log("[v0] handleSelectProduct 결과:", result)
      setVideos(result)
    } catch (error) {
      console.error("영상 목록 로드 실패:", error)
      setVideos([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadVideo = async (video: VideoFile) => {
    try {
      const response = await fetch(video.video_url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = video.name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("다운로드 실패:", error)
      alert("영상 다운로드에 실패했습니다. URL을 직접 열어주세요.")
      window.open(video.video_url, "_blank")
    }
  }

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase()
    return (
      product.name.toLowerCase().includes(query) || (product.storage_folder?.toLowerCase().includes(query) ?? false)
    )
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>관리자 인증</DialogTitle>
            <DialogDescription>관리자 페이지에 접근하려면 비밀번호를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit()
                }
              }}
            />
            <div className="flex gap-2">
              <Button onClick={handlePasswordSubmit} className="flex-1">
                확인
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordDialog(false)
                  setPassword("")
                }}
                className="flex-1"
              >
                취소
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/WingsAIStudio">
              <Button variant="outline" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/WingsAIStudio">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로가기
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            영상 소스 모음집
          </h1>
          <div className="w-32" />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 제품 폴더 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>제품 폴더</CardTitle>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="제품명 또는 폴더명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Folder className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  {searchQuery ? (
                    <p>검색 결과가 없습니다.</p>
                  ) : (
                    <>
                      <p>아직 추가된 제품이 없습니다.</p>
                      <p className="text-sm mt-2">Supabase의 products 테이블에 제품을 추가해주세요.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        !product.storage_folder
                          ? "opacity-50 cursor-not-allowed"
                          : `cursor-pointer hover:bg-muted/50 ${
                              selectedProduct?.id === product.id ? "bg-muted border-primary" : ""
                            }`
                      }`}
                      onClick={() => product.storage_folder && handleSelectProduct(product)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Folder className="w-5 h-5 text-primary" />
                          <div>
                            <h3 className="font-semibold">{product.name}</h3>
                            {!product.storage_folder && (
                              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                                <AlertCircle className="w-3 h-3" />
                                Storage 폴더 미설정
                              </p>
                            )}
                          </div>
                        </div>
                        {product.coupang_url && (
                          <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}>
                            <a href={product.coupang_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 선택된 제품의 상세 정보 및 영상 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedProduct ? `${selectedProduct.name}` : "제품 정보"}</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedProduct ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>제품을 선택하면 영상이 표시됩니다.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {(selectedProduct.coupang_url || selectedProduct.benchmark_video_url) && (
                    <div className="space-y-3 pb-4 border-b">
                      {selectedProduct.coupang_url && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">쿠팡 제품 URL</label>
                          <Button variant="outline" size="sm" asChild className="w-full mt-1 bg-transparent">
                            <a href={selectedProduct.coupang_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              쿠팡에서 보기
                            </a>
                          </Button>
                        </div>
                      )}
                      {selectedProduct.benchmark_video_url && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">벤치마킹 영상 URL</label>
                          <Button variant="outline" size="sm" asChild className="w-full mt-1 bg-transparent">
                            <a href={selectedProduct.benchmark_video_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              벤치마킹 영상 보기
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-3">영상 목록</h3>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">로딩 중...</p>
                      </div>
                    ) : videos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">아직 추가된 영상이 없습니다.</p>
                        <p className="text-xs mt-1">
                          Supabase Storage의 video-sources/{selectedProduct?.storage_folder} 폴더에 영상을 업로드하세요.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {videos.map((video) => (
                          <Card key={video.id}>
                            <CardContent className="p-4 space-y-3">
                              <div>
                                <h4 className="font-medium line-clamp-1">{video.title}</h4>
                                <p className="text-xs text-muted-foreground">{video.name}</p>
                              </div>

                              <div className="rounded-lg overflow-hidden bg-black">
                                <video src={video.video_url} controls className="w-full" style={{ maxHeight: "300px" }}>
                                  브라우저가 비디오 태그를 지원하지 않습니다.
                                </video>
                              </div>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadVideo(video)}
                                className="w-full"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                다운로드
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
