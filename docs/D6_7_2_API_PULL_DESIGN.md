# D6.7.2 — API Pull Ingestion Design

**Version:** D6.7.2
**Date:** 2024-12-28
**Status:** PRE-IMPLEMENTATION CONTRACT
**Classification:** PLATFORM INTEGRATION DESIGN
**Dependencies:**
- D6.4 Ingestion Architecture Design (FROZEN)
- D6.5 Ingestion Execution Blueprint (FROZEN)
- D6.6 Alert Evaluation Runtime (FROZEN)
- D6.7.1 Ingestion Boundary & Scheduling (FROZEN)

---

## 1. Platform Abstraction Model

### 1.1 Unified Platform Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PLATFORM ABSTRACTION LAYER                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    PlatformAdapter Interface                         │   │
│  │                                                                      │   │
│  │  authenticate(credentials): AuthResult                               │   │
│  │  refreshToken(token): AuthResult                                     │   │
│  │  fetchCampaigns(account, dateRange): Campaign[]                      │   │
│  │  fetchAdSets(account, campaignIds, dateRange): AdSet[]               │   │
│  │  fetchAds(account, adSetIds, dateRange): Ad[]                        │   │
│  │  fetchDailyMetrics(account, entityIds, dateRange): DailyMetric[]     │   │
│  │  fetchDemographicMetrics(account, entityIds, dateRange): DemoMetric[]│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│              ┌─────────────────────┼─────────────────────┐                 │
│              │                     │                     │                 │
│              ▼                     ▼                     ▼                 │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐        │
│  │   MetaAdapter     │ │   GoogleAdapter   │ │   TikTokAdapter   │        │
│  │                   │ │                   │ │                   │        │
│  │ • Graph API v18+  │ │ • Google Ads API  │ │ • TikTok Marketing│        │
│  │ • OAuth 2.0       │ │ • OAuth 2.0       │ │ • OAuth 2.0       │        │
│  │ • Rate: 200/hr    │ │ • Rate: 15k/day   │ │ • Rate: 600/min   │        │
│  └───────────────────┘ └───────────────────┘ └───────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Common Interface Contract

```
PlatformAdapter {
  // Identity
  platform: 'meta' | 'google' | 'tiktok'
  apiVersion: string

  // Authentication
  authenticate(credentials: Credentials): Promise<AuthResult>
  refreshToken(token: RefreshableToken): Promise<AuthResult>
  isTokenValid(token: Token): boolean
  getTokenExpiryBuffer(): Duration  // Time before expiry to refresh

  // Entity Fetching
  fetchCampaigns(request: CampaignRequest): Promise<PaginatedResult<Campaign>>
  fetchAdSets(request: AdSetRequest): Promise<PaginatedResult<AdSet>>
  fetchAds(request: AdRequest): Promise<PaginatedResult<Ad>>

  // Metrics Fetching
  fetchDailyMetrics(request: MetricRequest): Promise<PaginatedResult<DailyMetric>>
  fetchDemographicMetrics(request: DemoMetricRequest): Promise<PaginatedResult<DemoMetric>>

  // Rate Limiting
  getRateLimitStatus(): RateLimitStatus
  getRecommendedDelay(): Duration

  // Error Handling
  classifyError(error: APIError): ErrorClassification
  isRetryable(error: APIError): boolean
}
```

### 1.3 Platform Capability Matrix

| Capability | Meta | Google | TikTok |
|------------|------|--------|--------|
| Campaign fetch | YES | YES | YES |
| Ad Set fetch | YES (as AdSet) | YES (as AdGroup) | YES (as AdGroup) |
| Ad fetch | YES | YES | YES |
| Daily metrics | YES | YES | YES |
| Demographic metrics | YES | YES | LIMITED |
| Hourly metrics | YES | NO | YES |
| Real-time metrics | NO | NO | NO |
| Historical backfill | 37 months | 2 years | 365 days |
| Incremental sync | YES (since timestamp) | YES (change history) | YES (since timestamp) |
| Webhook notifications | YES (limited) | NO | YES (limited) |

### 1.4 Platform-Specific Capability Flags

```
PlatformCapabilities {
  // Entity Capabilities
  supportsAdSetLevel: boolean
  supportsCreativeLevel: boolean
  supportsAudienceLevel: boolean

  // Metric Capabilities
  supportsDemographicBreakdown: boolean
  supportsHourlyMetrics: boolean
  supportsRealTimeMetrics: boolean
  supportsConversionWindows: boolean

  // Sync Capabilities
  supportsIncrementalSync: boolean
  supportsWebhook: boolean
  maxHistoricalDays: number

  // Rate Limits
  requestsPerHour: number | null
  requestsPerDay: number | null
  requestsPerMinute: number | null
}

MetaCapabilities = {
  supportsAdSetLevel: true,
  supportsCreativeLevel: true,
  supportsAudienceLevel: false,
  supportsDemographicBreakdown: true,
  supportsHourlyMetrics: true,
  supportsRealTimeMetrics: false,
  supportsIncrementalSync: true,
  supportsWebhook: true,
  maxHistoricalDays: 1095,  // ~37 months
  requestsPerHour: 200,
  requestsPerDay: null,
  requestsPerMinute: null
}

GoogleCapabilities = {
  supportsAdSetLevel: true,  // AdGroup
  supportsCreativeLevel: true,
  supportsAudienceLevel: true,
  supportsDemographicBreakdown: true,
  supportsHourlyMetrics: false,
  supportsRealTimeMetrics: false,
  supportsIncrementalSync: true,
  supportsWebhook: false,
  maxHistoricalDays: 730,  // 2 years
  requestsPerHour: null,
  requestsPerDay: 15000,
  requestsPerMinute: null
}

TikTokCapabilities = {
  supportsAdSetLevel: true,  // AdGroup
  supportsCreativeLevel: false,
  supportsAudienceLevel: false,
  supportsDemographicBreakdown: true,  // Limited
  supportsHourlyMetrics: true,
  supportsRealTimeMetrics: false,
  supportsIncrementalSync: true,
  supportsWebhook: true,
  maxHistoricalDays: 365,
  requestsPerHour: null,
  requestsPerDay: null,
  requestsPerMinute: 600
}
```

### 1.5 Authentication Model

```
Credentials {
  platform: 'meta' | 'google' | 'tiktok'
  workspace_id: uuid
  client_id: uuid

  // OAuth tokens
  access_token: string (encrypted)
  refresh_token: string (encrypted)
  token_expiry: timestamp

  // Platform-specific identifiers
  account_id: string        # Meta: ad_account_id, Google: customer_id, TikTok: advertiser_id
  business_id: string | null  # Meta: business_id, Google: manager_id
}

AuthResult {
  success: boolean
  access_token: string | null
  refresh_token: string | null
  expires_at: timestamp | null
  error: AuthError | null
}
```

### 1.6 Token Refresh Strategy

| Platform | Token Lifetime | Refresh Window | Refresh Method |
|----------|----------------|----------------|----------------|
| Meta | 60 days (long-lived) | 7 days before expiry | Exchange endpoint |
| Google | 1 hour (access token) | 5 minutes before expiry | Refresh token |
| TikTok | 24 hours | 1 hour before expiry | Refresh token |

**Refresh Flow:**

```
FUNCTION ensureValidToken(credentials):
  IF credentials.token_expiry IS NULL:
    RETURN ERROR("No token available")

  buffer = adapter.getTokenExpiryBuffer()

  IF now() + buffer >= credentials.token_expiry:
    # Token needs refresh
    result = adapter.refreshToken(credentials.refresh_token)

    IF result.success:
      UPDATE credentials SET
        access_token = result.access_token,
        refresh_token = result.refresh_token OR credentials.refresh_token,
        token_expiry = result.expires_at
      RETURN credentials
    ELSE:
      LOG ERROR("Token refresh failed", result.error)
      RETURN ERROR("Token refresh failed")

  RETURN credentials  # Token still valid
```

---

## 2. Time Window & Incremental Pull

### 2.1 Date Range Semantics

| Term | Definition |
|------|------------|
| sync_date | The calendar date being synced (metric_date) |
| pull_date | The date when the pull is executed (today) |
| lookback_window | Number of days to look back from pull_date |
| data_availability_lag | Platform-specific delay before data is available |

### 2.2 Platform Data Availability

| Platform | Data Availability Lag | Recommendation |
|----------|----------------------|----------------|
| Meta | 0-4 hours | Sync T-1 day minimum |
| Google | 12-24 hours | Sync T-1 day minimum |
| TikTok | 0-6 hours | Sync T-1 day minimum |

**Implication:** Do not sync today's data (T+0) as it is incomplete.

### 2.3 Lookback Window Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOOKBACK WINDOW STRATEGY                                 │
│                                                                             │
│  Pull Date: 2024-12-28                                                      │
│  Lookback Window: 7 days                                                    │
│                                                                             │
│  Day:   T-7    T-6    T-5    T-4    T-3    T-2    T-1    T+0               │
│        12/21  12/22  12/23  12/24  12/25  12/26  12/27  12/28              │
│          │      │      │      │      │      │      │      │                │
│          ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼                │
│        [──────────── SYNC WINDOW ─────────────────]   [SKIP]               │
│                                                                             │
│  Sync Range: 2024-12-21 to 2024-12-27 (inclusive)                          │
│  Excluded: 2024-12-28 (today, data incomplete)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Incremental Pull Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| FULL | Fetch all data in lookback window | Initial sync, recovery |
| INCREMENTAL | Fetch only changed data since last sync | Daily scheduled sync |
| DELTA | Fetch specific date range | Targeted backfill |

**Incremental Pull Logic:**

```
FUNCTION determineIncrementalRange(schedule, last_successful_sync):
  IF last_successful_sync IS NULL:
    # First sync - use full lookback
    RETURN {
      mode: 'FULL',
      start_date: today - schedule.lookback_days,
      end_date: today - 1
    }

  days_since_last_sync = today - last_successful_sync.end_date

  IF days_since_last_sync > schedule.lookback_days:
    # Too long since last sync - use full lookback
    RETURN {
      mode: 'FULL',
      start_date: today - schedule.lookback_days,
      end_date: today - 1
    }

  # Incremental: sync from day after last sync
  RETURN {
    mode: 'INCREMENTAL',
    start_date: last_successful_sync.end_date,  # Re-sync last day for corrections
    end_date: today - 1
  }
```

### 2.5 Late-Arriving Data Handling

**Problem:** Platforms may update historical metrics after initial reporting.

| Platform | Update Window | Typical Updates |
|----------|---------------|-----------------|
| Meta | Up to 28 days | Conversions, attribution |
| Google | Up to 30 days | Conversion tracking |
| TikTok | Up to 7 days | Final spend reconciliation |

**Solution: Rolling Re-sync**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LATE-ARRIVING DATA STRATEGY                               │
│                                                                             │
│  Standard Lookback: 7 days                                                  │
│  Attribution Window: 28 days (Meta conversions)                             │
│                                                                             │
│  Sync Schedule:                                                             │
│  ─────────────                                                              │
│  Daily run:    Sync T-7 to T-1 (7 days)                                    │
│  Weekly run:   Sync T-28 to T-1 (28 days) ← captures late conversions      │
│  Monthly run:  Full historical check (optional)                             │
│                                                                             │
│  Result: Conversions that arrive late are captured on weekly run            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.6 Idempotent Re-Pull Guarantee

**Guarantee:** Re-pulling the same date range produces identical results without duplicates.

**Mechanism:**

| Layer | Idempotency Enforcement |
|-------|------------------------|
| API response | Same request = same data (deterministic) |
| Normalization | Same input = same normalized output |
| Upsert | Natural key ensures no duplicates |
| Metrics | Composite key (date + entity) unique |

**Re-Pull Safety Contract:**

```
FOR any date_range [D1, D2]:
  pull_1 = adapter.fetchMetrics(account, entity, [D1, D2])
  # ... time passes, data may be updated by platform ...
  pull_2 = adapter.fetchMetrics(account, entity, [D1, D2])

  # After both pulls processed:
  # - No duplicate rows in daily_metrics
  # - Metric values reflect most recent pull (pull_2)
  # - Historical audit via updated_at timestamps
```

---

## 3. Entity Pull Order

### 3.1 Strict Pull Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ENTITY PULL SEQUENCE                                    │
│                                                                             │
│  PHASE 1: DIMENSIONS                                                        │
│  ────────────────────                                                       │
│                                                                             │
│  Step 1: Campaigns                                                          │
│          └── No dependencies                                                │
│          └── Produces: campaign_external_id → campaign_internal_id map     │
│                                                                             │
│  Step 2: Ad Sets                                                            │
│          └── Requires: campaign_internal_id map                             │
│          └── Produces: ad_set_external_id → ad_set_internal_id map         │
│                                                                             │
│  Step 3: Ads                                                                │
│          └── Requires: ad_set_internal_id map                               │
│          └── Produces: ad_external_id → ad_internal_id map                 │
│                                                                             │
│  PHASE 2: FACTS                                                             │
│  ────────────────                                                           │
│                                                                             │
│  Step 4: Daily Metrics                                                      │
│          └── Requires: entity_internal_id maps (for FK resolution)         │
│          └── Can proceed with partial maps (orphan metrics logged)         │
│                                                                             │
│  Step 5: Demographic Metrics                                                │
│          └── Requires: entity_internal_id maps                              │
│          └── Can proceed with partial maps                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Dependency Handling

| Step | Hard Dependencies | Soft Dependencies |
|------|-------------------|-------------------|
| Campaigns | None | None |
| Ad Sets | Campaigns completed | None |
| Ads | Ad Sets completed | None |
| Daily Metrics | None (can orphan) | All dimensions |
| Demo Metrics | None (can orphan) | All dimensions |

### 3.3 Partial Availability Rules

**Scenario:** Not all entities are available (API error, new entities).

| Scenario | Behavior |
|----------|----------|
| Campaign fetch fails | ABORT (no child entities possible) |
| Some campaigns fail | CONTINUE with successful campaigns |
| Ad Set fetch fails | CONTINUE (use cached mappings) |
| Ad fetch fails | CONTINUE (metrics still valuable) |
| Daily metrics fail | CONTINUE (demo metrics independent) |
| Demo metrics fail | COMPLETE (not critical) |

### 3.4 Entity Pull Contract

```
EntityPullResult {
  phase: 'DIMENSIONS' | 'FACTS'
  step: 'campaigns' | 'ad_sets' | 'ads' | 'daily_metrics' | 'demographic_metrics'
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED'

  entities_fetched: number
  entities_skipped: number
  entities_failed: number

  id_mappings: Map<external_id, internal_id>
  errors: EntityError[]

  can_continue: boolean
  next_step: string | null
}

FUNCTION executeEntityPull(step, context):
  result = EntityPullResult { step: step }

  TRY:
    entities = adapter.fetch{Step}(context.account, context.date_range)
    result.entities_fetched = entities.length

    FOR entity IN entities:
      normalized = normalizer.normalize(entity)
      upsert_result = upserter.upsert(normalized)

      IF upsert_result.success:
        result.id_mappings[entity.external_id] = upsert_result.internal_id
      ELSE:
        result.entities_failed++
        result.errors.append(upsert_result.error)

    result.status = IF result.entities_failed == 0 THEN 'SUCCESS'
                    ELSE IF result.entities_fetched > 0 THEN 'PARTIAL'
                    ELSE 'FAILED'

  CATCH error:
    result.status = 'FAILED'
    result.errors.append(error)

  result.can_continue = determineContinuation(step, result.status)
  result.next_step = getNextStep(step)

  RETURN result
```

### 3.5 Orphan Metric Handling

When metrics reference entities not in the ID map:

| Scenario | Resolution |
|----------|------------|
| Metric references unknown campaign | Set campaign_id = NULL, log warning |
| Metric references unknown ad_set | Set ad_set_id = NULL, log warning |
| Metric references unknown ad | Set ad_id = NULL, log warning |
| All entity references unknown | Insert as workspace-level metric |

**Orphan Tracking:**

```
OrphanMetric {
  upload_id: uuid
  metric_date: date
  entity_type: 'campaign' | 'ad_set' | 'ad'
  external_id: string
  reason: 'NOT_FOUND' | 'FETCH_FAILED' | 'DELETED'
}

# Orphans can be resolved on next full sync when entities are available
```

---

## 4. Pagination & Volume Control

### 4.1 Pagination Strategy Per Platform

| Platform | Pagination Type | Page Size | Cursor Type |
|----------|----------------|-----------|-------------|
| Meta | Cursor-based | 500 (max 1000) | after cursor |
| Google | Page token | 10000 | nextPageToken |
| TikTok | Offset-based | 1000 (max 1000) | page + page_size |

### 4.2 Unified Pagination Interface

```
PaginatedRequest {
  page_size: number
  cursor: string | null
  offset: number | null
}

PaginatedResult<T> {
  data: T[]
  has_more: boolean
  next_cursor: string | null
  total_count: number | null  # If available
}

FUNCTION fetchAllPages<T>(adapter, request, maxRecords):
  all_results = []
  current_request = { ...request, cursor: null, offset: 0 }

  WHILE TRUE:
    page = adapter.fetch(current_request)
    all_results.extend(page.data)

    # Volume control
    IF all_results.length >= maxRecords:
      LOG WARN("Max records reached", { fetched: all_results.length, max: maxRecords })
      BREAK

    # Pagination control
    IF NOT page.has_more:
      BREAK

    # Prepare next page
    IF page.next_cursor:
      current_request.cursor = page.next_cursor
    ELSE:
      current_request.offset += current_request.page_size

    # Rate limit respect
    SLEEP(adapter.getRecommendedDelay())

  RETURN all_results
```

### 4.3 Page Size Strategy

| Entity Type | Recommended Size | Max Size | Rationale |
|-------------|------------------|----------|-----------|
| Campaigns | 500 | 1000 | Typically < 100 per account |
| Ad Sets | 500 | 1000 | Moderate volume |
| Ads | 500 | 1000 | High volume possible |
| Daily Metrics | 1000 | 10000 | Bulk data transfer |
| Demo Metrics | 1000 | 10000 | High cardinality |

### 4.4 Volume Control Limits

| Limit Type | Default | Max | Purpose |
|------------|---------|-----|---------|
| Max campaigns per pull | 10,000 | 50,000 | Memory protection |
| Max ad sets per pull | 50,000 | 100,000 | Memory protection |
| Max ads per pull | 100,000 | 500,000 | Memory protection |
| Max metric rows per pull | 1,000,000 | 5,000,000 | Memory protection |
| Max API calls per pull | 1,000 | 5,000 | Time protection |

### 4.5 Early Stop Conditions

| Condition | Behavior |
|-----------|----------|
| Max records reached | Stop pagination, log warning, mark partial |
| Max API calls reached | Stop pagination, log warning, mark partial |
| Rate limit sustained | Stop pagination, schedule retry |
| Memory threshold | Stop pagination, flush to DB, continue |
| Timeout approaching | Stop pagination, persist progress, mark partial |

### 4.6 Progress Checkpointing

For large pulls, checkpoint progress to enable resume:

```
PullCheckpoint {
  upload_id: uuid
  step: string
  last_cursor: string | null
  last_offset: number | null
  entities_processed: number
  last_entity_id: string | null
  checkpoint_at: timestamp
}

FUNCTION checkpointProgress(context, pageResult):
  checkpoint = {
    upload_id: context.upload_id,
    step: context.current_step,
    last_cursor: pageResult.next_cursor,
    last_offset: context.offset,
    entities_processed: context.total_processed,
    last_entity_id: pageResult.data.last()?.external_id,
    checkpoint_at: now()
  }
  SAVE(checkpoint)

FUNCTION resumeFromCheckpoint(upload_id):
  checkpoint = LOAD(upload_id)
  IF checkpoint IS NULL:
    RETURN NULL

  # Resume from last checkpoint
  RETURN {
    step: checkpoint.step,
    cursor: checkpoint.last_cursor,
    offset: checkpoint.last_offset,
    skip_count: checkpoint.entities_processed
  }
```

---

## 5. Data Normalization Contract

### 5.1 Field Mapping Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NORMALIZATION PIPELINE                                   │
│                                                                             │
│  Platform Response                     Internal Schema                       │
│  ─────────────────                     ───────────────                      │
│                                                                             │
│  Meta Campaign {                       Campaign {                           │
│    id: "23847293847"          →          external_id: "23847293847"        │
│    name: "Summer Sale"        →          name: "Summer Sale"               │
│    objective: "CONVERSIONS"   →          objective: "conversions"          │
│    status: "ACTIVE"           →          status: "active"                  │
│    start_time: "2024-06-01"   →          start_date: "2024-06-01"          │
│    stop_time: null            →          end_date: null                    │
│  }                                     }                                    │
│                                                                             │
│  Google Campaign {                     Campaign {                           │
│    resourceName: "cust/123/   →          external_id: "789"                │
│      campaigns/789"                                                         │
│    name: "Summer Sale"        →          name: "Summer Sale"               │
│    advertisingChannel: "SEARCH"→         objective: "search"               │
│    status: "ENABLED"          →          status: "active"                  │
│  }                                     }                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Required vs Optional Fields

**Campaign Fields:**

| Internal Field | Required | Meta | Google | TikTok |
|----------------|----------|------|--------|--------|
| external_id | YES | id | resourceName (parsed) | campaign_id |
| name | YES | name | name | campaign_name |
| objective | NO | objective | advertisingChannel | objective_type |
| status | YES | status | status | status |
| start_date | NO | start_time | startDate | create_time |
| end_date | NO | stop_time | endDate | N/A |

**Ad Set Fields:**

| Internal Field | Required | Meta | Google | TikTok |
|----------------|----------|------|--------|--------|
| external_id | YES | id | resourceName (parsed) | adgroup_id |
| campaign_external_id | YES | campaign_id | campaign (parsed) | campaign_id |
| name | YES | name | name | adgroup_name |
| status | YES | status | status | status |
| daily_budget | NO | daily_budget | dailyBudget.amountMicros | budget |
| lifetime_budget | NO | lifetime_budget | budget.amountMicros | N/A |
| bid_strategy | NO | bid_strategy | biddingStrategy | bid_type |

**Ad Fields:**

| Internal Field | Required | Meta | Google | TikTok |
|----------------|----------|------|--------|--------|
| external_id | YES | id | resourceName (parsed) | ad_id |
| ad_set_external_id | YES | adset_id | adGroup (parsed) | adgroup_id |
| name | YES | name | name | ad_name |
| status | YES | status | status | status |
| creative_id | NO | creative.id | creative.id | creative_id |
| landing_page_url | NO | creative.object_story_spec.link_data.link | finalUrls[0] | landing_page_url |

**Daily Metric Fields:**

| Internal Field | Required | Meta | Google | TikTok |
|----------------|----------|------|--------|--------|
| metric_date | YES | date_start | segments.date | stat_time_day |
| impressions | YES | impressions | metrics.impressions | impression |
| clicks | YES | clicks | metrics.clicks | clicks |
| spend | YES | spend | metrics.costMicros / 1M | spend |
| conversions | NO | conversions | metrics.conversions | conversion |
| ctr | NO | ctr | computed | ctr |
| cpc | NO | cpc | metrics.averageCpc / 1M | cpc |
| cpm | NO | cpm | computed | cpm |

### 5.3 Status Normalization

| Internal Status | Meta | Google | TikTok |
|-----------------|------|--------|--------|
| active | ACTIVE | ENABLED | ENABLE |
| paused | PAUSED | PAUSED | DISABLE |
| deleted | DELETED | REMOVED | DELETE |
| archived | ARCHIVED | N/A | N/A |
| pending | PENDING_REVIEW | PENDING | PENDING |
| rejected | DISAPPROVED | REJECTED | REJECTED |

### 5.4 Currency Normalization

| Platform | Raw Format | Normalization |
|----------|------------|---------------|
| Meta | Cents (integer) | Divide by 100 |
| Google | Micros (integer) | Divide by 1,000,000 |
| TikTok | Standard (float) | No conversion |

```
FUNCTION normalizeCurrency(value, platform):
  IF value IS NULL:
    RETURN NULL

  SWITCH platform:
    CASE 'meta':
      RETURN value / 100
    CASE 'google':
      RETURN value / 1000000
    CASE 'tiktok':
      RETURN value
```

### 5.5 Date Normalization

| Platform | Raw Format | Normalization |
|----------|------------|---------------|
| Meta | "2024-12-28" or "2024-12-28T00:00:00+0000" | YYYY-MM-DD |
| Google | "2024-12-28" | YYYY-MM-DD |
| TikTok | "2024-12-28" or "20241228" | YYYY-MM-DD |

### 5.6 Missing Field Handling

| Scenario | Resolution |
|----------|------------|
| Required field NULL | REJECT record, log error |
| Optional field NULL | Set as NULL in internal record |
| Field not in API response | Set as NULL |
| Field deprecated by platform | Set as NULL, log deprecation warning |
| New field from platform | Ignore (not in internal schema) |

### 5.7 Platform-Specific Normalizers

```
Normalizer {
  platform: 'meta' | 'google' | 'tiktok'

  normalizeCampaign(raw): NormalizedCampaign
  normalizeAdSet(raw): NormalizedAdSet
  normalizeAd(raw): NormalizedAd
  normalizeDailyMetric(raw): NormalizedDailyMetric
  normalizeDemoMetric(raw): NormalizedDemoMetric

  // Helpers
  normalizeStatus(raw_status): InternalStatus
  normalizeCurrency(value): number
  normalizeDate(raw_date): ISO8601Date
  extractExternalId(resourceName): string  # For Google
}
```

---

## 6. Failure & Rate Limit Handling

### 6.1 Error Classification

| Error Category | Examples | Retryable | Max Retries |
|----------------|----------|-----------|-------------|
| AUTHENTICATION | Token expired, invalid credentials | NO* | 0 |
| AUTHORIZATION | Permission denied, account suspended | NO | 0 |
| RATE_LIMIT | 429, quota exceeded | YES | 5 |
| TRANSIENT | 500, 502, 503, 504, timeout | YES | 3 |
| CLIENT_ERROR | 400, invalid parameter | NO | 0 |
| NOT_FOUND | 404, entity deleted | NO | 0 |
| UNKNOWN | Unclassified error | YES | 1 |

*AUTHENTICATION: Retry only after token refresh

### 6.2 Platform-Specific Error Codes

**Meta:**

| Error Code | Category | Action |
|------------|----------|--------|
| 190 | AUTHENTICATION | Refresh token |
| 4 | RATE_LIMIT | Backoff |
| 17 | RATE_LIMIT | Backoff (account limit) |
| 613 | RATE_LIMIT | Backoff (call limit) |
| 1 | UNKNOWN | Retry once |
| 100 | CLIENT_ERROR | Log and skip |

**Google:**

| Error Code | Category | Action |
|------------|----------|--------|
| UNAUTHENTICATED | AUTHENTICATION | Refresh token |
| PERMISSION_DENIED | AUTHORIZATION | Stop, notify |
| RESOURCE_EXHAUSTED | RATE_LIMIT | Backoff |
| UNAVAILABLE | TRANSIENT | Retry |
| INTERNAL | TRANSIENT | Retry |
| INVALID_ARGUMENT | CLIENT_ERROR | Log and skip |

**TikTok:**

| Error Code | Category | Action |
|------------|----------|--------|
| 40001 | AUTHENTICATION | Refresh token |
| 40100 | RATE_LIMIT | Backoff |
| 50001 | TRANSIENT | Retry |
| 40000 | CLIENT_ERROR | Log and skip |

### 6.3 Retry Strategy

```
RetryConfig {
  max_attempts: 3
  initial_delay_ms: 1000
  max_delay_ms: 60000
  backoff_multiplier: 2
  jitter_factor: 0.1
}

FUNCTION executeWithRetry(operation, config):
  attempt = 0

  WHILE attempt < config.max_attempts:
    TRY:
      result = operation()
      RETURN result

    CATCH error:
      classification = classifyError(error)

      IF NOT classification.retryable:
        THROW error

      attempt++

      IF attempt >= config.max_attempts:
        THROW error

      delay = calculateDelay(attempt, config, error)
      LOG INFO("Retrying", { attempt, delay, error: error.code })
      SLEEP(delay)

FUNCTION calculateDelay(attempt, config, error):
  # Use Retry-After if available
  IF error.retryAfter:
    RETURN MIN(error.retryAfter * 1000, config.max_delay_ms)

  # Exponential backoff
  base_delay = config.initial_delay_ms * (config.backoff_multiplier ^ (attempt - 1))
  jitter = base_delay * config.jitter_factor * random()
  delay = MIN(base_delay + jitter, config.max_delay_ms)

  RETURN delay
```

### 6.4 Rate Limit Backoff Strategy

**Platform-Specific Backoff:**

| Platform | Rate Limit Type | Backoff Strategy |
|----------|-----------------|------------------|
| Meta | Requests/hour | Wait until hour reset OR Retry-After |
| Google | Requests/day | Wait until day reset OR progressive backoff |
| TikTok | Requests/minute | Wait 60 seconds minimum |

**Rate Limit State Tracking:**

```
RateLimitState {
  platform: string
  account_id: string
  requests_made: number
  window_start: timestamp
  window_duration_ms: number
  limit: number
  reset_at: timestamp | null
}

FUNCTION checkRateLimit(state):
  IF now() > state.window_start + state.window_duration_ms:
    # Window reset
    state.requests_made = 0
    state.window_start = now()

  IF state.requests_made >= state.limit * 0.9:  # 90% threshold
    LOG WARN("Approaching rate limit", state)

  IF state.requests_made >= state.limit:
    wait_time = (state.window_start + state.window_duration_ms) - now()
    RETURN { allowed: false, wait_ms: wait_time }

  state.requests_made++
  RETURN { allowed: true }
```

### 6.5 Circuit Breaker

```
CircuitBreaker {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failure_count: number
  failure_threshold: 5
  success_count: number
  success_threshold: 3
  open_duration_ms: 60000
  last_failure_at: timestamp | null
}

FUNCTION executeWithCircuitBreaker(operation, breaker):
  IF breaker.state == 'OPEN':
    IF now() - breaker.last_failure_at > breaker.open_duration_ms:
      breaker.state = 'HALF_OPEN'
      breaker.success_count = 0
    ELSE:
      THROW CircuitOpenError("Circuit breaker open")

  TRY:
    result = operation()

    IF breaker.state == 'HALF_OPEN':
      breaker.success_count++
      IF breaker.success_count >= breaker.success_threshold:
        breaker.state = 'CLOSED'
        breaker.failure_count = 0

    RETURN result

  CATCH error:
    breaker.failure_count++
    breaker.last_failure_at = now()

    IF breaker.failure_count >= breaker.failure_threshold:
      breaker.state = 'OPEN'
      LOG ERROR("Circuit breaker opened", { platform, failures: breaker.failure_count })

    THROW error
```

---

## 7. Observability Requirements

### 7.1 Required Log Events

| Event | Level | Required Fields | Trigger |
|-------|-------|-----------------|---------|
| api_pull.started | INFO | pull_id, platform, account_id, date_range | Pull begins |
| api_pull.auth_check | DEBUG | pull_id, token_valid, expires_at | Before API call |
| api_pull.token_refreshed | INFO | pull_id, new_expiry | Token refreshed |
| api_pull.step_started | DEBUG | pull_id, step, entity_type | Entity fetch begins |
| api_pull.page_fetched | DEBUG | pull_id, step, page_num, record_count | Each page |
| api_pull.step_completed | INFO | pull_id, step, total_records, duration_ms | Entity fetch ends |
| api_pull.rate_limit_hit | WARN | pull_id, platform, wait_ms | Rate limit encountered |
| api_pull.retry | INFO | pull_id, attempt, error_code, delay_ms | Retry initiated |
| api_pull.error | ERROR | pull_id, step, error_code, error_message | Unrecoverable error |
| api_pull.completed | INFO | pull_id, status, duration_ms, totals | Pull ends |
| api_pull.orphan_detected | WARN | pull_id, entity_type, external_id | Orphan metric |
| api_pull.circuit_opened | ERROR | platform, account_id, failure_count | Circuit breaker trips |

### 7.2 Required Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| api_pull_total | Counter | platform, status | Total pulls by outcome |
| api_pull_duration_seconds | Histogram | platform | Pull duration |
| api_pull_records_fetched | Counter | platform, entity_type | Records by type |
| api_pull_pages_fetched | Counter | platform, entity_type | Pages by type |
| api_pull_errors_total | Counter | platform, error_category | Errors by type |
| api_pull_retries_total | Counter | platform | Retry attempts |
| api_pull_rate_limit_waits_seconds | Histogram | platform | Rate limit delays |
| api_pull_token_refreshes_total | Counter | platform | Token refreshes |
| api_pull_orphan_metrics_total | Counter | platform, entity_type | Orphan records |
| api_pull_circuit_breaker_state | Gauge | platform | 0=closed, 1=half, 2=open |

### 7.3 Correlation Strategy

```
Correlation Hierarchy:

schedule_id (schedule that triggered pull)
    │
    └── pull_id (API pull session)
            │
            ├── step (entity type being fetched)
            │       │
            │       └── page_num (pagination position)
            │
            └── upload_id (data_uploads record for D6.5)
                    │
                    └── batch_id (alert evaluation for D6.6)
```

**Correlation ID Propagation:**

| Source | Target | Correlation |
|--------|--------|-------------|
| D6.7.1 Schedule | D6.7.2 Pull | schedule_id |
| D6.7.2 Pull | D6.5 Pipeline | upload_id (created by pull) |
| D6.5 Pipeline | D6.6 Evaluation | upload_id → batch_id |

### 7.4 Health Indicators

| Indicator | Source | Healthy | Degraded | Unhealthy |
|-----------|--------|---------|----------|-----------|
| Pull success rate | api_pull_total | >95% | 80-95% | <80% |
| Avg pull duration | api_pull_duration_seconds | <5min | 5-15min | >15min |
| Error rate | api_pull_errors_total | <1% | 1-5% | >5% |
| Circuit state | api_pull_circuit_breaker_state | All closed | Any half-open | Any open |
| Token freshness | token.expires_at | >24h | 1-24h | <1h |

---

## 8. Freeze & Safety Confirmation

### 8.1 Schema Compliance

| D4 Freeze Requirement | D6.7.2 Compliance |
|-----------------------|-------------------|
| No new tables | COMPLIANT — design only |
| No new columns | COMPLIANT — uses existing schema |
| No column modifications | COMPLIANT — no ALTER statements |
| campaigns table unchanged | COMPLIANT |
| ad_sets table unchanged | COMPLIANT |
| ads table unchanged | COMPLIANT |
| daily_metrics table unchanged | COMPLIANT |
| demographic_metrics table unchanged | COMPLIANT |

### 8.2 Alert Logic Isolation

| Boundary | Enforcement |
|----------|-------------|
| API pull does not evaluate alerts | Alert evaluation triggered via D6.6 |
| API pull does not write to alerts | No access to alerts table |
| API pull creates data_uploads record | Standard ingestion path |

### 8.3 D6.7.1 Scheduling Compatibility

| Scheduling Feature | D6.7.2 Support |
|--------------------|----------------|
| Scheduled pull execution | Adapter respects schedule parameters |
| Rate limit enforcement | Adapter tracks and respects limits |
| Concurrency limits | One pull per client enforced |
| Backfill windows | lookback_days parameter supported |
| Catch-up behavior | Incremental mode handles gaps |

### 8.4 D6.8 Webhook Compatibility

| Webhook Consideration | D6.7.2 Impact |
|-----------------------|---------------|
| Different entry point | No conflict (separate path) |
| Same normalization | Shared normalizers possible |
| Same upsert logic | Shared D6.5 pipeline |
| Same alert coordination | Same debounce applies |

### 8.5 Safety Summary

| Safety Property | Mechanism |
|-----------------|-----------|
| No data loss | Checkpointing, resume capability |
| No duplicates | Natural key upsert |
| No corruption | Atomic batch writes |
| No rate limit violations | Platform-aware throttling |
| Restartable | Checkpoint + resume |
| Auditable | Comprehensive logging |

---

## 9. Implementation Checklist

For the implementing engineer:

### 9.1 Pre-Implementation

| Check | Verified |
|-------|----------|
| Read D6.4 Ingestion Architecture | |
| Read D6.5 Ingestion Execution Blueprint | |
| Read D6.6 Alert Evaluation Runtime | |
| Read D6.7.1 Ingestion Boundary | |
| Obtain platform API documentation | |
| Obtain platform sandbox credentials | |

### 9.2 Implementation Order

| Order | Component | Dependencies |
|-------|-----------|--------------|
| 1 | Platform capability flags | None |
| 2 | Authentication handlers | None |
| 3 | Rate limit tracker | None |
| 4 | Retry handler | None |
| 5 | Circuit breaker | None |
| 6 | Pagination handler | Rate limit tracker |
| 7 | MetaAdapter | 1-6 |
| 8 | GoogleAdapter | 1-6 |
| 9 | TikTokAdapter | 1-6 |
| 10 | Normalizers (per platform) | None |
| 11 | Pull orchestrator | 7-10, D6.5 pipeline |
| 12 | Checkpoint manager | Pull orchestrator |
| 13 | Observability hooks | All |

### 9.3 Test Requirements

| Test Type | Coverage |
|-----------|----------|
| Unit: Normalizers | All field mappings |
| Unit: Status mapping | All status values |
| Unit: Currency conversion | All platforms |
| Integration: Auth flow | Token refresh |
| Integration: Pagination | Multi-page fetch |
| Integration: Error handling | All error categories |
| Integration: Circuit breaker | Open/close cycle |
| E2E: Full pull | Sandbox account |

---

## 10. Document Control

| Version | Date | Change |
|---------|------|--------|
| D6.7.2 | 2024-12-28 | Initial API pull ingestion design |

---

## 11. Approval

This document is a pre-implementation contract. Implementation requires separate approval.

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Data Ingestion Architect | | | |
| Platform Engineer | | | |
| Security Reviewer | | | |
