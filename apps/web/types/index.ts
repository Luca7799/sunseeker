// ---------------------------------------------------------------------------
// Enums matching database
// ---------------------------------------------------------------------------

export type VenueCategory =
  | 'cafe'
  | 'bar'
  | 'restaurant'
  | 'rooftop'
  | 'terrace'
  | 'park'
  | 'bench'
  | 'viewpoint'

export type OutdoorSeatStatus = 'confirmed' | 'inferred' | 'none' | 'unknown'

export type SunlightStatus =
  | 'direct_sun'
  | 'likely_sun'
  | 'likely_shade'
  | 'shade'
  | 'unknown'
  | 'night'

export type ConfidenceLabel = 'confirmed' | 'high' | 'medium' | 'low' | 'unknown'

export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs_review'

export type SubmissionType =
  | 'venue_add'
  | 'correction'
  | 'photo'
  | 'outdoor_seating'
  | 'terrace_geometry'
  | 'opening_hours'

// ---------------------------------------------------------------------------
// Opening hours: per day
// ---------------------------------------------------------------------------

/** e.g. { open: "08:00", close: "22:00" } */
export interface DayHours {
  open: string
  close: string
}

export type OpeningHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours | null>
>

// ---------------------------------------------------------------------------
// Venue (full, from DB)
// ---------------------------------------------------------------------------

export interface Venue {
  id: string
  name: string
  slug: string
  category: VenueCategory
  subcategories: string[]
  description: string | null
  address: string | null
  city: string
  lat: number
  lng: number
  outdoor_seating: OutdoorSeatStatus
  outdoor_seating_notes: string | null
  has_rooftop: boolean
  rooftop_level: number | null
  is_curated: boolean
  data_source: string
  opening_hours: OpeningHours | null
  opening_hours_raw: string | null
  phone: string | null
  website: string | null
  instagram_url: string | null
  rating: number | null
  rating_count: number
  price_level: number | null
  building_data_quality: string
  is_active: boolean
  created_at: string
  updated_at: string
  // Computed / joined fields
  distance_meters?: number
  sunlight?: SunlightPrediction | null
  photos?: Photo[]
  is_favorited?: boolean
}

// ---------------------------------------------------------------------------
// Venue list item (lighter version for map/list)
// ---------------------------------------------------------------------------

export interface VenueSummary {
  id: string
  name: string
  slug: string
  category: VenueCategory
  lat: number
  lng: number
  outdoor_seating: OutdoorSeatStatus
  is_curated: boolean
  distance_meters?: number
  sunlight?: SunlightPrediction | null
  rating: number | null
  opening_hours: OpeningHours | null
  website: string | null
  instagram_url: string | null
}

// ---------------------------------------------------------------------------
// Park zone
// ---------------------------------------------------------------------------

export interface ParkZone {
  id: string
  parent_venue_id: string | null
  name: string | null
  zone_type: string
  lat: number
  lng: number
  description: string | null
  is_curated: boolean
  sunlight?: SunlightPrediction | null
  distance_meters?: number
}

// ---------------------------------------------------------------------------
// Sunlight prediction (from precomputed cache or real-time)
// ---------------------------------------------------------------------------

export interface SunlightPrediction {
  id?: string
  venue_id?: string | null
  zone_id?: string | null
  prediction_time: string
  computed_at?: string
  sun_altitude_deg: number | null
  sun_azimuth_deg: number | null
  sunlight_status: SunlightStatus
  confidence_label: ConfidenceLabel
  confidence_score: number | null
  sun_remaining_minutes: number | null
  next_sunny_window_start: string | null
  next_sunny_window_end: string | null
  best_window_start: string | null
  best_window_end: string | null
  best_window_duration_minutes: number | null
  buildings_checked: number
  obstruction_building_id: string | null
  confidence_factors: Record<string, number> | null
  is_stale?: boolean
}

// ---------------------------------------------------------------------------
// Filter state for map/list
// ---------------------------------------------------------------------------

export interface VenueFilters {
  sunnyNow: boolean
  sunnyIn30: boolean
  outdoorSeating: boolean
  openNow: boolean
  categories: VenueCategory[]
  confirmedOutdoorOnly: boolean
  minConfidence: ConfidenceLabel | null
}

export type SortOption =
  | 'closest_sunny'
  | 'sunniest_longest'
  | 'best_rated_sunny'
  | 'best_overall'

// ---------------------------------------------------------------------------
// Time offset for predictions
// ---------------------------------------------------------------------------

export type TimeOffset = 'now' | '+30min' | '+60min' | '+2h' | '+4h'

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
  trust_score: number
  submission_count: number
  is_admin: boolean
  is_moderator: boolean
}

// ---------------------------------------------------------------------------
// User submission
// ---------------------------------------------------------------------------

export interface UserSubmission {
  id: string
  user_id: string
  submission_type: SubmissionType
  status: SubmissionStatus
  venue_id: string | null
  zone_id: string | null
  data: Record<string, unknown>
  correction_field: string | null
  correction_old_value: string | null
  correction_new_value: string | null
  user_note: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  // Joined
  venue?: Pick<Venue, 'id' | 'name' | 'category'> | null
  user?: Pick<UserProfile, 'id' | 'display_name' | 'trust_score'> | null
}

// ---------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------

export interface Photo {
  id: string
  venue_id: string | null
  zone_id: string | null
  uploaded_by: string | null
  storage_path: string
  url: string
  thumbnail_url: string | null
  caption: string | null
  taken_at: string | null
  shows_terrace: boolean
  shows_sun: boolean
  status: SubmissionStatus
  is_featured: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// Favorite
// ---------------------------------------------------------------------------

export interface Favorite {
  id: string
  user_id: string
  venue_id: string | null
  zone_id: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  error: string | null
}

// ---------------------------------------------------------------------------
// Solar service types
// ---------------------------------------------------------------------------

export interface SunPosition {
  altitude_deg: number
  azimuth_deg: number
  timestamp: string
}

// ---------------------------------------------------------------------------
// Map state
// ---------------------------------------------------------------------------

export interface MapViewport {
  longitude: number
  latitude: number
  zoom: number
}
