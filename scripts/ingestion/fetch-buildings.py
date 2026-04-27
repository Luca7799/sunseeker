#!/usr/bin/env python3
"""
fetch-buildings.py

Fetch building footprints for Palma de Mallorca from the OSM Overpass API
and upsert them into the PostgreSQL/PostGIS building_footprints table.

Usage:
    python fetch-buildings.py --db-url postgresql://postgres:postgres@localhost:5432/sunseeker
    python fetch-buildings.py --db-url $DATABASE_URL --batch-size 1000 --overpass-url https://overpass-api.de/api/interpreter
"""

import argparse
import json
import logging
import sys
import time
from typing import Optional

import psycopg2
import psycopg2.extras
import requests
from pyproj import Transformer
from shapely.geometry import Polygon, mapping
from shapely.wkt import dumps as wkt_dumps

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Palma de Mallorca bounding box: (south, west, north, east)
PALMA_BBOX = (39.54, 2.59, 39.60, 2.72)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# WGS84 → UTM Zone 31N (metric, for shadow casting)
TRANSFORMER_TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32631", always_xy=True)

DEFAULT_HEIGHT_M = 8.0       # 2 typical storeys when nothing is known
METERS_PER_LEVEL = 3.2       # standard floor-to-floor height estimate

# Retry / rate-limit settings
MAX_RETRIES = 5
RETRY_BACKOFF_BASE = 10      # seconds — doubles on each retry
REQUEST_TIMEOUT_SEC = 120

LOG_EVERY_N = 500

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("fetch-buildings")


# ---------------------------------------------------------------------------
# Overpass query
# ---------------------------------------------------------------------------

def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    """Return an Overpass QL query that fetches all building ways + nodes."""
    south, west, north, east = bbox
    return f"""
[out:json][timeout:120];
(
  way["building"]({south},{west},{north},{east});
);
out body;
>;
out skel qt;
""".strip()


def fetch_overpass(query: str, overpass_url: str) -> dict:
    """
    POST the Overpass query and return the parsed JSON.
    Retries on HTTP 429 (rate-limited) and 504 (timeout) with exponential back-off.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            log.info("Overpass request (attempt %d/%d) …", attempt, MAX_RETRIES)
            resp = requests.post(
                overpass_url,
                data={"data": query},
                timeout=REQUEST_TIMEOUT_SEC,
                headers={"Accept-Encoding": "gzip, deflate"},
            )

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code in (429, 504):
                wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
                log.warning(
                    "Overpass returned HTTP %d — waiting %ds before retry.",
                    resp.status_code,
                    wait,
                )
                time.sleep(wait)
                continue

            resp.raise_for_status()

        except requests.exceptions.Timeout:
            wait = RETRY_BACKOFF_BASE * (2 ** (attempt - 1))
            log.warning("Request timed out (attempt %d) — waiting %ds.", attempt, wait)
            time.sleep(wait)

        except requests.exceptions.RequestException as exc:
            log.error("Request error: %s", exc)
            raise

    raise RuntimeError(f"Overpass API failed after {MAX_RETRIES} attempts.")


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def build_node_index(elements: list[dict]) -> dict[int, tuple[float, float]]:
    """Return {node_id: (lon, lat)} from the raw Overpass element list."""
    return {
        el["id"]: (el["lon"], el["lat"])
        for el in elements
        if el["type"] == "node"
    }


def way_to_polygon(
    way: dict, node_index: dict[int, tuple[float, float]]
) -> Optional[Polygon]:
    """
    Build a Shapely Polygon (WGS84) from a way element.
    Returns None if the polygon is degenerate or nodes are missing.
    """
    node_ids = way.get("nodes", [])
    coords = []
    for nid in node_ids:
        if nid not in node_index:
            return None          # incomplete data — skip
        coords.append(node_index[nid])

    if len(coords) < 4:          # need at least 3 distinct + closing node
        return None

    try:
        poly = Polygon(coords)
        if not poly.is_valid:
            poly = poly.buffer(0)   # attempt repair
        if poly.is_empty or poly.area == 0:
            return None
        return poly
    except Exception:
        return None


def project_polygon_to_utm(poly_wgs84: Polygon) -> Polygon:
    """Project a WGS84 polygon to UTM Zone 31N and return the projected polygon."""
    xs, ys = poly_wgs84.exterior.xy
    xs_utm, ys_utm = TRANSFORMER_TO_UTM.transform(list(xs), list(ys))
    return Polygon(zip(xs_utm, ys_utm))


# ---------------------------------------------------------------------------
# Height / level extraction
# ---------------------------------------------------------------------------

def extract_height(tags: dict) -> tuple[float, str]:
    """
    Return (estimated_height_m, data_quality).

    data_quality values:
      'with_height'  — explicit `height` tag present and parseable
      'no_height'    — derived from building:levels or defaulted
    """
    raw_height = tags.get("height")
    if raw_height:
        try:
            # OSM height tags are sometimes "12 m", "12.5", etc.
            height_val = float(raw_height.split()[0])
            if height_val > 0:
                return height_val, "with_height"
        except (ValueError, AttributeError):
            pass

    raw_levels = tags.get("building:levels")
    if raw_levels:
        try:
            levels = int(float(raw_levels))
            if levels > 0:
                return levels * METERS_PER_LEVEL, "no_height"
        except (ValueError, AttributeError):
            pass

    return DEFAULT_HEIGHT_M, "no_height"


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS building_footprints (
    id               BIGSERIAL PRIMARY KEY,
    osm_id           BIGINT       NOT NULL,
    osm_type         TEXT         NOT NULL DEFAULT 'way',
    footprint        GEOMETRY(Polygon, 4326),
    footprint_utm    GEOMETRY(Polygon, 32631),
    height_meters    FLOAT        NOT NULL,
    levels           INTEGER,
    data_quality     TEXT         NOT NULL DEFAULT 'no_height',
    tags             JSONB,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT building_footprints_osm_id_unique UNIQUE (osm_id)
);
CREATE INDEX IF NOT EXISTS idx_building_footprints_footprint
    ON building_footprints USING GIST (footprint);
CREATE INDEX IF NOT EXISTS idx_building_footprints_footprint_utm
    ON building_footprints USING GIST (footprint_utm);
"""

UPSERT_SQL = """
INSERT INTO building_footprints
    (osm_id, osm_type, footprint, footprint_utm, height_meters, levels, data_quality, tags, updated_at)
VALUES
    (%(osm_id)s, %(osm_type)s,
     ST_GeomFromText(%(footprint_wkt)s, 4326),
     ST_GeomFromText(%(footprint_utm_wkt)s, 32631),
     %(height_meters)s, %(levels)s, %(data_quality)s, %(tags)s,
     NOW())
ON CONFLICT (osm_id)
DO UPDATE SET
    footprint        = EXCLUDED.footprint,
    footprint_utm    = EXCLUDED.footprint_utm,
    height_meters    = EXCLUDED.height_meters,
    levels           = EXCLUDED.levels,
    data_quality     = EXCLUDED.data_quality,
    tags             = EXCLUDED.tags,
    updated_at       = NOW();
"""


def ensure_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
    conn.commit()
    log.info("Table building_footprints ensured.")


def upsert_buildings(conn, records: list[dict]) -> int:
    """Upsert a batch of building records. Returns the number of rows affected."""
    if not records:
        return 0
    with conn.cursor() as cur:
        psycopg2.extras.execute_batch(cur, UPSERT_SQL, records, page_size=200)
    conn.commit()
    return len(records)


# ---------------------------------------------------------------------------
# Processing
# ---------------------------------------------------------------------------

def process_overpass_data(data: dict) -> list[dict]:
    """
    Parse Overpass JSON and return a list of record dicts ready for upsert.
    """
    elements = data.get("elements", [])
    node_index = build_node_index(elements)

    ways = [el for el in elements if el["type"] == "way"]
    log.info("Found %d ways and %d nodes in Overpass response.", len(ways), len(node_index))

    records = []
    skipped = 0

    for i, way in enumerate(ways, 1):
        tags = way.get("tags", {})
        osm_id = way["id"]

        poly_wgs84 = way_to_polygon(way, node_index)
        if poly_wgs84 is None:
            skipped += 1
            continue

        poly_utm = project_polygon_to_utm(poly_wgs84)

        height_m, quality = extract_height(tags)

        raw_levels = tags.get("building:levels")
        levels = None
        if raw_levels:
            try:
                levels = int(float(raw_levels))
            except (ValueError, AttributeError):
                pass

        records.append({
            "osm_id":           osm_id,
            "osm_type":         "way",
            "footprint_wkt":    wkt_dumps(poly_wgs84, rounding_precision=8),
            "footprint_utm_wkt":wkt_dumps(poly_utm,    rounding_precision=2),
            "height_meters":    height_m,
            "levels":           levels,
            "data_quality":     quality,
            "tags":             json.dumps(tags),
        })

        if i % LOG_EVERY_N == 0:
            log.info("  … processed %d / %d ways (%d skipped so far)", i, len(ways), skipped)

    log.info(
        "Processing complete: %d valid buildings, %d skipped (degenerate geometry or missing nodes).",
        len(records),
        skipped,
    )
    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch Palma de Mallorca building footprints from Overpass and store in PostGIS."
    )
    parser.add_argument(
        "--db-url",
        required=True,
        help="PostgreSQL connection URL, e.g. postgresql://user:pass@host/db",
    )
    parser.add_argument(
        "--overpass-url",
        default=OVERPASS_URL,
        help=f"Overpass API endpoint (default: {OVERPASS_URL})",
    )
    parser.add_argument(
        "--bbox",
        default=None,
        help="Custom bounding box as 'south,west,north,east' (default: Palma de Mallorca)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and parse data but do not write to the database.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    bbox = PALMA_BBOX
    if args.bbox:
        try:
            bbox = tuple(float(v) for v in args.bbox.split(","))
            if len(bbox) != 4:
                raise ValueError
        except ValueError:
            log.error("--bbox must be four comma-separated floats: south,west,north,east")
            sys.exit(1)

    log.info("Bounding box: south=%.4f west=%.4f north=%.4f east=%.4f", *bbox)

    # 1. Fetch from Overpass
    query = build_overpass_query(bbox)
    log.info("Fetching buildings from Overpass API …")
    t0 = time.time()
    data = fetch_overpass(query, args.overpass_url)
    log.info("Overpass fetch completed in %.1fs.", time.time() - t0)

    # 2. Parse
    log.info("Parsing Overpass response …")
    t1 = time.time()
    records = process_overpass_data(data)
    log.info("Parsed %d buildings in %.1fs.", len(records), time.time() - t1)

    if args.dry_run:
        log.info("--dry-run enabled — skipping database write.")
        log.info("Sample record: %s", json.dumps({k: v for k, v in list(records[0].items()) if k != "tags"}, indent=2) if records else "(none)")
        return

    # 3. Upsert
    log.info("Connecting to database …")
    conn = psycopg2.connect(args.db_url)

    try:
        ensure_table(conn)

        log.info("Upserting %d records …", len(records))
        t2 = time.time()

        # Process in chunks to keep memory and transaction size reasonable
        CHUNK = 500
        total_upserted = 0
        for start in range(0, len(records), CHUNK):
            chunk = records[start : start + CHUNK]
            upserted = upsert_buildings(conn, chunk)
            total_upserted += upserted
            log.info(
                "  Upserted chunk %d–%d (%d rows total so far)",
                start + 1,
                start + upserted,
                total_upserted,
            )

        elapsed = time.time() - t2
        log.info(
            "Done. %d buildings upserted in %.1fs (%.0f rows/sec).",
            total_upserted,
            elapsed,
            total_upserted / max(elapsed, 0.001),
        )

    finally:
        conn.close()

    log.info("fetch-buildings.py finished successfully.")


if __name__ == "__main__":
    main()
