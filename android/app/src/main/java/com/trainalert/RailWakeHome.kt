package com.trainalert

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val RW_ZONE = ZoneId.of("Asia/Kolkata")
private val RW_LOCALE = Locale("en", "IN")
private val RW_TIME = DateTimeFormatter.ofPattern("h:mm a", RW_LOCALE)

private fun rwGreeting(): String {
    return when (LocalTime.now(RW_ZONE).hour) {
        in 0..11 -> "Good morning"
        in 12..16 -> "Good afternoon"
        else -> "Good evening"
    }
}

private fun rwTime(value: String?): String =
    value?.takeIf { it.isNotBlank() }?.let {
        runCatching {
            Instant.parse(it).atZone(RW_ZONE).format(RW_TIME)
        }.getOrDefault("—")
    } ?: "—"

private fun rwMinutes(value: String?): Long? =
    value?.takeIf { it.isNotBlank() }?.let {
        runCatching {
            Duration.between(Instant.now(), Instant.parse(it)).toMinutes()
        }.getOrNull()
    }

private fun rwDateLabel(date: String): String =
    runCatching {
        val d = LocalDate.parse(date)
        val today = LocalDate.now(RW_ZONE)
        when (d) {
            today -> "Today"
            today.plusDays(1) -> "Tomorrow"
            else -> d.format(DateTimeFormatter.ofPattern("dd MMM", RW_LOCALE))
        }
    }.getOrDefault(date)

@Composable
fun RailWakeHomeScreen(
    context: Context,
    upcomingJourneys: List<Journey>,
    completedJourneys: List<Journey>,
    cancelledJourneys: List<Journey>,
    onAddJourney: () -> Unit,
    onProtectionCenter: () -> Unit,
    onJourneyClick: (Journey) -> Unit,
    onRetry: () -> Unit,
    loading: Boolean,
    error: String?
) {
    var clock by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            clock = System.currentTimeMillis()
            delay(30_000)
        }
    }

    val primary = upcomingJourneys.firstOrNull { it.state == "active" }
        ?: upcomingJourneys.firstOrNull()

    val notificationsEnabled =
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Spacer(Modifier.height(6.dp))

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    "RailWake",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    "${rwGreeting()} 👋",
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.titleMedium
                )
            }

            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Text(
                    "Sleep easy",
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }

        Text(
            text = if (primary == null) {
                "Your next stop, handled."
            } else {
                if (primary.state == "active") {
                    "You relax. We watch the journey."
                } else {
                    "We'll wake you before your stop."
                }
            },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        when {
            loading && primary == null -> {
                LoadingHomeCard()
            }

            error != null && primary == null -> {
                ErrorHomeCard(error = error, onRetry = onRetry)
            }

            primary != null -> {
                AliveJourneyCard(
                    journey = primary,
                    onClick = { onJourneyClick(primary) }
                )
            }

            else -> {
                FirstJourneyCard(onAddJourney = onAddJourney)
            }
        }

        ProtectionStrip(
            notificationsEnabled = notificationsEnabled,
            hasJourney = primary != null,
            onOpenProtection = onProtectionCenter
        )

        Card(
            onClick = onProtectionCenter,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(15.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "✓",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                Spacer(Modifier.size(10.dp))

                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = "RailWake Protection",
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        text = "Check that your phone is ready to wake you.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = "→",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        Spacer(Modifier.height(2.dp))

        Button(
            onClick = onAddJourney,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp)
        ) {
            Text(
                "＋  ${if (primary == null) "Add your first journey" else "Add another journey"}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        if (upcomingJourneys.size > 1) {
            SectionLabel("Upcoming")
            upcomingJourneys.drop(1).forEach { journey ->
                SmallJourneyCard(
                    journey = journey,
                    onClick = { onJourneyClick(journey) }
                )
            }
        }

        if (completedJourneys.isNotEmpty()) {
            SectionLabel("Recent")
            completedJourneys.take(3).forEach { journey ->
                SmallJourneyCard(
                    journey = journey,
                    onClick = { onJourneyClick(journey) }
                )
            }
        }

        if (cancelledJourneys.isNotEmpty()) {
            Text(
                "Cancelled",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            cancelledJourneys.take(2).forEach { journey ->
                SmallJourneyCard(
                    journey = journey,
                    onClick = { onJourneyClick(journey) }
                )
            }
        }

        Text(
            "Live ETA updates adjust your alerts automatically.",
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 2.dp),
            textAlign = TextAlign.Center,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun AliveJourneyCard(
    journey: Journey,
    onClick: () -> Unit
) {
    val pulse = rememberInfiniteTransition(label = "monitoringPulse")
    val pulseAlpha by pulse.animateFloat(
        initialValue = 0.55f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900),
            repeatMode = RepeatMode.Reverse
        ),
        label = "monitoringAlpha"
    )

    val destination =
        journey.destinationStationName?.takeIf { it.isNotBlank() }
            ?: journey.destinationStationCode

    val minutes = rwMinutes(journey.expectedArrival)
    val delay = journey.delayMinutes

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(30.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(Modifier.padding(22.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.7f)
                ) {
                    Row(
                        Modifier.padding(horizontal = 11.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .alpha(pulseAlpha)
                                .background(
                                    MaterialTheme.colorScheme.primary,
                                    CircleShape
                                )
                        )
                        Spacer(Modifier.size(7.dp))
                        Text(
                            if (journey.state == "active") "MONITORING LIVE" else "READY",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Text(
                    rwDateLabel(journey.journeyDate),
                    style = MaterialTheme.typography.labelLarge
                )
            }

            Spacer(Modifier.height(18.dp))

            Text(
                "🚆  Train ${journey.trainNumber}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(3.dp))

            Text(
                destination,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(22.dp))

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Bottom
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        when {
                            minutes == null -> "—"
                            minutes < 0 -> "Arrived"
                            else -> "$minutes"
                        },
                        fontSize = 58.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Text(
                        when {
                            minutes == null -> "ETA unavailable"
                            minutes < 0 -> "Your stop has passed"
                            else -> "minutes to your stop"
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.72f)
                    )
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        "Expected",
                        style = MaterialTheme.typography.labelMedium
                    )
                    Text(
                        rwTime(journey.expectedArrival),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.68f)
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(13.dp),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            "Next wake-up",
                            style = MaterialTheme.typography.labelMedium
                        )
                        Text(
                            rwTime(journey.nextAlert),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    Text(
                        when {
                            delay == null -> "On track"
                            delay > 0 -> "${delay}m late"
                            delay < 0 -> "${-delay}m early"
                            else -> "On time"
                        },
                        modifier = Modifier.align(Alignment.CenterVertically),
                        color = if ((delay ?: 0) > 0) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.primary
                        },
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            Text(
                "Tap to view journey →",
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}

@Composable
private fun ProtectionStrip(
    notificationsEnabled: Boolean,
    hasJourney: Boolean,
    onOpenProtection: () -> Unit
) {
    val healthy = notificationsEnabled

    Card(
        onClick = onOpenProtection,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor =
                if (healthy) {
                    MaterialTheme.colorScheme.surfaceVariant
                } else {
                    MaterialTheme.colorScheme.errorContainer
                }
        )
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(15.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                if (healthy) "✓" else "!",
                fontSize = 23.sp,
                fontWeight = FontWeight.Bold,
                color =
                    if (healthy) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
            )

            Spacer(Modifier.size(10.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    when {
                        !healthy -> "Protection needs attention"
                        hasJourney -> "Trip protection active"
                        else -> "RailWake protection ready"
                    },
                    fontWeight = FontWeight.Bold
                )

                Text(
                    when {
                        !healthy ->
                            "Notifications are off. Tap to fix your protection."
                        hasJourney ->
                            "Live ETA + wake-up alerts are enabled."
                        else ->
                            "Your phone is ready for journey alerts."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                "→",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun SmallJourneyCard(
    journey: Journey,
    onClick: () -> Unit
) {
    val destination =
        journey.destinationStationName?.takeIf { it.isNotBlank() }
            ?: journey.destinationStationCode

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "Train ${journey.trainNumber}",
                    fontWeight = FontWeight.Bold
                )
                Text(destination)
                Text(
                    rwDateLabel(journey.journeyDate),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                when (journey.state) {
                    "active" -> "LIVE"
                    "scheduled" -> "UPCOMING"
                    "completed" -> "DONE"
                    else -> journey.state.uppercase()
                },
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold
    )
}

@Composable
private fun FirstJourneyCard(
    onAddJourney: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(26.dp)
    ) {
        Column(Modifier.padding(23.dp)) {
            Text("Ready for your next trip? 🚆", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(7.dp))
            Text("Tell RailWake your train, date and stop. We'll take it from there.")
            Spacer(Modifier.height(18.dp))
            OutlinedButton(
                onClick = onAddJourney,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Text("Add journey")
            }
        }
    }
}

@Composable
private fun LoadingHomeCard() {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(
            Modifier.padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("Getting your journeys ready…", fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(14.dp))
            androidx.compose.material3.LinearProgressIndicator(
                Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
private fun ErrorHomeCard(
    error: String,
    onRetry: () -> Unit
) {
    Card(
        Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(Modifier.padding(20.dp)) {
            Text("Something went wrong", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(5.dp))
            Text(error, color = MaterialTheme.colorScheme.error)
            Spacer(Modifier.height(12.dp))
            OutlinedButton(onClick = onRetry) {
                Text("Try again")
            }
        }
    }
}
