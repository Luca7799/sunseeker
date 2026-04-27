'use client'

import { cn, formatSunRemaining, formatTime, sunlightStatusLabel, confidenceLabelText } from '@/lib/utils'
import type { SunlightPrediction } from '@/types'

interface SunlightStatusProps {
  sunlight: SunlightPrediction | null | undefined
  compact?: boolean
}

// ---------------------------------------------------------------------------
// Header background based on status
// ---------------------------------------------------------------------------
function headerBg(status: string | undefined): string {
  switch (status) {
    case 'direct_sun':
      return 'bg-gradient-to-r from-amber-400 to-amber-300'
    case 'likely_sun':
      return 'bg-yellow-50'
    case 'likely_shade':
    case 'shade':
      return 'bg-slate-50'
    case 'night':
      return 'bg-indigo-50'
    case 'unknown':
    default:
      return 'bg-stone-50'
  }
}

function headerText(status: string | undefined): string {
  switch (status) {
    case 'direct_sun':
      return 'text-white'
    case 'likely_sun':
      return 'text-yellow-700'
    case 'likely_shade':
    case 'shade':
      return 'text-slate-600'
    case 'night':
      return 'text-indigo-500'
    default:
      return 'text-stone-500'
  }
}

// ---------------------------------------------------------------------------
// Confidence chip
// ---------------------------------------------------------------------------
function ConfidenceChip({ label }: { label: string }) {
  const styles: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-700',
    high: 'bg-emerald-50 text-emerald-700',
    medium: 'bg-yellow-50 text-yellow-700',
    low: 'bg-stone-100 text-stone-500',
    unknown: 'bg-stone-50 text-stone-400',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', styles[label] ?? styles.unknown)}>
      {label === 'confirmed' ? '✓ Confirmed' : confidenceLabelText(label as Parameters<typeof confidenceLabelText>[0])}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Compact variant
// ---------------------------------------------------------------------------
function CompactView({ sunlight }: { sunlight: SunlightPrediction }) {
  const status = sunlight.sunlight_status
  const remaining = sunlight.sun_remaining_minutes

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={cn(
          'text-xs font-semibold px-2 py-1 rounded-full',
          headerBg(status),
          headerText(status),
          status === 'direct_sun' ? '' : 'border border-stone-100'
        )}
      >
        {sunlightStatusLabel(status)}
      </span>
      {remaining != null && remaining > 0 && (
        <span className="text-xs text-stone-500">{formatSunRemaining(remaining)}</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Full variant
// ---------------------------------------------------------------------------
function FullView({ sunlight }: { sunlight: SunlightPrediction }) {
  const status = sunlight.sunlight_status
  const remaining = sunlight.sun_remaining_minutes
  const confidence = sunlight.confidence_label

  const isNight = status === 'night'
  const isUnknown = status === 'unknown'

  return (
    <div className="rounded-2xl overflow-hidden border border-stone-100 shadow-sm">
      {/* Status header */}
      <div className={cn('px-4 py-3 flex items-center justify-between', headerBg(status))}>
        <span className={cn('text-base font-bold', headerText(status))}>
          {sunlightStatusLabel(status)}
        </span>
        {confidence && <ConfidenceChip label={confidence} />}
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-4 space-y-3">
        {/* Night state */}
        {isNight && (
          <div className="text-sm text-indigo-400 space-y-1">
            {sunlight.next_sunny_window_start && (
              <p>
                🌅 Next sun from{' '}
                <span className="font-medium">{formatTime(sunlight.next_sunny_window_start)}</span>
                {sunlight.next_sunny_window_end && (
                  <> – <span className="font-medium">{formatTime(sunlight.next_sunny_window_end)}</span></>
                )}
              </p>
            )}
          </div>
        )}

        {/* Unknown state */}
        {isUnknown && (
          <p className="text-sm text-stone-400">
            Not enough data to estimate sunlight reliably at this location.
          </p>
        )}

        {/* Normal states */}
        {!isNight && !isUnknown && (
          <>
            {/* Sun remaining */}
            {remaining != null && remaining > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400">☀</span>
                <span className="text-sm font-medium text-stone-700">
                  Sun remaining:{' '}
                  <span className="text-amber-600">{formatSunRemaining(remaining)}</span>
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-stone-100" />

            {/* Best window */}
            {sunlight.best_window_start && sunlight.best_window_end && (
              <div className="flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">☀</span>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Best window today</p>
                  <p className="text-sm font-medium text-stone-700">
                    {formatTime(sunlight.best_window_start)} –{' '}
                    {formatTime(sunlight.best_window_end)}
                    {sunlight.best_window_duration_minutes != null && (
                      <span className="text-stone-400 font-normal ml-1.5">
                        ({formatSunRemaining(sunlight.best_window_duration_minutes)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Next sunny window */}
            {sunlight.next_sunny_window_start && sunlight.sunlight_status !== 'direct_sun' && (
              <div className="flex items-start gap-2">
                <span className="text-stone-300 mt-0.5">☀</span>
                <div>
                  <p className="text-xs text-stone-400 mb-0.5">Next sun</p>
                  <p className="text-sm text-stone-600">
                    {formatTime(sunlight.next_sunny_window_start)}
                    {sunlight.next_sunny_window_end && (
                      <> – {formatTime(sunlight.next_sunny_window_end)}</>
                    )}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer: confidence + factors */}
        <div className="pt-1 border-t border-stone-50 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-400">Confidence:</span>
            {confidence && <ConfidenceChip label={confidence} />}
          </div>

          {sunlight.buildings_checked > 0 && (
            <p className="text-xs text-stone-400">
              Based on {sunlight.buildings_checked} building{sunlight.buildings_checked !== 1 ? 's' : ''} checked
              {confidence === 'confirmed' ? ' + confirmed outdoor seating' : ''}
            </p>
          )}

          {sunlight.is_stale && (
            <p className="text-xs text-amber-500">⚠ Prediction may be outdated</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

export function SunlightStatus({ sunlight, compact = false }: SunlightStatusProps) {
  if (!sunlight) {
    if (compact) {
      return (
        <span className="text-xs text-stone-400 px-2 py-1 bg-stone-50 rounded-full">
          — No data
        </span>
      )
    }
    return (
      <div className="rounded-2xl border border-stone-100 bg-stone-50 px-4 py-6 text-center">
        <p className="text-stone-400 text-sm">Sunlight data unavailable</p>
      </div>
    )
  }

  if (compact) {
    return <CompactView sunlight={sunlight} />
  }

  return <FullView sunlight={sunlight} />
}
