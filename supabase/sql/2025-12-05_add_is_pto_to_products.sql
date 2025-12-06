-- Add is_pto (pack-to-order) boolean column to products
-- Run with psql or via Supabase SQL editor / migrations

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_pto boolean NOT NULL DEFAULT false;

-- No index required for a simple boolean flag unless queries demand it.
