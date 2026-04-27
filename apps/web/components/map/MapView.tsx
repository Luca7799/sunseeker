'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Map, {
  Marker,
  Popup,
  NavigationControl,
  GeolocateControl,
} from 'react-map-gl'
import Link from 'next/link'
import 'mapbox-gl/dist/mapbox-gl.css'

import { useFiltersStore } from '@/store/filtersStore'
import { VenueMarker } from './VenueMarker'
import { TimeSlider } from './TimeSlider'
import {
  cn,
  formatDistance,
  formatSunRemaining,
  sunlightStatusLabel,
  sunlightStatusColor,
  isOpenNow,
} from '@/lib/utils'
import type { VenueSummary, TimeOffset } from '@/types'

const PALMA_CENTER = {
  latitude: 39.5696,
  longitude: 2.6502,
  zoom: 14,
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

function isSunny(venue: VenueSummary): boolean {
  const s = venue.sunlight?.sunlight_status
  return s === 'direct_sun' || s === 'likely_sun'
}

interface MapViewProps {
  initialVenues: VenueSummary[]
}

export function MapView({ initialVenues }: MapViewProps) {
  const [venues, setVenues] = useState<VenueSummary[]>(initialVenues)
  const [popupVenueId, setPopupVenueId] = useState<string | null>(null)
  const geolocateRef = useRef<mapboxgl.GeolocateControl | null>(null)

  const { filters, timeOffset, selectedVenueId, setSelectedVenueId, setTimeOffset } =
    useFiltersStore()

  // Filter venues based on active filters
  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const status = v.sunlight?.sunlight_status

      if (filters.sunnyNow && !isSunny(v)) return false
      if (filters.sunnyIn30) {
        // When sunnyIn30 is active we treat it as a proxy — in a real app this
        // would come from a separate prediction field. For now keep sunny venues.
        if (!isSunny(v)) return false
      }
      if (filters.outdoorSeating && v.outdoor_seating === 'none') return false
      if (filters.openNow && !isOpenNow(v.opening_hours)) return false
      if (filters.categories.length > 0 && !filters.categories.includes(v.category))
        return false
      if (filters.confirmedOutdoorOnly && v.outdoor_seating !== 'confirmed') return false
      if (filters.minConfidence) {
        const conf = v.sunlight?.confidence_label
        const order: Record<string, number> = {
          confirmed: 4,
          high: 3,
          medium: 2,
          low: 1,
          unknown: 0,
        }
        const minOrder = order[filters.minConfidence] ?? 0
        if ((order[conf ?? 'unknown'] ?? 0) < minOrder) return false
      }

      return true
    })
  }, [venues, filters])

  const popupVenue = useMemo(
    () => filteredVenues.find((v) => v.id === popupVenueId) ?? null,
    [filteredVenues, popupVenueId]
  )

  const handleMarkerClick = useCallback(
    (id: string) => {
      setSelectedVenueId(id)
      setPopupVenueId(id)
    },
    [setSelectedVenueId]
  )

  const handleTimeOffsetChange = useCallback(
    async (offset: TimeOffset) => {
      setTimeOffset(offset)
      // In production this would re-fetch sunlight predictions for the new time.
      // For MVP we optimistically keep existing data and let SWR handle refresh.
    },
    [setTimeOffset]
  )

  return (
    <div className="relative w-full h-full">
      {/* Time offset selector — top centre */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
        <TimeSlider value={timeOffset} onChange={handleTimeOffsetChange} />
      </div>

      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={PALMA_CENTER}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        onClick={() => {
          setPopupVenueId(null)
          setSelectedVenueId(null)
        }}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl
          position="bottom-right"
          trackUserLocation
          showUserHeading
        />

        {filteredVenues.map((venue) => (
          <Marker
            key={venue.id}
            longitude={venue.lng}
            latitude={venue.lat}
            anchor="bottom"
            onClick={(e) => {
              // Prevent map click from firing
              e.originalEvent.stopPropagation()
              handleMarkerClick(venue.id)
            }}
          >
            <VenueMarker
              venue={venue}
              isSelected={selectedVenueId === venue.id}
              onClick={() => handleMarkerClick(venue.id)}
            />
          </Marker>
        ))}

        {popupVenue && (
          <Popup
            longitude={popupVenue.lng}
            latitude={popupVenue.lat}
            anchor="bottom"
            offset={52}
            onClose={() => {
              setPopupVenueId(null)
              setSelectedVenueId(null)
            }}
            closeButton
            closeOnClick={false}
            className="!p-0 !rounded-xl !overflow-hidden"
          >
            <MapPopupCard venue={popupVenue} />
          </Popup>
        )}
      </Map>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mini venue card shown inside the map popup
// ---------------------------------------------------------------------------

function MapPopupCard({ venue }: { venue: VenueSummary }) {
  const status = venue.sunlight?.sunlight_status
  const remaining = venue.sunlight?.sun_remaining_minutes

  return (
    <div className="w-56 bg-white rounded-xl overflow-hidden shadow-lg">
      {/* Status header */}
      <div
        className={cn(
          'px-3 py-2 flex items-center justify-between',
          status === 'direct_sun'
            ? 'bg-amber-50'
            : status === 'likely_sun'
              ? 'bg-yellow-50'
              : 'bg-slate-50'
        )}
      >
        <span className={cn('text-xs font-semibold', status ? sunlightStatusColor(status) : 'text-stone-400')}>
          {status ? sunlightStatusLabel(status) : '— Unknown'}
        </span>
        {remaining != null && remaining > 0 && (
          <span className="text-xs text-stone-500 ml-2">
            {formatSunRemaining(remaining)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="font-semibold text-stone-800 text-sm leading-tight truncate">
          {venue.name}
        </p>

        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-stone-400 capitalize">{venue.category}</span>
          {venue.distance_meters != null && (
            <span className="text-xs text-stone-400">
              {formatDistance(venue.distance_meters)}
            </span>
          )}
        </div>

        {/* External links: website + Instagram */}
        {(venue.website || venue.instagram_url) && (
          <div className="flex gap-2 mt-2">
            {venue.website && (
              <a
                href={venue.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg py-1.5 transition-colors"
              >
                🌐 Website
              </a>
            )}
            {venue.instagram_url && (
              <a
                href={venue.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 text-xs font-medium text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 rounded-lg py-1.5 transition-colors"
              >
                📷 Instagram
              </a>
            )}
          </div>
        )}

        <Link
          href={`/venue/${venue.slug}`}
          className="mt-2 block text-center text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg py-1.5 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View Details →
        </Link>
      </div>
    </div>
  )
}
