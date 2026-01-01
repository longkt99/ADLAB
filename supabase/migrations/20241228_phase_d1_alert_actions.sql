-- ============================================
-- Phase D1: Alert Actions Layer Migration
-- ============================================
-- Adds columns for alert state management:
-- - resolved_at: Timestamp when alert was resolved
-- - note: Internal operator notes
--
-- NOTE: read_at already exists in the alerts table
-- ============================================

-- Add resolved_at column (nullable, no default)
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;

-- Add note column (nullable text field)
ALTER TABLE alerts
ADD COLUMN IF NOT EXISTS note TEXT NULL;

-- Add index for filtering resolved alerts
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at ON alerts (resolved_at)
WHERE resolved_at IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN alerts.resolved_at IS 'Timestamp when alert was marked as resolved by operator';
COMMENT ON COLUMN alerts.note IS 'Internal operator notes for alert context';
