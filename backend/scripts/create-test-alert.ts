import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const JOURNEY_ID =
  "d10bed1a-b39f-4446-ae91-1186a2e26c0c";

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

try {
  const result = await client.query(
    `
    INSERT INTO alerts (
      journey_id,
      offset_minutes,
      scheduled_for,
      state
    )
    VALUES (
      $1,
      0,
      now() - interval '1 second',
      'pending'
    )
    RETURNING
      id,
      journey_id,
      offset_minutes,
      scheduled_for,
      state
    `,
    [JOURNEY_ID]
  );

  console.log(result.rows[0]);
} finally {
  await client.end();
}