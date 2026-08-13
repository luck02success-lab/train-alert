plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.gms.google-services")
}

import java.util.Properties

val localProperties =
    Properties().apply {
        val file =
            rootProject.file("local.properties")

        if (file.exists()) {
            file.inputStream().use {
                load(it)
            }
        }
    }

fun propertyOrNull(
    name: String
): String? {
    return localProperties
        .getProperty(name)
        ?.takeIf {
            it.isNotBlank()
        }
}

android {
    namespace = "com.trainalert"

    compileSdk = 35

    defaultConfig {
        applicationId =
            "com.trainalert"

        minSdk = 26

        targetSdk = 35

        versionCode = 1

        versionName = "1.0.0"

        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"https://train-alert-api.vercel.app\""
        )
    }

    signingConfigs {
        create("release") {
            val storeFilePath =
                propertyOrNull(
                    "TRAIN_ALERT_KEYSTORE_FILE"
                )

            val storePassword =
                propertyOrNull(
                    "TRAIN_ALERT_KEYSTORE_PASSWORD"
                )

            val keyAlias =
                propertyOrNull(
                    "TRAIN_ALERT_KEY_ALIAS"
                )

            val keyPassword =
                propertyOrNull(
                    "TRAIN_ALERT_KEY_PASSWORD"
                )

            if (
                storeFilePath != null &&
                storePassword != null &&
                keyAlias != null &&
                keyPassword != null
            ) {
                storeFile =
                    file(storeFilePath)

                this.storePassword =
                    storePassword

                this.keyAlias =
                    keyAlias

                this.keyPassword =
                    keyPassword
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false

            applicationIdSuffix =
                ".debug"

            versionNameSuffix =
                "-debug"

            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"https://train-alert-api.vercel.app\""
            )
        }

        release {
            isMinifyEnabled = true

            isShrinkResources = true

            signingConfig =
                signingConfigs.getByName(
                    "release"
                )

            buildConfigField(
                "String",
                "API_BASE_URL",
                "\"https://train-alert-api.vercel.app\""
            )

            proguardFiles(
                getDefaultProguardFile(
                    "proguard-android-optimize.txt"
                ),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility =
            JavaVersion.VERSION_17

        targetCompatibility =
            JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(
        platform(
            "androidx.compose:compose-bom:2025.02.00"
        )
    )

    implementation(
        "androidx.activity:activity-compose:1.10.1"
    )

    implementation(
        "androidx.compose.ui:ui"
    )

    implementation(
        "androidx.compose.ui:ui-tooling-preview"
    )

    implementation(
        "androidx.compose.material3:material3"
    )

    implementation(
        "androidx.lifecycle:lifecycle-runtime-compose:2.8.7"
    )

    implementation(
        "androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7"
    )

    implementation(
        "androidx.core:core-ktx:1.15.0"
    )

    implementation(
        "com.squareup.okhttp3:okhttp:4.12.0"
    )

    implementation(
        platform(
            "com.google.firebase:firebase-bom:33.16.0"
        )
    )

    implementation(
        "com.google.firebase:firebase-auth"
    )

    implementation(
        "com.google.firebase:firebase-messaging"
    )

    implementation(
    "androidx.fragment:fragment-ktx:1.8.6"
)
}