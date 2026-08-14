import type { JourneyRepository } from "./journey-repository.js";
import { JourneyService } from "./journey-service.js";

const DEFAULT_BATCH_SIZE = 100;

export interface JourneyRefreshResult {
  refreshed: number;
  completed: number;
  failed: number;
}

export class JourneyRefreshWorker {
  constructor(
    private readonly repository: JourneyRepository,
    private readonly journeyService: JourneyService
  ) {}

  async run(
    batchSize = DEFAULT_BATCH_SIZE
  ): Promise<JourneyRefreshResult> {
    const journeys =
      await this.repository.listForEtaRefresh(
        batchSize
      );

    let refreshed = 0;
    let completed = 0;
    let failed = 0;

    for (const journey of journeys) {
      try {
        const updated =
          await this.journeyService.refreshEta(
            journey.userId,
            journey.id
          );

        refreshed += 1;

        if (
          updated.state ===
          "completed"
        ) {
          completed += 1;
        }
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