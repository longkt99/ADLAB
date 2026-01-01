-- ============================================
-- AdLab Full Schema Migration
-- ============================================
-- Phase D4.1: Schema Audit & Migration Lock
--
-- This migration ensures all AdLab tables exist with
-- all columns required by lib/adlab/queries.ts
--
-- SAFETY: All statements are idempotent (IF NOT EXISTS)
-- ============================================

-- Enable UUID extension (should already exist)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. WORKSPACES TABLE
-- ============================================
-- May already exist from main app schema

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CLIENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform_tags TEXT[] DEFAULT '{}',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- RLS for clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_all" ON clients;
CREATE POLICY "clients_select_all" ON clients FOR SELECT USING (true);

DROP POLICY IF EXISTS "clients_insert_all" ON clients;
CREATE POLICY "clients_insert_all" ON clients FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "clients_update_all" ON clients;
CREATE POLICY "clients_update_all" ON clients FOR UPDATE USING (true);

DROP POLICY IF EXISTS "clients_delete_all" ON clients;
CREATE POLICY "clients_delete_all" ON clients FOR DELETE USING (true);

-- ============================================
-- 3. CAMPAIGNS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NULL,
  end_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- RLS for campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_select_all" ON campaigns;
CREATE POLICY "campaigns_select_all" ON campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "campaigns_insert_all" ON campaigns;
CREATE POLICY "campaigns_insert_all" ON campaigns FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "campaigns_update_all" ON campaigns;
CREATE POLICY "campaigns_update_all" ON campaigns FOR UPDATE USING (true);

DROP POLICY IF EXISTS "campaigns_delete_all" ON campaigns;
CREATE POLICY "campaigns_delete_all" ON campaigns FOR DELETE USING (true);

-- ============================================
-- 4. AD_SETS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ad_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  daily_budget NUMERIC NULL,
  lifetime_budget NUMERIC NULL,
  bid_strategy TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
ALTER TABLE ad_sets ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ad_sets ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for ad_sets
CREATE INDEX IF NOT EXISTS idx_ad_sets_workspace_id ON ad_sets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_client_id ON ad_sets(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_campaign_id ON ad_sets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_sets_first_seen_at ON ad_sets(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_sets_platform ON ad_sets(platform);
CREATE INDEX IF NOT EXISTS idx_ad_sets_status ON ad_sets(status);

-- RLS for ad_sets
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ad_sets_select_all" ON ad_sets;
CREATE POLICY "ad_sets_select_all" ON ad_sets FOR SELECT USING (true);

DROP POLICY IF EXISTS "ad_sets_insert_all" ON ad_sets;
CREATE POLICY "ad_sets_insert_all" ON ad_sets FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ad_sets_update_all" ON ad_sets;
CREATE POLICY "ad_sets_update_all" ON ad_sets FOR UPDATE USING (true);

DROP POLICY IF EXISTS "ad_sets_delete_all" ON ad_sets;
CREATE POLICY "ad_sets_delete_all" ON ad_sets FOR DELETE USING (true);

-- ============================================
-- 5. ADS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  ad_set_id UUID NOT NULL REFERENCES ad_sets(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  creative_id TEXT NULL,
  landing_page_url TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables)
ALTER TABLE ads ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ads ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for ads
CREATE INDEX IF NOT EXISTS idx_ads_workspace_id ON ads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ads_client_id ON ads(client_id);
CREATE INDEX IF NOT EXISTS idx_ads_campaign_id ON ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ads_ad_set_id ON ads(ad_set_id);
CREATE INDEX IF NOT EXISTS idx_ads_first_seen_at ON ads(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON ads(platform);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ads(status);

-- RLS for ads
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ads_select_all" ON ads;
CREATE POLICY "ads_select_all" ON ads FOR SELECT USING (true);

DROP POLICY IF EXISTS "ads_insert_all" ON ads;
CREATE POLICY "ads_insert_all" ON ads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "ads_update_all" ON ads;
CREATE POLICY "ads_update_all" ON ads FOR UPDATE USING (true);

DROP POLICY IF EXISTS "ads_delete_all" ON ads;
CREATE POLICY "ads_delete_all" ON ads FOR DELETE USING (true);

-- ============================================
-- 6. DAILY_METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('campaign', 'ad_set', 'ad')),
  campaign_id UUID NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  ad_set_id UUID NULL REFERENCES ad_sets(id) ON DELETE SET NULL,
  ad_id UUID NULL REFERENCES ads(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  link_clicks INTEGER NOT NULL DEFAULT 0,
  ctr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  cpm NUMERIC NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  conversion_value NUMERIC NOT NULL DEFAULT 0,
  cpa NUMERIC NOT NULL DEFAULT 0,
  video_views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for daily_metrics
CREATE INDEX IF NOT EXISTS idx_daily_metrics_workspace_id ON daily_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_client_id ON daily_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_platform ON daily_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_entity_type ON daily_metrics(entity_type);

-- RLS for daily_metrics
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_metrics_select_all" ON daily_metrics;
CREATE POLICY "daily_metrics_select_all" ON daily_metrics FOR SELECT USING (true);

DROP POLICY IF EXISTS "daily_metrics_insert_all" ON daily_metrics;
CREATE POLICY "daily_metrics_insert_all" ON daily_metrics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "daily_metrics_update_all" ON daily_metrics;
CREATE POLICY "daily_metrics_update_all" ON daily_metrics FOR UPDATE USING (true);

DROP POLICY IF EXISTS "daily_metrics_delete_all" ON daily_metrics;
CREATE POLICY "daily_metrics_delete_all" ON daily_metrics FOR DELETE USING (true);

-- ============================================
-- 7. DEMOGRAPHIC_METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS demographic_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  date DATE NOT NULL,
  ad_id UUID NULL REFERENCES ads(id) ON DELETE SET NULL,
  dimension TEXT NOT NULL CHECK (dimension IN ('age', 'gender', 'location', 'device', 'placement')),
  key TEXT NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for demographic_metrics
CREATE INDEX IF NOT EXISTS idx_demographic_metrics_workspace_id ON demographic_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_demographic_metrics_client_id ON demographic_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_demographic_metrics_date ON demographic_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_demographic_metrics_dimension ON demographic_metrics(dimension);

-- RLS for demographic_metrics
ALTER TABLE demographic_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demographic_metrics_select_all" ON demographic_metrics;
CREATE POLICY "demographic_metrics_select_all" ON demographic_metrics FOR SELECT USING (true);

DROP POLICY IF EXISTS "demographic_metrics_insert_all" ON demographic_metrics;
CREATE POLICY "demographic_metrics_insert_all" ON demographic_metrics FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "demographic_metrics_update_all" ON demographic_metrics;
CREATE POLICY "demographic_metrics_update_all" ON demographic_metrics FOR UPDATE USING (true);

DROP POLICY IF EXISTS "demographic_metrics_delete_all" ON demographic_metrics;
CREATE POLICY "demographic_metrics_delete_all" ON demographic_metrics FOR DELETE USING (true);

-- ============================================
-- 8. ALERT_RULES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
  platform TEXT NULL,
  metric_key TEXT NULL,
  operator TEXT NULL CHECK (operator IN ('>', '<', '>=', '<=', '=', '!=')),
  threshold NUMERIC NULL,
  severity TEXT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  scope TEXT NULL CHECK (scope IN ('campaign', 'ad_set', 'ad', 'client', 'workspace')),
  is_enabled BOOLEAN DEFAULT true,
  name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NULL
);

-- Indexes for alert_rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_workspace_id ON alert_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_client_id ON alert_rules(client_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_created_at ON alert_rules(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_enabled ON alert_rules(is_enabled) WHERE is_enabled = true;

-- RLS for alert_rules
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_rules_select_all" ON alert_rules;
CREATE POLICY "alert_rules_select_all" ON alert_rules FOR SELECT USING (true);

DROP POLICY IF EXISTS "alert_rules_insert_all" ON alert_rules;
CREATE POLICY "alert_rules_insert_all" ON alert_rules FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "alert_rules_update_all" ON alert_rules;
CREATE POLICY "alert_rules_update_all" ON alert_rules FOR UPDATE USING (true);

DROP POLICY IF EXISTS "alert_rules_delete_all" ON alert_rules;
CREATE POLICY "alert_rules_delete_all" ON alert_rules FOR DELETE USING (true);

-- ============================================
-- 9. ALERTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  rule_id UUID NULL REFERENCES alert_rules(id) ON DELETE SET NULL,
  platform TEXT NULL,
  metric_key TEXT NULL,
  metric_value NUMERIC NULL,
  threshold NUMERIC NULL,
  operator TEXT NULL,
  metric_date DATE NULL,
  campaign_id UUID NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  ad_set_id UUID NULL REFERENCES ad_sets(id) ON DELETE SET NULL,
  ad_id UUID NULL REFERENCES ads(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns if they don't exist (for existing tables - Phase D1 additions)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS note TEXT NULL;

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_workspace_id ON alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_alerts_client_id ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_platform ON alerts(platform);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved_at ON alerts(resolved_at) WHERE resolved_at IS NOT NULL;

-- RLS for alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts_select_all" ON alerts;
CREATE POLICY "alerts_select_all" ON alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "alerts_insert_all" ON alerts;
CREATE POLICY "alerts_insert_all" ON alerts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "alerts_update_all" ON alerts;
CREATE POLICY "alerts_update_all" ON alerts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "alerts_delete_all" ON alerts;
CREATE POLICY "alerts_delete_all" ON alerts FOR DELETE USING (true);

-- ============================================
-- 10. REPORTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('performance', 'demographic', 'creative', 'comparison', 'custom')),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'failed')),
  file_url TEXT NULL,
  generated_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS idx_reports_workspace_id ON reports(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reports_client_id ON reports(client_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- RLS for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_all" ON reports;
CREATE POLICY "reports_select_all" ON reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "reports_insert_all" ON reports;
CREATE POLICY "reports_insert_all" ON reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reports_update_all" ON reports;
CREATE POLICY "reports_update_all" ON reports FOR UPDATE USING (true);

DROP POLICY IF EXISTS "reports_delete_all" ON reports;
CREATE POLICY "reports_delete_all" ON reports FOR DELETE USING (true);

-- ============================================
-- 11. UPDATED_AT TRIGGERS
-- ============================================

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for tables with updated_at
DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reports_updated_at ON reports;
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. VERIFICATION QUERIES
-- ============================================

-- Run these to verify successful migration:

-- Check all tables exist
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'workspaces', 'clients', 'campaigns', 'ad_sets', 'ads',
      'daily_metrics', 'demographic_metrics', 'alerts', 'alert_rules', 'reports'
    );

  IF table_count = 10 THEN
    RAISE NOTICE 'All 10 AdLab tables exist';
  ELSE
    RAISE WARNING 'Only % of 10 AdLab tables exist', table_count;
  END IF;
END $$;

-- Check critical ORDER BY columns exist
DO $$
BEGIN
  -- Check ad_sets.first_seen_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ad_sets' AND column_name = 'first_seen_at'
  ) THEN
    RAISE NOTICE 'ad_sets.first_seen_at exists';
  ELSE
    RAISE WARNING 'ad_sets.first_seen_at MISSING';
  END IF;

  -- Check ads.first_seen_at
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ads' AND column_name = 'first_seen_at'
  ) THEN
    RAISE NOTICE 'ads.first_seen_at exists';
  ELSE
    RAISE WARNING 'ads.first_seen_at MISSING';
  END IF;

  -- Check alerts.resolved_at (Phase D1)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'resolved_at'
  ) THEN
    RAISE NOTICE 'alerts.resolved_at exists';
  ELSE
    RAISE WARNING 'alerts.resolved_at MISSING';
  END IF;

  -- Check alerts.note (Phase D1)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'alerts' AND column_name = 'note'
  ) THEN
    RAISE NOTICE 'alerts.note exists';
  ELSE
    RAISE WARNING 'alerts.note MISSING';
  END IF;
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE 'AdLab Schema Migration Complete';
  RAISE NOTICE 'Phase D4.1: Schema Audit & Migration Lock';
  RAISE NOTICE '============================================';
END $$;
