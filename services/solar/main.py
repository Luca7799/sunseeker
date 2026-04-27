"""
Sunseeker – Solar Calculation Microservice
==========================================

FastAPI application exposing HTTP endpoints for computing direct sunlight
availability at venue locations using solar geometry and building shadow casting.

This service is internal-only (called by the Sunseeker Next.js backend) and
requires no authentication.  CORS is configured via the ALLOWED_ORIGINS
environment variable (defaults to * for MVP).

Endpoints
---------
GET  /health                – Liveness check.
POST /sunlight/compute      – Point-in-time sunlight status for one venue.
POST /sunlight/batch        – Point-in-time status for many venues.
POST /sunlight/windows      – Sun remaining + best windows for today.
GET  /sun-position          – Raw solar position at a given moment.
GET  /sun-path              – Solar path (every 30 min) for a given day.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timedelta
from typing import Any, Optional
from zoneinfo import ZoneInfo

import structlog
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from confidence import compute_confidence
from models import (
    BatchSunlightRequest,
    BatchSunlightResponse,
    Building,
    ConfidenceLabel,
    SunlightResult,
    SunlightStatus,
    SunPosition,
    VenueBatchItem,
)
from shadow_engine import compute_sunlight_at_time
from solar_engine import (
    PALMA_LAT,
    PALMA_LNG,
    PALMA_TZ,
    compute_sun_path_today,
    get_sun_position,
    get_todays_sun_windows,
)

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),  # INFO
)
log = structlog.get_logger("sunseeker.solar")

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

import os

ALLOWED_ORIGINS: list[str] = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app = FastAPI(
    title="Sunseeker Solar Service",
    description="Computes direct sunlight availability using solar geometry and building shadow casting.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request timing middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def add_process_time_header(request: Request, call_next) -> Response:
    """Attach X-Process-Time header (milliseconds) to every response."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Process-Time"] = f"{elapsed_ms:.2f}ms"
    log.debug(
        "request_handled",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        elapsed_ms=round(elapsed_ms, 2),
    )
    return response


# ---------------------------------------------------------------------------
# Request / response bodies for endpoints not covered by shared models
# ---------------------------------------------------------------------------


class ComputeRequest(BaseModel):
    """Request body for POST /sunlight/compute."""

    lat: float = Field(..., description="Venue latitude (WGS-84)")
    lng: float = Field(..., description="Venue longitude (WGS-84)")
    timestamp: datetime = Field(
        ..., description="Evaluation datetime (timezone-aware recommended)"
    )
    outdoor_seating_status: str = Field(
        "unknown",
        description="One of: 'confirmed', 'inferred', 'unknown'",
    )
    has_terrace_geometry: bool = Field(
        False,
        description="True if the venue has a polygon geometry for the terrace",
    )
    buildings: list[Building] = Field(
        default_factory=list,
        description="Nearby buildings pre-fetched by the caller",
    )
    user_corrections_agree: Optional[bool] = Field(
        None,
        description=(
            "True if recent user corrections agree with the computed result, "
            "False if they contradict it, None if no corrections exist"
        ),
    )


class WindowsRequest(BaseModel):
    """Request body for POST /sunlight/windows."""

    lat: float = Field(..., description="Venue latitude (WGS-84)")
    lng: float = Field(..., description="Venue longitude (WGS-84)")
    timestamp: datetime = Field(
        ..., description="Query datetime (timezone-aware recommended)"
    )
    buildings: list[Building] = Field(
        default_factory=list,
        description="Nearby buildings pre-fetched by the caller",
    )
    interval_minutes: int = Field(
        15,
        ge=1,
        le=60,
        description="Shadow check resolution in minutes",
    )
    outdoor_seating_status: str = Field("unknown")
    has_terrace_geometry: bool = Field(False)
    user_corrections_agree: Optional[bool] = Field(None)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _ensure_aware(dt: datetime) -> datetime:
    """Attach Europe/Madrid timezone to naive datetimes."""
    if dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=ZoneInfo(PALMA_TZ))


def _build_result(
    *,
    lat: float,
    lng: float,
    dt: datetime,
    buildings: list[Building],
    outdoor_seating_status: str,
    has_terrace_geometry: bool,
    user_corrections_agree: Optional[bool],
) -> SunlightResult:
    """
    Core helper: compute shadow status + confidence and return a SunlightResult.

    Time-window fields are NOT populated here; use the windows endpoint for that.
    """
    dt_aware = _ensure_aware(dt)

    # --- Shadow / sun status ---
    status, obstruction_id, buildings_checked = compute_sunlight_at_time(
        venue_lat=lat,
        venue_lng=lng,
        buildings=buildings,
        dt=dt_aware,
    )

    # --- Sun position for confidence scoring ---
    sun_pos = get_sun_position(lat, lng, dt_aware)

    # --- Confidence ---
    conf_label, conf_score, conf_factors = compute_confidence(
        sun_altitude_deg=sun_pos.altitude_deg,
        buildings_near=buildings,
        outdoor_seating_status=outdoor_seating_status,
        has_terrace_geometry=has_terrace_geometry,
        user_corrections_agree=user_corrections_agree,
    )

    return SunlightResult(
        sunlight_status=status,
        confidence_label=conf_label,
        confidence_score=conf_score,
        buildings_checked=buildings_checked,
        obstruction_building_id=obstruction_id,
        confidence_factors=conf_factors,
    )


def _compute_windows(
    *,
    lat: float,
    lng: float,
    dt: datetime,
    buildings: list[Building],
    interval_minutes: int,
) -> dict[str, Any]:
    """
    Iterate through remaining daylight today in *interval_minutes* steps and
    find:

    1. Continuous sun remaining from *dt* (sun_remaining_minutes).
    2. Next sunny window after *dt* if the venue is currently in shade.
    3. Best (longest) sunny window for the rest of today.

    Returns a dict with window-related fields to be merged into SunlightResult.
    """
    dt_aware = _ensure_aware(dt)
    utc = ZoneInfo("UTC")
    tz = ZoneInfo(PALMA_TZ)

    # Build the sampling grid from now until midnight (local time).
    today_local = dt_aware.astimezone(tz).date()
    midnight_local = datetime(
        today_local.year, today_local.month, today_local.day, 23, 59, 59, tzinfo=tz
    )

    samples: list[datetime] = []
    cursor = dt_aware
    while cursor <= midnight_local:
        samples.append(cursor)
        cursor += timedelta(minutes=interval_minutes)

    if not samples:
        return {}

    # Compute sunlight status for each sample.
    sample_status: list[bool] = []  # True = in sun, False = shade/night/unknown
    for sample in samples:
        st, _, _ = compute_sunlight_at_time(
            venue_lat=lat,
            venue_lng=lng,
            buildings=buildings,
            dt=sample,
        )
        sample_status.append(st == SunlightStatus.direct_sun)

    # ------------------------------------------------------------------
    # 1. Sun remaining from dt (continuous from the first sample)
    # ------------------------------------------------------------------
    sun_remaining_minutes: int = 0
    if sample_status[0]:
        for is_sun in sample_status:
            if is_sun:
                sun_remaining_minutes += interval_minutes
            else:
                break

    # ------------------------------------------------------------------
    # 2 & 3. Find all sunny windows in the remaining day
    # ------------------------------------------------------------------
    windows: list[tuple[datetime, datetime, int]] = []  # (start, end, duration_min)
    in_window = False
    win_start: Optional[datetime] = None

    for i, (sample, is_sun) in enumerate(zip(samples, sample_status)):
        if is_sun and not in_window:
            in_window = True
            win_start = sample
        elif not is_sun and in_window:
            in_window = False
            win_end = samples[i - 1]
            if win_start is not None:
                duration = (i - 1) * interval_minutes - samples.index(win_start) * interval_minutes
                # Recompute duration properly.
                idx_start = samples.index(win_start)
                duration = (i - 1 - idx_start + 1) * interval_minutes
                windows.append((win_start, win_end, duration))
                win_start = None

    # Handle window still open at end.
    if in_window and win_start is not None:
        idx_start = samples.index(win_start)
        win_end = samples[-1]
        duration = (len(samples) - 1 - idx_start + 1) * interval_minutes
        windows.append((win_start, win_end, duration))

    # Next sunny window: first window that starts after now (or starts now).
    next_window_start: Optional[datetime] = None
    next_window_end: Optional[datetime] = None

    if windows:
        # If currently in sun, the "next" window is the current one.
        if sample_status[0]:
            # The current window was already captured as windows[0].
            next_window_start = windows[0][0]
            next_window_end = windows[0][1]
        else:
            # Find the first window that starts strictly after now.
            for ws, we, _ in windows:
                if ws >= dt_aware:
                    next_window_start = ws
                    next_window_end = we
                    break

    # Best (longest) window.
    best_window_start: Optional[datetime] = None
    best_window_end: Optional[datetime] = None
    best_window_duration: Optional[int] = None

    if windows:
        best = max(windows, key=lambda w: w[2])
        best_window_start = best[0]
        best_window_end = best[1]
        best_window_duration = best[2]

    return {
        "sun_remaining_minutes": sun_remaining_minutes if sun_remaining_minutes > 0 else None,
        "next_sunny_window_start": next_window_start,
        "next_sunny_window_end": next_window_end,
        "best_window_start": best_window_start,
        "best_window_end": best_window_end,
        "best_window_duration_minutes": best_window_duration,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", tags=["Meta"])
async def health_check() -> dict[str, Any]:
    """Liveness probe – always returns 200 OK if the service is running."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}


# ------------------------------------------------------------------
# POST /sunlight/compute
# ------------------------------------------------------------------


@app.post("/sunlight/compute", response_model=SunlightResult, tags=["Sunlight"])
async def compute_sunlight(body: ComputeRequest) -> SunlightResult:
    """
    Compute point-in-time sunlight status for a single venue.

    The caller is responsible for providing pre-fetched nearby buildings.
    Time-window fields (``sun_remaining_minutes``, ``next_sunny_window_*``,
    ``best_window_*``) are not populated; use ``/sunlight/windows`` for those.
    """
    log.info(
        "compute_sunlight",
        lat=body.lat,
        lng=body.lng,
        timestamp=body.timestamp.isoformat(),
        n_buildings=len(body.buildings),
    )

    try:
        result = _build_result(
            lat=body.lat,
            lng=body.lng,
            dt=body.timestamp,
            buildings=body.buildings,
            outdoor_seating_status=body.outdoor_seating_status,
            has_terrace_geometry=body.has_terrace_geometry,
            user_corrections_agree=body.user_corrections_agree,
        )
    except Exception as exc:
        log.exception("compute_sunlight_error", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Internal computation error: {exc}") from exc

    return result


# ------------------------------------------------------------------
# POST /sunlight/batch
# ------------------------------------------------------------------


@app.post("/sunlight/batch", response_model=BatchSunlightResponse, tags=["Sunlight"])
async def batch_sunlight(body: BatchSunlightRequest) -> BatchSunlightResponse:
    """
    Compute point-in-time sunlight status for multiple venues at one timestamp.

    Venues are evaluated sequentially.  For high-volume scenarios, consider
    parallelising at the infrastructure layer (multiple service instances).
    """
    log.info(
        "batch_sunlight",
        n_venues=len(body.venues),
        timestamp=body.timestamp.isoformat(),
    )

    results: list[SunlightResult] = []
    venue_ids: list[str] = []

    for item in body.venues:
        venue_ids.append(item.venue_id)
        try:
            result = _build_result(
                lat=item.lat,
                lng=item.lng,
                dt=body.timestamp,
                buildings=item.buildings,
                outdoor_seating_status=item.outdoor_seating_status,
                has_terrace_geometry=item.has_terrace_geometry,
                user_corrections_agree=item.user_corrections_agree,
            )
        except Exception as exc:  # noqa: BLE001
            log.warning(
                "batch_item_error",
                venue_id=item.venue_id,
                error=str(exc),
            )
            # Return a degraded unknown result so the batch can continue.
            result = SunlightResult(
                sunlight_status=SunlightStatus.unknown,
                confidence_label=ConfidenceLabel.unknown,
                confidence_score=0.0,
                buildings_checked=0,
            )
        results.append(result)

    return BatchSunlightResponse(
        results=results,
        evaluated_at=datetime.utcnow().replace(tzinfo=ZoneInfo("UTC")),
        venue_ids=venue_ids,
    )


# ------------------------------------------------------------------
# POST /sunlight/windows
# ------------------------------------------------------------------


@app.post("/sunlight/windows", response_model=SunlightResult, tags=["Sunlight"])
async def sunlight_windows(body: WindowsRequest) -> SunlightResult:
    """
    Compute sunlight status plus time window information for a venue today.

    In addition to the standard status and confidence fields, the response
    includes:

    - ``sun_remaining_minutes`` – continuous sun from the query time.
    - ``next_sunny_window_start`` / ``next_sunny_window_end`` – the next
      uninterrupted sunny period today.
    - ``best_window_start`` / ``best_window_end`` / ``best_window_duration_minutes``
      – the longest sunny window remaining today.
    """
    log.info(
        "sunlight_windows",
        lat=body.lat,
        lng=body.lng,
        timestamp=body.timestamp.isoformat(),
        interval_minutes=body.interval_minutes,
        n_buildings=len(body.buildings),
    )

    dt_aware = _ensure_aware(body.timestamp)

    try:
        # Point-in-time result.
        base_result = _build_result(
            lat=body.lat,
            lng=body.lng,
            dt=dt_aware,
            buildings=body.buildings,
            outdoor_seating_status=body.outdoor_seating_status,
            has_terrace_geometry=body.has_terrace_geometry,
            user_corrections_agree=body.user_corrections_agree,
        )

        # Window analysis.
        window_fields = _compute_windows(
            lat=body.lat,
            lng=body.lng,
            dt=dt_aware,
            buildings=body.buildings,
            interval_minutes=body.interval_minutes,
        )
    except Exception as exc:
        log.exception("sunlight_windows_error", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Internal computation error: {exc}") from exc

    # Merge window fields into the base result.
    result_dict = base_result.model_dump()
    result_dict.update(window_fields)
    return SunlightResult(**result_dict)


# ------------------------------------------------------------------
# GET /sun-position
# ------------------------------------------------------------------


@app.get("/sun-position", response_model=SunPosition, tags=["Solar"])
async def sun_position_endpoint(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lng: float = Query(..., description="Longitude in decimal degrees"),
    timestamp: str = Query(
        ...,
        description="ISO-8601 datetime string (e.g. 2024-06-15T14:30:00+02:00)",
    ),
) -> SunPosition:
    """
    Return the solar altitude and azimuth for a given location and moment.
    """
    try:
        dt = datetime.fromisoformat(timestamp)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid timestamp format: {exc}",
        ) from exc

    dt_aware = _ensure_aware(dt)

    try:
        pos = get_sun_position(lat, lng, dt_aware)
    except Exception as exc:
        log.exception("sun_position_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return pos


# ------------------------------------------------------------------
# GET /sun-path
# ------------------------------------------------------------------


@app.get("/sun-path", response_model=list[SunPosition], tags=["Solar"])
async def sun_path_endpoint(
    lat: float = Query(..., description="Latitude in decimal degrees"),
    lng: float = Query(..., description="Longitude in decimal degrees"),
    date_str: str = Query(
        ...,
        alias="date",
        description="Calendar date in YYYY-MM-DD format",
    ),
    interval_minutes: int = Query(
        30,
        ge=1,
        le=60,
        description="Sampling interval in minutes (default 30)",
    ),
) -> list[SunPosition]:
    """
    Return the sun's path for a given location and calendar date.

    Only positions where the sun is above the horizon are returned.
    """
    try:
        ref_date = date.fromisoformat(date_str)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid date format (expected YYYY-MM-DD): {exc}",
        ) from exc

    try:
        path = compute_sun_path_today(lat, lng, ref_date, interval_minutes=interval_minutes)
    except Exception as exc:
        log.exception("sun_path_error", error=str(exc))
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return path


# ---------------------------------------------------------------------------
# Entry point (for local development only; production uses uvicorn CLI)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
