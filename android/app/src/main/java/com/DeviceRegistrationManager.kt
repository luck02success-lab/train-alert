package com.trainalert

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

object DeviceRegistrationManager {

    private const val TAG =
        "DeviceRegistration"

    private const val PREFS_NAME =
        "train_alert"

    private const val USER_ID_KEY =
        "user_id"

    private val mainHandler =
        Handler(Looper.getMainLooper())

    private val userLock =
        Any()

    private val httpClient =
        OkHttpClient.Builder()
            .connectTimeout(
                15,
                TimeUnit.SECONDS
            )
            .readTimeout(
                20,
                TimeUnit.SECONDS
            )
            .writeTimeout(
                20,
                TimeUnit.SECONDS
            )
            .build()

    private val executor =
        Executors.newSingleThreadExecutor()

    private val jsonMediaType =
        "application/json; charset=utf-8"
            .toMediaType()

    fun ensureUser(
        context: Context,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val userId =
                    getOrCreateUserId(context)

                mainHandler.post {
                    onSuccess(userId)
                }
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Unable to create/retrieve user",
                    error
                )

                mainHandler.post {
                    onError(
                        errorMessage(error)
                    )
                }
            }
        }
    }

    fun registerCurrentToken(
        context: Context
    ) {
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
            Log.w(
                TAG,
                "Ignoring empty FCM token"
            )
            return
        }

        executor.execute {
            try {
                val userId =
                    getOrCreateUserId(context)

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

                val request =
                    Request.Builder()
                        .url(
                            "${BuildConfig.API_BASE_URL}/api/devices"
                        )
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

                        val body =
                            response.body
                                ?.string()

                        if (!response.isSuccessful) {
                            Log.e(
                                TAG,
                                "Device registration failed: " +
                                    "${response.code} $body"
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
        synchronized(userLock) {
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

            val userId =
                createAnonymousUser()

            preferences
                .edit()
                .putString(
                    USER_ID_KEY,
                    userId
                )
                .apply()

            Log.i(
                TAG,
                "Created anonymous Train Alert user"
            )

            return userId
        }
    }

    private fun createAnonymousUser(): String {
        val request =
            Request.Builder()
                .url(
                    "${BuildConfig.API_BASE_URL}/api/users"
                )
                .header(
                    "Content-Type",
                    "application/json"
                )
                .post(
                    "{}"
                        .toRequestBody(
                            jsonMediaType
                        )
                )
                .build()

        httpClient
            .newCall(request)
            .execute()
            .use { response ->

                val body =
                    response.body?.string()

                if (!response.isSuccessful) {
                    throw IllegalStateException(
                        "User creation failed: " +
                            "${response.code}"
                    )
                }

                if (body.isNullOrBlank()) {
                    throw IllegalStateException(
                        "User creation returned an empty response."
                    )
                }

                val json =
                    JSONObject(body)

                val userId =
                    json.optString("id")

                if (userId.isBlank()) {
                    throw IllegalStateException(
                        "User creation response did not contain an id."
                    )
                }

                return userId
            }
    }

    private fun errorMessage(
        error: Exception
    ): String {
        return error.message
            ?.takeIf {
                it.isNotBlank()
            }
            ?: "Unable to initialize Train Alert."
    }
}