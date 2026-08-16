package com.trainalert

import android.Manifest
import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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

private enum class ProtectionStatus {
    OK,
    NEEDS_ATTENTION
}

private data class ProtectionItem(
    val title: String,
    val description: String,
    val status: ProtectionStatus,
    val actionLabel: String? = null,
    val action: (() -> Unit)? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProtectionCenterScreen(
    context: Context,
    onBack: () -> Unit
) {
    var refreshToken by remember {
        mutableStateOf(0)
    }

    fun refresh() {
        refreshToken++
    }

    val notificationEnabled =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            androidx.core.content.ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    val fullScreenEnabled =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            androidx.core.app.NotificationManagerCompat
                .from(context)
                .canUseFullScreenIntent()
        } else {
            true
        }

    val exactAlarmEnabled =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(
                AlarmManager::class.java
            )?.canScheduleExactAlarms() == true
        } else {
            true
        }

    val powerManager =
        context.getSystemService(
            PowerManager::class.java
        )

    val batteryOptimizationExempt =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager?.isIgnoringBatteryOptimizations(
                context.packageName
            ) == true
        } else {
            true
        }

    val items =
        listOf(
            ProtectionItem(
                title = "Notifications",
                description =
                    if (notificationEnabled) {
                        "RailWake can show journey alerts."
                    } else {
                        "Notifications are disabled."
                    },
                status =
                    if (notificationEnabled) {
                        ProtectionStatus.OK
                    } else {
                        ProtectionStatus.NEEDS_ATTENTION
                    },
                actionLabel =
                    if (!notificationEnabled) {
                        "Enable"
                    } else {
                        null
                    },
                action =
                    if (!notificationEnabled) {
                        {
                            openAppNotificationSettings(
                                context
                            )
                        }
                    } else {
                        null
                    }
            ),
            ProtectionItem(
                title = "Wake-up screen",
                description =
                    if (fullScreenEnabled) {
                        "RailWake can show the full-screen alarm."
                    } else {
                        "Full-screen alarm access is disabled."
                    },
                status =
                    if (fullScreenEnabled) {
                        ProtectionStatus.OK
                    } else {
                        ProtectionStatus.NEEDS_ATTENTION
                    },
                actionLabel =
                    if (!fullScreenEnabled) {
                        "Enable"
                    } else {
                        null
                    },
                action =
                    if (!fullScreenEnabled) {
                        {
                            openAppNotificationSettings(
                                context
                            )
                        }
                    } else {
                        null
                    }
            ),
            ProtectionItem(
                title = "Precise alarms",
                description =
                    if (exactAlarmEnabled) {
                        "Precise snooze and wake-up timing is enabled."
                    } else {
                        "Android may deliver snooze alarms less precisely."
                    },
                status =
                    if (exactAlarmEnabled) {
                        ProtectionStatus.OK
                    } else {
                        ProtectionStatus.NEEDS_ATTENTION
                    },
                actionLabel =
                    if (!exactAlarmEnabled) {
                        "Enable"
                    } else {
                        null
                    },
                action =
                    if (!exactAlarmEnabled) {
                        {
                            AlarmSnoozeScheduler
                                .openExactAlarmSettings(
                                    context
                                )
                        }
                    } else {
                        null
                    }
            ),
            ProtectionItem(
                title = "Battery protection",
                description =
                    if (batteryOptimizationExempt) {
                        "Battery restrictions are less likely to interfere with alerts."
                    } else {
                        "Battery optimization may delay background work."
                    },
                status =
                    if (batteryOptimizationExempt) {
                        ProtectionStatus.OK
                    } else {
                        ProtectionStatus.NEEDS_ATTENTION
                    },
                actionLabel =
                    if (!batteryOptimizationExempt) {
                        "Review"
                    } else {
                        null
                    },
                action =
                    if (!batteryOptimizationExempt) {
                        {
                            openBatterySettings(
                                context
                            )
                        }
                    } else {
                        null
                    }
            ),
            ProtectionItem(
                title = "Device registration",
                description =
                    "RailWake registers this device with Firebase so journey alerts can reach it.",
                status = ProtectionStatus.OK
            )
        )

    val attentionCount =
        items.count {
            it.status ==
                ProtectionStatus.NEEDS_ATTENTION
        }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("RailWake Protection")
                },
                navigationIcon = {
                    TextButton(
                        onClick = onBack
                    ) {
                        Text("Back")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 20.dp),
            verticalArrangement =
                Arrangement.spacedBy(12.dp)
        ) {
            item {
                Spacer(
                    Modifier.height(8.dp)
                )

                Card(
                    modifier =
                        Modifier.fillMaxWidth(),
                    shape =
                        RoundedCornerShape(28.dp),
                    colors =
                        CardDefaults.cardColors(
                            containerColor =
                                if (attentionCount == 0) {
                                    MaterialTheme
                                        .colorScheme
                                        .primaryContainer
                                } else {
                                    MaterialTheme
                                        .colorScheme
                                        .errorContainer
                                }
                        )
                ) {
                    Column(
                        Modifier.padding(22.dp)
                    ) {
                        Text(
                            if (attentionCount == 0) {
                                "You're protected ✓"
                            } else {
                                "$attentionCount thing${if (attentionCount == 1) "" else "s"} need attention"
                            },
                            style =
                                MaterialTheme
                                    .typography
                                    .headlineSmall,
                            fontWeight =
                                FontWeight.Bold
                        )

                        Spacer(
                            Modifier.height(6.dp)
                        )

                        Text(
                            if (attentionCount == 0) {
                                "RailWake has the permissions it needs to wake you before your stop."
                            } else {
                                "Fix the items below for the most reliable wake-up experience."
                            },
                            style =
                                MaterialTheme
                                    .typography
                                    .bodyLarge
                        )
                    }
                }
            }

            item {
                Text(
                    "Protection checks",
                    style =
                        MaterialTheme
                            .typography
                            .titleLarge,
                    fontWeight =
                        FontWeight.Bold
                )
            }

            items.forEach { item ->
                item {
                    ProtectionRow(
                        item = item
                    )
                }
            }

            item {
                Spacer(
                    Modifier.height(4.dp)
                )

                OutlinedButton(
                    onClick = {
                        refresh()
                    },
                    modifier =
                        Modifier.fillMaxWidth(),
                    shape =
                        RoundedCornerShape(16.dp)
                ) {
                    Text("Check again")
                }
            }

            item {
                Button(
                    onClick = {
                        DeviceRegistrationManager
                            .registerCurrentToken(
                                context
                            )
                        refresh()
                    },
                    modifier =
                        Modifier.fillMaxWidth(),
                    shape =
                        RoundedCornerShape(16.dp)
                ) {
                    Text("Refresh device registration")
                }
            }

            item {
                Spacer(
                    Modifier.height(8.dp)
                )

                Text(
                    "RailWake is designed to wake you when the train is approaching your selected stop. Keeping these checks healthy makes that promise more reliable.",
                    style =
                        MaterialTheme
                            .typography
                            .bodySmall,
                    color =
                        MaterialTheme
                            .colorScheme
                            .onSurfaceVariant
                )

                Spacer(
                    Modifier.height(24.dp)
                )
            }
        }
    }

    // Keep this value observed so Compose reruns the checks after actions.
    @Suppress("UNUSED_VARIABLE")
    val ignored = refreshToken
}

@Composable
private fun ProtectionRow(
    item: ProtectionItem
) {
    Card(
        modifier =
            Modifier.fillMaxWidth(),
        shape =
            RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(18.dp),
            verticalAlignment =
                Alignment.CenterVertically
        ) {
            Text(
                text =
                    if (
                        item.status ==
                            ProtectionStatus.OK
                    ) {
                        "✓"
                    } else {
                        "!"
                    },
                style =
                    MaterialTheme
                        .typography
                        .headlineSmall,
                fontWeight =
                    FontWeight.Bold,
                color =
                    if (
                        item.status ==
                            ProtectionStatus.OK
                    ) {
                        MaterialTheme
                            .colorScheme
                            .primary
                    } else {
                        MaterialTheme
                            .colorScheme
                            .error
                    }
            )

            Spacer(
                Modifier.size(12.dp)
            )

            Column(
                modifier =
                    Modifier.weight(1f)
            ) {
                Text(
                    item.title,
                    style =
                        MaterialTheme
                            .typography
                            .titleMedium,
                    fontWeight =
                        FontWeight.Bold
                )

                Text(
                    item.description,
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

            item.action?.let {
                Spacer(
                    Modifier.size(8.dp)
                )

                TextButton(
                    onClick = it
                ) {
                    Text(
                        item.actionLabel
                            ?: "Fix"
                    )
                }
            }
        }
    }
}

private fun openAppNotificationSettings(
    context: Context
) {
    val intent =
        Intent(
            Settings.ACTION_APP_NOTIFICATION_SETTINGS
        ).apply {
            putExtra(
                Settings.EXTRA_APP_PACKAGE,
                context.packageName
            )
            flags =
                Intent.FLAG_ACTIVITY_NEW_TASK
        }

    context.startActivity(intent)
}

private fun openBatterySettings(
    context: Context
) {
    val intent =
        Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
        ).apply {
            data =
                Uri.parse(
                    "package:${context.packageName}"
                )
            flags =
                Intent.FLAG_ACTIVITY_NEW_TASK
        }

    runCatching {
        context.startActivity(intent)
    }.onFailure {
        context.startActivity(
            Intent(
                Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
            ).apply {
                flags =
                    Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
    }
}
