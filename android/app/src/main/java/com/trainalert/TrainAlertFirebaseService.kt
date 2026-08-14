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

class TrainAlertFirebaseService :
    FirebaseMessagingService() {

    private val client =
        OkHttpClient()

    override fun onNewToken(
        token: String
    ) {
        super.onNewToken(token)

        if (token.isBlank()) {
            Log.w(
                TAG,
                "Ignoring empty FCM token"
            )

            return
        }

        Log.i(
            TAG,
            "FCM token refreshed"
        )

        registerToken(token)
    }

    override fun onMessageReceived(
        message: RemoteMessage
    ) {
        super.onMessageReceived(message)

        Log.i(
            TAG,
            "FCM message received"
        )

        val title =
            message.notification?.title
                ?: message.data["title"]
                ?: "Train Alert"

        val body =
            message.notification?.body
                ?: message.data["body"]
                ?: "Your train alert is ready."

        val journeyId =
            message.data["journeyId"]

        val notificationId =
            createNotificationId(
                journeyId
            )

        NotificationHelper.showNotification(
            context = this,
            notificationId = notificationId,
            title = title,
            body = body,
            journeyId = journeyId
        )

        Log.i(
            TAG,
            "Train alert notification requested"
        )
    }

    private fun createNotificationId(
        journeyId: String?
    ): Int {

        val hash =
            journeyId
                ?.hashCode()
                ?.and(0x7fffffff)
                ?: System
                    .currentTimeMillis()
                    .toInt()
                    .and(0x7fffffff)

        return NOTIFICATION_ID_BASE +
            hash
    }

    private fun registerToken(
        token: String
    ) {
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

        CoroutineScope(
            Dispatchers.IO
        ).launch {

            try {

                val payload =
                    JSONObject()
                        .put(
                            "platform",
                            "android"
                        )
                        .put(
                            "token",
                            token
                        )
                        .toString()

                val requestBody =
                    payload.toRequestBody(
                        JSON_MEDIA_TYPE
                    )

                val request =
                    Request.Builder()
                        .url(
                            "$BASE_URL/devices"
                        )
                        .header(
                            "x-user-id",
                            userId
                        )
                        .post(
                            requestBody
                        )
                        .build()

                client
                    .newCall(request)
                    .execute()
                    .use { response ->

                        if (
                            !response.isSuccessful
                        ) {

                            Log.e(
                                TAG,
                                "FCM registration failed: ${response.code}"
                            )

                        } else {

                            Log.i(
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

        /*
         * Always use the production API here.
         *
         * The previous value pointed to a temporary
         * Vercel Git branch deployment.
         */
        private const val BASE_URL =
            "https://train-alert-api.vercel.app/api"

        private const val NOTIFICATION_ID_BASE =
            1000

        private val JSON_MEDIA_TYPE =
            "application/json; charset=utf-8"
                .toMediaType()
    }
}