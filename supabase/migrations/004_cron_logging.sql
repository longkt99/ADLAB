-- Migration 004: Add cron logging and error tracking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Add published_error column to variants
-- ============================================

-- Add column to store platform API errors
ALTER TABLE variants
ADD COLUMN IF NOT EXISTS published_error TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN variants.published_error IS 'Stores error message if publishing to platform API fails';

-- ============================================
-- 2. Create cron_logs table
-- ============================================

CREATE TABLE IF NOT EXISTS cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  variants_found INTEGER NOT NULL DEFAULT 0,
  variants_published INTEGER NOT NULL DEFAULT 0,
  variants_failed INTEGER NOT NULL DEFAULT 0,
  errors JSONB NULL,
  duration_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for efficient querying of recent logs
CREATE INDEX IF NOT EXISTS cron_logs_run_at_idx ON cron_logs(run_at DESC);

-- Add comment
COMMENT ON TABLE cron_logs IS 'Logs for scheduled publish cron job runs - tracks success/failure rates';

-- ============================================
-- 3. Enable RLS for cron_logs
-- ============================================

ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since this is an admin/system table)
CREATE POLICY "cron_logs_select_all" ON cron_logs FOR SELECT USING (true);
CREATE POLICY "cron_logs_insert_all" ON cron_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "cron_logs_update_all" ON cron_logs FOR UPDATE USING (true);
CREATE POLICY "cron_logs_delete_all" ON cron_logs FOR DELETE USING (true);

-- ============================================
-- 4. Verification
-- ============================================

-- Verify variants table has new column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'variants' AND column_name = 'published_error';

-- Verify cron_logs table exists
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'cron_logs';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 004 completed successfully';
  RAISE NOTICE '   - Added variants.published_error column';
  RAISE NOTICE '   - Created cron_logs table';
  RAISE NOTICE '   - Set up RLS policies';
END $$;
