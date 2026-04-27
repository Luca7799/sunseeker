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

// GET /api/admin/submissions?status=pending
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

    const { data: submissions, error, count } = await supabase
      .from('user_submissions')
      .select(
        `
        *,
        venue:venues (
          id,
          name,
          category
        ),
        user:user_profiles (
          id,
          display_name,
          trust_score
        )
      `,
        { count: 'exact' },
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[GET /api/admin/submissions]', error)
      return NextResponse.json({ data: null, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: submissions ?? [],
      total: count ?? 0,
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/admin/submissions]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// PATCH /api/admin/submissions — { id, action: 'approve'|'reject', note? }
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient()
    const session = await requireAdminOrModerator(supabase)

    if (!session) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, action, note } = body

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

    // Fetch the submission first to validate and potentially apply changes
    const { data: submission, error: fetchError } = await supabase
      .from('user_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json(
        { data: null, error: fetchError?.message ?? 'Submission not found' },
        { status: 404 },
      )
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update submission status
    const { data: updated, error: updateError } = await supabase
      .from('user_submissions')
      .update({
        status: newStatus,
        review_note: note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[PATCH /api/admin/submissions]', updateError)
      return NextResponse.json({ data: null, error: updateError.message }, { status: 500 })
    }

    // If approving a correction, apply the change to the venue
    if (
      action === 'approve' &&
      submission.submission_type === 'correction' &&
      submission.venue_id &&
      submission.correction_field &&
      submission.correction_new_value !== null
    ) {
      const allowedFields = [
        'outdoor_seating',
        'opening_hours',
        'category',
        'address',
        'name',
        'outdoor_seating_notes',
      ]

      if (allowedFields.includes(submission.correction_field)) {
        const { error: venueUpdateError } = await supabase
          .from('venues')
          .update({
            [submission.correction_field]: submission.correction_new_value,
            updated_at: new Date().toISOString(),
          })
          .eq('id', submission.venue_id)

        if (venueUpdateError) {
          console.error(
            '[PATCH /api/admin/submissions] venue update error:',
            venueUpdateError,
          )
        }
      }
    }

    // Adjust user trust score based on action
    if (submission.user_id) {
      const trustDelta = action === 'approve' ? 2 : -1
      // Non-critical — ignore errors
      void supabase.rpc('adjust_user_trust_score', {
        uid: submission.user_id,
        delta: trustDelta,
      })
    }

    return NextResponse.json({ data: updated, error: null })
  } catch (err) {
    console.error('[PATCH /api/admin/submissions]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
