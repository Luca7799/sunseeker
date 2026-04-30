import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/refresh-sunlight
 *
 * Called by Vercel Cron every 30 minutes.
 * Fetches all curated venues, calls the solar service for each,
 * and upserts fresh predictions into Supabase.
 *
 * Protected by CRON_SECRET so only Vercel (or you) can trigger it.
 */

const SOLAR_URL = process.env.SOLAR_SERVICE_URL ?? 'http://localhost:8000'
const NEARBY_RADIUS_M = 300
const PREDICTION_TTL_MIN = 45
const OFFSETS_MIN = [0, 30, 60, 120, 240]

export const maxDuration = 60 // seconds — Vercel Pro allows up to 300

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()
  const now = new Date()

  try {
    // 1. Fetch all curated active venues
    const { data: venues, error: venueErr } = await supabase
      .from('venues')
      .select('id, name, lat, lng, outdoor_seating')
      .eq('is_curated', true)
      .eq('is_active', true)

    if (venueErr) throw new Error(`venues fetch: ${venueErr.message}`)
    if (!venues || venues.length === 0) {
      return NextResponse.json({ ok: true, message: 'No venues found', upserted: 0 })
    }

    let totalUpserted = 0
    const errors: string[] = []

    for (const venue of venues) {
      try {
        // 2. Fetch nearby buildings via PostGIS RPC
        const { data: nearbyBuildings } = await supabase.rpc('buildings_near_point', {
          p_lat: venue.lat,
          p_lng: venue.lng,
          p_radius_meters: NEARBY_RADIUS_M,
        })

        const buildingsPayload = (nearbyBuildings ?? []).map((b: any) => ({
          osm_id: String(b.osm_id),
          footprint_geojson: b.footprint_geojson,
          height_meters: b.height_meters != null ? Number(b.height_meters) : null,
          data_quality: b.data_quality ?? 'unknown',
        }))

        // 3. Mark existing predictions stale
        await supabase
          .from('sunlight_predictions')
          .update({ is_stale: true })
          .eq('venue_id', venue.id)
          .eq('is_stale', false)

        const computedAt = new Date().toISOString()
        const validUntil = new Date(Date.now() + PREDICTION_TTL_MIN * 60 * 1000).toISOString()

        // 4. Compute predictions for each time offset
        for (const offsetMin of OFFSETS_MIN) {
          const targetTime = new Date(now.getTime() + offsetMin * 60 * 1000)

          const resp = await fetch(`${SOLAR_URL}/sunlight/compute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: venue.lat,
              lng: venue.lng,
              timestamp: targetTime.toISOString(),
              buildings: buildingsPayload,
              outdoor_seating_status:
                venue.outdoor_seating === 'confirmed'
                  ? 'confirmed'
                  : venue.outdoor_seating === 'inferred'
                    ? 'inferred'
                    : 'unknown',
            }),
            signal: AbortSignal.timeout(15_000),
          })

          if (!resp.ok) continue

          const result = await resp.json()

          const { error: upsertErr } = await supabase.from('sunlight_predictions').upsert(
            {
              venue_id: venue.id,
              zone_id: null,
              computed_at: computedAt,
              valid_until: validUntil,
              prediction_time: targetTime.toISOString(),
              sunlight_status: result.sunlight_status ?? 'unknown',
              confidence_score: result.confidence_score ?? 0,
              confidence_label: result.confidence_label ?? 'unknown',
              sun_remaining_minutes: result.sun_remaining_minutes ?? null,
              next_sunny_window_start: result.next_sunny_window_start ?? null,
              next_sunny_window_end: result.next_sunny_window_end ?? null,
              best_window_start: result.best_window_start ?? null,
              best_window_end: result.best_window_end ?? null,
              best_window_duration_minutes: result.best_window_duration_minutes ?? null,
              buildings_checked: result.buildings_checked ?? 0,
              obstruction_building_id: result.obstruction_building_id ?? null,
              confidence_factors: result.confidence_factors ?? {},
              is_stale: false,
            },
            { onConflict: 'venue_id,prediction_time' },
          )

          if (!upsertErr) totalUpserted++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${venue.name}: ${msg}`)
        console.error(`[cron] Error processing ${venue.name}:`, err)
      }
    }

    console.log(`[cron] refresh-sunlight done: ${totalUpserted} predictions, ${errors.length} errors`)

    return NextResponse.json({
      ok: true,
      venues: venues.length,
      upserted: totalUpserted,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('[cron] refresh-sunlight fatal:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
