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

    private val mainHandler =
        Handler(Looper.getMainLooper())

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
                val firebaseUser =
                    FirebaseAuthManager
                        .ensureAuthenticated()

                mainHandler.post {
                    onSuccess(
                        firebaseUser.uid
                    )
                }
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Unable to authenticate user",
                    error
                )

                mainHandler.post {
                    onError(
                        error.message
                            ?.takeIf {
                                it.isNotBlank()
                            }
                            ?: "Unable to initialize Train Alert."
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
                    context,
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
                val idToken =
                    FirebaseAuthManager
                        .getIdToken()

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
                            "Authorization",
                            "Bearer $idToken"
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
}