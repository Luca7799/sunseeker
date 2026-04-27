"""
Shadow casting engine for the Sunseeker solar microservice.

Algorithm summary
-----------------
For each building within the search radius we:

1. Resolve the building height:
   - Use `height_meters` if available (data_quality == 'actual').
   - Fall back to `estimated_height_meters` (derived from OSM levels tag).
   - Use DEFAULT_BUILDING_HEIGHT_M as a last resort.

2. Compute the shadow length on flat ground:
       shadow_length = height / tan(sun_altitude_radians)

3. Determine the shadow direction (opposite to the sun):
       shadow_azimuth = (sun_azimuth + 180) % 360   [navigation convention]

4. Compute the shadow offset vector in metric (UTM) space:
       dx = shadow_length * sin(shadow_azimuth_rad)   # East component
       dy = shadow_length * cos(shadow_azimuth_rad)   # North component

5. Project the building footprint:
   - Convert footprint GeoJSON → Shapely Polygon in UTM Zone 31N (EPSG:32631).
   - Translate the footprint by (dx, dy) to get the shadow tip polygon.
   - Take the convex hull of the union of the original footprint and the
     translated polygon to form the full shadow area.

6. Test whether the venue point (also in UTM) lies within the shadow polygon.

All spatial operations are performed in UTM Zone 31N (EPSG:32631) so that
distances are in metres and geometry is not distorted by latitude.

Edge cases handled
------------------
- Sun below horizon → NIGHT.
- Sun altitude < MIN_USEFUL_ALTITUDE → UNKNOWN (grazing light, too uncertain).
- Building with degenerate / invalid footprint → skip with a warning log.
- Venue point inside a building footprint → UNKNOWN (GPS / data issue).
- Building with no height information → use DEFAULT_BUILDING_HEIGHT_M.
- Shadow length that would be unrealistically long (altitude < ~1°) is bounded
  by MAX_SHADOW_LENGTH_M.
"""

from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Optional

from pyproj import Transformer
from shapely.errors import TopologicalError
from shapely.geometry import MultiPolygon, Point, Polygon, shape
from shapely.ops import unary_union

from models import Building, ConfidenceLabel, SunlightResult, SunlightStatus
from solar_engine import MIN_USEFUL_ALTITUDE, get_sun_position

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Fallback height when no OSM height or levels data is present.
DEFAULT_BUILDING_HEIGHT_M: float = 8.0  # roughly 2-3 storey European building

# Height per storey used to convert OSM `building:levels` → metres.
METRES_PER_LEVEL: float = 3.0

# Hard cap on shadow length to avoid near-infinite shadows at very low
# sun angles (should never be reached if MIN_USEFUL_ALTITUDE is respected).
MAX_SHADOW_LENGTH_M: float = 500.0

# EPSG code for UTM Zone 31N – covers the Balearic Islands and most of Spain.
UTM31N_EPSG: int = 32631

# ---------------------------------------------------------------------------
# Coordinate transformation helpers
# ---------------------------------------------------------------------------

# Build a reusable transformer (thread-safe in pyproj ≥ 3.x).
_wgs84_to_utm31n: Transformer = Transformer.from_crs(
    "EPSG:4326",  # WGS-84 geographic
    f"EPSG:{UTM31N_EPSG}",
    always_xy=True,  # input order: (lng, lat)
)
_utm31n_to_wgs84: Transformer = Transformer.from_crs(
    f"EPSG:{UTM31N_EPSG}",
    "EPSG:4326",
    always_xy=True,
)


def wgs84_to_utm31n(lng: float, lat: float) -> tuple[float, float]:
    """
    Convert WGS-84 geographic coordinates to UTM Zone 31N (EPSG:32631).

    Parameters
    ----------
    lng : float
        Longitude in decimal degrees.
    lat : float
        Latitude in decimal degrees.

    Returns
    -------
    tuple[float, float]
        (easting_m, northing_m) in metres.
    """
    x, y = _wgs84_to_utm31n.transform(lng, lat)
    return float(x), float(y)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def building_to_utm_polygon(footprint_geojson: dict) -> Optional[Polygon]:
    """
    Convert a GeoJSON Polygon or MultiPolygon footprint to a Shapely Polygon
    in UTM Zone 31N.

    Parameters
    ----------
    footprint_geojson : dict
        GeoJSON geometry object (type: 'Polygon' or 'MultiPolygon').

    Returns
    -------
    Optional[Polygon]
        A valid Shapely Polygon in UTM coordinates, or None if the conversion
        fails or produces a degenerate geometry.
    """
    try:
        geom = shape(footprint_geojson)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to parse building footprint GeoJSON: %s", exc)
        return None

    # Flatten MultiPolygon → single Polygon via convex hull for simplicity.
    if isinstance(geom, MultiPolygon):
        geom = geom.convex_hull

    if not isinstance(geom, Polygon):
        logger.warning(
            "Building footprint is not a Polygon/MultiPolygon: %s", type(geom)
        )
        return None

    if geom.is_empty or not geom.is_valid:
        logger.warning("Building footprint is empty or invalid, skipping.")
        return None

    # Transform each coordinate pair from WGS-84 to UTM.
    exterior_utm = [
        wgs84_to_utm31n(lng, lat) for lng, lat in geom.exterior.coords
    ]

    interiors_utm = []
    for ring in geom.interiors:
        interiors_utm.append(
            [wgs84_to_utm31n(lng, lat) for lng, lat in ring.coords]
        )

    utm_polygon = Polygon(exterior_utm, interiors_utm)

    if utm_polygon.is_empty or not utm_polygon.is_valid:
        logger.warning(
            "UTM-transformed building polygon is invalid, attempting buffer fix."
        )
        utm_polygon = utm_polygon.buffer(0)

    if utm_polygon.is_empty or not utm_polygon.is_valid:
        return None

    return utm_polygon


def compute_shadow_polygon(
    building_utm_polygon: Polygon,
    building_height_m: float,
    shadow_length_m: float,
    shadow_dx: float,
    shadow_dy: float,
) -> Polygon:
    """
    Build the full shadow polygon for a building at a given sun position.

    The shadow is constructed by:
    1. Translating the building footprint by the shadow offset vector
       (shadow_dx, shadow_dy) to obtain the "tip" polygon – the area at the
       far end of the shadow.
    2. Taking the convex hull of the union of the original footprint and the
       translated tip.  This approximates the shadow swept area for convex
       buildings and is a safe over-estimate for concave ones.

    Parameters
    ----------
    building_utm_polygon : Polygon
        Building footprint in UTM Zone 31N coordinates.
    building_height_m : float
        Building height in metres (used for documentation; shadow_length_m
        is pre-computed by the caller).
    shadow_length_m : float
        Length of the shadow on the ground in metres.
    shadow_dx : float
        East component of the shadow offset vector (metres, East positive).
    shadow_dy : float
        North component of the shadow offset vector (metres, North positive).

    Returns
    -------
    Polygon
        Convex hull of the shadow area in UTM Zone 31N coordinates.
    """
    # Translate the building footprint to the tip of the shadow.
    tip_polygon = _translate_polygon(building_utm_polygon, shadow_dx, shadow_dy)

    try:
        combined = unary_union([building_utm_polygon, tip_polygon])
        shadow = combined.convex_hull
    except TopologicalError as exc:
        logger.warning(
            "Topological error computing shadow polygon: %s – using tip only",
            exc,
        )
        shadow = tip_polygon.convex_hull

    return shadow


def _translate_polygon(polygon: Polygon, dx: float, dy: float) -> Polygon:
    """
    Translate a Shapely Polygon by (dx, dy) in its native coordinate system.
    """
    exterior = [(x + dx, y + dy) for x, y in polygon.exterior.coords]
    interiors = [
        [(x + dx, y + dy) for x, y in ring.coords]
        for ring in polygon.interiors
    ]
    return Polygon(exterior, interiors)


# ---------------------------------------------------------------------------
# Height resolution
# ---------------------------------------------------------------------------


def _resolve_building_height(building: Building) -> float:
    """
    Return the best available height estimate for *building* in metres.

    Priority:
    1. ``height_meters``  – measured / tagged height (highest quality).
    2. ``estimated_height_meters`` – derived from ``building:levels`` tag.
    3. ``DEFAULT_BUILDING_HEIGHT_M`` – conservative fallback.
    """
    if building.height_meters is not None and building.height_meters > 0:
        return building.height_meters
    if (
        building.estimated_height_meters is not None
        and building.estimated_height_meters > 0
    ):
        return building.estimated_height_meters
    return DEFAULT_BUILDING_HEIGHT_M


# ---------------------------------------------------------------------------
# Core shadow computation
# ---------------------------------------------------------------------------


def compute_shadow_for_venue(
    venue_lat: float,
    venue_lng: float,
    buildings: list[Building],
    sun_altitude_deg: float,
    sun_azimuth_deg: float,
) -> tuple[SunlightStatus, Optional[str]]:
    """
    Determine whether a venue is in shade at a given solar position.

    Parameters
    ----------
    venue_lat : float
        Venue latitude in decimal degrees.
    venue_lng : float
        Venue longitude in decimal degrees.
    buildings : list[Building]
        Nearby buildings to evaluate.  Should already be pre-filtered to a
        reasonable search radius by the caller (e.g. 150 m).
    sun_altitude_deg : float
        Solar altitude above the horizon in degrees.
    sun_azimuth_deg : float
        Solar azimuth in navigation convention (0 = North, 90 = East, …).

    Returns
    -------
    tuple[SunlightStatus, Optional[str]]
        (status, obstructing_osm_id)

        ``obstructing_osm_id`` is set to the OSM ID of the first building
        whose shadow covers the venue, or None if the venue is in direct sun.
    """
    # ------------------------------------------------------------------
    # Guard: sun below horizon
    # ------------------------------------------------------------------
    if sun_altitude_deg <= 0.0:
        return SunlightStatus.night, None

    # ------------------------------------------------------------------
    # Guard: sun too low for reliable shadow calculation
    # ------------------------------------------------------------------
    if sun_altitude_deg < MIN_USEFUL_ALTITUDE:
        return SunlightStatus.unknown, None

    # ------------------------------------------------------------------
    # Convert venue to UTM
    # ------------------------------------------------------------------
    venue_x, venue_y = wgs84_to_utm31n(venue_lng, venue_lat)
    venue_point = Point(venue_x, venue_y)

    # ------------------------------------------------------------------
    # Pre-compute shadow direction from sun azimuth
    # ------------------------------------------------------------------
    # Shadows fall in the direction opposite to the sun.
    shadow_azimuth_deg = (sun_azimuth_deg + 180.0) % 360.0
    shadow_azimuth_rad = math.radians(shadow_azimuth_deg)

    # tan of altitude must be positive; altitude is already > MIN_USEFUL_ALTITUDE.
    sun_altitude_rad = math.radians(sun_altitude_deg)
    tan_altitude = math.tan(sun_altitude_rad)

    # ------------------------------------------------------------------
    # Evaluate each building
    # ------------------------------------------------------------------
    for building in buildings:
        # --- Convert footprint to UTM polygon ---
        utm_poly = building_to_utm_polygon(building.footprint_geojson)
        if utm_poly is None:
            # Degenerate footprint – skip with warning already logged.
            continue

        # --- Check if venue is inside the building footprint ---
        # This indicates a GPS or data quality issue; return UNKNOWN.
        try:
            if utm_poly.contains(venue_point) or utm_poly.touches(venue_point):
                logger.info(
                    "Venue (%f, %f) is inside building %s footprint – "
                    "marking UNKNOWN",
                    venue_lat,
                    venue_lng,
                    building.osm_id,
                )
                return SunlightStatus.unknown, building.osm_id
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Error testing venue-in-building for %s: %s",
                building.osm_id,
                exc,
            )

        # --- Resolve building height ---
        height_m = _resolve_building_height(building)

        # --- Compute shadow length ---
        raw_shadow_length = height_m / tan_altitude
        shadow_length_m = min(raw_shadow_length, MAX_SHADOW_LENGTH_M)

        # --- Shadow offset vector ---
        # dx: East component (sin of azimuth measured from North clockwise)
        # dy: North component (cos of azimuth measured from North clockwise)
        shadow_dx = shadow_length_m * math.sin(shadow_azimuth_rad)
        shadow_dy = shadow_length_m * math.cos(shadow_azimuth_rad)

        # --- Build shadow polygon ---
        try:
            shadow_poly = compute_shadow_polygon(
                utm_poly, height_m, shadow_length_m, shadow_dx, shadow_dy
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Failed to compute shadow polygon for building %s: %s",
                building.osm_id,
                exc,
            )
            continue

        # --- Test venue point against shadow polygon ---
        try:
            if shadow_poly.contains(venue_point):
                logger.debug(
                    "Venue (%f, %f) is in shadow of building %s "
                    "(height=%.1f m, shadow_length=%.1f m)",
                    venue_lat,
                    venue_lng,
                    building.osm_id,
                    height_m,
                    shadow_length_m,
                )
                return SunlightStatus.shade, building.osm_id
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Error testing venue-in-shadow for building %s: %s",
                building.osm_id,
                exc,
            )

    # No building shadow covers the venue.
    return SunlightStatus.direct_sun, None


# ---------------------------------------------------------------------------
# Higher-level helper: compute sunlight at a specific datetime
# ---------------------------------------------------------------------------


def compute_sunlight_at_time(
    venue_lat: float,
    venue_lng: float,
    buildings: list[Building],
    dt: datetime,
) -> tuple[SunlightStatus, Optional[str], int]:
    """
    Compute the sunlight status at a venue at a specific moment.

    This is a convenience wrapper that calls :func:`get_sun_position` from
    ``solar_engine`` and then :func:`compute_shadow_for_venue`.

    Parameters
    ----------
    venue_lat : float
        Venue latitude in decimal degrees.
    venue_lng : float
        Venue longitude in decimal degrees.
    buildings : list[Building]
        Nearby buildings.
    dt : datetime
        Evaluation datetime (timezone-aware preferred).

    Returns
    -------
    tuple[SunlightStatus, Optional[str], int]
        (status, obstructing_osm_id, buildings_checked)
    """
    sun_pos = get_sun_position(venue_lat, venue_lng, dt)

    # Night or unknown handled before shadow loop.
    if sun_pos.altitude_deg <= 0.0:
        return SunlightStatus.night, None, 0

    if sun_pos.altitude_deg < MIN_USEFUL_ALTITUDE:
        return SunlightStatus.unknown, None, 0

    status, obstruction_id = compute_shadow_for_venue(
        venue_lat=venue_lat,
        venue_lng=venue_lng,
        buildings=buildings,
        sun_altitude_deg=sun_pos.altitude_deg,
        sun_azimuth_deg=sun_pos.azimuth_deg,
    )

    return status, obstruction_id, len(buildings)
