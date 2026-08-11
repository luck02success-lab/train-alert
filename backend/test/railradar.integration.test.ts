import { describe, expect, it } from "vitest";
import { RailRadarProvider } from "../src/providers/railradar.js";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!runIntegration)(
  "RailRadar integration",
  () => {
    it("normalizes a real live train response", async () => {
      const provider = new RailRadarProvider();

      const result =
        await provider.getLiveTrain(
          "12919",
          "2026-08-11"
        );

      expect(result.trainNumber).toBe("12919");
      expect(result.journeyDate).toBe(
        "2026-08-11"
      );

      expect(result.stops.length).toBeGreaterThan(0);

      expect(
        result.stops.some(
          (stop) => stop.stationCode === "NDLS"
        )
      ).toBe(true);

      expect(result.observedAt).toBeInstanceOf(
        Date
      );
    });
  }
);
