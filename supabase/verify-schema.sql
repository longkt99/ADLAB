-- ============================================================
-- SAFE SCHEMA VERIFICATION SCRIPT
-- ============================================================
-- This script NEVER crashes if a table is missing.
-- Run with: docker exec -i supabase_db_Content_Machine psql -U postgres -d postgres < supabase/verify-schema.sql
-- ============================================================

SET client_min_messages TO NOTICE;

\echo '============================================================'
\echo 'SCHEMA VERIFICATION REPORT'
\echo '============================================================'

-- ============================================================
-- 1. TABLE EXISTENCE CHECK
-- ============================================================
\echo ''
\echo '>>> 1. TABLE EXISTENCE'

DO $$
DECLARE
  tables TEXT[] := ARRAY['workspaces','clients','campaigns','ad_sets','ads','utm_links','data_uploads'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      RAISE NOTICE '  %: EXISTS', t;
    ELSE
      RAISE WARNING '  %: MISSING', t;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 2. ROW COUNTS (safe - only queries existing tables)
-- ============================================================
\echo ''
\echo '>>> 2. ROW COUNTS'

DO $$
DECLARE
  cnt BIGINT;
BEGIN
  IF to_regclass('public.workspaces') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.workspaces' INTO cnt;
    RAISE NOTICE '  workspaces:   % rows', cnt;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.clients' INTO cnt;
    RAISE NOTICE '  clients:      % rows', cnt;
  END IF;

  IF to_regclass('public.campaigns') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.campaigns' INTO cnt;
    RAISE NOTICE '  campaigns:    % rows', cnt;
  END IF;

  IF to_regclass('public.ad_sets') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.ad_sets' INTO cnt;
    RAISE NOTICE '  ad_sets:      % rows', cnt;
  END IF;

  IF to_regclass('public.ads') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.ads' INTO cnt;
    RAISE NOTICE '  ads:          % rows', cnt;
  END IF;

  IF to_regclass('public.utm_links') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.utm_links' INTO cnt;
    RAISE NOTICE '  utm_links:    % rows', cnt;
  END IF;

  IF to_regclass('public.data_uploads') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.data_uploads' INTO cnt;
    RAISE NOTICE '  data_uploads: % rows', cnt;
  END IF;
END $$;

-- ============================================================
-- 3. COLUMN DETAILS (per table)
-- ============================================================
\echo ''
\echo '>>> 3. COLUMN DETAILS'

\echo ''
\echo '--- workspaces ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'workspaces'
ORDER BY ordinal_position;

\echo ''
\echo '--- clients ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY ordinal_position;

\echo ''
\echo '--- campaigns ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'campaigns'
ORDER BY ordinal_position;

\echo ''
\echo '--- ad_sets ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ad_sets'
ORDER BY ordinal_position;

\echo ''
\echo '--- ads ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ads'
ORDER BY ordinal_position;

\echo ''
\echo '--- utm_links ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'utm_links'
ORDER BY ordinal_position;

\echo ''
\echo '--- data_uploads ---'
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'data_uploads'
ORDER BY ordinal_position;

-- ============================================================
-- 4. FOREIGN KEY RELATIONSHIPS
-- ============================================================
\echo ''
\echo '>>> 4. FOREIGN KEY RELATIONSHIPS'

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name IN ('clients','utm_links','campaigns','ad_sets','ads','data_uploads')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================
-- 5. CHECK CONSTRAINTS
-- ============================================================
\echo ''
\echo '>>> 5. CHECK CONSTRAINTS'

SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conrelid IN (
  'public.data_uploads'::regclass,
  'public.ads'::regclass,
  'public.ad_sets'::regclass,
  'public.campaigns'::regclass
) AND contype = 'c'
ORDER BY conrelid::regclass::text, conname;

-- ============================================================
-- 6. SAMPLE DATA (LIMIT 5 per table)
-- ============================================================
\echo ''
\echo '>>> 6. SAMPLE DATA'

\echo ''
\echo '--- workspaces (LIMIT 5) ---'
SELECT id, name, created_at FROM public.workspaces LIMIT 5;

\echo ''
\echo '--- clients (LIMIT 5) ---'
SELECT id, workspace_id, name, platform_tags FROM public.clients LIMIT 5;

\echo ''
\echo '--- campaigns (LIMIT 5) ---'
SELECT id, workspace_id, client_id, platform, name, status FROM public.campaigns LIMIT 5;

\echo ''
\echo '--- ad_sets (LIMIT 5) ---'
SELECT id, campaign_id, platform, name, status, first_seen_at, last_seen_at FROM public.ad_sets LIMIT 5;

\echo ''
\echo '--- ads (LIMIT 5) ---'
SELECT id, ad_set_id, platform, name, status, first_seen_at, last_seen_at FROM public.ads LIMIT 5;

\echo ''
\echo '--- utm_links (LIMIT 5) ---'
SELECT id, workspace_id, name, utm_source, utm_campaign FROM public.utm_links LIMIT 5;

\echo ''
\echo '--- data_uploads (LIMIT 5) ---'
SELECT id, workspace_id, platform, filename, status, error_message, client_id FROM public.data_uploads LIMIT 5;

-- ============================================================
-- 7. CRITICAL COLUMN CHECKS
-- ============================================================
\echo ''
\echo '>>> 7. CRITICAL COLUMN CHECKS'

DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  RAISE NOTICE '--- ads table ---';
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='first_seen_at') INTO col_exists;
  RAISE NOTICE '  first_seen_at: %', CASE WHEN col_exists THEN 'EXISTS (correct)' ELSE 'MISSING' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='last_seen_at') INTO col_exists;
  RAISE NOTICE '  last_seen_at: %', CASE WHEN col_exists THEN 'EXISTS (correct)' ELSE 'MISSING' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ads' AND column_name='created_at') INTO col_exists;
  RAISE NOTICE '  created_at: %', CASE WHEN col_exists THEN 'EXISTS (unexpected)' ELSE 'NOT PRESENT (correct)' END;

  RAISE NOTICE '--- ad_sets table ---';
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='first_seen_at') INTO col_exists;
  RAISE NOTICE '  first_seen_at: %', CASE WHEN col_exists THEN 'EXISTS (correct)' ELSE 'MISSING' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ad_sets' AND column_name='last_seen_at') INTO col_exists;
  RAISE NOTICE '  last_seen_at: %', CASE WHEN col_exists THEN 'EXISTS (correct)' ELSE 'MISSING' END;

  RAISE NOTICE '--- data_uploads table ---';
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='error_message') INTO col_exists;
  RAISE NOTICE '  error_message: %', CASE WHEN col_exists THEN 'EXISTS (correct)' ELSE 'MISSING' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='source') INTO col_exists;
  RAISE NOTICE '  source: %', CASE WHEN col_exists THEN 'EXISTS (wrong!)' ELSE 'NOT PRESENT (correct)' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='file_url') INTO col_exists;
  RAISE NOTICE '  file_url: %', CASE WHEN col_exists THEN 'EXISTS (wrong!)' ELSE 'NOT PRESENT (correct)' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='error_text') INTO col_exists;
  RAISE NOTICE '  error_text: %', CASE WHEN col_exists THEN 'EXISTS (wrong!)' ELSE 'NOT PRESENT (correct)' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='client_id') INTO col_exists;
  RAISE NOTICE '  client_id: %', CASE WHEN col_exists THEN 'EXISTS' ELSE 'NOT PRESENT' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='storage_path') INTO col_exists;
  RAISE NOTICE '  storage_path: %', CASE WHEN col_exists THEN 'EXISTS' ELSE 'NOT PRESENT' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='error_log') INTO col_exists;
  RAISE NOTICE '  error_log: %', CASE WHEN col_exists THEN 'EXISTS' ELSE 'NOT PRESENT' END;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='summary') INTO col_exists;
  RAISE NOTICE '  summary: %', CASE WHEN col_exists THEN 'EXISTS' ELSE 'NOT PRESENT' END;
END $$;

\echo ''
\echo '============================================================'
\echo 'VERIFICATION COMPLETE'
\echo '============================================================'
