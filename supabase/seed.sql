-- ============================================================
-- Content Machine — Seed Data
-- ============================================================
-- VERIFIED SCHEMA (2024-12-31):
--
-- workspaces: id, name, created_at
-- clients: id, workspace_id, name, platform_tags, notes, created_at
-- campaigns: id, workspace_id, client_id, platform, external_id, name, objective, status, start_date, end_date, created_at
-- ad_sets: id, workspace_id, client_id, campaign_id, platform, external_id, name, status, daily_budget, lifetime_budget, bid_strategy, first_seen_at, last_seen_at
-- ads: id, workspace_id, client_id, campaign_id, ad_set_id, platform, external_id, name, status, creative_id, landing_page_url, first_seen_at, last_seen_at
-- utm_links: id, workspace_id, name, base_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, final_url, short_url, qr_url, tags, created_by, created_at, updated_at
-- data_uploads: id, workspace_id, platform, filename, file_size, row_count, status, error_message, created_by, created_at, processed_at, [storage_path, error_log, summary, client_id - optional]
--
-- FK CHAIN: workspaces -> clients -> campaigns -> ad_sets -> ads
-- ============================================================

SET client_min_messages TO NOTICE;

-- ============================================================
-- STABLE IDs (deterministic for idempotent seeding)
-- ============================================================
-- Workspace:  00000000-0000-0000-0000-000000000001
-- Clients:    00000000-0000-0000-0000-00000000010X (101, 102, 103)
-- Campaigns:  00000000-0000-0000-0000-00000000020X (201-206)
-- Ad Sets:    00000000-0000-0000-0000-00000000030X (301-312)
-- Ads:        00000000-0000-0000-0000-00000000040X (401-424)
-- UTM Links:  00000000-0000-0000-0000-00000000050X (501-510)
-- ============================================================

DO $$ BEGIN RAISE NOTICE 'Starting seed...'; END $$;

-- ============================================================
-- 1) WORKSPACES
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.workspaces') IS NULL THEN
    RAISE NOTICE 'SKIP: public.workspaces not found';
    RETURN;
  END IF;

  INSERT INTO public.workspaces (id, name, created_at)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Workspace', now() - interval '90 days')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  RAISE NOTICE 'OK: workspaces seeded';
END $$;

-- ============================================================
-- 2) CLIENTS (depends on workspaces)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.clients') IS NULL THEN
    RAISE NOTICE 'SKIP: public.clients not found';
    RETURN;
  END IF;

  INSERT INTO public.clients (id, workspace_id, name, platform_tags, notes, created_at)
  VALUES
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Acme Corp', ARRAY['facebook','google'], 'Primary advertising client', now() - interval '60 days'),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'TechStart Inc', ARRAY['facebook','tiktok'], 'Tech startup client', now() - interval '45 days'),
    ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Fashion Forward', ARRAY['facebook','google','tiktok'], 'E-commerce fashion brand', now() - interval '30 days')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, platform_tags = EXCLUDED.platform_tags;

  RAISE NOTICE 'OK: clients seeded';
END $$;

-- ============================================================
-- 3) UTM_LINKS (depends on workspaces only)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.utm_links') IS NULL THEN
    RAISE NOTICE 'SKIP: public.utm_links not found';
    RETURN;
  END IF;

  INSERT INTO public.utm_links
    (id, workspace_id, name, base_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, final_url, tags, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000001', 'FB - Summer Sale Banner', 'https://example.com/summer-sale', 'facebook', 'paid_social', 'summer_sale_2024', 'banner_728x90', NULL, 'https://example.com/summer-sale?utm_source=facebook&utm_medium=paid_social&utm_campaign=summer_sale_2024&utm_content=banner_728x90', ARRAY['sale','seasonal'], now() - interval '25 days', now() - interval '25 days'),
    ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000001', 'FB - Product Launch Video', 'https://example.com/new-product', 'facebook', 'paid_social', 'product_launch_q4', 'video_15s', NULL, 'https://example.com/new-product?utm_source=facebook&utm_medium=paid_social&utm_campaign=product_launch_q4&utm_content=video_15s', ARRAY['launch','video'], now() - interval '20 days', now() - interval '20 days'),
    ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000001', 'FB - Retargeting Cart', 'https://example.com/cart-reminder', 'facebook', 'retargeting', 'cart_abandonment', 'dynamic_product', NULL, 'https://example.com/cart-reminder?utm_source=facebook&utm_medium=retargeting&utm_campaign=cart_abandonment&utm_content=dynamic_product', ARRAY['retargeting','conversion'], now() - interval '18 days', now() - interval '18 days'),
    ('00000000-0000-0000-0000-000000000504', '00000000-0000-0000-0000-000000000001', 'Google - Brand Search', 'https://example.com', 'google', 'cpc', 'brand_search', 'text_ad', 'brand name', 'https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=brand_search&utm_content=text_ad&utm_term=brand+name', ARRAY['search','brand'], now() - interval '22 days', now() - interval '22 days'),
    ('00000000-0000-0000-0000-000000000505', '00000000-0000-0000-0000-000000000001', 'Google - Product Category', 'https://example.com/products', 'google', 'cpc', 'product_category', 'responsive_search', 'buy shoes online', 'https://example.com/products?utm_source=google&utm_medium=cpc&utm_campaign=product_category&utm_content=responsive_search&utm_term=buy+shoes+online', ARRAY['search','product'], now() - interval '15 days', now() - interval '15 days'),
    ('00000000-0000-0000-0000-000000000506', '00000000-0000-0000-0000-000000000001', 'Google - Display Network', 'https://example.com/promo', 'google', 'display', 'awareness_q4', 'banner_300x250', NULL, 'https://example.com/promo?utm_source=google&utm_medium=display&utm_campaign=awareness_q4&utm_content=banner_300x250', ARRAY['display','awareness'], now() - interval '12 days', now() - interval '12 days'),
    ('00000000-0000-0000-0000-000000000507', '00000000-0000-0000-0000-000000000001', 'Email - Welcome Series', 'https://example.com/welcome', 'email', 'automation', 'welcome_series', 'email_1_cta', NULL, 'https://example.com/welcome?utm_source=email&utm_medium=automation&utm_campaign=welcome_series&utm_content=email_1_cta', ARRAY['email','automation'], now() - interval '28 days', now() - interval '28 days'),
    ('00000000-0000-0000-0000-000000000508', '00000000-0000-0000-0000-000000000001', 'Email - Newsletter Dec', 'https://example.com/newsletter', 'email', 'newsletter', 'monthly_dec_2024', 'hero_button', NULL, 'https://example.com/newsletter?utm_source=email&utm_medium=newsletter&utm_campaign=monthly_dec_2024&utm_content=hero_button', ARRAY['email','newsletter'], now() - interval '5 days', now() - interval '5 days'),
    ('00000000-0000-0000-0000-000000000509', '00000000-0000-0000-0000-000000000001', 'TikTok - Influencer Collab', 'https://example.com/collab', 'tiktok', 'influencer', 'influencer_holiday', 'bio_link', NULL, 'https://example.com/collab?utm_source=tiktok&utm_medium=influencer&utm_campaign=influencer_holiday&utm_content=bio_link', ARRAY['tiktok','influencer'], now() - interval '10 days', now() - interval '10 days'),
    ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000001', 'TikTok - Spark Ads', 'https://example.com/trending', 'tiktok', 'paid_social', 'spark_ads_test', 'in_feed', NULL, 'https://example.com/trending?utm_source=tiktok&utm_medium=paid_social&utm_campaign=spark_ads_test&utm_content=in_feed', ARRAY['tiktok','paid'], now() - interval '8 days', now() - interval '8 days')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, utm_source = EXCLUDED.utm_source;

  RAISE NOTICE 'OK: utm_links seeded';
END $$;

-- ============================================================
-- 4) CAMPAIGNS (depends on workspaces + clients)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.campaigns') IS NULL THEN
    RAISE NOTICE 'SKIP: public.campaigns not found';
    RETURN;
  END IF;

  INSERT INTO public.campaigns (id, workspace_id, client_id, platform, external_id, name, objective, status, start_date, created_at)
  VALUES
    -- Acme Corp campaigns (client 101)
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'meta', 'fb_camp_001', 'Summer Sale 2024 - Conversions', 'conversions', 'active', current_date - 30, now() - interval '30 days'),
    ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'meta', 'fb_camp_002', 'Brand Awareness Q4', 'awareness', 'active', current_date - 25, now() - interval '25 days'),
    -- TechStart campaigns (client 102)
    ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'google', 'ggl_camp_001', 'Search - Brand Terms', 'conversions', 'active', current_date - 28, now() - interval '28 days'),
    ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', 'google', 'ggl_camp_002', 'Display - Remarketing', 'conversions', 'paused', current_date - 20, now() - interval '20 days'),
    -- Fashion Forward campaigns (client 103)
    ('00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 'tiktok', 'tt_camp_001', 'Holiday Spark Ads', 'traffic', 'active', current_date - 15, now() - interval '15 days'),
    ('00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', 'tiktok', 'tt_camp_002', 'Influencer Collab Campaign', 'engagement', 'active', current_date - 10, now() - interval '10 days')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

  RAISE NOTICE 'OK: campaigns seeded';
END $$;

-- ============================================================
-- 5) AD_SETS (depends on campaigns + clients)
-- SCHEMA: uses first_seen_at/last_seen_at (NOT created_at)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.ad_sets') IS NULL THEN
    RAISE NOTICE 'SKIP: public.ad_sets not found';
    RETURN;
  END IF;

  INSERT INTO public.ad_sets (id, workspace_id, client_id, campaign_id, platform, external_id, name, status, daily_budget, first_seen_at, last_seen_at)
  VALUES
    -- Acme Corp ad sets (campaigns 201, 202)
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'meta', 'fb_adset_001', 'Lookalike - Purchasers', 'active', 50.00, now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'meta', 'fb_adset_002', 'Interest - Fashion', 'active', 75.00, now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 'meta', 'fb_adset_003', 'Broad - 18-45', 'active', 100.00, now() - interval '25 days', now() - interval '2 days'),
    ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', 'meta', 'fb_adset_004', 'Retargeting - Website Visitors', 'active', 25.00, now() - interval '25 days', now() - interval '2 days'),
    -- TechStart ad sets (campaigns 203, 204)
    ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', 'google', 'ggl_adset_001', 'Brand Terms - Exact', 'active', 30.00, now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', 'google', 'ggl_adset_002', 'Brand Terms - Phrase', 'active', 30.00, now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', 'google', 'ggl_adset_003', 'Remarketing - All Visitors', 'paused', 40.00, now() - interval '20 days', now() - interval '5 days'),
    ('00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', 'google', 'ggl_adset_004', 'Remarketing - Cart Abandoners', 'paused', 20.00, now() - interval '20 days', now() - interval '5 days'),
    -- Fashion Forward ad sets (campaigns 205, 206)
    ('00000000-0000-0000-0000-000000000309', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', 'tiktok', 'tt_adset_001', 'In-Feed - Gen Z', 'active', 80.00, now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', 'tiktok', 'tt_adset_002', 'TopView - Broad', 'active', 150.00, now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', 'tiktok', 'tt_adset_003', 'Spark Ads - Creator A', 'active', 60.00, now() - interval '10 days', now() - interval '12 hours'),
    ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', 'tiktok', 'tt_adset_004', 'Spark Ads - Creator B', 'active', 60.00, now() - interval '10 days', now() - interval '12 hours')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, last_seen_at = EXCLUDED.last_seen_at;

  RAISE NOTICE 'OK: ad_sets seeded (12 rows)';
END $$;

-- ============================================================
-- 6) ADS (depends on ad_sets + campaigns + clients)
-- SCHEMA: uses first_seen_at/last_seen_at (NOT created_at)
-- ============================================================
DO $$
BEGIN
  IF to_regclass('public.ads') IS NULL THEN
    RAISE NOTICE 'SKIP: public.ads not found';
    RETURN;
  END IF;

  INSERT INTO public.ads (id, workspace_id, client_id, campaign_id, ad_set_id, platform, external_id, name, status, creative_id, landing_page_url, first_seen_at, last_seen_at)
  VALUES
    -- Meta ads for Acme Corp (ad_sets 301-304)
    ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'meta', 'fb_ad_001', 'Carousel - Product Collection', 'active', 'cr_001', 'https://example.com/products', now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000301', 'meta', 'fb_ad_002', 'Video - 15s Testimonial', 'active', 'cr_002', 'https://example.com/testimonials', now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302', 'meta', 'fb_ad_003', 'Single Image - Lifestyle', 'active', 'cr_003', 'https://example.com/lifestyle', now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302', 'meta', 'fb_ad_004', 'Single Image - Product', 'active', 'cr_004', 'https://example.com/product', now() - interval '30 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000303', 'meta', 'fb_ad_005', 'Video - Brand Story', 'active', 'cr_005', 'https://example.com/about', now() - interval '25 days', now() - interval '2 days'),
    ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000303', 'meta', 'fb_ad_006', 'Carousel - Behind the Scenes', 'active', 'cr_006', 'https://example.com/bts', now() - interval '25 days', now() - interval '2 days'),
    ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000304', 'meta', 'fb_ad_007', 'Dynamic - Recent Views', 'active', 'cr_007', 'https://example.com/viewed', now() - interval '25 days', now() - interval '2 days'),
    ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000304', 'meta', 'fb_ad_008', 'Dynamic - Cart Items', 'active', 'cr_008', 'https://example.com/cart', now() - interval '25 days', now() - interval '2 days'),

    -- Google ads for TechStart (ad_sets 305-308)
    ('00000000-0000-0000-0000-000000000409', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000305', 'google', 'ggl_ad_001', 'RSA - Brand Focus', 'active', NULL, 'https://techstart.example.com', now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000410', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000305', 'google', 'ggl_ad_002', 'RSA - Value Proposition', 'active', NULL, 'https://techstart.example.com/value', now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000411', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000306', 'google', 'ggl_ad_003', 'RSA - Offer Highlight', 'active', NULL, 'https://techstart.example.com/offer', now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000412', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000306', 'google', 'ggl_ad_004', 'RSA - CTA Focused', 'active', NULL, 'https://techstart.example.com/cta', now() - interval '28 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000413', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000307', 'google', 'ggl_ad_005', 'Display - Banner 300x250', 'paused', 'cr_gdn_001', 'https://techstart.example.com/promo', now() - interval '20 days', now() - interval '5 days'),
    ('00000000-0000-0000-0000-000000000414', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000307', 'google', 'ggl_ad_006', 'Display - Banner 728x90', 'paused', 'cr_gdn_002', 'https://techstart.example.com/promo', now() - interval '20 days', now() - interval '5 days'),
    ('00000000-0000-0000-0000-000000000415', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000308', 'google', 'ggl_ad_007', 'Display - Responsive', 'paused', 'cr_gdn_003', 'https://techstart.example.com/promo', now() - interval '20 days', now() - interval '5 days'),
    ('00000000-0000-0000-0000-000000000416', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000308', 'google', 'ggl_ad_008', 'Display - HTML5', 'paused', 'cr_gdn_004', 'https://techstart.example.com/promo', now() - interval '20 days', now() - interval '5 days'),

    -- TikTok ads for Fashion Forward (ad_sets 309-312)
    ('00000000-0000-0000-0000-000000000417', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000309', 'tiktok', 'tt_ad_001', 'In-Feed - Trend Dance', 'active', 'cr_tt_001', 'https://fashion.example.com/trend', now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000418', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000309', 'tiktok', 'tt_ad_002', 'In-Feed - Product Demo', 'active', 'cr_tt_002', 'https://fashion.example.com/demo', now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000419', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000310', 'tiktok', 'tt_ad_003', 'TopView - Holiday Theme', 'active', 'cr_tt_003', 'https://fashion.example.com/holiday', now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000420', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000205', '00000000-0000-0000-0000-000000000310', 'tiktok', 'tt_ad_004', 'TopView - Unboxing', 'active', 'cr_tt_004', 'https://fashion.example.com/unbox', now() - interval '15 days', now() - interval '1 day'),
    ('00000000-0000-0000-0000-000000000421', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000311', 'tiktok', 'tt_ad_005', 'Spark - Creator A Original', 'active', 'cr_tt_005', 'https://fashion.example.com/creatora', now() - interval '10 days', now() - interval '12 hours'),
    ('00000000-0000-0000-0000-000000000422', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000311', 'tiktok', 'tt_ad_006', 'Spark - Creator A Remix', 'active', 'cr_tt_006', 'https://fashion.example.com/remix', now() - interval '10 days', now() - interval '12 hours'),
    ('00000000-0000-0000-0000-000000000423', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000312', 'tiktok', 'tt_ad_007', 'Spark - Creator B GRWM', 'active', 'cr_tt_007', 'https://fashion.example.com/grwm', now() - interval '10 days', now() - interval '12 hours'),
    ('00000000-0000-0000-0000-000000000424', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000206', '00000000-0000-0000-0000-000000000312', 'tiktok', 'tt_ad_008', 'Spark - Creator B Review', 'active', 'cr_tt_008', 'https://fashion.example.com/review', now() - interval '10 days', now() - interval '12 hours')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, last_seen_at = EXCLUDED.last_seen_at;

  RAISE NOTICE 'OK: ads seeded (24 rows)';
END $$;

-- ============================================================
-- 7) DATA_UPLOADS (depends on workspaces, optionally clients)
-- SCHEMA: uses error_message (NOT error_text/source/file_url)
-- Optional columns: client_id, storage_path, error_log, summary
-- ============================================================
DO $$
DECLARE
  v_workspace_id UUID := '00000000-0000-0000-0000-000000000001';
  v_client_id UUID := '00000000-0000-0000-0000-000000000101';
  has_client_id BOOLEAN;
  has_storage_path BOOLEAN;
  has_error_log BOOLEAN;
  has_summary BOOLEAN;
BEGIN
  IF to_regclass('public.data_uploads') IS NULL THEN
    RAISE NOTICE 'SKIP: public.data_uploads not found';
    RETURN;
  END IF;

  -- Check optional columns
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='client_id') INTO has_client_id;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='storage_path') INTO has_storage_path;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='error_log') INTO has_error_log;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='data_uploads' AND column_name='summary') INTO has_summary;

  -- Delete existing demo uploads first (idempotent)
  DELETE FROM public.data_uploads WHERE filename LIKE 'demo_%';

  -- Insert based on available columns
  IF has_client_id AND has_storage_path AND has_error_log AND has_summary THEN
    -- Full schema (migration 016 applied)
    INSERT INTO public.data_uploads (workspace_id, client_id, platform, filename, file_size, row_count, status, error_message, created_at, processed_at, storage_path, error_log, summary)
    VALUES
      (v_workspace_id, NULL, 'meta', 'demo_meta_seeded.csv', 1024, 0, 'seeded', NULL, now() - interval '1 day', NULL, NULL, '[]'::jsonb, '{}'::jsonb),
      (v_workspace_id, v_client_id, 'facebook', 'demo_fb_completed.csv', 52480, 120, 'completed', NULL, now() - interval '2 days', now() - interval '2 days', '/demo/facebook/demo_fb_completed.csv', '[]'::jsonb, '{"rows_processed": 120, "rows_imported": 118, "rows_skipped": 2}'::jsonb),
      (v_workspace_id, v_client_id, 'tiktok', 'demo_tiktok_failed.csv', 8192, 0, 'failed', 'Missing required column: spend', now() - interval '3 days', now() - interval '3 days', '/demo/tiktok/demo_tiktok_failed.csv', '[{"row": 1, "field": "spend", "message": "Column not found"}]'::jsonb, '{}'::jsonb),
      (v_workspace_id, NULL, 'meta', 'demo_meta_pending.csv', 4096, 45, 'pending', NULL, now() - interval '4 days', NULL, NULL, '[]'::jsonb, '{}'::jsonb),
      (v_workspace_id, v_client_id, 'linkedin', 'demo_linkedin_processing.csv', 16384, 200, 'processing', NULL, now() - interval '5 days', NULL, '/demo/linkedin/demo_linkedin_processing.csv', '[]'::jsonb, '{}'::jsonb);

    RAISE NOTICE 'OK: data_uploads seeded (5 rows, full schema)';

  ELSIF has_client_id THEN
    -- Partial schema (client_id exists but not other optional columns)
    INSERT INTO public.data_uploads (workspace_id, client_id, platform, filename, file_size, row_count, status, error_message, created_at, processed_at)
    VALUES
      (v_workspace_id, NULL, 'meta', 'demo_meta_seeded.csv', 1024, 0, 'seeded', NULL, now() - interval '1 day', NULL),
      (v_workspace_id, v_client_id, 'facebook', 'demo_fb_completed.csv', 52480, 120, 'completed', NULL, now() - interval '2 days', now() - interval '2 days'),
      (v_workspace_id, v_client_id, 'tiktok', 'demo_tiktok_failed.csv', 8192, 0, 'failed', 'Missing required column: spend', now() - interval '3 days', now() - interval '3 days'),
      (v_workspace_id, NULL, 'meta', 'demo_meta_pending.csv', 4096, 45, 'pending', NULL, now() - interval '4 days', NULL),
      (v_workspace_id, v_client_id, 'linkedin', 'demo_linkedin_processing.csv', 16384, 200, 'processing', NULL, now() - interval '5 days', NULL);

    RAISE NOTICE 'OK: data_uploads seeded (5 rows, with client_id)';

  ELSE
    -- Minimal schema (no optional columns)
    INSERT INTO public.data_uploads (workspace_id, platform, filename, file_size, row_count, status, error_message, created_at, processed_at)
    VALUES
      (v_workspace_id, 'meta', 'demo_meta_seeded.csv', 1024, 0, 'seeded', NULL, now() - interval '1 day', NULL),
      (v_workspace_id, 'facebook', 'demo_fb_completed.csv', 52480, 120, 'completed', NULL, now() - interval '2 days', now() - interval '2 days'),
      (v_workspace_id, 'tiktok', 'demo_tiktok_failed.csv', 8192, 0, 'failed', 'Missing required column: spend', now() - interval '3 days', now() - interval '3 days'),
      (v_workspace_id, 'meta', 'demo_meta_pending.csv', 4096, 45, 'pending', NULL, now() - interval '4 days', NULL),
      (v_workspace_id, 'linkedin', 'demo_linkedin_processing.csv', 16384, 200, 'processing', NULL, now() - interval '5 days', NULL);

    RAISE NOTICE 'OK: data_uploads seeded (5 rows, minimal schema)';
  END IF;

END $$;

-- ============================================================
-- 8) DAILY_METRICS (depends on workspaces, clients, campaigns, ad_sets, ads)
-- Schema: workspace_id, client_id, platform, date, entity_type, campaign_id,
--         ad_set_id, ad_id, currency, spend, impressions, reach, clicks,
--         link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views
-- ============================================================
DO $$
DECLARE
  v_workspace_id UUID := '00000000-0000-0000-0000-000000000001';
  v_client1 UUID := '00000000-0000-0000-0000-000000000101';
  v_client2 UUID := '00000000-0000-0000-0000-000000000102';
  v_client3 UUID := '00000000-0000-0000-0000-000000000103';
  v_campaign1 UUID := '00000000-0000-0000-0000-000000000201';
  v_campaign2 UUID := '00000000-0000-0000-0000-000000000202';
  v_campaign3 UUID := '00000000-0000-0000-0000-000000000203';
  v_campaign5 UUID := '00000000-0000-0000-0000-000000000205';
  v_ad_set1 UUID := '00000000-0000-0000-0000-000000000301';
  v_ad_set3 UUID := '00000000-0000-0000-0000-000000000303';
  v_ad_set5 UUID := '00000000-0000-0000-0000-000000000305';
  v_ad_set9 UUID := '00000000-0000-0000-0000-000000000309';
  v_ad1 UUID := '00000000-0000-0000-0000-000000000401';
  v_ad5 UUID := '00000000-0000-0000-0000-000000000405';
  v_ad9 UUID := '00000000-0000-0000-0000-000000000409';
  v_ad17 UUID := '00000000-0000-0000-0000-000000000417';
BEGIN
  IF to_regclass('public.daily_metrics') IS NULL THEN
    RAISE NOTICE 'SKIP: public.daily_metrics not found';
    RETURN;
  END IF;

  -- Delete existing demo metrics first (idempotent)
  DELETE FROM public.daily_metrics WHERE workspace_id = v_workspace_id;

  -- Insert metrics for last 7 days across different clients/platforms
  -- Day 1 (today - 1 day): Meta ads for Acme Corp
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client1, 'meta', current_date - 1, 'campaign', v_campaign1, NULL, NULL, 'VND', 2500000, 45000, 38000, 1200, 980, 2.67, 2083, 55556, 45, 12500000, 55556, 8500),
    (v_workspace_id, v_client1, 'meta', current_date - 1, 'ad_set', v_campaign1, v_ad_set1, NULL, 'VND', 1500000, 28000, 24000, 750, 620, 2.68, 2000, 53571, 28, 7800000, 53571, 5200),
    (v_workspace_id, v_client1, 'meta', current_date - 1, 'ad', v_campaign1, v_ad_set1, v_ad1, 'VND', 800000, 15000, 13000, 420, 350, 2.80, 1905, 53333, 16, 4500000, 50000, 2800);

  -- Day 2: Meta ads for Acme Corp (Brand Awareness)
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client1, 'meta', current_date - 2, 'campaign', v_campaign2, NULL, NULL, 'VND', 3200000, 85000, 72000, 2100, 1650, 2.47, 1524, 37647, 22, 6800000, 145455, 15000),
    (v_workspace_id, v_client1, 'meta', current_date - 2, 'ad_set', v_campaign2, v_ad_set3, NULL, 'VND', 1800000, 48000, 41000, 1200, 940, 2.50, 1500, 37500, 12, 3800000, 150000, 8500),
    (v_workspace_id, v_client1, 'meta', current_date - 2, 'ad', v_campaign2, v_ad_set3, v_ad5, 'VND', 950000, 25000, 21500, 640, 500, 2.56, 1484, 38000, 6, 1900000, 158333, 4500);

  -- Day 3: Google ads for TechStart
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client2, 'google', current_date - 3, 'campaign', v_campaign3, NULL, NULL, 'VND', 1800000, 22000, 18500, 880, 880, 4.00, 2045, 81818, 35, 9200000, 51429, 0),
    (v_workspace_id, v_client2, 'google', current_date - 3, 'ad_set', v_campaign3, v_ad_set5, NULL, 'VND', 900000, 11000, 9200, 450, 450, 4.09, 2000, 81818, 18, 4700000, 50000, 0),
    (v_workspace_id, v_client2, 'google', current_date - 3, 'ad', v_campaign3, v_ad_set5, v_ad9, 'VND', 480000, 5800, 4900, 240, 240, 4.14, 2000, 82759, 10, 2600000, 48000, 0);

  -- Day 4: TikTok ads for Fashion Forward
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client3, 'tiktok', current_date - 4, 'campaign', v_campaign5, NULL, NULL, 'VND', 4200000, 125000, 98000, 3800, 2900, 3.04, 1105, 33600, 85, 21500000, 49412, 45000),
    (v_workspace_id, v_client3, 'tiktok', current_date - 4, 'ad_set', v_campaign5, v_ad_set9, NULL, 'VND', 2100000, 62000, 49000, 1900, 1450, 3.06, 1105, 33871, 42, 10800000, 50000, 22500),
    (v_workspace_id, v_client3, 'tiktok', current_date - 4, 'ad', v_campaign5, v_ad_set9, v_ad17, 'VND', 1100000, 32000, 25500, 1000, 760, 3.13, 1100, 34375, 22, 5700000, 50000, 12000);

  -- Day 5: Mixed platforms
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client1, 'meta', current_date - 5, 'campaign', v_campaign1, NULL, NULL, 'VND', 2200000, 42000, 35000, 1100, 890, 2.62, 2000, 52381, 40, 11000000, 55000, 7800),
    (v_workspace_id, v_client2, 'google', current_date - 5, 'campaign', v_campaign3, NULL, NULL, 'VND', 1650000, 20000, 17000, 820, 820, 4.10, 2012, 82500, 32, 8500000, 51563, 0),
    (v_workspace_id, v_client3, 'tiktok', current_date - 5, 'campaign', v_campaign5, NULL, NULL, 'VND', 3800000, 115000, 90000, 3500, 2680, 3.04, 1086, 33043, 78, 19800000, 48718, 41000);

  -- Day 6: More variety
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client1, 'meta', current_date - 6, 'campaign', v_campaign1, NULL, NULL, 'VND', 2350000, 43500, 36500, 1150, 930, 2.64, 2043, 54023, 42, 11800000, 55952, 8100),
    (v_workspace_id, v_client1, 'meta', current_date - 6, 'campaign', v_campaign2, NULL, NULL, 'VND', 2900000, 78000, 66000, 1950, 1520, 2.50, 1487, 37179, 20, 6200000, 145000, 13800);

  -- Day 7: Historical data
  INSERT INTO public.daily_metrics (workspace_id, client_id, platform, date, entity_type, campaign_id, ad_set_id, ad_id, currency, spend, impressions, reach, clicks, link_clicks, ctr, cpc, cpm, conversions, conversion_value, cpa, video_views)
  VALUES
    (v_workspace_id, v_client1, 'meta', current_date - 7, 'campaign', v_campaign1, NULL, NULL, 'VND', 2100000, 40000, 33500, 1050, 850, 2.63, 2000, 52500, 38, 10500000, 55263, 7500),
    (v_workspace_id, v_client2, 'google', current_date - 7, 'campaign', v_campaign3, NULL, NULL, 'VND', 1550000, 19000, 16000, 780, 780, 4.11, 1987, 81579, 30, 8000000, 51667, 0),
    (v_workspace_id, v_client3, 'tiktok', current_date - 7, 'campaign', v_campaign5, NULL, NULL, 'VND', 3600000, 108000, 85000, 3300, 2520, 3.06, 1091, 33333, 72, 18300000, 50000, 38500);

  RAISE NOTICE 'OK: daily_metrics seeded (21 rows for last 7 days)';
END $$;

-- ============================================================
-- 9) ADLAB_INGESTION_LOGS (depends on workspaces, optionally clients)
-- Required for freshness status monitoring
-- ============================================================
DO $$
DECLARE
  v_workspace_id UUID := '00000000-0000-0000-0000-000000000001';
  v_client1 UUID := '00000000-0000-0000-0000-000000000101';
BEGIN
  IF to_regclass('public.adlab_ingestion_logs') IS NULL THEN
    RAISE NOTICE 'SKIP: public.adlab_ingestion_logs not found';
    RETURN;
  END IF;

  -- Delete existing demo logs first (idempotent)
  DELETE FROM public.adlab_ingestion_logs WHERE workspace_id = v_workspace_id;

  -- Insert recent successful ingestion logs to show "fresh" status
  -- These represent the last successful data ingestions per dataset/platform
  INSERT INTO public.adlab_ingestion_logs (workspace_id, client_id, platform, dataset, status, row_count, promoted_at, created_at)
  VALUES
    -- Daily metrics ingestions (recent - shows as fresh)
    (v_workspace_id, NULL, 'meta', 'daily_metrics', 'pass', 150, now() - interval '2 hours', now() - interval '3 hours'),
    (v_workspace_id, NULL, 'google', 'daily_metrics', 'pass', 85, now() - interval '4 hours', now() - interval '5 hours'),
    (v_workspace_id, NULL, 'tiktok', 'daily_metrics', 'pass', 120, now() - interval '6 hours', now() - interval '7 hours'),

    -- Ads/Campaigns structure ingestions (all platforms for freshness)
    (v_workspace_id, NULL, 'meta', 'ads', 'pass', 24, now() - interval '6 hours', now() - interval '7 hours'),
    (v_workspace_id, NULL, 'meta', 'ad_sets', 'pass', 12, now() - interval '6 hours', now() - interval '7 hours'),
    (v_workspace_id, NULL, 'meta', 'campaigns', 'pass', 6, now() - interval '6 hours', now() - interval '7 hours'),
    (v_workspace_id, NULL, 'meta', 'alerts', 'pass', 3, now() - interval '1 hour', now() - interval '2 hours'),

    -- Google platform coverage
    (v_workspace_id, NULL, 'google', 'ads', 'pass', 8, now() - interval '8 hours', now() - interval '9 hours'),
    (v_workspace_id, NULL, 'google', 'ad_sets', 'pass', 4, now() - interval '8 hours', now() - interval '9 hours'),
    (v_workspace_id, NULL, 'google', 'campaigns', 'pass', 2, now() - interval '8 hours', now() - interval '9 hours'),
    (v_workspace_id, NULL, 'google', 'alerts', 'pass', 1, now() - interval '2 hours', now() - interval '3 hours'),

    -- TikTok platform coverage
    (v_workspace_id, NULL, 'tiktok', 'ads', 'pass', 8, now() - interval '10 hours', now() - interval '11 hours'),
    (v_workspace_id, NULL, 'tiktok', 'ad_sets', 'pass', 4, now() - interval '10 hours', now() - interval '11 hours'),
    (v_workspace_id, NULL, 'tiktok', 'campaigns', 'pass', 2, now() - interval '10 hours', now() - interval '11 hours'),
    (v_workspace_id, NULL, 'tiktok', 'alerts', 'pass', 2, now() - interval '3 hours', now() - interval '4 hours'),

    -- Client-specific ingestion
    (v_workspace_id, v_client1, 'meta', 'daily_metrics', 'pass', 45, now() - interval '3 hours', now() - interval '4 hours');

  RAISE NOTICE 'OK: adlab_ingestion_logs seeded (16 rows)';
END $$;

-- ============================================================
-- FINAL SUMMARY
-- ============================================================
DO $$
DECLARE
  cnt BIGINT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'SEED COMPLETE - ROW COUNTS:';
  RAISE NOTICE '============================================';

  IF to_regclass('public.workspaces') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.workspaces;
    RAISE NOTICE '  workspaces:   % rows', cnt;
  END IF;

  IF to_regclass('public.clients') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.clients;
    RAISE NOTICE '  clients:      % rows', cnt;
  END IF;

  IF to_regclass('public.utm_links') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.utm_links;
    RAISE NOTICE '  utm_links:    % rows', cnt;
  END IF;

  IF to_regclass('public.campaigns') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.campaigns;
    RAISE NOTICE '  campaigns:    % rows', cnt;
  END IF;

  IF to_regclass('public.ad_sets') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.ad_sets;
    RAISE NOTICE '  ad_sets:      % rows', cnt;
  END IF;

  IF to_regclass('public.ads') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.ads;
    RAISE NOTICE '  ads:          % rows', cnt;
  END IF;

  IF to_regclass('public.data_uploads') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.data_uploads;
    RAISE NOTICE '  data_uploads: % rows', cnt;
  END IF;

  IF to_regclass('public.daily_metrics') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.daily_metrics;
    RAISE NOTICE '  daily_metrics: % rows', cnt;
  END IF;

  IF to_regclass('public.adlab_ingestion_logs') IS NOT NULL THEN
    SELECT COUNT(*) INTO cnt FROM public.adlab_ingestion_logs;
    RAISE NOTICE '  adlab_ingestion_logs: % rows', cnt;
  END IF;

  RAISE NOTICE '============================================';
END $$;
