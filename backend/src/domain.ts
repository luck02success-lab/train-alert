export type JourneyState =
  | "scheduled"
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export type ProviderState =
  | "unknown"
  | "available"
  | "unavailable"
  | "rate_limited"
  | "invalid";

export const ALERT_OFFSETS_MINUTES = [
  120,
  60,
  30,
  15,
] as const;

export type AlertOffsetMinutes =
  (typeof ALERT_OFFSETS_MINUTES)[number];

export interface AlertPlan {
  journeyId: string;
  offsetMinutes: number;
  scheduleVersion: number;
  scheduledFor: Date;
  deterministicKey: string;
}

export interface Journey {
  id: string;
  userId: string;
  trainNumber: string;
  journeyDate: string;
  destinationStationCode: string;
  destinationStationName: string;
  state: JourneyState;
  providerState: ProviderState;
  currentEta: Date | null;
  currentDelayMinutes: number | null;
  lastProviderUpdateAt: Date | null;
  scheduleVersion: number;

  /**
   * User-selected alert offsets in minutes.
   *
   * Example:
   * [120, 60, 30, 15]
   *
   * An empty array is valid and means the user has
   * disabled all future alerts for this journey.
   */
  alertOffsetsMinutes: number[];

  createdAt?: Date;
  updatedAt?: Date;
}