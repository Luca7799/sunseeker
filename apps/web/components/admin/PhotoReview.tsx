'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toaster'
import type { Photo } from '@/types'

interface PhotoReviewProps {
  photo: Photo & { venue?: { id: string; name: string } | null }
}

export function PhotoReview({ photo }: PhotoReviewProps) {
  const [loading, setLoading] = useState<'approve' | 'feature' | 'reject' | null>(null)
  const [isFeatured, setIsFeatured] = useState(photo.is_featured)
  const [done, setDone] = useState(false)
  const { toast } = useToast()

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action === 'approve' ? (isFeatured ? 'feature' : 'approve') : 'reject')
    try {
      const res = await fetch('/api/admin/photos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: photo.id,
          action,
          is_featured: action === 'approve' ? isFeatured : false,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Action failed')

      toast({
        title:
          action === 'approve'
            ? isFeatured ? 'Photo approved and set as featured' : 'Photo approved'
            : 'Photo rejected',
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

  return (
    <div className="rounded-xl border border-stone-100 bg-white shadow-sm overflow-hidden">
      {/* Photo */}
      <div className="relative w-full aspect-video bg-stone-100">
        <Image
          src={photo.url}
          alt={photo.caption ?? 'Venue photo'}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 480px"
        />
      </div>

      {/* Meta */}
      <div className="p-4 space-y-3">
        {/* Venue */}
        {photo.venue && (
          <div>
            <Link
              href={`/venue/${photo.venue_id}`}
              className="font-semibold text-stone-900 hover:underline"
            >
              {photo.venue.name}
            </Link>
          </div>
        )}

        {/* Caption */}
        {photo.caption && (
          <p className="text-sm text-stone-600 italic">&ldquo;{photo.caption}&rdquo;</p>
        )}

        {/* Indicators */}
        <div className="flex flex-wrap gap-2">
          {photo.shows_terrace && (
            <Badge variant="confirmed" label="Shows terrace" icon="🪑" />
          )}
          {photo.shows_sun && (
            <Badge variant="sun" label="Shows sunlight" icon="☀" />
          )}
          {photo.is_featured && (
            <Badge variant="sun" label="Featured" icon="⭐" />
          )}
        </div>

        {/* Uploader + date */}
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>Uploaded by {photo.uploaded_by ? `user ${photo.uploaded_by.slice(0, 8)}…` : 'anonymous'}</span>
          <span>{formatDistanceToNow(new Date(photo.created_at), { addSuffix: true })}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 pt-0 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="rounded border-stone-300 text-amber-400 focus:ring-amber-400 w-4 h-4"
          />
          <span className="text-sm text-stone-700">Set as featured photo</span>
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('approve')}
            disabled={loading !== null}
            className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 text-sm transition-colors"
          >
            {loading === 'approve' || loading === 'feature' ? 'Approving…' : '✓ Approve'}
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading !== null}
            className="rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-2 px-4 text-sm transition-colors"
          >
            {loading === 'reject' ? '…' : '✕ Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}
