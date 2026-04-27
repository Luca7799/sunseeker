import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { VenueSummary, SunlightPrediction, VenueCategory } from '@/types'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl

    // Parse query params
    const latRaw = searchParams.get('lat')
    const lngRaw = searchParams.get('lng')
    const radiusRaw = searchParams.get('radius') ?? '2000'
    const categoryRaw = searchParams.get('category')
    const sunnyNow = searchParams.get('sunnyNow') === 'true'
    const outdoorSeating = searchParams.get('outdoorSeating') === 'true'
    const openNow = searchParams.get('openNow') === 'true'

    const lat = latRaw ? parseFloat(latRaw) : null
    const lng = lngRaw ? parseFloat(lngRaw) : null
    const radius = parseInt(radiusRaw, 10)

    if ((lat !== null && isNaN(lat)) || (lng !== null && isNaN(lng))) {
      return NextResponse.json(
        { data: null, error: 'Invalid lat/lng parameters' },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const categories: VenueCategory[] = categoryRaw
      ? (categoryRaw.split(',').map((c) => c.trim()) as VenueCategory[])
      : []

    const supabase = createClient()

    // ---------------------------------------------------------------------------
    // Fetch venues
    // ---------------------------------------------------------------------------
    let venues: VenueSummary[] = []

    if (lat !== null && lng !== null) {
      // Use spatial RPC
      const { data, error } = await supabase.rpc('venues_near', {
        user_lat: lat,
        user_lng: lng,
        radius_m: radius,
      })

      if (error) throw new Error(error.message)
      venues = (data ?? []) as VenueSummary[]
    } else {
      // Fetch all curated venues
      let query = supabase
        .from('venues')
        .select(
          'id, name, slug, category, lat, lng, outdoor_seating, is_curated, rating, opening_hours',
        )
        .eq('is_active', true)
        .eq('is_curated', true)

      if (categories.length > 0) {
        query = query.in('category', categories)
      }

      if (outdoorSeating) {
        query = query.in('outdoor_seating', ['confirmed', 'inferred'])
      }

      const { data, error } = await query.limit(200)
      if (error) throw new Error(error.message)
      venues = (data ?? []) as VenueSummary[]
    }

    // Apply category filter if spatial query was used
    if (lat !== null && categories.length > 0) {
      venues = venues.filter((v) => categories.includes(v.category))
    }

    // Apply outdoor seating filter for spatial query
    if (lat !== null && outdoorSeating) {
      venues = venues.filter((v) =>
        ['confirmed', 'inferred'].includes(v.outdoor_seating),
      )
    }

    // ---------------------------------------------------------------------------
    // Join sunlight predictions (within last 45 minutes)
    // ---------------------------------------------------------------------------
    const venueIds = venues.map((v) => v.id)

    if (venueIds.length > 0) {
      const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString()

      const { data: predictions } = await supabase
        .from('sunlight_predictions')
        .select('*')
        .in('venue_id', venueIds)
        .gte('computed_at', cutoff)
        .order('computed_at', { ascending: false })

      if (predictions) {
        // Map: most recent prediction per venue
        const predMap = new Map<string, SunlightPrediction>()
        for (const p of predictions) {
          if (p.venue_id && !predMap.has(p.venue_id)) {
            predMap.set(p.venue_id, p as SunlightPrediction)
          }
        }

        venues = venues.map((v) => ({
          ...v,
          sunlight: predMap.get(v.id) ?? null,
        }))
      }
    }

    // ---------------------------------------------------------------------------
    // Apply sunlight + open filters
    // ---------------------------------------------------------------------------
    if (sunnyNow) {
      venues = venues.filter(
        (v) =>
          v.sunlight?.sunlight_status === 'direct_sun' ||
          v.sunlight?.sunlight_status === 'likely_sun',
      )
    }

    if (openNow) {
      const now = new Date()
      const dayMap: Record<number, string> = {
        0: 'sun',
        1: 'mon',
        2: 'tue',
        3: 'wed',
        4: 'thu',
        5: 'fri',
        6: 'sat',
      }
      const day = dayMap[now.getDay()]
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      venues = venues.filter((v) => {
        if (!v.opening_hours) return true // unknown — include
        const hours = v.opening_hours[day as keyof typeof v.opening_hours]
        if (!hours) return false
        return currentTime >= hours.open && currentTime <= hours.close
      })
    }

    return NextResponse.json({ data: venues, error: null }, { headers: CORS_HEADERS })
  } catch (err) {
    console.error('[GET /api/venues]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
