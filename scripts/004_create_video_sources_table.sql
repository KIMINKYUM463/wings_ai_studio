-- 영상 소스 모음집 테이블 설계
-- products 테이블: 제품 폴더 (Storage 폴더와 storage_folder로 연결)

-- products 테이블 생성 (id는 UUID 유지)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coupang_url TEXT,
  benchmark_video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- storage_folder 컬럼 추가 (Storage 폴더명 저장용)
-- 기존 테이블에 컬럼이 없으면 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'storage_folder'
  ) THEN
    ALTER TABLE products ADD COLUMN storage_folder TEXT UNIQUE;
  END IF;
END $$;

-- RLS 정책 (모든 사용자가 읽기/쓰기 가능)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_all" ON products;
CREATE POLICY "products_select_all" ON products
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "products_insert_all" ON products;
CREATE POLICY "products_insert_all" ON products
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "products_update_all" ON products;
CREATE POLICY "products_update_all" ON products
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "products_delete_all" ON products;
CREATE POLICY "products_delete_all" ON products
  FOR DELETE USING (true);

-- Supabase Storage 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-sources', 'video-sources', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책: 모든 사용자가 읽기 가능
DROP POLICY IF EXISTS "video_sources_bucket_select" ON storage.objects;
CREATE POLICY "video_sources_bucket_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-sources');

-- Storage 정책: 모든 사용자가 업로드 가능
DROP POLICY IF EXISTS "video_sources_bucket_insert" ON storage.objects;
CREATE POLICY "video_sources_bucket_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'video-sources');

-- Storage 정책: 모든 사용자가 삭제 가능
DROP POLICY IF EXISTS "video_sources_bucket_delete" ON storage.objects;
CREATE POLICY "video_sources_bucket_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'video-sources');

-- 샘플 데이터 추가 (storage_folder = "1"로 설정)
INSERT INTO products (name, storage_folder, coupang_url, benchmark_video_url)
VALUES (
  '샘플 제품 1',
  '1',
  'https://www.coupang.com/vp/products/example-1',
  'https://www.youtube.com/watch?v=example-1'
) ON CONFLICT (storage_folder) DO NOTHING;

-- 사용 방법:
-- 1. Supabase 대시보드 → Table Editor → products 테이블에 제품 추가
-- 2. storage_folder 컬럼에 폴더명 입력 (예: "1", "2", "product-001")
-- 3. Supabase Storage → video-sources 버킷에 같은 이름의 폴더 생성
-- 4. 폴더 안에 영상 파일 업로드
-- 5. 영상 소스 모음집 페이지에서 자동으로 표시됨
