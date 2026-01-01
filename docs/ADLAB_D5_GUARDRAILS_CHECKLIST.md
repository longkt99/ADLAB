# AdLab D5.1 Guardrails Checklist

**Version:** D5.1
**Date:** 2024-12-28
**Status:** PRODUCTION CHECKLIST

---

## Instructions

This checklist validates production guardrails. Each item must be verified before release.

Mark each item:
- PASS: Behavior confirmed
- FAIL: Issue found, blocking
- N/A: Not applicable to current deployment

---

## 1. Zero Data Scenarios

### 1.1 Empty Tables

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| clients table empty | AdLabEmptyState renders with "No clients yet" | Blank page, crash, undefined error | |
| campaigns table empty | AdLabEmptyState renders with "No campaigns yet" | Blank page, crash, undefined error | |
| ad_sets table empty | AdLabEmptyState renders with "No ad sets yet" | Blank page, crash, undefined error | |
| ads table empty | AdLabEmptyState renders with "No ads yet" | Blank page, crash, undefined error | |
| alerts table empty | AdLabEmptyState renders with "No alerts yet" | Blank page, crash, undefined error | |
| daily_metrics table empty | AdLabEmptyState renders for section | Crash, partial render | |
| demographic_metrics table empty | AdLabEmptyState renders for section | Crash, partial render | |
| reports table empty | AdLabEmptyState renders with "No reports yet" | Blank page, crash | |
| alert_rules table empty | AdLabEmptyState renders | Blank page, crash | |

### 1.2 Filtered Empty Results

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Alerts filtered, no matches | Filter scope indicator + empty state | Filters disappear, no feedback | |
| Status filter = resolved, none exist | Empty state with filter context | Silent empty table | |
| Platform filter = tiktok, none exist | Empty state with filter context | Silent empty table | |
| Severity filter = critical, none exist | Empty state with filter context | Silent empty table | |

---

## 2. Query Failure Scenarios

### 2.1 Network/Database Failures

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Supabase unreachable | AdLabErrorBox with neutral message | Crash, undefined, hanging spinner | |
| Query timeout | AdLabErrorBox with retry suggestion | Infinite loading, crash | |
| Invalid query syntax | AdLabErrorBox with error message | Raw SQL error shown to user | |

### 2.2 Schema Violations

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Missing table | AdLabErrorBox, CRITICAL logged | Technical error message to user | |
| Missing column | AdLabErrorBox, CRITICAL logged | Stack trace to user | |
| Wrong column type | AdLabErrorBox, ERROR logged | Malformed data displayed | |

### 2.3 Permission Errors

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| RLS blocks read | AdLabErrorBox with access hint | Raw "permission denied" shown | |
| RLS blocks update | Mutation returns error, toast shown | Silent failure | |

---

## 3. Orphaned Reference Scenarios

### 3.1 Alert Trace Missing Entities

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| alert.client_id points to deleted client | Client section shows "—" | Crash, undefined error | |
| alert.campaign_id points to deleted campaign | Campaign section shows "—" | Crash, undefined error | |
| alert.ad_set_id points to deleted ad_set | Ad Set section shows "—" | Crash, undefined error | |
| alert.ad_id points to deleted ad | Ad section shows "—" | Crash, undefined error | |
| alert.rule_id points to deleted rule | Rule section shows "—" | Crash, undefined error | |

### 3.2 Join Missing Entities

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| campaign.client_id invalid | client_name shows "—" | Crash, query failure | |

---

## 4. ORDER BY Safety

### 4.1 Sort Column Integrity

| Table | ORDER BY Column | Expected Behavior | Must NOT Happen | Status |
|-------|-----------------|-------------------|-----------------|--------|
| clients | created_at | Sorted DESC by date | Unsorted, crash | |
| campaigns | created_at | Sorted DESC by date | Unsorted, crash | |
| ad_sets | first_seen_at | Sorted DESC by date | Query failure if column missing | |
| ads | first_seen_at | Sorted DESC by date | Query failure if column missing | |
| alerts | created_at | Sorted DESC by date | Unsorted, crash | |
| daily_metrics | date | Sorted DESC by date | Unsorted, crash | |
| demographic_metrics | date | Sorted DESC by date | Unsorted, crash | |
| reports | created_at | Sorted DESC by date | Unsorted, crash | |

---

## 5. Mutation Safety

### 5.1 Alert State Changes

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Mark alert read | is_read=true, read_at set, page revalidates | Silent failure, stale UI | |
| Mark alert unread | is_read=false, read_at=null, page revalidates | Silent failure, stale UI | |
| Resolve alert | resolved_at set, auto-marks read if unread | Silent failure, stale UI | |
| Reopen alert | resolved_at=null, read status unchanged | Read status reset | |
| Save note | note updated, updated_at set | Note lost, silent failure | |

### 5.2 Bulk Actions

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Bulk mark read (5 alerts) | All 5 updated, page revalidates | Partial update without feedback | |
| Bulk mark unread (5 alerts) | All 5 updated, page revalidates | Partial update without feedback | |
| Bulk resolve (5 alerts) | All 5 resolved + marked read | Partial update without feedback | |
| Bulk reopen (5 alerts) | All 5 reopened, read status unchanged | Read status reset | |
| Bulk action on 0 selected | No operation, no error | Crash, error message | |
| Bulk action fails | Error returned, user notified | Silent failure | |

---

## 6. UI Rendering Safety

### 6.1 Empty State Rendering

| Page | Component Required | Message Required | Status |
|------|-------------------|------------------|--------|
| /ads/alerts | AdLabEmptyState | Title + description | |
| /ads/alerts (filtered) | AdLabEmptyState | Filter-aware message | |
| /ads/clients | AdLabEmptyState | Title + description | |
| /ads/campaigns | AdLabEmptyState | Title + description | |
| /ads/ad-sets | AdLabEmptyState | Title + description | |
| /ads/ads | AdLabEmptyState | Title + description | |
| /ads/metrics (daily) | AdLabEmptyState | Title + description | |
| /ads/metrics (demographic) | AdLabEmptyState | Title + description | |
| /ads/reports | AdLabEmptyState | Title + description | |

### 6.2 Error State Rendering

| Page | Component Required | Hint Required | Status |
|------|-------------------|---------------|--------|
| All AdLab pages | AdLabErrorBox | RLS hint when applicable | |

### 6.3 Cognitive Explanation Rendering

| Page | Explanation Required | Status |
|------|---------------------|--------|
| /ads/alerts | Present | |
| /ads/clients | Present | |
| /ads/campaigns | Present | |
| /ads/ad-sets | Present | |
| /ads/ads | Present | |
| /ads/metrics | Present | |
| /ads/reports | Present | |

---

## 7. Data Display Safety

### 7.1 Null/Missing Field Display

| Field Type | Expected Display | Must NOT Happen | Status |
|------------|------------------|-----------------|--------|
| Missing text | "—" | "null", "undefined", blank | |
| Missing date | "—" | "Invalid Date", epoch | |
| Missing number | "—" | "NaN", "0" (when not zero) | |
| Missing URL | Link not rendered | Broken link, "#" | |
| Missing array | Empty or "All" | "null", crash | |

### 7.2 Formatting Safety

| Data Type | Format | Must NOT Happen | Status |
|-----------|--------|-----------------|--------|
| Currency (VND) | Intl.NumberFormat | Raw number, wrong symbol | |
| Percentage (CTR) | X.XX% | Decimal > 1.0 shown raw | |
| Date | Short format (Jan 1, 2024) | ISO string, epoch | |
| UUID (creative_id) | Truncated with ... | Full 36-char UUID | |

---

## 8. Filter Safety

### 8.1 URL State Persistence

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Apply status filter | URL updates with ?status=X | Filter lost on refresh | |
| Apply severity filter | URL updates with ?severity=X | Filter lost on refresh | |
| Apply platform filter | URL updates with ?platform=X | Filter lost on refresh | |
| Multiple filters | URL contains all params | Only last filter persisted | |
| Clear filter | URL param removed | Stale param remains | |

### 8.2 Filter UI Visibility

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Filter active | Filter chip shows selection | Default shown as active | |
| Filter scope | Scope indicator shows active filters | No indication of filtering | |
| Reset to all | "All" selectable for each filter | No way to clear filter | |

---

## 9. Selection Safety (Alerts Page)

### 9.1 Row Selection

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| Select single row | Checkbox checked, count updates | Selection lost | |
| Select all visible | All checkboxes checked | Partial selection | |
| Deselect all | All checkboxes cleared | Selection persists | |
| Navigate away | Selection cleared | Stale selection on return | |

### 9.2 Bulk Action Bar

| Scenario | Expected Behavior | Must NOT Happen | Status |
|----------|-------------------|-----------------|--------|
| No selection | Bar hidden | Bar visible with 0 count | |
| 1+ selected | Bar visible with count | Bar hidden | |
| Action executed | Bar clears after success | Bar persists with stale count | |

---

## 10. Page Load Safety

### 10.1 Initial Render

| Page | Load Behavior | Must NOT Happen | Status |
|------|---------------|-----------------|--------|
| /ads/alerts | Data or empty state | Flash of unstyled content | |
| /ads/alerts/[id] | Detail or not found | Hanging loader, blank | |
| /ads/clients | Data or empty state | Flash of unstyled content | |
| /ads/campaigns | Data or empty state | Flash of unstyled content | |
| /ads/ad-sets | Data or empty state | Flash of unstyled content | |
| /ads/ads | Data or empty state | Flash of unstyled content | |
| /ads/metrics | Both sections render | One section missing | |
| /ads/reports | Data or empty state | Flash of unstyled content | |

---

## Verification Sign-Off

| Section | Verified By | Date | Status |
|---------|-------------|------|--------|
| Zero Data Scenarios | | | |
| Query Failure Scenarios | | | |
| Orphaned Reference Scenarios | | | |
| ORDER BY Safety | | | |
| Mutation Safety | | | |
| UI Rendering Safety | | | |
| Data Display Safety | | | |
| Filter Safety | | | |
| Selection Safety | | | |
| Page Load Safety | | | |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.1 | 2024-12-28 | Initial guardrails checklist |
