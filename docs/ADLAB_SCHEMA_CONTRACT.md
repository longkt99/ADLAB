# AdLab Schema Contract & Audit Report
## Phase D4.1: Schema Audit & Migration Lock

**Generated:** 2024-12-28
**Status:** ACTIVE CONTRACT
**Version:** 1.0.0

---

## Executive Summary

This document establishes the frozen Data Contract for AdLab tables. All UI queries in `lib/adlab/queries.ts` reference specific columns - this contract ensures those columns exist in Supabase.

### Critical Finding

**AdLab tables have NO migration files in the repository.** The existing migrations only cover:
- `posts`, `variants` (Content Machine core)
- `cron_logs` (scheduling)
- `studio_saved_posts` (AI Studio)
- `alerts.resolved_at`, `alerts.note` (Phase D1 additions)

The base AdLab schema (clients, campaigns, ad_sets, ads, alerts, daily_metrics, demographic_metrics, reports, alert_rules) must have been created directly in Supabase without version control.

---

## 1. Audit Table

| Table | Column | Used By | Status | Decision | Rationale |
|-------|--------|---------|--------|----------|-----------|
| **clients** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | name | queries.ts, UI | REQUIRED | Keep | Display name |
| | platform_tags | queries.ts | REQUIRED | Keep | Array of platforms |
| | notes | queries.ts | REQUIRED | Keep | Nullable text |
| | created_at | queries.ts (ORDER BY) | REQUIRED | Keep | Sorting column |
| **campaigns** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts (JOIN) | REQUIRED | Keep | FK to clients |
| | platform | queries.ts, UI | REQUIRED | Keep | Platform identifier |
| | external_id | queries.ts | REQUIRED | Keep | Platform's ID |
| | name | queries.ts, UI | REQUIRED | Keep | Display name |
| | objective | queries.ts, UI | OPTIONAL | Keep | Nullable |
| | status | queries.ts, UI | REQUIRED | Keep | Campaign status |
| | start_date | queries.ts | OPTIONAL | Keep | Nullable |
| | end_date | queries.ts | OPTIONAL | Keep | Nullable |
| | created_at | queries.ts (ORDER BY) | REQUIRED | Keep | Sorting column |
| **ad_sets** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | platform | queries.ts, UI | REQUIRED | Keep | Platform identifier |
| | campaign_id | queries.ts | REQUIRED | Keep | FK to campaigns |
| | external_id | queries.ts | REQUIRED | Keep | Platform's ID |
| | name | queries.ts, UI | REQUIRED | Keep | Display name |
| | status | queries.ts, UI | REQUIRED | Keep | Ad set status |
| | daily_budget | queries.ts, UI | OPTIONAL | Keep | Nullable number |
| | lifetime_budget | queries.ts | OPTIONAL | Keep | Nullable number |
| | bid_strategy | queries.ts, UI | OPTIONAL | Keep | Nullable string |
| | **first_seen_at** | queries.ts (ORDER BY), UI | REQUIRED | **VERIFY** | Used for sorting - must exist |
| | **last_seen_at** | queries.ts | OPTIONAL | **VERIFY** | Referenced but not displayed |
| **ads** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | platform | queries.ts, UI | REQUIRED | Keep | Platform identifier |
| | campaign_id | queries.ts | REQUIRED | Keep | FK to campaigns |
| | ad_set_id | queries.ts | REQUIRED | Keep | FK to ad_sets |
| | external_id | queries.ts | REQUIRED | Keep | Platform's ID |
| | name | queries.ts, UI | REQUIRED | Keep | Display name |
| | status | queries.ts, UI | REQUIRED | Keep | Ad status |
| | creative_id | queries.ts, UI | OPTIONAL | Keep | Nullable string |
| | landing_page_url | queries.ts, UI | OPTIONAL | Keep | Nullable URL |
| | **first_seen_at** | queries.ts (ORDER BY), UI | REQUIRED | **VERIFY** | Used for sorting - must exist |
| | **last_seen_at** | queries.ts | OPTIONAL | **VERIFY** | Referenced but not displayed |
| **daily_metrics** | id | queries.ts | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | platform | queries.ts, UI | REQUIRED | Keep | Platform identifier |
| | date | queries.ts (ORDER BY), UI | REQUIRED | Keep | Metric date |
| | entity_type | queries.ts, UI | REQUIRED | Keep | campaign/ad_set/ad |
| | campaign_id | queries.ts | OPTIONAL | Keep | Nullable FK |
| | ad_set_id | queries.ts | OPTIONAL | Keep | Nullable FK |
| | ad_id | queries.ts | OPTIONAL | Keep | Nullable FK |
| | currency | queries.ts | REQUIRED | Keep | Currency code |
| | spend | queries.ts, UI | REQUIRED | Keep | Money spent |
| | impressions | queries.ts, UI | REQUIRED | Keep | Impression count |
| | reach | queries.ts | REQUIRED | Keep | Reach count |
| | clicks | queries.ts, UI | REQUIRED | Keep | Click count |
| | link_clicks | queries.ts | REQUIRED | Keep | Link click count |
| | ctr | queries.ts, UI | REQUIRED | Keep | Click-through rate |
| | cpc | queries.ts | REQUIRED | Keep | Cost per click |
| | cpm | queries.ts | REQUIRED | Keep | Cost per mille |
| | conversions | queries.ts | REQUIRED | Keep | Conversion count |
| | conversion_value | queries.ts | REQUIRED | Keep | Conversion value |
| | cpa | queries.ts | REQUIRED | Keep | Cost per acquisition |
| | video_views | queries.ts | REQUIRED | Keep | Video view count |
| | created_at | queries.ts | REQUIRED | Keep | Record timestamp |
| **demographic_metrics** | id | queries.ts | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | platform | queries.ts, UI | REQUIRED | Keep | Platform identifier |
| | date | queries.ts (ORDER BY), UI | REQUIRED | Keep | Metric date |
| | ad_id | queries.ts | OPTIONAL | Keep | Nullable FK |
| | dimension | queries.ts, UI | REQUIRED | Keep | age/gender/location |
| | key | queries.ts, UI | REQUIRED | Keep | Dimension value |
| | spend | queries.ts, UI | REQUIRED | Keep | Money spent |
| | impressions | queries.ts, UI | REQUIRED | Keep | Impression count |
| | clicks | queries.ts, UI | REQUIRED | Keep | Click count |
| | conversions | queries.ts | REQUIRED | Keep | Conversion count |
| | created_at | queries.ts | REQUIRED | Keep | Record timestamp |
| **alerts** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | rule_id | queries.ts | OPTIONAL | Keep | FK to alert_rules |
| | platform | queries.ts, UI | OPTIONAL | Keep | Platform identifier |
| | metric_key | queries.ts | OPTIONAL | Keep | Which metric triggered |
| | metric_value | queries.ts | OPTIONAL | Keep | Actual value |
| | threshold | queries.ts | OPTIONAL | Keep | Rule threshold |
| | operator | queries.ts | OPTIONAL | Keep | Comparison operator |
| | metric_date | queries.ts | OPTIONAL | Keep | Date of metric |
| | campaign_id | queries.ts | OPTIONAL | Keep | FK to campaigns |
| | ad_set_id | queries.ts | OPTIONAL | Keep | FK to ad_sets |
| | ad_id | queries.ts | OPTIONAL | Keep | FK to ads |
| | severity | queries.ts, UI | REQUIRED | Keep | warning/critical/info |
| | message | queries.ts, UI | REQUIRED | Keep | Alert text |
| | is_read | queries.ts (FILTER), UI | REQUIRED | Keep | Read status flag |
| | read_at | queries.ts (MUTATION) | OPTIONAL | Keep | Nullable timestamp |
| | resolved_at | queries.ts (FILTER, MUTATION) | OPTIONAL | Keep | Nullable timestamp (Phase D1) |
| | note | queries.ts (MUTATION), UI | OPTIONAL | Keep | Internal notes (Phase D1) |
| | created_at | queries.ts (ORDER BY), UI | REQUIRED | Keep | Alert timestamp |
| | updated_at | queries.ts (MUTATION) | REQUIRED | Keep | Last update |
| **reports** | id | queries.ts, UI | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | REQUIRED | Keep | FK to clients |
| | name | queries.ts, UI | REQUIRED | Keep | Report name |
| | report_type | queries.ts, UI | REQUIRED | Keep | Type of report |
| | date_from | queries.ts, UI | REQUIRED | Keep | Range start |
| | date_to | queries.ts, UI | REQUIRED | Keep | Range end |
| | platforms | queries.ts, UI | REQUIRED | Keep | Array of platforms |
| | status | queries.ts, UI | REQUIRED | Keep | Report status |
| | file_url | queries.ts, UI | OPTIONAL | Keep | Download URL |
| | generated_at | queries.ts | OPTIONAL | Keep | When generated |
| | error_message | queries.ts | OPTIONAL | Keep | Error if failed |
| | created_by | queries.ts | OPTIONAL | Keep | User ID |
| | created_at | queries.ts (ORDER BY), UI | REQUIRED | Keep | Record timestamp |
| | updated_at | queries.ts | REQUIRED | Keep | Last update |
| **alert_rules** | id | queries.ts | REQUIRED | Keep | Primary key |
| | workspace_id | queries.ts | REQUIRED | Keep | Multi-tenant isolation |
| | client_id | queries.ts | OPTIONAL | Keep | FK to clients |
| | platform | queries.ts | OPTIONAL | Keep | Platform filter |
| | metric_key | queries.ts | OPTIONAL | Keep | Which metric |
| | operator | queries.ts | OPTIONAL | Keep | Comparison operator |
| | threshold | queries.ts | OPTIONAL | Keep | Trigger value |
| | severity | queries.ts | OPTIONAL | Keep | Alert severity |
| | scope | queries.ts | OPTIONAL | Keep | Rule scope |
| | is_enabled | queries.ts | OPTIONAL | Keep | Active flag |
| | name | queries.ts | OPTIONAL | Keep | Rule name |
| | created_at | queries.ts (ORDER BY) | REQUIRED | Keep | Rule timestamp |
| | updated_at | queries.ts | OPTIONAL | Keep | Last update |
| **workspaces** | id | queries.ts (JOIN) | REQUIRED | Keep | Primary key |
| | name | queries.ts | REQUIRED | Keep | Workspace name |
| | created_at | queries.ts | REQUIRED | Keep | Workspace timestamp |

---

## 2. High-Risk Columns (VERIFY Status)

These columns are used for **ORDER BY** or UI display but may not exist in the database:

| Table | Column | Usage | Risk | Recommendation |
|-------|--------|-------|------|----------------|
| ad_sets | first_seen_at | ORDER BY, UI display | **HIGH** | Migration required if missing |
| ad_sets | last_seen_at | Type definition only | LOW | Migration required if missing |
| ads | first_seen_at | ORDER BY, UI display | **HIGH** | Migration required if missing |
| ads | last_seen_at | Type definition only | LOW | Migration required if missing |

If these columns don't exist, the queries will fail with "column does not exist" errors.

---

## 3. Data Contract Summary

### 3.1 Tables Required

```
clients              - AdLab client accounts
campaigns            - Advertising campaigns
ad_sets              - Ad set / ad group configurations
ads                  - Individual advertisements
daily_metrics        - Daily performance metrics
demographic_metrics  - Audience breakdown metrics
alerts               - Alert notifications
alert_rules          - Alert rule definitions
reports              - Generated reports
workspaces           - Multi-tenant workspaces (may already exist)
```

### 3.2 Foreign Key Relationships

```
campaigns.client_id     -> clients.id
ad_sets.client_id       -> clients.id
ad_sets.campaign_id     -> campaigns.id
ads.client_id           -> clients.id
ads.campaign_id         -> campaigns.id
ads.ad_set_id           -> ad_sets.id
daily_metrics.client_id -> clients.id
demographic_metrics.client_id -> clients.id
alerts.client_id        -> clients.id
alerts.rule_id          -> alert_rules.id (nullable)
alerts.campaign_id      -> campaigns.id (nullable)
alerts.ad_set_id        -> ad_sets.id (nullable)
alerts.ad_id            -> ads.id (nullable)
reports.client_id       -> clients.id
alert_rules.client_id   -> clients.id (nullable)
```

### 3.3 Column Naming Conventions

- UUIDs: `id`, `*_id` (foreign keys)
- Timestamps: `*_at` suffix (created_at, updated_at, first_seen_at, etc.)
- Booleans: `is_*` prefix (is_read, is_enabled)
- Arrays: Plural names (platforms, platform_tags)
- Status fields: `status` (enum-like text)

### 3.4 Required Indexes

```sql
-- For ORDER BY performance
idx_clients_created_at          ON clients(created_at DESC)
idx_campaigns_created_at        ON campaigns(created_at DESC)
idx_ad_sets_first_seen_at       ON ad_sets(first_seen_at DESC)
idx_ads_first_seen_at           ON ads(first_seen_at DESC)
idx_daily_metrics_date          ON daily_metrics(date DESC)
idx_demographic_metrics_date    ON demographic_metrics(date DESC)
idx_alerts_created_at           ON alerts(created_at DESC)
idx_reports_created_at          ON reports(created_at DESC)
idx_alert_rules_created_at      ON alert_rules(created_at DESC)

-- For filtering
idx_alerts_is_read              ON alerts(is_read)
idx_alerts_resolved_at          ON alerts(resolved_at) WHERE resolved_at IS NOT NULL
idx_alerts_severity             ON alerts(severity)
idx_alerts_platform             ON alerts(platform)
```

---

## 4. Verification Checklist

Run these queries in Supabase SQL Editor to verify schema compliance:

### 4.1 Table Existence Check

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'clients', 'campaigns', 'ad_sets', 'ads',
    'daily_metrics', 'demographic_metrics',
    'alerts', 'alert_rules', 'reports', 'workspaces'
  )
ORDER BY table_name;
```

**Expected:** All 10 tables should be listed.

### 4.2 Critical Column Check (ORDER BY columns)

```sql
-- Check ad_sets has first_seen_at
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ad_sets'
  AND column_name IN ('first_seen_at', 'last_seen_at');

-- Check ads has first_seen_at
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ads'
  AND column_name IN ('first_seen_at', 'last_seen_at');
```

**Expected:** Both columns should exist with TIMESTAMPTZ type.

### 4.3 Alerts Table Column Check

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'alerts'
ORDER BY ordinal_position;
```

**Expected:** All columns from the audit table should be present.

### 4.4 Full Column Audit Query

```sql
-- Run this to get complete schema snapshot
SELECT
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN (
    'clients', 'campaigns', 'ad_sets', 'ads',
    'daily_metrics', 'demographic_metrics',
    'alerts', 'alert_rules', 'reports', 'workspaces'
  )
ORDER BY t.table_name, c.ordinal_position;
```

---

## 5. Contract Lock

**This contract is now LOCKED.** Any schema changes must:

1. Update this document first
2. Create a new migration file in `supabase/migrations/`
3. Use idempotent SQL (IF NOT EXISTS, ADD COLUMN IF NOT EXISTS)
4. Be reviewed and approved before deployment

---

## Appendix A: Migration Template

For any missing columns, use this template:

```sql
-- Migration: Add missing AdLab columns
-- File: supabase/migrations/YYYYMMDD_adlab_schema_sync.sql

-- Add first_seen_at to ad_sets if missing
ALTER TABLE ad_sets
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE ad_sets
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Add first_seen_at to ads if missing
ALTER TABLE ads
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE ads
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ad_sets_first_seen_at ON ad_sets(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_first_seen_at ON ads(first_seen_at DESC);
```

---

## Appendix B: Full Table Creation Scripts

If tables are completely missing, use these scripts. See `supabase/migrations/007_adlab_full_schema.sql` for complete DDL.
