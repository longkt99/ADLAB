-- Migration: Add workflow and scheduling columns to variants table
-- Run this in Supabase SQL Editor

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'status'
  ) THEN
    ALTER TABLE variants ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
  END IF;
END $$;

-- Add scheduled_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE variants ADD COLUMN scheduled_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Add published_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'published_at'
  ) THEN
    ALTER TABLE variants ADD COLUMN published_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- Add platform_post_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'platform_post_url'
  ) THEN
    ALTER TABLE variants ADD COLUMN platform_post_url TEXT NULL;
  END IF;
END $$;

-- Add check constraint for status values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'variants_status_check'
  ) THEN
    ALTER TABLE variants
    ADD CONSTRAINT variants_status_check
    CHECK (status IN ('draft', 'approved', 'published'));
  END IF;
END $$;

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS variants_status_idx ON variants(status);

-- Create index on scheduled_at for scheduling queries
CREATE INDEX IF NOT EXISTS variants_scheduled_at_idx ON variants(scheduled_at);

-- Update existing rows to have default status if NULL
UPDATE variants SET status = 'draft' WHERE status IS NULL;
