package com.trainalert

import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser

object FirebaseAuthManager {

    private const val TAG =
        "FirebaseAuthManager"

    private val auth =
        FirebaseAuth.getInstance()

    fun ensureAuthenticated(): FirebaseUser {
        val existingUser =
            auth.currentUser

        if (existingUser != null) {
            return existingUser
        }

        return try {
            val result =
                Tasks.await(
                    auth.signInAnonymously()
                )

            result.user
                ?: throw IllegalStateException(
                    "Firebase authentication returned no user."
                )
        } catch (error: Exception) {
            Log.e(
                TAG,
                "Anonymous Firebase authentication failed",
                error
            )

            throw IllegalStateException(
                "Unable to authenticate with Train Alert.",
                error
            )
        }
    }

    /**
     * Returns a valid Firebase ID token.
     *
     * Firebase manages token persistence and refresh.
     * We first use the cached token when possible and
     * force a refresh only when the caller explicitly
     * requests one.
     */
    fun getIdToken(
        forceRefresh: Boolean = false
    ): String {
        val user =
            ensureAuthenticated()

        return try {
            val result =
                Tasks.await(
                    user.getIdToken(
                        forceRefresh
                    )
                )

            result.token
                ?: throw IllegalStateException(
                    "Firebase authentication returned no ID token."
                )
        } catch (error: Exception) {
            Log.e(
                TAG,
                "Unable to obtain Firebase ID token",
                error
            )

            throw IllegalStateException(
                "Unable to authenticate with Train Alert.",
                error
            )
        }
    }

    /**
     * Forces Firebase to obtain a fresh ID token.
     *
     * Useful after the backend returns HTTP 401.
     */
    fun refreshIdToken(): String {
        return getIdToken(
            forceRefresh = true
        )
    }

    /**
     * Clears the current anonymous Firebase session.
     *
     * The next API operation will transparently
     * authenticate again.
     */
    fun signOut() {
        try {
            auth.signOut()
        } catch (error: Exception) {
            Log.e(
                TAG,
                "Firebase sign-out failed",
                error
            )
        }
    }
}