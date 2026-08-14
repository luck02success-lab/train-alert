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
  return typeof value ===
    "number" &&
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

function sequenceOf(
  value:
    | number
    | null
    | undefined
): number | null {
  return typeof value ===
    "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function destinationIsAhead(
  live: TrainLiveStatus,
  stop: TrainLiveStop
): boolean {
  const currentSequence =
    sequenceOf(
      live.currentSequence
    );

  const destinationSequence =
    sequenceOf(
      stop.sequence
    );

  if (
    currentSequence !== null &&
    destinationSequence !== null
  ) {
    return (
      destinationSequence >
      currentSequence
    );
  }

  if (
    live.nextStationCode &&
    live.nextStationCode ===
      stop.stationCode
  ) {
    return true;
  }

  if (
    live.nextStation &&
    live.nextStation
      .trim()
      .toUpperCase() ===
      stop.stationName
        .trim()
        .toUpperCase()
  ) {
    return true;
  }

  return false;
}

function stationBoardSaysUpcoming(
  live: TrainLiveStatus
): boolean {
  return (
    live.destinationLiveType ===
      "upcoming" ||
    live.destinationLiveType ===
      "scheduled"
  );
}

function destinationCompletionIsCorroborated(
  live: TrainLiveStatus,
  stop: TrainLiveStop
): boolean {
  /*
   * If destination is clearly still ahead, then any stale
   * actualArrival must be ignored.
   */
  if (
    destinationIsAhead(
      live,
      stop
    )
  ) {
    return false;
  }

  /*
   * Actual departure is stronger than actual arrival.
   */
  if (
    stop.actualDeparture
  ) {
    return true;
  }

  /*
   * Actual arrival is strong only when the destination is no
   * longer represented as upcoming and the train position does
   * not contradict it.
   */
  if (
    stop.actualArrival &&
    !stationBoardSaysUpcoming(
      live
    )
  ) {
    return true;
  }

  /*
   * Station board "departed" without actual timestamp is
   * insufficient on its own; it can be stale.
   */
  return false;
}

function providerExpectedEtaIsPlausible(
  expectedArrival: Date,
  scheduledArrival: Date | null,
  delayMinutes: number | null,
  now: Date
): boolean {
  if (
    expectedArrival.getTime() <=
    now.getTime()
  ) {
    return false;
  }

  if (
    !scheduledArrival ||
    delayMinutes === null
  ) {
    return true;
  }

  const delayAdjusted =
    new Date(
      scheduledArrival.getTime() +
        delayMinutes * 60_000
    );

  const deviationMinutes =
    Math.abs(
      expectedArrival.getTime() -
        delayAdjusted.getTime()
    ) / 60_000;

  return (
    deviationMinutes <=
    15
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
  const destination =
    resolveDestination(
      live,
      destinationCode
    );

  const currentSequence =
    sequenceOf(
      live.currentSequence
    );

  const destinationSequence =
    sequenceOf(
      destination.sequence
    );

  if (
    currentSequence !== null &&
    destinationSequence !== null
  ) {
    if (
      destinationSequence >
      currentSequence
    ) {
      return "ahead";
    }

    if (
      destinationSequence ===
      currentSequence
    ) {
      return "current";
    }

    return "passed";
  }

  if (
    live.nextStationCode ===
    destination.stationCode
  ) {
    return "ahead";
  }

  return "unknown";
}

function destinationIsActuallyReached(
  stop: TrainLiveStop,
  live: TrainLiveStatus
): boolean {
  const destinationSequence =
    sequenceOf(
      stop.sequence
    );

  const currentSequence =
    sequenceOf(
      live.currentSequence
    );

  const destinationCode =
    stop.stationCode
      .trim()
      .toUpperCase();

  const currentCode =
    live.currentStationCode
      ?.trim()
      .toUpperCase() ??
    null;

  /*
   * If the provider says the selected destination is
   * explicitly upcoming/scheduled, it is NOT reached.
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
   * The train is still before the destination according
   * to an actual live position. This overrides stale
   * actualArrival values.
   */
  if (
    live.isActualPosition ===
      true &&
    destinationSequence !== null &&
    currentSequence !== null &&
    destinationSequence >
      currentSequence
  ) {
    return false;
  }

  /*
   * Train is physically at the selected destination.
   */
  if (
    live.isActualPosition ===
      true &&
    currentCode ===
      destinationCode
  ) {
    return (
      live.destinationLiveType ===
        "at-station" ||
      stop.actualArrival !==
        null ||
      stop.actualDeparture !==
        null
    );
  }

  /*
   * Explicit actual departure from destination.
   */
  if (
    stop.actualDeparture !==
      null &&
    currentSequence !== null &&
    destinationSequence !== null &&
    currentSequence >=
      destinationSequence
  ) {
    return true;
  }

  /*
   * Explicit actual arrival is only trusted once the
   * current live position no longer contradicts it.
   */
  if (
    stop.actualArrival !==
      null &&
    currentSequence !== null &&
    destinationSequence !== null &&
    currentSequence >=
      destinationSequence &&
    live.destinationLiveType !==
      "upcoming" &&
    live.destinationLiveType !==
      "scheduled"
  ) {
    return true;
  }

  /*
   * A departed destination plus an actual position beyond
   * it is sufficient corroboration.
   */
  if (
    live.destinationLiveType ===
      "departed" &&
    currentSequence !== null &&
    destinationSequence !== null &&
    currentSequence >
      destinationSequence
  ) {
    return true;
  }

  return false;
}

export function destinationEta(
  stop: TrainLiveStop,
  live?: TrainLiveStatus,
  now = new Date()
): Date {
  /*
   * Compatibility mode for old callers.
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

  /*
   * Destination-specific station board ETA gets first priority.
   */
  if (
    stationBoardSaysUpcoming(
      live
    ) &&
    expectedArrival &&
    expectedArrival.getTime() >
      now.getTime()
  ) {
    return expectedArrival;
  }

  /*
   * If station board says upcoming but didn't provide ETA,
   * reconstruct from schedule + latest delay.
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
   * Future generic ETA.
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
   * Delayed/early train fallback.
   *
   * This fixes the important case where scheduled arrival has
   * passed but the train is still approaching.
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
   * Future scheduled arrival remains usable if the provider
   * doesn't provide a trustworthy live ETA.
   */
  if (
    scheduledArrival &&
    scheduledArrival.getTime() >
      now.getTime()
  ) {
    return scheduledArrival;
  }

  /*
   * The important part:
   * never convert an unresolved timestamp contradiction into
   * DESTINATION_ALREADY_REACHED.
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
      from === "scheduled" &&
      [
        "active",
        "cancelled",
      ].includes(to)
    ) ||
    (
      from === "active" &&
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