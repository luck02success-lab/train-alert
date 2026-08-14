import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "./domain.js";

export interface AlertPlan {
  journeyId: string;
  offsetMinutes: number;
  scheduleVersion: number;
  scheduledFor: Date;
  deterministicKey: string;
}

export function planAlerts(
  journey: Journey,
  now = new Date()
): AlertPlan[] {
  const eta =
    journey.currentEta;

  if (!eta) {
    return [];
  }

  return journey.alertOffsetsMinutes
    .filter(
      (offsetMinutes) =>
        ALERT_OFFSETS_MINUTES.includes(
          offsetMinutes as
            (typeof ALERT_OFFSETS_MINUTES)[number]
        )
    )
    .map(
      (offsetMinutes) => ({
        journeyId:
          journey.id,

        offsetMinutes,

        scheduleVersion:
          journey.scheduleVersion,

        scheduledFor:
          new Date(
            eta.getTime() -
              offsetMinutes *
                60_000
          ),

        deterministicKey:
          `${journey.id}:${offsetMinutes}:${journey.scheduleVersion}`,
      })
    )
    .filter(
      (alert) =>
        alert.scheduledFor.getTime() >
        now.getTime()
    )
    .sort(
      (left, right) =>
        left.scheduledFor.getTime() -
        right.scheduledFor.getTime()
    );
}