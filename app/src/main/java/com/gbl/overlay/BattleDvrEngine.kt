package com.gbl.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.Process
import android.view.Gravity
import android.view.MotionEvent
import android.view.Surface
import android.view.WindowManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

import com.gbl.overlay.OverlayService.*
import com.gbl.overlay.OverlayService.Companion.APP_VERSION
import com.gbl.overlay.OverlayService.Companion.activeAlwaysOnDvrEnabled
import com.gbl.overlay.OverlayService.Companion.activeOneBattleDvrArmed
import com.gbl.overlay.OverlayService.Companion.activeOneBattleDvrFrames
import com.gbl.overlay.OverlayService.Companion.activeOneBattleDvrRecording
import com.gbl.overlay.OverlayService.Companion.activeShowOneBattleDvrBtn
import com.gbl.overlay.OverlayService.Companion.AiTelemetryBattleRecordV510
import com.gbl.overlay.OverlayService.Companion.BattleDeepTraceFrame
import com.gbl.overlay.OverlayService.Companion.FormResolver
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_ARM_ONE_BATTLE_DVR

// =============================================================================
// BattleDvrEngine.kt - v6.07 1-Battle Hardware H.264 DVR & Frame-Synced
// Deep Analysis Trace Engine
// =============================================================================

// =========================================================================
// v6.07: 1-BATTLE HARDWARE H.264 DVR & FRAME-SYNCED DEEP TRACE ENGINE
// =========================================================================

internal fun OverlayService.toggleArmOneBattleDvrFromOverlay() {
    if (!OverlayService.hasCustomScreenNameForVideoLoggingStatic(prefs)) {
        activeOneBattleDvrArmed = false
        prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, false).apply()
        showBattleToast("⚠️ Video logging requires a custom ID (not a random ID). Set a custom ID in App Settings first.")
        recalculateAndPushBattleData()
        return
    }
    if (!activeShowOneBattleDvrBtn) {
        showBattleToast("Enable '1-Battle DVR Button' in App Settings first.")
        return
    }
    val nextArmed = !activeOneBattleDvrArmed
    activeOneBattleDvrArmed = nextArmed
    prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, nextArmed).apply()
    if (nextArmed) {
        showBattleToast("🚩 Flagged Battle for Diagnostic Video & Deep Trace Upload")
    } else {
        showBattleToast("⚪ Cleared Manual Diagnostic Flag (Local Auto-DVR still active)")
    }
    recalculateAndPushBattleData()
}

private val dvrFrameInFlight = AtomicBoolean(false)
private val dvrBannerBgPaint by lazy {
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(145, 9, 13, 22)
        style = Paint.Style.FILL
    }
}
private val dvrBannerBorderPaint by lazy {
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(130, 56, 189, 248)
        style = Paint.Style.STROKE
        strokeWidth = 1.0f
    }
}
private val dvrBannerTextPaint by lazy {
    Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(220, 226, 232, 240)
        textSize = 10.5f
        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
    }
}

internal fun OverlayService.recordOneBattleDvrFrameAndTraceAsync(screen: Bitmap, nowMs: Long) {
    val handler = dvrHandler ?: return
    if (screen.isRecycled) return
    if (!dvrFrameInFlight.compareAndSet(false, true)) return
    val targetW = 544
    val targetH = (((screen.height.toFloat() / screen.width.toFloat()) * targetW.toFloat()).toInt() / 16 * 16).coerceIn(640, 1440)
    val scaledBmp = try {
        Bitmap.createScaledBitmap(screen, targetW, targetH, true)
    } catch (_: Exception) {
        null
    }
    if (scaledBmp == null) {
        dvrFrameInFlight.set(false)
        return
    }

    val uIdx = (currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
    val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
    val oIdx = if (detectedOpponents.isNotEmpty()) {
        detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(activeOppBase, ignoreCase = true)
        }.let { if (it in 0..2) it else 0 }
    } else 0

    val battleElapsed = if (battleClockAnchorMs > 0L) (nowMs - battleClockAnchorMs).coerceAtLeast(0L) else 0L
    val pSwapRem = if (playerSwapEndTimeMs > nowMs) ceil((playerSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
    val oSwapRem = if (oppSwapEndTimeMs > nowMs) ceil((oppSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0

    val draftTrace = BattleDeepTraceFrame(
        frameIdx = 0,
        timestampMs = nowMs,
        videoElapsedMs = 0L,
        battleElapsedMs = battleElapsed,
        rawUserHpPct = sampledPlayerHpPct,
        committedUserHpPct = playerSlotHpPct.getOrElse(uIdx) { 100 },
        userHpRowY = sampledPlayerHpRowY,
        rawOppHpPct = sampledOppHpPct,
        committedOppHpPct = oppSlotHpPct.getOrElse(oIdx) { 100 },
        oppHpRowY = sampledOppHpRowY,
        leftCircleFillPct = sampledLeftChargeBtnFillPct,
        rightCircleFillPct = sampledRightChargeBtnFillPct,
        userEnergy = playerSlotEnergy.getOrElse(uIdx) { 0 },
        oppEnergy = oppSlotEnergy.getOrElse(oIdx) { 0 },
        energySource = lastEnergyMutationSource,
        userShields = playerShieldsRemaining,
        oppShields = oppShieldsRemaining,
        userBalls = playerPokeballCount,
        oppBalls = oppPokeballCount,
        activeUserIdx = uIdx,
        activeOppIdx = oIdx,
        activeUserSpecies = activeUserPokemonName.orEmpty(),
        activeOppSpecies = activeOpponentName,
        userAtkStage = playerSlotAtkStage.getOrElse(uIdx) { 0 },
        userDefStage = playerSlotDefStage.getOrElse(uIdx) { 0 },
        userDisguiseBusted = playerSlotDisguiseBusted.getOrElse(uIdx) { false },
        oppAtkStage = oppSlotAtkStage.getOrElse(oIdx) { 0 },
        oppDefStage = oppSlotDefStage.getOrElse(oIdx) { 0 },
        oppDisguiseBusted = oppSlotDisguiseBusted.getOrElse(oIdx) { false },
        isCutsceneActive = pendingChargedAttackActor.isNotEmpty() || (sampledLeftChargeBtnFillPct == -1 && sampledRightChargeBtnFillPct == -1),
        pendingChargeActor = pendingChargedAttackActor,
        isTopCountdownActive = isTopCountdownCircleActive,
        playerSwapRemainingSec = pSwapRem,
        oppSwapRemainingSec = oSwapRem,
        ocrOppTopText = cachedOcrOppLines.joinToString(" | ") { it.text },
        ocrUserTopText = cachedOcrPlayerTopLines.joinToString(" | ") { it.text },
        ocrMidBannerText = cachedOcrMidBannerLines.joinToString(" | ") { it.text },
        ocrBottomMovesText = cachedOcrPlayerMoveLines.joinToString(" | ") { it.text },
        recommendedPhase = lastRecommendedPhase,
        recommendedAction = lastRecommendedAction,
        recommendedGoal = lastRecommendedGoal,
        userSlotHpPct = playerSlotHpPct.toList(),
        oppSlotHpPct = oppSlotHpPct.toList(),
        userSlotEnergy = playerSlotEnergy.toList(),
        oppSlotEnergy = oppSlotEnergy.toList(),
        userSlotAtkStage = playerSlotAtkStage.toList(),
        userSlotDefStage = playerSlotDefStage.toList(),
        oppSlotAtkStage = oppSlotAtkStage.toList(),
        oppSlotDefStage = oppSlotDefStage.toList(),
        oppSlotConfirmedChargedMoves = (0..2).map { idx ->
            confirmedOppChargedMoves.getOrNull(idx)?.toList() ?: emptyList()
        }
    )

    val canRecordNow = activeAlwaysOnDvrEnabled || activeOneBattleDvrArmed

    handler.post {
        try {
            if (!canRecordNow) {
                scaledBmp.recycle()
                return@post
            }
            if (!activeOneBattleDvrRecording) {
                startDvrEncoderLocked(targetW, targetH, nowMs)
            }
            if (!activeOneBattleDvrRecording) {
                scaledBmp.recycle()
                return@post
            }
            dvrFrameCount++
            activeOneBattleDvrFrames = dvrFrameCount
            val vidElapsed = (nowMs - dvrRecordingStartMs).coerceAtLeast(0L)
            val finalTrace = draftTrace.copy(
                frameIdx = dvrFrameCount,
                videoElapsedMs = vidElapsed
            )

            val surf = dvrInputSurface
            if (surf != null) {
                val canvas = try {
                    surf.lockHardwareCanvas()
                } catch (_: Exception) {
                    surf.lockCanvas(null)
                }
                try {
                    canvas.drawBitmap(scaledBmp, 0f, 0f, null)
                    // v6.41: Minimal top-left corner frame-index pill (`#0042`) for clean Telegram playback;
                    // full telemetry HUD banner is burned back into diagnostic keyframes/contact sheets locally via FFmpeg.
                    val stamp = String.format(
                        java.util.Locale.US,
                        "#%04d",
                        finalTrace.frameIdx
                    )
                    val bannerRect = RectF(4f, 2f, 46f, 16f)
                    canvas.drawRoundRect(bannerRect, 3.5f, 3.5f, dvrBannerBgPaint)
                    canvas.drawRoundRect(bannerRect, 3.5f, 3.5f, dvrBannerBorderPaint)
                    canvas.drawText(stamp, 7.5f, 12.5f, dvrBannerTextPaint)
                } finally {
                    surf.unlockCanvasAndPost(canvas)
                }
                drainDvrEncoderLocked(endOfStream = false)
            }
            dvrTraceWriter?.write(gson.toJson(finalTrace) + "\n")
            if (dvrFrameCount % 10 == 0) {
                dvrTraceWriter?.flush()
            }
        } catch (_: Exception) {
        } finally {
            dvrFrameInFlight.set(false)
            if (!scaledBmp.isRecycled) {
                scaledBmp.recycle()
            }
        }
    }
}

internal fun OverlayService.startDvrEncoderLocked(width: Int, height: Int, startMs: Long) {
    releaseDvrResourcesLocked(deleteFiles = true)
    try {
        dvrVideoWidth = width
        dvrVideoHeight = height
        val mp4 = File(cacheDir, "dvr_live_battle.mp4")
        val trace = File(cacheDir, "dvr_live_deep_trace.jsonl")
        if (mp4.exists()) mp4.delete()
        if (trace.exists()) trace.delete()
        dvrMp4File = mp4
        dvrTraceFile = trace
        dvrTraceWriter = trace.bufferedWriter(Charsets.UTF_8)

        fun buildEncoderFormat(useQpBounds: Boolean): MediaFormat {
            return MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
                setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
                setInteger(MediaFormat.KEY_BIT_RATE, 720_000)
                setInteger(MediaFormat.KEY_FRAME_RATE, 15)
                setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
                if (useQpBounds) {
                    setInteger(MediaFormat.KEY_BITRATE_MODE, MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_CBR)
                    setInteger(MediaFormat.KEY_VIDEO_QP_I_MIN, 27)
                    setInteger(MediaFormat.KEY_VIDEO_QP_I_MAX, 36)
                    setInteger(MediaFormat.KEY_VIDEO_QP_P_MIN, 29)
                    setInteger(MediaFormat.KEY_VIDEO_QP_P_MAX, 38)
                    setInteger(MediaFormat.KEY_VIDEO_QP_B_MIN, 29)
                    setInteger(MediaFormat.KEY_VIDEO_QP_B_MAX, 38)
                    setInteger("vendor.qti-ext-enc-qp-range.qp-i-min", 27)
                    setInteger("vendor.qti-ext-enc-qp-range.qp-i-max", 36)
                    setInteger("vendor.qti-ext-enc-qp-range.qp-p-min", 29)
                    setInteger("vendor.qti-ext-enc-qp-range.qp-p-max", 38)
                }
            }
        }
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        try {
            codec.configure(buildEncoderFormat(useQpBounds = true), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        } catch (_: Exception) {
            try { codec.reset() } catch (_: Exception) {}
            codec.configure(buildEncoderFormat(useQpBounds = false), null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        }
        val surface = codec.createInputSurface()
        codec.start()

        val muxer = MediaMuxer(mp4.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        dvrMediaCodec = codec
        dvrInputSurface = surface
        dvrMediaMuxer = muxer
        dvrVideoTrackIndex = -1
        dvrMuxerStarted = false
        dvrRecordingStartMs = startMs
        dvrFrameCount = 0
        activeOneBattleDvrFrames = 0
        activeOneBattleDvrRecording = true
    } catch (_: Exception) {
        releaseDvrResourcesLocked(deleteFiles = true)
    }
}

internal fun OverlayService.drainDvrEncoderLocked(endOfStream: Boolean) {
    val codec = dvrMediaCodec ?: return
    val muxer = dvrMediaMuxer ?: return
    try {
        if (endOfStream) {
            try {
                codec.signalEndOfInputStream()
            } catch (_: Exception) {}
        }
        val bufferInfo = MediaCodec.BufferInfo()
        var loops = 0
        while (loops < 60) {
            loops++
            val outIndex = codec.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000L else 0L)
            if (outIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!endOfStream) break
            } else if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                if (!dvrMuxerStarted) {
                    dvrVideoTrackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    dvrMuxerStarted = true
                }
            } else if (outIndex >= 0) {
                val encodedData = codec.getOutputBuffer(outIndex)
                if (encodedData != null) {
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) {
                        bufferInfo.size = 0
                    }
                    if (bufferInfo.size != 0 && dvrMuxerStarted && dvrVideoTrackIndex >= 0) {
                        encodedData.position(bufferInfo.offset)
                        encodedData.limit(bufferInfo.offset + bufferInfo.size)
                        muxer.writeSampleData(dvrVideoTrackIndex, encodedData, bufferInfo)
                    }
                }
                codec.releaseOutputBuffer(outIndex, false)
                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    break
                }
            }
        }
    } catch (_: Exception) {}
}

internal fun OverlayService.releaseDvrResourcesLocked(deleteFiles: Boolean) {
    activeOneBattleDvrRecording = false
    activeOneBattleDvrFrames = 0
    dvrFrameCount = 0
    dvrRecordingStartMs = 0L
    try {
        dvrTraceWriter?.flush()
        dvrTraceWriter?.close()
    } catch (_: Exception) {}
    dvrTraceWriter = null

    try {
        dvrInputSurface?.release()
    } catch (_: Exception) {}
    dvrInputSurface = null

    try {
        dvrMediaCodec?.stop()
    } catch (_: Exception) {}
    try {
        dvrMediaCodec?.release()
    } catch (_: Exception) {}
    dvrMediaCodec = null

    try {
        if (dvrMuxerStarted) {
            dvrMediaMuxer?.stop()
        }
    } catch (_: Exception) {}
    try {
        dvrMediaMuxer?.release()
    } catch (_: Exception) {}
    dvrMediaMuxer = null
    dvrVideoTrackIndex = -1
    dvrMuxerStarted = false

    if (deleteFiles) {
        try { dvrMp4File?.delete() } catch (_: Exception) {}
        try { dvrTraceFile?.delete() } catch (_: Exception) {}
        dvrMp4File = null
        dvrTraceFile = null
    }
}

internal fun OverlayService.abortOneBattleDvrAsync(disarm: Boolean) {
    if (disarm) {
        activeOneBattleDvrArmed = false
        if (isPrefsInitialized) {
            prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, false).apply()
        }
    }
    dvrHandler?.post {
        releaseDvrResourcesLocked(deleteFiles = true)
    }
}

internal fun OverlayService.finalizeAndUploadOneBattleDvrAsync(
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510,
    wasExplicitlyFlaggedForDiag: Boolean = false,
    explicitBugReportNote: String = ""
) {
    activeOneBattleDvrArmed = false
    if (isPrefsInitialized) {
        prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, false).apply()
    }
    val handler = dvrHandler ?: return
    handler.post {
        val capturedFrames = dvrFrameCount
        val videoSpanMs = if (dvrRecordingStartMs > 0L) (System.currentTimeMillis() - dvrRecordingStartMs).coerceAtLeast(0L) else 0L
        val battleDurSec = summaryRecord.battleDurationSec ?: 0.0
        val isValidBattleClip = summaryRecord.oppTeamSpecs.isNotEmpty() &&
            (videoSpanMs >= 10_000L || battleDurSec >= 10.0) &&
            capturedFrames >= 15

        if (!isValidBattleClip) {
            releaseDvrResourcesLocked(deleteFiles = true)
            Handler(Looper.getMainLooper()).post {
                if (lastLoggedBattleId == battleId) {
                    lastLoggedBattleHasDvr = false
                    lastLoggedBattleDvrUploadStatus = "DISCARDED_SHORT"
                }
                recalculateAndPushBattleData()
            }
            return@post
        }

        try {
            drainDvrEncoderLocked(endOfStream = true)
        } catch (_: Exception) {}
        val rawMp4 = dvrMp4File
        val rawTrace = dvrTraceFile
        releaseDvrResourcesLocked(deleteFiles = false)
        if (rawMp4 == null && rawTrace == null) return@post

        val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val replaysDir = File(filesDir, "dvr_replays").apply { if (!exists()) mkdirs() }
        val localMp4 = File(replaysDir, "${cleanId}_video.mp4")
        val localTrace = File(replaysDir, "${cleanId}_deep_trace.jsonl")
        try {
            if (rawMp4 != null && rawMp4.exists()) {
                rawMp4.copyTo(localMp4, overwrite = true)
                rawMp4.delete()
            }
            if (rawTrace != null && rawTrace.exists()) {
                rawTrace.copyTo(localTrace, overwrite = true)
                rawTrace.delete()
            }
        } catch (_: Exception) {}

        // Prepend BATTLE_DVR_SUMMARY_HEADER to localTrace so local replay & cloud upload both have full 3v3 metadata
        OverlayService.prependDvrSummaryHeaderIfNeededStatic(prefs, gson, battleId, summaryRecord, localTrace)
        OverlayService.enforceLocalDvrReplaysQuotaStatic(filesDir, prefs, gson)

        Handler(Looper.getMainLooper()).post {
            recalculateAndPushBattleData()
            if (wasExplicitlyFlaggedForDiag) {
                showBattleToast("🚩 Uploading Flagged Battle Video & Bug Report...")
            } else {
                showBattleToast("🎬 DVR Saved — Uploading in 12s (Tap 🗑️ Delete in HUD to cancel)")
            }
        }

        schedulePostBattleDvrAutoUploadJob(
            battleId = battleId,
            summaryRecord = summaryRecord,
            wasExplicitlyFlaggedForDiag = wasExplicitlyFlaggedForDiag,
            explicitBugReportNote = explicitBugReportNote,
            initialDelayMs = if (wasExplicitlyFlaggedForDiag) 0L else 12_000L
        )
    }
}

internal fun OverlayService.schedulePostBattleDvrAutoUploadJob(
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510,
    wasExplicitlyFlaggedForDiag: Boolean = false,
    explicitBugReportNote: String = "",
    initialDelayMs: Long = 12_000L
) {
    val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
    val replaysDir = File(filesDir, "dvr_replays").apply { if (!exists()) mkdirs() }
    val localMp4 = File(replaysDir, "${cleanId}_video.mp4")
    val localTrace = File(replaysDir, "${cleanId}_deep_trace.jsonl")
    val shouldUploadDiag = activeAlwaysOnDvrEnabled || wasExplicitlyFlaggedForDiag || summaryRecord.hasHighSeverityAnomaly
    val cleanBugNote = explicitBugReportNote.trim()
    val diagReason = when {
        wasExplicitlyFlaggedForDiag && cleanBugNote.isNotEmpty() && summaryRecord.hasHighSeverityAnomaly ->
            "Manual Flag + HIGH Anomaly (${summaryRecord.anomalyCount}): $cleanBugNote"
        wasExplicitlyFlaggedForDiag && cleanBugNote.isNotEmpty() ->
            "Post-Battle User Bug Report: $cleanBugNote"
        wasExplicitlyFlaggedForDiag && summaryRecord.hasHighSeverityAnomaly ->
            "Manual Flag + HIGH Anomaly (${summaryRecord.anomalyCount})"
        wasExplicitlyFlaggedForDiag -> "Post-Battle User Bug Report Flag"
        summaryRecord.hasHighSeverityAnomaly -> "Auto HIGH-Severity Anomaly (${summaryRecord.anomalyCount})"
        else -> "Always-On Auto DVR"
    }

    pendingPostBattleDvrUploadJob?.cancel()
    pendingPostBattleDvrUploadJob = OverlayService.dvrUploadScope.launch {
        if (initialDelayMs > 0L) {
            // Hold automatic upload so the user can review and tap 🗑️ Delete Video or 🚩 Bug Report in the HUD
            delay(initialDelayMs)
        }
        if ((lastLoggedBattleId == battleId && lastLoggedBattleDvrDeleted) || (!localMp4.exists() && !localTrace.exists())) {
            return@launch
        }

        val networkAllowed = OverlayService.isDvrUploadAllowedOnCurrentNetworkStatic(prefs)
        if (!networkAllowed) {
            if (shouldUploadDiag) {
                try {
                    if (localMp4.exists()) localMp4.copyTo(File(cacheDir, "${cleanId}_video.mp4"), overwrite = true)
                    if (localTrace.exists()) localTrace.copyTo(File(cacheDir, "${cleanId}_deep_trace.jsonl"), overwrite = true)
                } catch (_: Exception) {}
            }
            withContext(Dispatchers.Main) {
                if (lastLoggedBattleId == battleId) {
                    lastLoggedBattleDvrUploadStatus = "WIFI_WAIT"
                    recalculateAndPushBattleData()
                }
                if (shouldUploadDiag) {
                    showBattleToast("📶 DVR queued for Wi-Fi (Mobile Data upload is OFF in Settings)")
                }
            }
            return@launch
        }

        withContext(Dispatchers.Main) {
            if (lastLoggedBattleId == battleId && !lastLoggedBattleDvrDeleted) {
                lastLoggedBattleDvrUploadStatus = "UPLOADING"
                recalculateAndPushBattleData()
            }
        }

        var toastMsg: String? = null
        var toastLong = false

        if (shouldUploadDiag) {
            val (dvrOk, dvrMsg) = OverlayService.uploadBattleDvrBundleToGitHubBlocking(
                prefs = prefs,
                gson = gson,
                battleId = battleId,
                summaryRecord = summaryRecord,
                mp4File = localMp4,
                traceFile = localTrace,
                deleteFilesOnSuccess = false,
                uploadReason = diagReason
            )
            if (!dvrOk) {
                // Queue a copy in cacheDir for background retry
                try {
                    if (localMp4.exists()) localMp4.copyTo(File(cacheDir, "${cleanId}_video.mp4"), overwrite = true)
                    if (localTrace.exists()) localTrace.copyTo(File(cacheDir, "${cleanId}_deep_trace.jsonl"), overwrite = true)
                } catch (_: Exception) {}
            } else {
                try {
                    OverlayService.retryPendingCachedDvrBundlesBlocking(cacheDir, prefs, gson)
                } catch (_: Exception) {}
            }
            toastMsg = dvrMsg
            toastLong = dvrOk
        }

        // Auto-upload to Cloud R2 Replay Vault if user has an active Unlock Key (Base / Pro / VIP)
        try {
            val (vaultOk, vaultMsg, _) = OverlayService.uploadBattleReplayToR2VaultIfUnlockedBlocking(
                prefs = prefs,
                gson = gson,
                battleId = battleId,
                summaryRecord = summaryRecord,
                mp4File = localMp4,
                traceFile = localTrace
            )
            if (vaultOk && toastMsg == null) {
                toastMsg = vaultMsg
            }
        } catch (_: Exception) {}

        try {
            OverlayService.uploadPendingAiTelemetryBatchBlocking(
                prefs = prefs,
                gson = gson,
                forceUpload = true,
                minBattlesRequired = 1
            )
        } catch (_: Exception) {}

        withContext(Dispatchers.Main) {
            if (lastLoggedBattleId == battleId && !lastLoggedBattleDvrDeleted) {
                lastLoggedBattleDvrUploadStatus = "UPLOADED"
                recalculateAndPushBattleData()
            }
            if (!toastMsg.isNullOrBlank()) {
                showBattleToast(toastMsg, if (toastLong) Toast.LENGTH_LONG else Toast.LENGTH_SHORT)
            }
        }
    }
}

/**
 * v6.42: Populates a headless `OverlayService` replay instance from a `BattleDeepTraceFrame`
 * so `buildBattlePayloadJson(isReplayMode = true)` reconstructs the full 3x3 Matchup Matrix,
 * 9-Shield badge, Fast-Move Pacing, and 2-Line Tactical Coach at any video timestamp!
 */
internal fun OverlayService.applyDeepTraceFrameForReplay(
    frame: BattleDeepTraceFrame,
    preThrowOppEnergyHint: Int = 0,
    forceShieldDecisionActive: Boolean = false
) {
    val now = System.currentTimeMillis()
    val uIdx = frame.activeUserIdx.coerceIn(0, 2)
    val oIdx = frame.activeOppIdx.coerceIn(0, 2)

    if (frame.activeUserSpecies.isNotBlank()) {
        activeUserPokemonName = frame.activeUserSpecies
    }
    if (frame.activeOppSpecies.isNotBlank()) {
        activeOpponentName = frame.activeOppSpecies
        if (detectedOpponents.none { FormResolver.extractBaseSpecies(it).equals(FormResolver.extractBaseSpecies(frame.activeOppSpecies), ignoreCase = true) }) {
            if (detectedOpponents.size < 3) {
                detectedOpponents.add(frame.activeOppSpecies)
            } else if (oIdx in detectedOpponents.indices) {
                detectedOpponents[oIdx] = frame.activeOppSpecies
            }
        }
    }

    for (i in 0..2) {
        playerSlotHpPct[i] = frame.userSlotHpPct.getOrElse(i) {
            if (i == uIdx) frame.committedUserHpPct.coerceIn(0, 100) else playerSlotHpPct[i]
        }
        oppSlotHpPct[i] = frame.oppSlotHpPct.getOrElse(i) {
            if (i == oIdx) frame.committedOppHpPct.coerceIn(0, 100) else oppSlotHpPct[i]
        }
        playerSlotEnergy[i] = frame.userSlotEnergy.getOrElse(i) {
            if (i == uIdx) frame.userEnergy.coerceIn(0, 100) else playerSlotEnergy[i]
        }
        oppSlotEnergy[i] = frame.oppSlotEnergy.getOrElse(i) {
            if (i == oIdx) frame.oppEnergy.coerceIn(0, 100) else oppSlotEnergy[i]
        }
        playerSlotAtkStage[i] = frame.userSlotAtkStage.getOrElse(i) {
            if (i == uIdx) frame.userAtkStage.coerceIn(-4, 4) else playerSlotAtkStage[i]
        }
        playerSlotDefStage[i] = frame.userSlotDefStage.getOrElse(i) {
            if (i == uIdx) frame.userDefStage.coerceIn(-4, 4) else playerSlotDefStage[i]
        }
        oppSlotAtkStage[i] = frame.oppSlotAtkStage.getOrElse(i) {
            if (i == oIdx) frame.oppAtkStage.coerceIn(-4, 4) else oppSlotAtkStage[i]
        }
        oppSlotDefStage[i] = frame.oppSlotDefStage.getOrElse(i) {
            if (i == oIdx) frame.oppDefStage.coerceIn(-4, 4) else oppSlotDefStage[i]
        }
        if (frame.oppSlotConfirmedChargedMoves.isNotEmpty()) {
            val slotMoves = frame.oppSlotConfirmedChargedMoves.getOrNull(i).orEmpty()
            confirmedOppChargedMoves.getOrNull(i)?.apply {
                clear()
                addAll(slotMoves.filter { it.isNotBlank() })
            }
        }
    }
    playerSlotDisguiseBusted[uIdx] = frame.userDisguiseBusted
    oppSlotDisguiseBusted[oIdx] = frame.oppDisguiseBusted

    playerShieldsRemaining = frame.userShields.coerceIn(0, 2)
    oppShieldsRemaining = frame.oppShields.coerceIn(0, 2)
    playerPokeballCount = frame.userBalls.coerceIn(0, 3)
    oppPokeballCount = frame.oppBalls.coerceIn(0, 3)

    sampledPlayerHpPct = frame.rawUserHpPct
    sampledOppHpPct = frame.rawOppHpPct
    sampledLeftChargeBtnFillPct = frame.leftCircleFillPct
    sampledRightChargeBtnFillPct = frame.rightCircleFillPct
    lastEnergyMutationSource = frame.energySource
    pendingChargedAttackActor = frame.pendingChargeActor
    isTopCountdownCircleActive = frame.isTopCountdownActive
    playerSwapEndTimeMs = if (frame.playerSwapRemainingSec > 0) now + frame.playerSwapRemainingSec * 1000L else 0L
    oppSwapEndTimeMs = if (frame.oppSwapRemainingSec > 0) now + frame.oppSwapRemainingSec * 1000L else 0L

    val combinedBanner = "${frame.ocrMidBannerText} ${frame.ocrBottomMovesText}".lowercase()
    val hasUsedBanner = combinedBanner.contains(" used ")
    val hasIncomingBanner = combinedBanner.contains("attack incoming") ||
        combinedBanner.contains("protect shield") ||
        combinedBanner.contains("shields remaining")
    isAttackIncomingPromptActive = forceShieldDecisionActive || (!hasUsedBanner && (
        frame.isTopCountdownActive ||
            hasIncomingBanner ||
            frame.recommendedPhase.equals("SHIELD_CALL", ignoreCase = true) ||
            (frame.pendingChargeActor.equals("opp", ignoreCase = true) && frame.leftCircleFillPct == -1 && frame.rightCircleFillPct == -1)
        ))
    if (isAttackIncomingPromptActive) {
        pendingChargedAttackOppSlotIdx = oIdx
        pendingChargedAttackUserSlotIdx = uIdx
        pendingChargedAttackPreOppEnergy = preThrowOppEnergyHint.coerceIn(0, 100)
    } else {
        pendingChargedAttackPreOppEnergy = 0
    }

    if (frame.recommendedPhase.isNotBlank()) lastRecommendedPhase = frame.recommendedPhase
    if (frame.recommendedAction.isNotBlank()) lastRecommendedAction = frame.recommendedAction
    if (frame.recommendedGoal.isNotBlank()) lastRecommendedGoal = frame.recommendedGoal
}
