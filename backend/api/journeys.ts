import type {
  CreateJourneyRequest,
} from "../src/api-contract.js";

import {
  JourneyServiceError,
} from "../src/journey-service.js";

import {
  ApiError,
} from "../src/train-service.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(
    body,
    { status }
  );
}

async function authenticate(
  request: Request
) {
  try {
    const { auth } =
      await import(
        "../src/api-runtime.js"
      );

    return await auth.authenticate({
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

function isPostgresDuplicateJourneyError(
  error: unknown
): boolean {
  if (
    !error ||
    typeof error !== "object"
  ) {
    return false;
  }

  const candidate =
    error as {
      code?: unknown;
      constraint?: unknown;
    };

  return (
    candidate.code === "23505" &&
    candidate.constraint ===
      "journeys_one_open_destination_idx"
  );
}

function duplicateJourneyResponse(
  error: unknown
): Response {
  const detail =
    error &&
    typeof error === "object" &&
    "detail" in error &&
    typeof (
      error as {
        detail?: unknown;
      }
    ).detail === "string"
      ? (
          error as {
            detail: string;
          }
        ).detail
      : null;

  /*
   * We intentionally do not expose the raw PostgreSQL
   * detail because it contains user_id and internal DB
   * information.
   *
   * The client only needs the business-level conflict.
   */
  void detail;

  return json(
    {
      error: {
        code:
          "JOURNEY_ALREADY_EXISTS",
        message:
          "You already have an active journey for this train, date, and destination.",
      },
    },
    409
  );
}

function errorResponse(
  error: unknown
): Response {
  if (
    isPostgresDuplicateJourneyError(
      error
    )
  ) {
    return duplicateJourneyResponse(
      error
    );
  }

  if (
    error instanceof
    JourneyServiceError
  ) {
    return json(
      {
        error: {
          code:
            error.code,
          message:
            error.message,
        },
      },
      error.status
    );
  }

  if (
    error instanceof
    ApiError
  ) {
    return json(
      {
        error: {
          code:
            error.code,
          message:
            error.message,
        },
      },
      error.status
    );
  }

  console.error(
    error
  );

  return json(
    {
      error: {
        code:
          "INTERNAL_ERROR",
        message:
          "An unexpected error occurred.",
      },
    },
    500
  );
}

function getTodayIndia(): string {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Kolkata",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );
}

export async function GET(
  request: Request
): Promise<Response> {
  try {
    const {
      userId,
    } =
      await authenticate(
        request
      );

    const {
      journeyService,
    } =
      await import(
        "../src/api-runtime.js"
      );

    const journeys =
      await journeyService.list(
        userId
      );

    return json(
      await Promise.all(
        journeys.map(
          (journey) =>
            journeyService.response(
              journey
            )
        )
      )
    );

  } catch (error) {
    return errorResponse(
      error
    );
  }
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const {
      userId,
    } =
      await authenticate(
        request
      );

    let body:
      Partial<CreateJourneyRequest>;

    try {
      body =
        await request.json();
    } catch {
      return json(
        {
          error: {
            code:
              "INVALID_JSON",

            message:
              "Request body must be valid JSON.",
          },
        },
        400
      );
    }

    if (
      typeof body.trainNumber !==
        "string" ||
      !/^\d{5}$/.test(
        body.trainNumber
      )
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_TRAIN_NUMBER",

            message:
              "Train number must contain exactly 5 digits.",
          },
        },
        400
      );
    }

    if (
      typeof body.journeyDate !==
        "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(
        body.journeyDate
      )
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_JOURNEY_DATE",

            message:
              "Journey date must use YYYY-MM-DD.",
          },
        },
        400
      );
    }

    const todayIndia =
      getTodayIndia();

    if (
      body.journeyDate <
      todayIndia
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_JOURNEY_DATE",

            message:
              "Journey date must be today or a future date.",
          },
        },
        400
      );
    }

    if (
      typeof body.destinationStationCode !==
        "string" ||
      !/^[A-Za-z0-9]{2,16}$/.test(
        body.destinationStationCode
      )
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_DESTINATION_STATION",

            message:
              "Destination station code is invalid.",
          },
        },
        400
      );
    }

    const {
      journeyService,
    } =
      await import(
        "../src/api-runtime.js"
      );

    const journey =
      await journeyService.create(
        userId,
        {
          trainNumber:
            body.trainNumber,

          journeyDate:
            body.journeyDate,

          destinationStationCode:
            body
              .destinationStationCode
              .toUpperCase(),
        }
      );

    return json(
      await journeyService.response(
        journey
      ),
      201
    );

  } catch (error) {
    return errorResponse(
      error
    );
  }
}