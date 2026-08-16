import type {
  JourneyRepository,
} from "./journey-repository.js";

import {
  JourneyService,
} from "./journey-service.js";

const DEFAULT_BATCH_SIZE = 100;
const STALE_JOURNEY_GRACE_HOURS = 2;

export interface JourneyRefreshResult {
  refreshed: number;
  completed: number;
  failed: number;
}

export class JourneyRefreshWorker {
  constructor(
    private readonly repository:
      JourneyRepository,

    private readonly journeyService:
      JourneyService
  ) {}

  async run(
    batchSize = DEFAULT_BATCH_SIZE
  ): Promise<JourneyRefreshResult> {
    /*
     * Reconcile journeys whose stored ETA is already
     * safely in the past before considering any provider
     * refresh. This does NOT consume RailRadar credits.
     */
    const completed =
      await this.repository
        .reconcileStaleJourneys(
          STALE_JOURNEY_GRACE_HOURS
        );

    const journeys =
      await this.repository
        .listForEtaRefresh(
          batchSize
        );

    let refreshed = 0;
    let failed = 0;

    for (
      const journey of journeys
    ) {
      try {
        await this.journeyService
          .refreshEta(
            journey.userId,
            journey.id
          );

        refreshed += 1;
      } catch (error) {
        failed += 1;

        console.error(
          "Journey ETA refresh failed",
          {
            journeyId:
              journey.id,

            userId:
              journey.userId,

            trainNumber:
              journey.trainNumber,

            error,
          }
        );
      }
    }

    return {
      refreshed,
      completed,
      failed,
    };
  }
}