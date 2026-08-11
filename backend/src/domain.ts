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

export const ALERT_OFFSETS_MINUTES = [120, 60, 30, 15, 0] as const;

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
  createdAt?: Date;
  updatedAt?: Date;
}
