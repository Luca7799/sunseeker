'use client'

import useSWR from 'swr'
import type { SunlightPrediction, TimeOffset } from '@/types'

const REVALIDATE_SECONDS = 300 // 5 minutes

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

const postFetcher = ([url, body]: [string, unknown]) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

// ---------------------------------------------------------------------------
// Single venue sunlight
// ---------------------------------------------------------------------------

interface UseSunlightResult {
  sunlight: SunlightPrediction | null
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

export function useSunlight(
  venueId: string,
  timeOffset: TimeOffset = 'now',
): UseSunlightResult {
  const key = venueId
    ? `/api/sunlight?venueId=${encodeURIComponent(venueId)}&offset=${encodeURIComponent(timeOffset)}`
    : null

  const { data, error, isLoading, mutate } = useSWR<{ data: SunlightPrediction | null }>(
    key,
    fetcher,
    {
      refreshInterval: REVALIDATE_SECONDS * 1000,
      revalidateOnFocus: false,
    },
  )

  return {
    sunlight: data?.data ?? null,
    isLoading,
    error: error ?? null,
    refetch: () => mutate(),
  }
}

// ---------------------------------------------------------------------------
// Batch sunlight for multiple venues
// ---------------------------------------------------------------------------

interface UseBatchSunlightResult {
  sunlightMap: Record<string, SunlightPrediction>
  isLoading: boolean
  error: Error | null
}

export function useBatchSunlight(
  venueIds: string[],
  timeOffset: TimeOffset = 'now',
): UseBatchSunlightResult {
  const ids = venueIds.filter(Boolean)
  // Use array key so SWR treats [url, body] as the cache key.
  // postFetcher receives the full key tuple.
  const key: [string, { venueIds: string[]; offset: TimeOffset }] | null =
    ids.length > 0
      ? ['/api/sunlight/batch', { venueIds: ids, offset: timeOffset }]
      : null

  const { data, error, isLoading } = useSWR<{ data: Record<string, SunlightPrediction> }>(
    key,
    postFetcher,
    {
      refreshInterval: REVALIDATE_SECONDS * 1000,
      revalidateOnFocus: false,
    },
  )

  return {
    sunlightMap: data?.data ?? {},
    isLoading,
    error: error ?? null,
  }
}
