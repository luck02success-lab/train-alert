import type { AuthProvider } from "../../src/auth.js";
import {
  JourneyServiceError,
} from "../../src/journey-service.js";
import { ApiError } from "../../src/train-service.js";

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

function errorResponse(error: unknown) {
  if (error instanceof JourneyServiceError) {
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

  if (error instanceof ApiError) {
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
        message: "An unexpected error occurred.",
      },
    },
    500
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
): Promise<Response> {
  try {
    const {
      auth,
      journeyService,
    } = await import(
      "../../src/api-runtime.js"
    );

    const { userId } =
      await authenticate(request, auth);

    const { id } = await context.params;

    const journey =
      await journeyService.get(userId, id);

    return json(
      await journeyService.response(journey)
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
): Promise<Response> {
  try {
    const {
      auth,
      journeyService,
    } = await import(
      "../../src/api-runtime.js"
    );

    const { userId } =
      await authenticate(request, auth);

    const { id } = await context.params;

    const journey =
      await journeyService.cancel(userId, id);

    return json(
      await journeyService.response(journey)
    );
  } catch (error) {
    return errorResponse(error);
  }
}