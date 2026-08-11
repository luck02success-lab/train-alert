import type {
  RegisterDeviceRequest,
} from "../src/api-contract.js";

import {
  DeviceServiceError,
} from "../src/device-service.js";

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
      await import("../src/api-runtime.js");

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
) {
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

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const { userId } =
      await authenticate(request);

    let body:
      | Partial<RegisterDeviceRequest>;

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
      body.platform !== "android"
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_DEVICE_PLATFORM",
            message:
              "Only Android devices are supported.",
          },
        },
        400
      );
    }

    if (
      typeof body.token !== "string" ||
      !body.token.trim()
    ) {
      return json(
        {
          error: {
            code:
              "INVALID_DEVICE_TOKEN",
            message:
              "Device token is required.",
          },
        },
        400
      );
    }

    const {
      deviceService,
    } = await import(
      "../src/api-runtime.js"
    );

    const device =
      await deviceService.register(
        userId,
        {
          platform: "android",
          token: body.token,
        }
      );

    return json(
      deviceService.response(device),
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
}