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

    sequence: 2,

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

    sequence: 3,

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

    sequence: 4,

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

  previousStationCode:
    "LKO",

  previousStationSequence:
    1,

  nextStation:
    "NDLS",

  nextStationCode:
    "NDLS",

  nextStationSequence:
    3,

  currentSequence:
    2,

  isActualPosition:
    true,

  isDiverted:
    false,

  segmentProgress:
    0.5,

  speedKmh:
    60,

  delayMinutes:
    24,

  latitude:
    null,

  longitude:
    null,

  observedAt:
    new Date(
      "2026-08-14T06:30:00.000Z"
    ),

  destinationLiveType:
    null,

  destinationLiveExpectedArrival:
    null,

  destinationLiveExpectedDeparture:
    null,

  destinationLiveDelayMinutes:
    null,

  stops:
    baseStops,

  exceptions:
    [],
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
      "uses destination delay when provider expected arrival points to wrong occurrence",
      () => {
        const stop = {
          ...baseStops[1]!,

          expectedArrival:
            "2026-08-15T10:27:00+05:30",

          scheduledArrival:
            "2026-08-14T12:27:00+05:30",

          delayMinutes:
            24,
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

          delayMinutes:
            null,
        };

        const eta =
          destinationEta(
            stop,
            {
              ...liveTrain,

              delayMinutes:
                24,
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

          delayMinutes:
            -20,
        };

        const eta =
          destinationEta(
            stop,
            {
              ...liveTrain,

              delayMinutes:
                -20,
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
      "does not mark destination reached from route position alone",
      () => {
        /*
         * Current train position is AFTER NDLS.
         *
         * However, NDLS has:
         *   - no actual arrival
         *   - no actual departure
         *   - upcoming status
         *
         * Therefore route position alone must NOT complete
         * the destination.
         */
        const trainAfterDestination = {
          ...liveTrain,

          currentStation:
            "PNBE",

          currentStationCode:
            "PNBE",

          currentSequence:
            4,

          previousStation:
            "NDLS",

          previousStationCode:
            "NDLS",

          previousStationSequence:
            3,

          nextStation:
            null,

          nextStationCode:
            null,

          nextStationSequence:
            null,

          destinationLiveType:
            null,

          stops:
            baseStops.map(
              (stop) =>
                stop.stationCode ===
                "NDLS"
                  ? {
                      ...stop,

                      actualArrival:
                        null,

                      actualDeparture:
                        null,

                      status:
                        "upcoming",

                      expectedArrival:
                        "2026-08-14T14:24:00+05:30",

                      /*
                       * Keep the delay consistent with
                       * the expected ETA so this test
                       * isolates route-position logic.
                       */
                      delayMinutes:
                        24,
                    }
                  : stop
            ),
        };

        const destination =
          trainAfterDestination
            .stops
            .find(
              (stop) =>
                stop.stationCode ===
                "NDLS"
            )!;

        const eta =
          destinationEta(
            destination,
            trainAfterDestination,
            new Date(
              "2026-08-14T13:00:00+05:30"
            )
          );

        /*
         * 14:24 IST = 08:54 UTC.
         */
        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T08:54:00.000Z"
        );
      }
    );

    it(
      "uses scheduled arrival plus delay when provider ETA is stale",
      () => {
        const stop = {
          ...baseStops[2]!,

          scheduledArrival:
            "2026-08-14T13:00:00+05:30",

          expectedArrival:
            "2026-08-14T12:33:00+05:30",

          actualArrival:
            null,

          actualDeparture:
            null,

          status:
            "upcoming",

          delayMinutes:
            25,
        };

        const train = {
          ...liveTrain,

          currentStation:
            "GZB",

          currentStationCode:
            "GZB",

          currentSequence:
            2,

          nextStation:
            "NDLS",

          nextStationCode:
            "NDLS",

          destinationLiveType:
            null,

          destinationLiveExpectedArrival:
            null,

          destinationLiveExpectedDeparture:
            null,

          destinationLiveDelayMinutes:
            null,

          stops: [
            baseStops[0]!,
            baseStops[1]!,
            stop,
            baseStops[3]!,
          ],
        };

        const eta =
          destinationEta(
            stop,
            train,
            new Date(
              "2026-08-14T12:41:00+05:30"
            )
          );

        /*
         * 13:00 + 25 min = 13:25 IST
         * 13:25 IST = 07:55 UTC.
         */
        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:55:00.000Z"
        );
      }
    );

    it(
      "uses station live board upcoming ETA over stale train ETA",
      () => {
        const stop = {
          ...baseStops[2]!,

          scheduledArrival:
            "2026-08-14T13:00:00+05:30",

          expectedArrival:
            "2026-08-14T12:20:00+05:30",

          actualArrival:
            null,

          actualDeparture:
            null,

          status:
            "upcoming",

          delayMinutes:
            10,
        };

        const train = {
          ...liveTrain,

          currentStation:
            "GZB",

          currentStationCode:
            "GZB",

          currentSequence:
            2,

          destinationLiveType:
            "upcoming" as const,

          destinationLiveExpectedArrival:
            "2026-08-14T13:25:00+05:30",

          destinationLiveExpectedDeparture:
            "2026-08-14T13:27:00+05:30",

          destinationLiveDelayMinutes:
            25,

          stops: [
            baseStops[0]!,
            baseStops[1]!,
            stop,
            baseStops[3]!,
          ],
        };

        const eta =
          destinationEta(
            stop,
            train,
            new Date(
              "2026-08-14T12:30:00+05:30"
            )
          );

        /*
         * 13:25 IST = 07:55 UTC.
         */
        expect(
          eta.toISOString()
        ).toBe(
          "2026-08-14T07:55:00.000Z"
        );
      }
    );

    it(
      "does not mark destination reached when station board says upcoming",
      () => {
        const stop = {
          ...baseStops[1]!,

          actualArrival:
            null,

          actualDeparture:
            null,

          status:
            "upcoming",
        };

        const train = {
          ...liveTrain,

          destinationLiveType:
            "upcoming" as const,

          destinationLiveExpectedArrival:
            "2026-08-14T12:51:00+05:30",

          destinationLiveExpectedDeparture:
            "2026-08-14T12:53:00+05:30",

          destinationLiveDelayMinutes:
            24,

          stops:
            baseStops.map(
              (item) =>
                item.stationCode ===
                "GZB"
                  ? stop
                  : item
            ),
        };

        const eta =
          destinationEta(
            stop,
            train,
            new Date(
              "2026-08-14T12:00:00+05:30"
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
      "marks destination reached from actual departure",
      () => {
        const stop = {
          ...baseStops[1]!,

          actualArrival:
            "2026-08-14T12:35:00+05:30",

          actualDeparture:
            "2026-08-14T12:37:00+05:30",
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
      "validates route identity by station code",
      () => {
        expect(
          resolveDestination(
            liveTrain,
            "GZB"
          ).stationName
        ).toBe(
          "Ghaziabad"
        );
      }
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
      "rejects a cancelled train",
      () => {
        expect(() =>
          newJourney(
            "00000000-0000-0000-0000-000000000001",

            {
              ...liveTrain,

              status:
                "cancelled",
            },

            "GZB",

            new Date(
              "2026-08-14T06:30:00.000Z"
            )
          )
        ).toThrowError(
          expect.objectContaining({
            code:
              "TRAIN_CANCELLED",
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
        ).toBe(
          "active"
        );

        expect(
          journey.destinationStationCode
        ).toBe(
          "GZB"
        );

        expect(
          journey.currentEta
            ?.toISOString()
        ).toBe(
          "2026-08-14T07:21:00.000Z"
        );

        expect(
          journey.currentDelayMinutes
        ).toBe(
          24
        );

        expect(
          journey.scheduleVersion
        ).toBe(
          0
        );

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