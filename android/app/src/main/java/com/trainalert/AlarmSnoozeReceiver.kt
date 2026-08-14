package com.trainalert

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

import com.trainalert.notification.NotificationHelper

object AlarmSnoozeScheduler {

    private const val REQUEST_CODE_BASE = 70_000
    private const val ACTION = "com.trainalert.SNOOZED_ALARM"

    fun snooze(
        context: Context,
        delayMinutes: Int,
        title: String,
        body: String,
        journeyId: String?,
        notificationId: Int,
        offsetMinutes: Int
    ) {
        val alarmManager =
            context.getSystemService(AlarmManager::class.java)

        val requestCode =
            REQUEST_CODE_BASE +
                (notificationId.coerceAtLeast(0) % 10_000)

        val intent =
            Intent(
                context,
                AlarmSnoozeReceiver::class.java
            ).apply {
                action = ACTION

                putExtra(
                    AlarmActivity.EXTRA_TITLE,
                    title
                )

                putExtra(
                    AlarmActivity.EXTRA_BODY,
                    body
                )

                putExtra(
                    AlarmActivity.EXTRA_JOURNEY_ID,
                    journeyId
                )

                putExtra(
                    AlarmActivity.EXTRA_NOTIFICATION_ID,
                    notificationId
                )

                putExtra(
                    AlarmActivity.EXTRA_OFFSET_MINUTES,
                    offsetMinutes
                )
            }

        val pendingIntent =
            PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or
                    PendingIntent.FLAG_IMMUTABLE
            )

        val triggerAt =
            System.currentTimeMillis() +
                delayMinutes * 60_000L

        alarmManager.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            pendingIntent
        )
    }

    fun cancel(
        context: Context,
        notificationId: Int
    ) {
        if (notificationId < 0) {
            return
        }

        val alarmManager =
            context.getSystemService(
                AlarmManager::class.java
            )

        val requestCode =
            REQUEST_CODE_BASE +
                (notificationId % 10_000)

        val intent =
            Intent(
                context,
                AlarmSnoozeReceiver::class.java
            ).apply {
                action = ACTION
            }

        val pendingIntent =
            PendingIntent.getBroadcast(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_NO_CREATE or
                    PendingIntent.FLAG_IMMUTABLE
            ) ?: return

        alarmManager.cancel(
            pendingIntent
        )

        pendingIntent.cancel()
    }
}

class AlarmSnoozeReceiver : BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent
    ) {
        if (
            intent.action !=
            "com.trainalert.SNOOZED_ALARM"
        ) {
            return
        }

        val title =
            intent.getStringExtra(
                AlarmActivity.EXTRA_TITLE
            ) ?: "WAKE UP"

        val body =
            intent.getStringExtra(
                AlarmActivity.EXTRA_BODY
            ) ?: "Your stop is approaching."

        val journeyId =
            intent.getStringExtra(
                AlarmActivity.EXTRA_JOURNEY_ID
            )

        val notificationId =
            intent.getIntExtra(
                AlarmActivity.EXTRA_NOTIFICATION_ID,
                1000
            )

        val offsetMinutes =
            intent.getIntExtra(
                AlarmActivity.EXTRA_OFFSET_MINUTES,
                15
            )

        NotificationHelper.showNotification(
            context = context,
            notificationId = notificationId,
            title = title,
            body = body,
            journeyId = journeyId,
            offsetMinutes = offsetMinutes
        )
    }
}
