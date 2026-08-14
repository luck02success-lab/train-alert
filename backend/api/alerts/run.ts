import {
  alertWorker,
  journeyRefreshWorker,
} from "../../src/api-runtime.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(
    body,
    { status }
  );
}

function isAuthorized(
  request: Request
): boolean {
  const secret =
    process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "CRON_SECRET is not configured"
    );

    return false;
  }

  return (
    request.headers.get(
      "authorization"
    ) ===
    `Bearer ${secret}`
  );
}

export async function GET(
  request: Request
): Promise<Response> {
  if (
    !isAuthorized(request)
  ) {
    return json(
      {
        error: {
          code:
            "UNAUTHORIZED",
          message:
            "Invalid or missing cron authorization.",
        },
      },
      401
    );
  }

  try {
    /*
     * 1. Refresh active/scheduled journeys whose
     *    provider observation is >= 5 minutes old.
     *
     *    This handles both delays and early arrivals.
     */
    const refresh =
      await journeyRefreshWorker.run();

    /*
     * 2. Process due notifications.
     *
     *    notificationRepository applies the 15-minute
     *    minimum notification gap and chooses only the
     *    latest due warning per journey.
     */
    const processed =
      await alertWorker.run();

    return json({
      status: "ok",

      refresh: {
        refreshed:
          refresh.refreshed,

        completed:
          refresh.completed,

        failed:
          refresh.failed,
      },

      processed,
    });

  } catch (error) {
    console.error(
      "Alert worker failed",
      error
    );

    return json(
      {
        error: {
          code:
            "ALERT_WORKER_FAILED",
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