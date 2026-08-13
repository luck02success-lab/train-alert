import type { PostgresClient } from "./journey-repository.js";

export interface User {
  id: string;
  firebaseUid: string | null;
  createdAt: Date;
}

export interface UserRepository {
  create(): Promise<User>;
  findByFirebaseUid(
    firebaseUid: string
  ): Promise<User | null>;
  createOrGetByFirebaseUid(
    firebaseUid: string
  ): Promise<User>;
}

type UserRow = {
  id: string;
  firebaseUid: string | null;
  createdAt: Date;
};

const USER_COLUMNS = `
  id,
  firebase_uid AS "firebaseUid",
  created_at AS "createdAt"
`;

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    firebaseUid: row.firebaseUid,
    createdAt: row.createdAt,
  };
}

export class PostgresUserRepository
  implements UserRepository
{
  constructor(
    private readonly db: PostgresClient
  ) {}

  async create(): Promise<User> {
    const result =
      await this.db.query<UserRow>(
        `
        INSERT INTO users DEFAULT VALUES
        RETURNING ${USER_COLUMNS}
        `,
        []
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "User creation failed."
      );
    }

    return mapUser(row);
  }

  async findByFirebaseUid(
    firebaseUid: string
  ): Promise<User | null> {
    const result =
      await this.db.query<UserRow>(
        `
        SELECT
          ${USER_COLUMNS}
        FROM users
        WHERE firebase_uid = $1
        LIMIT 1
        `,
        [firebaseUid]
      );

    const row = result.rows[0];

    return row
      ? mapUser(row)
      : null;
  }

  async createOrGetByFirebaseUid(
    firebaseUid: string
  ): Promise<User> {
    const result =
      await this.db.query<UserRow>(
        `
        INSERT INTO users (
          firebase_uid
        )
        VALUES ($1)
        ON CONFLICT (firebase_uid)
        DO UPDATE SET
          firebase_uid = EXCLUDED.firebase_uid
        RETURNING ${USER_COLUMNS}
        `,
        [firebaseUid]
      );

    const row = result.rows[0];

    if (!row) {
      throw new Error(
        "Unable to create authenticated user."
      );
    }

    return mapUser(row);
  }
}