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
): Promise<string> {
  const { auth } =
    await import("../src/api-runtime.js");

  try {
    const result =
      await auth.authenticate({
        headers: Object.fromEntries(
          request.headers.entries()
        ),
      });

    return result.userId;
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

export async function GET(
  request: Request
): Promise<Response> {
  try {
    const userId =
      await authenticate(request);

    const { deviceService } =
      await import("../src/api-runtime.js");

    const devices =
      await deviceService.list(userId);

    return json(
      devices.map((device) =>
        deviceService.response(device)
      )
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const userId =
      await authenticate(request);

    let body: RegisterDeviceRequest;

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

    /*
     * Validate the HTTP payload here as well as in
     * DeviceService. This protects the API boundary
     * and keeps the behaviour deterministic when the
     * service is mocked in tests.
     */

    if (
      !body ||
      typeof body !== "object"
    ) {
      return json(
        {
          error: {
            code: "INVALID_REQUEST",
            message:
              "Request body must be an object.",
          },
        },
        400
      );
    }

    if (body.platform !== "android") {
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

    const { deviceService } =
      await import("../src/api-runtime.js");

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