# AdLab D5.3 Observation Checklist

**Version:** D5.3
**Date:** 2024-12-28
**Status:** PRODUCTION OBSERVATION PROTOCOL

---

## Instructions

This checklist is used during soft launch observation periods. Complete all applicable sections at specified intervals.

---

## 1. Hourly Checks (Day 1 Only)

Complete every hour for the first 24 hours after deployment.

### 1.1 System Health

| Check | Hour 1 | Hour 2 | Hour 3 | Hour 4 | Hour 5 | Hour 6 |
|-------|--------|--------|--------|--------|--------|--------|
| Application running | | | | | | |
| All routes accessible | | | | | | |
| Supabase connected | | | | | | |
| Logs being written | | | | | | |

| Check | Hour 7 | Hour 8 | Hour 9 | Hour 10 | Hour 11 | Hour 12 |
|-------|--------|--------|--------|---------|---------|---------|
| Application running | | | | | | |
| All routes accessible | | | | | | |
| Supabase connected | | | | | | |
| Logs being written | | | | | | |

| Check | Hour 13 | Hour 14 | Hour 15 | Hour 16 | Hour 17 | Hour 18 |
|-------|---------|---------|---------|---------|---------|---------|
| Application running | | | | | | |
| All routes accessible | | | | | | |
| Supabase connected | | | | | | |
| Logs being written | | | | | | |

| Check | Hour 19 | Hour 20 | Hour 21 | Hour 22 | Hour 23 | Hour 24 |
|-------|---------|---------|---------|---------|---------|---------|
| Application running | | | | | | |
| All routes accessible | | | | | | |
| Supabase connected | | | | | | |
| Logs being written | | | | | | |

### 1.2 Error Counts (Hourly)

| Hour | CRITICAL | ERROR | WARN | Notes |
|------|----------|-------|------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |
| 13 | | | | |
| 14 | | | | |
| 15 | | | | |
| 16 | | | | |
| 17 | | | | |
| 18 | | | | |
| 19 | | | | |
| 20 | | | | |
| 21 | | | | |
| 22 | | | | |
| 23 | | | | |
| 24 | | | | |

---

## 2. Daily Checks (Days 1-14)

Complete once per day during soft launch.

### 2.1 Route Verification

| Route | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Day 6 | Day 7 |
|-------|-------|-------|-------|-------|-------|-------|-------|
| /ads/alerts | | | | | | | |
| /ads/alerts/[id] | | | | | | | |
| /ads/clients | | | | | | | |
| /ads/campaigns | | | | | | | |
| /ads/ad-sets | | | | | | | |
| /ads/ads | | | | | | | |
| /ads/metrics | | | | | | | |
| /ads/reports | | | | | | | |
| /ads/alert-rules | | | | | | | |
| /ads/overview | | | | | | | |

| Route | Day 8 | Day 9 | Day 10 | Day 11 | Day 12 | Day 13 | Day 14 |
|-------|-------|-------|--------|--------|--------|--------|--------|
| /ads/alerts | | | | | | | |
| /ads/alerts/[id] | | | | | | | |
| /ads/clients | | | | | | | |
| /ads/campaigns | | | | | | | |
| /ads/ad-sets | | | | | | | |
| /ads/ads | | | | | | | |
| /ads/metrics | | | | | | | |
| /ads/reports | | | | | | | |
| /ads/alert-rules | | | | | | | |
| /ads/overview | | | | | | | |

Status codes: OK / EMPTY / ERROR / SLOW

### 2.2 Error Summary (Daily)

| Day | CRITICAL | ERROR | WARN | Query Failures | Mutations Failed |
|-----|----------|-------|------|----------------|------------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |
| 6 | | | | | |
| 7 | | | | | |
| 8 | | | | | |
| 9 | | | | | |
| 10 | | | | | |
| 11 | | | | | |
| 12 | | | | | |
| 13 | | | | | |
| 14 | | | | | |

### 2.3 Data Integrity (Daily)

| Check | Day 1 | Day 3 | Day 5 | Day 7 | Day 10 | Day 14 |
|-------|-------|-------|-------|-------|--------|--------|
| Orphaned alert references | | | | | | |
| NULL in ORDER BY columns | | | | | | |
| RLS functioning | | | | | | |
| Data consistent | | | | | | |

---

## 3. Functional Validation

### 3.1 Read Operations

| Operation | Tested | Result | Notes |
|-----------|--------|--------|-------|
| Load alerts list (zero data) | | | |
| Load alerts list (with data) | | | |
| Load alerts with status filter | | | |
| Load alerts with severity filter | | | |
| Load alerts with platform filter | | | |
| Load alerts with multiple filters | | | |
| Load alert detail (exists) | | | |
| Load alert detail (not exists) | | | |
| Load alert with missing trace entities | | | |
| Load clients list | | | |
| Load campaigns list | | | |
| Load ad-sets list | | | |
| Load ads list | | | |
| Load daily metrics | | | |
| Load demographic metrics | | | |
| Load reports list | | | |
| Load alert rules list | | | |
| Load overview counts | | | |

### 3.2 Write Operations

| Operation | Tested | Result | Notes |
|-----------|--------|--------|-------|
| Mark alert as read | | | |
| Mark alert as unread | | | |
| Resolve alert | | | |
| Reopen alert | | | |
| Save note (add) | | | |
| Save note (update) | | | |
| Save note (clear) | | | |
| Bulk mark read (2 alerts) | | | |
| Bulk mark read (10 alerts) | | | |
| Bulk mark unread | | | |
| Bulk resolve | | | |
| Bulk reopen | | | |

### 3.3 UI Behavior

| Behavior | Tested | Result | Notes |
|----------|--------|--------|-------|
| Empty state shows on zero data | | | |
| Error state shows on query failure | | | |
| Filter scope indicator visible | | | |
| Row selection works | | | |
| Bulk action bar appears/hides | | | |
| Page revalidates after mutation | | | |
| Navigation works between pages | | | |
| Back button works correctly | | | |

---

## 4. Error Pattern Tracking

### 4.1 Error Log

| Date/Time | Error Code | Page | Description | Action Taken |
|-----------|------------|------|-------------|--------------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

### 4.2 Error Patterns Identified

| Pattern | Frequency | Root Cause | Resolution |
|---------|-----------|------------|------------|
| | | | |
| | | | |
| | | | |

---

## 5. User Feedback Log (Phase 2+)

### 5.1 Feedback Entries

| Date | User | Feedback Type | Description | Priority |
|------|------|---------------|-------------|----------|
| | | Bug / Confusion / Request / Praise | | |
| | | Bug / Confusion / Request / Praise | | |
| | | Bug / Confusion / Request / Praise | | |
| | | Bug / Confusion / Request / Praise | | |
| | | Bug / Confusion / Request / Praise | | |

### 5.2 Feedback Summary

| Category | Count | Top Themes |
|----------|-------|------------|
| Bug reports | | |
| Confusion points | | |
| Feature requests | | |
| Positive feedback | | |

---

## 6. Performance Observations

### 6.1 Page Load Times

| Page | Day 1 | Day 7 | Day 14 | Acceptable |
|------|-------|-------|--------|------------|
| /ads/alerts | | | | < 2s |
| /ads/alerts/[id] | | | | < 2s |
| /ads/clients | | | | < 2s |
| /ads/campaigns | | | | < 2s |
| /ads/metrics | | | | < 3s |

### 6.2 Mutation Response Times

| Operation | Average | Max | Acceptable |
|-----------|---------|-----|------------|
| Mark read | | | < 1s |
| Resolve | | | < 1s |
| Save note | | | < 1s |
| Bulk action | | | < 2s |

---

## 7. Phase Gate Decisions

### 7.1 Phase 0 → Phase 1 Gate

| Criterion | Status | Blocker |
|-----------|--------|---------|
| Deployment successful | | |
| All routes load | | |
| Logging operational | | |
| Schema verified | | |

**Decision:** PROCEED / HOLD / ABORT

**Date:** _______________
**Decided By:** _______________

### 7.2 Phase 1 → Phase 2 Gate

| Criterion | Status | Blocker |
|-----------|--------|---------|
| 48 hours elapsed | | |
| Zero CRITICAL errors | | |
| All read operations verified | | |
| All write operations verified | | |
| Query failure rate < 1% | | |

**Decision:** PROCEED / HOLD / ABORT

**Date:** _______________
**Decided By:** _______________

### 7.3 Phase 2 → Phase 3 Gate

| Criterion | Status | Blocker |
|-----------|--------|---------|
| 5 days elapsed | | |
| Zero P0/P1 issues | | |
| User feedback positive | | |
| No data integrity issues | | |

**Decision:** PROCEED / HOLD / ABORT

**Date:** _______________
**Decided By:** _______________

### 7.4 Soft Launch Completion Gate

| Criterion | Status | Blocker |
|-----------|--------|---------|
| 14 days elapsed | | |
| All P0/P1 resolved | | |
| Query failure rate < 1% | | |
| No data corruption | | |
| User validation complete | | |

**Decision:** COMPLETE / EXTEND / ABORT

**Date:** _______________
**Decided By:** _______________

---

## 8. Issue Tracker

### 8.1 Open Issues

| ID | Severity | Summary | Opened | Owner | Status |
|----|----------|---------|--------|-------|--------|
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |

### 8.2 Resolved Issues

| ID | Severity | Summary | Opened | Resolved | Resolution |
|----|----------|---------|--------|----------|------------|
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |
| | P0/P1/P2/P3 | | | | |

---

## 9. Sign-Off

### 9.1 Daily Sign-Off

| Day | Observer | Status | Signature |
|-----|----------|--------|-----------|
| 1 | | OK / Issue | |
| 2 | | OK / Issue | |
| 3 | | OK / Issue | |
| 4 | | OK / Issue | |
| 5 | | OK / Issue | |
| 6 | | OK / Issue | |
| 7 | | OK / Issue | |
| 8 | | OK / Issue | |
| 9 | | OK / Issue | |
| 10 | | OK / Issue | |
| 11 | | OK / Issue | |
| 12 | | OK / Issue | |
| 13 | | OK / Issue | |
| 14 | | OK / Issue | |

### 9.2 Final Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Observer Lead | | | |
| Production Lead | | | |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.3 | 2024-12-28 | Initial observation checklist |
