from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import json
import os

from ntes_bridge import live_status, station_live


def _authorized(handler: BaseHTTPRequestHandler) -> bool:
    expected = os.environ.get("NTES_BRIDGE_API_KEY", "").strip()

    return (
        bool(expected)
        and handler.headers.get("Authorization")
        == f"Bearer {expected}"
    )


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict):
        body = json.dumps(payload).encode("utf-8")

        self.send_response(status)
        self.send_header(
            "Content-Type",
            "application/json",
        )
        self.send_header(
            "Cache-Control",
            "no-store",
        )
        self.send_header(
            "Content-Length",
            str(len(body)),
        )
        self.end_headers()

        self.wfile.write(body)

    def do_GET(self):
        if not _authorized(self):
            self._json(
                401,
                {"error": "unauthorized"},
            )
            return

        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)

        # /health
        if parsed.path == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "provider": "ntes",
                },
            )
            return

        # /live-status
        if parsed.path == "/live-status":
            train_number = query.get(
                "trainNumber",
                [""],
            )[0].strip()

            journey_date = query.get(
                "journeyDate",
                [""],
            )[0].strip()

            if not (
                train_number.isdigit()
                and len(train_number) == 5
                and journey_date
            ):
                self._json(
                    400,
                    {
                        "error": "invalid_request",
                    },
                )
                return

            try:
                self._json(
                    200,
                    live_status(
                        train_number,
                        journey_date,
                    ),
                )

            except LookupError:
                self._json(
                    404,
                    {
                        "error": "train_not_found",
                    },
                )

            except Exception as exc:
                print(
                    "NTES live-status error:",
                    repr(exc),
                )

                self._json(
                    503,
                    {
                        "error": "provider_unavailable",
                    },
                )

            return

        # /station-live
        if parsed.path == "/station-live":
            station_code = query.get(
                "stationCode",
                [""],
            )[0].strip().upper()

            try:
                hours_ahead = int(
                    query.get(
                        "hoursAhead",
                        ["4"],
                    )[0]
                )
            except ValueError:
                hours_ahead = 4

            hours_ahead = max(
                1,
                min(hours_ahead, 8),
            )

            if not station_code:
                self._json(
                    400,
                    {
                        "error": "invalid_request",
                    },
                )
                return

            try:
                self._json(
                    200,
                    station_live(
                        station_code,
                        hours_ahead,
                    ),
                )

            except Exception as exc:
                print(
                    "NTES station-live error:",
                    repr(exc),
                )

                self._json(
                    503,
                    {
                        "error": "provider_unavailable",
                    },
                )

            return

        self._json(
            404,
            {
                "error": "not_found",
            },
        )
