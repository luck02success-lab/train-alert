import {
  UserService,
} from "../src/user-service.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(body, { status });
}

function errorResponse(
  error: unknown
): Response {
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

export async function POST(): Promise<Response> {
  try {
    const {
      userService,
    } = await import(
      "../src/api-runtime.js"
    );

    const user =
      await userService.create();

    return json(
      userService.response(user),
      201
    );
  } catch (error) {
    return errorResponse(error);
  }
}