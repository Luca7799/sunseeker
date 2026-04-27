import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import type {
  VenueCategory,
  SunlightStatus,
  ConfidenceLabel,
  OpeningHours,
  TimeOffset,
} from '@/types'

// ---------------------------------------------------------------------------
// Tailwind class merging
// ---------------------------------------------------------------------------

/** Merge Tailwind classes, resolving conflicts correctly. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Distance formatting
// ---------------------------------------------------------------------------

/**
 * Format a distance in meters to a human-readable string.
 * @example formatDistance(50)    => "50m"
 * @example formatDistance(1234)  => "1.2km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

// ---------------------------------------------------------------------------
// Sun remaining time formatting
// ---------------------------------------------------------------------------

/**
 * Format remaining sun time (in minutes) to a human-readable string.
 * @example formatSunRemaining(3)   => "< 5 min"
 * @example formatSunRemaining(42)  => "42 min"
 * @example formatSunRemaining(80)  => "1h 20min"
 */
export function formatSunRemaining(minutes: number): string {
  if (minutes < 5) {
    return '< 5 min'
  }
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMins = minutes % 60
  if (remainingMins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remainingMins}min`
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to a local time string (HH:mm).
 * @example formatTime("2024-06-15T14:30:00Z") => "14:30"
 */
export function formatTime(isoString: string): string {
  try {
    return format(parseISO(isoString), 'HH:mm')
  } catch {
    return '--:--'
  }
}

// ---------------------------------------------------------------------------
// Opening hours helpers
// ---------------------------------------------------------------------------

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DayKey = (typeof DAY_KEYS)[number]

function getCurrentDayKey(): DayKey {
  return DAY_KEYS[new Date().getDay()]
}

function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * Returns true if the venue is currently open based on its opening hours.
 * Assumes the opening hours are in the venue's local timezone (Europe/Madrid for Palma).
 * Returns false if hours are not available.
 */
export function isOpenNow(openingHours: OpeningHours | null | undefined): boolean {
  if (!openingHours) return false

  const dayKey = getCurrentDayKey()
  const todayHours = openingHours[dayKey]

  if (!todayHours) return false

  const now = new Date()
  // Use local time minutes since opening hours stored as local times
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = timeStringToMinutes(todayHours.open)
  const closeMinutes = timeStringToMinutes(todayHours.close)

  // Handle overnight hours (e.g. open: "20:00", close: "02:00")
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes
}

/**
 * Returns a "closes at HH:mm" string if the venue is open, or null if closed/unknown.
 */
export function getOpenUntil(openingHours: OpeningHours | null | undefined): string | null {
  if (!openingHours) return null

  const dayKey = getCurrentDayKey()
  const todayHours = openingHours[dayKey]

  if (!todayHours) return null
  if (!isOpenNow(openingHours)) return null

  return `closes at ${todayHours.close}`
}

// ---------------------------------------------------------------------------
// Sunlight status helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable label with emoji for a SunlightStatus.
 */
export function sunlightStatusLabel(status: SunlightStatus): string {
  switch (status) {
    case 'direct_sun':
      return '☀ Direct Sun'
    case 'likely_sun':
      return '🌤 Likely Sun'
    case 'likely_shade':
      return '⛅ Likely Shade'
    case 'shade':
      return '🌥 Shade'
    case 'night':
      return '🌙 Night'
    case 'unknown':
    default:
      return '— Unknown'
  }
}

/**
 * Returns a Tailwind CSS color class for a SunlightStatus.
 */
export function sunlightStatusColor(status: SunlightStatus): string {
  switch (status) {
    case 'direct_sun':
      return 'text-amber-600'
    case 'likely_sun':
      return 'text-yellow-600'
    case 'likely_shade':
      return 'text-slate-500'
    case 'shade':
      return 'text-slate-600'
    case 'night':
      return 'text-indigo-400'
    case 'unknown':
    default:
      return 'text-stone-400'
  }
}

// ---------------------------------------------------------------------------
// Confidence label helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable string for a ConfidenceLabel.
 */
export function confidenceLabelText(label: ConfidenceLabel): string {
  switch (label) {
    case 'confirmed':
      return 'Confirmed'
    case 'high':
      return 'High confidence'
    case 'medium':
      return 'Medium confidence'
    case 'low':
      return 'Low confidence'
    case 'unknown':
    default:
      return 'Unknown confidence'
  }
}

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable label for a VenueCategory.
 */
export function categoryLabel(category: VenueCategory): string {
  switch (category) {
    case 'cafe':
      return 'Café'
    case 'bar':
      return 'Bar'
    case 'restaurant':
      return 'Restaurant'
    case 'rooftop':
      return 'Rooftop Bar'
    case 'terrace':
      return 'Terrace'
    case 'park':
      return 'Park'
    case 'bench':
      return 'Bench / Seat'
    case 'viewpoint':
      return 'Viewpoint'
    default:
      return category
  }
}

/**
 * Returns an emoji icon for a VenueCategory.
 */
export function categoryIcon(category: VenueCategory): string {
  switch (category) {
    case 'cafe':
      return '☕'
    case 'bar':
      return '🍻'
    case 'restaurant':
      return '🍽'
    case 'rooftop':
      return '🏙'
    case 'terrace':
      return '🌿'
    case 'park':
      return '🌳'
    case 'bench':
      return '🪑'
    case 'viewpoint':
      return '🔭'
    default:
      return '📍'
  }
}

// ---------------------------------------------------------------------------
// Time offset helper
// ---------------------------------------------------------------------------

/**
 * Converts a TimeOffset string to a concrete Date object relative to now.
 */
export function getTimeOffset(offset: TimeOffset): Date {
  const now = new Date()
  switch (offset) {
    case 'now':
      return now
    case '+30min':
      return new Date(now.getTime() + 30 * 60 * 1000)
    case '+60min':
      return new Date(now.getTime() + 60 * 60 * 1000)
    case '+2h':
      return new Date(now.getTime() + 2 * 60 * 60 * 1000)
    case '+4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000)
    default:
      return now
  }
}

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

/**
 * Converts a venue name (or any string) into a URL-safe slug.
 * @example slugify("Café del Mar") => "cafe-del-mar"
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')                        // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')         // strip combining diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')           // remove non-alphanumeric (except spaces/hyphens)
    .replace(/[\s_]+/g, '-')                 // spaces & underscores -> hyphens
    .replace(/-+/g, '-')                     // collapse multiple hyphens
    .replace(/^-|-$/g, '')                   // trim leading/trailing hyphens
}
