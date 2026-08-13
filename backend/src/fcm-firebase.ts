import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  getMessaging,
} from "firebase-admin/messaging";

import type {
  FcmClient,
  FcmMessage,
  FcmSendResult,
} from "./fcm.js";

export function getFirebaseApp() {
  const existing =
    getApps()[0];

  if (existing) {
    return existing;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL;

  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY;

  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {
    throw new Error(
      "Firebase credentials are required."
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey:
        privateKey.replace(
          /\\n/g,
          "\n"
        ),
    }),
  });
}

export class FirebaseFcmClient
  implements FcmClient
{
  async send(
    message: FcmMessage
  ): Promise<FcmSendResult> {
    try {
      const app =
        getFirebaseApp();

      await getMessaging(app).send({
        token: message.token,

        notification: {
          title: message.title,
          body: message.body,
        },

        data: message.data,

        android: {
          notification: {
            channelId:
              "train_alerts",

            clickAction:
              "com.trainalert.OPEN_JOURNEY",
          },
        },
      });

      return {
        success: true,
      };
    } catch (error) {
      const value =
        error as {
          code?: string;
          message?: string;
        };

      return {
        success: false,

        errorCode:
          value.code ??
          "FCM_SEND_FAILED",

        errorMessage:
          value.message ??
          "FCM notification failed.",
      };
    }
  }
}