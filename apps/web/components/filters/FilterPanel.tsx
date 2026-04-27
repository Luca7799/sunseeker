'use client'

import { useState } from 'react'
import { cn, categoryLabel, categoryIcon } from '@/lib/utils'
import { useFiltersStore } from '@/store/filtersStore'
import type { VenueCategory, ConfidenceLabel } from '@/types'

interface FilterPanelProps {
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Category list
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: VenueCategory[] = [
  'cafe', 'bar', 'restaurant', 'rooftop', 'terrace', 'park',
]

// ---------------------------------------------------------------------------
// Toggle row
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
        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-100',
        active ? 'bg-amber-50' : 'hover:bg-stone-50'
      )}
    >
      <span className={cn('flex items-center gap-2 text-sm font-medium', active ? 'text-amber-700' : 'text-stone-600')}>
        <span>{icon}</span>
        {label}
      </span>
      {/* Toggle pill */}
      <span
        className={cn(
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150',
          active ? 'bg-amber-500' : 'bg-stone-200'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-150',
            active ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Full filter sheet content
// ---------------------------------------------------------------------------

function FilterContent({ onClose }: { onClose?: () => void }) {
  const { filters, setFilter, toggleCategory, clearFilters } = useFiltersStore()

  const CONFIDENCE_OPTIONS: { value: ConfidenceLabel | null; label: string }[] = [
    { value: null, label: 'Any' },
    { value: 'high', label: 'High+' },
    { value: 'confirmed', label: 'Confirmed only' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h2 className="font-semibold text-stone-800 text-base">Filters</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={clearFilters}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            Clear all
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100 transition-colors"
              aria-label="Close filters"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scroll body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Sunlight toggles */}
        <section>
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Sunlight</p>
          <div className="space-y-1">
            <FilterToggle
              label="Sunny now"
              icon="☀"
              active={filters.sunnyNow}
              onToggle={() => setFilter('sunnyNow', !filters.sunnyNow)}
            />
            <FilterToggle
              label="Sunny in 30 min"
              icon="🌤"
              active={filters.sunnyIn30}
              onToggle={() => setFilter('sunnyIn30', !filters.sunnyIn30)}
            />
          </div>
        </section>

        <div className="h-px bg-stone-100" />

        {/* Venue toggles */}
        <section>
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Venue</p>
          <div className="space-y-1">
            <FilterToggle
              label="Outdoor seating"
              icon="🪑"
              active={filters.outdoorSeating}
              onToggle={() => setFilter('outdoorSeating', !filters.outdoorSeating)}
            />
            <FilterToggle
              label="Open now"
              icon="🕐"
              active={filters.openNow}
              onToggle={() => setFilter('openNow', !filters.openNow)}
            />
          </div>
        </section>

        <div className="h-px bg-stone-100" />

        {/* Category chips */}
        <section>
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Category</p>
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = filters.categories.includes(cat)
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-all duration-100',
                    active
                      ? 'bg-amber-100 border-amber-300 text-amber-700 font-medium'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  )}
                >
                  {categoryIcon(cat)} {categoryLabel(cat)}
                </button>
              )
            })}
          </div>
        </section>

        <div className="h-px bg-stone-100" />

        {/* Confidence */}
        <section>
          <p className="text-xs text-stone-400 uppercase tracking-wide font-medium mb-2">Confidence</p>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => {
              const active = filters.minConfidence === opt.value
              return (
                <button
                  key={String(opt.value)}
                  onClick={() => setFilter('minConfidence', opt.value)}
                  className={cn(
                    'text-sm px-3 py-1.5 rounded-full border transition-all duration-100',
                    active
                      ? 'bg-amber-100 border-amber-300 text-amber-700 font-medium'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </section>

        <div className="h-px bg-stone-100" />

        {/* Confirmed outdoor only */}
        <section>
          <FilterToggle
            label="Confirmed outdoor seating only"
            icon="✓"
            active={filters.confirmedOutdoorOnly}
            onToggle={() => setFilter('confirmedOutdoorOnly', !filters.confirmedOutdoorOnly)}
          />
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Compact trigger button (used inside list header)
// ---------------------------------------------------------------------------

function CompactFilterButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-all duration-100',
        count > 0
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
      )}
    >
      <span>⚙</span>
      Filters
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Bottom sheet / drawer for full filter panel on mobile
// ---------------------------------------------------------------------------

function FilterBottomSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl transition-transform duration-300 ease-out',
          'max-h-[85vh] flex flex-col',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        role="dialog"
        aria-modal
        aria-label="Filters"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-stone-200" />
        </div>

        <FilterContent onClose={onClose} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function FilterPanel({ compact = false }: FilterPanelProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const activeFilterCount = useFiltersStore((s) => s.activeFilterCount())

  if (compact) {
    return (
      <>
        <CompactFilterButton
          onClick={() => setSheetOpen(true)}
          count={activeFilterCount}
        />
        <FilterBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    )
  }

  // On mobile: compact trigger button + bottom sheet
  // On desktop (md+): full inline panel
  return (
    <>
      {/* Mobile: compact button + bottom sheet */}
      <div className="md:hidden">
        <CompactFilterButton
          onClick={() => setSheetOpen(true)}
          count={activeFilterCount}
        />
        <FilterBottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>

      {/* Desktop: full inline sidebar panel */}
      <div className="hidden md:block bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden w-72">
        <FilterContent />
      </div>
    </>
  )
}
