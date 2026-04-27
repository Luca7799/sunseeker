import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Venue, SunlightPrediction, Photo } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json({ data: null, error: 'Missing venue id' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch full venue
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (venueError || !venue) {
      return NextResponse.json(
        { data: null, error: venueError?.message ?? 'Venue not found' },
        { status: 404 },
      )
    }

    // Fetch latest sunlight prediction (within 45 min, not stale)
    const cutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString()
    const { data: predictions } = await supabase
      .from('sunlight_predictions')
      .select('*')
      .eq('venue_id', id)
      .gte('computed_at', cutoff)
      .order('computed_at', { ascending: false })
      .limit(1)

    const sunlight: SunlightPrediction | null =
      predictions && predictions.length > 0 ? (predictions[0] as SunlightPrediction) : null

    // Fetch approved photos
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('venue_id', id)
      .eq('status', 'approved')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)

    // Fetch favorites count
    const { count: favoritesCount } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', id)

    // Check if the current user has favorited this venue
    const {
      data: { session },
    } = await supabase.auth.getSession()

    let is_favorited = false
    if (session?.user) {
      const { data: fav } = await supabase
        .from('favorites')
        .select('id')
        .eq('venue_id', id)
        .eq('user_id', session.user.id)
        .maybeSingle()

      is_favorited = Boolean(fav)
    }

    const result: Venue & { favorites_count: number } = {
      ...(venue as Venue),
      sunlight,
      photos: (photos ?? []) as Photo[],
      is_favorited,
      favorites_count: favoritesCount ?? 0,
    }

    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    console.error('[GET /api/venues/[id]]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
