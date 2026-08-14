import { describe, expect, it } from "vitest";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "../src/domain.js";

import {
  planAlerts,
} from "../src/alert-engine.js";

const now =
  new Date(
    "2026-08-14T10:00:00.000Z"
  );

const journey: Journey = {
  id: "journey-1",
  userId: "user-1",
  trainNumber: "12345",
  journeyDate: "2026-08-14",
  destinationStationCode: "NDLS",
  destinationStationName: "New Delhi",
  state: "active",
  providerState: "available",
  currentEta:
    new Date(
      "2026-08-14T14:00:00.000Z"
    ),
  currentDelayMinutes: null,
  lastProviderUpdateAt: null,
  scheduleVersion: 1,
  alertOffsetsMinutes: [
    ...ALERT_OFFSETS_MINUTES,
  ],
};

describe(
  "planAlerts",
  () => {
    it(
      "creates alerts for all configured future offsets",
      () => {
        const alerts =
          planAlerts(
            journey,
            now
          );

        expect(alerts).toHaveLength(
          ALERT_OFFSETS_MINUTES.length
        );

        expect(
          alerts.map(
            (alert) =>
              alert.offsetMinutes
          )
        ).toEqual(
          [120, 60, 30, 15]
        );
      }
    );

    it(
      "calculates alert time from ETA",
      () => {
        const alerts =
          planAlerts(
            journey,
            now
          );

        const firstAlert =
          alerts.find(
            (alert) =>
              alert.offsetMinutes ===
              120
          );

        expect(
          firstAlert
        ).toBeDefined();

        expect(
          firstAlert!.scheduledFor
        ).toEqual(
          new Date(
            "2026-08-14T12:00:00.000Z"
          )
        );
      }
    );

    it(
      "uses journey schedule version in deterministic key",
      () => {
        const version3 =
          planAlerts(
            {
              ...journey,
              scheduleVersion: 3,
            },
            now
          );

        const version4 =
          planAlerts(
            {
              ...journey,
              scheduleVersion: 4,
            },
            now
          );

        expect(
          version3[0]!.deterministicKey
        ).toBe(
          "journey-1:120:3"
        );

        expect(
          version4[0]!.deterministicKey
        ).toBe(
          "journey-1:120:4"
        );

        expect(
          version3[0]!.deterministicKey
        ).not.toBe(
          version4[0]!.deterministicKey
        );
      }
    );

    it(
      "returns no alerts when ETA is missing",
      () => {
        const alerts =
          planAlerts(
            {
              ...journey,
              currentEta: null,
            },
            now
          );

        expect(
          alerts
        ).toEqual([]);
      }
    );

    it(
      "does not create alerts whose scheduled time has already passed",
      () => {
        const closeJourney: Journey = {
          ...journey,
          currentEta:
            new Date(
              "2026-08-14T10:20:00.000Z"
            ),
          alertOffsetsMinutes: [
            120,
            60,
            30,
            15,
          ],
        };

        const alerts =
          planAlerts(
            closeJourney,
            now
          );

        expect(
          alerts.map(
            (alert) =>
              alert.offsetMinutes
          )
        ).toEqual([15]);
      }
    );

    it(
      "returns no alert when ETA is within 15 minutes",
      () => {
        const closeJourney: Journey = {
          ...journey,
          currentEta:
            new Date(
              "2026-08-14T10:10:00.000Z"
            ),
        };

        const alerts =
          planAlerts(
            closeJourney,
            now
          );

        expect(
          alerts
        ).toEqual([]);
      }
    );

    it(
      "respects user-selected alert offsets",
      () => {
        const customJourney: Journey = {
          ...journey,
          alertOffsetsMinutes: [
            30,
            15,
          ],
        };

        const alerts =
          planAlerts(
            customJourney,
            now
          );

        expect(
          alerts.map(
            (alert) =>
              alert.offsetMinutes
          )
        ).toEqual([
          30,
          15,
        ]);
      }
    );

    it(
      "supports an empty alert preference list",
      () => {
        const customJourney: Journey = {
          ...journey,
          alertOffsetsMinutes: [],
        };

        const alerts =
          planAlerts(
            customJourney,
            now
          );

        expect(
          alerts
        ).toEqual([]);
      }
    );
  }
);