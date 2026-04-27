'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useAuthModal } from '@/components/auth/AuthModal'

const CORRECTION_FIELDS = [
  { value: 'outdoor_seating', label: 'Outdoor seating status' },
  { value: 'opening_hours', label: 'Opening hours' },
  { value: 'category', label: 'Category' },
  { value: 'address', label: 'Address' },
  { value: 'name', label: 'Venue name' },
  { value: 'outdoor_seating_notes', label: 'Outdoor seating notes' },
  { value: 'other', label: 'Other' },
] as const

interface CorrectionFormProps {
  venueId: string
  venueName: string
  onSuccess?: () => void
}

export function CorrectionForm({ venueId, venueName, onSuccess }: CorrectionFormProps) {
  const [correctionField, setCorrectionField] = useState('')
  const [correctionNewValue, setCorrectionNewValue] = useState('')
  const [userNote, setUserNote] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { openWithReason } = useAuthModal()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      openWithReason('Sign in to submit a correction')
      return
    }

    if (!correctionField || !correctionNewValue.trim()) {
      toast({ title: 'Please fill in all required fields', variant: 'error' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_type: 'correction',
          venue_id: venueId,
          correction_field: correctionField,
          correction_new_value: correctionNewValue.trim(),
          user_note: userNote.trim() || null,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? 'Failed to submit correction')
      }

      toast({
        title: 'Correction submitted',
        description: 'Thanks! Our team will review your correction.',
        variant: 'success',
      })

      setCorrectionField('')
      setCorrectionNewValue('')
      setUserNote('')
      onSuccess?.()
    } catch (err) {
      toast({
        title: 'Error submitting correction',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-sm text-stone-500 mb-4">
          Submitting a correction for <strong className="text-stone-900">{venueName}</strong>
        </p>
      </div>

      {/* Field to correct */}
      <div>
        <label htmlFor="correction-field" className="block text-sm font-medium text-stone-700 mb-1">
          What needs correcting? <span className="text-red-500">*</span>
        </label>
        <select
          id="correction-field"
          value={correctionField}
          onChange={(e) => setCorrectionField(e.target.value)}
          required
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Select a field…</option>
          {CORRECTION_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Correct value */}
      <div>
        <label
          htmlFor="correction-value"
          className="block text-sm font-medium text-stone-700 mb-1"
        >
          Correct value <span className="text-red-500">*</span>
        </label>
        <textarea
          id="correction-value"
          value={correctionNewValue}
          onChange={(e) => setCorrectionNewValue(e.target.value)}
          required
          rows={3}
          placeholder="Enter the correct value or information…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      {/* Optional user note */}
      <div>
        <label htmlFor="user-note" className="block text-sm font-medium text-stone-700 mb-1">
          Additional context{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea
          id="user-note"
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          rows={2}
          placeholder="e.g. I visited last week and…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !correctionField || !correctionNewValue.trim()}
        className="w-full rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2.5 text-sm transition-colors"
      >
        {loading ? 'Submitting…' : 'Submit Correction'}
      </button>
    </form>
  )
}
