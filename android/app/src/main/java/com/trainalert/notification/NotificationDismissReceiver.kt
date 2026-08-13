package com.trainalert.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class NotificationDismissReceiver :
    BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent
    ) {
        if (
            intent.action !=
            NotificationHelper
                .getDismissAction()
        ) {
            return
        }

        val notificationId =
            intent.getIntExtra(
                NotificationHelper
                    .getNotificationIdExtra(),
                -1
            )

        if (
            notificationId == -1
        ) {
            return
        }

        NotificationHelper
            .dismissNotification(
                context,
                notificationId
            )
    }
}