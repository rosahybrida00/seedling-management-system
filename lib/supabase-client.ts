import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY

const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Keep the module importable during local setup and preview boot. The fallback
// client is deliberately non-persistent and never points at a real project.
const inactiveUrl = "https://inactive-supabase.invalid"
const inactiveKey = "inactive-supabase-key"

export const supabase = createClient(
  supabaseUrl ?? inactiveUrl,
  supabaseAnonKey ?? inactiveKey,
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
)

export { isSupabaseConfigured }
