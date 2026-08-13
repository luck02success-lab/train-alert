package com.trainalert

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.android.gms.tasks.Tasks

object FirebaseAuthManager {

    private val auth =
        FirebaseAuth.getInstance()

    fun ensureAuthenticated(): FirebaseUser {
        val existing =
            auth.currentUser

        if (existing != null) {
            return existing
        }

        val result =
            Tasks.await(
                auth.signInAnonymously()
            )

        return result.user
            ?: throw IllegalStateException(
                "Firebase authentication returned no user."
            )
    }

    fun getIdToken(): String {
        val user =
            ensureAuthenticated()

        val result =
            Tasks.await(
                user.getIdToken(false)
            )

        return result.token
            ?: throw IllegalStateException(
                "Firebase authentication returned no ID token."
            )
    }
}