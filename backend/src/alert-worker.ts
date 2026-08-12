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
          {
            alertId: alert.id,
            journeyId:
              alert.journeyId,
            error,
          }
        );

        /*
         * Do not leave an alert permanently stuck in
         * "sending" after an unexpected application error.
         *
         * Already-sent deliveries remain protected by
         * the UNIQUE(alert_id, device_id) constraint.
         */
        try {
          await this.repository
            .releaseAlert(alert.id);
        } catch (releaseError) {
          console.error(
            "Failed to release alert",
            {
              alertId: alert.id,
              error: releaseError,
            }
          );
        }
      }
    }

    return alerts.length;
  }
}