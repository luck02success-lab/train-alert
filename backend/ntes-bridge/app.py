import os
import secrets

from fastapi import FastAPI, Header, HTTPException, Query

from ntes_bridge import live_status, station_live


app = FastAPI(
    title="Train Alert NTES Bridge",
    version="1.0.0",
)


def require_auth(authorization: str | None) -> None:
    expected = os.environ.get(
        "NTES_BRIDGE_API_KEY",
        "",
    ).strip()

    if not expected:
        raise HTTPException(
            status_code=503,
            detail="NTES bridge is not configured",
        )

    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    scheme, _, token = authorization.partition(" ")

    if (
        scheme.lower() != "bearer"
        or not token
        or not secrets.compare_digest(
            token,
            expected,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )


@app.get("/health")
def health():
    return {
        "ok": True,
        "provider": "ntes",
    }


@app.get("/live-status")
def get_live_status(
    trainNumber: str = Query(
        min_length=5,
        max_length=5,
    ),
    journeyDate: str = Query(
        min_length=10,
        max_length=10,
    ),
    authorization: str | None = Header(
        default=None,
    ),
):
    require_auth(authorization)

    if not trainNumber.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Invalid train number",
        )

    try:
        return live_status(
            trainNumber,
            journeyDate,
        )
    except LookupError:
        raise HTTPException(
            status_code=404,
            detail="Train not found",
        )
    except Exception as exc:
        print(
            "NTES live-status error:",
            repr(exc),
            flush=True,
        )
        raise HTTPException(
            status_code=503,
            detail="NTES provider unavailable",
        )


@app.get("/station-live")
def get_station_live(
    stationCode: str = Query(
        min_length=2,
        max_length=8,
    ),
    hoursAhead: int = Query(
        default=4,
        ge=1,
        le=8,
    ),
    authorization: str | None = Header(
        default=None,
    ),
):
    require_auth(authorization)

    try:
        return station_live(
            stationCode.upper(),
            hoursAhead,
        )
    except Exception as exc:
        print(
            "NTES station-live error:",
            repr(exc),
            flush=True,
        )
        raise HTTPException(
            status_code=503,
            detail="NTES provider unavailable",
        )