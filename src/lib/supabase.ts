import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// A key copied from a dashboard while still masked contains bullet characters.
// Those cannot go into an HTTP header, so every query dies with an opaque
// "String contains non ISO-8859-1 code point" from deep inside the client.
// Catch it here, where we can name the real cause.
const isPlainAscii = (v: string) => /^[\x20-\x7E]+$/.test(v)

export const supabaseConfigError: string | null = (() => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.'
  }
  if (!isPlainAscii(supabaseAnonKey)) {
    return 'The Supabase key is masked, not the real key — it contains bullet characters. In the Supabase dashboard, reveal the anon key before copying it, then update NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  }
  if (!isPlainAscii(supabaseUrl)) {
    return 'NEXT_PUBLIC_SUPABASE_URL contains invalid characters. Re-copy it from the Supabase dashboard.'
  }
  return null
})()

if (supabaseConfigError) {
  console.warn('[supabase]', supabaseConfigError)
}

// Never throw at module load: this file is imported by pages that Next.js
// prerenders at build time, where a throw fails the entire build. Strip any
// non-ASCII so the client can still be constructed and the friendly message
// above is what the user sees.
export const supabase = createClient<Database>(
  supabaseUrl?.replace(/[^\x20-\x7E]/g, '') || 'https://placeholder.supabase.co',
  supabaseAnonKey?.replace(/[^\x20-\x7E]/g, '') || 'placeholder-anon-key'
)
