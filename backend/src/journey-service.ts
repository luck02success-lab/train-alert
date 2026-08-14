import type {
  Journey,
} from "./domain.js";

import type {
  JourneyRepository,
} from "./journey-repository.js";

import {
  destinationEta,
  newJourney,
  normalizeAlertOffsets,
  resolveDestination,
  JourneyLifecycleError,
} from "./journey-lifecycle.js";

import type {
  TrainService,
} from "./train-service.js";

export class JourneyServiceError
  extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export class JourneyService {
  constructor(
    private readonly repository:
      JourneyRepository,

    private readonly trains:
      TrainService
  ) {}

  async create(
    userId: string,
    input: {
      trainNumber: string;
      journeyDate: string;
      destinationStationCode: string;
    }
  ): Promise<Journey> {
    const live =
      await this.trains.live(
        input.trainNumber,
        input.journeyDate,
        input.destinationStationCode
      );

    try {
      const journey =
        newJourney(
          userId,
          live,
          input.destinationStationCode,
          new Date()
        );

      return await this.repository
        .createWithAlerts(
          journey
        );
    } catch (error) {
      if (
        error instanceof
        JourneyLifecycleError
      ) {
        throw new JourneyServiceError(
          error.code,
          error.message,
          error.code ===
            "DESTINATION_ETA_INCONSISTENT"
            ? 503
            : 400
        );
      }

      throw error;
    }
  }

  async refreshEta(
    userId: string,
    journeyId: string
  ): Promise<Journey> {
    const journey =
      await this.repository
        .findByIdForUser(
          journeyId,
          userId
        );

    if (!journey) {
      throw new JourneyServiceError(
        "JOURNEY_NOT_FOUND",
        "Journey not found.",
        404
      );
    }

    if (
      journey.state !==
        "scheduled" &&
      journey.state !==
        "active"
    ) {
      throw new JourneyServiceError(
        "JOURNEY_REFRESH_REJECTED",
        "A terminal journey cannot be refreshed.",
        409
      );
    }

    const live =
      await this.trains.live(
        journey.trainNumber,
        journey.journeyDate,
        journey.destinationStationCode
      );

    try {
      const destination =
        resolveDestination(
          live,
          journey.destinationStationCode
        );

      const eta =
        destinationEta(
          destination,
          live,
          new Date()
        );

      const refreshed =
        await this.repository
          .refreshEta(
            journey.id,
            eta,
            live.destinationLiveDelayMinutes ??
              destination.delayMinutes ??
              live.delayMinutes ??
              null,
            live.observedAt ??
              new Date()
          );

      if (!refreshed) {
        throw new JourneyServiceError(
          "JOURNEY_REFRESH_REJECTED",
          "The journey could not be refreshed because the provider observation is stale.",
          409
        );
      }

      return refreshed;
    } catch (error) {
      if (
        error instanceof
        JourneyServiceError
      ) {
        throw error;
      }

      if (
        error instanceof
        JourneyLifecycleError
      ) {
        if (
          error.code ===
          "DESTINATION_ALREADY_REACHED"
        ) {
          const completed =
            await this.repository
              .complete(
                journey.id
              );

          if (completed) {
            return completed;
          }
        }

        throw new JourneyServiceError(
          error.code,
          error.message,
          error.code ===
            "DESTINATION_ETA_INCONSISTENT"
            ? 503
            : 400
        );
      }

      throw error;
    }
  }

  async updateAlertPreferences(
    userId: string,
    journeyId: string,
    alertOffsetsMinutes: number[]
  ): Promise<Journey> {
    try {
      const normalized =
        normalizeAlertOffsets(
          alertOffsetsMinutes
        );

      const journey =
        await this.repository
          .updateAlertPreferences(
            journeyId,
            userId,
            normalized
          );

      if (!journey) {
        throw new JourneyServiceError(
          "JOURNEY_NOT_FOUND",
          "Journey not found or is no longer editable.",
          404
        );
      }

      return journey;
    } catch (error) {
      if (
        error instanceof
        JourneyServiceError
      ) {
        throw error;
      }

      if (
        error instanceof
        JourneyLifecycleError
      ) {
        throw new JourneyServiceError(
          error.code,
          error.message,
          400
        );
      }

      throw error;
    }
  }

  async get(
    userId: string,
    journeyId: string
  ): Promise<Journey> {
    const journey =
      await this.repository
        .findByIdForUser(
          journeyId,
          userId
        );

    if (!journey) {
      throw new JourneyServiceError(
        "JOURNEY_NOT_FOUND",
        "Journey not found.",
        404
      );
    }

    return journey;
  }

  async list(
    userId: string
  ): Promise<Journey[]> {
    return this.repository
      .listForUser(
        userId
      );
  }

  async cancel(
    userId: string,
    journeyId: string
  ): Promise<Journey> {
    const journey =
      await this.repository
        .cancel(
          journeyId,
          userId
        );

    if (!journey) {
      throw new JourneyServiceError(
        "JOURNEY_NOT_FOUND",
        "Journey not found or is already terminal.",
        404
      );
    }

    return journey;
  }

  async response(
    journey: Journey
  ) {
    const nextAlert =
      await this.repository
        .nextAlertForJourney(
          journey.id
        );

    return {
      id:
        journey.id,

      trainNumber:
        journey.trainNumber,

      journeyDate:
        journey.journeyDate,

      destinationStationCode:
        journey.destinationStationCode,

      destinationStationName:
        journey.destinationStationName,

      state:
        journey.state,

      expectedArrival:
        journey.currentEta
          ?.toISOString() ??
        null,

      delayMinutes:
        journey.currentDelayMinutes,

      nextAlert:
        nextAlert
          ?.toISOString() ??
        null,

      alertOffsetsMinutes:
        journey.alertOffsetsMinutes,
    };
  }
}