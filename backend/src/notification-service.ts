import type {
  FcmClient,
} from "./fcm.js";

import type {
  DueAlert,
  NotificationRepository,
} from "./notification-repository.js";

const MAX_ATTEMPTS = 5;

const RETRY_DELAYS_MS = [
  30_000,
  60_000,
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
];

function retryAt(
  attempt: number
): Date {
  const index =
    Math.min(
      attempt - 1,
      RETRY_DELAYS_MS.length - 1
    );

  return new Date(
    Date.now() +
      RETRY_DELAYS_MS[index]!
  );
}

function isPermanentFcmError(
  code?: string
): boolean {
  if (!code) {
    return false;
  }

  return (
    code.includes(
      "registration-token-not-registered"
    ) ||
    code.includes(
      "invalid-registration-token"
    )
  );
}

export class NotificationService {
  constructor(
    private readonly repository:
      NotificationRepository,

    private readonly fcm:
      FcmClient
  ) {}

  async processAlert(
    alert: DueAlert
  ): Promise<void> {
    const devices =
      await this.repository
        .getDevicesForAlert(alert.id);

    /*
     * There are no active devices for this journey.
     * The alert has nothing left to deliver.
     */
    if (devices.length === 0) {
      await this.repository
        .markAlertSent(alert.id);

      return;
    }

    for (const device of devices) {
      const delivery =
        await this.repository
          .createDelivery(
            alert.id,
            device.id
          );

      /*
       * A null delivery means another worker already
       * owns a sending delivery or the notification
       * has already been successfully sent.
       */
      if (!delivery) {
        continue;
      }

      await this.processDelivery(
        delivery.id,
        device.id,
        device.token,
        alert
      );
    }

    /*
     * Decide whether this alert is finished.
     *
     * failed deliveries remain retryable until the
     * next_attempt_at time. The worker will pick the
     * alert up again when that time arrives.
     */
    const summary =
      await this.repository
        .getDeliverySummary(alert.id);

    if (
      summary.pending === 0 &&
      summary.sending === 0 &&
      summary.failed === 0
    ) {
      await this.repository
        .markAlertSent(alert.id);
    }
  }

  private async processDelivery(
    deliveryId: string,
    deviceId: string,
    token: string,
    alert: DueAlert
  ): Promise<void> {
    const attempt =
      await this.repository
        .markSending(deliveryId);

    if (attempt === null) {
      return;
    }

    const message =
      this.buildMessage(alert);

    let result;

    try {
      result =
        await this.fcm.send({
          token,
          ...message,
        });
    } catch (error) {
      console.error(
        "FCM client threw while sending notification",
        {
          deliveryId,
          deviceId,
          alertId: alert.id,
          error,
        }
      );

      result = {
        success: false,
        errorCode: "FCM_CLIENT_ERROR",
        errorMessage:
          error instanceof Error
            ? error.message
            : "FCM client error.",
      };
    }

    if (result.success) {
      await this.repository
        .markSent(deliveryId);

      return;
    }

    if (
      isPermanentFcmError(
        result.errorCode
      )
    ) {
      await this.repository
        .invalidateDevice(deviceId);

      await this.repository
        .markFailed(
          deliveryId,
          result.errorCode ??
            "INVALID_TOKEN",
          result.errorMessage ??
            "Device token is invalid.",
          new Date()
        );

      return;
    }

    if (attempt >= MAX_ATTEMPTS) {
      await this.repository
        .markFailed(
          deliveryId,
          result.errorCode ??
            "FCM_SEND_FAILED",
          result.errorMessage ??
            "FCM notification failed.",
          new Date()
        );

      return;
    }

    await this.repository
      .markFailed(
        deliveryId,
        result.errorCode ??
          "FCM_SEND_FAILED",
        result.errorMessage ??
          "FCM notification failed.",
        retryAt(attempt)
      );
  }

  private buildMessage(
    alert: DueAlert
  ) {
    const offset =
      alert.offsetMinutes;

    const title =
      offset === 0
        ? "Your train is arriving"
        : "Train Alert";

    const body =
      offset === 0
        ? `${alert.trainNumber} is arriving at ${alert.destinationStationName}.`
        : `${alert.trainNumber} reaches ${alert.destinationStationName} in ${offset} minutes.`;

    return {
      title,
      body,
      data: {
        type:
          "journey_alert",

        journeyId:
          alert.journeyId,

        alertId:
          String(alert.id),

        offsetMinutes:
          String(offset),
      },
    };
  }
}