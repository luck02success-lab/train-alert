import { randomUUID } from "node:crypto";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "./domain.js";

import type {
  TrainLiveStatus,
  TrainLiveStop,
} from "./providers/railradar.js";

export class JourneyLifecycleError
  extends Error {
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
): TrainLiveStop {
  const stop =
    live.stops.find(
      (x) =>
        x.stationCode === code
    );

  if (!stop) {
    throw new JourneyLifecycleError(
      "DESTINATION_NOT_FOUND",
      "The destination is not on this train's route."
    );
  }

  return stop;
}

function parseDate(
  value: string | null
): Date | null {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function effectiveDelayMinutes(
  stop: TrainLiveStop,
  live: TrainLiveStatus
): number | null {
  if (
    typeof stop.delayMinutes ===
      "number" &&
    Number.isFinite(
      stop.delayMinutes
    )
  ) {
    return stop.delayMinutes;
  }

  if (
    typeof live.delayMinutes ===
      "number" &&
    Number.isFinite(
      live.delayMinutes
    )
  ) {
    return live.delayMinutes;
  }

  return null;
}

function choosePredictedArrival(
  stop: TrainLiveStop,
  live: TrainLiveStatus,
  now: Date
): Date {
  const scheduledArrival =
    parseDate(
      stop.scheduledArrival
    );

  const expectedArrival =
    parseDate(
      stop.expectedArrival
    );

  const actualArrival =
    parseDate(
      stop.actualArrival
    );

  const actualDeparture =
    parseDate(
      stop.actualDeparture
    );

  /*
   * If the destination was already reached,
   * the journey should not be created as an upcoming
   * journey.
   */
  if (
    actualArrival &&
    actualArrival.getTime() <=
      now.getTime()
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ALREADY_REACHED",
      "The train has already reached the selected destination."
    );
  }

  if (
    actualDeparture &&
    actualDeparture.getTime() <=
      now.getTime()
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ALREADY_REACHED",
      "The train has already passed the selected destination."
    );
  }

  const delay =
    effectiveDelayMinutes(
      stop,
      live
    );

  /*
   * Best source:
   * RailRadar's expected arrival, provided it is internally
   * consistent with the scheduled arrival + current delay.
   *
   * This protects us from malformed or stale timestamps such
   * as "tomorrow 10:27" for a station that should be reached
   * today around 12:27 + current delay.
   */
  if (
    expectedArrival
  ) {
    if (
      !scheduledArrival
    ) {
      if (
        expectedArrival.getTime() >
        now.getTime()
      ) {
        return expectedArrival;
      }
    } else if (
      delay === null
    ) {
      /*
       * When the provider does not expose a usable delay,
       * trust its expected ETA if it is still in the future.
       */
      if (
        expectedArrival.getTime() >
        now.getTime()
      ) {
        return expectedArrival;
      }
    } else {
      const predictedFromSchedule =
        new Date(
          scheduledArrival.getTime() +
            delay * 60_000
        );

      const deviationMinutes =
        Math.abs(
          expectedArrival.getTime() -
            predictedFromSchedule.getTime()
        ) / 60_000;

      /*
       * A small difference is normal because providers can
       * calculate ETA with more information than the displayed
       * delay value.
       *
       * A large difference means expectedArrival is not a
       * trustworthy timestamp for this occurrence.
       */
      if (
        deviationMinutes <= 10
      ) {
        if (
          expectedArrival.getTime() >
          now.getTime()
        ) {
          return expectedArrival;
        }
      }
    }
  }

  /*
   * Fallback: construct the ETA from today's/this journey's
   * scheduled arrival plus the best current delay information.
   *
   * This is the critical path for delayed trains where the
   * provider's expectedArrival timestamp is malformed or points
   * to the wrong calendar occurrence.
   */
  if (
    scheduledArrival &&
    delay !== null
  ) {
    const calculated =
      new Date(
        scheduledArrival.getTime() +
          delay * 60_000
      );

    if (
      calculated.getTime() >
      now.getTime()
    ) {
      return calculated;
    }

    /*
     * The calculated ETA is now in the past. We keep it as the
     * best known ETA so the lifecycle layer can mark the journey
     * appropriately instead of incorrectly moving it to tomorrow.
     */
    return calculated;
  }

  if (
    expectedArrival
  ) {
    return expectedArrival;
  }

  if (
    scheduledArrival
  ) {
    return scheduledArrival;
  }

  throw new JourneyLifecycleError(
    "DESTINATION_ETA_UNAVAILABLE",
    "An arrival time is not available for this destination."
  );
}

export function destinationEta(
  stop: TrainLiveStop,
  live?: TrainLiveStatus,
  now = new Date()
): Date {
  /*
   * Preserve the simpler helper behavior for existing callers
   * and tests that only have a single stop.
   */
  if (!live) {
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

    const value =
      new Date(raw);

    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      throw new JourneyLifecycleError(
        "DESTINATION_ETA_UNAVAILABLE",
        "An arrival time is not available for this destination."
      );
    }

    return value;
  }

  return choosePredictedArrival(
    stop,
    live,
    now
  );
}

export function canTransition(
  from: Journey["state"],
  to: Journey["state"]
): boolean {
  return (
    (from === "scheduled" &&
      [
        "active",
        "cancelled",
      ].includes(to)) ||
    (from === "active" &&
      [
        "completed",
        "cancelled",
      ].includes(to))
  );
}

export function normalizeAlertOffsets(
  offsets: number[]
): number[] {
  const allowed =
    new Set<number>(
      ALERT_OFFSETS_MINUTES
    );

  const normalized = [
    ...new Set(
      offsets.filter(
        (offset) =>
          Number.isInteger(
            offset
          ) &&
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
  destinationCode: string,
  now = new Date()
): Journey {
  if (
    live.status ===
    "completed"
  ) {
    throw new JourneyLifecycleError(
      "TRAIN_COMPLETED",
      "Cannot create a journey for a completed train."
    );
  }

  if (
    live.status ===
    "unknown"
  ) {
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

  const eta =
    destinationEta(
      destination,
      live,
      now
    );

  /*
   * If the destination is already in the past, don't create an
   * upcoming journey. This protects against stale provider data
   * and prevents alerts being incorrectly scheduled for tomorrow.
   */
  if (
    eta.getTime() <=
    now.getTime()
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ALREADY_REACHED",
      "The train has already reached or passed the selected destination."
    );
  }

  return {
    id: randomUUID(),

    userId,

    trainNumber:
      live.trainNumber,

    journeyDate:
      live.journeyDate,

    destinationStationCode:
      destination.stationCode,

    destinationStationName:
      destination.stationName,

    state:
      live.status === "running"
        ? "active"
        : "scheduled",

    providerState:
      "available",

    currentEta:
      eta,

    currentDelayMinutes:
      destination.delayMinutes ??
      live.delayMinutes ??
      null,

    lastProviderUpdateAt:
      live.observedAt ??
      null,

    scheduleVersion:
      0,

    alertOffsetsMinutes: [
      ...ALERT_OFFSETS_MINUTES,
    ],
  };
}