-- ============================================
-- Migration 017: AdLab Ingestion Logs
-- ============================================
-- Marketing Laboratory v2.0: Ingestion Tracking
--
-- Creates the adlab_ingestion_logs table for tracking
-- data ingestion status and freshness monitoring.
--
-- Required by: lib/adlab/ops/freshnessStatus.ts
-- ============================================

-- ============================================
-- 1. ADLAB_INGESTION_LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS adlab_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  dataset TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'pass', 'warn', 'fail')),
  row_count INTEGER NULL DEFAULT 0,
  error_message TEXT NULL,
  promoted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_workspace_id
  ON adlab_ingestion_logs(workspace_id);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_client_id
  ON adlab_ingestion_logs(client_id);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_platform
  ON adlab_ingestion_logs(platform);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_dataset
  ON adlab_ingestion_logs(dataset);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_status
  ON adlab_ingestion_logs(status);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_created_at
  ON adlab_ingestion_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_promoted_at
  ON adlab_ingestion_logs(promoted_at DESC)
  WHERE promoted_at IS NOT NULL;

-- Composite index for freshness lookups
CREATE INDEX IF NOT EXISTS idx_adlab_ingestion_logs_freshness
  ON adlab_ingestion_logs(workspace_id, platform, dataset, status);

-- ============================================
-- 3. RLS POLICIES
-- ============================================

ALTER TABLE adlab_ingestion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adlab_ingestion_logs_select_all" ON adlab_ingestion_logs;
CREATE POLICY "adlab_ingestion_logs_select_all" ON adlab_ingestion_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "adlab_ingestion_logs_insert_all" ON adlab_ingestion_logs;
CREATE POLICY "adlab_ingestion_logs_insert_all" ON adlab_ingestion_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "adlab_ingestion_logs_update_all" ON adlab_ingestion_logs;
CREATE POLICY "adlab_ingestion_logs_update_all" ON adlab_ingestion_logs
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "adlab_ingestion_logs_delete_all" ON adlab_ingestion_logs;
CREATE POLICY "adlab_ingestion_logs_delete_all" ON adlab_ingestion_logs
  FOR DELETE USING (true);

-- ============================================
-- 4. UPDATED_AT TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS update_adlab_ingestion_logs_updated_at ON adlab_ingestion_logs;
CREATE TRIGGER update_adlab_ingestion_logs_updated_at
  BEFORE UPDATE ON adlab_ingestion_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE adlab_ingestion_logs IS 'Tracks data ingestion history for freshness monitoring';
COMMENT ON COLUMN adlab_ingestion_logs.dataset IS 'Dataset type: daily_metrics, ads, ad_sets, campaigns, etc.';
COMMENT ON COLUMN adlab_ingestion_logs.status IS 'Ingestion status: pending, processing, pass, warn, fail';
COMMENT ON COLUMN adlab_ingestion_logs.promoted_at IS 'Timestamp when data was promoted to production tables';

-- ============================================
-- 6. VERIFICATION
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'adlab_ingestion_logs'
  ) THEN
    RAISE NOTICE 'OK: adlab_ingestion_logs table created';
  ELSE
    RAISE WARNING 'FAIL: adlab_ingestion_logs table not created';
  END IF;
END $$;
