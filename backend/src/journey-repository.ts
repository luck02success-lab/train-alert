import type { Journey } from "./domain.js";

export interface JourneyRepository {
  create(journey: Journey): Promise<Journey>;

  createWithAlerts(
    journey: Journey
  ): Promise<Journey>;

  refreshEta(
    id: string,
    eta: Date,
    delayMinutes: number | null,
    observedAt: Date
  ): Promise<Journey | null>;

  updateAlertPreferences(
    id: string,
    userId: string,
    alertOffsetsMinutes: number[]
  ): Promise<Journey | null>;

  listForEtaRefresh(
    limit: number
  ): Promise<Journey[]>;

  complete(
    id: string
  ): Promise<Journey | null>;

  findByIdForUser(
    id: string,
    userId: string
  ): Promise<Journey | null>;

  listForUser(
    userId: string
  ): Promise<Journey[]>;

  cancel(
    id: string,
    userId: string
  ): Promise<Journey | null>;

  nextAlertForJourney(
    journeyId: string
  ): Promise<Date | null>;
}

export interface PostgresClient {
  query<T>(
    sql: string,
    parameters: readonly unknown[]
  ): Promise<{
    rows: T[];
  }>;

  transaction<T>(
    work: (
      client: PostgresClient
    ) => Promise<T>
  ): Promise<T>;
}

type JourneyRow = {
  id: string;
  userId: string;
  trainNumber: string;
  journeyDate: string;
  destinationStationCode: string;
  destinationStationName: string;
  state: Journey["state"];
  providerState: Journey["providerState"];
  currentEta: Date | null;
  currentDelayMinutes: number | null;
  lastProviderUpdateAt: Date | null;
  scheduleVersion: number;
  alertOffsetsMinutes: number[];
  createdAt?: Date;
  updatedAt?: Date;
};

const DEFAULT_ALERT_OFFSETS = [
  120,
  60,
  30,
  15,
];

function mapJourney(
  row: JourneyRow
): Journey {
  return {
    id: row.id,
    userId: row.userId,
    trainNumber: row.trainNumber,
    journeyDate: row.journeyDate,
    destinationStationCode:
      row.destinationStationCode,
    destinationStationName:
      row.destinationStationName,
    state: row.state,
    providerState: row.providerState,
    currentEta: row.currentEta,
    currentDelayMinutes:
      row.currentDelayMinutes,
    lastProviderUpdateAt:
      row.lastProviderUpdateAt,
    scheduleVersion:
      row.scheduleVersion,
    alertOffsetsMinutes:
      row.alertOffsetsMinutes ??
      DEFAULT_ALERT_OFFSETS,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const JOURNEY_COLUMNS = `
  id,
  user_id AS "userId",
  train_number AS "trainNumber",
  journey_date::text AS "journeyDate",
  destination_station_code AS "destinationStationCode",
  destination_station_name AS "destinationStationName",
  state,
  provider_state AS "providerState",
  current_eta AS "currentEta",
  current_delay_minutes AS "currentDelayMinutes",
  last_provider_update_at AS "lastProviderUpdateAt",
  schedule_version AS "scheduleVersion",
  alert_offsets_minutes AS "alertOffsetsMinutes",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

function futureAlertOffsets(
  eta: Date,
  offsets: number[]
): number[] {
  const now =
    Date.now();

  return offsets.filter(
    (offset) =>
      eta.getTime() -
        offset * 60_000 >
      now
  );
}

async function insertAlerts(
  db: PostgresClient,
  journeyId: string,
  eta: Date,
  scheduleVersion: number,
  offsets: number[]
): Promise<void> {
  for (
    const offset of futureAlertOffsets(
      eta,
      offsets
    )
  ) {
    await db.query(
      `
      INSERT INTO alerts (
        journey_id,
        offset_minutes,
        schedule_version,
        scheduled_for,
        state
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'pending'
      )
      ON CONFLICT (
        journey_id,
        offset_minutes,
        schedule_version
      )
      DO NOTHING
      `,
      [
        journeyId,
        offset,
        scheduleVersion,
        new Date(
          eta.getTime() -
            offset * 60_000
        ),
      ]
    );
  }
}

export class PostgresJourneyRepository
  implements JourneyRepository
{
  constructor(
    private readonly db: PostgresClient
  ) {}

  async create(
    journey: Journey
  ): Promise<Journey> {
    const result =
      await this.db.query<JourneyRow>(
        `
        INSERT INTO journeys (
          id,
          user_id,
          train_number,
          journey_date,
          destination_station_code,
          destination_station_name,
          state,
          provider_state,
          current_eta,
          current_delay_minutes,
          last_provider_update_at,
          schedule_version,
          alert_offsets_minutes
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        RETURNING ${JOURNEY_COLUMNS}
        `,
        [
          journey.id,
          journey.userId,
          journey.trainNumber,
          journey.journeyDate,
          journey.destinationStationCode,
          journey.destinationStationName,
          journey.state,
          journey.providerState,
          journey.currentEta,
          journey.currentDelayMinutes,
          journey.lastProviderUpdateAt,
          journey.scheduleVersion,
          journey.alertOffsetsMinutes,
        ]
      );

    return mapJourney(
      result.rows[0]!
    );
  }

  async createWithAlerts(
    journey: Journey
  ): Promise<Journey> {
    return this.db.transaction(
      async (db) => {
        const repository =
          new PostgresJourneyRepository(
            db
          );

        const created =
          await repository.create(
            journey
          );

        if (
          !created.currentEta
        ) {
          throw new Error(
            "Cannot create alerts without an ETA"
          );
        }

        await insertAlerts(
          db,
          created.id,
          created.currentEta,
          created.scheduleVersion,
          created.alertOffsetsMinutes
        );

        return created;
      }
    );
  }

  async refreshEta(
    id: string,
    eta: Date,
    delayMinutes: number | null,
    observedAt: Date
  ): Promise<Journey | null> {
    return this.db.transaction(
      async (db) => {
        const result =
          await db.query<JourneyRow>(
            `
            UPDATE journeys
            SET
              current_eta = $2,
              current_delay_minutes = $3,
              last_provider_update_at = $4,

              schedule_version =
                CASE
                  WHEN current_eta IS DISTINCT FROM $2
                    THEN schedule_version + 1
                  ELSE schedule_version
                END,

              state =
                CASE
                  WHEN $2 <= now()
                    THEN 'completed'::journey_state
                  ELSE state
                END,

              updated_at = now()

            WHERE id = $1
              AND state IN (
                'scheduled',
                'active'
              )
              AND (
                last_provider_update_at IS NULL
                OR last_provider_update_at <= $4
              )

            RETURNING ${JOURNEY_COLUMNS}
            `,
            [
              id,
              eta,
              delayMinutes,
              observedAt,
            ]
          );

        const row =
          result.rows[0];

        if (!row) {
          return null;
        }

        /*
         * Any ETA change creates a new schedule version.
         *
         * Any journey completion cancels every pending alert.
         */
        await db.query(
          `
          UPDATE alerts
          SET
            state = 'cancelled'
          WHERE journey_id = $1
            AND state = 'pending'
            AND (
              schedule_version < $2
              OR $3 = 'completed'
            )
          `,
          [
            id,
            row.scheduleVersion,
            row.state,
          ]
        );

        /*
         * Only the current schedule version is eligible for
         * new alerts, and insertAlerts() only creates future
         * alert times.
         */
        if (
          row.state !== "completed" &&
          row.currentEta
        ) {
          await insertAlerts(
            db,
            id,
            row.currentEta,
            row.scheduleVersion,
            row.alertOffsetsMinutes
          );
        }

        return mapJourney(row);
      }
    );
  }

  async updateAlertPreferences(
    id: string,
    userId: string,
    alertOffsetsMinutes: number[]
  ): Promise<Journey | null> {
    return this.db.transaction(
      async (db) => {
        const result =
          await db.query<JourneyRow>(
            `
            UPDATE journeys
            SET
              alert_offsets_minutes = $3,
              schedule_version =
                schedule_version + 1,
              updated_at = now()

            WHERE id = $1
              AND user_id = $2
              AND state IN (
                'scheduled',
                'active'
              )

            RETURNING ${JOURNEY_COLUMNS}
            `,
            [
              id,
              userId,
              alertOffsetsMinutes,
            ]
          );

        const row =
          result.rows[0];

        if (!row) {
          return null;
        }

        await db.query(
          `
          UPDATE alerts
          SET
            state = 'cancelled'
          WHERE journey_id = $1
            AND state = 'pending'
            AND schedule_version < $2
          `,
          [
            id,
            row.scheduleVersion,
          ]
        );

        if (
          row.currentEta
        ) {
          await insertAlerts(
            db,
            id,
            row.currentEta,
            row.scheduleVersion,
            row.alertOffsetsMinutes
          );
        }

        return mapJourney(row);
      }
    );
  }

  async listForEtaRefresh(
    limit: number
  ): Promise<Journey[]> {
    const result =
      await this.db.query<JourneyRow>(
        `
        SELECT ${JOURNEY_COLUMNS}
        FROM journeys
        WHERE state IN (
          'scheduled',
          'active'
        )
        AND (
          last_provider_update_at IS NULL
          OR last_provider_update_at <=
            now() - interval '5 minutes'
        )
        ORDER BY
          last_provider_update_at ASC NULLS FIRST,
          created_at ASC
        LIMIT $1
        `,
        [limit]
      );

    return result.rows.map(
      mapJourney
    );
  }

  async complete(
    id: string
  ): Promise<Journey | null> {
    return this.db.transaction(
      async (db) => {
        const result =
          await db.query<JourneyRow>(
            `
            UPDATE journeys
            SET
              state = 'completed',
              updated_at = now()
            WHERE id = $1
              AND state IN (
                'scheduled',
                'active'
              )
            RETURNING ${JOURNEY_COLUMNS}
            `,
            [id]
          );

        const row =
          result.rows[0];

        if (!row) {
          return null;
        }

        await db.query(
          `
          UPDATE alerts
          SET
            state = 'cancelled'
          WHERE journey_id = $1
            AND state = 'pending'
          `,
          [id]
        );

        return mapJourney(row);
      }
    );
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<Journey | null> {
    const result =
      await this.db.query<JourneyRow>(
        `
        SELECT ${JOURNEY_COLUMNS}
        FROM journeys
        WHERE id = $1
          AND user_id = $2
        `,
        [
          id,
          userId,
        ]
      );

    return result.rows[0]
      ? mapJourney(
          result.rows[0]
        )
      : null;
  }

  async listForUser(
    userId: string
  ): Promise<Journey[]> {
    const result =
      await this.db.query<JourneyRow>(
        `
        SELECT ${JOURNEY_COLUMNS}
        FROM journeys
        WHERE user_id = $1
        ORDER BY
          CASE state
            WHEN 'active' THEN 0
            WHEN 'scheduled' THEN 1
            WHEN 'completed' THEN 2
            WHEN 'cancelled' THEN 3
            ELSE 4
          END,
          created_at DESC
        `,
        [userId]
      );

    return result.rows.map(
      mapJourney
    );
  }

  async cancel(
    id: string,
    userId: string
  ): Promise<Journey | null> {
    return this.db.transaction(
      async (db) => {
        const result =
          await db.query<JourneyRow>(
            `
            UPDATE journeys
            SET
              state = 'cancelled',
              updated_at = now()

            WHERE id = $1
              AND user_id = $2
              AND state IN (
                'scheduled',
                'active'
              )

            RETURNING ${JOURNEY_COLUMNS}
            `,
            [
              id,
              userId,
            ]
          );

        const row =
          result.rows[0];

        if (!row) {
          return null;
        }

        await db.query(
          `
          UPDATE alerts
          SET
            state = 'cancelled'
          WHERE journey_id = $1
            AND state = 'pending'
          `,
          [id]
        );

        return mapJourney(row);
      }
    );
  }

  async nextAlertForJourney(
    journeyId: string
  ): Promise<Date | null> {
    const result =
      await this.db.query<{
        scheduledFor: Date;
      }>(
        `
        SELECT
          scheduled_for AS "scheduledFor"
        FROM alerts
        WHERE journey_id = $1
          AND state = 'pending'
          AND scheduled_for >= now()
        ORDER BY
          scheduled_for ASC
        LIMIT 1
        `,
        [journeyId]
      );

    return (
      result.rows[0]
        ?.scheduledFor ??
      null
    );
  }
}