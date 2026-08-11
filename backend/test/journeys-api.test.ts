import { beforeEach, describe, expect, it, vi } from "vitest";

const journey = {
  id: "11111111-1111-1111-1111-111111111111",
  trainNumber: "12919",
  journeyDate: "2026-08-11",
  destinationStationCode: "NDLS",
  destinationStationName: "New Delhi",
  state: "active" as const,
  providerState: "available" as const,
  currentEta: new Date("2026-08-11T19:00:00.000Z"),
  currentDelayMinutes: 10,
  lastProviderUpdateAt: new Date(
    "2026-08-11T16:00:00.000Z"
  ),
  scheduleVersion: 1,
};

const responseBody = {
  id: journey.id,
  trainNumber: journey.trainNumber,
  journeyDate: journey.journeyDate,
  destinationStationCode:
    journey.destinationStationCode,
  destinationStationName:
    journey.destinationStationName,
  state: journey.state,
  expectedArrival:
    journey.currentEta.toISOString(),
  delayMinutes: journey.currentDelayMinutes,
  nextAlert: "2026-08-11T17:00:00.000Z",
};

const auth = {
  authenticate: vi.fn(),
};

const journeyService = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  cancel: vi.fn(),
  response: vi.fn(),
};

vi.mock("../src/api-runtime.js", () => ({
  auth,
  journeyService,
}));

import {
  GET as getJourneys,
  POST as createJourney,
} from "../api/journeys.js";

import {
  GET as getJourney,
  DELETE as deleteJourney,
} from "../api/journeys/[id].js";

describe("Journey HTTP API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    auth.authenticate.mockResolvedValue({
      userId:
        "22222222-2222-2222-2222-222222222222",
    });

    journeyService.response.mockResolvedValue(
      responseBody
    );
  });

  it("GET /journeys requires authentication", async () => {
    auth.authenticate.mockRejectedValue(
      new Error("UNAUTHENTICATED")
    );

    const response = await getJourneys(
      new Request("http://localhost/api/journeys")
    );

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required.",
      },
    });
  });

  it("GET /journeys returns only the authenticated user's journeys", async () => {
    journeyService.list.mockResolvedValue([
      journey,
    ]);

    const response = await getJourneys(
      new Request("http://localhost/api/journeys", {
        headers: {
          "x-user-id":
            "22222222-2222-2222-2222-222222222222",
        },
      })
    );

    expect(response.status).toBe(200);

    expect(journeyService.list).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222"
    );

    expect(await response.json()).toEqual([
      responseBody,
    ]);
  });

  it("POST /journeys validates the request", async () => {
    const response = await createJourney(
      new Request("http://localhost/api/journeys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id":
            "22222222-2222-2222-2222-222222222222",
        },
        body: JSON.stringify({
          trainNumber: "123",
          journeyDate: "2026-08-11",
          destinationStationCode: "NDLS",
        }),
      })
    );

    expect(response.status).toBe(400);

    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_TRAIN_NUMBER",
        message:
          "Train number must contain exactly 5 digits.",
      },
    });

    expect(journeyService.create).not.toHaveBeenCalled();
  });

  it("POST /journeys creates a journey", async () => {
    journeyService.create.mockResolvedValue(
      journey
    );

    const response = await createJourney(
      new Request("http://localhost/api/journeys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id":
            "22222222-2222-2222-2222-222222222222",
        },
        body: JSON.stringify({
          trainNumber: "12919",
          journeyDate: "2026-08-11",
          destinationStationCode: "ndls",
        }),
      })
    );

    expect(response.status).toBe(201);

    expect(journeyService.create).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
      {
        trainNumber: "12919",
        journeyDate: "2026-08-11",
        destinationStationCode: "NDLS",
      }
    );

    expect(await response.json()).toEqual(
      responseBody
    );
  });

  it("GET /journeys/:id returns the requested journey", async () => {
    journeyService.get.mockResolvedValue(journey);

    const response = await getJourney(
      new Request(
        `http://localhost/api/journeys/${journey.id}`,
        {
          headers: {
            "x-user-id":
              "22222222-2222-2222-2222-222222222222",
          },
        }
      ),
      {
        params: Promise.resolve({
          id: journey.id,
        }),
      }
    );

    expect(response.status).toBe(200);

    expect(journeyService.get).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
      journey.id
    );

    expect(await response.json()).toEqual(
      responseBody
    );
  });

  it("GET /journeys/:id returns 404 when the journey is not owned by the user", async () => {
    const { JourneyServiceError } =
      await import("../src/journey-service.js");

    journeyService.get.mockRejectedValue(
      new JourneyServiceError(
        "JOURNEY_NOT_FOUND",
        "Journey not found.",
        404
      )
    );

    const response = await getJourney(
      new Request(
        `http://localhost/api/journeys/${journey.id}`,
        {
          headers: {
            "x-user-id":
              "22222222-2222-2222-2222-222222222222",
          },
        }
      ),
      {
        params: Promise.resolve({
          id: journey.id,
        }),
      }
    );

    expect(response.status).toBe(404);
  });

  it("DELETE /journeys/:id cancels the journey", async () => {
    const cancelled = {
      ...journey,
      state: "cancelled" as const,
    };

    journeyService.cancel.mockResolvedValue(
      cancelled
    );

    const response = await deleteJourney(
      new Request(
        `http://localhost/api/journeys/${journey.id}`,
        {
          method: "DELETE",
          headers: {
            "x-user-id":
              "22222222-2222-2222-2222-222222222222",
          },
        }
      ),
      {
        params: Promise.resolve({
          id: journey.id,
        }),
      }
    );

    expect(response.status).toBe(200);

    expect(journeyService.cancel).toHaveBeenCalledWith(
      "22222222-2222-2222-2222-222222222222",
      journey.id
    );
  });
});