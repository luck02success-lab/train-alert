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
      await import(
        "../../src/api-runtime.js"
      );

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

function getDeviceIdFromRequest(
  request: Request
): string {
  const pathname =
    new URL(request.url).pathname;

  const segments =
    pathname.split("/").filter(Boolean);

  return segments.at(-1) ?? "";
}

async function getDeviceId(
  request: Request,
  context?: {
    params?: Promise<{ id: string }>;
  }
): Promise<string> {
  if (context?.params) {
    const params =
      await context.params;

    if (params.id) {
      return params.id;
    }
  }

  return getDeviceIdFromRequest(request);
}

export async function DELETE(
  request: Request,
  context?: {
    params?: Promise<{ id: string }>;
  }
): Promise<Response> {
  try {
    const { userId } =
      await authenticate(request);

    const id =
      await getDeviceId(
        request,
        context
      );

    if (!id) {
      throw new DeviceServiceError(
        "INVALID_DEVICE_ID",
        "Device id is required.",
        400
      );
    }

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