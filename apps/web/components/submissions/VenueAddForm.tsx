'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useAuthModal } from '@/components/auth/AuthModal'
import type { VenueCategory, OutdoorSeatStatus } from '@/types'

const CATEGORIES: { value: VenueCategory; label: string }[] = [
  { value: 'cafe', label: 'Cafe' },
  { value: 'bar', label: 'Bar' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'rooftop', label: 'Rooftop' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'park', label: 'Park' },
  { value: 'bench', label: 'Bench' },
  { value: 'viewpoint', label: 'Viewpoint' },
]

const OUTDOOR_SEATING_OPTIONS: { value: OutdoorSeatStatus; label: string }[] = [
  { value: 'confirmed', label: 'Confirmed — I\'ve seen it' },
  { value: 'inferred', label: 'Inferred — likely but unconfirmed' },
  { value: 'none', label: 'None — no outdoor seating' },
  { value: 'unknown', label: 'Unknown' },
]

interface VenueAddFormProps {
  onSuccess?: () => void
}

export function VenueAddForm({ onSuccess }: VenueAddFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<VenueCategory | ''>('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [outdoorSeating, setOutdoorSeating] = useState<OutdoorSeatStatus | ''>('')
  const [outdoorSeatingNotes, setOutdoorSeatingNotes] = useState('')
  const [hasRooftop, setHasRooftop] = useState(false)
  const [openingHours, setOpeningHours] = useState('')
  const [website, setWebsite] = useState('')
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
      openWithReason('Sign in to submit a new venue')
      return
    }

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)

    if (!name.trim() || !category || !address.trim() || !outdoorSeating) {
      toast({ title: 'Please fill in all required fields', variant: 'error' })
      return
    }

    if (isNaN(latNum) || isNaN(lngNum)) {
      toast({ title: 'Invalid coordinates', description: 'Please enter valid latitude and longitude', variant: 'error' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_type: 'venue_add',
          data: {
            name: name.trim(),
            category,
            address: address.trim(),
            lat: latNum,
            lng: lngNum,
            outdoor_seating: outdoorSeating,
            outdoor_seating_notes: outdoorSeatingNotes.trim() || null,
            has_rooftop: hasRooftop,
            opening_hours_raw: openingHours.trim() || null,
            website: website.trim() || null,
          },
          user_note: userNote.trim() || null,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Submission failed')

      toast({
        title: 'Venue submitted',
        description: 'Thanks! We\'ll review your submission and add it to the map.',
        variant: 'success',
      })

      // Reset form
      setName('')
      setCategory('')
      setAddress('')
      setLat('')
      setLng('')
      setOutdoorSeating('')
      setOutdoorSeatingNotes('')
      setHasRooftop(false)
      setOpeningHours('')
      setWebsite('')
      setUserNote('')
      onSuccess?.()
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-stone-500">
        Know a sunny spot that's missing from the map? Add it here!
      </p>

      {/* Name */}
      <div>
        <label htmlFor="venue-name" className="block text-sm font-medium text-stone-700 mb-1">
          Venue name <span className="text-red-500">*</span>
        </label>
        <input
          id="venue-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Bar Bosch"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="venue-category" className="block text-sm font-medium text-stone-700 mb-1">
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="venue-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as VenueCategory)}
          required
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="venue-address" className="block text-sm font-medium text-stone-700 mb-1">
          Address <span className="text-red-500">*</span>
        </label>
        <input
          id="venue-address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="e.g. Carrer de Sant Miquel, 1, Palma"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Lat / Lng */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="venue-lat" className="block text-sm font-medium text-stone-700 mb-1">
            Latitude <span className="text-red-500">*</span>
          </label>
          <input
            id="venue-lat"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            required
            placeholder="39.5696"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div>
          <label htmlFor="venue-lng" className="block text-sm font-medium text-stone-700 mb-1">
            Longitude <span className="text-red-500">*</span>
          </label>
          <input
            id="venue-lng"
            type="number"
            step="any"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            required
            placeholder="2.6502"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>
      <p className="text-xs text-stone-400 -mt-3">
        Tip: right-click on Google Maps to copy coordinates.
      </p>

      {/* Outdoor seating */}
      <div>
        <label
          htmlFor="venue-outdoor"
          className="block text-sm font-medium text-stone-700 mb-1"
        >
          Outdoor seating <span className="text-red-500">*</span>
        </label>
        <select
          id="venue-outdoor"
          value={outdoorSeating}
          onChange={(e) => setOutdoorSeating(e.target.value as OutdoorSeatStatus)}
          required
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <option value="">Select…</option>
          {OUTDOOR_SEATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Outdoor seating notes */}
      <div>
        <label
          htmlFor="venue-outdoor-notes"
          className="block text-sm font-medium text-stone-700 mb-1"
        >
          Outdoor seating notes{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="venue-outdoor-notes"
          type="text"
          value={outdoorSeatingNotes}
          onChange={(e) => setOutdoorSeatingNotes(e.target.value)}
          placeholder="e.g. Rooftop with partial shade"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Rooftop checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hasRooftop}
          onChange={(e) => setHasRooftop(e.target.checked)}
          className="rounded border-stone-300 text-amber-400 focus:ring-amber-400 w-4 h-4"
        />
        <span className="text-sm text-stone-700">Has a rooftop terrace</span>
      </label>

      {/* Opening hours */}
      <div>
        <label htmlFor="venue-hours" className="block text-sm font-medium text-stone-700 mb-1">
          Opening hours{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="venue-hours"
          type="text"
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          placeholder="e.g. Mon–Fri 09:00–22:00, Sat–Sun 10:00–23:00"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Website */}
      <div>
        <label htmlFor="venue-website" className="block text-sm font-medium text-stone-700 mb-1">
          Website{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="venue-website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* User note */}
      <div>
        <label htmlFor="venue-user-note" className="block text-sm font-medium text-stone-700 mb-1">
          Your note{' '}
          <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <textarea
          id="venue-user-note"
          value={userNote}
          onChange={(e) => setUserNote(e.target.value)}
          rows={2}
          placeholder="e.g. I've been here — the terrace faces south and gets sun all afternoon"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2.5 text-sm transition-colors"
      >
        {loading ? 'Submitting…' : 'Submit Venue'}
      </button>
    </form>
  )
}
