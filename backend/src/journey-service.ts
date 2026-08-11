import type { Journey } from "./domain.js";
import type { JourneyRepository } from "./journey-repository.js";
import {
  newJourney,
  JourneyLifecycleError,
} from "./journey-lifecycle.js";
import {
  ApiError,
  type TrainService,
} from "./train-service.js";

export class JourneyServiceError extends Error {
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
    private readonly repository: JourneyRepository,
    private readonly trains: TrainService
  ) {}

  async create(
    userId: string,
    input: {
      trainNumber: string;
      journeyDate: string;
      destinationStationCode: string;
    }
  ): Promise<Journey> {
    const live = await this.trains.live(
      input.trainNumber,
      input.journeyDate
    );

    try {
      const journey = newJourney(
        userId,
        live,
        input.destinationStationCode
      );

      return await this.repository.createWithAlerts(
        journey
      );
    } catch (error) {
      if (error instanceof JourneyLifecycleError) {
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
      await this.repository.findByIdForUser(
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

  async list(userId: string): Promise<Journey[]> {
    return this.repository.listForUser(userId);
  }

  async cancel(
    userId: string,
    journeyId: string
  ): Promise<Journey> {
    const journey =
      await this.repository.cancel(
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
      await this.repository.nextAlertForJourney(
        journey.id
      );

    return {
      id: journey.id,
      trainNumber: journey.trainNumber,
      journeyDate: journey.journeyDate,
      destinationStationCode:
        journey.destinationStationCode,
      destinationStationName:
        journey.destinationStationName,
      state: journey.state,
      expectedArrival:
        journey.currentEta?.toISOString() ?? null,
      delayMinutes:
        journey.currentDelayMinutes,
      nextAlert:
        nextAlert?.toISOString() ?? null,
    };
  }
}
