import {
  searchStations,
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
      await searchStations(query)
    );
  } catch (error) {
    console.error(
      "Station lookup failed",
      error
    );

    return json(
      {
        error: {
          code: "LOOKUP_FAILED",
          message:
            "Unable to search stations.",
        },
      },
      500
    );
  }
}