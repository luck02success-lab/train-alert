package com.trainalert

import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
            AlarmScreen(
                context = this,
                title = title.ifBlank { "WAKE UP" },
                body = body.ifBlank { "Your stop is approaching." },
                offsetMinutes = offsetMinutes,
                onDismiss = {
                    AlarmSnoozeScheduler.cancel(this, notificationId)
                    com.trainalert.notification.NotificationHelper.dismissNotification(
                        this,
                        notificationId
                    )
                    finishAndRemoveTask()
                },
                onSnooze = { minutes ->
                    AlarmSnoozeScheduler.snooze(
                        context = this,
                        delayMinutes = minutes,
                        title = title.ifBlank { "WAKE UP" },
                        body = body.ifBlank { "Your stop is approaching." },
                        journeyId = journeyId,
                        notificationId = notificationId,
                        offsetMinutes = offsetMinutes
                    )
                    com.trainalert.notification.NotificationHelper.dismissNotification(
                        this,
                        notificationId
                    )
                    finishAndRemoveTask()
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

        onDispose {
            ringtone?.stop()
        }
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
            Text(text = "🚆", fontSize = 48.sp)

            Spacer(Modifier.height(26.dp))

            Text(
                text = title,
                color = Color.White,
                fontSize = 42.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(10.dp))

            Text(
                text = body,
                color = Color.White,
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(Modifier.height(28.dp))

            Text(
                text = if (offsetMinutes <= 15) {
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
                                    withTimeout(2000) {
                                        awaitRelease()
                                    }
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
                        text = "I'M",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "AWAKE",
                        color = Color.White,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            Text(
                text = "Hold for 2 seconds to dismiss",
                color = Color.White.copy(alpha = 0.82f),
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(Modifier.height(24.dp))

            Text(
                text = "Snooze",
                color = Color.White,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                TextButton(onClick = { onSnooze(5) }) {
                    Text("5 min", color = Color.White)
                }
                TextButton(onClick = { onSnooze(10) }) {
                    Text("10 min", color = Color.White)
                }
                TextButton(onClick = { onSnooze(15) }) {
                    Text("15 min", color = Color.White)
                }
            }
        }
    }
}
