import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  deviceService,
} from "../../src/api-runtime.js";

import {
  FirebaseFcmClient,
} from "../../src/fcm-firebase.js";

const CRON_SECRET =
  process.env.CRON_SECRET;

const TEST_NOTIFICATIONS_ENABLED =
  process.env.ENABLE_TEST_NOTIFICATIONS ===
  "true";

function isAuthorized(
  req: VercelRequest
): boolean {
  if (!CRON_SECRET) {
    return false;
  }

  return (
    req.headers.authorization ===
    `Bearer ${CRON_SECRET}`
  );
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (!TEST_NOTIFICATIONS_ENABLED) {
    return res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Not found.",
      },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "POST required.",
      },
    });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message:
          "Invalid or missing authorization.",
      },
    });
  }

  const userId =
    typeof req.body?.userId === "string"
      ? req.body.userId.trim()
      : "";

  if (!userId) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "userId is required.",
      },
    });
  }

  try {
    const devices =
      await deviceService.list(userId);

    const activeDevices =
      devices.filter(
        (device) =>
          device.invalidatedAt === null
      );

    if (activeDevices.length === 0) {
      return res.status(404).json({
        error: {
          code: "NO_ACTIVE_DEVICE",
          message:
            "No active Android device found.",
        },
      });
    }

    const fcm =
      new FirebaseFcmClient();

    const results = [];

    for (const device of activeDevices) {
      const result =
        await fcm.send({
          token: device.fcmToken,

          title:
            "Train Alert Test",

          body:
            "FCM notification is working correctly! 🚆",

          data: {
            type:
              "test_notification",

            deviceId:
              device.id,
          },
        });

      results.push({
        deviceId:
          device.id,

        success:
          result.success,

        errorCode:
          result.errorCode ??
          null,

        errorMessage:
          result.errorMessage ??
          null,
      });
    }

    const successful =
      results.filter(
        (result) =>
          result.success
      ).length;

    return res.status(200).json({
      status: "ok",
      devices:
        results.length,
      successful,
      results,
    });
  } catch (error) {
    console.error(
      "Test notification failed",
      error
    );

    return res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Unable to send test notification.",
      },
    });
  }
}