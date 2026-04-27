import { createAdminClient, createClient } from '@/lib/supabase/server'
import { approveSubmission, rejectSubmission, approvePhoto, rejectPhoto } from './actions'
import type { UserSubmission, Photo, Venue } from '@/types'
import { categoryLabel, categoryIcon, cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), 'dd MMM yyyy, HH:mm')
  } catch {
    return iso
  }
}

function TrustBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-100 text-emerald-700' :
    score >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-600'
  return (
    <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium', color)}>
      {score} pts
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'pending' ? 'bg-amber-100 text-amber-700' :
    status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
    status === 'rejected' ? 'bg-red-100 text-red-600' :
    'bg-stone-100 text-stone-500'
  return (
    <span className={cn('text-xs rounded-full px-2 py-0.5 font-medium capitalize', color)}>
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Pending Submissions tab
// ---------------------------------------------------------------------------

function SubmissionRow({ submission }: { submission: UserSubmission }) {
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-stone-800 text-sm">
          {submission.venue?.name ?? <span className="text-stone-400 italic">No venue</span>}
        </div>
        {submission.venue?.category && (
          <div className="text-xs text-stone-400 mt-0.5">
            {categoryIcon(submission.venue.category)} {categoryLabel(submission.venue.category)}
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs rounded-full bg-stone-100 text-stone-600 px-2 py-0.5 font-mono">
          {submission.submission_type.replace('_', ' ')}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="text-sm text-stone-700">
          {submission.user?.display_name ?? <span className="italic text-stone-400">Anonymous</span>}
        </div>
        {submission.user?.trust_score != null && (
          <div className="mt-0.5">
            <TrustBadge score={submission.user.trust_score} />
          </div>
        )}
      </td>
      <td className="py-3 px-4">
        {submission.correction_field && (
          <div className="text-xs text-stone-500 space-y-0.5">
            <div><span className="font-medium">Field:</span> {submission.correction_field}</div>
            {submission.correction_old_value && (
              <div className="text-red-500 line-through">{submission.correction_old_value}</div>
            )}
            {submission.correction_new_value && (
              <div className="text-emerald-600">{submission.correction_new_value}</div>
            )}
          </div>
        )}
        {submission.user_note && (
          <p className="text-xs text-stone-500 mt-1 italic max-w-[220px] truncate" title={submission.user_note}>
            {submission.user_note}
          </p>
        )}
      </td>
      <td className="py-3 px-4 text-xs text-stone-400 whitespace-nowrap">
        {formatDate(submission.created_at)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <form action={approveSubmission.bind(null, submission.id)}>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
          </form>
          <form action={rejectSubmission.bind(null, submission.id)}>
            <button
              type="submit"
              className="rounded-lg bg-red-500 text-white text-xs font-medium px-3 py-1.5 hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}

function PendingSubmissionsTable({ submissions }: { submissions: UserSubmission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        No pending submissions. All caught up!
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <th className="py-3 px-4">Venue</th>
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4">User</th>
            <th className="py-3 px-4">Details</th>
            <th className="py-3 px-4">Submitted</th>
            <th className="py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <SubmissionRow key={s.id} submission={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending Photos tab
// ---------------------------------------------------------------------------

function PhotoRow({ photo }: { photo: Photo & { venue_name?: string | null } }) {
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="py-3 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.thumbnail_url ?? photo.url}
          alt={photo.caption ?? 'Venue photo'}
          className="w-16 h-16 rounded-lg object-cover bg-stone-100"
        />
      </td>
      <td className="py-3 px-4">
        <div className="font-medium text-stone-800 text-sm">
          {(photo as any).venue_name ?? <span className="italic text-stone-400">Unknown venue</span>}
        </div>
        {photo.caption && (
          <p className="text-xs text-stone-400 mt-0.5 max-w-[200px] truncate" title={photo.caption}>
            {photo.caption}
          </p>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          {photo.shows_terrace && (
            <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">Terrace</span>
          )}
          {photo.shows_sun && (
            <span className="text-xs bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">Sun</span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-xs text-stone-400 whitespace-nowrap">
        {formatDate(photo.created_at)}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <form action={approvePhoto.bind(null, photo.id)}>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-emerald-700 transition-colors"
            >
              Approve
            </button>
          </form>
          <form action={rejectPhoto.bind(null, photo.id)}>
            <button
              type="submit"
              className="rounded-lg bg-red-500 text-white text-xs font-medium px-3 py-1.5 hover:bg-red-600 transition-colors"
            >
              Reject
            </button>
          </form>
        </div>
      </td>
    </tr>
  )
}

function PendingPhotosTable({
  photos,
}: {
  photos: (Photo & { venue_name?: string | null })[]
}) {
  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        No pending photos.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <th className="py-3 px-4">Preview</th>
            <th className="py-3 px-4">Venue</th>
            <th className="py-3 px-4">Tags</th>
            <th className="py-3 px-4">Uploaded</th>
            <th className="py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {photos.map((p) => (
            <PhotoRow key={p.id} photo={p} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// All Venues tab
// ---------------------------------------------------------------------------

function VenueRow({ venue }: { venue: Venue }) {
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-stone-800 text-sm">{venue.name}</div>
        <div className="text-xs text-stone-400 mt-0.5 font-mono">{venue.slug}</div>
      </td>
      <td className="py-3 px-4">
        <span className="text-sm">
          {categoryIcon(venue.category)} {categoryLabel(venue.category)}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-stone-500">{venue.address ?? '—'}</td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          {venue.is_curated && (
            <span className="text-xs bg-violet-50 text-violet-600 rounded-full px-2 py-0.5 font-medium">
              Curated
            </span>
          )}
          <StatusBadge status={venue.is_active ? 'active' : 'inactive'} />
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={cn(
            'text-xs rounded-full px-2 py-0.5 font-medium capitalize',
            venue.outdoor_seating === 'confirmed'
              ? 'bg-emerald-50 text-emerald-700'
              : venue.outdoor_seating === 'inferred'
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-stone-100 text-stone-500',
          )}
        >
          {venue.outdoor_seating}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-stone-400 whitespace-nowrap">
        {formatDate(venue.updated_at)}
      </td>
    </tr>
  )
}

function AllVenuesTable({ venues }: { venues: Venue[] }) {
  if (venues.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        No venues found.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold text-stone-500 uppercase tracking-wide">
            <th className="py-3 px-4">Name / Slug</th>
            <th className="py-3 px-4">Category</th>
            <th className="py-3 px-4">Address</th>
            <th className="py-3 px-4">Flags</th>
            <th className="py-3 px-4">Outdoor</th>
            <th className="py-3 px-4">Updated</th>
          </tr>
        </thead>
        <tbody>
          {venues.map((v) => (
            <VenueRow key={v.id} venue={v} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

function TabBar({
  activeTab,
  counts,
}: {
  activeTab: string
  counts: { submissions: number; photos: number; venues: number }
}) {
  const tabs = [
    { id: 'submissions', label: 'Pending Submissions', count: counts.submissions },
    { id: 'photos', label: 'Pending Photos', count: counts.photos },
    { id: 'venues', label: 'All Venues', count: counts.venues },
  ]
  return (
    <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
      {tabs.map((tab) => (
        <a
          key={tab.id}
          href={`?tab=${tab.id}`}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-500 hover:text-stone-700',
          )}
        >
          {tab.label}
          <span
            className={cn(
              'text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center',
              activeTab === tab.id ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-600',
            )}
          >
            {tab.count}
          </span>
        </a>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  // Auth check — use the regular (anon) client to get the session user
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-stone-800">Sign in required</p>
          <p className="text-sm text-stone-500">You must be signed in to access the admin panel.</p>
          <a
            href="/auth/login?next=/admin"
            className="inline-block mt-3 rounded-xl bg-stone-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-stone-700 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    )
  }

  // Fetch user profile to check admin role
  const adminSupabase = createAdminClient()
  const { data: profile } = await adminSupabase
    .from('user_profiles')
    .select('is_admin, is_moderator, display_name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_moderator) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-56px)]">
        <div className="text-center space-y-2">
          <p className="text-4xl font-bold text-stone-300">403</p>
          <p className="text-lg font-semibold text-stone-800">Access denied</p>
          <p className="text-sm text-stone-500">
            You do not have permission to access the admin dashboard.
          </p>
          <a
            href="/"
            className="inline-block mt-3 text-sm text-stone-500 hover:text-stone-800 underline"
          >
            Back to map
          </a>
        </div>
      </div>
    )
  }

  const activeTab = searchParams.tab ?? 'submissions'

  // Fetch all three datasets in parallel
  const [
    { data: submissionsData },
    { data: photosData },
    { data: venuesData },
  ] = await Promise.all([
    adminSupabase
      .from('user_submissions')
      .select(`
        id, user_id, submission_type, status, venue_id, zone_id,
        data, correction_field, correction_old_value, correction_new_value,
        user_note, review_note, created_at, updated_at,
        venue:venues(id, name, category),
        user:user_profiles(id, display_name, trust_score)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    adminSupabase
      .from('photos')
      .select(`
        id, venue_id, zone_id, uploaded_by, storage_path, url, thumbnail_url,
        caption, taken_at, shows_terrace, shows_sun, status, is_featured, created_at,
        venue:venues(name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    adminSupabase
      .from('venues')
      .select(`
        id, name, slug, category, subcategories, description, address, city,
        lat, lng, outdoor_seating, outdoor_seating_notes, has_rooftop, rooftop_level,
        is_curated, data_source, opening_hours, opening_hours_raw,
        phone, website, rating, rating_count, price_level,
        building_data_quality, is_active, created_at, updated_at
      `)
      .order('name', { ascending: true }),
  ])

  const submissions = (submissionsData ?? []) as UserSubmission[]
  const photos = (photosData ?? []).map((p: any) => ({
    ...p,
    venue_name: p.venue?.name ?? null,
    venue: undefined,
  })) as (Photo & { venue_name: string | null })[]
  const venues = (venuesData ?? []) as Venue[]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Admin dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Signed in as{' '}
            <span className="font-medium">{profile.display_name ?? user.email}</span>
            {profile.is_admin && (
              <span className="ml-2 text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 font-medium">
                Admin
              </span>
            )}
          </p>
        </div>
        <a
          href="/"
          className="text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          ← Back to map
        </a>
      </div>

      {/* Tab navigation */}
      <TabBar
        activeTab={activeTab}
        counts={{
          submissions: submissions.length,
          photos: photos.length,
          venues: venues.length,
        }}
      />

      {/* Tab content */}
      {activeTab === 'submissions' && (
        <section>
          <h2 className="text-base font-semibold text-stone-800 mb-4">
            Pending submissions ({submissions.length})
          </h2>
          <PendingSubmissionsTable submissions={submissions} />
        </section>
      )}

      {activeTab === 'photos' && (
        <section>
          <h2 className="text-base font-semibold text-stone-800 mb-4">
            Pending photos ({photos.length})
          </h2>
          <PendingPhotosTable photos={photos} />
        </section>
      )}

      {activeTab === 'venues' && (
        <section>
          <h2 className="text-base font-semibold text-stone-800 mb-4">
            All venues ({venues.length})
          </h2>
          <AllVenuesTable venues={venues} />
        </section>
      )}
    </div>
  )
}
