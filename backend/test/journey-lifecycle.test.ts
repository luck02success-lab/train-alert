import {
  describe,
  expect,
  it,
} from "vitest";

import {
  destinationEta,
  resolveDestination,
  canTransition,
  newJourney,
} from "../src/journey-lifecycle.js";

const stop = {
  stationCode: "GZB",
  stationName: "Ghaziabad",

  scheduledArrival:
    "2026-08-14T12:27:00+05:30",

  scheduledDeparture:
    "2026-08-14T12:29:00+05:30",

  expectedArrival:
    "2026-08-14T12:51:00+05:30",

  expectedDeparture:
    "2026-08-14T12:53:00+05:30",

  actualArrival: null,
  actualDeparture: null,

  delayMinutes: 24,

  status: "upcoming",
};

const liveTrain = {
  trainNumber: "12203",
  journeyDate: "2026-08-14",
  status:
    "running" as const,

  currentStation:
    "Hapur Junction",

  currentStationCode:
    "HZD",

  previousStation:
    "HZD",

  nextStation:
    "GZB",

  delayMinutes: 24,

  latitude: null,
  longitude: null,

  observedAt:
    new Date(
      "2026-08-14T07:00:00.000Z"
    ),

  stops: [
    stop,
  ],
};

describe(
  "journey lifecycle",
  () => {
    it(
      "uses expected arrival when it agrees with scheduled arrival plus delay",
      () => {
        const eta =
          destinationEta(
            stop,
            liveTrain,
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          );

        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:21:00.000Z"
        );
      }
    );

    it(
      "uses the current destination delay when provider expectedArrival points to the wrong occurrence",
      () => {
        const malformedStop = {
          ...stop,
          expectedArrival:
            "2026-08-15T10:27:00+05:30",
          scheduledArrival:
            "2026-08-14T12:27:00+05:30",
          delayMinutes: 24,
        };

        const eta =
          destinationEta(
            malformedStop,
            liveTrain,
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          );

        /*
         * 12:27 + 24 min = 12:51 IST
         * = 07:21 UTC
         */
        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:21:00.000Z"
        );
      }
    );

    it(
      "falls back to train delay when destination delay is unavailable",
      () => {
        const noStopDelay = {
          ...stop,
          expectedArrival:
            "2026-08-15T10:27:00+05:30",
          delayMinutes: null,
        };

        const eta =
          destinationEta(
            noStopDelay,
            {
              ...liveTrain,
              delayMinutes: 24,
            },
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          );

        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:21:00.000Z"
        );
      }
    );

    it(
      "supports an early train",
      () => {
        const earlyStop = {
          ...stop,
          scheduledArrival:
            "2026-08-14T13:00:00+05:30",
          expectedArrival:
            "2026-08-14T12:40:00+05:30",
          delayMinutes: -20,
        };

        const eta =
          destinationEta(
            earlyStop,
            {
              ...liveTrain,
              delayMinutes: -20,
            },
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          );

        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:10:00.000Z"
        );
      }
    );

    it(
      "rejects destination already reached",
      () => {
        const reachedStop = {
          ...stop,
          actualArrival:
            "2026-08-14T07:15:00+05:30",
        };

        expect(() =>
          destinationEta(
            reachedStop,
            liveTrain,
            new Date(
              "2026-08-14T02:30:00.000Z"
            )
          )
        ).toThrowError(
          expect.objectContaining({
            code:
              "DESTINATION_ALREADY_REACHED",
          })
        );
      }
    );

    it(
      "validates route identity by station code",
      () =>
        expect(
          resolveDestination(
            liveTrain,
            "GZB"
          ).stationName
        ).toBe(
          "Ghaziabad"
        )
    );

    it(
      "allows only documented state transitions",
      () => {
        expect(
          canTransition(
            "scheduled",
            "cancelled"
          )
        ).toBe(true);

        expect(
          canTransition(
            "completed",
            "cancelled"
          )
        ).toBe(false);
      }
    );

    it(
      "rejects a completed train",
      () => {
        expect(() =>
          newJourney(
            "00000000-0000-0000-0000-000000000001",
            {
              ...liveTrain,
              status: "completed",
            },
            "GZB",
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          )
        ).toThrowError(
          expect.objectContaining({
            code:
              "TRAIN_COMPLETED",
          })
        );
      }
    );

    it(
      "creates an active journey for a running train",
      () => {
        const journey =
          newJourney(
            "00000000-0000-0000-0000-000000000001",
            liveTrain,
            "GZB",
            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          );

        expect(
          journey.state
        ).toBe("active");

        expect(
          journey.destinationStationCode
        ).toBe("GZB");

        expect(
          journey.currentEta
            ?.toISOString()
        ).toBe(
          "2026-08-14T07:21:00.000Z"
        );

        expect(
          journey.currentDelayMinutes
        ).toBe(24);

        expect(
          journey.scheduleVersion
        ).toBe(0);
      }
    );
  }
);