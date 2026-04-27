import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireAdminOrModerator(supabase: ReturnType<typeof createClient>) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin, is_moderator')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!profile?.is_admin && !profile?.is_moderator) return null

  return session
}

// GET /api/admin/photos?status=pending
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const session = await requireAdminOrModerator(supabase)

    if (!session) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status') ?? 'pending'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const { data: photos, error, count } = await supabase
      .from('photos')
      .select(
        `
        *,
        venue:venues (
          id,
          name
        )
      `,
        { count: 'exact' },
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[GET /api/admin/photos]', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: photos ?? [],
      total: count ?? 0,
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/admin/photos]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// PATCH /api/admin/photos — { id, action: 'approve'|'reject', is_featured? }
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const session = await requireAdminOrModerator(supabase)

    if (!session) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, action, is_featured } = body

    if (!id || !action) {
      return NextResponse.json(
        { data: null, error: 'id and action are required' },
        { status: 400 },
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { data: null, error: 'action must be "approve" or "reject"' },
        { status: 400 },
      )
    }

    // Fetch photo to check it exists
    const { data: existingPhoto, error: fetchError } = await supabase
      .from('photos')
      .select('id, venue_id, uploaded_by')
      .eq('id', id)
      .single()

    if (fetchError || !existingPhoto) {
      return NextResponse.json(
        { data: null, error: fetchError?.message ?? 'Photo not found' },
        { status: 404 },
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const setFeatured = action === 'approve' ? Boolean(is_featured) : false

    // If setting as featured, unset any existing featured photo for this venue
    if (setFeatured && existingPhoto.venue_id) {
      await supabase
        .from('photos')
        .update({ is_featured: false })
        .eq('venue_id', existingPhoto.venue_id)
        .eq('is_featured', true)
        .neq('id', id)
        .catch(() => {
          // Non-critical
        })
    }

    const { data: updated, error: updateError } = await supabase
      .from('photos')
      .update({
        status: newStatus,
        is_featured: setFeatured,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[PATCH /api/admin/photos]', updateError)
      return NextResponse.json({ data: null, error: updateError.message }, { status: 500 })
    }

    // Adjust uploader trust score
    if (existingPhoto.uploaded_by) {
      const trustDelta = action === 'approve' ? 2 : -1
      await supabase
        .rpc('adjust_user_trust_score', {
          uid: existingPhoto.uploaded_by,
          delta: trustDelta,
        })
        .catch(() => {
          // Non-critical
        })
    }

    return NextResponse.json({ data: updated, error: null })
  } catch (err) {
    console.error('[PATCH /api/admin/photos]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
