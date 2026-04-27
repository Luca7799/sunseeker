import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/favorites — list the current user's favorites with venue data joined
export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ data: null, error: 'Authentication required' }, { status: 401 })
    }

    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(
        `
        id,
        user_id,
        venue_id,
        zone_id,
        created_at,
        venues (
          id,
          name,
          slug,
          category,
          lat,
          lng,
          outdoor_seating,
          is_curated,
          rating,
          opening_hours
        )
      `,
      )
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/favorites]', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: favorites ?? [], error: null })
  } catch (err) {
    console.error('[GET /api/favorites]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// POST /api/favorites — add a favorite
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ data: null, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { venue_id, zone_id } = body

    if (!venue_id && !zone_id) {
      return NextResponse.json(
        { data: null, error: 'Either venue_id or zone_id is required' },
        { status: 400 },
      )
    }

    // Check if already favorited
    const existingQuery = supabase
      .from('favorites')
      .select('id')
      .eq('user_id', session.user.id)

    if (venue_id) existingQuery.eq('venue_id', venue_id)
    if (zone_id) existingQuery.eq('zone_id', zone_id)

    const { data: existing } = await existingQuery.maybeSingle()

    if (existing) {
      return NextResponse.json(
        { data: existing, error: null },
        { status: 200 },
      )
    }

    const { data: favorite, error } = await supabase
      .from('favorites')
      .insert({
        user_id: session.user.id,
        venue_id: venue_id ?? null,
        zone_id: zone_id ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/favorites]', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: favorite, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/favorites]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// DELETE /api/favorites?venueId=X — remove a favorite
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ data: null, error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const venueId = searchParams.get('venueId')
    const zoneId = searchParams.get('zoneId')

    if (!venueId && !zoneId) {
      return NextResponse.json(
        { data: null, error: 'Either venueId or zoneId query param is required' },
        { status: 400 },
      )
    }

    let query = supabase
      .from('favorites')
      .delete()
      .eq('user_id', session.user.id)

    if (venueId) query = query.eq('venue_id', venueId)
    if (zoneId) query = query.eq('zone_id', zoneId)

    const { error } = await query

    if (error) {
      console.error('[DELETE /api/favorites]', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: { success: true }, error: null })
  } catch (err) {
    console.error('[DELETE /api/favorites]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
