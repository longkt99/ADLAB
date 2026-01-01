-- ============================================
-- Migration 018: Daily Metrics Composite Indexes
-- ============================================
-- Adds composite indexes to improve query performance for
-- date-range queries commonly used in Overview and Metrics pages.
--
-- These support queries like:
--   WHERE workspace_id = X AND date >= Y AND date <= Z
--   WHERE client_id = X AND date >= Y AND date <= Z
-- ============================================

-- Composite index for workspace + date range queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_workspace_date
  ON daily_metrics(workspace_id, date DESC);

-- Composite index for client + date range queries
CREATE INDEX IF NOT EXISTS idx_daily_metrics_client_date
  ON daily_metrics(client_id, date DESC);

-- Verification
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_metrics'
      AND indexname = 'idx_daily_metrics_workspace_date'
  ) THEN
    RAISE NOTICE 'OK: idx_daily_metrics_workspace_date created';
  ELSE
    RAISE WARNING 'FAIL: idx_daily_metrics_workspace_date not created';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'daily_metrics'
      AND indexname = 'idx_daily_metrics_client_date'
  ) THEN
    RAISE NOTICE 'OK: idx_daily_metrics_client_date created';
  ELSE
    RAISE WARNING 'FAIL: idx_daily_metrics_client_date not created';
  END IF;
END $$;
