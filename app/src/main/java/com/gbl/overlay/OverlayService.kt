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

/**
 * OverlayService:
 * Floating HUD and real-time screen analysis for Pokémon GO Battle League.
 * - Android 14+ compliant MediaProjection callback registration & background frame reader
 * - Real-time OCR detection for Opponent Pokémon (Top-Right nameplate region) with fuzzy matching
 * - Real-time OCR detection for Player Active Switch (Top-Left nameplate & Bottom move buttons)
 * - League-aware FormResolver (Ninetales, Giratina, Zacian, Deoxys, Dialga, Palkia, Landorus, Necrozma)
 * - Shadow modifier toggle (1.2x Attack / 0.833x Defense) & Form cycling
 * - Exact PvPoke Charged Move damage calculation (Player -> Opponent & Opponent -> Player)
 */
class OverlayService : LifecycleService() {

    companion object {
        const val APP_VERSION = "6.21"
        const val ACTION_START_OVERLAY = "com.gbl.overlay.ACTION_START_OVERLAY"
        const val ACTION_STOP_OVERLAY = "com.gbl.overlay.ACTION_STOP_OVERLAY"
        const val ACTION_TOGGLE_OVERLAY = "com.gbl.overlay.ACTION_TOGGLE_OVERLAY"
        const val ACTION_MINIMIZE_OVERLAY = "com.gbl.overlay.ACTION_MINIMIZE_OVERLAY"
        const val ACTION_RESTORE_OVERLAY = "com.gbl.overlay.ACTION_RESTORE_OVERLAY"
        const val ACTION_OPEN_BATTLE_LOG = "com.gbl.overlay.ACTION_OPEN_BATTLE_LOG"
        const val ACTION_SHORT_START = "com.gbl.overlay.START"
        const val ACTION_SHORT_STOP = "com.gbl.overlay.STOP"
        const val ACTION_SHORT_TOGGLE = "com.gbl.overlay.TOGGLE"
        const val ACTION_SHORT_BATTLE_LOG = "com.gbl.overlay.BATTLE_LOG"
        const val ACTION_TOGGLE_LAYOUT = "com.gbl.overlay.ACTION_TOGGLE_LAYOUT"
        const val ACTION_UPDATE_PRESET = "com.gbl.overlay.ACTION_UPDATE_PRESET"
        const val ACTION_UPDATE_SETTINGS = "com.gbl.overlay.ACTION_UPDATE_SETTINGS"
        const val ACTION_START_BATTLE = "com.gbl.overlay.ACTION_START_BATTLE"

        @Volatile var isInstanceRunning: Boolean = false
        @Volatile var hasActiveMediaProjection: Boolean = false
        @Volatile var onRunningStateChanged: (() -> Unit)? = null

        fun notifyRunningStateChanged() {
            val cb = onRunningStateChanged ?: return
            Handler(Looper.getMainLooper()).post {
                try {
                    cb.invoke()
                } catch (_: Exception) {}
            }
        }

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_PRESET_JSON = "extra_preset_json"
        const val EXTRA_TEAM_NAME = "team"
        const val EXTRA_OPP_COUNT_MODE = "extra_opp_count_mode"
        const val EXTRA_OVERLAY_SCALE_PCT = "extra_overlay_scale_pct"
        const val EXTRA_OVERLAY_TRANSPARENCY_PCT = "extra_overlay_transparency_pct"
        const val EXTRA_APP_THEME_ID = "extra_app_theme_id"
        const val EXTRA_ENABLE_4_CHARGED_MOVES = "extra_enable_4_charged_moves"
        const val EXTRA_DISABLE_BATTLE_TOASTS = "extra_disable_battle_toasts"
        const val EXTRA_SHOW_TACTICAL_RECOMMENDATIONS = "extra_show_tactical_recommendations"
        const val EXTRA_SHOW_SHIELD_DECISION_OVERLAY = "extra_show_shield_decision_overlay"
        const val EXTRA_ENABLE_HP_TRACKING = "extra_enable_hp_tracking"
        const val EXTRA_ENABLE_ENERGY_TRACKING = "extra_enable_energy_tracking"
        const val EXTRA_FAST_DETECT_TURN_OFFSET = "extra_fast_detect_turn_offset"
        const val EXTRA_CHARGE_CIRCLE_PRIORITY_MODE = "extra_charge_circle_priority_mode"
        const val EXTRA_ENABLE_ALT_FAST_MOVE_DETECT = "extra_enable_alt_fast_move_detect"
        const val EXTRA_AI_ADVICE_HUD_POSITION = "extra_ai_advice_hud_position"
        const val EXTRA_SWAP_THROW_ROLLBACK_WINDOW_MS = "extra_swap_throw_rollback_window_ms"
        const val EXTRA_ALT_FAST_DETECT_STRICTNESS = "extra_alt_fast_detect_strictness"
        const val EXTRA_SHIELD_CHIP_TOLERANCE_PCT = "extra_shield_chip_tolerance_pct"

        const val PREFS_KEY_ENABLE_4_CHARGED_MOVES = "enable_4_charged_moves"
        const val PREFS_KEY_DISABLE_BATTLE_TOASTS = "disable_battle_toasts"
        const val PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS = "show_tactical_recommendations"
        const val PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY = "show_shield_decision_overlay"
        const val PREFS_KEY_AI_ADVICE_HUD_POSITION = "ai_advice_hud_position"
        const val DEFAULT_AI_ADVICE_HUD_POSITION = "bottom" // "bottom" (new v6.00 default) | "top"
        const val PREFS_KEY_ENABLE_HP_TRACKING = "enable_hp_tracking"
        const val DEFAULT_ENABLE_HP_TRACKING = true
        const val PREFS_KEY_ENABLE_ENERGY_TRACKING = "enable_energy_tracking"
        const val DEFAULT_ENABLE_ENERGY_TRACKING = true
        const val PREFS_KEY_FAST_DETECT_TURN_OFFSET = "fast_detect_turn_offset"
        const val DEFAULT_FAST_DETECT_TURN_OFFSET = 1 // v6.02 default: +1 Turn (absorbs 500ms damage registration lag)
        const val PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE = "charge_circle_priority_mode"
        const val DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE = "smart_hybrid"
        const val PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT = "enable_alt_fast_move_detect"
        const val DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT = true
        const val PREFS_KEY_V602_SCANNER_DEFAULTS_MIGRATED = "gbl_v602_scanner_defaults_migrated"
        const val PREFS_KEY_INSTALLED_VERSION_CODE = "gbl_last_installed_version_code"
        const val PREFS_KEY_OVERLAY_TRANSPARENCY_PCT = "overlay_transparency_pct"
        const val PREFS_KEY_APP_THEME_ID = "gbl_app_theme_id"
        const val PREFS_KEY_SHOW_THEME_WATERMARK = "gbl_show_theme_watermark"
        const val PREFS_KEY_LAST_SYNC_TIMESTAMP = "last_sync_timestamp"
        const val PREFS_KEY_BATTLE_LOGS = "gbl_battle_logs_v1"
        const val PREFS_KEY_AI_TRAINING_LOGS = "gbl_ai_training_logs_v1"
        const val PREFS_KEY_AI_LOGS_SPLIT_DONE = "gbl_ai_logs_split_v350_done"
        // v6.00: Mode-Independent Meta Tab, Season Blending & Limited Cup Standard League Blending Constants
        const val PREFS_KEY_META_TAB_LEAGUE_GBL = "gbl_meta_tab_league_gbl_v600"
        const val PREFS_KEY_META_TAB_LEAGUE_SHOW6 = "gbl_meta_tab_league_show6_v600"
        const val PREFS_KEY_META_TAB_SCOPE = "gbl_meta_tab_scope_v600" // "season" | "last25" | "last50"
        const val PREFS_KEY_GBL_META_LOG_WEIGHT_PCT = "gbl_meta_log_weight_pct_v600"
        const val DEFAULT_GBL_META_LOG_WEIGHT_PCT = 70
        const val PREFS_KEY_SHOW6_META_LOG_WEIGHT_PCT = "gbl_show6_meta_log_weight_pct_v600"
        const val DEFAULT_SHOW6_META_LOG_WEIGHT_PCT = 60
        const val PREFS_KEY_GBL_META_DECAY_FACTOR = "gbl_meta_decay_factor_v600"
        const val DEFAULT_GBL_META_DECAY_FACTOR = 0.05f
        const val PREFS_KEY_SHOW6_META_DECAY_FACTOR = "gbl_show6_meta_decay_factor_v600"
        const val DEFAULT_SHOW6_META_DECAY_FACTOR = 0.05f
        const val PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL = "gbl_limited_std_blend_pct_gbl_v601"
        const val DEFAULT_LIMITED_STD_BLEND_PCT_GBL = 50 // 50% default starting point of fade for GBL Blind 3 Limited Cups
        const val PREFS_KEY_LIMITED_STD_BLEND_PCT_SHOW6 = "gbl_limited_std_blend_pct_show6_v600"
        const val DEFAULT_LIMITED_STD_BLEND_PCT_SHOW6 = 0
        const val PREFS_KEY_LIMITED_STD_DECAY_GBL = "gbl_limited_std_decay_gbl_v601"
        const val DEFAULT_LIMITED_STD_DECAY_GBL = 0.10f // Fast (0.10) default for GBL Limited Cups
        const val PREFS_KEY_LIMITED_STD_DECAY_SHOW6 = "gbl_limited_std_decay_show6_v600"
        const val DEFAULT_LIMITED_STD_DECAY_SHOW6 = 0.06f
        // v5.10: AI Training & Anomaly Telemetry Auto-Upload Constants
        const val PREFS_KEY_AI_TELEMETRY_V510_MIGRATED = "gbl_ai_telemetry_v510_migrated"
        const val PREFS_KEY_AI_TELEMETRY_ONBOARDING_SHOWN = "gbl_ai_telemetry_v510_onboarding_shown"
        const val PREFS_KEY_AUTO_UPLOAD_AI_LOGS = "gbl_auto_upload_ai_logs_v510"
        const val PREFS_KEY_PENDING_AI_TELEMETRY_V510 = "gbl_pending_ai_telemetry_v510"
        const val PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_MS = "gbl_last_ai_telemetry_upload_ms_v510"
        const val PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_STATUS = "gbl_last_ai_telemetry_upload_status_v510"
        const val PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT = "gbl_total_ai_telemetry_uploaded_count_v510"
        const val PREFS_KEY_TOTAL_AI_ANOMALIES_DETECTED_COUNT = "gbl_total_ai_anomalies_detected_count_v510"
        const val PREFS_KEY_DEVICE_TELEMETRY_HASH = "gbl_device_telemetry_hash_v510"
        // v5.13: Debounce Filters & Settling Delays Change Telemetry Constants
        const val PREFS_KEY_LAST_DEBOUNCE_SETTINGS_SNAPSHOT_V513 = "gbl_last_debounce_settings_snapshot_v513"
        const val PREFS_KEY_PENDING_SETTINGS_CHANGES_V513 = "gbl_pending_settings_changes_v513"
        const val PREFS_KEY_SETTINGS_CHANGE_HISTORY_V513 = "gbl_settings_change_history_v513"
        const val AI_TELEMETRY_BRANCH = "ai-telemetry-logs"
        const val AI_TELEMETRY_MIN_BATTLES_ON_STOP = 5
        const val AI_TELEMETRY_DAILY_INTERVAL_MS = 24L * 60L * 60L * 1000L
        @Volatile var isAiTelemetryUploadInFlight: Boolean = false

        /**
         * v4.08: Scanner-Calibrated 18-Type Charged Move Contrast Ranking (1 = Highest Contrast, 18 = Lowest Contrast).
         * Engineered directly from `measureSingleChargeCircleFillPct`:
         * - `luma = 0.299R + 0.587G + 0.114B` vs dark unfilled background (`luma 35-55`)
         * - `sat = max(R,G,B) - min(R,G,B)` vs `avgTopSat >= 42` 100%-ready cap gate
         * - Spotlight & white-icon immunity `!(lumaDn >= 152 && satDn <= 40)`
         * - 2nd/3rd fill white perimeter ring separation (`sat <= 45`, `luma >= 198`)
         *
         * Tier S (1-5): Optimal Chroma & Mid-High Luma (Fire, Grass, Fairy, Psychic, Electric)
         * Tier A (6-10): Strong Chroma & Reliable Step (Water, Bug, Fighting, Poison, Ground)
         * Tier B (11-14): Moderate — Pastel or Low-Luma Indigo (Ice, Dragon, Flying, Rock)
         * Tier C (15-18): Low-Contrast Hazard — Achromatic Silver/Grey or Very Dark (Ghost, Steel, Normal, Dark)
         */
        val MOVE_TYPE_SCANNER_CONTRAST_RANK: Map<String, Int> = mapOf(
            // Tier S (Ranks 1-5)
            "fire" to 1,
            "grass" to 2,
            "fairy" to 3,
            "psychic" to 4,
            "electric" to 5,
            // Tier A (Ranks 6-10)
            "water" to 6,
            "bug" to 7,
            "fighting" to 8,
            "poison" to 9,
            "ground" to 10,
            // Tier B (Ranks 11-14)
            "ice" to 11,
            "dragon" to 12,
            "flying" to 13,
            "rock" to 14,
            // Tier C (Ranks 15-18)
            "ghost" to 15,
            "steel" to 16,
            "normal" to 17,
            "dark" to 18
        )
        const val AI_LOG_RETENTION_MS = 7L * 24L * 60L * 60L * 1000L
        const val PREFS_KEY_DELETED_LOG_IDS = "gbl_deleted_log_ids_v1"
        const val PREFS_KEY_DELETED_TEAM_IDS = "gbl_deleted_team_ids_v1"
        const val PREFS_KEY_DELETED_LOGS_TRASH = "gbl_deleted_battles_trash_v1"
        const val PREFS_KEY_DELETED_TEAMS_TRASH = "gbl_deleted_teams_trash_v1"
        const val PREFS_KEY_GBL_SEASONS_JSON = "gbl_seasons_json_v1"
        const val PREFS_KEY_SYNC_GITHUB_TOKEN = "gbl_sync_github_token"

        const val PREFS_KEY_TIER_SW_MIN = "gbl_tier_sw_min"
        const val PREFS_KEY_TIER_W_MIN = "gbl_tier_w_min"
        const val PREFS_KEY_TIER_L_MAX = "gbl_tier_l_max"
        const val PREFS_KEY_TIER_SL_MAX = "gbl_tier_sl_max"
        const val DEFAULT_TIER_SW_MIN = 620
        const val DEFAULT_TIER_W_MIN = 530
        const val DEFAULT_TIER_L_MAX = 470
        const val DEFAULT_TIER_SL_MAX = 380

        const val PREFS_KEY_MACH_ELITE_MIN = "gbl_mach_elite_min"
        const val PREFS_KEY_MACH_SOLID_MIN = "gbl_mach_solid_min"
        const val PREFS_KEY_MACH_PLAYABLE_MIN = "gbl_mach_playable_min"
        const val PREFS_KEY_MACH_RISKY_MIN = "gbl_mach_risky_min"
        const val DEFAULT_MACH_ELITE_MIN = 650
        const val DEFAULT_MACH_SOLID_MIN = 610
        const val DEFAULT_MACH_PLAYABLE_MIN = 580
        const val DEFAULT_MACH_RISKY_MIN = 540

        // v3.86: Energy Meter Debounce Samples & Live Energy Update Toasts
        const val PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES = "gbl_energy_debounce_samples"
        const val DEFAULT_ENERGY_DEBOUNCE_SAMPLES = 2
        const val PREFS_KEY_ENERGY_UPDATE_TOASTS = "gbl_energy_update_toasts"
        const val DEFAULT_ENERGY_UPDATE_TOASTS = true

        // v3.89: Independent HP Bar Meter Debounce Samples (2 / 3 / 4 Samples)
        const val PREFS_KEY_HP_DEBOUNCE_SAMPLES = "gbl_hp_debounce_samples"
        const val DEFAULT_HP_DEBOUNCE_SAMPLES = 2

        // v3.90: Configurable Debounce Error Tolerance (0 / 1 / 2 / 3%, Default 1%)
        const val PREFS_KEY_DEBOUNCE_TOLERANCE_PCT = "gbl_debounce_tolerance_pct"
        const val DEFAULT_DEBOUNCE_TOLERANCE_PCT = 1

        // v4.12: Proactive Fast-Move Energy Lead Time (0 / 200 / 300 / 400ms, Default 300ms)
        const val PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS = "gbl_proactive_energy_lead_ms"
        const val DEFAULT_PROACTIVE_ENERGY_LEAD_MS = 300

        // v6.02: Swap-and-Immediate-Throw Rollback Window, Alt Fast Move Override Strictness & Shield Chip Tolerance
        const val PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS = "gbl_swap_throw_rollback_window_ms"
        const val DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS = 4000 // 0 (Off) | 3000 | 4000 (Default) | 5000
        const val PREFS_KEY_ALT_FAST_DETECT_STRICTNESS = "gbl_alt_fast_detect_strictness"
        const val DEFAULT_ALT_FAST_DETECT_STRICTNESS = "strict" // "strict" (Default) | "balanced" | "aggressive"
        const val PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT = "gbl_shield_chip_tolerance_pct"
        const val DEFAULT_SHIELD_CHIP_TOLERANCE_PCT = 10 // 6 | 10 (Default) | 14

        // v6.06: Haptics & Tactical Vibration Alerts (Synchronized with Swap Clock & Charged Move Blink Indicators)
        const val PREFS_KEY_HAPTIC_MASTER_ENABLED = "gbl_haptic_master_enabled"
        const val DEFAULT_HAPTIC_MASTER_ENABLED = true
        const val PREFS_KEY_HAPTIC_OPP_SWAP_ENABLED = "gbl_haptic_opp_swap_enabled"
        const val DEFAULT_HAPTIC_OPP_SWAP_ENABLED = true
        const val PREFS_KEY_HAPTIC_OPP_SWAP_WARN_SEC = "gbl_haptic_opp_swap_warn_sec"
        const val DEFAULT_HAPTIC_OPP_SWAP_WARN_SEC = 5 // 2..10s
        const val PREFS_KEY_HAPTIC_OPP_CHARGE_WARN_ENABLED = "gbl_haptic_opp_charge_warn_enabled"
        const val DEFAULT_HAPTIC_OPP_CHARGE_WARN_ENABLED = true
        const val PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS = "gbl_haptic_charge_timing_fasts"
        const val DEFAULT_HAPTIC_CHARGE_TIMING_FASTS = 1 // 1 or 2 fast moves

        // v6.07: 1-Battle Full-Screen DVR & Frame-Synced Deep Logger Constants
        const val PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN = "gbl_show_one_battle_dvr_btn"
        const val DEFAULT_SHOW_ONE_BATTLE_DVR_BTN = false
        const val PREFS_KEY_ARM_ONE_BATTLE_DVR = "gbl_arm_one_battle_dvr"
        const val PREFS_KEY_LAST_DVR_UPLOAD_MS = "gbl_last_dvr_upload_ms"
        const val PREFS_KEY_LAST_DVR_UPLOAD_PATH = "gbl_last_dvr_upload_path"
        const val PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT = "gbl_total_dvr_uploaded_count"

        @Volatile var activeEnergyDebounceSamples: Int = DEFAULT_ENERGY_DEBOUNCE_SAMPLES
        @Volatile var activeEnergyUpdateToasts: Boolean = DEFAULT_ENERGY_UPDATE_TOASTS
        @Volatile var activeHpDebounceSamples: Int = DEFAULT_HP_DEBOUNCE_SAMPLES
        @Volatile var activeDebounceTolerancePct: Int = DEFAULT_DEBOUNCE_TOLERANCE_PCT
        @Volatile var activeProactiveEnergyLeadMs: Int = DEFAULT_PROACTIVE_ENERGY_LEAD_MS
        @Volatile var activeSwapThrowRollbackWindowMs: Int = DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
        @Volatile var activeAltFastDetectStrictness: String = DEFAULT_ALT_FAST_DETECT_STRICTNESS
        @Volatile var activeShieldChipTolerancePct: Int = DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
        @Volatile var activeHapticMasterEnabled: Boolean = DEFAULT_HAPTIC_MASTER_ENABLED
        @Volatile var activeHapticOppSwapEnabled: Boolean = DEFAULT_HAPTIC_OPP_SWAP_ENABLED
        @Volatile var activeHapticOppSwapWarnSec: Int = DEFAULT_HAPTIC_OPP_SWAP_WARN_SEC
        @Volatile var activeHapticOppChargeWarnEnabled: Boolean = DEFAULT_HAPTIC_OPP_CHARGE_WARN_ENABLED
        @Volatile var activeHapticChargeTimingFasts: Int = DEFAULT_HAPTIC_CHARGE_TIMING_FASTS
        @Volatile var activeShowOneBattleDvrBtn: Boolean = DEFAULT_SHOW_ONE_BATTLE_DVR_BTN
        @Volatile var activeOneBattleDvrArmed: Boolean = false
        @Volatile var activeOneBattleDvrRecording: Boolean = false
        @Volatile var activeOneBattleDvrFrames: Int = 0

        @Suppress("DEPRECATION")
        fun triggerSingleHapticPulseStatic(context: Context) {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager
                    vm?.defaultVibrator
                } else {
                    context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                } ?: return
                if (!vibrator.hasVibrator()) return
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(80L, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    vibrator.vibrate(80L)
                }
            } catch (_: Exception) {}
        }

        @Suppress("DEPRECATION")
        fun triggerDoubleHapticPulseStatic(context: Context) {
            try {
                val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? android.os.VibratorManager
                    vm?.defaultVibrator
                } else {
                    context.getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                } ?: return
                if (!vibrator.hasVibrator()) return
                val timings = longArrayOf(0L, 80L, 80L, 80L)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val amplitudes = intArrayOf(0, 255, 0, 255)
                    vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1))
                } else {
                    vibrator.vibrate(timings, -1)
                }
            } catch (_: Exception) {}
        }

        @Volatile var activeTierSwMin: Int = DEFAULT_TIER_SW_MIN
        @Volatile var activeTierWMin: Int = DEFAULT_TIER_W_MIN
        @Volatile var activeTierLMax: Int = DEFAULT_TIER_L_MAX
        @Volatile var activeTierSlMax: Int = DEFAULT_TIER_SL_MAX

        @Volatile var activeMachEliteMin: Int = DEFAULT_MACH_ELITE_MIN
        @Volatile var activeMachSolidMin: Int = DEFAULT_MACH_SOLID_MIN
        @Volatile var activeMachPlayableMin: Int = DEFAULT_MACH_PLAYABLE_MIN
        @Volatile var activeMachRiskyMin: Int = DEFAULT_MACH_RISKY_MIN

        @Volatile var activeAiAdviceHudPosition: String = DEFAULT_AI_ADVICE_HUD_POSITION
        @Volatile var activeGblMetaLogWeightPct: Int = DEFAULT_GBL_META_LOG_WEIGHT_PCT
        @Volatile var activeShow6MetaLogWeightPct: Int = DEFAULT_SHOW6_META_LOG_WEIGHT_PCT
        @Volatile var activeGblMetaDecayFactor: Float = DEFAULT_GBL_META_DECAY_FACTOR
        @Volatile var activeShow6MetaDecayFactor: Float = DEFAULT_SHOW6_META_DECAY_FACTOR
        @Volatile var activeLimitedStdBlendPctGbl: Int = DEFAULT_LIMITED_STD_BLEND_PCT_GBL
        @Volatile var activeLimitedStdBlendPctShow6: Int = DEFAULT_LIMITED_STD_BLEND_PCT_SHOW6
        @Volatile var activeLimitedStdDecayGbl: Float = DEFAULT_LIMITED_STD_DECAY_GBL
        @Volatile var activeLimitedStdDecayShow6: Float = DEFAULT_LIMITED_STD_DECAY_SHOW6
        internal val CACHED_GBL_STD_SEASON_LOGS = java.util.concurrent.ConcurrentHashMap<String, List<Pair<Long, List<String>>>>()

        fun refreshCachedGblStandardLeagueLogsStatic(prefs: SharedPreferences, gson: Gson = Gson()) {
            try {
                for (stdLg in listOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE")) {
                    CACHED_GBL_STD_SEASON_LOGS[stdLg] = loadSeasonLogsForLeagueStatic(prefs, gson, stdLg, isShow6 = false, empiricalLimit = null)
                }
            } catch (_: Exception) {}
        }

        fun resolveCachedSameCpStandardLogsForCupStatic(league: String): List<Pair<Long, List<String>>> {
            if (!isLimitedCupFormatStatic(league)) return emptyList()
            val stdLeague = getSameCpStandardLeagueKeyStatic(league)
            val rawStdLogs = CACHED_GBL_STD_SEASON_LOGS[stdLeague] ?: return emptyList()
            if (rawStdLogs.isEmpty()) return emptyList()
            val normCup = normalizeLeagueKeyStatic(league)
            val eligiblePool = getTop100MetaCandidatesForLeagueStatic(normCup, 350).map { it.name }
                .ifEmpty { getTopMetaPoolForLeagueStatic(league) }
            val eligibleBaseSet = eligiblePool.map { FormResolver.extractBaseSpecies(it).lowercase() }.toSet()
            if (eligibleBaseSet.isEmpty()) return rawStdLogs
            return rawStdLogs.mapNotNull { (ts, opps) ->
                val filteredOpps = opps.filter { o ->
                    val b = FormResolver.extractBaseSpecies(o).lowercase()
                    b.isNotEmpty() && b in eligibleBaseSet
                }
                if (filteredOpps.isNotEmpty()) ts to filteredOpps else null
            }
        }

        fun runV602ScannerDefaultsMigrationStatic(prefs: SharedPreferences) {
            if (prefs.getBoolean(PREFS_KEY_V602_SCANNER_DEFAULTS_MIGRATED, false)) return
            val editor = prefs.edit()
            if (prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0) == 0) {
                editor.putInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, DEFAULT_FAST_DETECT_TURN_OFFSET)
            }
            if (!prefs.contains(PREFS_KEY_ENABLE_HP_TRACKING)) {
                editor.putBoolean(PREFS_KEY_ENABLE_HP_TRACKING, DEFAULT_ENABLE_HP_TRACKING)
            }
            if (!prefs.contains(PREFS_KEY_ENABLE_ENERGY_TRACKING)) {
                editor.putBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, DEFAULT_ENABLE_ENERGY_TRACKING)
            }
            if (!prefs.contains(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS)) {
                editor.putInt(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS)
            }
            if (!prefs.contains(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS)) {
                editor.putString(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, DEFAULT_ALT_FAST_DETECT_STRICTNESS)
            }
            if (!prefs.contains(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT)) {
                editor.putInt(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, DEFAULT_SHIELD_CHIP_TOLERANCE_PCT)
            }
            editor.putBoolean(PREFS_KEY_V602_SCANNER_DEFAULTS_MIGRATED, true).apply()
        }

        fun syncTierThresholdsFromPrefs(prefs: SharedPreferences) {
            runV602ScannerDefaultsMigrationStatic(prefs)
            activeTierSwMin = prefs.getInt(PREFS_KEY_TIER_SW_MIN, DEFAULT_TIER_SW_MIN).coerceIn(150, 950)
            activeTierWMin = prefs.getInt(PREFS_KEY_TIER_W_MIN, DEFAULT_TIER_W_MIN).coerceIn(150, 950)
            activeTierLMax = prefs.getInt(PREFS_KEY_TIER_L_MAX, DEFAULT_TIER_L_MAX).coerceIn(100, 900)
            activeTierSlMax = prefs.getInt(PREFS_KEY_TIER_SL_MAX, DEFAULT_TIER_SL_MAX).coerceIn(100, 900)
            activeMachEliteMin = prefs.getInt(PREFS_KEY_MACH_ELITE_MIN, DEFAULT_MACH_ELITE_MIN).coerceIn(450, 840)
            activeMachSolidMin = prefs.getInt(PREFS_KEY_MACH_SOLID_MIN, DEFAULT_MACH_SOLID_MIN).coerceIn(420, 820)
            activeMachPlayableMin = prefs.getInt(PREFS_KEY_MACH_PLAYABLE_MIN, DEFAULT_MACH_PLAYABLE_MIN).coerceIn(390, 800)
            activeMachRiskyMin = prefs.getInt(PREFS_KEY_MACH_RISKY_MIN, DEFAULT_MACH_RISKY_MIN).coerceIn(350, 780)
            activeEnergyDebounceSamples = prefs.getInt(PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, DEFAULT_ENERGY_DEBOUNCE_SAMPLES).coerceIn(2, 4)
            activeEnergyUpdateToasts = prefs.getBoolean(PREFS_KEY_ENERGY_UPDATE_TOASTS, DEFAULT_ENERGY_UPDATE_TOASTS)
            activeHpDebounceSamples = prefs.getInt(PREFS_KEY_HP_DEBOUNCE_SAMPLES, DEFAULT_HP_DEBOUNCE_SAMPLES).coerceIn(2, 4)
            activeDebounceTolerancePct = prefs.getInt(PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, DEFAULT_DEBOUNCE_TOLERANCE_PCT).coerceIn(0, 3)
            activeProactiveEnergyLeadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).let {
                if (it in listOf(0, 200, 300, 400)) it else DEFAULT_PROACTIVE_ENERGY_LEAD_MS
            }
            activeSwapThrowRollbackWindowMs = prefs.getInt(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS).let {
                if (it in listOf(0, 3000, 4000, 5000)) it else DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
            }
            activeAltFastDetectStrictness = (prefs.getString(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, DEFAULT_ALT_FAST_DETECT_STRICTNESS) ?: DEFAULT_ALT_FAST_DETECT_STRICTNESS)
                .lowercase().let { if (it in listOf("strict", "balanced", "aggressive")) it else DEFAULT_ALT_FAST_DETECT_STRICTNESS }
            activeShieldChipTolerancePct = prefs.getInt(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, DEFAULT_SHIELD_CHIP_TOLERANCE_PCT).let {
                if (it in listOf(6, 10, 14)) it else DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
            }
            activeAiAdviceHudPosition = (prefs.getString(PREFS_KEY_AI_ADVICE_HUD_POSITION, DEFAULT_AI_ADVICE_HUD_POSITION) ?: DEFAULT_AI_ADVICE_HUD_POSITION)
                .lowercase().let { if (it == "top") "top" else "bottom" }
            activeGblMetaLogWeightPct = prefs.getInt(PREFS_KEY_GBL_META_LOG_WEIGHT_PCT, DEFAULT_GBL_META_LOG_WEIGHT_PCT).coerceIn(0, 100)
            activeShow6MetaLogWeightPct = prefs.getInt(PREFS_KEY_SHOW6_META_LOG_WEIGHT_PCT, DEFAULT_SHOW6_META_LOG_WEIGHT_PCT).coerceIn(0, 100)
            activeGblMetaDecayFactor = prefs.getFloat(PREFS_KEY_GBL_META_DECAY_FACTOR, DEFAULT_GBL_META_DECAY_FACTOR).coerceIn(0.0f, 0.25f)
            activeShow6MetaDecayFactor = prefs.getFloat(PREFS_KEY_SHOW6_META_DECAY_FACTOR, DEFAULT_SHOW6_META_DECAY_FACTOR).coerceIn(0.0f, 0.25f)
            activeLimitedStdBlendPctGbl = prefs.getInt(PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL, DEFAULT_LIMITED_STD_BLEND_PCT_GBL).coerceIn(0, 100)
            activeLimitedStdBlendPctShow6 = prefs.getInt(PREFS_KEY_LIMITED_STD_BLEND_PCT_SHOW6, DEFAULT_LIMITED_STD_BLEND_PCT_SHOW6).coerceIn(0, 100)
            activeLimitedStdDecayGbl = prefs.getFloat(PREFS_KEY_LIMITED_STD_DECAY_GBL, DEFAULT_LIMITED_STD_DECAY_GBL).coerceIn(0.01f, 0.30f)
            activeLimitedStdDecayShow6 = prefs.getFloat(PREFS_KEY_LIMITED_STD_DECAY_SHOW6, DEFAULT_LIMITED_STD_DECAY_SHOW6).coerceIn(0.01f, 0.30f)
            activeShow6UsageWeightPct = prefs.getInt(PREFS_KEY_SHOW6_USAGE_WEIGHT_PCT, DEFAULT_SHOW6_USAGE_WEIGHT_PCT).coerceIn(0, 100)
            activeHapticMasterEnabled = prefs.getBoolean(PREFS_KEY_HAPTIC_MASTER_ENABLED, DEFAULT_HAPTIC_MASTER_ENABLED)
            activeHapticOppSwapEnabled = prefs.getBoolean(PREFS_KEY_HAPTIC_OPP_SWAP_ENABLED, DEFAULT_HAPTIC_OPP_SWAP_ENABLED)
            activeHapticOppSwapWarnSec = prefs.getInt(PREFS_KEY_HAPTIC_OPP_SWAP_WARN_SEC, DEFAULT_HAPTIC_OPP_SWAP_WARN_SEC).coerceIn(2, 10)
            activeHapticOppChargeWarnEnabled = prefs.getBoolean(PREFS_KEY_HAPTIC_OPP_CHARGE_WARN_ENABLED, DEFAULT_HAPTIC_OPP_CHARGE_WARN_ENABLED)
            activeHapticChargeTimingFasts = prefs.getInt(PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS, DEFAULT_HAPTIC_CHARGE_TIMING_FASTS).coerceIn(1, 2)
            activeShowOneBattleDvrBtn = prefs.getBoolean(PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN, DEFAULT_SHOW_ONE_BATTLE_DVR_BTN)
            if (!activeShowOneBattleDvrBtn) {
                activeOneBattleDvrArmed = false
            } else {
                activeOneBattleDvrArmed = prefs.getBoolean(PREFS_KEY_ARM_ONE_BATTLE_DVR, false)
            }
            loadCachedBattleFrontierUsageAndCores(prefs)
            refreshCachedGblStandardLeagueLogsStatic(prefs)
            recordDebounceSettingsChangeIfNeededStatic(prefs, Gson(), "settings_sync", triggerImmediateUpload = false)
        }
        const val PREFS_KEY_SYNC_GIST_ID = "gbl_sync_gist_id"
        const val PREFS_KEY_SYNC_LAST_AT = "gbl_sync_last_at"
        const val PREFS_KEY_DEVICE_LABEL = "gbl_device_label"

        private const val NOTIFICATION_CHANNEL_ID = "gbl_battle_overlay_channel"
        private const val NOTIFICATION_ID = 2001

        const val PREFS_KEY_PERSISTENT_TEAMS = "gbl_user_teams_persistent"
        const val PREFS_KEY_APP_COMBAT_MODE = "gbl_app_combat_mode_v1"
        const val PREFS_KEY_SHOW6_BATTLE_LOGS = "gbl_show6_battle_logs_v1"
        const val PREFS_KEY_SHOW6_PRESETS_OF_3 = "gbl_show6_presets_of_3_v1"
        const val PREFS_KEY_SHOW6_SELECTED_PRESET_ID = "gbl_show6_selected_preset_id_v1"
        const val PREFS_KEY_SHOW6_ROSTERS_OF_6 = "gbl_show6_rosters_of_6_v1"
        const val PREFS_KEY_SHOW6_OPPONENT_ROSTERS_OF_6 = "gbl_show6_opp_rosters_of_6_v1"
        const val PREFS_KEY_SHOW6_OPPONENT_6 = "gbl_show6_opponent_6_v1"
        const val PREFS_KEY_SHOW6_WHITELIST_BY_LEAGUE = "gbl_show6_whitelist_by_league_v1"
        const val PREFS_KEY_SHOW6_BANLIST_BY_LEAGUE = "gbl_show6_banlist_by_league_v1"
        const val PREFS_KEY_SHOW6_DELETED_LOG_IDS = "gbl_show6_deleted_log_ids_v1"
        const val PREFS_KEY_SHOW6_DELETED_TEAM_IDS = "gbl_show6_deleted_team_ids_v1"
        const val PREFS_KEY_SHOW6_DELETED_BATTLES_TRASH = "gbl_show6_deleted_battles_trash_v1"
        const val PREFS_KEY_SHOW6_DELETED_TEAMS_TRASH = "gbl_show6_deleted_teams_trash_v1"
        const val PREFS_KEY_SHOW6_DELETED_ROSTERS_TRASH = "gbl_show6_deleted_rosters_trash_v1"
        const val PREFS_KEY_BF_USAGE_SHEET_URL = "gbl_bf_usage_sheet_url_v1"
        const val PREFS_KEY_BF_CORES_SHEET_URL = "gbl_bf_cores_sheet_url_v1"
        const val PREFS_KEY_BF_USAGE_JSON = "gbl_bf_usage_json_v2"
        const val PREFS_KEY_BF_CORES_JSON = "gbl_bf_cores_json_v2"
        const val PREFS_KEY_BF_LAST_SYNC_MS = "gbl_bf_last_sync_ms_v1"
        const val PREFS_KEY_SHOW6_USAGE_WEIGHT_PCT = "gbl_show6_usage_weight_pct_v1"
        const val PREFS_KEY_LIMITED_META_CATALOG_JSON = "gbl_pvpoke_limited_metas_catalog_v1"
        const val PREFS_KEY_PINNED_GBL_METAS = "gbl_pinned_limited_metas_gbl_v1"
        const val PREFS_KEY_PINNED_SHOW6_METAS = "gbl_pinned_limited_metas_show6_v1"
        const val PREFS_KEY_LIMITED_META_SHEET_ALIASES = "gbl_limited_meta_sheet_aliases_v1"
        const val DEFAULT_SHOW6_USAGE_WEIGHT_PCT = 65
        const val DEFAULT_BF_USAGE_SHEET_URL = "https://docs.google.com/spreadsheets/d/1PD_1CVCMvD1WuubJCHHrS2HKSoECZgscZuiKF07XidM/edit?gid=466174368#gid=466174368"
        const val DEFAULT_BF_CORES_SHEET_URL = "https://docs.google.com/spreadsheets/d/14P0XFd8uTgdMMieYB_4n2-2cRY057qeh9J5yG85JHtg/edit?gid=94099054#gid=94099054"
        @Volatile
        var activeShow6UsageWeightPct: Int = DEFAULT_SHOW6_USAGE_WEIGHT_PCT
        val LEGACY_PRESET_KEYS = listOf(
            "gbl_team_presets_v6",
            "gbl_team_presets_v5",
            "gbl_team_presets_v4",
            "gbl_team_presets_v3",
            "gbl_team_presets_v2",
            "gbl_team_presets"
        )

        const val FOUR_WEEKS_MS: Long = 28L * 24L * 60L * 60L * 1000L

        data class LimitedMetaFormat(
            val id: String,
            val title: String,
            val cup: String,
            val cp: Int,
            val leagueKey: String,
            val category: String, // "gbl" | "battle_frontier" | "premier_mega"
            val lifecycleStatus: String = "RECENT", // "CURRENT" | "UPCOMING" | "RECENT"
            val rankingsUrl: String,
            val sheetTabAlias: String? = null,
            val lastSeenAt: Long = System.currentTimeMillis(),
            val allowsMega: Boolean = false
        )

        const val PREFS_KEY_V511_LEAGUE_REMAP_DONE = "gbl_v511_league_remap_done"

        fun toPvPokeTitleCaseStatic(raw: String): String {
            val trimmed = raw.trim()
            if (trimmed.isEmpty()) return ""
            val preserveUpper = setOf("LAIC", "P!P", "GBL", "CP", "GL", "UL", "ML", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X")
            return trimmed.split(Regex("\\s+")).joinToString(" ") { word ->
                val cleanAlpha = word.replace(Regex("[^A-Za-z0-9!]"), "")
                when {
                    cleanAlpha.uppercase() in preserveUpper -> word.uppercase()
                    word.startsWith("(") && word.endsWith(")") -> {
                        val inner = word.substring(1, word.length - 1)
                        "(${toPvPokeTitleCaseStatic(inner)})"
                    }
                    else -> word.lowercase().replaceFirstChar { ch ->
                        if (ch.isLowerCase()) ch.titlecase(java.util.Locale.US) else ch.toString()
                    }
                }
            }
        }

        fun isBattleFrontierFormatTitleStatic(titleOrKey: String, cupSlug: String = ""): Boolean {
            return titleOrKey.contains("Battle Frontier", ignoreCase = true) ||
                cupSlug.contains("battlefrontier", ignoreCase = true) ||
                cupSlug.equals("spectral", ignoreCase = true) ||
                cupSlug.equals("cauldron", ignoreCase = true)
        }

        fun isCurrentBattleFrontierCupStatic(titleOrKey: String, cupSlug: String = ""): Boolean {
            val t = titleOrKey.trim().lowercase()
            val c = cupSlug.trim().lowercase()
            return c == "spectral" ||
                c == "cauldron" ||
                c == "battlefrontiermaster" ||
                t.contains("battle frontier (spectral)") ||
                t.contains("battle frontier (cauldron)") ||
                t.contains("battle frontier (master)") ||
                t == "spectral cup" ||
                t == "cauldron cup"
        }

        fun formatCatalogLeagueKeyStatic(rawTitle: String, cp: Int, cupSlug: String = ""): String {
            val cleanNoCp = rawTitle.trim().replace(Regex("\\s*\\((500|1500|2500|10000)\\)\\s*$"), "").trim()
            if (isBattleFrontierFormatTitleStatic(cleanNoCp, cupSlug)) {
                return cleanNoCp.uppercase()
            }
            val titleCase = toPvPokeTitleCaseStatic(cleanNoCp)
            return "$titleCase ($cp)"
        }

        val DEFAULT_LIMITED_META_CATALOG: List<LimitedMetaFormat> get() = PokemonStaticData.DEFAULT_LIMITED_META_CATALOG

        @Volatile
        var LAST_LOADED_META_CATALOG: List<LimitedMetaFormat> = DEFAULT_LIMITED_META_CATALOG

        fun isExpiredLimitedMetaStatic(item: LimitedMetaFormat, nowMs: Long = System.currentTimeMillis()): Boolean {
            if (!item.lifecycleStatus.equals("RECENT", ignoreCase = true)) return false
            val seen = if (item.lastSeenAt > 0L) item.lastSeenAt else nowMs
            return (nowMs - seen) > FOUR_WEEKS_MS
        }

        fun sortLimitedMetasByLifecycleStatic(formats: List<LimitedMetaFormat>): List<LimitedMetaFormat> {
            fun order(status: String): Int = when (status.uppercase()) {
                "CURRENT" -> 0
                "UPCOMING" -> 1
                else -> 2
            }
            return formats.sortedWith(Comparator { a, b ->
                val cmp = order(a.lifecycleStatus).compareTo(order(b.lifecycleStatus))
                if (cmp != 0) cmp else a.leagueKey.compareTo(b.leagueKey, ignoreCase = true)
            })
        }

        fun getLimitedMetaCatalogStatic(prefs: SharedPreferences? = null): List<LimitedMetaFormat> {
            val nowMs = System.currentTimeMillis()
            val pinnedKeysLower = if (prefs != null) {
                (getPinnedGblLimitedMetasStatic(prefs) + getPinnedShow6LimitedMetasStatic(prefs))
                    .map { it.lowercase() }
                    .toSet()
            } else emptySet()

            val byKey = LinkedHashMap<String, LimitedMetaFormat>()
            for (item in DEFAULT_LIMITED_META_CATALOG) {
                byKey[item.leagueKey.uppercase()] = item
            }
            val raw = prefs?.getString(PREFS_KEY_LIMITED_META_CATALOG_JSON, null)
            if (!raw.isNullOrBlank()) {
                try {
                    val type = object : TypeToken<List<LimitedMetaFormat>>() {}.type
                    val parsed: List<LimitedMetaFormat>? = Gson().fromJson(raw, type)
                    if (!parsed.isNullOrEmpty()) {
                        for (item in parsed) {
                            if (item.leagueKey.isNotBlank() && item.rankingsUrl.isNotBlank()) {
                                val fixedSeen = if (item.lastSeenAt > 0L) item.lastSeenAt else nowMs
                                val normalizedKey = formatCatalogLeagueKeyStatic(item.title.ifBlank { item.leagueKey }, item.cp, item.cup)
                                val normalizedTitle = if (isBattleFrontierFormatTitleStatic(normalizedKey, item.cup)) {
                                    normalizedKey.uppercase()
                                } else {
                                    toPvPokeTitleCaseStatic(item.title.ifBlank { item.leagueKey })
                                }
                                val detectedMega = item.allowsMega || hasMegaInRankingsMapStatic(normalizedKey)
                                byKey[normalizedKey.uppercase()] = item.copy(
                                    title = normalizedTitle,
                                    leagueKey = normalizedKey,
                                    lastSeenAt = fixedSeen,
                                    allowsMega = detectedMega
                                )
                            }
                        }
                    }
                } catch (_: Exception) {}
            }

            // Filter out RECENT formats older than 4 weeks UNLESS still checked/pinned or a CURRENT Battle Frontier forced cup
            val filtered = byKey.values.filter { item ->
                val isPinned = item.leagueKey.lowercase() in pinnedKeysLower
                val isBfForced = item.lifecycleStatus.equals("CURRENT", ignoreCase = true) &&
                    isCurrentBattleFrontierCupStatic(item.title.ifBlank { item.leagueKey }, item.cup)
                !isExpiredLimitedMetaStatic(item, nowMs) || isPinned || isBfForced
            }
            val sorted = sortLimitedMetasByLifecycleStatic(filtered)
            LAST_LOADED_META_CATALOG = sorted
            return sorted
        }

        fun pruneUncheckedExpiredMetasStatic(prefs: SharedPreferences) {
            val nowMs = System.currentTimeMillis()
            val pinnedKeysLower = (getPinnedGblLimitedMetasStatic(prefs) + getPinnedShow6LimitedMetasStatic(prefs))
                .map { it.lowercase() }
                .toSet()
            val raw = prefs.getString(PREFS_KEY_LIMITED_META_CATALOG_JSON, null) ?: return
            try {
                val type = object : TypeToken<List<LimitedMetaFormat>>() {}.type
                val parsed: List<LimitedMetaFormat> = Gson().fromJson(raw, type) ?: return
                val kept = parsed.filter { item ->
                    val isPinned = item.leagueKey.lowercase() in pinnedKeysLower
                    val isBfForced = item.lifecycleStatus.equals("CURRENT", ignoreCase = true) &&
                        isCurrentBattleFrontierCupStatic(item.title.ifBlank { item.leagueKey }, item.cup)
                    !isExpiredLimitedMetaStatic(item, nowMs) || isPinned || isBfForced
                }
                if (kept.size != parsed.size) {
                    prefs.edit().putString(PREFS_KEY_LIMITED_META_CATALOG_JSON, Gson().toJson(kept)).apply()
                }
                LAST_LOADED_META_CATALOG = getLimitedMetaCatalogStatic(prefs)
            } catch (_: Exception) {}
        }

        fun getForcedGblLeaguesStatic(): List<String> = listOf(
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE"
        )

        fun getForcedShow6LeaguesStatic(prefs: SharedPreferences? = null): List<String> {
            val catalog = getLimitedMetaCatalogStatic(prefs)
            val bfFromCatalog = catalog
                .filter {
                    it.lifecycleStatus.equals("CURRENT", ignoreCase = true) &&
                        (isCurrentBattleFrontierCupStatic(it.title, it.cup) || isCurrentBattleFrontierCupStatic(it.leagueKey, it.cup))
                }
                .map { it.leagueKey.uppercase() }
                .distinct()
                .sorted()
            return if (bfFromCatalog.isNotEmpty()) {
                bfFromCatalog
            } else {
                listOf(
                    "BATTLE FRONTIER (CAULDRON)",
                    "BATTLE FRONTIER (MASTER)",
                    "BATTLE FRONTIER (SPECTRAL)"
                )
            }
        }

        fun resolveLeagueCpTierStatic(rawLeague: String, prefs: SharedPreferences? = null): String {
            val upper = rawLeague.trim().uppercase()
            if (upper.isEmpty()) return "GREAT"
            if (upper.contains("(10000)") || upper.contains("MASTER") || upper == "BATTLE FRONTIER (MASTER)") {
                return "MASTER"
            }
            if (upper.contains("(2500)") || upper.contains("ULTRA") || upper.contains("CAULDRON")) {
                return "ULTRA"
            }
            if (upper.contains("(1500)") || upper.contains("(500)") || upper.contains("GREAT") || upper.contains("SPECTRAL") || upper.contains("LITTLE")) {
                return "GREAT"
            }
            val cat = LAST_LOADED_META_CATALOG.find {
                it.leagueKey.equals(rawLeague.trim(), ignoreCase = true) || it.title.equals(rawLeague.trim(), ignoreCase = true)
            } ?: if (prefs != null) {
                getLimitedMetaCatalogStatic(prefs).find {
                    it.leagueKey.equals(rawLeague.trim(), ignoreCase = true) || it.title.equals(rawLeague.trim(), ignoreCase = true)
                }
            } else null
            return when (cat?.cp) {
                10000 -> "MASTER"
                2500 -> "ULTRA"
                else -> "GREAT"
            }
        }

        fun matchesEncodedLeagueFilterStatic(
            entryLeague: String,
            filterSpec: String,
            isShow6: Boolean,
            prefs: SharedPreferences
        ): Boolean {
            val spec = filterSpec.trim()
            if (spec.isEmpty() || spec.equals("ALL", ignoreCase = true) || spec.equals("ALL LEAGUES", ignoreCase = true)) {
                return true
            }
            if (spec.startsWith("TIER:", ignoreCase = true)) {
                val targetTier = spec.substringAfter(":").trim().uppercase()
                return resolveLeagueCpTierStatic(entryLeague, prefs).equals(targetTier, ignoreCase = true)
            }
            if (spec.startsWith("OLD_CUPS:", ignoreCase = true)) {
                val targetTier = spec.substringAfter(":").trim().uppercase()
                return resolveLeagueCpTierStatic(entryLeague, prefs).equals(targetTier, ignoreCase = true) &&
                    isOldCupForModeStatic(entryLeague, isShow6, prefs)
            }
            if (spec.equals("OLD_CUPS", ignoreCase = true)) {
                return isOldCupForModeStatic(entryLeague, isShow6, prefs)
            }
            return entryLeague.trim().equals(spec, ignoreCase = true) ||
                remapLegacyLeagueForModeStatic(entryLeague, isShow6).equals(
                    remapLegacyLeagueForModeStatic(spec, isShow6),
                    ignoreCase = true
                )
        }

        fun remapLegacyLeagueForModeStatic(rawLeague: String, isShow6: Boolean): String {
            val trimmed = rawLeague.trim()
            if (trimmed.isEmpty()) return if (isShow6) "BATTLE FRONTIER (SPECTRAL)" else "GREAT LEAGUE"
            val upper = trimmed.uppercase()
            if (upper == "MEGA MASTER LEAGUE" || upper == "MASTER LEAGUE (MEGA)" || upper == "MEGA MASTER LEAGUE (10000)" || upper == "MASTER LEAGUE (MEGA) (10000)") {
                return "Mega Master League (10000)"
            }
            if (upper.startsWith("BATTLE FRONTIER")) {
                return upper.replace(Regex("\\s*\\((500|1500|2500|10000)\\)\\s*$"), "").trim()
            }
            if (isShow6) {
                return when (upper) {
                    "GREAT LEAGUE", "GREAT LEAGUE (1500)" -> "Great League (1500)"
                    "ULTRA LEAGUE", "ULTRA LEAGUE (2500)" -> "Ultra League (2500)"
                    "MASTER LEAGUE", "MASTER LEAGUE (10000)" -> "Master League (10000)"
                    else -> {
                        val matched = LAST_LOADED_META_CATALOG.find {
                            it.leagueKey.equals(trimmed, ignoreCase = true) || it.title.equals(trimmed, ignoreCase = true)
                        }
                        matched?.leagueKey ?: trimmed
                    }
                }
            } else {
                return when (upper) {
                    "GREAT LEAGUE", "GREAT LEAGUE (1500)" -> "GREAT LEAGUE"
                    "ULTRA LEAGUE", "ULTRA LEAGUE (2500)" -> "ULTRA LEAGUE"
                    "MASTER LEAGUE", "MASTER LEAGUE (10000)" -> "MASTER LEAGUE"
                    else -> {
                        val matched = LAST_LOADED_META_CATALOG.find {
                            it.leagueKey.equals(trimmed, ignoreCase = true) || it.title.equals(trimmed, ignoreCase = true)
                        }
                        matched?.leagueKey ?: trimmed
                    }
                }
            }
        }

        fun getPinnedGblLimitedMetasStatic(prefs: SharedPreferences): List<String> {
            val raw = prefs.getString(PREFS_KEY_PINNED_GBL_METAS, null) ?: return emptyList()
            return try {
                val type = object : TypeToken<List<String>>() {}.type
                val list = Gson().fromJson<List<String>>(raw, type)?.filter { it.isNotBlank() }.orEmpty()
                list.map { remapLegacyLeagueForModeStatic(it, isShow6 = false) }
                    .filterNot { k -> getForcedGblLeaguesStatic().any { it.equals(k, ignoreCase = true) } }
                    .distinct()
            } catch (_: Exception) { emptyList() }
        }

        fun setPinnedGblLimitedMetasStatic(prefs: SharedPreferences, keys: List<String>) {
            val cleaned = keys
                .filter { it.isNotBlank() }
                .map { remapLegacyLeagueForModeStatic(it, isShow6 = false) }
                .filterNot { k -> getForcedGblLeaguesStatic().any { it.equals(k, ignoreCase = true) } }
                .distinct()
            prefs.edit().putString(PREFS_KEY_PINNED_GBL_METAS, Gson().toJson(cleaned)).apply()
            pruneUncheckedExpiredMetasStatic(prefs)
        }

        fun getPinnedShow6LimitedMetasStatic(prefs: SharedPreferences): List<String> {
            val raw = prefs.getString(PREFS_KEY_PINNED_SHOW6_METAS, null) ?: return emptyList()
            val forcedShow6 = getForcedShow6LeaguesStatic(null)
            return try {
                val type = object : TypeToken<List<String>>() {}.type
                val list = Gson().fromJson<List<String>>(raw, type)?.filter { it.isNotBlank() }.orEmpty()
                list.map { remapLegacyLeagueForModeStatic(it, isShow6 = true) }
                    .filterNot { k -> forcedShow6.any { it.equals(k, ignoreCase = true) } }
                    .distinct()
            } catch (_: Exception) { emptyList() }
        }

        fun setPinnedShow6LimitedMetasStatic(prefs: SharedPreferences, keys: List<String>) {
            val forcedShow6 = getForcedShow6LeaguesStatic(null)
            val cleaned = keys
                .filter { it.isNotBlank() }
                .map { remapLegacyLeagueForModeStatic(it, isShow6 = true) }
                .filterNot { k -> forcedShow6.any { it.equals(k, ignoreCase = true) } }
                .distinct()
            prefs.edit().putString(PREFS_KEY_PINNED_SHOW6_METAS, Gson().toJson(cleaned)).apply()
            pruneUncheckedExpiredMetasStatic(prefs)
        }

        fun getEnabledGblLeaguesStatic(prefs: SharedPreferences): List<String> {
            val base = getForcedGblLeaguesStatic()
            val pinned = getPinnedGblLimitedMetasStatic(prefs).filter { p -> base.none { it.equals(p, ignoreCase = true) } }
            return base + pinned
        }

        fun getEnabledShow6LeaguesStatic(prefs: SharedPreferences): List<String> {
            val base = getForcedShow6LeaguesStatic(prefs)
            val pinned = getPinnedShow6LimitedMetasStatic(prefs).filter { p -> base.none { it.equals(p, ignoreCase = true) } }
            return base + pinned
        }

        fun isOldCupForModeStatic(league: String, isShow6: Boolean, prefs: SharedPreferences): Boolean {
            val remapped = remapLegacyLeagueForModeStatic(league, isShow6).trim()
            if (remapped.isEmpty()) return false
            val forcedLeagues = if (isShow6) {
                getForcedShow6LeaguesStatic(prefs)
            } else {
                getForcedGblLeaguesStatic()
            }
            if (forcedLeagues.any { it.equals(remapped, ignoreCase = true) }) return false

            val pinnedForMode = if (isShow6) {
                getPinnedShow6LimitedMetasStatic(prefs)
            } else {
                getPinnedGblLimitedMetasStatic(prefs)
            }
            val isCurrentlyPinned = pinnedForMode.any { it.equals(remapped, ignoreCase = true) }
            if (!isCurrentlyPinned) return true

            val catalogEntry = getLimitedMetaCatalogStatic(prefs).find { it.leagueKey.equals(remapped, ignoreCase = true) }
            if (catalogEntry != null && isExpiredLimitedMetaStatic(catalogEntry)) {
                return true
            }
            return false
        }

        fun getLeagueCpCapStatic(league: String, prefs: SharedPreferences? = null): Int {
            val catalog = if (prefs != null) getLimitedMetaCatalogStatic(prefs) else LAST_LOADED_META_CATALOG.ifEmpty { getLimitedMetaCatalogStatic(null) }
            val cat = catalog.find { it.leagueKey.equals(league, ignoreCase = true) || it.title.equals(league, ignoreCase = true) }
            if (cat != null) return cat.cp
            val parenMatch = Regex("\\((500|1500|2500|10000)\\)").find(league)
            if (parenMatch != null) return parenMatch.groupValues[1].toIntOrNull() ?: 1500
            val u = league.uppercase()
            if (u.contains("LITTLE")) return 500
            if (u.contains("MASTER")) return 10000
            if (u.contains("ULTRA") || u.contains("CAULDRON") || u.contains("(UL)")) return 2500
            return 1500
        }

        fun hasMegaInRankingsMapStatic(league: String): Boolean {
            val map = LIVE_RANKINGS_MAP[league.trim().uppercase()] ?: return false
            return map.keys.any { isMegaOrPrimalSpeciesStatic(it) }
        }

        fun isMegaAllowedInLeagueStatic(league: String, prefs: SharedPreferences? = null): Boolean {
            val trimmed = league.trim()
            if (hasMegaInRankingsMapStatic(trimmed)) return true
            val cat = (if (prefs != null) getLimitedMetaCatalogStatic(prefs) else LAST_LOADED_META_CATALOG.ifEmpty { DEFAULT_LIMITED_META_CATALOG })
                .find { it.leagueKey.equals(trimmed, ignoreCase = true) || it.title.equals(trimmed, ignoreCase = true) }
            if (cat != null) return cat.allowsMega
            val u = trimmed.uppercase()
            return u.contains("MEGA") || u.contains("CAULDRON") || u.contains("LAIC") || u == "BATTLE FRONTIER (MASTER)"
        }

        val SUPER_MEGA_PLUS_MOVES: Map<String, String> get() = PokemonStaticData.SUPER_MEGA_PLUS_MOVES
        val DYNAMIC_SUPER_MEGA_PLUS_MOVES = java.util.concurrent.ConcurrentHashMap<String, String>()

        fun resolveMegaPlusMoveStatic(rawName: String, league: String, prefs: SharedPreferences? = null): String? {
            val trimmed = rawName.trim()
            if (trimmed.isEmpty()) return null
            if (!isMegaAllowedInLeagueStatic(league, prefs)) return null
            val lower = trimmed.lowercase()
                .replace(Regex("^shadow\\s+"), "")
                .replace(Regex("\\s*\\(shadow\\)"), "")
                .trim()
            DYNAMIC_SUPER_MEGA_PLUS_MOVES[lower]?.let { return it }
            SUPER_MEGA_PLUS_MOVES[lower]?.let { return it }
            val underKey = lower.replace(Regex("[()\\s-]+"), "_").trim('_')
            DYNAMIC_SUPER_MEGA_PLUS_MOVES[underKey]?.let { return it }
            SUPER_MEGA_PLUS_MOVES[underKey]?.let { return it }
            if (isMegaOrPrimalSpeciesStatic(lower)) {
                val base = FormResolver.extractBaseSpecies(lower)
                val suffix = when {
                    Regex("\\bx\\b").containsMatchIn(lower) || lower.endsWith("_x") -> "_mega_x"
                    Regex("\\by\\b").containsMatchIn(lower) || lower.endsWith("_y") -> "_mega_y"
                    else -> "_mega"
                }
                val candId = "${base}${suffix}"
                DYNAMIC_SUPER_MEGA_PLUS_MOVES[candId]?.let { return it }
                SUPER_MEGA_PLUS_MOVES[candId]?.let { return it }
            }
            return null
        }

        data class SyncBattleLogRecord(
            val id: String = java.util.UUID.randomUUID().toString(),
            val timestampMs: Long = System.currentTimeMillis(),
            val updatedAt: Long = timestampMs,
            val league: String = "GREAT LEAGUE",
            val presetId: String = "",
            val userTeamName: String = "",
            val userPokemon: List<String> = emptyList(),
            val opponents: List<String> = emptyList(),
            val leadMatchup: String = "NEUTRAL",
            val result: String = "WIN",
            val deviceLabel: String = Build.MODEL ?: "Android",
            val bmfScore: Double? = null,
            val execWae: Double? = null,
            val badges: List<String> = emptyList(),
            val flags: List<String> = emptyList(),
            val quality: BattleQualityMetadata? = null,
            val qualityEvaluated: Boolean = false,
            val timelineEvents: List<BattleTimelineEvent> = emptyList(),
            val battleDurationSec: Double? = null,
            val userFaints: Int? = null,
            val oppFaints: Int? = null,
            val userShieldsRemaining: Int? = null,
            val oppShieldsRemaining: Int? = null,
            val adherenceRatePct: Int? = null,
            val recommendationsIssuedCount: Int? = null,
            val recommendationsFollowedCount: Int? = null,
            // v3.50: Permanent Main Battle Log End-of-Battle HP & Switch Advantage Summary
            val finalUserHpPct: List<Int>? = null,
            val finalOppHpPct: List<Int>? = null,
            val firstSwapActor: String? = null, // "USER" | "OPP" | "NONE"
            val switchAdvantage: String? = null // "WON" | "LOST" | "NEUTRAL"
        )


        data class SyncTeamSlot(
            val name: String,
            val cp: Int,
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val ivs: String? = null
        )

        data class SyncTeamPresetRecord(
            val id: String = java.util.UUID.randomUUID().toString(),
            val name: String,
            val league: String,
            val pokemon: List<SyncTeamSlot>,
            val isSelected: Boolean = false,
            val updatedAt: Long = System.currentTimeMillis(),
            val archetype: String = "ABC",
            val isArchetypeManual: Boolean = false,
            val leadAggBr: Int = 500,
            val machineAggBr: Int = 600,
            val safeSwapBr: Int = 500,
            val closerSwapBr: Int = 500,
            val closerBr: Int = 500,
            val sharedWeaknesses: List<String> = emptyList()
        )

        data class SyncVaultPayload(
            val schemaVersion: Int = 2,
            val updatedAt: Long = System.currentTimeMillis(),
            val battleLogs: List<SyncBattleLogRecord> = emptyList(),
            val teamPresets: List<SyncTeamPresetRecord> = emptyList(),
            val deletedLogIds: List<String> = emptyList(),
            val deletedTeamIds: List<String> = emptyList()
        )


        const val PREFS_KEY_SYNC_GITHUB_USERNAME = "gbl_sync_github_username"
        const val GITHUB_OAUTH_CLIENT_ID = "178c6fc778ccc68e1d6a"

        data class GitHubDeviceCodeResponse(
            val deviceCode: String,
            val userCode: String,
            val verificationUri: String,
            val expiresIn: Int,
            val interval: Int
        )


        // =========================================================================
        // v5.10: AI TRAINING & ANOMALY TELEMETRY SCHEMA + GITHUB AUTO-UPLOAD ENGINE
        // =========================================================================

        data class BattleAnomalyRecord(
            val type: String = "", // "ENERGY_DEFICIT_THROW" | "ENERGY_CAP_DRIFT" | "UNEXPECTED_HP_DELTA" | "SHIELD_DESYNC" | "FAST_MOVE_CADENCE_DRIFT" | "FALLBACK_SPECIES_OR_MOVE"
            val severity: String = "WARN", // "HIGH" | "WARN" | "INFO"
            val tSec: Double = 0.0,
            val actor: String = "user", // "user" | "opp"
            val species: String = "",
            val fastMove: String? = null,
            val moveName: String? = null,
            val moveResolutionSource: String? = null,
            val detectedEnergyBefore: Int? = null,
            val requiredMoveEnergy: Int? = null,
            val energyDeficit: Int? = null,
            val residualEnergyAfter: Int? = null,
            val leftCircleFillPct: Int? = null,
            val rightCircleFillPct: Int? = null,
            val hpBeforePct: Int? = null,
            val hpAfterPct: Int? = null,
            val actualHpDropPct: Int? = null,
            val expectedDmgPct: Int? = null,
            val shieldsBefore: Int? = null,
            val shieldsAfter: Int? = null,
            val detail: String = "",
            val screenshotWebpBase64: String? = null
        )

        data class AiTelemetrySettingsChangeEvent(
            val id: String = "",
            val timestampMs: Long = System.currentTimeMillis(),
            val appVersion: String = "5.13",
            val uploaderHandle: String = "anonymous",
            val deviceHash: String = "",
            val triggerSource: String = "settings_ui",
            val changedKeys: List<String> = emptyList(),
            val previousSettings: Map<String, Any> = emptyMap(),
            val newSettings: Map<String, Any> = emptyMap(),
            val settingsProfileSignature: String = "",
            val activeDebouncesAndDelays: Map<String, Any> = emptyMap()
        )

        data class AiTelemetrySlotSpec(
            val slotIndex: Int = 0,
            val species: String = "",
            val cp: Int? = null,
            val ivs: String? = null,
            val fastMove: String = "",
            val fastTurns: Int = 2,
            val fastEnergy: Int = 6,
            val chargedMove1: String = "",
            val chargedMove1Energy: Int = 45,
            val chargedMove2: String = "",
            val chargedMove2Energy: Int = 55,
            val finalHpPct: Int = 0,
            val finalEnergy: Int = 0,
            val fainted: Boolean = false
        )

        data class AiTelemetryOppSlotSpec(
            val slotIndex: Int = 0,
            val species: String = "",
            val isShadow: Boolean = false,
            val inferredFastMove: String = "",
            val fastMoveConfirmed: Boolean = false,
            val fastMoveStatus: String = "unconfirmed",
            val fastTurns: Int = 2,
            val fastEnergy: Int = 6,
            val confirmedChargedMoves: List<String> = emptyList(),
            val finalHpPct: Int = 0,
            val finalEnergy: Int = 0,
            val fainted: Boolean = false
        )

        /**
         * v6.07: Post-Cutscene Dual-HP Rescan Audit Record.
         * Captures the exact progression of both players' HP bars before and after a charged move cutscene
         * (+220ms, +650ms, +1200ms) alongside shield detection and expected PvPoke damage.
         */
        data class PostCutsceneHpAuditRecord(
            val tSec: Double = 0.0,
            val actor: String = "user",
            val attackerSpecies: String = "",
            val defenderSpecies: String = "",
            val moveName: String = "",
            val shielded: Boolean = false,
            val expectedDmgPct: Int? = null,
            val userHpPre: Int = 100,
            val userHpScan220ms: Int = -1,
            val userHpScan650ms: Int = -1,
            val userHpScan1200ms: Int = -1,
            val userHpCommittedAfter: Int = 100,
            val userHpRowY: Int = -1,
            val oppHpPre: Int = 100,
            val oppHpScan220ms: Int = -1,
            val oppHpScan650ms: Int = -1,
            val oppHpScan1200ms: Int = -1,
            val oppHpCommittedAfter: Int = 100,
            val oppHpRowY: Int = -1
        )

        /**
         * v6.07: Turn-by-Turn Energy Mutation Ledger Entry.
         * Records every energy transition with its attribution source (FAST_CADENCE, CIRCLE_FILL_SYNC,
         * POST_THROW_DEDUCT, SWAP_BANK, RETRO_SWAP_OR_MOVE_FIX) and fast turn count since last cutscene.
         */
        data class EnergyLedgerEntry(
            val tSec: Double = 0.0,
            val actor: String = "user", // "user" | "opp"
            val slotIdx: Int = 0,
            val species: String = "",
            val energyBefore: Int = 0,
            val energyAfter: Int = 0,
            val deltaEnergy: Int = 0,
            val source: String = "FAST_CADENCE",
            val turnsSinceLastCutscene: Int = 0,
            val leftCircleFillPct: Int = -1,
            val rightCircleFillPct: Int = -1
        )

        /**
         * v6.07: 1-Battle DVR Frame-Synced Deep Analysis Trace Entry (`_deep_trace.jsonl`).
         * Correlates 1:1 with the burned-in frame number (`F#0001`) and millisecond timestamp (`T+00.00s`)
         * on the full-screen recorded Pokémon GO battle MP4 video.
         */
        data class BattleDeepTraceFrame(
            val frameIdx: Int = 0,
            val timestampMs: Long = 0L,
            val videoElapsedMs: Long = 0L,
            val battleElapsedMs: Long = 0L,
            val rawUserHpPct: Int = -1,
            val committedUserHpPct: Int = 100,
            val userHpRowY: Int = -1,
            val rawOppHpPct: Int = -1,
            val committedOppHpPct: Int = 100,
            val oppHpRowY: Int = -1,
            val leftCircleFillPct: Int = -1,
            val rightCircleFillPct: Int = -1,
            val userEnergy: Int = 0,
            val oppEnergy: Int = 0,
            val energySource: String = "FAST_CADENCE",
            val userShields: Int = 2,
            val oppShields: Int = 2,
            val userBalls: Int = 3,
            val oppBalls: Int = 3,
            val activeUserIdx: Int = 0,
            val activeOppIdx: Int = 0,
            val activeUserSpecies: String = "",
            val activeOppSpecies: String = "",
            val isCutsceneActive: Boolean = false,
            val pendingChargeActor: String = "",
            val isTopCountdownActive: Boolean = false,
            val playerSwapRemainingSec: Int = 0,
            val oppSwapRemainingSec: Int = 0,
            val ocrOppTopText: String = "",
            val ocrUserTopText: String = "",
            val ocrMidBannerText: String = "",
            val ocrBottomMovesText: String = "",
            val recommendedPhase: String = "",
            val recommendedAction: String = "",
            val recommendedGoal: String = ""
        )

        data class AiTelemetryBattleRecordV510(
            val schemaVersion: String = APP_VERSION,
            val battleId: String = "",
            val timestampMs: Long = System.currentTimeMillis(),
            val appVersion: String = APP_VERSION,
            val uploaderHandle: String = "anonymous",
            val deviceHash: String = "",
            val deviceModel: String = Build.MODEL ?: "Android",
            val combatMode: String = "gbl",
            val league: String = "GREAT LEAGUE",
            val teamName: String = "",
            val teamArchetype: String = "ABC",
            val result: String = "WIN",
            val leadMatchup: String = "NEUTRAL",
            val battleDurationSec: Double? = null,
            val bmfScore: Double? = null,
            val execWae: Double? = null,
            val adherenceRatePct: Int? = null,
            val recommendationsIssuedCount: Int = 0,
            val recommendationsFollowedCount: Int = 0,
            val firstSwapActor: String = "NONE",
            val switchAdvantage: String = "NEUTRAL",
            val userShieldsRemaining: Int = 2,
            val oppShieldsRemaining: Int = 2,
            val userFaints: Int = 0,
            val oppFaints: Int = 0,
            val scannerSettings: Map<String, Any> = emptyMap(),
            val settingsProfileSignature: String = "",
            val settingsChanges: List<AiTelemetrySettingsChangeEvent> = emptyList(),
            val userTeamSpecs: List<AiTelemetrySlotSpec> = emptyList(),
            val oppTeamSpecs: List<AiTelemetryOppSlotSpec> = emptyList(),
            val anomalies: List<BattleAnomalyRecord> = emptyList(),
            val anomalyCount: Int = 0,
            val hasHighSeverityAnomaly: Boolean = false,
            val timelineEvents: List<BattleTimelineEvent> = emptyList(),
            val shadowProfileBenchmark: Map<String, Any> = emptyMap(),
            val postCutsceneHpAudits: List<PostCutsceneHpAuditRecord> = emptyList(),
            val energyLedger: List<EnergyLedgerEntry> = emptyList(),
            val hpAndEnergyDiagnosticsSummary: Map<String, Any> = emptyMap(),
            val dvrVideoPath: String? = null,
            val dvrDeepTracePath: String? = null
        )

        /**
         * v6.02 / v6.07: Compact 10Hz scalar sensor tick recorded in RAM during combat with zero CPU overhead.
         * Includes raw vs. committed HP%, detected HP bar Y-row lock coordinates, and energy mutation attribution.
         */
        data class BattleSensorTick(
            val tMs: Long,
            val playerHpPct: Int,
            val oppHpPct: Int,
            val leftFillPct: Int,
            val rightFillPct: Int,
            val playerShields: Int,
            val oppShields: Int,
            val playerBalls: Int,
            val oppBalls: Int,
            val activeUserIdx: Int,
            val activeOppIdx: Int,
            val isCutsceneActive: Boolean,
            val committedPlayerHpPct: Int = playerHpPct,
            val committedOppHpPct: Int = oppHpPct,
            val playerHpRowY: Int = -1,
            val oppHpRowY: Int = -1,
            val userEnergy: Int = 0,
            val oppEnergy: Int = 0,
            val energyMutationSource: String = "NONE"
        )

        data class AiTelemetryManifestEntry(
            val batchId: String = "",
            val path: String = "",
            val uploadedAtMs: Long = 0L,
            val uploader: String = "",
            val deviceHash: String = "",
            val appVersion: String = APP_VERSION,
            val battleCount: Int = 0,
            val anomalyCount: Int = 0,
            val highSeverityCount: Int = 0
        )

        data class AiTelemetryManifest(
            val schemaVersion: String = APP_VERSION,
            val updatedAtMs: Long = 0L,
            val totalBatches: Int = 0,
            val totalBattles: Int = 0,
            val totalAnomalies: Int = 0,
            val batches: List<AiTelemetryManifestEntry> = emptyList()
        )


        data class MoveStats(
            val name: String,
            val type: String,
            val power: Int,
            val energyCost: Int = 50
        )

        data class MoveBuffEffect(
            val selfAtkDelta: Int = 0,
            val selfDefDelta: Int = 0,
            val oppAtkDelta: Int = 0,
            val oppDefDelta: Int = 0,
            val chance: Double = 0.0
        )

        data class ChargedCycleSimResult(
            val effectivePressure: Double,
            val effectiveFreqMult: Double,
            val bestMovePct: Int,
            val fastestMovePct: Int
        )

        val BASELINE_MOVE_BUFF_EFFECTS: Map<String, MoveBuffEffect> get() = PokemonStaticData.BASELINE_MOVE_BUFF_EFFECTS

        val DYNAMIC_MOVE_BUFF_TABLE = java.util.concurrent.ConcurrentHashMap<String, MoveBuffEffect>()


        data class PokemonMeta(
            val name: String,
            val speciesId: String,
            val baseSpecies: String,
            val formLabel: String,
            val types: List<String>,
            val defaultCp: Int,
            val defaultFastMove: String,
            val fastTurns: Int,
            val chargedMove1: String,
            val chargedMove2: String,
            val c1Dmg: Int = 35,
            val c2Dmg: Int = 50,
            val atk: Double = 210.0,
            val def: Double = 190.0,
            val hp: Int = 180,
            val glRank: Int = 500,
            val ulRank: Int = 500,
            val mlRank: Int = 500,
            val chargedMove3: String = "",
            val chargedMove4: String = "",
            val isRawBaseStats: Boolean = false,
            val defaultIvsGl: String = "1/15/15",
            val defaultIvsUl: String = "1/15/15"
        )

        val RECOMMENDED_CHARGED_MOVES: Map<String, Triple<String, String, String>> get() = PokemonStaticData.RECOMMENDED_CHARGED_MOVES


        val COMMON_THIRD_CHARGED_MOVE: Map<String, String> get() = PokemonStaticData.COMMON_THIRD_CHARGED_MOVE
        val MOVE_DATABASE: Map<String, MoveStats> get() = PokemonStaticData.MOVE_DATABASE

        internal val WHITESPACE_REGEX = Regex("\\s+")
        internal val WHITESPACE_OR_HYPHEN_REGEX = Regex("[\\s-]+")

        internal val STATIC_MOVE_DATABASE_LOOKUP: Map<String, MoveStats> by lazy {
            val map = HashMap<String, MoveStats>(MOVE_DATABASE.size * 4)
            for ((k, v) in MOVE_DATABASE) {
                val trimmed = k.trim()
                val lower = trimmed.lowercase()
                val spaceKey = lower.replace('-', ' ')
                val hyphenKey = lower.replace(WHITESPACE_REGEX, "-")
                val underscoreKey = lower.replace(WHITESPACE_OR_HYPHEN_REGEX, "_")
                map[trimmed] = v
                map[lower] = v
                map[spaceKey] = v
                map[hyphenKey] = v
                map[underscoreKey] = v
            }
            map
        }


        val FAST_MOVE_TURNS: Map<String, Int> get() = PokemonStaticData.FAST_MOVE_TURNS
        val POKEMON_META_DATABASE: List<PokemonMeta> get() = PokemonStaticData.POKEMON_META_DATABASE

        // Dynamically loaded species & moves from PvPoke gamemaster.json (1,100+ Pokémon)
        val DYNAMIC_POKEMON_DATABASE = CopyOnWriteArrayList<PokemonMeta>()
        val DYNAMIC_MOVE_DATABASE = java.util.concurrent.ConcurrentHashMap<String, MoveStats>()
        val DYNAMIC_FAST_TURNS = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_ENERGY = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_POWER = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_TYPE = java.util.concurrent.ConcurrentHashMap<String, String>()
        val SPECIES_FAST_MOVES_POOL = java.util.concurrent.ConcurrentHashMap<String, List<String>>()
        val SPECIES_CHARGED_MOVES_POOL = java.util.concurrent.ConcurrentHashMap<String, List<String>>()

        val FALLBACK_SPECIES_FAST_POOL: Map<String, List<String>> get() = PokemonStaticData.FALLBACK_SPECIES_FAST_POOL
        val FALLBACK_SPECIES_CHARGED_POOL: Map<String, List<String>> get() = PokemonStaticData.FALLBACK_SPECIES_CHARGED_POOL
        val FAST_MOVE_ENERGY: Map<String, Int> get() = PokemonStaticData.FAST_MOVE_ENERGY


        val MOVE_ENERGY_COST: Map<String, Int> get() = PokemonStaticData.MOVE_ENERGY_COST

        internal val STATIC_MOVE_ENERGY_LOOKUP: Map<String, Int> by lazy {
            val map = HashMap<String, Int>(MOVE_ENERGY_COST.size * 3)
            for ((k, v) in MOVE_ENERGY_COST) {
                val lower = k.trim().lowercase()
                map[lower] = v
                map[lower.replace('-', ' ')] = v
                map[lower.replace(' ', '-')] = v
            }
            map
        }

        @Volatile
        internal var CACHED_ALL_POKEMON_META: List<PokemonMeta>? = null
        internal val RESOLVED_SPECIES_CACHE = java.util.concurrent.ConcurrentHashMap<String, PokemonMeta>()
        internal val TOP_META_POOL_CACHE = java.util.concurrent.ConcurrentHashMap<String, List<String>>()
        internal val TOP_30_RANKED_POOL_CACHE = java.util.concurrent.ConcurrentHashMap<String, List<String>>()


        /**
         * FormResolver:
         * Resolves multi-form and regional species to the highest-ranked PvPoke variant
         * (including Shadow vs non-Shadow ranking comparison) for the currently active league,
         * and provides cycling across valid forms.
         */
        fun normalizeLeagueKeyStatic(league: String): String {
            val trimmed = league.trim()
            val upper = trimmed.uppercase()
            if (LIVE_RANKINGS_MAP.containsKey(upper)) return upper
            if (upper == "GREAT LEAGUE" || upper == "GREAT LEAGUE (1500)") return "GREAT LEAGUE"
            if (upper == "ULTRA LEAGUE" || upper == "ULTRA LEAGUE (2500)") return "ULTRA LEAGUE"
            if (upper == "MASTER LEAGUE" || upper == "MASTER LEAGUE (10000)") return "MASTER LEAGUE"
            if (upper == "MEGA MASTER LEAGUE" || upper == "MEGA MASTER LEAGUE (10000)" || upper == "MASTER LEAGUE (MEGA)" || upper == "MASTER LEAGUE (MEGA) (10000)") {
                return "MEGA MASTER LEAGUE (10000)"
            }
            val matchedCatalog = (LAST_LOADED_META_CATALOG + DEFAULT_LIMITED_META_CATALOG).find {
                it.leagueKey.equals(trimmed, ignoreCase = true) ||
                    "${it.title} (${it.cp})".equals(trimmed, ignoreCase = true) ||
                    it.title.equals(trimmed, ignoreCase = true)
            }
            if (matchedCatalog != null) return matchedCatalog.leagueKey.uppercase()
            if (Regex("\\((500|1500|2500|10000)\\)").containsMatchIn(upper)) return upper
            return when {
                upper.contains("SPECTRAL") -> "BATTLE FRONTIER (SPECTRAL)"
                upper.contains("CAULDRON") -> "BATTLE FRONTIER (CAULDRON)"
                upper.contains("SPELLCRAFT") -> "BATTLE FRONTIER (SPELLCRAFT)"
                upper.contains("LAGOON") -> "BATTLE FRONTIER (LAGOON)"
                upper.contains("FRONTIER (UL)") -> "BATTLE FRONTIER (UL)"
                upper.contains("FRONTIER") -> "BATTLE FRONTIER (MASTER)"
                upper.contains("MEGA GREAT") -> "MEGA GREAT LEAGUE (1500)"
                upper.contains("MEGA ULTRA") -> "MEGA ULTRA LEAGUE (2500)"
                upper.contains("MEGA") -> "MEGA MASTER LEAGUE (10000)"
                upper.contains("GREAT") -> "GREAT LEAGUE"
                upper.contains("ULTRA") -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
        }

        fun isBattleFrontierLeagueStatic(league: String): Boolean {
            val k = normalizeLeagueKeyStatic(league)
            return k.startsWith("BATTLE FRONTIER") || (LAST_LOADED_META_CATALOG + DEFAULT_LIMITED_META_CATALOG).any { it.leagueKey.equals(league, ignoreCase = true) }
        }

        object FormResolver {
            private fun normalizeLeagueKey(activeLeague: String): String = normalizeLeagueKeyStatic(activeLeague)

            fun isShadowEligibleVariant(variant: PokemonMeta): Boolean {
                val idLower = variant.speciesId.lowercase().removeSuffix("_shadow")
                val nameLower = variant.name.lowercase()
                if (idLower == "mewtwo_armored" || nameLower.contains("armored")) return false
                if (idLower.contains("_mega") || idLower.contains("_primal") || nameLower.startsWith("mega ") || nameLower.startsWith("primal ")) return false
                if (idLower.startsWith("zacian") || idLower.startsWith("zamazenta") || idLower.startsWith("zygarde") || idLower.startsWith("necrozma") || idLower.startsWith("keldeo") || idLower.startsWith("urshifu") || idLower == "mew" || idLower.startsWith("morpeko") || idLower.startsWith("mimikyu") || idLower.startsWith("aegislash") || idLower.startsWith("cramorant")) return false
                return true
            }

            /**
             * Evaluates a non-Shadow form variant in `activeLeague` against `LIVE_RANKINGS_MAP`
             * (and curated current-meta fallback rules) to determine:
             *  - First: Best effective rank position (lower = stronger/higher rated) across both normal and Shadow entries
             *  - Second: Whether the Shadow version (`speciesId_shadow`) is higher rated than the normal version in this league
             */
            fun getEffectiveRankAndShadowForVariant(variant: PokemonMeta, activeLeague: String): Pair<Int, Boolean> {
                val normLeague = normalizeLeagueKey(activeLeague)
                val baseId = variant.speciesId.lowercase().removeSuffix("_shadow")
                val isMegaVariant = OverlayService.isMegaOrPrimalSpeciesStatic(baseId) || OverlayService.isMegaOrPrimalSpeciesStatic(variant.name)
                val map = LIVE_RANKINGS_MAP[normLeague]
                if (isMegaVariant && !isMegaAllowedInLeagueStatic(normLeague) && map?.containsKey(baseId) != true) {
                    return 9999 to false
                }
                val normalEntry = map?.get(baseId)
                val shadowEntry = if (isShadowEligibleVariant(variant)) map?.get("${baseId}_shadow") else null

                // Curated current-meta anchors ensuring exact behavior for Great League Ninetales, Ultra League Mewtwo, and Master League Mewtwo
                if (normLeague == "GREAT LEAGUE" && baseId == "ninetales") {
                    val alolanBestRank = listOfNotNull(
                        map?.get("ninetales_alolan")?.rank,
                        map?.get("ninetales_alolan_shadow")?.rank
                    ).minOrNull() ?: 28
                    val kantoShadRank = shadowEntry?.rank ?: 11
                    return min(kantoShadRank, (alolanBestRank - 1).coerceAtLeast(1)) to true
                }
                if (normLeague == "ULTRA LEAGUE" && baseId == "mewtwo_armored") {
                    val regMewtwoBestRank = listOfNotNull(
                        map?.get("mewtwo")?.rank,
                        map?.get("mewtwo_shadow")?.rank
                    ).minOrNull() ?: 210
                    val armoredRank = normalEntry?.rank ?: 32
                    return min(armoredRank, (regMewtwoBestRank - 1).coerceAtLeast(1)) to false
                }
                if ((normLeague == "MASTER LEAGUE" || normLeague == "MEGA MASTER LEAGUE") && baseId == "mewtwo") {
                    val armoredRank = map?.get("mewtwo_armored")?.rank ?: 180
                    val shadRank = shadowEntry?.rank ?: normalEntry?.rank ?: 8
                    return min(shadRank, (armoredRank - 1).coerceAtLeast(1)) to true
                }

                if (normalEntry != null || shadowEntry != null) {
                    val shadowBetter = shadowEntry != null && (
                        normalEntry == null ||
                            shadowEntry.rank < normalEntry.rank ||
                            (shadowEntry.rank == normalEntry.rank && shadowEntry.score > normalEntry.score)
                        )
                    val bestRank = if (shadowBetter) shadowEntry!!.rank else normalEntry!!.rank
                    return bestRank to shadowBetter
                }

                val staticRank = when (normLeague) {
                    "GREAT LEAGUE", "BATTLE FRONTIER (SPECTRAL)" -> variant.glRank
                    "ULTRA LEAGUE", "BATTLE FRONTIER (CAULDRON)" -> variant.ulRank
                    else -> variant.mlRank
                }
                val staticDefaultShadow = when {
                    !isShadowEligibleVariant(variant) -> false
                    normLeague == "GREAT LEAGUE" && (baseId == "ninetales" || baseId == "pidgeot" || baseId == "feraligatr" || baseId == "quagsire" || baseId == "whiscash" || baseId == "drapion" || baseId == "annihilape" || baseId == "machamp") -> true
                    normLeague == "ULTRA LEAGUE" && (baseId == "feraligatr" || baseId == "drapion" || baseId == "pidgeot") -> true
                    (normLeague == "MASTER LEAGUE" || normLeague == "MEGA MASTER LEAGUE") && (baseId == "mewtwo" || baseId == "rhyperior" || baseId == "mamoswine") -> true
                    else -> false
                }
                return staticRank to staticDefaultShadow
            }

            fun getVariantsForSpecies(speciesOrName: String, activeLeague: String): List<PokemonMeta> {
                val base = extractBaseSpecies(speciesOrName)
                val variants = OverlayService.getAllPokemonMeta()
                    .filter {
                        it.baseSpecies.equals(base, ignoreCase = true) &&
                            !it.speciesId.endsWith("_shadow", ignoreCase = true) &&
                            !it.name.startsWith("Shadow ", ignoreCase = true)
                    }
                    .distinctBy { it.speciesId.lowercase() }
                if (variants.isEmpty()) return emptyList()

                return variants.sortedBy { meta ->
                    getEffectiveRankAndShadowForVariant(meta, activeLeague).first
                }
            }

            fun resolveBestDefaultFormAndShadow(
                detectedMeta: PokemonMeta,
                rawText: String,
                activeLeague: String
            ): Pair<PokemonMeta, Boolean> {
                val lowerRaw = rawText.lowercase()
                val explicitShadowInText = lowerRaw.contains("shadow") && !lowerRaw.contains("shadow rider")
                val variants = getVariantsForSpecies(detectedMeta.baseSpecies, activeLeague)
                if (variants.isEmpty()) {
                    val (_, defShad) = getEffectiveRankAndShadowForVariant(detectedMeta, activeLeague)
                    return detectedMeta to (explicitShadowInText || defShad)
                }

                // Check if OCR or input text explicitly specifies a form keyword (ignoring "base", "kanto", and "shadow")
                var explicitVariant: PokemonMeta? = null
                if (lowerRaw.contains("mega")) {
                    val wantMegaX = Regex("\\bx\\b").containsMatchIn(lowerRaw) || lowerRaw.contains("mega_x")
                    val wantMegaY = Regex("\\by\\b").containsMatchIn(lowerRaw) || lowerRaw.contains("mega_y")
                    explicitVariant = when {
                        wantMegaX -> variants.find { it.speciesId.endsWith("_mega_x", ignoreCase = true) || it.formLabel.equals("Mega X", ignoreCase = true) }
                        wantMegaY -> variants.find { it.speciesId.endsWith("_mega_y", ignoreCase = true) || it.formLabel.equals("Mega Y", ignoreCase = true) }
                        else -> variants.find { it.speciesId.endsWith("_mega", ignoreCase = true) || it.formLabel.equals("Mega", ignoreCase = true) }
                    }
                }
                if (explicitVariant == null) {
                    for (variant in variants) {
                        val labelLower = variant.formLabel.lowercase()
                        if (labelLower != "base" && labelLower != "kanto" && labelLower != "shadow" && lowerRaw.contains(labelLower)) {
                            explicitVariant = variant
                            break
                        }
                    }
                }
                if (explicitVariant == null && (lowerRaw.contains("kanto") || lowerRaw.contains("kantonian"))) {
                    explicitVariant = variants.find {
                        it.formLabel.equals("Kanto", ignoreCase = true) ||
                            it.speciesId.equals(detectedMeta.baseSpecies, ignoreCase = true)
                    }
                }

                val chosenVariant = explicitVariant ?: variants.first()
                val (_, rankPrefersShadow) = getEffectiveRankAndShadowForVariant(chosenVariant, activeLeague)
                val finalShadow = if (!isShadowEligibleVariant(chosenVariant)) {
                    false
                } else if (explicitShadowInText) {
                    true
                } else {
                    rankPrefersShadow
                }
                return chosenVariant to finalShadow
            }

            fun resolveBestDefaultVariant(detectedMeta: PokemonMeta, rawText: String, activeLeague: String): PokemonMeta {
                return resolveBestDefaultFormAndShadow(detectedMeta, rawText, activeLeague).first
            }

            private val PARENS_REGEX = Regex("\\(.*?\\)")
            private val FORM_MODIFIERS_REGEX = Regex(
                "\\b(?:shadow|purified|kanto|kantonian|alolan|alola|galarian|galar|hisuian|hisui|paldean|paldea|unovan|unova|mega|primal|armored|origin|origine|altered|therian|incarnate|crowned|hero|resolute|ordinary|defense|attack|speed|normal|black|white|complete|unbound|confined|sky|land|bloodmoon|apex|dusk|mane|dawn|wings|single|rapid|strike|ice|rider|baile|pau|sensu|zen|standard|combat|blaze|aqua|wash|heat|frost|mow|fan|sunny|rainy|snowy|plant|trash|sandy|burn|chill|douse|shock)\\b"
            )
            private val MULTI_SPACE_REGEX = Regex("\\s+")
            private val BASE_SPECIES_CACHE = java.util.concurrent.ConcurrentHashMap<String, String>()
            private val STATIC_EXACT_BASE_SPECIES_MAP: Map<String, String> by lazy {
                val map = HashMap<String, String>(POKEMON_META_DATABASE.size * 2)
                for (m in POKEMON_META_DATABASE) {
                    map[m.name.lowercase()] = m.baseSpecies.lowercase()
                }
                map
            }

            fun extractBaseSpecies(name: String): String {
                val trimmed = name.trim()
                if (trimmed.isEmpty()) return ""
                val lowerTrimmed = trimmed.lowercase()
                BASE_SPECIES_CACHE[lowerTrimmed]?.let { return it }

                val computed = STATIC_EXACT_BASE_SPECIES_MAP[lowerTrimmed] ?: run {
                    val cleaned = lowerTrimmed
                        .replace(PARENS_REGEX, " ")
                        .replace(FORM_MODIFIERS_REGEX, " ")
                        .replace(MULTI_SPACE_REGEX, " ")
                        .trim()

                    if (cleaned.startsWith("tapu ")) {
                        cleaned
                    } else {
                        val token = cleaned.split(" ").firstOrNull()?.takeIf { it.isNotBlank() }
                        token ?: (lowerTrimmed.replace(PARENS_REGEX, "").trim().split(" ").lastOrNull() ?: lowerTrimmed)
                    }
                }
                BASE_SPECIES_CACHE[lowerTrimmed] = computed
                return computed
            }
        }

        data class MoveUsage(
            val moveId: String,
            val uses: Int? = null
        )

        data class RankingMoves(
            val fastMoves: List<MoveUsage>,
            val chargedMoves: List<MoveUsage>
        )

        data class PokemonRankingEntry(
            val speciesId: String,
            val score: Double,
            val moves: RankingMoves,
            val moveCount: List<Int>? = null,
            val moveset: List<String>? = null,
            val rank: Int = 500
        )

        data class PokemonAutocompleteSuggestion(
            val name: String,
            val speciesId: String,
            val baseSpecies: String,
            val formBadge: String,
            val cp: Int,
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val isShadow: Boolean,
            val isAlternateForm: Boolean
        )

        val LIVE_RANKINGS_MAP = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.ConcurrentHashMap<String, PokemonRankingEntry>>()
        val DYNAMIC_MOVE_ID_TO_NAME = java.util.concurrent.ConcurrentHashMap<String, String>()

        val CANONICAL_MOVE_ID_MAP: Map<String, String> = mapOf(
            "SUPER_POWER" to "Superpower",
            "LOCK_ON" to "Lock-On",
            "MUD_SLAP" to "Mud-Slap",
            "POWER_UP_PUNCH" to "Power-Up Punch",
            "X_SCISSOR" to "X-Scissor",
            "NATURES_MADNESS" to "Nature's Madness",
            "TORCH_SONG" to "Torch Song",
            "BRUTAL_SWING" to "Brutal Swing",
            "WATER_SHURIKEN" to "Water Shuriken",
            "PSYWAVE" to "Psywave",
            "DISARMING_VOICE" to "Disarming Voice",
            "HYDRO_CANNON" to "Hydro Cannon",
            "NIGHT_SLASH" to "Night Slash",
            "BODY_SLAM" to "Body Slam",
            "EARTHQUAKE" to "Earthquake",
            "SHADOW_BALL" to "Shadow Ball",
            "INCINERATE" to "Incinerate",
            "WEATHER_BALL_FIRE" to "Weather Ball (Fire)",
            "WEATHER_BALL_ICE" to "Weather Ball (Ice)",
            "WEATHER_BALL_WATER" to "Weather Ball (Water)",
            "WEATHER_BALL_ROCK" to "Weather Ball (Rock)",
            "WEATHER_BALL_NORMAL" to "Weather Ball",
            "CHILLING_WATER" to "Chilling Water",
            "FUTURE_SIGHT" to "Future Sight",
            "ROAR_OF_TIME" to "Roar of Time",
            "FREEZE_SHOCK" to "Freeze Shock",
            "ICE_BURN" to "Ice Burn",
            "FUSION_BOLT" to "Fusion Bolt",
            "FUSION_FLARE" to "Fusion Flare",
            "SPACIAL_REND" to "Spacial Rend",
            "ROCK_TOMB" to "Rock Tomb",
            "SAND_TOMB" to "Sand Tomb",
            "MIRROR_SHOT" to "Mirror Shot",
            "VOLT_SWITCH" to "Volt Switch",
            "FELL_STINGER" to "Fell Stinger",
            "VOLT_TACKLE" to "Volt Tackle",
            "PSYBEAM" to "Psybeam",
            "HEAT_WAVE" to "Heat Wave",
            "DRAIN_PUNCH" to "Drain Punch",
            "FELL_STINGER_PLUS" to "Fell Stinger+",
            "VOLT_TACKLE_PLUS" to "Volt Tackle+",
            "ZAP_CANNON_PLUS" to "Zap Cannon+",
            "ACID_SPRAY_PLUS" to "Acid Spray+",
            "LIQUIDATION_PLUS" to "Liquidation+",
            "OUTRAGE_PLUS" to "Outrage+",
            "DYNAMIC_PUNCH_PLUS" to "Dynamic Punch+",
            "FUTURE_SIGHT_PLUS" to "Future Sight+",
            "DRILL_PECK_PLUS" to "Drill Peck+",
            "DARK_PULSE_PLUS" to "Dark Pulse+",
            "NIGHT_SHADE_PLUS" to "Night Shade+",
            "BRAVE_BIRD_PLUS" to "Brave Bird+",
            "OMINOUS_WIND_PLUS" to "Ominous Wind+",
            "SEED_BOMB_PLUS" to "Seed Bomb+",
            "MYSTICAL_FIRE_PLUS" to "Mystical Fire+",
            "SURF_PLUS" to "Surf+",
            "PSYBEAM_PLUS" to "Psybeam+",
            "BRICK_BREAK_PLUS" to "Brick Break+"
        )

        val REQUIRED_LEAGUE_KEYS = listOf(
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "BATTLE FRONTIER (SPECTRAL)",
            "BATTLE FRONTIER (CAULDRON)",
            "BATTLE FRONTIER (MASTER)"
        )


        internal val CPM_TABLE: List<Pair<Double, Double>> get() = PokemonStaticData.CPM_TABLE


        internal val fastMovePowerMapStatic: Map<String, Int> get() = PokemonStaticData.fastMovePowerMapStatic
        internal val fastMoveTypeMapStatic: Map<String, String> get() = PokemonStaticData.fastMoveTypeMapStatic


        val ALL_SHIELD_PERMUTATIONS: List<Triple<Int, Int, String>> get() = PokemonStaticData.ALL_SHIELD_PERMUTATIONS


        internal val PRECOMPUTED_TOP200_9X9_CACHE = java.util.concurrent.ConcurrentHashMap<String, Map<String, Int>>()
        @Volatile var lastPrecomputedTeamSignature: String = ""


        data class BlendedSeasonMetaDistribution(
            val leadWeights: Map<String, Double>,
            val fieldWeights: Map<String, Double>,
            val backWeights: Map<String, Double> = emptyMap(),
            val seasonMatchCount: Int,
            val sameCpStdMatchCount: Int = 0,
            val histWeightPct: Int,
            val stdCupWeightPct: Int = 0,
            val sheetWeightPct: Int = 0,
            val metaWeightPct: Int,
            val rawSeenCounts: Map<String, Int> = emptyMap(),
            val pvpokeRankMap: Map<String, Int> = emptyMap()
        )

        data class BlendedMetaPokemonEntry(
            val rank: Int,
            val name: String,
            val blendedSharePct: Double,
            val leadSharePct: Double,
            val backSharePct: Double,
            val logSeenCount: Int,
            val pvpokeRank: Int?
        )

        data class BlendedMetaCoreEntry(
            val rank: Int,
            val monA: String,
            val monB: String,
            val blendedPairPct: Double,
            val logPairCount: Int,
            val synergyScore: Int,
            val roleArchetype: String
        )

        data class BacklineCandidatePrediction(
            val name: String,
            val code: String,
            val likelihoodPct: Int,
            val hardCountersMySwap: Boolean,
            val bestRoleVsMe: String
        )

        data class BacklinePredictionResult(
            val candidates: List<BacklineCandidatePrediction>,
            val swapPunishRiskPct: Int,
            val swapPunishThreatCode: String,
            val hudLine2Text: String
        )


        data class TeamArchetypeEvaluationResult(
            val orderedSlots: List<TeamMember>,
            val archetype: String, // "ABB" or "ABC"
            val leadAggBr: Int,
            val machineAggBr: Int,
            val safeSwapBr: Int,
            val closerSwapBr: Int,
            val closerBr: Int,
            val sharedWeaknesses: List<String>,
            val histWeightPct: Int,
            val seasonMatchCount: Int,
            val reasonSummary: String = "",
            val topMetaTargetsTotal: Int = 25,
            val topMetaWinsCount: Int = 0,
            val keyMetaTargetsBeaten: List<String> = emptyList(),
            val keyThreats: List<String> = emptyList(),
            val coreBreakers: List<String> = emptyList(),
            val altMovesetSlots: List<AntiMetaAltMovesetInfo> = emptyList(),
            val synergySummary: String = ""
        )

        internal val ALL_18_TYPES = listOf(
            "normal", "fire", "water", "electric", "grass", "ice",
            "fighting", "poison", "ground", "flying", "psychic", "bug",
            "rock", "ghost", "dragon", "dark", "steel", "fairy"
        )

        internal val CRITICAL_META_TYPES = setOf(
            "ground", "water", "fighting", "fairy", "flying", "steel", "dark", "ghost", "dragon", "ice", "electric"
        )


        data class RoleUpgradeSuggestion(
            val slotIndex: Int, // 0 = Lead, 1 = Safe Swap, 2 = Closer
            val roleTitle: String,
            val candidate: TeamMember,
            val newRoleBr: Int,
            val roleBrDelta: Int,
            val newMachineAggBr: Int,
            val machineBrDelta: Int,
            val newLeadAggBr: Int,
            val newArchetype: String,
            val compositeScore: Double,
            val synergyTag: String
        )

        data class TeamRoleRecommendationsResult(
            val baselineEval: TeamArchetypeEvaluationResult,
            val candidatePoolSize: Int,
            val leadUpgrades: List<RoleUpgradeSuggestion>,
            val safeSwapUpgrades: List<RoleUpgradeSuggestion>,
            val closerUpgrades: List<RoleUpgradeSuggestion>
        )


        data class MovesetUpgradeSuggestion(
            val slotIndex: Int,
            val roleTitle: String,
            val pokemonName: String,
            val currentFastMove: String,
            val currentCharged1: String,
            val currentCharged2: String,
            val proposedFastMove: String,
            val proposedCharged1: String,
            val proposedCharged2: String,
            val currentRoleBr: Int,
            val newRoleBr: Int,
            val roleBrDelta: Int,
            val currentMachineAggBr: Int,
            val newMachineAggBr: Int,
            val machineBrDelta: Int,
            val currentLeadAggBr: Int,
            val newLeadAggBr: Int,
            val leadBrDelta: Int,
            val compositeScore: Double
        )

        data class TeamMovesetRecommendationsResult(
            val baselineEval: TeamArchetypeEvaluationResult,
            val combosEvaluated: Int,
            val slot1Movesets: List<MovesetUpgradeSuggestion>,
            val slot2Movesets: List<MovesetUpgradeSuggestion>,
            val slot3Movesets: List<MovesetUpgradeSuggestion>,
            val top3OverallMovesets: List<MovesetUpgradeSuggestion>
        )


        data class FeaturedRankRangeSpec(
            val raw: String,
            val minRank: Int,
            val maxRank: Int,
            val label: String
        )


        data class AntiMetaAltMovesetInfo(
            val slotIndex: Int, // 0 = Lead, 1 = Swap/B1, 2 = Closer/B2
            val roleLabel: String,
            val pokemonName: String,
            val isAltMoveset: Boolean,
            val standardFastMove: String,
            val standardCharged1: String,
            val standardCharged2: String,
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val roleBrDelta: Int,
            val coreBrDelta: Int
        )

        data class SilphScopeTopMetaEntry(
            val rank: Int,
            val name: String,
            val weightPct: Double,
            val metaBr: Int = 500
        )

        data class AntiMetaTeamOption(
            val id: String,
            val archetype: String, // "ABB", "ABC", or "DUO"
            val rank: Int,
            val league: String,
            val pokemon: List<TeamMember>,
            val featuredNamesIncluded: List<String>,
            val featuredRankMap: Map<String, Int> = emptyMap(),
            val leadAggBr: Int,
            val machineAggBr: Int,
            val safeSwapBr: Int,
            val closerSwapBr: Int,
            val closerBr: Int,
            val sharedWeaknesses: List<String>,
            val compositeAntiMetaScore: Double,
            val topMetaTargetsTotal: Int = 25,
            val topMetaWinsCount: Int,
            val keyMetaTargetsBeaten: List<String>,
            val keyThreats: List<String> = emptyList(),
            val coreBreakers: List<String> = emptyList(),
            val altMovesetSlots: List<AntiMetaAltMovesetInfo> = emptyList(),
            val synergySummary: String
        )

        data class AntiMetaTeamBuilderResult(
            val league: String,
            val leagueAbbr: String,
            val featuredPokemon: List<String>,
            val top5AbbTeams: List<AntiMetaTeamOption>,
            val top5AbcTeams: List<AntiMetaTeamOption>,
            val top5DuoTeams: List<AntiMetaTeamOption> = emptyList(),
            val candidatesEvaluated: Int,
            val movesetCombosSimulated: Int = 0,
            val metaTargetCount: Int = 25,
            val top25MetaNames: List<String> = emptyList(),
            val top25MetaList: List<SilphScopeTopMetaEntry> = emptyList(),
            val top50MetaList: List<SilphScopeTopMetaEntry> = emptyList(),
            val metaSummaryLabel: String = "",
            val elapsedMs: Long
        )


        internal data class RoleWeightedTop100MetaDist(
            val leadWeights: Map<String, Double>,
            val swapWeights: Map<String, Double>,
            val closerWeights: Map<String, Double>,
            val fieldWeights: Map<String, Double>,
            val top25Threats: List<String>,
            val top25MetaList: List<SilphScopeTopMetaEntry>,
            val top50Threats: List<String>,
            val top50MetaList: List<SilphScopeTopMetaEntry>,
            val top100Species: List<String>,
            val wHistPct: Int,
            val wMetaPct: Int,
            val seasonMatchCount: Int
        )


        data class Show6RosterPreset(
            val id: String = java.util.UUID.randomUUID().toString(),
            val name: String = "",
            val league: String = "GREAT LEAGUE",
            val pokemon: List<String> = emptyList(),
            val updatedAt: Long = System.currentTimeMillis()
        )

        data class Show6Pick3LineupRec(
            val id: String,
            val archetype: String, // "ABB", "ABC", "DUO"
            val rank: Int,
            val league: String,
            val pokemon: List<TeamMember>,
            val weightedExpectedBr: Int,
            val worstCaseMinimaxBr: Int,
            val compositeScore: Double,
            val leadAggBr: Int,
            val safeSwapBr: Int,
            val closerBr: Int,
            val machineAggBr: Int,
            val sharedWeaknesses: List<String>,
            val topOppLineupsBeatenCount: Int,
            val totalOppLineupsEvaluated: Int,
            val worstCounterLineupLabel: String,
            val synergySummary: String
        ) {
            val lead: TeamMember get() = pokemon[0]
            val safeSwap: TeamMember get() = pokemon.getOrElse(1) { pokemon[0] }
            val closer: TeamMember get() = pokemon.getOrElse(2) { pokemon[0] }
            val leadBr: Int get() = leadAggBr
            val swapBr: Int get() = safeSwapBr
            val viabilityWeightedBr: Int get() = weightedExpectedBr
            val expectedWinRatePct: Int get() = ((topOppLineupsBeatenCount * 100.0) / max(1, totalOppLineupsEvaluated).toDouble()).roundToInt().coerceIn(5, 99)
            val synergyNote: String get() = synergySummary
        }

        data class Show6OpponentViableLineup(
            val rank: Int,
            val pokemonNames: List<String>,
            val archetype: String,
            val viabilityScore: Int,
            val normalizedWeightPct: Double
        )

        data class Show6Pick3OptimizerResult(
            val league: String,
            val myOptimized6: List<TeamMember>,
            val opp6Names: List<String>,
            val top3AbbTeams: List<Show6Pick3LineupRec>,
            val top3AbcTeams: List<Show6Pick3LineupRec>,
            val top3DuoTeams: List<Show6Pick3LineupRec>,
            val topViableOpponentLineups: List<Show6OpponentViableLineup>,
            val oppTop3AbbTeams: List<Show6OpponentViableLineup> = emptyList(),
            val oppTop3AbcTeams: List<Show6OpponentViableLineup> = emptyList(),
            val oppTop3DuoTeams: List<Show6OpponentViableLineup> = emptyList(),
            val totalMatchupsSimulated: Int,
            val elapsedMs: Long
        ) {
            val my6OptimallyMoved: List<TeamMember> get() = myOptimized6
            val topOpponentTrios: List<Show6OpponentViableLineup> get() = topViableOpponentLineups
            val oppTop3Abb: List<Show6OpponentViableLineup> get() = oppTop3AbbTeams
            val oppTop3Abc: List<Show6OpponentViableLineup> get() = oppTop3AbcTeams
            val oppTop3Duo: List<Show6OpponentViableLineup> get() = oppTop3DuoTeams
            val top3Abb: List<Show6Pick3LineupRec> get() = top3AbbTeams
            val top3Abc: List<Show6Pick3LineupRec> get() = top3AbcTeams
            val top3Duo: List<Show6Pick3LineupRec> get() = top3DuoTeams
        }

        data class BlindShow6RosterSlot(
            val pokemon: TeamMember,
            val roleLabel: String,
            val metaScore: Int,
            val coveredThreats: List<String>
        )

        data class BlindShow6RosterResult(
            val league: String,
            val roster: List<TeamMember>,
            val roster6: List<BlindShow6RosterSlot>,
            val lockedSlotsIncluded: List<String>,
            val metaCoveragePct: Int,
            val metaPoolSize: Int,
            val coreBreakerCount: Int,
            val coreBreakers: List<String>,
            val topAbbLineup: List<TeamMember>,
            val topAbcLineup: List<TeamMember>,
            val topDuoLineup: List<TeamMember>,
            val filterSummary: String,
            val elapsedMs: Long
        ) {
            val coveragePct: Int get() = metaCoveragePct
        }

        data class BattleFrontierCoreEntry(
            val monA: String,
            val monB: String,
            val usagePct: Double
        )

        data class Show6RosterSlotUpgradeRec(
            val candidate: TeamMember,
            val weightedScoreGain: Double,
            val newRosterBr: Int,
            val usagePct: Double,
            val coreBonusLabel: String,
            val reason: String
        )

        data class Show6RosterSlotMovesetRec(
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val avgBrVsMeta: Int,
            val deltaBr: Int,
            val isCurrent: Boolean
        )


        val BATTLE_FRONTIER_USAGE_MAP: MutableMap<String, MutableMap<String, Double>> get() = Show6StaticData.BATTLE_FRONTIER_USAGE_MAP
        val BATTLE_FRONTIER_CORES_MAP: MutableMap<String, MutableList<BattleFrontierCoreEntry>> get() = Show6StaticData.BATTLE_FRONTIER_CORES_MAP

    }

    internal lateinit var windowManager: WindowManager
    internal var overlayView: WebView? = null
    internal lateinit var layoutParams: WindowManager.LayoutParams
    internal var statusToastView: TextView? = null
    internal var statusToastParams: WindowManager.LayoutParams? = null
    internal var shieldDecisionOverlayView: LinearLayout? = null
    internal var shieldDecisionOverlayParams: WindowManager.LayoutParams? = null
    internal var shieldDecisionOverlayShownAtMs: Long = 0L
    internal var isShieldDecisionOverlayVisible: Boolean = false
    internal val mainToastHandler = Handler(Looper.getMainLooper())
    internal val hideStatusToastRunnable = Runnable {
        try {
            statusToastView?.visibility = View.GONE
        } catch (_: Exception) {}
    }
    internal val hideShieldDecisionOverlayRunnable = Runnable {
        hideShieldDecisionOverlay()
    }
    internal lateinit var prefs: SharedPreferences
    internal val gson = Gson()

    internal var mediaProjectionManager: MediaProjectionManager? = null
    internal var mediaProjection: MediaProjection? = null
    internal var virtualDisplay: VirtualDisplay? = null
    internal var imageReader: ImageReader? = null
    internal var imageReaderThread: HandlerThread? = null
    internal var imageReaderHandler: Handler? = null

    internal var screenWidth = 1080
    internal var screenHeight = 2400
    internal var screenDensity = 2

    internal val textRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    internal var battleLoopJob: Job? = null

    internal var currentPreset: TeamPreset? = null
    internal var activeOpponentName: String = "Waiting..."
    internal var activeOpponentSpecies: String = ""
    internal var isOpponentShadow: Boolean = false
    internal var availableOpponentForms: List<PokemonMeta> = emptyList()
    internal var currentFormIndex: Int = 0

    internal var activeUserPokemonName: String? = null
    internal val detectedOpponents = mutableListOf<String>()
    internal val manualFormOverrides = mutableMapOf<String, String>()
    internal val manualShadowOverrides = mutableMapOf<String, Boolean>()
    internal var isWaitingForOpponent = true
    internal var isBattleActive = false
    internal var manualLeadMatchupOverride: String? = null
    internal var currentLeadMatchup: String = "NEUTRAL"
    internal var lastClearedOpponentsSnapshot: List<String> = emptyList()
    internal var lastClearedLeadMatchupSnapshot: String = "NEUTRAL"
    @Volatile internal var battleResetEpoch: Long = 0L
    @Volatile internal var lastBattleResetTimeMs: Long = 0L

    internal var currentLayoutMode = "option1"
    internal var oppCountMode = "my_fasts"
    internal var enable4ChargedMoves = false
    internal var disableBattleToasts = false
    internal var showTacticalRecommendations = true
    internal var showShieldDecisionOverlay = true
    internal var aiAdviceHudPosition = DEFAULT_AI_ADVICE_HUD_POSITION
    internal var overlayScalePct = 78
    internal var overlayTransparencyPct = 72
    internal var appThemeId = "dialga_shiny_midnight"
    internal var isOverlayMinimized = false
    internal var lastMinimizeTimestampMs: Long = 0L
    internal var cachedScreenBitmap: Bitmap? = null
    internal val captureLock = Any()

    // v2.34: Independent 50s Swap Countdown Timers, Shield vs. Pokéball Isolation & Faint State Machine
    internal var playerSwapEndTimeMs: Long = 0L
    internal var oppSwapEndTimeMs: Long = 0L
    internal var playerPokeballCount: Int = 3
    internal var oppPokeballCount: Int = 3
    internal var playerShieldsRemaining: Int = 2
    internal var oppShieldsRemaining: Int = 2
    internal val playerFaintedSlots = BooleanArray(3) { false }
    internal val oppFaintedSlots = BooleanArray(3) { false }
    internal var prevFrameTimestampMs: Long = 0L
    internal var currentFrameTimestampMs: Long = 0L
    internal var isPlayerTurnOne: Boolean = true
    internal var isOppTurnOne: Boolean = true
    internal var sampledPlayerBalls: Int = 3
    internal var sampledOppBalls: Int = 3
    internal var prevValidPlayerBalls: Int = 3
    internal var prevValidOppBalls: Int = 3
    internal var sampledPlayerShields: Int = 2
    internal var sampledOppShields: Int = 2

    // Post-switch self-healing & multi-frame faint verification state
    internal var lastPlayerSwitchTimeMs: Long = 0L
    internal var lastOppSwitchTimeMs: Long = 0L
    internal var lastPlayerSwitchFrameMs: Long = 0L
    internal var lastOppSwitchFrameMs: Long = 0L
    internal var lastPlayerPrevSlotIdx: Int = -1
    internal var lastOppPrevSlotIdx: Int = -1
    internal var lastPlayerSwitchWasFaint: Boolean = false
    internal var lastOppSwitchWasFaint: Boolean = false
    internal var playerPreSwitchBallCount: Int = 3
    internal var oppPreSwitchBallCount: Int = 3
    internal var playerSwapEndTimeBeforeSwitch: Long = 0L
    internal var oppSwapEndTimeBeforeSwitch: Long = 0L
    internal var playerPostSwitchLowBallFrames: Int = 0
    internal var oppPostSwitchLowBallFrames: Int = 0
    internal var lastObservedLowPlayerBalls: Int = 3
    internal var lastObservedLowPlayerBallsTimeMs: Long = 0L
    internal var lastObservedLowOppBalls: Int = 3
    internal var lastObservedLowOppBallsTimeMs: Long = 0L
    internal var playerSwitchConfirmedAlive: Boolean = true
    internal var oppSwitchConfirmedAlive: Boolean = true
    internal var playerSwitchAliveFrames: Int = 0
    internal var oppSwitchAliveFrames: Int = 0
    internal var playerShieldDropFrames: Int = 0
    internal var oppShieldDropFrames: Int = 0
    internal var playerShieldRestoreFrames: Int = 0
    internal var oppShieldRestoreFrames: Int = 0

    // v3.94: Multi-frame debounced Pokéball counts, unified All-HUD-Gone lockout, & per-charge-move shield decrement lock
    internal var isAllCombatHudGone: Boolean = false
    internal var debouncedPlayerBalls: Int = 3
    internal var debouncedOppBalls: Int = 3
    internal var playerBallCandidate: Int = 3
    internal var playerBallConfirmFrames: Int = 0
    internal var oppBallCandidate: Int = 3
    internal var oppBallConfirmFrames: Int = 0
    internal var combatHudStableFrames: Int = 0
    internal var combatHudGoneFrames: Int = 0
    internal var lastPlayerShieldDecrementChargeStartMs: Long = 0L
    internal var lastOppShieldDecrementChargeStartMs: Long = 0L

    // v3.34: 1st-Frame Immediate Swap Detection, Midpoint Swap Clock, 2nd-Frame Validity Bit & Post-Faint Prompt
    internal var lastConfirmedPlayerFrameTimeMs: Long = 0L
    internal var lastConfirmedOppFrameTimeMs: Long = 0L
    internal var playerSwitchValidityLatched: Boolean = true
    internal var oppSwitchValidityLatched: Boolean = true
    internal var provisionalOppPrevName: String = ""
    internal var provisionalOppPrevSpecies: String = ""
    internal var provisionalOppPrevWasAddedToDetected: Boolean = false
    internal var provisionalPlayerPrevName: String = ""
    internal var isPostFaintSwitchPromptActive: Boolean = false
    internal var lastRecommendedAction: String = ""
    internal var lastRecommendedGoal: String = ""
    internal var lastRecommendedPhase: String = "LEAD"
    internal var lastRecommendedSwapSlotIdx: Int = -1
    internal var lastRecommendedCandidateScores: Map<String, Int> = emptyMap()
    internal var recommendationsIssuedInBattle: Int = 0
    internal var recommendationsFollowedInBattle: Int = 0

    // v3.44: Persistent Per-Slot HP Memory (0..100%), 2-Frame Confirmed HP for Shield Calls & Bidirectional Charged Attack State Machine
    internal val playerSlotHpPct = IntArray(3) { 100 }
    internal val oppSlotHpPct = IntArray(3) { 100 }
    internal val confirmedPlayerSlotHpPct = IntArray(3) { 100 }
    internal val confirmedOppSlotHpPct = IntArray(3) { 100 }
    internal val pendingConfirmPlayerSlotHpPct = IntArray(3) { 100 }
    internal val pendingConfirmOppSlotHpPct = IntArray(3) { 100 }
    internal val playerSlotHpConfirmFrames = IntArray(3) { 2 }
    internal val oppSlotHpConfirmFrames = IntArray(3) { 2 }
    internal val playerSlotPreFaintHpPct = IntArray(3) { 100 }
    internal val oppSlotPreFaintHpPct = IntArray(3) { 100 }
    internal val playerSlotPriorHpPct = IntArray(3) { 100 }
    internal val oppSlotPriorHpPct = IntArray(3) { 100 }
    internal val oppSlotLowestHpPct = IntArray(3) { 100 }
    internal val playerSlotLastBigJumpMs = LongArray(3) { 0L }

    // v6.07: 1-Battle Full-Screen Hardware DVR & Frame-Synced Deep Trace Logger + HP/Energy Diagnostic Fields
    internal var dvrThread: HandlerThread? = null
    internal var dvrHandler: Handler? = null
    internal var dvrMediaCodec: MediaCodec? = null
    internal var dvrMediaMuxer: MediaMuxer? = null
    internal var dvrInputSurface: Surface? = null
    internal var dvrVideoTrackIndex: Int = -1
    internal var dvrMuxerStarted: Boolean = false
    internal var dvrMp4File: File? = null
    internal var dvrTraceFile: File? = null
    internal var dvrTraceWriter: java.io.BufferedWriter? = null
    internal var dvrRecordingStartMs: Long = 0L
    internal var dvrFrameCount: Int = 0
    internal var dvrVideoWidth: Int = 544
    internal var dvrVideoHeight: Int = 1184
    internal var sampledPlayerHpRowY: Int = -1
    internal var sampledOppHpRowY: Int = -1
    internal var lastEnergyMutationSource: String = "NONE"
    internal val oppSlotLastBigJumpMs = LongArray(3) { 0L }
    internal var pendingPlayerLowHpSlot: Int = -1
    internal var pendingPlayerLowHpSample: Int = -1
    internal var pendingOppLowHpSlot: Int = -1
    internal var pendingOppLowHpSample: Int = -1
    internal var sampledPlayerHpPct: Int = -1
    internal var sampledOppHpPct: Int = -1
    internal var oppFinalMissingHpFrames: Int = 0
    internal var playerFinalMissingHpFrames: Int = 0
    internal var isAttackIncomingPromptActive: Boolean = false
    internal var attackIncomingDetectedAtMs: Long = 0L
    internal var pendingChargedAttackActor: String = "" // "opp" | "user" | ""
    internal var pendingChargedAttackStartMs: Long = 0L
    internal var pendingChargedAttackPreUserHp: Int = 100
    internal var pendingChargedAttackPreOppHp: Int = 100
    internal var pendingChargedAttackPreUserShields: Int = 2
    internal var pendingChargedAttackPreOppShields: Int = 2
    internal var pendingChargedAttackAttackerName: String = ""
    internal var pendingChargedAttackDefenderName: String = ""
    internal var pendingChargedAttackDeductedEnergy: Int = 0
    internal var pendingChargedAttackOppSlotIdx: Int = -1
    internal var pendingChargedAttackUserSlotIdx: Int = -1
    internal var pendingChargedAttackOppRawName: String = ""
    internal var pendingChargedAttackOppShadow: Boolean = false
    internal var lastOppChargedAttackerSlotIdx: Int = -1
    internal var lastOppChargedAttackerRawName: String = ""
    internal var lastOppChargedAttackerShadow: Boolean = false
    internal val pendingChargedAttackPreUserSlotHp = IntArray(3) { 100 }
    internal val pendingChargedAttackPreOppSlotHp = IntArray(3) { 100 }
    internal var pendingChargedAttackPreOppBalls: Int = 3
    internal var pendingChargedAttackPreUserBalls: Int = 3
    internal var pendingChargedAttackWasOppCatch: Boolean = false
    internal var lastNormalCombatOppSlotIdx: Int = 0
    internal var lastNormalCombatUserSlotIdx: Int = 0
    internal var lastNormalCombatOppRawName: String = ""
    internal var lastNormalCombatOppShadow: Boolean = false
    internal var lastDetectedBannerMoveOppSlotIdx: Int = -1
    internal var lastDetectedBannerMoveUserSlotIdx: Int = -1
    internal var preChargePlayerHpJumpHint: Boolean = false
    internal var preChargeOppHpJumpHint: Boolean = false
    internal var preChargePlayerHpJumpNewHp: Int = -1
    internal var preChargeOppHpJumpNewHp: Int = -1
    internal var preChargePlayerHpJumpMs: Long = 0L
    internal var preChargeOppHpJumpMs: Long = 0L
    internal var lastPostThrowSwapRollbackChargeMs: Long = 0L
    internal val currentBattleSensorTicks = mutableListOf<BattleSensorTick>()
    internal var lastClearedSensorTicksSnapshot: List<BattleSensorTick> = emptyList()
    internal var missingBothHpBarsFrames: Int = 0
    internal var missingTopBallsWithHpBarsFrames: Int = 0
    internal var postUserChargedMissingOppHpFrames: Int = 0
    internal var postOppChargedMissingPlayerHpFrames: Int = 0
    internal var lastSteadyMoveButtonsSeenMs: Long = 0L
    internal var lastChargedAttackLoggedMs: Long = 0L
    internal var lastChargedAttackLoggedActor: String = ""
    internal var lastUserChargedMoveBannerResolvedMs: Long = 0L
    internal var pendingUserChargeConfirmedByOcr: Boolean = false

    // v3.68: Turn-Phased OCR Capture, Charge-Bar 2nd Source of Truth & Monotonic Fast-Move Energy Engine
    internal var sampledOppHasPendingDmg: Boolean = false
    internal var sampledPlayerHasPendingDmg: Boolean = false
    internal var sampledOppPendingDmgPct: Int = 0
    internal var sampledPlayerPendingDmgPct: Int = 0
    internal var turnPhaseAnchorMs: Long = 0L
    internal var lastCaptureStartMs: Long = 0L
    internal val playerSlotEnergy = IntArray(3) { 0 }
    internal val oppSlotEnergy = IntArray(3) { 0 }
    internal val playerSlotTurnsOnField = IntArray(3) { 0 }
    internal val oppSlotTurnsOnField = IntArray(3) { 0 }
    internal val playerSlotCurrentMoveTurns = IntArray(3) { 0 }
    internal val oppSlotCurrentMoveTurns = IntArray(3) { 0 }
    internal val predictedPlayerSlotHpPct = IntArray(3) { 100 }
    internal val predictedOppSlotHpPct = IntArray(3) { 100 }
    internal val lastScannedPlayerSlotHpPct = IntArray(3) { 100 }
    internal val lastScannedOppSlotHpPct = IntArray(3) { 100 }
    internal val playerLastFastCreditedAtMs = LongArray(3) { 0L }
    internal val oppLastFastCreditedAtMs = LongArray(3) { 0L }
    internal val oppCreditedByOptimalTimerAtMs = LongArray(3) { 0L }
    internal var sampledLeftChargeBtnFillPct: Int = -1
    internal var sampledRightChargeBtnFillPct: Int = -1
    internal var sampledCenterChargeBtnFillPct: Int = -1
    internal val lastScannedLeftChargeFillPct = IntArray(3) { 0 }
    internal val lastScannedRightChargeFillPct = IntArray(3) { 0 }
    internal val pendingConfirmLeftChargeFillPct = IntArray(3) { 0 }
    internal val pendingConfirmRightChargeFillPct = IntArray(3) { 0 }
    internal val leftChargeFillConfirmFrames = IntArray(3) { 1 }
    internal val rightChargeFillConfirmFrames = IntArray(3) { 1 }
    internal val leftChargeFillDebounceStartMs = LongArray(3) { 0L }
    internal val rightChargeFillDebounceStartMs = LongArray(3) { 0L }
    internal val playerAutoIncrementAnchorMs = LongArray(3) { 0L }
    internal val playerLastSelfCorrectionAtMs = LongArray(3) { 0L }
    internal var hasBattleStarted: Boolean = false
    internal var phasePlayerTurns: Int = 0
    internal var phaseOppTurns: Int = 0
    internal var battleTurnIndex: Int = 0
    internal var scanTurnOffsetMs: Long = 0L
    internal var lastTurnTickTimeMs: Long = 0L
    internal var turnResidualMs: Long = 0L
    internal var lastFrameWasNormalFastCombat: Boolean = false
    internal var currentScanHzMode: String = "10HZ_HP"
    internal var lastScanDurationMs: Long = 0L
    internal var lastBattleAvgScanMs: Long = 0L
    internal var currentBattleScanDurationSumMs: Long = 0L
    internal var currentBattleScanCount: Int = 0
    internal var lastHpScanDurationMs: Long = 0L
    internal var lastBattleAvgHpScanMs: Long = 0L
    internal var currentBattleHpScanDurationSumMs: Long = 0L
    internal var currentBattleHpScanCount: Int = 0
    internal var lastHpScanTickMs: Long = 0L
    internal var lastOcrStartMs: Long = 0L
    @Volatile internal var isOcrInFlight: Boolean = false
    @Volatile internal var cachedOcrOppLines: List<Text.Line> = emptyList()
    @Volatile internal var cachedOcrPlayerTopLines: List<Text.Line> = emptyList()
    @Volatile internal var cachedOcrPlayerMoveLines: List<Text.Line> = emptyList()
    @Volatile internal var cachedOcrMidBannerLines: List<Text.Line> = emptyList()
    internal var needsPostSwapOrMoveTurnReindex: Boolean = false
    internal var enableHpTracking: Boolean = DEFAULT_ENABLE_HP_TRACKING
    internal var enableEnergyTracking: Boolean = DEFAULT_ENABLE_ENERGY_TRACKING
    internal var chargeCirclePriorityMode: String = DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
    internal var enableAltFastMoveDetect: Boolean = DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT
    // v3.85 / v6.02: Charge Move Meter Only Mode, Idle Back-Credit/Fallback, Banner Move OCR & Non-Standard Fast Move Detector (+1 Turn Default)
    internal var fastDetectTurnOffset: Int = DEFAULT_FAST_DETECT_TURN_OFFSET
    internal var isPlayerInIdleFallback: Boolean = false
    internal var lastIdleFallbackOppCreditMs: Long = 0L
    internal val confirmedOppChargedMoves = Array(3) { linkedSetOf<String>() }
    internal val detectedOppFastMoveOverride = arrayOfNulls<String>(3)
    internal val oppFastMoveStatus = Array(3) { "UNCONFIRMED" } // "UNCONFIRMED" | "CONFIRMED_STD" | "CONFIRMED_NONSTD"
    internal val oppFastMoveConfirmed = BooleanArray(3) { false }
    internal val oppCumulativeFastDmgPct = IntArray(3) { 0 }
    internal val oppFastTurnHpHistory = mutableMapOf<Int, Int>()
    internal var oppFastEvalAnchorPlayerHp: Int = 100
    internal var oppFastEvalAnchorOppTurns: Int = 0
    internal var oppFastEvalAnchorPlayerTurns: Int = 0
    internal var oppFastEvalActiveSlotKey: String = ""
    internal var lastDetectedBannerMoveName: String = ""
    internal var lastDetectedBannerMoveActor: String = "" // "opp" | "user" | ""
    internal var lastDetectedBannerMoveTimeMs: Long = 0L
    internal var lastDetectedBlockedBannerMs: Long = 0L
    internal var lastDetectedDisguiseBustedBannerMs: Long = 0L
    internal val recentStableReadyEnergy = IntArray(3) { 0 }
    internal val recentStableReadyEnergyMs = LongArray(3) { 0L }
    internal val circleBelowCostStableFrames = IntArray(3) { 0 }
    internal val lastSlotKoTimeMs = LongArray(3) { 0L }
    internal val lastUserSlotKoTimeMs = LongArray(3) { 0L }
    internal var preChargeLeftFillPct: Int = 0
    internal var preChargeRightFillPct: Int = 0
    internal var preChargeUserEnergy: Int = 0
    internal var lastStableNormalCombatEnergy: Int = 0
    internal var prevStableNormalCombatEnergy: Int = 0
    internal var lastStableLeftChargeFillPct: Int = 0
    internal var lastStableRightChargeFillPct: Int = 0
    internal var prevStableLeftChargeFillPct: Int = 0
    internal var prevStableRightChargeFillPct: Int = 0
    internal var lastStableNormalCombatMs: Long = 0L
    internal var hadShieldPromptBeforeCurrentCharge: Boolean = false
    internal var lastChargedPromptActor: String = "" // "opp" | "user" | ""
    internal var lastChargedPromptTimeMs: Long = 0L
    internal var awaitingPostUserChargeCircleSync: Boolean = false
    internal var lastUserChargeResolvedMoveName: String = ""
    internal var lastUserChargeWasBannerOcr: Boolean = false
    internal var lastUserChargePreEnergySnapshot: Int = 0
    internal var lastUserChargeDeductedEnergySnapshot: Int = 0
    internal var lastOppChargeDeductedEnergySnapshot: Int = 0
    internal var lastMicroCorrectionTimeMs: Long = 0L
    internal var missingBottomCirclesWithOppHpFrames: Int = 0
    internal val CALIBRATION_REQUIRED_CYCLES: Int = 6
    internal var prescanCircleCalibrated: Boolean = false
    internal var prescanCalibConfirmFrames: Int = 0
    internal var isCountdownDimmedState: Boolean = false
    internal var prescanAccumLeftCxSum: Double = 0.0
    internal var prescanAccumRightCxSum: Double = 0.0
    internal var prescanAccumSingleCxSum: Double = 0.0
    internal var prescanAccumLeftCount: Int = 0
    internal var prescanAccumRightCount: Int = 0
    internal var prescanAccumSingleCount: Int = 0
    internal var prescanAccumCySum: Double = 0.0
    internal var prescanAccumYTopSum: Double = 0.0
    internal var prescanAccumYBotSum: Double = 0.0
    internal var prescanAccumEmptyLumaLeftSum: Double = 0.0
    internal var prescanAccumEmptySatLeftSum: Double = 0.0
    internal var prescanAccumEmptyLumaRightSum: Double = 0.0
    internal var prescanAccumEmptySatRightSum: Double = 0.0
    internal var calibratedLeftCxFrac: Float = 0.3095f
    internal var calibratedRightCxFrac: Float = 0.6900f
    internal var calibratedSingleCxFrac: Float = 0.5000f
    internal var calibratedCyFrac: Float = 0.8930f
    internal var calibratedYTopFrac: Float = 0.8584f
    internal var calibratedYBotFrac: Float = 0.9276f
    internal var calibratedRadiusWFrac: Float = 0.0806f
    internal var prescanEmptyLumaLeft: Double = 52.0
    internal var prescanEmptySatLeft: Double = 22.0
    internal var prescanEmptyLumaRight: Double = 52.0
    internal var prescanEmptySatRight: Double = 22.0
    internal var lastClearedFinalUserHpPct: List<Int> = listOf(100, 100, 100)
    internal var lastClearedFinalOppHpPct: List<Int> = listOf(100, 100, 100)

    // v3.86 / v3.99: Low-Latency Debounced Energy Tracking on Slower Charge Move Circle (±2% Circle Fill Tolerance)
    // + 3-Ring Visual Multi-Fill Detection (0..99% 1st Fill, 100..199% White Border 2nd Fill, 200..300% Second Outer Circle 3rd Fill)
    //   with Zero Assumed / Timer-Based Energy Gains
    internal val candidateSlowestFillPct = IntArray(3) { -1 }
    internal val slowestFillDebounceCount = IntArray(3) { 0 }
    internal val confirmedSlowestFillPct = IntArray(3) { -1 }
    internal val candidateFastestFillPct = IntArray(3) { -1 }
    internal val fastestFillDebounceCount = IntArray(3) { 0 }
    internal val confirmedFastestFillPct = IntArray(3) { -1 }
    internal val lastToastedSlotEnergy = IntArray(3) { -1 }
    internal val leftMeterFilledTwiceLatched = BooleanArray(3) { false }
    internal val rightMeterFilledTwiceLatched = BooleanArray(3) { false }
    internal val slowestMeterInThirdFill = BooleanArray(3) { false }
    internal val fasterMeterInThirdFill = BooleanArray(3) { false }
    internal val peakSecondFillPct = IntArray(3) { 0 }
    internal val peakFastestSecondFillPct = IntArray(3) { 0 }
    internal val firstFillTopCapLuma = DoubleArray(9) { -1.0 }
    internal val secondFillBotCapLuma = DoubleArray(9) { -1.0 }

    // v3.88: Player Energy-to-Turns Conversion, 500ms Multi-Turn Interpolation, Post-Charge Recounting & Ever-On-Field Tracking
    internal val playerSlotEverOnField = BooleanArray(3) { it == 0 }
    internal var phaseStartPlayerEnergy: Int = 0
    internal var confirmedPhasePlayerTurns: Int = 0
    internal var lastConfirmedPlayerFastMoveMs: Long = 0L

    // v4.12: Proactive ~300ms Early Fast-Move Energy & Turn Step (Both Player & Opponent) with >500ms 1-Turn Lag Rollback
    internal var proactiveStepPending: Boolean = false
    internal var proactiveStepSlotIdx: Int = -1
    internal var proactiveStepPreEnergy: Int = 0
    internal var proactiveStepAddedEnergy: Int = 0
    internal var proactiveStepAddedTurns: Int = 0
    internal var proactiveStepExpectedConfirmMs: Long = 0L
    internal var proactiveStepPreOppSlotIdx: Int = -1
    internal var proactiveStepPreOppEnergy: Int = 0
    internal var proactiveStepPreOppTurnsOnField: Int = 0
    internal var proactiveStepPrePhaseOppTurns: Int = 0
    internal var confirmedMoveOppSlotIdx: Int = -1
    internal var confirmedMoveOppEnergy: Int = 0
    internal var confirmedMoveOppTurnsOnField: Int = 0
    internal var confirmedMovePhaseOppTurns: Int = 0
    internal var proactiveRolledBackAnchorMs: Long = 0L

    internal fun clearPendingProactiveStep() {
        proactiveStepPending = false
        proactiveStepSlotIdx = -1
        proactiveStepPreEnergy = 0
        proactiveStepAddedEnergy = 0
        proactiveStepAddedTurns = 0
        proactiveStepExpectedConfirmMs = 0L
        proactiveStepPreOppSlotIdx = -1
        proactiveStepPreOppEnergy = 0
        proactiveStepPreOppTurnsOnField = 0
        proactiveStepPrePhaseOppTurns = 0
    }

    internal fun rollbackPendingProactiveStep(
        markAnchorRolledBack: Boolean = true,
        preserveOppSubTurnEnergy: Boolean = false
    ) {
        if (proactiveStepPending) {
            val sIdx = proactiveStepSlotIdx
            if (sIdx in 0..2) {
                playerSlotEnergy[sIdx] = proactiveStepPreEnergy.coerceIn(0, 100)
                playerSlotTurnsOnField[sIdx] = (playerSlotTurnsOnField[sIdx] - proactiveStepAddedTurns).coerceAtLeast(0)
                lastToastedSlotEnergy[sIdx] = proactiveStepPreEnergy.coerceIn(0, 100)
            }
            if (!preserveOppSubTurnEnergy) {
                val oIdx = if (confirmedMoveOppSlotIdx in 0..2) confirmedMoveOppSlotIdx else proactiveStepPreOppSlotIdx
                if (oIdx in 0..2) {
                    oppSlotEnergy[oIdx] = (if (confirmedMoveOppSlotIdx in 0..2) confirmedMoveOppEnergy else proactiveStepPreOppEnergy).coerceIn(0, 100)
                    oppSlotTurnsOnField[oIdx] = (if (confirmedMoveOppSlotIdx in 0..2) confirmedMoveOppTurnsOnField else proactiveStepPreOppTurnsOnField).coerceAtLeast(0)
                }
                phaseOppTurns = (if (confirmedMoveOppSlotIdx in 0..2) confirmedMovePhaseOppTurns else proactiveStepPrePhaseOppTurns).coerceAtLeast(0)
            }
            clearPendingProactiveStep()
        } else if (phasePlayerTurns > confirmedPhasePlayerTurns && !preserveOppSubTurnEnergy) {
            val oIdx = confirmedMoveOppSlotIdx
            if (oIdx in 0..2) {
                oppSlotEnergy[oIdx] = confirmedMoveOppEnergy.coerceIn(0, 100)
                oppSlotTurnsOnField[oIdx] = confirmedMoveOppTurnsOnField.coerceAtLeast(0)
            }
            phaseOppTurns = confirmedMovePhaseOppTurns.coerceAtLeast(0)
        }
        phasePlayerTurns = confirmedPhasePlayerTurns
        if (markAnchorRolledBack && lastConfirmedPlayerFastMoveMs > 0L) {
            proactiveRolledBackAnchorMs = lastConfirmedPlayerFastMoveMs
        }
    }

    // v4.00/v4.01: Fast-Move Turn Energy Increment Snapping with Post-Throw Discharge Anchor + 100E Ceiling Step Latch
    internal val playerSlotEnergyAnchor = IntArray(3) { 0 }
    internal val nearCeilingStepStartMs = LongArray(3) { 0L }
    internal val playerSlotCeilingLatched100 = BooleanArray(3) { false }
    internal var pendingChargedAttackPreOppEnergy: Int = 0
    internal var lastUserChargedAttackLoggedMs: Long = 0L
    internal var lastUserChargedPreOppHp: Int = 100
    internal var lastUserChargedDefenderOppSlotIdx: Int = -1
    internal var lastUserChargedWasProvisionalShield: Boolean = false
    internal var lastUserChargedAutoDecrementedShield: Boolean = false
    internal var lastOppChargedAttackLoggedMs: Long = 0L
    internal var lastOppChargedPreUserHp: Int = 100
    internal var lastOppChargedDefenderUserSlotIdx: Int = -1
    internal var lastOppChargedWasProvisionalShield: Boolean = false
    internal var lastOppChargedAutoDecrementedShield: Boolean = false
    internal var postChargeCirclesReturnedAtMs: Long = 0L
    internal var activeFrameScreenBitmap: Bitmap? = null
    internal var pendingChargedAttackHudThumbB64: String? = null

    /**
     * v5.13: Captures a compact 320x210 composite HUD strip (Top HP/Balls/Countdown + Mid Move Banner + Bottom Charge Circles)
     * encoded as WebP quality 55 (~6-9 KB Base64) so HIGH severity anomalies have visual proof without bloating logs.
     */
    internal fun captureCompactHudStripWebpBase64(screen: Bitmap? = activeFrameScreenBitmap): String? {
        val src = screen ?: return null
        if (src.isRecycled || src.width < 100 || src.height < 200) return null
        return try {
            val w = src.width
            val h = src.height
            val outW = 320
            val outH = 210
            val composite = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(composite)
            val paint = Paint(Paint.FILTER_BITMAP_FLAG)
            // Band 1: Top HUD (HP bars, shields, Pokéballs, 5s/10s top countdown circle): 0.03h..0.17h -> 0..66px
            canvas.drawBitmap(
                src,
                android.graphics.Rect(0, (h * 0.03f).toInt(), w, (h * 0.17f).toInt()),
                android.graphics.Rect(0, 0, outW, 66),
                paint
            )
            // Band 2: Mid Move Banner / Shield Prompt text: 0.36h..0.52h -> 66..134px
            canvas.drawBitmap(
                src,
                android.graphics.Rect(0, (h * 0.36f).toInt(), w, (h * 0.52f).toInt()),
                android.graphics.Rect(0, 66, outW, 134),
                paint
            )
            // Band 3: Bottom Charged Move Circles & Switch Prompt: 0.74h..0.95h -> 134..210px
            canvas.drawBitmap(
                src,
                android.graphics.Rect(0, (h * 0.74f).toInt(), w, (h * 0.95f).toInt()),
                android.graphics.Rect(0, 134, outW, outH),
                paint
            )
            val baos = java.io.ByteArrayOutputStream()
            @Suppress("DEPRECATION")
            composite.compress(Bitmap.CompressFormat.WEBP, 55, baos)
            composite.recycle()
            android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    internal var shieldHexagonSeenDuringPrompt: Boolean = false
    internal var sampledShieldHexagonVisible: Boolean = false
    internal var shieldHexagonConfirmFrames: Int = 0
    internal var sampledTopCountdownCircleVisible: Boolean = false
    internal var topCountdownCircleConfirmFrames: Int = 0
    internal var topCountdownCircleMissingFrames: Int = 0
    internal var isTopCountdownCircleActive: Boolean = false
    internal var shieldOverlayShowConfirmFrames: Int = 0
    internal var lastShieldOverlayConfirmFrameMs: Long = 0L
    internal var sampledTopRightNameplateVisible: Boolean = false
    internal var lastAttackIncomingOcrDetectedMs: Long = 0L
    internal var lastOppChargeHpInferredMoveName: String = ""

    internal var pllValidatedThisShieldDelay = false
    internal var observedPlayerChargeBarStep = false

    /**
     * v4.00/v4.01: Snaps raw pixel-measured player energy to the nearest valid fast-move turn increment
     * (`anchorE + k * fastMoveEnergy <= 100`) relative to the slot's post-throw discharge anchor
     * (`playerSlotEnergyAnchor[slotIdx]`, initialized to `0E`).
     * When the next uncapped fast-move step (`step + fastMoveEnergy`) would exceed `100E`, snaps to the
     * near-ceiling step (e.g. `99E` on `9E Ember`) first and only includes `100E` once the 1-fast-move-duration
     * ceiling latch (`playerSlotCeilingLatched100[slotIdx]`) has fired or `clampedRaw >= 100`.
     */
    internal fun snapPlayerEnergyToValidStep(
        slotIdx: Int,
        rawEnergy: Int,
        fastMoveEnergy: Int,
        minBound: Int = 0,
        maxBound: Int = 100
    ): Int {
        val lo = minBound.coerceIn(0, 100)
        val hi = maxBound.coerceIn(lo, 100)
        val clampedRaw = rawEnergy.coerceIn(lo, hi)
        if (clampedRaw <= 0) return 0
        if (slotIdx in 0..2 && playerSlotCeilingLatched100[slotIdx] && 100 in lo..hi && clampedRaw >= 95) {
            return 100
        }
        val fastE = fastMoveEnergy.coerceIn(2, 25)
        val rawAnchor = playerSlotEnergyAnchor.getOrElse(slotIdx) { 0 }.coerceIn(0, 100)
        val anchorToUse = if (rawAnchor <= clampedRaw + 2) rawAnchor else 0

        val candidates = mutableSetOf<Int>()
        for (k in 0..50) {
            val uncappedStep = anchorToUse + k * fastE
            if (uncappedStep > 100) break
            if (uncappedStep in lo..hi) {
                candidates.add(uncappedStep)
            }
        }
        if (rawAnchor > 0 && candidates.isEmpty()) {
            // Also include pure 0-based fast-move multiples if anchor was above lo..hi
            for (k in 0..50) {
                val uncappedStep = k * fastE
                if (uncappedStep > 100) break
                if (uncappedStep in lo..hi) {
                    candidates.add(uncappedStep)
                }
            }
        }
        if ((slotIdx in 0..2 && playerSlotCeilingLatched100[slotIdx]) || clampedRaw >= 100) {
            if (100 in lo..hi) {
                candidates.add(100)
            }
        }
        if (candidates.isEmpty()) return clampedRaw.coerceIn(lo, hi)

        // Pick candidate with smallest distance to clampedRaw (ties broken toward clampedRaw or higher)
        val bestStep = candidates.minWithOrNull(
            compareBy<Int> { kotlin.math.abs(it - clampedRaw) }.thenByDescending { it }
        ) ?: return clampedRaw

        val maxAllowedSnapDist = max(3, fastE - 1)
        return if (kotlin.math.abs(bestStep - clampedRaw) <= maxAllowedSnapDist) {
            bestStep.coerceIn(lo, hi)
        } else {
            clampedRaw
        }
    }

    internal fun getMoveScannerContrastRank(moveName: String, fallbackSpeciesType: String = "normal"): Int {
        if (moveName.isBlank()) return 17
        val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, fallbackSpeciesType)
        val moveTypeLower = mStats.type.trim().lowercase()
        return MOVE_TYPE_SCANNER_CONTRAST_RANK[moveTypeLower] ?: 17
    }

    /**
     * v4.08: Selects whether the Right Charged Move Circle (Move 2) should be tracked as the primary energy meter
     * over the Left Charged Move Circle (Move 1) based on `chargeCirclePriorityMode`:
     * - `"highest_energy"`: Picks the move with higher energy cost (ties broken by better scanner contrast rank).
     * - `"highest_contrast"`: Picks the move with better 1-18 scanner contrast rank (ties broken by higher energy cost).
     * - `"smart_hybrid"` (Default): Tracks the higher-energy move when both moves are in Tier S or Tier A (Ranks 1-10),
     *   and automatically promotes the higher-contrast move whenever the higher-energy move falls in Tier B or Tier C
     *   (Ranks 11-18, e.g. Xerneas's Moonblast Fairy #3 50E over Giga Impact Normal #17 80E).
     */
    internal fun shouldSelectRightCircleAsPrimary(
        move1Name: String,
        move1Cost: Int,
        move2Name: String,
        move2Cost: Int,
        hasSecondMove: Boolean,
        fallbackSpeciesType: String = "normal"
    ): Boolean {
        if (!hasSecondMove || move2Cost <= 0 || move2Name.isBlank()) return false
        val rank1 = getMoveScannerContrastRank(move1Name, fallbackSpeciesType)
        val rank2 = getMoveScannerContrastRank(move2Name, fallbackSpeciesType)
        return when (chargeCirclePriorityMode) {
            "highest_contrast" -> {
                if (rank1 != rank2) {
                    rank2 < rank1
                } else {
                    move2Cost > move1Cost
                }
            }
            "highest_energy" -> {
                if (move1Cost != move2Cost) {
                    move2Cost > move1Cost
                } else {
                    rank2 < rank1
                }
            }
            else -> { // "smart_hybrid" (Default)
                val slowerIsRight = if (move1Cost != move2Cost) {
                    move2Cost > move1Cost
                } else {
                    rank2 < rank1
                }
                val slowerRank = if (slowerIsRight) rank2 else rank1
                val fasterRank = if (slowerIsRight) rank1 else rank2
                // If the higher-energy move is in Tier B or Tier C (rank >= 11) and the other move has strictly better contrast,
                // promote the higher-contrast circle to primary!
                if (slowerRank >= 11 && fasterRank < slowerRank) {
                    !slowerIsRight
                } else {
                    slowerIsRight
                }
            }
        }
    }

    internal fun resolvePlayerSlotMoveCosts(slotIdx: Int): Pair<Int, Int> {
        val slotCfg = currentPreset?.pokemon?.getOrNull(slotIdx)
        val monName = slotCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
        val isShad = monName.contains("Shadow", ignoreCase = true)
        val meta = getPokemonMeta(monName, currentPreset?.league ?: "GREAT LEAGUE", isShad)
        val primaryType = meta.types.firstOrNull() ?: "normal"
        val m1Name = slotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: meta.chargedMove1
        val m2Name = slotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: meta.chargedMove2
        val hasSecond = m2Name.isNotBlank() && !m2Name.equals(m1Name, ignoreCase = true)
        val c1 = (OverlayService.resolveChargedMoveStatsStatic(m1Name, primaryType).energyCost.takeIf { it > 0 }
            ?: MOVE_ENERGY_COST[m1Name] ?: 50).coerceIn(35, 100)
        val c2 = if (hasSecond) {
            (OverlayService.resolveChargedMoveStatsStatic(m2Name, primaryType).energyCost.takeIf { it > 0 }
                ?: MOVE_ENERGY_COST[m2Name] ?: 50).coerceIn(35, 100)
        } else c1
        return c1 to c2
    }

    internal fun resetSlotEnergyTracking(
        slotIdx: Int,
        initialEnergy: Int = 0,
        cost1: Int = -1,
        cost2: Int = -1,
        clearThirdFillLatches: Boolean = false
    ) {
        if (slotIdx !in 0..2) return
        val clampedE = initialEnergy.coerceIn(0, 100)
        val (resolvedC1, resolvedC2) = if (cost1 > 0 && cost2 > 0) {
            cost1.coerceIn(35, 100) to cost2.coerceIn(35, 100)
        } else {
            resolvePlayerSlotMoveCosts(slotIdx)
        }
        val slowCost = max(resolvedC1, resolvedC2).coerceIn(35, 100)
        val fastCost = min(resolvedC1, resolvedC2).coerceIn(35, 100)

        candidateSlowestFillPct[slotIdx] = -1
        slowestFillDebounceCount[slotIdx] = 0
        confirmedSlowestFillPct[slotIdx] = -1
        candidateFastestFillPct[slotIdx] = -1
        fastestFillDebounceCount[slotIdx] = 0
        confirmedFastestFillPct[slotIdx] = -1
        lastToastedSlotEnergy[slotIdx] = clampedE
        if (proactiveStepPending && (proactiveStepSlotIdx == slotIdx || clearThirdFillLatches || clampedE == 0)) {
            clearPendingProactiveStep()
            proactiveRolledBackAnchorMs = 0L
        }
        if (clampedE < 100) {
            nearCeilingStepStartMs[slotIdx] = 0L
            playerSlotCeilingLatched100[slotIdx] = false
        }

        if (clampedE == 0) {
            firstFillTopCapLuma[slotIdx * 2] = -1.0
            firstFillTopCapLuma[slotIdx * 2 + 1] = -1.0
            secondFillBotCapLuma[slotIdx * 2] = -1.0
            secondFillBotCapLuma[slotIdx * 2 + 1] = -1.0
        }

        if (clearThirdFillLatches || clampedE == 0) {
            leftMeterFilledTwiceLatched[slotIdx] = false
            rightMeterFilledTwiceLatched[slotIdx] = false
            slowestMeterInThirdFill[slotIdx] = false
            fasterMeterInThirdFill[slotIdx] = false
            peakSecondFillPct[slotIdx] = 0
            peakFastestSecondFillPct[slotIdx] = 0
        } else {
            leftMeterFilledTwiceLatched[slotIdx] = clampedE >= 2 * resolvedC1
            rightMeterFilledTwiceLatched[slotIdx] = clampedE >= 2 * resolvedC2
            slowestMeterInThirdFill[slotIdx] = clampedE >= 2 * slowCost
            fasterMeterInThirdFill[slotIdx] = clampedE >= 2 * fastCost
            peakSecondFillPct[slotIdx] = when {
                clampedE >= 2 * slowCost -> 200 + (((clampedE - 2 * slowCost) * 100.0) / slowCost.toDouble()).roundToInt().coerceIn(0, 100)
                clampedE >= slowCost -> 100 + (((clampedE - slowCost) * 100.0) / slowCost.toDouble()).roundToInt().coerceIn(1, 99)
                else -> 0
            }
            peakFastestSecondFillPct[slotIdx] = when {
                clampedE >= 2 * fastCost -> 200 + (((clampedE - 2 * fastCost) * 100.0) / fastCost.toDouble()).roundToInt().coerceIn(0, 100)
                clampedE >= fastCost -> 100 + (((clampedE - fastCost) * 100.0) / fastCost.toDouble()).roundToInt().coerceIn(1, 99)
                else -> 0
            }
        }
    }

    internal fun computeSingleCircleSnappedEnergy(
        slotIdx: Int,
        fillPct: Int,
        moveCost: Int,
        fastMoveEnergy: Int
    ): Int {
        if (fillPct !in 0..300) return -1
        val c = moveCost.coerceIn(35, 100)
        val fastE = fastMoveEnergy.coerceIn(2, 25)
        return when (fillPct) {
            in 0..99 -> {
                val r1Raw = (((fillPct * c) / 100.0).roundToInt()).coerceIn(0, c - 1)
                snapPlayerEnergyToValidStep(slotIdx, r1Raw, fastE, 0, c - 1)
            }
            in 100..199 -> {
                val r2Max = min(100, 2 * c)
                val r2Raw = (c + (((fillPct - 100) * c) / 100.0).roundToInt()).coerceIn(c, r2Max)
                snapPlayerEnergyToValidStep(slotIdx, r2Raw, fastE, c, r2Max)
            }
            else -> {
                val r3Floor = min(100, 2 * c)
                val r3Raw = (2 * c + (((fillPct - 200) * c) / 100.0).roundToInt()).coerceIn(r3Floor, 100)
                snapPlayerEnergyToValidStep(slotIdx, r3Raw, fastE, r3Floor, 100)
            }
        }
    }

    internal fun emitEnergyUpdateToastIfEnabled(
        slotIdx: Int,
        moveName: String,
        moveCost: Int,
        circleFillPct: Int,
        newEnergy: Int,
        primaryAtkIndex: Int = 1,
        leftFillPct: Int = circleFillPct,
        leftEnergy: Int = -1,
        rightFillPct: Int = -1,
        rightEnergy: Int = -1,
        hasSecondMove: Boolean = false
    ) {
        if (slotIdx !in 0..2) return
        val clampedE = newEnergy.coerceIn(0, 100)
        if (lastToastedSlotEnergy[slotIdx] == clampedE) return
        lastToastedSlotEnergy[slotIdx] = clampedE
        if (!activeEnergyUpdateToasts) return
        val atkNum = primaryAtkIndex.coerceIn(1, 2)
        val a1PctLabel = if (leftFillPct in 0..300) "${leftFillPct}%" else "--%"
        val a1ELabel = if (leftEnergy in 0..100) "${leftEnergy}E" else "--E"
        if (hasSecondMove) {
            val a2PctLabel = if (rightFillPct in 0..300) "${rightFillPct}%" else "--%"
            val a2ELabel = if (rightEnergy in 0..100) "${rightEnergy}E" else "--E"
            showBattleToast("⚡ [Atk $atkNum: $moveName ${moveCost}E] A1:$a1PctLabel($a1ELabel) | A2:$a2PctLabel($a2ELabel) → ${clampedE}E")
        } else {
            showBattleToast("⚡ [Atk 1: $moveName ${moveCost}E] A1:$a1PctLabel($a1ELabel) → ${clampedE}E")
        }
    }

    // Phase 2: Battle Clock Synchronization (t0) & Live Timeline Event Logger
    internal var battleClockAnchorMs: Long = 0L
    internal val battleTimelineEvents = mutableListOf<BattleTimelineEvent>()
    internal var lastClearedTimelineEventsSnapshot: List<BattleTimelineEvent> = emptyList()
    internal var lastClearedBattleDurationSec: Double? = null
    internal var lastClearedUserFaints: Int = 0
    internal var lastClearedOppFaints: Int = 0
    internal var lastClearedUserShieldsRemaining: Int = 2
    internal var lastClearedOppShieldsRemaining: Int = 2

    // v6.03: Scanned CP per team slot + Auto End-of-Battle & Telemetry Ignore state
    internal val playerSlotCp = IntArray(3) { 0 }
    internal val oppSlotCp = IntArray(3) { 0 }
    internal var autoEndCandidateResult: String = ""
    internal var autoEndCandidateFrames: Int = 0
    internal var lastLoggedBattleId: String = ""
    internal var lastLoggedBattleResult: String = "WIN"
    internal var lastLoggedBattleLead: String = "NEUTRAL"
    internal var lastLoggedBattleOpponents: List<String> = emptyList()
    internal var lastLoggedBattleTelemetryIgnored: Boolean = false
    internal var lastLoggedBattleWasAuto: Boolean = false
    internal var lastLoggedBattleTimeMs: Long = 0L

    internal fun extractCpFromOcrLines(lines: List<Text.Line>): Int? {
        for (line in lines) {
            val raw = line.text.trim()
            if (isOverlayHudSelfText(raw.lowercase())) continue
            val m1 = Regex("(?i)\\bcp\\s*(\\d{2,4})\\b").find(raw)
            if (m1 != null) {
                val v = m1.groupValues.getOrNull(1)?.toIntOrNull()
                if (v != null && v in 10..6000) return v
            }
            val m2 = Regex("(?i)\\bcp(\\d{2,4})\\b").find(raw.replace(" ", ""))
            if (m2 != null) {
                val v = m2.groupValues.getOrNull(1)?.toIntOrNull()
                if (v != null && v in 10..6000) return v
            }
        }
        return null
    }

    internal fun getElapsedBattleSeconds(eventTimeMs: Long = System.currentTimeMillis()): Double {
        if (battleClockAnchorMs <= 0L) return 0.0
        val diffMs = (eventTimeMs - battleClockAnchorMs).coerceAtLeast(0L)
        return ((diffMs / 1000.0) * 100.0).roundToInt() / 100.0
    }

    internal fun formatOpponentNameWithShadow(rawName: String): String {
        val trimmed = rawName.trim()
        if (trimmed.isEmpty() || trimmed.equals("Waiting...", ignoreCase = true)) return trimmed
        val baseKey = FormResolver.extractBaseSpecies(trimmed).lowercase()
        val isShad = manualShadowOverrides[baseKey] ?: trimmed.contains("Shadow", ignoreCase = true)
        return if (isShad && !trimmed.startsWith("Shadow ", ignoreCase = true)) {
            "Shadow $trimmed"
        } else {
            trimmed
        }
    }

    data class BattleTimelineEvent(
        val type: String = "SWAP", // "SWAP" | "SHIELD" | "FAINT" | "POST_FAINT_PROMPT" | "DECISION_SNAPSHOT" | "CHARGED_ATTACK"
        val actor: String = "user", // "user" | "opp"
        val t: Double = 0.0, // Relative elapsed seconds (Date.now() - t0) / 1000
        val pokemonIn: String? = null,
        val pokemonOut: String? = null,
        val pokemonFainted: String? = null,
        val shieldNumber: Int? = null, // 1 or 2
        val activePokemon: String? = null,
        val pokemonShielded: String? = null,
        val userShieldsRemaining: Int = 2,
        val oppShieldsRemaining: Int = 2,
        val recommendedAction: String? = null,
        val recommendedGoal: String? = null,
        val decisionPhase: String? = null,
        val recommendedTargetPokemon: String? = null,
        val playerSwapRemainingSec: Int? = null,
        val oppSwapRemainingSec: Int? = null,
        val userAliveCount: Int? = null,
        val oppAliveCount: Int? = null,
        val lastPlayerSwitchWasFaint: Boolean? = null,
        val lastOppSwitchWasFaint: Boolean? = null,
        val activeMatchupBr: Int? = null,
        val candidateScores: Map<String, Int>? = null,
        val followedRecommendation: Boolean? = null,
        val validityLatched: Boolean? = null,
        // v3.40: Charged Attack & Persistent Slot HP Telemetry
        val shielded: Boolean? = null,
        val hpBeforePct: Int? = null,
        val hpAfterPct: Int? = null,
        val hpDeltaPct: Int? = null,
        val inferredMoveName: String? = null,
        val userSlotHpPct: List<Int>? = null,
        val oppSlotHpPct: List<Int>? = null,
        // v3.50: Turn-Offset & Energy Telemetry
        val userEnergy: Int? = null,
        val oppEnergy: Int? = null,
        val turnIndex: Int? = null,
        val scanTurnOffsetMs: Long? = null,
        // v5.10: AI Training & Anomaly Detection Telemetry
        val preThrowEnergy: Int? = null,
        val requiredMoveEnergy: Int? = null,
        val energyDeficit: Int? = null,
        val expectedMoveDmgPct: Int? = null,
        val leftCircleFillBeforePct: Int? = null,
        val rightCircleFillBeforePct: Int? = null,
        val leftCircleFillAfterPct: Int? = null,
        val rightCircleFillAfterPct: Int? = null,
        val moveResolutionSource: String? = null,
        val hudThumbnailWebpBase64: String? = null
    )

    data class AiTrainingLogRecord(
        val battleId: String = "",
        val timestampMs: Long = System.currentTimeMillis(),
        val league: String = "GREAT LEAGUE",
        val userTeamName: String = "",
        val userPokemon: List<String> = emptyList(),
        val opponents: List<String> = emptyList(),
        val leadMatchup: String = "NEUTRAL",
        val result: String = "WIN",
        val battleDurationSec: Double? = null,
        val adherenceRatePct: Int? = null,
        val recommendationsIssuedCount: Int? = null,
        val recommendationsFollowedCount: Int? = null,
        val scanHzMode: String = "2HZ",
        val turnOffsetMs: Long = 0L,
        val timelineEvents: List<BattleTimelineEvent> = emptyList()
    )

    data class ExecutionIntervalSegment(
        val tStart: Double = 0.0,
        val tEnd: Double = 0.0,
        val duration: Double = 0.0,
        val tau: Double = 0.0,
        val userActive: String = "",
        val oppActive: String = "",
        val userShields: Int = 2,
        val oppShields: Int = 2,
        val rating: Double = 500.0
    )

    data class DynamicExecutionWAEResult(
        val execWae: Double = 0.0,
        val weightedResidual: Double = 0.0,
        val pExec: Double = 0.5,
        val pPre: Double = 0.5,
        val sActual: Double? = null,
        val deltaQBase: Double = 0.0,
        val deltaQFinal: Double = 0.0,
        val weight: Double = 1.0,
        val faintMarginScaled: Boolean = false,
        val shieldPenaltyApplied: Double = 0.0,
        val userFaints: Int = 0,
        val oppFaints: Int = 0,
        val userShieldsRemaining: Int = 2,
        val oppShieldsRemaining: Int = 2,
        val intervals: List<ExecutionIntervalSegment> = emptyList()
    )

    data class BlindMatchupFavorabilityResult(
        val bmf: Double? = null,
        val pPre: Double? = null,
        val bmfPercentage: Double? = null,
        val weight: Double = 0.0,
        val sLead: Double? = null,
        val sBack: Double? = null,
        val compositeM: Double? = null,
        val isUnrevealedThird: Boolean = false
    )

    data class BattleQualityMetadata(
        val bmfScore: Double = 0.5,
        val pPre: Double = 0.5,
        val bmfPercentage: Double = 50.0,
        val sActual: Double? = null,
        val pExec: Double = 0.5,
        val execWae: Double = 0.0,
        val pWin: Double = 0.5,
        val expWinPct: Int = 50,
        val deltaQ: Double = 0.0,
        val weight: Double = 1.0,
        val weightedResidual: Double = 0.0,
        val badgeLabel: String = "Skill Win",
        val badgeColorHex: String = "#4ade80",
        val badges: List<String> = emptyList(),
        val contextualFlags: List<String> = emptyList(),
        val flags: List<String> = emptyList(),
        val unrevealedThird: Boolean = false,
        val sLead: Double = 500.0,
        val sBack: Double = 500.0,
        val compositeScore: Double = 500.0,
        val faintMarginScaled: Boolean = false,
        val shieldPenaltyApplied: Double = 0.0,
        val userFaints: Int = 0,
        val oppFaints: Int = 0,
        val userShieldsRemaining: Int = 2,
        val oppShieldsRemaining: Int = 2
    )

    data class AggregateWAEResult(
        val waePct: Double,
        val formatted: String,
        val isPositive: Boolean,
        val luckPct: Double = 50.0,
        val luckFormatted: String = "—%",
        val rankedCount: Int,
        val totalWeight: Double
    )

    data class TeamMember(
        val name: String,
        val cp: Int,
        val fastMove: String,
        val chargedMove1: String,
        val chargedMove2: String,
        val ivs: String? = null
    )
    data class TeamPreset(
        val id: String,
        val name: String,
        val league: String,
        val pokemon: List<TeamMember>,
        var isSelected: Boolean = false,
        val updatedAt: Long = System.currentTimeMillis(),
        val archetype: String = "ABC",
        val isArchetypeManual: Boolean = false,
        val leadAggBr: Int = 500,
        val machineAggBr: Int = 600,
        val safeSwapBr: Int = 500,
        val closerSwapBr: Int = 500,
        val closerBr: Int = 500,
        val sharedWeaknesses: List<String> = emptyList(),
        val combatMode: String = "gbl"
    )

    override fun onCreate() {
        super.onCreate()
        isInstanceRunning = true
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        runV602ScannerDefaultsMigrationStatic(prefs)
        oppCountMode = prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts"
        enable4ChargedMoves = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
        disableBattleToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
        showTacticalRecommendations = prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, true)
        showShieldDecisionOverlay = prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true)
        aiAdviceHudPosition = (prefs.getString(PREFS_KEY_AI_ADVICE_HUD_POSITION, DEFAULT_AI_ADVICE_HUD_POSITION) ?: DEFAULT_AI_ADVICE_HUD_POSITION)
            .lowercase().let { if (it == "top") "top" else "bottom" }
        enableHpTracking = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, DEFAULT_ENABLE_HP_TRACKING)
        enableEnergyTracking = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, DEFAULT_ENABLE_ENERGY_TRACKING)
        fastDetectTurnOffset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
        chargeCirclePriorityMode = prefs.getString(PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE)
            ?: DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
        enableAltFastMoveDetect = prefs.getBoolean(PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
        overlayScalePct = prefs.getInt("overlay_scale_pct", 78).coerceIn(50, 100)
        overlayTransparencyPct = prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72).coerceIn(0, 100)
        val rawSavedThemeId = prefs.getString(PREFS_KEY_APP_THEME_ID, "dialga_shiny_midnight") ?: "dialga_shiny_midnight"
        appThemeId = if (rawSavedThemeId == "amoled_cyan" || rawSavedThemeId == "amoled_matrix") "dialga_shiny_midnight" else rawSavedThemeId
        syncTierThresholdsFromPrefs(prefs)

        val metrics = resources.displayMetrics
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        imageReaderThread = HandlerThread("GBLImageReaderThread").apply { start() }
        imageReaderHandler = Handler(imageReaderThread!!.looper)
        dvrThread = HandlerThread("GBLBattleDvrThread", Process.THREAD_PRIORITY_BACKGROUND).apply { start() }
        dvrHandler = Handler(dvrThread!!.looper)

        createNotificationChannel()
        setupDefaultPresetsIfNeeded()
        loadOrFetchGamemasterInBackground()
        setupOverlayView()
        startBattleOcrLoop()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val (ok, _) = OverlayService.syncWithGitHubGistBlocking(prefs, gson)
                if (ok) {
                    withContext(Dispatchers.Main) {
                        setupDefaultPresetsIfNeeded()
                        loadInitialDataIntoOverlay()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    internal fun showBattleToast(message: String, duration: Int = Toast.LENGTH_SHORT) {
        if (disableBattleToasts) return
        showStatusBarToast(message, duration)
    }

    internal fun showStatusBarToast(message: String, duration: Int = Toast.LENGTH_SHORT) {
        mainToastHandler.post {
            try {
                val density = resources.displayMetrics.density
                val themeAccentHex = when (appThemeId) {
                    "dialga_shiny_midnight" -> "#2DD4BF"
                    "instinct_dark" -> "#EAB308"
                    "instinct_light" -> "#CA8A04"
                    "mystic_dark" -> "#38BDF8"
                    "mystic_light" -> "#0284C7"
                    "valor_dark" -> "#F87171"
                    "valor_light" -> "#DC2626"
                    "sylveon_pink", "sylveon_light" -> "#EC4899"
                    else -> "#38BDF8"
                }
                val borderColor = when {
                    message.contains("💀") -> Color.parseColor("#F43F5E")
                    message.contains("🛡️") -> Color.parseColor("#FBBF24")
                    message.contains("✓") -> Color.parseColor("#4ADE80")
                    else -> Color.parseColor(themeAccentHex)
                }

                if (statusToastView == null) {
                    val tv = TextView(this).apply {
                        setTextColor(Color.parseColor("#F8FAFC"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f)
                        typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                        isSingleLine = true
                        ellipsize = TextUtils.TruncateAt.END
                        maxWidth = (screenWidth * 0.92f).toInt()
                        setPadding(
                            (10 * density).toInt(),
                            (2.5f * density).toInt(),
                            (10 * density).toInt(),
                            (2.5f * density).toInt()
                        )
                        gravity = Gravity.CENTER_VERTICAL
                    }
                    val params = WindowManager.LayoutParams().apply {
                        type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        } else {
                            @Suppress("DEPRECATION")
                            WindowManager.LayoutParams.TYPE_PHONE
                        }
                        flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
                        format = PixelFormat.TRANSLUCENT
                        gravity = Gravity.TOP or Gravity.START
                        x = (6 * density).toInt()
                        y = (2 * density).toInt()
                        width = WindowManager.LayoutParams.WRAP_CONTENT
                        height = WindowManager.LayoutParams.WRAP_CONTENT
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                        }
                    }
                    windowManager.addView(tv, params)
                    statusToastView = tv
                    statusToastParams = params
                }

                statusToastView?.apply {
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = 999f
                        setColor(Color.parseColor("#EB0F172A"))
                        setStroke(max(1, (1.2f * density).toInt()), borderColor)
                    }
                    text = message
                    visibility = View.VISIBLE
                }

                mainToastHandler.removeCallbacks(hideStatusToastRunnable)
                val delayMs = if (duration == Toast.LENGTH_LONG) 2800L else 1900L
                mainToastHandler.postDelayed(hideStatusToastRunnable, delayMs)
            } catch (_: Exception) {
                val toast = Toast.makeText(this, message, duration)
                toast.setGravity(Gravity.TOP or Gravity.START, 16, 4)
                toast.show()
            }
        }
    }

    internal data class ShieldOverlayMoveRow(
        val moveName: String,
        val energyCost: Int,
        val dmgPct: Int,
        val remHpPct: Int,
        val isKo: Boolean,
        val isFunded: Boolean,
        val canReachNextMoveIfTanked: Boolean = true,
        val fastsToNextMoveIfTanked: Int = 0,
        val fastsShortIfTanked: Int = 0,
        val userTargetMoveShort: String = ""
    )

    internal fun hideShieldDecisionOverlay() {
        isShieldDecisionOverlayVisible = false
        shieldDecisionOverlayShownAtMs = 0L
        shieldHexagonSeenDuringPrompt = false
        mainToastHandler.removeCallbacks(hideShieldDecisionOverlayRunnable)
        if (Looper.myLooper() == Looper.getMainLooper()) {
            try {
                shieldDecisionOverlayView?.visibility = View.GONE
            } catch (_: Exception) {}
        } else {
            mainToastHandler.post {
                try {
                    shieldDecisionOverlayView?.visibility = View.GONE
                } catch (_: Exception) {}
            }
        }
    }

    /**
     * v4.04: Shadow-Safe 100ms (10 Hz) pixel detector for Pokémon GO's "Attack incoming! Use a Protect Shield?" prompt.
     * Evaluates ONLY when the combat HUD (top Pokéballs and bottom charge circles) is hidden, and verifies:
     * 1. Symmetric bright violet/magenta Protect Shield hexagon in the center (`x = 0.435w..0.565w`, `y = 0.79f..0.88f`).
     * 2. Shadow-safe outer wing check (`x = 0.20w..0.34w` & `x = 0.66w..0.80w`): ignores dark/low-green Shadow aura smoke
     *    (`g < 118` or `luma < 162`, e.g., Shadow Pidgeot) and requires the centered Protect Shield hexagon density to be at least
     *    2.2x higher than any bright pink sprite density in the wings (rejecting wide pink sprites like Tinkaton).
     * 3. Crisp white "NOT NOW" pill/text signature directly below the shield hexagon (`x = 0.40w..0.60w`, `y = 0.902h..0.958h`).
     */
    internal fun detectAttackIncomingShieldHexagonPixels(screen: Bitmap, w: Int, h: Int): Boolean {
        if (screen.isRecycled || w < 100 || h < 100) return false
        val xStart = (w * 0.435f).toInt().coerceIn(0, w - 1)
        val xMid = (w * 0.50f).toInt().coerceIn(xStart + 1, w - 1)
        val xEnd = (w * 0.565f).toInt().coerceIn(xMid + 1, w - 1)
        val yStart = (h * 0.79f).toInt().coerceIn(0, h - 1)
        val yEnd = (h * 0.88f).toInt().coerceIn(yStart + 1, h - 1)
        val stepX = max(2, (xEnd - xStart) / 14)
        val stepY = max(2, (yEnd - yStart) / 14)

        var leftPurpleHits = 0
        var rightPurpleHits = 0
        var centerSamples = 0
        var y = yStart
        while (y <= yEnd) {
            var x = xStart
            while (x <= xEnd) {
                centerSamples++
                val px = screen.getPixel(x, y)
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                if (r >= 170 && b >= 190 && g in 100..228 && (b - g) >= 24 && (r - g) >= 16 && kotlin.math.abs(r - b) <= 48) {
                    if (x < xMid) leftPurpleHits++ else rightPurpleHits++
                }
                x += stepX
            }
            y += stepY
        }

        val totalCenterPurple = leftPurpleHits + rightPurpleHits
        if (centerSamples <= 0 || leftPurpleHits < 3 || rightPurpleHits < 3 || totalCenterPurple < max(8, centerSamples / 8)) {
            return false
        }
        // Require left-right symmetry on the centered Protect Shield icon
        if (min(leftPurpleHits, rightPurpleHits) * 5 < max(leftPurpleHits, rightPurpleHits) * 2) {
            return false
        }

        // Shadow-safe outer wing check: only count bright, high-luma pink/magenta sprite pixels (g >= 118, luma >= 162)
        // so dark/mid-violet Shadow aura flames (e.g. Shadow Pidgeot) never reject a genuine Protect Shield hexagon!
        val leftWingStart = (w * 0.20f).toInt().coerceIn(0, w - 1)
        val leftWingEnd = (w * 0.34f).toInt().coerceIn(leftWingStart + 1, w - 1)
        val rightWingStart = (w * 0.66f).toInt().coerceIn(0, w - 1)
        val rightWingEnd = (w * 0.80f).toInt().coerceIn(rightWingStart + 1, w - 1)
        val wingStepX = max(3, (leftWingEnd - leftWingStart) / 7)
        val wingStepY = max(3, (yEnd - yStart) / 7)
        var wingBrightPinkHits = 0
        var wingSamples = 0
        y = yStart
        while (y <= yEnd) {
            var lx = leftWingStart
            while (lx <= leftWingEnd) {
                wingSamples++
                val px = screen.getPixel(lx, y)
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                val luma = (r + g + b) / 3
                if (r >= 180 && b >= 190 && g in 118..225 && luma >= 162 && (b - g) >= 24 && (r - g) >= 18 && kotlin.math.abs(r - b) <= 40) {
                    wingBrightPinkHits++
                }
                lx += wingStepX
            }
            var rx = rightWingStart
            while (rx <= rightWingEnd) {
                wingSamples++
                val px = screen.getPixel(rx, y)
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                val luma = (r + g + b) / 3
                if (r >= 180 && b >= 190 && g in 118..225 && luma >= 162 && (b - g) >= 24 && (r - g) >= 18 && kotlin.math.abs(r - b) <= 40) {
                    wingBrightPinkHits++
                }
                rx += wingStepX
            }
            y += wingStepY
        }
        val centerDensity = totalCenterPurple.toFloat() / centerSamples.toFloat()
        val wingDensity = if (wingSamples > 0) wingBrightPinkHits.toFloat() / wingSamples.toFloat() else 0f
        if (wingBrightPinkHits > max(4, wingSamples / 8) && centerDensity < wingDensity * 2.2f) {
            return false
        }

        // Require the crisp white "NOT NOW" pill/text signature directly beneath the Protect Shield hexagon
        val notNowXStart = (w * 0.40f).toInt().coerceIn(0, w - 1)
        val notNowXEnd = (w * 0.60f).toInt().coerceIn(notNowXStart + 1, w - 1)
        val notNowYStart = (h * 0.902f).toInt().coerceIn(0, h - 1)
        val notNowYEnd = (h * 0.958f).toInt().coerceIn(notNowYStart + 1, h - 1)
        val nnStepX = max(2, (notNowXEnd - notNowXStart) / 14)
        val nnStepY = max(2, (notNowYEnd - notNowYStart) / 8)
        var notNowWhiteHits = 0
        var notNowSamples = 0
        y = notNowYStart
        while (y <= notNowYEnd) {
            var x = notNowXStart
            while (x <= notNowXEnd) {
                notNowSamples++
                val px = screen.getPixel(x, y)
                val r = Color.red(px)
                val g = Color.green(px)
                val b = Color.blue(px)
                val maxCh = max(r, max(g, b))
                val minCh = min(r, min(g, b))
                if (r >= 214 && g >= 214 && b >= 214 && (maxCh - minCh) <= 28) {
                    notNowWhiteHits++
                }
                x += nnStepX
            }
            y += nnStepY
        }
        return notNowSamples > 0 && notNowWhiteHits >= max(4, notNowSamples / 14)
    }

    /**
     * v4.00: Displays the themed "Attack incoming!" Shield Decision Overlay directly above
     * Pokémon GO's "Attack incoming! Use a Protect Shield?" text:
     * - 2a: Lists all charged move candidates the opponent has enough energy to throw (`preThrowOppEnergy >= moveCost`),
     *       showing whether each move will KO or your remaining HP% if unshielded.
     * - 2b: Lists all remaining unfunded candidate moves in italics and muted font with move name and
     *       banked/required energy (`30e/40e`).
     * - 2c: 4-tier background color coding:
     *       • RED: All funded moves in 2a will KO your Pokémon
     *       • ORANGE: At least one funded move in 2a KOs and at least one funded move in 2a does NOT KO
     *       • YELLOW: No funded move in 2a KOs, but at least one unfunded move in 2b would KO
     *       • GREEN: No moves in 2a or 2b will KO your Pokémon
     * - 2d: If Charged Moves 1 and 2 are already determined and locked (`confirmedOppChargedMoves[oppSlotIdx].size >= 2`),
     *       excludes Moves 3 and 4 from the overlay and its color evaluation.
     * - 2e: Anchored just above "Attack incoming! Use a Protect Shield?" (`Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL`, `y = 0.295 * screenHeight`)
     *       and auto-hides immediately when the text disappears or after 5.0s, whichever comes first.
     */
    internal fun showOrUpdateShieldDecisionOverlay(
        oppSlotIdx: Int,
        userSlotIdx: Int,
        preThrowOppEnergy: Int
    ) {
        if (!showShieldDecisionOverlay || !isBattleActive || isWaitingForOpponent) {
            hideShieldDecisionOverlay()
            return
        }
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val clampedOppIdx = oppSlotIdx.coerceIn(0, 2)
        val clampedUserIdx = userSlotIdx.coerceIn(0, 2)

        val oppRawName = detectedOpponents.getOrNull(clampedOppIdx)
            ?: pendingChargedAttackOppRawName.ifBlank { activeOpponentName }
        if (oppRawName.isBlank() || oppRawName.equals("Waiting...", ignoreCase = true)) {
            hideShieldDecisionOverlay()
            return
        }
        val oppBaseKey = FormResolver.extractBaseSpecies(oppRawName).lowercase()
        val isOppShad = manualShadowOverrides[oppBaseKey] ?: (if (clampedOppIdx == oppSlotIdx) isOpponentShadow else oppRawName.contains("Shadow", ignoreCase = true))
        val oppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(oppRawName, activeLeague, isOppShad), activeLeague)

        val userSlotCfg = currentPreset?.pokemon?.getOrNull(clampedUserIdx)
        val userMonName = userSlotCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
        val isUserShad = userMonName.contains("Shadow", ignoreCase = true)
        val userMeta = OverlayService.computeEffectiveCombatStats(
            getPokemonMeta(userMonName, activeLeague, isUserShad),
            activeLeague,
            userSlotCfg?.cp,
            userSlotCfg?.ivs
        )
        val userHpPct = playerSlotHpPct[clampedUserIdx].coerceIn(1, 100)

        val oppPlusMove = OverlayService.resolveMegaPlusMoveStatic(oppMeta.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(oppRawName, activeLeague)
        val thirdMoveName = oppPlusMove
            ?: oppMeta.chargedMove3.takeIf { it.isNotBlank() }
            ?: COMMON_THIRD_CHARGED_MOVE[oppMeta.name]
            ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(oppMeta.name, ignoreCase = true) }?.value
            ?: "Outrage"
        val fourthMoveName = (if (oppPlusMove != null) oppMeta.chargedMove3 else oppMeta.chargedMove4).takeIf {
            it.isNotBlank() &&
                !it.equals(oppMeta.chargedMove1, ignoreCase = true) &&
                !it.equals(oppMeta.chargedMove2, ignoreCase = true) &&
                !it.equals(thirdMoveName, ignoreCase = true)
        } ?: ""

        val confirmedSet = confirmedOppChargedMoves.getOrNull(clampedOppIdx) ?: emptySet()
        val confirmedRegularMoves = if (oppPlusMove != null) {
            confirmedSet.filter { it.isNotBlank() && !it.equals(oppPlusMove, ignoreCase = true) }.distinctBy { it.lowercase() }
        } else {
            confirmedSet.filter { it.isNotBlank() }.distinctBy { it.lowercase() }
        }
        val twoRegularMovesLocked = confirmedRegularMoves.size >= 2

        // Requirement 2d: If Charged Moves 1 & 2 are already determined and locked for opponent, exclude Moves 3 & 4 (while preserving fixed Super Mega + move)
        val candidateMoveNames: List<String> = if (twoRegularMovesLocked) {
            (confirmedRegularMoves.take(2) + listOfNotNull(oppPlusMove)).distinctBy { it.lowercase() }
        } else {
            val baseList = if (enable4ChargedMoves && fourthMoveName.isNotBlank()) {
                listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, thirdMoveName, fourthMoveName)
            } else {
                listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, thirdMoveName)
            }
            (baseList + confirmedSet.toList() + listOfNotNull(oppPlusMove))
                .filter { it.isNotBlank() }
                .distinctBy { it.lowercase() }
        }

        if (candidateMoveNames.isEmpty()) {
            hideShieldDecisionOverlay()
            return
        }

        // v6.00 Pillar 4: Tank Incoming Charged Move & Farm to Next Charged Move Before Fainting
        val userEnergyNow = playerSlotEnergy.getOrElse(clampedUserIdx) { 0 }.coerceIn(0, 100)
        val userFastMoveName = userSlotCfg?.fastMove?.takeIf { it.isNotBlank() } ?: userMeta.defaultFastMove
        val userFastTurns = OverlayService.resolveFastTurnsStatic(userFastMoveName, userMeta.fastTurns).coerceAtLeast(1)
        val userFastEnergy = OverlayService.resolveFastEnergyStatic(userFastMoveName, userFastTurns).coerceAtLeast(1)
        val uMove1 = userSlotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
        val uMove2 = userSlotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2
        val uMovePlus = OverlayService.resolveMegaPlusMoveStatic(userMeta.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(userMonName, activeLeague)
        val uCost1 = (OverlayService.resolveChargedMoveStatsStatic(uMove1, userMeta.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
        val uCost2 = (OverlayService.resolveChargedMoveStatsStatic(uMove2, userMeta.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
        var (targetUserMoveName, targetUserMoveCost) = if (uCost1 <= uCost2) uMove1 to uCost1 else uMove2 to uCost2
        if (!uMovePlus.isNullOrBlank()) {
            val uCostPlus = (OverlayService.resolveChargedMoveStatsStatic(uMovePlus, userMeta.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
            if (uCostPlus < targetUserMoveCost) {
                targetUserMoveName = uMovePlus
                targetUserMoveCost = uCostPlus
            }
        }
        val targetUserMoveShort = OverlayService.abbrMoveCompactStatic(targetUserMoveName)
        val myFastsNeededForNextMove = if (userEnergyNow >= targetUserMoveCost) {
            0
        } else {
            kotlin.math.ceil((targetUserMoveCost - userEnergyNow).toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
        }
        val oppFastOverride = detectedOppFastMoveOverride.getOrNull(clampedOppIdx)?.takeIf { it.isNotBlank() }
        val oppFastMoveName = oppFastOverride ?: oppMeta.defaultFastMove
        val oppFastTurns = OverlayService.resolveFastTurnsStatic(oppFastMoveName, oppMeta.fastTurns).coerceAtLeast(1)
        val oppFastExactDmgPct = calculateFastMoveExactDamagePercent(
            attacker = oppMeta,
            defender = userMeta,
            fastMoveName = oppFastMoveName,
            fastTurns = oppFastTurns,
            isAttackerShadow = isOppShad,
            isDefenderShadow = isUserShad
        ).coerceAtLeast(0.5)

        val allMoveRows = candidateMoveNames.map { mName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, oppMeta.types.firstOrNull() ?: "normal")
            val cost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50).coerceIn(35, 100)
            val dmg = calculateChargedMoveDamagePercent(
                attacker = oppMeta,
                defender = userMeta,
                moveName = mName,
                isAttackerShadow = isOppShad,
                isDefenderShadow = isUserShad
            )
            val remHp = (userHpPct - dmg).coerceAtLeast(0)
            val isKo = dmg >= userHpPct
            val isFunded = preThrowOppEnergy >= cost
            val oppFastsSurvivedAfterHit = if (isKo || remHp <= 1) {
                0
            } else {
                kotlin.math.floor((remHp - 1).toDouble() / oppFastExactDmgPct).toInt().coerceAtLeast(0)
            }
            val turnsSurvivedAfterHit = oppFastsSurvivedAfterHit * oppFastTurns
            val myTurnsNeeded = myFastsNeededForNextMove * userFastTurns
            val canReachIfTanked = !isKo && (myFastsNeededForNextMove == 0 || turnsSurvivedAfterHit >= myTurnsNeeded)
            val fastsShort = if (canReachIfTanked || isKo) {
                0
            } else {
                kotlin.math.ceil((myTurnsNeeded - turnsSurvivedAfterHit).toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(1)
            }
            ShieldOverlayMoveRow(
                moveName = mName,
                energyCost = cost,
                dmgPct = dmg,
                remHpPct = remHp,
                isKo = isKo,
                isFunded = isFunded,
                canReachNextMoveIfTanked = canReachIfTanked,
                fastsToNextMoveIfTanked = myFastsNeededForNextMove,
                fastsShortIfTanked = fastsShort,
                userTargetMoveShort = targetUserMoveShort
            )
        }

        val cheapestCost = allMoveRows.minOfOrNull { it.energyCost } ?: 35
        val effectiveBankedE = max(preThrowOppEnergy, cheapestCost).coerceIn(0, 100)
        val normalizedRows = allMoveRows.map { row ->
            row.copy(isFunded = effectiveBankedE >= row.energyCost)
        }

        val fundedMoves = normalizedRows.filter { it.isFunded }.sortedByDescending { it.dmgPct }
        val unfundedMoves = normalizedRows.filter { !it.isFunded }.sortedBy { it.energyCost }

        val allFundedKo = fundedMoves.isNotEmpty() && fundedMoves.all { it.isKo }
        val someFundedKo = fundedMoves.any { it.isKo } && fundedMoves.any { !it.isKo }
        val anyFundedGetsFarmedBeforeMove = fundedMoves.any { !it.isKo && !it.canReachNextMoveIfTanked }
        val unfundedKo = fundedMoves.none { it.isKo } && unfundedMoves.any { it.isKo }
        val worstFarmedRow = fundedMoves.firstOrNull { !it.isKo && !it.canReachNextMoveIfTanked }

        val (bgColor, strokeColor, headerVerdictText) = when {
            allFundedKo -> Triple(
                Color.parseColor("#F07F1D1D"), // Deep Crimson Red
                Color.parseColor("#EF4444"),   // Bright Red border
                "🛡️ SHIELD (1S): ALL FUNDED KO!"
            )
            someFundedKo -> Triple(
                Color.parseColor("#F07C2D12"), // Deep Burnt Orange
                Color.parseColor("#F97316"),   // Bright Orange border
                "🛡️ SHIELD / BAIT MIX: NUKE KOs!"
            )
            anyFundedGetsFarmedBeforeMove -> Triple(
                Color.parseColor("#F07C2D12"), // Deep Burnt Orange (Pillar 4 Farmed-Down Alert)
                Color.parseColor("#FB923C"),
                "🛡️ SHIELD (1S): TANK DIES ${worstFarmedRow?.fastsShortIfTanked ?: 1}F SHORT OF $targetUserMoveShort!"
            )
            unfundedKo -> Triple(
                Color.parseColor("#F0713F12"), // Deep Amber Yellow
                Color.parseColor("#EAB308"),   // Bright Yellow border
                "🛡️ TANK (0S) -> $targetUserMoveShort IN ${myFastsNeededForNextMove}F (Unfunded KO)"
            )
            else -> Triple(
                Color.parseColor("#F0064E3B"), // Deep Emerald Green
                Color.parseColor("#10B981"),   // Bright Green border
                if (myFastsNeededForNextMove == 0) {
                    "🛡️ TANK (0S): $targetUserMoveShort READY!"
                } else {
                    "🛡️ TANK (0S) -> REACH $targetUserMoveShort IN ${myFastsNeededForNextMove}F!"
                }
            )
        }

        val oppShort = OverlayService.abbrPokeCompactStatic(oppMeta.name, isOppShad)
        val userShort = OverlayService.abbrPokeCompactStatic(userMeta.name, isUserShad)
        val lockedTag = if (twoRegularMovesLocked) { if (oppPlusMove != null) " • 3M+" else " • 2M" } else ""
        val headerLineText = "$headerVerdictText  •  $oppShort(${effectiveBankedE}e) vs $userShort(${userHpPct}%)$lockedTag"

        val nowMs = System.currentTimeMillis()
        val isFirstShow = !isShieldDecisionOverlayVisible
        if (isFirstShow) {
            isShieldDecisionOverlayVisible = true
            shieldDecisionOverlayShownAtMs = nowMs
        }
        // v4.06: No 5.0s timer timeout — Shield Decision Overlay stays visible for as long as the top-center
        // 5-second countdown circle is present on screen and hides immediately when the circle disappears!
        mainToastHandler.removeCallbacks(hideShieldDecisionOverlayRunnable)

        mainToastHandler.post {
            try {
                if (!isShieldDecisionOverlayVisible) return@post
                val density = resources.displayMetrics.density
                val targetWidth = (screenWidth * 0.88f).toInt()
                // v4.05: Position bottom at 0.340 * screenHeight (y = 0.660h from top) so the card sits cleanly above
                // Pokémon GO's "Attack incoming! Use a Protect Shield?" text (0.65h..0.77h) without occluding the prompt text.
                val bottomOffsetY = (screenHeight * 0.340f).toInt()

                if (shieldDecisionOverlayView == null) {
                    val container = LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(
                            (10 * density).toInt(),
                            (6 * density).toInt(),
                            (10 * density).toInt(),
                            (6 * density).toInt()
                        )
                    }
                    val params = WindowManager.LayoutParams().apply {
                        type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                        } else {
                            @Suppress("DEPRECATION")
                            WindowManager.LayoutParams.TYPE_PHONE
                        }
                        flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
                        format = PixelFormat.TRANSLUCENT
                        gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                        x = 0
                        y = bottomOffsetY
                        width = targetWidth
                        height = WindowManager.LayoutParams.WRAP_CONTENT
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                        }
                    }
                    windowManager.addView(container, params)
                    shieldDecisionOverlayView = container
                    shieldDecisionOverlayParams = params
                }

                shieldDecisionOverlayView?.let { container ->
                    container.removeAllViews()
                    container.background = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = 10f * density
                        setColor(bgColor)
                        setStroke(max(2, (2.0f * density).toInt()), strokeColor)
                    }

                    // Header Row (uses warm gold/cream #FDE68A so createHighContrastWhiteTextBitmap's isWhiteGlyph ignores it)
                    val headerTv = TextView(this).apply {
                        text = headerLineText
                        setTextColor(Color.parseColor("#FEF08A"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.8f)
                        typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                        setPadding(0, 0, 0, (3 * density).toInt())
                    }
                    container.addView(headerTv)

                    // Divider
                    val divider = View(this).apply {
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            max(1, (1f * density).toInt())
                        ).apply {
                            bottomMargin = (3 * density).toInt()
                        }
                        setBackgroundColor(Color.argb(80, 253, 224, 71))
                    }
                    container.addView(divider)

                    // v4.08: Helper to build 4-Tier Remaining HP Pill Badges:
                    // - > 50% (51-100%): Green check + green pill badge ("✓ 56% HP left")
                    // - 20%-50%: Yellow pill badge ("35% HP left")
                    // - 10%-19%: Orange pill badge ("15% HP left")
                    // - < 10% (0-9% / KO!): Red pill badge ("💥 KO! • 0% HP left" or "8% HP left")
                    // Note: All text colors are non-pure-white (#ECFDF5, #FEF9C3, #FFEDD5, #FFE4E6) so OCR white-glyph filters ignore them.
                    fun createRemainingHpBadge(remHpPct: Int, isKo: Boolean, isFunded: Boolean): TextView {
                        val clampedRem = if (isKo) 0 else remHpPct.coerceIn(0, 100)
                        val (badgeBgHex, badgeStrokeHex, badgeTextHex) = when {
                            isKo || clampedRem < 10 -> Triple("#7F1D1D", "#F87171", "#FDA4AF") // Red (<10% or KO, sat=89)
                            clampedRem < 20 -> Triple("#7C2D12", "#FB923C", "#FDBA74")         // Orange (10-19%, sat=137)
                            clampedRem <= 50 -> Triple("#713F12", "#FACC15", "#FDE047")        // Yellow (20-50%, sat=182)
                            else -> Triple("#065F46", "#34D399", "#6EE7B7")                    // Green (>50%, sat=121)
                        }
                        val badgeLabel = when {
                            isKo -> if (isFunded) "💥 KO! • 0% HP left" else "💥 would KO • 0% HP left"
                            clampedRem > 50 -> "✓ ${clampedRem}% HP left"
                            else -> "${clampedRem}% HP left"
                        }
                        return TextView(this).apply {
                            text = badgeLabel
                            setTextColor(Color.parseColor(badgeTextHex))
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, if (isFunded) 10.8f else 9.8f)
                            typeface = Typeface.create("sans-serif-condensed", if (isFunded) Typeface.BOLD else Typeface.BOLD_ITALIC)
                            setPadding(
                                (6.5f * density).toInt(),
                                (1.5f * density).toInt(),
                                (6.5f * density).toInt(),
                                (1.5f * density).toInt()
                            )
                            background = GradientDrawable().apply {
                                shape = GradientDrawable.RECTANGLE
                                cornerRadius = 999f
                                setColor(Color.parseColor(badgeBgHex))
                                setStroke(max(1, (1.2f * density).toInt()), Color.parseColor(badgeStrokeHex))
                            }
                        }
                    }

                    // 2a: Funded Candidate Moves (individual rows with 4-tier color-coded remaining HP pill badge + Pillar 4 Next-Move Reachability)
                    for (m in fundedMoves) {
                        val rowLayout = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                            setPadding(0, (1.5f * density).toInt(), 0, (1.5f * density).toInt())
                        }
                        val prefixTv = TextView(this).apply {
                            text = "⚡ ${OverlayService.abbrMoveCompactStatic(m.moveName)} (${m.energyCost}e) → "
                            setTextColor(if (m.isKo) Color.parseColor("#FECDD3") else Color.parseColor("#BAE6FD"))
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.0f)
                            typeface = Typeface.create("sans-serif", Typeface.BOLD)
                        }
                        val badgeTv = createRemainingHpBadge(m.remHpPct, m.isKo, isFunded = true)
                        val reachTag = when {
                            m.isKo -> " (-${m.dmgPct}%)"
                            m.canReachNextMoveIfTanked -> if (m.fastsToNextMoveIfTanked == 0) {
                                " • ✓ ${m.userTargetMoveShort} RDY"
                            } else {
                                " • ✓ ${m.userTargetMoveShort} in ${m.fastsToNextMoveIfTanked}F"
                            }
                            else -> " • ⚠️ Dies ${m.fastsShortIfTanked}F short of ${m.userTargetMoveShort}!"
                        }
                        val suffixTv = TextView(this).apply {
                            text = reachTag
                            setTextColor(
                                when {
                                    m.isKo -> Color.parseColor("#FECDD3")
                                    !m.canReachNextMoveIfTanked -> Color.parseColor("#FDBA74")
                                    else -> Color.parseColor("#6EE7B7")
                                }
                            )
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.2f)
                            typeface = Typeface.create("sans-serif-condensed", Typeface.BOLD)
                        }
                        rowLayout.addView(prefixTv)
                        rowLayout.addView(badgeTv)
                        rowLayout.addView(suffixTv)
                        container.addView(rowLayout)
                    }

                    // 2b: Remaining Unfunded Candidate Moves (italics & muted font + 4-tier remaining HP pill badge)
                    for (m in unfundedMoves) {
                        val rowLayout = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = Gravity.CENTER_VERTICAL
                            alpha = 0.86f
                            setPadding(0, (1.5f * density).toInt(), 0, (1.5f * density).toInt())
                        }
                        val prefixTv = TextView(this).apply {
                            text = "• ${m.moveName} (${effectiveBankedE}e/${m.energyCost}e)  —  "
                            setTextColor(if (m.isKo) Color.parseColor("#FDE68A") else Color.parseColor("#94A3B8"))
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.3f)
                            typeface = Typeface.create("sans-serif", Typeface.ITALIC)
                        }
                        val badgeTv = createRemainingHpBadge(m.remHpPct, m.isKo, isFunded = false)
                        val suffixTv = TextView(this).apply {
                            text = "  (-${m.dmgPct}%)"
                            setTextColor(if (m.isKo) Color.parseColor("#FDE68A") else Color.parseColor("#94A3B8"))
                            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.0f)
                            typeface = Typeface.create("sans-serif", Typeface.ITALIC)
                        }
                        rowLayout.addView(prefixTv)
                        rowLayout.addView(badgeTv)
                        rowLayout.addView(suffixTv)
                        container.addView(rowLayout)
                    }

                    container.visibility = View.VISIBLE
                    shieldDecisionOverlayParams?.let { p ->
                        if (p.y != bottomOffsetY || p.width != targetWidth) {
                            p.y = bottomOffsetY
                            p.width = targetWidth
                            try {
                                windowManager.updateViewLayout(container, p)
                            } catch (_: Exception) {}
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    internal fun loadCachedRankingsSynchronously() {
        try {
            val rankingTargets = listOf(
                Pair("GREAT LEAGUE", "pvpoke_rankings_gl.json"),
                Pair("ULTRA LEAGUE", "pvpoke_rankings_ul.json"),
                Pair("MASTER LEAGUE", "pvpoke_rankings_ml.json"),
                Pair("BATTLE FRONTIER (SPECTRAL)", "pvpoke_rankings_bf_spectral.json"),
                Pair("BATTLE FRONTIER (CAULDRON)", "pvpoke_rankings_bf_cauldron.json"),
                Pair("BATTLE FRONTIER (MASTER)", "pvpoke_rankings_bf_master.json")
            )
            for ((leagueKey, fileName) in rankingTargets) {
                if (LIVE_RANKINGS_MAP[leagueKey].isNullOrEmpty()) {
                    val rFile = File(filesDir, fileName)
                    if (rFile.exists() && rFile.length() > 200) {
                        OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                    }
                }
            }
            if (DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                val mainCache = File(filesDir, "pvpoke_gamemaster.json")
                val cacheFile = if (mainCache.exists() && mainCache.length() > 1000) mainCache else File(filesDir, "pvpoke_gamemaster_cache.json")
                if (cacheFile.exists() && cacheFile.length() > 1000) {
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                }
            }
        } catch (_: Exception) {}
    }

    internal fun loadOrFetchGamemasterInBackground() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient()
                val rankingTargets = listOf(
                    Triple("GREAT LEAGUE", "pvpoke_rankings_gl.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"),
                    Triple("ULTRA LEAGUE", "pvpoke_rankings_ul.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json"),
                    Triple("MASTER LEAGUE", "pvpoke_rankings_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json"),
                    Triple("BATTLE FRONTIER (SPECTRAL)", "pvpoke_rankings_bf_spectral.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/spectral/overall/rankings-1500.json"),
                    Triple("BATTLE FRONTIER (CAULDRON)", "pvpoke_rankings_bf_cauldron.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/cauldron/overall/rankings-2500.json"),
                    Triple("BATTLE FRONTIER (MASTER)", "pvpoke_rankings_bf_master.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/battlefrontiermaster/overall/rankings-10000.json")
                )

                var didDownloadAny = false
                for ((leagueKey, fileName, url) in rankingTargets) {
                    try {
                        if (!LIVE_RANKINGS_MAP[leagueKey].isNullOrEmpty()) continue
                        val rFile = File(filesDir, fileName)
                        val rJson = if (rFile.exists() && rFile.length() > 200) {
                            rFile.readText()
                        } else {
                            val req = Request.Builder().url(url).build()
                            client.newCall(req).execute().use { resp ->
                                val body = resp.body?.string()
                                if (resp.isSuccessful && !body.isNullOrBlank()) {
                                    rFile.writeText(body)
                                    didDownloadAny = true
                                    body
                                } else null
                            }
                        }
                        if (!rJson.isNullOrBlank()) {
                            OverlayService.parseRankingsJsonStatic(leagueKey, rJson)
                        }
                    } catch (_: Exception) {}
                }

                if (DYNAMIC_POKEMON_DATABASE.isEmpty() || DYNAMIC_MOVE_DATABASE.isEmpty()) {
                    val mainCache = File(filesDir, "pvpoke_gamemaster.json")
                    val cacheFile = if (mainCache.exists() && mainCache.length() > 1000) mainCache else File(filesDir, "pvpoke_gamemaster_cache.json")
                    val jsonStr = if (cacheFile.exists() && cacheFile.length() > 1000) {
                        cacheFile.readText()
                    } else {
                        val req = Request.Builder()
                            .url("https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json")
                            .build()
                        client.newCall(req).execute().use { resp ->
                            val body = resp.body?.string()
                            if (resp.isSuccessful && !body.isNullOrBlank()) {
                                cacheFile.writeText(body)
                                didDownloadAny = true
                                body
                            } else null
                        }
                    }
                    if (!jsonStr.isNullOrBlank()) {
                        parseGamemasterJson(jsonStr)
                    }
                }
                if (didDownloadAny || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()
                }
                withContext(Dispatchers.Main) {
                    recalculateAndPushBattleData()
                }
            } catch (_: Exception) {}
        }
    }

    internal fun parseGamemasterJson(jsonStr: String) {
        OverlayService.parseGamemasterJsonStatic(jsonStr)
    }

    internal fun setupDefaultPresetsIfNeeded() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    "preset-ml-1", "Master: Palkia-O / Zacian-C / Dialga-O", "MASTER LEAGUE", listOf(
                        TeamMember("Palkia (Origin)", 4683, "Dragon Breath", "Spacial Rend", "Aqua Tail"),
                        TeamMember("Zacian (Crowned)", 4658, "Metal Claw", "Behemoth Blade", "Close Combat"),
                        TeamMember("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head")
                    ), true
                ),
                TeamPreset(
                    "preset-ul-1", "Ultra: Zygarde / Feraligatr / Giratina-A", "ULTRA LEAGUE", listOf(
                        TeamMember("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                        TeamMember("Feraligatr", 2488, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                        TeamMember("Giratina (Altered)", 2497, "Shadow Claw", "Dragon Claw", "Ancient Power")
                    ), false
                ),
                TeamPreset(
                    "preset-gl-1", "Great: Clodsire / Feraligatr / Mandibuzz", "GREAT LEAGUE", listOf(
                        TeamMember("Clodsire", 1494, "Poison Sting", "Earthquake", "Stone Edge"),
                        TeamMember("Feraligatr", 1498, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                        TeamMember("Mandibuzz", 1496, "Snarl", "Dark Pulse", "Aerial Ace")
                    ), false
                )
            )
            val json = gson.toJson(defaults)
            prefs.edit().putString(PREFS_KEY_PERSISTENT_TEAMS, json).apply()
            currentPreset = defaults[0]
            activeUserPokemonName = defaults[0].pokemon[0].name
        } else {
            val selectedId = prefs.getString("gbl_selected_preset_id", existing[0].id)
            currentPreset = existing.find { it.id == selectedId } ?: existing[0]
            if (activeUserPokemonName.isNullOrBlank() ||
                currentPreset?.pokemon?.none { it.name.equals(activeUserPokemonName, ignoreCase = true) } == true
            ) {
                activeUserPokemonName = currentPreset?.pokemon?.getOrNull(0)?.name
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    internal fun setupOverlayView() {
        overlayView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = false
            setBackgroundColor(0x00000000)
            setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    loadInitialDataIntoOverlay()
                }
            }
            addJavascriptInterface(AndroidBridge(), "AndroidOverlay")
            loadUrl("file:///android_asset/overlay.html")
        }

        val density = resources.displayMetrics.density

        layoutParams = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED

            format = PixelFormat.TRANSLUCENT
            gravity = Gravity.TOP or Gravity.START
            x = (8 * density).toInt()
            y = (142 * density).toInt()
            width = (screenWidth * (overlayScalePct.coerceIn(50, 100) / 100f)).toInt()
            height = WindowManager.LayoutParams.WRAP_CONTENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDraggingTouch = false

        overlayView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDraggingTouch = false
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        isDraggingTouch = true
                        val minYOffset = -(12 * density).toInt()
                        val maxYOffset = if (isOverlayMinimized) screenHeight - (56 * density).toInt() else screenHeight - 200
                        layoutParams.x = max(0, min(initialX + deltaX, max(0, screenWidth - layoutParams.width)))
                        layoutParams.y = max(minYOffset, min(initialY + deltaY, max(0, maxYOffset)))
                        try {
                            windowManager.updateViewLayout(overlayView, layoutParams)
                        } catch (_: Exception) {}
                        true
                    } else false
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (isDraggingTouch) {
                        isDraggingTouch = false
                        true
                    } else {
                        false
                    }
                }
                else -> false
            }
        }

        try {
            windowManager.addView(overlayView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    internal fun applyOverlayScale(scalePct: Int) {
        overlayScalePct = scalePct.coerceIn(50, 100)
        if (!::layoutParams.isInitialized) return
        if (!isOverlayMinimized) {
            val targetWidth = (screenWidth * (overlayScalePct / 100f)).toInt()
            layoutParams.width = targetWidth
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - targetWidth)))
        }
        Handler(Looper.getMainLooper()).post {
            try {
                if (overlayView != null) {
                    if (!isOverlayMinimized) {
                        windowManager.updateViewLayout(overlayView, layoutParams)
                    }
                    overlayView?.evaluateJavascript("if (window.setOverlayScalePct) setOverlayScalePct($overlayScalePct);", null)
                }
            } catch (_: Exception) {}
        }
    }

    internal fun applyOverlayTransparency(transparencyPct: Int) {
        overlayTransparencyPct = transparencyPct.coerceIn(0, 100)
        Handler(Looper.getMainLooper()).post {
            try {
                overlayView?.evaluateJavascript(
                    "if (window.setOverlayTransparencyPct) setOverlayTransparencyPct($overlayTransparencyPct);",
                    null
                )
            } catch (_: Exception) {}
        }
    }

    internal fun applyOverlayTheme(themeId: String) {
        val cleaned = themeId.ifBlank { "dialga_shiny_midnight" }
        appThemeId = if (cleaned == "amoled_cyan" || cleaned == "amoled_matrix") "dialga_shiny_midnight" else cleaned
        Handler(Looper.getMainLooper()).post {
            try {
                overlayView?.evaluateJavascript(
                    "if (window.setOverlayTheme) setOverlayTheme('$appThemeId');",
                    null
                )
            } catch (_: Exception) {}
        }
    }

    internal fun stopBattleOcrLoop() {
        battleLoopJob?.cancel()
        battleLoopJob = null
    }

    internal fun minimizeOverlayToBubble() {
        if (isOverlayMinimized) return
        isOverlayMinimized = true
        lastMinimizeTimestampMs = System.currentTimeMillis()
        stopBattleOcrLoop()
        overlayView?.evaluateJavascript("if (window.setOverlayMinimizedState) setOverlayMinimizedState(true);", null)
        val density = resources.displayMetrics.density
        val bubbleSize = (48 * density).toInt()
        if (::layoutParams.isInitialized) {
            layoutParams.width = bubbleSize
            layoutParams.height = bubbleSize
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - bubbleSize)))
            layoutParams.y = max(0, min(layoutParams.y, max(0, screenHeight - bubbleSize - 24)))
            try {
                if (overlayView != null) {
                    windowManager.updateViewLayout(overlayView, layoutParams)
                }
            } catch (_: Exception) {}
        }
        startForegroundNotification()
        showStatusBarToast("Overlay minimized (OCR paused). Tap bubble to resume.", Toast.LENGTH_SHORT)
    }

    internal fun restoreOverlayFromBubble() {
        if (!isOverlayMinimized) return
        if (System.currentTimeMillis() - lastMinimizeTimestampMs < 400L) return
        isOverlayMinimized = false
        if (::layoutParams.isInitialized) {
            val targetWidth = (screenWidth * (overlayScalePct.coerceIn(50, 100) / 100f)).toInt()
            layoutParams.width = targetWidth
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - targetWidth)))
            try {
                if (overlayView != null) {
                    windowManager.updateViewLayout(overlayView, layoutParams)
                }
            } catch (_: Exception) {}
        }
        overlayView?.evaluateJavascript(
            "if (window.setOverlayMinimizedState) setOverlayMinimizedState(false); if (window.setOverlayScalePct) setOverlayScalePct($overlayScalePct);",
            null
        )
        if (mediaProjection != null && isBattleActive) {
            startBattleOcrLoop()
        }
        recalculateAndPushBattleData()
        startForegroundNotification()
        showStatusBarToast("✓ Overlay restored & OCR resumed", Toast.LENGTH_SHORT)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val action = intent?.action ?: ACTION_START_OVERLAY

        when (action) {
            ACTION_START_OVERLAY, ACTION_SHORT_START -> {
                isInstanceRunning = true
                notifyRunningStateChanged()
                if (isOverlayMinimized) {
                    restoreOverlayFromBubble()
                }
                isOverlayMinimized = false

                val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA)
                }
                val canUseProjectionFgs = (resultCode != 0 && resultData != null) || mediaProjection != null
                startForegroundNotification(canUseProjectionFgs)

                intent?.getStringExtra(EXTRA_OPP_COUNT_MODE)?.let { mode ->
                    if (mode == "opp_fasts" || mode == "my_fasts") {
                        oppCountMode = mode
                    }
                } ?: run {
                    oppCountMode = prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts"
                }
                val startScalePct = intent?.getIntExtra(
                    EXTRA_OVERLAY_SCALE_PCT,
                    prefs.getInt("overlay_scale_pct", 78)
                ) ?: prefs.getInt("overlay_scale_pct", 78)
                applyOverlayScale(startScalePct)

                val startTransparencyPct = intent?.getIntExtra(
                    EXTRA_OVERLAY_TRANSPARENCY_PCT,
                    prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72)
                ) ?: prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72)
                applyOverlayTransparency(startTransparencyPct)

                val startThemeId = intent?.getStringExtra(EXTRA_APP_THEME_ID)
                    ?: prefs.getString(PREFS_KEY_APP_THEME_ID, "dialga_shiny_midnight")
                    ?: "dialga_shiny_midnight"
                applyOverlayTheme(startThemeId)

                enable4ChargedMoves = if (intent?.hasExtra(EXTRA_ENABLE_4_CHARGED_MOVES) == true) {
                    intent.getBooleanExtra(EXTRA_ENABLE_4_CHARGED_MOVES, false)
                } else {
                    prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, enable4ChargedMoves)
                }

                disableBattleToasts = if (intent?.hasExtra(EXTRA_DISABLE_BATTLE_TOASTS) == true) {
                    intent.getBooleanExtra(EXTRA_DISABLE_BATTLE_TOASTS, false)
                } else {
                    prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, disableBattleToasts)
                }
                overlayView?.evaluateJavascript("if (window.setDisableBattleToasts) setDisableBattleToasts($disableBattleToasts);", null)

                showTacticalRecommendations = if (intent?.hasExtra(EXTRA_SHOW_TACTICAL_RECOMMENDATIONS) == true) {
                    intent.getBooleanExtra(EXTRA_SHOW_TACTICAL_RECOMMENDATIONS, true)
                } else {
                    prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, showTacticalRecommendations)
                }
                overlayView?.evaluateJavascript("if (window.setShowTacticalRecs) setShowTacticalRecs($showTacticalRecommendations);", null)

                showShieldDecisionOverlay = if (intent?.hasExtra(EXTRA_SHOW_SHIELD_DECISION_OVERLAY) == true) {
                    intent.getBooleanExtra(EXTRA_SHOW_SHIELD_DECISION_OVERLAY, true)
                } else {
                    prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, showShieldDecisionOverlay)
                }
                if (!showShieldDecisionOverlay) {
                    hideShieldDecisionOverlay()
                }

                enableHpTracking = if (intent?.hasExtra(EXTRA_ENABLE_HP_TRACKING) == true) {
                    intent.getBooleanExtra(EXTRA_ENABLE_HP_TRACKING, DEFAULT_ENABLE_HP_TRACKING)
                } else {
                    prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, enableHpTracking)
                }
                overlayView?.evaluateJavascript("if (window.setEnableHpTracking) setEnableHpTracking($enableHpTracking);", null)

                enableEnergyTracking = if (intent?.hasExtra(EXTRA_ENABLE_ENERGY_TRACKING) == true) {
                    intent.getBooleanExtra(EXTRA_ENABLE_ENERGY_TRACKING, DEFAULT_ENABLE_ENERGY_TRACKING)
                } else {
                    prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, enableEnergyTracking)
                }
                overlayView?.evaluateJavascript("if (window.setEnableEnergyTracking) setEnableEnergyTracking($enableEnergyTracking);", null)

                fastDetectTurnOffset = if (intent?.hasExtra(EXTRA_FAST_DETECT_TURN_OFFSET) == true) {
                    intent.getIntExtra(EXTRA_FAST_DETECT_TURN_OFFSET, DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
                } else {
                    prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
                }
                overlayView?.evaluateJavascript("if (window.setFastDetectTurnOffset) setFastDetectTurnOffset($fastDetectTurnOffset);", null)
                chargeCirclePriorityMode = if (intent?.hasExtra(EXTRA_CHARGE_CIRCLE_PRIORITY_MODE) == true) {
                    intent.getStringExtra(EXTRA_CHARGE_CIRCLE_PRIORITY_MODE) ?: DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
                } else {
                    prefs.getString(PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE) ?: DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
                }
                enableAltFastMoveDetect = if (intent?.hasExtra(EXTRA_ENABLE_ALT_FAST_MOVE_DETECT) == true) {
                    intent.getBooleanExtra(EXTRA_ENABLE_ALT_FAST_MOVE_DETECT, DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
                } else {
                    prefs.getBoolean(PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
                }
                aiAdviceHudPosition = if (intent?.hasExtra(EXTRA_AI_ADVICE_HUD_POSITION) == true) {
                    (intent.getStringExtra(EXTRA_AI_ADVICE_HUD_POSITION) ?: DEFAULT_AI_ADVICE_HUD_POSITION).lowercase()
                        .let { if (it == "top") "top" else "bottom" }
                } else {
                    (prefs.getString(PREFS_KEY_AI_ADVICE_HUD_POSITION, DEFAULT_AI_ADVICE_HUD_POSITION) ?: DEFAULT_AI_ADVICE_HUD_POSITION).lowercase()
                        .let { if (it == "top") "top" else "bottom" }
                }
                overlayView?.evaluateJavascript("if (window.setAiAdviceHudPosition) setAiAdviceHudPosition('$aiAdviceHudPosition');", null)
                syncTierThresholdsFromPrefs(prefs)

                val requestedTeamName = intent?.getStringExtra(EXTRA_TEAM_NAME)
                    ?: intent?.getStringExtra("preset")
                if (!requestedTeamName.isNullOrBlank()) {
                    val allPresets = loadPresets()
                    val matched = allPresets.find {
                        it.name.equals(requestedTeamName.trim(), ignoreCase = true) ||
                            it.id.equals(requestedTeamName.trim(), ignoreCase = true)
                    }
                    if (matched != null && matched.pokemon.isNotEmpty()) {
                        currentPreset = matched
                        activeUserPokemonName = matched.pokemon.first().name
                        prefs.edit().putString("gbl_selected_preset_id", matched.id).apply()
                    }
                }

                intent?.getStringExtra(EXTRA_PRESET_JSON)?.let { presetJson ->
                    try {
                        val incoming = gson.fromJson(presetJson, TeamPreset::class.java)
                        if (incoming != null && incoming.pokemon.isNotEmpty()) {
                            currentPreset = incoming
                            activeUserPokemonName = incoming.pokemon.first().name
                        }
                    } catch (_: Exception) {}
                }

                if (!OverlayService.areAllFourLeaguesLoaded() || DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    loadCachedRankingsSynchronously()
                    if (!OverlayService.areAllFourLeaguesLoaded() || DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                        loadOrFetchGamemasterInBackground()
                    }
                }
                if (resultCode != 0 && resultData != null) {
                    initMediaProjection(resultCode, resultData)
                    startBattleOcrLoop()
                } else if (mediaProjection != null) {
                    startBattleOcrLoop()
                }
                recalculateAndPushBattleData()
            }
            ACTION_UPDATE_PRESET -> {
                intent?.getStringExtra(EXTRA_PRESET_JSON)?.let { presetJson ->
                    try {
                        val incoming = gson.fromJson(presetJson, TeamPreset::class.java)
                        if (incoming != null && incoming.pokemon.isNotEmpty()) {
                            currentPreset = incoming
                            activeUserPokemonName = incoming.pokemon.first().name
                            loadInitialDataIntoOverlay()
                        }
                    } catch (_: Exception) {}
                }
            }
            ACTION_UPDATE_SETTINGS -> {
                if (intent?.hasExtra(EXTRA_OPP_COUNT_MODE) == true) {
                    val newMode = intent.getStringExtra(EXTRA_OPP_COUNT_MODE) ?: "my_fasts"
                    oppCountMode = if (newMode == "opp_fasts") "opp_fasts" else "my_fasts"
                } else {
                    oppCountMode = prefs.getString("opp_count_mode", oppCountMode) ?: oppCountMode
                }
                if (intent?.hasExtra(EXTRA_ENABLE_4_CHARGED_MOVES) == true) {
                    enable4ChargedMoves = intent.getBooleanExtra(EXTRA_ENABLE_4_CHARGED_MOVES, false)
                } else {
                    enable4ChargedMoves = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, enable4ChargedMoves)
                }
                if (intent?.hasExtra(EXTRA_DISABLE_BATTLE_TOASTS) == true) {
                    disableBattleToasts = intent.getBooleanExtra(EXTRA_DISABLE_BATTLE_TOASTS, false)
                } else {
                    disableBattleToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, disableBattleToasts)
                }
                overlayView?.evaluateJavascript("if (window.setDisableBattleToasts) setDisableBattleToasts($disableBattleToasts);", null)
                if (intent?.hasExtra(EXTRA_SHOW_TACTICAL_RECOMMENDATIONS) == true) {
                    showTacticalRecommendations = intent.getBooleanExtra(EXTRA_SHOW_TACTICAL_RECOMMENDATIONS, true)
                } else {
                    showTacticalRecommendations = prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, showTacticalRecommendations)
                }
                overlayView?.evaluateJavascript("if (window.setShowTacticalRecs) setShowTacticalRecs($showTacticalRecommendations);", null)
                if (intent?.hasExtra(EXTRA_SHOW_SHIELD_DECISION_OVERLAY) == true) {
                    showShieldDecisionOverlay = intent.getBooleanExtra(EXTRA_SHOW_SHIELD_DECISION_OVERLAY, true)
                } else {
                    showShieldDecisionOverlay = prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, showShieldDecisionOverlay)
                }
                if (!showShieldDecisionOverlay) {
                    hideShieldDecisionOverlay()
                }
                if (intent?.hasExtra(EXTRA_ENABLE_HP_TRACKING) == true) {
                    enableHpTracking = intent.getBooleanExtra(EXTRA_ENABLE_HP_TRACKING, DEFAULT_ENABLE_HP_TRACKING)
                } else {
                    enableHpTracking = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, enableHpTracking)
                }
                overlayView?.evaluateJavascript("if (window.setEnableHpTracking) setEnableHpTracking($enableHpTracking);", null)
                if (intent?.hasExtra(EXTRA_ENABLE_ENERGY_TRACKING) == true) {
                    enableEnergyTracking = intent.getBooleanExtra(EXTRA_ENABLE_ENERGY_TRACKING, DEFAULT_ENABLE_ENERGY_TRACKING)
                } else {
                    enableEnergyTracking = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, enableEnergyTracking)
                }
                overlayView?.evaluateJavascript("if (window.setEnableEnergyTracking) setEnableEnergyTracking($enableEnergyTracking);", null)
                if (intent?.hasExtra(EXTRA_FAST_DETECT_TURN_OFFSET) == true) {
                    fastDetectTurnOffset = intent.getIntExtra(EXTRA_FAST_DETECT_TURN_OFFSET, DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
                } else {
                    fastDetectTurnOffset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, fastDetectTurnOffset).coerceIn(0, 3)
                }
                overlayView?.evaluateJavascript("if (window.setFastDetectTurnOffset) setFastDetectTurnOffset($fastDetectTurnOffset);", null)
                if (intent?.hasExtra(EXTRA_CHARGE_CIRCLE_PRIORITY_MODE) == true) {
                    chargeCirclePriorityMode = intent.getStringExtra(EXTRA_CHARGE_CIRCLE_PRIORITY_MODE) ?: DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
                } else {
                    chargeCirclePriorityMode = prefs.getString(PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, chargeCirclePriorityMode) ?: chargeCirclePriorityMode
                }
                if (intent?.hasExtra(EXTRA_ENABLE_ALT_FAST_MOVE_DETECT) == true) {
                    enableAltFastMoveDetect = intent.getBooleanExtra(EXTRA_ENABLE_ALT_FAST_MOVE_DETECT, DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
                } else {
                    enableAltFastMoveDetect = prefs.getBoolean(PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, enableAltFastMoveDetect)
                }
                if (intent?.hasExtra(EXTRA_AI_ADVICE_HUD_POSITION) == true) {
                    aiAdviceHudPosition = (intent.getStringExtra(EXTRA_AI_ADVICE_HUD_POSITION) ?: DEFAULT_AI_ADVICE_HUD_POSITION).lowercase()
                        .let { if (it == "top") "top" else "bottom" }
                } else {
                    aiAdviceHudPosition = (prefs.getString(PREFS_KEY_AI_ADVICE_HUD_POSITION, aiAdviceHudPosition) ?: aiAdviceHudPosition).lowercase()
                        .let { if (it == "top") "top" else "bottom" }
                }
                overlayView?.evaluateJavascript("if (window.setAiAdviceHudPosition) setAiAdviceHudPosition('$aiAdviceHudPosition');", null)
                syncTierThresholdsFromPrefs(prefs)
                val updatedScalePct = intent?.getIntExtra(
                    EXTRA_OVERLAY_SCALE_PCT,
                    prefs.getInt("overlay_scale_pct", overlayScalePct)
                ) ?: prefs.getInt("overlay_scale_pct", overlayScalePct)
                applyOverlayScale(updatedScalePct)

                val updatedTransparencyPct = intent?.getIntExtra(
                    EXTRA_OVERLAY_TRANSPARENCY_PCT,
                    prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, overlayTransparencyPct)
                ) ?: prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, overlayTransparencyPct)
                applyOverlayTransparency(updatedTransparencyPct)

                val updatedThemeId = intent?.getStringExtra(EXTRA_APP_THEME_ID)
                    ?: prefs.getString(PREFS_KEY_APP_THEME_ID, appThemeId)
                    ?: appThemeId
                applyOverlayTheme(updatedThemeId)

                recalculateAndPushBattleData()
            }
            ACTION_START_BATTLE -> startNewBattle()
            ACTION_TOGGLE_LAYOUT -> toggleLayoutMode()
            ACTION_MINIMIZE_OVERLAY -> minimizeOverlayToBubble()
            ACTION_RESTORE_OVERLAY -> restoreOverlayFromBubble()
            ACTION_TOGGLE_OVERLAY, ACTION_SHORT_TOGGLE -> {
                if (isOverlayMinimized) {
                    restoreOverlayFromBubble()
                } else {
                    isInstanceRunning = false
                    hasActiveMediaProjection = false
                    notifyRunningStateChanged()
                    if (::prefs.isInitialized) {
                        OverlayService.triggerAutoUploadOnOverlayStopAsync(prefs, gson)
                    }
                    stopSelf()
                }
            }
            ACTION_STOP_OVERLAY, ACTION_SHORT_STOP -> {
                isInstanceRunning = false
                hasActiveMediaProjection = false
                notifyRunningStateChanged()
                if (::prefs.isInitialized) {
                    OverlayService.triggerAutoUploadOnOverlayStopAsync(prefs, gson)
                }
                stopSelf()
            }
        }

        return START_STICKY
    }

    internal fun startForegroundNotification(hasMediaProjectionToken: Boolean = (mediaProjection != null)) {
        val notificationIntent = Intent(this, OverlayService::class.java).apply {
            action = ACTION_STOP_OVERLAY
        }
        val pendingIntent = PendingIntent.getService(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = if (isOverlayMinimized) {
            "Overlay minimized (OCR paused) — Tap bubble to resume"
        } else {
            "Live OCR monitoring opponent & player switches..."
        }

        val notification: Notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("SilphScope PvP Overlay Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Overlay", pendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                if (hasMediaProjectionToken) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
                } else if (Build.VERSION.SDK_INT >= 34) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            } catch (_: Exception) {
                try {
                    if (Build.VERSION.SDK_INT >= 34) {
                        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                    } else {
                        startForeground(NOTIFICATION_ID, notification)
                    }
                } catch (_: Exception) {}
            }
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    internal fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "SilphScope PvP Overlay Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live GBL turn alignment & opponent counter HUD"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    internal fun applyLayoutMode(mode: String) {
        currentLayoutMode = mode
        val density = resources.displayMetrics.density
        if (mode == "option2") {
            layoutParams.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            layoutParams.x = 0
            layoutParams.y = (16 * density).toInt()
            layoutParams.width = min((screenWidth * 0.88f).toInt(), (340 * density).toInt())
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
        } else {
            layoutParams.gravity = Gravity.TOP or Gravity.START
            layoutParams.x = (8 * density).toInt()
            layoutParams.y = (135 * density).toInt()
            layoutParams.width = min((screenWidth * 0.78f).toInt(), (310 * density).toInt())
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
        }
        try {
            windowManager.updateViewLayout(overlayView, layoutParams)
        } catch (_: Exception) {}

        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("setLayoutMode('$mode')", null)
        }
    }

    internal fun toggleLayoutMode() {
        val nextMode = if (currentLayoutMode == "option1") "option2" else "option1"
        applyLayoutMode(nextMode)
    }

    @SuppressLint("WrongConstant")
    internal fun initMediaProjection(resultCode: Int, data: Intent) {
        try {
            virtualDisplay?.release()
            imageReader?.close()
            mediaProjection?.stop()

            mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
            hasActiveMediaProjection = mediaProjection != null

            // CRITICAL FOR ANDROID 14+ (API 34+): Must register callback before createVirtualDisplay
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    hasActiveMediaProjection = false
                    virtualDisplay?.release()
                    virtualDisplay = null
                }
            }, Handler(Looper.getMainLooper()))

            imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "GBLScreenCapture",
                screenWidth,
                screenHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                imageReaderHandler
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    internal fun captureCleanScreenBitmap(): Bitmap? {
        val reader = imageReader ?: return null
        synchronized(captureLock) {
            return try {
                val image = reader.acquireLatestImage() ?: reader.acquireNextImage()
                if (image != null) {
                    try {
                        val plane = image.planes[0]
                        val buffer = plane.buffer
                        val pixelStride = plane.pixelStride
                        val rowStride = plane.rowStride
                        val rowPadding = rowStride - pixelStride * screenWidth

                        val fullBitmap = Bitmap.createBitmap(
                            screenWidth + rowPadding / pixelStride,
                            screenHeight,
                            Bitmap.Config.ARGB_8888
                        )
                        fullBitmap.copyPixelsFromBuffer(buffer)

                        val clean = if (rowPadding == 0) {
                            fullBitmap
                        } else {
                            val cropped = Bitmap.createBitmap(fullBitmap, 0, 0, screenWidth, screenHeight)
                            fullBitmap.recycle()
                            cropped
                        }

                        cachedScreenBitmap?.recycle()
                        cachedScreenBitmap = clean
                        clean.copy(Bitmap.Config.ARGB_8888, false)
                    } finally {
                        image.close()
                    }
                } else {
                    cachedScreenBitmap?.let {
                        if (!it.isRecycled) it.copy(Bitmap.Config.ARGB_8888, false) else null
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    /**
     * v3.54: TURN-PHASED 2.00 HZ (500ms) / 1.00 HZ (1000ms) BATTLE SCAN LOOP:
     * Phase-locks screen captures to the observed 500ms GBL turn boundary (`turnPhaseAnchorMs`) so that
     * confirmed fast-move damage and Turn-T pending-damage completions render on the overlay at the exact
     * moment energy becomes available to use (enabling immediate swap/catch warnings).
     */
    /**
     * v3.66: TURN-SCALED DEBOUNCE + 3T+ SLIVER LATCH + LOW-DAMAGE MOVE MULTI-CREDIT + STABLE CHARGED RECONCILIATION
     * 1. Turn-Scaled Debounce (+100ms per turn count):
     *    - 1-turn (500ms): 2 scans (200ms)
     *    - 2-turn (1000ms): 3 scans (300ms)
     *    - 3-turn (1500ms): 4 scans (400ms)
     *    - 4-turn (2000ms): 5 scans (500ms)
     *    - 5-turn (2500ms): 6 scans (600ms)
     * 2. Pending Damage Sliver Latch-and-Lock:
     *    - Restricted to 3T, 4T, and 5T fast moves (1T and 2T fast moves do not show visible pending indicators in Pokémon GO).
     * 3. Adaptive Fast-Move Damage Filter:
     *    - For 3T+ heavy moves, requires >= 50% of expected move damage (min 2%) to filter out transient 1-2% post-swap glitches.
     *    - For 1T/2T and low-damage moves (<= 3.5%), accepts 1% drops and multi-move credits drops (min(dmgDerivedMoves, elapsedDerivedMoves))
     *      so low-damage moves never under-count energy.
     * 4. Charged-Move Reconcile Window:
     *    - Expanded catchup during the ~10s stable charged attack pause to reconcile up to +3 missed moves.
     */
    internal fun startBattleOcrLoop() {
        if (battleLoopJob?.isActive == true) return
        battleLoopJob = lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                if (mediaProjection == null || isOverlayMinimized) {
                    delay(250L)
                    continue
                }
                val cycleStartMs = System.currentTimeMillis()
                val actualCadenceMs = if (lastHpScanTickMs > 0L) {
                    (cycleStartMs - lastHpScanTickMs).coerceIn(1L, 2000L)
                } else {
                    0L
                }
                lastHpScanTickMs = cycleStartMs
                lastCaptureStartMs = cycleStartMs
                try {
                    captureAndProcessBattleRegions(cycleStartMs, actualCadenceMs)
                } catch (_: Exception) {}
                val nowAfterHpScan = System.currentTimeMillis()
                val pixelWorkMs = (nowAfterHpScan - cycleStartMs).coerceAtLeast(1L)
                val targetLoopMs = 100L
                val sleepMs = (targetLoopMs - pixelWorkMs).coerceAtLeast(5L)
                val effectiveHpLoopMs = if (actualCadenceMs in 40L..350L) {
                    actualCadenceMs
                } else {
                    (pixelWorkMs + sleepMs).coerceAtLeast(80L)
                }
                lastHpScanDurationMs = effectiveHpLoopMs
                if (isBattleActive) {
                    currentBattleHpScanDurationSumMs += effectiveHpLoopMs
                    currentBattleHpScanCount += 1
                    lastBattleAvgHpScanMs = (currentBattleHpScanDurationSumMs / currentBattleHpScanCount).coerceAtLeast(1L)
                }
                currentScanHzMode = "10HZ_HP"
                delay(sleepMs)
            }
        }
    }

    private suspend fun captureAndProcessBattleRegions(cycleStartMs: Long, actualCadenceMs: Long) {
        val frameEpoch = battleResetEpoch
        if (System.currentTimeMillis() - lastBattleResetTimeMs < 600L) return

        val screen = captureCleanScreenBitmap() ?: return
        if (screen.isRecycled) return
        if (frameEpoch != battleResetEpoch) {
            screen.recycle()
            return
        }

        val w = screen.width
        val h = screen.height

        // v2.94: Calibrated Pokéball & Shield Sub-Region Segmentation (from 1080x2342 ground-truth GBL HUD)
        val playerPokeballRect = Rect(
            (w * 0.028f).toInt().coerceIn(0, w - 1),
            (h * 0.065f).toInt().coerceIn(0, h - 1),
            (w * 0.192f).toInt().coerceIn(1, w),
            (h * 0.125f).toInt().coerceIn(1, h)
        )
        val playerShieldRect = Rect(
            (w * 0.205f).toInt().coerceIn(0, w - 1),
            (h * 0.065f).toInt().coerceIn(0, h - 1),
            (w * 0.335f).toInt().coerceIn(1, w),
            (h * 0.125f).toInt().coerceIn(1, h)
        )
        val oppShieldRect = Rect(
            (w * 0.665f).toInt().coerceIn(0, w - 1),
            (h * 0.065f).toInt().coerceIn(0, h - 1),
            (w * 0.795f).toInt().coerceIn(1, w),
            (h * 0.125f).toInt().coerceIn(1, h)
        )
        val oppPokeballRect = Rect(
            (w * 0.808f).toInt().coerceIn(0, w - 1),
            (h * 0.065f).toInt().coerceIn(0, h - 1),
            (w * 0.972f).toInt().coerceIn(1, w),
            (h * 0.125f).toInt().coerceIn(1, h)
        )

        // v6.12: Tightened 2D Floating HP Bar Corridors so O_HP never scans the lower half of the screen (<= 0.50h)
        // and U_HP never scans the Shield Decision Overlay remaining-HP badges (>= 0.67h) during Attack Incoming!
        val oppHpCorridorRect = Rect(
            (w * 0.395f).toInt().coerceIn(0, w - 1),
            (h * 0.055f).toInt().coerceIn(0, h - 1),
            (w * 0.980f).toInt().coerceIn(1, w),
            (h * 0.50f).toInt().coerceIn(1, h)
        )
        val playerHpCorridorRect = Rect(
            (w * 0.010f).toInt().coerceIn(0, w - 1),
            (h * 0.055f).toInt().coerceIn(0, h - 1),
            (w * 0.520f).toInt().coerceIn(1, w),
            (h * 0.65f).toInt().coerceIn(1, h)
        )

        // 1. Run 100ms (10 Hz) Pixel HUD Scan immediately on every frame
        prevFrameTimestampMs = currentFrameTimestampMs
        currentFrameTimestampMs = System.currentTimeMillis()
        if (sampledPlayerBalls in 1..3) prevValidPlayerBalls = sampledPlayerBalls
        if (sampledOppBalls in 1..3) prevValidOppBalls = sampledOppBalls
        sampledPlayerBalls = detectActivePokeballCount(screen, playerPokeballRect)
        sampledOppBalls = detectActivePokeballCount(screen, oppPokeballRect)
        sampledPlayerShields = detectActiveShieldCount(screen, playerShieldRect)
        sampledOppShields = detectActiveShieldCount(screen, oppShieldRect)
        if (enableHpTracking || enableEnergyTracking || showShieldDecisionOverlay) {
            sampledOppHpPct = detectFloatingHpBarPct(screen, oppHpCorridorRect, w, isOpponent = true)
            sampledPlayerHpPct = detectFloatingHpBarPct(screen, playerHpCorridorRect, w, isOpponent = false)
        } else {
            sampledOppHpPct = -1
            sampledPlayerHpPct = -1
            sampledOppHasPendingDmg = false
            sampledPlayerHasPendingDmg = false
            sampledOppPendingDmgPct = 0
            sampledPlayerPendingDmgPct = 0
        }
        // v4.06: 100ms (10 Hz) Top-Center 5-Second Countdown Circle & Top-Right Opponent Nameplate Box Detector:
        // Run BEFORE detectChargedMoveButtonFillLevels so an active 5s countdown circle immediately suppresses
        // false 0% charge circle matches on the bottom "NOT NOW" text (`(0.50w, 0.8932h)`).
        sampledShieldHexagonVisible = false
        shieldHexagonConfirmFrames = 0
        sampledTopRightNameplateVisible = detectTopRightOpponentNameplate(screen, w, h)
        // v5.13 Fix 1: Never treat the 10-second post-faint switch countdown circle as a 5-second opponent charged attack circle
        sampledTopCountdownCircleVisible = if (isPostFaintSwitchPromptActive) false else detectTopCountdownCircle(screen, w, h)
        if (sampledTopCountdownCircleVisible) {
            topCountdownCircleConfirmFrames = (topCountdownCircleConfirmFrames + 1).coerceAtMost(30)
            topCountdownCircleMissingFrames = 0
            // v4.07: 2-frame confirmation debounce before activating the top countdown state to eliminate 1-frame startup flicker
            if (topCountdownCircleConfirmFrames >= 2) {
                isTopCountdownCircleActive = true
            }
        } else {
            topCountdownCircleMissingFrames = (topCountdownCircleMissingFrames + 1).coerceAtMost(30)
            if (topCountdownCircleMissingFrames >= 3 || isPostFaintSwitchPromptActive) {
                topCountdownCircleConfirmFrames = 0
                isTopCountdownCircleActive = false
            }
        }
        detectChargedMoveButtonFillLevels(screen, w, h)

        // v3.94: Unified All-HUD-Gone & Cutscene Lockout + Multi-Frame Pokéball Debounce
        val areBottomCirclesVisible = sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300
        val areAnyHpBarsVisible = sampledPlayerHpPct in 1..100 || sampledOppHpPct in 1..100
        val areBothTopBallRacksVisible = sampledPlayerBalls in 1..3 && sampledOppBalls in 1..3
        val isChargedCutsceneHidingHud = isAttackIncomingPromptActive ||
            (pendingChargedAttackActor.isNotEmpty() && !areBottomCirclesVisible && !areAnyHpBarsVisible)
        isAllCombatHudGone = isChargedCutsceneHidingHud ||
            !areBothTopBallRacksVisible ||
            (!areBottomCirclesVisible && !areAnyHpBarsVisible && (enableHpTracking || enableEnergyTracking))

        if (isAllCombatHudGone) {
            combatHudStableFrames = 0
            combatHudGoneFrames = (combatHudGoneFrames + 1).coerceAtMost(100)
            if (playerBallCandidate in 1..2) playerBallConfirmFrames = 0
            if (oppBallCandidate in 1..2) oppBallConfirmFrames = 0
        } else {
            combatHudGoneFrames = 0
            combatHudStableFrames = (combatHudStableFrames + 1).coerceAtMost(100)

            if (sampledPlayerBalls == playerBallCandidate) {
                playerBallConfirmFrames = (playerBallConfirmFrames + 1).coerceAtMost(50)
            } else {
                playerBallCandidate = sampledPlayerBalls
                playerBallConfirmFrames = 1
            }
            val reqPlayerBallFrames = if (playerBallCandidate == 3) 2 else 4
            if (playerBallCandidate in 1..3 && playerBallConfirmFrames >= reqPlayerBallFrames && (playerBallCandidate == 3 || combatHudStableFrames >= 3)) {
                debouncedPlayerBalls = playerBallCandidate
                if (debouncedPlayerBalls in 1..2) {
                    lastObservedLowPlayerBalls = debouncedPlayerBalls
                    lastObservedLowPlayerBallsTimeMs = currentFrameTimestampMs
                } else if (debouncedPlayerBalls == 3) {
                    lastObservedLowPlayerBalls = 3
                }
            }

            if (sampledOppBalls == oppBallCandidate) {
                oppBallConfirmFrames = (oppBallConfirmFrames + 1).coerceAtMost(50)
            } else {
                oppBallCandidate = sampledOppBalls
                oppBallConfirmFrames = 1
            }
            val reqOppBallFrames = if (oppBallCandidate == 3) 2 else 4
            if (oppBallCandidate in 1..3 && oppBallConfirmFrames >= reqOppBallFrames && (oppBallCandidate == 3 || combatHudStableFrames >= 3)) {
                debouncedOppBalls = oppBallCandidate
                if (debouncedOppBalls in 1..2) {
                    lastObservedLowOppBalls = debouncedOppBalls
                    lastObservedLowOppBallsTimeMs = currentFrameTimestampMs
                } else if (debouncedOppBalls == 3) {
                    lastObservedLowOppBalls = 3
                }
            }
        }

        // Check whether to launch the asynchronous ML Kit OCR pass on this frame (accelerated to 250ms during Charged Moves or when bottom circles hide)
        val nowMs = System.currentTimeMillis()
        val areBottomCirclesHiddenInCombat = isBattleActive && !isWaitingForOpponent &&
            sampledLeftChargeBtnFillPct == -1 && sampledRightChargeBtnFillPct == -1
        val hasActiveOrRecentShieldCountdown = sampledTopCountdownCircleVisible ||
            isTopCountdownCircleActive ||
            isAttackIncomingPromptActive ||
            (lastAttackIncomingOcrDetectedMs > 0L && (nowMs - lastAttackIncomingOcrDetectedMs) <= 4800L)
        val isChargedWindowForFastOcr = pendingChargedAttackActor.isNotEmpty() ||
            hasActiveOrRecentShieldCountdown ||
            areBottomCirclesHiddenInCombat ||
            (lastChargedAttackLoggedMs > 0L && (nowMs - lastChargedAttackLoggedMs) <= 2200L)
        val targetOcrIntervalMs = if (isChargedWindowForFastOcr) 250L else 750L
        val shouldStartOcr = !isOcrInFlight && (lastOcrStartMs == 0L || (nowMs - lastOcrStartMs) >= targetOcrIntervalMs)

        // v4.05 / v4.11: Keep bottom prompt OCR (`srcMoves`, expanded to `0.53h..0.96h` to eliminate the 0.52h-0.70h blind spot!)
        // active whenever bottom charge circles are hidden in combat OR the top countdown circle / shield prompt is active!
        val isCutscenePromptWindowForOcr = areBottomCirclesHiddenInCombat ||
            hasActiveOrRecentShieldCountdown ||
            isPostFaintSwitchPromptActive
        val includeBottomMovesInOcr = !isBattleActive || isWaitingForOpponent || isCutscenePromptWindowForOcr
        if (!includeBottomMovesInOcr && cachedOcrPlayerMoveLines.isNotEmpty()) {
            cachedOcrPlayerMoveLines = emptyList()
        }

        // v4.05: Offload all OCR cropping, high-contrast white-text binarization, and composite Canvas drawing
        // off the 10Hz pixel scan thread onto Dispatchers.Default so the pixel loop stays well under 100ms!
        val screenForOcr: Bitmap? = if (shouldStartOcr) {
            try {
                screen.copy(Bitmap.Config.ARGB_8888, false)
            } catch (_: Exception) {
                null
            }
        } else null

        // Immediately advance the 100ms Pixel HUD & Sliver Latch-and-Lock + Energy State Machine
        // using the latest cached OCR lines so 0.5s GBL turns are never delayed by ML Kit OCR!
        activeFrameScreenBitmap = screen
        try {
            if (!isBattleMenuScreen(cachedOcrOppLines, cachedOcrPlayerTopLines, cachedOcrPlayerMoveLines)) {
                updateSteadyFrameBallAndShieldState()
                updateLiveHpAndChargedAttackState(
                    cachedOcrOppLines,
                    cachedOcrPlayerTopLines,
                    cachedOcrPlayerMoveLines,
                    cachedOcrMidBannerLines
                )
            }
            if (activeOneBattleDvrArmed && (isBattleActive || hasBattleStarted) && !isWaitingForOpponent) {
                recordOneBattleDvrFrameAndTraceAsync(screen, currentFrameTimestampMs)
            }
        } finally {
            activeFrameScreenBitmap = null
            screen.recycle()
        }

        // Launch asynchronous ML Kit OCR pass in background without blocking the 10Hz pixel loop
        if (screenForOcr != null) {
            isOcrInFlight = true
            lastOcrStartMs = System.currentTimeMillis()
            val capturedEpoch = frameEpoch
            val isFastCutsceneOcrMode = isCutscenePromptWindowForOcr && !isPostFaintSwitchPromptActive

            lifecycleScope.launch(Dispatchers.Default) {
                var compositeForOcr: Bitmap? = null
                try {
                    val gap = 16
                    val srcOpp = Rect(
                        (w * 0.42f).toInt().coerceIn(0, w - 1),
                        (h * 0.025f).toInt().coerceIn(0, h - 1),
                        (w * 0.98f).toInt().coerceIn(1, w),
                        (h * 0.148f).toInt().coerceIn(1, h)
                    )
                    val srcPlayer = Rect(
                        (w * 0.01f).toInt().coerceIn(0, w - 1),
                        (h * 0.025f).toInt().coerceIn(0, h - 1),
                        (w * 0.47f).toInt().coerceIn(1, w),
                        (h * 0.148f).toInt().coerceIn(1, h)
                    )
                    // v4.05: Expanded top of srcMoves from 0.70h to 0.53h during cutscenes so "Attack incoming!"
                    // and "Use a Protect Shield?" (0.58h..0.78h) are 100% captured with zero blind spot!
                    val srcMoves = Rect(
                        (w * 0.08f).toInt().coerceIn(0, w - 1),
                        (h * (if (isCutscenePromptWindowForOcr) 0.53f else 0.68f)).toInt().coerceIn(0, h - 1),
                        (w * 0.92f).toInt().coerceIn(1, w),
                        (h * 0.96f).toInt().coerceIn(1, h)
                    )
                    // v4.05: Contiguous mid-banner crop (0.08w..0.92w, 0.15h..0.53h) meeting srcMoves at 0.53h
                    val srcMidBanner = Rect(
                        (w * 0.08f).toInt().coerceIn(0, w - 1),
                        (h * 0.15f).toInt().coerceIn(0, h - 1),
                        (w * 0.92f).toInt().coerceIn(1, w),
                        (h * 0.53f).toInt().coerceIn(1, h)
                    )

                    val bwOppBitmap = createHighContrastWhiteTextBitmap(screenForOcr, srcOpp)
                    val bwPlayerBitmap = createHighContrastWhiteTextBitmap(screenForOcr, srcPlayer)
                    val bwMovesBitmap = if (includeBottomMovesInOcr) createHighContrastWhiteTextBitmap(screenForOcr, srcMoves) else null
                    val bwMidBannerBitmap = createHighContrastWhiteTextBitmap(screenForOcr, srcMidBanner)

                    // v4.05: Compact scaling (~1.3 MP total instead of 5.5 MP) so ML Kit inference finishes in <75ms!
                    val topScale = if (isFastCutsceneOcrMode) 1.0f else 1.35f
                    val movesScale = if (isFastCutsceneOcrMode) 0.85f else 0.90f
                    val midScale = 0.85f

                    val dstOppW = (srcOpp.width() * topScale).toInt().coerceAtLeast(1)
                    val dstOppH = (srcOpp.height() * topScale).toInt().coerceAtLeast(1)
                    val dstPlayerW = (srcPlayer.width() * topScale).toInt().coerceAtLeast(1)
                    val dstPlayerH = (srcPlayer.height() * topScale).toInt().coerceAtLeast(1)
                    val movesW = if (includeBottomMovesInOcr) (srcMoves.width() * movesScale).toInt().coerceAtLeast(1) else 0
                    val movesH = if (includeBottomMovesInOcr) (srcMoves.height() * movesScale).toInt().coerceAtLeast(1) else 0
                    val ocrMovesZoneH = if (includeBottomMovesInOcr) (movesH + gap + movesH) else 0
                    val dstMidW = (srcMidBanner.width() * midScale).toInt().coerceAtLeast(1)
                    val dstMidH = (srcMidBanner.height() * midScale).toInt().coerceAtLeast(1)
                    val ocrMidZoneH = dstMidH + gap + dstMidH

                    val compW = max(max(max(dstOppW, dstPlayerW), movesW), dstMidW).coerceAtLeast(100)
                    val ocrOppZoneH = dstOppH + gap + dstOppH
                    val ocrPlayerZoneH = dstPlayerH + gap + dstPlayerH
                    val ocrMovesBottomY = if (includeBottomMovesInOcr) {
                        ocrOppZoneH + gap + ocrPlayerZoneH + gap + ocrMovesZoneH
                    } else {
                        ocrOppZoneH + gap + ocrPlayerZoneH
                    }
                    val compH = ocrMovesBottomY + gap + ocrMidZoneH

                    compositeForOcr = try {
                        Bitmap.createBitmap(compW, compH, Bitmap.Config.ARGB_8888)
                    } catch (_: Exception) {
                        null
                    }

                    if (compositeForOcr != null) {
                        val canvas = Canvas(compositeForOcr)
                        canvas.drawColor(Color.BLACK)
                        val filterPaint = Paint(Paint.FILTER_BITMAP_FLAG)

                        val dstOppRaw = Rect(0, 0, dstOppW, dstOppH)
                        val dstOppBw = Rect(0, dstOppH + gap, dstOppW, ocrOppZoneH)
                        val dstPlayerRaw = Rect(0, ocrOppZoneH + gap, dstPlayerW, ocrOppZoneH + gap + dstPlayerH)
                        val dstPlayerBw = Rect(0, ocrOppZoneH + gap + dstPlayerH + gap, dstPlayerW, ocrOppZoneH + gap + ocrPlayerZoneH)
                        val dstMidBannerRaw = Rect(0, ocrMovesBottomY + gap, dstMidW, ocrMovesBottomY + gap + dstMidH)
                        val dstMidBannerBw = Rect(0, ocrMovesBottomY + gap + dstMidH + gap, dstMidW, compH)

                        canvas.drawBitmap(screenForOcr, srcOpp, dstOppRaw, filterPaint)
                        if (bwOppBitmap != null) {
                            canvas.drawBitmap(bwOppBitmap, null, dstOppBw, filterPaint)
                        }
                        canvas.drawBitmap(screenForOcr, srcPlayer, dstPlayerRaw, filterPaint)
                        if (bwPlayerBitmap != null) {
                            canvas.drawBitmap(bwPlayerBitmap, null, dstPlayerBw, filterPaint)
                        }
                        if (includeBottomMovesInOcr && movesW > 0 && movesH > 0) {
                            val movesTopY = ocrOppZoneH + gap + ocrPlayerZoneH + gap
                            val dstMovesRaw = Rect(0, movesTopY, movesW, movesTopY + movesH)
                            canvas.drawBitmap(screenForOcr, srcMoves, dstMovesRaw, filterPaint)
                            if (bwMovesBitmap != null) {
                                val dstMovesBw = Rect(0, movesTopY + movesH + gap, movesW, ocrMovesBottomY)
                                canvas.drawBitmap(bwMovesBitmap, null, dstMovesBw, filterPaint)
                            }
                        }
                        canvas.drawBitmap(screenForOcr, srcMidBanner, dstMidBannerRaw, filterPaint)
                        if (bwMidBannerBitmap != null) {
                            canvas.drawBitmap(bwMidBannerBitmap, null, dstMidBannerBw, filterPaint)
                        }
                    }
                    bwOppBitmap?.recycle()
                    bwPlayerBitmap?.recycle()
                    bwMovesBitmap?.recycle()
                    bwMidBannerBitmap?.recycle()
                    screenForOcr.recycle()

                    val ocrBmp = compositeForOcr ?: return@launch
                    val ocrLaunchMs = System.currentTimeMillis()
                    val yDivider1 = ocrOppZoneH + gap / 2
                    val yDivider2 = ocrOppZoneH + gap + ocrPlayerZoneH + gap / 2
                    val yDivider3 = if (includeBottomMovesInOcr) ocrMovesBottomY + gap / 2 else yDivider2

                    val visionText = suspendCancellableCoroutine<Text?> { cont ->
                        val input = InputImage.fromBitmap(ocrBmp, 0)
                        textRecognizer.process(input)
                            .addOnSuccessListener { result ->
                                if (cont.isActive) cont.resume(result)
                            }
                            .addOnFailureListener {
                                if (cont.isActive) cont.resume(null)
                            }
                    }
                    ocrBmp.recycle()

                    val ocrDoneMs = System.currentTimeMillis()
                    val ocrElapsedMs = (ocrDoneMs - ocrLaunchMs).coerceAtLeast(1L)
                    lastScanDurationMs = ocrElapsedMs
                    if (isBattleActive) {
                        currentBattleScanDurationSumMs += ocrElapsedMs
                        currentBattleScanCount += 1
                        lastBattleAvgScanMs = (currentBattleScanDurationSumMs / currentBattleScanCount).coerceAtLeast(1L)
                    }

                    if (visionText != null && capturedEpoch == battleResetEpoch && (ocrDoneMs - lastBattleResetTimeMs) >= 600L) {
                        val oppLines = mutableListOf<Text.Line>()
                        val playerTopLines = mutableListOf<Text.Line>()
                        val playerMoveLines = mutableListOf<Text.Line>()
                        val midBannerLines = mutableListOf<Text.Line>()

                        for (block in visionText.textBlocks) {
                            for (line in block.lines) {
                                val cy = line.boundingBox?.centerY() ?: continue
                                when {
                                    cy < yDivider1 -> oppLines.add(line)
                                    cy < yDivider2 -> playerTopLines.add(line)
                                    includeBottomMovesInOcr && cy < yDivider3 -> playerMoveLines.add(line)
                                    else -> midBannerLines.add(line)
                                }
                            }
                        }

                        withContext(Dispatchers.Main) {
                            if (capturedEpoch == battleResetEpoch) {
                                cachedOcrOppLines = oppLines
                                cachedOcrPlayerTopLines = playerTopLines
                                cachedOcrPlayerMoveLines = playerMoveLines
                                cachedOcrMidBannerLines = midBannerLines

                                if (!isBattleMenuScreen(oppLines, playerTopLines, playerMoveLines)) {
                                    handleOpponentLines(oppLines)
                                    handlePlayerSwitchLines(playerTopLines, playerMoveLines)
                                    handleMidBannerUsedMoveLines(midBannerLines)
                                    // v4.05: Immediately evaluate "Attack incoming!" OCR trigger on the Main thread upon OCR completion!
                                    updateLiveHpAndChargedAttackState(
                                        oppLines,
                                        playerTopLines,
                                        playerMoveLines,
                                        midBannerLines
                                    )
                                    // v6.03: Auto-detect End of Battle (Win / Loss / Tie) & auto-log
                                    checkAndHandleAutoEndOfBattle(
                                        oppLines,
                                        playerTopLines,
                                        playerMoveLines,
                                        midBannerLines
                                    )
                                }
                            }
                        }
                    }
                } catch (_: Exception) {
                    try {
                        if (!screenForOcr.isRecycled) screenForOcr.recycle()
                    } catch (_: Exception) {}
                    try {
                        if (compositeForOcr != null && !compositeForOcr.isRecycled) compositeForOcr.recycle()
                    } catch (_: Exception) {}
                } finally {
                    isOcrInFlight = false
                }
            }
        }
    }

    /**
     * Isolates bright white nameplate text pixels (R>=185, G>=185, B>=185, low color saturation)
     * into crisp black text on a pure white background so ML Kit reads names over bright sky/ice wings (e.g. Kyurem).
     */

    /**
     * v3.41: Scales a 100%-HP baseline Battle Rating (150..850) by the live or persisted
     * HP% ratio between the user's slot and the opponent's slot.
     */
    internal fun scaleBrByHpRatio(baseBr: Int, userHpPct: Int, oppHpPct: Int): Int {
        if (userHpPct <= 0) return 150
        if (oppHpPct <= 0) return 850
        val u = max(6.0, min(100.0, userHpPct.toDouble()))
        val o = max(6.0, min(100.0, oppHpPct.toDouble()))
        if (kotlin.math.abs(u - o) <= 3.0) return baseBr
        val delta = (225.0 * kotlin.math.ln(u / o)).roundToInt()
        return (baseBr + delta).coerceIn(150, 850)
    }

    /**
     * v3.40: Conservative unshielded Charged Move attribution.
     * Returns a specific move name ONLY when the attack was unshielded AND the observed HP% drop
     * is within ±8% of exactly one candidate move with >=12% separation from any other move.
     */
    internal fun inferUnshieldedChargedMoveName(
        hpDeltaPct: Int,
        candidateMoves: List<Pair<String, Int>>
    ): String? {
        if (hpDeltaPct <= 4 || candidateMoves.isEmpty()) return null
        val sorted = candidateMoves
            .filter { it.first.isNotBlank() && it.second > 0 }
            .distinctBy { it.first.lowercase() }
            .map { Triple(it.first, it.second, kotlin.math.abs(hpDeltaPct - it.second)) }
            .sortedBy { it.third }
        if (sorted.isEmpty()) return null
        val best = sorted[0]
        if (best.third > 8) return null
        if (sorted.size >= 2) {
            val second = sorted[1]
            if (kotlin.math.abs(second.third - best.third) < 12) return null
        }
        return best.first
    }

    /**
     * v3.80: Best-guess unshielded Charged Move attribution when Banner OCR fails to read "<Pokemon> used <Move>!".
     * Picks the closest expected-damage move within ±16% so energy depletion matches the most likely thrown move.
     */
    internal fun inferBestGuessChargedMoveByHp(
        hpDeltaPct: Int,
        candidateMoves: List<Pair<String, Int>>
    ): String? {
        if (hpDeltaPct <= 3 || candidateMoves.isEmpty()) return null
        val sorted = candidateMoves
            .filter { it.first.isNotBlank() && it.second > 0 }
            .distinctBy { it.first.lowercase() }
            .map { Triple(it.first, it.second, kotlin.math.abs(hpDeltaPct - it.second)) }
            .sortedBy { it.third }
        val best = sorted.firstOrNull() ?: return null
        return if (best.third <= 16) best.first else null
    }

    /**
     * v3.92: Locks fainted opponent attribution to the pre-KO active opponent slot and cross-checks
     * against the lowest recorded HP history (including pre-big-jump HP before incoming Pokémon 100% bars)
     * so post-KO replacements or manual swaps/catches are never misclassified as fainted.
     */
    internal fun resolveFaintedOpponentSlotIdx(
        excludeActiveSlot: Int,
        preferredPreKoSlot: Int,
        nowMs: Long = System.currentTimeMillis(),
        ignoreExistingFaintedFlags: Boolean = false
    ): Int {
        val knownSlots = max(1, min(3, detectedOpponents.size))
        val candidateSlots = (0 until knownSlots).filter { idx ->
            idx != excludeActiveSlot && (ignoreExistingFaintedFlags || !oppFaintedSlots[idx] || idx == preferredPreKoSlot)
        }
        if (candidateSlots.isEmpty()) {
            return preferredPreKoSlot.takeIf { it in 0..2 && it != excludeActiveSlot } ?: -1
        }

        fun effectiveLowestHpForSlot(slotIdx: Int): Int {
            val preJumpHp = if ((nowMs - oppSlotLastBigJumpMs[slotIdx]) <= 3500L && oppSlotPriorHpPct[slotIdx] in 1..100) {
                oppSlotPriorHpPct[slotIdx]
            } else {
                100
            }
            val curHp = oppSlotHpPct[slotIdx].takeIf { it in 1..100 } ?: 100
            val confHp = confirmedOppSlotHpPct[slotIdx].takeIf { it in 1..100 } ?: 100
            val preFaintHp = oppSlotPreFaintHpPct[slotIdx].takeIf { it in 1..100 } ?: 100
            val lowestHistHp = oppSlotLowestHpPct[slotIdx].takeIf { it in 1..100 } ?: 100
            return minOf(preJumpHp, curHp, confHp, preFaintHp, lowestHistHp)
        }

        val lowestHpCandidate = candidateSlots.minByOrNull { effectiveLowestHpForSlot(it) }
        if (preferredPreKoSlot in candidateSlots) {
            val prefLowHp = effectiveLowestHpForSlot(preferredPreKoSlot)
            if (lowestHpCandidate != null && lowestHpCandidate != preferredPreKoSlot) {
                val bestLowHp = effectiveLowestHpForSlot(lowestHpCandidate)
                // If preferredPreKoSlot was overwritten by a rapid swap/OCR blip and still has high HP (>= 65%)
                // while another non-active slot dropped to critical HP (<= 28%) with >= 35% lower HP, pick that slot
                if (prefLowHp >= 65 && bestLowHp <= 28 && (prefLowHp - bestLowHp) >= 35) {
                    return lowestHpCandidate
                }
            }
            return preferredPreKoSlot
        }

        return lowestHpCandidate ?: preferredPreKoSlot.takeIf { it in 0..2 && it != excludeActiveSlot } ?: -1
    }

    /**
     * v3.80/v3.93: Parses the mid-screen translucent banner ("<Pokemon> used <Move>!", calibrated from screenshots
     * e.g. "Flareon used Fire Blast!" / "U1Tinkaton+ used Bulldoze!"), matches <Pokemon> against known opponent slots
     * and the pre-charge attacker slot (`pendingChargedAttackOppSlotIdx` / `lastOppChargedAttackerSlotIdx`), and falls back
     * to the pre-charge active opponent slot when <Pokemon> is garbled or clipped by OCR.
     */
    internal fun handleMidBannerUsedMoveLines(midBannerLines: List<Text.Line>) {
        if (midBannerLines.isEmpty()) return
        val nowMs = System.currentTimeMillis()
        val preset = currentPreset
        val activeLeague = preset?.league ?: "MASTER LEAGUE"
        val activeUserIdx = (preset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
        val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val activeOppIdx = if (detectedOpponents.isNotEmpty()) {
            detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOppBase, ignoreCase = true)
            }.let { if (it in 0..2) it else 0 }
        } else 0

        val preChargeUserIdx = pendingChargedAttackUserSlotIdx.takeIf { it in 0..2 } ?: activeUserIdx
        val userSlotCfg = preset?.pokemon?.getOrNull(preChargeUserIdx) ?: preset?.pokemon?.getOrNull(activeUserIdx)
        val userMonName = userSlotCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
        val userMeta = getPokemonMeta(userMonName, activeLeague, userMonName.contains("Shadow", ignoreCase = true))

        val userMove1Name = userSlotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
        val userMove2Name = userSlotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2
        val userPlusMoveName = OverlayService.resolveMegaPlusMoveStatic(userMeta.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(userMonName, activeLeague)
        val userCandidateMoves = listOfNotNull(userMove1Name, userMove2Name, userPlusMoveName).filter { it.isNotBlank() }.distinct()

        fun buildOppPoolForName(rawName: String, isShad: Boolean): Pair<PokemonMeta, List<String>>? {
            if (rawName.isBlank() || rawName.equals("Waiting...", ignoreCase = true)) return null
            val meta = getPokemonMeta(rawName, activeLeague, isShad)
            val pool = OverlayService.getAvailableMovePoolForSpeciesStatic(meta.name, activeLeague).second
            val oppPlus = OverlayService.resolveMegaPlusMoveStatic(meta.name, activeLeague)
                ?: OverlayService.resolveMegaPlusMoveStatic(rawName, activeLeague)
            val third = meta.chargedMove3.takeIf { it.isNotBlank() }
                ?: COMMON_THIRD_CHARGED_MOVE[meta.name]
                ?: ""
            val moves = (listOfNotNull(oppPlus, meta.chargedMove1, meta.chargedMove2, third, meta.chargedMove4) + pool)
                .filter { it.isNotBlank() }
                .distinct()
            return meta to moves
        }

        // Shield-Prompt Gate: Who throws charged attacks is strictly gated by whether there was a shield prompt
        // ("Attack incoming! Use a Protect Shield?" / "NOT NOW" / "No Protect Shields remaining!") before the attack!
        val hasRecentShieldPrompt = isAttackIncomingPromptActive ||
            pendingChargedAttackActor == "opp" ||
            (hadShieldPromptBeforeCurrentCharge && (nowMs - lastChargedPromptTimeMs) <= 10000L) ||
            (lastChargedPromptActor == "opp" && (nowMs - lastChargedPromptTimeMs) <= 10000L)

        val hasRecentUserPrompt = pendingChargedAttackActor == "user" ||
            (!hadShieldPromptBeforeCurrentCharge && lastChargedPromptActor == "user" && (nowMs - lastChargedPromptTimeMs) <= 10000L)

        val fallbackPreChargeOppIdx = when {
            pendingChargedAttackActor == "opp" && pendingChargedAttackOppSlotIdx in 0..2 -> pendingChargedAttackOppSlotIdx
            lastChargedPromptActor == "opp" && (nowMs - lastChargedPromptTimeMs) <= 10000L && lastOppChargedAttackerSlotIdx in 0..2 -> lastOppChargedAttackerSlotIdx
            lastNormalCombatOppSlotIdx in 0..2 -> lastNormalCombatOppSlotIdx
            else -> activeOppIdx
        }
        val fallbackPreChargeOppRawName = detectedOpponents.getOrNull(fallbackPreChargeOppIdx)
            ?: (if (pendingChargedAttackActor == "opp") pendingChargedAttackOppRawName else lastOppChargedAttackerRawName).takeIf { it.isNotBlank() }
            ?: lastNormalCombatOppRawName.takeIf { it.isNotBlank() }
            ?: activeOpponentName
        val fallbackPreChargeOppBase = FormResolver.extractBaseSpecies(fallbackPreChargeOppRawName).lowercase()
        val fallbackPreChargeOppShadow = manualShadowOverrides[fallbackPreChargeOppBase]
            ?: if (pendingChargedAttackActor == "opp") pendingChargedAttackOppShadow else lastOppChargedAttackerShadow

        val usedRegex = Regex("(?i)(?:(.+?)\\s+)?used\\s+([a-zA-Z0-9'\\s-+]+?)[!.?]*$")
        for (line in midBannerLines) {
            val raw = line.text.trim()
            if (raw.length < 6) continue
            val normBannerLine = normalizeOcrToken(raw)
            val isDisguiseBustedLine = normBannerLine.contains("disguise") || normBannerLine.contains("busted")
            val isBlockedBannerLine = normBannerLine.contains("blocked") ||
                normBannerLine.contains("biocked") ||
                normBannerLine.contains("bl0cked") ||
                raw.contains("BLOCKED", ignoreCase = true) ||
                raw.contains("BLOÇKED", ignoreCase = true)
            if (isDisguiseBustedLine) {
                lastDetectedDisguiseBustedBannerMs = nowMs
                lastDetectedBlockedBannerMs = nowMs
            } else if (isBlockedBannerLine) {
                lastDetectedBlockedBannerMs = nowMs
            }
            if ((isBlockedBannerLine || isDisguiseBustedLine) &&
                pendingChargedAttackActor.isEmpty() &&
                lastChargedAttackLoggedMs > 0L &&
                (nowMs - lastChargedAttackLoggedMs) <= 4500L
            ) {
                val recentChargeIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" }
                if (recentChargeIdx >= 0) {
                    val prevEv = battleTimelineEvents[recentChargeIdx]
                    val wasDisguise = isDisguiseBustedLine ||
                        (nowMs - lastDetectedDisguiseBustedBannerMs) <= 5000L ||
                        (prevEv.actor == "user" && activeOpponentName.contains("Mimikyu", ignoreCase = true)) ||
                        (prevEv.actor == "opp" && (activeUserPokemonName ?: "").contains("Mimikyu", ignoreCase = true))
                    val activeChargeRef = lastChargedAttackLoggedMs
                    var updatedUserShields = playerShieldsRemaining
                    var updatedOppShields = oppShieldsRemaining
                    if (!wasDisguise) {
                        if (prevEv.actor == "opp" && prevEv.shielded != true && playerShieldsRemaining > 0 && lastPlayerShieldDecrementChargeStartMs != activeChargeRef) {
                            updatedUserShields = (playerShieldsRemaining - 1).coerceIn(0, 2)
                            val shieldNum = (2 - updatedUserShields).coerceIn(1, 2)
                            val defMon = prevEv.pokemonShielded ?: activeUserPokemonName ?: ""
                            battleTimelineEvents.add(
                                BattleTimelineEvent(
                                    type = "SHIELD",
                                    actor = "user",
                                    t = prevEv.t,
                                    shieldNumber = shieldNum,
                                    activePokemon = defMon.ifEmpty { null },
                                    pokemonShielded = defMon.ifEmpty { null },
                                    userShieldsRemaining = updatedUserShields,
                                    oppShieldsRemaining = oppShieldsRemaining
                                )
                            )
                            playerShieldsRemaining = updatedUserShields
                            lastPlayerShieldDecrementChargeStartMs = activeChargeRef
                        } else if (prevEv.actor == "user" && prevEv.shielded != true && oppShieldsRemaining > 0 && lastOppShieldDecrementChargeStartMs != activeChargeRef) {
                            updatedOppShields = (oppShieldsRemaining - 1).coerceIn(0, 2)
                            val shieldNum = (2 - updatedOppShields).coerceIn(1, 2)
                            val defMon = prevEv.pokemonShielded ?: formatOpponentNameWithShadow(activeOpponentName)
                            battleTimelineEvents.add(
                                BattleTimelineEvent(
                                    type = "SHIELD",
                                    actor = "opp",
                                    t = prevEv.t,
                                    shieldNumber = shieldNum,
                                    activePokemon = defMon.ifEmpty { null },
                                    pokemonShielded = defMon.ifEmpty { null },
                                    userShieldsRemaining = playerShieldsRemaining,
                                    oppShieldsRemaining = updatedOppShields
                                )
                            )
                            oppShieldsRemaining = updatedOppShields
                            lastOppShieldDecrementChargeStartMs = activeChargeRef
                        }
                    }
                    if (prevEv.shielded != true) {
                        val targetIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" }
                        if (targetIdx >= 0) {
                            val hpBef = (prevEv.hpBeforePct ?: 100).coerceIn(1, 100)
                            battleTimelineEvents[targetIdx] = battleTimelineEvents[targetIdx].copy(
                                shielded = true,
                                hpAfterPct = max(1, hpBef - 1),
                                hpDeltaPct = 1,
                                userShieldsRemaining = updatedUserShields,
                                oppShieldsRemaining = updatedOppShields
                            )
                            recalculateAndPushBattleData()
                        }
                    }
                }
            }
            if (raw.length < 7) continue
            val m = usedRegex.find(raw) ?: continue
            val rawActorPart = m.groupValues[1].trim()
            val rawMovePart = m.groupValues[2].trim()
            if (rawMovePart.length < 3) continue
            val normMove = normalizeOcrToken(rawMovePart)
            if (normMove.length < 3) continue
            val normActor = normalizeOcrToken(rawActorPart)

            fun matchBestMove(pool: List<String>): Pair<String, Int>? {
                var bestName = ""
                var bestDist = Int.MAX_VALUE
                for (cand in pool) {
                    val cNorm = normalizeOcrToken(cand)
                    if (cNorm.isEmpty()) continue
                    if (cNorm == normMove || normMove.contains(cNorm) || (normMove.length >= 4 && cNorm.contains(normMove))) {
                        return cand to 0
                    }
                    val d = levenshteinDistance(normMove, cNorm)
                    val maxAllowed = if (cNorm.length >= 8) 3 else 2
                    if (d <= maxAllowed && d < bestDist) {
                        bestDist = d
                        bestName = cand
                    }
                }
                return if (bestName.isNotEmpty()) bestName to bestDist else null
            }

            // v6.02: Match <name> in "<name> used <move>!" against known opponent slots (0..2), unseen species in the database
            // (when opponent swaps into an unseen Pokémon and immediately throws before top-right nameplate OCR runs),
            // AND all 3 user team slots (0..2) (when player swaps and immediately throws)!
            var matchedOppSlotByActor = -1
            var bestActorDist = Int.MAX_VALUE
            if (normActor.length >= 3) {
                for (slotIdx in 0 until min(3, detectedOpponents.size)) {
                    val slotName = detectedOpponents[slotIdx]
                    val slotBaseNorm = normalizeOcrToken(FormResolver.extractBaseSpecies(slotName))
                    if (slotBaseNorm.length < 3) continue
                    val isSubstringMatch = normActor == slotBaseNorm ||
                        normActor.contains(slotBaseNorm) ||
                        (normActor.length >= 4 && slotBaseNorm.contains(normActor))
                    if (isSubstringMatch) {
                        if (matchedOppSlotByActor == -1 || slotIdx == fallbackPreChargeOppIdx) {
                            matchedOppSlotByActor = slotIdx
                            bestActorDist = 0
                        }
                    } else {
                        val d = levenshteinDistance(normActor, slotBaseNorm)
                        val maxAllowed = if (slotBaseNorm.length >= 7) 2 else 1
                        if (d <= maxAllowed && d < bestActorDist) {
                            bestActorDist = d
                            matchedOppSlotByActor = slotIdx
                        }
                    }
                }
                if (matchedOppSlotByActor == -1 && fallbackPreChargeOppRawName.isNotBlank()) {
                    val preBaseNorm = normalizeOcrToken(FormResolver.extractBaseSpecies(fallbackPreChargeOppRawName))
                    if (preBaseNorm.length >= 3 && (normActor.contains(preBaseNorm) || (normActor.length >= 4 && preBaseNorm.contains(normActor)) || levenshteinDistance(normActor, preBaseNorm) <= 2)) {
                        matchedOppSlotByActor = fallbackPreChargeOppIdx
                    }
                }
                // v6.02: If opponent swapped into an UNSEEN 2nd/3rd Pokémon and immediately threw a charged move,
                // resolve <Pokemon> from the global Pokémon database and auto-register it into detectedOpponents!
                if (matchedOppSlotByActor == -1 && normActor.length >= 4 && detectedOpponents.size < 3 && !isWaitingForOpponent) {
                    val isUserTeamActor = preset?.pokemon?.any { uMon ->
                        val uBase = normalizeOcrToken(FormResolver.extractBaseSpecies(uMon.name))
                        uBase.length >= 3 && (normActor == uBase || normActor.contains(uBase) || levenshteinDistance(normActor, uBase) <= 1)
                    } == true
                    if (!isUserTeamActor) {
                        val dbMatched = findPokemonInText(rawActorPart)
                        if (dbMatched != null) {
                            val candPool = buildOppPoolForName(dbMatched.name, false)
                            if (candPool != null && matchBestMove(candPool.second) != null) {
                                upsertDetectedOpponentBySpecies(dbMatched.name, dbMatched.baseSpecies)
                                val newIdx = detectedOpponents.indexOfFirst {
                                    FormResolver.extractBaseSpecies(it).equals(dbMatched.baseSpecies, ignoreCase = true)
                                }
                                if (newIdx in 0..2) {
                                    matchedOppSlotByActor = newIdx
                                }
                            }
                        }
                    }
                }
            }

            // Match <name> against all 3 user team slots (0..2) so a player swap-and-immediate-throw resolves the incoming user slot!
            var matchedUserSlotByActor = -1
            var bestUserActorDist = Int.MAX_VALUE
            if (normActor.length >= 3 && preset != null) {
                for (uIdx in 0 until min(3, preset.pokemon.size)) {
                    val uBaseNorm = normalizeOcrToken(FormResolver.extractBaseSpecies(preset.pokemon[uIdx].name))
                    if (uBaseNorm.length < 3) continue
                    val isSub = normActor == uBaseNorm ||
                        normActor.contains(uBaseNorm) ||
                        (normActor.length >= 4 && uBaseNorm.contains(normActor))
                    if (isSub) {
                        if (matchedUserSlotByActor == -1 || uIdx == preChargeUserIdx) {
                            matchedUserSlotByActor = uIdx
                            bestUserActorDist = 0
                        }
                    } else {
                        val d = levenshteinDistance(normActor, uBaseNorm)
                        val maxAllowed = if (uBaseNorm.length >= 7) 2 else 1
                        if (d <= maxAllowed && d < bestUserActorDist) {
                            bestUserActorDist = d
                            matchedUserSlotByActor = uIdx
                        }
                    }
                }
            }

            // Two-stage opponent move resolution:
            // 1. If <name> matched an opponent slot, test that slot's move pool first.
            // 2. If <name> was garbled/missing OR did not match a move on that slot, test all known opponent slots, then fall back to the pre-charge active opponent slot!
            var resolvedOppSlotIdx = if (matchedOppSlotByActor in 0..2) matchedOppSlotByActor else fallbackPreChargeOppIdx
            var oppMeta: PokemonMeta? = null
            var oppMatched: Pair<String, Int>? = null

            if (matchedOppSlotByActor in 0..2 && !isWaitingForOpponent) {
                val candRawName = detectedOpponents.getOrNull(matchedOppSlotByActor) ?: fallbackPreChargeOppRawName
                val candBase = FormResolver.extractBaseSpecies(candRawName).lowercase()
                val candShadow = manualShadowOverrides[candBase] ?: fallbackPreChargeOppShadow
                val candMetaAndPool = buildOppPoolForName(candRawName, candShadow)
                if (candMetaAndPool != null) {
                    val candMatch = matchBestMove(candMetaAndPool.second)
                    if (candMatch != null) {
                        resolvedOppSlotIdx = matchedOppSlotByActor
                        oppMeta = candMetaAndPool.first
                        oppMatched = candMatch
                    }
                }
            }

            if (oppMatched == null && !isWaitingForOpponent && fallbackPreChargeOppRawName != "Waiting...") {
                val preMetaAndPool = buildOppPoolForName(fallbackPreChargeOppRawName, fallbackPreChargeOppShadow)
                if (preMetaAndPool != null) {
                    val preMatch = matchBestMove(preMetaAndPool.second)
                    if (preMatch != null) {
                        resolvedOppSlotIdx = fallbackPreChargeOppIdx
                        oppMeta = preMetaAndPool.first
                        oppMatched = preMatch
                    } else if (oppMeta == null) {
                        oppMeta = preMetaAndPool.first
                    }
                }
            }

            // v6.02: If the move still didn't match the pre-charge opponent slot (e.g. <Pokemon> was clipped by OCR during a swap-and-throw),
            // check the other known opponent bench slots to see if one of them uniquely owns the banner move!
            if (oppMatched == null && !isWaitingForOpponent && detectedOpponents.size > 1) {
                for (benchIdx in 0 until min(3, detectedOpponents.size)) {
                    if (benchIdx == fallbackPreChargeOppIdx) continue
                    val bRaw = detectedOpponents[benchIdx]
                    val bBase = FormResolver.extractBaseSpecies(bRaw).lowercase()
                    val bShad = manualShadowOverrides[bBase] ?: false
                    val bMetaAndPool = buildOppPoolForName(bRaw, bShad) ?: continue
                    val bMatch = matchBestMove(bMetaAndPool.second)
                    if (bMatch != null && bMatch.second <= 1) {
                        resolvedOppSlotIdx = benchIdx
                        oppMeta = bMetaAndPool.first
                        oppMatched = bMatch
                        matchedOppSlotByActor = benchIdx
                        break
                    }
                }
            }

            // Two-stage player move resolution across all 3 user team slots (0..2)
            var resolvedUserSlotIdx = if (matchedUserSlotByActor in 0..2) matchedUserSlotByActor else preChargeUserIdx
            var userMatched: Pair<String, Int>? = null
            if (matchedUserSlotByActor in 0..2 && preset != null) {
                val candSlotCfg = preset.pokemon.getOrNull(matchedUserSlotByActor)
                val candName = candSlotCfg?.name ?: userMonName
                val candMeta = getPokemonMeta(candName, activeLeague, candName.contains("Shadow", ignoreCase = true))
                val c1 = candSlotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: candMeta.chargedMove1
                val c2 = candSlotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: candMeta.chargedMove2
                val candMoves = listOfNotNull(c1, c2).filter { it.isNotBlank() }.distinct()
                val mMatch = matchBestMove(candMoves)
                if (mMatch != null) {
                    resolvedUserSlotIdx = matchedUserSlotByActor
                    userMatched = mMatch
                }
            }
            if (userMatched == null) {
                val activeMatch = matchBestMove(userCandidateMoves)
                if (activeMatch != null) {
                    resolvedUserSlotIdx = preChargeUserIdx
                    userMatched = activeMatch
                } else if (preset != null) {
                    for (uIdx in 0 until min(3, preset.pokemon.size)) {
                        if (uIdx == preChargeUserIdx) continue
                        val bSlot = preset.pokemon[uIdx]
                        val bMeta = getPokemonMeta(bSlot.name, activeLeague, bSlot.name.contains("Shadow", ignoreCase = true))
                        val bc1 = bSlot.chargedMove1.takeIf { it.isNotBlank() } ?: bMeta.chargedMove1
                        val bc2 = bSlot.chargedMove2.takeIf { it.isNotBlank() } ?: bMeta.chargedMove2
                        val bMatch = matchBestMove(listOfNotNull(bc1, bc2).filter { it.isNotBlank() }.distinct())
                        if (bMatch != null && bMatch.second <= 1) {
                            resolvedUserSlotIdx = uIdx
                            userMatched = bMatch
                            matchedUserSlotByActor = uIdx
                            break
                        }
                    }
                }
            }

            val oppBaseNorm = if (oppMeta != null) normalizeOcrToken(oppMeta.baseSpecies) else ""
            val resolvedUserMonName = preset?.pokemon?.getOrNull(resolvedUserSlotIdx)?.name ?: userMonName
            val userBaseNorm = normalizeOcrToken(FormResolver.extractBaseSpecies(resolvedUserMonName))
            val isSpeciesOnUserTeam = oppBaseNorm.isNotEmpty() && (
                oppBaseNorm == userBaseNorm ||
                preset?.pokemon?.any { normalizeOcrToken(FormResolver.extractBaseSpecies(it.name)) == oppBaseNorm } == true
            )
            val isMirrorMatch = oppBaseNorm.isNotEmpty() && (oppBaseNorm == userBaseNorm || isSpeciesOnUserTeam)

            // v4.03: Prioritize shield-prompt / minigame state FIRST so mirror matchups (e.g. Dialga vs Dialga, Tinkaton vs Tinkaton)
            // NEVER use "<Pokemon> used <Move>!" species name to guess who threw the charged attack!
            val actorHint = when {
                hasRecentShieldPrompt -> "opp"
                hasRecentUserPrompt -> "user"
                !isMirrorMatch && matchedOppSlotByActor in 0..2 -> "opp"
                !isMirrorMatch && (matchedUserSlotByActor in 0..2 || (userBaseNorm.length >= 3 && normActor.contains(userBaseNorm))) -> "user"
                else -> ""
            }

            val resolvedPair: Pair<String, String>? = when (actorHint) {
                "opp" -> if (oppMatched != null) "opp" to oppMatched.first else null
                "user" -> if (userMatched != null) "user" to userMatched.first else null
                else -> {
                    if (isMirrorMatch) {
                        // In mirror matchups, "<Pokemon> used <Move>!" cannot determine who threw the charged move;
                        // actor attribution must come strictly from the pre-move cutscene state.
                        null
                    } else {
                        when {
                            oppMatched != null && (userMatched == null || oppMatched.second < userMatched.second) && matchedOppSlotByActor in 0..2 -> "opp" to oppMatched.first
                            userMatched != null -> "user" to userMatched.first
                            oppMatched != null && matchedOppSlotByActor in 0..2 -> "opp" to oppMatched.first
                            else -> null
                        }
                    }
                }
            }

            if (resolvedPair != null) {
                val (actorRole, rawMatchedMoveName) = resolvedPair
                // v4.01: Canonicalize opponent move name against the slot's 4 displayed moves so confirmedOppChargedMoves badge matching is 100% exact
                val moveName = if (actorRole == "opp" && oppMeta != null) {
                    val third = oppMeta.chargedMove3.takeIf { it.isNotBlank() }
                        ?: COMMON_THIRD_CHARGED_MOVE[oppMeta.name]
                        ?: ""
                    val displayedFour = listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, third, oppMeta.chargedMove4).filter { it.isNotBlank() }
                    val normRaw = normalizeOcrToken(rawMatchedMoveName)
                    displayedFour.firstOrNull { normalizeOcrToken(it) == normRaw } ?: rawMatchedMoveName
                } else {
                    rawMatchedMoveName
                }

                lastDetectedBannerMoveActor = actorRole
                lastDetectedBannerMoveName = moveName
                lastDetectedBannerMoveTimeMs = nowMs
                if (actorRole == "opp") {
                    lastDetectedBannerMoveOppSlotIdx = resolvedOppSlotIdx
                    // v6.02: If the banner proved a DIFFERENT opponent slot threw the move than the provisional pre-charge slot,
                    // refund the provisional deduction on the old slot and switch pendingChargedAttackOppSlotIdx to resolvedOppSlotIdx!
                    if (pendingChargedAttackActor == "opp" &&
                        pendingChargedAttackOppSlotIdx in 0..2 &&
                        resolvedOppSlotIdx in 0..2 &&
                        resolvedOppSlotIdx != pendingChargedAttackOppSlotIdx
                    ) {
                        val oldSlot = pendingChargedAttackOppSlotIdx
                        if (pendingChargedAttackDeductedEnergy > 0) {
                            oppSlotEnergy[oldSlot] = (oppSlotEnergy[oldSlot] + pendingChargedAttackDeductedEnergy).coerceIn(0, 100)
                        }
                        val mStatsSwap = OverlayService.resolveChargedMoveStatsStatic(moveName, oppMeta?.types?.firstOrNull() ?: "normal")
                        val swapMoveCost = (mStatsSwap.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 45).coerceIn(35, 100)
                        val newPreE = max(oppSlotEnergy[resolvedOppSlotIdx], swapMoveCost).coerceIn(swapMoveCost, 100)
                        pendingChargedAttackPreOppEnergy = newPreE
                        oppSlotEnergy[resolvedOppSlotIdx] = (newPreE - swapMoveCost).coerceIn(0, 100)
                        pendingChargedAttackDeductedEnergy = swapMoveCost
                        pendingChargedAttackOppSlotIdx = resolvedOppSlotIdx
                        pendingChargedAttackOppRawName = detectedOpponents.getOrNull(resolvedOppSlotIdx) ?: oppMeta?.name ?: activeOpponentName
                        pendingChargedAttackAttackerName = formatOpponentNameWithShadow(pendingChargedAttackOppRawName)
                        lastOppChargedAttackerSlotIdx = resolvedOppSlotIdx
                        lastOppChargedAttackerRawName = pendingChargedAttackOppRawName
                    }
                } else if (actorRole == "user") {
                    lastDetectedBannerMoveUserSlotIdx = resolvedUserSlotIdx
                }

                // v4.02: Mark confirmed opponent charged move on `resolvedOppSlotIdx` (both shielded & unshielded, even if Section 4 reconciled first)
                // If Section 4 had previously guessed a different move via HP delta (`lastOppChargeHpInferredMoveName`), replace it with the OCR-confirmed banner move!
                if (actorRole == "opp" && (hasRecentShieldPrompt || matchedOppSlotByActor in 0..2) && resolvedOppSlotIdx in 0..2) {
                    var updatedRetroactive = false
                    if ((nowMs - lastChargedAttackLoggedMs) <= 4500L &&
                        lastChargedPromptActor == "opp" &&
                        lastOppChargeHpInferredMoveName.isNotEmpty() &&
                        !lastOppChargeHpInferredMoveName.equals(moveName, ignoreCase = true)
                    ) {
                        if (confirmedOppChargedMoves[resolvedOppSlotIdx].remove(lastOppChargeHpInferredMoveName)) {
                            updatedRetroactive = true
                        }
                        lastOppChargeHpInferredMoveName = ""
                    }
                    val added = confirmedOppChargedMoves[resolvedOppSlotIdx].add(moveName)
                    if (pendingChargedAttackActor.isEmpty() && (nowMs - lastChargedAttackLoggedMs) <= 4500L && lastChargedPromptActor == "opp") {
                        val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, oppMeta?.types?.firstOrNull() ?: "normal")
                        val trueCost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50).coerceIn(35, 100)
                        val oppFastNameRetro = detectedOppFastMoveOverride[resolvedOppSlotIdx]?.takeIf { it.isNotBlank() }
                            ?: oppMeta?.defaultFastMove ?: "Tackle"
                        val oppFastTurnsRetro = OverlayService.resolveFastTurnsStatic(oppFastNameRetro, oppMeta?.fastTurns ?: 2).coerceIn(1, 5)
                        val oppFastERetro = OverlayService.resolveFastEnergyStatic(oppFastNameRetro, oppFastTurnsRetro).coerceIn(2, 20)
                        val lastOppEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "opp" }
                        // v6.06: Recompute expectedMoveDmgPct when BANNER_OCR retroactively confirms moveName
                        val retroAttackerRaw = detectedOpponents.getOrNull(resolvedOppSlotIdx) ?: oppMeta?.name ?: activeOpponentName
                        val retroAttackerBase = FormResolver.extractBaseSpecies(retroAttackerRaw).lowercase()
                        val retroAttackerShad = manualShadowOverrides[retroAttackerBase] ?: isOpponentShadow
                        val retroAttackerMeta = OverlayService.computeEffectiveCombatStats(
                            oppMeta ?: getPokemonMeta(retroAttackerRaw, activeLeague, retroAttackerShad),
                            activeLeague,
                            oppSlotCp.getOrNull(resolvedOppSlotIdx)?.takeIf { it > 0 }
                        )
                        val retroDefUserIdx = resolvedUserSlotIdx.coerceIn(0, 2)
                        val retroDefCfg = preset?.pokemon?.getOrNull(retroDefUserIdx)
                        val retroDefName = retroDefCfg?.name ?: resolvedUserMonName
                        val retroDefShad = retroDefName.contains("Shadow", ignoreCase = true)
                        val retroDefMeta = OverlayService.computeEffectiveCombatStats(
                            getPokemonMeta(retroDefName, activeLeague, retroDefShad),
                            activeLeague,
                            retroDefCfg?.cp,
                            retroDefCfg?.ivs
                        )
                        val retroExpectedDmgPct = calculateChargedMoveDamagePercent(
                            attacker = retroAttackerMeta,
                            defender = retroDefMeta,
                            moveName = moveName,
                            isAttackerShadow = retroAttackerShad,
                            isDefenderShadow = retroDefShad
                        )
                        // v6.02: If late banner OCR also reveals a different opponent slot threw the move than lastOppChargedAttackerSlotIdx,
                        // refund the old slot and deduct from resolvedOppSlotIdx!
                        if (lastOppChargedAttackerSlotIdx in 0..2 && lastOppChargedAttackerSlotIdx != resolvedOppSlotIdx && lastOppChargeDeductedEnergySnapshot > 0) {
                            val oldIdx = lastOppChargedAttackerSlotIdx
                            oppSlotEnergy[oldIdx] = (oppSlotEnergy[oldIdx] + lastOppChargeDeductedEnergySnapshot).coerceIn(0, 100)
                            if (lastOppChargeHpInferredMoveName.isNotEmpty()) {
                                confirmedOppChargedMoves[oldIdx].remove(lastOppChargeHpInferredMoveName)
                            }
                            val newPreE = max(oppSlotEnergy[resolvedOppSlotIdx], trueCost).coerceIn(trueCost, 100)
                            oppSlotEnergy[resolvedOppSlotIdx] = (newPreE - trueCost).coerceIn(0, 100)
                            lastOppChargeDeductedEnergySnapshot = trueCost
                            lastOppChargedAttackerSlotIdx = resolvedOppSlotIdx
                            lastOppChargedAttackerRawName = detectedOpponents.getOrNull(resolvedOppSlotIdx) ?: oppMeta?.name ?: activeOpponentName
                            if (lastOppEvIdx >= 0) {
                                val prevEv = battleTimelineEvents[lastOppEvIdx]
                                battleTimelineEvents[lastOppEvIdx] = prevEv.copy(
                                    activePokemon = formatOpponentNameWithShadow(lastOppChargedAttackerRawName),
                                    inferredMoveName = moveName,
                                    oppEnergy = oppSlotEnergy[resolvedOppSlotIdx],
                                    preThrowEnergy = newPreE,
                                    requiredMoveEnergy = trueCost,
                                    energyDeficit = 0,
                                    expectedMoveDmgPct = retroExpectedDmgPct,
                                    moveResolutionSource = "BANNER_OCR"
                                )
                            }
                            updatedRetroactive = true
                        } else {
                            val prevPreE = if (lastOppEvIdx >= 0) battleTimelineEvents[lastOppEvIdx].preThrowEnergy else null
                            val inFlightBonusE = if (prevPreE != null && trueCost > prevPreE && (trueCost - prevPreE) <= oppFastERetro) {
                                oppFastERetro
                            } else 0
                            val diff = trueCost - lastOppChargeDeductedEnergySnapshot - inFlightBonusE
                            if (diff != 0 && lastOppChargeDeductedEnergySnapshot > 0) {
                                oppSlotEnergy[resolvedOppSlotIdx] = (oppSlotEnergy[resolvedOppSlotIdx] - diff).coerceIn(0, 100)
                                lastOppChargeDeductedEnergySnapshot = trueCost
                                updatedRetroactive = true
                            }
                            if (lastOppEvIdx >= 0 && (battleTimelineEvents[lastOppEvIdx].inferredMoveName != moveName || inFlightBonusE > 0 || battleTimelineEvents[lastOppEvIdx].expectedMoveDmgPct == null)) {
                                val prevEv = battleTimelineEvents[lastOppEvIdx]
                                val adjustedPreE = prevEv.preThrowEnergy?.let { (it + inFlightBonusE).coerceAtMost(100) }
                                val newDeficit = if (adjustedPreE != null && adjustedPreE < trueCost) (trueCost - adjustedPreE) else 0
                                battleTimelineEvents[lastOppEvIdx] = prevEv.copy(
                                    inferredMoveName = moveName,
                                    oppEnergy = oppSlotEnergy[resolvedOppSlotIdx],
                                    preThrowEnergy = adjustedPreE,
                                    requiredMoveEnergy = trueCost,
                                    energyDeficit = newDeficit,
                                    expectedMoveDmgPct = retroExpectedDmgPct,
                                    moveResolutionSource = "BANNER_OCR"
                                )
                                updatedRetroactive = true
                            }
                        }
                    }
                    if (added || updatedRetroactive) {
                        recalculateAndPushBattleData()
                    }
                } else if (actorRole == "user") {
                    lastUserChargedMoveBannerResolvedMs = nowMs
                    pendingUserChargeConfirmedByOcr = true
                    val targetUserIdx = resolvedUserSlotIdx.coerceIn(0, 2)
                    val targetUserMonName = preset?.pokemon?.getOrNull(targetUserIdx)?.name ?: userMonName
                    val targetUserMeta = getPokemonMeta(targetUserMonName, activeLeague, targetUserMonName.contains("Shadow", ignoreCase = true))
                    val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, targetUserMeta.types.firstOrNull() ?: "normal")
                    val trueCost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50).coerceIn(35, 100)
                    if (pendingChargedAttackActor == "user") {
                        // v6.02: If banner OCR shows a different user slot threw the move (player swap-and-throw),
                        // refund provisional energy to old slot and deduct from targetUserIdx!
                        if (pendingChargedAttackUserSlotIdx in 0..2 && targetUserIdx != pendingChargedAttackUserSlotIdx) {
                            val oldUIdx = pendingChargedAttackUserSlotIdx
                            val restoredOldE = preChargeUserEnergy.coerceIn(0, 100)
                            playerSlotEnergy[oldUIdx] = restoredOldE
                            playerSlotEnergyAnchor[oldUIdx] = restoredOldE
                            pendingChargedAttackUserSlotIdx = targetUserIdx
                            pendingChargedAttackAttackerName = targetUserMonName
                            preChargeUserEnergy = max(playerSlotEnergy[targetUserIdx], trueCost).coerceIn(trueCost, 100)
                        }
                        val effectivePreE = max(preChargeUserEnergy, trueCost).coerceIn(trueCost, 100)
                        val residualE = (effectivePreE - trueCost).coerceIn(0, 100)
                        playerSlotEnergy[targetUserIdx] = residualE
                        playerSlotEnergyAnchor[targetUserIdx] = residualE
                        lastUserChargePreEnergySnapshot = effectivePreE
                        lastUserChargeDeductedEnergySnapshot = trueCost
                        lastUserChargeResolvedMoveName = moveName
                        recalculateAndPushBattleData()
                    } else if (pendingChargedAttackActor.isEmpty() && (nowMs - lastChargedAttackLoggedMs) <= 3500L && lastChargedPromptActor == "user") {
                        if (trueCost != lastUserChargeDeductedEnergySnapshot && lastUserChargeDeductedEnergySnapshot > 0) {
                            val diff = trueCost - lastUserChargeDeductedEnergySnapshot
                            playerSlotEnergy[targetUserIdx] = (playerSlotEnergy[targetUserIdx] - diff).coerceIn(0, 100)
                            playerSlotEnergyAnchor[targetUserIdx] = playerSlotEnergy[targetUserIdx]
                            lastUserChargeDeductedEnergySnapshot = trueCost
                            lastUserChargeResolvedMoveName = moveName
                            recalculateAndPushBattleData()
                            showBattleToast("⚡ Used $moveName (-${trueCost}E)")
                        }
                    }
                }
                break
            }
        }
    }

    /**
     * v4.05: Primary OCR matcher for the opponent "Attack incoming! Use a Protect Shield?" / "NOT NOW" prompt.
     * Excludes our own overlay status text (`isOverlayHudSelfText(it.lowercase())`) and supports both multi-word
     * and cross-line fuzzy OCR matching for common ML Kit typos (e.g., "attack incomming", "incomming!",
     * "protect shield", "use a protect", "not now").
     */
    internal fun matchesAttackIncomingOcrText(lines: List<Text.Line>): Boolean {
        if (lines.isEmpty()) return false
        val filteredLines = lines.map { it.text.trim() }.filter { it.isNotEmpty() && !isOverlayHudSelfText(it.lowercase()) }
        if (filteredLines.isEmpty()) return false
        val combined = filteredLines.joinToString(" ") { it.lowercase() }
        if (combined.contains("attack incoming") ||
            combined.contains("attack incomming") ||
            combined.contains("incoming!") ||
            combined.contains("incomming!") ||
            combined.contains(" incoming") ||
            combined.contains(" incomming") ||
            combined.contains("attack inc") ||
            combined.contains("protect shield") ||
            combined.contains("use a protect") ||
            combined.contains("not now") ||
            combined.contains("no protect") ||
            combined.contains("shields remaining") ||
            combined.contains("protect shields") ||
            combined.contains("no shields")
        ) {
            return true
        }
        val allTokens = combined
            .replace(Regex("[^a-z0-9\\s]"), " ")
            .split(Regex("\\s+"))
            .filter { it.length >= 3 }
        if (allTokens.isEmpty()) return false

        // Direct fuzzy match on "incoming" / "incomming" (no Pokémon or move in GBL is within edit distance 2 of "incoming")
        for (tok in allTokens) {
            if (tok.length in 7..10 && (
                    levenshteinDistance(tok, "incoming") <= 2 ||
                    levenshteinDistance(tok, "incomming") <= 2
                )
            ) {
                return true
            }
        }

        val hasAttackOrShieldContext = allTokens.any {
            it.startsWith("att") ||
                it.startsWith("shie") ||
                it.startsWith("prot") ||
                it == "use" ||
                (it.length in 5..7 && levenshteinDistance(it, "attack") <= 2)
        }
        if (hasAttackOrShieldContext) {
            for (tok in allTokens) {
                if (tok.startsWith("incom") ||
                    (tok.length in 5..11 && (
                        levenshteinDistance(tok, "incoming") <= 2 ||
                        levenshteinDistance(tok, "incomming") <= 2 ||
                        levenshteinDistance(tok, "protect") <= 1 ||
                        levenshteinDistance(tok, "shield") <= 1 ||
                        levenshteinDistance(tok, "shields") <= 1
                    ))
                ) {
                    return true
                }
            }
        }
        return false
    }

    /**
     * v3.80: Reconciles live Charge Move Circle meters (Left = Move 1, Right = Move 2; Bi-Directional Upward & Downward Validation Every Fast Move),
     * Pre-Battle 3-2-1-GO 0% empty baseline lock-in, Shield-Prompt Gated Charged Move Attribution,
     * Player-Idle (>2 fast moves) back-credit & fallback, Banner Charged Move OCR ("<Pokemon> used <Move>!") 3-tier energy depletion,
     * Confirmed Opponent Moveset locking, and Non-Standard Opponent Fast Move detection (>=10% damage threshold + 0/1/2 turn offset).
     */
    internal fun updateLiveHpAndChargedAttackState(
        oppLines: List<Text.Line>,
        playerTopLines: List<Text.Line>,
        playerMoveLines: List<Text.Line>,
        midBannerLines: List<Text.Line> = emptyList()
    ) {
        val nowMs = currentFrameTimestampMs.takeIf { it > 0L } ?: System.currentTimeMillis()
        val preset = currentPreset
        val activeLeague = preset?.league ?: "MASTER LEAGUE"
        val activeUserIdx = (preset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
        val userSlotCfg = preset?.pokemon?.getOrNull(activeUserIdx)
        val userMonNameForStats = activeUserPokemonName ?: userSlotCfg?.name ?: "Dialga (Origin)"
        val isUserShadForStats = userMonNameForStats.contains("Shadow", ignoreCase = true)
        val userMetaForStats = OverlayService.computeEffectiveCombatStats(
            getPokemonMeta(userMonNameForStats, activeLeague, isUserShadForStats),
            activeLeague,
            userSlotCfg?.cp,
            userSlotCfg?.ivs
        )
        val userFastNameForStats = userSlotCfg?.fastMove?.takeIf { it.isNotBlank() } ?: userMetaForStats.defaultFastMove
        val userFastTurnsForStats = OverlayService.resolveFastTurnsStatic(userFastNameForStats, userMetaForStats.fastTurns).coerceIn(1, 5)
        val userFastEnergyForStats = OverlayService.resolveFastEnergyStatic(userFastNameForStats, userFastTurnsForStats).coerceIn(2, 20)
        val minUserMoveCooldownMs = (userFastTurnsForStats * 500L - 100L).coerceAtLeast(390L)

        // Explicit rule: Left Circle is ALWAYS Move 1 (chargedMove1), Right Circle is ALWAYS Move 2 (chargedMove2)
        val userMove1NameEarly = userSlotCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMetaForStats.chargedMove1
        val userMove2NameEarly = userSlotCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMetaForStats.chargedMove2
        val hasSecondUserMove = userMove2NameEarly.isNotBlank() && !userMove2NameEarly.equals(userMove1NameEarly, ignoreCase = true)
        val userMove1Energy = (OverlayService.resolveChargedMoveStatsStatic(userMove1NameEarly, userMetaForStats.types.firstOrNull() ?: "normal").energyCost
            .takeIf { it > 0 } ?: MOVE_ENERGY_COST[userMove1NameEarly] ?: 50).coerceIn(35, 100)
        val userMove2Energy = if (hasSecondUserMove) {
            (OverlayService.resolveChargedMoveStatsStatic(userMove2NameEarly, userMetaForStats.types.firstOrNull() ?: "normal").energyCost
                .takeIf { it > 0 } ?: MOVE_ENERGY_COST[userMove2NameEarly] ?: 50).coerceIn(35, 100)
        } else userMove1Energy
        val maxUserMoveEnergyEarly = max(userMove1Energy, userMove2Energy).coerceIn(35, 100)

        // v3.87 PRE-BATTLE & 3-2-1-GO COUNTDOWN STATIC CHARGE CIRCLE LOCK-IN (with 0E Countdown Lock & N-Sample ±2% Fill Debounce):
        if (isWaitingForOpponent) {
            if (isCountdownDimmedState) {
                playerSlotEnergy[activeUserIdx] = 0
                candidateSlowestFillPct[activeUserIdx] = 0
                slowestFillDebounceCount[activeUserIdx] = 0
                confirmedSlowestFillPct[activeUserIdx] = 0
                candidateFastestFillPct[activeUserIdx] = 0
                fastestFillDebounceCount[activeUserIdx] = 0
                confirmedFastestFillPct[activeUserIdx] = 0
                slowestMeterInThirdFill[activeUserIdx] = false
                fasterMeterInThirdFill[activeUserIdx] = false
                peakSecondFillPct[activeUserIdx] = 0
                peakFastestSecondFillPct[activeUserIdx] = 0
                return
            }
            if (enableEnergyTracking && (sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300)) {
                val userMoveDurationEarlyMs = (userFastTurnsForStats * 500L).coerceAtLeast(500L)
                val userSpeciesPrimaryTypeEarly = userMetaForStats.types.firstOrNull() ?: "normal"
                val slowestIsRightEarly = shouldSelectRightCircleAsPrimary(
                    move1Name = userMove1NameEarly,
                    move1Cost = userMove1Energy,
                    move2Name = userMove2NameEarly,
                    move2Cost = userMove2Energy,
                    hasSecondMove = hasSecondUserMove,
                    fallbackSpeciesType = userSpeciesPrimaryTypeEarly
                )
                val slowestMoveNameEarly = if (slowestIsRightEarly) userMove2NameEarly else userMove1NameEarly
                val fasterMoveNameEarly = if (slowestIsRightEarly) userMove1NameEarly else userMove2NameEarly
                val slowestMoveCostEarly = if (slowestIsRightEarly) userMove2Energy else userMove1Energy
                val fasterMoveCostEarly = if (slowestIsRightEarly) userMove1Energy else userMove2Energy
                val primaryRankEarly = getMoveScannerContrastRank(slowestMoveNameEarly, userSpeciesPrimaryTypeEarly)
                val secondaryRankEarly = getMoveScannerContrastRank(fasterMoveNameEarly, userSpeciesPrimaryTypeEarly)
                val slowestFillEarly = if (slowestIsRightEarly) sampledRightChargeBtnFillPct else sampledLeftChargeBtnFillPct
                val fasterFillEarly = if (slowestIsRightEarly) sampledLeftChargeBtnFillPct else sampledRightChargeBtnFillPct
                if (slowestFillEarly in 1..300) {
                    val tol = activeDebounceTolerancePct.coerceIn(0, 3)
                    if (candidateSlowestFillPct[activeUserIdx] >= 0 && kotlin.math.abs(slowestFillEarly - candidateSlowestFillPct[activeUserIdx]) <= tol) {
                        slowestFillDebounceCount[activeUserIdx]++
                        candidateSlowestFillPct[activeUserIdx] = ((candidateSlowestFillPct[activeUserIdx] + slowestFillEarly) / 2.0).roundToInt()
                    } else {
                        candidateSlowestFillPct[activeUserIdx] = slowestFillEarly
                        slowestFillDebounceCount[activeUserIdx] = 1
                    }
                    if (fasterFillEarly in 0..300) {
                        if (candidateFastestFillPct[activeUserIdx] >= 0 && kotlin.math.abs(fasterFillEarly - candidateFastestFillPct[activeUserIdx]) <= tol) {
                            fastestFillDebounceCount[activeUserIdx]++
                            candidateFastestFillPct[activeUserIdx] = ((candidateFastestFillPct[activeUserIdx] + fasterFillEarly) / 2.0).roundToInt()
                        } else {
                            candidateFastestFillPct[activeUserIdx] = fasterFillEarly
                            fastestFillDebounceCount[activeUserIdx] = 1
                        }
                    }
                    val reqDebounce = activeEnergyDebounceSamples.coerceIn(2, 4)
                    if (slowestFillDebounceCount[activeUserIdx] >= reqDebounce) {
                        val confirmedPctEarly = candidateSlowestFillPct[activeUserIdx].coerceIn(0, 300)
                        confirmedSlowestFillPct[activeUserIdx] = confirmedPctEarly
                        val confirmedFastPctEarly = if (fastestFillDebounceCount[activeUserIdx] >= reqDebounce) {
                            candidateFastestFillPct[activeUserIdx].coerceIn(0, 300).also { confirmedFastestFillPct[activeUserIdx] = it }
                        } else fasterFillEarly
                        val measuredEarly = resolveSub50AndMultiRoundEnergy(
                            slotIdx = activeUserIdx,
                            slowestIsRight = slowestIsRightEarly,
                            slowestMoveCost = slowestMoveCostEarly,
                            fasterMoveCost = fasterMoveCostEarly,
                            hasSecondUserMove = hasSecondUserMove,
                            debouncedSlowestPct = confirmedPctEarly,
                            debouncedFasterPct = confirmedFastPctEarly,
                            curE = playerSlotEnergy[activeUserIdx].coerceIn(0, 100),
                            userFastEnergy = userFastEnergyForStats,
                            userMoveDurationMs = userMoveDurationEarlyMs,
                            nowMs = nowMs,
                            canAdvanceMonotonically = true,
                            primaryContrastRank = primaryRankEarly,
                            secondaryContrastRank = secondaryRankEarly
                        )
                        if (measuredEarly >= userFastEnergyForStats) {
                            hasBattleStarted = true
                            battleClockAnchorMs = nowMs - userMoveDurationEarlyMs
                            lastTurnTickTimeMs = nowMs
                            turnResidualMs = 0L
                            battleTurnIndex = userFastTurnsForStats
                            playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
                            playerSlotEnergy[activeUserIdx] = measuredEarly
                            playerSlotTurnsOnField[activeUserIdx] = userFastTurnsForStats
                            phasePlayerTurns = userFastTurnsForStats
                            playerLastFastCreditedAtMs[activeUserIdx] = nowMs
                            lastStableNormalCombatEnergy = measuredEarly
                            prevStableNormalCombatEnergy = measuredEarly
                            isPlayerInIdleFallback = false
                            emitEnergyUpdateToastIfEnabled(
                                slotIdx = activeUserIdx,
                                moveName = slowestMoveNameEarly,
                                moveCost = slowestMoveCostEarly,
                                circleFillPct = confirmedPctEarly,
                                newEnergy = measuredEarly
                            )
                            recalculateAndPushBattleData()
                        }
                    }
                }
            }
            return
        }

        val oppTopLower = oppLines.joinToString(" ") { it.text.lowercase() }
        val playerTopLower = playerTopLines.joinToString(" ") { it.text.lowercase() }
        val bottomLower = playerMoveLines.joinToString(" ") { it.text.lowercase() }
        val midBannerLower = midBannerLines.joinToString(" ") { it.text.lowercase() }
        val combinedBannerLower = "$bottomLower $midBannerLower $oppTopLower $playerTopLower"

        // v4.05 / v4.11: Opponent Charged Attack prompt text is gated on the bottom Charge Move Circles being hidden
        // OR the top 5-second countdown circle being active (`!sampledTopRightNameplateVisible`), decoupled from top Pokéball false positives!
        val isHudHiddenForOpponentPrompt = (sampledLeftChargeBtnFillPct == -1 &&
            sampledRightChargeBtnFillPct == -1) ||
            ((isTopCountdownCircleActive || sampledTopCountdownCircleVisible) && !sampledTopRightNameplateVisible)

        // Player Charged Attack minigame banner text ("Get ready!", "GREAT!", "EXCELLENT!", "NICE!", "Charge your attack!", "Swipe!")
        // Note: During the player's swipe minigame, BOTH floating HP bars are hidden (`sampledPlayerHpPct == -1 && sampledOppHpPct == -1`).
        // Gating on `sampledPlayerHpPct == -1` prevents stale OCR lines from ever canceling an opponent charged move countdown!
        val rawHasUserChargedBannerText = sampledPlayerHpPct == -1 && (
            combinedBannerLower.contains("get ready") ||
                combinedBannerLower.contains("great") ||
                combinedBannerLower.contains("excellent") ||
                combinedBannerLower.contains("nice") ||
                combinedBannerLower.contains("charge your") ||
                combinedBannerLower.contains("swipe")
            )

        // v4.05 / v4.10: Primary OCR trigger for Opponent Charged Attack prompt text ("Attack incoming!", "attack incomming", "Use a Protect Shield?", "NOT NOW", etc.)
        // Evaluated on `playerMoveLines + midBannerLines` (excluding top HUD where our own toast renders), and latched across
        // 100ms pixel frames (`lastAttackIncomingOcrDetectedMs`) while bottom Charge Move Circles remain hidden (`isHudHiddenForOpponentPrompt`)
        // so false Pokéball pixel hits from tall Pokémon antlers (e.g. Xerneas red/orange antlers at y=0.065h..0.125h) can NEVER
        // cancel the Shield Decision Overlay or trigger a premature post-charge resolution!
        val rawMatchedAttackIncomingOcr = !rawHasUserChargedBannerText &&
            matchesAttackIncomingOcrText(playerMoveLines + midBannerLines)
        val hasRecentOppUsedMoveBanner = lastDetectedBannerMoveActor == "opp" &&
            lastDetectedBannerMoveTimeMs > 0L &&
            (nowMs - lastDetectedBannerMoveTimeMs) <= 2600L &&
            lastDetectedBannerMoveTimeMs >= lastAttackIncomingOcrDetectedMs
        if (rawMatchedAttackIncomingOcr && (isHudHiddenForOpponentPrompt || isTopCountdownCircleActive)) {
            lastAttackIncomingOcrDetectedMs = nowMs
        } else if (rawHasUserChargedBannerText || isPostFaintSwitchPromptActive || !isHudHiddenForOpponentPrompt || hasRecentOppUsedMoveBanner) {
            lastAttackIncomingOcrDetectedMs = 0L
        }
        val hasRecentAttackIncomingOcr = lastAttackIncomingOcrDetectedMs > 0L &&
            (nowMs - lastAttackIncomingOcrDetectedMs) <= 4800L &&
            isHudHiddenForOpponentPrompt &&
            !hasRecentOppUsedMoveBanner &&
            !isPostFaintSwitchPromptActive &&
            !rawHasUserChargedBannerText
        val hasAttackIncomingText = ((isHudHiddenForOpponentPrompt || isTopCountdownCircleActive) && rawMatchedAttackIncomingOcr) ||
            hasRecentAttackIncomingOcr

        // v4.10: While the opponent's 5-second shield decision prompt is active and bottom Charge Move Circles are hidden,
        // suppress any false red/orange Pokéball pixel hits caused by tall Pokémon antlers/wings (e.g. Xerneas) at the top of the screen!
        if ((hasAttackIncomingText || isTopCountdownCircleActive) &&
            isHudHiddenForOpponentPrompt &&
            !isPostFaintSwitchPromptActive &&
            !rawHasUserChargedBannerText
        ) {
            sampledPlayerBalls = 0
            sampledOppBalls = 0
        }

        val hasUserChargedBannerText = !hasAttackIncomingText && rawHasUserChargedBannerText

        // Update Shield-Prompt Gate state BEFORE parsing mid-banner "<Pokemon> used <Move>!" lines
        if (hasUserChargedBannerText) {
            // Player minigame banner ("Get ready!" / "NICE!" / "GREAT!" / "EXCELLENT!") is 100% exclusive to player charged moves!
            // If a tentative opponent prompt was falsely set before the minigame text appeared, roll it back immediately!
            pendingUserChargeConfirmedByOcr = true
            if (pendingChargedAttackActor == "opp") {
                if (pendingChargedAttackOppSlotIdx in 0..2 && pendingChargedAttackPreOppEnergy > 0) {
                    oppSlotEnergy[pendingChargedAttackOppSlotIdx] = pendingChargedAttackPreOppEnergy.coerceIn(0, 100)
                }
                pendingChargedAttackActor = ""
                pendingChargedAttackDeductedEnergy = 0
                pendingChargedAttackPreOppEnergy = 0
            }
            isAttackIncomingPromptActive = false
            lastAttackIncomingOcrDetectedMs = 0L
            sampledShieldHexagonVisible = false
            shieldHexagonConfirmFrames = 0
            shieldOverlayShowConfirmFrames = 0
            lastShieldOverlayConfirmFrameMs = 0L
            if (isShieldDecisionOverlayVisible) {
                hideShieldDecisionOverlay()
            }
            hadShieldPromptBeforeCurrentCharge = false
            lastChargedPromptActor = "user"
            lastChargedPromptTimeMs = nowMs
        } else if (hasAttackIncomingText) {
            if (sampledTopCountdownCircleVisible && topCountdownCircleConfirmFrames >= 2) {
                isTopCountdownCircleActive = true
            }
            hadShieldPromptBeforeCurrentCharge = true
            lastChargedPromptActor = "opp"
            lastChargedPromptTimeMs = nowMs
        }

        if (midBannerLines.isNotEmpty()) {
            handleMidBannerUsedMoveLines(midBannerLines)
        }

        val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val activeOppIdx = if (detectedOpponents.isNotEmpty()) {
            detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOppBase, ignoreCase = true)
            }.let { if (it in 0..2) it else 0 }
        } else 0

        var hpChanged = false

        // 0. Enforce 0% HP on fainted bench slots, and ensure active fighting Pokémon on the field NEVER have 0% HP
        for (i in 0..2) {
            if (playerFaintedSlots[i]) {
                if (playerSlotHpPct[i] != 0) {
                    playerSlotHpPct[i] = 0
                    confirmedPlayerSlotHpPct[i] = 0
                    pendingConfirmPlayerSlotHpPct[i] = 0
                    playerSlotHpConfirmFrames[i] = 2
                    hpChanged = true
                }
            } else if (playerSlotHpPct[i] <= 0) {
                playerSlotHpPct[i] = playerSlotPreFaintHpPct[i].coerceIn(1, 100)
                confirmedPlayerSlotHpPct[i] = playerSlotHpPct[i]
                pendingConfirmPlayerSlotHpPct[i] = playerSlotHpPct[i]
                playerSlotHpConfirmFrames[i] = 2
                hpChanged = true
            }
            if (oppFaintedSlots[i]) {
                if (oppSlotHpPct[i] != 0) {
                    oppSlotHpPct[i] = 0
                    confirmedOppSlotHpPct[i] = 0
                    pendingConfirmOppSlotHpPct[i] = 0
                    oppSlotHpConfirmFrames[i] = 2
                    hpChanged = true
                }
            } else if (oppSlotHpPct[i] <= 0) {
                oppSlotHpPct[i] = oppSlotPreFaintHpPct[i].coerceIn(1, 100)
                confirmedOppSlotHpPct[i] = oppSlotHpPct[i]
                pendingConfirmOppSlotHpPct[i] = oppSlotHpPct[i]
                oppSlotHpConfirmFrames[i] = 2
                hpChanged = true
            }
        }

        // 1. v3.80: Bi-Directional Live HP Gauge Update + Charge Move Circle Only Mode + Non-Standard Fast Move Override
        val oppMetaForStats = OverlayService.computeEffectiveCombatStats(
            getPokemonMeta(activeOpponentName, activeLeague, isOpponentShadow),
            activeLeague
        )
        val oppFastNameForStats = detectedOppFastMoveOverride[activeOppIdx]?.takeIf { it.isNotBlank() }
            ?: oppMetaForStats.defaultFastMove
        val oppFastTurnsForStats = OverlayService.resolveFastTurnsStatic(oppFastNameForStats, oppMetaForStats.fastTurns).coerceIn(1, 5)
        val oppFastEnergyForStats = OverlayService.resolveFastEnergyStatic(oppFastNameForStats, oppFastTurnsForStats).coerceIn(2, 20)
        val userExactDmgPct = calculateFastMoveExactDamagePercent(
            attacker = userMetaForStats,
            defender = oppMetaForStats,
            fastMoveName = userFastNameForStats,
            fastTurns = userFastTurnsForStats,
            isAttackerShadow = isUserShadForStats,
            isDefenderShadow = isOpponentShadow
        )
        val oppExactDmgPct = calculateFastMoveExactDamagePercent(
            attacker = oppMetaForStats,
            defender = userMetaForStats,
            fastMoveName = oppFastNameForStats,
            fastTurns = oppFastTurnsForStats,
            isAttackerShadow = isOpponentShadow,
            isDefenderShadow = isUserShadForStats
        )

        var userFastMovesCreditedThisFrame = 0
        val captureAnchorMs = lastCaptureStartMs.takeIf { it > 0L } ?: nowMs

        // CRITICAL LOCKOUT FOR CHARGED MOVE CAMERA ZOOM ANIMATIONS (v5.12):
        // Once the battle has started, fast-move energy can ONLY accumulate when Charge Move Circles AND top Pokéball
        // indicators are visible on screen. The instant circles disappear going into a charged move zoom-in,
        // fast-move energy accumulation freezes and any unconfirmed proactive/sub-turn step is rolled back.
        val areChargeCirclesVisibleNow = sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300
        val hasVisibleCombatHud = !hasBattleStarted ||
            ((sampledPlayerHpPct in 1..100 || sampledOppHpPct in 1..100 || areChargeCirclesVisibleNow) &&
                (sampledPlayerBalls in 1..3 || sampledOppBalls in 1..3))

        val canAccumulateFastEnergy = enableEnergyTracking &&
            hasVisibleCombatHud &&
            (!hasBattleStarted || areChargeCirclesVisibleNow) &&
            !isPostFaintSwitchPromptActive &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            pendingChargedAttackActor.isEmpty() &&
            !isAttackIncomingPromptActive &&
            !hasAttackIncomingText &&
            !hasUserChargedBannerText &&
            missingBothHpBarsFrames == 0 &&
            missingTopBallsWithHpBarsFrames == 0 &&
            missingBottomCirclesWithOppHpFrames == 0 &&
            (nowMs - lastChargedAttackLoggedMs) > 1200L

        if (hasBattleStarted && !canAccumulateFastEnergy && (proactiveStepPending || phasePlayerTurns > confirmedPhasePlayerTurns)) {
            val isOpponentThrowingNow = isAttackIncomingPromptActive ||
                hasAttackIncomingText ||
                (isTopCountdownCircleActive && !isPostFaintSwitchPromptActive) ||
                pendingChargedAttackActor == "opp"
            rollbackPendingProactiveStep(
                markAnchorRolledBack = false,
                preserveOppSubTurnEnergy = isOpponentThrowingNow
            )
            hpChanged = true
        }

        // v3.89 / v4.04 / v5.12: N-Sample (±2% Tolerance) HP Bar Debounce, Upward Self-Correction & Post-Cutscene Settle Gate
        val reqHpDebounce = activeHpDebounceSamples.coerceIn(2, 4)
        val hasUserBannerResolvedSinceThrow = pendingChargedAttackActor == "user" &&
            lastUserChargedMoveBannerResolvedMs >= pendingChargedAttackStartMs
        val isUserMinigameSwipePhaseActive = pendingChargedAttackActor == "user" &&
            !hasUserBannerResolvedSinceThrow &&
            (nowMs - pendingChargedAttackStartMs) < 2300L
        val isOpponentCountdownWindowEarly = (isTopCountdownCircleActive || sampledTopCountdownCircleVisible) &&
            !isPostFaintSwitchPromptActive &&
            !sampledTopRightNameplateVisible &&
            isHudHiddenForOpponentPrompt &&
            !hasUserChargedBannerText &&
            !isUserMinigameSwipePhaseActive &&
            (sampledPlayerHpPct in 1..100 ||
                sampledOppHpPct in 1..100 ||
                hasAttackIncomingText ||
                isAttackIncomingPromptActive ||
                pendingChargedAttackActor == "opp")
        val isShieldCallWindowEarly = isOpponentCountdownWindowEarly ||
            hasAttackIncomingText ||
            isAttackIncomingPromptActive ||
            (pendingChargedAttackActor == "opp" && (nowMs - pendingChargedAttackStartMs) <= 4800L && (sampledPlayerHpPct in 1..100 || sampledOppHpPct in 1..100)) ||
            (playerShieldsRemaining == 0 && missingBottomCirclesWithOppHpFrames >= 6 && !isUserMinigameSwipePhaseActive)
        val isPostChargeReturnWindow = pendingChargedAttackActor.isNotEmpty() &&
            !isShieldCallWindowEarly &&
            !hasUserChargedBannerText &&
            missingBothHpBarsFrames == 0 &&
            areChargeCirclesVisibleNow &&
            hasVisibleCombatHud &&
            (nowMs - pendingChargedAttackStartMs) >= 1800L
        val isCleanCombatHpWindow = hasVisibleCombatHud &&
            !isPostFaintSwitchPromptActive &&
            !hasUserChargedBannerText &&
            pendingChargedAttackActor != "user" &&
            !isShieldCallWindowEarly &&
            missingBothHpBarsFrames == 0 &&
            (nowMs - lastChargedAttackLoggedMs) > 650L
        val isCleanShieldCallHpWindow = isShieldCallWindowEarly &&
            !isPostFaintSwitchPromptActive &&
            !hasUserChargedBannerText &&
            missingBothHpBarsFrames == 0
        val isOpponentThrowingHpRescanWindow = isCleanShieldCallHpWindow ||
            (pendingChargedAttackActor == "opp" && (isAttackIncomingPromptActive || isTopCountdownCircleActive || hasAttackIncomingText))
        val canSamplePlayerHpBars = isCleanCombatHpWindow || isCleanShieldCallHpWindow || isPostChargeReturnWindow || isOpponentThrowingHpRescanWindow
        val canSampleOppHpBars = isCleanCombatHpWindow || isPostChargeReturnWindow
        val canSampleStableHpBars = canSamplePlayerHpBars

        // Reset HP confirm frame counters while inside a charged move cutscene before combat circles return
        if (pendingChargedAttackActor.isNotEmpty() && !areChargeCirclesVisibleNow && !isCleanShieldCallHpWindow && !isOpponentThrowingHpRescanWindow) {
            playerSlotHpConfirmFrames.fill(0)
            oppSlotHpConfirmFrames.fill(0)
        }

        lastEnergyMutationSource = "NONE"

        // v6.02 / v6.07: Record lightweight 10Hz scalar sensor tick for post-battle multi-profile shadow telemetry & HP/Energy root-cause diagnostics (0% combat CPU lag)
        if (hasBattleStarted && currentBattleSensorTicks.size < 4000) {
            currentBattleSensorTicks.add(
                BattleSensorTick(
                    tMs = nowMs,
                    playerHpPct = sampledPlayerHpPct,
                    oppHpPct = sampledOppHpPct,
                    leftFillPct = sampledLeftChargeBtnFillPct,
                    rightFillPct = sampledRightChargeBtnFillPct,
                    playerShields = sampledPlayerShields,
                    oppShields = sampledOppShields,
                    playerBalls = sampledPlayerBalls,
                    oppBalls = sampledOppBalls,
                    activeUserIdx = activeUserIdx,
                    activeOppIdx = activeOppIdx,
                    isCutsceneActive = pendingChargedAttackActor.isNotEmpty() || !areChargeCirclesVisibleNow,
                    committedPlayerHpPct = playerSlotHpPct[activeUserIdx].coerceIn(0, 100),
                    committedOppHpPct = oppSlotHpPct[activeOppIdx].coerceIn(0, 100),
                    playerHpRowY = sampledPlayerHpRowY,
                    oppHpRowY = sampledOppHpRowY,
                    userEnergy = playerSlotEnergy[activeUserIdx].coerceIn(0, 100),
                    oppEnergy = oppSlotEnergy[activeOppIdx].coerceIn(0, 100),
                    energyMutationSource = "NONE"
                )
            )
        }

        // 1A. v3.89 / v6.05: Player HP Bar Scan (N-Sample ±2% Debounce + Upward Self-Correction + Always Rescan When Opponent Throws Charged Move):
        //     Tracks player HP% and cumulative opponent fast-move damage (solely for Non-Standard Opponent Fast Move Detector 1E).
        if (!isPostFaintSwitchPromptActive && sampledPlayerHpPct in 1..100 && !playerFaintedSlots[activeUserIdx] && canSampleStableHpBars) {
            playerFinalMissingHpFrames = 0
            val lastScannedUserHp = lastScannedPlayerSlotHpPct[activeUserIdx].coerceIn(1, 100)
            val currentPlayerHp = playerSlotHpPct[activeUserIdx].coerceIn(1, 100)

            val prevPendingPlayerHp = pendingConfirmPlayerSlotHpPct[activeUserIdx]
            val tol = activeDebounceTolerancePct.coerceIn(0, 3)
            if (prevPendingPlayerHp in 1..100 && kotlin.math.abs(sampledPlayerHpPct - prevPendingPlayerHp) <= tol) {
                playerSlotHpConfirmFrames[activeUserIdx] = (playerSlotHpConfirmFrames[activeUserIdx] + 1).coerceAtMost(10)
                pendingConfirmPlayerSlotHpPct[activeUserIdx] = ((prevPendingPlayerHp + sampledPlayerHpPct) / 2.0).roundToInt().coerceIn(1, 100)
            } else {
                pendingConfirmPlayerSlotHpPct[activeUserIdx] = sampledPlayerHpPct
                playerSlotHpConfirmFrames[activeUserIdx] = 1
            }
            val effectivePlayerHpDebounce = if (isOpponentThrowingHpRescanWindow) 2 else reqHpDebounce
            val isPlayerHpConfirmed = playerSlotHpConfirmFrames[activeUserIdx] >= effectivePlayerHpDebounce
            val confirmedPlayerHp = pendingConfirmPlayerSlotHpPct[activeUserIdx].coerceIn(1, 100)

            if (isPlayerHpConfirmed) {
                // v6.04: Only record Pre-Throw HP Jump Hint on debounced samples (never on 1-frame camera zoom-in spikes)
                if (pendingChargedAttackActor.isEmpty() && kotlin.math.abs(confirmedPlayerHp - currentPlayerHp) >= 15) {
                    preChargePlayerHpJumpHint = true
                    preChargePlayerHpJumpNewHp = confirmedPlayerHp
                    preChargePlayerHpJumpMs = nowMs
                }
                val realUserDrop = lastScannedUserHp - confirmedPlayerHp
                val halfOppDmg = max(1, (oppExactDmgPct * 0.50).roundToInt())
                val minOppFastDmgThreshold = if (!hasBattleStarted && oppExactDmgPct < 2.0) {
                    max(2, halfOppDmg)
                } else {
                    halfOppDmg
                }

                // Accumulate fast-move damage dealt by this opponent for the Non-Standard Opponent Fast Move Detector (1E)
                if (realUserDrop in 1..25 && (hasBattleStarted || realUserDrop >= 2) && canAccumulateFastEnergy) {
                    oppCumulativeFastDmgPct[activeOppIdx] = (oppCumulativeFastDmgPct[activeOppIdx] + realUserDrop).coerceIn(0, 300)
                }

                // v6.04 / v6.05: Block large (>4%) upward HP self-correction while a PLAYER charged attack is active or within 2500ms of defending an opp charged attack unless a switch occurred or opponent is actively throwing a new charged move
                val isRecentPlayerSwitch = (nowMs - lastPlayerSwitchTimeMs) in 0L..2500L
                val isBlockingPostChargeUserUpwardJump = !isRecentPlayerSwitch &&
                    !isOpponentThrowingHpRescanWindow &&
                    (confirmedPlayerHp - currentPlayerHp) > 4 &&
                    (pendingChargedAttackActor == "user" ||
                        (lastOppChargedAttackLoggedMs > 0L &&
                            (nowMs - lastOppChargedAttackLoggedMs) in 0L..2500L &&
                            activeUserIdx == lastOppChargedDefenderUserSlotIdx))

                if ((confirmedPlayerHp > currentPlayerHp || confirmedPlayerHp > lastScannedUserHp) && !isBlockingPostChargeUserUpwardJump) {
                    if (confirmedPlayerHp - currentPlayerHp >= 18 && currentPlayerHp in 1..85) {
                        playerSlotPriorHpPct[activeUserIdx] = currentPlayerHp
                        playerSlotLastBigJumpMs[activeUserIdx] = nowMs
                    }
                    // Immediate upward self-correction when N debounced samples (±2%) confirm a higher HP%
                    lastScannedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    confirmedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotPreFaintHpPct[activeUserIdx] = confirmedPlayerHp
                    predictedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreUserHp = confirmedPlayerHp
                        pendingChargedAttackPreUserSlotHp[activeUserIdx] = confirmedPlayerHp
                    }
                    pendingPlayerLowHpSlot = -1
                    pendingPlayerLowHpSample = -1
                    hpChanged = true
                } else if (realUserDrop in minOppFastDmgThreshold..25) {
                    lastScannedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    predictedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    confirmedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotPreFaintHpPct[activeUserIdx] = confirmedPlayerHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreUserHp = confirmedPlayerHp
                        pendingChargedAttackPreUserSlotHp[activeUserIdx] = confirmedPlayerHp
                    }
                    pendingPlayerLowHpSlot = -1
                    pendingPlayerLowHpSample = -1
                    hpChanged = true
                } else if (realUserDrop in 1 until minOppFastDmgThreshold && hasBattleStarted) {
                    lastScannedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    confirmedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotPreFaintHpPct[activeUserIdx] = confirmedPlayerHp
                    predictedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreUserHp = confirmedPlayerHp
                        pendingChargedAttackPreUserSlotHp[activeUserIdx] = confirmedPlayerHp
                    }
                    hpChanged = true
                } else if (realUserDrop > 25 || (isOpponentThrowingHpRescanWindow && confirmedPlayerHp != currentPlayerHp)) {
                    // v6.05: Always sync player HP drops >25% AND always rescan/sync player HP when opponent is throwing a charged move!
                    lastScannedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    confirmedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    playerSlotPreFaintHpPct[activeUserIdx] = confirmedPlayerHp
                    predictedPlayerSlotHpPct[activeUserIdx] = confirmedPlayerHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreUserHp = confirmedPlayerHp
                        pendingChargedAttackPreUserSlotHp[activeUserIdx] = confirmedPlayerHp
                    }
                    pendingPlayerLowHpSlot = -1
                    pendingPlayerLowHpSample = -1
                    hpChanged = true
                } else if (isOpponentThrowingHpRescanWindow && pendingChargedAttackPreUserHp != confirmedPlayerHp) {
                    pendingChargedAttackPreUserHp = confirmedPlayerHp
                    pendingChargedAttackPreUserSlotHp[activeUserIdx] = confirmedPlayerHp
                    hpChanged = true
                }

                // v6.04: Retroactive unshielded opponent move confirmation AND HP delta update (with defender slot verification & provisional chip-shield override)
                val recentOppChargeMs = max(
                    if (lastChargedPromptActor == "opp") lastChargedAttackLoggedMs else 0L,
                    lastOppChargedAttackLoggedMs
                )
                val preUserHpRef = if (lastOppChargedAttackLoggedMs > 0L && (nowMs - lastOppChargedAttackLoggedMs) <= 4500L) {
                    lastOppChargedPreUserHp
                } else {
                    pendingChargedAttackPreUserHp
                }
                val postChargeDropFromPre = preUserHpRef - confirmedPlayerHp
                val sameDefendingUserSlot = (lastOppChargedDefenderUserSlotIdx == -1 || activeUserIdx == lastOppChargedDefenderUserSlotIdx) &&
                    (lastPlayerSwitchTimeMs <= recentOppChargeMs)
                if (pendingChargedAttackActor.isEmpty() &&
                    recentOppChargeMs > 0L &&
                    (nowMs - recentOppChargeMs) in 1L..4500L &&
                    sameDefendingUserSlot &&
                    lastOppChargedAttackerSlotIdx in 0..2 &&
                    postChargeDropFromPre >= 5
                ) {
                    val lastOppEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "opp" }
                    val existingEv = if (lastOppEvIdx >= 0) battleTimelineEvents[lastOppEvIdx] else null
                    val existingInferred = existingEv?.inferredMoveName
                    val existingDelta = existingEv?.hpDeltaPct ?: 0
                    val minOverrideDrop = max(6, ((existingEv?.expectedMoveDmgPct ?: 20) * 0.35).toInt())
                    val canOverrideProvisionalUserShield = existingEv?.shielded == true &&
                        lastOppChargedWasProvisionalShield &&
                        postChargeDropFromPre >= minOverrideDrop
                    if (lastOppEvIdx >= 0 && existingEv != null &&
                        ((existingEv.shielded == false && postChargeDropFromPre > existingDelta + 2) || canOverrideProvisionalUserShield)
                    ) {
                        if (canOverrideProvisionalUserShield) {
                            if (lastOppChargedAutoDecrementedShield) {
                                playerShieldsRemaining = (playerShieldsRemaining + 1).coerceIn(0, 2)
                                val shieldEvIdx = battleTimelineEvents.indexOfLast {
                                    it.type == "SHIELD" && it.actor == "user" && kotlin.math.abs(it.t - existingEv.t) <= 0.5
                                }
                                if (shieldEvIdx >= 0) {
                                    battleTimelineEvents.removeAt(shieldEvIdx)
                                }
                            }
                            lastOppChargedWasProvisionalShield = false
                            lastOppChargedAutoDecrementedShield = false
                        }
                        val targetOppEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "opp" }
                        if (targetOppEvIdx >= 0) {
                            battleTimelineEvents[targetOppEvIdx] = battleTimelineEvents[targetOppEvIdx].copy(
                                shielded = false,
                                pokemonShielded = null,
                                hpBeforePct = preUserHpRef,
                                hpAfterPct = confirmedPlayerHp,
                                hpDeltaPct = postChargeDropFromPre,
                                userSlotHpPct = playerSlotHpPct.toList(),
                                userShieldsRemaining = playerShieldsRemaining
                            )
                        }
                        hpChanged = true
                    }
                    // v6.12: Never overwrite a move name that was already confirmed by Mid-Banner OCR ("<Pokemon> used <Move>!")
                    val canUpgradeHpGuess = existingEv?.moveResolutionSource != "BANNER_OCR" && (
                        existingInferred.isNullOrBlank() ||
                            canOverrideProvisionalUserShield ||
                            (lastOppChargeHpInferredMoveName.isNotEmpty() &&
                                existingInferred == lastOppChargeHpInferredMoveName &&
                                postChargeDropFromPre >= existingDelta + 5)
                    )
                    if (canUpgradeHpGuess) {
                        val retroOppIdx = lastOppChargedAttackerSlotIdx.coerceIn(0, 2)
                        val retroOppRawName = detectedOpponents.getOrNull(retroOppIdx) ?: lastOppChargedAttackerRawName.ifBlank { activeOpponentName }
                        val retroOppBase = FormResolver.extractBaseSpecies(retroOppRawName).lowercase()
                        val retroOppShad = manualShadowOverrides[retroOppBase] ?: lastOppChargedAttackerShadow
                        val retroOppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(retroOppRawName, activeLeague, retroOppShad), activeLeague)
                        val retroThird = retroOppMeta.chargedMove3.takeIf { it.isNotBlank() }
                            ?: COMMON_THIRD_CHARGED_MOVE[retroOppMeta.name]
                            ?: "Outrage"
                        val retroMoveNames = listOf(retroOppMeta.chargedMove1, retroOppMeta.chargedMove2, retroThird, retroOppMeta.chargedMove4)
                            .filter { it.isNotBlank() }
                            .distinct()
                        val retroCandPairs = retroMoveNames.map { mName ->
                            mName to calculateChargedMoveDamagePercent(
                                attacker = retroOppMeta,
                                defender = userMetaForStats,
                                moveName = mName,
                                isAttackerShadow = retroOppShad,
                                isDefenderShadow = isUserShadForStats
                            )
                        }
                        val retroInferred = inferUnshieldedChargedMoveName(postChargeDropFromPre, retroCandPairs)
                            ?: inferBestGuessChargedMoveByHp(postChargeDropFromPre, retroCandPairs)
                        if (retroInferred != null) {
                            if (lastOppChargeHpInferredMoveName.isNotEmpty() && !lastOppChargeHpInferredMoveName.equals(retroInferred, ignoreCase = true)) {
                                confirmedOppChargedMoves[retroOppIdx].remove(lastOppChargeHpInferredMoveName)
                            }
                            confirmedOppChargedMoves[retroOppIdx].add(retroInferred)
                            lastOppChargeHpInferredMoveName = retroInferred
                            val mStats = OverlayService.resolveChargedMoveStatsStatic(retroInferred, retroOppMeta.types.firstOrNull() ?: "normal")
                            val trueCost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[retroInferred] ?: 50).coerceIn(35, 100)
                            val diff = trueCost - lastOppChargeDeductedEnergySnapshot
                            if (diff != 0 && lastOppChargeDeductedEnergySnapshot > 0) {
                                oppSlotEnergy[retroOppIdx] = (oppSlotEnergy[retroOppIdx] - diff).coerceIn(0, 100)
                                lastOppChargeDeductedEnergySnapshot = trueCost
                            }
                            val targetOppEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "opp" }
                            if (targetOppEvIdx >= 0) {
                                battleTimelineEvents[targetOppEvIdx] = battleTimelineEvents[targetOppEvIdx].copy(
                                    shielded = false,
                                    pokemonShielded = null,
                                    hpBeforePct = preUserHpRef,
                                    hpAfterPct = confirmedPlayerHp,
                                    hpDeltaPct = postChargeDropFromPre,
                                    inferredMoveName = retroInferred,
                                    oppEnergy = oppSlotEnergy[retroOppIdx],
                                    userShieldsRemaining = playerShieldsRemaining
                                )
                            }
                            hpChanged = true
                        }
                    }
                }
            }
        } else if (sampledPlayerHpPct == -1 || !canSampleStableHpBars) {
            pendingConfirmPlayerSlotHpPct[activeUserIdx] = -1
            playerSlotHpConfirmFrames[activeUserIdx] = 0
        }

        // 1B. v3.89 / v6.05 / v6.12: Opponent HP Bar Scan (N-Sample ±2% Debounce + Upward Self-Correction):
        //     Tracks opponent HP% only; never rescans opponent HP while opponent is zooming in to throw a charged move.
        if (sampledOppHpPct in 1..100 && !oppFaintedSlots[activeOppIdx] && canSampleOppHpBars) {
            oppFinalMissingHpFrames = 0
            val lastScannedOppHp = lastScannedOppSlotHpPct[activeOppIdx].coerceIn(1, 100)
            val currentOppHp = oppSlotHpPct[activeOppIdx].coerceIn(1, 100)

            val prevPendingOppHp = pendingConfirmOppSlotHpPct[activeOppIdx]
            val tol = activeDebounceTolerancePct.coerceIn(0, 3)
            if (prevPendingOppHp in 1..100 && kotlin.math.abs(sampledOppHpPct - prevPendingOppHp) <= tol) {
                oppSlotHpConfirmFrames[activeOppIdx] = (oppSlotHpConfirmFrames[activeOppIdx] + 1).coerceAtMost(10)
                pendingConfirmOppSlotHpPct[activeOppIdx] = ((prevPendingOppHp + sampledOppHpPct) / 2.0).roundToInt().coerceIn(1, 100)
            } else {
                pendingConfirmOppSlotHpPct[activeOppIdx] = sampledOppHpPct
                oppSlotHpConfirmFrames[activeOppIdx] = 1
            }
            val effectiveOppHpDebounce = if (isOpponentThrowingHpRescanWindow) 2 else reqHpDebounce
            val isOppHpConfirmed = oppSlotHpConfirmFrames[activeOppIdx] >= effectiveOppHpDebounce
            val confirmedOppHp = pendingConfirmOppSlotHpPct[activeOppIdx].coerceIn(1, 100)

            if (isOppHpConfirmed) {
                // v6.04: Only record Pre-Throw HP Jump Hint on debounced samples (never on 1-frame camera zoom-in spikes)
                if (pendingChargedAttackActor.isEmpty() && kotlin.math.abs(confirmedOppHp - currentOppHp) >= 15) {
                    preChargeOppHpJumpHint = true
                    preChargeOppHpJumpNewHp = confirmedOppHp
                    preChargeOppHpJumpMs = nowMs
                }
                val realOppDrop = lastScannedOppHp - confirmedOppHp
                val halfUserDmg = max(1, (userExactDmgPct * 0.50).roundToInt())
                val minUserFastDmgThreshold = halfUserDmg

                // v6.04 / v6.05 / v6.12: Block large (>4%) upward opponent HP jumps while a PLAYER charged attack is active or within 2500ms of defending a player charged attack,
                // or large (>=12%) mid-combat upward jumps after >=4 turns unless a switch occurred or >=5 consecutive frames confirm the new HP
                val isRecentOppSwitch = (nowMs - lastOppSwitchTimeMs) in 0L..2500L
                val isMidCombatUnlikelyOppUpwardJump = !isRecentOppSwitch &&
                    pendingChargedAttackActor.isEmpty() &&
                    oppSlotTurnsOnField[activeOppIdx] >= 4 &&
                    currentOppHp in 1..75 &&
                    (confirmedOppHp - currentOppHp) >= 12 &&
                    oppSlotHpConfirmFrames[activeOppIdx] < 5
                val isBlockingPostChargeOppUpwardJump = isMidCombatUnlikelyOppUpwardJump || (!isRecentOppSwitch &&
                    !isOpponentThrowingHpRescanWindow &&
                    (confirmedOppHp - currentOppHp) > 4 &&
                    (pendingChargedAttackActor == "user" ||
                        (lastUserChargedAttackLoggedMs > 0L &&
                            (nowMs - lastUserChargedAttackLoggedMs) in 0L..2500L &&
                            activeOppIdx == lastUserChargedDefenderOppSlotIdx)))

                if ((confirmedOppHp > currentOppHp || confirmedOppHp > lastScannedOppHp) && !isBlockingPostChargeOppUpwardJump) {
                    if (confirmedOppHp - currentOppHp >= 18 && currentOppHp in 1..85) {
                        oppSlotPriorHpPct[activeOppIdx] = currentOppHp
                        oppSlotLastBigJumpMs[activeOppIdx] = nowMs
                    }
                    // Immediate upward self-correction when N debounced samples (±2%) confirm a higher HP%
                    lastScannedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    confirmedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotPreFaintHpPct[activeOppIdx] = confirmedOppHp
                    predictedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreOppHp = confirmedOppHp
                        pendingChargedAttackPreOppSlotHp[activeOppIdx] = confirmedOppHp
                    }
                    pendingOppLowHpSlot = -1
                    pendingOppLowHpSample = -1
                    hpChanged = true
                } else if (realOppDrop in minUserFastDmgThreshold..25) {
                    lastScannedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    predictedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    confirmedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotPreFaintHpPct[activeOppIdx] = confirmedOppHp
                    if (confirmedOppHp < oppSlotLowestHpPct[activeOppIdx]) {
                        oppSlotLowestHpPct[activeOppIdx] = confirmedOppHp
                    }
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreOppHp = confirmedOppHp
                        pendingChargedAttackPreOppSlotHp[activeOppIdx] = confirmedOppHp
                    }
                    pendingOppLowHpSlot = -1
                    pendingOppLowHpSample = -1
                    hpChanged = true
                } else if (realOppDrop in 1 until minUserFastDmgThreshold && hasBattleStarted) {
                    lastScannedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    confirmedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotPreFaintHpPct[activeOppIdx] = confirmedOppHp
                    if (confirmedOppHp < oppSlotLowestHpPct[activeOppIdx]) {
                        oppSlotLowestHpPct[activeOppIdx] = confirmedOppHp
                    }
                    predictedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreOppHp = confirmedOppHp
                        pendingChargedAttackPreOppSlotHp[activeOppIdx] = confirmedOppHp
                    }
                    hpChanged = true
                } else if (realOppDrop > 25 || (isOpponentThrowingHpRescanWindow && confirmedOppHp != currentOppHp)) {
                    // v6.05: Always sync opponent HP drops >25% AND always rescan/sync opponent HP when opponent is throwing a charged move!
                    lastScannedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    confirmedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotHpPct[activeOppIdx] = confirmedOppHp
                    oppSlotPreFaintHpPct[activeOppIdx] = confirmedOppHp
                    if (confirmedOppHp < oppSlotLowestHpPct[activeOppIdx]) {
                        oppSlotLowestHpPct[activeOppIdx] = confirmedOppHp
                    }
                    predictedOppSlotHpPct[activeOppIdx] = confirmedOppHp
                    if (isOpponentThrowingHpRescanWindow) {
                        pendingChargedAttackPreOppHp = confirmedOppHp
                        pendingChargedAttackPreOppSlotHp[activeOppIdx] = confirmedOppHp
                    }
                    pendingOppLowHpSlot = -1
                    pendingOppLowHpSample = -1
                    hpChanged = true
                } else if (isOpponentThrowingHpRescanWindow && pendingChargedAttackPreOppHp != confirmedOppHp) {
                    pendingChargedAttackPreOppHp = confirmedOppHp
                    pendingChargedAttackPreOppSlotHp[activeOppIdx] = confirmedOppHp
                    hpChanged = true
                }

                // v5.12 / v5.13 / v6.04: Retroactive unshielded player CHARGED_ATTACK HP delta update & provisional chip-shield override
                // if opponent HP drop finishes settling 100-4500ms after Section 4 reconciled (with defender slot verification)!
                val recentUserChargeMs = max(
                    if (lastChargedPromptActor == "user") lastChargedAttackLoggedMs else 0L,
                    lastUserChargedAttackLoggedMs
                )
                val preOppHpRef = if (lastUserChargedAttackLoggedMs > 0L && (nowMs - lastUserChargedAttackLoggedMs) <= 4500L) {
                    lastUserChargedPreOppHp
                } else {
                    pendingChargedAttackPreOppHp
                }
                val postUserChargeDropFromPre = preOppHpRef - confirmedOppHp
                val sameDefendingOppSlot = (lastUserChargedDefenderOppSlotIdx == -1 || activeOppIdx == lastUserChargedDefenderOppSlotIdx) &&
                    (lastOppSwitchTimeMs <= recentUserChargeMs)
                if (pendingChargedAttackActor != "user" &&
                    recentUserChargeMs > 0L &&
                    (nowMs - recentUserChargeMs) in 1L..4500L &&
                    sameDefendingOppSlot &&
                    postUserChargeDropFromPre >= 5
                ) {
                    val lastUserEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "user" }
                    if (lastUserEvIdx >= 0) {
                        val existingEv = battleTimelineEvents[lastUserEvIdx]
                        val existingDelta = existingEv.hpDeltaPct ?: 0
                        val minOppOverrideDrop = max(6, ((existingEv.expectedMoveDmgPct ?: 20) * 0.35).toInt())
                        val canOverrideProvisionalOppShield = existingEv.shielded == true &&
                            lastUserChargedWasProvisionalShield &&
                            postUserChargeDropFromPre >= minOppOverrideDrop
                        if ((existingEv.shielded == false && postUserChargeDropFromPre > existingDelta + 2) || canOverrideProvisionalOppShield) {
                            if (canOverrideProvisionalOppShield) {
                                if (lastUserChargedAutoDecrementedShield) {
                                    oppShieldsRemaining = (oppShieldsRemaining + 1).coerceIn(0, 2)
                                    val shieldEvIdx = battleTimelineEvents.indexOfLast {
                                        it.type == "SHIELD" && it.actor == "opp" && kotlin.math.abs(it.t - existingEv.t) <= 0.5
                                    }
                                    if (shieldEvIdx >= 0) {
                                        battleTimelineEvents.removeAt(shieldEvIdx)
                                    }
                                }
                                lastUserChargedWasProvisionalShield = false
                                lastUserChargedAutoDecrementedShield = false
                            }
                            val targetUserEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "user" }
                            if (targetUserEvIdx >= 0) {
                                battleTimelineEvents[targetUserEvIdx] = battleTimelineEvents[targetUserEvIdx].copy(
                                    shielded = false,
                                    pokemonShielded = null,
                                    hpBeforePct = preOppHpRef,
                                    hpAfterPct = confirmedOppHp,
                                    hpDeltaPct = postUserChargeDropFromPre,
                                    oppSlotHpPct = oppSlotHpPct.toList(),
                                    oppShieldsRemaining = oppShieldsRemaining
                                )
                            }
                            hpChanged = true
                        }
                    }
                }
            }
        } else if (sampledOppHpPct == -1 || !canSampleOppHpBars) {
            pendingConfirmOppSlotHpPct[activeOppIdx] = -1
            oppSlotHpConfirmFrames[activeOppIdx] = 0
        }

        // Helper for opponent & player move energy lookup (used by Section 1C Dual-Meter Cross-Validation and Sections 2/3/4)
        val oppPlusMoveForStats = OverlayService.resolveMegaPlusMoveStatic(oppMetaForStats.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(activeOpponentName, activeLeague)
        val oppThirdMove = oppPlusMoveForStats
            ?: oppMetaForStats.chargedMove3.takeIf { it.isNotBlank() }
            ?: COMMON_THIRD_CHARGED_MOVE[oppMetaForStats.name]
            ?: "Outrage"
        val oppMoveNames = listOfNotNull(oppPlusMoveForStats, oppMetaForStats.chargedMove1, oppMetaForStats.chargedMove2, oppThirdMove, oppMetaForStats.chargedMove4)
            .filter { it.isNotBlank() }
            .distinct()
        val oppMoveEnergyMap = oppMoveNames.associateWith { mName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, oppMetaForStats.types.firstOrNull() ?: "normal")
            (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50).coerceIn(35, 100)
        }
        val cheapestOppEnergy = oppMoveEnergyMap.values.minOrNull() ?: 45

        val userPlusMoveEarly = OverlayService.resolveMegaPlusMoveStatic(userMetaForStats.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(userMonNameForStats, activeLeague)
        val userMoveNames = listOfNotNull(userMove1NameEarly, userMove2NameEarly, userPlusMoveEarly).filter { it.isNotBlank() }.distinct()
        val userMoveEnergyMap = userMoveNames.associateWith { mName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, userMetaForStats.types.firstOrNull() ?: "normal")
            (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50).coerceIn(35, 100)
        }
        val userPlusMoveEnergy = if (!userPlusMoveEarly.isNullOrBlank()) {
            (OverlayService.resolveChargedMoveStatsStatic(userPlusMoveEarly, userMetaForStats.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
        } else 0
        val cheapestUserEnergy = (if (userPlusMoveEnergy > 0) min(min(userMove1Energy, userMove2Energy), userPlusMoveEnergy) else min(userMove1Energy, userMove2Energy)).coerceIn(35, 100)
        val maxUserMoveEnergy = (if (userPlusMoveEnergy > 0) max(max(userMove1Energy, userMove2Energy), userPlusMoveEnergy) else max(userMove1Energy, userMove2Energy)).coerceIn(35, 100)

        // 1C. v3.88: Player Energy-to-Turns Conversion & Post-Charge Turn Recounting (Decoupled from Micro-Adjustments)
        //     - Converts confirmed player energy gain into player fast-move turns (`confirmedPhasePlayerTurns`).
        //     - Approximates single-turn timing in 500ms intervals between confirmed fast moves when `userFastTurns > 1`.
        //     - Decouples post-charge circle micro-adjustments from energy gain and recounts turns from `newEnergy - (oldEnergy - chargeMoveEnergy)`.
        //     - No idle timer fallback (prevents false opponent energy gain during charged move animations or pauses).
        val userMoveDurationMs = (userFastTurnsForStats * 500L).coerceAtLeast(500L)
        val microAdjustThreshold = (userFastEnergyForStats * 0.65).roundToInt().coerceAtLeast(2)
        if (activeUserIdx in 0..2) {
            playerSlotEverOnField[activeUserIdx] = true
        }
        if (isCountdownDimmedState) {
            playerSlotEnergy[activeUserIdx] = 0
            phaseStartPlayerEnergy = 0
            confirmedPhasePlayerTurns = 0
            phasePlayerTurns = 0
            lastConfirmedPlayerFastMoveMs = 0L
            candidateSlowestFillPct[activeUserIdx] = 0
            slowestFillDebounceCount[activeUserIdx] = 0
            confirmedSlowestFillPct[activeUserIdx] = 0
            candidateFastestFillPct[activeUserIdx] = 0
            fastestFillDebounceCount[activeUserIdx] = 0
            confirmedFastestFillPct[activeUserIdx] = 0
            slowestMeterInThirdFill[activeUserIdx] = false
            fasterMeterInThirdFill[activeUserIdx] = false
            peakSecondFillPct[activeUserIdx] = 0
            peakFastestSecondFillPct[activeUserIdx] = 0
        } else if (canAccumulateFastEnergy &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            (sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300)
        ) {
            val userSpeciesPrimaryType = userMetaForStats.types.firstOrNull() ?: "normal"
            val slowestIsRight = shouldSelectRightCircleAsPrimary(
                move1Name = userMove1NameEarly,
                move1Cost = userMove1Energy,
                move2Name = userMove2NameEarly,
                move2Cost = userMove2Energy,
                hasSecondMove = hasSecondUserMove,
                fallbackSpeciesType = userSpeciesPrimaryType
            )
            val slowestMoveName = if (slowestIsRight) userMove2NameEarly else userMove1NameEarly
            val fasterMoveName = if (slowestIsRight) userMove1NameEarly else userMove2NameEarly
            val slowestMoveCost = if (slowestIsRight) userMove2Energy else userMove1Energy
            val fasterMoveCost = if (slowestIsRight) userMove1Energy else userMove2Energy
            val primaryContrastRank = getMoveScannerContrastRank(slowestMoveName, userSpeciesPrimaryType)
            val secondaryContrastRank = getMoveScannerContrastRank(fasterMoveName, userSpeciesPrimaryType)
            val slowestFillPct = if (slowestIsRight) sampledRightChargeBtnFillPct else sampledLeftChargeBtnFillPct
            val fasterFillPct = if (slowestIsRight) sampledLeftChargeBtnFillPct else sampledRightChargeBtnFillPct
            val slowestOnline = slowestFillPct in 0..300
            val fasterOnline = hasSecondUserMove && fasterFillPct in 0..300

            // v4.06: Debounce both Slowest and Fastest Charge Move Circles (±2% circle fill tolerance)
            // and allow the faster circle (e.g. Xerneas's vibrant pink Moonblast 50E) to advance energy even if
            // white Geomancy floor spotlights transiently wash out the slower circle (Giga Impact 80E)!
            if (slowestOnline || fasterOnline) {
                if (sampledLeftChargeBtnFillPct in 0..300) {
                    lastScannedLeftChargeFillPct[activeUserIdx] = sampledLeftChargeBtnFillPct
                    if (sampledLeftChargeBtnFillPct >= 195) leftMeterFilledTwiceLatched[activeUserIdx] = true
                }
                if (sampledRightChargeBtnFillPct in 0..300) {
                    lastScannedRightChargeFillPct[activeUserIdx] = sampledRightChargeBtnFillPct
                    if (sampledRightChargeBtnFillPct >= 195) rightMeterFilledTwiceLatched[activeUserIdx] = true
                }

                val tol = activeDebounceTolerancePct.coerceIn(0, 3)
                if (slowestOnline) {
                    if (candidateSlowestFillPct[activeUserIdx] >= 0 && kotlin.math.abs(slowestFillPct - candidateSlowestFillPct[activeUserIdx]) <= tol) {
                        slowestFillDebounceCount[activeUserIdx]++
                        candidateSlowestFillPct[activeUserIdx] = ((candidateSlowestFillPct[activeUserIdx] + slowestFillPct) / 2.0).roundToInt()
                    } else {
                        candidateSlowestFillPct[activeUserIdx] = slowestFillPct
                        slowestFillDebounceCount[activeUserIdx] = 1
                    }
                } else {
                    slowestFillDebounceCount[activeUserIdx] = 0
                }

                if (fasterOnline) {
                    if (candidateFastestFillPct[activeUserIdx] >= 0 && kotlin.math.abs(fasterFillPct - candidateFastestFillPct[activeUserIdx]) <= tol) {
                        fastestFillDebounceCount[activeUserIdx]++
                        candidateFastestFillPct[activeUserIdx] = ((candidateFastestFillPct[activeUserIdx] + fasterFillPct) / 2.0).roundToInt()
                    } else {
                        candidateFastestFillPct[activeUserIdx] = fasterFillPct
                        fastestFillDebounceCount[activeUserIdx] = 1
                    }
                } else {
                    fastestFillDebounceCount[activeUserIdx] = 0
                }

                val requiredDebounce = activeEnergyDebounceSamples.coerceIn(2, 4)
                val slowestDebouncedReady = slowestOnline && slowestFillDebounceCount[activeUserIdx] >= requiredDebounce
                val fasterDebouncedReady = fasterOnline && fastestFillDebounceCount[activeUserIdx] >= requiredDebounce
                if (slowestDebouncedReady || fasterDebouncedReady) {
                    val debouncedFillPct = if (slowestDebouncedReady) {
                        candidateSlowestFillPct[activeUserIdx].coerceIn(0, 300).also {
                            confirmedSlowestFillPct[activeUserIdx] = it
                        }
                    } else {
                        -1
                    }
                    val debouncedFasterPct = if (fasterDebouncedReady) {
                        candidateFastestFillPct[activeUserIdx].coerceIn(0, 300).also {
                            confirmedFastestFillPct[activeUserIdx] = it
                        }
                    } else if (confirmedFastestFillPct[activeUserIdx] in 0..300 && fasterFillPct in 0..300 && kotlin.math.abs(fasterFillPct - confirmedFastestFillPct[activeUserIdx]) <= 5) {
                        confirmedFastestFillPct[activeUserIdx]
                    } else {
                        fasterFillPct
                    }

                    if (slowestIsRight) {
                        if (debouncedFillPct in 0..300) {
                            if (debouncedFillPct >= lastStableRightChargeFillPct - 3) {
                                prevStableRightChargeFillPct = max(prevStableRightChargeFillPct, lastStableRightChargeFillPct)
                            } else {
                                prevStableRightChargeFillPct = lastStableRightChargeFillPct
                            }
                            lastStableRightChargeFillPct = debouncedFillPct
                        }
                        if (debouncedFasterPct in 0..300) {
                            if (debouncedFasterPct >= lastStableLeftChargeFillPct - 3) {
                                prevStableLeftChargeFillPct = max(prevStableLeftChargeFillPct, lastStableLeftChargeFillPct)
                            } else {
                                prevStableLeftChargeFillPct = lastStableLeftChargeFillPct
                            }
                            lastStableLeftChargeFillPct = debouncedFasterPct
                        }
                    } else {
                        if (debouncedFillPct in 0..300) {
                            if (debouncedFillPct >= lastStableLeftChargeFillPct - 3) {
                                prevStableLeftChargeFillPct = max(prevStableLeftChargeFillPct, lastStableLeftChargeFillPct)
                            } else {
                                prevStableLeftChargeFillPct = lastStableLeftChargeFillPct
                            }
                            lastStableLeftChargeFillPct = debouncedFillPct
                        }
                        if (debouncedFasterPct in 0..300) {
                            if (debouncedFasterPct >= lastStableRightChargeFillPct - 3) {
                                prevStableRightChargeFillPct = max(prevStableRightChargeFillPct, lastStableRightChargeFillPct)
                            } else {
                                prevStableRightChargeFillPct = lastStableRightChargeFillPct
                            }
                            lastStableRightChargeFillPct = debouncedFasterPct
                        }
                    }

                    // Post-Throw Circle Verification & Round Resync (v5.12: BANNER_OCR Move Lock + Zero Post-Cutscene Turn Inflation):
                    if (awaitingPostUserChargeCircleSync && debouncedFillPct in 0..300) {
                        rollbackPendingProactiveStep(markAnchorRolledBack = false)
                        proactiveRolledBackAnchorMs = 0L
                        awaitingPostUserChargeCircleSync = false
                        val debouncedLeftForFit = if (slowestIsRight) debouncedFasterPct else debouncedFillPct
                        val debouncedRightForFit = if (slowestIsRight) debouncedFillPct else debouncedFasterPct

                        // v5.12 / v6.20: Never allow post-throw circle fill heuristics to overwrite a move confirmed by BANNER_OCR!
                        // Evaluate Move 1, Move 2, and (when active in Mega League) the 3rd Super Mega Plus Move.
                        if (!lastUserChargeWasBannerOcr &&
                            (hasSecondUserMove || userPlusMoveEnergy > 0) &&
                            lastUserChargePreEnergySnapshot >= cheapestUserEnergy
                        ) {
                            val candidateFits = mutableListOf<Triple<String, Int, Double>>()
                            if (lastUserChargePreEnergySnapshot >= userMove1Energy) {
                                val rem1 = (lastUserChargePreEnergySnapshot - userMove1Energy).coerceIn(0, 100)
                                val err1 = min(
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, rem1),
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, (rem1 + userFastEnergyForStats).coerceAtMost(100))
                                )
                                candidateFits.add(Triple(userMove1NameEarly, userMove1Energy, err1))
                            }
                            if (hasSecondUserMove && userMove2Energy != userMove1Energy && lastUserChargePreEnergySnapshot >= userMove2Energy) {
                                val rem2 = (lastUserChargePreEnergySnapshot - userMove2Energy).coerceIn(0, 100)
                                val err2 = min(
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, rem2),
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, (rem2 + userFastEnergyForStats).coerceAtMost(100))
                                )
                                candidateFits.add(Triple(userMove2NameEarly, userMove2Energy, err2))
                            }
                            if (!userPlusMoveEarly.isNullOrBlank() &&
                                userPlusMoveEnergy > 0 &&
                                userPlusMoveEnergy != userMove1Energy &&
                                userPlusMoveEnergy != userMove2Energy &&
                                lastUserChargePreEnergySnapshot >= userPlusMoveEnergy
                            ) {
                                val rem3 = (lastUserChargePreEnergySnapshot - userPlusMoveEnergy).coerceIn(0, 100)
                                val err3 = min(
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, rem3),
                                    scorePostThrowCircleFit(debouncedLeftForFit, debouncedRightForFit, userMove1Energy, userMove2Energy, hasSecondUserMove, (rem3 + userFastEnergyForStats).coerceAtMost(100))
                                )
                                candidateFits.add(Triple(userPlusMoveEarly, userPlusMoveEnergy, err3))
                            }
                            val sortedFits = candidateFits.sortedBy { it.third }
                            val verifiedMove = if (sortedFits.size >= 2 && sortedFits[0].third + 2.0 < sortedFits[1].third) {
                                sortedFits[0].first to sortedFits[0].second
                            } else null

                            if (verifiedMove != null && verifiedMove.second != lastUserChargeDeductedEnergySnapshot) {
                                lastUserChargeDeductedEnergySnapshot = verifiedMove.second
                                lastUserChargeResolvedMoveName = verifiedMove.first
                                val lastEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "user" }
                                if (lastEvIdx >= 0) {
                                    val ev = battleTimelineEvents[lastEvIdx]
                                    val preE = ev.preThrowEnergy ?: lastUserChargePreEnergySnapshot
                                    battleTimelineEvents[lastEvIdx] = ev.copy(
                                        inferredMoveName = verifiedMove.first,
                                        requiredMoveEnergy = verifiedMove.second,
                                        energyDeficit = max(0, verifiedMove.second - preE),
                                        moveResolutionSource = "POST_THROW_CIRCLE_FIT"
                                    )
                                }
                            }
                        }

                        val postChargeBaseEnergy = (lastUserChargePreEnergySnapshot - lastUserChargeDeductedEnergySnapshot).coerceIn(0, 100)
                        val measuredEnergy = resolvePostThrowCircleEnergyAndResyncRound(
                            slotIdx = activeUserIdx,
                            slowestIsRight = slowestIsRight,
                            slowestMoveCost = slowestMoveCost,
                            fasterMoveCost = fasterMoveCost,
                            hasSecondUserMove = hasSecondUserMove,
                            debouncedSlowestPct = debouncedFillPct,
                            debouncedFasterPct = debouncedFasterPct,
                            expectedPostEnergy = postChargeBaseEnergy,
                            userFastEnergy = userFastEnergyForStats,
                            nowMs = nowMs
                        )
                        val lastEvIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "user" }
                        if (lastEvIdx >= 0) {
                            battleTimelineEvents[lastEvIdx] = battleTimelineEvents[lastEvIdx].copy(
                                userEnergy = measuredEnergy
                            )
                        }

                        // v5.12: Post-throw circle sync strictly anchors the new post-cutscene phase at Turn 0 (`confirmedPhasePlayerTurns = 0`)
                        // without converting post-cutscene circle calibration diffs into phantom fast-move turns or free opponent energy!
                        confirmedPhasePlayerTurns = 0
                        phasePlayerTurns = 0
                        phaseOppTurns = 0
                        phaseStartPlayerEnergy = measuredEnergy
                        lastConfirmedPlayerFastMoveMs = 0L
                        lastMicroCorrectionTimeMs = nowMs

                        playerSlotEnergy[activeUserIdx] = measuredEnergy
                        playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
                        val postLeftPct = if (slowestIsRight) debouncedFasterPct else debouncedFillPct
                        val postRightPct = if (slowestIsRight) debouncedFillPct else debouncedFasterPct
                        emitEnergyUpdateToastIfEnabled(
                            slotIdx = activeUserIdx,
                            moveName = slowestMoveName,
                            moveCost = slowestMoveCost,
                            circleFillPct = debouncedFillPct,
                            newEnergy = measuredEnergy,
                            primaryAtkIndex = if (slowestIsRight) 2 else 1,
                            leftFillPct = postLeftPct,
                            leftEnergy = computeSingleCircleSnappedEnergy(activeUserIdx, postLeftPct, userMove1Energy, userFastEnergyForStats),
                            rightFillPct = postRightPct,
                            rightEnergy = if (hasSecondUserMove) computeSingleCircleSnappedEnergy(activeUserIdx, postRightPct, userMove2Energy, userFastEnergyForStats) else -1,
                            hasSecondMove = hasSecondUserMove
                        )
                        hpChanged = true
                    } else {
                        // v4.12: While a proactive ~300ms early step is pending confirmation, evaluate Section 1C against
                        // the pre-proactive confirmed baseline (`proactiveStepPreEnergy`) so the still-rising circle does not
                        // falsely trigger `primaryProvesBelowCost` and so the real debounced circle step is cleanly detected
                        // and absorbed when it arrives!
                        val curE = if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) {
                            proactiveStepPreEnergy.coerceIn(0, 100)
                        } else {
                            playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
                        }
                        val rawMeasuredEnergy = resolveSub50AndMultiRoundEnergy(
                            slotIdx = activeUserIdx,
                            slowestIsRight = slowestIsRight,
                            slowestMoveCost = slowestMoveCost,
                            fasterMoveCost = fasterMoveCost,
                            hasSecondUserMove = hasSecondUserMove,
                            debouncedSlowestPct = debouncedFillPct,
                            debouncedFasterPct = debouncedFasterPct,
                            curE = curE,
                            userFastEnergy = userFastEnergyForStats,
                            userMoveDurationMs = userMoveDurationMs,
                            nowMs = nowMs,
                            canAdvanceMonotonically = canAccumulateFastEnergy,
                            primaryContrastRank = primaryContrastRank,
                            secondaryContrastRank = secondaryContrastRank
                        )
                        // v4.09 / v6.12: Allow downward self-correction ONLY when BOTH circles are visible, neither circle is in a pre-minigame shrink/fade drop (>18% drop),
                        // and the <100% dark-grey border persists for >= 5 consecutive normal-combat frames!
                        val bothCirclesVisibleForDownwardCheck = !hasSecondUserMove || (debouncedFillPct >= 0 && debouncedFasterPct >= 0)
                        val isRapidShrinkFadeDrop = (lastStableLeftChargeFillPct >= 95 && debouncedFillPct in 1..(lastStableLeftChargeFillPct - 18)) ||
                            (hasSecondUserMove && lastStableRightChargeFillPct >= 95 && debouncedFasterPct in 1..(lastStableRightChargeFillPct - 18))
                        val rawPrimaryBelowCost = bothCirclesVisibleForDownwardCheck && !isRapidShrinkFadeDrop && slowestDebouncedReady && debouncedFillPct in 1..90 && curE >= slowestMoveCost
                        val rawSecondaryBelowCost = bothCirclesVisibleForDownwardCheck && !isRapidShrinkFadeDrop && fasterDebouncedReady && debouncedFasterPct in 1..90 && curE >= fasterMoveCost
                        if (rawPrimaryBelowCost || rawSecondaryBelowCost) {
                            circleBelowCostStableFrames[activeUserIdx] = (circleBelowCostStableFrames[activeUserIdx] + 1).coerceAtMost(10)
                        } else {
                            circleBelowCostStableFrames[activeUserIdx] = 0
                        }
                        val primaryProvesBelowCost = rawPrimaryBelowCost && circleBelowCostStableFrames[activeUserIdx] >= 5
                        val secondaryProvesBelowCost = rawSecondaryBelowCost && circleBelowCostStableFrames[activeUserIdx] >= 5
                        if (primaryProvesBelowCost || secondaryProvesBelowCost) {
                            playerSlotCeilingLatched100[activeUserIdx] = false
                            nearCeilingStepStartMs[activeUserIdx] = 0L
                        }
                        val measuredEnergy = if (hasBattleStarted && curE > 0 && !primaryProvesBelowCost && !secondaryProvesBelowCost) {
                            max(curE, rawMeasuredEnergy)
                        } else {
                            rawMeasuredEnergy
                        }
                        val diffE = kotlin.math.abs(curE - measuredEnergy)
                        val isValidZeroSnap = debouncedFillPct > 0 || (hasSecondUserMove && debouncedFasterPct > 0) || curE <= userFastEnergyForStats * 2
                        if (diffE >= 1 && isValidZeroSnap && (hasBattleStarted || measuredEnergy >= userFastEnergyForStats)) {
                            if (!hasBattleStarted && measuredEnergy > 0) {
                                hasBattleStarted = true
                                battleClockAnchorMs = nowMs - userMoveDurationMs
                                lastTurnTickTimeMs = nowMs
                                turnResidualMs = 0L
                                phaseStartPlayerEnergy = 0
                                confirmedPhasePlayerTurns = 0
                                phasePlayerTurns = 0
                            }

                            // v3.88 Requirement #1 & #5 + v3.96 Single-Step Cap: Convert player energy gain to turns while decoupling micro-adjustments
                            val confirmedMovesSoFar = confirmedPhasePlayerTurns / userFastTurnsForStats
                            val expectedEnergyAtConfirmedTurns = (phaseStartPlayerEnergy + confirmedMovesSoFar * userFastEnergyForStats).coerceIn(0, 100)
                            val uncreditedEnergyGain = measuredEnergy - expectedEnergyAtConfirmedTurns
                            val deltaFromCurrent = measuredEnergy - curE

                            if (uncreditedEnergyGain >= microAdjustThreshold) {
                                val rawNewMoves = (uncreditedEnergyGain.toDouble() / userFastEnergyForStats.toDouble()).roundToInt().coerceAtLeast(1)
                                val newMoves = if (curE > 0) rawNewMoves.coerceIn(1, 2) else rawNewMoves.coerceIn(1, 4)
                                val addedTurns = newMoves * userFastTurnsForStats
                                val alreadyProactivelyAddedTurns = if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) {
                                    proactiveStepAddedTurns
                                } else {
                                    0
                                }
                                clearPendingProactiveStep()
                                proactiveRolledBackAnchorMs = 0L
                                confirmedPhasePlayerTurns += addedTurns
                                phasePlayerTurns = max(phasePlayerTurns, confirmedPhasePlayerTurns)
                                val netTurnsToAdd = (addedTurns - alreadyProactivelyAddedTurns).coerceAtLeast(0)
                                playerSlotTurnsOnField[activeUserIdx] = (playerSlotTurnsOnField[activeUserIdx] + netTurnsToAdd).coerceAtLeast(0)
                                if (battleTurnIndex < confirmedPhasePlayerTurns) {
                                    battleTurnIndex = confirmedPhasePlayerTurns
                                }
                                lastConfirmedPlayerFastMoveMs = nowMs
                                playerLastFastCreditedAtMs[activeUserIdx] = nowMs
                                playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
                                userFastMovesCreditedThisFrame = newMoves
                                observedPlayerChargeBarStep = true
                            } else if (kotlin.math.abs(deltaFromCurrent) < microAdjustThreshold || deltaFromCurrent < 0) {
                                if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) {
                                    rollbackPendingProactiveStep(markAnchorRolledBack = false)
                                }
                                // Micro-adjustment or physical ring-bound self-correction: shift baseline so turns are unaffected
                                phaseStartPlayerEnergy = (phaseStartPlayerEnergy + deltaFromCurrent).coerceIn(0, 100)
                                lastMicroCorrectionTimeMs = nowMs
                            }

                            playerSlotEnergy[activeUserIdx] = measuredEnergy
                            val curLeftPct = if (slowestIsRight) debouncedFasterPct else debouncedFillPct
                            val curRightPct = if (slowestIsRight) debouncedFillPct else debouncedFasterPct
                            emitEnergyUpdateToastIfEnabled(
                                slotIdx = activeUserIdx,
                                moveName = slowestMoveName,
                                moveCost = slowestMoveCost,
                                circleFillPct = debouncedFillPct,
                                newEnergy = measuredEnergy,
                                primaryAtkIndex = if (slowestIsRight) 2 else 1,
                                leftFillPct = curLeftPct,
                                leftEnergy = computeSingleCircleSnappedEnergy(activeUserIdx, curLeftPct, userMove1Energy, userFastEnergyForStats),
                                rightFillPct = curRightPct,
                                rightEnergy = if (hasSecondUserMove) computeSingleCircleSnappedEnergy(activeUserIdx, curRightPct, userMove2Energy, userFastEnergyForStats) else -1,
                                hasSecondMove = hasSecondUserMove
                            )
                            hpChanged = true
                        }
                    }
                }
            } else {
                slowestFillDebounceCount[activeUserIdx] = 0
                fastestFillDebounceCount[activeUserIdx] = 0
            }
        }

        // v4.01 / v4.09 / v4.13: 100E Ceiling Step Latch After 1 Fast-Move Duration (`userMoveDurationMs`)
        // Requires the highest-cost move circle to also be >= 98% (white ring active) so a Pokemon with an 80E second move
        // (e.g. Xerneas Giga Impact 80E) can never latch 100E while Giga Impact still has a dark-grey (<98%) border!
        if (hasBattleStarted &&
            canAccumulateFastEnergy &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            activeUserIdx in 0..2
        ) {
            val curSlotE = if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) {
                proactiveStepPreEnergy.coerceIn(0, 100)
            } else {
                playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
            }
            val maxCostCirclePct = if (hasSecondUserMove && userMove2Energy >= userMove1Energy) {
                sampledRightChargeBtnFillPct
            } else {
                sampledLeftChargeBtnFillPct
            }
            val canLatchCeiling100 = maxCostCirclePct >= 98
            if (curSlotE in 1..99 && (curSlotE + userFastEnergyForStats) > 100 && canLatchCeiling100 && !playerSlotCeilingLatched100[activeUserIdx]) {
                if (nearCeilingStepStartMs[activeUserIdx] <= 0L) {
                    nearCeilingStepStartMs[activeUserIdx] = nowMs
                } else if ((nowMs - nearCeilingStepStartMs[activeUserIdx]) >= userMoveDurationMs) {
                    val alreadyAddedTurns = if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) proactiveStepAddedTurns else 0
                    clearPendingProactiveStep()
                    proactiveRolledBackAnchorMs = 0L
                    playerSlotCeilingLatched100[activeUserIdx] = true
                    nearCeilingStepStartMs[activeUserIdx] = 0L
                    playerSlotEnergy[activeUserIdx] = 100
                    playerSlotEnergyAnchor[activeUserIdx] = 100
                    confirmedPhasePlayerTurns += userFastTurnsForStats
                    phasePlayerTurns = max(phasePlayerTurns, confirmedPhasePlayerTurns)
                    playerSlotTurnsOnField[activeUserIdx] = (playerSlotTurnsOnField[activeUserIdx] + (userFastTurnsForStats - alreadyAddedTurns).coerceAtLeast(0)).coerceAtLeast(0)
                    if (battleTurnIndex < confirmedPhasePlayerTurns) {
                        battleTurnIndex = confirmedPhasePlayerTurns
                    }
                    lastConfirmedPlayerFastMoveMs = nowMs
                    playerLastFastCreditedAtMs[activeUserIdx] = nowMs
                    playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
                    userFastMovesCreditedThisFrame = max(userFastMovesCreditedThisFrame, 1)
                    val slowestIsRightForToast = shouldSelectRightCircleAsPrimary(
                        move1Name = userMove1NameEarly,
                        move1Cost = userMove1Energy,
                        move2Name = userMove2NameEarly,
                        move2Cost = userMove2Energy,
                        hasSecondMove = hasSecondUserMove,
                        fallbackSpeciesType = userMetaForStats.types.firstOrNull() ?: "normal"
                    )
                    val slowestMoveNameForToast = if (slowestIsRightForToast) userMove2NameEarly else userMove1NameEarly
                    val slowestMoveCostForToast = if (slowestIsRightForToast) userMove2Energy else userMove1Energy
                    val slowestFillForToast = if (slowestIsRightForToast) sampledRightChargeBtnFillPct else sampledLeftChargeBtnFillPct
                    emitEnergyUpdateToastIfEnabled(
                        slotIdx = activeUserIdx,
                        moveName = slowestMoveNameForToast,
                        moveCost = slowestMoveCostForToast,
                        circleFillPct = slowestFillForToast,
                        newEnergy = 100,
                        primaryAtkIndex = if (slowestIsRightForToast) 2 else 1,
                        leftFillPct = sampledLeftChargeBtnFillPct,
                        leftEnergy = computeSingleCircleSnappedEnergy(activeUserIdx, sampledLeftChargeBtnFillPct, userMove1Energy, userFastEnergyForStats),
                        rightFillPct = sampledRightChargeBtnFillPct,
                        rightEnergy = if (hasSecondUserMove) computeSingleCircleSnappedEnergy(activeUserIdx, sampledRightChargeBtnFillPct, userMove2Energy, userFastEnergyForStats) else -1,
                        hasSecondMove = hasSecondUserMove
                    )
                    hpChanged = true
                }
            } else {
                nearCeilingStepStartMs[activeUserIdx] = 0L
            }
        } else if (activeUserIdx in 0..2 && (!canAccumulateFastEnergy || pendingChargedAttackActor.isNotEmpty())) {
            nearCeilingStepStartMs[activeUserIdx] = 0L
        }

        // 1C.5. v4.12 / v4.13: Proactive ~300ms Early Fast-Move Energy & Turn Step (Player + Opponent, Including at 100E Player Ceiling)
        //       - Once at least 1 confirmed fast move has occurred in the current phase (`confirmedPhasePlayerTurns > 0`)
        //         or the player is at 100E with full Charge Move Circles visible on screen, proactively advances player turns
        //         (and player energy if <100E) `activeProactiveEnergyLeadMs` (~300ms default) before the next expected
        //         fast-move completion (`elapsed >= userMoveDurationMs - leadMs`).
        //       - When player energy is at 100%, continues cycling the predictive turn clock and 500ms sub-turn interpolation
        //         so the opponent energy meter (`oppSlotEnergy`) keeps charging smoothly in real time, gated by all charge-scene
        //         animation cut and combat gates (`canAccumulateFastEnergy` + visible >=95% Charge Move Circles).
        //       - If a charge scene animation cut occurs (`!canAccumulateFastEnergy` or circles disappear) or a <100E circle
        //         confirmation lags by more than one 500ms turn (`nowMs > expectedConfirmMs + 500L`), immediately rolls back
        //         both player and opponent energy/turns to the last confirmed baseline.
        val maxCostCirclePctFor100 = if (hasSecondUserMove && userMove2Energy >= userMove1Energy) {
            sampledRightChargeBtnFillPct
        } else {
            sampledLeftChargeBtnFillPct
        }
        val areCirclesVisibleAt100 = maxCostCirclePctFor100 >= 95 &&
            (sampledLeftChargeBtnFillPct >= 95 || !hasSecondUserMove || sampledRightChargeBtnFillPct >= 95)

        // At 100E, Charge Move Circles cannot increase past 100% (so Section 1C has diffE == 0).
        // Confirm a pending 100E proactive turn step once `nowMs >= proactiveStepExpectedConfirmMs` while combat & circles remain active.
        if (hasBattleStarted &&
            canAccumulateFastEnergy &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            activeUserIdx in 0..2 &&
            activeOppIdx in 0..2 &&
            !awaitingPostUserChargeCircleSync &&
            proactiveStepPending &&
            proactiveStepSlotIdx == activeUserIdx &&
            proactiveStepPreEnergy >= 100 &&
            areCirclesVisibleAt100 &&
            nowMs >= proactiveStepExpectedConfirmMs &&
            nowMs <= (proactiveStepExpectedConfirmMs + 500L)
        ) {
            val addedTurns = proactiveStepAddedTurns.coerceAtLeast(userFastTurnsForStats)
            clearPendingProactiveStep()
            proactiveRolledBackAnchorMs = 0L
            playerSlotCeilingLatched100[activeUserIdx] = true
            playerSlotEnergy[activeUserIdx] = 100
            playerSlotEnergyAnchor[activeUserIdx] = 100
            confirmedPhasePlayerTurns += addedTurns
            phasePlayerTurns = max(phasePlayerTurns, confirmedPhasePlayerTurns)
            if (battleTurnIndex < confirmedPhasePlayerTurns) {
                battleTurnIndex = confirmedPhasePlayerTurns
            }
            lastConfirmedPlayerFastMoveMs = if (nowMs - proactiveStepExpectedConfirmMs <= 450L) {
                proactiveStepExpectedConfirmMs
            } else {
                nowMs
            }
            playerLastFastCreditedAtMs[activeUserIdx] = nowMs
            playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
            userFastMovesCreditedThisFrame = max(userFastMovesCreditedThisFrame, 1)
            hpChanged = true
        }

        if (proactiveStepPending) {
            val isAt100Proactive = proactiveStepPreEnergy >= 100
            val shouldRollbackProactive = !hasBattleStarted ||
                !canAccumulateFastEnergy ||
                (isAt100Proactive && !areCirclesVisibleAt100) ||
                activeUserIdx != proactiveStepSlotIdx ||
                playerFaintedSlots[activeUserIdx] ||
                oppFaintedSlots[activeOppIdx] ||
                awaitingPostUserChargeCircleSync ||
                nowMs > (proactiveStepExpectedConfirmMs + 500L)
            if (shouldRollbackProactive) {
                val markAnchor = nowMs > (proactiveStepExpectedConfirmMs + 500L)
                rollbackPendingProactiveStep(markAnchorRolledBack = markAnchor)
                hpChanged = true
            }
        } else if (phasePlayerTurns > confirmedPhasePlayerTurns &&
            (!hasBattleStarted ||
                !canAccumulateFastEnergy ||
                (playerSlotEnergy.getOrElse(activeUserIdx) { 0 } >= 100 && !areCirclesVisibleAt100) ||
                playerFaintedSlots.getOrElse(activeUserIdx) { false } ||
                oppFaintedSlots.getOrElse(activeOppIdx) { false } ||
                awaitingPostUserChargeCircleSync)
        ) {
            // Immediately roll back any unconfirmed sub-turn interpolated opponent energy when a charge-scene animation cut starts
            rollbackPendingProactiveStep(markAnchorRolledBack = false)
            hpChanged = true
        }

        if (hasBattleStarted &&
            canAccumulateFastEnergy &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            activeUserIdx in 0..2 &&
            activeOppIdx in 0..2
        ) {
            // Snapshot confirmed opponent state at the start of each confirmed move cycle before any sub-turn or proactive step
            if (!proactiveStepPending && phasePlayerTurns <= confirmedPhasePlayerTurns) {
                confirmedMoveOppSlotIdx = activeOppIdx
                confirmedMoveOppEnergy = oppSlotEnergy[activeOppIdx].coerceIn(0, 100)
                confirmedMoveOppTurnsOnField = oppSlotTurnsOnField[activeOppIdx].coerceAtLeast(0)
                confirmedMovePhaseOppTurns = phaseOppTurns.coerceAtLeast(0)
            }

            // Self-heal phase cadence anchor when player is at 100E (e.g. re-entering at 100E or resuming after a charged move scene)
            if (!proactiveStepPending &&
                playerSlotEnergy[activeUserIdx] >= 100 &&
                areCirclesVisibleAt100 &&
                !awaitingPostUserChargeCircleSync
            ) {
                playerSlotCeilingLatched100[activeUserIdx] = true
                if (lastConfirmedPlayerFastMoveMs <= 0L ||
                    (nowMs - lastConfirmedPlayerFastMoveMs) > (userMoveDurationMs + 500L)
                ) {
                    lastConfirmedPlayerFastMoveMs = if (confirmedPhasePlayerTurns == 0) nowMs + 200L else nowMs
                    proactiveRolledBackAnchorMs = 0L
                }
            }

            val leadMs = activeProactiveEnergyLeadMs.coerceIn(0, 400).toLong()
            val curConfirmedE = playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
            val isAt100ReadyForClock = curConfirmedE >= 100 && areCirclesVisibleAt100
            if (!proactiveStepPending &&
                (confirmedPhasePlayerTurns > 0 || isAt100ReadyForClock) &&
                lastConfirmedPlayerFastMoveMs > 0L &&
                nowMs >= lastConfirmedPlayerFastMoveMs &&
                lastConfirmedPlayerFastMoveMs != proactiveRolledBackAnchorMs &&
                userFastMovesCreditedThisFrame == 0 &&
                !awaitingPostUserChargeCircleSync
            ) {
                val elapsedSinceLastConfirmedMoveMs = (nowMs - lastConfirmedPlayerFastMoveMs).coerceAtLeast(0L)
                val proactiveTriggerElapsedMs = (userMoveDurationMs - leadMs).coerceAtLeast(100L)
                val expectedConfirmMs = lastConfirmedPlayerFastMoveMs + userMoveDurationMs
                if (curConfirmedE < 100) {
                    if (leadMs > 0L &&
                        elapsedSinceLastConfirmedMoveMs >= proactiveTriggerElapsedMs &&
                        nowMs <= (expectedConfirmMs + 500L)
                    ) {
                        val nextProactiveE = (curConfirmedE + userFastEnergyForStats).coerceIn(0, 100)
                        val addedE = (nextProactiveE - curConfirmedE).coerceAtLeast(0)
                        if (addedE > 0) {
                            proactiveStepPending = true
                            proactiveStepSlotIdx = activeUserIdx
                            proactiveStepPreEnergy = curConfirmedE
                            proactiveStepAddedEnergy = addedE
                            proactiveStepAddedTurns = userFastTurnsForStats
                            proactiveStepExpectedConfirmMs = expectedConfirmMs
                            proactiveStepPreOppSlotIdx = activeOppIdx
                            proactiveStepPreOppEnergy = oppSlotEnergy[activeOppIdx].coerceIn(0, 100)
                            proactiveStepPreOppTurnsOnField = oppSlotTurnsOnField[activeOppIdx].coerceAtLeast(0)
                            proactiveStepPrePhaseOppTurns = phaseOppTurns.coerceAtLeast(0)

                            playerSlotEnergy[activeUserIdx] = nextProactiveE
                            playerSlotTurnsOnField[activeUserIdx] = (playerSlotTurnsOnField[activeUserIdx] + userFastTurnsForStats).coerceAtLeast(0)
                            phasePlayerTurns = confirmedPhasePlayerTurns + userFastTurnsForStats
                            playerSlotCurrentMoveTurns[activeUserIdx] = 0
                            if (battleTurnIndex < phasePlayerTurns) {
                                battleTurnIndex = phasePlayerTurns
                            }

                            val slowestIsRightForToast = shouldSelectRightCircleAsPrimary(
                                move1Name = userMove1NameEarly,
                                move1Cost = userMove1Energy,
                                move2Name = userMove2NameEarly,
                                move2Cost = userMove2Energy,
                                hasSecondMove = hasSecondUserMove,
                                fallbackSpeciesType = userMetaForStats.types.firstOrNull() ?: "normal"
                            )
                            val slowestMoveNameForToast = if (slowestIsRightForToast) userMove2NameEarly else userMove1NameEarly
                            val slowestMoveCostForToast = if (slowestIsRightForToast) userMove2Energy else userMove1Energy
                            val slowestFillForToast = if (slowestIsRightForToast) sampledRightChargeBtnFillPct else sampledLeftChargeBtnFillPct
                            emitEnergyUpdateToastIfEnabled(
                                slotIdx = activeUserIdx,
                                moveName = slowestMoveNameForToast,
                                moveCost = slowestMoveCostForToast,
                                circleFillPct = slowestFillForToast,
                                newEnergy = nextProactiveE,
                                primaryAtkIndex = if (slowestIsRightForToast) 2 else 1,
                                leftFillPct = sampledLeftChargeBtnFillPct,
                                leftEnergy = computeSingleCircleSnappedEnergy(activeUserIdx, sampledLeftChargeBtnFillPct, userMove1Energy, userFastEnergyForStats),
                                rightFillPct = sampledRightChargeBtnFillPct,
                                rightEnergy = if (hasSecondUserMove) computeSingleCircleSnappedEnergy(activeUserIdx, sampledRightChargeBtnFillPct, userMove2Energy, userFastEnergyForStats) else -1,
                                hasSecondMove = hasSecondUserMove
                            )
                            hpChanged = true
                        }
                    }
                } else if (isAt100ReadyForClock) {
                    if (leadMs > 0L &&
                        elapsedSinceLastConfirmedMoveMs >= proactiveTriggerElapsedMs &&
                        nowMs < expectedConfirmMs
                    ) {
                        proactiveStepPending = true
                        proactiveStepSlotIdx = activeUserIdx
                        proactiveStepPreEnergy = 100
                        proactiveStepAddedEnergy = 0
                        proactiveStepAddedTurns = userFastTurnsForStats
                        proactiveStepExpectedConfirmMs = expectedConfirmMs
                        proactiveStepPreOppSlotIdx = activeOppIdx
                        proactiveStepPreOppEnergy = oppSlotEnergy[activeOppIdx].coerceIn(0, 100)
                        proactiveStepPreOppTurnsOnField = oppSlotTurnsOnField[activeOppIdx].coerceAtLeast(0)
                        proactiveStepPrePhaseOppTurns = phaseOppTurns.coerceAtLeast(0)

                        playerSlotEnergy[activeUserIdx] = 100
                        playerSlotTurnsOnField[activeUserIdx] = (playerSlotTurnsOnField[activeUserIdx] + userFastTurnsForStats).coerceAtLeast(0)
                        phasePlayerTurns = confirmedPhasePlayerTurns + userFastTurnsForStats
                        playerSlotCurrentMoveTurns[activeUserIdx] = 0
                        if (battleTurnIndex < phasePlayerTurns) {
                            battleTurnIndex = phasePlayerTurns
                        }
                        hpChanged = true
                    } else if (nowMs >= expectedConfirmMs && nowMs <= (expectedConfirmMs + 500L)) {
                        playerSlotCeilingLatched100[activeUserIdx] = true
                        playerSlotEnergy[activeUserIdx] = 100
                        playerSlotEnergyAnchor[activeUserIdx] = 100
                        confirmedPhasePlayerTurns += userFastTurnsForStats
                        phasePlayerTurns = max(phasePlayerTurns, confirmedPhasePlayerTurns)
                        playerSlotTurnsOnField[activeUserIdx] = (playerSlotTurnsOnField[activeUserIdx] + userFastTurnsForStats).coerceAtLeast(0)
                        playerSlotCurrentMoveTurns[activeUserIdx] = 0
                        if (battleTurnIndex < confirmedPhasePlayerTurns) {
                            battleTurnIndex = confirmedPhasePlayerTurns
                        }
                        lastConfirmedPlayerFastMoveMs = if (nowMs - expectedConfirmMs <= 450L) {
                            expectedConfirmMs
                        } else {
                            nowMs
                        }
                        playerLastFastCreditedAtMs[activeUserIdx] = nowMs
                        playerAutoIncrementAnchorMs[activeUserIdx] = nowMs
                        userFastMovesCreditedThisFrame = max(userFastMovesCreditedThisFrame, 1)
                        hpChanged = true
                    }
                }
            }
        }

        // Snapshot stable normal-combat energy whenever both floating HP bars and top Pokéballs are visible
        // v5.13 Fix 4: NEVER overwrite lastStableLeftChargeFillPct / lastStableRightChargeFillPct with raw undebounced
        // lastScannedLeftChargeFillPct / lastScannedRightChargeFillPct here (which shrinks to 2%-7% during tap zoom-in)!
        if (hasVisibleCombatHud &&
            (sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300 || (sampledPlayerHpPct in 1..100 && sampledOppHpPct in 1..100)) &&
            pendingChargedAttackActor.isEmpty() &&
            !isAttackIncomingPromptActive &&
            !hasAttackIncomingText &&
            !hasUserChargedBannerText &&
            areChargeCirclesVisibleNow
        ) {
            val confirmedCombatEnergy = if (proactiveStepPending && proactiveStepSlotIdx == activeUserIdx) {
                proactiveStepPreEnergy.coerceIn(0, 100)
            } else {
                playerSlotEnergy[activeUserIdx]
            }
            val isPreThrowCircleFadeNow = (lastStableLeftChargeFillPct >= 95 && sampledLeftChargeBtnFillPct in 0..(lastStableLeftChargeFillPct - 20)) ||
                (hasSecondUserMove && lastStableRightChargeFillPct >= 95 && sampledRightChargeBtnFillPct in 0..(lastStableRightChargeFillPct - 20)) ||
                (sampledLeftChargeBtnFillPct < 0 && hasSecondUserMove && sampledRightChargeBtnFillPct >= 0) ||
                (hasSecondUserMove && sampledRightChargeBtnFillPct < 0 && sampledLeftChargeBtnFillPct >= 0)
            if (!isPreThrowCircleFadeNow) {
                if (nowMs - lastStableNormalCombatMs >= 450L) {
                    prevStableNormalCombatEnergy = lastStableNormalCombatEnergy
                    lastStableNormalCombatMs = nowMs
                }
                lastStableNormalCombatEnergy = confirmedCombatEnergy
                if (confirmedCombatEnergy >= cheapestUserEnergy && combatHudStableFrames >= 2) {
                    if ((nowMs - recentStableReadyEnergyMs[activeUserIdx]) > 2500L || confirmedCombatEnergy >= recentStableReadyEnergy[activeUserIdx]) {
                        recentStableReadyEnergy[activeUserIdx] = confirmedCombatEnergy
                    }
                    recentStableReadyEnergyMs[activeUserIdx] = nowMs
                }
            }
        }

        // 1D. v3.88 / v4.12 / v5.12: Opponent Fast Move Energy Indexed Directly to Player Turns (with <100E Stall Rollback & >=100E Stall Clock)
        //     - When player uses a multi-turn fast move (`userFastTurnsForStats > 1`), approximates single-turn timing
        //       in 500ms intervals (`0 .. userFastTurnsForStats - 1`) between each confirmed player fast move.
        //     - Below 100E (`!isAt100ReadyForSubTurns`), if the expected player fast move confirmation does not arrive within
        //       `userMoveDurationMs + 250L` (a stall) or a charge-scene animation cut occurs, immediately rolls back any
        //       unconfirmed interpolated sub-turns and opponent fast move credits to `confirmedMoveOppEnergy` / `confirmedMovePhaseOppTurns`.
        //     - Only when player energy is at 100% (`isAt100ReadyForSubTurns`) does opponent energy advance continuously on a stall.
        if (hasBattleStarted &&
            canAccumulateFastEnergy &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx]
        ) {
            val isAt100ReadyForSubTurns = playerSlotEnergy[activeUserIdx] >= 100 && areCirclesVisibleAt100
            val stallRollbackWindowMs = if (isAt100ReadyForSubTurns) (userMoveDurationMs + 500L) else (userMoveDurationMs + 250L)

            if (!proactiveStepPending &&
                userFastTurnsForStats > 1 &&
                lastConfirmedPlayerFastMoveMs > 0L &&
                nowMs >= lastConfirmedPlayerFastMoveMs &&
                userFastMovesCreditedThisFrame == 0
            ) {
                val elapsedSinceLastConfirmedMoveMs = (nowMs - lastConfirmedPlayerFastMoveMs).coerceAtLeast(0L)
                if ((confirmedPhasePlayerTurns > 0 || isAt100ReadyForSubTurns) &&
                    elapsedSinceLastConfirmedMoveMs > stallRollbackWindowMs
                ) {
                    if (phasePlayerTurns > confirmedPhasePlayerTurns || phaseOppTurns > confirmedMovePhaseOppTurns) {
                        rollbackPendingProactiveStep(markAnchorRolledBack = true)
                        hpChanged = true
                    }
                    playerSlotCurrentMoveTurns[activeUserIdx] = 0
                } else if (lastConfirmedPlayerFastMoveMs != proactiveRolledBackAnchorMs &&
                    (confirmedPhasePlayerTurns > 0 || isAt100ReadyForSubTurns)
                ) {
                    val leadOffsetMs = activeProactiveEnergyLeadMs.coerceIn(0, 400).toLong()
                    val interpolatedSubTurns = ((elapsedSinceLastConfirmedMoveMs + leadOffsetMs) / 500L).toInt().coerceIn(0, userFastTurnsForStats - 1)
                    val interpolatedTotalTurns = confirmedPhasePlayerTurns + interpolatedSubTurns
                    if (interpolatedTotalTurns > phasePlayerTurns) {
                        phasePlayerTurns = interpolatedTotalTurns
                    }
                    playerSlotCurrentMoveTurns[activeUserIdx] = interpolatedSubTurns
                } else {
                    playerSlotCurrentMoveTurns[activeUserIdx] = 0
                }
            } else if (userFastMovesCreditedThisFrame > 0 || proactiveStepPending) {
                playerSlotCurrentMoveTurns[activeUserIdx] = 0
            }

            if (phasePlayerTurns > 0) {
                val totalCompletedOppMovesInPhase = phasePlayerTurns / oppFastTurnsForStats
                val alreadyCreditedOppMovesInPhase = phaseOppTurns / oppFastTurnsForStats
                val makeupOppMoves = (totalCompletedOppMovesInPhase - alreadyCreditedOppMovesInPhase).coerceAtLeast(0)

                if (makeupOppMoves > 0) {
                    oppSlotEnergy[activeOppIdx] = (oppSlotEnergy[activeOppIdx] + makeupOppMoves * oppFastEnergyForStats).coerceIn(0, 100)
                    oppSlotTurnsOnField[activeOppIdx] = (oppSlotTurnsOnField[activeOppIdx] + makeupOppMoves * oppFastTurnsForStats).coerceAtLeast(0)
                    phaseOppTurns += makeupOppMoves * oppFastTurnsForStats
                    oppLastFastCreditedAtMs[activeOppIdx] = nowMs
                    oppCreditedByOptimalTimerAtMs[activeOppIdx] = nowMs
                    hpChanged = true
                }
                // Update confirmed opponent baseline whenever opponent moves are backed by confirmed player turns (or 100E stall clock)
                val confirmedCompletedOppMoves = confirmedPhasePlayerTurns / oppFastTurnsForStats
                val confirmedTargetPhaseOppTurns = confirmedCompletedOppMoves * oppFastTurnsForStats
                if (userFastMovesCreditedThisFrame > 0 || isAt100ReadyForSubTurns || (!proactiveStepPending && phasePlayerTurns <= confirmedPhasePlayerTurns)) {
                    confirmedMoveOppSlotIdx = activeOppIdx
                    confirmedMoveOppEnergy = oppSlotEnergy[activeOppIdx].coerceIn(0, 100)
                    confirmedMoveOppTurnsOnField = oppSlotTurnsOnField[activeOppIdx].coerceAtLeast(0)
                    confirmedMovePhaseOppTurns = phaseOppTurns.coerceAtLeast(0)
                } else if (confirmedTargetPhaseOppTurns > confirmedMovePhaseOppTurns) {
                    val deltaConfirmedMoves = (confirmedTargetPhaseOppTurns - confirmedMovePhaseOppTurns) / oppFastTurnsForStats
                    if (deltaConfirmedMoves > 0) {
                        confirmedMoveOppSlotIdx = activeOppIdx
                        confirmedMoveOppEnergy = (confirmedMoveOppEnergy + deltaConfirmedMoves * oppFastEnergyForStats).coerceIn(0, 100)
                        confirmedMoveOppTurnsOnField = (confirmedMoveOppTurnsOnField + deltaConfirmedMoves * oppFastTurnsForStats).coerceAtLeast(0)
                        confirmedMovePhaseOppTurns = confirmedTargetPhaseOppTurns
                    }
                }
                oppSlotCurrentMoveTurns[activeOppIdx] = (phasePlayerTurns - phaseOppTurns).coerceIn(0, oppFastTurnsForStats - 1)
            }
        }

        // 1E. v3.80 / v4.08 / v6.02: Non-Standard Opponent Fast Move Detector
        //     Stricter multi-turn & multi-cycle confirmation (Strict Default / Balanced / Aggressive) + Hidden Power exclusion
        if (enableAltFastMoveDetect &&
            hasBattleStarted &&
            activeOppIdx in 0..2 &&
            !oppFastMoveConfirmed[activeOppIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            !playerFaintedSlots[activeUserIdx]
        ) {
            val stdFastName = oppMetaForStats.defaultFastMove
            val stdFastTurns = OverlayService.resolveFastTurnsStatic(stdFastName, oppMetaForStats.fastTurns).coerceIn(1, 5)
            val stdExactDmg = calculateFastMoveExactDamagePercent(
                attacker = oppMetaForStats,
                defender = userMetaForStats,
                fastMoveName = stdFastName,
                fastTurns = stdFastTurns,
                isAttackerShadow = isOpponentShadow,
                isDefenderShadow = isUserShadForStats
            )
            // Number of turns for standard moveset to deal >= 10% damage to player's active Pokémon
            val stdMovesFor10Pct = ceil(10.0 / max(0.4, stdExactDmg)).toInt().coerceIn(1, 14)
            val turnsFor10Pct = (stdMovesFor10Pct * stdFastTurns).coerceIn(2, 30)
            val offsetTurns = fastDetectTurnOffset.coerceIn(0, 3)
            val strictnessMode = activeAltFastDetectStrictness.lowercase()
            val minRequiredElapsedTurns = when (strictnessMode) {
                "aggressive" -> 4
                "balanced" -> 8
                else -> 10
            }
            val minRequiredCompletedCycles = when (strictnessMode) {
                "aggressive" -> 1
                "balanced" -> 2
                else -> 3
            }
            val minRequiredObservedDmgPct = when (strictnessMode) {
                "aggressive" -> 8.0
                "balanced" -> 10.0
                else -> 12.0
            }
            val minConfGap = when (strictnessMode) {
                "aggressive" -> 0.14
                "balanced" -> 0.20
                else -> 0.25
            }
            val minAbsErrorGap = when (strictnessMode) {
                "aggressive" -> 2.2
                "balanced" -> 3.0
                else -> 4.0
            }
            val minWinnerConf = when (strictnessMode) {
                "aggressive" -> 0.52
                "balanced" -> 0.60
                else -> 0.68
            }

            val rawPoolFast = OverlayService.getAvailableMovePoolForSpeciesStatic(oppMetaForStats.name, activeLeague).first
            // v6.02: Never auto-override a standard fast move to Hidden Power (*) from HP drops alone
            val candidateFastMoves = (listOf(stdFastName) + rawPoolFast)
                .map { it.trim() }
                .filter { cand ->
                    cand.isNotBlank() && (cand.equals(stdFastName, ignoreCase = true) || !cand.startsWith("Hidden Power", ignoreCase = true))
                }
                .distinctBy { it.lowercase() }

            // For each valid move M_i (duration N_i), sample at first multiple of N_i >= turnsFor10Pct + offsetTurns
            var maxRequiredSampleTurn = max(turnsFor10Pct + offsetTurns, minRequiredElapsedTurns)
            for (cand in candidateFastMoves) {
                val cTurns = OverlayService.resolveFastTurnsStatic(cand, stdFastTurns).coerceIn(1, 5)
                val minTurnsForCycles = cTurns * minRequiredCompletedCycles + offsetTurns
                val firstRegTurn = max(
                    ceil(turnsFor10Pct.toDouble() / cTurns.toDouble()).toInt().coerceAtLeast(1) * cTurns + offsetTurns,
                    minTurnsForCycles
                )
                if (firstRegTurn > maxRequiredSampleTurn) {
                    maxRequiredSampleTurn = firstRegTurn
                }
            }

            val elapsedEvalTurns = max(oppSlotTurnsOnField[activeOppIdx], phasePlayerTurns)
            if (elapsedEvalTurns >= maxRequiredSampleTurn) {
                val effectiveTurnsForDamage = (elapsedEvalTurns - offsetTurns).coerceAtLeast(1)
                val observedDmgPct = if (oppCumulativeFastDmgPct[activeOppIdx] > 0) {
                    oppCumulativeFastDmgPct[activeOppIdx].toDouble()
                } else {
                    max(0, 100 - playerSlotHpPct[activeUserIdx]).toDouble()
                }

                data class FastMoveEval(
                    val moveName: String,
                    val turns: Int,
                    val energy: Int,
                    val completedMoves: Int,
                    val expectedDmg: Double,
                    val absError: Double,
                    val confidence: Double
                )

                val evals = candidateFastMoves.map { cand ->
                    val cTurns = OverlayService.resolveFastTurnsStatic(cand, stdFastTurns).coerceIn(1, 5)
                    val cEnergy = OverlayService.resolveFastEnergyStatic(cand, cTurns).coerceIn(2, 20)
                    val cDmg = calculateFastMoveExactDamagePercent(
                        attacker = oppMetaForStats,
                        defender = userMetaForStats,
                        fastMoveName = cand,
                        fastTurns = cTurns,
                        isAttackerShadow = isOpponentShadow,
                        isDefenderShadow = isUserShadForStats
                    )
                    val completedMoves = (effectiveTurnsForDamage / cTurns).coerceAtLeast(1)
                    val expDmg = completedMoves * cDmg
                    val err = kotlin.math.abs(observedDmgPct - expDmg)
                    val denom = max(2.5, expDmg * 0.35)
                    val conf = 1.0 / (1.0 + (err / denom) * (err / denom))
                    FastMoveEval(cand, cTurns, cEnergy, completedMoves, expDmg, err, conf)
                }

                val stdEval = evals.firstOrNull { it.moveName.equals(stdFastName, ignoreCase = true) } ?: evals.first()
                val bestEval = evals.maxByOrNull { it.confidence } ?: stdEval

                // v6.02: Require strict multi-turn, multi-cycle, cumulative damage, confidence gap, and error gap proof before overriding standard fast move!
                val isNonStandardWinner = !bestEval.moveName.equals(stdFastName, ignoreCase = true) &&
                    !bestEval.moveName.startsWith("Hidden Power", ignoreCase = true) &&
                    bestEval.completedMoves >= minRequiredCompletedCycles &&
                    stdEval.completedMoves >= minRequiredCompletedCycles &&
                    observedDmgPct >= minRequiredObservedDmgPct &&
                    (bestEval.confidence - stdEval.confidence) >= minConfGap &&
                    (stdEval.absError - bestEval.absError) >= minAbsErrorGap &&
                    bestEval.confidence >= minWinnerConf

                if (observedDmgPct >= minRequiredObservedDmgPct || elapsedEvalTurns >= maxRequiredSampleTurn + 4) {
                    oppFastMoveConfirmed[activeOppIdx] = true
                    if (isNonStandardWinner) {
                        detectedOppFastMoveOverride[activeOppIdx] = bestEval.moveName
                        oppFastMoveStatus[activeOppIdx] = "confirmed_non_standard"
                        // Retroactively adjust opponent energy & turns for the newly confirmed fast move (capped at 100E)
                        val newCompletedMoves = (effectiveTurnsForDamage / bestEval.turns).coerceAtLeast(0)
                        oppSlotEnergy[activeOppIdx] = (newCompletedMoves * bestEval.energy).coerceIn(0, 100)
                        oppSlotTurnsOnField[activeOppIdx] = newCompletedMoves * bestEval.turns
                        phaseOppTurns = (phasePlayerTurns / bestEval.turns) * bestEval.turns
                        oppSlotCurrentMoveTurns[activeOppIdx] = (phasePlayerTurns - phaseOppTurns).coerceIn(0, bestEval.turns - 1)
                        showBattleToast("⚠️ Non-Standard Fast: ${oppMetaForStats.name} has ${bestEval.moveName} (${bestEval.turns}t/${bestEval.energy}e)!")
                    } else {
                        detectedOppFastMoveOverride[activeOppIdx] = ""
                        oppFastMoveStatus[activeOppIdx] = "confirmed_standard"
                    }
                    hpChanged = true
                }
            }
        }

        // Track consecutive frames of Charged Move HUD signatures calibrated for 10Hz (100ms) scan rate:
        if (!isPostFaintSwitchPromptActive &&
            sampledPlayerBalls <= 0 &&
            sampledOppBalls <= 0 &&
            sampledLeftChargeBtnFillPct == -1 &&
            sampledRightChargeBtnFillPct == -1 &&
            sampledOppHpPct in 1..100 &&
            !hasUserChargedBannerText &&
            !isUserMinigameSwipePhaseActive
        ) {
            missingTopBallsWithHpBarsFrames = (missingTopBallsWithHpBarsFrames + 1).coerceAtMost(20)
        } else {
            missingTopBallsWithHpBarsFrames = 0
        }

        // 0-Shield Opponent Charged Move Prompt visual signature ("No Protect Shields remaining!" screen):
        // When playerShieldsRemaining == 0, Pokémon GO keeps the top-right Pokéballs visible (`missingTopBallsWithHpBarsFrames == 0`),
        // hides the bottom Charge Move Circles (`sampledLeftChargeBtnFillPct == -1 && sampledRightChargeBtnFillPct == -1`),
        // and keeps both the player's and opponent's floating HP bars visible (`sampledPlayerHpPct in 1..100 && sampledOppHpPct in 1..100`).
        if (!isPostFaintSwitchPromptActive &&
            hasBattleStarted &&
            playerShieldsRemaining == 0 &&
            sampledPlayerHpPct in 1..100 &&
            sampledOppHpPct in 1..100 &&
            sampledLeftChargeBtnFillPct == -1 &&
            sampledRightChargeBtnFillPct == -1 &&
            !isUserMinigameSwipePhaseActive &&
            !hasUserChargedBannerText
        ) {
            missingBottomCirclesWithOppHpFrames = (missingBottomCirclesWithOppHpFrames + 1).coerceAtMost(20)
        } else {
            missingBottomCirclesWithOppHpFrames = 0
        }

        if (!isPostFaintSwitchPromptActive && !hasAttackIncomingText && sampledPlayerHpPct == -1 && sampledOppHpPct == -1 &&
            sampledLeftChargeBtnFillPct == -1 && sampledRightChargeBtnFillPct == -1 &&
            (sampledOppBalls in 1..3 || sampledPlayerBalls in 1..3 || (lastSteadyMoveButtonsSeenMs > 0L && (nowMs - lastSteadyMoveButtonsSeenMs) <= 5000L))
        ) {
            missingBothHpBarsFrames = (missingBothHpBarsFrames + 1).coerceAtMost(20)
        } else {
            missingBothHpBarsFrames = 0
        }

        val oppAliveBefore = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
        val oppBallsIndicateKo = (debouncedOppBalls in 1..2 && debouncedOppBalls < oppAliveBefore) ||
            (sampledOppBalls in 1..2 && sampledOppBalls < oppAliveBefore && combatHudStableFrames >= 2)
        if (pendingChargedAttackActor == "user" &&
            (nowMs - pendingChargedAttackStartMs) >= 2200L &&
            !hasUserChargedBannerText &&
            !isAllCombatHudGone &&
            sampledOppHpPct == -1 &&
            sampledOppBalls != 3 &&
            debouncedOppBalls != 3 &&
            ((sampledPlayerHpPct in 1..100 && playerSlotHpConfirmFrames[activeUserIdx] >= reqHpDebounce) ||
                sampledLeftChargeBtnFillPct in 0..300 ||
                sampledRightChargeBtnFillPct in 0..300 ||
                oppBallsIndicateKo)
        ) {
            postUserChargedMissingOppHpFrames = (postUserChargedMissingOppHpFrames + 1).coerceAtMost(20)
        } else {
            postUserChargedMissingOppHpFrames = 0
        }

        val playerAliveBefore = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
        val playerBallsIndicateKoOrPrompt = isPostFaintSwitchPromptActive ||
            (debouncedPlayerBalls in 1..2 && debouncedPlayerBalls < playerAliveBefore) ||
            (sampledPlayerBalls in 1..2 && sampledPlayerBalls < playerAliveBefore && combatHudStableFrames >= 2)
        if (pendingChargedAttackActor == "opp" &&
            (nowMs - pendingChargedAttackStartMs) >= 2200L &&
            !hasAttackIncomingText &&
            (!isAllCombatHudGone || isPostFaintSwitchPromptActive) &&
            sampledPlayerHpPct == -1 &&
            sampledPlayerBalls != 3 &&
            debouncedPlayerBalls != 3 &&
            playerBallsIndicateKoOrPrompt
        ) {
            postOppChargedMissingPlayerHpFrames = (postOppChargedMissingPlayerHpFrames + 1).coerceAtMost(20)
        } else {
            postOppChargedMissingPlayerHpFrames = 0
        }

        val isNormalFastCombatFrame = !isPostFaintSwitchPromptActive &&
            !hasAttackIncomingText &&
            !hasUserChargedBannerText &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            (sampledPlayerBalls in 1..3 || sampledOppBalls in 1..3) &&
            (sampledOppHpPct in 1..100 || sampledPlayerHpPct in 1..100 || sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300)
        lastFrameWasNormalFastCombat = isNormalFastCombatFrame

        if (isNormalFastCombatFrame && pendingChargedAttackActor.isEmpty() && !isAttackIncomingPromptActive) {
            lastNormalCombatOppSlotIdx = activeOppIdx
            lastNormalCombatUserSlotIdx = activeUserIdx
            lastNormalCombatOppRawName = detectedOpponents.getOrNull(activeOppIdx) ?: activeOpponentName
            lastNormalCombatOppShadow = isOpponentShadow
        }

        if (isNormalFastCombatFrame && (playerMoveLines.any { it.text.trim().length >= 4 } || sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300)) {
            lastSteadyMoveButtonsSeenMs = nowMs
        }

        // 2. Detect Opponent Charged Attack (v4.06 / v4.10 / v5.13: Driven by the top-center 5-second countdown circle detector AND/OR
        //    "Attack incoming!" OCR text, gated on `isHudHiddenForOpponentPrompt` and never triggered by `sampledOppHpPct` alone when player HP is missing!)
        val isOpponentCountdownCircleActive = isTopCountdownCircleActive &&
            !isPostFaintSwitchPromptActive &&
            !sampledTopRightNameplateVisible &&
            isHudHiddenForOpponentPrompt &&
            !hasUserChargedBannerText &&
            !isUserMinigameSwipePhaseActive &&
            (sampledPlayerHpPct in 1..100 ||
                hasAttackIncomingText ||
                isAttackIncomingPromptActive ||
                pendingChargedAttackActor == "opp")
        val isOpponentChargedScreen = isOpponentCountdownCircleActive ||
            (hasAttackIncomingText &&
                !isPostFaintSwitchPromptActive &&
                !hasUserChargedBannerText &&
                isHudHiddenForOpponentPrompt)
        if (isOpponentChargedScreen) {
            if (pendingChargedAttackActor == "user") {
                if (!pendingUserChargeConfirmedByOcr && !hasUserBannerResolvedSinceThrow) {
                    // Case 1: `pendingChargedAttackActor == "user"` was only latched by a HUD-missing camera zoom wind-up
                    // before "Attack incoming!" appeared (no player minigame or player move banner OCR was ever seen).
                    // Roll back the tentative player energy deduction and switch cleanly to the opponent charged attack!
                    val rollbackUserIdx = pendingChargedAttackUserSlotIdx.takeIf { it in 0..2 } ?: activeUserIdx.coerceIn(0, 2)
                    val restoredUserE = preChargeUserEnergy.coerceIn(0, 100)
                    playerSlotEnergy[rollbackUserIdx] = restoredUserE
                    playerSlotEnergyAnchor[rollbackUserIdx] = restoredUserE
                    awaitingPostUserChargeCircleSync = false
                    resetSlotEnergyTracking(
                        slotIdx = rollbackUserIdx,
                        initialEnergy = restoredUserE,
                        cost1 = userMove1Energy,
                        cost2 = userMove2Energy,
                        clearThirdFillLatches = restoredUserE < 2 * cheapestUserEnergy
                    )
                    pendingChargedAttackActor = ""
                    pendingChargedAttackDeductedEnergy = 0
                    pendingUserChargeConfirmedByOcr = false
                    hpChanged = true
                } else {
                    // Case 2: Genuine CMP Tie Transition (Player threw 1st on CMP confirmed by minigame/banner OCR ->
                    // Opponent immediately throws 2nd on CMP without returning to combat circles):
                    // Finalize the pending player charged move immediately so the opponent's 2nd CMP throw can initialize & show the Shield Decision Overlay!
                    val cmpDefenderOppIdx = pendingChargedAttackOppSlotIdx.takeIf { it in 0..2 } ?: activeOppIdx.coerceIn(0, 2)
                    val cmpShieldDropped = oppShieldsRemaining < pendingChargedAttackPreOppShields
                    val cmpPostOppHp = if (oppFaintedSlots[cmpDefenderOppIdx]) 0 else oppSlotHpPct[cmpDefenderOppIdx].coerceIn(0, 100)
                    val cmpHpBefore = pendingChargedAttackPreOppHp.coerceIn(1, 100)
                    val cmpHpDelta = max(0, cmpHpBefore - cmpPostOppHp)
                    val cmpShielded = cmpShieldDropped || (cmpHpDelta <= 3 && pendingChargedAttackPreOppShields > 0 && !oppFaintedSlots[cmpDefenderOppIdx])
                    val cmpBannerMove = if (lastDetectedBannerMoveActor == "user" &&
                        (nowMs - lastDetectedBannerMoveTimeMs) <= 7500L &&
                        lastDetectedBannerMoveName.isNotBlank()
                    ) {
                        lastDetectedBannerMoveName
                    } else {
                        lastUserChargeResolvedMoveName.takeIf { it.isNotBlank() }
                    }
                    val cmpPreCircleMove = if (hasSecondUserMove && userMove1Energy != userMove2Energy) {
                        when {
                            preChargeRightFillPct >= 95 && preChargeLeftFillPct < 92 -> userMove2NameEarly
                            preChargeLeftFillPct >= 95 && preChargeRightFillPct < 92 -> userMove1NameEarly
                            else -> null
                        }
                    } else userMove1NameEarly
                    val cmpResolvedUserMove = cmpBannerMove ?: cmpPreCircleMove ?: userMove1NameEarly
                    val cmpUserCost = when {
                        cmpResolvedUserMove.equals(userMove2NameEarly, ignoreCase = true) -> userMove2Energy
                        cmpResolvedUserMove.equals(userMove1NameEarly, ignoreCase = true) -> userMove1Energy
                        else -> userMoveEnergyMap[cmpResolvedUserMove] ?: cheapestUserEnergy
                    }
                    val cmpEffectivePreEnergy = max(preChargeUserEnergy, cmpUserCost).coerceIn(cheapestUserEnergy, 100)
                    val cmpResidualEnergy = (cmpEffectivePreEnergy - cmpUserCost).coerceIn(0, 100)
                    playerSlotEnergy[activeUserIdx] = cmpResidualEnergy
                    playerSlotEnergyAnchor[activeUserIdx] = cmpResidualEnergy
                    lastStableNormalCombatEnergy = cmpResidualEnergy
                    prevStableNormalCombatEnergy = cmpResidualEnergy
                    lastUserChargePreEnergySnapshot = cmpEffectivePreEnergy
                    lastUserChargeDeductedEnergySnapshot = cmpUserCost
                    lastUserChargeResolvedMoveName = cmpResolvedUserMove
                    awaitingPostUserChargeCircleSync = true
                    resetSlotEnergyTracking(
                        slotIdx = activeUserIdx,
                        initialEnergy = cmpResidualEnergy,
                        cost1 = userMove1Energy,
                        cost2 = userMove2Energy,
                        clearThirdFillLatches = cmpResidualEnergy < 2 * cheapestUserEnergy
                    )
                    if (lastDetectedBannerMoveActor == "user") {
                        lastDetectedBannerMoveActor = ""
                        lastDetectedBannerMoveName = ""
                    }
                    val cmpDefenderOppRawName = detectedOpponents.getOrNull(cmpDefenderOppIdx)
                        ?: pendingChargedAttackOppRawName.ifBlank { activeOpponentName }
                    val cmpFormattedDefenderOppName = formatOpponentNameWithShadow(cmpDefenderOppRawName)
                    val cmpEventT = getElapsedBattleSeconds()
                    val cmpPlayerRemSec = if (playerSwapEndTimeMs > nowMs) ceil((playerSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
                    val cmpOppRemSec = if (oppSwapEndTimeMs > nowMs) ceil((oppSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
                    val cmpExpectedDmgPct = calculateChargedMoveDamagePercent(
                        attacker = userMetaForStats,
                        defender = oppMetaForStats,
                        moveName = cmpResolvedUserMove,
                        isAttackerShadow = isUserShadForStats,
                        isDefenderShadow = isOpponentShadow
                    )
                    val cmpRawPreEnergy = preChargeUserEnergy.coerceIn(0, 100)
                    val cmpEnergyDeficit = max(0, cmpUserCost - cmpRawPreEnergy)
                    val cmpMoveSource = when {
                        cmpBannerMove != null -> "BANNER_OCR"
                        cmpPreCircleMove != null -> "PRE_CIRCLE_READY"
                        else -> "DEFAULT_FALLBACK"
                    }
                    battleTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "CHARGED_ATTACK",
                            actor = "user",
                            t = cmpEventT,
                            activePokemon = pendingChargedAttackAttackerName,
                            pokemonShielded = if (cmpShielded) cmpFormattedDefenderOppName else null,
                            shielded = cmpShielded,
                            hpBeforePct = cmpHpBefore,
                            hpAfterPct = if (cmpShielded) max(1, cmpHpBefore - 1) else cmpPostOppHp,
                            hpDeltaPct = if (cmpShielded) 1 else cmpHpDelta,
                            inferredMoveName = cmpResolvedUserMove,
                            userSlotHpPct = playerSlotHpPct.toList(),
                            oppSlotHpPct = oppSlotHpPct.toList(),
                            userShieldsRemaining = playerShieldsRemaining,
                            oppShieldsRemaining = oppShieldsRemaining,
                            recommendedAction = lastRecommendedAction.ifEmpty { null },
                            recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                            decisionPhase = "CHARGED_MOVE",
                            playerSwapRemainingSec = cmpPlayerRemSec,
                            oppSwapRemainingSec = cmpOppRemSec,
                            userEnergy = playerSlotEnergy[activeUserIdx],
                            oppEnergy = oppSlotEnergy[cmpDefenderOppIdx],
                            turnIndex = battleTurnIndex,
                            scanTurnOffsetMs = scanTurnOffsetMs,
                            preThrowEnergy = cmpRawPreEnergy,
                            requiredMoveEnergy = cmpUserCost,
                            energyDeficit = cmpEnergyDeficit,
                            expectedMoveDmgPct = cmpExpectedDmgPct,
                            leftCircleFillBeforePct = preChargeLeftFillPct.takeIf { it >= 0 },
                            rightCircleFillBeforePct = preChargeRightFillPct.takeIf { it >= 0 },
                            moveResolutionSource = cmpMoveSource,
                            hudThumbnailWebpBase64 = pendingChargedAttackHudThumbB64
                        )
                    )
                    lastChargedAttackLoggedMs = nowMs
                    lastChargedAttackLoggedActor = "user"
                    lastUserChargedAttackLoggedMs = nowMs
                    lastUserChargedPreOppHp = cmpHpBefore
                    lastUserChargedDefenderOppSlotIdx = cmpDefenderOppIdx
                    lastUserChargedWasProvisionalShield = !cmpShieldDropped && cmpShielded
                    lastUserChargedAutoDecrementedShield = false
                    pendingChargedAttackActor = ""
                    pendingChargedAttackDeductedEnergy = 0
                    pendingUserChargeConfirmedByOcr = false
                    shieldDecisionOverlayShownAtMs = 0L
                    hpChanged = true
                }
            }
            val wasPromptActive = isAttackIncomingPromptActive
            isAttackIncomingPromptActive = true
            attackIncomingDetectedAtMs = nowMs
            hadShieldPromptBeforeCurrentCharge = true
            lastChargedPromptActor = "opp"
            lastChargedPromptTimeMs = nowMs
            predictedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
            predictedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
            if (pendingChargedAttackActor != "opp" && ((nowMs - lastChargedAttackLoggedMs) > 2200L || lastChargedAttackLoggedActor == "user")) {
                hasBattleStarted = true
                // v5.13 Fix 3: Preserve opponent sub-turn energy when the opponent throws mid-exchange
                rollbackPendingProactiveStep(markAnchorRolledBack = false, preserveOppSubTurnEnergy = true)
                proactiveRolledBackAnchorMs = 0L
                pendingChargedAttackHudThumbB64 = captureCompactHudStripWebpBase64()
                val throwerOppIdx = activeOppIdx.coerceIn(0, 2)
                val activeSubTurnWindowMs = (userFastTurnsForStats * 500L + 350L).coerceAtLeast(850L)
                val effectivePlayerTurnsAtOppThrow = if (lastConfirmedPlayerFastMoveMs > 0L &&
                    (nowMs - lastConfirmedPlayerFastMoveMs) in 1L..activeSubTurnWindowMs
                ) {
                    max(confirmedPhasePlayerTurns, phasePlayerTurns)
                } else {
                    confirmedPhasePlayerTurns
                }
                val maxTurnBeforeNextPlayerSample = max(effectivePlayerTurnsAtOppThrow, phaseOppTurns)
                if (maxTurnBeforeNextPlayerSample > 0) {
                    val maxOptimalOppMoves = ceil(maxTurnBeforeNextPlayerSample.toDouble() / oppFastTurnsForStats.toDouble()).toInt()
                    val creditedOppSoFar = phaseOppTurns / oppFastTurnsForStats
                    val missingFullOppMoves = (maxOptimalOppMoves - creditedOppSoFar).coerceAtLeast(0)
                    if (missingFullOppMoves > 0) {
                        oppSlotEnergy[throwerOppIdx] = (oppSlotEnergy[throwerOppIdx] + missingFullOppMoves * oppFastEnergyForStats).coerceIn(0, 100)
                        oppSlotTurnsOnField[throwerOppIdx] = (oppSlotTurnsOnField[throwerOppIdx] + missingFullOppMoves * oppFastTurnsForStats).coerceAtLeast(0)
                    }
                }
                if (oppSlotEnergy[throwerOppIdx] < cheapestOppEnergy) {
                    val neededOppMoves = ceil((cheapestOppEnergy - oppSlotEnergy[throwerOppIdx]).toDouble() / oppFastEnergyForStats.toDouble()).toInt().coerceIn(1, 4)
                    oppSlotEnergy[throwerOppIdx] = (oppSlotEnergy[throwerOppIdx] + neededOppMoves * oppFastEnergyForStats).coerceIn(0, 100)
                    oppSlotTurnsOnField[throwerOppIdx] = (oppSlotTurnsOnField[throwerOppIdx] + neededOppMoves * oppFastTurnsForStats).coerceAtLeast(0)
                }
                pendingChargedAttackActor = "opp"
                pendingChargedAttackStartMs = nowMs
                postChargeCirclesReturnedAtMs = 0L
                pendingChargedAttackOppSlotIdx = throwerOppIdx
                pendingChargedAttackUserSlotIdx = activeUserIdx.coerceIn(0, 2)
                pendingChargedAttackOppRawName = detectedOpponents.getOrNull(throwerOppIdx) ?: activeOpponentName
                pendingChargedAttackOppShadow = isOpponentShadow
                lastOppChargedAttackerSlotIdx = throwerOppIdx
                lastOppChargedAttackerRawName = pendingChargedAttackOppRawName
                lastOppChargedAttackerShadow = isOpponentShadow
                lastOppChargeHpInferredMoveName = ""
                pendingChargedAttackWasOppCatch = false
                for (i in 0..2) {
                    val liveUserCandidate = if (i == activeUserIdx && sampledPlayerHpPct in 1..100 && pendingConfirmPlayerSlotHpPct[i] in 1..100) {
                        pendingConfirmPlayerSlotHpPct[i].coerceIn(1, 100)
                    } else null
                    val preJumpUserHp = liveUserCandidate ?: if ((nowMs - playerSlotLastBigJumpMs[i]) <= 2500L &&
                        (nowMs - lastPlayerSwitchTimeMs) > 2500L &&
                        playerSlotPriorHpPct[i] in 1..100
                    ) {
                        playerSlotPriorHpPct[i]
                    } else {
                        confirmedPlayerSlotHpPct[i].takeIf { it in 1..100 } ?: playerSlotHpPct[i].coerceIn(1, 100)
                    }
                    pendingChargedAttackPreUserSlotHp[i] = preJumpUserHp
                    if (i == activeUserIdx && liveUserCandidate != null) {
                        playerSlotHpPct[i] = liveUserCandidate
                        confirmedPlayerSlotHpPct[i] = liveUserCandidate
                        lastScannedPlayerSlotHpPct[i] = liveUserCandidate
                        playerSlotPreFaintHpPct[i] = liveUserCandidate
                        predictedPlayerSlotHpPct[i] = liveUserCandidate
                    }
                    val liveOppCandidate = if (i == throwerOppIdx && sampledOppHpPct in 1..100 && pendingConfirmOppSlotHpPct[i] in 1..100) {
                        pendingConfirmOppSlotHpPct[i].coerceIn(1, 100)
                    } else null
                    val preJumpOppHp = liveOppCandidate ?: if ((nowMs - oppSlotLastBigJumpMs[i]) <= 2500L &&
                        (nowMs - lastOppSwitchTimeMs) > 2500L &&
                        oppSlotPriorHpPct[i] in 1..100
                    ) {
                        oppSlotPriorHpPct[i]
                    } else {
                        confirmedOppSlotHpPct[i].takeIf { it in 1..100 } ?: oppSlotHpPct[i].coerceIn(1, 100)
                    }
                    pendingChargedAttackPreOppSlotHp[i] = preJumpOppHp
                    if (i == throwerOppIdx && liveOppCandidate != null) {
                        oppSlotHpPct[i] = liveOppCandidate
                        confirmedOppSlotHpPct[i] = liveOppCandidate
                        lastScannedOppSlotHpPct[i] = liveOppCandidate
                        oppSlotPreFaintHpPct[i] = liveOppCandidate
                        predictedOppSlotHpPct[i] = liveOppCandidate
                    }
                }
                pendingChargedAttackPreOppBalls = oppPokeballCount
                pendingChargedAttackPreUserBalls = playerPokeballCount
                // v6.05: Always sync pre-charge HP to live rescanned player & opponent HP when opponent throws charged move
                pendingChargedAttackPreUserHp = pendingChargedAttackPreUserSlotHp[activeUserIdx].coerceIn(1, 100)
                pendingChargedAttackPreOppHp = pendingChargedAttackPreOppSlotHp[throwerOppIdx].coerceIn(1, 100)
                pendingChargedAttackPreUserShields = playerShieldsRemaining
                pendingChargedAttackPreOppShields = oppShieldsRemaining
                pendingChargedAttackAttackerName = formatOpponentNameWithShadow(pendingChargedAttackOppRawName)
                pendingChargedAttackDefenderName = activeUserPokemonName ?: userSlotCfg?.name ?: "Player"
                pendingChargedAttackPreOppEnergy = oppSlotEnergy[throwerOppIdx].coerceIn(cheapestOppEnergy, 100)
                oppSlotEnergy[throwerOppIdx] = (oppSlotEnergy[throwerOppIdx] - cheapestOppEnergy).coerceIn(0, 100)
                pendingChargedAttackDeductedEnergy = cheapestOppEnergy
                if (!playerFaintedSlots[activeUserIdx] && lastStableNormalCombatEnergy > playerSlotEnergy[activeUserIdx]) {
                    playerSlotEnergy[activeUserIdx] = lastStableNormalCombatEnergy.coerceIn(0, 100)
                }
                phaseStartPlayerEnergy = playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
                confirmedPhasePlayerTurns = 0
                lastConfirmedPlayerFastMoveMs = 0L
                phasePlayerTurns = 0
                phaseOppTurns = 0
                playerSlotCurrentMoveTurns[activeUserIdx] = 0
                oppSlotCurrentMoveTurns[throwerOppIdx] = 0
                isPlayerInIdleFallback = false
                lastIdleFallbackOppCreditMs = 0L
                lastTurnTickTimeMs = System.currentTimeMillis()
                turnResidualMs = 0L
                hpChanged = true
            }
            val isZeroShieldPrompt = playerShieldsRemaining == 0 ||
                combinedBannerLower.contains("no protect") ||
                combinedBannerLower.contains("shields remaining")
            if (!wasPromptActive) {
                val toastMsg = if (isZeroShieldPrompt) {
                    "⚡ Attack Incoming (No Shields)! (-${cheapestOppEnergy}E)"
                } else {
                    "⚡ Attack Incoming! (-${cheapestOppEnergy}E)"
                }
                showBattleToast(toastMsg)
            }
            // v4.07: 2-Frame Show Debounce on Shield Decision Overlay:
            // Increment `shieldOverlayShowConfirmFrames` at most once per unique 100ms frame (`currentFrameTimestampMs`)
            // and require `shieldOverlayShowConfirmFrames >= 2` before displaying the Shield Decision Overlay so any
            // 1-frame startup flicker is completely eliminated, then hold it steadily for the rest of the 5s countdown!
            if (currentFrameTimestampMs != lastShieldOverlayConfirmFrameMs) {
                lastShieldOverlayConfirmFrameMs = currentFrameTimestampMs
                shieldOverlayShowConfirmFrames = (shieldOverlayShowConfirmFrames + 1).coerceAtMost(30)
            }
            if (showShieldDecisionOverlay && (isShieldDecisionOverlayVisible || shieldOverlayShowConfirmFrames >= 2)) {
                val oppIdxForOverlay = if (pendingChargedAttackOppSlotIdx in 0..2) pendingChargedAttackOppSlotIdx else activeOppIdx.coerceIn(0, 2)
                val preThrowE = if (pendingChargedAttackPreOppEnergy > 0) {
                    pendingChargedAttackPreOppEnergy
                } else {
                    (oppSlotEnergy[oppIdxForOverlay] + pendingChargedAttackDeductedEnergy).coerceIn(cheapestOppEnergy, 100)
                }
                showOrUpdateShieldDecisionOverlay(
                    oppSlotIdx = oppIdxForOverlay,
                    userSlotIdx = activeUserIdx.coerceIn(0, 2),
                    preThrowOppEnergy = preThrowE
                )
            } else if (!showShieldDecisionOverlay && isShieldDecisionOverlayVisible) {
                hideShieldDecisionOverlay()
            }
            if (!wasPromptActive || hpChanged) {
                recalculateAndPushBattleData()
            }
            return
        } else {
            // v4.07 / v4.09: Reset show debounce and hide Shield Decision Overlay ONLY when BOTH the opponent's
            // 5-second countdown circle AND the "Attack incoming!" OCR prompt are inactive!
            if (!isTopCountdownCircleActive && !hasAttackIncomingText) {
                shieldOverlayShowConfirmFrames = 0
                lastShieldOverlayConfirmFrameMs = 0L
                if (isShieldDecisionOverlayVisible) {
                    hideShieldDecisionOverlay()
                }
            }
            if (isAttackIncomingPromptActive && !isTopCountdownCircleActive &&
                (isNormalFastCombatFrame || postOppChargedMissingPlayerHpFrames >= 6 || (nowMs - attackIncomingDetectedAtMs) > 1200L)
            ) {
                isAttackIncomingPromptActive = false
                pllValidatedThisShieldDelay = false
                hpChanged = true
            }
        }

        // 3. Detect Player Charged Attack Minigame ("Get ready!" / "GREAT!" / "EXCELLENT!" / "NICE!" or both floating HP bars & Charge Move buttons hidden for >= 1400ms)
        //    Gated by NO shield prompt before the attack (`hadShieldPromptBeforeCurrentCharge = false`, `lastChargedPromptActor = "user"`).
        //    Rolls back any spurious energy registered during the throw zoom-in animation, and waits for Section 4 to show the toast with the ACTUAL move used!
        val isPlayerChargedScreen = hasUserChargedBannerText ||
            (missingBothHpBarsFrames >= 14 && pendingChargedAttackActor != "opp" && !isAttackIncomingPromptActive &&
                (sampledOppBalls in 1..3 || sampledPlayerBalls in 1..3 || (lastSteadyMoveButtonsSeenMs > 0L && (nowMs - lastSteadyMoveButtonsSeenMs) <= 6000L)))
        if (isPlayerChargedScreen && !isPostFaintSwitchPromptActive) {
            if (hasUserChargedBannerText) {
                pendingUserChargeConfirmedByOcr = true
            }
            isAttackIncomingPromptActive = false
            sampledShieldHexagonVisible = false
            shieldHexagonConfirmFrames = 0
            if (isShieldDecisionOverlayVisible) {
                hideShieldDecisionOverlay()
            }
            hadShieldPromptBeforeCurrentCharge = false
            lastChargedPromptActor = "user"
            lastChargedPromptTimeMs = nowMs
            predictedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
            predictedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
            if (pendingChargedAttackActor != "user" && (nowMs - lastChargedAttackLoggedMs) > 3200L) {
                hasBattleStarted = true
                rollbackPendingProactiveStep(markAnchorRolledBack = false)
                proactiveRolledBackAnchorMs = 0L
                pendingUserChargeConfirmedByOcr = hasUserChargedBannerText
                pendingChargedAttackHudThumbB64 = captureCompactHudStripWebpBase64()

                val bestStableLeftFill = max(lastStableLeftChargeFillPct, prevStableLeftChargeFillPct)
                val bestStableRightFill = max(lastStableRightChargeFillPct, prevStableRightChargeFillPct)
                val rawPreLeft = if (bestStableLeftFill > 0) bestStableLeftFill else lastScannedLeftChargeFillPct[activeUserIdx].coerceAtLeast(0)
                val rawPreRight = if (bestStableRightFill > 0) bestStableRightFill else lastScannedRightChargeFillPct[activeUserIdx].coerceAtLeast(0)
                val recentHighWaterE = if ((nowMs - recentStableReadyEnergyMs[activeUserIdx]) <= 2500L) recentStableReadyEnergy[activeUserIdx] else 0
                val bankedEForCircles = max(max(playerSlotEnergy[activeUserIdx], lastStableNormalCombatEnergy), max(prevStableNormalCombatEnergy, recentHighWaterE)).coerceIn(0, 100)
                if (playerSlotEnergy[activeUserIdx] < bankedEForCircles) {
                    playerSlotEnergy[activeUserIdx] = bankedEForCircles
                    playerSlotEnergyAnchor[activeUserIdx] = bankedEForCircles
                }
                recentStableReadyEnergy[activeUserIdx] = 0
                recentStableReadyEnergyMs[activeUserIdx] = 0L
                preChargeLeftFillPct = if (bankedEForCircles >= userMove1Energy && rawPreLeft < 85) {
                    ((bankedEForCircles * 100.0) / userMove1Energy.toDouble()).roundToInt().coerceIn(95, 200)
                } else rawPreLeft
                preChargeRightFillPct = if (hasSecondUserMove && bankedEForCircles >= userMove2Energy && rawPreRight < 85) {
                    ((bankedEForCircles * 100.0) / userMove2Energy.toDouble()).roundToInt().coerceIn(95, 200)
                } else rawPreRight

                // Ensure banked energy is at least as high as any visibly ready circle (>= 95% fill) or cheapestUserEnergy
                // v5.12: Top up playerSlotEnergy for up to 1 fast move of tap lag WITHOUT inflating confirmedPhasePlayerTurns or opponent energy!
                val minReadyEnergy = when {
                    hasSecondUserMove && preChargeRightFillPct >= 95 && preChargeLeftFillPct >= 95 -> max(userMove1Energy, userMove2Energy)
                    hasSecondUserMove && preChargeRightFillPct >= 95 -> userMove2Energy
                    preChargeLeftFillPct >= 95 -> userMove1Energy
                    else -> cheapestUserEnergy
                }
                if (playerSlotEnergy[activeUserIdx] < minReadyEnergy) {
                    val missingUserFasts = ceil((minReadyEnergy - playerSlotEnergy[activeUserIdx]).toDouble() / userFastEnergyForStats.toDouble()).toInt().coerceIn(1, 3)
                    playerSlotEnergy[activeUserIdx] = (playerSlotEnergy[activeUserIdx] + missingUserFasts * userFastEnergyForStats).coerceIn(minReadyEnergy, 100)
                }

                preChargeUserEnergy = playerSlotEnergy[activeUserIdx].coerceIn(cheapestUserEnergy, 100)

                // v5.12: Reconcile opponent energy strictly against confirmedPhasePlayerTurns (never unconfirmed sub-turns or top-ups)
                val effectivePlayerThrowTurns = confirmedPhasePlayerTurns
                if (effectivePlayerThrowTurns > 0) {
                    val maxCompletedOppMovesBeforeThrow = ceil(effectivePlayerThrowTurns.toDouble() / oppFastTurnsForStats.toDouble()).toInt()
                    val creditedOppMovesInPhase = phaseOppTurns / oppFastTurnsForStats
                    if (creditedOppMovesInPhase < maxCompletedOppMovesBeforeThrow) {
                        val completedDelta = maxCompletedOppMovesBeforeThrow - creditedOppMovesInPhase
                        oppSlotEnergy[activeOppIdx] = (oppSlotEnergy[activeOppIdx] + completedDelta * oppFastEnergyForStats).coerceIn(0, 100)
                        oppSlotTurnsOnField[activeOppIdx] = (oppSlotTurnsOnField[activeOppIdx] + completedDelta * oppFastTurnsForStats).coerceAtLeast(0)
                    }
                }
                pendingChargedAttackActor = "user"
                pendingChargedAttackStartMs = nowMs
                postChargeCirclesReturnedAtMs = 0L
                pendingChargedAttackOppSlotIdx = activeOppIdx.coerceIn(0, 2)
                pendingChargedAttackUserSlotIdx = activeUserIdx.coerceIn(0, 2)
                pendingChargedAttackOppRawName = detectedOpponents.getOrNull(activeOppIdx) ?: activeOpponentName
                pendingChargedAttackOppShadow = isOpponentShadow
                // Detect if the opponent manually switched right before/as the player pressed the charged move button (Catch!)
                pendingChargedAttackWasOppCatch = !lastOppSwitchWasFaint && (nowMs - lastOppSwitchTimeMs) in 0..2500L
                for (i in 0..2) {
                    val preJumpUserHp = if ((nowMs - playerSlotLastBigJumpMs[i]) <= 2500L &&
                        (nowMs - lastPlayerSwitchTimeMs) > 2500L &&
                        playerSlotPriorHpPct[i] in 1..100
                    ) {
                        playerSlotPriorHpPct[i]
                    } else {
                        confirmedPlayerSlotHpPct[i].takeIf { it in 1..100 } ?: playerSlotHpPct[i].coerceIn(1, 100)
                    }
                    pendingChargedAttackPreUserSlotHp[i] = preJumpUserHp
                    val preJumpOppHp = if ((nowMs - oppSlotLastBigJumpMs[i]) <= 2500L &&
                        (nowMs - lastOppSwitchTimeMs) > 2500L &&
                        oppSlotPriorHpPct[i] in 1..100
                    ) {
                        oppSlotPriorHpPct[i]
                    } else {
                        confirmedOppSlotHpPct[i].takeIf { it in 1..100 } ?: oppSlotHpPct[i].coerceIn(1, 100)
                    }
                    pendingChargedAttackPreOppSlotHp[i] = preJumpOppHp
                }
                pendingChargedAttackPreOppBalls = oppPokeballCount
                pendingChargedAttackPreUserBalls = playerPokeballCount
                // v6.04: Lock pre-charge HP to last confirmed debounced slot HP unless a confirmed catch/swap occurred
                pendingChargedAttackPreUserHp = pendingChargedAttackPreUserSlotHp[activeUserIdx].coerceIn(1, 100)
                pendingChargedAttackPreOppHp = pendingChargedAttackPreOppSlotHp[activeOppIdx].coerceIn(1, 100)
                pendingChargedAttackPreUserShields = playerShieldsRemaining
                pendingChargedAttackPreOppShields = oppShieldsRemaining
                pendingChargedAttackAttackerName = activeUserPokemonName ?: userSlotCfg?.name ?: "Player"
                pendingChargedAttackDefenderName = formatOpponentNameWithShadow(pendingChargedAttackOppRawName)

                // Provisional deduction during minigame (reconciled to exact Move 1 vs Move 2 energy in Section 4; NO premature -50E toast here!)
                val initialProvisionalCost = when {
                    hasSecondUserMove && preChargeRightFillPct >= 95 && preChargeLeftFillPct < 92 -> userMove2Energy
                    preChargeLeftFillPct >= 95 && (!hasSecondUserMove || preChargeRightFillPct < 92) -> userMove1Energy
                    else -> cheapestUserEnergy
                }
                val postProvisionalEnergy = (preChargeUserEnergy - initialProvisionalCost).coerceIn(0, 100)
                playerSlotEnergy[activeUserIdx] = postProvisionalEnergy
                playerSlotEnergyAnchor[activeUserIdx] = postProvisionalEnergy
                nearCeilingStepStartMs[activeUserIdx] = 0L
                playerSlotCeilingLatched100[activeUserIdx] = false
                pendingChargedAttackDeductedEnergy = initialProvisionalCost
                lastUserChargePreEnergySnapshot = preChargeUserEnergy
                lastUserChargeDeductedEnergySnapshot = initialProvisionalCost
                phaseStartPlayerEnergy = postProvisionalEnergy
                confirmedPhasePlayerTurns = 0
                lastConfirmedPlayerFastMoveMs = 0L
                awaitingPostUserChargeCircleSync = true
                resetSlotEnergyTracking(activeUserIdx, postProvisionalEnergy)
                phasePlayerTurns = 0
                phaseOppTurns = 0
                playerSlotCurrentMoveTurns[activeUserIdx] = 0
                oppSlotCurrentMoveTurns[activeOppIdx] = 0
                isPlayerInIdleFallback = false
                lastIdleFallbackOppCreditMs = 0L
                lastTurnTickTimeMs = System.currentTimeMillis()
                turnResidualMs = 0L
                hpChanged = true
            }
            if (hpChanged) recalculateAndPushBattleData()
            return
        }

        val isPostChargedKoReady = (pendingChargedAttackActor == "user" && postUserChargedMissingOppHpFrames >= 6) ||
            (pendingChargedAttackActor == "opp" && postOppChargedMissingPlayerHpFrames >= 6)

        if (!isNormalFastCombatFrame && !isPostChargedKoReady) {
            lastTurnTickTimeMs = System.currentTimeMillis()
            turnResidualMs = 0L
            if (hpChanged) recalculateAndPushBattleData()
            return
        }

        // 4. Reconcile Pending Charged Attack once defender's HP bar returns or KO is confirmed
        //    v3.92 / v4.10 / v6.04: <name> used <move> Gated Attribution + Pre-Charge Attacker Slot Lock + Bidirectional Catch Handling
        //    + Post-Cutscene HP Drain Settle Window (950ms when no shield dropped and HP delta <= 3%) + Combat HUD Return KO Gate!
        val hasReturnedCombatCircles = (sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300) &&
            (sampledPlayerBalls in 1..3 || sampledOppBalls in 1..3)
        val hasReturnedTopHudOrCircles = hasReturnedCombatCircles ||
            sampledPlayerBalls in 1..3 ||
            sampledOppBalls in 1..3 ||
            sampledTopRightNameplateVisible
        if (pendingChargedAttackActor == "opp" &&
            !isTopCountdownCircleActive &&
            !isOpponentCountdownCircleActive &&
            (nowMs - pendingChargedAttackStartMs) >= 5000L &&
            (hasReturnedCombatCircles || isPostFaintSwitchPromptActive) &&
            postChargeCirclesReturnedAtMs == 0L
        ) {
            postChargeCirclesReturnedAtMs = nowMs
        } else if (pendingChargedAttackActor == "user" &&
            (nowMs - pendingChargedAttackStartMs) >= 1800L &&
            hasReturnedCombatCircles &&
            postChargeCirclesReturnedAtMs == 0L
        ) {
            postChargeCirclesReturnedAtMs = nowMs
        }
        val userShieldDroppedEarly = playerShieldsRemaining < pendingChargedAttackPreUserShields
        val liveUserHpDropEarly = if (sampledPlayerHpPct in 1..100) (pendingChargedAttackPreUserHp - sampledPlayerHpPct) else 0
        val isUserDrainSettledAfterOppCharge = userShieldDroppedEarly ||
            liveUserHpDropEarly >= 4 ||
            (postChargeCirclesReturnedAtMs > 0L && (nowMs - postChargeCirclesReturnedAtMs) >= 950L) ||
            (nowMs - pendingChargedAttackStartMs) >= 7600L

        val oppShieldDroppedEarly = oppShieldsRemaining < pendingChargedAttackPreOppShields
        val liveOppHpDropEarly = if (sampledOppHpPct in 1..100) (pendingChargedAttackPreOppHp - sampledOppHpPct) else 0
        val isOppDrainSettledAfterUserCharge = oppShieldDroppedEarly ||
            liveOppHpDropEarly >= 4 ||
            (postChargeCirclesReturnedAtMs > 0L && (nowMs - postChargeCirclesReturnedAtMs) >= 950L) ||
            (nowMs - pendingChargedAttackStartMs) >= 7200L

        val isDefenderHpReadyAfterCharge = (pendingChargedAttackActor == "opp" &&
            !isTopCountdownCircleActive &&
            !isOpponentCountdownCircleActive &&
            (hasReturnedCombatCircles || isPostFaintSwitchPromptActive || (nowMs - pendingChargedAttackStartMs) >= 8200L) &&
            (hasReturnedTopHudOrCircles || (nowMs - attackIncomingDetectedAtMs) >= 1500L) &&
            ((sampledPlayerHpPct in 1..100 && playerSlotHpConfirmFrames[activeUserIdx] >= reqHpDebounce && isUserDrainSettledAfterOppCharge && (!sampledPlayerHasPendingDmg || (nowMs - pendingChargedAttackStartMs) >= 7600L)) ||
                ((hasReturnedCombatCircles || isPostFaintSwitchPromptActive) && (postOppChargedMissingPlayerHpFrames >= 6 || (nowMs - pendingChargedAttackStartMs) >= 8200L) && (nowMs - pendingChargedAttackStartMs) >= 5200L))) ||
            (pendingChargedAttackActor == "user" &&
                (hasReturnedCombatCircles || (nowMs - pendingChargedAttackStartMs) >= 7500L) &&
                ((sampledOppHpPct in 1..100 && oppSlotHpConfirmFrames[activeOppIdx] >= reqHpDebounce && isOppDrainSettledAfterUserCharge && (!sampledOppHasPendingDmg || (nowMs - pendingChargedAttackStartMs) >= 7200L)) ||
                    (hasReturnedCombatCircles && (postUserChargedMissingOppHpFrames >= 6 || (nowMs - pendingChargedAttackStartMs) >= 7800L) && (nowMs - pendingChargedAttackStartMs) >= 5200L)))
        if (pendingChargedAttackActor.isNotEmpty() &&
            (nowMs - pendingChargedAttackStartMs) >= 1800L &&
            !hasUserChargedBannerText &&
            !hasAttackIncomingText &&
            !isTopCountdownCircleActive &&
            (isDefenderHpReadyAfterCharge || isPostChargedKoReady)
        ) {
            // Enforce Shield-Prompt Gate on actor: opponent charged attack ONLY if there was a shield prompt before the attack
            val actor = if (hadShieldPromptBeforeCurrentCharge) "opp" else pendingChargedAttackActor
            val eventT = getElapsedBattleSeconds(pendingChargedAttackStartMs)
            val playerRemSec = if (playerSwapEndTimeMs > nowMs) ceil((playerSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
            val oppRemSec = if (oppSwapEndTimeMs > nowMs) ceil((oppSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0

            if (actor == "opp") {
                // v3.93: Lock attacker to the opponent slot from "<name> used <move>!" or the Pokémon on screen PRIOR to the charged move!
                // Even if the opponent immediately swaps after throwing, move confirmation and energy deduction go to `attackerOppSlotIdx`!
                val hasValidBannerSlot = lastDetectedBannerMoveActor == "opp" &&
                    (nowMs - lastDetectedBannerMoveTimeMs) <= 7500L &&
                    lastDetectedBannerMoveOppSlotIdx in 0..2
                val attackerOppSlotIdx = when {
                    hasValidBannerSlot -> lastDetectedBannerMoveOppSlotIdx
                    pendingChargedAttackOppSlotIdx in 0..2 -> pendingChargedAttackOppSlotIdx
                    lastOppChargedAttackerSlotIdx in 0..2 -> lastOppChargedAttackerSlotIdx
                    lastNormalCombatOppSlotIdx in 0..2 -> lastNormalCombatOppSlotIdx
                    else -> activeOppIdx.coerceIn(0, 2)
                }
                val attackerOppRawName = detectedOpponents.getOrNull(attackerOppSlotIdx)
                    ?: pendingChargedAttackOppRawName.ifBlank { lastOppChargedAttackerRawName.ifBlank { activeOpponentName } }
                val attackerOppBase = FormResolver.extractBaseSpecies(attackerOppRawName).lowercase()
                val attackerOppShadow = manualShadowOverrides[attackerOppBase] ?: pendingChargedAttackOppShadow
                val attackerOppMeta = OverlayService.computeEffectiveCombatStats(
                    getPokemonMeta(attackerOppRawName, activeLeague, attackerOppShadow),
                    activeLeague
                )
                val attackerOppThirdMove = attackerOppMeta.chargedMove3.takeIf { it.isNotBlank() }
                    ?: COMMON_THIRD_CHARGED_MOVE[attackerOppMeta.name]
                    ?: "Outrage"
                val attackerOppMoveNames = listOf(
                    attackerOppMeta.chargedMove1,
                    attackerOppMeta.chargedMove2,
                    attackerOppThirdMove,
                    attackerOppMeta.chargedMove4
                ).filter { it.isNotBlank() }.distinct()
                val attackerOppMoveEnergyMap = attackerOppMoveNames.associateWith { mName ->
                    val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, attackerOppMeta.types.firstOrNull() ?: "normal")
                    (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50).coerceIn(35, 100)
                }
                val attackerCheapestOppEnergy = attackerOppMoveEnergyMap.values.minOrNull() ?: 45

                val alreadyDeducted = pendingChargedAttackDeductedEnergy.coerceAtLeast(0)
                // v6.02: If mid-banner OCR or swap detection changed `attackerOppSlotIdx` away from `pendingChargedAttackOppSlotIdx`,
                // refund the provisional deduction back to `pendingChargedAttackOppSlotIdx` before deducting from `attackerOppSlotIdx`!
                if (pendingChargedAttackOppSlotIdx in 0..2 && attackerOppSlotIdx != pendingChargedAttackOppSlotIdx && alreadyDeducted > 0) {
                    oppSlotEnergy[pendingChargedAttackOppSlotIdx] = (oppSlotEnergy[pendingChargedAttackOppSlotIdx] + alreadyDeducted).coerceIn(0, 100)
                    pendingChargedAttackPreOppEnergy = max(oppSlotEnergy[attackerOppSlotIdx], attackerCheapestOppEnergy).coerceIn(attackerCheapestOppEnergy, 100)
                    pendingChargedAttackDeductedEnergy = 0
                }
                lastOppChargedAttackerSlotIdx = attackerOppSlotIdx
                lastOppChargedAttackerRawName = attackerOppRawName
                lastOppChargedAttackerShadow = attackerOppShadow

                // If opponent swapped out immediately after throwing, keep the thrower slot alive at its pre-charge HP
                if (activeOppIdx != attackerOppSlotIdx && attackerOppSlotIdx in 0..2) {
                    oppFaintedSlots[attackerOppSlotIdx] = false
                    oppSlotHpPct[attackerOppSlotIdx] = pendingChargedAttackPreOppSlotHp[attackerOppSlotIdx].coerceIn(1, 100)
                    confirmedOppSlotHpPct[attackerOppSlotIdx] = oppSlotHpPct[attackerOppSlotIdx]
                    oppSlotPreFaintHpPct[attackerOppSlotIdx] = oppSlotHpPct[attackerOppSlotIdx]
                }

                // v3.92: Account for Player Catching the Opponent's Charged Move (`activeUserIdx != pendingChargedAttackUserSlotIdx`)
                val preChargeUserSlot = pendingChargedAttackUserSlotIdx.takeIf { it in 0..2 } ?: activeUserIdx.coerceIn(0, 2)
                val playerCaughtMove = activeUserIdx in 0..2 &&
                    preChargeUserSlot in 0..2 &&
                    activeUserIdx != preChargeUserSlot &&
                    postOppChargedMissingPlayerHpFrames < 6
                val defenderUserIdx = if (postOppChargedMissingPlayerHpFrames >= 6 && activeUserIdx != preChargeUserSlot && (nowMs - lastPlayerSwitchTimeMs) > 3000L) {
                    // Replacement player Pokémon entered after pre-charge Pokémon fainted
                    preChargeUserSlot
                } else {
                    activeUserIdx.coerceIn(0, 2)
                }

                if (playerCaughtMove) {
                    // Preserve the swapped-out player Pokémon's pre-swap HP
                    playerFaintedSlots[preChargeUserSlot] = false
                    playerSlotHpPct[preChargeUserSlot] = pendingChargedAttackPreUserSlotHp[preChargeUserSlot].coerceIn(1, 100)
                    confirmedPlayerSlotHpPct[preChargeUserSlot] = playerSlotHpPct[preChargeUserSlot]
                    playerSlotPreFaintHpPct[preChargeUserSlot] = playerSlotHpPct[preChargeUserSlot]
                    lastScannedPlayerSlotHpPct[preChargeUserSlot] = playerSlotHpPct[preChargeUserSlot]
                    if (playerSwapEndTimeMs <= pendingChargedAttackStartMs) {
                        playerSwapEndTimeMs = pendingChargedAttackStartMs + 50000L
                    }
                }

                val defenderUserCfg = preset?.pokemon?.getOrNull(defenderUserIdx) ?: userSlotCfg
                val defenderUserName = defenderUserCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
                val defenderUserShadow = defenderUserName.contains("Shadow", ignoreCase = true)
                val defenderUserMeta = if (defenderUserIdx != activeUserIdx || playerCaughtMove) {
                    OverlayService.computeEffectiveCombatStats(
                        getPokemonMeta(defenderUserName, activeLeague, defenderUserShadow),
                        activeLeague,
                        defenderUserCfg?.cp,
                        defenderUserCfg?.ivs
                    )
                } else {
                    userMetaForStats
                }

                val candPairs = attackerOppMoveNames.map { mName ->
                    mName to calculateChargedMoveDamagePercent(
                        attacker = attackerOppMeta,
                        defender = defenderUserMeta,
                        moveName = mName,
                        isAttackerShadow = attackerOppShadow,
                        isDefenderShadow = defenderUserShadow
                    )
                }
                val maxCandidateExpectedDmgPct = candPairs.maxOfOrNull { it.second } ?: 0

                // v3.94 / v6.02: Never mark a player slot fainted after an opponent charged move if visible Pokéballs or shield usage prove no new faint occurred!
                // Also support Lethal Disappearing HP Bar KO detection when unshielded and expected move damage >= 80% of remaining HP.
                val playerShieldedThisCharge = playerShieldsRemaining < pendingChargedAttackPreUserShields
                val ballsProveNoNewUserFaint = sampledPlayerBalls == 3 ||
                    debouncedPlayerBalls == 3 ||
                    playerShieldedThisCharge ||
                    (!isPostFaintSwitchPromptActive && sampledPlayerBalls >= pendingChargedAttackPreUserBalls && debouncedPlayerBalls >= pendingChargedAttackPreUserBalls) ||
                    (debouncedPlayerBalls == 2 && pendingChargedAttackPreUserBalls <= 2 && playerFaintedSlots.count { it } >= 1)
                val hpBefore = if (playerCaughtMove || defenderUserIdx != preChargeUserSlot) {
                    pendingChargedAttackPreUserSlotHp[defenderUserIdx].coerceIn(1, 100)
                } else {
                    pendingChargedAttackPreUserHp.coerceIn(1, 100)
                }
                val isLethalDisappearingPlayerHpBar = !playerShieldedThisCharge &&
                    !ballsProveNoNewUserFaint &&
                    (hasReturnedCombatCircles || isPostFaintSwitchPromptActive) &&
                    (postOppChargedMissingPlayerHpFrames >= 6 || isPostFaintSwitchPromptActive || sampledPlayerBalls in 1 until pendingChargedAttackPreUserBalls) &&
                    maxCandidateExpectedDmgPct >= (hpBefore * 0.80).toInt().coerceAtLeast(20)
                if ((postOppChargedMissingPlayerHpFrames >= 6 || isLethalDisappearingPlayerHpBar) && !ballsProveNoNewUserFaint && (hasReturnedCombatCircles || isPostFaintSwitchPromptActive)) {
                    playerFaintedSlots[defenderUserIdx] = true
                    lastUserSlotKoTimeMs[defenderUserIdx] = nowMs
                    playerSlotHpPct[defenderUserIdx] = 0
                    lastScannedPlayerSlotHpPct[defenderUserIdx] = 0
                    predictedPlayerSlotHpPct[defenderUserIdx] = 0
                    confirmedPlayerSlotHpPct[defenderUserIdx] = 0
                    pendingConfirmPlayerSlotHpPct[defenderUserIdx] = 0
                    playerSlotEnergy[defenderUserIdx] = 0
                    playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
                }

                val rawPostHp = if (playerFaintedSlots[defenderUserIdx] || isLethalDisappearingPlayerHpBar) {
                    0
                } else if (defenderUserIdx == activeUserIdx && pendingConfirmPlayerSlotHpPct[activeUserIdx] in 1..100) {
                    min(playerSlotHpPct[defenderUserIdx].coerceIn(0, 100), pendingConfirmPlayerSlotHpPct[activeUserIdx])
                } else {
                    playerSlotHpPct[defenderUserIdx].coerceIn(0, 100)
                }
                val postHp = if (!playerCaughtMove && defenderUserIdx == preChargeUserSlot) {
                    rawPostHp.coerceIn(0, hpBefore)
                } else {
                    rawPostHp.coerceIn(0, 100)
                }
                val hpDelta = max(0, hpBefore - postHp)
                val shieldDropped = playerShieldsRemaining < pendingChargedAttackPreUserShields
                val blockedByBanner = (nowMs - lastDetectedBlockedBannerMs) <= 6500L && lastDetectedBlockedBannerMs >= pendingChargedAttackStartMs - 1000L
                val disguiseBusted = ((nowMs - lastDetectedDisguiseBustedBannerMs) <= 6500L && lastDetectedDisguiseBustedBannerMs >= pendingChargedAttackStartMs - 1000L) ||
                    (defenderUserName.contains("Mimikyu", ignoreCase = true) && hpDelta <= 3 && !shieldDropped)
                // v6.02 / v6.04 / v6.12: Pre-Zoom 1-Fast-Move Chip Shield Heuristic (`activeShieldChipTolerancePct`) + BLOCKED! Banner OCR
                val oneOppFastDmgPct = ceil(oppExactDmgPct).toInt().coerceIn(1, 15)
                val userShieldChipCap = min(activeShieldChipTolerancePct, max(6, oneOppFastDmgPct + 3))
                val isChipShielded = !shieldDropped &&
                    pendingChargedAttackPreUserShields > 0 &&
                    !playerFaintedSlots[defenderUserIdx] &&
                    (hpDelta <= 3 || (hpDelta <= userShieldChipCap && maxCandidateExpectedDmgPct >= 35))
                val shielded = shieldDropped || isChipShielded || blockedByBanner
                if (!shielded && defenderUserIdx in 0..2) {
                    // v6.05: Persist post-charge unshielded HP directly into playerSlotHpPct so slot state never stays stuck at pre-charge HP!
                    playerSlotHpPct[defenderUserIdx] = postHp
                    confirmedPlayerSlotHpPct[defenderUserIdx] = postHp
                    lastScannedPlayerSlotHpPct[defenderUserIdx] = postHp
                    predictedPlayerSlotHpPct[defenderUserIdx] = postHp
                    if (postHp > 0) {
                        playerSlotPreFaintHpPct[defenderUserIdx] = postHp
                    }
                }
                var didAutoDecrUserShield = false
                if (((isChipShielded && hpDelta in 4..userShieldChipCap) || (blockedByBanner && !shieldDropped)) && !disguiseBusted && playerShieldsRemaining > 0) {
                    val nextShields = (playerShieldsRemaining - 1).coerceIn(0, 2)
                    val shieldNum = (2 - nextShields).coerceIn(1, 2)
                    battleTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "SHIELD",
                            actor = "user",
                            t = eventT,
                            shieldNumber = shieldNum,
                            activePokemon = defenderUserName,
                            pokemonShielded = defenderUserName,
                            userShieldsRemaining = nextShields,
                            oppShieldsRemaining = oppShieldsRemaining
                        )
                    )
                    playerShieldsRemaining = nextShields
                    lastPlayerShieldDecrementChargeStartMs = pendingChargedAttackStartMs
                    didAutoDecrUserShield = true
                }

                // Tier 1: Mid-screen Banner OCR ("<Opponent> used <Move>!")
                val bannerOppMove = if (lastDetectedBannerMoveActor == "opp" &&
                    (nowMs - lastDetectedBannerMoveTimeMs) <= 7500L &&
                    lastDetectedBannerMoveName.isNotBlank()
                ) {
                    lastDetectedBannerMoveName
                } else null

                // Tier 2: Unshielded HP drop fallback if Banner OCR missed it (evaluated against pre-charge attacker & catching defender)
                val strictHpMove = if (!shielded) inferUnshieldedChargedMoveName(hpDelta, candPairs) else null
                val bestGuessHpMove = if (!shielded) inferBestGuessChargedMoveByHp(hpDelta, candPairs) else null

                val resolvedOppMove = bannerOppMove ?: strictHpMove ?: bestGuessHpMove
                lastOppChargeHpInferredMoveName = if (bannerOppMove == null && resolvedOppMove != null) resolvedOppMove else ""
                // v3.93: Mark both strict and best-guess unshielded HP matches (as well as banner matches) on `attackerOppSlotIdx`!
                val confirmedMoveToRemember = resolvedOppMove
                if (confirmedMoveToRemember != null && attackerOppSlotIdx in 0..2) {
                    confirmedOppChargedMoves[attackerOppSlotIdx].add(confirmedMoveToRemember)
                }

                val totalTargetEnergy = if (resolvedOppMove != null) {
                    val mStats = OverlayService.resolveChargedMoveStatsStatic(resolvedOppMove, attackerOppMeta.types.firstOrNull() ?: "normal")
                    attackerOppMoveEnergyMap[resolvedOppMove] ?: (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[resolvedOppMove] ?: attackerCheapestOppEnergy).coerceIn(35, 100)
                } else {
                    // Tier 3 Fallback: Lowest energy viable opponent move on the thrower to err on the side of opponent having more energy
                    attackerCheapestOppEnergy
                }
                // v5.13 Fix 3 & v6.06 Equal/Higher-EPT Fast Move Promotion on Deficit Throw:
                var attackerFastName = detectedOppFastMoveOverride[attackerOppSlotIdx]?.takeIf { it.isNotBlank() }
                    ?: attackerOppMeta.defaultFastMove
                var attackerFastTurns = OverlayService.resolveFastTurnsStatic(attackerFastName, attackerOppMeta.fastTurns).coerceIn(1, 5)
                var attackerFastEnergy = OverlayService.resolveFastEnergyStatic(attackerFastName, attackerFastTurns).coerceIn(2, 20)
                if (resolvedOppMove != null && (totalTargetEnergy - pendingChargedAttackPreOppEnergy) > attackerFastEnergy && attackerOppSlotIdx in 0..2) {
                    val curEpt = attackerFastEnergy.toDouble() / attackerFastTurns.toDouble()
                    val legalFastPool = OverlayService.getAvailableMovePoolForSpeciesStatic(attackerOppMeta.name, activeLeague).first
                    val slotTurns = oppSlotTurnsOnField[attackerOppSlotIdx].coerceAtLeast(attackerFastTurns)
                    val bestHigherEptFast = legalFastPool.filter { candFast ->
                        !candFast.equals(attackerFastName, ignoreCase = true)
                    }.mapNotNull { candFast ->
                        val cTurns = OverlayService.resolveFastTurnsStatic(candFast, attackerFastTurns).coerceIn(1, 5)
                        val cEnergy = OverlayService.resolveFastEnergyStatic(candFast, cTurns).coerceIn(2, 20)
                        val cEpt = cEnergy.toDouble() / cTurns.toDouble()
                        val estGenerated = ((slotTurns + cTurns - 1) / cTurns) * cEnergy
                        if (cEpt > curEpt + 0.05 && estGenerated >= totalTargetEnergy - cEnergy) {
                            Triple(candFast, cTurns, cEnergy)
                        } else null
                    }.maxByOrNull { it.third.toDouble() / it.second.toDouble() }
                    if (bestHigherEptFast != null) {
                        val (newFast, newTurns, newEnergy) = bestHigherEptFast
                        detectedOppFastMoveOverride[attackerOppSlotIdx] = newFast
                        oppFastMoveConfirmed[attackerOppSlotIdx] = true
                        oppFastMoveStatus[attackerOppSlotIdx] = "confirmed"
                        val approxFastsDone = max(1, (pendingChargedAttackPreOppEnergy + attackerFastEnergy - 1) / max(1, attackerFastEnergy))
                        val recalcPreEnergy = max(totalTargetEnergy, (approxFastsDone * newEnergy).coerceIn(0, 100))
                        val energyGainDelta = (recalcPreEnergy - pendingChargedAttackPreOppEnergy).coerceAtLeast(0)
                        pendingChargedAttackPreOppEnergy = recalcPreEnergy
                        oppSlotEnergy[attackerOppSlotIdx] = (oppSlotEnergy[attackerOppSlotIdx] + energyGainDelta).coerceIn(0, 100)
                        attackerFastName = newFast
                        attackerFastTurns = newTurns
                        attackerFastEnergy = newEnergy
                    }
                }
                if (resolvedOppMove != null && (totalTargetEnergy - pendingChargedAttackPreOppEnergy) in 1..attackerFastEnergy) {
                    pendingChargedAttackPreOppEnergy = (pendingChargedAttackPreOppEnergy + attackerFastEnergy).coerceAtMost(100)
                    if (attackerOppSlotIdx in 0..2) {
                        oppSlotEnergy[attackerOppSlotIdx] = (oppSlotEnergy[attackerOppSlotIdx] + attackerFastEnergy).coerceIn(0, 100)
                        oppSlotTurnsOnField[attackerOppSlotIdx] = (oppSlotTurnsOnField[attackerOppSlotIdx] + attackerFastTurns).coerceAtLeast(0)
                    }
                }
                val effectiveAlreadyDeducted = pendingChargedAttackDeductedEnergy.coerceAtLeast(0)
                val extraToDeduct = (totalTargetEnergy - effectiveAlreadyDeducted).coerceAtLeast(0)
                if (extraToDeduct > 0 && attackerOppSlotIdx in 0..2) {
                    oppSlotEnergy[attackerOppSlotIdx] = (oppSlotEnergy[attackerOppSlotIdx] - extraToDeduct).coerceIn(0, 100)
                }
                lastOppChargeDeductedEnergySnapshot = totalTargetEnergy
                if (lastDetectedBannerMoveActor == "opp") {
                    lastDetectedBannerMoveActor = ""
                    lastDetectedBannerMoveName = ""
                    lastDetectedBannerMoveOppSlotIdx = -1
                }

                // Re-index turn offset and reset fast-move phase to Turn 0 after charged move camera cut
                scanTurnOffsetMs = ((nowMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
                turnPhaseAnchorMs = captureAnchorMs
                lastTurnTickTimeMs = System.currentTimeMillis()
                turnResidualMs = 0L
                if (!playerFaintedSlots[activeUserIdx] && !playerCaughtMove && lastStableNormalCombatEnergy > playerSlotEnergy[activeUserIdx]) {
                    playerSlotEnergy[activeUserIdx] = lastStableNormalCombatEnergy.coerceIn(0, 100)
                }
                phaseStartPlayerEnergy = playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
                confirmedPhasePlayerTurns = 0
                lastConfirmedPlayerFastMoveMs = 0L
                phasePlayerTurns = 0
                phaseOppTurns = 0
                playerSlotCurrentMoveTurns[activeUserIdx] = 0
                oppSlotCurrentMoveTurns[activeOppIdx] = 0
                playerLastFastCreditedAtMs[activeUserIdx] = 0L
                playerAutoIncrementAnchorMs[activeUserIdx] = 0L
                playerLastSelfCorrectionAtMs[activeUserIdx] = 0L
                pllValidatedThisShieldDelay = false
                oppLastFastCreditedAtMs[activeOppIdx] = 0L
                oppCreditedByOptimalTimerAtMs[activeOppIdx] = 0L
                isPlayerInIdleFallback = false
                lastIdleFallbackOppCreditMs = 0L
                if (sampledLeftChargeBtnFillPct in 0..200) {
                    lastScannedLeftChargeFillPct[activeUserIdx] = sampledLeftChargeBtnFillPct
                    pendingConfirmLeftChargeFillPct[activeUserIdx] = sampledLeftChargeBtnFillPct
                }
                if (sampledRightChargeBtnFillPct in 0..200) {
                    lastScannedRightChargeFillPct[activeUserIdx] = sampledRightChargeBtnFillPct
                    pendingConfirmRightChargeFillPct[activeUserIdx] = sampledRightChargeBtnFillPct
                }
                leftChargeFillConfirmFrames[activeUserIdx] = 0
                rightChargeFillConfirmFrames[activeUserIdx] = 0
                leftChargeFillDebounceStartMs[activeUserIdx] = 0L
                rightChargeFillDebounceStartMs[activeUserIdx] = 0L
                resetSlotEnergyTracking(activeUserIdx, playerSlotEnergy[activeUserIdx].coerceIn(0, 100),
                    cost1 = userMove1Energy,
                    cost2 = userMove2Energy,
                    clearThirdFillLatches = playerFaintedSlots[activeUserIdx]
                )
                lastScannedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
                lastScannedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
                predictedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
                predictedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
                postOppChargedMissingPlayerHpFrames = 0
                needsPostSwapOrMoveTurnReindex = true

                val formattedAttackerName = formatOpponentNameWithShadow(attackerOppRawName)
                val oppRawPreEnergy = pendingChargedAttackPreOppEnergy.coerceIn(0, 100)
                val oppEnergyDeficit = max(0, totalTargetEnergy - oppRawPreEnergy)
                val oppExpectedDmgPct = resolvedOppMove?.let { rMove ->
                    candPairs.find { it.first.equals(rMove, ignoreCase = true) }?.second
                        ?: calculateChargedMoveDamagePercent(
                            attacker = attackerOppMeta,
                            defender = defenderUserMeta,
                            moveName = rMove,
                            isAttackerShadow = attackerOppShadow,
                            isDefenderShadow = defenderUserShadow
                        )
                }
                val oppMoveSource = when {
                    bannerOppMove != null -> "BANNER_OCR"
                    strictHpMove != null || bestGuessHpMove != null -> "HP_DELTA"
                    else -> "DEFAULT_FALLBACK"
                }
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "CHARGED_ATTACK",
                        actor = "opp",
                        t = eventT,
                        activePokemon = formattedAttackerName,
                        pokemonShielded = if (shielded) defenderUserName else null,
                        shielded = shielded,
                        hpBeforePct = hpBefore,
                        hpAfterPct = if (shielded) max(1, hpBefore - 1) else postHp,
                        hpDeltaPct = if (shielded) 1 else hpDelta,
                        inferredMoveName = resolvedOppMove,
                        userSlotHpPct = playerSlotHpPct.toList(),
                        oppSlotHpPct = oppSlotHpPct.toList(),
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining,
                        recommendedAction = lastRecommendedAction.ifEmpty { null },
                        recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                        decisionPhase = "CHARGED_MOVE",
                        playerSwapRemainingSec = playerRemSec,
                        oppSwapRemainingSec = oppRemSec,
                        userEnergy = playerSlotEnergy[activeUserIdx],
                        oppEnergy = oppSlotEnergy[attackerOppSlotIdx],
                        turnIndex = battleTurnIndex,
                        scanTurnOffsetMs = scanTurnOffsetMs,
                        preThrowEnergy = oppRawPreEnergy,
                        requiredMoveEnergy = totalTargetEnergy,
                        energyDeficit = oppEnergyDeficit,
                        expectedMoveDmgPct = oppExpectedDmgPct,
                        moveResolutionSource = oppMoveSource,
                        hudThumbnailWebpBase64 = pendingChargedAttackHudThumbB64
                    )
                )
                pendingChargedAttackHudThumbB64 = null
                lastChargedAttackLoggedMs = nowMs
                lastChargedAttackLoggedActor = "opp"
                lastOppChargedAttackLoggedMs = nowMs
                lastOppChargedPreUserHp = hpBefore
                lastOppChargedDefenderUserSlotIdx = defenderUserIdx
                lastOppChargedWasProvisionalShield = isChipShielded && !shieldDropped
                lastOppChargedAutoDecrementedShield = didAutoDecrUserShield
                postChargeCirclesReturnedAtMs = 0L
                pendingChargedAttackActor = ""
                pendingUserChargeConfirmedByOcr = false
                pendingChargedAttackDeductedEnergy = 0
                pendingChargedAttackPreOppEnergy = 0
                pendingChargedAttackOppSlotIdx = -1
                pendingChargedAttackUserSlotIdx = -1
                pendingChargedAttackOppRawName = ""
                pendingChargedAttackWasOppCatch = false
                hadShieldPromptBeforeCurrentCharge = false
                if (!isTopCountdownCircleActive && (hasReturnedCombatCircles || (nowMs - shieldDecisionOverlayShownAtMs) >= 5000L)) {
                    hideShieldDecisionOverlay()
                }
                hpChanged = true
                val moveLabel = resolvedOppMove ?: "Charged Attack"
                val catchSuffix = if (playerCaughtMove) " [Caught by $defenderUserName]" else ""
                val outcomeLabel = if (shielded) "Shielded (-${totalTargetEnergy}E)" else "-${hpDelta}% HP (-${totalTargetEnergy}E)"
                showBattleToast("⚡ Opp $moveLabel ($outcomeLabel)$catchSuffix")
            } else if (actor == "user") {
                val preChargeOppSlot = pendingChargedAttackOppSlotIdx.takeIf { it in 0..2 } ?: activeOppIdx.coerceIn(0, 2)
                val shieldDropped = oppShieldsRemaining < pendingChargedAttackPreOppShields
                val oppSwappedDuringPlayerCharge = activeOppIdx in 0..2 && preChargeOppSlot in 0..2 && activeOppIdx != preChargeOppSlot

                // v3.92: Detect if the Opponent Caught the Player's Charged Move on `activeOppIdx`!
                val isOppCatchDuringThrow = oppSwappedDuringPlayerCharge &&
                    postUserChargedMissingOppHpFrames < 6 &&
                    (sampledOppBalls !in 1 until pendingChargedAttackPreOppBalls) &&
                    (oppSwapEndTimeMs <= pendingChargedAttackStartMs ||
                        !lastOppSwitchWasFaint ||
                        shieldDropped ||
                        (pendingChargedAttackPreOppSlotHp[activeOppIdx] - oppSlotHpPct[activeOppIdx]) >= 4)

                // v3.93/v3.94: Never mark an additional opponent slot fainted if visible Pokéballs or shield usage prove no new faint occurred!
                val ballsProveNoNewOppFaint = sampledOppBalls == 3 ||
                    debouncedOppBalls == 3 ||
                    shieldDropped ||
                    (sampledOppBalls >= pendingChargedAttackPreOppBalls && debouncedOppBalls >= pendingChargedAttackPreOppBalls) ||
                    (debouncedOppBalls == 2 && pendingChargedAttackPreOppBalls <= 2 && oppFaintedSlots.count { it } >= 1)
                if (postUserChargedMissingOppHpFrames >= 6 && !ballsProveNoNewOppFaint) {
                    // Lock faint attribution to pre-KO active opponent slot and cross-check with lowest HP history
                    val faintedOppIdx = resolveFaintedOpponentSlotIdx(
                        excludeActiveSlot = if (activeOppIdx != preChargeOppSlot && !isOppCatchDuringThrow) activeOppIdx else -1,
                        preferredPreKoSlot = preChargeOppSlot,
                        nowMs = nowMs
                    ).let { if (it in 0..2) it else preChargeOppSlot }
                    if (sampledOppBalls == 2) {
                        for (idx in 0..2) {
                            if (idx != faintedOppIdx && oppFaintedSlots[idx]) {
                                oppFaintedSlots[idx] = false
                                if (oppSlotHpPct[idx] <= 0) {
                                    oppSlotHpPct[idx] = oppSlotPreFaintHpPct[idx].coerceIn(1, 100)
                                }
                            }
                        }
                    }
                    oppFaintedSlots[faintedOppIdx] = true
                    oppSlotHpPct[faintedOppIdx] = 0
                    lastScannedOppSlotHpPct[faintedOppIdx] = 0
                    predictedOppSlotHpPct[faintedOppIdx] = 0
                    confirmedOppSlotHpPct[faintedOppIdx] = 0
                    pendingConfirmOppSlotHpPct[faintedOppIdx] = 0
                    oppSlotEnergy[faintedOppIdx] = 0
                    oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
                    // If the opponent manually swapped right before the throw to catch and got one-shot KO'd, preserve their 50s swap timer!
                    if (pendingChargedAttackWasOppCatch) {
                        if (oppSwapEndTimeMs <= pendingChargedAttackStartMs) {
                            oppSwapEndTimeMs = pendingChargedAttackStartMs + 50000L
                        }
                        oppSwitchConfirmedAlive = true
                    } else {
                        oppSwapEndTimeMs = 0L
                    }
                } else if (isOppCatchDuringThrow) {
                    // Opponent caught the player's charged move on `activeOppIdx` and survived!
                    // Keep the swapped-out opponent (`preChargeOppSlot`) alive at its pre-charge HP and start/preserve 50s swap clock.
                    oppFaintedSlots[preChargeOppSlot] = false
                    oppSlotHpPct[preChargeOppSlot] = pendingChargedAttackPreOppSlotHp[preChargeOppSlot].coerceIn(1, 100)
                    confirmedOppSlotHpPct[preChargeOppSlot] = oppSlotHpPct[preChargeOppSlot]
                    oppSlotPreFaintHpPct[preChargeOppSlot] = oppSlotHpPct[preChargeOppSlot]
                    lastScannedOppSlotHpPct[preChargeOppSlot] = oppSlotHpPct[preChargeOppSlot]
                    if (oppSwapEndTimeMs <= pendingChargedAttackStartMs) {
                        oppSwapEndTimeMs = pendingChargedAttackStartMs + 50000L
                    }
                    lastOppSwitchWasFaint = false
                    oppSwitchConfirmedAlive = true
                }

                val defenderOppIdx = if (isOppCatchDuringThrow) activeOppIdx.coerceIn(0, 2) else preChargeOppSlot.coerceIn(0, 2)
                val defenderOppRawName = detectedOpponents.getOrNull(defenderOppIdx)
                    ?: if (isOppCatchDuringThrow) activeOpponentName else pendingChargedAttackOppRawName.ifBlank { activeOpponentName }
                val defenderOppBase = FormResolver.extractBaseSpecies(defenderOppRawName).lowercase()
                val defenderOppShadow = manualShadowOverrides[defenderOppBase]
                    ?: if (isOppCatchDuringThrow) isOpponentShadow else pendingChargedAttackOppShadow
                val defenderOppMeta = if (defenderOppIdx != activeOppIdx || isOppCatchDuringThrow) {
                    OverlayService.computeEffectiveCombatStats(
                        getPokemonMeta(defenderOppRawName, activeLeague, defenderOppShadow),
                        activeLeague
                    )
                } else {
                    oppMetaForStats
                }

                // v6.02: Support player swap-and-immediate-throw attribution via banner OCR slot (`lastDetectedBannerMoveUserSlotIdx`)
                val hasValidUserBannerSlot = lastDetectedBannerMoveActor == "user" &&
                    (nowMs - lastDetectedBannerMoveTimeMs) <= 7500L &&
                    lastDetectedBannerMoveUserSlotIdx in 0..2
                val attackerUserIdx = when {
                    hasValidUserBannerSlot -> lastDetectedBannerMoveUserSlotIdx
                    pendingChargedAttackUserSlotIdx in 0..2 -> pendingChargedAttackUserSlotIdx
                    else -> activeUserIdx.coerceIn(0, 2)
                }
                val attackerUserCfg = preset?.pokemon?.getOrNull(attackerUserIdx) ?: userSlotCfg
                val attackerUserMonName = attackerUserCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
                val attackerUserShad = attackerUserMonName.contains("Shadow", ignoreCase = true)
                val attackerUserMeta = if (attackerUserIdx != activeUserIdx) {
                    OverlayService.computeEffectiveCombatStats(
                        getPokemonMeta(attackerUserMonName, activeLeague, attackerUserShad),
                        activeLeague,
                        attackerUserCfg?.cp,
                        attackerUserCfg?.ivs
                    )
                } else {
                    userMetaForStats
                }
                val attackerUserFastName = attackerUserCfg?.fastMove?.takeIf { it.isNotBlank() } ?: attackerUserMeta.defaultFastMove
                val attackerUserFastTurns = OverlayService.resolveFastTurnsStatic(attackerUserFastName, attackerUserMeta.fastTurns).coerceIn(1, 5)
                val attackerUserFastEnergy = OverlayService.resolveFastEnergyStatic(attackerUserFastName, attackerUserFastTurns).coerceIn(2, 20)
                val attackerMove1Name = attackerUserCfg?.chargedMove1?.takeIf { it.isNotBlank() } ?: attackerUserMeta.chargedMove1
                val attackerMove2Name = attackerUserCfg?.chargedMove2?.takeIf { it.isNotBlank() } ?: attackerUserMeta.chargedMove2
                val attackerHasSecondMove = attackerMove2Name.isNotBlank() && !attackerMove2Name.equals(attackerMove1Name, ignoreCase = true)
                val attackerMove1Cost = (OverlayService.resolveChargedMoveStatsStatic(attackerMove1Name, attackerUserMeta.types.firstOrNull() ?: "normal").energyCost
                    .takeIf { it > 0 } ?: MOVE_ENERGY_COST[attackerMove1Name] ?: 50).coerceIn(35, 100)
                val attackerMove2Cost = if (attackerHasSecondMove) {
                    (OverlayService.resolveChargedMoveStatsStatic(attackerMove2Name, attackerUserMeta.types.firstOrNull() ?: "normal").energyCost
                        .takeIf { it > 0 } ?: MOVE_ENERGY_COST[attackerMove2Name] ?: 50).coerceIn(35, 100)
                } else attackerMove1Cost
                val attackerMoveNames = listOfNotNull(attackerMove1Name, attackerMove2Name.takeIf { attackerHasSecondMove }).filter { it.isNotBlank() }.distinct()
                val attackerMoveEnergyMap = attackerMoveNames.associateWith { mName ->
                    when {
                        mName.equals(attackerMove2Name, ignoreCase = true) -> attackerMove2Cost
                        else -> attackerMove1Cost
                    }
                }
                val attackerCheapestUserEnergy = min(attackerMove1Cost, attackerMove2Cost).coerceIn(35, 100)

                val candPairs = attackerMoveNames.map { mName ->
                    mName to calculateChargedMoveDamagePercent(
                        attacker = attackerUserMeta,
                        defender = defenderOppMeta,
                        moveName = mName,
                        isAttackerShadow = attackerUserShad,
                        isDefenderShadow = defenderOppShadow
                    )
                }
                val maxUserCandExpectedDmgPct = candPairs.maxOfOrNull { it.second } ?: 0

                val hpBefore = if (isOppCatchDuringThrow || pendingChargedAttackWasOppCatch) {
                    pendingChargedAttackPreOppSlotHp[defenderOppIdx].coerceIn(1, 100)
                } else {
                    pendingChargedAttackPreOppHp.coerceIn(1, 100)
                }
                // v6.04: Lethal Disappearing Opponent HP Bar KO detection gated on combat HUD return + Pokeball drop or 6 missing frames
                val isLethalDisappearingOppHpBar = !shieldDropped &&
                    !ballsProveNoNewOppFaint &&
                    hasReturnedCombatCircles &&
                    (postUserChargedMissingOppHpFrames >= 6 || sampledOppBalls in 1 until pendingChargedAttackPreOppBalls) &&
                    maxUserCandExpectedDmgPct >= (hpBefore * 0.80).toInt().coerceAtLeast(20)
                if (isLethalDisappearingOppHpBar && !oppFaintedSlots[defenderOppIdx]) {
                    oppFaintedSlots[defenderOppIdx] = true
                    lastSlotKoTimeMs[defenderOppIdx] = nowMs
                    oppSlotHpPct[defenderOppIdx] = 0
                    lastScannedOppSlotHpPct[defenderOppIdx] = 0
                    predictedOppSlotHpPct[defenderOppIdx] = 0
                    confirmedOppSlotHpPct[defenderOppIdx] = 0
                    pendingConfirmOppSlotHpPct[defenderOppIdx] = 0
                    oppSlotEnergy[defenderOppIdx] = 0
                    oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
                }
                val rawPostOppHp = if (oppFaintedSlots[defenderOppIdx] || isLethalDisappearingOppHpBar) {
                    0
                } else if (defenderOppIdx == activeOppIdx && pendingConfirmOppSlotHpPct[activeOppIdx] in 1..100) {
                    min(oppSlotHpPct[defenderOppIdx].coerceIn(0, 100), pendingConfirmOppSlotHpPct[activeOppIdx])
                } else {
                    oppSlotHpPct[defenderOppIdx].coerceIn(0, 100)
                }
                val postHp = if (!isOppCatchDuringThrow && !pendingChargedAttackWasOppCatch && defenderOppIdx == preChargeOppSlot) {
                    rawPostOppHp.coerceIn(0, hpBefore)
                } else {
                    rawPostOppHp.coerceIn(0, 100)
                }
                val hpDelta = max(0, hpBefore - postHp)
                val oppBlockedByBanner = (nowMs - lastDetectedBlockedBannerMs) <= 6500L && lastDetectedBlockedBannerMs >= pendingChargedAttackStartMs - 1000L
                val oppDisguiseBusted = ((nowMs - lastDetectedDisguiseBustedBannerMs) <= 6500L && lastDetectedDisguiseBustedBannerMs >= pendingChargedAttackStartMs - 1000L) ||
                    (defenderOppRawName.contains("Mimikyu", ignoreCase = true) && hpDelta <= 3 && !shieldDropped)
                // v6.02 / v6.04 / v6.12: Pre-Zoom 1-Fast-Move Chip Shield Heuristic (`activeShieldChipTolerancePct`) + BLOCKED! Banner OCR
                val oneUserFastDmgPct = ceil(userExactDmgPct).toInt().coerceIn(1, 15)
                val oppShieldChipCap = min(activeShieldChipTolerancePct, max(6, oneUserFastDmgPct + 3))
                val isOppChipShielded = !shieldDropped &&
                    pendingChargedAttackPreOppShields > 0 &&
                    !oppFaintedSlots[defenderOppIdx] &&
                    (hpDelta <= 3 || (hpDelta <= oppShieldChipCap && maxUserCandExpectedDmgPct >= 35))
                val shielded = shieldDropped || isOppChipShielded || oppBlockedByBanner
                if (!shielded && defenderOppIdx in 0..2) {
                    // v6.05: Persist post-charge unshielded HP directly into oppSlotHpPct so slot state never stays stuck at pre-charge HP!
                    oppSlotHpPct[defenderOppIdx] = postHp
                    confirmedOppSlotHpPct[defenderOppIdx] = postHp
                    lastScannedOppSlotHpPct[defenderOppIdx] = postHp
                    predictedOppSlotHpPct[defenderOppIdx] = postHp
                    if (postHp in 1 until oppSlotLowestHpPct[defenderOppIdx]) {
                        oppSlotLowestHpPct[defenderOppIdx] = postHp
                    }
                    if (postHp > 0) {
                        oppSlotPreFaintHpPct[defenderOppIdx] = postHp
                    }
                }
                var didAutoDecrOppShield = false
                if (((isOppChipShielded && hpDelta in 4..oppShieldChipCap) || (oppBlockedByBanner && !shieldDropped)) && !oppDisguiseBusted && oppShieldsRemaining > 0) {
                    val nextShields = (oppShieldsRemaining - 1).coerceIn(0, 2)
                    val shieldNum = (2 - nextShields).coerceIn(1, 2)
                    val formattedDef = formatOpponentNameWithShadow(defenderOppRawName)
                    battleTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "SHIELD",
                            actor = "opp",
                            t = eventT,
                            shieldNumber = shieldNum,
                            activePokemon = formattedDef,
                            pokemonShielded = formattedDef,
                            userShieldsRemaining = playerShieldsRemaining,
                            oppShieldsRemaining = nextShields
                        )
                    )
                    oppShieldsRemaining = nextShields
                    lastOppShieldDecrementChargeStartMs = pendingChargedAttackStartMs
                    didAutoDecrOppShield = true
                }

                // 1. Mid-screen Banner OCR ("<PlayerPokemon> used <Move>!") — validated against attacker user species moveset
                val rawBannerUserMove = if (lastDetectedBannerMoveActor == "user" &&
                    (nowMs - lastDetectedBannerMoveTimeMs) <= 7500L &&
                    lastDetectedBannerMoveName.isNotBlank()
                ) {
                    lastDetectedBannerMoveName
                } else null
                val bannerUserMove = rawBannerUserMove?.takeIf { bMove ->
                    attackerMoveNames.any { it.equals(bMove, ignoreCase = true) }
                }

                // 2. Post-Throw Left (Move 1) & Right (Move 2) Charge Circle Residual Energy Disambiguation:
                val effectivePreEnergy = max(
                    preChargeUserEnergy,
                    when {
                        bannerUserMove != null -> attackerMoveEnergyMap[bannerUserMove] ?: attackerCheapestUserEnergy
                        attackerHasSecondMove && preChargeRightFillPct >= 95 -> attackerMove2Cost
                        preChargeLeftFillPct >= 95 -> attackerMove1Cost
                        else -> attackerCheapestUserEnergy
                    }
                ).coerceIn(attackerCheapestUserEnergy, 100)

                val postCircleEnergyRaw = computeAuthoritativeCircleEnergy(
                    leftFillPct = sampledLeftChargeBtnFillPct,
                    rightFillPct = sampledRightChargeBtnFillPct,
                    cost1 = attackerMove1Cost,
                    cost2 = attackerMove2Cost,
                    hasSecondMove = attackerHasSecondMove,
                    leftInThirdFill = (effectivePreEnergy - attackerCheapestUserEnergy) >= 2 * attackerMove1Cost,
                    rightInThirdFill = (effectivePreEnergy - attackerCheapestUserEnergy) >= 2 * attackerMove2Cost,
                    move1Name = attackerMove1Name,
                    move2Name = attackerMove2Name,
                    fallbackSpeciesType = attackerUserMeta.types.firstOrNull() ?: "normal"
                )
                val postCircleEnergySnapped = if (postCircleEnergyRaw >= 0) {
                    (((postCircleEnergyRaw.toDouble() / attackerUserFastEnergy.toDouble()).roundToInt()) * attackerUserFastEnergy).coerceIn(0, 100)
                } else -1

                val postCircleInferredMove: String? = if (attackerHasSecondMove &&
                    attackerMove1Cost != attackerMove2Cost &&
                    (sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300)
                ) {
                    val remIfMove1 = (effectivePreEnergy - attackerMove1Cost).coerceIn(0, 100)
                    val remIfMove2 = (effectivePreEnergy - attackerMove2Cost).coerceIn(0, 100)
                    val dualFit1 = scorePostThrowCircleFit(
                        sampledLeftChargeBtnFillPct,
                        sampledRightChargeBtnFillPct,
                        attackerMove1Cost,
                        attackerMove2Cost,
                        attackerHasSecondMove,
                        remIfMove1
                    )
                    val dualFit2 = scorePostThrowCircleFit(
                        sampledLeftChargeBtnFillPct,
                        sampledRightChargeBtnFillPct,
                        attackerMove1Cost,
                        attackerMove2Cost,
                        attackerHasSecondMove,
                        remIfMove2
                    )
                    val snapErr1 = if (postCircleEnergySnapped in 0..95) kotlin.math.abs(postCircleEnergySnapped - remIfMove1).toDouble() else dualFit1
                    val snapErr2 = if (postCircleEnergySnapped in 0..95) kotlin.math.abs(postCircleEnergySnapped - remIfMove2).toDouble() else dualFit2
                    val combErr1 = dualFit1 * 0.60 + snapErr1 * 0.40
                    val combErr2 = dualFit2 * 0.60 + snapErr2 * 0.40
                    when {
                        combErr2 + 2.5 < combErr1 && effectivePreEnergy >= attackerMove2Cost -> attackerMove2Name
                        combErr1 + 2.5 < combErr2 && effectivePreEnergy >= attackerMove1Cost -> attackerMove1Name
                        else -> null
                    }
                } else null

                // 3. Pre-Throw Single-Circle Readiness Disambiguation (Left = Move 1, Right = Move 2)
                val preCircleInferredMove: String? = if (attackerHasSecondMove && attackerMove1Cost != attackerMove2Cost) {
                    when {
                        preChargeRightFillPct >= 95 && preChargeLeftFillPct < 92 -> attackerMove2Name
                        preChargeLeftFillPct >= 95 && preChargeRightFillPct < 92 -> attackerMove1Name
                        effectivePreEnergy >= attackerMove1Cost && effectivePreEnergy < attackerMove2Cost -> attackerMove1Name
                        effectivePreEnergy >= attackerMove2Cost && effectivePreEnergy < attackerMove1Cost -> attackerMove2Name
                        else -> null
                    }
                } else attackerMove1Name

                // 4. Unshielded Opponent HP Drop Disambiguation
                val hpInferredUserMove = if (!shielded && hpDelta >= 4) {
                    inferUnshieldedChargedMoveName(hpDelta, candPairs) ?: inferBestGuessChargedMoveByHp(hpDelta, candPairs)
                } else null

                val resolvedUserMove = bannerUserMove
                    ?: postCircleInferredMove
                    ?: preCircleInferredMove
                    ?: hpInferredUserMove
                    ?: attackerMove1Name

                val totalUserEnergy = when {
                    resolvedUserMove.equals(attackerMove2Name, ignoreCase = true) -> attackerMove2Cost
                    resolvedUserMove.equals(attackerMove1Name, ignoreCase = true) -> attackerMove1Cost
                    else -> attackerMoveEnergyMap[resolvedUserMove] ?: attackerCheapestUserEnergy
                }

                // v6.02: Credit 1 In-Flight Fast Move on 2nd-Move Tap Lag!
                // When the player taps a higher-cost charged move (e.g. 55E Flame Charge vs 50E Foul Play) on the exact turn
                // their last fast move completes (`totalUserEnergy - preChargeUserEnergy in 1..attackerUserFastEnergy`),
                // credit that 1 in-flight fast move to `preChargeUserEnergy` so no false ENERGY_DEFICIT_THROW is logged!
                if ((totalUserEnergy - preChargeUserEnergy) in 1..attackerUserFastEnergy) {
                    preChargeUserEnergy = (preChargeUserEnergy + attackerUserFastEnergy).coerceIn(totalUserEnergy, 100)
                }
                val finalEffectivePreEnergy = max(effectivePreEnergy, preChargeUserEnergy).coerceIn(totalUserEnergy, 100)

                // v3.83/v3.95/v4.00: Preserve exact leftover charged move energy delta (`finalEffectivePreEnergy - totalUserEnergy`),
                // update the slot's post-throw discharge anchor (`playerSlotEnergyAnchor`), and resync fill round to post-throw bars!
                val computedResidualEnergy = (finalEffectivePreEnergy - totalUserEnergy).coerceIn(0, 100)
                playerSlotEnergy[attackerUserIdx] = computedResidualEnergy
                playerSlotEnergyAnchor[attackerUserIdx] = computedResidualEnergy
                nearCeilingStepStartMs[attackerUserIdx] = 0L
                playerSlotCeilingLatched100[attackerUserIdx] = false
                lastUserChargePreEnergySnapshot = finalEffectivePreEnergy
                lastUserChargeDeductedEnergySnapshot = totalUserEnergy
                lastUserChargeResolvedMoveName = resolvedUserMove
                lastUserChargeWasBannerOcr = (bannerUserMove != null)
                awaitingPostUserChargeCircleSync = true

                if (lastDetectedBannerMoveActor == "user") {
                    lastDetectedBannerMoveActor = ""
                    lastDetectedBannerMoveName = ""
                    lastDetectedBannerMoveUserSlotIdx = -1
                }

                // Re-index turn offset and reset fast-move phase to Turn 0 after user charged move
                scanTurnOffsetMs = ((nowMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
                turnPhaseAnchorMs = captureAnchorMs
                lastTurnTickTimeMs = System.currentTimeMillis()
                turnResidualMs = 0L
                phaseStartPlayerEnergy = computedResidualEnergy
                confirmedPhasePlayerTurns = 0
                lastConfirmedPlayerFastMoveMs = 0L
                phasePlayerTurns = 0
                phaseOppTurns = 0
                playerSlotCurrentMoveTurns[attackerUserIdx] = 0
                oppSlotCurrentMoveTurns[activeOppIdx] = 0
                playerLastFastCreditedAtMs[attackerUserIdx] = 0L
                playerAutoIncrementAnchorMs[attackerUserIdx] = 0L
                playerLastSelfCorrectionAtMs[attackerUserIdx] = 0L
                pllValidatedThisShieldDelay = false
                oppLastFastCreditedAtMs[activeOppIdx] = 0L
                oppCreditedByOptimalTimerAtMs[activeOppIdx] = 0L
                isPlayerInIdleFallback = false
                lastIdleFallbackOppCreditMs = 0L
                lastStableNormalCombatEnergy = playerSlotEnergy[attackerUserIdx]
                prevStableNormalCombatEnergy = playerSlotEnergy[attackerUserIdx]
                lastScannedLeftChargeFillPct[attackerUserIdx] = if (sampledLeftChargeBtnFillPct in 0..300) sampledLeftChargeBtnFillPct else 0
                lastScannedRightChargeFillPct[attackerUserIdx] = if (sampledRightChargeBtnFillPct in 0..300) sampledRightChargeBtnFillPct else 0
                lastStableLeftChargeFillPct = lastScannedLeftChargeFillPct[attackerUserIdx]
                lastStableRightChargeFillPct = lastScannedRightChargeFillPct[attackerUserIdx]
                prevStableLeftChargeFillPct = lastStableLeftChargeFillPct
                prevStableRightChargeFillPct = lastStableRightChargeFillPct
                pendingConfirmLeftChargeFillPct[attackerUserIdx] = lastScannedLeftChargeFillPct[attackerUserIdx]
                pendingConfirmRightChargeFillPct[attackerUserIdx] = lastScannedRightChargeFillPct[attackerUserIdx]
                leftChargeFillConfirmFrames[attackerUserIdx] = 0
                rightChargeFillConfirmFrames[attackerUserIdx] = 0
                leftChargeFillDebounceStartMs[attackerUserIdx] = 0L
                rightChargeFillDebounceStartMs[attackerUserIdx] = 0L
                // Re-anchor energy tracking & fill round latches to the leftover post-throw energy (`computedResidualEnergy`)
                resetSlotEnergyTracking(
                    slotIdx = attackerUserIdx,
                    initialEnergy = computedResidualEnergy,
                    cost1 = attackerMove1Cost,
                    cost2 = attackerMove2Cost,
                    clearThirdFillLatches = computedResidualEnergy < 2 * attackerCheapestUserEnergy
                )
                lastScannedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
                lastScannedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
                predictedPlayerSlotHpPct[activeUserIdx] = playerSlotHpPct[activeUserIdx]
                predictedOppSlotHpPct[activeOppIdx] = oppSlotHpPct[activeOppIdx]
                postUserChargedMissingOppHpFrames = 0
                pendingChargedAttackWasOppCatch = false
                needsPostSwapOrMoveTurnReindex = true

                val formattedDefenderOppName = formatOpponentNameWithShadow(defenderOppRawName)
                val userRawPreEnergy = preChargeUserEnergy.coerceIn(0, 100)
                val userEnergyDeficit = max(0, totalUserEnergy - userRawPreEnergy)
                val userExpectedDmgPct = candPairs.find { it.first.equals(resolvedUserMove, ignoreCase = true) }?.second
                val userMoveSource = when {
                    bannerUserMove != null -> "BANNER_OCR"
                    postCircleInferredMove != null -> "POST_CIRCLE_FIT"
                    preCircleInferredMove != null -> "PRE_CIRCLE_READY"
                    hpInferredUserMove != null -> "HP_DELTA"
                    else -> "DEFAULT_FALLBACK"
                }
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "CHARGED_ATTACK",
                        actor = "user",
                        t = eventT,
                        activePokemon = attackerUserMonName,
                        pokemonShielded = if (shielded) formattedDefenderOppName else null,
                        shielded = shielded,
                        hpBeforePct = hpBefore,
                        hpAfterPct = if (shielded) max(1, hpBefore - 1) else postHp,
                        hpDeltaPct = if (shielded) 1 else hpDelta,
                        inferredMoveName = resolvedUserMove,
                        userSlotHpPct = playerSlotHpPct.toList(),
                        oppSlotHpPct = oppSlotHpPct.toList(),
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining,
                        recommendedAction = lastRecommendedAction.ifEmpty { null },
                        recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                        decisionPhase = "CHARGED_MOVE",
                        playerSwapRemainingSec = playerRemSec,
                        oppSwapRemainingSec = oppRemSec,
                        userEnergy = playerSlotEnergy[activeUserIdx],
                        oppEnergy = oppSlotEnergy[defenderOppIdx],
                        turnIndex = battleTurnIndex,
                        scanTurnOffsetMs = scanTurnOffsetMs,
                        preThrowEnergy = userRawPreEnergy,
                        requiredMoveEnergy = totalUserEnergy,
                        energyDeficit = userEnergyDeficit,
                        expectedMoveDmgPct = userExpectedDmgPct,
                        leftCircleFillBeforePct = preChargeLeftFillPct.takeIf { it >= 0 },
                        rightCircleFillBeforePct = preChargeRightFillPct.takeIf { it >= 0 },
                        leftCircleFillAfterPct = sampledLeftChargeBtnFillPct.takeIf { it >= 0 },
                        rightCircleFillAfterPct = sampledRightChargeBtnFillPct.takeIf { it >= 0 },
                        moveResolutionSource = userMoveSource,
                        hudThumbnailWebpBase64 = pendingChargedAttackHudThumbB64
                    )
                )
                pendingChargedAttackHudThumbB64 = null
                lastChargedAttackLoggedMs = nowMs
                lastChargedAttackLoggedActor = "user"
                lastUserChargedAttackLoggedMs = nowMs
                lastUserChargedPreOppHp = hpBefore
                lastUserChargedDefenderOppSlotIdx = defenderOppIdx
                lastUserChargedWasProvisionalShield = isOppChipShielded && !shieldDropped
                lastUserChargedAutoDecrementedShield = didAutoDecrOppShield
                postChargeCirclesReturnedAtMs = 0L
                pendingChargedAttackActor = ""
                pendingUserChargeConfirmedByOcr = false
                pendingChargedAttackDeductedEnergy = 0
                pendingChargedAttackOppSlotIdx = -1
                pendingChargedAttackUserSlotIdx = -1
                pendingChargedAttackOppRawName = ""
                pendingChargedAttackWasOppCatch = false
                hadShieldPromptBeforeCurrentCharge = false
                hpChanged = true
                val userMoveLabel = resolvedUserMove.ifBlank { "Charged Attack" }
                val catchSuffix = if (isOppCatchDuringThrow) " [Caught by ${defenderOppMeta.name}]" else ""
                val userOutcomeLabel = if (shielded) "Shielded (-${totalUserEnergy}E)" else "-${hpDelta}% HP (-${totalUserEnergy}E)"
                showBattleToast("⚡ Used $userMoveLabel ($userOutcomeLabel)$catchSuffix")
            }
        }

        // 5. v3.80: Advance 0.5s battle turn counter ONLY after hasBattleStarted is confirmed by the 1st attack!
        if (hasBattleStarted &&
            isNormalFastCombatFrame &&
            !playerFaintedSlots[activeUserIdx] &&
            !oppFaintedSlots[activeOppIdx] &&
            pendingChargedAttackActor.isEmpty() &&
            !isAttackIncomingPromptActive &&
            !isPostFaintSwitchPromptActive
        ) {
            val tickNowMs = System.currentTimeMillis()
            val turnsDelta = if (lastTurnTickTimeMs <= 0L) {
                lastTurnTickTimeMs = tickNowMs
                turnResidualMs = 0L
                1
            } else {
                val rawElapsedMs = (tickNowMs - lastTurnTickTimeMs).coerceIn(0L, 2000L) + turnResidualMs
                lastTurnTickTimeMs = tickNowMs
                val wholeTurns = (rawElapsedMs / 500L).toInt()
                turnResidualMs = rawElapsedMs % 500L
                wholeTurns.coerceIn(0, 3)
            }
            if (turnsDelta > 0) {
                battleTurnIndex += turnsDelta
            }
            if (observedPlayerChargeBarStep || needsPostSwapOrMoveTurnReindex) {
                scanTurnOffsetMs = ((nowMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
                if (observedPlayerChargeBarStep) {
                    needsPostSwapOrMoveTurnReindex = false
                }
            }
        }

        if (currentBattleSensorTicks.isNotEmpty() && currentBattleSensorTicks.last().tMs == nowMs) {
            val lastIdx = currentBattleSensorTicks.lastIndex
            val prevTick = currentBattleSensorTicks[lastIdx]
            val finalUserE = playerSlotEnergy[activeUserIdx].coerceIn(0, 100)
            val finalOppE = oppSlotEnergy[activeOppIdx].coerceIn(0, 100)
            val resolvedEnergySrc = when {
                lastEnergyMutationSource != "NONE" -> lastEnergyMutationSource
                finalUserE < prevTick.userEnergy || finalOppE < prevTick.oppEnergy -> "POST_THROW_DEDUCT"
                observedPlayerChargeBarStep -> "CIRCLE_FILL_SYNC"
                finalUserE > prevTick.userEnergy || finalOppE > prevTick.oppEnergy -> "FAST_CADENCE"
                else -> "NONE"
            }
            currentBattleSensorTicks[lastIdx] = prevTick.copy(
                committedPlayerHpPct = playerSlotHpPct[activeUserIdx].coerceIn(0, 100),
                committedOppHpPct = oppSlotHpPct[activeOppIdx].coerceIn(0, 100),
                playerHpRowY = sampledPlayerHpRowY,
                oppHpRowY = sampledOppHpRowY,
                userEnergy = finalUserE,
                oppEnergy = finalOppE,
                energyMutationSource = resolvedEnergySrc
            )
        }

        if (hpChanged) {
            recalculateAndPushBattleData()
        }
    }

    internal val OCR_MENU_IGNORED_WORDS = setOf(
        "party", "parties", "battle", "battles", "league", "schedule",
        "rank", "rating", "rewards", "reward", "train", "training",
        "season", "current", "great", "ultra", "master", "premier",
        "switch", "shield", "shields", "super", "effective", "not", "very",
        "attack", "defense", "charged", "fast", "weather", "boost"
    )

    /**
     * Returns true if a token or word is a GBL menu label ("party", "battle", etc.) or a 1-character
     * OCR confusable of "party" (which otherwise has edit distance 2 to "paras") or "battle".
     */
    internal fun isIgnoredMenuToken(rawToken: String): Boolean {
        val cleanLower = rawToken.lowercase().replace(Regex("[^a-z]"), "")
        if (cleanLower.isEmpty()) return true
        if (cleanLower in OCR_MENU_IGNORED_WORDS) return true
        val normVariants = listOf(
            normalizeOcrToken(rawToken, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(rawToken, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(rawToken, oneAsL = false, rnAsM = true, vAsY = true)
        ).filter { it.isNotEmpty() }.distinct()
        for (norm in normVariants) {
            if (norm in OCR_MENU_IGNORED_WORDS) return true
            // Block "party" and any 1-char OCR typo of "party" (e.g. "partv", "parly") so it can NEVER match Paras (dist 2 from party)
            if (norm.length in 4..6 && levenshteinDistance(norm, "party") <= 1) return true
            // Block "battle" and any 1-char OCR typo of "battle" (e.g. "batt1e", "battie") so it can NEVER match user team Pokémon
            if (norm.length in 5..7 && levenshteinDistance(norm, "battle") <= 1) return true
        }
        return false
    }

    /**
     * Detects when the user is on the Pokémon GO Battle Menu screen (upper-left "BATTLE" + upper-right "PARTY",
     * or GBL lobby headers without any active combat CP indicators) and pauses OCR matching on that frame.
     */
    internal fun isBattleMenuScreen(
        oppLines: List<Text.Line>,
        playerTopLines: List<Text.Line>,
        playerMoveLines: List<Text.Line>
    ): Boolean {
        // Never treat the screen as a GBL menu if live floating HP bars are visible on the battlefield
        if (sampledPlayerHpPct in 1..100 || sampledOppHpPct in 1..100) return false

        val oppTextLower = oppLines.joinToString(" ") { it.text.lowercase() }
        val playerTopLower = playerTopLines.joinToString(" ") { it.text.lowercase() }
        val bottomLower = playerMoveLines.joinToString(" ") { it.text.lowercase() }
        val combinedTopLower = "$playerTopLower $oppTextLower"

        val hasCpInTop = Regex("(?i)\\bcp\\s*\\d{2,4}\\b").containsMatchIn(combinedTopLower)

        val hasPartyInOpp = oppLines.any { line ->
            val rawLower = line.text.lowercase()
            if (isOverlayHudSelfText(rawLower)) return@any false
            line.text.trim().split(Regex("\\s+")).any { tok ->
                val n = normalizeOcrToken(tok, vAsY = true)
                n == "party" || n == "parties" || (n.length in 4..6 && levenshteinDistance(n, "party") <= 1)
            }
        }
        val hasBattleInPlayerTop = playerTopLines.any { line ->
            val rawLower = line.text.lowercase()
            if (isOverlayHudSelfText(rawLower)) return@any false
            line.text.trim().split(Regex("\\s+")).any { tok ->
                val n = normalizeOcrToken(tok, oneAsL = true)
                n == "battle" || n == "battles" || (n.length in 5..7 && levenshteinDistance(n, "battle") <= 1)
            }
        }

        // Classic GBL Battle Menu header: "BATTLE" in upper-left and "PARTY" in upper-right
        if (hasPartyInOpp && hasBattleInPlayerTop) return true

        // Even if one side of the header was occluded by the floating HUD, if "PARTY" is in upper-right without any CP in top bars
        if (hasPartyInOpp && !hasCpInTop) return true
        if (hasBattleInPlayerTop && !hasCpInTop) return true

        // GBL Lobby / Menu text indicators
        if (!hasCpInTop && (
                combinedTopLower.contains("go battle league") ||
                combinedTopLower.contains("current season") ||
                bottomLower.contains("battle till you win") ||
                bottomLower.contains("view schedule")
            )
        ) {
            return true
        }
        return false
    }

    internal fun isOverlayHudSelfText(lower: String): Boolean {
        return lower.contains("waiting") ||
                lower.contains("scanning") ||
                lower.contains("zero-sneak") ||
                lower.contains("awaiting") ||
                lower.contains("shadow:") ||
                lower.contains("form:") ||
                lower.contains("reset opp") ||
                lower.contains("start battle") ||
                lower.contains("stop battle") ||
                lower.contains("🛑") ||
                lower.contains("new battle") ||
                lower.contains("opponent attacks") ||
                lower.contains("my attacks") ||
                lower.contains("cmp:") ||
                lower.contains("cmp win") ||
                lower.contains("cmp loss") ||
                lower.contains("lead:") ||
                lower.contains("my:") ||
                lower.contains("opp:") ||
                lower.contains("opp swap") ||
                lower.contains("shield call") ||
                lower.contains("tank it") ||
                lower.contains("hp left") ||
                lower.contains("would ko") ||
                lower.contains("safe to tank") ||
                lower.contains("danger / bait") ||
                lower.contains("funded") ||
                lower.contains("dmg") ||
                lower.contains("throw on") ||
                lower.contains("1 hz") ||
                lower.contains("bench:") ||
                lower.contains("opt 1") ||
                lower.contains("opt 2") ||
                lower.contains("⚔") ||
                lower.contains("→") ||
                Regex("^vs\\s+").containsMatchIn(lower.trim()) ||
                Regex("\\b(?:1st|2nd|3rd)\\b").containsMatchIn(lower) ||
                Regex("\\d+t/\\d+e/").containsMatchIn(lower) ||
                Regex("\\d+e/\\d+f\\b").containsMatchIn(lower) ||
                Regex("\\(\\d+t\\b").containsMatchIn(lower)
    }

    /**
     * Strictly maintains fixed opponent discovery order: [1st seen, 2nd seen, 3rd seen].
     * Never reorders slots when an already-seen opponent switches back in!
     */
    internal fun upsertDetectedOpponentBySpecies(fullName: String, baseSpecies: String) {
        val existingIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(baseSpecies, ignoreCase = true)
        }
        if (existingIdx >= 0) {
            detectedOpponents[existingIdx] = fullName
            return
        }
        if (detectedOpponents.size < 3) {
            detectedOpponents.add(fullName)
        } else {
            val activeIdx = detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOpponentSpecies, ignoreCase = true)
            }.takeIf { it in 0..2 } ?: 2
            detectedOpponents[activeIdx] = fullName
        }
    }

    internal fun handleOpponentLines(oppLines: List<Text.Line>) {
        if (oppLines.isEmpty()) return
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"

        // Sort top-to-bottom so the opponent Pokémon name line (above CP) is evaluated first
        val sortedLines = oppLines.sortedBy { it.boundingBox?.top ?: 0 }
        val matchedCandidates = mutableListOf<Triple<PokemonMeta, String, Boolean>>()

        for (line in sortedLines) {
            val text = line.text.trim()
            if (text.length < 3) continue

            val lower = text.lowercase()
            if (isOverlayHudSelfText(lower)) continue

            val candidate = findPokemonInText(text)
            if (candidate != null) {
                val base = candidate.baseSpecies.lowercase()
                val manualFormName = manualFormOverrides[base]
                val (bestVar, defaultShadow) = FormResolver.resolveBestDefaultFormAndShadow(candidate, text, activeLeague)
                val isLineShadow = manualShadowOverrides[base] ?: (text.contains("shadow", ignoreCase = true) || defaultShadow)
                val resolved = if (manualFormName != null) {
                    getPokemonMeta(manualFormName, activeLeague, isLineShadow)
                } else {
                    OverlayService.applyRankingMovesForLeague(OverlayService.applyRecommendedMoves(bestVar), activeLeague, isLineShadow)
                }
                matchedCandidates.add(Triple(resolved, text, isLineShadow))
            }
        }

        // Prefer any detected candidate that is a DIFFERENT species from the current activeOpponentSpecies
        val chosenTriple = matchedCandidates.firstOrNull {
            !it.first.baseSpecies.equals(activeOpponentSpecies, ignoreCase = true)
        } ?: matchedCandidates.firstOrNull()

        // Dynamic fallback if CP line is visible in top-right nameplate and a clean name line is above it
        val finalTriple: Triple<PokemonMeta, String, Boolean>? = chosenTriple ?: run {
            val hasCpIndicator = sortedLines.any {
                Regex("(?i)\\bcp\\s*\\d{3,4}\\b").containsMatchIn(it.text) ||
                        Regex("^\\d{3,4}$").containsMatchIn(it.text.trim())
            }
            if (!hasCpIndicator) return@run null

            for (line in sortedLines) {
                val raw = line.text.trim()
                if (isOverlayHudSelfText(raw.lowercase())) continue
                val cleanWord = raw
                    .replace(Regex("(?i)\\bcp\\s*\\d*"), "")
                    .replace(Regex("[^a-zA-Z\\s-]"), "")
                    .trim()
                if (cleanWord.length in 3..14 &&
                    !isIgnoredMenuToken(cleanWord) &&
                    !cleanWord.contains("super", ignoreCase = true) &&
                    !cleanWord.contains("effective", ignoreCase = true) &&
                    !cleanWord.contains("attack", ignoreCase = true) &&
                    !cleanWord.contains("defense", ignoreCase = true) &&
                    !cleanWord.contains("shield", ignoreCase = true) &&
                    !cleanWord.contains("party", ignoreCase = true) &&
                    !cleanWord.contains("battle", ignoreCase = true)
                ) {
                    val dynamicName = cleanWord.lowercase().replaceFirstChar { it.uppercase() }
                    val dynMeta = getPokemonMeta(dynamicName)
                    val (_, dynDefShadow) = FormResolver.resolveBestDefaultFormAndShadow(dynMeta, raw, activeLeague)
                    return@run Triple(dynMeta, raw, dynDefShadow)
                }
            }
            null
        }

        if (finalTriple != null) {
            val (matched, rawMatchedLine, defaultResolvedShadow) = finalTriple
            val newBaseSpecies = matched.baseSpecies.lowercase()

            val anyLineHasShadow = rawMatchedLine.contains("shadow", ignoreCase = true) ||
                sortedLines.any { it.text.contains("shadow", ignoreCase = true) }

            if (System.currentTimeMillis() - lastBattleResetTimeMs < 600L) return
            val speciesChanged = isWaitingForOpponent || !newBaseSpecies.equals(activeOpponentSpecies, ignoreCase = true)

            // v3.34: 2nd-Frame Validity Check — If Frame 1 was an unlatched provisional swap and Frame 2 immediately
            // re-detects the OLD opponent species (meaning Frame 1 was a 1-frame OCR glitch), revert the swap & clock!
            if (!oppSwitchValidityLatched &&
                speciesChanged &&
                provisionalOppPrevSpecies.isNotEmpty() &&
                newBaseSpecies.equals(provisionalOppPrevSpecies, ignoreCase = true) &&
                (currentFrameTimestampMs - lastOppSwitchFrameMs) <= 2600L
            ) {
                if (provisionalOppPrevWasAddedToDetected && detectedOpponents.isNotEmpty()) {
                    val badBase = activeOpponentSpecies
                    detectedOpponents.removeAll { FormResolver.extractBaseSpecies(it).equals(badBase, ignoreCase = true) }
                }
                activeOpponentName = provisionalOppPrevName
                activeOpponentSpecies = provisionalOppPrevSpecies
                availableOpponentForms = FormResolver.getVariantsForSpecies(provisionalOppPrevSpecies, activeLeague)
                currentFormIndex = availableOpponentForms.indexOfFirst { it.name == provisionalOppPrevName }.coerceAtLeast(0)
                oppSwapEndTimeMs = oppSwapEndTimeBeforeSwitch
                oppSwitchValidityLatched = true
                provisionalOppPrevName = ""
                provisionalOppPrevSpecies = ""
                provisionalOppPrevWasAddedToDetected = false
                lastConfirmedOppFrameTimeMs = currentFrameTimestampMs
                if (battleTimelineEvents.isNotEmpty() && battleTimelineEvents.last().actor == "opp" && battleTimelineEvents.last().validityLatched == false) {
                    battleTimelineEvents.removeAt(battleTimelineEvents.lastIndex)
                }
                recalculateAndPushBattleData()
                return
            }

            if (speciesChanged) {
                val prevOppRawName = activeOpponentName
                val prevOppRawSpecies = activeOpponentSpecies
                val prevOppFormattedName = if (!isWaitingForOpponent && activeOpponentName != "Waiting...") {
                    formatOpponentNameWithShadow(activeOpponentName)
                } else ""
                val prevOppSlotIdx = if (!isWaitingForOpponent && detectedOpponents.isNotEmpty()) {
                    val base = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
                    detectedOpponents.indexOfFirst { FormResolver.extractBaseSpecies(it).equals(base, ignoreCase = true) }.coerceAtLeast(0)
                } else -1

                val wasWaitingForOpponent = isWaitingForOpponent
                val preDetectedSize = detectedOpponents.size
                isWaitingForOpponent = false
                isBattleActive = true
                lastClearedOpponentsSnapshot = emptyList()
                lastClearedTimelineEventsSnapshot = emptyList()
                lastClearedBattleDurationSec = null
                activeOpponentSpecies = newBaseSpecies
                availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
                currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
                activeOpponentName = matched.name

                isOpponentShadow = when {
                    !FormResolver.isShadowEligibleVariant(matched) -> {
                        manualShadowOverrides[newBaseSpecies] = false
                        false
                    }
                    manualShadowOverrides.containsKey(newBaseSpecies) -> manualShadowOverrides[newBaseSpecies]!!
                    anyLineHasShadow || defaultResolvedShadow -> {
                        manualShadowOverrides[newBaseSpecies] = true
                        true
                    }
                    else -> false
                }

                // 1-per-species deduplication on opponent team (maintaining fixed 1st/2nd/3rd seen order)
                upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)
                val wasAddedNewToDetected = detectedOpponents.size > preDetectedSize
                val newOppFormattedName = formatOpponentNameWithShadow(matched.name)

                val newOppSlotIdx = detectedOpponents.indexOfFirst {
                    FormResolver.extractBaseSpecies(it).equals(newBaseSpecies, ignoreCase = true)
                }
                val scannedOppCp = extractCpFromOcrLines(sortedLines)
                if (newOppSlotIdx in 0..2 && scannedOppCp != null) {
                    oppSlotCp[newOppSlotIdx] = scannedOppCp
                }
                // Resurrection Guard: Any Pokémon entering the field is 100% alive (restore its last known pre-faint HP%)
                if (newOppSlotIdx in 0..2 && oppFaintedSlots[newOppSlotIdx]) {
                    oppFaintedSlots[newOppSlotIdx] = false
                    if (oppSlotHpPct[newOppSlotIdx] <= 0) {
                        oppSlotHpPct[newOppSlotIdx] = oppSlotPreFaintHpPct[newOppSlotIdx].coerceIn(1, 100)
                    }
                    oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
                }

                if (wasWaitingForOpponent) {
                    // v3.80: If the player already registered Move 1 (0 -> 4E) on the static Charge Circle before async ML Kit OCR
                    // finished reading the opponent lead name, preserve `hasBattleStarted`, `phasePlayerTurns`, and `playerSlotEnergy`
                    // and immediately catch up the newly identified opponent's turns/energy!
                    if (!hasBattleStarted) {
                        battleClockAnchorMs = System.currentTimeMillis()
                        phasePlayerTurns = 0
                        phaseOppTurns = 0
                    } else if (phasePlayerTurns > 0) {
                        val leadOppFastTurns = OverlayService.resolveFastTurnsStatic(matched.defaultFastMove, matched.fastTurns).coerceIn(1, 5)
                        val leadOppFastEnergy = OverlayService.resolveFastEnergyStatic(matched.defaultFastMove, leadOppFastTurns).coerceIn(2, 20)
                        val completedLeadOppMoves = phasePlayerTurns / leadOppFastTurns
                        if (completedLeadOppMoves > 0) {
                            oppSlotEnergy[0] = (completedLeadOppMoves * leadOppFastEnergy).coerceIn(0, 100)
                            oppSlotTurnsOnField[0] = completedLeadOppMoves * leadOppFastTurns
                            phaseOppTurns = completedLeadOppMoves * leadOppFastTurns
                        }
                    }
                    battleTimelineEvents.clear()
                    oppPokeballCount = 3
                    oppFaintedSlots.fill(false)
                    oppSlotHpPct.fill(100)
                    playerSlotHpPct.fill(100)
                    confirmedOppSlotHpPct.fill(100)
                    confirmedPlayerSlotHpPct.fill(100)
                    pendingConfirmOppSlotHpPct.fill(100)
                    pendingConfirmPlayerSlotHpPct.fill(100)
                    oppSlotHpConfirmFrames.fill(2)
                    playerSlotHpConfirmFrames.fill(2)
                    oppSlotPreFaintHpPct.fill(100)
                    playerSlotPreFaintHpPct.fill(100)
                    oppSlotPriorHpPct.fill(100)
                    playerSlotPriorHpPct.fill(100)
                    oppSlotLowestHpPct.fill(100)
                    oppSlotLastBigJumpMs.fill(0L)
                    playerSlotLastBigJumpMs.fill(0L)
                    pendingOppLowHpSlot = -1
                    pendingOppLowHpSample = -1
                    pendingPlayerLowHpSlot = -1
                    pendingPlayerLowHpSample = -1
                    pendingChargedAttackOppSlotIdx = -1
                    pendingChargedAttackUserSlotIdx = -1
                    pendingChargedAttackOppRawName = ""
                    pendingChargedAttackOppShadow = false
                    lastOppChargedAttackerSlotIdx = -1
                    lastOppChargedAttackerRawName = ""
                    lastOppChargedAttackerShadow = false
                    pendingChargedAttackPreUserSlotHp.fill(100)
                    pendingChargedAttackPreOppSlotHp.fill(100)
                    pendingChargedAttackPreOppBalls = 3
                    pendingChargedAttackPreUserBalls = 3
                    pendingChargedAttackWasOppCatch = false
                    lastNormalCombatOppSlotIdx = 0
                    lastNormalCombatUserSlotIdx = 0
                    lastNormalCombatOppRawName = matched.name
                    lastNormalCombatOppShadow = isOpponentShadow
                    lastDetectedBannerMoveOppSlotIdx = -1
                    oppSwapEndTimeMs = 0L
                    lastOppSwitchWasFaint = false
                    oppSwitchConfirmedAlive = true
                    oppSwitchValidityLatched = true
                    provisionalOppPrevName = ""
                    provisionalOppPrevSpecies = ""
                    provisionalOppPrevWasAddedToDetected = false
                    lastConfirmedOppFrameTimeMs = currentFrameTimestampMs
                    oppSwitchAliveFrames = 0
                    oppPostSwitchLowBallFrames = 0
                    debouncedOppBalls = 3
                    oppBallCandidate = 3
                    oppBallConfirmFrames = 0
                    lastObservedLowOppBalls = 3
                    lastObservedLowOppBallsTimeMs = 0L
                    recalculateAndPushBattleData()
                    showBattleToast("⚔️ Opponent: ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})")
                } else {
                    // v3.42 / v3.92: Start Swap Clock halfway between last frame with old Pokémon and first frame with new Pokémon.
                    // Never classify a manual low-HP swap as a faint unless the Pokéball count actually dropped, the outgoing slot was
                    // already confirmed fainted (e.g. post-charged-move KO), or the swap clock was locked!
                    val swapStartMs = getMidpointSwapStartTimeMs(lastConfirmedOppFrameTimeMs, currentFrameTimestampMs)
                    val elapsedSec = getElapsedBattleSeconds(swapStartMs)
                    val priorFaintsExcludingPrev = (0..2).count {
                        it != prevOppSlotIdx && it != newOppSlotIdx && oppFaintedSlots[it]
                    }
                    val aliveBeforeSwitch = (3 - priorFaintsExcludingPrev).coerceIn(2, 3)
                    val effectiveOppBalls = when {
                        !isAllCombatHudGone && combatHudStableFrames >= 3 && debouncedOppBalls in 1..3 -> debouncedOppBalls
                        sampledOppBalls == 3 -> 3
                        (currentFrameTimestampMs - lastObservedLowOppBallsTimeMs) <= 15000L && lastObservedLowOppBalls in 1..2 -> lastObservedLowOppBalls
                        else -> -1
                    }
                    val prevAlreadyMarkedFainted = prevOppSlotIdx in 0..2 && oppFaintedSlots[prevOppSlotIdx]
                    val isFaintReplacement = (effectiveOppBalls in 1..2 &&
                        (effectiveOppBalls < aliveBeforeSwitch || prevAlreadyMarkedFainted)) ||
                        prevAlreadyMarkedFainted ||
                        (!lastOppSwitchWasFaint && (oppSwapEndTimeMs - currentFrameTimestampMs) > 5000L &&
                            (effectiveOppBalls == -1 || effectiveOppBalls < aliveBeforeSwitch))
                    pendingOppLowHpSlot = -1
                    pendingOppLowHpSample = -1

                    // Record pre-switch snapshot for 2nd-frame validity bit revert if Frame 2 disproves Frame 1
                    provisionalOppPrevName = prevOppRawName
                    provisionalOppPrevSpecies = prevOppRawSpecies
                    provisionalOppPrevWasAddedToDetected = wasAddedNewToDetected
                    oppSwitchValidityLatched = false

                    val nowRemPlayerSec = if (playerSwapEndTimeMs > currentFrameTimestampMs) ceil((playerSwapEndTimeMs - currentFrameTimestampMs) / 1000.0).toInt() else 0
                    val userAliveNow = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)

                    if (isFaintReplacement) {
                        val faintedSlotIdx = resolveFaintedOpponentSlotIdx(
                            excludeActiveSlot = newOppSlotIdx,
                            preferredPreKoSlot = prevOppSlotIdx,
                            nowMs = currentFrameTimestampMs
                        )
                        oppSwapEndTimeBeforeSwitch = oppSwapEndTimeMs
                        oppSwapEndTimeMs = 0L
                        oppPreSwitchBallCount = aliveBeforeSwitch
                        lastOppPrevSlotIdx = if (faintedSlotIdx in 0..2) faintedSlotIdx else prevOppSlotIdx
                        lastOppSwitchTimeMs = swapStartMs
                        lastOppSwitchFrameMs = currentFrameTimestampMs
                        lastOppSwitchWasFaint = true
                        oppSwitchConfirmedAlive = true
                        oppSwitchAliveFrames = 0
                        oppPostSwitchLowBallFrames = 2
                        if (faintedSlotIdx in 0..2 && faintedSlotIdx != newOppSlotIdx) {
                            oppFaintedSlots[faintedSlotIdx] = true
                            oppSlotHpPct[faintedSlotIdx] = 0
                            lastScannedOppSlotHpPct[faintedSlotIdx] = 0
                            oppSlotEnergy[faintedSlotIdx] = 0
                        }
                        if (effectiveOppBalls == 2 && faintedSlotIdx in 0..2) {
                            for (idx in 0..2) {
                                if (idx != faintedSlotIdx && oppFaintedSlots[idx]) {
                                    oppFaintedSlots[idx] = false
                                    if (oppSlotHpPct[idx] <= 0) {
                                        oppSlotHpPct[idx] = oppSlotPreFaintHpPct[idx].coerceIn(1, 100)
                                        confirmedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                                        lastScannedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                                    }
                                }
                            }
                        }
                        if (prevOppSlotIdx in 0..2 && prevOppSlotIdx != faintedSlotIdx && effectiveOppBalls != 1) {
                            oppFaintedSlots[prevOppSlotIdx] = false
                            if ((currentFrameTimestampMs - oppSlotLastBigJumpMs[prevOppSlotIdx]) <= 2500L) {
                                oppSlotHpPct[prevOppSlotIdx] = oppSlotPriorHpPct[prevOppSlotIdx].coerceIn(1, 100)
                                oppSlotPreFaintHpPct[prevOppSlotIdx] = oppSlotHpPct[prevOppSlotIdx]
                                lastScannedOppSlotHpPct[prevOppSlotIdx] = oppSlotHpPct[prevOppSlotIdx]
                                oppSlotLastBigJumpMs[prevOppSlotIdx] = 0L
                            }
                        }
                        if (newOppSlotIdx in 0..2) {
                            oppSlotCurrentMoveTurns[newOppSlotIdx] = 0
                            oppLastFastCreditedAtMs[newOppSlotIdx] = 0L
                            oppCreditedByOptimalTimerAtMs[newOppSlotIdx] = 0L
                            lastScannedOppSlotHpPct[newOppSlotIdx] = oppSlotHpPct[newOppSlotIdx].coerceIn(1, 100)
                            predictedOppSlotHpPct[newOppSlotIdx] = oppSlotHpPct[newOppSlotIdx].coerceIn(1, 100)
                            playerLastFastCreditedAtMs.fill(0L)
                            playerAutoIncrementAnchorMs.fill(0L)
                            playerLastSelfCorrectionAtMs.fill(0L)
                        }
                        postUserChargedMissingOppHpFrames = 0
                        rollbackPendingProactiveStep(markAnchorRolledBack = false)
                        proactiveRolledBackAnchorMs = 0L
                        val activeUIdx = currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }?.takeIf { it in 0..2 } ?: 0
                        phaseStartPlayerEnergy = playerSlotEnergy[activeUIdx].coerceIn(0, 100)
                        confirmedPhasePlayerTurns = 0
                        lastConfirmedPlayerFastMoveMs = currentFrameTimestampMs
                        phasePlayerTurns = 0
                        phaseOppTurns = 0
                        lastTurnTickTimeMs = System.currentTimeMillis()
                        turnResidualMs = 0L
                        scanTurnOffsetMs = ((currentFrameTimestampMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
                        needsPostSwapOrMoveTurnReindex = true
                        if (effectiveOppBalls == 1) {
                            for (idx in 0 until min(3, detectedOpponents.size)) {
                                if (idx != newOppSlotIdx) {
                                    oppFaintedSlots[idx] = true
                                    oppSlotHpPct[idx] = 0
                                    lastScannedOppSlotHpPct[idx] = 0
                                    oppSlotEnergy[idx] = 0
                                }
                            }
                        }
                        oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
                        val oppRemSec = 0
                        val resolvedFaintedFormattedName = if (faintedSlotIdx in 0..2 && faintedSlotIdx < detectedOpponents.size) {
                            formatOpponentNameWithShadow(detectedOpponents[faintedSlotIdx])
                        } else prevOppFormattedName
                        battleTimelineEvents.add(
                            BattleTimelineEvent(
                                type = "FAINT",
                                actor = "opp",
                                t = elapsedSec,
                                pokemonFainted = resolvedFaintedFormattedName.ifEmpty { null },
                                pokemonIn = newOppFormattedName,
                                pokemonOut = resolvedFaintedFormattedName.ifEmpty { null },
                                userShieldsRemaining = playerShieldsRemaining,
                                oppShieldsRemaining = oppShieldsRemaining,
                                recommendedAction = lastRecommendedAction.ifEmpty { null },
                                recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                                decisionPhase = "OPP_FAINT_ENTRY",
                                playerSwapRemainingSec = nowRemPlayerSec,
                                oppSwapRemainingSec = oppRemSec,
                                userAliveCount = userAliveNow,
                                oppAliveCount = oppPokeballCount,
                                lastPlayerSwitchWasFaint = lastPlayerSwitchWasFaint,
                                lastOppSwitchWasFaint = true,
                                candidateScores = lastRecommendedCandidateScores.takeIf { it.isNotEmpty() },
                                validityLatched = false
                            )
                        )
                        syncRecentUnshieldedChargedAttackOnFaint("opp", elapsedSec)
                        lastDetectedBannerMoveName = ""
                        lastDetectedBannerMoveActor = ""
                        lastDetectedBannerMoveOppSlotIdx = -1
                        lastDetectedBannerMoveTimeMs = 0L
                        lastConfirmedOppFrameTimeMs = currentFrameTimestampMs
                        isOppTurnOne = false
                        recalculateAndPushBattleData()
                        val faintedLabel = resolvedFaintedFormattedName.ifEmpty { "Opponent" }
                        showBattleToast("💀 Opp Faint Swap: $faintedLabel → ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})")
                    } else {
                        // True Manual Swap (Frame 1 Provisional with Midpoint Swap Clock; latches on Frame 2 or reverts to Faint if ball drops)
                        oppSwapEndTimeBeforeSwitch = oppSwapEndTimeMs
                        oppPreSwitchBallCount = aliveBeforeSwitch
                        lastOppPrevSlotIdx = prevOppSlotIdx
                        lastOppSwitchTimeMs = swapStartMs
                        lastOppSwitchFrameMs = currentFrameTimestampMs
                        lastOppSwitchWasFaint = false
                        oppSwitchConfirmedAlive = false
                        oppSwitchAliveFrames = 0
                        oppPostSwitchLowBallFrames = 0
                        if (prevOppSlotIdx in 0..2) {
                            oppFaintedSlots[prevOppSlotIdx] = false
                            if (prevOppSlotIdx != newOppSlotIdx && (currentFrameTimestampMs - oppSlotLastBigJumpMs[prevOppSlotIdx]) <= 2500L) {
                                oppSlotHpPct[prevOppSlotIdx] = oppSlotPriorHpPct[prevOppSlotIdx].coerceIn(1, 100)
                                oppSlotPreFaintHpPct[prevOppSlotIdx] = oppSlotHpPct[prevOppSlotIdx]
                                lastScannedOppSlotHpPct[prevOppSlotIdx] = oppSlotHpPct[prevOppSlotIdx]
                                oppSlotLowestHpPct[prevOppSlotIdx] = min(oppSlotLowestHpPct[prevOppSlotIdx], oppSlotHpPct[prevOppSlotIdx])
                                oppSlotLastBigJumpMs[prevOppSlotIdx] = 0L
                            }
                        }
                        if (newOppSlotIdx in 0..2 && sampledOppHpPct in 1..100) {
                            pendingConfirmOppSlotHpPct[newOppSlotIdx] = sampledOppHpPct
                            oppSlotHpConfirmFrames[newOppSlotIdx] = 1
                        }
                        if (newOppSlotIdx in 0..2) {
                            oppSlotCurrentMoveTurns[newOppSlotIdx] = 0
                            oppLastFastCreditedAtMs[newOppSlotIdx] = 0L
                            oppCreditedByOptimalTimerAtMs[newOppSlotIdx] = 0L
                            lastScannedOppSlotHpPct[newOppSlotIdx] = oppSlotHpPct[newOppSlotIdx].coerceIn(1, 100)
                            predictedOppSlotHpPct[newOppSlotIdx] = oppSlotHpPct[newOppSlotIdx].coerceIn(1, 100)
                            playerLastFastCreditedAtMs.fill(0L)
                            playerAutoIncrementAnchorMs.fill(0L)
                            playerLastSelfCorrectionAtMs.fill(0L)
                        }
                        postUserChargedMissingOppHpFrames = 0
                        rollbackPendingProactiveStep(markAnchorRolledBack = false)
                        proactiveRolledBackAnchorMs = 0L
                        val activeUIdx = currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }?.takeIf { it in 0..2 } ?: 0
                        phaseStartPlayerEnergy = playerSlotEnergy[activeUIdx].coerceIn(0, 100)
                        confirmedPhasePlayerTurns = 0
                        lastConfirmedPlayerFastMoveMs = currentFrameTimestampMs
                        phasePlayerTurns = 0
                        phaseOppTurns = 0
                        lastTurnTickTimeMs = System.currentTimeMillis()
                        turnResidualMs = 0L
                        scanTurnOffsetMs = ((currentFrameTimestampMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
                        needsPostSwapOrMoveTurnReindex = true
                        oppSwapEndTimeMs = swapStartMs + 50000L
                        val oppRemSec = ceil((oppSwapEndTimeMs - currentFrameTimestampMs).coerceAtLeast(0L) / 1000.0).toInt()
                        battleTimelineEvents.add(
                            BattleTimelineEvent(
                                type = "SWAP",
                                actor = "opp",
                                t = elapsedSec,
                                pokemonIn = newOppFormattedName,
                                pokemonOut = prevOppFormattedName.ifEmpty { null },
                                userShieldsRemaining = playerShieldsRemaining,
                                oppShieldsRemaining = oppShieldsRemaining,
                                recommendedAction = lastRecommendedAction.ifEmpty { null },
                                recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                                decisionPhase = "OPP_SWAP",
                                playerSwapRemainingSec = nowRemPlayerSec,
                                oppSwapRemainingSec = oppRemSec,
                                userAliveCount = userAliveNow,
                                oppAliveCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3),
                                lastPlayerSwitchWasFaint = lastPlayerSwitchWasFaint,
                                lastOppSwitchWasFaint = false,
                                candidateScores = lastRecommendedCandidateScores.takeIf { it.isNotEmpty() },
                                validityLatched = false
                            )
                        )
                        // v6.02: Conditional Post-Throw Swap-and-Immediate-Throw Rollback for Opponent
                        tryRollbackRecentSwapAndImmediateThrow(
                            actor = "opp",
                            prevSlotIdx = prevOppSlotIdx,
                            newSlotIdx = newOppSlotIdx,
                            newFormattedName = newOppFormattedName,
                            nowMs = currentFrameTimestampMs
                        )
                        lastConfirmedOppFrameTimeMs = currentFrameTimestampMs
                        isOppTurnOne = false
                        recalculateAndPushBattleData()
                        showBattleToast("⚔️ Opponent: ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})")
                    }
                }
            } else {
                // Species Changed = NO: Frame 2+ confirms the active opponent species -> Latch Validity Bit!
                lastConfirmedOppFrameTimeMs = currentFrameTimestampMs
                if (!oppSwitchValidityLatched) {
                    oppSwitchValidityLatched = true
                    provisionalOppPrevName = ""
                    provisionalOppPrevSpecies = ""
                    provisionalOppPrevWasAddedToDetected = false
                    val lastEvIdx = battleTimelineEvents.indexOfLast { it.actor == "opp" && it.validityLatched == false }
                    if (lastEvIdx >= 0) {
                        battleTimelineEvents[lastEvIdx] = battleTimelineEvents[lastEvIdx].copy(validityLatched = true)
                    }
                    recalculateAndPushBattleData()
                }
                if (anyLineHasShadow && !manualShadowOverrides.containsKey(newBaseSpecies) && !isOpponentShadow) {
                    isOpponentShadow = true
                    manualShadowOverrides[newBaseSpecies] = true
                    recalculateAndPushBattleData()
                }
                val curOppIdx = detectedOpponents.indexOfFirst {
                    FormResolver.extractBaseSpecies(it).equals(newBaseSpecies, ignoreCase = true)
                }
                val scannedOppCp = extractCpFromOcrLines(sortedLines)
                if (curOppIdx in 0..2 && scannedOppCp != null && oppSlotCp[curOppIdx] != scannedOppCp) {
                    oppSlotCp[curOppIdx] = scannedOppCp
                    recalculateAndPushBattleData()
                }
            }
        } else if (!oppSwitchValidityLatched && (currentFrameTimestampMs - lastOppSwitchFrameMs) >= 1400L) {
            // If Frame 2 had no conflicting old-species OCR text, latch the provisional swap
            oppSwitchValidityLatched = true
            provisionalOppPrevName = ""
            provisionalOppPrevSpecies = ""
            provisionalOppPrevWasAddedToDetected = false
            recalculateAndPushBattleData()
        }
    }

    /**
     * Executes a player switch, applying Faint vs. True Swap classification,
     * resurrection guard, midpoint timestamp interpolation, 2nd-frame validity bit, and recommendation adherence tracking (v3.34).
     */
    internal fun executePlayerSwitch(newSlotName: String, fromOcrFrame: Boolean = false) {
        val preset = currentPreset ?: return
        val newSlotIdx = preset.pokemon.indexOfFirst { it.name.equals(newSlotName, ignoreCase = true) }

        if (newSlotName.equals(activeUserPokemonName, ignoreCase = true) && !isPostFaintSwitchPromptActive) {
            lastConfirmedPlayerFrameTimeMs = currentFrameTimestampMs.takeIf { it > 0L } ?: System.currentTimeMillis()
            if (!playerSwitchValidityLatched) {
                playerSwitchValidityLatched = true
                provisionalPlayerPrevName = ""
                val lastEvIdx = battleTimelineEvents.indexOfLast { it.actor == "user" && it.validityLatched == false }
                if (lastEvIdx >= 0) {
                    battleTimelineEvents[lastEvIdx] = battleTimelineEvents[lastEvIdx].copy(validityLatched = true)
                }
                recalculateAndPushBattleData()
            }
            if (newSlotIdx in 0..2 && playerFaintedSlots[newSlotIdx]) {
                playerFaintedSlots[newSlotIdx] = false
                playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
                recalculateAndPushBattleData()
            }
            return
        }

        // v3.34: 2nd-Frame Validity Revert for Player OCR Switch — if Frame 1 was a provisional OCR switch
        // and Frame 2 immediately re-detects the previous player Pokémon, revert the switch & restore the swap clock!
        if (fromOcrFrame &&
            !playerSwitchValidityLatched &&
            provisionalPlayerPrevName.isNotEmpty() &&
            newSlotName.equals(provisionalPlayerPrevName, ignoreCase = true) &&
            (currentFrameTimestampMs - lastPlayerSwitchFrameMs) <= 2600L
        ) {
            activeUserPokemonName = provisionalPlayerPrevName
            playerSwapEndTimeMs = playerSwapEndTimeBeforeSwitch
            playerSwitchValidityLatched = true
            provisionalPlayerPrevName = ""
            lastConfirmedPlayerFrameTimeMs = currentFrameTimestampMs
            if (battleTimelineEvents.isNotEmpty() && battleTimelineEvents.last().actor == "user" && battleTimelineEvents.last().validityLatched == false) {
                battleTimelineEvents.removeAt(battleTimelineEvents.lastIndex)
            }
            recalculateAndPushBattleData()
            return
        }

        // Resurrection Guard: Any Pokémon entering the field is 100% alive (restore its last known pre-faint HP%)
        if (newSlotIdx in 0..2 && playerFaintedSlots[newSlotIdx]) {
            playerFaintedSlots[newSlotIdx] = false
            if (playerSlotHpPct[newSlotIdx] <= 0) {
                playerSlotHpPct[newSlotIdx] = playerSlotPreFaintHpPct[newSlotIdx].coerceIn(1, 100)
            }
            playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
        }

        if (isWaitingForOpponent) {
            activeUserPokemonName = newSlotName
            playerFaintedSlots.fill(false)
            playerPokeballCount = 3
            playerSwapEndTimeMs = 0L
            isPostFaintSwitchPromptActive = false
            playerSwitchValidityLatched = true
            lastConfirmedPlayerFrameTimeMs = System.currentTimeMillis()
            recalculateAndPushBattleData()
            return
        }

        rollbackPendingProactiveStep(markAnchorRolledBack = false)
        proactiveRolledBackAnchorMs = 0L
        val nowMs = currentFrameTimestampMs.takeIf { it > 0L } ?: System.currentTimeMillis()
        val prevPlayerPokemon = activeUserPokemonName ?: preset.pokemon.firstOrNull()?.name ?: ""
        val prevSlotIdx = preset.pokemon.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }.let { if (it >= 0) it else 0 }
        // v3.42: Start Swap Clock halfway between last frame with old Pokémon and first frame with new Pokémon.
        // Never classify a manual low-HP swap (e.g. swapping out at 22% HP) as a faint unless the post-faint prompt appeared,
        // the Pokéball count actually dropped, or the swap clock was still locked!
        val swapStartMs = getMidpointSwapStartTimeMs(lastConfirmedPlayerFrameTimeMs, nowMs)
        val elapsedSec = getElapsedBattleSeconds(swapStartMs)
        val priorFaintsExcludingPrev = (0..2).count {
            it != prevSlotIdx && it != newSlotIdx && playerFaintedSlots[it]
        }
        val aliveBeforeSwitch = (3 - priorFaintsExcludingPrev).coerceIn(2, 3)
        val effectivePlayerBalls = when {
            !isAllCombatHudGone && combatHudStableFrames >= 3 && debouncedPlayerBalls in 1..3 -> debouncedPlayerBalls
            sampledPlayerBalls == 3 -> 3
            (nowMs - lastObservedLowPlayerBallsTimeMs) <= 15000L && lastObservedLowPlayerBalls in 1..2 -> lastObservedLowPlayerBalls
            else -> -1
        }
        val isFaintReplacement = isPostFaintSwitchPromptActive ||
            playerFaintedSlots[prevSlotIdx] ||
            (effectivePlayerBalls in 1..2 && effectivePlayerBalls < aliveBeforeSwitch && !playerFaintedSlots[prevSlotIdx]) ||
            (fromOcrFrame && !lastPlayerSwitchWasFaint && (playerSwapEndTimeMs - nowMs) > 5000L)
        pendingPlayerLowHpSlot = -1
        pendingPlayerLowHpSample = -1

        // Evaluate whether the player's switch followed the active tactical recommendation
        val followedRec: Boolean? = if (lastRecommendedAction.isNotEmpty()) {
            recommendationsIssuedInBattle++
            val matchedRec = if (lastRecommendedSwapSlotIdx in 0..2) {
                newSlotIdx == lastRecommendedSwapSlotIdx
            } else {
                lastRecommendedAction.contains("SWAP", ignoreCase = true) ||
                    lastRecommendedAction.contains("SEND IN", ignoreCase = true) ||
                    lastRecommendedAction.contains("PIVOT", ignoreCase = true) ||
                    lastRecommendedAction.contains("PUNISH", ignoreCase = true)
            }
            if (matchedRec) recommendationsFollowedInBattle++
            matchedRec
        } else null

        val recTargetName = if (lastRecommendedSwapSlotIdx in 0..2) preset.pokemon.getOrNull(lastRecommendedSwapSlotIdx)?.name else null
        val oppRemSec = if (oppSwapEndTimeMs > nowMs) ceil((oppSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
        val oppAliveNow = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)

        provisionalPlayerPrevName = prevPlayerPokemon
        playerSwitchValidityLatched = !fromOcrFrame
        isPostFaintSwitchPromptActive = false
        activeUserPokemonName = newSlotName
        if (newSlotIdx in 0..2) {
            playerSlotEverOnField[newSlotIdx] = true
        }
        isPlayerTurnOne = false
        lastConfirmedPlayerFrameTimeMs = nowMs

        if (isFaintReplacement) {
            playerSwapEndTimeBeforeSwitch = playerSwapEndTimeMs
            playerPreSwitchBallCount = aliveBeforeSwitch
            lastPlayerPrevSlotIdx = prevSlotIdx
            lastPlayerSwitchTimeMs = swapStartMs
            lastPlayerSwitchFrameMs = nowMs
            lastPlayerSwitchWasFaint = true
            playerSwitchConfirmedAlive = true
            playerSwitchAliveFrames = 0
            playerPostSwitchLowBallFrames = 2
            if (prevSlotIdx in 0..2 && prevSlotIdx != newSlotIdx) {
                playerFaintedSlots[prevSlotIdx] = true
                playerSlotHpPct[prevSlotIdx] = 0
                lastScannedPlayerSlotHpPct[prevSlotIdx] = 0
                playerSlotEnergy[prevSlotIdx] = 0
                resetSlotEnergyTracking(prevSlotIdx, 0)
            }
            if (newSlotIdx in 0..2) {
                playerSlotCurrentMoveTurns[newSlotIdx] = 0
                playerLastFastCreditedAtMs[newSlotIdx] = 0L
                playerAutoIncrementAnchorMs[newSlotIdx] = 0L
                playerLastSelfCorrectionAtMs[newSlotIdx] = 0L
                lastScannedLeftChargeFillPct[newSlotIdx] = -1
                lastScannedRightChargeFillPct[newSlotIdx] = -1
                pendingConfirmLeftChargeFillPct[newSlotIdx] = -1
                pendingConfirmRightChargeFillPct[newSlotIdx] = -1
                leftChargeFillConfirmFrames[newSlotIdx] = 0
                rightChargeFillConfirmFrames[newSlotIdx] = 0
                leftChargeFillDebounceStartMs[newSlotIdx] = 0L
                rightChargeFillDebounceStartMs[newSlotIdx] = 0L
                resetSlotEnergyTracking(newSlotIdx, playerSlotEnergy[newSlotIdx].coerceIn(0, 100),
                    clearThirdFillLatches = false
                )
                phaseStartPlayerEnergy = playerSlotEnergy[newSlotIdx].coerceIn(0, 100)
                lastScannedPlayerSlotHpPct[newSlotIdx] = playerSlotHpPct[newSlotIdx].coerceIn(1, 100)
                predictedPlayerSlotHpPct[newSlotIdx] = playerSlotHpPct[newSlotIdx].coerceIn(1, 100)
                oppLastFastCreditedAtMs.fill(0L)
                oppCreditedByOptimalTimerAtMs.fill(0L)
            }
            postOppChargedMissingPlayerHpFrames = 0
            confirmedPhasePlayerTurns = 0
            lastConfirmedPlayerFastMoveMs = nowMs
            phasePlayerTurns = 0
            phaseOppTurns = 0
            lastTurnTickTimeMs = System.currentTimeMillis()
            turnResidualMs = 0L
            scanTurnOffsetMs = ((nowMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
            needsPostSwapOrMoveTurnReindex = true
            if (effectivePlayerBalls == 1 && newSlotIdx in 0..2) {
                for (idx in 0..2) {
                    if (idx != newSlotIdx) {
                        playerFaintedSlots[idx] = true
                        playerSlotHpPct[idx] = 0
                        lastScannedPlayerSlotHpPct[idx] = 0
                        playerSlotEnergy[idx] = 0
                        resetSlotEnergyTracking(idx, 0)
                    }
                }
            }
            playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
            val playerRemSec = if (playerSwapEndTimeMs > nowMs) ceil((playerSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
            battleTimelineEvents.add(
                BattleTimelineEvent(
                    type = "FAINT",
                    actor = "user",
                    t = elapsedSec,
                    pokemonFainted = prevPlayerPokemon.ifEmpty { null },
                    pokemonIn = newSlotName,
                    pokemonOut = prevPlayerPokemon.ifEmpty { null },
                    userShieldsRemaining = playerShieldsRemaining,
                    oppShieldsRemaining = oppShieldsRemaining,
                    recommendedAction = lastRecommendedAction.ifEmpty { null },
                    recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                    decisionPhase = "POST_FAINT_SWAP",
                    recommendedTargetPokemon = recTargetName,
                    playerSwapRemainingSec = playerRemSec,
                    oppSwapRemainingSec = oppRemSec,
                    userAliveCount = playerPokeballCount,
                    oppAliveCount = oppAliveNow,
                    lastPlayerSwitchWasFaint = true,
                    lastOppSwitchWasFaint = lastOppSwitchWasFaint,
                    candidateScores = lastRecommendedCandidateScores.takeIf { it.isNotEmpty() },
                    followedRecommendation = followedRec,
                    validityLatched = !fromOcrFrame
                )
            )
            syncRecentUnshieldedChargedAttackOnFaint("user", elapsedSec)
            lastDetectedBannerMoveName = ""
            lastDetectedBannerMoveActor = ""
            lastDetectedBannerMoveTimeMs = 0L
            prevStableLeftChargeFillPct = 0
            prevStableRightChargeFillPct = 0
            recalculateAndPushBattleData()
            val faintedLabel = prevPlayerPokemon.ifEmpty { "Player" }
            showBattleToast("💀 Player Faint Swap: $faintedLabel → $newSlotName")
        } else {
            // True Manual Swap: start 50s Swap Clock at midpoint between last old-mon frame and first new-mon frame
            playerSwapEndTimeBeforeSwitch = playerSwapEndTimeMs
            playerPreSwitchBallCount = aliveBeforeSwitch
            lastPlayerPrevSlotIdx = prevSlotIdx
            lastPlayerSwitchTimeMs = swapStartMs
            lastPlayerSwitchFrameMs = nowMs
            lastPlayerSwitchWasFaint = false
            playerSwitchConfirmedAlive = false
            playerSwitchAliveFrames = 0
            playerPostSwitchLowBallFrames = 0
            if (prevSlotIdx in 0..2) {
                playerFaintedSlots[prevSlotIdx] = false
                if (prevSlotIdx != newSlotIdx && (nowMs - playerSlotLastBigJumpMs[prevSlotIdx]) <= 1800L) {
                    playerSlotHpPct[prevSlotIdx] = playerSlotPriorHpPct[prevSlotIdx].coerceIn(1, 100)
                    playerSlotPreFaintHpPct[prevSlotIdx] = playerSlotHpPct[prevSlotIdx]
                    lastScannedPlayerSlotHpPct[prevSlotIdx] = playerSlotHpPct[prevSlotIdx]
                    confirmedPlayerSlotHpPct[prevSlotIdx] = playerSlotHpPct[prevSlotIdx]
                    pendingConfirmPlayerSlotHpPct[prevSlotIdx] = playerSlotHpPct[prevSlotIdx]
                    playerSlotHpConfirmFrames[prevSlotIdx] = 2
                    playerSlotLastBigJumpMs[prevSlotIdx] = 0L
                }
            }
            if (newSlotIdx in 0..2 && sampledPlayerHpPct in 1..100) {
                pendingConfirmPlayerSlotHpPct[newSlotIdx] = sampledPlayerHpPct
                playerSlotHpConfirmFrames[newSlotIdx] = 1
            }
            if (newSlotIdx in 0..2) {
                playerSlotCurrentMoveTurns[newSlotIdx] = 0
                playerLastFastCreditedAtMs[newSlotIdx] = 0L
                playerAutoIncrementAnchorMs[newSlotIdx] = 0L
                playerLastSelfCorrectionAtMs[newSlotIdx] = 0L
                lastScannedLeftChargeFillPct[newSlotIdx] = -1
                lastScannedRightChargeFillPct[newSlotIdx] = -1
                pendingConfirmLeftChargeFillPct[newSlotIdx] = -1
                pendingConfirmRightChargeFillPct[newSlotIdx] = -1
                leftChargeFillConfirmFrames[newSlotIdx] = 0
                rightChargeFillConfirmFrames[newSlotIdx] = 0
                leftChargeFillDebounceStartMs[newSlotIdx] = 0L
                rightChargeFillDebounceStartMs[newSlotIdx] = 0L
                val switchLeague = currentPreset?.league ?: "GREAT LEAGUE"
                val switchSlotMember = currentPreset?.pokemon?.getOrNull(newSlotIdx)
                val switchMonName = switchSlotMember?.name ?: newSlotName
                val switchMeta = getPokemonMeta(switchMonName, switchLeague, switchMonName.contains("Shadow", ignoreCase = true))
                val switchType = switchMeta.types.firstOrNull() ?: "normal"
                val swC1Name = switchSlotMember?.chargedMove1?.takeIf { it.isNotBlank() } ?: switchMeta.chargedMove1
                val swC2Name = switchSlotMember?.chargedMove2?.takeIf { it.isNotBlank() } ?: switchMeta.chargedMove2
                val swC1Cost = (OverlayService.resolveChargedMoveStatsStatic(swC1Name, switchType).energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[swC1Name] ?: 45).coerceIn(35, 100)
                val swC2Cost = (OverlayService.resolveChargedMoveStatsStatic(swC2Name, switchType).energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[swC2Name] ?: 55).coerceIn(35, 100)
                val bankedSwE = playerSlotEnergy[newSlotIdx].coerceIn(0, 100)
                resetSlotEnergyTracking(
                    newSlotIdx,
                    bankedSwE,
                    cost1 = swC1Cost,
                    cost2 = swC2Cost,
                    clearThirdFillLatches = false
                )
                phaseStartPlayerEnergy = bankedSwE
                lastStableNormalCombatEnergy = bankedSwE
                prevStableNormalCombatEnergy = bankedSwE
                val seededLeftFill = ((bankedSwE * 100.0) / swC1Cost.toDouble()).roundToInt().coerceIn(0, 300)
                val seededRightFill = ((bankedSwE * 100.0) / swC2Cost.toDouble()).roundToInt().coerceIn(0, 300)
                lastStableLeftChargeFillPct = seededLeftFill
                lastStableRightChargeFillPct = seededRightFill
                prevStableLeftChargeFillPct = seededLeftFill
                prevStableRightChargeFillPct = seededRightFill
                lastDetectedBannerMoveName = ""
                lastDetectedBannerMoveActor = ""
                lastDetectedBannerMoveTimeMs = 0L
                awaitingPostUserChargeCircleSync = false
                lastScannedPlayerSlotHpPct[newSlotIdx] = playerSlotHpPct[newSlotIdx].coerceIn(1, 100)
                predictedPlayerSlotHpPct[newSlotIdx] = playerSlotHpPct[newSlotIdx].coerceIn(1, 100)
                oppLastFastCreditedAtMs.fill(0L)
                oppCreditedByOptimalTimerAtMs.fill(0L)
            }
            postOppChargedMissingPlayerHpFrames = 0
            confirmedPhasePlayerTurns = 0
            lastConfirmedPlayerFastMoveMs = nowMs
            phasePlayerTurns = 0
            phaseOppTurns = 0
            lastTurnTickTimeMs = System.currentTimeMillis()
            turnResidualMs = 0L
            scanTurnOffsetMs = ((nowMs - battleClockAnchorMs).coerceAtLeast(0L)) % 500L
            needsPostSwapOrMoveTurnReindex = true
            playerSwapEndTimeMs = swapStartMs + 50000L
            val playerRemSec = ceil((playerSwapEndTimeMs - nowMs).coerceAtLeast(0L) / 1000.0).toInt()
            battleTimelineEvents.add(
                BattleTimelineEvent(
                    type = "SWAP",
                    actor = "user",
                    t = elapsedSec,
                    pokemonIn = newSlotName,
                    pokemonOut = prevPlayerPokemon.ifEmpty { null },
                    userShieldsRemaining = playerShieldsRemaining,
                    oppShieldsRemaining = oppShieldsRemaining,
                    recommendedAction = lastRecommendedAction.ifEmpty { null },
                    recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                    decisionPhase = lastRecommendedPhase.ifEmpty { "MIDGAME" },
                    recommendedTargetPokemon = recTargetName,
                    playerSwapRemainingSec = playerRemSec,
                    oppSwapRemainingSec = oppRemSec,
                    userAliveCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3),
                    oppAliveCount = oppAliveNow,
                    lastPlayerSwitchWasFaint = false,
                    lastOppSwitchWasFaint = lastOppSwitchWasFaint,
                    candidateScores = lastRecommendedCandidateScores.takeIf { it.isNotEmpty() },
                    followedRecommendation = followedRec,
                    validityLatched = !fromOcrFrame
                )
            )
            // v6.02: Conditional Post-Throw Swap-and-Immediate-Throw Rollback for Player
            tryRollbackRecentSwapAndImmediateThrow(
                actor = "user",
                prevSlotIdx = prevSlotIdx,
                newSlotIdx = newSlotIdx,
                newFormattedName = newSlotName,
                nowMs = nowMs
            )
            recalculateAndPushBattleData()
            showBattleToast("🔄 Player Switch: $newSlotName")
        }
    }

    /**
     * v6.02: Post-Throw Nameplate OCR Conditional Rollback (Both Player & Opponent).
     * When a player or opponent swaps in a Pokémon and immediately throws a charged move before the top-corner
     * nameplate OCR can run, the charged move may be provisionally attributed to `prevSlotIdx` (`pokemonOut`).
     * When the top-corner nameplate OCR detects `newSlotIdx` (`pokemonIn`) within `activeSwapThrowRollbackWindowMs` (default 4.0s)
     * after the charged move completed, this helper evaluates whether `pokemonIn` is a better fit for the move/HP delta/energy
     * and rolls back the provisional energy deduction and move lock on `pokemonOut`, applying it cleanly to `pokemonIn`!
     */
    internal fun tryRollbackRecentSwapAndImmediateThrow(
        actor: String,
        prevSlotIdx: Int,
        newSlotIdx: Int,
        newFormattedName: String,
        nowMs: Long
    ) {
        val windowMs = activeSwapThrowRollbackWindowMs
        if (windowMs <= 0 || prevSlotIdx !in 0..2 || newSlotIdx !in 0..2 || prevSlotIdx == newSlotIdx) return
        if ((nowMs - lastChargedAttackLoggedMs) !in 1L..windowMs.toLong()) return
        if (lastChargedAttackLoggedActor != actor) return
        if (lastPostThrowSwapRollbackChargeMs == lastChargedAttackLoggedMs) return

        val lastChargeIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == actor }
        if (lastChargeIdx < 0) return
        val ev = battleTimelineEvents[lastChargeIdx]
        val preset = currentPreset
        val activeLeague = preset?.league ?: "MASTER LEAGUE"

        if (actor == "opp") {
            val newOppRaw = detectedOpponents.getOrNull(newSlotIdx) ?: newFormattedName
            val newOppBase = FormResolver.extractBaseSpecies(newOppRaw).lowercase()
            if (ev.activePokemon?.let { FormResolver.extractBaseSpecies(it).equals(newOppBase, ignoreCase = true) } == true) {
                return // Already attributed to newSlotIdx
            }
            val newOppShad = manualShadowOverrides[newOppBase] ?: newFormattedName.contains("Shadow", ignoreCase = true)
            val newOppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(newOppRaw, activeLeague, newOppShad), activeLeague)
            val newOppThird = newOppMeta.chargedMove3.takeIf { it.isNotBlank() }
                ?: COMMON_THIRD_CHARGED_MOVE[newOppMeta.name]
                ?: "Outrage"
            val newOppMoves = listOf(newOppMeta.chargedMove1, newOppMeta.chargedMove2, newOppThird, newOppMeta.chargedMove4)
                .filter { it.isNotBlank() }.distinct()
            val activeUIdx = (preset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0).coerceIn(0, 2)
            val uCfg = preset?.pokemon?.getOrNull(activeUIdx)
            val uName = uCfg?.name ?: activeUserPokemonName ?: "Dialga (Origin)"
            val uShad = uName.contains("Shadow", ignoreCase = true)
            val uMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(uName, activeLeague, uShad), activeLeague, uCfg?.cp, uCfg?.ivs)

            val newCandPairs = newOppMoves.map { mName ->
                mName to calculateChargedMoveDamagePercent(
                    attacker = newOppMeta,
                    defender = uMeta,
                    moveName = mName,
                    isAttackerShadow = newOppShad,
                    isDefenderShadow = uShad
                )
            }
            val existingMove = ev.inferredMoveName
            val obsDelta = ev.hpDeltaPct ?: 0
            val wasShielded = ev.shielded == true
            val existingErr = if (!wasShielded && ev.expectedMoveDmgPct != null) kotlin.math.abs(obsDelta - ev.expectedMoveDmgPct) else 0
            val newMatchingBannerMove = existingMove?.takeIf { m -> newOppMoves.any { it.equals(m, ignoreCase = true) } }
            val newHpInferredMove = if (!wasShielded && obsDelta >= 4) {
                inferUnshieldedChargedMoveName(obsDelta, newCandPairs) ?: inferBestGuessChargedMoveByHp(obsDelta, newCandPairs)
            } else null
            val candidateNewMove = newMatchingBannerMove ?: newHpInferredMove ?: newOppMoves.firstOrNull() ?: return
            val newExpDmg = newCandPairs.find { it.first.equals(candidateNewMove, ignoreCase = true) }?.second
            val newErr = if (!wasShielded && newExpDmg != null) kotlin.math.abs(obsDelta - newExpDmg) else 0

            val oldHadDeficit = (ev.energyDeficit ?: 0) >= 4
            val newImprovesHpFit = !wasShielded && existingErr >= 12 && newErr + 6 <= existingErr
            val moveBelongsToNewSlot = newMatchingBannerMove != null && ev.moveResolutionSource != "BANNER_OCR"
            if (oldHadDeficit || newImprovesHpFit || moveBelongsToNewSlot || ev.moveResolutionSource == "DEFAULT_FALLBACK") {
                // Refund old slot energy & unlock move if it was inferred via HP delta
                val refundedE = lastOppChargeDeductedEnergySnapshot.coerceAtLeast(ev.requiredMoveEnergy ?: 0)
                if (refundedE > 0) {
                    oppSlotEnergy[prevSlotIdx] = (oppSlotEnergy[prevSlotIdx] + refundedE).coerceIn(0, 100)
                }
                if (existingMove != null && ev.moveResolutionSource != "BANNER_OCR") {
                    confirmedOppChargedMoves[prevSlotIdx].remove(existingMove)
                }
                val mStats = OverlayService.resolveChargedMoveStatsStatic(candidateNewMove, newOppMeta.types.firstOrNull() ?: "normal")
                val trueCost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[candidateNewMove] ?: 45).coerceIn(35, 100)
                val newPreE = max(oppSlotEnergy[newSlotIdx], trueCost).coerceIn(trueCost, 100)
                oppSlotEnergy[newSlotIdx] = (newPreE - trueCost).coerceIn(0, 100)
                confirmedOppChargedMoves[newSlotIdx].add(candidateNewMove)
                lastOppChargeDeductedEnergySnapshot = trueCost
                lastOppChargedAttackerSlotIdx = newSlotIdx
                lastOppChargedAttackerRawName = newOppRaw
                lastOppChargedAttackerShadow = newOppShad
                lastPostThrowSwapRollbackChargeMs = lastChargedAttackLoggedMs
                battleTimelineEvents[lastChargeIdx] = ev.copy(
                    activePokemon = newFormattedName,
                    inferredMoveName = candidateNewMove,
                    oppEnergy = oppSlotEnergy[newSlotIdx],
                    preThrowEnergy = newPreE,
                    requiredMoveEnergy = trueCost,
                    energyDeficit = 0,
                    expectedMoveDmgPct = newExpDmg ?: ev.expectedMoveDmgPct,
                    moveResolutionSource = "POST_THROW_SWAP_ROLLBACK"
                )
            }
        } else if (actor == "user" && preset != null) {
            val newSlotCfg = preset.pokemon.getOrNull(newSlotIdx) ?: return
            val newMonName = newSlotCfg.name
            if (ev.activePokemon?.equals(newMonName, ignoreCase = true) == true) return
            val newShad = newMonName.contains("Shadow", ignoreCase = true)
            val newMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(newMonName, activeLeague, newShad), activeLeague, newSlotCfg.cp, newSlotCfg.ivs)
            val c1 = newSlotCfg.chargedMove1.takeIf { it.isNotBlank() } ?: newMeta.chargedMove1
            val c2 = newSlotCfg.chargedMove2.takeIf { it.isNotBlank() } ?: newMeta.chargedMove2
            val newMoves = listOfNotNull(c1, c2).filter { it.isNotBlank() }.distinct()
            val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
            val defOppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(activeOpponentName, activeLeague, isOpponentShadow), activeLeague)
            val newCandPairs = newMoves.map { mName ->
                mName to calculateChargedMoveDamagePercent(
                    attacker = newMeta,
                    defender = defOppMeta,
                    moveName = mName,
                    isAttackerShadow = newShad,
                    isDefenderShadow = isOpponentShadow
                )
            }
            val obsDelta = ev.hpDeltaPct ?: 0
            val wasShielded = ev.shielded == true
            val existingErr = if (!wasShielded && ev.expectedMoveDmgPct != null) kotlin.math.abs(obsDelta - ev.expectedMoveDmgPct) else 0
            val newHpMove = if (!wasShielded && obsDelta >= 4) {
                inferUnshieldedChargedMoveName(obsDelta, newCandPairs) ?: inferBestGuessChargedMoveByHp(obsDelta, newCandPairs)
            } else null
            val candNewUserMove = newHpMove ?: c1
            val newExpDmg = newCandPairs.find { it.first.equals(candNewUserMove, ignoreCase = true) }?.second
            val newErr = if (!wasShielded && newExpDmg != null) kotlin.math.abs(obsDelta - newExpDmg) else 0
            val oldHadDeficit = (ev.energyDeficit ?: 0) >= 4
            val newImprovesHpFit = !wasShielded && existingErr >= 12 && newErr + 6 <= existingErr
            if ((oldHadDeficit || newImprovesHpFit) && ev.moveResolutionSource != "BANNER_OCR") {
                val refundedE = lastUserChargeDeductedEnergySnapshot.coerceAtLeast(ev.requiredMoveEnergy ?: 0)
                if (refundedE > 0) {
                    playerSlotEnergy[prevSlotIdx] = (playerSlotEnergy[prevSlotIdx] + refundedE).coerceIn(0, 100)
                    playerSlotEnergyAnchor[prevSlotIdx] = playerSlotEnergy[prevSlotIdx]
                }
                val mStats = OverlayService.resolveChargedMoveStatsStatic(candNewUserMove, newMeta.types.firstOrNull() ?: "normal")
                val trueCost = (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[candNewUserMove] ?: 45).coerceIn(35, 100)
                val newPreE = max(playerSlotEnergy[newSlotIdx], trueCost).coerceIn(trueCost, 100)
                val residualE = (newPreE - trueCost).coerceIn(0, 100)
                playerSlotEnergy[newSlotIdx] = residualE
                playerSlotEnergyAnchor[newSlotIdx] = residualE
                lastUserChargePreEnergySnapshot = newPreE
                lastUserChargeDeductedEnergySnapshot = trueCost
                lastUserChargeResolvedMoveName = candNewUserMove
                lastPostThrowSwapRollbackChargeMs = lastChargedAttackLoggedMs
                battleTimelineEvents[lastChargeIdx] = ev.copy(
                    activePokemon = newMonName,
                    inferredMoveName = candNewUserMove,
                    userEnergy = residualE,
                    preThrowEnergy = newPreE,
                    requiredMoveEnergy = trueCost,
                    energyDeficit = 0,
                    expectedMoveDmgPct = newExpDmg ?: ev.expectedMoveDmgPct,
                    moveResolutionSource = "POST_THROW_SWAP_ROLLBACK"
                )
            }
        }
    }

    /**
     * Per-frame self-healing state verification for Pokéballs, Shields, and Faint slots:
     * 1. Active fighting Pokémon on the field can NEVER be marked fainted.
     * 2. If 3 red Pokéballs are detected on screen, all 3 Pokémon are alive; any false-faint on a recent swap is rolled back and its 50s Swap Clock is started.
     * 3. If the Pokéball HUD finishes sliding in after the replacement Pokémon's name appears (before the switch is confirmed alive), immediately catches the faint, dims the prior slot, restores the prior Swap Clock, and shows a Faint Swap toast.
     * 4. Updates shield counts independently (verified while HUD Pokéballs are visible) and shows a Shield Used toast.
     */
    internal fun updateSteadyFrameBallAndShieldState() {
        if (isWaitingForOpponent) return
        var changed = false

        val frameTimeMs = currentFrameTimestampMs.takeIf { it > 0L } ?: System.currentTimeMillis()
        val eventT = getElapsedBattleSeconds(frameTimeMs)

        val preset = currentPreset
        val activeUserIdx = preset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) } ?: 0
        if (activeUserIdx in 0..2 && !isPostFaintSwitchPromptActive) {
            val recentlyKodUser = (frameTimeMs - lastUserSlotKoTimeMs[activeUserIdx]) in 0L..5500L
            val canResurrectActiveUser = !recentlyKodUser && (debouncedPlayerBalls == 3 || (sampledPlayerHpPct in 1..100 && playerSlotHpConfirmFrames[activeUserIdx] >= 2))
            if (playerFaintedSlots[activeUserIdx] && canResurrectActiveUser) {
                playerFaintedSlots[activeUserIdx] = false
                changed = true
            }
            if (!playerFaintedSlots[activeUserIdx] && playerSlotHpPct[activeUserIdx] <= 0) {
                playerSlotHpPct[activeUserIdx] = playerSlotPreFaintHpPct[activeUserIdx].coerceIn(1, 100)
                changed = true
            }
        }

        val activeOppBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val activeOppIdx = if (detectedOpponents.isNotEmpty()) {
            detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOppBase, ignoreCase = true)
            }
        } else -1
        if (activeOppIdx in 0..2) {
            val recentlyKodOpp = (frameTimeMs - lastSlotKoTimeMs[activeOppIdx]) in 0L..5500L
            val canResurrectActiveOpp = !recentlyKodOpp && (debouncedOppBalls == 3 || (sampledOppHpPct in 1..100 && oppSlotHpConfirmFrames[activeOppIdx] >= 2))
            if (oppFaintedSlots[activeOppIdx] && canResurrectActiveOpp) {
                oppFaintedSlots[activeOppIdx] = false
                changed = true
            }
            if (!oppFaintedSlots[activeOppIdx] && oppSlotHpPct[activeOppIdx] <= 0) {
                oppSlotHpPct[activeOppIdx] = oppSlotPreFaintHpPct[activeOppIdx].coerceIn(1, 100)
                changed = true
            }
        }

        // v3.94: Unified All-HUD-Gone Lockout + Multi-Frame Shield & Pokéball Debounce
        // When the battle HUD is gone (top Pokéballs/shields missing, bottom charge circles + both floating HP bars missing,
        // or a charged attack cutscene is active), freeze all shield decrements and faint attributions!
        val areBottomCirclesVisibleNow = sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300
        val isPlayerCombatUiBack = !isAllCombatHudGone &&
            combatHudStableFrames >= 3 &&
            (areBottomCirclesVisibleNow || sampledPlayerHpPct in 1..100 || !(enableHpTracking || enableEnergyTracking))
        val isOppCombatUiBack = !isAllCombatHudGone &&
            combatHudStableFrames >= 3 &&
            (areBottomCirclesVisibleNow || sampledOppHpPct in 1..100 || !(enableHpTracking || enableEnergyTracking))
        val activeChargeId = if (pendingChargedAttackStartMs > 0L) pendingChargedAttackStartMs else lastChargedAttackLoggedMs
        val alreadyDecrementedPlayerShieldThisCharge =
            (activeChargeId > 0L && lastPlayerShieldDecrementChargeStartMs == activeChargeId && (frameTimeMs - activeChargeId) <= 6500L) ||
                (lastPlayerShieldDecrementChargeStartMs > 0L && (frameTimeMs - lastPlayerShieldDecrementChargeStartMs) < 3500L)
        val alreadyDecrementedOppShieldThisCharge =
            (activeChargeId > 0L && lastOppShieldDecrementChargeStartMs == activeChargeId && (frameTimeMs - activeChargeId) <= 6500L) ||
                (lastOppShieldDecrementChargeStartMs > 0L && (frameTimeMs - lastOppShieldDecrementChargeStartMs) < 3500L)
        val hasRecentOppChargeForShield = pendingChargedAttackActor == "opp" ||
            (lastChargedPromptActor == "opp" && (frameTimeMs - lastChargedPromptTimeMs) <= 12000L) ||
            (lastOppChargedAttackLoggedMs > 0L && (frameTimeMs - lastOppChargedAttackLoggedMs) <= 8000L) ||
            ((frameTimeMs - lastDetectedBlockedBannerMs) <= 6500L)
        val hasRecentUserChargeForShield = pendingChargedAttackActor == "user" ||
            (lastChargedPromptActor == "user" && (frameTimeMs - lastChargedPromptTimeMs) <= 12000L) ||
            (lastUserChargedAttackLoggedMs > 0L && (frameTimeMs - lastUserChargedAttackLoggedMs) <= 8000L) ||
            ((frameTimeMs - lastDetectedBlockedBannerMs) <= 6500L)

        // Shield count transitions (4-frame debounce, max -1 shield per charged attack) + 2-frame continual self-healing restoration
        if (isPlayerCombatUiBack && hasRecentOppChargeForShield && !alreadyDecrementedPlayerShieldThisCharge && sampledPlayerShields in 0..1 && sampledPlayerShields < playerShieldsRemaining) {
            playerShieldRestoreFrames = 0
            playerShieldDropFrames++
            if (playerShieldDropFrames >= 4) {
                val nextShields = (playerShieldsRemaining - 1).coerceIn(0, 2)
                val activeUserMon = activeUserPokemonName ?: preset?.pokemon?.firstOrNull()?.name ?: ""
                val shieldNum = (2 - nextShields).coerceIn(1, 2)
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "SHIELD",
                        actor = "user",
                        t = eventT,
                        shieldNumber = shieldNum,
                        activePokemon = activeUserMon.ifEmpty { null },
                        pokemonShielded = activeUserMon.ifEmpty { null },
                        userShieldsRemaining = nextShields,
                        oppShieldsRemaining = oppShieldsRemaining
                    )
                )
                // v6.02 / v6.12: Retroactive Shield Sync when [SHIELD] debounces up to 10.0s after an opponent CHARGED_ATTACK
                val recentOppChargeIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "opp" }
                if (recentOppChargeIdx >= 0) {
                    val prevEv = battleTimelineEvents[recentOppChargeIdx]
                    val dtSec = (eventT - prevEv.t).coerceAtLeast(0.0)
                    val prevDelta = prevEv.hpDeltaPct ?: 0
                    if (dtSec <= 10.0 && prevEv.shielded == false && prevDelta <= activeShieldChipTolerancePct + 4) {
                        val hpBef = (prevEv.hpBeforePct ?: 100).coerceIn(1, 100)
                        battleTimelineEvents[recentOppChargeIdx] = prevEv.copy(
                            shielded = true,
                            pokemonShielded = activeUserMon.ifEmpty { prevEv.pokemonShielded },
                            hpAfterPct = max(1, hpBef - 1),
                            hpDeltaPct = 1,
                            userShieldsRemaining = nextShields
                        )
                    }
                }
                playerShieldsRemaining = nextShields
                lastPlayerShieldDecrementChargeStartMs = if (activeChargeId > 0L) activeChargeId else frameTimeMs
                playerShieldDropFrames = 0
                changed = true
                showBattleToast("🛡️ Player Shield Used ($playerShieldsRemaining left)")
            }
        } else if (!isAllCombatHudGone && combatHudStableFrames >= 2 && sampledPlayerShields in 1..2 && sampledPlayerShields > playerShieldsRemaining) {
            playerShieldDropFrames = 0
            playerShieldRestoreFrames++
            if (playerShieldRestoreFrames >= 2) {
                val restoredTo = sampledPlayerShields.coerceIn(1, 2)
                val shieldsRestoredCount = (restoredTo - playerShieldsRemaining).coerceAtLeast(1)
                repeat(shieldsRestoredCount) {
                    val lastUserShieldIdx = battleTimelineEvents.indexOfLast {
                        it.type.equals("SHIELD", ignoreCase = true) && it.actor.equals("user", ignoreCase = true)
                    }
                    if (lastUserShieldIdx >= 0) {
                        battleTimelineEvents.removeAt(lastUserShieldIdx)
                    }
                }
                playerShieldsRemaining = restoredTo
                lastPlayerShieldDecrementChargeStartMs = 0L
                playerShieldRestoreFrames = 0
                changed = true
                showBattleToast("🛡️ Player Shield Restored ($playerShieldsRemaining left)")
            }
        } else {
            playerShieldDropFrames = 0
            playerShieldRestoreFrames = 0
        }

        if (isOppCombatUiBack && hasRecentUserChargeForShield && !alreadyDecrementedOppShieldThisCharge && sampledOppShields in 0..1 && sampledOppShields < oppShieldsRemaining) {
            oppShieldRestoreFrames = 0
            oppShieldDropFrames++
            if (oppShieldDropFrames >= 4) {
                val nextShields = (oppShieldsRemaining - 1).coerceIn(0, 2)
                val activeOppMon = formatOpponentNameWithShadow(activeOpponentName)
                val shieldNum = (2 - nextShields).coerceIn(1, 2)
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "SHIELD",
                        actor = "opp",
                        t = eventT,
                        shieldNumber = shieldNum,
                        activePokemon = activeOppMon.ifEmpty { null },
                        pokemonShielded = activeOppMon.ifEmpty { null },
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = nextShields
                    )
                )
                // v6.02 / v6.12: Retroactive Shield Sync when opponent [SHIELD] debounces up to 10.0s after a player CHARGED_ATTACK
                val recentUserChargeIdx = battleTimelineEvents.indexOfLast { it.type == "CHARGED_ATTACK" && it.actor == "user" }
                if (recentUserChargeIdx >= 0) {
                    val prevEv = battleTimelineEvents[recentUserChargeIdx]
                    val dtSec = (eventT - prevEv.t).coerceAtLeast(0.0)
                    val prevDelta = prevEv.hpDeltaPct ?: 0
                    if (dtSec <= 10.0 && prevEv.shielded == false && prevDelta <= activeShieldChipTolerancePct + 4) {
                        val hpBef = (prevEv.hpBeforePct ?: 100).coerceIn(1, 100)
                        battleTimelineEvents[recentUserChargeIdx] = prevEv.copy(
                            shielded = true,
                            pokemonShielded = activeOppMon.ifEmpty { prevEv.pokemonShielded },
                            hpAfterPct = max(1, hpBef - 1),
                            hpDeltaPct = 1,
                            oppShieldsRemaining = nextShields
                        )
                    }
                }
                oppShieldsRemaining = nextShields
                lastOppShieldDecrementChargeStartMs = if (activeChargeId > 0L) activeChargeId else frameTimeMs
                oppShieldDropFrames = 0
                changed = true
                showBattleToast("🛡️ Opponent Shield Used ($oppShieldsRemaining left)")
            }
        } else if (!isAllCombatHudGone && combatHudStableFrames >= 2 && sampledOppShields in 1..2 && sampledOppShields > oppShieldsRemaining) {
            oppShieldDropFrames = 0
            oppShieldRestoreFrames++
            if (oppShieldRestoreFrames >= 2) {
                val restoredTo = sampledOppShields.coerceIn(1, 2)
                val shieldsRestoredCount = (restoredTo - oppShieldsRemaining).coerceAtLeast(1)
                repeat(shieldsRestoredCount) {
                    val lastOppShieldIdx = battleTimelineEvents.indexOfLast {
                        it.type.equals("SHIELD", ignoreCase = true) && it.actor.equals("opp", ignoreCase = true)
                    }
                    if (lastOppShieldIdx >= 0) {
                        battleTimelineEvents.removeAt(lastOppShieldIdx)
                    }
                }
                oppShieldsRemaining = restoredTo
                lastOppShieldDecrementChargeStartMs = 0L
                oppShieldRestoreFrames = 0
                changed = true
                showBattleToast("🛡️ Opponent Shield Restored ($oppShieldsRemaining left)")
            }
        } else {
            oppShieldDropFrames = 0
            oppShieldRestoreFrames = 0
        }

        // Player Pokéball self-healing & post-switch verification (gated on !isAllCombatHudGone and debouncedPlayerBalls)
        if (!isAllCombatHudGone && debouncedPlayerBalls == 3) {
            if (lastPlayerSwitchWasFaint && (currentFrameTimestampMs - lastPlayerSwitchFrameMs) in 1..6500L) {
                playerSwapEndTimeMs = lastPlayerSwitchTimeMs + 50000L
                lastPlayerSwitchWasFaint = false
                playerSwitchConfirmedAlive = true
                val lastIdx = battleTimelineEvents.indexOfLast { it.actor == "user" && it.type == "FAINT" }
                if (lastIdx >= 0) {
                    val ev = battleTimelineEvents[lastIdx]
                    battleTimelineEvents[lastIdx] = ev.copy(type = "SWAP", pokemonFainted = null)
                }
                changed = true
            }
            playerSwitchConfirmedAlive = true
            playerSwitchAliveFrames = 0
            playerPostSwitchLowBallFrames = 0
            lastObservedLowPlayerBalls = 3
            if (playerPokeballCount != 3 || playerFaintedSlots.any { it }) {
                playerPokeballCount = 3
                playerFaintedSlots.fill(false)
                for (i in 0..2) {
                    if (playerSlotHpPct[i] <= 0) {
                        playerSlotHpPct[i] = playerSlotPreFaintHpPct[i].coerceIn(1, 100)
                    }
                }
                changed = true
            }
        } else if (isPlayerCombatUiBack && pendingChargedAttackActor.isEmpty() && debouncedPlayerBalls in 1..2) {
            if (debouncedPlayerBalls == 1 && activeUserIdx in 0..2) {
                for (idx in 0..2) {
                    if (idx != activeUserIdx && (!playerFaintedSlots[idx] || playerSlotHpPct[idx] != 0)) {
                        playerFaintedSlots[idx] = true
                        playerSlotHpPct[idx] = 0
                        changed = true
                    }
                }
                playerPokeballCount = 1
            } else if (debouncedPlayerBalls == 2 && playerFaintedSlots.count { it } > 1 && activeUserIdx in 0..2) {
                val keepFaintedIdx = if (lastPlayerPrevSlotIdx in 0..2 && lastPlayerPrevSlotIdx != activeUserIdx && playerFaintedSlots[lastPlayerPrevSlotIdx]) {
                    lastPlayerPrevSlotIdx
                } else {
                    (0..2).filter { it != activeUserIdx }.minByOrNull { playerSlotPreFaintHpPct[it] } ?: -1
                }
                for (idx in 0..2) {
                    val shouldFaint = idx == keepFaintedIdx && idx != activeUserIdx
                    if (playerFaintedSlots[idx] != shouldFaint) {
                        playerFaintedSlots[idx] = shouldFaint
                        if (!shouldFaint && playerSlotHpPct[idx] <= 0) {
                            playerSlotHpPct[idx] = playerSlotPreFaintHpPct[idx].coerceIn(1, 100)
                            confirmedPlayerSlotHpPct[idx] = playerSlotHpPct[idx]
                            lastScannedPlayerSlotHpPct[idx] = playerSlotHpPct[idx]
                        }
                        changed = true
                    }
                }
                playerPokeballCount = 2
            } else if (debouncedPlayerBalls == 2 &&
                playerFaintedSlots.count { it } == 0 &&
                !playerSwitchConfirmedAlive &&
                lastPlayerPrevSlotIdx in 0..2 &&
                lastPlayerPrevSlotIdx != activeUserIdx &&
                (currentFrameTimestampMs - lastPlayerSwitchFrameMs) <= 6500L
            ) {
                playerFaintedSlots[lastPlayerPrevSlotIdx] = true
                playerSlotHpPct[lastPlayerPrevSlotIdx] = 0
                playerPokeballCount = 2
                changed = true
            }
            if (!lastPlayerSwitchWasFaint &&
                !playerSwitchConfirmedAlive &&
                lastPlayerPrevSlotIdx in 0..2 &&
                lastPlayerPrevSlotIdx != activeUserIdx &&
                playerFaintedSlots.count { it } < (3 - debouncedPlayerBalls)
            ) {
                // HUD finished sliding in after faint replacement: mark prior slot fainted & rollback Swap Clock reset!
                playerFaintedSlots[lastPlayerPrevSlotIdx] = true
                playerSlotHpPct[lastPlayerPrevSlotIdx] = 0
                if (debouncedPlayerBalls == 1 && activeUserIdx in 0..2) {
                    for (idx in 0..2) {
                        if (idx != activeUserIdx) {
                            playerFaintedSlots[idx] = true
                            playerSlotHpPct[idx] = 0
                        }
                    }
                }
                playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
                playerSwapEndTimeMs = 0L
                lastPlayerSwitchWasFaint = true
                playerSwitchConfirmedAlive = true
                playerSwitchAliveFrames = 0
                val faintedName = preset?.pokemon?.getOrNull(lastPlayerPrevSlotIdx)?.name ?: "Player"
                val lastIdx = battleTimelineEvents.indexOfLast { it.actor == "user" && it.type == "SWAP" }
                if (lastIdx >= 0) {
                    val ev = battleTimelineEvents[lastIdx]
                    battleTimelineEvents[lastIdx] = ev.copy(type = "FAINT", pokemonFainted = ev.pokemonOut ?: faintedName)
                    syncRecentUnshieldedChargedAttackOnFaint("user", ev.t)
                }
                changed = true
                showBattleToast("💀 Player Faint Swap: $faintedName → ${activeUserPokemonName ?: ""}")
            } else if (!lastPlayerSwitchWasFaint && !playerSwitchConfirmedAlive && debouncedPlayerBalls >= playerPreSwitchBallCount) {
                playerSwitchAliveFrames++
                if (playerSwitchAliveFrames >= 2) {
                    playerSwitchConfirmedAlive = true
                }
            }
        }

        // Opponent Pokéball self-healing & post-switch verification (gated on !isAllCombatHudGone and debouncedOppBalls)
        if (!isAllCombatHudGone && debouncedOppBalls == 3) {
            if (lastOppSwitchWasFaint && (currentFrameTimestampMs - lastOppSwitchFrameMs) in 1..6500L) {
                oppSwapEndTimeMs = lastOppSwitchTimeMs + 50000L
                lastOppSwitchWasFaint = false
                oppSwitchConfirmedAlive = true
                val lastIdx = battleTimelineEvents.indexOfLast { it.actor == "opp" && it.type == "FAINT" }
                if (lastIdx >= 0) {
                    val ev = battleTimelineEvents[lastIdx]
                    battleTimelineEvents[lastIdx] = ev.copy(type = "SWAP", pokemonFainted = null)
                }
                changed = true
            }
            oppSwitchConfirmedAlive = true
            oppSwitchAliveFrames = 0
            oppPostSwitchLowBallFrames = 0
            lastObservedLowOppBalls = 3
            if (oppPokeballCount != 3 || oppFaintedSlots.any { it }) {
                oppPokeballCount = 3
                oppFaintedSlots.fill(false)
                for (i in 0..2) {
                    if (oppSlotHpPct[i] <= 0) {
                        oppSlotHpPct[i] = oppSlotPreFaintHpPct[i].coerceIn(1, 100)
                    }
                }
                changed = true
            }
        } else if (isOppCombatUiBack && pendingChargedAttackActor.isEmpty() && debouncedOppBalls in 1..2) {
            if (debouncedOppBalls == 1 && activeOppIdx in 0..2) {
                for (idx in 0 until min(3, max(detectedOpponents.size, 3))) {
                    if (idx != activeOppIdx && (!oppFaintedSlots[idx] || oppSlotHpPct[idx] != 0)) {
                        oppFaintedSlots[idx] = true
                        oppSlotHpPct[idx] = 0
                        changed = true
                    }
                }
                oppPokeballCount = 1
            } else if (debouncedOppBalls == 2 && oppFaintedSlots.count { it } > 1 && activeOppIdx in 0..2) {
                // v3.93 Self-Healing: When 2 Pokéballs are visible on screen, at most 1 opponent Pokémon can be fainted!
                val keepFaintedIdx = resolveFaintedOpponentSlotIdx(
                    excludeActiveSlot = activeOppIdx,
                    preferredPreKoSlot = lastOppPrevSlotIdx,
                    nowMs = currentFrameTimestampMs,
                    ignoreExistingFaintedFlags = true
                )
                for (idx in 0..2) {
                    val shouldBeFainted = idx == keepFaintedIdx && idx != activeOppIdx
                    if (oppFaintedSlots[idx] != shouldBeFainted) {
                        oppFaintedSlots[idx] = shouldBeFainted
                        if (!shouldBeFainted && oppSlotHpPct[idx] <= 0) {
                            oppSlotHpPct[idx] = oppSlotPreFaintHpPct[idx].coerceIn(1, 100)
                            confirmedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                            lastScannedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                        }
                        changed = true
                    }
                }
                if (oppPokeballCount != 2) {
                    oppPokeballCount = 2
                    changed = true
                }
            } else if (debouncedOppBalls == 2 &&
                oppFaintedSlots.count { it } == 0 &&
                !oppSwitchConfirmedAlive &&
                (currentFrameTimestampMs - lastOppSwitchFrameMs) <= 6500L
            ) {
                val faintedIdx = resolveFaintedOpponentSlotIdx(
                    excludeActiveSlot = activeOppIdx,
                    preferredPreKoSlot = lastOppPrevSlotIdx,
                    nowMs = currentFrameTimestampMs
                )
                if (faintedIdx in 0..2 && faintedIdx != activeOppIdx) {
                    oppFaintedSlots[faintedIdx] = true
                    oppSlotHpPct[faintedIdx] = 0
                    lastScannedOppSlotHpPct[faintedIdx] = 0
                    oppSlotEnergy[faintedIdx] = 0
                    oppPokeballCount = 2
                    changed = true
                }
            }
            if (!lastOppSwitchWasFaint &&
                !oppSwitchConfirmedAlive &&
                lastOppPrevSlotIdx in 0..2 &&
                lastOppPrevSlotIdx != activeOppIdx &&
                oppFaintedSlots.count { it } < (3 - debouncedOppBalls)
            ) {
                // HUD finished sliding in after faint replacement: resolve the true fainted slot & clear Swap Clock (unless it was a catch KO)!
                val faintedIdx = resolveFaintedOpponentSlotIdx(
                    excludeActiveSlot = activeOppIdx,
                    preferredPreKoSlot = lastOppPrevSlotIdx,
                    nowMs = currentFrameTimestampMs
                )
                val targetFaintSlot = if (faintedIdx in 0..2 && faintedIdx != activeOppIdx) faintedIdx else lastOppPrevSlotIdx
                if (debouncedOppBalls == 2) {
                    for (idx in 0..2) {
                        if (idx != targetFaintSlot && oppFaintedSlots[idx]) {
                            oppFaintedSlots[idx] = false
                            if (oppSlotHpPct[idx] <= 0) {
                                oppSlotHpPct[idx] = oppSlotPreFaintHpPct[idx].coerceIn(1, 100)
                                confirmedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                                lastScannedOppSlotHpPct[idx] = oppSlotHpPct[idx]
                            }
                        }
                    }
                }
                oppFaintedSlots[targetFaintSlot] = true
                oppSlotHpPct[targetFaintSlot] = 0
                lastScannedOppSlotHpPct[targetFaintSlot] = 0
                oppSlotEnergy[targetFaintSlot] = 0
                if (debouncedOppBalls == 1 && activeOppIdx in 0..2) {
                    for (idx in 0 until min(3, detectedOpponents.size)) {
                        if (idx != activeOppIdx) {
                            oppFaintedSlots[idx] = true
                            oppSlotHpPct[idx] = 0
                            lastScannedOppSlotHpPct[idx] = 0
                            oppSlotEnergy[idx] = 0
                        }
                    }
                }
                oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
                if (!pendingChargedAttackWasOppCatch) {
                    oppSwapEndTimeMs = 0L
                }
                lastOppSwitchWasFaint = true
                oppSwitchConfirmedAlive = true
                oppSwitchAliveFrames = 0
                val faintedName = detectedOpponents.getOrNull(targetFaintSlot)?.let { formatOpponentNameWithShadow(it) } ?: "Opponent"
                val lastIdx = battleTimelineEvents.indexOfLast { it.actor == "opp" && it.type == "SWAP" }
                if (lastIdx >= 0) {
                    val ev = battleTimelineEvents[lastIdx]
                    battleTimelineEvents[lastIdx] = ev.copy(type = "FAINT", pokemonFainted = ev.pokemonOut ?: faintedName)
                    syncRecentUnshieldedChargedAttackOnFaint("opp", ev.t)
                }
                changed = true
                showBattleToast("💀 Opp Faint Swap: $faintedName → $activeOpponentName")
            } else if (!lastOppSwitchWasFaint && !oppSwitchConfirmedAlive && debouncedOppBalls >= oppPreSwitchBallCount) {
                oppSwitchAliveFrames++
                if (oppSwitchAliveFrames >= 2) {
                    oppSwitchConfirmedAlive = true
                }
            }
        }

        // Enforce 0% HP invariant on all fainted slots
        for (i in 0..2) {
            if (playerFaintedSlots[i] && playerSlotHpPct[i] != 0) {
                playerSlotHpPct[i] = 0
                changed = true
            }
            if (oppFaintedSlots[i] && oppSlotHpPct[i] != 0) {
                oppSlotHpPct[i] = 0
                changed = true
            }
        }

        if (changed) {
            recalculateAndPushBattleData()
        }
    }

    /**
     * Evaluates a single OCR line against a specific player TeamMember slot using the same
     * 5-variant OCR confusable normalization (1->i/l, 0->o, rn->m, v->y, vv->w) as opponent OCR.
     * Returns a match quality score where LOWER is better:
     *   0 = Exact or confusable-normalized species match (e.g., "Swampert" or "Swarnpert" -> "swampert")
     *   1 = 1-character Levenshtein edit distance OR 5+ character normalized prefix match
     *   2 = 2-character Levenshtein edit distance (for species length >= 6 and token length >= 5)
     *   null = No match
     */
    internal fun scoreTeamMemberOnLine(lineText: String, slot: TeamMember): Int? {
        val cleaned = lineText
            .replace(Regex("(?i)cp\\s*\\d+"), " ")
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|lv|level|vs|party|parties|battle|battles|league|schedule|rank|rating|rewards|reward|train|training|season|current)\\b"), " ")
            .replace(Regex("\\d{2,}"), " ")
            .replace(Regex("\\b\\d+\\b"), " ")
            .replace(Regex("[^a-zA-Z0-9\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null
        if (isIgnoredMenuToken(cleaned)) return null

        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 && !isIgnoredMenuToken(it) }
        if (tokens.isEmpty()) return null
        val filteredCleaned = tokens.joinToString(" ")
        val lowerCleaned = filteredCleaned.lowercase()

        val normCleanedVariants = listOf(
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = true),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = true)
        ).filter { it.isNotEmpty() && !isIgnoredMenuToken(it) }.distinct()

        val speciesBase = FormResolver.extractBaseSpecies(slot.name).lowercase()
        val target = normalizeOcrToken(speciesBase)
        if (target.length < 3) return null

        val hasMewtwoIndicator = normCleanedVariants.any { it.contains("mewt") || it.contains("mewtw") } ||
            lowerCleaned.contains("mewt")

        if (target == "mew") {
            if (hasMewtwoIndicator) return null
            val hasExactMew = tokens.any { tok ->
                val n1 = normalizeOcrToken(tok, oneAsL = false, rnAsM = false, vAsY = false)
                val n2 = normalizeOcrToken(tok, oneAsL = false, rnAsM = true, vAsY = false)
                n1 == "mew" || n2 == "mew"
            }
            return if (hasExactMew) 0 else null
        }
        if (target == "mewtwo") {
            return if (hasMewtwoIndicator) 0 else null
        }

        // Tier 0: Exact or confusable-normalized substring / token match (distance 0)
        if (target.length >= 4 && (lowerCleaned.contains(speciesBase) || normCleanedVariants.any { it.contains(target) })) {
            return 0
        }

        var bestFuzzyScore: Int? = null

        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 3 && !isIgnoredMenuToken(it) }.distinct()

            if (speciesBase.equals(token, ignoreCase = true) || tokenNorms.any { it == target }) {
                return 0
            }

            for (normTok in tokenNorms) {
                if (normTok.length < 4) continue

                // Tier 1: 5+ char prefix match (for partially clipped names) or edit distance 1
                if (target.length >= 5 && normTok.length >= 5 && (target.startsWith(normTok) || normTok.startsWith(target))) {
                    bestFuzzyScore = if (bestFuzzyScore == null) 1 else min(bestFuzzyScore, 1)
                    continue
                }

                val lenDiff = kotlin.math.abs(target.length - normTok.length)
                if (lenDiff <= 1) {
                    val dist = levenshteinDistance(normTok, target)
                    if (dist == 1) {
                        bestFuzzyScore = if (bestFuzzyScore == null) 1 else min(bestFuzzyScore, 1)
                        continue
                    }
                }

                // Sliding window check if trailing type icon / CP character got glued to the token
                if (normTok.length > target.length && target.length >= 5 && normTok.length <= target.length + 4) {
                    val sub = normTok.substring(0, target.length)
                    if (!isIgnoredMenuToken(sub)) {
                        val subDist = levenshteinDistance(sub, target)
                        if (subDist == 0) return 0
                        if (subDist == 1) {
                            bestFuzzyScore = if (bestFuzzyScore == null) 1 else min(bestFuzzyScore, 1)
                            continue
                        }
                    }
                }

                // Tier 2: Edit distance 2 (when species length >= 6 and token length >= 5)
                if (target.length >= 6 && normTok.length >= 5 && lenDiff <= 2) {
                    val dist = levenshteinDistance(normTok, target)
                    if (dist == 2) {
                        bestFuzzyScore = if (bestFuzzyScore == null) 2 else min(bestFuzzyScore, 2)
                    }
                }
            }
        }

        return bestFuzzyScore
    }

    /**
     * Detects player switches automatically via Top-Left Player Nameplate OR Bottom Charged Move buttons.
     * Evaluates ALL 3 team Pokémon simultaneously across all lines to find the strictly best match
     * (rather than checking one Pokémon at a time starting from the Lead, or matching shared CPs like 2499).
     */
    internal fun handlePlayerSwitchLines(playerTopLines: List<Text.Line>, playerMoveLines: List<Text.Line>) {
        val preset = currentPreset ?: return
        if (preset.pokemon.isEmpty()) return

        // 0. v3.34: Detect "Switch in a new Pokémon?" Post-Faint Prompt in bottom region (0.70h..0.95h)
        if (!isWaitingForOpponent && playerMoveLines.isNotEmpty()) {
            val combinedBottomLower = playerMoveLines.joinToString(" ") { it.text.lowercase() }
            val hasSwitchPromptHeader = combinedBottomLower.contains("switch in a new") ||
                combinedBottomLower.contains("switch in a") ||
                combinedBottomLower.contains("new pokemon") ||
                combinedBottomLower.contains("new pokémon")

            // Also check if 2 distinct alive bench species names appear simultaneously in the bottom card area
            val curActiveIdx = preset.pokemon.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }.coerceAtLeast(0)
            val benchMatchedSlots = mutableSetOf<Int>()
            for (line in playerMoveLines) {
                val text = line.text.trim()
                if (text.length < 3) continue
                for ((slotIdx, slot) in preset.pokemon.withIndex()) {
                    if (slotIdx == curActiveIdx || playerFaintedSlots[slotIdx]) continue
                    val score = scoreTeamMemberOnLine(text, slot)
                    if (score != null && score <= 1) {
                        benchMatchedSlots.add(slotIdx)
                    }
                }
            }

            if (hasSwitchPromptHeader || benchMatchedSlots.size >= 2) {
                if (!isPostFaintSwitchPromptActive) {
                    isPostFaintSwitchPromptActive = true
                    if (curActiveIdx in 0..2 && !playerFaintedSlots[curActiveIdx]) {
                        playerFaintedSlots[curActiveIdx] = true
                        playerSlotHpPct[curActiveIdx] = 0
                        playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
                    }
                    lastPlayerSwitchWasFaint = true
                    val faintedMon = preset.pokemon.getOrNull(curActiveIdx)?.name ?: activeUserPokemonName
                    val nowMs = currentFrameTimestampMs.takeIf { it > 0L } ?: System.currentTimeMillis()
                    val playerRemSec = if (playerSwapEndTimeMs > nowMs) ceil((playerSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
                    val oppRemSec = if (oppSwapEndTimeMs > nowMs) ceil((oppSwapEndTimeMs - nowMs) / 1000.0).toInt() else 0
                    recalculateAndPushBattleData()
                    val faintedElSec = getElapsedBattleSeconds(nowMs)
                    battleTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "POST_FAINT_PROMPT",
                            actor = "user",
                            t = faintedElSec,
                            pokemonFainted = faintedMon,
                            pokemonOut = faintedMon,
                            userShieldsRemaining = playerShieldsRemaining,
                            oppShieldsRemaining = oppShieldsRemaining,
                            recommendedAction = lastRecommendedAction.ifEmpty { null },
                            recommendedGoal = lastRecommendedGoal.ifEmpty { null },
                            decisionPhase = "POST_FAINT_SWAP",
                            recommendedTargetPokemon = if (lastRecommendedSwapSlotIdx in 0..2) preset.pokemon.getOrNull(lastRecommendedSwapSlotIdx)?.name else null,
                            playerSwapRemainingSec = playerRemSec,
                            oppSwapRemainingSec = oppRemSec,
                            userAliveCount = playerPokeballCount,
                            oppAliveCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3),
                            lastPlayerSwitchWasFaint = true,
                            lastOppSwitchWasFaint = lastOppSwitchWasFaint,
                            candidateScores = lastRecommendedCandidateScores.takeIf { it.isNotEmpty() }
                        )
                    )
                    syncRecentUnshieldedChargedAttackOnFaint("user", faintedElSec)
                    showBattleToast("⚡ Switch Prompt Detected — See SEND IN Recommendation!")
                }
                return
            }
        }

        // 1. Evaluate Top-Left Player Nameplate lines across ALL 3 team slots simultaneously
        val candidateTopLines = playerTopLines
            .filter { line ->
                val t = line.text.trim()
                if (t.length < 3) return@filter false
                if (isIgnoredMenuToken(t)) return@filter false
                val norm = normalizeOcrToken(t)
                if (norm == "battle" || norm == "party") return@filter false
                true
            }
            .sortedBy { it.boundingBox?.top ?: 0 }

        val scannedPlayerCpNow = extractCpFromOcrLines(playerTopLines)
        if (scannedPlayerCpNow != null) {
            val curActiveIdxForCp = preset.pokemon.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }.coerceAtLeast(0)
            if (curActiveIdxForCp in 0..2 && playerSlotCp[curActiveIdxForCp] != scannedPlayerCpNow) {
                playerSlotCp[curActiveIdxForCp] = scannedPlayerCpNow
            }
        }

        // Score every team slot across all valid top lines and find each slot's best (lowest) score
        val slotBestScores = mutableMapOf<Int, Int>()
        for (line in candidateTopLines) {
            val lineText = line.text.trim()
            val lineScores = mutableMapOf<Int, Int>()
            for ((slotIdx, slot) in preset.pokemon.withIndex()) {
                val score = scoreTeamMemberOnLine(lineText, slot)
                if (score != null) {
                    lineScores[slotIdx] = score
                }
            }
            if (lineScores.isNotEmpty()) {
                val minLineScore = lineScores.values.minOrNull()!!
                val bestOnLine = lineScores.filterValues { it == minLineScore }.keys
                if (bestOnLine.size == 1) {
                    val winIdx = bestOnLine.first()
                    val prevBest = slotBestScores[winIdx]
                    if (prevBest == null || minLineScore < prevBest) {
                        slotBestScores[winIdx] = minLineScore
                    }
                } else if (minLineScore == 0) {
                    val longestIdx = bestOnLine.maxByOrNull { idx ->
                        FormResolver.extractBaseSpecies(preset.pokemon[idx].name).length
                    }
                    if (longestIdx != null) {
                        val prevBest = slotBestScores[longestIdx]
                        if (prevBest == null || 0 < prevBest) {
                            slotBestScores[longestIdx] = 0
                        }
                    }
                }
            }
        }

        if (slotBestScores.isNotEmpty()) {
            val bestScore = slotBestScores.values.minOrNull()!!
            val winningSlots = slotBestScores.filterValues { it == bestScore }.keys.toList()
            if (winningSlots.size == 1) {
                val winningSlot = preset.pokemon[winningSlots[0]]
                executePlayerSwitch(winningSlot.name, fromOcrFrame = true)
                return
            }
        }

        // Unique-CP fallback ONLY if no species name matched above AND the detected CP belongs to exactly 1 slot on the team
        for (line in candidateTopLines) {
            val cpMatch = Regex("(?i)\\bcp\\s*(\\d{3,4})\\b").find(line.text)
            val detectedCp = cpMatch?.groupValues?.getOrNull(1)?.toIntOrNull() ?: continue
            val matchingSlots = preset.pokemon.filter { it.cp == detectedCp }
            if (matchingSlots.size == 1) {
                executePlayerSwitch(matchingSlots[0].name, fromOcrFrame = true)
                return
            }
        }

        // 2. Check Bottom Charged Move Buttons across all bottom move lines (ONLY when Charge Move Circles are visible or pre-battle)
        val canReadBottomMoveButtons = sampledLeftChargeBtnFillPct in 0..300 ||
            sampledRightChargeBtnFillPct in 0..300 ||
            isWaitingForOpponent
        val validMoveLines = if (canReadBottomMoveButtons) {
            playerMoveLines.filter { it.text.trim().length >= 3 }
        } else {
            emptyList()
        }
        if (validMoveLines.isNotEmpty()) {
            val combinedBottomNorm = validMoveLines.joinToString(" ") { normalizeOcrToken(it.text, rnAsM = true) }
            val combinedBottomLower = validMoveLines.joinToString(" ") { it.text.lowercase() }

            var bestSlot: TeamMember? = null
            var bestScore = 0
            var secondBestScore = 0

            for (slot in preset.pokemon) {
                val meta = getPokemonMeta(slot.name)
                val candidateMoves = listOf(
                    slot.chargedMove1,
                    slot.chargedMove2,
                    meta.chargedMove1,
                    meta.chargedMove2,
                    meta.chargedMove3,
                    meta.chargedMove4
                )
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .distinct()

                var score = 0
                for (move in candidateMoves) {
                    val normMove = normalizeOcrToken(move, rnAsM = true)
                    if (normMove.length >= 4 && combinedBottomNorm.contains(normMove)) {
                        score += 3
                    } else {
                        val words = move.lowercase().split(" ").filter {
                            it.length >= 4 && it != "attack" && it != "ball" && it != "wave" && it != "beam" && it != "punch" && it != "pulse"
                        }
                        for (w in words) {
                            if (combinedBottomLower.contains(w)) {
                                score += 1
                            }
                        }
                    }
                }

                if (score > bestScore) {
                    secondBestScore = bestScore
                    bestScore = score
                    bestSlot = slot
                } else if (score == bestScore && score > 0) {
                    secondBestScore = score
                } else if (score > secondBestScore) {
                    secondBestScore = score
                }
            }

            if (bestSlot != null && bestScore >= 3 && bestScore > secondBestScore) {
                executePlayerSwitch(bestSlot.name, fromOcrFrame = true)
                return
            }
        }

        if (!playerSwitchValidityLatched && (currentFrameTimestampMs - lastPlayerSwitchFrameMs) >= 1400L) {
            playerSwitchValidityLatched = true
            provisionalPlayerPrevName = ""
            recalculateAndPushBattleData()
        }
    }

    /**
     * ACTION: RESET OPPONENT (Start New Battle)
     * Clears opponent team & manual form/shadow overrides while keeping 1 Hz OCR continuously active
     */
    @Volatile internal var lastSwapHapticAlertEpochMs: Long = 0L
    @Volatile internal var lastChargeWarnHapticKey: String = ""

    fun startNewBattle() {
        // Snapshot opponents and lead matchup before clearing, so if the user taps
        // "Start Battle" (which immediately empties the matrix) and then taps "Win" or "Loss",
        // the battle log still records the opponents from the battle that just ended.
        if (detectedOpponents.isNotEmpty()) {
            lastClearedOpponentsSnapshot = detectedOpponents.take(3).map { oppName ->
                formatOpponentNameWithShadow(oppName)
            }
            lastClearedLeadMatchupSnapshot = currentLeadMatchup
            lastClearedTimelineEventsSnapshot = battleTimelineEvents.toList()
            lastClearedSensorTicksSnapshot = currentBattleSensorTicks.toList()
            lastClearedBattleDurationSec = getElapsedBattleSeconds()
            lastClearedUserFaints = playerFaintedSlots.count { it }
            lastClearedOppFaints = oppFaintedSlots.count { it }
            lastClearedUserShieldsRemaining = playerShieldsRemaining
            lastClearedOppShieldsRemaining = oppShieldsRemaining
        }

        battleResetEpoch++
        lastBattleResetTimeMs = System.currentTimeMillis()
        synchronized(captureLock) {
            try {
                var img = imageReader?.acquireLatestImage()
                while (img != null) {
                    img.close()
                    img = imageReader?.acquireLatestImage()
                }
            } catch (_: Exception) {}
            cachedScreenBitmap?.recycle()
            cachedScreenBitmap = null
        }

        detectedOpponents.clear()
        manualFormOverrides.clear()
        manualShadowOverrides.clear()
        manualLeadMatchupOverride = null
        currentLeadMatchup = "NEUTRAL"
        isWaitingForOpponent = true
        isBattleActive = true
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0
        activeUserPokemonName = currentPreset?.pokemon?.firstOrNull()?.name ?: activeUserPokemonName

        // Phase 2: Reset Clock Anchor (t_0) & Timeline Event Logger
        battleClockAnchorMs = 0L
        battleTimelineEvents.clear()

        // v2.34: Reset Swap Clocks, Shields, Pokéball Faint state & post-switch verification state
        playerSwapEndTimeMs = 0L
        oppSwapEndTimeMs = 0L
        lastSwapHapticAlertEpochMs = 0L
        lastChargeWarnHapticKey = ""
        playerPokeballCount = 3
        oppPokeballCount = 3
        playerShieldsRemaining = 2
        oppShieldsRemaining = 2
        sampledPlayerBalls = 3
        sampledOppBalls = 3
        prevValidPlayerBalls = 3
        prevValidOppBalls = 3
        sampledPlayerShields = 2
        sampledOppShields = 2
        playerFaintedSlots.fill(false)
        oppFaintedSlots.fill(false)
        isPlayerTurnOne = true
        isOppTurnOne = true
        prevFrameTimestampMs = 0L
        currentFrameTimestampMs = 0L
        lastPlayerSwitchTimeMs = 0L
        lastOppSwitchTimeMs = 0L
        lastPlayerSwitchFrameMs = 0L
        lastOppSwitchFrameMs = 0L
        lastPlayerPrevSlotIdx = -1
        lastOppPrevSlotIdx = -1
        lastPlayerSwitchWasFaint = false
        lastOppSwitchWasFaint = false
        playerPreSwitchBallCount = 3
        oppPreSwitchBallCount = 3
        playerSwapEndTimeBeforeSwitch = 0L
        oppSwapEndTimeBeforeSwitch = 0L
        playerPostSwitchLowBallFrames = 0
        oppPostSwitchLowBallFrames = 0
        lastObservedLowPlayerBalls = 3
        lastObservedLowPlayerBallsTimeMs = 0L
        lastObservedLowOppBalls = 3
        lastObservedLowOppBallsTimeMs = 0L
        playerSwitchConfirmedAlive = true
        oppSwitchConfirmedAlive = true
        playerSwitchAliveFrames = 0
        oppSwitchAliveFrames = 0
        playerShieldDropFrames = 0
        oppShieldDropFrames = 0
        playerShieldRestoreFrames = 0
        oppShieldRestoreFrames = 0
        isAllCombatHudGone = false
        debouncedPlayerBalls = 3
        debouncedOppBalls = 3
        playerBallCandidate = 3
        playerBallConfirmFrames = 0
        oppBallCandidate = 3
        oppBallConfirmFrames = 0
        combatHudStableFrames = 0
        combatHudGoneFrames = 0
        lastPlayerShieldDecrementChargeStartMs = 0L
        lastOppShieldDecrementChargeStartMs = 0L
        lastConfirmedPlayerFrameTimeMs = 0L
        lastConfirmedOppFrameTimeMs = 0L
        playerSwitchValidityLatched = true
        oppSwitchValidityLatched = true
        provisionalOppPrevName = ""
        provisionalOppPrevSpecies = ""
        provisionalOppPrevWasAddedToDetected = false
        provisionalPlayerPrevName = ""
        isPostFaintSwitchPromptActive = false
        playerSlotHpPct.fill(100)
        oppSlotHpPct.fill(100)
        confirmedPlayerSlotHpPct.fill(100)
        confirmedOppSlotHpPct.fill(100)
        pendingConfirmPlayerSlotHpPct.fill(100)
        pendingConfirmOppSlotHpPct.fill(100)
        playerSlotHpConfirmFrames.fill(2)
        oppSlotHpConfirmFrames.fill(2)
        playerSlotPreFaintHpPct.fill(100)
        oppSlotPreFaintHpPct.fill(100)
        playerSlotPriorHpPct.fill(100)
        oppSlotPriorHpPct.fill(100)
        oppSlotLowestHpPct.fill(100)
        playerSlotLastBigJumpMs.fill(0L)
        oppSlotLastBigJumpMs.fill(0L)
        pendingChargedAttackOppSlotIdx = -1
        pendingChargedAttackUserSlotIdx = -1
        pendingChargedAttackOppRawName = ""
        pendingChargedAttackOppShadow = false
        lastOppChargedAttackerSlotIdx = -1
        lastOppChargedAttackerRawName = ""
        lastOppChargedAttackerShadow = false
        pendingChargedAttackPreUserSlotHp.fill(100)
        pendingChargedAttackPreOppSlotHp.fill(100)
        pendingChargedAttackPreOppBalls = 3
        pendingChargedAttackPreUserBalls = 3
        pendingChargedAttackWasOppCatch = false
        lastNormalCombatOppSlotIdx = 0
        lastNormalCombatUserSlotIdx = 0
        lastNormalCombatOppRawName = ""
        lastNormalCombatOppShadow = false
        playerSlotEnergy.fill(0)
        oppSlotEnergy.fill(0)
        playerSlotCp.fill(0)
        oppSlotCp.fill(0)
        autoEndCandidateResult = ""
        autoEndCandidateFrames = 0
        lastLoggedBattleId = ""
        lastLoggedBattleWasAuto = false
        playerSlotTurnsOnField.fill(0)
        oppSlotTurnsOnField.fill(0)
        playerSlotCurrentMoveTurns.fill(0)
        oppSlotCurrentMoveTurns.fill(0)
        predictedPlayerSlotHpPct.fill(100)
        predictedOppSlotHpPct.fill(100)
        lastScannedPlayerSlotHpPct.fill(100)
        lastScannedOppSlotHpPct.fill(100)
        playerLastFastCreditedAtMs.fill(0L)
        oppLastFastCreditedAtMs.fill(0L)
        oppCreditedByOptimalTimerAtMs.fill(0L)
        sampledLeftChargeBtnFillPct = -1
        sampledRightChargeBtnFillPct = -1
        // v3.85: Lock Charge Move Circle baseline to 0% empty at battle start and reset Kalman Filter & phase-locked auto-increment
        lastScannedLeftChargeFillPct.fill(0)
        lastScannedRightChargeFillPct.fill(0)
        pendingConfirmLeftChargeFillPct.fill(0)
        pendingConfirmRightChargeFillPct.fill(0)
        leftChargeFillConfirmFrames.fill(0)
        rightChargeFillConfirmFrames.fill(0)
        leftChargeFillDebounceStartMs.fill(0L)
        rightChargeFillDebounceStartMs.fill(0L)
        for (slotIdx in 0..2) {
            playerSlotEnergyAnchor[slotIdx] = 0
            nearCeilingStepStartMs[slotIdx] = 0L
            playerSlotCeilingLatched100[slotIdx] = false
            resetSlotEnergyTracking(slotIdx, 0)
        }
        pendingChargedAttackPreOppEnergy = 0
        shieldHexagonSeenDuringPrompt = false
        lastAttackIncomingOcrDetectedMs = 0L
        hideShieldDecisionOverlay()
        playerAutoIncrementAnchorMs.fill(0L)
        playerLastSelfCorrectionAtMs.fill(0L)
        pllValidatedThisShieldDelay = false
        prescanCircleCalibrated = false
        prescanCalibConfirmFrames = 0
        isCountdownDimmedState = false
        prescanAccumLeftCxSum = 0.0
        prescanAccumRightCxSum = 0.0
        prescanAccumSingleCxSum = 0.0
        prescanAccumLeftCount = 0
        prescanAccumRightCount = 0
        prescanAccumSingleCount = 0
        prescanAccumCySum = 0.0
        prescanAccumYTopSum = 0.0
        prescanAccumYBotSum = 0.0
        prescanAccumEmptyLumaLeftSum = 0.0
        prescanAccumEmptySatLeftSum = 0.0
        prescanAccumEmptyLumaRightSum = 0.0
        prescanAccumEmptySatRightSum = 0.0
        lastMicroCorrectionTimeMs = 0L
        missingBottomCirclesWithOppHpFrames = 0
        playerSlotEverOnField[0] = true
        playerSlotEverOnField[1] = false
        playerSlotEverOnField[2] = false
        phaseStartPlayerEnergy = 0
        confirmedPhasePlayerTurns = 0
        lastConfirmedPlayerFastMoveMs = 0L
        isPlayerInIdleFallback = false
        lastIdleFallbackOppCreditMs = 0L
        lastDetectedBannerMoveName = ""
        lastDetectedBannerMoveActor = ""
        lastDetectedBannerMoveOppSlotIdx = -1
        lastDetectedBannerMoveUserSlotIdx = -1
        lastDetectedBannerMoveTimeMs = 0L
        preChargePlayerHpJumpHint = false
        preChargeOppHpJumpHint = false
        preChargePlayerHpJumpNewHp = -1
        preChargeOppHpJumpNewHp = -1
        preChargePlayerHpJumpMs = 0L
        preChargeOppHpJumpMs = 0L
        lastPostThrowSwapRollbackChargeMs = 0L
        currentBattleSensorTicks.clear()
        for (i in 0..2) {
            confirmedOppChargedMoves[i].clear()
            detectedOppFastMoveOverride[i] = ""
            oppFastMoveStatus[i] = "unconfirmed"
            oppFastMoveConfirmed[i] = false
            oppCumulativeFastDmgPct[i] = 0
        }
        preChargeLeftFillPct = 0
        preChargeRightFillPct = 0
        preChargeUserEnergy = 0
        lastStableNormalCombatEnergy = 0
        prevStableNormalCombatEnergy = 0
        lastStableLeftChargeFillPct = 0
        lastStableRightChargeFillPct = 0
        prevStableLeftChargeFillPct = 0
        prevStableRightChargeFillPct = 0
        lastStableNormalCombatMs = 0L
        hadShieldPromptBeforeCurrentCharge = false
        lastChargedPromptActor = ""
        lastChargedPromptTimeMs = 0L
        awaitingPostUserChargeCircleSync = false
        lastUserChargeResolvedMoveName = ""
        lastUserChargeWasBannerOcr = false
        lastUserChargePreEnergySnapshot = 0
        lastUserChargeDeductedEnergySnapshot = 0
        lastOppChargeDeductedEnergySnapshot = 0
        sampledOppHasPendingDmg = false
        sampledPlayerHasPendingDmg = false
        sampledOppPendingDmgPct = 0
        sampledPlayerPendingDmgPct = 0
        turnPhaseAnchorMs = 0L
        lastCaptureStartMs = 0L
        lastHpScanTickMs = 0L
        lastOcrStartMs = 0L
        cachedOcrOppLines = emptyList()
        cachedOcrPlayerTopLines = emptyList()
        cachedOcrPlayerMoveLines = emptyList()
        cachedOcrMidBannerLines = emptyList()
        if (currentBattleScanCount > 0) {
            lastBattleAvgScanMs = (currentBattleScanDurationSumMs / currentBattleScanCount).coerceAtLeast(1L)
        }
        if (currentBattleHpScanCount > 0) {
            lastBattleAvgHpScanMs = (currentBattleHpScanDurationSumMs / currentBattleHpScanCount).coerceAtLeast(1L)
        }
        currentBattleScanDurationSumMs = 0L
        currentBattleScanCount = 0
        lastScanDurationMs = 0L
        currentBattleHpScanDurationSumMs = 0L
        currentBattleHpScanCount = 0
        lastHpScanDurationMs = 0L
        postUserChargedMissingOppHpFrames = 0
        postOppChargedMissingPlayerHpFrames = 0
        hasBattleStarted = false
        phasePlayerTurns = 0
        phaseOppTurns = 0
        battleTurnIndex = 0
        scanTurnOffsetMs = 0L
        lastTurnTickTimeMs = 0L
        turnResidualMs = 0L
        lastFrameWasNormalFastCombat = false
        needsPostSwapOrMoveTurnReindex = false
        pendingPlayerLowHpSlot = -1
        pendingPlayerLowHpSample = -1
        pendingOppLowHpSlot = -1
        pendingOppLowHpSample = -1
        sampledPlayerHpPct = -1
        sampledOppHpPct = -1
        oppFinalMissingHpFrames = 0
        playerFinalMissingHpFrames = 0
        sampledShieldHexagonVisible = false
        shieldHexagonConfirmFrames = 0
        sampledTopCountdownCircleVisible = false
        topCountdownCircleConfirmFrames = 0
        topCountdownCircleMissingFrames = 0
        isTopCountdownCircleActive = false
        shieldOverlayShowConfirmFrames = 0
        lastShieldOverlayConfirmFrameMs = 0L
        sampledTopRightNameplateVisible = false
        lastOppChargeHpInferredMoveName = ""
        isAttackIncomingPromptActive = false
        attackIncomingDetectedAtMs = 0L
        pendingChargedAttackActor = ""
        pendingChargedAttackStartMs = 0L
        pendingChargedAttackDeductedEnergy = 0
        pendingChargedAttackHudThumbB64 = null
        missingBothHpBarsFrames = 0
        missingTopBallsWithHpBarsFrames = 0
        lastSteadyMoveButtonsSeenMs = 0L
        lastChargedAttackLoggedMs = 0L
        lastChargedAttackLoggedActor = ""
        lastUserChargedAttackLoggedMs = 0L
        lastUserChargedPreOppHp = 100
        lastUserChargedDefenderOppSlotIdx = -1
        lastUserChargedWasProvisionalShield = false
        lastUserChargedAutoDecrementedShield = false
        lastOppChargedAttackLoggedMs = 0L
        lastOppChargedPreUserHp = 100
        lastOppChargedDefenderUserSlotIdx = -1
        lastOppChargedWasProvisionalShield = false
        lastOppChargedAutoDecrementedShield = false
        lastDetectedBlockedBannerMs = 0L
        lastDetectedDisguiseBustedBannerMs = 0L
        recentStableReadyEnergy.fill(0)
        recentStableReadyEnergyMs.fill(0L)
        circleBelowCostStableFrames.fill(0)
        lastSlotKoTimeMs.fill(0L)
        lastUserSlotKoTimeMs.fill(0L)
        postChargeCirclesReturnedAtMs = 0L
        lastUserChargedMoveBannerResolvedMs = 0L
        pendingUserChargeConfirmedByOcr = false
        lastRecommendedAction = ""
        lastRecommendedGoal = ""
        lastRecommendedPhase = "LEAD"
        lastRecommendedSwapSlotIdx = -1
        lastRecommendedCandidateScores = emptyMap()
        recommendationsIssuedInBattle = 0
        recommendationsFollowedInBattle = 0

        stopBattleOcrLoop()
        startBattleOcrLoop()
        recalculateAndPushBattleData()
        showBattleToast("⚔️ Battle Started — Scanning Opponents")
    }

    /**
     * ACTION: STOP CURRENT BATTLE
     * Pauses 2 Hz / 1 Hz OCR scanning and snapshots the current battle's opponents & lead matchup
     * so the user can log Win/Loss (or skip) before starting the next battle.
     */
    fun stopCurrentBattle() {
        if (detectedOpponents.isNotEmpty()) {
            lastClearedOpponentsSnapshot = detectedOpponents.take(3).map { oppName ->
                formatOpponentNameWithShadow(oppName)
            }
            lastClearedLeadMatchupSnapshot = currentLeadMatchup
            lastClearedTimelineEventsSnapshot = battleTimelineEvents.toList()
            lastClearedSensorTicksSnapshot = currentBattleSensorTicks.toList()
            lastClearedBattleDurationSec = getElapsedBattleSeconds()
            lastClearedUserFaints = playerFaintedSlots.count { it }
            lastClearedOppFaints = oppFaintedSlots.count { it }
            lastClearedUserShieldsRemaining = playerShieldsRemaining
            lastClearedOppShieldsRemaining = oppShieldsRemaining
            lastClearedFinalUserHpPct = (0..2).map { i -> if (playerFaintedSlots[i]) 0 else playerSlotHpPct[i].coerceIn(0, 100) }
            lastClearedFinalOppHpPct = (0..2).map { i -> if (oppFaintedSlots[i]) 0 else oppSlotHpPct[i].coerceIn(0, 100) }
        }
        if (currentBattleScanCount > 0) {
            lastBattleAvgScanMs = (currentBattleScanDurationSumMs / currentBattleScanCount).coerceAtLeast(1L)
        }
        if (lastBattleAvgScanMs > 0L) {
            lastScanDurationMs = lastBattleAvgScanMs
        }
        if (currentBattleHpScanCount > 0) {
            lastBattleAvgHpScanMs = (currentBattleHpScanDurationSumMs / currentBattleHpScanCount).coerceAtLeast(1L)
        }
        if (lastBattleAvgHpScanMs > 0L) {
            lastHpScanDurationMs = lastBattleAvgHpScanMs
        }
        isBattleActive = false
        hasBattleStarted = false
        phasePlayerTurns = 0
        phaseOppTurns = 0
        isAttackIncomingPromptActive = false
        sampledTopCountdownCircleVisible = false
        topCountdownCircleConfirmFrames = 0
        topCountdownCircleMissingFrames = 0
        isTopCountdownCircleActive = false
        sampledTopRightNameplateVisible = false
        isPostFaintSwitchPromptActive = false
        pendingChargedAttackActor = ""
        pendingChargedAttackDeductedEnergy = 0
        pendingChargedAttackPreOppEnergy = 0
        pendingUserChargeConfirmedByOcr = false
        hideShieldDecisionOverlay()
        lastRecommendedAction = ""
        lastRecommendedGoal = ""
        lastRecommendedSwapSlotIdx = -1
        stopBattleOcrLoop()
        recalculateAndPushBattleData()
        showBattleToast("🛑 Battle Stopped — Log Win/Loss or Start Next")
    }

    fun logBattleResultFromOverlay(
        result: String,
        leadOverride: String?,
        ignoreAiTelemetry: Boolean = false,
        isAutoDetected: Boolean = false
    ) {
        val normalizedResult = if (result.equals("LOSS", ignoreCase = true)) "LOSS" else "WIN"
        val isWin = normalizedResult == "WIN"
        val fallbackLead = if (detectedOpponents.isNotEmpty()) currentLeadMatchup else lastClearedLeadMatchupSnapshot
        val resolvedLead = (leadOverride?.takeIf { it.isNotBlank() } ?: fallbackLead).uppercase()
        currentLeadMatchup = resolvedLead

        val preset = currentPreset
        val league = preset?.league ?: "GREAT LEAGUE"
        val teamName = preset?.name ?: "Active Team"
        val presetId = preset?.id ?: ""
        val userMons = preset?.pokemon?.map { it.name } ?: emptyList()

        val hasLiveOpponents = detectedOpponents.isNotEmpty()
        val formattedOpponents = if (hasLiveOpponents) {
            detectedOpponents.take(3).map { oppName ->
                formatOpponentNameWithShadow(oppName)
            }
        } else {
            lastClearedOpponentsSnapshot
        }

        val finalTimelineEvents = (if (hasLiveOpponents || battleTimelineEvents.isNotEmpty()) {
            battleTimelineEvents.toList()
        } else {
            lastClearedTimelineEventsSnapshot
        }).toMutableList()

        val durationSec = if (battleClockAnchorMs > 0L) {
            getElapsedBattleSeconds()
        } else {
            lastClearedBattleDurationSec
        }

        val endUserShields = if (hasLiveOpponents) playerShieldsRemaining else lastClearedUserShieldsRemaining
        val endOppShields = if (hasLiveOpponents) oppShieldsRemaining else lastClearedOppShieldsRemaining

        val slotUserFaints = if (hasLiveOpponents) playerFaintedSlots.count { it } else lastClearedUserFaints
        val slotOppFaints = if (hasLiveOpponents) oppFaintedSlots.count { it } else lastClearedOppFaints

        val timelineUserFaints = finalTimelineEvents.count { it.type.equals("FAINT", ignoreCase = true) && it.actor.equals("user", ignoreCase = true) }
        val timelineOppFaints = finalTimelineEvents.count { it.type.equals("FAINT", ignoreCase = true) && it.actor.equals("opp", ignoreCase = true) }

        val resolvedUserFaints = max(slotUserFaints, timelineUserFaints).coerceIn(0, 3)
        val resolvedOppFaints = max(slotOppFaints, timelineOppFaints).coerceIn(0, 3)

        // If timeline tracking was active, record the match-ending knockout at t_total if not already logged
        val finalUserFaints: Int
        val finalOppFaints: Int
        if (finalTimelineEvents.isNotEmpty() || (durationSec != null && durationSec > 0.0)) {
            val endT = durationSec ?: (finalTimelineEvents.maxOfOrNull { it.t } ?: 0.0)
            if (isWin && resolvedOppFaints < 3) {
                val activeOppMon = if (activeOpponentName != "Waiting...") {
                    formatOpponentNameWithShadow(activeOpponentName)
                } else {
                    formattedOpponents.lastOrNull().orEmpty()
                }
                if (activeOppMon.isNotEmpty()) {
                    // v6.04: Sync any match-ending unshielded player charged attack to 0% HP (eliminating victory-pose upward HP spikes)
                    syncRecentUnshieldedChargedAttackOnFaintInList(
                        events = finalTimelineEvents,
                        faintedActor = "opp",
                        eventElapsedSec = endT
                    )
                    finalTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "FAINT",
                            actor = "opp",
                            t = endT,
                            pokemonFainted = activeOppMon,
                            pokemonOut = activeOppMon,
                            userShieldsRemaining = endUserShields,
                            oppShieldsRemaining = endOppShields
                        )
                    )
                }
                finalOppFaints = (resolvedOppFaints + 1).coerceIn(1, 3)
                finalUserFaints = resolvedUserFaints
            } else if (!isWin && resolvedUserFaints < 3) {
                val activeUserMon = activeUserPokemonName ?: userMons.firstOrNull().orEmpty()
                if (activeUserMon.isNotEmpty()) {
                    // v6.04: Sync any match-ending unshielded opponent charged attack to 0% HP
                    syncRecentUnshieldedChargedAttackOnFaintInList(
                        events = finalTimelineEvents,
                        faintedActor = "user",
                        eventElapsedSec = endT
                    )
                    finalTimelineEvents.add(
                        BattleTimelineEvent(
                            type = "FAINT",
                            actor = "user",
                            t = endT,
                            pokemonFainted = activeUserMon,
                            pokemonOut = activeUserMon,
                            userShieldsRemaining = endUserShields,
                            oppShieldsRemaining = endOppShields
                        )
                    )
                }
                finalUserFaints = (resolvedUserFaints + 1).coerceIn(1, 3)
                finalOppFaints = resolvedOppFaints
            } else {
                finalUserFaints = resolvedUserFaints
                finalOppFaints = resolvedOppFaints
            }
        } else {
            finalUserFaints = resolvedUserFaints
            finalOppFaints = resolvedOppFaints
        }

        val quality = OverlayService.calculateBattleQuality(
            myTeam = userMons,
            oppTeam = formattedOpponents,
            league = league,
            result = normalizedResult,
            myTeamSlots = preset?.pokemon,
            timelineEvents = finalTimelineEvents.takeIf { it.isNotEmpty() },
            totalDurationSec = durationSec,
            explicitUserFaints = if (formattedOpponents.isNotEmpty()) finalUserFaints else null,
            explicitOppFaints = if (formattedOpponents.isNotEmpty()) finalOppFaints else null,
            explicitUserShieldsRemaining = if (formattedOpponents.isNotEmpty()) endUserShields else null,
            explicitOppShieldsRemaining = if (formattedOpponents.isNotEmpty()) endOppShields else null
        )

        val evalEvents = finalTimelineEvents.filter { it.followedRecommendation != null }
        val recsIssued = max(recommendationsIssuedInBattle, evalEvents.size)
        val recsFollowed = max(recommendationsFollowedInBattle, evalEvents.count { it.followedRecommendation == true })
        val adherencePct = if (recsIssued > 0) ((recsFollowed * 100.0) / recsIssued.toDouble()).roundToInt().coerceIn(0, 100) else null

        val nowMs = System.currentTimeMillis()
        val battleId = "log-$nowMs-${(100..999).random()}"
        val endUserHpList = if (hasLiveOpponents) {
            (0..2).map { i -> if (playerFaintedSlots[i]) 0 else playerSlotHpPct[i].coerceIn(0, 100) }
        } else {
            lastClearedFinalUserHpPct
        }
        val endOppHpList = if (hasLiveOpponents) {
            (0..2).map { i -> if (oppFaintedSlots[i]) 0 else oppSlotHpPct[i].coerceIn(0, 100) }
        } else {
            lastClearedFinalOppHpPct
        }
        val (firstSwapActor, switchAdvantage) = OverlayService.deriveFirstSwapAndSwitchAdvantageStatic(finalTimelineEvents, normalizedResult)

        // v3.50: Main Battle Logs store compact permanent summary fields (timelineEvents = emptyList());
        // detailed timestamped timeline events are written to the separate 7-day AI Training Log store.
        val newEntry = SyncBattleLogRecord(
            id = battleId,
            timestampMs = nowMs,
            updatedAt = nowMs,
            league = league,
            presetId = presetId,
            userTeamName = teamName,
            userPokemon = userMons,
            opponents = formattedOpponents,
            leadMatchup = resolvedLead,
            result = normalizedResult,
            deviceLabel = prefs.getString(PREFS_KEY_DEVICE_LABEL, null)?.takeIf { it.isNotBlank() } ?: (Build.MODEL ?: "Android"),
            bmfScore = quality?.pPre,
            execWae = quality?.execWae,
            badges = quality?.badges ?: emptyList(),
            flags = quality?.contextualFlags ?: emptyList(),
            quality = quality,
            qualityEvaluated = true,
            timelineEvents = emptyList(),
            battleDurationSec = durationSec,
            userFaints = finalUserFaints,
            oppFaints = finalOppFaints,
            userShieldsRemaining = endUserShields,
            oppShieldsRemaining = endOppShields,
            adherenceRatePct = adherencePct,
            recommendationsIssuedCount = recsIssued,
            recommendationsFollowedCount = recsFollowed,
            finalUserHpPct = endUserHpList,
            finalOppHpPct = endOppHpList,
            firstSwapActor = firstSwapActor,
            switchAdvantage = switchAdvantage
        )

        val isShow6CombatMode = prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
        val targetBattleLogsPrefKey = if (isShow6CombatMode) PREFS_KEY_SHOW6_BATTLE_LOGS else PREFS_KEY_BATTLE_LOGS

        val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
        val existingLogs: MutableList<SyncBattleLogRecord> = try {
            gson.fromJson<List<SyncBattleLogRecord>>(prefs.getString(targetBattleLogsPrefKey, "[]"), logsType)?.toMutableList()
                ?: mutableListOf()
        } catch (_: Exception) {
            mutableListOf()
        }
        existingLogs.add(0, newEntry)

        // v5.10: Build rich AI Training & Anomaly Telemetry record and queue for GitHub `ai-telemetry-logs` upload
        OverlayService.runV510AiTelemetryMigrationAndWipeStatic(prefs)
        val userTeamSpecs = (0..2).mapNotNull { idx ->
            val slotMember = preset?.pokemon?.getOrNull(idx)
            val sName = slotMember?.name ?: userMons.getOrNull(idx) ?: return@mapNotNull null
            val sShadow = sName.contains("Shadow", ignoreCase = true)
            val sMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(sName, league, sShadow), league, slotMember?.cp, slotMember?.ivs)
            val fMove = slotMember?.fastMove?.takeIf { it.isNotBlank() } ?: sMeta.defaultFastMove
            val fTurns = OverlayService.resolveFastTurnsStatic(fMove, sMeta.fastTurns)
            val fEnergy = OverlayService.resolveFastEnergyStatic(fMove, fTurns)
            val c1Move = slotMember?.chargedMove1?.takeIf { it.isNotBlank() } ?: sMeta.chargedMove1
            val c2Move = slotMember?.chargedMove2?.takeIf { it.isNotBlank() } ?: sMeta.chargedMove2
            val c1Stats = OverlayService.resolveChargedMoveStatsStatic(c1Move, sMeta.types.firstOrNull() ?: "normal")
            val c2Stats = OverlayService.resolveChargedMoveStatsStatic(c2Move, sMeta.types.firstOrNull() ?: "normal")
            val c1Cost = (c1Stats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[c1Move] ?: 45).coerceIn(35, 100)
            val c2Cost = (c2Stats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[c2Move] ?: 55).coerceIn(35, 100)
            AiTelemetrySlotSpec(
                slotIndex = idx,
                species = sName,
                cp = slotMember?.cp,
                ivs = slotMember?.ivs,
                fastMove = fMove,
                fastTurns = fTurns,
                fastEnergy = fEnergy,
                chargedMove1 = c1Move,
                chargedMove1Energy = c1Cost,
                chargedMove2 = c2Move,
                chargedMove2Energy = c2Cost,
                finalHpPct = endUserHpList.getOrElse(idx) { 0 },
                finalEnergy = if (hasLiveOpponents) playerSlotEnergy.getOrElse(idx) { 0 } else 0,
                fainted = (endUserHpList.getOrElse(idx) { 0 } <= 0)
            )
        }
        val oppTeamSpecs = formattedOpponents.mapIndexed { idx, oppName ->
            val oppShad = oppName.contains("Shadow", ignoreCase = true)
            val oppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(oppName, league, oppShad), league)
            val fOverride = detectedOppFastMoveOverride.getOrNull(idx)?.takeIf { it.isNotBlank() }
            val fMove = fOverride ?: oppMeta.defaultFastMove
            val fTurns = OverlayService.resolveFastTurnsStatic(fMove, oppMeta.fastTurns)
            val fEnergy = OverlayService.resolveFastEnergyStatic(fMove, fTurns)
            AiTelemetryOppSlotSpec(
                slotIndex = idx,
                species = oppName,
                isShadow = oppShad,
                inferredFastMove = fMove,
                fastMoveConfirmed = oppFastMoveConfirmed.getOrElse(idx) { false },
                fastMoveStatus = oppFastMoveStatus.getOrElse(idx) { "unconfirmed" },
                fastTurns = fTurns,
                fastEnergy = fEnergy,
                confirmedChargedMoves = confirmedOppChargedMoves.getOrNull(idx)?.toList() ?: emptyList(),
                finalHpPct = endOppHpList.getOrElse(idx) { 0 },
                finalEnergy = if (hasLiveOpponents) oppSlotEnergy.getOrElse(idx) { 0 } else 0,
                fainted = (endOppHpList.getOrElse(idx) { 0 } <= 0)
            )
        }
        val detectedAnomalies = OverlayService.detectBattleAnomaliesStatic(
            league = league,
            userTeamSpecs = userTeamSpecs,
            oppTeamSpecs = oppTeamSpecs,
            timelineEvents = finalTimelineEvents
        )
        OverlayService.recordDebounceSettingsChangeIfNeededStatic(prefs, gson, "battle_logged", triggerImmediateUpload = false)
        val scannerConfigMap = OverlayService.buildDebounceAndSettlingSettingsMapStatic(
            prefs = prefs,
            scanHzMode = currentScanHzMode,
            scanTurnOffsetMs = scanTurnOffsetMs
        )
        val profileSig = OverlayService.computeDebounceSettingsProfileSignatureStatic(prefs)
        val recentSettingsChanges = OverlayService.loadPendingSettingsChangesStatic(prefs, gson).ifEmpty {
            OverlayService.loadSettingsChangeHistoryStatic(prefs, gson).takeLast(10)
        }
        val sensorTicksForShadow = if (currentBattleSensorTicks.isNotEmpty()) {
            currentBattleSensorTicks.toList()
        } else {
            lastClearedSensorTicksSnapshot
        }
        val shadowBenchmarkMap = OverlayService.evaluateShadowSettingsProfilesStatic(
            prefs = prefs,
            league = league,
            userTeamSpecs = userTeamSpecs,
            oppTeamSpecs = oppTeamSpecs,
            timelineEvents = finalTimelineEvents,
            sensorTicks = sensorTicksForShadow
        )
        val (postCutsceneAudits, energyLedger, hpEnergyDiagSummary) = OverlayService.buildEnhancedHpAndEnergyDiagnosticsStatic(
            userTeamSpecs = userTeamSpecs,
            oppTeamSpecs = oppTeamSpecs,
            timelineEvents = finalTimelineEvents,
            sensorTicks = sensorTicksForShadow
        )
        val wasDvrRecordedThisBattle = !ignoreAiTelemetry && (activeOneBattleDvrRecording || (activeOneBattleDvrArmed && activeOneBattleDvrFrames > 0))
        val githubUser = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty().ifEmpty { "anonymous" }
        val devHashForDvr = OverlayService.getDeviceTelemetryHashStatic(prefs)
        val safeUserForDvr = (githubUser.takeIf { it != "anonymous" } ?: "trainer_$devHashForDvr").replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val cleanBattleIdForDvr = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val expectedDvrVideoPath = if (wasDvrRecordedThisBattle) "recordings/$safeUserForDvr/${cleanBattleIdForDvr}_video.mp4" else null
        val expectedDvrTracePath = if (wasDvrRecordedThisBattle) "recordings/$safeUserForDvr/${cleanBattleIdForDvr}_deep_trace.jsonl" else null

        val v510Record = AiTelemetryBattleRecordV510(
            schemaVersion = APP_VERSION,
            battleId = battleId,
            timestampMs = nowMs,
            appVersion = APP_VERSION,
            uploaderHandle = githubUser,
            deviceHash = devHashForDvr,
            deviceModel = Build.MODEL ?: "Android",
            combatMode = if (isShow6CombatMode) "show6" else "gbl",
            league = league,
            teamName = teamName,
            teamArchetype = preset?.archetype ?: "ABC",
            result = normalizedResult,
            leadMatchup = resolvedLead,
            battleDurationSec = durationSec,
            bmfScore = quality?.pPre,
            execWae = quality?.execWae,
            adherenceRatePct = adherencePct,
            recommendationsIssuedCount = recsIssued,
            recommendationsFollowedCount = recsFollowed,
            firstSwapActor = firstSwapActor,
            switchAdvantage = switchAdvantage,
            userShieldsRemaining = endUserShields,
            oppShieldsRemaining = endOppShields,
            userFaints = finalUserFaints,
            oppFaints = finalOppFaints,
            scannerSettings = scannerConfigMap,
            settingsProfileSignature = profileSig,
            settingsChanges = recentSettingsChanges,
            userTeamSpecs = userTeamSpecs,
            oppTeamSpecs = oppTeamSpecs,
            anomalies = detectedAnomalies,
            anomalyCount = detectedAnomalies.size,
            hasHighSeverityAnomaly = detectedAnomalies.any { it.severity == "HIGH" },
            timelineEvents = finalTimelineEvents,
            shadowProfileBenchmark = shadowBenchmarkMap,
            postCutsceneHpAudits = postCutsceneAudits,
            energyLedger = energyLedger,
            hpAndEnergyDiagnosticsSummary = hpEnergyDiagSummary,
            dvrVideoPath = expectedDvrVideoPath,
            dvrDeepTracePath = expectedDvrTracePath
        )
        val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        pendingQueue.removeAll { it.battleId == battleId }
        if (!ignoreAiTelemetry) {
            pendingQueue.add(v510Record)
        }
        val totalAnomaliesDetected = if (!ignoreAiTelemetry) {
            prefs.getInt(PREFS_KEY_TOTAL_AI_ANOMALIES_DETECTED_COUNT, 0) + detectedAnomalies.size
        } else {
            prefs.getInt(PREFS_KEY_TOTAL_AI_ANOMALIES_DETECTED_COUNT, 0)
        }
        prefs.edit()
            .putString(targetBattleLogsPrefKey, gson.toJson(existingLogs))
            .putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue.takeLast(200)))
            .putInt(PREFS_KEY_TOTAL_AI_ANOMALIES_DETECTED_COUNT, totalAnomaliesDetected)
            .remove(PREFS_KEY_AI_TRAINING_LOGS)
            .apply()

        if (wasDvrRecordedThisBattle) {
            finalizeAndUploadOneBattleDvrAsync(battleId, v510Record)
        } else if (activeOneBattleDvrRecording) {
            abortOneBattleDvrAsync(disarm = true)
        }

        lastLoggedBattleId = battleId
        lastLoggedBattleResult = normalizedResult
        lastLoggedBattleLead = resolvedLead
        lastLoggedBattleOpponents = formattedOpponents
        lastLoggedBattleTelemetryIgnored = ignoreAiTelemetry
        lastLoggedBattleWasAuto = isAutoDetected
        lastLoggedBattleTimeMs = nowMs
        autoEndCandidateResult = ""
        autoEndCandidateFrames = 0

        // Ensure opponent list and timeline state are cleared for the next battle after logging
        lastClearedOpponentsSnapshot = emptyList()
        lastClearedLeadMatchupSnapshot = "NEUTRAL"
        lastClearedTimelineEventsSnapshot = emptyList()
        lastClearedSensorTicksSnapshot = emptyList()
        lastClearedBattleDurationSec = null
        battleClockAnchorMs = 0L
        battleTimelineEvents.clear()
        currentBattleSensorTicks.clear()
        battleResetEpoch++
        lastBattleResetTimeMs = System.currentTimeMillis()
        detectedOpponents.clear()
        manualFormOverrides.clear()
        manualShadowOverrides.clear()
        manualLeadMatchupOverride = null
        currentLeadMatchup = "NEUTRAL"
        if (currentBattleScanCount > 0) {
            lastBattleAvgScanMs = (currentBattleScanDurationSumMs / currentBattleScanCount).coerceAtLeast(1L)
        }
        if (lastBattleAvgScanMs > 0L) {
            lastScanDurationMs = lastBattleAvgScanMs
        }
        isWaitingForOpponent = true
        isBattleActive = false
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0
        stopBattleOcrLoop()
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript(
                "if (window.onBattleLoggedToast) onBattleLoggedToast('$normalizedResult', '$resolvedLead');",
                null
            )
            val leadShort = when (resolvedLead) {
                "FAVORABLE" -> "Fav Lead"
                "NEGATIVE" -> "Neg Lead"
                else -> "Neu Lead"
            }
            val autoPrefix = if (isAutoDetected) "⚡ Auto-Logged " else "✓ Logged "
            val aiNote = if (ignoreAiTelemetry) " [AI Log Ignored]" else ""
            showBattleToast("$autoPrefix$normalizedResult ($leadShort)$aiNote • ${formattedOpponents.joinToString(", ").ifEmpty { "No opponents" }}")
        }

        // Always trigger background 2-device delta sync after logging a battle
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                OverlayService.syncWithGitHubGistBlocking(prefs, gson)
            } catch (_: Exception) {}
        }
    }

    /**
     * v6.03: Automatically detects end-of-battle ("YOU WIN!", "GOOD EFFORT", "TIME'S UP!", or 3rd Pokémon KO + HUD exit)
     * and auto-logs the match result with a post-battle bar for Undo / Flip W-L / Ignore AI Telemetry.
     */
    internal fun checkAndHandleAutoEndOfBattle(
        oppLines: List<Text.Line>,
        playerTopLines: List<Text.Line>,
        playerMoveLines: List<Text.Line>,
        midBannerLines: List<Text.Line>
    ) {
        if (!isBattleActive || isWaitingForOpponent || detectedOpponents.isEmpty()) {
            autoEndCandidateResult = ""
            autoEndCandidateFrames = 0
            return
        }
        val elapsedSec = getElapsedBattleSeconds()
        if (elapsedSec < 12.0) return

        val allLines = oppLines + playerTopLines + playerMoveLines + midBannerLines
        val combinedNorm = allLines.joinToString(" ") { it.text.lowercase().replace(Regex("[^a-z0-9\\s']"), " ") }
            .replace(Regex("\\s+"), " ")
            .trim()

        val hasWinBanner = combinedNorm.contains("you win") ||
            combinedNorm.contains("victory") ||
            combinedNorm.contains("won the battle")
        val hasLossBanner = combinedNorm.contains("good effort") ||
            combinedNorm.contains("you lose") ||
            combinedNorm.contains("defeat")
        val hasTimeUpBanner = combinedNorm.contains("time's up") ||
            combinedNorm.contains("times up") ||
            combinedNorm.contains("battle tied")

        val textDetectedResult: String? = when {
            hasWinBanner -> "WIN"
            hasLossBanner -> "LOSS"
            hasTimeUpBanner -> {
                val uAlive = (3 - playerFaintedSlots.count { it }).coerceIn(0, 3)
                val oAlive = (3 - oppFaintedSlots.count { it }).coerceIn(0, 3)
                if (uAlive > oAlive) "WIN"
                else if (uAlive < oAlive) "LOSS"
                else {
                    val uHpSum = (0..2).sumOf { if (playerFaintedSlots[it]) 0 else playerSlotHpPct[it].coerceIn(0, 100) }
                    val oHpSum = (0..2).sumOf { if (oppFaintedSlots[it]) 0 else oppSlotHpPct[it].coerceIn(0, 100) }
                    if (uHpSum >= oHpSum) "WIN" else "LOSS"
                }
            }
            else -> null
        }

        // Structural 3rd-Pokémon KO + HUD exit fallback when elapsedSec >= 25s
        val structuralResult: String? = if (textDetectedResult == null && elapsedSec >= 25.0 && missingBothHpBarsFrames >= 3 && isAllCombatHudGone) {
            val activeUIdx = currentPreset?.pokemon?.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }?.takeIf { it in 0..2 } ?: 0
            val activeOIdx = detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOpponentSpecies, ignoreCase = true)
            }.takeIf { it in 0..2 } ?: 0
            val priorOppFaints = (0..2).count { it != activeOIdx && oppFaintedSlots[it] }
            val priorUserFaints = (0..2).count { it != activeUIdx && playerFaintedSlots[it] }
            val oppAllFainted = oppFaintedSlots.count { it } >= 3 ||
                (detectedOpponents.size >= 3 && priorOppFaints >= 2 && oppSlotHpPct[activeOIdx] <= 18 && playerSlotHpPct[activeUIdx] > 0)
            val userAllFainted = playerFaintedSlots.count { it } >= 3 ||
                (priorUserFaints >= 2 && playerSlotHpPct[activeUIdx] <= 18 && oppSlotHpPct[activeOIdx] > 0)
            when {
                oppAllFainted && !userAllFainted -> "WIN"
                userAllFainted && !oppAllFainted -> "LOSS"
                else -> null
            }
        } else null

        val candidate = textDetectedResult ?: structuralResult
        if (candidate != null) {
            if (autoEndCandidateResult == candidate) {
                autoEndCandidateFrames++
            } else {
                autoEndCandidateResult = candidate
                autoEndCandidateFrames = 1
            }
            val requiredFrames = if (textDetectedResult != null) 1 else 2
            if (autoEndCandidateFrames >= requiredFrames) {
                stopCurrentBattle()
                logBattleResultFromOverlay(
                    result = candidate,
                    leadOverride = currentLeadMatchup,
                    ignoreAiTelemetry = false,
                    isAutoDetected = true
                )
            }
        } else {
            autoEndCandidateResult = ""
            autoEndCandidateFrames = 0
        }
    }

    fun ignoreTelemetryForBattle(battleId: String) {
        val targetId = battleId.ifBlank { lastLoggedBattleId }
        if (targetId.isBlank()) return
        val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        val removed = pendingQueue.removeAll { it.battleId == targetId }
        if (removed) {
            prefs.edit().putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue)).apply()
        }
        if (targetId == lastLoggedBattleId) {
            lastLoggedBattleTelemetryIgnored = true
        }
        recalculateAndPushBattleData()
        showBattleToast("🚫 AI Telemetry Ignored for Battle (Win/Loss Record Kept)")
    }

    fun flipAutoLoggedBattleResult(battleId: String) {
        val targetId = battleId.ifBlank { lastLoggedBattleId }
        if (targetId.isBlank()) return
        val isShow6CombatMode = prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
        val targetBattleLogsPrefKey = if (isShow6CombatMode) PREFS_KEY_SHOW6_BATTLE_LOGS else PREFS_KEY_BATTLE_LOGS
        val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
        val existingLogs: MutableList<SyncBattleLogRecord> = try {
            gson.fromJson<List<SyncBattleLogRecord>>(prefs.getString(targetBattleLogsPrefKey, "[]"), logsType)?.toMutableList()
                ?: mutableListOf()
        } catch (_: Exception) {
            mutableListOf()
        }
        val idx = existingLogs.indexOfFirst { it.id == targetId }
        if (idx >= 0) {
            val old = existingLogs[idx]
            val flipped = if (old.result == "WIN") "LOSS" else "WIN"
            existingLogs[idx] = old.copy(result = flipped, updatedAt = System.currentTimeMillis())
            prefs.edit().putString(targetBattleLogsPrefKey, gson.toJson(existingLogs)).apply()
            if (targetId == lastLoggedBattleId) {
                lastLoggedBattleResult = flipped
            }
            val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
            val pIdx = pendingQueue.indexOfFirst { it.battleId == targetId }
            if (pIdx >= 0) {
                pendingQueue[pIdx] = pendingQueue[pIdx].copy(result = flipped)
                prefs.edit().putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue)).apply()
            }
            recalculateAndPushBattleData()
            showBattleToast("🔄 Updated Battle Result to $flipped")
        }
    }

    fun undoAutoLoggedBattle(battleId: String) {
        val targetId = battleId.ifBlank { lastLoggedBattleId }
        if (targetId.isBlank()) return
        val isShow6CombatMode = prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
        val targetBattleLogsPrefKey = if (isShow6CombatMode) PREFS_KEY_SHOW6_BATTLE_LOGS else PREFS_KEY_BATTLE_LOGS
        val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
        val existingLogs: MutableList<SyncBattleLogRecord> = try {
            gson.fromJson<List<SyncBattleLogRecord>>(prefs.getString(targetBattleLogsPrefKey, "[]"), logsType)?.toMutableList()
                ?: mutableListOf()
        } catch (_: Exception) {
            mutableListOf()
        }
        existingLogs.removeAll { it.id == targetId }
        val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        pendingQueue.removeAll { it.battleId == targetId }
        prefs.edit()
            .putString(targetBattleLogsPrefKey, gson.toJson(existingLogs))
            .putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue))
            .apply()
        if (targetId == lastLoggedBattleId) {
            lastLoggedBattleId = ""
            lastLoggedBattleWasAuto = false
        }
        recalculateAndPushBattleData()
        showBattleToast("↩️ Undid Auto-Logged Battle")
    }

    fun dismissAutoLoggedBanner() {
        lastLoggedBattleId = ""
        lastLoggedBattleWasAuto = false
        recalculateAndPushBattleData()
    }

    fun toggleShadowModifier() {
        isOpponentShadow = !isOpponentShadow
        val baseKey = activeOpponentSpecies.ifBlank { FormResolver.extractBaseSpecies(activeOpponentName) }.lowercase()
        if (baseKey.isNotBlank()) {
            manualShadowOverrides[baseKey] = isOpponentShadow
        }
        recalculateAndPushBattleData()
    }

    fun cycleActiveOpponentForm() {
        if (availableOpponentForms.size <= 1) return
        isWaitingForOpponent = false
        currentFormIndex = (currentFormIndex + 1) % availableOpponentForms.size
        val nextVariant = availableOpponentForms[currentFormIndex]
        val baseKey = nextVariant.baseSpecies.lowercase()
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        activeOpponentName = nextVariant.name
        manualFormOverrides[baseKey] = nextVariant.name

        if (!FormResolver.isShadowEligibleVariant(nextVariant)) {
            isOpponentShadow = false
            manualShadowOverrides[baseKey] = false
        } else {
            val (_, prefShad) = FormResolver.getEffectiveRankAndShadowForVariant(nextVariant, activeLeague)
            isOpponentShadow = prefShad
            manualShadowOverrides[baseKey] = prefShad
        }

        // Update existing species entry in-place (preserving 1st/2nd/3rd seen slot!)
        val existingIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(baseKey, ignoreCase = true)
        }
        if (existingIdx >= 0) {
            detectedOpponents[existingIdx] = nextVariant.name
        } else {
            upsertDetectedOpponentBySpecies(nextVariant.name, baseKey)
        }
        recalculateAndPushBattleData()
    }

    fun swapActiveOpponent(pokemonName: String) {
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val matched = getPokemonMeta(pokemonName, activeLeague)
        val newBaseSpecies = matched.baseSpecies.lowercase()
        val prevBase = activeOpponentSpecies
        val prevOppFormatted = if (!isWaitingForOpponent && activeOpponentName != "Waiting...") {
            formatOpponentNameWithShadow(activeOpponentName)
        } else ""
        val prevOppSlotIdx = if (!isWaitingForOpponent && detectedOpponents.isNotEmpty()) {
            detectedOpponents.indexOfFirst { FormResolver.extractBaseSpecies(it).equals(prevBase, ignoreCase = true) }.coerceAtLeast(0)
        } else -1

        val wasWaiting = isWaitingForOpponent
        isWaitingForOpponent = false
        activeOpponentSpecies = newBaseSpecies
        availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
        currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
        activeOpponentName = matched.name
        val (_, defaultShadowForMatched) = FormResolver.resolveBestDefaultFormAndShadow(matched, pokemonName, activeLeague)
        if (!FormResolver.isShadowEligibleVariant(matched)) {
            manualShadowOverrides[newBaseSpecies] = false
            isOpponentShadow = false
        } else if (pokemonName.contains("Shadow", ignoreCase = true)) {
            manualShadowOverrides[newBaseSpecies] = true
            isOpponentShadow = true
        } else if (!manualShadowOverrides.containsKey(newBaseSpecies)) {
            manualShadowOverrides[newBaseSpecies] = defaultShadowForMatched
            isOpponentShadow = defaultShadowForMatched
        } else {
            isOpponentShadow = manualShadowOverrides[newBaseSpecies] ?: defaultShadowForMatched
        }
        upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)
        val newOppFormatted = formatOpponentNameWithShadow(matched.name)

        val newOppSlotIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(newBaseSpecies, ignoreCase = true)
        }
        if (newOppSlotIdx in 0..2 && oppFaintedSlots[newOppSlotIdx]) {
            oppFaintedSlots[newOppSlotIdx] = false
            oppPokeballCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)
        }
        if (wasWaiting) {
            battleClockAnchorMs = System.currentTimeMillis()
            battleTimelineEvents.clear()
        } else if (!newBaseSpecies.equals(prevBase, ignoreCase = true)) {
            val nowMs = System.currentTimeMillis()
            val elapsedSec = getElapsedBattleSeconds(nowMs)
            if (prevOppSlotIdx !in 0..2 || !oppFaintedSlots[prevOppSlotIdx]) {
                oppSwapEndTimeMs = nowMs + 50000L
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "SWAP",
                        actor = "opp",
                        t = elapsedSec,
                        pokemonIn = newOppFormatted,
                        pokemonOut = prevOppFormatted.ifEmpty { null },
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining
                    )
                )
            } else {
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "FAINT",
                        actor = "opp",
                        t = elapsedSec,
                        pokemonFainted = prevOppFormatted.ifEmpty { null },
                        pokemonIn = newOppFormatted,
                        pokemonOut = prevOppFormatted.ifEmpty { null },
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining
                    )
                )
            }
        }

        recalculateAndPushBattleData()
        if (::prefs.isInitialized) {
            showBattleToast("⚔️ Active Opponent: ${matched.name}")
        }
    }

    fun selectActiveUserPokemon(pokemonName: String) {
        val preset = currentPreset
        val prevName = activeUserPokemonName
        val prevIdx = preset?.pokemon?.indexOfFirst { it.name.equals(prevName, ignoreCase = true) } ?: -1
        val newIdx = preset?.pokemon?.indexOfFirst { it.name.equals(pokemonName, ignoreCase = true) } ?: -1

        if (newIdx in 0..2 && playerFaintedSlots[newIdx]) {
            playerFaintedSlots[newIdx] = false
            playerPokeballCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
        }
        if (!isWaitingForOpponent && !pokemonName.equals(prevName, ignoreCase = true)) {
            val nowMs = System.currentTimeMillis()
            val elapsedSec = getElapsedBattleSeconds(nowMs)
            if (prevIdx !in 0..2 || !playerFaintedSlots[prevIdx]) {
                playerSwapEndTimeMs = nowMs + 50000L
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "SWAP",
                        actor = "user",
                        t = elapsedSec,
                        pokemonIn = pokemonName,
                        pokemonOut = prevName,
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining
                    )
                )
            } else {
                battleTimelineEvents.add(
                    BattleTimelineEvent(
                        type = "FAINT",
                        actor = "user",
                        t = elapsedSec,
                        pokemonFainted = prevName,
                        pokemonIn = pokemonName,
                        pokemonOut = prevName,
                        userShieldsRemaining = playerShieldsRemaining,
                        oppShieldsRemaining = oppShieldsRemaining
                    )
                )
            }
        }

        activeUserPokemonName = pokemonName
        recalculateAndPushBattleData()
        if (::prefs.isInitialized) {
            showBattleToast("Active Lead: $pokemonName")
        }
    }

    fun configureReplayState(
        preset: TeamPreset,
        opponentsList: List<String>,
        activeOppIdx: Int,
        activeUserIdx: Int,
        oppCountModeVal: String = "my_fasts",
        enable4ChargedVal: Boolean = false,
        sharedPrefs: SharedPreferences? = null
    ) {
        if (sharedPrefs != null) {
            prefs = sharedPrefs
        }
        currentPreset = preset
        oppCountMode = oppCountModeVal
        enable4ChargedMoves = enable4ChargedVal
        detectedOpponents.clear()
        manualShadowOverrides.clear()
        manualFormOverrides.clear()
        for (rawOpp in opponentsList.take(3)) {
            val isShad = rawOpp.contains("Shadow", ignoreCase = true)
            val clean = rawOpp
                .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                .trim()
            val base = FormResolver.extractBaseSpecies(clean).lowercase()
            if (isShad) {
                manualShadowOverrides[base] = true
            }
            if (clean.isNotBlank()) {
                detectedOpponents.add(clean)
            }
        }
        val validOppIdx = activeOppIdx.coerceIn(0, max(0, detectedOpponents.size - 1))
        val activeOpp = detectedOpponents.getOrNull(validOppIdx)
        if (activeOpp != null) {
            isWaitingForOpponent = false
            activeOpponentName = activeOpp
            activeOpponentSpecies = FormResolver.extractBaseSpecies(activeOpp).lowercase()
            isOpponentShadow = manualShadowOverrides[activeOpponentSpecies] ?: false
            availableOpponentForms = FormResolver.getVariantsForSpecies(activeOpponentSpecies, preset.league)
            currentFormIndex = availableOpponentForms.indexOfFirst { it.name.equals(activeOpp, ignoreCase = true) }.coerceAtLeast(0)
        } else {
            isWaitingForOpponent = true
            activeOpponentName = "Waiting..."
        }
        val validUserIdx = activeUserIdx.coerceIn(0, max(0, preset.pokemon.size - 1))
        activeUserPokemonName = preset.pokemon.getOrNull(validUserIdx)?.name ?: preset.pokemon.firstOrNull()?.name
    }

    internal fun normalizeOcrToken(input: String, oneAsL: Boolean = false, rnAsM: Boolean = false, vAsY: Boolean = false): String {
        var s = input.lowercase()
            .replace("0", "o")
            .replace("1", if (oneAsL) "l" else "i")
            .replace("!", "i")
            .replace("|", "l")
            .replace("5", "s")
            .replace("8", "b")
            .replace("2", "z")
            .replace("vv", "w")
        if (rnAsM) s = s.replace("rn", "m")
        if (vAsY) s = s.replace("v", "y")
        return s.replace(Regex("[^a-z]"), "")
    }

    internal fun findPokemonInText(rawText: String): PokemonMeta? {
        // Strip CP labels, menu labels ("party", "battle", etc.) and 2+ digit numbers EVEN when concatenated without a space (e.g. "KyuremCP4605" or "Kyurem4605"),
        // while preserving single digits inside words (e.g. "Cl0dsire", "D1alga") for normalizeOcrToken!
        val cleaned = rawText
            .replace(Regex("(?i)cp\\s*\\d+"), " ")
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|lv|level|vs|party|parties|battle|battles|league|schedule|rank|rating|rewards|reward|train|training|season|current)\\b"), " ")
            .replace(Regex("\\d{2,}"), " ")
            .replace(Regex("\\b\\d+\\b"), " ")
            .replace(Regex("[^a-zA-Z0-9\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null
        if (isIgnoredMenuToken(cleaned)) return null

        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 && !isIgnoredMenuToken(it) }
        if (tokens.isEmpty()) return null
        val filteredCleaned = tokens.joinToString(" ")

        val allMeta = OverlayService.getAllPokemonMeta()
        val sortedByLenDesc = allMeta.sortedByDescending { it.baseSpecies.length }
        val lowerCleaned = filteredCleaned.lowercase()
        val normCleanedVariants = listOf(
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = true),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = true)
        ).filter { !isIgnoredMenuToken(it) }.distinct()

        // 0. Strict Mew vs Mewtwo disambiguation before general matching:
        // "Mew" (3 chars) and "Mewtwo" (6 chars) are distinct species and must never evaluate as each other.
        val hasMewtwoIndicator = normCleanedVariants.any { it.contains("mewt") || it.contains("mewtw") } ||
            lowerCleaned.contains("mewt")
        if (hasMewtwoIndicator) {
            val mewtwoMeta = sortedByLenDesc.find { it.baseSpecies.equals("mewtwo", ignoreCase = true) }
            if (mewtwoMeta != null) return mewtwoMeta
        } else {
            val hasExactMewToken = tokens.any { tok ->
                val nToks = listOf(
                    normalizeOcrToken(tok, oneAsL = false, rnAsM = false, vAsY = false),
                    normalizeOcrToken(tok, oneAsL = false, rnAsM = true, vAsY = false)
                )
                nToks.any { it == "mew" }
            }
            if (hasExactMewToken) {
                val mewMeta = sortedByLenDesc.find { it.baseSpecies.equals("mew", ignoreCase = true) }
                if (mewMeta != null) return mewMeta
            }
        }

        // 1. Direct or normalized substring match against species base names (longest species name first)
        for (meta in sortedByLenDesc) {
            val baseNorm = normalizeOcrToken(meta.baseSpecies)
            if (baseNorm == "mew" || baseNorm == "mewtwo") continue
            if (baseNorm.length >= 4 && (lowerCleaned.contains(meta.baseSpecies) || normCleanedVariants.any { it.contains(baseNorm) })) {
                return meta
            }
        }

        // 2. Token-level exact & normalized OCR confusable match (including rn->m and v->y for "Kyurern"/"Kvurem")
        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 3 && !isIgnoredMenuToken(it) }.distinct()
            if (tokenNorms.isEmpty()) continue

            val exactOrNorm = sortedByLenDesc.find { meta ->
                val target = normalizeOcrToken(meta.baseSpecies)
                if (target == "mew" && hasMewtwoIndicator) return@find false
                if (target == "mewtwo" && !hasMewtwoIndicator) return@find false
                meta.baseSpecies.equals(token, ignoreCase = true) || tokenNorms.any { it == target }
            }
            if (exactOrNorm != null) return exactOrNorm
        }

        // 3. Prefix match for partially clipped names (e.g. "Kyure", "Feraliga", "Giratin", "Zacia")
        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true)
            ).filter { it.length >= 5 && !isIgnoredMenuToken(it) }.distinct()
            for (normToken in tokenNorms) {
                val prefixMatch = sortedByLenDesc.find {
                    val target = normalizeOcrToken(it.baseSpecies)
                    if (target == "mew" || (target == "mewtwo" && !normToken.startsWith("mewt"))) {
                        false
                    } else {
                        target.length >= 5 && (target.startsWith(normToken) || normToken.startsWith(target))
                    }
                }
                if (prefixMatch != null) return prefixMatch
            }
        }

        // 4. Fuzzy Levenshtein match against meta dictionary (testing 1->i, 1->l, rn->m, v->y)
        var bestMatch: PokemonMeta? = null
        var bestDistance = Int.MAX_VALUE

        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 4 && !isIgnoredMenuToken(it) }.distinct()
            if (tokenNorms.isEmpty()) continue

            for (normTok in tokenNorms) {
                val maxAllowedDist = if (normTok.length >= 5) 2 else 1
                for (meta in allMeta) {
                    val target = normalizeOcrToken(meta.baseSpecies)
                    // Never fuzzy-match Mew as Mewtwo or Mewtwo as Mew
                    if (target == "mew" || (target == "mewtwo" && !normTok.startsWith("mewt"))) continue
                    if (normTok.startsWith("mew") && !normTok.startsWith("mewt") && target == "mewtwo") continue
                    if (kotlin.math.abs(target.length - normTok.length) <= maxAllowedDist) {
                        val dist = levenshteinDistance(normTok, target)
                        if (dist <= maxAllowedDist && dist < bestDistance) {
                            bestDistance = dist
                            bestMatch = meta
                        }
                    } else if (normTok.length > target.length && target.length >= 5 && normTok.length <= target.length + 4) {
                        // Sliding window check if trailing type icon / CP letter got glued to the token
                        val sub = normTok.substring(0, target.length)
                        if (!isIgnoredMenuToken(sub)) {
                            val dist = levenshteinDistance(sub, target)
                            if (dist <= 1 && dist < bestDistance) {
                                bestDistance = dist
                                bestMatch = meta
                            }
                        }
                    }
                }
            }
        }

        return bestMatch
    }

    internal fun getPokemonMeta(
        name: String,
        leagueOverride: String? = null,
        isShadowOverride: Boolean? = null
    ): PokemonMeta {
        val activeLeague = leagueOverride ?: currentPreset?.league ?: "MASTER LEAGUE"
        val cleanNoShadow = name.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").trim()
        val base = FormResolver.extractBaseSpecies(cleanNoShadow)
        val isShadow = isShadowOverride ?: (name.contains("Shadow", ignoreCase = true) ||
            manualShadowOverrides[base.lowercase()] == true ||
            (name.equals(activeOpponentName, ignoreCase = true) && isOpponentShadow))

        // Normalize prefix regional/form names like "Alolan Ninetales" -> "Ninetales (Alolan)" or "Armored Mewtwo" -> "Mewtwo (Armored)"
        val regionalMatch = Regex("^(Alolan|Galarian|Hisuian|Paldean|Armored|Origin|Altered|Therian|Incarnate|Crowned)\\s+(.+)$", RegexOption.IGNORE_CASE).find(cleanNoShadow)
        val normalizedParenName = if (regionalMatch != null) {
            "${regionalMatch.groupValues[2].trim()} (${regionalMatch.groupValues[1].replaceFirstChar { it.uppercase() }})"
        } else {
            cleanNoShadow
        }

        val allMeta = OverlayService.getAllPokemonMeta()
        val variants = FormResolver.getVariantsForSpecies(base, activeLeague)
        val isBareSpeciesQuery = cleanNoShadow.equals(base, ignoreCase = true) &&
            !cleanNoShadow.contains("(") &&
            regionalMatch == null
        val hasManualFormSelection = manualFormOverrides[base.lowercase()]?.equals(cleanNoShadow, ignoreCase = true) == true

        val exactByName = if (isBareSpeciesQuery && variants.size > 1 && !hasManualFormSelection) {
            null
        } else {
            allMeta.find {
                it.name.equals(name, ignoreCase = true) ||
                    it.name.equals(cleanNoShadow, ignoreCase = true) ||
                    it.name.equals(normalizedParenName, ignoreCase = true) ||
                    (cleanNoShadow.contains("zygarde", ignoreCase = true) && cleanNoShadow.contains("complete", ignoreCase = true) && it.speciesId.equals("zygarde_complete", ignoreCase = true))
            }
        }
        val found = if (exactByName != null) {
            exactByName
        } else {
            if (variants.isNotEmpty()) {
                FormResolver.resolveBestDefaultVariant(variants.first(), cleanNoShadow, activeLeague)
            } else {
                allMeta.find { it.speciesId.equals(cleanNoShadow.replace(" ", "_"), ignoreCase = true) }
                    ?: allMeta.firstOrNull {
                        base.length >= 4 && (
                            it.baseSpecies.startsWith(base, ignoreCase = true) ||
                            levenshteinDistance(it.baseSpecies.lowercase(), base.lowercase()) <= 2
                        )
                    }
                    ?: PokemonMeta(
                        name = name,
                        speciesId = base,
                        baseSpecies = base,
                        formLabel = "Base",
                        types = listOf("normal"),
                        defaultCp = 2500,
                        defaultFastMove = "Fast Attack",
                        fastTurns = 2,
                        chargedMove1 = "Charged Move 1",
                        chargedMove2 = "Charged Move 2",
                        c1Dmg = 35,
                        c2Dmg = 45
                    )
            }
        }
        return OverlayService.applyRankingMovesForLeague(OverlayService.applyRecommendedMoves(found), activeLeague, isShadow)
    }

    internal fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j
        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = min(dp[i - 1][j] + 1, min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost))
            }
        }
        return dp[s1.length][s2.length]
    }

    /**
     * PvPoke Type Effectiveness Multiplier (Pokémon GO combat chart: 1.6x SE, 0.625x NVE, 0.390625x Immune)
     */
    internal fun getTypeEffectiveness(moveType: String, defenderTypes: List<String>): Double {
        var multiplier = 1.0
        val atk = moveType.lowercase().trim()
        for (def in defenderTypes.map { it.lowercase().trim() }.filter { it.isNotEmpty() && it != "none" }.distinct()) {
            val eff = when (atk) {
                "normal" -> when (def) { "rock", "steel" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                "fire" -> when (def) { "grass", "ice", "bug", "steel" -> 1.6; "fire", "water", "rock", "dragon" -> 0.625; else -> 1.0 }
                "water" -> when (def) { "fire", "ground", "rock" -> 1.6; "water", "grass", "dragon" -> 0.625; else -> 1.0 }
                "electric" -> when (def) { "water", "flying" -> 1.6; "electric", "grass", "dragon" -> 0.625; "ground" -> 0.390625; else -> 1.0 }
                "grass" -> when (def) { "water", "ground", "rock" -> 1.6; "fire", "grass", "poison", "flying", "bug", "dragon", "steel" -> 0.625; else -> 1.0 }
                "ice" -> when (def) { "grass", "ground", "flying", "dragon" -> 1.6; "fire", "water", "ice", "steel" -> 0.625; else -> 1.0 }
                "fighting" -> when (def) { "normal", "ice", "rock", "dark", "steel" -> 1.6; "poison", "flying", "psychic", "bug", "fairy" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                "poison" -> when (def) { "grass", "fairy" -> 1.6; "poison", "ground", "rock", "ghost" -> 0.625; "steel" -> 0.390625; else -> 1.0 }
                "ground" -> when (def) { "fire", "electric", "poison", "rock", "steel" -> 1.6; "grass", "bug" -> 0.625; "flying" -> 0.390625; else -> 1.0 }
                "flying" -> when (def) { "grass", "fighting", "bug" -> 1.6; "electric", "rock", "steel" -> 0.625; else -> 1.0 }
                "psychic" -> when (def) { "fighting", "poison" -> 1.6; "psychic", "steel" -> 0.625; "dark" -> 0.390625; else -> 1.0 }
                "bug" -> when (def) { "grass", "psychic", "dark" -> 1.6; "fire", "fighting", "poison", "flying", "ghost", "steel", "fairy" -> 0.625; else -> 1.0 }
                "rock" -> when (def) { "fire", "ice", "flying", "bug" -> 1.6; "fighting", "ground", "steel" -> 0.625; else -> 1.0 }
                "ghost" -> when (def) { "psychic", "ghost" -> 1.6; "dark" -> 0.625; "normal" -> 0.390625; else -> 1.0 }
                "dragon" -> when (def) { "dragon" -> 1.6; "steel" -> 0.625; "fairy" -> 0.390625; else -> 1.0 }
                "dark" -> when (def) { "psychic", "ghost" -> 1.6; "fighting", "dark", "fairy" -> 0.625; else -> 1.0 }
                "steel" -> when (def) { "ice", "rock", "fairy" -> 1.6; "fire", "water", "electric", "steel" -> 0.625; else -> 1.0 }
                "fairy" -> when (def) { "fighting", "dragon", "dark" -> 1.6; "fire", "poison", "steel" -> 0.625; else -> 1.0 }
                else -> 1.0
            }
            multiplier *= eff
        }
        return multiplier
    }

    /**
     * Standardized <= 5 character PvPoke Move Abbreviations (Fast & Charged Moves)
     */
    internal val moveAbbr5Map: Map<String, String> = mapOf<String, String>(
        // Fast Moves
        "Dragon Breath" to "DB",
        "Sand Attack" to "SndAt",
        "Quick Attack" to "QA",
        "Lock-On" to "LO",
        "Water Gun" to "WG",
        "Lick" to "Lick",
        "Bite" to "Bite",
        "Tackle" to "Tckl",
        "Fury Cutter" to "FC",
        "Bug Bite" to "BB",
        "Scratch" to "Scrt",
        "Psywave" to "PsyWv",
        "Psycho Cut" to "PC",
        "Mud Shot" to "MS",
        "Shadow Claw" to "SC",
        "Counter" to "C",
        "Powder Snow" to "PS",
        "Wing Attack" to "WA",
        "Peck" to "Peck",
        "Poison Sting" to "PSng",
        "Thunder Shock" to "TS",
        "Fairy Wind" to "FW",
        "Bullet Punch" to "BP",
        "Fire Fang" to "FF",
        "Vine Whip" to "VW",
        "Karate Chop" to "KC",
        "Low Kick" to "LK",
        "Ice Fang" to "IF",
        "Metal Claw" to "MC",
        "Sucker Punch" to "SP",
        "Poison Jab" to "PJ",
        "Spark" to "Sprk",
        "Leafage" to "Lfge",
        "Steel Wing" to "SW",
        "Rock Throw" to "RT",
        "Ember" to "Embr",
        "Force Palm" to "FP",
        "Dragon Tail" to "DT",
        "Waterfall" to "WF",
        "Fire Spin" to "FS",
        "Snarl" to "Snrl",
        "Geomancy" to "Geo",
        "Mud-Slap" to "MSlp",
        "Charm" to "Chrm",
        "Double Kick" to "DK",
        "Air Slash" to "AS",
        "Ice Shard" to "IS",
        "Bubble" to "Bbl",
        "Rollout" to "Rll",
        "Smack Down" to "SD",
        "Astonish" to "Astn",
        "Hex" to "Hex",
        "Magical Leaf" to "MgLf",
        "Bullet Seed" to "BS",
        "Water Shuriken" to "WS",
        "Gust" to "Gust",
        "Confusion" to "Conf",
        "Volt Switch" to "VS",
        "Incinerate" to "Incin",
        // Charged Moves
        "Roar of Time" to "RoT",
        "Iron Head" to "IH",
        "Draco Meteor" to "DM",
        "Thunder" to "Thdr",
        "Aeroblast" to "Aero",
        "Sky Attack" to "SA",
        "Future Sight" to "FS",
        "Surf" to "Surf",
        "Origin Pulse" to "OP",
        "Hydro Pump" to "HP",
        "Blizzard" to "Blz",
        "Close Combat" to "CC",
        "Brave Bird" to "BB",
        "Play Rough" to "PR",
        "Wild Charge" to "WC",
        "Shadow Ball" to "SB",
        "Ominous Wind" to "OW",
        "Dragon Claw" to "DC",
        "Ancient Power" to "AP",
        "Shadow Force" to "SF",
        "Spacial Rend" to "SpR",
        "Aqua Tail" to "AT",
        "Precipice Blades" to "PB",
        "Fire Punch" to "FP",
        "Psystrike" to "Pstk",
        "Ice Beam" to "IB",
        "Moonblast" to "Mb",
        "Dark Pulse" to "DP",
        "Oblivion Wing" to "ObW",
        "Crunch" to "Crn",
        "Earthquake" to "Eq",
        "Sandsear Storm" to "SndS",
        "Stone Edge" to "SE",
        "Superpower" to "SpP",
        "Sacred Fire" to "ScF",
        "Sunsteel Strike" to "SnSt",
        "Moongeist Beam" to "MnBm",
        "Rock Slide" to "RS",
        "Earth Power" to "EP",
        "Outrage" to "OR",
        "Meteor Mash" to "MM",
        "Drill Run" to "DR",
        "Rock Wrecker" to "RW",
        "Breaking Swipe" to "BS",
        "Avalanche" to "Avl",
        "High Horsepower" to "HH",
        "Ice Punch" to "IP",
        "Fusion Flare" to "FFl",
        "Overheat" to "OH",
        "Fusion Bolt" to "FBlt",
        "Glaciate" to "Glct",
        "Disarming Voice" to "DV",
        "Hydro Cannon" to "HC",
        "Weather Ball (Fire)" to "WB-F",
        "Weather Ball (Ice)" to "WB-I",
        "Weather Ball (Water)" to "WB-W",
        "Weather Ball (Rock)" to "WB-R",
        "Weather Ball" to "WB",
        "Dazzling Gleam" to "DG",
        "Scorching Sands" to "ScS",
        "Psycho Boost" to "PsB",
        "Thunderbolt" to "TB",
        "Grass Knot" to "GK",
        "Sacred Sword" to "ScS",
        "Leaf Blade" to "LB",
        "Aerial Ace" to "AA",
        "Fly" to "Fly",
        "Flame Charge" to "FC",
        "Blast Burn" to "BB",
        "Feather Dance" to "FD",
        "Shadow Sneak" to "SS",
        "Air Cutter" to "AirC",
        "Twister" to "Twst",
        "Focus Blast" to "FB",
        "Solar Beam" to "SolB",
        "Dragon Pulse" to "DP",
        "Megahorn" to "Mgh",
        "Hurricane" to "Hrc",
        "Psychic" to "Psyc",
        "Psyshock" to "Psyk",
        "Flash Cannon" to "FlC",
        "Sludge Wave" to "SWv",
        "Sludge Bomb" to "SlB",
        "Gunk Shot" to "GS",
        "Foul Play" to "FoP",
        "Payback" to "Pybk",
        "Dynamic Punch" to "DyP",
        "Power Gem" to "PG",
        "Water Pulse" to "WP",
        "Petal Blizzard" to "PtB",
        "Energy Ball" to "EnB",
        "Power Whip" to "PW",
        "Heavy Slam" to "HS",
        "Hyper Beam" to "HB",
        "Night Slash" to "NS",
        "Sand Tomb" to "ST",
        "Rock Tomb" to "RT",
        "Mirror Shot" to "MS",
        "Freeze Shock" to "FrS",
        "Ice Burn" to "IcB",
        "Drill Peck" to "DPk",
        "Behemoth Blade" to "BehB",
        "Behemoth Bash" to "BehS",
        "Secret Sword" to "SecS",
        "Aqua Jet" to "AJ",
        "Double Iron Bash" to "DIB",
        "Drum Beating" to "DrmB",
        "Gigaton Hammer" to "GgHm",
        "Bulldoze" to "Bldz",
        "Brutal Swing" to "BrS",
        "Swift" to "Swft",
        "Body Slam" to "BS",
        "Icy Wind" to "IW",
        "Cross Chop" to "CrCh",
        "Mystical Fire" to "MyF",
        "Liquidation" to "Liq",
        "Scald" to "Scld",
        "Trailblaze" to "Trlb",
        "Nature's Madness" to "NM",
        "Rage Fist" to "RgF",
        "Aura Wheel" to "AuW",
        "Torch Song" to "TrS",
        "Super Power" to "SpP",
        "Chilling Water" to "ChW",
        "Fell Stinger+" to "FlS+",
        "Volt Tackle+" to "VlT+",
        "Zap Cannon+" to "ZC+",
        "Acid Spray+" to "ASp+",
        "Liquidation+" to "Liq+",
        "Outrage+" to "OR+",
        "Dynamic Punch+" to "DyP+",
        "Future Sight+" to "FS+",
        "Drill Peck+" to "DPk+",
        "Dark Pulse+" to "DP+",
        "Night Shade+" to "NSh+",
        "Brave Bird+" to "BB+",
        "Ominous Wind+" to "OW+",
        "Seed Bomb+" to "SB+",
        "Mystical Fire+" to "MyF+",
        "Surf+" to "Surf+",
        "Psybeam+" to "Psb+",
        "Brick Break+" to "BrB+"
    )

    internal val fastMovePowerMap get() = fastMovePowerMapStatic

    internal val fastMoveTypeMap get() = fastMoveTypeMapStatic

    internal fun abbrMove5(moveName: String): String {
        if (moveName.isBlank()) return "Move"
        moveAbbr5Map[moveName]?.let { return it }
        moveAbbr5Map.entries.firstOrNull { it.key.equals(moveName, ignoreCase = true) }?.let { return it.value }
        val isPlusMove = moveName.trim().endsWith("+")
        val baseInput = if (isPlusMove) moveName.trim().removeSuffix("+").trim() else moveName
        if (isPlusMove) {
            moveAbbr5Map.entries.firstOrNull { it.key.equals(baseInput, ignoreCase = true) }?.let {
                return "${it.value.take(4)}+"
            }
        }
        val clean = baseInput.replace(Regex("[()\\-]"), " ").trim()
        val words = clean.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.size >= 2) {
            val combo = (words[0].take(3) + words[1].take(2)).take(if (isPlusMove) 4 else 5)
            return if (isPlusMove) "$combo+" else combo
        }
        val truncated = clean.take(if (isPlusMove) 4 else 5)
        return if (isPlusMove) "$truncated+" else truncated
    }

    internal fun abbrPokemon3(name: String, isShadow: Boolean = false): String {
        if (name.isBlank() || name == "Waiting...") return "OPP"
        val clean = name
            .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Kanto\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Alolan\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Galarian\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Hisuian\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Paldean\\s+", RegexOption.IGNORE_CASE), "")
            .split(" ")
            .firstOrNull()
            ?.take(3)
            ?.uppercase() ?: "MON"
        return if (isShadow) "S$clean".take(4) else clean
    }

    internal fun calculateFastMoveExactDamagePercent(
        attacker: PokemonMeta,
        defender: PokemonMeta,
        fastMoveName: String,
        fastTurns: Int,
        isAttackerShadow: Boolean,
        isDefenderShadow: Boolean
    ): Double {
        val key = fastMoveName.lowercase().trim()
        val power = OverlayService.resolveFastPowerStatic(key, fastTurns)
        val moveType = OverlayService.resolveFastTypeStatic(key, attacker.types.firstOrNull() ?: "normal")
        val stab = if (attacker.types.any { it.equals(moveType, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = getTypeEffectiveness(moveType, defender.types)

        val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0)
        val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0)

        val rawDamage = floor(0.5 * power * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
        return ((rawDamage / defender.hp.toDouble().coerceAtLeast(1.0)) * 100.0).coerceIn(0.35, 100.0)
    }

    internal fun calculateFastMoveDamagePercent(
        attacker: PokemonMeta,
        defender: PokemonMeta,
        fastMoveName: String,
        fastTurns: Int,
        isAttackerShadow: Boolean,
        isDefenderShadow: Boolean
    ): Int {
        return calculateFastMoveExactDamagePercent(
            attacker = attacker,
            defender = defender,
            fastMoveName = fastMoveName,
            fastTurns = fastTurns,
            isAttackerShadow = isAttackerShadow,
            isDefenderShadow = isDefenderShadow
        ).roundToInt().coerceIn(1, 100)
    }

    /**
     * Computes exact PvPoke Charged Move damage percentage dealt to defender's total HP pool:
     * Damage = floor(0.5 * Power * (EffectiveAtk / EffectiveDef) * STAB * TypeEffectiveness * 1.3) + 1
     * Accounts for STAB (1.2x), Type Effectiveness, and Shadow modifiers (1.2x Atk / 0.8333333x Def).
     */
    internal fun calculateChargedMoveDamagePercent(
        attacker: PokemonMeta,
        defender: PokemonMeta,
        moveName: String,
        isAttackerShadow: Boolean,
        isDefenderShadow: Boolean
    ): Int {
        val moveStats = OverlayService.resolveChargedMoveStatsStatic(moveName, attacker.types.firstOrNull() ?: "normal")
        val stab = if (attacker.types.any { it.equals(moveStats.type, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = getTypeEffectiveness(moveStats.type, defender.types)

        val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0)
        val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0)

        val rawDamage = floor(0.5 * moveStats.power * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
        val pct = ((rawDamage / defender.hp.toDouble()) * 100.0).roundToInt()
        return pct.coerceIn(5, 100)
    }

    /**
     * BATTLE CALCULATIONS:
     * Calculates turn alignment, opponent incoming damage, and player outgoing damage ("My Dmg to [Opponent]")
     */
    internal fun recalculateAndPushBattleData() {
        val jsonStr = buildBattlePayloadJson(isReplayMode = false)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updateBattleData($jsonStr)", null)
        }
    }

    fun buildBattlePayloadJson(isReplayMode: Boolean = false): String {
        val p1 = currentPreset?.pokemon?.getOrNull(0)
        val p2 = currentPreset?.pokemon?.getOrNull(1)
        val p3 = currentPreset?.pokemon?.getOrNull(2)

        val p1Name = p1?.name ?: "Dialga (Origin)"
        val p2Name = p2?.name ?: "Lugia"
        val p3Name = p3?.name ?: "Kyogre"

        val activePlayerName = activeUserPokemonName ?: p1Name
        val activeSlot = currentPreset?.pokemon?.find { it.name.equals(activePlayerName, ignoreCase = true) }

        val teamNames = listOf(p1Name, p2Name, p3Name)
        val activeUserSlotIndex = teamNames.indexOfFirst { it.equals(activePlayerName, ignoreCase = true) }.let { if (it >= 0) it else 0 }
        if (activeUserSlotIndex in 0..2 && !isPostFaintSwitchPromptActive && playerSlotHpPct[activeUserSlotIndex] > 0) {
            playerFaintedSlots[activeUserSlotIndex] = false
        }

        for (i in 0..2) {
            if (playerFaintedSlots[i]) playerSlotHpPct[i] = 0
            if (oppFaintedSlots[i]) oppSlotHpPct[i] = 0
        }

        if (activeUserSlotIndex in 0..2 && playerSwitchValidityLatched) {
            playerSlotEverOnField[activeUserSlotIndex] = true
        }

        val teamData = (0..2).map { i ->
            val pName = teamNames[i]
            val slotEverOnField = playerSlotEverOnField[i] ||
                i == activeUserSlotIndex ||
                playerSlotTurnsOnField[i] > 0 ||
                playerSlotEnergy[i] > 0 ||
                playerFaintedSlots[i]
            if (slotEverOnField) {
                playerSlotEverOnField[i] = true
            }
            val slotHpVal = if (playerFaintedSlots[i]) 0 else playerSlotHpPct[i].coerceIn(0, 100)
            val slotEnergyVal = if (playerFaintedSlots[i]) 0 else playerSlotEnergy[i].coerceIn(0, 100)
            val bankedEnergyLabel = when {
                playerFaintedSlots[i] -> "0E"
                !slotEverOnField -> "-E"
                else -> "${slotEnergyVal}E"
            }
            mapOf(
                "initial" to (pName.firstOrNull()?.uppercase() ?: "P${i + 1}"),
                "code" to abbrPokemon3(pName),
                "name" to pName,
                "hpPct" to slotHpVal,
                "energy" to slotEnergyVal,
                "hasEnteredField" to slotEverOnField,
                "bankedEnergyLabel" to bankedEnergyLabel
            )
        }

        val nowMs = System.currentTimeMillis()
        val playerSwapRemainingSec = if (playerSwapEndTimeMs > nowMs) ((playerSwapEndTimeMs - nowMs + 999L) / 1000L).toInt() else 0
        val oppSwapRemainingSec = if (oppSwapEndTimeMs > nowMs) ((oppSwapEndTimeMs - nowMs + 999L) / 1000L).toInt() else 0
        val waitingActiveUserHp = if (playerFaintedSlots[activeUserSlotIndex.coerceIn(0, 2)]) 0 else playerSlotHpPct[activeUserSlotIndex.coerceIn(0, 2)].coerceIn(0, 100)

        if (isWaitingForOpponent || activeOpponentName == "Waiting...") {
            val effectiveWaitingScanMs = if (isBattleActive && lastScanDurationMs > 0L) {
                lastScanDurationMs
            } else if (lastBattleAvgScanMs > 0L) {
                lastBattleAvgScanMs
            } else {
                lastScanDurationMs
            }
            val effectiveWaitingHpScanMs = if (isBattleActive && lastHpScanDurationMs > 0L) {
                lastHpScanDurationMs
            } else if (lastBattleAvgHpScanMs > 0L) {
                lastBattleAvgHpScanMs
            } else {
                lastHpScanDurationMs
            }
            val waitingPayload = mapOf(
                "activeOpponent" to "Waiting...",
                "activeOpponentFastMove" to "Scanning Header...",
                "activeOpponentTurns" to 0,
                "oppFastTelemetry" to "200ms HP + 750ms OCR",
                "userFastTelemetry" to "",
                "isOpponentShadow" to isOpponentShadow,
                "currentFormLabel" to "Base",
                "availableForms" to emptyList<String>(),
                "userActivePokemon" to activePlayerName,
                "activeUserSlotIndex" to activeUserSlotIndex,
                "activeOpponentSlotIndex" to 0,
                "leadMatchup" to (manualLeadMatchupOverride ?: lastClearedLeadMatchupSnapshot.ifBlank { currentLeadMatchup }),
                "isBattleActive" to isBattleActive,
                "isReplayMode" to isReplayMode,
                "overlayTransparencyPct" to overlayTransparencyPct,
                "appThemeId" to appThemeId,
                "isOverlayMinimized" to isOverlayMinimized,
                "scanHzMode" to currentScanHzMode,
                "lastScanDurationMs" to effectiveWaitingScanMs,
                "lastBattleAvgScanMs" to lastBattleAvgScanMs,
                "lastHpScanDurationMs" to effectiveWaitingHpScanMs,
                "lastBattleAvgHpScanMs" to lastBattleAvgHpScanMs,
                "enableHpTracking" to enableHpTracking,
                "enableEnergyTracking" to enableEnergyTracking,
                "fastDetectTurnOffset" to fastDetectTurnOffset,
                "oppFastMoveStatus" to "unconfirmed",
                "confirmedOppChargedMoves" to emptyList<String>(),
                "myMove1Summary" to "—",
                "myMove2Summary" to "—",
                "throwAlignmentText" to "Waiting for Opponent spawn",
                "throwHorizonText" to "—",
                "playerSwapRemainingSec" to playerSwapRemainingSec,
                "playerSwapEndTimeMs" to playerSwapEndTimeMs,
                "oppSwapRemainingSec" to oppSwapRemainingSec,
                "oppSwapEndTimeMs" to oppSwapEndTimeMs,
                "hapticOppSwapWarnSec" to activeHapticOppSwapWarnSec,
                "hapticChargeTimingFasts" to activeHapticChargeTimingFasts,
                "playerPokeballs" to playerPokeballCount,
                "oppPokeballs" to oppPokeballCount,
                "playerShields" to playerShieldsRemaining,
                "oppShields" to oppShieldsRemaining,
                "player_shields_remaining" to playerShieldsRemaining,
                "opponent_shields_remaining" to oppShieldsRemaining,
                "playerFaintedSlots" to playerFaintedSlots.toList(),
                "oppFaintedSlots" to oppFaintedSlots.toList(),
                "playerSlotHpPct" to playerSlotHpPct.toList(),
                "oppSlotHpPct" to oppSlotHpPct.toList(),
                "playerSlotEnergy" to playerSlotEnergy.toList(),
                "oppSlotEnergy" to oppSlotEnergy.toList(),
                "playerSlotEverOnField" to playerSlotEverOnField.toList(),
                "activeUserHpPct" to waitingActiveUserHp,
                "activeOppHpPct" to 100,
                "activeUserCp" to (playerSlotCp.getOrElse(activeUserSlotIndex.coerceIn(0, 2)) { 0 }.takeIf { it > 0 } ?: (activeSlot?.cp ?: 0)),
                "activeOppCp" to 0,
                "playerSlotCp" to (0..2).map { idx -> playerSlotCp[idx].takeIf { it > 0 } ?: (currentPreset?.pokemon?.getOrNull(idx)?.cp ?: 0) },
                "oppSlotCp" to oppSlotCp.toList(),
                "autoLoggedBanner" to if (!isBattleActive && lastLoggedBattleId.isNotBlank() && (nowMs - lastLoggedBattleTimeMs) <= 45000L) mapOf(
                    "battleId" to lastLoggedBattleId,
                    "result" to lastLoggedBattleResult,
                    "leadMatchup" to lastLoggedBattleLead,
                    "opponents" to lastLoggedBattleOpponents,
                    "telemetryIgnored" to lastLoggedBattleTelemetryIgnored,
                    "isAutoDetected" to lastLoggedBattleWasAuto
                ) else null,
                "teamArchetype" to (currentPreset?.archetype ?: "ABC"),
                "aiAdviceHudPosition" to aiAdviceHudPosition,
                "showTacticalRec" to (showTacticalRecommendations && (isBattleActive || isReplayMode)),
                "showTacticalRecommendations" to (showTacticalRecommendations && (isBattleActive || isReplayMode)),
                "tacticalRec" to if (isBattleActive || isReplayMode) mapOf(
                    "phase" to "WAITING",
                    "archetype" to (currentPreset?.archetype ?: "ABC"),
                    "action" to "AWAITING LEAD",
                    "actionLabel" to "[${(currentPreset?.archetype ?: "ABC").uppercase()}] AWAITING LEAD",
                    "shieldPlan" to "2S",
                    "goal" to "🔮 Back: Scanning opponent lead...",
                    "goalText" to "🔮 Back: Scanning opponent lead...",
                    "line1Text" to "[${(currentPreset?.archetype ?: "ABC").uppercase()}] AWAITING LEAD · [2S]",
                    "line2Text" to "🔮 Back: Scanning opponent lead...",
                    "backlineText" to "🔮 Back: Scanning opponent lead...",
                    "timingAlertLevel" to "NORMAL",
                    "tone" to "neutral",
                    "urgencyColor" to "sky",
                    "recommendedSwapSlotIndex" to -1
                ) else null,
                "tacticalRecommendation" to if (isBattleActive || isReplayMode) mapOf(
                    "phase" to "WAITING",
                    "archetype" to (currentPreset?.archetype ?: "ABC"),
                    "action" to "AWAITING LEAD",
                    "actionLabel" to "[${(currentPreset?.archetype ?: "ABC").uppercase()}] AWAITING LEAD",
                    "shieldPlan" to "2S",
                    "goal" to "🔮 Back: Scanning opponent lead...",
                    "goalText" to "🔮 Back: Scanning opponent lead...",
                    "line1Text" to "[${(currentPreset?.archetype ?: "ABC").uppercase()}] AWAITING LEAD · [2S]",
                    "line2Text" to "🔮 Back: Scanning opponent lead...",
                    "backlineText" to "🔮 Back: Scanning opponent lead...",
                    "timingAlertLevel" to "NORMAL",
                    "tone" to "neutral",
                    "urgencyColor" to "sky",
                    "recommendedSwapSlotIndex" to -1
                ) else null,
                "team" to teamData,
                "scannedOpponents" to emptyList<Map<String, Any>>(),
                "oppMoveTimingRows" to emptyList<Map<String, Any>>(),
                "myMoveTimingRows" to emptyList<Map<String, Any>>()
            )
            return gson.toJson(waitingPayload)
        }

        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val isUserShadow = activePlayerName.contains("Shadow", ignoreCase = true)
        val activeBaseKey = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val isActiveOppShadow = manualShadowOverrides[activeBaseKey] ?: (isOpponentShadow || activeOpponentName.contains("Shadow", ignoreCase = true))
        isOpponentShadow = isActiveOppShadow
        val oppMeta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(activeOpponentName, activeLeague, isActiveOppShadow), activeLeague)
        val userMeta = OverlayService.computeEffectiveCombatStats(
            getPokemonMeta(activePlayerName, activeLeague, isUserShadow),
            activeLeague,
            activeSlot?.cp,
            activeSlot?.ivs
        )

        // FIXED DISCOVERY ORDER: [1st seen, 2nd seen, 3rd seen] — never reorder on switch!
        val displayList = mutableListOf<String>()
        val seenSpecies = mutableSetOf<String>()
        val sourceList = if (detectedOpponents.isNotEmpty()) detectedOpponents else listOf(activeOpponentName)
        for (opp in sourceList) {
            val base = FormResolver.extractBaseSpecies(opp).lowercase()
            if (seenSpecies.add(base)) {
                displayList.add(opp)
            }
            if (displayList.size >= 3) break
        }
        val activeBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val activeOpponentSlotIndex = displayList.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(activeBase, ignoreCase = true)
        }.let { if (it >= 0) it else 0 }
        if (activeOpponentSlotIndex in 0..2 && oppSlotHpPct[activeOpponentSlotIndex] > 0) {
            oppFaintedSlots[activeOpponentSlotIndex] = false
        }

        val userMove1Name = activeSlot?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
        val userMove2Name = activeSlot?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2

        val myMove1Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove1Name,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )
        val myMove2Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove2Name,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )

        val myMove1Summary = "${abbrMove5(userMove1Name)} ($myMove1Pct%)"
        val myMove2Summary = "${abbrMove5(userMove2Name)} ($myMove2Pct%)"

        val userFastMoveName = activeSlot?.fastMove?.takeIf { it.isNotBlank() } ?: userMeta.defaultFastMove
        val userFastTurns = OverlayService.resolveFastTurnsStatic(userFastMoveName, userMeta.fastTurns)
        val activeOppSlotClamped = activeOpponentSlotIndex.coerceIn(0, 2)
        val activeOppFastOverride = detectedOppFastMoveOverride.getOrNull(activeOppSlotClamped)?.takeIf { it.isNotBlank() }
        val oppFastMoveName = activeOppFastOverride ?: oppMeta.defaultFastMove
        val oppFastTurns = OverlayService.resolveFastTurnsStatic(oppFastMoveName, oppMeta.fastTurns)
        val activeOppFastStatus = oppFastMoveStatus.getOrElse(activeOppSlotClamped) { "unconfirmed" }

        val oppFastEnergy = OverlayService.resolveFastEnergyStatic(oppFastMoveName, oppFastTurns)
        val userFastEnergy = OverlayService.resolveFastEnergyStatic(userFastMoveName, userFastTurns)

        val oppFastDmgPct = calculateFastMoveDamagePercent(
            attacker = oppMeta,
            defender = userMeta,
            fastMoveName = oppFastMoveName,
            fastTurns = oppFastTurns,
            isAttackerShadow = isOpponentShadow,
            isDefenderShadow = isUserShadow
        )
        val userFastDmgPct = calculateFastMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            fastMoveName = userFastMoveName,
            fastTurns = userFastTurns,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )

        val oppFastTelemetry = "${abbrMove5(oppFastMoveName)} ${oppFastTurns}t/${oppFastEnergy}e/${oppFastDmgPct}%"
        val userFastTelemetry = "${abbrMove5(userFastMoveName)} ${userFastTurns}t/${userFastEnergy}e/${userFastDmgPct}%"

        fun formatOrdinal(n: Int): String = when {
            n % 100 in 11..13 -> "${n}th"
            n % 10 == 1 -> "${n}st"
            n % 10 == 2 -> "${n}nd"
            n % 10 == 3 -> "${n}rd"
            else -> "${n}th"
        }

        val zeroSneakAttacks = calculateZeroSneakThrows(userFastTurns, oppFastTurns)
        val throwAlignmentText = zeroSneakAttacks.joinToString(", ") { formatOrdinal(it) }
        val throwHorizonText = throwAlignmentText

        val scannedOpponentsData = displayList.mapIndexed { idx, opp ->
            val rawBaseKey = FormResolver.extractBaseSpecies(opp).lowercase()
            val isThisOppShadow = manualShadowOverrides[rawBaseKey] ?: (if (idx == activeOpponentSlotIndex) isOpponentShadow else opp.contains("Shadow", ignoreCase = true))
            val meta = OverlayService.computeEffectiveCombatStats(getPokemonMeta(opp, activeLeague, isThisOppShadow), activeLeague)
            val oppC1Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove1,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val oppC2Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove2,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val thisOppPlusMove = OverlayService.resolveMegaPlusMoveStatic(meta.name, activeLeague)
                ?: OverlayService.resolveMegaPlusMoveStatic(opp, activeLeague)
            val thirdMoveName = thisOppPlusMove
                ?: meta.chargedMove3.takeIf { it.isNotBlank() }
                ?: COMMON_THIRD_CHARGED_MOVE[meta.name]
                ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(meta.name, ignoreCase = true) }?.value
                ?: when (meta.types.lastOrNull()?.lowercase()) {
                    "dragon" -> if (meta.chargedMove1 != "Outrage" && meta.chargedMove2 != "Outrage") "Outrage" else "Dragon Pulse"
                    "steel" -> if (meta.chargedMove1 != "Flash Cannon" && meta.chargedMove2 != "Flash Cannon") "Flash Cannon" else "Heavy Slam"
                    "water" -> if (meta.chargedMove1 != "Hydro Pump" && meta.chargedMove2 != "Hydro Pump") "Hydro Pump" else "Blizzard"
                    "fire" -> if (meta.chargedMove1 != "Overheat" && meta.chargedMove2 != "Overheat") "Overheat" else "Solar Beam"
                    "grass" -> if (meta.chargedMove1 != "Energy Ball" && meta.chargedMove2 != "Energy Ball") "Energy Ball" else "Solar Beam"
                    "electric" -> if (meta.chargedMove1 != "Thunderbolt" && meta.chargedMove2 != "Thunderbolt") "Thunderbolt" else "Thunder"
                    "ice" -> if (meta.chargedMove1 != "Blizzard" && meta.chargedMove2 != "Blizzard") "Blizzard" else "Ice Beam"
                    "fighting" -> if (meta.chargedMove1 != "Close Combat" && meta.chargedMove2 != "Close Combat") "Close Combat" else "Focus Blast"
                    "poison" -> if (meta.chargedMove1 != "Sludge Bomb" && meta.chargedMove2 != "Sludge Bomb") "Sludge Bomb" else "Gunk Shot"
                    "ground" -> if (meta.chargedMove1 != "Earthquake" && meta.chargedMove2 != "Earthquake") "Earthquake" else "Bulldoze"
                    "flying" -> if (meta.chargedMove1 != "Hurricane" && meta.chargedMove2 != "Hurricane") "Hurricane" else "Aerial Ace"
                    "psychic" -> if (meta.chargedMove1 != "Psychic" && meta.chargedMove2 != "Psychic") "Psychic" else "Future Sight"
                    "rock" -> if (meta.chargedMove1 != "Stone Edge" && meta.chargedMove2 != "Stone Edge") "Stone Edge" else "Power Gem"
                    "ghost" -> if (meta.chargedMove1 != "Shadow Ball" && meta.chargedMove2 != "Shadow Ball") "Shadow Ball" else "Ominous Wind"
                    "dark" -> if (meta.chargedMove1 != "Dark Pulse" && meta.chargedMove2 != "Dark Pulse") "Dark Pulse" else "Foul Play"
                    "fairy" -> if (meta.chargedMove1 != "Moonblast" && meta.chargedMove2 != "Moonblast") "Moonblast" else "Dazzling Gleam"
                    else -> "Hyper Beam"
                }
            val oppC3Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = thirdMoveName,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val fourthMoveName = (if (thisOppPlusMove != null) meta.chargedMove3 else meta.chargedMove4).takeIf {
                it.isNotBlank() &&
                    !it.equals(meta.chargedMove1, ignoreCase = true) &&
                    !it.equals(meta.chargedMove2, ignoreCase = true) &&
                    !it.equals(thirdMoveName, ignoreCase = true)
            } ?: ""
            val oppC4Pct = if (fourthMoveName.isNotBlank()) {
                calculateChargedMoveDamagePercent(
                    attacker = meta,
                    defender = userMeta,
                    moveName = fourthMoveName,
                    isAttackerShadow = isThisOppShadow,
                    isDefenderShadow = isUserShadow
                )
            } else 0
            val matrix = calculate3v3Matrix(meta, isThisOppShadow, p1, p2, p3, idx)
            val thisOppHpPct = if (idx in 0..2 && oppFaintedSlots[idx]) 0 else oppSlotHpPct.getOrElse(idx) { 100 }.coerceIn(0, 100)
            val thisOppEnergy = if (idx in 0..2 && oppFaintedSlots[idx]) 0 else oppSlotEnergy.getOrElse(idx) { 0 }.coerceIn(0, 100)
            val slotConfirmedSet = confirmedOppChargedMoves.getOrNull(idx) ?: emptySet()
            val slotConfirmedRegular = if (thisOppPlusMove != null) {
                slotConfirmedSet.filter { it.isNotBlank() && !it.equals(thisOppPlusMove, ignoreCase = true) }
            } else {
                slotConfirmedSet.filter { it.isNotBlank() }
            }
            val rawThisOppMoveNames = (listOf(meta.chargedMove1, meta.chargedMove2, thirdMoveName, fourthMoveName) + slotConfirmedSet + listOfNotNull(thisOppPlusMove))
                .filter { it.isNotBlank() }
                .distinctBy { it.lowercase() }
            val thisOppMoveNames = if (slotConfirmedRegular.size >= 2) {
                (slotConfirmedRegular.take(2) + listOfNotNull(thisOppPlusMove)).distinctBy { it.lowercase() }.ifEmpty { rawThisOppMoveNames }
            } else {
                rawThisOppMoveNames
            }
            val cheapestOppMoveEnergy = thisOppMoveNames.map { mName ->
                val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, meta.types.firstOrNull() ?: "normal")
                (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50).coerceIn(35, 100)
            }.minOrNull() ?: 45
            val isThisOppMoveReady = thisOppHpPct > 0 && thisOppEnergy >= cheapestOppMoveEnergy
            val thisOppEnergyLabel = if (isThisOppMoveReady) "${thisOppEnergy}E READY" else "${thisOppEnergy}E"
            val slotFastOverride = detectedOppFastMoveOverride.getOrNull(idx)?.takeIf { it.isNotBlank() }
            val slotFastMove = slotFastOverride ?: meta.defaultFastMove
            val slotFastTurns = OverlayService.resolveFastTurnsStatic(slotFastMove, meta.fastTurns)
            val slotFastStatus = oppFastMoveStatus.getOrElse(idx) { "unconfirmed" }
            mapOf(
                "name" to meta.name,
                "code" to abbrPokemon3(meta.name, isThisOppShadow),
                "slotOrder" to (idx + 1),
                "isActive" to (idx == activeOpponentSlotIndex),
                "isShadow" to isThisOppShadow,
                "hpPct" to thisOppHpPct,
                "energy" to thisOppEnergy,
                "cheapestMoveEnergy" to cheapestOppMoveEnergy,
                "isMoveReady" to isThisOppMoveReady,
                "energyLabel" to thisOppEnergyLabel,
                "turns" to slotFastTurns,
                "fastMove" to slotFastMove,
                "oppFastMoveStatus" to slotFastStatus,
                "confirmedChargedMoves" to slotConfirmedSet.toList(),
                "c1" to "${abbrMove5(meta.chargedMove1)} ($oppC1Pct%)",
                "c2" to "${abbrMove5(meta.chargedMove2)} ($oppC2Pct%)",
                "c3" to "${abbrMove5(thirdMoveName)} ($oppC3Pct%)",
                "c4" to if (enable4ChargedMoves && fourthMoveName.isNotBlank()) "${abbrMove5(fourthMoveName)} ($oppC4Pct%)" else "",
                "matrix" to matrix
            )
        }

        // Auto-compute Lead Matchup (Your Slot #1 p1 vs. Opponent #1 1st-seen Lead)
        val firstOppP1Matrix = (scannedOpponentsData.firstOrNull()?.get("matrix") as? Map<*, *>)?.get("p1")?.toString() ?: "N,N,N"
        val lead1sCode = firstOppP1Matrix.split(",").getOrNull(1)?.trim() ?: "N"
        val autoLeadMatchup = when (lead1sCode) {
            "SW", "W" -> "FAVORABLE"
            "L", "SL" -> "NEGATIVE"
            else -> "NEUTRAL"
        }
        currentLeadMatchup = manualLeadMatchupOverride ?: autoLeadMatchup

        if (availableOpponentForms.isEmpty()) {
            availableOpponentForms = FormResolver.getVariantsForSpecies(oppMeta.baseSpecies, activeLeague)
        }

        // CMP Tie Evaluation: True if player's active Pokémon wins CMP (higher or equal Attack)
        val winsCmp = userMeta.atk >= oppMeta.atk

        // Active opponent's 3 (or 4) charged moves — v3.80 / v6.20: filter to confirmed regular moves once 2 distinct regular moves are known, while keeping Super Mega + move
        val activeOppPlusMove = OverlayService.resolveMegaPlusMoveStatic(oppMeta.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(activeOpponentName, activeLeague)
        val activeOppThirdMove = activeOppPlusMove
            ?: oppMeta.chargedMove3.takeIf { it.isNotBlank() }
            ?: COMMON_THIRD_CHARGED_MOVE[oppMeta.name]
            ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(oppMeta.name, ignoreCase = true) }?.value
            ?: "Outrage"
        val activeOppFourthMove = (if (activeOppPlusMove != null) oppMeta.chargedMove3 else oppMeta.chargedMove4).takeIf {
            it.isNotBlank() &&
                !it.equals(oppMeta.chargedMove1, ignoreCase = true) &&
                !it.equals(oppMeta.chargedMove2, ignoreCase = true) &&
                !it.equals(activeOppThirdMove, ignoreCase = true)
        } ?: ""
        val activeOppConfirmedSet = confirmedOppChargedMoves.getOrNull(activeOppSlotClamped) ?: emptySet()
        val activeOppConfirmedRegular = if (activeOppPlusMove != null) {
            activeOppConfirmedSet.filter { it.isNotBlank() && !it.equals(activeOppPlusMove, ignoreCase = true) }.distinctBy { it.lowercase() }
        } else {
            activeOppConfirmedSet.filter { it.isNotBlank() }.distinctBy { it.lowercase() }
        }
        val rawOppChargedMoveNames = (if (enable4ChargedMoves && activeOppFourthMove.isNotBlank()) {
            listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, activeOppThirdMove, activeOppFourthMove)
        } else {
            listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, activeOppThirdMove)
        } + activeOppConfirmedSet.toList() + listOfNotNull(activeOppPlusMove))
            .filter { it.isNotBlank() }
            .distinctBy { it.lowercase() }
        val oppChargedMoveNames = if (activeOppConfirmedRegular.size >= 2) {
            (activeOppConfirmedRegular.take(2) + listOfNotNull(activeOppPlusMove)).distinctBy { it.lowercase() }.ifEmpty { rawOppChargedMoveNames }
        } else {
            rawOppChargedMoveNames
        }

        val activeUserPlusMove = OverlayService.resolveMegaPlusMoveStatic(userMeta.name, activeLeague)
            ?: OverlayService.resolveMegaPlusMoveStatic(activePlayerName, activeLeague)
        val myChargedMoveNames = listOfNotNull(userMove1Name, userMove2Name, activeUserPlusMove).filter { it.isNotBlank() }.distinct()

        // Compute shared 1st-throw maximum turn horizon across all 5 moves (Opponent's 3 + Player's 2)
        val oppFirstTurns = oppChargedMoveNames.map { moveName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * oppFastTurns
        }
        val myFirstTurns = myChargedMoveNames.map { mName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, userMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * userFastTurns
        }
        val maxHorizonTurns = ((oppFirstTurns + myFirstTurns).maxOrNull() ?: 12).coerceAtLeast(4)

        // Precompute opponent ready turns across up to 3 cycles for CMP tie evaluation
        val oppReadyTurnsSet = mutableSetOf<Int>()
        for (moveName in oppChargedMoveNames) {
            val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            var leftE = 0
            var cumF = 0
            for (c in 1..3) {
                val needE = max(1, mEnergy - leftE)
                val f = kotlin.math.ceil(needE.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftE = leftE + f * oppFastEnergy - mEnergy
                cumF += f
                oppReadyTurnsSet.add(cumF * oppFastTurns)
            }
        }

        // Build per-move timing, catch/CMP, multi-cycle turn-aligned segments & 3-column team threat rows
        val oppMoveTimingRows = oppChargedMoveNames.map { moveName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            val oppFasts = kotlin.math.ceil(mEnergy.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            val oppReadyTurn = oppFasts * oppFastTurns

            val myTapAtReady = kotlin.math.ceil(oppReadyTurn.toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(1)
            val displayReadyCount = if (oppCountMode == "opp_fasts") oppFasts else myTapAtReady
            val myCapTap = kotlin.math.ceil((oppReadyTurn * 2).toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(myTapAtReady + 1)
            val coAligned = (oppReadyTurn % userFastTurns == 0)

            // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
            val cycles = mutableListOf<Map<String, Any>>()
            var leftoverEnergy = 0
            var cumOppFasts = 0
            var prevTurn = 0
            var prevDisplayTap = 0

            for (cycleIdx in 1..3) {
                val energyNeeded = max(1, mEnergy - leftoverEnergy)
                val fastsInCycle = kotlin.math.ceil(energyNeeded.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftoverEnergy = leftoverEnergy + fastsInCycle * oppFastEnergy - mEnergy
                cumOppFasts += fastsInCycle
                val readyTurn = cumOppFasts * oppFastTurns

                if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
                    break
                }

                val turnSpan = max(1, readyTurn - prevTurn)
                val widthPct = ((turnSpan.toDouble() / maxHorizonTurns.toDouble()) * 100.0).coerceIn(8.0, 100.0)

                val readyTap = if (oppCountMode == "opp_fasts") {
                    cumOppFasts
                } else {
                    max(prevDisplayTap + 1, kotlin.math.ceil(readyTurn.toDouble() / userFastTurns.toDouble()).toInt())
                }
                val startTap = prevDisplayTap + 1
                val rangeEnd = readyTap - 1
                val rangeLabel = when {
                    readyTap <= startTap -> ""
                    rangeEnd == startTap -> "$startTap"
                    else -> "$startTap–$rangeEnd"
                }

                cycles.add(
                    mapOf(
                        "cycleIndex" to cycleIdx,
                        "startTurn" to prevTurn,
                        "readyTurn" to readyTurn,
                        "turnSpan" to turnSpan,
                        "widthPct" to widthPct,
                        "startTap" to startTap,
                        "readyTap" to readyTap,
                        "rangeLabel" to rangeLabel,
                        "readyLabel" to "#$readyTap",
                        "hasZeroSneak" to false,
                        "readyState" to if (winsCmp) "cmp" else "catch"
                    )
                )

                prevTurn = readyTurn
                prevDisplayTap = readyTap
            }

            val activeDmgPct = calculateChargedMoveDamagePercent(
                attacker = oppMeta,
                defender = userMeta,
                moveName = moveName,
                isAttackerShadow = isOpponentShadow,
                isDefenderShadow = isUserShadow
            )
            val activeEff = getTypeEffectiveness(mStats.type, userMeta.types)

            // All 3 team Pokémon damage percentages in fixed team slot order [0, 1, 2]
            val teamSlots = listOf(p1, p2, p3)
            val teamDamages = teamNames.mapIndexed { tIdx, tName ->
                val tSlot = teamSlots.getOrNull(tIdx)
                val isTeamShad = tName.contains("Shadow", ignoreCase = true)
                val tMeta = OverlayService.computeEffectiveCombatStats(
                    getPokemonMeta(tName, activeLeague, isTeamShad),
                    activeLeague,
                    tSlot?.cp,
                    tSlot?.ivs
                )
                val tDmgPct = calculateChargedMoveDamagePercent(
                    attacker = oppMeta,
                    defender = tMeta,
                    moveName = moveName,
                    isAttackerShadow = isOpponentShadow,
                    isDefenderShadow = tName.contains("Shadow", ignoreCase = true)
                )
                val tEff = getTypeEffectiveness(mStats.type, tMeta.types)
                val tier = when {
                    tDmgPct <= 35 -> "resist"
                    tDmgPct >= 65 || tEff >= 1.5 -> "weak"
                    else -> "neutral"
                }
                mapOf(
                    "name" to tName,
                    "code" to abbrPokemon3(tName),
                    "dmgPct" to tDmgPct,
                    "eff" to tEff,
                    "tier" to tier,
                    "isActive" to (tIdx == activeUserSlotIndex)
                )
            }

            val safeEnd = max(1, displayReadyCount - 1)
            val safeRangeLabel = if (safeEnd <= 1) "1" else "1–$safeEnd"
            val isConfirmedMove = activeOppConfirmedSet.any { it.equals(moveName, ignoreCase = true) }

            mapOf(
                "name" to moveName,
                "shortName" to abbrMove5(moveName),
                "energy" to mEnergy,
                "oppFasts" to oppFasts,
                "oppReadyTurn" to oppReadyTurn,
                "myTapAtReady" to myTapAtReady,
                "displayReadyCount" to displayReadyCount,
                "myCapTap" to myCapTap,
                "coAligned" to coAligned,
                "winsCmp" to winsCmp,
                "isConfirmedMove" to isConfirmedMove,
                "activeName" to activePlayerName,
                "activeDmgPct" to activeDmgPct,
                "activeEff" to activeEff,
                "safeRangeLabel" to safeRangeLabel,
                "maxHorizonTurns" to maxHorizonTurns,
                "cycles" to cycles,
                "teamDamages" to teamDamages
            )
        }

        // Build player's charged move timing rows (My Attacks) with turn-aligned multi-cycle segments, leak-free range label & 3 scanned opponent columns
        val oppFirstReadyTaps = oppMoveTimingRows.mapNotNull { it["myTapAtReady"] as? Int }.toSet()

        val myMoveTimingRows = myChargedMoveNames.map { mName ->
            val mStats = OverlayService.resolveChargedMoveStatsStatic(mName, userMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50
            val myTapsNeeded = kotlin.math.ceil(mEnergy.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            val myReadyTurn = myTapsNeeded * userFastTurns

            val dmgPct = calculateChargedMoveDamagePercent(
                attacker = userMeta,
                defender = oppMeta,
                moveName = mName,
                isAttackerShadow = isUserShadow,
                isDefenderShadow = isOpponentShadow
            )
            val eff = getTypeEffectiveness(mStats.type, oppMeta.types)

            // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
            val cycles = mutableListOf<Map<String, Any>>()
            var leftoverEnergy = 0
            var cumMyFasts = 0
            var prevTurn = 0
            var prevDisplayTap = 0

            for (cycleIdx in 1..3) {
                val energyNeeded = max(1, mEnergy - leftoverEnergy)
                val fastsInCycle = kotlin.math.ceil(energyNeeded.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftoverEnergy = leftoverEnergy + fastsInCycle * userFastEnergy - mEnergy
                cumMyFasts += fastsInCycle
                val readyTurn = cumMyFasts * userFastTurns

                if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
                    break
                }

                val turnSpan = max(1, readyTurn - prevTurn)
                val widthPct = ((turnSpan.toDouble() / maxHorizonTurns.toDouble()) * 100.0).coerceIn(8.0, 100.0)

                val readyTap = cumMyFasts
                val startTap = prevDisplayTap + 1
                val rangeEnd = readyTap - 1

                val cycleSafeTaps = mutableListOf<Int>()
                for (k in startTap..rangeEnd) {
                    if ((k * userFastTurns) % oppFastTurns != 0) {
                        cycleSafeTaps.add(k)
                    }
                }
                val cycleHasZeroSneak = cycleSafeTaps.isNotEmpty()
                val rangeLabel = when {
                    readyTap <= startTap -> ""
                    cycleHasZeroSneak -> "Safe ${cycleSafeTaps.take(3).joinToString(",")}"
                    rangeEnd == startTap -> "$startTap"
                    else -> "$startTap–$rangeEnd"
                }

                val isCmpTurn = oppReadyTurnsSet.contains(readyTurn) || oppFirstReadyTaps.contains(readyTap)
                val cycleReadyState = when {
                    isCmpTurn -> if (winsCmp) "cmp" else "cmp-loss"
                    else -> "safe"
                }

                cycles.add(
                    mapOf(
                        "cycleIndex" to cycleIdx,
                        "startTurn" to prevTurn,
                        "readyTurn" to readyTurn,
                        "turnSpan" to turnSpan,
                        "widthPct" to widthPct,
                        "startTap" to startTap,
                        "readyTap" to readyTap,
                        "rangeLabel" to rangeLabel,
                        "readyLabel" to "#$readyTap",
                        "hasZeroSneak" to cycleHasZeroSneak,
                        "readyState" to cycleReadyState
                    )
                )

                prevTurn = readyTurn
                prevDisplayTap = readyTap
            }

            val firstCycle = cycles.firstOrNull()
            val hasZeroSneak = (firstCycle?.get("hasZeroSneak") as? Boolean) ?: false
            val safeThrowLabel = (firstCycle?.get("rangeLabel") as? String)?.takeIf { it.isNotEmpty() }
                ?: if (myTapsNeeded <= 1) "1" else "1–${myTapsNeeded - 1}"
            val readyState = (firstCycle?.get("readyState") as? String) ?: "safe"

            val oppDamages = (0..2).map { slotIdx ->
                if (slotIdx < displayList.size) {
                    val oppNameSlot = displayList[slotIdx]
                    val rawBaseKeySlot = FormResolver.extractBaseSpecies(oppNameSlot).lowercase()
                    val isSlotShadow = manualShadowOverrides[rawBaseKeySlot] ?: (if (slotIdx == activeOpponentSlotIndex) isOpponentShadow else oppNameSlot.contains("Shadow", ignoreCase = true))
                    val oppMetaSlot = OverlayService.computeEffectiveCombatStats(getPokemonMeta(oppNameSlot, activeLeague, isSlotShadow), activeLeague)
                    val oDmgPct = calculateChargedMoveDamagePercent(
                        attacker = userMeta,
                        defender = oppMetaSlot,
                        moveName = mName,
                        isAttackerShadow = isUserShadow,
                        isDefenderShadow = isSlotShadow
                    )
                    val oEff = getTypeEffectiveness(mStats.type, oppMetaSlot.types)
                    val tier = when {
                        oDmgPct >= 65 || oEff >= 1.5 -> "high"
                        oDmgPct <= 35 || oEff <= 0.65 -> "low"
                        else -> "neutral"
                    }
                    mapOf(
                        "name" to oppMetaSlot.name,
                        "code" to abbrPokemon3(oppMetaSlot.name, isSlotShadow),
                        "dmgPct" to oDmgPct,
                        "eff" to oEff,
                        "tier" to tier,
                        "isActive" to (slotIdx == activeOpponentSlotIndex)
                    )
                } else {
                    mapOf(
                        "name" to "—",
                        "code" to "—",
                        "dmgPct" to null,
                        "eff" to 1.0,
                        "tier" to "empty",
                        "isActive" to false
                    )
                }
            }

            mapOf(
                "name" to mName,
                "shortName" to abbrMove5(mName),
                "energy" to mEnergy,
                "myTapsNeeded" to myTapsNeeded,
                "myReadyTurn" to myReadyTurn,
                "dmgPct" to dmgPct,
                "eff" to eff,
                "state" to readyState,
                "safeThrowLabel" to safeThrowLabel,
                "hasZeroSneak" to hasZeroSneak,
                "maxHorizonTurns" to maxHorizonTurns,
                "cycles" to cycles,
                "oppDamages" to oppDamages
            )
        }

        // v3.40: Compute Real-Time Tactical Lead, HP-Scaled Counter-Swap Minimax, Shield Callout, Post-Faint & Endgame Recommendation
        val teamArchetype = (currentPreset?.archetype ?: "ABC").uppercase()
        val oppFullNameForMatrix = if (isOpponentShadow && !oppMeta.name.startsWith("Shadow ", ignoreCase = true)) {
            "Shadow ${oppMeta.name}"
        } else {
            oppMeta.name
        }
        val teamSlotsList = listOf(p1, p2, p3)
        val activeSlotIdxSafe = activeUserSlotIndex.coerceIn(0, 2)
        val activeOppSlotSafe = activeOpponentSlotIndex.coerceIn(0, 2)
        val activeUserHp = if (playerFaintedSlots[activeSlotIdxSafe]) 0 else playerSlotHpPct[activeSlotIdxSafe].coerceIn(1, 100)
        val activeOppHp = if (oppFaintedSlots[activeOppSlotSafe]) 0 else oppSlotHpPct[activeOppSlotSafe].coerceIn(1, 100)

        fun slotBrAgainst(slotIdx: Int, targetOppName: String, uS: Int, oS: Int): Int {
            val s = teamSlotsList.getOrNull(slotIdx)
            val sName = s?.name ?: teamNames.getOrElse(slotIdx) { "Dialga (Origin)" }
            val baseBr = OverlayService.getOverlayRealtimeMatchupRatingStatic(
                myName = sName,
                oppName = targetOppName,
                userShields = uS.coerceIn(0, 2),
                oppShields = oS.coerceIn(0, 2),
                league = activeLeague,
                myFastMove = s?.fastMove,
                myCharged1 = s?.chargedMove1,
                myCharged2 = s?.chargedMove2,
                myCp = s?.cp,
                myIvs = s?.ivs
            )
            val uHp = if (slotIdx in 0..2 && !playerFaintedSlots[slotIdx]) playerSlotHpPct[slotIdx].coerceIn(1, 100) else 100
            val targetBase = FormResolver.extractBaseSpecies(targetOppName).lowercase()
            val oIdx = displayList.indexOfFirst { FormResolver.extractBaseSpecies(it).equals(targetBase, ignoreCase = true) }
            val oHp = if (oIdx in 0..2 && !oppFaintedSlots[oIdx]) oppSlotHpPct[oIdx].coerceIn(1, 100) else 100
            return scaleBrByHpRatio(baseBr, uHp, oHp)
        }
        fun slotBr(slotIdx: Int, uS: Int, oS: Int): Int = slotBrAgainst(slotIdx, oppFullNameForMatrix, uS, oS)

        val curEqS = min(playerShieldsRemaining, oppShieldsRemaining).coerceIn(0, 2)
        val curBr = slotBr(activeSlotIdxSafe, playerShieldsRemaining, oppShieldsRemaining)
        val br0s = slotBr(activeSlotIdxSafe, 0, 0)
        val br1s = slotBr(activeSlotIdxSafe, 1, 1)
        val br2s = slotBr(activeSlotIdxSafe, 2, 2)

        val playerAliveCount = (3 - playerFaintedSlots.count { it }).coerceIn(1, 3)
        val oppAliveCount = (3 - oppFaintedSlots.count { it }).coerceIn(1, 3)

        // v3.44: Shield Calls Based on Top 2 Charged Attacks Only + Attack 3/4 KO Warning + 1 Extra Frame HP Confirmation
        val confirmedUserHp = if (playerFaintedSlots[activeSlotIdxSafe]) {
            0
        } else {
            confirmedPlayerSlotHpPct[activeSlotIdxSafe].coerceIn(1, 100)
        }
        val confirmedOppHp = if (oppFaintedSlots[activeOppSlotSafe]) {
            0
        } else {
            confirmedOppSlotHpPct[activeOppSlotSafe].coerceIn(1, 100)
        }
        val isPlayerHpExtraFrameConfirmed = playerSlotHpConfirmFrames[activeSlotIdxSafe] >= 2

        val top2OppMoveRows = oppMoveTimingRows.take(2)
        val top2OppDmgPcts = top2OppMoveRows.mapNotNull { it["activeDmgPct"] as? Int }
        val maxOppMoveDmgPct = top2OppDmgPcts.maxOrNull() ?: 55
        val minOppMoveDmgPct = top2OppDmgPcts.minOrNull() ?: 35

        // Evaluate Attack 3 & Attack 4 specifically for coverage KO warning against confirmedUserHp (only if <2 confirmed moves are known)
        val oppMove3DmgPct = if (activeOppConfirmedSet.size < 2 && activeOppThirdMove.isNotBlank()) {
            calculateChargedMoveDamagePercent(
                attacker = oppMeta,
                defender = userMeta,
                moveName = activeOppThirdMove,
                isAttackerShadow = isOpponentShadow,
                isDefenderShadow = isUserShadow
            )
        } else 0
        val oppMove4DmgPct = if (activeOppConfirmedSet.size < 2 && activeOppFourthMove.isNotBlank()) {
            calculateChargedMoveDamagePercent(
                attacker = oppMeta,
                defender = userMeta,
                moveName = activeOppFourthMove,
                isAttackerShadow = isOpponentShadow,
                isDefenderShadow = isUserShadow
            )
        } else 0

        val altKoAlerts = mutableListOf<Triple<String, String, Int>>()
        if (confirmedUserHp > 0 && oppMove3DmgPct >= (confirmedUserHp - 5)) {
            altKoAlerts.add(Triple("M3", activeOppThirdMove, oppMove3DmgPct))
        }
        if (confirmedUserHp > 0 && oppMove4DmgPct >= (confirmedUserHp - 5)) {
            altKoAlerts.add(Triple("M4", activeOppFourthMove, oppMove4DmgPct))
        }
        val hasAltMoveKoRisk = altKoAlerts.isNotEmpty()
        val topAltKo = altKoAlerts.maxByOrNull { it.third }
        val altKoBadgeShort = if (topAltKo != null) {
            "⚠️${topAltKo.first} ${abbrMove5(topAltKo.second)} KO"
        } else ""
        val altKoGoalWarning = if (altKoAlerts.isNotEmpty()) {
            val parts = altKoAlerts.joinToString("/") { "${it.first} ${abbrMove5(it.second)}(${it.third}%)" }
            "⚠️$parts can KO!"
        } else ""

        val oppBaitKosActive = confirmedUserHp > 0 && minOppMoveDmgPct >= (confirmedUserHp - 3)
        val oppNukeKosActive = confirmedUserHp > 0 && maxOppMoveDmgPct >= (confirmedUserHp - 5)
        val safeToTankAllMoves = confirmedUserHp > 0 && maxOppMoveDmgPct <= (confirmedUserHp - 18)

        var shieldPlanStr = when {
            playerShieldsRemaining == 0 -> "0S"
            oppBaitKosActive && confirmedOppHp > 20 && (curBr >= activeTierSlMax || playerAliveCount == 1) -> "1S (KO Risk)"
            oppNukeKosActive && confirmedOppHp > 22 && (br1s >= activeTierLMax || playerAliveCount == 1) -> "1S (KO @${confirmedUserHp}%)"
            safeToTankAllMoves && br0s >= activeTierLMax -> if (hasAltMoveKoRisk) "0S ($altKoBadgeShort)" else "0S (Tank)"
            br0s >= activeTierWMin && br0s >= br1s - 25 -> if (hasAltMoveKoRisk) "0S ($altKoBadgeShort)" else "0S"
            playerShieldsRemaining >= 2 && br2s >= activeTierWMin && br2s > br1s + 35 -> "2S"
            br1s >= activeTierLMax -> "1S"
            br0s >= 445 -> if (hasAltMoveKoRisk) "0S ($altKoBadgeShort)" else "0S"
            else -> if (hasAltMoveKoRisk) "1S->0S ($altKoBadgeShort)" else "1S->0S"
        }

        val canPlayerSwap = playerSwapRemainingSec <= 0
        val aliveBenchIndices = (0..2).filter { !playerFaintedSlots[it] && (isPostFaintSwitchPromptActive || it != activeSlotIdxSafe) }
        val isLeadPhase = activeOpponentSlotIndex == 0 &&
            activeSlotIdxSafe == 0 &&
            oppSwapRemainingSec <= 0 &&
            detectedOpponents.size <= 1 &&
            playerAliveCount == 3 &&
            oppAliveCount == 3 &&
            !isPostFaintSwitchPromptActive &&
            !isAttackIncomingPromptActive

        // Known alive bench opponents (excluding current active opponent)
        val revealedBenchOpponents = detectedOpponents.mapIndexedNotNull { idx, oName ->
            val oBase = FormResolver.extractBaseSpecies(oName)
            if (oBase.equals(oppMeta.baseSpecies, ignoreCase = true) || (idx in 0..2 && oppFaintedSlots[idx])) null else oName
        }

        // v5.02 Show 6 Live AI Constraint + Common Core Unrevealed Backline Boost:
        // When in Show 6 mode, limit unseen backline predictions strictly to unrevealed Pokémon from Opponent's known 6,
        // and boost the likelihood of any unrevealed Pokémon that forms a Most-Used Battle Frontier Core with a revealed opponent Pokémon.
        val isShow6ModeActive = ::prefs.isInitialized && prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
        val revealedOppAll = (detectedOpponents + listOf(activeOpponentName)).filter { it.isNotBlank() }.distinct()
        val knownShow6UnrevealedPool: List<String> = if (isShow6ModeActive && ::prefs.isInitialized) {
            val rawJson = prefs.getString(PREFS_KEY_SHOW6_OPPONENT_6, "[]") ?: "[]"
            val parsed6: List<String> = try {
                gson.fromJson(rawJson, object : TypeToken<List<String>>() {}.type) ?: emptyList()
            } catch (_: Exception) {
                emptyList()
            }
            val seenBaseSet = revealedOppAll
                .map { FormResolver.extractBaseSpecies(it).lowercase() }
                .filter { it.isNotEmpty() }
                .toSet()
            parsed6.map { it.trim() }.filter { cand ->
                cand.isNotEmpty() && FormResolver.extractBaseSpecies(cand).lowercase() !in seenBaseSet
            }
        } else {
            emptyList()
        }

        // Compute Common Core weights for each unrevealed Show 6 opponent Pokémon based on revealed opponent Pokémon
        val show6UnrevealedWeights: Map<String, Double> = if (knownShow6UnrevealedPool.isNotEmpty()) {
            val wUsage = activeShow6UsageWeightPct.coerceIn(0, 100) / 100.0
            knownShow6UnrevealedPool.associateWith { uOpp ->
                val coreSum = revealedOppAll.sumOf { rev ->
                    OverlayService.findShow6CommonCoreEntryStatic(activeLeague, rev, uOpp)?.usagePct ?: 0.0
                }
                val indivUsage = OverlayService.getShow6UsagePctStatic(activeLeague, uOpp)
                1.0 + wUsage * (coreSum * 0.055 + indivUsage * 0.015)
            }
        } else {
            emptyMap()
        }
        val topShow6UnrevealedCoreNote: String? = if (knownShow6UnrevealedPool.isNotEmpty()) {
            var bestPartner = ""
            var bestLead = ""
            var bestPct = 0.0
            for (uOpp in knownShow6UnrevealedPool) {
                for (rev in revealedOppAll) {
                    val c = OverlayService.findShow6CommonCoreEntryStatic(activeLeague, rev, uOpp)
                    if (c != null && c.usagePct > bestPct) {
                        bestPct = c.usagePct
                        bestPartner = uOpp
                        bestLead = rev
                    }
                }
            }
            if (bestPartner.isNotEmpty() && bestPct > 0.0) {
                "🔥 Core Watch: ${abbrPokemon3(bestPartner)} w/ ${abbrPokemon3(bestLead)} (${bestPct.roundToInt()}%)"
            } else null
        } else null

        // Score alive bench candidates across Active Opp (45%), Swap Clocks (25%), Known Bench (20%), Unseen Meta / Known Show 6 Unrevealed (10%) + v3.41 persistent HP penalty
        val candidateScoreMap = mutableMapOf<String, Int>()
        val candidateWorstRespMap = mutableMapOf<Int, Int>()
        for (bIdx in aliveBenchIndices) {
            val bName = teamNames.getOrElse(bIdx) { "Slot ${bIdx + 1}" }
            val bHp = playerSlotHpPct[bIdx].coerceIn(1, 100)
            val actBr = slotBr(bIdx, playerShieldsRemaining, oppShieldsRemaining)
            val zeroBr = slotBr(bIdx, 0, 0)
            val oneBr = slotBr(bIdx, 1, 1)
            val worstResp = if (revealedBenchOpponents.isNotEmpty()) {
                revealedBenchOpponents.minOf { bOpp -> slotBrAgainst(bIdx, bOpp, playerShieldsRemaining, oppShieldsRemaining) }
            } else if (knownShow6UnrevealedPool.isNotEmpty()) {
                knownShow6UnrevealedPool.minOf { uOpp -> slotBrAgainst(bIdx, uOpp, playerShieldsRemaining, oppShieldsRemaining) }
            } else {
                min(actBr, oneBr)
            }
            candidateWorstRespMap[bIdx] = worstResp
            val activeFactor = actBr * 0.65 + zeroBr * 0.35
            val clockFactor = if (oppSwapRemainingSec >= 12 || oppAliveCount == 1) {
                actBr * 1.18
            } else {
                actBr * 0.55 + worstResp * 0.45
            }
            val weightSum = show6UnrevealedWeights.values.sum().takeIf { it > 0.0 } ?: 1.0
            val knownBenchFactor = if (revealedBenchOpponents.isNotEmpty()) {
                revealedBenchOpponents.map { bOpp -> slotBrAgainst(bIdx, bOpp, playerShieldsRemaining, oppShieldsRemaining) }.average()
            } else if (knownShow6UnrevealedPool.isNotEmpty()) {
                knownShow6UnrevealedPool.sumOf { uOpp ->
                    slotBrAgainst(bIdx, uOpp, playerShieldsRemaining, oppShieldsRemaining) * (show6UnrevealedWeights[uOpp] ?: 1.0)
                } / weightSum
            } else {
                oneBr.toDouble()
            }
            val unseenMetaFactor = if (knownShow6UnrevealedPool.isNotEmpty()) {
                knownShow6UnrevealedPool.sumOf { uOpp ->
                    slotBrAgainst(bIdx, uOpp, 1, 1) * (show6UnrevealedWeights[uOpp] ?: 1.0)
                } / weightSum
            } else {
                ((actBr + oneBr) / 2.0)
            }
            val lowHpPenalty = when {
                bHp < 25 && activeOppHp > 22 -> -110
                bHp < 40 && activeOppHp > 35 -> -45
                else -> 0
            }
            val compScore = (activeFactor * 0.45 + clockFactor * 0.25 + knownBenchFactor * 0.20 + unseenMetaFactor * 0.10 + lowHpPenalty).roundToInt()
            candidateScoreMap[bName] = compScore
        }

        // v6.00 Pillar 1: Personalized Blended Backline Prediction (Meta Cores + Learned Season Logs + Same-CP Std League Blend)
        val currentSeasonLogsForAi = if (::prefs.isInitialized) {
            OverlayService.loadSeasonLogsForLeagueStatic(prefs, gson, activeLeague, isShow6 = isShow6ModeActive)
        } else emptyList()
        val sameCpStdLogsForAi = if (::prefs.isInitialized) {
            OverlayService.loadSameCpStandardSeasonLogsForLimitedCupStatic(prefs, gson, activeLeague, isShow6 = isShow6ModeActive)
        } else emptyList()
        val backlinePred = OverlayService.predictOpponentBacklineStatic(
            league = activeLeague,
            revealedOpponents = displayList,
            myTeamSlots = teamSlotsList.filterNotNull(),
            myActiveSlotIdx = activeSlotIdxSafe,
            playerFaintedSlots = playerFaintedSlots,
            isShow6 = isShow6ModeActive,
            knownShow6UnrevealedPool = knownShow6UnrevealedPool,
            seasonLogs = currentSeasonLogsForAi,
            sameCpStandardLogs = sameCpStdLogsForAi
        )

        var recPhase = if (isLeadPhase) "LEAD" else "MIDGAME"
        var recAction = "STAY IN"
        var recGoal = "Hold Switch Adv"
        var recTone = "stay"
        var recSwapIdx = -1
        var timingAlertLevel = "NORMAL" // "NORMAL" | "WARN_2_FASTS" | "BLINK_1_FAST" | "IMMEDIATE_0_FAST"

        val oppSwitchLockActive = !lastOppSwitchWasFaint && oppSwapRemainingSec >= 12
        val oppCanCounterSwap = lastOppSwitchWasFaint || oppSwapRemainingSec <= 8

        // v6.00 Pillar 3 & Pillar 4 Live Fast-Move / Energy / Catch Timing Math
        val activeUserEnergyNow = playerSlotEnergy.getOrElse(activeSlotIdxSafe) { 0 }.coerceIn(0, 100)
        val activeOppEnergyNow = oppSlotEnergy.getOrElse(activeOppSlotSafe) { 0 }.coerceIn(0, 100)
        val userFastExactDmgPct = calculateFastMoveExactDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            fastMoveName = userFastMoveName,
            fastTurns = userFastTurns,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        ).coerceAtLeast(0.4)
        val oppFastExactDmgPct = calculateFastMoveExactDamagePercent(
            attacker = oppMeta,
            defender = userMeta,
            fastMoveName = oppFastMoveName,
            fastTurns = oppFastTurns,
            isAttackerShadow = isOpponentShadow,
            isDefenderShadow = isUserShadow
        ).coerceAtLeast(0.4)

        val myFastsToKoOpp = if (activeOppHp <= 0) 0 else kotlin.math.ceil(activeOppHp.toDouble() / userFastExactDmgPct).toInt().coerceAtLeast(1)
        val oppFastsToKoMe = if (activeUserHp <= 0) 0 else kotlin.math.ceil(activeUserHp.toDouble() / oppFastExactDmgPct).toInt().coerceAtLeast(1)

        // Player's cheapest / highest-priority next charged move
        val uMove1Cost = (OverlayService.resolveChargedMoveStatsStatic(userMove1Name, userMeta.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
        val uMove2Cost = (OverlayService.resolveChargedMoveStatsStatic(userMove2Name, userMeta.types.firstOrNull() ?: "normal").energyCost.takeIf { it > 0 } ?: 50).coerceIn(35, 100)
        val (myBestMoveName, myBestMoveCost) = when {
            myMove1Pct >= activeOppHp && activeUserEnergyNow >= uMove1Cost -> userMove1Name to uMove1Cost
            myMove2Pct >= activeOppHp && activeUserEnergyNow >= uMove2Cost -> userMove2Name to uMove2Cost
            uMove1Cost <= uMove2Cost -> userMove1Name to uMove1Cost
            else -> userMove2Name to uMove2Cost
        }
        val myBestMoveShort = OverlayService.abbrMoveCompactStatic(myBestMoveName)
        val myFastsNeededForNextMove = if (activeUserEnergyNow >= myBestMoveCost) {
            0
        } else {
            kotlin.math.ceil((myBestMoveCost - activeUserEnergyNow).toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
        }

        // Opponent's next threatening charged move & turns until ready
        val oppCheapestMoveRow = oppMoveTimingRows.minByOrNull { (it["energy"] as? Int) ?: 50 }
        val oppNextMoveName = (oppCheapestMoveRow?.get("name") as? String) ?: oppMeta.chargedMove1
        val oppNextMoveShort = OverlayService.abbrMoveCompactStatic(oppNextMoveName)
        val oppNextMoveCost = ((oppCheapestMoveRow?.get("energy") as? Int) ?: 45).coerceIn(35, 100)
        val oppFastsToNextMove = if (activeOppEnergyNow >= oppNextMoveCost) {
            0
        } else {
            kotlin.math.ceil((oppNextMoveCost - activeOppEnergyNow).toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
        }
        val turnsUntilOppCharged = oppFastsToNextMove * oppFastTurns
        val safeMyFastsBeforeOppMove = when {
            oppFastsToNextMove <= 0 -> 0
            winsCmp -> (turnsUntilOppCharged / userFastTurns).coerceAtLeast(0)
            else -> ((turnsUntilOppCharged - 1).coerceAtLeast(0) / userFastTurns)
        }
        val canFarmDownBeforeOppMove = activeOppHp in 1..38 &&
            myFastsToKoOpp <= safeMyFastsBeforeOppMove &&
            myFastsToKoOpp < oppFastsToKoMe &&
            myFastsToKoOpp <= 6

        // Evaluate Catch Viability on alive bench teammates against oppNextMoveName
        var bestCatchBenchIdx = -1
        var bestCatchBenchCode = ""
        if (canPlayerSwap && aliveBenchIndices.isNotEmpty() && !isPostFaintSwitchPromptActive) {
            val nextMoveTeamDmgs = (oppCheapestMoveRow?.get("teamDamages") as? List<*>)
            var bestCatchScore = -999
            for (bIdx in aliveBenchIndices) {
                val bHp = playerSlotHpPct[bIdx].coerceIn(1, 100)
                val bName = teamNames.getOrElse(bIdx) { "Slot ${bIdx + 1}" }
                val dmgEntry = nextMoveTeamDmgs?.getOrNull(bIdx) as? Map<*, *>
                val bDmgPct = (dmgEntry?.get("dmgPct") as? Int) ?: 40
                val bEff = (dmgEntry?.get("eff") as? Double) ?: 1.0
                val isResistedTankCatch = bHp > bDmgPct + 15 && (bEff <= 0.72 || bDmgPct <= 26) && (maxOppMoveDmgPct >= activeUserHp - 15 || oppNextMoveCost <= 50)
                val isSacrificialLowHpCatch = bHp in 1..20 && activeUserHp >= 40 && maxOppMoveDmgPct >= 35
                if (isResistedTankCatch || isSacrificialLowHpCatch) {
                    val catchScore = if (isSacrificialLowHpCatch) 90 else (75 - bDmgPct)
                    if (catchScore > bestCatchScore) {
                        bestCatchScore = catchScore
                        bestCatchBenchIdx = bIdx
                        bestCatchBenchCode = OverlayService.abbrPokeCompactStatic(bName)
                    }
                }
            }
        }

        // Pillar 4 math for Incoming Charged Move prompt (Tank & Reach Next Charged Move Before Fainting)
        val postHitHpAfterPrimaryMove = (confirmedUserHp - minOppMoveDmgPct).coerceAtLeast(0)
        val oppFastsSurvivedAfterHit = if (postHitHpAfterPrimaryMove <= 1) {
            0
        } else {
            kotlin.math.floor((postHitHpAfterPrimaryMove - 1).toDouble() / oppFastExactDmgPct).toInt().coerceAtLeast(0)
        }
        val turnsSurvivedAfterHit = oppFastsSurvivedAfterHit * oppFastTurns
        val canTankAndReachNextMove = postHitHpAfterPrimaryMove >= 8 &&
            !oppNukeKosActive &&
            (myFastsNeededForNextMove == 0 || turnsSurvivedAfterHit >= myFastsNeededForNextMove * userFastTurns)
        val fastsShortAfterTank = if (canTankAndReachNextMove) {
            0
        } else {
            kotlin.math.ceil(((myFastsNeededForNextMove * userFastTurns) - turnsSurvivedAfterHit).toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(1)
        }

        if (isAttackIncomingPromptActive && playerShieldsRemaining >= 1 && !isPostFaintSwitchPromptActive) {
            // Pillar 4: INSTANT "ATTACK INCOMING!" SHIELD CALLOUT + Tank-to-Reach-Next-Move Evaluation
            recPhase = "SHIELD_CALL"
            val maxMoveKos = maxOppMoveDmgPct >= confirmedUserHp - 8
            val minMoveKos = minOppMoveDmgPct >= confirmedUserHp - 5
            val healthyBenchExists = aliveBenchIndices.any { confirmedPlayerSlotHpPct[it] >= 55 && slotBr(it, playerShieldsRemaining, oppShieldsRemaining) >= activeTierWMin }
            if (minMoveKos || (maxMoveKos && (curBr >= activeTierLMax || !healthyBenchExists || playerAliveCount == 1))) {
                recAction = "SHIELD (1S) · KO RISK"
                shieldPlanStr = "1S"
                recTone = "swap"
                recGoal = "${oppNextMoveShort} KOs (${maxOppMoveDmgPct}% vs ${confirmedUserHp}% HP)"
            } else if (!minMoveKos && !canTankAndReachNextMove && activeOppHp > 20 && (curBr >= activeTierSlMax || playerAliveCount == 1)) {
                recAction = "SHIELD (1S) -> DIES ${fastsShortAfterTank}F SHORT OF $myBestMoveShort!"
                shieldPlanStr = "1S"
                recTone = "swap"
                recGoal = "Tank leaves ${postHitHpAfterPrimaryMove}% HP (Farmed before $myBestMoveShort)"
            } else {
                val reachStr = if (myFastsNeededForNextMove == 0) "$myBestMoveShort RDY" else "$myBestMoveShort IN ${myFastsNeededForNextMove}F"
                recAction = if (hasAltMoveKoRisk) "TANK (0S) · ⚠️${topAltKo?.first ?: "M3"} KO" else "TANK (0S) -> $reachStr"
                shieldPlanStr = "0S"
                recTone = if (hasAltMoveKoRisk) "bait" else "stay"
                recGoal = "Survives at ${postHitHpAfterPrimaryMove}% HP & fires $myBestMoveShort"
            }
        } else if (isPostFaintSwitchPromptActive && aliveBenchIndices.isNotEmpty()) {
            // 1. POST-FAINT "Switch in a new Pokémon?" Replacement Recommendation
            recPhase = "POST_FAINT_SWAP"
            val sortedBench = aliveBenchIndices.sortedByDescending { idx ->
                candidateScoreMap[teamNames.getOrElse(idx) { "" }] ?: slotBr(idx, playerShieldsRemaining, oppShieldsRemaining)
            }
            val bestIdx = sortedBench.first()
            val secondIdx = sortedBench.getOrNull(1)
            val bestCode = OverlayService.abbrPokeCompactStatic(teamNames[bestIdx])
            val bestBr = slotBr(bestIdx, playerShieldsRemaining, oppShieldsRemaining)
            val bestHp = playerSlotHpPct[bestIdx].coerceIn(1, 100)
            val holdText = if (secondIdx != null) " (HOLD ${OverlayService.abbrPokeCompactStatic(teamNames[secondIdx])})" else ""
            recAction = "SEND -> $bestCode$holdText"
            recSwapIdx = bestIdx
            recTone = if (bestBr >= activeTierWMin) "stay" else "counter"
            shieldPlanStr = if (playerShieldsRemaining > 0) "${playerShieldsRemaining}S" else "0S"
            recGoal = when {
                oppSwapRemainingSec >= 12 -> "Punish ${oppSwapRemainingSec}s Lock ($bestCode ${bestHp}%)"
                oppAliveCount == 1 -> "Close Last Opp ($bestCode ${bestHp}%)"
                else -> "Best Entry ($bestCode ${bestHp}% vs ${activeOppHp}%)"
            }
        } else if (canFarmDownBeforeOppMove) {
            // Pillar 3A: Exact Fast-Move Farm-Down Before Opponent Reaches Next Charged Move
            recPhase = "FARM_DOWN"
            recAction = "FARM DOWN: ${myFastsToKoOpp}F TO KO"
            shieldPlanStr = "0S"
            recGoal = "No Throw · Opp ${oppFastsToNextMove}F (${turnsUntilOppCharged}T) to $oppNextMoveShort"
            recTone = "stay"
            timingAlertLevel = "NORMAL"
        } else if (
            enableEnergyTracking &&
            safeMyFastsBeforeOppMove in 0..2 &&
            activeOppHp > 12 &&
            (myFastsNeededForNextMove <= safeMyFastsBeforeOppMove || bestCatchBenchIdx in 0..2)
        ) {
            // Pillar 3B: Unified Throw & Catch Timing Countdown (2F Highlight -> 1F Blink -> 0F Immediate)
            // v6.06: Tie BLINK_1_FAST & double vibration alert to configurable `activeHapticChargeTimingFasts` (1 or 2 fast moves)
            recPhase = "THROW_CATCH_TIMING"
            val canThrowMineBeforeOpp = myFastsNeededForNextMove <= safeMyFastsBeforeOppMove
            val useCatchCall = !canThrowMineBeforeOpp && bestCatchBenchIdx in 0..2 ||
                (bestCatchBenchIdx in 0..2 && oppShieldsRemaining > 0 && curBr <= activeTierLMax)
            val chargeWarnBlinkThreshold = activeHapticChargeTimingFasts.coerceIn(1, 2)
            if (useCatchCall && bestCatchBenchIdx in 0..2) {
                recSwapIdx = bestCatchBenchIdx
                when {
                    safeMyFastsBeforeOppMove in 1..chargeWarnBlinkThreshold -> {
                        timingAlertLevel = "BLINK_1_FAST"
                        recAction = if (safeMyFastsBeforeOppMove == 1) {
                            "🚨 1 LAST FAST -> CATCH ON $bestCatchBenchCode!"
                        } else {
                            "🚨 ${safeMyFastsBeforeOppMove}F -> CATCH $oppNextMoveShort ON $bestCatchBenchCode!"
                        }
                        recTone = "swap"
                    }
                    safeMyFastsBeforeOppMove == 2 -> {
                        timingAlertLevel = "WARN_2_FASTS"
                        recAction = "⚠️ 2F -> CATCH $oppNextMoveShort ON $bestCatchBenchCode"
                        recTone = "bait"
                    }
                    else -> {
                        timingAlertLevel = "IMMEDIATE_0_FAST"
                        recAction = "🛑 0F LEFT -> CATCH $oppNextMoveShort ON $bestCatchBenchCode!"
                        recTone = "swap"
                    }
                }
                recGoal = "Opp ${activeOppEnergyNow}E/${oppNextMoveCost}E ($oppNextMoveShort)"
            } else {
                when {
                    safeMyFastsBeforeOppMove in 1..chargeWarnBlinkThreshold -> {
                        timingAlertLevel = "BLINK_1_FAST"
                        recAction = if (safeMyFastsBeforeOppMove == 1) {
                            "🚨 1 LAST FAST -> THROW $myBestMoveShort NOW!"
                        } else {
                            "🚨 ${safeMyFastsBeforeOppMove}F -> THROW $myBestMoveShort (Pre-$oppNextMoveShort)!"
                        }
                        recTone = "swap"
                    }
                    safeMyFastsBeforeOppMove == 2 -> {
                        timingAlertLevel = "WARN_2_FASTS"
                        recAction = "⚠️ 2F -> THROW $myBestMoveShort (Pre-$oppNextMoveShort)"
                        recTone = "bait"
                    }
                    else -> {
                        timingAlertLevel = "IMMEDIATE_0_FAST"
                        recAction = "🛑 0F LEFT -> THROW $myBestMoveShort NOW!"
                        recTone = "swap"
                    }
                }
                recGoal = "Beat Opp $oppNextMoveShort (${activeOppEnergyNow}E/${oppNextMoveCost}E)"
            }
        } else if (playerAliveCount == 1 && oppAliveCount == 1) {
            // 2A. 1v1 ENDGAME AWARENESS
            recPhase = "ENDGAME"
            if (playerShieldsRemaining > 0 && oppShieldsRemaining == 0) {
                recAction = "CLOSE 1v1 (BURN ${playerShieldsRemaining}S)"
                shieldPlanStr = "${playerShieldsRemaining}S"
                recGoal = "Shield 1st Move to Close (${activeUserHp}% vs ${activeOppHp}%)"
                recTone = if (curBr >= 500) "stay" else "bait"
            } else if (playerShieldsRemaining > 0 && oppShieldsRemaining > 0) {
                val needBait = br0s < 480 && br1s >= 500
                recAction = if (needBait) "1v1 BAIT -> NUKE" else "1v1 COMMIT ${playerShieldsRemaining}S"
                shieldPlanStr = "${playerShieldsRemaining}S"
                recGoal = "Out-Pace 1v1 ($myBestMoveShort in ${myFastsNeededForNextMove}F)"
                recTone = if (curBr >= 500) "stay" else "bait"
            } else {
                recAction = if (myFastsToKoOpp <= safeMyFastsBeforeOppMove) "1v1 FARM (${myFastsToKoOpp}F)" else "1v1 RACE -> $myBestMoveShort"
                shieldPlanStr = "0S"
                recGoal = "You ${myFastsNeededForNextMove}F to $myBestMoveShort vs Opp ${oppFastsToNextMove}F to $oppNextMoveShort"
                recTone = if (br0s >= 500) "stay" else "swap"
            }
        } else if (playerAliveCount >= 2 && oppAliveCount == 1) {
            // 2B. 2v1 ENDGAME AWARENESS
            recPhase = "ENDGAME"
            val bestBenchIdx = aliveBenchIndices.maxByOrNull { slotBr(it, playerShieldsRemaining, oppShieldsRemaining) }
            val bestBenchBr = if (bestBenchIdx != null) slotBr(bestBenchIdx, playerShieldsRemaining, oppShieldsRemaining) else curBr
            val bestBenchCode = if (bestBenchIdx != null) OverlayService.abbrPokeCompactStatic(teamNames[bestBenchIdx]) else "BACK"
            if (canPlayerSwap && bestBenchIdx != null && bestBenchBr >= curBr + 75 && curBr < 475) {
                recAction = "SWAP -> $bestBenchCode TO CLOSE"
                recSwapIdx = bestBenchIdx
                recTone = "stay"
                recGoal = "Last Opp at ${activeOppHp}% HP"
            } else {
                recAction = if (curBr >= activeTierWMin) "2v1 PRESS -> FINISH" else "2v1 CHIP FOR $bestBenchCode"
                recTone = "stay"
                recGoal = "Last Opp at ${activeOppHp}% HP (${playerAliveCount}v1 Adv)"
            }
        } else if (playerAliveCount == 1 && oppAliveCount >= 2) {
            // 2C. 1v2 ENDGAME AWARENESS
            recPhase = "ENDGAME"
            val backOppCode = revealedBenchOpponents.firstOrNull()?.let { OverlayService.abbrPokeCompactStatic(it) }
                ?: backlinePred.candidates.firstOrNull()?.code
                ?: "BACK"
            recAction = if (playerShieldsRemaining > 0) "1v2 FARM FOR $backOppCode" else "1v2 OVERFARM & NUKE"
            shieldPlanStr = if (playerShieldsRemaining > 0) "Hold 1S" else "0S"
            recGoal = "Bank E Before $backOppCode Enters"
            recTone = if (curBr >= 500) "bait" else "swap"
        } else if (isLeadPhase) {
            // Pillar 2: Lead Swap / Stay Advice Conditioned on Backline Hard-Counter Risk
            val pivotIdx = if (1 in aliveBenchIndices) 1 else aliveBenchIndices.firstOrNull()
            val pivotCode = if (pivotIdx != null) OverlayService.abbrPokeCompactStatic(teamNames[pivotIdx]) else "SWAP"
            val backlineWeakToLead = (1..2).any { bIdx -> slotBr(bIdx, curEqS, curEqS) <= activeTierLMax }
            val highBacklinePunishRisk = backlinePred.swapPunishRiskPct >= 45

            if (curBr >= activeTierSwMin) {
                recAction = "STAY IN (WIN LEAD)"
                recGoal = "Dominate & Hold Switch"
                recTone = "stay"
            } else if (curBr >= activeTierWMin) {
                recAction = "STAY IN"
                recGoal = if (br0s >= activeTierWMin && !oppNukeKosActive) "Win 0S & Bank Energy" else "Commit $shieldPlanStr for Switch"
                recTone = "stay"
            } else if (teamArchetype == "ABB" && backlineWeakToLead && curBr >= activeTierSlMax) {
                recAction = "STAY IN (ABB LEAD)"
                recGoal = "Chip Backline Threat"
                recTone = "stay"
            } else if (curBr > activeTierLMax) {
                if (teamArchetype == "ABB" && pivotIdx != null && canPlayerSwap && !highBacklinePunishRisk) {
                    recAction = "CHIP -> SWAP $pivotCode"
                    recGoal = "Lure Threat (SwpRsk ${backlinePred.swapPunishRiskPct}%)"
                    recTone = "bait"
                    recSwapIdx = pivotIdx
                } else {
                    recAction = "STAY / SOFT LOSE"
                    recGoal = "Play +1S or Farm Down"
                    recTone = "bait"
                }
            } else {
                // Negative Lead: Pillar 2 checks whether blind-swapping gets hard-countered by predicted backline
                if (canPlayerSwap && pivotIdx != null) {
                    if (highBacklinePunishRisk && teamArchetype != "ABB") {
                        recAction = if (bestCatchBenchIdx in 0..2) {
                            recSwapIdx = bestCatchBenchIdx
                            "CHIP -> CATCH ON $bestCatchBenchCode"
                        } else {
                            "STAY · CHIP (SwpRsk:${backlinePred.swapPunishThreatCode})"
                        }
                        recGoal = "High Swap Punish (${backlinePred.swapPunishThreatCode} ${backlinePred.swapPunishRiskPct}%)"
                        recTone = "bait"
                    } else {
                        recAction = if (teamArchetype == "ABB") "ABB BAIT -> $pivotCode" else "SWAP -> $pivotCode"
                        recGoal = "Low Punish Rsk (${backlinePred.swapPunishRiskPct}%) · Flip Switch"
                        recTone = "swap"
                        recSwapIdx = pivotIdx
                    }
                } else {
                    recAction = "SOFT LOSE 0S"
                    recGoal = "Save Shields -> Farm w/ Backline"
                    recTone = "bait"
                }
            }
        } else if (curBr <= activeTierLMax && aliveBenchIndices.isNotEmpty()) {
            // 3. COUNTER-SWAP MINIMAX + Backline Punish Risk
            val bestCounterIdx = aliveBenchIndices.maxByOrNull { idx ->
                candidateScoreMap[teamNames.getOrElse(idx) { "" }] ?: slotBr(idx, playerShieldsRemaining, oppShieldsRemaining)
            } ?: aliveBenchIndices.first()
            val bestCounterBr = slotBr(bestCounterIdx, playerShieldsRemaining, oppShieldsRemaining)
            val bestCounterHp = playerSlotHpPct[bestCounterIdx].coerceIn(1, 100)
            val bestCounterCode = OverlayService.abbrPokeCompactStatic(teamNames[bestCounterIdx])

            if (!canPlayerSwap && playerSwapRemainingSec > 0) {
                recAction = "LOCKED (${playerSwapRemainingSec}s) · CHIP"
                shieldPlanStr = if (oppNukeKosActive && playerShieldsRemaining > 0 && playerAliveCount <= 2) "1S" else "0S"
                recGoal = "Wait ${playerSwapRemainingSec}s or Faint -> $bestCounterCode"
                recTone = "swap"
            } else if (bestCounterHp < 25 && activeOppHp > 25 && activeUserHp >= 35) {
                recAction = "STAY / CHIP (SAVE $bestCounterCode)"
                shieldPlanStr = "0S"
                recGoal = "$bestCounterCode at ${bestCounterHp}% HP"
                recTone = "bait"
            } else if (oppSwitchLockActive && bestCounterBr > curBr + 45) {
                recPhase = "OPP_SWAP"
                recAction = "PUNISH LOCK -> $bestCounterCode"
                recGoal = "Opp Locked ${oppSwapRemainingSec}s • Farm w/ $bestCounterCode"
                recTone = "counter"
                recSwapIdx = bestCounterIdx
            } else if (oppCanCounterSwap && oppAliveCount > 1 && bestCounterBr > curBr + 45) {
                val worstRespBr = candidateWorstRespMap[bestCounterIdx] ?: 440
                val branchAScore = (bestCounterBr * 0.35 + worstRespBr * 0.65 - 45.0).roundToInt()
                val branchBScore = (br0s * 0.45 + bestCounterBr * 0.55).roundToInt()
                if ((branchBScore >= branchAScore || backlinePred.swapPunishRiskPct >= 50) && curBr >= 355) {
                    recPhase = "FAINT_ENTRY"
                    recAction = "STAY & CHIP (HOLD $bestCounterCode)"
                    shieldPlanStr = "0S"
                    recGoal = "Avoid Counter-Swap (Rsk ${backlinePred.swapPunishRiskPct}%)"
                    recTone = "bait"
                } else {
                    recPhase = "OPP_SWAP"
                    recAction = "SAFE PIVOT -> $bestCounterCode"
                    recGoal = "Flip Tempo w/ $bestCounterCode (${bestCounterHp}%)"
                    recTone = "counter"
                    recSwapIdx = bestCounterIdx
                }
            } else if (bestCounterBr > curBr + 45) {
                recAction = "COUNTER -> $bestCounterCode"
                recGoal = "Punish w/ $bestCounterCode (${bestCounterHp}% HP)"
                recTone = "counter"
                recSwapIdx = bestCounterIdx
            } else {
                recAction = "STAY / CHIP 0S"
                recGoal = "Soft Lose -> Farm w/ Backline"
                recTone = "bait"
            }
        } else {
            recAction = if (curBr >= activeTierWMin) "STAY IN ($myBestMoveShort)" else "SOFT LOSE 0S"
            recGoal = if (curBr >= activeTierWMin) {
                if (oppSwitchLockActive) "Farm Locked Opp (${oppSwapRemainingSec}s)" else "Throw $myBestMoveShort pre-$oppNextMoveShort"
            } else {
                "Chip 0S -> Setup Backline"
            }
            recTone = if (curBr >= activeTierWMin) "stay" else "bait"
        }

        // Line 2: Persistent Condensed Opponent Backline Prediction (or Revealed Bench Status if all 3 revealed)
        val recBacklineText = when {
            backlinePred.hudLine2Text.isNotEmpty() -> backlinePred.hudLine2Text
            revealedBenchOpponents.isNotEmpty() -> {
                val benchParts = displayList.mapIndexedNotNull { idx, oName ->
                    if (idx == activeOppSlotSafe) null
                    else {
                        val bHp = if (idx in 0..2 && oppFaintedSlots[idx]) 0 else oppSlotHpPct.getOrElse(idx) { 100 }
                        val bE = if (idx in 0..2 && oppFaintedSlots[idx]) 0 else oppSlotEnergy.getOrElse(idx) { 0 }
                        val code = OverlayService.abbrPokeCompactStatic(oName)
                        if (bHp <= 0) "$code:KO" else "$code:${bHp}%/${bE}E"
                    }
                }
                "📋 Opp Bench: ${benchParts.joinToString(" · ")}"
            }
            else -> "🎯 $recGoal"
        }

        val recUrgencyColor = when {
            timingAlertLevel == "IMMEDIATE_0_FAST" || timingAlertLevel == "BLINK_1_FAST" -> "rose"
            timingAlertLevel == "WARN_2_FASTS" -> "amber"
            recTone == "stay" -> "emerald"
            recTone == "counter" -> "sky"
            recTone == "swap" -> "rose"
            recTone == "bait" -> "amber"
            else -> "sky"
        }
        val recActionLabel = when (recPhase) {
            "SHIELD_CALL" -> "[SHIELD] $recAction"
            "THROW_CATCH_TIMING", "FARM_DOWN" -> recAction
            else -> "[$teamArchetype] $recAction"
        }
        val recLine1Text = "$recActionLabel · [$shieldPlanStr]"

        lastRecommendedAction = recActionLabel
        lastRecommendedGoal = "$recGoal | $recBacklineText"
        lastRecommendedPhase = recPhase
        lastRecommendedSwapSlotIdx = recSwapIdx
        lastRecommendedCandidateScores = candidateScoreMap

        val tacticalRecommendation = mapOf(
            "phase" to recPhase,
            "archetype" to teamArchetype,
            "action" to recAction,
            "actionLabel" to recActionLabel,
            "shieldPlan" to shieldPlanStr,
            "goal" to recBacklineText,
            "goalText" to recBacklineText,
            "tacticalSubGoal" to recGoal,
            "line1Text" to recLine1Text,
            "line2Text" to recBacklineText,
            "backlineText" to recBacklineText,
            "timingAlertLevel" to timingAlertLevel,
            "swapPunishRiskPct" to backlinePred.swapPunishRiskPct,
            "tone" to recTone,
            "urgencyColor" to recUrgencyColor,
            "recommendedSwapSlotIndex" to recSwapIdx,
            "activeBr" to curBr,
            "activeUserHpPct" to activeUserHp,
            "confirmedUserHpPct" to confirmedUserHp,
            "isHpExtraFrameConfirmed" to isPlayerHpExtraFrameConfirmed,
            "altMoveKoWarning" to altKoGoalWarning,
            "activeOppHpPct" to activeOppHp,
            "candidateScores" to candidateScoreMap
        )

        // v6.06: Synchronized Haptic Alerts for Opponent Swap Clock (< warnSec) & Opponent 1-Fast-From-Charged-Move Blink
        if (isBattleActive && !isReplayMode && !isWaitingForOpponent) {
            if (oppSwitchValidityLatched && oppSwapEndTimeMs > nowMs && oppSwapRemainingSec in 1..activeHapticOppSwapWarnSec) {
                if (lastSwapHapticAlertEpochMs != oppSwapEndTimeMs) {
                    lastSwapHapticAlertEpochMs = oppSwapEndTimeMs
                    if (activeHapticMasterEnabled && activeHapticOppSwapEnabled) {
                        triggerSingleHapticPulseStatic(this@OverlayService)
                    }
                }
            }
            if (timingAlertLevel == "BLINK_1_FAST") {
                val chargeCycleKey = "$activeOppSlotSafe:${oppNextMoveName}:${activeOppEnergyNow / max(1, oppFastEnergy)}"
                if (lastChargeWarnHapticKey != chargeCycleKey) {
                    lastChargeWarnHapticKey = chargeCycleKey
                    if (activeHapticMasterEnabled && activeHapticOppChargeWarnEnabled) {
                        triggerDoubleHapticPulseStatic(this@OverlayService)
                    }
                }
            } else if (safeMyFastsBeforeOppMove > activeHapticChargeTimingFasts) {
                lastChargeWarnHapticKey = ""
            }
        }

        val battlePayload = mapOf(
            "activeOpponent" to oppMeta.name,
            "activeOpponentFastMove" to oppFastMoveName,
            "activeOpponentTurns" to oppFastTurns,
            "oppFastTelemetry" to oppFastTelemetry,
            "oppFastMoveStatus" to activeOppFastStatus,
            "oppFastMoveConfirmed" to oppFastMoveConfirmed.getOrElse(activeOppSlotSafe) { false },
            "confirmedOppChargedMoves" to activeOppConfirmedSet.toList(),
            "userFastTelemetry" to userFastTelemetry,
            "oppCountMode" to oppCountMode,
            "enable4ChargedMoves" to enable4ChargedMoves,
            "fastDetectTurnOffset" to fastDetectTurnOffset,
            "overlayTransparencyPct" to overlayTransparencyPct,
            "appThemeId" to appThemeId,
            "aiAdviceHudPosition" to aiAdviceHudPosition,
            "isOverlayMinimized" to isOverlayMinimized,
            "maxHorizonTurns" to maxHorizonTurns,
            "isOpponentShadow" to isOpponentShadow,
            "currentFormLabel" to oppMeta.formLabel,
            "availableForms" to availableOpponentForms.map { it.formLabel },
            "userActivePokemon" to activePlayerName,
            "activeUserSlotIndex" to activeUserSlotIndex,
            "activeOpponentSlotIndex" to activeOpponentSlotIndex,
            "leadMatchup" to currentLeadMatchup,
            "isBattleActive" to isBattleActive,
            "isReplayMode" to isReplayMode,
            "userFastMoveName" to userFastMoveName,
            "userFastMoveTurns" to userFastTurns,
            "winsCmp" to winsCmp,
            "myMove1Summary" to myMove1Summary,
            "myMove2Summary" to myMove2Summary,
            "throwAlignmentText" to throwAlignmentText,
            "throwHorizonText" to throwHorizonText,
            "playerSwapRemainingSec" to playerSwapRemainingSec,
            "playerSwapEndTimeMs" to playerSwapEndTimeMs,
            "oppSwapRemainingSec" to oppSwapRemainingSec,
            "oppSwapEndTimeMs" to oppSwapEndTimeMs,
            "hapticOppSwapWarnSec" to activeHapticOppSwapWarnSec,
            "hapticChargeTimingFasts" to activeHapticChargeTimingFasts,
            "showOneBattleDvrBtn" to activeShowOneBattleDvrBtn,
            "isOneBattleDvrArmed" to activeOneBattleDvrArmed,
            "isOneBattleDvrRecording" to activeOneBattleDvrRecording,
            "oneBattleDvrFrames" to activeOneBattleDvrFrames,
            "playerSwitchValidityLatched" to playerSwitchValidityLatched,
            "oppSwitchValidityLatched" to oppSwitchValidityLatched,
            "isPostFaintSwitchPromptActive" to isPostFaintSwitchPromptActive,
            "isAttackIncomingPromptActive" to isAttackIncomingPromptActive,
            "playerPokeballs" to playerPokeballCount,
            "oppPokeballs" to oppPokeballCount,
            "playerShields" to playerShieldsRemaining,
            "oppShields" to oppShieldsRemaining,
            "player_shields_remaining" to playerShieldsRemaining,
            "opponent_shields_remaining" to oppShieldsRemaining,
            "playerFaintedSlots" to playerFaintedSlots.toList(),
            "oppFaintedSlots" to oppFaintedSlots.toList(),
            "playerSlotHpPct" to playerSlotHpPct.toList(),
            "oppSlotHpPct" to oppSlotHpPct.toList(),
            "playerSlotEnergy" to playerSlotEnergy.toList(),
            "oppSlotEnergy" to oppSlotEnergy.toList(),
            "playerSlotEverOnField" to playerSlotEverOnField.toList(),
            "activeUserHpPct" to activeUserHp,
            "activeOppHpPct" to activeOppHp,
            "activeUserCp" to (playerSlotCp.getOrElse(activeSlotIdxSafe) { 0 }.takeIf { it > 0 } ?: (activeSlot?.cp ?: 0)),
            "activeOppCp" to oppSlotCp.getOrElse(activeOppSlotSafe) { 0 },
            "playerSlotCp" to (0..2).map { idx -> playerSlotCp[idx].takeIf { it > 0 } ?: (currentPreset?.pokemon?.getOrNull(idx)?.cp ?: 0) },
            "oppSlotCp" to oppSlotCp.toList(),
            "autoLoggedBanner" to if (!isBattleActive && lastLoggedBattleId.isNotBlank() && (nowMs - lastLoggedBattleTimeMs) <= 45000L) mapOf(
                "battleId" to lastLoggedBattleId,
                "result" to lastLoggedBattleResult,
                "leadMatchup" to lastLoggedBattleLead,
                "opponents" to lastLoggedBattleOpponents,
                "telemetryIgnored" to lastLoggedBattleTelemetryIgnored,
                "isAutoDetected" to lastLoggedBattleWasAuto
            ) else null,
            "activeUserEnergy" to playerSlotEnergy.getOrElse(activeSlotIdxSafe) { 0 }.coerceIn(0, 100),
            "activeOppEnergy" to oppSlotEnergy.getOrElse(activeOppSlotSafe) { 0 }.coerceIn(0, 100),
            "activeOppMoveReady" to ((scannedOpponentsData.getOrNull(activeOppSlotSafe)?.get("isMoveReady") as? Boolean) ?: false),
            "activeOppEnergyLabel" to ((scannedOpponentsData.getOrNull(activeOppSlotSafe)?.get("energyLabel") as? String) ?: "0E"),
            "scanHzMode" to currentScanHzMode,
            "lastScanDurationMs" to (if (isBattleActive && lastScanDurationMs > 0L) lastScanDurationMs else if (lastBattleAvgScanMs > 0L) lastBattleAvgScanMs else lastScanDurationMs),
            "lastBattleAvgScanMs" to lastBattleAvgScanMs,
            "lastHpScanDurationMs" to (if (isBattleActive && lastHpScanDurationMs > 0L) lastHpScanDurationMs else if (lastBattleAvgHpScanMs > 0L) lastBattleAvgHpScanMs else lastHpScanDurationMs),
            "lastBattleAvgHpScanMs" to lastBattleAvgHpScanMs,
            "scanTurnOffsetMs" to scanTurnOffsetMs,
            "battleTurnIndex" to battleTurnIndex,
            "teamArchetype" to teamArchetype,
            "showTacticalRec" to (showTacticalRecommendations && (isBattleActive || isReplayMode)),
            "showTacticalRecommendations" to (showTacticalRecommendations && (isBattleActive || isReplayMode)),
            "enableHpTracking" to enableHpTracking,
            "enableEnergyTracking" to enableEnergyTracking,
            "tacticalRec" to if (isBattleActive || isReplayMode) tacticalRecommendation else null,
            "tacticalRecommendation" to if (isBattleActive || isReplayMode) tacticalRecommendation else null,
            "team" to teamData,
            "scannedOpponents" to scannedOpponentsData,
            "oppMoveTimingRows" to oppMoveTimingRows,
            "myMoveTimingRows" to myMoveTimingRows
        )

        return gson.toJson(battlePayload)
    }

    internal fun calculateZeroSneakThrows(userTurns: Int, oppTurns: Int): List<Int> {
        val list = mutableListOf<Int>()
        for (attack in 1..10) {
            val totalUserTurns = attack * userTurns
            if (totalUserTurns % oppTurns != 0) {
                list.add(attack)
            }
            if (list.size >= 3) break
        }
        return if (list.isNotEmpty()) list else listOf(1, 3, 5)
    }

    /**
     * Computes 5-tier 0s/1s/2s matchup codes ("SW,W,N,L,SL") using user-configurable thresholds from Settings:
     * - SW = Strong Win (rating >= activeTierSwMin, default 620)
     * - W  = Win (activeTierWMin <= rating < activeTierSwMin, default 530 <= rating < 620)
     * - N  = Neutral / Grey (activeTierLMax < rating < activeTierWMin, default 470 < rating < 530)
     * - L  = Loss (activeTierSlMax < rating <= activeTierLMax, default 380 < rating <= 470)
     * - SL = Strong Loss (rating <= activeTierSlMax, default <= 380)
     */
    internal fun calculate3v3Matrix(
        oppMeta: PokemonMeta,
        isOppShad: Boolean,
        p1: TeamMember?,
        p2: TeamMember?,
        p3: TeamMember?,
        oppSlotIdx: Int = -1
    ): Map<String, String> {
        if (::prefs.isInitialized) {
            syncTierThresholdsFromPrefs(prefs)
        }
        val swMin = activeTierSwMin
        val wMin = activeTierWMin
        val lMax = activeTierLMax
        val slMax = activeTierSlMax

        fun evaluateSlot(slotIdx: Int, slot: TeamMember?, fallbackName: String): String {
            val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
            val userName = slot?.name ?: fallbackName
            val oppFullName = if (isOppShad && !oppMeta.name.startsWith("Shadow ", ignoreCase = true)) {
                "Shadow ${oppMeta.name}"
            } else {
                oppMeta.name
            }

            // v3.42: Do NOT scale visual 3v3 shield matrix dots by remaining HP% (since the static matrix does not know live energy).
            // Remaining HP% continues to guide Pokémon swap/post-faint selections, shield callouts, and KO badges.
            val rating0s = OverlayService.getOverlayRealtimeMatchupRatingStatic(
                myName = userName,
                oppName = oppFullName,
                userShields = 0,
                oppShields = 0,
                league = activeLeague,
                myFastMove = slot?.fastMove,
                myCharged1 = slot?.chargedMove1,
                myCharged2 = slot?.chargedMove2,
                myCp = slot?.cp,
                myIvs = slot?.ivs
            )
            val rating1s = OverlayService.getOverlayRealtimeMatchupRatingStatic(
                myName = userName,
                oppName = oppFullName,
                userShields = 1,
                oppShields = 1,
                league = activeLeague,
                myFastMove = slot?.fastMove,
                myCharged1 = slot?.chargedMove1,
                myCharged2 = slot?.chargedMove2,
                myCp = slot?.cp,
                myIvs = slot?.ivs
            )
            val rating2s = OverlayService.getOverlayRealtimeMatchupRatingStatic(
                myName = userName,
                oppName = oppFullName,
                userShields = 2,
                oppShields = 2,
                league = activeLeague,
                myFastMove = slot?.fastMove,
                myCharged1 = slot?.chargedMove1,
                myCharged2 = slot?.chargedMove2,
                myCp = slot?.cp,
                myIvs = slot?.ivs
            )

            fun toTier(r: Int): String = when {
                r >= swMin -> "SW"
                r >= wMin -> "W"
                r > lMax -> "N"
                r > slMax -> "L"
                else -> "SL"
            }

            return "${toTier(rating0s)},${toTier(rating1s)},${toTier(rating2s)}"
        }

        return mapOf(
            "p1" to evaluateSlot(0, p1, "Palkia (Origin)"),
            "p2" to evaluateSlot(1, p2, "Zacian (Crowned)"),
            "p3" to evaluateSlot(2, p3, "Dialga (Origin)")
        )
    }

    internal fun loadInitialDataIntoOverlay() {
        val presets = loadPresets()
        val jsonPresets = gson.toJson(presets)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updatePresets($jsonPresets)", null)
        }
        val presetToPrecompute = currentPreset ?: presets.firstOrNull { it.isSelected } ?: presets.firstOrNull()
        if (presetToPrecompute != null) {
            lifecycleScope.launch(Dispatchers.Default) {
                try {
                    OverlayService.precomputeActiveTeamTop200MatrixStatic(presetToPrecompute)
                    Handler(Looper.getMainLooper()).post {
                        recalculateAndPushBattleData()
                    }
                } catch (_: Exception) {}
            }
        }
        recalculateAndPushBattleData()
    }

    internal fun loadPresets(): List<TeamPreset> {
        if (!::prefs.isInitialized) return emptyList()
        val isShow6 = prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
        if (isShow6) {
            val show6Json = prefs.getString(PREFS_KEY_SHOW6_PRESETS_OF_3, null)
            if (!show6Json.isNullOrBlank()) {
                val type = object : TypeToken<List<TeamPreset>>() {}.type
                val parsed: List<TeamPreset>? = try { gson.fromJson(show6Json, type) } catch (_: Exception) { null }
                if (!parsed.isNullOrEmpty()) {
                    return parsed.filter { !it.combatMode.equals("gbl", ignoreCase = true) }
                }
            }
            return emptyList()
        }
        val persistentJson = prefs.getString(PREFS_KEY_PERSISTENT_TEAMS, null)
        if (!persistentJson.isNullOrBlank()) {
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            val parsed: List<TeamPreset>? = try { gson.fromJson(persistentJson, type) } catch (_: Exception) { null }
            if (!parsed.isNullOrEmpty()) {
                return parsed.filter { !it.combatMode.equals("show6", ignoreCase = true) }
            }
        }
        for (legacyKey in LEGACY_PRESET_KEYS) {
            val legacyJson = prefs.getString(legacyKey, null)
            if (!legacyJson.isNullOrBlank()) {
                val type = object : TypeToken<List<TeamPreset>>() {}.type
                val parsed: List<TeamPreset>? = try { gson.fromJson(legacyJson, type) } catch (_: Exception) { null }
                if (!parsed.isNullOrEmpty()) {
                    prefs.edit().putString(PREFS_KEY_PERSISTENT_TEAMS, legacyJson).apply()
                    return parsed.filter { !it.combatMode.equals("show6", ignoreCase = true) }
                }
            }
        }
        return emptyList()
    }

    override fun onDestroy() {
        super.onDestroy()
        isInstanceRunning = false
        hasActiveMediaProjection = false
        notifyRunningStateChanged()
        if (::prefs.isInitialized) {
            OverlayService.triggerAutoUploadOnOverlayStopAsync(prefs, gson)
        }
        battleLoopJob?.cancel()
        try {
            textRecognizer.close()
        } catch (_: Exception) {}

        try {
            val dvrH = dvrHandler
            val dvrT = dvrThread
            dvrHandler = null
            dvrThread = null
            if (dvrH != null) {
                dvrH.post {
                    try {
                        releaseDvrResourcesLocked(deleteFiles = true)
                    } catch (_: Exception) {}
                }
            } else {
                releaseDvrResourcesLocked(deleteFiles = true)
            }
            dvrT?.quitSafely()
            virtualDisplay?.release()
            virtualDisplay = null
            mediaProjection?.stop()
            mediaProjection = null
            imageReader?.close()
            imageReader = null
            imageReaderThread?.quitSafely()
            imageReaderThread = null
            cachedScreenBitmap?.recycle()
            cachedScreenBitmap = null
        } catch (_: Exception) {}

        mainToastHandler.removeCallbacks(hideStatusToastRunnable)
        mainToastHandler.removeCallbacks(hideShieldDecisionOverlayRunnable)
        if (statusToastView != null) {
            try {
                windowManager.removeView(statusToastView)
            } catch (_: Exception) {}
            statusToastView = null
        }

        if (shieldDecisionOverlayView != null) {
            try {
                windowManager.removeView(shieldDecisionOverlayView)
            } catch (_: Exception) {}
            shieldDecisionOverlayView = null
        }

        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView)
            } catch (_: Exception) {}
            try {
                overlayView?.destroy()
            } catch (_: Exception) {}
            overlayView = null
        }
    }

    internal val isPrefsInitialized: Boolean get() = ::prefs.isInitialized

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    /**
     * JavaScript Bridge exposing native Android actions to the HTML HUD
     */
    inner class AndroidBridge {
        @JavascriptInterface
        fun onLayoutSwitched(newMode: String) {
            Handler(Looper.getMainLooper()).post { applyLayoutMode(newMode) }
        }

        @JavascriptInterface
        fun toggleArmOneBattleDvr() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.toggleArmOneBattleDvrFromOverlay()
            }
        }

        @JavascriptInterface
        fun onSelectPreset(presetId: String) {
            Handler(Looper.getMainLooper()).post {
                val presets = loadPresets()
                val chosen = presets.find { it.id == presetId }
                if (chosen != null) {
                    currentPreset = chosen
                    activeUserPokemonName = chosen.pokemon.firstOrNull()?.name
                    val isShow6 = prefs.getString(PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
                    val selKey = if (isShow6) PREFS_KEY_SHOW6_SELECTED_PRESET_ID else "gbl_selected_preset_id"
                    prefs.edit().putString(selKey, presetId).apply()
                    lifecycleScope.launch(Dispatchers.Default) {
                        try {
                            OverlayService.precomputeActiveTeamTop200MatrixStatic(chosen)
                            Handler(Looper.getMainLooper()).post {
                                recalculateAndPushBattleData()
                            }
                        } catch (_: Exception) {}
                    }
                    recalculateAndPushBattleData()
                    showBattleToast("Loaded Team: ${chosen.name}")
                }
            }
        }

        @JavascriptInterface
        fun selectActiveUserPokemon(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.selectActiveUserPokemon(pokemonName)
            }
        }

        @JavascriptInterface
        fun startNewBattle() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.startNewBattle()
            }
        }

        @JavascriptInterface
        fun stopBattle() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.stopCurrentBattle()
            }
        }

        @JavascriptInterface
        fun logBattleResult(result: String, leadMatchup: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.logBattleResultFromOverlay(result, leadMatchup, ignoreAiTelemetry = false, isAutoDetected = false)
            }
        }

        @JavascriptInterface
        fun logBattleResultWithTelemetryFlag(result: String, leadMatchup: String, ignoreTelemetry: Boolean) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.logBattleResultFromOverlay(result, leadMatchup, ignoreAiTelemetry = ignoreTelemetry, isAutoDetected = false)
            }
        }

        @JavascriptInterface
        fun ignoreLastBattleTelemetry(battleId: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.ignoreTelemetryForBattle(battleId)
            }
        }

        @JavascriptInterface
        fun flipAutoLoggedBattleResult(battleId: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.flipAutoLoggedBattleResult(battleId)
            }
        }

        @JavascriptInterface
        fun undoAutoLoggedBattle(battleId: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.undoAutoLoggedBattle(battleId)
            }
        }

        @JavascriptInterface
        fun dismissAutoLoggedBanner() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.dismissAutoLoggedBanner()
            }
        }

        @JavascriptInterface
        fun setLeadMatchupOverride(leadMatchup: String) {
            Handler(Looper.getMainLooper()).post {
                manualLeadMatchupOverride = leadMatchup.uppercase()
                currentLeadMatchup = manualLeadMatchupOverride ?: "NEUTRAL"
                recalculateAndPushBattleData()
            }
        }

        @JavascriptInterface
        fun toggleOpponentShadow() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.toggleShadowModifier()
            }
        }

        @JavascriptInterface
        fun triggerSwapClockHapticIfNeeded(swapEndTimeMs: Long) {
            Handler(Looper.getMainLooper()).post {
                if (!isBattleActive || isWaitingForOpponent || swapEndTimeMs <= 0L) return@post
                if (lastSwapHapticAlertEpochMs != swapEndTimeMs) {
                    lastSwapHapticAlertEpochMs = swapEndTimeMs
                    if (activeHapticMasterEnabled && activeHapticOppSwapEnabled) {
                        triggerSingleHapticPulseStatic(this@OverlayService)
                    }
                }
            }
        }

        @JavascriptInterface
        fun cycleOpponentForm() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.cycleActiveOpponentForm()
            }
        }

        @JavascriptInterface
        fun swapActiveOpponent(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.swapActiveOpponent(pokemonName)
            }
        }

        @JavascriptInterface
        fun minimizeOverlay() {
            Handler(Looper.getMainLooper()).post {
                minimizeOverlayToBubble()
            }
        }

        @JavascriptInterface
        fun restoreOverlay() {
            Handler(Looper.getMainLooper()).post {
                restoreOverlayFromBubble()
            }
        }

        @JavascriptInterface
        fun stopOverlayAndOpenBattleLog() {
            Handler(Looper.getMainLooper()).post {
                if (::prefs.isInitialized) {
                    OverlayService.triggerAutoUploadOnOverlayStopAsync(prefs, gson)
                }
                try {
                    val launchIntent = Intent(this@OverlayService, MainActivity::class.java).apply {
                        action = ACTION_OPEN_BATTLE_LOG
                        putExtra("page", "battle_log")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    startActivity(launchIntent)
                } catch (_: Exception) {}
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }

        @JavascriptInterface
        fun setPlayerShields(count: Int) {
            Handler(Looper.getMainLooper()).post {
                val clamped = count.coerceIn(0, 2)
                if (playerShieldsRemaining != clamped) {
                    val prev = playerShieldsRemaining
                    playerShieldsRemaining = clamped
                    sampledPlayerShields = clamped
                    playerShieldDropFrames = 0
                    if (!isWaitingForOpponent && clamped < prev) {
                        val eventT = getElapsedBattleSeconds()
                        val activeUserMon = activeUserPokemonName ?: currentPreset?.pokemon?.firstOrNull()?.name ?: ""
                        val shieldNum = (2 - clamped).coerceIn(1, 2)
                        battleTimelineEvents.add(
                            BattleTimelineEvent(
                                type = "SHIELD",
                                actor = "user",
                                t = eventT,
                                shieldNumber = shieldNum,
                                activePokemon = activeUserMon.ifEmpty { null },
                                pokemonShielded = activeUserMon.ifEmpty { null },
                                userShieldsRemaining = clamped,
                                oppShieldsRemaining = oppShieldsRemaining
                            )
                        )
                    }
                    showBattleToast("🛡️ You: $playerShieldsRemaining shield${if (playerShieldsRemaining == 1) "" else "s"}")
                    recalculateAndPushBattleData()
                }
            }
        }

        @JavascriptInterface
        fun setOpponentShields(count: Int) {
            Handler(Looper.getMainLooper()).post {
                val clamped = count.coerceIn(0, 2)
                if (oppShieldsRemaining != clamped) {
                    val prev = oppShieldsRemaining
                    oppShieldsRemaining = clamped
                    sampledOppShields = clamped
                    oppShieldDropFrames = 0
                    if (!isWaitingForOpponent && clamped < prev) {
                        val eventT = getElapsedBattleSeconds()
                        val activeOppMon = formatOpponentNameWithShadow(activeOpponentName)
                        val shieldNum = (2 - clamped).coerceIn(1, 2)
                        battleTimelineEvents.add(
                            BattleTimelineEvent(
                                type = "SHIELD",
                                actor = "opp",
                                t = eventT,
                                shieldNumber = shieldNum,
                                activePokemon = activeOppMon.ifEmpty { null },
                                pokemonShielded = activeOppMon.ifEmpty { null },
                                userShieldsRemaining = playerShieldsRemaining,
                                oppShieldsRemaining = clamped
                            )
                        )
                    }
                    showBattleToast("🛡️ Opponent: $oppShieldsRemaining shield${if (oppShieldsRemaining == 1) "" else "s"}")
                    recalculateAndPushBattleData()
                }
            }
        }

        @JavascriptInterface
        fun updateContentHeight(heightDp: Int) {
            Handler(Looper.getMainLooper()).post {
                if (isOverlayMinimized || currentLayoutMode != "option1") return@post
                val density = resources.displayMetrics.density
                val targetHeight = (heightDp * density).toInt()
                if (layoutParams.height < 0 || Math.abs(layoutParams.height - targetHeight) > 1) {
                    layoutParams.height = targetHeight
                    try {
                        windowManager.updateViewLayout(overlayView, layoutParams)
                    } catch (_: Exception) {}
                }
            }
        }

        @JavascriptInterface
        fun onOverlayReady() {
            Handler(Looper.getMainLooper()).post {
                applyOverlayTransparency(overlayTransparencyPct)
                applyOverlayTheme(appThemeId)
                loadInitialDataIntoOverlay()
            }
        }
    }
}
