'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toaster'
import type { UserSubmission } from '@/types'

interface SubmissionReviewProps {
  submission: UserSubmission & {
    venue?: { id: string; name: string; category: string } | null
    user?: { id: string; display_name: string | null; trust_score: number } | null
  }
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  venue_add: { label: 'New venue', icon: '📍' },
  correction: { label: 'Correction', icon: '✏️' },
  photo: { label: 'Photo', icon: '📷' },
  outdoor_seating: { label: 'Outdoor seating', icon: '☀' },
  terrace_geometry: { label: 'Terrace geometry', icon: '📐' },
  opening_hours: { label: 'Opening hours', icon: '🕐' },
}

const TRUST_BADGE_VARIANT = (score: number): 'confirmed' | 'inferred' | 'neutral' => {
  if (score >= 80) return 'confirmed'
  if (score >= 50) return 'inferred'
  return 'neutral'
}

const TRUST_COLOR = (score: number) => {
  if (score > 70) return 'text-green-600'
  if (score >= 30) return 'text-orange-500'
  return 'text-red-500'
}

export function SubmissionReview({ submission }: SubmissionReviewProps) {
  const [rejectNote, setRejectNote] = useState('')
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const typeInfo = TYPE_LABELS[submission.submission_type] ?? {
    label: submission.submission_type,
    icon: '📋',
  }

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectNote.trim()) {
      toast({ title: 'Please enter a rejection note', variant: 'error' })
      return
    }

    setLoading(action)
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: submission.id,
          action,
          note: action === 'reject' ? rejectNote.trim() : undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Action failed')

      toast({
        title: action === 'approve' ? 'Submission approved' : 'Submission rejected',
        variant: 'success',
      })
      setDone(true)
    } catch (err) {
      toast({
        title: 'Action failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'error',
      })
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-stone-100 bg-stone-50 p-6 text-center text-stone-400 text-sm">
        Reviewed ✓
      </div>
    )
  }

  const trustScore = submission.user?.trust_score ?? 0

  return (
    <div className="rounded-xl border border-stone-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-stone-100">
        <span className="text-xl">{typeInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              {typeInfo.label}
            </span>
            <Badge variant="neutral" label={submission.status} />
          </div>
          {submission.venue && (
            <Link
              href={`/venue/${submission.venue.id}`}
              className="mt-1 block font-semibold text-stone-900 hover:underline truncate"
            >
              {submission.venue.name}
            </Link>
          )}
        </div>
        <span className="text-xs text-stone-400 shrink-0">
          {formatDistanceToNow(new Date(submission.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* User info */}
      <div className="flex items-center gap-2 px-4 py-2 bg-stone-50 border-b border-stone-100">
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-xs font-bold text-amber-700">
          {(submission.user?.display_name?.[0] ?? 'U').toUpperCase()}
        </div>
        <span className="text-sm text-stone-700">
          {submission.user?.display_name ?? 'Unknown user'}
        </span>
        <Badge
          variant={TRUST_BADGE_VARIANT(trustScore)}
          label={`Trust: ${trustScore}`}
          className={TRUST_COLOR(trustScore)}
        />
      </div>

      {/* Submission data */}
      <div className="p-4 space-y-3">
        {submission.correction_field && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Field
            </p>
            <p className="text-sm text-stone-800 font-mono bg-stone-50 rounded px-2 py-1">
              {submission.correction_field}
            </p>
          </div>
        )}

        {submission.correction_new_value && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              New value
            </p>
            <p className="text-sm text-stone-800 whitespace-pre-wrap bg-amber-50 rounded px-2 py-1 border border-amber-100">
              {submission.correction_new_value}
            </p>
          </div>
        )}

        {Object.keys(submission.data ?? {}).length > 0 && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              Submitted data
            </p>
            <pre className="text-xs text-stone-700 bg-stone-50 rounded p-3 overflow-auto max-h-48 border border-stone-100">
              {JSON.stringify(submission.data, null, 2)}
            </pre>
          </div>
        )}

        {submission.user_note && (
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1">
              User note
            </p>
            <p className="text-sm text-stone-700 italic">&ldquo;{submission.user_note}&rdquo;</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-stone-100 space-y-3">
        <textarea
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Rejection reason (required to reject)…"
          rows={2}
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={loading !== null}
            className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 text-sm transition-colors"
          >
            {loading === 'approve' ? 'Approving…' : '✓ Approve'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading !== null}
            className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-2 text-sm transition-colors"
          >
            {loading === 'reject' ? 'Rejecting…' : '✕ Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
