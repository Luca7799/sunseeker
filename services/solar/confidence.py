"""
Confidence scoring module for the Sunseeker solar microservice.

Confidence reflects how certain we are about the computed sunlight status.
It is a weighted combination of five independent factors:

Factor                  Weight   Description
---------------------   ------   ------------------------------------------
sun_altitude_factor     0.35     How high the sun is above the horizon.
building_data_factor    0.35     Quality of the building height / footprint data.
outdoor_seating_factor  0.15     Certainty that the venue has outdoor seating.
venue_geometry_factor   0.10     Whether we have a terrace polygon or only a point.
user_correction_factor  0.05     Recent crowd-sourced corrections (additive delta).

The raw weighted sum is clamped to [0.0, 1.0] and then mapped to a label:

  score >= 0.75  →  confirmed
  score >= 0.55  →  high
  score >= 0.35  →  medium
  score >= 0.15  →  low
  score <  0.15  →  unknown
"""

from __future__ import annotations

from typing import Optional

from models import Building, ConfidenceLabel

# ---------------------------------------------------------------------------
# Weight configuration
# ---------------------------------------------------------------------------

WEIGHTS: dict[str, float] = {
    "sun_altitude": 0.35,
    "building_data": 0.35,
    "outdoor_seating": 0.15,
    "venue_geometry": 0.10,
    "user_corrections": 0.05,
}

# Sanity-check: weights must sum to 1.0 (excluding the additive correction term).
assert abs(sum(v for k, v in WEIGHTS.items() if k != "user_corrections") - 0.95) < 1e-9, (
    "Non-correction weights must sum to 0.95 (leaving 0.05 for corrections)."
)

# ---------------------------------------------------------------------------
# Factor calculators
# ---------------------------------------------------------------------------


def _sun_altitude_factor(sun_altitude_deg: float) -> float:
    """
    Score the reliability of the sun position itself.

    At very low altitudes the sun's rays are nearly horizontal; small errors
    in building height or position have an outsized effect on whether a shadow
    falls on the venue.

    Returns
    -------
    float
        0.0 to 1.0
    """
    if sun_altitude_deg >= 20.0:
        return 1.0
    if sun_altitude_deg >= 10.0:
        return 0.7
    if sun_altitude_deg >= 5.0:
        return 0.4
    if sun_altitude_deg >= 3.0:
        return 0.2
    # Below 3° is effectively the MIN_USEFUL_ALTITUDE threshold.
    return 0.0


def _building_data_factor(buildings_near: list[Building]) -> float:
    """
    Score the quality of the building data available for shadow casting.

    Rules (evaluated in priority order):
    - No buildings within the search radius → 0.5 (open area, probably sunny).
    - At least one building with a real height tag → 1.0.
    - At least one building with levels data (estimated height) → 0.7.
    - Buildings exist but none have any height data → 0.3.

    Returns
    -------
    float
        0.0 to 1.0
    """
    if not buildings_near:
        # No nearby buildings – likely an open plaza or seafront terrace.
        # We are fairly confident it is sunny, but we have not confirmed it.
        return 0.5

    has_actual = any(b.data_quality == "actual" for b in buildings_near)
    has_levels = any(b.data_quality == "levels" for b in buildings_near)

    if has_actual:
        return 1.0
    if has_levels:
        return 0.7
    return 0.3


def _outdoor_seating_factor(outdoor_seating_status: str) -> float:
    """
    Score certainty that the venue actually has outdoor seating.

    If the venue has no outdoor seating, sunlight availability is irrelevant.
    We capture uncertainty about this as a confidence penalty.

    Parameters
    ----------
    outdoor_seating_status : str
        One of ``'confirmed'``, ``'inferred'``, ``'unknown'``.

    Returns
    -------
    float
        0.0 to 1.0
    """
    mapping: dict[str, float] = {
        "confirmed": 1.0,
        "inferred": 0.6,
        "unknown": 0.3,
    }
    return mapping.get(outdoor_seating_status.lower(), 0.3)


def _venue_geometry_factor(has_terrace_geometry: bool) -> float:
    """
    Score how precisely we know where the terrace is.

    A venue with a polygon terrace geometry allows us to test whether the
    *terrace area* is in shadow, rather than just a single centroid point.

    Returns
    -------
    float
        1.0 if polygon available, 0.7 if centroid only.
    """
    return 1.0 if has_terrace_geometry else 0.7


def _user_correction_delta(user_corrections_agree: Optional[bool]) -> float:
    """
    Additive delta from crowd-sourced user corrections.

    This is applied *after* the weighted sum and is intentionally small so
    user corrections cannot dominate the result.

    Parameters
    ----------
    user_corrections_agree : Optional[bool]
        True  → recent corrections support the computed result.
        False → recent corrections contradict the computed result.
        None  → no corrections available.

    Returns
    -------
    float
        +0.2, -0.3, or 0.0
    """
    if user_corrections_agree is True:
        return 0.2
    if user_corrections_agree is False:
        return -0.3
    return 0.0


# ---------------------------------------------------------------------------
# Label mapping
# ---------------------------------------------------------------------------


def _score_to_label(score: float) -> ConfidenceLabel:
    """
    Map a numeric confidence score to a :class:`ConfidenceLabel`.

    Thresholds
    ----------
    >= 0.75  →  confirmed
    >= 0.55  →  high
    >= 0.35  →  medium
    >= 0.15  →  low
    <  0.15  →  unknown
    """
    if score >= 0.75:
        return ConfidenceLabel.confirmed
    if score >= 0.55:
        return ConfidenceLabel.high
    if score >= 0.35:
        return ConfidenceLabel.medium
    if score >= 0.15:
        return ConfidenceLabel.low
    return ConfidenceLabel.unknown


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_confidence(
    sun_altitude_deg: float,
    buildings_near: list[Building],
    outdoor_seating_status: str,
    has_terrace_geometry: bool,
    user_corrections_agree: Optional[bool] = None,
) -> tuple[ConfidenceLabel, float, dict[str, float]]:
    """
    Compute the confidence label, score, and per-factor breakdown for a
    sunlight result.

    Parameters
    ----------
    sun_altitude_deg : float
        Solar altitude above the horizon in degrees at the evaluation time.
    buildings_near : list[Building]
        Buildings within the shadow-search radius (may be empty).
    outdoor_seating_status : str
        Certainty about outdoor seating: ``'confirmed'``, ``'inferred'``,
        or ``'unknown'``.
    has_terrace_geometry : bool
        True if the venue has a polygon geometry for its terrace area.
    user_corrections_agree : Optional[bool]
        True if recent crowd-sourced corrections support the computed result,
        False if they contradict it, None if no corrections exist.

    Returns
    -------
    tuple[ConfidenceLabel, float, dict[str, float]]
        - ``label``   : Human-readable confidence tier.
        - ``score``   : Numeric score in [0.0, 1.0].
        - ``factors`` : Dictionary with the raw value of each factor
                        (before weighting) for debugging / transparency.
    """
    # --- Compute raw factor values ---
    f_altitude = _sun_altitude_factor(sun_altitude_deg)
    f_building = _building_data_factor(buildings_near)
    f_seating = _outdoor_seating_factor(outdoor_seating_status)
    f_geometry = _venue_geometry_factor(has_terrace_geometry)
    correction_delta = _user_correction_delta(user_corrections_agree)

    factors: dict[str, float] = {
        "sun_altitude_factor": f_altitude,
        "building_data_factor": f_building,
        "outdoor_seating_factor": f_seating,
        "venue_geometry_factor": f_geometry,
        "user_correction_delta": correction_delta,
    }

    # --- Weighted sum (excluding the additive correction term) ---
    weighted_sum = (
        f_altitude * WEIGHTS["sun_altitude"]
        + f_building * WEIGHTS["building_data"]
        + f_seating * WEIGHTS["outdoor_seating"]
        + f_geometry * WEIGHTS["venue_geometry"]
    )

    # The user correction term is added as a flat delta (scaled by its weight).
    # We scale the raw ±delta by the weight so the maximum possible contribution
    # matches the declared weight of the factor.
    weighted_sum += correction_delta * WEIGHTS["user_corrections"]

    # --- Clamp to [0.0, 1.0] ---
    score = max(0.0, min(1.0, weighted_sum))

    label = _score_to_label(score)

    return label, round(score, 4), factors
