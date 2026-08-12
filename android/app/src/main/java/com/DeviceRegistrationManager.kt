package com.trainalert

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

object DeviceRegistrationManager {

    private const val TAG = "DeviceRegistration"

    private const val PREFS_NAME = "train_alert"
    private const val USER_ID_KEY = "user_id"

    private const val API_BASE_URL =
        "https://train-alert-api.vercel.app"

    private val httpClient = OkHttpClient()

    private val executor =
        Executors.newSingleThreadExecutor()

    private val jsonMediaType =
        "application/json; charset=utf-8".toMediaType()

    fun registerCurrentToken(context: Context) {
        FirebaseMessaging
            .getInstance()
            .token
            .addOnSuccessListener { token ->
                registerToken(
                    context.applicationContext,
                    token
                )
            }
            .addOnFailureListener { error ->
                Log.e(
                    TAG,
                    "Unable to obtain FCM token",
                    error
                )
            }
    }

    fun registerToken(
        context: Context,
        token: String
    ) {
        if (token.isBlank()) {
            Log.w(TAG, "Ignoring empty FCM token")
            return
        }

        executor.execute {
            try {
                val userId =
                    getOrCreateUserId(context)

                val payload =
                    JSONObject()
                        .put("platform", "android")
                        .put("token", token)

                val request =
                    Request.Builder()
                        .url("$API_BASE_URL/api/devices")
                        .header(
                            "x-user-id",
                            userId
                        )
                        .header(
                            "Content-Type",
                            "application/json"
                        )
                        .post(
                            payload
                                .toString()
                                .toRequestBody(
                                    jsonMediaType
                                )
                        )
                        .build()

                httpClient
                    .newCall(request)
                    .execute()
                    .use { response ->

                        if (!response.isSuccessful) {
                            Log.e(
                                TAG,
                                "Device registration failed: " +
                                    "${response.code} " +
                                    response.body?.string()
                            )
                            return@use
                        }

                        Log.i(
                            TAG,
                            "FCM device registered successfully"
                        )
                    }
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Device registration request failed",
                    error
                )
            }
        }
    }

    private fun getOrCreateUserId(
        context: Context
    ): String {
        val preferences =
            context.getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            )

        val existing =
            preferences.getString(
                USER_ID_KEY,
                null
            )

        if (!existing.isNullOrBlank()) {
            return existing
        }

        val generated =
            UUID.randomUUID().toString()

        preferences
            .edit()
            .putString(
                USER_ID_KEY,
                generated
            )
            .apply()

        return generated
    }
}