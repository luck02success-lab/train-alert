package com.trainalert

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.Executors

object DeviceRegistrationManager {

    private const val TAG =
        "DeviceRegistration"

    private val executor =
        Executors.newSingleThreadExecutor()

    private val mainHandler =
        Handler(
            Looper.getMainLooper()
        )

    /**
     * Authenticates the Firebase user and makes sure
     * the current FCM token is registered with the backend.
     */
    fun ensureUser(
        context: Context,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                FirebaseAuthManager
                    .ensureAuthenticated()

                registerCurrentTokenInternal(
                    context
                )

                postSuccess(
                    onSuccess
                )
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Device initialization failed",
                    error
                )

                postError(
                    onError,
                    error.message
                        ?.takeIf {
                            it.isNotBlank()
                        }
                        ?: "Unable to initialize Train Alert."
                )
            }
        }
    }

    /**
     * Gets the current FCM token and registers it
     * with the backend.
     *
     * This is used when the application starts and
     * notification permission is already available.
     */
    fun registerCurrentToken(
        context: Context
    ) {
        executor.execute {
            try {
                FirebaseAuthManager
                    .ensureAuthenticated()

                registerCurrentTokenInternal(
                    context
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

    /**
     * Registers a newly refreshed FCM token.
     *
     * Called from FirebaseMessagingService when
     * Firebase rotates the device token.
     */
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

    private fun registerCurrentTokenInternal(
        context: Context
    ) {
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
        mainHandler.post {
            callback()
        }
    }

    private fun postError(
        callback: (String) -> Unit,
        message: String
    ) {
        mainHandler.post {
            callback(message)
        }
    }
}