export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      owner_settings: {
        Row: {
          id: string
          email: string
          name: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expiry: string | null
          calendar_ids: Json
          timezone: string
          slot_duration_minutes: number
          buffer_minutes: number
          weekly_schedule: Json
          booking_window_days: number
          min_notice_hours: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          calendar_ids?: Json
          timezone?: string
          slot_duration_minutes?: number
          buffer_minutes?: number
          weekly_schedule?: Json
          booking_window_days?: number
          min_notice_hours?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expiry?: string | null
          calendar_ids?: Json
          timezone?: string
          slot_duration_minutes?: number
          buffer_minutes?: number
          weekly_schedule?: Json
          booking_window_days?: number
          min_notice_hours?: number
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          guest_name: string
          guest_email: string
          message: string | null
          start_time: string
          end_time: string
          timezone: string
          status: string
          google_event_id: string | null
          cancelled_at: string | null
          cancellation_reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          guest_name: string
          guest_email: string
          message?: string | null
          start_time: string
          end_time: string
          timezone: string
          status?: string
          google_event_id?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          guest_name?: string
          guest_email?: string
          message?: string | null
          start_time?: string
          end_time?: string
          timezone?: string
          status?: string
          google_event_id?: string | null
          cancelled_at?: string | null
          cancellation_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      blocked_dates: {
        Row: {
          id: string
          start_time: string
          end_time: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          start_time: string
          end_time: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          start_time?: string
          end_time?: string
          reason?: string | null
          created_at?: string
        }
      }
    }
  }
}

export type OwnerSettings = Database['public']['Tables']['owner_settings']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type BlockedDate = Database['public']['Tables']['blocked_dates']['Row']
