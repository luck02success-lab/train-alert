package com.trainalert

import android.Manifest
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
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

class MainActivity : ComponentActivity() {
    
    companion object {
    const val EXTRA_JOURNEY_ID = "journeyId"
}

    private val notificationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) {
            registerDevice()
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            TrainAlertApp(
                context = applicationContext
            )
        }

        requestNotificationPermission()
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (
                checkSelfPermission(
                    Manifest.permission.POST_NOTIFICATIONS
                ) != PackageManager.PERMISSION_GRANTED
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
        DeviceRegistrationManager.registerCurrentToken(
            applicationContext
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrainAlertApp(
    context: android.content.Context
) {
    var journeys by remember {
        mutableStateOf<List<Journey>>(emptyList())
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

    /*
     * Make sure the anonymous user exists before
     * attempting to load journeys.
     */
    LaunchedEffect(Unit) {
        DeviceRegistrationManager.ensureUser(
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

    if (showAddJourney) {
        AddJourneyScreen(
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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Train Alert")
                }
            )
        }
    ) { innerPadding ->

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),

            verticalArrangement =
                Arrangement.spacedBy(16.dp)
        ) {

            item {
                Spacer(
                    modifier = Modifier.height(8.dp)
                )

                Text(
                    text = "Never miss your train stop.",
                    style =
                        MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                Spacer(
                    modifier = Modifier.height(6.dp)
                )

                Text(
                    text =
                        "Get notified before your train reaches your destination."
                )
            }

            item {
                Button(
                    onClick = {
                        showAddJourney = true
                    },
                    modifier =
                        Modifier.fillMaxWidth()
                ) {
                    Text("Add Journey")
                }
            }

            when {

                loading -> {
                    item {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(
                                        vertical = 32.dp
                                    ),
                            contentAlignment =
                                Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                }

                error != null -> {
                    item {
                        Card(
                            modifier =
                                Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier =
                                    Modifier.padding(16.dp)
                            ) {

                                Text(
                                    text = "Something went wrong",
                                    style =
                                        MaterialTheme
                                            .typography
                                            .titleMedium
                                )

                                Spacer(
                                    modifier =
                                        Modifier.height(6.dp)
                                )

                                Text(
                                    text = error!!,
                                    color =
                                        MaterialTheme
                                            .colorScheme
                                            .error
                                )

                                Spacer(
                                    modifier =
                                        Modifier.height(12.dp)
                                )

                                OutlinedButton(
                                    onClick = {
                                        loadJourneys()
                                    }
                                ) {
                                    Text("Retry")
                                }
                            }
                        }
                    }
                }

                journeys.isEmpty() -> {
                    item {
                        EmptyJourneysCard(
                            onAddJourney = {
                                showAddJourney = true
                            }
                        )
                    }
                }

                else -> {
                    item {
                        Text(
                            text = "Your Journeys",
                            style =
                                MaterialTheme
                                    .typography
                                    .titleLarge,
                            fontWeight =
                                FontWeight.SemiBold
                        )
                    }

                    items(journeys) { journey ->
                        JourneyCard(journey)
                    }

                    item {
                        Spacer(
                            modifier = Modifier.height(20.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyJourneysCard(
    onAddJourney: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier =
                Modifier.padding(20.dp)
        ) {

            Text(
                text = "No journeys yet",
                style =
                    MaterialTheme
                        .typography
                        .titleMedium,
                fontWeight =
                    FontWeight.SemiBold
            )

            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )

            Text(
                text =
                    "Add a journey and we'll notify you before you reach your destination."
            )

            Spacer(
                modifier =
                    Modifier.height(16.dp)
            )

            Button(
                onClick = onAddJourney,
                modifier =
                    Modifier.fillMaxWidth()
            ) {
                Text("Add Your First Journey")
            }
        }
    }
}

@Composable
private fun JourneyCard(
    journey: Journey
) {
    Card(
        modifier =
            Modifier.fillMaxWidth()
    ) {
        Column(
            modifier =
                Modifier.padding(18.dp)
        ) {

            Text(
                text =
                    "Train ${journey.trainNumber}",
                style =
                    MaterialTheme
                        .typography
                        .titleMedium,
                fontWeight =
                    FontWeight.SemiBold
            )

            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )

            Text(
                text =
                    "Destination: ${journey.destinationStationCode}"
            )

            Text(
                text =
                    "Date: ${journey.journeyDate}"
            )

            Spacer(
                modifier =
                    Modifier.height(8.dp)
            )

            Text(
                text =
                    "Status: ${journey.state}"
            )

            if (journey.expectedArrival != null) {
                Text(
                    text =
                        "Expected arrival: " +
                            journey.expectedArrival
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddJourneyScreen(
    context: android.content.Context,
    onCreated: () -> Unit,
    onCancel: () -> Unit
) {
    var trainNumber by remember {
        mutableStateOf("")
    }

    var journeyDate by remember {
        mutableStateOf("")
    }

    var destination by remember {
        mutableStateOf("")
    }

    var loading by remember {
        mutableStateOf(false)
    }

    var error by remember {
        mutableStateOf<String?>(null)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("Add Journey")
                }
            )
        }
    ) { innerPadding ->

        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(
                        rememberScrollState()
                    )
                    .padding(20.dp)
        ) {

            Text(
                text = "Tell us about your journey",
                style =
                    MaterialTheme
                        .typography
                        .headlineSmall,
                fontWeight =
                    FontWeight.Bold
            )

            Spacer(
                modifier =
                    Modifier.height(6.dp)
            )

            Text(
                text =
                    "We'll use this information to alert you before you reach your destination."
            )

            Spacer(
                modifier =
                    Modifier.height(24.dp)
            )

            OutlinedTextField(
                value = trainNumber,

                onValueChange = {
                    trainNumber = it
                        .filter { character ->
                            character.isDigit()
                        }
                        .take(5)

                    error = null
                },

                label = {
                    Text("Train number")
                },

                supportingText = {
                    Text("5 digit train number")
                },

                modifier =
                    Modifier.fillMaxWidth(),

                singleLine = true
            )

            Spacer(
                modifier =
                    Modifier.height(14.dp)
            )

            OutlinedTextField(
                value = journeyDate,

                onValueChange = {
                    journeyDate = it
                    error = null
                },

                label = {
                    Text("Journey date")
                },

                placeholder = {
                    Text("YYYY-MM-DD")
                },

                supportingText = {
                    Text("Example: 2026-08-15")
                },

                modifier =
                    Modifier.fillMaxWidth(),

                singleLine = true
            )

            Spacer(
                modifier =
                    Modifier.height(14.dp)
            )

            OutlinedTextField(
                value = destination,

                onValueChange = {
                    destination = it
                        .uppercase()
                        .take(10)

                    error = null
                },

                label = {
                    Text("Destination station")
                },

                placeholder = {
                    Text("Station code")
                },

                supportingText = {
                    Text("Example: NDLS")
                },

                modifier =
                    Modifier.fillMaxWidth(),

                singleLine = true
            )

            if (error != null) {

                Spacer(
                    modifier =
                        Modifier.height(14.dp)
                )

                Text(
                    text = error!!,
                    color =
                        MaterialTheme
                            .colorScheme
                            .error
                )
            }

            Spacer(
                modifier =
                    Modifier.height(28.dp)
            )

            Row(
                modifier =
                    Modifier.fillMaxWidth(),

                horizontalArrangement =
                    Arrangement.spacedBy(12.dp)
            ) {

                OutlinedButton(
                    onClick = onCancel,

                    modifier =
                        Modifier.weight(1f),

                    enabled = !loading
                ) {
                    Text("Cancel")
                }

                Button(
                    onClick = {

                        if (
                            trainNumber.length != 5 ||
                            !trainNumber.all {
                                it.isDigit()
                            }
                        ) {
                            error =
                                "Train number must contain exactly 5 digits."
                            return@Button
                        }

                        if (
                            !Regex(
                                "^\\d{4}-\\d{2}-\\d{2}$"
                            ).matches(journeyDate)
                        ) {
                            error =
                                "Date must use YYYY-MM-DD."
                            return@Button
                        }

                        if (destination.length < 2) {
                            error =
                                "Enter a valid destination station code."
                            return@Button
                        }

                        loading = true
                        error = null

                        JourneyApi.createJourney(
                            context = context,
                            trainNumber = trainNumber,
                            journeyDate = journeyDate,
                            destinationStationCode =
                                destination.uppercase(),

                            onSuccess = {
                                loading = false
                                onCreated()
                            },

                            onError = {
                                loading = false
                                error = it
                            }
                        )
                    },

                    modifier =
                        Modifier.weight(1f),

                    enabled = !loading
                ) {

                    if (loading) {
                        CircularProgressIndicator(
                            modifier =
                                Modifier.height(20.dp)
                        )
                    } else {
                        Text("Create Journey")
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