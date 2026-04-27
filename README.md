# Sunseeker

## What is Sunseeker

Sunseeker tells you exactly which cafés, restaurants, and public squares in Palma de Mallorca are currently bathed in direct sunlight — so you can step outside and sit in the sun without guessing. It combines precise solar geometry, real building shadow casting, and a curated local venue database to surface the best sun-drenched spots in real time. Think of it as a weather app, but for direct sunlight at street level.

---

## How It Works

1. **Solar geometry** — The sun's altitude and azimuth are calculated for any moment in time using the [pysolar](https://pysolar.readthedocs.io/) library, which implements the NREL SPA algorithm accurate to ±0.01°.
2. **Shadow casting** — Each building footprint (sourced from OpenStreetMap) is extruded to its estimated height, and a shadow polygon is projected onto the ground plane based on the sun vector. A venue is considered "sunny" when its centroid falls outside all shadow polygons.
3. **Confidence model** — Predictions carry a confidence score (0–1) derived from: sun altitude, building data quality, proximity to shadow edges, and time of year. Scores are bucketed into human-readable labels (High, Medium, Low, Unknown).

---

## Architecture Overview

```
  Browser (Next.js 14)
  │
  ├── /api/venues          ──► Supabase DB (venues, sunlight_predictions)
  ├── /api/sunlight        ──► Python Solar Service  ──► DB (cache read)
  └── /api/submissions     ──► Supabase DB (submissions)

  Background precompute job (cron / manual)
  │
  └── run-sunlight.py  ──► Python Solar Service  ──► Supabase DB
                                │
                         building_footprints (PostGIS)
```

Key design decisions:
- The Next.js API layer is a thin proxy/aggregator — it does not implement solar math.
- The Python Solar Service is the single source of truth for all sun/shadow calculations.
- Precomputed predictions (valid for 45 min) are served directly from the DB to keep p99 latency low.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 20+ |
| Python | 3.11+ |
| Docker + Docker Compose | Optional (simplifies DB setup) |
| Supabase account | Free tier sufficient for development |
| Mapbox account | Free tier (50,000 map loads/month) |

---

## Quick Start (Local)

### a. Clone the repository

```bash
git clone https://github.com/your-org/sunseeker.git
cd sunseeker
```

### b. Configure environment variables

```bash
cp .env.example .env.local
# Open .env.local and fill in SUPABASE_URL, SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, and NEXT_PUBLIC_MAPBOX_TOKEN
```

### c. Start the database with Docker Compose

```bash
docker compose up db -d
# This starts PostGIS on localhost:5432 and runs schema + seed SQL automatically.
```

Alternatively, point `DATABASE_URL` at a Supabase cloud project and skip this step.

### d. Run the schema migration

```bash
psql $DATABASE_URL < database/schema.sql
```

### e. Run the seed data

```bash
psql $DATABASE_URL < database/seed.sql
```

### f. Install Python dependencies for the solar service

```bash
cd services/solar
pip install -r requirements.txt
```

### g. Start the solar service

```bash
uvicorn main:app --reload --port 8000
# API will be available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### h. Install Next.js dependencies

```bash
cd apps/web
npm install
```

### i. Start the Next.js development server

```bash
npm run dev
# App available at http://localhost:3000
```

### j. Fetch building footprints from OSM (one-time ingestion)

```bash
python scripts/ingestion/fetch-buildings.py --db-url $DATABASE_URL
# Fetches ~15,000–25,000 building polygons for Palma de Mallorca
# Takes 2–5 minutes depending on Overpass API load
```

### k. Run the sunlight precompute job

```bash
python scripts/precompute/run-sunlight.py \
  --db-url $DATABASE_URL \
  --solar-url http://localhost:8000
# Computes predictions for all curated venues and park zones
# Schedule this to run every 30–45 minutes in production
```

---

## Quick Start (Docker)

The entire stack can be started with a single command:

```bash
cp .env.example .env.local   # fill in Supabase + Mapbox keys
docker compose up
```

This starts:
- **PostgreSQL/PostGIS** on port 5432 (schema and seed applied automatically)
- **Python Solar Service** on port 8000
- **Next.js web app** on port 3000

Then run the ingestion script once from your host machine:

```bash
python scripts/ingestion/fetch-buildings.py --db-url postgresql://postgres:postgres@localhost:5432/sunseeker
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Supabase service role key — server-side only, never expose to browser |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox public token for map rendering |
| `SOLAR_SERVICE_URL` | Yes (server) | Internal URL of the Python solar microservice |
| `DATABASE_URL` | Scripts only | PostgreSQL connection string for ingestion and migration scripts |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID for user authentication |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of the app (used for OAuth redirects) |

---

## Deployment

### Web App — Vercel

```bash
npm install -g vercel
vercel deploy
```

Set all `NEXT_PUBLIC_*` and server-side environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Solar Microservice — Railway

1. Push `services/solar/` to a new GitHub repo (or use a Railway monorepo config).
2. Create a new Railway project and connect the repo.
3. Set `DATABASE_URL` and `ALLOWED_ORIGINS` in Railway environment variables.
4. Railway will auto-detect the `Dockerfile` or `requirements.txt` and deploy.

Alternatively, deploy to **Fly.io**:

```bash
cd services/solar
fly launch
fly deploy
```

### Database — Supabase Cloud

1. Create a new project at [supabase.com](https://supabase.com).
2. Run the schema: open the Supabase SQL editor, paste `database/schema.sql`, and execute.
3. Run the seed: paste and execute `database/seed.sql`.
4. Enable PostGIS: it is enabled by default on all Supabase projects.
5. Copy the project URL and keys into your environment variables.

---

## API Documentation

See [docs/api.md](docs/api.md) for full request/response documentation.

### Key endpoints (Next.js layer)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/venues` | List venues with optional filters and live sun status |
| `GET` | `/api/venues/[id]` | Single venue with current sun prediction |
| `GET` | `/api/sunlight` | Compute or retrieve sunlight for a coordinate |
| `POST` | `/api/sunlight/batch` | Batch sunlight for multiple coordinates |
| `POST` | `/api/submissions` | Submit a new venue for review |
| `GET/POST/DELETE` | `/api/favorites` | Manage user's saved venues |
| `POST` | `/api/photos/upload` | Upload a venue photo |

### Solar service endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/sunlight/compute` | Compute sunlight for one location + time |
| `POST` | `/sunlight/batch` | Batch compute for multiple locations |
| `POST` | `/sunlight/windows` | Compute sunny windows for a full day |
| `GET` | `/sun-position` | Get sun altitude + azimuth for a location + time |
| `GET` | `/sun-path` | Get hourly sun path for a location + date |

---

## Data Model

| Table | Description |
|---|---|
| `venues` | Curated places (cafés, restaurants, squares, parks) with location and metadata |
| `park_zones` | Named outdoor zones within parks (polygons, not just centroids) |
| `building_footprints` | OSM building polygons with estimated heights, PostGIS-indexed |
| `sunlight_predictions` | Precomputed sun/shadow results per venue per time interval |
| `submissions` | User-submitted venue suggestions awaiting admin review |
| `photos` | User-uploaded venue photos with moderation status |
| `favorites` | User–venue bookmarks |
| `users` | Optional user accounts (Supabase Auth) |

---

## Sunlight Engine

Sunlight computation happens in three stages:

1. **Sun position** — Given a latitude, longitude, and UTC datetime, pysolar computes the sun's altitude angle (degrees above horizon) and azimuth (compass bearing). If the altitude is ≤ 0°, it is night — the venue is unambiguously dark.

2. **Shadow projection** — For each nearby building (within 300 m), a shadow polygon is computed by extruding the footprint vertices along the shadow direction vector. The shadow length factor is `height / tan(altitude_radians)`. All geometry is performed in UTM Zone 31N (metric CRS) for accurate metre-level distances.

3. **Sunlight test** — The venue's centroid is tested against the union of all shadow polygons using a fast point-in-polygon check. A confidence score is computed based on: sun altitude, data quality flags on the surrounding buildings, and the venue's distance from the nearest shadow edge.

See [docs/sunlight-engine.md](docs/sunlight-engine.md) for a full technical deep-dive.

---

## Confidence Model

| Label | Score Range | Meaning |
|---|---|---|
| **High** | 0.80 – 1.00 | Sun well above horizon, good building data, venue clearly in or out of shadow |
| **Medium** | 0.50 – 0.79 | Moderate sun altitude or some building heights estimated from levels |
| **Low** | 0.25 – 0.49 | Sun near horizon (golden hour), many buildings with default height estimates |
| **Unknown** | 0.00 – 0.24 | Sun below 5°, overcast proxy trigger, or insufficient building data |

---

## Known Limitations

- **Terrain not modelled** — Hills and valleys are ignored. In flat Palma city centre this has negligible effect, but hillside venues may be inaccurate.
- **Real-time cloud cover not integrated** — The engine assumes clear sky. Cloud cover data is shown as a contextual warning but does not affect the shadow calculation.
- **Centroid-based, not table-level** — A venue's sun status refers to its geographic centroid (typically the main entrance). A large terrace may have both sunny and shaded areas simultaneously.
- **OSM building heights incomplete** — Approximately 60–70% of Palma buildings lack an explicit `height` or `building:levels` tag. Default height estimates (8 m) are used, which may under- or over-state shadow length for taller or lower structures.
- **Footprint accuracy** — OSM building outlines are generally accurate but may be several metres off for older or unmapped structures.

---

## Roadmap

### Phase 1 — Current MVP (Palma de Mallorca)
- Curated venue database (10–50 venues)
- Real-time sun status on map and list views
- Hourly sun windows for the current day
- Building footprint ingestion from OSM
- User submissions and photo uploads

### Phase 2 — Expanded Coverage
- Additional Balearic Islands and Spanish cities (Barcelona, Seville, Valencia)
- Improved building height data via cadastral datasets
- Better confidence model incorporating actual cloud cover (Open-Meteo API)
- Push notifications for "your saved venue is now sunny"

### Phase 3 — Native App and Table-Level Shading
- iOS + Android apps (React Native)
- Table-level precision using venue floor plans and fisheye photo calibration
- Community corrections and height override submissions
- Social features: check-ins, photos, sun-spotting streaks

---

## Contributing

Community contributions are welcome in two forms:

**Venue submissions** — Use the in-app submission form to suggest a new café, restaurant, or square. Submissions are reviewed by the Sunseeker team before becoming visible.

**Data corrections** — If you notice a venue's sun status is consistently wrong (e.g. a building has been demolished or a new one built), use the "Report an issue" link on the venue card. Include a photo if possible. Accepted corrections update both the building data and the confidence model.

For code contributions, please open an issue first to discuss the change, then submit a pull request with a clear description and passing tests.
