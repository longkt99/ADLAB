-- Content Machine Database Schema
-- Multi-platform content engine
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Posts table (base content)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_time TIMESTAMPTZ,
  cover_image_url TEXT,
  platforms TEXT[], -- Array of platform identifiers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Variants table (platform-specific adaptations)
CREATE TABLE IF NOT EXISTS variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  base_post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  language TEXT NOT NULL, -- 'vi', 'en', 'both'
  content TEXT NOT NULL,
  character_count INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_time ON posts(scheduled_time) WHERE scheduled_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created_by ON posts(created_by);
CREATE INDEX IF NOT EXISTS idx_variants_base_post_id ON variants(base_post_id);
CREATE INDEX IF NOT EXISTS idx_variants_platform ON variants(platform);
CREATE INDEX IF NOT EXISTS idx_variants_status ON variants(status);
CREATE INDEX IF NOT EXISTS idx_variants_scheduled_time ON variants(scheduled_time) WHERE scheduled_time IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for posts table
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for posts
DROP POLICY IF EXISTS "Enable read access for all users" ON posts;
CREATE POLICY "Enable read access for all users"
  ON posts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON posts;
CREATE POLICY "Enable insert for authenticated users"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for post creators" ON posts;
CREATE POLICY "Enable update for post creators"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR created_by IS NULL);

DROP POLICY IF EXISTS "Enable delete for post creators" ON posts;
CREATE POLICY "Enable delete for post creators"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR created_by IS NULL);

-- RLS Policies for variants
DROP POLICY IF EXISTS "Enable read access for all users" ON variants;
CREATE POLICY "Enable read access for all users"
  ON variants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON variants;
CREATE POLICY "Enable insert for authenticated users"
  ON variants FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON variants;
CREATE POLICY "Enable update for authenticated users"
  ON variants FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON variants;
CREATE POLICY "Enable delete for authenticated users"
  ON variants FOR DELETE
  TO authenticated
  USING (true);

-- Storage bucket for post images
-- Note: Run this only if the bucket doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for post-images bucket
CREATE POLICY "Public read access for post images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can update post images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can delete post images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'post-images');
