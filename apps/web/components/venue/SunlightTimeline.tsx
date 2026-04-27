'use client'

import { useMemo } from 'react'
import { formatTime } from '@/lib/utils'
import type { SunlightPrediction } from '@/types'

interface SunlightTimelineProps {
  sunlight: SunlightPrediction
  venueId: string
}

// Palma de Mallorca daylight span (approximate summer hours)
const DAYLIGHT_START_HOUR = 7   // 07:00
const DAYLIGHT_END_HOUR = 21    // 21:00
const DAYLIGHT_SPAN_MINUTES = (DAYLIGHT_END_HOUR - DAYLIGHT_START_HOUR) * 60

function minutesSinceMidnight(isoString: string): number {
  try {
    const d = new Date(isoString)
    return d.getHours() * 60 + d.getMinutes()
  } catch {
    return 0
  }
}

function toPercent(minutes: number): number {
  const offset = minutes - DAYLIGHT_START_HOUR * 60
  return Math.max(0, Math.min(100, (offset / DAYLIGHT_SPAN_MINUTES) * 100))
}

interface TimeWindow {
  startPct: number
  endPct: number
  isSunny: boolean
  label?: string
}

function buildWindows(sunlight: SunlightPrediction): TimeWindow[] {
  const windows: TimeWindow[] = []

  const bestStart = sunlight.best_window_start
  const bestEnd = sunlight.best_window_end

  if (!bestStart || !bestEnd) return windows

  const startMins = minutesSinceMidnight(bestStart)
  const endMins = minutesSinceMidnight(bestEnd)

  // Shade before best window
  const dayStartMins = DAYLIGHT_START_HOUR * 60
  if (startMins > dayStartMins) {
    windows.push({
      startPct: 0,
      endPct: toPercent(startMins),
      isSunny: false,
    })
  }

  // Sunny window
  windows.push({
    startPct: toPercent(startMins),
    endPct: toPercent(endMins),
    isSunny: true,
    label: `${formatTime(bestStart)} – ${formatTime(bestEnd)}`,
  })

  // Shade after best window
  const dayEndMins = DAYLIGHT_END_HOUR * 60
  if (endMins < dayEndMins) {
    windows.push({
      startPct: toPercent(endMins),
      endPct: 100,
      isSunny: false,
    })
  }

  return windows
}

// ---------------------------------------------------------------------------
// Time labels along the bottom
// ---------------------------------------------------------------------------

const HOUR_LABELS = [8, 10, 12, 14, 16, 18, 20] as const

function TimeLabels() {
  return (
    <div className="relative h-4 mt-1">
      {HOUR_LABELS.map((hour) => {
        const pct = toPercent(hour * 60)
        return (
          <span
            key={hour}
            className="absolute text-[10px] text-stone-400 -translate-x-1/2"
            style={{ left: `${pct}%` }}
          >
            {hour}:00
          </span>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Current time marker
// ---------------------------------------------------------------------------

function CurrentTimeDot() {
  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const pct = toPercent(currentMins)

  // Don't render if outside daylight span
  if (pct <= 0 || pct >= 100) return null

  return (
    <div
      className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-10"
      style={{ left: `${pct}%` }}
    >
      <div className="w-0.5 h-full bg-red-400 opacity-70" />
      <div className="w-2.5 h-2.5 rounded-full bg-red-500 -mt-1.5 shadow-sm" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SunlightTimeline({ sunlight, venueId: _venueId }: SunlightTimelineProps) {
  const windows = useMemo(() => buildWindows(sunlight), [sunlight])

  const hasBestWindow = sunlight.best_window_start && sunlight.best_window_end

  // Fallback: no window data
  if (!hasBestWindow) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 px-4 py-4">
        <p className="text-xs text-stone-400 mb-1 uppercase tracking-wide font-medium">
          Today's sunlight
        </p>
        <p className="text-sm text-stone-500">No detailed timeline available for today.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-stone-100 px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-stone-400 uppercase tracking-wide font-medium">
          Today's sunlight
        </p>
        {hasBestWindow && (
          <p className="text-xs text-amber-600 font-medium">
            ☀ {formatTime(sunlight.best_window_start!)} – {formatTime(sunlight.best_window_end!)}
          </p>
        )}
      </div>

      {/* Timeline bar */}
      <div className="relative">
        <div className="relative flex h-7 rounded-lg overflow-hidden bg-stone-100">
          {windows.map((w, i) => (
            <div
              key={i}
              className="h-full flex items-center justify-center relative"
              style={{
                width: `${w.endPct - w.startPct}%`,
                backgroundColor: w.isSunny ? '#FCD34D' : '#E2E8F0',
              }}
            >
              {w.isSunny && w.label && (
                <span className="text-[10px] font-semibold text-amber-800 px-1 truncate hidden sm:block">
                  {w.label}
                </span>
              )}
            </div>
          ))}

          {/* Current time overlay */}
          <CurrentTimeDot />
        </div>

        {/* Hour labels */}
        <TimeLabels />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-300" />
          <span className="text-xs text-stone-500">Sun</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-200" />
          <span className="text-xs text-stone-500">Shade</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-stone-500">Now</span>
        </div>
      </div>
    </div>
  )
}
