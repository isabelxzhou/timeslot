-- Migration: 001_initial_schema.sql
-- TimeSlot booking system database schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- OWNER SETTINGS TABLE
-- ===========================================
CREATE TABLE owner_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    google_access_token TEXT,
    google_refresh_token TEXT,
    google_token_expiry TIMESTAMPTZ,
    calendar_ids JSONB DEFAULT '["primary"]'::jsonb,
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    slot_duration_minutes INTEGER DEFAULT 30,
    buffer_minutes INTEGER DEFAULT 0,
    weekly_schedule JSONB DEFAULT '{
        "monday": [{"start": "09:00", "end": "17:00"}],
        "tuesday": [{"start": "09:00", "end": "17:00"}],
        "wednesday": [{"start": "09:00", "end": "17:00"}],
        "thursday": [{"start": "09:00", "end": "17:00"}],
        "friday": [{"start": "09:00", "end": "17:00"}],
        "saturday": [],
        "sunday": []
    }'::jsonb,
    booking_window_days INTEGER DEFAULT 30,
    min_notice_hours INTEGER DEFAULT 24,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- BOOKINGS TABLE
-- ===========================================
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guest_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255) NOT NULL,
    message TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'confirmed',
    google_event_id VARCHAR(255),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- BLOCKED DATES TABLE
-- ===========================================
CREATE TABLE blocked_dates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_guest_email ON bookings(guest_email);
CREATE INDEX idx_blocked_dates_range ON blocked_dates(start_time, end_time);

-- ===========================================
-- TRIGGERS
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_owner_settings_updated_at
    BEFORE UPDATE ON owner_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- BOOKING CONFLICT CHECK FUNCTION
-- ===========================================
CREATE OR REPLACE FUNCTION create_booking_if_available(
    p_guest_name TEXT,
    p_guest_email TEXT,
    p_message TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_timezone TEXT
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
BEGIN
    -- Lock and check for conflicts
    IF EXISTS (
        SELECT 1 FROM bookings
        WHERE status = 'confirmed'
        AND start_time < p_end_time
        AND end_time > p_start_time
        FOR UPDATE
    ) THEN
        RAISE EXCEPTION 'Slot no longer available';
    END IF;

    -- Insert booking
    INSERT INTO bookings (guest_name, guest_email, message, start_time, end_time, timezone)
    VALUES (p_guest_name, p_guest_email, p_message, p_start_time, p_end_time, p_timezone)
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql;
