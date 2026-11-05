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
import com.gbl.overlay.OverlayService.Companion.FormResolver

// =============================================================================
// PixelScannerEngine.kt - 10Hz Real-Time Pixel & Computer Vision Scanners
// (Pokeballs, Shields, Charge Circles, Prescan Calibration, Floating HP Bars)
// =============================================================================

internal fun OverlayService.createHighContrastWhiteTextBitmap(source: Bitmap, crop: Rect): Bitmap? {
    return try {
        val cw = crop.width().coerceAtLeast(1)
        val ch = crop.height().coerceAtLeast(1)
        val pixels = IntArray(cw * ch)
        source.getPixels(pixels, 0, cw, crop.left, crop.top, cw, ch)
        for (i in pixels.indices) {
            val c = pixels[i]
            val r = (c shr 16) and 0xFF
            val g = (c shr 8) and 0xFF
            val b = c and 0xFF
            val maxCh = max(r, max(g, b))
            val minCh = min(r, min(g, b))
            // Pure white nameplate text has high luminance and low saturation
            val isWhiteGlyph = r >= 188 && g >= 188 && b >= 188 && (maxCh - minCh) <= 42
            pixels[i] = if (isWhiteGlyph) Color.BLACK else Color.WHITE
        }
        Bitmap.createBitmap(pixels, cw, ch, Bitmap.Config.ARGB_8888)
    } catch (_: Exception) {
        null
    }
}

/**
 * Interpolates T_swap midway between the last frame where the old Pokémon was seen
 * and the first frame where the new Pokémon is seen (with fallback to prevFrameTimestampMs).
 */
internal fun OverlayService.getMidpointSwapStartTimeMs(lastOldPokemonFrameMs: Long, firstNewPokemonFrameMs: Long = currentFrameTimestampMs): Long {
    if (lastOldPokemonFrameMs > 0L && firstNewPokemonFrameMs > lastOldPokemonFrameMs && (firstNewPokemonFrameMs - lastOldPokemonFrameMs) <= 8000L) {
        return (lastOldPokemonFrameMs + firstNewPokemonFrameMs) / 2L
    }
    return getInterpolatedSwapStartTimeMs()
}

internal fun OverlayService.getInterpolatedSwapStartTimeMs(): Long {
    return if (prevFrameTimestampMs > 0L && currentFrameTimestampMs > prevFrameTimestampMs) {
        (prevFrameTimestampMs + currentFrameTimestampMs) / 2L
    } else {
        currentFrameTimestampMs
    }
}

/**
 * Detects active (unfainted) Pokéball count (1..3, or -1 if HUD is hidden/occluded) from the Pokéball sub-ROI.
 * Calibrated against real 1080x2342 GBL screenshots:
 * - Each single Pokéball icon is ~35-37px wide (0.033w) with a ~23-24px white gap (0.021w) between balls.
 * - Live Pokéballs have a scarlet-red upper half (R>=150, G<=108, B<=108).
 * - Fainted Pokéballs are dark charcoal-grey circles (R in 50..140, G in 35..118, B in 40..118) on the white card.
 * - Cross-verifies red live balls + grey fainted balls so 1 or 2 live balls are confirmed immediately on the first frame
 *   while partial HUD occlusions (where greyBalls == 0) return -1 instead of false-fainting.
 */
internal fun OverlayService.detectActivePokeballCount(screen: Bitmap, searchRect: Rect): Int {
    return try {
        val left = searchRect.left.coerceIn(0, screen.width - 1)
        val right = searchRect.right.coerceIn(0, screen.width)
        val top = searchRect.top.coerceIn(0, screen.height - 1)
        val bottom = searchRect.bottom.coerceIn(0, screen.height)
        val cw = right - left
        val ch = bottom - top
        if (cw <= 4 || ch <= 4) return -1

        val pixels = IntArray(cw * ch)
        screen.getPixels(pixels, 0, cw, left, top, cw, ch)

        val rowRedCount = IntArray(ch)
        for (ry in 0 until ch) {
            val rowOffset = ry * cw
            var count = 0
            for (rx in 0 until cw) {
                val pixel = pixels[rowOffset + rx]
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                if (r >= 145 && g <= 112 && b <= 112 && (r - max(g, b)) >= 45 && (r - b) >= 50) {
                    count++
                }
            }
            rowRedCount[ry] = count
        }

        // Lock onto the horizontal row-band containing the circular Pokéball icons
        val bandRadiusY = (screen.height * 0.0045f).toInt().coerceIn(5, 11)
        var bestRy = -1
        var maxBandRed = 0
        for (ry in 0 until ch) {
            val y0 = (ry - bandRadiusY).coerceAtLeast(0)
            val y1 = (ry + bandRadiusY).coerceAtMost(ch - 1)
            var sum = 0
            for (yy in y0..y1) sum += rowRedCount[yy]
            if (sum > maxBandRed) {
                maxBandRed = sum
                bestRy = ry
            }
        }

        // If HUD is hidden during Charged Move camera zoom or switch animation, return 0 (missing overlay)
        if (bestRy < 0 || maxBandRed < 12) return 0

        val yStart = (bestRy - bandRadiusY).coerceAtLeast(0)
        val yEnd = (bestRy + bandRadiusY).coerceAtMost(ch - 1)
        val colRed = IntArray(cw)
        val colGrey = IntArray(cw)
        var whiteCardCols = 0
        for (rx in 0 until cw) {
            var cr = 0
            var cg = 0
            var cwPx = 0
            for (ry in yStart..yEnd) {
                val pixel = pixels[ry * cw + rx]
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                val maxCh = max(r, max(g, b))
                val minCh = min(r, min(g, b))
                val luma = (r + g + b) / 3
                if (r >= 145 && g <= 112 && b <= 112 && (r - max(g, b)) >= 45 && (r - b) >= 50) {
                    cr++
                } else if (luma in 42..168 && maxCh <= 176 && minCh >= 28 && (maxCh - minCh) <= 48) {
                    // Fainted Pokéball grey circle (supports both dark stadium shadow and bright sky-blended opponent HUD)
                    cg++
                } else if (r >= 190 && g >= 190 && b >= 190 && (maxCh - minCh) <= 38) {
                    cwPx++
                }
            }
            colRed[rx] = cr
            colGrey[rx] = cg
            if (cwPx >= 2) whiteCardCols++
        }

        // Each Pokéball on 1080p is 35-37px wide (0.033w) with a 23-24px gap (0.021w) between balls.
        val maxEdgeGap = (screen.width * 0.003f).toInt().coerceIn(2, 4)
        val minLobeWidth = (screen.width * 0.012f).toInt().coerceAtLeast(8)
        val maxLobeWidth = (screen.width * 0.160f).toInt().coerceAtLeast(50)
        val twoBallLobeThreshold = (screen.width * 0.065f).toInt().coerceAtLeast(55)
        val threeBallLobeThreshold = (screen.width * 0.115f).toInt().coerceAtLeast(105)

        fun countBallLobes(colArr: IntArray, minColHeight: Int, minArea: Int): Int {
            var count = 0
            var inLobe = false
            var lobeStart = 0
            var lobeEnd = 0
            var lobeArea = 0
            var gapCols = 0
            for (rx in 0 until cw) {
                if (colArr[rx] >= minColHeight) {
                    if (!inLobe) {
                        inLobe = true
                        lobeStart = rx
                        lobeEnd = rx
                        lobeArea = colArr[rx]
                    } else {
                        lobeEnd = rx
                        lobeArea += colArr[rx]
                    }
                    gapCols = 0
                } else if (inLobe) {
                    gapCols++
                    if (gapCols > maxEdgeGap) {
                        val wLobe = lobeEnd - lobeStart + 1
                        if (wLobe in minLobeWidth..maxLobeWidth && lobeArea >= minArea) {
                            count += when {
                                wLobe >= threeBallLobeThreshold -> 3
                                wLobe >= twoBallLobeThreshold -> 2
                                else -> 1
                            }
                        }
                        inLobe = false
                        gapCols = 0
                    }
                }
            }
            if (inLobe) {
                val wLobe = lobeEnd - lobeStart + 1
                if (wLobe in minLobeWidth..maxLobeWidth && lobeArea >= minArea) {
                    count += when {
                        wLobe >= threeBallLobeThreshold -> 3
                        wLobe >= twoBallLobeThreshold -> 2
                        else -> 1
                    }
                }
            }
            return count
        }

        val redBalls = countBallLobes(colRed, minColHeight = 2, minArea = 12).coerceIn(0, 3)
        val greyBalls = countBallLobes(colGrey, minColHeight = 2, minArea = 14).coerceIn(0, 2)

        when {
            redBalls == 3 -> 3
            redBalls in 1..2 && (greyBalls >= 1 || (whiteCardCols >= minLobeWidth && maxBandRed >= 22)) -> redBalls
            else -> 0
        }
    } catch (_: Exception) {
        0
    }
}

/**
 * Detects active shield count (0, 1, 2, or -1 if occluded) from the hexagonal shield sub-ROI.
 * Active shields have a distinctive lavender/pink/magenta hue profile (R>=160, B>=160, G<=210, B-G>=28, R-G>=18).
 */
internal fun OverlayService.detectActiveShieldCount(screen: Bitmap, searchRect: Rect): Int {
    return try {
        val left = searchRect.left.coerceIn(0, screen.width - 1)
        val right = searchRect.right.coerceIn(0, screen.width)
        val top = searchRect.top.coerceIn(0, screen.height - 1)
        val bottom = searchRect.bottom.coerceIn(0, screen.height)
        val cw = right - left
        val ch = bottom - top
        if (cw <= 4 || ch <= 4) return -1

        val pixels = IntArray(cw * ch)
        screen.getPixels(pixels, 0, cw, left, top, cw, ch)

        val rowPinkCount = IntArray(ch)
        for (ry in 0 until ch) {
            val rowOffset = ry * cw
            var count = 0
            for (rx in 0 until cw) {
                val pixel = pixels[rowOffset + rx]
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                if (r >= 160 && b >= 160 && g <= 210 && (b - g) >= 28 && (r - g) >= 18 && kotlin.math.abs(r - b) <= 65) {
                    count++
                }
            }
            rowPinkCount[ry] = count
        }

        val bandRadiusY = (screen.height * 0.005f).toInt().coerceIn(5, 12)
        var bestRy = -1
        var maxBandPink = 0
        for (ry in 0 until ch) {
            val y0 = (ry - bandRadiusY).coerceAtLeast(0)
            val y1 = (ry + bandRadiusY).coerceAtMost(ch - 1)
            var sum = 0
            for (yy in y0..y1) sum += rowPinkCount[yy]
            if (sum > maxBandPink) {
                maxBandPink = sum
                bestRy = ry
            }
        }

        if (bestRy < 0 || maxBandPink < 8) return 0

        val yStart = (bestRy - bandRadiusY).coerceAtLeast(0)
        val yEnd = (bestRy + bandRadiusY).coerceAtMost(ch - 1)
        val colPink = IntArray(cw)
        for (rx in 0 until cw) {
            var c = 0
            for (ry in yStart..yEnd) {
                val pixel = pixels[ry * cw + rx]
                val r = (pixel shr 16) and 0xFF
                val g = (pixel shr 8) and 0xFF
                val b = pixel and 0xFF
                if (r >= 160 && b >= 160 && g <= 210 && (b - g) >= 28 && (r - g) >= 18 && kotlin.math.abs(r - b) <= 65) {
                    c++
                }
            }
            colPink[rx] = c
        }

        val maxEdgeGap = (screen.width * 0.003f).toInt().coerceIn(2, 4)
        val minLobeWidth = (screen.width * 0.012f).toInt().coerceAtLeast(8)
        val twoShieldWidth = (screen.width * 0.052f).toInt().coerceAtLeast(50)
        var shieldCount = 0
        var inLobe = false
        var lobeStart = 0
        var lobeEnd = 0
        var lobeArea = 0
        var gapCols = 0

        for (rx in 0 until cw) {
            if (colPink[rx] >= 2) {
                if (!inLobe) {
                    inLobe = true
                    lobeStart = rx
                    lobeEnd = rx
                    lobeArea = colPink[rx]
                } else {
                    lobeEnd = rx
                    lobeArea += colPink[rx]
                }
                gapCols = 0
            } else if (inLobe) {
                gapCols++
                if (gapCols > maxEdgeGap) {
                    val wLobe = lobeEnd - lobeStart + 1
                    if (wLobe >= minLobeWidth && lobeArea >= 10) {
                        shieldCount += if (wLobe >= twoShieldWidth) 2 else 1
                    }
                    inLobe = false
                    gapCols = 0
                }
            }
        }
        if (inLobe) {
            val wLobe = lobeEnd - lobeStart + 1
            if (wLobe >= minLobeWidth && lobeArea >= 10) {
                shieldCount += if (wLobe >= twoShieldWidth) 2 else 1
            }
        }

        shieldCount.coerceIn(0, 2)
    } catch (_: Exception) {
        2
    }
}

/**
 * v3.42: Left-Edge-Anchored, Overlay-Alpha-Aware 2D Floating HP Bar Capsule Scanner.
 * Calibrated frame-by-frame against 1080x2342 & 960x2142 Pokémon GO GBL combat footage:
 * - Opponent HP Bar left edge anchors at [0.500 * screenW, 0.635 * screenW] and Y ∈ [0.18h, 0.48h]
 *   (covering both standard right-anchored bars and wide/floating species like Magnezone at 0.514w).
 * - Player HP Bar left edge anchors at [0.048 * screenW, 0.115 * screenW] and Y ∈ [0.46h, 0.69h].
 * - Single-Pokémon charged-attack camera zooms move the bar to center (xStart ≈ 0.361w), so left-edge anchor
 *   validation automatically rejects all charged-attack camera cuts with 0% false positives!
 * - Full 100%-HP interior bar width is fixed at W_full = 0.278 * screenW (300px on 1080p, 267px on 960p) for all species.
 * - Supports both unobstructed AND semi-transparent-overlay-occluded HP fill colors:
 *   • Spring-Mint Green (>50% HP): bright RGB(28, 254, 187) & overlay-dimmed RGB(13..35, 95..194, 75..170)
 *   • Golden Yellow (20..50% HP): bright RGB(251, 224, 45) & overlay-dimmed RGB(105..199, 92..185, 25..68)
 *   • Coral Red (<20% HP): bright RGB(237, 101, 98) & overlay-dimmed RGB(165..199, 65..110, 50..95)
 * - v3.43: Validates the full 4-sided outer border rectangle (left vertical border, right vertical border at
 *   0.274w..0.296w, top horizontal border line, and bottom horizontal border line) and computes the 100%-HP
 *   interior width directly from the detected outer border rectangle (outerWidth - padInset) for zero bias error.
 * Returns 1..100 (or -1 if no valid floating HP bar capsule is visible in the anchor corridor).
 */
/**
 * v3.67: Type-Agnostic Bottom Charge Move Energy Button Fill Scanner (Left, Right & Single-Move Center).
 * Calibrated frame-by-frame against 1080x2342 Pokémon GO GBL combat footage:
 * - Left Button Center: (0.3083 * w, 0.8932 * h); Right Button Center: (0.6898 * w, 0.8932 * h);
 *   Single-Move Center Fallback: (0.5000 * w, 0.8932 * h); Outer Radius R = 0.0806 * w (87px on 1080p).
 * - Samples left and right outer flanks (avoiding the central white move-type icon of radius ~0.0389 * w)
 *   to locate the horizontal energy fill meniscus across all 18 Pokémon move typings (Dragon blue, Electric yellow,
 *   Steel silver/teal, Fire red/orange, Grass green, Dark, Ghost, Fairy pink, etc.).
 * - Supports both the primary fill layer (1..100%) against the dark-gray unfilled top background AND the darker-shade
 *   overcharge layer (101..200%) that starts over from the bottom once a charge move button reaches 100% full.
 */
/**
 * v3.81: Adaptive 3-2-1-GO Prescan Circle Calibrator + Multi-Device Charge Move Button Fill Scanner.
 * - During the 3-2-1-GO prescan (when buttons are at 0% empty energy), dynamically locates each Charge Move Circle's
 *   center `(cx, cy)`, interior vertical bounds `(yTop, yBot)`, and unfilled dark-circle flank color baseline
 *   (`prescanEmptyLuma`, `prescanEmptySat`) so different devices/aspect ratios (e.g. 1080x2342 vs 960x2142) never
 *   sample outside the circle interior.
 * - Checks an 8-direction radial perimeter band (`rFrac ∈ [1.03, 1.24]`) for Pokémon GO's bright white 100% ready ring
 *   (`luma >= 210, sat <= 42`), locking `fillPct >= 100` whenever >= 5 perimeter arcs glow white and the top interior cap is lit.
 */
/**
 * v3.87: Rejects pre-battle full-screen white transition flashes so circle calibration
 * and energy scanning never trigger on an unstable white screen.
 */
internal fun OverlayService.isWhiteScreenFlash(screen: Bitmap, w: Int, h: Int): Boolean {
    return try {
        val samplePts = arrayOf(
            Pair(0.55f, 0.25f), Pair(0.80f, 0.25f),
            Pair(0.25f, 0.55f), Pair(0.50f, 0.55f), Pair(0.75f, 0.55f),
            Pair(0.25f, 0.72f), Pair(0.50f, 0.72f), Pair(0.75f, 0.72f),
            Pair(0.15f, 0.88f), Pair(0.50f, 0.88f), Pair(0.85f, 0.88f),
            Pair(0.50f, 0.95f)
        )
        var whitePts = 0
        for ((fx, fy) in samplePts) {
            val px = (w * fx).toInt().coerceIn(0, w - 1)
            val py = (h * fy).toInt().coerceIn(0, h - 1)
            val c = screen.getPixel(px, py)
            val r = Color.red(c)
            val g = Color.green(c)
            val b = Color.blue(c)
            val luma = 0.299 * r + 0.587 * g + 0.114 * b
            val sat = max(r, max(g, b)) - min(r, min(g, b))
            if (luma >= 210.0 && sat <= 28) {
                whitePts++
            }
        }
        whitePts >= 8
    } catch (_: Exception) {
        false
    }
}

internal fun OverlayService.detectChargedMoveButtonFillLevels(screen: Bitmap, w: Int, h: Int) {
    // v4.06 / v4.09: Whenever the top 5-second countdown circle OR "Attack incoming!" prompt is active on screen,
    // Pokémon GO hides the bottom combat charge circles completely.
    // Force -1 immediately so neither "NOT NOW" text nor a Pokémon's legs at (0.3095w, 0.8930h) can false-trigger a circle
    // and wipe out cachedOcrPlayerMoveLines during the 5s shield countdown!
    val nowCheckMs = System.currentTimeMillis()
    val isOpponentPromptSuppressingBottomCircles = (isAttackIncomingPromptActive ||
        (lastAttackIncomingOcrDetectedMs > 0L && (nowCheckMs - lastAttackIncomingOcrDetectedMs) <= 2800L)) &&
        !sampledTopRightNameplateVisible
    if (w < 200 || h < 400 || sampledTopCountdownCircleVisible || isTopCountdownCircleActive || isOpponentPromptSuppressingBottomCircles || isWhiteScreenFlash(screen, w, h)) {
        sampledLeftChargeBtnFillPct = -1
        sampledRightChargeBtnFillPct = -1
        isCountdownDimmedState = false
        return
    }

    // v3.87: Run 6-cycle 3-2-1-GO dark-grey border circle calibration while waiting for battle start or at 0E
    val activeUserIdx = (currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
    if (!prescanCircleCalibrated || isWaitingForOpponent || !hasBattleStarted || playerSlotEnergy[activeUserIdx] == 0) {
        tryPrescanCalibrateChargeCircles(screen, w, h)
    } else {
        isCountdownDimmedState = false
    }

    if (isCountdownDimmedState) {
        // Hold strictly at 0% / 0E while the 3-2-1 dimmed dark-grey countdown state is active on screen
        sampledLeftChargeBtnFillPct = 0
        sampledRightChargeBtnFillPct = 0
        return
    }

    val userSlotCfg = currentPreset?.pokemon?.getOrNull(activeUserIdx)
    val userMonName = activeUserPokemonName ?: userSlotCfg?.name ?: "Dialga (Origin)"
    val userMeta = getPokemonMeta(userMonName, currentPreset?.league ?: "MASTER LEAGUE", userMonName.contains("Shadow", ignoreCase = true))
    val fallbackType = userMeta.types.firstOrNull() ?: "normal"
    val m1Name = userSlotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
    val m2Name = userSlotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2
    val m1Type = OverlayService.resolveChargedMoveStatsStatic(m1Name, fallbackType).type.trim().lowercase()
    val m2Type = OverlayService.resolveChargedMoveStatsStatic(m2Name, fallbackType).type.trim().lowercase()
    val allowLeftSilver = m1Type == "normal" || m1Type == "steel" || m1Type == "rock"
    val allowRightSilver = m2Type == "normal" || m2Type == "steel" || m2Type == "rock"

    val cy = (h * calibratedCyFrac).toInt()
    val leftCx = (w * calibratedLeftCxFrac).toInt()
    val rightCx = (w * calibratedRightCxFrac).toInt()
    var leftFill = detectSingleChargeButtonFillPct(
        screen = screen,
        cx = leftCx,
        cy = cy,
        w = w,
        h = h,
        emptyBaseLuma = prescanEmptyLumaLeft,
        emptyBaseSat = prescanEmptySatLeft,
        btnSlotKey = activeUserIdx * 2,
        allowSilverLiquid = allowLeftSilver
    )
    val rightFill = detectSingleChargeButtonFillPct(
        screen = screen,
        cx = rightCx,
        cy = cy,
        w = w,
        h = h,
        emptyBaseLuma = prescanEmptyLumaRight,
        emptyBaseSat = prescanEmptySatRight,
        btnSlotKey = activeUserIdx * 2 + 1,
        allowSilverLiquid = allowRightSilver
    )
    val hasSecondMoveConfigured = !userSlotCfg?.chargedMove2.isNullOrBlank() &&
        !userSlotCfg?.chargedMove2.equals(userSlotCfg?.chargedMove1, ignoreCase = true)
    if (!hasSecondMoveConfigured && leftFill == -1 && rightFill == -1) {
        // Fallback ONLY for single-charged-move Pokémon where the button is centered at x ≈ 0.50w
        leftFill = detectSingleChargeButtonFillPct(
            screen = screen,
            cx = (w * calibratedSingleCxFrac).toInt(),
            cy = cy,
            w = w,
            h = h,
            emptyBaseLuma = prescanEmptyLumaLeft,
            emptyBaseSat = prescanEmptySatLeft,
            btnSlotKey = activeUserIdx * 2,
            allowSilverLiquid = allowLeftSilver
        )
    }
    sampledLeftChargeBtnFillPct = leftFill
    sampledRightChargeBtnFillPct = rightFill
}

/**
 * v3.87: 6-Cycle Multi-Frame Dark-Grey Border Circle Calibrator during 3-2-1-GO.
 * - Detects the dark grey perimeter ring (`rBorderIn = 0.0735w` vs `rBorderOut = 0.0850w`) around empty 0% circles
 *   during both the dimmed 3-2-1 countdown (`peakIconLuma in 48..125`) and un-dimmed 0E state (`peakIconLuma >= 125`).
 * - Averages circle center `(cx, cy)`, vertical bounds `(yTop, yBot)`, and empty interior baseline (`prescanEmptyLuma`, `prescanEmptySat`)
 *   over 6 stable cycles (~600ms) for maximum countdown filtering.
 */
internal fun OverlayService.tryPrescanCalibrateChargeCircles(screen: Bitmap, w: Int, h: Int) {
    try {
        val step = (h / 1000).coerceAtLeast(2)
        val nominalCy = (h * 0.8930f).toInt()
        val flankDx = (w * 0.050f).toInt().coerceAtLeast(14)

        data class CirclePrescanProbe(
            val cx: Int,
            val cy: Int,
            val yTop: Int,
            val yBot: Int,
            val emptyLuma: Double,
            val emptySat: Double,
            val isDimmedCountdown: Boolean
        )

        fun probeEmptyCircleAt(nomCx: Int): CirclePrescanProbe? {
            val rx = (w * 0.022f).toInt().coerceAtLeast(8)
            val ry = (h * 0.015f).toInt().coerceAtLeast(10)
            var peakIconLuma = 0.0
            var py = (nominalCy - ry).coerceAtLeast(10)
            val pyMax = (nominalCy + ry).coerceAtMost(h - 10)
            while (py <= pyMax) {
                var px = (nomCx - rx).coerceAtLeast(10)
                val pxMax = (nomCx + rx).coerceAtMost(w - 10)
                while (px <= pxMax) {
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    val luma = 0.299 * r + 0.587 * g + 0.114 * b
                    val sat = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    if (sat <= 65.0 && luma > peakIconLuma) {
                        peakIconLuma = luma
                    }
                    px += step
                }
                py += step
            }
            if (peakIconLuma < 48.0) return null

            val iconThresh = max(44.0, peakIconLuma - max(8.0, peakIconLuma * 0.18))
            var weightedX = 0.0
            var weightedY = 0.0
            var weightSum = 0.0
            py = (nominalCy - ry).coerceAtLeast(10)
            while (py <= pyMax) {
                var px = (nomCx - rx).coerceAtLeast(10)
                val pxMax = (nomCx + rx).coerceAtMost(w - 10)
                while (px <= pxMax) {
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    val luma = 0.299 * r + 0.587 * g + 0.114 * b
                    val sat = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    if (luma >= iconThresh && sat <= 65.0) {
                        val wgt = luma - iconThresh + 2.0
                        weightedX += px * wgt
                        weightedY += py * wgt
                        weightSum += wgt
                    }
                    px += step
                }
                py += step
            }
            if (weightSum <= 0.0) return null
            val foundCx = (((weightedX / weightSum) * 0.55) + (nomCx * 0.45)).roundToInt()
            val rawIconCy = (weightedY / weightSum).roundToInt()
            val seedCy = ((rawIconCy * 0.45) + (nominalCy * 0.55)).roundToInt().coerceIn((h * 0.880f).toInt(), (h * 0.908f).toInt())

            // 2. Sample upper & mid outer annulus flanks to verify uniform 0% dark-gray circle interior
            val flankSamplesLuma = ArrayList<Double>(16)
            val flankSamplesSat = ArrayList<Double>(16)
            val dyCheck = (h * 0.012f).toInt().coerceAtLeast(6)
            for (dy in intArrayOf(-dyCheck * 2, -dyCheck, 0, dyCheck)) {
                val sy = (seedCy + dy).coerceIn(10, h - 10)
                for (dx in intArrayOf(-(flankDx + step * 2), -flankDx, flankDx, flankDx + step * 2)) {
                    val sx = (foundCx + dx).coerceIn(10, w - 10)
                    val c = screen.getPixel(sx, sy)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    val l = 0.299 * r + 0.587 * g + 0.114 * b
                    val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    flankSamplesLuma.add(l)
                    flankSamplesSat.add(s)
                }
            }
            flankSamplesLuma.sort()
            flankSamplesSat.sort()
            val medLuma = flankSamplesLuma[flankSamplesLuma.size / 2]
            val medSat = flankSamplesSat[flankSamplesSat.size / 2]
            val iqrLuma = flankSamplesLuma[(flankSamplesLuma.size * 0.80).toInt()] - flankSamplesLuma[(flankSamplesLuma.size * 0.20).toInt()]
            if (medLuma !in 24.0..88.0 || medSat > 32.0 || iqrLuma > 22.0) return null
            if (peakIconLuma < medLuma + 6.0) return null

            // 3. Verify the Dark Grey Circular Border around the 7 upper/side perimeter arcs
            val rBorderIn = w * 0.0735
            val rBorderOut = w * 0.0850
            val borderDirs = arrayOf(
                Pair(0.0, -1.0),
                Pair(-0.707, -0.707),
                Pair(0.707, -0.707),
                Pair(-1.0, 0.0),
                Pair(1.0, 0.0),
                Pair(-0.866, -0.50),
                Pair(0.866, -0.50)
            )
            var darkGreyBorderArcs = 0
            for ((ux, uy) in borderDirs) {
                val xIn = (foundCx + ux * rBorderIn).roundToInt().coerceIn(0, w - 1)
                val yIn = (seedCy + uy * rBorderIn).roundToInt().coerceIn(0, h - 1)
                val xOut = (foundCx + ux * rBorderOut).roundToInt().coerceIn(0, w - 1)
                val yOut = (seedCy + uy * rBorderOut).roundToInt().coerceIn(0, h - 1)
                val cIn = screen.getPixel(xIn, yIn)
                val cOut = screen.getPixel(xOut, yOut)
                val rIn = Color.red(cIn); val gIn = Color.green(cIn); val bIn = Color.blue(cIn)
                val rOut = Color.red(cOut); val gOut = Color.green(cOut); val bOut = Color.blue(cOut)
                val lIn = 0.299 * rIn + 0.587 * gIn + 0.114 * bIn
                val sIn = (max(rIn, max(gIn, bIn)) - min(rIn, min(gIn, bIn))).toDouble()
                val lOut = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut
                val rimContrast = kotlin.math.abs(lOut - lIn)
                if (lIn in 28.0..92.0 && sIn <= 32.0 && lOut < 185.0 && rimContrast >= 5.0) {
                    darkGreyBorderArcs++
                }
            }
            if (darkGreyBorderArcs < 5) return null

            val halfSpan = (w * 0.0750f).roundToInt().coerceIn((w * 0.070f).toInt(), (w * 0.082f).toInt())
            return CirclePrescanProbe(
                cx = foundCx,
                cy = seedCy,
                yTop = seedCy - halfSpan,
                yBot = seedCy + halfSpan,
                emptyLuma = medLuma,
                emptySat = medSat,
                isDimmedCountdown = peakIconLuma < 125.0
            )
        }

        val leftProbe = probeEmptyCircleAt((w * 0.3095f).toInt())
        val rightProbe = probeEmptyCircleAt((w * 0.6900f).toInt())
        val singleProbe = if (leftProbe == null && rightProbe == null) probeEmptyCircleAt((w * 0.5000f).toInt()) else null

        val primaryProbe = leftProbe ?: rightProbe ?: singleProbe
        if (primaryProbe == null) {
            isCountdownDimmedState = false
            return
        }

        isCountdownDimmedState = (leftProbe?.isDimmedCountdown == true) ||
            (rightProbe?.isDimmedCountdown == true) ||
            (singleProbe?.isDimmedCountdown == true)

        if (prescanCalibConfirmFrames < CALIBRATION_REQUIRED_CYCLES) {
            val combinedCy = if (leftProbe != null && rightProbe != null) {
                (leftProbe.cy + rightProbe.cy) / 2.0
            } else primaryProbe.cy.toDouble()
            val combinedYTop = if (leftProbe != null && rightProbe != null) {
                (leftProbe.yTop + rightProbe.yTop) / 2.0
            } else primaryProbe.yTop.toDouble()
            val combinedYBot = if (leftProbe != null && rightProbe != null) {
                (leftProbe.yBot + rightProbe.yBot) / 2.0
            } else primaryProbe.yBot.toDouble()

            prescanCalibConfirmFrames++
            prescanAccumCySum += combinedCy
            prescanAccumYTopSum += combinedYTop
            prescanAccumYBotSum += combinedYBot

            val avgCy = prescanAccumCySum / prescanCalibConfirmFrames
            val avgYTop = prescanAccumYTopSum / prescanCalibConfirmFrames
            val avgYBot = prescanAccumYBotSum / prescanCalibConfirmFrames

            calibratedCyFrac = (avgCy.toFloat() / h.toFloat()).coerceIn(0.880f, 0.908f)
            calibratedYTopFrac = (avgYTop.toFloat() / h.toFloat()).coerceIn(0.848f, 0.870f)
            calibratedYBotFrac = (avgYBot.toFloat() / h.toFloat()).coerceIn(0.916f, 0.940f)

            if (leftProbe != null) {
                prescanAccumLeftCount++
                prescanAccumLeftCxSum += leftProbe.cx
                prescanAccumEmptyLumaLeftSum += leftProbe.emptyLuma
                prescanAccumEmptySatLeftSum += leftProbe.emptySat
                calibratedLeftCxFrac = ((prescanAccumLeftCxSum / prescanAccumLeftCount).toFloat() / w.toFloat()).coerceIn(0.285f, 0.335f)
                prescanEmptyLumaLeft = prescanAccumEmptyLumaLeftSum / prescanAccumLeftCount
                prescanEmptySatLeft = prescanAccumEmptySatLeftSum / prescanAccumLeftCount
            }
            if (rightProbe != null) {
                prescanAccumRightCount++
                prescanAccumRightCxSum += rightProbe.cx
                prescanAccumEmptyLumaRightSum += rightProbe.emptyLuma
                prescanAccumEmptySatRightSum += rightProbe.emptySat
                calibratedRightCxFrac = ((prescanAccumRightCxSum / prescanAccumRightCount).toFloat() / w.toFloat()).coerceIn(0.665f, 0.715f)
                prescanEmptyLumaRight = prescanAccumEmptyLumaRightSum / prescanAccumRightCount
                prescanEmptySatRight = prescanAccumEmptySatRightSum / prescanAccumRightCount
            }
            if (singleProbe != null) {
                prescanAccumSingleCount++
                prescanAccumSingleCxSum += singleProbe.cx
                prescanAccumEmptyLumaLeftSum += singleProbe.emptyLuma
                prescanAccumEmptySatLeftSum += singleProbe.emptySat
                calibratedSingleCxFrac = ((prescanAccumSingleCxSum / prescanAccumSingleCount).toFloat() / w.toFloat()).coerceIn(0.475f, 0.525f)
                prescanEmptyLumaLeft = prescanAccumEmptyLumaLeftSum / prescanAccumSingleCount
                prescanEmptySatLeft = prescanAccumEmptySatLeftSum / prescanAccumSingleCount
            }

            if (prescanCalibConfirmFrames >= CALIBRATION_REQUIRED_CYCLES) {
                prescanCircleCalibrated = true
            }
        }
    } catch (_: Exception) {}
}

/**
 * v4.06: Detects the bright white top-right opponent nameplate box (`x ∈ [0.835w, 0.960w], y ∈ [0.058h, 0.092h]`).
 * In Pokémon GO PvP:
 * - During an opponent charged move 5-second countdown (both shielded and unshielded 0-shield), the top-right white
 *   opponent nameplate box and Pokéballs are completely HIDDEN (`false`).
 * - During the post-faint "Switch in a new Pokémon?" countdown, the top-right white opponent nameplate box and
 *   Pokéballs remain VISIBLE (`true`).
 */
internal fun OverlayService.detectTopRightOpponentNameplate(screen: Bitmap, w: Int, h: Int): Boolean {
    if (screen.isRecycled || w < 100 || h < 100) return false
    return try {
        val xFracs = floatArrayOf(0.840f, 0.870f, 0.900f, 0.930f, 0.955f)
        val yFracs = floatArrayOf(0.060f, 0.070f, 0.080f, 0.090f)
        var whitePlateHits = 0
        var rowsWithPlate = 0
        for (yf in yFracs) {
            val py = (h * yf).roundToInt().coerceIn(0, h - 1)
            var rowHits = 0
            for (xf in xFracs) {
                val px = (w * xf).roundToInt().coerceIn(0, w - 1)
                val c = screen.getPixel(px, py)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                val luma = 0.299 * r + 0.587 * g + 0.114 * b
                val sat = max(r, max(g, b)) - min(r, min(g, b))
                if (luma >= 204.0 && sat <= 26) {
                    whitePlateHits++
                    rowHits++
                }
            }
            if (rowHits >= 3) {
                rowsWithPlate++
            }
        }
        if (sampledOppBalls <= 0 && sampledPlayerBalls <= 0) {
            rowsWithPlate == 4 && whitePlateHits >= 17
        } else {
            rowsWithPlate >= 3 && whitePlateHits >= 12
        }
    } catch (_: Exception) {
        false
    }
}

/**
 * v4.06 / v4.11: Multi-Device 100ms (10 Hz) Radial Pixel Detector for Pokémon GO's Top-Center 5-Second Countdown Circle
 * (`cx = 0.500 * w`, `cyFrac ∈ [0.070..0.088] * h`, `R = 0.0833 * w` -> `cx = 540, cy = 192, R = 90px` on `1080x2342`
 * and `cx = 480, cy = 170, R = 80px` on `960x2142`).
 * Supports both nighttime stadiums (`innerL in 8..58`) and daytime blue-sky/cloud stadiums (`innerL in 58..128`),
 * as well as partial background occlusion behind the translucent inner disk (e.g. Xerneas's glowing antlers crossing
 * 3-5 radial spokes) whenever the bright white countdown digit (`5, 4, 3, 2, 1`) and outer ring ridge are present.
 */
internal fun OverlayService.detectTopCountdownCircle(screen: Bitmap, w: Int, h: Int): Boolean {
    if (screen.isRecycled || w < 100 || h < 100) return false
    return try {
        val cx = w * 0.500
        val radius = w * 0.0833
        val candidateCyFracs = doubleArrayOf(0.070, 0.073, 0.076, 0.078, 0.080, 0.082, 0.085, 0.088)

        for (cyFrac in candidateCyFracs) {
            val cy = h * cyFrac
            var validSpokes = 0
            var antlerOccludedSpokes = 0
            var upperSpokes = 0
            var brightArcSpokes = 0
            var pureWhiteArcSpokes = 0
            var innerLumaSum = 0.0
            var innerCount = 0

            for (i in 0 until 16) {
                val theta = (i * 22.5) * Math.PI / 180.0
                val ux = kotlin.math.cos(theta)
                val uy = kotlin.math.sin(theta)

                var innerL = 0.0
                var innerS = 0.0
                for (rMult in doubleArrayOf(0.44, 0.52, 0.60)) {
                    val px = (cx + ux * radius * rMult).roundToInt().coerceIn(0, w - 1)
                    val py = (cy + uy * radius * rMult).roundToInt().coerceIn(0, h - 1)
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    innerL += (0.299 * r + 0.587 * g + 0.114 * b) / 3.0
                    innerS += (max(r, max(g, b)) - min(r, min(g, b))) / 3.0
                }
                innerLumaSum += innerL
                innerCount++

                var ringPeakL = 0.0
                var ringPeakS = 999.0
                for (rMult in doubleArrayOf(0.72, 0.77, 0.81, 0.85)) {
                    val px = (cx + ux * radius * rMult).roundToInt().coerceIn(0, w - 1)
                    val py = (cy + uy * radius * rMult).roundToInt().coerceIn(0, h - 1)
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    val l = 0.299 * r + 0.587 * g + 0.114 * b
                    val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    if (s <= 56.0 && l > ringPeakL) {
                        ringPeakL = l
                        ringPeakS = s
                    }
                }

                var outerRimL = 0.0
                var outerRimS = 0.0
                for (rMult in doubleArrayOf(0.93, 0.98, 1.03)) {
                    val px = (cx + ux * radius * rMult).roundToInt().coerceIn(0, w - 1)
                    val py = (cy + uy * radius * rMult).roundToInt().coerceIn(0, h - 1)
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    outerRimL += (0.299 * r + 0.587 * g + 0.114 * b) / 3.0
                    outerRimS += (max(r, max(g, b)) - min(r, min(g, b))) / 3.0
                }

                // v4.11: Support both nighttime stadiums (`innerL in 8..58`) and daytime blue-sky/cloud stadiums (`innerL in 58..128`)
                val isNightSpoke = innerL in 8.0..58.0 && innerS <= 54.0 &&
                    outerRimL in 8.0..96.0 && outerRimS <= 64.0 &&
                    ringPeakL >= 34.0 && ringPeakS <= 46.0 &&
                    ringPeakL >= innerL + 12.0 && ringPeakL >= outerRimL + 10.0

                val isDaytimeOrTranslucentSpoke = innerL in 8.0..128.0 && innerS <= 110.0 &&
                    outerRimL in 8.0..165.0 && outerRimS <= 112.0 &&
                    ringPeakL >= 34.0 && ringPeakS <= 52.0 && (
                        (ringPeakL >= 205.0 && ringPeakS <= 22.0 && ringPeakL >= innerL + 45.0 && ringPeakL >= outerRimL + 35.0) ||
                            (ringPeakL >= 125.0 && ringPeakS <= 34.0 && innerL <= 115.0 && ringPeakL >= innerL + 18.0 && ringPeakL >= outerRimL + 6.0)
                        )

                if (isNightSpoke || isDaytimeOrTranslucentSpoke) {
                    validSpokes++
                    if (uy < -0.15) upperSpokes++
                    if (ringPeakL >= 78.0) brightArcSpokes++
                    if (ringPeakL >= 205.0 && ringPeakS <= 22.0) pureWhiteArcSpokes++
                } else if (innerL in 8.0..168.0 &&
                    innerS <= 118.0 &&
                    outerRimL in 8.0..168.0 &&
                    ringPeakL >= 42.0 &&
                    ringPeakS <= 52.0 &&
                    ((ringPeakL >= innerL + 9.0 && ringPeakL >= outerRimL + 8.0) ||
                        (ringPeakL >= 125.0 && ringPeakS <= 36.0))
                ) {
                    antlerOccludedSpokes++
                    if (ringPeakL >= 78.0) brightArcSpokes++
                    if (ringPeakL >= 205.0 && ringPeakS <= 22.0) pureWhiteArcSpokes++
                }
            }

            // Full 16-spoke match, upper-semicircle match, OR antler/cloud-occluded match (8+ valid spokes & 12+ total valid/occluded spokes)
            val passesSpokeGeometry = (validSpokes >= 11 && upperSpokes >= 5) ||
                (upperSpokes >= 6 && validSpokes >= 7) ||
                (validSpokes >= 8 && (validSpokes + antlerOccludedSpokes) >= 12 && brightArcSpokes >= 2)
            if (!passesSpokeGeometry || brightArcSpokes < 1) continue

            val avgInnerL = if (innerCount > 0) innerLumaSum / innerCount else 999.0
            // On daytime skies (`avgInnerL > 62.0`), require at least 2 pure-white remaining countdown arc spokes (`ringPeakL >= 205.0`)
            if (avgInnerL > 62.0 && pureWhiteArcSpokes < 2) continue

            val digitRx = (radius * 0.25).roundToInt().coerceAtLeast(6)
            val digitRy = (radius * 0.26).roundToInt().coerceAtLeast(6)
            val stepD = max(2, (w / 360))
            var centerBrightGlyphHits = 0
            var centerDarkBgHits = 0
            var centerTotal = 0
            var dy = -digitRy
            while (dy <= digitRy) {
                val py = (cy + dy).roundToInt().coerceIn(0, h - 1)
                var dx = -digitRx
                while (dx <= digitRx) {
                    val px = (cx + dx).roundToInt().coerceIn(0, w - 1)
                    val c = screen.getPixel(px, py)
                    val r = Color.red(c)
                    val g = Color.green(c)
                    val b = Color.blue(c)
                    val l = 0.299 * r + 0.587 * g + 0.114 * b
                    val s = max(r, max(g, b)) - min(r, min(g, b))
                    centerTotal++
                    val glyphMinL = if (avgInnerL > 62.0) 175.0 else 115.0
                    if (l >= glyphMinL && s <= 38 && l >= min(avgInnerL, 115.0) + 52.0) {
                        centerBrightGlyphHits++
                    } else if (l in 8.0..125.0 && s <= 110) {
                        centerDarkBgHits++
                    }
                    dx += stepD
                }
                dy += stepD
            }

            val hasCentralDigit = centerBrightGlyphHits >= 3 &&
                centerTotal > 0 &&
                centerDarkBgHits >= (centerTotal * 22) / 100
            val holdsActiveRingTransition = isTopCountdownCircleActive &&
                validSpokes >= 10 &&
                (validSpokes + antlerOccludedSpokes) >= 12 &&
                brightArcSpokes >= 1 &&
                centerDarkBgHits >= (centerTotal * 30) / 100

            if (hasCentralDigit || holdsActiveRingTransition) {
                return true
            }
        }
        false
    } catch (_: Exception) {
        false
    }
}

internal fun OverlayService.detectSingleChargeButtonFillPct(
    screen: Bitmap,
    cx: Int,
    cy: Int,
    w: Int,
    h: Int,
    emptyBaseLuma: Double = 52.0,
    emptyBaseSat: Double = 22.0,
    btnSlotKey: Int = -1,
    allowSilverLiquid: Boolean = false
): Int {
    return try {
        val stepY = (h / 1100).coerceAtLeast(2)
        val flankDx1 = (w * 0.0485f).toInt().coerceAtLeast(14)
        val flankDx2 = (w * 0.0565f).toInt().coerceAtLeast(18)
        val capDx = (w * 0.0185f).toInt().coerceAtLeast(6)

        var actualCx = cx
        var actualCy = cy
        var maxCenterIconLuma = 0.0
        val searchRx = (w * 0.016f).toInt().coerceAtLeast(6)
        val searchRy = (h * 0.012f).toInt().coerceAtLeast(8)
        var iconWx = 0.0
        var iconWy = 0.0
        var iconWSum = 0.0
        for (dy in -searchRy..searchRy step stepY) {
            val py = (cy + dy).coerceIn(0, h - 1)
            for (dx in -searchRx..searchRx step stepY) {
                val px = (cx + dx).coerceIn(0, w - 1)
                val c = screen.getPixel(px, py)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                val l = 0.299 * r + 0.587 * g + 0.114 * b
                val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                if (l > maxCenterIconLuma) maxCenterIconLuma = l
                if (!prescanCircleCalibrated && l >= 155.0 && s <= 65.0) {
                    val wgt = l - 140.0
                    iconWx += px * wgt
                    iconWy += py * wgt
                    iconWSum += wgt
                }
            }
        }
        if (maxCenterIconLuma < 48.0) {
            return -1
        }
        // v3.87 / v4.11: If the 3-2-1 start-of-battle countdown dimming curtain is active (maxCenterIconLuma < 125.0),
        // ONLY allow a 0% dark-grey circle match while waiting for battle start (`isWaitingForOpponent || !hasBattleStarted`).
        // During active combat (`!isWaitingForOpponent && hasBattleStarted`), a genuine visible Charge Move Button ALWAYS
        // has a bright white center type icon (`maxCenterIconLuma >= 125.0`). Returning 0 when `maxCenterIconLuma < 125.0`
        // during active combat caused the dark translucent "Attack incoming! Use a Protect Shield?" card over Metagross's
        // stadium line (`maxCenterIconLuma = 119.8`) or Xerneas's hind legs (`maxCenterIconLuma = 65.4..67.6`) to falsely
        // report `0%` visible circles instead of `-1` (hidden), blocking both bottom OCR and the Shield Decision Overlay!
        if (maxCenterIconLuma < 125.0) {
            if (!isWaitingForOpponent && hasBattleStarted) {
                return -1
            }
            val cL = screen.getPixel((actualCx - flankDx1).coerceIn(0, w - 1), actualCy.coerceIn(0, h - 1))
            val cR = screen.getPixel((actualCx + flankDx1).coerceIn(0, w - 1), actualCy.coerceIn(0, h - 1))
            val lL = 0.299 * Color.red(cL) + 0.587 * Color.green(cL) + 0.114 * Color.blue(cL)
            val sL = max(Color.red(cL), max(Color.green(cL), Color.blue(cL))) - min(Color.red(cL), min(Color.green(cL), Color.blue(cL)))
            val lR = 0.299 * Color.red(cR) + 0.587 * Color.green(cR) + 0.114 * Color.blue(cR)
            val sR = max(Color.red(cR), max(Color.green(cR), Color.blue(cR))) - min(Color.red(cR), min(Color.green(cR), Color.blue(cR)))
            return if (lL in 24.0..88.0 && sL <= 32 && lR in 24.0..88.0 && sR <= 32) 0 else -1
        }
        if (!prescanCircleCalibrated && iconWSum > 0.0) {
            actualCx = (((iconWx / iconWSum) * 0.50) + (cx * 0.50)).roundToInt()
            actualCy = (((iconWy / iconWSum) * 0.50) + (cy * 0.50)).roundToInt().coerceIn((h * 0.882f).toInt(), (h * 0.908f).toInt())
        }

        // Standard <100% un-enlarged circle radius (~0.0750 * w = 81px on 1080p)
        val defaultCircleRadPx = (w * 0.0750f).roundToInt().coerceIn((w * 0.070f).toInt(), (w * 0.082f).toInt())
        val halfSpanPx = if (prescanCircleCalibrated) {
            (((calibratedYBotFrac - calibratedYTopFrac) * 0.5f) * h).roundToInt().coerceIn((w * 0.070f).toInt(), (w * 0.082f).toInt())
        } else {
            defaultCircleRadPx
        }
        val yTop = (actualCy - halfSpanPx).coerceIn(8, h - 16)
        val yBot = (actualCy + halfSpanPx).coerceIn(yTop + 20, h - 8)
        val span = (yBot - yTop).coerceAtLeast(1)
        val radiusY = (span * 0.50).coerceAtLeast(10.0)
        val radiusPx = (w * calibratedRadiusWFrac).toDouble()
        val iconHalfH = (radiusY * 0.58).toInt().coerceAtLeast(16)

        // 1. v3.99 / v4.10 3-Ring Radial Perimeter Detector around `(actualCx, actualCy)`:
        //    - 1st Fill (`0..99%`): Dark-grey perimeter border (no white border).
        //    - 2nd Fill (`100..199%`): Main circle border filled in bright solid white (`rMult ∈ [0.98, 1.24]`), no second outer circle.
        //    - 3rd Fill (`200..300%`): Second concentric white/translucent circle outside the main circle (`rMult2 ∈ [1.35, 1.46]`)
        //      separated by a dark annular gap (`gMult ∈ [1.26, 1.32]`).
        val ringDirs = arrayOf(
            Pair(0.0, -1.0),       // Top
            Pair(0.0, 1.0),        // Bottom
            Pair(-1.0, 0.0),       // Left
            Pair(1.0, 0.0),        // Right
            Pair(-0.707, -0.707),  // Top-Left
            Pair(0.707, -0.707),   // Top-Right
            Pair(-0.707, 0.707),   // Bottom-Left
            Pair(0.707, 0.707)     // Bottom-Right
        )
        var whiteRingArcs = 0
        var upperWhiteRingArcs = 0
        var horizontalSideWhiteArcs = 0
        var outerSecondRingArcs = 0
        var upperOrSideOuterRingArcs = 0
        var exteriorWhiteArcs = 0
        for ((ux, uy) in ringDirs) {
            var arcHasWhite = false
            var rMult = 0.98
            while (rMult <= 1.24) {
                val rx = (actualCx + ux * radiusPx * rMult).roundToInt().coerceIn(0, w - 1)
                val ry = (actualCy + uy * radiusPx * rMult).roundToInt().coerceIn(0, h - 1)
                val c = screen.getPixel(rx, ry)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                val l = 0.299 * r + 0.587 * g + 0.114 * b
                val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                if (l >= 208.0 && s <= 42.0) {
                    arcHasWhite = true
                    break
                }
                rMult += 0.035
            }
            // Guard against full-screen white flash: check exterior well outside the 2nd outer ring (rMult = 1.54)
            val extX = (actualCx + ux * radiusPx * 1.54).roundToInt().coerceIn(0, w - 1)
            val extY = (actualCy + uy * radiusPx * 1.54).roundToInt().coerceIn(0, h - 1)
            val extC = screen.getPixel(extX, extY)
            val extR = Color.red(extC); val extG = Color.green(extC); val extB = Color.blue(extC)
            val extL = 0.299 * extR + 0.587 * extG + 0.114 * extB
            val extS = max(extR, max(extG, extB)) - min(extR, min(extG, extB))
            if (extL >= 210.0 && extS <= 28) {
                exteriorWhiteArcs++
            }
            if (arcHasWhite) {
                whiteRingArcs++
                if (uy < -0.5) {
                    upperWhiteRingArcs++
                }
                if (kotlin.math.abs(uy) < 0.1) {
                    horizontalSideWhiteArcs++
                }
                // Sample the dark annular gap between the main white circle border and the 2nd outer circle (rMult ∈ [1.26, 1.32])
                var gapL = 255.0
                for (gMult in doubleArrayOf(1.26, 1.29, 1.32)) {
                    val gx = (actualCx + ux * radiusPx * gMult).roundToInt().coerceIn(0, w - 1)
                    val gy = (actualCy + uy * radiusPx * gMult).roundToInt().coerceIn(0, h - 1)
                    val gc = screen.getPixel(gx, gy)
                    val gl = 0.299 * Color.red(gc) + 0.587 * Color.green(gc) + 0.114 * Color.blue(gc)
                    if (gl < gapL) gapL = gl
                }
                // Sample background just outside the 2nd outer circle (rMult ∈ [1.50, 1.54])
                var outBgL = 255.0
                for (oMult in doubleArrayOf(1.50, 1.54)) {
                    val ox = (actualCx + ux * radiusPx * oMult).roundToInt().coerceIn(0, w - 1)
                    val oyBg = (actualCy + uy * radiusPx * oMult).roundToInt().coerceIn(0, h - 1)
                    val oc = screen.getPixel(ox, oyBg)
                    val ol = 0.299 * Color.red(oc) + 0.587 * Color.green(oc) + 0.114 * Color.blue(oc)
                    if (ol < outBgL) outBgL = ol
                }
                // Check for the 2nd concentric outer circle at rMult2 ∈ [1.35, 1.46] (r ≈ 118..127px on 1080p)
                if (gapL <= 148.0) {
                    var rMult2 = 1.35
                    while (rMult2 <= 1.46) {
                        val rx2 = (actualCx + ux * radiusPx * rMult2).roundToInt().coerceIn(0, w - 1)
                        val ry2 = (actualCy + uy * radiusPx * rMult2).roundToInt().coerceIn(0, h - 1)
                        val c2 = screen.getPixel(rx2, ry2)
                        val r2 = Color.red(c2)
                        val g2 = Color.green(c2)
                        val b2 = Color.blue(c2)
                        val l2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2
                        val s2 = (max(r2, max(g2, b2)) - min(r2, min(g2, b2))).toDouble()
                        if (l2 >= 135.0 && s2 <= 42.0 && l2 >= gapL + 22.0 && l2 >= outBgL + 16.0) {
                            outerSecondRingArcs++
                            if (uy <= 0.1) {
                                upperOrSideOuterRingArcs++
                            }
                            break
                        }
                        rMult2 += 0.025
                    }
                }
            }
        }
        // Measure top interior cap to verify it is genuinely filled with liquid
        val topCheckYStart = (yTop + stepY * 2).coerceIn(4, h - 8)
        val topCheckYEnd = (yTop + stepY * 5).coerceIn(topCheckYStart + 1, h - 6)
        var topLumaSum = 0.0
        var topSatSum = 0.0
        var topCount = 0
        val topCapHalfDx = (halfSpanPx * 0.36).roundToInt().coerceAtLeast(capDx)
        var ty = topCheckYStart
        while (ty <= topCheckYEnd) {
            for (dx in intArrayOf(-topCapHalfDx, -capDx, 0, capDx, topCapHalfDx)) {
                val px = (actualCx + dx).coerceIn(0, w - 1)
                val c = screen.getPixel(px, ty)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                topLumaSum += 0.299 * r + 0.587 * g + 0.114 * b
                topSatSum += (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                topCount++
            }
            ty += stepY
        }
        val avgTopLuma = if (topCount > 0) topLumaSum / topCount else 0.0
        val avgTopSat = if (topCount > 0) topSatSum / topCount else 0.0

        // v4.06: Only treat exteriorWhiteArcs as a full-screen white flash when >= 7 of 8 exterior points are pure white
        // AND the interior top cap is also washed out in pure white (prevents Xerneas Geomancy floor spotlights outside the
        // circle perimeter from falsely aborting Giga Impact with -1!).
        if (exteriorWhiteArcs >= 7 && avgTopLuma >= 205.0 && avgTopSat <= 28.0) {
            return -1
        }

        // Enlarged Ready-Circle Interior Radius (`>= 100%` buttons expand to `readyHalfSpanPx ≈ 0.0835 * w = 90px` on 1080p)
        val readyHalfSpanPx = (w * 0.0835f).roundToInt().coerceIn((w * 0.078f).toInt(), (w * 0.089f).toInt())

        // v4.07: Interior Flank Spotlight-Wash Rejection & Normal-Type Opaque Silver-Grey Band Count:
        // During Xerneas's Geomancy animation, blinding pure-white floor spotlights (`luma = 215..255, sat = 0..12`)
        // expand directly underneath the semi-transparent Giga Impact / Moonblast circles.
        // Sample left and right flanks (`±flankDx1`) across 7 vertical bands (`20%..80%`):
        // - If >= 3 of the 14 flank points have spotlight-wash luma (`luma >= 204.0 && sat <= 26.0`), discard (`-1`)
        //   immediately so spotlight bleed never creates a false 91..100% meniscus or white-ring trigger!
        // - Count `cleanSilverBands` (`luma in 158.0..188.0 && sat <= 18.0`) to verify genuine 100% READY opaque
        //   Normal-type silver-grey buttons (`Giga Impact` at `>=100%` has `luma = 169..178, sat = 2..14` uniformly).
        var spotlightWashedBands = 0
        var cleanSilverBands = 0
        for (pctCheck in intArrayOf(20, 30, 40, 50, 60, 70, 80)) {
            val pyCheck = (yBot - (pctCheck * span) / 100.0).roundToInt().coerceIn(yTop + 4, yBot - 4)
            for (dxCheck in intArrayOf(-flankDx1, flankDx1)) {
                val pxCheck = (actualCx + dxCheck).coerceIn(0, w - 1)
                val cCheck = screen.getPixel(pxCheck, pyCheck)
                val rC = Color.red(cCheck); val gC = Color.green(cCheck); val bC = Color.blue(cCheck)
                val lC = 0.299 * rC + 0.587 * gC + 0.114 * bC
                val sC = (max(rC, max(gC, bC)) - min(rC, min(gC, bC))).toDouble()
                if (lC >= 204.0 && sC <= 26.0) {
                    spotlightWashedBands++
                } else if (lC in 158.0..188.0 && sC <= 18.0) {
                    cleanSilverBands++
                }
            }
        }
        if (spotlightWashedBands >= 3) {
            return -1
        }

        val lowerContinuityEarlyY = (yBot - (span * 0.24).toInt()).coerceIn(yTop + 4, yBot - 4)
        var lowerFlankEarlyLuma = 0.0
        var lowerFlankEarlySat = 0.0
        for (dx in intArrayOf(-flankDx1, flankDx1)) {
            val cLow = screen.getPixel((actualCx + dx).coerceIn(0, w - 1), lowerContinuityEarlyY)
            val rl = Color.red(cLow); val gl = Color.green(cLow); val bl = Color.blue(cLow)
            lowerFlankEarlyLuma += (0.299 * rl + 0.587 * gl + 0.114 * bl) * 0.5
            lowerFlankEarlySat += (max(rl, max(gl, bl)) - min(rl, min(gl, bl))) * 0.5
        }
        val isLowerQuarterEarlyFilled = (lowerFlankEarlyLuma in (emptyBaseLuma + 12.0).coerceAtLeast(62.0)..192.0 &&
            !(lowerFlankEarlyLuma >= 188.0 && lowerFlankEarlySat <= 28.0)) ||
            lowerFlankEarlySat > (emptyBaseSat + 10.0).coerceAtLeast(22.0)

        val hasAuthoritativeWhiteRing = whiteRingArcs >= 6 && upperWhiteRingArcs >= 2 && horizontalSideWhiteArcs >= 1
        val hasSecondOuterCircle = hasAuthoritativeWhiteRing && outerSecondRingArcs >= 5 && upperOrSideOuterRingArcs >= 3
        // v4.07 / v4.10: Require either a saturated colored top cap (`avgTopSat >= 42.0`) OR a uniform opaque Normal-type
        // silver-grey interior (`allowSilverLiquid`, `whiteRingArcs >= 7`, `upperWhiteRingArcs >= 3`, `avgTopLuma in 155..185`, `cleanSilverBands >= 10`)
        // so a white floor spotlight washing over an empty Moonblast or partial Giga Impact can never trigger 100%!
        val isColoredTopCapFilled = avgTopLuma > (emptyBaseLuma + 16.0).coerceAtLeast(68.0) &&
            avgTopSat >= max(42.0, emptyBaseSat + 16.0)
        val isNormalSilverTopCapFilled = allowSilverLiquid &&
            whiteRingArcs >= 7 &&
            upperWhiteRingArcs >= 3 &&
            avgTopLuma in 155.0..185.0 &&
            avgTopSat <= 20.0 &&
            cleanSilverBands >= 10 &&
            isLowerQuarterEarlyFilled
        val isTopCapFilled = isColoredTopCapFilled || isNormalSilverTopCapFilled

        if (hasAuthoritativeWhiteRing && isTopCapFilled) {
            val rOverInterior = readyHalfSpanPx * 0.94
            val yTopOverScan = (actualCy - (readyHalfSpanPx * 0.90)).roundToInt().coerceIn(8, h - 16)
            val yBotOverScan = (actualCy + (readyHalfSpanPx * 0.90)).roundToInt().coerceIn(yTopOverScan + 10, h - 8)
            val yBotOverUv = actualCy + readyHalfSpanPx
            val overUvSpan = (readyHalfSpanPx * 2).coerceAtLeast(1)
            val vDelta = (h * 0.0038f).roundToInt().coerceIn(max(6, stepY * 3), 12)
            val iconBandHalfH = (readyHalfSpanPx * 0.50).roundToInt().coerceAtLeast(iconHalfH)
            val iconSafeFlankDx = max(flankDx1, (readyHalfSpanPx * 0.62).roundToInt())

            var topRefR = 0.0; var topRefG = 0.0; var topRefB = 0.0; var topRefLuma = 0.0; var topRefSat = 0.0; var topRefN = 0
            var botRefR = 0.0; var botRefG = 0.0; var botRefB = 0.0; var botRefLuma = 0.0; var botRefSat = 0.0; var botRefN = 0
            val topRefDx = (readyHalfSpanPx * 0.28).roundToInt().coerceAtLeast(8)
            val botRefDx = (readyHalfSpanPx * 0.36).roundToInt().coerceAtLeast(10)
            for (pct in intArrayOf(86, 90, 93)) {
                val ry = (yBotOverUv - (pct * overUvSpan) / 100.0).roundToInt().coerceIn(8, h - 8)
                for (dx in intArrayOf(-topRefDx, topRefDx)) {
                    val px = (actualCx + dx).coerceIn(0, w - 1)
                    val c = screen.getPixel(px, ry)
                    val r = Color.red(c); val g = Color.green(c); val b = Color.blue(c)
                    val l = 0.299 * r + 0.587 * g + 0.114 * b
                    val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    if (!(l >= 205.0 && s <= 35.0)) {
                        topRefR += r; topRefG += g; topRefB += b; topRefLuma += l; topRefSat += s; topRefN++
                    }
                }
            }
            for (pct in intArrayOf(10, 14, 18)) {
                val ry = (yBotOverUv - (pct * overUvSpan) / 100.0).roundToInt().coerceIn(8, h - 8)
                for (dx in intArrayOf(-botRefDx, botRefDx)) {
                    val px = (actualCx + dx).coerceIn(0, w - 1)
                    val c = screen.getPixel(px, ry)
                    val r = Color.red(c); val g = Color.green(c); val b = Color.blue(c)
                    val l = 0.299 * r + 0.587 * g + 0.114 * b
                    val s = (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                    if (!(l >= 205.0 && s <= 35.0)) {
                        botRefR += r; botRefG += g; botRefB += b; botRefLuma += l; botRefSat += s; botRefN++
                    }
                }
            }
            if (topRefN > 0) {
                topRefR /= topRefN; topRefG /= topRefN; topRefB /= topRefN; topRefLuma /= topRefN; topRefSat /= topRefN
            }
            if (botRefN > 0) {
                botRefR /= botRefN; botRefG /= botRefN; botRefB /= botRefN; botRefLuma /= botRefN; botRefSat /= botRefN
            }
            val topBotLumaDiff = topRefLuma - botRefLuma
            val topBotSatDiff = botRefSat - topRefSat
            val topBotRgbDiff = kotlin.math.abs(topRefR - botRefR) + kotlin.math.abs(topRefG - botRefG) + kotlin.math.abs(topRefB - botRefB)
            val hasTwoLayerCapSeparation = topRefN > 0 && botRefN > 0 && (topBotLumaDiff >= 5.5 || topBotSatDiff >= 12.0 || topBotRgbDiff >= 16.0)

            var bestOverY = -1
            var bestOverScore = 0.0
            var oy = yTopOverScan
            while (oy <= yBotOverScan) {
                val inIconBand = kotlin.math.abs(oy - actualCy) <= iconBandHalfH
                if (!inIconBand || hasTwoLayerCapSeparation) {
                    val maxAbsDy = max(kotlin.math.abs((oy - vDelta) - actualCy), kotlin.math.abs((oy + vDelta) - actualCy)).toDouble()
                    val chordHalfW = kotlin.math.sqrt((rOverInterior * rOverInterior - maxAbsDy * maxAbsDy).coerceAtLeast(1.0))
                    val rimMarginPx = if (inIconBand) max(8, (w * 0.0080f).roundToInt()) else max(5, (w * 0.0050f).roundToInt())
                    val safeOuterDx = (chordHalfW - rimMarginPx).toInt()
                    val minSafeDx = if (inIconBand) iconSafeFlankDx else max(4, (w * 0.0045f).roundToInt())
                    if (safeOuterDx >= minSafeDx + 2) {
                        val safeInnerDx = if (inIconBand) {
                            max(minSafeDx, safeOuterDx - max(5, (w * 0.0050f).roundToInt()))
                        } else {
                            max(minSafeDx, safeOuterDx / 2)
                        }
                        val xOffs = intArrayOf(-safeOuterDx, -safeInnerDx, safeInnerDx, safeOuterDx)
                        val yU = (oy - vDelta).coerceIn(0, h - 1)
                        val yM = oy.coerceIn(0, h - 1)
                        val yD = (oy + vDelta).coerceIn(0, h - 1)

                        var rUp = 0.0; var gUp = 0.0; var bUp = 0.0; var lUpL = 0.0; var lUpR = 0.0
                        var rMid = 0.0; var gMid = 0.0; var bMid = 0.0; var sMid = 0.0
                        var rDn = 0.0; var gDn = 0.0; var bDn = 0.0; var lDnL = 0.0; var lDnR = 0.0
                        var hasWhiteIconBleed = false
                        for (dx in xOffs) {
                            val px = (actualCx + dx).coerceIn(0, w - 1)
                            val cU = screen.getPixel(px, yU)
                            val cM = screen.getPixel(px, yM)
                            val cD = screen.getPixel(px, yD)
                            val ru = Color.red(cU); val gu = Color.green(cU); val bu = Color.blue(cU)
                            val rm = Color.red(cM); val gm = Color.green(cM); val bm = Color.blue(cM)
                            val rd = Color.red(cD); val gd = Color.green(cD); val bd = Color.blue(cD)
                            val lu = 0.299 * ru + 0.587 * gu + 0.114 * bu
                            val ld = 0.299 * rd + 0.587 * gd + 0.114 * bd
                            val su = (max(ru, max(gu, bu)) - min(ru, min(gu, bu))).toDouble()
                            val sd = (max(rd, max(gd, bd)) - min(rd, min(gd, bd))).toDouble()
                            val sm = (max(rm, max(gm, bm)) - min(rm, min(gm, bm))).toDouble()
                            // Only reject pure-white icon bleed inside the center icon band
                            if (inIconBand && ((lu >= 210.0 && su <= 28.0) || (ld >= 210.0 && sd <= 28.0))) {
                                hasWhiteIconBleed = true
                            }
                            rUp += ru; gUp += gu; bUp += bu
                            rMid += rm; gMid += gm; bMid += bm; sMid += sm
                            rDn += rd; gDn += gd; bDn += bd
                            if (dx < 0) {
                                lUpL += lu
                                lDnL += ld
                            } else {
                                lUpR += lu
                                lDnR += ld
                            }
                        }
                        if (!hasWhiteIconBleed) {
                            val n = xOffs.size.toDouble()
                            rUp /= n; gUp /= n; bUp /= n
                            rMid /= n; gMid /= n; bMid /= n; sMid /= n
                            rDn /= n; gDn /= n; bDn /= n
                            lUpL *= 0.5; lUpR *= 0.5; lDnL *= 0.5; lDnR *= 0.5

                            val lumaUp = 0.299 * rUp + 0.587 * gUp + 0.114 * bUp
                            val lumaMid = 0.299 * rMid + 0.587 * gMid + 0.114 * bMid
                            val lumaDn = 0.299 * rDn + 0.587 * gDn + 0.114 * bDn
                            val satUp = max(rUp, max(gUp, bUp)) - min(rUp, min(gUp, bUp))
                            val satDn = max(rDn, max(gDn, bDn)) - min(rDn, min(gDn, bDn))

                            val matchesRefBands = if (inIconBand && topRefN > 0 && botRefN > 0) {
                                kotlin.math.abs(lumaUp - topRefLuma) <= 22.0 &&
                                    kotlin.math.abs(lumaDn - botRefLuma) <= 22.0
                            } else {
                                true
                            }

                            val bothAreColoredLiquid = lumaUp in 68.0..215.0 &&
                                lumaDn in 60.0..205.0 &&
                                ((satUp >= 16.0 && satDn >= 20.0) ||
                                    (lumaUp >= 115.0 && lumaDn >= 95.0 && isLowerQuarterEarlyFilled))
                            val isSymmetric = kotlin.math.abs(lUpL - lUpR) <= 24.0 && kotlin.math.abs(lDnL - lDnR) <= 24.0
                            val lumaDrop = lumaUp - lumaDn
                            val satGain = satDn - satUp
                            val rgbDiff = kotlin.math.abs(rUp - rDn) + kotlin.math.abs(gUp - gDn) + kotlin.math.abs(bUp - bDn)
                            val meniscusRidge = max(0.0, lumaMid - max(lumaUp, lumaDn))
                            val hasWhiteMeniscus = lumaMid >= 152.0 && sMid <= 95.0 && meniscusRidge >= 8.0
                            val minFlankDrop = if (inIconBand) 9.0 else 6.0
                            val minLumaDrop = if (inIconBand) 11.0 else 7.5
                            val minRgbDiff = if (inIconBand) 24.0 else 17.0
                            val bothFlanksDrop = (lUpL - lDnL >= minFlankDrop) && (lUpR - lDnR >= minFlankDrop)
                            val passesStep = (bothFlanksDrop && lumaDrop >= minLumaDrop && rgbDiff >= minRgbDiff) ||
                                (hasWhiteMeniscus && (lumaDrop >= 4.0 || satGain >= 12.0) && rgbDiff >= 14.0 && (lUpL - lDnL >= 3.0) && (lUpR - lDnR >= 3.0))

                            if (matchesRefBands && bothAreColoredLiquid && isSymmetric && passesStep) {
                                val midTarget = 0.5 * (lumaUp + lumaDn)
                                val midCenterBonus = max(0.0, 12.0 - kotlin.math.abs(lumaMid - midTarget) * 0.5)
                                val iconBandPenalty = if (inIconBand) 0.82 else 1.0
                                val score = (max(0.0, lumaDrop) * 2.0 + max(0.0, satGain) * 0.5 + rgbDiff * 0.8 + midCenterBonus + (if (hasWhiteMeniscus) meniscusRidge * 1.8 else 0.0)) * iconBandPenalty
                                if (score > bestOverScore) {
                                    bestOverScore = score
                                    bestOverY = oy
                                }
                            }
                        }
                    }
                }
                oy += stepY
            }
            if (bestOverY != -1) {
                val overPct = (((yBotOverUv - bestOverY) * 100.0) / overUvSpan).roundToInt().coerceIn(1, 99)
                if (btnSlotKey in 0..5 && overPct in 12..68 && topRefN > 0 && botRefN > 0 && topBotLumaDiff >= 7.0) {
                    val prev1 = firstFillTopCapLuma[btnSlotKey]
                    val prev2 = secondFillBotCapLuma[btnSlotKey]
                    firstFillTopCapLuma[btnSlotKey] = if (prev1 < 0.0) topRefLuma else (prev1 * 0.65 + topRefLuma * 0.35)
                    secondFillBotCapLuma[btnSlotKey] = if (prev2 < 0.0) botRefLuma else (prev2 * 0.65 + botRefLuma * 0.35)
                }
                return if (hasSecondOuterCircle) {
                    200 + overPct
                } else {
                    100 + overPct
                }
            }
            if (hasSecondOuterCircle) {
                return 200
            }
            return 100
        }

        // 2. Primary Fill Layer (1..97%): Scan vertically from yTop to yBot using prescan empty-circle baseline
        //    v3.97: Widen icon exclusion height (`radiusY * 0.68`) so yD never grazes the top tip of the white center icon at 77..79%,
        //    require colored saturation below the meniscus, and verify lower-flank continuity below any candidate > 42% fill.
        val maxAllowedUnfilledLuma = if (prescanCircleCalibrated) {
            (emptyBaseLuma + 34.0).coerceIn(72.0, 98.0)
        } else {
            95.0
        }
        val maxAllowedUnfilledSat = if (prescanCircleCalibrated) {
            (emptyBaseSat + 45.0).coerceIn(48.0, 82.0)
        } else {
            80.0
        }
        val r1IconHalfH = (radiusY * 0.68).toInt().coerceAtLeast(20)
        val lowerContinuityY = (yBot - (span * 0.24).toInt()).coerceIn(yTop + 4, yBot - 4)
        var lowerFlankLuma = 0.0
        var lowerFlankSat = 0.0
        for (dx in intArrayOf(-flankDx1, flankDx1)) {
            val cLow = screen.getPixel((actualCx + dx).coerceIn(0, w - 1), lowerContinuityY)
            val rl = Color.red(cLow); val gl = Color.green(cLow); val bl = Color.blue(cLow)
            lowerFlankLuma += (0.299 * rl + 0.587 * gl + 0.114 * bl) * 0.5
            lowerFlankSat += (max(rl, max(gl, bl)) - min(rl, min(gl, bl))) * 0.5
        }
        val isLowerQuarterFilled = (lowerFlankLuma in (emptyBaseLuma + 12.0).coerceAtLeast(62.0)..192.0 &&
            !(lowerFlankLuma >= 188.0 && lowerFlankSat <= 28.0)) ||
            lowerFlankSat > (emptyBaseSat + 10.0).coerceAtLeast(22.0)

        var bestY = -1
        var bestScore = 0.0
        var y = yTop + stepY * 2
        while (y <= yBot - stepY * 2) {
            val dyNorm = ((y - actualCy).toDouble() / radiusY).coerceIn(-0.96, 0.96)
            val chordHalfW = (halfSpanPx * kotlin.math.sqrt((1.0 - dyNorm * dyNorm).coerceAtLeast(0.06))).toInt()
            val maxInsideDx = (chordHalfW - (w * 0.0085f).toInt()).coerceAtLeast(6)
            val xOffsets = if (kotlin.math.abs(y - actualCy) <= r1IconHalfH) {
                val innerFlank = min(flankDx1, (maxInsideDx - 4).coerceAtLeast(10))
                val outerFlank = min(flankDx2, maxInsideDx.coerceAtLeast(innerFlank + 2))
                intArrayOf(-outerFlank, -innerFlank, innerFlank, outerFlank)
            } else {
                val d1 = min(capDx, max(3, maxInsideDx / 2))
                val d2 = min((w * 0.032f).toInt(), maxInsideDx)
                intArrayOf(-d2, -d1, d1, d2)
            }
            val yU1 = (y - stepY * 2).coerceIn(yTop + 2, yBot - 1)
            val yU2 = (y - stepY).coerceIn(yTop + 2, yBot - 1)
            val yM = y.coerceIn(yTop + 2, yBot - 2)
            val yD1 = (y + stepY).coerceIn(yTop + 2, yBot - 1)
            val yD2 = (y + stepY * 2).coerceIn(yTop + 2, yBot - 1)
            var rUp = 0.0; var gUp = 0.0; var bUp = 0.0
            var rMid = 0.0; var gMid = 0.0; var bMid = 0.0
            var rDn = 0.0; var gDn = 0.0; var bDn = 0.0
            var leftFlankDnLuma = 0.0; var rightFlankDnLuma = 0.0
            var leftFlankUpLuma = 0.0; var rightFlankUpLuma = 0.0
            var leftFlankMidLuma = 0.0; var rightFlankMidLuma = 0.0
            var leftCnt = 0; var rightCnt = 0
            for (dx in xOffsets) {
                val px = (actualCx + dx).coerceIn(0, w - 1)
                val cu1 = screen.getPixel(px, yU1)
                val cu2 = screen.getPixel(px, yU2)
                val cm = screen.getPixel(px, yM)
                val cd1 = screen.getPixel(px, yD1)
                val cd2 = screen.getPixel(px, yD2)
                val ru = Color.red(cu1) + Color.red(cu2)
                val gu = Color.green(cu1) + Color.green(cu2)
                val bu = Color.blue(cu1) + Color.blue(cu2)
                val rm = Color.red(cm).toDouble()
                val gm = Color.green(cm).toDouble()
                val bm = Color.blue(cm).toDouble()
                val rd = Color.red(cd1) + Color.red(cd2)
                val gd = Color.green(cd1) + Color.green(cd2)
                val bd = Color.blue(cd1) + Color.blue(cd2)
                rUp += ru; gUp += gu; bUp += bu
                rMid += rm; gMid += gm; bMid += bm
                rDn += rd; gDn += gd; bDn += bd
                val lu = (0.299 * ru + 0.587 * gu + 0.114 * bu) * 0.5
                val lm = 0.299 * rm + 0.587 * gm + 0.114 * bm
                val ld = (0.299 * rd + 0.587 * gd + 0.114 * bd) * 0.5
                if (dx < 0) {
                    leftFlankUpLuma += lu
                    leftFlankMidLuma += lm
                    leftFlankDnLuma += ld
                    leftCnt++
                } else if (dx > 0) {
                    rightFlankUpLuma += lu
                    rightFlankMidLuma += lm
                    rightFlankDnLuma += ld
                    rightCnt++
                }
            }
            val denom = (xOffsets.size * 2).toDouble()
            val midDenom = xOffsets.size.toDouble().coerceAtLeast(1.0)
            rUp /= denom; gUp /= denom; bUp /= denom
            rMid /= midDenom; gMid /= midDenom; bMid /= midDenom
            rDn /= denom; gDn /= denom; bDn /= denom

            val lUp = if (leftCnt > 0) leftFlankUpLuma / leftCnt else 0.0
            val rUpFlank = if (rightCnt > 0) rightFlankUpLuma / rightCnt else 0.0
            val lMid = if (leftCnt > 0) leftFlankMidLuma / leftCnt else 0.0
            val rMidFlank = if (rightCnt > 0) rightFlankMidLuma / rightCnt else 0.0
            val lDn = if (leftCnt > 0) leftFlankDnLuma / leftCnt else 0.0
            val rDnFlank = if (rightCnt > 0) rightFlankDnLuma / rightCnt else 0.0

            // v4.06 / v4.10: Unilateral White Floor Spotlight Rejection & Normal-Type Silver-Grey Liquid Support:
            val leftSpotlightWashed = leftCnt > 0 && rightCnt > 0 &&
                (lUp >= 188.0 || lDn >= 195.0) &&
                rUpFlank <= maxAllowedUnfilledLuma + 10.0 &&
                rDnFlank in 52.0..186.0
            val rightSpotlightWashed = leftCnt > 0 && rightCnt > 0 &&
                (rUpFlank >= 188.0 || rDnFlank >= 195.0) &&
                lUp <= maxAllowedUnfilledLuma + 10.0 &&
                lDn in 52.0..186.0

            val lumaUp = when {
                leftSpotlightWashed -> rUpFlank
                rightSpotlightWashed -> lUp
                else -> 0.299 * rUp + 0.587 * gUp + 0.114 * bUp
            }
            val lumaMid = when {
                leftSpotlightWashed -> rMidFlank
                rightSpotlightWashed -> lMid
                else -> 0.299 * rMid + 0.587 * gMid + 0.114 * bMid
            }
            val lumaDn = when {
                leftSpotlightWashed -> rDnFlank
                rightSpotlightWashed -> lDn
                else -> 0.299 * rDn + 0.587 * gDn + 0.114 * bDn
            }
            val satUp = max(rUp, max(gUp, bUp)) - min(rUp, min(gUp, bUp))
            val satMid = max(rMid, max(gMid, bMid)) - min(rMid, min(gMid, bMid))
            val satDn = max(rDn, max(gDn, bDn)) - min(rDn, min(gDn, bDn))
            val rawGrad = kotlin.math.abs(rDn - rUp) + kotlin.math.abs(gDn - gUp) + kotlin.math.abs(bDn - bUp)
            val grad = when {
                leftSpotlightWashed || rightSpotlightWashed -> max(rawGrad, kotlin.math.abs(lumaDn - lumaUp) * 3.0)
                else -> rawGrad
            }
            // v4.10: Restore v4.07 horizontal flank symmetry tolerance (<= 44.0) so tall Pokémon legs/auras
            // behind one side of the semi-transparent button (e.g. Xerneas left leg behind Moonblast) never cause --% dropouts!
            val isHorizontallySymmetric = if (leftCnt > 0 && rightCnt > 0 && !leftSpotlightWashed && !rightSpotlightWashed) {
                kotlin.math.abs(lUp - rUpFlank) <= 44.0 && kotlin.math.abs(lDn - rDnFlank) <= 44.0
            } else true

            val candFillPct = (((yBot - y) * 100.0) / span).roundToInt()
            val passesContinuity = candFillPct <= 42 || isLowerQuarterFilled

            // Horizontal White/Light-Tinted Meniscus Bar Detector at yM:
            val hasHorizontalMeniscusBar = lumaMid >= lumaUp + 6.0 &&
                lumaMid >= lumaDn - 4.0 &&
                (leftSpotlightWashed || rightSpotlightWashed || kotlin.math.abs(lMid - rMidFlank) <= 22.0) &&
                !(lumaMid >= 205.0 && satMid <= 20.0 && kotlin.math.abs(lDn - rDnFlank) > 20.0)
            val meniscusBarBonus = if (hasHorizontalMeniscusBar) {
                val ridgeBoost = max(0.0, lumaMid - max(lumaUp, lumaDn)).coerceAtMost(14.0)
                14.0 + ridgeBoost * 0.7
            } else 0.0

            val isNotWhiteIconTip = !(lumaDn >= 195.0 && satDn <= 32.0)
            val isNotSpotlightBleedBelow = !(lumaDn >= 152.0 && satDn <= 40.0)
            val isUnfilledAbove = lumaUp in 16.0..(maxAllowedUnfilledLuma + 6.0) &&
                satUp < maxAllowedUnfilledSat &&
                (avgTopLuma <= maxAllowedUnfilledLuma + 14.0 || lumaUp <= maxAllowedUnfilledLuma)
            val isBottomCrescent = y >= yBot - (span * 0.18).toInt()
            val minGrad = if (isBottomCrescent) 18.0 else 24.0
            val isColoredLiquidBelow = ((lumaDn > lumaUp + 3.5 && satDn >= 18.0) ||
                (satDn > satUp + 6.0 && satDn >= 22.0) ||
                (grad >= 32.0 && lumaDn >= 34.0 && satDn >= 20.0)) &&
                isNotSpotlightBleedBelow
            // v4.10: Gate silver-grey liquid strictly on `allowSilverLiquid` (Normal/Steel/Rock moves only)
            // and require tight horizontal uniformity (<= 18.0) so angled arena floor spotlight beams on Xerneas
            // never fake a 59%..79% fill on Giga Impact!
            val isNormalSilverLiquidBelow = allowSilverLiquid &&
                lumaDn in max(106.0, emptyBaseLuma + 32.0)..148.0 &&
                satDn <= 28.0 &&
                lumaDn > lumaUp + 14.0 &&
                grad >= 28.0 &&
                kotlin.math.abs(lDn - rDnFlank) <= 18.0 &&
                kotlin.math.abs(lUp - rUpFlank) <= 18.0 &&
                (isLowerQuarterFilled || isBottomCrescent)
            val isFilledBelow = isNotWhiteIconTip && (isColoredLiquidBelow || isNormalSilverLiquidBelow)
            val totalCandidateScore = grad + meniscusBarBonus
            if (passesContinuity && isHorizontallySymmetric && isUnfilledAbove && isFilledBelow && grad >= minGrad && totalCandidateScore > bestScore) {
                bestScore = totalCandidateScore
                bestY = y
            }
            y += stepY
        }

        if (bestY != -1) {
            return (((yBot - bestY) * 100.0) / span).roundToInt().coerceIn(1, 97)
        }

        // 3. Explicit 0% Empty Baseline Check (v4.06: Requires dark-grey circular perimeter border verification
        //    so rectangular white text like "NOT NOW" at (0.50w, 0.8932h) or overlay labels never return 0%!)
        var emptyLumaSum = 0.0
        var emptySatSum = 0.0
        var emptySamples = 0
        for (dy in intArrayOf(-span / 4, 0, span / 4)) {
            val py = (actualCy + dy).coerceIn(yTop + 4, yBot - 4)
            for (dx in intArrayOf(-flankDx1, flankDx1)) {
                val px = (actualCx + dx).coerceIn(0, w - 1)
                val c = screen.getPixel(px, py)
                val r = Color.red(c)
                val g = Color.green(c)
                val b = Color.blue(c)
                emptyLumaSum += 0.299 * r + 0.587 * g + 0.114 * b
                emptySatSum += (max(r, max(g, b)) - min(r, min(g, b))).toDouble()
                emptySamples++
            }
        }
        if (emptySamples > 0) {
            val avgEmptyLuma = emptyLumaSum / emptySamples
            val avgEmptySat = emptySatSum / emptySamples
            if (avgEmptyLuma in 16.0..(maxAllowedUnfilledLuma + 10.0) &&
                avgEmptySat < (maxAllowedUnfilledSat + 8.0) &&
                maxCenterIconLuma >= 150.0 &&
                whiteRingArcs < 5
            ) {
                val rBorderIn = w * 0.0735
                val rBorderOut = w * 0.0850
                val borderDirs = arrayOf(
                    Pair(0.0, -1.0),
                    Pair(-0.707, -0.707),
                    Pair(0.707, -0.707),
                    Pair(-1.0, 0.0),
                    Pair(1.0, 0.0),
                    Pair(-0.866, -0.50),
                    Pair(0.866, -0.50)
                )
                var darkGreyBorderArcs = 0
                for ((ux, uy) in borderDirs) {
                    val xIn = (actualCx + ux * rBorderIn).roundToInt().coerceIn(0, w - 1)
                    val yIn = (actualCy + uy * rBorderIn).roundToInt().coerceIn(0, h - 1)
                    val xOut = (actualCx + ux * rBorderOut).roundToInt().coerceIn(0, w - 1)
                    val yOut = (actualCy + uy * rBorderOut).roundToInt().coerceIn(0, h - 1)
                    val cIn = screen.getPixel(xIn, yIn)
                    val cOut = screen.getPixel(xOut, yOut)
                    val rIn = Color.red(cIn); val gIn = Color.green(cIn); val bIn = Color.blue(cIn)
                    val rOut = Color.red(cOut); val gOut = Color.green(cOut); val bOut = Color.blue(cOut)
                    val lIn = 0.299 * rIn + 0.587 * gIn + 0.114 * bIn
                    val sIn = (max(rIn, max(gIn, bIn)) - min(rIn, min(gIn, bIn))).toDouble()
                    val lOut = 0.299 * rOut + 0.587 * gOut + 0.114 * bOut
                    val rimContrast = kotlin.math.abs(lOut - lIn)
                    if (lIn in 28.0..92.0 && sIn <= 32.0 && lOut < 185.0 && rimContrast >= 5.0) {
                        darkGreyBorderArcs++
                    }
                }
                if (darkGreyBorderArcs >= 5) {
                    return 0
                }
            }
        }
        -1
    } catch (_: Exception) {
        -1
    }
}

internal fun OverlayService.computeExpectedCirclePctForEnergy(energy: Int, moveCost: Int): Pair<Int, Boolean> {
    val c = moveCost.coerceIn(35, 100)
    val e = energy.coerceIn(0, 100)
    return when {
        e <= 0 -> 0 to false
        e < c -> ((e * 100.0) / c.toDouble()).roundToInt().coerceIn(1, 99) to false
        e <= 2 * c -> (100 + (((e - c) * 100.0) / c.toDouble()).roundToInt().coerceIn(0, 99)) to false
        else -> (200 + (((e - 2 * c) * 100.0) / c.toDouble()).roundToInt().coerceIn(0, 100)) to true
    }
}

internal fun OverlayService.scorePostThrowCircleFit(
    leftFillPct: Int,
    rightFillPct: Int,
    cost1: Int,
    cost2: Int,
    hasSecondMove: Boolean,
    candidateEnergy: Int
): Double {
    val c1 = cost1.coerceIn(35, 100)
    val c2 = if (hasSecondMove && cost2 > 0) cost2.coerceIn(35, 100) else c1
    var errSum = 0.0
    var count = 0
    if (leftFillPct in 0..300) {
        val (expLeftPct, _) = computeExpectedCirclePctForEnergy(candidateEnergy, c1)
        val errDirect = kotlin.math.abs(leftFillPct - expLeftPct) * (c1 / 100.0)
        errSum += errDirect
        count++
    }
    if (hasSecondMove && rightFillPct in 0..300 && cost2 > 0) {
        val (expRightPct, _) = computeExpectedCirclePctForEnergy(candidateEnergy, c2)
        val errDirect = kotlin.math.abs(rightFillPct - expRightPct) * (c2 / 100.0)
        errSum += errDirect
        count++
    }
    return if (count > 0) errSum / count.toDouble() else 999.0
}

/**
 * v3.99: Pure Visual 3-Ring Single-Bar Energy Solver (`0..100E`, Zero Assumed Energy Gains):
 * - Keys STRICTLY off the single slower (higher-cost) charge move bar (`debouncedSlowestPct` in `0..300%`, `slowestMoveCost`).
 * - Removes all assumed / timer-based / fast-move cadence energy stepping.
 * - Maps the three visual fill tiers directly:
 *   1. 1st Fill (`0..99%`, dark-grey circle border): `round((pct * slowCost) / 100.0)` (`0 .. slowCost - 1`)
 *   2. 2nd Fill (`100..199%`, circle border filled in white): `slowCost + round(((pct - 100) * slowCost) / 100.0)` (`slowCost .. min(100, 2 * slowCost)`)
 *   3. 3rd Fill (`200..300%`, second outer circle outside the circle border): `2 * slowCost + round(((pct - 200) * slowCost) / 100.0)` (`2 * slowCost .. 100`)
 */
internal fun OverlayService.resolveSub50AndMultiRoundEnergy(
    slotIdx: Int,
    slowestIsRight: Boolean,
    slowestMoveCost: Int,
    fasterMoveCost: Int,
    hasSecondUserMove: Boolean,
    debouncedSlowestPct: Int,
    debouncedFasterPct: Int,
    curE: Int,
    userFastEnergy: Int,
    userMoveDurationMs: Long,
    nowMs: Long,
    canAdvanceMonotonically: Boolean,
    primaryContrastRank: Int = 9,
    secondaryContrastRank: Int = 9
): Int {
    val slowCost = slowestMoveCost.coerceIn(35, 100)
    val fastCost = fasterMoveCost.coerceIn(35, 100)
    val clampedCurE = curE.coerceIn(0, 100)
    val maxFastStep = max(14, userFastEnergy * 2)
    val maxAllowedSingleJumpE = if (clampedCurE > 0) {
        (clampedCurE + maxFastStep + 4).coerceAtMost(100)
    } else if (playerSlotTurnsOnField[slotIdx] <= 4) {
        max(22, userFastEnergy * 3 + 4).coerceAtMost(100)
    } else {
        100
    }

    // v4.06 / v4.08: Compute dual-circle cross-check energy from the secondary charge move circle (`fastCost`)
    val fasterResolvedE: Int = if (hasSecondUserMove && debouncedFasterPct in 0..300) {
        when (debouncedFasterPct) {
            in 0..99 -> {
                val f1Raw = (((debouncedFasterPct * fastCost) / 100.0).roundToInt()).coerceIn(0, fastCost - 1)
                snapPlayerEnergyToValidStep(
                    slotIdx = slotIdx,
                    rawEnergy = f1Raw,
                    fastMoveEnergy = userFastEnergy,
                    minBound = 0,
                    maxBound = fastCost - 1
                )
            }
            in 100..199 -> {
                if (debouncedFasterPct > peakFastestSecondFillPct[slotIdx]) {
                    peakFastestSecondFillPct[slotIdx] = debouncedFasterPct
                }
                val f2Max = min(100, 2 * fastCost)
                val f2Raw = (fastCost + (((debouncedFasterPct - 100) * fastCost) / 100.0).roundToInt()).coerceIn(fastCost, f2Max)
                snapPlayerEnergyToValidStep(
                    slotIdx = slotIdx,
                    rawEnergy = f2Raw,
                    fastMoveEnergy = userFastEnergy,
                    minBound = fastCost,
                    maxBound = f2Max
                )
            }
            else -> {
                val f3Floor = min(100, 2 * fastCost)
                fasterMeterInThirdFill[slotIdx] = fastCost < 50
                val f3Raw = (2 * fastCost + (((debouncedFasterPct - 200) * fastCost) / 100.0).roundToInt()).coerceIn(f3Floor, 100)
                snapPlayerEnergyToValidStep(
                    slotIdx = slotIdx,
                    rawEnergy = f3Raw,
                    fastMoveEnergy = userFastEnergy,
                    minBound = f3Floor,
                    maxBound = 100
                )
            }
        }
    } else -1

    // v4.09 / v4.10: Dual-Circle Physical White-Ring Bounds & Contrast-Gated Cross-Check:
    // A circle's <100% dark-grey border (`debouncedFasterPct in 0..94`) is an upper bound (`energy <= fastCost - 1`),
    // and a >=100% white border (`debouncedFasterPct >= 100`) is a lower bound (`energy >= fastCost`).
    // However, a lower-contrast secondary circle (`secondaryContrastRank > primaryContrastRank`, e.g. Normal Giga Impact #17
    // vs Fairy Moonblast #3) can NEVER drive energy upward when the primary circle is temporarily -1!
    val secondaryCanOverridePrimary = secondaryContrastRank <= primaryContrastRank
    val physicalMaxFromSecondary = if (hasSecondUserMove && debouncedFasterPct in 0..94) {
        (fastCost - 1).coerceAtLeast(0)
    } else {
        100
    }
    val physicalMinFromSecondary = if (hasSecondUserMove && debouncedFasterPct >= 100) {
        fastCost.coerceAtMost(100)
    } else {
        0
    }

    if (hasSecondUserMove && fastCost < slowCost && fasterResolvedE >= 0 && debouncedFasterPct in 1..94) {
        val expectedSlowPct = ((debouncedFasterPct * fastCost).toDouble() / slowCost.toDouble()).roundToInt()
        val primaryRawClaimE = if (debouncedSlowestPct in 0..300) ((debouncedSlowestPct * slowCost) / 100.0).roundToInt() else -1
        val primaryViolatesSecondaryDarkBorder = primaryRawClaimE >= fastCost || debouncedSlowestPct >= 100
        if (primaryViolatesSecondaryDarkBorder ||
            (secondaryCanOverridePrimary && (debouncedSlowestPct !in 0..300 || debouncedSlowestPct > expectedSlowPct + 14))
        ) {
            val clampedFast = min(fasterResolvedE, maxAllowedSingleJumpE).coerceIn(0, physicalMaxFromSecondary)
            return if (secondaryCanOverridePrimary) clampedFast else min(clampedCurE, physicalMaxFromSecondary)
        }
    }

    if (debouncedSlowestPct !in 0..300) {
        if (secondaryCanOverridePrimary && fasterResolvedE >= 0) {
            val clampedFast = min(fasterResolvedE, maxAllowedSingleJumpE).coerceIn(physicalMinFromSecondary, physicalMaxFromSecondary)
            if (clampedFast >= 100) playerSlotEnergyAnchor[slotIdx] = 100
            return clampedFast
        }
        return clampedCurE
    }

    if (debouncedSlowestPct in 0..99) {
        slowestMeterInThirdFill[slotIdx] = false
        fasterMeterInThirdFill[slotIdx] = false
        peakSecondFillPct[slotIdx] = 0
        peakFastestSecondFillPct[slotIdx] = 0
        leftMeterFilledTwiceLatched[slotIdx] = false
        rightMeterFilledTwiceLatched[slotIdx] = false
        val r1MaxAllowed = min(slowCost - 1, physicalMaxFromSecondary).coerceAtLeast(0)
        val r1MinAllowed = physicalMinFromSecondary.coerceAtMost(r1MaxAllowed)
        val r1RawE = (((debouncedSlowestPct * slowCost) / 100.0).roundToInt()).coerceIn(r1MinAllowed, r1MaxAllowed)
        val r1SnappedE = snapPlayerEnergyToValidStep(
            slotIdx = slotIdx,
            rawEnergy = r1RawE,
            fastMoveEnergy = userFastEnergy,
            minBound = r1MinAllowed,
            maxBound = r1MaxAllowed
        )
        val resolvedE = if (secondaryCanOverridePrimary && fasterResolvedE > r1SnappedE && (r1SnappedE + userFastEnergy) <= fasterResolvedE) {
            fasterResolvedE
        } else {
            r1SnappedE
        }
        val maxR1Bound = if (secondaryCanOverridePrimary) {
            min(physicalMaxFromSecondary, max(slowCost - 1, fasterResolvedE.coerceAtMost(100)))
        } else {
            r1MaxAllowed
        }
        return min(resolvedE, maxAllowedSingleJumpE).coerceIn(r1MinAllowed, maxR1Bound.coerceAtLeast(r1MinAllowed))
    }

    if (debouncedSlowestPct in 100..199) {
        slowestMeterInThirdFill[slotIdx] = false
        if (debouncedSlowestPct > peakSecondFillPct[slotIdx]) {
            peakSecondFillPct[slotIdx] = debouncedSlowestPct
        }
        // Enforce physicalMaxFromSecondary (e.g. Xerneas Moonblast 50E in 2nd Fill capped at <= 79E when Giga Impact 80E has no white ring!)
        val r2Max = min(min(100, 2 * slowCost), physicalMaxFromSecondary).coerceAtLeast(slowCost)
        val r2Min = max(slowCost, physicalMinFromSecondary).coerceAtMost(r2Max)
        val r2RawE = (slowCost + (((debouncedSlowestPct - 100) * slowCost) / 100.0).roundToInt()).coerceIn(r2Min, r2Max)
        val r2SnappedE = snapPlayerEnergyToValidStep(
            slotIdx = slotIdx,
            rawEnergy = r2RawE,
            fastMoveEnergy = userFastEnergy,
            minBound = r2Min,
            maxBound = r2Max
        )
        val resolvedR2 = if (secondaryCanOverridePrimary && fasterResolvedE > r2SnappedE && (r2SnappedE + userFastEnergy) <= fasterResolvedE) {
            fasterResolvedE.coerceAtMost(r2Max)
        } else {
            r2SnappedE
        }
        val clampedR2 = min(resolvedR2, maxAllowedSingleJumpE).coerceIn(r2Min, r2Max)
        if (clampedR2 >= 100) playerSlotEnergyAnchor[slotIdx] = 100
        return clampedR2
    }

    // debouncedSlowestPct in 200..300 (3rd Fill: second concentric outer circle detected outside main white circle)
    val r3Max = physicalMaxFromSecondary.coerceIn(slowCost, 100)
    val r3Floor = min(min(100, 2 * slowCost), r3Max)
    slowestMeterInThirdFill[slotIdx] = slowCost < 50
    if (slowestIsRight) rightMeterFilledTwiceLatched[slotIdx] = true else leftMeterFilledTwiceLatched[slotIdx] = true
    if (debouncedSlowestPct > peakSecondFillPct[slotIdx]) {
        peakSecondFillPct[slotIdx] = debouncedSlowestPct
    }
    val r3RawE = (2 * slowCost + (((debouncedSlowestPct - 200) * slowCost) / 100.0).roundToInt()).coerceIn(r3Floor, r3Max)
    val r3SnappedE = snapPlayerEnergyToValidStep(
        slotIdx = slotIdx,
        rawEnergy = r3RawE,
        fastMoveEnergy = userFastEnergy,
        minBound = r3Floor,
        maxBound = r3Max
    )
    val clampedR3 = min(r3SnappedE, maxAllowedSingleJumpE).coerceIn(r3Floor, r3Max)
    if (clampedR3 >= 100) playerSlotEnergyAnchor[slotIdx] = 100
    return clampedR3
}

/**
 * v3.99 / v4.00: Pure Visual 3-Ring Single-Bar Post-Throw Energy & Round Resync Solver + Post-Throw Discharge Anchor Snap:
 * Reads post-throw energy directly from the slower charge move bar (`0..99%`, `100..199%`, `200..300%`)
 * and snaps to the nearest valid fast-move increment (`expectedPostEnergy + k * userFastEnergy`).
 */
internal fun OverlayService.resolvePostThrowCircleEnergyAndResyncRound(
    slotIdx: Int,
    slowestIsRight: Boolean,
    slowestMoveCost: Int,
    fasterMoveCost: Int,
    hasSecondUserMove: Boolean,
    debouncedSlowestPct: Int,
    debouncedFasterPct: Int,
    expectedPostEnergy: Int,
    userFastEnergy: Int,
    nowMs: Long
): Int {
    val slowCost = slowestMoveCost.coerceIn(35, 100)
    val fastCost = fasterMoveCost.coerceIn(35, 100)
    val dischargeAnchor = expectedPostEnergy.coerceIn(0, 100)
    playerSlotEnergyAnchor[slotIdx] = dischargeAnchor

    val rawCirclePostE = when {
        debouncedSlowestPct in 0..99 -> {
            val rawE = (((debouncedSlowestPct * slowCost) / 100.0).roundToInt()).coerceIn(0, slowCost - 1)
            snapPlayerEnergyToValidStep(slotIdx, rawE, userFastEnergy, 0, slowCost - 1)
        }
        debouncedSlowestPct in 100..199 -> {
            val r2Max = min(100, 2 * slowCost)
            val rawE = (slowCost + (((debouncedSlowestPct - 100) * slowCost) / 100.0).roundToInt()).coerceIn(slowCost, r2Max)
            snapPlayerEnergyToValidStep(slotIdx, rawE, userFastEnergy, slowCost, r2Max)
        }
        debouncedSlowestPct in 200..300 -> {
            val r3Floor = min(100, 2 * slowCost)
            val rawE = (2 * slowCost + (((debouncedSlowestPct - 200) * slowCost) / 100.0).roundToInt()).coerceIn(r3Floor, 100)
            snapPlayerEnergyToValidStep(slotIdx, rawE, userFastEnergy, r3Floor, 100)
        }
        else -> dischargeAnchor
    }

    // v5.12: Lock post-throw residual energy to `dischargeAnchor` so circle transition over-reads coming out of
    // a charged move cutscene can never inflate residual energy or synthesize phantom post-cutscene fast moves.
    val finalPostE = if (rawCirclePostE <= dischargeAnchor) {
        dischargeAnchor
    } else {
        dischargeAnchor
    }.coerceIn(0, 100)
    playerSlotEnergyAnchor[slotIdx] = finalPostE
    resetSlotEnergyTracking(
        slotIdx = slotIdx,
        initialEnergy = finalPostE,
        cost1 = if (slowestIsRight) fastCost else slowCost,
        cost2 = if (slowestIsRight) slowCost else fastCost,
        clearThirdFillLatches = finalPostE < 2 * slowCost
    )
    if (debouncedSlowestPct in 101..300) {
        peakSecondFillPct[slotIdx] = max(peakSecondFillPct[slotIdx], debouncedSlowestPct)
    }
    confirmedSlowestFillPct[slotIdx] = debouncedSlowestPct
    if (debouncedFasterPct in 0..300) confirmedFastestFillPct[slotIdx] = debouncedFasterPct
    return finalPostE
}

/**
 * v5.12 / v5.13: Retroactively syncs the most recent unshielded `CHARGED_ATTACK` event when a `FAINT` occurs
 * within 16.0 seconds of the charged attack (eliminating `UNEXPECTED_HP_DELTA` & `SHIELD_DESYNC` when
 * the defender faints and their HP bar disappears before settling at 0%, including match-ending KOs).
 */
internal fun OverlayService.syncRecentUnshieldedChargedAttackOnFaint(faintedActor: String, eventElapsedSec: Double) {
    syncRecentUnshieldedChargedAttackOnFaintInList(
        events = battleTimelineEvents,
        faintedActor = faintedActor,
        eventElapsedSec = eventElapsedSec,
        userHpList = playerSlotHpPct.toList(),
        oppHpList = oppSlotHpPct.toList()
    )
}

internal fun OverlayService.syncRecentUnshieldedChargedAttackOnFaintInList(
    events: MutableList<BattleTimelineEvent>,
    faintedActor: String,
    eventElapsedSec: Double,
    userHpList: List<Int>? = null,
    oppHpList: List<Int>? = null
) {
    val expectedAttacker = if (faintedActor == "opp") "user" else "opp"
    val lastChargeIdx = events.indexOfLast {
        it.type == "CHARGED_ATTACK" && it.actor == expectedAttacker
    }
    if (lastChargeIdx < 0) return
    val ev = events[lastChargeIdx]
    val dt = (eventElapsedSec - ev.t).coerceAtLeast(0.0)
    // v6.02: Extended from 16.0s to 25.0s so slow post-faint switch prompts still sync 0% HP after an unshielded KO charged move
    if (dt > 25.0) return
    val wasExplicitlyShielded = if (faintedActor == "opp") {
        events.drop(lastChargeIdx + 1).any { it.type == "SHIELD" && it.actor == "opp" }
    } else {
        events.drop(lastChargeIdx + 1).any { it.type == "SHIELD" && it.actor == "user" }
    }
    if (wasExplicitlyShielded) return
    val hpBefore = (ev.hpBeforePct ?: 100).coerceIn(1, 100)
    if ((ev.hpAfterPct ?: 0) > 0 || ev.shielded == true) {
        events[lastChargeIdx] = ev.copy(
            shielded = false,
            pokemonShielded = null,
            hpAfterPct = 0,
            hpDeltaPct = hpBefore,
            userSlotHpPct = userHpList ?: ev.userSlotHpPct,
            oppSlotHpPct = oppHpList ?: ev.oppSlotHpPct
        )
    }
}

internal fun OverlayService.computeAuthoritativeCircleEnergy(
    leftFillPct: Int,
    rightFillPct: Int,
    cost1: Int,
    cost2: Int,
    hasSecondMove: Boolean,
    leftInThirdFill: Boolean = false,
    rightInThirdFill: Boolean = false,
    move1Name: String = "",
    move2Name: String = "",
    fallbackSpeciesType: String = "normal"
): Int {
    val validLeft = leftFillPct in 0..300
    val validRight = hasSecondMove && rightFillPct in 0..300 && cost2 > 0
    if (!validLeft && !validRight) return -1

    val c1 = cost1.coerceIn(35, 100)
    val c2 = if (validRight) cost2.coerceIn(35, 100) else c1
    val rightIsPrimaryMove = validRight && shouldSelectRightCircleAsPrimary(
        move1Name = move1Name,
        move1Cost = c1,
        move2Name = move2Name,
        move2Cost = c2,
        hasSecondMove = validRight,
        fallbackSpeciesType = fallbackSpeciesType
    )

    val chosenPct = if (rightIsPrimaryMove) rightFillPct else if (validLeft) leftFillPct else rightFillPct
    val chosenCost = if (rightIsPrimaryMove) c2 else if (validLeft) c1 else c2

    return when {
        chosenPct <= 0 -> 0
        chosenPct in 1..99 -> (((chosenPct * chosenCost) / 100.0).roundToInt()).coerceIn(0, chosenCost - 1)
        chosenPct in 100..199 -> (chosenCost + (((chosenPct - 100) * chosenCost) / 100.0).roundToInt()).coerceIn(chosenCost, min(100, 2 * chosenCost))
        else -> (2 * chosenCost + (((chosenPct - 200) * chosenCost) / 100.0).roundToInt()).coerceIn(min(100, 2 * chosenCost), 100)
    }
}

internal fun OverlayService.detectFloatingHpBarPct(
    screen: Bitmap,
    searchRect: Rect,
    fullScreenWidth: Int,
    isOpponent: Boolean = true
): Int {
    if (isOpponent) {
        sampledOppHasPendingDmg = false
        sampledOppPendingDmgPct = 0
    } else {
        sampledPlayerHasPendingDmg = false
        sampledPlayerPendingDmgPct = 0
    }
    return try {
        val left = searchRect.left.coerceIn(0, screen.width - 1)
        val right = searchRect.right.coerceIn(0, screen.width)
        val top = searchRect.top.coerceIn(0, screen.height - 1)
        val bottom = searchRect.bottom.coerceIn(0, screen.height)
        val cw = right - left
        val ch = bottom - top
        if (cw <= 24 || ch <= 14) return -1

        val minOuterW = (fullScreenWidth * 0.258f).toInt().coerceAtLeast(52)
        val maxOuterW = (fullScreenWidth * 0.312f).toInt().coerceAtLeast(minOuterW + 8)
        val padInset = max(4, (fullScreenWidth * 0.0085f).roundToInt())
        val padSide = max(3, padInset / 2)
        val minOuterH = max(14, (fullScreenWidth * 0.015f).toInt())
        val maxOuterH = max(minOuterH + 14, (fullScreenWidth * 0.044f).toInt())
        val minFillH = max(3, (fullScreenWidth * 0.003f).toInt())
        val maxFillH = max(26, (fullScreenWidth * 0.028f).toInt())

        // Expected left-edge X anchor in full-screen coordinates (relX = absX - left)
        val absAnchorMinX = if (isOpponent) {
            (fullScreenWidth * 0.400f).toInt()
        } else {
            (fullScreenWidth * 0.018f).toInt()
        }
        val absAnchorMaxX = if (isOpponent) {
            (fullScreenWidth * 0.700f).toInt()
        } else {
            (fullScreenWidth * 0.220f).toInt()
        }
        val relAnchorMinX = (absAnchorMinX - left).coerceIn(0, cw - 1)
        val relAnchorMaxX = (absAnchorMaxX - left).coerceIn(relAnchorMinX, cw - 1)
        val minAllowedAbsFillY = (screen.height * 0.065f).toInt()

        val pixels = IntArray(cw * ch)
        screen.getPixels(pixels, 0, cw, left, top, cw, ch)

        fun pixelLuma(pixel: Int): Int {
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            return (r + g + b) / 3
        }

        // v3.83: Neutral White/Grey Capsule Border Classifier (including #0B111E overlay-dimmed borders and pink/bright Tinkaton anti-aliasing).
        // Explicitly rejects yellow/cream fur & feathers (e.g., Ninetales tails, Pidgeot wings)
        // where G >= R - 25 and (G - B) >= 55 so moving Pokémon never hallucinate capsule borders.
        fun isBorderPixel(pixel: Int, refDarkLuma: Int = 40): Boolean {
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            val maxCh = max(r, max(g, b))
            val minCh = min(r, min(g, b))
            val luma = (r + g + b) / 3
            if (luma >= 175) {
                if (g >= r - 25 && (g - b) >= 55) return false
                return (maxCh - minCh) <= 115 && (g - b) <= 64 && b >= 125
            }
            if (luma >= 38) {
                return (luma - refDarkLuma) >= 12 &&
                    (maxCh - minCh) <= 56 &&
                    (g - b) <= 32 &&
                    (r - b) <= 44 &&
                    r >= 34 && g >= 34 && b >= 34
            }
            return false
        }

        // v3.55: Border-Luma-Scaled Multi-Band HP Pixel Classifier:
        // - Bright active HP fill (Green=1, Yellow=2, Coral Red=3) is always valid.
        // - Overlay-dimmed HP fill (under #0B111E at 80..90% opacity) is ONLY enabled when the capsule border
        //   itself is dimmed by an overlay (borderLuma < 185).
        fun classifyHpPixel(pixel: Int, borderLuma: Int = 255): Int {
            val r = (pixel shr 16) and 0xFF
            val g = (pixel shr 8) and 0xFF
            val b = pixel and 0xFF
            // 1. Bright unobstructed HP fill across all 3 zones:
            if (g >= 175 && r <= 120 && b in 105..242 && (g - r) >= 70 && g >= b - 20) return 1
            if (r >= 205 && g in 160..255 && b <= 130 && r >= g - 15 && (r - g) <= 75 && (r - b) >= 82 && (g - b) >= 62) return 2
            if (r >= 185 && g in 40..138 && b in 40..142 && (r - g) >= 68 && (r - b) >= 58 && kotlin.math.abs(g - b) <= 40) return 3
            // 2. Overlay-dimmed HP fill (only when capsule border is dimmed: borderLuma < 185):
            if (borderLuma < 185) {
                if (g in 38..210 && r <= 95 && b in 30..205 && (g - r) >= 15 && (b - r) >= 8 && kotlin.math.abs(g - b) <= 72) return 1
                if (r in 58..215 && g in 48..200 && b <= 88 && r >= g - 14 && (r - g) <= 55 && (r - b) >= 24 && (g - b) >= 18) return 2
                if (r in 45..210 && g in 14..125 && b in 14..130 && (r - g) >= 18 && (r - b) >= 14 && kotlin.math.abs(g - b) <= 42) return 3
            }
            // 3. Orange Pending-Damage Sliver (r >> g >> b) & Depleted Dark Translucent Track:
            if (r >= 130 && g in 60..172 && b <= 68 && (r - g) >= 55 && (g - b) >= 38) return 4
            val maxCh = max(r, max(g, b))
            val minCh = min(r, min(g, b))
            val luma = (r + g + b) / 3
            if (luma in 8..172 && maxCh <= 205 && (maxCh - minCh) <= 118) return 4
            return 0
        }

        data class ScanlineBarCandidate(
            val ry: Int,
            val leftBorderX: Int,
            val rightBorderX: Int,
            val xStart: Int,
            val xEnd: Int,
            val wFill: Int,
            val fullInteriorW: Int,
            val leftBand: Int,
            val borderLuma: Int,
            val pendingW: Int
        )
        val candidates = mutableListOf<ScanlineBarCandidate>()

        var ry = max(0, minAllowedAbsFillY - top)
        while (ry < ch) {
            val rowOffset = ry * cw
            var rx = relAnchorMinX
            while (rx <= relAnchorMaxX) {
                val looseBand = classifyHpPixel(pixels[rowOffset + rx], 100)
                if (looseBand in 1..3) {
                    // 1. Verify Left Outer Border (1..10px left of rx) and peak-align to brightest stroke pixel
                    var leftBorderX = -1
                    var innerPadLuma = 90
                    var px = max(0, rx - 5)
                    while (px <= max(0, rx - 1)) {
                        innerPadLuma = min(innerPadLuma, pixelLuma(pixels[rowOffset + px]))
                        px++
                    }
                    var bx = rx - 1
                    val minBx = max(0, rx - 10)
                    while (bx >= minBx) {
                        if (isBorderPixel(pixels[rowOffset + bx], innerPadLuma)) {
                            leftBorderX = bx
                            if (bx - 1 >= 0 &&
                                isBorderPixel(pixels[rowOffset + bx - 1], innerPadLuma) &&
                                pixelLuma(pixels[rowOffset + bx - 1]) > pixelLuma(pixels[rowOffset + bx])
                            ) {
                                leftBorderX = bx - 1
                            }
                            break
                        }
                        bx--
                    }

                    if (leftBorderX != -1) {
                        // 2. Verify Right Outer Border at leftBorderX + minOuterW .. maxOuterW and peak-align
                        var rightBorderX = -1
                        var rbx = min(cw - 1, leftBorderX + minOuterW)
                        val maxRbx = min(cw - 1, leftBorderX + maxOuterW)
                        while (rbx <= maxRbx) {
                            var insideLuma = 90
                            var ipx = max(0, rbx - 6)
                            while (ipx <= max(0, rbx - 2)) {
                                insideLuma = min(insideLuma, pixelLuma(pixels[rowOffset + ipx]))
                                ipx++
                            }
                            if (isBorderPixel(pixels[rowOffset + rbx], insideLuma)) {
                                rightBorderX = rbx
                                if (rbx + 1 < cw &&
                                    isBorderPixel(pixels[rowOffset + rbx + 1], insideLuma) &&
                                    pixelLuma(pixels[rowOffset + rbx + 1]) > pixelLuma(pixels[rowOffset + rbx])
                                ) {
                                    rightBorderX = rbx + 1
                                }
                                break
                            }
                            rbx++
                        }

                        if (rightBorderX != -1) {
                            val borderLuma = min(
                                pixelLuma(pixels[rowOffset + leftBorderX]),
                                pixelLuma(pixels[rowOffset + rightBorderX])
                            )
                            // 3. Skip the 3..4px dark translucent inner left padding gap (leftBorderX + padSide)
                            //    so a yellow tail behind the left inner gap is never mistaken for a 3% Yellow bar
                            var xStart = -1
                            var initBand = 0
                            val searchStart = min(cw - 1, leftBorderX + padSide)
                            val searchEnd = min(cw - 1, leftBorderX + padSide + 6)
                            var sx = searchStart
                            while (sx <= searchEnd) {
                                val b = classifyHpPixel(pixels[rowOffset + sx], borderLuma)
                                if (b in 1..3) {
                                    xStart = sx
                                    initBand = b
                                    break
                                }
                                sx++
                            }

                            if (xStart != -1) {
                                val outerW = rightBorderX - leftBorderX
                                val fullInteriorW = max(1, outerW - padInset)
                                val trackEndX = rightBorderX - max(2, padInset / 2)
                                val maxScanX = min(cw - 1, trackEndX)

                                // 4. Lock onto the authoritative color band & reference RGB of the leftmost HP bar portion
                                val secondBand = if (xStart + 1 <= maxScanX) classifyHpPixel(pixels[rowOffset + xStart + 1], borderLuma) else initBand
                                val leftBand = if (secondBand in 1..3) secondBand else initBand
                                var refRSum = 0
                                var refGSum = 0
                                var refBSum = 0
                                var refCount = 0
                                var sxRef = xStart
                                val maxRefX = min(maxScanX, xStart + 3)
                                while (sxRef <= maxRefX) {
                                    val pRef = pixels[rowOffset + sxRef]
                                    if (classifyHpPixel(pRef, borderLuma) == leftBand || sxRef == xStart) {
                                        refRSum += (pRef shr 16) and 0xFF
                                        refGSum += (pRef shr 8) and 0xFF
                                        refBSum += pRef and 0xFF
                                        refCount++
                                    }
                                    sxRef++
                                }
                                var refR = refRSum / max(1, refCount)
                                var refG = refGSum / max(1, refCount)
                                var refB = refBSum / max(1, refCount)

                                // 5. Scan rightward across ONLY the leftmost colored HP bar portion;
                                //    stop immediately if the color steps into an Orange pending-damage sliver or depleted track.
                                //    If the bar emerges from underneath the #0B111E overlay into unobstructed screen, update refRGB.
                                var xEnd = xStart
                                var gap = 0
                                var scanX = xStart + 1
                                while (scanX <= maxScanX) {
                                    val p = pixels[rowOffset + scanX]
                                    val cls = classifyHpPixel(p, borderLuma)
                                    val r = (p shr 16) and 0xFF
                                    val g = (p shr 8) and 0xFF
                                    val b = p and 0xFF
                                    val curLuma = (r + g + b) / 3
                                    val refLuma = (refR + refG + refB) / 3
                                    if (cls == leftBand && curLuma > refLuma + 42) {
                                        refR = r
                                        refG = g
                                        refB = b
                                    }
                                    val isPendingDamageStep = when (leftBand) {
                                        2 -> ((r - g) - (refR - refG)) > 28 || (refG - g) > 36
                                        3 -> ((g - b) - (refG - refB)) > 28
                                        else -> false
                                    }
                                    if (cls == leftBand && !isPendingDamageStep) {
                                        xEnd = scanX
                                        gap = 0
                                        scanX++
                                    } else if (isPendingDamageStep) {
                                        break
                                    } else if (gap < 7) {
                                        gap++
                                        scanX++
                                    } else {
                                        break
                                    }
                                }

                                // v3.54: Measure contiguous Orange Pending-Damage Sliver immediately right of xEnd
                                var pendingW = 0
                                var pendingGap = 0
                                var pxScan = xEnd + 1
                                val maxPendingScanX = min(maxScanX, xEnd + max(65, fullInteriorW / 3))
                                while (pxScan <= maxPendingScanX) {
                                    val p = pixels[rowOffset + pxScan]
                                    val r = (p shr 16) and 0xFF
                                    val g = (p shr 8) and 0xFF
                                    val b = p and 0xFF
                                    val isOrangePending = (r >= 130 && g in 42..182 && b <= 88 && (r - b) >= 52 && (r - g) >= 18 && (g - b) >= 16) ||
                                        (borderLuma < 185 && r in 65..205 && g in 28..145 && b <= 72 && (r - b) >= 28 && (r - g) >= 12) ||
                                        (leftBand == 2 && r >= 145 && b <= 92 && (r - b) >= 55 && (((r - g) - (refR - refG)) > 26 || (refG - g) > 34)) ||
                                        (leftBand == 3 && r >= 150 && g >= 62 && b <= 88 && ((g - b) - (refG - refB)) > 26)
                                    if (isOrangePending) {
                                        pendingW = (pxScan - (xEnd + 1)) + 1
                                        pendingGap = 0
                                        pxScan++
                                    } else if (pendingGap < 2) {
                                        pendingGap++
                                        pxScan++
                                    } else {
                                        break
                                    }
                                }

                                val wFill = xEnd - xStart + 1
                                val minRequiredInteriorW = (fullScreenWidth * 0.245f).toInt()
                                if (wFill >= 2 && fullInteriorW >= minRequiredInteriorW) {
                                    val candHpFraction = (wFill.toFloat() / fullInteriorW.toFloat()).coerceIn(0.01f, 1.0f)
                                    val expectedDarkFraction = (1.0f - candHpFraction).coerceIn(0.0f, 1.0f)

                                    val darkTrackStartX = xEnd + pendingW + 1
                                    val darkTrackSpan = max(0, trackEndX - darkTrackStartX + 1)
                                    var darkPx = 0
                                    var brightWhitePx = 0
                                    var dx = darkTrackStartX
                                    while (dx <= trackEndX) {
                                        val p = pixels[rowOffset + dx]
                                        val r = (p shr 16) and 0xFF
                                        val g = (p shr 8) and 0xFF
                                        val b = p and 0xFF
                                        val pLuma = (r + g + b) / 3
                                        val maxCh = max(r, max(g, b))
                                        val minCh = min(r, min(g, b))
                                        val chroma = maxCh - minCh
                                        // Genuine depleted dark track pixel in Pokémon GO (neutral dark grey/black):
                                        val isDarkTrack = (pLuma <= 85 && chroma <= 45) ||
                                            (borderLuma < 185 && pLuma <= 65) ||
                                            (classifyHpPixel(p, borderLuma) == 4 && pLuma <= 95)
                                        if (isDarkTrack) darkPx++
                                        // Bright Pokémon body pixel (e.g. Solgaleo white mane/chest/legs):
                                        if (pLuma >= 145 || (pLuma >= 130 && (chroma > 45 || r > 150))) brightWhitePx++
                                        dx++
                                    }

                                    // v3.90: Solgaleo Body Rejection & Dark Track Interior Verification:
                                    // 1. Minimum interior width floor enforced (fullInteriorW >= 0.245 * fullScreenWidth).
                                    // 2. Bright Pokémon body pixels (pLuma >= 145) must not bleed into the depleted track.
                                    // 3. Dark track interior must match (100% - HP%) ± 10%.
                                    val maxAllowedBright = max(3, (darkTrackSpan * 0.10f).toInt())
                                    val darkFraction = (darkPx + pendingW).toFloat() / fullInteriorW.toFloat()
                                    val darkDiff = kotlin.math.abs(darkFraction - expectedDarkFraction)

                                    val isValidDarkTrack = if (darkTrackSpan > 10) {
                                        brightWhitePx <= maxAllowedBright &&
                                            (darkPx.toFloat() / max(1, darkTrackSpan).toFloat()) >= 0.75f &&
                                            darkDiff <= 0.10f
                                    } else {
                                        // Nearly full bar (HP >= ~95%): remainder span is <= 10px
                                        brightWhitePx <= 3 && (darkDiff <= 0.10f || (expectedDarkFraction <= 0.08f && darkFraction <= 0.08f))
                                    }

                                    if (isValidDarkTrack) {
                                        candidates.add(
                                            ScanlineBarCandidate(
                                                ry = ry,
                                                leftBorderX = leftBorderX,
                                                rightBorderX = rightBorderX,
                                                xStart = xStart,
                                                xEnd = xEnd,
                                                wFill = wFill,
                                                fullInteriorW = fullInteriorW,
                                                leftBand = leftBand,
                                                borderLuma = borderLuma,
                                                pendingW = pendingW
                                            )
                                        )
                                        break
                                    }
                                }
                            }
                        }
                    }
                    rx++
                } else {
                    rx++
                }
            }
            ry += 2
        }

        if (candidates.size < 2) return -1

        // v3.90: Previous stable HP% lookup for multi-candidate proximity prioritization
        val prevStableHp = if (isOpponent) {
            val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
            val oppIdx = if (detectedOpponents.isNotEmpty()) {
                detectedOpponents.indexOfFirst {
                    FormResolver.extractBaseSpecies(it).equals(activeOppBase, ignoreCase = true)
                }.let { if (it in 0..2) it else 0 }
            } else 0
            confirmedOppSlotHpPct.getOrElse(oppIdx) { 100 }.coerceIn(1, 100)
        } else {
            val userIdx = (currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
            confirmedPlayerSlotHpPct.getOrElse(userIdx) { 100 }.coerceIn(1, 100)
        }

        // v3.83/v3.90: Fixed-Height Enclosed Rectangle Verification, Exterior Color-Bleed Rejection & Candidate Proximity Prioritization:
        var bestCluster: List<ScanlineBarCandidate>? = null
        var bestDeltaHp = Int.MAX_VALUE
        var bestClusterSize = 0
        for (i in candidates.indices) {
            val anchor = candidates[i]
            val cluster = candidates.filter { c ->
                kotlin.math.abs(c.ry - anchor.ry) <= 34 &&
                    kotlin.math.abs(c.leftBorderX - anchor.leftBorderX) <= 5 &&
                    kotlin.math.abs(c.rightBorderX - anchor.rightBorderX) <= 5 &&
                    kotlin.math.abs(c.wFill - anchor.wFill) <= 8 &&
                    c.leftBand == anchor.leftBand
            }
            if (cluster.size in 2..18) {
                val yMinC = cluster.minOf { it.ry }
                val yMaxC = cluster.maxOf { it.ry }
                val fillH = yMaxC - yMinC
                if (fillH in minFillH..maxFillH) {
                    val sortedLb = cluster.map { it.leftBorderX }.sorted()
                    val sortedRb = cluster.map { it.rightBorderX }.sorted()
                    val sortedXs = cluster.map { it.xStart }.sorted()
                    val sortedXe = cluster.map { it.xEnd }.sorted()
                    val sortedBl = cluster.map { it.borderLuma }.sorted()
                    val lb = sortedLb[sortedLb.size / 2]
                    val rb = sortedRb[sortedRb.size / 2]
                    val xs = sortedXs[sortedXs.size / 2]
                    val xe = sortedXe[sortedXe.size / 2]
                    val medBorderLuma = sortedBl[sortedBl.size / 2]
                    val spanSamples = max(1, (rb - lb - 12) / 3)
                    val midY = (yMinC + yMaxC) / 2

                    val topBorders = mutableListOf<Int>()
                    var by = max(0, yMinC - 22)
                    while (by < yMinC) {
                        val bRowOffset = by * cw
                        val innerPadY1 = min(ch - 1, max(by + 1, yMinC - 1))
                        val innerPadY2 = min(ch - 1, max(by + 2, yMinC - 2))
                        var bCnt = 0
                        var sbx = lb + 6
                        while (sbx <= rb - 6) {
                            var refDark = min(
                                pixelLuma(pixels[innerPadY1 * cw + sbx]),
                                pixelLuma(pixels[innerPadY2 * cw + sbx])
                            )
                            if (sbx > xe + 2) {
                                refDark = min(refDark, pixelLuma(pixels[midY * cw + sbx]))
                            }
                            if (isBorderPixel(pixels[bRowOffset + sbx], refDark)) bCnt++
                            sbx += 3
                        }
                        if (bCnt >= (spanSamples * 0.40f).toInt()) {
                            topBorders.add(by)
                        }
                        by++
                    }

                    val botBorders = mutableListOf<Int>()
                    by = yMaxC + 1
                    val maxBy = min(ch - 1, yMaxC + 22)
                    while (by <= maxBy) {
                        val bRowOffset = by * cw
                        val innerPadY1 = max(0, min(by - 1, yMaxC + 1))
                        val innerPadY2 = max(0, min(by - 2, yMaxC + 2))
                        var bCnt = 0
                        var sbx = lb + 6
                        while (sbx <= rb - 6) {
                            var refDark = min(
                                pixelLuma(pixels[innerPadY1 * cw + sbx]),
                                pixelLuma(pixels[innerPadY2 * cw + sbx])
                            )
                            if (sbx > xe + 2) {
                                refDark = min(refDark, pixelLuma(pixels[midY * cw + sbx]))
                            }
                            if (isBorderPixel(pixels[bRowOffset + sbx], refDark)) bCnt++
                            sbx += 3
                        }
                        if (bCnt >= (spanSamples * 0.40f).toInt()) {
                            botBorders.add(by)
                        }
                        by++
                    }

                    var matchedTopY = -1
                    var matchedBotY = -1
                    for (ty in topBorders) {
                        for (botY in botBorders) {
                            val outerH = botY - ty
                            if (outerH in minOuterH..maxOuterH) {
                                matchedTopY = ty
                                matchedBotY = botY
                                break
                            }
                        }
                        if (matchedTopY != -1) break
                    }

                    if (matchedTopY != -1 && matchedBotY != -1) {
                        val fillSpan = max(1, xe - xs + 1)
                        val stepX = max(1, fillSpan / 8)
                        var aboveSamples = 0
                        var aboveSameColor = 0
                        var belowSamples = 0
                        var belowSameColor = 0
                        val aboveY = max(0, matchedTopY - 4)
                        val belowY = min(ch - 1, matchedBotY + 4)
                        var sx = xs
                        while (sx <= xe) {
                            if (matchedTopY >= 4) {
                                aboveSamples++
                                if (classifyHpPixel(pixels[aboveY * cw + sx], medBorderLuma) == anchor.leftBand) {
                                    aboveSameColor++
                                }
                            }
                            if (matchedBotY + 4 < ch) {
                                belowSamples++
                                if (classifyHpPixel(pixels[belowY * cw + sx], medBorderLuma) == anchor.leftBand) {
                                    belowSameColor++
                                }
                            }
                            sx += stepX
                        }

                        var leftSamples = 0
                        var leftSameColor = 0
                        val leftOutX = max(0, lb - 5)
                        if (lb >= 5) {
                            var sy = yMinC
                            while (sy <= yMaxC) {
                                leftSamples++
                                if (classifyHpPixel(pixels[sy * cw + leftOutX], medBorderLuma) == anchor.leftBand) {
                                    leftSameColor++
                                }
                                sy += 2
                            }
                        }

                        val bleedsVertically = (aboveSamples > 0 && (aboveSameColor.toFloat() / aboveSamples.toFloat()) > 0.45f) &&
                            (belowSamples > 0 && (belowSameColor.toFloat() / belowSamples.toFloat()) > 0.45f)
                        val bleedsLeft = leftSamples > 0 && (leftSameColor.toFloat() / leftSamples.toFloat()) > 0.45f

                        if (!bleedsVertically && !bleedsLeft) {
                            val clusterSortedWidths = cluster.map { it.wFill }.sorted()
                            val clusterSortedFullWidths = cluster.map { it.fullInteriorW }.sorted()
                            val clusterMedWFill = clusterSortedWidths[clusterSortedWidths.size / 2]
                            val clusterMedFullW = clusterSortedFullWidths[clusterSortedFullWidths.size / 2].coerceAtLeast(1)
                            val candClusterHp = ((clusterMedWFill.toFloat() / clusterMedFullW.toFloat()) * 100f).roundToInt().coerceIn(1, 100)
                            val deltaHp = kotlin.math.abs(candClusterHp - prevStableHp)

                            val isBetter = when {
                                bestCluster == null -> true
                                deltaHp < bestDeltaHp -> true
                                deltaHp == bestDeltaHp && cluster.size > bestClusterSize -> true
                                else -> false
                            }

                            if (isBetter) {
                                bestCluster = cluster
                                bestDeltaHp = deltaHp
                                bestClusterSize = cluster.size
                            }
                        }
                    }
                }
            }
        }

        val validCluster = bestCluster ?: return -1
        val sortedWidths = validCluster.map { it.wFill }.sorted()
        val sortedFullWidths = validCluster.map { it.fullInteriorW }.sorted()
        val sortedPendingWidths = validCluster.map { it.pendingW }.sorted()
        val medianWFill = sortedWidths[sortedWidths.size / 2]
        val medianFullInteriorW = sortedFullWidths[sortedFullWidths.size / 2].coerceAtLeast(1)
        val medianPendingW = sortedPendingWidths[sortedPendingWidths.size / 2]
        val minValidPendingPx = max(2, (medianFullInteriorW * 0.008f).roundToInt())
        val hasPendingDmg = medianPendingW >= minValidPendingPx
        val pendingPct = if (hasPendingDmg) {
            ((medianPendingW.toFloat() / medianFullInteriorW.toFloat()) * 100f).roundToInt().coerceIn(1, 35)
        } else 0
        val medianRowY = top + validCluster[validCluster.size / 2].ry
        if (isOpponent) {
            sampledOppHasPendingDmg = hasPendingDmg
            sampledOppPendingDmgPct = pendingPct
            sampledOppHpRowY = medianRowY
        } else {
            sampledPlayerHasPendingDmg = hasPendingDmg
            sampledPlayerPendingDmgPct = pendingPct
            sampledPlayerHpRowY = medianRowY
        }
        ((medianWFill.toFloat() / medianFullInteriorW.toFloat()) * 100f).roundToInt().coerceIn(1, 100)
    } catch (_: Exception) {
        if (isOpponent) sampledOppHpRowY = -1 else sampledPlayerHpRowY = -1
        -1
    }
}
