# Priority 2: Bulk Variant Management - Setup & Testing Guide

**Status:** ✅ Complete
**Date:** 2025-12-10

---

## 📋 Overview

Priority 2 adds **bulk variant management** capabilities to the Content Machine CMS, allowing you to approve, schedule, or publish multiple variants at once. This dramatically improves workflow efficiency when managing large batches of content.

### Features Implemented:
- ✅ **Selection System**: Checkboxes on each variant card with visual feedback
- ✅ **Bulk Actions Toolbar**: Select All, Approve, Schedule, Publish, and Clear operations
- ✅ **Bulk Schedule Modal**: Schedule multiple variants to the same datetime with automatic local→UTC conversion
- ✅ **Visual Feedback**: Selected variants show blue border and background
- ✅ **Integration with Priority 1**: Bulk-scheduled variants auto-publish via cron job

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VariantList Component                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Sticky Bulk Actions Toolbar                           │ │
│  │  • Select All / Deselect All                           │ │
│  │  • Selection count: "5 selected"                       │ │
│  │  • Approve Selected                                    │ │
│  │  • Schedule Selected → Opens bulk schedule modal      │ │
│  │  • Publish Selected                                    │ │
│  │  • Clear                                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ☑ Variant 1  │  │ ☑ Variant 2  │  │ ☐ Variant 3  │      │
│  │ (selected)   │  │ (selected)   │  │              │      │
│  │ Blue border  │  │ Blue border  │  │ Gray border  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ POST /api/variants/bulk-actions
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              /api/variants/bulk-actions                      │
│                                                               │
│  PATCH endpoint accepting:                                   │
│  • variant_ids: string[]                                     │
│  • action: 'approve' | 'schedule' | 'publish'                │
│  • scheduled_at?: string (ISO 8601, required for schedule)   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Validation                                          │    │
│  │  • Ensure variant_ids is non-empty array            │    │
│  │  • Validate action type                             │    │
│  │  • For 'schedule': validate scheduled_at is future  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Bulk Update via Supabase                           │    │
│  │  .update(updateData)                                │    │
│  │  .in('id', variant_ids)                             │    │
│  │  .select(...)                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Returns:                                                     │
│  {                                                            │
│    success: true,                                             │
│    action: string,                                            │
│    updated_count: number,                                     │
│    variants: Variant[]                                        │
│  }                                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Supabase    │
                    │   variants    │
                    │     table     │
                    └───────────────┘
```

---

## 📁 Files Modified/Created

### New Files:
1. **`app/api/variants/bulk-actions/route.ts`** (130 lines)
   - PATCH endpoint for bulk operations
   - Validates inputs (variant_ids, action, scheduled_at)
   - Supports three actions: approve, schedule, publish
   - Uses Supabase `.in()` for efficient bulk updates

### Modified Files:
2. **`components/posts/VariantList.tsx`** (289 → 540 lines)
   - Added selection state: `Set<string>` for efficient O(1) lookup
   - Added sticky bulk actions toolbar
   - Added selection checkbox to each variant card
   - Visual feedback: selected variants show `border-blue-500 bg-blue-50`
   - Bulk schedule modal with datetime-local input
   - Timezone conversion: `new Date(localDateTime).toISOString()` (same as Priority 1)

---

## 🚀 Setup Instructions

### Step 1: Verify Files

No database migration is needed. Priority 2 uses the existing `variants` table.

Ensure these files exist:
```bash
app/api/variants/bulk-actions/route.ts
components/posts/VariantList.tsx
```

### Step 2: No Environment Variables Needed

Priority 2 uses the same Supabase connection as the rest of the app. No additional configuration required.

### Step 3: Deploy

If using Vercel:
```bash
git add .
git commit -m "feat: implement bulk variant management (Priority 2)"
git push origin main
```

Vercel will automatically deploy.

For local development:
```bash
npm run dev
```

Visit `http://localhost:3000` and navigate to any post's variant list.

---

## 🧪 Testing Guide

### Test 1: Selection System

1. Navigate to a post with multiple variants (at least 5-10 variants recommended)
2. Click checkbox on individual variant cards
3. **Expected behavior:**
   - Checkbox becomes checked ✅
   - Card border changes from `border-gray-200` to `border-blue-500`
   - Card background changes to `bg-blue-50`
   - Toolbar shows "X selected" count

4. Click checkbox again to deselect
5. **Expected behavior:**
   - Checkbox unchecks
   - Card returns to gray border and white background
   - Selection count decreases

### Test 2: Select All / Deselect All

1. Click **"Select All"** button in toolbar
2. **Expected behavior:**
   - All variant cards become selected (blue borders)
   - Button text changes to **"Deselect All"**
   - Selection count shows total: "10 selected"

3. Click **"Deselect All"**
4. **Expected behavior:**
   - All cards become unselected (gray borders)
   - Button text changes to **"Select All"**
   - Selection count disappears

### Test 3: Bulk Approve

1. Filter to show only **draft** variants
2. Select 3-5 draft variants using checkboxes
3. Click **"Approve Selected"** button
4. Confirm the dialog
5. **Expected behavior:**
   - Success alert: "✅ Successfully approved X variant(s)"
   - Selected variants now show status: **approved**
   - Selection is cleared automatically
   - Page refreshes with updated data

6. Verify in database:
```sql
SELECT id, platform, status, created_at
FROM variants
WHERE status = 'approved'
ORDER BY created_at DESC
LIMIT 5;
```

### Test 4: Bulk Schedule

1. Select 3-5 **approved** variants (or draft variants)
2. Click **"Schedule Selected"** button
3. **Expected behavior:**
   - Bulk schedule modal appears
   - Modal shows: "Schedule X Variant(s)"
   - Datetime-local input with `min` set to current time

4. Select a future date/time (e.g., tomorrow at 2:00 PM in your local timezone)
5. Click **"Schedule All"**
6. **Expected behavior:**
   - Button shows "Scheduling..." while processing
   - Success alert: "✅ Successfully scheduled X variant(s)"
   - Modal closes
   - Selection is cleared
   - Variants now show status: **scheduled**
   - `scheduled_at` is stored in UTC (ISO 8601 format)

7. Verify timezone conversion in database:
```sql
SELECT id, platform, status, scheduled_at,
       scheduled_at AT TIME ZONE 'America/New_York' as scheduled_local
FROM variants
WHERE status = 'scheduled'
ORDER BY scheduled_at ASC
LIMIT 5;
```

**Expected:** `scheduled_at` is in UTC, `scheduled_local` shows your intended local time.

### Test 5: Bulk Publish

1. Select 3-5 **approved** or **scheduled** variants
2. Click **"Publish Selected"** button
3. Confirm the dialog
4. **Expected behavior:**
   - Success alert: "✅ Successfully published X variant(s)"
   - Variants now show status: **published**
   - `published_at` is set to current UTC time
   - `published_error` is cleared (set to null)

5. Verify in database:
```sql
SELECT id, platform, status, published_at, published_error
FROM variants
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 5;
```

**Expected:** `published_at` is recent, `published_error` is NULL.

### Test 6: Clear Selection

1. Select several variants
2. Click **"Clear"** button
3. **Expected behavior:**
   - All variants become unselected
   - Selection count disappears
   - Bulk action buttons disappear (only "Select All" and selection count remain visible)

### Test 7: Edge Cases

#### Empty Selection
1. Don't select any variants
2. **Expected behavior:**
   - Bulk action buttons (Approve, Schedule, Publish) are NOT visible
   - Only "Select All" button is available

#### Invalid Schedule Time
1. Select variants
2. Click "Schedule Selected"
3. Try to select a past date/time
4. **Expected behavior:**
   - Datetime-local input prevents selecting past times (`min` attribute)
   - If you bypass this (via DevTools), API returns 400 error: "scheduled_at must be in the future"

#### No Variants Updated
1. Select variants with IDs that don't exist (simulate via API call)
2. **Expected behavior:**
   - API returns 404: "No variants were updated. Check if variant IDs are valid."

---

## 🔗 Integration with Priority 1 (Cron Job)

### How They Work Together:

1. **Bulk Schedule** (Priority 2) → Sets `status = 'scheduled'` and `scheduled_at` for multiple variants
2. **Cron Job** (Priority 1) → Runs every 5 minutes, finds variants where `status = 'scheduled'` AND `scheduled_at <= NOW()`
3. **Auto-Publish** → Cron job updates those variants to `status = 'published'` and sets `published_at`

### Testing the Integration:

1. Use **bulk schedule** to schedule 5 variants for 3 minutes from now
2. Wait 3-5 minutes
3. Check cron logs:
```sql
SELECT * FROM cron_logs ORDER BY run_at DESC LIMIT 5;
```

4. **Expected:**
   - `variants_found`: 5
   - `variants_published`: 5
   - `variants_failed`: 0
   - `errors`: NULL

5. Check variants:
```sql
SELECT id, platform, status, scheduled_at, published_at
FROM variants
WHERE status = 'published'
AND scheduled_at IS NOT NULL
ORDER BY published_at DESC
LIMIT 5;
```

6. **Expected:**
   - Status changed from `scheduled` to `published`
   - `published_at` is set (approximately when cron ran)

### Monitor via Status Endpoint:

```bash
curl http://localhost:3000/api/cron/status | jq
```

**Expected response:**
```json
{
  "healthy": true,
  "last_run": {
    "run_at": "2025-12-10T15:30:00.000Z",
    "variants_found": 5,
    "variants_published": 5,
    "variants_failed": 0,
    "duration_ms": 234,
    "had_errors": false
  },
  "statistics": {
    "total_runs": 10,
    "total_variants_found": 15,
    "total_variants_published": 15,
    "total_variants_failed": 0,
    "average_duration_ms": 198,
    "success_rate": 100
  },
  "current_queue": {
    "ready_to_publish": 0,
    "upcoming_scheduled": 3
  }
}
```

---

## 📊 API Reference

### PATCH `/api/variants/bulk-actions`

Perform bulk operations on multiple variants.

#### Request Body:
```json
{
  "variant_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "action": "approve" | "schedule" | "publish",
  "scheduled_at": "2025-12-11T14:00:00.000Z"  // Required only for "schedule"
}
```

#### Response (Success):
```json
{
  "success": true,
  "action": "schedule",
  "updated_count": 3,
  "variants": [
    {
      "id": "uuid-1",
      "platform": "twitter",
      "status": "scheduled",
      "scheduled_at": "2025-12-11T14:00:00.000Z",
      "published_at": null
    },
    // ... more variants
  ]
}
```

#### Error Responses:

**400 Bad Request** - Invalid input:
```json
{
  "error": "variant_ids array is required and must not be empty"
}
```

```json
{
  "error": "action must be one of: approve, schedule, publish"
}
```

```json
{
  "error": "scheduled_at is required for schedule action"
}
```

```json
{
  "error": "scheduled_at must be in the future"
}
```

**404 Not Found** - No variants matched:
```json
{
  "error": "No variants were updated. Check if variant IDs are valid."
}
```

**500 Internal Server Error** - Database error:
```json
{
  "error": "Failed to update variants",
  "details": "..."
}
```

---

## 🔍 Troubleshooting

### Issue: Bulk actions not working

**Symptom:** Clicking "Approve Selected" does nothing or shows error.

**Solution:**
1. Open browser DevTools → Network tab
2. Click "Approve Selected" again
3. Look for POST to `/api/variants/bulk-actions`
4. Check response status and body
5. Common causes:
   - Network error: Check if API route exists
   - 400 error: Invalid variant_ids (check console logs)
   - 500 error: Database connection issue (check Supabase)

### Issue: Selection not updating visually

**Symptom:** Checkboxes work but borders don't change.

**Solution:**
1. Verify Tailwind CSS classes are applied:
```typescript
className={`border rounded-lg p-4 ${
  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
}`}
```

2. Check React state is updating:
```typescript
console.log('Selected IDs:', Array.from(selectedIds));
```

3. Ensure `isSelected` prop is passed correctly to VariantCard component

### Issue: Toolbar not sticky

**Symptom:** Toolbar scrolls away with content.

**Solution:**
Verify CSS classes on toolbar div:
```typescript
className="bg-white border border-gray-200 rounded-lg p-4 sticky top-0 z-10 shadow-sm"
```

Ensure `position: sticky` is supported in your browser (all modern browsers support it).

### Issue: Bulk schedule uses wrong timezone

**Symptom:** Variants scheduled for 2 PM local time appear as different time in database.

**Expected behavior:** This is CORRECT. The database stores UTC time.

**Verification:**
```sql
-- Get scheduled time in your timezone (example: America/New_York)
SELECT
  id,
  scheduled_at as utc_time,
  scheduled_at AT TIME ZONE 'America/New_York' as local_time
FROM variants
WHERE status = 'scheduled';
```

If you scheduled for 2:00 PM EST (UTC-5), database should show 7:00 PM UTC.

### Issue: "Select All" button not appearing

**Symptom:** No selection UI visible.

**Solution:**
1. Ensure there are variants to display: `{variants.length > 0 && ...}`
2. Check if VariantList component received variants prop:
```typescript
console.log('Variants:', variants);
```

3. Verify parent component is fetching variants correctly from Supabase

### Issue: Cron job not picking up bulk-scheduled variants

**Symptom:** Variants stuck in "scheduled" status past their scheduled_at time.

**Solution:**
1. Check cron is running:
```bash
curl https://your-app.vercel.app/api/cron/status | jq '.healthy'
```

2. Verify scheduled_at is in the past:
```sql
SELECT id, scheduled_at, NOW() as current_time
FROM variants
WHERE status = 'scheduled'
AND scheduled_at <= NOW();
```

3. Check cron logs for errors:
```sql
SELECT * FROM cron_logs ORDER BY run_at DESC LIMIT 3;
```

4. Manually trigger cron (for testing):
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-app.vercel.app/api/cron/publish-scheduled
```

---

## 📈 Performance Notes

### Selection State Management

Using `Set<string>` instead of `string[]` provides:
- **O(1) lookup** when checking if variant is selected
- **O(1) add/remove** operations
- More efficient for large variant lists (100+ items)

```typescript
// ✅ Good: O(1) lookup
const isSelected = selectedIds.has(variant.id);

// ❌ Bad: O(n) lookup
const isSelected = selectedIds.includes(variant.id);
```

### Bulk Update Efficiency

Supabase `.in()` method performs a single database query:

```typescript
// ✅ Good: 1 database query
await supabase
  .from('variants')
  .update(updateData)
  .in('id', variant_ids);

// ❌ Bad: N database queries
for (const id of variant_ids) {
  await supabase
    .from('variants')
    .update(updateData)
    .eq('id', id);
}
```

For 100 variants:
- **Bulk approach:** ~200ms (1 query)
- **Loop approach:** ~20,000ms (100 queries × 200ms each)

---

## ✅ Completion Checklist

- [x] `/api/variants/bulk-actions` endpoint created
- [x] Validation for all three actions (approve, schedule, publish)
- [x] Bulk update using Supabase `.in()` method
- [x] Selection checkboxes on variant cards
- [x] Visual feedback (blue borders for selected)
- [x] Sticky bulk actions toolbar
- [x] Select All / Deselect All functionality
- [x] Bulk approve handler
- [x] Bulk schedule modal with datetime-local input
- [x] Bulk publish handler
- [x] Timezone conversion (local → UTC ISO)
- [x] Integration with Priority 1 cron job
- [x] Confirmation dialogs for destructive actions
- [x] Success/error alerts
- [x] `router.refresh()` after successful updates
- [x] Comprehensive testing guide
- [x] API documentation

---

## 🎯 Next Steps

**Priority 2 is complete!**

Ready to proceed to **Priority 3: Content Calendar View** when confirmed by user.

Priority 3 will implement:
- Visual calendar displaying scheduled variants
- Month/week/day views
- Filter by platform and status
- Click events to see variant details
- Drag-and-drop rescheduling (optional enhancement)

---

## 📝 Notes

- No database migration required for Priority 2
- Uses existing `variants` table
- Timezone handling matches Priority 1 (cron job)
- Selection state is client-side only (not persisted)
- Bulk actions are atomic (all succeed or all fail)
- Compatible with all existing variant statuses and workflows

---

**Documentation complete.** ✅
