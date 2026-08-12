import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  NotificationService,
} from "../src/notification-service.js";

import type {
  DueAlert,
  NotificationRepository,
} from "../src/notification-repository.js";

import type {
  FcmClient,
} from "../src/fcm.js";

const alert: DueAlert = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  journeyId:
    "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  offsetMinutes: 30,
  scheduledFor:
    new Date("2026-08-12T15:00:00.000Z"),
  trainNumber: "13010",
  destinationStationName:
    "ZAFARABAD JN",
  currentEta:
    new Date("2026-08-12T15:30:00.000Z"),
};

function createRepository(
  overrides: Partial<
    NotificationRepository
  > = {}
): NotificationRepository {
  return {
    claimDueAlerts:
      vi.fn(),

    getDevicesForAlert:
      vi.fn().mockResolvedValue([]),

    createDelivery:
      vi.fn(),

    markSending:
      vi.fn(),

    markSent:
      vi.fn(),

    markFailed:
      vi.fn(),

    markPermanentlyFailed:
      vi.fn(),

    invalidateDevice:
      vi.fn(),

    getDeliverySummary:
      vi.fn().mockResolvedValue({
        pending: 0,
        sending: 0,
        retryableFailed: 0,
      }),

    markAlertSent:
      vi.fn(),

    releaseAlert:
      vi.fn(),

    ...overrides,
  };
}

function createFcm(
  result: Awaited<
    ReturnType<FcmClient["send"]>
  >
): FcmClient {
  return {
    send:
      vi.fn().mockResolvedValue(
        result
      ),
  };
}

describe(
  "NotificationService",
  () => {
    it(
      "marks an alert sent when there are no active devices",
      async () => {
        const repository =
          createRepository();

        const fcm =
          createFcm({
            success: true,
          });

        const service =
          new NotificationService(
            repository,
            fcm
          );

        await service.processAlert(
          alert
        );

        expect(
          repository.markAlertSent
        ).toHaveBeenCalledWith(
          alert.id
        );

        expect(
          fcm.send
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "marks a successful delivery as sent",
      async () => {
        const repository =
          createRepository({
            getDevicesForAlert:
              vi.fn().mockResolvedValue([
                {
                  id:
                    "cccccccc-cccc-cccc-cccc-cccccccccccc",
                  userId:
                    "dddddddd-dddd-dddd-dddd-dddddddddddd",
                  token: "fcm-token",
                },
              ]),

            createDelivery:
              vi.fn().mockResolvedValue({
                id:
                  "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                alertId:
                  alert.id,
                deviceId:
                  "cccccccc-cccc-cccc-cccc-cccccccccccc",
                state: "pending",
                attemptCount: 0,
                nextAttemptAt:
                  new Date(),
              }),

            markSending:
              vi.fn().mockResolvedValue(1),
          });

        const fcm =
          createFcm({
            success: true,
          });

        const service =
          new NotificationService(
            repository,
            fcm
          );

        await service.processAlert(
          alert
        );

        expect(
          repository.markSent
        ).toHaveBeenCalledWith(
          "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
        );

        expect(
          repository.markAlertSent
        ).toHaveBeenCalledWith(
          alert.id
        );
      }
    );

    it(
      "schedules a retry using the persisted attempt count",
      async () => {
        const repository =
          createRepository({
            getDevicesForAlert:
              vi.fn().mockResolvedValue([
                {
                  id:
                    "cccccccc-cccc-cccc-cccc-cccccccccccc",
                  userId:
                    "dddddddd-dddd-dddd-dddd-dddddddddddd",
                  token: "fcm-token",
                },
              ]),

            createDelivery:
              vi.fn().mockResolvedValue({
                id:
                  "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
                alertId:
                  alert.id,
                deviceId:
                  "cccccccc-cccc-cccc-cccc-cccccccccccc",
                state: "failed",
                attemptCount: 1,
                nextAttemptAt:
                  new Date(),
              }),

            markSending:
              vi.fn().mockResolvedValue(2),

            getDeliverySummary:
              vi.fn().mockResolvedValue({
                pending: 0,
                sending: 0,
                retryableFailed: 1,
              }),
          });

        const fcm =
          createFcm({
            success: false,
            errorCode:
              "messaging/internal-error",
            errorMessage:
              "Temporary FCM failure",
          });

        const service =
          new NotificationService(
            repository,
            fcm
          );

        await service.processAlert(
          alert
        );

        expect(
          repository.markFailed
        ).toHaveBeenCalledTimes(1);

        const nextAttempt =
          (
            repository.markFailed as ReturnType<
              typeof vi.fn
            >
          ).mock.calls[0]?.[3] as Date;

        expect(
          nextAttempt.getTime()
        ).toBeGreaterThan(
          Date.now()
        );

        expect(
          repository.markAlertSent
        ).not.toHaveBeenCalled();
      }
    );

    it(
      "invalidates permanently bad FCM tokens",
      async () => {
        const deviceId =
          "cccccccc-cccc-cccc-cccc-cccccccccccc";

        const deliveryId =
          "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

        const repository =
          createRepository({
            getDevicesForAlert:
              vi.fn().mockResolvedValue([
                {
                  id: deviceId,
                  userId:
                    "dddddddd-dddd-dddd-dddd-dddddddddddd",
                  token: "bad-token",
                },
              ]),

            createDelivery:
              vi.fn().mockResolvedValue({
                id: deliveryId,
                alertId: alert.id,
                deviceId,
                state: "pending",
                attemptCount: 0,
                nextAttemptAt:
                  new Date(),
              }),

            markSending:
              vi.fn().mockResolvedValue(1),
          });

        const fcm =
          createFcm({
            success: false,
            errorCode:
              "messaging/registration-token-not-registered",
            errorMessage:
              "Token is no longer registered.",
          });

        const service =
          new NotificationService(
            repository,
            fcm
          );

        await service.processAlert(
          alert
        );

        expect(
          repository.invalidateDevice
        ).toHaveBeenCalledWith(
          deviceId
        );

        expect(
          repository.markPermanentlyFailed
        ).toHaveBeenCalledWith(
          deliveryId,
          "messaging/registration-token-not-registered",
          "Token is no longer registered."
        );
      }
    );
  }
);