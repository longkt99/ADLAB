# Timezone Handling Fix for Schedule Publish

## Problem

When scheduling a variant:
1. User selects: `09/12/2025 10:45 PM` (local Vietnam time, GMT+7)
2. After saving, footer showed: `05:45:00 10/12/2025` (shifted +7 hours to next day)
3. Expected: Footer should show the same local time that was selected

## Root Cause

The `<input type="datetime-local">` returns a string like `"2025-12-09T22:45"` which has no timezone information. The JavaScript `new Date()` constructor interprets this string as **local time**.

## Solution

### Client-Side (VariantList.tsx)

**Before (incorrect):**
```javascript
body: JSON.stringify({ scheduled_at: scheduledDateTime })
// Sends: "2025-12-09T22:45" (no timezone, ambiguous)
```

**After (correct):**
```javascript
const localDate = new Date(scheduledDateTime); // Interprets as local time
const isoString = localDate.toISOString();     // Converts to UTC ISO format
body: JSON.stringify({ scheduled_at: isoString })
// Sends: "2025-12-09T15:45:00.000Z" (10:45 PM GMT+7 = 3:45 PM UTC)
```

### Server-Side (schedule/route.ts)

No changes needed. Server correctly:
1. Receives ISO string: `"2025-12-09T15:45:00.000Z"`
2. Validates it's in the future (compares UTC times correctly)
3. Stores it directly to Supabase TIMESTAMPTZ column

### Display (VariantList.tsx)

The display already works correctly:
```javascript
{new Date(variant.scheduled_at).toLocaleString()}
// Input: "2025-12-09T15:45:00.000Z" (UTC)
// Output: "9/12/2025, 10:45:00 PM" (converted to GMT+7)
```

## How It Works (Example)

**User timezone: GMT+7 (Vietnam)**

1. User picks: `December 9, 2025 10:45 PM`
2. Input value: `"2025-12-09T22:45"`
3. `new Date("2025-12-09T22:45")`:
   - Interprets as local: `Dec 9, 2025, 22:45 GMT+7`
4. `.toISOString()`:
   - Converts to UTC: `"2025-12-09T15:45:00.000Z"`
   - (22:45 - 7 hours = 15:45 UTC)
5. API stores: `"2025-12-09T15:45:00.000Z"`
6. Display:
   - `new Date("2025-12-09T15:45:00.000Z")`
   - Converts to local: `Dec 9, 2025, 22:45 GMT+7`
   - `.toLocaleString()`: `"9/12/2025, 10:45:00 PM"` ✅

## Testing

### Debug Mode

Added temporary debug logging to verify the conversion:

```javascript
console.log('Selected datetime-local value:', scheduledDateTime);
// "2025-12-09T22:45"

console.log('Parsed as Date object:', localDate);
// Date object: Tue Dec 09 2025 22:45:00 GMT+0700

console.log('ISO string to send to API:', localDate.toISOString());
// "2025-12-09T15:45:00.000Z"
```

Footer also shows UTC value for verification:
```
📅 Scheduled: 9/12/2025, 10:45:00 PM (UTC: 2025-12-09T15:45:00.000Z)
```

### Test Steps

1. Open browser console (F12)
2. Schedule a variant for `10:45 PM` today
3. Check console logs:
   - Selected value should be `"YYYY-MM-DDT22:45"`
   - ISO string should be 7 hours earlier in UTC
4. Check footer display:
   - Should show `10:45:00 PM` (your selected time)
   - UTC should show the earlier UTC time
5. Check Supabase database:
   - `scheduled_at` column should have the UTC timestamp

### Verify Cron Job

The cron job compares UTC times correctly:

```javascript
const now = new Date().toISOString(); // Current time in UTC
// "2025-12-09T16:00:00.000Z"

.lte('scheduled_at', now) // Compares UTC to UTC ✅
// Finds: "2025-12-09T15:45:00.000Z" <= "2025-12-09T16:00:00.000Z"
```

## Remove Debug Code (After Testing)

Once confirmed working, remove:

1. Console.log statements in `handleSchedule()`
2. UTC display in footer: `(UTC: {variant.scheduled_at})`

## Files Changed

- `components/posts/VariantList.tsx`:
  - Updated `handleSchedule()` to convert datetime-local to ISO string
  - Added debug logging (temporary)
  - Added UTC display (temporary)

No server-side changes needed.
