'use client'

import Link from 'next/link'
import {
  cn,
  formatDistance,
  formatSunRemaining,
  sunlightStatusLabel,
  sunlightStatusColor,
  confidenceLabelText,
  categoryLabel,
  categoryIcon,
  isOpenNow,
  getOpenUntil,
} from '@/lib/utils'
import type { VenueSummary } from '@/types'

interface VenueListItemProps {
  venue: VenueSummary
  rank?: number
}

function OutdoorSeatBadge({ status }: { status: VenueSummary['outdoor_seating'] }) {
  if (status === 'none' || status === 'unknown') return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
        status === 'confirmed'
          ? 'bg-green-50 text-green-700'
          : 'bg-stone-100 text-stone-500'
      )}
    >
      🪑 Outdoor seating
      {status === 'confirmed' && <span className="text-green-600">✓</span>}
      {status === 'inferred' && <span className="text-stone-400">(inferred)</span>}
    </span>
  )
}

function SunStatusDot({ status }: { status: string | undefined }) {
  const colors: Record<string, string> = {
    direct_sun: 'bg-amber-400',
    likely_sun: 'bg-yellow-300',
    likely_shade: 'bg-slate-300',
    shade: 'bg-slate-400',
    night: 'bg-indigo-300',
    unknown: 'bg-stone-300',
  }
  return (
    <span
      className={cn(
        'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
        colors[status ?? 'unknown'] ?? 'bg-stone-300'
      )}
    />
  )
}

export function VenueListItem({ venue, rank }: VenueListItemProps) {
  const sunlight = venue.sunlight
  const status = sunlight?.sunlight_status
  const remaining = sunlight?.sun_remaining_minutes
  const confidence = sunlight?.confidence_label
  const openUntil = getOpenUntil(venue.opening_hours)
  const open = isOpenNow(venue.opening_hours)

  return (
    <Link
      href={`/venue/${venue.slug}`}
      className="block bg-white rounded-2xl shadow-sm border border-stone-100 hover:shadow-md hover:border-amber-100 transition-all duration-150 active:scale-[0.99]"
    >
      <div className="px-4 py-3">
        {/* Row 1: status + category + distance */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <SunStatusDot status={status} />
            <span
              className={cn(
                'text-xs font-medium truncate',
                status ? sunlightStatusColor(status) : 'text-stone-400'
              )}
            >
              {status ? sunlightStatusLabel(status) : '— Unknown'}
            </span>
            <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full flex-shrink-0">
              {categoryIcon(venue.category)} {categoryLabel(venue.category)}
            </span>
          </div>

          {venue.distance_meters != null && (
            <span className="text-xs text-stone-400 flex-shrink-0">
              {formatDistance(venue.distance_meters)}
            </span>
          )}
        </div>

        {/* Row 2: venue name */}
        <p className="font-bold text-stone-800 text-base leading-snug truncate">
          {rank != null && (
            <span className="text-stone-300 font-normal mr-1.5">#{rank}</span>
          )}
          {venue.name}
        </p>

        {/* Row 3: sun remaining + open until */}
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {remaining != null && remaining > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              ☀ {formatSunRemaining(remaining)} remaining
            </span>
          )}
          {open && openUntil && (
            <span className="text-xs text-stone-400">
              Open · {openUntil}
            </span>
          )}
          {!open && venue.opening_hours && (
            <span className="text-xs text-stone-400">Closed now</span>
          )}
        </div>

        {/* Row 4: outdoor seating + confidence */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <OutdoorSeatBadge status={venue.outdoor_seating} />
          {confidence && confidence !== 'unknown' && (
            <span className="text-xs text-stone-400">
              {confidenceLabelText(confidence)}
            </span>
          )}
          {venue.is_curated && (
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
              ★ Curated
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
