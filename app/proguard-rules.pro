# Add project specific ProGuard rules here.
# Keep JavascriptInterface bridge methods for WebView HUD & Replay Dialog
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep Gson serialized data models and inner data classes in com.gbl.overlay
-keep class com.gbl.overlay.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

# Keep Google ML Kit Text Recognition classes
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Keep Gson TypeToken and reflection models
-keep class com.google.gson.** { *; }
-keep class * extends com.google.gson.reflect.TypeToken
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# OkHttp / Okio platform warnings
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
