import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const userService = {
  create: vi.fn(),
  response: vi.fn(),
};

vi.mock(
  "../src/api-runtime.js",
  () => ({
    userService,
  })
);

import {
  POST,
} from "../api/users.js";

describe(
  "User HTTP API",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      userService.response.mockImplementation(
        (user) => ({
          id: user.id,
          createdAt:
            user.createdAt.toISOString(),
        })
      );
    });

    it(
      "creates an anonymous user",
      async () => {
        const user = {
          id:
            "11111111-1111-1111-1111-111111111111",
          createdAt:
            new Date(
              "2026-08-12T04:00:00.000Z"
            ),
        };

        userService.create.mockResolvedValue(
          user
        );

        const response =
          await POST();

        expect(response.status).toBe(201);

        expect(
          userService.create
        ).toHaveBeenCalledTimes(1);

        await expect(
          response.json()
        ).resolves.toEqual({
          id:
            "11111111-1111-1111-1111-111111111111",
          createdAt:
            "2026-08-12T04:00:00.000Z",
        });
      }
    );

    it(
      "returns 500 when user creation fails",
      async () => {
        userService.create.mockRejectedValue(
          new Error("database failure")
        );

        const response =
          await POST();

        expect(response.status).toBe(500);

        await expect(
          response.json()
        ).resolves.toEqual({
          error: {
            code: "INTERNAL_ERROR",
            message:
              "An unexpected error occurred.",
          },
        });
      }
    );
  }
);