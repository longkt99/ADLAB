# Priority 3: Content Calendar View - Setup & Testing Guide

**Status:** ✅ Complete
**Date:** 2025-12-10

---

## 📋 Overview

Priority 3 adds a **visual content calendar** to the Content Machine CMS, providing a month-view visualization of scheduled and published variants. This helps teams coordinate content strategy and avoid scheduling conflicts.

### Features Implemented:
- ✅ **Monthly Calendar View**: Full month grid showing all events
- ✅ **Event Visualization**: Color-coded events (yellow = scheduled, green = published)
- ✅ **Platform Filters**: Filter by Twitter, LinkedIn, Instagram, or all
- ✅ **Status Filters**: Filter by scheduled, published, or both
- ✅ **Event Details Modal**: Click any event to see full details
- ✅ **Navigation**: Previous/Next month, Today button
- ✅ **Today Highlight**: Current day highlighted with blue ring
- ✅ **Responsive Design**: Works on desktop and tablet
- ✅ **Event Count**: Shows total events for the month
- ✅ **Multi-Event Days**: Shows up to 3 events per day, with "+X more" indicator

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Calendar Page (/calendar)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Header & Filters                                         │  │
│  │  • Month/Year navigation (◀ January 2025 ▶)              │  │
│  │  • Today button                                           │  │
│  │  • Platform filter dropdown                               │  │
│  │  • Status filter dropdown                                 │  │
│  │  • Event count: "Showing 15 event(s)"                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Calendar Grid (7 columns × 6 rows)                       │  │
│  │                                                            │  │
│  │  Sun    Mon    Tue    Wed    Thu    Fri    Sat           │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │         1      2      3      4      5      6             │  │
│  │                       🐦 Post A (yellow)                  │  │
│  │                                                            │  │
│  │  7      8      9      10     11     12     13            │  │
│  │         💼 Post B (green)                                 │  │
│  │         📷 Post C (yellow)                                │  │
│  │         +1 more                                            │  │
│  │                                                            │  │
│  │  14     15     16 (TODAY - blue ring)  17  18  19  20    │  │
│  │  ...                                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Legend                                                    │  │
│  │  🟡 Scheduled  🟢 Published  🔵 Today                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ GET /api/calendar/events
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                /api/calendar/events                             │
│                                                                 │
│  Query Parameters:                                              │
│  • year: number (default: current year)                         │
│  • month: number (1-12, default: current month)                 │
│  • platform?: 'twitter' | 'linkedin' | 'instagram'              │
│  • status?: 'scheduled' | 'published'                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Calculate Date Range                                  │  │
│  │     • Start: First day of month (00:00:00 UTC)            │  │
│  │     • End: First day of next month (00:00:00 UTC)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. Query Variants                                        │  │
│  │     • For scheduled: scheduled_at in range                │  │
│  │     • For published: published_at in range                │  │
│  │     • Include base_posts.title via join                   │  │
│  │     • Apply platform/status filters                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  3. Transform to Events                                   │  │
│  │     • Map to CalendarEvent format                         │  │
│  │     • Group by day (YYYY-MM-DD key)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Returns:                                                       │
│  {                                                              │
│    success: true,                                               │
│    year: 2025,                                                  │
│    month: 1,                                                    │
│    total_events: 15,                                            │
│    events: CalendarEvent[],                                     │
│    events_by_day: {                                             │
│      "2025-01-03": [event1, event2],                            │
│      "2025-01-08": [event3]                                     │
│    }                                                            │
│  }                                                              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌───────────────┐
                      │   Supabase    │
                      │   variants    │
                      │   base_posts  │
                      └───────────────┘
```

---

## 📁 Files Created

### New Files:
1. **`app/api/calendar/events/route.ts`** (150 lines)
   - GET endpoint for fetching calendar events
   - Accepts year, month, platform, status query params
   - Calculates date range for the month
   - Queries variants with scheduled_at or published_at in range
   - Joins with base_posts to get post titles
   - Groups events by day (YYYY-MM-DD)
   - Returns structured calendar data

2. **`app/(dashboard)/calendar/page.tsx`** (550 lines)
   - Client-side calendar component
   - Month grid view (7 columns × 6 rows)
   - Day navigation (previous/next month, today)
   - Platform and status filter dropdowns
   - Event badges with color coding
   - Click event to open details modal
   - Today highlight with blue ring
   - Responsive layout

---

## 🚀 Setup Instructions

### Step 1: Verify Files

No database migration is needed. Priority 3 uses the existing `variants` and `base_posts` tables.

Ensure these files exist:
```bash
app/api/calendar/events/route.ts
app/(dashboard)/calendar/page.tsx
```

### Step 2: Navigation Link (Optional)

Add a link to the calendar in your main navigation. For example, in your dashboard layout or header:

```tsx
<Link href="/calendar" className="...">
  Calendar
</Link>
```

### Step 3: Deploy

If using Vercel:
```bash
git add .
git commit -m "feat: implement content calendar view (Priority 3)"
git push origin main
```

For local development:
```bash
npm run dev
```

Visit [http://localhost:3000/calendar](http://localhost:3000/calendar)

---

## 🧪 Testing Guide

### Test 1: Initial Load

1. Navigate to `/calendar`
2. **Expected behavior:**
   - Calendar loads showing current month and year
   - Day headers: Sun, Mon, Tue, Wed, Thu, Fri, Sat
   - Calendar grid with 6 rows × 7 columns (42 cells)
   - Today's date highlighted with blue ring
   - Empty days show as blank cells
   - Days with events show color-coded event badges
   - Event count displayed: "Showing X event(s) in [Month] [Year]"

### Test 2: Month Navigation

1. Click **Next Month** button (▶)
2. **Expected behavior:**
   - Calendar advances to next month
   - Header updates: "February 2025" → "March 2025"
   - Events reload for new month
   - Event count updates

3. Click **Previous Month** button (◀)
4. **Expected behavior:**
   - Calendar goes back to previous month
   - Header updates
   - Events reload

5. Click **Today** button
6. **Expected behavior:**
   - Calendar jumps to current month
   - Today's date highlighted with blue ring
   - Events reload for current month

### Test 3: Platform Filter

1. Select **Twitter** from Platform dropdown
2. **Expected behavior:**
   - Only Twitter events (🐦) are shown
   - LinkedIn and Instagram events disappear
   - Event count updates to show filtered count

3. Select **LinkedIn** from Platform dropdown
4. **Expected behavior:**
   - Only LinkedIn events (💼) are shown

5. Select **All Platforms**
6. **Expected behavior:**
   - All events appear again

### Test 4: Status Filter

1. Select **Scheduled** from Status dropdown
2. **Expected behavior:**
   - Only scheduled events (yellow) are shown
   - Published events (green) disappear
   - Event count updates

3. Select **Published** from Status dropdown
4. **Expected behavior:**
   - Only published events (green) are shown
   - Scheduled events disappear

5. Select **All Statuses**
6. **Expected behavior:**
   - Both scheduled and published events appear

### Test 5: Event Click & Modal

1. Click on any event badge in the calendar
2. **Expected behavior:**
   - Modal appears with event details
   - Modal shows:
     - Post title
     - Platform badge (Twitter/LinkedIn/Instagram)
     - Status badge (Scheduled/Published)
     - Full content (with line breaks preserved)
     - Scheduled date/time (if scheduled)
     - Published date/time (if published)
     - "View Full Post →" link
     - Close button

3. Click **View Full Post →**
4. **Expected behavior:**
   - Redirects to `/posts/[post_id]`

5. Click **Close** or X button
6. **Expected behavior:**
   - Modal closes
   - Returns to calendar view

7. Click outside modal (on dark overlay)
8. **Expected behavior:**
   - Modal remains open (requires explicit Close action)

### Test 6: Multi-Event Days

1. Find a day with more than 3 events (or create test data)
2. **Expected behavior:**
   - Shows first 3 events as individual badges
   - Shows "+X more" text below the 3rd event
   - Example: "+2 more" if there are 5 total events

3. Click on any of the visible event badges
4. **Expected behavior:**
   - Opens modal for that specific event

### Test 7: Today Highlight

1. Ensure current date is visible in calendar
2. **Expected behavior:**
   - Today's cell has blue ring: `ring-2 ring-blue-500 ring-inset`
   - Day number is blue text instead of gray
   - Easy to identify at a glance

### Test 8: Empty Month

1. Navigate to a future month with no scheduled or published content
2. **Expected behavior:**
   - Calendar renders empty
   - Event count shows: "Showing 0 event(s) in [Month] [Year]"
   - No event badges on any day
   - All days are clickable but have no events

### Test 9: Combined Filters

1. Select **Platform: Twitter** AND **Status: Scheduled**
2. **Expected behavior:**
   - Only scheduled Twitter events appear
   - Other platform/status combinations hidden
   - Event count reflects filtered results

3. Navigate to different months while filters are active
4. **Expected behavior:**
   - Filters persist across month changes
   - Events reload with filters applied

### Test 10: API Direct Test

Test the API endpoint directly:

```bash
# Get events for January 2025
curl "http://localhost:3000/api/calendar/events?year=2025&month=1" | jq

# Get only Twitter events
curl "http://localhost:3000/api/calendar/events?year=2025&month=1&platform=twitter" | jq

# Get only scheduled events
curl "http://localhost:3000/api/calendar/events?year=2025&month=1&status=scheduled" | jq

# Combined filters
curl "http://localhost:3000/api/calendar/events?year=2025&month=1&platform=linkedin&status=published" | jq
```

**Expected response structure:**
```json
{
  "success": true,
  "year": 2025,
  "month": 1,
  "start_date": "2025-01-01T00:00:00.000Z",
  "end_date": "2025-02-01T00:00:00.000Z",
  "total_events": 8,
  "events": [
    {
      "id": "uuid",
      "post_id": "uuid",
      "post_title": "Example Post Title",
      "platform": "twitter",
      "status": "scheduled",
      "content": "Tweet content here...",
      "date": "2025-01-15T14:00:00.000Z",
      "scheduled_at": "2025-01-15T14:00:00.000Z",
      "published_at": null
    }
  ],
  "events_by_day": {
    "2025-01-15": [
      { /* event object */ }
    ]
  },
  "filters": {
    "platform": "all",
    "status": "all"
  }
}
```

---

## 🔗 Integration with Priorities 1 & 2

### Integration with Priority 1 (Cron Job):

1. **Scheduled events** appear on the calendar in yellow
2. When cron job runs and publishes them:
   - Events change from yellow (scheduled) to green (published)
   - Event moves from `scheduled_at` to `published_at` date (if different)
3. Refresh calendar page to see updated statuses

### Integration with Priority 2 (Bulk Actions):

1. Use **bulk schedule** to schedule multiple variants for specific dates
2. Navigate to **calendar view**
3. **Expected:**
   - All bulk-scheduled variants appear on their scheduled dates
   - Events are color-coded yellow (scheduled)
   - Can click each event to see details

### Testing Integration:

1. Go to a post's variant list
2. Bulk schedule 5 variants for different dates in the current month
3. Navigate to calendar
4. **Expected:**
   - All 5 events appear on their respective dates
   - Event count includes all 5
   - Clicking each opens the correct variant details

---

## 📊 API Reference

### GET `/api/calendar/events`

Returns calendar events for a specific month.

#### Query Parameters:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `year` | number | No | Current year | Calendar year (2020-2100) |
| `month` | number | No | Current month | Month number (1-12) |
| `platform` | string | No | null (all) | Filter by platform: `twitter`, `linkedin`, `instagram` |
| `status` | string | No | null (both) | Filter by status: `scheduled`, `published` |

#### Response (Success):

```json
{
  "success": true,
  "year": 2025,
  "month": 1,
  "start_date": "2025-01-01T00:00:00.000Z",
  "end_date": "2025-02-01T00:00:00.000Z",
  "total_events": 12,
  "events": [
    {
      "id": "variant-uuid",
      "post_id": "post-uuid",
      "post_title": "10 Tips for Better Content",
      "platform": "twitter",
      "status": "scheduled",
      "content": "Tweet content here...",
      "date": "2025-01-15T14:00:00.000Z",
      "scheduled_at": "2025-01-15T14:00:00.000Z",
      "published_at": null
    }
  ],
  "events_by_day": {
    "2025-01-15": [
      { /* event object */ }
    ],
    "2025-01-20": [
      { /* event 1 */ },
      { /* event 2 */ }
    ]
  },
  "filters": {
    "platform": "all",
    "status": "all"
  }
}
```

#### Error Responses:

**400 Bad Request** - Invalid parameters:
```json
{
  "error": "Invalid year parameter"
}
```

```json
{
  "error": "Invalid month parameter (must be 1-12)"
}
```

**500 Internal Server Error** - Database error:
```json
{
  "error": "Failed to fetch calendar events",
  "details": "..."
}
```

---

## 🔍 Troubleshooting

### Issue: Calendar loads but shows no events

**Symptom:** Calendar renders correctly but all days are empty.

**Solution:**
1. Check if there are actually scheduled/published variants for this month:
```sql
SELECT
  id,
  platform,
  status,
  scheduled_at,
  published_at
FROM variants
WHERE
  (status = 'scheduled' AND scheduled_at >= '2025-01-01' AND scheduled_at < '2025-02-01')
  OR
  (status = 'published' AND published_at >= '2025-01-01' AND published_at < '2025-02-01')
ORDER BY scheduled_at ASC NULLS LAST;
```

2. If no results, create test data:
   - Go to a post
   - Schedule some variants for dates in the current month
   - Return to calendar and refresh

3. Check browser console for API errors:
   - Open DevTools → Network tab
   - Look for `/api/calendar/events` request
   - Check response status and body

### Issue: Events appear on wrong dates

**Symptom:** Event shows on January 5th but was scheduled for January 6th.

**Cause:** Timezone mismatch. Database stores UTC, but calendar might be displaying in local timezone.

**Expected behavior:** Events appear on the date they're scheduled in UTC, not local time. This is correct.

**Verification:**
```sql
SELECT
  id,
  scheduled_at,
  scheduled_at AT TIME ZONE 'America/New_York' as local_time
FROM variants
WHERE id = 'problematic-variant-id';
```

If scheduled for January 6th 1:00 AM EST (UTC-5), it's stored as January 6th 6:00 AM UTC, and should appear on January 6th in the calendar.

### Issue: Event modal not opening

**Symptom:** Clicking event badge does nothing.

**Solution:**
1. Check browser console for JavaScript errors
2. Verify `onClick` handler is attached:
```typescript
<button onClick={() => setSelectedEvent(event)}>
```

3. Verify state is updating:
```typescript
console.log('Selected event:', selectedEvent);
```

4. Check if modal is being rendered:
   - Inspect DOM for modal element
   - Look for `fixed inset-0 bg-black bg-opacity-50` div

### Issue: Filters not working

**Symptom:** Changing platform or status filter doesn't update events.

**Solution:**
1. Verify useEffect dependencies include filters:
```typescript
useEffect(() => {
  fetchCalendarData();
}, [year, month, platformFilter, statusFilter]);
```

2. Check API request includes correct query params:
   - Open DevTools → Network tab
   - Change filter
   - Look at `/api/calendar/events?platform=twitter` request

3. Verify API is returning filtered results:
   - Check response body in Network tab
   - Should only include events matching filters

### Issue: "Today" button doesn't work

**Symptom:** Clicking "Today" doesn't navigate to current month.

**Solution:**
Verify the handler:
```typescript
const goToToday = () => {
  setCurrentDate(new Date());
};
```

This should set `currentDate` to now, triggering `useEffect` to reload data for current month.

### Issue: Calendar grid misaligned

**Symptom:** Days don't line up with correct weekday headers.

**Cause:** `getFirstDayOfMonth` calculation might be incorrect.

**Verification:**
```typescript
const getFirstDayOfMonth = (year: number, month: number) => {
  return new Date(year, month - 1, 1).getDay(); // 0 = Sunday, 6 = Saturday
};
```

For January 2025:
- `new Date(2025, 0, 1).getDay()` should return `3` (Wednesday)
- Calendar should have 3 empty cells before the 1st

### Issue: API returns 400 "Invalid month"

**Symptom:** API call fails with "Invalid month parameter (must be 1-12)".

**Solution:**
Verify month is 1-indexed (not 0-indexed):
```typescript
const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
```

- JavaScript: January = 0, December = 11
- API expects: January = 1, December = 12

### Issue: Events missing after cron publish

**Symptom:** Scheduled event disappeared after cron job ran, but variant is published.

**Expected behavior:** Published events should still appear on the calendar (in green).

**Verification:**
1. Check if published_at is set:
```sql
SELECT id, status, published_at FROM variants WHERE id = 'variant-id';
```

2. Verify API query includes published events:
```typescript
.or(`and(status.eq.scheduled,...),and(status.eq.published,...)`)
```

3. Refresh calendar page to reload data

---

## 📈 Performance & Optimization

### Query Optimization

The API uses a single database query with OR conditions:

```typescript
.or(`
  and(status.eq.scheduled,scheduled_at.gte.${start},scheduled_at.lt.${end}),
  and(status.eq.published,published_at.gte.${start},published_at.lt.${end})
`)
```

This is more efficient than:
- Two separate queries (one for scheduled, one for published)
- Fetching all variants and filtering in JavaScript

### Index Recommendations

For optimal performance with large datasets, add these indexes:

```sql
-- Index for scheduled variants lookup
CREATE INDEX IF NOT EXISTS idx_variants_scheduled_lookup
ON variants (status, scheduled_at)
WHERE status = 'scheduled';

-- Index for published variants lookup
CREATE INDEX IF NOT EXISTS idx_variants_published_lookup
ON variants (status, published_at)
WHERE status = 'published';
```

These indexes are already included in migration `004_cron_logging.sql` from Priority 1.

### Client-Side Caching

The calendar component fetches data on every filter or month change. For production, consider adding:

1. **React Query** for automatic caching:
```typescript
const { data, isLoading } = useQuery(
  ['calendar', year, month, platformFilter, statusFilter],
  fetchCalendarData
);
```

2. **SWR** for stale-while-revalidate caching:
```typescript
const { data } = useSWR(
  `/api/calendar/events?year=${year}&month=${month}`,
  fetcher
);
```

For now, the simple `useState` + `useEffect` approach is sufficient for most use cases.

---

## 🎨 Customization

### Change Calendar Colors

Edit the event button styles in `page.tsx`:

```typescript
// Current: Yellow for scheduled, green for published
style={{
  backgroundColor: event.status === 'scheduled' ? '#fef3c7' : '#d1fae5',
  borderColor: event.status === 'scheduled' ? '#fbbf24' : '#10b981',
}}

// Custom colors:
style={{
  backgroundColor: event.status === 'scheduled' ? '#e0f2fe' : '#fce7f3', // Blue/Pink
  borderColor: event.status === 'scheduled' ? '#0ea5e9' : '#ec4899',
}}
```

### Change Events Per Day Limit

Currently shows 3 events per day. To show more:

```typescript
// Change from:
{events.slice(0, 3).map((event) => (...))}

// To (show 5):
{events.slice(0, 5).map((event) => (...))}
```

### Add Week View

For a more detailed weekly view, consider adding a toggle:

```typescript
const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
```

This would require additional UI logic to render 7 days at a time with more space per day.

---

## ✅ Completion Checklist

- [x] `/api/calendar/events` endpoint created
- [x] Month/year query parameters support
- [x] Platform and status filter support
- [x] Date range calculation (start/end of month)
- [x] Supabase query with OR condition for scheduled/published
- [x] Join with base_posts to get post titles
- [x] Group events by day (YYYY-MM-DD)
- [x] Calendar page component (`/calendar`)
- [x] Month grid view (7×6 cells)
- [x] Day headers (Sun-Sat)
- [x] Previous/Next month navigation
- [x] Today button
- [x] Today highlight (blue ring)
- [x] Platform filter dropdown
- [x] Status filter dropdown
- [x] Event count display
- [x] Color-coded event badges (yellow/green)
- [x] Platform emoji icons (🐦💼📷)
- [x] Multi-event days with "+X more"
- [x] Event click handler
- [x] Event details modal
- [x] Modal content display (title, platform, status, content, dates)
- [x] "View Full Post" link
- [x] Modal close button
- [x] Legend (scheduled/published/today colors)
- [x] Responsive design
- [x] Integration with Priority 1 (cron job)
- [x] Integration with Priority 2 (bulk actions)
- [x] Comprehensive testing guide
- [x] API documentation
- [x] Troubleshooting guide

---

## 🎯 Next Steps

**Priority 3 is complete!**

Ready to proceed to **Priority 4: Analytics Dashboard** when confirmed by user.

Priority 4 will implement:
- Overview statistics (total posts, variants, published count)
- Platform distribution chart (pie/donut chart)
- Publishing activity timeline (line/bar chart)
- Top performing posts (by engagement, if tracking is added)
- Status breakdown (draft, approved, scheduled, published counts)
- Date range filters (last 7 days, 30 days, all time)

---

## 📝 Notes

- No database migration required for Priority 3
- Uses existing `variants` and `base_posts` tables
- Calendar events are read-only (no drag-and-drop rescheduling in this version)
- Events displayed in UTC timezone (matches database storage)
- **Platform support**: All 8 platforms from `lib/platforms.ts`:
  - `twitter_x` (X/Twitter) - 𝕏
  - `instagram_post` (Instagram) - 📷
  - `threads` (Threads) - 🧵
  - `bluesky` (Bluesky) - ☁️
  - `linkedin` (LinkedIn) - 💼
  - `google` (Google Post) - 🔍
  - `pinterest` (Pinterest) - 📌
  - `youtube_community` (YouTube) - ▶️
- Modal close requires explicit action (click X or Close button, not outside click)
- Maximum 3 events shown per day in calendar grid (prevents overflow)
- Event details modal is scrollable for long content

---

## 🔧 How Status + Date Filters Work

### Status Filter Logic:

**When status = "scheduled":**
```typescript
query
  .eq('status', 'scheduled')
  .gte('scheduled_at', startISO)
  .lt('scheduled_at', endISO)
```
Only fetches variants where `status = 'scheduled'` AND `scheduled_at` is within the month.

**When status = "published":**
```typescript
query
  .eq('status', 'published')
  .gte('published_at', startISO)
  .lt('published_at', endISO)
```
Only fetches variants where `status = 'published'` AND `published_at` is within the month.

**When status = "all" (default):**
```typescript
query.or(
  `and(status.eq.scheduled,scheduled_at.gte.${startISO},scheduled_at.lt.${endISO}),
   and(status.eq.published,published_at.gte.${startISO},published_at.lt.${endISO})`
)
```
Fetches BOTH scheduled (by scheduled_at) AND published (by published_at) variants.

### Platform Filter Logic:

**When platform = "all" (default):**
- No `.eq('platform', ...)` filter applied
- Returns all platforms

**When specific platform selected (e.g., "instagram_post"):**
```typescript
if (platform && platform !== 'all') {
  query = query.eq('platform', platform);
}
```
Filters to only that platform value (must match exact database value like `instagram_post`, not display name).

### Date Range Calculation:

Month boundaries are calculated in UTC:
```typescript
// For December 2025:
const startDate = new Date(Date.UTC(2025, 11, 1, 0, 0, 0));  // 2025-12-01T00:00:00.000Z
const endDate = new Date(Date.UTC(2025, 12, 1, 0, 0, 0));    // 2026-01-01T00:00:00.000Z

// Query uses:
.gte('scheduled_at', '2025-12-01T00:00:00.000Z')
.lt('scheduled_at', '2026-01-01T00:00:00.000Z')
```

Events scheduled for December 10, 2025 at 2:00 PM local time are stored in UTC. The calendar displays them on the correct date based on the ISO date string (YYYY-MM-DD).

---

## 🐛 Bug Fixes Applied (2025-12-10)

### Issue 1: API Errors and Query Failures
**Problem:** Calendar API was throwing generic 500 errors without helpful debugging info.

**Fix:**
- Added comprehensive error logging with `CALENDAR_EVENTS_ERROR` prefix
- Wrapped Supabase query in nested try/catch for granular error handling
- Added console logs showing request params, date range, and result count
- Error responses now include `details`, `code`, and `hint` fields from Supabase

**Location:** [app/api/calendar/events/route.ts:110-127](app/api/calendar/events/route.ts#L110-L127)

### Issue 2: Events Not Appearing
**Problem:** Scheduled variants existed in database but didn't show on calendar.

**Root Cause:** Query logic conflict - when both platform and status filters were applied, the OR condition wasn't compatible with additional filters.

**Fix:**
- Separated query logic for `status=scheduled`, `status=published`, and `status=all` (both)
- For scheduled-only: use simple `.eq('status', 'scheduled').gte('scheduled_at', ...).lt('scheduled_at', ...)`
- For published-only: use simple `.eq('status', 'published').gte('published_at', ...).lt('published_at', ...)`
- For both: use OR condition (existing logic)
- Platform filter now works correctly with all status options

**Location:** [app/api/calendar/events/route.ts:76-95](app/api/calendar/events/route.ts#L76-L95)

### Issue 3: Incomplete Platform Filter
**Problem:** Calendar only supported 3 platforms (Twitter, LinkedIn, Instagram) but system uses 8.

**Fix:**
- Imported `PLATFORMS` and `PLATFORM_DISPLAY_NAMES` from `@/lib/platforms`
- Updated platform filter dropdown to dynamically render all 8 platforms:
  ```tsx
  {PLATFORMS.map((platform) => (
    <option key={platform} value={platform}>
      {PLATFORM_DISPLAY_NAMES[platform]}
    </option>
  ))}
  ```
- Updated `PlatformBadge` component with colors for all 8 platforms
- Added `getPlatformEmoji()` helper with emojis for all platforms
- Updated event rendering to use dynamic emoji instead of hardcoded

**Location:**
- [app/(dashboard)/calendar/page.tsx:5](app/(dashboard)/calendar/page.tsx#L5) - Import
- [app/(dashboard)/calendar/page.tsx:38-74](app/(dashboard)/calendar/page.tsx#L38-L74) - Badge & Emoji
- [app/(dashboard)/calendar/page.tsx:393-397](app/(dashboard)/calendar/page.tsx#L393-L397) - Filter dropdown

### Issue 4: No Navigation to Calendar
**Problem:** No way to reach `/calendar` without manually typing URL.

**Fix:**
- Added "Calendar" link to main navigation in `app/(dashboard)/layout.tsx`:
  ```tsx
  <Link href="/calendar">Calendar</Link>
  ```
- Added "📅 View Calendar" button on `/posts` page next to "Create New Post"

**Location:**
- [app/(dashboard)/layout.tsx:26-30](app/(dashboard)/layout.tsx#L26-L30) - Nav link
- [app/(dashboard)/posts/page.tsx:91-96](app/(dashboard)/posts/page.tsx#L91-L96) - Secondary button

---

**Documentation complete.** ✅
