package com.trainalert

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.util.Log

import com.google.android.gms.tasks.Tasks
import com.google.firebase.messaging.FirebaseMessaging

import java.util.concurrent.Executors


object DeviceRegistrationManager {

    private const val TAG =
        "DeviceRegistration"

    private const val OFFLINE_MESSAGE =
        "You're offline. Connect to Wi-Fi or mobile data and tap Try again."

    private const val AUTHENTICATION_MESSAGE =
        "We couldn't connect to Train Alert. Please check your connection and try again."

    private const val DEVICE_REGISTRATION_MESSAGE =
        "We couldn't register this device for alerts. Please try again."

    private val executor =
        Executors.newSingleThreadExecutor()

    private val mainHandler =
        Handler(
            Looper.getMainLooper()
        )


    /**
     * Initializes the user session and registers
     * the current FCM token with the backend.
     *
     * The important UX behavior here is that we
     * detect an offline device before attempting
     * Firebase authentication, so the user sees
     * a useful message instead of a generic auth error.
     */
    fun ensureUser(
        context: Context,
        onSuccess: () -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {

            try {

                if (
                    !isNetworkValidated(
                        context
                    )
                ) {

                    Log.w(
                        TAG,
                        "Skipping device initialization: device is offline"
                    )

                    postError(
                        onError,
                        OFFLINE_MESSAGE
                    )

                    return@execute
                }


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

                val message =
                    if (
                        !isNetworkValidated(
                            context
                        )
                    ) {
                        OFFLINE_MESSAGE
                    } else if (
                        error.message
                            ?.contains(
                                "authenticate",
                                ignoreCase = true
                            ) == true
                    ) {
                        AUTHENTICATION_MESSAGE
                    } else {
                        error.message
                            ?.takeIf {
                                it.isNotBlank()
                            }
                            ?: DEVICE_REGISTRATION_MESSAGE
                    }

                postError(
                    onError,
                    message
                )
            }
        }
    }


    /**
     * Gets the current FCM token and registers it
     * with the backend.
     *
     * This is deliberately silent when registration
     * fails during background startup because the
     * foreground screen already handles the primary
     * initialization UX.
     */
    fun registerCurrentToken(
        context: Context
    ) {
        executor.execute {

            try {

                if (
                    !isNetworkValidated(
                        context
                    )
                ) {

                    Log.w(
                        TAG,
                        "Skipping FCM registration: device is offline"
                    )

                    return@execute
                }


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
     * Called when Firebase rotates the device token.
     */
    fun registerToken(
        context: Context,
        token: String
    ) {

        if (
            token.isBlank()
        ) {

            Log.w(
                TAG,
                "Ignoring empty FCM token"
            )

            return
        }


        executor.execute {

            try {

                if (
                    !isNetworkValidated(
                        context
                    )
                ) {

                    /*
                     * Do not treat a temporary offline state
                     * as a permanent registration failure.
                     *
                     * Firebase will normally continue managing
                     * the local token, and registerCurrentToken()
                     * will retry during a later app startup.
                     */
                    Log.w(
                        TAG,
                        "Skipping refreshed FCM registration: device is offline"
                    )

                    return@execute
                }


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


        if (
            token.isNullOrBlank()
        ) {

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
                DEVICE_REGISTRATION_MESSAGE
            )
        }


        Log.i(
            TAG,
            "FCM device registered successfully"
        )
    }


    /**
     * Checks whether Android currently has a
     * validated internet connection.
     *
     * NET_CAPABILITY_INTERNET alone only means that
     * the network claims to provide internet access.
     *
     * NET_CAPABILITY_VALIDATED means Android has
     * actually verified connectivity.
     */
    private fun isNetworkValidated(
        context: Context
    ): Boolean {

        val connectivityManager =
            context.getSystemService(
                ConnectivityManager::class.java
            )
                ?: return false


        val network =
            connectivityManager.activeNetwork
                ?: return false


        val capabilities =
            connectivityManager
                .getNetworkCapabilities(
                    network
                )
                ?: return false


        return capabilities.hasCapability(
            NetworkCapabilities
                .NET_CAPABILITY_INTERNET
        ) &&
            capabilities.hasCapability(
                NetworkCapabilities
                    .NET_CAPABILITY_VALIDATED
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