import type { Journey } from "./domain.js";

export interface AlertPlan {
  journeyId: string;
  offsetMinutes: number;
  scheduleVersion: number;
  scheduledFor: Date;
  deterministicKey: string;
}

export const ALERT_OFFSETS_MINUTES = [
  120,
  60,
  30,
  15,
  0,
] as const;

export function planAlerts(
  journey: Journey
): AlertPlan[] {
  const eta = journey.currentEta;

  if (!eta) {
    return [];
  }

  return ALERT_OFFSETS_MINUTES.map(
    (offsetMinutes) => ({
      journeyId: journey.id,
      offsetMinutes,
      scheduleVersion:
        journey.scheduleVersion,
      scheduledFor: new Date(
        eta.getTime() -
          offsetMinutes * 60_000
      ),
      deterministicKey:
        `${journey.id}:${offsetMinutes}:${journey.scheduleVersion}`,
    })
  );
}