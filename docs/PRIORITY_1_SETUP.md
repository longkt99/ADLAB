# Priority 1: Cron Job Deployment - Setup Guide

## 📋 Overview

This guide walks you through deploying automated scheduled publishing for Content Machine CMS.

**What you'll achieve:**
- ✅ Auto-publish scheduled variants every 5 minutes
- ✅ Complete logging of all cron runs
- ✅ Error tracking and monitoring
- ✅ Status dashboard for cron health

---

## 🗄️ Step 1: Run Database Migration

### **1.1 Open Supabase SQL Editor**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your "Content Machine" project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### **1.2 Run Migration**

Copy the entire contents of `supabase/migrations/004_cron_logging.sql` and paste into the SQL Editor.

Click **Run** (or press `Ctrl+Enter`).

**Expected output:**
```
✅ Migration 004 completed successfully
   - Added variants.published_error column
   - Created cron_logs table
   - Set up RLS policies
```

### **1.3 Verify Tables**

Run this query to verify:

```sql
-- Check cron_logs table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'cron_logs';

-- Check variants.published_error column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'variants' AND column_name = 'published_error';
```

Both queries should return results.

---

## 🔐 Step 2: Set Up Environment Variables

### **2.1 Generate CRON_SECRET**

Generate a secure random secret:

**Option A: Node.js (Recommended)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option B: OpenSSL**
```bash
openssl rand -hex 32
```

**Option C: Online Generator**
Visit: https://generate-secret.vercel.app/32

Copy the generated secret (64 characters).

### **2.2 Add to Local Environment**

Add to your `.env.local`:

```env
# Cron Job Security
CRON_SECRET=your_generated_secret_here_64_characters
```

### **2.3 Add to Production (Vercel)**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your "Content Machine" project
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name:** `CRON_SECRET`
   - **Value:** (paste your generated secret)
   - **Environments:** Production, Preview, Development (check all)
5. Click **Save**

**⚠️ Important:** Keep this secret safe! Anyone with this secret can trigger your cron job.

---

## 🚀 Step 3: Deploy to Vercel

### **3.1 Commit Changes**

```bash
git add .
git commit -m "feat: Add automated scheduled publishing with cron logging"
git push origin main
```

### **3.2 Deploy**

**Option A: Automatic Deployment**
- Vercel will auto-deploy when you push to `main` branch
- Wait for deployment to complete (~2-3 minutes)

**Option B: Manual Deployment**
```bash
vercel deploy --prod
```

### **3.3 Verify Deployment**

1. Go to Vercel Dashboard → Your Project → Deployments
2. Wait for deployment status: **Ready** ✅
3. Note your production URL: `https://your-app.vercel.app`

---

## ✅ Step 4: Verify Cron Job is Running

### **4.1 Check Vercel Cron Dashboard**

1. Go to Vercel Dashboard → Your Project
2. Click **Cron Jobs** tab (in the left sidebar)
3. You should see:
   - **Path:** `/api/cron/publish-scheduled`
   - **Schedule:** `*/5 * * * *` (Every 5 minutes)
   - **Status:** Active ✅

### **4.2 View Cron Execution Logs**

In Vercel Dashboard → Cron Jobs tab:
- Click on your cron job
- View **Recent Executions**
- Should see executions every 5 minutes
- Click on an execution to see logs

**Example log output:**
```
ℹ️  No variants to publish at 2025-12-10T10:00:00.000Z
```

Or if variants were published:
```
📅 Found 3 variants ready to publish
  ✅ Published variant abc123 (twitter_x)
  ✅ Published variant def456 (instagram_post)
  ✅ Published variant ghi789 (linkedin)
✅ Successfully published 3 variants in 245ms
```

---

## 🧪 Step 5: Test Scheduled Publishing

### **5.1 Create a Test Variant**

1. Go to your app: `http://localhost:3000/posts` (or production URL)
2. Open an existing post or create a new one
3. Generate variants (or use existing)
4. Mark a variant as **Approved**
5. Click **Schedule Publish**
6. Select a time **1-2 minutes in the future**
7. Click **Schedule**

### **5.2 Wait for Auto-Publish**

Within 5 minutes of the scheduled time:
- The cron job will run
- Your variant should change from `scheduled` → `published`
- `published_at` timestamp should be set

### **5.3 Verify in UI**

Refresh the post detail page:
- Variant badge should be **purple** (published)
- Footer should show: `✓ Published: [timestamp]`
- No more action buttons

### **5.4 Check Cron Logs**

Visit: `https://your-app.vercel.app/api/cron/status`

Response should show:
```json
{
  "healthy": true,
  "last_run": {
    "run_at": "2025-12-10T10:05:00.000Z",
    "variants_found": 1,
    "variants_published": 1,
    "variants_failed": 0,
    "duration_ms": 156
  },
  "statistics": {
    "total_runs": 12,
    "total_variants_published": 3,
    "success_rate": 100
  }
}
```

---

## 🔍 Step 6: Monitor Cron Health

### **6.1 Check Cron Status API**

**Endpoint:** `GET /api/cron/status`

**Usage:**
```bash
# Check status
curl https://your-app.vercel.app/api/cron/status

# Get last 20 runs
curl https://your-app.vercel.app/api/cron/status?limit=20
```

**Response fields:**
- `healthy`: Boolean - Is cron running regularly? (last run < 10 min ago)
- `last_run`: Object - Details of most recent execution
- `statistics`: Object - Aggregate stats across all runs
- `current_queue`: Object - How many variants are waiting
- `recent_runs`: Array - Last N cron executions

### **6.2 Check Supabase cron_logs Table**

Go to Supabase → Table Editor → `cron_logs`:
- View all cron executions
- See success/failure counts
- Check error details
- Monitor duration trends

**Example query:**
```sql
-- Get recent cron runs with stats
SELECT
  run_at,
  variants_found,
  variants_published,
  variants_failed,
  duration_ms,
  errors
FROM cron_logs
ORDER BY run_at DESC
LIMIT 10;
```

### **6.3 Check for Failed Publishes**

```sql
-- Find variants that failed to publish
SELECT
  id,
  platform,
  scheduled_at,
  published_error,
  created_at
FROM variants
WHERE published_error IS NOT NULL
ORDER BY scheduled_at DESC;
```

---

## 🐛 Troubleshooting

### **Problem: Cron job not running**

**Symptoms:**
- No executions in Vercel Cron dashboard
- `/api/cron/status` shows `healthy: false`
- Last run was > 10 minutes ago

**Solutions:**
1. Check `vercel.json` is in project root
2. Redeploy: `vercel deploy --prod`
3. Check Vercel Cron tab for errors
4. Verify your Vercel plan supports cron jobs

---

### **Problem: 401 Unauthorized errors**

**Symptoms:**
- Cron logs show "auth_failed" errors
- Vercel logs show 401 responses

**Solutions:**
1. Check `CRON_SECRET` is set in Vercel environment variables
2. Verify the secret matches between `.env.local` and Vercel
3. Redeploy after adding environment variable

---

### **Problem: Variants not publishing**

**Symptoms:**
- Cron runs successfully
- `variants_found: 0` in logs
- Variants still show `scheduled` status

**Solutions:**
1. Check variant `scheduled_at` is in the past:
   ```sql
   SELECT id, platform, scheduled_at, status
   FROM variants
   WHERE status = 'scheduled'
   ORDER BY scheduled_at;
   ```
2. Verify timezone is correct (should be UTC in database)
3. Check for database errors in `cron_logs.errors`

---

### **Problem: Some variants fail to publish**

**Symptoms:**
- `variants_failed > 0` in cron logs
- Errors in `cron_logs.errors` field
- `published_error` column has error messages

**Solutions:**
1. Check specific error in `variants.published_error`
2. Review `cron_logs.errors` JSONB field
3. Common issues:
   - Database connection timeout
   - Invalid variant data
   - Permissions issue

---

## 📊 Step 7: View Cron Logs in Supabase

### **Query Recent Runs**

```sql
-- Last 10 cron executions
SELECT
  run_at,
  variants_found,
  variants_published,
  variants_failed,
  duration_ms,
  CASE
    WHEN variants_failed > 0 THEN '⚠️ Had Errors'
    WHEN variants_found = 0 THEN 'ℹ️ No Variants'
    ELSE '✅ Success'
  END as status
FROM cron_logs
ORDER BY run_at DESC
LIMIT 10;
```

### **Calculate Success Rate**

```sql
-- Success rate over last 24 hours
SELECT
  COUNT(*) as total_runs,
  SUM(variants_found) as total_found,
  SUM(variants_published) as total_published,
  SUM(variants_failed) as total_failed,
  ROUND(
    (SUM(variants_published)::DECIMAL / NULLIF(SUM(variants_found), 0)) * 100,
    2
  ) as success_rate_pct,
  AVG(duration_ms) as avg_duration_ms
FROM cron_logs
WHERE run_at > NOW() - INTERVAL '24 hours';
```

### **Find Error Patterns**

```sql
-- Get all errors from last 100 runs
SELECT
  run_at,
  variants_failed,
  errors
FROM cron_logs
WHERE errors IS NOT NULL
ORDER BY run_at DESC
LIMIT 100;
```

---

## 🎯 Next Steps

After successful deployment:

1. ✅ **Monitor for 24 hours** - Ensure cron runs every 5 minutes
2. ✅ **Schedule a few test posts** - Verify auto-publishing works
3. ✅ **Check success rate** - Should be close to 100%
4. ✅ **Set up alerts** (optional):
   - Create a scheduled email report
   - Use Vercel Log Drains to send logs to monitoring service
   - Set up Slack notifications for failures

5. 🚀 **Move to Priority 2: Bulk Variant Management**

---

## 📝 Cron Schedule Reference

Current schedule: `*/5 * * * *` (Every 5 minutes)

Other common schedules:
- `*/1 * * * *` - Every minute (use sparingly, high quota usage)
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour (at :00)
- `0 */6 * * *` - Every 6 hours
- `0 9 * * *` - Every day at 9:00 AM UTC

To change schedule:
1. Edit `vercel.json`
2. Commit and push
3. Redeploy

---

## ✅ Success Checklist

- [ ] Database migration completed (cron_logs table exists)
- [ ] CRON_SECRET generated and set in Vercel
- [ ] `vercel.json` created in project root
- [ ] Code deployed to Vercel production
- [ ] Cron job visible in Vercel dashboard
- [ ] Test variant scheduled and auto-published
- [ ] `/api/cron/status` returns healthy status
- [ ] Cron logs visible in Supabase `cron_logs` table
- [ ] No errors in last 10 cron runs

**When all boxes are checked, Priority 1 is complete! 🎉**

---

## 🆘 Need Help?

- Check Vercel logs: Dashboard → Project → Functions
- Review cron logs: Dashboard → Cron Jobs → Recent Executions
- Query Supabase: Table Editor → `cron_logs`
- Test manually: `curl https://your-app.vercel.app/api/cron/publish-scheduled -H "Authorization: Bearer YOUR_CRON_SECRET"`

