package com.gbl.overlay

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.UUID
import kotlin.math.roundToInt

/**
 * Data model for a custom saved GBL Team Preset
 */
data class PokemonSlot(
    val name: String = "",
    val cp: Int = 1500,
    val fastMove: String = "",
    val chargedMove1: String = "",
    val chargedMove2: String = "",
    val ivs: String? = null
)

data class TeamPreset(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val league: String = "GREAT LEAGUE", // "MASTER LEAGUE", "ULTRA LEAGUE", "GREAT LEAGUE"
    val pokemon: List<PokemonSlot> = emptyList(),
    val isSelected: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis(),
    val archetype: String = "ABC",
    val isArchetypeManual: Boolean = false,
    val leadAggBr: Int = 500,
    val machineAggBr: Int = 600,
    val safeSwapBr: Int = 500,
    val closerSwapBr: Int = 500,
    val closerBr: Int = 500,
    val sharedWeaknesses: List<String> = emptyList(),
    val topMetaTargetsTotal: Int = 25,
    val topMetaWinsCount: Int = 0,
    val keyMetaTargetsBeaten: List<String> = emptyList(),
    val keyThreats: List<String> = emptyList(),
    val coreBreakers: List<String> = emptyList(),
    val altMovesetSlots: List<OverlayService.Companion.AntiMetaAltMovesetInfo> = emptyList(),
    val synergySummary: String = ""
)

data class BattleLogEntry(
    val id: String = UUID.randomUUID().toString(),
    val timestampMs: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
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
    val quality: OverlayService.BattleQualityMetadata? = null,
    val qualityEvaluated: Boolean = false,
    val timelineEvents: List<OverlayService.BattleTimelineEvent> = emptyList(),
    val battleDurationSec: Double? = null,
    val userFaints: Int? = null,
    val oppFaints: Int? = null,
    val userShieldsRemaining: Int? = null,
    val oppShieldsRemaining: Int? = null,
    val finalUserHpPct: List<Int>? = null,
    val finalOppHpPct: List<Int>? = null,
    val firstSwapActor: String? = null,
    val switchAdvantage: String? = null,
    val adherenceRatePct: Int? = null,
    val recommendationsIssuedCount: Int? = null,
    val recommendationsFollowedCount: Int? = null
)

data class GblSeasonInfo(
    val id: String = "",
    val name: String = "",
    val startMs: Long = 0L,
    val endMs: Long = 0L
)

data class AppThemePalette(
    val id: String,
    val label: String,
    val description: String,
    val isLight: Boolean,
    val bgColor: Int,
    val navBarColor: Int,
    val surfaceColor: Int,
    val innerCardColor: Int,
    val elevatedColor: Int,
    val primaryTextColor: Int,
    val secondaryTextColor: Int,
    val accentColor: Int,
    val secondaryAccentColor: Int,
    val buttonAccentColor: Int,
    val secondaryButtonColor: Int,
    val overlayBorderColor: Int,
    val emblemDrawableRes: Int? = null
)

/**
 * MainActivity handles:
 * 1. Permission checks (SYSTEM_ALERT_WINDOW, POST_NOTIFICATIONS & MediaProjection Screen Capture)
 * 2. Background download & caching of PvPoke gamemaster.json + ScrapedDuck API Season start/end dates
 * 3. Saving, loading, creating, and switching custom GBL Team Presets locally + 2-Device Delta Sync
 * 4. Battle Log analytics, in-app Edit/Delete, Interactive Overlay Replay, and Day/Week/Season/All-Time plain-text export
 */
class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val client = OkHttpClient()

    private var projectionManager: MediaProjectionManager? = null
    private var isOverlayRunning = false

    // UI elements
    private lateinit var statusText: TextView
    private lateinit var dbStatusText: TextView
    private lateinit var btnToggleOverlay: Button
    private lateinit var btnDownloadDb: Button
    private lateinit var btnAddPreset: Button
    private lateinit var btnDonate: Button
    private lateinit var btnNavTeams: Button
    private lateinit var btnNavSettings: Button
    private lateinit var btnNavBattleLog: Button
    private lateinit var btnOverlayQuickHelp: Button
    private lateinit var pageTeams: android.view.View
    private lateinit var pageSettings: android.view.View
    private lateinit var pageBattleLog: android.view.View
    private lateinit var pageHelp: android.view.View
    private lateinit var btnReparseBattlesSettings: Button
    private lateinit var textReparseBattlesStatus: TextView
    private lateinit var btnToggleOppCountBasis: Button
    private lateinit var textOppCountBasisDesc: TextView
    private lateinit var btnToggleOppChargedMoves: Button
    private lateinit var textOppChargedMovesDesc: TextView
    private lateinit var btnToggleBattleToasts: Button
    private lateinit var textBattleToastsDesc: TextView
    private lateinit var btnToggleTacticalRec: Button
    private lateinit var textTacticalRecDesc: TextView
    private lateinit var btnToggleHpTracking: Button
    private lateinit var textHpTrackingDesc: TextView
    private lateinit var btnToggleEnergyTracking: Button
    private lateinit var textEnergyTrackingDesc: TextView
    private lateinit var tvEnergyDebounceSummary: TextView
    private lateinit var btnDebounce2Samples: Button
    private lateinit var btnDebounce3Samples: Button
    private lateinit var btnDebounce4Samples: Button
    private lateinit var btnToggleEnergyUpdateToasts: Button
    private lateinit var textEnergyUpdateToastsDesc: TextView
    private lateinit var btnCycleFastDetectOffset: Button
    private lateinit var textFastDetectOffsetDesc: TextView
    private lateinit var seekbarOverlayScale: SeekBar
    private lateinit var textOverlayScaleValue: TextView
    private lateinit var textOverlayScaleDefaultTick: TextView
    private lateinit var seekbarOverlayTransparency: SeekBar
    private lateinit var textOverlayTransparencyValue: TextView
    private lateinit var textOverlayTransparencyDefaultTick: TextView
    private lateinit var btnGithubLoginSettings: Button
    private lateinit var editSyncGithubToken: EditText
    private lateinit var editSyncGistId: EditText
    private lateinit var btnSyncDevicesSettings: Button
    private lateinit var btnSyncBundleSettings: Button
    private lateinit var textSyncStatus: TextView
    private lateinit var textTierDefinitionsSummary: TextView
    private lateinit var editTierSwMin: EditText
    private lateinit var editTierWMin: EditText
    private lateinit var editTierLMax: EditText
    private lateinit var editTierSlMax: EditText
    private lateinit var btnSaveTierThresholds: Button
    private lateinit var btnRestoreTierThresholds: Button
    private lateinit var textMachineBrDefinitionsSummary: TextView
    private lateinit var editMachEliteMin: EditText
    private lateinit var editMachSolidMin: EditText
    private lateinit var editMachPlayableMin: EditText
    private lateinit var editMachRiskyMin: EditText
    private lateinit var btnSaveMachThresholds: Button
    private lateinit var btnRestoreMachThresholds: Button
    private lateinit var presetsContainer: LinearLayout
    private lateinit var battleLogContainer: LinearLayout
    private lateinit var textBattleLogTotal: TextView
    private lateinit var textBattleLogLeague: TextView
    private lateinit var textBattleLogWinrate: TextView
    private lateinit var textBattleLogWae: TextView
    private lateinit var textBattleLogLuck: TextView
    private lateinit var btnLogManualBattle: Button
    private lateinit var btnSyncBattleLog: Button
    private lateinit var btnClearBattleLog: Button
    private lateinit var spinnerLogFilterLeague: Spinner
    private lateinit var spinnerLogFilterTeam: Spinner
    private lateinit var spinnerLogFilterTimeframe: Spinner
    private lateinit var btnCopyBattleLog: Button
    private lateinit var btnShareBattleLog: Button
    private lateinit var layoutUndoBanner: LinearLayout
    private lateinit var textUndoBannerMsg: TextView
    private lateinit var btnUndoBannerAction: Button
    private lateinit var btnUndoBannerDismiss: TextView
    private lateinit var btnTrashTeams: Button
    private lateinit var btnToggleAntiMetaBuilder: Button
    private lateinit var cardAntiMetaBuilder: LinearLayout
    private lateinit var btnCollapseAntiMetaPanel: Button
    private lateinit var layoutAntiMetaBody: LinearLayout
    private lateinit var spinnerAntiMetaLeague: Spinner
    private lateinit var editAntiMetaFeat1: AutoCompleteTextView
    private lateinit var btnClearAntiMetaFeat1: Button
    private lateinit var editAntiMetaFeat2: AutoCompleteTextView
    private lateinit var btnClearAntiMetaFeat2: Button
    private lateinit var btnGenerateAntiMetaTeams: Button
    private lateinit var textAntiMetaStatus: TextView
    private lateinit var layoutAntiMetaResults: LinearLayout
    private var antiMetaJob: kotlinx.coroutines.Job? = null
    private var isAntiMetaBodyExpanded: Boolean = true
    private lateinit var btnTrashBattleLog: Button
    private lateinit var spinnerAppTheme: Spinner
    private lateinit var ivThemePreviewEmblem: ImageView
    private lateinit var tvThemePreviewDesc: TextView
    private lateinit var viewSwatchBg: android.view.View
    private lateinit var viewSwatchSurface: android.view.View
    private lateinit var viewSwatchAccent: android.view.View
    private lateinit var viewSwatchAccent2: android.view.View
    private lateinit var viewSwatchOverlay: android.view.View
    private lateinit var switchShowThemeWatermark: Switch
    private var currentActivePage: String = "teams"
    private var isUpdatingThemeSpinner = false

    private val APP_THEME_COLLECTION: List<AppThemePalette> by lazy {
        listOf(
            AppThemePalette(
                id = "dialga_shiny_midnight",
                label = "✨ Shiny Origin Dialga Midnight (Dark)",
                description = "Shiny Origin Dialga Midnight ✨ — Deep temporal void with luminous shiny teal (#2DD4BF) & astral ring gold (#FACC15) accents.",
                isLight = false,
                bgColor = 0xFF050B16.toInt(),
                navBarColor = 0xFF02060D.toInt(),
                surfaceColor = 0xFF0E1B2E.toInt(),
                innerCardColor = 0xFF081120.toInt(),
                elevatedColor = 0xFF19304E.toInt(),
                primaryTextColor = 0xFFECFEFF.toInt(),
                secondaryTextColor = 0xFF99F6E4.toInt(),
                accentColor = 0xFF2DD4BF.toInt(),
                secondaryAccentColor = 0xFFFACC15.toInt(),
                buttonAccentColor = 0xFF0D9488.toInt(),
                secondaryButtonColor = 0xFFCA8A04.toInt(),
                overlayBorderColor = 0xFF2DD4BF.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_dialga
            ),
            AppThemePalette(
                id = "instinct_dark",
                label = "⚡ Team Instinct Storm (Dark)",
                description = "Team Instinct Storm (Dark) ⚡ — Obsidian storm-cloud dark mode with Zapdos lightning gold & electric plasma cyan-amber accents.",
                isLight = false,
                bgColor = 0xFF0E0B03.toInt(),
                navBarColor = 0xFF070501.toInt(),
                surfaceColor = 0xFF1F1908.toInt(),
                innerCardColor = 0xFF141005.toInt(),
                elevatedColor = 0xFF362B0E.toInt(),
                primaryTextColor = 0xFFFEFCE8.toInt(),
                secondaryTextColor = 0xFFFDE047.toInt(),
                accentColor = 0xFFFACC15.toInt(),
                secondaryAccentColor = 0xFF38BDF8.toInt(),
                buttonAccentColor = 0xFFCA8A04.toInt(),
                secondaryButtonColor = 0xFFD97706.toInt(),
                overlayBorderColor = 0xFFFACC15.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_instinct
            ),
            AppThemePalette(
                id = "instinct_light",
                label = "⚡ Team Instinct Spark (Light)",
                description = "Team Instinct Spark (Light) ⚡ — Warm solar-gold daylight theme with Zapdos crest watermark & electric sky-cobalt accents.",
                isLight = true,
                bgColor = 0xFFFEFCE8.toInt(),
                navBarColor = 0xFFFEF08A.toInt(),
                surfaceColor = 0xFFFFFFFF.toInt(),
                innerCardColor = 0xFFFEF9C3.toInt(),
                elevatedColor = 0xFFFDE047.toInt(),
                primaryTextColor = 0xFF1C1917.toInt(),
                secondaryTextColor = 0xFF713F12.toInt(),
                accentColor = 0xFFB45309.toInt(),
                secondaryAccentColor = 0xFF0284C7.toInt(),
                buttonAccentColor = 0xFFD97706.toInt(),
                secondaryButtonColor = 0xFF0284C7.toInt(),
                overlayBorderColor = 0xFFFACC15.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_instinct
            ),
            AppThemePalette(
                id = "mystic_dark",
                label = "❄️ Team Mystic Blizzard (Dark)",
                description = "Team Mystic Blizzard (Dark) ❄️ — Deep midnight glacier navy with Articuno ice-crystal blue & aurora violet accents.",
                isLight = false,
                bgColor = 0xFF060E20.toInt(),
                navBarColor = 0xFF030712.toInt(),
                surfaceColor = 0xFF102040.toInt(),
                innerCardColor = 0xFF09142B.toInt(),
                elevatedColor = 0xFF1E3A6E.toInt(),
                primaryTextColor = 0xFFF0F9FF.toInt(),
                secondaryTextColor = 0xFF93C5FD.toInt(),
                accentColor = 0xFF38BDF8.toInt(),
                secondaryAccentColor = 0xFFC084FC.toInt(),
                buttonAccentColor = 0xFF0284C7.toInt(),
                secondaryButtonColor = 0xFF6366F1.toInt(),
                overlayBorderColor = 0xFF38BDF8.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_mystic
            ),
            AppThemePalette(
                id = "mystic_light",
                label = "❄️ Team Mystic Glacier (Light)",
                description = "Team Mystic Glacier (Light) ❄️ — Crisp arctic ice-blue daylight theme with Articuno crest & royal aurora indigo accents.",
                isLight = true,
                bgColor = 0xFFF0F9FF.toInt(),
                navBarColor = 0xFFDBEAFE.toInt(),
                surfaceColor = 0xFFFFFFFF.toInt(),
                innerCardColor = 0xFFE0F2FE.toInt(),
                elevatedColor = 0xFFBAE6FD.toInt(),
                primaryTextColor = 0xFF0F172A.toInt(),
                secondaryTextColor = 0xFF1E40AF.toInt(),
                accentColor = 0xFF0284C7.toInt(),
                secondaryAccentColor = 0xFF7C3AED.toInt(),
                buttonAccentColor = 0xFF0369A1.toInt(),
                secondaryButtonColor = 0xFF4F46E5.toInt(),
                overlayBorderColor = 0xFF38BDF8.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_mystic
            ),
            AppThemePalette(
                id = "valor_dark",
                label = "🔥 Team Valor Inferno (Dark)",
                description = "Team Valor Inferno (Dark) 🔥 — Volcanic ember dark mode with Moltres crimson-flame & molten phoenix gold accents.",
                isLight = false,
                bgColor = 0xFF16070B.toInt(),
                navBarColor = 0xFF0B0305.toInt(),
                surfaceColor = 0xFF290E16.toInt(),
                innerCardColor = 0xFF1B090E.toInt(),
                elevatedColor = 0xFF471725.toInt(),
                primaryTextColor = 0xFFFFF1F2.toInt(),
                secondaryTextColor = 0xFFFDA4AF.toInt(),
                accentColor = 0xFFF43F5E.toInt(),
                secondaryAccentColor = 0xFFFBBF24.toInt(),
                buttonAccentColor = 0xFFE11D48.toInt(),
                secondaryButtonColor = 0xFFD97706.toInt(),
                overlayBorderColor = 0xFFF43F5E.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_valor
            ),
            AppThemePalette(
                id = "valor_light",
                label = "🔥 Team Valor Dawn (Light)",
                description = "Team Valor Dawn (Light) 🔥 — Warm rose-ivory daylight theme with crimson Moltres crest & solar phoenix amber accents.",
                isLight = true,
                bgColor = 0xFFFFF1F2.toInt(),
                navBarColor = 0xFFFFE4E6.toInt(),
                surfaceColor = 0xFFFFFFFF.toInt(),
                innerCardColor = 0xFFFFE4E6.toInt(),
                elevatedColor = 0xFFFECDD3.toInt(),
                primaryTextColor = 0xFF1F090D.toInt(),
                secondaryTextColor = 0xFF9F1239.toInt(),
                accentColor = 0xFFE11D48.toInt(),
                secondaryAccentColor = 0xFFD97706.toInt(),
                buttonAccentColor = 0xFFF43F5E.toInt(),
                secondaryButtonColor = 0xFFB45309.toInt(),
                overlayBorderColor = 0xFFFB7185.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_valor
            ),
            AppThemePalette(
                id = "sylveon_pink",
                label = "🎀 Sylveon Fairy Ribbon (Light Pink & Pastel Blue)",
                description = "Sylveon Fairy Ribbon 🎀 — Soft fairy-blush pink paired with Sylveon's distinctive pastel sky-blue (#38BDF8 / #60A5FA) & ribbon watermark.",
                isLight = true,
                bgColor = 0xFFFDF2F8.toInt(),
                navBarColor = 0xFFFCE7F3.toInt(),
                surfaceColor = 0xFFFFFFFF.toInt(),
                innerCardColor = 0xFFFCE7F3.toInt(),
                elevatedColor = 0xFFE0F2FE.toInt(),
                primaryTextColor = 0xFF3B0726.toInt(),
                secondaryTextColor = 0xFF9D174D.toInt(),
                accentColor = 0xFFDB2777.toInt(),
                secondaryAccentColor = 0xFF0284C7.toInt(),
                buttonAccentColor = 0xFFEC4899.toInt(),
                secondaryButtonColor = 0xFF38BDF8.toInt(),
                overlayBorderColor = 0xFFF472B6.toInt(),
                emblemDrawableRes = R.drawable.bg_emblem_sylveon
            ),
            AppThemePalette(
                id = "slate",
                label = "🛡️ SilphScope Slate (Default Generic)",
                description = "SilphScope Slate (Default Generic) — Deep slate canvas with sky-cyan & tactical amber accents.",
                isLight = false,
                bgColor = 0xFF0F172A.toInt(),
                navBarColor = 0xFF020617.toInt(),
                surfaceColor = 0xFF1E293B.toInt(),
                innerCardColor = 0xFF0F172A.toInt(),
                elevatedColor = 0xFF334155.toInt(),
                primaryTextColor = 0xFFF8FAFC.toInt(),
                secondaryTextColor = 0xFF94A3B8.toInt(),
                accentColor = 0xFF38BDF8.toInt(),
                secondaryAccentColor = 0xFFF59E0B.toInt(),
                buttonAccentColor = 0xFF0284C7.toInt(),
                secondaryButtonColor = 0xFF4F46E5.toInt(),
                overlayBorderColor = 0xFF38BDF8.toInt(),
                emblemDrawableRes = null
            )
        )
    }

    private var pendingUndoAction: (() -> Unit)? = null
    private var undoHideJob: kotlinx.coroutines.Job? = null

    private var selectedLogLeagueFilter: String = "ALL"
    private var selectedLogTeamFilter: String = "ALL"
    private var selectedLogTimeframeFilter: String = "ALL_TIME"
    private var isUpdatingLogFilterSpinners = false

    private val PREFS_KEY_PRESETS = OverlayService.PREFS_KEY_PERSISTENT_TEAMS
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
    private val PREFS_KEY_OPP_COUNT_MODE = "opp_count_mode"
    private val PREFS_KEY_ENABLE_4_CHARGED_MOVES = OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES
    private val PREFS_KEY_DISABLE_BATTLE_TOASTS = OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS
    private val PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS = OverlayService.PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS
    private val PREFS_KEY_ENABLE_HP_TRACKING = OverlayService.PREFS_KEY_ENABLE_HP_TRACKING
    private val PREFS_KEY_ENABLE_ENERGY_TRACKING = OverlayService.PREFS_KEY_ENABLE_ENERGY_TRACKING
    private val PREFS_KEY_FAST_DETECT_TURN_OFFSET = OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET
    private val PREFS_KEY_INSTALLED_VERSION_CODE = OverlayService.PREFS_KEY_INSTALLED_VERSION_CODE
    private val PREFS_KEY_LAST_SYNC_TIMESTAMP = OverlayService.PREFS_KEY_LAST_SYNC_TIMESTAMP
    private val PREFS_KEY_OVERLAY_SCALE_PCT = "overlay_scale_pct"
    private val DEFAULT_OVERLAY_SCALE_PCT = 78
    private val PREFS_KEY_OVERLAY_TRANSPARENCY_PCT = OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT
    private val DEFAULT_OVERLAY_TRANSPARENCY_PCT = 72
    private val PREFS_KEY_BATTLE_LOGS = OverlayService.PREFS_KEY_BATTLE_LOGS
    private val PREFS_KEY_DELETED_LOG_IDS = OverlayService.PREFS_KEY_DELETED_LOG_IDS
    private val PREFS_KEY_DELETED_TEAM_IDS = OverlayService.PREFS_KEY_DELETED_TEAM_IDS
    private val PREFS_KEY_DELETED_BATTLES_TRASH = OverlayService.PREFS_KEY_DELETED_LOGS_TRASH
    private val PREFS_KEY_DELETED_TEAMS_TRASH = OverlayService.PREFS_KEY_DELETED_TEAMS_TRASH
    private val PREFS_KEY_GBL_SEASONS_JSON = OverlayService.PREFS_KEY_GBL_SEASONS_JSON
    private val PREFS_KEY_SYNC_GITHUB_TOKEN = OverlayService.PREFS_KEY_SYNC_GITHUB_TOKEN
    private val PREFS_KEY_SYNC_GITHUB_USERNAME = OverlayService.PREFS_KEY_SYNC_GITHUB_USERNAME
    private val PREFS_KEY_SYNC_GIST_ID = OverlayService.PREFS_KEY_SYNC_GIST_ID
    private val PREFS_KEY_SYNC_LAST_AT = OverlayService.PREFS_KEY_SYNC_LAST_AT
    private val SCRAPEDDUCK_EVENTS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json"
    private val DONATION_URL = "https://buymeacoffee.com/sportsfan986"
    private val GAMEMASTER_URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"
    private val RANKINGS_ENDPOINTS = listOf(
        Triple("GREAT LEAGUE", "pvpoke_rankings_gl.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"),
        Triple("ULTRA LEAGUE", "pvpoke_rankings_ul.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json"),
        Triple("MASTER LEAGUE", "pvpoke_rankings_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json"),
        Triple("MEGA MASTER LEAGUE", "pvpoke_rankings_mega_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json")
    )

    // Android 13+ Notification permission launcher
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        proceedWithOverlayCheck()
    }

    // Media projection launcher (with manual mode fallback so the overlay HUD always shows)
    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startOverlayForegroundService(result.resultCode, result.data)
        } else {
            Toast.makeText(this, "Screen capture not active: launching HUD in manual mode", Toast.LENGTH_SHORT).show()
            // Launch overlay HUD even if screen capture was declined
            startOverlayForegroundService(0, null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Apply system status bar / clock / cutout and navigation bar insets so UI never overlaps top bar
        val rootLayout = findViewById<LinearLayout>(R.id.root_main_layout)
        val density = resources.displayMetrics.density
        val basePad = (16 * density).toInt()
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(
                basePad + insets.left,
                basePad + insets.top,
                basePad + insets.right,
                basePad + insets.bottom
            )
            WindowInsetsCompat.CONSUMED
        }

        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        // v3.60: Default HP Tracking and Energy Tracking to OFF for any user that has not installed 3.40 or higher
        val prevInstalledVerCode = prefs.getInt(PREFS_KEY_INSTALLED_VERSION_CODE, 0)
        if (prevInstalledVerCode < 340) {
            prefs.edit()
                .putBoolean(PREFS_KEY_ENABLE_HP_TRACKING, false)
                .putBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, false)
                .putInt(PREFS_KEY_INSTALLED_VERSION_CODE, 388)
                .apply()
        } else if (prevInstalledVerCode < 388) {
            prefs.edit().putInt(PREFS_KEY_INSTALLED_VERSION_CODE, 388).apply()
        }
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        initViews()
        val appVer = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: "3.88"
        } catch (_: Exception) {
            "3.88"
        }
        findViewById<TextView>(R.id.tv_app_main_subtitle)?.text = "Real-Time PvP Floating Overlay • v$appVer"
        ensureDefaultPresets()
        ensureDefaultSeasons()
        refreshPresetsUi()
        setupBattleLogFilters()
        renderBattleLogPage()
        checkGamemasterCache()
        fetchSeasonsFromScrapedDuck()
        syncOverlayRunningUiState()
        handleIncomingNavigationAndTaskerIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingNavigationAndTaskerIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        OverlayService.onRunningStateChanged = {
            syncOverlayRunningUiState()
        }
        if (::prefs.isInitialized) {
            syncOverlayRunningUiState()
            setupBattleLogFilters()
            renderBattleLogPage()
            updateSyncStatusUi()
            checkPendingGitHubDeviceLoginOnResume()
            // Automatically pull & reconcile deltas from the other device on every app open / resume
            triggerTwoDeviceCloudSync(silent = true)
        }
    }

    override fun onPause() {
        super.onPause()
        OverlayService.onRunningStateChanged = null
    }

    private fun syncOverlayRunningUiState() {
        isOverlayRunning = OverlayService.isInstanceRunning
        if (::btnToggleOverlay.isInitialized && ::statusText.isInitialized) {
            val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
            if (isOverlayRunning) {
                btnToggleOverlay.text = "Stop Battle Overlay"
                btnToggleOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                btnToggleOverlay.setTextColor(0xFFFFFFFF.toInt())
                statusText.text = "Status: Overlay Active"
                statusText.setTextColor(theme.secondaryAccentColor)
            } else {
                btnToggleOverlay.text = "Start Battle Overlay"
                btnToggleOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnToggleOverlay.setTextColor(0xFFFFFFFF.toInt())
                statusText.text = "Status: Idle"
                statusText.setTextColor(theme.accentColor)
            }
        }
    }

    private fun handleIncomingNavigationAndTaskerIntent(incoming: Intent?) {
        if (incoming == null) return
        val act = incoming.action.orEmpty()
        val compClass = incoming.component?.className.orEmpty()
        val pageExtra = (incoming.getStringExtra("page") ?: incoming.getStringExtra("tab")).orEmpty().trim()
        val cmdExtra = (incoming.getStringExtra("cmd") ?: incoming.getStringExtra("command")).orEmpty().trim()
        val openLogBool = incoming.getBooleanExtra("open_battle_log", false) ||
            incoming.getBooleanExtra("battle_log", false)
        val dataUri = incoming.data

        val shouldOpenBattleLog =
            compClass.endsWith("BattleLogActivity", ignoreCase = true) ||
                act.equals(OverlayService.ACTION_OPEN_BATTLE_LOG, ignoreCase = true) ||
                act.equals(OverlayService.ACTION_SHORT_BATTLE_LOG, ignoreCase = true) ||
                act.equals("com.gbl.overlay.OPEN_BATTLE_LOG", ignoreCase = true) ||
                pageExtra.equals("battle_log", ignoreCase = true) ||
                pageExtra.equals("battlelog", ignoreCase = true) ||
                pageExtra.equals("log", ignoreCase = true) ||
                cmdExtra.equals("battle_log", ignoreCase = true) ||
                openLogBool ||
                dataUri?.host.equals("battle_log", ignoreCase = true) ||
                dataUri?.path?.contains("battle_log", ignoreCase = true) == true

        if (shouldOpenBattleLog) {
            switchMainPage("battle_log")
            return
        }

        if (pageExtra.equals("settings", ignoreCase = true)) {
            switchMainPage("settings")
            return
        }

        if (pageExtra.equals("help", ignoreCase = true)) {
            switchMainPage("help")
            return
        }

        if (act.equals(OverlayService.ACTION_STOP_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_STOP, ignoreCase = true) ||
            cmdExtra.equals("stop", ignoreCase = true)
        ) {
            stopOverlayService()
            if (incoming.getBooleanExtra("background", true)) {
                finish()
            }
            return
        }

        if (act.equals(OverlayService.ACTION_START_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_START, ignoreCase = true) ||
            cmdExtra.equals("start", ignoreCase = true)
        ) {
            val taskerIntent = Intent(this, TaskerOverlayActivity::class.java).apply {
                action = OverlayService.ACTION_START_OVERLAY
                incoming.extras?.let { putExtras(it) }
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
            }
            startActivity(taskerIntent)
            if (incoming.getBooleanExtra("background", true)) {
                finish()
            }
        }
    }

    private fun scalePctToProgress(scalePct: Int): Int {
        val clamped = scalePct.coerceIn(50, 100)
        return ((clamped - 50) / 2).coerceIn(0, 25)
    }

    private fun progressToScalePct(progress: Int): Int {
        return (50 + progress.coerceIn(0, 25) * 2).coerceIn(50, 100)
    }

    private fun transparencyPctToProgress(transparencyPct: Int): Int {
        val clamped = transparencyPct.coerceIn(0, 100)
        return (clamped / 2).coerceIn(0, 50)
    }

    private fun progressToTransparencyPct(progress: Int): Int {
        return (progress.coerceIn(0, 50) * 2).coerceIn(0, 100)
    }

    private fun getActiveAppTheme(): AppThemePalette {
        val rawId = prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "dialga_shiny_midnight") ?: "dialga_shiny_midnight"
        val mappedId = when (rawId) {
            "amoled_cyan", "amoled_matrix" -> "dialga_shiny_midnight"
            else -> rawId
        }
        return APP_THEME_COLLECTION.find { it.id == mappedId } ?: APP_THEME_COLLECTION.first()
    }

    private fun createThemedSpinnerAdapter(items: List<String>): ArrayAdapter<String> {
        return object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, items) {
            override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {
                val v = super.getView(position, convertView, parent)
                if (v is TextView) {
                    val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
                    v.setTextColor(theme.primaryTextColor)
                    v.textSize = 12.5f
                }
                return v
            }

            override fun getDropDownView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup): android.view.View {
                val v = super.getDropDownView(position, convertView, parent)
                if (v is TextView) {
                    val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
                    v.setTextColor(theme.primaryTextColor)
                    v.setBackgroundColor(theme.surfaceColor)
                }
                return v
            }
        }
    }

    private fun switchMainPage(page: String) {
        currentActivePage = page
        pageTeams.visibility = if (page == "teams") android.view.View.VISIBLE else android.view.View.GONE
        pageBattleLog.visibility = if (page == "battle_log") android.view.View.VISIBLE else android.view.View.GONE
        pageSettings.visibility = if (page == "settings") android.view.View.VISIBLE else android.view.View.GONE
        pageHelp.visibility = if (page == "help") android.view.View.VISIBLE else android.view.View.GONE

        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        val hasWatermark = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true) && theme.emblemDrawableRes != null
        val surfaceAlpha = if (hasWatermark) 0xB8 else 0xFF
        val activeBg = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
        val inactiveBg = android.content.res.ColorStateList.valueOf(withAlpha(theme.surfaceColor, surfaceAlpha))
        val helpDefaultBg = android.content.res.ColorStateList.valueOf(withAlpha(theme.elevatedColor, surfaceAlpha))
        val activeText = 0xFFFFFFFF.toInt()
        val inactiveText = theme.secondaryTextColor

        btnNavTeams.backgroundTintList = if (page == "teams") activeBg else inactiveBg
        btnNavTeams.setTextColor(if (page == "teams") activeText else inactiveText)

        btnNavBattleLog.backgroundTintList = if (page == "battle_log") activeBg else inactiveBg
        btnNavBattleLog.setTextColor(if (page == "battle_log") activeText else inactiveText)

        btnNavSettings.backgroundTintList = if (page == "settings") activeBg else inactiveBg
        btnNavSettings.setTextColor(if (page == "settings") activeText else inactiveText)

        if (::btnOverlayQuickHelp.isInitialized) {
            btnOverlayQuickHelp.backgroundTintList = if (page == "help") activeBg else helpDefaultBg
            btnOverlayQuickHelp.setTextColor(if (page == "help") activeText else theme.secondaryAccentColor)
        }

        if (page == "battle_log") {
            renderBattleLogPage()
        }
    }

    private fun withAlpha(color: Int, alpha: Int): Int {
        return (color and 0x00FFFFFF) or ((alpha.coerceIn(0, 255)) shl 24)
    }

    private fun wrapViewWithThemeWatermark(contentView: android.view.View, watermarkSizeDp: Int = 250): FrameLayout {
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        val watermarkPrefEnabled = ::prefs.isInitialized &&
            prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true)
        val emblemRes = theme.emblemDrawableRes
        val showWatermark = watermarkPrefEnabled && emblemRes != null
        val density = resources.displayMetrics.density
        val frame = FrameLayout(this).apply {
            setBackgroundColor(theme.bgColor)
        }
        if (watermarkPrefEnabled && emblemRes != null) {
            val iv = ImageView(this).apply {
                id = R.id.iv_preset_dialog_watermark
                setImageResource(emblemRes)
                alpha = if (theme.isLight) 0.24f else 0.20f
                scaleType = ImageView.ScaleType.FIT_CENTER
                layoutParams = FrameLayout.LayoutParams(
                    (watermarkSizeDp * density).toInt(),
                    (watermarkSizeDp * density).toInt(),
                    android.view.Gravity.CENTER
                )
            }
            frame.addView(iv)
        }
        if (contentView.background is android.graphics.drawable.ColorDrawable) {
            contentView.setBackgroundColor(0x00000000)
        }
        frame.addView(
            contentView,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
        )
        applyThemeRecursively(contentView, theme, showWatermark)
        return frame
    }

    private fun styleThemedAlertDialog(dialog: AlertDialog) {
        if (!::prefs.isInitialized) return
        val theme = getActiveAppTheme()
        try {
            dialog.window?.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(theme.bgColor))
            dialog.findViewById<TextView>(androidx.appcompat.R.id.alertTitle)?.setTextColor(theme.accentColor)
            dialog.findViewById<TextView>(android.R.id.message)?.setTextColor(theme.primaryTextColor)
            dialog.findViewById<android.view.View>(androidx.appcompat.R.id.parentPanel)?.setBackgroundColor(theme.bgColor)
            dialog.findViewById<android.view.View>(androidx.appcompat.R.id.topPanel)?.setBackgroundColor(theme.surfaceColor)
            dialog.findViewById<android.view.View>(androidx.appcompat.R.id.contentPanel)?.setBackgroundColor(0x00000000)
            dialog.findViewById<android.view.View>(androidx.appcompat.R.id.buttonPanel)?.setBackgroundColor(theme.surfaceColor)

            dialog.getButton(AlertDialog.BUTTON_POSITIVE)?.let { btn ->
                btn.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btn.setTextColor(0xFFFFFFFF.toInt())
            }
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL)?.let { btn ->
                btn.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                btn.setTextColor(0xFFFFFFFF.toInt())
            }
            dialog.getButton(AlertDialog.BUTTON_NEGATIVE)?.let { btn ->
                btn.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
                btn.setTextColor(theme.primaryTextColor)
            }
        } catch (_: Exception) {}
    }

    private fun applyCurrentAppThemeToSubtree(rootView: android.view.View?) {
        if (rootView == null || !::prefs.isInitialized) return
        val theme = getActiveAppTheme()
        val showWatermark = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true) && theme.emblemDrawableRes != null
        applyThemeRecursively(rootView, theme, showWatermark)
    }

    private fun applyThemeRecursively(view: android.view.View, theme: AppThemePalette, hasWatermark: Boolean) {
        if (view.id == R.id.view_swatch_bg ||
            view.id == R.id.view_swatch_surface ||
            view.id == R.id.view_swatch_accent ||
            view.id == R.id.view_swatch_accent2 ||
            view.id == R.id.view_swatch_overlay ||
            view.id == R.id.root_theme_frame ||
            view.id == R.id.iv_theme_watermark_bg ||
            view.id == R.id.iv_preset_dialog_watermark ||
            view.id == R.id.text_dialog_archetype_badge ||
            view.id == R.id.text_dialog_lead_br_badge ||
            view.id == R.id.text_dialog_mach_br_badge ||
            view.id == R.id.text_dialog_autodetect_banner ||
            view.id == R.id.text_p1_lead_br ||
            view.id == R.id.text_p2_swap_br ||
            view.id == R.id.text_p3_swap_br ||
            view.id == R.id.btn_mode_auto ||
            view.id == R.id.btn_mode_abb ||
            view.id == R.id.btn_mode_abc ||
            view.id == R.id.btn_mode_duo ||
            view.id == R.id.btn_swap_slot_1_3 ||
            view.id == R.id.btn_dialog_auto_detect_style ||
            view.id == R.id.btn_dialog_suggest_upgrades ||
            view.id == R.id.text_p1_rec_header ||
            view.id == R.id.text_p2_rec_header ||
            view.id == R.id.text_p3_rec_header ||
            view.id == R.id.btn_p1_rec_1 ||
            view.id == R.id.btn_p1_rec_2 ||
            view.id == R.id.btn_p1_rec_3 ||
            view.id == R.id.btn_p1_rec_4 ||
            view.id == R.id.btn_p1_rec_5 ||
            view.id == R.id.btn_p2_rec_1 ||
            view.id == R.id.btn_p2_rec_2 ||
            view.id == R.id.btn_p2_rec_3 ||
            view.id == R.id.btn_p2_rec_4 ||
            view.id == R.id.btn_p2_rec_5 ||
            view.id == R.id.btn_p3_rec_1 ||
            view.id == R.id.btn_p3_rec_2 ||
            view.id == R.id.btn_p3_rec_3 ||
            view.id == R.id.btn_p3_rec_4 ||
            view.id == R.id.btn_p3_rec_5 ||
            view.id == R.id.text_preset_archetype_badge ||
            view.id == R.id.text_preset_league
        ) {
            return
        }

        val bgDrawable = view.background
        if (bgDrawable is android.graphics.drawable.ColorDrawable) {
            val origBg = (view.getTag(R.id.root_theme_frame) as? Int) ?: bgDrawable.color.also {
                view.setTag(R.id.root_theme_frame, it)
            }
            val rgb = origBg and 0x00FFFFFF
            // Increased transparency when watermark is enabled so the emblem shows through all 3 main pages & dialogs
            val navAlpha = if (hasWatermark) 0xBE else 0xFF
            val surfaceAlpha = if (hasWatermark) 0xAD else 0xFF
            val innerAlpha = if (hasWatermark) 0x9C else 0xFF
            val elevatedAlpha = if (hasWatermark) 0xB8 else 0xFF
            when (rgb) {
                0x020617 -> view.setBackgroundColor(withAlpha(theme.navBarColor, navAlpha))
                0x0F172A, 0x111827, 0x0B1325 -> view.setBackgroundColor(withAlpha(theme.innerCardColor, innerAlpha))
                0x1E293B -> view.setBackgroundColor(withAlpha(theme.surfaceColor, surfaceAlpha))
                0x334155, 0x475569 -> view.setBackgroundColor(withAlpha(theme.elevatedColor, elevatedAlpha))
                0x2563EB, 0x0284C7, 0x38BDF8 -> view.setBackgroundColor(theme.accentColor)
            }
        }

        if (view is Switch) {
            val states = arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf(-android.R.attr.state_checked))
            view.thumbTintList = android.content.res.ColorStateList(
                states,
                intArrayOf(theme.accentColor, theme.secondaryTextColor)
            )
            view.trackTintList = android.content.res.ColorStateList(
                states,
                intArrayOf(withAlpha(theme.accentColor, 0x80), theme.elevatedColor)
            )
        } else if (view is CompoundButton) {
            val states = arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf(-android.R.attr.state_checked))
            view.buttonTintList = android.content.res.ColorStateList(
                states,
                intArrayOf(theme.accentColor, theme.secondaryTextColor)
            )
            view.setTextColor(theme.primaryTextColor)
        } else if (view is Button) {
            val csl = view.backgroundTintList
            val enabledTint = csl?.getColorForState(intArrayOf(android.R.attr.state_enabled), csl.defaultColor) ?: 0xFF2563EB.toInt()
            val origTint = (view.getTag(R.id.view_swatch_bg) as? Int) ?: enabledTint.also {
                view.setTag(R.id.view_swatch_bg, it)
            }
            val origText = (view.getTag(R.id.iv_theme_watermark_bg) as? Int) ?: view.currentTextColor.also {
                view.setTag(R.id.iv_theme_watermark_bg, it)
            }
            val elevAlpha = if (hasWatermark) 0xCC else 0xFF
            when (origTint and 0x00FFFFFF) {
                0x0369A1, 0x059669, 0x10B981, 0xF59E0B, 0xD97706 -> {
                    view.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                    view.setTextColor(0xFFFFFFFF.toInt())
                }
                0x334155, 0x475569, 0x64748B -> {
                    view.backgroundTintList = android.content.res.ColorStateList.valueOf(withAlpha(theme.elevatedColor, elevAlpha))
                    when (origText and 0x00FFFFFF) {
                        0x38BDF8, 0x7DD3FC -> view.setTextColor(theme.accentColor)
                        0xFCD34D, 0xFBBF24, 0xF59E0B -> view.setTextColor(theme.secondaryAccentColor)
                        else -> view.setTextColor(theme.primaryTextColor)
                    }
                }
                0x1E293B, 0x0F172A -> {
                    view.backgroundTintList = android.content.res.ColorStateList.valueOf(withAlpha(theme.surfaceColor, elevAlpha))
                    when (origText and 0x00FFFFFF) {
                        0x38BDF8, 0x7DD3FC -> view.setTextColor(theme.accentColor)
                        0xCBD5E1, 0x94A3B8, 0x64748B -> view.setTextColor(theme.secondaryTextColor)
                        else -> view.setTextColor(theme.primaryTextColor)
                    }
                }
                0xE11D48, 0xDC2626 -> {
                    // Preserve semantic destructive red buttons
                }
                else -> {
                    view.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                    view.setTextColor(0xFFFFFFFF.toInt())
                }
            }
        } else if (view is TextView) {
            val origText = (view.getTag(R.id.iv_theme_watermark_bg) as? Int) ?: view.currentTextColor.also {
                view.setTag(R.id.iv_theme_watermark_bg, it)
            }
            when (origText and 0x00FFFFFF) {
                0xF8FAFC, 0xFFFFFF, 0xE2E8F0 -> view.setTextColor(theme.primaryTextColor)
                0xCBD5E1, 0x94A3B8, 0x64748B -> view.setTextColor(theme.secondaryTextColor)
                0x38BDF8, 0x7DD3FC, 0x0284C7, 0x2563EB -> view.setTextColor(theme.accentColor)
                0xF59E0B, 0xFBBF24, 0xFCD34D, 0x34D399, 0xC084FC -> view.setTextColor(theme.secondaryAccentColor)
            }
            if (view is EditText) {
                view.setHintTextColor(withAlpha(theme.secondaryTextColor, 0x99))
            }
        }

        if (view is SeekBar) {
            val accentState = android.content.res.ColorStateList.valueOf(theme.accentColor)
            view.progressTintList = accentState
            view.thumbTintList = accentState
            view.progressBackgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
        }

        if (view is ImageButton) {
            if (view.id == R.id.btn_delete_preset) {
                view.imageTintList = android.content.res.ColorStateList.valueOf(0xFFF87171.toInt())
            } else {
                view.imageTintList = android.content.res.ColorStateList.valueOf(theme.accentColor)
            }
        }

        if (view is Spinner) {
            view.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.accentColor)
            (view.selectedView as? TextView)?.setTextColor(theme.primaryTextColor)
        }

        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) {
                applyThemeRecursively(view.getChildAt(i), theme, hasWatermark)
            }
        }
    }

    private fun applyCurrentAppTheme(notifyOverlay: Boolean = false) {
        if (!::prefs.isInitialized) return
        val theme = getActiveAppTheme()
        val showWatermark = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true)
        val emblemRes = theme.emblemDrawableRes
        val hasWatermark = showWatermark && emblemRes != null

        findViewById<android.view.View>(R.id.root_theme_frame)?.setBackgroundColor(theme.bgColor)
        try {
            @Suppress("DEPRECATION")
            window.statusBarColor = theme.navBarColor
            @Suppress("DEPRECATION")
            window.navigationBarColor = theme.bgColor
        } catch (_: Exception) {}

        findViewById<ImageView>(R.id.iv_theme_watermark_bg)?.let { iv ->
            if (showWatermark && emblemRes != null) {
                iv.setImageResource(emblemRes)
                iv.alpha = if (theme.isLight) 0.25f else 0.22f
                iv.visibility = android.view.View.VISIBLE
            } else {
                iv.visibility = android.view.View.GONE
            }
        }

        if (::ivThemePreviewEmblem.isInitialized) {
            if (theme.emblemDrawableRes != null) {
                ivThemePreviewEmblem.setImageResource(theme.emblemDrawableRes)
                ivThemePreviewEmblem.visibility = android.view.View.VISIBLE
            } else {
                ivThemePreviewEmblem.visibility = android.view.View.GONE
            }
        }
        if (::tvThemePreviewDesc.isInitialized) {
            tvThemePreviewDesc.text = theme.description
        }
        if (::viewSwatchBg.isInitialized) viewSwatchBg.setBackgroundColor(theme.bgColor)
        if (::viewSwatchSurface.isInitialized) viewSwatchSurface.setBackgroundColor(theme.surfaceColor)
        if (::viewSwatchAccent.isInitialized) viewSwatchAccent.setBackgroundColor(theme.accentColor)
        if (::viewSwatchAccent2.isInitialized) viewSwatchAccent2.setBackgroundColor(theme.secondaryAccentColor)
        if (::viewSwatchOverlay.isInitialized) viewSwatchOverlay.setBackgroundColor(theme.overlayBorderColor)

        if (::seekbarOverlayScale.isInitialized) {
            val accentState = android.content.res.ColorStateList.valueOf(theme.accentColor)
            seekbarOverlayScale.progressTintList = accentState
            seekbarOverlayScale.thumbTintList = accentState
        }
        if (::seekbarOverlayTransparency.isInitialized) {
            val accent2State = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
            seekbarOverlayTransparency.progressTintList = accent2State
            seekbarOverlayTransparency.thumbTintList = accent2State
        }

        findViewById<android.view.View>(R.id.root_main_layout)?.let { mainRoot ->
            applyThemeRecursively(mainRoot, theme, hasWatermark)
        }

        // Explicitly apply dual-accent & elevated colors to all key action buttons across all 3 pages
        val primaryBtnTint = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
        val secondaryBtnTint = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
        val elevatedAlpha = if (hasWatermark) 0xCC else 0xFF
        val elevatedBtnTint = android.content.res.ColorStateList.valueOf(withAlpha(theme.elevatedColor, elevatedAlpha))
        val surfaceBtnTint = android.content.res.ColorStateList.valueOf(withAlpha(theme.surfaceColor, elevatedAlpha))

        // Top Bar & Teams Page Buttons
        syncOverlayRunningUiState()
        if (::btnDonate.isInitialized) {
            btnDonate.backgroundTintList = secondaryBtnTint
            btnDonate.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnAddPreset.isInitialized) {
            btnAddPreset.backgroundTintList = primaryBtnTint
            btnAddPreset.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnToggleAntiMetaBuilder.isInitialized) {
            btnToggleAntiMetaBuilder.backgroundTintList = secondaryBtnTint
            btnToggleAntiMetaBuilder.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnGenerateAntiMetaTeams.isInitialized) {
            btnGenerateAntiMetaTeams.backgroundTintList = primaryBtnTint
            btnGenerateAntiMetaTeams.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnTrashTeams.isInitialized) {
            btnTrashTeams.backgroundTintList = elevatedBtnTint
            btnTrashTeams.setTextColor(theme.secondaryAccentColor)
        }

        // Battle Log Page Buttons (+Log, Sync, Trash, Clear, Copy GBL, Share)
        if (::btnLogManualBattle.isInitialized) {
            btnLogManualBattle.backgroundTintList = primaryBtnTint
            btnLogManualBattle.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnSyncBattleLog.isInitialized) {
            btnSyncBattleLog.backgroundTintList = secondaryBtnTint
            btnSyncBattleLog.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnTrashBattleLog.isInitialized) {
            btnTrashBattleLog.backgroundTintList = elevatedBtnTint
            btnTrashBattleLog.setTextColor(theme.secondaryAccentColor)
        }
        if (::btnClearBattleLog.isInitialized) {
            btnClearBattleLog.backgroundTintList = elevatedBtnTint
            btnClearBattleLog.setTextColor(theme.primaryTextColor)
        }
        if (::btnCopyBattleLog.isInitialized) {
            btnCopyBattleLog.backgroundTintList = surfaceBtnTint
            btnCopyBattleLog.setTextColor(theme.accentColor)
        }
        if (::btnShareBattleLog.isInitialized) {
            btnShareBattleLog.backgroundTintList = secondaryBtnTint
            btnShareBattleLog.setTextColor(0xFFFFFFFF.toInt())
        }

        // Settings Page Buttons (Save Thresholds, Restore Defaults, 3 Sync Buttons, Sync PvPoke, Reparse, Tasker)
        if (::btnSaveTierThresholds.isInitialized) {
            btnSaveTierThresholds.backgroundTintList = primaryBtnTint
            btnSaveTierThresholds.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnRestoreTierThresholds.isInitialized) {
            btnRestoreTierThresholds.backgroundTintList = elevatedBtnTint
            btnRestoreTierThresholds.setTextColor(theme.secondaryAccentColor)
        }
        if (::btnDebounce2Samples.isInitialized) {
            loadAndRenderEnergyDebounceUi()
        }
        if (::btnGithubLoginSettings.isInitialized) {
            updateSyncStatusUi()
        }
        if (::btnSyncDevicesSettings.isInitialized) {
            btnSyncDevicesSettings.backgroundTintList = primaryBtnTint
            btnSyncDevicesSettings.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnSyncBundleSettings.isInitialized) {
            btnSyncBundleSettings.backgroundTintList = elevatedBtnTint
            btnSyncBundleSettings.setTextColor(theme.secondaryAccentColor)
        }
        if (::btnDownloadDb.isInitialized) {
            btnDownloadDb.backgroundTintList = secondaryBtnTint
            btnDownloadDb.setTextColor(0xFFFFFFFF.toInt())
        }
        if (::btnReparseBattlesSettings.isInitialized) {
            btnReparseBattlesSettings.backgroundTintList = primaryBtnTint
            btnReparseBattlesSettings.setTextColor(0xFFFFFFFF.toInt())
        }
        findViewById<Button>(R.id.btn_copy_tasker_start)?.let {
            it.backgroundTintList = primaryBtnTint
            it.setTextColor(0xFFFFFFFF.toInt())
        }
        findViewById<Button>(R.id.btn_copy_tasker_battle_log)?.let {
            it.backgroundTintList = secondaryBtnTint
            it.setTextColor(0xFFFFFFFF.toInt())
        }
        findViewById<Button>(R.id.btn_help_page_metric_guide)?.let {
            it.backgroundTintList = secondaryBtnTint
            it.setTextColor(0xFFFFFFFF.toInt())
        }

        if (::btnToggleOppCountBasis.isInitialized) updateOppCountBasisUi()
        if (::btnToggleOppChargedMoves.isInitialized) updateOppChargedMovesUi()
        if (::btnToggleBattleToasts.isInitialized) updateBattleToastsUi()
        if (::btnToggleTacticalRec.isInitialized) updateTacticalRecUi()
        if (::btnToggleHpTracking.isInitialized) updateHpTrackingUi()
        if (::btnToggleEnergyTracking.isInitialized) updateEnergyTrackingUi()
        if (::btnCycleFastDetectOffset.isInitialized) updateFastDetectOffsetUi()
        if (::presetsContainer.isInitialized && presetsContainer.childCount > 0) {
            refreshPresetsUi()
        }
        switchMainPage(currentActivePage)

        if (notifyOverlay && isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
                putExtra(OverlayService.EXTRA_APP_THEME_ID, theme.id)
            }
            startService(updateIntent)
        }
    }

    private fun initViews() {
        statusText = findViewById(R.id.text_status)
        dbStatusText = findViewById(R.id.text_db_status)
        btnToggleOverlay = findViewById(R.id.btn_toggle_overlay)
        btnDownloadDb = findViewById(R.id.btn_download_db)
        btnAddPreset = findViewById(R.id.btn_add_preset)
        btnDonate = findViewById(R.id.btn_donate)
        btnNavTeams = findViewById(R.id.btn_nav_teams)
        btnNavSettings = findViewById(R.id.btn_nav_settings)
        btnNavBattleLog = findViewById(R.id.btn_nav_battle_log)
        btnOverlayQuickHelp = findViewById(R.id.btn_overlay_quick_help)
        pageTeams = findViewById(R.id.page_teams)
        pageSettings = findViewById(R.id.page_settings)
        pageBattleLog = findViewById(R.id.page_battle_log)
        pageHelp = findViewById(R.id.page_help)
        btnReparseBattlesSettings = findViewById(R.id.btn_reparse_battles_settings)
        textReparseBattlesStatus = findViewById(R.id.text_reparse_battles_status)
        btnToggleOppCountBasis = findViewById(R.id.btn_toggle_opp_count_basis)
        textOppCountBasisDesc = findViewById(R.id.text_opp_count_basis_desc)
        btnToggleOppChargedMoves = findViewById(R.id.btn_toggle_opp_charged_moves)
        textOppChargedMovesDesc = findViewById(R.id.text_opp_charged_moves_desc)
        btnToggleBattleToasts = findViewById(R.id.btn_toggle_battle_toasts)
        textBattleToastsDesc = findViewById(R.id.text_battle_toasts_desc)
        btnToggleTacticalRec = findViewById(R.id.btn_toggle_tactical_rec)
        textTacticalRecDesc = findViewById(R.id.text_tactical_rec_desc)
        btnToggleHpTracking = findViewById(R.id.btn_toggle_hp_tracking)
        textHpTrackingDesc = findViewById(R.id.text_hp_tracking_desc)
        btnToggleEnergyTracking = findViewById(R.id.btn_toggle_energy_tracking)
        textEnergyTrackingDesc = findViewById(R.id.text_energy_tracking_desc)
        tvEnergyDebounceSummary = findViewById(R.id.tv_energy_debounce_summary)
        btnDebounce2Samples = findViewById(R.id.btn_debounce_2_samples)
        btnDebounce3Samples = findViewById(R.id.btn_debounce_3_samples)
        btnDebounce4Samples = findViewById(R.id.btn_debounce_4_samples)
        btnToggleEnergyUpdateToasts = findViewById(R.id.btn_toggle_energy_update_toasts)
        textEnergyUpdateToastsDesc = findViewById(R.id.text_energy_update_toasts_desc)
        btnCycleFastDetectOffset = findViewById(R.id.btn_cycle_fast_detect_offset)
        textFastDetectOffsetDesc = findViewById(R.id.text_fast_detect_offset_desc)
        seekbarOverlayScale = findViewById(R.id.seekbar_overlay_scale)
        textOverlayScaleValue = findViewById(R.id.text_overlay_scale_value)
        textOverlayScaleDefaultTick = findViewById(R.id.text_overlay_scale_default_tick)
        seekbarOverlayTransparency = findViewById(R.id.seekbar_overlay_transparency)
        textOverlayTransparencyValue = findViewById(R.id.text_overlay_transparency_value)
        textOverlayTransparencyDefaultTick = findViewById(R.id.text_overlay_transparency_default_tick)
        btnGithubLoginSettings = findViewById(R.id.btn_github_login_settings)
        editSyncGithubToken = findViewById(R.id.edit_sync_github_token)
        editSyncGistId = findViewById(R.id.edit_sync_gist_id)
        btnSyncDevicesSettings = findViewById(R.id.btn_sync_devices_settings)
        btnSyncBundleSettings = findViewById(R.id.btn_sync_bundle_settings)
        textSyncStatus = findViewById(R.id.text_sync_status)
        textTierDefinitionsSummary = findViewById(R.id.text_tier_definitions_summary)
        editTierSwMin = findViewById(R.id.edit_tier_sw_min)
        editTierWMin = findViewById(R.id.edit_tier_w_min)
        editTierLMax = findViewById(R.id.edit_tier_l_max)
        editTierSlMax = findViewById(R.id.edit_tier_sl_max)
        btnSaveTierThresholds = findViewById(R.id.btn_save_tier_thresholds)
        btnRestoreTierThresholds = findViewById(R.id.btn_restore_tier_thresholds)
        textMachineBrDefinitionsSummary = findViewById(R.id.text_machine_br_definitions_summary)
        editMachEliteMin = findViewById(R.id.edit_mach_elite_min)
        editMachSolidMin = findViewById(R.id.edit_mach_solid_min)
        editMachPlayableMin = findViewById(R.id.edit_mach_playable_min)
        editMachRiskyMin = findViewById(R.id.edit_mach_risky_min)
        btnSaveMachThresholds = findViewById(R.id.btn_save_mach_thresholds)
        btnRestoreMachThresholds = findViewById(R.id.btn_restore_mach_thresholds)
        presetsContainer = findViewById(R.id.layout_presets_list)
        battleLogContainer = findViewById(R.id.layout_battle_log_list)
        textBattleLogTotal = findViewById(R.id.text_battle_log_total)
        textBattleLogLeague = findViewById(R.id.text_battle_log_league)
        textBattleLogWinrate = findViewById(R.id.text_battle_log_winrate)
        textBattleLogWae = findViewById(R.id.text_battle_log_wae)
        textBattleLogLuck = findViewById(R.id.text_battle_log_luck)
        btnLogManualBattle = findViewById(R.id.btn_log_manual_battle)
        btnSyncBattleLog = findViewById(R.id.btn_sync_battle_log)
        btnClearBattleLog = findViewById(R.id.btn_clear_battle_log)
        spinnerLogFilterLeague = findViewById(R.id.spinner_log_filter_league)
        spinnerLogFilterTeam = findViewById(R.id.spinner_log_filter_team)
        spinnerLogFilterTimeframe = findViewById(R.id.spinner_log_filter_timeframe)
        btnCopyBattleLog = findViewById(R.id.btn_copy_battle_log)
        btnShareBattleLog = findViewById(R.id.btn_share_battle_log)
        layoutUndoBanner = findViewById(R.id.layout_undo_banner)
        textUndoBannerMsg = findViewById(R.id.text_undo_message)
        btnUndoBannerAction = findViewById(R.id.btn_undo_action)
        btnUndoBannerDismiss = findViewById(R.id.btn_undo_dismiss)
        btnTrashTeams = findViewById(R.id.btn_trash_presets)
        btnToggleAntiMetaBuilder = findViewById(R.id.btn_toggle_anti_meta_builder)
        cardAntiMetaBuilder = findViewById(R.id.card_anti_meta_builder)
        btnCollapseAntiMetaPanel = findViewById(R.id.btn_collapse_anti_meta_panel)
        layoutAntiMetaBody = findViewById(R.id.layout_anti_meta_body)
        spinnerAntiMetaLeague = findViewById(R.id.spinner_antimeta_league)
        editAntiMetaFeat1 = findViewById(R.id.edit_antimeta_feat1)
        btnClearAntiMetaFeat1 = findViewById(R.id.btn_clear_antimeta_feat1)
        editAntiMetaFeat2 = findViewById(R.id.edit_antimeta_feat2)
        btnClearAntiMetaFeat2 = findViewById(R.id.btn_clear_antimeta_feat2)
        btnGenerateAntiMetaTeams = findViewById(R.id.btn_generate_antimeta_teams)
        textAntiMetaStatus = findViewById(R.id.text_antimeta_status)
        layoutAntiMetaResults = findViewById(R.id.layout_antimeta_results)
        btnTrashBattleLog = findViewById(R.id.btn_trash_battle_log)
        spinnerAppTheme = findViewById(R.id.spinner_app_theme)
        ivThemePreviewEmblem = findViewById(R.id.iv_theme_preview_emblem)
        tvThemePreviewDesc = findViewById(R.id.tv_theme_preview_desc)
        viewSwatchBg = findViewById(R.id.view_swatch_bg)
        viewSwatchSurface = findViewById(R.id.view_swatch_surface)
        viewSwatchAccent = findViewById(R.id.view_swatch_accent)
        viewSwatchAccent2 = findViewById(R.id.view_swatch_accent2)
        viewSwatchOverlay = findViewById(R.id.view_swatch_overlay)
        switchShowThemeWatermark = findViewById(R.id.switch_show_theme_watermark)

        isUpdatingThemeSpinner = true
        val themeLabels = APP_THEME_COLLECTION.map { it.label }
        spinnerAppTheme.adapter = createThemedSpinnerAdapter(themeLabels)
        val activeTheme = getActiveAppTheme()
        val themeIdx = APP_THEME_COLLECTION.indexOfFirst { it.id == activeTheme.id }.takeIf { it >= 0 } ?: 0
        spinnerAppTheme.setSelection(themeIdx, false)
        switchShowThemeWatermark.isChecked = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true)
        isUpdatingThemeSpinner = false

        spinnerAppTheme.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingThemeSpinner) return
                val chosen = APP_THEME_COLLECTION.getOrElse(position) { APP_THEME_COLLECTION.first() }
                prefs.edit().putString(OverlayService.PREFS_KEY_APP_THEME_ID, chosen.id).apply()
                applyCurrentAppTheme(notifyOverlay = true)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        switchShowThemeWatermark.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, isChecked).apply()
            applyCurrentAppTheme(notifyOverlay = false)
        }

        btnUndoBannerAction.setOnClickListener {
            val action = pendingUndoAction
            hideUndoBanner()
            action?.invoke()
        }
        btnUndoBannerDismiss.setOnClickListener {
            hideUndoBanner()
        }
        btnTrashTeams.setOnClickListener {
            showTeamsTrashBinDialog()
        }
        btnTrashBattleLog.setOnClickListener {
            showBattleLogsTrashBinDialog()
        }

        btnNavTeams.setOnClickListener { switchMainPage("teams") }
        btnNavBattleLog.setOnClickListener { switchMainPage("battle_log") }
        btnNavSettings.setOnClickListener { switchMainPage("settings") }

        btnOverlayQuickHelp.setOnClickListener {
            switchMainPage("help")
        }
        findViewById<Button>(R.id.btn_help_page_metric_guide)?.setOnClickListener {
            showHelpAndMetricGuideDialog("wae")
        }

        updateOppCountBasisUi()
        updateOppChargedMovesUi()
        updateBattleToastsUi()
        updateTacticalRecUi()
        updateHpTrackingUi()
        updateEnergyTrackingUi()
        updateFastDetectOffsetUi()

        editSyncGithubToken.setText(prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "") ?: "")
        editSyncGistId.setText(prefs.getString(PREFS_KEY_SYNC_GIST_ID, "") ?: "")
        updateSyncStatusUi()

        btnGithubLoginSettings.setOnClickListener {
            handleGitHubLoginButtonTap()
        }

        btnSyncDevicesSettings.setOnClickListener {
            saveSyncCredentialsFromInputs()
            if (OverlayService.getEffectiveSyncToken(prefs).isEmpty()) {
                startGitHubOAuthDeviceFlow()
            } else {
                triggerTwoDeviceCloudSync(silent = false)
            }
        }

        btnSyncBundleSettings.setOnClickListener {
            showSyncBundleDialog()
        }

        loadAndRenderEnergyDebounceUi()
        btnDebounce2Samples.setOnClickListener {
            saveEnergyDebounceSamples(2, showToast = true)
        }
        btnDebounce3Samples.setOnClickListener {
            saveEnergyDebounceSamples(3, showToast = true)
        }
        btnDebounce4Samples.setOnClickListener {
            saveEnergyDebounceSamples(4, showToast = true)
        }
        btnToggleEnergyUpdateToasts.setOnClickListener {
            val currentEnabled = prefs.getBoolean(OverlayService.PREFS_KEY_ENERGY_UPDATE_TOASTS, OverlayService.DEFAULT_ENERGY_UPDATE_TOASTS)
            val nextEnabled = !currentEnabled
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_ENERGY_UPDATE_TOASTS, nextEnabled).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            loadAndRenderEnergyDebounceUi()
        }

        loadAndRenderTierThresholdsUi()
        btnSaveTierThresholds.setOnClickListener {
            saveTierThresholdsFromInputs(showToast = true)
        }
        btnRestoreTierThresholds.setOnClickListener {
            restoreDefaultTierThresholds()
        }

        loadAndRenderMachineBrThresholdsUi()
        btnSaveMachThresholds.setOnClickListener {
            saveMachineBrThresholdsFromInputs(showToast = true)
        }
        btnRestoreMachThresholds.setOnClickListener {
            restoreDefaultMachineBrThresholds()
        }

        findViewById<Button>(R.id.btn_copy_tasker_start)?.setOnClickListener {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(
                android.content.ClipData.newPlainText(
                    "Tasker Start Overlay",
                    OverlayService.ACTION_START_OVERLAY
                )
            )
            Toast.makeText(
                this,
                "Copied Tasker Start Action: ${OverlayService.ACTION_START_OVERLAY} (Package: com.gbl.overlay)",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<Button>(R.id.btn_copy_tasker_stop)?.setOnClickListener {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(
                android.content.ClipData.newPlainText(
                    "Tasker Stop Overlay",
                    OverlayService.ACTION_STOP_OVERLAY
                )
            )
            Toast.makeText(
                this,
                "Copied Tasker Stop Action: ${OverlayService.ACTION_STOP_OVERLAY} (Package: com.gbl.overlay)",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<Button>(R.id.btn_copy_tasker_battle_log)?.setOnClickListener {
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(
                android.content.ClipData.newPlainText(
                    "Tasker Open Battle Log",
                    OverlayService.ACTION_OPEN_BATTLE_LOG
                )
            )
            Toast.makeText(
                this,
                "Copied Tasker Battle Log Action: ${OverlayService.ACTION_OPEN_BATTLE_LOG} (Package: com.gbl.overlay)",
                Toast.LENGTH_SHORT
            ).show()
        }

        findViewById<android.view.View>(R.id.card_battle_log_wae)?.setOnClickListener {
            showHelpAndMetricGuideDialog("wae")
        }
        findViewById<android.view.View>(R.id.btn_info_exec_wae)?.setOnClickListener {
            showHelpAndMetricGuideDialog("wae")
        }
        findViewById<android.view.View>(R.id.card_battle_log_luck)?.setOnClickListener {
            showHelpAndMetricGuideDialog("luck")
        }
        findViewById<android.view.View>(R.id.btn_info_matchup_luck)?.setOnClickListener {
            showHelpAndMetricGuideDialog("luck")
        }

        val savedScalePct = prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT).coerceIn(50, 100)
        seekbarOverlayScale.progress = scalePctToProgress(savedScalePct)
        updateOverlayScaleUi(progressToScalePct(seekbarOverlayScale.progress))

        val savedTransparencyPct = prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, DEFAULT_OVERLAY_TRANSPARENCY_PCT).coerceIn(0, 100)
        seekbarOverlayTransparency.progress = transparencyPctToProgress(savedTransparencyPct)
        updateOverlayTransparencyUi(progressToTransparencyPct(seekbarOverlayTransparency.progress))

        btnDonate.setOnClickListener {
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(DONATION_URL))
                startActivity(browserIntent)
            } catch (e: Exception) {
                Toast.makeText(this, "Support at: $DONATION_URL", Toast.LENGTH_LONG).show()
            }
        }

        btnToggleOverlay.setOnClickListener {
            if (isOverlayRunning) {
                stopOverlayService()
            } else {
                checkOverlayPermissionAndStart()
            }
        }

        btnDownloadDb.setOnClickListener {
            downloadPvPokeGamemaster()
        }

        btnReparseBattlesSettings.setOnClickListener {
            reparseAllCompletedBattles(silent = false)
        }

        btnAddPreset.setOnClickListener {
            showPresetEditorDialog(null)
        }

        setupAntiMetaTeamBuilderUi()

        btnLogManualBattle.setOnClickListener {
            showEditOrCreateBattleLogDialog(null)
        }

        btnSyncBattleLog.setOnClickListener {
            saveSyncCredentialsFromInputs()
            if (OverlayService.getEffectiveSyncToken(prefs).isEmpty()) {
                AlertDialog.Builder(this)
                    .setTitle("☁️ Multi-Device Cloud Sync")
                    .setMessage("Sign in with your GitHub account once on each phone to automatically sync your Battle Logs and Team Presets across all your devices.")
                    .setPositiveButton("🔑 Login with GitHub") { _, _ ->
                        startGitHubOAuthDeviceFlow()
                    }
                    .setNeutralButton("📦 Manual Sync Bundle") { _, _ ->
                        showSyncBundleDialog()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            } else {
                triggerTwoDeviceCloudSync(silent = false)
            }
        }

        btnCopyBattleLog.setOnClickListener {
            val allLogs = loadBattleLogs()
            val gblExport = buildCopyGblExport(
                allLogs,
                selectedLogLeagueFilter,
                selectedLogTeamFilter,
                selectedLogTimeframeFilter
            )
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope Copy GBL", gblExport))
            val count = filterBattleLogs(
                allLogs,
                selectedLogLeagueFilter,
                selectedLogTeamFilter,
                selectedLogTimeframeFilter
            ).size
            Toast.makeText(this, "Copied GBL format ($count battles) to clipboard!", Toast.LENGTH_SHORT).show()
        }

        btnShareBattleLog.setOnClickListener {
            showExportFormatAndTimeframeDialog(isShareIntent = true)
        }

        btnClearBattleLog.setOnClickListener {
            val existing = loadBattleLogs()
            if (existing.isEmpty()) {
                Toast.makeText(this, "Battle log is already empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            AlertDialog.Builder(this)
                .setTitle("Move All ${existing.size} Battle Logs to Trash?")
                .setMessage("Cleared battles are moved to the Trash Bin so you can restore them anytime, and tombstones are synced across your devices.")
                .setPositiveButton("Move to Trash") { _, _ ->
                    val trash = loadDeletedBattlesTrash().toMutableList()
                    existing.forEach { item ->
                        trash.removeAll { it.id == item.id }
                        trash.add(0, item)
                    }
                    saveDeletedBattlesTrash(trash)

                    val delIds = loadDeletedLogIds().toMutableSet()
                    existing.forEach { delIds.add(it.id) }
                    saveDeletedLogIds(delIds.toList())
                    prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, "[]").apply()
                    renderBattleLogPage()
                    updateSyncStatusUi()
                    triggerTwoDeviceCloudSync(silent = true)
                    showUndoBanner("🗑️ ${existing.size} battle(s) moved to Trash") {
                        restoreBattleLogsFromTrash(existing)
                        Toast.makeText(this, "Restored ${existing.size} battle(s)!", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        btnToggleOppCountBasis.setOnClickListener {
            val currentMode = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
            val nextMode = if (currentMode == "my_fasts") "opp_fasts" else "my_fasts"
            prefs.edit().putString(PREFS_KEY_OPP_COUNT_MODE, nextMode).apply()
            updateOppCountBasisUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, nextMode)
                }
                startService(updateIntent)
            }
        }

        btnToggleOppChargedMoves.setOnClickListener {
            val currentEnable4 = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
            val nextEnable4 = !currentEnable4
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, nextEnable4).apply()
            updateOppChargedMovesUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, nextEnable4)
                }
                startService(updateIntent)
            }
        }

        btnToggleBattleToasts.setOnClickListener {
            val currentDisable = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
            val nextDisable = !currentDisable
            prefs.edit().putBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, nextDisable).apply()
            updateBattleToastsUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, nextDisable)
                }
                startService(updateIntent)
            }
        }

        btnToggleTacticalRec.setOnClickListener {
            val currentShow = prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, true)
            val nextShow = !currentShow
            prefs.edit().putBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, nextShow).apply()
            updateTacticalRecUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_SHOW_TACTICAL_RECOMMENDATIONS, nextShow)
                }
                startService(updateIntent)
            }
        }

        btnToggleHpTracking.setOnClickListener {
            val currentEnableHp = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, false)
            val nextEnableHp = !currentEnableHp
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_HP_TRACKING, nextEnableHp).apply()
            updateHpTrackingUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_HP_TRACKING, nextEnableHp)
                }
                startService(updateIntent)
            }
        }

        btnToggleEnergyTracking.setOnClickListener {
            val currentEnableEnergy = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, false)
            val nextEnableEnergy = !currentEnableEnergy
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, nextEnableEnergy).apply()
            updateEnergyTrackingUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_ENERGY_TRACKING, nextEnableEnergy)
                }
                startService(updateIntent)
            }
        }

        btnCycleFastDetectOffset.setOnClickListener {
            val currentOffset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2)
            val nextOffset = (currentOffset + 1) % 3
            prefs.edit().putInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, nextOffset).apply()
            updateFastDetectOffsetUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, nextOffset)
                }
                startService(updateIntent)
            }
        }

        seekbarOverlayScale.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = progressToScalePct(progress)
                updateOverlayScaleUi(pct)
                prefs.edit().putInt(PREFS_KEY_OVERLAY_SCALE_PCT, pct).apply()
                if (isOverlayRunning) {
                    val updateIntent = Intent(this@MainActivity, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_UPDATE_SETTINGS
                        putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, pct)
                    }
                    startService(updateIntent)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        // Clicking the default tick or value label snaps back to 78% (Default)
        val resetToDefaultScale = {
            seekbarOverlayScale.progress = scalePctToProgress(DEFAULT_OVERLAY_SCALE_PCT)
        }
        textOverlayScaleDefaultTick.setOnClickListener { resetToDefaultScale() }
        textOverlayScaleValue.setOnClickListener { resetToDefaultScale() }

        seekbarOverlayTransparency.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = progressToTransparencyPct(progress)
                updateOverlayTransparencyUi(pct)
                prefs.edit().putInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, pct).apply()
                if (isOverlayRunning) {
                    val updateIntent = Intent(this@MainActivity, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_UPDATE_SETTINGS
                        putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, pct)
                    }
                    startService(updateIntent)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        // Clicking the default tick or value label snaps back to 72% (Default)
        val resetToDefaultTransparency = {
            seekbarOverlayTransparency.progress = transparencyPctToProgress(DEFAULT_OVERLAY_TRANSPARENCY_PCT)
        }
        textOverlayTransparencyDefaultTick.setOnClickListener { resetToDefaultTransparency() }
        textOverlayTransparencyValue.setOnClickListener { resetToDefaultTransparency() }

        applyCurrentAppTheme(notifyOverlay = false)
    }

    private fun updateOverlayScaleUi(scalePct: Int) {
        textOverlayScaleValue.text = if (scalePct == DEFAULT_OVERLAY_SCALE_PCT) {
            "${scalePct}% (Default)"
        } else {
            "${scalePct}%"
        }
    }

    private fun updateOverlayTransparencyUi(transparencyPct: Int) {
        textOverlayTransparencyValue.text = if (transparencyPct == DEFAULT_OVERLAY_TRANSPARENCY_PCT) {
            "${transparencyPct}% (Default)"
        } else {
            "${transparencyPct}%"
        }
    }

    private fun saveSyncCredentialsFromInputs() {
        val tok = editSyncGithubToken.text.toString().trim()
        val gist = editSyncGistId.text.toString().trim()
        val oldTok = prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "")?.trim().orEmpty()
        val editor = prefs.edit()
            .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tok)
            .putString(PREFS_KEY_SYNC_GIST_ID, gist)
        if (tok != oldTok) {
            editor.putString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")
        }
        editor.apply()
        updateSyncStatusUi()
    }

    private fun updateSyncStatusUi() {
        val token = OverlayService.getEffectiveSyncToken(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        val lastAt = prefs.getLong(PREFS_KEY_SYNC_LAST_AT, 0L)
        val gistId = prefs.getString(PREFS_KEY_SYNC_GIST_ID, "")?.trim().orEmpty()
        val timeFmt = java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US)
        val lastStr = if (lastAt > 0L) timeFmt.format(java.util.Date(lastAt)) else "Never"

        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (token.isNotEmpty()) {
            val userLabel = if (username.isNotEmpty()) "@$username" else "GitHub Account"
            btnGithubLoginSettings.text = "✅ Connected: $userLabel (Tap to Manage / Sign Out)"
            btnGithubLoginSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnGithubLoginSettings.setTextColor(0xFFFFFFFF.toInt())
            val vaultShort = if (gistId.isNotEmpty()) "Gist: ${gistId.take(8)}…" else "Account Vault ($userLabel)"
            textSyncStatus.text = "🟢 Auto-Sync Active ($userLabel) • Last: $lastStr • $vaultShort • Logs: ${loadBattleLogs().size} • Teams: ${loadPresets().size}"
        } else {
            btnGithubLoginSettings.text = "🔑 Login with GitHub (Generate Sync Token)"
            btnGithubLoginSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
            btnGithubLoginSettings.setTextColor(0xFFFFFFFF.toInt())
            textSyncStatus.text = "⚪ Not signed in (Local-only) • Tap 'Login with GitHub' to enable multi-device auto-sync"
        }
    }

    private fun handleGitHubLoginButtonTap() {
        val token = OverlayService.getEffectiveSyncToken(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        if (token.isNotEmpty()) {
            val userDisplay = if (username.isNotEmpty()) "@$username" else "your GitHub account"
            AlertDialog.Builder(this)
                .setTitle("☁️ GitHub Cloud Sync ($userDisplay)")
                .setMessage("Your device is signed in to $userDisplay and automatically syncs Battle Logs & Teams on app open and after every battle.")
                .setPositiveButton("☁️ Sync Now") { _, _ ->
                    triggerTwoDeviceCloudSync(silent = false)
                }
                .setNeutralButton("🔑 Switch Account / Re-Login") { _, _ ->
                    startGitHubOAuthDeviceFlow()
                }
                .setNegativeButton("🔓 Sign Out") { _, _ ->
                    prefs.edit()
                        .remove(PREFS_KEY_SYNC_GITHUB_TOKEN)
                        .remove(PREFS_KEY_SYNC_GITHUB_USERNAME)
                        .remove(PREFS_KEY_SYNC_GIST_ID)
                        .apply()
                    editSyncGithubToken.setText("")
                    editSyncGistId.setText("")
                    updateSyncStatusUi()
                    Toast.makeText(this, "Signed out of GitHub Cloud Sync", Toast.LENGTH_SHORT).show()
                }
                .show()
        } else {
            startGitHubOAuthDeviceFlow()
        }
    }

    private fun startGitHubOAuthDeviceFlow() {
        btnGithubLoginSettings.isEnabled = false
        btnGithubLoginSettings.text = "⏳ Requesting GitHub Login Code..."
        lifecycleScope.launch(Dispatchers.IO) {
            val codeResult = OverlayService.requestGitHubDeviceCodeBlocking()
            withContext(Dispatchers.Main) {
                btnGithubLoginSettings.isEnabled = true
                updateSyncStatusUi()
                codeResult.onFailure { err ->
                    Toast.makeText(
                        this@MainActivity,
                        "Could not start GitHub Login: ${err.localizedMessage ?: "Network error"}",
                        Toast.LENGTH_LONG
                    ).show()
                }.onSuccess { deviceResp ->
                    showGitHubDeviceVerificationDialog(deviceResp)
                }
            }
        }
    }

    private fun checkPendingGitHubDeviceLoginOnResume() {
        if (OverlayService.getEffectiveSyncToken(prefs).isNotEmpty()) return
        val pendingCode = prefs.getString("pending_github_device_code", "")?.trim().orEmpty()
        val expiresAt = prefs.getLong("pending_github_device_expires_at", 0L)
        if (pendingCode.isEmpty() || System.currentTimeMillis() > expiresAt) return

        lifecycleScope.launch(Dispatchers.IO) {
            val (status, tokenOrErr, username) = OverlayService.pollGitHubDeviceTokenOnceBlocking(pendingCode)
            if (status == "SUCCESS" && tokenOrErr.isNotEmpty()) {
                prefs.edit()
                    .remove("pending_github_device_code")
                    .remove("pending_github_device_expires_at")
                    .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tokenOrErr)
                    .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                    .apply()
                withContext(Dispatchers.Main) {
                    editSyncGithubToken.setText(tokenOrErr)
                    updateSyncStatusUi()
                    val userTag = if (username.isNotEmpty()) "@$username" else "GitHub"
                    Toast.makeText(
                        this@MainActivity,
                        "✅ Signed in as $userTag! Syncing devices...",
                        Toast.LENGTH_LONG
                    ).show()
                    triggerTwoDeviceCloudSync(silent = false)
                }
            }
        }
    }

    private fun showGitHubDeviceVerificationDialog(deviceResp: OverlayService.Companion.GitHubDeviceCodeResponse) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
        Toast.makeText(this, "Code ${deviceResp.userCode} copied to clipboard!", Toast.LENGTH_LONG).show()

        val deadlineMs = System.currentTimeMillis() + (deviceResp.expiresIn * 1000L)
        prefs.edit()
            .putString("pending_github_device_code", deviceResp.deviceCode)
            .putLong("pending_github_device_expires_at", deadlineMs)
            .apply()

        var isPollingActive = true
        val statusLabel = TextView(this).apply {
            text = "Your 8-character GitHub Login Code:\n\n" +
                "   👉  ${deviceResp.userCode}  👈\n" +
                "   (Already copied to your clipboard!)\n\n" +
                "1. Tap \"🌐 Open GitHub Login\" below.\n" +
                "2. Paste ${deviceResp.userCode} on GitHub and tap Authorize.\n" +
                "3. Switch back to SilphScope PvP — your token is saved automatically!\n\n" +
                "⏳ Waiting for GitHub authorization..."
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            textSize = 13f
            val pad = (16 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }

        applyCurrentAppThemeToSubtree(statusLabel)

        val dialog = AlertDialog.Builder(this)
            .setTitle("🔑 Code: ${deviceResp.userCode}")
            .setView(statusLabel)
            .setPositiveButton("🌐 Open GitHub Login", null)
            .setNeutralButton("📋 Copy Code", null)
            .setNegativeButton("Close") { _, _ ->
                isPollingActive = false
            }
            .setOnDismissListener {
                isPollingActive = false
            }
            .create()

        dialog.show()

        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
            Toast.makeText(this, "Code ${deviceResp.userCode} copied! Paste it on GitHub.", Toast.LENGTH_LONG).show()
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(deviceResp.verificationUri)))
            } catch (_: Exception) {
                Toast.makeText(this, "Open ${deviceResp.verificationUri} in your browser", Toast.LENGTH_LONG).show()
            }
        }

        dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
            cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
            Toast.makeText(this, "Copied ${deviceResp.userCode}!", Toast.LENGTH_SHORT).show()
        }

        // Poll GitHub OAuth endpoint in background until user authorizes
        lifecycleScope.launch(Dispatchers.IO) {
            var pollIntervalMs = (deviceResp.interval.coerceAtLeast(5)) * 1000L
            while (isPollingActive && System.currentTimeMillis() < deadlineMs) {
                kotlinx.coroutines.delay(pollIntervalMs)
                if (!isPollingActive) break
                val (status, tokenOrErr, username) = OverlayService.pollGitHubDeviceTokenOnceBlocking(deviceResp.deviceCode)
                when (status) {
                    "SUCCESS" -> {
                        isPollingActive = false
                        prefs.edit()
                            .remove("pending_github_device_code")
                            .remove("pending_github_device_expires_at")
                            .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tokenOrErr)
                            .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                            .apply()
                        withContext(Dispatchers.Main) {
                            editSyncGithubToken.setText(tokenOrErr)
                            updateSyncStatusUi()
                            if (dialog.isShowing) dialog.dismiss()
                            val userTag = if (username.isNotEmpty()) "@$username" else "GitHub"
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Signed in as $userTag! Syncing devices...",
                                Toast.LENGTH_LONG
                            ).show()
                            triggerTwoDeviceCloudSync(silent = false)
                        }
                        break
                    }
                    "SLOW_DOWN" -> {
                        pollIntervalMs += 5000L
                    }
                    "ERROR" -> {
                        isPollingActive = false
                        withContext(Dispatchers.Main) {
                            statusLabel.text = "❌ GitHub Login failed: $tokenOrErr"
                        }
                        break
                    }
                }
            }
        }
    }

    private fun triggerTwoDeviceCloudSync(silent: Boolean) {
        val tok = OverlayService.getEffectiveSyncToken(prefs)
        if (tok.isEmpty()) {
            if (!silent) {
                Toast.makeText(this, "Tap '🔑 Login with GitHub' in Settings to enable auto-sync", Toast.LENGTH_LONG).show()
            }
            return
        }
        if (!silent) {
            textSyncStatus.text = "☁️ Reconciling deltas with your GitHub cloud vault..."
            btnSyncDevicesSettings.isEnabled = false
            btnSyncBattleLog.isEnabled = false
        }
        lifecycleScope.launch(Dispatchers.IO) {
            val (ok, msg) = OverlayService.syncWithGitHubGistBlocking(prefs, gson)
            withContext(Dispatchers.Main) {
                btnSyncDevicesSettings.isEnabled = true
                btnSyncBattleLog.isEnabled = true
                editSyncGistId.setText(prefs.getString(PREFS_KEY_SYNC_GIST_ID, "") ?: "")
                updateSyncStatusUi()
                refreshPresetsUi()
                setupBattleLogFilters()
                renderBattleLogPage()
                if (!silent) {
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                } else if (ok && (!msg.contains("+0 from other devices") || !msg.contains("+0 updated"))) {
                    Toast.makeText(this@MainActivity, "☁️ Auto-synced on open: $msg", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showSyncBundleDialog() {
        val localVault = OverlayService.buildLocalSyncVaultPayload(prefs, gson)
        val bundleJson = gson.toJson(localVault)
        val input = EditText(this).apply {
            hint = "Paste Sync Bundle JSON from your other device here..."
            setTextColor(0xFFF8FAFC.toInt())
            setHintTextColor(0xFF64748B.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            textSize = 11f
            minLines = 4
            maxLines = 8
            val pad = (10 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        applyCurrentAppThemeToSubtree(input)
        AlertDialog.Builder(this)
            .setTitle("📦 Two-Device Delta Sync Bundle")
            .setMessage("Copy this device's Sync Bundle to share with your second device, or paste a Sync Bundle below to reconcile deltas (Logs + Teams):")
            .setView(input)
            .setPositiveButton("Merge Pasted Bundle") { _, _ ->
                val raw = input.text.toString().trim()
                if (raw.isEmpty()) {
                    Toast.makeText(this, "Paste a Sync Bundle JSON first", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                try {
                    val incoming = gson.fromJson(raw, OverlayService.Companion.SyncVaultPayload::class.java)
                    if (incoming == null) throw Exception("Invalid JSON")
                    val (merged, newLogs, newTeams) = OverlayService.reconcileSyncVaultPayloads(localVault, incoming)
                    OverlayService.saveReconciledSyncVaultLocally(prefs, gson, merged)
                    refreshPresetsUi()
                    setupBattleLogFilters()
                    renderBattleLogPage()
                    updateSyncStatusUi()
                    Toast.makeText(
                        this,
                        "Reconciled! +$newLogs battles & +$newTeams teams merged.",
                        Toast.LENGTH_LONG
                    ).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Invalid Sync Bundle: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
            .setNeutralButton("📋 Copy My Bundle") { _, _ ->
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope PvP Sync Bundle", bundleJson))
                Toast.makeText(this, "Sync Bundle copied to clipboard!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun parseIsoDateMs(isoStr: String?): Long? {
        if (isoStr.isNullOrBlank()) return null
        val clean = isoStr.trim()
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd"
        )
        for (pat in patterns) {
            try {
                val sdf = java.text.SimpleDateFormat(pat, java.util.Locale.US)
                if (clean.endsWith("Z")) {
                    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                val d = sdf.parse(clean)
                if (d != null) return d.time
            } catch (_: Exception) {}
        }
        return null
    }

    private fun ensureDefaultSeasons() {
        val existing = loadSeasons()
        if (existing.isEmpty()) {
            val defaults = getDefaultSeededSeasons()
            saveSeasons(defaults)
        }
    }

    private fun getDefaultSeededSeasons(): List<GblSeasonInfo> {
        return listOf(
            GblSeasonInfo(
                id = "season-21-max-out",
                name = "Max Out",
                startMs = parseIsoDateMs("2024-09-03T10:00:00.000") ?: 1725357600000L,
                endMs = parseIsoDateMs("2024-12-03T10:00:00.000") ?: 1733220000000L
            ),
            GblSeasonInfo(
                id = "season-22-dual-destiny",
                name = "Dual Destiny",
                startMs = parseIsoDateMs("2024-12-03T10:00:00.000") ?: 1733220000000L,
                endMs = parseIsoDateMs("2025-03-04T10:00:00.000") ?: 1741082400000L
            ),
            GblSeasonInfo(
                id = "season-23-summer-2026",
                name = "Previous GBL Season",
                startMs = parseIsoDateMs("2026-06-01T10:00:00.000") ?: 1780308000000L,
                endMs = parseIsoDateMs("2026-09-08T10:00:00.000") ?: 1788861600000L
            ),
            GblSeasonInfo(
                id = "season-24-twilight-trails",
                name = "Twilight Trails",
                startMs = parseIsoDateMs("2026-09-08T10:00:00.000") ?: 1788861600000L,
                endMs = parseIsoDateMs("2026-12-01T10:00:00.000") ?: 1796119200000L
            )
        )
    }

    private fun loadSeasons(): List<GblSeasonInfo> {
        val raw = prefs.getString(PREFS_KEY_GBL_SEASONS_JSON, null)
        if (!raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<List<GblSeasonInfo>>() {}.type
                val parsed: List<GblSeasonInfo>? = gson.fromJson(raw, type)
                if (!parsed.isNullOrEmpty()) return parsed.sortedBy { it.startMs }
            } catch (_: Exception) {}
        }
        return getDefaultSeededSeasons().sortedBy { it.startMs }
    }

    private fun saveSeasons(seasons: List<GblSeasonInfo>) {
        prefs.edit().putString(PREFS_KEY_GBL_SEASONS_JSON, gson.toJson(seasons.sortedBy { it.startMs })).apply()
    }

    private fun fetchSeasonsFromScrapedDuck() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val req = Request.Builder().url(SCRAPEDDUCK_EVENTS_URL).build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val body = resp.body?.string() ?: return@use
                    val arr = com.google.gson.JsonParser.parseString(body).asJsonArray
                    val currentList = loadSeasons().toMutableList()
                    var didUpdate = false

                    for (el in arr) {
                        val obj = el.asJsonObject
                        val eventType = obj.get("eventType")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        val heading = obj.get("heading")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        if (eventType.equals("season", ignoreCase = true) || heading.equals("Season", ignoreCase = true)) {
                            val id = obj.get("eventID")?.takeIf { !it.isJsonNull }?.asString ?: "scraped-season"
                            val name = obj.get("name")?.takeIf { !it.isJsonNull }?.asString ?: "Current Season"
                            val startStr = obj.get("start")?.takeIf { !it.isJsonNull }?.asString
                            val endStr = obj.get("end")?.takeIf { !it.isJsonNull }?.asString
                            val startMs = parseIsoDateMs(startStr)
                            val endMs = parseIsoDateMs(endStr)
                            if (startMs != null && endMs != null && endMs > startMs) {
                                val scraped = GblSeasonInfo(id = id, name = name, startMs = startMs, endMs = endMs)
                                val existingIdx = currentList.indexOfFirst {
                                    it.id.equals(id, ignoreCase = true) || kotlin.math.abs(it.startMs - startMs) < 86400000L * 5
                                }
                                if (existingIdx >= 0) {
                                    currentList[existingIdx] = scraped
                                } else {
                                    currentList.add(scraped)
                                }
                                // Ensure a Previous Season window exists immediately prior to startMs (approx 90 days)
                                val ninetyDaysMs = 90L * 24L * 3600L * 1000L
                                val hasPrev = currentList.any { it.endMs in (startMs - 86400000L * 7)..(startMs + 86400000L * 2) && it.startMs < startMs }
                                if (!hasPrev) {
                                    currentList.add(
                                        GblSeasonInfo(
                                            id = "prev-to-$id",
                                            name = "Previous GBL Season",
                                            startMs = startMs - ninetyDaysMs,
                                            endMs = startMs
                                        )
                                    )
                                }
                                didUpdate = true
                            }
                        }
                    }

                    if (didUpdate) {
                        saveSeasons(currentList)
                        withContext(Dispatchers.Main) {
                            setupBattleLogFilters()
                            renderBattleLogPage()
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun getCurrentAndPreviousSeason(): Pair<GblSeasonInfo, GblSeasonInfo> {
        val sorted = loadSeasons().sortedBy { it.startMs }
        val now = System.currentTimeMillis()
        val currentIdx = sorted.indexOfLast { now >= it.startMs && now <= it.endMs }
            .takeIf { it >= 0 } ?: sorted.lastIndex.coerceAtLeast(0)
        val current = sorted.getOrElse(currentIdx) {
            GblSeasonInfo("season-curr", "Current Season", now - 45L * 86400000L, now + 45L * 86400000L)
        }
        val prev = if (currentIdx > 0) {
            sorted[currentIdx - 1]
        } else {
            val ninetyDaysMs = 90L * 86400000L
            GblSeasonInfo("season-prev", "Previous Season", current.startMs - ninetyDaysMs, current.startMs)
        }
        return current to prev
    }

    private fun loadBattleLogs(): List<BattleLogEntry> {
        val raw = prefs.getString(PREFS_KEY_BATTLE_LOGS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<BattleLogEntry>>() {}.type
            val parsed: List<BattleLogEntry> = gson.fromJson<List<BattleLogEntry>>(raw, type) ?: emptyList()
            val deleted = loadDeletedLogIds().toSet()
            parsed.filter { it.id !in deleted }.sortedByDescending { it.timestampMs }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveBattleLogs(logs: List<BattleLogEntry>) {
        // Ensure Main Battle Logs remain compact (timelineEvents stored exclusively in 7-day AI Training Logs)
        val compact = logs.map {
            if (it.timelineEvents.isEmpty()) it else it.copy(timelineEvents = emptyList())
        }.sortedByDescending { it.timestampMs }
        prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(compact)).apply()
    }

    /**
     * Loads 7-day rolling AI Training Logs (`gbl_ai_training_logs_v1`) and automatically purges
     * any records older than 7 days (`OverlayService.AI_LOG_RETENTION_MS`).
     */
    private fun loadAiTrainingLogs(): List<OverlayService.AiTrainingLogRecord> {
        val raw = prefs.getString(OverlayService.PREFS_KEY_AI_TRAINING_LOGS, null) ?: return emptyList()
        return try {
            val nowMs = System.currentTimeMillis()
            val cutoffMs = nowMs - OverlayService.AI_LOG_RETENTION_MS
            val type = object : TypeToken<List<OverlayService.AiTrainingLogRecord>>() {}.type
            val parsed: List<OverlayService.AiTrainingLogRecord> = gson.fromJson<List<OverlayService.AiTrainingLogRecord>>(raw, type) ?: emptyList()
            val deleted = loadDeletedLogIds().toSet()
            val fresh = parsed.filter { it.timestampMs >= cutoffMs && it.battleId !in deleted }
                .distinctBy { it.battleId }
                .sortedByDescending { it.timestampMs }
            if (fresh.size != parsed.size) {
                prefs.edit().putString(OverlayService.PREFS_KEY_AI_TRAINING_LOGS, gson.toJson(fresh)).apply()
            }
            fresh
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveAiTrainingLogs(logs: List<OverlayService.AiTrainingLogRecord>) {
        val cutoffMs = System.currentTimeMillis() - OverlayService.AI_LOG_RETENTION_MS
        val fresh = logs.filter { it.timestampMs >= cutoffMs }
            .distinctBy { it.battleId }
            .sortedByDescending { it.timestampMs }
            .take(250)
        prefs.edit().putString(OverlayService.PREFS_KEY_AI_TRAINING_LOGS, gson.toJson(fresh)).apply()
    }

    /**
     * v3.50 One-Time AI Log Split & 7-Day Auto-Purge Script:
     * 1. Extracts any embedded `timelineEvents` from Main Battle Logs (`gbl_battle_logs_v1`) into `gbl_ai_training_logs_v1`.
     * 2. Purges any timestamped AI training logs older than 7 days (`AI_LOG_RETENTION_MS`).
     * 3. Backfills `finalUserHpPct`, `finalOppHpPct`, `firstSwapActor`, and `switchAdvantage` onto Main Battle Logs
     *    and strips `timelineEvents` from Main Battle Logs so meta-tracking records stay permanently lightweight.
     */
    private fun runOneTimeAiLogSplitAndCleanup(silent: Boolean = false) {
        try {
            val nowMs = System.currentTimeMillis()
            val cutoffMs = nowMs - OverlayService.AI_LOG_RETENTION_MS
            val rawMain = prefs.getString(PREFS_KEY_BATTLE_LOGS, null)
            val mainType = object : TypeToken<List<BattleLogEntry>>() {}.type
            val mainLogs: List<BattleLogEntry> = if (!rawMain.isNullOrBlank()) {
                try { gson.fromJson<List<BattleLogEntry>>(rawMain, mainType) ?: emptyList() } catch (_: Exception) { emptyList() }
            } else emptyList()

            val rawAi = prefs.getString(OverlayService.PREFS_KEY_AI_TRAINING_LOGS, null)
            val aiType = object : TypeToken<List<OverlayService.AiTrainingLogRecord>>() {}.type
            val existingAiLogs: MutableList<OverlayService.AiTrainingLogRecord> = if (!rawAi.isNullOrBlank()) {
                try { (gson.fromJson<List<OverlayService.AiTrainingLogRecord>>(rawAi, aiType) ?: emptyList()).toMutableList() } catch (_: Exception) { mutableListOf() }
            } else mutableListOf()

            val beforeAiCount = existingAiLogs.size
            var splitFromMainCount = 0
            var purgedOldAiCount = 0
            var compactedMainCount = 0

            val updatedMain = mainLogs.map { entry ->
                val embeddedEvents = entry.timelineEvents
                val hasEmbedded = embeddedEvents.isNotEmpty()
                val existingAi = existingAiLogs.find { it.battleId == entry.id }
                val eventsForDerive = if (hasEmbedded) embeddedEvents else (existingAi?.timelineEvents ?: emptyList())

                if (hasEmbedded) {
                    compactedMainCount++
                    if (entry.timestampMs >= cutoffMs) {
                        splitFromMainCount++
                        existingAiLogs.removeAll { it.battleId == entry.id }
                        existingAiLogs.add(
                            OverlayService.AiTrainingLogRecord(
                                battleId = entry.id,
                                timestampMs = entry.timestampMs,
                                league = entry.league,
                                userTeamName = entry.userTeamName,
                                userPokemon = entry.userPokemon,
                                opponents = entry.opponents,
                                leadMatchup = entry.leadMatchup,
                                result = entry.result,
                                battleDurationSec = entry.battleDurationSec,
                                adherenceRatePct = entry.adherenceRatePct,
                                recommendationsIssuedCount = entry.recommendationsIssuedCount,
                                recommendationsFollowedCount = entry.recommendationsFollowedCount,
                                timelineEvents = embeddedEvents
                            )
                        )
                    } else {
                        purgedOldAiCount++
                    }
                }

                val (derivedActor, derivedAdv) = if (entry.firstSwapActor.isNullOrBlank() || entry.switchAdvantage.isNullOrBlank()) {
                    OverlayService.deriveFirstSwapAndSwitchAdvantageStatic(
                        eventsForDerive,
                        entry.result
                    )
                } else {
                    (entry.firstSwapActor ?: "NONE") to (entry.switchAdvantage ?: "NEUTRAL")
                }

                val lastEv = eventsForDerive.lastOrNull()
                val resolvedUserHp = entry.finalUserHpPct?.takeIf { it.isNotEmpty() } ?: lastEv?.userSlotHpPct?.takeIf { it.isNotEmpty() } ?: run {
                    val uFaints = (entry.userFaints ?: entry.quality?.userFaints ?: 0).coerceIn(0, 3)
                    val activeEndHp = if (entry.result.equals("WIN", ignoreCase = true)) 45 else 0
                    List(3) { slot ->
                        when {
                            slot < uFaints -> 0
                            slot == uFaints -> activeEndHp
                            else -> 100
                        }
                    }
                }
                val resolvedOppHp = entry.finalOppHpPct?.takeIf { it.isNotEmpty() } ?: lastEv?.oppSlotHpPct?.takeIf { it.isNotEmpty() } ?: run {
                    val oFaints = (entry.oppFaints ?: entry.quality?.oppFaints ?: if (entry.result.equals("WIN", ignoreCase = true)) 3 else 1).coerceIn(0, 3)
                    val activeEndHp = if (entry.result.equals("WIN", ignoreCase = true)) 0 else 40
                    List(3) { slot ->
                        when {
                            slot < oFaints -> 0
                            slot == oFaints -> activeEndHp
                            else -> 100
                        }
                    }
                }

                entry.copy(
                    timelineEvents = emptyList(),
                    finalUserHpPct = resolvedUserHp,
                    finalOppHpPct = resolvedOppHp,
                    firstSwapActor = derivedActor,
                    switchAdvantage = derivedAdv
                )
            }

            val expiredInStore = existingAiLogs.count { it.timestampMs < cutoffMs }
            purgedOldAiCount += expiredInStore
            val retainedAiLogs = existingAiLogs
                .filter { it.timestampMs >= cutoffMs }
                .distinctBy { it.battleId }
                .sortedByDescending { it.timestampMs }
                .take(250)

            prefs.edit()
                .putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(updatedMain.sortedByDescending { it.timestampMs }))
                .putString(OverlayService.PREFS_KEY_AI_TRAINING_LOGS, gson.toJson(retainedAiLogs))
                .putBoolean(OverlayService.PREFS_KEY_AI_LOGS_SPLIT_DONE, true)
                .apply()

            if (!silent) {
                runOnUiThread {
                    renderBattleLogPage()
                    Toast.makeText(
                        this,
                        "✅ AI Log Split & Cleanup Complete: ${updatedMain.size} main logs compacted • $splitFromMainCount <7d AI logs split • $purgedOldAiCount >7d AI logs purged (${retainedAiLogs.size} active <7d AI logs)",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        } catch (_: Exception) {}
    }

    /**
     * Phase 3 Retroactive Data Migration Routine:
     * Iterates through all historical matches in SharedPreferences (active + trash).
     * - If `oppTeam.firstSwap` (2nd opponent) is missing, marks as unranked (`bmfScore = null`, `execWae = null`, `quality = null`).
     * - If team data exists, calculates BMF (P_pre), Dynamic Execution WAE (Delta_Q_final),
     *   and attaches applicable Primary Performance Badges and Contextual Event Flags.
     * - Persists updated records back to storage without data loss.
     */
    private fun migrateExistingBattleLogs() {
        val reparseVer = prefs.getInt("damage_reparse_version", 0)
        if (reparseVer < 215) {
            reparseAllCompletedBattles(silent = true)
            prefs.edit()
                .putInt("damage_reparse_version", 293)
                .putInt("phase3_migration_version", 293)
                .apply()
            return
        }

        val phase3Migrated = prefs.getInt("phase3_migration_version", 0) >= 293
        val presets = loadPresets()

        fun migrateEntryList(rawJson: String?): Pair<List<BattleLogEntry>?, Boolean> {
            if (rawJson.isNullOrBlank()) return null to false
            return try {
                val type = object : TypeToken<List<BattleLogEntry>>() {}.type
                val parsed: List<BattleLogEntry> = gson.fromJson<List<BattleLogEntry>>(rawJson, type) ?: return null to false
                if (parsed.isEmpty()) return parsed to false

                var didMutate = false
                val migrated = parsed.map { entry ->
                    val firstSwap = entry.opponents.getOrNull(1)?.trim().orEmpty()
                    val isMissingFirstSwap = firstSwap.isEmpty()

                    val alreadyValidUnranked =
                        phase3Migrated && isMissingFirstSwap && entry.qualityEvaluated && entry.quality == null && entry.bmfScore == null && entry.execWae == null
                    val alreadyValidRanked =
                        phase3Migrated && !isMissingFirstSwap && entry.quality != null && entry.bmfScore != null && entry.execWae != null

                    if (alreadyValidUnranked || alreadyValidRanked) {
                        entry
                    } else {
                        didMutate = true
                        if (isMissingFirstSwap) {
                            entry.copy(
                                bmfScore = null,
                                execWae = null,
                                badges = emptyList(),
                                flags = emptyList(),
                                quality = null,
                                qualityEvaluated = true
                            )
                        } else {
                            val computed = resolveEntryQuality(entry, presets, forceRecalculate = true)
                            entry.copy(
                                bmfScore = computed?.pPre,
                                execWae = computed?.execWae,
                                badges = computed?.badges ?: if (computed != null) listOf(computed.badgeLabel) else emptyList(),
                                flags = computed?.contextualFlags ?: emptyList(),
                                quality = computed,
                                qualityEvaluated = true
                            )
                        }
                    }
                }
                migrated to didMutate
            } catch (_: Exception) {
                null to false
            }
        }

        val (migratedActive, activeMutated) = migrateEntryList(prefs.getString(PREFS_KEY_BATTLE_LOGS, null))
        val (migratedTrash, trashMutated) = migrateEntryList(prefs.getString(PREFS_KEY_DELETED_BATTLES_TRASH, null))

        val editor = prefs.edit()
        if (activeMutated && migratedActive != null) {
            editor.putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(migratedActive))
        }
        if (trashMutated && migratedTrash != null) {
            editor.putString(PREFS_KEY_DELETED_BATTLES_TRASH, gson.toJson(migratedTrash))
        }
        if (!phase3Migrated || activeMutated || trashMutated) {
            editor.putInt("phase3_migration_version", 293)
            editor.apply()
        }
    }

    /**
     * Re-evaluates all completed battles (and trash battles) from scratch using the latest
     * damage multipliers (2.56x dual-type effectiveness, 1.2x Shadow attack, half-level CPM stats)
     * and recalculates Lead Matchup (Favorable/Neutral/Negative), BMF (P_pre),
     * Dynamic Execution WAE (Delta_Q_final), Primary Performance Badges, and Contextual Flags.
     */
    private fun reparseAllCompletedBattles(silent: Boolean) {
        if (!silent && ::btnReparseBattlesSettings.isInitialized) {
            btnReparseBattlesSettings.isEnabled = false
        }
        lifecycleScope.launch(Dispatchers.Default) {
            try {
                val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                if (cacheFile.exists() && cacheFile.length() > 1000 && OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                }
                for ((leagueKey, fileName, _) in RANKINGS_ENDPOINTS) {
                    val rFile = File(filesDir, fileName)
                    if (rFile.exists() && rFile.length() > 200 && OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                        OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                    }
                }
            } catch (_: Exception) {}

            val presets = loadPresets()
            val nowMs = System.currentTimeMillis()

            fun reparseEntry(entry: BattleLogEntry): BattleLogEntry {
                val matchedPreset = presets.find {
                    (entry.presetId.isNotBlank() && it.id == entry.presetId) ||
                        it.name.equals(entry.userTeamName, ignoreCase = true)
                }
                val myMons = if (entry.userPokemon.size >= 3) {
                    entry.userPokemon
                } else if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
                    matchedPreset.pokemon.map { it.name }
                } else {
                    entry.userPokemon
                }
                val leadSlot = matchedPreset?.pokemon?.firstOrNull()
                val myLeadName = myMons.firstOrNull()?.trim().orEmpty()
                val oppLeadName = entry.opponents.firstOrNull()?.trim().orEmpty()
                val updatedLead = if (myLeadName.isNotEmpty() && oppLeadName.isNotEmpty()) {
                    OverlayService.calculateAutoLeadMatchupStatic(
                        myLead = myLeadName,
                        oppLead = oppLeadName,
                        league = entry.league,
                        myFastMove = leadSlot?.fastMove,
                        myCharged1 = leadSlot?.chargedMove1,
                        myCharged2 = leadSlot?.chargedMove2,
                        myCp = leadSlot?.cp,
                        myIvs = leadSlot?.ivs
                    )
                } else {
                    entry.leadMatchup
                }
                val freshQuality = resolveEntryQuality(entry, presets, forceRecalculate = true)
                return entry.copy(
                    userPokemon = if (entry.userPokemon.isEmpty() && myMons.isNotEmpty()) myMons else entry.userPokemon,
                    leadMatchup = updatedLead,
                    bmfScore = freshQuality?.pPre,
                    execWae = freshQuality?.execWae,
                    badges = freshQuality?.badges ?: if (freshQuality != null) listOf(freshQuality.badgeLabel) else emptyList(),
                    flags = freshQuality?.contextualFlags ?: emptyList(),
                    quality = freshQuality,
                    qualityEvaluated = true,
                    updatedAt = nowMs
                )
            }

            val activeLogs = loadBattleLogs()
            val reparsedActive = activeLogs.map { reparseEntry(it) }
            if (reparsedActive.isNotEmpty()) {
                saveBattleLogs(reparsedActive)
            }

            val trashLogs = loadDeletedBattlesTrash()
            if (trashLogs.isNotEmpty()) {
                val reparsedTrash = trashLogs.map { reparseEntry(it) }
                saveDeletedBattlesTrash(reparsedTrash)
            }

            recalculateAllPresetsWithSeasonMetaBlocking(reparsedActive)
            val aggWae = OverlayService.calculateAggregateWAEStatic(reparsedActive.map { it.quality })

            withContext(Dispatchers.Main) {
                if (::btnReparseBattlesSettings.isInitialized) {
                    btnReparseBattlesSettings.isEnabled = true
                }
                if (::textReparseBattlesStatus.isInitialized) {
                    val timeFmt = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(java.util.Date(nowMs))
                    textReparseBattlesStatus.text = "✅ Reparsed ${reparsedActive.size} battle(s) at $timeFmt • Ranked: ${aggWae.rankedCount} • Exec WAE: ${aggWae.formatted} • Luck: ${aggWae.luckFormatted}"
                }
                refreshPresetsUi()
                renderBattleLogPage()
                updateSyncStatusUi()

                if (!silent) {
                    Toast.makeText(
                        this@MainActivity,
                        "✅ Reparsed ${reparsedActive.size} completed battle(s) (Exec WAE: ${aggWae.formatted} • Luck: ${aggWae.luckFormatted})!",
                        Toast.LENGTH_LONG
                    ).show()
                    triggerTwoDeviceCloudSync(silent = true)
                }
            }
        }
    }

    @Suppress("USELESS_ELVIS")
    private fun resolveEntryQuality(
        entry: BattleLogEntry,
        presets: List<TeamPreset>,
        forceRecalculate: Boolean = false
    ): OverlayService.BattleQualityMetadata? {
        if (!forceRecalculate) {
            if (entry.quality != null) return entry.quality
            if (entry.qualityEvaluated) return null
        }

        val oppsList = entry.opponents ?: emptyList()
        val firstSwap = oppsList.getOrNull(1)?.trim().orEmpty()
        if (firstSwap.isEmpty()) return null

        val safePresetId = entry.presetId ?: ""
        val safeUserTeamName = entry.userTeamName ?: ""
        val matchedPreset = presets.find {
            (safePresetId.isNotBlank() && it.id == safePresetId) ||
                it.name.equals(safeUserTeamName, ignoreCase = true)
        }
        val safeUserMons = entry.userPokemon ?: emptyList()
        val myMons = if (safeUserMons.size >= 3) {
            safeUserMons
        } else if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
            matchedPreset.pokemon.map { it.name }
        } else {
            safeUserMons
        }
        val serviceSlots = matchedPreset?.pokemon?.map {
            OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
        }
        val aiLogEvents = loadAiTrainingLogs().find { it.battleId == entry.id }?.timelineEvents
        val safeTimeline = (entry.timelineEvents ?: emptyList()).ifEmpty { aiLogEvents ?: emptyList() }
        val hasTimeline = safeTimeline.isNotEmpty()
        return OverlayService.calculateBattleQuality(
            myTeam = myMons,
            oppTeam = oppsList,
            league = entry.league ?: "GREAT LEAGUE",
            result = entry.result ?: "WIN",
            myTeamSlots = serviceSlots,
            timelineEvents = safeTimeline.takeIf { it.isNotEmpty() },
            totalDurationSec = entry.battleDurationSec,
            explicitUserFaints = entry.userFaints ?: (if (hasTimeline) entry.quality?.userFaints else null),
            explicitOppFaints = entry.oppFaints ?: (if (hasTimeline) entry.quality?.oppFaints else null),
            explicitUserShieldsRemaining = entry.userShieldsRemaining ?: (if (hasTimeline) entry.quality?.userShieldsRemaining else null),
            explicitOppShieldsRemaining = entry.oppShieldsRemaining ?: (if (hasTimeline) entry.quality?.oppShieldsRemaining else null)
        )
    }

    private fun loadDeletedLogIds(): List<String> {
        val raw = prefs.getString(PREFS_KEY_DELETED_LOG_IDS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    private fun saveDeletedLogIds(ids: List<String>) {
        prefs.edit().putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(ids.distinct())).apply()
    }

    private fun loadDeletedTeamIds(): List<String> {
        val raw = prefs.getString(PREFS_KEY_DELETED_TEAM_IDS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    private fun saveDeletedTeamIds(ids: List<String>) {
        prefs.edit().putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(ids.distinct())).apply()
    }

    private fun loadDeletedBattlesTrash(): List<BattleLogEntry> {
        val raw = prefs.getString(PREFS_KEY_DELETED_BATTLES_TRASH, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<BattleLogEntry>>() {}.type
            (gson.fromJson<List<BattleLogEntry>>(raw, type) ?: emptyList()).distinctBy { it.id }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveDeletedBattlesTrash(logs: List<BattleLogEntry>) {
        val trimmed = logs.distinctBy { it.id }.take(200)
        prefs.edit().putString(PREFS_KEY_DELETED_BATTLES_TRASH, gson.toJson(trimmed)).apply()
        updateTrashButtonsUi()
    }

    private fun loadDeletedTeamsTrash(): List<TeamPreset> {
        val raw = prefs.getString(PREFS_KEY_DELETED_TEAMS_TRASH, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            (gson.fromJson<List<TeamPreset>>(raw, type) ?: emptyList()).distinctBy { it.id }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveDeletedTeamsTrash(teams: List<TeamPreset>) {
        val trimmed = teams.distinctBy { it.id }.take(50)
        prefs.edit().putString(PREFS_KEY_DELETED_TEAMS_TRASH, gson.toJson(trimmed)).apply()
        updateTrashButtonsUi()
    }

    private fun updateTrashButtonsUi() {
        if (::btnTrashTeams.isInitialized) {
            val count = loadDeletedTeamsTrash().size
            btnTrashTeams.text = if (count > 0) "🗑️ Trash ($count)" else "🗑️ Trash"
        }
        if (::btnTrashBattleLog.isInitialized) {
            val count = loadDeletedBattlesTrash().size
            btnTrashBattleLog.text = if (count > 0) "🗑️ Trash ($count)" else "🗑️ Trash"
        }
    }

    private fun showUndoBanner(message: String, onUndo: () -> Unit) {
        if (!::layoutUndoBanner.isInitialized) return
        undoHideJob?.cancel()
        pendingUndoAction = onUndo
        textUndoBannerMsg.text = message
        layoutUndoBanner.visibility = android.view.View.VISIBLE
        undoHideJob = lifecycleScope.launch {
            kotlinx.coroutines.delay(9000L)
            hideUndoBanner()
        }
    }

    private fun hideUndoBanner() {
        undoHideJob?.cancel()
        undoHideJob = null
        pendingUndoAction = null
        if (::layoutUndoBanner.isInitialized) {
            layoutUndoBanner.visibility = android.view.View.GONE
        }
    }

    private fun restoreBattleLogsFromTrash(entriesToRestore: List<BattleLogEntry>) {
        if (entriesToRestore.isEmpty()) return
        val nowMs = System.currentTimeMillis()
        val restoreIds = entriesToRestore.map { it.id }.toSet()

        val remainingDelIds = loadDeletedLogIds().filter { it !in restoreIds }
        saveDeletedLogIds(remainingDelIds)

        val remainingTrash = loadDeletedBattlesTrash().filter { it.id !in restoreIds }
        saveDeletedBattlesTrash(remainingTrash)

        val currentLogs = loadBattleLogs().toMutableList()
        for (entry in entriesToRestore) {
            currentLogs.removeAll { it.id == entry.id }
            currentLogs.add(entry.copy(updatedAt = nowMs))
        }
        saveBattleLogs(currentLogs)
        setupBattleLogFilters()
        renderBattleLogPage()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
    }

    private fun restoreTeamPresetFromTrash(preset: TeamPreset) {
        val nowMs = System.currentTimeMillis()
        val remainingDelIds = loadDeletedTeamIds().filter { it != preset.id }
        saveDeletedTeamIds(remainingDelIds)

        val remainingTrash = loadDeletedTeamsTrash().filter { it.id != preset.id }
        saveDeletedTeamsTrash(remainingTrash)

        val currentPresets = loadPresets().toMutableList()
        currentPresets.removeAll { it.id == preset.id }
        currentPresets.add(preset.copy(updatedAt = nowMs))
        savePresets(currentPresets)
        refreshPresetsUi()
        setupBattleLogFilters()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
    }

    private fun showTeamsTrashBinDialog() {
        val trashList = loadDeletedTeamsTrash()
        if (trashList.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("🗑️ Deleted Teams Trash Bin")
                .setMessage("No deleted teams in Trash. Any team you delete will appear here so you can restore it anytime.")
                .setPositiveButton("OK", null)
                .show()
            return
        }

        val density = resources.displayMetrics.density
        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            val pad = (12 * density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(container)

        var dialogRef: AlertDialog? = null

        for (team in trashList) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }
            val titleTv = TextView(this).apply {
                text = "${team.name} (${team.league})"
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val monsTv = TextView(this).apply {
                text = team.pokemon.joinToString(" / ") { it.name }
                setTextColor(0xFF94A3B8.toInt())
                textSize = 11.5f
                setPadding(0, (3 * density).toInt(), 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
            }
            val restoreBtn = Button(this).apply {
                text = "♻️ Restore Team"
                textSize = 11f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setOnClickListener {
                    restoreTeamPresetFromTrash(team)
                    Toast.makeText(this@MainActivity, "Restored '${team.name}'!", Toast.LENGTH_SHORT).show()
                    dialogRef?.dismiss()
                }
            }
            val deleteForeverBtn = Button(this).apply {
                text = "✕ Delete Forever"
                textSize = 11f
                setTextColor(0xFFFCA5A5.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF450A0A.toInt())
                setOnClickListener {
                    saveDeletedTeamsTrash(loadDeletedTeamsTrash().filter { it.id != team.id })
                    dialogRef?.dismiss()
                    showTeamsTrashBinDialog()
                }
            }
            btnRow.addView(restoreBtn)
            btnRow.addView(deleteForeverBtn)
            card.addView(titleTv)
            card.addView(monsTv)
            card.addView(btnRow)
            container.addView(card)
        }

        applyCurrentAppThemeToSubtree(scroll)

        dialogRef = AlertDialog.Builder(this)
            .setTitle("🗑️ Deleted Teams (${trashList.size})")
            .setView(scroll)
            .setPositiveButton("♻️ Restore All") { _, _ ->
                trashList.forEach { restoreTeamPresetFromTrash(it) }
                Toast.makeText(this, "Restored ${trashList.size} team(s)!", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("🗑️ Empty Trash") { _, _ ->
                saveDeletedTeamsTrash(emptyList())
                Toast.makeText(this, "Team trash emptied", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .create()
        dialogRef.show()
    }

    private fun showBattleLogsTrashBinDialog() {
        val trashList = loadDeletedBattlesTrash()
        if (trashList.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("🗑️ Deleted Battles Trash Bin")
                .setMessage("No deleted battles in Trash. Any battle you delete or clear will appear here so you can restore it anytime.")
                .setPositiveButton("OK", null)
                .show()
            return
        }

        val density = resources.displayMetrics.density
        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            val pad = (12 * density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(container)

        val dateFmt = java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US)
        var dialogRef: AlertDialog? = null

        for (entry in trashList) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }
            val isWin = entry.result.equals("WIN", ignoreCase = true)
            val titleTv = TextView(this).apply {
                text = "${if (isWin) "🏆 WIN" else "💀 LOSS"} • ${entry.userTeamName} (${ dateFmt.format(java.util.Date(entry.timestampMs)) })"
                setTextColor(if (isWin) 0xFF4ADE80.toInt() else 0xFFF87171.toInt())
                textSize = 12.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val oppsTv = TextView(this).apply {
                text = "Vs: ${if (entry.opponents.isEmpty()) "Unknown" else entry.opponents.joinToString(", ")}"
                setTextColor(0xFFE2E8F0.toInt())
                textSize = 11.5f
                setPadding(0, (3 * density).toInt(), 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
            }
            val restoreBtn = Button(this).apply {
                text = "♻️ Restore"
                textSize = 11f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setOnClickListener {
                    restoreBattleLogsFromTrash(listOf(entry))
                    Toast.makeText(this@MainActivity, "Battle restored!", Toast.LENGTH_SHORT).show()
                    dialogRef?.dismiss()
                }
            }
            val deleteForeverBtn = Button(this).apply {
                text = "✕ Delete Forever"
                textSize = 11f
                setTextColor(0xFFFCA5A5.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF450A0A.toInt())
                setOnClickListener {
                    saveDeletedBattlesTrash(loadDeletedBattlesTrash().filter { it.id != entry.id })
                    dialogRef?.dismiss()
                    showBattleLogsTrashBinDialog()
                }
            }
            btnRow.addView(restoreBtn)
            btnRow.addView(deleteForeverBtn)
            card.addView(titleTv)
            card.addView(oppsTv)
            card.addView(btnRow)
            container.addView(card)
        }

        applyCurrentAppThemeToSubtree(scroll)

        dialogRef = AlertDialog.Builder(this)
            .setTitle("🗑️ Deleted Battles (${trashList.size})")
            .setView(scroll)
            .setPositiveButton("♻️ Restore All (${trashList.size})") { _, _ ->
                restoreBattleLogsFromTrash(trashList)
                Toast.makeText(this, "Restored ${trashList.size} battle(s)!", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("🗑️ Empty Trash") { _, _ ->
                saveDeletedBattlesTrash(emptyList())
                Toast.makeText(this, "Battle trash emptied", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .create()
        dialogRef.show()
    }

    private fun setupBattleLogFilters() {
        if (!::spinnerLogFilterLeague.isInitialized) return
        isUpdatingLogFilterSpinners = true

        val leagueLabels = listOf(
            "All Leagues",
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "MEGA MASTER LEAGUE"
        )
        val leagueKeys = listOf(
            "ALL",
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "MEGA MASTER LEAGUE"
        )
        spinnerLogFilterLeague.adapter = createThemedSpinnerAdapter(leagueLabels)
        val lgIdx = leagueKeys.indexOf(selectedLogLeagueFilter).takeIf { it >= 0 } ?: 0
        spinnerLogFilterLeague.setSelection(lgIdx, false)

        val allPresets = loadPresets()
        val matchingPresets = if (selectedLogLeagueFilter == "ALL") {
            allPresets
        } else {
            allPresets.filter { it.league.equals(selectedLogLeagueFilter, ignoreCase = true) }
        }
        val teamLabels = listOf("All Teams") + matchingPresets.map { it.name }
        val teamKeys = listOf("ALL") + matchingPresets.map { it.name }
        spinnerLogFilterTeam.adapter = createThemedSpinnerAdapter(teamLabels)
        val tmIdx = teamKeys.indexOf(selectedLogTeamFilter).takeIf { it >= 0 } ?: 0
        if (tmIdx == 0) selectedLogTeamFilter = "ALL"
        spinnerLogFilterTeam.setSelection(tmIdx, false)

        val (currSeason, _) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d", java.util.Locale.US)
        val timeframeLabels = listOf(
            "All Time",
            "Today (Day)",
            "Yesterday",
            "This Week (Last 7d)",
            "Current Season (${currSeason.name} • ${dateFmt.format(java.util.Date(currSeason.startMs))})",
            "Previous Season"
        )
        val timeframeKeys = listOf(
            "ALL_TIME",
            "DAY",
            "YESTERDAY",
            "WEEK",
            "CURRENT_SEASON",
            "PREVIOUS_SEASON"
        )
        spinnerLogFilterTimeframe.adapter = createThemedSpinnerAdapter(timeframeLabels)
        val tfIdx = timeframeKeys.indexOf(selectedLogTimeframeFilter).takeIf { it >= 0 } ?: 0
        spinnerLogFilterTimeframe.setSelection(tfIdx, false)

        spinnerLogFilterLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextLg = leagueKeys.getOrElse(position) { "ALL" }
                if (nextLg != selectedLogLeagueFilter) {
                    selectedLogLeagueFilter = nextLg
                    selectedLogTeamFilter = "ALL"
                    setupBattleLogFilters()
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        spinnerLogFilterTeam.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextTm = teamKeys.getOrElse(position) { "ALL" }
                if (nextTm != selectedLogTeamFilter) {
                    selectedLogTeamFilter = nextTm
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        spinnerLogFilterTimeframe.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextTf = timeframeKeys.getOrElse(position) { "ALL_TIME" }
                if (nextTf != selectedLogTimeframeFilter) {
                    selectedLogTimeframeFilter = nextTf
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        isUpdatingLogFilterSpinners = false
    }

    private fun filterBattleLogs(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): List<BattleLogEntry> {
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val startOfTodayMs = cal.timeInMillis
        cal.add(java.util.Calendar.DAY_OF_YEAR, -1)
        val startOfYesterdayMs = cal.timeInMillis
        val sevenDaysAgoMs = startOfTodayMs - 6L * 86400000L

        return logs.filter { entry ->
            val leagueOk = leagueFilter == "ALL" || entry.league.equals(leagueFilter, ignoreCase = true)
            val teamOk = teamFilter == "ALL" || entry.userTeamName.equals(teamFilter, ignoreCase = true)
            val timeOk = when (timeframeKey) {
                "DAY" -> entry.timestampMs >= startOfTodayMs
                "YESTERDAY" -> entry.timestampMs in startOfYesterdayMs until startOfTodayMs
                "WEEK" -> entry.timestampMs >= sevenDaysAgoMs
                "CURRENT_SEASON" -> entry.timestampMs in currSeason.startMs..currSeason.endMs
                "PREVIOUS_SEASON" -> entry.timestampMs >= prevSeason.startMs && entry.timestampMs < currSeason.startMs
                else -> true
            }
            leagueOk && teamOk && timeOk
        }
    }

    private fun normalizeDailyLeadKey(rawLead: String?): String {
        val trimmed = rawLead?.trim().orEmpty()
        if (trimmed.isEmpty() ||
            trimmed.equals("Unknown", ignoreCase = true) ||
            trimmed.equals("Waiting...", ignoreCase = true) ||
            trimmed.equals("No opponents recorded", ignoreCase = true)
        ) {
            return ""
        }
        val exported = formatExportPokemonName(trimmed)
        if (exported.isEmpty()) return ""
        val isShadow = exported.endsWith("S") && exported.dropLast(1).any { it.isLowerCase() }
        val baseExport = if (isShadow) exported.dropLast(1) else exported
        val canonicalBase = baseExport.lowercase()
            .removeSuffix("_kanto")
            .removeSuffix("_kantonian")
            .removeSuffix("_base")
        return if (isShadow) "${canonicalBase}_shadow" else canonicalBase
    }

    private fun countUniqueLeads(entries: List<BattleLogEntry>): Int {
        return entries.mapNotNull { entry ->
            normalizeDailyLeadKey(entry.opponents.firstOrNull()).takeIf { it.isNotEmpty() }
        }.toSet().size
    }

    private data class ResolvedUserTeamInfo(
        val teamName: String,
        val mons: List<String>,
        val monsBracket: String,
        val groupKey: String
    )

    /**
     * Standardized Go Battle Log Export Name Formatter (used exclusively for Copy & Share output, not in-app log naming):
     * 1. Replaces spaces and hyphens in Pokémon names with '_'
     * 2. Formats form/region variants as basename_form / basename_region (e.g. ninetales_kanto, giratina_altered)
     * 3. Shadow Pokémon names end in uppercase 'S' after any form suffix and do not start with 'Shadow' (e.g. ninetales_alolanS, laprasS)
     * 4. Mega and Primal Pokémon end with uppercase '_MEGA' (or '_MEGA_X' / '_MEGA_Y') or '_PRIMAL' (e.g. charizard_MEGA_Y)
     * 5. All Pokémon names are entirely lowercase besides the ending 'S' for Shadow variants or '_MEGA' / '_PRIMAL' suffixes
     */
    private fun formatExportPokemonName(rawName: String): String {
        var working = rawName.trim()
        if (working.isEmpty()) return ""
        if (working.equals("Unknown", ignoreCase = true) || working.equals("Waiting...", ignoreCase = true)) {
            return working
        }

        var isShadow = false
        var megaPrimalSuffix = ""

        val parenShadowRegex = Regex("\\(\\s*shadow\\s*\\)", RegexOption.IGNORE_CASE)
        if (parenShadowRegex.containsMatchIn(working)) {
            isShadow = true
            working = working.replace(parenShadowRegex, " ").trim()
        }

        val leadingShadowRegex = Regex("^shadow[\\s_-]+(?!rider\\b)", RegexOption.IGNORE_CASE)
        if (leadingShadowRegex.containsMatchIn(working)) {
            isShadow = true
            working = working.replace(leadingShadowRegex, "").trim()
        }

        val trailingShadowRegex = Regex("[\\s_-]+shadow$", RegexOption.IGNORE_CASE)
        if (trailingShadowRegex.containsMatchIn(working)) {
            isShadow = true
            working = working.replace(trailingShadowRegex, "").trim()
        }

        if (working.length > 1 &&
            working.endsWith("S") &&
            working.dropLast(1).any { it.isLowerCase() } &&
            !working.endsWith("_MEGA_S", ignoreCase = true)
        ) {
            isShadow = true
            working = working.dropLast(1).trim()
        }

        val parenForms = mutableListOf<String>()
        val parenRegex = Regex("\\(([^)]+)\\)")
        parenRegex.findAll(working).forEach { match ->
            val inside = match.groupValues[1].trim()
            if (inside.isNotEmpty() && !inside.equals("base", ignoreCase = true) && !inside.equals("shadow", ignoreCase = true)) {
                val megaParenMatch = Regex("^mega(?:[\\s_-]+([xy]))?$", RegexOption.IGNORE_CASE).find(inside)
                when {
                    megaParenMatch != null -> {
                        val xy = megaParenMatch.groupValues[1]
                        megaPrimalSuffix = if (xy.isNotEmpty()) "_MEGA_${xy.uppercase()}" else "_MEGA"
                    }
                    inside.equals("primal", ignoreCase = true) -> {
                        megaPrimalSuffix = "_PRIMAL"
                    }
                    (inside.equals("x", ignoreCase = true) || inside.equals("y", ignoreCase = true)) &&
                        working.startsWith("mega", ignoreCase = true) -> {
                        megaPrimalSuffix = "_MEGA_${inside.uppercase()}"
                    }
                    else -> {
                        parenForms.add(inside)
                    }
                }
            }
        }
        var basePart = working.replace(parenRegex, " ").replace(Regex("\\s+"), " ").trim()
        var formPart = parenForms.joinToString("_")

        val trailingMegaPrimalMatch = Regex("^(.+?)[\\s_-]+(mega(?:[\\s_-]+[xy])?|primal)$", RegexOption.IGNORE_CASE).find(basePart)
        if (trailingMegaPrimalMatch != null) {
            basePart = trailingMegaPrimalMatch.groupValues[1].trim()
            val mpRaw = trailingMegaPrimalMatch.groupValues[2].trim()
            megaPrimalSuffix = if (mpRaw.equals("primal", ignoreCase = true)) {
                "_PRIMAL"
            } else {
                val xyMatch = Regex("([xy])$", RegexOption.IGNORE_CASE).find(mpRaw)
                if (xyMatch != null) "_MEGA_${xyMatch.groupValues[1].uppercase()}" else "_MEGA"
            }
        }

        val prefixFormRegex = Regex(
            "^(dusk[\\s_-]+mane|dawn[\\s_-]+wings|single[\\s_-]+strike|rapid[\\s_-]+strike|crowned[\\s_-]+sword|crowned[\\s_-]+shield|ice[\\s_-]+rider|shadow[\\s_-]+rider|galarian[\\s_-]+standard|galarian[\\s_-]+zen|paldean[\\s_-]+combat|paldean[\\s_-]+blaze|paldean[\\s_-]+aqua|blue[\\s_-]+striped|red[\\s_-]+striped|white[\\s_-]+striped|east[\\s_-]+sea|west[\\s_-]+sea|full[\\s_-]+belly|pom[\\s_-]+pom|kanto|kantonian|alolan|alola|galarian|galar|hisuian|hisui|paldean|paldea|unovan|unova|johto|hoenn|sinnoh|kalos|altered|origin|origine|therian|incarnate|crowned|hero|black|white|single|rapid|mega|primal|defense|attack|speed|normal|aria|pirouette|complete|unbound|confined|resolute|ordinary|sky|land|bloodmoon|armored|apex|wash|heat|frost|mow|fan|sunny|rainy|snowy|plant|trash|burn|chill|douse|shock|midnight|midday|dusk|baile|pau|pa'u|sensu|zen|standard|combat|blaze|aqua|hangry)[\\s_-]+(.+)$",
            RegexOption.IGNORE_CASE
        )
        val prefixMatch = prefixFormRegex.find(basePart)
        if (prefixMatch != null) {
            val extractedPrefix = prefixMatch.groupValues[1].trim()
            var remainingBase = prefixMatch.groupValues[2].trim()
            when {
                extractedPrefix.equals("mega", ignoreCase = true) -> {
                    val megaXYMatch = Regex("^(.+?)[\\s_-]+([xy])$", RegexOption.IGNORE_CASE).find(remainingBase)
                    if (megaXYMatch != null) {
                        remainingBase = megaXYMatch.groupValues[1].trim()
                        megaPrimalSuffix = "_MEGA_${megaXYMatch.groupValues[2].uppercase()}"
                    } else if (megaPrimalSuffix.isEmpty()) {
                        megaPrimalSuffix = "_MEGA"
                    }
                    basePart = remainingBase
                }
                extractedPrefix.equals("primal", ignoreCase = true) -> {
                    megaPrimalSuffix = "_PRIMAL"
                    basePart = remainingBase
                }
                else -> {
                    basePart = remainingBase
                    formPart = if (formPart.isEmpty()) extractedPrefix else "${extractedPrefix}_$formPart"
                }
            }
        } else {
            val sandyMatch = Regex("^(sandy)[\\s_-]+(wormadam.*)$", RegexOption.IGNORE_CASE).find(basePart)
            if (sandyMatch != null) {
                val extractedPrefix = sandyMatch.groupValues[1].trim()
                basePart = sandyMatch.groupValues[2].trim()
                formPart = if (formPart.isEmpty()) extractedPrefix else "${extractedPrefix}_$formPart"
            }
        }

        if (megaPrimalSuffix.isNotEmpty()) {
            isShadow = false
        }

        var normBase = basePart.lowercase()
            .replace(Regex("[\\s-]+"), "_")
            .replace(Regex("_+"), "_")
            .trim('_')

        if (normBase == "giratine") normBase = "giratina"
        else if (normBase.startsWith("giratine_")) normBase = "giratina_" + normBase.removePrefix("giratine_")
        if (normBase == "ninetails") normBase = "ninetales"
        else if (normBase.startsWith("ninetails_")) normBase = "ninetales_" + normBase.removePrefix("ninetails_")

        val normForm = formPart.lowercase()
            .replace(Regex("[\\s-]+"), "_")
            .replace(Regex("_+"), "_")
            .trim('_')

        val combined = if (normForm.isNotEmpty() && normForm != "base" && !normBase.endsWith("_$normForm")) {
            "${normBase}_${normForm}"
        } else {
            normBase
        }

        return when {
            megaPrimalSuffix.isNotEmpty() -> "$combined$megaPrimalSuffix"
            isShadow -> "${combined}S"
            else -> combined
        }
    }

    private fun resolveUserTeamInfo(entry: BattleLogEntry, presets: List<TeamPreset>): ResolvedUserTeamInfo {
        val matchedPreset = presets.find {
            (entry.presetId.isNotBlank() && it.id == entry.presetId) ||
                it.name.equals(entry.userTeamName, ignoreCase = true)
        }
        val teamName = entry.userTeamName.ifBlank { matchedPreset?.name ?: "My Team" }
        val directMons = entry.userPokemon.map { it.trim() }.filter { it.isNotEmpty() }
        val presetMons = matchedPreset?.pokemon?.map { it.name.trim() }?.filter { it.isNotEmpty() }.orEmpty()
        val mons = when {
            directMons.isNotEmpty() -> directMons.map { formatExportPokemonName(it) }
            presetMons.isNotEmpty() -> presetMons.map { formatExportPokemonName(it) }
            else -> listOf(formatExportPokemonName(teamName))
        }
        val monsBracket = "[${mons.joinToString(" ")}]"
        val groupKey = "${teamName.lowercase()}||${mons.joinToString(" ").lowercase()}"
        return ResolvedUserTeamInfo(teamName, mons, monsBracket, groupKey)
    }

    /**
     * Builds the "Copy GBL" clipboard export:
     * Header line: [Pokemon1 Pokemon2 Pokemon3]
     * Rows: Opponent1 Opponent2 Opponent3 W/L
     * Grouped by each team in the filter, sorted newest to oldest, prioritizing most recently used team first.
     */
    private fun buildCopyGblExport(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): String {
        val filtered = filterBattleLogs(logs, leagueFilter, teamFilter, timeframeKey)
            .sortedByDescending { it.timestampMs }
        val presets = loadPresets()
        if (filtered.isEmpty()) {
            val selectedPreset = if (teamFilter != "ALL") {
                presets.find { it.name.equals(teamFilter, ignoreCase = true) }
            } else {
                presets.find { it.isSelected } ?: presets.firstOrNull()
            }
            val fallbackMons = selectedPreset?.pokemon
                ?.map { formatExportPokemonName(it.name.trim()) }
                ?.filter { it.isNotEmpty() }
                .orEmpty()
            return if (fallbackMons.isNotEmpty()) "[${fallbackMons.joinToString(" ")}]" else "[My Team]"
        }

        val groupedByBracket = filtered.groupBy { resolveUserTeamInfo(it, presets).monsBracket }
        val sortedTeams = groupedByBracket.entries.sortedByDescending { (_, teamEntries) ->
            teamEntries.maxOfOrNull { it.timestampMs } ?: 0L
        }

        val blocks = sortedTeams.map { (monsBracket, teamEntries) ->
            val sb = StringBuilder()
            sb.append(monsBracket).append("\n")
            for (entry in teamEntries.sortedByDescending { it.timestampMs }) {
                val oppList = entry.opponents
                    .map { formatExportPokemonName(it.trim()) }
                    .filter { it.isNotEmpty() }
                val oppStr = if (oppList.isEmpty()) "Unknown" else oppList.joinToString(" ")
                val wl = if (entry.result.equals("WIN", ignoreCase = true)) "W" else "L"
                sb.append("$oppStr $wl\n")
            }
            sb.toString().trimEnd()
        }
        return blocks.joinToString("\n\n")
    }

    private fun buildPlainTextExport(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): String {
        val filtered = filterBattleLogs(logs, leagueFilter, teamFilter, timeframeKey)
            .sortedByDescending { it.timestampMs }
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)

        val yesterdayCal = java.util.Calendar.getInstance().apply {
            add(java.util.Calendar.DAY_OF_YEAR, -1)
        }
        val rangeLabel = when (timeframeKey) {
            "DAY" -> "Today (${dateFmt.format(java.util.Date())})"
            "YESTERDAY" -> "Yesterday (${dateFmt.format(yesterdayCal.time)})"
            "WEEK" -> "This Week (Last 7 Days)"
            "CURRENT_SEASON" -> "Current Season (${currSeason.name} • Since ${dateFmt.format(java.util.Date(currSeason.startMs))})"
            "PREVIOUS_SEASON" -> "Previous Season (${dateFmt.format(java.util.Date(prevSeason.startMs))} – ${dateFmt.format(java.util.Date(prevSeason.endMs))})"
            else -> "All Time"
        }

        val wins = filtered.count { it.result.equals("WIN", ignoreCase = true) }
        val losses = filtered.count { it.result.equals("LOSS", ignoreCase = true) }
        val total = wins + losses
        val winPct = if (total > 0) Math.round((wins.toDouble() / total.toDouble()) * 100.0).toInt() else 0
        val favCount = filtered.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
        val neuCount = filtered.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
        val negCount = filtered.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
        val uniqueLeadsTotal = countUniqueLeads(filtered)

        val presets = loadPresets()
        val aggWae = OverlayService.calculateAggregateWAEStatic(filtered.map { resolveEntryQuality(it, presets) })

        val sb = StringBuilder()
        val leagueTitle = if (leagueFilter == "ALL") "All Leagues" else leagueFilter
        val teamTitle = if (teamFilter == "ALL") "All Teams" else teamFilter
        sb.append("SilphScope PvP Battle Log — $leagueTitle\n")
        sb.append("Team: $teamTitle\n")
        sb.append("Range: $rangeLabel\n")
        sb.append("Overall Record:${wins}W-${losses}L($winPct%) • Leads:$favCount Fav/$neuCount Neu/$negCount Neg/$uniqueLeadsTotal Unique • WAE:${aggWae.formatted} • Luck:${aggWae.luckFormatted}\n")

        if (filtered.isEmpty()) {
            sb.append("\nNo battles logged in this timeframe.\n")
            return sb.toString()
        }

        val groupedByDay = filtered.groupBy { dateFmt.format(java.util.Date(it.timestampMs)) }
        for ((dayStr, dayEntries) in groupedByDay) {
            val dayLeadCounts = HashMap<String, Int>()
            for (dEntry in dayEntries) {
                val lKey = normalizeDailyLeadKey(dEntry.opponents.firstOrNull())
                if (lKey.isNotEmpty()) {
                    dayLeadCounts[lKey] = (dayLeadCounts[lKey] ?: 0) + 1
                }
            }

            val groupedByTeam = dayEntries.groupBy { resolveUserTeamInfo(it, presets).groupKey }
            val sortedDayTeams = groupedByTeam.entries.sortedWith(
                compareByDescending<Map.Entry<String, List<BattleLogEntry>>> { it.value.size }
                    .thenByDescending { it.value.maxOfOrNull { e -> e.timestampMs } ?: 0L }
            )

            for ((_, teamDayEntries) in sortedDayTeams) {
                val teamInfo = resolveUserTeamInfo(teamDayEntries.first(), presets)
                val dWins = teamDayEntries.count { it.result.equals("WIN", ignoreCase = true) }
                val dLosses = teamDayEntries.count { it.result.equals("LOSS", ignoreCase = true) }
                val dTotal = dWins + dLosses
                val dPct = if (dTotal > 0) Math.round((dWins.toDouble() / dTotal.toDouble()) * 100.0).toInt() else 0
                val dFav = teamDayEntries.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
                val dNeu = teamDayEntries.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
                val dNeg = teamDayEntries.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
                val dUnique = countUniqueLeads(teamDayEntries)
                val dWae = OverlayService.calculateAggregateWAEStatic(teamDayEntries.map { resolveEntryQuality(it, presets) })

                sb.append("\n=== $dayStr - ${teamInfo.teamName} ${teamInfo.monsBracket} Daily Record:${dWins}W-${dLosses}L($dPct%) [Leads:$dFav Fav/$dNeu Neu/$dNeg Neg/$dUnique Unique] • WAE:${dWae.formatted} • Luck:${dWae.luckFormatted} ===\n")
                for (entry in teamDayEntries.sortedByDescending { it.timestampMs }) {
                    val wl = if (entry.result.equals("WIN", ignoreCase = true)) "W" else "L"
                    val leadTag = when (entry.leadMatchup.uppercase()) {
                        "FAVORABLE" -> "F"
                        "NEGATIVE", "UNFAVORABLE" -> "U"
                        else -> "N"
                    }
                    val q = resolveEntryQuality(entry, presets)
                    val matchPPre = q?.pPre ?: q?.pWin
                    val matchTag = when {
                        matchPPre == null -> "N"
                        matchPPre > 0.60 -> "F"
                        matchPPre < 0.40 -> "U"
                        else -> "N"
                    }
                    val entryLeadKey = normalizeDailyLeadKey(entry.opponents.firstOrNull())
                    val isRepeatLeadToday = entryLeadKey.isNotEmpty() && (dayLeadCounts[entryLeadKey] ?: 0) >= 2
                    val oppList = entry.opponents
                        .map { formatExportPokemonName(it.trim()) }
                        .filter { it.isNotEmpty() }
                        .mapIndexed { idx, formattedOpp ->
                            if (idx == 0 && isRepeatLeadToday) "**$formattedOpp**" else formattedOpp
                        }
                    val oppStr = if (oppList.isEmpty()) "Unknown" else oppList.joinToString(" ")
                    sb.append("$wl (L->$leadTag, M->$matchTag) $oppStr\n")
                }
            }
        }
        return sb.toString().trim()
    }

    private fun loadAndRenderEnergyDebounceUi() {
        if (!::btnDebounce2Samples.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val samples = OverlayService.activeEnergyDebounceSamples.coerceIn(2, 4)
        val toastsOn = OverlayService.activeEnergyUpdateToasts
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        val activeTint = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
        val inactiveTint = android.content.res.ColorStateList.valueOf(theme.elevatedColor)

        val pairs = listOf(
            2 to btnDebounce2Samples,
            3 to btnDebounce3Samples,
            4 to btnDebounce4Samples
        )
        for ((count, btn) in pairs) {
            val isSelected = (samples == count)
            btn.backgroundTintList = if (isSelected) activeTint else inactiveTint
            btn.setTextColor(if (isSelected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
        }

        if (::btnToggleEnergyUpdateToasts.isInitialized && ::textEnergyUpdateToastsDesc.isInitialized) {
            if (toastsOn) {
                btnToggleEnergyUpdateToasts.text = "Toasts On"
                btnToggleEnergyUpdateToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                btnToggleEnergyUpdateToasts.setTextColor(0xFFFFFFFF.toInt())
                textEnergyUpdateToastsDesc.text = "Active: Shows ⚡ [Move] ([Cost]E) • Circle [X]% → [Y]E on every energy change"
            } else {
                btnToggleEnergyUpdateToasts.text = "Toasts Off"
                btnToggleEnergyUpdateToasts.backgroundTintList = inactiveTint
                btnToggleEnergyUpdateToasts.setTextColor(theme.secondaryTextColor)
                textEnergyUpdateToastsDesc.text = "Muted: Live energy & circle % update toasts hidden during battle"
            }
        }

        if (::tvEnergyDebounceSummary.isInitialized) {
            val modeDesc = when (samples) {
                2 -> "2 Matching Samples (Default • Fastest Response, ±2% Fill Tolerance)"
                3 -> "3 Matching Samples (Balanced Noise Rejection, ±2% Fill Tolerance)"
                else -> "4 Matching Samples (Strict Filtering, ±2% Fill Tolerance)"
            }
            val toastStatus = if (toastsOn) "Enabled" else "Muted"
            tvEnergyDebounceSummary.text =
                "• Active: $modeDesc\n" +
                "• Snaps on ≥1E diff to slowest Charge Move (100%–200% White Border + Meniscus)\n" +
                "• Live Energy & Circle % Battle Toasts: $toastStatus"
        }
    }

    private fun saveEnergyDebounceSamples(samples: Int, showToast: Boolean) {
        val clamped = samples.coerceIn(2, 4)
        prefs.edit().putInt(OverlayService.PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, clamped).apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderEnergyDebounceUi()
        if (showToast) {
            Toast.makeText(
                this,
                "Saved Energy Meter Debounce: $clamped matching samples (±2% circle fill tolerance)",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun loadAndRenderTierThresholdsUi() {
        if (!::editTierSwMin.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val sw = OverlayService.activeTierSwMin
        val w = OverlayService.activeTierWMin
        val l = OverlayService.activeTierLMax
        val sl = OverlayService.activeTierSlMax
        editTierSwMin.setText(sw.toString())
        editTierWMin.setText(w.toString())
        editTierLMax.setText(l.toString())
        editTierSlMax.setText(sl.toString())
        updateTierSummaryLabel(sw, w, l, sl)
    }

    private fun updateTierSummaryLabel(sw: Int, w: Int, l: Int, sl: Int) {
        if (!::textTierDefinitionsSummary.isInitialized) return
        textTierDefinitionsSummary.text =
            "• SW = Strong Win (rating >= $sw) (Default: 620)\n" +
            "• W = Win ($w <= rating < $sw) (Default: 530)\n" +
            "• N = Neutral / Grey ($l < rating < $w) (Default: 470–530)\n" +
            "• L = Loss ($sl < rating <= $l) (Default: 470)\n" +
            "• SL = Strong Loss (rating <= $sl) (Default: 380)"
    }

    private fun saveTierThresholdsFromInputs(showToast: Boolean) {
        val rawSw = editTierSwMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_SW_MIN
        val rawW = editTierWMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_W_MIN
        val rawL = editTierLMax.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_L_MAX
        val rawSl = editTierSlMax.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_SL_MAX

        val sl = rawSl.coerceIn(100, 800)
        val l = rawL.coerceIn(sl + 1, 850)
        val w = rawW.coerceIn(l + 1, 900)
        val sw = rawSw.coerceIn(w + 1, 950)

        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_TIER_SW_MIN, sw)
            .putInt(OverlayService.PREFS_KEY_TIER_W_MIN, w)
            .putInt(OverlayService.PREFS_KEY_TIER_L_MAX, l)
            .putInt(OverlayService.PREFS_KEY_TIER_SL_MAX, sl)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderTierThresholdsUi()

        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        if (showToast) {
            Toast.makeText(
                this,
                "Saved 5-Tier Matchup Thresholds: SW>=$sw, W>=$w, N($l..$w), L<=$l, SL<=$sl",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun restoreDefaultTierThresholds() {
        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_TIER_SW_MIN, OverlayService.DEFAULT_TIER_SW_MIN)
            .putInt(OverlayService.PREFS_KEY_TIER_W_MIN, OverlayService.DEFAULT_TIER_W_MIN)
            .putInt(OverlayService.PREFS_KEY_TIER_L_MAX, OverlayService.DEFAULT_TIER_L_MAX)
            .putInt(OverlayService.PREFS_KEY_TIER_SL_MAX, OverlayService.DEFAULT_TIER_SL_MAX)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderTierThresholdsUi()
        refreshPresetsUi()
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        Toast.makeText(
            this,
            "Restored default 5-Tier Thresholds (620 / 530 / 470 / 380)",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun loadAndRenderMachineBrThresholdsUi() {
        if (!::editMachEliteMin.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val elite = OverlayService.activeMachEliteMin
        val solid = OverlayService.activeMachSolidMin
        val playable = OverlayService.activeMachPlayableMin
        val risky = OverlayService.activeMachRiskyMin
        editMachEliteMin.setText(elite.toString())
        editMachSolidMin.setText(solid.toString())
        editMachPlayableMin.setText(playable.toString())
        editMachRiskyMin.setText(risky.toString())
        if (::textMachineBrDefinitionsSummary.isInitialized) {
            textMachineBrDefinitionsSummary.text =
                "• Elite Coverage >= $elite (Default: 650)\n" +
                "• Solid Coverage >= $solid (Default: 610)\n" +
                "• Playable Core >= $playable (Default: 580)\n" +
                "• Risky Core >= $risky (Default: 540)\n" +
                "• Blindspot Warning < $risky"
        }
    }

    private fun saveMachineBrThresholdsFromInputs(showToast: Boolean) {
        val rawElite = editMachEliteMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_MACH_ELITE_MIN
        val rawSolid = editMachSolidMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_MACH_SOLID_MIN
        val rawPlayable = editMachPlayableMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_MACH_PLAYABLE_MIN
        val rawRisky = editMachRiskyMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_MACH_RISKY_MIN

        val risky = rawRisky.coerceIn(350, 750)
        val playable = rawPlayable.coerceIn(risky + 5, 780)
        val solid = rawSolid.coerceIn(playable + 5, 810)
        val elite = rawElite.coerceIn(solid + 5, 845)

        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_MACH_ELITE_MIN, elite)
            .putInt(OverlayService.PREFS_KEY_MACH_SOLID_MIN, solid)
            .putInt(OverlayService.PREFS_KEY_MACH_PLAYABLE_MIN, playable)
            .putInt(OverlayService.PREFS_KEY_MACH_RISKY_MIN, risky)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderMachineBrThresholdsUi()
        refreshPresetsUi()
        if (showToast) {
            Toast.makeText(
                this,
                "Saved Core Coverage BR Scale: Elite>=$elite, Solid>=$solid, Playable>=$playable, Risky>=$risky",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun restoreDefaultMachineBrThresholds() {
        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_MACH_ELITE_MIN, OverlayService.DEFAULT_MACH_ELITE_MIN)
            .putInt(OverlayService.PREFS_KEY_MACH_SOLID_MIN, OverlayService.DEFAULT_MACH_SOLID_MIN)
            .putInt(OverlayService.PREFS_KEY_MACH_PLAYABLE_MIN, OverlayService.DEFAULT_MACH_PLAYABLE_MIN)
            .putInt(OverlayService.PREFS_KEY_MACH_RISKY_MIN, OverlayService.DEFAULT_MACH_RISKY_MIN)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderMachineBrThresholdsUi()
        refreshPresetsUi()
        Toast.makeText(
            this,
            "Restored default Core Coverage BR Thresholds (650 / 610 / 580 / 540)",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun getMatchupTierCodeAndHex(rating: Int): Pair<String, String> {
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        return when {
            rating >= OverlayService.activeTierSwMin -> "SW" to "#34d399"
            rating >= OverlayService.activeTierWMin -> "W" to "#4ade80"
            rating <= OverlayService.activeTierSlMax -> "SL" to "#f43f5e"
            rating <= OverlayService.activeTierLMax -> "L" to "#fb923c"
            else -> "N" to "#cbd5e1"
        }
    }

    private fun getMachineBrTierLabelAndHex(rating: Int): Pair<String, String> {
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        return when {
            rating >= OverlayService.activeMachEliteMin -> "Elite" to "#34d399"
            rating >= OverlayService.activeMachSolidMin -> "Solid" to "#4ade80"
            rating >= OverlayService.activeMachPlayableMin -> "Playable" to "#facc15"
            rating >= OverlayService.activeMachRiskyMin -> "Risky" to "#fb923c"
            else -> "Blindspot" to "#f43f5e"
        }
    }

    private fun getCurrentSeasonLogsForLeague(
        league: String,
        preloadedLogs: List<BattleLogEntry>? = null
    ): List<Pair<Long, List<String>>> {
        val (currSeason, _) = getCurrentAndPreviousSeason()
        val allLogs = preloadedLogs ?: loadBattleLogs()
        return allLogs.filter { entry ->
            entry.timestampMs in currSeason.startMs..currSeason.endMs &&
                entry.league.equals(league, ignoreCase = true)
        }.map { it.timestampMs to it.opponents }
    }

    private fun evaluatePresetMetrics(
        preset: TeamPreset,
        autoReorder: Boolean,
        preloadedLogs: List<BattleLogEntry>? = null
    ): TeamPreset {
        val seasonLogs = getCurrentSeasonLogsForLeague(preset.league, preloadedLogs)
        val serviceMembers = preset.pokemon.map {
            OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
        }
        val manualOverride = if (preset.isArchetypeManual && !autoReorder) preset.archetype else null
        val eval = OverlayService.evaluateOrAutoOrderTeamStatic(
            slots = serviceMembers,
            league = preset.league,
            seasonLogs = seasonLogs,
            autoReorder = autoReorder,
            manualArchetypeOverride = manualOverride
        )
        val orderedPokemon = eval.orderedSlots.map {
            PokemonSlot(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
        }
        return preset.copy(
            pokemon = orderedPokemon,
            archetype = eval.archetype,
            isArchetypeManual = if (autoReorder) false else preset.isArchetypeManual,
            leadAggBr = eval.leadAggBr,
            machineAggBr = eval.machineAggBr,
            safeSwapBr = eval.safeSwapBr,
            closerSwapBr = eval.closerSwapBr,
            closerBr = eval.closerBr,
            sharedWeaknesses = eval.sharedWeaknesses,
            topMetaTargetsTotal = eval.topMetaTargetsTotal,
            topMetaWinsCount = eval.topMetaWinsCount,
            keyMetaTargetsBeaten = eval.keyMetaTargetsBeaten,
            keyThreats = eval.keyThreats,
            coreBreakers = eval.coreBreakers,
            altMovesetSlots = eval.altMovesetSlots,
            synergySummary = eval.synergySummary
        )
    }

    private val isRecalculatingPresets = java.util.concurrent.atomic.AtomicBoolean(false)

    private fun recalculateAllPresetsWithSeasonMetaBlocking(preloadedLogs: List<BattleLogEntry>? = null): Boolean {
        val existing = loadPresets()
        if (existing.isEmpty()) return false
        val logs = preloadedLogs ?: loadBattleLogs()
        val updated = existing.map { evaluatePresetMetrics(it, autoReorder = false, preloadedLogs = logs) }
        if (updated != existing) {
            savePresets(updated)
            return true
        }
        return false
    }

    private fun recalculateAllPresetsWithSeasonMetaAsync() {
        if (!isRecalculatingPresets.compareAndSet(false, true)) return
        lifecycleScope.launch(Dispatchers.Default) {
            try {
                val changed = recalculateAllPresetsWithSeasonMetaBlocking()
                if (changed) {
                    withContext(Dispatchers.Main) {
                        if (::presetsContainer.isInitialized) {
                            refreshPresetsUi()
                        }
                    }
                }
            } finally {
                isRecalculatingPresets.set(false)
            }
        }
    }

    private fun showHelpAndMetricGuideDialog(initialTopic: String = "wae") {
        val density = resources.displayMetrics.density
        val pad = (14 * density).toInt()
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(0xFF0F172A.toInt())
        }
        scroll.addView(root)

        fun addSectionCard(
            title: String,
            accentColor: Int,
            bodyText: String,
            isHighlighted: Boolean
        ): LinearLayout {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(if (isHighlighted) 0xFF1E293B.toInt() else 0xFF131C31.toInt())
                val cPad = (11 * density).toInt()
                setPadding(cPad, cPad, cPad, cPad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (10 * density).toInt()
                }
            }
            val titleTv = TextView(this).apply {
                text = title
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(accentColor)
            }
            val bodyTv = TextView(this).apply {
                text = bodyText
                textSize = 11.5f
                setTextColor(0xFFE2E8F0.toInt())
                setLineSpacing(4f, 1.05f)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (5 * density).toInt()
                }
            }
            card.addView(titleTv)
            card.addView(bodyTv)
            root.addView(card)
            return card
        }

        val waeCard = addSectionCard(
            title = "1. Execution WAE (Wins Above Expected)",
            accentColor = 0xFF4ADE80.toInt(),
            bodyText =
                "Isolates your micro-execution skill (energy farming, fast move denial / sneak prevention, sacrificial catch management, CMP timing, and shield discipline) from blind matchmaking RNG.\n\n" +
                "• Timeline Duration Weighting: Partitions the match into head-to-head intervals k bounded by swap and faint timestamps. Each interval is evaluated in the 9-state Asymmetric Shield Matrix (0v0 through 2v2) using live shields remaining (R_k = Rating_{s_user v s_opp}) and weighted by fractional duration τ_k = Δt_k / t_total:\n" +
                "  S_actual = Σ (τ_k · R_k)\n" +
                "  P_exec = 1 / (1 + e^(-0.006 · (S_actual - 500)))\n\n" +
                "• Execution Residual (ΔQ): Compares actual outcome (Win = 1.0, Loss = 0.0) against P_exec:\n" +
                "  ΔQ_base = Result - P_exec\n" +
                "• Faint Margin Scaling: Wins with a ≥ 2 Pokémon faint margin scale ΔQ × 1.10.\n" +
                "• Shield-in-Pocket Penalty: Losses with unused shields apply -0.15 × userShieldsRemaining.\n" +
                "• Aggregate EXEC WAE: Confidence-weighted average of ΔQ_final across filtered battles (+XX.X% means outperforming expected matchups).",
            isHighlighted = initialTopic == "wae"
        )

        val luckCard = addSectionCard(
            title = "2. Matchup Luck (Blind Matchup Favorability — BMF)",
            accentColor = 0xFF38BDF8.toInt(),
            bodyText =
                "Tracks whether matchmaking is handing you favorable team alignments (>50%) or hard-counter RPS lineups (<50%) before micro-execution occurs.\n\n" +
                "• Lead Score (S_lead): Equal 50/50 blend of 1v1 and 2v2 lead ratings:\n" +
                "  S_lead = 0.50 · R_1v1 + 0.50 · R_2v2\n" +
                "• Backline Score (S_back): Evaluates both backline pairings (Score_A & Score_B) and weights optimal switch alignment 70/30:\n" +
                "  S_back = 0.70 · max(Score_A, Score_B) + 0.30 · min(Score_A, Score_B)\n" +
                "• Composite Score (M) & Pre-Match Win Prob (P_pre / BMF):\n" +
                "  M = 0.40 · S_lead + 0.60 · S_back\n" +
                "  BMF (P_pre) = 1 / (1 + e^(-0.006 · (M - 500)))\n\n" +
                "• Unrevealed Pokémon Handling:\n" +
                "  - < 2 Opponents Seen (Early Forfeit): Weight w = 0.00 (excluded from ranked WAE/Luck).\n" +
                "  - 2 Opponents Seen (Unrevealed 3rd Closer): Weight w = 0.75 using the active league's Meta-Average 1v1 Prior (⚡ 75% Conf).\n" +
                "  - All 3 Opponents Seen: Full 3v3 evaluation at weight w = 1.00.",
            isHighlighted = initialTopic == "luck"
        )

        addSectionCard(
            title = "3. Badge Glossary (6 Primary Badges & Event Pills)",
            accentColor = 0xFFFBBF24.toInt(),
            bodyText =
                "Primary Performance Badges (classified from Pre-Match BMF P_pre & Match Outcome):\n" +
                "• Clutch Win (Cyan #22D3EE) — WIN with P_pre < 40%: Overcame a heavily unfavorable team alignment via superior catches, energy lead, or shield baiting.\n" +
                "• Skill Win (Green #4ADE80) — WIN with 40% ≤ P_pre ≤ 60%: Out-executed the opponent in an even/neutral 3v3 matchup.\n" +
                "• Expected Win (Slate #94A3B8) — WIN with P_pre > 60%: Cleanly converted a favorable team advantage into a victory.\n" +
                "• Blunder Loss (Rose #F43F5E) — LOSS with P_pre > 60%: Dropped a favorable matchup where your lineup held >60% win equity.\n" +
                "• Tough Loss (Orange #FB923C) — LOSS with 40% ≤ P_pre ≤ 60%: Narrow defeat in a competitive 50/50 matchup.\n" +
                "• Expected Loss (Slate #94A3B8) — LOSS with P_pre < 40%: Hard-countered team alignment (<40% win equity); minimal penalty to WAE.\n\n" +
                "Contextual Event Flags (Pills):\n" +
                "• ⚠️ Double Shield Pocket: Loss finished with 2 unused shields remaining (-0.30 ΔQ penalty).\n" +
                "• ⚠️ Shield in Pocket: Loss finished with 1 unused shield remaining (-0.15 ΔQ penalty).\n" +
                "• 🧹 Clean Sweep: Win achieved with 0 user faints (all 3 Pokémon surviving).\n" +
                "• 🛡️ Shield Advantage: Win achieved while ending with more shields remaining than the opponent.\n" +
                "• ⚡ 75% Conf: Opponent's 3rd Pokémon was never revealed; evaluated at 0.75 confidence weight using the league meta-average prior.",
            isHighlighted = initialTopic == "badges"
        )

        addSectionCard(
            title = "4. Team Archetype (ABB vs ABC) & Blended Aggregate BR (v3.10)",
            accentColor = 0xFFC084FC.toInt(),
            bodyText =
                "Evaluates your 3-Pokémon presets against a recency-weighted blend of your current-season battle logs (scaling 0% → 70% over 50 matches with exp(-0.05·(k-1)) decay) and the PvPoke top-ranked meta prior (exp(-0.05·(r-1))):\n" +
                "• ABB vs ABC Auto-Detection: Audits 18-type defensive vulnerabilities across all 3 pairs. If a backline pair shares ≥ 2 weaknesses (or a critical meta weakness) covered by the third Pokémon A, the team is classified as ABB (moving A to Slot 1 Lead, Bait B1 to Slot 2, Sweeper B2 to Slot 3). Otherwise it is ABC (keeping Lead fixed and promoting the higher Swap BR bench Pokémon to Slot 2).\n" +
                "• Position-Weighted Shield Scenarios:\n" +
                "  - Lead BR (Slot 1): 45% 1v1 + 35% 2v2 + 10% 0v0 + 5% 1v2 + 5% 2v1 against blended Opponent Leads.\n" +
                "  - Swap BR (Slots 2 & 3): Volatility-adjusted μ_Swap - 0.5·σ_Swap using 40% 1v1 + 20% 1v0 + 20% 0v1 + 10% 2v1 + 10% 0v0 against all seen Opponent Pokémon.\n" +
                "  - Machine Agg BR: Team ceiling Σ P_field(p) · max(Lead, Swap, Closer) across the field, color-coded by your Machine BR Thresholds in Settings.",
            isHighlighted = initialTopic == "team_br"
        )

        val dialog = AlertDialog.Builder(this)
            .setTitle("📖 Help & Metric Guide (v3.10)")
            .setView(scroll)
            .setNeutralButton("Open Full Help Tab") { _, _ ->
                switchMainPage("help")
            }
            .setPositiveButton("Got It", null)
            .create()
        dialog.show()

        if (initialTopic == "luck") {
            scroll.post { scroll.smoothScrollTo(0, luckCard.top) }
        } else if (initialTopic == "wae") {
            scroll.post { scroll.smoothScrollTo(0, waeCard.top) }
        }
    }

    private fun showOverlayUsageGuideDialog() {
        val density = resources.displayMetrics.density
        val pad = (14 * density).toInt()
        val scroll = ScrollView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            setBackgroundColor(0xFF0F172A.toInt())
        }
        scroll.addView(root)

        fun addGuideSection(
            title: String,
            accentColor: Int,
            bodyText: String
        ) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val cPad = (11 * density).toInt()
                setPadding(cPad, cPad, cPad, cPad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (10 * density).toInt()
                }
            }
            val titleTv = TextView(this).apply {
                text = title
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(accentColor)
            }
            val bodyTv = TextView(this).apply {
                text = bodyText
                textSize = 11.5f
                setTextColor(0xFFE2E8F0.toInt())
                setLineSpacing(4f, 1.05f)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (5 * density).toInt()
                }
            }
            card.addView(titleTv)
            card.addView(bodyTv)
            root.addView(card)
        }

        addGuideSection(
            title = "1. General Battle Flow & Interacting with the Overlay",
            accentColor = 0xFF38BDF8.toInt(),
            bodyText =
                "• Select or Switch Teams (Main App): Choose your active team preset in the main app's '⚔️ Teams' page before or between sets. To switch teams, return to the main app and select another preset (it pushes immediately to the running overlay).\n" +
                "• Launch & Reposition: Tap 'Start Battle Overlay' to open the floating HUD. Drag the header bar to reposition it anywhere on screen.\n" +
                "• Minimize & Pause OCR ('⚔️' Icon): Tap the '⚔️' icon in the top-left of the overlay between sets or while catching Pokémon to collapse the HUD into a tiny floating bubble and pause screen scanning.\n" +
                "• Manual Opponent Override ('Opponents (Tap to Edit)'): Tap the 'Opponents (Tap to Edit)' header bar inside the overlay if OCR misreads a name or form to manually override any of the 3 opponent slots (with Shadow & Regional/Form support).\n" +
                "• Start Battle ('⚔️ Start Battle'): Tap when a GBL match begins. This clears the previous opponent lineup, resets both 50s swap timers, resets shields (2v2) and Pokéballs (3v3), anchors the timeline clock (t=0s), and turns into '🛑 Stop Battle'.\n" +
                "• Stop & Log ('🛑 Stop Battle'): Tap when the match finishes. Verify or tap the Lead Matchup chip ('Fav / Neu / Neg') and tap '🏆 Win' or '💀 Loss' (or '✕ Skip')."
        )

        addGuideSection(
            title = "2. The 3x3 Matchup & Shield Matrix (Ratings, Dots & 0S/1S/2S Tags)",
            accentColor = 0xFFFBBF24.toInt(),
            bodyText =
                "• 3x3 Grid Structure: Columns = Opponent's 3 Pokémon in the exact order revealed ([1st Lead, 2nd First Swap, 3rd Closer]). Rows = Your 3 Pokémon.\n" +
                "• Single-Number PvPoke Rating & Colored Dot: Each cell displays the exact PvPoke 500-centered rating for the current shield state:\n" +
                "  - [+] Bright Emerald (SW ≥ 620): Strong Win / hard counter.\n" +
                "  - [●] Green (W 530–619): Favorable Win.\n" +
                "  - [●] Slate Grey (N 471–529): Neutral 50/50 matchup.\n" +
                "  - [●] Red (L 381–470): Unfavorable Loss.\n" +
                "  - [×] Dark Crimson (SL ≤ 380): Strong Loss — swap or catch immediately.\n" +
                "• 0S / 1S / 2S Shield Scenario Tags: Below the rating, cells show compact tags (e.g. '1S 2S✓' or '0S✗ 1S✓') when spending or saving shields flips the matchup outcome.\n" +
                "• Dynamic 9-State Asymmetric Matrix (0v0–2v2): Automatically updates ratings across all 9 shield combinations as shields are spent."
        )

        addGuideSection(
            title = "3. How to Use Battle Damage Numbers (Bottom 3-Column Damage Grid)",
            accentColor = 0xFF4ADE80.toInt(),
            bodyText =
                "• Bottom Opponent Attacks Section: Displays a 3-column grid aligned with Opponent 1, Opponent 2, and Opponent 3 against your currently active Pokémon.\n" +
                "• Live Charged Move Damage % & KO! Badge: Every opponent charged move shows its move-type color dot, energy cost, fast move count, and exact HP damage percentage (e.g. '42%' or '88% KO!') accounting for League CP stat scaling, dual-type effectiveness, STAB (1.2x), and Shadow (+20% ATK / -16.7% DEF).\n" +
                "• Tank vs. Shield Decisions: Check the damage % before committing a shield — if a move deals 38% you can safely tank it, whereas '85% KO!' warns you to shield.\n" +
                "• Multi-Cycle Fast Move Counts (C1-C2-C3) & Sneak Prevention: Shows exact fast moves required across 3 consecutive cycles (accounting for residual energy) plus optimal throw timing ('Throw on: 1, 4, 7' or 'Aligned (Any)') to deny free opponent fast move sneaks."
        )

        addGuideSection(
            title = "4. Dual 50s Swap Timers, Faint Preservation & Statusbar Toasts",
            accentColor = 0xFFC084FC.toInt(),
            bodyText =
                "• Independent 50s Swap Clocks ('You' & 'Opp'): Tracks both your switch timer and the opponent's switch timer automatically:\n" +
                "  - Red (50s–16s): Switch locked on cooldown.\n" +
                "  - Orange/Amber (15s–1s): Switch window opening soon — prepare to throw energy or time a catch.\n" +
                "  - Green (RDY): Switch available immediately.\n" +
                "• Smart Faint Swap-In Preservation: Detects Pokéball drops (3→2→1) when a Pokémon faints so a replacement entering after a KO preserves the running swap timer instead of falsely resetting to 50s.\n" +
                "• Shield (2→1→0) & Faint Column Dimming: Tracks remaining shields and automatically dims fainted opponent columns in the 3x3 matrix.\n" +
                "• Top Statusbar / Clock Strip Toasts: Displays non-intrusive alerts for Swaps, Faint Swaps, and Shields Used at the top statusbar so your charged move buttons are never blocked."
        )

        AlertDialog.Builder(this)
            .setTitle("🎯 Overlay HUD & Battle Flow Guide")
            .setView(scroll)
            .setNeutralButton("📖 Open Help Page") { _, _ ->
                switchMainPage("help")
            }
            .setPositiveButton("Got It", null)
            .show()
    }

    private fun showExportFormatAndTimeframeDialog(isShareIntent: Boolean) {
        showExportTimeframeDialog(isShareIntent)
    }

    private fun showExportTimeframeDialog(isShareIntent: Boolean) {
        val allLogs = loadBattleLogs()
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        val options = arrayOf(
            "Today (Day) — Summary",
            "Yesterday — Summary",
            "This Week (Last 7 Days) — Summary",
            "Current Season (${currSeason.name} • Since ${dateFmt.format(java.util.Date(currSeason.startMs))}) — Summary",
            "Previous Season (${dateFmt.format(java.util.Date(prevSeason.startMs))} – ${dateFmt.format(java.util.Date(prevSeason.endMs))}) — Summary",
            "All Time — Summary",
            "🤖 AI Training Detailed Log (JSONL Dataset • Today)",
            "🤖 AI Training Detailed Log (JSONL Dataset • All Time)"
        )
        val keys = arrayOf("DAY", "YESTERDAY", "WEEK", "CURRENT_SEASON", "PREVIOUS_SEASON", "ALL_TIME", "AI_TRAIN_DAY", "AI_TRAIN_ALL")

        AlertDialog.Builder(this)
            .setTitle(if (isShareIntent) "📤 Share Battle Log / AI Training Data" else "📋 Copy Battle Log / AI Training Data")
            .setItems(options) { _, which ->
                val chosenKey = keys.getOrElse(which) { "ALL_TIME" }
                val isAiDataset = chosenKey.startsWith("AI_TRAIN_")
                val timeKey = if (chosenKey == "AI_TRAIN_DAY") "DAY" else if (chosenKey == "AI_TRAIN_ALL") "ALL_TIME" else chosenKey
                val exportText = if (isAiDataset) {
                    buildAiTrainingDatasetExport(
                        allLogs,
                        selectedLogLeagueFilter,
                        selectedLogTeamFilter,
                        timeKey
                    )
                } else {
                    buildPlainTextExport(
                        allLogs,
                        selectedLogLeagueFilter,
                        selectedLogTeamFilter,
                        timeKey
                    )
                }
                if (isShareIntent) {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, if (isAiDataset) "SilphScope PvP AI Training Dataset (JSONL)" else "SilphScope PvP Battle Log")
                        putExtra(Intent.EXTRA_TEXT, exportText)
                    }
                    startActivity(Intent.createChooser(sendIntent, if (isAiDataset) "Share SilphScope AI Training Log" else "Share SilphScope PvP Battle Log"))
                } else {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope PvP Export", exportText))
                    Toast.makeText(this, "Copied ${options[which]} to clipboard!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun buildAiTrainingDatasetExport(
        allLogs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeFilter: String
    ): String {
        val aiLogById = loadAiTrainingLogs().associateBy { it.battleId }
        val filtered = filterBattleLogs(allLogs, leagueFilter, teamFilter, timeframeFilter)
        val gson = com.google.gson.Gson()
        return filtered.joinToString("\n") { log ->
            val aiRecord = aiLogById[log.id]
            val events = aiRecord?.timelineEvents?.takeIf { it.isNotEmpty() } ?: log.timelineEvents
            val recEvents = events.filter { !it.recommendedAction.isNullOrBlank() }
            val followed = recEvents.count { it.followedRecommendation == true }
            val adherencePct = log.adherenceRatePct ?: aiRecord?.adherenceRatePct ?: if (recEvents.isNotEmpty()) ((followed * 100.0) / recEvents.size).toInt() else null
            val record = mapOf(
                "schemaVersion" to "3.50",
                "battleId" to log.id,
                "timestampMs" to log.timestampMs,
                "league" to log.league,
                "userTeamName" to log.userTeamName,
                "userPokemon" to log.userPokemon,
                "opponents" to log.opponents,
                "leadMatchup" to log.leadMatchup,
                "result" to log.result,
                "battleDurationSec" to (log.battleDurationSec ?: aiRecord?.battleDurationSec),
                "userFaints" to log.userFaints,
                "oppFaints" to log.oppFaints,
                "userShieldsRemaining" to log.userShieldsRemaining,
                "oppShieldsRemaining" to log.oppShieldsRemaining,
                "finalUserHpPct" to log.finalUserHpPct,
                "finalOppHpPct" to log.finalOppHpPct,
                "firstSwapActor" to log.firstSwapActor,
                "switchAdvantage" to log.switchAdvantage,
                "adherenceRatePct" to adherencePct,
                "recommendationsIssuedCount" to (log.recommendationsIssuedCount ?: aiRecord?.recommendationsIssuedCount ?: recEvents.size),
                "recommendationsFollowedCount" to (log.recommendationsFollowedCount ?: aiRecord?.recommendationsFollowedCount ?: followed),
                "aiLogRetentionStatus" to if (aiRecord != null) "ACTIVE_7D" else "PURGED_OVER_7D",
                "timelineEvents" to events
            )
            gson.toJson(record)
        }
    }

    private fun renderBattleLogPage() {
        updateTrashButtonsUi()
        val allLogs = loadBattleLogs()
        val filtered = filterBattleLogs(
            allLogs,
            selectedLogLeagueFilter,
            selectedLogTeamFilter,
            selectedLogTimeframeFilter
        )
        val wins = filtered.count { it.result.equals("WIN", ignoreCase = true) }
        val losses = filtered.count { it.result.equals("LOSS", ignoreCase = true) }
        val total = wins + losses
        val winPct = if (total > 0) Math.round((wins.toDouble() / total.toDouble()) * 100.0).toInt() else 0
        val favCount = filtered.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
        val neuCount = filtered.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
        val negCount = filtered.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
        val uniqueLeadCount = countUniqueLeads(filtered)

        val presets = loadPresets()
        val aggWae = OverlayService.calculateAggregateWAEStatic(filtered.map { resolveEntryQuality(it, presets) })

        textBattleLogTotal.text = "${wins}W-${losses}L ($total)"
        textBattleLogLeague.text = "${favCount}+/${neuCount}o/${negCount}-/${uniqueLeadCount}u"
        textBattleLogWinrate.text = if (total == 0) "—%" else "$winPct%"
        textBattleLogWae.text = aggWae.formatted
        textBattleLogWae.setTextColor(
            when {
                aggWae.rankedCount == 0 -> 0xFF94A3B8.toInt()
                aggWae.waePct >= 0.0 -> 0xFF4ADE80.toInt()
                else -> 0xFFF43F5E.toInt()
            }
        )
        if (::textBattleLogLuck.isInitialized) {
            textBattleLogLuck.text = aggWae.luckFormatted
            textBattleLogLuck.setTextColor(
                when {
                    aggWae.rankedCount == 0 -> 0xFF94A3B8.toInt()
                    aggWae.luckPct > 50.0 -> 0xFF38BDF8.toInt()
                    aggWae.luckPct < 50.0 -> 0xFFFB923C.toInt()
                    else -> 0xFF94A3B8.toInt()
                }
            )
        }

        battleLogContainer.removeAllViews()
        val density = resources.displayMetrics.density
        if (filtered.isEmpty()) {
            val selectedPreset = getSelectedPreset()
            val (currSeason, _) = getCurrentAndPreviousSeason()
            val emptyCard = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (14 * density).toInt()
                setPadding(pad, pad, pad, pad)
            }
            val titleTv = TextView(this).apply {
                text = "📜 No Battles Logged in Selected Filter"
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 14f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val descTv = TextView(this).apply {
                text = "• Tap 'Start Battle' on the floating overlay during battle to log 🏆 Win or 💀 Loss with automatic Lead Matchup (${selectedPreset?.name ?: "Active Team"}).\n" +
                    "• Active Season (ScrapedDuck API): ${currSeason.name}\n" +
                    "• Tap any logged battle card to open the Interactive Overlay Matchup Replay!"
                setTextColor(0xFF94A3B8.toInt())
                textSize = 12f
                setPadding(0, (6 * density).toInt(), 0, 0)
            }
            emptyCard.addView(titleTv)
            emptyCard.addView(descTv)
            battleLogContainer.addView(emptyCard)
            applyCurrentAppThemeToSubtree(battleLogContainer)
            return
        }

        val dayFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        val timeFmt = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US)
        val groupedByDay = filtered.groupBy { dayFmt.format(java.util.Date(it.timestampMs)) }

        val activeTheme = getActiveAppTheme()
        val hasWatermark = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true) && activeTheme.emblemDrawableRes != null
        val aiLogsById = loadAiTrainingLogs().associateBy { it.battleId }
        val nowRenderMs = System.currentTimeMillis()

        // v3.50 AI Training Log 7-Day Split & Cleanup Banner + One-Tap Cleanup Action
        val aiBannerRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            val pH = (8 * density).toInt()
            val pV = (6 * density).toInt()
            setPadding(pH, pV, pH, pV)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = (6 * density).toInt()
            }
        }
        val aiBannerTv = TextView(this).apply {
            text = "🤖 7d AI Training Store: ${aiLogsById.size} active (<7d full replay) • Main Logs: ${allLogs.size} permanent"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 10f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val aiSplitBtn = TextView(this).apply {
            text = "⚡ Split & Purge >7d"
            setTextColor(0xFF38BDF8.toInt())
            textSize = 10f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            val pH = (7 * density).toInt()
            val pV = (3 * density).toInt()
            setPadding(pH, pV, pH, pV)
            setBackgroundColor(0xFF1E293B.toInt())
            setOnClickListener {
                runOneTimeAiLogSplitAndCleanup(silent = false)
            }
        }
        aiBannerRow.addView(aiBannerTv)
        aiBannerRow.addView(aiSplitBtn)
        battleLogContainer.addView(aiBannerRow)

        for ((dayStr, dayEntries) in groupedByDay) {
            val dWins = dayEntries.count { it.result.equals("WIN", ignoreCase = true) }
            val dLosses = dayEntries.count { it.result.equals("LOSS", ignoreCase = true) }
            val dTotal = dWins + dLosses
            val dPct = if (dTotal > 0) Math.round((dWins.toDouble() / dTotal.toDouble()) * 100.0).toInt() else 0
            val dFav = dayEntries.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
            val dNeu = dayEntries.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
            val dNeg = dayEntries.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
            val dUnique = countUniqueLeads(dayEntries)
            val dayWae = OverlayService.calculateAggregateWAEStatic(dayEntries.map { resolveEntryQuality(it, presets) })

            // Compute same-day repeated lead occurrences in chronological order (oldest -> newest within the day)
            val dayLeadCounts = HashMap<String, Int>()
            val entryLeadOccurrenceIndex = HashMap<String, Int>()
            val entryLeadPreviousResult = HashMap<String, String>()
            val lastSeenResultByLead = HashMap<String, String>()
            for (cEntry in dayEntries.sortedBy { it.timestampMs }) {
                val lKey = normalizeDailyLeadKey(cEntry.opponents.firstOrNull())
                if (lKey.isNotEmpty()) {
                    val nextOcc = (dayLeadCounts[lKey] ?: 0) + 1
                    dayLeadCounts[lKey] = nextOcc
                    entryLeadOccurrenceIndex[cEntry.id] = nextOcc
                    lastSeenResultByLead[lKey]?.let { prevRes ->
                        entryLeadPreviousResult[cEntry.id] = prevRes
                    }
                    lastSeenResultByLead[lKey] = if (cEntry.result.equals("WIN", ignoreCase = true)) "W" else "L"
                }
            }

            val dayHeader = TextView(this).apply {
                text = "📅 $dayStr — Daily Record:${dWins}W-${dLosses}L($dPct%) • Leads:$dFav Fav/$dNeu Neu/$dNeg Neg/$dUnique Unique • WAE:${dayWae.formatted} • Luck:${dayWae.luckFormatted}"
                setTextColor(0xFF38BDF8.toInt())
                textSize = 11f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                val padV = (6 * density).toInt()
                setPadding((4 * density).toInt(), padV, (4 * density).toInt(), padV)
            }
            battleLogContainer.addView(dayHeader)

            for (entry in dayEntries) {
                val isWin = entry.result.equals("WIN", ignoreCase = true)
                val leadUp = entry.leadMatchup.uppercase()
                val leadBadgeText = when (leadUp) {
                    "FAVORABLE" -> "Lead: Favorable"
                    "NEGATIVE" -> "Lead: Negative"
                    else -> "Lead: Neutral"
                }
                val leadColor = when (leadUp) {
                    "FAVORABLE" -> 0xFF4ADE80.toInt()
                    "NEGATIVE" -> 0xFFF87171.toInt()
                    else -> 0xFFCBD5E1.toInt()
                }

                val entryLeadKey = normalizeDailyLeadKey(entry.opponents.firstOrNull())
                val repeatLeadTotal = if (entryLeadKey.isNotEmpty()) (dayLeadCounts[entryLeadKey] ?: 0) else 0
                val isRepeatDailyLead = repeatLeadTotal >= 2
                val repeatOccIdx = entryLeadOccurrenceIndex[entry.id] ?: 1
                val prevLeadRes = entryLeadPreviousResult[entry.id]

                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    if (isRepeatDailyLead) {
                        val surfaceAlpha = if (hasWatermark) 0xBF else 0xF5
                        background = android.graphics.drawable.GradientDrawable().apply {
                            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                            cornerRadius = 8f * density
                            setColor(withAlpha(activeTheme.surfaceColor, surfaceAlpha))
                            setStroke((1.6f * density).toInt().coerceAtLeast(2), activeTheme.secondaryAccentColor)
                        }
                    } else {
                        setBackgroundColor(0xFF1E293B.toInt())
                    }
                    val pad = (11 * density).toInt()
                    setPadding(pad, pad, pad, pad)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (8 * density).toInt()
                    }
                    setOnClickListener {
                        showInteractiveBattleReplayDialog(entry)
                    }
                }

                val topRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                }

                val resultTv = TextView(this).apply {
                    text = if (isWin) "🏆 WIN" else "💀 LOSS"
                    setTextColor(if (isWin) 0xFF4ADE80.toInt() else 0xFFF87171.toInt())
                    textSize = 12f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                val leadTv = TextView(this).apply {
                    text = "  •  $leadBadgeText"
                    setTextColor(leadColor)
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                val metaTv = TextView(this).apply {
                    text = "${entry.league.replace(" LEAGUE", "")} • ${timeFmt.format(java.util.Date(entry.timestampMs))}"
                    setTextColor(0xFF94A3B8.toInt())
                    textSize = 10.5f
                    gravity = android.view.Gravity.END
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }

                topRow.addView(resultTv)
                topRow.addView(leadTv)
                topRow.addView(metaTv)

                val teamTv = TextView(this).apply {
                    text = "Team: ${entry.userTeamName}"
                    setTextColor(0xFFCBD5E1.toInt())
                    textSize = 11.5f
                    setPadding(0, (4 * density).toInt(), 0, (2 * density).toInt())
                }

                val oppTv = TextView(this).apply {
                    if (entry.opponents.isEmpty()) {
                        text = "Vs: No opponents recorded"
                        setTextColor(0xFFF8FAFC.toInt())
                    } else if (isRepeatDailyLead) {
                        val ssb = android.text.SpannableStringBuilder("Vs: ")
                        entry.opponents.forEachIndexed { idx, opp ->
                            if (idx > 0) ssb.append("  •  ")
                            val ord = when (idx) { 0 -> "1st"; 1 -> "2nd"; else -> "3rd" }
                            if (idx == 0) {
                                val start = ssb.length
                                ssb.append("$ord: $opp 🔁")
                                ssb.setSpan(
                                    android.text.style.ForegroundColorSpan(activeTheme.secondaryAccentColor),
                                    start,
                                    ssb.length,
                                    android.text.Spannable.SPAN_EXCLUSIVE_EXCLUSIVE
                                )
                            } else {
                                ssb.append("$ord: $opp")
                            }
                        }
                        text = ssb
                        setTextColor(activeTheme.primaryTextColor)
                        setTag(R.id.iv_theme_watermark_bg, 0x123456) // Preserve custom spannable highlight color
                    } else {
                        val oppOrderedText = entry.opponents.mapIndexed { idx, opp ->
                            val ord = when (idx) { 0 -> "1st"; 1 -> "2nd"; else -> "3rd" }
                            "$ord: $opp"
                        }.joinToString("  •  ")
                        text = "Vs: $oppOrderedText"
                        setTextColor(0xFFF8FAFC.toInt())
                    }
                    textSize = 12f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                // Phase 3: Primary Performance Badge (derived from P_pre) & Contextual Event Flags (Pills) Container
                val entryQuality = resolveEntryQuality(entry, presets)
                val qualityRow = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(0, (5 * density).toInt(), 0, (2 * density).toInt())
                }

                if (isRepeatDailyLead) {
                    val curResShort = if (isWin) "W" else "L"
                    val repeatDetail = when {
                        repeatOccIdx == 1 -> "🔁 Repeat Lead (#1 of $repeatLeadTotal Today)"
                        prevLeadRes == "L" && curResShort == "W" -> "🔁 Repeat Lead (#$repeatOccIdx of $repeatLeadTotal Today • Adapted L→W ✨)"
                        prevLeadRes == "W" && curResShort == "W" -> "🔁 Repeat Lead (#$repeatOccIdx of $repeatLeadTotal Today • Repeat W→W ✓)"
                        prevLeadRes == "W" && curResShort == "L" -> "🔁 Repeat Lead (#$repeatOccIdx of $repeatLeadTotal Today • Flipped W→L ⚠️)"
                        prevLeadRes != null -> "🔁 Repeat Lead (#$repeatOccIdx of $repeatLeadTotal Today • Repeat ${prevLeadRes}→$curResShort)"
                        else -> "🔁 Repeat Lead (#$repeatOccIdx of $repeatLeadTotal Today)"
                    }
                    val repeatBannerTv = TextView(this).apply {
                        text = repeatDetail
                        setTextColor(activeTheme.secondaryAccentColor)
                        setTag(R.id.iv_theme_watermark_bg, 0x123456)
                        background = android.graphics.drawable.GradientDrawable().apply {
                            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                            cornerRadius = 5f * density
                            setColor(withAlpha(activeTheme.secondaryAccentColor, 0x26))
                            setStroke((1f * density).toInt().coerceAtLeast(1), withAlpha(activeTheme.secondaryAccentColor, 0x80))
                        }
                        textSize = 10f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val pH = (7 * density).toInt()
                        val pV = (3 * density).toInt()
                        setPadding(pH, pV, pH, pV)
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            bottomMargin = (4 * density).toInt()
                        }
                    }
                    qualityRow.addView(repeatBannerTv)
                }

                if (entryQuality != null) {
                    val primaryBadgeRow = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = android.view.Gravity.CENTER_VERTICAL
                    }

                    val badgeTextColor = when (entryQuality.badgeLabel) {
                        "Clutch Win" -> 0xFF22D3EE.toInt()
                        "Skill Win" -> 0xFF4ADE80.toInt()
                        "Blunder Loss" -> 0xFFF43F5E.toInt()
                        "Tough Loss" -> 0xFFFB923C.toInt()
                        else -> 0xFF94A3B8.toInt()
                    }
                    val badgeBgColor = when (entryQuality.badgeLabel) {
                        "Clutch Win" -> 0x2622D3EE
                        "Skill Win" -> 0x264ADE80
                        "Blunder Loss" -> 0x26F43F5E
                        "Tough Loss" -> 0x26FB923C
                        else -> 0x2E64748B
                    }
                    val bmfPctInt = (entryQuality.pPre * 100.0).roundToInt()
                    val waePctVal = entryQuality.deltaQ * 100.0
                    val dqSign = if (waePctVal >= 0.0) "+" else "-"
                    val dqStr = String.format(java.util.Locale.US, "%s%.1f%%", dqSign, kotlin.math.abs(waePctVal))

                    val badgeTv = TextView(this).apply {
                        text = "${entryQuality.badgeLabel} • BMF: ${bmfPctInt}% • WAE: $dqStr"
                        setTextColor(badgeTextColor)
                        setBackgroundColor(badgeBgColor)
                        textSize = 10.5f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val pH = (7 * density).toInt()
                        val pV = (3 * density).toInt()
                        setPadding(pH, pV, pH, pV)
                    }
                    primaryBadgeRow.addView(badgeTv)
                    qualityRow.addView(primaryBadgeRow)

                    @Suppress("USELESS_ELVIS")
                    val flagsList = (entryQuality.contextualFlags ?: emptyList()).ifEmpty { entry.flags ?: emptyList() }
                    if (flagsList.isNotEmpty()) {
                        val flagsRow = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = android.view.Gravity.CENTER_VERTICAL
                            setPadding(0, (4 * density).toInt(), 0, 0)
                        }
                        for (flag in flagsList) {
                            val (flagTextColor, flagBgColor) = when {
                                flag.contains("Double Shield Pocket") -> 0xFFFDA4AF.toInt() to 0x26F43F5E
                                flag.contains("Shield in Pocket") -> 0xFFFCD34D.toInt() to 0x26F59E0B
                                flag.contains("Clean Sweep") -> 0xFF6EE7B7.toInt() to 0x2610B981
                                flag.contains("Shield Advantage") -> 0xFF7DD3FC.toInt() to 0x2638BDF8
                                else -> 0xFFFCD34D.toInt() to 0x26F59E0B
                            }
                            val pillTv = TextView(this).apply {
                                text = flag
                                setTextColor(flagTextColor)
                                setBackgroundColor(flagBgColor)
                                textSize = 9.5f
                                setTypeface(typeface, android.graphics.Typeface.BOLD)
                                val pH = (6 * density).toInt()
                                val pV = (2.5f * density).toInt()
                                setPadding(pH, pV, pH, pV)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.WRAP_CONTENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    marginEnd = (5 * density).toInt()
                                }
                            }
                            flagsRow.addView(pillTv)
                        }
                        qualityRow.addView(flagsRow)
                    }
                } else {
                    val unrankedTv = TextView(this).apply {
                        text = "Unranked Match (Missing Swap — Excluded from WAE)"
                        setTextColor(0xFF64748B.toInt())
                        setBackgroundColor(0x26334155)
                        textSize = 10f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val pH = (7 * density).toInt()
                        val pV = (3 * density).toInt()
                        setPadding(pH, pV, pH, pV)
                    }
                    qualityRow.addView(unrankedTv)
                }

                // v3.50 Permanent Main Log Summary Row: Final HP/Shields + First Swap Actor & Switch Advantage
                val uSh = entry.userShieldsRemaining ?: entry.quality?.userShieldsRemaining ?: 0
                val oSh = entry.oppShieldsRemaining ?: entry.quality?.oppShieldsRemaining ?: 0
                val uFinalHpStr = entry.finalUserHpPct?.takeIf { it.isNotEmpty() }?.joinToString("/") { "${it}%" }
                    ?: "${if (isWin) 45 else 0}%"
                val oFinalHpStr = entry.finalOppHpPct?.takeIf { it.isNotEmpty() }?.joinToString("/") { "${it}%" }
                    ?: "${if (isWin) 0 else 40}%"
                val swapActorCode = (entry.firstSwapActor ?: "NONE").uppercase()
                val swapActorLabel = when (swapActorCode) {
                    "USER" -> "You Swapped 1st"
                    "OPPONENT" -> "Opp Swapped 1st"
                    "SIMULTANEOUS" -> "Simultaneous Swap"
                    else -> "No Mid-Match Swap"
                }
                val switchAdvCode = (entry.switchAdvantage ?: "NEUTRAL").uppercase()
                val switchAdvLabel = when (switchAdvCode) {
                    "GAINED" -> "Switch Adv: Gained ✓"
                    "MAINTAINED" -> "Switch Adv: Held ✓"
                    "LOST" -> "Switch Adv: Lost ✗"
                    else -> "Switch Adv: Neutral"
                }
                val endgameSummaryTv = TextView(this).apply {
                    text = "🛡️ End Shields: You ${uSh}S vs Opp ${oSh}S  •  ❤️ End HP: You [$uFinalHpStr] vs Opp [$oFinalHpStr]\n🔄 $swapActorLabel  •  $switchAdvLabel"
                    setTextColor(0xFF94A3B8.toInt())
                    textSize = 10f
                    setPadding(0, (3 * density).toInt(), 0, (2 * density).toInt())
                }
                qualityRow.addView(endgameSummaryTv)

                val actionsRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setPadding(0, (6 * density).toInt(), 0, 0)
                }

                val hasRecentAiLog = aiLogsById.containsKey(entry.id) ||
                    (entry.timelineEvents.isNotEmpty() && (nowRenderMs - entry.timestampMs) <= OverlayService.AI_LOG_RETENTION_MS)
                val replayHintBtn = TextView(this).apply {
                    text = if (hasRecentAiLog) {
                        "🎬 Replay Matrix + 7d AI Timeline"
                    } else {
                        "🔍 Summary Matrix Replay (>7d)"
                    }
                    setTextColor(if (hasRecentAiLog) 0xFF38BDF8.toInt() else 0xFF94A3B8.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    setOnClickListener {
                        showInteractiveBattleReplayDialog(entry)
                    }
                }

                val editBtn = TextView(this).apply {
                    text = "✏️ Edit"
                    setTextColor(0xFFE2E8F0.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    val padH = (8 * density).toInt()
                    val padV = (3 * density).toInt()
                    setPadding(padH, padV, padH, padV)
                    setOnClickListener {
                        showEditOrCreateBattleLogDialog(entry)
                    }
                }

                val delBtn = TextView(this).apply {
                    text = "🗑️ Delete"
                    setTextColor(0xFFF87171.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    val padH = (8 * density).toInt()
                    val padV = (3 * density).toInt()
                    setPadding(padH, padV, padH, padV)
                    setOnClickListener {
                        deleteBattleLogEntry(entry)
                    }
                }

                actionsRow.addView(replayHintBtn)
                actionsRow.addView(editBtn)
                actionsRow.addView(delBtn)

                card.addView(topRow)
                card.addView(teamTv)
                card.addView(oppTv)
                card.addView(qualityRow)
                card.addView(actionsRow)
                battleLogContainer.addView(card)
            }
        }
        applyCurrentAppThemeToSubtree(battleLogContainer)
    }

    private fun deleteBattleLogEntry(entry: BattleLogEntry) {
        val trash = loadDeletedBattlesTrash().toMutableList()
        trash.removeAll { it.id == entry.id }
        trash.add(0, entry)
        saveDeletedBattlesTrash(trash)

        val current = loadBattleLogs().filter { it.id != entry.id }
        saveBattleLogs(current)
        val delIds = loadDeletedLogIds().toMutableList()
        delIds.add(entry.id)
        saveDeletedLogIds(delIds)
        renderBattleLogPage()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
        val oppSummary = entry.opponents.firstOrNull() ?: "Opponent"
        showUndoBanner("🗑️ Battle (${entry.result} vs $oppSummary) moved to Trash") {
            restoreBattleLogsFromTrash(listOf(entry))
            Toast.makeText(this, "Battle restored!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showEditOrCreateBattleLogDialog(existing: BattleLogEntry?) {
        val density = resources.displayMetrics.density
        val pad = (14 * density).toInt()
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            setPadding(pad, pad, pad, pad)
        }

        val presets = loadPresets()
        val selectedPreset = getSelectedPreset() ?: presets.firstOrNull()

        // 1. Result Spinner (WIN / LOSS)
        val resultLabel = TextView(this).apply {
            text = "Battle Result"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
        }
        val resultsArr = listOf("WIN", "LOSS")
        val spinnerResult = Spinner(this).apply {
            adapter = createThemedSpinnerAdapter(resultsArr)
            val idx = if (existing?.result.equals("LOSS", ignoreCase = true)) 1 else 0
            setSelection(idx)
        }

        // 2. Lead Matchup Spinner (FAVORABLE / NEUTRAL / NEGATIVE)
        val leadLabel = TextView(this).apply {
            text = "Lead Matchup (1st Seen vs Your Lead)"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val leadsArr = listOf("FAVORABLE", "NEUTRAL", "NEGATIVE")
        val spinnerLead = Spinner(this).apply {
            adapter = createThemedSpinnerAdapter(leadsArr)
            val idx = leadsArr.indexOfFirst { it.equals(existing?.leadMatchup ?: "NEUTRAL", ignoreCase = true) }.coerceAtLeast(0)
            setSelection(idx)
        }

        // 3. Team Preset Spinner
        val teamLabel = TextView(this).apply {
            text = "Your Team Preset & League"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val presetDisplayNames = presets.map { "${it.name} (${it.league})" }
        val spinnerPreset = Spinner(this).apply {
            adapter = createThemedSpinnerAdapter(presetDisplayNames)
            val initIdx = if (existing != null) {
                presets.indexOfFirst { it.id == existing.presetId || it.name.equals(existing.userTeamName, ignoreCase = true) }
                    .takeIf { it >= 0 } ?: 0
            } else {
                presets.indexOfFirst { it.id == selectedPreset?.id }.takeIf { it >= 0 } ?: 0
            }
            setSelection(initIdx)
        }

        val currentLeagueProvider = {
            val chosenPreset = presets.getOrNull(spinnerPreset.selectedItemPosition)
            chosenPreset?.league ?: existing?.league ?: "GREAT LEAGUE"
        }

        // 4. Opponents (1st seen, 2nd seen, 3rd seen) with Autocomplete
        fun createOpponentAutoInput(hintText: String, initialValue: String): AutoCompleteTextView {
            return AutoCompleteTextView(this).apply {
                hint = hintText
                setText(initialValue, false)
                setTextColor(0xFFF8FAFC.toInt())
                setHintTextColor(0xFF64748B.toInt())
                textSize = 13f
                threshold = 1
                setAdapter(PokemonAutocompleteAdapter(currentLeagueProvider))
            }
        }

        val oppLabel = TextView(this).apply {
            text = "Opponent Team (Fixed Order: 1st Seen, 2nd Seen, 3rd Seen)"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val editOpp1 = createOpponentAutoInput("1st Seen Opponent (Lead)", existing?.opponents?.getOrNull(0) ?: "")
        val editOpp2 = createOpponentAutoInput("2nd Seen Opponent (Switch)", existing?.opponents?.getOrNull(1) ?: "")
        val editOpp3 = createOpponentAutoInput("3rd Seen Opponent (Closer)", existing?.opponents?.getOrNull(2) ?: "")

        container.addView(resultLabel)
        container.addView(spinnerResult)
        container.addView(leadLabel)
        container.addView(spinnerLead)
        container.addView(teamLabel)
        container.addView(spinnerPreset)
        container.addView(oppLabel)
        container.addView(editOpp1)
        container.addView(editOpp2)
        container.addView(editOpp3)

        val themedContainer = wrapViewWithThemeWatermark(container, watermarkSizeDp = 220)
        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existing != null) "✏️ Modify Logged Battle" else "+ Log GBL Battle")
            .setView(themedContainer)
            .setPositiveButton("Save Battle") { _, _ ->
                val chosenPreset = presets.getOrNull(spinnerPreset.selectedItemPosition) ?: selectedPreset
                val opps = listOf(
                    editOpp1.text.toString().trim(),
                    editOpp2.text.toString().trim(),
                    editOpp3.text.toString().trim()
                ).filter { it.isNotEmpty() }

                val nowMs = System.currentTimeMillis()
                val chosenLeague = chosenPreset?.league ?: existing?.league ?: "GREAT LEAGUE"
                val chosenMons = chosenPreset?.pokemon?.map { it.name } ?: existing?.userPokemon ?: emptyList()
                val chosenResult = resultsArr.getOrElse(spinnerResult.selectedItemPosition) { "WIN" }
                val serviceSlots = chosenPreset?.pokemon?.map {
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
                }
                val computedQuality = OverlayService.calculateBattleQuality(
                    myTeam = chosenMons,
                    oppTeam = opps,
                    league = chosenLeague,
                    result = chosenResult,
                    myTeamSlots = serviceSlots,
                    timelineEvents = existing?.timelineEvents?.takeIf { it.isNotEmpty() },
                    totalDurationSec = existing?.battleDurationSec,
                    explicitUserFaints = existing?.userFaints,
                    explicitOppFaints = existing?.oppFaints,
                    explicitUserShieldsRemaining = existing?.userShieldsRemaining,
                    explicitOppShieldsRemaining = existing?.oppShieldsRemaining
                )
                val updatedEntry = BattleLogEntry(
                    id = existing?.id ?: "log-$nowMs-${(100..999).random()}",
                    timestampMs = existing?.timestampMs ?: nowMs,
                    updatedAt = nowMs,
                    league = chosenLeague,
                    presetId = chosenPreset?.id ?: existing?.presetId ?: "",
                    userTeamName = chosenPreset?.name ?: existing?.userTeamName ?: "Active Team",
                    userPokemon = chosenMons,
                    opponents = opps,
                    leadMatchup = leadsArr.getOrElse(spinnerLead.selectedItemPosition) { "NEUTRAL" },
                    result = chosenResult,
                    deviceLabel = existing?.deviceLabel ?: (Build.MODEL ?: "Android"),
                    bmfScore = computedQuality?.pPre,
                    execWae = computedQuality?.execWae,
                    badges = computedQuality?.badges ?: if (computedQuality != null) listOf(computedQuality.badgeLabel) else emptyList(),
                    flags = computedQuality?.contextualFlags ?: emptyList(),
                    quality = computedQuality,
                    qualityEvaluated = true,
                    timelineEvents = existing?.timelineEvents ?: emptyList(),
                    battleDurationSec = existing?.battleDurationSec,
                    userFaints = existing?.userFaints,
                    oppFaints = existing?.oppFaints,
                    userShieldsRemaining = existing?.userShieldsRemaining,
                    oppShieldsRemaining = existing?.oppShieldsRemaining
                )

                val all = loadBattleLogs().toMutableList()
                val idx = all.indexOfFirst { it.id == updatedEntry.id }
                if (idx >= 0) {
                    all[idx] = updatedEntry
                } else {
                    all.add(0, updatedEntry)
                }
                saveBattleLogs(all)
                setupBattleLogFilters()
                renderBattleLogPage()
                updateSyncStatusUi()
                triggerTwoDeviceCloudSync(silent = true)
                Toast.makeText(this, "Battle saved!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
        styleThemedAlertDialog(dialog)
    }

    inner class ReplayJavascriptBridge(
        private val replayEngine: OverlayService,
        private val pushReplayStateToWeb: () -> Unit,
        private val onContentHeightUpdated: (Int) -> Unit = {}
    ) {
        @android.webkit.JavascriptInterface
        fun selectActiveUserPokemon(pokemonName: String) {
            runOnUiThread {
                try {
                    replayEngine.selectActiveUserPokemon(pokemonName)
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun swapActiveOpponent(pokemonName: String) {
            runOnUiThread {
                try {
                    replayEngine.swapActiveOpponent(pokemonName)
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun toggleOpponentShadow() {
            runOnUiThread {
                try {
                    replayEngine.toggleShadowModifier()
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun cycleOpponentForm() {
            runOnUiThread {
                try {
                    replayEngine.cycleActiveOpponentForm()
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun updateContentHeight(heightDp: Int) {
            runOnUiThread {
                try {
                    onContentHeightUpdated(heightDp)
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun onOverlayReady() {
            runOnUiThread {
                try {
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }
    }

    @Suppress("USELESS_ELVIS")
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private fun showInteractiveBattleReplayDialog(entry: BattleLogEntry) {
        try {
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            val presets = loadPresets()
            val safePresetId = entry.presetId ?: ""
            val safeUserTeamName = entry.userTeamName ?: ""
            val safeLeague = entry.league ?: "GREAT LEAGUE"
            val safeUserPokemon = entry.userPokemon ?: emptyList()
            val safeOpponents = entry.opponents ?: emptyList()
            val safeLeadMatchup = entry.leadMatchup ?: "NEUTRAL"
            val safeResult = entry.result ?: "WIN"

            val matchedPreset = presets.find {
                (safePresetId.isNotBlank() && it.id == safePresetId) ||
                    it.name.equals(safeUserTeamName, ignoreCase = true)
            } ?: getSelectedPreset()

            val teamMembers: List<OverlayService.TeamMember> = if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
                matchedPreset.pokemon.map {
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
                }
            } else {
                val fallbackNames = if (safeUserPokemon.size >= 3) safeUserPokemon else getLeagueTop3Defaults(safeLeague).map { it.name }
                fallbackNames.map { monName ->
                    val rec = OverlayService.resolveRecommendedMovesForSpecies(monName, safeLeague)
                    OverlayService.TeamMember(
                        name = monName,
                        cp = rec?.defaultCp ?: 1500,
                        fastMove = rec?.defaultFastMove ?: "Fast Move",
                        chargedMove1 = rec?.chargedMove1 ?: "Charged 1",
                        chargedMove2 = rec?.chargedMove2 ?: "Charged 2"
                    )
                }
            }

            val servicePreset = OverlayService.TeamPreset(
                id = matchedPreset?.id ?: "replay-preset",
                name = safeUserTeamName.ifBlank { matchedPreset?.name ?: "Replay Team" },
                league = safeLeague,
                pokemon = teamMembers
            )

            val replayOpponents = if (safeOpponents.isNotEmpty()) {
                safeOpponents
            } else {
                getLeagueTop3Defaults(safeLeague).map { it.name }
            }

            val oppCountModeVal = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
            val enable4Val = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)

            val replayEngine = OverlayService()
            replayEngine.configureReplayState(
                preset = servicePreset,
                opponentsList = replayOpponents,
                activeOppIdx = 0,
                activeUserIdx = 0,
                oppCountModeVal = oppCountModeVal,
                enable4ChargedVal = enable4Val
            )

            val density = resources.displayMetrics.density
            val dialogContainer = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF0F172A.toInt())
                val pad = (8 * density).toInt()
                setPadding(pad, pad, pad, pad)
            }

            val entryQuality = resolveEntryQuality(entry, presets)
            val qualityLine = if (entryQuality != null) {
                val bmfInt = (entryQuality.pPre * 100.0).roundToInt()
                val waeVal = entryQuality.deltaQ * 100.0
                val sign = if (waeVal >= 0.0) "+" else "-"
                val waeStr = String.format(java.util.Locale.US, "%s%.1f%%", sign, kotlin.math.abs(waeVal))
                "\n${entryQuality.badgeLabel} • BMF: ${bmfInt}% • Exec WAE: $waeStr"
            } else ""

            val aiRecord = loadAiTrainingLogs().find { it.battleId == entry.id }
            val replayEvents = aiRecord?.timelineEvents?.takeIf { it.isNotEmpty() } ?: entry.timelineEvents
            val isWithin7Days = (System.currentTimeMillis() - entry.timestampMs) <= OverlayService.AI_LOG_RETENTION_MS
            val uSh = entry.userShieldsRemaining ?: entry.quality?.userShieldsRemaining ?: 0
            val oSh = entry.oppShieldsRemaining ?: entry.quality?.oppShieldsRemaining ?: 0
            val swapInfoLine = "\n🛡️ End Shields: ${uSh}S vs ${oSh}S • 1st Swap: ${entry.firstSwapActor ?: "NONE"} (${entry.switchAdvantage ?: "NEUTRAL"})"
            val aiTimelineLine = if (replayEvents.isNotEmpty() && isWithin7Days) {
                val sampleEvents = replayEvents.take(5).joinToString(" → ") { ev ->
                    "t=${ev.t.toInt()}s ${ev.type}"
                }
                "\n🤖 7-Day AI Timeline (${replayEvents.size} events): $sampleEvents"
            } else {
                "\n📦 Summary Replay Mode (Detailed AI timestamp log >7 days auto-purged)"
            }

            val hintTv = TextView(this).apply {
                val leadTxt = when (safeLeadMatchup.uppercase()) {
                    "FAVORABLE" -> "Lead: Favorable"
                    "NEGATIVE" -> "Lead: Negative"
                    else -> "Lead: Neutral"
                }
                text = "🔍 Interactive Post-Game Overlay • $safeResult ($leadTxt)$qualityLine$swapInfoLine$aiTimelineLine\nTap any of your 3 Pokémon chips, opponent rows (1st/2nd/3rd), or Shadow/Form buttons to inspect matchup lines:"
                setTextColor(0xFF94A3B8.toInt())
                textSize = 11f
                setPadding((4 * density).toInt(), 0, (4 * density).toInt(), (6 * density).toInt())
            }

            val replayWebView = android.webkit.WebView(this).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                setBackgroundColor(0x00000000)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    (540 * density).toInt()
                )
            }

            val pushReplayStateToWeb: () -> Unit = {
                try {
                    val payloadJson = replayEngine.buildBattlePayloadJson(isReplayMode = true)
                    val activeThemeId = getActiveAppTheme().id
                    val showWatermark = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true) && getActiveAppTheme().emblemDrawableRes != null
                    val replayTransPct = if (showWatermark) 42 else 18
                    replayWebView.post {
                        try {
                            replayWebView.evaluateJavascript("if (window.setOverlayTransparencyPct) setOverlayTransparencyPct($replayTransPct);", null)
                            replayWebView.evaluateJavascript("if (window.setOverlayTheme) setOverlayTheme('$activeThemeId');", null)
                            replayWebView.evaluateJavascript("if (window.setOverlayWatermark) setOverlayWatermark($showWatermark);", null)
                            replayWebView.evaluateJavascript("if (window.updateBattleData) updateBattleData($payloadJson);", null)
                            replayWebView.evaluateJavascript("if (window.notifyHeight) notifyHeight();", null)
                        } catch (_: Exception) {}
                    }
                } catch (_: Exception) {}
                Unit
            }

            val replayBridge = ReplayJavascriptBridge(
                replayEngine = replayEngine,
                pushReplayStateToWeb = pushReplayStateToWeb,
                onContentHeightUpdated = { heightDp ->
                    val targetHeightPx = (kotlin.math.max(480, heightDp + 20) * density).toInt()
                    val lp = replayWebView.layoutParams
                    if (lp != null && kotlin.math.abs(lp.height - targetHeightPx) > (2 * density).toInt()) {
                        lp.height = targetHeightPx
                        replayWebView.layoutParams = lp
                        replayWebView.requestLayout()
                    }
                }
            )

            replayWebView.webViewClient = object : android.webkit.WebViewClient() {
                override fun onPageFinished(view: android.webkit.WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    pushReplayStateToWeb()
                }
            }
            replayWebView.addJavascriptInterface(replayBridge, "AndroidOverlay")
            replayWebView.loadUrl("file:///android_asset/overlay.html?replay=1")

            dialogContainer.addView(hintTv)
            dialogContainer.addView(replayWebView)
            val replayScrollView = ScrollView(this).apply {
                isFillViewport = true
                setBackgroundColor(0xFF0F172A.toInt())
                addView(dialogContainer)
            }
            val themedReplayRoot = wrapViewWithThemeWatermark(replayScrollView, watermarkSizeDp = 250)

            val dialog = AlertDialog.Builder(this)
                .setTitle("🎬 Battle Matrix Replay • $safeLeague")
                .setView(themedReplayRoot)
                .setPositiveButton("Close Replay", null)
                .setNeutralButton("✏️ Edit Log") { _, _ ->
                    showEditOrCreateBattleLogDialog(entry)
                }
                .show()
            styleThemedAlertDialog(dialog)
        } catch (e: Exception) {
            Toast.makeText(this, "Error opening Battle Recap: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    private fun updateOppCountBasisUi() {
        val mode = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
        if (mode == "opp_fasts") {
            btnToggleOppCountBasis.text = "Their Fasts"
            textOppCountBasisDesc.text = "Counts & 50e/Xf relative to Opponent Fast Moves"
        } else {
            btnToggleOppCountBasis.text = "My Fasts"
            textOppCountBasisDesc.text = "Default: Counts & 50e/Xf relative to My Fast Moves"
        }
        if (::prefs.isInitialized) {
            btnToggleOppCountBasis.backgroundTintList = android.content.res.ColorStateList.valueOf(getActiveAppTheme().buttonAccentColor)
            btnToggleOppCountBasis.setTextColor(0xFFFFFFFF.toInt())
        }
    }

    private fun updateOppChargedMovesUi() {
        val enable4 = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
        if (enable4) {
            btnToggleOppChargedMoves.text = "4 Moves"
            textOppChargedMovesDesc.text = "Active: 4 Charged Moves (Official + Top 2 Usage)"
        } else {
            btnToggleOppChargedMoves.text = "3 Moves"
            textOppChargedMovesDesc.text = "Default: 3 Charged Moves (Official + Top Usage)"
        }
        if (::prefs.isInitialized) {
            btnToggleOppChargedMoves.backgroundTintList = android.content.res.ColorStateList.valueOf(getActiveAppTheme().buttonAccentColor)
            btnToggleOppChargedMoves.setTextColor(0xFFFFFFFF.toInt())
        }
    }

    private fun updateBattleToastsUi() {
        val disableToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (disableToasts) {
            btnToggleBattleToasts.text = "Toasts Off"
            btnToggleBattleToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleBattleToasts.setTextColor(theme.primaryTextColor)
            textBattleToastsDesc.text = "Active: In-game Battle Toast popups disabled"
        } else {
            btnToggleBattleToasts.text = "Toasts On"
            btnToggleBattleToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleBattleToasts.setTextColor(0xFFFFFFFF.toInt())
            textBattleToastsDesc.text = "Default: Popups shown for Battle Start/Stop, Switches & Logs"
        }
    }

    private fun updateTacticalRecUi() {
        val showRecs = prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, true)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (showRecs) {
            btnToggleTacticalRec.text = "Recs On"
            btnToggleTacticalRec.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleTacticalRec.setTextColor(0xFFFFFFFF.toInt())
            textTacticalRecDesc.text = "Default: Shows 1-line Action, Shield Plan & Matchup Goal row in Overlay"
        } else {
            btnToggleTacticalRec.text = "Recs Off"
            btnToggleTacticalRec.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleTacticalRec.setTextColor(theme.primaryTextColor)
            textTacticalRecDesc.text = "Active: Tactical Recommendation row hidden in Overlay"
        }
    }

    private fun updateHpTrackingUi() {
        if (!::btnToggleHpTracking.isInitialized) return
        val enabled = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, false)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleHpTracking.text = "HP On"
            btnToggleHpTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleHpTracking.setTextColor(0xFFFFFFFF.toInt())
            textHpTrackingDesc.text = "Active: Live 2D floating HP bar scanning & per-slot HP% badges enabled"
        } else {
            btnToggleHpTracking.text = "HP Off"
            btnToggleHpTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleHpTracking.setTextColor(theme.primaryTextColor)
            textHpTrackingDesc.text = "Default: Disabled (Opt-in via Settings to scan floating HP bars)"
        }
    }

    private fun updateEnergyTrackingUi() {
        if (!::btnToggleEnergyTracking.isInitialized) return
        val enabled = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, false)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleEnergyTracking.text = "Energy On"
            btnToggleEnergyTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleEnergyTracking.setTextColor(0xFFFFFFFF.toInt())
            textEnergyTrackingDesc.text = "Active: Slowest Charge Move Meter Debounce & Direct Snap enabled"
        } else {
            btnToggleEnergyTracking.text = "Energy Off"
            btnToggleEnergyTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleEnergyTracking.setTextColor(theme.primaryTextColor)
            textEnergyTrackingDesc.text = "Default: Disabled (Opt-in for Slowest Charge Move Meter Debounce & Snap)"
        }
    }

    private fun updateFastDetectOffsetUi() {
        if (!::btnCycleFastDetectOffset.isInitialized) return
        val offset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (offset) {
            0 -> {
                btnCycleFastDetectOffset.text = "+0 Turns"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Default: +0 Turns (Samples at first damage-registration turn >= 10% standard HP damage)"
            }
            1 -> {
                btnCycleFastDetectOffset.text = "+1 Turn"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Active: +1 Turn Delay (Samples 1 turn after >= 10% damage-registration turn)"
            }
            else -> {
                btnCycleFastDetectOffset.text = "+2 Turns"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Active: +2 Turns Delay (Samples 2 turns after >= 10% damage-registration turn)"
            }
        }
    }

    /**
     * Checks notifications (Android 13+), SYSTEM_ALERT_WINDOW, and initiates overlay launch
     */
    private fun checkOverlayPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        proceedWithOverlayCheck()
    }

    private fun proceedWithOverlayCheck() {
        if (!Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            Toast.makeText(this, "Please grant 'Display over other apps' permission", Toast.LENGTH_LONG).show()
            startActivity(intent)
            return
        }

        // Request MediaProjection token for in-memory screen analysis
        if (projectionManager != null) {
            try {
                val captureIntent = projectionManager!!.createScreenCaptureIntent()
                screenCaptureLauncher.launch(captureIntent)
            } catch (e: Exception) {
                // If createScreenCaptureIntent fails, launch overlay HUD directly
                startOverlayForegroundService(0, null)
            }
        } else {
            startOverlayForegroundService(0, null)
        }
    }

    private fun startOverlayForegroundService(resultCode: Int, data: Intent?) {
        if (OverlayService.areAllFourLeaguesLoaded() && OverlayService.DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
            launchOverlayServiceNow(resultCode, data)
            return
        }

        statusText.text = "Status: Ensuring all 4 league rankings JSONs are loaded..."
        dbStatusText.text = "Syncing PvPoke GameMaster & all 4 leagues before launching overlay..."
        btnToggleOverlay.isEnabled = false
        Toast.makeText(this, "Downloading/verifying all 4 league rankings before launching overlay...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch(Dispatchers.IO) {
            var didDownloadAny = false
            try {
                for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                    val rFile = File(filesDir, fileName)
                    if (rFile.exists() && rFile.length() > 200 && OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                        OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                    }
                    if (OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                        val rReq = Request.Builder().url(url).build()
                        client.newCall(rReq).execute().use { rResp ->
                            val rBody = rResp.body?.string()
                            if (rResp.isSuccessful && !rBody.isNullOrBlank()) {
                                rFile.writeText(rBody)
                                OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                didDownloadAny = true
                            }
                        }
                    }
                }

                val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                if (cacheFile.exists() && cacheFile.length() > 1000 && OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                }
                if (OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    val req = Request.Builder().url(GAMEMASTER_URL).build()
                    client.newCall(req).execute().use { resp ->
                        val body = resp.body?.string()
                        if (resp.isSuccessful && !body.isNullOrBlank()) {
                            cacheFile.writeText(body)
                            OverlayService.parseGamemasterJsonStatic(body)
                            didDownloadAny = true
                        }
                    }
                }

                if (didDownloadAny || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()
                }
            } catch (_: Exception) {}

            withContext(Dispatchers.Main) {
                btnToggleOverlay.isEnabled = true
                dbStatusText.text = formatDbAndLeagueStatusText()
                if (OverlayService.areAllFourLeaguesLoaded()) {
                    launchOverlayServiceNow(resultCode, data)
                } else {
                    statusText.text = "Status: Waiting for all 4 league rankings JSONs"
                    Toast.makeText(
                        this@MainActivity,
                        "All 4 league rankings JSONs must be downloaded before launching overlay. Check connection and tap Sync PvPoke.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun launchOverlayServiceNow(resultCode: Int, data: Intent?) {
        // Recalculate all saved team presets' Lead BR, Swap BR, and Machine BR in background
        recalculateAllPresetsWithSeasonMetaAsync()
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START_OVERLAY
            putExtra(OverlayService.EXTRA_RESULT_CODE, resultCode)
            if (data != null) {
                putExtra(OverlayService.EXTRA_RESULT_DATA, data)
            }
            putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts")
            putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
            putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
            putExtra(OverlayService.EXTRA_SHOW_TACTICAL_RECOMMENDATIONS, prefs.getBoolean(PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS, true))
            putExtra(OverlayService.EXTRA_ENABLE_HP_TRACKING, prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, false))
            putExtra(OverlayService.EXTRA_ENABLE_ENERGY_TRACKING, prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, false))
            putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2))
            putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT))
            putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, DEFAULT_OVERLAY_TRANSPARENCY_PCT))
            putExtra(OverlayService.EXTRA_APP_THEME_ID, prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "slate") ?: "slate")
        }

        try {
            OverlayService.isInstanceRunning = true
            ContextCompat.startForegroundService(this, serviceIntent)
            isOverlayRunning = true
            syncOverlayRunningUiState()
            Toast.makeText(this, "GBL Battle Overlay launched! Check your screen", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            OverlayService.isInstanceRunning = false
            isOverlayRunning = false
            syncOverlayRunningUiState()
            Toast.makeText(this, "Failed to start overlay: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            e.printStackTrace()
        }
    }

    private fun stopOverlayService() {
        OverlayService.isInstanceRunning = false
        OverlayService.hasActiveMediaProjection = false
        isOverlayRunning = false
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_STOP_OVERLAY
        }
        try {
            startService(serviceIntent)
        } catch (_: Exception) {}
        try {
            stopService(Intent(this, OverlayService::class.java))
        } catch (_: Exception) {}
        syncOverlayRunningUiState()
    }

    /**
     * TEAM PRESET MANAGEMENT:
     * Saves and loads custom team presets locally via SharedPreferences.
     * Automatically migrates any teams from legacy preference keys so updates never overwrite user teams.
     */
    fun loadPresets(): List<TeamPreset> {
        val type = object : TypeToken<List<TeamPreset>>() {}.type
        val persistentJson = prefs.getString(PREFS_KEY_PRESETS, null)
        if (!persistentJson.isNullOrBlank()) {
            val parsed: List<TeamPreset>? = try { gson.fromJson(persistentJson, type) } catch (_: Exception) { null }
            if (!parsed.isNullOrEmpty()) return parsed
        }

        for (legacyKey in OverlayService.LEGACY_PRESET_KEYS) {
            val legacyJson = prefs.getString(legacyKey, null)
            if (!legacyJson.isNullOrBlank()) {
                val parsed: List<TeamPreset>? = try { gson.fromJson(legacyJson, type) } catch (_: Exception) { null }
                if (!parsed.isNullOrEmpty()) {
                    // Migrate permanently to PREFS_KEY_PRESETS so future updates never touch user teams
                    prefs.edit().putString(PREFS_KEY_PRESETS, legacyJson).apply()
                    return parsed
                }
            }
        }
        return emptyList()
    }

    fun savePresets(presets: List<TeamPreset>) {
        prefs.edit().putString(PREFS_KEY_PRESETS, gson.toJson(presets)).apply()
    }

    fun getSelectedPreset(): TeamPreset? {
        val list = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null)
        return list.find { it.id == selectedId } ?: list.firstOrNull()
    }

    fun setSelectedPreset(presetId: String) {
        prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, presetId).apply()
        refreshPresetsUi()

        // If overlay is running, notify service of the new preset
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_PRESET
                putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            }
            startService(updateIntent)
        }
    }

    private fun movePresetOrder(fromIndex: Int, toIndex: Int) {
        val list = loadPresets().toMutableList()
        if (fromIndex !in list.indices || toIndex !in list.indices || fromIndex == toIndex) return
        val item = list.removeAt(fromIndex)
        list.add(toIndex, item)
        savePresets(list)
        refreshPresetsUi()
    }

    private fun getLeagueTop3Defaults(league: String): List<PokemonSlot> {
        return when {
            league.contains("MEGA", ignoreCase = true) -> listOf(
                PokemonSlot("Mega Rayquaza", 5728, "Dragon Tail", "Breaking Swipe", "Dragon Ascent"),
                PokemonSlot("Primal Groudon", 5910, "Mud Shot", "Precipice Blades", "Fire Punch"),
                PokemonSlot("Primal Kyogre", 5910, "Waterfall", "Origin Pulse", "Surf")
            )
            league.contains("GREAT", ignoreCase = true) -> listOf(
                PokemonSlot("Clodsire", 1494, "Poison Sting", "Earthquake", "Stone Edge"),
                PokemonSlot("Feraligatr", 1498, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                PokemonSlot("Mandibuzz", 1496, "Snarl", "Dark Pulse", "Aerial Ace")
            )
            league.contains("ULTRA", ignoreCase = true) -> listOf(
                PokemonSlot("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                PokemonSlot("Feraligatr", 2488, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                PokemonSlot("Giratina (Altered)", 2497, "Shadow Claw", "Dragon Claw", "Ancient Power")
            )
            else -> listOf(
                PokemonSlot("Palkia (Origin)", 4683, "Dragon Breath", "Spacial Rend", "Aqua Tail"),
                PokemonSlot("Zacian (Crowned)", 4658, "Metal Claw", "Behemoth Blade", "Close Combat"),
                PokemonSlot("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head")
            )
        }
    }

    private fun ensureDefaultPresets() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    id = "preset-ml-1",
                    name = "Master: Palkia-O / Zacian-C / Dialga-O",
                    league = "MASTER LEAGUE",
                    pokemon = getLeagueTop3Defaults("MASTER LEAGUE"),
                    isSelected = true
                ),
                TeamPreset(
                    id = "preset-ul-1",
                    name = "Ultra: Zygarde / Feraligatr / Giratina-A",
                    league = "ULTRA LEAGUE",
                    pokemon = getLeagueTop3Defaults("ULTRA LEAGUE")
                ),
                TeamPreset(
                    id = "preset-gl-1",
                    name = "Great: Clodsire / Feraligatr / Mandibuzz",
                    league = "GREAT LEAGUE",
                    pokemon = getLeagueTop3Defaults("GREAT LEAGUE")
                )
            )
            savePresets(defaults)
            if (!prefs.contains(PREFS_KEY_SELECTED_PRESET)) {
                prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, "preset-ml-1").apply()
            }
        }
    }

    private fun refreshPresetsUi() {
        updateTrashButtonsUi()
        presetsContainer.removeAllViews()
        val presets = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null) ?: presets.firstOrNull()?.id

        var hasUncomputedMetrics = false

        presets.forEachIndexed { index, preset ->
            if (preset.leadAggBr <= 0 || preset.machineAggBr <= 0 || preset.safeSwapBr <= 0 || preset.synergySummary.isBlank()) {
                hasUncomputedMetrics = true
            }
            val itemView = layoutInflater.inflate(R.layout.item_team_preset, presetsContainer, false)
            val dragHandle = itemView.findViewById<TextView>(R.id.drag_handle_preset)
            val textName = itemView.findViewById<TextView>(R.id.text_preset_name)
            val textArchetype = itemView.findViewById<TextView>(R.id.text_preset_archetype_badge)
            val textLeague = itemView.findViewById<TextView>(R.id.text_preset_league)
            val textMetricsBadges = itemView.findViewById<TextView>(R.id.text_preset_metrics_badges)
            val textPokemon = itemView.findViewById<TextView>(R.id.text_preset_pokemon)
            val radioSelected = itemView.findViewById<RadioButton>(R.id.radio_selected)
            val btnMoveUp = itemView.findViewById<TextView>(R.id.btn_move_preset_up)
            val btnMoveDown = itemView.findViewById<TextView>(R.id.btn_move_preset_down)
            val btnEdit = itemView.findViewById<ImageButton>(R.id.btn_edit_preset)
            val btnDelete = itemView.findViewById<ImageButton>(R.id.btn_delete_preset)

            val isCurrent = preset.id == selectedId
            radioSelected.isChecked = isCurrent
            textName.text = preset.name

            val isAbb = preset.archetype.equals("ABB", ignoreCase = true)
            val isDuo = preset.archetype.equals("DUO", ignoreCase = true)
            textArchetype?.text = if (preset.isArchetypeManual) "${preset.archetype}*" else preset.archetype

            val maxCp = preset.pokemon.maxOfOrNull { it.cp } ?: 0
            val resolvedLeague = when {
                preset.league.contains("MEGA", ignoreCase = true) -> "MEGA MASTER LEAGUE"
                preset.league.contains("GREAT", ignoreCase = true) || (maxCp in 1..1500) -> "GREAT LEAGUE"
                preset.league.contains("ULTRA", ignoreCase = true) || (maxCp in 1501..2500) -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
            textLeague.text = resolvedLeague

            val (leadTier, leadHex) = getMatchupTierCodeAndHex(preset.leadAggBr)
            val (machTier, machHex) = getMachineBrTierLabelAndHex(preset.machineAggBr)
            val (swap2Tier, swap2Hex) = getMatchupTierCodeAndHex(preset.safeSwapBr)
            val (swap3Tier, swap3Hex) = getMatchupTierCodeAndHex(preset.closerSwapBr)
            val (closeTier, closeHex) = getMatchupTierCodeAndHex(preset.closerBr)

            applyCurrentAppThemeToSubtree(itemView)
            val activeTheme = getActiveAppTheme()

            val targetTotal = preset.topMetaTargetsTotal.takeIf { it > 0 } ?: 50
            val sharedWeakBadge = if (preset.sharedWeaknesses.isNotEmpty()) {
                if (isDuo) {
                    "  •  <font color='#34d399'>☯️ 1⇄3 Covers: ${preset.sharedWeaknesses.joinToString("/").uppercase()}</font>"
                } else {
                    "  •  <font color='#fbbf24'>B-Weak: ${preset.sharedWeaknesses.joinToString("/").uppercase()}</font>"
                }
            } else {
                ""
            }

            val metricsHtml = "Core: <font color='$machHex'><b>${preset.machineAggBr} ($machTier)</b></font>  •  " +
                "Beats <font color='#6ee7b7'><b>${preset.topMetaWinsCount}/$targetTotal</b></font> Top Meta<br>" +
                "Lead BR: <font color='$leadHex'>${preset.leadAggBr} ($leadTier)</font>  •  " +
                "Swap BR: <font color='$swap2Hex'>#2 ${preset.safeSwapBr} ($swap2Tier)</font> / <font color='$swap3Hex'>#3 ${preset.closerSwapBr} ($swap3Tier)</font>  •  " +
                "Closer BR: <font color='$closeHex'>${preset.closerBr} ($closeTier)</font>$sharedWeakBadge"
            textMetricsBadges?.text = android.text.Html.fromHtml(metricsHtml, android.text.Html.FROM_HTML_MODE_LEGACY)

            val roleLabels = when {
                isAbb -> listOf("Lead (A)", "Bait Swap (B1)", "Sweeper (B2)")
                isDuo -> listOf("Lead (Core 1)", "Pivot (Swap)", "Co-Core (Core 2)")
                else -> listOf("Lead", "Safe Swap", "Closer")
            }
            val slotBrHtmlLabels = listOf(
                "<font color='$leadHex'>Lead BR ${preset.leadAggBr} ($leadTier)</font>",
                "<font color='$swap2Hex'>Swap BR ${preset.safeSwapBr} ($swap2Tier)</font>",
                "<font color='$closeHex'>Closer BR ${preset.closerBr} ($closeTier)</font>"
            )

            val pokemonRowsHtml = preset.pokemon.mapIndexed { sIdx, slot ->
                val ivText = if (!slot.ivs.isNullOrBlank()) "IV ${slot.ivs}" else "PvPoke IVs"
                val rTag = roleLabels.getOrElse(sIdx) { "Slot ${sIdx + 1}" }
                val brTag = slotBrHtmlLabels.getOrElse(sIdx) { "" }
                "• <b>[$rTag · $brTag]</b> ${slot.name} <font color='#94a3b8'>($ivText · CP ${slot.cp})</font>"
            }.joinToString("<br>")

            val winsList = if (preset.keyMetaTargetsBeaten.isNotEmpty()) preset.keyMetaTargetsBeaten.take(5).joinToString(", ") else "Balanced neutral coverage"
            val threatsList = if (preset.keyThreats.isNotEmpty()) preset.keyThreats.take(4).joinToString(", ") else "No severe role threats"
            val breakersList = if (preset.coreBreakers.isNotEmpty()) preset.coreBreakers.take(4).joinToString(", ") else "None in Top $targetTotal Meta!"
            val breakersColor = if (preset.coreBreakers.isNotEmpty()) "#fda4af" else "#6ee7b7"

            val summaryBlockHtml = "<br>" +
                "<font color='#6ee7b7'><b>✅ Key Wins:</b></font> $winsList<br>" +
                "<font color='#fcd34d'><b>⚠️ Key Threats (Slot 1/2/3 BR):</b></font> $threatsList<br>" +
                "<font color='$breakersColor'><b>🚨 Core Breakers (Slot 1/2/3 BR):</b></font> $breakersList"

            textPokemon.text = android.text.Html.fromHtml(pokemonRowsHtml + summaryBlockHtml, android.text.Html.FROM_HTML_MODE_LEGACY)

            textArchetype?.setTextColor(
                when {
                    isAbb -> 0xFFFBBF24.toInt()
                    isDuo -> 0xFF34D399.toInt()
                    else -> activeTheme.accentColor
                }
            )
            textLeague.setTextColor(
                when (resolvedLeague) {
                    "GREAT LEAGUE" -> activeTheme.accentColor
                    "ULTRA LEAGUE" -> 0xFFFBBF24.toInt()
                    "MEGA MASTER LEAGUE" -> 0xFFE879F9.toInt()
                    else -> 0xFFC084FC.toInt()
                }
            )

            btnMoveUp?.alpha = if (index == 0) 0.3f else 1.0f
            btnMoveDown?.alpha = if (index == presets.lastIndex) 0.3f else 1.0f
            btnMoveUp?.setOnClickListener {
                if (index > 0) movePresetOrder(index, index - 1)
            }
            btnMoveDown?.setOnClickListener {
                if (index < presets.lastIndex) movePresetOrder(index, index + 1)
            }

            val startDragAction = { v: android.view.View ->
                val clipData = android.content.ClipData.newPlainText("preset_index", index.toString())
                val shadow = android.view.View.DragShadowBuilder(itemView)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    v.startDragAndDrop(clipData, shadow, index, 0)
                } else {
                    @Suppress("DEPRECATION")
                    v.startDrag(clipData, shadow, index, 0)
                }
                true
            }
            dragHandle?.setOnLongClickListener { startDragAction(itemView) }
            itemView.setOnLongClickListener { startDragAction(itemView) }

            itemView.setOnDragListener { v, event ->
                when (event.action) {
                    android.view.DragEvent.ACTION_DRAG_STARTED -> true
                    android.view.DragEvent.ACTION_DRAG_ENTERED -> {
                        v.alpha = 0.65f
                        true
                    }
                    android.view.DragEvent.ACTION_DRAG_EXITED,
                    android.view.DragEvent.ACTION_DRAG_ENDED -> {
                        v.alpha = 1.0f
                        true
                    }
                    android.view.DragEvent.ACTION_DROP -> {
                        v.alpha = 1.0f
                        val fromIdx = (event.localState as? Int)
                            ?: event.clipData?.getItemAt(0)?.text?.toString()?.toIntOrNull()
                        if (fromIdx != null && fromIdx != index) {
                            movePresetOrder(fromIdx, index)
                        }
                        true
                    }
                    else -> true
                }
            }

            itemView.setOnClickListener {
                setSelectedPreset(preset.id)
            }
            radioSelected.setOnClickListener {
                setSelectedPreset(preset.id)
            }

            btnEdit.setOnClickListener {
                showPresetEditorDialog(preset)
            }

            btnDelete.setOnClickListener {
                if (presets.size <= 1) {
                    Toast.makeText(this, "Must keep at least 1 team preset", Toast.LENGTH_SHORT).show()
                } else {
                    val trash = loadDeletedTeamsTrash().toMutableList()
                    trash.removeAll { it.id == preset.id }
                    trash.add(0, preset)
                    saveDeletedTeamsTrash(trash)

                    val delTeamIds = loadDeletedTeamIds().toMutableList()
                    delTeamIds.add(preset.id)
                    saveDeletedTeamIds(delTeamIds)

                    val updated = presets.filter { it.id != preset.id }
                    savePresets(updated)
                    if (isCurrent) {
                        setSelectedPreset(updated.first().id)
                    } else {
                        refreshPresetsUi()
                    }
                    setupBattleLogFilters()
                    updateSyncStatusUi()
                    triggerTwoDeviceCloudSync(silent = true)
                    showUndoBanner("🗑️ Team '${preset.name}' moved to Trash") {
                        restoreTeamPresetFromTrash(preset)
                        Toast.makeText(this, "Team '${preset.name}' restored!", Toast.LENGTH_SHORT).show()
                    }
                }
            }

            presetsContainer.addView(itemView)
        }

        if (hasUncomputedMetrics) {
            recalculateAllPresetsWithSeasonMetaAsync()
        }
    }

    private inner class PokemonAutocompleteAdapter(
        private val leagueProvider: () -> String
    ) : BaseAdapter(), Filterable {

        private var items: List<OverlayService.Companion.PokemonAutocompleteSuggestion> = emptyList()

        override fun getCount(): Int = items.size
        override fun getItem(position: Int): OverlayService.Companion.PokemonAutocompleteSuggestion = items[position]
        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup?): android.view.View {
            val container = (convertView as? LinearLayout) ?: LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF0F172A.toInt())
                val padH = (12 * resources.displayMetrics.density).toInt()
                val padV = (8 * resources.displayMetrics.density).toInt()
                setPadding(padH, padV, padH, padV)
            }
            container.removeAllViews()

            val item = items[position]

            val topRow = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            val nameTv = TextView(this@MainActivity).apply {
                text = item.name
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val badgeTv = TextView(this@MainActivity).apply {
                text = "${item.formBadge} • CP ${item.cp}"
                textSize = 10.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(
                    when {
                        item.isShadow -> 0xFFD8B4FE.toInt()
                        item.isAlternateForm -> 0xFFFDE68A.toInt()
                        else -> 0xFF38BDF8.toInt()
                    }
                )
            }
            topRow.addView(nameTv)
            topRow.addView(badgeTv)

            val movesTv = TextView(this@MainActivity).apply {
                text = "${item.fastMove}  •  ${item.chargedMove1} / ${item.chargedMove2}"
                textSize = 11f
                setTextColor(0xFF94A3B8.toInt())
            }

            container.addView(topRow)
            container.addView(movesTv)
            applyCurrentAppThemeToSubtree(container)
            return container
        }

        override fun getFilter(): Filter {
            return object : Filter() {
                override fun performFiltering(constraint: CharSequence?): FilterResults {
                    val results = FilterResults()
                    val query = constraint?.toString()?.trim().orEmpty()
                    val suggestions = if (query.isEmpty()) {
                        emptyList()
                    } else {
                        OverlayService.getAutocompletePokemonSuggestions(query, leagueProvider(), 20)
                    }
                    results.values = suggestions
                    results.count = suggestions.size
                    return results
                }

                @Suppress("UNCHECKED_CAST")
                override fun publishResults(constraint: CharSequence?, results: FilterResults?) {
                    items = (results?.values as? List<OverlayService.Companion.PokemonAutocompleteSuggestion>) ?: emptyList()
                    if (items.isNotEmpty()) {
                        notifyDataSetChanged()
                    } else {
                        notifyDataSetInvalidated()
                    }
                }

                override fun convertResultToString(resultValue: Any?): CharSequence {
                    return (resultValue as? OverlayService.Companion.PokemonAutocompleteSuggestion)?.name ?: ""
                }
            }
        }
    }

    private fun setupAntiMetaTeamBuilderUi() {
        if (!::spinnerAntiMetaLeague.isInitialized) return
        val leagues = listOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE", "MEGA MASTER LEAGUE")
        spinnerAntiMetaLeague.adapter = createThemedSpinnerAdapter(leagues)

        val antiMetaLeagueProvider = {
            spinnerAntiMetaLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
        }

        fun updateAntiMetaStatusDefaultName() {
            val lg = antiMetaLeagueProvider()
            val defaultTeamName = OverlayService.formatAntiMetaDefaultTeamNameStatic(lg)
            val f1 = editAntiMetaFeat1.text.toString().trim()
            val f2 = editAntiMetaFeat2.text.toString().trim()
            val picks = listOf(f1, f2).filter { it.isNotEmpty() }
            val picksStr = if (picks.isEmpty()) "0 Featured Picks (Full Meta)" else "Featuring: ${picks.joinToString(" + ")}"
            textAntiMetaStatus.text = "Default Team Name: \"$defaultTeamName\" • $picksStr • Tap Generate to rank Best 5 ABB, 5 ABC & 5 Duo-Core options."
        }

        val feat1Adapter = PokemonAutocompleteAdapter(antiMetaLeagueProvider)
        editAntiMetaFeat1.setAdapter(feat1Adapter)
        editAntiMetaFeat1.threshold = 1
        editAntiMetaFeat1.setOnItemClickListener { parent, _, position, _ ->
            val chosen = parent.getItemAtPosition(position) as? OverlayService.Companion.PokemonAutocompleteSuggestion ?: return@setOnItemClickListener
            editAntiMetaFeat1.setText(chosen.name, false)
            updateAntiMetaStatusDefaultName()
            runAntiMetaTeamBuilderGeneration()
        }

        val feat2Adapter = PokemonAutocompleteAdapter(antiMetaLeagueProvider)
        editAntiMetaFeat2.setAdapter(feat2Adapter)
        editAntiMetaFeat2.threshold = 1
        editAntiMetaFeat2.setOnItemClickListener { parent, _, position, _ ->
            val chosen = parent.getItemAtPosition(position) as? OverlayService.Companion.PokemonAutocompleteSuggestion ?: return@setOnItemClickListener
            editAntiMetaFeat2.setText(chosen.name, false)
            updateAntiMetaStatusDefaultName()
            runAntiMetaTeamBuilderGeneration()
        }

        btnClearAntiMetaFeat1.setOnClickListener {
            editAntiMetaFeat1.setText("", false)
            updateAntiMetaStatusDefaultName()
            if (layoutAntiMetaResults.childCount > 0) {
                runAntiMetaTeamBuilderGeneration()
            }
        }

        btnClearAntiMetaFeat2.setOnClickListener {
            editAntiMetaFeat2.setText("", false)
            updateAntiMetaStatusDefaultName()
            if (layoutAntiMetaResults.childCount > 0) {
                runAntiMetaTeamBuilderGeneration()
            }
        }

        spinnerAntiMetaLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val lg = leagues.getOrElse(position) { "GREAT LEAGUE" }
                val top3 = getLeagueTop3Defaults(lg)
                editAntiMetaFeat1.hint = "Featured #1 or Rank Range (e.g. ${top3[0].name}, -10, 100-200, 200-)"
                editAntiMetaFeat2.hint = "Featured #2 or Rank Range (e.g. ${top3[1].name}, -10, 100-200, 200-)"
                updateAntiMetaStatusDefaultName()
                if (layoutAntiMetaResults.childCount > 0) {
                    runAntiMetaTeamBuilderGeneration()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        fun setAntiMetaExpanded(expanded: Boolean) {
            isAntiMetaBodyExpanded = expanded
            cardAntiMetaBuilder.visibility = android.view.View.VISIBLE
            layoutAntiMetaBody.visibility = if (expanded) android.view.View.VISIBLE else android.view.View.GONE
            btnCollapseAntiMetaPanel.text = if (expanded) "Hide ▲" else "Open ▼"
        }

        btnCollapseAntiMetaPanel.setOnClickListener {
            setAntiMetaExpanded(!isAntiMetaBodyExpanded)
        }

        btnToggleAntiMetaBuilder.setOnClickListener {
            if (!isAntiMetaBodyExpanded) {
                setAntiMetaExpanded(true)
            }
            if (layoutAntiMetaResults.childCount == 0) {
                runAntiMetaTeamBuilderGeneration()
            } else {
                Toast.makeText(this, "Anti-Meta Team Builder (ABB, ABC & Duo-Core) ready above your presets!", Toast.LENGTH_SHORT).show()
            }
        }

        btnGenerateAntiMetaTeams.setOnClickListener {
            setAntiMetaExpanded(true)
            runAntiMetaTeamBuilderGeneration()
        }

        updateAntiMetaStatusDefaultName()
    }

    private fun runAntiMetaTeamBuilderGeneration() {
        if (!::spinnerAntiMetaLeague.isInitialized) return
        val lg = spinnerAntiMetaLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
        val f1 = editAntiMetaFeat1.text.toString().trim()
        val f2 = editAntiMetaFeat2.text.toString().trim()
        val f1Range = OverlayService.parseFeaturedRankRangeQueryStatic(f1)
        val f2Range = OverlayService.parseFeaturedRankRangeQueryStatic(f2)
        if (f1.isNotEmpty() && f2.isNotEmpty() && f1Range == null && f2Range == null &&
            OverlayService.Companion.FormResolver.extractBaseSpecies(f1).equals(
                OverlayService.Companion.FormResolver.extractBaseSpecies(f2),
                ignoreCase = true
            )
        ) {
            Toast.makeText(
                this,
                "GBL Species Clause: Featured #1 and #2 cannot share the same base species ($f1 / $f2).",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        val featuredList = listOf(f1, f2).filter { it.isNotEmpty() }
        val preloadedLogs = loadBattleLogs()
        val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedLogs)
        val defaultNamePreview = OverlayService.formatAntiMetaDefaultTeamNameStatic(lg)

        btnGenerateAntiMetaTeams.isEnabled = false
        btnGenerateAntiMetaTeams.text = "⏳ Generating Best 5 ABB, 5 ABC & 5 Duo-Core Teams..."
        textAntiMetaStatus.text = "Simulating $lg Anti-Meta lineups (${if (featuredList.isEmpty()) "0 Featured" else featuredList.joinToString(" + ")})..."

        antiMetaJob?.cancel()
        antiMetaJob = lifecycleScope.launch(Dispatchers.Default) {
            val result = OverlayService.generateAntiMetaTeamOptionsStatic(
                league = lg,
                featuredPokemonNames = featuredList,
                seasonLogs = seasonLogs
            )
            withContext(Dispatchers.Main) {
                btnGenerateAntiMetaTeams.isEnabled = true
                btnGenerateAntiMetaTeams.text = "⚡ Generate Best 5 ABB, 5 ABC & 5 Duo-Core Teams"
                val featLabel = if (result.featuredPokemon.isEmpty()) {
                    "0 Featured Picks (Full Meta)"
                } else {
                    "Featuring ${result.featuredPokemon.joinToString(" + ")}"
                }
                textAntiMetaStatus.text =
                    "✅ Generated Top ${result.top5AbbTeams.size} ABB, Top ${result.top5AbcTeams.size} ABC & Top ${result.top5DuoTeams.size} Duo-Core Teams ($featLabel • ${result.candidatesEvaluated} trios + ${result.movesetCombosSimulated} alt moveset sims in ${result.elapsedMs}ms)\n• ${result.metaSummaryLabel} • Default Name: \"$defaultNamePreview\""
                renderAntiMetaBuilderResults(result)
            }
        }
    }

    private fun renderAntiMetaBuilderResults(result: OverlayService.Companion.AntiMetaTeamBuilderResult) {
        layoutAntiMetaResults.removeAllViews()
        val density = resources.displayMetrics.density
        val activeTheme = getActiveAppTheme()
        val defaultTeamName = OverlayService.formatAntiMetaDefaultTeamNameStatic(result.league)

        fun addSectionHeader(title: String, subtitle: String, titleColor: Int) {
            val hdrBox = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (8 * density).toInt()
                    bottomMargin = (4 * density).toInt()
                }
            }
            val titleTv = TextView(this).apply {
                text = title
                textSize = 12.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(titleColor)
            }
            val subTv = TextView(this).apply {
                text = subtitle
                textSize = 10.5f
                setTextColor(activeTheme.secondaryTextColor)
            }
            hdrBox.addView(titleTv)
            hdrBox.addView(subTv)
            layoutAntiMetaResults.addView(hdrBox)
        }

        fun addOptionCard(opt: OverlayService.Companion.AntiMetaTeamOption) {
            val isAbb = opt.archetype.equals("ABB", ignoreCase = true)
            val isDuo = opt.archetype.equals("DUO", ignoreCase = true)
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(activeTheme.innerCardColor)
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }

            val topRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }

            val (leadTier, leadHex) = getMatchupTierCodeAndHex(opt.leadAggBr)
            val (machTier, machHex) = getMachineBrTierLabelAndHex(opt.machineAggBr)
            val (swapTier, swapHex) = getMatchupTierCodeAndHex(opt.safeSwapBr)
            val (closeTier, closeHex) = getMatchupTierCodeAndHex(opt.closerBr)
            val archHex = when {
                isAbb -> "#fbbf24"
                isDuo -> "#34d399"
                else -> "#38bdf8"
            }
            val altCount = opt.altMovesetSlots.count { it.isAltMoveset }
            val altHeaderBadge = if (altCount > 0) {
                "  •  <font color='#c4b5fd'><b>[⚡ $altCount Alt Moveset${if (altCount > 1) "s" else ""}]</b></font>"
            } else {
                ""
            }

            val badgeTv = TextView(this).apply {
                val html = "<b><font color='$archHex'>[#${opt.rank} ${opt.archetype}]</font></b>  " +
                    "Core: <font color='$machHex'><b>${opt.machineAggBr} ($machTier)</b></font>  •  " +
                    "Beats <b>${opt.topMetaWinsCount}/${opt.topMetaTargetsTotal}</b> Top Meta$altHeaderBadge"
                text = android.text.Html.fromHtml(html, android.text.Html.FROM_HTML_MODE_LEGACY)
                textSize = 11.5f
                setTextColor(activeTheme.primaryTextColor)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }

            val selectBtn = Button(this).apply {
                text = "✅ Use & Edit"
                textSize = 10.5f
                minWidth = 0
                minimumWidth = 0
                val padH = (10 * density).toInt()
                setPadding(padH, 0, padH, 0)
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    (32 * density).toInt()
                )
                setOnClickListener {
                    selectAntiMetaTeamOptionAndOpenEditor(opt)
                }
            }

            topRow.addView(badgeTv)
            topRow.addView(selectBtn)
            card.addView(topRow)

            val roleLabels = when {
                isAbb -> listOf("Lead (A)", "Bait Swap (B1)", "Sweeper (B2)")
                isDuo -> listOf("Lead (Core 1)", "Pivot (Swap)", "Co-Core (Core 2)")
                else -> listOf("Lead", "Safe Swap", "Closer")
            }
            val roleBrHtml = listOf(
                "<font color='$leadHex'>Lead BR ${opt.leadAggBr} ($leadTier)</font>",
                "<font color='$swapHex'>Swap BR ${opt.safeSwapBr} ($swapTier)</font>",
                "<font color='$closeHex'>Closer BR ${opt.closerBr} ($closeTier)</font>"
            )

            val slotsHtml = opt.pokemon.mapIndexed { idx, m ->
                val rLabel = roleLabels.getOrElse(idx) { "Slot ${idx + 1}" }
                val brStr = roleBrHtml.getOrElse(idx) { "" }
                val isFeat = opt.featuredNamesIncluded.any { it.equals(m.name, ignoreCase = true) }
                val featRank = opt.featuredRankMap[m.name]
                val featBadge = if (isFeat) {
                    val rankSuffix = if (featRank != null) " #$featRank" else ""
                    " <font color='#fbbf24'><b>[★ Featured$rankSuffix]</b></font>"
                } else {
                    ""
                }
                val altInfo = opt.altMovesetSlots.getOrNull(idx)
                val isAlt = altInfo?.isAltMoveset == true
                val altBadge = if (isAlt) {
                    val gainVal = kotlin.math.max(altInfo?.roleBrDelta ?: 0, altInfo?.coreBrDelta ?: 0)
                    val gainPart = if (gainVal > 0) " +$gainVal BR" else ""
                    " <font color='#c4b5fd'><b>[⚡ Alt Moveset$gainPart]</b></font>"
                } else {
                    ""
                }
                val movesColor = if (isAlt) "#ddd6fe" else "#cbd5e1"
                val stdNote = if (isAlt && altInfo != null) {
                    " <font color='#94a3b8'><i>(Std: ${altInfo.standardFastMove} + ${altInfo.standardCharged1}/${altInfo.standardCharged2})</i></font>"
                } else {
                    ""
                }
                "• <b>[$rLabel · $brStr]</b> ${m.name}$featBadge$altBadge (CP ${m.cp}) — <font color='$movesColor'><b>${m.fastMove} + ${m.chargedMove1} / ${m.chargedMove2}</b></font>$stdNote"
            }.joinToString("<br>")

            val slotsTv = TextView(this).apply {
                text = android.text.Html.fromHtml(slotsHtml, android.text.Html.FROM_HTML_MODE_LEGACY)
                textSize = 11f
                setTextColor(activeTheme.primaryTextColor)
                setPadding(0, (4 * density).toInt(), 0, (4 * density).toInt())
            }
            card.addView(slotsTv)

            val winsList = if (opt.keyMetaTargetsBeaten.isNotEmpty()) opt.keyMetaTargetsBeaten.take(5).joinToString(", ") else "Balanced neutral coverage"
            val threatsList = if (opt.keyThreats.isNotEmpty()) opt.keyThreats.take(4).joinToString(", ") else "No severe role threats"
            val breakersList = if (opt.coreBreakers.isNotEmpty()) opt.coreBreakers.take(4).joinToString(", ") else "None in Top 50 Meta!"
            val breakersColor = if (opt.coreBreakers.isNotEmpty()) "#fda4af" else "#6ee7b7"

            val breakdownHtml =
                "<font color='#6ee7b7'><b>✅ Key Wins:</b></font> $winsList<br>" +
                "<font color='#fcd34d'><b>⚠️ Key Threats (Slot 1/2/3 BR):</b></font> $threatsList<br>" +
                "<font color='$breakersColor'><b>🚨 Core Breakers (Slot 1/2/3 BR):</b></font> $breakersList"

            val breakdownTv = TextView(this).apply {
                text = android.text.Html.fromHtml(breakdownHtml, android.text.Html.FROM_HTML_MODE_LEGACY)
                textSize = 10.5f
                setTextColor(activeTheme.primaryTextColor)
                setPadding(0, (2 * density).toInt(), 0, (4 * density).toInt())
            }
            card.addView(breakdownTv)

            val summaryTv = TextView(this).apply {
                text = "${opt.synergySummary}\nTap '✅ Use & Edit' to create \"$defaultTeamName\" & open Edit Team screen."
                textSize = 10f
                setTextColor(activeTheme.secondaryTextColor)
            }
            card.addView(summaryTv)

            card.setOnClickListener {
                selectAntiMetaTeamOptionAndOpenEditor(opt)
            }

            layoutAntiMetaResults.addView(card)
        }

        addSectionHeader(
            title = "🛡️ Best 5 ABB Anti-Meta Lineups (Bait & Sweep)",
            subtitle = "Lead (A) covers shared backline weaknesses for Bait Swap (B1) & Sweeper (B2)",
            titleColor = 0xFFFBBF24.toInt()
        )
        result.top5AbbTeams.forEach { addOptionCard(it) }

        addSectionHeader(
            title = "⚔️ Best 5 ABC Anti-Meta Lineups (Balanced Core)",
            subtitle = "Diversified Lead / Safe Swap / Closer anti-meta coverage",
            titleColor = 0xFF38BDF8.toInt()
        )
        result.top5AbcTeams.forEach { addOptionCard(it) }

        if (result.top5DuoTeams.isNotEmpty()) {
            addSectionHeader(
                title = "☯️ Best 5 Duo-Core Anti-Meta Lineups (Yin-Yang 1st ⇄ 3rd + Safe Swap Pivot)",
                subtitle = "1st & 3rd perfectly cover each other's weaknesses (interchangeable 1⇄3 Lead/Closer); 2nd is Safe Swap Pivot",
                titleColor = 0xFF34D399.toInt()
            )
            result.top5DuoTeams.forEach { addOptionCard(it) }
        }

        // Competitive Archetype Playbooks Card (Duo-Core, ABC, ABB)
        addSectionHeader(
            title = "📖 Competitive Archetype Playbooks (PvPoke / Silph Arena / GBL Championship Strategy)",
            subtitle = "How to pilot Duo-Core, ABC, and ABB teams in tournament & ranked play",
            titleColor = 0xFF6EE7B7.toInt()
        )
        val playbookCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(activeTheme.innerCardColor)
            val pad = (10 * density).toInt()
            setPadding(pad, pad, pad, pad)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = (8 * density).toInt()
            }
        }
        val playbookHtml =
            "<b><font color='#34d399'>☯️ DUO-CORE (Yin-Yang 1st & 3rd + 2nd Safe Swap Pivot):</font></b><br>" +
            "Recreates classic symmetric cores (e.g. Swampert/Skarmory, Clodsire/Feraligatr). #1 (Lead) and #3 (Co-Core) cover each other's weaknesses as Yin & Yang opposite attackers—swap #1 ⇄ #3 anytime to adapt to micro-meta shifts. #2 is your Safe Switch Pivot: if you lose lead, swap to #2 to fight for switch advantage or exit with a +1 shield advantage, then bring back #1 or #3 to farm down for loaded energy.<br><br>" +
            "<b><font color='#38bdf8'>⚔️ ABC BALANCED TRIAD (Lead • Safe Swap • Hard Counter Closer):</font></b><br>" +
            "#1 counters most common leads; #2 is your Safe Switch that holds its own across the meta; #3 hard-counters whatever your Lead loses to. When losing lead, pivot to #2 to soak damage, burn opponent shields, and either flip switch or soft-lose so #1 or #3 can farm down.<br><br>" +
            "<b><font color='#fbbf24'>🛡️ ABB BAIT & SWEEP (Protector Lead A • Bait Swap B1 • Sweeper B2):</font></b><br>" +
            "Runs two similar backline counters (B1 & B2) protected by #1 Lead (A). If your Lead faces a threat to your backline, stay in at all costs. If your Lead faces a neutral/bad matchup, chip and immediately swap to #2 (B1) to lure out the opponent's backline counter, eliminate it with #1 (A), and sweep with #3 (B2) once the counter is gone."
        val playbookTv = TextView(this).apply {
            text = android.text.Html.fromHtml(playbookHtml, android.text.Html.FROM_HTML_MODE_LEGACY)
            textSize = 10.5f
            setTextColor(activeTheme.primaryTextColor)
        }
        playbookCard.addView(playbookTv)
        layoutAntiMetaResults.addView(playbookCard)

        val bottomMetaList = result.top50MetaList.ifEmpty { result.top25MetaList }
        if (bottomMetaList.isNotEmpty()) {
            addSectionHeader(
                title = "🎯 Top ${bottomMetaList.size} ${result.league} Meta Determined by SilphScope (Meta Battle Ranking in Parentheses • #1–#50 = /50 Audit Pool)",
                subtitle = "Teams are built & scored against the full Top-100 role-weighted synthetic meta + season logs",
                titleColor = 0xFFC4B5FD.toInt()
            )
            val metaCard = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(activeTheme.innerCardColor)
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }
            val top50Html = bottomMetaList.joinToString("  •  ") { entry ->
                val rankColor = if (entry.rank <= 25) "#38bdf8" else "#c4b5fd"
                "<b><font color='$rankColor'>#${entry.rank}</font> ${entry.name}</b> <font color='#94a3b8'>(${entry.metaBr} BR • ${String.format(java.util.Locale.US, "%.1f", entry.weightPct)}%)</font>"
            }
            val metaTv = TextView(this).apply {
                text = android.text.Html.fromHtml(top50Html, android.text.Html.FROM_HTML_MODE_LEGACY)
                textSize = 10.5f
                setTextColor(activeTheme.primaryTextColor)
            }
            metaCard.addView(metaTv)
            layoutAntiMetaResults.addView(metaCard)
        }
    }

    private fun selectAntiMetaTeamOptionAndOpenEditor(option: OverlayService.Companion.AntiMetaTeamOption) {
        val defaultName = OverlayService.formatAntiMetaDefaultTeamNameStatic(option.league)
        val slots = option.pokemon.map {
            PokemonSlot(
                name = it.name,
                cp = it.cp,
                fastMove = it.fastMove,
                chargedMove1 = it.chargedMove1,
                chargedMove2 = it.chargedMove2,
                ivs = it.ivs
            )
        }
        val rawPreset = TeamPreset(
            id = UUID.randomUUID().toString(),
            name = defaultName,
            league = option.league,
            pokemon = slots,
            isSelected = true,
            updatedAt = System.currentTimeMillis(),
            archetype = option.archetype,
            isArchetypeManual = true,
            leadAggBr = option.leadAggBr,
            machineAggBr = option.machineAggBr,
            safeSwapBr = option.safeSwapBr,
            closerSwapBr = option.closerSwapBr,
            closerBr = option.closerBr,
            sharedWeaknesses = option.sharedWeaknesses,
            topMetaTargetsTotal = option.topMetaTargetsTotal,
            topMetaWinsCount = option.topMetaWinsCount,
            keyMetaTargetsBeaten = option.keyMetaTargetsBeaten,
            keyThreats = option.keyThreats,
            coreBreakers = option.coreBreakers,
            altMovesetSlots = option.altMovesetSlots,
            synergySummary = option.synergySummary
        )
        val createdPreset = evaluatePresetMetrics(rawPreset, autoReorder = false)

        val list = loadPresets().toMutableList()
        list.add(0, createdPreset)
        savePresets(list)
        setSelectedPreset(createdPreset.id)
        setupBattleLogFilters()
        triggerTwoDeviceCloudSync(silent = true)

        Toast.makeText(
            this,
            "Created '${createdPreset.name}' (${createdPreset.archetype} • Core BR ${createdPreset.machineAggBr}) — opening Edit Team!",
            Toast.LENGTH_SHORT
        ).show()

        // Requirement 2c: Open immediately to Edit Team screen for user to modify like any other team
        showPresetEditorDialog(createdPreset)
    }

    private fun showPresetEditorDialog(existingPreset: TeamPreset?) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_preset, null)
        val editName = dialogView.findViewById<EditText>(R.id.edit_preset_name)
        val spinnerLeague = dialogView.findViewById<Spinner>(R.id.spinner_league)

        val editP1 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p1_name)
        val editP1Cp = dialogView.findViewById<EditText>(R.id.edit_p1_cp)
        val editP1Ivs = dialogView.findViewById<EditText>(R.id.edit_p1_ivs)
        val editP1Fast = dialogView.findViewById<EditText>(R.id.edit_p1_fast)
        val editP1C1 = dialogView.findViewById<EditText>(R.id.edit_p1_c1)
        val editP1C2 = dialogView.findViewById<EditText>(R.id.edit_p1_c2)

        val editP2 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p2_name)
        val editP2Cp = dialogView.findViewById<EditText>(R.id.edit_p2_cp)
        val editP2Ivs = dialogView.findViewById<EditText>(R.id.edit_p2_ivs)
        val editP2Fast = dialogView.findViewById<EditText>(R.id.edit_p2_fast)
        val editP2C1 = dialogView.findViewById<EditText>(R.id.edit_p2_c1)
        val editP2C2 = dialogView.findViewById<EditText>(R.id.edit_p2_c2)

        val editP3 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p3_name)
        val editP3Cp = dialogView.findViewById<EditText>(R.id.edit_p3_cp)
        val editP3Ivs = dialogView.findViewById<EditText>(R.id.edit_p3_ivs)
        val editP3Fast = dialogView.findViewById<EditText>(R.id.edit_p3_fast)
        val editP3C1 = dialogView.findViewById<EditText>(R.id.edit_p3_c1)
        val editP3C2 = dialogView.findViewById<EditText>(R.id.edit_p3_c2)

        val leagues = listOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE", "MEGA MASTER LEAGUE")
        spinnerLeague.adapter = createThemedSpinnerAdapter(leagues)

        val currentLeagueProvider = {
            spinnerLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
        }

        // Apply active theme & optional background watermark logo to the Team Edit dialog FIRST
        val activeTheme = getActiveAppTheme()
        val watermarkPrefEnabled = prefs.getBoolean(OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK, true)
        val activeEmblemRes = activeTheme.emblemDrawableRes
        val showWatermark = watermarkPrefEnabled && activeEmblemRes != null
        dialogView.findViewById<android.view.View>(R.id.root_preset_dialog_frame)?.setBackgroundColor(activeTheme.bgColor)
        dialogView.findViewById<ImageView>(R.id.iv_preset_dialog_watermark)?.let { iv ->
            if (watermarkPrefEnabled && activeEmblemRes != null) {
                iv.setImageResource(activeEmblemRes)
                iv.alpha = if (activeTheme.isLight) 0.24f else 0.20f
                iv.visibility = android.view.View.VISIBLE
            } else {
                iv.visibility = android.view.View.GONE
            }
        }
        applyThemeRecursively(dialogView, activeTheme, showWatermark)

        // Team Style (ABB vs ABC), Style Mode Override, Aggregate BR & Slot Swap Views
        val textDialogArchetypeBadge = dialogView.findViewById<TextView>(R.id.text_dialog_archetype_badge)
        val textDialogLeadBrBadge = dialogView.findViewById<TextView>(R.id.text_dialog_lead_br_badge)
        val textDialogMachBrBadge = dialogView.findViewById<TextView>(R.id.text_dialog_mach_br_badge)
        val btnModeAuto = dialogView.findViewById<Button>(R.id.btn_mode_auto)
        val btnModeAbb = dialogView.findViewById<Button>(R.id.btn_mode_abb)
        val btnModeAbc = dialogView.findViewById<Button>(R.id.btn_mode_abc)
        val btnModeDuo = dialogView.findViewById<Button>(R.id.btn_mode_duo)
        val textDialogArchetypeSummary = dialogView.findViewById<TextView>(R.id.text_dialog_archetype_summary)
        val textDialogMetaBlendInfo = dialogView.findViewById<TextView>(R.id.text_dialog_meta_blend_info)
        val textDialogAutoDetectBanner = dialogView.findViewById<TextView>(R.id.text_dialog_autodetect_banner)
        val btnDialogAutoDetect = dialogView.findViewById<Button>(R.id.btn_dialog_auto_detect_style)
        val btnDialogSuggestUpgrades = dialogView.findViewById<Button>(R.id.btn_dialog_suggest_upgrades)
        val btnDialogOptimizeMovesets = dialogView.findViewById<Button>(R.id.btn_dialog_optimize_movesets)
        val btnSwapSlot12 = dialogView.findViewById<Button>(R.id.btn_swap_slot_1_2)
        val btnSwapSlot23 = dialogView.findViewById<Button>(R.id.btn_swap_slot_2_3)
        val btnSwapSlot13 = dialogView.findViewById<Button>(R.id.btn_swap_slot_1_3)
        val textP1RoleTitle = dialogView.findViewById<TextView>(R.id.text_p1_role_title)
        val textP2RoleTitle = dialogView.findViewById<TextView>(R.id.text_p2_role_title)
        val textP3RoleTitle = dialogView.findViewById<TextView>(R.id.text_p3_role_title)
        val textP1LeadBr = dialogView.findViewById<TextView>(R.id.text_p1_lead_br)
        val textP2SwapBr = dialogView.findViewById<TextView>(R.id.text_p2_swap_br)
        val textP3SwapBr = dialogView.findViewById<TextView>(R.id.text_p3_swap_br)
        val btnP1AutoFillMoves = dialogView.findViewById<Button>(R.id.btn_p1_autofill_moves)
        val btnP2AutoFillMoves = dialogView.findViewById<Button>(R.id.btn_p2_autofill_moves)
        val btnP3AutoFillMoves = dialogView.findViewById<Button>(R.id.btn_p3_autofill_moves)
        val layoutP1Recs = dialogView.findViewById<LinearLayout>(R.id.layout_p1_recommendations)
        val layoutP2Recs = dialogView.findViewById<LinearLayout>(R.id.layout_p2_recommendations)
        val layoutP3Recs = dialogView.findViewById<LinearLayout>(R.id.layout_p3_recommendations)
        val textP1RecHeader = dialogView.findViewById<TextView>(R.id.text_p1_rec_header)
        val textP2RecHeader = dialogView.findViewById<TextView>(R.id.text_p2_rec_header)
        val textP3RecHeader = dialogView.findViewById<TextView>(R.id.text_p3_rec_header)
        val btnP1Recs = listOf(
            dialogView.findViewById<Button>(R.id.btn_p1_rec_1),
            dialogView.findViewById<Button>(R.id.btn_p1_rec_2),
            dialogView.findViewById<Button>(R.id.btn_p1_rec_3),
            dialogView.findViewById<Button>(R.id.btn_p1_rec_4),
            dialogView.findViewById<Button>(R.id.btn_p1_rec_5)
        )
        val btnP2Recs = listOf(
            dialogView.findViewById<Button>(R.id.btn_p2_rec_1),
            dialogView.findViewById<Button>(R.id.btn_p2_rec_2),
            dialogView.findViewById<Button>(R.id.btn_p2_rec_3),
            dialogView.findViewById<Button>(R.id.btn_p2_rec_4),
            dialogView.findViewById<Button>(R.id.btn_p2_rec_5)
        )
        val btnP3Recs = listOf(
            dialogView.findViewById<Button>(R.id.btn_p3_rec_1),
            dialogView.findViewById<Button>(R.id.btn_p3_rec_2),
            dialogView.findViewById<Button>(R.id.btn_p3_rec_3),
            dialogView.findViewById<Button>(R.id.btn_p3_rec_4),
            dialogView.findViewById<Button>(R.id.btn_p3_rec_5)
        )

        var dialogManualArchetypeOverride: String? =
            if (existingPreset?.isArchetypeManual == true) existingPreset.archetype else null

        fun updateStyleModeButtonsUi() {
            val activeTint = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
            val activeAbbTint = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
            val activeDuoTint = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
            val inactiveTint = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
            val activeText = 0xFFFFFFFF.toInt()
            val inactiveText = 0xFFCBD5E1.toInt()

            val isAuto = dialogManualArchetypeOverride == null
            val isAbb = dialogManualArchetypeOverride.equals("ABB", ignoreCase = true)
            val isAbc = dialogManualArchetypeOverride.equals("ABC", ignoreCase = true)
            val isDuo = dialogManualArchetypeOverride.equals("DUO", ignoreCase = true)

            btnModeAuto?.backgroundTintList = if (isAuto) activeTint else inactiveTint
            btnModeAuto?.setTextColor(if (isAuto) activeText else inactiveText)

            btnModeAbb?.backgroundTintList = if (isAbb) activeAbbTint else inactiveTint
            btnModeAbb?.setTextColor(if (isAbb) activeText else inactiveText)

            btnModeAbc?.backgroundTintList = if (isAbc) activeTint else inactiveTint
            btnModeAbc?.setTextColor(if (isAbc) activeText else inactiveText)

            btnModeDuo?.backgroundTintList = if (isDuo) activeDuoTint else inactiveTint
            btnModeDuo?.setTextColor(if (isDuo) activeText else inactiveText)
        }

        fun buildResolvedSlot(
            nameEdit: EditText,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText,
            league: String,
            fallbackSlot: PokemonSlot
        ): PokemonSlot {
            val finalName = nameEdit.text.toString().trim().ifEmpty { fallbackSlot.name }
            val enteredIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
            val recMeta = OverlayService.resolveRecommendedMovesForSpecies(finalName, league)
            val enteredCp = cpEdit.text.toString().trim().toIntOrNull()
            val scaledMeta = recMeta?.let {
                OverlayService.computeEffectiveCombatStats(it, league, enteredCp, enteredIvs)
            }

            val finalCp = enteredCp ?: scaledMeta?.defaultCp ?: fallbackSlot.cp
            val finalFast = fastEdit.text.toString().trim().ifEmpty {
                scaledMeta?.defaultFastMove ?: fallbackSlot.fastMove
            }
            val finalC1 = c1Edit.text.toString().trim().ifEmpty {
                scaledMeta?.chargedMove1 ?: fallbackSlot.chargedMove1
            }
            val finalC2 = c2Edit.text.toString().trim().ifEmpty {
                scaledMeta?.chargedMove2 ?: fallbackSlot.chargedMove2
            }

            return PokemonSlot(
                name = finalName,
                cp = finalCp,
                fastMove = finalFast,
                chargedMove1 = finalC1,
                chargedMove2 = finalC2,
                ivs = enteredIvs
            )
        }

        fun applySlotsToDialogInputs(slots: List<PokemonSlot>) {
            slots.getOrNull(0)?.let {
                editP1.setText(it.name, false)
                editP1Cp.setText(it.cp.toString())
                editP1Ivs.setText(it.ivs ?: "")
                editP1Fast.setText(it.fastMove)
                editP1C1.setText(it.chargedMove1)
                editP1C2.setText(it.chargedMove2)
            }
            slots.getOrNull(1)?.let {
                editP2.setText(it.name, false)
                editP2Cp.setText(it.cp.toString())
                editP2Ivs.setText(it.ivs ?: "")
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
            }
            slots.getOrNull(2)?.let {
                editP3.setText(it.name, false)
                editP3Cp.setText(it.cp.toString())
                editP3Ivs.setText(it.ivs ?: "")
                editP3Fast.setText(it.fastMove)
                editP3C1.setText(it.chargedMove1)
                editP3C2.setText(it.chargedMove2)
            }
        }

        val preloadedDialogLogs = loadBattleLogs()

        fun refreshDialogTeamEvaluation(autoReorder: Boolean): OverlayService.Companion.TeamArchetypeEvaluationResult {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val eval = OverlayService.evaluateOrAutoOrderTeamStatic(
                slots = listOf(
                    OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs),
                    OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs),
                    OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs)
                ),
                league = lg,
                seasonLogs = seasonLogs,
                autoReorder = autoReorder,
                manualArchetypeOverride = dialogManualArchetypeOverride
            )
            if (autoReorder) {
                val orderedSlots = eval.orderedSlots.map {
                    PokemonSlot(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
                }
                applySlotsToDialogInputs(orderedSlots)
            }

            updateStyleModeButtonsUi()

            val isAbb = eval.archetype.equals("ABB", ignoreCase = true)
            val isDuo = eval.archetype.equals("DUO", ignoreCase = true)
            val (leadTier, leadHex) = getMatchupTierCodeAndHex(eval.leadAggBr)
            val (machTier, machHex) = getMachineBrTierLabelAndHex(eval.machineAggBr)
            val (swap2Tier, swap2Hex) = getMatchupTierCodeAndHex(eval.safeSwapBr)
            val (swap3Tier, swap3Hex) = getMatchupTierCodeAndHex(eval.closerSwapBr)
            val (closeTier, closeHex) = getMatchupTierCodeAndHex(eval.closerBr)

            val overrideSuffix = if (dialogManualArchetypeOverride != null) " • OVERRIDDEN" else ""
            textDialogArchetypeBadge?.text = "Style: [${eval.archetype}$overrideSuffix]"
            textDialogArchetypeBadge?.setTextColor(
                when {
                    isAbb -> 0xFFFBBF24.toInt()
                    isDuo -> 0xFF34D399.toInt()
                    else -> 0xFF38BDF8.toInt()
                }
            )

            textDialogLeadBrBadge?.text = "Lead BR: ${eval.leadAggBr} ($leadTier)"
            textDialogLeadBrBadge?.setTextColor(android.graphics.Color.parseColor(leadHex))

            val targetTotal = eval.topMetaTargetsTotal.takeIf { it > 0 } ?: 50
            textDialogMachBrBadge?.text = "Core: ${eval.machineAggBr} ($machTier) • Beats ${eval.topMetaWinsCount}/$targetTotal Meta"
            textDialogMachBrBadge?.setTextColor(android.graphics.Color.parseColor(machHex))

            val weakHtml = if (eval.sharedWeaknesses.isNotEmpty()) {
                if (isDuo) {
                    "  •  <font color='#34d399'>☯️ 1⇄3 Core Coverage: ${eval.sharedWeaknesses.joinToString(", ").uppercase()}</font>"
                } else {
                    "  •  <font color='#fbbf24'>Shared B-Pair Weaknesses: ${eval.sharedWeaknesses.joinToString(", ").uppercase()}</font>"
                }
            } else {
                ""
            }
            val altSlotsActive = eval.altMovesetSlots.filter { it.isAltMoveset }
            val altHtml = if (altSlotsActive.isNotEmpty()) {
                "  •  <font color='#c4b5fd'><b>[⚡ ${altSlotsActive.size} Alt Moveset${if (altSlotsActive.size > 1) "s" else ""}]</b></font>"
            } else {
                ""
            }
            val winsList = if (eval.keyMetaTargetsBeaten.isNotEmpty()) eval.keyMetaTargetsBeaten.take(5).joinToString(", ") else "Broad neutral coverage"
            val threatsList = if (eval.keyThreats.isNotEmpty()) eval.keyThreats.take(4).joinToString(", ") else "No severe role threats"
            val breakersList = if (eval.coreBreakers.isNotEmpty()) eval.coreBreakers.take(4).joinToString(", ") else "None in Top $targetTotal Meta!"
            val breakersColor = if (eval.coreBreakers.isNotEmpty()) "#fda4af" else "#6ee7b7"

            val summaryHtml = "Slot 2 Swap BR: <font color='$swap2Hex'>${eval.safeSwapBr} ($swap2Tier)</font>  •  " +
                "Slot 3 Swap BR: <font color='$swap3Hex'>${eval.closerSwapBr} ($swap3Tier)</font>  •  " +
                "Closer BR: <font color='$closeHex'>${eval.closerBr} ($closeTier)</font>$weakHtml$altHtml<br>" +
                "<font color='#6ee7b7'><b>✅ Key Wins:</b></font> $winsList<br>" +
                "<font color='#fcd34d'><b>⚠️ Key Threats (Slot 1/2/3 BR):</b></font> $threatsList<br>" +
                "<font color='$breakersColor'><b>🚨 Core Breakers (Slot 1/2/3 BR):</b></font> $breakersList<br>" +
                "<font color='#94a3b8'><i>${eval.synergySummary}</i></font>"
            textDialogArchetypeSummary?.text = android.text.Html.fromHtml(summaryHtml, android.text.Html.FROM_HTML_MODE_LEGACY)

            textDialogMetaBlendInfo?.text =
                "Current Season Meta Blend: ${eval.histWeightPct}% Recency-Weighted Logs (${eval.seasonMatchCount} matches) / ${100 - eval.histWeightPct}% PvPoke"

            val alt1Tag = if (eval.altMovesetSlots.getOrNull(0)?.isAltMoveset == true) " ⚡Alt" else ""
            val alt2Tag = if (eval.altMovesetSlots.getOrNull(1)?.isAltMoveset == true) " ⚡Alt" else ""
            val alt3Tag = if (eval.altMovesetSlots.getOrNull(2)?.isAltMoveset == true) " ⚡Alt" else ""
            textP1RoleTitle?.text = when {
                isAbb -> "⚔️ Slot 1 (Lead A) & Moveset"
                isDuo -> "☯️ Slot 1 (Core 1 Lead) & Moveset"
                else -> "⚔️ Slot 1 (Lead) & Moveset"
            } + alt1Tag
            textP2RoleTitle?.text = when {
                isAbb -> "🔄 Slot 2 (Bait Swap B1) & Moveset"
                isDuo -> "🔄 Slot 2 (Safe Swap Pivot) & Moveset"
                else -> "🔄 Slot 2 (Safe Swap) & Moveset"
            } + alt2Tag
            textP3RoleTitle?.text = when {
                isAbb -> "🛡️ Slot 3 (Sweeper B2) & Moveset"
                isDuo -> "☯️ Slot 3 (Core 2 Co-Core) & Moveset"
                else -> "🛡️ Slot 3 (Closer) & Moveset"
            } + alt3Tag

            textP1LeadBr?.text = "Lead BR: ${eval.leadAggBr} ($leadTier)"
            textP1LeadBr?.setTextColor(android.graphics.Color.parseColor(leadHex))

            textP2SwapBr?.text = "Swap BR: ${eval.safeSwapBr} ($swap2Tier)"
            textP2SwapBr?.setTextColor(android.graphics.Color.parseColor(swap2Hex))

            textP3SwapBr?.text = "Closer BR: ${eval.closerBr} ($closeTier)"
            textP3SwapBr?.setTextColor(android.graphics.Color.parseColor(closeHex))

            return eval
        }

        fun bindSlotAutocomplete(
            nameAuto: AutoCompleteTextView,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText
        ) {
            val adapter = PokemonAutocompleteAdapter(currentLeagueProvider)
            nameAuto.setAdapter(adapter)
            nameAuto.threshold = 1
            nameAuto.setOnItemClickListener { parent, _, position, _ ->
                val chosen = parent.getItemAtPosition(position) as? OverlayService.Companion.PokemonAutocompleteSuggestion ?: return@setOnItemClickListener
                nameAuto.setText(chosen.name, false)
                val customIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
                val rec = OverlayService.resolveRecommendedMovesForSpecies(chosen.name, currentLeagueProvider())
                if (rec != null) {
                    val scaled = OverlayService.computeEffectiveCombatStats(rec, currentLeagueProvider(), null, customIvs)
                    fastEdit.setText(scaled.defaultFastMove)
                    c1Edit.setText(scaled.chargedMove1)
                    c2Edit.setText(scaled.chargedMove2)
                    cpEdit.setText(scaled.defaultCp.toString())
                } else {
                    fastEdit.setText(chosen.fastMove)
                    c1Edit.setText(chosen.chargedMove1)
                    c2Edit.setText(chosen.chargedMove2)
                    cpEdit.setText(chosen.cp.toString())
                }
                refreshDialogTeamEvaluation(autoReorder = false)
            }
        }

        bindSlotAutocomplete(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2)
        bindSlotAutocomplete(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2)
        bindSlotAutocomplete(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2)

        fun updateLeagueTemplateHints(selectedLeague: String) {
            val top3 = getLeagueTop3Defaults(selectedLeague)
            editP1.hint = "Name (e.g. ${top3[0].name})"
            editP2.hint = "Name (e.g. ${top3[1].name})"
            editP3.hint = "Name (e.g. ${top3[2].name})"
            val ivHint = if (selectedLeague.contains("MASTER", ignoreCase = true)) "IVs (def 15/15/15)" else "IVs (PvPoke def)"
            editP1Ivs.hint = ivHint
            editP2Ivs.hint = ivHint
            editP3Ivs.hint = ivHint
        }

        fun autoFillMovesForSlot(
            nameEdit: EditText,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText,
            forceOverwrite: Boolean = false
        ) {
            val enteredName = nameEdit.text.toString().trim()
            if (enteredName.isEmpty()) return
            val selectedLeague = currentLeagueProvider()
            val rec = OverlayService.resolveRecommendedMovesForSpecies(enteredName, selectedLeague) ?: return
            val customIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
            val scaled = OverlayService.computeEffectiveCombatStats(rec, selectedLeague, null, customIvs)

            if (forceOverwrite) {
                nameEdit.setText(rec.name)
            }
            if (forceOverwrite || fastEdit.text.toString().trim().isEmpty()) {
                fastEdit.setText(scaled.defaultFastMove)
            }
            if (forceOverwrite || c1Edit.text.toString().trim().isEmpty()) {
                c1Edit.setText(scaled.chargedMove1)
            }
            if (forceOverwrite || c2Edit.text.toString().trim().isEmpty()) {
                c2Edit.setText(scaled.chargedMove2)
            }
            if (forceOverwrite || cpEdit.text.toString().trim().isEmpty()) {
                cpEdit.setText(scaled.defaultCp.toString())
            }
            refreshDialogTeamEvaluation(autoReorder = false)
        }

        editP1.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, false)
        }
        editP2.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, false)
        }
        editP3.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, false)
        }

        listOf(
            editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2,
            editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2,
            editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2
        ).forEach { field ->
            field.setOnFocusChangeListener { _, hasFocus ->
                if (!hasFocus) refreshDialogTeamEvaluation(autoReorder = false)
            }
        }

        btnP1AutoFillMoves?.setOnClickListener {
            autoFillMovesForSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, forceOverwrite = true)
        }
        btnP2AutoFillMoves?.setOnClickListener {
            autoFillMovesForSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, forceOverwrite = true)
        }
        btnP3AutoFillMoves?.setOnClickListener {
            autoFillMovesForSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, forceOverwrite = true)
        }

        if (existingPreset != null) {
            editName.setText(existingPreset.name)
            val leagueIdx = leagues.indexOfFirst { existingPreset.league.equals(it, ignoreCase = true) }
                .takeIf { it >= 0 } ?: 0
            spinnerLeague.setSelection(leagueIdx)
            updateLeagueTemplateHints(leagues[leagueIdx])

            existingPreset.pokemon.getOrNull(0)?.let {
                editP1.setText(it.name, false)
                editP1Cp.setText(it.cp.toString())
                editP1Ivs.setText(it.ivs ?: "")
                editP1Fast.setText(it.fastMove)
                editP1C1.setText(it.chargedMove1)
                editP1C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(1)?.let {
                editP2.setText(it.name, false)
                editP2Cp.setText(it.cp.toString())
                editP2Ivs.setText(it.ivs ?: "")
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(2)?.let {
                editP3.setText(it.name, false)
                editP3Cp.setText(it.cp.toString())
                editP3Ivs.setText(it.ivs ?: "")
                editP3Fast.setText(it.fastMove)
                editP3C1.setText(it.chargedMove1)
                editP3C2.setText(it.chargedMove2)
            }
        } else {
            updateLeagueTemplateHints("GREAT LEAGUE")
        }

        spinnerLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val lg = leagues.getOrElse(position) { "GREAT LEAGUE" }
                updateLeagueTemplateHints(lg)
                refreshDialogTeamEvaluation(autoReorder = false)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        btnModeAuto?.setOnClickListener {
            dialogManualArchetypeOverride = null
            textDialogAutoDetectBanner?.visibility = android.view.View.GONE
            refreshDialogTeamEvaluation(autoReorder = false)
        }
        btnModeAbb?.setOnClickListener {
            dialogManualArchetypeOverride = "ABB"
            textDialogAutoDetectBanner?.visibility = android.view.View.GONE
            refreshDialogTeamEvaluation(autoReorder = false)
        }
        btnModeAbc?.setOnClickListener {
            dialogManualArchetypeOverride = "ABC"
            textDialogAutoDetectBanner?.visibility = android.view.View.GONE
            refreshDialogTeamEvaluation(autoReorder = false)
        }
        btnModeDuo?.setOnClickListener {
            dialogManualArchetypeOverride = "DUO"
            textDialogAutoDetectBanner?.visibility = android.view.View.GONE
            refreshDialogTeamEvaluation(autoReorder = false)
        }

        btnDialogAutoDetect?.setOnClickListener {
            dialogManualArchetypeOverride = null
            val eval = refreshDialogTeamEvaluation(autoReorder = true)
            textDialogAutoDetectBanner?.text = "${eval.reasonSummary}\n${eval.synergySummary}"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
            Toast.makeText(
                this,
                "Updated Team Summary (${eval.archetype} • Beats ${eval.topMetaWinsCount}/${eval.topMetaTargetsTotal} Meta)!",
                Toast.LENGTH_LONG
            ).show()
        }

        btnSwapSlot12?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            applySlotsToDialogInputs(listOf(s2, s1, s3))
            val eval = refreshDialogTeamEvaluation(autoReorder = false)
            textDialogAutoDetectBanner?.text =
                "Swapped Slot 1 ⇄ Slot 2: #1 Lead ${s2.name} (Lead BR ${eval.leadAggBr}) • #2 Safe Swap ${s1.name} (Swap BR ${eval.safeSwapBr})"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
        }

        btnSwapSlot23?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            applySlotsToDialogInputs(listOf(s1, s3, s2))
            val eval = refreshDialogTeamEvaluation(autoReorder = false)
            textDialogAutoDetectBanner?.text =
                "Swapped Slot 2 ⇄ Slot 3: #2 Safe Swap ${s3.name} (Swap BR ${eval.safeSwapBr}) • #3 Closer ${s2.name} (Swap BR ${eval.closerSwapBr})"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
        }

        btnSwapSlot13?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            applySlotsToDialogInputs(listOf(s3, s2, s1))
            val eval = refreshDialogTeamEvaluation(autoReorder = false)
            textDialogAutoDetectBanner?.text =
                "☯️ Duo-Core Swap Slot 1 ⇄ Slot 3: #1 Lead ${s3.name} (Lead BR ${eval.leadAggBr}) • #2 Pivot ${s2.name} (Swap BR ${eval.safeSwapBr}) • #3 Co-Core ${s1.name} (Closer BR ${eval.closerBr})"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
        }

        var roleUpgradeJob: kotlinx.coroutines.Job? = null
        fun runTop100RoleUpgradesSimulation(showBannerOnComplete: Boolean) {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val manualArch = dialogManualArchetypeOverride

            btnDialogSuggestUpgrades?.isEnabled = false
            btnDialogSuggestUpgrades?.text = "⏳ Simulating Top-200 Meta for Role Upgrades..."

            roleUpgradeJob?.cancel()
            roleUpgradeJob = lifecycleScope.launch(Dispatchers.Default) {
                val recResult = OverlayService.recommendTop3UpgradesPerRoleStatic(
                    slots = listOf(
                        OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs),
                        OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs),
                        OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs)
                    ),
                    league = lg,
                    seasonLogs = seasonLogs,
                    manualArchetypeOverride = manualArch
                )

                withContext(Dispatchers.Main) {
                    btnDialogSuggestUpgrades?.isEnabled = true
                    btnDialogSuggestUpgrades?.text = "✨ Refresh Top-200 Role Upgrades (5 Per Role)"

                    fun formatSignedDelta(delta: Int): String = if (delta >= 0) "+$delta" else "$delta"

                    fun bindRoleUpgradeChips(
                        slotIndex: Int,
                        roleLabel: String,
                        roleMetricName: String,
                        container: LinearLayout?,
                        headerView: TextView?,
                        buttons: List<Button?>,
                        upgrades: List<OverlayService.Companion.RoleUpgradeSuggestion>
                    ) {
                        if (upgrades.isEmpty()) {
                            container?.visibility = android.view.View.GONE
                            return
                        }
                        container?.visibility = android.view.View.VISIBLE
                        headerView?.text = "✨ Top 5 $roleLabel Upgrades (Top-200 Meta • Tap to Replace Slot ${slotIndex + 1}):"
                        buttons.forEachIndexed { idx, btn ->
                            val upg = upgrades.getOrNull(idx)
                            if (upg == null) {
                                btn?.visibility = android.view.View.GONE
                            } else {
                                btn?.visibility = android.view.View.VISIBLE
                                val cand = upg.candidate
                                val machDeltaStr = formatSignedDelta(upg.machineBrDelta)
                                val roleDeltaStr = formatSignedDelta(upg.roleBrDelta)
                                btn?.text = "${idx + 1}. ${cand.name} (${cand.fastMove} / ${cand.chargedMove1} + ${cand.chargedMove2})  •  Core ${upg.newMachineAggBr} ($machDeltaStr) • $roleMetricName ${upg.newRoleBr} ($roleDeltaStr)"
                                btn?.setOnClickListener {
                                    val newSlot = PokemonSlot(
                                        name = cand.name,
                                        cp = cand.cp,
                                        fastMove = cand.fastMove,
                                        chargedMove1 = cand.chargedMove1,
                                        chargedMove2 = cand.chargedMove2,
                                        ivs = cand.ivs
                                    )
                                    val curLg = currentLeagueProvider()
                                    val curDefs = getLeagueTop3Defaults(curLg)
                                    val cur1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, curLg, curDefs[0])
                                    val cur2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, curLg, curDefs[1])
                                    val cur3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, curLg, curDefs[2])
                                    val replacedName = when (slotIndex) {
                                        0 -> cur1.name
                                        1 -> cur2.name
                                        else -> cur3.name
                                    }
                                    val updatedSlots = listOf(
                                        if (slotIndex == 0) newSlot else cur1,
                                        if (slotIndex == 1) newSlot else cur2,
                                        if (slotIndex == 2) newSlot else cur3
                                    )
                                    applySlotsToDialogInputs(updatedSlots)
                                    val evalAfter = refreshDialogTeamEvaluation(autoReorder = false)
                                    textDialogAutoDetectBanner?.text =
                                        "Replaced Slot ${slotIndex + 1} ($replacedName → ${cand.name}): Core BR ${evalAfter.machineAggBr} ($machDeltaStr) • ${upg.synergyTag}"
                                    textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
                                    runTop100RoleUpgradesSimulation(showBannerOnComplete = false)
                                }
                            }
                        }
                    }

                    bindRoleUpgradeChips(
                        slotIndex = 0,
                        roleLabel = "Lead",
                        roleMetricName = "Lead BR",
                        container = layoutP1Recs,
                        headerView = textP1RecHeader,
                        buttons = btnP1Recs,
                        upgrades = recResult.leadUpgrades
                    )
                    bindRoleUpgradeChips(
                        slotIndex = 1,
                        roleLabel = "Safe Swap",
                        roleMetricName = "Swap BR",
                        container = layoutP2Recs,
                        headerView = textP2RecHeader,
                        buttons = btnP2Recs,
                        upgrades = recResult.safeSwapUpgrades
                    )
                    bindRoleUpgradeChips(
                        slotIndex = 2,
                        roleLabel = "Closer",
                        roleMetricName = "Closer BR",
                        container = layoutP3Recs,
                        headerView = textP3RecHeader,
                        buttons = btnP3Recs,
                        upgrades = recResult.closerUpgrades
                    )

                    if (showBannerOnComplete) {
                        val bestLead = recResult.leadUpgrades.firstOrNull()?.candidate?.name ?: "—"
                        val bestSwap = recResult.safeSwapUpgrades.firstOrNull()?.candidate?.name ?: "—"
                        val bestCloser = recResult.closerUpgrades.firstOrNull()?.candidate?.name ?: "—"
                        textDialogAutoDetectBanner?.text =
                            "Top-200 Meta Sim (${recResult.candidatePoolSize} candidates • GBL Species Clause + Shadows): Best #1 Lead: $bestLead • #2 Swap: $bestSwap • #3 Closer: $bestCloser"
                        textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
                    }
                }
            }
        }

        btnDialogSuggestUpgrades?.setOnClickListener {
            runTop100RoleUpgradesSimulation(showBannerOnComplete = true)
        }

        var movesetOptJob: kotlinx.coroutines.Job? = null
        fun runTeamMovesetOptimizationSimulation(showBannerOnComplete: Boolean) {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0])
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1])
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2])
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val manualArch = dialogManualArchetypeOverride

            btnDialogOptimizeMovesets?.isEnabled = false
            btnDialogOptimizeMovesets?.text = "⏳ Simulating All Team Move Options..."

            movesetOptJob?.cancel()
            movesetOptJob = lifecycleScope.launch(Dispatchers.Default) {
                val moveResult = OverlayService.recommendTop3MovesetsForTeamStatic(
                    slots = listOf(
                        OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs),
                        OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs),
                        OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs)
                    ),
                    league = lg,
                    seasonLogs = seasonLogs,
                    manualArchetypeOverride = manualArch
                )

                withContext(Dispatchers.Main) {
                    btnDialogOptimizeMovesets?.isEnabled = true
                    btnDialogOptimizeMovesets?.text = "🎯 Simulate Moves & Propose Best 3 Alternate Movesets"

                    fun formatSignedDelta(delta: Int): String = if (delta >= 0) "+$delta" else "$delta"

                    fun bindMovesetChips(
                        slotIndex: Int,
                        roleLabel: String,
                        roleMetricName: String,
                        container: LinearLayout?,
                        headerView: TextView?,
                        buttons: List<Button?>,
                        suggestions: List<OverlayService.Companion.MovesetUpgradeSuggestion>
                    ) {
                        if (suggestions.isEmpty()) {
                            container?.visibility = android.view.View.GONE
                            return
                        }
                        container?.visibility = android.view.View.VISIBLE
                        headerView?.text = "🎯 Best 3 Alternate Movesets for Slot ${slotIndex + 1} ($roleLabel • Tap to Apply Moves):"
                        buttons.forEachIndexed { idx, btn ->
                            val sug = suggestions.getOrNull(idx)
                            if (sug == null || idx >= 3) {
                                btn?.visibility = android.view.View.GONE
                            } else {
                                btn?.visibility = android.view.View.VISIBLE
                                val machDeltaStr = formatSignedDelta(sug.machineBrDelta)
                                val roleDeltaStr = formatSignedDelta(sug.roleBrDelta)
                                val leadDeltaStr = formatSignedDelta(sug.leadBrDelta)
                                btn?.text = "${idx + 1}. ${sug.proposedFastMove} / ${sug.proposedCharged1} + ${sug.proposedCharged2}  •  Team Core ${sug.newMachineAggBr} ($machDeltaStr) • Pos $roleMetricName ${sug.newRoleBr} ($roleDeltaStr)"
                                btn?.setOnClickListener {
                                    when (slotIndex) {
                                        0 -> {
                                            editP1Fast.setText(sug.proposedFastMove)
                                            editP1C1.setText(sug.proposedCharged1)
                                            editP1C2.setText(sug.proposedCharged2)
                                        }
                                        1 -> {
                                            editP2Fast.setText(sug.proposedFastMove)
                                            editP2C1.setText(sug.proposedCharged1)
                                            editP2C2.setText(sug.proposedCharged2)
                                        }
                                        else -> {
                                            editP3Fast.setText(sug.proposedFastMove)
                                            editP3C1.setText(sug.proposedCharged1)
                                            editP3C2.setText(sug.proposedCharged2)
                                        }
                                    }
                                    val evalAfter = refreshDialogTeamEvaluation(autoReorder = false)
                                    textDialogAutoDetectBanner?.text =
                                        "Applied Moveset to Slot ${slotIndex + 1} (${sug.pokemonName} → ${sug.proposedFastMove} + ${sug.proposedCharged1}/${sug.proposedCharged2}): Team Core BR ${evalAfter.machineAggBr} ($machDeltaStr) • Pos $roleMetricName ${sug.newRoleBr} ($roleDeltaStr) • Team Lead BR ${sug.newLeadAggBr} ($leadDeltaStr)"
                                    textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
                                    runTeamMovesetOptimizationSimulation(showBannerOnComplete = false)
                                }
                            }
                        }
                    }

                    bindMovesetChips(
                        slotIndex = 0,
                        roleLabel = "Lead",
                        roleMetricName = "Lead BR",
                        container = layoutP1Recs,
                        headerView = textP1RecHeader,
                        buttons = btnP1Recs,
                        suggestions = moveResult.slot1Movesets
                    )
                    bindMovesetChips(
                        slotIndex = 1,
                        roleLabel = "Safe Swap",
                        roleMetricName = "Swap BR",
                        container = layoutP2Recs,
                        headerView = textP2RecHeader,
                        buttons = btnP2Recs,
                        suggestions = moveResult.slot2Movesets
                    )
                    bindMovesetChips(
                        slotIndex = 2,
                        roleLabel = "Closer",
                        roleMetricName = "Closer BR",
                        container = layoutP3Recs,
                        headerView = textP3RecHeader,
                        buttons = btnP3Recs,
                        suggestions = moveResult.slot3Movesets
                    )

                    if (showBannerOnComplete) {
                        val topSummary = if (moveResult.top3OverallMovesets.isEmpty()) {
                            "Current movesets are already optimal!"
                        } else {
                            moveResult.top3OverallMovesets.mapIndexed { i, m ->
                                val cStr = formatSignedDelta(m.machineBrDelta)
                                val rStr = formatSignedDelta(m.roleBrDelta)
                                "#${i + 1} ${m.pokemonName} (${m.proposedFastMove}+${m.proposedCharged1}/${m.proposedCharged2}: Core $cStr, ${m.roleTitle} $rStr)"
                            }.joinToString(" • ")
                        }
                        textDialogAutoDetectBanner?.text =
                            "🎯 Best 3 Alternate Movesets (${moveResult.combosEvaluated} combos simulated): $topSummary"
                        textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
                    }
                }
            }
        }

        btnDialogOptimizeMovesets?.setOnClickListener {
            runTeamMovesetOptimizationSimulation(showBannerOnComplete = true)
        }

        refreshDialogTeamEvaluation(autoReorder = false)

        val dialog = AlertDialog.Builder(this)
            .setTitle(if (existingPreset != null) "⚔️ Edit Team & Moves" else "➕ Create Custom GBL Team")
            .setView(dialogView)
            .setPositiveButton("Save Team") { _, _ ->
                val league = spinnerLeague.selectedItem.toString()
                val top3Defaults = getLeagueTop3Defaults(league)
                val name = editName.text.toString().trim().ifEmpty { "${league.split(" ").first().lowercase().replaceFirstChar { it.uppercase() }} Team" }

                val p1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, league, top3Defaults[0])
                val p2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, league, top3Defaults[1])
                val p3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, league, top3Defaults[2])

                val rawPreset = TeamPreset(
                    id = existingPreset?.id ?: UUID.randomUUID().toString(),
                    name = name,
                    league = league,
                    pokemon = listOf(p1, p2, p3),
                    isSelected = existingPreset?.isSelected ?: false,
                    updatedAt = System.currentTimeMillis(),
                    archetype = dialogManualArchetypeOverride ?: "ABC",
                    isArchetypeManual = dialogManualArchetypeOverride != null
                )
                val savedPreset = evaluatePresetMetrics(rawPreset, autoReorder = false)

                val list = loadPresets().toMutableList()
                val existingIdx = list.indexOfFirst { it.id == savedPreset.id }
                if (existingIdx >= 0) {
                    list[existingIdx] = savedPreset
                } else {
                    list.add(savedPreset)
                }
                savePresets(list)
                setSelectedPreset(savedPreset.id)
                setupBattleLogFilters()
                triggerTwoDeviceCloudSync(silent = true)
                Toast.makeText(
                    this,
                    "Saved '${name}' (${savedPreset.archetype} • Lead BR ${savedPreset.leadAggBr} • Core BR ${savedPreset.machineAggBr})!",
                    Toast.LENGTH_SHORT
                ).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
        styleThemedAlertDialog(dialog)
    }

    private fun formatDbAndLeagueStatusText(): String {
        val lastSyncMs = prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L)
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        val effectiveMs = if (lastSyncMs > 0L) lastSyncMs else if (cacheFile.exists()) cacheFile.lastModified() else 0L
        val dateStr = if (effectiveMs > 0L) {
            java.text.SimpleDateFormat("MMM d, yyyy h:mm a", java.util.Locale.US).format(java.util.Date(effectiveMs))
        } else {
            "Not synced"
        }
        val gmCount = OverlayService.getGamemasterLoadedCount()
        val glCount = OverlayService.getLeagueRankingsCount("GREAT LEAGUE")
        val ulCount = OverlayService.getLeagueRankingsCount("ULTRA LEAGUE")
        val mlCount = OverlayService.getLeagueRankingsCount("MASTER LEAGUE")
        val megaCount = OverlayService.getLeagueRankingsCount("MEGA MASTER LEAGUE")
        return "Last Updated: $dateStr • GameMaster: $gmCount Pokémon\nLeagues Loaded — GL: $glCount • UL: $ulCount • ML: $mlCount • Mega: $megaCount"
    }

    /**
     * PVPOKE GAMEMASTER + LEAGUE RANKINGS DOWNLOAD & CACHE:
     * Downloads raw live PvPoke gamemaster.json + GL/UL/ML/Mega Master rankings JSONs
     */
    private fun checkGamemasterCache() {
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        if (cacheFile.exists()) {
            dbStatusText.text = "Loading cached PvPoke GameMaster & 4 League Rankings..."
            lifecycleScope.launch(Dispatchers.IO) {
                var didDownloadMissing = false
                try {
                    for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                        val rFile = File(filesDir, fileName)
                        if (rFile.exists() && rFile.length() > 200) {
                            if (OverlayService.LIVE_RANKINGS_MAP[leagueKey].isNullOrEmpty()) {
                                OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                            }
                        } else {
                            try {
                                val rReq = Request.Builder().url(url).build()
                                client.newCall(rReq).execute().use { rResp ->
                                    val rBody = rResp.body?.string()
                                    if (rResp.isSuccessful && !rBody.isNullOrBlank()) {
                                        rFile.writeText(rBody)
                                        OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                        didDownloadMissing = true
                                    }
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    if (OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty() || OverlayService.DYNAMIC_MOVE_DATABASE.isEmpty()) {
                        OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                    }
                    if (didDownloadMissing || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                        prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, cacheFile.lastModified().takeIf { it > 0L } ?: System.currentTimeMillis()).apply()
                    }
                } catch (_: Exception) {}
                runOneTimeAiLogSplitAndCleanup(silent = true)
                migrateExistingBattleLogs()
                recalculateAllPresetsWithSeasonMetaBlocking()
                withContext(Dispatchers.Main) {
                    dbStatusText.text = formatDbAndLeagueStatusText()
                    refreshPresetsUi()
                    renderBattleLogPage()
                }
            }
        } else {
            dbStatusText.text = "PvPoke Database: Not cached (syncing all 4 leagues...)"
            lifecycleScope.launch(Dispatchers.Default) {
                runOneTimeAiLogSplitAndCleanup(silent = true)
                migrateExistingBattleLogs()
            }
            downloadPvPokeGamemaster()
        }
    }

    private fun downloadPvPokeGamemaster() {
        dbStatusText.text = "Downloading PvPoke gamemaster.json + GL/UL/ML/Mega rankings..."
        btnDownloadDb.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                    try {
                        val rReq = Request.Builder().url(url).build()
                        client.newCall(rReq).execute().use { rResp ->
                            if (rResp.isSuccessful) {
                                val rBody = rResp.body?.string()
                                if (!rBody.isNullOrBlank()) {
                                    File(filesDir, fileName).writeText(rBody)
                                    OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                }
                            }
                        }
                    } catch (_: Exception) {}
                }

                val request = Request.Builder().url(GAMEMASTER_URL).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
                    val bodyString = response.body?.string() ?: throw Exception("Empty body")

                    val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                    cacheFile.writeText(bodyString)
                    OverlayService.parseGamemasterJsonStatic(bodyString)
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()

                    withContext(Dispatchers.Main) {
                        dbStatusText.text = formatDbAndLeagueStatusText()
                        btnDownloadDb.isEnabled = true
                        reparseAllCompletedBattles(silent = true)
                        Toast.makeText(this@MainActivity, "PvPoke gamemaster & all 4 league rankings synced!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    dbStatusText.text = "Database Sync Failed: ${e.localizedMessage}\n${formatDbAndLeagueStatusText()}"
                    btnDownloadDb.isEnabled = true
                    Toast.makeText(this@MainActivity, "Sync error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

/**
 * Headless Translucent Activity for Tasker Automation:
 * Starts or stops the floating PvP overlay over the current foreground app (e.g., Pokémon GO)
 * without opening MainActivity or leaving the game.
 */
class TaskerOverlayActivity : Activity() {

    private var requestedTeamExtra: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
        handleTaskerIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleTaskerIntent(intent)
    }

    private fun handleTaskerIntent(incoming: Intent?) {
        val act = incoming?.action.orEmpty()
        val cmd = (incoming?.getStringExtra("cmd") ?: incoming?.getStringExtra("command")).orEmpty().trim()
        requestedTeamExtra = incoming?.getStringExtra(OverlayService.EXTRA_TEAM_NAME)
            ?: incoming?.getStringExtra("preset")

        val isStop = act.equals(OverlayService.ACTION_STOP_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_STOP, ignoreCase = true) ||
            cmd.equals("stop", ignoreCase = true)

        val isToggle = act.equals(OverlayService.ACTION_TOGGLE_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_TOGGLE, ignoreCase = true) ||
            cmd.equals("toggle", ignoreCase = true)

        val isMinimize = act.equals(OverlayService.ACTION_MINIMIZE_OVERLAY, ignoreCase = true) ||
            cmd.equals("minimize", ignoreCase = true)

        val isRestore = act.equals(OverlayService.ACTION_RESTORE_OVERLAY, ignoreCase = true) ||
            cmd.equals("restore", ignoreCase = true)

        val isOpenBattleLog = act.equals(OverlayService.ACTION_OPEN_BATTLE_LOG, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_BATTLE_LOG, ignoreCase = true) ||
            cmd.equals("battle_log", ignoreCase = true)

        when {
            isOpenBattleLog -> {
                val mainIntent = Intent(this, MainActivity::class.java).apply {
                    action = OverlayService.ACTION_OPEN_BATTLE_LOG
                    putExtra("page", "battle_log")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(mainIntent)
                finishQuietly()
            }
            isStop || (isToggle && OverlayService.isInstanceRunning) -> {
                OverlayService.isInstanceRunning = false
                OverlayService.hasActiveMediaProjection = false
                OverlayService.notifyRunningStateChanged()
                val stopIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_STOP_OVERLAY
                }
                try {
                    startService(stopIntent)
                } catch (_: Exception) {
                    stopService(Intent(this, OverlayService::class.java))
                }
                finishQuietly()
            }
            isMinimize -> {
                if (OverlayService.isInstanceRunning) {
                    val minIntent = Intent(this, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_MINIMIZE_OVERLAY
                    }
                    startService(minIntent)
                }
                finishQuietly()
            }
            isRestore -> {
                if (OverlayService.isInstanceRunning) {
                    val resIntent = Intent(this, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_RESTORE_OVERLAY
                    }
                    startService(resIntent)
                }
                finishQuietly()
            }
            else -> {
                // Default / ACTION_START_OVERLAY
                if (!Settings.canDrawOverlays(this)) {
                    val permIntent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    Toast.makeText(this, "Grant 'Display over other apps' permission for SilphScope PvP", Toast.LENGTH_LONG).show()
                    startActivity(permIntent)
                    finishQuietly()
                    return
                }

                val manualMode = incoming?.getBooleanExtra("manual_mode", false) == true
                if ((OverlayService.isInstanceRunning && OverlayService.hasActiveMediaProjection) || manualMode) {
                    startOverlayServiceWithResult(0, null)
                    finishQuietly()
                    return
                }

                val projMgr = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
                if (projMgr != null) {
                    try {
                        @Suppress("DEPRECATION")
                        startActivityForResult(projMgr.createScreenCaptureIntent(), REQ_TASKER_MEDIA_PROJECTION)
                    } catch (_: Exception) {
                        startOverlayServiceWithResult(0, null)
                        finishQuietly()
                    }
                } else {
                    startOverlayServiceWithResult(0, null)
                    finishQuietly()
                }
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_TASKER_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                startOverlayServiceWithResult(resultCode, data)
            } else {
                startOverlayServiceWithResult(0, null)
            }
            finishQuietly()
        }
    }

    private fun startOverlayServiceWithResult(resultCode: Int, data: Intent?) {
        val prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START_OVERLAY
            putExtra(OverlayService.EXTRA_RESULT_CODE, resultCode)
            if (data != null) {
                putExtra(OverlayService.EXTRA_RESULT_DATA, data)
            }
            if (!requestedTeamExtra.isNullOrBlank()) {
                putExtra(OverlayService.EXTRA_TEAM_NAME, requestedTeamExtra)
            }
            putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts")
            putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
            putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
            putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2))
            putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt("overlay_scale_pct", 78))
            putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72))
            putExtra(OverlayService.EXTRA_APP_THEME_ID, prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "slate") ?: "slate")
        }
        try {
            ContextCompat.startForegroundService(this, serviceIntent)
        } catch (_: Exception) {
            try {
                startService(serviceIntent)
            } catch (_: Exception) {}
        }
    }

    private fun finishQuietly() {
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
    }

    companion object {
        private const val REQ_TASKER_MEDIA_PROJECTION = 9401
    }
}

/**
 * BroadcastReceiver for Tasker Send Intent (Target: Broadcast Receiver):
 * Supports starting, stopping, toggling, minimizing, or restoring the overlay and launching the Battle Log page.
 */
class TaskerBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val act = intent?.action.orEmpty()
        val cmd = (intent?.getStringExtra("cmd") ?: intent?.getStringExtra("command")).orEmpty().trim()

        val isStop = act.equals(OverlayService.ACTION_STOP_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_STOP, ignoreCase = true) ||
            cmd.equals("stop", ignoreCase = true)

        val isToggle = act.equals(OverlayService.ACTION_TOGGLE_OVERLAY, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_TOGGLE, ignoreCase = true) ||
            cmd.equals("toggle", ignoreCase = true)

        val isMinimize = act.equals(OverlayService.ACTION_MINIMIZE_OVERLAY, ignoreCase = true) ||
            cmd.equals("minimize", ignoreCase = true)

        val isRestore = act.equals(OverlayService.ACTION_RESTORE_OVERLAY, ignoreCase = true) ||
            cmd.equals("restore", ignoreCase = true)

        val isOpenBattleLog = act.equals(OverlayService.ACTION_OPEN_BATTLE_LOG, ignoreCase = true) ||
            act.equals(OverlayService.ACTION_SHORT_BATTLE_LOG, ignoreCase = true) ||
            cmd.equals("battle_log", ignoreCase = true)

        when {
            isOpenBattleLog -> {
                val mainIntent = Intent(context, MainActivity::class.java).apply {
                    action = OverlayService.ACTION_OPEN_BATTLE_LOG
                    putExtra("page", "battle_log")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                context.startActivity(mainIntent)
            }
            isStop || (isToggle && OverlayService.isInstanceRunning) -> {
                val wasRunning = OverlayService.isInstanceRunning
                OverlayService.isInstanceRunning = false
                OverlayService.hasActiveMediaProjection = false
                OverlayService.notifyRunningStateChanged()
                if (wasRunning) {
                    val stopIntent = Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_STOP_OVERLAY
                    }
                    try {
                        context.startService(stopIntent)
                    } catch (_: Exception) {
                        context.stopService(Intent(context, OverlayService::class.java))
                    }
                } else {
                    context.stopService(Intent(context, OverlayService::class.java))
                }
            }
            isMinimize -> {
                if (OverlayService.isInstanceRunning) {
                    context.startService(Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_MINIMIZE_OVERLAY
                    })
                }
            }
            isRestore -> {
                if (OverlayService.isInstanceRunning) {
                    context.startService(Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_RESTORE_OVERLAY
                    })
                }
            }
            else -> {
                val manualMode = intent?.getBooleanExtra("manual_mode", false) == true
                if ((OverlayService.isInstanceRunning && OverlayService.hasActiveMediaProjection) || manualMode) {
                    val prefs = context.getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
                    val srvIntent = Intent(context, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_START_OVERLAY
                        intent?.getStringExtra(OverlayService.EXTRA_TEAM_NAME)?.let { putExtra(OverlayService.EXTRA_TEAM_NAME, it) }
                        putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts")
                        putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
                        putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
                        putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET, 0).coerceIn(0, 2))
                        putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt("overlay_scale_pct", 78))
                        putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72))
                        putExtra(OverlayService.EXTRA_APP_THEME_ID, prefs.getString(OverlayService.PREFS_KEY_APP_THEME_ID, "slate") ?: "slate")
                    }
                    ContextCompat.startForegroundService(context, srvIntent)
                } else {
                    val actIntent = Intent(context, TaskerOverlayActivity::class.java).apply {
                        action = OverlayService.ACTION_START_OVERLAY
                        intent?.extras?.let { putExtras(it) }
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NO_ANIMATION)
                    }
                    context.startActivity(actIntent)
                }
            }
        }
    }
}
