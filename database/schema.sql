-- ============================================
-- SUNSEEKER DATABASE SCHEMA
-- PostgreSQL + PostGIS (Supabase-compatible)
-- Location: Palma de Mallorca
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for text search

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE venue_category AS ENUM ('cafe', 'bar', 'restaurant', 'rooftop', 'terrace', 'park', 'bench', 'viewpoint');
CREATE TYPE outdoor_seating_status AS ENUM ('confirmed', 'inferred', 'none', 'unknown');
CREATE TYPE sunlight_status AS ENUM ('direct_sun', 'likely_sun', 'likely_shade', 'shade', 'unknown', 'night');
CREATE TYPE confidence_label AS ENUM ('confirmed', 'high', 'medium', 'low', 'unknown');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected', 'needs_review');
CREATE TYPE submission_type AS ENUM ('venue_add', 'correction', 'photo', 'outdoor_seating', 'terrace_geometry', 'opening_hours');
CREATE TYPE moderation_action AS ENUM ('approve', 'reject', 'request_changes');

-- ============================================
-- TABLES
-- ============================================

-- venues table
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  category venue_category NOT NULL,
  subcategories TEXT[], -- e.g. ['terrace', 'rooftop']
  description TEXT,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Palma de Mallorca',
  country_code CHAR(2) DEFAULT 'ES',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  -- PostGIS geometry: representative point (centroid or manually set)
  location GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  -- Optional polygon for outdoor terrace geometry
  terrace_geometry GEOMETRY(Polygon, 4326),
  outdoor_seating outdoor_seating_status NOT NULL DEFAULT 'unknown',
  outdoor_seating_notes TEXT, -- e.g. "Street-level terrace on north side"
  has_rooftop BOOLEAN DEFAULT FALSE,
  rooftop_level INTEGER, -- floor number
  is_curated BOOLEAN DEFAULT FALSE,
  data_source TEXT DEFAULT 'manual', -- 'manual', 'osm', 'user_submission'
  osm_id TEXT, -- OSM node/way ID if sourced from OSM
  opening_hours JSONB, -- structured opening hours per day
  opening_hours_raw TEXT, -- OSM-format opening hours string
  phone TEXT,
  website TEXT,
  google_place_id TEXT,
  rating NUMERIC(3,2), -- 0.00-5.00
  rating_count INTEGER DEFAULT 0,
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 4),
  -- Confidence metadata for sunlight computation
  building_data_quality TEXT DEFAULT 'unknown', -- 'with_height', 'no_height', 'none', 'unknown'
  terrain_notes TEXT,
  -- Administrative
  is_active BOOLEAN DEFAULT TRUE,
  is_approved BOOLEAN DEFAULT TRUE, -- FALSE for user-submitted pending review
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX venues_location_idx ON venues USING GIST(location);
CREATE INDEX venues_category_idx ON venues(category);
CREATE INDEX venues_is_active_idx ON venues(is_active, is_approved);
CREATE INDEX venues_name_trgm_idx ON venues USING GIN(name gin_trgm_ops);
CREATE INDEX venues_slug_idx ON venues(slug);

-- park_zones table (sub-areas within parks: benches, viewpoints, lawn zones)
CREATE TABLE park_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  name TEXT,
  zone_type TEXT NOT NULL, -- 'bench', 'viewpoint', 'lawn', 'plaza', 'zone'
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)) STORED,
  zone_geometry GEOMETRY(Polygon, 4326), -- optional polygon
  description TEXT,
  is_curated BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX park_zones_location_idx ON park_zones USING GIST(location);
CREATE INDEX park_zones_parent_idx ON park_zones(parent_venue_id);

-- building_footprints table (OSM data, used for shadow casting)
CREATE TABLE building_footprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  osm_id TEXT UNIQUE,
  osm_type TEXT, -- 'way', 'relation'
  footprint GEOMETRY(Polygon, 4326) NOT NULL,
  footprint_utm GEOMETRY(Polygon, 32631), -- precomputed UTM projection (Mallorca: Zone 31N)
  height_meters NUMERIC, -- from OSM height tag or building:height
  levels INTEGER, -- from building:levels, used when height unknown
  estimated_height_meters NUMERIC, -- computed: levels * 3.0 or default 8m
  data_quality TEXT DEFAULT 'no_height', -- 'with_height', 'no_height'
  city TEXT DEFAULT 'Palma de Mallorca',
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX building_footprints_geom_idx ON building_footprints USING GIST(footprint);
CREATE INDEX building_footprints_utm_idx ON building_footprints USING GIST(footprint_utm);
CREATE INDEX building_footprints_osm_id_idx ON building_footprints(osm_id);

-- sunlight_predictions table (precomputed cache)
CREATE TABLE sunlight_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES park_zones(id) ON DELETE CASCADE,
  -- exactly one of venue_id or zone_id must be set
  CONSTRAINT chk_one_subject CHECK (
    (venue_id IS NOT NULL AND zone_id IS NULL) OR
    (venue_id IS NULL AND zone_id IS NOT NULL)
  ),
  prediction_time TIMESTAMPTZ NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Solar position
  sun_altitude_deg NUMERIC,
  sun_azimuth_deg NUMERIC,
  -- Result
  sunlight_status sunlight_status NOT NULL DEFAULT 'unknown',
  confidence_label confidence_label NOT NULL DEFAULT 'unknown',
  confidence_score NUMERIC(4,3), -- 0.000-1.000
  -- Time-based outputs
  sun_remaining_minutes INTEGER, -- how many more minutes of direct sun from this timestamp
  next_sunny_window_start TIMESTAMPTZ,
  next_sunny_window_end TIMESTAMPTZ,
  best_window_start TIMESTAMPTZ, -- longest sunny window today
  best_window_end TIMESTAMPTZ,
  best_window_duration_minutes INTEGER,
  -- Diagnostic metadata
  buildings_checked INTEGER DEFAULT 0,
  obstruction_building_id TEXT, -- OSM ID of building causing shadow
  confidence_factors JSONB, -- breakdown of confidence scoring
  is_stale BOOLEAN DEFAULT FALSE,
  valid_until TIMESTAMPTZ -- precomputed results valid until this time
);

CREATE INDEX sunlight_pred_venue_time_idx ON sunlight_predictions(venue_id, prediction_time);
CREATE INDEX sunlight_pred_zone_time_idx ON sunlight_predictions(zone_id, prediction_time);
CREATE INDEX sunlight_pred_time_idx ON sunlight_predictions(prediction_time);
CREATE INDEX sunlight_pred_stale_idx ON sunlight_predictions(is_stale, valid_until);

-- Partial unique index: one prediction per venue per timestamp
CREATE UNIQUE INDEX sunlight_pred_venue_unique ON sunlight_predictions(venue_id, prediction_time) WHERE venue_id IS NOT NULL;
CREATE UNIQUE INDEX sunlight_pred_zone_unique ON sunlight_predictions(zone_id, prediction_time) WHERE zone_id IS NOT NULL;

-- user_profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  trust_score INTEGER DEFAULT 0, -- 0-100, higher = more trusted
  submission_count INTEGER DEFAULT 0,
  approved_submission_count INTEGER DEFAULT 0,
  rejected_submission_count INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  is_moderator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_submissions
CREATE TABLE user_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  submission_type submission_type NOT NULL,
  status submission_status DEFAULT 'pending',
  -- What venue this refers to (null if new venue addition)
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  zone_id UUID REFERENCES park_zones(id) ON DELETE SET NULL,
  -- Submission data (flexible JSONB)
  data JSONB NOT NULL, -- the actual submitted content
  -- For corrections: what field is being corrected
  correction_field TEXT, -- e.g. 'outdoor_seating', 'opening_hours', 'category'
  correction_old_value TEXT,
  correction_new_value TEXT,
  -- Notes
  user_note TEXT,
  -- Moderation
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  moderation_action moderation_action,
  -- Auto-trust logic: if user trust_score >= 80, auto-approve certain types
  was_auto_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX submissions_status_idx ON user_submissions(status);
CREATE INDEX submissions_venue_idx ON user_submissions(venue_id);
CREATE INDEX submissions_user_idx ON user_submissions(user_id);
CREATE INDEX submissions_type_idx ON user_submissions(submission_type);
CREATE INDEX submissions_created_idx ON user_submissions(created_at DESC);

-- favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES park_zones(id) ON DELETE CASCADE,
  CONSTRAINT chk_fav_one_target CHECK (
    (venue_id IS NOT NULL AND zone_id IS NULL) OR
    (venue_id IS NULL AND zone_id IS NOT NULL)
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, venue_id),
  UNIQUE(user_id, zone_id)
);

CREATE INDEX favorites_user_idx ON favorites(user_id);
CREATE INDEX favorites_venue_idx ON favorites(venue_id);

-- photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES park_zones(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL, -- Supabase storage path
  url TEXT NOT NULL, -- public URL
  thumbnail_url TEXT,
  caption TEXT,
  -- Photo metadata
  taken_at TIMESTAMPTZ, -- when photo was taken
  shows_terrace BOOLEAN DEFAULT FALSE,
  shows_sun BOOLEAN DEFAULT FALSE,
  -- Moderation
  status submission_status DEFAULT 'pending',
  is_featured BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX photos_venue_idx ON photos(venue_id);
CREATE INDEX photos_status_idx ON photos(status);
CREATE INDEX photos_featured_idx ON photos(venue_id, is_featured, status);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update updated_at automatically
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_venues BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_park_zones BEFORE UPDATE ON park_zones
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_user_profiles BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_submissions BEFORE UPDATE ON user_submissions
  FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- Auto-create user_profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Venues near a point (used by API)
CREATE OR REPLACE FUNCTION venues_near(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters INTEGER DEFAULT 2000
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  category venue_category,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  distance_meters DOUBLE PRECISION,
  outdoor_seating outdoor_seating_status,
  is_curated BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    v.category,
    v.lat,
    v.lng,
    ST_Distance(
      v.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_meters,
    v.outdoor_seating,
    v.is_curated
  FROM venues v
  WHERE
    v.is_active = TRUE
    AND v.is_approved = TRUE
    AND ST_DWithin(
      v.location::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY distance_meters;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get buildings near a point (for shadow calculation)
CREATE OR REPLACE FUNCTION buildings_near_point(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  osm_id TEXT,
  height_meters NUMERIC,
  estimated_height_meters NUMERIC,
  data_quality TEXT,
  footprint_geojson TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.osm_id,
    b.height_meters,
    b.estimated_height_meters,
    b.data_quality,
    ST_AsGeoJSON(b.footprint)::TEXT AS footprint_geojson
  FROM building_footprints b
  WHERE ST_DWithin(
    b.footprint::geography,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_radius_meters
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Mark old predictions as stale
CREATE OR REPLACE FUNCTION mark_stale_predictions()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  UPDATE sunlight_predictions
  SET is_stale = TRUE
  WHERE valid_until < NOW()
    AND is_stale = FALSE;
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (Supabase)
-- ============================================

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE park_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_footprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE sunlight_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Venues: public read, admin write
CREATE POLICY "venues_public_read" ON venues FOR SELECT USING (is_active = TRUE AND is_approved = TRUE);
CREATE POLICY "venues_admin_all" ON venues FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_moderator = TRUE))
);

-- Park zones: public read
CREATE POLICY "park_zones_public_read" ON park_zones FOR SELECT USING (is_active = TRUE);
CREATE POLICY "park_zones_admin_all" ON park_zones FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_moderator = TRUE))
);

-- Buildings: public read (needed for shadow calc debug), admin write
CREATE POLICY "buildings_public_read" ON building_footprints FOR SELECT USING (TRUE);
CREATE POLICY "buildings_service_write" ON building_footprints FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Sunlight predictions: public read
CREATE POLICY "sunlight_public_read" ON sunlight_predictions FOR SELECT USING (TRUE);
CREATE POLICY "sunlight_service_write" ON sunlight_predictions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- User profiles: users see own, admins see all
CREATE POLICY "profiles_own_read" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_all" ON user_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Submissions: users see own, admins see all
CREATE POLICY "submissions_own_read" ON user_submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "submissions_own_insert" ON user_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "submissions_admin_all" ON user_submissions FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_moderator = TRUE))
);

-- Favorites: own only
CREATE POLICY "favorites_own_all" ON favorites FOR ALL USING (auth.uid() = user_id);

-- Photos: public read approved, own read pending
CREATE POLICY "photos_public_approved" ON photos FOR SELECT USING (status = 'approved');
CREATE POLICY "photos_own_pending" ON photos FOR SELECT USING (auth.uid() = uploaded_by);
CREATE POLICY "photos_own_insert" ON photos FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "photos_admin_all" ON photos FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = TRUE OR is_moderator = TRUE))
);
