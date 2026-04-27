'use client'

import { categoryIcon, sunlightStatusColor } from '@/lib/utils'
import type { VenueSummary, SunlightStatus } from '@/types'

interface VenueMarkerProps {
  venue: VenueSummary
  isSelected: boolean
  onClick: () => void
}

function getMarkerColor(status: SunlightStatus | undefined): string {
  switch (status) {
    case 'direct_sun':
      return '#F59E0B'
    case 'likely_sun':
      return '#FCD34D'
    case 'likely_shade':
    case 'shade':
      return '#94A3B8'
    case 'night':
      return '#475569'
    case 'unknown':
    default:
      return '#A8A29E'
  }
}

function getBorderColor(status: SunlightStatus | undefined): string {
  switch (status) {
    case 'direct_sun':
      return '#D97706'
    case 'likely_sun':
      return '#F59E0B'
    case 'likely_shade':
    case 'shade':
      return '#64748B'
    case 'night':
      return '#334155'
    case 'unknown':
    default:
      return '#78716C'
  }
}

export function VenueMarker({ venue, isSelected, onClick }: VenueMarkerProps) {
  const status = venue.sunlight?.sunlight_status
  const color = getMarkerColor(status)
  const borderColor = getBorderColor(status)
  const size = isSelected ? 40 : 32
  const isDirect = status === 'direct_sun'

  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center focus:outline-none group"
      style={{ width: size, height: size + 8 }}
      aria-label={`${venue.name} marker`}
    >
      {/* Pulse ring for direct_sun */}
      {isDirect && (
        <span
          className="absolute rounded-full animate-ping opacity-60"
          style={{
            width: size + 12,
            height: size + 12,
            backgroundColor: color,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateY(-4px)',
          }}
        />
      )}

      {/* Pin circle */}
      <span
        className="relative flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          border: `2.5px solid ${borderColor}`,
          boxShadow: isSelected
            ? `0 4px 16px 0 ${color}99, 0 2px 4px 0 rgba(0,0,0,0.25)`
            : '0 2px 6px 0 rgba(0,0,0,0.18)',
          marginBottom: 8,
        }}
      >
        {/* Category icon */}
        <span style={{ fontSize: isSelected ? 18 : 14, lineHeight: 1 }}>
          {categoryIcon(venue.category)}
        </span>
      </span>

      {/* Pin tail */}
      <span
        className="absolute bottom-0 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `7px solid ${borderColor}`,
        }}
      />
    </button>
  )
}
