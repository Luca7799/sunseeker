"""
Solar position and daylight window calculator for the Sunseeker service.

Uses pysolar for accurate ephemeris calculations.  All public functions are
timezone-aware; naive datetimes are rejected or assumed to be in the Palma de
Mallorca local timezone (Europe/Madrid) for convenience.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from pysolar.solar import get_altitude, get_azimuth

from models import SunPosition

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PALMA_LAT: float = 39.5696
PALMA_LNG: float = 2.6502
PALMA_TZ: str = "Europe/Madrid"

# Below this altitude the sun is too close to the horizon for reliable shadow
# calculations; we treat the result as UNKNOWN rather than IN_SUN / IN_SHADE.
MIN_USEFUL_ALTITUDE: float = 3.0  # degrees


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ensure_aware(dt: datetime, tz_str: str = PALMA_TZ) -> datetime:
    """
    Return a timezone-aware datetime.

    If *dt* is already aware, return it unchanged.
    If *dt* is naive, attach the given timezone (default: Europe/Madrid).
    """
    if dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=ZoneInfo(tz_str))


def _to_utc(dt: datetime) -> datetime:
    """Convert an aware datetime to UTC."""
    return dt.astimezone(ZoneInfo("UTC"))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_sun_position(lat: float, lng: float, dt: datetime) -> SunPosition:
    """
    Compute the solar altitude and azimuth for a given location and moment.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees (WGS-84).
    lng : float
        Longitude in decimal degrees (WGS-84).
    dt : datetime
        Evaluation moment.  Naive datetimes are interpreted as Europe/Madrid
        local time.

    Returns
    -------
    SunPosition
        Solar position with altitude, azimuth, and the UTC timestamp used.
    """
    dt_aware = _ensure_aware(dt)
    dt_utc = _to_utc(dt_aware)

    # pysolar expects an aware datetime in UTC or with tz info attached.
    altitude = get_altitude(lat, lng, dt_utc)
    azimuth_raw = get_azimuth(lat, lng, dt_utc)

    # pysolar returns azimuth in the range (-180, 180] measured from South,
    # positive going West (meteorological convention).  We convert to the
    # standard navigation convention: 0 = North, 90 = East, 180 = South,
    # 270 = West, measured clockwise.
    #
    # pysolar convention:
    #   0   => South
    #   90  => West  (clockwise from South in pysolar's frame? Actually:
    #                 pysolar measures counter-clockwise from South,
    #                 so positive is West, negative is East)
    #
    # Conversion:
    #   nav_azimuth = (180 - azimuth_raw) % 360
    azimuth_nav = (180.0 - azimuth_raw) % 360.0

    return SunPosition(
        altitude_deg=round(altitude, 4),
        azimuth_deg=round(azimuth_nav, 4),
        timestamp=dt_utc,
    )


def is_daylight(lat: float, lng: float, dt: datetime) -> bool:
    """
    Return True if the sun is above the horizon at the given location and time.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lng : float
        Longitude in decimal degrees.
    dt : datetime
        Evaluation moment (naive datetimes assumed Europe/Madrid).

    Returns
    -------
    bool
        True when solar altitude > 0°.
    """
    position = get_sun_position(lat, lng, dt)
    return position.altitude_deg > 0.0


def get_todays_sun_windows(
    lat: float,
    lng: float,
    reference_date: date,
    interval_minutes: int = 15,
) -> list[tuple[datetime, datetime]]:
    """
    Return a list of (start, end) datetime pairs during which the sun is above
    the horizon on *reference_date* at the given location.

    Typically there is exactly one window (sunrise → sunset), but at extreme
    latitudes or around the solstices there could be zero or one that spans
    midnight.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lng : float
        Longitude in decimal degrees.
    reference_date : date
        The calendar date to evaluate.
    interval_minutes : int
        Sampling resolution in minutes.  Smaller values improve accuracy at
        the cost of more pysolar calls.

    Returns
    -------
    list[tuple[datetime, datetime]]
        Each tuple is an (aware UTC start, aware UTC end) pair.
    """
    tz = ZoneInfo(PALMA_TZ)
    utc = ZoneInfo("UTC")

    # Build a list of sample datetimes covering the full local calendar day.
    day_start = datetime(
        reference_date.year,
        reference_date.month,
        reference_date.day,
        0,
        0,
        0,
        tzinfo=tz,
    )
    samples: list[datetime] = []
    cursor = day_start
    # Cover 24 hours + one extra step so we can detect end-of-day transitions.
    while cursor < day_start + timedelta(hours=24, minutes=interval_minutes):
        samples.append(cursor.astimezone(utc))
        cursor += timedelta(minutes=interval_minutes)

    # Determine daylight flag for each sample.
    flags: list[bool] = []
    for s in samples:
        alt = get_altitude(lat, lng, s)
        flags.append(alt > 0.0)

    # Merge consecutive True runs into windows.
    windows: list[tuple[datetime, datetime]] = []
    in_window = False
    window_start: Optional[datetime] = None

    for i, (sample, flag) in enumerate(zip(samples, flags)):
        if flag and not in_window:
            # Rising edge: sun just crossed the horizon.
            in_window = True
            window_start = sample
        elif not flag and in_window:
            # Falling edge: sun just went below the horizon.
            in_window = False
            # The actual crossing is between samples[i-1] and samples[i].
            # Use samples[i-1] (last lit sample) as a conservative end.
            window_end = samples[i - 1]
            if window_start is not None:
                windows.append((window_start, window_end))
                window_start = None

    # Handle the case where the sun is still up at the last sample.
    if in_window and window_start is not None:
        windows.append((window_start, samples[-1]))

    return windows


def compute_sun_path_today(
    lat: float,
    lng: float,
    reference_date: date,
    interval_minutes: int = 30,
) -> list[SunPosition]:
    """
    Compute the sun's position at regular intervals throughout *reference_date*.

    Only positions where the sun is above the horizon are returned.

    Parameters
    ----------
    lat : float
        Latitude in decimal degrees.
    lng : float
        Longitude in decimal degrees.
    reference_date : date
        Calendar date to evaluate.
    interval_minutes : int
        Sampling interval in minutes (default 30).

    Returns
    -------
    list[SunPosition]
        Ordered list of solar positions (UTC timestamps) where altitude > 0°.
    """
    tz = ZoneInfo(PALMA_TZ)

    day_start = datetime(
        reference_date.year,
        reference_date.month,
        reference_date.day,
        0,
        0,
        0,
        tzinfo=tz,
    )

    positions: list[SunPosition] = []
    cursor = day_start
    end = day_start + timedelta(hours=24)

    while cursor < end:
        pos = get_sun_position(lat, lng, cursor)
        if pos.altitude_deg > 0.0:
            positions.append(pos)
        cursor += timedelta(minutes=interval_minutes)

    return positions
