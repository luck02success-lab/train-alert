import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { PostgresClient } from "./journey-repository.js";

class PgClient implements PostgresClient {
  constructor(private readonly client: PoolClient) {}

  async query<T>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<{ rows: T[] }> {
    const result = await this.client.query<T & QueryResultRow>(
      sql,
      [...parameters]
    );

    return { rows: result.rows as T[] };
  }

  async transaction<T>(
    work: (client: PostgresClient) => Promise<T>
  ): Promise<T> {
    await this.client.query("BEGIN");

    try {
      const result = await work(this);

      await this.client.query("COMMIT");

      return result;
    } catch (error) {
      await this.client.query("ROLLBACK");
      throw error;
    }
  }
}

export class PostgresDatabase implements PostgresClient {
  private readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) {
      throw new Error("DATABASE_URL is required");
    }

    this.pool = new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
    });
  }

  async query<T>(
    sql: string,
    parameters: readonly unknown[] = []
  ): Promise<{ rows: T[] }> {
    const result = await this.pool.query<T & QueryResultRow>(
      sql,
      [...parameters]
    );

    return { rows: result.rows as T[] };
  }

  async transaction<T>(
    work: (client: PostgresClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      return await new PgClient(client).transaction(work);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
