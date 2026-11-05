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
import kotlin.coroutines.resume
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

import com.gbl.overlay.OverlayService.*
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
    if (!activeShowOneBattleDvrBtn) {
        showBattleToast("Enable '1-Battle DVR Button' in App Settings first.")
        return
    }
    val nextArmed = !activeOneBattleDvrArmed
    activeOneBattleDvrArmed = nextArmed
    prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, nextArmed).apply()
    if (!nextArmed && activeOneBattleDvrRecording) {
        abortOneBattleDvrAsync(disarm = true)
        showBattleToast("⏹️ 1-Battle DVR Disarmed & Stopped")
    } else if (nextArmed) {
        showBattleToast("🔴 Armed 1-Battle Full-Screen DVR + Deep Trace (Auto-uploads after match)")
    } else {
        showBattleToast("⚪ 1-Battle DVR Disarmed")
    }
    recalculateAndPushBattleData()
}

internal fun OverlayService.recordOneBattleDvrFrameAndTraceAsync(screen: Bitmap, nowMs: Long) {
    val handler = dvrHandler ?: return
    if (screen.isRecycled) return
    val targetW = 544
    val targetH = (((screen.height.toFloat() / screen.width.toFloat()) * targetW.toFloat()).toInt() / 16 * 16).coerceIn(640, 1440)
    val scaledBmp = try {
        Bitmap.createScaledBitmap(screen, targetW, targetH, true)
    } catch (_: Exception) {
        null
    } ?: return

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
        recommendedGoal = lastRecommendedGoal
    )

    handler.post {
        try {
            if (!activeOneBattleDvrArmed) {
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
                val canvas = surf.lockCanvas(null)
                try {
                    canvas.drawBitmap(scaledBmp, 0f, 0f, null)
                    val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = Color.argb(210, 9, 13, 22)
                        style = Paint.Style.FILL
                    }
                    val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = Color.argb(220, 56, 189, 248)
                        style = Paint.Style.STROKE
                        strokeWidth = 1.5f
                    }
                    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = Color.WHITE
                        textSize = 13.5f
                        typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                    }
                    val stamp = String.format(
                        java.util.Locale.US,
                        "F#%04d T+%05.2fs U:%d%%(%d%%)/%dE O:%d%%(%d%%)/%dE",
                        finalTrace.frameIdx,
                        finalTrace.battleElapsedMs / 1000.0,
                        finalTrace.committedUserHpPct,
                        finalTrace.rawUserHpPct,
                        finalTrace.userEnergy,
                        finalTrace.committedOppHpPct,
                        finalTrace.rawOppHpPct,
                        finalTrace.oppEnergy
                    )
                    val bannerRect = RectF(6f, 4f, targetW - 6f, 26f)
                    canvas.drawRoundRect(bannerRect, 5f, 5f, bgPaint)
                    canvas.drawRoundRect(bannerRect, 5f, 5f, borderPaint)
                    canvas.drawText(stamp, 12f, 19.5f, textPaint)
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

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, 700_000)
            setInteger(MediaFormat.KEY_FRAME_RATE, 10)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 2)
        }
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
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
    summaryRecord: AiTelemetryBattleRecordV510
) {
    activeOneBattleDvrArmed = false
    if (isPrefsInitialized) {
        prefs.edit().putBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, false).apply()
    }
    val handler = dvrHandler ?: return
    handler.post {
        try {
            drainDvrEncoderLocked(endOfStream = true)
        } catch (_: Exception) {}
        val rawMp4 = dvrMp4File
        val rawTrace = dvrTraceFile
        releaseDvrResourcesLocked(deleteFiles = false)
        if (rawMp4 == null && rawTrace == null) return@post

        val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val finalMp4 = File(cacheDir, "${cleanId}_video.mp4")
        val finalTrace = File(cacheDir, "${cleanId}_deep_trace.jsonl")
        try {
            if (rawMp4 != null && rawMp4.exists()) rawMp4.renameTo(finalMp4)
            if (rawTrace != null && rawTrace.exists()) rawTrace.renameTo(finalTrace)
        } catch (_: Exception) {}

        Handler(Looper.getMainLooper()).post {
            recalculateAndPushBattleData()
            showBattleToast("🎥 Uploading 1-Battle Video & Deep Log to GitHub...")
        }

        lifecycleScope.launch(Dispatchers.IO) {
            val (dvrOk, dvrMsg) = OverlayService.uploadBattleDvrBundleToGitHubBlocking(
                prefs = prefs,
                gson = gson,
                battleId = battleId,
                summaryRecord = summaryRecord,
                mp4File = finalMp4,
                traceFile = finalTrace
            )
            try {
                OverlayService.uploadPendingAiTelemetryBatchBlocking(
                    prefs = prefs,
                    gson = gson,
                    forceUpload = true,
                    minBattlesRequired = 1
                )
            } catch (_: Exception) {}
            withContext(Dispatchers.Main) {
                showBattleToast(dvrMsg, if (dvrOk) Toast.LENGTH_LONG else Toast.LENGTH_SHORT)
            }
        }
    }
}
