package com.trainalert

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper
import android.util.Log

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

import org.json.JSONArray
import org.json.JSONObject

import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit


data class Journey(
    val id: String,
    val trainNumber: String,
    val journeyDate: String,
    val destinationStationCode: String,
    val destinationStationName: String?,
    val state: String,
    val expectedArrival: String?,
    val delayMinutes: Int?,
    val nextAlert: String?,
    val alertOffsetsMinutes: List<Int>
)


object JourneyApi {

    private const val TAG =
        "JourneyApi"

    private const val MAX_AUTH_RETRIES =
        1

    private val mainHandler =
        Handler(
            Looper.getMainLooper()
        )

    private val client =
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


    fun listJourneys(
        context: Context,
        onSuccess: (List<Journey>) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val response =
                    executeAuthenticatedRequest(
                        createGetRequest(
                            "/api/journeys"
                        )
                    )

                response.use {
                    val body =
                        it.body
                            ?.string()
                            .orEmpty()

                    if (!it.isSuccessful) {
                        postError(
                            onError,
                            parseErrorMessage(
                                body,
                                it.code,
                                "Unable to load journeys"
                            )
                        )

                        return@use
                    }

                    val journeys =
                        parseJourneyList(
                            body
                        )

                    mainHandler.post {
                        onSuccess(
                            journeys
                        )
                    }
                }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "List journeys request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(
                        context,
                        error
                    )
                )
            }
        }
    }


    fun getJourney(
        context: Context,
        journeyId: String,
        onSuccess: (Journey) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val response =
                    executeAuthenticatedRequest(
                        createGetRequest(
                            "/api/journeys/$journeyId"
                        )
                    )

                response.use {
                    val body =
                        it.body
                            ?.string()
                            .orEmpty()

                    if (!it.isSuccessful) {
                        postError(
                            onError,
                            parseErrorMessage(
                                body,
                                it.code,
                                "Unable to load journey"
                            )
                        )

                        return@use
                    }

                    val journey =
                        parseJourney(
                            JSONObject(body)
                        )

                    mainHandler.post {
                        onSuccess(
                            journey
                        )
                    }
                }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Get journey request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(
                        context,
                        error
                    )
                )
            }
        }
    }


    fun createJourney(
        context: Context,
        trainNumber: String,
        journeyDate: String,
        destinationStationCode: String,
        onSuccess: (Journey) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val payload =
                    JSONObject()
                        .put(
                            "trainNumber",
                            trainNumber
                        )
                        .put(
                            "journeyDate",
                            journeyDate
                        )
                        .put(
                            "destinationStationCode",
                            destinationStationCode
                                .uppercase()
                        )

                val response =
                    executeAuthenticatedRequest(
                        createJsonRequest(
                            method = "POST",
                            path = "/api/journeys",
                            payload = payload
                        )
                    )

                response.use {
                    val body =
                        it.body
                            ?.string()
                            .orEmpty()

                    if (!it.isSuccessful) {
                        postError(
                            onError,
                            parseErrorMessage(
                                body,
                                it.code,
                                "Unable to create journey"
                            )
                        )

                        return@use
                    }

                    val journey =
                        parseJourney(
                            JSONObject(body)
                        )

                    mainHandler.post {
                        onSuccess(
                            journey
                        )
                    }
                }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Create journey request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(
                        context,
                        error
                    )
                )
            }
        }
    }


    fun cancelJourney(
        context: Context,
        journeyId: String,
        onSuccess: (Journey) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val response =
                    executeAuthenticatedRequest(
                        createDeleteRequest(
                            "/api/journeys/$journeyId"
                        )
                    )

                response.use {
                    val body =
                        it.body
                            ?.string()
                            .orEmpty()

                    if (!it.isSuccessful) {
                        postError(
                            onError,
                            parseErrorMessage(
                                body,
                                it.code,
                                "Unable to cancel journey"
                            )
                        )

                        return@use
                    }

                    val journey =
                        parseJourney(
                            JSONObject(body)
                        )

                    mainHandler.post {
                        onSuccess(
                            journey
                        )
                    }
                }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Cancel journey request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(
                        context,
                        error
                    )
                )
            }
        }
    }


    fun updateAlertPreferences(
        context: Context,
        journeyId: String,
        alertOffsetsMinutes: List<Int>,
        onSuccess: (Journey) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val payload =
                    JSONObject()
                        .put(
                            "alertOffsetsMinutes",
                            JSONArray(
                                alertOffsetsMinutes
                            )
                        )

                val response =
                    executeAuthenticatedRequest(
                        createJsonRequest(
                            method = "PATCH",
                            path =
                                "/api/journeys/$journeyId/alerts",
                            payload = payload
                        )
                    )

                response.use {
                    val body =
                        it.body
                            ?.string()
                            .orEmpty()

                    if (!it.isSuccessful) {
                        postError(
                            onError,
                            parseErrorMessage(
                                body,
                                it.code,
                                "Unable to update alert preferences"
                            )
                        )

                        return@use
                    }

                    val journey =
                        parseJourney(
                            JSONObject(body)
                        )

                    mainHandler.post {
                        onSuccess(
                            journey
                        )
                    }
                }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Update alert preferences request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(
                        context,
                        error
                    )
                )
            }
        }
    }


    private fun executeAuthenticatedRequest(
        requestFactory:
            (String) -> Request
    ): okhttp3.Response {

        var token =
            FirebaseAuthManager
                .getIdToken()

        var attempt =
            0

        while (true) {
            val request =
                requestFactory(token)

            val response =
                client.newCall(
                    request
                ).execute()

            if (
                response.code != 401 ||
                attempt >= MAX_AUTH_RETRIES
            ) {
                return response
            }

            response.close()

            attempt++

            Log.w(
                TAG,
                "API returned 401; refreshing Firebase ID token"
            )

            token =
                FirebaseAuthManager
                    .refreshIdToken()
        }
    }


    private fun createGetRequest(
        path: String
    ): (String) -> Request {
        return { token ->
            Request.Builder()
                .url(
                    BuildConfig.API_BASE_URL +
                        path
                )
                .header(
                    "Authorization",
                    "Bearer $token"
                )
                .get()
                .build()
        }
    }


    private fun createDeleteRequest(
        path: String
    ): (String) -> Request {
        return { token ->
            Request.Builder()
                .url(
                    BuildConfig.API_BASE_URL +
                        path
                )
                .header(
                    "Authorization",
                    "Bearer $token"
                )
                .delete()
                .build()
        }
    }


    private fun createJsonRequest(
        method: String,
        path: String,
        payload: JSONObject
    ): (String) -> Request {
        return { token ->
            Request.Builder()
                .url(
                    BuildConfig.API_BASE_URL +
                        path
                )
                .header(
                    "Authorization",
                    "Bearer $token"
                )
                .header(
                    "Content-Type",
                    "application/json"
                )
                .method(
                    method,
                    payload
                        .toString()
                        .toRequestBody(
                            jsonMediaType
                        )
                )
                .build()
        }
    }


    private fun parseJourneyList(
        body: String
    ): List<Journey> {

        val array =
            JSONArray(body)

        val journeys =
            mutableListOf<Journey>()

        for (
            index in
            0 until array.length()
        ) {
            journeys.add(
                parseJourney(
                    array.getJSONObject(
                        index
                    )
                )
            )
        }

        return journeys
    }


    private fun parseJourney(
        json: JSONObject
    ): Journey {

        val offsets =
            mutableListOf<Int>()

        val offsetsJson =
            json.optJSONArray(
                "alertOffsetsMinutes"
            )

        if (
            offsetsJson != null
        ) {
            for (
                index in
                0 until offsetsJson.length()
            ) {
                offsets.add(
                    offsetsJson.getInt(
                        index
                    )
                )
            }
        }

        return Journey(
            id =
                json.getString("id"),

            trainNumber =
                json.getString(
                    "trainNumber"
                ),

            journeyDate =
                json.getString(
                    "journeyDate"
                ),

            destinationStationCode =
                json.getString(
                    "destinationStationCode"
                ),

            destinationStationName =
                nullableString(
                    json,
                    "destinationStationName"
                ),

            state =
                json.getString("state"),

            expectedArrival =
                nullableString(
                    json,
                    "expectedArrival"
                ),

            delayMinutes =
                nullableInt(
                    json,
                    "delayMinutes"
                ),

            nextAlert =
                nullableString(
                    json,
                    "nextAlert"
                ),

            alertOffsetsMinutes =
                offsets
        )
    }


    private fun nullableString(
        json: JSONObject,
        key: String
    ): String? {
        if (
            !json.has(key) ||
            json.isNull(key)
        ) {
            return null
        }

        return json.getString(key)
    }


    private fun nullableInt(
        json: JSONObject,
        key: String
    ): Int? {
        if (
            !json.has(key) ||
            json.isNull(key)
        ) {
            return null
        }

        return json.getInt(key)
    }


    private fun parseErrorMessage(
        body: String,
        statusCode: Int,
        fallback: String
    ): String {
        return try {
            val json =
                JSONObject(body)

            val error =
                json.optJSONObject(
                    "error"
                )

            error
                ?.optString("message")
                ?.takeIf {
                    it.isNotBlank()
                }
                ?: when (statusCode) {
                    401 ->
                        "Your session is no longer valid."

                    404 ->
                        "The requested journey was not found."

                    409 ->
                        "This journey cannot be changed right now."

                    422 ->
                        "Please check the journey details and try again."

                    in 500..599 ->
                        "The Train Alert service is temporarily unavailable."

                    else ->
                        "$fallback ($statusCode)"
                }

        } catch (_: Exception) {
            "$fallback ($statusCode)"
        }
    }


    private fun networkErrorMessage(
        context: Context,
        error: Exception
    ): String {

        if (
            !hasNetwork(context)
        ) {
            return "No internet connection. Please check your network and try again."
        }

        return when (error) {
            is SocketTimeoutException ->
                "The request timed out. Please try again."

            is IOException ->
                "Unable to reach Train Alert. Please try again."

            else ->
                error.message
                    ?.takeIf {
                        it.isNotBlank()
                    }
                    ?: "Something went wrong. Please try again."
        }
    }


    private fun hasNetwork(
        context: Context
    ): Boolean {

        val manager =
            context.getSystemService(
                ConnectivityManager::class.java
            ) ?: return true

        val network =
            manager.activeNetwork
                ?: return false

        val capabilities =
            manager.getNetworkCapabilities(
                network
            ) ?: return false

        return capabilities.hasCapability(
            NetworkCapabilities
                .NET_CAPABILITY_INTERNET
        )
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