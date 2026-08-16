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
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
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
        val notificationId =
            intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1)
        val offsetMinutes =
            intent.getIntExtra(EXTRA_OFFSET_MINUTES, 15)

        setContent {
            var snoozing by remember {
                mutableStateOf(false)
            }

            AlarmScreen(
                context = this,
                title = title.ifBlank { "WAKE UP" },
                body = body.ifBlank {
                    "Your stop is approaching."
                },
                offsetMinutes = offsetMinutes,
                snoozing = snoozing,
                onDismiss = {
                    AlarmSnoozeScheduler.cancel(
                        this,
                        notificationId
                    )

                    com.trainalert.notification.NotificationHelper
                        .dismissNotification(
                            this,
                            notificationId
                        )

                    finishAndRemoveTask()
                },
                onSnooze = { minutes ->
                    if (snoozing) {
                        return@AlarmScreen
                    }

                    snoozing = true

                    AlarmSnoozeScheduler.snoozeForJourney(
                        context = this,
                        journeyId = journeyId,
                        requestedMinutes = minutes,
                        title = title.ifBlank {
                            "WAKE UP"
                        },
                        body = body.ifBlank {
                            "Your stop is approaching."
                        },
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
                                    .dismissNotification(
                                        this,
                                        notificationId
                                    )

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
        RingtoneManager.getDefaultUri(
            RingtoneManager.TYPE_ALARM
        )
    }

    var ringtone by remember {
        mutableStateOf<Ringtone?>(null)
    }

    val pulse =
        androidx.compose.animation.core
            .rememberInfiniteTransition(
                label = "alarmPulse"
            )

    val pulseAlpha by pulse.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec =
            androidx.compose.animation.core
                .infiniteRepeatable(
                    androidx.compose.animation.core.tween(
                        durationMillis = 900
                    ),
                    repeatMode =
                        androidx.compose.animation.core
                            .RepeatMode
                            .Reverse
                ),
        label = "alarmPulseAlpha"
    )

    var elapsedSeconds by remember {
        mutableLongStateOf(0L)
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            elapsedSeconds++
        }
    }

    DisposableEffect(alarmUri) {
        val tone =
            RingtoneManager.getRingtone(
                context,
                alarmUri
            )

        ringtone = tone

        tone?.audioAttributes =
            AudioAttributes.Builder()
                .setUsage(
                    AudioAttributes.USAGE_ALARM
                )
                .setContentType(
                    AudioAttributes.CONTENT_TYPE_SONIFICATION
                )
                .build()

        tone?.play()

        onDispose {
            ringtone?.stop()
        }
    }

    val urgencyText =
        when {
            offsetMinutes <= 5 ->
                "Your stop is very close"

            offsetMinutes <= 15 ->
                "Your stop is approaching"

            else ->
                "Time to get ready"
        }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = Color(0xFFD9272E)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(
                    horizontal = 26.dp,
                    vertical = 34.dp
                ),
            horizontalAlignment =
                Alignment.CenterHorizontally,
            verticalArrangement =
                Arrangement.Center
        ) {
            Text(
                "🚆",
                fontSize = 48.sp
            )

            Spacer(
                Modifier.height(18.dp)
            )

            Surface(
                shape = RoundedCornerShape(50),
                color = Color.White.copy(
                    alpha = 0.14f
                )
            ) {
                Row(
                    modifier = Modifier.padding(
                        horizontal = 13.dp,
                        vertical = 7.dp
                    ),
                    verticalAlignment =
                        Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .alpha(pulseAlpha)
                            .background(
                                Color.White,
                                CircleShape
                            )
                    )

                    Spacer(
                        Modifier.size(7.dp)
                    )

                    Text(
                        urgencyText,
                        color = Color.White,
                        style =
                            MaterialTheme
                                .typography
                                .labelLarge,
                        fontWeight =
                            FontWeight.Bold
                    )
                }
            }

            Spacer(
                Modifier.height(22.dp)
            )

            Text(
                title,
                color = Color.White,
                fontSize = 44.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(
                Modifier.height(8.dp)
            )

            Text(
                body,
                color =
                    Color.White.copy(
                        alpha = 0.94f
                    ),
                style =
                    MaterialTheme
                        .typography
                        .titleLarge
            )

            Spacer(
                Modifier.height(14.dp)
            )

            Text(
                if (offsetMinutes <= 15) {
                    "$offsetMinutes minutes until your stop"
                } else {
                    "Wake-up reminder"
                },
                color =
                    Color.White.copy(
                        alpha = 0.82f
                    ),
                style =
                    MaterialTheme
                        .typography
                        .bodyLarge
            )

            Spacer(
                Modifier.height(30.dp)
            )

            Box(
                modifier = Modifier
                    .size(226.dp)
                    .background(
                        Color.White.copy(
                            alpha = 0.12f
                        ),
                        CircleShape
                    )
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onPress = {
                                try {
                                    withTimeout(2000) {
                                        awaitRelease()
                                    }
                                } catch (
                                    _: TimeoutCancellationException
                                ) {
                                    onDismiss()
                                }
                            }
                        )
                    },
                contentAlignment =
                    Alignment.Center
            ) {
                Column(
                    horizontalAlignment =
                        Alignment.CenterHorizontally
                ) {
                    Text(
                        "I'M",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight =
                            FontWeight.Bold
                    )

                    Text(
                        "AWAKE",
                        color = Color.White,
                        fontSize = 30.sp,
                        fontWeight =
                            FontWeight.Bold
                    )

                    Spacer(
                        Modifier.height(5.dp)
                    )

                    Text(
                        "hold to dismiss",
                        color =
                            Color.White.copy(
                                alpha = 0.78f
                            ),
                        style =
                            MaterialTheme
                                .typography
                                .bodySmall
                    )
                }
            }

            Spacer(
                Modifier.height(26.dp)
            )

            Surface(
                modifier =
                    Modifier.fillMaxWidth(),
                shape =
                    RoundedCornerShape(20.dp),
                color =
                    Color.White.copy(
                        alpha = 0.10f
                    )
            ) {
                Column(
                    modifier =
                        Modifier.padding(
                            13.dp
                        ),
                    horizontalAlignment =
                        Alignment.CenterHorizontally
                ) {
                    Text(
                        "Snooze",
                        color = Color.White,
                        fontWeight =
                            FontWeight.Bold
                    )

                    Row(
                        horizontalArrangement =
                            Arrangement.Center
                    ) {
                        listOf(
                            5,
                            10,
                            15
                        ).forEach { minutes ->
                            TextButton(
                                enabled =
                                    !snoozing &&
                                        minutes <
                                            maxOf(
                                                offsetMinutes,
                                                6
                                            ),
                                onClick = {
                                    onSnooze(
                                        minutes
                                    )
                                }
                            ) {
                                Text(
                                    "$minutes min",
                                    color =
                                        if (
                                            !snoozing &&
                                            minutes <
                                                maxOf(
                                                    offsetMinutes,
                                                    6
                                                )
                                        ) {
                                            Color.White
                                        } else {
                                            Color.White.copy(
                                                alpha = 0.35f
                                            )
                                        }
                                )
                            }
                        }
                    }

                    if (snoozing) {
                        Text(
                            "Checking your latest ETA…",
                            color =
                                Color.White.copy(
                                    alpha = 0.82f
                                ),
                            style =
                                MaterialTheme
                                    .typography
                                    .bodySmall
                        )
                    }
                }
            }

            Spacer(
                Modifier.height(16.dp)
            )

            Text(
                "RailWake is watching your journey.",
                color =
                    Color.White.copy(
                        alpha = 0.72f
                    ),
                style =
                    MaterialTheme
                        .typography
                        .bodySmall
            )
        }
    }
}
