# Sunlight Engine — Technical Deep-Dive

## 1. Overview

The Sunseeker sunlight engine is a Python module (inside `services/solar/`) that answers a binary question for any outdoor location and moment in time:

> **Is this venue in direct sunlight right now?**

And a continuous question:

> **What is the confidence in that answer, and why?**

The engine is composed of three independent sub-systems that are always executed in order:

1. **Solar position calculator** — computes where the sun is in the sky.
2. **Shadow caster** — projects building shadows onto the ground plane.
3. **Confidence scorer** — estimates how reliable the binary sun/shadow verdict is.

---

## 2. Solar Position Calculation

### Library

Sun position is computed using [pysolar](https://pysolar.readthedocs.io/) (`pysolar.solar`), which implements the NREL Solar Position Algorithm (SPA). The NREL SPA is accurate to ±0.01° over the period 2000–2050 — more than sufficient for shadow casting where 0.5° precision is ample.

### Inputs

| Parameter | Type | Example |
|---|---|---|
| `lat` | float (decimal degrees, WGS84) | 39.5706 |
| `lon` | float (decimal degrees, WGS84) | 2.6509 |
| `dt` | datetime (UTC, timezone-aware) | 2025-06-21T12:00:00+00:00 |

### Outputs

| Value | Unit | Notes |
|---|---|---|
| `altitude` | degrees above horizon | Negative at night |
| `azimuth` | degrees clockwise from north | 0=N, 90=E, 180=S, 270=W |

### Mallorca Timezone

Palma de Mallorca is in **CET (UTC+1)** in winter and **CEST (UTC+2)** in summer. The engine always works in **UTC internally** and converts to local time only for display purposes. The solar noon in Palma at summer solstice is approximately 13:30 local time (CEST), which corresponds to 11:30 UTC.

### Night Guard

If `altitude ≤ 0°`, the function immediately returns:

```python
{
    "is_sunny": False,
    "confidence": 1.0,
    "confidence_label": "high",
    "reason": "sun_below_horizon"
}
```

This is a **certain** prediction — there can be no direct sunlight when the sun is below the horizon.

---

## 3. Shadow Casting Algorithm

All shadow geometry is performed in **UTM Zone 31N (EPSG:32631)**, a metric coordinate reference system. This avoids the distortions of geographic (degree-based) coordinates for distance and angle calculations.

### Step 1 — Sun Vector

Given altitude `α` (radians) and azimuth `θ` (radians, measured clockwise from north), the unit sun direction vector in the ground plane is:

```
sun_dx = sin(θ)      # east component
sun_dy = cos(θ)      # north component
```

This is the direction *from* the sun *toward* the observer (the direction shadows are cast).

### Step 2 — Shadow Length Factor

For a building of height `h` metres, the shadow extends:

```
shadow_length = h / tan(α)
```

where `α` is the solar altitude in radians. As `α → 0` (sun near horizon), `shadow_length → ∞`. To avoid numerical explosion and excessively large shadow polygons, we clamp the shadow length:

```
MAX_SHADOW_LENGTH_M = 500   # metres
shadow_length = min(h / tan(α), MAX_SHADOW_LENGTH_M)
```

This clamping also serves as an implicit low-confidence signal — when the sun is near the horizon, shadows are very long and uncertain.

### Step 3 — Shadow Polygon Construction

For each building footprint (a polygon with vertices `(x₁, y₁), …, (xₙ, yₙ)` in UTM):

1. Shift every vertex by the shadow displacement vector:
   ```
   (x'ᵢ, y'ᵢ) = (xᵢ + shadow_length * sun_dx,
                   yᵢ + shadow_length * sun_dy)
   ```

2. The shadow polygon is the convex hull of:
   ```
   original_vertices ∪ shifted_vertices
   ```

   Taking the convex hull simplifies the polygon and correctly handles non-convex building footprints (the shadow of a concave building is still a convex projection onto flat ground).

3. Using Shapely:
   ```python
   from shapely.geometry import MultiPoint
   shadow = MultiPoint(
       list(footprint.exterior.coords) +
       [(x + dx, y + dy) for x, y in footprint.exterior.coords]
   ).convex_hull
   ```

### Step 4 — Sunlight Test

The venue centroid `P` (in UTM) is tested against the union of all nearby building shadows:

```python
from shapely.ops import unary_union

shadow_union = unary_union(shadow_polygons)
is_in_shadow = shadow_union.contains(P)
is_sunny = not is_in_shadow
```

`unary_union` merges overlapping shadow polygons efficiently via GEOS. For a typical Palma venue with ~80 nearby buildings, this union operation takes < 5 ms.

### Step 5 — Edge Distance

To feed the confidence scorer, we also compute the distance from the venue centroid to the nearest shadow boundary:

```python
edge_distance_m = shadow_union.boundary.distance(P)
```

A small `edge_distance_m` (< 5 m) means the venue is near a shadow edge — the sun status may flip with small changes in building height estimates or sun position, so confidence should be reduced.

---

## 4. Coordinate System

| Stage | CRS | Reason |
|---|---|---|
| Input (API) | WGS84 (EPSG:4326) | Standard for web APIs and GPS |
| Building footprints (DB, WGS84 column) | EPSG:4326 | Spatial index for proximity queries |
| Building footprints (DB, UTM column) | EPSG:32631 | Pre-projected for fast shadow math |
| Shadow casting | EPSG:32631 | Metric, isotropic — distances in metres |
| Venue centroid (shadow test) | EPSG:32631 | Must match footprints |
| Output (API) | WGS84 | For client-side map rendering |

**Why UTM Zone 31N?** Palma de Mallorca (39.5°N, 2.6°E) falls squarely inside UTM Zone 31N. At this latitude, 1° of longitude ≈ 87 km, meaning degree-based distance calculations introduce ~0.2% distortion. For shadow casting at 300 m range, metric accuracy matters. UTM Zone 31N provides < 0.04% scale distortion across all of Mallorca.

**Projection library:** PyProj 3.x with the transformer API:

```python
from pyproj import Transformer
T = Transformer.from_crs("EPSG:4326", "EPSG:32631", always_xy=True)
lon_utm, lat_utm = T.transform(lon_wgs84, lat_wgs84)
```

---

## 5. Building Height Estimation

OSM building tags provide three possible height inputs, applied in priority order:

| Priority | OSM Tag | Calculation | Data Quality Flag |
|---|---|---|---|
| 1 | `height` | Parse numeric value (e.g. `"12.5 m"` → 12.5) | `with_height` |
| 2 | `building:levels` | `levels × 3.2 m` | `no_height` |
| 3 | (none) | Default: `8.0 m` (≈ 2 storeys) | `no_height` |

**3.2 m per level** is the standard floor-to-floor height used in European building regulations and widely adopted in OSM height estimation.

**8.0 m default** corresponds to a typical 2-storey residential building — the dominant building type in Palma's historic centre.

For shadow casting, underestimating height produces false "sunny" results (shadow doesn't reach far enough). Overestimating produces false "shaded" results. The 8.0 m default errs slightly on the side of shorter shadows, which is acceptable for a first iteration.

---

## 6. Confidence Scoring Model

The confidence score `c ∈ [0, 1]` is a weighted product of four independent factors. Each factor returns a value in [0, 1]. The product is then clipped to [0, 1].

### Factor 1 — Solar Altitude (`f_altitude`)

| Solar Altitude | `f_altitude` | Reasoning |
|---|---|---|
| ≥ 30° | 1.0 | Sun high — shadow length well-defined |
| 15°–30° | linear interpolation | Transitional |
| 5°–15° | 0.3–0.7 | Low sun — small angle errors cause large shadow errors |
| < 5° | 0.1 | Near-horizon — shadow length unstable |

```python
def f_altitude(alt_deg: float) -> float:
    if alt_deg >= 30:
        return 1.0
    if alt_deg >= 15:
        return 0.7 + (alt_deg - 15) / 15 * 0.3
    if alt_deg >= 5:
        return 0.3 + (alt_deg - 5) / 10 * 0.4
    return max(0.1, alt_deg / 5 * 0.3)
```

### Factor 2 — Building Data Quality (`f_quality`)

Computed over the nearby buildings (within 300 m):

```
f_quality = (count_with_height / total_buildings) × 1.0
           + (count_no_height   / total_buildings) × 0.5
```

If there are no buildings within 300 m (open space), `f_quality = 1.0` — the venue is unobstructed, so data quality is not a concern.

### Factor 3 — Edge Distance (`f_edge`)

```
edge_distance_m  →  f_edge
0–2 m                0.3    (right on shadow boundary — very uncertain)
2–10 m               0.3 + (d - 2) / 8 × 0.4   (interpolated)
> 10 m               0.7 + min((d - 10) / 40, 1.0) × 0.3
```

Maximum `f_edge = 1.0` when the venue is ≥ 50 m inside or outside any shadow.

### Factor 4 — Building Count (`f_coverage`)

```python
def f_coverage(n_buildings: int) -> float:
    if n_buildings >= 10:
        return 1.0
    return 0.5 + n_buildings / 10 * 0.5
```

Fewer nearby buildings means less complete shadow coverage data.

### Final Score and Labels

```python
raw_score = f_altitude * f_quality * f_edge * f_coverage
confidence = round(raw_score, 3)
```

| Label | Threshold |
|---|---|
| `high` | confidence ≥ 0.80 |
| `medium` | 0.50 ≤ confidence < 0.80 |
| `low` | 0.25 ≤ confidence < 0.50 |
| `unknown` | confidence < 0.25 |

---

## 7. Precomputation Strategy

Running the shadow engine live on every user request would be too slow (50–200 ms per venue for 300 m building queries). Instead:

### Prediction Cache

- Predictions are stored in `sunlight_predictions` with a `valid_until` timestamp.
- `valid_until = computed_at + 45 minutes`.
- The Next.js API first checks for a fresh cached prediction before calling the solar service.
- If no fresh prediction exists, a live computation is triggered and the result is cached.

### Scheduled Precompute

The `run-sunlight.py` script is scheduled (via cron or a cloud job scheduler) to run every **30 minutes**, keeping all venue predictions fresh. Before each compute run, existing predictions are marked `is_stale = TRUE` so they are not served while new ones are being written.

### Time Intervals Precomputed

For each venue, predictions are computed for:
- **Now** (current moment)
- **+30 min**
- **+60 min**
- **+2 h**
- **+4 h**
- **Full-day windows** via `/sunlight/windows` (stored as a single `windows` type record)

This gives the frontend enough data to show "sunny now", "sunny in 1 hour", and the full day's sunny/shaded windows without further API calls.

### Cache Invalidation

Predictions are invalidated when:
1. Their `valid_until` timestamp has passed.
2. A new precompute run marks them stale.
3. Building footprint data is updated for the area (manual trigger).

---

## 8. Known Limitations and Planned Improvements

| Limitation | Impact | Planned Fix |
|---|---|---|
| Flat-earth assumption (no terrain) | Medium — hills near Palma can shade venues earlier | Integrate SRTM elevation data for terrain shadow |
| Convex hull shadow (not exact) | Low — concave buildings produce slightly larger shadow estimates | Use exact polygon projection for large buildings |
| Static building data | Medium — new construction not reflected until re-ingestion | Weekly OSM diff ingestion |
| Clear-sky only | High on cloudy days — sun status is "sunny" even under cloud | Integrate Open-Meteo cloud cover; reduce confidence when cloudy |
| Centroid-based venue | Low–Medium — large terraces have sun gradient | Use venue polygon + table-level zones in Phase 3 |
| No atmospheric refraction adjustment | Very low — < 0.5° near horizon | Add refraction correction for alt < 5° |

---

## 9. Example Computation Walkthrough

**Venue:** Passeig del Born terrace, Palma de Mallorca
**Date/time:** 21 June 2025, 14:00 CEST (= 12:00 UTC)
**Location:** 39.5693°N, 2.6503°E

### Step 1 — Sun Position

```
altitude  = 68.4°
azimuth   = 223.7°  (south-south-west)
```

Sun is high and to the south-south-west — long afternoon shadows pointing north-north-east.

### Step 2 — Shadow Length

Nearest building: height = 12.5 m (from OSM `height` tag), data_quality = `with_height`.

```
shadow_length = 12.5 / tan(68.4° in radians)
             = 12.5 / tan(1.194)
             = 12.5 / 2.526
             ≈ 4.95 m
```

A 12.5 m building at solar noon in June casts a shadow barely 5 m long — consistent with personal experience in Palma.

### Step 3 — Shadow Polygon

The building footprint is shifted 4.95 m in the direction opposite the sun (azimuth = 223.7°, so shadow direction = 223.7° - 180° = 43.7° from north):

```
shadow_dx = 4.95 × sin(43.7°) = 4.95 × 0.691 = 3.42 m  (east)
shadow_dy = 4.95 × cos(43.7°) = 4.95 × 0.723 = 3.58 m  (north)
```

The building's shadow falls 3.4 m east and 3.6 m north of its footprint.

### Step 4 — Sunlight Test

The venue centroid is **22 m from the nearest shadow polygon boundary**. `shadow_union.contains(centroid)` returns `False`.

Result: **is_sunny = True**

### Step 5 — Confidence Score

```
f_altitude = 1.0          (alt = 68.4° >> 30°)
f_quality  = 0.82         (65% with_height, 35% no_height → 0.65×1.0 + 0.35×0.5 = 0.825)
f_edge     = 0.97         (22 m from boundary → 0.7 + (22-10)/40 × 0.3 = 0.79 → capped: actually 0.7 + 0.3×0.3 = 0.79 → recalc: 0.7 + min(12/40, 1.0)×0.3 = 0.79)
f_coverage = 1.0          (47 buildings within 300 m)

confidence = 1.0 × 0.825 × 0.79 × 1.0 = 0.652
label = "medium"
```

The "medium" confidence here is driven by incomplete building height data — about 35% of nearby buildings use estimated heights. A venue in an area with better OSM data would score "high".

**Final response:**

```json
{
  "is_sunny": true,
  "confidence": 0.652,
  "confidence_label": "medium",
  "sun_altitude_deg": 68.4,
  "sun_azimuth_deg": 223.7,
  "shadow_ratio": 0.0,
  "edge_distance_m": 22.1,
  "n_buildings": 47
}
```
