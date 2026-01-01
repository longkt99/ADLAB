-- ============================================
-- AdLab Audit Logs
-- ============================================
-- PHASE D19: Immutable audit logging for high-risk actions.
--
-- CORE PRINCIPLE:
-- If it can change production, it must leave a trail.
--
-- HARD CONSTRAINTS:
-- - NO edits/deletes to audit records
-- - NO client-side writes
-- - NO missing actor/context
-- - Append-only logs
-- - Server-side only
-- ============================================

-- Create audit logs table
CREATE TABLE IF NOT EXISTS adlab_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,                 -- PROMOTE | ROLLBACK | SNAPSHOT_ACTIVATE | SNAPSHOT_DEACTIVATE | VALIDATE | INGEST
  entity_type TEXT NOT NULL,            -- ingestion_log | snapshot | dataset
  entity_id UUID NOT NULL,
  scope JSONB NOT NULL,                 -- { platform, dataset, clientId? }
  reason TEXT,                          -- required for rollback
  metadata JSONB,                       -- snapshotId, ingestionLogId, counts, etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for workspace timeline queries (most common access pattern)
CREATE INDEX IF NOT EXISTS idx_adlab_audit_workspace_time
ON adlab_audit_logs (workspace_id, created_at DESC);

-- Index for entity-specific audit trail
CREATE INDEX IF NOT EXISTS idx_adlab_audit_entity
ON adlab_audit_logs (entity_type, entity_id);

-- Index for action filtering
CREATE INDEX IF NOT EXISTS idx_adlab_audit_action
ON adlab_audit_logs (action);

-- Add comment for documentation
COMMENT ON TABLE adlab_audit_logs IS 'Immutable audit trail for high-risk AdLab actions. Append-only, no edits or deletes allowed.';
COMMENT ON COLUMN adlab_audit_logs.action IS 'Action type: PROMOTE | ROLLBACK | SNAPSHOT_ACTIVATE | SNAPSHOT_DEACTIVATE | VALIDATE | INGEST';
COMMENT ON COLUMN adlab_audit_logs.entity_type IS 'Entity type: ingestion_log | snapshot | dataset';
COMMENT ON COLUMN adlab_audit_logs.scope IS 'JSON object with platform, dataset, and optional clientId';
COMMENT ON COLUMN adlab_audit_logs.reason IS 'Required for ROLLBACK actions, optional for others';
COMMENT ON COLUMN adlab_audit_logs.metadata IS 'Additional context: snapshotId, ingestionLogId, row counts, etc.';
