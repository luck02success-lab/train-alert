import { describe, expect, it } from "vitest";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "../src/domain.js";

import {
  planAlerts,
} from "../src/alert-engine.js";

const journey: Journey = {
  id: "journey-1",
  userId: "user-1",
  trainNumber: "12345",
  journeyDate: "2026-08-11",
  destinationStationCode: "NDLS",
  destinationStationName: "New Delhi",
  state: "active",
  providerState: "available",
  currentEta: new Date(
    "2026-08-11T18:00:00.000Z"
  ),
  currentDelayMinutes: null,
  lastProviderUpdateAt: null,
  scheduleVersion: 1,
};

describe("planAlerts", () => {
  it("creates alerts for every configured offset", () => {
    const alerts = planAlerts(journey);

    expect(alerts).toHaveLength(
      ALERT_OFFSETS_MINUTES.length
    );

    expect(
      alerts.map(
        (alert) => alert.offsetMinutes
      )
    ).toEqual(ALERT_OFFSETS_MINUTES);
  });

  it("calculates alert time from ETA", () => {
    const alerts = planAlerts(journey);

    const firstAlert = alerts[0];

    expect(firstAlert).toBeDefined();

    expect(
      firstAlert!.scheduledFor
    ).toEqual(
      new Date(
        "2026-08-11T16:00:00.000Z"
      )
    );
  });

  it("uses journey schedule version in the deterministic key", () => {
    const version3 = planAlerts({
      ...journey,
      scheduleVersion: 3,
    });

    const version4 = planAlerts({
      ...journey,
      scheduleVersion: 4,
    });

    expect(
      version3[0]!.deterministicKey
    ).toBe("journey-1:120:3");

    expect(
      version4[0]!.deterministicKey
    ).toBe("journey-1:120:4");

    expect(
      version3[0]!.deterministicKey
    ).not.toBe(
      version4[0]!.deterministicKey
    );

    expect(
      version3[0]!.deterministicKey
    ).not.toBe(
      version4[0]!.deterministicKey
    );
  });

  it("returns no alerts when ETA is missing", () => {
    const alerts = planAlerts({
      ...journey,
      currentEta: null,
    });

    expect(alerts).toEqual([]);
  });
});