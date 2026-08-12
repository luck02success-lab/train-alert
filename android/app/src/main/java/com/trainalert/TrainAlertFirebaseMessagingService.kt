package com.trainalert

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
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
    }

    override fun onNewToken(
        token: String
    ) {
        super.onNewToken(token)

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
                ?: data["title"]
                ?: "Train Alert"

        val body =
            notification?.body
                ?: data["body"]
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

        /*
         * The local device registration may need to
         * be refreshed after FCM drops pending messages.
         */
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
        createNotificationChannel()

        val intent =
            Intent(
                this,
                MainActivity::class.java
            ).apply {
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
                (journeyId?.hashCode()?.and(0x7fffffff)
                    ?: 0)

        val notification =
            NotificationCompat.Builder(
                this,
                CHANNEL_ID
            )
                .setSmallIcon(
                    android.R.drawable.ic_dialog_info
                )
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(
                    NotificationCompat.BigTextStyle()
                        .bigText(body)
                )
                .setPriority(
                    NotificationCompat.PRIORITY_HIGH
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
        } catch (
            securityException: SecurityException
        ) {
            Log.e(
                TAG,
                "Notification permission not granted",
                securityException
            )
        }
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