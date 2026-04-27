'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

export function Header() {
  const { user, profile, isLoading, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayInitial =
    profile?.display_name
      ? profile.display_name.charAt(0).toUpperCase()
      : user?.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-stone-200 shadow-sm">
      <div className="flex items-center justify-between h-full px-4 max-w-screen-xl mx-auto">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-amber-600 font-semibold text-lg tracking-tight hover:text-amber-700 transition-colors"
        >
          <span>☀</span>
          <span>Sunseeker</span>
        </Link>

        {/* Right side */}
        <div className="flex items-center">
          {isLoading ? (
            <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
          ) : user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="w-9 h-9 rounded-full bg-amber-500 text-white text-sm font-semibold flex items-center justify-center hover:bg-amber-600 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
                aria-label="Open account menu"
                aria-expanded={dropdownOpen}
              >
                {displayInitial}
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-stone-200 py-1 z-50">
                  {profile?.display_name && (
                    <div className="px-3 py-2 text-xs text-stone-400 font-medium truncate border-b border-stone-100 mb-1">
                      {profile.display_name}
                    </div>
                  )}
                  <Link
                    href="/profile"
                    className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Profile
                  </Link>
                  {(profile?.is_admin || profile?.is_moderator) && (
                    <Link
                      href="/admin"
                      className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setDropdownOpen(false)
                      signOut()
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/sign-in"
              className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
