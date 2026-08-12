import type { PostgresClient } from "./journey-repository.js";

export interface User {
  id: string;
  createdAt: Date;
}

export interface UserRepository {
  create(): Promise<User>;
}

type UserRow = {
  id: string;
  createdAt: Date;
};

const USER_COLUMNS = `
  id,
  created_at AS "createdAt"
`;

function mapUser(row: UserRow): User {
  return {
    id: row.id,
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
}