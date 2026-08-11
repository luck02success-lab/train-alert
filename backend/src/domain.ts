export type JourneyState = "scheduled" | "active" | "completed" | "cancelled" | "failed";
export type ProviderState = "unknown" | "available" | "unavailable" | "rate_limited" | "invalid";
export const ALERT_OFFSETS_MINUTES = [120, 60, 30, 15, 0] as const;
export type AlertOffset = (typeof ALERT_OFFSETS_MINUTES)[number];

export interface Journey { id: string; userId: string; trainNumber: string; journeyDate: string; destinationStationCode: string; state: JourneyState; providerState: ProviderState; currentEta: Date | null; scheduleVersion: number; }
export interface LiveTrain { trainNumber: string; observedAt: Date; destination: { code: string; eta: Date } | null; }
export interface AlertPlan { journeyId: string; offsetMinutes: AlertOffset; scheduleVersion: number; scheduledFor: Date; deterministicKey: string; }
export interface RailwayProvider { getLiveTrain(trainNumber: string, journeyDate: string): Promise<LiveTrain>; searchStations(query: string): Promise<Array<{code: string; name: string}>>; }
