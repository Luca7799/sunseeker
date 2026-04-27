#!/usr/bin/env python3
"""
run-sunlight.py

Precompute sunlight predictions for all curated venues and active park zones.

For each location:
  1. Fetch nearby buildings (within 300 m) from building_footprints.
  2. Call the solar microservice /sunlight/windows endpoint (full day windows).
  3. Call /sunlight/compute for: now, +30 min, +60 min, +2 h, +4 h.
  4. Upsert all results into sunlight_predictions.
     valid_until = computed_at + 45 minutes.

Usage:
    python run-sunlight.py --db-url postgresql://... --solar-url http://localhost:8000
    python run-sunlight.py --db-url $DATABASE_URL --solar-url $SOLAR_SERVICE_URL --concurrency 10
"""

import argparse
import asyncio
import json
import logging
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import asyncpg
import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NEARBY_RADIUS_M = 300          # metres — buildings within this distance count
PREDICTION_TTL_MIN = 45        # minutes — valid_until = computed_at + this
COMPUTE_OFFSETS_MIN = [0, 30, 60, 120, 240]   # minutes from now to compute
DEFAULT_CONCURRENCY = 10

LOG_EVERY_N = 10               # log progress every N venues

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("run-sunlight")


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

FETCH_VENUES_SQL = """
SELECT
    v.id,
    v.slug,
    v.name,
    ST_Y(v.location::geometry)  AS lat,
    ST_X(v.location::geometry)  AS lon,
    v.venue_type
FROM venues v
WHERE v.is_curated = TRUE
  AND v.status = 'active'
ORDER BY v.name;
"""

FETCH_PARK_ZONES_SQL = """
SELECT
    pz.id,
    pz.name,
    ST_Y(ST_Centroid(pz.boundary::geometry)) AS lat,
    ST_X(ST_Centroid(pz.boundary::geometry)) AS lon,
    'park_zone'::text AS venue_type
FROM park_zones pz
WHERE pz.is_active = TRUE
ORDER BY pz.name;
"""

FETCH_NEARBY_BUILDINGS_SQL = """
SELECT
    bf.osm_id,
    ST_AsGeoJSON(bf.footprint_utm)   AS footprint_utm_geojson,
    bf.height_meters,
    bf.levels,
    bf.data_quality
FROM building_footprints bf
WHERE ST_DWithin(
    bf.footprint,
    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
    $3
)
LIMIT 500;
"""

MARK_STALE_SQL = """
UPDATE sunlight_predictions
SET is_stale = TRUE
WHERE (venue_id = $1 OR park_zone_id = $2)
  AND is_stale = FALSE;
"""

UPSERT_PREDICTION_SQL = """
INSERT INTO sunlight_predictions (
    venue_id,
    park_zone_id,
    computed_at,
    valid_until,
    target_time,
    is_sunny,
    confidence,
    confidence_label,
    sun_altitude_deg,
    sun_azimuth_deg,
    shadow_ratio,
    payload,
    is_stale
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, FALSE)
ON CONFLICT (venue_id, park_zone_id, target_time)
DO UPDATE SET
    computed_at       = EXCLUDED.computed_at,
    valid_until       = EXCLUDED.valid_until,
    is_sunny          = EXCLUDED.is_sunny,
    confidence        = EXCLUDED.confidence,
    confidence_label  = EXCLUDED.confidence_label,
    sun_altitude_deg  = EXCLUDED.sun_altitude_deg,
    sun_azimuth_deg   = EXCLUDED.sun_azimuth_deg,
    shadow_ratio      = EXCLUDED.shadow_ratio,
    payload           = EXCLUDED.payload,
    is_stale          = FALSE;
"""


async def fetch_venues(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch(FETCH_VENUES_SQL)
    return [dict(r) for r in rows]


async def fetch_park_zones(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch(FETCH_PARK_ZONES_SQL)
    return [dict(r) for r in rows]


async def fetch_nearby_buildings(
    pool: asyncpg.Pool, lon: float, lat: float, radius_m: float = NEARBY_RADIUS_M
) -> list[dict]:
    rows = await pool.fetch(FETCH_NEARBY_BUILDINGS_SQL, lon, lat, radius_m)
    return [dict(r) for r in rows]


async def mark_stale(
    pool: asyncpg.Pool, venue_id: Optional[str], zone_id: Optional[str]
) -> None:
    await pool.execute(MARK_STALE_SQL, venue_id, zone_id)


async def upsert_prediction(pool: asyncpg.Pool, pred: dict) -> None:
    await pool.execute(
        UPSERT_PREDICTION_SQL,
        pred["venue_id"],
        pred["park_zone_id"],
        pred["computed_at"],
        pred["valid_until"],
        pred["target_time"],
        pred["is_sunny"],
        pred["confidence"],
        pred["confidence_label"],
        pred["sun_altitude_deg"],
        pred["sun_azimuth_deg"],
        pred["shadow_ratio"],
        json.dumps(pred["payload"]),
    )


# ---------------------------------------------------------------------------
# Solar service helpers
# ---------------------------------------------------------------------------

def buildings_payload(buildings: list[dict]) -> list[dict]:
    """Convert asyncpg rows to the format expected by the solar service."""
    result = []
    for b in buildings:
        geojson = json.loads(b["footprint_utm_geojson"]) if b["footprint_utm_geojson"] else None
        if not geojson:
            continue
        result.append({
            "osm_id":        b["osm_id"],
            "footprint_utm": geojson,
            "height_meters": b["height_meters"],
            "data_quality":  b["data_quality"],
        })
    return result


async def call_compute(
    client: httpx.AsyncClient,
    solar_url: str,
    lat: float,
    lon: float,
    buildings: list[dict],
    target_dt: datetime,
) -> Optional[dict]:
    """
    POST /sunlight/compute for a single (location, time) pair.
    Returns the parsed JSON or None on error.
    """
    payload = {
        "lat": lat,
        "lon": lon,
        "datetime": target_dt.isoformat(),
        "buildings": buildings_payload(buildings),
    }
    try:
        resp = await client.post(
            f"{solar_url}/sunlight/compute",
            json=payload,
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        log.warning("compute HTTP %d for (%.4f, %.4f) @ %s: %s",
                    exc.response.status_code, lat, lon,
                    target_dt.isoformat(), exc.response.text[:200])
        return None
    except Exception as exc:
        log.warning("compute error for (%.4f, %.4f): %s", lat, lon, exc)
        return None


async def call_windows(
    client: httpx.AsyncClient,
    solar_url: str,
    lat: float,
    lon: float,
    buildings: list[dict],
    date: str,
) -> Optional[dict]:
    """
    POST /sunlight/windows for the given date.
    Returns the parsed JSON or None on error.
    """
    payload = {
        "lat":       lat,
        "lon":       lon,
        "date":      date,
        "buildings": buildings_payload(buildings),
    }
    try:
        resp = await client.post(
            f"{solar_url}/sunlight/windows",
            json=payload,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        log.warning("windows HTTP %d for (%.4f, %.4f): %s",
                    exc.response.status_code, lat, lon, exc.response.text[:200])
        return None
    except Exception as exc:
        log.warning("windows error for (%.4f, %.4f): %s", lat, lon, exc)
        return None


def result_to_prediction(
    result: dict,
    venue_id: Optional[str],
    zone_id: Optional[str],
    computed_at: datetime,
    target_time: datetime,
) -> dict:
    """Normalise a solar service response into a prediction record."""
    valid_until = computed_at + timedelta(minutes=PREDICTION_TTL_MIN)
    return {
        "venue_id":         venue_id,
        "park_zone_id":     zone_id,
        "computed_at":      computed_at,
        "valid_until":      valid_until,
        "target_time":      target_time,
        "is_sunny":         result.get("is_sunny", False),
        "confidence":       result.get("confidence", 0.0),
        "confidence_label": result.get("confidence_label", "unknown"),
        "sun_altitude_deg": result.get("sun_altitude_deg"),
        "sun_azimuth_deg":  result.get("sun_azimuth_deg"),
        "shadow_ratio":     result.get("shadow_ratio"),
        "payload":          result,
    }


# ---------------------------------------------------------------------------
# Per-location processing
# ---------------------------------------------------------------------------

async def process_location(
    loc: dict,
    is_venue: bool,
    pool: asyncpg.Pool,
    client: httpx.AsyncClient,
    solar_url: str,
    semaphore: asyncio.Semaphore,
    now: datetime,
) -> int:
    """
    Process a single venue or park zone. Returns the number of predictions upserted.
    """
    venue_id  = loc["id"] if is_venue  else None
    zone_id   = loc["id"] if not is_venue else None
    lat       = loc["lat"]
    lon       = loc["lon"]
    name      = loc["name"]

    async with semaphore:
        # Fetch nearby buildings
        buildings = await fetch_nearby_buildings(pool, lon, lat)

        # Mark existing predictions stale
        await mark_stale(pool, venue_id, zone_id)

        computed_at = datetime.now(timezone.utc)
        upserted = 0

        # --- /sunlight/compute for each time offset ---
        for offset_min in COMPUTE_OFFSETS_MIN:
            target_time = now + timedelta(minutes=offset_min)
            result = await call_compute(client, solar_url, lat, lon, buildings, target_time)
            if result:
                pred = result_to_prediction(result, venue_id, zone_id, computed_at, target_time)
                await upsert_prediction(pool, pred)
                upserted += 1

        # --- /sunlight/windows for today ---
        date_str = now.strftime("%Y-%m-%d")
        windows_result = await call_windows(client, solar_url, lat, lon, buildings, date_str)
        if windows_result:
            # Store the windows result as a single synthetic prediction keyed to midnight
            midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
            pred = result_to_prediction(
                windows_result, venue_id, zone_id, computed_at, midnight
            )
            pred["payload"] = {"type": "windows", "data": windows_result}
            await upsert_prediction(pool, pred)
            upserted += 1

    return upserted


# ---------------------------------------------------------------------------
# Main async loop
# ---------------------------------------------------------------------------

async def run(args: argparse.Namespace) -> None:
    t_start = time.time()
    log.info("Connecting to database …")

    pool = await asyncpg.create_pool(args.db_url, min_size=2, max_size=10)

    try:
        log.info("Fetching venues and park zones …")
        venues     = await fetch_venues(pool)
        park_zones = await fetch_park_zones(pool)
        log.info("Found %d curated venues and %d active park zones.", len(venues), len(park_zones))

        locations = [(loc, True) for loc in venues] + [(loc, False) for loc in park_zones]
        total = len(locations)

        semaphore = asyncio.Semaphore(args.concurrency)
        now = datetime.now(timezone.utc)

        async with httpx.AsyncClient() as client:
            tasks = [
                process_location(loc, is_venue, pool, client, args.solar_url, semaphore, now)
                for loc, is_venue in locations
            ]

            total_predictions = 0
            processed = 0
            for coro in asyncio.as_completed(tasks):
                try:
                    n = await coro
                    total_predictions += n
                except Exception as exc:
                    log.error("Unexpected error processing location: %s", exc)
                processed += 1
                if processed % LOG_EVERY_N == 0 or processed == total:
                    log.info(
                        "Progress: %d / %d locations processed, %d predictions upserted so far.",
                        processed,
                        total,
                        total_predictions,
                    )

    finally:
        await pool.close()

    elapsed = time.time() - t_start
    log.info(
        "Summary: %d locations processed, %d predictions upserted, elapsed %.1fs.",
        total,
        total_predictions,
        elapsed,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Precompute sunlight predictions for all curated Sunseeker venues."
    )
    parser.add_argument(
        "--db-url",
        required=True,
        help="PostgreSQL connection URL, e.g. postgresql://user:pass@host/db",
    )
    parser.add_argument(
        "--solar-url",
        default="http://localhost:8000",
        help="Base URL of the solar microservice (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help=f"Max concurrent API calls (default: {DEFAULT_CONCURRENCY})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
