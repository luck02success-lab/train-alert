import { alertWorker } from "../../src/api-runtime.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, { status });
}

function isAuthorized(
  request: Request
): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "CRON_SECRET is not configured"
    );

    return false;
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${secret}`
  );
}

export async function GET(
  request: Request
): Promise<Response> {

  if (!isAuthorized(request)) {
    return json(
      {
        error: {
          code: "UNAUTHORIZED",
          message:
            "Invalid or missing cron authorization.",
        },
      },
      401
    );
  }

  try {
    const processed =
      await alertWorker.run();

    return json({
      processed,
      status: "ok",
    });

  } catch (error) {

    console.error(
      "Alert worker failed",
      error
    );

    return json(
      {
        error: {
          code: "ALERT_WORKER_FAILED",
          message:
            "Alert worker failed.",
        },
      },
      500
    );
  }
}

export async function POST(
  request: Request
): Promise<Response> {
  return GET(request);
}
