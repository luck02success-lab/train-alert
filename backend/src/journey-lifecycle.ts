import { randomUUID } from "node:crypto";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "./domain.js";

import type {
  TrainLiveStatus,
} from "./providers/railradar.js";

export class JourneyLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export function resolveDestination(
  live: TrainLiveStatus,
  code: string
) {
  const stop = live.stops.find(
    (x) => x.stationCode === code
  );

  if (!stop) {
    throw new JourneyLifecycleError(
      "DESTINATION_NOT_FOUND",
      "The destination is not on this train's route."
    );
  }

  return stop;
}

export function destinationEta(
  stop: TrainLiveStatus["stops"][number]
): Date {
  const raw =
    stop.expectedArrival ??
    stop.actualArrival ??
    stop.scheduledArrival;

  if (!raw) {
    throw new JourneyLifecycleError(
      "DESTINATION_ETA_UNAVAILABLE",
      "An arrival time is not available for this destination."
    );
  }

  const value = new Date(raw);

  if (Number.isNaN(value.getTime())) {
    throw new JourneyLifecycleError(
      "DESTINATION_ETA_UNAVAILABLE",
      "An arrival time is not available for this destination."
    );
  }

  return value;
}

export function canTransition(
  from: Journey["state"],
  to: Journey["state"]
): boolean {
  return (
    (from === "scheduled" &&
      ["active", "cancelled"].includes(to)) ||
    (from === "active" &&
      ["completed", "cancelled"].includes(to))
  );
}

export function normalizeAlertOffsets(
  offsets: number[]
): number[] {
  const allowed = new Set<number>(
    ALERT_OFFSETS_MINUTES
  );

  const normalized = [
    ...new Set(
      offsets.filter(
        (offset) =>
          Number.isInteger(offset) &&
          allowed.has(offset)
      )
    ),
  ];

  if (
    normalized.length !==
    offsets.length
  ) {
    throw new JourneyLifecycleError(
      "INVALID_ALERT_OFFSETS",
      "Alert offsets must contain only 120, 60, 30, or 15 minutes."
    );
  }

  return normalized.sort(
    (a, b) => b - a
  );
}

export function newJourney(
  userId: string,
  live: TrainLiveStatus,
  destinationCode: string
): Journey {
  if (live.status === "completed") {
    throw new JourneyLifecycleError(
      "TRAIN_COMPLETED",
      "Cannot create a journey for a completed train."
    );
  }

  if (live.status === "unknown") {
    throw new JourneyLifecycleError(
      "TRAIN_STATUS_UNKNOWN",
      "Train status is currently unavailable."
    );
  }

  const destination =
    resolveDestination(
      live,
      destinationCode
    );

  return {
    id: randomUUID(),
    userId,
    trainNumber: live.trainNumber,
    journeyDate: live.journeyDate,
    destinationStationCode:
      destination.stationCode,
    destinationStationName:
      destination.stationName,
    state:
      live.status === "running"
        ? "active"
        : "scheduled",
    providerState: "available",
    currentEta:
      destinationEta(destination),
    currentDelayMinutes: null,
    lastProviderUpdateAt: null,
    scheduleVersion: 0,

    alertOffsetsMinutes: [
      ...ALERT_OFFSETS_MINUTES,
    ],
  };
}