# API Documentation

This document covers all HTTP endpoints exposed by the Sunseeker system:

- **Next.js API routes** — `/api/*` — served by the web app at `NEXT_PUBLIC_APP_URL`
- **Python Solar Service** — served separately at `SOLAR_SERVICE_URL`

All request/response bodies are JSON. All timestamps are ISO 8601 strings in UTC unless otherwise noted. Authentication uses Supabase JWT tokens passed in the `Authorization: Bearer <token>` header for protected endpoints.

---

## Next.js API Routes

---

## GET /api/venues

Returns a filtered, paginated list of venues with their current sunlight status.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `sunny` | boolean | No | If `true`, return only venues currently in direct sunlight |
| `type` | string | No | Filter by venue type: `cafe`, `restaurant`, `plaza`, `park`, `bar`, `rooftop_bar`, `waterfront`, `market` |
| `lat` | number | No | User latitude for distance sorting (requires `lon`) |
| `lon` | number | No | User longitude for distance sorting (requires `lat`) |
| `radius_m` | number | No | Radius in metres for nearby search. Default: 2000. Max: 10000 |
| `limit` | integer | No | Number of results. Default: 20. Max: 100 |
| `offset` | integer | No | Pagination offset. Default: 0 |
| `sort` | string | No | Sort order: `distance` (default when lat/lon given), `rating`, `name` |

### Response

```json
{
  "venues": [
    {
      "id": "a3b2c1d0-...",
      "slug": "passeig-del-born",
      "name": "Passeig del Born",
      "venue_type": "plaza",
      "description": "Palma's most elegant promenade...",
      "address": "Passeig del Born, 07012 Palma de Mallorca",
      "lat": 39.5693,
      "lon": 2.6503,
      "average_rating": 4.6,
      "price_level": 3,
      "outdoor_seating": true,
      "tags": ["promenade", "terrace", "afternoon-sun"],
      "current_sun": {
        "is_sunny": true,
        "confidence": 0.82,
        "confidence_label": "high",
        "computed_at": "2025-06-21T11:45:00Z",
        "valid_until": "2025-06-21T12:30:00Z"
      },
      "distance_m": 342
    }
  ],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

---

## GET /api/venues/[id]

Returns a single venue by its UUID or slug, including the full current sunlight prediction and today's sunny windows.

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | string | Venue UUID or slug |

### Response

```json
{
  "id": "a3b2c1d0-...",
  "slug": "passeig-del-born",
  "name": "Passeig del Born",
  "venue_type": "plaza",
  "description": "Palma's most elegant promenade...",
  "address": "Passeig del Born, 07012 Palma de Mallorca",
  "lat": 39.5693,
  "lon": 2.6503,
  "google_maps_url": "https://maps.google.com/?q=...",
  "website_url": null,
  "average_rating": 4.6,
  "price_level": 3,
  "outdoor_seating": true,
  "is_curated": true,
  "tags": ["promenade", "terrace", "afternoon-sun", "historic"],
  "opening_hours": {
    "monday": "08:00–22:00"
  },
  "sun_notes": "Terraces on the south-west side receive direct sun from midday until sunset in summer.",
  "photos": [
    {
      "id": "ph-001",
      "url": "https://cdn.sunseeker.app/photos/passeig-del-born-1.jpg",
      "thumbnail_url": "https://cdn.sunseeker.app/photos/thumbs/passeig-del-born-1.jpg",
      "caption": "Sunny afternoon on the Born",
      "taken_at": "2025-05-15T14:30:00Z"
    }
  ],
  "current_sun": {
    "is_sunny": true,
    "confidence": 0.82,
    "confidence_label": "high",
    "sun_altitude_deg": 68.4,
    "sun_azimuth_deg": 223.7,
    "shadow_ratio": 0.0,
    "computed_at": "2025-06-21T11:45:00Z",
    "valid_until": "2025-06-21T12:30:00Z"
  },
  "today_windows": [
    { "from": "09:15", "to": "19:45", "confidence": "high" }
  ],
  "upcoming_predictions": [
    { "target_time": "2025-06-21T12:30:00Z", "is_sunny": true, "confidence_label": "high" },
    { "target_time": "2025-06-21T13:00:00Z", "is_sunny": true, "confidence_label": "high" },
    { "target_time": "2025-06-21T14:00:00Z", "is_sunny": true, "confidence_label": "medium" },
    { "target_time": "2025-06-21T16:00:00Z", "is_sunny": false, "confidence_label": "medium" }
  ]
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 404 | `{ "error": "Venue not found" }` | ID/slug does not exist |

---

## GET /api/sunlight

Compute or retrieve the sunlight status for an arbitrary coordinate. Checks the prediction cache first; falls back to a live solar service call.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude in decimal degrees (WGS84) |
| `lon` | number | Yes | Longitude in decimal degrees (WGS84) |
| `datetime` | string | No | ISO 8601 UTC datetime. Defaults to current time |

### Response

```json
{
  "lat": 39.5706,
  "lon": 2.6509,
  "datetime": "2025-06-21T12:00:00Z",
  "is_sunny": true,
  "confidence": 0.78,
  "confidence_label": "medium",
  "sun_altitude_deg": 68.1,
  "sun_azimuth_deg": 220.3,
  "shadow_ratio": 0.0,
  "edge_distance_m": 18.4,
  "n_buildings_checked": 52,
  "from_cache": false,
  "computed_at": "2025-06-21T11:59:58Z"
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "lat and lon are required" }` | Missing coordinates |
| 400 | `{ "error": "Invalid datetime format" }` | Unparseable datetime string |
| 503 | `{ "error": "Solar service unavailable" }` | Microservice is down |

---

## POST /api/sunlight/batch

Compute sunlight status for multiple coordinates in a single request.

### Request Body

```json
{
  "locations": [
    { "id": "born", "lat": 39.5693, "lon": 2.6503 },
    { "id": "placa-major", "lat": 39.5706, "lon": 2.6509 },
    { "id": "portixol", "lat": 39.5590, "lon": 2.6690 }
  ],
  "datetime": "2025-06-21T12:00:00Z"
}
```

### Parameters

| Field | Type | Required | Description |
|---|---|---|---|
| `locations` | array | Yes | Array of location objects with `id`, `lat`, `lon` |
| `locations[].id` | string | Yes | Client-provided identifier echoed in response |
| `locations[].lat` | number | Yes | Latitude |
| `locations[].lon` | number | Yes | Longitude |
| `datetime` | string | No | Shared datetime for all locations. Defaults to now |

Max 50 locations per batch request.

### Response

```json
{
  "datetime": "2025-06-21T12:00:00Z",
  "results": [
    {
      "id": "born",
      "is_sunny": true,
      "confidence": 0.82,
      "confidence_label": "high",
      "sun_altitude_deg": 68.4,
      "from_cache": true
    },
    {
      "id": "placa-major",
      "is_sunny": true,
      "confidence": 0.79,
      "confidence_label": "medium",
      "sun_altitude_deg": 68.4,
      "from_cache": false
    }
  ],
  "computed_at": "2025-06-21T11:59:59Z"
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "locations array is required" }` | Missing or empty locations |
| 400 | `{ "error": "Maximum 50 locations per batch" }` | Too many locations |

---

## POST /api/submissions

Submit a new venue suggestion for admin review.

### Request Body

```json
{
  "name": "Bar Bosch",
  "venue_type": "bar",
  "address": "Plaça del Rei Joan Carles I, 6, 07012 Palma",
  "lat": 39.5705,
  "lon": 2.6498,
  "description": "Classic Palma bar with a large terrace on the square.",
  "website_url": "https://barbosch.com",
  "outdoor_seating": true,
  "sun_notes": "South-facing terrace, sunny all morning.",
  "submitter_name": "María García",
  "submitter_email": "maria@example.com"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Venue name |
| `venue_type` | string | Yes | One of the supported venue types |
| `address` | string | Yes | Street address |
| `lat` | number | Yes | Latitude |
| `lon` | number | Yes | Longitude |
| `description` | string | No | Short description |
| `website_url` | string | No | Official website |
| `outdoor_seating` | boolean | No | Whether outdoor seating exists |
| `sun_notes` | string | No | Submitter's notes about sun exposure |
| `submitter_name` | string | No | Submitter's display name |
| `submitter_email` | string | No | Submitter's email (for follow-up) |

### Response

```json
{
  "id": "sub-abc123",
  "status": "pending",
  "message": "Thank you! Your submission will be reviewed within 48 hours.",
  "created_at": "2025-06-21T12:05:00Z"
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "name, venue_type, address, lat, lon are required" }` | Missing fields |
| 409 | `{ "error": "A venue at this location already exists" }` | Duplicate submission (within 30 m of existing venue) |

---

## GET /api/favorites

Return the authenticated user's saved venues.

**Authentication required.** Pass `Authorization: Bearer <supabase_jwt>`.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `with_sun` | boolean | No | If `true`, include current sun status for each venue |

### Response

```json
{
  "favorites": [
    {
      "venue_id": "a3b2c1d0-...",
      "slug": "passeig-del-born",
      "name": "Passeig del Born",
      "venue_type": "plaza",
      "lat": 39.5693,
      "lon": 2.6503,
      "saved_at": "2025-05-10T09:00:00Z",
      "current_sun": {
        "is_sunny": true,
        "confidence_label": "high"
      }
    }
  ]
}
```

---

## POST /api/favorites

Add a venue to the authenticated user's favorites.

**Authentication required.**

### Request Body

```json
{ "venue_id": "a3b2c1d0-..." }
```

### Response

```json
{
  "venue_id": "a3b2c1d0-...",
  "saved_at": "2025-06-21T12:10:00Z"
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 401 | `{ "error": "Unauthorized" }` | No valid JWT |
| 404 | `{ "error": "Venue not found" }` | Invalid venue_id |
| 409 | `{ "error": "Already in favorites" }` | Duplicate |

---

## DELETE /api/favorites

Remove a venue from the authenticated user's favorites.

**Authentication required.**

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `venue_id` | string | Yes | UUID of the venue to remove |

### Response

```json
{ "deleted": true }
```

---

## POST /api/photos/upload

Upload a photo for a venue.

**Authentication required.** Multipart form data.

### Form Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `venue_id` | string | Yes | UUID of the venue |
| `photo` | file | Yes | Image file (JPEG or PNG, max 10 MB) |
| `caption` | string | No | Optional caption |

### Response

```json
{
  "id": "ph-xyz789",
  "venue_id": "a3b2c1d0-...",
  "url": "https://cdn.sunseeker.app/photos/ph-xyz789.jpg",
  "thumbnail_url": "https://cdn.sunseeker.app/photos/thumbs/ph-xyz789.jpg",
  "caption": "Sunny terrace on a Wednesday afternoon",
  "status": "pending_moderation",
  "uploaded_at": "2025-06-21T12:15:00Z"
}
```

### Error Responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "error": "Only JPEG and PNG files are accepted" }` | Wrong file type |
| 400 | `{ "error": "File size exceeds 10 MB limit" }` | File too large |
| 404 | `{ "error": "Venue not found" }` | Invalid venue_id |

---

## GET /api/admin/submissions

List all pending venue submissions. **Admin only** (requires service role JWT or admin claim).

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | Filter: `pending`, `approved`, `rejected`. Default: `pending` |
| `limit` | integer | No | Default: 50. Max: 200 |
| `offset` | integer | No | Default: 0 |

### Response

```json
{
  "submissions": [
    {
      "id": "sub-abc123",
      "name": "Bar Bosch",
      "venue_type": "bar",
      "address": "Plaça del Rei Joan Carles I, 6, 07012 Palma",
      "lat": 39.5705,
      "lon": 2.6498,
      "status": "pending",
      "submitter_name": "María García",
      "submitter_email": "maria@example.com",
      "created_at": "2025-06-21T12:05:00Z"
    }
  ],
  "total": 3
}
```

---

## GET /api/admin/photos

List all photos pending moderation. **Admin only.**

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | `pending_moderation`, `approved`, `rejected`. Default: `pending_moderation` |
| `limit` | integer | No | Default: 50 |
| `offset` | integer | No | Default: 0 |

### Response

```json
{
  "photos": [
    {
      "id": "ph-xyz789",
      "venue_id": "a3b2c1d0-...",
      "venue_name": "Passeig del Born",
      "url": "https://cdn.sunseeker.app/photos/ph-xyz789.jpg",
      "thumbnail_url": "https://cdn.sunseeker.app/photos/thumbs/ph-xyz789.jpg",
      "caption": "Sunny terrace",
      "uploaded_by": "user-uid-abc",
      "status": "pending_moderation",
      "uploaded_at": "2025-06-21T12:15:00Z"
    }
  ],
  "total": 7
}
```

---

---

## Python Solar Service Endpoints

Base URL: `SOLAR_SERVICE_URL` (default: `http://localhost:8000`)

Interactive documentation available at `{SOLAR_SERVICE_URL}/docs` (Swagger UI) and `{SOLAR_SERVICE_URL}/redoc`.

---

## POST /sunlight/compute

Compute the sunlight status for a single location at a single point in time, given the surrounding building footprints.

### Request Body

```json
{
  "lat": 39.5706,
  "lon": 2.6509,
  "datetime": "2025-06-21T12:00:00Z",
  "buildings": [
    {
      "osm_id": 123456789,
      "footprint_utm": {
        "type": "Polygon",
        "coordinates": [[[651200.0, 4381500.0], [651230.0, 4381500.0], [651230.0, 4381530.0], [651200.0, 4381530.0], [651200.0, 4381500.0]]]
      },
      "height_meters": 12.5,
      "data_quality": "with_height"
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude (WGS84) |
| `lon` | number | Yes | Longitude (WGS84) |
| `datetime` | string | Yes | ISO 8601 UTC datetime |
| `buildings` | array | Yes | Array of nearby building objects |
| `buildings[].osm_id` | integer | Yes | OSM way ID |
| `buildings[].footprint_utm` | GeoJSON Polygon | Yes | Building footprint in UTM Zone 31N (EPSG:32631) |
| `buildings[].height_meters` | number | Yes | Building height in metres |
| `buildings[].data_quality` | string | Yes | `with_height` or `no_height` |

### Response

```json
{
  "is_sunny": true,
  "confidence": 0.82,
  "confidence_label": "high",
  "sun_altitude_deg": 68.1,
  "sun_azimuth_deg": 220.3,
  "shadow_ratio": 0.0,
  "edge_distance_m": 22.1,
  "n_buildings": 1,
  "n_shadow_polygons": 1,
  "computed_at": "2025-06-21T12:00:01Z"
}
```

| Field | Type | Description |
|---|---|---|
| `is_sunny` | boolean | `true` if the venue centroid is not in any building shadow |
| `confidence` | float [0–1] | Confidence score |
| `confidence_label` | string | `high`, `medium`, `low`, or `unknown` |
| `sun_altitude_deg` | number | Solar altitude above horizon in degrees |
| `sun_azimuth_deg` | number | Solar azimuth (degrees clockwise from north) |
| `shadow_ratio` | float [0–1] | Fraction of the venue area covered by shadows (0 if centroid-only mode) |
| `edge_distance_m` | number | Distance from venue centroid to nearest shadow edge, in metres |
| `n_buildings` | integer | Number of buildings processed |
| `n_shadow_polygons` | integer | Number of non-zero shadow polygons computed |
| `computed_at` | string | UTC timestamp of when this computation ran |

### Error Responses

| Status | Body | When |
|---|---|---|
| 400 | `{ "detail": "datetime must be timezone-aware" }` | Naive datetime string |
| 422 | Pydantic validation error | Malformed request body |

---

## POST /sunlight/batch

Compute sunlight for multiple locations at a single point in time. Each location carries its own building list.

### Request Body

```json
{
  "datetime": "2025-06-21T12:00:00Z",
  "locations": [
    {
      "id": "born",
      "lat": 39.5693,
      "lon": 2.6503,
      "buildings": [ ... ]
    },
    {
      "id": "placa-major",
      "lat": 39.5706,
      "lon": 2.6509,
      "buildings": [ ... ]
    }
  ]
}
```

Max 50 locations per request.

### Response

```json
{
  "datetime": "2025-06-21T12:00:00Z",
  "results": [
    {
      "id": "born",
      "is_sunny": true,
      "confidence": 0.82,
      "confidence_label": "high",
      "sun_altitude_deg": 68.4,
      "sun_azimuth_deg": 223.7,
      "shadow_ratio": 0.0
    },
    {
      "id": "placa-major",
      "is_sunny": true,
      "confidence": 0.79,
      "confidence_label": "medium",
      "sun_altitude_deg": 68.4,
      "sun_azimuth_deg": 223.7,
      "shadow_ratio": 0.0
    }
  ],
  "computed_at": "2025-06-21T12:00:01Z"
}
```

---

## POST /sunlight/windows

Compute all sunny and shaded windows for a full day at a given location.

### Request Body

```json
{
  "lat": 39.5706,
  "lon": 2.6509,
  "date": "2025-06-21",
  "buildings": [ ... ],
  "interval_minutes": 15
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude |
| `lon` | number | Yes | Longitude |
| `date` | string | Yes | Date in `YYYY-MM-DD` format |
| `buildings` | array | Yes | Nearby building objects (same format as `/sunlight/compute`) |
| `interval_minutes` | integer | No | Time step for sampling. Default: 15. Min: 5. Max: 60 |

### Response

```json
{
  "date": "2025-06-21",
  "lat": 39.5706,
  "lon": 2.6509,
  "sunrise": "05:43",
  "sunset": "21:12",
  "windows": [
    {
      "from": "06:15",
      "to": "11:30",
      "duration_minutes": 315,
      "type": "sunny",
      "avg_confidence": 0.81
    },
    {
      "from": "11:30",
      "to": "14:00",
      "duration_minutes": 150,
      "type": "shaded",
      "avg_confidence": 0.75
    },
    {
      "from": "14:00",
      "to": "19:45",
      "duration_minutes": 345,
      "type": "sunny",
      "avg_confidence": 0.88
    }
  ],
  "total_sunny_minutes": 660,
  "total_shaded_minutes": 150,
  "computed_at": "2025-06-21T10:00:01Z"
}
```

---

## GET /sun-position

Return the sun's altitude and azimuth for a given location and time. Lightweight — does not require building data.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude (WGS84) |
| `lon` | number | Yes | Longitude (WGS84) |
| `datetime` | string | No | ISO 8601 UTC. Defaults to now |

### Response

```json
{
  "lat": 39.5706,
  "lon": 2.6509,
  "datetime": "2025-06-21T12:00:00Z",
  "altitude_deg": 68.1,
  "azimuth_deg": 220.3,
  "is_daytime": true,
  "sunrise_utc": "2025-06-21T05:43:00Z",
  "sunset_utc": "2025-06-21T21:12:00Z"
}
```

---

## GET /sun-path

Return the hourly sun position for an entire day. Useful for rendering a sun path arc on the client.

### Query Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | number | Yes | Latitude (WGS84) |
| `lon` | number | Yes | Longitude (WGS84) |
| `date` | string | No | `YYYY-MM-DD`. Defaults to today (UTC) |
| `interval_minutes` | integer | No | Sampling interval. Default: 30. Min: 10. Max: 60 |

### Response

```json
{
  "date": "2025-06-21",
  "lat": 39.5706,
  "lon": 2.6509,
  "path": [
    { "time_utc": "2025-06-21T04:00:00Z", "altitude_deg": -5.2, "azimuth_deg": 52.1 },
    { "time_utc": "2025-06-21T05:00:00Z", "altitude_deg":  2.1, "azimuth_deg": 63.4 },
    { "time_utc": "2025-06-21T06:00:00Z", "altitude_deg": 12.8, "azimuth_deg": 73.9 },
    { "time_utc": "2025-06-21T12:00:00Z", "altitude_deg": 68.1, "azimuth_deg": 220.3 },
    { "time_utc": "2025-06-21T20:00:00Z", "altitude_deg":  8.4, "azimuth_deg": 294.7 },
    { "time_utc": "2025-06-21T21:00:00Z", "altitude_deg": -2.1, "azimuth_deg": 305.2 }
  ],
  "sunrise_utc": "2025-06-21T05:43:00Z",
  "sunset_utc": "2025-06-21T21:12:00Z",
  "solar_noon_utc": "2025-06-21T11:28:00Z",
  "max_altitude_deg": 68.9
}
```
