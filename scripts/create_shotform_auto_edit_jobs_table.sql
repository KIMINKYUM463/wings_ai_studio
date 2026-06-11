-- AI 짜집기 비동기 작업 상태 (Vercel 서버리스 — 인스턴스 간 공유)
CREATE TABLE IF NOT EXISTS shotform_auto_edit_jobs (
  job_id TEXT PRIMARY KEY,
  step TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_storage_path TEXT,
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shotform_auto_edit_jobs_created_at
  ON shotform_auto_edit_jobs(created_at DESC);

CREATE OR REPLACE FUNCTION update_shotform_auto_edit_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shotform_auto_edit_jobs_updated_at ON shotform_auto_edit_jobs;
CREATE TRIGGER trigger_update_shotform_auto_edit_jobs_updated_at
  BEFORE UPDATE ON shotform_auto_edit_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_shotform_auto_edit_jobs_updated_at();

ALTER TABLE shotform_auto_edit_jobs DISABLE ROW LEVEL SECURITY;

GRANT ALL ON shotform_auto_edit_jobs TO anon, authenticated, service_role;
