import {
  describe,
  expect,
  it,
} from "vitest";

import {
  planAlerts,
  needsNewSchedule,
} from "../src/alert-engine.js";

import type { Journey } from "../src/domain.js";

const journey: Journey = {
  id: "j",
  userId: "u",
  trainNumber: "12345",
  journeyDate: "2026-08-12",

  destinationStationCode:
    "NDLS",

  state: "active",
  providerState: "available",

  currentEta: new Date(
    "2026-08-12T19:07:00Z"
  ),

  scheduleVersion: 3,
};

describe("alert planner", () => {
  it(
    "uses a deterministic per-version identity",
    () => {
      const plans =
        planAlerts(journey);

      expect(plans).toHaveLength(5);

      expect(plans[0]).toMatchObject({
        scheduledFor: new Date(
          "2026-08-12T17:07:00Z"
        ),
        deterministicKey:
          "j:120:3",
      });

      expect(
        new Set(
          plans.map(
            (x) => x.deterministicKey
          )
        ).size
      ).toBe(5);
    }
  );

  it(
    "changes alert identity when schedule version changes",
    () => {
      const version3 =
        planAlerts({
          ...journey,
          scheduleVersion: 3,
        });

      const version4 =
        planAlerts({
          ...journey,
          scheduleVersion: 4,
        });

      expect(
        version3[0].deterministicKey
      ).toBe("j:120:3");

      expect(
        version4[0].deterministicKey
      ).toBe("j:120:4");

      expect(
        version3[0].deterministicKey
      ).not.toBe(
        version4[0].deterministicKey
      );
    }
  );

  it(
    "returns no alerts when ETA is unavailable",
    () => {
      const plans = planAlerts({
        ...journey,
        currentEta: null,
      });

      expect(plans).toEqual([]);
    }
  );

  it(
    "detects an ETA change",
    () => {
      expect(
        needsNewSchedule(
          new Date(
            "2026-08-12T19:07:00Z"
          ),
          new Date(
            "2026-08-12T19:17:00Z"
          )
        )
      ).toBe(true);
    }
  );

  it(
    "does not create a new schedule when ETA is unchanged",
    () => {
      expect(
        needsNewSchedule(
          new Date(
            "2026-08-12T19:07:00Z"
          ),
          new Date(
            "2026-08-12T19:07:00Z"
          )
        )
      ).toBe(false);
    }
  );
});