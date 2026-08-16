from datetime import datetime, timedelta
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo
import re

from ntes import NTESClient


IST = ZoneInfo("Asia/Kolkata")
UTC = ZoneInfo("UTC")


def _client() -> NTESClient:
    return NTESClient(
        timeout=8,
        retries=1,
    )


def _string(value: Any):
    if value is None:
        return None

    value = str(value).strip()

    return value or None


def _number(value: Any):
    if value is None or isinstance(value, bool):
        return None

    if isinstance(value, (int, float)):
        return int(value)

    match = re.search(
        r"-?\d+",
        str(value),
    )

    return (
        int(match.group())
        if match
        else None
    )


def _delay(value: Any):
    raw = _string(value)

    if not raw:
        return None

    if raw.lower() in {
        "on time",
        "source",
        "destination",
        "ua",
        "**ua**",
    }:
        return 0

    return _number(raw)


def _ntes_date(journey_date: str) -> str:
    return datetime.strptime(
        journey_date,
        "%Y-%m-%d",
    ).strftime("%d-%b-%Y")


def _timestamp(
    journey_date: str,
    day: Any,
    clock: Any,
):
    clock = _string(clock)

    if not clock:
        return None

    if clock.lower() in {
        "source",
        "destination",
    }:
        return None

    match = re.fullmatch(
        r"(\d{1,2}):(\d{2})",
        clock,
    )

    if not match:
        return None

    try:
        base = datetime.strptime(
            journey_date,
            "%Y-%m-%d",
        ).replace(
            tzinfo=IST,
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        value = base + timedelta(
            days=max(
                1,
                int(_string(day) or "1"),
            ) - 1,
            hours=int(match.group(1)),
            minutes=int(match.group(2)),
        )

        return (
            value
            .astimezone(UTC)
            .isoformat()
            .replace("+00:00", "Z")
        )

    except (
        ValueError,
        TypeError,
    ):
        return None


def _apply_delay(
    timestamp: str | None,
    delay_minutes: int | None,
):
    if not timestamp:
        return None

    try:
        value = datetime.fromisoformat(
            timestamp.replace(
                "Z",
                "+00:00",
            )
        )

        value += timedelta(
            minutes=delay_minutes or 0
        )

        return (
            value
            .astimezone(UTC)
            .isoformat()
            .replace("+00:00", "Z")
        )

    except ValueError:
        return timestamp


def _status(last_update: Any):
    raw = (
        _string(last_update)
        or ""
    )

    lowered = raw.lower()

    if "yet to start" in lowered:
        return "not-started"

    if "cancel" in lowered:
        return "cancelled"

    if "destination" in lowered:
        return "completed"

    return "running"


@lru_cache(maxsize=128)
def _schedule(
    train_number: str,
):
    return _client().schedule(
        train_number
    )


def live_status(
    train_number: str,
    journey_date: str,
):
    client = _client()

    ntes_date = _ntes_date(
        journey_date
    )

    status = client.live_status(
        train_number,
        ntes_date,
    )

    if not isinstance(
        status,
        dict,
    ):
        raise RuntimeError(
            "Malformed NTES live status"
        )

    schedule = _schedule(
        train_number
    )

    stations = schedule.get(
        "stations"
    )

    if not isinstance(
        stations,
        list,
    ) or not stations:
        raise RuntimeError(
            "NTES returned no schedule"
        )

    delay = _delay(
        status.get("DelayDep")
    )

    if delay is None:
        delay = _delay(
            status.get("DelayArr")
        )

    current_code = _string(
        status.get(
            "CurrentStation"
        )
    )

    current_name = _string(
        status.get(
            "CurrentStationName"
        )
    )

    next_code = _string(
        status.get(
            "NextStationCode"
        )
    )

    next_name = _string(
        status.get(
            "NextStationName"
        )
    )

    stops = []

    for sequence, station in enumerate(
        stations,
        1,
    ):
        if not isinstance(
            station,
            dict,
        ):
            continue

        station_code = (
            _string(
                station.get(
                    "StationCode"
                )
            )
            or ""
        )

        station_name = (
            _string(
                station.get(
                    "StationName"
                )
            )
            or station_code
        )

        arrival = _timestamp(
            journey_date,
            station.get("Day"),
            station.get("STA"),
        )

        departure = _timestamp(
            journey_date,
            station.get("Day"),
            station.get("STD"),
        )

        stop_status = "scheduled"

        if (
            next_code
            and station_code.upper()
            == next_code.upper()
        ):
            stop_status = "upcoming"

        if (
            current_code
            and station_code.upper()
            == current_code.upper()
        ):
            stop_status = "at-station"

        stops.append(
            {
                "sequence": sequence,
                "stationCode": station_code,
                "stationName": station_name,
                "scheduledArrival": arrival,
                "scheduledDeparture": departure,
                "expectedArrival": _apply_delay(
                    arrival,
                    delay,
                ),
                "expectedDeparture": _apply_delay(
                    departure,
                    delay,
                ),
                "actualArrival": None,
                "actualDeparture": None,
                "delayMinutes": delay,
                "status": stop_status,
                "isHalt": True,
                "distance": _number(
                    station.get(
                        "Distance"
                    )
                ),
                "speedToNextStationKmph": None,
                "platform": _string(
                    station.get(
                        "Platform"
                    )
                ),
            }
        )

    current_sequence = next(
        (
            stop["sequence"]
            for stop in stops
            if (
                current_code
                and stop["stationCode"].upper()
                == current_code.upper()
            )
        ),
        None,
    )

    previous = None

    if (
        current_sequence
        and current_sequence > 1
    ):
        previous = stops[
            current_sequence - 2
        ]

    return {
        "trainNumber": (
            _string(
                status.get(
                    "TrainNo"
                )
            )
            or train_number
        ),
        "trainName": (
            _string(
                status.get(
                    "TrainName"
                )
            )
            or _string(
                schedule.get(
                    "TrainName"
                )
            )
        ),
        "journeyDate": journey_date,
        "status": _status(
            status.get(
                "LastUpdate"
            )
        ),
        "currentStation": (
            current_name
            or current_code
        ),
        "currentStationCode": current_code,
        "previousStation": (
            previous["stationName"]
            if previous
            else None
        ),
        "previousStationCode": (
            previous["stationCode"]
            if previous
            else None
        ),
        "previousStationSequence": (
            previous["sequence"]
            if previous
            else None
        ),
        "nextStation": next_name,
        "nextStationCode": next_code,
        "nextStationSequence": (
            current_sequence + 1
            if current_sequence
            and current_sequence < len(stops)
            else None
        ),
        "currentSequence": current_sequence,
        "isActualPosition": bool(
            current_code
        ),
        "isDiverted": False,
        "segmentProgress": None,
        "speedKmh": None,
        "delayMinutes": delay,
        "latitude": None,
        "longitude": None,
        "observedAt": (
            datetime.now(UTC)
            .isoformat()
            .replace(
                "+00:00",
                "Z",
            )
        ),
        "stops": stops,
        "exceptions": [],
    }


def station_live(
    station_code: str,
    hours_ahead: int = 4,
):
    hours_ahead = max(
        1,
        min(
            int(hours_ahead),
            8,
        ),
    )

    data = _client().station_live(
        station_code.upper(),
        hours=hours_ahead,
    )

    if not isinstance(
        data,
        dict,
    ):
        raise RuntimeError(
            "Malformed NTES station board"
        )

    trains = []

    for raw in (
        data.get(
            "TrainsAtStation"
        )
        or []
    ):
        if not isinstance(
            raw,
            dict,
        ):
            continue

        train_number = _string(
            raw.get(
                "TrainNumber"
            )
        )

        if not train_number:
            continue

        trains.append(
            {
                "trainNumber": train_number,
                "trainName": _string(
                    raw.get(
                        "TrainName"
                    )
                ),
                "status": "upcoming",
                "sequence": None,
                "expectedArrivalTime": _string(
                    raw.get("ETA")
                ),
                "expectedDepartureTime": _string(
                    raw.get("ETD")
                ),
                "delayMinutes": (
                    _delay(
                        raw.get(
                            "DelayArr"
                        )
                    )
                    or _delay(
                        raw.get(
                            "DelayDep"
                        )
                    )
                ),
                "platform": _string(
                    raw.get(
                        "Platform"
                    )
                ),
            }
        )

    return {
        "stationCode": station_code.upper(),
        "stationName": station_code.upper(),
        "trains": trains,
    }