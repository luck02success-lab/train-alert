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
  const stop = live.stops.find(
    (item) =>
      item.stationCode === code
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

  const parsed = new Date(value);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function delayValue(
  value: number | null
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
  const stopDelay =
    delayValue(
      stop.delayMinutes
    );

  if (stopDelay !== null) {
    return stopDelay;
  }

  return delayValue(
    live.delayMinutes
  );
}

function routeIndex(
  live: TrainLiveStatus,
  stationCode: string | null
): number {
  if (!stationCode) {
    return -1;
  }

  return live.stops.findIndex(
    (stop) =>
      stop.stationCode ===
      stationCode
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

  const currentIndex =
    routeIndex(
      live,
      live.currentStationCode
    );

  /*
   * If RailRadar doesn't expose the current station code,
   * use next/previous station as a weaker signal.
   */
  if (currentIndex < 0) {
    const nextIndex =
      routeIndex(
        live,
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

      if (
        destinationIndex ===
        nextIndex
      ) {
        return "ahead";
      }

      return "ahead";
    }

    const previousIndex =
      routeIndex(
        live,
        live.previousStation
      );

    if (
      previousIndex >= 0
    ) {
      if (
        destinationIndex <
        previousIndex
      ) {
        return "passed";
      }

      if (
        destinationIndex ===
        previousIndex
      ) {
        return "ahead";
      }

      return "ahead";
    }

    return "unknown";
  }

  if (
    destinationIndex <
    currentIndex
  ) {
    return "passed";
  }

  if (
    destinationIndex ===
    currentIndex
  ) {
    return "current";
  }

  return "ahead";
}

function providerExpectedEtaIsPlausible(
  expectedArrival: Date,
  scheduledArrival: Date | null,
  delayMinutes: number | null,
  now: Date
): boolean {
  /*
   * An ETA in the past cannot be used to create an upcoming
   * journey. We only accept it later if another stronger
   * route-position signal proves the destination has already
   * been reached.
   */
  if (
    expectedArrival.getTime() <=
    now.getTime()
  ) {
    return false;
  }

  /*
   * If we have no scheduled baseline, the future provider ETA
   * is the best source available.
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
        delayMinutes * 60_000
    );

  /*
   * Allow modest provider differences because live ETA engines
   * can use additional information beyond the displayed delay.
   */
  const deviationMinutes =
    Math.abs(
      expectedArrival.getTime() -
        delayAdjusted.getTime()
    ) / 60_000;

  return deviationMinutes <= 10;
}

export function destinationEta(
  stop: TrainLiveStop,
  live?: TrainLiveStatus,
  now = new Date()
): Date {
  /*
   * Backwards-compatible simple mode for older unit tests/callers.
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

  const position =
    destinationPosition(
      live,
      stop.stationCode
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
   * Strongest possible signal:
   * the destination has already been reached.
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

  /*
   * Route position is stronger than a broken ETA.
   */
  if (
    position === "passed"
  ) {
    throw new JourneyLifecycleError(
      "DESTINATION_ALREADY_REACHED",
      "The train has already passed the selected destination."
    );
  }

  const scheduledArrival =
    parseDate(
      stop.scheduledArrival
    );

  const expectedArrival =
    parseDate(
      stop.expectedArrival
    );

  const delayMinutes =
    effectiveDelayMinutes(
      stop,
      live
    );

  /*
   * 1. Trust RailRadar expected ETA when:
   *    - it is in the future
   *    - and it is reasonably consistent with the scheduled
   *      arrival plus current delay.
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
   * 2. Fallback to scheduled arrival + current delay.
   *
   * This is the important case for delayed trains such as:
   *
   * scheduled = 12:27
   * delay     = +24
   * ETA       = 12:51
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
   * 3. Scheduled future arrival is still usable if we don't have
   * a trustworthy live ETA/delay.
   */
  if (
    scheduledArrival &&
    scheduledArrival.getTime() >
      now.getTime()
  ) {
    /*
     * However, if the provider explicitly says the destination
     * ETA is in the past while the route position says the
     * destination is still ahead, the data is contradictory.
     *
     * Do NOT manufacture an ETA or silently move the journey
     * to tomorrow.
     */
    if (
      expectedArrival &&
      expectedArrival.getTime() <=
        now.getTime() &&
      (
        position === "ahead" ||
        position === "unknown"
      )
    ) {
      throw new JourneyLifecycleError(
        "DESTINATION_ETA_INCONSISTENT",
        "Live railway data for this destination is currently inconsistent. Please try again shortly."
      );
    }

    return scheduledArrival;
  }

  /*
   * 4. We have no trustworthy future ETA.
   */
  throw new JourneyLifecycleError(
    "DESTINATION_ETA_INCONSISTENT",
    "Live railway data for this destination is currently inconsistent. Please try again shortly."
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