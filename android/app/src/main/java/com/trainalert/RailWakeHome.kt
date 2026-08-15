package com.trainalert

import android.Manifest
import androidx.compose.material3.CircularProgressIndicator
import android.content.Context
import android.content.pm.PackageManager
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
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val RAILWAKE_ZONE = ZoneId.of("Asia/Kolkata")
private val RAILWAKE_LOCALE = Locale("en", "IN")
private val CLOCK_FORMAT =
    DateTimeFormatter.ofPattern("h:mm a", RAILWAKE_LOCALE)

private fun railWakeGreeting(): String {
    val hour = LocalTime.now(RAILWAKE_ZONE).hour
    return when {
        hour < 12 -> "Good morning"
        hour < 17 -> "Good afternoon"
        else -> "Good evening"
    }
}

private fun formatClock(value: String?): String {
    if (value.isNullOrBlank()) return "—"

    return runCatching {
        Instant.parse(value)
            .atZone(RAILWAKE_ZONE)
            .format(CLOCK_FORMAT)
    }.getOrDefault("—")
}

private fun minutesToStop(expectedArrival: String?): Long? {
    if (expectedArrival.isNullOrBlank()) return null

    return runCatching {
        Duration.between(
            Instant.now(),
            Instant.parse(expectedArrival)
        ).toMinutes()
    }.getOrNull()
}

private fun journeyDateLabel(date: String): String {
    return runCatching {
        val journeyDate = LocalDate.parse(date)
        val today = LocalDate.now(RAILWAKE_ZONE)

        when (journeyDate) {
            today -> "Today"
            today.plusDays(1) -> "Tomorrow"
            else -> journeyDate.format(
                DateTimeFormatter.ofPattern(
                    "dd MMM yyyy",
                    RAILWAKE_LOCALE
                )
            )
        }
    }.getOrDefault(date)
}

@Composable
fun RailWakeHomeScreen(
    context: Context,
    upcomingJourneys: List<Journey>,
    completedJourneys: List<Journey>,
    cancelledJourneys: List<Journey>,
    onAddJourney: () -> Unit,
    onJourneyClick: (Journey) -> Unit,
    onRetry: () -> Unit,
    loading: Boolean,
    error: String?
) {
    var nowMillis by remember {
        mutableLongStateOf(System.currentTimeMillis())
    }

    LaunchedEffect(Unit) {
        while (true) {
            nowMillis = System.currentTimeMillis()
            delay(30_000)
        }
    }

    val primaryJourney =
        upcomingJourneys.firstOrNull {
            it.state == "active"
        } ?: upcomingJourneys.firstOrNull()

    val notificationEnabled =
        if (
            android.os.Build.VERSION.SDK_INT >=
                android.os.Build.VERSION_CODES.TIRAMISU
        ) {
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(
            Modifier.height(4.dp)
        )

        Text(
            text = "RailWake",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold
        )

        Text(
            text = "${railWakeGreeting()} 👋",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = if (primaryJourney == null) {
                "Sleep through the journey. We'll wake you before your stop."
            } else {
                "Your next stop, handled."
            },
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        when {
            loading -> {
                HomeLoadingCard()
            }

            error != null -> {
                HomeErrorCardV2(
                    message = error,
                    onRetry = onRetry
                )
            }

            primaryJourney != null -> {
                ActiveJourneyHeroCard(
                    journey = primaryJourney,
                    nowMillis = nowMillis,
                    onClick = {
                        onJourneyClick(primaryJourney)
                    }
                )
            }

            else -> {
                EmptyJourneyHero(
                    onAddJourney = onAddJourney
                )
            }
        }

        ProtectionStatusCard(
            notificationEnabled = notificationEnabled
        )

        Button(
            onClick = onAddJourney,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(
                text = "＋",
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(Modifier.size(8.dp))

            Text(
                if (primaryJourney == null) {
                    "Add your first journey"
                } else {
                    "Add another journey"
                }
            )
        }

        if (
            upcomingJourneys.size > 1
        ) {
            Text(
                text = "Other upcoming journeys",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            upcomingJourneys
                .drop(1)
                .forEach { journey ->
                    CompactJourneyCard(
                        journey = journey,
                        onClick = {
                            onJourneyClick(journey)
                        }
                    )
                }
        }

        if (completedJourneys.isNotEmpty()) {
            Text(
                text = "Recent journeys",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            completedJourneys
                .take(3)
                .forEach { journey ->
                    CompactJourneyCard(
                        journey = journey,
                        onClick = {
                            onJourneyClick(journey)
                        }
                    )
                }
        }

        if (cancelledJourneys.isNotEmpty()) {
            Text(
                text = "Cancelled",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            cancelledJourneys
                .take(2)
                .forEach { journey ->
                    CompactJourneyCard(
                        journey = journey,
                        onClick = {
                            onJourneyClick(journey)
                        }
                    )
                }
        }

        Spacer(
            Modifier.height(16.dp)
        )

        Text(
            text =
                "ETA updates automatically and your alerts adjust when the train is delayed.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(
            Modifier.height(8.dp)
        )
    }
}

@Composable
private fun ActiveJourneyHeroCard(
    journey: Journey,
    nowMillis: Long,
    onClick: () -> Unit
) {
    val minutes =
        minutesToStop(journey.expectedArrival)

    val destination =
        journey.destinationStationName
            ?.takeIf { it.isNotBlank() }
            ?: journey.destinationStationCode

    val stateLabel =
        when (journey.state) {
            "active" -> "ON TRAIN"
            "scheduled" -> "UPCOMING"
            else -> journey.state.uppercase()
        }

    val stateSupporting =
        when (journey.state) {
            "active" -> "Trip protection is active"
            "scheduled" -> "We'll monitor this journey"
            else -> "Journey status"
        }

    val delay =
        journey.delayMinutes

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(
            containerColor =
                MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(22.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement =
                    Arrangement.SpaceBetween,
                verticalAlignment =
                    Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment =
                        Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(
                                MaterialTheme.colorScheme.primary,
                                CircleShape
                            )
                    )

                    Spacer(
                        Modifier.size(8.dp)
                    )

                    Text(
                        text = stateLabel,
                        style =
                            MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    text = journeyDateLabel(
                        journey.journeyDate
                    ),
                    style =
                        MaterialTheme.typography.labelLarge
                )
            }

            Spacer(
                Modifier.height(18.dp)
            )

            Text(
                text = "Train ${journey.trainNumber}",
                style =
                    MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = destination,
                style =
                    MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(
                Modifier.height(22.dp)
            )

            if (minutes != null && minutes >= 0) {
                Text(
                    text = "$minutes min",
                    style =
                        MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "to your stop",
                    style =
                        MaterialTheme.typography.titleMedium,
                    color =
                        MaterialTheme.colorScheme.onPrimaryContainer
                            .copy(alpha = 0.75f)
                )
            } else {
                Text(
                    text = "ETA unavailable",
                    style =
                        MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(
                Modifier.height(18.dp)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement =
                    Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Expected arrival",
                        style =
                            MaterialTheme.typography.labelMedium
                    )

                    Text(
                        text = formatClock(
                            journey.expectedArrival
                        ),
                        style =
                            MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                Column(
                    horizontalAlignment =
                        Alignment.End
                ) {
                    Text(
                        text = stateSupporting,
                        style =
                            MaterialTheme.typography.labelMedium
                    )

                    Text(
                        text = when {
                            delay == null -> "Monitoring"
                            delay > 0 ->
                                "${delay} min late"
                            delay < 0 ->
                                "${-delay} min early"
                            else -> "On time"
                        },
                        style =
                            MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(
                Modifier.height(16.dp)
            )

            journey.nextAlert
                ?.takeIf { it.isNotBlank() }
                ?.let { nextAlert ->
                    Surface(
                        shape =
                            RoundedCornerShape(16.dp),
                        color =
                            MaterialTheme.colorScheme.surface
                                .copy(alpha = 0.72f)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalAlignment =
                                Alignment.CenterVertically
                        ) {
                            Text(
                                text = "🔔",
                                style = MaterialTheme.typography.titleLarge
                            )

                            Spacer(
                                Modifier.size(10.dp)
                            )

                            Column {
                                Text(
                                    text = "Next alert",
                                    style =
                                        MaterialTheme
                                            .typography
                                            .labelMedium
                                )

                                Text(
                                    text = formatClock(
                                        nextAlert
                                    ),
                                    style =
                                        MaterialTheme
                                            .typography
                                            .bodyLarge,
                                    fontWeight =
                                        FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

            Spacer(
                Modifier.height(12.dp)
            )

            Text(
                text = "View journey →",
                style =
                    MaterialTheme.typography.labelLarge,
                color =
                    MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun ProtectionStatusCard(
    notificationEnabled: Boolean
) {
    val healthy =
        notificationEnabled

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = if (healthy) "✓" else "!",
                style = MaterialTheme.typography.headlineSmall,
                color =
                    if (healthy) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
            )

            Spacer(
                Modifier.size(12.dp)
            )

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text =
                        if (healthy) {
                            "Trip protection active"
                        } else {
                            "Limited protection"
                        },
                    style =
                        MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text =
                        if (healthy) {
                            "Notifications are enabled."
                        } else {
                            "Notifications are disabled, so alerts may not reach you."
                        },
                    style =
                        MaterialTheme.typography.bodySmall,
                    color =
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun EmptyJourneyHero(
    onAddJourney: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(28.dp)
    ) {
        Column(
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "Ready for your next journey?",
                style =
                    MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(
                Modifier.height(8.dp)
            )

            Text(
                text =
                    "Choose your train, travel date and destination. We'll handle the alerts.",
                style =
                    MaterialTheme.typography.bodyLarge
            )

            Spacer(
                Modifier.height(20.dp)
            )

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
private fun CompactJourneyCard(
    journey: Journey,
    onClick: () -> Unit
) {
    val destination =
        journey.destinationStationName
            ?.takeIf { it.isNotBlank() }
            ?: journey.destinationStationCode

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            horizontalArrangement =
                Arrangement.SpaceBetween,
            verticalAlignment =
                Alignment.CenterVertically
        ) {
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text =
                        "Train ${journey.trainNumber}",
                    style =
                        MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = destination,
                    style =
                        MaterialTheme.typography.bodyLarge
                )

                Text(
                    text =
                        journeyDateLabel(
                            journey.journeyDate
                        ),
                    style =
                        MaterialTheme.typography.bodySmall,
                    color =
                        MaterialTheme.colorScheme
                            .onSurfaceVariant
                )
            }

            Text(
                text =
                    when (journey.state) {
                        "active" -> "ON TRAIN"
                        "scheduled" -> "UPCOMING"
                        "completed" -> "COMPLETED"
                        "cancelled" -> "CANCELLED"
                        else ->
                            journey.state.uppercase()
                    },
                style =
                    MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun HomeLoadingCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(40.dp),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    }
}

@Composable
private fun HomeErrorCardV2(
    message: String,
    onRetry: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            Text(
                text = "We couldn't load your journeys",
                style =
                    MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Spacer(
                Modifier.height(6.dp)
            )

            Text(
                text = message,
                color = MaterialTheme.colorScheme.error
            )

            Spacer(
                Modifier.height(14.dp)
            )

            OutlinedButton(
                onClick = onRetry
            ) {
                Text("Try again")
            }
        }
    }
}
