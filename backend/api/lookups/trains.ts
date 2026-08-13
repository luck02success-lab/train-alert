import {
  searchTrains,
} from "../../src/railradar-lookup.js";

function json(
  body: unknown,
  status = 200
): Response {
  return Response.json(
    body,
    { status }
  );
}

export async function GET(
  request: Request
): Promise<Response> {
  try {
    const query =
      new URL(request.url)
        .searchParams
        .get("q")
        ?.trim() ?? "";

    if (query.length < 1) {
      return json([]);
    }

    return json(
      await searchTrains(query)
    );
  } catch (error) {
    console.error(
      "Train lookup failed",
      error
    );

    return json(
      {
        error: {
          code: "LOOKUP_FAILED",
          message:
            "Unable to search trains.",
        },
      },
      500
    );
  }
}