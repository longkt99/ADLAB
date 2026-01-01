-- Migration: Add 'scheduled' status to variants workflow
-- Run this in Supabase SQL Editor

-- Drop the old constraint
ALTER TABLE variants DROP CONSTRAINT IF EXISTS variants_status_check;

-- Add new constraint with 'scheduled' status
ALTER TABLE variants
ADD CONSTRAINT variants_status_check
CHECK (status IN ('draft', 'approved', 'scheduled', 'published'));
