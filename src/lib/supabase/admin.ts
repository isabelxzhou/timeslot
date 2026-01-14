import { createClient } from '@supabase/supabase-js'

// Using untyped client for flexibility - types can be added after running supabase gen types
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
