package com.trainalert

import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withTimeout

class AlarmActivity : ComponentActivity() {
    companion object {
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"
        const val EXTRA_JOURNEY_ID = "journeyId"
        const val EXTRA_NOTIFICATION_ID = "notificationId"
        const val EXTRA_OFFSET_MINUTES = "offsetMinutes"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )

        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }

        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val body = intent.getStringExtra(EXTRA_BODY).orEmpty()
        val journeyId = intent.getStringExtra(EXTRA_JOURNEY_ID)
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
        val offsetMinutes = intent.getIntExtra(EXTRA_OFFSET_MINUTES, 15)

        setContent {
            var snoozing by remember { mutableStateOf(false) }

            AlarmScreen(
                context = this,
                title = title.ifBlank { "WAKE UP" },
                body = body.ifBlank { "Your stop is approaching." },
                offsetMinutes = offsetMinutes,
                snoozing = snoozing,
                onDismiss = {
                    AlarmSnoozeScheduler.cancel(this, notificationId)
                    com.trainalert.notification.NotificationHelper
                        .dismissNotification(this, notificationId)
                    finishAndRemoveTask()
                },
                onSnooze = { minutes ->
                    if (snoozing) return@AlarmScreen

                    snoozing = true

                    AlarmSnoozeScheduler.snoozeForJourney(
                        context = this,
                        journeyId = journeyId,
                        requestedMinutes = minutes,
                        title = title.ifBlank { "WAKE UP" },
                        body = body.ifBlank { "Your stop is approaching." },
                        notificationId = notificationId,
                        offsetMinutes = offsetMinutes,
                        onScheduled = { scheduled ->
                            runOnUiThread {
                                snoozing = false

                                if (!scheduled) {
                                    Toast.makeText(
                                        this,
                                        "Your stop is very close. Stay awake.",
                                        Toast.LENGTH_LONG
                                    ).show()
                                    return@runOnUiThread
                                }

                                com.trainalert.notification.NotificationHelper
                                    .dismissNotification(this, notificationId)
                                finishAndRemoveTask()
                            }
                        }
                    )
                }
            )
        }
    }
}

@Composable
private fun AlarmScreen(
    context: Context,
    title: String,
    body: String,
    offsetMinutes: Int,
    snoozing: Boolean,
    onDismiss: () -> Unit,
    onSnooze: (Int) -> Unit
) {
    val alarmUri = remember {
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
    }

    var ringtone by remember { mutableStateOf<Ringtone?>(null) }

    DisposableEffect(alarmUri) {
        val tone = RingtoneManager.getRingtone(context, alarmUri)
        ringtone = tone
        tone?.audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        tone?.play()

        onDispose { ringtone?.stop() }
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFFD9272E)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("🚆", fontSize = 48.sp)
            Spacer(Modifier.height(26.dp))

            Text(
                title,
                color = Color.White,
                fontSize = 42.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(10.dp))

            Text(
                body,
                color = Color.White,
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(Modifier.height(28.dp))

            Text(
                if (offsetMinutes <= 15) {
                    "Your stop is approaching."
                } else {
                    "It's time to get ready."
                },
                color = Color.White.copy(alpha = 0.92f),
                style = MaterialTheme.typography.bodyLarge
            )

            Spacer(Modifier.height(34.dp))

            Box(
                modifier = Modifier
                    .size(220.dp)
                    .background(
                        Color.White.copy(alpha = 0.12f),
                        CircleShape
                    )
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onPress = {
                                try {
                                    withTimeout(2000) { awaitRelease() }
                                } catch (_: TimeoutCancellationException) {
                                    onDismiss()
                                }
                            }
                        )
                    },
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        "I'M",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "AWAKE",
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            Text(
                "Hold for 2 seconds to dismiss",
                color = Color.White.copy(alpha = 0.82f),
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(Modifier.height(24.dp))

            Text(
                "Snooze",
                color = Color.White,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                listOf(5, 10, 15).forEach { minutes ->
                    TextButton(
                        enabled = !snoozing && minutes < maxOf(offsetMinutes, 6),
                        onClick = { onSnooze(minutes) }
                    ) {
                        Text("$minutes min", color = Color.White)
                    }
                }
            }

            if (snoozing) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Checking your latest ETA…",
                    color = Color.White.copy(alpha = 0.85f),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
