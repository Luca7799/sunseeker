import { create } from 'zustand'
import type { VenueFilters, SortOption, TimeOffset, VenueCategory, ConfidenceLabel } from '@/types'

interface FiltersState {
  filters: VenueFilters
  sort: SortOption
  timeOffset: TimeOffset
  selectedVenueId: string | null

  setFilter: <K extends keyof VenueFilters>(key: K, value: VenueFilters[K]) => void
  toggleCategory: (category: VenueCategory) => void
  setSort: (sort: SortOption) => void
  setTimeOffset: (offset: TimeOffset) => void
  setSelectedVenueId: (id: string | null) => void
  clearFilters: () => void
  activeFilterCount: () => number
}

const DEFAULT_FILTERS: VenueFilters = {
  sunnyNow: false,
  sunnyIn30: false,
  outdoorSeating: false,
  openNow: false,
  categories: [],
  confirmedOutdoorOnly: false,
  minConfidence: null,
}

export const useFiltersStore = create<FiltersState>((set, get) => ({
  filters: { ...DEFAULT_FILTERS },
  sort: 'closest_sunny',
  timeOffset: 'now',
  selectedVenueId: null,

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  toggleCategory: (category) =>
    set((state) => {
      const cats = state.filters.categories
      const next = cats.includes(category)
        ? cats.filter((c) => c !== category)
        : [...cats, category]
      return { filters: { ...state.filters, categories: next } }
    }),

  setSort: (sort) => set({ sort }),

  setTimeOffset: (offset) => set({ timeOffset: offset }),

  setSelectedVenueId: (id) => set({ selectedVenueId: id }),

  clearFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  activeFilterCount: () => {
    const { filters } = get()
    let count = 0
    if (filters.sunnyNow) count++
    if (filters.sunnyIn30) count++
    if (filters.outdoorSeating) count++
    if (filters.openNow) count++
    if (filters.categories.length > 0) count++
    if (filters.confirmedOutdoorOnly) count++
    if (filters.minConfidence) count++
    return count
  },
}))
