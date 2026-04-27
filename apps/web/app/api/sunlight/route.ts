import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchSunlightForVenue } from '@/lib/solar-client'
import { getTimeOffset } from '@/lib/utils'
import type { TimeOffset, SunlightPrediction } from '@/types'

// How many minutes around the target time a cached prediction is considered fresh
const CACHE_WINDOW_MINUTES = 30

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const venueId = searchParams.get('venueId')
    const offsetParam = (searchParams.get('offset') ?? 'now') as TimeOffset

    if (!venueId) {
      return NextResponse.json({ data: null, error: 'Missing venueId parameter' }, { status: 400 })
    }

    const targetTime = getTimeOffset(offsetParam)
    const targetIso = targetTime.toISOString()

    const supabase = createClient()

    // ------------------------------------------------------------------
    // 1. Check cache
    // ------------------------------------------------------------------
    const windowMs = CACHE_WINDOW_MINUTES * 60 * 1000
    const windowStart = new Date(targetTime.getTime() - windowMs).toISOString()
    const windowEnd = new Date(targetTime.getTime() + windowMs).toISOString()

    const { data: cached } = await supabase
      .from('sunlight_predictions')
      .select('*')
      .eq('venue_id', venueId)
      .gte('prediction_time', windowStart)
      .lte('prediction_time', windowEnd)
      .eq('is_stale', false)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached) {
      return NextResponse.json({ data: cached as SunlightPrediction, error: null })
    }

    // ------------------------------------------------------------------
    // 2. Cache miss — fetch venue data
    // ------------------------------------------------------------------
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('id, lat, lng, outdoor_seating, building_data_quality')
      .eq('id', venueId)
      .eq('is_active', true)
      .single()

    if (venueError || !venue) {
      return NextResponse.json(
        { data: null, error: venueError?.message ?? 'Venue not found' },
        { status: 404 },
      )
    }

    // ------------------------------------------------------------------
    // 3. Fetch nearby buildings from DB
    // ------------------------------------------------------------------
    const { data: buildings } = await supabase.rpc('buildings_near_point', {
      point_lat: venue.lat,
      point_lng: venue.lng,
      radius_m: 150,
    })

    // ------------------------------------------------------------------
    // 4. Call solar service
    // ------------------------------------------------------------------
    const prediction = await fetchSunlightForVenue(
      venue.lat,
      venue.lng,
      targetIso,
      buildings ?? undefined,
    )

    // ------------------------------------------------------------------
    // 5. Upsert into sunlight_predictions cache
    // ------------------------------------------------------------------
    const { data: upserted, error: upsertError } = await supabase
      .from('sunlight_predictions')
      .upsert(
        {
          venue_id: venueId,
          prediction_time: targetIso,
          computed_at: new Date().toISOString(),
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
          is_stale: false,
        },
        {
          onConflict: 'venue_id,prediction_time',
          ignoreDuplicates: false,
        },
      )
      .select()
      .single()

    if (upsertError) {
      console.error('[GET /api/sunlight] upsert error:', upsertError)
      // Return the prediction even if upsert failed
      return NextResponse.json({ data: prediction, error: null })
    }

    return NextResponse.json({ data: upserted as SunlightPrediction, error: null })
  } catch (err) {
    console.error('[GET /api/sunlight]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
