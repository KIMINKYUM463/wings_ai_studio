"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Home, ArrowLeft, Plus, Upload, Trash2, Folder, FolderOpen } from "lucide-react"
import Link from "next/link"
import { getProducts, addProduct, deleteProduct, getMaxFolderNumber, getVideosByProduct } from "../actions"
import { createClient } from "@/lib/supabase/client"

interface Product {
  id: number
  name: string
  storage_folder: string | null
  coupang_url: string | null
  benchmark_video_url: string | null
  created_at: string
}

interface Video {
  id: string
  name: string
  title: string
  video_url: string
  created_at: string
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [videos, setVideos] = useState<Video[]>([])

  // 제품 추가 폼
  const [newProductName, setNewProductName] = useState("")
  const [coupangUrl, setCoupangUrl] = useState("")
  const [benchmarkUrl, setBenchmarkUrl] = useState("")

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>("")

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const result = await getProducts()
      setProducts(result)
    } catch (error) {
      console.error("제품 목록 로드 실패:", error)
      alert("제품 목록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const loadVideos = async (product: Product) => {
    if (!product.storage_folder) return

    setIsLoading(true)
    try {
      const result = await getVideosByProduct(product.storage_folder)
      setVideos(result)
    } catch (error) {
      console.error("영상 목록 로드 실패:", error)
      alert("영상 목록을 불러오는데 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddProduct = async () => {
    if (!newProductName) {
      alert("제품명은 필수입니다.")
      return
    }

    setIsLoading(true)
    try {
      // 최대 폴더 번호 가져오기
      const maxNumber = await getMaxFolderNumber()
      const newFolderNumber = (maxNumber + 1).toString()

      await addProduct({
        name: newProductName,
        storage_folder: newFolderNumber,
        coupang_url: coupangUrl || undefined,
        benchmark_video_url: benchmarkUrl || undefined,
      })

      alert(`제품이 추가되었습니다. (폴더 번호: ${newFolderNumber})`)
      setNewProductName("")
      setCoupangUrl("")
      setBenchmarkUrl("")

      await loadProducts()
    } catch (error) {
      console.error("제품 추가 실패:", error)
      alert("제품 추가에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("정말 이 제품을 삭제하시겠습니까?")) {
      return
    }

    setIsLoading(true)
    try {
      await deleteProduct(id.toString())
      alert("제품이 삭제되었습니다.")
      if (selectedProduct?.id === id) {
        setSelectedProduct(null)
        setVideos([])
      }
      await loadProducts()
    } catch (error) {
      console.error("제품 삭제 실패:", error)
      alert("제품 삭제에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectProduct = async (product: Product) => {
    setSelectedProduct(product)
    await loadVideos(product)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (!selectedProduct || !selectedProduct.storage_folder) {
      alert("제품을 먼저 선택해주세요.")
      return
    }

    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("video/"))

    if (files.length === 0) {
      alert("영상 파일만 업로드할 수 있습니다.")
      return
    }

    await handleUploadFiles(files)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedProduct || !selectedProduct.storage_folder) {
      alert("제품을 먼저 선택해주세요.")
      return
    }

    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      await handleUploadFiles(files)
    }
  }

  const handleUploadFiles = async (files: File[]) => {
    if (!selectedProduct || !selectedProduct.storage_folder) return

    setIsLoading(true)
    setUploadProgress(`${files.length}개 파일 업로드 중...`)

    const supabase = createClient()
    const results = {
      success: [] as Array<{ name: string; path: string }>,
      errors: [] as Array<{ name: string; error: string }>,
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        try {
          console.log(`[v0] 업로드 시작 (${i + 1}/${files.length}):`, file.name)
          setUploadProgress(`${i + 1}/${files.length} 업로드 중... (${file.name})`)

          const timestamp = Date.now()
          const fileName = `${timestamp}_${file.name}`
          const filePath = `${selectedProduct.storage_folder}/${fileName}`

          const { data, error } = await supabase.storage.from("video-sources").upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          })

          if (error) {
            console.error("[v0] 업로드 실패:", file.name, error)
            results.errors.push({ name: file.name, error: error.message })
          } else {
            console.log("[v0] 업로드 성공:", file.name)
            results.success.push({ name: file.name, path: data.path })
          }
        } catch (error: any) {
          console.error("[v0] 업로드 중 오류:", file.name, error)
          results.errors.push({ name: file.name, error: error.message || String(error) })
        }
      }

      console.log("[v0] 업로드 완료 - 성공:", results.success.length, "실패:", results.errors.length)

      if (results.errors.length > 0) {
        const failedFiles = results.errors.map((e) => e.name).join(", ")
        alert(
          `${results.success.length}개 영상이 업로드되었습니다.\n실패: ${results.errors.length}개 (${failedFiles})\n\n실패한 파일은 다시 시도해주세요.`,
        )
      } else {
        alert(`${results.success.length}개 영상이 성공적으로 업로드되었습니다.`)
      }

      setUploadProgress("")

      // 영상 목록 새로고침
      await loadVideos(selectedProduct)
    } catch (error) {
      console.error("[v0] 영상 업로드 실패:", error)
      alert(`영상 업로드에 실패했습니다.\n오류: ${error instanceof Error ? error.message : String(error)}`)
      setUploadProgress("")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteVideo = async (video: Video) => {
    if (!confirm(`"${video.title}" 영상을 삭제하시겠습니까?`)) {
      return
    }

    if (!selectedProduct || !selectedProduct.storage_folder) return

    setIsLoading(true)
    try {
      const supabase = createClient()

      // Storage에서 파일 경로 추출
      const filePath = `${selectedProduct.storage_folder}/${video.name}`

      console.log("[v0] 영상 삭제 시작:", filePath)

      const { error } = await supabase.storage.from("video-sources").remove([filePath])

      if (error) {
        console.error("[v0] 영상 삭제 실패:", error)
        alert(`영상 삭제에 실패했습니다.\n오류: ${error.message}`)
      } else {
        console.log("[v0] 영상 삭제 성공:", filePath)
        alert("영상이 삭제되었습니다.")

        // 영상 목록 새로고침
        await loadVideos(selectedProduct)
      }
    } catch (error) {
      console.error("[v0] 영상 삭제 중 오류:", error)
      alert(`영상 삭제 중 오류가 발생했습니다.\n오류: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (selectedProduct) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                목록으로
              </Button>
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {selectedProduct.name} (폴더: {selectedProduct.storage_folder})
            </h1>
            <div className="w-32" />
          </div>

          {/* 드래그 앤 드롭 영역 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                영상 업로드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/10" : "border-muted-foreground/25"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold mb-2">영상 파일을 여기에 드래그하세요</p>
                <p className="text-sm text-muted-foreground mb-4">또는</p>
                <label htmlFor="file-upload">
                  <Button variant="outline" asChild>
                    <span>파일 선택</span>
                  </Button>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept="video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              {uploadProgress && <p className="text-sm text-primary mt-4 text-center">{uploadProgress}</p>}
            </CardContent>
          </Card>

          {/* 영상 목록 */}
          <Card>
            <CardHeader>
              <CardTitle>업로드된 영상 ({videos.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {videos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>아직 업로드된 영상이 없습니다.</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map((video) => (
                    <Card key={video.id}>
                      <CardContent className="p-4">
                        <div className="relative">
                          <video src={video.video_url} controls className="w-full rounded-lg mb-2" />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={() => handleDeleteVideo(video)}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm font-medium truncate">{video.title}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/WingsAIStudio">
              <Button variant="outline" size="icon">
                <Home className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/video-sources">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                뒤로가기
              </Button>
            </Link>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            관리자 페이지
          </h1>
          <div className="w-32" />
        </div>

        {/* 제품 추가 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />새 제품 폴더 추가
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="product-name">제품명 *</Label>
              <Input
                id="product-name"
                placeholder="예: 다이슨 청소기"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">폴더 번호는 자동으로 할당됩니다 (현재 최대 번호 + 1)</p>
            </div>

            <div>
              <Label htmlFor="coupang-url">쿠팡 제품 URL (선택)</Label>
              <Input
                id="coupang-url"
                placeholder="https://www.coupang.com/..."
                value={coupangUrl}
                onChange={(e) => setCoupangUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="benchmark-url">벤치마킹 영상 URL (선택)</Label>
              <Input
                id="benchmark-url"
                placeholder="https://www.youtube.com/..."
                value={benchmarkUrl}
                onChange={(e) => setBenchmarkUrl(e.target.value)}
              />
            </div>

            <Button onClick={handleAddProduct} disabled={isLoading} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              제품 폴더 추가
            </Button>
          </CardContent>
        </Card>

        {/* 제품 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>제품 폴더 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>아직 추가된 제품이 없습니다.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => handleSelectProduct(product)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <FolderOpen className="w-8 h-8 text-primary" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProduct(product.id)
                          }}
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">폴더 번호: {product.storage_folder}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
