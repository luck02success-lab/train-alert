import {
  ApiError,
  TrainService,
} from "../../../src/train-service.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, { status });
}

function errorResponse(
  error: unknown
): Response {
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
        message:
          "An unexpected error occurred.",
      },
    },
    500
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ number: string }>;
  }
): Promise<Response> {
  try {
    const { number } =
      await context.params;

    const url = new URL(request.url);

    const date =
      url.searchParams.get("date") ?? "";

    const trainService =
      new TrainService();

    const liveStatus =
      await trainService.live(
        number,
        date
      );

    return json(liveStatus);
  } catch (error) {
    return errorResponse(error);
  }
}