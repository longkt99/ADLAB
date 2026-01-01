# Cron Job Setup for Auto-Publishing Scheduled Variants

This document explains how to set up automatic publishing of scheduled variants.

## Overview

The system includes an API endpoint `/api/cron/publish-scheduled` that:
- Finds all variants with `status = 'scheduled'` and `scheduled_at <= now()`
- Updates them to `status = 'published'` and sets `published_at = now()`
- Returns a summary of published variants

## Security

The endpoint is protected by a secret token. Add this to your `.env.local`:

```env
CRON_SECRET=your-random-secret-token-here
```

Generate a secure token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Setup Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

1. Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/publish-scheduled",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This runs every 5 minutes. Adjust the schedule as needed:
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour
- `0 */6 * * *` - Every 6 hours

2. Deploy to Vercel:
```bash
vercel deploy
```

3. Vercel automatically handles authentication for cron jobs (no CRON_SECRET needed).

### Option 2: Supabase Edge Function

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Create a new edge function:
```bash
supabase functions new publish-scheduled-variants
```

3. Add this code to `supabase/functions/publish-scheduled-variants/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async () => {
  const response = await fetch('https://your-domain.com/api/cron/publish-scheduled', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('CRON_SECRET')}`,
    },
  })

  const data = await response.json()

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

4. Deploy the function:
```bash
supabase functions deploy publish-scheduled-variants
```

5. Set up a cron schedule in Supabase Dashboard → Database → Cron Jobs:
```sql
SELECT cron.schedule(
  'publish-scheduled-variants',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url:='https://your-supabase-project.supabase.co/functions/v1/publish-scheduled-variants',
    headers:=jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'))
  );
  $$
);
```

### Option 3: External Cron Service (e.g., cron-job.org, EasyCron)

1. Sign up for a free cron service like:
   - [cron-job.org](https://cron-job.org)
   - [EasyCron](https://www.easycron.com)
   - [Zapier Schedule](https://zapier.com/apps/schedule/integrations)

2. Create a new cron job with:
   - **URL**: `https://your-domain.com/api/cron/publish-scheduled`
   - **Method**: GET
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule**: Every 5 minutes (or your preferred interval)

3. Test the endpoint manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/publish-scheduled
```

### Option 4: GitHub Actions (For GitHub-hosted projects)

Create `.github/workflows/publish-scheduled.yml`:

```yaml
name: Publish Scheduled Variants

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger publish endpoint
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/publish-scheduled
```

Add `CRON_SECRET` to your GitHub repository secrets.

## Testing

### Test the endpoint manually:

```bash
# Without authentication (should return 401)
curl https://your-domain.com/api/cron/publish-scheduled

# With authentication (should work)
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-domain.com/api/cron/publish-scheduled
```

### Expected responses:

**No variants to publish:**
```json
{
  "success": true,
  "message": "No variants to publish",
  "count": 0
}
```

**Variants published:**
```json
{
  "success": true,
  "message": "Published 3 scheduled variants",
  "count": 3,
  "variants": [...]
}
```

## Monitoring

Check your logs to see when variants are auto-published:
```
✅ Auto-published 3 scheduled variants
```

## Troubleshooting

1. **Variants not publishing automatically**
   - Check cron job is running (check service logs)
   - Verify `CRON_SECRET` matches in both .env and cron service
   - Check variant `scheduled_at` is in the past
   - Verify variant `status = 'scheduled'`

2. **401 Unauthorized error**
   - CRON_SECRET mismatch
   - Missing Authorization header

3. **500 Internal Server Error**
   - Check Supabase credentials
   - Check application logs for detailed error

## Production Checklist

- [ ] Set `CRON_SECRET` in production environment variables
- [ ] Set up cron job with chosen provider
- [ ] Test endpoint with authentication
- [ ] Verify at least one scheduled variant auto-publishes
- [ ] Set up monitoring/alerting for failed cron jobs
- [ ] Document which cron provider is being used for the team
