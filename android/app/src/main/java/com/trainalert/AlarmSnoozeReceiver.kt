package com.trainalert

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import java.time.Duration
import java.time.Instant
import kotlin.math.ceil

import com.trainalert.notification.NotificationHelper

object AlarmSnoozeScheduler {
    private const val REQUEST_CODE_BASE = 70_000
    const val ACTION = "com.trainalert.SNOOZED_ALARM"
    private const val SAFETY_BUFFER_MINUTES = 5
    private const val COLLISION_WINDOW_MINUTES = 2
    private const val MIN_SNOOZE_MINUTES = 3

    fun snoozeForJourney(
        context: Context,
        journeyId: String?,
        requestedMinutes: Int,
        title: String,
        body: String,
        notificationId: Int,
        offsetMinutes: Int,
        onScheduled: (Boolean) -> Unit
    ) {
        val requested = requestedMinutes.coerceIn(1, 15)

        if (journeyId.isNullOrBlank()) {
            onScheduled(
                scheduleAt(
                    context = context,
                    triggerAtMillis =
                        System.currentTimeMillis() +
                            requested * 60_000L,
                    title = title,
                    body = body,
                    journeyId = null,
                    notificationId = notificationId,
                    offsetMinutes = offsetMinutes
                )
            )
            return
        }

        JourneyApi.getJourney(
            context = context,
            journeyId = journeyId,
            onSuccess = { journey ->
                val now = Instant.now()

                val eta =
                    journey.expectedArrival?.let { raw ->
                        runCatching {
                            Instant.parse(raw)
                        }.getOrNull()
                    }

                if (
                    eta == null ||
                    journey.state == "completed" ||
                    journey.state == "cancelled"
                ) {
                    onScheduled(
                        scheduleAt(
                            context = context,
                            triggerAtMillis =
                                System.currentTimeMillis() +
                                    requested * 60_000L,
                            title = title,
                            body = body,
                            journeyId = journeyId,
                            notificationId = notificationId,
                            offsetMinutes = offsetMinutes
                        )
                    )
                    return@getJourney
                }

                val requestedAt =
                    now.plusSeconds(requested * 60L)

                val latestSafeWake =
                    eta.minusSeconds(
                        SAFETY_BUFFER_MINUTES * 60L
                    )

                val nextPlannedAlert =
                    journey.alertOffsetsMinutes
                        .mapNotNull { offset ->
                            val candidate =
                                eta.minusSeconds(
                                    offset * 60L
                                )

                            if (candidate.isAfter(now)) {
                                candidate
                            } else {
                                null
                            }
                        }
                        .minByOrNull { it.toEpochMilli() }

                // Kotlin cannot call min() directly on java.time.Instant.
                // Compare the two timestamps explicitly.
                val target =
                    if (
                        requestedAt.isBefore(latestSafeWake)
                    ) {
                        requestedAt
                    } else {
                        latestSafeWake
                    }

                // Let the backend planned alert win if the snooze would
                // land within the configured collision window.
                if (
                    nextPlannedAlert != null &&
                    !nextPlannedAlert.isAfter(
                        target.plusSeconds(
                            COLLISION_WINDOW_MINUTES * 60L
                        )
                    )
                ) {
                    onScheduled(true)
                    return@getJourney
                }

                // Never create a snooze that lands too close to / after
                // the safety boundary.
                if (
                    !target.isAfter(
                        now.plusSeconds(
                            MIN_SNOOZE_MINUTES * 60L
                        )
                    )
                ) {
                    onScheduled(false)
                    return@getJourney
                }

                val minutesUntilTarget =
                    ceil(
                        Duration
                            .between(now, target)
                            .toMillis() / 60_000.0
                    )
                        .toInt()
                        .coerceAtLeast(1)

                onScheduled(
                    scheduleAt(
                        context = context,
                        triggerAtMillis = target.toEpochMilli(),
                        title = title,
                        body = body,
                        journeyId = journeyId,
                        notificationId = notificationId,
                        offsetMinutes = minutesUntilTarget
                    )
                )
            },
            onError = {
                // Preserve snooze UX when the network is temporarily down.
                onScheduled(
                    scheduleAt(
                        context = context,
                        triggerAtMillis =
                            System.currentTimeMillis() +
                                requested * 60_000L,
                        title = title,
                        body = body,
                        journeyId = journeyId,
                        notificationId = notificationId,
                        offsetMinutes = offsetMinutes
                    )
                )
            }
        )
    }

    fun scheduleAt(
        context: Context,
        triggerAtMillis: Long,
        title: String,
        body: String,
        journeyId: String?,
        notificationId: Int,
        offsetMinutes: Int
    ): Boolean {
        val alarmManager =
            context.getSystemService(
                AlarmManager::class.java
            ) ?: return false

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

        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !alarmManager.canScheduleExactAlarms()
        ) {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )

            return true
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        } else {
            alarmManager.setExact(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
        }

        return true
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

        alarmManager?.cancel(
            pendingIntent
        )

        pendingIntent.cancel()
    }

    fun openExactAlarmSettings(
        context: Context
    ) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return
        }

        context.startActivity(
            Intent(
                Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM
            ).apply {
                data =
                    android.net.Uri.parse(
                        "package:${context.packageName}"
                    )

                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
    }
}

class AlarmSnoozeReceiver :
    BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent
    ) {
        if (
            intent.action !=
            AlarmSnoozeScheduler.ACTION
        ) {
            return
        }

        val pendingResult =
            goAsync()

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

        val fallbackOffset =
            intent.getIntExtra(
                AlarmActivity.EXTRA_OFFSET_MINUTES,
                15
            )

        if (journeyId.isNullOrBlank()) {
            NotificationHelper.showNotification(
                context = context,
                notificationId = notificationId,
                title = title,
                body = body,
                journeyId = null,
                offsetMinutes = fallbackOffset
            )

            pendingResult.finish()
            return
        }

        JourneyApi.getJourney(
            context = context,
            journeyId = journeyId,
            onSuccess = { journey ->
                val offset =
                    journey.expectedArrival?.let { raw ->
                        runCatching {
                            val eta =
                                Instant.parse(raw)

                            val seconds =
                                Duration
                                    .between(
                                        Instant.now(),
                                        eta
                                    )
                                    .toSeconds()

                            ceil(
                                seconds / 60.0
                            )
                                .toInt()
                                .coerceAtLeast(0)
                        }.getOrNull()
                    }
                        ?.coerceAtLeast(0)
                        ?: fallbackOffset

                val station =
                    journey.destinationStationName
                        ?.takeIf {
                            it.isNotBlank()
                        }
                        ?: journey.destinationStationCode

                val resolvedTitle =
                    if (offset <= 15) {
                        "WAKE UP"
                    } else {
                        title
                    }

                val resolvedBody =
                    if (offset <= 15) {
                        "Approaching $station. Your stop is in $offset minutes."
                    } else {
                        "${journey.trainNumber} reaches $station in $offset minutes."
                    }

                NotificationHelper.showNotification(
                    context = context,
                    notificationId = notificationId,
                    title = resolvedTitle,
                    body = resolvedBody,
                    journeyId = journeyId,
                    offsetMinutes = offset
                )

                pendingResult.finish()
            },
            onError = {
                NotificationHelper.showNotification(
                    context = context,
                    notificationId = notificationId,
                    title = title,
                    body = body,
                    journeyId = journeyId,
                    offsetMinutes = fallbackOffset
                )

                pendingResult.finish()
            }
        )
    }
}
