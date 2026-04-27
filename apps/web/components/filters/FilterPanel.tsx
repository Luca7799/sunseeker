'use client'

import { useState } from 'react'
import { cn, categoryLabel, categoryIcon } from '@/lib/utils'
import { useFiltersStore } from '@/store/filtersStore'
import type { VenueCategory, ConfidenceLabel } from '@/types'

interface FilterPanelProps {
  compact?: boolean
}

const ALL_CATEGORIES: VenueCategory[] = [
  'cafe', 'bar', 'restaurant', 'rooftop', 'terrace', 'park',
]

// ---------------------------------------------------------------------------
// Toggle row — big tap target for mobile
// ---------------------------------------------------------------------------

function FilterToggle({
  label,
  icon,
  active,
  onToggle,
}: {
  label: string
  icon: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors duration-100',
        active ? 'bg-amber-50' : 'bg-stone-50 active:bg-stone-100'
      )}
    >
      <span className={cn(
        'flex items-center gap-3 text-base font-medium',
        active ? 'text-amber-800' : 'text-stone-700'
      )}>
        <span className="text-xl w-7 text-center">{icon}</span>
        {label}
      </span>
      {/* Toggle pill */}
      <span className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200',
        active ? 'bg-amber-500' : 'bg-stone-300'
      )}>
        <span className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200',
          active ? 'translate-x-6' : 'translate-x-1'
        )} />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Full filter sheet content
// ---------------------------------------------------------------------------

function FilterContent({ onClose }: { onClose?: () => void }) {
  const { filters, setFilter, toggleCategory, clearFilters, activeFilterCount } = useFiltersStore()
  const count = activeFilterCount()

  const CONFIDENCE_OPTIONS: { value: ConfidenceLabel | null; label: string }[] = [
    { value: null, label: 'Any' },
    { value: 'high', label: 'High+' },
    { value: 'confirmed', label: 'Confirmed' },
  ]

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky header ── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h2 className="text-xl font-bold text-stone-900">Filters</h2>
        {count > 0 && (
          <button
            onClick={clearFilters}
            className="text-sm font-semibold text-red-500 px-3 py-1.5 rounded-xl active:bg-red-50 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

        {/* Sunlight */}
        <section>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Sunlight</p>
          <div className="space-y-2">
            <FilterToggle label="Sunny now" icon="☀️" active={filters.sunnyNow}
              onToggle={() => setFilter('sunnyNow', !filters.sunnyNow)} />
            <FilterToggle label="Sunny in 30 min" icon="🌤️" active={filters.sunnyIn30}
              onToggle={() => setFilter('sunnyIn30', !filters.sunnyIn30)} />
          </div>
        </section>

        {/* Venue */}
        <section>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Venue</p>
          <div className="space-y-2">
            <FilterToggle label="Outdoor seating" icon="🪑" active={filters.outdoorSeating}
              onToggle={() => setFilter('outdoorSeating', !filters.outdoorSeating)} />
            <FilterToggle label="Open now" icon="🕐" active={filters.openNow}
              onToggle={() => setFilter('openNow', !filters.openNow)} />
            <FilterToggle label="Confirmed outdoor only" icon="✅" active={filters.confirmedOutdoorOnly}
              onToggle={() => setFilter('confirmedOutdoorOnly', !filters.confirmedOutdoorOnly)} />
          </div>
        </section>

        {/* Category */}
        <section>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Category</p>
          <div className="grid grid-cols-3 gap-3">
            {ALL_CATEGORIES.map((cat) => {
              const active = filters.categories.includes(cat)
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 py-4 px-2 rounded-2xl border-2 transition-all duration-100 text-center',
                    active
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-stone-50 border-stone-100 text-stone-600 active:bg-stone-100'
                  )}
                >
                  <span className="text-3xl">{categoryIcon(cat)}</span>
                  <span className="text-sm font-semibold leading-tight">{categoryLabel(cat)}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Confidence */}
        <section>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Data confidence</p>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => {
              const active = filters.minConfidence === opt.value
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => setFilter('minConfidence', opt.value)}
                  className={cn(
                    'flex-1 py-3.5 rounded-2xl border-2 text-base font-semibold transition-all duration-100',
                    active
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-stone-50 border-stone-100 text-stone-600 active:bg-stone-100'
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </section>

      </div>

      {/* ── Sticky footer: Apply button ── */}
      {onClose && (
        <div className="shrink-0 px-5 py-4 border-t border-stone-100 bg-white">
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-amber-500 active:bg-amber-600 text-white text-lg font-bold transition-colors shadow-sm"
          >
            {count > 0 ? `Show results · ${count} filter${count > 1 ? 's' : ''} active` : 'Show results'}
          </button>
        </div>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Full-screen filter modal (mobile)
// ---------------------------------------------------------------------------

function FilterBottomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-white transition-transform duration-300 ease-out',
      )}
      style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
      role="dialog"
      aria-modal
      aria-label="Filters"
    >
      <FilterContent onClose={onClose} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trigger button — shown on mobile map
// ---------------------------------------------------------------------------

function FilterTriggerButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-5 py-3 rounded-full shadow-lg text-sm font-semibold transition-all duration-150',
        'border backdrop-blur-sm',
        count > 0
          ? 'bg-amber-500 border-amber-400 text-white shadow-amber-200'
          : 'bg-white/95 border-stone-200 text-stone-700'
      )}
    >
      <span className="text-base">⚙️</span>
      Filters
      {count > 0 && (
        <span className="bg-white text-amber-600 rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function FilterPanel({ compact = false }: FilterPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeFilterCount = useFiltersStore((s) => s.activeFilterCount())

  // Compact mode (used in list view header)
  if (compact) {
    return (
      <>
        <FilterTriggerButton onClick={() => setSheetOpen(true)} count={activeFilterCount} />
        <FilterBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    )
  }

  return (
    <>
      {/* Mobile: floating pill button + bottom sheet */}
      <div className="md:hidden">
        <FilterTriggerButton onClick={() => setSheetOpen(true)} count={activeFilterCount} />
        <FilterBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>

      {/* Desktop: full sidebar panel */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden w-72">
        <div className="p-4">
          <FilterContent />
        </div>
      </div>
    </>
  )
}
