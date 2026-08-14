package com.trainalert

import android.content.Context

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll

import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.rememberDatePickerState

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

import kotlinx.coroutines.delay

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId


private val INDIA_ZONE =
    ZoneId.of("Asia/Kolkata")

private fun displayJourneyDate(
    date: String
): String {
    return try {
        val parsed =
            LocalDate.parse(date)

        val today =
            LocalDate.now(
                INDIA_ZONE
            )

        when {
            parsed == today ->
                "Today · $date"

            parsed == today.plusDays(1) ->
                "Tomorrow · $date"

            else ->
                parsed
                    .format(
                        java.time.format.DateTimeFormatter
                            .ofPattern(
                                "dd MMM yyyy",
                                java.util.Locale(
                                    "en",
                                    "IN"
                                )
                            )
                    )
        }
    } catch (_: Exception) {
        date
    }
}


private fun friendlyCreateError(
    message: String
): String {
    val normalized =
        message.lowercase()

    return when {
        "already exists" in normalized ||
            "journey already exists" in normalized ||
            "active journey" in normalized ->
            "You already have this journey added for today."

        "already reached" in normalized ||
            "already passed" in normalized ->
            "This train has already reached or passed the selected station."

        "railway data" in normalized ||
            "inconsistent" in normalized ->
            "Live railway data is temporarily inconsistent. Please try again shortly."

        else ->
            message
    }
}


private fun exactTrainMatch(
    query: String,
    suggestions: List<TrainSuggestion>
): TrainSuggestion? {
    val normalized =
        query.trim()
            .lowercase()

    if (normalized.isBlank()) {
        return null
    }

    return suggestions.firstOrNull { train ->
        train.number
            .equals(
                normalized,
                ignoreCase = true
            ) ||
            train.name
                .equals(
                    normalized,
                    ignoreCase = true
                )
    }
}


private fun exactStationMatch(
    query: String,
    suggestions: List<StationSuggestion>
): StationSuggestion? {
    val normalized =
        query.trim()

    if (normalized.isBlank()) {
        return null
    }

    return suggestions.firstOrNull { station ->
        station.code.equals(
            normalized,
            ignoreCase = true
        ) ||
            station.name.equals(
                normalized,
                ignoreCase = true
            )
    }
}


@OptIn(
    ExperimentalMaterial3Api::class
)
@Composable
fun AddJourneyFormScreen(
    context: Context,
    onCreated: () -> Unit,
    onCancel: () -> Unit
) {
    var trainQuery by remember {
        mutableStateOf("")
    }

    var trainSuggestions by remember {
        mutableStateOf<List<TrainSuggestion>>(
            emptyList()
        )
    }

    var selectedTrain by remember {
        mutableStateOf<TrainSuggestion?>(
            null
        )
    }

    var stationQuery by remember {
        mutableStateOf("")
    }

    var stationSuggestions by remember {
        mutableStateOf<List<StationSuggestion>>(
            emptyList()
        )
    }

    var selectedStation by remember {
        mutableStateOf<StationSuggestion?>(
            null
        )
    }

    var journeyDate by remember {
        mutableStateOf("")
    }

    var showDatePicker by remember {
        mutableStateOf(false)
    }

    var trainExpanded by remember {
        mutableStateOf(false)
    }

    var stationExpanded by remember {
        mutableStateOf(false)
    }

    var trainSearching by remember {
        mutableStateOf(false)
    }

    var stationSearching by remember {
        mutableStateOf(false)
    }

    var loading by remember {
        mutableStateOf(false)
    }

    var error by remember {
        mutableStateOf<String?>(null)
    }


    /*
     * When an exact train result arrives, resolve it automatically.
     *
     * This means typing "12203" is enough once the lookup result
     * comes back; the user doesn't have to tap the dropdown item.
     */
    LaunchedEffect(
        trainQuery,
        trainSuggestions
    ) {
        if (
            selectedTrain == null
        ) {
            val exact =
                exactTrainMatch(
                    trainQuery,
                    trainSuggestions
                )

            if (
                exact != null
            ) {
                selectedTrain =
                    exact

                trainExpanded =
                    false
            }
        }
    }


    /*
     * Same behavior for station name/code.
     */
    LaunchedEffect(
        stationQuery,
        stationSuggestions
    ) {
        if (
            selectedStation == null
        ) {
            val exact =
                exactStationMatch(
                    stationQuery,
                    stationSuggestions
                )

            if (
                exact != null
            ) {
                selectedStation =
                    exact

                stationExpanded =
                    false
            }
        }
    }


    LaunchedEffect(
        trainQuery
    ) {
        if (
            selectedTrain != null &&
            trainQuery.equals(
                selectedTrain!!.number,
                ignoreCase = true
            )
        ) {
            return@LaunchedEffect
        }

        val query =
            trainQuery.trim()

        if (
            query.isBlank()
        ) {
            trainSuggestions =
                emptyList()

            trainExpanded =
                false

            return@LaunchedEffect
        }

        delay(300)

        trainSearching =
            true

        JourneyLookupApi.searchTrains(
            query = query,

            onSuccess = {
                trainSuggestions =
                    it

                trainSearching =
                    false

                trainExpanded =
                    it.isNotEmpty()
            },

            onError = {
                trainSearching =
                    false

                trainSuggestions =
                    emptyList()

                trainExpanded =
                    false

                error =
                    friendlyCreateError(
                        it
                    )
            }
        )
    }


    LaunchedEffect(
        stationQuery
    ) {
        if (
            selectedStation != null &&
            stationQuery.equals(
                selectedStation!!.code,
                ignoreCase = true
            )
        ) {
            return@LaunchedEffect
        }

        val query =
            stationQuery.trim()

        if (
            query.isBlank()
        ) {
            stationSuggestions =
                emptyList()

            stationExpanded =
                false

            return@LaunchedEffect
        }

        delay(300)

        stationSearching =
            true

        JourneyLookupApi.searchStations(
            query = query,

            onSuccess = {
                stationSuggestions =
                    it

                stationSearching =
                    false

                stationExpanded =
                    it.isNotEmpty()
            },

            onError = {
                stationSearching =
                    false

                stationSuggestions =
                    emptyList()

                stationExpanded =
                    false

                error =
                    friendlyCreateError(
                        it
                    )
            }
        )
    }


    /*
     * Material 3 DatePicker uses UTC calendar millis.
     * We intentionally compare calendar dates in UTC so the selected
     * YYYY-MM-DD stays stable while the user operates in India.
     */
    if (
        showDatePicker
    ) {
        val todayIndia =
            LocalDate.now(
                INDIA_ZONE
            )

        val todayUtcMillis =
            todayIndia
                .atStartOfDay(
                    ZoneId.of("UTC")
                )
                .toInstant()
                .toEpochMilli()

        val datePickerState =
            rememberDatePickerState(
                initialSelectedDateMillis =
                    todayUtcMillis,

                selectableDates =
                    object :
                        SelectableDates {

                        override fun
                        isSelectableDate(
                            utcTimeMillis: Long
                        ): Boolean {
                            val selected =
                                Instant
                                    .ofEpochMilli(
                                        utcTimeMillis
                                    )
                                    .atZone(
                                        ZoneId.of(
                                            "UTC"
                                        )
                                    )
                                    .toLocalDate()

                            return !selected
                                .isBefore(
                                    todayIndia
                                )
                        }
                    }
            )

        DatePickerDialog(
            onDismissRequest = {
                showDatePicker =
                    false
            },

            confirmButton = {
                TextButton(
                    onClick = {
                        val millis =
                            datePickerState
                                .selectedDateMillis

                        if (
                            millis != null
                        ) {
                            val selected =
                                Instant
                                    .ofEpochMilli(
                                        millis
                                    )
                                    .atZone(
                                        ZoneId.of(
                                            "UTC"
                                        )
                                    )
                                    .toLocalDate()

                            if (
                                selected
                                    .isBefore(
                                        todayIndia
                                    )
                            ) {
                                error =
                                    "Please select today or a future date."

                                return@TextButton
                            }

                            journeyDate =
                                selected.toString()

                            error =
                                null
                        }

                        showDatePicker =
                            false
                    }
                ) {
                    Text("OK")
                }
            },

            dismissButton = {
                TextButton(
                    onClick = {
                        showDatePicker =
                            false
                    }
                ) {
                    Text("Cancel")
                }
            }
        ) {
            DatePicker(
                state =
                    datePickerState
            )
        }
    }


    /*
     * Resolve the final values from either an explicit selection
     * or an exact lookup match.
     */
    val resolvedTrain =
        selectedTrain
            ?: exactTrainMatch(
                trainQuery,
                trainSuggestions
            )

    val resolvedStation =
        selectedStation
            ?: exactStationMatch(
                stationQuery,
                stationSuggestions
            )

    val canCreate =
        !loading &&
            resolvedTrain != null &&
            journeyDate.isNotBlank() &&
            resolvedStation != null


    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Add Journey"
                    )
                }
            )
        }
    ) { innerPadding ->

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(
                        innerPadding
                    )
                    .verticalScroll(
                        rememberScrollState()
                    )
                    .padding(20.dp),

            verticalArrangement =
                Arrangement.spacedBy(
                    16.dp
                )
        ) {

            Text(
                text =
                    "Tell us about your journey",

                style =
                    MaterialTheme
                        .typography
                        .headlineSmall,

                fontWeight =
                    FontWeight.Bold
            )


            Text(
                text =
                    "Choose your train, travel date and destination. We'll take care of the alerts."
            )


            /*
             * Train
             */
            ExposedDropdownMenuBox(
                expanded =
                    trainExpanded,

                onExpandedChange = {
                    if (
                        trainSuggestions
                            .isNotEmpty()
                    ) {
                        trainExpanded =
                            !trainExpanded
                    }
                }
            ) {

                OutlinedTextField(
                    value =
                        trainQuery,

                    onValueChange = {
                        /*
                         * Any edit invalidates the previous explicit
                         * selection. Exact lookup results can resolve
                         * it again automatically.
                         */
                        selectedTrain =
                            null

                        trainQuery =
                            it

                        error =
                            null
                    },

                    label = {
                        Text(
                            "Train"
                        )
                    },

                    placeholder = {
                        Text(
                            "Search train number or name"
                        )
                    },

                    leadingIcon = {
                        Text("🔍")
                    },

                    trailingIcon = {
                        if (
                            trainSearching
                        ) {
                            CircularProgressIndicator(
                                modifier =
                                    Modifier
                                        .height(
                                            18.dp
                                        )
                            )
                        } else {
                            ExposedDropdownMenuDefaults
                                .TrailingIcon(
                                    expanded =
                                        trainExpanded
                                )
                        }
                    },

                    singleLine =
                        true,

                    isError =
                        trainQuery.isNotBlank() &&
                            resolvedTrain == null &&
                            !trainSearching,

                    modifier =
                        Modifier
                            .menuAnchor()
                            .fillMaxWidth(),

                    supportingText = {
                        when {
                            resolvedTrain != null -> {
                                Text(
                                    "✓ ${resolvedTrain.name.ifBlank { "Train ${resolvedTrain.number}" }}"
                                )
                            }

                            trainQuery.isNotBlank() &&
                                !trainSearching -> {
                                Text(
                                    "Select a train from the suggestions."
                                )
                            }
                        }
                    }
                )


                ExposedDropdownMenu(
                    expanded =
                        trainExpanded,

                    onDismissRequest = {
                        trainExpanded =
                            false
                    }
                ) {

                    if (
                        trainSuggestions.isEmpty()
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    "No matching trains found"
                                )
                            },
                            onClick = {
                                trainExpanded =
                                    false
                            }
                        )
                    } else {
                        trainSuggestions
                            .forEachIndexed {
                                index,
                                train ->

                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(
                                                text =
                                                    train.number,

                                                fontWeight =
                                                    FontWeight.SemiBold
                                            )

                                            Text(
                                                text =
                                                    train.name
                                                        .ifBlank {
                                                            "Train ${train.number}"
                                                        },

                                                style =
                                                    MaterialTheme
                                                        .typography
                                                        .bodyMedium
                                            )
                                        }
                                    },

                                    onClick = {
                                        selectedTrain =
                                            train

                                        trainQuery =
                                            train.number

                                        trainExpanded =
                                            false

                                        error =
                                            null
                                    }
                                )

                                if (
                                    index <
                                    trainSuggestions.lastIndex
                                ) {
                                    HorizontalDivider()
                                }
                            }
                    }
                }
            }


            /*
             * Date
             */
            OutlinedButton(
                onClick = {
                    showDatePicker =
                        true
                },

                modifier =
                    Modifier.fillMaxWidth(),

                shape =
                    RoundedCornerShape(
                        14.dp
                    )
            ) {
                Text(
                    if (
                        journeyDate.isBlank()
                    ) {
                        "📅  Select journey date"
                    } else {
                        "📅  " +
                            displayJourneyDate(
                                journeyDate
                            )
                    }
                )
            }


            /*
             * Destination
             */
            ExposedDropdownMenuBox(
                expanded =
                    stationExpanded,

                onExpandedChange = {
                    if (
                        stationSuggestions
                            .isNotEmpty()
                    ) {
                        stationExpanded =
                            !stationExpanded
                    }
                }
            ) {

                OutlinedTextField(
                    value =
                        stationQuery,

                    onValueChange = {
                        selectedStation =
                            null

                        stationQuery =
                            it

                        error =
                            null
                    },

                    label = {
                        Text(
                            "Destination"
                        )
                    },

                    placeholder = {
                        Text(
                            "Search station name or code"
                        )
                    },

                    leadingIcon = {
                        Text("📍")
                    },

                    trailingIcon = {
                        if (
                            stationSearching
                        ) {
                            CircularProgressIndicator(
                                modifier =
                                    Modifier
                                        .height(
                                            18.dp
                                        )
                            )
                        } else {
                            ExposedDropdownMenuDefaults
                                .TrailingIcon(
                                    expanded =
                                        stationExpanded
                                )
                        }
                    },

                    singleLine =
                        true,

                    isError =
                        stationQuery.isNotBlank() &&
                            resolvedStation == null &&
                            !stationSearching,

                    modifier =
                        Modifier
                            .menuAnchor()
                            .fillMaxWidth(),

                    supportingText = {
                        when {
                            resolvedStation != null -> {
                                Text(
                                    "✓ ${resolvedStation.name} (${resolvedStation.code})"
                                )
                            }

                            stationQuery.isNotBlank() &&
                                !stationSearching -> {
                                Text(
                                    "Select a destination from the suggestions."
                                )
                            }
                        }
                    }
                )


                ExposedDropdownMenu(
                    expanded =
                        stationExpanded,

                    onDismissRequest = {
                        stationExpanded =
                            false
                    }
                ) {

                    if (
                        stationSuggestions.isEmpty()
                    ) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    "No matching stations found"
                                )
                            },

                            onClick = {
                                stationExpanded =
                                    false
                            }
                        )
                    } else {
                        stationSuggestions
                            .forEachIndexed {
                                index,
                                station ->

                                DropdownMenuItem(
                                    text = {
                                        Column {
                                            Text(
                                                text =
                                                    station.code,

                                                fontWeight =
                                                    FontWeight.Bold
                                            )

                                            Text(
                                                text =
                                                    station.name,

                                                style =
                                                    MaterialTheme
                                                        .typography
                                                        .bodyMedium
                                            )
                                        }
                                    },

                                    onClick = {
                                        selectedStation =
                                            station

                                        stationQuery =
                                            station.code

                                        stationExpanded =
                                            false

                                        error =
                                            null
                                    }
                                )

                                if (
                                    index <
                                    stationSuggestions.lastIndex
                                ) {
                                    HorizontalDivider()
                                }
                            }
                    }
                }
            }


            if (
                error != null
            ) {
                Text(
                    text =
                        error!!,

                    color =
                        MaterialTheme
                            .colorScheme
                            .error
                )
            }


            /*
             * Explain exactly why Create is unavailable.
             */
            if (
                !canCreate &&
                !loading &&
                error == null
            ) {
                Text(
                    text =
                        when {
                            resolvedTrain == null ->
                                "Select a train to continue."

                            journeyDate.isBlank() ->
                                "Select your journey date to continue."

                            resolvedStation == null ->
                                "Select your destination to continue."

                            else ->
                                ""
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


            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )


            Row(
                modifier =
                    Modifier.fillMaxWidth(),

                horizontalArrangement =
                    Arrangement.spacedBy(
                        12.dp
                    )
            ) {

                OutlinedButton(
                    onClick =
                        onCancel,

                    enabled =
                        !loading,

                    modifier =
                        Modifier.weight(1f)
                ) {
                    Text(
                        "Cancel"
                    )
                }


                Button(
                    onClick = {

                        val train =
                            resolvedTrain

                        val station =
                            resolvedStation

                        if (
                            train == null
                        ) {
                            error =
                                "Please select a train from the suggestions."

                            return@Button
                        }

                        if (
                            journeyDate.isBlank()
                        ) {
                            error =
                                "Please select a journey date."

                            return@Button
                        }

                        if (
                            station == null
                        ) {
                            error =
                                "Please select a destination from the suggestions."

                            return@Button
                        }

                        loading =
                            true

                        error =
                            null

                        JourneyApi.createJourney(
                            context =
                                context,

                            trainNumber =
                                train.number,

                            journeyDate =
                                journeyDate,

                            destinationStationCode =
                                station.code,

                            onSuccess = {
                                loading =
                                    false

                                onCreated()
                            },

                            onError = {
                                loading =
                                    false

                                error =
                                    friendlyCreateError(
                                        it
                                    )
                            }
                        )
                    },

                    enabled =
                        canCreate,

                    modifier =
                        Modifier.weight(1f)
                ) {
                    if (
                        loading
                    ) {
                        CircularProgressIndicator(
                            modifier =
                                Modifier.height(
                                    20.dp
                                )
                        )
                    } else {
                        Text(
                            "Create Journey"
                        )
                    }
                }
            }


            Spacer(
                modifier =
                    Modifier.height(24.dp)
            )
        }
    }
}