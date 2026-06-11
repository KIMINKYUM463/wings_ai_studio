-- My 링크(쇼핑 링크) 공개 페이지 저장
CREATE TABLE IF NOT EXISTS shotform_shopping_link_pages (
  slug TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shotform_shopping_link_pages_updated_at
  ON shotform_shopping_link_pages(updated_at DESC);

CREATE OR REPLACE FUNCTION update_shotform_shopping_link_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shotform_shopping_link_pages_updated_at ON shotform_shopping_link_pages;
CREATE TRIGGER trigger_update_shotform_shopping_link_pages_updated_at
  BEFORE UPDATE ON shotform_shopping_link_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_shotform_shopping_link_pages_updated_at();

ALTER TABLE shotform_shopping_link_pages DISABLE ROW LEVEL SECURITY;

GRANT ALL ON shotform_shopping_link_pages TO anon, authenticated, service_role;
