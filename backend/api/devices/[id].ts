import {
  DeviceServiceError,
} from "../../src/device-service.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, { status });
}

async function authenticate(
  request: Request
) {
  try {
    const { auth } =
      await import("../../src/api-runtime.js");

    return await auth.authenticate({
      headers: Object.fromEntries(
        request.headers.entries()
      ),
    });
  } catch {
    throw new DeviceServiceError(
      "UNAUTHENTICATED",
      "Authentication required.",
      401
    );
  }
}

function errorResponse(
  error: unknown
): Response {
  if (
    error instanceof DeviceServiceError
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

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
): Promise<Response> {
  try {
    const { userId } =
      await authenticate(request);

    const { id } =
      await context.params;

    const { deviceService } =
      await import(
        "../../src/api-runtime.js"
      );

    const device =
      await deviceService.invalidate(
        userId,
        id
      );

    return json(
      deviceService.response(device)
    );
  } catch (error) {
    return errorResponse(error);
  }
}