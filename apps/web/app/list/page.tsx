import { Suspense } from 'react'
import { VenueList } from '@/components/list/VenueList'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ViewToggle } from '@/components/layout/ViewToggle'
import { getAllCuratedVenues } from '@/lib/venues'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ListPage() {
  const venues = await getAllCuratedVenues()

  return (
    <div className="min-h-[calc(100dvh-56px)]">
      {/* Sticky header with toggle + filters */}
      <div className="sticky top-[56px] z-20 bg-stone-50/90 backdrop-blur border-b border-stone-200 px-4 py-2 flex items-center gap-3">
        <ViewToggle activeView="list" />
        <FilterPanel compact />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <Suspense
          fallback={
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-28 bg-stone-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          }
        >
          <VenueList initialVenues={venues} />
        </Suspense>
      </div>
    </div>
  )
}
