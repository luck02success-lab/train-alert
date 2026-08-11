import { describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresDatabase } from "../src/postgres.js";
import {
  PostgresJourneyRepository,
} from "../src/journey-repository.js";

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === "true";

describe.skipIf(!runIntegration)(
  "PostgreSQL journey lifecycle integration",
  () => {
    it(
      "creates, refreshes and cancels a journey transactionally",
      async () => {
        const db = new PostgresDatabase();
        const raw = new pg.Pool({
          connectionString:
            process.env.DATABASE_URL,
        });

        const userId =
          "00000000-0000-0000-0000-000000000001";

        const journeyId =
          "00000000-0000-0000-0000-000000000002";

        try {
          /*
           * Use deterministic IDs so cleanup is safe and
           * repeatable.
           */
          await raw.query(
            `
            INSERT INTO users (id)
            VALUES ($1)
            ON CONFLICT (id) DO NOTHING
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
            new PostgresJourneyRepository(db);

          const eta = new Date(
            "2026-08-11T19:00:00.000Z"
          );

          const journey = {
            id: journeyId,
            userId,
            trainNumber: "12919",
            journeyDate: "2026-08-11",
            destinationStationCode: "NDLS",
            destinationStationName:
              "New Delhi",
            state: "active" as const,
            providerState:
              "available" as const,
            currentEta: eta,
            currentDelayMinutes: 10,
            lastProviderUpdateAt:
              new Date(
                "2026-08-11T16:00:00.000Z"
              ),
            scheduleVersion: 0,
          };

          // 1. CREATE
          const created =
            await repository.createWithAlerts(
              journey
            );

          expect(created.id).toBe(journeyId);
          expect(created.userId).toBe(userId);

          // 2. VERIFY FIVE ALERTS
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

          expect(initialAlerts.rows).toHaveLength(5);

          expect(
            initialAlerts.rows.map(
              (row) => Number(row.offset_minutes)
            )
          ).toEqual([120, 60, 30, 15, 0]);

          expect(
            initialAlerts.rows.every(
              (row) =>
                row.schedule_version === 0 &&
                row.state === "pending"
            )
          ).toBe(true);

          // 3. READ
          const found =
            await repository.findByIdForUser(
              journeyId,
              userId
            );

          expect(found).not.toBeNull();
          expect(found!.destinationStationCode)
            .toBe("NDLS");

          // 4. USER ISOLATION
          const otherUser =
            await repository.findByIdForUser(
              journeyId,
              "00000000-0000-0000-0000-000000000099"
            );

          expect(otherUser).toBeNull();

          // 5. REFRESH ETA
          const newEta = new Date(
            "2026-08-11T19:30:00.000Z"
          );

          const refreshed =
            await repository.refreshEta(
              journeyId,
              newEta,
              40,
              new Date(
                "2026-08-11T16:30:00.000Z"
              )
            );

          expect(refreshed).not.toBeNull();
          expect(
            refreshed!.currentEta!.toISOString()
          ).toBe(newEta.toISOString());

          expect(
            refreshed!.scheduleVersion
          ).toBe(1);

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
              GROUP BY schedule_version, state
              ORDER BY schedule_version, state
              `,
              [journeyId]
            );

          const oldAlerts =
            alertsAfterRefresh.rows.filter(
              (row) =>
                row.schedule_version === 0
            );

          const newAlerts =
            alertsAfterRefresh.rows.filter(
              (row) =>
                row.schedule_version === 1
            );

          expect(oldAlerts).toHaveLength(1);
          expect(oldAlerts[0].state).toBe(
            "cancelled"
          );
          expect(oldAlerts[0].count).toBe(5);

          expect(newAlerts).toHaveLength(1);
          expect(newAlerts[0].state).toBe(
            "pending"
          );
          expect(newAlerts[0].count).toBe(5);

          // 7. SENT HISTORY IS PRESERVED
          await raw.query(
            `
            UPDATE alerts
            SET state = 'sent'
            WHERE journey_id = $1
              AND schedule_version = 1
              AND offset_minutes = 120
            `,
            [journeyId]
          );

          const cancelled =
            await repository.cancel(
              journeyId,
              userId
            );

          expect(cancelled).not.toBeNull();
          expect(cancelled!.state).toBe(
            "cancelled"
          );

          // 8. CANCEL ONLY PENDING ALERTS
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

          const counts = new Map(
            finalAlerts.rows.map((row) => [
              row.state,
              row.count,
            ])
          );

          expect(counts.get("sent")).toBe(1);
          expect(counts.get("cancelled"))
            .toBe(9);

          // 9. TERMINAL JOURNEY CANNOT BE
          // CANCELLED AGAIN.
          const secondCancel =
            await repository.cancel(
              journeyId,
              userId
            );

          expect(secondCancel).toBeNull();
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
