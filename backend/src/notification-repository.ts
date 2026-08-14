import type {
  PostgresClient,
} from "./journey-repository.js";

export type NotificationDeliveryState =
  | "pending"
  | "sending"
  | "sent"
  | "failed";

export interface DueAlert {
  id: string;
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
  alertId: string;
  deviceId: string;
  state: NotificationDeliveryState;
  attemptCount: number;
  nextAttemptAt: Date;
}

export interface NotificationDeliverySummary {
  pending: number;
  sending: number;
  retryableFailed: number;
}

export interface NotificationRepository {
  claimDueAlerts(
    limit: number
  ): Promise<DueAlert[]>;

  getDevicesForAlert(
    alertId: string
  ): Promise<NotificationDevice[]>;

  createDelivery(
    alertId: string,
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

  markPermanentlyFailed(
    deliveryId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void>;

  invalidateDevice(
    deviceId: string
  ): Promise<void>;

  getDeliverySummary(
    alertId: string
  ): Promise<NotificationDeliverySummary>;

  markAlertSent(
    alertId: string
  ): Promise<void>;

  releaseAlert(
    alertId: string
  ): Promise<void>;
}

type AlertRow = {
  id: string;
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
  alertId: string;
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
  /*
   * Recover deliveries that were left in "sending" because
   * a worker crashed or timed out.
   */
  await this.db.query(
    `
    UPDATE notification_deliveries
    SET
      state = 'failed',
      next_attempt_at = now(),
      last_error_code =
        'WORKER_TIMEOUT',
      last_error_message =
        'Previous notification worker timed out.',
      updated_at = now()
    WHERE state = 'sending'
      AND updated_at <=
        now() - interval '5 minutes'
    `,
    []
  );

  /*
   * ----------------------------------------------------------
   * RETRIES
   * ----------------------------------------------------------
   *
   * First select candidate IDs with DISTINCT ON.
   * Then lock the actual alert rows in the outer SELECT.
   *
   * This avoids PostgreSQL:
   *
   *   FOR UPDATE is not allowed with DISTINCT clause
   */
  const retryResult =
    await this.db.query<AlertRow>(
      `
      WITH retry_candidates AS (
        SELECT id
        FROM (
          SELECT DISTINCT ON (a.journey_id)
            a.id
          FROM alerts a
          JOIN journeys j
            ON j.id = a.journey_id
          WHERE
            a.state = 'sending'
            AND j.state IN (
              'scheduled',
              'active'
            )
            AND a.schedule_version =
              j.schedule_version
            AND EXISTS (
              SELECT 1
              FROM notification_deliveries d
              WHERE d.alert_id = a.id
                AND d.state IN (
                  'pending',
                  'failed'
                )
                AND (
                  d.next_attempt_at IS NULL
                  OR d.next_attempt_at <= now()
                )
            )
          ORDER BY
            a.journey_id,
            a.scheduled_for DESC
          LIMIT $1
        ) candidates
      )
      SELECT
        a.id,
        a.journey_id AS "journeyId",
        a.offset_minutes AS "offsetMinutes",
        a.scheduled_for AS "scheduledFor",
        j.train_number AS "trainNumber",
        j.destination_station_name
          AS "destinationStationName",
        j.current_eta AS "currentEta"
      FROM alerts a
      JOIN retry_candidates c
        ON c.id = a.id
      JOIN journeys j
        ON j.id = a.journey_id
      FOR UPDATE OF a SKIP LOCKED
      `,
      [limit]
    );

  if (
    retryResult.rows.length > 0
  ) {
    return retryResult.rows;
  }

  /*
   * ----------------------------------------------------------
   * NEW DUE ALERTS
   * ----------------------------------------------------------
   *
   * Important:
   * The outer query has NO parameters.
   *
   * The limit is applied inside due_candidates where $1
   * actually exists.
   */
  const result =
    await this.db.query<AlertRow>(
      `
      WITH due_candidates AS (
        SELECT *
        FROM (
          SELECT DISTINCT ON (a.journey_id)
            a.id,
            a.journey_id,
            a.offset_minutes,
            a.scheduled_for
          FROM alerts a
          JOIN journeys j
            ON j.id = a.journey_id
          WHERE
            a.state = 'pending'
            AND a.scheduled_for <= now()
            AND j.state IN (
              'scheduled',
              'active'
            )
            AND a.schedule_version =
              j.schedule_version

            /*
             * Minimum 15-minute gap between
             * successfully delivered notifications
             * for the same journey.
             */
            AND NOT EXISTS (
              SELECT 1
              FROM notification_deliveries d
              JOIN alerts sent_alert
                ON sent_alert.id =
                  d.alert_id
              WHERE sent_alert.journey_id =
                    a.journey_id
                AND d.state = 'sent'
                AND d.sent_at IS NOT NULL
                AND d.sent_at >
                  now() - interval '15 minutes'
            )

          ORDER BY
            a.journey_id,
            a.scheduled_for DESC

          LIMIT $1
        ) candidates
      ),

      /*
       * Atomically claim the selected alerts.
       */
      claimed AS (
        UPDATE alerts a
        SET
          state = 'sending'
        FROM due_candidates c
        WHERE
          a.id = c.id
          AND a.state = 'pending'
        RETURNING
          a.id,
          a.journey_id,
          a.offset_minutes,
          a.scheduled_for
      )

      SELECT
        c.id,
        c.journey_id AS "journeyId",
        c.offset_minutes AS "offsetMinutes",
        c.scheduled_for AS "scheduledFor",
        j.train_number AS "trainNumber",
        j.destination_station_name
          AS "destinationStationName",
        j.current_eta AS "currentEta"
      FROM claimed c
      JOIN journeys j
        ON j.id = c.journey_id
      `,
      [limit]
    );

  /*
   * ----------------------------------------------------------
   * CANCEL OLDER DUE ALERTS
   * ----------------------------------------------------------
   *
   * If multiple alerts became due since the last cron run,
   * only the newest one should be delivered. This also
   * reinforces our minimum notification-spacing rule.
   */
  if (
    result.rows.length > 0
  ) {
    const journeyIds = [
      ...new Set(
        result.rows.map(
          (row) =>
            row.journeyId
        )
      ),
    ];

    await this.db.query(
      `
      UPDATE alerts a
      SET
        state = 'cancelled'
      WHERE
        a.journey_id =
          ANY($1::uuid[])
        AND a.state = 'pending'
        AND a.scheduled_for <= now()

        /*
         * Never cancel the alert currently being processed.
         */
        AND NOT EXISTS (
          SELECT 1
          FROM alerts current_alert
          WHERE
            current_alert.id = a.id
            AND current_alert.state =
              'sending'
        )
      `,
      [journeyIds]
    );
  }

  return result.rows;
}

  async getDevicesForAlert(
    alertId: string
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
    alertId: string,
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

    return (
      result.rows[0] ??
      null
    );
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
          AND state IN (
            'pending',
            'failed'
          )
          AND (
            next_attempt_at IS NULL
            OR next_attempt_at <= now()
          )
        RETURNING
          attempt_count AS "attemptCount"
        `,
        [deliveryId]
      );

    return (
      result.rows[0]
        ?.attemptCount ??
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

  async markPermanentlyFailed(
    deliveryId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE notification_deliveries
      SET
        state = 'failed',
        attempt_count = 5,
        last_error_code = $2,
        last_error_message = $3,
        next_attempt_at = now(),
        updated_at = now()
      WHERE id = $1
      `,
      [
        deliveryId,
        errorCode,
        errorMessage,
      ]
    );
  }

  async invalidateDevice(
    deviceId: string
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE devices
      SET
        invalidated_at = now()
      WHERE id = $1
        AND invalidated_at IS NULL
      `,
      [deviceId]
    );
  }

  async getDeliverySummary(
    alertId: string
  ): Promise<NotificationDeliverySummary> {
    const result =
      await this.db.query<{
        pending: number;
        sending: number;
        retryableFailed: number;
      }>(
        `
        SELECT
          COUNT(*) FILTER (
            WHERE state = 'pending'
          )::int AS pending,

          COUNT(*) FILTER (
            WHERE state = 'sending'
          )::int AS sending,

          COUNT(*) FILTER (
            WHERE
              state = 'failed'
              AND attempt_count < 5
          )::int AS "retryableFailed"

        FROM notification_deliveries
        WHERE alert_id = $1
        `,
        [alertId]
      );

    const row =
      result.rows[0];

    return {
      pending:
        row?.pending ?? 0,

      sending:
        row?.sending ?? 0,

      retryableFailed:
        row?.retryableFailed ?? 0,
    };
  }

  async markAlertSent(
    alertId: string
  ): Promise<void> {
    await this.db.query(
      `
      UPDATE alerts
      SET
        state = 'sent'
      WHERE id = $1
        AND state = 'sending'
      `,
      [alertId]
    );
  }

  async releaseAlert(
    alertId: string
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