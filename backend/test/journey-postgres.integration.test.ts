import {
  describe,
  expect,
  it,
} from "vitest";

import pg from "pg";

import {
  PostgresDatabase,
} from "../src/postgres.js";

import {
  PostgresJourneyRepository,
} from "../src/journey-repository.js";

const runIntegration =
  process.env
    .RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!runIntegration)(
  "PostgreSQL journey lifecycle integration",
  () => {
    it(
      "creates, refreshes and cancels a journey transactionally",
      async () => {
        const db =
          new PostgresDatabase();

        const raw =
          new pg.Pool({
            connectionString:
              process.env
                .DATABASE_URL,
          });

        const userId =
          "00000000-0000-0000-0000-000000000001";

        const journeyId =
          "00000000-0000-0000-0000-000000000002";

        try {
          await raw.query(
            `
            INSERT INTO users (id)
            VALUES ($1)
            ON CONFLICT (id)
            DO NOTHING
            `,
            [userId]
          );

          await raw.query(
            `
            DELETE FROM notification_deliveries
            WHERE alert_id IN (
              SELECT id
              FROM alerts
              WHERE journey_id = $1
            )
            `,
            [journeyId]
          );

          await raw.query(
            `
            DELETE FROM alerts
            WHERE journey_id = $1
            `,
            [journeyId]
          );

          await raw.query(
            `
            DELETE FROM journeys
            WHERE id = $1
            `,
            [journeyId]
          );

          const repository =
            new PostgresJourneyRepository(
              db
            );

          const eta =
            new Date(
              Date.now() +
                4 * 60 * 60 * 1000
            );

          const journey = {
            id: journeyId,

            userId,

            trainNumber:
              "12919",

            journeyDate:
              "2026-08-14",

            destinationStationCode:
              "NDLS",

            destinationStationName:
              "New Delhi",

            state:
              "active" as const,

            providerState:
              "available" as const,

            currentEta:
              eta,

            currentDelayMinutes:
              10,

            lastProviderUpdateAt:
              new Date(),

            scheduleVersion:
              0,

            alertOffsetsMinutes: [
              120,
              60,
              30,
              15,
            ],
          };

          // 1. CREATE
          const created =
            await repository
              .createWithAlerts(
                journey
              );

          expect(
            created.id
          ).toBe(journeyId);

          expect(
            created.userId
          ).toBe(userId);

          expect(
            created.alertOffsetsMinutes
          ).toEqual([
            120,
            60,
            30,
            15,
          ]);

          // 2. VERIFY FOUR DEFAULT ALERTS
          const initialAlerts =
            await raw.query(
              `
              SELECT
                offset_minutes,
                schedule_version,
                state
              FROM alerts
              WHERE journey_id = $1
              ORDER BY offset_minutes DESC
              `,
              [journeyId]
            );

          expect(
            initialAlerts.rows
          ).toHaveLength(4);

          expect(
            initialAlerts.rows.map(
              (row) =>
                Number(
                  row.offset_minutes
                )
            )
          ).toEqual([
            120,
            60,
            30,
            15,
          ]);

          expect(
            initialAlerts.rows.every(
              (row) =>
                row.schedule_version ===
                  0 &&
                row.state ===
                  "pending"
            )
          ).toBe(true);

          // 3. READ
          const found =
            await repository
              .findByIdForUser(
                journeyId,
                userId
              );

          expect(
            found
          ).not.toBeNull();

          expect(
            found!
              .destinationStationCode
          ).toBe("NDLS");

          expect(
            found!
              .alertOffsetsMinutes
          ).toEqual([
            120,
            60,
            30,
            15,
          ]);

          // 4. USER ISOLATION
          const otherUser =
            await repository
              .findByIdForUser(
                journeyId,
                "00000000-0000-0000-0000-000000000099"
              );

          expect(
            otherUser
          ).toBeNull();

          // 5. REFRESH ETA
          const newEta =
            new Date(
              eta.getTime() +
                30 * 60 * 1000
            );

          const refreshed =
            await repository
              .refreshEta(
                journeyId,
                newEta,
                40,
                new Date()
              );

          expect(
            refreshed
          ).not.toBeNull();

          expect(
            refreshed!
              .currentEta!
              .toISOString()
          ).toBe(
            newEta.toISOString()
          );

          expect(
            refreshed!
              .scheduleVersion
          ).toBe(1);

          expect(
            refreshed!
              .alertOffsetsMinutes
          ).toEqual([
            120,
            60,
            30,
            15,
          ]);

          // 6. OLD PENDING ALERTS CANCELLED
          const alertsAfterRefresh =
            await raw.query(
              `
              SELECT
                schedule_version,
                state,
                COUNT(*)::int AS count
              FROM alerts
              WHERE journey_id = $1
              GROUP BY
                schedule_version,
                state
              ORDER BY
                schedule_version,
                state
              `,
              [journeyId]
            );

          const oldAlerts =
            alertsAfterRefresh
              .rows
              .filter(
                (row) =>
                  row.schedule_version ===
                  0
              );

          const newAlerts =
            alertsAfterRefresh
              .rows
              .filter(
                (row) =>
                  row.schedule_version ===
                  1
              );

          expect(
            oldAlerts
          ).toHaveLength(1);

          expect(
            oldAlerts[0].state
          ).toBe(
            "cancelled"
          );

          expect(
            oldAlerts[0].count
          ).toBe(4);

          expect(
            newAlerts
          ).toHaveLength(1);

          expect(
            newAlerts[0].state
          ).toBe(
            "pending"
          );

          expect(
            newAlerts[0].count
          ).toBe(4);

          // 7. USER CHANGES ALERT PREFERENCES
          const updated =
            await repository
              .updateAlertPreferences(
                journeyId,
                userId,
                [30, 15]
              );

          expect(
            updated
          ).not.toBeNull();

          expect(
            updated!
              .alertOffsetsMinutes
          ).toEqual([
            30,
            15,
          ]);

          expect(
            updated!
              .scheduleVersion
          ).toBe(2);

          const alertsAfterPreferences =
            await raw.query(
              `
              SELECT
                schedule_version,
                offset_minutes,
                state
              FROM alerts
              WHERE journey_id = $1
              ORDER BY
                schedule_version,
                offset_minutes DESC
              `,
              [journeyId]
            );

          expect(
            alertsAfterPreferences
              .rows
              .filter(
                (row) =>
                  row.schedule_version ===
                  2
              )
              .map(
                (row) =>
                  Number(
                    row.offset_minutes
                  )
              )
          ).toEqual([
            30,
            15,
          ]);

          expect(
            alertsAfterPreferences
              .rows
              .filter(
                (row) =>
                  row.schedule_version ===
                  2
              )
              .every(
                (row) =>
                  row.state ===
                  "pending"
              )
          ).toBe(true);

          // 8. PRESERVE SENT HISTORY
          await raw.query(
            `
            UPDATE alerts
            SET state = 'sent'
            WHERE journey_id = $1
              AND schedule_version = 2
              AND offset_minutes = 30
            `,
            [journeyId]
          );

          const cancelled =
            await repository
              .cancel(
                journeyId,
                userId
              );

          expect(
            cancelled
          ).not.toBeNull();

          expect(
            cancelled!.state
          ).toBe(
            "cancelled"
          );

          // 9. CANCEL ONLY PENDING ALERTS
          const finalAlerts =
            await raw.query(
              `
              SELECT
                state,
                COUNT(*)::int AS count
              FROM alerts
              WHERE journey_id = $1
              GROUP BY state
              ORDER BY state
              `,
              [journeyId]
            );

          const counts =
            new Map(
              finalAlerts.rows.map(
                (row) => [
                  row.state,
                  row.count,
                ]
              )
            );

          expect(
            counts.get("sent")
          ).toBe(1);

          expect(
            counts.get("cancelled")
          ).toBe(7);

          // 10. TERMINAL JOURNEY
          // CANNOT BE CANCELLED AGAIN
          const secondCancel =
            await repository
              .cancel(
                journeyId,
                userId
              );

          expect(
            secondCancel
          ).toBeNull();
        } finally {
          await raw.query(
            `
            DELETE FROM notification_deliveries
            WHERE alert_id IN (
              SELECT id
              FROM alerts
              WHERE journey_id = $1
            )
            `,
            [journeyId]
          );

          await raw.query(
            `
            DELETE FROM alerts
            WHERE journey_id = $1
            `,
            [journeyId]
          );

          await raw.query(
            `
            DELETE FROM journeys
            WHERE id = $1
            `,
            [journeyId]
          );

          await raw.query(
            `
            DELETE FROM users
            WHERE id = $1
            `,
            [userId]
          );

          await raw.end();

          await db.close();
        }
      },
      30_000
    );
  }
);