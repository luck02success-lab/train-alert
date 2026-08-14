package com.trainalert

import android.util.Log

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

import com.trainalert.notification.NotificationHelper

class TrainAlertFirebaseMessagingService :
    FirebaseMessagingService() {

    companion object {

        private const val TAG =
            "RailWakeFCM"

        const val OPEN_JOURNEY_ACTION =
            "com.trainalert.OPEN_JOURNEY"

        private const val NOTIFICATION_ID_BASE =
            1000

        private const val JOURNEY_ID_KEY =
            "journeyId"

        private const val TITLE_KEY =
            "title"

        private const val BODY_KEY =
            "body"

        private const val OFFSET_MINUTES_KEY =
            "offsetMinutes"
    }

    override fun onNewToken(
        token: String
    ) {
        super.onNewToken(
            token
        )

        if (
            token.isBlank()
        ) {
            Log.w(
                TAG,
                "Ignoring empty FCM token refresh"
            )

            return
        }

        Log.i(
            TAG,
            "RailWake FCM token refreshed"
        )

        DeviceRegistrationManager
            .registerToken(
                applicationContext,
                token
            )
    }

    override fun onMessageReceived(
        remoteMessage: RemoteMessage
    ) {
        super.onMessageReceived(
            remoteMessage
        )

        Log.i(
            TAG,
            "RailWake FCM message received"
        )

        val data =
            remoteMessage.data

        val title =
            remoteMessage.notification?.title
                ?: data[TITLE_KEY]
                ?: "RailWake"

        val body =
            remoteMessage.notification?.body
                ?: data[BODY_KEY]
                ?: "Your train is approaching your destination."

        val journeyId =
            data[JOURNEY_ID_KEY]

        val offsetMinutes =
            data[OFFSET_MINUTES_KEY]
                ?.toIntOrNull()
                ?: 30

        val notificationId =
            createNotificationId(
                journeyId
            )

        NotificationHelper
            .showNotification(
                context =
                    applicationContext,

                notificationId =
                    notificationId,

                title =
                    title,

                body =
                    body,

                journeyId =
                    journeyId,

                offsetMinutes =
                    offsetMinutes
            )

        Log.i(
            TAG,
            "RailWake notification displayed"
        )
    }

    override fun onDeletedMessages() {
        super.onDeletedMessages()

        Log.w(
            TAG,
            "FCM deleted messages detected; refreshing token"
        )

        DeviceRegistrationManager
            .registerCurrentToken(
                applicationContext
            )
    }

    private fun createNotificationId(
        journeyId: String?
    ): Int {
        val hash =
            journeyId
                ?.hashCode()
                ?.and(0x7fffffff)
                ?: 0

        return NOTIFICATION_ID_BASE +
            hash
    }
}

