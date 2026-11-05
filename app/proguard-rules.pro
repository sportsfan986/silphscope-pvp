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
