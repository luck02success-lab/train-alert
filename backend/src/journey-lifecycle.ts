import { randomUUID } from "node:crypto";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "./domain.js";

import type { TrainLiveStatus } from "./providers/railradar.js";

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

  const destination = resolveDestination(
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
    state:
      live.status === "running"
        ? "active"
        : "scheduled",
    providerState: "available",
    currentEta:
      destinationEta(destination),
    scheduleVersion: 0,
  };
}

export function initialAlerts(
  journey: Journey
) {
  if (!journey.currentEta) {
    throw new JourneyLifecycleError(
      "DESTINATION_ETA_UNAVAILABLE",
      "An arrival time is not available for this destination."
    );
  }

  return ALERT_OFFSETS_MINUTES.map(
    (offset) => ({
      journeyId: journey.id,
      offset,
      scheduledFor: new Date(
        journey.currentEta!.getTime() -
          offset * 60_000
      ),
      state: "pending" as const,
    })
  );
}