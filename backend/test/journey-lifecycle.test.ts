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
  stationCode: "NDLS",
  stationName: "New Delhi",

  scheduledArrival:
    "2026-08-11T10:00:00+05:30",

  scheduledDeparture: null,

  expectedArrival:
    "2026-08-11T10:30:00+05:30",

  expectedDeparture: null,

  actualArrival: null,
  actualDeparture: null,

  delayMinutes: 30,
  status: "upcoming",
};

const liveTrain = {
  trainNumber: "12919",
  journeyDate: "2026-08-11",
  status: "running" as const,

  currentStation: null,
  currentStationCode: null,

  previousStation: null,
  nextStation: null,

  delayMinutes: null,

  latitude: null,
  longitude: null,

  stops: [stop],
};

describe("journey lifecycle", () => {
  it(
    "uses expected arrival as an absolute instant",
    () =>
      expect(
        destinationEta(stop).toISOString()
      ).toBe(
        "2026-08-11T05:00:00.000Z"
      )
  );

  it(
    "validates route identity by station code",
    () =>
      expect(
        resolveDestination(
          liveTrain,
          "NDLS"
        ).stationName
      ).toBe("New Delhi")
  );

  it("allows only documented state transitions", () => {
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
  });

  it("rejects a completed train", () => {
    expect(() =>
      newJourney(
        "00000000-0000-0000-0000-000000000001",
        {
          ...liveTrain,
          status: "completed",
        },
        "NDLS"
      )
    ).toThrowError(
      expect.objectContaining({
        code: "TRAIN_COMPLETED",
      })
    );
  });

  it("rejects a train with unknown status", () => {
    expect(() =>
      newJourney(
        "00000000-0000-0000-0000-000000000001",
        {
          ...liveTrain,
          status: "unknown",
        },
        "NDLS"
      )
    ).toThrowError(
      expect.objectContaining({
        code: "TRAIN_STATUS_UNKNOWN",
      })
    );
  });

  it("creates an active journey for a running train", () => {
    const journey = newJourney(
      "00000000-0000-0000-0000-000000000001",
      liveTrain,
      "NDLS"
    );

    expect(journey.state).toBe("active");

    expect(
      journey.destinationStationCode
    ).toBe("NDLS");

    expect(
      journey.currentEta?.toISOString()
    ).toBe(
      "2026-08-11T05:00:00.000Z"
    );

    expect(journey.scheduleVersion).toBe(0);
  });
});