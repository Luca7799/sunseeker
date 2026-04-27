import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchBatchSunlight } from '@/lib/solar-client'
import { getTimeOffset } from '@/lib/utils'
import type { TimeOffset, SunlightPrediction } from '@/types'

const CACHE_WINDOW_MINUTES = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const venueIds: string[] = Array.isArray(body.venueIds) ? body.venueIds : []
    const offsetParam: TimeOffset = body.offset ?? 'now'

    if (venueIds.length === 0) {
      return NextResponse.json({ data: {}, error: null })
    }

    // Deduplicate
    const uniqueIds = [...new Set(venueIds.filter((id) => typeof id === 'string' && id.length > 0))]

    const targetTime = getTimeOffset(offsetParam)
    const targetIso = targetTime.toISOString()

    const supabase = createClient()

    // ------------------------------------------------------------------
    // 1. Check cache for all venues
    // ------------------------------------------------------------------
    const windowMs = CACHE_WINDOW_MINUTES * 60 * 1000
    const windowStart = new Date(targetTime.getTime() - windowMs).toISOString()
    const windowEnd = new Date(targetTime.getTime() + windowMs).toISOString()

    const { data: cachedRows } = await supabase
      .from('sunlight_predictions')
      .select('*')
      .in('venue_id', uniqueIds)
      .gte('prediction_time', windowStart)
      .lte('prediction_time', windowEnd)
      .eq('is_stale', false)
      .order('computed_at', { ascending: false })

    // Build result map from cache; track which venue IDs still need fresh computation
    const resultMap: Record<string, SunlightPrediction> = {}

    if (cachedRows) {
      for (const row of cachedRows) {
        if (row.venue_id && !resultMap[row.venue_id]) {
          resultMap[row.venue_id] = row as SunlightPrediction
        }
      }
    }

    const missIds = uniqueIds.filter((id) => !resultMap[id])

    // ------------------------------------------------------------------
    // 2. For cache misses, fetch venue data and call solar service
    // ------------------------------------------------------------------
    if (missIds.length > 0) {
      const { data: venues } = await supabase
        .from('venues')
        .select('id, lat, lng, outdoor_seating, building_data_quality')
        .in('id', missIds)
        .eq('is_active', true)

      if (venues && venues.length > 0) {
        const predictions = await fetchBatchSunlight(
          venues.map((v) => ({ id: v.id, lat: v.lat, lng: v.lng })),
          targetIso,
        )

        // Upsert all predictions in parallel
        const upsertRows = venues.map((v, i) => {
          const p = predictions[i]
          return {
            venue_id: v.id,
            prediction_time: targetIso,
            computed_at: new Date().toISOString(),
            sun_altitude_deg: p.sun_altitude_deg,
            sun_azimuth_deg: p.sun_azimuth_deg,
            sunlight_status: p.sunlight_status,
            confidence_label: p.confidence_label,
            confidence_score: p.confidence_score,
            sun_remaining_minutes: p.sun_remaining_minutes,
            next_sunny_window_start: p.next_sunny_window_start,
            next_sunny_window_end: p.next_sunny_window_end,
            best_window_start: p.best_window_start,
            best_window_end: p.best_window_end,
            best_window_duration_minutes: p.best_window_duration_minutes,
            buildings_checked: p.buildings_checked,
            obstruction_building_id: p.obstruction_building_id,
            confidence_factors: p.confidence_factors,
            is_stale: false,
          }
        })

        const { data: upserted, error: upsertError } = await supabase
          .from('sunlight_predictions')
          .upsert(upsertRows, {
            onConflict: 'venue_id,prediction_time',
            ignoreDuplicates: false,
          })
          .select()

        if (!upsertError && upserted) {
          for (const row of upserted) {
            if (row.venue_id) {
              resultMap[row.venue_id] = row as SunlightPrediction
            }
          }
        } else {
          // Fallback: use the in-memory predictions from solar service
          venues.forEach((v, i) => {
            resultMap[v.id] = { ...predictions[i], venue_id: v.id }
          })
        }
      }
    }

    return NextResponse.json({ data: resultMap, error: null })
  } catch (err) {
    console.error('[POST /api/sunlight/batch]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
