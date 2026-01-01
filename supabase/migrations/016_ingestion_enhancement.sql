-- ============================================
-- Migration 016: Ingestion Enhancement
-- ============================================
-- Marketing Laboratory v2.0: Enhanced Data Uploads
--
-- Adds columns for full ingestion lifecycle:
-- - storage_path: File location in storage bucket
-- - error_log: Detailed error tracking (JSONB)
-- - summary: Processing summary and stats (JSONB)
-- - client_id: Optional link to specific client
-- ============================================

-- Add new columns to data_uploads table
ALTER TABLE data_uploads
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS error_log JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS summary JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add index for client_id
CREATE INDEX IF NOT EXISTS idx_data_uploads_client_id ON data_uploads(client_id);

-- Add index for status + created_at for efficient listing
CREATE INDEX IF NOT EXISTS idx_data_uploads_status_created ON data_uploads(status, created_at DESC);

-- ============================================
-- Storage Bucket Configuration
-- ============================================
-- Note: The actual bucket creation happens in Supabase dashboard or via
-- a separate storage configuration. This just documents the expected structure.
--
-- Bucket: adlab-uploads
-- Structure:
--   /{workspace_id}/{platform}/{timestamp}-{filename}
--
-- Example:
--   /abc123/facebook/2024-01-15T10-30-00-ads-export.csv
-- ============================================

-- ============================================
-- Update status enum to include 'retrying'
-- ============================================
-- We need to add 'retrying' as a valid status for retry functionality

-- First, drop the existing constraint
ALTER TABLE data_uploads DROP CONSTRAINT IF EXISTS data_uploads_status_check;

-- Add the new constraint with 'retrying' status
ALTER TABLE data_uploads ADD CONSTRAINT data_uploads_status_check
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'seeded', 'retrying'));

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON COLUMN data_uploads.storage_path IS 'Path to uploaded file in storage bucket (e.g., /workspace-id/facebook/timestamp-filename.csv)';
COMMENT ON COLUMN data_uploads.error_log IS 'Array of error objects: [{row: number, field: string, message: string, value: any}]';
COMMENT ON COLUMN data_uploads.summary IS 'Processing summary: {rows_processed: number, rows_imported: number, rows_skipped: number, duration_ms: number}';
COMMENT ON COLUMN data_uploads.client_id IS 'Optional client scope - if null, upload applies to entire workspace';
