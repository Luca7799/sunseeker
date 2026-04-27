import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getVenueWithSunlight } from '@/lib/venues'
import { createClient } from '@/lib/supabase/server'
import {
  categoryLabel,
  categoryIcon,
  sunlightStatusLabel,
  sunlightStatusColor,
  formatSunRemaining,
  formatTime,
  isOpenNow,
  confidenceLabelText,
  cn,
} from '@/lib/utils'
import type { Photo, OpeningHours } from '@/types'

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const venue = await getVenueWithSunlight(params.id)
  if (!venue) {
    return { title: 'Venue not found — Sunseeker' }
  }
  const status = venue.sunlight?.sunlight_status ?? 'unknown'
  const statusText = sunlightStatusLabel(status)
  return {
    title: `${venue.name} — ${statusText} | Sunseeker`,
    description:
      venue.description ??
      `Check sunlight conditions at ${venue.name} in Palma de Mallorca. ${statusText}.`,
    openGraph: {
      title: `${venue.name} — Sunseeker`,
      description: venue.description ?? `${statusText} at ${venue.name}, Palma de Mallorca.`,
      type: 'website',
    },
  }
}

// ---------------------------------------------------------------------------
// Opening hours grid helper
// ---------------------------------------------------------------------------

const DAY_LABELS: { key: keyof OpeningHours; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

function OpeningHoursGrid({ hours }: { hours: OpeningHours }) {
  const todayIndex = new Date().getDay() // 0=Sun
  // Reorder: Mon=0 … Sun=6 → index 0..6
  const dayOfWeek = todayIndex === 0 ? 6 : todayIndex - 1

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
      {DAY_LABELS.map(({ key, label }, idx) => {
        const dayHours = hours[key]
        const isToday = idx === dayOfWeek
        return (
          <div key={key} className={cn('flex justify-between', isToday && 'font-semibold')}>
            <span className={cn('text-stone-500', isToday && 'text-stone-900')}>{label}</span>
            <span className={cn('text-stone-700', isToday && 'text-stone-900')}>
              {dayHours ? `${dayHours.open} – ${dayHours.close}` : 'Closed'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sunlight status card
// ---------------------------------------------------------------------------

function SunlightCard({
  sunlight,
}: {
  sunlight: NonNullable<Awaited<ReturnType<typeof getVenueWithSunlight>>>['sunlight']
}) {
  if (!sunlight) {
    return (
      <div className="rounded-2xl bg-stone-100 p-5 text-center text-stone-500 text-sm">
        No sunlight data available yet.
      </div>
    )
  }

  const status = sunlight.sunlight_status
  const colorClass = sunlightStatusColor(status)
  const label = sunlightStatusLabel(status)
  const confidenceText = confidenceLabelText(sunlight.confidence_label)

  const cardBg =
    status === 'direct_sun'
      ? 'bg-amber-50 border-amber-200'
      : status === 'likely_sun'
        ? 'bg-yellow-50 border-yellow-200'
        : status === 'night'
          ? 'bg-indigo-50 border-indigo-200'
          : 'bg-stone-100 border-stone-200'

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', cardBg)}>
      {/* Status headline */}
      <div className="flex items-center justify-between">
        <span className={cn('text-2xl font-bold', colorClass)}>{label}</span>
        <span className="text-xs text-stone-500 bg-white/70 rounded-full px-2.5 py-0.5">
          {confidenceText}
        </span>
      </div>

      {/* Sun remaining */}
      {sunlight.sun_remaining_minutes != null && sunlight.sun_remaining_minutes > 0 && (
        <div className="flex items-center gap-2 text-sm text-stone-700">
          <span className="text-base">⏱</span>
          <span>
            <span className="font-medium">
              {formatSunRemaining(sunlight.sun_remaining_minutes)}
            </span>{' '}
            of sun remaining
          </span>
        </div>
      )}

      {/* Next sunny window */}
      {sunlight.next_sunny_window_start && sunlight.next_sunny_window_end && (
        <div className="flex items-center gap-2 text-sm text-stone-700">
          <span className="text-base">🕐</span>
          <span>
            Next sun:{' '}
            <span className="font-medium">
              {formatTime(sunlight.next_sunny_window_start)} –{' '}
              {formatTime(sunlight.next_sunny_window_end)}
            </span>
          </span>
        </div>
      )}

      {/* Best window today */}
      {sunlight.best_window_start && sunlight.best_window_end && (
        <div className="flex items-center gap-2 text-sm text-stone-700">
          <span className="text-base">✨</span>
          <span>
            Best window:{' '}
            <span className="font-medium">
              {formatTime(sunlight.best_window_start)} – {formatTime(sunlight.best_window_end)}
            </span>
            {sunlight.best_window_duration_minutes && (
              <span className="text-stone-500 ml-1">
                ({formatSunRemaining(sunlight.best_window_duration_minutes)})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Sun altitude / azimuth */}
      {sunlight.sun_altitude_deg != null && (
        <div className="text-xs text-stone-400 pt-1 border-t border-black/5">
          Sun altitude {sunlight.sun_altitude_deg.toFixed(1)}°
          {sunlight.sun_azimuth_deg != null && ` · azimuth ${sunlight.sun_azimuth_deg.toFixed(1)}°`}
          {sunlight.buildings_checked > 0 &&
            ` · ${sunlight.buildings_checked} building${sunlight.buildings_checked !== 1 ? 's' : ''} checked`}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Outdoor seating badge
// ---------------------------------------------------------------------------

function OutdoorSeatBadge({
  status,
  notes,
}: {
  status: string
  notes: string | null
}) {
  const config: Record<string, { label: string; color: string; icon: string }> = {
    confirmed: { label: 'Confirmed outdoor seating', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '✓' },
    inferred: { label: 'Likely outdoor seating', color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: '~' },
    none: { label: 'No outdoor seating', color: 'text-stone-500 bg-stone-100 border-stone-200', icon: '✕' },
    unknown: { label: 'Outdoor seating unknown', color: 'text-stone-400 bg-stone-50 border-stone-200', icon: '?' },
  }
  const c = config[status] ?? config['unknown']
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-xl border px-3 py-2', c.color)}>
      <span className="font-semibold text-sm">{c.icon}</span>
      <div>
        <p className="text-sm font-medium">{c.label}</p>
        {notes && <p className="text-xs opacity-70 mt-0.5">{notes}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Photo grid
// ---------------------------------------------------------------------------

function PhotoGrid({ photos }: { photos: Photo[] }) {
  const approved = photos.filter((p) => p.status === 'approved')
  if (approved.length === 0) return null

  return (
    <div>
      <h2 className="text-base font-semibold text-stone-800 mb-3">Photos</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {approved.map((photo) => (
          <div
            key={photo.id}
            className="relative aspect-square rounded-xl overflow-hidden bg-stone-100"
          >
            <Image
              src={photo.thumbnail_url ?? photo.url}
              alt={photo.caption ?? 'Venue photo'}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
            {photo.is_featured && (
              <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-amber-400 text-amber-900 rounded-full px-1.5 py-0.5">
                Featured
              </span>
            )}
            {photo.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                <p className="text-white text-[11px] leading-tight line-clamp-2">{photo.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VenueDetailPage({ params }: { params: { id: string } }) {
  const venue = await getVenueWithSunlight(params.id)

  if (!venue) {
    notFound()
  }

  // Fetch approved photos
  const supabase = createClient()
  const { data: photosData } = await supabase
    .from('photos')
    .select('id, venue_id, zone_id, uploaded_by, storage_path, url, thumbnail_url, caption, taken_at, shows_terrace, shows_sun, status, is_featured, created_at')
    .eq('venue_id', venue.id)
    .eq('status', 'approved')
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  const photos: Photo[] = (photosData ?? []) as Photo[]

  // Check if current user is logged in (for "Submit correction" gating)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const icon = categoryIcon(venue.category)
  const catLabel = categoryLabel(venue.category)
  const openNow = isOpenNow(venue.opening_hours)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
      >
        ← Map
      </Link>

      {/* Venue header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-stone-900 leading-tight">{venue.name}</h1>
          <span className="flex-shrink-0 flex items-center gap-1 bg-stone-100 text-stone-600 rounded-full px-2.5 py-1 text-xs font-medium">
            <span>{icon}</span>
            <span>{catLabel}</span>
          </span>
        </div>

        {/* Address + open status */}
        <div className="flex items-center gap-3 text-sm text-stone-500">
          {venue.address && <span>{venue.address}</span>}
          {venue.address && <span>·</span>}
          <span
            className={cn(
              'font-medium',
              openNow ? 'text-emerald-600' : 'text-stone-400',
            )}
          >
            {openNow ? 'Open now' : 'Closed'}
          </span>
        </div>

        {/* Rating */}
        {venue.rating != null && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-amber-400">★</span>
            <span className="font-medium text-stone-700">{venue.rating.toFixed(1)}</span>
            {venue.rating_count > 0 && (
              <span className="text-stone-400">({venue.rating_count})</span>
            )}
          </div>
        )}

        {/* Description */}
        {venue.description && (
          <p className="text-sm text-stone-600 leading-relaxed">{venue.description}</p>
        )}
      </div>

      {/* Sunlight status card */}
      <div>
        <h2 className="text-base font-semibold text-stone-800 mb-3">Sunlight right now</h2>
        <SunlightCard sunlight={venue.sunlight} />
      </div>

      {/* Outdoor seating */}
      <div>
        <h2 className="text-base font-semibold text-stone-800 mb-3">Outdoor seating</h2>
        <OutdoorSeatBadge status={venue.outdoor_seating} notes={venue.outdoor_seating_notes} />
        {venue.has_rooftop && (
          <p className="mt-2 text-sm text-stone-500">
            🏙 Rooftop available
            {venue.rooftop_level != null ? ` (floor ${venue.rooftop_level})` : ''}
          </p>
        )}
      </div>

      {/* Opening hours */}
      {venue.opening_hours && Object.keys(venue.opening_hours).length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-stone-800 mb-3">Opening hours</h2>
          <OpeningHoursGrid hours={venue.opening_hours} />
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && <PhotoGrid photos={photos} />}

      {/* Contact */}
      {(venue.website || venue.phone) && (
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-stone-800 mb-2">Contact</h2>
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
            >
              🌐 {new URL(venue.website).hostname.replace('www.', '')}
            </a>
          )}
          {venue.phone && (
            <a
              href={`tel:${venue.phone}`}
              className="flex items-center gap-2 text-sm text-stone-700 hover:underline"
            >
              📞 {venue.phone}
            </a>
          )}
        </div>
      )}

      {/* Submit correction CTA */}
      <div className="pt-2 border-t border-stone-200">
        {user ? (
          <Link
            href={`/venue/${venue.id}/submit-correction`}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-800 text-white text-sm font-medium px-4 py-2.5 hover:bg-stone-700 transition-colors"
          >
            ✏️ Submit a correction
          </Link>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm text-stone-500">Know something we got wrong?</p>
            <Link
              href={`/auth/login?next=/venue/${venue.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-800 text-white text-sm font-medium px-4 py-2.5 hover:bg-stone-700 transition-colors"
            >
              Sign in to submit a correction
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
