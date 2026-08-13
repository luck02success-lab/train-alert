package com.trainalert

import android.content.Context
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object DeviceApi {

    private const val TAG =
        "DeviceApi"

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

    private val jsonMediaType =
        "application/json; charset=utf-8"
            .toMediaType()

    fun register(
        context: Context,
        idToken: String,
        token: String
    ): Boolean {
        return try {
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

            client.newCall(
                request
            ).execute().use { response ->

                if (!response.isSuccessful) {
                    Log.e(
                        TAG,
                        "Device registration failed: " +
                            response.code
                    )

                    return false
                }

                true
            }
        } catch (error: Exception) {
            Log.e(
                TAG,
                "Device registration request failed",
                error
            )

            false
        }
    }
}