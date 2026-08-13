package com.trainalert

import android.os.Build
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.trainalert.notification.NotificationHelper

class TrainAlertFirebaseMessagingService :
    FirebaseMessagingService() {

    companion object {

        private const val TAG =
            "TrainAlertFCM"

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
    }

    override fun onNewToken(
        token: String
    ) {
        super.onNewToken(token)

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
            "FCM token refreshed"
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
            "FCM message received"
        )

        val notification =
            remoteMessage.notification

        val data =
            remoteMessage.data

        val title =
            notification?.title
                ?: data[TITLE_KEY]
                ?: "Train Alert"

        val body =
            notification?.body
                ?: data[BODY_KEY]
                ?: "Your train is approaching your destination."

        val journeyId =
            data[JOURNEY_ID_KEY]

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
                    journeyId
            )

        Log.i(
            TAG,
            "Notification displayed"
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