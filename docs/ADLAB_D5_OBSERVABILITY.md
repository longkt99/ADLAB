# AdLab D5.1 Observability Specification

**Version:** D5.1
**Date:** 2024-12-28
**Status:** PRODUCTION READINESS LAYER

---

## A. Error Taxonomy

### A.1 Error Classification Table

| Error Code | Description | Severity | User Visibility | Developer Visibility |
|------------|-------------|----------|-----------------|---------------------|
| DATA_ABSENT_EXPECTED | Query returned zero rows in a valid empty state | INFO | Contextual (empty state) | Log |
| DATA_ABSENT_UNEXPECTED | Query returned zero rows where data was expected | WARN | Contextual (empty state + hint) | Log + Monitor |
| QUERY_FAILURE | Supabase query returned an error | ERROR | Blocking (error box) | Log + Alert |
| RLS_DENIED | Row Level Security prevented data access | WARN | Contextual (error box with hint) | Log + Monitor |
| SCHEMA_CONTRACT_VIOLATION | Query referenced non-existent table or column | CRITICAL | Blocking (error box) | Log + Alert |
| ORDER_BY_SAFETY_RISK | ORDER BY column may be null or missing | ERROR | Silent (graceful degradation) | Log + Alert |
| REFERENCE_ORPHANED | Foreign key points to deleted entity | INFO | Contextual (displays "—") | Log |
| UNKNOWN_RUNTIME_ERROR | Unclassified exception caught | ERROR | Blocking (generic error) | Log + Alert |

### A.2 Error Code Definitions

#### DATA_ABSENT_EXPECTED

- **Trigger:** Query returns `{ data: [], error: null, count: 0 }`
- **Context:** New workspace, filtered view with no matches, entity type not yet referenced
- **User sees:** AdLabEmptyState with explanation
- **Action required:** None
- **Log level:** DEBUG

#### DATA_ABSENT_UNEXPECTED

- **Trigger:** Query returns empty where context suggests data should exist
- **Context:** Alert detail page where trace entities are missing, overview counts all zero after data ingestion
- **User sees:** AdLabEmptyState or "—" indicators
- **Action required:** Monitor for patterns
- **Log level:** INFO

#### QUERY_FAILURE

- **Trigger:** Supabase returns `{ data: null, error: { message: '...' } }`
- **Context:** Network failure, database unavailable, syntax error
- **User sees:** AdLabErrorBox with neutral message
- **Action required:** Investigate root cause
- **Log level:** ERROR

#### RLS_DENIED

- **Trigger:** Query error contains "permission denied" or "RLS" indicator
- **Context:** User attempting to access data outside their workspace
- **User sees:** AdLabErrorBox with "access restricted" hint
- **Action required:** Verify RLS policies
- **Log level:** WARN

#### SCHEMA_CONTRACT_VIOLATION

- **Trigger:** Query error contains "relation does not exist" or "column does not exist"
- **Context:** Migration not applied, schema drift
- **User sees:** AdLabErrorBox with generic error
- **Action required:** Immediate schema verification
- **Log level:** CRITICAL

#### ORDER_BY_SAFETY_RISK

- **Trigger:** Query on table where ORDER BY column has null values
- **Context:** Data inserted without defaults, migration incomplete
- **User sees:** Results may appear unsorted (silent degradation)
- **Action required:** Data cleanup required
- **Log level:** ERROR

#### REFERENCE_ORPHANED

- **Trigger:** Foreign key lookup returns null for non-null ID
- **Context:** Referenced entity was deleted, cascade failed
- **User sees:** "—" in place of entity name/details
- **Action required:** Monitor for frequency
- **Log level:** INFO

#### UNKNOWN_RUNTIME_ERROR

- **Trigger:** Exception caught that doesn't match known patterns
- **Context:** Unexpected code path, edge case
- **User sees:** Generic error message
- **Action required:** Classify and add to taxonomy
- **Log level:** ERROR

---

## B. Runtime Guardrails

### B.1 Empty Data Handling

| Scenario | Guardrail Behavior | UI Rendering |
|----------|-------------------|--------------|
| Zero rows from list query | Return `{ data: [], count: 0 }` | AdLabEmptyState |
| Zero rows from filtered query | Return `{ data: [], count: 0 }` | Filter scope indicator + AdLabEmptyState |
| Single item not found | Return `{ data: null, error: 'Not found' }` | Error page or redirect |
| Count query returns zero | Return count as 0 | Display "0" in count badge |

**Message Rules:**
- Never say "No data found" (blaming)
- Always explain why empty state exists
- Provide context about what would populate the view

### B.2 Partial Join Handling

| Scenario | Guardrail Behavior | UI Rendering |
|----------|-------------------|--------------|
| LEFT JOIN returns null relation | Map to null in result | Display "—" or omit field |
| Nested relation missing | Safely access with optional chaining | Display "—" |
| Array relation empty | Return empty array | Display "None" or empty list |

**Fallback Rendering Rules:**
- Missing text fields: Display "—"
- Missing numeric fields: Display "—" (not 0)
- Missing date fields: Display "—"
- Missing URL fields: Omit link entirely

### B.3 Missing Optional Relations

| Relation | Expected Behavior | Fallback Display |
|----------|-------------------|------------------|
| alert.rule_id → alert_rules | Query skipped if null | Rule section hidden or "—" |
| alert.campaign_id → campaigns | Query skipped if null | Campaign shows "—" |
| alert.ad_set_id → ad_sets | Query skipped if null | Ad Set shows "—" |
| alert.ad_id → ads | Query skipped if null | Ad shows "—" |
| campaign.client_id → clients | LEFT JOIN, may return null | Client name shows "—" |

### B.4 Missing Required Relations

| Relation | Expected Behavior | Failure Mode |
|----------|-------------------|--------------|
| alert.client_id → clients | Must exist | REFERENCE_ORPHANED logged, "—" displayed |
| alert.workspace_id → workspaces | Must exist | REFERENCE_ORPHANED logged, "—" displayed |
| ad_sets.campaign_id → campaigns | Must exist | Query may fail, error returned |
| ads.ad_set_id → ad_sets | Must exist | Query may fail, error returned |

### B.5 Failed ORDER BY

| Scenario | Detection | Response |
|----------|-----------|----------|
| ORDER BY column is null | Query succeeds with unpredictable order | Log ORDER_BY_SAFETY_RISK |
| ORDER BY column missing | Query fails | Return SCHEMA_CONTRACT_VIOLATION |
| Index missing on ORDER BY | Query slow but succeeds | No runtime detection (monitor latency) |

### B.6 Query Timeout

| Scenario | Detection | Response |
|----------|-----------|----------|
| Supabase timeout | Error contains timeout indicator | Return QUERY_FAILURE |
| Network timeout | Fetch exception | Return UNKNOWN_RUNTIME_ERROR |

**UI Behavior:** Display AdLabErrorBox with message: "Unable to load data. Please try again."

### B.7 Supabase Error Responses

| Error Pattern | Classification | Response |
|---------------|----------------|----------|
| `PGRST` prefix | PostgREST error | QUERY_FAILURE |
| `relation does not exist` | Missing table | SCHEMA_CONTRACT_VIOLATION |
| `column does not exist` | Missing column | SCHEMA_CONTRACT_VIOLATION |
| `permission denied` | RLS block | RLS_DENIED |
| `JWT` or `auth` | Auth failure | QUERY_FAILURE |
| `timeout` | Timeout | QUERY_FAILURE |
| Other | Unknown | UNKNOWN_RUNTIME_ERROR |

---

## C. UI Error Boundary Strategy

### C.1 Error Boundary Placement

| Level | Boundary Present | Rationale |
|-------|------------------|-----------|
| App root | YES | Catch catastrophic failures |
| Dashboard layout | YES | Isolate AdLab from rest of app |
| AdLab page level | NO | Server Components handle errors via return values |
| Component level | NO | Too granular, causes UI fragmentation |

### C.2 What Error Boundaries Catch

| Caught | Not Caught |
|--------|------------|
| React render errors | Server-side query errors |
| Client component exceptions | Data validation errors |
| Hydration mismatches | Expected empty states |
| Event handler crashes | Network errors (handled by queries) |

### C.3 What Error Boundaries NEVER Catch

- Empty data states (not errors)
- Missing optional relations (handled gracefully)
- Filtered views with no results (not errors)
- User-initiated actions that succeed with warnings

### C.4 User-Facing Error Display

| Error Type | User Sees |
|------------|-----------|
| Page-level crash | "Something went wrong. Please refresh the page." |
| Query failure | AdLabErrorBox with neutral message |
| Schema violation | AdLabErrorBox with "Unable to load data" |
| Unknown error | Generic error with refresh suggestion |

**Forbidden in UI:**
- Stack traces
- Error codes
- Technical terms (SQL, RLS, schema, query)
- Blame language ("You did something wrong")
- Internal system names

### C.5 Logging from Error Boundaries

| Data | Logged | Not Logged |
|------|--------|------------|
| Error message | YES | - |
| Error stack | YES (server only) | - |
| Component tree | YES | - |
| User ID | NO | Privacy |
| Request body | NO | Privacy |
| Auth tokens | NO | Security |

---

## D. Error Message Templates

### D.1 Neutral Message Patterns

| Context | Message |
|---------|---------|
| Query failure | "Unable to load data. Please try again." |
| Not found | "This item could not be found." |
| Permission | "You don't have access to this content." |
| Generic | "Something went wrong. Please refresh the page." |
| Empty (expected) | Handled by AdLabEmptyState (context-specific) |

### D.2 Hint Patterns

| Context | Hint |
|---------|------|
| RLS error | "This may be due to access policies." |
| Empty after filter | "Try adjusting your filters." |
| Schema error | "The system may be updating. Please try again shortly." |

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D5.1 | 2024-12-28 | Initial observability specification |
