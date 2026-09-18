import { createClient } from "@supabase/supabase-js"

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const configuredAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY

// Keep module evaluation safe when Preview briefly starts before env vars are injected.
// Requests made with the fallback client fail closed instead of crashing the application.
const fallbackUrl = "https://fallback.supabase.co"
const fallbackAnonKey = "supabase-config-missing"

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey)

export const supabase = createClient(
  configuredUrl || fallbackUrl,
  configuredAnonKey || fallbackAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
