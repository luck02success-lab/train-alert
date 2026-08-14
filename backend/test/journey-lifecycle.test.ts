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

const baseStops = [
  {
    stationCode: "LKO",
    stationName: "Lucknow",

    scheduledArrival:
      "2026-08-14T10:00:00+05:30",

    scheduledDeparture:
      "2026-08-14T10:05:00+05:30",

    expectedArrival:
      "2026-08-14T10:00:00+05:30",

    expectedDeparture:
      "2026-08-14T10:05:00+05:30",

    actualArrival: null,
    actualDeparture: null,

    delayMinutes: 0,

    status: "passed",
  },

  {
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
  },

  {
    stationCode: "NDLS",
    stationName: "New Delhi",

    scheduledArrival:
      "2026-08-14T14:00:00+05:30",

    scheduledDeparture:
      "2026-08-14T14:05:00+05:30",

    expectedArrival:
      "2026-08-14T14:24:00+05:30",

    expectedDeparture:
      "2026-08-14T14:29:00+05:30",

    actualArrival: null,
    actualDeparture: null,

    delayMinutes: 24,

    status: "upcoming",
  },

  {
    stationCode: "PNBE",
    stationName: "Patna Junction",

    scheduledArrival:
      "2026-08-14T18:00:00+05:30",

    scheduledDeparture:
      "2026-08-14T18:05:00+05:30",

    expectedArrival:
      "2026-08-14T18:24:00+05:30",

    expectedDeparture:
      "2026-08-14T18:29:00+05:30",

    actualArrival: null,
    actualDeparture: null,

    delayMinutes: 24,

    status: "upcoming",
  },
];

const liveTrain = {
  trainNumber: "12919",
  journeyDate: "2026-08-14",
  status:
    "running" as const,

  currentStation:
    "GZB",

  currentStationCode:
    "GZB",

  previousStation:
    "LKO",

  nextStation:
    "NDLS",

  delayMinutes: 24,

  latitude: null,
  longitude: null,

  observedAt:
    new Date(
      "2026-08-14T06:30:00.000Z"
    ),

  stops:
    baseStops,
};

describe(
  "journey lifecycle",
  () => {
    it(
      "uses expected arrival when it agrees with scheduled arrival plus delay",
      () => {
        const stop =
          baseStops[1]!;

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
      "uses current destination delay when provider expectedArrival points to wrong occurrence",
      () => {
        const stop = {
          ...baseStops[1]!,
          expectedArrival:
            "2026-08-15T10:27:00+05:30",
          scheduledArrival:
            "2026-08-14T12:27:00+05:30",
          delayMinutes: 24,
        };

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
      "falls back to train delay when destination delay is unavailable",
      () => {
        const stop = {
          ...baseStops[1]!,
          expectedArrival:
            "2026-08-15T10:27:00+05:30",
          delayMinutes: null,
        };

        const eta =
          destinationEta(
            stop,
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
        const stop = {
          ...baseStops[1]!,
          scheduledArrival:
            "2026-08-14T13:00:00+05:30",
          expectedArrival:
            "2026-08-14T12:40:00+05:30",
          delayMinutes: -20,
        };

        const eta =
          destinationEta(
            stop,
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
      "rejects destination already reached using actual arrival",
      () => {
        const stop = {
          ...baseStops[1]!,
          actualArrival:
            "2026-08-14T12:35:00+05:30",
        };

        expect(() =>
          destinationEta(
            stop,
            liveTrain,
            new Date(
              "2026-08-14T12:40:00+05:30"
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
      "rejects destination already passed using route position",
      () => {
        const trainAfterDestination = {
          ...liveTrain,

          currentStation:
            "PNBE",

          currentStationCode:
            "PNBE",

          previousStation:
            "NDLS",

          nextStation:
            null,

          stops:
            baseStops,
        };

        const destination =
          baseStops[2]!; // NDLS

        expect(() =>
          destinationEta(
            destination,
            trainAfterDestination,
            new Date(
              "2026-08-14T13:00:00+05:30"
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
      "rejects inconsistent future destination ETA instead of creating a stale journey",
      () => {
        const stop = {
          ...baseStops[2]!, // NDLS
          scheduledArrival:
            "2026-08-14T13:00:00+05:30",
          expectedArrival:
            "2026-08-14T12:33:00+05:30",
          delayMinutes: -27,
        };

        const train = {
          ...liveTrain,

          currentStation:
            "GZB",

          currentStationCode:
            "GZB",

          previousStation:
            "LKO",

          nextStation:
            "NDLS",

          delayMinutes: -27,

          stops: [
            baseStops[0]!,
            baseStops[1]!,
            stop,
            baseStops[3]!,
          ],
        };

        expect(() =>
          destinationEta(
            stop,
            train,
            new Date(
              "2026-08-14T12:41:00+05:30"
            )
          )
        ).toThrowError(
          expect.objectContaining({
            code:
              "DESTINATION_ETA_INCONSISTENT",
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
              status:
                "completed",
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
      "rejects a train with unknown status",
      () => {
        expect(() =>
          newJourney(
            "00000000-0000-0000-0000-000000000001",

            {
              ...liveTrain,
              status:
                "unknown",
            },

            "GZB",

            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          )
        ).toThrowError(
          expect.objectContaining({
            code:
              "TRAIN_STATUS_UNKNOWN",
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

        expect(
          journey.alertOffsetsMinutes
        ).toEqual([
          120,
          60,
          30,
          15,
        ]);
      }
    );
  }
);