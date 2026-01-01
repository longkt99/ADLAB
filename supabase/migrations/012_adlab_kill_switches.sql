-- ============================================
-- AdLab Kill Switches
-- ============================================
-- PHASE D22: Operational Safety Net.
--
-- CORE PRINCIPLE:
-- When the kill-switch is ON, nothing dangerous happens.
-- No exceptions. No overrides. No "but I'm the owner."
--
-- HARD RULES:
-- - Kill-switch overrides ALL permissions
-- - Owner cannot bypass
-- - Works without redeploy
-- - Logged, auditable, reversible
-- - No destructive actions while active
--
-- USE CASES:
-- - Emergency: data corruption detected
-- - Compliance: legal hold
-- - Maintenance: major schema migration
-- - Incident: security breach investigation
-- ============================================

-- ============================================
-- Kill Switches Table
-- ============================================

CREATE TABLE IF NOT EXISTS adlab_kill_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: 'global' affects all workspaces, 'workspace' affects one
  scope TEXT NOT NULL CHECK (scope IN ('global', 'workspace')),

  -- For workspace-scoped switches only
  workspace_id UUID NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Human-readable reason (required for accountability)
  reason TEXT NOT NULL,

  -- The actual switch state
  enabled BOOLEAN NOT NULL DEFAULT false,

  -- Who activated it
  activated_by TEXT NULL, -- User ID or 'system'
  activated_at TIMESTAMPTZ NULL,

  -- Who deactivated it (for audit trail)
  deactivated_by TEXT NULL,
  deactivated_at TIMESTAMPTZ NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_workspace_scope CHECK (
    (scope = 'global' AND workspace_id IS NULL) OR
    (scope = 'workspace' AND workspace_id IS NOT NULL)
  )
);

-- ============================================
-- Unique Constraints
-- ============================================

-- Only ONE global kill-switch row allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_global_unique
  ON adlab_kill_switches(scope)
  WHERE scope = 'global';

-- Only ONE kill-switch per workspace
CREATE UNIQUE INDEX IF NOT EXISTS idx_kill_switch_workspace_unique
  ON adlab_kill_switches(workspace_id)
  WHERE scope = 'workspace' AND workspace_id IS NOT NULL;

-- ============================================
-- Additional Indexes
-- ============================================

-- Fast lookup for enabled switches
CREATE INDEX IF NOT EXISTS idx_kill_switches_enabled
  ON adlab_kill_switches(enabled)
  WHERE enabled = true;

-- Fast lookup by workspace
CREATE INDEX IF NOT EXISTS idx_kill_switches_workspace
  ON adlab_kill_switches(workspace_id)
  WHERE workspace_id IS NOT NULL;

-- ============================================
-- Updated At Trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_kill_switch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  -- Track activation/deactivation
  IF NEW.enabled = true AND OLD.enabled = false THEN
    NEW.activated_at = now();
    NEW.deactivated_at = NULL;
    NEW.deactivated_by = NULL;
  ELSIF NEW.enabled = false AND OLD.enabled = true THEN
    NEW.deactivated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_kill_switch_updated_at ON adlab_kill_switches;
CREATE TRIGGER trigger_kill_switch_updated_at
  BEFORE UPDATE ON adlab_kill_switches
  FOR EACH ROW
  EXECUTE FUNCTION update_kill_switch_updated_at();

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE adlab_kill_switches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "kill_switches_select_all" ON adlab_kill_switches;
DROP POLICY IF EXISTS "kill_switches_insert_service_only" ON adlab_kill_switches;
DROP POLICY IF EXISTS "kill_switches_update_service_only" ON adlab_kill_switches;
DROP POLICY IF EXISTS "kill_switches_delete_denied" ON adlab_kill_switches;

-- SELECT: Authenticated users can read (need to check if blocked)
-- INTENT: UI needs to display kill-switch status
CREATE POLICY "kill_switches_select_all"
ON adlab_kill_switches
FOR SELECT
USING (
  auth.role() = 'authenticated' OR auth.role() = 'service_role'
);

-- INSERT: Only service role can create kill-switches
-- INTENT: Kill-switch activation is admin-only via API
CREATE POLICY "kill_switches_insert_service_only"
ON adlab_kill_switches
FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
);

-- UPDATE: Only service role can toggle kill-switches
-- INTENT: Kill-switch state changes are admin-only via API
CREATE POLICY "kill_switches_update_service_only"
ON adlab_kill_switches
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- DELETE: Not allowed
-- INTENT: Kill-switch records are audit trail - never delete
CREATE POLICY "kill_switches_delete_denied"
ON adlab_kill_switches
FOR DELETE
USING (false);

-- ============================================
-- Seed: Create default global kill-switch (disabled)
-- ============================================

INSERT INTO adlab_kill_switches (scope, workspace_id, reason, enabled)
VALUES ('global', NULL, 'Global emergency kill-switch', false)
ON CONFLICT DO NOTHING;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE adlab_kill_switches IS
  'D22: Operational kill-switches for emergency blocking of dangerous operations';

COMMENT ON COLUMN adlab_kill_switches.scope IS
  'D22: global affects all workspaces, workspace affects one specific workspace';

COMMENT ON COLUMN adlab_kill_switches.enabled IS
  'D22: When true, ALL dangerous operations are blocked regardless of permissions';

COMMENT ON COLUMN adlab_kill_switches.reason IS
  'D22: Required human-readable reason for activation (accountability)';

COMMENT ON POLICY "kill_switches_select_all" ON adlab_kill_switches IS
  'D22: All authenticated users can read kill-switch status for UI blocking';

COMMENT ON POLICY "kill_switches_delete_denied" ON adlab_kill_switches IS
  'D22: Kill-switch records are audit trail - deletion is NEVER allowed';
