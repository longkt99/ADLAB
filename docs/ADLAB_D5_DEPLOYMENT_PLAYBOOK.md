# AdLab D5.2 Deployment Playbook

**Version:** D5.2
**Date:** 2024-12-28
**Status:** PRODUCTION DEPLOYMENT GUIDE

---

## 1. Pre-Deployment Checklist

Complete ALL items before proceeding. Any NO stops deployment.

### 1.1 Environment Verification

| Check | Command/Action | Expected Result | Status |
|-------|----------------|-----------------|--------|
| Node.js version | `node --version` | v18.x or v20.x | |
| npm version | `npm --version` | v9.x or v10.x | |
| Build succeeds | `npm run build` | Exit code 0, no errors | |
| TypeScript clean | `npx tsc --noEmit` | Only test file errors (vitest) | |
| Environment file exists | Check `.env.local` or `.env.production` | File present | |

### 1.2 Supabase Verification

| Check | Verification Method | Expected Result | Status |
|-------|---------------------|-----------------|--------|
| Supabase URL configured | `NEXT_PUBLIC_SUPABASE_URL` set | Valid URL | |
| Supabase anon key configured | `NEXT_PUBLIC_SUPABASE_ANON_KEY` set | Valid key | |
| Database accessible | Test connection via Supabase dashboard | Connection successful | |
| All 10 AdLab tables exist | Run Table Existence Query (see below) | Count = 10 | |
| Critical columns exist | Run Column Existence Query (see below) | All present | |
| RLS enabled on all tables | Run RLS Status Query (see below) | All ENABLED | |

### 1.3 Schema Verification Queries

Run in Supabase SQL Editor before deployment:

```sql
-- Table Existence (must return 10)
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'workspaces', 'clients', 'campaigns', 'ad_sets', 'ads',
    'daily_metrics', 'demographic_metrics', 'alerts', 'alert_rules', 'reports'
  );

-- Critical ORDER BY Columns (must return 2)
SELECT COUNT(*) AS critical_columns
FROM information_schema.columns
WHERE (table_name = 'ad_sets' AND column_name = 'first_seen_at')
   OR (table_name = 'ads' AND column_name = 'first_seen_at');

-- Phase D1 Columns (must return 2)
SELECT COUNT(*) AS d1_columns
FROM information_schema.columns
WHERE table_name = 'alerts'
  AND column_name IN ('resolved_at', 'note');

-- RLS Status (all must be TRUE)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces', 'clients', 'campaigns', 'ad_sets', 'ads',
    'daily_metrics', 'demographic_metrics', 'alerts', 'alert_rules', 'reports'
  );
```

### 1.4 Environment Variables

| Variable | Required | Validation |
|----------|----------|------------|
| NEXT_PUBLIC_SUPABASE_URL | YES | Must be valid HTTPS URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | YES | Must be non-empty string |
| NODE_ENV | YES | Must be "production" for prod deploy |

---

## 2. Deployment Order

Deployment MUST follow this exact sequence.

### Phase 1: Pre-Flight Verification

| Step | Action | Success Criteria | Abort If |
|------|--------|------------------|----------|
| 1.1 | Complete Pre-Deployment Checklist | All items PASS | Any item FAIL |
| 1.2 | Run schema verification queries | All counts match expected | Any count wrong |
| 1.3 | Verify no pending migrations | Migration folder matches production | Unapplied migrations exist |

### Phase 2: Migration (If Required)

| Step | Action | Success Criteria | Abort If |
|------|--------|------------------|----------|
| 2.1 | Backup current database state | Backup confirmed | Backup fails |
| 2.2 | Apply 007_adlab_full_schema.sql | No errors | Any SQL error |
| 2.3 | Run post-migration verification | All tables/columns exist | Any missing |
| 2.4 | Verify RLS still enabled | All tables have RLS | Any disabled |

### Phase 3: Application Deployment

| Step | Action | Success Criteria | Abort If |
|------|--------|------------------|----------|
| 3.1 | Build application | `npm run build` succeeds | Build fails |
| 3.2 | Deploy to hosting platform | Deployment completes | Deployment fails |
| 3.3 | Verify application starts | Health check passes | App crashes |
| 3.4 | Smoke test all AdLab routes | All pages load | Any page fails |

### Phase 4: Post-Deployment Verification

| Step | Action | Success Criteria | Abort If |
|------|--------|------------------|----------|
| 4.1 | Load /ads/alerts | Page renders (data or empty state) | Error or crash |
| 4.2 | Load /ads/clients | Page renders (data or empty state) | Error or crash |
| 4.3 | Load /ads/campaigns | Page renders (data or empty state) | Error or crash |
| 4.4 | Load /ads/metrics | Both sections render | Error or crash |
| 4.5 | Test alert mutation (if data exists) | Mark read/unread works | Mutation fails |

---

## 3. GO / NO-GO Conditions

### 3.1 GO Conditions (ALL must be true)

| Condition | Verification |
|-----------|--------------|
| All 10 tables exist | SQL query returns 10 |
| Critical columns exist | ad_sets.first_seen_at, ads.first_seen_at present |
| Phase D1 columns exist | alerts.resolved_at, alerts.note present |
| RLS enabled | All tables show rowsecurity = true |
| Build succeeds | npm run build exit code 0 |
| Environment configured | All required env vars set |
| No blocking issues | No CRITICAL errors in pre-flight |

### 3.2 NO-GO Conditions (ANY stops deployment)

| Condition | Action |
|-----------|--------|
| Any table missing | Run 007_adlab_full_schema.sql first |
| ORDER BY columns missing | Run migration, do not deploy |
| RLS disabled on any table | Enable RLS, do not deploy |
| Build fails | Fix build errors, do not deploy |
| Environment vars missing | Configure vars, do not deploy |
| Database unreachable | Resolve connectivity, do not deploy |

---

## 4. Rollback Rules

### 4.1 When Rollback Is Allowed

| Scenario | Rollback Permitted | Type |
|----------|-------------------|------|
| Application crashes on startup | YES | Code rollback |
| Pages return 500 errors | YES | Code rollback |
| Mutations fail silently | YES | Code rollback |
| Performance degradation (>5s page load) | YES | Code rollback |
| UI renders incorrectly | YES | Code rollback |

### 4.2 What Is Rolled Back

| Asset | Rollback Method | Notes |
|-------|-----------------|-------|
| Application code | Redeploy previous version | Standard deployment rollback |
| Environment variables | Restore previous values | If changed during deploy |
| Static assets | Redeploy previous version | Bundled with code |

### 4.3 What Is NEVER Rolled Back

| Asset | Reason | Alternative |
|-------|--------|-------------|
| Database schema | Data loss risk | Forward-fix with new migration |
| Database data | Data loss | Restore from backup only if catastrophic |
| RLS policies | Security risk | Forward-fix only |
| User-generated data | Data loss | Never roll back |

### 4.4 Rollback Procedure

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Identify rollback trigger | Document the failure |
| 2 | Notify stakeholders | Alert sent |
| 3 | Redeploy previous version | Use hosting platform rollback |
| 4 | Verify previous version works | Smoke test all routes |
| 5 | Document incident | Create incident report |
| 6 | Plan forward-fix | Schedule fix deployment |

---

## 5. DO NOT DEPLOY IF

These are hard blockers. No exceptions.

| Blocker | Reason | Resolution Required |
|---------|--------|---------------------|
| Any AdLab table missing | Queries will fail with SCHEMA_CONTRACT_VIOLATION | Run migration first |
| first_seen_at columns missing | ORDER BY will fail | Run migration first |
| resolved_at or note columns missing | Phase D1 features will break | Run migration first |
| RLS disabled | Security vulnerability | Enable RLS first |
| Build fails | Application will not start | Fix build errors |
| Supabase unreachable | All queries will fail | Resolve connectivity |
| Environment variables missing | Application will crash | Configure variables |
| Previous deployment still failing | Cascading failures | Fix previous issues first |

---

## 6. Final Deployment Confirmation

Complete this checklist immediately before pressing deploy.

### 6.1 Final Verification

| Item | Confirmed |
|------|-----------|
| Pre-deployment checklist complete | [ ] |
| All schema verification queries passed | [ ] |
| Build succeeded locally | [ ] |
| Environment variables configured in production | [ ] |
| Rollback procedure understood | [ ] |
| Stakeholders notified of deployment | [ ] |
| Monitoring in place (if available) | [ ] |

### 6.2 Deployment Authorization

| Field | Value |
|-------|-------|
| Deployer name | |
| Deployment date/time | |
| Version/commit being deployed | |
| Previous version (for rollback) | |
| GO decision confirmed | [ ] YES |

### 6.3 Post-Deployment Sign-Off

| Item | Confirmed |
|------|-----------|
| All AdLab routes load successfully | [ ] |
| Empty states render correctly | [ ] |
| Error states render correctly (if triggered) | [ ] |
| Mutations work (if data exists to test) | [ ] |
| No console errors in browser | [ ] |
| No server errors in logs | [ ] |

---

## 7. Emergency Contacts

| Role | Responsibility | Contact Method |
|------|----------------|----------------|
| Deployer | Execute deployment | On-call |
| Schema Owner | Approve schema-related decisions | On-call |
| Platform Owner | Hosting platform issues | On-call |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.2 | 2024-12-28 | Initial deployment playbook |
