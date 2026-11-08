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
    private lateinit var btnNavMeta: Button
    private lateinit var btnOverlayQuickHelp: Button
    private lateinit var pageTeams: android.view.View
    private lateinit var pageSettings: android.view.View
    private lateinit var pageBattleLog: android.view.View
    private lateinit var pageMeta: android.view.View
    private lateinit var pageHelp: android.view.View
    private lateinit var btnToggleOppCountBasis: Button
    private lateinit var textOppCountBasisDesc: TextView
    private lateinit var btnToggleOppChargedMoves: Button
    private lateinit var textOppChargedMovesDesc: TextView
    private lateinit var btnToggleBattleToasts: Button
    private lateinit var textBattleToastsDesc: TextView
    private lateinit var btnToggleTacticalRec: Button
    private lateinit var textTacticalRecDesc: TextView
    private lateinit var btnCycleAiAdviceHudPos: Button
    private lateinit var textAiAdviceHudPosDesc: TextView
    private lateinit var btnToggleOverlayHudMode: Button
    private lateinit var textOverlayHudModeDesc: TextView
    private lateinit var btnToggleCompactHudMatrix: Button
    private lateinit var textCompactHudMatrixDesc: TextView
    private lateinit var btnToggleShieldDecisionOverlay: Button
    private lateinit var textShieldDecisionOverlayDesc: TextView
    private lateinit var btnToggleHpTracking: Button
    private lateinit var textHpTrackingDesc: TextView
    private lateinit var tvHpDebounceSummary: TextView
    private lateinit var btnHpDebounce2Samples: Button
    private lateinit var btnHpDebounce3Samples: Button
    private lateinit var btnHpDebounce4Samples: Button
    private lateinit var btnDebounceTol0: Button
    private lateinit var btnDebounceTol1: Button
    private lateinit var btnDebounceTol2: Button
    private lateinit var btnDebounceTol3: Button
    private lateinit var btnToggleEnergyTracking: Button
    private lateinit var textEnergyTrackingDesc: TextView
    private lateinit var tvEnergyDebounceSummary: TextView
    private lateinit var btnDebounce2Samples: Button
    private lateinit var btnDebounce3Samples: Button
    private lateinit var btnDebounce4Samples: Button
    private lateinit var btnProactiveLead0: Button
    private lateinit var btnProactiveLead200: Button
    private lateinit var btnProactiveLead300: Button
    private lateinit var btnProactiveLead400: Button
    private lateinit var textProactiveEnergyLeadDesc: TextView
    private lateinit var layoutAdminEnergyToastsCard: LinearLayout
    private lateinit var btnToggleEnergyUpdateToasts: Button
    private lateinit var textEnergyUpdateToastsDesc: TextView
    private lateinit var btnCycleChargeCirclePriority: Button
    private lateinit var textChargeCirclePriorityDesc: TextView
    private lateinit var btnToggleAltFastMoveDetect: Button
    private lateinit var textAltFastMoveDetectDesc: TextView
    private lateinit var btnCycleFastDetectOffset: Button
    private lateinit var textFastDetectOffsetDesc: TextView
    private lateinit var btnCycleAltFastStrictness: Button
    private lateinit var textAltFastStrictnessDesc: TextView
    private lateinit var btnCycleShieldChipTol: Button
    private lateinit var textShieldChipTolDesc: TextView
    private lateinit var btnCycleSwapRollbackWindow: Button
    private lateinit var textSwapRollbackWindowDesc: TextView
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
    private lateinit var btnToggleAutoUploadAiLogs: Button
    private lateinit var btnUploadAiLogsNow: Button
    private lateinit var textAiTelemetryStatus: TextView
    private lateinit var btnToggleShowOneBattleDvr: Button
    private lateinit var btnArmOneBattleDvrNow: Button
    private lateinit var textOneBattleDvrStatus: TextView
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
    private lateinit var spinnerLogFilterCpTier: Spinner
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
    private lateinit var switchHapticMaster: Switch
    private lateinit var switchHapticOppSwap: Switch
    private lateinit var seekbarHapticOppSwapSec: SeekBar
    private lateinit var textHapticOppSwapSecVal: TextView
    private lateinit var btnTestHapticSwap: Button
    private lateinit var switchHapticOppCharge: Switch
    private lateinit var btnHapticCharge1F: Button
    private lateinit var btnHapticCharge2F: Button
    private lateinit var btnTestHapticCharge: Button
    private lateinit var textLeadWonWinrate: TextView
    private lateinit var textLeadLostRecovery: TextView
    private lateinit var textSafeSwapMvp: TextView
    private lateinit var editTrainerScreenName: EditText
    private lateinit var btnSaveTrainerScreenName: Button
    private lateinit var btnRandomTrainerScreenName: Button
    private lateinit var textTrainerScreenNameStatus: TextView
    private var activeScreenNamePromptDialog: AlertDialog? = null
    private var currentActivePage: String = "teams"
    private var isUpdatingThemeSpinner = false
    private var selectedMetaTabScope: String = "SEASON"
    private var isMetaSettingsDrawerExpanded: Boolean = false
    private var isUpdatingMetaLeagueSpinner: Boolean = false
    private var metaDashboardJob: kotlinx.coroutines.Job? = null

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

    private var selectedLogCpTierFilter: String = "ALL"
    private var selectedLogLeagueFilter: String = "ALL"
    private var selectedLogTeamFilter: String = "ALL"
    private var selectedLogTimeframeFilter: String = "ALL_TIME"
    private var isUpdatingLogFilterSpinners = false
    private var selectedPresetsCpTierFilter: String = "ALL"
    private var selectedPresetsLeagueFilter: String = "ALL"

    private fun isShow6CombatMode(): Boolean {
        return ::prefs.isInitialized && prefs.getString(OverlayService.PREFS_KEY_APP_COMBAT_MODE, "gbl") == "show6"
    }

    private val PREFS_KEY_PRESETS: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3 else OverlayService.PREFS_KEY_PERSISTENT_TEAMS
    private val PREFS_KEY_SELECTED_PRESET: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID else "gbl_selected_preset_id"
    private val PREFS_KEY_OPP_COUNT_MODE = "opp_count_mode"
    private val PREFS_KEY_ENABLE_4_CHARGED_MOVES = OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES
    private val PREFS_KEY_DISABLE_BATTLE_TOASTS = OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS
    private val PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS = OverlayService.PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS
    private val PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY = OverlayService.PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY
    private val PREFS_KEY_ENABLE_HP_TRACKING = OverlayService.PREFS_KEY_ENABLE_HP_TRACKING
    private val PREFS_KEY_ENABLE_ENERGY_TRACKING = OverlayService.PREFS_KEY_ENABLE_ENERGY_TRACKING
    private val PREFS_KEY_FAST_DETECT_TURN_OFFSET = OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET
    private val PREFS_KEY_INSTALLED_VERSION_CODE = OverlayService.PREFS_KEY_INSTALLED_VERSION_CODE
    private val PREFS_KEY_LAST_SYNC_TIMESTAMP = OverlayService.PREFS_KEY_LAST_SYNC_TIMESTAMP
    private val PREFS_KEY_OVERLAY_SCALE_PCT = "overlay_scale_pct"
    private val DEFAULT_OVERLAY_SCALE_PCT = 78
    private val PREFS_KEY_OVERLAY_TRANSPARENCY_PCT = OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT
    private val DEFAULT_OVERLAY_TRANSPARENCY_PCT = 50
    private val PREFS_KEY_BATTLE_LOGS: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_BATTLE_LOGS else OverlayService.PREFS_KEY_BATTLE_LOGS
    private val PREFS_KEY_DELETED_LOG_IDS: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_DELETED_LOG_IDS else OverlayService.PREFS_KEY_DELETED_LOG_IDS
    private val PREFS_KEY_DELETED_TEAM_IDS: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_DELETED_TEAM_IDS else OverlayService.PREFS_KEY_DELETED_TEAM_IDS
    private val PREFS_KEY_DELETED_BATTLES_TRASH: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_DELETED_BATTLES_TRASH else OverlayService.PREFS_KEY_DELETED_LOGS_TRASH
    private val PREFS_KEY_DELETED_TEAMS_TRASH: String
        get() = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_DELETED_TEAMS_TRASH else OverlayService.PREFS_KEY_DELETED_TEAMS_TRASH
    private val PREFS_KEY_GBL_SEASONS_JSON = OverlayService.PREFS_KEY_GBL_SEASONS_JSON
    private val PREFS_KEY_SYNC_GITHUB_TOKEN = OverlayService.PREFS_KEY_SYNC_GITHUB_TOKEN
    private val PREFS_KEY_SYNC_GITHUB_USERNAME = OverlayService.PREFS_KEY_SYNC_GITHUB_USERNAME
    private val PREFS_KEY_SYNC_GIST_ID = OverlayService.PREFS_KEY_SYNC_GIST_ID
    private val PREFS_KEY_SYNC_LAST_AT = OverlayService.PREFS_KEY_SYNC_LAST_AT
    private val SCRAPEDDUCK_EVENTS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json"
    private val DONATION_URL = "https://buymeacoffee.com/silphscopepvp"
    private val GAMEMASTER_URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"
    private val RANKINGS_ENDPOINTS = listOf(
        Triple("GREAT LEAGUE", "pvpoke_rankings_gl.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"),
        Triple("ULTRA LEAGUE", "pvpoke_rankings_ul.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json"),
        Triple("MASTER LEAGUE", "pvpoke_rankings_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json"),
        Triple("BATTLE FRONTIER (SPECTRAL)", "pvpoke_rankings_bf_spectral.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/spectral/overall/rankings-1500.json"),
        Triple("BATTLE FRONTIER (CAULDRON)", "pvpoke_rankings_bf_cauldron.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/cauldron/overall/rankings-2500.json"),
        Triple("BATTLE FRONTIER (MASTER)", "pvpoke_rankings_bf_master.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/battlefrontiermaster/overall/rankings-10000.json")
    )

    private var isBattleLogMultiSelectMode: Boolean = false
    private val selectedBattleLogIds = LinkedHashSet<String>()

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

        OverlayService.appContext = applicationContext
        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        // v6.02: Run one-time optimal scanner defaults migration (HP=ON, Energy=ON, 2 samples, ±2% tol, 200ms lead, +1t offset, strict alt fast, 8% chip tol, 4.0s swap rollback)
        OverlayService.runV602ScannerDefaultsMigrationStatic(prefs)
        val prevInstalledVerCode = prefs.getInt(PREFS_KEY_INSTALLED_VERSION_CODE, 0)
        if (prevInstalledVerCode < 1602) {
            prefs.edit().putInt(PREFS_KEY_INSTALLED_VERSION_CODE, 1602).apply()
        }
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        runV511LeagueRemapAndCleanup()
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        initViews()
        val appVer = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: OverlayService.APP_VERSION
        } catch (_: Exception) {
            OverlayService.APP_VERSION
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
        OverlayService.runV510AiTelemetryMigrationAndWipeStatic(prefs)
        ensureRequiredScreenNameOrPrompt()
        retryPendingDvrBundlesInBackground()
        OverlayService.triggerAutoUploadOnAppLaunchAsync(prefs, gson) { _, _ ->
            runOnUiThread {
                if (!isFinishing && ::prefs.isInitialized) {
                    updateAiTelemetryStatusUi()
                    renderBattleLogPage()
                }
            }
        }
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
            ensureRequiredScreenNameOrPrompt()
            syncOverlayRunningUiState()
            setupBattleLogFilters()
            renderBattleLogPage()
            updateTrainerScreenNameUi()
            updateSyncStatusUi()
            checkPendingGitHubDeviceLoginOnResume()
            // Automatically pull & reconcile deltas from the other device on every app open / resume
            triggerTwoDeviceCloudSync(silent = true)
            retryPendingDvrBundlesInBackground()
            // v5.10: Once-daily AI & Anomaly telemetry upload check on app launch/resume
            OverlayService.triggerAutoUploadOnAppLaunchAsync(prefs, gson) { _, _ ->
                runOnUiThread {
                    if (!isFinishing && ::prefs.isInitialized) {
                        updateAiTelemetryStatusUi()
                    }
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        OverlayService.onRunningStateChanged = null
    }

    private fun syncOverlayRunningUiState() {
        isOverlayRunning = OverlayService.isInstanceRunning
        val show6 = isShow6CombatMode()
        val modeLabel = if (show6) "Show 6" else "GBL"

        findViewById<ImageView>(R.id.iv_app_mode_logo)?.setImageResource(
            if (show6) R.drawable.ic_battle_frontier_logo else R.drawable.ic_gbl_logo
        )
        findViewById<Button>(R.id.btn_header_mode_badge)?.let { badge ->
            badge.text = if (show6) "🏛️ SHOW 6 MODE" else "🛡️ GBL MODE"
            badge.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (show6) 0xFFD97706.toInt() else 0xFF0284C7.toInt()
            )
            badge.setTextColor(if (show6) 0xFF0F172A.toInt() else 0xFFFFFFFF.toInt())
        }
        findViewById<TextView>(R.id.tv_teams_page_title)?.text =
            if (show6) "Show 6 Teams & Builders" else "GBL Team Presets"
        findViewById<android.view.View>(R.id.card_show6_mode_hub)?.visibility =
            if (show6) android.view.View.VISIBLE else android.view.View.GONE
        if (::cardAntiMetaBuilder.isInitialized) {
            cardAntiMetaBuilder.visibility = if (show6) android.view.View.GONE else android.view.View.VISIBLE
        }
        if (::btnToggleAntiMetaBuilder.isInitialized) {
            btnToggleAntiMetaBuilder.visibility = if (show6) android.view.View.GONE else android.view.View.VISIBLE
        }

        if (::btnToggleOverlay.isInitialized && ::statusText.isInitialized) {
            val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
            if (isOverlayRunning) {
                btnToggleOverlay.text = "Stop Battle Overlay"
                btnToggleOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                btnToggleOverlay.setTextColor(0xFFFFFFFF.toInt())
                statusText.text = "Status: $modeLabel Overlay Active"
                statusText.setTextColor(theme.secondaryAccentColor)
            } else {
                btnToggleOverlay.text = "Start Battle Overlay"
                btnToggleOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnToggleOverlay.setTextColor(0xFFFFFFFF.toInt())
                statusText.text = "Status: $modeLabel Idle"
                statusText.setTextColor(if (show6) 0xFFFBBF24.toInt() else theme.accentColor)
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

        if (pageExtra.equals("meta", ignoreCase = true)) {
            switchMainPage("meta")
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
        if (::pageMeta.isInitialized) {
            pageMeta.visibility = if (page == "meta") android.view.View.VISIBLE else android.view.View.GONE
        }
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

        if (::btnNavMeta.isInitialized) {
            btnNavMeta.backgroundTintList = if (page == "meta") activeBg else inactiveBg
            btnNavMeta.setTextColor(if (page == "meta") activeText else inactiveText)
        }

        if (::btnOverlayQuickHelp.isInitialized) {
            btnOverlayQuickHelp.backgroundTintList = if (page == "help") activeBg else helpDefaultBg
            btnOverlayQuickHelp.setTextColor(if (page == "help") activeText else theme.secondaryAccentColor)
        }

        if (page == "battle_log") {
            renderBattleLogPage()
        } else if (page == "meta") {
            refreshMetaTabDashboard()
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
        if (::btnHpDebounce2Samples.isInitialized) {
            loadAndRenderHpDebounceUi()
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
        if (::btnCycleAiAdviceHudPos.isInitialized) updateAiAdviceHudPosUi()
        if (::btnToggleOverlayHudMode.isInitialized) updateOverlayHudModeUi()
        if (::btnToggleCompactHudMatrix.isInitialized) updateCompactHudMatrixUi()
        if (::btnToggleShieldDecisionOverlay.isInitialized) updateShieldDecisionOverlayUi()
        if (::btnToggleHpTracking.isInitialized) updateHpTrackingUi()
        if (::btnToggleEnergyTracking.isInitialized) updateEnergyTrackingUi()
        if (::btnCycleChargeCirclePriority.isInitialized) updateChargeCirclePriorityUi()
        if (::btnToggleAltFastMoveDetect.isInitialized) updateAltFastMoveDetectUi()
        if (::btnCycleFastDetectOffset.isInitialized) updateFastDetectOffsetUi()
        if (::btnCycleAltFastStrictness.isInitialized) updateAltFastStrictnessUi()
        if (::btnCycleShieldChipTol.isInitialized) updateShieldChipTolUi()
        if (::btnCycleSwapRollbackWindow.isInitialized) updateSwapRollbackWindowUi()
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
        btnNavMeta = findViewById(R.id.btn_nav_meta)
        btnOverlayQuickHelp = findViewById(R.id.btn_overlay_quick_help)
        pageTeams = findViewById(R.id.page_teams)
        pageSettings = findViewById(R.id.page_settings)
        pageBattleLog = findViewById(R.id.page_battle_log)
        pageMeta = findViewById(R.id.page_meta)
        pageHelp = findViewById(R.id.page_help)
        btnToggleOppCountBasis = findViewById(R.id.btn_toggle_opp_count_basis)
        textOppCountBasisDesc = findViewById(R.id.text_opp_count_basis_desc)
        btnToggleOppChargedMoves = findViewById(R.id.btn_toggle_opp_charged_moves)
        textOppChargedMovesDesc = findViewById(R.id.text_opp_charged_moves_desc)
        btnToggleBattleToasts = findViewById(R.id.btn_toggle_battle_toasts)
        textBattleToastsDesc = findViewById(R.id.text_battle_toasts_desc)
        btnToggleTacticalRec = findViewById(R.id.btn_toggle_tactical_rec)
        textTacticalRecDesc = findViewById(R.id.text_tactical_rec_desc)
        btnCycleAiAdviceHudPos = findViewById(R.id.btn_cycle_ai_advice_hud_pos)
        textAiAdviceHudPosDesc = findViewById(R.id.text_ai_advice_hud_pos_desc)
        btnToggleOverlayHudMode = findViewById(R.id.btn_toggle_overlay_hud_mode)
        textOverlayHudModeDesc = findViewById(R.id.text_overlay_hud_mode_desc)
        btnToggleCompactHudMatrix = findViewById(R.id.btn_toggle_compact_hud_matrix)
        textCompactHudMatrixDesc = findViewById(R.id.text_compact_hud_matrix_desc)
        btnToggleShieldDecisionOverlay = findViewById(R.id.btn_toggle_shield_decision_overlay)
        textShieldDecisionOverlayDesc = findViewById(R.id.text_shield_decision_overlay_desc)
        btnToggleHpTracking = findViewById(R.id.btn_toggle_hp_tracking)
        textHpTrackingDesc = findViewById(R.id.text_hp_tracking_desc)
        tvHpDebounceSummary = findViewById(R.id.tv_hp_debounce_summary)
        btnHpDebounce2Samples = findViewById(R.id.btn_hp_debounce_2_samples)
        btnHpDebounce3Samples = findViewById(R.id.btn_hp_debounce_3_samples)
        btnHpDebounce4Samples = findViewById(R.id.btn_hp_debounce_4_samples)
        btnDebounceTol0 = findViewById(R.id.btn_debounce_tol_0)
        btnDebounceTol1 = findViewById(R.id.btn_debounce_tol_1)
        btnDebounceTol2 = findViewById(R.id.btn_debounce_tol_2)
        btnDebounceTol3 = findViewById(R.id.btn_debounce_tol_3)
        btnToggleEnergyTracking = findViewById(R.id.btn_toggle_energy_tracking)
        textEnergyTrackingDesc = findViewById(R.id.text_energy_tracking_desc)
        tvEnergyDebounceSummary = findViewById(R.id.tv_energy_debounce_summary)
        btnDebounce2Samples = findViewById(R.id.btn_debounce_2_samples)
        btnDebounce3Samples = findViewById(R.id.btn_debounce_3_samples)
        btnDebounce4Samples = findViewById(R.id.btn_debounce_4_samples)
        btnProactiveLead0 = findViewById(R.id.btn_proactive_lead_0)
        btnProactiveLead200 = findViewById(R.id.btn_proactive_lead_200)
        btnProactiveLead300 = findViewById(R.id.btn_proactive_lead_300)
        btnProactiveLead400 = findViewById(R.id.btn_proactive_lead_400)
        textProactiveEnergyLeadDesc = findViewById(R.id.text_proactive_energy_lead_desc)
        layoutAdminEnergyToastsCard = findViewById(R.id.layout_admin_energy_toasts_card)
        btnToggleEnergyUpdateToasts = findViewById(R.id.btn_toggle_energy_update_toasts)
        textEnergyUpdateToastsDesc = findViewById(R.id.text_energy_update_toasts_desc)
        btnCycleChargeCirclePriority = findViewById(R.id.btn_cycle_charge_circle_priority)
        textChargeCirclePriorityDesc = findViewById(R.id.text_charge_circle_priority_desc)
        btnToggleAltFastMoveDetect = findViewById(R.id.btn_toggle_alt_fast_move_detect)
        textAltFastMoveDetectDesc = findViewById(R.id.text_alt_fast_move_detect_desc)
        btnCycleFastDetectOffset = findViewById(R.id.btn_cycle_fast_detect_offset)
        textFastDetectOffsetDesc = findViewById(R.id.text_fast_detect_offset_desc)
        btnCycleAltFastStrictness = findViewById(R.id.btn_cycle_alt_fast_strictness)
        textAltFastStrictnessDesc = findViewById(R.id.text_alt_fast_strictness_desc)
        btnCycleShieldChipTol = findViewById(R.id.btn_cycle_shield_chip_tol)
        textShieldChipTolDesc = findViewById(R.id.text_shield_chip_tol_desc)
        btnCycleSwapRollbackWindow = findViewById(R.id.btn_cycle_swap_rollback_window)
        textSwapRollbackWindowDesc = findViewById(R.id.text_swap_rollback_window_desc)
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
        btnToggleAutoUploadAiLogs = findViewById(R.id.btn_toggle_auto_upload_ai_logs)
        btnUploadAiLogsNow = findViewById(R.id.btn_upload_ai_logs_now)
        textAiTelemetryStatus = findViewById(R.id.text_ai_telemetry_status)
        btnToggleShowOneBattleDvr = findViewById(R.id.btn_toggle_show_one_battle_dvr)
        btnArmOneBattleDvrNow = findViewById(R.id.btn_arm_one_battle_dvr_now)
        textOneBattleDvrStatus = findViewById(R.id.text_one_battle_dvr_status)
        editTrainerScreenName = findViewById(R.id.edit_trainer_screen_name)
        btnSaveTrainerScreenName = findViewById(R.id.btn_save_trainer_screen_name)
        btnRandomTrainerScreenName = findViewById(R.id.btn_random_trainer_screen_name)
        textTrainerScreenNameStatus = findViewById(R.id.text_trainer_screen_name_status)
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
        spinnerLogFilterCpTier = findViewById(R.id.spinner_log_filter_cp_tier)
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
        switchHapticMaster = findViewById(R.id.switch_haptic_master)
        switchHapticOppSwap = findViewById(R.id.switch_haptic_opp_swap)
        seekbarHapticOppSwapSec = findViewById(R.id.seekbar_haptic_opp_swap_sec)
        textHapticOppSwapSecVal = findViewById(R.id.text_haptic_opp_swap_sec_val)
        btnTestHapticSwap = findViewById(R.id.btn_test_haptic_swap)
        switchHapticOppCharge = findViewById(R.id.switch_haptic_opp_charge)
        btnHapticCharge1F = findViewById(R.id.btn_haptic_charge_1f)
        btnHapticCharge2F = findViewById(R.id.btn_haptic_charge_2f)
        btnTestHapticCharge = findViewById(R.id.btn_test_haptic_charge)
        textLeadWonWinrate = findViewById(R.id.text_lead_won_winrate)
        textLeadLostRecovery = findViewById(R.id.text_lead_lost_recovery)
        textSafeSwapMvp = findViewById(R.id.text_safe_swap_mvp)

        // v6.06: Initialize Haptics & Tactical Vibration Alert Controls
        val masterHapticOn = prefs.getBoolean(OverlayService.PREFS_KEY_HAPTIC_MASTER_ENABLED, OverlayService.DEFAULT_HAPTIC_MASTER_ENABLED)
        val oppSwapHapticOn = prefs.getBoolean(OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_ENABLED, OverlayService.DEFAULT_HAPTIC_OPP_SWAP_ENABLED)
        val oppSwapWarnSec = prefs.getInt(OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_WARN_SEC, OverlayService.DEFAULT_HAPTIC_OPP_SWAP_WARN_SEC).coerceIn(2, 10)
        val oppChargeHapticOn = prefs.getBoolean(OverlayService.PREFS_KEY_HAPTIC_OPP_CHARGE_WARN_ENABLED, OverlayService.DEFAULT_HAPTIC_OPP_CHARGE_WARN_ENABLED)
        val chargeTimingFasts = prefs.getInt(OverlayService.PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS, OverlayService.DEFAULT_HAPTIC_CHARGE_TIMING_FASTS).coerceIn(1, 2)

        switchHapticMaster.isChecked = masterHapticOn
        switchHapticOppSwap.isChecked = oppSwapHapticOn
        seekbarHapticOppSwapSec.progress = (oppSwapWarnSec - 2).coerceIn(0, 8)
        textHapticOppSwapSecVal.text = if (oppSwapWarnSec == 5) "≤ 5s (Default)" else "≤ ${oppSwapWarnSec}s"
        switchHapticOppCharge.isChecked = oppChargeHapticOn

        fun updateHapticChargeLeadButtonsUi(fasts: Int) {
            val is1F = fasts <= 1
            btnHapticCharge1F.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (is1F) 0xFFE11D48.toInt() else 0xFF334155.toInt()
            )
            btnHapticCharge1F.setTextColor(if (is1F) 0xFFFFFFFF.toInt() else 0xFFCBD5E1.toInt())
            btnHapticCharge2F.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (!is1F) 0xFFE11D48.toInt() else 0xFF334155.toInt()
            )
            btnHapticCharge2F.setTextColor(if (!is1F) 0xFFFFFFFF.toInt() else 0xFFCBD5E1.toInt())
        }
        updateHapticChargeLeadButtonsUi(chargeTimingFasts)

        fun pushHapticSettingsToOverlay() {
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                }
                startService(updateIntent)
            }
        }

        switchHapticMaster.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_HAPTIC_MASTER_ENABLED, isChecked).apply()
            pushHapticSettingsToOverlay()
        }
        switchHapticOppSwap.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_ENABLED, isChecked).apply()
            pushHapticSettingsToOverlay()
        }
        seekbarHapticOppSwapSec.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val sec = (progress + 2).coerceIn(2, 10)
                textHapticOppSwapSecVal.text = if (sec == 5) "≤ 5s (Default)" else "≤ ${sec}s"
                if (fromUser) {
                    prefs.edit().putInt(OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_WARN_SEC, sec).apply()
                    pushHapticSettingsToOverlay()
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
        btnTestHapticSwap.setOnClickListener {
            OverlayService.triggerSingleHapticPulseStatic(this)
            Toast.makeText(this, "📳 80ms Single Pulse (Swap Clock Alert)", Toast.LENGTH_SHORT).show()
        }
        switchHapticOppCharge.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_HAPTIC_OPP_CHARGE_WARN_ENABLED, isChecked).apply()
            pushHapticSettingsToOverlay()
        }
        btnHapticCharge1F.setOnClickListener {
            prefs.edit().putInt(OverlayService.PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS, 1).apply()
            updateHapticChargeLeadButtonsUi(1)
            pushHapticSettingsToOverlay()
        }
        btnHapticCharge2F.setOnClickListener {
            prefs.edit().putInt(OverlayService.PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS, 2).apply()
            updateHapticChargeLeadButtonsUi(2)
            pushHapticSettingsToOverlay()
        }
        btnTestHapticCharge.setOnClickListener {
            OverlayService.triggerDoubleHapticPulseStatic(this)
            Toast.makeText(this, "📳📳 80ms Double Pulse (Charged Move Alert)", Toast.LENGTH_SHORT).show()
        }
        val switchPostBattleTuning = findViewById<android.widget.Switch>(R.id.switch_post_battle_tuning_feedback)
        if (switchPostBattleTuning != null) {
            switchPostBattleTuning.isChecked = OverlayService.isPostBattleTuningFeedbackEnabledStatic(prefs)
            switchPostBattleTuning.setOnCheckedChangeListener { _, isChecked ->
                prefs.edit().putBoolean(OverlayService.PREFS_KEY_POST_BATTLE_TUNING_FEEDBACK, isChecked).apply()
                pushHapticSettingsToOverlay()
            }
        }

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
        btnNavMeta.setOnClickListener { switchMainPage("meta") }

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
        updateAiAdviceHudPosUi()
        updateOverlayHudModeUi()
        updateCompactHudMatrixUi()
        updateShieldDecisionOverlayUi()
        updateHpTrackingUi()
        updateEnergyTrackingUi()
        updateChargeCirclePriorityUi()
        updateAltFastMoveDetectUi()
        updateFastDetectOffsetUi()
        updateAltFastStrictnessUi()
        updateShieldChipTolUi()
        updateSwapRollbackWindowUi()

        updateTrainerScreenNameUi()
        btnSaveTrainerScreenName.setOnClickListener {
            saveTrainerScreenNameFromInput()
        }
        btnRandomTrainerScreenName.setOnClickListener {
            assignRandomTrainerDebugId()
        }

        editSyncGithubToken.inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
        editSyncGithubToken.setText("")
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

        btnToggleAutoUploadAiLogs.setOnClickListener {
            val current = prefs.getBoolean(
                OverlayService.PREFS_KEY_AUTO_UPLOAD_AI_LOGS,
                OverlayService.DEFAULT_AUTO_UPLOAD_AI_LOGS
            )
            val next = !current
            prefs.edit()
                .putBoolean(OverlayService.PREFS_KEY_AUTO_UPLOAD_AI_LOGS, next)
                .putBoolean(OverlayService.PREFS_KEY_AI_TELEMETRY_ONBOARDING_SHOWN, true)
                .apply()
            updateAiTelemetryStatusUi()
            if (next) {
                Toast.makeText(
                    this,
                    "🤖 Auto-Upload Enabled! Uploading any queued AI & anomaly logs...",
                    Toast.LENGTH_SHORT
                ).show()
                triggerManualAiTelemetryUpload(silentIfEmpty = true)
            } else {
                Toast.makeText(this, "⚪ AI & Anomaly Log Auto-Upload turned OFF.", Toast.LENGTH_SHORT).show()
            }
        }

        btnUploadAiLogsNow.setOnClickListener {
            if (!OverlayService.hasValidScreenNameStatic(prefs)) {
                ensureRequiredScreenNameOrPrompt()
                return@setOnClickListener
            }
            triggerManualAiTelemetryUpload(silentIfEmpty = false)
        }

        btnToggleShowOneBattleDvr.setOnClickListener {
            val current = prefs.getBoolean(OverlayService.PREFS_KEY_ALWAYS_ON_DVR_ENABLED, OverlayService.DEFAULT_ALWAYS_ON_DVR_ENABLED)
            val next = !current
            prefs.edit()
                .putBoolean(OverlayService.PREFS_KEY_ALWAYS_ON_DVR_ENABLED, next)
                .putBoolean(OverlayService.PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN, false)
                .apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            updateAiTelemetryStatusUi()
            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                }
                startService(updateIntent)
            }
            val msg = if (next) {
                "🎥 Always-On Battle DVR enabled! Actual battles (≥10s) are automatically recorded for Replay & Post-Battle Bug Reports."
            } else {
                "⚪ Always-On Battle DVR disabled in Settings."
            }
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }

        btnArmOneBattleDvrNow.setOnClickListener {
            val currentAllowMobile = prefs.getBoolean(
                OverlayService.PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD,
                OverlayService.DEFAULT_ALLOW_MOBILE_DATA_DVR_UPLOAD
            )
            val nextAllowMobile = !currentAllowMobile
            prefs.edit()
                .putBoolean(OverlayService.PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD, nextAllowMobile)
                .apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            updateAiTelemetryStatusUi()
            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                }
                startService(updateIntent)
            }
            val msg = if (nextAllowMobile) {
                "📶 Mobile Data DVR Upload enabled (Opted-In). Videos can upload over cellular or Wi-Fi."
            } else {
                "📡 Mobile Data DVR Upload OFF (Wi-Fi Only). Videos will wait for Wi-Fi before uploading."
            }
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show()
        }

        loadAndRenderHpDebounceUi()
        btnHpDebounce2Samples.setOnClickListener {
            saveHpDebounceSamples(2, showToast = true)
        }
        btnHpDebounce3Samples.setOnClickListener {
            saveHpDebounceSamples(3, showToast = true)
        }
        btnHpDebounce4Samples.setOnClickListener {
            saveHpDebounceSamples(4, showToast = true)
        }
        btnDebounceTol0.setOnClickListener {
            saveDebounceTolerancePct(0, showToast = true)
        }
        btnDebounceTol1.setOnClickListener {
            saveDebounceTolerancePct(1, showToast = true)
        }
        btnDebounceTol2.setOnClickListener {
            saveDebounceTolerancePct(2, showToast = true)
        }
        btnDebounceTol3.setOnClickListener {
            saveDebounceTolerancePct(3, showToast = true)
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
        btnProactiveLead0.setOnClickListener {
            saveProactiveEnergyLeadMs(0, showToast = true)
        }
        btnProactiveLead200.setOnClickListener {
            saveProactiveEnergyLeadMs(200, showToast = true)
        }
        btnProactiveLead300.setOnClickListener {
            saveProactiveEnergyLeadMs(300, showToast = true)
        }
        btnProactiveLead400.setOnClickListener {
            saveProactiveEnergyLeadMs(400, showToast = true)
        }
        btnToggleEnergyUpdateToasts.setOnClickListener {
            val currentEnabled = prefs.getBoolean(OverlayService.PREFS_KEY_ENERGY_UPDATE_TOASTS, OverlayService.DEFAULT_ENERGY_UPDATE_TOASTS)
            val nextEnabled = !currentEnabled
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_ENERGY_UPDATE_TOASTS, nextEnabled).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "toggle_energy_update_toasts",
                triggerImmediateUpload = true
            )
            loadAndRenderEnergyDebounceUi()
            updateAiTelemetryStatusUi()
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

        btnAddPreset.setOnClickListener {
            showPresetEditorDialog(null)
        }

        setupAntiMetaTeamBuilderUi()
        setupShow6ModeHubUi()
        setupMetaTabUi()

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
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "toggle_opp_count_basis",
                triggerImmediateUpload = true
            )
            updateOppCountBasisUi()
            updateAiTelemetryStatusUi()

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

        btnCycleAiAdviceHudPos.setOnClickListener {
            val currentPos = prefs.getString(
                OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION,
                OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION
            ) ?: OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION
            val nextPos = if (currentPos.equals("top", ignoreCase = true)) "bottom" else "top"
            prefs.edit().putString(OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION, nextPos).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            updateAiAdviceHudPosUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_AI_ADVICE_HUD_POSITION, nextPos)
                }
                startService(updateIntent)
            }
        }

        btnToggleOverlayHudMode.setOnClickListener {
            val currentMode = prefs.getString(
                OverlayService.PREFS_KEY_OVERLAY_HUD_MODE,
                OverlayService.DEFAULT_OVERLAY_HUD_MODE
            ) ?: OverlayService.DEFAULT_OVERLAY_HUD_MODE
            val nextMode = if (currentMode.equals("compact", ignoreCase = true)) "full" else "compact"
            prefs.edit().putString(OverlayService.PREFS_KEY_OVERLAY_HUD_MODE, nextMode).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            updateOverlayHudModeUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_OVERLAY_HUD_MODE, nextMode)
                }
                startService(updateIntent)
            }
        }

        btnToggleCompactHudMatrix.setOnClickListener {
            val currentShow = prefs.getBoolean(
                OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX,
                OverlayService.DEFAULT_COMPACT_HUD_SHOW_MATRIX
            )
            val nextShow = !currentShow
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX, nextShow).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            updateCompactHudMatrixUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_COMPACT_HUD_SHOW_MATRIX, nextShow)
                }
                startService(updateIntent)
            }
        }

        btnToggleShieldDecisionOverlay.setOnClickListener {
            val tier = OverlayService.getEffectiveReplayTierStatic(prefs)
            if (tier == "free") {
                AlertDialog.Builder(this)
                    .setTitle("🏅 Lifetime Supporter Required")
                    .setMessage(
                        "The 🛡️ Attack Incoming! Shield Decision Overlay (Red/Orange/Yellow/Green KO & Tank/Farm Verdict Card) is unlocked permanently in the Lifetime Supporter ($2 one-time) tier — or unlocked forever automatically when you subscribe to Legend Pro or VIP even once!\n\n" +
                            "Scroll to Section 3 (Membership Tier & Replay Vault) in Settings to unlock via Stripe or Buy Me a Coffee."
                    )
                    .setPositiveButton("💳 Unlock ($2 Supporter)") { _, _ ->
                        val user = OverlayService.getRequiredScreenNameStatic(prefs)
                        val url = if (user.isNotEmpty()) {
                            "${OverlayService.STRIPE_URL_SUPPORTER}?client_reference_id=${android.net.Uri.encode(user)}"
                        } else {
                            OverlayService.STRIPE_URL_SUPPORTER
                        }
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                        } catch (_: Exception) {}
                    }
                    .setNegativeButton("Close", null)
                    .show()
                updateShieldDecisionOverlayUi()
                return@setOnClickListener
            }
            val currentShow = prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true)
            val nextShow = !currentShow
            prefs.edit().putBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, nextShow).apply()
            updateShieldDecisionOverlayUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_SHOW_SHIELD_DECISION_OVERLAY, nextShow)
                }
                startService(updateIntent)
            }
        }

        btnToggleHpTracking.setOnClickListener {
            val currentEnableHp = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, OverlayService.DEFAULT_ENABLE_HP_TRACKING)
            val nextEnableHp = !currentEnableHp
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_HP_TRACKING, nextEnableHp).apply()
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "toggle_hp_tracking",
                triggerImmediateUpload = true
            )
            updateHpTrackingUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_HP_TRACKING, nextEnableHp)
                }
                startService(updateIntent)
            }
        }

        btnToggleEnergyTracking.setOnClickListener {
            val currentEnableEnergy = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, OverlayService.DEFAULT_ENABLE_ENERGY_TRACKING)
            val nextEnableEnergy = !currentEnableEnergy
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, nextEnableEnergy).apply()
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "toggle_energy_tracking",
                triggerImmediateUpload = true
            )
            updateEnergyTrackingUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_ENERGY_TRACKING, nextEnableEnergy)
                }
                startService(updateIntent)
            }
        }

        btnCycleChargeCirclePriority.setOnClickListener {
            val currentMode = prefs.getString(
                OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE,
                OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
            ) ?: OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
            val nextMode = when (currentMode) {
                "smart_hybrid" -> "highest_contrast"
                "highest_contrast" -> "highest_energy"
                else -> "smart_hybrid"
            }
            prefs.edit().putString(OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, nextMode).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "cycle_charge_circle_priority",
                triggerImmediateUpload = true
            )
            updateChargeCirclePriorityUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_CHARGE_CIRCLE_PRIORITY_MODE, nextMode)
                }
                startService(updateIntent)
            }
        }

        btnToggleAltFastMoveDetect.setOnClickListener {
            val currentEnable = prefs.getBoolean(
                OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT,
                OverlayService.DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT
            )
            val nextEnable = !currentEnable
            prefs.edit().putBoolean(OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, nextEnable).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "toggle_alt_fast_move_detect",
                triggerImmediateUpload = true
            )
            updateAltFastMoveDetectUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_ALT_FAST_MOVE_DETECT, nextEnable)
                }
                startService(updateIntent)
            }
        }

        btnCycleFastDetectOffset.setOnClickListener {
            val currentOffset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, OverlayService.DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
            val nextOffset = (currentOffset + 1) % 4
            prefs.edit().putInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, nextOffset).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "cycle_fast_detect_turn_offset",
                triggerImmediateUpload = true
            )
            updateFastDetectOffsetUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, nextOffset)
                }
                startService(updateIntent)
            }
        }

        btnCycleAltFastStrictness.setOnClickListener {
            val currentMode = prefs.getString(
                OverlayService.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS,
                OverlayService.DEFAULT_ALT_FAST_DETECT_STRICTNESS
            ) ?: OverlayService.DEFAULT_ALT_FAST_DETECT_STRICTNESS
            val nextMode = when (currentMode.lowercase()) {
                "strict" -> "balanced"
                "balanced" -> "aggressive"
                else -> "strict"
            }
            prefs.edit().putString(OverlayService.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, nextMode).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "cycle_alt_fast_strictness",
                triggerImmediateUpload = true
            )
            updateAltFastStrictnessUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ALT_FAST_DETECT_STRICTNESS, nextMode)
                }
                startService(updateIntent)
            }
        }

        btnCycleShieldChipTol.setOnClickListener {
            val currentTol = prefs.getInt(
                OverlayService.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT,
                OverlayService.DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
            )
            val nextTol = when (currentTol) {
                8 -> 10
                10 -> 3
                3 -> 6
                else -> 8
            }
            prefs.edit().putInt(OverlayService.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, nextTol).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "cycle_shield_chip_tolerance_pct",
                triggerImmediateUpload = true
            )
            updateShieldChipTolUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_SHIELD_CHIP_TOLERANCE_PCT, nextTol)
                }
                startService(updateIntent)
            }
        }

        btnCycleSwapRollbackWindow.setOnClickListener {
            val currentMs = prefs.getInt(
                OverlayService.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS,
                OverlayService.DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
            )
            val nextMs = when (currentMs) {
                4000 -> 5000
                5000 -> 0
                0 -> 3000
                else -> 4000
            }
            prefs.edit().putInt(OverlayService.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, nextMs).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            OverlayService.recordDebounceSettingsChangeIfNeededStatic(
                prefs = prefs,
                gson = gson,
                triggerSource = "cycle_swap_throw_rollback_window_ms",
                triggerImmediateUpload = true
            )
            updateSwapRollbackWindowUi()
            updateAiTelemetryStatusUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_SWAP_THROW_ROLLBACK_WINDOW_MS, nextMs)
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

        // Clicking the default tick or value label snaps back to 50% (Default)
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
        val oldTok = OverlayService.getEffectiveSyncToken(prefs)
        val editor = prefs.edit().putString(PREFS_KEY_SYNC_GIST_ID, gist)
        if (tok.isNotEmpty() && tok != oldTok) {
            editor.putString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")
        }
        editor.apply()
        if (tok.isNotEmpty()) {
            OverlayService.setEffectiveSyncToken(prefs, tok)
            editSyncGithubToken.setText("")
        }
        updateSyncStatusUi()
    }

    private fun updateTrainerScreenNameUi() {
        if (!::editTrainerScreenName.isInitialized || !::textTrainerScreenNameStatus.isInitialized) return
        val screenName = OverlayService.getRequiredScreenNameStatic(prefs)
        if (editTrainerScreenName.text?.toString()?.trim() != screenName) {
            editTrainerScreenName.setText(screenName)
        }
        if (OverlayService.isValidScreenNameStatic(screenName)) {
            if (OverlayService.isRandomDebugIdStatic(prefs)) {
                textTrainerScreenNameStatus.text =
                    "🎲 Active Random Debug ID: $screenName (Standard debug logs enabled • Enter a custom ID above to unlock 1-Battle DVR video logging)"
                textTrainerScreenNameStatus.setTextColor(0xFF38BDF8.toInt())
            } else {
                textTrainerScreenNameStatus.text =
                    "✅ Active Custom Debug ID: $screenName (Debug logs & 1-Battle DVR video logging enabled)"
                textTrainerScreenNameStatus.setTextColor(0xFF34D399.toInt())
            }
        } else {
            textTrainerScreenNameStatus.text =
                "⚠️ Unique Debug ID Required (3–24 chars or tap '🎲 Random ID') before launching the overlay."
            textTrainerScreenNameStatus.setTextColor(0xFFFBBF24.toInt())
        }
        findViewById<android.widget.Switch>(R.id.switch_post_battle_tuning_feedback)?.isChecked =
            OverlayService.isPostBattleTuningFeedbackEnabledStatic(prefs)
        loadAndRenderEnergyDebounceUi()
    }

    private fun saveTrainerScreenNameFromInput() {
        val raw = editTrainerScreenName.text?.toString().orEmpty()
        val sanitized = OverlayService.sanitizeScreenNameStatic(raw)
        if (!OverlayService.isValidScreenNameStatic(sanitized)) {
            Toast.makeText(
                this,
                "⚠️ Please enter a valid custom ID (3–24 characters: letters, numbers, _ or -).",
                Toast.LENGTH_LONG
            ).show()
            return
        }
        val isRandomFmt = OverlayService.isRandomScreenNameFormatStatic(sanitized)
        val editor = prefs.edit()
            .putString(OverlayService.PREFS_KEY_USER_SCREEN_NAME, sanitized)
            .putBoolean(OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME, isRandomFmt)
            .putLong(OverlayService.PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
        if (isRandomFmt) {
            editor.putBoolean(OverlayService.PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN, false)
            editor.putBoolean(OverlayService.PREFS_KEY_ARM_ONE_BATTLE_DVR, false)
        }
        editor.apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        updateTrainerScreenNameUi()
        updateSyncStatusUi()
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        val msg = if (isRandomFmt) {
            "🎲 Saved random ID: $sanitized (Enter a non-random custom ID to allow video logging)"
        } else {
            "✅ Custom Debug ID saved: $sanitized (Video logging unlocked)"
        }
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    private fun assignRandomTrainerDebugId() {
        val randomId = OverlayService.generateRandomDebugIdStatic()
        prefs.edit()
            .putString(OverlayService.PREFS_KEY_USER_SCREEN_NAME, randomId)
            .putBoolean(OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME, true)
            .putBoolean(OverlayService.PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN, false)
            .putBoolean(OverlayService.PREFS_KEY_ARM_ONE_BATTLE_DVR, false)
            .putLong(OverlayService.PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        updateTrainerScreenNameUi()
        updateSyncStatusUi()
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        Toast.makeText(
            this,
            "🎲 Assigned random debug ID: $randomId (Custom ID required for video logging)",
            Toast.LENGTH_LONG
        ).show()
    }

    private fun promptCustomIdForVideoLogging() {
        val pad = (16 * resources.displayMetrics.density).toInt()
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad / 2, pad, 0)
        }
        val currentId = OverlayService.getRequiredScreenNameStatic(prefs)
        val input = EditText(this).apply {
            hint = "Enter Custom ID (3–24 chars)"
            if (!OverlayService.isRandomDebugIdStatic(prefs)) {
                setText(currentId)
            }
            setSingleLine(true)
            setTextColor(0xFFF8FAFC.toInt())
            setHintTextColor(0xFF94A3B8.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            val innerPad = (12 * resources.displayMetrics.density).toInt()
            setPadding(innerPad, innerPad, innerPad, innerPad)
        }
        val helper = TextView(this).apply {
            text = "Does NOT need to be your actual Pokémon GO screen name — any unique custom handle (3–24 letters/numbers, not starting with ID_) unlocks 1-Battle DVR video logging."
            textSize = 11f
            setTextColor(0xFF94A3B8.toInt())
            setPadding(0, pad / 2, 0, 0)
        }
        container.addView(input)
        container.addView(helper)

        val dialog = AlertDialog.Builder(this)
            .setTitle("🎥 Custom ID Required for Video Logging")
            .setMessage("You are currently using a random debug ID ($currentId). To enable or arm 1-Battle DVR video logging, please enter a custom unique ID below:")
            .setView(container)
            .setPositiveButton("Save Custom ID", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            val btn = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            btn.setOnClickListener {
                val candidate = OverlayService.sanitizeScreenNameStatic(input.text?.toString().orEmpty())
                if (!OverlayService.isValidScreenNameStatic(candidate) || OverlayService.isRandomScreenNameFormatStatic(candidate)) {
                    input.error = "Enter a non-random custom ID (3–24 chars)"
                    return@setOnClickListener
                }
                prefs.edit()
                    .putString(OverlayService.PREFS_KEY_USER_SCREEN_NAME, candidate)
                    .putBoolean(OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME, false)
                    .putLong(OverlayService.PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
                    .apply()
                OverlayService.syncTierThresholdsFromPrefs(prefs)
                updateTrainerScreenNameUi()
                updateSyncStatusUi()
                dialog.dismiss()
                Toast.makeText(
                    this,
                    "✅ Custom ID saved ($candidate)! You can now enable or arm 1-Battle DVR video logging.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
        dialog.show()
    }

    private fun ensureRequiredScreenNameOrPrompt() {
        if (OverlayService.hasValidScreenNameStatic(prefs)) {
            activeScreenNamePromptDialog?.dismiss()
            activeScreenNamePromptDialog = null
            return
        }
        if (activeScreenNamePromptDialog?.isShowing == true) return

        val pad = (16 * resources.displayMetrics.density).toInt()
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad / 2, pad, 0)
        }
        val input = EditText(this).apply {
            hint = "Custom ID (3–24 chars)"
            setText(OverlayService.getRequiredScreenNameStatic(prefs))
            setSingleLine(true)
            setTextColor(0xFFF8FAFC.toInt())
            setHintTextColor(0xFF94A3B8.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            val innerPad = (12 * resources.displayMetrics.density).toInt()
            setPadding(innerPad, innerPad, innerPad, innerPad)
        }
        val helper = TextView(this).apply {
            text = "Unique ID for debug logs (3–24 letters, numbers, _ or -). Does NOT need to be your actual Pokémon GO screen name. You can also tap '🎲 Assign Random ID' below (note: a custom non-random ID is required for 1-Battle DVR video logging)."
            textSize = 11f
            setTextColor(0xFF94A3B8.toInt())
            setPadding(0, pad / 2, 0, 0)
        }
        container.addView(input)
        container.addView(helper)

        val dialog = AlertDialog.Builder(this)
            .setTitle("👤 Unique Debug ID Required")
            .setMessage("Welcome to SilphScope PvP! Choose a unique ID for diagnostic debug logs before using the app or starting the overlay:")
            .setView(container)
            .setCancelable(false)
            .setPositiveButton("Save Custom ID", null)
            .setNeutralButton("🎲 Assign Random ID", null)
            .create()

        dialog.setOnShowListener {
            val btn = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            btn.setOnClickListener {
                val candidate = OverlayService.sanitizeScreenNameStatic(input.text?.toString().orEmpty())
                if (!OverlayService.isValidScreenNameStatic(candidate)) {
                    input.error = "Enter 3–24 characters (A-Z, 0-9, _ or -)"
                    return@setOnClickListener
                }
                val isRandomFmt = OverlayService.isRandomScreenNameFormatStatic(candidate)
                prefs.edit()
                    .putString(OverlayService.PREFS_KEY_USER_SCREEN_NAME, candidate)
                    .putBoolean(OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME, isRandomFmt)
                    .putLong(OverlayService.PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
                    .apply()
                OverlayService.syncTierThresholdsFromPrefs(prefs)
                updateTrainerScreenNameUi()
                updateSyncStatusUi()
                dialog.dismiss()
                activeScreenNamePromptDialog = null
                Toast.makeText(this, "✅ Welcome, $candidate!", Toast.LENGTH_SHORT).show()
            }
            val neutralBtn = dialog.getButton(AlertDialog.BUTTON_NEUTRAL)
            neutralBtn.setOnClickListener {
                assignRandomTrainerDebugId()
                dialog.dismiss()
                activeScreenNamePromptDialog = null
            }
        }
        activeScreenNamePromptDialog = dialog
        dialog.show()
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
            textSyncStatus.text = "🟢 Auto-Sync Active ($userLabel) • Last: $lastStr • $vaultShort • Logs: ${loadBattleLogs().size} • Teams: ${loadPresets().size} • Settings Synced"
            editSyncGithubToken.setText("")
            editSyncGithubToken.visibility = android.view.View.GONE
            editSyncGistId.visibility = android.view.View.GONE
        } else {
            btnGithubLoginSettings.text = "🔑 Login with GitHub (Optional Multi-Device Sync)"
            btnGithubLoginSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
            btnGithubLoginSettings.setTextColor(0xFFFFFFFF.toInt())
            textSyncStatus.text = "⚪ Not signed in (Local-only) • Optional: Sign in with GitHub to sync Battle Logs, Teams & Settings across your devices"
            editSyncGithubToken.visibility = android.view.View.VISIBLE
            editSyncGistId.visibility = android.view.View.VISIBLE
        }
        updateAiTelemetryStatusUi()
    }

    private fun updateAiTelemetryStatusUi() {
        if (!::btnToggleAutoUploadAiLogs.isInitialized || !::textAiTelemetryStatus.isInitialized) return
        val enabled = prefs.getBoolean(
            OverlayService.PREFS_KEY_AUTO_UPLOAD_AI_LOGS,
            OverlayService.DEFAULT_AUTO_UPLOAD_AI_LOGS
        )
        val screenName = OverlayService.getRequiredScreenNameStatic(prefs).ifEmpty { "Unset" }
        val pendingLogs = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson)
        val pendingBattles = pendingLogs.size
        val pendingAnomalies = pendingLogs.sumOf { it.anomalies.size }
        val pendingSettingsChanges = OverlayService.loadPendingSettingsChangesStatic(prefs, gson).size
        val profileSig = OverlayService.computeDebounceSettingsProfileSignatureStatic(prefs)
        val lastAt = prefs.getLong(OverlayService.PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_MS, 0L)
        val totalUploaded = prefs.getInt(OverlayService.PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT, 0)
        val timeFmt = java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US)
        val lastStr = if (lastAt > 0L) timeFmt.format(java.util.Date(lastAt)) else "Never"

        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleAutoUploadAiLogs.text = "🤖 Auto-Upload: ON"
            btnToggleAutoUploadAiLogs.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleAutoUploadAiLogs.setTextColor(0xFFFFFFFF.toInt())
        } else {
            btnToggleAutoUploadAiLogs.text = "🤖 Auto-Upload: OFF"
            btnToggleAutoUploadAiLogs.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
            btnToggleAutoUploadAiLogs.setTextColor(0xFFFFFFFF.toInt())
        }

        val statePrefix = when {
            enabled -> "🟢 Auto-Upload ON (Debug ID: $screenName)"
            else -> "⚪ Auto-Upload OFF"
        }
        textAiTelemetryStatus.text =
            "$statePrefix • Debounce Profile: $profileSig ($pendingSettingsChanges pending changes) • Pending queue: $pendingBattles battles ($pendingAnomalies anomalies) • Total uploaded & purged: $totalUploaded • Last upload: $lastStr"

        if (::btnToggleShowOneBattleDvr.isInitialized && ::btnArmOneBattleDvrNow.isInitialized && ::textOneBattleDvrStatus.isInitialized) {
            val alwaysOnDvr = prefs.getBoolean(OverlayService.PREFS_KEY_ALWAYS_ON_DVR_ENABLED, OverlayService.DEFAULT_ALWAYS_ON_DVR_ENABLED)
            val allowMobileUpload = prefs.getBoolean(
                OverlayService.PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD,
                OverlayService.DEFAULT_ALLOW_MOBILE_DATA_DVR_UPLOAD
            )
            val dvrUploadedCount = prefs.getInt(OverlayService.PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT, 0)
            val lastDvrAt = prefs.getLong(OverlayService.PREFS_KEY_LAST_DVR_UPLOAD_MS, 0L)
            val lastDvrPath = prefs.getString(OverlayService.PREFS_KEY_LAST_DVR_UPLOAD_PATH, "") ?: ""
            val lastDvrStr = if (lastDvrAt > 0L) timeFmt.format(java.util.Date(lastDvrAt)) else "Never"

            if (alwaysOnDvr) {
                btnToggleShowOneBattleDvr.text = "🎥 Always-On Battle DVR: ON"
                btnToggleShowOneBattleDvr.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                btnToggleShowOneBattleDvr.setTextColor(0xFFFFFFFF.toInt())
            } else {
                btnToggleShowOneBattleDvr.text = "⚪ Always-On Battle DVR: OFF"
                btnToggleShowOneBattleDvr.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                btnToggleShowOneBattleDvr.setTextColor(0xFFF8FAFC.toInt())
            }

            if (allowMobileUpload) {
                btnArmOneBattleDvrNow.text = "📶 Mobile Data Upload: ON"
                btnArmOneBattleDvrNow.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnArmOneBattleDvrNow.setTextColor(0xFFFFFFFF.toInt())
            } else {
                btnArmOneBattleDvrNow.text = "📡 Mobile Data Upload: OFF (Wi-Fi)"
                btnArmOneBattleDvrNow.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                btnArmOneBattleDvrNow.setTextColor(0xFFF8FAFC.toInt())
            }

            val dvrStateLabel = if (alwaysOnDvr) {
                "🟢 Always-On DVR Active (Discards <10s & non-battles • Post-Battle Delete/Bug Prompt)"
            } else {
                "⚪ Always-On DVR Disabled"
            }
            val netLabel = if (allowMobileUpload) "Wi-Fi + Mobile Data (Opted-In)" else "Wi-Fi Only (Default)"
            val pendingDvrCount = OverlayService.countPendingCachedDvrBundlesStatic(cacheDir)
            val pendingDvrPart = if (pendingDvrCount > 0) " • Queued Diag Videos: $pendingDvrCount" else ""
            val pathTail = if (lastDvrPath.isNotEmpty()) " ($lastDvrPath)" else ""
            textOneBattleDvrStatus.text =
                "$dvrStateLabel • Network: $netLabel$pendingDvrPart • Uploaded: $dvrUploadedCount • Last Upload: $lastDvrStr$pathTail"

            setupOrUpdateReplayVaultSettingsUi()
        }
    }

    private var replayVaultSettingsBox: LinearLayout? = null
    private var textReplaySubHeader: TextView? = null
    private var btnReplayRegisterId: Button? = null
    private var layoutReplayPayRow1: LinearLayout? = null
    private var btnReplayStripeSupporter: Button? = null
    private var btnReplayStripePro: Button? = null
    private var btnReplayStripeVip: Button? = null
    private var btnReplayBmcShop: Button? = null
    private var btnToggleUpgradeKeyEntry: Button? = null
    private var layoutReplayKeyInputRow: LinearLayout? = null
    private var isUpgradeKeyEntryExpanded: Boolean = false
    private var editReplayUnlockKey: EditText? = null
    private var editReplayClaimEmail: EditText? = null
    private var textReplayVaultStatus: TextView? = null
    private var layoutVipLocalSliderRow: LinearLayout? = null
    private var textVipLocalSliderLabel: TextView? = null
    private var seekVipLocalSlider: SeekBar? = null
    private var btnVipFpsMode: Button? = null

    private fun setupOrUpdateReplayVaultSettingsUi() {
        val parentLayout = (textOneBattleDvrStatus.parent as? LinearLayout) ?: return
        val density = resources.displayMetrics.density
        val theme = getActiveAppTheme()

        if (replayVaultSettingsBox == null) {
            val box = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(0xFF0B1120.toInt())
                    setStroke((1 * density).toInt(), 0xFF1E293B.toInt())
                    cornerRadius = 8f * density
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (8 * density).toInt()
                }
            }

            val titleTv = TextView(this).apply {
                text = "🔑 Membership Tier, Season Pass & Replay Vault (v7.14)"
                setTextColor(0xFF38BDF8.toInt())
                textSize = 12f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val subTv = TextView(this).apply {
                text = "1️⃣ First tap '🛡️ Step 1: Verify & Lock Unique Trainer ID' so your handle is locked to your device.\n" +
                    "2️⃣ Upgrade via Stripe or Buy Me a Coffee: First 14 days of a GBL Season = Full Season ($6 Pro / $10 VIP). Day 15+ First-Time Promo = 1-Month Rate ($3 Pro / $5 VIP) for the entire remainder of the season! Plus any Pro/VIP pass permanently unlocks Lifetime Supporter (Alumni: 🛡️ Attack Incoming! Shield Decision Overlay + 5 Local Videos + Core 3 Leagues + Lifetime Battle Logs) forever.\n" +
                    "3️⃣ One-time online verification caches an offline cryptographic token so HUD, DVR & Anti-Meta work 100% offline."
                setTextColor(0xFF94A3B8.toInt())
                textSize = 10.5f
                setPadding(0, (2 * density).toInt(), 0, (6 * density).toInt())
            }

            // Pre-Checkout Unique Screen Name Registration & Dupe Check Row
            val regBtn = Button(this).apply {
                text = "🛡️ Step 1: Verify & Lock Unique Trainer ID Before Checkout"
                textSize = 10.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (6 * density).toInt()
                }
                setOnClickListener {
                    val currentId = OverlayService.getRequiredScreenNameStatic(prefs)
                    val emailStr = editReplayClaimEmail?.text?.toString()?.trim().orEmpty()
                    if (currentId.isEmpty() || OverlayService.isRandomDebugIdStatic(prefs)) {
                        promptCustomIdForVideoLogging()
                        return@setOnClickListener
                    }
                    Toast.makeText(this@MainActivity, "🔍 Checking uniqueness of @$currentId...", Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch(Dispatchers.IO) {
                        val (_, msg) = OverlayService.registerUniqueScreenNameBlocking(prefs, gson, currentId, emailStr)
                        withContext(Dispatchers.Main) {
                            if (!isFinishing) {
                                setupOrUpdateReplayVaultSettingsUi()
                                Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                            }
                        }
                    }
                }
            }

            // Stripe & Buy Me a Coffee Checkout Buttons Row
            val payRow1 = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (4 * density).toInt()
                }
            }
            fun openCheckoutUrl(baseUrl: String) {
                val user = OverlayService.getRequiredScreenNameStatic(prefs)
                val fullUrl = if (baseUrl.contains("buy.stripe.com") && user.isNotEmpty()) {
                    "$baseUrl?client_reference_id=${android.net.Uri.encode(user)}"
                } else {
                    baseUrl
                }
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(fullUrl)))
                } catch (_: Exception) {}
            }

            // Calculate whether Day 15+ Intro Promo applies right now
            val nowMs = System.currentTimeMillis()
            val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
            val yr = cal.get(java.util.Calendar.YEAR)
            val seasonStarts = listOf(
                java.time.ZonedDateTime.of(yr - 1, 12, 1, 21, 0, 0, 0, java.time.ZoneOffset.UTC).toInstant().toEpochMilli(),
                java.time.ZonedDateTime.of(yr, 3, 1, 21, 0, 0, 0, java.time.ZoneOffset.UTC).toInstant().toEpochMilli(),
                java.time.ZonedDateTime.of(yr, 6, 1, 21, 0, 0, 0, java.time.ZoneOffset.UTC).toInstant().toEpochMilli(),
                java.time.ZonedDateTime.of(yr, 9, 1, 21, 0, 0, 0, java.time.ZoneOffset.UTC).toInstant().toEpochMilli(),
                java.time.ZonedDateTime.of(yr, 12, 1, 21, 0, 0, 0, java.time.ZoneOffset.UTC).toInstant().toEpochMilli()
            )
            val curSeasonStart = seasonStarts.lastOrNull { it <= nowMs } ?: seasonStarts.first()
            val isDay15Plus = ((nowMs - curSeasonStart) / 86400000L) >= 14L
            val everPaidAlready = prefs.getBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, false)
            val useIntroPromo = isDay15Plus && !everPaidAlready

            val btnStripeSupporter = Button(this).apply {
                text = "🏅 Supporter ($2)"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0369A1.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    rightMargin = (4 * density).toInt()
                }
                setOnClickListener { openCheckoutUrl(OverlayService.STRIPE_URL_SUPPORTER) }
            }
            val btnStripePro = Button(this).apply {
                text = if (useIntroPromo) "💳 Pro Season ($3 Intro!)" else "💳 Pro Season ($6)"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f).apply {
                    rightMargin = (4 * density).toInt()
                }
                setOnClickListener {
                    openCheckoutUrl(if (useIntroPromo) OverlayService.STRIPE_URL_PRO_INTRO else OverlayService.STRIPE_URL_PRO_SEASON)
                }
            }
            val btnStripeVip = Button(this).apply {
                text = if (useIntroPromo) "👑 VIP Season ($5 Intro!)" else "👑 VIP Season ($10)"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF7C3AED.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f)
                setOnClickListener {
                    openCheckoutUrl(if (useIntroPromo) OverlayService.STRIPE_URL_VIP_INTRO else OverlayService.STRIPE_URL_VIP_SEASON)
                }
            }
            payRow1.addView(btnStripeSupporter)
            payRow1.addView(btnStripePro)
            payRow1.addView(btnStripeVip)

            val payRow2 = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (6 * density).toInt()
                }
            }
            val btnBmcShop = Button(this).apply {
                text = "☕ Buy Me a Coffee (PokéCoins & Season Shop)"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.3f).apply {
                    rightMargin = (4 * density).toInt()
                }
                setOnClickListener { openCheckoutUrl(OverlayService.BMC_URL_PAGE) }
            }
            val btnWebVault = Button(this).apply {
                text = "☁️ Open Web Vault"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                setTextColor(0xFFF8FAFC.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.9f)
                setOnClickListener {
                    val u = OverlayService.getRequiredScreenNameStatic(prefs)
                    openCheckoutUrl("${OverlayService.CLOUDFLARE_DVR_VAULT_URL}/vault?user=${android.net.Uri.encode(u)}")
                }
            }
            val toggleUpgradeKeyBtn = Button(this).apply {
                text = "🔑 Enter Upgrade Key"
                textSize = 10f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF1E293B.toInt())
                setTextColor(0xFF38BDF8.toInt())
                visibility = android.view.View.GONE
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.1f).apply {
                    leftMargin = (4 * density).toInt()
                }
                setOnClickListener {
                    isUpgradeKeyEntryExpanded = !isUpgradeKeyEntryExpanded
                    if (!isUpgradeKeyEntryExpanded) {
                        editReplayUnlockKey?.setText("")
                    }
                    setupOrUpdateReplayVaultSettingsUi()
                }
            }
            payRow2.addView(btnBmcShop)
            payRow2.addView(btnWebVault)
            payRow2.addView(toggleUpgradeKeyBtn)

            val inputRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            val keyInput = EditText(this).apply {
                hint = "Enter New / Upgrade Key (SSPVP-...)"
                setHintTextColor(0xFF64748B.toInt())
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 11f
                setSingleLine(true)
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                setText("")
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val emailInput = EditText(this).apply {
                hint = "Checkout Email (auto-claim / resolve dupe ID)"
                setHintTextColor(0xFF64748B.toInt())
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 11f
                setSingleLine(true)
                setText(prefs.getString(OverlayService.PREFS_KEY_CLAIM_EMAIL, "") ?: "")
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (2 * density).toInt()
                    bottomMargin = (4 * density).toInt()
                }
            }
            val verifyBtn = Button(this).apply {
                text = "🔑 Verify / Claim"
                textSize = 10.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                setTextColor(0xFFFFFFFF.toInt())
                setOnClickListener {
                    val entered = keyInput.text?.toString()?.trim().orEmpty()
                    val enteredEmail = emailInput.text?.toString()?.trim().orEmpty()
                    if (entered.isNotEmpty()) {
                        OverlayService.setEffectiveReplayUnlockKey(prefs, entered)
                    }
                    prefs.edit()
                        .putString(OverlayService.PREFS_KEY_CLAIM_EMAIL, enteredEmail)
                        .putLong(OverlayService.PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
                        .apply()
                    keyInput.setText("")
                    Toast.makeText(this@MainActivity, "🔄 Verifying Membership Key / Email Claim...", Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch(Dispatchers.IO) {
                        val effectiveKey = entered.ifEmpty { OverlayService.getEffectiveReplayUnlockKey(prefs) }
                        val (ok, msg) = OverlayService.verifyReplayUnlockKeyBlocking(prefs, gson, effectiveKey, enteredEmail)
                        if (OverlayService.getEffectiveSyncToken(prefs).isNotEmpty()) {
                            try {
                                OverlayService.syncWithGitHubGistBlocking(prefs, gson)
                            } catch (_: Exception) {}
                        }
                        OverlayService.enforceLocalDvrReplaysQuotaStatic(filesDir, prefs, gson)
                        withContext(Dispatchers.Main) {
                            if (!isFinishing) {
                                if (ok) {
                                    isUpgradeKeyEntryExpanded = false
                                }
                                setupOrUpdateReplayVaultSettingsUi()
                                updateSyncStatusUi()
                                renderBattleLogPage()
                                Toast.makeText(this@MainActivity, msg, if (ok) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }
            inputRow.addView(keyInput)
            inputRow.addView(verifyBtn)

            // VIP Configurable Local DVR Buffer Slider (25 to 100 battles)
            val vipRow = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                val padV = (6 * density).toInt()
                setPadding(0, padV, 0, padV)
                visibility = android.view.View.GONE
            }
            val vipLabel = TextView(this).apply {
                setTextColor(0xFFC4B5FD.toInt())
                textSize = 11f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val vipSeek = SeekBar(this).apply {
                max = 75 // 0..75 => 25..100 battles
                val savedLimit = prefs.getInt(OverlayService.PREFS_KEY_VIP_LOCAL_DVR_LIMIT, OverlayService.DEFAULT_VIP_LOCAL_DVR_LIMIT).coerceIn(25, 100)
                progress = savedLimit - 25
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                        val limit = (progress + 25).coerceIn(25, 100)
                        vipLabel.text = "👑 VIP Local On-Device DVR Ring Buffer: $limit Battles (25–100 Configurable)"
                        if (fromUser) {
                            prefs.edit().putInt(OverlayService.PREFS_KEY_VIP_LOCAL_DVR_LIMIT, limit).apply()
                        }
                    }
                    override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                    override fun onStopTrackingTouch(seekBar: SeekBar?) {
                        lifecycleScope.launch(Dispatchers.IO) {
                            OverlayService.enforceLocalDvrReplaysQuotaStatic(filesDir, prefs, gson)
                            withContext(Dispatchers.Main) {
                                if (!isFinishing) setupOrUpdateReplayVaultSettingsUi()
                            }
                        }
                    }
                })
            }
            vipRow.addView(vipLabel)
            vipRow.addView(vipSeek)

            fun formatVipFpsModeLabel(fps: Int): String = if (fps == 15) {
                "💾 VIP DVR Framerate: 15 FPS Storage Saver (~14 MB/battle • saves ~30% storage)"
            } else {
                "🎥 VIP DVR Framerate: 30 FPS Smooth Default (~20 MB/battle • <=30 MB max)"
            }
            val vipFpsBtn = Button(this).apply {
                val curFps = prefs.getInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, OverlayService.DEFAULT_VIP_DVR_FPS_MODE)
                text = formatVipFpsModeLabel(curFps)
                textSize = 9.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF4C1D95.toInt())
                setTextColor(0xFFF3E8FF.toInt())
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (4 * density).toInt()
                }
                setOnClickListener {
                    val options = arrayOf(
                        "🎥 30 FPS Smooth (VIP Default • 900 kbps CBR • ~20 MB/battle, <=30 MB at 240s max)",
                        "💾 15 FPS Storage Saver (Pro Mode • 720 kbps CBR • ~14 MB/battle, saves ~30% local & cloud storage)"
                    )
                    val values = intArrayOf(30, 15)
                    val current = prefs.getInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, OverlayService.DEFAULT_VIP_DVR_FPS_MODE)
                    val checkedIdx = if (current == 15) 1 else 0
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("👑 VIP Battle DVR Framerate Mode")
                        .setSingleChoiceItems(options, checkedIdx) { dialog, which ->
                            val chosenFps = values.getOrElse(which) { 30 }
                            dialog.dismiss()
                            prefs.edit().putInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, chosenFps).apply()
                            text = formatVipFpsModeLabel(chosenFps)
                            setupOrUpdateReplayVaultSettingsUi()
                            Toast.makeText(
                                this@MainActivity,
                                if (chosenFps == 15) "💾 VIP DVR set to 15 FPS Storage Saver mode." else "🎥 VIP DVR set to 30 FPS Smooth mode.",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }
            vipRow.addView(vipFpsBtn)

            val vaultOptionsRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                val padV = (3 * density).toInt()
                setPadding(0, padV, 0, padV)
            }
            fun formatVisLabel(v: String): String = when (v) {
                "all" -> "🌐 Vault: All Shared"
                "starred_only" -> "⭐ Vault: Starred Only"
                "starred_and_public", "starred_and_private" -> "⭐+🌐 Vault: Star+Pub"
                "none", "private" -> "🚫 Vault: Login Req"
                else -> "🔒 Vault: Private (Pub Only)"
            }
            val btnVaultVisibility = Button(this).apply {
                val curVis = prefs.getString("gbl_vault_public_visibility_v701", "public_only") ?: "public_only"
                text = formatVisLabel(curVis)
                textSize = 9.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF1E293B.toInt())
                setTextColor(0xFFFBBF24.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    rightMargin = (4 * density).toInt()
                }
                setOnClickListener {
                    val options = arrayOf(
                        "🔒 Private (Only shows ones manually made public)",
                        "⭐ Starred only",
                        "⭐+🌐 Starred + Private (Starred or manually made public)",
                        "🌐 All videos shared (Overrides per-video private)",
                        "🚫 No videos shared without login"
                    )
                    val values = arrayOf("public_only", "starred_only", "starred_and_public", "all", "none")
                    val current = prefs.getString("gbl_vault_public_visibility_v701", "public_only") ?: "public_only"
                    val checkedIdx = values.indexOf(current).coerceAtLeast(0)
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("🌐 Public DVR Vault Visibility")
                        .setSingleChoiceItems(options, checkedIdx) { dialog, which ->
                            val chosen = values.getOrElse(which) { "public_only" }
                            dialog.dismiss()
                            text = formatVisLabel(chosen)
                            lifecycleScope.launch(Dispatchers.IO) {
                                val (_, msg) = OverlayService.updateVaultVisibilitySettingBlocking(prefs, gson, chosen)
                                withContext(Dispatchers.Main) {
                                    if (!isFinishing) Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }
            val btnVaultPassword = Button(this).apply {
                text = "🔒 Web Password / Login"
                textSize = 9.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF1E293B.toInt())
                setTextColor(0xFF38BDF8.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    val pwEdit = EditText(this@MainActivity).apply {
                        hint = "Enter Password (min 6 characters)"
                        inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD
                    }
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("🔒 Vault & Simulator Web Password")
                        .setMessage("Set a password for your Trainer ID so you can sign in on /vault or the Web Simulator with Username + Password, or sign in with an existing password:")
                        .setView(pwEdit)
                        .setPositiveButton("💾 Set / Save Password") { _, _ ->
                            val pw = pwEdit.text?.toString()?.trim().orEmpty()
                            if (pw.length < 6) {
                                Toast.makeText(this@MainActivity, "Password must be at least 6 characters.", Toast.LENGTH_SHORT).show()
                                return@setPositiveButton
                            }
                            lifecycleScope.launch(Dispatchers.IO) {
                                val (_, msg) = OverlayService.setOrLoginVaultPasswordBlocking(prefs, gson, pw, true)
                                withContext(Dispatchers.Main) {
                                    if (!isFinishing) Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                                }
                            }
                        }
                        .setNeutralButton("🔓 Login with Password") { _, _ ->
                            val pw = pwEdit.text?.toString()?.trim().orEmpty()
                            if (pw.isEmpty()) return@setNeutralButton
                            lifecycleScope.launch(Dispatchers.IO) {
                                val (_, msg) = OverlayService.setOrLoginVaultPasswordBlocking(prefs, gson, pw, false)
                                withContext(Dispatchers.Main) {
                                    if (!isFinishing) {
                                        setupOrUpdateReplayVaultSettingsUi()
                                        Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }
            vaultOptionsRow.addView(btnVaultVisibility)
            vaultOptionsRow.addView(btnVaultPassword)

            val statusTv = TextView(this).apply {
                setTextColor(0xFFE2E8F0.toInt())
                textSize = 10.5f
                setPadding(0, (6 * density).toInt(), 0, 0)
            }

            box.addView(titleTv)
            box.addView(subTv)
            box.addView(regBtn)
            box.addView(payRow1)
            box.addView(payRow2)
            box.addView(inputRow)
            box.addView(emailInput)
            box.addView(vaultOptionsRow)
            box.addView(vipRow)
            box.addView(statusTv)

            val idx = parentLayout.indexOfChild(textOneBattleDvrStatus)
            if (idx >= 0) {
                parentLayout.addView(box, idx + 1)
            } else {
                parentLayout.addView(box)
            }
            replayVaultSettingsBox = box
            textReplaySubHeader = subTv
            btnReplayRegisterId = regBtn
            layoutReplayPayRow1 = payRow1
            btnReplayStripeSupporter = btnStripeSupporter
            btnReplayStripePro = btnStripePro
            btnReplayStripeVip = btnStripeVip
            btnReplayBmcShop = btnBmcShop
            btnToggleUpgradeKeyEntry = toggleUpgradeKeyBtn
            layoutReplayKeyInputRow = inputRow
            editReplayUnlockKey = keyInput
            editReplayClaimEmail = emailInput
            textReplayVaultStatus = statusTv
            layoutVipLocalSliderRow = vipRow
            textVipLocalSliderLabel = vipLabel
            seekVipLocalSlider = vipSeek
            btnVipFpsMode = vipFpsBtn
        }

        val tier = OverlayService.getEffectiveReplayTierStatic(prefs)
        val hasActiveMembership = tier == "supporter" || tier == "pro" || tier == "vip"

        // Dynamically show/hide checkout buttons & key entry based on active tier
        textReplaySubHeader?.visibility = if (hasActiveMembership) android.view.View.GONE else android.view.View.VISIBLE
        btnReplayRegisterId?.visibility = if (hasActiveMembership) android.view.View.GONE else android.view.View.VISIBLE

        when (tier) {
            "vip" -> {
                layoutReplayPayRow1?.visibility = android.view.View.GONE
                btnReplayBmcShop?.visibility = android.view.View.GONE
                btnToggleUpgradeKeyEntry?.visibility = android.view.View.VISIBLE
                btnToggleUpgradeKeyEntry?.text = if (isUpgradeKeyEntryExpanded) "✖️ Hide Key Input" else "🔄 Update / Renew Key"
            }
            "pro" -> {
                layoutReplayPayRow1?.visibility = android.view.View.VISIBLE
                btnReplayStripeSupporter?.visibility = android.view.View.GONE
                btnReplayStripePro?.visibility = android.view.View.GONE
                btnReplayStripeVip?.visibility = android.view.View.VISIBLE
                btnReplayBmcShop?.visibility = android.view.View.GONE
                btnToggleUpgradeKeyEntry?.visibility = android.view.View.VISIBLE
                btnToggleUpgradeKeyEntry?.text = if (isUpgradeKeyEntryExpanded) "✖️ Hide Key Input" else "🔑 Enter Upgrade Key"
            }
            "supporter" -> {
                layoutReplayPayRow1?.visibility = android.view.View.VISIBLE
                btnReplayStripeSupporter?.visibility = android.view.View.GONE
                btnReplayStripePro?.visibility = android.view.View.VISIBLE
                btnReplayStripeVip?.visibility = android.view.View.VISIBLE
                btnReplayBmcShop?.visibility = android.view.View.VISIBLE
                btnToggleUpgradeKeyEntry?.visibility = android.view.View.VISIBLE
                btnToggleUpgradeKeyEntry?.text = if (isUpgradeKeyEntryExpanded) "✖️ Hide Key Input" else "🔑 Enter Upgrade Key"
            }
            else -> {
                layoutReplayPayRow1?.visibility = android.view.View.VISIBLE
                btnReplayStripeSupporter?.visibility = android.view.View.VISIBLE
                btnReplayStripePro?.visibility = android.view.View.VISIBLE
                btnReplayStripeVip?.visibility = android.view.View.VISIBLE
                btnReplayBmcShop?.visibility = android.view.View.VISIBLE
                btnToggleUpgradeKeyEntry?.visibility = android.view.View.GONE
            }
        }

        val showKeyInputs = !hasActiveMembership || isUpgradeKeyEntryExpanded
        layoutReplayKeyInputRow?.visibility = if (showKeyInputs) android.view.View.VISIBLE else android.view.View.GONE
        editReplayClaimEmail?.visibility = if (showKeyInputs) android.view.View.VISIBLE else android.view.View.GONE
        if (!showKeyInputs) {
            editReplayUnlockKey?.setText("")
        }

        val maxLocal = OverlayService.getMaxLocalDvrBattlesForTierStatic(prefs)
        val effFps = OverlayService.getEffectiveDvrFpsForTierStatic(prefs)
        val tierBadge = when (tier) {
            "vip" -> "👑 VIP / Coach Pass Active (${effFps} FPS DVR • 🛡️ Shield HUD • $maxLocal Local Slider • 150 Cloud + 25 ⭐ Pinned • 365d • All Cups + Alt Moves)"
            "pro" -> "🏅 Legend Pro Pass Active (15 FPS DVR • 🛡️ Shield HUD • 25 Local • 50 Cloud + 10 ⭐ Pinned • 30d • All Cups + ⚡ Alt Movesets)"
            "supporter" -> "🛡️ Lifetime Supporter / Alumni Active (🛡️ Shield Decision HUD • 5 Local (15 FPS) • 365d Past Pinned Cloud • Core 3 Leagues • Lifetime Battle Logs)"
            else -> "🆓 Free / Community Tier (1 Local Video (15 FPS) • GL & ML 1-Team Anti-Meta • Current Season + 14d Grace)"
        }
        layoutVipLocalSliderRow?.visibility = if (tier == "vip") android.view.View.VISIBLE else android.view.View.GONE
        if (tier == "vip") {
            val savedLimit = prefs.getInt(OverlayService.PREFS_KEY_VIP_LOCAL_DVR_LIMIT, OverlayService.DEFAULT_VIP_LOCAL_DVR_LIMIT).coerceIn(25, 100)
            textVipLocalSliderLabel?.text = "👑 VIP Local On-Device DVR Ring Buffer: $savedLimit Battles (25–100 Configurable)"
            seekVipLocalSlider?.progress = savedLimit - 25
            val curFps = prefs.getInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, OverlayService.DEFAULT_VIP_DVR_FPS_MODE)
            btnVipFpsMode?.text = if (curFps == 15) {
                "💾 VIP DVR Framerate: 15 FPS Storage Saver (~14 MB/battle • saves ~30% storage)"
            } else {
                "🎥 VIP DVR Framerate: 30 FPS Smooth Default (~20 MB/battle • <=30 MB max)"
            }
        }

        val localDir = java.io.File(filesDir, "dvr_replays")
        val localCount = localDir.listFiles { f -> f.isFile && f.name.endsWith("_video.mp4") }?.size ?: 0
        val localMb = (localDir.listFiles()?.sumOf { it.length() } ?: 0L).toDouble() / (1024.0 * 1024.0)
        val vaultMap = OverlayService.loadReplayVaultMapStatic(prefs, gson)
        val cloudCount = vaultMap.values.count { it.shareId.isNotBlank() }
        val pinnedCount = vaultMap.values.count { it.isPinned }
        val ghToken = OverlayService.getEffectiveSyncToken(prefs)
        val ghUsername = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        val syncSecurityLine = if (ghToken.isNotEmpty() && ghUsername.isNotEmpty()) {
            "🔒 Key Security: Hidden & AES-256-GCM Encrypted (Android Keystore + @$ghUsername's Private GitHub Vault)"
        } else if (hasActiveMembership) {
            "🔒 Key Security: Hidden & AES-256-GCM Encrypted in Android Hardware Keystore"
        } else {
            "📴 Offline-Ready: Verified tier is cached locally on-device (Sign in with GitHub above for multi-device sync)"
        }
        textReplayVaultStatus?.text = String.format(
            java.util.Locale.US,
            "%s\n📱 On-Device Replays: %d/%d video(s) (%.1f MB) • ☁️ Cloud R2 Replays: %d • ⭐ Pinned: %d\n%s",
            tierBadge,
            localCount,
            maxLocal,
            localMb,
            cloudCount,
            pinnedCount,
            syncSecurityLine
        )
    }

    private fun retryPendingDvrBundlesInBackground() {
        if (!OverlayService.hasCustomScreenNameForVideoLoggingStatic(prefs)) return
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                OverlayService.verifyReplayUnlockKeyBlocking(prefs, gson)
                withContext(Dispatchers.Main) {
                    if (!isFinishing && ::prefs.isInitialized) {
                        setupOrUpdateReplayVaultSettingsUi()
                    }
                }
            } catch (_: Exception) {}

            val pendingDvrCount = OverlayService.countPendingCachedDvrBundlesStatic(cacheDir)
            if (pendingDvrCount <= 0) return@launch
            val (uploadedDvrCount, _) = OverlayService.retryPendingCachedDvrBundlesBlocking(cacheDir, prefs, gson)
            if (uploadedDvrCount > 0) {
                withContext(Dispatchers.Main) {
                    if (!isFinishing && ::prefs.isInitialized) {
                        updateAiTelemetryStatusUi()
                        Toast.makeText(
                            this@MainActivity,
                            "🎥 Recovered & uploaded $uploadedDvrCount queued 1-Battle DVR video(s)!",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }
        }
    }

    private fun triggerManualAiTelemetryUpload(silentIfEmpty: Boolean) {
        val pendingLogs = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson)
        val pendingSettings = OverlayService.loadPendingSettingsChangesStatic(prefs, gson)
        val pendingDvrCount = OverlayService.countPendingCachedDvrBundlesStatic(cacheDir)
        if (pendingLogs.isEmpty() && pendingSettings.isEmpty() && pendingDvrCount <= 0) {
            updateAiTelemetryStatusUi()
            if (!silentIfEmpty) {
                Toast.makeText(
                    this,
                    "✅ Queue is already empty (0 pending AI/anomaly logs, DVR videos, or settings changes — all uploaded & purged).",
                    Toast.LENGTH_SHORT
                ).show()
            }
            return
        }
        val queuedCount = pendingLogs.size
        val queuedSettingsCount = pendingSettings.size
        textAiTelemetryStatus.text = "⏳ Uploading $queuedCount battle logs, $pendingDvrCount DVR video(s) & $queuedSettingsCount settings changes..."
        lifecycleScope.launch(Dispatchers.IO) {
            var uploadedDvrCount = 0
            var dvrUploadDetail = ""
            if (pendingDvrCount > 0 && OverlayService.hasCustomScreenNameForVideoLoggingStatic(prefs)) {
                val (dCount, dMsg) = OverlayService.retryPendingCachedDvrBundlesBlocking(cacheDir, prefs, gson)
                uploadedDvrCount = dCount
                dvrUploadDetail = dMsg
            }
            if (queuedSettingsCount > 0) {
                OverlayService.uploadSettingsChangeHistoryBlocking(
                    prefs = prefs,
                    gson = gson
                )
            }
            val (ok, msg) = if (queuedCount > 0) {
                OverlayService.uploadPendingAiTelemetryBatchBlocking(
                    prefs = prefs,
                    gson = gson,
                    forceUpload = true,
                    minBattlesRequired = 1
                )
            } else if (uploadedDvrCount > 0 || queuedSettingsCount > 0) {
                true to "Uploaded $uploadedDvrCount DVR video(s) & $queuedSettingsCount settings change(s)"
            } else {
                false to dvrUploadDetail.ifBlank { "Uploaded 0 DVR video(s) & 0 settings change(s)" }
            }
            withContext(Dispatchers.Main) {
                updateAiTelemetryStatusUi()
                setupOrUpdateReplayVaultSettingsUi()
                renderBattleLogPage()
                if (ok || uploadedDvrCount > 0) {
                    val dvrSuffix = if (uploadedDvrCount > 0) ", $uploadedDvrCount DVR video(s)" else ""
                    Toast.makeText(
                        this@MainActivity,
                        "✅ Uploaded $queuedCount AI/anomaly battle logs$dvrSuffix & $queuedSettingsCount settings changes!",
                        Toast.LENGTH_LONG
                    ).show()
                } else if (!silentIfEmpty) {
                    Toast.makeText(
                        this@MainActivity,
                        if (msg.startsWith("⚠️") || msg.startsWith("📶")) msg else "⚠️ Upload failed: $msg",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun maybeShowFirstRunAiTelemetryOptInPrompt() {
        val alreadyShown = prefs.getBoolean(OverlayService.PREFS_KEY_AI_TELEMETRY_ONBOARDING_SHOWN, false)
        if (alreadyShown) return
        prefs.edit()
            .putBoolean(OverlayService.PREFS_KEY_AI_TELEMETRY_ONBOARDING_SHOWN, true)
            .putBoolean(
                OverlayService.PREFS_KEY_AUTO_UPLOAD_AI_LOGS,
                prefs.getBoolean(OverlayService.PREFS_KEY_AUTO_UPLOAD_AI_LOGS, OverlayService.DEFAULT_AUTO_UPLOAD_AI_LOGS)
            )
            .apply()
        updateAiTelemetryStatusUi()
    }

    private fun handleGitHubLoginButtonTap() {
        val token = OverlayService.getEffectiveSyncToken(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        if (token.isNotEmpty()) {
            val userDisplay = if (username.isNotEmpty()) "@$username" else "your GitHub account"
            AlertDialog.Builder(this)
                .setTitle("☁️ GitHub Cloud Sync ($userDisplay)")
                .setMessage("Your device is signed in to $userDisplay and automatically syncs Battle Logs, Teams & App Settings across your devices.")
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
                        .remove(OverlayService.PREFS_KEY_SYNC_GITHUB_USER_ID)
                        .remove(PREFS_KEY_SYNC_GIST_ID)
                        .apply()
                    editSyncGithubToken.setText("")
                    editSyncGistId.setText("")
                    updateSyncStatusUi()
                    setupOrUpdateReplayVaultSettingsUi()
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
                OverlayService.setEffectiveSyncToken(prefs, tokenOrErr)
                prefs.edit()
                    .remove("pending_github_device_code")
                    .remove("pending_github_device_expires_at")
                    .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                    .apply()
                withContext(Dispatchers.Main) {
                    editSyncGithubToken.setText("")
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
                        OverlayService.setEffectiveSyncToken(prefs, tokenOrErr)
                        prefs.edit()
                            .remove("pending_github_device_code")
                            .remove("pending_github_device_expires_at")
                            .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                            .apply()
                        withContext(Dispatchers.Main) {
                            editSyncGithubToken.setText("")
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
            // Also flush any queued DVR bundles & pending AI telemetry logs when syncing Battle Log
            var recoveredDvrCount = 0
            try {
                if (OverlayService.countPendingCachedDvrBundlesStatic(cacheDir) > 0 &&
                    OverlayService.hasCustomScreenNameForVideoLoggingStatic(prefs)
                ) {
                    val (dCount, _) = OverlayService.retryPendingCachedDvrBundlesBlocking(cacheDir, prefs, gson)
                    recoveredDvrCount = dCount
                }
                if (OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).isNotEmpty()) {
                    OverlayService.uploadPendingAiTelemetryBatchBlocking(
                        prefs = prefs,
                        gson = gson,
                        forceUpload = true,
                        minBattlesRequired = 1
                    )
                }
            } catch (_: Exception) {}
            val (ok, msg) = OverlayService.syncWithGitHubGistBlocking(prefs, gson)
            withContext(Dispatchers.Main) {
                btnSyncDevicesSettings.isEnabled = true
                btnSyncBattleLog.isEnabled = true
                editSyncGistId.setText(prefs.getString(PREFS_KEY_SYNC_GIST_ID, "") ?: "")
                updateTrainerScreenNameUi()
                ensureRequiredScreenNameOrPrompt()
                updateSyncStatusUi()
                updateAiTelemetryStatusUi()
                setupOrUpdateReplayVaultSettingsUi()
                applyCurrentAppTheme(notifyOverlay = true)
                refreshPresetsUi()
                setupBattleLogFilters()
                renderBattleLogPage()
                val dvrNote = if (recoveredDvrCount > 0) " • 🎥 Uploaded $recoveredDvrCount queued DVR video(s)" else ""
                if (!silent) {
                    Toast.makeText(this@MainActivity, "$msg$dvrNote", Toast.LENGTH_LONG).show()
                } else if (ok && (!msg.contains("+0 from other devices") || !msg.contains("+0 updated") || recoveredDvrCount > 0)) {
                    Toast.makeText(this@MainActivity, "☁️ Auto-synced on open: $msg$dvrNote", Toast.LENGTH_SHORT).show()
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

    /**
     * Remaps legacy `"MEGA MASTER LEAGUE"` -> `"Mega Master League (10000)"`, ensures `"Mega Master League (10000)"`
     * is selected in GBL pinned metas, removes hardcoded Show 6 Great League defaults, and normalizes Battle Frontier
     * forced cups to ALL CAPS across teams, rosters, and battle logs.
     */
    private fun runV511LeagueRemapAndCleanup() {
        try {
            if (!prefs.getBoolean(OverlayService.PREFS_KEY_V511_LEAGUE_REMAP_DONE, false)) {
                prefs.edit().putBoolean(OverlayService.PREFS_KEY_V511_LEAGUE_REMAP_DONE, true).apply()
            }

            val presetType = object : TypeToken<List<TeamPreset>>() {}.type
            val logType = object : TypeToken<List<BattleLogEntry>>() {}.type
            val rosterType = object : TypeToken<List<OverlayService.Companion.Show6RosterPreset>>() {}.type

            // 1. Remap GBL Teams
            prefs.getString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, null)?.takeIf { it.isNotBlank() }?.let { raw ->
                val list: List<TeamPreset>? = try { gson.fromJson(raw, presetType) } catch (_: Exception) { null }
                if (!list.isNullOrEmpty()) {
                    var changed = false
                    val updated = list.map { p ->
                        val newLg = OverlayService.remapLegacyLeagueForModeStatic(p.league, isShow6 = false)
                        if (newLg != p.league) {
                            changed = true
                            p.copy(league = newLg)
                        } else p
                    }
                    if (changed) {
                        prefs.edit().putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(updated)).apply()
                    }
                }
            }

            // 2. Remap Show 6 Trios & remove hardcoded Show 6 Great League default (`show6-preset3-gl-1`)
            prefs.getString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, null)?.takeIf { it.isNotBlank() }?.let { raw ->
                val list: List<TeamPreset>? = try { gson.fromJson(raw, presetType) } catch (_: Exception) { null }
                if (!list.isNullOrEmpty()) {
                    var changed = false
                    val updated = list.filter { p ->
                        val removeHardcodedGl = p.id == "show6-preset3-gl-1"
                        if (removeHardcodedGl) changed = true
                        !removeHardcodedGl
                    }.map { p ->
                        val newLg = OverlayService.remapLegacyLeagueForModeStatic(p.league, isShow6 = true)
                        if (newLg != p.league) {
                            changed = true
                            p.copy(league = newLg)
                        } else p
                    }
                    if (changed) {
                        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, gson.toJson(updated)).apply()
                    }
                }
            }

            // 3. Remap Show 6 Rosters of 6 & remove hardcoded Show 6 Great League defaults (`show6-gl-bf-default`, `show6-opp-gl-default`)
            for (rKey in listOf(OverlayService.PREFS_KEY_SHOW6_ROSTERS_OF_6, OverlayService.PREFS_KEY_SHOW6_OPPONENT_ROSTERS_OF_6)) {
                prefs.getString(rKey, null)?.takeIf { it.isNotBlank() }?.let { raw ->
                    val list: List<OverlayService.Companion.Show6RosterPreset>? = try { gson.fromJson(raw, rosterType) } catch (_: Exception) { null }
                    if (!list.isNullOrEmpty()) {
                        var changed = false
                        val updated = list.filter { r ->
                            val removeHardcodedGl = r.id == "show6-gl-bf-default" || r.id == "show6-opp-gl-default"
                            if (removeHardcodedGl) changed = true
                            !removeHardcodedGl
                        }.map { r ->
                            val newLg = OverlayService.remapLegacyLeagueForModeStatic(r.league, isShow6 = true)
                            if (newLg != r.league) {
                                changed = true
                                r.copy(league = newLg)
                            } else r
                        }
                        if (changed) {
                            prefs.edit().putString(rKey, gson.toJson(updated)).apply()
                        }
                    }
                }
            }

            // 4. Remap GBL & Show 6 Battle Logs
            for ((lKey, isS6) in listOf(OverlayService.PREFS_KEY_BATTLE_LOGS to false, OverlayService.PREFS_KEY_SHOW6_BATTLE_LOGS to true)) {
                prefs.getString(lKey, null)?.takeIf { it.isNotBlank() }?.let { raw ->
                    val list: List<BattleLogEntry>? = try { gson.fromJson(raw, logType) } catch (_: Exception) { null }
                    if (!list.isNullOrEmpty()) {
                        var changed = false
                        val updated = list.map { b ->
                            val newLg = OverlayService.remapLegacyLeagueForModeStatic(b.league, isShow6 = isS6)
                            if (newLg != b.league) {
                                changed = true
                                b.copy(league = newLg)
                            } else b
                        }
                        if (changed) {
                            prefs.edit().putString(lKey, gson.toJson(updated)).apply()
                        }
                    }
                }
            }
        } catch (_: Exception) {}
    }

    private fun loadBattleLogs(): List<BattleLogEntry> {
        val raw = prefs.getString(PREFS_KEY_BATTLE_LOGS, null) ?: return emptyList()
        val isShow6 = isShow6CombatMode()
        return try {
            val type = object : TypeToken<List<BattleLogEntry>>() {}.type
            val parsed: List<BattleLogEntry> = gson.fromJson<List<BattleLogEntry>>(raw, type) ?: emptyList()
            val deleted = loadDeletedLogIds().toSet()
            parsed
                .filter { it.id !in deleted }
                .map { b ->
                    val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(b.league, isShow6)
                    if (remappedLg != b.league) b.copy(league = remappedLg) else b
                }
                .sortedByDescending { it.timestampMs }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveBattleLogs(logs: List<BattleLogEntry>) {
        // Ensure Main Battle Logs remain compact (timelineEvents stored exclusively in 7-day AI Training Logs)
        val isShow6 = isShow6CombatMode()
        val compact = logs.map { b ->
            val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(b.league, isShow6)
            val base = if (remappedLg != b.league) b.copy(league = remappedLg) else b
            if (base.timelineEvents.isEmpty()) base else base.copy(timelineEvents = emptyList())
        }.sortedByDescending { it.timestampMs }
        prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(compact)).apply()
    }

    private fun showReassignSelectedBattlesLeagueDialog(targetIds: Set<String>) {
        if (targetIds.isEmpty()) {
            Toast.makeText(this, "Select at least 1 battle card first.", Toast.LENGTH_SHORT).show()
            return
        }
        val isShow6 = isShow6CombatMode()
        val enabledLeagues = if (isShow6) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }
        val catalogLeagues = OverlayService.getLimitedMetaCatalogStatic(prefs).map { it.leagueKey }
        val allChoices = (enabledLeagues + catalogLeagues).distinct()
        if (allChoices.isEmpty()) return

        var chosenIndex = 0
        val labels = allChoices.map { lg ->
            val inEnabled = enabledLeagues.any { it.equals(lg, ignoreCase = true) }
            if (inEnabled) "🟢 $lg" else "📌 $lg (Will also pin cup)"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("🏷️ Move ${targetIds.size} Battle(s) to League / Cup")
            .setSingleChoiceItems(labels, 0) { _, which ->
                chosenIndex = which
            }
            .setPositiveButton("💾 Reassign League") { _, _ ->
                val targetLeague = allChoices.getOrElse(chosenIndex) { allChoices.first() }
                // If user picked an unpinned limited meta, automatically pin it so the moved battles appear in active filters
                if (enabledLeagues.none { it.equals(targetLeague, ignoreCase = true) }) {
                    if (isShow6) {
                        OverlayService.setPinnedShow6LimitedMetasStatic(
                            prefs,
                            OverlayService.getPinnedShow6LimitedMetasStatic(prefs) + targetLeague
                        )
                    } else {
                        OverlayService.setPinnedGblLimitedMetasStatic(
                            prefs,
                            OverlayService.getPinnedGblLimitedMetasStatic(prefs) + targetLeague
                        )
                    }
                }
                val nowMs = System.currentTimeMillis()
                val allLogs = loadBattleLogs()
                var movedCount = 0
                val updatedLogs = allLogs.map { entry ->
                    if (entry.id in targetIds) {
                        movedCount++
                        entry.copy(league = targetLeague, updatedAt = nowMs)
                    } else {
                        entry
                    }
                }
                saveBattleLogs(updatedLogs)

                // Also keep any pending AI telemetry records in sync with the corrected league
                try {
                    val pendingAi = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson)
                    if (pendingAi.any { it.battleId in targetIds }) {
                        val updatedAi = pendingAi.map { rec ->
                            if (rec.battleId in targetIds) rec.copy(league = targetLeague) else rec
                        }
                        OverlayService.savePendingAiTelemetryLogsStatic(prefs, gson, updatedAi)
                    }
                } catch (_: Exception) {}

                selectedBattleLogIds.clear()
                isBattleLogMultiSelectMode = false
                setupBattleLogFilters()
                renderBattleLogPage()
                refreshPresetsUi()
                triggerTwoDeviceCloudSync(silent = true)
                Toast.makeText(
                    this,
                    "✅ Reassigned $movedCount battle(s) to $targetLeague!",
                    Toast.LENGTH_LONG
                ).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /**
     * v5.10: Loads pending AI & Anomaly Telemetry records (`gbl_ai_telemetry_pending_v1`) mapped to
     * `AiTrainingLogRecord` for interactive replay and quality calculations before they are uploaded & purged.
     */
    private fun loadAiTrainingLogs(): List<OverlayService.AiTrainingLogRecord> {
        val pending = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson)
        val deleted = loadDeletedLogIds().toSet()
        return pending
            .filter { it.battleId !in deleted }
            .map { rec ->
                OverlayService.AiTrainingLogRecord(
                    battleId = rec.battleId,
                    timestampMs = rec.timestampMs,
                    league = rec.league,
                    userTeamName = rec.teamName,
                    userPokemon = rec.userTeamSpecs.map { it.species },
                    opponents = rec.oppTeamSpecs.map { it.species },
                    leadMatchup = rec.leadMatchup,
                    result = rec.result,
                    battleDurationSec = rec.battleDurationSec,
                    adherenceRatePct = rec.adherenceRatePct,
                    recommendationsIssuedCount = rec.recommendationsIssuedCount,
                    recommendationsFollowedCount = rec.recommendationsFollowedCount,
                    timelineEvents = rec.timelineEvents
                )
            }
    }

    private fun saveAiTrainingLogs(logs: List<OverlayService.AiTrainingLogRecord>) {
        // v5.10: AI logs are stored in PREFS_KEY_PENDING_AI_TELEMETRY_V510 and purged automatically upon upload to GitHub.
        prefs.edit().remove(OverlayService.PREFS_KEY_AI_TRAINING_LOGS).apply()
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
            OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
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

    data class DeletedShow6RosterTrashItem(
        val roster: OverlayService.Companion.Show6RosterPreset,
        val isOpponent: Boolean = false,
        val deletedAtMs: Long = System.currentTimeMillis()
    )

    private fun loadDeletedShow6RostersTrash(): List<DeletedShow6RosterTrashItem> {
        val raw = prefs.getString(OverlayService.PREFS_KEY_SHOW6_DELETED_ROSTERS_TRASH, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<DeletedShow6RosterTrashItem>>() {}.type
            (gson.fromJson<List<DeletedShow6RosterTrashItem>>(raw, type) ?: emptyList()).distinctBy { "${it.isOpponent}_${it.roster.id}" }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveDeletedShow6RostersTrash(items: List<DeletedShow6RosterTrashItem>) {
        val trimmed = items.distinctBy { "${it.isOpponent}_${it.roster.id}" }.take(50)
        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_DELETED_ROSTERS_TRASH, gson.toJson(trimmed)).apply()
        updateTrashButtonsUi()
    }

    private fun restoreShow6RosterFromTrash(item: DeletedShow6RosterTrashItem) {
        val remaining = loadDeletedShow6RostersTrash().filterNot { it.isOpponent == item.isOpponent && it.roster.id == item.roster.id }
        saveDeletedShow6RostersTrash(remaining)
        if (item.isOpponent) {
            val current = loadShow6OpponentRostersOf6().toMutableList()
            current.removeAll { it.id == item.roster.id }
            current.add(0, item.roster)
            saveShow6OpponentRostersOf6(current)
        } else {
            val current = loadShow6RostersOf6().toMutableList()
            current.removeAll { it.id == item.roster.id }
            current.add(0, item.roster)
            saveShow6RostersOf6(current)
        }
        setupShow6ModeHubUi()
        updateTrashButtonsUi()
    }

    private fun updateTrashButtonsUi() {
        if (::btnTrashTeams.isInitialized) {
            val extraShow6Rosters = if (isShow6CombatMode()) loadDeletedShow6RostersTrash().size else 0
            val count = loadDeletedTeamsTrash().size + extraShow6Rosters
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
        val rosterTrashList = if (isShow6CombatMode()) loadDeletedShow6RostersTrash() else emptyList()
        val modeLabel = if (isShow6CombatMode()) "Show 6" else "GBL"
        if (trashList.isEmpty() && rosterTrashList.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("🗑️ Deleted $modeLabel Teams Trash Bin")
                .setMessage("No deleted $modeLabel teams in Trash. Show 6 Mode and Standard GBL Mode maintain separate Trash bins.")
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

        for (rItem in rosterTrashList) {
            val r = rItem.roster
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
            val tag = if (rItem.isOpponent) "⚔️ Opp Pick-6" else "🛡️ My Pick-6"
            val titleTv = TextView(this).apply {
                text = "[$tag] ${r.name} (${r.league})"
                setTextColor(if (rItem.isOpponent) 0xFFFDA4AF.toInt() else 0xFF6EE7B7.toInt())
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val monsTv = TextView(this).apply {
                text = r.pokemon.joinToString(" • ")
                setTextColor(0xFF94A3B8.toInt())
                textSize = 11.5f
                setPadding(0, (3 * density).toInt(), 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
            }
            val restoreBtn = Button(this).apply {
                text = "♻️ Restore Pick-6"
                textSize = 11f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setOnClickListener {
                    restoreShow6RosterFromTrash(rItem)
                    Toast.makeText(this@MainActivity, "Restored '${r.name}'!", Toast.LENGTH_SHORT).show()
                    dialogRef?.dismiss()
                }
            }
            val deleteForeverBtn = Button(this).apply {
                text = "✕ Delete Forever"
                textSize = 11f
                setTextColor(0xFFFCA5A5.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF450A0A.toInt())
                setOnClickListener {
                    saveDeletedShow6RostersTrash(loadDeletedShow6RostersTrash().filterNot { it.isOpponent == rItem.isOpponent && it.roster.id == r.id })
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

        val totalTrashCount = trashList.size + rosterTrashList.size
        dialogRef = AlertDialog.Builder(this)
            .setTitle("🗑️ Deleted $modeLabel Teams ($totalTrashCount)")
            .setView(scroll)
            .setPositiveButton("♻️ Restore All") { _, _ ->
                rosterTrashList.forEach { restoreShow6RosterFromTrash(it) }
                trashList.forEach { restoreTeamPresetFromTrash(it) }
                Toast.makeText(this, "Restored $totalTrashCount $modeLabel team(s)!", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("🗑️ Empty Trash") { _, _ ->
                saveDeletedTeamsTrash(emptyList())
                if (isShow6CombatMode()) saveDeletedShow6RostersTrash(emptyList())
                Toast.makeText(this, "$modeLabel team trash emptied", Toast.LENGTH_SHORT).show()
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

    private fun formatTier2CupChipLabel(leagueKey: String): String {
        val u = leagueKey.trim().uppercase()
        return when {
            u == "GREAT LEAGUE" || u == "ULTRA LEAGUE" || u == "MASTER LEAGUE" -> "Open / Standard"
            u.contains("MEGA") -> "Mega ($leagueKey)"
            else -> leagueKey
        }
    }

    private fun sortCupsWithinTier(cups: List<String>): List<String> {
        return cups.distinct().sortedWith(
            compareBy<String> { lg ->
                val u = lg.trim().uppercase()
                when {
                    u == "GREAT LEAGUE" || u == "ULTRA LEAGUE" || u == "MASTER LEAGUE" -> 0
                    u.contains("MEGA") -> 1
                    else -> 2
                }
            }.thenBy { it }
        )
    }

    private fun setupBattleLogFilters() {
        if (!::spinnerLogFilterLeague.isInitialized || !::spinnerLogFilterCpTier.isInitialized) return
        isUpdatingLogFilterSpinners = true

        val isShow6 = isShow6CombatMode()
        val activeEnabledLeagues = (if (isShow6) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }).filterNot { OverlayService.isOldCupForModeStatic(it, isShow6, prefs) }

        val allLogs = loadBattleLogs()

        // Tier 1: CP Range (All, Great <=1500, Ultra 2500, Master 10000)
        val cpTierKeys = listOf("ALL", "GREAT", "ULTRA", "MASTER")
        val cpTierLabels = listOf(
            "All CP (${allLogs.size})",
            "Great ≤1500 (${allLogs.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "GREAT" }})",
            "Ultra 2500 (${allLogs.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "ULTRA" }})",
            "Master 10000 (${allLogs.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "MASTER" }})"
        )
        spinnerLogFilterCpTier.adapter = createThemedSpinnerAdapter(cpTierLabels)
        val cpTierIdx = cpTierKeys.indexOfFirst { it.equals(selectedLogCpTierFilter, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
        if (cpTierIdx == 0 && !selectedLogCpTierFilter.equals("ALL", ignoreCase = true)) {
            selectedLogCpTierFilter = "ALL"
        }
        spinnerLogFilterCpTier.setSelection(cpTierIdx, false)

        // Tier 2: Cup / Format within selected CP tier (defaults to showing all cups in that CP range first)
        val dynamicLabels = mutableListOf<String>()
        val dynamicKeys = mutableListOf<String>()
        if (selectedLogCpTierFilter == "ALL") {
            val oldCupLogsCount = allLogs.count { OverlayService.isOldCupForModeStatic(it.league, isShow6, prefs) }
            dynamicLabels.add("All Cups (${allLogs.size})")
            dynamicKeys.add("ALL")
            for (lg in sortCupsWithinTier(activeEnabledLeagues)) {
                val c = allLogs.count { it.league.equals(lg, ignoreCase = true) }
                dynamicLabels.add("$lg ($c)")
                dynamicKeys.add(lg)
            }
            if (oldCupLogsCount > 0 || selectedLogLeagueFilter == "OLD_CUPS") {
                dynamicLabels.add("Old Cups ($oldCupLogsCount)")
                dynamicKeys.add("OLD_CUPS")
            }
        } else {
            val tierKey = selectedLogCpTierFilter.uppercase()
            val tierDisplayName = when (tierKey) {
                "GREAT" -> "Great"
                "ULTRA" -> "Ultra"
                else -> "Master"
            }
            val tierTotalLogs = allLogs.count { OverlayService.resolveLeagueCpTierStatic(it.league) == tierKey }
            val defaultTierCupKey = "TIER:$tierKey"
            dynamicLabels.add("All $tierDisplayName Cups ($tierTotalLogs)")
            dynamicKeys.add(defaultTierCupKey)

            val tierActiveCups = sortCupsWithinTier(
                activeEnabledLeagues.filter { OverlayService.resolveLeagueCpTierStatic(it) == tierKey }
            )
            for (lg in tierActiveCups) {
                val c = allLogs.count { it.league.equals(lg, ignoreCase = true) }
                dynamicLabels.add("${formatTier2CupChipLabel(lg)} ($c)")
                dynamicKeys.add(lg)
            }

            val tierOldCupCount = allLogs.count {
                OverlayService.resolveLeagueCpTierStatic(it.league) == tierKey &&
                    OverlayService.isOldCupForModeStatic(it.league, isShow6, prefs)
            }
            val tierOldKey = "OLD_CUPS:$tierKey"
            if (tierOldCupCount > 0 || selectedLogLeagueFilter.equals(tierOldKey, ignoreCase = true)) {
                dynamicLabels.add("Old Cups ($tierOldCupCount)")
                dynamicKeys.add(tierOldKey)
            }
        }

        val leagueLabels = dynamicLabels.toList()
        val leagueKeys = dynamicKeys.toList()
        spinnerLogFilterLeague.adapter = createThemedSpinnerAdapter(leagueLabels)
        var lgIdx = leagueKeys.indexOfFirst { it.equals(selectedLogLeagueFilter, ignoreCase = true) }
        if (lgIdx < 0) {
            lgIdx = 0
            selectedLogLeagueFilter = leagueKeys.firstOrNull() ?: "ALL"
        }
        spinnerLogFilterLeague.setSelection(lgIdx, false)

        val allPresets = loadPresets()
        val matchingPresets = allPresets.filter {
            OverlayService.matchesEncodedLeagueFilterStatic(it.league, selectedLogLeagueFilter, isShow6, prefs)
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

        spinnerLogFilterCpTier.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextCpTier = cpTierKeys.getOrElse(position) { "ALL" }
                if (nextCpTier != selectedLogCpTierFilter) {
                    selectedLogCpTierFilter = nextCpTier
                    selectedLogLeagueFilter = if (nextCpTier == "ALL") "ALL" else "TIER:$nextCpTier"
                    selectedLogTeamFilter = "ALL"
                    setupBattleLogFilters()
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        spinnerLogFilterLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextLg = leagueKeys.getOrElse(position) { if (selectedLogCpTierFilter == "ALL") "ALL" else "TIER:$selectedLogCpTierFilter" }
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
        val isShow6 = isShow6CombatMode()
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val nowMs = System.currentTimeMillis()
        val tier = if (::prefs.isInitialized) OverlayService.getEffectiveReplayTierStatic(prefs) else "free"
        val isPastGracePeriod = nowMs > (currSeason.startMs + 14L * 86_400_000L)
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
            if (tier == "free" && entry.timestampMs < currSeason.startMs && isPastGracePeriod) {
                return@filter false
            }
            val leagueOk = OverlayService.matchesEncodedLeagueFilterStatic(entry.league, leagueFilter, isShow6, prefs)
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

    private fun loadAndRenderHpDebounceUi() {
        if (!::btnHpDebounce2Samples.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val samples = OverlayService.activeHpDebounceSamples.coerceIn(2, 4)
        val tol = OverlayService.activeDebounceTolerancePct.coerceIn(0, 3)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        val activeTint = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
        val inactiveTint = android.content.res.ColorStateList.valueOf(theme.elevatedColor)

        val pairs = listOf(
            2 to btnHpDebounce2Samples,
            3 to btnHpDebounce3Samples,
            4 to btnHpDebounce4Samples
        )
        for ((count, btn) in pairs) {
            val isSelected = (samples == count)
            btn.backgroundTintList = if (isSelected) activeTint else inactiveTint
            btn.setTextColor(if (isSelected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
        }

        if (::btnDebounceTol0.isInitialized) {
            val tolPairs = listOf(
                0 to btnDebounceTol0,
                1 to btnDebounceTol1,
                2 to btnDebounceTol2,
                3 to btnDebounceTol3
            )
            for ((t, btn) in tolPairs) {
                val isSelected = (tol == t)
                btn.backgroundTintList = if (isSelected) activeTint else inactiveTint
                btn.setTextColor(if (isSelected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
            }
        }

        if (::tvHpDebounceSummary.isInitialized) {
            val modeDesc = when (samples) {
                2 -> "2 Matching Samples (Default • Fastest Response)"
                3 -> "3 Matching Samples (Balanced Noise Rejection)"
                else -> "4 Matching Samples (Strict Filtering)"
            }
            tvHpDebounceSummary.text =
                "• Active: $modeDesc (±$tol% Error Tolerance)\n" +
                "• Upward Self-Correction: Enabled (Recovers from low glitch readings)\n" +
                "• Shield Call Prompts: Always corrects with clean stable HP meters"
        }
    }

    private fun saveDebounceTolerancePct(tol: Int, showToast: Boolean) {
        val clamped = tol.coerceIn(0, 3)
        prefs.edit().putInt(OverlayService.PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, clamped).apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        OverlayService.recordDebounceSettingsChangeIfNeededStatic(
            prefs = prefs,
            gson = gson,
            triggerSource = "save_debounce_tolerance_pct",
            triggerImmediateUpload = true
        )
        loadAndRenderHpDebounceUi()
        updateAiTelemetryStatusUi()
        if (showToast) {
            Toast.makeText(
                this,
                "Saved Debounce Error Tolerance: ±$clamped%",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun saveHpDebounceSamples(samples: Int, showToast: Boolean) {
        val clamped = samples.coerceIn(2, 4)
        val tol = OverlayService.activeDebounceTolerancePct.coerceIn(0, 3)
        prefs.edit().putInt(OverlayService.PREFS_KEY_HP_DEBOUNCE_SAMPLES, clamped).apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        OverlayService.recordDebounceSettingsChangeIfNeededStatic(
            prefs = prefs,
            gson = gson,
            triggerSource = "save_hp_debounce_samples",
            triggerImmediateUpload = true
        )
        loadAndRenderHpDebounceUi()
        updateAiTelemetryStatusUi()
        if (showToast) {
            Toast.makeText(
                this,
                "Saved HP Bar Debounce: $clamped matching samples (±$tol% tolerance)",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun loadAndRenderEnergyDebounceUi() {
        if (!::btnDebounce2Samples.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val samples = OverlayService.activeEnergyDebounceSamples.coerceIn(2, 4)
        val leadMs = OverlayService.activeProactiveEnergyLeadMs
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

        if (::btnProactiveLead0.isInitialized &&
            ::btnProactiveLead200.isInitialized &&
            ::btnProactiveLead300.isInitialized &&
            ::btnProactiveLead400.isInitialized
        ) {
            val leadPairs = listOf(
                0 to btnProactiveLead0,
                200 to btnProactiveLead200,
                300 to btnProactiveLead300,
                400 to btnProactiveLead400
            )
            for ((ms, btn) in leadPairs) {
                val isSelected = (leadMs == ms)
                btn.backgroundTintList = if (isSelected) activeTint else inactiveTint
                btn.setTextColor(if (isSelected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
            }
        }

        if (::textProactiveEnergyLeadDesc.isInitialized) {
            textProactiveEnergyLeadDesc.text = when (leadMs) {
                0 -> "Off (0ms) — Waits for debounced circle confirmation; continues charging opponent at 100% player energy with charge-scene gates"
                300 -> "Active: 300ms — Advances player & opponent energy 300ms early (including opp clock at 100E); auto-rolls back on charge-scene cut or >500ms lag"
                400 -> "Active: 400ms — Advances player & opponent energy 400ms early (including opp clock at 100E); auto-rolls back on charge-scene cut or >500ms lag"
                else -> "Default: 200ms — Advances player & opponent energy ~200ms early (keeps charging opp at 100E with charge-scene gates); auto-rolls back if >500ms lag"
            }
        }

        if (::layoutAdminEnergyToastsCard.isInitialized) {
            val isAdmin = if (::prefs.isInitialized) OverlayService.isAdminTrainerStatic(prefs) else false
            layoutAdminEnergyToastsCard.visibility = if (isAdmin) android.view.View.VISIBLE else android.view.View.GONE
        }

        if (::btnToggleEnergyUpdateToasts.isInitialized && ::textEnergyUpdateToastsDesc.isInitialized) {
            if (toastsOn) {
                btnToggleEnergyUpdateToasts.text = "Toasts On"
                btnToggleEnergyUpdateToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
                btnToggleEnergyUpdateToasts.setTextColor(0xFFFFFFFF.toInt())
                textEnergyUpdateToastsDesc.text = "Active (👑 Admin): Persistent top-left pill showing ⚡ U: [M:%|H:%] • O: [M:%|H:%] dual-source energy & confidence"
            } else {
                btnToggleEnergyUpdateToasts.text = "Toasts Off"
                btnToggleEnergyUpdateToasts.backgroundTintList = inactiveTint
                btnToggleEnergyUpdateToasts.setTextColor(theme.secondaryTextColor)
                textEnergyUpdateToastsDesc.text = "Muted: Persistent dual-source energy & confidence battle toast hidden"
            }
        }

        if (::tvEnergyDebounceSummary.isInitialized) {
            val modeDesc = when (samples) {
                2 -> "2 Matching Samples (Default • Fastest Response, ±2% Fill Tolerance)"
                3 -> "3 Matching Samples (Balanced Noise Rejection, ±2% Fill Tolerance)"
                else -> "4 Matching Samples (Strict Filtering, ±2% Fill Tolerance)"
            }
            val leadSummary = when (leadMs) {
                0 -> "Off (0ms — Waits for debounced circle + 100E opp clock)"
                200 -> "200ms (Default • ~200ms early + charges opp at 100E with charge-scene gates)"
                else -> "${leadMs}ms (~${leadMs}ms early + charges opp at 100E with charge-scene gates)"
            }
            val toastStatus = if (toastsOn) "Enabled" else "Muted"
            tvEnergyDebounceSummary.text =
                "• Active: $modeDesc\n" +
                "• Proactive Fast-Move Energy Lead: $leadSummary\n" +
                "• Live Energy & Circle % Battle Toasts: $toastStatus"
        }
    }

    private fun saveProactiveEnergyLeadMs(leadMs: Int, showToast: Boolean) {
        val valid = leadMs.coerceIn(0, 400)
        prefs.edit().putInt(OverlayService.PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, valid).apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        OverlayService.recordDebounceSettingsChangeIfNeededStatic(
            prefs = prefs,
            gson = gson,
            triggerSource = "save_proactive_energy_lead_ms",
            triggerImmediateUpload = true
        )
        loadAndRenderEnergyDebounceUi()
        updateAiTelemetryStatusUi()
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        if (showToast) {
            val label = if (valid == 0) "Off (0ms)" else "${valid}ms early (with >500ms 1-turn rollback)"
            Toast.makeText(
                this,
                "Saved Proactive Fast-Move Energy Lead Time: $label",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun saveEnergyDebounceSamples(samples: Int, showToast: Boolean) {
        val clamped = samples.coerceIn(2, 4)
        prefs.edit().putInt(OverlayService.PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, clamped).apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        OverlayService.recordDebounceSettingsChangeIfNeededStatic(
            prefs = prefs,
            gson = gson,
            triggerSource = "save_energy_debounce_samples",
            triggerImmediateUpload = true
        )
        loadAndRenderEnergyDebounceUi()
        updateAiTelemetryStatusUi()
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
            OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
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
            PokemonSlot(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
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
            "All Time — Summary"
        )
        val keys = arrayOf("DAY", "YESTERDAY", "WEEK", "CURRENT_SEASON", "PREVIOUS_SEASON", "ALL_TIME")

        AlertDialog.Builder(this)
            .setTitle(if (isShareIntent) "📤 Share Battle Log Summary" else "📋 Copy Battle Log Summary")
            .setItems(options) { _, which ->
                val timeKey = keys.getOrElse(which) { "ALL_TIME" }
                val exportText = buildPlainTextExport(
                    allLogs,
                    selectedLogLeagueFilter,
                    selectedLogTeamFilter,
                    timeKey
                )
                if (isShareIntent) {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "SilphScope PvP Battle Log")
                        putExtra(Intent.EXTRA_TEXT, exportText)
                    }
                    startActivity(Intent.createChooser(sendIntent, "Share SilphScope PvP Battle Log"))
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

        // v6.06: Compute Lead Won Conversion, Lead-Loss Recovery Rate & Safe-Swap MVP
        if (::textLeadWonWinrate.isInitialized && ::textLeadLostRecovery.isInitialized && ::textSafeSwapMvp.isInitialized) {
            val favLogs = filtered.filter { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
            val favWins = favLogs.count { it.result.equals("WIN", ignoreCase = true) }
            val favLosses = favLogs.count { it.result.equals("LOSS", ignoreCase = true) }
            val favTotal = favWins + favLosses
            val favPct = if (favTotal > 0) Math.round((favWins.toDouble() / favTotal.toDouble()) * 100.0).toInt() else 0
            textLeadWonWinrate.text = if (favTotal == 0) "—% (0W-0L)" else "$favPct% (${favWins}W-${favLosses}L)"
            textLeadWonWinrate.setTextColor(
                when {
                    favTotal == 0 -> 0xFF94A3B8.toInt()
                    favPct >= 70 -> 0xFF34D399.toInt()
                    favPct >= 55 -> 0xFFFBBF24.toInt()
                    else -> 0xFFF43F5E.toInt()
                }
            )

            val negLogs = filtered.filter {
                it.leadMatchup.equals("NEGATIVE", ignoreCase = true) ||
                    (!it.leadMatchup.equals("FAVORABLE", ignoreCase = true) && it.firstSwapActor.equals("user", ignoreCase = true))
            }
            val negWins = negLogs.count { it.result.equals("WIN", ignoreCase = true) }
            val negLosses = negLogs.count { it.result.equals("LOSS", ignoreCase = true) }
            val negTotal = negWins + negLosses
            val negPct = if (negTotal > 0) Math.round((negWins.toDouble() / negTotal.toDouble()) * 100.0).toInt() else 0
            val recGrade = when {
                negTotal == 0 -> "—"
                negPct >= 45 -> "S"
                negPct >= 35 -> "A"
                negPct >= 25 -> "B"
                else -> "C"
            }
            textLeadLostRecovery.text = if (negTotal == 0) "—% (0W-0L)" else "$negPct% [$recGrade] (${negWins}W-${negLosses}L)"
            textLeadLostRecovery.setTextColor(
                when {
                    negTotal == 0 -> 0xFF94A3B8.toInt()
                    negPct >= 45 -> 0xFF34D399.toInt()
                    negPct >= 35 -> 0xFF38BDF8.toInt()
                    negPct >= 25 -> 0xFFFBBF24.toInt()
                    else -> 0xFFF43F5E.toInt()
                }
            )

            // Safe-Swap MVP: Identify the user safe-swap Pokémon with the best recovery record in lost/pivoted leads
            val swapStats = mutableMapOf<String, Pair<Int, Int>>() // speciesName -> (wins, total)
            for (entry in negLogs) {
                val isWin = entry.result.equals("WIN", ignoreCase = true)
                val isLoss = entry.result.equals("LOSS", ignoreCase = true)
                if (!isWin && !isLoss) continue
                val firstUserSwitchMon: String? = entry.timelineEvents.firstOrNull {
                    (it.type.equals("SWAP", ignoreCase = true) || it.type.equals("SWITCH", ignoreCase = true)) &&
                        it.actor.equals("user", ignoreCase = true)
                }?.let { ev ->
                    ev.pokemonIn?.takeIf { it.isNotBlank() } ?: ev.activePokemon?.takeIf { it.isNotBlank() }
                } ?: entry.userPokemon.getOrNull(1)?.takeIf { it.isNotBlank() }
                if (!firstUserSwitchMon.isNullOrBlank()) {
                    val key: String = firstUserSwitchMon
                    val prev = swapStats[key] ?: (0 to 0)
                    swapStats[key] = (prev.first + if (isWin) 1 else 0) to (prev.second + 1)
                }
            }
            val bestSwap = swapStats.entries
                .sortedWith(
                    compareByDescending<Map.Entry<String, Pair<Int, Int>>> { it.value.first }
                        .thenByDescending { it.value.first.toDouble() / it.value.second.coerceAtLeast(1).toDouble() }
                        .thenByDescending { it.value.second }
                )
                .firstOrNull()
            if (bestSwap != null && bestSwap.value.second > 0) {
                val (sWins, sTotal) = bestSwap.value
                val sPct = Math.round((sWins.toDouble() / sTotal.toDouble()) * 100.0).toInt()
                val shortMon = OverlayService.abbrPokeCompactStatic(bestSwap.key)
                textSafeSwapMvp.text = "$shortMon $sPct% ($sWins/${sTotal})"
                textSafeSwapMvp.setTextColor(if (sPct >= 40) 0xFFFBBF24.toInt() else 0xFFCBD5E1.toInt())
            } else {
                textSafeSwapMvp.text = "—"
                textSafeSwapMvp.setTextColor(0xFF94A3B8.toInt())
            }
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

        // Multi-Select Battle Log Reassignment Toolbar (allows moving mislogged battles to another cup/league)
        selectedBattleLogIds.retainAll(filtered.map { it.id }.toSet())
        val multiSelectBar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = android.graphics.drawable.GradientDrawable().apply {
                shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                cornerRadius = 8f * density
                setColor(if (isBattleLogMultiSelectMode) 0xFF0F172A.toInt() else 0xFF1E293B.toInt())
                setStroke(
                    (1.5f * density).toInt().coerceAtLeast(1),
                    if (isBattleLogMultiSelectMode) 0xFF38BDF8.toInt() else 0xFF334155.toInt()
                )
            }
            val pad = (8 * density).toInt()
            setPadding(pad, pad, pad, pad)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = (8 * density).toInt()
            }
        }

        if (!isBattleLogMultiSelectMode) {
            val toggleBtn = Button(this).apply {
                text = "☑️ Multi-Select Battles to Reassign League / Cup"
                isAllCaps = false
                textSize = 11.5f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(activeTheme.secondaryButtonColor)
                setOnClickListener {
                    isBattleLogMultiSelectMode = true
                    selectedBattleLogIds.clear()
                    renderBattleLogPage()
                }
            }
            multiSelectBar.addView(toggleBtn)
        } else {
            val statusTv = TextView(this).apply {
                text = "☑️ Multi-Select Mode: ${selectedBattleLogIds.size} of ${filtered.size} battle(s) selected — tap cards below to toggle"
                setTextColor(0xFF38BDF8.toInt())
                textSize = 11.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding(0, 0, 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            val btnSelectAll = Button(this).apply {
                text = "All (${filtered.size})"
                isAllCaps = false
                textSize = 10.5f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = (4 * density).toInt()
                }
                setOnClickListener {
                    selectedBattleLogIds.addAll(filtered.map { it.id })
                    renderBattleLogPage()
                }
            }
            val btnClear = Button(this).apply {
                text = "Clear"
                isAllCaps = false
                textSize = 10.5f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.8f).apply {
                    marginEnd = (4 * density).toInt()
                }
                setOnClickListener {
                    selectedBattleLogIds.clear()
                    renderBattleLogPage()
                }
            }
            val btnMoveLeague = Button(this).apply {
                text = "🏷️ Move (${selectedBattleLogIds.size})"
                isAllCaps = false
                textSize = 10.5f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(
                    if (selectedBattleLogIds.isNotEmpty()) activeTheme.buttonAccentColor else 0xFF475569.toInt()
                )
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.3f).apply {
                    marginEnd = (4 * density).toInt()
                }
                setOnClickListener {
                    showReassignSelectedBattlesLeagueDialog(selectedBattleLogIds.toSet())
                }
            }
            val btnDone = Button(this).apply {
                text = "✖ Done"
                isAllCaps = false
                textSize = 10.5f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF475569.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.8f)
                setOnClickListener {
                    isBattleLogMultiSelectMode = false
                    selectedBattleLogIds.clear()
                    renderBattleLogPage()
                }
            }
            btnRow.addView(btnSelectAll)
            btnRow.addView(btnClear)
            btnRow.addView(btnMoveLeague)
            btnRow.addView(btnDone)
            multiSelectBar.addView(statusTv)
            multiSelectBar.addView(btnRow)
        }
        battleLogContainer.addView(multiSelectBar)

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
                val isSelectedForBatch = isBattleLogMultiSelectMode && entry.id in selectedBattleLogIds
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
                    if (isSelectedForBatch) {
                        background = android.graphics.drawable.GradientDrawable().apply {
                            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
                            cornerRadius = 8f * density
                            setColor(0xFF0F172A.toInt())
                            setStroke((2f * density).toInt().coerceAtLeast(2), 0xFF38BDF8.toInt())
                        }
                    } else if (isRepeatDailyLead) {
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
                        if (isBattleLogMultiSelectMode) {
                            if (entry.id in selectedBattleLogIds) {
                                selectedBattleLogIds.remove(entry.id)
                            } else {
                                selectedBattleLogIds.add(entry.id)
                            }
                            renderBattleLogPage()
                        } else {
                            showInteractiveBattleReplayDialog(entry)
                        }
                    }
                    setOnLongClickListener {
                        if (!isBattleLogMultiSelectMode) {
                            isBattleLogMultiSelectMode = true
                            selectedBattleLogIds.clear()
                        }
                        if (entry.id in selectedBattleLogIds) {
                            selectedBattleLogIds.remove(entry.id)
                        } else {
                            selectedBattleLogIds.add(entry.id)
                        }
                        renderBattleLogPage()
                        true
                    }
                }

                val topRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                }

                val checkPrefix = if (isBattleLogMultiSelectMode) {
                    if (isSelectedForBatch) "☑️ " else "⬜ "
                } else ""

                val resultTv = TextView(this).apply {
                    text = "$checkPrefix${if (isWin) "🏆 WIN" else "💀 LOSS"}"
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

                val cleanEntryId = entry.id.replace(Regex("[^a-zA-Z0-9_-]"), "")
                val localDvrMp4 = java.io.File(java.io.File(filesDir, "dvr_replays"), "${cleanEntryId}_video.mp4")
                val vaultMetaForCard = OverlayService.loadReplayVaultMapStatic(prefs, gson)[cleanEntryId]
                val hasDvrVideoForCard = (localDvrMp4.exists() && localDvrMp4.length() > 0L) ||
                    (vaultMetaForCard?.videoStreamUrl?.isNotBlank() == true)
                val isPinnedForCard = vaultMetaForCard?.isPinned == true
                val hasRecentAiLog = aiLogsById.containsKey(entry.id) || entry.timelineEvents.isNotEmpty()
                val replayHintBtn = TextView(this).apply {
                    text = when {
                        hasDvrVideoForCard -> "🎥 Watch DVR Video + HUD Replay${if (isPinnedForCard) " ⭐" else ""}"
                        hasRecentAiLog -> "🎬 Replay Matrix + Turn Timeline"
                        else -> "🔍 Summary Matrix Replay"
                    }
                    setTextColor(
                        when {
                            hasDvrVideoForCard -> 0xFF34D399.toInt()
                            hasRecentAiLog -> 0xFF38BDF8.toInt()
                            else -> 0xFF94A3B8.toInt()
                        }
                    )
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

                val dropAiBtn = if (hasRecentAiLog) {
                    TextView(this).apply {
                        text = "🚫 Drop AI Log"
                        setTextColor(0xFFFBBF24.toInt())
                        textSize = 11f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val padH = (8 * density).toInt()
                        val padV = (3 * density).toInt()
                        setPadding(padH, padV, padH, padV)
                        setOnClickListener {
                            dropOnlyAiTelemetryForBattle(entry)
                        }
                    }
                } else null

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
                if (dropAiBtn != null) {
                    actionsRow.addView(dropAiBtn)
                }
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

    private fun dropOnlyAiTelemetryForBattle(entry: BattleLogEntry) {
        val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        val removedFromQueue = pendingQueue.removeAll { it.battleId == entry.id }
        if (removedFromQueue) {
            prefs.edit().putString(OverlayService.PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue)).apply()
        }
        if (entry.timelineEvents.isNotEmpty()) {
            val updatedLogs = loadBattleLogs().map {
                if (it.id == entry.id) it.copy(timelineEvents = emptyList(), updatedAt = System.currentTimeMillis()) else it
            }
            saveBattleLogs(updatedLogs)
        }
        renderBattleLogPage()
        updateSyncStatusUi()
        val oppSummary = entry.opponents.firstOrNull() ?: "Opponent"
        Toast.makeText(
            this,
            "🚫 Dropped AI telemetry for ${entry.result} vs $oppSummary (Win/Loss record kept)",
            Toast.LENGTH_SHORT
        ).show()
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
        // Also remove from pending AI telemetry queue when deleting the battle log entry
        val pendingQueue = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        if (pendingQueue.removeAll { it.battleId == entry.id }) {
            prefs.edit().putString(OverlayService.PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue)).apply()
        }
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
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
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
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
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
                enable4ChargedVal = enable4Val,
                sharedPrefs = prefs
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

            val pendingTelemetry = OverlayService.loadPendingAiTelemetryLogsStatic(prefs, gson).find { it.battleId == entry.id }
            val replayEvents = pendingTelemetry?.timelineEvents?.takeIf { it.isNotEmpty() } ?: entry.timelineEvents
            val uSh = entry.userShieldsRemaining ?: entry.quality?.userShieldsRemaining ?: 0
            val oSh = entry.oppShieldsRemaining ?: entry.quality?.oppShieldsRemaining ?: 0
            val swapInfoLine = "\n🛡️ End Shields: ${uSh}S vs ${oSh}S • 1st Swap: ${entry.firstSwapActor ?: "NONE"} (${entry.switchAdvantage ?: "NEUTRAL"})"
            val anomalyCount = pendingTelemetry?.anomalies?.size ?: 0
            val anomalySummary = if (anomalyCount > 0) " • ⚠️ $anomalyCount anomaly event(s) queued" else ""
            val aiTimelineLine = if (replayEvents.isNotEmpty()) {
                val sampleEvents = replayEvents.take(5).joinToString(" → ") { ev ->
                    "t=${ev.t.toInt()}s ${ev.type}"
                }
                "\n🤖 Pending AI Timeline (${replayEvents.size} events$anomalySummary): $sampleEvents"
            } else {
                "\n📦 Summary Matrix Replay (AI telemetry uploaded & purged from device)"
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
                settings.allowContentAccess = false
                settings.allowFileAccessFromFileURLs = false
                settings.allowUniversalAccessFromFileURLs = false
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
                    val lp = replayWebView.layoutParams
                    val isVideoFrameParent = lp is android.widget.FrameLayout.LayoutParams
                    val targetHeightPx = if (isVideoFrameParent) {
                        (heightDp.coerceIn(44, 580) * density).toInt()
                    } else {
                        (kotlin.math.max(480, heightDp + 20) * density).toInt()
                    }
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

            val cleanBattleId = entry.id.replace(Regex("[^a-zA-Z0-9_-]"), "")
            val replaysDir = java.io.File(filesDir, "dvr_replays")
            var localMp4File = java.io.File(replaysDir, "${cleanBattleId}_video.mp4").takeIf { it.exists() && it.length() > 0L }
                ?: java.io.File(cacheDir, "${cleanBattleId}_video.mp4").takeIf { it.exists() && it.length() > 0L }
            var localTraceFile = java.io.File(replaysDir, "${cleanBattleId}_deep_trace.jsonl").takeIf { it.exists() }
                ?: java.io.File(cacheDir, "${cleanBattleId}_deep_trace.jsonl").takeIf { it.exists() }

            // Fallback: if this battle was logged within 120s of the newest local DVR file, match it
            if (localMp4File == null && replaysDir.exists()) {
                val candidate = replaysDir.listFiles { f -> f.isFile && f.name.endsWith("_video.mp4") }
                    ?.minByOrNull { kotlin.math.abs(it.lastModified() - entry.timestampMs) }
                if (candidate != null && kotlin.math.abs(candidate.lastModified() - entry.timestampMs) <= 120_000L) {
                    localMp4File = candidate
                    val base = candidate.name.removeSuffix("_video.mp4")
                    localTraceFile = java.io.File(replaysDir, "${base}_deep_trace.jsonl").takeIf { it.exists() }
                }
            }

            var vaultMeta = OverlayService.loadReplayVaultMapStatic(prefs, gson)[cleanBattleId]
            var hasDvrVideoInitial = (localMp4File != null) || (vaultMeta?.videoStreamUrl?.isNotBlank() == true)

            var isVideoMode = hasDvrVideoInitial
            var currentHudMode = "live" // "live" | "compact" | "diagnostic" | "off"
            var isHudTop = true
            var isShieldHudEnabled = true
            var hudAlphaPct = 50
            var onAsyncTraceLoadedCallback: (() -> Unit)? = null

            val traceFrames = mutableListOf<OverlayService.Companion.BattleDeepTraceFrame>()
            val summaryOppTeamSpecs = mutableListOf<OverlayService.Companion.AiTelemetryOppSlotSpec>()
            fun parseTraceLines(text: String) {
                traceFrames.clear()
                summaryOppTeamSpecs.clear()
                for (line in text.lineSequence()) {
                    val trimmed = line.trim()
                    if (trimmed.isEmpty()) continue
                    if (trimmed.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")) {
                        try {
                            val root = com.google.gson.JsonParser.parseString(trimmed).asJsonObject
                            val summaryObj = root.getAsJsonObject("battleSummary")
                            if (summaryObj != null) {
                                val parsedSummary = gson.fromJson(summaryObj, OverlayService.Companion.AiTelemetryBattleRecordV510::class.java)
                                if (parsedSummary != null && parsedSummary.oppTeamSpecs.isNotEmpty()) {
                                    summaryOppTeamSpecs.addAll(parsedSummary.oppTeamSpecs)
                                }
                            }
                        } catch (_: Exception) {}
                        continue
                    }
                    try {
                        val f = gson.fromJson(trimmed, OverlayService.Companion.BattleDeepTraceFrame::class.java)
                        if (f != null && f.frameIdx > 0) traceFrames.add(f)
                    } catch (_: Exception) {}
                }
                if (traceFrames.size > 1) {
                    val span = traceFrames.last().videoElapsedMs - traceFrames.first().videoElapsedMs
                    if (span < 2000L) {
                        for (i in traceFrames.indices) {
                            traceFrames[i] = traceFrames[i].copy(videoElapsedMs = i * 100L)
                        }
                    }
                }
            }
            if (localTraceFile != null && localTraceFile!!.exists()) {
                try {
                    parseTraceLines(localTraceFile!!.readText(Charsets.UTF_8))
                } catch (_: Exception) {}
            } else if (vaultMeta?.traceStreamUrl?.isNotBlank() == true) {
                val traceUrl = vaultMeta!!.traceStreamUrl
                lifecycleScope.launch(Dispatchers.IO) {
                    try {
                        val client = OverlayService.buildTelemetryHttpClientStatic(15L, 30L, 20L)
                        client.newCall(okhttp3.Request.Builder().url(traceUrl).get().build()).execute().use { r ->
                            if (r.isSuccessful) {
                                val txt = r.body?.string().orEmpty()
                                withContext(Dispatchers.Main) {
                                    parseTraceLines(txt)
                                    onAsyncTraceLoadedCallback?.invoke()
                                }
                            }
                        }
                    } catch (_: Exception) {}
                }
            }

            val topToolbar = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(0, 0, 0, (6 * density).toInt())
            }

            fun styleMiniBtn(btn: TextView, bgHex: Int, fgHex: Int = 0xFFF8FAFC.toInt()) {
                val pH = (8 * density).toInt()
                val pV = (5 * density).toInt()
                btn.setPadding(pH, pV, pH, pV)
                btn.textSize = 10.5f
                btn.setTextColor(fgHex)
                btn.setTypeface(btn.typeface, android.graphics.Typeface.BOLD)
                btn.background = android.graphics.drawable.GradientDrawable().apply {
                    setColor(bgHex)
                    cornerRadius = 6f * density
                }
            }

            val btnModeToggle = TextView(this).apply {
                text = if (isVideoMode) "📊 Matrix View" else "🎥 Watch DVR Video"
                styleMiniBtn(this, if (hasDvrVideoInitial) 0xFF059669.toInt() else 0xFF334155.toInt())
            }
            val btnPinToggle = TextView(this).apply {
                val pinnedNow = vaultMeta?.isPinned == true
                text = if (pinnedNow) "⭐ Starred" else "☆ Star"
                styleMiniBtn(this, if (pinnedNow) 0xFFD97706.toInt() else 0xFF1E293B.toInt())
            }
            val btnPublicToggle = TextView(this).apply {
                val pubNow = vaultMeta?.isPublic == true
                text = if (pubNow) "🌐 Public" else "🔒 Private"
                styleMiniBtn(this, if (pubNow) 0xFF0284C7.toInt() else 0xFF1E293B.toInt())
            }
            val btnShareLink = TextView(this).apply {
                text = "🔗 Copy Link"
                styleMiniBtn(this, 0xFF0284C7.toInt())
            }
            val btnReportIssue = TextView(this).apply {
                text = "🚩 Report Issue"
                styleMiniBtn(this, 0xFFBE123C.toInt())
            }
            val btnDeleteDvr = TextView(this).apply {
                text = "🗑️ Delete"
                styleMiniBtn(this, 0xFF475569.toInt())
                visibility = if (hasDvrVideoInitial) android.view.View.VISIBLE else android.view.View.GONE
            }

            val spacer = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            topToolbar.addView(btnModeToggle, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (5 * density).toInt() })
            topToolbar.addView(btnPinToggle, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (5 * density).toInt() })
            topToolbar.addView(btnPublicToggle, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (5 * density).toInt() })
            topToolbar.addView(btnShareLink, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (5 * density).toInt() })
            topToolbar.addView(android.view.View(this), spacer)
            topToolbar.addView(btnDeleteDvr, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (5 * density).toInt() })
            topToolbar.addView(btnReportIssue)

            val videoStageWrap = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = android.view.Gravity.CENTER_HORIZONTAL
                visibility = if (isVideoMode) android.view.View.VISIBLE else android.view.View.GONE
            }

            val videoFrameBox = android.widget.FrameLayout(this).apply {
                setBackgroundColor(0xFF000000.toInt())
                val stageW = (resources.displayMetrics.widthPixels - (48 * density).toInt()).coerceAtMost((360 * density).toInt())
                val stageH = (stageW * 1184) / 544
                layoutParams = LinearLayout.LayoutParams(stageW, stageH).apply {
                    gravity = android.view.Gravity.CENTER_HORIZONTAL
                }
            }

            val videoView = android.widget.VideoView(this).apply {
                layoutParams = android.widget.FrameLayout.LayoutParams(
                    android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                    android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                    android.view.Gravity.CENTER
                )
            }
            val speeds = listOf(0.25f, 0.5f, 1.0f, 2.0f)
            var speedIdx = 2 // Default to 1.0x real-time playback speed
            var mediaPlayerRef: android.media.MediaPlayer? = null
            var mp4TimeCompressionRatio = 1.0f
            fun recalcMp4TimeCompression() {
                val mp = mediaPlayerRef ?: return
                val vDurMs = try { mp.duration.toLong() } catch (_: Exception) { 0L }
                val traceDurMs = traceFrames.lastOrNull()?.videoElapsedMs ?: 0L
                if (vDurMs > 5000L && traceDurMs > 10000L) {
                    val ratio = traceDurMs.toFloat() / vDurMs.toFloat()
                    mp4TimeCompressionRatio = if (ratio in 1.8f..3.6f) ratio else 1.0f
                } else {
                    mp4TimeCompressionRatio = 1.0f
                }
            }
            fun applyCurrentPlaybackSpeed() {
                recalcMp4TimeCompression()
                val spd = (speeds.getOrElse(speedIdx) { 1.0f } / mp4TimeCompressionRatio).coerceIn(0.1f, 4.0f)
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    try {
                        val mp = mediaPlayerRef ?: return
                        if (videoView.isPlaying) {
                            mp.playbackParams = (mp.playbackParams ?: android.media.PlaybackParams()).setSpeed(spd)
                        }
                    } catch (_: Exception) {}
                }
            }
            videoView.setOnPreparedListener { mp ->
                mediaPlayerRef = mp
                mp.isLooping = false
                recalcMp4TimeCompression()
                if (videoView.isPlaying) {
                    applyCurrentPlaybackSpeed()
                }
            }

            val videoControlsBox = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding((4 * density).toInt(), (6 * density).toInt(), (4 * density).toInt(), (4 * density).toInt())
            }

            val seekBar = android.widget.SeekBar(this).apply {
                max = 1000
            }
            val transportRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            val btnStepBack = TextView(this).apply { text = "⏮ -1F"; styleMiniBtn(this, 0xFF1E293B.toInt()) }
            val btnPlayPause = TextView(this).apply { text = "▶️ Play"; styleMiniBtn(this, 0xFF059669.toInt()) }
            val btnStepFwd = TextView(this).apply { text = "⏭ +1F"; styleMiniBtn(this, 0xFF1E293B.toInt()) }
            val btnSpeed = TextView(this).apply { text = "1.0x"; styleMiniBtn(this, 0xFF334155.toInt()) }
            val tvFrameClock = TextView(this).apply {
                text = "F#0000 0.0s"
                setTextColor(0xFF38BDF8.toInt())
                textSize = 10.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setPadding((6 * density).toInt(), 0, 0, 0)
            }
            transportRow.addView(btnStepBack, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            transportRow.addView(btnPlayPause, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            transportRow.addView(btnStepFwd, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            transportRow.addView(btnSpeed, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            transportRow.addView(tvFrameClock)

            val hudControlsRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
                setPadding(0, (5 * density).toInt(), 0, (4 * density).toInt())
            }
            val btnHudMode = TextView(this).apply { text = "👁️ HUD: LIVE"; styleMiniBtn(this, 0xFF0F766E.toInt()) }
            val btnShieldHud = TextView(this).apply { text = "🛡️ Shield: ON"; styleMiniBtn(this, 0xFF059669.toInt()) }
            val btnHudPos = TextView(this).apply { text = "⬆️ Pos: Top"; styleMiniBtn(this, 0xFF1E293B.toInt()) }
            val btnHudAlpha = TextView(this).apply { text = "🔆 50%"; styleMiniBtn(this, 0xFF1E293B.toInt()) }
            hudControlsRow.addView(btnHudMode, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            hudControlsRow.addView(btnShieldHud, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            hudControlsRow.addView(btnHudPos, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            hudControlsRow.addView(btnHudAlpha)

            val chipsScroll = android.widget.HorizontalScrollView(this).apply {
                isHorizontalScrollBarEnabled = false
                setPadding(0, (4 * density).toInt(), 0, 0)
            }
            val chipsRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            chipsScroll.addView(chipsRow)

            videoControlsBox.addView(seekBar)
            videoControlsBox.addView(transportRow)
            videoControlsBox.addView(hudControlsRow)
            videoControlsBox.addView(chipsScroll)

            videoFrameBox.addView(videoView)
            videoStageWrap.addView(videoFrameBox)
            videoStageWrap.addView(videoControlsBox)

            val matrixStageWrap = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                visibility = if (isVideoMode) android.view.View.GONE else android.view.View.VISIBLE
            }

            fun resolveShadowDecoratedOppName(rawSpecies: String): String {
                val clean = rawSpecies
                    .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                    .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                    .trim()
                val base = OverlayService.Companion.FormResolver.extractBaseSpecies(clean).lowercase()
                val matchedSummary = summaryOppTeamSpecs.firstOrNull {
                    OverlayService.Companion.FormResolver.extractBaseSpecies(it.species).equals(base, ignoreCase = true)
                }
                val matchedReplay = replayOpponents.firstOrNull {
                    val c = it.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "").trim()
                    OverlayService.Companion.FormResolver.extractBaseSpecies(c).equals(base, ignoreCase = true)
                }
                val isShad = rawSpecies.contains("Shadow", ignoreCase = true) ||
                    (matchedSummary?.isShadow == true) ||
                    (matchedReplay?.contains("Shadow", ignoreCase = true) == true)
                val resolvedSpecies = matchedSummary?.species
                    ?.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                    ?.replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                    ?.trim()
                    ?.takeIf { it.isNotBlank() }
                    ?: matchedReplay
                        ?.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                        ?.replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                        ?.trim()
                        ?.takeIf { it.isNotBlank() }
                    ?: clean
                return if (isShad && !resolvedSpecies.startsWith("Shadow ", ignoreCase = true)) {
                    "Shadow $resolvedSpecies"
                } else {
                    resolvedSpecies
                }
            }

            fun restoreStaticMatrixReplayState() {
                replayEngine.configureReplayState(
                    preset = servicePreset,
                    opponentsList = replayOpponents,
                    activeOppIdx = 0,
                    activeUserIdx = 0,
                    oppCountModeVal = oppCountModeVal,
                    enable4ChargedVal = enable4Val,
                    sharedPrefs = prefs
                )
            }

            fun syncFrameAtMs(posMs: Long) {
                if (traceFrames.isEmpty()) return
                var lo = 0
                var hi = traceFrames.size - 1
                while (lo < hi) {
                    val mid = (lo + hi + 1) ushr 1
                    if (traceFrames[mid].videoElapsedMs <= posMs) lo = mid else hi = mid - 1
                }
                val f = traceFrames[lo]
                tvFrameClock.text = String.format(java.util.Locale.US, "F#%04d %.1fs", f.frameIdx, posMs / 1000.0)

                // v7.10: Progressive Opponent Reveal & Player Field-Entry Reconstruction up to frame index `lo`
                val revealedOppsAtFrame = mutableListOf<String>()
                val seenBases = mutableSetOf<String>()
                fun addRevealed(rawSp: String) {
                    val trimmed = rawSp.trim()
                    if (trimmed.isEmpty() || trimmed.equals("Waiting...", ignoreCase = true) || trimmed.equals("Opponent", ignoreCase = true)) return
                    val clean = trimmed
                        .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                        .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                        .trim()
                    val base = OverlayService.Companion.FormResolver.extractBaseSpecies(clean).lowercase()
                    if (base.isNotEmpty() && seenBases.add(base) && revealedOppsAtFrame.size < 3) {
                        revealedOppsAtFrame.add(resolveShadowDecoratedOppName(trimmed))
                    }
                }
                if (f.revealedOppSpecies.isNotEmpty()) {
                    for (nm in f.revealedOppSpecies) addRevealed(nm)
                } else {
                    for (k in 0..lo) {
                        val fk = traceFrames[k]
                        for (nm in fk.revealedOppSpecies) addRevealed(nm)
                        addRevealed(fk.activeOppSpecies)
                        if (revealedOppsAtFrame.size >= 3) break
                    }
                }

                val uIdxNow = f.activeUserIdx.coerceIn(0, 2)
                val userEverOnFieldAtFrame = if (f.userSlotEverOnField.size >= 3) {
                    (0..2).map { idx -> f.userSlotEverOnField[idx] || idx == uIdxNow }
                } else {
                    val ever = BooleanArray(3)
                    ever[uIdxNow] = true
                    for (k in 0..lo) {
                        val fk = traceFrames[k]
                        val uAtK = fk.activeUserIdx.coerceIn(0, 2)
                        ever[uAtK] = true
                        for (idx in 0..2) {
                            if (fk.userSlotEverOnField.getOrNull(idx) == true) ever[idx] = true
                            if ((fk.userSlotEnergy.getOrNull(idx) ?: 0) > 0) ever[idx] = true
                            val hpAtK = fk.userSlotHpPct.getOrNull(idx) ?: 100
                            if (hpAtK in 0..99) ever[idx] = true
                        }
                    }
                    ever.toList()
                }

                // Reconstruct opponent & player pre-throw energy and 3-stage charged-move deduction lifecycle (5s countdown -> OCR or provisional deduction -> HP resolution)
                var chargeStartIdx = lo
                while (chargeStartIdx > 0 && (
                    traceFrames[chargeStartIdx - 1].pendingChargeActor.equals("opp", ignoreCase = true) ||
                        traceFrames[chargeStartIdx - 1].isTopCountdownActive
                    )) {
                    chargeStartIdx--
                }
                val isOppChargeWindow = f.pendingChargeActor.equals("opp", ignoreCase = true) || f.isTopCountdownActive
                var usedBannerTextInCharge: String? = null
                if (isOppChargeWindow) {
                    for (k in chargeStartIdx..lo) {
                        if (traceFrames[k].ocrMidBannerText.contains(" used ", ignoreCase = true)) {
                            usedBannerTextInCharge = traceFrames[k].ocrMidBannerText
                            break
                        }
                    }
                }
                val hasUsedBannerSoFar = usedBannerTextInCharge != null
                val elapsedInChargeMs = (f.videoElapsedMs - traceFrames[chargeStartIdx].videoElapsedMs).coerceAtLeast(0L)
                val forceShieldWindow = isOppChargeWindow && !hasUsedBannerSoFar && (f.isTopCountdownActive || elapsedInChargeMs < 4800L)
                val oIdx = f.activeOppIdx.coerceIn(0, 2)
                val preThrowEnergyHint = if (chargeStartIdx > 0) {
                    val prevF = traceFrames[chargeStartIdx - 1]
                    prevF.oppSlotEnergy.getOrElse(oIdx) { prevF.oppEnergy }
                } else {
                    f.oppSlotEnergy.getOrElse(oIdx) { f.oppEnergy }
                }
                val startWindowOppEnergy = traceFrames[chargeStartIdx].let { sf ->
                    sf.oppSlotEnergy.getOrElse(oIdx) { sf.oppEnergy }
                }

                var userChargeStartIdx = lo
                while (userChargeStartIdx > 0 &&
                    traceFrames[userChargeStartIdx - 1].pendingChargeActor.equals("user", ignoreCase = true)
                ) {
                    userChargeStartIdx--
                }
                val isUserChargeWindow = f.pendingChargeActor.equals("user", ignoreCase = true)
                var userUsedBannerTextInCharge: String? = null
                if (isUserChargeWindow) {
                    for (k in userChargeStartIdx..lo) {
                        if (traceFrames[k].ocrMidBannerText.contains(" used ", ignoreCase = true)) {
                            userUsedBannerTextInCharge = traceFrames[k].ocrMidBannerText
                            break
                        }
                    }
                }
                val elapsedInUserChargeMs = (f.videoElapsedMs - traceFrames[userChargeStartIdx].videoElapsedMs).coerceAtLeast(0L)
                val combMidBottomLower = "${f.ocrMidBannerText} ${f.ocrBottomMovesText}".lowercase()
                val hasUserMinigameBannerNow = combMidBottomLower.contains("get ready") ||
                    combMidBottomLower.contains("nice") ||
                    combMidBottomLower.contains("great") ||
                    combMidBottomLower.contains("excellent")
                val isUserMinigamePhase = isUserChargeWindow && userUsedBannerTextInCharge == null &&
                    (hasUserMinigameBannerNow || elapsedInUserChargeMs < 4000L)
                val preThrowUserEnergyHint = if (userChargeStartIdx > 0) {
                    val prevF = traceFrames[userChargeStartIdx - 1]
                    prevF.userSlotEnergy.getOrElse(uIdxNow) { prevF.userEnergy }
                } else {
                    f.userSlotEnergy.getOrElse(uIdxNow) { f.userEnergy }
                }
                val startWindowUserEnergy = traceFrames[userChargeStartIdx].let { sf ->
                    sf.userSlotEnergy.getOrElse(uIdxNow) { sf.userEnergy }
                }
                val prevBeforeLeftFill = if (userChargeStartIdx > 0) traceFrames[userChargeStartIdx - 1].leftCircleFillPct else f.leftCircleFillPct
                val prevBeforeRightFill = if (userChargeStartIdx > 0) traceFrames[userChargeStartIdx - 1].rightCircleFillPct else f.rightCircleFillPct

                replayEngine.applyDeepTraceFrameForReplay(
                    frame = f,
                    preThrowOppEnergyHint = preThrowEnergyHint,
                    startWindowOppEnergy = startWindowOppEnergy,
                    isOppChargeWindow = isOppChargeWindow,
                    forceShieldDecisionActive = forceShieldWindow,
                    usedBannerTextInCharge = usedBannerTextInCharge,
                    preThrowUserEnergyHint = preThrowUserEnergyHint,
                    startWindowUserEnergy = startWindowUserEnergy,
                    isUserChargeWindow = isUserChargeWindow,
                    isUserMinigamePhase = isUserMinigamePhase,
                    userUsedBannerTextInCharge = userUsedBannerTextInCharge,
                    prevBeforeLeftFill = prevBeforeLeftFill,
                    prevBeforeRightFill = prevBeforeRightFill,
                    revealedOpponentsAtFrame = revealedOppsAtFrame,
                    userSlotsEverOnFieldAtFrame = userEverOnFieldAtFrame
                )
                pushReplayStateToWeb()
                if (currentHudMode == "diagnostic") {
                    val diagStr = "RAW HP: U=${f.rawUserHpPct}% (commit ${f.committedUserHpPct}%) | O=${f.rawOppHpPct}% (commit ${f.committedOppHpPct}%)\n" +
                        "CIRCLE: L=${f.leftCircleFillPct}% R=${f.rightCircleFillPct}% | SRC: ${f.energySource}\n" +
                        "OCR: ${f.ocrMidBannerText.ifBlank { f.ocrOppTopText }.take(64)}"
                    val escaped = gson.toJson(diagStr)
                    replayWebView.post {
                        try {
                            replayWebView.evaluateJavascript("if (window.setReplayDiagnosticText) setReplayDiagnosticText($escaped);", null)
                        } catch (_: Exception) {}
                    }
                }
            }
            onAsyncTraceLoadedCallback = {
                if (isVideoMode && traceFrames.isNotEmpty()) {
                    syncFrameAtMs(0L)
                }
            }

            fun attachWebViewToActiveStage() {
                (replayWebView.parent as? android.view.ViewGroup)?.removeView(replayWebView)
                if (isVideoMode) {
                    val flp = android.widget.FrameLayout.LayoutParams(
                        android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                        android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
                        if (isHudTop) android.view.Gravity.TOP else android.view.Gravity.BOTTOM
                    ).apply {
                        val m = (4 * density).toInt()
                        setMargins(m, if (isHudTop) (20 * density).toInt() else m, m, m)
                    }
                    replayWebView.layoutParams = flp
                    replayWebView.alpha = hudAlphaPct / 100f
                    videoFrameBox.addView(replayWebView)
                    replayWebView.post {
                        try {
                            val showMatrixInCompact = prefs.getBoolean(
                                OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX,
                                OverlayService.DEFAULT_COMPACT_HUD_SHOW_MATRIX
                            )
                            replayWebView.evaluateJavascript("if (window.setCompactHudShowMatrix) setCompactHudShowMatrix($showMatrixInCompact);", null)
                            replayWebView.evaluateJavascript("if (window.setReplayHudMode) setReplayHudMode('$currentHudMode');", null)
                            replayWebView.evaluateJavascript("if (window.setReplayShieldOverlayEnabled) setReplayShieldOverlayEnabled($isShieldHudEnabled);", null)
                        } catch (_: Exception) {}
                    }
                } else {
                    replayWebView.alpha = 1.0f
                    replayWebView.layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        (540 * density).toInt()
                    )
                    matrixStageWrap.addView(replayWebView)
                    replayWebView.post {
                        try {
                            replayWebView.evaluateJavascript("if (window.setReplayHudMode) setReplayHudMode('live');", null)
                            replayWebView.evaluateJavascript("if (window.setReplayShieldOverlayEnabled) setReplayShieldOverlayEnabled($isShieldHudEnabled);", null)
                        } catch (_: Exception) {}
                    }
                }
            }

            var videoLoadedOnce = false
            fun ensureVideoSourceLoaded() {
                if (videoLoadedOnce) return
                val mp4 = localMp4File
                val streamUrl = vaultMeta?.videoStreamUrl
                if (mp4 != null && mp4.exists()) {
                    videoView.setVideoPath(mp4.absolutePath)
                    videoLoadedOnce = true
                } else if (!streamUrl.isNullOrBlank()) {
                    videoView.setVideoURI(android.net.Uri.parse(streamUrl))
                    videoLoadedOnce = true
                }
            }

            // Populate Timeline Event Jump Chips
            val chipEvents = mutableListOf<Pair<String, Long>>()
            for (ev in replayEvents) {
                val tMs = (ev.t * 1000.0).toLong()
                val icon = when {
                    ev.type.contains("CHARGE", ignoreCase = true) -> "⚡"
                    ev.type.contains("SWAP", ignoreCase = true) -> "🔄"
                    ev.type.contains("FAINT", ignoreCase = true) || ev.type.contains("KO", ignoreCase = true) -> "💀"
                    else -> "📌"
                }
                val detail = listOfNotNull(ev.inferredMoveName, ev.pokemonIn, ev.pokemonFainted, ev.activePokemon)
                    .firstOrNull { it.isNotBlank() } ?: ev.type
                chipEvents.add("$icon ${ev.t.toInt()}s ${ev.actor.uppercase()}: $detail" to tMs)
            }
            for ((label, tMs) in chipEvents.take(24)) {
                val chip = TextView(this).apply {
                    text = label
                    styleMiniBtn(this, 0xFF1E293B.toInt(), 0xFFCBD5E1.toInt())
                    setOnClickListener {
                        recalcMp4TimeCompression()
                        val jumpRealMs = (tMs - 2000L).coerceAtLeast(0L)
                        val jumpVidMs = (jumpRealMs.toFloat() / mp4TimeCompressionRatio).toInt().coerceAtLeast(0)
                        ensureVideoSourceLoaded()
                        videoView.seekTo(jumpVidMs)
                        syncFrameAtMs(jumpRealMs)
                    }
                }
                chipsRow.addView(chip, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { rightMargin = (4 * density).toInt() })
            }

            var isSyncTickActive = true
            val syncTickRunnable = object : Runnable {
                override fun run() {
                    if (!isSyncTickActive) return
                    try {
                        if (isVideoMode && videoView.isPlaying) {
                            recalcMp4TimeCompression()
                            val pos = videoView.currentPosition
                            val dur = videoView.duration.coerceAtLeast(1)
                            seekBar.progress = ((pos.toLong() * 1000L) / dur).toInt().coerceIn(0, 1000)
                            val realPosMs = (pos.toFloat() * mp4TimeCompressionRatio).toLong()
                            syncFrameAtMs(realPosMs)
                        }
                    } catch (_: Exception) {}
                    replayWebView.postDelayed(this, 80L)
                }
            }

            btnPlayPause.setOnClickListener {
                ensureVideoSourceLoaded()
                if (videoView.isPlaying) {
                    videoView.pause()
                    btnPlayPause.text = "▶️ Play"
                } else {
                    videoView.start()
                    applyCurrentPlaybackSpeed()
                    btnPlayPause.text = "⏸ Pause"
                }
            }
            fun resolveStepVidMs(): Int {
                val avgFrameMs = if (traceFrames.size > 10) {
                    val span = (traceFrames.last().videoElapsedMs - traceFrames.first().videoElapsedMs).toFloat()
                    (span / traceFrames.size.toFloat()).coerceIn(30f, 110f)
                } else {
                    67f
                }
                return (avgFrameMs / mp4TimeCompressionRatio).toInt().coerceAtLeast(16)
            }
            btnStepBack.setOnClickListener {
                ensureVideoSourceLoaded()
                videoView.pause()
                btnPlayPause.text = "▶️ Play"
                recalcMp4TimeCompression()
                val stepVidMs = resolveStepVidMs()
                val nextPos = (videoView.currentPosition - stepVidMs).coerceAtLeast(0)
                videoView.seekTo(nextPos)
                syncFrameAtMs((nextPos.toFloat() * mp4TimeCompressionRatio).toLong())
            }
            btnStepFwd.setOnClickListener {
                ensureVideoSourceLoaded()
                videoView.pause()
                btnPlayPause.text = "▶️ Play"
                recalcMp4TimeCompression()
                val stepVidMs = resolveStepVidMs()
                val dur = videoView.duration.takeIf { it > 0 } ?: 300_000
                val nextPos = (videoView.currentPosition + stepVidMs).coerceAtMost(dur)
                videoView.seekTo(nextPos)
                syncFrameAtMs((nextPos.toFloat() * mp4TimeCompressionRatio).toLong())
            }
            btnSpeed.setOnClickListener {
                speedIdx = (speedIdx + 1) % speeds.size
                val spd = speeds[speedIdx]
                btnSpeed.text = "${spd}x"
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    try {
                        val mp = mediaPlayerRef
                        if (mp != null) {
                            recalcMp4TimeCompression()
                            val effSpd = (spd / mp4TimeCompressionRatio).coerceIn(0.1f, 4.0f)
                            val wasPlaying = videoView.isPlaying
                            mp.playbackParams = (mp.playbackParams ?: android.media.PlaybackParams()).setSpeed(effSpd)
                            if (!wasPlaying && videoView.isPlaying) {
                                videoView.pause()
                            }
                        }
                    } catch (_: Exception) {}
                }
            }
            seekBar.setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: android.widget.SeekBar?, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        ensureVideoSourceLoaded()
                        recalcMp4TimeCompression()
                        val dur = videoView.duration.takeIf { it > 0 } ?: ((traceFrames.lastOrNull()?.videoElapsedMs?.toFloat() ?: 180_000f) / mp4TimeCompressionRatio).toInt()
                        val targetVidMs = ((progress.toLong() * dur) / 1000L).toInt()
                        videoView.seekTo(targetVidMs)
                        syncFrameAtMs((targetVidMs.toFloat() * mp4TimeCompressionRatio).toLong())
                    }
                }
                override fun onStartTrackingTouch(sb: android.widget.SeekBar?) {}
                override fun onStopTrackingTouch(sb: android.widget.SeekBar?) {}
            })

            val hudModes = listOf("live", "compact", "diagnostic", "off")
            btnHudMode.setOnClickListener {
                val nextIdx = (hudModes.indexOf(currentHudMode) + 1) % hudModes.size
                currentHudMode = hudModes[nextIdx]
                btnHudMode.text = "👁️ HUD: ${currentHudMode.uppercase()}"
                replayWebView.evaluateJavascript("if (window.setReplayHudMode) setReplayHudMode('$currentHudMode');", null)
                syncFrameAtMs(videoView.currentPosition.toLong())
            }
            btnShieldHud.setOnClickListener {
                isShieldHudEnabled = !isShieldHudEnabled
                btnShieldHud.text = if (isShieldHudEnabled) "🛡️ Shield: ON" else "🛡️ Shield: OFF"
                styleMiniBtn(btnShieldHud, if (isShieldHudEnabled) 0xFF059669.toInt() else 0xFF334155.toInt())
                replayWebView.evaluateJavascript("if (window.setReplayShieldOverlayEnabled) setReplayShieldOverlayEnabled($isShieldHudEnabled);", null)
            }
            btnHudPos.setOnClickListener {
                isHudTop = !isHudTop
                btnHudPos.text = if (isHudTop) "⬆️ Pos: Top" else "⬇️ Pos: Bottom"
                attachWebViewToActiveStage()
            }
            val alphaSteps = listOf(50, 75, 92, 35)
            btnHudAlpha.setOnClickListener {
                val curIdx = alphaSteps.indexOf(hudAlphaPct).let { if (it < 0) 0 else it }
                hudAlphaPct = alphaSteps[(curIdx + 1) % alphaSteps.size]
                btnHudAlpha.text = "🔆 $hudAlphaPct%"
                replayWebView.alpha = hudAlphaPct / 100f
            }

            btnModeToggle.setOnClickListener {
                if (!isVideoMode && localMp4File == null && vaultMeta?.videoStreamUrl.isNullOrBlank()) {
                    Toast.makeText(this, "🔄 Checking Cloud Replay Vault for this battle...", Toast.LENGTH_SHORT).show()
                    lifecycleScope.launch(Dispatchers.IO) {
                        OverlayService.syncCloudReplayListBlocking(prefs, gson)
                        vaultMeta = OverlayService.loadReplayVaultMapStatic(prefs, gson)[cleanBattleId]
                        withContext(Dispatchers.Main) {
                            if (vaultMeta?.videoStreamUrl?.isNotBlank() == true) {
                                isVideoMode = true
                                videoStageWrap.visibility = android.view.View.VISIBLE
                                matrixStageWrap.visibility = android.view.View.GONE
                                btnModeToggle.text = "📊 Matrix View"
                                attachWebViewToActiveStage()
                                ensureVideoSourceLoaded()
                                val traceUrl = vaultMeta?.traceStreamUrl.orEmpty()
                                if (traceFrames.isEmpty() && traceUrl.isNotBlank()) {
                                    lifecycleScope.launch(Dispatchers.IO) {
                                        try {
                                            val client = OverlayService.buildTelemetryHttpClientStatic(15L, 30L, 20L)
                                            client.newCall(okhttp3.Request.Builder().url(traceUrl).get().build()).execute().use { r ->
                                                if (r.isSuccessful) {
                                                    val txt = r.body?.string().orEmpty()
                                                    withContext(Dispatchers.Main) {
                                                        parseTraceLines(txt)
                                                        if (isVideoMode && traceFrames.isNotEmpty()) {
                                                            syncFrameAtMs(0L)
                                                        }
                                                    }
                                                }
                                            }
                                        } catch (_: Exception) {}
                                    }
                                } else if (traceFrames.isNotEmpty()) {
                                    syncFrameAtMs(0L)
                                }
                            } else {
                                Toast.makeText(this@MainActivity, "ℹ️ No DVR video recording stored for this battle.", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                    return@setOnClickListener
                }
                isVideoMode = !isVideoMode
                if (!isVideoMode && videoView.isPlaying) {
                    videoView.pause()
                    btnPlayPause.text = "▶️ Play"
                }
                videoStageWrap.visibility = if (isVideoMode) android.view.View.VISIBLE else android.view.View.GONE
                matrixStageWrap.visibility = if (isVideoMode) android.view.View.GONE else android.view.View.VISIBLE
                btnModeToggle.text = if (isVideoMode) "📊 Matrix View" else "🎥 Watch DVR Video"
                attachWebViewToActiveStage()
                if (isVideoMode) {
                    ensureVideoSourceLoaded()
                    recalcMp4TimeCompression()
                    syncFrameAtMs((videoView.currentPosition.toFloat() * mp4TimeCompressionRatio).toLong())
                } else {
                    restoreStaticMatrixReplayState()
                    pushReplayStateToWeb()
                }
            }

            btnPinToggle.setOnClickListener {
                val nextPin = !(vaultMeta?.isPinned == true)
                lifecycleScope.launch(Dispatchers.IO) {
                    val (ok, msg) = OverlayService.togglePinOrPrivacyReplayBlocking(prefs, gson, cleanBattleId, isPinned = nextPin)
                    vaultMeta = OverlayService.loadReplayVaultMapStatic(prefs, gson)[cleanBattleId]
                    withContext(Dispatchers.Main) {
                        val pinnedNow = vaultMeta?.isPinned == true
                        btnPinToggle.text = if (pinnedNow) "⭐ Starred" else "☆ Star"
                        styleMiniBtn(btnPinToggle, if (pinnedNow) 0xFFD97706.toInt() else 0xFF1E293B.toInt())
                        Toast.makeText(this@MainActivity, msg, if (ok) Toast.LENGTH_SHORT else Toast.LENGTH_LONG).show()
                        renderBattleLogPage()
                    }
                }
            }

            btnPublicToggle.setOnClickListener {
                val nextPub = !(vaultMeta?.isPublic == true)
                lifecycleScope.launch(Dispatchers.IO) {
                    val (ok, msg) = OverlayService.togglePinOrPrivacyReplayBlocking(prefs, gson, cleanBattleId, isPublic = nextPub)
                    vaultMeta = OverlayService.loadReplayVaultMapStatic(prefs, gson)[cleanBattleId]
                    withContext(Dispatchers.Main) {
                        val pubNow = vaultMeta?.isPublic == true
                        btnPublicToggle.text = if (pubNow) "🌐 Public" else "🔒 Private"
                        styleMiniBtn(btnPublicToggle, if (pubNow) 0xFF0284C7.toInt() else 0xFF1E293B.toInt())
                        Toast.makeText(this@MainActivity, msg, if (ok) Toast.LENGTH_SHORT else Toast.LENGTH_LONG).show()
                    }
                }
            }

            btnShareLink.setOnClickListener {
                val existingUrl = vaultMeta?.shareUrl.orEmpty()
                if (existingUrl.isNotBlank()) {
                    val clip = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                    clip?.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope Replay", existingUrl))
                    Toast.makeText(this, "🔗 Share URL copied! Opening Share sheet...", Toast.LENGTH_SHORT).show()
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, "Watch my Pokémon GO Battle Replay with live interactive SilphScope HUD: $existingUrl")
                    }
                    startActivity(Intent.createChooser(sendIntent, "Share Battle Replay"))
                    return@setOnClickListener
                }
                if (localMp4File == null || !localMp4File!!.exists()) {
                    Toast.makeText(this, "⚠️ No DVR video recording available for this battle.", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                Toast.makeText(this, "☁️ Uploading battle to Cloud Replay Vault for sharing...", Toast.LENGTH_SHORT).show()
                lifecycleScope.launch(Dispatchers.IO) {
                    val (ok, msg, uploadedMeta) = OverlayService.uploadBattleReplayToR2VaultIfUnlockedBlocking(
                        prefs = prefs,
                        gson = gson,
                        battleId = cleanBattleId,
                        summaryRecord = pendingTelemetry,
                        mp4File = localMp4File!!,
                        traceFile = localTraceFile ?: java.io.File(replaysDir, "${cleanBattleId}_deep_trace.jsonl")
                    )
                    withContext(Dispatchers.Main) {
                        if (ok && uploadedMeta != null && uploadedMeta.shareUrl.isNotBlank()) {
                            vaultMeta = uploadedMeta
                            val clip = getSystemService(android.content.Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                            clip?.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope Replay", uploadedMeta.shareUrl))
                            Toast.makeText(this@MainActivity, "🔗 Share Link copied: ${uploadedMeta.shareUrl}", Toast.LENGTH_LONG).show()
                            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "Watch my Pokémon GO Battle Replay with live interactive SilphScope HUD: ${uploadedMeta.shareUrl}")
                            }
                            startActivity(Intent.createChooser(sendIntent, "Share Battle Replay"))
                        } else {
                            Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }

            btnDeleteDvr.setOnClickListener {
                val delDialog = AlertDialog.Builder(this)
                    .setTitle("🗑️ Delete DVR Recording?")
                    .setMessage("Delete the recorded DVR video and deep trace for this battle? Any pending upload for this clip will also be cancelled.")
                    .setPositiveButton("🗑️ Delete Video") { _, _ ->
                        try {
                            if (videoView.isPlaying) videoView.stopPlayback()
                        } catch (_: Exception) {}
                        try { localMp4File?.delete() } catch (_: Exception) {}
                        try { localTraceFile?.delete() } catch (_: Exception) {}
                        OverlayService.deleteBattleDvrRecordingStatic(filesDir, cacheDir, prefs, gson, cleanBattleId)
                        hasDvrVideoInitial = false
                        isVideoMode = false
                        videoStageWrap.visibility = android.view.View.GONE
                        matrixStageWrap.visibility = android.view.View.VISIBLE
                        btnDeleteDvr.visibility = android.view.View.GONE
                        btnModeToggle.text = "📊 Matrix View"
                        styleMiniBtn(btnModeToggle, 0xFF334155.toInt())
                        attachWebViewToActiveStage()
                        restoreStaticMatrixReplayState()
                        pushReplayStateToWeb()
                        renderBattleLogPage()
                        Toast.makeText(this, "🗑️ DVR video deleted.", Toast.LENGTH_SHORT).show()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
                styleThemedAlertDialog(delDialog)
            }

            btnReportIssue.setOnClickListener {
                val noteInput = EditText(this).apply {
                    hint = "Describe what happened (e.g., missed opponent swap at 40s, HP spike, wrong move)"
                    setHintTextColor(0xFF64748B.toInt())
                    setTextColor(0xFFF8FAFC.toInt())
                    textSize = 12f
                    val p = (12 * density).toInt()
                    setPadding(p, p, p, p)
                }
                val issueDialog = AlertDialog.Builder(this)
                    .setTitle("🚩 Submit DVR Issue Report")
                    .setMessage("Uploads this battle's DVR video, frame-synced deep trace JSONL, and your note to SilphScope Diagnostics (Telegram):")
                    .setView(noteInput)
                    .setPositiveButton("🚀 Upload Report") { _, _ ->
                        val note = noteInput.text?.toString()?.trim().orEmpty()
                        if (note.isBlank()) {
                            Toast.makeText(
                                this,
                                "⚠️ Please describe the issue before submitting a diagnostic video report.",
                                Toast.LENGTH_LONG
                            ).show()
                            return@setPositiveButton
                        }
                        Toast.makeText(this, "🚩 Uploading DVR Video & Issue Report...", Toast.LENGTH_SHORT).show()
                        lifecycleScope.launch(Dispatchers.IO) {
                            val (ok, msg) = OverlayService.submitManualDvrIssueReportBlocking(
                                filesDir = filesDir,
                                cacheDir = cacheDir,
                                prefs = prefs,
                                gson = gson,
                                battleId = cleanBattleId,
                                league = safeLeague,
                                result = safeResult,
                                userTeamNames = teamMembers.map { it.name },
                                oppTeamNames = replayOpponents,
                                userIssueNote = note
                            )
                            withContext(Dispatchers.Main) {
                                Toast.makeText(this@MainActivity, msg, if (ok) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
                styleThemedAlertDialog(issueDialog)
            }

            dialogContainer.addView(topToolbar)
            dialogContainer.addView(hintTv)
            dialogContainer.addView(videoStageWrap)
            dialogContainer.addView(matrixStageWrap)
            attachWebViewToActiveStage()
            if (isVideoMode) {
                currentHudMode = "live"
                btnHudMode.text = "👁️ HUD: LIVE"
                ensureVideoSourceLoaded()
                if (traceFrames.isNotEmpty()) {
                    syncFrameAtMs(0L)
                } else {
                    val leadOnly = replayOpponents.take(1)
                    replayEngine.configureReplayState(
                        preset = servicePreset,
                        opponentsList = leadOnly,
                        activeOppIdx = 0,
                        activeUserIdx = 0,
                        oppCountModeVal = oppCountModeVal,
                        enable4ChargedVal = enable4Val,
                        sharedPrefs = prefs
                    )
                }
            }
            replayWebView.postDelayed(syncTickRunnable, 120L)

            val replayScrollView = ScrollView(this).apply {
                isFillViewport = true
                setBackgroundColor(0xFF0F172A.toInt())
                addView(dialogContainer)
            }
            val themedReplayRoot = wrapViewWithThemeWatermark(replayScrollView, watermarkSizeDp = 250)

            val dialog = AlertDialog.Builder(this)
                .setTitle("🎬 Battle Replay & DVR Vault • $safeLeague")
                .setView(themedReplayRoot)
                .setPositiveButton("Close Replay", null)
                .setNeutralButton("✏️ Edit Log") { _, _ ->
                    showEditOrCreateBattleLogDialog(entry)
                }
                .show()
            dialog.setOnDismissListener {
                isSyncTickActive = false
                try {
                    if (videoView.isPlaying) videoView.stopPlayback()
                } catch (_: Exception) {}
                try {
                    replayWebView.stopLoading()
                    (replayWebView.parent as? android.view.ViewGroup)?.removeView(replayWebView)
                    replayWebView.destroy()
                } catch (_: Exception) {}
            }
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
            textTacticalRecDesc.text = "Default: Shows 2-Line 4-Pillar AI Tactical Coach & Backline Prediction in Overlay"
        } else {
            btnToggleTacticalRec.text = "Recs Off"
            btnToggleTacticalRec.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleTacticalRec.setTextColor(theme.primaryTextColor)
            textTacticalRecDesc.text = "Active: 2-Line AI Tactical Coach row hidden in Overlay"
        }
    }

    private fun updateAiAdviceHudPosUi() {
        if (!::btnCycleAiAdviceHudPos.isInitialized) return
        val pos = prefs.getString(
            OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION,
            OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION
        ) ?: OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (pos.equals("top", ignoreCase = true)) {
            btnCycleAiAdviceHudPos.text = "Top"
            btnCycleAiAdviceHudPos.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
            btnCycleAiAdviceHudPos.setTextColor(0xFFFFFFFF.toInt())
            textAiAdviceHudPosDesc.text = "Active: Top (Classic Position — Between Header & Toolbar)"
        } else {
            btnCycleAiAdviceHudPos.text = "Bottom (Def)"
            btnCycleAiAdviceHudPos.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnCycleAiAdviceHudPos.setTextColor(0xFFFFFFFF.toInt())
            textAiAdviceHudPosDesc.text = "Default: Bottom (Below My Attacks for Maximum Mid-Battle Visibility)"
        }
    }

    private fun updateOverlayHudModeUi() {
        if (!::btnToggleOverlayHudMode.isInitialized) return
        val mode = prefs.getString(
            OverlayService.PREFS_KEY_OVERLAY_HUD_MODE,
            OverlayService.DEFAULT_OVERLAY_HUD_MODE
        ) ?: OverlayService.DEFAULT_OVERLAY_HUD_MODE
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (mode.equals("compact", ignoreCase = true)) {
            btnToggleOverlayHudMode.text = "Compact HUD"
            btnToggleOverlayHudMode.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
            btnToggleOverlayHudMode.setTextColor(0xFFFFFFFF.toInt())
            textOverlayHudModeDesc.text = "Active: Compact HUD (Header + 2-Line Coach + Shield Card; Toolbar shown when idle, hidden in battle • Tap emblem to minimize)"
        } else {
            btnToggleOverlayHudMode.text = "Full HUD (Def)"
            btnToggleOverlayHudMode.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleOverlayHudMode.setTextColor(0xFFFFFFFF.toInt())
            textOverlayHudModeDesc.text = "Default: Full HUD • Tap top-left emblem to cycle Full → Compact → Minimized"
        }
    }

    private fun updateCompactHudMatrixUi() {
        if (!::btnToggleCompactHudMatrix.isInitialized) return
        val showMatrix = prefs.getBoolean(
            OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX,
            OverlayService.DEFAULT_COMPACT_HUD_SHOW_MATRIX
        )
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (showMatrix) {
            btnToggleCompactHudMatrix.text = "Matrix On"
            btnToggleCompactHudMatrix.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleCompactHudMatrix.setTextColor(0xFFFFFFFF.toInt())
            textCompactHudMatrixDesc.text = "Active: 3x3 Matchup Matrix is shown in Compact HUD once opponents are scanned"
        } else {
            btnToggleCompactHudMatrix.text = "Matrix Off (Def)"
            btnToggleCompactHudMatrix.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleCompactHudMatrix.setTextColor(theme.primaryTextColor)
            textCompactHudMatrixDesc.text = "Default: Hidden in Compact HUD (Header + 2-Line Coach + Shield Card only)"
        }
    }

    private fun updateShieldDecisionOverlayUi() {
        if (!::btnToggleShieldDecisionOverlay.isInitialized) return
        val tier = if (::prefs.isInitialized) OverlayService.getEffectiveReplayTierStatic(prefs) else "free"
        val showShieldHud = prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (tier == "free") {
            btnToggleShieldDecisionOverlay.text = "🔒 Supporter ($2)"
            btnToggleShieldDecisionOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleShieldDecisionOverlay.setTextColor(0xFFFBBF24.toInt())
            textShieldDecisionOverlayDesc.text = "🏅 Paid-Once / Alumni Tier: Unlocks permanently with Lifetime Supporter ($2 once) or any Pro/VIP pass!"
        } else if (showShieldHud) {
            btnToggleShieldDecisionOverlay.text = "Shield HUD On"
            btnToggleShieldDecisionOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleShieldDecisionOverlay.setTextColor(0xFFFFFFFF.toInt())
            textShieldDecisionOverlayDesc.text = "Default: Red/Orange/Yellow/Green KO & HP summary above Attack incoming! (Auto-hides <= 5s)"
        } else {
            btnToggleShieldDecisionOverlay.text = "Shield HUD Off"
            btnToggleShieldDecisionOverlay.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleShieldDecisionOverlay.setTextColor(theme.primaryTextColor)
            textShieldDecisionOverlayDesc.text = "Active: Attack Incoming! Shield Decision Overlay disabled"
        }
    }

    private fun updateHpTrackingUi() {
        if (!::btnToggleHpTracking.isInitialized) return
        val enabled = prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, OverlayService.DEFAULT_ENABLE_HP_TRACKING)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleHpTracking.text = "HP On"
            btnToggleHpTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleHpTracking.setTextColor(0xFFFFFFFF.toInt())
            textHpTrackingDesc.text = "Default: Enabled (Live 2D floating HP bar scanning & 2-sample ±2% upward self-correction)"
        } else {
            btnToggleHpTracking.text = "HP Off"
            btnToggleHpTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleHpTracking.setTextColor(theme.primaryTextColor)
            textHpTrackingDesc.text = "Active: Disabled (Floating HP bar scanning turned off)"
        }
    }

    private fun updateEnergyTrackingUi() {
        if (!::btnToggleEnergyTracking.isInitialized) return
        val enabled = prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, OverlayService.DEFAULT_ENABLE_ENERGY_TRACKING)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleEnergyTracking.text = "Energy On"
            btnToggleEnergyTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleEnergyTracking.setTextColor(0xFFFFFFFF.toInt())
            textEnergyTrackingDesc.text = "Default: Enabled (Slowest Charge Move Meter Debounce & Direct Snap)"
        } else {
            btnToggleEnergyTracking.text = "Energy Off"
            btnToggleEnergyTracking.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleEnergyTracking.setTextColor(theme.primaryTextColor)
            textEnergyTrackingDesc.text = "Active: Disabled (Slowest Charge Move Meter Debounce turned off)"
        }
    }

    private fun updateChargeCirclePriorityUi() {
        if (!::btnCycleChargeCirclePriority.isInitialized) return
        val mode = prefs.getString(
            OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE,
            OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
        ) ?: OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (mode) {
            "highest_contrast" -> {
                btnCycleChargeCirclePriority.text = "Highest Contrast"
                btnCycleChargeCirclePriority.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleChargeCirclePriority.setTextColor(0xFFFFFFFF.toInt())
                textChargeCirclePriorityDesc.text = "Active: Highest Contrast (Always prioritizes move with better 1–18 scanner contrast rank; e.g. Fairy #3 over Normal #17)"
            }
            "highest_energy" -> {
                btnCycleChargeCirclePriority.text = "Highest Energy"
                btnCycleChargeCirclePriority.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
                btnCycleChargeCirclePriority.setTextColor(theme.primaryTextColor)
                textChargeCirclePriorityDesc.text = "Active: Highest Energy (Always prioritizes higher-energy move regardless of type color contrast)"
            }
            else -> {
                btnCycleChargeCirclePriority.text = "Smart Hybrid"
                btnCycleChargeCirclePriority.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleChargeCirclePriority.setTextColor(0xFFFFFFFF.toInt())
                textChargeCirclePriorityDesc.text = "Default: Smart Hybrid (Tracks higher-E move in Tiers S/A #1–10; promotes higher-contrast move when higher-E is Tier B/C #11–18 like Normal/Steel/Ghost)"
            }
        }
    }

    private fun updateAltFastMoveDetectUi() {
        if (!::btnToggleAltFastMoveDetect.isInitialized) return
        val enabled = prefs.getBoolean(
            OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT,
            OverlayService.DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT
        )
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        if (enabled) {
            btnToggleAltFastMoveDetect.text = "Alt Detect On"
            btnToggleAltFastMoveDetect.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            btnToggleAltFastMoveDetect.setTextColor(0xFFFFFFFF.toInt())
            textAltFastMoveDetectDesc.text = "Default: Enabled (Auto-switches opponent fast move when floating HP bar damage diverges from standard fast move)"
        } else {
            btnToggleAltFastMoveDetect.text = "Alt Detect Off"
            btnToggleAltFastMoveDetect.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            btnToggleAltFastMoveDetect.setTextColor(theme.primaryTextColor)
            textAltFastMoveDetectDesc.text = "Active: Disabled (Opponent fast move stays locked to standard/manual selection)"
        }
    }

    private fun updateFastDetectOffsetUi() {
        if (!::btnCycleFastDetectOffset.isInitialized) return
        val offset = prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, OverlayService.DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (offset) {
            0 -> {
                btnCycleFastDetectOffset.text = "+0 Turns"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Active: +0 Turns (Samples immediately on damage-registration turn)"
            }
            1 -> {
                btnCycleFastDetectOffset.text = "+1 Turn (Def)"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Default: +1 Turn (Waits 1 extra turn for HP bar drain animation to settle)"
            }
            2 -> {
                btnCycleFastDetectOffset.text = "+2 Turns"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Active: +2 Turns Delay (Samples 2 turns after damage-registration turn)"
            }
            else -> {
                btnCycleFastDetectOffset.text = "+3 Turns"
                btnCycleFastDetectOffset.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleFastDetectOffset.setTextColor(0xFFFFFFFF.toInt())
                textFastDetectOffsetDesc.text = "Active: +3 Turns Delay (Maximum settling buffer for 4–5t fast moves)"
            }
        }
    }

    private fun updateAltFastStrictnessUi() {
        if (!::btnCycleAltFastStrictness.isInitialized) return
        val mode = (prefs.getString(
            OverlayService.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS,
            OverlayService.DEFAULT_ALT_FAST_DETECT_STRICTNESS
        ) ?: OverlayService.DEFAULT_ALT_FAST_DETECT_STRICTNESS).lowercase()
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (mode) {
            "balanced" -> {
                btnCycleAltFastStrictness.text = "Balanced (8t)"
                btnCycleAltFastStrictness.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleAltFastStrictness.setTextColor(0xFFFFFFFF.toInt())
                textAltFastStrictnessDesc.text = "Active: Balanced (Requires ≥8t, ≥2 completed cycles & ≥9% HP drop)"
            }
            "aggressive" -> {
                btnCycleAltFastStrictness.text = "Aggressive (4t)"
                btnCycleAltFastStrictness.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
                btnCycleAltFastStrictness.setTextColor(theme.primaryTextColor)
                textAltFastStrictnessDesc.text = "Active: Aggressive (Legacy v5.12 — ≥4t, ≥1 cycle & ≥6% HP drop)"
            }
            else -> {
                btnCycleAltFastStrictness.text = "Strict (Def)"
                btnCycleAltFastStrictness.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleAltFastStrictness.setTextColor(0xFFFFFFFF.toInt())
                textAltFastStrictnessDesc.text = "Default: Strict (Requires ≥10t, ≥3 cycles & ≥12% HP drop; blocks Hidden Power false overrides)"
            }
        }
    }

    private fun updateShieldChipTolUi() {
        if (!::btnCycleShieldChipTol.isInitialized) return
        val tol = prefs.getInt(
            OverlayService.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT,
            OverlayService.DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
        )
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (tol) {
            10 -> {
                btnCycleShieldChipTol.text = "±10% HP"
                btnCycleShieldChipTol.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleShieldChipTol.setTextColor(0xFFFFFFFF.toInt())
                textShieldChipTolDesc.text = "Active: ±10% HP (Wide tolerance for heavy fast moves like Incinerate/Volt Switch before zoom)"
            }
            3 -> {
                btnCycleShieldChipTol.text = "±3% HP"
                btnCycleShieldChipTol.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
                btnCycleShieldChipTol.setTextColor(theme.primaryTextColor)
                textShieldChipTolDesc.text = "Active: ±3% HP (Strict 1 HP chip only — may miss shields when 1 fast move lands pre-zoom)"
            }
            6 -> {
                btnCycleShieldChipTol.text = "±6% HP"
                btnCycleShieldChipTol.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleShieldChipTol.setTextColor(0xFFFFFFFF.toInt())
                textShieldChipTolDesc.text = "Active: ±6% HP (Balanced chip tolerance for 2–3 turn fast moves)"
            }
            else -> {
                btnCycleShieldChipTol.text = "±8% HP (Def)"
                btnCycleShieldChipTol.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleShieldChipTol.setTextColor(0xFFFFFFFF.toInt())
                textShieldChipTolDesc.text = "Default: ±8% HP (Catches shielded charged moves when 1 pre-zoom fast move chips 4–8% HP)"
            }
        }
    }

    private fun updateSwapRollbackWindowUi() {
        if (!::btnCycleSwapRollbackWindow.isInitialized) return
        val winMs = prefs.getInt(
            OverlayService.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS,
            OverlayService.DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
        )
        val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
        when (winMs) {
            5000 -> {
                btnCycleSwapRollbackWindow.text = "5.0s"
                btnCycleSwapRollbackWindow.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleSwapRollbackWindow.setTextColor(0xFFFFFFFF.toInt())
                textSwapRollbackWindowDesc.text = "Active: 5.0s Window (Extended post-throw swap OCR rollback window)"
            }
            0 -> {
                btnCycleSwapRollbackWindow.text = "Off (0s)"
                btnCycleSwapRollbackWindow.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
                btnCycleSwapRollbackWindow.setTextColor(theme.primaryTextColor)
                textSwapRollbackWindowDesc.text = "Active: Off (Post-throw nameplate OCR rollback disabled; uses banner OCR only)"
            }
            3000 -> {
                btnCycleSwapRollbackWindow.text = "3.0s"
                btnCycleSwapRollbackWindow.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.secondaryAccentColor)
                btnCycleSwapRollbackWindow.setTextColor(0xFFFFFFFF.toInt())
                textSwapRollbackWindowDesc.text = "Active: 3.0s Window (Tighter post-throw swap OCR rollback window)"
            }
            else -> {
                btnCycleSwapRollbackWindow.text = "4.0s (Def)"
                btnCycleSwapRollbackWindow.backgroundTintList = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
                btnCycleSwapRollbackWindow.setTextColor(0xFFFFFFFF.toInt())
                textSwapRollbackWindowDesc.text = "Default: 4.0s (Refunds old slot & re-attributes energy/move if swap OCR arrives within 4.0s after throw)"
            }
        }
    }

    /**
     * Checks Trainer Screen Name, notifications (Android 13+), SYSTEM_ALERT_WINDOW, and initiates overlay launch
     */
    private fun checkOverlayPermissionAndStart() {
        if (!OverlayService.hasValidScreenNameStatic(prefs)) {
            Toast.makeText(
                this,
                "⚠️ Please set a Unique Debug ID (or tap Random ID) before starting the overlay.",
                Toast.LENGTH_LONG
            ).show()
            ensureRequiredScreenNameOrPrompt()
            return
        }
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

        statusText.text = "Status: Ensuring selected league rankings JSONs are loaded..."
        dbStatusText.text = "Syncing PvPoke GameMaster & selected leagues before launching overlay..."
        btnToggleOverlay.isEnabled = false
        Toast.makeText(this, "Downloading/verifying selected league rankings before launching overlay...", Toast.LENGTH_SHORT).show()

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
                OverlayService.syncPinnedLimitedMetaRankingsBlocking(prefs, filesDir)

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
                    statusText.text = "Status: Waiting for league rankings JSONs"
                    Toast.makeText(
                        this@MainActivity,
                        "Base league rankings JSONs must be downloaded before launching overlay. Check connection and tap Sync PvPoke.",
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
            putExtra(
                OverlayService.EXTRA_AI_ADVICE_HUD_POSITION,
                prefs.getString(OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION, OverlayService.DEFAULT_AI_ADVICE_HUD_POSITION)
            )
            putExtra(
                OverlayService.EXTRA_OVERLAY_HUD_MODE,
                prefs.getString(OverlayService.PREFS_KEY_OVERLAY_HUD_MODE, OverlayService.DEFAULT_OVERLAY_HUD_MODE)
            )
            putExtra(
                OverlayService.EXTRA_COMPACT_HUD_SHOW_MATRIX,
                prefs.getBoolean(OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX, OverlayService.DEFAULT_COMPACT_HUD_SHOW_MATRIX)
            )
            putExtra(OverlayService.EXTRA_SHOW_SHIELD_DECISION_OVERLAY, prefs.getBoolean(PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY, true))
            putExtra(OverlayService.EXTRA_ENABLE_HP_TRACKING, prefs.getBoolean(PREFS_KEY_ENABLE_HP_TRACKING, OverlayService.DEFAULT_ENABLE_HP_TRACKING))
            putExtra(OverlayService.EXTRA_ENABLE_ENERGY_TRACKING, prefs.getBoolean(PREFS_KEY_ENABLE_ENERGY_TRACKING, OverlayService.DEFAULT_ENABLE_ENERGY_TRACKING))
            putExtra(
                OverlayService.EXTRA_CHARGE_CIRCLE_PRIORITY_MODE,
                prefs.getString(OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE, OverlayService.DEFAULT_CHARGE_CIRCLE_PRIORITY_MODE)
            )
            putExtra(
                OverlayService.EXTRA_ENABLE_ALT_FAST_MOVE_DETECT,
                prefs.getBoolean(OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT, OverlayService.DEFAULT_ENABLE_ALT_FAST_MOVE_DETECT)
            )
            putExtra(OverlayService.EXTRA_FAST_DETECT_TURN_OFFSET, prefs.getInt(PREFS_KEY_FAST_DETECT_TURN_OFFSET, OverlayService.DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3))
            putExtra(
                OverlayService.EXTRA_ALT_FAST_DETECT_STRICTNESS,
                prefs.getString(OverlayService.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, OverlayService.DEFAULT_ALT_FAST_DETECT_STRICTNESS)
            )
            putExtra(
                OverlayService.EXTRA_SHIELD_CHIP_TOLERANCE_PCT,
                prefs.getInt(OverlayService.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, OverlayService.DEFAULT_SHIELD_CHIP_TOLERANCE_PCT)
            )
            putExtra(
                OverlayService.EXTRA_SWAP_THROW_ROLLBACK_WINDOW_MS,
                prefs.getInt(OverlayService.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, OverlayService.DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS)
            )
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
        // v5.10: Auto-upload pending AI & anomaly logs when overlay stops and >= 5 battles are queued
        OverlayService.triggerAutoUploadOnOverlayStopAsync(prefs, gson) { _, _ ->
            runOnUiThread {
                if (!isFinishing && ::prefs.isInitialized) {
                    updateAiTelemetryStatusUi()
                }
            }
        }
    }

    /**
     * TEAM PRESET MANAGEMENT:
     * Saves and loads custom team presets locally via SharedPreferences.
     * Automatically migrates any teams from legacy preference keys so updates never overwrite user teams.
     */
    fun loadPresets(): List<TeamPreset> {
        val isShow6 = isShow6CombatMode()
        val expectedMode = if (isShow6) "show6" else "gbl"
        val type = object : TypeToken<List<TeamPreset>>() {}.type
        val persistentJson = prefs.getString(PREFS_KEY_PRESETS, null)
        if (!persistentJson.isNullOrBlank()) {
            val parsed: List<TeamPreset>? = try { gson.fromJson(persistentJson, type) } catch (_: Exception) { null }
            if (!parsed.isNullOrEmpty()) {
                val filtered = parsed.filter { p ->
                    val mode = p.combatMode.ifBlank { expectedMode }
                    if (isShow6) mode.equals("show6", ignoreCase = true) else !mode.equals("show6", ignoreCase = true)
                }.map { p ->
                    val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(p.league, isShow6)
                    p.copy(league = remappedLg, combatMode = expectedMode)
                }
                if (filtered.isNotEmpty()) return filtered
            }
        }

        if (!isShow6) {
            for (legacyKey in OverlayService.LEGACY_PRESET_KEYS) {
                val legacyJson = prefs.getString(legacyKey, null)
                if (!legacyJson.isNullOrBlank()) {
                    val parsed: List<TeamPreset>? = try { gson.fromJson(legacyJson, type) } catch (_: Exception) { null }
                    if (!parsed.isNullOrEmpty()) {
                        val tagged = parsed.map { p ->
                            val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(p.league, isShow6 = false)
                            p.copy(league = remappedLg, combatMode = "gbl")
                        }
                        prefs.edit().putString(PREFS_KEY_PRESETS, gson.toJson(tagged)).apply()
                        return tagged
                    }
                }
            }
        }
        return emptyList()
    }

    fun savePresets(presets: List<TeamPreset>) {
        val isShow6 = isShow6CombatMode()
        val expectedMode = if (isShow6) "show6" else "gbl"
        val tagged = presets.map { p ->
            val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(p.league, isShow6)
            p.copy(league = remappedLg, combatMode = expectedMode)
        }
        prefs.edit().putString(PREFS_KEY_PRESETS, gson.toJson(tagged)).apply()
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
        val dynPool = OverlayService.getTop100MetaCandidatesForLeagueStatic(league, 30)
        if (dynPool.size >= 3 && OverlayService.getLimitedMetaCatalogStatic(if (::prefs.isInitialized) prefs else null).any { it.leagueKey.equals(league, ignoreCase = true) || it.title.equals(league, ignoreCase = true) }) {
            val picked = mutableListOf<PokemonSlot>()
            var megaUsed = false
            for (c in dynPool) {
                val isMega = OverlayService.isMegaOrPrimalSpeciesStatic(c.name)
                if (isMega && megaUsed) continue
                if (isMega) megaUsed = true
                picked.add(PokemonSlot(c.name, c.cp, c.fastMove, c.chargedMove1, c.chargedMove2, c.ivs))
                if (picked.size >= 3) break
            }
            if (picked.size == 3) return picked
        }
        return when {
            league.contains("SPECTRAL", ignoreCase = true) -> listOf(
                PokemonSlot("Ninetales (Alolan)", 1495, "Powder Snow", "Weather Ball (Ice)", "Dazzling Gleam"),
                PokemonSlot("Weezing (Galarian)", 1495, "Fairy Wind", "Brutal Swing", "Sludge"),
                PokemonSlot("Dewgong", 1497, "Ice Shard", "Icy Wind", "Drill Run")
            )
            league.contains("CAULDRON", ignoreCase = true) -> listOf(
                PokemonSlot("Weezing (Galarian)", 2483, "Fairy Wind", "Brutal Swing", "Play Rough"),
                PokemonSlot("Guzzlord", 2497, "Dragon Tail", "Brutal Swing", "Sludge Bomb"),
                PokemonSlot("Drapion", 2491, "Poison Sting", "Crunch", "Aqua Tail")
            )
            league.contains("FRONTIER", ignoreCase = true) -> listOf(
                PokemonSlot("Rhyperior", 4221, "Mud-Slap", "Breaking Swipe", "Rock Wrecker"),
                PokemonSlot("Florges", 3657, "Fairy Wind", "Chilling Water", "Moonblast"),
                PokemonSlot("Zacian", 4241, "Quick Attack", "Close Combat", "Play Rough")
            )
            league.contains("MEGA", ignoreCase = true) -> listOf(
                PokemonSlot("Mega Rayquaza", 5728, "Dragon Tail", "Breaking Swipe", "Dragon Ascent"),
                PokemonSlot("Palkia (Origin)", 4683, "Dragon Breath", "Spacial Rend", "Aqua Tail"),
                PokemonSlot("Zacian (Crowned)", 4658, "Metal Claw", "Behemoth Blade", "Close Combat")
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
            val defaults = if (isShow6CombatMode()) {
                listOf(
                    TeamPreset(
                        id = "show6-preset3-spectral-1",
                        name = "BF Spectral Trio: Ninetales-A / Weezing-G / Dewgong",
                        league = "BATTLE FRONTIER (SPECTRAL)",
                        pokemon = getLeagueTop3Defaults("BATTLE FRONTIER (SPECTRAL)"),
                        isSelected = true,
                        combatMode = "show6"
                    ),
                    TeamPreset(
                        id = "show6-preset3-cauldron-1",
                        name = "BF Cauldron Trio: Weezing-G / Guzzlord / Drapion",
                        league = "BATTLE FRONTIER (CAULDRON)",
                        pokemon = getLeagueTop3Defaults("BATTLE FRONTIER (CAULDRON)"),
                        combatMode = "show6"
                    ),
                    TeamPreset(
                        id = "show6-preset3-master-1",
                        name = "BF Master Trio: Rhyperior / Florges / Zacian",
                        league = "BATTLE FRONTIER (MASTER)",
                        pokemon = getLeagueTop3Defaults("BATTLE FRONTIER (MASTER)"),
                        combatMode = "show6"
                    )
                )
            } else {
                listOf(
                    TeamPreset(
                        id = "preset-ml-1",
                        name = "Master: Palkia-O / Zacian-C / Dialga-O",
                        league = "MASTER LEAGUE",
                        pokemon = getLeagueTop3Defaults("MASTER LEAGUE"),
                        isSelected = true,
                        combatMode = "gbl"
                    ),
                    TeamPreset(
                        id = "preset-ul-1",
                        name = "Ultra: Zygarde / Feraligatr / Giratina-A",
                        league = "ULTRA LEAGUE",
                        pokemon = getLeagueTop3Defaults("ULTRA LEAGUE"),
                        combatMode = "gbl"
                    ),
                    TeamPreset(
                        id = "preset-gl-1",
                        name = "Great: Clodsire / Feraligatr / Mandibuzz",
                        league = "GREAT LEAGUE",
                        pokemon = getLeagueTop3Defaults("GREAT LEAGUE"),
                        combatMode = "gbl"
                    )
                )
            }
            savePresets(defaults)
            if (!prefs.contains(PREFS_KEY_SELECTED_PRESET)) {
                prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, defaults.first().id).apply()
            }
        }
    }

    private fun refreshPresetsUi() {
        updateTrashButtonsUi()
        presetsContainer.removeAllViews()
        val allPresets = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null) ?: allPresets.firstOrNull()?.id

        // Render 2-Tier League & Cup filter tabs above My Teams:
        // Tier 1: CP Range (All, Great <=1500, Ultra 2500, Master 10000)
        // Tier 2: Cup / Format within selected CP tier (All <Tier>, Open / Standard, Mega, Limited / BF, Old Cups)
        val filterChipsContainer = findViewById<LinearLayout>(R.id.layout_presets_league_filter_chips)
        val subFilterScroll = findViewById<android.view.View>(R.id.scroll_presets_cup_subfilter)
        val subFilterChipsContainer = findViewById<LinearLayout>(R.id.layout_presets_cup_subfilter_chips)
        val filterTitleTv = findViewById<TextView>(R.id.tv_presets_league_filter_title)
        val isShow6 = isShow6CombatMode()
        val enabledModeLeagues = (if (isShow6) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }).filterNot { OverlayService.isOldCupForModeStatic(it, isShow6, prefs) }

        val cpTierTabs = listOf(
            "ALL" to "All (${allPresets.size})",
            "GREAT" to "Great ≤1500 (${allPresets.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "GREAT" }})",
            "ULTRA" to "Ultra 2500 (${allPresets.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "ULTRA" }})",
            "MASTER" to "Master 10000 (${allPresets.count { OverlayService.resolveLeagueCpTierStatic(it.league) == "MASTER" }})"
        )
        if (cpTierTabs.none { it.first.equals(selectedPresetsCpTierFilter, ignoreCase = true) }) {
            selectedPresetsCpTierFilter = "ALL"
        }

        filterTitleTv?.text = if (isShow6) {
            "🗂️ Filter Show 6 Teams by CP Tier & Cup (${allPresets.size} Total)"
        } else {
            "🗂️ Filter GBL Blind 3 Teams by CP Tier & Cup (${allPresets.size} Total)"
        }

        val density = resources.displayMetrics.density
        filterChipsContainer?.let { chipRow ->
            chipRow.removeAllViews()
            for ((tierKey, tierLabel) in cpTierTabs) {
                val isSelectedTier = tierKey.equals(selectedPresetsCpTierFilter, ignoreCase = true)
                val chipBtn = Button(this).apply {
                    text = tierLabel
                    textSize = 9.5f
                    isAllCaps = false
                    minHeight = 0
                    minimumHeight = 0
                    minWidth = 0
                    minimumWidth = 0
                    val hPad = (10 * density).toInt()
                    val vPad = (5 * density).toInt()
                    setPadding(hPad, vPad, hPad, vPad)
                    backgroundTintList = android.content.res.ColorStateList.valueOf(
                        if (isSelectedTier) {
                            if (isShow6) 0xFFD97706.toInt() else 0xFF0284C7.toInt()
                        } else 0xFF1E293B.toInt()
                    )
                    setTextColor(
                        if (isSelectedTier) {
                            if (isShow6) 0xFF0F172A.toInt() else 0xFFFFFFFF.toInt()
                        } else 0xFFCBD5E1.toInt()
                    )
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        marginEnd = (6 * density).toInt()
                    }
                    setOnClickListener {
                        selectedPresetsCpTierFilter = tierKey
                        selectedPresetsLeagueFilter = if (tierKey == "ALL") "ALL" else "TIER:$tierKey"
                        refreshPresetsUi()
                    }
                }
                chipRow.addView(chipBtn)
            }
        }

        if (selectedPresetsCpTierFilter == "ALL") {
            selectedPresetsLeagueFilter = "ALL"
            subFilterScroll?.visibility = android.view.View.GONE
            subFilterChipsContainer?.removeAllViews()
        } else {
            val tierKey = selectedPresetsCpTierFilter.uppercase()
            val tierDisplayName = when (tierKey) {
                "GREAT" -> "Great"
                "ULTRA" -> "Ultra"
                else -> "Master"
            }
            val tierPresets = allPresets.filter { OverlayService.resolveLeagueCpTierStatic(it.league) == tierKey }
            val tierOldCount = tierPresets.count { OverlayService.isOldCupForModeStatic(it.league, isShow6, prefs) }
            val tierActiveCups = sortCupsWithinTier(
                enabledModeLeagues.filter { OverlayService.resolveLeagueCpTierStatic(it) == tierKey }
            )
            val defaultTierFilter = "TIER:$tierKey"
            val oldTierFilter = "OLD_CUPS:$tierKey"

            val tier2Tabs = buildList<Pair<String, String>> {
                add(defaultTierFilter to "All $tierDisplayName (${tierPresets.size})")
                for (cup in tierActiveCups) {
                    val c = tierPresets.count { it.league.equals(cup, ignoreCase = true) }
                    add(cup to "${formatTier2CupChipLabel(cup)} ($c)")
                }
                if (tierOldCount > 0) {
                    add(oldTierFilter to "Old Cups ($tierOldCount)")
                }
            }

            if (tier2Tabs.none { it.first.equals(selectedPresetsLeagueFilter, ignoreCase = true) }) {
                selectedPresetsLeagueFilter = if (tierOldCount > 0 &&
                    OverlayService.resolveLeagueCpTierStatic(selectedPresetsLeagueFilter) == tierKey &&
                    OverlayService.isOldCupForModeStatic(selectedPresetsLeagueFilter, isShow6, prefs)
                ) {
                    oldTierFilter
                } else {
                    defaultTierFilter
                }
            }

            subFilterScroll?.visibility = android.view.View.VISIBLE
            subFilterChipsContainer?.let { subRow ->
                subRow.removeAllViews()
                for ((subKey, subLabel) in tier2Tabs) {
                    val isSelectedSub = subKey.equals(selectedPresetsLeagueFilter, ignoreCase = true)
                    val subBtn = Button(this).apply {
                        text = subLabel
                        textSize = 9.0f
                        isAllCaps = false
                        minHeight = 0
                        minimumHeight = 0
                        minWidth = 0
                        minimumWidth = 0
                        val hPad = (9 * density).toInt()
                        val vPad = (4 * density).toInt()
                        setPadding(hPad, vPad, hPad, vPad)
                        backgroundTintList = android.content.res.ColorStateList.valueOf(
                            if (isSelectedSub) 0xFF0D9488.toInt() else 0xFF0F172A.toInt()
                        )
                        setTextColor(
                            if (isSelectedSub) 0xFFFFFFFF.toInt() else 0xFF94A3B8.toInt()
                        )
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            marginEnd = (5 * density).toInt()
                        }
                        setOnClickListener {
                            selectedPresetsLeagueFilter = subKey
                            refreshPresetsUi()
                        }
                    }
                    subRow.addView(subBtn)
                }
            }
        }

        val presets = allPresets.filter {
            OverlayService.matchesEncodedLeagueFilterStatic(it.league, selectedPresetsLeagueFilter, isShow6, prefs)
        }

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
            val btnClone = itemView.findViewById<Button>(R.id.btn_clone_preset)
            val btnCopyMode = itemView.findViewById<Button>(R.id.btn_copy_preset_mode)
            val btnSwapOpp6 = itemView.findViewById<Button>(R.id.btn_swap_preset_opp6)

            val isCurrent = preset.id == selectedId
            radioSelected.isChecked = isCurrent
            textName.text = preset.name

            val isAbb = preset.archetype.equals("ABB", ignoreCase = true)
            val isDuo = preset.archetype.equals("DUO", ignoreCase = true)
            textArchetype?.text = if (preset.isArchetypeManual) "${preset.archetype}*" else preset.archetype

            val resolvedLeague = preset.league.ifBlank { "GREAT LEAGUE" }
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
                val plusMove = OverlayService.resolveMegaPlusMoveStatic(slot.name, resolvedLeague, prefs)
                val plusLvl = (slot.plusMoveLevel ?: 4).coerceIn(0, 4)
                val plusBadge = if (plusMove != null) {
                    if (plusLvl <= 0) " <font color='#94a3b8'><b>[+ $plusMove [Off]]</b></font>"
                    else " <font color='#f472b6'><b>[+ $plusMove [Lv$plusLvl]]</b></font>"
                } else ""
                val movesSummary = "${slot.fastMove} + ${slot.chargedMove1}/${slot.chargedMove2}"
                "• <b>[$rTag · $brTag]</b> ${slot.name}$plusBadge <font color='#cbd5e1'>($movesSummary)</font> <font color='#94a3b8'>($ivText · CP ${slot.cp})</font>"
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
                when {
                    resolvedLeague.equals("GREAT LEAGUE", ignoreCase = true) || resolvedLeague.equals("Great League (1500)", ignoreCase = true) -> activeTheme.accentColor
                    resolvedLeague.equals("ULTRA LEAGUE", ignoreCase = true) || resolvedLeague.equals("Ultra League (2500)", ignoreCase = true) -> 0xFFFBBF24.toInt()
                    resolvedLeague.contains("Mega", ignoreCase = true) -> 0xFFE879F9.toInt()
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

            val show6ModeNow = isShow6CombatMode()
            btnCopyMode?.text = if (show6ModeNow) "🛡️ → GBL 3" else "🏛️ → Show 6"
            btnSwapOpp6?.visibility = if (show6ModeNow) android.view.View.VISIBLE else android.view.View.GONE

            btnClone?.setOnClickListener {
                val cloned = preset.copy(
                    id = UUID.randomUUID().toString(),
                    name = "${preset.name} (Copy)",
                    isSelected = true
                )
                val updated = presets.map { it.copy(isSelected = false) }.toMutableList()
                updated.add(0, cloned)
                savePresets(updated)
                setSelectedPreset(cloned.id)
                Toast.makeText(this, "📋 Cloned '${preset.name}' — choose League or edits below", Toast.LENGTH_SHORT).show()
                showPresetEditorDialog(cloned)
            }

            btnCopyMode?.setOnClickListener {
                if (show6ModeNow) {
                    val targetLg = when {
                        preset.league.contains("CAULDRON", ignoreCase = true) || preset.league.contains("ULTRA", ignoreCase = true) -> "ULTRA LEAGUE"
                        preset.league.contains("MASTER", ignoreCase = true) -> "MASTER LEAGUE"
                        else -> "GREAT LEAGUE"
                    }
                    val rescaledSlots = preset.pokemon.map { slot ->
                        val resolved = OverlayService.resolveRecommendedMovesForSpecies(slot.name, targetLg)
                        val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, targetLg) else null
                        slot.copy(
                            cp = scaled?.defaultCp ?: slot.cp,
                            ivs = scaled?.defaultIvsGl ?: slot.ivs
                        )
                    }
                    val copied = preset.copy(
                        id = UUID.randomUUID().toString(),
                        name = "${preset.name} (from Show 6)",
                        league = targetLg,
                        pokemon = rescaledSlots,
                        isSelected = true
                    )
                    val type = object : TypeToken<List<TeamPreset>>() {}.type
                    val rawGbl = prefs.getString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, null)
                    val gblList = (try { gson.fromJson<List<TeamPreset>>(rawGbl, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
                    gblList.add(0, copied)
                    prefs.edit()
                        .putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(gblList))
                        .putString("gbl_selected_preset_id", copied.id)
                        .apply()
                    Toast.makeText(this, "🛡️ Copied '${preset.name}' to Standard GBL Blind 3 ($targetLg)!", Toast.LENGTH_LONG).show()
                } else {
                    val targetShow6Lg = when {
                        preset.league.contains("ULTRA", ignoreCase = true) -> "Battle Frontier (Cauldron)"
                        preset.league.contains("MASTER", ignoreCase = true) -> "Battle Frontier (Master)"
                        else -> "GREAT LEAGUE"
                    }
                    val options = arrayOf(
                        "🏛️ Copy as Show 6 Overlay Trio (Team of 3)",
                        "⚡ Auto-Fill Show 6 Roster of 6 (Lock 3 + Add 3 Meta Partners)"
                    )
                    AlertDialog.Builder(this)
                        .setTitle("Copy '${preset.name}' to Show 6 Mode")
                        .setItems(options) { _, which ->
                            if (which == 0) {
                                val rescaledSlots = preset.pokemon.map { slot ->
                                    val resolved = OverlayService.resolveRecommendedMovesForSpecies(slot.name, targetShow6Lg)
                                    val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, targetShow6Lg) else null
                                    slot.copy(
                                        cp = scaled?.defaultCp ?: slot.cp,
                                        ivs = scaled?.defaultIvsGl ?: slot.ivs
                                    )
                                }
                                val copied = preset.copy(
                                    id = UUID.randomUUID().toString(),
                                    name = "${preset.name} (from GBL)",
                                    league = targetShow6Lg,
                                    pokemon = rescaledSlots,
                                    isSelected = true
                                )
                                val type = object : TypeToken<List<TeamPreset>>() {}.type
                                val rawS6 = prefs.getString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, null)
                                val s6List = (try { gson.fromJson<List<TeamPreset>>(rawS6, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
                                s6List.add(0, copied)
                                prefs.edit()
                                    .putString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, gson.toJson(s6List))
                                    .putString(OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID, copied.id)
                                    .apply()
                                Toast.makeText(this, "🏛️ Copied '${preset.name}' to Show 6 Trios ($targetShow6Lg)!", Toast.LENGTH_LONG).show()
                            } else {
                                val locked3 = preset.pokemon.map { it.name }.filter { it.isNotBlank() }
                                Toast.makeText(this, "⏳ Auto-filling 3 synergistic partners for $targetShow6Lg...", Toast.LENGTH_SHORT).show()
                                lifecycleScope.launch(Dispatchers.Default) {
                                    val gen = OverlayService.generateBlindShow6RosterStatic(
                                        league = targetShow6Lg,
                                        lockedCoreNames = locked3,
                                        filterMode = "open",
                                        filterPokemonNames = emptyList(),
                                        expectedHistoricalNames = emptyList(),
                                        historicalWeightPct = 0
                                    )
                                    val full6 = gen.roster6.map { it.pokemon.name }.ifEmpty {
                                        (locked3 + OverlayService.getMostLikelyMetaOpponent6Static(targetShow6Lg)).distinct().take(6)
                                    }
                                    val newRoster = OverlayService.Companion.Show6RosterPreset(
                                        id = "show6-autofill-${System.currentTimeMillis()}",
                                        name = "${preset.name} + Auto-Fill 6",
                                        league = targetShow6Lg,
                                        pokemon = full6
                                    )
                                    withContext(Dispatchers.Main) {
                                        val curMy6 = loadShow6RostersOf6().toMutableList()
                                        curMy6.add(0, newRoster)
                                        saveShow6RostersOf6(curMy6)
                                        setAppCombatMode("show6")
                                        setupShow6ModeHubUi()
                                        Toast.makeText(
                                            this@MainActivity,
                                            "🏛️ Auto-filled Show 6 Roster: ${full6.joinToString(" • ")}",
                                            Toast.LENGTH_LONG
                                        ).show()
                                        showEditShow6RosterDialog(newRoster, isOpponent = false) { updated, finalIsOpp ->
                                            if (finalIsOpp) {
                                                saveShow6RostersOf6(loadShow6RostersOf6().filter { it.id != newRoster.id })
                                                val oppList = loadShow6OpponentRostersOf6().toMutableList()
                                                oppList.add(0, updated)
                                                saveShow6OpponentRostersOf6(oppList)
                                            } else {
                                                saveShow6RostersOf6(loadShow6RostersOf6().map { if (it.id == newRoster.id) updated else it })
                                            }
                                            setupShow6ModeHubUi()
                                        }
                                    }
                                }
                            }
                        }
                        .setNegativeButton("Cancel", null)
                        .show()
                }
            }

            btnSwapOpp6?.setOnClickListener {
                val defaultBf = OverlayService.getForcedShow6LeaguesStatic(prefs).firstOrNull() ?: "BATTLE FRONTIER (SPECTRAL)"
                val targetShow6Lg = if (OverlayService.isShow6EligibleLeagueStatic(preset.league, prefs)) preset.league else defaultBf
                val locked3 = preset.pokemon.map { it.name }.filter { it.isNotBlank() }
                lifecycleScope.launch(Dispatchers.Default) {
                    val gen = OverlayService.generateBlindShow6RosterStatic(
                        league = targetShow6Lg,
                        lockedCoreNames = locked3,
                        filterMode = "open",
                        filterPokemonNames = emptyList(),
                        expectedHistoricalNames = emptyList(),
                        historicalWeightPct = 0
                    )
                    val full6 = gen.roster6.map { it.pokemon.name }.ifEmpty {
                        (locked3 + OverlayService.getMostLikelyMetaOpponent6Static(targetShow6Lg)).distinct().take(6)
                    }
                    val oppRoster = OverlayService.Companion.Show6RosterPreset(
                        id = "show6-opp-trio-${System.currentTimeMillis()}",
                        name = "Opp: ${preset.name} (6)",
                        league = targetShow6Lg,
                        pokemon = full6
                    )
                    withContext(Dispatchers.Main) {
                        val curOpp = loadShow6OpponentRostersOf6().toMutableList()
                        curOpp.add(0, oppRoster)
                        saveShow6OpponentRostersOf6(curOpp)
                        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_6, gson.toJson(full6)).apply()
                        setupShow6ModeHubUi()
                        Toast.makeText(
                            this@MainActivity,
                            "⚔️ Swapped '${preset.name}' into Opponent 6 (${full6.joinToString(" / ")})!",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
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

            val plusMove = OverlayService.resolveMegaPlusMoveStatic(item.name, leagueProvider(), prefs)
            val plusSuffix = if (plusMove != null) " + $plusMove [Mega4]" else ""
            val movesTv = TextView(this@MainActivity).apply {
                text = "${item.fastMove}  •  ${item.chargedMove1} / ${item.chargedMove2}$plusSuffix"
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
        val leagues = if (isShow6CombatMode()) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }
        spinnerAntiMetaLeague.adapter = createThemedSpinnerAdapter(leagues)

        val antiMetaLeagueProvider = {
            spinnerAntiMetaLeague.selectedItem?.toString() ?: leagues.first()
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

    private fun setAppCombatMode(nextMode: String) {
        val normalized = if (nextMode.equals("show6", ignoreCase = true)) "show6" else "gbl"
        prefs.edit().putString(OverlayService.PREFS_KEY_APP_COMBAT_MODE, normalized).apply()
        ensureDefaultPresets()
        updateSettingsCombatModeButtonsUi()
        syncOverlayRunningUiState()
        setupAntiMetaTeamBuilderUi()
        refreshPresetsUi()
        setupBattleLogFilters()
        renderBattleLogPage()
        setupMetaTabUi()
        if (currentActivePage == "meta") {
            refreshMetaTabDashboard()
        }

        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_PRESET
                putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            }
            startService(updateIntent)
        }
    }

    private fun updateSettingsCombatModeButtonsUi() {
        val show6 = isShow6CombatMode()
        findViewById<Button>(R.id.btn_mode_standard_gbl)?.let { btn ->
            btn.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (!show6) 0xFF0284C7.toInt() else 0xFF334155.toInt()
            )
            btn.setTextColor(if (!show6) 0xFFFFFFFF.toInt() else 0xFFCBD5E1.toInt())
        }
        findViewById<Button>(R.id.btn_mode_show6_frontier)?.let { btn ->
            btn.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (show6) 0xFFD97706.toInt() else 0xFF334155.toInt()
            )
            btn.setTextColor(if (show6) 0xFF0F172A.toInt() else 0xFFCBD5E1.toInt())
        }
    }

    private fun loadShow6RostersOf6(): List<OverlayService.Companion.Show6RosterPreset> {
        val defaults = listOf(
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-spectral-default",
                name = "BF Spectral Core (1500 CP)",
                league = "BATTLE FRONTIER (SPECTRAL)",
                pokemon = listOf("Murkrow", "Drifblim", "Turtonator", "Ninetales (Alolan)", "Golisopod", "Rotom (Wash)")
            ),
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-cauldron-default",
                name = "BF Cauldron Core (2500 CP)",
                league = "BATTLE FRONTIER (CAULDRON)",
                pokemon = listOf("Skeledirge", "Malamar", "Torterra", "Walrein", "Poliwrath", "Dragalge")
            ),
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-bfmaster-default",
                name = "BF Master Core (Uncapped CP)",
                league = "BATTLE FRONTIER (MASTER)",
                pokemon = listOf("Zacian (Crowned Sword)", "Palkia (Origin)", "Metagross", "Groudon", "Kyurem (Black)", "Gyarados (Mega)")
            )
        )
        val raw = prefs.getString(OverlayService.PREFS_KEY_SHOW6_ROSTERS_OF_6, null)
        if (!raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<List<OverlayService.Companion.Show6RosterPreset>>() {}.type
                val parsed: List<OverlayService.Companion.Show6RosterPreset>? = gson.fromJson(raw, type)
                if (!parsed.isNullOrEmpty()) {
                    val fallbackLg = OverlayService.getForcedShow6LeaguesStatic(prefs).firstOrNull() ?: "BATTLE FRONTIER (SPECTRAL)"
                    return parsed.map { r ->
                        val remappedLg = OverlayService.remapLegacyLeagueForModeStatic(r.league, isShow6 = true)
                        r.copy(league = remappedLg.ifBlank { fallbackLg })
                    }
                }
            } catch (_: Exception) {}
        }
        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_ROSTERS_OF_6, gson.toJson(defaults)).apply()
        return defaults
    }

    private fun saveShow6RostersOf6(rosters: List<OverlayService.Companion.Show6RosterPreset>) {
        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_ROSTERS_OF_6, gson.toJson(rosters)).apply()
    }

    private fun loadShow6OpponentRostersOf6(): List<OverlayService.Companion.Show6RosterPreset> {
        val defaults = listOf(
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-opp-spectral-default",
                name = "Opp Spectral Meta 6",
                league = "BATTLE FRONTIER (SPECTRAL)",
                pokemon = listOf("Murkrow", "Swalot", "Jellicent", "Gourgeist", "Regidrago", "Lanturn")
            ),
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-opp-cauldron-default",
                name = "Opp Cauldron Meta 6",
                league = "BATTLE FRONTIER (CAULDRON)",
                pokemon = listOf("Skeledirge", "Torterra", "Nidoqueen", "Malamar", "Pangoro", "Salazzle")
            ),
            OverlayService.Companion.Show6RosterPreset(
                id = "show6-opp-master-default",
                name = "Opp BF Master Meta 6",
                league = "BATTLE FRONTIER (MASTER)",
                pokemon = listOf("Zacian (Crowned Sword)", "Palkia (Origin)", "Rhyperior", "Florges", "Moltres (Galarian)", "Scizor (Mega)")
            )
        )
        val raw = prefs.getString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_ROSTERS_OF_6, null)
        if (!raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<List<OverlayService.Companion.Show6RosterPreset>>() {}.type
                val parsed: List<OverlayService.Companion.Show6RosterPreset>? = gson.fromJson(raw, type)
                if (!parsed.isNullOrEmpty()) {
                    return parsed.map { r ->
                        r.copy(league = OverlayService.remapLegacyLeagueForModeStatic(r.league, isShow6 = true))
                    }
                }
            } catch (_: Exception) {}
        }
        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_ROSTERS_OF_6, gson.toJson(defaults)).apply()
        return defaults
    }

    private fun saveShow6OpponentRostersOf6(rosters: List<OverlayService.Companion.Show6RosterPreset>) {
        prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_ROSTERS_OF_6, gson.toJson(rosters)).apply()
    }

    private fun loadShow6LeagueMap(prefKey: String): MutableMap<String, List<String>> {
        val raw = prefs.getString(prefKey, null)
        val map = mutableMapOf(
            "BATTLE FRONTIER (SPECTRAL)" to emptyList<String>(),
            "BATTLE FRONTIER (CAULDRON)" to emptyList<String>(),
            "BATTLE FRONTIER (MASTER)" to emptyList<String>(),
            "GREAT LEAGUE" to emptyList<String>(),
            "ULTRA LEAGUE" to emptyList<String>(),
            "MASTER LEAGUE" to emptyList<String>(),
            "Mega Master League (10000)" to emptyList<String>()
        )
        if (!raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<Map<String, List<String>>>() {}.type
                val parsed: Map<String, List<String>>? = gson.fromJson(raw, type)
                if (parsed != null) {
                    for ((k, v) in parsed) {
                        val remappedKey = OverlayService.remapLegacyLeagueForModeStatic(k, isShow6 = k.contains("Frontier", ignoreCase = true))
                        map[remappedKey] = v.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
                    }
                }
            } catch (_: Exception) {}
        }
        return map
    }

    private fun saveShow6LeagueMap(prefKey: String, map: Map<String, List<String>>) {
        prefs.edit().putString(prefKey, gson.toJson(map)).apply()
    }

    /**
     * Pick-6 Team Editor Dialog (Supports both My 6 and Opponent 6 rosters)
     * Includes League Spinner, 6 Pokémon Autocomplete slots + Moveset fields, 1-Mega limit validation,
     * per-slot "✨ Alt Pokémon" (Top 5 Upgrades) and per-slot "🎯 Alt Moves" (Top 4 Movesets).
     */
    private fun showEditShow6RosterDialog(
        existingRoster: OverlayService.Companion.Show6RosterPreset,
        isOpponent: Boolean,
        onSaved: (OverlayService.Companion.Show6RosterPreset, Boolean) -> Unit
    ) {
        var currentIsOpponent = isOpponent
        val density = resources.displayMetrics.density
        val pad = (12 * density).toInt()
        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(container)

        val leagues = OverlayService.getEnabledShow6LeaguesStatic(prefs)
        val nameInput = EditText(this).apply {
            setText(existingRoster.name)
            hint = if (currentIsOpponent) "Opponent Roster Name" else "My Show 6 Roster Name"
            setTextColor(0xFFF8FAFC.toInt())
            setHintTextColor(0xFF64748B.toInt())
            setBackgroundColor(0xFF1E293B.toInt())
            textSize = 12f
            setPadding(pad, (8 * density).toInt(), pad, (8 * density).toInt())
        }
        container.addView(nameInput)

        val roleToggleBtn = Button(this).apply {
            text = if (currentIsOpponent) "⚔️ Role: Opponent 6 Roster (Tap to Swap to My 6 ⇄)" else "🛡️ Role: My Show 6 Roster (Tap to Swap to Opponent 6 ⇄)"
            textSize = 10.5f
            isAllCaps = false
            backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (currentIsOpponent) 0xFFBE123C.toInt() else 0xFFD97706.toInt()
            )
            setTextColor(if (currentIsOpponent) 0xFFFFFFFF.toInt() else 0xFF0F172A.toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = (6 * density).toInt()
            }
            setOnClickListener {
                currentIsOpponent = !currentIsOpponent
                text = if (currentIsOpponent) "⚔️ Role: Opponent 6 Roster (Tap to Swap to My 6 ⇄)" else "🛡️ Role: My Show 6 Roster (Tap to Swap to Opponent 6 ⇄)"
                backgroundTintList = android.content.res.ColorStateList.valueOf(
                    if (currentIsOpponent) 0xFFBE123C.toInt() else 0xFFD97706.toInt()
                )
                setTextColor(if (currentIsOpponent) 0xFFFFFFFF.toInt() else 0xFF0F172A.toInt())
            }
        }
        container.addView(roleToggleBtn)

        val leagueSpinner = Spinner(this).apply {
            adapter = createThemedSpinnerAdapter(leagues)
            val idx = leagues.indexOfFirst { it.equals(existingRoster.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
            setSelection(idx)
            setBackgroundColor(0xFF1E293B.toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (38 * density).toInt()
            ).apply {
                topMargin = (6 * density).toInt()
                bottomMargin = (8 * density).toInt()
            }
        }
        container.addView(leagueSpinner)

        val currentLeagueProvider = { leagueSpinner.selectedItem?.toString() ?: existingRoster.league }

        data class SlotEditorViews(
            val nameEdit: AutoCompleteTextView,
            val fastEdit: EditText,
            val c1Edit: EditText,
            val c2Edit: EditText,
            val suggestBox: LinearLayout
        )

        val slotViews = ArrayList<SlotEditorViews>(6)

        fun buildCurrentTeamMembers(): List<OverlayService.TeamMember> {
            val lg = currentLeagueProvider()
            return slotViews.mapIndexed { idx, sv ->
                val rawName = sv.nameEdit.text?.toString()?.trim().orEmpty().ifEmpty { existingRoster.pokemon.getOrElse(idx) { "Azumarill" } }
                val resolved = OverlayService.resolveRecommendedMovesForSpecies(rawName, lg)
                val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, lg) else null
                OverlayService.TeamMember(
                    name = rawName,
                    cp = scaled?.defaultCp ?: 1500,
                    fastMove = sv.fastEdit.text?.toString()?.trim().orEmpty().ifEmpty { scaled?.defaultFastMove ?: "Bubble" },
                    chargedMove1 = sv.c1Edit.text?.toString()?.trim().orEmpty().ifEmpty { scaled?.chargedMove1 ?: "Ice Beam" },
                    chargedMove2 = sv.c2Edit.text?.toString()?.trim().orEmpty().ifEmpty { scaled?.chargedMove2 ?: "Play Rough" },
                    ivs = scaled?.defaultIvsGl
                )
            }
        }

        for (i in 0 until 6) {
            val initName = existingRoster.pokemon.getOrElse(i) { "" }
            val resolved = OverlayService.resolveRecommendedMovesForSpecies(initName, existingRoster.league)
            val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, existingRoster.league) else null

            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val cPad = (8 * density).toInt()
                setPadding(cPad, cPad, cPad, cPad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }

            val hdrRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }
            val slotLbl = TextView(this).apply {
                text = "Slot #${i + 1}"
                setTextColor(if (isOpponent) 0xFFFDA4AF.toInt() else 0xFF34D399.toInt())
                textSize = 11f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val btnSuggestMon = Button(this).apply {
                text = "✨ Suggest Alt Mon"
                textSize = 9f
                minWidth = 0
                minimumWidth = 0
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
                setTextColor(0xFFFFFFFF.toInt())
            }
            val btnSuggestMoves = Button(this).apply {
                text = "🎯 Suggest Moves"
                textSize = 9f
                minWidth = 0
                minimumWidth = 0
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                setTextColor(0xFF0F172A.toInt())
            }
            hdrRow.addView(slotLbl)
            hdrRow.addView(btnSuggestMon)
            hdrRow.addView(btnSuggestMoves)
            card.addView(hdrRow)

            val nameEdit = AutoCompleteTextView(this).apply {
                setText(initName, false)
                hint = "Pokémon #${i + 1}"
                setTextColor(0xFFF8FAFC.toInt())
                setHintTextColor(0xFF64748B.toInt())
                setBackgroundColor(0xFF0F172A.toInt())
                textSize = 11.5f
                setSingleLine(true)
                val iPad = (6 * density).toInt()
                setPadding(iPad, iPad, iPad, iPad)
                setAdapter(PokemonAutocompleteAdapter(currentLeagueProvider))
                threshold = 1
            }
            card.addView(nameEdit)

            val movesRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (4 * density).toInt()
                }
            }
            val fastEdit = EditText(this).apply {
                setText(scaled?.defaultFastMove ?: "")
                hint = "Fast Move"
                setTextColor(0xFFCBD5E1.toInt())
                setHintTextColor(0xFF64748B.toInt())
                setBackgroundColor(0xFF0F172A.toInt())
                textSize = 10f
                setSingleLine(true)
                val iPad = (5 * density).toInt()
                setPadding(iPad, iPad, iPad, iPad)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = (4 * density).toInt()
                }
            }
            val c1Edit = EditText(this).apply {
                setText(scaled?.chargedMove1 ?: "")
                hint = "Charged 1"
                setTextColor(0xFFCBD5E1.toInt())
                setHintTextColor(0xFF64748B.toInt())
                setBackgroundColor(0xFF0F172A.toInt())
                textSize = 10f
                setSingleLine(true)
                val iPad = (5 * density).toInt()
                setPadding(iPad, iPad, iPad, iPad)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = (4 * density).toInt()
                }
            }
            val c2Edit = EditText(this).apply {
                setText(scaled?.chargedMove2 ?: "")
                hint = "Charged 2"
                setTextColor(0xFFCBD5E1.toInt())
                setHintTextColor(0xFF64748B.toInt())
                setBackgroundColor(0xFF0F172A.toInt())
                textSize = 10f
                setSingleLine(true)
                val iPad = (5 * density).toInt()
                setPadding(iPad, iPad, iPad, iPad)
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            movesRow.addView(fastEdit)
            movesRow.addView(c1Edit)
            movesRow.addView(c2Edit)
            card.addView(movesRow)

            nameEdit.setOnItemClickListener { parent, _, position, _ ->
                val chosen = parent.getItemAtPosition(position) as? OverlayService.Companion.PokemonAutocompleteSuggestion ?: return@setOnItemClickListener
                nameEdit.setText(chosen.name, false)
                fastEdit.setText(chosen.fastMove)
                c1Edit.setText(chosen.chargedMove1)
                c2Edit.setText(chosen.chargedMove2)
            }

            val suggestBox = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                visibility = android.view.View.GONE
                setPadding(0, (6 * density).toInt(), 0, 0)
            }
            card.addView(suggestBox)

            val sv = SlotEditorViews(nameEdit, fastEdit, c1Edit, c2Edit, suggestBox)
            slotViews.add(sv)

            btnSuggestMon.setOnClickListener {
                suggestBox.visibility = android.view.View.VISIBLE
                suggestBox.removeAllViews()
                val loadingTv = TextView(this).apply {
                    text = "⏳ Computing Top 5 Alternate Pokémon Upgrades for Slot #${i + 1}..."
                    setTextColor(0xFF38BDF8.toInt())
                    textSize = 10f
                }
                suggestBox.addView(loadingTv)
                val curMembers = buildCurrentTeamMembers()
                val lg = currentLeagueProvider()
                lifecycleScope.launch(Dispatchers.Default) {
                    val upgrades = OverlayService.recommendShow6RosterSlotUpgradesStatic(lg, curMembers, i)
                    withContext(Dispatchers.Main) {
                        suggestBox.removeAllViews()
                        for (u in upgrades) {
                            val row = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.HORIZONTAL
                                gravity = android.view.Gravity.CENTER_VERTICAL
                                setBackgroundColor(0xFF0F172A.toInt())
                                val rPad = (5 * density).toInt()
                                setPadding(rPad, rPad, rPad, rPad)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    bottomMargin = (3 * density).toInt()
                                }
                            }
                            val sign = if (u.weightedScoreGain >= 0) "+" else ""
                            val infoTv = TextView(this@MainActivity).apply {
                                text = "✨ ${u.candidate.name} (${sign}${u.weightedScoreGain} Score)\n${u.reason}"
                                setTextColor(0xFFE2E8F0.toInt())
                                textSize = 9.5f
                                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val useBtn = Button(this@MainActivity).apply {
                                text = "Swap In"
                                textSize = 9f
                                minWidth = 0
                                minimumWidth = 0
                                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                                setTextColor(0xFFFFFFFF.toInt())
                                setOnClickListener {
                                    nameEdit.setText(u.candidate.name, false)
                                    fastEdit.setText(u.candidate.fastMove)
                                    c1Edit.setText(u.candidate.chargedMove1)
                                    c2Edit.setText(u.candidate.chargedMove2)
                                    suggestBox.visibility = android.view.View.GONE
                                }
                            }
                            row.addView(infoTv)
                            row.addView(useBtn)
                            suggestBox.addView(row)
                        }
                    }
                }
            }

            btnSuggestMoves.setOnClickListener {
                suggestBox.visibility = android.view.View.VISIBLE
                suggestBox.removeAllViews()
                val curMembers = buildCurrentTeamMembers()
                val lg = currentLeagueProvider()
                val member = curMembers[i]
                lifecycleScope.launch(Dispatchers.Default) {
                    val moveRecs = OverlayService.recommendShow6RosterSlotMovesetsStatic(lg, member)
                    withContext(Dispatchers.Main) {
                        suggestBox.removeAllViews()
                        for (m in moveRecs) {
                            val row = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.HORIZONTAL
                                gravity = android.view.Gravity.CENTER_VERTICAL
                                setBackgroundColor(0xFF0F172A.toInt())
                                val rPad = (5 * density).toInt()
                                setPadding(rPad, rPad, rPad, rPad)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    bottomMargin = (3 * density).toInt()
                                }
                            }
                            val deltaStr = if (m.deltaBr >= 0) "+${m.deltaBr}" else "${m.deltaBr}"
                            val plusMove = OverlayService.resolveMegaPlusMoveStatic(member.name, lg, prefs)
                            val plusTag = if (plusMove != null) " + $plusMove [Mega4]" else ""
                            val infoTv = TextView(this@MainActivity).apply {
                                text = "🎯 ${m.fastMove} + ${m.chargedMove1} / ${m.chargedMove2}$plusTag (Meta BR ${m.avgBrVsMeta} • $deltaStr BR)"
                                setTextColor(if (m.isCurrent) 0xFF34D399.toInt() else 0xFFE2E8F0.toInt())
                                textSize = 9.5f
                                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val applyBtn = Button(this@MainActivity).apply {
                                text = if (m.isCurrent) "Active" else "Apply"
                                textSize = 9f
                                minWidth = 0
                                minimumWidth = 0
                                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                                setTextColor(0xFF0F172A.toInt())
                                setOnClickListener {
                                    fastEdit.setText(m.fastMove)
                                    c1Edit.setText(m.chargedMove1)
                                    c2Edit.setText(m.chargedMove2)
                                    suggestBox.visibility = android.view.View.GONE
                                }
                            }
                            row.addView(infoTv)
                            row.addView(applyBtn)
                            suggestBox.addView(row)
                        }
                    }
                }
            }

            container.addView(card)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(if (isOpponent) "⚔️ Edit Opponent Show 6 Roster" else "🛡️ Edit My Show 6 Roster")
            .setView(scroll)
            .setPositiveButton("💾 Save Pick-6", null)
            .setNegativeButton("Cancel", null)
            .create()

        // Dedicated Clone & Cross-Mode Copy panel inside the Show 6 Edit Team modal
        val clonePanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF1E293B.toInt())
            val cPad = (10 * density).toInt()
            setPadding(cPad, cPad, cPad, cPad)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = (8 * density).toInt()
            }
        }
        val cloneTitle = TextView(this).apply {
            text = "📋 CLONE / COPY TEAM (TO ANY FORMAT, SIDE OR MODE)"
            setTextColor(0xFFFBBF24.toInt())
            textSize = 10.5f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        clonePanel.addView(cloneTitle)

        val allTargetFormats = (OverlayService.getEnabledShow6LeaguesStatic(prefs) + OverlayService.getEnabledGblLeaguesStatic(prefs)).distinct()
        val cloneTargetSpinner = Spinner(this).apply {
            adapter = createThemedSpinnerAdapter(allTargetFormats)
            val initIdx = allTargetFormats.indexOfFirst { it.equals(existingRoster.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
            setSelection(initIdx)
            setBackgroundColor(0xFF0F172A.toInt())
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (36 * density).toInt()
            ).apply {
                topMargin = (6 * density).toInt()
                bottomMargin = (6 * density).toInt()
            }
        }
        clonePanel.addView(cloneTargetSpinner)

        val cloneBtnsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        val btnCloneSameSide = Button(this).apply {
            text = "📋 Clone in Show 6"
            textSize = 9.5f
            isAllCaps = false
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
            setTextColor(0xFFFBBF24.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = (4 * density).toInt()
            }
            setOnClickListener {
                val mons = slotViews.map { it.nameEdit.text?.toString()?.trim().orEmpty() }.filter { it.isNotEmpty() }
                if (OverlayService.hasMultipleMegasStatic(mons)) {
                    Toast.makeText(this@MainActivity, "⚠️ Max 1 Mega/Primal Pokémon allowed per team!", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                val targetLg = cloneTargetSpinner.selectedItem?.toString() ?: currentLeagueProvider()
                val cloned = existingRoster.copy(
                    id = "show6-clone-${UUID.randomUUID()}",
                    name = "${nameInput.text?.toString()?.trim().orEmpty().ifEmpty { existingRoster.name }} (Copy)",
                    league = targetLg,
                    pokemon = mons.take(6).ifEmpty { existingRoster.pokemon }
                )
                if (currentIsOpponent) {
                    val oppList = loadShow6OpponentRostersOf6().toMutableList()
                    oppList.add(0, cloned)
                    saveShow6OpponentRostersOf6(oppList)
                } else {
                    val myList = loadShow6RostersOf6().toMutableList()
                    myList.add(0, cloned)
                    saveShow6RostersOf6(myList)
                }
                setupShow6ModeHubUi()
                Toast.makeText(this@MainActivity, "📋 Cloned '${cloned.name}' ($targetLg)!", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
                showEditShow6RosterDialog(cloned, currentIsOpponent, onSaved)
            }
        }
        val btnCloneOtherSide = Button(this).apply {
            text = if (currentIsOpponent) "⇄ Clone to My 6" else "⇄ Clone to Opp 6"
            textSize = 9.5f
            isAllCaps = false
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF881337.toInt())
            setTextColor(0xFFFECDD3.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = (4 * density).toInt()
            }
            setOnClickListener {
                val mons = slotViews.map { it.nameEdit.text?.toString()?.trim().orEmpty() }.filter { it.isNotEmpty() }
                if (OverlayService.hasMultipleMegasStatic(mons)) {
                    Toast.makeText(this@MainActivity, "⚠️ Max 1 Mega/Primal Pokémon allowed per team!", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                val targetLg = cloneTargetSpinner.selectedItem?.toString() ?: currentLeagueProvider()
                val nextOpp = !currentIsOpponent
                val cloned = existingRoster.copy(
                    id = "show6-sideclone-${UUID.randomUUID()}",
                    name = "${nameInput.text?.toString()?.trim().orEmpty().ifEmpty { existingRoster.name }} (${if (nextOpp) "Opp" else "My"})",
                    league = targetLg,
                    pokemon = mons.take(6).ifEmpty { existingRoster.pokemon }
                )
                if (nextOpp) {
                    val oppList = loadShow6OpponentRostersOf6().toMutableList()
                    oppList.add(0, cloned)
                    saveShow6OpponentRostersOf6(oppList)
                } else {
                    val myList = loadShow6RostersOf6().toMutableList()
                    myList.add(0, cloned)
                    saveShow6RostersOf6(myList)
                }
                setupShow6ModeHubUi()
                Toast.makeText(this@MainActivity, "⇄ Cloned '${cloned.name}' to ${if (nextOpp) "Opponent 6" else "My Show 6"}!", Toast.LENGTH_SHORT).show()
                dialog.dismiss()
                showEditShow6RosterDialog(cloned, nextOpp, onSaved)
            }
        }
        val btnCopyTop3ToGbl = Button(this).apply {
            text = "🛡️ Top 3 → GBL"
            textSize = 9.5f
            isAllCaps = false
            backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0369A1.toInt())
            setTextColor(0xFFE0F2FE.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                val mons = slotViews.map { it.nameEdit.text?.toString()?.trim().orEmpty() }.filter { it.isNotEmpty() }
                val top3Names = mons.take(3).ifEmpty { existingRoster.pokemon.take(3) }
                if (OverlayService.hasMultipleMegasStatic(top3Names)) {
                    Toast.makeText(this@MainActivity, "⚠️ Max 1 Mega/Primal Pokémon allowed per team!", Toast.LENGTH_LONG).show()
                    return@setOnClickListener
                }
                val selectedTargetLg = cloneTargetSpinner.selectedItem?.toString() ?: "GREAT LEAGUE"
                val slots = top3Names.map { monName ->
                    val resolved = OverlayService.resolveRecommendedMovesForSpecies(monName, selectedTargetLg)
                    val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, selectedTargetLg) else null
                    PokemonSlot(
                        name = monName,
                        cp = scaled?.defaultCp ?: 1500,
                        fastMove = scaled?.defaultFastMove ?: "Tackle",
                        chargedMove1 = scaled?.chargedMove1 ?: "Struggle",
                        chargedMove2 = scaled?.chargedMove2 ?: "Return",
                        ivs = scaled?.defaultIvsGl
                    )
                }
                val newGblPreset = TeamPreset(
                    id = UUID.randomUUID().toString(),
                    name = "${nameInput.text?.toString()?.trim().orEmpty().ifEmpty { existingRoster.name }} (Top 3 → GBL)",
                    league = selectedTargetLg,
                    pokemon = slots,
                    isSelected = true,
                    combatMode = "gbl"
                )
                val type = object : TypeToken<List<TeamPreset>>() {}.type
                val rawGbl = prefs.getString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, null)
                val gblList = (try { gson.fromJson<List<TeamPreset>>(rawGbl, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
                gblList.add(0, newGblPreset)
                prefs.edit()
                    .putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(gblList))
                    .putString("gbl_selected_preset_id", newGblPreset.id)
                    .apply()
                Toast.makeText(this@MainActivity, "🛡️ Copied Top 3 (${top3Names.joinToString("/")}) as separate GBL Blind 3 team ($selectedTargetLg)!", Toast.LENGTH_LONG).show()
            }
        }
        cloneBtnsRow.addView(btnCloneSameSide)
        cloneBtnsRow.addView(btnCloneOtherSide)
        cloneBtnsRow.addView(btnCopyTop3ToGbl)
        clonePanel.addView(cloneBtnsRow)
        container.addView(clonePanel)

        dialog.show()
        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val mons = slotViews.map { it.nameEdit.text?.toString()?.trim().orEmpty() }.filter { it.isNotEmpty() }
            if (mons.size < 6) {
                Toast.makeText(this, "Please fill all 6 Pokémon slots.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (OverlayService.hasMultipleMegasStatic(mons)) {
                Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            val lg = currentLeagueProvider()
            val updated = existingRoster.copy(
                name = nameInput.text?.toString()?.trim().orEmpty().ifEmpty { existingRoster.name },
                league = lg,
                pokemon = mons.take(6)
            )
            onSaved(updated, currentIsOpponent)
            dialog.dismiss()
        }
    }

    private fun setupLimitedMetasSettingsUi() {
        val btnSyncPvPokeMetas = findViewById<Button>(R.id.btn_sync_pvpoke_limited_metas)
        val tvPvPokeMetasStatus = findViewById<TextView>(R.id.tv_pvpoke_limited_metas_status)
        val btnOpenGblMetas = findViewById<Button>(R.id.btn_open_gbl_limited_metas_dialog)
        val btnOpenShow6Metas = findViewById<Button>(R.id.btn_open_show6_limited_metas_dialog)
        val tvPinnedSummary = findViewById<TextView>(R.id.tv_pinned_limited_metas_summary)

        fun updateLimitedMetasSummaryLabels() {
            val catalog = OverlayService.getLimitedMetaCatalogStatic(prefs)
            val curCount = catalog.count { it.lifecycleStatus == "CURRENT" }
            val upCount = catalog.count { it.lifecycleStatus == "UPCOMING" }
            val recCount = catalog.count { it.lifecycleStatus == "RECENT" }
            tvPvPokeMetasStatus?.text =
                "Catalog: ${catalog.size} ranked PvPoke cups (🟢 $curCount Current • 🔜 $upCount Upcoming • 🕒 $recCount Recent • Obsolete hidden)"
            val gblForced = OverlayService.getForcedGblLeaguesStatic()
            val gblPinned = OverlayService.getPinnedGblLimitedMetasStatic(prefs)
            val s6Forced = OverlayService.getForcedShow6LeaguesStatic(prefs)
            val s6Pinned = OverlayService.getPinnedShow6LimitedMetasStatic(prefs)
            btnOpenGblMetas?.text = "🛡️ GBL Metas (${gblForced.size} Forced + ${gblPinned.size})"
            btnOpenShow6Metas?.text = "🏛️ Frontier Metas (${s6Forced.size} Forced + ${s6Pinned.size})"
            val gblStr = (gblForced + gblPinned).joinToString(", ")
            val s6Str = (s6Forced + s6Pinned).joinToString(", ")
            tvPinnedSummary?.text = "Active GBL (Blind 3): $gblStr\nActive Battle Frontier (Show 6): $s6Str"
        }

        updateLimitedMetasSummaryLabels()

        btnSyncPvPokeMetas?.setOnClickListener {
            btnSyncPvPokeMetas.isEnabled = false
            btnSyncPvPokeMetas.text = "⏳ Syncing PvPoke GitHub Formats & Rankings..."
            lifecycleScope.launch(Dispatchers.IO) {
                val msg = OverlayService.fetchPvPokeLimitedMetasBlocking(prefs, filesDir)
                withContext(Dispatchers.Main) {
                    btnSyncPvPokeMetas.isEnabled = true
                    btnSyncPvPokeMetas.text = "🔄 Sync Ranked Limited Metas from PvPoke GitHub"
                    updateLimitedMetasSummaryLabels()
                    setupAntiMetaTeamBuilderUi()
                    setupMetaTabUi()
                    if (currentActivePage == "meta") refreshMetaTabDashboard()
                    refreshPresetsUi()
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                }
            }
        }

        fun openMultiSelectLimitedMetaDialog(isShow6ModeSelector: Boolean) {
            val nowMs = System.currentTimeMillis()
            val catalog = OverlayService.getLimitedMetaCatalogStatic(prefs)
            val currentlyPinned = if (isShow6ModeSelector) {
                OverlayService.getPinnedShow6LimitedMetasStatic(prefs).toMutableSet()
            } else {
                OverlayService.getPinnedGblLimitedMetasStatic(prefs).toMutableSet()
            }

            data class SelectorRow(
                val leagueKey: String,
                val label: String,
                val isForced: Boolean
            )

            val rows = mutableListOf<SelectorRow>()
            if (isShow6ModeSelector) {
                // 1. Forced top items: ONLY current active Battle Frontier cups (Spectral, Cauldron, Master)
                val forcedBfFormats = catalog
                    .filter {
                        (OverlayService.isCurrentBattleFrontierCupStatic(it.title, it.cup) ||
                            OverlayService.isCurrentBattleFrontierCupStatic(it.leagueKey, it.cup)) &&
                            it.lifecycleStatus == "CURRENT"
                    }
                    .sortedBy { it.cp }
                val forcedKeysSet = forcedBfFormats.map { it.leagueKey.uppercase() }.toSet()
                for (m in forcedBfFormats) {
                    val megaTag = if (m.allowsMega) " • 🧬 Max 1 Mega" else ""
                    rows.add(
                        SelectorRow(
                            leagueKey = m.leagueKey.uppercase(),
                            label = "🔒 [FORCED DEFAULT] ${m.leagueKey.uppercase()} • ${m.cp} CP (${m.cup})$megaTag",
                            isForced = true
                        )
                    )
                }
                // 2. Optional regular Great / Ultra / Master League downloads for Show 6 if desired
                val optionalOpenFormats = catalog.filter { it.category == "standard_open" }
                for (m in optionalOpenFormats) {
                    rows.add(
                        SelectorRow(
                            leagueKey = m.leagueKey,
                            label = "🟢 [OPTIONAL OPEN] ${m.leagueKey} • ${m.cp} CP (${m.cup})",
                            isForced = false
                        )
                    )
                }
                // 3. Remaining user-selectable limited metas (including older/non-current cups)
                val optionalLimited = catalog.filterNot {
                    it.category == "standard_open" || it.leagueKey.uppercase() in forcedKeysSet
                }
                for (m in optionalLimited) {
                    val isExpired = OverlayService.isExpiredLimitedMetaStatic(m, nowMs)
                    val badge = when {
                        m.lifecycleStatus == "CURRENT" -> "🟢 [CURRENT]"
                        m.lifecycleStatus == "UPCOMING" -> "🔜 [UPCOMING]"
                        isExpired -> "⚠️ [EXPIRED >4W]"
                        else -> {
                            val daysAgo = ((nowMs - m.lastSeenAt).coerceAtLeast(0L) / 86400_000L).toInt()
                            "🕒 [RECENT • ${daysAgo}d ago]"
                        }
                    }
                    val megaTag = if (m.allowsMega) " • 🧬 Max 1 Mega" else ""
                    val expiredHint = if (isExpired) " (Uncheck to delete)" else ""
                    rows.add(
                        SelectorRow(
                            leagueKey = m.leagueKey,
                            label = "$badge ${m.leagueKey} • ${m.cp} CP (${m.cup})$megaTag$expiredHint",
                            isForced = false
                        )
                    )
                }
            } else {
                // Blind 3 PvP Mode:
                // 1. Forced top items: Standard GREAT LEAGUE, ULTRA LEAGUE, MASTER LEAGUE (ALL CAPS)
                rows.add(SelectorRow("GREAT LEAGUE", "🔒 [FORCED DEFAULT] GREAT LEAGUE • 1500 CP (all)", true))
                rows.add(SelectorRow("ULTRA LEAGUE", "🔒 [FORCED DEFAULT] ULTRA LEAGUE • 2500 CP (all)", true))
                rows.add(SelectorRow("MASTER LEAGUE", "🔒 [FORCED DEFAULT] MASTER LEAGUE • 10000 CP (all)", true))

                // 2. Optional user-selectable limited metas (including data-driven Mega Master League (10000) + Title Case cups)
                val optionalGbl = catalog.filter { it.category != "standard_open" }
                for (m in optionalGbl) {
                    val isExpired = OverlayService.isExpiredLimitedMetaStatic(m, nowMs)
                    val badge = when {
                        m.lifecycleStatus == "CURRENT" -> "🟢 [CURRENT]"
                        m.lifecycleStatus == "UPCOMING" -> "🔜 [UPCOMING]"
                        isExpired -> "⚠️ [EXPIRED >4W]"
                        else -> {
                            val daysAgo = ((nowMs - m.lastSeenAt).coerceAtLeast(0L) / 86400_000L).toInt()
                            "🕒 [RECENT • ${daysAgo}d ago]"
                        }
                    }
                    val megaTag = if (m.allowsMega) " • 🧬 Max 1 Mega" else ""
                    val expiredHint = if (isExpired) " (Uncheck to delete)" else ""
                    rows.add(
                        SelectorRow(
                            leagueKey = m.leagueKey,
                            label = "$badge ${m.leagueKey} • ${m.cp} CP (${m.cup})$megaTag$expiredHint",
                            isForced = false
                        )
                    )
                }
            }

            val labels = rows.map { it.label }.toTypedArray()
            val checked = BooleanArray(rows.size) { idx ->
                val r = rows[idx]
                r.isForced || currentlyPinned.any { it.equals(r.leagueKey, ignoreCase = true) }
            }
            AlertDialog.Builder(this)
                .setTitle(
                    if (isShow6ModeSelector) "🏛️ Select Battle Frontier (Show 6) Limited Metas"
                    else "🛡️ Select GBL (Blind 3) Limited Metas"
                )
                .setMultiChoiceItems(labels, checked) { dialogInterface, which, isChecked ->
                    val r = rows[which]
                    if (r.isForced) {
                        checked[which] = true
                        (dialogInterface as? AlertDialog)?.listView?.setItemChecked(which, true)
                        Toast.makeText(
                            this,
                            "🔒 ${r.leagueKey} is a forced default league for ${if (isShow6ModeSelector) "Show 6" else "Blind 3 PvP"} mode.",
                            Toast.LENGTH_SHORT
                        ).show()
                        return@setMultiChoiceItems
                    }
                    val lgKey = r.leagueKey
                    if (isChecked) currentlyPinned.add(lgKey)
                    else currentlyPinned.removeAll { it.equals(lgKey, ignoreCase = true) }
                }
                .setPositiveButton("💾 Save & Sync Rankings") { _, _ ->
                    val orderedSelected = rows
                        .filter { !it.isForced }
                        .map { it.leagueKey }
                        .filter { k -> currentlyPinned.any { it.equals(k, ignoreCase = true) } }
                    if (isShow6ModeSelector) {
                        OverlayService.setPinnedShow6LimitedMetasStatic(prefs, orderedSelected)
                    } else {
                        OverlayService.setPinnedGblLimitedMetasStatic(prefs, orderedSelected)
                    }
                    updateLimitedMetasSummaryLabels()
                    setupAntiMetaTeamBuilderUi()
                    setupShow6ModeHubUi()
                    setupBattleLogFilters()
                    setupMetaTabUi()
                    if (currentActivePage == "meta") refreshMetaTabDashboard()
                    refreshPresetsUi()
                    lifecycleScope.launch(Dispatchers.IO) {
                        val synced = OverlayService.syncPinnedLimitedMetaRankingsBlocking(prefs, filesDir)
                        withContext(Dispatchers.Main) {
                            dbStatusText.text = formatDbAndLeagueStatusText()
                            if (currentActivePage == "meta") refreshMetaTabDashboard()
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Saved ${orderedSelected.size} optional metas + forced defaults ($synced rankings synced from PvPoke GitHub)!",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        btnOpenGblMetas?.setOnClickListener {
            openMultiSelectLimitedMetaDialog(isShow6ModeSelector = false)
        }
        btnOpenShow6Metas?.setOnClickListener {
            openMultiSelectLimitedMetaDialog(isShow6ModeSelector = true)
        }
    }

    private fun setupShow6ModeHubUi() {
        findViewById<Button>(R.id.btn_header_mode_badge)?.setOnClickListener {
            val nextMode = if (isShow6CombatMode()) "gbl" else "show6"
            setAppCombatMode(nextMode)
            Toast.makeText(
                this,
                if (nextMode == "show6") "🏛️ Switched to Show 6 Mode (Battle Frontier)" else "🛡️ Switched to Standard GBL Mode (Blind 3 PvP)",
                Toast.LENGTH_SHORT
            ).show()
        }
        findViewById<Button>(R.id.btn_mode_standard_gbl)?.setOnClickListener {
            setAppCombatMode("gbl")
            Toast.makeText(this, "🛡️ Standard GBL Mode active", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btn_mode_show6_frontier)?.setOnClickListener {
            setAppCombatMode("show6")
            Toast.makeText(this, "🏛️ Show 6 Mode active (Independent Teams, Trash & Logs)", Toast.LENGTH_SHORT).show()
        }
        updateSettingsCombatModeButtonsUi()
        setupLimitedMetasSettingsUi()

        // Wire Settings Battle Frontier Usage & Core Google Sheet Sync + Weighting Slider (65% Usage & Cores / 35% PvPoke)
        val editBfUsageUrl = findViewById<EditText>(R.id.edit_bf_usage_sheet_url)
        val editBfCoresUrl = findViewById<EditText>(R.id.edit_bf_cores_sheet_url)
        val btnSyncBfSheets = findViewById<Button>(R.id.btn_sync_bf_sheets)
        val tvBfSheetsStatus = findViewById<TextView>(R.id.tv_bf_sheets_status)
        val tvShow6UsageWeightLabel = findViewById<TextView>(R.id.tv_show6_usage_weight_label)
        val seekShow6UsageWeight = findViewById<SeekBar>(R.id.seek_show6_usage_weight)

        editBfUsageUrl?.setText(prefs.getString(OverlayService.PREFS_KEY_BF_USAGE_SHEET_URL, OverlayService.DEFAULT_BF_USAGE_SHEET_URL))
        editBfCoresUrl?.setText(prefs.getString(OverlayService.PREFS_KEY_BF_CORES_SHEET_URL, OverlayService.DEFAULT_BF_CORES_SHEET_URL))
        tvBfSheetsStatus?.text = OverlayService.getBattleFrontierLeagueCountsSummaryStatic("Active Season 3 Cycle 1")
        val savedWeightPct = prefs.getInt(OverlayService.PREFS_KEY_SHOW6_USAGE_WEIGHT_PCT, OverlayService.DEFAULT_SHOW6_USAGE_WEIGHT_PCT).coerceIn(0, 100)
        OverlayService.activeShow6UsageWeightPct = savedWeightPct
        seekShow6UsageWeight?.progress = savedWeightPct
        tvShow6UsageWeightLabel?.text = "${savedWeightPct}% Usage & Cores / ${100 - savedWeightPct}% PvPoke"

        seekShow6UsageWeight?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val p = progress.coerceIn(0, 100)
                OverlayService.activeShow6UsageWeightPct = p
                tvShow6UsageWeightLabel?.text = "${p}% Usage & Cores / ${100 - p}% PvPoke"
                if (fromUser) {
                    prefs.edit().putInt(OverlayService.PREFS_KEY_SHOW6_USAGE_WEIGHT_PCT, p).apply()
                    if (currentActivePage == "meta") {
                        refreshMetaTabDashboard()
                    }
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        btnSyncBfSheets?.setOnClickListener {
            val uUrl = editBfUsageUrl?.text?.toString()?.trim().orEmpty().ifEmpty { OverlayService.DEFAULT_BF_USAGE_SHEET_URL }
            val cUrl = editBfCoresUrl?.text?.toString()?.trim().orEmpty().ifEmpty { OverlayService.DEFAULT_BF_CORES_SHEET_URL }
            btnSyncBfSheets.isEnabled = false
            btnSyncBfSheets.text = "⏳ Importing Battle Frontier Usage & Cores..."
            lifecycleScope.launch(Dispatchers.IO) {
                val msg = OverlayService.syncBattleFrontierSheetsBlocking(prefs, uUrl, cUrl)
                withContext(Dispatchers.Main) {
                    btnSyncBfSheets.isEnabled = true
                    btnSyncBfSheets.text = "📥 Save Links & Import Battle Frontier Usage + Cores"
                    tvBfSheetsStatus?.text = msg
                    if (currentActivePage == "meta") {
                        refreshMetaTabDashboard()
                    }
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                }
            }
        }

        val leagues = OverlayService.getEnabledShow6LeaguesStatic(prefs)
        val spinnerPick3League = findViewById<Spinner>(R.id.spinner_show6_pick3_league) ?: return
        val spinnerBlindLeague = findViewById<Spinner>(R.id.spinner_show6_blind_league) ?: return
        spinnerPick3League.adapter = createThemedSpinnerAdapter(leagues)
        spinnerBlindLeague.adapter = createThemedSpinnerAdapter(leagues)

        val myInputs = listOf(
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_1),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_2),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_3),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_4),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_5),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_my_6)
        )
        val oppInputs = listOf(
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_1),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_2),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_3),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_4),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_5),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_opp_6)
        )
        val lockInputs = listOf(
            findViewById<AutoCompleteTextView>(R.id.edit_show6_lock_1),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_lock_2),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_lock_3),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_lock_4),
            findViewById<AutoCompleteTextView>(R.id.edit_show6_lock_5)
        )

        val pick3LeagueProvider = { spinnerPick3League.selectedItem?.toString() ?: "GREAT LEAGUE" }
        val blindLeagueProvider = { spinnerBlindLeague.selectedItem?.toString() ?: "GREAT LEAGUE" }

        myInputs.filterNotNull().forEach { input ->
            input.setAdapter(PokemonAutocompleteAdapter(pick3LeagueProvider))
            input.threshold = 1
        }

        fun persistCurrentOpponent6ToPrefs() {
            val oppList = oppInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            if (oppList.isNotEmpty()) {
                prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_6, gson.toJson(oppList)).apply()
            }
        }

        oppInputs.filterNotNull().forEach { input ->
            input.setAdapter(PokemonAutocompleteAdapter(pick3LeagueProvider))
            input.threshold = 1
            input.setOnItemClickListener { _, _, _, _ ->
                persistCurrentOpponent6ToPrefs()
            }
        }

        lockInputs.filterNotNull().forEach { input ->
            input.setAdapter(PokemonAutocompleteAdapter(blindLeagueProvider))
            input.threshold = 1
        }

        // Seed default My 6 & Opponent 6
        val defaultMy6 = listOf("Azumarill", "Corsola (Galarian)", "Cradily", "Corviknight", "Feraligatr", "Gastrodon")
        val savedOpp6Raw = prefs.getString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_6, null)
        val defaultOpp6 = if (!savedOpp6Raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<List<String>>() {}.type
                gson.fromJson<List<String>>(savedOpp6Raw, type)?.takeIf { it.size >= 3 }
            } catch (_: Exception) { null }
        } else null
        val initialOpp6 = defaultOpp6 ?: listOf("Bastiodon", "Cradily", "Azumarill", "Dedenne", "Gastrodon", "Scizor")

        myInputs.forEachIndexed { idx, edit ->
            if (edit != null && edit.text.isNullOrBlank()) {
                edit.setText(defaultMy6.getOrElse(idx) { "" }, false)
            }
        }
        oppInputs.forEachIndexed { idx, edit ->
            if (edit != null && edit.text.isNullOrBlank()) {
                edit.setText(initialOpp6.getOrElse(idx) { "" }, false)
            }
        }
        persistCurrentOpponent6ToPrefs()

        val rosters6Container = findViewById<LinearLayout>(R.id.layout_show6_rosters6_list)
        val editNewRosterName = findViewById<EditText>(R.id.edit_show6_new_roster_name)
        val btnSaveRoster6 = findViewById<Button>(R.id.btn_save_show6_roster6)

        val oppRosters6Container = findViewById<LinearLayout>(R.id.layout_show6_opp_rosters6_list)
        val editNewOppRosterName = findViewById<EditText>(R.id.edit_show6_new_opp_roster_name)
        val btnSaveOppRoster6 = findViewById<Button>(R.id.btn_save_show6_opp_roster6)

        fun copyShow6RosterTop3ToGblBlind3(r: OverlayService.Companion.Show6RosterPreset) {
            val targetGblLg = when {
                r.league.contains("CAULDRON", ignoreCase = true) || r.league.contains("ULTRA", ignoreCase = true) -> "ULTRA LEAGUE"
                r.league.contains("MASTER", ignoreCase = true) -> "MASTER LEAGUE"
                else -> "GREAT LEAGUE"
            }
            val top3Names = r.pokemon.take(3)
            val slots = top3Names.map { monName ->
                val resolved = OverlayService.resolveRecommendedMovesForSpecies(monName, targetGblLg)
                val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, targetGblLg) else null
                PokemonSlot(
                    name = monName,
                    cp = scaled?.defaultCp ?: 1500,
                    fastMove = scaled?.defaultFastMove ?: "Tackle",
                    chargedMove1 = scaled?.chargedMove1 ?: "Struggle",
                    chargedMove2 = scaled?.chargedMove2 ?: "Return",
                    ivs = scaled?.defaultIvsGl
                )
            }
            val newGblPreset = TeamPreset(
                id = UUID.randomUUID().toString(),
                name = "${r.name} (Top 3 → GBL)",
                league = targetGblLg,
                pokemon = slots,
                isSelected = true
            )
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            val rawGbl = prefs.getString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, null)
            val gblList = (try { gson.fromJson<List<TeamPreset>>(rawGbl, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
            gblList.add(0, newGblPreset)
            prefs.edit()
                .putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(gblList))
                .putString("gbl_selected_preset_id", newGblPreset.id)
                .apply()
            Toast.makeText(this, "🛡️ Copied Top 3 (${top3Names.joinToString("/")}) to GBL Blind 3 ($targetGblLg)!", Toast.LENGTH_LONG).show()
        }

        var refreshBothShow6RosterLists: () -> Unit = {}

        fun renderShow6RostersOf6List() {
            rosters6Container?.removeAllViews()
            val rosters = loadShow6RostersOf6()
            val density = resources.displayMetrics.density
            for (r in rosters) {
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setBackgroundColor(0xFF1E293B.toInt())
                    val pad = (6 * density).toInt()
                    setPadding(pad, pad, pad, pad)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (4 * density).toInt()
                    }
                }
                val tv = TextView(this).apply {
                    text = "${r.name} (${r.league})\n${r.pokemon.joinToString(" • ")}"
                    textSize = 10f
                    setTextColor(0xFFF8FAFC.toInt())
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                val loadBtn = Button(this).apply {
                    text = "Load"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                    setTextColor(0xFF0F172A.toInt())
                    setOnClickListener {
                        val lgIdx = leagues.indexOfFirst { it.equals(r.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                        spinnerPick3League.setSelection(lgIdx)
                        myInputs.forEachIndexed { i, edit ->
                            edit?.setText(r.pokemon.getOrElse(i) { "" }, false)
                        }
                        Toast.makeText(this@MainActivity, "Loaded '${r.name}' into Your 6!", Toast.LENGTH_SHORT).show()
                    }
                }
                val cloneBtn = Button(this).apply {
                    text = "📋"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF334155.toInt())
                    setTextColor(0xFFFBBF24.toInt())
                    setOnClickListener {
                        val cloned = r.copy(
                            id = "show6-clone-${System.currentTimeMillis()}",
                            name = "${r.name} (Copy)"
                        )
                        val cur = loadShow6RostersOf6().toMutableList()
                        cur.add(0, cloned)
                        saveShow6RostersOf6(cur)
                        renderShow6RostersOf6List()
                        showEditShow6RosterDialog(cloned, isOpponent = false) { updated, finalIsOpp ->
                            if (finalIsOpp) {
                                saveShow6RostersOf6(loadShow6RostersOf6().filter { it.id != cloned.id })
                                val oppList = loadShow6OpponentRostersOf6().toMutableList()
                                oppList.add(0, updated)
                                saveShow6OpponentRostersOf6(oppList)
                            } else {
                                saveShow6RostersOf6(loadShow6RostersOf6().map { if (it.id == cloned.id) updated else it })
                            }
                            refreshBothShow6RosterLists()
                            Toast.makeText(this@MainActivity, "Saved cloned roster '${updated.name}'!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                val swapBtn = Button(this).apply {
                    text = "⇄Opp"
                    textSize = 8.5f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF881337.toInt())
                    setTextColor(0xFFFECDD3.toInt())
                    setOnClickListener {
                        val swapped = r.copy(id = "show6-swap-${System.currentTimeMillis()}")
                        val remMy = loadShow6RostersOf6().filter { it.id != r.id }
                        if (remMy.isNotEmpty()) saveShow6RostersOf6(remMy)
                        val curOpp = loadShow6OpponentRostersOf6().toMutableList()
                        curOpp.add(0, swapped)
                        saveShow6OpponentRostersOf6(curOpp)
                        oppInputs.forEachIndexed { idx, edit -> edit?.setText(swapped.pokemon.getOrElse(idx) { "" }, false) }
                        persistCurrentOpponent6ToPrefs()
                        refreshBothShow6RosterLists()
                        Toast.makeText(this@MainActivity, "⇄ Swapped '${r.name}' to Opponent 6!", Toast.LENGTH_SHORT).show()
                    }
                }
                val toGblBtn = Button(this).apply {
                    text = "→GBL"
                    textSize = 8.5f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0369A1.toInt())
                    setTextColor(0xFFE0F2FE.toInt())
                    setOnClickListener {
                        copyShow6RosterTop3ToGblBlind3(r)
                    }
                }
                val editBtn = Button(this).apply {
                    text = "✏️"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
                    setTextColor(0xFFFFFFFF.toInt())
                    setOnClickListener {
                        showEditShow6RosterDialog(r, isOpponent = false) { updated, finalIsOpp ->
                            if (finalIsOpp) {
                                val remMy = loadShow6RostersOf6().filter { it.id != r.id }
                                if (remMy.isNotEmpty()) saveShow6RostersOf6(remMy)
                                val oppList = loadShow6OpponentRostersOf6().toMutableList()
                                oppList.add(0, updated)
                                saveShow6OpponentRostersOf6(oppList)
                            } else {
                                val next = loadShow6RostersOf6().map { if (it.id == r.id) updated else it }
                                saveShow6RostersOf6(next)
                            }
                            refreshBothShow6RosterLists()
                            Toast.makeText(this@MainActivity, "Updated '${updated.name}'!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                val delBtn = Button(this).apply {
                    text = "✕"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF7F1D1D.toInt())
                    setTextColor(0xFFFECACA.toInt())
                    setOnClickListener {
                        val allMy6 = loadShow6RostersOf6()
                        if (allMy6.size <= 1) {
                            Toast.makeText(this@MainActivity, "Must keep at least 1 stored team in the app", Toast.LENGTH_SHORT).show()
                            return@setOnClickListener
                        }
                        val trash = loadDeletedShow6RostersTrash().toMutableList()
                        trash.add(0, DeletedShow6RosterTrashItem(r, isOpponent = false))
                        saveDeletedShow6RostersTrash(trash)
                        val updated = allMy6.filter { it.id != r.id }
                        saveShow6RostersOf6(updated)
                        renderShow6RostersOf6List()
                        showUndoBanner("🗑️ My Pick-6 '${r.name}' moved to Show 6 Trash") {
                            restoreShow6RosterFromTrash(DeletedShow6RosterTrashItem(r, isOpponent = false))
                        }
                    }
                }
                row.addView(tv)
                row.addView(loadBtn)
                row.addView(swapBtn)
                row.addView(editBtn)
                row.addView(delBtn)
                rosters6Container?.addView(row)
            }
        }

        fun renderShow6OpponentRostersOf6List() {
            oppRosters6Container?.removeAllViews()
            val rosters = loadShow6OpponentRostersOf6()
            val density = resources.displayMetrics.density
            for (r in rosters) {
                val row = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setBackgroundColor(0xFF1E293B.toInt())
                    val pad = (6 * density).toInt()
                    setPadding(pad, pad, pad, pad)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (4 * density).toInt()
                    }
                }
                val tv = TextView(this).apply {
                    text = "⚔️ ${r.name} (${r.league})\n${r.pokemon.joinToString(" • ")}"
                    textSize = 10f
                    setTextColor(0xFFFECDD3.toInt())
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                val loadBtn = Button(this).apply {
                    text = "Load"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFE11D48.toInt())
                    setTextColor(0xFFFFFFFF.toInt())
                    setOnClickListener {
                        val lgIdx = leagues.indexOfFirst { it.equals(r.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                        spinnerPick3League.setSelection(lgIdx)
                        oppInputs.forEachIndexed { i, edit ->
                            edit?.setText(r.pokemon.getOrElse(i) { "" }, false)
                        }
                        persistCurrentOpponent6ToPrefs()
                        Toast.makeText(this@MainActivity, "Loaded '${r.name}' into Opponent's 6!", Toast.LENGTH_SHORT).show()
                    }
                }
                val swapBtn = Button(this).apply {
                    text = "⇄My"
                    textSize = 8.5f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF065F46.toInt())
                    setTextColor(0xFFA7F3D0.toInt())
                    setOnClickListener {
                        val swapped = r.copy(id = "show6-swap-my-${System.currentTimeMillis()}")
                        saveShow6OpponentRostersOf6(loadShow6OpponentRostersOf6().filter { it.id != r.id })
                        val curMy = loadShow6RostersOf6().toMutableList()
                        curMy.add(0, swapped)
                        saveShow6RostersOf6(curMy)
                        myInputs.forEachIndexed { idx, edit -> edit?.setText(swapped.pokemon.getOrElse(idx) { "" }, false) }
                        renderShow6RostersOf6List()
                        renderShow6OpponentRostersOf6List()
                        Toast.makeText(this@MainActivity, "⇄ Swapped '${r.name}' to My Show 6!", Toast.LENGTH_SHORT).show()
                    }
                }
                val editBtn = Button(this).apply {
                    text = "✏️"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
                    setTextColor(0xFFFFFFFF.toInt())
                    setOnClickListener {
                        showEditShow6RosterDialog(r, isOpponent = true) { updated, finalIsOpp ->
                            if (!finalIsOpp) {
                                saveShow6OpponentRostersOf6(loadShow6OpponentRostersOf6().filter { it.id != r.id })
                                val myList = loadShow6RostersOf6().toMutableList()
                                myList.add(0, updated)
                                saveShow6RostersOf6(myList)
                            } else {
                                val next = loadShow6OpponentRostersOf6().map { if (it.id == r.id) updated else it }
                                saveShow6OpponentRostersOf6(next)
                            }
                            renderShow6RostersOf6List()
                            renderShow6OpponentRostersOf6List()
                            Toast.makeText(this@MainActivity, "Updated '${updated.name}'!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                val delBtn = Button(this).apply {
                    text = "✕"
                    textSize = 9f
                    minWidth = 0
                    minimumWidth = 0
                    backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF7F1D1D.toInt())
                    setTextColor(0xFFFECACA.toInt())
                    setOnClickListener {
                        val trash = loadDeletedShow6RostersTrash().toMutableList()
                        trash.add(0, DeletedShow6RosterTrashItem(r, isOpponent = true))
                        saveDeletedShow6RostersTrash(trash)
                        val updated = loadShow6OpponentRostersOf6().filter { it.id != r.id }
                        saveShow6OpponentRostersOf6(updated)
                        renderShow6OpponentRostersOf6List()
                        showUndoBanner("🗑️ Opponent Pick-6 '${r.name}' moved to Show 6 Trash") {
                            restoreShow6RosterFromTrash(DeletedShow6RosterTrashItem(r, isOpponent = true))
                        }
                    }
                }
                row.addView(tv)
                row.addView(loadBtn)
                row.addView(swapBtn)
                row.addView(editBtn)
                row.addView(delBtn)
                oppRosters6Container?.addView(row)
            }
        }

        refreshBothShow6RosterLists = {
            renderShow6RostersOf6List()
            renderShow6OpponentRostersOf6List()
        }
        refreshBothShow6RosterLists()

        findViewById<Button>(R.id.btn_edit_active_my6)?.setOnClickListener {
            val lg = pick3LeagueProvider()
            val curMons = myInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            val tempRoster = OverlayService.Companion.Show6RosterPreset(
                id = "active-my6",
                name = editNewRosterName?.text?.toString()?.trim().orEmpty().ifEmpty { "Active My 6 ($lg)" },
                league = lg,
                pokemon = if (curMons.size >= 6) curMons.take(6) else defaultMy6
            )
            showEditShow6RosterDialog(tempRoster, isOpponent = false) { updated, finalIsOpp ->
                val lgIdx = leagues.indexOfFirst { it.equals(updated.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                spinnerPick3League.setSelection(lgIdx)
                if (finalIsOpp) {
                    oppInputs.forEachIndexed { idx, edit -> edit?.setText(updated.pokemon.getOrElse(idx) { "" }, false) }
                    persistCurrentOpponent6ToPrefs()
                    Toast.makeText(this, "Applied edited roster into Opponent's 6!", Toast.LENGTH_SHORT).show()
                } else {
                    myInputs.forEachIndexed { idx, edit -> edit?.setText(updated.pokemon.getOrElse(idx) { "" }, false) }
                    Toast.makeText(this, "Applied edited My 6!", Toast.LENGTH_SHORT).show()
                }
            }
        }

        findViewById<Button>(R.id.btn_edit_active_opp6)?.setOnClickListener {
            val lg = pick3LeagueProvider()
            val curMons = oppInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            val tempRoster = OverlayService.Companion.Show6RosterPreset(
                id = "active-opp6",
                name = editNewOppRosterName?.text?.toString()?.trim().orEmpty().ifEmpty { "Active Opponent 6 ($lg)" },
                league = lg,
                pokemon = if (curMons.size >= 6) curMons.take(6) else initialOpp6
            )
            showEditShow6RosterDialog(tempRoster, isOpponent = true) { updated, finalIsOpp ->
                val lgIdx = leagues.indexOfFirst { it.equals(updated.league, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                spinnerPick3League.setSelection(lgIdx)
                if (!finalIsOpp) {
                    myInputs.forEachIndexed { idx, edit -> edit?.setText(updated.pokemon.getOrElse(idx) { "" }, false) }
                    Toast.makeText(this, "Applied edited roster into Your 6!", Toast.LENGTH_SHORT).show()
                } else {
                    oppInputs.forEachIndexed { idx, edit -> edit?.setText(updated.pokemon.getOrElse(idx) { "" }, false) }
                    persistCurrentOpponent6ToPrefs()
                    Toast.makeText(this, "Applied edited Opponent 6!", Toast.LENGTH_SHORT).show()
                }
            }
        }

        findViewById<Button>(R.id.btn_flip_active_my6_opp6)?.setOnClickListener {
            val curMy = myInputs.map { it?.text?.toString()?.trim().orEmpty() }
            val curOpp = oppInputs.map { it?.text?.toString()?.trim().orEmpty() }
            myInputs.forEachIndexed { idx, edit -> edit?.setText(curOpp.getOrElse(idx) { "" }, false) }
            oppInputs.forEachIndexed { idx, edit -> edit?.setText(curMy.getOrElse(idx) { "" }, false) }
            persistCurrentOpponent6ToPrefs()
            Toast.makeText(this, "⇄ Flipped Your 6 and Opponent's 6!", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btn_load_most_likely_opp6)?.setOnClickListener {
            val formatLabels = leagues.map { lg ->
                val mon6 = OverlayService.getMostLikelyMetaOpponent6Static(lg)
                "🔥 $lg:\n   ${mon6.joinToString(" • ")}"
            }.toTypedArray()
            AlertDialog.Builder(this)
                .setTitle("🔥 Load Most Likely Meta Opponent 6 by Format")
                .setItems(formatLabels) { _, which ->
                    val chosenLg = leagues.getOrElse(which) { pick3LeagueProvider() }
                    val mon6 = OverlayService.getMostLikelyMetaOpponent6Static(chosenLg)
                    val lgIdx = leagues.indexOfFirst { it.equals(chosenLg, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                    spinnerPick3League.setSelection(lgIdx)
                    oppInputs.forEachIndexed { idx, edit -> edit?.setText(mon6.getOrElse(idx) { "" }, false) }
                    persistCurrentOpponent6ToPrefs()
                    Toast.makeText(
                        this,
                        "🔥 Loaded Most Likely Meta Opponent 6 for $chosenLg!",
                        Toast.LENGTH_LONG
                    ).show()
                }
                .setNeutralButton("Save All 4 Formats to Opp 6") { _, _ ->
                    val curOpp = loadShow6OpponentRostersOf6().toMutableList()
                    for (lg in leagues.reversed()) {
                        val mon6 = OverlayService.getMostLikelyMetaOpponent6Static(lg)
                        val name = "Most Likely Opp 6 ($lg)"
                        curOpp.removeAll { it.name.equals(name, ignoreCase = true) }
                        curOpp.add(
                            0,
                            OverlayService.Companion.Show6RosterPreset(
                                id = "show6-likely-opp6-${lg.lowercase().replace("[^a-z0-9]".toRegex(), "-")}",
                                name = name,
                                league = lg,
                                pokemon = mon6
                            )
                        )
                    }
                    saveShow6OpponentRostersOf6(curOpp)
                    renderShow6OpponentRostersOf6List()
                    Toast.makeText(this, "💾 Saved Most Likely Meta Opponent 6 for all 4 formats!", Toast.LENGTH_LONG).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        btnSaveRoster6?.setOnClickListener {
            val lg = pick3LeagueProvider()
            val mons = myInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            if (mons.size < 6) {
                Toast.makeText(this, "Enter all 6 Pokémon in 'Your 6' before saving a Team of 6", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (OverlayService.hasMultipleMegasStatic(mons)) {
                Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            val rName = editNewRosterName?.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                ?: "${lg.split(" ").first()} Show 6 (${mons.take(2).joinToString("/")})"
            val current = loadShow6RostersOf6().toMutableList()
            current.add(
                0,
                OverlayService.Companion.Show6RosterPreset(
                    name = rName,
                    league = lg,
                    pokemon = mons.take(6)
                )
            )
            saveShow6RostersOf6(current)
            editNewRosterName?.setText("")
            renderShow6RostersOf6List()
            Toast.makeText(this, "Saved My Team of 6: $rName", Toast.LENGTH_SHORT).show()
        }

        btnSaveOppRoster6?.setOnClickListener {
            val lg = pick3LeagueProvider()
            val mons = oppInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            if (mons.size < 6) {
                Toast.makeText(this, "Enter all 6 Pokémon in 'Opponent's 6' before saving an Opponent Team of 6", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (OverlayService.hasMultipleMegasStatic(mons)) {
                Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            val rName = editNewOppRosterName?.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                ?: "Opp ${lg.split(" ").first()} 6 (${mons.take(2).joinToString("/")})"
            val current = loadShow6OpponentRostersOf6().toMutableList()
            current.add(
                0,
                OverlayService.Companion.Show6RosterPreset(
                    name = rName,
                    league = lg,
                    pokemon = mons.take(6)
                )
            )
            saveShow6OpponentRostersOf6(current)
            editNewOppRosterName?.setText("")
            renderShow6OpponentRostersOf6List()
            Toast.makeText(this, "Saved Opponent Team of 6: $rName", Toast.LENGTH_SHORT).show()
        }

        // Sub-tab switcher between Builder 1 (6v6 Pick-3) and Builder 2 (Blind Show 6)
        val btnTabPick3 = findViewById<Button>(R.id.btn_show6_tab_pick3)
        val btnTabBlind6 = findViewById<Button>(R.id.btn_show6_tab_blind6)
        val layoutBuilderPick3 = findViewById<LinearLayout>(R.id.layout_show6_builder_pick3)
        val layoutBuilderBlind6 = findViewById<LinearLayout>(R.id.layout_show6_builder_blind6)

        fun switchShow6SubTab(tab: String) {
            val isPick3 = (tab == "pick3")
            layoutBuilderPick3?.visibility = if (isPick3) android.view.View.VISIBLE else android.view.View.GONE
            layoutBuilderBlind6?.visibility = if (!isPick3) android.view.View.VISIBLE else android.view.View.GONE
            btnTabPick3?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (isPick3) 0xFFD97706.toInt() else 0xFF334155.toInt()
            )
            btnTabPick3?.setTextColor(if (isPick3) 0xFF0F172A.toInt() else 0xFFCBD5E1.toInt())
            btnTabBlind6?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (!isPick3) 0xFF0284C7.toInt() else 0xFF334155.toInt()
            )
            btnTabBlind6?.setTextColor(if (!isPick3) 0xFFFFFFFF.toInt() else 0xFFCBD5E1.toInt())
        }

        btnTabPick3?.setOnClickListener { switchShow6SubTab("pick3") }
        btnTabBlind6?.setOnClickListener { switchShow6SubTab("blind6") }

        // Builder 1: Run 6v6 Pick-3 Simulation
        val btnRunPick3 = findViewById<Button>(R.id.btn_run_show6_pick3)
        val layoutPick3Results = findViewById<LinearLayout>(R.id.layout_show6_pick3_results)

        fun equipShow6LineupToOverlay(rec: OverlayService.Companion.Show6Pick3LineupRec, league: String) {
            if (!isShow6CombatMode()) {
                setAppCombatMode("show6")
            }
            val newPreset = TeamPreset(
                id = UUID.randomUUID().toString(),
                name = "Show 6 ${rec.archetype} #${rec.rank}: ${rec.lead.name}/${rec.safeSwap.name}/${rec.closer.name}",
                league = league,
                pokemon = listOf(
                    PokemonSlot(rec.lead.name, rec.lead.cp, rec.lead.fastMove, rec.lead.chargedMove1, rec.lead.chargedMove2, rec.lead.ivs),
                    PokemonSlot(rec.safeSwap.name, rec.safeSwap.cp, rec.safeSwap.fastMove, rec.safeSwap.chargedMove1, rec.safeSwap.chargedMove2, rec.safeSwap.ivs),
                    PokemonSlot(rec.closer.name, rec.closer.cp, rec.closer.fastMove, rec.closer.chargedMove1, rec.closer.chargedMove2, rec.closer.ivs)
                ),
                isSelected = true,
                archetype = rec.archetype,
                leadAggBr = rec.leadBr,
                machineAggBr = rec.viabilityWeightedBr,
                safeSwapBr = rec.swapBr,
                closerSwapBr = rec.closerBr,
                closerBr = rec.closerBr,
                synergySummary = rec.synergyNote
            )
            val existing = loadPresets().toMutableList()
            existing.add(0, newPreset)
            savePresets(existing)
            setSelectedPreset(newPreset.id)
            Toast.makeText(
                this,
                "⚡ Equipped Show 6 Team of 3: ${rec.lead.name} / ${rec.safeSwap.name} / ${rec.closer.name}",
                Toast.LENGTH_LONG
            ).show()
        }

        btnRunPick3?.setOnClickListener {
            val lg = pick3LeagueProvider()
            val my6 = myInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            val opp6 = oppInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            if (my6.size < 3 || opp6.size < 3) {
                Toast.makeText(this, "Enter at least 3 Pokémon for Your Roster and Opponent's Roster", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (OverlayService.hasMultipleMegasStatic(my6) || OverlayService.hasMultipleMegasStatic(opp6)) {
                Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per Show 6 team!", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            persistCurrentOpponent6ToPrefs()
            btnRunPick3.isEnabled = false
            btnRunPick3.text = "⏳ Simulating 14,400 Ordered 3v3 Lineups & Best Movesets..."

            lifecycleScope.launch(Dispatchers.Default) {
                val res = OverlayService.evaluateShow6Pick3MatchupStatic(lg, my6, opp6)
                withContext(Dispatchers.Main) {
                    btnRunPick3.isEnabled = true
                    btnRunPick3.text = "⚡ Simulate 6v6 Pick-3 (3 ABB • 3 ABC • 3 Duo-Core)"
                    layoutPick3Results?.removeAllViews()
                    val density = resources.displayMetrics.density

                    val summaryTv = TextView(this@MainActivity).apply {
                        text = "✅ Simulated ${res.my6OptimallyMoved.size} user Pokémon (optimal movesets vs opponent 6) against ${res.topOpponentTrios.size} top-viability opponent trios (${res.elapsedMs}ms)."
                        textSize = 10.5f
                        setTextColor(0xFF34D399.toInt())
                        setPadding(0, 0, 0, (6 * density).toInt())
                    }
                    layoutPick3Results?.addView(summaryTv)

                    fun addRecGroup(groupTitle: String, titleColor: Int, recs: List<OverlayService.Companion.Show6Pick3LineupRec>) {
                        val hdr = TextView(this@MainActivity).apply {
                            text = groupTitle
                            textSize = 11.5f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                            setTextColor(titleColor)
                            setPadding(0, (6 * density).toInt(), 0, (3 * density).toInt())
                        }
                        layoutPick3Results?.addView(hdr)
                        for (rec in recs.take(3)) {
                            val card = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.VERTICAL
                                setBackgroundColor(0xFF1E293B.toInt())
                                val pad = (8 * density).toInt()
                                setPadding(pad, pad, pad, pad)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    bottomMargin = (5 * density).toInt()
                                }
                            }
                            val topRow = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.HORIZONTAL
                                gravity = android.view.Gravity.CENTER_VERTICAL
                            }
                            val titleTv = TextView(this@MainActivity).apply {
                                text = "#${rec.rank} ${rec.archetype} • Viability BR ${rec.viabilityWeightedBr} • Win ${rec.expectedWinRatePct}%"
                                textSize = 11f
                                setTypeface(typeface, android.graphics.Typeface.BOLD)
                                setTextColor(0xFFF8FAFC.toInt())
                                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val equipBtn = Button(this@MainActivity).apply {
                                text = "⚡ Equip Trio"
                                textSize = 9.5f
                                minWidth = 0
                                minimumWidth = 0
                                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                                setTextColor(0xFFFFFFFF.toInt())
                                setOnClickListener {
                                    equipShow6LineupToOverlay(rec, lg)
                                }
                            }
                            topRow.addView(titleTv)
                            topRow.addView(equipBtn)
                            card.addView(topRow)

                            val leadPlus = OverlayService.resolveMegaPlusMoveStatic(rec.lead.name, lg, prefs)?.let { " + $it [Mega4]" } ?: ""
                            val swapPlus = OverlayService.resolveMegaPlusMoveStatic(rec.safeSwap.name, lg, prefs)?.let { " + $it [Mega4]" } ?: ""
                            val closerPlus = OverlayService.resolveMegaPlusMoveStatic(rec.closer.name, lg, prefs)?.let { " + $it [Mega4]" } ?: ""
                            val slotsTv = TextView(this@MainActivity).apply {
                                text = "• Lead: ${rec.lead.name} (${rec.lead.fastMove} + ${rec.lead.chargedMove1}/${rec.lead.chargedMove2}$leadPlus) [BR ${rec.leadBr}]\n" +
                                    "• Swap: ${rec.safeSwap.name} (${rec.safeSwap.fastMove} + ${rec.safeSwap.chargedMove1}/${rec.safeSwap.chargedMove2}$swapPlus) [BR ${rec.swapBr}]\n" +
                                    "• Closer: ${rec.closer.name} (${rec.closer.fastMove} + ${rec.closer.chargedMove1}/${rec.closer.chargedMove2}$closerPlus) [BR ${rec.closerBr}]\n" +
                                    "• ${rec.synergyNote}"
                                textSize = 10f
                                setTextColor(0xFFCBD5E1.toInt())
                            }
                            card.addView(slotsTv)
                            layoutPick3Results?.addView(card)
                        }
                    }

                    addRecGroup("🛡️ Your Top 3 ABB Lineups (Bait Backline):", 0xFFFBBF24.toInt(), res.top3Abb)
                    addRecGroup("⚖️ Your Top 3 ABC Lineups (Balanced Triad):", 0xFF38BDF8.toInt(), res.top3Abc)
                    addRecGroup("☯️ Your Top 3 Duo-Core + Pivot Lineups:", 0xFF34D399.toInt(), res.top3Duo)

                    val oppHdr = TextView(this@MainActivity).apply {
                        text = "⚔️ MOST LIKELY OPPONENT PICK-3 TEAMS BY ARCHETYPE"
                        textSize = 12f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        setTextColor(0xFFFDA4AF.toInt())
                        setPadding(0, (12 * density).toInt(), 0, (4 * density).toInt())
                    }
                    layoutPick3Results?.addView(oppHdr)

                    fun addOppArchetypeGroup(groupTitle: String, titleColor: Int, trios: List<OverlayService.Companion.Show6OpponentViableLineup>) {
                        if (trios.isEmpty()) return
                        val hdr = TextView(this@MainActivity).apply {
                            text = groupTitle
                            textSize = 11f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                            setTextColor(titleColor)
                            setPadding(0, (6 * density).toInt(), 0, (3 * density).toInt())
                        }
                        layoutPick3Results?.addView(hdr)
                        trios.take(3).forEachIndexed { idx, oppTrio ->
                            val card = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.VERTICAL
                                setBackgroundColor(0xFF271524.toInt())
                                val pad = (8 * density).toInt()
                                setPadding(pad, pad, pad, pad)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.MATCH_PARENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    bottomMargin = (5 * density).toInt()
                                }
                            }
                            val topRow = LinearLayout(this@MainActivity).apply {
                                orientation = LinearLayout.HORIZONTAL
                                gravity = android.view.Gravity.CENTER_VERTICAL
                            }
                            val pct = oppTrio.normalizedWeightPct.toInt().coerceAtLeast(1)
                            val titleTv = TextView(this@MainActivity).apply {
                                text = "⚔️ Opp #${idx + 1} ${oppTrio.archetype} • Viability BR ${oppTrio.viabilityScore} • Weight ~${pct}%"
                                textSize = 10.5f
                                setTypeface(typeface, android.graphics.Typeface.BOLD)
                                setTextColor(0xFFFECDD3.toInt())
                                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val resolvedTrioSlots = oppTrio.pokemonNames.take(3).map { monName ->
                                val resolved = OverlayService.resolveRecommendedMovesForSpecies(monName, lg)
                                val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, lg) else null
                                PokemonSlot(
                                    name = monName,
                                    cp = scaled?.defaultCp ?: 1500,
                                    fastMove = scaled?.defaultFastMove ?: "Tackle",
                                    chargedMove1 = scaled?.chargedMove1 ?: "Struggle",
                                    chargedMove2 = scaled?.chargedMove2 ?: "Return",
                                    ivs = scaled?.defaultIvsGl
                                )
                            }
                            val cloneOppTrioBtn = Button(this@MainActivity).apply {
                                text = "📋 Clone Trio"
                                textSize = 9f
                                minWidth = 0
                                minimumWidth = 0
                                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFBE123C.toInt())
                                setTextColor(0xFFFFFFFF.toInt())
                                setOnClickListener {
                                    if (resolvedTrioSlots.size < 3) return@setOnClickListener
                                    val newPreset = TeamPreset(
                                        id = UUID.randomUUID().toString(),
                                        name = "Opp ${oppTrio.archetype}: ${resolvedTrioSlots.joinToString("/") { it.name }}",
                                        league = lg,
                                        pokemon = resolvedTrioSlots,
                                        isSelected = true,
                                        archetype = oppTrio.archetype,
                                        machineAggBr = oppTrio.viabilityScore
                                    )
                                    val existing = loadPresets().toMutableList()
                                    existing.add(0, newPreset)
                                    savePresets(existing)
                                    setSelectedPreset(newPreset.id)
                                    Toast.makeText(
                                        this@MainActivity,
                                        "📋 Cloned Opponent Trio (${resolvedTrioSlots.joinToString("/") { it.name }}) to Your Show 6 Trios!",
                                        Toast.LENGTH_LONG
                                    ).show()
                                }
                            }
                            topRow.addView(titleTv)
                            topRow.addView(cloneOppTrioBtn)
                            card.addView(topRow)

                            val lead = resolvedTrioSlots.getOrNull(0)
                            val swap = resolvedTrioSlots.getOrNull(1)
                            val closer = resolvedTrioSlots.getOrNull(2)
                            val leadPlus = lead?.name?.let { OverlayService.resolveMegaPlusMoveStatic(it, lg, prefs) }?.let { " + $it [Mega4]" } ?: ""
                            val swapPlus = swap?.name?.let { OverlayService.resolveMegaPlusMoveStatic(it, lg, prefs) }?.let { " + $it [Mega4]" } ?: ""
                            val closerPlus = closer?.name?.let { OverlayService.resolveMegaPlusMoveStatic(it, lg, prefs) }?.let { " + $it [Mega4]" } ?: ""
                            val slotsTv = TextView(this@MainActivity).apply {
                                text = "• Lead: ${lead?.name ?: "-"} (${lead?.fastMove ?: ""} + ${lead?.chargedMove1 ?: ""}/${lead?.chargedMove2 ?: ""}$leadPlus)\n" +
                                    "• Swap: ${swap?.name ?: "-"} (${swap?.fastMove ?: ""} + ${swap?.chargedMove1 ?: ""}/${swap?.chargedMove2 ?: ""}$swapPlus)\n" +
                                    "• Closer: ${closer?.name ?: "-"} (${closer?.fastMove ?: ""} + ${closer?.chargedMove1 ?: ""}/${closer?.chargedMove2 ?: ""}$closerPlus)"
                                textSize = 9.5f
                                setTextColor(0xFFFDA4AF.toInt())
                            }
                            card.addView(slotsTv)
                            layoutPick3Results?.addView(card)
                        }
                    }

                    addOppArchetypeGroup("⚔️ Opponent Top 3 ABB Lineups:", 0xFFFBBF24.toInt(), res.oppTop3AbbTeams)
                    addOppArchetypeGroup("⚔️ Opponent Top 3 ABC Lineups:", 0xFF38BDF8.toInt(), res.oppTop3AbcTeams)
                    addOppArchetypeGroup("⚔️ Opponent Top 3 Duo-Core Lineups:", 0xFF34D399.toInt(), res.oppTop3DuoTeams)
                }
            }
        }

        // Builder 2: Blind Show 6 Meta Roster Optimizer with Per-League Persisted Whitelist & Banlist
        val btnClearLocks = findViewById<Button>(R.id.btn_clear_show6_locks)
        val btnInputText = findViewById<Button>(R.id.btn_show6_input_text)
        val btnInputChips = findViewById<Button>(R.id.btn_show6_input_chips)
        val tvPersistedStatus = findViewById<TextView>(R.id.tv_show6_league_persisted_status)
        val btnFilterOpen = findViewById<Button>(R.id.btn_show6_filter_open)
        val btnFilterWhitelist = findViewById<Button>(R.id.btn_show6_filter_whitelist)
        val btnFilterBanlist = findViewById<Button>(R.id.btn_show6_filter_banlist)
        val btnClearActiveList = findViewById<Button>(R.id.btn_clear_show6_active_list)
        val btnClearBothLists = findViewById<Button>(R.id.btn_clear_show6_both_lists)
        val editFilterText = findViewById<EditText>(R.id.edit_show6_filter_text)
        val layoutFilterChipBox = findViewById<LinearLayout>(R.id.layout_show6_filter_chip_box)
        val editFilterChipInput = findViewById<AutoCompleteTextView>(R.id.edit_show6_filter_chip_input)
        val btnAddFilterChip = findViewById<Button>(R.id.btn_add_show6_filter_chip)
        val layoutFilterChips = findViewById<LinearLayout>(R.id.layout_show6_filter_chips)
        val tvHistWeightLabel = findViewById<TextView>(R.id.tv_show6_hist_weight_label)
        val btnPullHistLogs = findViewById<Button>(R.id.btn_pull_show6_hist_logs)
        val seekHistWeight = findViewById<SeekBar>(R.id.seek_show6_hist_weight)
        val editHistText = findViewById<EditText>(R.id.edit_show6_hist_text)
        val btnRunBlind6 = findViewById<Button>(R.id.btn_run_show6_blind)
        val layoutBlindResults = findViewById<LinearLayout>(R.id.layout_show6_blind_results)

        var blindInputMethod = "chips" // "text" or "chips"
        var blindFilterMode = "open" // "open", "whitelist", "banlist"
        var isSyncingFilterText = false

        editFilterChipInput?.setAdapter(PokemonAutocompleteAdapter(blindLeagueProvider))
        editFilterChipInput?.threshold = 1

        fun getActiveLeagueList(mode: String, league: String): List<String> {
            return when (mode) {
                "whitelist" -> loadShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_WHITELIST_BY_LEAGUE)[league].orEmpty()
                "banlist" -> loadShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_BANLIST_BY_LEAGUE)[league].orEmpty()
                else -> emptyList()
            }
        }

        fun setActiveLeagueList(mode: String, league: String, items: List<String>) {
            val cleaned = items.map { it.trim() }.filter { it.isNotEmpty() }.distinct()
            if (mode == "whitelist") {
                val map = loadShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_WHITELIST_BY_LEAGUE)
                map[league] = cleaned
                saveShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_WHITELIST_BY_LEAGUE, map)
            } else if (mode == "banlist") {
                val map = loadShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_BANLIST_BY_LEAGUE)
                map[league] = cleaned
                saveShow6LeagueMap(OverlayService.PREFS_KEY_SHOW6_BANLIST_BY_LEAGUE, map)
            }
        }

        fun refreshBlindFilterUi() {
            val lg = blindLeagueProvider()
            val wl = getActiveLeagueList("whitelist", lg)
            val bl = getActiveLeagueList("banlist", lg)
            tvPersistedStatus?.text = "🛡️ Persisted for $lg: ${wl.size} Whitelisted • ${bl.size} Banned"
            btnFilterWhitelist?.text = "Whitelist (${wl.size})"
            btnFilterBanlist?.text = "Banlist (${bl.size})"

            btnFilterOpen?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (blindFilterMode == "open") 0xFF7C3AED.toInt() else 0xFF334155.toInt()
            )
            btnFilterWhitelist?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (blindFilterMode == "whitelist") 0xFF7C3AED.toInt() else 0xFF334155.toInt()
            )
            btnFilterBanlist?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (blindFilterMode == "banlist") 0xFF7C3AED.toInt() else 0xFF334155.toInt()
            )

            btnInputText?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (blindInputMethod == "text") 0xFF7C3AED.toInt() else 0xFF334155.toInt()
            )
            btnInputChips?.backgroundTintList = android.content.res.ColorStateList.valueOf(
                if (blindInputMethod == "chips") 0xFF7C3AED.toInt() else 0xFF334155.toInt()
            )

            val showListControls = (blindFilterMode != "open")
            editFilterText?.visibility = if (showListControls && blindInputMethod == "text") android.view.View.VISIBLE else android.view.View.GONE
            layoutFilterChipBox?.visibility = if (showListControls && blindInputMethod == "chips") android.view.View.VISIBLE else android.view.View.GONE

            val currentItems = getActiveLeagueList(blindFilterMode, lg)
            isSyncingFilterText = true
            editFilterText?.setText(currentItems.joinToString(", "))
            isSyncingFilterText = false

            layoutFilterChips?.removeAllViews()
            if (showListControls && blindInputMethod == "chips") {
                val density = resources.displayMetrics.density
                for (mon in currentItems) {
                    val chipBtn = Button(this).apply {
                        text = "$mon  ✕"
                        textSize = 9.5f
                        minWidth = 0
                        minimumWidth = 0
                        backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF1E293B.toInt())
                        setTextColor(0xFFE2E8F0.toInt())
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            (28 * density).toInt()
                        ).apply {
                            bottomMargin = (3 * density).toInt()
                        }
                        setOnClickListener {
                            val next = getActiveLeagueList(blindFilterMode, lg).filterNot { it.equals(mon, ignoreCase = true) }
                            setActiveLeagueList(blindFilterMode, lg, next)
                            refreshBlindFilterUi()
                        }
                    }
                    layoutFilterChips?.addView(chipBtn)
                }
            }
        }

        editFilterText?.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: android.text.Editable?) {
                if (isSyncingFilterText || blindFilterMode == "open") return
                val lg = blindLeagueProvider()
                val items = s?.toString().orEmpty().split(Regex("[,\\n]+")).map { it.trim() }.filter { it.isNotEmpty() }
                setActiveLeagueList(blindFilterMode, lg, items)
                val wl = getActiveLeagueList("whitelist", lg)
                val bl = getActiveLeagueList("banlist", lg)
                tvPersistedStatus?.text = "🛡️ Persisted for $lg: ${wl.size} Whitelisted • ${bl.size} Banned"
                btnFilterWhitelist?.text = "Whitelist (${wl.size})"
                btnFilterBanlist?.text = "Banlist (${bl.size})"
            }
        })

        btnAddFilterChip?.setOnClickListener {
            if (blindFilterMode == "open") {
                blindFilterMode = "banlist"
            }
            val lg = blindLeagueProvider()
            val raw = editFilterChipInput?.text?.toString()?.trim().orEmpty()
            if (raw.isNotEmpty()) {
                val next = (getActiveLeagueList(blindFilterMode, lg) + raw).distinct()
                setActiveLeagueList(blindFilterMode, lg, next)
                editFilterChipInput?.setText("", false)
                refreshBlindFilterUi()
            }
        }

        btnFilterOpen?.setOnClickListener {
            blindFilterMode = "open"
            refreshBlindFilterUi()
        }
        btnFilterWhitelist?.setOnClickListener {
            blindFilterMode = "whitelist"
            refreshBlindFilterUi()
        }
        btnFilterBanlist?.setOnClickListener {
            blindFilterMode = "banlist"
            refreshBlindFilterUi()
        }
        btnInputText?.setOnClickListener {
            blindInputMethod = "text"
            refreshBlindFilterUi()
        }
        btnInputChips?.setOnClickListener {
            blindInputMethod = "chips"
            refreshBlindFilterUi()
        }

        btnClearActiveList?.setOnClickListener {
            val lg = blindLeagueProvider()
            val targetMode = if (blindFilterMode == "whitelist") "whitelist" else "banlist"
            setActiveLeagueList(targetMode, lg, emptyList())
            refreshBlindFilterUi()
            Toast.makeText(this, "Cleared persisted ${targetMode.uppercase()} for $lg", Toast.LENGTH_SHORT).show()
        }

        btnClearBothLists?.setOnClickListener {
            val lg = blindLeagueProvider()
            setActiveLeagueList("whitelist", lg, emptyList())
            setActiveLeagueList("banlist", lg, emptyList())
            refreshBlindFilterUi()
            Toast.makeText(this, "Cleared both Whitelist & Banlist for $lg", Toast.LENGTH_SHORT).show()
        }

        spinnerBlindLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                refreshBlindFilterUi()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        btnClearLocks?.setOnClickListener {
            lockInputs.forEach { it?.setText("", false) }
        }

        seekHistWeight?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val histPct = progress.coerceIn(0, 100)
                val metaPct = 100 - histPct
                tvHistWeightLabel?.text = "📜 Meta $metaPct% vs. Historical $histPct%"
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        btnPullHistLogs?.setOnClickListener {
            val lg = blindLeagueProvider()
            val logs = loadBattleLogs().filter { it.league.equals(lg, ignoreCase = true) }
            val opps = logs.flatMap { it.opponents }.map { it.trim() }.filter { it.isNotEmpty() && !it.equals("Unknown", ignoreCase = true) }
            if (opps.isEmpty()) {
                Toast.makeText(this, "No logged opponents found for $lg in current mode logs", Toast.LENGTH_SHORT).show()
            } else {
                editHistText?.setText(opps.joinToString(", "))
                Toast.makeText(this, "Imported ${opps.size} opponent sightings from $lg Battle Logs!", Toast.LENGTH_SHORT).show()
            }
        }

        btnRunBlind6?.setOnClickListener {
            val lg = blindLeagueProvider()
            val locks = lockInputs.mapNotNull { it?.text?.toString()?.trim() }.filter { it.isNotEmpty() }
            val filterList = getActiveLeagueList(blindFilterMode, lg)
            val histList = editHistText?.text?.toString().orEmpty()
                .split(Regex("[,\\n]+"))
                .map { it.trim() }
                .filter { it.isNotEmpty() }
            val histWeight = seekHistWeight?.progress ?: 35

            btnRunBlind6.isEnabled = false
            btnRunBlind6.text = "⏳ Building Synergistic 6-Pokémon Roster..."

            lifecycleScope.launch(Dispatchers.Default) {
                val res = OverlayService.generateBlindShow6RosterStatic(
                    league = lg,
                    lockedCoreNames = locks,
                    filterMode = blindFilterMode,
                    filterPokemonNames = filterList,
                    expectedHistoricalNames = histList,
                    historicalWeightPct = histWeight
                )
                withContext(Dispatchers.Main) {
                    btnRunBlind6.isEnabled = true
                    btnRunBlind6.text = "✨ Build Optimal Blind Show 6 Roster"
                    layoutBlindResults?.removeAllViews()
                    val density = resources.displayMetrics.density

                    val card = LinearLayout(this@MainActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        setBackgroundColor(0xFF1E293B.toInt())
                        val pad = (10 * density).toInt()
                        setPadding(pad, pad, pad, pad)
                    }

                    val headerTv = TextView(this@MainActivity).apply {
                        text = "🏆 Recommended Show 6 Roster • Coverage ${res.coveragePct}% (${res.metaPoolSize} Eligible Meta • ${res.elapsedMs}ms)"
                        textSize = 11.5f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        setTextColor(0xFF34D399.toInt())
                    }
                    card.addView(headerTv)

                    val rosterStr = res.roster6.mapIndexed { idx, slot ->
                        val plusMove = OverlayService.resolveMegaPlusMoveStatic(slot.pokemon.name, lg, prefs)
                        val plusTag = if (plusMove != null) " + $plusMove [Mega4]" else ""
                        "${idx + 1}. ${slot.pokemon.name} [${slot.roleLabel} • Score ${slot.metaScore}] (${slot.pokemon.fastMove} + ${slot.pokemon.chargedMove1}/${slot.pokemon.chargedMove2}$plusTag) — Covers: ${slot.coveredThreats.joinToString(", ")}"
                    }.joinToString("\n")

                    val rosterTv = TextView(this@MainActivity).apply {
                        text = rosterStr
                        textSize = 10.5f
                        setTextColor(0xFFF8FAFC.toInt())
                        setPadding(0, (4 * density).toInt(), 0, (6 * density).toInt())
                    }
                    card.addView(rosterTv)

                    val useBtn = Button(this@MainActivity).apply {
                        text = "💾 Save & Load into My 6 (6v6 Pick-3)"
                        textSize = 10.5f
                        backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                        setTextColor(0xFF0F172A.toInt())
                        setOnClickListener {
                            val mons = res.roster6.map { it.pokemon.name }
                            val current = loadShow6RostersOf6().toMutableList()
                            current.add(
                                0,
                                OverlayService.Companion.Show6RosterPreset(
                                    name = "${lg.split(" ").first()} Blind Show 6 (${res.coveragePct}%)",
                                    league = lg,
                                    pokemon = mons
                                )
                            )
                            saveShow6RostersOf6(current)
                            renderShow6RostersOf6List()
                            val lgIdx = leagues.indexOfFirst { it.equals(lg, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
                            spinnerPick3League.setSelection(lgIdx)
                            myInputs.forEachIndexed { idx, edit ->
                                edit?.setText(mons.getOrElse(idx) { "" }, false)
                            }
                            switchShow6SubTab("pick3")
                            Toast.makeText(this@MainActivity, "Saved & loaded into Your 6!", Toast.LENGTH_SHORT).show()
                        }
                    }
                    card.addView(useBtn)
                    layoutBlindResults?.addView(card)
                }
            }
        }

        refreshBlindFilterUi()
    }

    private fun runAntiMetaTeamBuilderGeneration() {
        if (!::spinnerAntiMetaLeague.isInitialized) return
        val lg = spinnerAntiMetaLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
        val tier = if (::prefs.isInitialized) OverlayService.getEffectiveReplayTierStatic(prefs) else "free"
        val normLg = lg.trim().uppercase()
        val isGlOrMl = normLg == "GREAT LEAGUE" || normLg == "MASTER LEAGUE"
        val isCore3 = isGlOrMl || normLg == "ULTRA LEAGUE"
        if (tier == "free" && !isGlOrMl) {
            AlertDialog.Builder(this)
                .setTitle("🔒 Unlock $lg in Anti-Meta Generator")
                .setMessage(
                    "Free tier includes Open Great League & Master League (1 team per archetype).\n\n" +
                        "• Lifetime Supporter ($2 one-time): Unlocks 🛡️ Attack Incoming! Shield Decision Overlay + Open Ultra League + 2 teams per archetype + Unlimited Lifetime Battle Log History!\n" +
                        "• Legend Pro ($3 Intro / $6 Season Pass): Unlocks ALL Limited/Mega/Specialty Cups, Top 5 teams per archetype, ⚡ Alternate Moveset Role Synthesis (+BR Deltas), and 50 Cloud Replay Vault slots!"
                )
                .setPositiveButton("💳 Unlock via Stripe") { _, _ ->
                    val url = if (normLg == "ULTRA LEAGUE") OverlayService.STRIPE_URL_SUPPORTER_3 else OverlayService.STRIPE_URL_PRO_INTRO_5
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                }
                .setNeutralButton("☕ Buy Me a Coffee") { _, _ ->
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(DONATION_URL)))
                }
                .setNegativeButton("Cancel", null)
                .show()
            return
        }
        if (tier == "supporter" && !isCore3) {
            AlertDialog.Builder(this)
                .setTitle("🏆 Legend Pro Required for $lg")
                .setMessage(
                    "Lifetime Supporter includes Core 3 Open Leagues (Great, Ultra & Master League).\n\n" +
                        "Upgrade to Legend Pro ($3 First-Season Intro / $6 Season Pass) to unlock all Limited, Retro, Mega & Battle Frontier Cups, Top 5 teams per archetype, and ⚡ Alternate Moveset Role Synthesis!"
                )
                .setPositiveButton("💳 Upgrade on Stripe") { _, _ ->
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(OverlayService.STRIPE_URL_PRO_INTRO_5)))
                }
                .setNeutralButton("☕ Buy Me a Coffee") { _, _ ->
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(OverlayService.BMC_URL_PRO_SEASON_10)))
                }
                .setNegativeButton("Cancel", null)
                .show()
            return
        }
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

        val maxPerArch = when (tier) {
            "pro", "vip" -> 5
            "supporter" -> 2
            else -> 1
        }
        val allowAlt = tier == "pro" || tier == "vip"
        btnGenerateAntiMetaTeams.isEnabled = false
        btnGenerateAntiMetaTeams.text = "⏳ Generating Best $maxPerArch ABB, $maxPerArch ABC & $maxPerArch Duo-Core Teams..."
        textAntiMetaStatus.text = "Simulating $lg Anti-Meta lineups (${if (featuredList.isEmpty()) "0 Featured" else featuredList.joinToString(" + ")})..."

        antiMetaJob?.cancel()
        antiMetaJob = lifecycleScope.launch(Dispatchers.Default) {
            val result = OverlayService.generateAntiMetaTeamOptionsStatic(
                league = lg,
                featuredPokemonNames = featuredList,
                seasonLogs = seasonLogs,
                maxTeamsPerArchetype = maxPerArch,
                allowAltMovesets = allowAlt
            )
            withContext(Dispatchers.Main) {
                btnGenerateAntiMetaTeams.isEnabled = true
                btnGenerateAntiMetaTeams.text = "⚡ Generate Best $maxPerArch ABB, $maxPerArch ABC & $maxPerArch Duo-Core Teams"
                val featLabel = if (result.featuredPokemon.isEmpty()) {
                    "0 Featured Picks (Full Meta)"
                } else {
                    "Featuring ${result.featuredPokemon.joinToString(" + ")}"
                }
                val tierTag = when (tier) {
                    "vip" -> "👑 VIP"
                    "pro" -> "🏆 PRO"
                    "supporter" -> "🏅 SUPPORTER (Top 2/Arch • Std Moves)"
                    else -> "🆓 FREE (Top 1/Arch • GL/ML • Std Moves)"
                }
                textAntiMetaStatus.text =
                    "✅ [$tierTag] Generated Top ${result.top5AbbTeams.size} ABB, Top ${result.top5AbcTeams.size} ABC & Top ${result.top5DuoTeams.size} Duo-Core Teams ($featLabel • ${result.candidatesEvaluated} trios + ${result.movesetCombosSimulated} alt moveset sims in ${result.elapsedMs}ms)\n• ${result.metaSummaryLabel} • Default Name: \"$defaultNamePreview\""
                renderAntiMetaBuilderResults(result)
            }
        }
    }

    private fun renderAntiMetaBuilderResults(result: OverlayService.Companion.AntiMetaTeamBuilderResult) {
        layoutAntiMetaResults.removeAllViews()
        val density = resources.displayMetrics.density
        val activeTheme = getActiveAppTheme()
        val defaultTeamName = OverlayService.formatAntiMetaDefaultTeamNameStatic(result.league)
        val tier = if (::prefs.isInitialized) OverlayService.getEffectiveReplayTierStatic(prefs) else "free"
        val isProOrVip = tier == "pro" || tier == "vip"

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
                if (isProOrVip) {
                    "  •  <font color='#c4b5fd'><b>[⚡ $altCount Alt Moveset${if (altCount > 1) "s" else ""}]</b></font>"
                } else {
                    "  •  <font color='#fbbf24'><b>[🔒 $altCount Pro Alt Moveset${if (altCount > 1) "s" else ""} Available]</b></font>"
                }
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
                    if (isProOrVip) {
                        " <font color='#c4b5fd'><b>[⚡ Alt Moveset$gainPart]</b></font>"
                    } else {
                        " <font color='#fbbf24'><b>[🔒 ⚡ Pro Alt Moveset$gainPart Available]</b></font>"
                    }
                } else {
                    ""
                }
                val movesColor = if (isAlt) "#ddd6fe" else "#cbd5e1"
                val stdNote = if (isAlt && altInfo != null) {
                    " <font color='#94a3b8'><i>(Std: ${altInfo.standardFastMove} + ${altInfo.standardCharged1}/${altInfo.standardCharged2})</i></font>"
                } else {
                    ""
                }
                val plusMove = OverlayService.resolveMegaPlusMoveStatic(m.name, result.league, prefs)
                val plusMoveStr = if (plusMove != null) " / <font color='#f472b6'>$plusMove [Mega4]</font>" else ""
                "• <b>[$rLabel · $brStr]</b> ${m.name}$featBadge$altBadge (CP ${m.cp}) — <font color='$movesColor'><b>${m.fastMove} + ${m.chargedMove1} / ${m.chargedMove2}$plusMoveStr</b></font>$stdNote"
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

        if (!isProOrVip) {
            val upsellCard = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E1B4B.toInt())
                val pad = (12 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = (8 * density).toInt()
                    bottomMargin = (8 * density).toInt()
                }
            }
            val upsellTitle = TextView(this).apply {
                text = "🏆 Unlock Full Anti-Meta Generator & ⚡ Alt Moveset Synthesis"
                textSize = 12.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(0xFFFBBF24.toInt())
            }
            val upsellBody = TextView(this).apply {
                text = "• Lifetime Supporter ($2 one-time): Unlocks 🛡️ Attack Incoming! Shield Decision Overlay + Ultra League + Top 2 teams per archetype + Unlimited Lifetime Battle Log History!\n" +
                    "• Legend Pro ($3 Day 15+ Intro / $6 Season Pass): Unlocks ALL Limited/Mega Cups, Top 5 teams per archetype (15+ teams), ⚡ Alternate Moveset Role Synthesis (+BR Deltas), Nemesis Builder, and 50 Cloud Replay Vault slots!"
                textSize = 10.5f
                setTextColor(0xFFE2E8F0.toInt())
                setPadding(0, (4 * density).toInt(), 0, (8 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            val btnStripe = Button(this).apply {
                text = "💳 Unlock via Stripe"
                textSize = 10.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF6366F1.toInt())
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginEnd = (6 * density).toInt()
                }
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(OverlayService.STRIPE_URL_PRO_INTRO_5)))
                }
            }
            val btnBmc = Button(this).apply {
                text = "☕ Buy Me a Coffee"
                textSize = 10.5f
                isAllCaps = false
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFFD97706.toInt())
                setTextColor(0xFF0F172A.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                setOnClickListener {
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(DONATION_URL)))
                }
            }
            btnRow.addView(btnStripe)
            btnRow.addView(btnBmc)
            upsellCard.addView(upsellTitle)
            upsellCard.addView(upsellBody)
            upsellCard.addView(btnRow)
            layoutAntiMetaResults.addView(upsellCard)
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

        val baseLeagues = if (isShow6CombatMode()) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }
        val leagues = if (existingPreset != null && baseLeagues.none { it.equals(existingPreset.league, ignoreCase = true) }) {
            listOf(existingPreset.league) + baseLeagues
        } else {
            baseLeagues
        }
        spinnerLeague.adapter = createThemedSpinnerAdapter(leagues)

        val currentLeagueProvider = {
            spinnerLeague.selectedItem?.toString() ?: leagues.first()
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

        val layoutP1PlusLevel = dialogView.findViewById<LinearLayout>(R.id.layout_p1_plus_level)
        val textP1PlusMoveLabel = dialogView.findViewById<TextView>(R.id.text_p1_plus_move_label)
        val btnP1PlusLvBtns = listOf(
            dialogView.findViewById<TextView>(R.id.btn_p1_plus_lv0),
            dialogView.findViewById<TextView>(R.id.btn_p1_plus_lv1),
            dialogView.findViewById<TextView>(R.id.btn_p1_plus_lv2),
            dialogView.findViewById<TextView>(R.id.btn_p1_plus_lv3),
            dialogView.findViewById<TextView>(R.id.btn_p1_plus_lv4)
        )
        val layoutP2PlusLevel = dialogView.findViewById<LinearLayout>(R.id.layout_p2_plus_level)
        val textP2PlusMoveLabel = dialogView.findViewById<TextView>(R.id.text_p2_plus_move_label)
        val btnP2PlusLvBtns = listOf(
            dialogView.findViewById<TextView>(R.id.btn_p2_plus_lv0),
            dialogView.findViewById<TextView>(R.id.btn_p2_plus_lv1),
            dialogView.findViewById<TextView>(R.id.btn_p2_plus_lv2),
            dialogView.findViewById<TextView>(R.id.btn_p2_plus_lv3),
            dialogView.findViewById<TextView>(R.id.btn_p2_plus_lv4)
        )
        val layoutP3PlusLevel = dialogView.findViewById<LinearLayout>(R.id.layout_p3_plus_level)
        val textP3PlusMoveLabel = dialogView.findViewById<TextView>(R.id.text_p3_plus_move_label)
        val btnP3PlusLvBtns = listOf(
            dialogView.findViewById<TextView>(R.id.btn_p3_plus_lv0),
            dialogView.findViewById<TextView>(R.id.btn_p3_plus_lv1),
            dialogView.findViewById<TextView>(R.id.btn_p3_plus_lv2),
            dialogView.findViewById<TextView>(R.id.btn_p3_plus_lv3),
            dialogView.findViewById<TextView>(R.id.btn_p3_plus_lv4)
        )

        var p1PlusLevel = (existingPreset?.pokemon?.getOrNull(0)?.plusMoveLevel ?: 4).coerceIn(0, 4)
        var p2PlusLevel = (existingPreset?.pokemon?.getOrNull(1)?.plusMoveLevel ?: 4).coerceIn(0, 4)
        var p3PlusLevel = (existingPreset?.pokemon?.getOrNull(2)?.plusMoveLevel ?: 4).coerceIn(0, 4)

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
            fallbackSlot: PokemonSlot,
            plusMoveLevel: Int = 4
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
                ivs = enteredIvs,
                plusMoveLevel = plusMoveLevel.coerceIn(0, 4)
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
                p1PlusLevel = (it.plusMoveLevel ?: 4).coerceIn(0, 4)
            }
            slots.getOrNull(1)?.let {
                editP2.setText(it.name, false)
                editP2Cp.setText(it.cp.toString())
                editP2Ivs.setText(it.ivs ?: "")
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
                p2PlusLevel = (it.plusMoveLevel ?: 4).coerceIn(0, 4)
            }
            slots.getOrNull(2)?.let {
                editP3.setText(it.name, false)
                editP3Cp.setText(it.cp.toString())
                editP3Ivs.setText(it.ivs ?: "")
                editP3Fast.setText(it.fastMove)
                editP3C1.setText(it.chargedMove1)
                editP3C2.setText(it.chargedMove2)
                p3PlusLevel = (it.plusMoveLevel ?: 4).coerceIn(0, 4)
            }
        }

        fun updateSlotPlusLevelRowUi(
            layoutRow: LinearLayout?,
            labelTv: TextView?,
            lvBtns: List<TextView?>,
            monName: String,
            league: String,
            curLvl: Int
        ) {
            val plusMove = OverlayService.resolveMegaPlusMoveStatic(monName, league, prefs)
            if (plusMove == null) {
                layoutRow?.visibility = android.view.View.GONE
                return
            }
            layoutRow?.visibility = android.view.View.VISIBLE
            val mStats = OverlayService.resolveChargedMoveStatsStatic(plusMove, "normal")
            val basePwr = (mStats.power / 1.30).roundToInt()
            val mult = OverlayService.getPlusMovePowerMultiplierStatic(curLvl)
            val effPwr = (basePwr * mult).roundToInt()
            labelTv?.text = if (curLvl <= 0) {
                "🔥 +3rd Move: $plusMove • Off (Not Unlocked — Excluded from Sim & HUD)"
            } else {
                "🔥 +3rd Move: $plusMove • Lv$curLvl (${effPwr}p / ${String.format(java.util.Locale.US, "%.1f", mult)}x • ${mStats.energyCost}E) • Opp = Lv4"
            }
            labelTv?.setTextColor(if (curLvl <= 0) 0xFF94A3B8.toInt() else 0xFFC084FC.toInt())
            lvBtns.forEachIndexed { idx, btn ->
                val isSelected = idx == curLvl
                val bgColor = when {
                    !isSelected -> 0xFF0F172A.toInt()
                    idx == 0 -> 0xFFBE123C.toInt()
                    else -> 0xFF6D28D9.toInt()
                }
                val txtColor = if (isSelected) 0xFFF5F3FF.toInt() else 0xFF94A3B8.toInt()
                btn?.setBackgroundColor(bgColor)
                btn?.setTextColor(txtColor)
            }
        }

        val preloadedDialogLogs = loadBattleLogs()

        fun refreshDialogTeamEvaluation(autoReorder: Boolean): OverlayService.Companion.TeamArchetypeEvaluationResult {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val eval = OverlayService.evaluateOrAutoOrderTeamStatic(
                slots = listOf(
                    OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs, s1.plusMoveLevel),
                    OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs, s2.plusMoveLevel),
                    OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs, s3.plusMoveLevel)
                ),
                league = lg,
                seasonLogs = seasonLogs,
                autoReorder = autoReorder,
                manualArchetypeOverride = dialogManualArchetypeOverride
            )
            if (autoReorder) {
                val orderedSlots = eval.orderedSlots.map {
                    PokemonSlot(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs, it.plusMoveLevel)
                }
                applySlotsToDialogInputs(orderedSlots)
            }

            updateStyleModeButtonsUi()
            updateSlotPlusLevelRowUi(layoutP1PlusLevel, textP1PlusMoveLabel, btnP1PlusLvBtns, s1.name, lg, p1PlusLevel)
            updateSlotPlusLevelRowUi(layoutP2PlusLevel, textP2PlusMoveLabel, btnP2PlusLvBtns, s2.name, lg, p2PlusLevel)
            updateSlotPlusLevelRowUi(layoutP3PlusLevel, textP3PlusMoveLabel, btnP3PlusLvBtns, s3.name, lg, p3PlusLevel)

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
            val plus1Tag = OverlayService.resolveMegaPlusMoveStatic(s1.name, lg, prefs)?.let { if (p1PlusLevel <= 0) " [+$it Off]" else " [+$it Lv$p1PlusLevel]" } ?: ""
            val plus2Tag = OverlayService.resolveMegaPlusMoveStatic(s2.name, lg, prefs)?.let { if (p2PlusLevel <= 0) " [+$it Off]" else " [+$it Lv$p2PlusLevel]" } ?: ""
            val plus3Tag = OverlayService.resolveMegaPlusMoveStatic(s3.name, lg, prefs)?.let { if (p3PlusLevel <= 0) " [+$it Off]" else " [+$it Lv$p3PlusLevel]" } ?: ""
            textP1RoleTitle?.text = when {
                isAbb -> "⚔️ Slot 1 (Lead A) & Moveset"
                isDuo -> "☯️ Slot 1 (Core 1 Lead) & Moveset"
                else -> "⚔️ Slot 1 (Lead) & Moveset"
            } + alt1Tag + plus1Tag
            textP2RoleTitle?.text = when {
                isAbb -> "🔄 Slot 2 (Bait Swap B1) & Moveset"
                isDuo -> "🔄 Slot 2 (Safe Swap Pivot) & Moveset"
                else -> "🔄 Slot 2 (Safe Swap) & Moveset"
            } + alt2Tag + plus2Tag
            textP3RoleTitle?.text = when {
                isAbb -> "🛡️ Slot 3 (Sweeper B2) & Moveset"
                isDuo -> "☯️ Slot 3 (Core 2 Co-Core) & Moveset"
                else -> "🛡️ Slot 3 (Closer) & Moveset"
            } + alt3Tag + plus3Tag

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

        var lastSelectedEditorLeague = existingPreset?.league ?: "GREAT LEAGUE"
        spinnerLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val lg = leagues.getOrElse(position) { "GREAT LEAGUE" }
                updateLeagueTemplateHints(lg)
                if (!lg.equals(lastSelectedEditorLeague, ignoreCase = true)) {
                    lastSelectedEditorLeague = lg
                    listOf(
                        Triple(editP1, editP1Cp, editP1Ivs),
                        Triple(editP2, editP2Cp, editP2Ivs),
                        Triple(editP3, editP3Cp, editP3Ivs)
                    ).forEach { (nameEd, cpEd, ivEd) ->
                        val monName = nameEd.text?.toString()?.trim().orEmpty()
                        if (monName.isNotEmpty()) {
                            val resolved = OverlayService.resolveRecommendedMovesForSpecies(monName, lg)
                            val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, lg) else null
                            if (scaled != null) {
                                cpEd.setText(scaled.defaultCp.toString())
                                ivEd.setText(scaled.defaultIvsGl ?: "")
                            }
                        }
                    }
                }
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

        btnP1PlusLvBtns.forEachIndexed { lvl, btn ->
            btn?.setOnClickListener {
                p1PlusLevel = lvl
                refreshDialogTeamEvaluation(autoReorder = false)
            }
        }
        btnP2PlusLvBtns.forEachIndexed { lvl, btn ->
            btn?.setOnClickListener {
                p2PlusLevel = lvl
                refreshDialogTeamEvaluation(autoReorder = false)
            }
        }
        btnP3PlusLvBtns.forEachIndexed { lvl, btn ->
            btn?.setOnClickListener {
                p3PlusLevel = lvl
                refreshDialogTeamEvaluation(autoReorder = false)
            }
        }

        btnSwapSlot12?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
            applySlotsToDialogInputs(listOf(s2, s1, s3))
            val eval = refreshDialogTeamEvaluation(autoReorder = false)
            textDialogAutoDetectBanner?.text =
                "Swapped Slot 1 ⇄ Slot 2: #1 Lead ${s2.name} (Lead BR ${eval.leadAggBr}) • #2 Safe Swap ${s1.name} (Swap BR ${eval.safeSwapBr})"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
        }

        btnSwapSlot23?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
            applySlotsToDialogInputs(listOf(s1, s3, s2))
            val eval = refreshDialogTeamEvaluation(autoReorder = false)
            textDialogAutoDetectBanner?.text =
                "Swapped Slot 2 ⇄ Slot 3: #2 Safe Swap ${s3.name} (Swap BR ${eval.safeSwapBr}) • #3 Closer ${s2.name} (Swap BR ${eval.closerSwapBr})"
            textDialogAutoDetectBanner?.visibility = android.view.View.VISIBLE
        }

        btnSwapSlot13?.setOnClickListener {
            val lg = currentLeagueProvider()
            val top3Defaults = getLeagueTop3Defaults(lg)
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
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
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val manualArch = dialogManualArchetypeOverride

            btnDialogSuggestUpgrades?.isEnabled = false
            btnDialogSuggestUpgrades?.text = "⏳ Simulating Top-200 Meta for Role Upgrades..."

            roleUpgradeJob?.cancel()
            roleUpgradeJob = lifecycleScope.launch(Dispatchers.Default) {
                val recResult = OverlayService.recommendTop3UpgradesPerRoleStatic(
                    slots = listOf(
                        OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs, s1.plusMoveLevel),
                        OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs, s2.plusMoveLevel),
                        OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs, s3.plusMoveLevel)
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
                                val plusMove = OverlayService.resolveMegaPlusMoveStatic(cand.name, lg, prefs)
                                val plusTag = if (plusMove != null) " + $plusMove [Mega4]" else ""
                                btn?.text = "${idx + 1}. ${cand.name} (${cand.fastMove} / ${cand.chargedMove1} + ${cand.chargedMove2}$plusTag)  •  Core ${upg.newMachineAggBr} ($machDeltaStr) • $roleMetricName ${upg.newRoleBr} ($roleDeltaStr)"
                                btn?.setOnClickListener {
                                    val newSlot = PokemonSlot(
                                        name = cand.name,
                                        cp = cand.cp,
                                        fastMove = cand.fastMove,
                                        chargedMove1 = cand.chargedMove1,
                                        chargedMove2 = cand.chargedMove2,
                                        ivs = cand.ivs,
                                        plusMoveLevel = 4
                                    )
                                    val curLg = currentLeagueProvider()
                                    val curDefs = getLeagueTop3Defaults(curLg)
                                    val cur1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, curLg, curDefs[0], p1PlusLevel)
                                    val cur2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, curLg, curDefs[1], p2PlusLevel)
                                    val cur3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, curLg, curDefs[2], p3PlusLevel)
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
            val s1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, lg, top3Defaults[0], p1PlusLevel)
            val s2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, lg, top3Defaults[1], p2PlusLevel)
            val s3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, lg, top3Defaults[2], p3PlusLevel)
            val seasonLogs = getCurrentSeasonLogsForLeague(lg, preloadedDialogLogs)
            val manualArch = dialogManualArchetypeOverride

            btnDialogOptimizeMovesets?.isEnabled = false
            btnDialogOptimizeMovesets?.text = "⏳ Simulating All Team Move Options..."

            movesetOptJob?.cancel()
            movesetOptJob = lifecycleScope.launch(Dispatchers.Default) {
                val moveResult = OverlayService.recommendTop3MovesetsForTeamStatic(
                    slots = listOf(
                        OverlayService.TeamMember(s1.name, s1.cp, s1.fastMove, s1.chargedMove1, s1.chargedMove2, s1.ivs, s1.plusMoveLevel),
                        OverlayService.TeamMember(s2.name, s2.cp, s2.fastMove, s2.chargedMove1, s2.chargedMove2, s2.ivs, s2.plusMoveLevel),
                        OverlayService.TeamMember(s3.name, s3.cp, s3.fastMove, s3.chargedMove1, s3.chargedMove2, s3.ivs, s3.plusMoveLevel)
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
                                val plusMove = OverlayService.resolveMegaPlusMoveStatic(sug.pokemonName, lg, prefs)
                                val slotPlusLvl = when (slotIndex) {
                                    0 -> p1PlusLevel
                                    1 -> p2PlusLevel
                                    else -> p3PlusLevel
                                }
                                val plusTag = if (plusMove != null) {
                                    if (slotPlusLvl <= 0) " + $plusMove [Off]" else " + $plusMove [Lv$slotPlusLvl]"
                                } else ""
                                btn?.text = "${idx + 1}. ${sug.proposedFastMove} / ${sug.proposedCharged1} + ${sug.proposedCharged2}$plusTag  •  Team Core ${sug.newMachineAggBr} ($machDeltaStr) • Pos $roleMetricName ${sug.newRoleBr} ($roleDeltaStr)"
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
                                        "Applied Moveset to Slot ${slotIndex + 1} (${sug.pokemonName} → ${sug.proposedFastMove} + ${sug.proposedCharged1}/${sug.proposedCharged2}$plusTag): Team Core BR ${evalAfter.machineAggBr} ($machDeltaStr) • Pos $roleMetricName ${sug.newRoleBr} ($roleDeltaStr) • Team Lead BR ${sug.newLeadAggBr} ($leadDeltaStr)"
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

                val p1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, league, top3Defaults[0], p1PlusLevel)
                val p2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, league, top3Defaults[1], p2PlusLevel)
                val p3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, league, top3Defaults[2], p3PlusLevel)

                if (OverlayService.hasMultipleMegasStatic(listOf(p1.name, p2.name, p3.name))) {
                    Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per team!", Toast.LENGTH_LONG).show()
                    return@setPositiveButton
                }

                val rawPreset = TeamPreset(
                    id = existingPreset?.id ?: UUID.randomUUID().toString(),
                    name = name,
                    league = league,
                    pokemon = listOf(p1, p2, p3),
                    isSelected = existingPreset?.isSelected ?: false,
                    updatedAt = System.currentTimeMillis(),
                    archetype = dialogManualArchetypeOverride ?: "ABC",
                    isArchetypeManual = dialogManualArchetypeOverride != null,
                    combatMode = if (isShow6CombatMode()) "show6" else "gbl"
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
            .create()

        // Wire internal Clone / Copy Team panel inside the Edit Team dialog
        val spinnerModalCloneLeague = dialogView.findViewById<Spinner>(R.id.spinner_modal_clone_target_league)
        val btnModalCloneSameMode = dialogView.findViewById<Button>(R.id.btn_modal_clone_same_mode)
        val btnModalCopyCrossMode = dialogView.findViewById<Button>(R.id.btn_modal_copy_cross_mode)
        val btnModalCopyAutoFill6 = dialogView.findViewById<Button>(R.id.btn_modal_copy_autofill6)
        val btnModalSwapToOpp6 = dialogView.findViewById<Button>(R.id.btn_modal_swap_to_opp6)

        val allTargetFormats = (OverlayService.getEnabledGblLeaguesStatic(prefs) + OverlayService.getEnabledShow6LeaguesStatic(prefs)).distinct()
        spinnerModalCloneLeague?.adapter = createThemedSpinnerAdapter(allTargetFormats)
        val initCloneLgIdx = allTargetFormats.indexOfFirst { it.equals(existingPreset?.league ?: currentLeagueProvider(), ignoreCase = true) }.takeIf { it >= 0 } ?: 0
        spinnerModalCloneLeague?.setSelection(initCloneLgIdx)

        btnModalCopyCrossMode?.text = if (isShow6CombatMode()) "🛡️ Copy → GBL Blind 3" else "🏛️ Copy → Show 6 Trio"

        fun collectCurrentDialogSlotsForTargetLeague(targetLg: String): List<PokemonSlot>? {
            val top3Defaults = getLeagueTop3Defaults(targetLg)
            val p1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, targetLg, top3Defaults[0], p1PlusLevel)
            val p2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, targetLg, top3Defaults[1], p2PlusLevel)
            val p3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, targetLg, top3Defaults[2], p3PlusLevel)
            if (OverlayService.hasMultipleMegasStatic(listOf(p1.name, p2.name, p3.name))) {
                Toast.makeText(this, "⚠️ Max 1 Mega/Primal Pokémon allowed per team!", Toast.LENGTH_LONG).show()
                return null
            }
            return listOf(p1, p2, p3).map { s ->
                val resolved = OverlayService.resolveRecommendedMovesForSpecies(s.name, targetLg)
                val scaled = if (resolved != null) OverlayService.computeEffectiveCombatStats(resolved, targetLg) else null
                if (scaled != null) {
                    s.copy(cp = scaled.defaultCp, ivs = scaled.defaultIvsGl)
                } else s
            }
        }

        btnModalCloneSameMode?.setOnClickListener {
            val targetLg = spinnerModalCloneLeague?.selectedItem?.toString() ?: currentLeagueProvider()
            val slots = collectCurrentDialogSlotsForTargetLeague(targetLg) ?: return@setOnClickListener
            val baseName = editName.text.toString().trim().ifEmpty { existingPreset?.name ?: "Custom Team" }
            val clonedRaw = TeamPreset(
                id = UUID.randomUUID().toString(),
                name = "$baseName (Copy)",
                league = targetLg,
                pokemon = slots,
                isSelected = true,
                updatedAt = System.currentTimeMillis(),
                archetype = dialogManualArchetypeOverride ?: "ABC",
                isArchetypeManual = dialogManualArchetypeOverride != null,
                combatMode = if (isShow6CombatMode()) "show6" else "gbl"
            )
            val evaluated = evaluatePresetMetrics(clonedRaw, autoReorder = false)
            val list = loadPresets().toMutableList()
            list.add(0, evaluated)
            savePresets(list)
            setSelectedPreset(evaluated.id)
            Toast.makeText(this, "📋 Cloned '${evaluated.name}' ($targetLg)!", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
            showPresetEditorDialog(evaluated)
        }

        btnModalCopyCrossMode?.setOnClickListener {
            val targetLg = spinnerModalCloneLeague?.selectedItem?.toString() ?: currentLeagueProvider()
            val slots = collectCurrentDialogSlotsForTargetLeague(targetLg) ?: return@setOnClickListener
            val baseName = editName.text.toString().trim().ifEmpty { existingPreset?.name ?: "Custom Team" }
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            if (isShow6CombatMode()) {
                val copied = TeamPreset(
                    id = UUID.randomUUID().toString(),
                    name = "$baseName (from Show 6)",
                    league = targetLg,
                    pokemon = slots,
                    isSelected = true,
                    updatedAt = System.currentTimeMillis(),
                    combatMode = "gbl"
                )
                val rawGbl = prefs.getString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, null)
                val gblList = (try { gson.fromJson<List<TeamPreset>>(rawGbl, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
                gblList.add(0, copied)
                prefs.edit()
                    .putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(gblList))
                    .putString("gbl_selected_preset_id", copied.id)
                    .apply()
                Toast.makeText(this, "🛡️ Copied '${copied.name}' as separate GBL Blind 3 entry ($targetLg)!", Toast.LENGTH_LONG).show()
            } else {
                val copied = TeamPreset(
                    id = UUID.randomUUID().toString(),
                    name = "$baseName (from GBL)",
                    league = targetLg,
                    pokemon = slots,
                    isSelected = true,
                    updatedAt = System.currentTimeMillis(),
                    combatMode = "show6"
                )
                val rawS6 = prefs.getString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, null)
                val s6List = (try { gson.fromJson<List<TeamPreset>>(rawS6, type) } catch (_: Exception) { null }).orEmpty().toMutableList()
                s6List.add(0, copied)
                prefs.edit()
                    .putString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, gson.toJson(s6List))
                    .putString(OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID, copied.id)
                    .apply()
                Toast.makeText(this, "🏛️ Copied '${copied.name}' as separate Show 6 Trio entry ($targetLg)!", Toast.LENGTH_LONG).show()
            }
        }

        btnModalCopyAutoFill6?.setOnClickListener {
            val targetLg = spinnerModalCloneLeague?.selectedItem?.toString() ?: currentLeagueProvider()
            val slots = collectCurrentDialogSlotsForTargetLeague(targetLg) ?: return@setOnClickListener
            val locked3 = slots.map { it.name }.filter { it.isNotBlank() }
            val baseName = editName.text.toString().trim().ifEmpty { existingPreset?.name ?: "Custom Team" }
            Toast.makeText(this, "⏳ Auto-filling 3 synergistic partners for $targetLg...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch(Dispatchers.Default) {
                val gen = OverlayService.generateBlindShow6RosterStatic(
                    league = targetLg,
                    lockedCoreNames = locked3,
                    filterMode = "open",
                    filterPokemonNames = emptyList(),
                    expectedHistoricalNames = emptyList(),
                    historicalWeightPct = 0
                )
                val full6 = gen.roster6.map { it.pokemon.name }.ifEmpty {
                    (locked3 + OverlayService.getMostLikelyMetaOpponent6Static(targetLg)).distinct().take(6)
                }
                val newRoster = OverlayService.Companion.Show6RosterPreset(
                    id = "show6-autofill-${UUID.randomUUID()}",
                    name = "$baseName + Auto-Fill 6",
                    league = targetLg,
                    pokemon = full6
                )
                withContext(Dispatchers.Main) {
                    val curMy6 = loadShow6RostersOf6().toMutableList()
                    curMy6.add(0, newRoster)
                    saveShow6RostersOf6(curMy6)
                    setupShow6ModeHubUi()
                    Toast.makeText(
                        this@MainActivity,
                        "🏛️ Created Show 6 Roster (${newRoster.name}): ${full6.joinToString(" • ")}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        btnModalSwapToOpp6?.setOnClickListener {
            val targetLg = spinnerModalCloneLeague?.selectedItem?.toString() ?: currentLeagueProvider()
            val slots = collectCurrentDialogSlotsForTargetLeague(targetLg) ?: return@setOnClickListener
            val locked3 = slots.map { it.name }.filter { it.isNotBlank() }
            val baseName = editName.text.toString().trim().ifEmpty { existingPreset?.name ?: "Custom Team" }
            lifecycleScope.launch(Dispatchers.Default) {
                val gen = OverlayService.generateBlindShow6RosterStatic(
                    league = targetLg,
                    lockedCoreNames = locked3,
                    filterMode = "open",
                    filterPokemonNames = emptyList(),
                    expectedHistoricalNames = emptyList(),
                    historicalWeightPct = 0
                )
                val full6 = gen.roster6.map { it.pokemon.name }.ifEmpty {
                    (locked3 + OverlayService.getMostLikelyMetaOpponent6Static(targetLg)).distinct().take(6)
                }
                val oppRoster = OverlayService.Companion.Show6RosterPreset(
                    id = "show6-opp-trio-${UUID.randomUUID()}",
                    name = "Opp: $baseName (6)",
                    league = targetLg,
                    pokemon = full6
                )
                withContext(Dispatchers.Main) {
                    val curOpp = loadShow6OpponentRostersOf6().toMutableList()
                    curOpp.add(0, oppRoster)
                    saveShow6OpponentRostersOf6(curOpp)
                    prefs.edit().putString(OverlayService.PREFS_KEY_SHOW6_OPPONENT_6, gson.toJson(full6)).apply()
                    setupShow6ModeHubUi()
                    Toast.makeText(
                        this@MainActivity,
                        "⚔️ Cloned '$baseName' into Opponent 6 (${full6.joinToString(" / ")})!",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }

        dialog.show()
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
        val selectedSummary = OverlayService.formatSelectedLeaguesStatusSummaryStatic(prefs)
        return "Last Updated: $dateStr • GameMaster: $gmCount Pokémon\nSelected Leagues Loaded — $selectedSummary"
    }

    /**
     * PVPOKE GAMEMASTER + SELECTED LEAGUE RANKINGS DOWNLOAD & CACHE:
     * Downloads raw live PvPoke gamemaster.json + rankings JSONs for all selected leagues
     */
    private fun checkGamemasterCache() {
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        if (cacheFile.exists()) {
            dbStatusText.text = "Loading cached PvPoke GameMaster & Selected League Rankings..."
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
                OverlayService.syncPinnedLimitedMetaRankingsBlocking(prefs, filesDir)
                recalculateAllPresetsWithSeasonMetaBlocking()
                withContext(Dispatchers.Main) {
                    dbStatusText.text = formatDbAndLeagueStatusText()
                    refreshPresetsUi()
                    renderBattleLogPage()
                }
            }
        } else {
            dbStatusText.text = "PvPoke Database: Not cached (syncing selected leagues...)"
            lifecycleScope.launch(Dispatchers.Default) {
                runOneTimeAiLogSplitAndCleanup(silent = true)
                migrateExistingBattleLogs()
            }
            downloadPvPokeGamemaster()
        }
    }

    private fun downloadPvPokeGamemaster() {
        dbStatusText.text = "Downloading PvPoke gamemaster.json + selected league rankings..."
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
                OverlayService.syncPinnedLimitedMetaRankingsBlocking(prefs, filesDir, forceRefresh = true)

                val request = Request.Builder().url(GAMEMASTER_URL).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
                    val bodyString = response.body?.string() ?: throw Exception("Empty body")

                    val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                    cacheFile.writeText(bodyString)
                    OverlayService.parseGamemasterJsonStatic(bodyString)
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()

                    val selectedCount = OverlayService.getSelectedLeaguesRankingsCountsStatic(prefs).size
                    withContext(Dispatchers.Main) {
                        dbStatusText.text = formatDbAndLeagueStatusText()
                        btnDownloadDb.isEnabled = true
                        reparseAllCompletedBattles(silent = true)
                        if (currentActivePage == "meta") {
                            refreshMetaTabDashboard()
                        }
                        Toast.makeText(this@MainActivity, "PvPoke gamemaster & $selectedCount selected league rankings synced!", Toast.LENGTH_SHORT).show()
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

    /**
     * v6.00: 4th Navigation Tab — Personalized Meta & Top Cores Dashboard (📊 Meta)
     * - Mode-independent League Selector & Meta Blending controls (GBL Blind 3 vs Show 6 Battle Frontier)
     * - Limited Cup Same-CP Standard League Blending (50% weight & Fast 0.10 decay default for GBL Blind 3)
     * - Collapsible Meta Settings, Limited Cups & Sheet Importer Drawer (collapsed by default on open)
     * - Scope Toggle: Current Season (drives AI & Team Builder) | Last 25 | Last 50 (personal inspection only)
     */
    private fun setupMetaTabUi() {
        val spinnerLeague = findViewById<Spinner>(R.id.spinner_meta_tab_league) ?: return
        val tvModeBadge = findViewById<TextView>(R.id.tv_meta_mode_badge)
        val btnScopeSeason = findViewById<Button>(R.id.btn_meta_scope_season)
        val btnScopeLast25 = findViewById<Button>(R.id.btn_meta_scope_last25)
        val btnScopeLast50 = findViewById<Button>(R.id.btn_meta_scope_last50)
        val btnToggleDrawer = findViewById<Button>(R.id.btn_toggle_meta_settings_drawer)
        val layoutDrawer = findViewById<LinearLayout>(R.id.layout_meta_settings_drawer)

        val tvTuningCardTitle = findViewById<TextView>(R.id.tv_meta_tuning_card_title)
        val btnResetDefaults = findViewById<Button>(R.id.btn_reset_meta_tuning_defaults)
        val tvLogWeightLabel = findViewById<TextView>(R.id.tv_meta_log_weight_label)
        val seekLogWeight = findViewById<SeekBar>(R.id.seek_meta_log_weight)
        val btnDecayFlat = findViewById<Button>(R.id.btn_meta_decay_flat)
        val btnDecaySlow = findViewById<Button>(R.id.btn_meta_decay_slow)
        val btnDecayStd = findViewById<Button>(R.id.btn_meta_decay_std)
        val btnDecayFast = findViewById<Button>(R.id.btn_meta_decay_fast)
        val btnDecayUltra = findViewById<Button>(R.id.btn_meta_decay_ultra)

        val tvLimitedStdBlendLabel = findViewById<TextView>(R.id.tv_limited_std_blend_label)
        val seekLimitedStdBlendPct = findViewById<SeekBar>(R.id.seek_limited_std_blend_pct)
        val btnLimDecaySlow = findViewById<Button>(R.id.btn_lim_decay_slow)
        val btnLimDecayStd = findViewById<Button>(R.id.btn_lim_decay_std)
        val btnLimDecayFast = findViewById<Button>(R.id.btn_lim_decay_fast)

        val isShow6 = isShow6CombatMode()
        tvModeBadge?.text = if (isShow6) "🏛️ SHOW 6 MODE" else "🛡️ GBL BLIND 3"
        tvModeBadge?.setTextColor(if (isShow6) 0xFFFBBF24.toInt() else 0xFF38BDF8.toInt())
        tvTuningCardTitle?.text = if (isShow6) {
            "⚙️ Show 6 Season Blending (Logs vs. Sheet/PvPoke & Decay)"
        } else {
            "⚙️ GBL Blind 3 Season Blending (Logs vs. PvPoke & Decay)"
        }

        // Keep collapsible drawer collapsed by default unless explicitly expanded by user in this session
        layoutDrawer?.visibility = if (isMetaSettingsDrawerExpanded) android.view.View.VISIBLE else android.view.View.GONE
        btnToggleDrawer?.text = if (isMetaSettingsDrawerExpanded) {
            "⚙️ Meta Settings, Limited Cups & Sheet Importer ▲"
        } else {
            "⚙️ Meta Settings, Limited Cups & Sheet Importer ▼"
        }
        btnToggleDrawer?.setOnClickListener {
            isMetaSettingsDrawerExpanded = !isMetaSettingsDrawerExpanded
            layoutDrawer?.visibility = if (isMetaSettingsDrawerExpanded) android.view.View.VISIBLE else android.view.View.GONE
            btnToggleDrawer.text = if (isMetaSettingsDrawerExpanded) {
                "⚙️ Meta Settings, Limited Cups & Sheet Importer ▲"
            } else {
                "⚙️ Meta Settings, Limited Cups & Sheet Importer ▼"
            }
        }

        // Populate mode-independent League Spinner
        val enabledLeagues = if (isShow6) {
            OverlayService.getEnabledShow6LeaguesStatic(prefs)
        } else {
            OverlayService.getEnabledGblLeaguesStatic(prefs)
        }
        val prefLeagueKey = if (isShow6) OverlayService.PREFS_KEY_META_TAB_LEAGUE_SHOW6 else OverlayService.PREFS_KEY_META_TAB_LEAGUE_GBL
        val defaultLeague = if (isShow6) "BATTLE FRONTIER (SPECTRAL)" else "GREAT LEAGUE"
        val savedLeague = prefs.getString(prefLeagueKey, defaultLeague) ?: defaultLeague

        isUpdatingMetaLeagueSpinner = true
        spinnerLeague.adapter = createThemedSpinnerAdapter(enabledLeagues)
        val lgIdx = enabledLeagues.indexOfFirst { it.equals(savedLeague, ignoreCase = true) }.takeIf { it >= 0 } ?: 0
        spinnerLeague.setSelection(lgIdx, false)
        isUpdatingMetaLeagueSpinner = false

        spinnerLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingMetaLeagueSpinner) return
                val chosenLg = enabledLeagues.getOrElse(position) { defaultLeague }
                val key = if (isShow6CombatMode()) OverlayService.PREFS_KEY_META_TAB_LEAGUE_SHOW6 else OverlayService.PREFS_KEY_META_TAB_LEAGUE_GBL
                prefs.edit().putString(key, chosenLg).apply()
                OverlayService.syncTierThresholdsFromPrefs(prefs)
                refreshMetaTabDashboard()
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        fun updateScopeButtonsUi() {
            val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
            val activeTint = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            val inactiveTint = android.content.res.ColorStateList.valueOf(theme.elevatedColor)
            val pairs = listOf(
                "SEASON" to btnScopeSeason,
                "LAST_25" to btnScopeLast25,
                "LAST_50" to btnScopeLast50
            )
            for ((scopeKey, btn) in pairs) {
                val active = selectedMetaTabScope == scopeKey
                btn?.backgroundTintList = if (active) activeTint else inactiveTint
                btn?.setTextColor(if (active) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
            }
        }

        btnScopeSeason?.setOnClickListener {
            selectedMetaTabScope = "SEASON"
            updateScopeButtonsUi()
            refreshMetaTabDashboard()
        }
        btnScopeLast25?.setOnClickListener {
            selectedMetaTabScope = "LAST_25"
            updateScopeButtonsUi()
            refreshMetaTabDashboard()
        }
        btnScopeLast50?.setOnClickListener {
            selectedMetaTabScope = "LAST_50"
            updateScopeButtonsUi()
            refreshMetaTabDashboard()
        }
        updateScopeButtonsUi()

        fun syncMetaTuningControlsFromPrefs() {
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            val show6Now = isShow6CombatMode()
            val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
            val activeTint = android.content.res.ColorStateList.valueOf(theme.buttonAccentColor)
            val activeSecTint = android.content.res.ColorStateList.valueOf(theme.secondaryButtonColor)
            val inactiveTint = android.content.res.ColorStateList.valueOf(theme.elevatedColor)

            // 1. Season Log Weight % (-1 = Auto, or 0..100 in steps of 5 -> progress 0..21)
            val logWeightPct = if (show6Now) OverlayService.activeShow6MetaLogWeightPct else OverlayService.activeGblMetaLogWeightPct
            val progressVal = if (logWeightPct < 0) 0 else ((logWeightPct.coerceIn(0, 100) / 5) + 1).coerceIn(1, 21)
            seekLogWeight?.progress = progressVal
            tvLogWeightLabel?.text = if (logWeightPct < 0) {
                "Auto (Scales 0%→70% over 50 matches)"
            } else {
                "${logWeightPct}% Logs / ${100 - logWeightPct}% Baseline"
            }

            // 2. Recency Decay Factor (0.00, 0.025, 0.05, 0.08, 0.12)
            val decayLambda = if (show6Now) OverlayService.activeShow6MetaDecayFactor else OverlayService.activeGblMetaDecayFactor
            val decayButtons = listOf(
                0.00f to btnDecayFlat,
                0.025f to btnDecaySlow,
                0.05f to btnDecayStd,
                0.08f to btnDecayFast,
                0.12f to btnDecayUltra
            )
            for ((targetLambda, btn) in decayButtons) {
                val selected = kotlin.math.abs(decayLambda - targetLambda) < 0.008f
                btn?.backgroundTintList = if (selected) activeTint else inactiveTint
                btn?.setTextColor(if (selected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
            }

            // 3. GBL Blind 3 Only: Limited Cup Same-CP Standard League Blend % (0..75 in steps of 5 -> progress 0..15, default 50% start fade & Fast 0.10 decay)
            val layoutLimitedSection = findViewById<LinearLayout>(R.id.layout_limited_cup_blend_section)
            layoutLimitedSection?.visibility = if (show6Now) android.view.View.GONE else android.view.View.VISIBLE
            val limStdPct = OverlayService.activeLimitedStdBlendPctGbl
            val limDecay = OverlayService.activeLimitedStdDecayGbl
            seekLimitedStdBlendPct?.progress = (limStdPct.coerceIn(0, 75) / 5).coerceIn(0, 15)
            val limDecayLabel = when {
                limDecay >= 0.085f -> "Fast"
                limDecay <= 0.045f -> "Slow"
                else -> "Std"
            }
            val defTag = if (limStdPct == 50 && limDecayLabel == "Fast") " (Default)" else ""
            tvLimitedStdBlendLabel?.text = "${limStdPct}% Start Fade • $limDecayLabel Decay$defTag"

            val limDecayButtons = listOf(
                0.03f to btnLimDecaySlow,
                0.06f to btnLimDecayStd,
                0.10f to btnLimDecayFast
            )
            for ((targetLimDecay, btn) in limDecayButtons) {
                val selected = kotlin.math.abs(limDecay - targetLimDecay) < 0.015f
                btn?.backgroundTintList = if (selected) activeSecTint else inactiveTint
                btn?.setTextColor(if (selected) 0xFFFFFFFF.toInt() else theme.secondaryTextColor)
            }
        }

        seekLogWeight?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = if (progress <= 0) 70 else ((progress - 1) * 5).coerceIn(0, 100)
                tvLogWeightLabel?.text = if (progress <= 0) {
                    "Auto (Scales 0%→70% over 50 matches)"
                } else {
                    "${pct}% Logs / ${100 - pct}% Baseline"
                }
                if (fromUser) {
                    val key = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_META_LOG_WEIGHT_PCT else OverlayService.PREFS_KEY_GBL_META_LOG_WEIGHT_PCT
                    prefs.edit().putInt(key, pct).apply()
                    OverlayService.syncTierThresholdsFromPrefs(prefs)
                    recalculateAllPresetsWithSeasonMetaAsync()
                    refreshMetaTabDashboard()
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        fun saveMetaDecayLambda(lambdaVal: Float) {
            val key = if (isShow6CombatMode()) OverlayService.PREFS_KEY_SHOW6_META_DECAY_FACTOR else OverlayService.PREFS_KEY_GBL_META_DECAY_FACTOR
            prefs.edit().putFloat(key, lambdaVal).apply()
            syncMetaTuningControlsFromPrefs()
            recalculateAllPresetsWithSeasonMetaAsync()
            refreshMetaTabDashboard()
        }

        btnDecayFlat?.setOnClickListener { saveMetaDecayLambda(0.00f) }
        btnDecaySlow?.setOnClickListener { saveMetaDecayLambda(0.025f) }
        btnDecayStd?.setOnClickListener { saveMetaDecayLambda(0.05f) }
        btnDecayFast?.setOnClickListener { saveMetaDecayLambda(0.08f) }
        btnDecayUltra?.setOnClickListener { saveMetaDecayLambda(0.12f) }

        seekLimitedStdBlendPct?.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = (progress.coerceIn(0, 15) * 5).coerceIn(0, 75)
                val limDecay = OverlayService.activeLimitedStdDecayGbl
                val limDecayLabel = when {
                    limDecay >= 0.085f -> "Fast"
                    limDecay <= 0.045f -> "Slow"
                    else -> "Std"
                }
                val defTag = if (pct == 50 && limDecayLabel == "Fast") " (Default)" else ""
                tvLimitedStdBlendLabel?.text = "${pct}% Start Fade • $limDecayLabel Decay$defTag"
                if (fromUser) {
                    prefs.edit().putInt(OverlayService.PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL, pct).apply()
                    OverlayService.syncTierThresholdsFromPrefs(prefs)
                    recalculateAllPresetsWithSeasonMetaAsync()
                    refreshMetaTabDashboard()
                }
            }
            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        fun saveLimitedStdDecay(decayVal: Float) {
            prefs.edit().putFloat(OverlayService.PREFS_KEY_LIMITED_STD_DECAY_GBL, decayVal).apply()
            syncMetaTuningControlsFromPrefs()
            recalculateAllPresetsWithSeasonMetaAsync()
            refreshMetaTabDashboard()
        }

        btnLimDecaySlow?.setOnClickListener { saveLimitedStdDecay(0.03f) }
        btnLimDecayStd?.setOnClickListener { saveLimitedStdDecay(0.06f) }
        btnLimDecayFast?.setOnClickListener { saveLimitedStdDecay(0.10f) }

        btnResetDefaults?.setOnClickListener {
            if (isShow6CombatMode()) {
                prefs.edit()
                    .putInt(OverlayService.PREFS_KEY_SHOW6_META_LOG_WEIGHT_PCT, OverlayService.DEFAULT_SHOW6_META_LOG_WEIGHT_PCT)
                    .putFloat(OverlayService.PREFS_KEY_SHOW6_META_DECAY_FACTOR, OverlayService.DEFAULT_SHOW6_META_DECAY_FACTOR)
                    .apply()
                Toast.makeText(this, "Restored Show 6 Meta Defaults (60% Max Log Weight • Std 0.05 Decay)", Toast.LENGTH_SHORT).show()
            } else {
                prefs.edit()
                    .putInt(OverlayService.PREFS_KEY_GBL_META_LOG_WEIGHT_PCT, OverlayService.DEFAULT_GBL_META_LOG_WEIGHT_PCT)
                    .putFloat(OverlayService.PREFS_KEY_GBL_META_DECAY_FACTOR, OverlayService.DEFAULT_GBL_META_DECAY_FACTOR)
                    .putInt(OverlayService.PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL, OverlayService.DEFAULT_LIMITED_STD_BLEND_PCT_GBL)
                    .putFloat(OverlayService.PREFS_KEY_LIMITED_STD_DECAY_GBL, OverlayService.DEFAULT_LIMITED_STD_DECAY_GBL)
                    .apply()
                Toast.makeText(this, "Restored GBL Blind 3 Meta Defaults (70% Max Log Weight • Std 0.05 Decay • 50% Std Cup Start Fade + Fast Decay)", Toast.LENGTH_SHORT).show()
            }
            syncMetaTuningControlsFromPrefs()
            recalculateAllPresetsWithSeasonMetaAsync()
            refreshMetaTabDashboard()
        }

        syncMetaTuningControlsFromPrefs()
    }

    private fun refreshMetaTabDashboard() {
        val spinnerLeague = findViewById<Spinner>(R.id.spinner_meta_tab_league) ?: return
        val coresSubtitle = findViewById<TextView>(R.id.tv_meta_cores_subtitle)
        val coresContainer = findViewById<LinearLayout>(R.id.container_meta_top_cores) ?: return
        val pokemonSubtitle = findViewById<TextView>(R.id.tv_meta_pokemon_subtitle)
        val pokemonContainer = findViewById<LinearLayout>(R.id.container_meta_top_pokemon) ?: return
        val layoutLimitedSection = findViewById<LinearLayout>(R.id.layout_limited_cup_blend_section)

        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val isShow6 = isShow6CombatMode()
        layoutLimitedSection?.visibility = if (!isShow6) android.view.View.VISIBLE else android.view.View.GONE
        val prefLeagueKey = if (isShow6) OverlayService.PREFS_KEY_META_TAB_LEAGUE_SHOW6 else OverlayService.PREFS_KEY_META_TAB_LEAGUE_GBL
        val fallbackLg = prefs.getString(prefLeagueKey, if (isShow6) "BATTLE FRONTIER (SPECTRAL)" else "GREAT LEAGUE") ?: "GREAT LEAGUE"
        val selectedLeague = spinnerLeague.selectedItem?.toString() ?: fallbackLg
        val isLimitedCup = !isShow6 && OverlayService.isLimitedCupFormatStatic(selectedLeague)

        val empiricalLimit: Int? = when (selectedMetaTabScope) {
            "LAST_25" -> 25
            "LAST_50" -> 50
            else -> null
        }

        val (currSeason, _) = getCurrentAndPreviousSeason()
        val allLogs = loadBattleLogs()
        val seasonLogs = getCurrentSeasonLogsForLeague(selectedLeague, allLogs)
        val sameCpStdLogs = if (isLimitedCup && empiricalLimit == null) {
            val stdLg = OverlayService.getSameCpStandardLeagueKeyStatic(selectedLeague)
            getCurrentSeasonLogsForLeague(stdLg, allLogs)
        } else {
            emptyList()
        }

        val scopeBanner = when (empiricalLimit) {
            25 -> "Last 25 Battles (Personal Inspection Only — Does Not Drive AI/Team Builder)"
            50 -> "Last 50 Battles (Personal Inspection Only — Does Not Drive AI/Team Builder)"
            else -> {
                val limExtra = if (isLimitedCup && sameCpStdLogs.isNotEmpty()) {
                    val pct = OverlayService.activeLimitedStdBlendPctGbl
                    val stdLgName = OverlayService.getSameCpStandardLeagueKeyStatic(selectedLeague)
                    " + ${pct}% Start Fade from $stdLgName (${sameCpStdLogs.size} logs)"
                } else ""
                "Current Season (${currSeason.name} • ${seasonLogs.size} cup logs$limExtra • Drives Live AI & Team Builder)"
            }
        }
        coresSubtitle?.text = "$selectedLeague • $scopeBanner"
        pokemonSubtitle?.text = "$selectedLeague • $scopeBanner"

        metaDashboardJob?.cancel()
        metaDashboardJob = lifecycleScope.launch(Dispatchers.Default) {
            val dist = OverlayService.computeBlendedSeasonMetaStatic(
                league = selectedLeague,
                seasonLogs = seasonLogs,
                isShow6 = isShow6,
                sameCpStandardLogs = sameCpStdLogs,
                empiricalOnlyLimit = empiricalLimit
            )
            val topCores = OverlayService.computeBlendedSeasonMetaCoresStatic(
                league = selectedLeague,
                seasonLogs = seasonLogs,
                isShow6 = isShow6,
                sameCpStandardLogs = sameCpStdLogs,
                empiricalOnlyLimit = empiricalLimit,
                maxCores = 20
            )
            val topPokemon = OverlayService.buildTopMetaPokemonEntriesStatic(
                dist = dist,
                limit = 30
            )

            withContext(Dispatchers.Main) {
                val density = resources.displayMetrics.density
                val theme = if (::prefs.isInitialized) getActiveAppTheme() else APP_THEME_COLLECTION.first()
                val tier = if (::prefs.isInitialized) OverlayService.getEffectiveReplayTierStatic(prefs) else "free"
                val isProOrVip = tier == "pro" || tier == "vip"

                coresContainer.removeAllViews()

                // v7.00 Idea D: Personal Nemesis & Blind-Spot Meta Analyzer Card
                data class NemesisStat(val name: String, var wins: Int = 0, var losses: Int = 0)
                val nemesisMap = mutableMapOf<String, NemesisStat>()
                val currentSeasonEntries = allLogs.filter {
                    it.timestampMs in currSeason.startMs..currSeason.endMs &&
                        it.league.equals(selectedLeague, ignoreCase = true)
                }
                for (entry in currentSeasonEntries) {
                    val isWin = entry.result.equals("WIN", ignoreCase = true)
                    val isLoss = entry.result.equals("LOSS", ignoreCase = true)
                    if (!isWin && !isLoss) continue
                    for (opp in entry.opponents.distinct()) {
                        val clean = opp.trim()
                        if (clean.isEmpty() || clean.equals("Unknown", ignoreCase = true) || clean.equals("Waiting...", ignoreCase = true)) continue
                        val st = nemesisMap.getOrPut(clean) { NemesisStat(clean) }
                        if (isWin) st.wins++ else st.losses++
                    }
                }
                val topNemeses: List<NemesisStat> = nemesisMap.values
                    .filter { (it.wins + it.losses) >= 2 && it.losses >= 1 }
                    .sortedWith(
                        compareByDescending<NemesisStat> { it.losses.toDouble() / (it.wins + it.losses).coerceAtLeast(1).toDouble() }
                            .thenByDescending { it.losses }
                    )
                    .take(3)

                val nemesisCard = LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(0xFF1E1B4B.toInt())
                    val pad = (10 * density).toInt()
                    setPadding(pad, pad, pad, pad)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (8 * density).toInt()
                    }
                }
                val nemTitle = TextView(this@MainActivity).apply {
                    text = "🎯 Personal Nemesis & Blind-Spot Analyzer (${if (isProOrVip) "🏆 PRO ACTIVE" else "🔒 PRO FEATURE"})"
                    setTextColor(0xFFFBBF24.toInt())
                    textSize = 11.5f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }
                val nemSummaryText = if (topNemeses.isEmpty()) {
                    "Log at least 2 battles against repeated opponents in $selectedLeague to automatically detect your highest-loss-rate Nemesis threats & blind spots."
                } else {
                    topNemeses.mapIndexed { i, n ->
                        val tot = n.wins + n.losses
                        val lossPct = Math.round((n.losses.toDouble() / tot.toDouble()) * 100.0).toInt()
                        "#${i + 1} ${n.name}: ${n.wins}W-${n.losses}L ($lossPct% Loss Rate)"
                    }.joinToString("  •  ")
                }
                val nemBody = TextView(this@MainActivity).apply {
                    text = nemSummaryText
                    setTextColor(0xFFE2E8F0.toInt())
                    textSize = 10.5f
                    setPadding(0, (4 * density).toInt(), 0, (6 * density).toInt())
                }
                val nemBtn = Button(this@MainActivity).apply {
                    text = if (isProOrVip) "🎯 Build Anti-Nemesis Team in Anti-Meta Generator" else "🔒 Unlock 🎯 Anti-Nemesis Team Builder (Legend Pro)"
                    textSize = 10.5f
                    isAllCaps = false
                    backgroundTintList = android.content.res.ColorStateList.valueOf(if (isProOrVip) 0xFF059669.toInt() else 0xFF6366F1.toInt())
                    setTextColor(0xFFFFFFFF.toInt())
                    setOnClickListener {
                        if (!isProOrVip) {
                            startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(OverlayService.STRIPE_URL_PRO_INTRO_5)))
                        } else {
                            switchMainPage("teams")
                            if (::spinnerAntiMetaLeague.isInitialized) {
                                val adapter = spinnerAntiMetaLeague.adapter
                                if (adapter != null) {
                                    for (idx in 0 until adapter.count) {
                                        if (adapter.getItem(idx)?.toString().equals(selectedLeague, ignoreCase = true)) {
                                            spinnerAntiMetaLeague.setSelection(idx)
                                            break
                                        }
                                    }
                                }
                            }
                            runAntiMetaTeamBuilderGeneration()
                        }
                    }
                }
                nemesisCard.addView(nemTitle)
                nemesisCard.addView(nemBody)
                nemesisCard.addView(nemBtn)
                coresContainer.addView(nemesisCard)
                if (topCores.isEmpty()) {
                    val emptyTv = TextView(this@MainActivity).apply {
                        text = if (empiricalLimit != null) {
                            "No logged opponent backline pairs found in your $selectedLeague battle logs yet. Log battles or switch to 'Current Season' to view blended meta cores."
                        } else {
                            "Syncing PvPoke rankings & meta cores for $selectedLeague..."
                        }
                        setTextColor(0xFF94A3B8.toInt())
                        textSize = 11f
                        setPadding(0, (4 * density).toInt(), 0, (4 * density).toInt())
                    }
                    coresContainer.addView(emptyTv)
                } else {
                    topCores.take(15).forEachIndexed { idx, core ->
                        val row = LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = android.view.Gravity.CENTER_VERTICAL
                            setBackgroundColor(if (idx % 2 == 0) 0xFF0F172A.toInt() else 0xFF162238.toInt())
                            val padH = (8 * density).toInt()
                            val padV = (6 * density).toInt()
                            setPadding(padH, padV, padH, padV)
                            layoutParams = LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT
                            ).apply {
                                bottomMargin = (3 * density).toInt()
                            }
                        }

                        val sharePct = String.format(java.util.Locale.US, "%.1f%%", core.blendedPairPct)
                        val seenTag = if (core.logPairCount > 0) " • Seen ${core.logPairCount}x" else ""
                        val srcBadge = core.roleArchetype

                        val leftTv = TextView(this@MainActivity).apply {
                            text = "#${idx + 1}  ${core.monA}  +  ${core.monB}"
                            setTextColor(0xFFF8FAFC.toInt())
                            textSize = 11.5f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                        }
                        val rightTv = TextView(this@MainActivity).apply {
                            text = "$sharePct ($srcBadge$seenTag)"
                            setTextColor(
                                when {
                                    core.logPairCount >= 2 -> 0xFF34D399.toInt()
                                    core.logPairCount == 1 -> 0xFF38BDF8.toInt()
                                    else -> theme.secondaryAccentColor
                                }
                            )
                            textSize = 10.5f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                        }
                        row.addView(leftTv)
                        row.addView(rightTv)
                        coresContainer.addView(row)
                    }
                }

                pokemonContainer.removeAllViews()
                if (topPokemon.isEmpty()) {
                    val emptyTv = TextView(this@MainActivity).apply {
                        text = if (empiricalLimit != null) {
                            "No opponent Pokémon recorded in your $selectedLeague battle logs yet."
                        } else {
                            "Syncing PvPoke rankings for $selectedLeague..."
                        }
                        setTextColor(0xFF94A3B8.toInt())
                        textSize = 11f
                        setPadding(0, (4 * density).toInt(), 0, (4 * density).toInt())
                    }
                    pokemonContainer.addView(emptyTv)
                } else {
                    topPokemon.take(25).forEachIndexed { idx, entry ->
                        val row = LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = android.view.Gravity.CENTER_VERTICAL
                            setBackgroundColor(if (idx % 2 == 0) 0xFF0F172A.toInt() else 0xFF162238.toInt())
                            val padH = (8 * density).toInt()
                            val padV = (6 * density).toInt()
                            setPadding(padH, padV, padH, padV)
                            layoutParams = LinearLayout.LayoutParams(
                                LinearLayout.LayoutParams.MATCH_PARENT,
                                LinearLayout.LayoutParams.WRAP_CONTENT
                            ).apply {
                                bottomMargin = (3 * density).toInt()
                            }
                        }

                        val fieldPct = String.format(java.util.Locale.US, "%.1f%%", entry.blendedSharePct)
                        val leadPct = String.format(java.util.Locale.US, "%.1f%%", entry.leadSharePct)
                        val pvpRank = entry.pvpokeRank ?: 999
                        val rankTag = if (pvpRank < 900) "PvP #$pvpRank" else "Unranked"
                        val seenTag = if (entry.logSeenCount > 0) " • Seen ${entry.logSeenCount}x" else ""

                        val leftTv = TextView(this@MainActivity).apply {
                            text = "#${idx + 1}  ${entry.name}  ($rankTag)"
                            setTextColor(0xFFF8FAFC.toInt())
                            textSize = 11.5f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                        }
                        val rightTv = TextView(this@MainActivity).apply {
                            text = "Field $fieldPct • Lead $leadPct$seenTag"
                            setTextColor(
                                when {
                                    entry.logSeenCount >= 3 -> 0xFF34D399.toInt()
                                    entry.logSeenCount >= 1 -> 0xFF38BDF8.toInt()
                                    else -> 0xFFCBD5E1.toInt()
                                }
                            )
                            textSize = 10f
                            setTypeface(typeface, android.graphics.Typeface.BOLD)
                        }
                        row.addView(leftTv)
                        row.addView(rightTv)
                        pokemonContainer.addView(row)
                    }
                }
            }
        }
    }
}
