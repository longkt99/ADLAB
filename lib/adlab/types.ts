// ============================================
// AdLab Shared Types
// ============================================
// CLIENT-SAFE: This file contains only type definitions.
// It can be safely imported by both server and client components.
//
// IMPORTANT: Do NOT add any runtime code or imports from server-only
// modules. This file must remain side-effect free.
// ============================================

// ============================================
// Filter Types
// ============================================

export interface AdLabFilters {
  workspaceId: string;
  clientId?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface DateRange {
  from: string;
  to: string;
}

// Alert filter types (Phase D3.1)
export type AlertStatusFilter = 'all' | 'unread' | 'read' | 'resolved';
export type AlertSeverityFilter = 'all' | 'warning' | 'critical' | 'info';
export type AlertPlatformFilter = 'all' | 'meta' | 'google' | 'tiktok' | 'linkedin';

export interface AlertFilters {
  status?: AlertStatusFilter;
  severity?: AlertSeverityFilter;
  platform?: AlertPlatformFilter;
}

// ============================================
// Entity Types
// ============================================

export interface AdLabClient {
  id: string;
  workspace_id: string;
  name: string;
  platform_tags: string[];
  notes: string | null;
  created_at: string;
}

export interface AdLabCampaign {
  id: string;
  workspace_id: string;
  client_id: string;
  platform: string;
  external_id: string;
  name: string;
  objective: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  // Joined field
  client_name?: string | null;
}

export interface AdLabAdSet {
  id: string;
  workspace_id: string;
  client_id: string;
  platform: string;
  campaign_id: string;
  external_id: string;
  name: string;
  status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  bid_strategy: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AdLabAd {
  id: string;
  workspace_id: string;
  client_id: string;
  platform: string;
  campaign_id: string;
  ad_set_id: string;
  external_id: string;
  name: string;
  status: string;
  creative_id: string | null;
  landing_page_url: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AdLabDailyMetric {
  id: string;
  workspace_id: string;
  client_id: string;
  platform: string;
  date: string;
  entity_type: string;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  currency: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversion_value: number;
  cpa: number;
  video_views: number;
  created_at: string;
}

export interface AdLabDemographicMetric {
  id: string;
  workspace_id: string;
  client_id: string;
  platform: string;
  date: string;
  ad_id: string | null;
  dimension: string;
  key: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  created_at: string;
}

export interface AdLabAlert {
  id: string;
  workspace_id: string;
  client_id: string;
  rule_id: string | null;
  platform: string | null;
  metric_key: string | null;
  metric_value: number | null;
  threshold: number | null;
  operator: string | null;
  metric_date: string | null;
  campaign_id: string | null;
  ad_set_id: string | null;
  ad_id: string | null;
  severity: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  resolved_at: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdLabReport {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  report_type: string;
  date_from: string;
  date_to: string;
  platforms: string[];
  status: string;
  file_url: string | null;
  generated_at: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdLabAlertRule {
  id: string;
  workspace_id: string;
  client_id: string | null;
  platform: string | null;
  metric_key: string | null;
  operator: string | null;
  threshold: number | null;
  severity: string | null;
  scope: string | null;
  is_enabled: boolean | null;
  name: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AdLabWorkspace {
  id: string;
  name: string;
  slug: string | null;
  tier: string | null;
  created_at: string;
  updated_at: string | null;
}

// ============================================
// Query Result Types
// ============================================

export interface QueryResult<T> {
  data: T[];
  error: string | null;
  count: number;
}

export interface SingleResult<T> {
  data: T | null;
  error: string | null;
}

export interface CountsResult {
  clients: number;
  campaigns: number;
  adSets: number;
  ads: number;
  unreadAlerts: number;
  error: string | null;
}

export interface MutationResult {
  success: boolean;
  error: string | null;
}

export interface BulkMutationResult {
  success: boolean;
  affected: number;
  error: string | null;
}

// ============================================
// Alert Trace Types
// ============================================

export interface AlertTrace {
  alert: AdLabAlert;
  rule: AdLabAlertRule | null;
  workspace: AdLabWorkspace | null;
  client: AdLabClient | null;
  campaign: AdLabCampaign | null;
  adSet: AdLabAdSet | null;
  ad: AdLabAd | null;
}

export interface AlertTraceResult {
  data: AlertTrace | null;
  error: string | null;
}

// ============================================
// Overview Types
// ============================================

export interface OverviewSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  error: string | null;
}
