package com.trainalert

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun RailWakeOnboardingScreen(
    context: Context,
    onAddJourney: () -> Unit,
    onProtection: () -> Unit,
    onSkip: () -> Unit
) {
    Column(
        modifier = Modifier.padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Spacer(Modifier.height(28.dp))

        Text("🚆", style = MaterialTheme.typography.displaySmall)

        Text(
            "Welcome to RailWake",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold
        )

        Text(
            "Sleep through your journey. We'll wake you before your stop.",
            style = MaterialTheme.typography.titleLarge
        )

        Text(
            "RailWake watches your train's expected arrival and keeps your wake-up alerts aligned with it when the journey changes.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Column(Modifier.padding(20.dp)) {
                Text(
                    "Before you sleep",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(8.dp))
                Text("✓ Your train and destination")
                Text("✓ Wake-up alarms")
                Text("✓ Live ETA monitoring")
                Text("✓ Automatic alert adjustment")
            }
        }

        Button(
            onClick = onAddJourney,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp)
        ) {
            Text("Add my first journey")
        }

        TextButton(
            onClick = onProtection,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Check my phone is ready")
        }

        TextButton(
            onClick = onSkip,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("I'll set it up later")
        }
    }
}
