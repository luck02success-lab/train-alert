package com.trainalert

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.URLEncoder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

data class TrainSuggestion(
    val number: String,
    val name: String
)

data class StationSuggestion(
    val code: String,
    val name: String
)

object JourneyLookupApi {

    private const val TAG =
        "JourneyLookupApi"

    private const val MAX_AUTH_RETRIES =
        1

    private val mainHandler =
        Handler(
            Looper.getMainLooper()
        )

    private val client =
        OkHttpClient.Builder()
            .connectTimeout(
                10,
                TimeUnit.SECONDS
            )
            .readTimeout(
                10,
                TimeUnit.SECONDS
            )
            .writeTimeout(
                10,
                TimeUnit.SECONDS
            )
            .build()

    private val executor =
        Executors.newSingleThreadExecutor()

    fun searchTrains(
        query: String,
        onSuccess: (
            List<TrainSuggestion>
        ) -> Unit,
        onError: (String) -> Unit
    ) {
        val encodedQuery =
            try {
                URLEncoder.encode(
                    query.trim(),
                    "UTF-8"
                )
            } catch (_: Exception) {
                query.trim()
            }

        search(
            path =
                "/api/lookups/trains?q=$encodedQuery",

            parser =
                ::parseTrains,

            onSuccess =
                onSuccess,

            onError =
                onError
        )
    }

    fun searchStations(
        query: String,
        onSuccess: (
            List<StationSuggestion>
        ) -> Unit,
        onError: (String) -> Unit
    ) {
        val encodedQuery =
            try {
                URLEncoder.encode(
                    query.trim(),
                    "UTF-8"
                )
            } catch (_: Exception) {
                query.trim()
            }

        search(
            path =
                "/api/lookups/stations?q=$encodedQuery",

            parser =
                ::parseStations,

            onSuccess =
                onSuccess,

            onError =
                onError
        )
    }

    private fun <T> search(
        path: String,
        parser: (String) -> List<T>,
        onSuccess: (List<T>) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {

            var attempt = 0

            try {
                var token =
                    FirebaseAuthManager
                        .getIdToken()

                while (true) {
                    val request =
                        createRequest(
                            path = path,
                            token = token
                        )

                    val response =
                        client
                            .newCall(request)
                            .execute()

                    /*
                     * Retry exactly once when the
                     * Firebase ID token has expired.
                     */
                    if (
                        response.code == 401 &&
                        attempt < MAX_AUTH_RETRIES
                    ) {
                        response.close()

                        attempt++

                        Log.w(
                            TAG,
                            "Lookup returned 401; refreshing Firebase ID token"
                        )

                        token =
                            FirebaseAuthManager
                                .refreshIdToken()

                        continue
                    }

                    response.use {

                        val body =
                            it.body
                                ?.string()
                                .orEmpty()

                        if (!it.isSuccessful) {
                            val message =
                                parseErrorMessage(
                                    body =
                                        body,
                                    statusCode =
                                        it.code
                                )

                            postError(
                                onError,
                                message
                            )

                            return@use
                        }

                        val result =
                            try {
                                parser(body)
                            } catch (error: Exception) {
                                Log.e(
                                    TAG,
                                    "Unable to parse lookup response",
                                    error
                                )

                                postError(
                                    onError,
                                    "Unable to read search results."
                                )

                                return@use
                            }

                        mainHandler.post {
                            onSuccess(result)
                        }
                    }

                    return@execute
                }
            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Lookup request failed",
                    error
                )

                postError(
                    onError,
                    networkErrorMessage(error)
                )
            }
        }
    }

    private fun createRequest(
        path: String,
        token: String
    ): Request {
        return Request.Builder()
            .url(
                BuildConfig.API_BASE_URL + path
            )
            .header(
                "Authorization",
                "Bearer $token"
            )
            .get()
            .build()
    }

    private fun parseTrains(
        body: String
    ): List<TrainSuggestion> {
        val array =
            org.json.JSONArray(body)

        return buildList {

            for (
                index in
                0 until array.length()
            ) {
                val item =
                    array.getJSONObject(index)

                val number =
                    item.optString("number")
                        .trim()

                val name =
                    item.optString("name")
                        .trim()

                if (
                    number.isNotBlank() &&
                    name.isNotBlank()
                ) {
                    add(
                        TrainSuggestion(
                            number = number,
                            name = name
                        )
                    )
                }
            }
        }
    }

    private fun parseStations(
        body: String
    ): List<StationSuggestion> {
        val array =
            org.json.JSONArray(body)

        return buildList {

            for (
                index in
                0 until array.length()
            ) {
                val item =
                    array.getJSONObject(index)

                val code =
                    item.optString("code")
                        .trim()
                        .uppercase()

                val name =
                    item.optString("name")
                        .trim()

                if (
                    code.isNotBlank() &&
                    name.isNotBlank()
                ) {
                    add(
                        StationSuggestion(
                            code = code,
                            name = name
                        )
                    )
                }
            }
        }
    }

    private fun parseErrorMessage(
        body: String,
        statusCode: Int
    ): String {
        return try {
            val json =
                org.json.JSONObject(body)

            val error =
                json.optJSONObject("error")

            error
                ?.optString("message")
                ?.takeIf {
                    it.isNotBlank()
                }
                ?: when (statusCode) {
                    401 ->
                        "Your session is no longer valid."

                    404 ->
                        "Search service was not found."

                    429 ->
                        "Search is temporarily busy. Please try again."

                    in 500..599 ->
                        "The Train Alert service is temporarily unavailable."

                    else ->
                        "Unable to search right now."
                }
        } catch (_: Exception) {
            when (statusCode) {
                401 ->
                    "Your session is no longer valid."

                429 ->
                    "Search is temporarily busy. Please try again."

                in 500..599 ->
                    "The Train Alert service is temporarily unavailable."

                else ->
                    "Unable to search right now."
            }
        }
    }

    private fun networkErrorMessage(
        error: Exception
    ): String {
        return when (error) {
            is SocketTimeoutException ->
                "The search request timed out. Please try again."

            is IOException ->
                "Unable to reach Train Alert. Please check your connection."

            else ->
                error.message
                    ?.takeIf {
                        it.isNotBlank()
                    }
                    ?: "Something went wrong. Please try again."
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