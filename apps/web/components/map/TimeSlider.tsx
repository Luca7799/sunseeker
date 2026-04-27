'use client'

import { cn } from '@/lib/utils'
import type { TimeOffset } from '@/types'

interface TimeSliderProps {
  value: TimeOffset
  onChange: (v: TimeOffset) => void
}

interface Option {
  value: TimeOffset
  label: string
}

const OPTIONS: Option[] = [
  { value: 'now', label: 'Now' },
  { value: '+30min', label: '+30m' },
  { value: '+60min', label: '+1h' },
  { value: '+2h', label: '+2h' },
]

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  return (
    <div className="inline-flex items-center gap-0.5 bg-white rounded-full shadow-md px-1 py-1 border border-stone-100">
      {OPTIONS.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 select-none',
              isActive
                ? 'bg-amber-100 text-amber-700 shadow-sm'
                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
            )}
          >
            <span className="text-xs">☀</span>
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
