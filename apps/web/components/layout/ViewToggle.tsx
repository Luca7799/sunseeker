'use client'

import Link from 'next/link'
import { clsx } from 'clsx'

interface ViewToggleProps {
  activeView: 'map' | 'list'
}

export function ViewToggle({ activeView }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-full bg-stone-800/70 backdrop-blur-sm p-1 gap-1">
      <Link
        href="/"
        className={clsx(
          'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
          activeView === 'map'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-200 hover:text-white',
        )}
      >
        <span>🗺</span>
        <span>Map</span>
      </Link>

      <Link
        href="/list"
        className={clsx(
          'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
          activeView === 'list'
            ? 'bg-white text-stone-900 shadow-sm'
            : 'text-stone-200 hover:text-white',
        )}
      >
        <span>☰</span>
        <span>List</span>
      </Link>
    </div>
  )
}
