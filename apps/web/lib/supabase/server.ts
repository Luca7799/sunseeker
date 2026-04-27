import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads/writes auth cookies via Next.js `cookies()`.
 *
 * Usage (Server Component):
 *   const supabase = createClient()
 *   const { data } = await supabase.from('venues').select('*')
 *
 * Note: This function must only be called from server-side code.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll called from a Server Component — cookie mutations are
            // only possible in Middleware or Route Handlers. Safe to ignore
            // if session refresh is handled by middleware.
          }
        },
      },
    },
  )
}

/**
 * Creates a Supabase admin client using the service-role key.
 * Use only in trusted server contexts (Route Handlers, scripts).
 * NEVER expose the service-role key to the browser.
 */
export function createAdminClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore in Server Components — see comment above
          }
        },
      },
    },
  )
}
