import type { AuthProvider } from "../../../src/auth.js";
import {
  JourneyServiceError,
} from "../../../src/journey-service.js";
import { ApiError } from "../../../src/train-service.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, { status });
}

async function authenticate(
  request: Request,
  authProvider: AuthProvider
) {
  try {
    return await authProvider.authenticate({
      headers: Object.fromEntries(
        request.headers.entries()
      ),
    });
  } catch {
    throw new JourneyServiceError(
      "UNAUTHENTICATED",
      "Authentication required.",
      401
    );
  }
}

function errorResponse(
  error: unknown
) {
  if (
    error instanceof
    JourneyServiceError
  ) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status
    );
  }

  if (
    error instanceof ApiError
  ) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status
    );
  }

  console.error(error);

  return json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message:
          "An unexpected error occurred.",
      },
    },
    500
  );
}

async function getJourneyId(
  request: Request,
  context?: {
    params?: Promise<{
      id: string;
    }>;
  }
): Promise<string> {
  if (context?.params) {
    const params =
      await context.params;

    if (params.id) {
      return params.id;
    }
  }

  const pathname =
    new URL(request.url).pathname;

  return (
    pathname
      .split("/")
      .filter(Boolean)
      .at(-2) ?? ""
  );
}

export async function PATCH(
  request: Request,
  context?: {
    params?: Promise<{
      id: string;
    }>;
  }
): Promise<Response> {
  try {
    const {
      auth,
      journeyService,
    } = await import(
      "../../../src/api-runtime.js"
    );

    const { userId } =
      await authenticate(
        request,
        auth
      );

    const journeyId =
      await getJourneyId(
        request,
        context
      );

    if (!journeyId) {
      throw new JourneyServiceError(
        "INVALID_JOURNEY_ID",
        "Journey id is required.",
        400
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return json(
        {
          error: {
            code: "INVALID_JSON",
            message:
              "Request body must be valid JSON.",
          },
        },
        400
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !(
        "alertOffsetsMinutes" in body
      ) ||
      !Array.isArray(
        (
          body as {
            alertOffsetsMinutes?: unknown;
          }
        ).alertOffsetsMinutes
      )
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_ALERT_OFFSETS",
            message:
              "alertOffsetsMinutes must be an array containing 120, 60, 30, or 15.",
          },
        },
        400
      );
    }

    const offsets =
      (
        body as {
          alertOffsetsMinutes:
            unknown[];
        }
      ).alertOffsetsMinutes;

    if (
      !offsets.every(
        (value) =>
          typeof value ===
          "number"
      )
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_ALERT_OFFSETS",
            message:
              "alertOffsetsMinutes must contain only numbers.",
          },
        },
        400
      );
    }

    const journey =
      await journeyService
        .updateAlertPreferences(
          userId,
          journeyId,
          offsets as number[]
        );

    return json(
      await journeyService.response(
        journey
      )
    );

  } catch (error) {
    return errorResponse(
      error
    );
  }
}