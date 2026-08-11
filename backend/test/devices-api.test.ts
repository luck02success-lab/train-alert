import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const authenticate =
  vi.fn();

const deviceService = {
  register: vi.fn(),
  invalidate: vi.fn(),
  response: vi.fn(),
};

vi.mock(
  "../src/api-runtime.js",
  () => ({
    auth: {
      authenticate,
    },
    deviceService,
  })
);

import {
  POST,
} from "../api/devices.js";

import {
  DELETE,
} from "../api/devices/[id].js";

describe(
  "Device HTTP API",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      authenticate.mockResolvedValue({
        userId:
          "11111111-1111-1111-1111-111111111111",
      });

      deviceService.response.mockImplementation(
        (device) => ({
          id: device.id,
          platform: device.platform,
          registeredAt:
            device.createdAt.toISOString(),
          invalidatedAt:
            device.invalidatedAt
              ?.toISOString() ?? null,
        })
      );
    });

    it(
      "requires authentication",
      async () => {
        authenticate.mockRejectedValue(
          new Error("UNAUTHENTICATED")
        );

        const response =
          await POST(
            new Request(
              "http://localhost/api/devices",
              {
                method: "POST",
                body: JSON.stringify({
                  platform: "android",
                  token: "token-123",
                }),
                headers: {
                  "content-type":
                    "application/json",
                },
              }
            )
          );

        expect(response.status).toBe(401);

        expect(
          deviceService.register
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "validates platform",
      async () => {
        const response =
          await POST(
            new Request(
              "http://localhost/api/devices",
              {
                method: "POST",
                body: JSON.stringify({
                  platform: "ios",
                  token: "token-123",
                }),
                headers: {
                  "content-type":
                    "application/json",
                  "x-user-id":
                    "11111111-1111-1111-1111-111111111111",
                },
              }
            )
          );

        expect(response.status).toBe(400);

        expect(
          deviceService.register
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "validates token",
      async () => {
        const response =
          await POST(
            new Request(
              "http://localhost/api/devices",
              {
                method: "POST",
                body: JSON.stringify({
                  platform: "android",
                  token: "   ",
                }),
                headers: {
                  "content-type":
                    "application/json",
                  "x-user-id":
                    "11111111-1111-1111-1111-111111111111",
                },
              }
            )
          );

        expect(response.status).toBe(400);

        expect(
          deviceService.register
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "registers an Android device",
      async () => {
        const device = {
          id:
            "22222222-2222-2222-2222-222222222222",
          userId:
            "11111111-1111-1111-1111-111111111111",
          platform: "android" as const,
          fcmToken: "token-123",
          invalidatedAt: null,
          createdAt:
            new Date(
              "2026-08-11T10:00:00.000Z"
            ),
        };

        deviceService.register.mockResolvedValue(
          device
        );

        const response =
          await POST(
            new Request(
              "http://localhost/api/devices",
              {
                method: "POST",
                body: JSON.stringify({
                  platform: "android",
                  token: " token-123 ",
                }),
                headers: {
                  "content-type":
                    "application/json",
                  "x-user-id":
                    "11111111-1111-1111-1111-111111111111",
                },
              }
            )
          );

        expect(response.status).toBe(201);

        expect(
          deviceService.register
        ).toHaveBeenCalledWith(
          "11111111-1111-1111-1111-111111111111",
          {
            platform: "android",
            token: " token-123 ",
          }
        );
      }
    );

    it(
      "invalidates a device",
      async () => {
        const device = {
          id:
            "22222222-2222-2222-2222-222222222222",
          userId:
            "11111111-1111-1111-1111-111111111111",
          platform: "android" as const,
          fcmToken: "token-123",
          invalidatedAt:
            new Date(
              "2026-08-11T11:00:00.000Z"
            ),
          createdAt:
            new Date(
              "2026-08-11T10:00:00.000Z"
            ),
        };

        deviceService.invalidate.mockResolvedValue(
          device
        );

        const response =
          await DELETE(
            new Request(
              "http://localhost/api/devices/22222222-2222-2222-2222-222222222222",
              {
                method: "DELETE",
                headers: {
                  "x-user-id":
                    "11111111-1111-1111-1111-111111111111",
                },
              }
            ),
            {
              params: Promise.resolve({
                id:
                  "22222222-2222-2222-2222-222222222222",
              }),
            }
          );

        expect(response.status).toBe(200);

        expect(
          deviceService.invalidate
        ).toHaveBeenCalledWith(
          "11111111-1111-1111-1111-111111111111",
          "22222222-2222-2222-2222-222222222222"
        );
      }
    );
  }
);