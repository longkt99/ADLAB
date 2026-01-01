# D6.5 — Execution Readiness Lock

**Version:** 1.0
**Date:** 2024-12-28
**Status:** LOCKED FOR EXECUTION
**Prerequisite:** D6.4 (COMPLETE with accepted UNKNOWN sections)

---

## 1. Accepted Schema Gaps

The following are **intentionally deferred** and do NOT block execution:

| Gap | Status | Impact |
|-----|--------|--------|
| demographic_metrics (partial) | ACCEPTED | Demographic ingestion deferred to future phase |
| reports table (not exported) | ACCEPTED | Report generation is separate subsystem |
| alerts D1 fields (unverified) | ACCEPTED | Alert evaluation uses visible columns only |

---

## 2. SAFE TO RUN

### 2.1 Staging Infrastructure (D6.5.2)

| Component | Status | Notes |
|-----------|--------|-------|
| `staging_rows` table creation | SAFE | DDL ready in 008_staging_tables.sql |
| `staging_id_resolution` table creation | SAFE | DDL ready |
| RLS policies for staging | SAFE | workspace_id scoped |
| Cleanup functions | SAFE | 7-day retention policy |

### 2.2 Dimension Ingestion

| Table | Status | Natural Key Verified |
|-------|--------|---------------------|
| campaigns | SAFE | (workspace_id, client_id, platform, external_id) |
| ad_sets | SAFE | (workspace_id, client_id, platform, external_id) |
| ads | SAFE | (workspace_id, client_id, platform, external_id) |

**Constraint:** Upsert requires unique index on natural key (verify exists).

### 2.3 Fact Ingestion

| Table | Status | Notes |
|-------|--------|-------|
| daily_metrics | SAFE | All 14 columns verified |
| demographic_metrics | BLOCKED | Schema incomplete |

### 2.4 Upload Tracking

| Table | Status | Notes |
|-------|--------|-------|
| data_uploads | SAFE | All 12 columns verified |

---

## 3. BLOCKED

| Component | Blocker | Unblock Criteria |
|-----------|---------|------------------|
| demographic_metrics ingestion | Schema incomplete (5/~15 columns) | Export full schema |
| Report generation | reports table not exported | Export schema when needed |
| Alert resolution workflow | D1 columns unverified | Verify resolved_at, note exist |

**Policy:** Blocked components return early with `SCHEMA_INCOMPLETE` error code. No silent failures.

---

## 4. DEFERRED

| Component | Reason | Target Phase |
|-----------|--------|--------------|
| API Pull (Meta/Google/TikTok) | D6.7.2 design complete, impl separate | D7+ |
| Scheduled ingestion | Requires API pull | D7+ |
| Alert evaluation runtime | D6.6 design complete, impl separate | D7+ |
| Demographic breakdowns | Schema incomplete | Post-schema-export |

---

## 5. Production Constraints

### 5.1 Hard Limits

| Constraint | Value | Rationale |
|------------|-------|-----------|
| Max file size | 50 MB | Memory safety |
| Max rows per upload | 100,000 | Transaction size |
| Max concurrent uploads per workspace | 3 | Resource fairness |
| Staging retention | 7 days | Storage cost |
| Dry-run retention | 24 hours | Ephemeral by design |

### 5.2 Rate Limits

| Operation | Limit | Window |
|-----------|-------|--------|
| Manual uploads | 10 | per hour per client |
| API pulls (future) | Per-platform limits | See D6.7.2 |

### 5.3 Transaction Boundaries

| Rule | Specification |
|------|---------------|
| Dimension upserts | Single transaction per entity type |
| Fact upserts | Batched, 1000 rows per transaction |
| Rollback scope | Per-stage, not per-upload |

### 5.4 RLS Enforcement

| Rule | Specification |
|------|---------------|
| All queries | Must include workspace_id filter |
| Service role | Used only for staging cleanup cron |
| User context | Passed via Supabase auth headers |

---

## 6. Required Follow-Up Schema (OPTIONAL)

These are **not blocking** but should be collected when convenient:

| Table | Missing Data | Priority |
|-------|--------------|----------|
| demographic_metrics | Full column list | LOW (feature not in MVP) |
| reports | Full schema | LOW (separate subsystem) |
| alerts | D1 columns verification | MEDIUM (for resolution workflow) |

**Action:** Re-run `information_schema.columns` query for these tables when demographic/report features are prioritized.

---

## 7. Execution Checklist

### Pre-Flight (Required)

- [ ] Verify unique indexes exist on dimension natural keys
- [ ] Run 008_staging_tables.sql migration
- [ ] Confirm RLS policies active on all tables
- [ ] Set up error logging destination

### First Run (Recommended)

- [ ] Execute with `mode: FULL_DRY_RUN` first
- [ ] Verify staging_rows populated correctly
- [ ] Check staging_id_resolution mappings
- [ ] Review validation warnings before production commit

---

## 8. Lock Statement

**D6.5 EXECUTION READINESS: LOCKED**

| Category | Count |
|----------|-------|
| SAFE TO RUN | 6 tables (campaigns, ad_sets, ads, daily_metrics, data_uploads, staging) |
| BLOCKED | 2 tables (demographic_metrics, reports) |
| DEFERRED | 4 components (API pull, scheduling, alert runtime, demographics) |

Ingestion for core dimension and daily_metrics fact tables is **approved for implementation**.

---

| Role | Approval | Date |
|------|----------|------|
| Schema Owner | D6.4 gaps accepted | 2024-12-28 |
| Execution Lead | D6.5 locked | 2024-12-28 |
