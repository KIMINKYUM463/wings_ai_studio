-- 오디오 라이브러리 Storage 정책 설정
-- video-sources 버킷의 bgm, sfx 폴더에 대한 읽기 권한 설정

-- 1. 버킷이 PUBLIC인지 확인 (이미 설정되어 있을 수 있음)
-- Supabase Dashboard > Storage > video-sources > Settings에서 확인

-- 2. Storage 정책: 모든 사용자가 video-sources 버킷의 파일 읽기 가능
DROP POLICY IF EXISTS "video_sources_bucket_select" ON storage.objects;
CREATE POLICY "video_sources_bucket_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-sources');

-- 3. Storage 정책: 모든 사용자가 video-sources 버킷에 파일 업로드 가능 (관리자용)
DROP POLICY IF EXISTS "video_sources_bucket_insert" ON storage.objects;
CREATE POLICY "video_sources_bucket_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'video-sources');

-- 4. Storage 정책: 모든 사용자가 video-sources 버킷의 파일 삭제 가능 (관리자용)
DROP POLICY IF EXISTS "video_sources_bucket_delete" ON storage.objects;
CREATE POLICY "video_sources_bucket_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'video-sources');

-- 참고: 
-- - 버킷이 PUBLIC으로 설정되어 있어도 Storage 정책이 필요합니다
-- - Supabase Dashboard > Storage > Policies에서 확인 가능
-- - 위 정책들은 모든 사용자(인증되지 않은 사용자 포함)가 접근 가능하도록 설정됨

