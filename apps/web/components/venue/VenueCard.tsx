'use client'

import Image from 'next/image'
import {
  cn,
  formatDistance,
  categoryLabel,
  categoryIcon,
  isOpenNow,
  getOpenUntil,
} from '@/lib/utils'
import type { Venue } from '@/types'

interface VenueCardProps {
  venue: Venue
}

function OutdoorSeatBadge({ status }: { status: Venue['outdoor_seating'] }) {
  if (status === 'none') return null

  const configs = {
    confirmed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Outdoor seating confirmed ✓' },
    inferred: { bg: 'bg-stone-100', text: 'text-stone-600', label: 'Outdoor seating (inferred)' },
    unknown: { bg: 'bg-stone-50', text: 'text-stone-400', label: 'Outdoor seating unknown' },
  } as const

  const cfg = configs[status] ?? configs.unknown

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium', cfg.bg, cfg.text)}>
      🪑 {cfg.label}
    </span>
  )
}

export function VenueCard({ venue }: VenueCardProps) {
  const featuredPhoto = venue.photos?.find((p) => p.is_featured) ?? venue.photos?.[0]
  const open = isOpenNow(venue.opening_hours)
  const openUntil = getOpenUntil(venue.opening_hours)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
      {/* Featured photo */}
      {featuredPhoto && (
        <div className="relative w-full h-48">
          <Image
            src={featuredPhoto.url}
            alt={featuredPhoto.caption ?? venue.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority
          />
        </div>
      )}

      <div className="px-4 pt-4 pb-5 space-y-3">
        {/* Category chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium">
            {categoryIcon(venue.category)} {categoryLabel(venue.category)}
          </span>
          {venue.subcategories?.map((sub) => (
            <span
              key={sub}
              className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full capitalize"
            >
              {sub}
            </span>
          ))}
          {venue.has_rooftop && (
            <span className="text-xs bg-sky-50 text-sky-600 px-2 py-0.5 rounded-full">
              🏙 Rooftop
            </span>
          )}
        </div>

        {/* Name */}
        <h1 className="text-2xl font-bold text-stone-900 leading-tight">{venue.name}</h1>

        {/* Address */}
        {venue.address && (
          <p className="text-sm text-stone-500 flex items-start gap-1.5">
            <span className="mt-0.5">📍</span>
            <span>{venue.address}</span>
          </p>
        )}

        {/* Distance */}
        {venue.distance_meters != null && (
          <p className="text-sm text-stone-400">
            {formatDistance(venue.distance_meters)} away
          </p>
        )}

        {/* Open now + closes at */}
        <div className="flex items-center gap-2 flex-wrap">
          {venue.opening_hours ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full',
                open
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-600'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', open ? 'bg-green-500' : 'bg-red-400')} />
              {open ? 'Open now' : 'Closed'}
            </span>
          ) : (
            <span className="text-sm text-stone-400">Hours not available</span>
          )}
          {open && openUntil && (
            <span className="text-sm text-stone-500">{openUntil}</span>
          )}
        </div>

        {/* Outdoor seating */}
        <OutdoorSeatBadge status={venue.outdoor_seating} />

        {/* Rating */}
        {venue.rating != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-400 text-sm">★</span>
            <span className="text-sm font-semibold text-stone-700">{venue.rating.toFixed(1)}</span>
            {venue.rating_count > 0 && (
              <span className="text-xs text-stone-400">({venue.rating_count} reviews)</span>
            )}
          </div>
        )}

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-stone-600 leading-relaxed">{venue.description}</p>
        )}

        {/* Website / Phone */}
        <div className="flex items-center gap-3 flex-wrap pt-1">
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-600 hover:text-amber-700 underline underline-offset-2"
            >
              Website
            </a>
          )}
          {venue.phone && (
            <a
              href={`tel:${venue.phone}`}
              className="text-sm text-amber-600 hover:text-amber-700 underline underline-offset-2"
            >
              {venue.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
