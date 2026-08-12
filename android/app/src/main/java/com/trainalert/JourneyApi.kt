package com.trainalert

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

data class Journey(
    val id: String,
    val trainNumber: String,
    val journeyDate: String,
    val destinationStationCode: String,
    val state: String,
    val expectedArrival: String?,
    val nextAlert: String?
)

object JourneyApi {

    private const val TAG = "JourneyApi"

    private val API_BASE_URL =
    BuildConfig.API_BASE_URL

    private const val PREFS_NAME = "train_alert"
    private const val USER_ID_KEY = "user_id"

    private val client = OkHttpClient()

    private val executor =
        Executors.newSingleThreadExecutor()

    private val jsonMediaType =
        "application/json; charset=utf-8".toMediaType()

    fun listJourneys(
        context: Context,
        onSuccess: (List<Journey>) -> Unit,
        onError: (String) -> Unit
    ) {
        executor.execute {
            try {
                val userId = getUserId(context)

                if (userId == null) {
                    onError("User is not registered yet.")
                    return@execute
                }

                val request =
                    Request.Builder()
                        .url("$API_BASE_URL/api/journeys")
                        .header("x-user-id", userId)
                        .get()
                        .build()

                client.newCall(request)
                    .execute()
                    .use { response ->

                        val body =
                            response.body?.string().orEmpty()

                        if (!response.isSuccessful) {
                            Log.e(
                                TAG,
                                "List journeys failed: ${response.code} $body"
                            )

                            onError(
                                "Unable to load journeys (${response.code})"
                            )

                            return@use
                        }

                        val journeys =
                            parseJourneyList(body)

                        onSuccess(journeys)
                    }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "List journeys request failed",
                    error
                )

                onError(
                    error.message ?: "Network error"
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
                val userId = getUserId(context)

                if (userId == null) {
                    onError("User is not registered yet.")
                    return@execute
                }

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

                val request =
                    Request.Builder()
                        .url("$API_BASE_URL/api/journeys")
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

                client.newCall(request)
                    .execute()
                    .use { response ->

                        val body =
                            response.body?.string().orEmpty()

                        if (!response.isSuccessful) {
                            Log.e(
                                TAG,
                                "Create journey failed: " +
                                    "${response.code} $body"
                            )

                            val message =
                                try {
                                    JSONObject(body)
                                        .getJSONObject("error")
                                        .getString("message")
                                } catch (_: Exception) {
                                    "Unable to create journey (${response.code})"
                                }

                            onError(message)

                            return@use
                        }

                        val journey =
                            parseJourney(
                                JSONObject(body)
                            )

                        onSuccess(journey)
                    }

            } catch (error: Exception) {
                Log.e(
                    TAG,
                    "Create journey request failed",
                    error
                )

                onError(
                    error.message ?: "Network error"
                )
            }
        }
    }

    private fun getUserId(
        context: Context
    ): String? {
        return context
            .getSharedPreferences(
                PREFS_NAME,
                Context.MODE_PRIVATE
            )
            .getString(
                USER_ID_KEY,
                null
            )
    }

    private fun parseJourneyList(
        body: String
    ): List<Journey> {

        val array =
            JSONArray(body)

        val journeys =
            mutableListOf<Journey>()

        for (index in 0 until array.length()) {
            journeys.add(
                parseJourney(
                    array.getJSONObject(index)
                )
            )
        }

        return journeys
    }

    private fun parseJourney(
        json: JSONObject
    ): Journey {

        return Journey(
            id = json.getString("id"),
            trainNumber =
                json.getString("trainNumber"),
            journeyDate =
                json.getString("journeyDate"),
            destinationStationCode =
                json.getString(
                    "destinationStationCode"
                ),
            state =
                json.getString("state"),
            expectedArrival =
                json.optString(
                    "expectedArrival",
                    null
                ),
            nextAlert =
                json.optString(
                    "nextAlert",
                    null
                )
        )
    }
}