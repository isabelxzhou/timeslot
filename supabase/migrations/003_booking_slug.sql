-- Migration: 003_booking_slug.sql
-- Add unique booking slug for personalized booking links

-- Add booking_slug column to owner_settings
ALTER TABLE owner_settings
ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(50) UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX IF NOT EXISTS idx_owner_settings_booking_slug ON owner_settings(booking_slug);

-- Function to generate a random slug
CREATE OR REPLACE FUNCTION generate_booking_slug()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Also add to google_accounts table for multi-account support
ALTER TABLE google_accounts
ADD COLUMN IF NOT EXISTS booking_slug VARCHAR(50) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_google_accounts_booking_slug ON google_accounts(booking_slug);
