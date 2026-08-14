package com.trainalert

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.time.Duration
import java.time.Instant


val DEFAULT_ALERT_OFFSETS_MINUTES =
    listOf(
        120,
        60,
        30,
        15
    )


fun alertOffsetLabel(
    offsetMinutes: Int
): String {
    return when (offsetMinutes) {
        120 ->
            "2 hours before"

        60 ->
            "1 hour before"

        30 ->
            "30 minutes before"

        15 ->
            "15 minutes before"

        else ->
            "$offsetMinutes minutes before"
    }
}


fun applicableAlertOffsets(
    expectedArrival: String?,
    now: Instant = Instant.now()
): List<Int> {

    if (
        expectedArrival.isNullOrBlank()
    ) {
        return emptyList()
    }

    return try {

        val eta =
            Instant.parse(
                expectedArrival
            )

        DEFAULT_ALERT_OFFSETS_MINUTES
            .filter { offset ->
                eta.minusSeconds(
                    offset * 60L
                ).isAfter(now)
            }

    } catch (_: Exception) {
        emptyList()
    }
}


@Composable
fun AlertPreferencesCard(
    expectedArrival: String?,
    selectedOffsets: List<Int>,
    saving: Boolean,
    onSave: (List<Int>) -> Unit,
    modifier: Modifier = Modifier
) {

    val availableOffsets =
        remember(
            expectedArrival
        ) {
            applicableAlertOffsets(
                expectedArrival
            )
        }

    var selected by remember(
        selectedOffsets,
        availableOffsets
    ) {
        mutableStateOf(
            selectedOffsets
                .filter {
                    availableOffsets
                        .contains(it)
                }
        )
    }

    Card(
        modifier =
            modifier.fillMaxWidth()
    ) {

        Column(
            modifier =
                Modifier.padding(
                    18.dp
                ),

            verticalArrangement =
                Arrangement.spacedBy(
                    4.dp
                )
        ) {

            Text(
                text =
                    "Alert reminders",

                style =
                    MaterialTheme
                        .typography
                        .titleMedium,

                fontWeight =
                    FontWeight.Bold
            )

            Spacer(
                modifier =
                    Modifier.height(4.dp)
            )

            Text(
                text =
                    "Choose when you'd like us to remind you.",

                style =
                    MaterialTheme
                        .typography
                        .bodyMedium,

                color =
                    MaterialTheme
                        .colorScheme
                        .onSurfaceVariant
            )

            Spacer(
                modifier =
                    Modifier.height(10.dp)
            )

            if (
                availableOffsets.isEmpty()
            ) {

                Text(
                    text =
                        "No future reminders are available for this journey.",

                    style =
                        MaterialTheme
                            .typography
                            .bodyMedium,

                    color =
                        MaterialTheme
                            .colorScheme
                            .onSurfaceVariant
                )

            } else {

                availableOffsets
                    .sortedDescending()
                    .forEach { offset ->

                        val enabled =
                            selected.contains(
                                offset
                            )

                        Row(
                            modifier =
                                Modifier.fillMaxWidth(),

                            verticalAlignment =
                                Alignment.CenterVertically,

                            horizontalArrangement =
                                Arrangement.SpaceBetween
                        ) {

                            Column(
                                modifier =
                                    Modifier.weight(1f)
                            ) {

                                Text(
                                    text =
                                        alertOffsetLabel(
                                            offset
                                        ),

                                    style =
                                        MaterialTheme
                                            .typography
                                            .bodyLarge
                                )

                                Text(
                                    text =
                                        if (enabled) {
                                            "You'll receive this reminder"
                                        } else {
                                            "Reminder turned off"
                                        },

                                    style =
                                        MaterialTheme
                                            .typography
                                            .bodySmall,

                                    color =
                                        MaterialTheme
                                            .colorScheme
                                            .onSurfaceVariant
                                )
                            }

                            Switch(
                                checked =
                                    enabled,

                                onCheckedChange = {
                                    checked ->

                                    selected =
                                        if (checked) {
                                            (
                                                selected +
                                                    offset
                                            ).distinct()
                                                .sortedDescending()
                                        } else {
                                            selected -
                                                offset
                                        }
                                },

                                enabled =
                                    !saving
                            )
                        }
                    }
            }

            Spacer(
                modifier =
                    Modifier.height(12.dp)
            )

            androidx.compose.material3.Button(
                onClick = {
                    onSave(
                        selected
                            .filter {
                                availableOffsets
                                    .contains(it)
                            }
                            .sortedDescending()
                    )
                },

                modifier =
                    Modifier.fillMaxWidth(),

                enabled =
                    !saving
            ) {

                Text(
                    text =
                        if (saving) {
                            "Saving..."
                        } else {
                            "Save alert preferences"
                        }
                )
            }
        }
    }
}