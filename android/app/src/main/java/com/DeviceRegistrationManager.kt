package com.trainalert

import android.content.Context
import android.util.Log
import com.google.firebase.messaging.FirebaseMessaging
import com.google.android.gms.tasks.Tasks
import java.util.concurrent.Executors

object DeviceRegistrationManager {

    private const val TAG =
        "DeviceRegistration"

    private val executor =
        Executors.newSingleThreadExecutor()

    fun ensureUser(
        context: Context,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                FirebaseAuthManager
                    .ensureAuthenticated()

                postSuccess(
                    onSuccess
                )
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Firebase authentication failed",
                    error
                )

                postError(
                    onError,
                    error.message
                        ?: "Unable to authenticate with Firebase."
                )
            }
        }
    }

    fun registerCurrentToken(
        context: Context
    ) {
        executor.execute {
            try {
                FirebaseAuthManager
                    .ensureAuthenticated()

                val token =
                    Tasks.await(
                        FirebaseMessaging
                            .getInstance()
                            .token
                    )

                if (token.isNullOrBlank()) {
                    throw IllegalStateException(
                        "Firebase returned an empty FCM token."
                    )
                }

                registerTokenInternal(
                    context,
                    token
                )
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Unable to register current FCM token",
                    error
                )
            }
        }
    }

    fun registerToken(
        context: Context,
        token: String
    ) {
        executor.execute {
            try {
                FirebaseAuthManager
                    .ensureAuthenticated()

                registerTokenInternal(
                    context,
                    token
                )
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Unable to register refreshed FCM token",
                    error
                )
            }
        }
    }

    private fun registerTokenInternal(
        context: Context,
        token: String
    ) {
        val idToken =
            FirebaseAuthManager
                .getIdToken()

        val success =
            DeviceApi.register(
                context = context,
                idToken = idToken,
                token = token
            )

        if (!success) {
            throw IllegalStateException(
                "Device registration failed."
            )
        }

        Log.i(
            TAG,
            "FCM device registered successfully"
        )
    }

    private fun postSuccess(
        callback: () -> Unit
    ) {
        android.os.Handler(
            android.os.Looper.getMainLooper()
        ).post {
            callback()
        }
    }

    private fun postError(
        callback: (String) -> Unit,
        message: String
    ) {
        android.os.Handler(
            android.os.Looper.getMainLooper()
        ).post {
            callback(message)
        }
    }
}