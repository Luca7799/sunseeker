# Architecture Document

## 1. System Overview

Sunseeker is a three-tier web application with a dedicated Python microservice for computationally intensive solar geometry work, a PostgreSQL/PostGIS database for spatial data, and a Next.js frontend that acts as both the user interface and a thin API aggregation layer.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S BROWSER                                │
│  Next.js 14 React App (SSR + Client Components)                         │
│  Mapbox GL JS map • Venue list • Sun status widgets                      │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼─────────────────────────────────────────┐
│                        NEXT.JS API LAYER                                │
│  /api/venues   /api/sunlight   /api/submissions   /api/favorites        │
│  /api/photos   /api/admin/*                                              │
│                                                                         │
│   ┌──────────────────────┐         ┌──────────────────────────────────┐ │
│   │   Supabase Client    │         │   Solar Service Client           │ │
│   │   (PostGIS queries,  │         │   (httpx, server-side only)      │ │
│   │   Auth, Storage)     │         └──────────────┬───────────────────┘ │
│   └──────────┬───────────┘                        │ HTTP (internal)     │
└──────────────┼────────────────────────────────────┼─────────────────────┘
               │                                    │
┌──────────────▼────────────────┐   ┌───────────────▼────────────────────┐
│        SUPABASE / POSTGRESQL   │   │      PYTHON SOLAR SERVICE          │
│  PostGIS 3.4 on Postgres 16   │   │  FastAPI + pysolar + Shapely       │
│                                │   │  Port 8000                         │
│  Tables:                       │   │                                    │
│  • venues                      │   │  POST /sunlight/compute            │
│  • park_zones                  │◄──│  POST /sunlight/batch              │
│  • building_footprints         │   │  POST /sunlight/windows            │
│  • sunlight_predictions        │   │  GET  /sun-position                │
│  • submissions                 │   │  GET  /sun-path                    │
│  • photos                      │   └────────────────────────────────────┘
│  • favorites                   │                  ▲
│  • users                       │                  │ HTTP (internal)
└────────────────────────────────┘   ┌──────────────┴────────────────────┐
                 ▲                   │     BACKGROUND PRECOMPUTE JOB     │
                 │ asyncpg           │  run-sunlight.py (cron, 30 min)   │
                 └───────────────────│  fetch-buildings.py (weekly)      │
                                     └────────────────────────────────────┘
```

---

## 2. Component Descriptions

### Next.js Web App (`apps/web/`)

**Role:** User interface and API aggregation layer.

The Next.js app serves two distinct roles:

1. **Frontend** — React components rendered server-side (SSR) for initial page load speed, then hydrated for interactive map and filter interactions. Uses Mapbox GL JS for the map, Zustand for client state, and Tailwind CSS for styling.

2. **API layer** — Next.js Route Handlers (`/api/*`) act as a thin proxy and aggregation layer. They handle authentication via Supabase JWTs, permission checks, cache lookups, and fan-out requests to the solar service and database. No solar math happens in this layer.

Key design decision: the Next.js API layer never directly calls pysolar or Shapely. It either reads from the precomputed cache in PostgreSQL or delegates to the solar service. This keeps the Node.js process lean and avoids running Python in the same process.

### Python Solar Service (`services/solar/`)

**Role:** The single source of truth for all sun position and shadow calculations.

Built with FastAPI for low-boilerplate async HTTP handling. The service is stateless — it accepts building data in each request and does not maintain its own database connection for reads (it receives all inputs it needs via the request payload). This makes it trivially horizontally scalable.

Key libraries:
- `pysolar` — NREL SPA solar position algorithm
- `shapely` — Shadow polygon geometry (via GEOS)
- `pyproj` — WGS84 ↔ UTM coordinate projection

The service is intentionally kept as a pure computation service. It does not write to the database, manage state, or authenticate requests — all of those concerns belong to the Next.js layer or the precompute script.

### PostgreSQL/PostGIS Database

**Role:** Persistent storage for all spatial and application data.

Hosted on Supabase (cloud) or via the `postgis/postgis:16-3.4` Docker image locally. PostGIS extensions provide:
- `GEOMETRY` and `GEOGRAPHY` column types
- Spatial indexes (GIST)
- `ST_DWithin` for proximity queries
- `ST_AsGeoJSON`, `ST_GeomFromText` for serialization

Building footprints are stored with two geometry columns:
- `footprint` (EPSG:4326, geography) — for proximity queries using `ST_DWithin(...::geography, ..., radius_metres)` which takes input in metres
- `footprint_utm` (EPSG:32631) — pre-projected for fast shadow casting (avoids per-request projection)

### Background Scripts

**`scripts/ingestion/fetch-buildings.py`** — One-time (and periodic) ingestion of OSM building footprints via the Overpass API. Run manually or on a weekly schedule. Upserts into `building_footprints`.

**`scripts/precompute/run-sunlight.py`** — Scheduled every 30 minutes. Iterates all curated venues and active park zones, calls the solar service for each, and stores predictions in `sunlight_predictions`. Uses async httpx with a semaphore to limit concurrency to 10 simultaneous solar service calls.

---

## 3. Data Flow

### User Opens the App (Map View)

```
Browser
  └─► GET /api/venues?lat=39.57&lon=2.65&radius_m=2000
        └─► Supabase: SELECT venues JOIN sunlight_predictions
                      WHERE is_curated AND valid_until > NOW()
              └─► Return venues + cached sun status (p50 ~20ms)

              If no fresh prediction exists:
              └─► POST solar_service/sunlight/compute (live call)
                    └─► Fetch buildings: ST_DWithin(location, 300m)
                    └─► Compute shadows, confidence
                    └─► Cache result in sunlight_predictions
                    └─► Return to client
```

### User Requests a Venue Detail Page

```
Browser
  └─► GET /api/venues/passeig-del-born
        └─► Supabase:
              SELECT venue + photos + current prediction
              SELECT today_windows from sunlight_predictions WHERE type='windows'
              SELECT upcoming_predictions for +30m, +1h, +2h, +4h
        └─► Return combined response (SSR pre-fetched, then client re-fetches on focus)
```

### Precompute Job (Every 30 Minutes)

```
run-sunlight.py
  └─► asyncpg: SELECT all curated venues + park zones
  └─► For each location (max 10 concurrent):
        └─► asyncpg: ST_DWithin query for buildings within 300m
        └─► asyncpg: UPDATE sunlight_predictions SET is_stale=TRUE
        └─► httpx: POST /sunlight/compute (×5 time offsets, concurrent)
        └─► httpx: POST /sunlight/windows (today's full-day windows)
        └─► asyncpg: UPSERT sunlight_predictions (×6 rows per venue)
```

---

## 4. Database Design Decisions

### PostGIS for Spatial Data

A standard relational database cannot efficiently answer "which buildings are within 300 metres of this point?" PostGIS provides GIST spatial indexes that make this query O(log n) instead of O(n). For ~20,000 Palma buildings, this reduces a proximity query from ~200ms to ~2ms.

### Dual Geometry Columns

Storing building footprints in both WGS84 and UTM Zone 31N avoids per-request coordinate projection. The WGS84 column is used for proximity searches (Supabase/PostGIS `ST_DWithin` on `geography` type accepts metres directly). The UTM column is passed to the solar service for shadow casting, where metric accuracy is required.

### JSONB for Flexible Data

Venue `opening_hours`, `tags`, and prediction `payload` fields use JSONB. This avoids requiring a rigid schema for data that varies by venue type and may evolve. PostgreSQL's JSONB provides full indexing and querying capability when needed.

### Precomputed Prediction Cache

Rather than computing shadows on every API request, predictions are stored in `sunlight_predictions` with a `valid_until` TTL. For a typical user request, the database returns a cached prediction in < 5ms. The precompute job keeps predictions fresh. This approach sacrifices real-time precision for reliability and speed — a reasonable trade-off since solar position changes slowly (< 0.5° per minute) and building shadows shift gradually.

---

## 5. Solar Service Design — Why a Separate Python Microservice?

The solar engine could theoretically run as a serverless function or be compiled to WebAssembly, but Python was chosen for the following reasons:

1. **Ecosystem** — `pysolar`, `shapely`, and `pyproj` are mature, battle-tested Python libraries with no equivalent in the JavaScript ecosystem. Reimplementing the NREL SPA algorithm in TypeScript would be error-prone and unmaintainable.

2. **Performance profile** — Shadow casting is a CPU-bound computation that benefits from NumPy/GEOS vectorisation. Node.js is not well-suited for sustained numeric computation.

3. **Isolation** — Keeping solar math in a separate service means it can be scaled, debugged, and deployed independently. The Next.js app is unaffected if the solar service is temporarily down (it falls back to cached predictions).

4. **Testing** — Pure Python functions are easier to unit-test with precise numerical assertions than JavaScript alternatives would be.

The solar service is kept **stateless** — it receives all building data in the request payload rather than querying the database itself. This simplifies the service, enables horizontal scaling, and keeps the database connection pool entirely in the Next.js layer.

---

## 6. Confidence Model Design Philosophy

The core principle is: **trust over coverage**.

It is better to show fewer, more reliable sun status indicators than to show a sun status for every venue with hidden uncertainty. The confidence label is always displayed to the user, and predictions with label `unknown` are shown with a special "uncertain" UI treatment rather than a binary sun/cloud icon.

This reflects two realities:

1. **OSM building data is incomplete.** In Palma, ~35% of buildings lack height or level tags. A venue surrounded by these buildings has genuine height uncertainty in its shadow calculation.

2. **Thin shadow edges are genuinely uncertain.** A venue 1 metre from a shadow boundary could flip from sunny to shaded with a 0.2° error in sun azimuth or a 0.5 m error in building height. The confidence model correctly assigns low confidence to this case.

The four-level label system (high/medium/low/unknown) was chosen over a numeric display because users should not need to interpret a `0.72` score — "medium confidence" communicates the right amount of uncertainty for a consumer product.

---

## 7. Caching Strategy

| Layer | Mechanism | TTL |
|---|---|---|
| Prediction cache (DB) | `sunlight_predictions.valid_until` | 45 minutes |
| Next.js response cache | `cache: 'no-store'` for live sun status | None (always fresh from DB) |
| Static venue data (SSR) | Next.js ISR on venue list page | 5 minutes |
| Building footprints | Ingested to DB; no in-memory cache | Re-ingest weekly or on demand |
| Solar service responses | Not cached in the service (stateless) | N/A |

The 45-minute prediction TTL is a deliberate balance:
- Too short: the precompute job struggles to keep all venues fresh; live fallback calls slow down user requests.
- Too long: sun status shown to the user is stale by more than one "solar increment" (sun moves ~7° per 45 min at Palma's latitude).

At solar noon in June (sun altitude ~68°, moving ~12°/hour), a 45-minute old prediction may be off by up to ~9° of azimuth shift. At this altitude, 9° of azimuth shift changes the shadow displacement by `tan(9°) × shadow_length_at_noon ≈ 0.16 × 5m ≈ 0.8m`. This is acceptable for a venue-level (not table-level) sun indicator.

---

## 8. Auth and Trust Model

### User Authentication

Supabase Auth handles user identity via email/password or Google OAuth. Supabase issues JWTs that are verified by both the Next.js API layer and enforced at the database level via Row Level Security (RLS) policies.

RLS policies ensure:
- Users can only read/write their own favorites
- Photo uploads are linked to the uploading user
- Admin-only tables (submissions, photo moderation) are only accessible by users with the `admin` role claim

### Service Role

Scripts and the precompute job use the `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. This key is **never exposed to the browser** and is only used server-side.

### Solar Service Trust

The solar service is exposed only on the internal Docker network (or as a private Railway/Fly service). It does not authenticate requests — it trusts that only the Next.js API layer or precompute script will call it. This is acceptable because the service only computes sun positions; it does not store, read, or modify user data.

---

## 9. Scaling Considerations for Future Cities

The current architecture is designed for a single city (Palma de Mallorca, ~20,000 buildings, ~50 curated venues). Expanding to additional cities requires consideration of:

### Building Data

The `building_footprints` table needs a `city_id` or `country_code` column to partition data by city. Spatial indexes remain effective up to millions of rows. For 100 cities × 20,000 buildings = 2,000,000 rows, a standard GIST index performs well.

### Venue Precomputation Scale

With 100 cities and 50 venues each = 5,000 venues. At 6 predictions per venue per run, that is 30,000 upserts per precompute cycle. With `async` concurrency of 50, this completes in ~2–5 minutes — still within a 30-minute cycle window.

For larger scale (1,000+ cities), the precompute job should be parallelised by city using a job queue (e.g. BullMQ or Celery), with each city's venues processed in an isolated worker.

### Solar Service Scaling

The solar service is stateless and horizontally scalable. Multiple instances can run behind a load balancer. Each instance is CPU-bound during shadow casting; adding vCPUs scales throughput linearly.

A future optimisation: for very popular venues, pre-compute predictions at higher frequency (every 10 minutes) and push them to a Redis cache for sub-millisecond reads. For less popular venues, the 45-minute cache TTL is sufficient.

### Multi-Timezone Support

New cities in different timezones are handled automatically since all internal computation uses UTC. Timezone-aware display is handled by the frontend using the `Intl.DateTimeFormat` API with the city's IANA timezone (stored in the `cities` table in Phase 2).
