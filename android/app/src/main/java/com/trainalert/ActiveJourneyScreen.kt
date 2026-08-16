package com.trainalert

import android.content.Context

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val ACTIVE_ZONE = ZoneId.of("Asia/Kolkata")
private val ACTIVE_TIME = DateTimeFormatter.ofPattern("h:mm a", Locale("en", "IN"))

private fun activeTime(value: String?): String =
    value?.takeIf { it.isNotBlank() }?.let {
        runCatching {
            Instant.parse(it).atZone(ACTIVE_ZONE).format(ACTIVE_TIME)
        }.getOrDefault("—")
    } ?: "—"

private fun activeMinutes(value: String?): Long? =
    value?.takeIf { it.isNotBlank() }?.let {
        runCatching {
            Duration.between(Instant.now(), Instant.parse(it)).toMinutes()
        }.getOrNull()
    }

private enum class AlertState { COMPLETED, NEXT, UPCOMING }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveJourneyScreen(
    context: Context,
    journeyId: String,
    onBack: () -> Unit,
    onCancelled: () -> Unit
) {
    var journey by remember { mutableStateOf<Journey?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var cancelling by remember { mutableStateOf(false) }
    var showCancel by remember { mutableStateOf(false) }

    fun refresh(showSpinner: Boolean = false) {
        if (showSpinner) loading = true
        JourneyApi.getJourney(
            context = context,
            journeyId = journeyId,
            onSuccess = {
                journey = it
                loading = false
                error = null
            },
            onError = {
                loading = false
                error = it
            }
        )
    }

    LaunchedEffect(journeyId) {
        refresh(true)
    }

    LaunchedEffect(journeyId) {
        while (true) {
            delay(30_000)
            JourneyApi.getJourney(
                context = context,
                journeyId = journeyId,
                onSuccess = {
                    journey = it
                    error = null
                },
                onError = {}
            )
        }
    }

    if (showCancel) {
        AlertDialog(
            onDismissRequest = { if (!cancelling) showCancel = false },
            title = { Text("Cancel journey?") },
            text = { Text("RailWake will stop monitoring this journey and its alerts.") },
            confirmButton = {
                TextButton(
                    enabled = !cancelling,
                    onClick = {
                        cancelling = true
                        JourneyApi.cancelJourney(
                            context = context,
                            journeyId = journeyId,
                            onSuccess = {
                                cancelling = false
                                showCancel = false
                                onCancelled()
                            },
                            onError = {
                                cancelling = false
                                error = it
                                showCancel = false
                            }
                        )
                    }
                ) { Text("Cancel journey") }
            },
            dismissButton = {
                TextButton(
                    enabled = !cancelling,
                    onClick = { showCancel = false }
                ) { Text("Keep journey") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Your journey") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back") }
                }
            )
        }
    ) { padding ->
        when {
            loading && journey == null -> Box(
                Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center
            ) { CircularProgressIndicator() }

            journey == null -> Column(
                Modifier.fillMaxSize().padding(padding).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    "Unable to load journey",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(8.dp))
                Text(error ?: "Something went wrong.")
                Spacer(Modifier.height(16.dp))
                OutlinedButton(onClick = { refresh(true) }) { Text("Try again") }
            }

            else -> ActiveJourneyContent(
                journey = journey!!,
                error = error,
                onRefresh = { refresh() },
                onCancel = { showCancel = true },
                cancelling = cancelling,
                modifier = Modifier.fillMaxSize().padding(padding)
            )
        }
    }
}

@Composable
private fun ActiveJourneyContent(
    journey: Journey,
    error: String?,
    onRefresh: () -> Unit,
    onCancel: () -> Unit,
    cancelling: Boolean,
    modifier: Modifier
) {
    val destination =
        journey.destinationStationName?.takeIf { it.isNotBlank() }
            ?: journey.destinationStationCode

    val minutes = activeMinutes(journey.expectedArrival)
    val terminal =
        journey.state == "completed" || journey.state == "cancelled"
    val active = journey.state == "active"
    val offsets = journey.alertOffsetsMinutes.sortedDescending()

    LazyColumn(
        modifier = modifier.padding(horizontal = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Spacer(Modifier.height(6.dp))

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(50),
                    color = if (active) {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    }
                ) {
                    Text(
                        if (active) "●  MONITORING LIVE" else "○  UPCOMING",
                        Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold
                    )
                }

                Text(
                    "Train ${journey.trainNumber}",
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        item {
            Text(
                destination,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                journey.destinationStationCode,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        item {
            Card(
                Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(30.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        when {
                            minutes == null -> "—"
                            minutes < 0 -> "Arrived"
                            else -> "$minutes"
                        },
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )

                    Text(
                        when {
                            minutes == null -> "ETA unavailable"
                            minutes < 0 -> "Your stop has passed"
                            else -> "minutes to your stop"
                        },
                        style = MaterialTheme.typography.titleMedium
                    )

                    Spacer(Modifier.height(18.dp))
                    HorizontalDivider()
                    Spacer(Modifier.height(14.dp))

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Expected arrival", style = MaterialTheme.typography.labelMedium)
                            Text(
                                activeTime(journey.expectedArrival),
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text("Running", style = MaterialTheme.typography.labelMedium)
                            Text(
                                when {
                                    journey.delayMinutes == null -> "Monitoring"
                                    journey.delayMinutes!! > 0 -> "${journey.delayMinutes} min late"
                                    journey.delayMinutes!! < 0 -> "${-journey.delayMinutes!!} min early"
                                    else -> "On time"
                                },
                                fontWeight = FontWeight.Bold,
                                color = if ((journey.delayMinutes ?: 0) > 0)
                                    MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }
        }

        item {
            Card(
                Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor =
                        if (terminal) MaterialTheme.colorScheme.errorContainer
                        else MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(Modifier.padding(18.dp)) {
                    Text(
                        if (terminal) "Journey ended" else "✓  Trip protection active",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = if (terminal)
                            MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.primary
                    )

                    Spacer(Modifier.height(5.dp))

                    Text(
                        if (terminal) {
                            "No further live alerts are expected."
                        } else {
                            "RailWake is watching the ETA and will adjust your wake-ups if the train is delayed."
                        },
                        style = MaterialTheme.typography.bodySmall
                    )

                    if (!terminal && !journey.nextAlert.isNullOrBlank()) {
                        Spacer(Modifier.height(12.dp))
                        Surface(
                            Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(15.dp),
                            color = MaterialTheme.colorScheme.surface.copy(alpha = 0.72f)
                        ) {
                            Row(
                                Modifier.padding(13.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Next wake-up", style = MaterialTheme.typography.labelMedium)
                                    Text(
                                        activeTime(journey.nextAlert),
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Text(
                                    "ETA-aware",
                                    Modifier.align(Alignment.CenterVertically),
                                    color = MaterialTheme.colorScheme.primary,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            }
        }

        item {
            Card(Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(18.dp)) {
                    Text(
                        "Wake-up plan",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(Modifier.height(6.dp))
                    Text(
                        "We'll keep the next useful alert and adjust it when the ETA moves.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(Modifier.height(15.dp))

                    offsets.forEachIndexed { index, offset ->
                        val eta = journey.expectedArrival?.let {
                            runCatching { Instant.parse(it) }.getOrNull()
                        }
                        val alertAt = eta?.minusSeconds(offset * 60L)
                        val next = journey.nextAlert?.let {
                            runCatching { Instant.parse(it) }.getOrNull()
                        }

                        val state = when {
                            alertAt == null -> AlertState.UPCOMING
                            alertAt.isBefore(Instant.now()) -> AlertState.COMPLETED
                            next != null &&
                                kotlin.math.abs(Duration.between(next, alertAt).toMinutes()) <= 1 ->
                                AlertState.NEXT
                            else -> AlertState.UPCOMING
                        }

                        val accent = when (state) {
                            AlertState.COMPLETED -> MaterialTheme.colorScheme.primary
                            AlertState.NEXT -> MaterialTheme.colorScheme.secondary
                            AlertState.UPCOMING -> MaterialTheme.colorScheme.outline
                        }

                        Row(
                            Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                Modifier
                                    .size(11.dp)
                                    .background(accent, CircleShape)
                            )
                            Spacer(Modifier.size(12.dp))

                            Column(Modifier.weight(1f)) {
                                Text(
                                    "$offset min before your stop",
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    when (state) {
                                        AlertState.COMPLETED -> "Completed"
                                        AlertState.NEXT -> "Next wake-up"
                                        AlertState.UPCOMING -> "Waiting"
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }

                            Text(
                                when (state) {
                                    AlertState.COMPLETED -> "✓"
                                    AlertState.NEXT -> "●"
                                    AlertState.UPCOMING -> "○"
                                },
                                fontWeight = FontWeight.Bold,
                                color = accent
                            )
                        }

                        if (index < offsets.lastIndex) Spacer(Modifier.height(10.dp))
                    }
                }
            }
        }

        if (error != null) {
            item {
                Surface(
                    Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.errorContainer
                ) {
                    Text(
                        error,
                        Modifier.padding(14.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }
        }

        item {
            Button(
                onClick = onRefresh,
                Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(17.dp)
            ) {
                Text("Refresh live status")
            }
        }

        if (!terminal) {
            item {
                OutlinedButton(
                    onClick = onCancel,
                    enabled = !cancelling,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(17.dp)
                ) {
                    Text(if (cancelling) "Cancelling…" else "Cancel journey")
                }
            }
        }

        item {
            Text(
                "RailWake is designed to let you sleep without losing track of your stop.",
                Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(24.dp))
        }
    }
}
