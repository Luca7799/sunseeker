import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const STORAGE_BUCKET = 'venue-photos'

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

    // ------------------------------------------------------------------
    // Parse multipart form data
    // ------------------------------------------------------------------
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const venueId = formData.get('venueId') as string | null
    const caption = (formData.get('caption') as string | null) ?? null
    const showsTerrace = formData.get('showsTerrace') === 'true'
    const showsSun = formData.get('showsSun') === 'true'

    // ------------------------------------------------------------------
    // Validate inputs
    // ------------------------------------------------------------------
    if (!file) {
      return NextResponse.json({ data: null, error: 'No file provided' }, { status: 400 })
    }

    if (!venueId) {
      return NextResponse.json({ data: null, error: 'venueId is required' }, { status: 400 })
    }

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { data: null, error: 'Invalid file type. Accepted: JPEG, PNG, WebP' },
        { status: 400 },
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { data: null, error: 'File too large. Maximum size is 10 MB' },
        { status: 400 },
      )
    }

    // Validate venue exists
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('id')
      .eq('id', venueId)
      .eq('is_active', true)
      .maybeSingle()

    if (venueError || !venue) {
      return NextResponse.json({ data: null, error: 'Venue not found' }, { status: 404 })
    }

    // ------------------------------------------------------------------
    // Upload to Supabase Storage
    // ------------------------------------------------------------------
    const ext = MIME_TO_EXT[file.type] ?? 'jpg'
    const fileId = crypto.randomUUID()
    const storagePath = `${venueId}/${fileId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('[POST /api/photos/upload] storage upload error:', uploadError)
      return NextResponse.json(
        { data: null, error: `Upload failed: ${uploadError.message}` },
        { status: 500 },
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

    // ------------------------------------------------------------------
    // Insert photo record (status = pending)
    // ------------------------------------------------------------------
    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        venue_id: venueId,
        uploaded_by: userId,
        storage_path: storagePath,
        url: publicUrl,
        thumbnail_url: null,
        caption: caption ?? null,
        taken_at: null,
        shows_terrace: showsTerrace,
        shows_sun: showsSun,
        status: 'pending',
        is_featured: false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/photos/upload] db insert error:', insertError)
      // Attempt to remove the uploaded file since DB insert failed
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]).catch(() => {})
      return NextResponse.json(
        { data: null, error: `Database error: ${insertError.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ data: photo, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/photos/upload]', err)
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
