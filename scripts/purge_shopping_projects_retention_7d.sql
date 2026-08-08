-- shopping_projects: 생성일(created_at) 기준 7일 지난 행 자동 삭제
-- Supabase SQL Editor에서 실행하세요.

CREATE OR REPLACE FUNCTION purge_shopping_projects_older_than_7_days()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM shopping_projects
  WHERE created_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 지금 바로 한 번 실행
SELECT purge_shopping_projects_older_than_7_days() AS deleted_rows;

-- pg_cron 확장이 켜져 있으면 매일 새벽 4시(UTC) 자동 실행 예시:
-- SELECT cron.schedule(
--   'purge-shopping-projects-daily',
--   '0 4 * * *',
--   $$SELECT purge_shopping_projects_older_than_7_days()$$
-- );
