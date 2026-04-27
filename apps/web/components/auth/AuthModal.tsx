'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'

// ---------------------------------------------------------------------------
// Hook context
// ---------------------------------------------------------------------------

interface AuthModalContextValue {
  openWithReason: (reason: string) => void
  close: () => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function useAuthModal() {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider + Modal
// ---------------------------------------------------------------------------

export function AuthModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('Sign in to continue')
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const openWithReason = useCallback((r: string) => {
    setReason(r)
    setEmailSent(false)
    setEmail('')
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Error sending link', description: error.message, variant: 'error' })
    } else {
      setEmailSent(true)
    }
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      toast({ title: 'Error signing in with Google', description: error.message, variant: 'error' })
      setLoading(false)
    }
  }

  const showGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

  return (
    <AuthModalContext.Provider value={{ openWithReason, close }}>
      {children}

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out" />

          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl
              data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out
              data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-2xl mb-1">☀</div>
                <Dialog.Title className="text-lg font-semibold text-stone-900">
                  Sign in to Sunseeker
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-stone-500">
                  {reason}
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded-lg p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
                ✕
              </Dialog.Close>
            </div>

            {emailSent ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">📬</div>
                <p className="font-medium text-stone-900">Check your email</p>
                <p className="mt-1 text-sm text-stone-500">
                  We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
                </p>
                <button
                  onClick={() => setEmailSent(false)}
                  className="mt-4 text-sm text-amber-600 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Magic link form */}
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div>
                    <label htmlFor="auth-email" className="block text-sm font-medium text-stone-700 mb-1">
                      Email address
                    </label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="w-full rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2 text-sm transition-colors"
                  >
                    {loading ? 'Sending…' : 'Continue with Email'}
                  </button>
                </form>

                {showGoogle && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-stone-200" />
                      <span className="text-xs text-stone-400">or</span>
                      <div className="flex-1 h-px bg-stone-200" />
                    </div>

                    <button
                      onClick={handleGoogle}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50 py-2 text-sm font-medium text-stone-700 transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </button>
                  </>
                )}

                <p className="text-center text-xs text-stone-400">
                  By signing in you agree to our terms and privacy policy.
                </p>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AuthModalContext.Provider>
  )
}
