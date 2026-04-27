import { Suspense } from 'react'
import { MapView } from '@/components/map/MapView'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { ViewToggle } from '@/components/layout/ViewToggle'
import { getAllCuratedVenues } from '@/lib/venues'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const venues = await getAllCuratedVenues()

  return (
    <div className="relative h-[calc(100dvh-56px)]">
      {/* View toggle: Map / List */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <ViewToggle activeView="map" />
      </div>

      {/* Filter panel — slides in from top on mobile, fixed sidebar on desktop */}
      <div className="absolute top-14 left-3 z-10 md:top-3 md:left-3">
        <FilterPanel />
      </div>

      {/* Map */}
      <Suspense fallback={<div className="h-full bg-stone-100 animate-pulse" />}>
        <MapView initialVenues={venues} />
      </Suspense>
    </div>
  )
}
