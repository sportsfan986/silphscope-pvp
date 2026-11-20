package com.gbl.overlay

import android.app.Application
import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Custom Application class that installs a global uncaught exception handler and
 * persists crash stack traces synchronously so launch/runtime crashes surface on
 * device without requiring USB ADB logcat.
 */
class SilphScopeApp : Application() {

    companion object {
        private const val CRASH_PREFS_NAME = "gbl_crash_diag_v1"
        private const val KEY_LAST_CRASH_REPORT = "last_crash_report"
        private const val KEY_LAST_CRASH_AT_MS = "last_crash_at_ms"
        private const val CRASH_FILE_NAME = "last_crash_trace.txt"

        fun formatCrashReport(stage: String, threadName: String, throwable: Throwable): String {
            val utcFmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss 'UTC'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val nowStr = utcFmt.format(Date())
            val trace = Log.getStackTraceString(throwable).take(14000)
            return buildString {
                appendLine("SilphScope PvP v${OverlayService.APP_VERSION} (${OverlayService.APP_VERSION_CODE})")
                appendLine("Time: $nowStr")
                appendLine("Device: ${Build.MANUFACTURER} ${Build.MODEL}")
                appendLine("Android: ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")
                appendLine("Stage: $stage")
                appendLine("Thread: $threadName")
                appendLine("---")
                append(trace)
            }.trimEnd()
        }

        fun recordCrash(
            context: Context,
            stage: String,
            throwable: Throwable,
            threadName: String = Thread.currentThread().name
        ): String {
            val report = formatCrashReport(stage, threadName, throwable)
            try {
                File(context.filesDir, CRASH_FILE_NAME).writeText(report)
            } catch (_: Throwable) {}
            try {
                context.getSharedPreferences(CRASH_PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_LAST_CRASH_REPORT, report)
                    .putLong(KEY_LAST_CRASH_AT_MS, System.currentTimeMillis())
                    .commit()
            } catch (_: Throwable) {}
            return report
        }

        fun recordNonFatalError(context: Context, stage: String, throwable: Throwable) {
            try {
                val existing = context.getSharedPreferences(CRASH_PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_LAST_CRASH_REPORT, null)
                if (existing.isNullOrBlank()) {
                    recordCrash(context, stage, throwable)
                }
            } catch (_: Throwable) {}
        }

        fun consumePendingCrashReport(context: Context): String? {
            return try {
                val prefs = context.getSharedPreferences(CRASH_PREFS_NAME, Context.MODE_PRIVATE)
                val fromPrefs = prefs.getString(KEY_LAST_CRASH_REPORT, null)?.trim().orEmpty()
                val file = File(context.filesDir, CRASH_FILE_NAME)
                val fromFile = if (fromPrefs.isEmpty() && file.exists()) {
                    try {
                        file.readText().trim()
                    } catch (_: Throwable) {
                        ""
                    }
                } else {
                    ""
                }
                prefs.edit()
                    .remove(KEY_LAST_CRASH_REPORT)
                    .remove(KEY_LAST_CRASH_AT_MS)
                    .commit()
                if (file.exists()) {
                    try {
                        file.delete()
                    } catch (_: Throwable) {}
                }
                val resolved = fromPrefs.ifBlank { fromFile }
                resolved.takeIf { it.isNotBlank() }
            } catch (_: Throwable) {
                null
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                recordCrash(applicationContext, "UncaughtException", throwable, thread.name)
            } catch (_: Throwable) {}
            prev?.uncaughtException(thread, throwable)
        }
    }
}
