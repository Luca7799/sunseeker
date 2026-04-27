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

      {/* Filter button — bottom centre on mobile, top-left panel on desktop */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 md:bottom-auto md:top-3 md:left-3 md:translate-x-0">
        <FilterPanel />
      </div>

      {/* Map */}
      <Suspense fallback={<div className="h-full bg-stone-100 animate-pulse" />}>
        <MapView initialVenues={venues} />
      </Suspense>
    </div>
  )
}
