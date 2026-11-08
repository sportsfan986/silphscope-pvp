import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val keystoreProps = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun signingValue(key: String): String? =
    System.getenv(key)?.takeIf { it.isNotBlank() } ?: keystoreProps.getProperty(key)?.takeIf { it.isNotBlank() }

android {
    namespace = "com.gbl.overlay"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gbl.overlay"
        // Android 12 (API 31): enables APK Signature Scheme v3 key rotation across all supported
        // devices and enforces modern foreground-service / PendingIntent security boundaries.
        minSdk = 31
        targetSdk = 35
        versionCode = 1723
        versionName = "7.23"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val ksPath = signingValue("RELEASE_KEYSTORE_PATH")
            if (ksPath != null) {
                val ksFile = file(ksPath)
                if (ksFile.exists()) {
                    storeFile = ksFile
                    storePassword = signingValue("RELEASE_STORE_PASSWORD")
                    keyAlias = signingValue("RELEASE_KEY_ALIAS")
                    keyPassword = signingValue("RELEASE_KEY_PASSWORD")
                    enableV1Signing = false
                    enableV2Signing = false
                    enableV3Signing = true
                }
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            val relSigning = signingConfigs.findByName("release")
            signingConfig = when {
                relSigning?.storeFile?.exists() == true -> relSigning
                System.getenv("REQUIRE_RELEASE_SIGNING") == "true" ->
                    throw GradleException(
                        "Release signing is required (REQUIRE_RELEASE_SIGNING=true), but RELEASE_KEYSTORE_PATH is missing or does not exist."
                    )
                else -> signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }

}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Google ML Kit Text Recognition (Offline bundled model for fast, local in-memory OCR)
    implementation("com.google.mlkit:text-recognition:16.0.1")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-service:2.8.4")

    // OkHttp & Gson for PvPoke gamemaster.json fetch and local cache parsing
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
