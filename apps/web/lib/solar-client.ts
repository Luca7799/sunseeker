/**
 * solar-client.ts
 * HTTP client for the Python solar microservice.
 * Must only be used server-side (uses SOLAR_SERVICE_URL env var).
 */

import type { SunlightPrediction, SunPosition, ConfidenceLabel, SunlightStatus, VenueSummary } from '@/types'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOLAR_SERVICE_URL =
  process.env.SOLAR_SERVICE_URL || 'http://localhost:8000'

const DEFAULT_TIMEOUT_MS = 8000
const MAX_RETRIES = 2
const RETRY_BASE_DELAY_MS = 300

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch with retry logic (exponential backoff).
 * Retries on network errors and 5xx responses.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (response.ok) return response

    // Retry on 5xx server errors
    if (response.status >= 500 && retries > 0) {
      const delay = RETRY_BASE_DELAY_MS * 2 ** (MAX_RETRIES - retries)
      await sleep(delay)
      return fetchWithRetry(url, options, retries - 1)
    }

    return response
  } catch (err) {
    clearTimeout(timeout)
    if (retries > 0) {
      const delay = RETRY_BASE_DELAY_MS * 2 ** (MAX_RETRIES - retries)
      await sleep(delay)
      return fetchWithRetry(url, options, retries - 1)
    }
    throw err
  }
}

/** Returns a graceful fallback SunlightPrediction with 'unknown' status. */
function unknownPrediction(
  overrides: Partial<SunlightPrediction> = {},
): SunlightPrediction {
  return {
    prediction_time: new Date().toISOString(),
    sun_altitude_deg: null,
    sun_azimuth_deg: null,
    sunlight_status: 'unknown' as SunlightStatus,
    confidence_label: 'unknown' as ConfidenceLabel,
    confidence_score: null,
    sun_remaining_minutes: null,
    next_sunny_window_start: null,
    next_sunny_window_end: null,
    best_window_start: null,
    best_window_end: null,
    best_window_duration_minutes: null,
    buildings_checked: 0,
    obstruction_building_id: null,
    confidence_factors: null,
    is_stale: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Request/response shapes expected from the solar service
// ---------------------------------------------------------------------------

interface SolarServiceSunlightResponse {
  prediction_time: string
  computed_at?: string
  sun_altitude_deg: number | null
  sun_azimuth_deg: number | null
  sunlight_status: SunlightStatus
  confidence_label: ConfidenceLabel
  confidence_score: number | null
  sun_remaining_minutes: number | null
  next_sunny_window_start: string | null
  next_sunny_window_end: string | null
  best_window_start: string | null
  best_window_end: string | null
  best_window_duration_minutes: number | null
  buildings_checked: number
  obstruction_building_id: string | null
  confidence_factors: Record<string, number> | null
}

interface SolarServiceBatchItem {
  venue_id: string
  lat: number
  lng: number
}

interface SolarServiceBatchResponse {
  predictions: Array<SolarServiceSunlightResponse & { venue_id: string }>
}

interface SolarServiceSunPositionResponse {
  altitude_deg: number
  azimuth_deg: number
  timestamp: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a sunlight prediction for a single location from the solar microservice.
 *
 * @param lat         Latitude of the venue
 * @param lng         Longitude of the venue
 * @param timestamp   ISO 8601 timestamp for the prediction (defaults to now)
 * @param buildings   Optional GeoJSON buildings context (passed as JSON string)
 * @param options     Additional query parameters
 * @returns           A SunlightPrediction (falls back to 'unknown' on error)
 */
export async function fetchSunlightForVenue(
  lat: number,
  lng: number,
  timestamp?: string,
  buildings?: unknown,
  options: Record<string, string> = {},
): Promise<SunlightPrediction> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    ...(timestamp ? { timestamp } : {}),
    ...options,
  })

  const url = `${SOLAR_SERVICE_URL}/sunlight?${params.toString()}`

  try {
    const response = await fetchWithRetry(url, {
      method: buildings ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      ...(buildings
        ? { body: JSON.stringify({ lat, lng, timestamp, buildings }) }
        : {}),
    })

    if (!response.ok) {
      console.error(
        `[solar-client] fetchSunlightForVenue failed: HTTP ${response.status}`,
        await response.text().catch(() => ''),
      )
      return unknownPrediction()
    }

    const data: SolarServiceSunlightResponse = await response.json()
    return {
      prediction_time: data.prediction_time,
      computed_at: data.computed_at,
      sun_altitude_deg: data.sun_altitude_deg,
      sun_azimuth_deg: data.sun_azimuth_deg,
      sunlight_status: data.sunlight_status,
      confidence_label: data.confidence_label,
      confidence_score: data.confidence_score,
      sun_remaining_minutes: data.sun_remaining_minutes,
      next_sunny_window_start: data.next_sunny_window_start,
      next_sunny_window_end: data.next_sunny_window_end,
      best_window_start: data.best_window_start,
      best_window_end: data.best_window_end,
      best_window_duration_minutes: data.best_window_duration_minutes,
      buildings_checked: data.buildings_checked,
      obstruction_building_id: data.obstruction_building_id,
      confidence_factors: data.confidence_factors,
      is_stale: false,
    }
  } catch (err) {
    console.error('[solar-client] fetchSunlightForVenue threw:', err)
    return unknownPrediction()
  }
}

/**
 * Fetch sunlight predictions for a batch of venues in one request.
 * Returns predictions in the same order as the input venues array.
 * Falls back to 'unknown' for any venue that fails.
 *
 * @param venues    Array of venue summaries (must have id, lat, lng)
 * @param timestamp ISO 8601 timestamp for the prediction (defaults to now)
 * @returns         SunlightPrediction[] in the same order as input
 */
export async function fetchBatchSunlight(
  venues: Pick<VenueSummary, 'id' | 'lat' | 'lng'>[],
  timestamp?: string,
): Promise<SunlightPrediction[]> {
  if (venues.length === 0) return []

  const body: { items: SolarServiceBatchItem[]; timestamp?: string } = {
    items: venues.map((v) => ({ venue_id: v.id, lat: v.lat, lng: v.lng })),
    ...(timestamp ? { timestamp } : {}),
  }

  const url = `${SOLAR_SERVICE_URL}/sunlight/batch`

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      console.error(
        `[solar-client] fetchBatchSunlight failed: HTTP ${response.status}`,
        await response.text().catch(() => ''),
      )
      return venues.map(() => unknownPrediction())
    }

    const data: SolarServiceBatchResponse = await response.json()

    // Build a map from venue_id -> prediction for ordering
    const predictionMap = new Map<string, SunlightPrediction>()
    for (const item of data.predictions) {
      predictionMap.set(item.venue_id, {
        venue_id: item.venue_id,
        prediction_time: item.prediction_time,
        computed_at: item.computed_at,
        sun_altitude_deg: item.sun_altitude_deg,
        sun_azimuth_deg: item.sun_azimuth_deg,
        sunlight_status: item.sunlight_status,
        confidence_label: item.confidence_label,
        confidence_score: item.confidence_score,
        sun_remaining_minutes: item.sun_remaining_minutes,
        next_sunny_window_start: item.next_sunny_window_start,
        next_sunny_window_end: item.next_sunny_window_end,
        best_window_start: item.best_window_start,
        best_window_end: item.best_window_end,
        best_window_duration_minutes: item.best_window_duration_minutes,
        buildings_checked: item.buildings_checked,
        obstruction_building_id: item.obstruction_building_id,
        confidence_factors: item.confidence_factors,
        is_stale: false,
      })
    }

    // Return in the same order as input, filling unknowns for missing
    return venues.map((v) => predictionMap.get(v.id) ?? unknownPrediction({ venue_id: v.id }))
  } catch (err) {
    console.error('[solar-client] fetchBatchSunlight threw:', err)
    return venues.map(() => unknownPrediction())
  }
}

/**
 * Fetch the current sun position (altitude + azimuth) for a lat/lng.
 *
 * @param lat       Latitude
 * @param lng       Longitude
 * @param timestamp ISO 8601 timestamp (defaults to now)
 * @returns         SunPosition or null on error
 */
export async function fetchSunPosition(
  lat: number,
  lng: number,
  timestamp?: string,
): Promise<SunPosition | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    ...(timestamp ? { timestamp } : {}),
  })

  const url = `${SOLAR_SERVICE_URL}/sun-position?${params.toString()}`

  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      console.error(
        `[solar-client] fetchSunPosition failed: HTTP ${response.status}`,
        await response.text().catch(() => ''),
      )
      return null
    }

    const data: SolarServiceSunPositionResponse = await response.json()
    return {
      altitude_deg: data.altitude_deg,
      azimuth_deg: data.azimuth_deg,
      timestamp: data.timestamp,
    }
  } catch (err) {
    console.error('[solar-client] fetchSunPosition threw:', err)
    return null
  }
}
