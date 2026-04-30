/**
 * venues.ts
 * Server-side venue data functions using the Supabase server client.
 * Must only be imported from Server Components, Route Handlers, or Server Actions.
 */

import { createClient } from '@/lib/supabase/server'
import type {
  Venue,
  VenueSummary,
  SunlightPrediction,
  VenueFilters,
} from '@/types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Columns to select for a full Venue record. */
const VENUE_FULL_SELECT = `
  id, name, slug, category, subcategories, description, address, city,
  lat, lng, outdoor_seating, outdoor_seating_notes, has_rooftop, rooftop_level,
  is_curated, data_source, opening_hours, opening_hours_raw,
  phone, website, rating, rating_count, price_level,
  building_data_quality, is_active, created_at, updated_at
`

/** Columns to select for a lightweight VenueSummary. */
const VENUE_SUMMARY_SELECT = `
  id, name, slug, category, lat, lng,
  outdoor_seating, is_curated, rating, opening_hours,
  website, instagram_url
`

/** Columns to select for a SunlightPrediction. */
const SUNLIGHT_SELECT = `
  id, venue_id, zone_id, prediction_time, computed_at,
  sun_altitude_deg, sun_azimuth_deg, sunlight_status, confidence_label,
  confidence_score, sun_remaining_minutes,
  next_sunny_window_start, next_sunny_window_end,
  best_window_start, best_window_end, best_window_duration_minutes,
  buildings_checked, obstruction_building_id, confidence_factors
`

// ---------------------------------------------------------------------------
// Venue fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch a single venue by its UUID.
 * Returns null if not found or on error.
 */
export async function getVenueById(id: string): Promise<Venue | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('venues')
      .select(VENUE_FULL_SELECT)
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('[venues] getVenueById error:', error.message)
      return null
    }
    return data as Venue
  } catch (err) {
    console.error('[venues] getVenueById threw:', err)
    return null
  }
}

/**
 * Fetch a single venue by its URL slug.
 * Returns null if not found or on error.
 */
export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('venues')
      .select(VENUE_FULL_SELECT)
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (error) {
      console.error('[venues] getVenueBySlug error:', error.message)
      return null
    }
    return data as Venue
  } catch (err) {
    console.error('[venues] getVenueBySlug threw:', err)
    return null
  }
}

/**
 * Fetch all venues within a given radius of a lat/lng coordinate.
 * Relies on a PostGIS/RPC function `venues_near` in the database.
 *
 * @param lat          Center latitude
 * @param lng          Center longitude
 * @param radiusMeters Search radius in metres (default 2000)
 * @param filters      Optional filter flags
 * @returns            Array of VenueSummary sorted by distance ASC
 */
export async function getVenuesNear(
  lat: number,
  lng: number,
  radiusMeters = 2000,
  filters?: Partial<VenueFilters>,
): Promise<VenueSummary[]> {
  try {
    const supabase = createClient()

    // Call a Postgres RPC that returns venues with distance
    const { data, error } = await supabase.rpc('venues_near', {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
    })

    if (error) {
      console.error('[venues] getVenuesNear RPC error:', error.message)
      return []
    }

    let results = (data ?? []) as VenueSummary[]

    // Apply optional client-side filters
    if (filters?.categories && filters.categories.length > 0) {
      results = results.filter((v) => filters.categories!.includes(v.category))
    }
    if (filters?.outdoorSeating) {
      results = results.filter(
        (v) => v.outdoor_seating === 'confirmed' || v.outdoor_seating === 'inferred',
      )
    }
    if (filters?.confirmedOutdoorOnly) {
      results = results.filter((v) => v.outdoor_seating === 'confirmed')
    }

    return results
  } catch (err) {
    console.error('[venues] getVenuesNear threw:', err)
    return []
  }
}

/**
 * Fetch all curated venues (hand-picked editorial selection),
 * with the most recent valid sunlight prediction attached to each.
 * Used for the initial load / featured list.
 */
export async function getAllCuratedVenues(): Promise<VenueSummary[]> {
  try {
    const supabase = createClient()

    // Fetch venues
    const { data: venueData, error: venueError } = await supabase
      .from('venues')
      .select(VENUE_SUMMARY_SELECT)
      .eq('is_curated', true)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (venueError) {
      console.error('[venues] getAllCuratedVenues error:', venueError.message)
      return []
    }

    const venues = (venueData ?? []) as VenueSummary[]
    if (venues.length === 0) return []

    // Fetch the most recent non-stale prediction for each venue,
    // for prediction_time closest to now
    const now = new Date()
    const windowStart = new Date(now.getTime() - 20 * 60 * 1000).toISOString() // 20 min ago
    const windowEnd   = new Date(now.getTime() + 40 * 60 * 1000).toISOString() // 40 min ahead

    const venueIds = venues.map((v) => v.id)
    const { data: predData, error: predError } = await supabase
      .from('sunlight_predictions')
      .select(SUNLIGHT_SELECT)
      .in('venue_id', venueIds)
      .eq('is_stale', false)
      .gte('prediction_time', windowStart)
      .lte('prediction_time', windowEnd)
      .order('prediction_time', { ascending: true })

    if (predError) {
      console.error('[venues] getAllCuratedVenues predictions error:', predError.message)
      // Return venues without sunlight rather than failing
      return venues
    }

    // Build a map: venue_id → prediction closest to now
    const predMap = new Map<string, SunlightPrediction>()
    for (const pred of (predData ?? []) as SunlightPrediction[]) {
      const vid = pred.venue_id!
      if (!predMap.has(vid)) {
        predMap.set(vid, pred)
      } else {
        // Keep the prediction whose time is closest to now
        const existing = predMap.get(vid)!
        const existingDiff = Math.abs(new Date(existing.prediction_time).getTime() - now.getTime())
        const newDiff      = Math.abs(new Date(pred.prediction_time).getTime() - now.getTime())
        if (newDiff < existingDiff) predMap.set(vid, pred)
      }
    }

    // Attach predictions to venues
    return venues.map((v) => ({
      ...v,
      sunlight: predMap.get(v.id) ?? null,
    }))
  } catch (err) {
    console.error('[venues] getAllCuratedVenues threw:', err)
    return []
  }
}

// ---------------------------------------------------------------------------
// Venue + sunlight
// ---------------------------------------------------------------------------

/**
 * Fetch a full venue record along with the most recent cached sunlight prediction.
 *
 * @param id        Venue UUID
 * @param timestamp ISO 8601 timestamp to match (optional — latest if omitted)
 * @returns         Venue with a `sunlight` field (null if no prediction exists)
 */
export async function getVenueWithSunlight(
  id: string,
  timestamp?: string,
): Promise<(Venue & { sunlight: SunlightPrediction | null }) | null> {
  try {
    const supabase = createClient()

    // Fetch the venue
    const venue = await getVenueById(id)
    if (!venue) return null

    // Fetch the prediction
    const sunlight = await getSunlightPrediction(id, timestamp)

    return { ...venue, sunlight }
  } catch (err) {
    console.error('[venues] getVenueWithSunlight threw:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Sunlight prediction cache
// ---------------------------------------------------------------------------

/**
 * Retrieve the cached sunlight prediction for a venue at a given time.
 * If `targetTime` is omitted, returns the most recently computed prediction.
 *
 * @param venueId    Venue UUID
 * @param targetTime ISO 8601 timestamp (optional)
 * @returns          SunlightPrediction or null
 */
export async function getSunlightPrediction(
  venueId: string,
  targetTime?: string,
): Promise<SunlightPrediction | null> {
  try {
    const supabase = createClient()

    let query = supabase
      .from('sunlight_predictions')
      .select(SUNLIGHT_SELECT)
      .eq('venue_id', venueId)
      .order('computed_at', { ascending: false })
      .limit(1)

    if (targetTime) {
      // Find the prediction whose prediction_time is closest to targetTime
      // Simple approach: filter within a 10-minute window
      const target = new Date(targetTime)
      const windowStart = new Date(target.getTime() - 5 * 60 * 1000).toISOString()
      const windowEnd = new Date(target.getTime() + 5 * 60 * 1000).toISOString()
      query = query
        .gte('prediction_time', windowStart)
        .lte('prediction_time', windowEnd)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      console.error('[venues] getSunlightPrediction error:', error.message)
      return null
    }
    if (!data) return null

    return data as SunlightPrediction
  } catch (err) {
    console.error('[venues] getSunlightPrediction threw:', err)
    return null
  }
}

/**
 * Insert or update a sunlight prediction in the cache table.
 * Uses upsert keyed on (venue_id, prediction_time).
 *
 * @param prediction SunlightPrediction to store
 */
export async function upsertSunlightPrediction(
  prediction: SunlightPrediction & { venue_id: string },
): Promise<void> {
  try {
    const supabase = createClient()

    const { error } = await supabase
      .from('sunlight_predictions')
      .upsert(
        {
          venue_id: prediction.venue_id,
          zone_id: prediction.zone_id ?? null,
          prediction_time: prediction.prediction_time,
          computed_at: prediction.computed_at ?? new Date().toISOString(),
          sun_altitude_deg: prediction.sun_altitude_deg,
          sun_azimuth_deg: prediction.sun_azimuth_deg,
          sunlight_status: prediction.sunlight_status,
          confidence_label: prediction.confidence_label,
          confidence_score: prediction.confidence_score,
          sun_remaining_minutes: prediction.sun_remaining_minutes,
          next_sunny_window_start: prediction.next_sunny_window_start,
          next_sunny_window_end: prediction.next_sunny_window_end,
          best_window_start: prediction.best_window_start,
          best_window_end: prediction.best_window_end,
          best_window_duration_minutes: prediction.best_window_duration_minutes,
          buildings_checked: prediction.buildings_checked,
          obstruction_building_id: prediction.obstruction_building_id,
          confidence_factors: prediction.confidence_factors,
        },
        {
          onConflict: 'venue_id,prediction_time',
        },
      )

    if (error) {
      console.error('[venues] upsertSunlightPrediction error:', error.message)
    }
  } catch (err) {
    console.error('[venues] upsertSunlightPrediction threw:', err)
  }
}
