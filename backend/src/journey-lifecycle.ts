import { randomUUID } from "node:crypto";

import {
  ALERT_OFFSETS_MINUTES,
  type Journey,
} from "./domain.js";

import type {
  TrainLiveStatus,
  TrainLiveStop,
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
): TrainLiveStop {
  const normalizedCode =
    code.trim().toUpperCase();

  const stop =
    live.stops.find(
      (item) =>
        item.stationCode
          .trim()
          .toUpperCase() ===
        normalizedCode
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
  value:
    | string
    | null
    | undefined
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

function delayValue(
  value:
    | number
    | null
    | undefined
): number | null {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function effectiveDelayMinutes(
  stop: TrainLiveStop,
  live: TrainLiveStatus
): number | null {
  return (
    delayValue(
      live.destinationLiveDelayMinutes
    ) ??
    delayValue(
      stop.delayMinutes
    ) ??
    delayValue(
      live.delayMinutes
    )
  );
}

function routeIndex(
  live: TrainLiveStatus,
  stationCode:
    | string
    | null
    | undefined
): number {
  if (!stationCode) {
    return -1;
  }

  const normalizedCode =
    stationCode
      .trim()
      .toUpperCase();

  return live.stops.findIndex(
    (stop) =>
      stop.stationCode
        .trim()
        .toUpperCase() ===
      normalizedCode
  );
}

export type DestinationPosition =
  | "ahead"
  | "current"
  | "passed"
  | "unknown";

export function destinationPosition(
  live: TrainLiveStatus,
  destinationCode: string
): DestinationPosition {
  const destinationIndex =
    routeIndex(
      live,
      destinationCode
    );

  if (
    destinationIndex < 0
  ) {
    return "unknown";
  }

  /*
   * Prefer the explicit current sequence if RailRadar provides it.
   *
   * This is useful informational evidence, but it is deliberately
   * NOT used by itself to mark a journey as completed.
   */
  if (
    typeof live.currentSequence ===
      "number" &&
    Number.isFinite(
      live.currentSequence
    )
  ) {
    const destinationSequence =
      live.stops[
        destinationIndex
      ]?.sequence;

    if (
      typeof destinationSequence ===
        "number" &&
      Number.isFinite(
        destinationSequence
      )
    ) {
      if (
        destinationSequence >
        live.currentSequence
      ) {
        return "ahead";
      }

      if (
        destinationSequence ===
        live.currentSequence
      ) {
        return "current";
      }

      return "passed";
    }
  }

  /*
   * Fall back to station-code route indices.
   *
   * Again, this is only positional evidence.
   */
  const currentIndex =
    routeIndex(
      live,
      live.currentStationCode
    );

  if (
    currentIndex >= 0
  ) {
    if (
      destinationIndex >
      currentIndex
    ) {
      return "ahead";
    }

    if (
      destinationIndex ===
      currentIndex
    ) {
      return "current";
    }

    return "passed";
  }

  const nextIndex =
    routeIndex(
      live,
      live.nextStationCode ??
        live.nextStation
    );

  if (
    nextIndex >= 0
  ) {
    if (
      destinationIndex <
      nextIndex
    ) {
      return "passed";
    }

    return "ahead";
  }

  const previousIndex =
    routeIndex(
      live,
      live.previousStationCode ??
        live.previousStation
    );

  if (
    previousIndex >= 0
  ) {
    if (
      destinationIndex <=
      previousIndex
    ) {
      return "passed";
    }

    return "ahead";
  }

  return "unknown";
}

function providerExpectedEtaIsPlausible(
  expectedArrival: Date,
  scheduledArrival: Date | null,
  delayMinutes: number | null,
  now: Date
): boolean {
  /*
   * A past ETA is never directly usable.
   *
   * It does NOT mean the train has reached the destination.
   */
  if (
    expectedArrival.getTime() <=
    now.getTime()
  ) {
    return false;
  }

  /*
   * No baseline available: future provider ETA is the best
   * signal we currently have.
   */
  if (
    !scheduledArrival ||
    delayMinutes === null
  ) {
    return true;
  }

  const delayAdjusted =
    new Date(
      scheduledArrival.getTime() +
        delayMinutes *
          60_000
    );

  /*
   * RailRadar can calculate ETA using more information than the
   * displayed delay, so allow a reasonable difference.
   */
  const deviationMinutes =
    Math.abs(
      expectedArrival.getTime() -
        delayAdjusted.getTime()
    ) / 60_000;

  return deviationMinutes <= 15;
}

type DestinationEvidence =
  | "actual-arrival"
  | "actual-departure"
  | "station-board-upcoming"
  | "station-board-at-station"
  | "station-board-departed"
  | "stop-upcoming"
  | "stop-scheduled"
  | "stop-departed"
  | "none";

function destinationEvidence(
  stop: TrainLiveStop,
  live: TrainLiveStatus
): DestinationEvidence {
  if (
    stop.actualArrival
  ) {
    return "actual-arrival";
  }

  if (
    stop.actualDeparture
  ) {
    return "actual-departure";
  }

  if (
    live.destinationLiveType ===
    "upcoming"
  ) {
    return "station-board-upcoming";
  }

  if (
    live.destinationLiveType ===
    "at-station"
  ) {
    return "station-board-at-station";
  }

  if (
    live.destinationLiveType ===
    "departed"
  ) {
    return "station-board-departed";
  }

  const status =
    stop.status
      ?.trim()
      .toLowerCase();

  if (
    status ===
    "upcoming"
  ) {
    return "stop-upcoming";
  }

  if (
    status ===
    "scheduled"
  ) {
    return "stop-scheduled";
  }

  if (
    status ===
    "departed"
  ) {
    return "stop-departed";
  }

  return "none";
}

function destinationIsActuallyReached(
  stop: TrainLiveStop,
  live: TrainLiveStatus
): boolean {
  /*
   * These are explicit arrival signals.
   */
  if (
    Boolean(
      stop.actualArrival
    )
  ) {
    return true;
  }

  if (
    Boolean(
      stop.actualDeparture
    )
  ) {
    return true;
  }

  /*
   * Station board explicitly saying the destination is upcoming
   * or scheduled is direct evidence that it has NOT been reached.
   */
  if (
    live.destinationLiveType ===
      "upcoming" ||
    live.destinationLiveType ===
      "scheduled"
  ) {
    return false;
  }

  /*
   * at-station means the train is there now.
   * We don't mark it completed until an arrival/departure
   * timestamp is available.
   */
  if (
    live.destinationLiveType ===
    "at-station"
  ) {
    return false;
  }

  /*
   * A station-board "departed" signal is useful, but without
   * actual arrival/departure evidence it can still be stale.
   */
  if (
    live.destinationLiveType ===
    "departed"
  ) {
    return false;
  }

  /*
   * IMPORTANT:
   *
   * Route position alone is NOT enough.
   *
   * This is intentionally absent:
   *
   *   if (destinationPosition(...) === "passed") ...
   *
   * because that was causing false "already reached" states
   * for delayed trains.
   */
  return false;
}

export function destinationEta(
  stop: TrainLiveStop,
  live?: TrainLiveStatus,
  now = new Date()
): Date {
  /*
   * Backward-compatible simple mode.
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

  /*
   * Only strong evidence can mark the destination as reached.
   */
  if (
    destinationIsActuallyReached(
      stop,
      live
    )
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ALREADY_REACHED",
      "The train has already reached the selected destination."
    );
  }

  const scheduledArrival =
    parseDate(
      stop.scheduledArrival
    );

  const expectedArrival =
    parseDate(
      live.destinationLiveExpectedArrival ??
        stop.expectedArrival
    );

  const delayMinutes =
    effectiveDelayMinutes(
      stop,
      live
    );

  const evidence =
    destinationEvidence(
      stop,
      live
    );

  /*
   * 1. Destination station board has highest priority for a
   *    future ETA.
   */
  if (
    (
      live.destinationLiveType ===
        "upcoming" ||
      live.destinationLiveType ===
        "scheduled"
    ) &&
    expectedArrival &&
    expectedArrival.getTime() >
      now.getTime()
  ) {
    return expectedArrival;
  }

  /*
   * 2. If station board explicitly says the train is upcoming
   *    but ETA is missing, calculate from schedule + delay.
   */
  if (
    live.destinationLiveType ===
      "upcoming" &&
    scheduledArrival &&
    delayMinutes !== null
  ) {
    const calculated =
      new Date(
        scheduledArrival.getTime() +
          delayMinutes *
            60_000
      );

    if (
      calculated.getTime() >
      now.getTime()
    ) {
      return calculated;
    }
  }

  /*
   * 3. Trust a future generic train-live ETA if it is plausible.
   */
  if (
    expectedArrival &&
    providerExpectedEtaIsPlausible(
      expectedArrival,
      scheduledArrival,
      delayMinutes,
      now
    )
  ) {
    return expectedArrival;
  }

  /*
   * 4. Delayed/early train fallback:
   *
   * schedule + latest available delay.
   *
   * This is especially important when RailRadar returns a stale
   * expectedArrival but destination delay is still useful.
   */
  if (
    scheduledArrival &&
    delayMinutes !== null
  ) {
    const calculated =
      new Date(
        scheduledArrival.getTime() +
          delayMinutes *
            60_000
      );

    if (
      calculated.getTime() >
      now.getTime()
    ) {
      return calculated;
    }
  }

  /*
   * 5. Future scheduled time is acceptable only when the provider
   * isn't contradicting it with a stale past ETA plus a usable
   * delay.
   */
  if (
    scheduledArrival &&
    scheduledArrival.getTime() >
      now.getTime()
  ) {
    if (
      expectedArrival &&
      expectedArrival.getTime() <=
        now.getTime() &&
      delayMinutes !== null
    ) {
      /*
       * We already attempted schedule + delay above.
       *
       * If that result wasn't future, we don't invent another ETA.
       */
      if (
        evidence ===
          "station-board-upcoming" ||
        evidence ===
          "station-board-at-station" ||
        evidence ===
          "stop-upcoming" ||
        evidence ===
          "stop-scheduled" ||
        evidence ===
          "none"
      ) {
        throw new JourneyLifecycleError(
          "DESTINATION_ETA_INCONSISTENT",
          "Live railway data for this destination is temporarily inconsistent. Please try again shortly."
        );
      }
    }

    return scheduledArrival;
  }

  /*
   * No trustworthy future ETA.
   *
   * This is intentionally NOT converted into "already reached".
   */
  throw new JourneyLifecycleError(
    "DESTINATION_ETA_INCONSISTENT",
    "Live railway data for this destination is temporarily inconsistent. Please try again shortly."
  );
}

export function canTransition(
  from: Journey["state"],
  to: Journey["state"]
): boolean {
  return (
    (
      from ===
        "scheduled" &&
      [
        "active",
        "cancelled",
      ].includes(to)
    ) ||
    (
      from ===
        "active" &&
      [
        "completed",
        "cancelled",
      ].includes(to)
    )
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
    "cancelled"
  ) {
    throw new JourneyLifecycleError(
      "TRAIN_CANCELLED",
      "This train is currently cancelled."
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
   * At this point destinationEta() has already established that
   * the ETA is the best available future ETA.
   */
  if (
    eta.getTime() <=
    now.getTime()
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ETA_INCONSISTENT",
      "Live railway data for this destination is temporarily inconsistent. Please try again shortly."
    );
  }

  return {
    id:
      randomUUID(),

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
      live.status ===
        "running"
        ? "active"
        : "scheduled",

    providerState:
      "available",

    currentEta:
      eta,

    currentDelayMinutes:
      live.destinationLiveDelayMinutes ??
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