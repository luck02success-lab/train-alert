import type {
  PostgresClient,
} from "./journey-repository.js";

export type NotificationDeliveryState =
  | "pending"
  | "sending"
  | "sent"
  | "failed";

export interface DueAlert {
  id: number;
  journeyId: string;
  offsetMinutes: number;
  scheduledFor: Date;

  trainNumber: string;
  destinationStationName: string;

  currentEta: Date | null;
}

export interface NotificationDevice {
  id: string;
  userId: string;
  token: string;
}

export interface NotificationDelivery {
  id: string;
  alertId: number;
  deviceId: string;
  state: NotificationDeliveryState;
  attemptCount: number;
  nextAttemptAt: Date;
}

export interface NotificationRepository {
  claimDueAlerts(
    limit: number
  ): Promise<DueAlert[]>;

  getDevicesForAlert(
    alertId: number
  ): Promise<NotificationDevice[]>;

  createDelivery(
    alertId: number,
    deviceId: string
  ): Promise<NotificationDelivery | null>;

  markSending(
    deliveryId: string
  ): Promise<number | null>;

  markSent(
    deliveryId: string
  ): Promise<void>;

  markFailed(
    deliveryId: string,
    errorCode: string,
    errorMessage: string,
    nextAttemptAt: Date
  ): Promise<void>;

  invalidateDevice(
    deviceId: string
  ): Promise<void>;

  releaseAlert(
    alertId: number
  ): Promise<void>;
}

type AlertRow = {
  id: number;
  journeyId: string;
  offsetMinutes: number;
  scheduledFor: Date;
  trainNumber: string;
  destinationStationName: string;
  currentEta: Date | null;
};

type DeviceRow = {
  id: string;
  userId: string;
  token: string;
};

type DeliveryRow = {
  id: string;
  alertId: number;
  deviceId: string;
  state: NotificationDeliveryState;
  attemptCount: number;
  nextAttemptAt: Date;
};

export class PostgresNotificationRepository
  implements NotificationRepository
{
  constructor(
    private readonly db: PostgresClient
  ) {}

  async claimDueAlerts(
    limit: number
  ): Promise<DueAlert[]> {
    const result =
      await this.db.query<AlertRow>(
        `
        WITH claimed AS (
          SELECT a.id
          FROM alerts a
          WHERE a.state = 'pending'
            AND a.scheduled_for <= now()
          ORDER BY a.scheduled_for ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE alerts a
        SET state = 'sending'
        FROM claimed
        WHERE a.id = claimed.id
        RETURNING
          a.id,
          a.journey_id AS "journeyId",
          a.offset_minutes AS "offsetMinutes",
          a.scheduled_for AS "scheduledFor",
          (
            SELECT j.train_number
            FROM journeys j
            WHERE j.id = a.journey_id
          ) AS "trainNumber",
          (
            SELECT j.destination_station_name
            FROM journeys j
            WHERE j.id = a.journey_id
          ) AS "destinationStationName",
          (
            SELECT j.current_eta
            FROM journeys j
            WHERE j.id = a.journey_id
          ) AS "currentEta"
        `,
        [limit]
      );

    return result.rows.map(
      (row) => ({
        id: row.id,
        journeyId:
          row.journeyId,
        offsetMinutes:
          row.offsetMinutes,
        scheduledFor:
          row.scheduledFor,
        trainNumber:
          row.trainNumber,
        destinationStationName:
          row.destinationStationName,
        currentEta:
          row.currentEta,
      })
    );
  }

  async getDevicesForAlert(
    alertId: number
  ): Promise<NotificationDevice[]> {
    const result =
      await this.db.query<DeviceRow>(
        `
        SELECT
          d.id,
          d.user_id AS "userId",
          d.fcm_token AS token
        FROM alerts a
        JOIN journeys j
          ON j.id = a.journey_id
        JOIN devices d
          ON d.user_id = j.user_id
        WHERE a.id = $1
          AND d.invalidated_at IS NULL
        `,
        [alertId]
      );

    return result.rows;
  }

  async createDelivery(
    alertId: number,
    deviceId: string
  ): Promise<NotificationDelivery | null> {
    const result =
      await this.db.query<DeliveryRow>(
        `
        INSERT INTO notification_deliveries (
          alert_id,
          device_id
        )
        VALUES ($1, $2)

        ON CONFLICT (
          alert_id,
          device_id
        )
        DO UPDATE
        SET
          updated_at =
            notification_deliveries.updated_at

        WHERE notification_deliveries.state
          IN ('pending', 'failed')

        RETURNING
          id,
          alert_id AS "alertId",
          device_id AS "deviceId",
          state,
          attempt_count AS "attemptCount",
          next_attempt_at AS "nextAttemptAt"
        `,
        [
          alertId,
          deviceId,
        ]
      );

    const row = result.rows[0];

    return row ?? null;
  }

  async markSending(
    deliveryId: string
  ): Promise<number | null> {
    const result =
      await this.db.query<{
        attemptCount: number;
      }>(
        `
        UPDATE notification_deliveries
        SET
          state = 'sending',
          attempt_count =
            attempt_count + 1,
          updated_at = now()
        WHERE id = $1
          AND state IN ('pending', 'failed')
          AND next_attempt_at <= now()
        RETURNING
          attempt_count AS "attemptCount"
        `,
        [deliveryId]
      );

    return (
      result.rows[0]?.attemptCount ??
      null
    );
  }

  async markSent(
    deliveryId: string
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE notification_deliveries
      SET
        state = 'sent',
        sent_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [deliveryId]
    );
  }

  async markFailed(
    deliveryId: string,
    errorCode: string,
    errorMessage: string,
    nextAttemptAt: Date
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE notification_deliveries
      SET
        state = 'failed',
        last_error_code = $2,
        last_error_message = $3,
        next_attempt_at = $4,
        updated_at = now()
      WHERE id = $1
      `,
      [
        deliveryId,
        errorCode,
        errorMessage,
        nextAttemptAt,
      ]
    );
  }

  async invalidateDevice(
    deviceId: string
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE devices
      SET invalidated_at = now()
      WHERE id = $1
        AND invalidated_at IS NULL
      `,
      [deviceId]
    );
  }

  async releaseAlert(
    alertId: number
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE alerts
      SET
        state = 'pending'
      WHERE id = $1
        AND state = 'sending'
      `,
      [alertId]
    );
  }
}