-- ============================================
-- UTM Tracking Schema Migration
-- ============================================
-- Marketing Laboratory v2.0: UTM Builder + Library + Analytics
--
-- SAFETY: All statements are idempotent (IF NOT EXISTS)
-- ============================================

-- ============================================
-- 1. UTM_LINKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS utm_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT,
  base_url TEXT NOT NULL,
  utm_source TEXT NOT NULL,
  utm_medium TEXT NOT NULL,
  utm_campaign TEXT NOT NULL,
  utm_content TEXT,
  utm_term TEXT,
  final_url TEXT NOT NULL,
  short_url TEXT,
  qr_url TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for utm_links
CREATE INDEX IF NOT EXISTS idx_utm_links_workspace_id ON utm_links(workspace_id);
CREATE INDEX IF NOT EXISTS idx_utm_links_created_at ON utm_links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_utm_links_source_medium_campaign ON utm_links(utm_source, utm_medium, utm_campaign);

-- RLS for utm_links (permissive for internal use)
ALTER TABLE utm_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utm_links_select_all" ON utm_links;
CREATE POLICY "utm_links_select_all" ON utm_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "utm_links_insert_all" ON utm_links;
CREATE POLICY "utm_links_insert_all" ON utm_links FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "utm_links_update_all" ON utm_links;
CREATE POLICY "utm_links_update_all" ON utm_links FOR UPDATE USING (true);

DROP POLICY IF EXISTS "utm_links_delete_all" ON utm_links;
CREATE POLICY "utm_links_delete_all" ON utm_links FOR DELETE USING (true);

-- ============================================
-- 2. UTM_TEMPLATES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS utm_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('facebook', 'google', 'tiktok', 'email', 'linkedin', 'other')),
  defaults JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for utm_templates
CREATE INDEX IF NOT EXISTS idx_utm_templates_workspace_id ON utm_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_utm_templates_platform ON utm_templates(platform);

-- RLS for utm_templates
ALTER TABLE utm_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utm_templates_select_all" ON utm_templates;
CREATE POLICY "utm_templates_select_all" ON utm_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "utm_templates_insert_all" ON utm_templates;
CREATE POLICY "utm_templates_insert_all" ON utm_templates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "utm_templates_update_all" ON utm_templates;
CREATE POLICY "utm_templates_update_all" ON utm_templates FOR UPDATE USING (true);

DROP POLICY IF EXISTS "utm_templates_delete_all" ON utm_templates;
CREATE POLICY "utm_templates_delete_all" ON utm_templates FOR DELETE USING (true);

-- ============================================
-- 3. UTM_ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS utm_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utm_link_id UUID NOT NULL REFERENCES utm_links(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(utm_link_id, day)
);

-- Indexes for utm_analytics
CREATE INDEX IF NOT EXISTS idx_utm_analytics_link_id ON utm_analytics(utm_link_id);
CREATE INDEX IF NOT EXISTS idx_utm_analytics_day ON utm_analytics(day DESC);

-- RLS for utm_analytics
ALTER TABLE utm_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utm_analytics_select_all" ON utm_analytics;
CREATE POLICY "utm_analytics_select_all" ON utm_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "utm_analytics_insert_all" ON utm_analytics;
CREATE POLICY "utm_analytics_insert_all" ON utm_analytics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "utm_analytics_update_all" ON utm_analytics;
CREATE POLICY "utm_analytics_update_all" ON utm_analytics FOR UPDATE USING (true);

DROP POLICY IF EXISTS "utm_analytics_delete_all" ON utm_analytics;
CREATE POLICY "utm_analytics_delete_all" ON utm_analytics FOR DELETE USING (true);

-- ============================================
-- 4. DATA_UPLOADS TABLE (stub for later ingestion)
-- ============================================

CREATE TABLE IF NOT EXISTS data_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'google', 'tiktok', 'meta', 'linkedin')),
  filename TEXT,
  file_size INTEGER,
  row_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'seeded')),
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Indexes for data_uploads
CREATE INDEX IF NOT EXISTS idx_data_uploads_workspace_id ON data_uploads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_data_uploads_status ON data_uploads(status);
CREATE INDEX IF NOT EXISTS idx_data_uploads_created_at ON data_uploads(created_at DESC);

-- RLS for data_uploads
ALTER TABLE data_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_uploads_select_all" ON data_uploads;
CREATE POLICY "data_uploads_select_all" ON data_uploads FOR SELECT USING (true);

DROP POLICY IF EXISTS "data_uploads_insert_all" ON data_uploads;
CREATE POLICY "data_uploads_insert_all" ON data_uploads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "data_uploads_update_all" ON data_uploads;
CREATE POLICY "data_uploads_update_all" ON data_uploads FOR UPDATE USING (true);

DROP POLICY IF EXISTS "data_uploads_delete_all" ON data_uploads;
CREATE POLICY "data_uploads_delete_all" ON data_uploads FOR DELETE USING (true);

-- ============================================
-- Updated At Triggers
-- ============================================

-- Trigger function (if not exists from other migrations)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for utm_links
DROP TRIGGER IF EXISTS update_utm_links_updated_at ON utm_links;
CREATE TRIGGER update_utm_links_updated_at
  BEFORE UPDATE ON utm_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for utm_templates
DROP TRIGGER IF EXISTS update_utm_templates_updated_at ON utm_templates;
CREATE TRIGGER update_utm_templates_updated_at
  BEFORE UPDATE ON utm_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Verification
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'UTM Tracking Schema Migration Complete';
  RAISE NOTICE '- utm_links table created';
  RAISE NOTICE '- utm_templates table created';
  RAISE NOTICE '- utm_analytics table created';
  RAISE NOTICE '- data_uploads table created';
  RAISE NOTICE '============================================';
END $$;
