package com.trainalert

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class TrainAlertFirebaseMessagingService :
    FirebaseMessagingService() {

    companion object {

        private const val TAG =
            "TrainAlertFCM"

        const val OPEN_JOURNEY_ACTION =
            "com.trainalert.OPEN_JOURNEY"

        private const val CHANNEL_ID =
            "train_alerts"

        private const val CHANNEL_NAME =
            "Train Alerts"

        private const val CHANNEL_DESCRIPTION =
            "Alerts about upcoming train stops"

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

        if (token.isBlank()) {
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

        /*
         * Backend sends title/body as notification
         * fields, while journeyId and other metadata
         * are sent through the data payload.
         *
         * Keep the data fallback because it makes the
         * client resilient to data-only messages too.
         */
        val title =
            notification?.title
                ?: data[TITLE_KEY]
                ?: "Train Alert"

        val body =
            notification?.body
                ?: data[BODY_KEY]
                ?: "Your train is approaching your stop."

        val journeyId =
            data[JOURNEY_ID_KEY]

        showNotification(
            title = title,
            body = body,
            journeyId = journeyId
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

    private fun showNotification(
        title: String,
        body: String,
        journeyId: String?
    ) {
        if (!hasNotificationPermission()) {
            Log.w(
                TAG,
                "Notification permission is not granted"
            )

            return
        }

        createNotificationChannel()

        val intent =
            Intent(
                this,
                MainActivity::class.java
            ).apply {
                action =
                    OPEN_JOURNEY_ACTION

                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP

                if (!journeyId.isNullOrBlank()) {
                    putExtra(
                        MainActivity.EXTRA_JOURNEY_ID,
                        journeyId
                    )
                }
            }

        val requestCode =
            journeyId
                ?.hashCode()
                ?.and(0x7fffffff)
                ?: NOTIFICATION_ID_BASE

        val pendingIntent =
            PendingIntent.getActivity(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )

        val notificationId =
            NOTIFICATION_ID_BASE +
                (
                    journeyId
                        ?.hashCode()
                        ?.and(0x7fffffff)
                        ?: 0
                    )

        val notification =
            NotificationCompat.Builder(
                this,
                CHANNEL_ID
            )
                .setSmallIcon(
                    R.drawable.ic_train_alert
                )
                .setContentTitle(
                    title
                )
                .setContentText(
                    body
                )
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText(body)
                )
                .setPriority(
                    NotificationCompat.PRIORITY_HIGH
                )
                .setCategory(
                    NotificationCompat.CATEGORY_REMINDER
                )
                .setAutoCancel(true)
                .setContentIntent(
                    pendingIntent
                )
                .build()

        try {
            NotificationManagerCompat
                .from(this)
                .notify(
                    notificationId,
                    notification
                )

            Log.i(
                TAG,
                "Notification displayed"
            )
        } catch (
            securityException:
            SecurityException
        ) {
            Log.e(
                TAG,
                "Notification permission not granted",
                securityException
            )
        }
    }

    private fun hasNotificationPermission():
        Boolean {

        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.TIRAMISU
        ) {
            return true
        }

        return checkSelfPermission(
            Manifest.permission.POST_NOTIFICATIONS
        ) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun createNotificationChannel() {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O
        ) {
            return
        }

        val manager =
            getSystemService(
                NotificationManager::class.java
            )

        val existingChannel =
            manager.getNotificationChannel(
                CHANNEL_ID
            )

        if (existingChannel != null) {
            return
        }

        val channel =
            NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description =
                    CHANNEL_DESCRIPTION
            }

        manager.createNotificationChannel(
            channel
        )
    }
}