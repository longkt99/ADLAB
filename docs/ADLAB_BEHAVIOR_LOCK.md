# AdLab Behavior Lock — Product Invariants

**Lock Date:** 2024-12-28
**Lock Version:** D4.2
**Status:** NON-NEGOTIABLE

---

## 1. Data Source of Truth

### 1.1 Alerts as Central Driver

The AdLab module operates on a single principle:

**Alerts are the primary data driver. All other entities exist to provide context for alerts.**

| Entity | Role | Relationship to Alerts |
|--------|------|------------------------|
| Alerts | PRIMARY | Source of user action |
| Clients | CONTEXT | Owner of alerts |
| Campaigns | CONTEXT | Scope of alerts |
| Ad Sets | CONTEXT | Scope of alerts |
| Ads | CONTEXT | Scope of alerts |
| Daily Metrics | CONTEXT | Evidence for alerts |
| Demographic Metrics | CONTEXT | Evidence for alerts |
| Alert Rules | CONTEXT | Origin of alerts |
| Reports | OUTPUT | Derived from alert activity |

### 1.2 Entity Relationship Invariants

```
INVARIANT: An alert MUST have a client_id
INVARIANT: An alert MAY have campaign_id, ad_set_id, ad_id (nullable)
INVARIANT: Entity pages display data referenced by alerts
INVARIANT: Empty entity pages indicate no alert-referenced entities
```

### 1.3 Data Flow Direction

```
Alert Rules → Generate → Alerts
Alerts → Reference → Entities (Client, Campaign, Ad Set, Ad)
Alerts → Evidence → Metrics
Reports → Summarize → Alert Activity
```

Data never flows in reverse. Entities do not generate alerts directly.

---

## 2. UX Cognitive Guarantees

### 2.1 Empty States ALWAYS Explain Context

| Page | Empty State Requirement |
|------|------------------------|
| /ads/alerts | "No alerts yet" + explanation of what generates alerts |
| /ads/alerts (filtered) | Filter scope indicator + "No alerts match filters" |
| /ads/clients | "No clients yet" + explanation that entities appear via alerts |
| /ads/campaigns | "No campaigns yet" + explanation that entities appear via alerts |
| /ads/ad-sets | "No ad sets yet" + explanation that entities appear via alerts |
| /ads/ads | "No ads yet" + explanation that entities appear via alerts |
| /ads/metrics | Both sections show empty states independently |
| /ads/reports | "No reports yet" + explanation of report generation |

**INVARIANT:** No AdLab page may render an empty table without an accompanying AdLabEmptyState component.

### 2.2 No Screen Is Allowed to Be Silent

| State | Required UI Element |
|-------|---------------------|
| Zero data | AdLabEmptyState with title + description |
| Error state | AdLabErrorBox with message + hint |
| Loading state | Implicit (Server Component) |
| Filtered with no results | Filter scope indicator + empty state |
| Data present | AdLabTable with cognitive explanation |

**INVARIANT:** Every page state must communicate to the user why they see what they see.

### 2.3 Filters Must Never Cause Disorientation

| Filter Behavior | Requirement |
|-----------------|-------------|
| URL persistence | Filters stored in URL searchParams |
| State visibility | Active filters shown in filter scope indicator |
| Clear path | User can reset to "all" for any filter |
| No hidden state | Filter chips visible when non-default |

**INVARIANT:** A user can always determine:
- What filters are active
- How to remove filters
- Why results are limited

---

## 3. Runtime Guarantees

### 3.1 Zero-Data Tolerance

All query functions MUST return safely with zero data:

| Function | Zero-Data Return |
|----------|------------------|
| getClients() | `{ data: [], error: null, count: 0 }` |
| getCampaigns() | `{ data: [], error: null, count: 0 }` |
| getAdSets() | `{ data: [], error: null, count: 0 }` |
| getAds() | `{ data: [], error: null, count: 0 }` |
| getDailyMetrics() | `{ data: [], error: null, count: 0 }` |
| getDemographicMetrics() | `{ data: [], error: null, count: 0 }` |
| getAlerts() | `{ data: [], error: null, count: 0 }` |
| getAlertsFiltered() | `{ data: [], error: null, count: 0 }` |
| getReports() | `{ data: [], error: null, count: 0 }` |
| getAlertRules() | `{ data: [], error: null, count: 0 }` |
| getAlertById() | `{ data: null, error: 'message' }` |
| getAlertTrace() | `{ data: null, error: 'Alert not found' }` |
| getOverviewCounts() | All counts = 0, error = null |

**INVARIANT:** No query function throws to the UI. All errors are caught and returned in the result object.

### 3.2 Orphan Reference Handling

When an alert references a deleted entity:

| Scenario | UI Display | System Behavior |
|----------|------------|-----------------|
| Missing client | "—" in trace | getAlertTrace returns null for client |
| Missing campaign | "—" in trace | getAlertTrace returns null for campaign |
| Missing ad_set | "—" in trace | getAlertTrace returns null for adSet |
| Missing ad | "—" in trace | getAlertTrace returns null for ad |
| Missing rule | "—" in trace | getAlertTrace returns null for rule |

**INVARIANT:** Orphan references display gracefully. The UI never crashes due to missing referenced entities.

### 3.3 ORDER BY Safety Rules

| Table | ORDER BY Column | Nullability | Default |
|-------|-----------------|-------------|---------|
| clients | created_at | NOT NULL | NOW() |
| campaigns | created_at | NOT NULL | NOW() |
| ad_sets | first_seen_at | NOT NULL | NOW() |
| ads | first_seen_at | NOT NULL | NOW() |
| daily_metrics | date | NOT NULL | Required |
| demographic_metrics | date | NOT NULL | Required |
| alerts | created_at | NOT NULL | NOW() |
| alert_rules | created_at | NOT NULL | NOW() |
| reports | created_at | NOT NULL | NOW() |

**INVARIANT:** ORDER BY columns are never null. Queries cannot fail due to null sort keys.

---

## 4. What Must NEVER Happen

### 4.1 Silent Empty Tables

```
FORBIDDEN: Rendering <AdLabTable> with data=[] without accompanying empty state
FORBIDDEN: Rendering a page with zero visual feedback when no data exists
FORBIDDEN: Removing cognitive explanations from entity pages
```

### 4.2 UI Depending on Non-Verified Schema

```
FORBIDDEN: Adding a query that references a column not in ADLAB_SCHEMA_CONTRACT.md
FORBIDDEN: Using a column in ORDER BY without index verification
FORBIDDEN: Assuming a column is NOT NULL without schema confirmation
```

### 4.3 Feature Logic Bypassing Alerts

```
FORBIDDEN: Creating entity records directly without alert context
FORBIDDEN: Displaying entities not referenced by alerts
FORBIDDEN: Building features that operate outside the alert-driven model
```

### 4.4 Breaking Query Contracts

```
FORBIDDEN: Changing query return types
FORBIDDEN: Adding required parameters to existing functions
FORBIDDEN: Modifying error handling to throw instead of return
```

### 4.5 User Disorientation

```
FORBIDDEN: Filters that persist without URL representation
FORBIDDEN: State changes without visual feedback
FORBIDDEN: Actions that succeed silently
FORBIDDEN: Empty results without explanation
```

---

## 5. Invariant Verification

To verify invariant compliance:

### Schema Invariants
```sql
-- All ORDER BY columns are NOT NULL with defaults
SELECT table_name, column_name, is_nullable, column_default
FROM information_schema.columns
WHERE (table_name, column_name) IN (
  ('clients', 'created_at'),
  ('campaigns', 'created_at'),
  ('ad_sets', 'first_seen_at'),
  ('ads', 'first_seen_at'),
  ('alerts', 'created_at'),
  ('reports', 'created_at'),
  ('alert_rules', 'created_at')
);
```

### Code Invariants
```
[ ] All query functions have try/catch
[ ] All query functions return error in result object
[ ] All pages use AdLabEmptyState for zero-data
[ ] All pages use AdLabErrorBox for errors
[ ] All entity pages have cognitive explanations
```

---

## Document Control

| Version | Date | Change |
|---------|------|--------|
| D4.2 | 2024-12-28 | Initial behavior lock |
