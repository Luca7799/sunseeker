'use client'

import { useMemo, useState } from 'react'
import { useFiltersStore } from '@/store/filtersStore'
import { VenueListItem } from './VenueListItem'
import { TimeSlider } from '@/components/map/TimeSlider'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { isOpenNow } from '@/lib/utils'
import type { VenueSummary, SortOption } from '@/types'

interface VenueListProps {
  initialVenues: VenueSummary[]
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function isSunny(v: VenueSummary): boolean {
  const s = v.sunlight?.sunlight_status
  return s === 'direct_sun' || s === 'likely_sun'
}

function confidenceScore(v: VenueSummary): number {
  const order: Record<string, number> = { confirmed: 4, high: 3, medium: 2, low: 1, unknown: 0 }
  return order[v.sunlight?.confidence_label ?? 'unknown'] ?? 0
}

function sortVenues(venues: VenueSummary[], sort: SortOption): VenueSummary[] {
  const arr = [...venues]
  switch (sort) {
    case 'closest_sunny':
      return arr.sort((a, b) => {
        const aSunny = isSunny(a) ? 0 : 1
        const bSunny = isSunny(b) ? 0 : 1
        if (aSunny !== bSunny) return aSunny - bSunny
        return (a.distance_meters ?? Infinity) - (b.distance_meters ?? Infinity)
      })

    case 'sunniest_longest':
      return arr.sort((a, b) => {
        const aR = a.sunlight?.sun_remaining_minutes ?? -1
        const bR = b.sunlight?.sun_remaining_minutes ?? -1
        return bR - aR
      })

    case 'best_rated_sunny':
      return arr.sort((a, b) => {
        const aSunny = isSunny(a) ? 0 : 1
        const bSunny = isSunny(b) ? 0 : 1
        if (aSunny !== bSunny) return aSunny - bSunny
        return (b.rating ?? 0) - (a.rating ?? 0)
      })

    case 'best_overall': {
      const score = (v: VenueSummary) => {
        let s = 0
        if (isSunny(v)) s += 2
        if (confidenceScore(v) >= 3) s += 1
        s += (v.rating ?? 0) / 5
        return s
      }
      return arr.sort((a, b) => score(b) - score(a))
    }

    default:
      return arr
  }
}

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

function filterVenues(venues: VenueSummary[], filters: ReturnType<typeof useFiltersStore.getState>['filters']): VenueSummary[] {
  return venues.filter((v) => {
    if (filters.sunnyNow && !isSunny(v)) return false
    if (filters.sunnyIn30 && !isSunny(v)) return false
    if (filters.outdoorSeating && v.outdoor_seating === 'none') return false
    if (filters.openNow && !isOpenNow(v.opening_hours)) return false
    if (filters.categories.length > 0 && !filters.categories.includes(v.category)) return false
    if (filters.confirmedOutdoorOnly && v.outdoor_seating !== 'confirmed') return false
    if (filters.minConfidence) {
      const order: Record<string, number> = { confirmed: 4, high: 3, medium: 2, low: 1, unknown: 0 }
      const minOrder = order[filters.minConfidence] ?? 0
      if ((order[v.sunlight?.confidence_label ?? 'unknown'] ?? 0) < minOrder) return false
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// Sort selector
// ---------------------------------------------------------------------------

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'closest_sunny', label: 'Closest sunny' },
  { value: 'sunniest_longest', label: 'Most sun remaining' },
  { value: 'best_rated_sunny', label: 'Best rated (sunny first)' },
  { value: 'best_overall', label: 'Best overall' },
]

function SortSelector({ value, onChange }: { value: SortOption; onChange: (s: SortOption) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="text-sm bg-white border border-stone-200 rounded-xl px-3 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-sm"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 px-4 py-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full bg-stone-200" />
        <div className="h-3 bg-stone-200 rounded w-24" />
        <div className="h-3 bg-stone-100 rounded w-16 ml-auto" />
      </div>
      <div className="h-5 bg-stone-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-stone-100 rounded w-1/2" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VenueList({ initialVenues }: VenueListProps) {
  const { filters, sort, timeOffset, setSort, setTimeOffset } = useFiltersStore()
  const [loading] = useState(false)

  const processed = useMemo(() => {
    const filtered = filterVenues(initialVenues, filters)
    return sortVenues(filtered, sort)
  }, [initialVenues, filters, sort])

  const sunnyCount = useMemo(() => processed.filter(isSunny).length, [processed])

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-stone-50 border-b border-stone-100 px-4 pt-4 pb-3 space-y-3">
        {/* Time selector */}
        <div className="flex justify-center">
          <TimeSlider value={timeOffset} onChange={setTimeOffset} />
        </div>

        {/* Count + sort + filter row */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-amber-600">{sunnyCount}</span>
            {' '}sunny spot{sunnyCount !== 1 ? 's' : ''} found
            {processed.length !== sunnyCount && (
              <span className="text-stone-400"> · {processed.length} total</span>
            )}
          </p>

          <div className="flex items-center gap-2">
            <FilterPanel compact />
            <SortSelector value={sort} onChange={setSort} />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : processed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3">🌥</span>
            <p className="font-semibold text-stone-700">No venues match your filters</p>
            <p className="text-sm text-stone-400 mt-1">
              Try clearing some filters or checking back later
            </p>
          </div>
        ) : (
          processed.map((venue, i) => (
            <VenueListItem key={venue.id} venue={venue} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  )
}
