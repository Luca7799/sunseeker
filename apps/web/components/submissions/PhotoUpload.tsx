'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toaster'
import { useAuthModal } from '@/components/auth/AuthModal'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface PhotoUploadProps {
  venueId: string
  venueName: string
  onSuccess?: () => void
}

export function PhotoUpload({ venueId, venueName, onSuccess }: PhotoUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [showsTerrace, setShowsTerrace] = useState(false)
  const [showsSun, setShowsSun] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { openWithReason } = useAuthModal()
  const supabase = createClient()

  const processFile = (f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({ title: 'Invalid file type', description: 'Please use JPG, PNG, or WebP', variant: 'error' })
      return
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 10 MB', variant: 'error' })
      return
    }
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      openWithReason('Sign in to upload a photo')
      return
    }

    if (!file) {
      toast({ title: 'Please select a photo', variant: 'error' })
      return
    }

    setUploading(true)
    setProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('venueId', venueId)
      formData.append('caption', caption)
      formData.append('showsTerrace', String(showsTerrace))
      formData.append('showsSun', String(showsSun))

      // Simulate progress since fetch doesn't natively support upload progress
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 85))
      }, 200)

      const res = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      setProgress(100)

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed')
      }

      toast({
        title: 'Photo uploaded',
        description: 'Thanks! Your photo will appear after review.',
        variant: 'success',
      })

      setFile(null)
      setPreview(null)
      setCaption('')
      setShowsTerrace(false)
      setShowsSun(false)
      setProgress(0)
      onSuccess?.()
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'error',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-stone-500">
        Upload a photo for <strong className="text-stone-900">{venueName}</strong>
      </p>

      {/* Drop zone / preview */}
      {preview ? (
        <div className="relative rounded-xl overflow-hidden bg-stone-100 aspect-video">
          <Image src={preview} alt="Preview" fill className="object-cover" />
          <button
            type="button"
            onClick={() => {
              setFile(null)
              setPreview(null)
              if (inputRef.current) inputRef.current.value = ''
            }}
            className="absolute top-2 right-2 rounded-full bg-black/60 text-white w-7 h-7 flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors
            ${dragging ? 'border-amber-400 bg-amber-50' : 'border-stone-200 hover:border-amber-300 hover:bg-stone-50'}`}
        >
          <span className="text-3xl">📷</span>
          <p className="text-sm text-stone-600 font-medium">Drop a photo or click to browse</p>
          <p className="text-xs text-stone-400">JPG, PNG, WebP · max 10 MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Caption */}
      <div>
        <label htmlFor="photo-caption" className="block text-sm font-medium text-stone-700 mb-1">
          Caption <span className="font-normal text-stone-400">(optional)</span>
        </label>
        <input
          id="photo-caption"
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="e.g. Sunny terrace at 2pm in April"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </div>

      {/* Checkboxes */}
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showsTerrace}
            onChange={(e) => setShowsTerrace(e.target.checked)}
            className="rounded border-stone-300 text-amber-400 focus:ring-amber-400 w-4 h-4"
          />
          <span className="text-sm text-stone-700">Shows terrace?</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showsSun}
            onChange={(e) => setShowsSun(e.target.checked)}
            className="rounded border-stone-300 text-amber-400 focus:ring-amber-400 w-4 h-4"
          />
          <span className="text-sm text-stone-700">Shows sunlight?</span>
        </label>
      </div>

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all duration-200 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-stone-400 text-right">{progress}%</p>
        </div>
      )}

      <button
        type="submit"
        disabled={uploading || !file}
        className="w-full rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-medium py-2.5 text-sm transition-colors"
      >
        {uploading ? 'Uploading…' : 'Upload Photo'}
      </button>
    </form>
  )
}
