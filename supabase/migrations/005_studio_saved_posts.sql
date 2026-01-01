-- AI Studio Saved Posts Library
-- Stores AI-generated content from the Studio for quick access
-- Run this SQL in your Supabase SQL Editor

-- Create studio_saved_posts table
CREATE TABLE IF NOT EXISTS studio_saved_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'studio' CHECK (source IN ('studio', 'template', 'imported')),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_studio_saved_posts_user_id ON studio_saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_saved_posts_created_at ON studio_saved_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_saved_posts_source ON studio_saved_posts(source);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_studio_saved_posts_updated_at ON studio_saved_posts;
CREATE TRIGGER update_studio_saved_posts_updated_at
  BEFORE UPDATE ON studio_saved_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE studio_saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for studio_saved_posts
-- Allow all users to read for now (can be restricted to user_id later)
DROP POLICY IF EXISTS "Enable read access for all users" ON studio_saved_posts;
CREATE POLICY "Enable read access for all users"
  ON studio_saved_posts FOR SELECT
  USING (true);

-- Allow authenticated users to insert
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.studio_saved_posts;
CREATE POLICY "Enable insert for authenticated users"
  ON studio_saved_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own posts (when user_id is implemented)
DROP POLICY IF EXISTS "Enable update for creators" ON studio_saved_posts;
CREATE POLICY "Enable update for creators"
  ON studio_saved_posts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Allow users to delete their own posts
DROP POLICY IF EXISTS "Enable delete for creators" ON studio_saved_posts;
CREATE POLICY "Enable delete for creators"
  ON studio_saved_posts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Add comment for documentation
COMMENT ON TABLE studio_saved_posts IS 'Stores AI-generated content from the Studio for the Library feature';
COMMENT ON COLUMN studio_saved_posts.meta IS 'JSON metadata: toneId, useCaseId, language, platforms, etc.';
