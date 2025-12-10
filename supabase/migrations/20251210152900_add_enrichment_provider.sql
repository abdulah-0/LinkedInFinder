-- Add enrichment_provider column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enrichment_provider TEXT DEFAULT 'contactout';
