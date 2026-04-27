'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Admin guard
// ---------------------------------------------------------------------------

async function assertAdmin(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthenticated')
  }

  const adminSupabase = createAdminClient()
  const { data: profile, error: profileError } = await adminSupabase
    .from('user_profiles')
    .select('is_admin, is_moderator')
    .eq('id', user.id)
    .single()

  if (profileError || (!profile?.is_admin && !profile?.is_moderator)) {
    throw new Error('Forbidden: admin or moderator role required')
  }

  return user.id
}

// ---------------------------------------------------------------------------
// Submission actions
// ---------------------------------------------------------------------------

/**
 * Approve a user submission.
 * Sets status='approved', records reviewer and timestamp.
 */
export async function approveSubmission(submissionId: string, _formData: FormData): Promise<void> {
  const reviewerId = await assertAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('user_submissions')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      moderation_action: 'approve',
    })
    .eq('id', submissionId)

  if (error) {
    console.error('[admin/actions] approveSubmission error:', error.message)
    throw new Error(`Failed to approve submission: ${error.message}`)
  }

  revalidatePath('/admin')
}

/**
 * Reject a user submission.
 * Sets status='rejected', records reviewer, timestamp, and optional review note.
 */
export async function rejectSubmission(
  submissionId: string,
  _formData: FormData,
): Promise<void> {
  const reviewerId = await assertAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('user_submissions')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      moderation_action: 'reject',
    })
    .eq('id', submissionId)

  if (error) {
    console.error('[admin/actions] rejectSubmission error:', error.message)
    throw new Error(`Failed to reject submission: ${error.message}`)
  }

  revalidatePath('/admin')
}

// ---------------------------------------------------------------------------
// Photo actions
// ---------------------------------------------------------------------------

/**
 * Approve a photo submission.
 * Sets status='approved'. Optionally marks as featured.
 */
export async function approvePhoto(
  photoId: string,
  _formData: FormData,
): Promise<void> {
  await assertAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('photos')
    .update({
      status: 'approved',
    })
    .eq('id', photoId)

  if (error) {
    console.error('[admin/actions] approvePhoto error:', error.message)
    throw new Error(`Failed to approve photo: ${error.message}`)
  }

  revalidatePath('/admin')
}

/**
 * Reject a photo submission.
 * Sets status='rejected'.
 */
export async function rejectPhoto(photoId: string, _formData: FormData): Promise<void> {
  await assertAdmin()
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('photos')
    .update({ status: 'rejected' })
    .eq('id', photoId)

  if (error) {
    console.error('[admin/actions] rejectPhoto error:', error.message)
    throw new Error(`Failed to reject photo: ${error.message}`)
  }

  revalidatePath('/admin')
}
