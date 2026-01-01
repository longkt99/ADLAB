-- ============================================
-- AdLab Failure Injections
-- ============================================
-- PHASE D23: Chaos & Failure Injection (Controlled).
--
-- CORE PRINCIPLE:
-- Prove the system fails safely by injecting controlled failures.
-- This is NOT testing mocks - this is production-grade chaos control.
--
-- HARD RULES:
-- - Never writes corrupt data
-- - Never bypasses audit
-- - Never auto-enabled (must be explicitly turned on)
-- - Kill-switch overrides injection
-- - Fully reversible by disabling row
--
-- USE CASES:
-- - Verify rollback works under timeout conditions
-- - Test UI error handling
-- - Validate audit logging captures failures
-- - Stress test retry logic
-- ============================================

-- ============================================
-- Failure Injections Table
-- ============================================

CREATE TABLE IF NOT EXISTS adlab_failure_injections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace scope (required - no global chaos)
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Which action to inject failure into
  action TEXT NOT NULL CHECK (action IN (
    'INGEST',
    'VALIDATE',
    'PROMOTE',
    'ROLLBACK',
    'SNAPSHOT_ACTIVATE',
    'SNAPSHOT_DEACTIVATE',
    'ANALYTICS'
  )),

  -- Type of failure to simulate
  failure_type TEXT NOT NULL CHECK (failure_type IN (
    'TIMEOUT',      -- Artificial delay + timeout error
    'THROW',        -- Hard exception
    'PARTIAL',      -- Simulate partial success (NO actual writes)
    'STALE_DATA'    -- Force analytics to read previous snapshot
  )),

  -- Probability of failure (1-100%)
  probability INT NOT NULL CHECK (probability BETWEEN 1 AND 100),

  -- The actual switch state
  enabled BOOLEAN NOT NULL DEFAULT false,

  -- Human-readable reason (required for accountability)
  reason TEXT NOT NULL,

  -- Who created this injection config
  created_by TEXT NULL, -- User ID or 'system'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- When enabled/disabled
  enabled_at TIMESTAMPTZ NULL,
  enabled_by TEXT NULL,
  disabled_at TIMESTAMPTZ NULL,
  disabled_by TEXT NULL,

  -- Track updates
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint: one injection per action per workspace
  CONSTRAINT unique_workspace_action UNIQUE (workspace_id, action)
);

-- ============================================
-- Indexes
-- ============================================

-- Fast lookup for enabled injections
CREATE INDEX IF NOT EXISTS idx_failure_injections_enabled
  ON adlab_failure_injections(enabled)
  WHERE enabled = true;

-- Fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_failure_injections_workspace
  ON adlab_failure_injections(workspace_id);

-- Fast lookup by action
CREATE INDEX IF NOT EXISTS idx_failure_injections_action
  ON adlab_failure_injections(action);

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_failure_injection_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Track enable/disable transitions
  IF NEW.enabled = true AND OLD.enabled = false THEN
    NEW.enabled_at = now();
    NEW.disabled_at = NULL;
    NEW.disabled_by = NULL;
  ELSIF NEW.enabled = false AND OLD.enabled = true THEN
    NEW.disabled_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_failure_injection_updated_at ON adlab_failure_injections;
CREATE TRIGGER trigger_failure_injection_updated_at
  BEFORE UPDATE ON adlab_failure_injections
  FOR EACH ROW
  EXECUTE FUNCTION update_failure_injection_timestamps();

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE adlab_failure_injections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "failure_injections_select_all" ON adlab_failure_injections;
DROP POLICY IF EXISTS "failure_injections_insert_service_only" ON adlab_failure_injections;
DROP POLICY IF EXISTS "failure_injections_update_service_only" ON adlab_failure_injections;
DROP POLICY IF EXISTS "failure_injections_delete_denied" ON adlab_failure_injections;

-- SELECT: Authenticated users can read (for debugging)
-- INTENT: Operators need to see what injections are active
CREATE POLICY "failure_injections_select_all"
ON adlab_failure_injections
FOR SELECT
USING (
  auth.role() = 'authenticated' OR auth.role() = 'service_role'
);

-- INSERT: Only service role can create injections
-- INTENT: Chaos injection is admin-only via API/DB
CREATE POLICY "failure_injections_insert_service_only"
ON adlab_failure_injections
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- UPDATE: Only service role can toggle injections
-- INTENT: Enabling/disabling is admin-only
CREATE POLICY "failure_injections_update_service_only"
ON adlab_failure_injections
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- DELETE: Not allowed
-- INTENT: Injection records are audit trail - never delete
CREATE POLICY "failure_injections_delete_denied"
ON adlab_failure_injections
FOR DELETE
USING (false);

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE adlab_failure_injections IS
  'D23: Controlled failure injection configs for chaos testing';

COMMENT ON COLUMN adlab_failure_injections.action IS
  'D23: Which operation to inject failure into (INGEST, PROMOTE, ROLLBACK, etc.)';

COMMENT ON COLUMN adlab_failure_injections.failure_type IS
  'D23: Type of failure (TIMEOUT, THROW, PARTIAL, STALE_DATA)';

COMMENT ON COLUMN adlab_failure_injections.probability IS
  'D23: Probability of failure (1-100%). Used for randomized injection.';

COMMENT ON COLUMN adlab_failure_injections.enabled IS
  'D23: When true, failures MAY be injected based on probability';

COMMENT ON COLUMN adlab_failure_injections.reason IS
  'D23: Required human-readable reason for this injection config';

COMMENT ON POLICY "failure_injections_select_all" ON adlab_failure_injections IS
  'D23: Authenticated users can read injection configs for debugging';

COMMENT ON POLICY "failure_injections_delete_denied" ON adlab_failure_injections IS
  'D23: Injection records are audit trail - deletion is NEVER allowed';
