import type { PostgresClient } from "./journey-repository.js";

export interface Device {
  id: string;
  userId: string;
  platform: "android";
  fcmToken: string;
  invalidatedAt: Date | null;
  createdAt: Date;
}

export interface DeviceRepository {
  register(
    userId: string,
    platform: "android",
    fcmToken: string
  ): Promise<Device>;

  invalidate(
    id: string,
    userId: string
  ): Promise<Device | null>;

  listForUser(
    userId: string
  ): Promise<Device[]>;
}

type DeviceRow = {
  id: string;
  userId: string;
  platform: "android";
  fcmToken: string;
  invalidatedAt: Date | null;
  createdAt: Date;
};

const DEVICE_COLUMNS = `
  id,
  user_id AS "userId",
  platform,
  fcm_token AS "fcmToken",
  invalidated_at AS "invalidatedAt",
  created_at AS "createdAt"
`;

function mapDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    userId: row.userId,
    platform: row.platform,
    fcmToken: row.fcmToken,
    invalidatedAt: row.invalidatedAt,
    createdAt: row.createdAt,
  };
}

export class PostgresDeviceRepository
  implements DeviceRepository
{
  constructor(
    private readonly db: PostgresClient
  ) {}

  async register(
    userId: string,
    platform: "android",
    fcmToken: string
  ): Promise<Device> {
    const result =
      await this.db.query<DeviceRow>(
        `
        INSERT INTO devices (
          user_id,
          platform,
          fcm_token,
          invalidated_at
        )
        VALUES ($1, $2, $3, NULL)
        ON CONFLICT (user_id, fcm_token)
        DO UPDATE SET
          platform = EXCLUDED.platform,
          invalidated_at = NULL
        RETURNING ${DEVICE_COLUMNS}
        `,
        [
          userId,
          platform,
          fcmToken,
        ]
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Device registration failed."
      );
    }

    return mapDevice(row);
  }

  async invalidate(
    id: string,
    userId: string
  ): Promise<Device | null> {
    const result =
      await this.db.query<DeviceRow>(
        `
        UPDATE devices
        SET invalidated_at = now()
        WHERE id = $1
          AND user_id = $2
          AND invalidated_at IS NULL
        RETURNING ${DEVICE_COLUMNS}
        `,
        [id, userId]
      );

    const row = result.rows[0];

    return row
      ? mapDevice(row)
      : null;
  }

  async listForUser(
    userId: string
  ): Promise<Device[]> {
    const result =
      await this.db.query<DeviceRow>(
        `
        SELECT ${DEVICE_COLUMNS}
        FROM devices
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId]
      );

    return result.rows.map(mapDevice);
  }
}