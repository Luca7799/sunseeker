"""
Pydantic models for the Sunseeker solar calculation microservice.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class SunlightStatus(str, Enum):
    """High-level sunlight state at a venue."""

    direct_sun = "direct_sun"
    likely_sun = "likely_sun"
    likely_shade = "likely_shade"
    shade = "shade"
    unknown = "unknown"
    night = "night"


class ConfidenceLabel(str, Enum):
    """Human-readable confidence tier."""

    confirmed = "confirmed"
    high = "high"
    medium = "medium"
    low = "low"
    unknown = "unknown"


# ---------------------------------------------------------------------------
# Core domain models
# ---------------------------------------------------------------------------


class VenuePoint(BaseModel):
    """Minimal location record for a venue."""

    lat: float = Field(..., description="Latitude in decimal degrees (WGS-84)")
    lng: float = Field(..., description="Longitude in decimal degrees (WGS-84)")
    venue_id: str = Field(..., description="Unique identifier for the venue")
    zone_id: Optional[str] = Field(
        None, description="Optional zone / neighbourhood identifier"
    )


class Building(BaseModel):
    """A building that may cast a shadow over a venue."""

    osm_id: str = Field(..., description="OpenStreetMap element identifier")
    height_meters: Optional[float] = Field(
        None, description="Measured or tagged building height in metres"
    )
    estimated_height_meters: Optional[float] = Field(
        None,
        description=(
            "Estimated height derived from OSM 'building:levels' tag "
            "(levels * 3.0 m per floor)"
        ),
    )
    data_quality: str = Field(
        "unknown",
        description=(
            "One of: 'actual' (tagged height), 'levels' (derived from levels), "
            "'default' (fallback), 'unknown'"
        ),
    )
    footprint_geojson: dict[str, Any] = Field(
        ...,
        description=(
            "GeoJSON Polygon or MultiPolygon representing the building footprint "
            "in WGS-84 coordinates"
        ),
    )


class SunPosition(BaseModel):
    """Solar position at a specific moment and location."""

    altitude_deg: float = Field(
        ..., description="Solar altitude angle above the horizon in degrees"
    )
    azimuth_deg: float = Field(
        ...,
        description=(
            "Solar azimuth angle measured clockwise from North in degrees [0, 360)"
        ),
    )
    timestamp: datetime = Field(
        ..., description="UTC datetime for which the position was computed"
    )


# ---------------------------------------------------------------------------
# Result model
# ---------------------------------------------------------------------------


class SunlightResult(BaseModel):
    """
    Full sunlight availability result for a single venue at a single moment.

    Time-window fields are optional because they are only populated by the
    /sunlight/windows endpoint, not the point-in-time /sunlight/compute
    endpoint.
    """

    # --- Core status ---
    sunlight_status: SunlightStatus = Field(
        ..., description="Primary sunlight classification"
    )

    # --- Confidence ---
    confidence_label: ConfidenceLabel = Field(
        ..., description="Human-readable confidence tier"
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Numeric confidence in [0.0, 1.0]",
    )

    # --- Time windows (populated by /sunlight/windows) ---
    sun_remaining_minutes: Optional[int] = Field(
        None,
        description=(
            "Continuous minutes of direct sun remaining from the query timestamp"
        ),
    )
    next_sunny_window_start: Optional[datetime] = Field(
        None, description="Start of the next sunny window today"
    )
    next_sunny_window_end: Optional[datetime] = Field(
        None, description="End of the next sunny window today"
    )
    best_window_start: Optional[datetime] = Field(
        None, description="Start of the longest sunny window today"
    )
    best_window_end: Optional[datetime] = Field(
        None, description="End of the longest sunny window today"
    )
    best_window_duration_minutes: Optional[int] = Field(
        None, description="Duration in minutes of the longest sunny window today"
    )

    # --- Shadow / obstruction metadata ---
    buildings_checked: int = Field(
        0, description="Number of buildings evaluated for shadow casting"
    )
    obstruction_building_id: Optional[str] = Field(
        None,
        description=(
            "OSM ID of the building whose shadow falls on the venue, if any"
        ),
    )

    # --- Confidence factor breakdown ---
    confidence_factors: dict[str, float] = Field(
        default_factory=dict,
        description="Per-factor confidence scores used to derive the final score",
    )


# ---------------------------------------------------------------------------
# Batch request / response
# ---------------------------------------------------------------------------


class VenueBatchItem(BaseModel):
    """A single venue entry inside a batch request."""

    lat: float
    lng: float
    venue_id: str
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


class BatchSunlightRequest(BaseModel):
    """Request body for the /sunlight/batch endpoint."""

    venues: list[VenueBatchItem] = Field(
        ..., description="List of venues to evaluate"
    )
    timestamp: datetime = Field(
        ..., description="Evaluation timestamp (timezone-aware)"
    )


class BatchSunlightResponse(BaseModel):
    """Response body for the /sunlight/batch endpoint."""

    results: list[SunlightResult] = Field(
        ..., description="One result per venue in the same order as the request"
    )
    evaluated_at: datetime = Field(
        ..., description="Server-side timestamp when the batch was processed"
    )
    venue_ids: list[str] = Field(
        ..., description="Venue IDs in the same order as results"
    )
