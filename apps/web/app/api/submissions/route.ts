import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SubmissionType } from '@/types'

const VALID_SUBMISSION_TYPES: SubmissionType[] = [
  'venue_add',
  'correction',
  'photo',
  'outdoor_seating',
  'terrace_geometry',
  'opening_hours',
]

const AUTO_APPROVE_TRUST_THRESHOLD = 80

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // ------------------------------------------------------------------
    // Auth check
    // ------------------------------------------------------------------
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ data: null, error: 'Authentication required' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await request.json()

    const {
      submission_type,
      venue_id,
      zone_id,
      data: submissionData,
      correction_field,
      correction_new_value,
      user_note,
    } = body

    // ------------------------------------------------------------------
    // Validate submission_type
    // ------------------------------------------------------------------
    if (!submission_type || !VALID_SUBMISSION_TYPES.includes(submission_type as SubmissionType)) {
      return NextResponse.json(
        { data: null, error: `Invalid submission_type. Must be one of: ${VALID_SUBMISSION_TYPES.join(', ')}` },
        { status: 400 },
      )
    }

    // ------------------------------------------------------------------
    // Validate venue_id exists if provided
    // ------------------------------------------------------------------
    if (venue_id) {
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('id')
        .eq('id', venue_id)
        .eq('is_active', true)
        .maybeSingle()

      if (venueError || !venue) {
        return NextResponse.json(
          { data: null, error: 'Venue not found or inactive' },
          { status: 404 },
        )
      }
    }

    // ------------------------------------------------------------------
    // Fetch user profile to check trust score
    // ------------------------------------------------------------------
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('trust_score, is_admin, is_moderator')
      .eq('id', userId)
      .maybeSingle()

    const trustScore = profile?.trust_score ?? 0
    const isPrivileged = profile?.is_admin || profile?.is_moderator

    // Auto-approve corrections from high-trust users
    const shouldAutoApprove =
      isPrivileged ||
      (submission_type === 'correction' && trustScore >= AUTO_APPROVE_TRUST_THRESHOLD)

    const status = shouldAutoApprove ? 'approved' : 'pending'

    // ------------------------------------------------------------------
    // Insert submission
    // ------------------------------------------------------------------
    const { data: submission, error: insertError } = await supabase
      .from('user_submissions')
      .insert({
        user_id: userId,
        submission_type,
        venue_id: venue_id ?? null,
        zone_id: zone_id ?? null,
        data: submissionData ?? {},
        correction_field: correction_field ?? null,
        correction_new_value: correction_new_value ?? null,
        user_note: user_note ?? null,
        status,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/submissions] insert error:', insertError)
      return NextResponse.json(
        { data: null, error: insertError.message },
        { status: 500 },
      )
    }

    // ------------------------------------------------------------------
    // If auto-approved correction, apply the change to the venue
    // ------------------------------------------------------------------
    if (shouldAutoApprove && submission_type === 'correction' && venue_id && correction_field) {
      const allowedFields = [
        'outdoor_seating',
        'opening_hours',
        'category',
        'address',
        'name',
        'outdoor_seating_notes',
      ]

      if (allowedFields.includes(correction_field) && correction_new_value !== undefined) {
        const updatePayload: Record<string, unknown> = {
          [correction_field]: correction_new_value,
          updated_at: new Date().toISOString(),
        }

        const { error: updateError } = await supabase
          .from('venues')
          .update(updatePayload)
          .eq('id', venue_id)

        if (updateError) {
          console.error('[POST /api/submissions] venue update error:', updateError)
        }
      }
    }

    // ------------------------------------------------------------------
    // Increment user's submission count
    // ------------------------------------------------------------------
    // Non-critical — ignore errors
    void supabase.rpc('increment_user_submission_count', { uid: userId })

    return NextResponse.json({ data: submission, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/submissions]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
