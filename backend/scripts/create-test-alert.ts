import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is required"
  );
}

const JOURNEY_ID =
  process.env.JOURNEY_ID;

if (!JOURNEY_ID) {
  throw new Error(
    "JOURNEY_ID is required"
  );
}

const client = new Client({
  connectionString: DATABASE_URL,
});

await client.connect();

try {
  const result =
    await client.query(
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

  console.log(
    JSON.stringify(
      result.rows[0],
      null,
      2
    )
  );
} finally {
  await client.end();
}