package com.trainalert

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle

import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width

import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
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
import androidx.compose.material3.rememberDatePickerState

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight

import androidx.compose.ui.unit.dp

import kotlinx.coroutines.delay

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.Locale


private val INDIA_ZONE =
    ZoneId.of("Asia/Kolkata")

private val INDIA_LOCALE =
    Locale("en", "IN")

private val JOURNEY_DATE_FORMATTER =
    DateTimeFormatter.ofPattern(
        "dd MMM yyyy",
        INDIA_LOCALE
    )

private val TIME_FORMATTER =
    DateTimeFormatter.ofPattern(
        "h:mm a",
        INDIA_LOCALE
    )

private val DATE_TIME_FORMATTER =
    DateTimeFormatter.ofPattern(
        "dd MMM, h:mm a",
        INDIA_LOCALE
    )


private fun formatJourneyDate(
    date: String
): String {

    return try {

        val journeyDate =
            LocalDate.parse(date)

        val today =
            LocalDate.now(INDIA_ZONE)

        when (journeyDate) {

            today ->
                "Today · " +
                    journeyDate.format(
                        JOURNEY_DATE_FORMATTER
                    )

            today.plusDays(1) ->
                "Tomorrow · " +
                    journeyDate.format(
                        JOURNEY_DATE_FORMATTER
                    )

            else ->
                journeyDate.format(
                    JOURNEY_DATE_FORMATTER
                )
        }

    } catch (_: DateTimeParseException) {

        date
    }
}


private fun formatIstDateTime(
    value: String
): String {

    return try {

        val instant =
            Instant.parse(value)

        val dateTime =
            instant.atZone(
                INDIA_ZONE
            )

        val today =
            LocalDate.now(INDIA_ZONE)

        when (dateTime.toLocalDate()) {

            today ->
                "Today · " +
                    dateTime.format(
                        TIME_FORMATTER
                    )

            today.plusDays(1) ->
                "Tomorrow · " +
                    dateTime.format(
                        TIME_FORMATTER
                    )

            else ->
                dateTime.format(
                    DATE_TIME_FORMATTER
                )
        }

    } catch (_: Exception) {

        value
    }
}


private fun greetingForIndia(): String {

    val hour =
        LocalTime
            .now(INDIA_ZONE)
            .hour

    return when {

        hour < 12 ->
            "Good morning"

        hour < 17 ->
            "Good afternoon"

        else ->
            "Good evening"
    }
}


class MainActivity : ComponentActivity() {

    companion object {

        const val EXTRA_JOURNEY_ID =
            "journeyId"
    }

    private var pendingJourneyId: String? =
        null

    private val notificationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) {
            registerDevice()
        }

    override fun onCreate(
        savedInstanceState: Bundle?
    ) {

        super.onCreate(savedInstanceState)

        pendingJourneyId =
            intent.getStringExtra(
                EXTRA_JOURNEY_ID
            )

        setContent {

            TrainAlertApp(
                context =
                    applicationContext,

                initialJourneyId =
                    pendingJourneyId,

                onInitialJourneyHandled = {
                    pendingJourneyId = null
                }
            )
        }

        requestNotificationPermission()
    }


    override fun onNewIntent(
        intent: Intent
    ) {

        super.onNewIntent(intent)

        setIntent(intent)

        val journeyId =
            intent.getStringExtra(
                EXTRA_JOURNEY_ID
            )

        if (!journeyId.isNullOrBlank()) {

            pendingJourneyId =
                journeyId

            setContent {

                TrainAlertApp(
                    context =
                        applicationContext,

                    initialJourneyId =
                        journeyId,

                    onInitialJourneyHandled = {
                        pendingJourneyId = null
                    }
                )
            }
        }
    }


    private fun requestNotificationPermission() {

        if (
            Build.VERSION.SDK_INT >=
            Build.VERSION_CODES.TIRAMISU
        ) {

            if (
                checkSelfPermission(
                    Manifest.permission.POST_NOTIFICATIONS
                ) !=
                PackageManager.PERMISSION_GRANTED
            ) {

                notificationPermissionLauncher.launch(
                    Manifest.permission.POST_NOTIFICATIONS
                )

                return
            }
        }

        registerDevice()
    }


    private fun registerDevice() {

        DeviceRegistrationManager
            .registerCurrentToken(
                applicationContext
            )
    }
}


@Composable
fun TrainAlertApp(
    context: android.content.Context,
    initialJourneyId: String? = null,
    onInitialJourneyHandled: () -> Unit = {}
) {

    var journeys by remember {
        mutableStateOf<List<Journey>>(
            emptyList()
        )
    }

    var loading by remember {
        mutableStateOf(true)
    }

    var error by remember {
        mutableStateOf<String?>(null)
    }

    var showAddJourney by remember {
        mutableStateOf(false)
    }

    var selectedJourneyId by remember {
        mutableStateOf(
            initialJourneyId
        )
    }


    fun loadJourneys() {

        loading = true
        error = null

        JourneyApi.listJourneys(
            context = context,

            onSuccess = {
                journeys = it
                loading = false
            },

            onError = {
                error = it
                loading = false
            }
        )
    }


    LaunchedEffect(Unit) {

        DeviceRegistrationManager
            .ensureUser(
                context = context,

                onSuccess = {
                    loadJourneys()
                },

                onError = {
                    error = it
                    loading = false
                }
            )
    }


    LaunchedEffect(
        initialJourneyId
    ) {

        if (
            !initialJourneyId
                .isNullOrBlank()
        ) {

            selectedJourneyId =
                initialJourneyId

            onInitialJourneyHandled()
        }
    }


    if (showAddJourney) {

        AddJourneyFormScreen(
            context = context,

            onCreated = {
                showAddJourney = false
                loadJourneys()
            },

            onCancel = {
                showAddJourney = false
            }
        )

        return
    }


    if (
        !selectedJourneyId
            .isNullOrBlank()
    ) {

        JourneyDetailScreen(
            context = context,

            journeyId =
                selectedJourneyId!!,

            onBack = {
                selectedJourneyId = null
            },

            onCancelled = {
                selectedJourneyId = null
                loadJourneys()
            }
        )

        return
    }


    Scaffold(
        containerColor =
            MaterialTheme
                .colorScheme
                .background
    ) { innerPadding ->

        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(
                        horizontal = 20.dp
                    ),

            verticalArrangement =
                Arrangement.spacedBy(
                    18.dp
                )
        ) {

            item {

                Spacer(
                    modifier =
                        Modifier.height(8.dp)
                )

                HomeHeader(
                    journeyCount =
                        journeys.size
                )
            }


            item {

                Button(
                    onClick = {
                        showAddJourney = true
                    },

                    modifier =
                        Modifier.fillMaxWidth(),

                    shape =
                        RoundedCornerShape(
                            16.dp
                        )
                ) {

                    Text(
                        text =
                            "Add Journey",

                        style =
                            MaterialTheme
                                .typography
                                .titleMedium
                    )
                }
            }


            when {

                loading -> {

                    item {
                        HomeLoadingCard()
                    }
                }


                error != null -> {

                    item {

                        HomeErrorCard(
                            message =
                                error!!,

                            onRetry = {
                                loadJourneys()
                            }
                        )
                    }
                }


                journeys.isEmpty() -> {

                    item {

                        EmptyHomeCard()
                    }
                }


                else -> {

                    item {

                        Text(
                            text =
                                "Upcoming journey",

                            style =
                                MaterialTheme
                                    .typography
                                    .titleLarge,

                            fontWeight =
                                FontWeight.Bold
                        )
                    }


                    item {

                        journeys
                            .firstOrNull()
                            ?.let { journey ->

                                UpcomingJourneyCard(
                                    journey =
                                        journey,

                                    onClick = {
                                        selectedJourneyId =
                                            journey.id
                                    }
                                )
                            }
                    }


                    if (
                        journeys.size > 1
                    ) {

                        item {

                            Text(
                                text =
                                    "Your Journeys",

                                style =
                                    MaterialTheme
                                        .typography
                                        .titleLarge,

                                fontWeight =
                                    FontWeight.Bold
                            )
                        }


                        items(
                            journeys.drop(1),

                            key = {
                                it.id
                            }
                        ) { journey ->

                            JourneyCard(
                                journey =
                                    journey,

                                onClick = {
                                    selectedJourneyId =
                                        journey.id
                                }
                            )
                        }
                    }
                }
            }


            item {

                Spacer(
                    modifier =
                        Modifier.height(24.dp)
                )

                Text(
                    text =
                        "We'll notify you before your train reaches your destination.",

                    style =
                        MaterialTheme
                            .typography
                            .bodySmall,

                    color =
                        MaterialTheme
                            .colorScheme
                            .onSurfaceVariant,

                    modifier =
                        Modifier.fillMaxWidth()
                )

                Spacer(
                    modifier =
                        Modifier.height(12.dp)
                )
            }
        }
    }
}


@Composable
private fun HomeHeader(
    journeyCount: Int
) {

    val greeting =
        greetingForIndia()

    Column {

        Text(
            text =
                "Train Alert",

            style =
                MaterialTheme
                    .typography
                    .headlineSmall,

            fontWeight =
                FontWeight.SemiBold
        )


        Spacer(
            modifier =
                Modifier.height(24.dp)
        )


        Text(
            text =
                "$greeting 👋",

            style =
                MaterialTheme
                    .typography
                    .bodyLarge,

            color =
                MaterialTheme
                    .colorScheme
                    .primary
        )


        Spacer(
            modifier =
                Modifier.height(6.dp)
        )


        Text(
            text =
                if (journeyCount == 0) {
                    "Your journey,\nwithout the worry."
                } else {
                    "Ready for your next journey?"
                },

            style =
                MaterialTheme
                    .typography
                    .headlineMedium,

            fontWeight =
                FontWeight.Bold
        )


        Spacer(
            modifier =
                Modifier.height(8.dp)
        )


        Text(
            text =
                if (journeyCount == 0) {
                    "Add your train once. We'll remind you before you reach your destination."
                } else {
                    "We'll keep an eye on your journey and let you know when it's time to get ready."
                },

            style =
                MaterialTheme
                    .typography
                    .bodyLarge
        )
    }
}


@Composable
private fun EmptyHomeCard() {

    Card(
        modifier =
            Modifier.fillMaxWidth(),

        shape =
            RoundedCornerShape(
                20.dp
            )
    ) {

        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(22.dp)
        ) {

            Text(
                text =
                    "Your first journey",

                style =
                    MaterialTheme
                        .typography
                        .titleLarge,

                fontWeight =
                    FontWeight.Bold
            )


            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )


            Text(
                text =
                    "Choose your train, travel date and destination. We'll handle the alerts automatically."
            )


            Spacer(
                modifier =
                    Modifier.height(18.dp)
            )


            Row(
                verticalAlignment =
                    Alignment.CenterVertically
            ) {

                Text(
                    text =
                        "🚆",

                    style =
                        MaterialTheme
                            .typography
                            .headlineMedium
                )


                Spacer(
                    modifier =
                        Modifier.width(10.dp)
                )


                Column {

                    Text(
                        text =
                            "Add your journey"
                    )

                    Text(
                        text =
                            "We'll take it from there.",

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
            }
        }
    }
}


@Composable
private fun HomeLoadingCard() {

    Card(
        modifier =
            Modifier.fillMaxWidth(),

        shape =
            RoundedCornerShape(
                20.dp
            )
    ) {

        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(40.dp),

            contentAlignment =
                Alignment.Center
        ) {

            CircularProgressIndicator()
        }
    }
}


@Composable
private fun HomeErrorCard(
    message: String,
    onRetry: () -> Unit
) {

    Card(
        modifier =
            Modifier.fillMaxWidth(),

        shape =
            RoundedCornerShape(
                20.dp
            )
    ) {

        Column(
            modifier =
                Modifier.padding(20.dp)
        ) {

            Text(
                text =
                    "We couldn't load your journeys",

                style =
                    MaterialTheme
                        .typography
                        .titleMedium,

                fontWeight =
                    FontWeight.Bold
            )


            Spacer(
                modifier =
                    Modifier.height(6.dp)
            )


            Text(
                text =
                    message,

                color =
                    MaterialTheme
                        .colorScheme
                        .error
            )


            Spacer(
                modifier =
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


@Composable
private fun UpcomingJourneyCard(
    journey: Journey,
    onClick: () -> Unit
) {
    Card(
        modifier =
            Modifier.fillMaxWidth(),

        onClick = onClick,

        shape =
            RoundedCornerShape(
                20.dp
            )
    ) {
        Column(
            modifier =
                Modifier.padding(20.dp)
        ) {

            Row(
                modifier =
                    Modifier.fillMaxWidth(),

                horizontalArrangement =
                    Arrangement.SpaceBetween,

                verticalAlignment =
                    Alignment.CenterVertically
            ) {

                Text(
                    text = "UPCOMING",

                    style =
                        MaterialTheme
                            .typography
                            .labelMedium,

                    color =
                        MaterialTheme
                            .colorScheme
                            .primary,

                    fontWeight =
                        FontWeight.Bold
                )

                Text(
                    text =
                        when (journey.state) {
                            "scheduled" ->
                                "Not started"

                            "active" ->
                                "Running"

                            "completed" ->
                                "Completed"

                            "cancelled" ->
                                "Cancelled"

                            else ->
                                journey.state
                                    .replaceFirstChar {
                                        it.uppercase()
                                    }
                        },

                    style =
                        MaterialTheme
                            .typography
                            .labelLarge,

                    color =
                        MaterialTheme
                            .colorScheme
                            .primary
                )
            }

            Spacer(
                modifier =
                    Modifier.height(12.dp)
            )

            Text(
                text =
                    "Train ${journey.trainNumber}",

                style =
                    MaterialTheme
                        .typography
                        .headlineSmall,

                fontWeight =
                    FontWeight.Bold
            )

            Spacer(
                modifier =
                    Modifier.height(4.dp)
            )

            Text(
                text =
                    journey.destinationStationName
                        ?.takeIf {
                            it.isNotBlank()
                        }
                        ?.let {
                            "${journey.destinationStationCode} · $it"
                        }
                        ?: journey.destinationStationCode,

                style =
                    MaterialTheme
                        .typography
                        .titleMedium
            )

            Spacer(
                modifier =
                    Modifier.height(18.dp)
            )

            Text(
                text =
                    formatJourneyDate(
                        journey.journeyDate
                    ),

                style =
                    MaterialTheme
                        .typography
                        .bodyLarge,

                fontWeight =
                    FontWeight.SemiBold
            )

            journey.expectedArrival
                ?.takeIf {
                    it.isNotBlank()
                }
                ?.let { arrival ->

                    Spacer(
                        modifier =
                            Modifier.height(6.dp)
                    )

                    Text(
                        text =
                            "Expected arrival",

                        style =
                            MaterialTheme
                                .typography
                                .labelMedium,

                        color =
                            MaterialTheme
                                .colorScheme
                                .onSurfaceVariant
                    )

                    Text(
                        text =
                            formatIstDateTime(
                                arrival
                            ),

                        style =
                            MaterialTheme
                                .typography
                                .titleLarge,

                        fontWeight =
                            FontWeight.Bold
                    )
                }

            Spacer(
                modifier =
                    Modifier.height(10.dp)
            )

            when (journey.state) {

                "scheduled" -> {

                    Text(
                        text =
                            "Train hasn't started yet",

                        style =
                            MaterialTheme
                                .typography
                                .bodyMedium,

                        color =
                            MaterialTheme
                                .colorScheme
                                .onSurfaceVariant,

                        fontWeight =
                            FontWeight.SemiBold
                    )
                }

                "active" -> {

                    val delay =
                        journey.delayMinutes

                    Text(
                        text =
                            when {
                                delay == null ->
                                    "Train is running"

                                delay > 0 ->
                                    "Running $delay mins late"

                                delay < 0 ->
                                    "Running ${-delay} mins early"

                                else ->
                                    "Running on time"
                            },

                        style =
                            MaterialTheme
                                .typography
                                .bodyMedium,

                        color =
                            when {
                                delay != null &&
                                    delay > 0 ->
                                    MaterialTheme
                                        .colorScheme
                                        .error

                                else ->
                                    MaterialTheme
                                        .colorScheme
                                        .primary
                            },

                        fontWeight =
                            FontWeight.SemiBold
                    )
                }

                else -> Unit
            }

            journey.nextAlert
                ?.takeIf {
                    it.isNotBlank()
                }
                ?.let { alert ->

                    if (
                        journey.state ==
                            "scheduled"
                    ) {

                        Spacer(
                            modifier =
                                Modifier.height(
                                    16.dp
                                )
                        )

                        Card(
                            modifier =
                                Modifier.fillMaxWidth(),

                            shape =
                                RoundedCornerShape(
                                    14.dp
                                )
                        ) {

                            Row(
                                modifier =
                                    Modifier.padding(
                                        14.dp
                                    ),

                                verticalAlignment =
                                    Alignment.CenterVertically
                            ) {

                                Text(
                                    text = "🔔",

                                    style =
                                        MaterialTheme
                                            .typography
                                            .titleLarge
                                )

                                Spacer(
                                    modifier =
                                        Modifier.width(
                                            10.dp
                                        )
                                )

                                Column {

                                    Text(
                                        text =
                                            "Next alert",

                                        style =
                                            MaterialTheme
                                                .typography
                                                .labelMedium
                                    )

                                    Text(
                                        text =
                                            formatIstDateTime(
                                                alert
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
                }

            Spacer(
                modifier =
                    Modifier.height(14.dp)
            )

            Text(
                text =
                    "View journey →",

                style =
                    MaterialTheme
                        .typography
                        .labelLarge,

                color =
                    MaterialTheme
                        .colorScheme
                        .primary,

                fontWeight =
                    FontWeight.SemiBold
            )
        }
    }
}


@Composable
private fun JourneyCard(
    journey: Journey,
    onClick: () -> Unit
) {

    Card(
        modifier =
            Modifier.fillMaxWidth(),

        onClick = onClick,

        shape =
            RoundedCornerShape(
                18.dp
            )
    ) {

        Column(
            modifier =
                Modifier.padding(18.dp)
        ) {

            Row(
                modifier =
                    Modifier.fillMaxWidth(),

                horizontalArrangement =
                    Arrangement.SpaceBetween,

                verticalAlignment =
                    Alignment.CenterVertically
            ) {

                Text(
                    text =
                        "Train ${journey.trainNumber}",

                    style =
                        MaterialTheme
                            .typography
                            .titleLarge,

                    fontWeight =
                        FontWeight.Bold
                )


                Text(
                    text =
                        journey.state
                            .replaceFirstChar {
                                it.uppercase()
                            },

                    style =
                        MaterialTheme
                            .typography
                            .labelLarge,

                    color =
                        MaterialTheme
                            .colorScheme
                            .primary
                )
            }


            Spacer(
                modifier =
                    Modifier.height(10.dp)
            )


            Text(
                text =
                    journey.destinationStationName
                        ?.takeIf {
                            it.isNotBlank()
                        }
                        ?.let {
                            "${journey.destinationStationCode} · $it"
                        }
                        ?: journey.destinationStationCode,

                style =
                    MaterialTheme
                        .typography
                        .titleMedium
            )


            Spacer(
                modifier =
                    Modifier.height(10.dp)
            )


            Text(
                text =
                    formatJourneyDate(
                        journey.journeyDate
                    ),

                style =
                    MaterialTheme
                        .typography
                        .bodyLarge,

                fontWeight =
                    FontWeight.SemiBold
            )


            journey.expectedArrival
                ?.takeIf {
                    it.isNotBlank()
                }
                ?.let {

                    Spacer(
                        modifier =
                            Modifier.height(8.dp)
                    )

                    Text(
                        text =
                            "Expected arrival",

                        style =
                            MaterialTheme
                                .typography
                                .labelMedium
                    )

                    Text(
                        text =
                            formatIstDateTime(it),

                        style =
                            MaterialTheme
                                .typography
                                .bodyLarge,

                        fontWeight =
                            FontWeight.SemiBold
                    )
                }


            journey.delayMinutes
                ?.let {

                    Spacer(
                        modifier =
                            Modifier.height(6.dp)
                    )

                    Text(
                        text =
                            when {
                                it > 0 ->
                                    "Running $it min late"

                                it < 0 ->
                                    "Running ${-it} min early"

                                else ->
                                    "Running on time"
                            },

                        style =
                            MaterialTheme
                                .typography
                                .bodyMedium,

                        color =
                            when {
                                it > 0 ->
                                    MaterialTheme
                                        .colorScheme
                                        .error

                                else ->
                                    MaterialTheme
                                        .colorScheme
                                        .primary
                            }
                    )
                }


            if (
                journey.nextAlert != null &&
                journey.state == "scheduled"
            ) {

                Spacer(
                    modifier =
                        Modifier.height(12.dp)
                )

                Card(
                    modifier =
                        Modifier.fillMaxWidth(),

                    shape =
                        RoundedCornerShape(
                            14.dp
                        )
                ) {

                    Column(
                        modifier =
                            Modifier.padding(
                                12.dp
                            )
                    ) {

                        Text(
                            text =
                                "🔔 Next alert",

                            style =
                                MaterialTheme
                                    .typography
                                    .labelLarge
                        )


                        Text(
                            text =
                                formatIstDateTime(
                                    journey.nextAlert
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


            Spacer(
                modifier =
                    Modifier.height(12.dp)
            )


            Text(
                text =
                    "Tap for details",

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
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun JourneyDetailScreen(
    context: android.content.Context,
    journeyId: String,
    onBack: () -> Unit,
    onCancelled: () -> Unit
) {

    var journey by remember {
        mutableStateOf<Journey?>(null)
    }

    var loading by remember {
        mutableStateOf(true)
    }

    var cancelling by remember {
        mutableStateOf(false)
    }

    var error by remember {
        mutableStateOf<String?>(null)
    }

    var showCancelConfirmation by remember {
        mutableStateOf(false)
    }

    var savingAlertPreferences by remember {
    mutableStateOf(false)
}

var alertPreferenceError by remember {
    mutableStateOf<String?>(null)
}


    fun loadJourney() {

        loading = true
        error = null

        JourneyApi.getJourney(
            context =
                context,

            journeyId =
                journeyId,

            onSuccess = {
                journey = it
                loading = false
            },

            onError = {
                error = it
                loading = false
            }
        )
    }


    LaunchedEffect(
        journeyId
    ) {
        loadJourney()
    }


    if (
        showCancelConfirmation
    ) {

        AlertDialog(

            onDismissRequest = {

                if (!cancelling) {
                    showCancelConfirmation =
                        false
                }
            },

            title = {
                Text(
                    "Cancel journey?"
                )
            },

            text = {

                Text(
                    "You will no longer receive alerts for this journey."
                )
            },

            confirmButton = {

                TextButton(

                    enabled =
                        !cancelling,

                    onClick = {

                        cancelling = true
                        error = null

                        JourneyApi.cancelJourney(

                            context =
                                context,

                            journeyId =
                                journeyId,

                            onSuccess = {

                                cancelling =
                                    false

                                showCancelConfirmation =
                                    false

                                onCancelled()
                            },

                            onError = {

                                cancelling =
                                    false

                                error =
                                    it

                                showCancelConfirmation =
                                    false
                            }
                        )
                    }
                ) {

                    Text(
                        "Cancel Journey"
                    )
                }
            },

            dismissButton = {

                TextButton(

                    enabled =
                        !cancelling,

                    onClick = {

                        showCancelConfirmation =
                            false
                    }
                ) {

                    Text(
                        "Keep Journey"
                    )
                }
            }
        )
    }


    Scaffold(

        topBar = {

            TopAppBar(

                title = {
                    Text(
                        "Journey Details"
                    )
                },

                navigationIcon = {

                    TextButton(
                        onClick = onBack
                    ) {

                        Text(
                            "Back"
                        )
                    }
                }
            )
        }

    ) { innerPadding ->

        when {

            loading -> {

                Box(

                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(
                                innerPadding
                            ),

                    contentAlignment =
                        Alignment.Center

                ) {

                    CircularProgressIndicator()
                }
            }


            error != null &&
                journey == null -> {

                Column(

                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(
                                innerPadding
                            )
                            .padding(20.dp),

                    horizontalAlignment =
                        Alignment.CenterHorizontally
                ) {

                    Text(
                        text =
                            "Unable to load journey",

                        style =
                            MaterialTheme
                                .typography
                                .titleLarge
                    )


                    Spacer(
                        modifier =
                            Modifier.height(8.dp)
                    )


                    Text(
                        text =
                            error!!,

                        color =
                            MaterialTheme
                                .colorScheme
                                .error
                    )


                    Spacer(
                        modifier =
                            Modifier.height(16.dp)
                    )


                    OutlinedButton(
                        onClick =
                            ::loadJourney
                    ) {

                        Text(
                            "Try again"
                        )
                    }
                }
            }


            journey != null -> {

                JourneyDetailsContent(
    journey = journey!!,
    error = error,
    cancelling = cancelling,
    savingAlertPreferences = savingAlertPreferences,
    alertPreferenceError = alertPreferenceError,
    onSaveAlertPreferences = { offsets ->

        savingAlertPreferences = true
        alertPreferenceError = null

        JourneyApi.updateAlertPreferences(
            context = context,
            journeyId = journeyId,
            alertOffsetsMinutes = offsets,

            onSuccess = { updatedJourney ->

                journey = updatedJourney
                savingAlertPreferences = false
            },

            onError = { message ->

                alertPreferenceError = message
                savingAlertPreferences = false
            }
        )
    },

                    onCancel = {

                        showCancelConfirmation =
                            true
                    },

                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(
                                innerPadding
                            )
                            .padding(20.dp)
                )
            }
        }
    }
}


@Composable
private fun JourneyDetailsContent(
    journey: Journey,
    error: String?,
    cancelling: Boolean,
    savingAlertPreferences: Boolean,
    alertPreferenceError: String?,
    onSaveAlertPreferences: (List<Int>) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier
) {

    Column(
        modifier =
            modifier.verticalScroll(
                rememberScrollState()
            )
    ) {

        Text(
            text =
                "Train ${journey.trainNumber}",

            style =
                MaterialTheme
                    .typography
                    .headlineMedium,

            fontWeight =
                FontWeight.Bold
        )


        Spacer(
            modifier =
                Modifier.height(8.dp)
        )


        Text(
            text =
                journey.destinationStationName
                    ?.takeIf {
                        it.isNotBlank()
                    }
                    ?.let {
                        "${journey.destinationStationCode} · $it"
                    }
                    ?: journey.destinationStationCode,

            style =
                MaterialTheme
                    .typography
                    .titleLarge
        )


        Spacer(
            modifier =
                Modifier.height(24.dp)
        )


        DetailRow(
            label =
                "Status",

            value =
                journey.state
                    .replaceFirstChar {
                        it.uppercase()
                    }
        )


        DetailRow(
            label =
                "Journey date",

            value =
                formatJourneyDate(
                    journey.journeyDate
                )
        )


        DetailRow(
            label =
                "Destination",

            value =
                journey.destinationStationCode
        )


        journey.destinationStationName
            ?.takeIf {
                it.isNotBlank()
            }
            ?.let {

                DetailRow(
                    label =
                        "Station",

                    value =
                        it
                )
            }


        journey.expectedArrival
            ?.takeIf {
                it.isNotBlank()
            }
            ?.let {

                DetailRow(
                    label =
                        "Expected arrival",

                    value =
                        formatIstDateTime(it)
                )
            }


        journey.delayMinutes
            ?.let {

                DetailRow(
                    label =
                        "Delay",

                    value =
                        when {
                            it > 0 ->
                                "$it min late"

                            it < 0 ->
                                "${-it} min early"

                            else ->
                                "On time"
                        }
                )
            }


        journey.nextAlert
            ?.takeIf {
                it.isNotBlank()
            }
            ?.let {

                DetailRow(
                    label =
                        "Next alert",

                    value =
                        formatIstDateTime(it)
                )
                Spacer(
    modifier =
        Modifier.height(16.dp)
)

AlertPreferencesCard(
    expectedArrival =
        journey.expectedArrival,

    selectedOffsets =
        journey.alertOffsetsMinutes,

    saving =
        savingAlertPreferences,

    onSave =
        onSaveAlertPreferences,

    modifier =
        Modifier.fillMaxWidth()
)

alertPreferenceError
    ?.takeIf {
        it.isNotBlank()
    }
    ?.let {
        Spacer(
            modifier =
                Modifier.height(8.dp)
        )

        Text(
            text = it,
            color =
                MaterialTheme
                    .colorScheme
                    .error
        )
    }
            }


        if (
            error != null
        ) {

            Spacer(
                modifier =
                    Modifier.height(16.dp)
            )

            Text(
                text =
                    error,

                color =
                    MaterialTheme
                        .colorScheme
                        .error
            )
        }


        Spacer(
            modifier =
                Modifier.height(32.dp)
        )


        if (
            journey.state == "scheduled"
        ) {

            OutlinedButton(

                onClick =
                    onCancel,

                enabled =
                    !cancelling,

                modifier =
                    Modifier.fillMaxWidth()
            ) {

                if (cancelling) {

                    CircularProgressIndicator(

                        modifier =
                            Modifier.height(
                                20.dp
                            )
                    )

                } else {

                    Text(
                        "Cancel Journey"
                    )
                }
            }
        }
    }
}


@Composable
private fun DetailRow(
    label: String,
    value: String
) {

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(
                    vertical = 8.dp
                )
    ) {

        Text(
            text =
                label,

            style =
                MaterialTheme
                    .typography
                    .labelLarge
        )


        Spacer(
            modifier =
                Modifier.height(2.dp)
        )


        Text(
            text =
                value,

            style =
                MaterialTheme
                    .typography
                    .bodyLarge
        )
    }
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddJourneyScreen(
    context: android.content.Context,
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


    LaunchedEffect(
        trainQuery
    ) {

        if (
            selectedTrain != null
        ) {
            return@LaunchedEffect
        }

        val query =
            trainQuery.trim()

        if (
            query.isEmpty()
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

            query =
                query,

            onSuccess = {

                trainSuggestions =
                    it

                trainSearching =
                    false

                trainExpanded =
                    true
            },

            onError = {

                trainSearching =
                    false

                trainSuggestions =
                    emptyList()

                error =
                    it
            }
        )
    }


    LaunchedEffect(
        stationQuery
    ) {

        if (
            selectedStation != null
        ) {
            return@LaunchedEffect
        }

        val query =
            stationQuery.trim()

        if (
            query.isEmpty()
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

            query =
                query,

            onSuccess = {

                stationSuggestions =
                    it

                stationSearching =
                    false

                stationExpanded =
                    true
            },

            onError = {

                stationSearching =
                    false

                stationSuggestions =
                    emptyList()

                error =
                    it
            }
        )
    }


    if (showDatePicker) {

    val indiaZone =
        ZoneId.of("Asia/Kolkata")

    val todayIndia =
        remember {
            LocalDate.now(
                indiaZone
            )
        }

    /*
     * Material 3 DatePicker represents selected
     * calendar dates using UTC-based millis.
     *
     * Therefore we compare calendar dates, not
     * local timezone millis.
     */
    val todayUtcMillis =
        remember(todayIndia) {
            todayIndia
                .atStartOfDay(
                    ZoneId.of("UTC")
                )
                .toInstant()
                .toEpochMilli()
        }

    val datePickerState =
        rememberDatePickerState(
            initialSelectedDateMillis =
                todayUtcMillis,

            selectableDates =
                object :
                    androidx.compose.material3
                        .SelectableDates {

                    override fun
                    isSelectableDate(
                        utcTimeMillis: Long
                    ): Boolean {

                        val selectedDate =
                            Instant
                                .ofEpochMilli(
                                    utcTimeMillis
                                )
                                .atZone(
                                    ZoneId.of("UTC")
                                )
                                .toLocalDate()

                        /*
                         * Allow:
                         *
                         * today       ✅
                         * tomorrow    ✅
                         * future      ✅
                         *
                         * yesterday   ❌
                         * older       ❌
                         */
                        return !selectedDate
                            .isBefore(todayIndia)
                    }
                }
        )

    DatePickerDialog(
        onDismissRequest = {
            showDatePicker = false
        },

        confirmButton = {
            TextButton(
                onClick = {

                    val selectedMillis =
                        datePickerState
                            .selectedDateMillis

                    if (
                        selectedMillis != null
                    ) {

                        val selectedDate =
                            Instant
                                .ofEpochMilli(
                                    selectedMillis
                                )
                                .atZone(
                                    ZoneId.of("UTC")
                                )
                                .toLocalDate()

                        /*
                         * Defensive validation.
                         */
                        if (
                            selectedDate
                                .isBefore(todayIndia)
                        ) {

                            error =
                                "Please select today or a future date."

                            return@TextButton
                        }

                        journeyDate =
                            selectedDate.toString()

                        error = null
                    }

                    showDatePicker = false
                }
            ) {
                Text("OK")
            }
        },

        dismissButton = {
            TextButton(
                onClick = {
                    showDatePicker = false
                }
            ) {
                Text("Cancel")
            }
        }
    ) {
        DatePicker(
            state = datePickerState
        )
    }
}


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
                    "Choose your train, travel date and destination. We'll take care of the rest."
            )


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
                        if (
                            selectedTrain != null
                        ) {
                            selectedTrain!!.number
                        } else {
                            trainQuery
                        },

                    onValueChange = {

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
                            "Search number or train name"
                        )
                    },

                    leadingIcon = {

                        Text(
                            "🔍"
                        )
                    },

                    trailingIcon = {

                        if (
                            trainSearching
                        ) {

                            CircularProgressIndicator(
                                modifier =
                                    Modifier.height(
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

                    modifier =
                        Modifier
                            .menuAnchor()
                            .fillMaxWidth()
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

                            onClick = {}
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
                                                    FontWeight
                                                        .SemiBold
                                            )

                                            Text(
                                                text =
                                                    train.name,

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
                            formatJourneyDate(
                                journeyDate
                            )
                    }
                )
            }


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
                        if (
                            selectedStation != null
                        ) {
                            selectedStation!!.code
                        } else {
                            stationQuery
                        },

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

                        Text(
                            "📍"
                        )
                    },

                    trailingIcon = {

                        if (
                            stationSearching
                        ) {

                            CircularProgressIndicator(
                                modifier =
                                    Modifier.height(
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

                    modifier =
                        Modifier
                            .menuAnchor()
                            .fillMaxWidth()
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

                            onClick = {}
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
                            selectedTrain

                        val station =
                            selectedStation

                        if (
                            train == null
                        ) {

                            error =
                                "Please select a train."

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
                                "Please select a destination."

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
                                    it
                            }
                        )
                    },

                    enabled =
                        !loading &&
                        selectedTrain != null &&
                        journeyDate.isNotBlank() &&
                        selectedStation != null,

                    modifier =
                        Modifier.weight(1f)
                ) {

                    if (loading) {

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


/*
 * Uses UTC because Material 3 DatePicker returns
 * the selected calendar date represented at UTC midnight.
 * This keeps the YYYY-MM-DD value stable for the backend.
 */
private class SimpleDateFormatter {

    private val formatter =
        java.text.SimpleDateFormat(
            "yyyy-MM-dd",
            Locale.US
        ).apply {

            timeZone =
                java.util.TimeZone
                    .getTimeZone(
                        "UTC"
                    )
        }

    fun format(
        millis: Long
    ): String {

        return formatter.format(
            java.util.Date(millis)
        )
    }
}