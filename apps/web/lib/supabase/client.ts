import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in browser (Client Components).
 * Uses @supabase/ssr createBrowserClient which handles cookies automatically.
 *
 * Usage:
 *   const supabase = createClient()
 *   const { data } = await supabase.from('venues').select('*')
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
