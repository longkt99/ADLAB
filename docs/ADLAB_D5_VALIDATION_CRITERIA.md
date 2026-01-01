# AdLab D5.3 Validation Criteria

**Version:** D5.3
**Date:** 2024-12-28
**Status:** PRODUCTION VALIDATION STANDARDS

---

## 1. Validation Framework

### 1.1 Validation Categories

| Category | Purpose | Weight |
|----------|---------|--------|
| System Stability | Verify system operates without failure | CRITICAL |
| Data Integrity | Verify data is accurate and consistent | CRITICAL |
| Functional Correctness | Verify features work as designed | HIGH |
| User Experience | Verify UX meets cognitive contracts | MEDIUM |
| Performance | Verify acceptable response times | MEDIUM |

### 1.2 Validation Levels

| Level | Definition | Required For |
|-------|------------|--------------|
| MUST PASS | Failure blocks launch | All CRITICAL items |
| SHOULD PASS | Failure requires justification | All HIGH items |
| NICE TO HAVE | Failure documented only | MEDIUM items |

---

## 2. System Stability Criteria

### 2.1 Availability

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| Application uptime | > 99.5% | Monitoring | MUST PASS |
| Route accessibility | 100% routes load | Smoke test | MUST PASS |
| Database connectivity | > 99.9% | Connection logs | MUST PASS |

### 2.2 Error Rates

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| CRITICAL errors | 0 | Log count | MUST PASS |
| Query failure rate | < 1% | Error count / total queries | MUST PASS |
| Unknown error rate | < 0.1% | UNKNOWN_RUNTIME_ERROR count | SHOULD PASS |
| Mutation failure rate | < 1% | Failed mutations / total | SHOULD PASS |

### 2.3 Schema Contract

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| SCHEMA_CONTRACT_VIOLATION | 0 | Log count | MUST PASS |
| All 10 tables accessible | 100% | Query each table | MUST PASS |
| ORDER BY columns present | 100% | Schema verification | MUST PASS |

---

## 3. Data Integrity Criteria

### 3.1 Referential Integrity

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| Orphaned alert references | Monitored | Count orphans | SHOULD PASS |
| FK constraint violations | 0 | Database errors | MUST PASS |
| Cascade behavior correct | 100% | Test deletions | MUST PASS |

### 3.2 Data Consistency

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| NULL in NOT NULL columns | 0 | Schema audit | MUST PASS |
| Invalid enum values | 0 | Data validation | MUST PASS |
| Duplicate primary keys | 0 | Database constraint | MUST PASS |

### 3.3 Mutation Integrity

| Criterion | Threshold | Measurement | Level |
|-----------|-----------|-------------|-------|
| Read status persists | 100% | Verify after mutation | MUST PASS |
| Resolve status persists | 100% | Verify after mutation | MUST PASS |
| Note content persists | 100% | Verify after mutation | MUST PASS |
| Bulk actions affect all selected | 100% | Verify counts | MUST PASS |

---

## 4. Functional Correctness Criteria

### 4.1 Read Operations

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| List queries return data or empty | Never error on valid query | MUST PASS |
| Single item queries return item or not-found | Never crash | MUST PASS |
| Filtered queries apply all filters | Correct result set | MUST PASS |
| ORDER BY produces correct order | Newest first | MUST PASS |
| Limit produces correct count | Max 20 items | SHOULD PASS |

### 4.2 Write Operations

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Mark read sets is_read=true, read_at | Verified in database | MUST PASS |
| Mark unread sets is_read=false, read_at=null | Verified in database | MUST PASS |
| Resolve sets resolved_at, auto-marks read | Verified in database | MUST PASS |
| Reopen clears resolved_at only | read status unchanged | MUST PASS |
| Save note updates note field | Verified in database | MUST PASS |

### 4.3 Bulk Operations

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Bulk mark read affects all selected | Count matches | MUST PASS |
| Bulk resolve affects all selected | Count matches | MUST PASS |
| Bulk action with 0 selected | No-op, no error | SHOULD PASS |
| Bulk action partial failure | Reports error | SHOULD PASS |

### 4.4 Filter Operations

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Status filter (unread) | Only is_read=false | MUST PASS |
| Status filter (read) | is_read=true AND resolved_at=null | MUST PASS |
| Status filter (resolved) | resolved_at IS NOT NULL | MUST PASS |
| Severity filter | Matches severity value | MUST PASS |
| Platform filter | Matches platform value | MUST PASS |
| Multiple filters | AND logic | MUST PASS |
| Filters persist in URL | Reload preserves filters | SHOULD PASS |

---

## 5. User Experience Criteria

### 5.1 Empty States

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Zero data shows AdLabEmptyState | Never blank table | MUST PASS |
| Empty state has title | Descriptive heading | MUST PASS |
| Empty state has description | Explains why empty | SHOULD PASS |
| Filtered empty shows filter context | User knows filters active | SHOULD PASS |

### 5.2 Error States

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Query error shows AdLabErrorBox | Never raw error | MUST PASS |
| Error message is user-friendly | No technical jargon | MUST PASS |
| Error includes hint when applicable | Helps user understand | SHOULD PASS |

### 5.3 Cognitive Clarity

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| Every page has cognitive explanation | Context present | SHOULD PASS |
| Entity pages explain alert relationship | User understands flow | SHOULD PASS |
| Actions provide feedback | User knows action succeeded | MUST PASS |

### 5.4 Navigation

| Criterion | Expected Behavior | Level |
|-----------|-------------------|-------|
| All links work | No broken links | MUST PASS |
| Back button works | Returns to previous page | SHOULD PASS |
| Deep links work | Direct URL access works | SHOULD PASS |

---

## 6. Performance Criteria

### 6.1 Page Load Times

| Page | Target | Acceptable | Unacceptable |
|------|--------|------------|--------------|
| /ads/alerts | < 1s | < 2s | > 3s |
| /ads/alerts/[id] | < 1s | < 2s | > 3s |
| /ads/clients | < 1s | < 2s | > 3s |
| /ads/campaigns | < 1s | < 2s | > 3s |
| /ads/ad-sets | < 1s | < 2s | > 3s |
| /ads/ads | < 1s | < 2s | > 3s |
| /ads/metrics | < 1.5s | < 3s | > 5s |
| /ads/reports | < 1s | < 2s | > 3s |

### 6.2 Mutation Response Times

| Operation | Target | Acceptable | Unacceptable |
|-----------|--------|------------|--------------|
| Mark read/unread | < 500ms | < 1s | > 2s |
| Resolve/Reopen | < 500ms | < 1s | > 2s |
| Save note | < 500ms | < 1s | > 2s |
| Bulk action (10 items) | < 1s | < 2s | > 3s |

### 6.3 Query Performance

| Query Type | Target | Acceptable | Unacceptable |
|------------|--------|------------|--------------|
| List query | < 200ms | < 500ms | > 1s |
| Single item query | < 100ms | < 300ms | > 500ms |
| Count query | < 100ms | < 200ms | > 500ms |
| Trace query (parallel) | < 500ms | < 1s | > 2s |

---

## 7. Validation Test Cases

### 7.1 Critical Path Tests

| ID | Test | Steps | Expected | Level |
|----|------|-------|----------|-------|
| CP-01 | Load alerts page | Navigate to /ads/alerts | Page loads, shows data or empty state | MUST PASS |
| CP-02 | Load alert detail | Click alert in list | Detail page loads with trace | MUST PASS |
| CP-03 | Mark alert read | Click read button | Status changes, persists on refresh | MUST PASS |
| CP-04 | Resolve alert | Click resolve button | Resolved, auto-marked read | MUST PASS |
| CP-05 | Bulk resolve | Select 3, click resolve | All 3 resolved | MUST PASS |
| CP-06 | Filter by status | Select "resolved" | Only resolved alerts shown | MUST PASS |

### 7.2 Edge Case Tests

| ID | Test | Steps | Expected | Level |
|----|------|-------|----------|-------|
| EC-01 | Non-existent alert | Navigate to /ads/alerts/invalid-id | Error state, not crash | MUST PASS |
| EC-02 | Alert with missing trace | Load alert with orphaned refs | Shows "—" for missing | MUST PASS |
| EC-03 | Empty filter result | Filter to no matches | Empty state with filter context | SHOULD PASS |
| EC-04 | Concurrent mutations | Two users resolve same alert | Both succeed or clear error | SHOULD PASS |
| EC-05 | Network interruption | Lose connection during mutation | Error shown, no corruption | SHOULD PASS |

### 7.3 Stress Tests

| ID | Test | Steps | Expected | Level |
|----|------|-------|----------|-------|
| ST-01 | Large alert list | Load page with 1000+ alerts | Page loads (limit 20) | SHOULD PASS |
| ST-02 | Rapid mutations | 10 mutations in 10 seconds | All succeed | SHOULD PASS |
| ST-03 | Bulk action max | Select and resolve 20 alerts | All resolved | SHOULD PASS |

---

## 8. Validation Sign-Off Matrix

### 8.1 MUST PASS Items

| Item | Tested By | Date | Result |
|------|-----------|------|--------|
| Application uptime > 99.5% | | | |
| 100% routes accessible | | | |
| 0 CRITICAL errors | | | |
| Query failure rate < 1% | | | |
| 0 SCHEMA_CONTRACT_VIOLATION | | | |
| All 10 tables accessible | | | |
| 0 FK constraint violations | | | |
| 0 NULL in NOT NULL columns | | | |
| Mutations persist correctly | | | |
| Empty states never blank | | | |
| Error states user-friendly | | | |
| All critical path tests pass | | | |

### 8.2 SHOULD PASS Items

| Item | Tested By | Date | Result | Justification if Failed |
|------|-----------|------|--------|-------------------------|
| Unknown error rate < 0.1% | | | | |
| Mutation failure rate < 1% | | | | |
| Orphan references monitored | | | | |
| All filters work correctly | | | | |
| Empty states have description | | | | |
| Cognitive explanations present | | | | |
| Page load times acceptable | | | | |
| Edge case tests pass | | | | |

---

## 9. Validation Verdict

### 9.1 Summary

| Category | MUST PASS | SHOULD PASS | Result |
|----------|-----------|-------------|--------|
| System Stability | /5 | /3 | |
| Data Integrity | /4 | /1 | |
| Functional Correctness | /12 | /4 | |
| User Experience | /4 | /5 | |
| Performance | /0 | /8 | |
| **Total** | **/25** | **/21** | |

### 9.2 Final Verdict

| Verdict | Criteria |
|---------|----------|
| VALIDATED | All MUST PASS items pass |
| CONDITIONALLY VALIDATED | All MUST PASS, some SHOULD PASS failed with justification |
| NOT VALIDATED | Any MUST PASS item failed |

**Verdict:** _______________

**Date:** _______________

**Validated By:** _______________

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.3 | 2024-12-28 | Initial validation criteria |
