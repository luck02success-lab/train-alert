import type {
  NotificationRepository,
} from "./notification-repository.js";

import {
  NotificationService,
} from "./notification-service.js";

const DEFAULT_BATCH_SIZE = 50;

export class AlertWorker {
  constructor(
    private readonly repository:
      NotificationRepository,

    private readonly notifications:
      NotificationService
  ) {}

  async run(
    batchSize = DEFAULT_BATCH_SIZE
  ): Promise<number> {
    const alerts =
      await this.repository
        .claimDueAlerts(batchSize);

    for (const alert of alerts) {
      try {
        await this.notifications
          .processAlert(alert);
      } catch (error) {
        console.error(
          "Failed to process alert",
          alert.id,
          error
        );

        /*
         * Never leave an alert permanently stuck
         * in "sending" because of an unexpected
         * application error.
         */
        try {
          await this.repository
            .releaseAlert(alert.id);
        } catch (releaseError) {
          console.error(
            "Failed to release alert",
            alert.id,
            releaseError
          );
        }
      }
    }

    return alerts.length;
  }
}