import { ALERT_OFFSETS_MINUTES, type AlertPlan, type Journey } from "./domain.js";
export function planAlerts(journey: Journey): AlertPlan[] {
  if (!journey.currentEta) return [];
  return ALERT_OFFSETS_MINUTES.map(offsetMinutes => ({
    journeyId: journey.id, offsetMinutes, scheduleVersion: journey.scheduleVersion,
    scheduledFor: new Date(journey.currentEta!.getTime() - offsetMinutes * 60_000),
    deterministicKey: `${journey.id}:${offsetMinutes}:${journey.scheduleVersion}`
  }));
}
export function needsNewSchedule(previousEta: Date | null, nextEta: Date | null): boolean {
  return previousEta?.getTime() !== nextEta?.getTime();
}
