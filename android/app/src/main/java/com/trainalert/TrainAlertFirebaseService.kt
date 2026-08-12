package com.trainalert

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.trainalert.notification.NotificationHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class TrainAlertFirebaseService : FirebaseMessagingService() {

    private val client = OkHttpClient()

    override fun onNewToken(token: String) {
        super.onNewToken(token)

        registerToken(token)
    }

    override fun onMessageReceived(
        message: RemoteMessage
    ) {
        super.onMessageReceived(message)

        val title =
            message.notification?.title
                ?: message.data["title"]
                ?: "Train Alert"

        val body =
            message.notification?.body
                ?: message.data["body"]
                ?: "Your train alert is ready."

        NotificationHelper.showNotification(
            context = this,
            title = title,
            body = body
        )
    }

    private fun registerToken(token: String) {
        val preferences =
            getSharedPreferences(
                "train_alert",
                MODE_PRIVATE
            )

        val userId =
            preferences.getString(
                "user_id",
                null
            )

        if (userId.isNullOrBlank()) {
            Log.w(
                TAG,
                "Cannot register FCM token: user ID missing"
            )
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val payload =
                    JSONObject()
                        .put("platform", "android")
                        .put("token", token)
                        .toString()

                val body =
                    payload.toRequestBody(
                        JSON_MEDIA_TYPE
                    )

                val request =
                    Request.Builder()
                        .url("$BASE_URL/devices")
                        .header(
                            "x-user-id",
                            userId
                        )
                        .post(body)
                        .build()

                client.newCall(request)
                    .execute()
                    .use { response ->
                        if (!response.isSuccessful) {
                            Log.e(
                                TAG,
                                "FCM registration failed: ${response.code}"
                            )
                        } else {
                            Log.d(
                                TAG,
                                "FCM token registered"
                            )
                        }
                    }
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Unable to register FCM token",
                    error
                )
            }
        }
    }

    companion object {
        private const val TAG =
            "TrainAlertFCM"

        private const val BASE_URL =
            "https://train-alert-api-git-feature-devi-a92348-himanshucse19s-projects.vercel.app/api"

        private val JSON_MEDIA_TYPE =
            "application/json; charset=utf-8"
                .toMediaType()
    }
}