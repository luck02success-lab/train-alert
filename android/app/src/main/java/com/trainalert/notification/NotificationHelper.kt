package com.trainalert.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.trainalert.MainActivity
import com.trainalert.R

object NotificationHelper {

    /*
     * We intentionally use a new channel ID instead of
     * the previous "train_alerts" channel.
     *
     * Android permanently persists channel behavior once
     * a channel has been created.
     */
    private const val CHANNEL_ID =
        "train_alert_alarm_v2"

    private const val CHANNEL_NAME =
        "Train Stop Alerts"

    private const val CHANNEL_DESCRIPTION =
        "Important alerts when your train is approaching your destination."

    private const val DISMISS_ACTION =
        "com.trainalert.DISMISS_NOTIFICATION"

    private const val EXTRA_NOTIFICATION_ID =
        "notificationId"

    private const val EXTRA_JOURNEY_ID =
        "journeyId"

    private val VIBRATION_PATTERN =
        longArrayOf(
            0,
            500,
            250,
            500,
            250,
            900
        )

    fun createChannel(
        context: Context
    ) {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.O
        ) {
            return
        }

        val manager =
            context.getSystemService(
                NotificationManager::class.java
            )

        /*
         * The alarm/notification sound is selected from
         * the device's default alarm sound.
         *
         * USAGE_ALARM makes the intent semantically closer
         * to an alarm/reminder notification rather than
         * a normal informational notification.
         */
        val alarmSound =
            RingtoneManager.getDefaultUri(
                RingtoneManager.TYPE_ALARM
            )

        val audioAttributes =
            AudioAttributes.Builder()
                .setUsage(
                    AudioAttributes.USAGE_ALARM
                )
                .setContentType(
                    AudioAttributes.CONTENT_TYPE_SONIFICATION
                )
                .build()

        val channel =
            NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {

                description =
                    CHANNEL_DESCRIPTION

                enableVibration(true)

                vibrationPattern =
                    VIBRATION_PATTERN

                setSound(
                    alarmSound,
                    audioAttributes
                )

                /*
                 * We don't use full-screen intents.
                 * The notification remains user-controlled
                 * and appears as a high-importance heads-up
                 * notification.
                 */
                setShowBadge(true)

                lockscreenVisibility =
                    NotificationCompat
                        .VISIBILITY_PUBLIC
            }

        manager.createNotificationChannel(
            channel
        )
    }

    fun showNotification(
        context: Context,
        notificationId: Int,
        title: String,
        body: String,
        journeyId: String?
    ) {
        if (
            Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        createChannel(context)

        val contentIntent =
            Intent(
                context,
                MainActivity::class.java
            ).apply {

                action =
                    "com.trainalert.OPEN_JOURNEY"

                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP

                if (
                    !journeyId.isNullOrBlank()
                ) {
                    putExtra(
                        MainActivity.EXTRA_JOURNEY_ID,
                        journeyId
                    )
                }
            }

        val contentPendingIntent =
            PendingIntent.getActivity(
                context,
                notificationId,
                contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )

        /*
         * Dismiss action.
         *
         * This only removes the notification from the
         * device. It does not cancel the user's journey.
         */
        val dismissIntent =
            Intent(
                DISMISS_ACTION
            ).apply {

                setPackage(
                    context.packageName
                )

                putExtra(
                    EXTRA_NOTIFICATION_ID,
                    notificationId
                )
            }

        val dismissPendingIntent =
            PendingIntent.getBroadcast(
                context,
                notificationId,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )

        val notification =
            NotificationCompat.Builder(
                context,
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
                    NotificationCompat.PRIORITY_MAX
                )
                .setCategory(
                    NotificationCompat.CATEGORY_ALARM
                )
                .setVisibility(
                    NotificationCompat.VISIBILITY_PUBLIC
                )
                .setAutoCancel(true)
                .setContentIntent(
                    contentPendingIntent
                )
                .addAction(
                    NotificationCompat.Action.Builder(
                        0,
                        "Dismiss",
                        dismissPendingIntent
                    ).build()
                )
                .setWhen(
                    System.currentTimeMillis()
                )
                .setShowWhen(true)
                .build()

        try {
            NotificationManagerCompat
                .from(context)
                .notify(
                    notificationId,
                    notification
                )
        } catch (
            securityException:
            SecurityException
        ) {
            // Notification permission may have been
            // revoked while the app was running.
        }
    }

    fun dismissNotification(
        context: Context,
        notificationId: Int
    ) {
        NotificationManagerCompat
            .from(context)
            .cancel(
                notificationId
            )
    }

    fun isNotificationPermissionGranted(
        context: Context
    ): Boolean {
        if (
            Build.VERSION.SDK_INT <
            Build.VERSION_CODES.TIRAMISU
        ) {
            return true
        }

        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
        ) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun getChannelId(): String =
        CHANNEL_ID

    fun getDismissAction(): String =
        DISMISS_ACTION

    fun getNotificationIdExtra(): String =
        EXTRA_NOTIFICATION_ID

    fun getJourneyIdExtra(): String =
        EXTRA_JOURNEY_ID
}