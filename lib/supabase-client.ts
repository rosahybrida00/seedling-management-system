import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY

// Keep the client import-safe when the preview environment has not injected its
// project variables yet. Requests will fail gracefully in the calling feature
// instead of crashing the entire application during module evaluation.
const clientUrl = supabaseUrl || "https://placeholder.supabase.co"
const clientKey = supabaseAnonKey || "placeholder-anon-key"

export const supabase = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
