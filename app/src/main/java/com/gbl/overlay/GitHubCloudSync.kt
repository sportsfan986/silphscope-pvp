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
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
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
import com.gbl.overlay.OverlayService.Companion.AI_TELEMETRY_BRANCH
import com.gbl.overlay.OverlayService.Companion.AI_TELEMETRY_DAILY_INTERVAL_MS
import com.gbl.overlay.OverlayService.Companion.AI_TELEMETRY_MIN_BATTLES_ON_STOP
import com.gbl.overlay.OverlayService.Companion.AiTelemetryBattleRecordV510
import com.gbl.overlay.OverlayService.Companion.AiTelemetryManifest
import com.gbl.overlay.OverlayService.Companion.AiTelemetryManifestEntry
import com.gbl.overlay.OverlayService.Companion.AiTelemetryOppSlotSpec
import com.gbl.overlay.OverlayService.Companion.AiTelemetrySettingsChangeEvent
import com.gbl.overlay.OverlayService.Companion.AiTelemetrySlotSpec
import com.gbl.overlay.OverlayService.Companion.APP_VERSION
import com.gbl.overlay.OverlayService.Companion.APP_VERSION_CODE
import com.gbl.overlay.OverlayService.Companion.CLOUDFLARE_CLIENT_INGEST_KEY
import com.gbl.overlay.OverlayService.Companion.CLOUDFLARE_TELEMETRY_WORKER_URL
import com.gbl.overlay.OverlayService.Companion.DEFAULT_AUTO_UPLOAD_AI_LOGS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_USER_SCREEN_NAME
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_USER_SETTINGS_UPDATED_AT
import com.gbl.overlay.OverlayService.Companion.getRequiredScreenNameStatic
import com.gbl.overlay.OverlayService.Companion.BattleAnomalyRecord
import com.gbl.overlay.OverlayService.Companion.BattleSensorTick
import com.gbl.overlay.OverlayService.Companion.DEFAULT_ALT_FAST_DETECT_STRICTNESS
import com.gbl.overlay.OverlayService.Companion.DEFAULT_DEBOUNCE_TOLERANCE_PCT
import com.gbl.overlay.OverlayService.Companion.DEFAULT_ENABLE_ENERGY_TRACKING
import com.gbl.overlay.OverlayService.Companion.DEFAULT_ENABLE_HP_TRACKING
import com.gbl.overlay.OverlayService.Companion.DEFAULT_ENERGY_DEBOUNCE_SAMPLES
import com.gbl.overlay.OverlayService.Companion.DEFAULT_FAST_DETECT_TURN_OFFSET
import com.gbl.overlay.OverlayService.Companion.DEFAULT_HP_DEBOUNCE_SAMPLES
import com.gbl.overlay.OverlayService.Companion.DEFAULT_PROACTIVE_ENERGY_LEAD_MS
import com.gbl.overlay.OverlayService.Companion.DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
import com.gbl.overlay.OverlayService.Companion.DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
import com.gbl.overlay.OverlayService.Companion.EnergyLedgerEntry
import com.gbl.overlay.OverlayService.Companion.GITHUB_OAUTH_CLIENT_ID
import com.gbl.overlay.OverlayService.Companion.GitHubDeviceCodeResponse
import com.gbl.overlay.OverlayService.Companion.isAiTelemetryUploadInFlight
import com.gbl.overlay.OverlayService.Companion.MOVE_ENERGY_COST
import com.gbl.overlay.OverlayService.Companion.PostCutsceneHpAuditRecord
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_AI_TELEMETRY_V510_MIGRATED
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_AI_TRAINING_LOGS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_AUTO_UPLOAD_AI_LOGS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BATTLE_LOGS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_DEBOUNCE_TOLERANCE_PCT
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_DELETED_LOG_IDS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_DELETED_TEAM_IDS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_DEVICE_TELEMETRY_HASH
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_HP_DEBOUNCE_SAMPLES
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_MS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_STATUS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LAST_DEBOUNCE_SETTINGS_SNAPSHOT_V513
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LAST_DVR_UPLOAD_MS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_LAST_DVR_UPLOAD_PATH
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_PENDING_AI_TELEMETRY_V510
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_PENDING_SETTINGS_CHANGES_V513
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_PERSISTENT_TEAMS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SETTINGS_CHANGE_HISTORY_V513
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SYNC_GIST_ID
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SYNC_GITHUB_TOKEN
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SYNC_GITHUB_USERNAME
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BUILT_POKEMON_ROSTER
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_DELETED_BUILT_POKEMON_IDS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SYNC_LAST_AT
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT
import com.gbl.overlay.OverlayService.Companion.runV602ScannerDefaultsMigrationStatic
import com.gbl.overlay.OverlayService.Companion.SyncBattleLogRecord
import com.gbl.overlay.OverlayService.Companion.SyncTeamPresetRecord
import com.gbl.overlay.OverlayService.Companion.SyncVaultPayload

// =============================================================================
// GitHubCloudSync.kt - GitHub OAuth Device Flow, Gist/Repo Cloud Delta Sync,
// and AI Telemetry & 1-Battle DVR Auto-Upload Engine
// =============================================================================

internal fun OverlayService.Companion.deriveFirstSwapAndSwitchAdvantageStatic(
    events: List<BattleTimelineEvent>?,
    result: String
): Pair<String, String> {
    if (events.isNullOrEmpty()) return "NONE" to "NEUTRAL"
    val sorted = events.sortedBy { it.t }
    val firstSwap = sorted.firstOrNull {
        it.type.equals("SWAP", ignoreCase = true) &&
            it.lastPlayerSwitchWasFaint != true &&
            it.lastOppSwitchWasFaint != true
    }
    val firstActor = when {
        firstSwap == null -> "NONE"
        firstSwap.actor.equals("user", ignoreCase = true) -> "USER"
        firstSwap.actor.equals("opp", ignoreCase = true) -> "OPP"
        else -> "NONE"
    }
    val firstFaintAfterSwap = if (firstSwap != null) {
        sorted.firstOrNull { it.t >= firstSwap.t && it.type.equals("FAINT", ignoreCase = true) }
    } else {
        sorted.firstOrNull { it.type.equals("FAINT", ignoreCase = true) }
    }
    val switchAdv = when {
        firstFaintAfterSwap != null && firstFaintAfterSwap.actor.equals("opp", ignoreCase = true) -> "WON"
        firstFaintAfterSwap != null && firstFaintAfterSwap.actor.equals("user", ignoreCase = true) -> "LOST"
        firstActor == "OPP" && result.equals("WIN", ignoreCase = true) -> "WON"
        firstActor == "USER" && result.equals("LOSS", ignoreCase = true) -> "LOST"
        else -> "NEUTRAL"
    }
    return firstActor to switchAdv
}

internal fun OverlayService.Companion.reconcileSyncVaultPayloads(
    local: SyncVaultPayload,
    remote: SyncVaultPayload
): Triple<SyncVaultPayload, Int, Int> {
    val localLogMap = local.battleLogs.associateBy { it.id }
    val remoteLogMap = remote.battleLogs.associateBy { it.id }
    val localDeletedLogSet = local.deletedLogIds.toSet()
    val remoteDeletedLogSet = remote.deletedLogIds.toSet()

    // Allow restored items (present in active list, absent from that device's deletedIds, with newer updatedAt) to clear tombstones
    val allDeletedLogs = (localDeletedLogSet + remoteDeletedLogSet).filter { id ->
        val l = localLogMap[id]
        val r = remoteLogMap[id]
        val restoredLocally = l != null && id !in localDeletedLogSet && (l.updatedAt > remote.updatedAt || id !in remoteLogMap)
        val restoredRemotely = r != null && id !in remoteDeletedLogSet && (r.updatedAt > local.updatedAt && id !in localDeletedLogSet)
        !(restoredLocally || restoredRemotely)
    }.toSet()

    val localTeamMap = local.teamPresets.associateBy { it.id }
    val remoteTeamMap = remote.teamPresets.associateBy { it.id }
    val localDeletedTeamSet = local.deletedTeamIds.toSet()
    val remoteDeletedTeamSet = remote.deletedTeamIds.toSet()

    val allDeletedTeams = (localDeletedTeamSet + remoteDeletedTeamSet).filter { id ->
        val l = localTeamMap[id]
        val r = remoteTeamMap[id]
        val restoredLocally = l != null && id !in localDeletedTeamSet && (l.updatedAt > remote.updatedAt || id !in remoteTeamMap)
        val restoredRemotely = r != null && id !in remoteDeletedTeamSet && (r.updatedAt > local.updatedAt && id !in localDeletedTeamSet)
        !(restoredLocally || restoredRemotely)
    }.toSet()

    val localBuiltList = local.builtPokemon.orEmpty()
    val remoteBuiltList = remote.builtPokemon.orEmpty()
    val localBuiltMap = localBuiltList.associateBy { it.id }
    val remoteBuiltMap = remoteBuiltList.associateBy { it.id }
    val localDeletedBuiltSet = local.deletedBuiltPokemonIds.orEmpty().toSet()
    val remoteDeletedBuiltSet = remote.deletedBuiltPokemonIds.orEmpty().toSet()
    val allDeletedBuilt = (localDeletedBuiltSet + remoteDeletedBuiltSet).filter { id ->
        val l = localBuiltMap[id]
        val r = remoteBuiltMap[id]
        val restoredLocally = l != null && id !in localDeletedBuiltSet && (l.updatedAt > remote.updatedAt || id !in remoteBuiltMap)
        val restoredRemotely = r != null && id !in remoteDeletedBuiltSet && (r.updatedAt > local.updatedAt && id !in localDeletedBuiltSet)
        !(restoredLocally || restoredRemotely)
    }.toSet()
    val orderedBuiltIds = mutableListOf<String>()
    for (b in localBuiltList) {
        if (b.id.isNotBlank() && b.id !in allDeletedBuilt && !orderedBuiltIds.contains(b.id)) orderedBuiltIds.add(b.id)
    }
    for (b in remoteBuiltList) {
        if (b.id.isNotBlank() && b.id !in allDeletedBuilt && !orderedBuiltIds.contains(b.id)) orderedBuiltIds.add(b.id)
    }
    val mergedBuilt = orderedBuiltIds.mapNotNull { id ->
        val l = localBuiltMap[id]
        val r = remoteBuiltMap[id]
        when {
            l != null && r != null -> if (r.updatedAt > l.updatedAt) r else l
            r != null -> r
            else -> l
        }
    }.sortedByDescending { it.updatedAt }

    val allLogIds = (localLogMap.keys + remoteLogMap.keys) - allDeletedLogs
    var newOrUpdatedLogsFromRemote = 0

    val mergedLogs = allLogIds.mapNotNull { id ->
        val l = localLogMap[id]
        val r = remoteLogMap[id]
        when {
            l != null && r != null -> {
                val lUpd = if (l.updatedAt > 0L) l.updatedAt else l.timestampMs
                val rUpd = if (r.updatedAt > 0L) r.updatedAt else r.timestampMs
                if (rUpd > lUpd) {
                    newOrUpdatedLogsFromRemote++
                    r
                } else l
            }
            r != null -> {
                newOrUpdatedLogsFromRemote++
                r
            }
            else -> l
        }
    }.sortedByDescending { it.timestampMs }

    val orderedIds = mutableListOf<String>()
    for (t in local.teamPresets) {
        if (t.id !in allDeletedTeams && !orderedIds.contains(t.id)) orderedIds.add(t.id)
    }
    for (t in remote.teamPresets) {
        if (t.id !in allDeletedTeams && !orderedIds.contains(t.id)) orderedIds.add(t.id)
    }

    var newOrUpdatedTeamsFromRemote = 0
    val mergedTeams = orderedIds.mapNotNull { id ->
        val l = localTeamMap[id]
        val r = remoteTeamMap[id]
        when {
            l != null && r != null -> {
                val lUpd = if (l.updatedAt > 0L) l.updatedAt else 1L
                val rUpd = if (r.updatedAt > 0L) r.updatedAt else 1L
                if (rUpd > lUpd) {
                    newOrUpdatedTeamsFromRemote++
                    r
                } else l
            }
            r != null -> {
                newOrUpdatedTeamsFromRemote++
                r
            }
            else -> l
        }
    }

    val mergedSettingsUpdatedAt: Long
    val mergedSettings = LinkedHashMap<String, String>()
    if (remote.settingsUpdatedAt > local.settingsUpdatedAt && remote.userSettings.isNotEmpty()) {
        mergedSettingsUpdatedAt = remote.settingsUpdatedAt
        mergedSettings.putAll(local.userSettings)
        mergedSettings.putAll(remote.userSettings)
    } else {
        mergedSettingsUpdatedAt = max(local.settingsUpdatedAt, remote.settingsUpdatedAt)
        mergedSettings.putAll(remote.userSettings)
        mergedSettings.putAll(local.userSettings)
    }
    // Always preserve a non-blank synced Unlock Key / License if one side is empty (e.g. fresh 2nd device)
    for (sensitiveKey in listOf(
        "S:${OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY}",
        "S:${OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER}",
        "S:${OverlayService.PREFS_KEY_REPLAY_LICENSE_JSON}",
        "S:${OverlayService.PREFS_KEY_REPLAY_VAULT_MAP_JSON}"
    )) {
        val curVal = mergedSettings[sensitiveKey]?.trim().orEmpty()
        if (curVal.isEmpty()) {
            val remoteVal = remote.userSettings[sensitiveKey]?.trim().orEmpty()
            val localVal = local.userSettings[sensitiveKey]?.trim().orEmpty()
            val nonBlank = remoteVal.ifEmpty { localVal }
            if (nonBlank.isNotEmpty()) {
                mergedSettings[sensitiveKey] = nonBlank
            }
        }
    }

    val mergedPayload = SyncVaultPayload(
        schemaVersion = 3,
        updatedAt = System.currentTimeMillis(),
        battleLogs = mergedLogs,
        teamPresets = mergedTeams,
        deletedLogIds = allDeletedLogs.toList(),
        deletedTeamIds = allDeletedTeams.toList(),
        builtPokemon = mergedBuilt,
        deletedBuiltPokemonIds = allDeletedBuilt.toList(),
        userSettings = mergedSettings,
        settingsUpdatedAt = mergedSettingsUpdatedAt
    )
    return Triple(mergedPayload, newOrUpdatedLogsFromRemote, newOrUpdatedTeamsFromRemote)
}

private val SENSITIVE_VAULT_STRING_PREF_KEYS = setOf(
    OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY,
    OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER,
    OverlayService.PREFS_KEY_REPLAY_LICENSE_JSON,
    OverlayService.PREFS_KEY_REPLAY_VAULT_MAP_JSON
)

private const val VAULT_SECRET_ENC_PREFIX = "ENC_GCM_V1:"
private const val VAULT_PBKDF2_SALT_PREFIX = "SilphScopePvP_VaultSalt_v643_"

internal fun OverlayService.Companion.deriveGitHubAccountVaultAesKeyStatic(
    githubUserId: String,
    githubUsername: String
): javax.crypto.SecretKey {
    val cleanUser = githubUsername.trim().lowercase()
    val cleanId = githubUserId.trim().ifEmpty { cleanUser }
    val passChars = "sspvp_gh_vault|$cleanId|$cleanUser|9f8e7d6c5b4a".toCharArray()
    val saltBytes = "$VAULT_PBKDF2_SALT_PREFIX$cleanId:$cleanUser".toByteArray(Charsets.UTF_8)
    val factory = javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
    val spec = javax.crypto.spec.PBEKeySpec(passChars, saltBytes, 12000, 256)
    val secret = factory.generateSecret(spec)
    return javax.crypto.spec.SecretKeySpec(secret.encoded, "AES")
}

internal fun OverlayService.Companion.encryptVaultSecretForGitHubUserStatic(
    plaintext: String,
    githubUserId: String,
    githubUsername: String
): String {
    if (plaintext.isBlank() || githubUsername.isBlank()) return ""
    if (plaintext.startsWith(VAULT_SECRET_ENC_PREFIX)) return plaintext
    return try {
        val key = deriveGitHubAccountVaultAesKeyStatic(githubUserId, githubUsername)
        val iv = ByteArray(12)
        java.security.SecureRandom().nextBytes(iv)
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
        val aad = "SilphScopePvP-UnlockVault-v1|${githubUserId.trim().ifEmpty { githubUsername.trim().lowercase() }}|${githubUsername.trim().lowercase()}"
        cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
        val cipherBytes = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(iv.size + cipherBytes.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(cipherBytes, 0, combined, iv.size, cipherBytes.size)
        VAULT_SECRET_ENC_PREFIX + android.util.Base64.encodeToString(combined, android.util.Base64.NO_WRAP)
    } catch (_: Exception) {
        ""
    }
}

internal fun OverlayService.Companion.decryptVaultSecretForGitHubUserStatic(
    encoded: String,
    githubUserId: String,
    githubUsername: String
): String? {
    val trimmed = encoded.trim()
    if (trimmed.isEmpty()) return null
    if (!trimmed.startsWith(VAULT_SECRET_ENC_PREFIX)) {
        // Legacy plaintext fallback only if user is authenticated on GitHub
        return if (githubUsername.isNotBlank()) trimmed else null
    }
    if (githubUsername.isBlank()) return null
    val b64 = trimmed.removePrefix(VAULT_SECRET_ENC_PREFIX)
    val rawBytes = try {
        android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
    } catch (_: Exception) {
        return null
    }
    if (rawBytes.size <= 12) return null
    val iv = rawBytes.copyOfRange(0, 12)
    val cipherBytes = rawBytes.copyOfRange(12, rawBytes.size)
    // Try with exact (githubUserId, githubUsername) first, then fallback to (username, username) if ID was not yet cached when encrypted
    val candidateIds = listOf(githubUserId.trim(), githubUsername.trim().lowercase()).filter { it.isNotEmpty() }.distinct()
    for (candId in candidateIds) {
        try {
            val key = deriveGitHubAccountVaultAesKeyStatic(candId, githubUsername)
            val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, key, javax.crypto.spec.GCMParameterSpec(128, iv))
            val aad = "SilphScopePvP-UnlockVault-v1|$candId|${githubUsername.trim().lowercase()}"
            cipher.updateAAD(aad.toByteArray(Charsets.UTF_8))
            val plainBytes = cipher.doFinal(cipherBytes)
            return String(plainBytes, Charsets.UTF_8)
        } catch (_: Exception) {}
    }
    return null
}

private val SYNCABLE_STRING_PREF_KEYS = listOf(
    PREFS_KEY_USER_SCREEN_NAME,
    OverlayService.PREFS_KEY_APP_THEME_ID,
    OverlayService.PREFS_KEY_AI_ADVICE_HUD_POSITION,
    OverlayService.PREFS_KEY_CHARGE_CIRCLE_PRIORITY_MODE,
    OverlayService.PREFS_KEY_ALT_FAST_DETECT_STRICTNESS,
    OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY,
    OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER,
    OverlayService.PREFS_KEY_REPLAY_LICENSE_JSON,
    OverlayService.PREFS_KEY_REPLAY_VAULT_MAP_JSON,
    OverlayService.PREFS_KEY_DVR_RECORDING_MODE,
    OverlayService.PREFS_KEY_HAPTIC_CATCH_SENSITIVITY,
    OverlayService.PREFS_KEY_HAPTIC_INTENSITY,
    OverlayService.PREFS_KEY_OVERLAY_HUD_MODE,
    OverlayService.PREFS_KEY_COMPACT_HUD_TOOLBAR_MODE,
    "opp_count_mode",
    "app_combat_mode"
)

private val SYNCABLE_BOOLEAN_PREF_KEYS = listOf(
    OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES,
    OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS,
    OverlayService.PREFS_KEY_SHOW_TACTICAL_RECOMMENDATIONS,
    OverlayService.PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY,
    OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MATRIX,
    OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_OPP_ATTACKS,
    OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_MY_ATTACKS,
    OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_COACH,
    OverlayService.PREFS_KEY_COMPACT_HUD_SHOW_PACING,
    OverlayService.PREFS_KEY_ENABLE_HP_TRACKING,
    OverlayService.PREFS_KEY_ENABLE_ENERGY_TRACKING,
    OverlayService.PREFS_KEY_ENABLE_ALT_FAST_MOVE_DETECT,
    OverlayService.PREFS_KEY_VISION_BATTERY_SAVER,
    OverlayService.PREFS_KEY_SHOW_THEME_WATERMARK,
    OverlayService.PREFS_KEY_ENERGY_UPDATE_TOASTS,
    OverlayService.PREFS_KEY_HAPTIC_MASTER_ENABLED,
    OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_ENABLED,
    OverlayService.PREFS_KEY_HAPTIC_OPP_CHARGE_WARN_ENABLED,
    OverlayService.PREFS_KEY_HAPTIC_WARN_2F_ENABLED,
    OverlayService.PREFS_KEY_HAPTIC_CATCH_TRIPLE_ENABLED,
    OverlayService.PREFS_KEY_SHOW_ONE_BATTLE_DVR_BTN,
    OverlayService.PREFS_KEY_ALWAYS_ON_DVR_ENABLED,
    OverlayService.PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD,
    OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME,
    OverlayService.PREFS_KEY_REPLAY_EVER_PAID,
    PREFS_KEY_AUTO_UPLOAD_AI_LOGS
)

private val SYNCABLE_INT_PREF_KEYS = listOf(
    "overlay_scale_pct",
    OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT,
    OverlayService.PREFS_KEY_FAST_DETECT_TURN_OFFSET,
    OverlayService.PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES,
    OverlayService.PREFS_KEY_HP_DEBOUNCE_SAMPLES,
    OverlayService.PREFS_KEY_DEBOUNCE_TOLERANCE_PCT,
    OverlayService.PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS,
    OverlayService.PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS,
    OverlayService.PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT,
    OverlayService.PREFS_KEY_HAPTIC_OPP_SWAP_WARN_SEC,
    OverlayService.PREFS_KEY_HAPTIC_CHARGE_TIMING_FASTS,
    OverlayService.PREFS_KEY_GBL_META_LOG_WEIGHT_PCT,
    OverlayService.PREFS_KEY_SHOW6_META_LOG_WEIGHT_PCT,
    OverlayService.PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL,
    OverlayService.PREFS_KEY_LIMITED_STD_BLEND_PCT_SHOW6,
    OverlayService.PREFS_KEY_VIP_LOCAL_DVR_LIMIT
)

private val SYNCABLE_FLOAT_PREF_KEYS = listOf(
    OverlayService.PREFS_KEY_GBL_META_DECAY_FACTOR,
    OverlayService.PREFS_KEY_SHOW6_META_DECAY_FACTOR,
    OverlayService.PREFS_KEY_LIMITED_STD_DECAY_GBL,
    OverlayService.PREFS_KEY_LIMITED_STD_DECAY_SHOW6
)

internal fun OverlayService.Companion.exportSyncableSettingsMapStatic(
    prefs: SharedPreferences,
    isGitHubAuthenticatedSync: Boolean = false,
    githubUserId: String = "",
    githubUsername: String = ""
): Map<String, String> {
    val out = LinkedHashMap<String, String>()
    val canSyncSecrets = isGitHubAuthenticatedSync &&
        getEffectiveSyncToken(prefs).isNotEmpty() &&
        githubUsername.isNotBlank()
    for (k in SYNCABLE_STRING_PREF_KEYS) {
        if (k in SENSITIVE_VAULT_STRING_PREF_KEYS) {
            if (!canSyncSecrets) continue
            val rawSecret = if (k == OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY) {
                getEffectiveReplayUnlockKey(prefs)
            } else {
                prefs.getString(k, null)?.trim().orEmpty()
            }
            if (rawSecret.isNotEmpty()) {
                val enc = encryptVaultSecretForGitHubUserStatic(rawSecret, githubUserId, githubUsername)
                if (enc.isNotEmpty()) {
                    out["S:$k"] = enc
                }
            }
            continue
        }
        if (prefs.contains(k)) {
            prefs.getString(k, null)?.let { out["S:$k"] = it }
        }
    }
    for (k in SYNCABLE_BOOLEAN_PREF_KEYS) {
        if (prefs.contains(k)) {
            out["B:$k"] = prefs.getBoolean(k, false).toString()
        }
    }
    for (k in SYNCABLE_INT_PREF_KEYS) {
        if (prefs.contains(k)) {
            out["I:$k"] = prefs.getInt(k, 0).toString()
        }
    }
    for (k in SYNCABLE_FLOAT_PREF_KEYS) {
        if (prefs.contains(k)) {
            out["F:$k"] = prefs.getFloat(k, 0f).toString()
        }
    }
    return out
}

internal fun OverlayService.Companion.applySyncedSettingsMapStatic(
    prefs: SharedPreferences,
    settingsMap: Map<String, String>,
    settingsUpdatedAt: Long,
    githubUserId: String = "",
    githubUsername: String = ""
) {
    if (settingsMap.isEmpty()) return
    val isGitHubLoggedIn = getEffectiveSyncToken(prefs).isNotEmpty() && githubUsername.isNotBlank()
    val editor = prefs.edit()
    for ((typedKey, rawVal) in settingsMap) {
        val sepIdx = typedKey.indexOf(':')
        if (sepIdx <= 0) continue
        val prefix = typedKey.substring(0, sepIdx)
        val key = typedKey.substring(sepIdx + 1)
        when (prefix) {
            "S" -> {
                if (key in SENSITIVE_VAULT_STRING_PREF_KEYS) {
                    if (!isGitHubLoggedIn) continue
                    val decrypted = decryptVaultSecretForGitHubUserStatic(rawVal, githubUserId, githubUsername)
                    if (!decrypted.isNullOrBlank()) {
                        if (key == OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY) {
                            editor.putString(key, encryptSecretWithKeystore(decrypted))
                        } else {
                            editor.putString(key, decrypted)
                        }
                    }
                } else if (key == PREFS_KEY_USER_SCREEN_NAME) {
                    val clean = OverlayService.sanitizeScreenNameStatic(rawVal)
                    if (clean.isNotEmpty()) editor.putString(key, clean)
                } else {
                    editor.putString(key, rawVal)
                }
            }
            "B" -> rawVal.toBooleanStrictOrNull()?.let { editor.putBoolean(key, it) }
            "I" -> rawVal.toIntOrNull()?.let { editor.putInt(key, it) }
            "F" -> rawVal.toFloatOrNull()?.let { editor.putFloat(key, it) }
        }
    }
    if (settingsUpdatedAt > 0L) {
        editor.putLong(PREFS_KEY_USER_SETTINGS_UPDATED_AT, settingsUpdatedAt)
    }
    editor.apply()
    OverlayService.syncTierThresholdsFromPrefs(prefs)
}

internal fun OverlayService.Companion.buildLocalSyncVaultPayload(
    prefs: SharedPreferences,
    gson: Gson,
    isGitHubAuthenticatedSync: Boolean = false,
    githubUserId: String = "",
    githubUsername: String = ""
): SyncVaultPayload {
    val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
    val teamsType = object : TypeToken<List<SyncTeamPresetRecord>>() {}.type
    val strListType = object : TypeToken<List<String>>() {}.type

    val logs: List<SyncBattleLogRecord> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_BATTLE_LOGS, "[]"), logsType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val teams: List<SyncTeamPresetRecord> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_PERSISTENT_TEAMS, "[]"), teamsType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val builtType = object : TypeToken<List<BuiltPokemonEntry>>() {}.type
    val builtPokemon: List<BuiltPokemonEntry> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_BUILT_POKEMON_ROSTER, "[]"), builtType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val delLogs: List<String> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_DELETED_LOG_IDS, "[]"), strListType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val delTeams: List<String> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_DELETED_TEAM_IDS, "[]"), strListType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val delBuiltPokemon: List<String> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_DELETED_BUILT_POKEMON_IDS, "[]"), strListType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val settingsMap = exportSyncableSettingsMapStatic(
        prefs = prefs,
        isGitHubAuthenticatedSync = isGitHubAuthenticatedSync,
        githubUserId = githubUserId,
        githubUsername = githubUsername
    )
    val settingsUpdAt = prefs.getLong(PREFS_KEY_USER_SETTINGS_UPDATED_AT, 0L)

    return SyncVaultPayload(
        schemaVersion = 3,
        updatedAt = System.currentTimeMillis(),
        battleLogs = logs,
        teamPresets = teams,
        deletedLogIds = delLogs,
        deletedTeamIds = delTeams,
        builtPokemon = builtPokemon,
        deletedBuiltPokemonIds = delBuiltPokemon,
        userSettings = settingsMap,
        settingsUpdatedAt = settingsUpdAt
    )
}

internal fun OverlayService.Companion.saveReconciledSyncVaultLocally(
    prefs: SharedPreferences,
    gson: Gson,
    payload: SyncVaultPayload,
    githubUserId: String = "",
    githubUsername: String = ""
) {
    val editor = prefs.edit()
        .putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(payload.battleLogs))
        .putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(payload.deletedLogIds))
        .putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(payload.deletedTeamIds))
        .putLong(PREFS_KEY_SYNC_LAST_AT, System.currentTimeMillis())
    if (payload.teamPresets.isNotEmpty()) {
        editor.putString(PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(payload.teamPresets))
    }
    if (payload.builtPokemon != null) {
        editor.putString(PREFS_KEY_BUILT_POKEMON_ROSTER, gson.toJson(payload.builtPokemon))
    }
    if (payload.deletedBuiltPokemonIds != null) {
        editor.putString(PREFS_KEY_DELETED_BUILT_POKEMON_IDS, gson.toJson(payload.deletedBuiltPokemonIds))
    }
    editor.apply()
    if (payload.userSettings.isNotEmpty()) {
        applySyncedSettingsMapStatic(prefs, payload.userSettings, payload.settingsUpdatedAt, githubUserId, githubUsername)
    }
}

private const val KEYSTORE_SECRET_ENC_PREFIX = "KS_GCM_V1:"
private const val ANDROID_KEYSTORE_ALIAS = "silphscope_keystore_aes_gcm_v1"

private fun getOrCreateAndroidKeystoreAesKey(): javax.crypto.SecretKey? {
    return try {
        val ks = java.security.KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = ks.getEntry(ANDROID_KEYSTORE_ALIAS, null) as? java.security.KeyStore.SecretKeyEntry
        if (existing != null) return existing.secretKey
        val keyGenerator = javax.crypto.KeyGenerator.getInstance(
            android.security.keystore.KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        )
        val spec = android.security.keystore.KeyGenParameterSpec.Builder(
            ANDROID_KEYSTORE_ALIAS,
            android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
        keyGenerator.init(spec)
        keyGenerator.generateKey()
    } catch (_: Exception) {
        null
    }
}

internal fun OverlayService.Companion.encryptSecretWithKeystore(plaintext: String): String {
    val clean = plaintext.trim()
    if (clean.isEmpty()) return ""
    if (clean.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) return clean
    return try {
        val secretKey = getOrCreateAndroidKeystoreAesKey() ?: return clean
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE, secretKey)
        val iv = cipher.iv
        val cipherBytes = cipher.doFinal(clean.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(1 + iv.size + cipherBytes.size)
        combined[0] = iv.size.toByte()
        System.arraycopy(iv, 0, combined, 1, iv.size)
        System.arraycopy(cipherBytes, 0, combined, 1 + iv.size, cipherBytes.size)
        KEYSTORE_SECRET_ENC_PREFIX + android.util.Base64.encodeToString(combined, android.util.Base64.NO_WRAP)
    } catch (_: Exception) {
        clean
    }
}

internal fun OverlayService.Companion.decryptSecretWithKeystore(stored: String?): String {
    val raw = stored?.trim().orEmpty()
    if (raw.isEmpty()) return ""
    if (!raw.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) return raw
    return try {
        val b64 = raw.removePrefix(KEYSTORE_SECRET_ENC_PREFIX)
        val combined = android.util.Base64.decode(b64, android.util.Base64.DEFAULT)
        if (combined.size <= 13) return ""
        val ivLen = combined[0].toInt() and 0xFF
        if (ivLen !in 12..16 || combined.size <= 1 + ivLen) return ""
        val iv = combined.copyOfRange(1, 1 + ivLen)
        val cipherBytes = combined.copyOfRange(1 + ivLen, combined.size)
        val secretKey = getOrCreateAndroidKeystoreAesKey() ?: return ""
        val cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(javax.crypto.Cipher.DECRYPT_MODE, secretKey, javax.crypto.spec.GCMParameterSpec(128, iv))
        String(cipher.doFinal(cipherBytes), Charsets.UTF_8).trim()
    } catch (_: Exception) {
        ""
    }
}

internal fun OverlayService.Companion.getEffectiveSyncToken(prefs: SharedPreferences): String {
    val raw = prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "")?.trim().orEmpty()
    if (raw.isEmpty()) return ""
    if (!raw.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
        val encrypted = encryptSecretWithKeystore(raw)
        if (encrypted.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
            prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_TOKEN, encrypted).apply()
        }
        return raw
    }
    return decryptSecretWithKeystore(raw)
}

internal fun OverlayService.Companion.setEffectiveSyncToken(prefs: SharedPreferences, token: String) {
    val clean = token.trim()
    if (clean.isEmpty()) {
        prefs.edit().remove(PREFS_KEY_SYNC_GITHUB_TOKEN).apply()
    } else {
        prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_TOKEN, encryptSecretWithKeystore(clean)).apply()
    }
}

internal fun OverlayService.Companion.getEffectiveReplayUnlockKey(prefs: SharedPreferences): String {
    val raw = prefs.getString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, "")?.trim().orEmpty()
    if (raw.isEmpty()) return ""
    if (!raw.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
        val encrypted = encryptSecretWithKeystore(raw)
        if (encrypted.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
            prefs.edit().putString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, encrypted).apply()
        }
        return raw
    }
    return decryptSecretWithKeystore(raw)
}

internal fun OverlayService.Companion.setEffectiveReplayUnlockKey(prefs: SharedPreferences, key: String) {
    val clean = key.trim()
    if (clean.isEmpty()) {
        prefs.edit().remove(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY).apply()
    } else {
        prefs.edit().putString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, encryptSecretWithKeystore(clean)).apply()
    }
}

internal fun OverlayService.Companion.getDeviceIngestTokenStatic(prefs: SharedPreferences): String {
    val raw = prefs.getString(OverlayService.PREFS_KEY_DEVICE_INGEST_TOKEN, "")?.trim().orEmpty()
    if (raw.isEmpty()) return ""
    return decryptSecretWithKeystore(raw)
}

internal fun OverlayService.Companion.setDeviceIngestTokenStatic(prefs: SharedPreferences, token: String) {
    val clean = token.trim()
    if (clean.isNotEmpty()) {
        prefs.edit().putString(OverlayService.PREFS_KEY_DEVICE_INGEST_TOKEN, encryptSecretWithKeystore(clean)).apply()
    }
}

internal fun OverlayService.Companion.getVaultSessionTokenStatic(prefs: SharedPreferences): String {
    val raw = prefs.getString(OverlayService.PREFS_KEY_VAULT_SESSION_TOKEN, "")?.trim().orEmpty()
    if (raw.isEmpty()) return ""
    if (!raw.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
        val encrypted = encryptSecretWithKeystore(raw)
        if (encrypted.startsWith(KEYSTORE_SECRET_ENC_PREFIX)) {
            prefs.edit().putString(OverlayService.PREFS_KEY_VAULT_SESSION_TOKEN, encrypted).apply()
        }
        return raw
    }
    return decryptSecretWithKeystore(raw)
}

internal fun OverlayService.Companion.setVaultSessionTokenStatic(prefs: SharedPreferences, token: String) {
    val clean = token.trim()
    if (clean.isEmpty()) {
        prefs.edit().remove(OverlayService.PREFS_KEY_VAULT_SESSION_TOKEN).apply()
    } else {
        prefs.edit().putString(OverlayService.PREFS_KEY_VAULT_SESSION_TOKEN, encryptSecretWithKeystore(clean)).apply()
    }
}

internal fun OverlayService.Companion.applyWorkerClientAuthHeaders(
    builder: Request.Builder,
    prefs: SharedPreferences,
    screenName: String,
    deviceHash: String = getDeviceTelemetryHashStatic(prefs)
): Request.Builder {
    builder.header("X-SilphScope-Client-Key", CLOUDFLARE_CLIENT_INGEST_KEY)
    builder.header("X-Trainer-Screen-Name", screenName)
    if (deviceHash.isNotBlank()) {
        builder.header("X-Device-Hash", deviceHash)
    }
    val devToken = getDeviceIngestTokenStatic(prefs)
    if (devToken.isNotBlank()) {
        builder.header("X-Device-Ingest-Token", devToken)
    }
    val vaultSession = getVaultSessionTokenStatic(prefs)
    if (vaultSession.isNotBlank()) {
        builder.header("X-Vault-Session", vaultSession)
    }
    return builder
}

/**
 * Strictly read-only one-time helper to pull any un-migrated records from a legacy
 * `<username>/silphscope-private-vault` repo or Secret Gist before permanently retiring GitHub sync.
 * Performs ZERO writes/creates/patches/deletes on GitHub.
 */
private fun pullLegacyGitHubVaultReadOnlyOnce(
    prefs: SharedPreferences,
    gson: Gson,
    token: String
) {
    if (token.isBlank()) return
    val httpClient = OkHttpClient.Builder()
        .connectTimeout(15L, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(25L, java.util.concurrent.TimeUnit.SECONDS)
        .build()
    val fileName = "battlematrix_gbl_sync_vault.json"
    val privateRepoName = "silphscope-private-vault"

    var username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
    var githubUserId = prefs.getString(OverlayService.PREFS_KEY_SYNC_GITHUB_USER_ID, "")?.trim().orEmpty()
    if (username.isEmpty() || githubUserId.isEmpty()) {
        try {
            val req = Request.Builder()
                .url("https://api.github.com/user")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    val json = JsonParser.parseString(resp.body?.string().orEmpty()).asJsonObject
                    username = json.get("login")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                    githubUserId = json.get("id")?.takeIf { !it.isJsonNull }?.asLong?.toString().orEmpty()
                }
            }
        } catch (_: Exception) {}
    }
    if (username.isEmpty()) return

    var remotePayload: SyncVaultPayload? = null
    try {
        val getReq = Request.Builder()
            .url("https://api.github.com/repos/$username/$privateRepoName/contents/$fileName")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .build()
        httpClient.newCall(getReq).execute().use { resp ->
            if (resp.isSuccessful) {
                val root = JsonParser.parseString(resp.body?.string().orEmpty()).asJsonObject
                val sha = root.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val contentB64 = root.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                if (contentB64.isNotBlank()) {
                    val decoded = android.util.Base64.decode(contentB64.replace("\n", "").replace("\r", ""), android.util.Base64.DEFAULT)
                    remotePayload = try { gson.fromJson(String(decoded, Charsets.UTF_8), SyncVaultPayload::class.java) } catch (_: Exception) { null }
                } else if (sha.isNotBlank()) {
                    val blobReq = Request.Builder()
                        .url("https://api.github.com/repos/$username/$privateRepoName/git/blobs/$sha")
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    httpClient.newCall(blobReq).execute().use { blobResp ->
                        if (blobResp.isSuccessful) {
                            val blobRoot = JsonParser.parseString(blobResp.body?.string().orEmpty()).asJsonObject
                            val blobB64 = blobRoot.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                            if (blobB64.isNotBlank()) {
                                val decoded = android.util.Base64.decode(blobB64.replace("\n", "").replace("\r", ""), android.util.Base64.DEFAULT)
                                remotePayload = try { gson.fromJson(String(decoded, Charsets.UTF_8), SyncVaultPayload::class.java) } catch (_: Exception) { null }
                            }
                        }
                    }
                }
            }
        }
    } catch (_: Exception) {}

    if (remotePayload == null) {
        val customGistId = prefs.getString(PREFS_KEY_SYNC_GIST_ID, "")?.trim().orEmpty()
        var gistId = if (customGistId.equals("sync-vault", ignoreCase = true)) "" else customGistId
        if (gistId.isEmpty()) {
            try {
                val listReq = Request.Builder()
                    .url("https://api.github.com/gists?per_page=100")
                    .header("Authorization", "Bearer $token")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(listReq).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val arr = JsonParser.parseString(resp.body?.string().orEmpty()).asJsonArray
                        for (el in arr) {
                            val obj = el.asJsonObject
                            val filesObj = obj.getAsJsonObject("files")
                            if (filesObj != null && filesObj.has(fileName)) {
                                gistId = obj.get("id")?.asString.orEmpty()
                                break
                            }
                        }
                    }
                }
            } catch (_: Exception) {}
        }
        if (gistId.isNotEmpty()) {
            try {
                val getGistReq = Request.Builder()
                    .url("https://api.github.com/gists/$gistId")
                    .header("Authorization", "Bearer $token")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(getGistReq).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val root = JsonParser.parseString(resp.body?.string().orEmpty()).asJsonObject
                        val contentStr = root.getAsJsonObject("files")?.getAsJsonObject(fileName)?.get("content")?.asString
                        if (!contentStr.isNullOrBlank()) {
                            remotePayload = try { gson.fromJson(contentStr, SyncVaultPayload::class.java) } catch (_: Exception) { null }
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    if (remotePayload != null) {
        val curLocal = OverlayService.buildLocalSyncVaultPayload(prefs, gson, true, githubUserId, username)
        val (merged, _, _) = OverlayService.reconcileSyncVaultPayloads(curLocal, remotePayload!!)
        OverlayService.saveReconciledSyncVaultLocally(prefs, gson, merged, githubUserId, username)
    }
}

private data class AppliedVaultDeltaStats(
    val totalLogs: Int,
    val totalTeams: Int,
    val totalBuiltPokemon: Int,
    val newOrUpdatedLogs: Int,
    val newOrUpdatedTeams: Int,
    val newOrUpdatedBuiltPokemon: Int,
    val deletedLogIdsList: List<String>,
    val deletedTeamIdsList: List<String>,
    val deletedBuiltPokemonIdsList: List<String>,
    val mutatedLocally: Boolean
)

@Volatile
internal var lastCloudVaultSyncMutatedLocally: Boolean = false

private fun applyCloudflareVaultDeltasLocally(
    prefs: SharedPreferences,
    gson: Gson,
    localPayload: SyncVaultPayload,
    remoteUpsertedLogs: List<SyncBattleLogRecord>,
    remoteDeletedLogIds: List<String>,
    remoteUpsertedTeams: List<SyncTeamPresetRecord>,
    remoteDeletedTeamIds: List<String>,
    remoteUpsertedBuiltPokemon: List<BuiltPokemonEntry> = emptyList(),
    remoteDeletedBuiltPokemonIds: List<String> = emptyList(),
    remoteSettings: Map<String, String>?,
    remoteSettingsUpdatedAt: Long
): AppliedVaultDeltaStats {
    val localDelLogs = localPayload.deletedLogIds.toMutableSet()
    val localDelTeams = localPayload.deletedTeamIds.toMutableSet()
    val localDelBuilt = localPayload.deletedBuiltPokemonIds.orEmpty().toMutableSet()
    val localBuiltList = localPayload.builtPokemon.orEmpty()

    var newOrUpdatedLogs = 0
    var logsMutated = false
    var delLogsMutated = false
    val finalLogsCount: Int

    if (remoteUpsertedLogs.isEmpty() && remoteDeletedLogIds.isEmpty()) {
        finalLogsCount = localPayload.battleLogs.count { it.id.isNotBlank() && it.id !in localDelLogs }
    } else {
        val logMap = LinkedHashMap<String, SyncBattleLogRecord>(localPayload.battleLogs.size + remoteUpsertedLogs.size)
        for (l in localPayload.battleLogs) {
            if (l.id.isNotBlank() && l.id !in localDelLogs) {
                logMap[l.id] = l
            }
        }
        for (delId in remoteDeletedLogIds) {
            if (delId.isNotBlank()) {
                if (localDelLogs.add(delId)) delLogsMutated = true
                if (logMap.remove(delId) != null) logsMutated = true
            }
        }
        for (r in remoteUpsertedLogs) {
            if (r.id.isBlank()) continue
            if (localDelLogs.remove(r.id)) delLogsMutated = true
            val existing = logMap[r.id]
            if (existing == null) {
                logMap[r.id] = r
                newOrUpdatedLogs++
                logsMutated = true
            } else {
                val lUpd = if (existing.updatedAt > 0L) existing.updatedAt else existing.timestampMs
                val rUpd = if (r.updatedAt > 0L) r.updatedAt else r.timestampMs
                if (rUpd > lUpd) {
                    logMap[r.id] = r
                    newOrUpdatedLogs++
                    logsMutated = true
                }
            }
        }
        if (logsMutated) {
            val mergedLogs = logMap.values.sortedByDescending { it.timestampMs }
            finalLogsCount = mergedLogs.size
            prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(mergedLogs)).apply()
        } else {
            finalLogsCount = logMap.size
        }
    }

    var newOrUpdatedTeams = 0
    var teamsMutated = false
    var delTeamsMutated = false
    val finalTeamsCount: Int

    if (remoteUpsertedTeams.isEmpty() && remoteDeletedTeamIds.isEmpty()) {
        finalTeamsCount = localPayload.teamPresets.count { it.id.isNotBlank() && it.id !in localDelTeams }
    } else {
        val teamMap = LinkedHashMap<String, SyncTeamPresetRecord>(localPayload.teamPresets.size + remoteUpsertedTeams.size)
        for (t in localPayload.teamPresets) {
            if (t.id.isNotBlank() && t.id !in localDelTeams) {
                teamMap[t.id] = t
            }
        }
        for (delTid in remoteDeletedTeamIds) {
            if (delTid.isNotBlank()) {
                if (localDelTeams.add(delTid)) delTeamsMutated = true
                if (teamMap.remove(delTid) != null) teamsMutated = true
            }
        }
        for (r in remoteUpsertedTeams) {
            if (r.id.isBlank()) continue
            if (localDelTeams.remove(r.id)) delTeamsMutated = true
            val existing = teamMap[r.id]
            if (existing == null) {
                teamMap[r.id] = r
                newOrUpdatedTeams++
                teamsMutated = true
            } else {
                val lUpd = if (existing.updatedAt > 0L) existing.updatedAt else 1L
                val rUpd = if (r.updatedAt > 0L) r.updatedAt else 1L
                if (rUpd > lUpd) {
                    teamMap[r.id] = r
                    newOrUpdatedTeams++
                    teamsMutated = true
                }
            }
        }
        val mergedTeams = teamMap.values.toList()
        finalTeamsCount = mergedTeams.size
        if (teamsMutated && mergedTeams.isNotEmpty()) {
            prefs.edit().putString(PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(mergedTeams)).apply()
        }
    }

    var newOrUpdatedBuilt = 0
    var builtMutated = false
    var delBuiltMutated = false
    val finalBuiltCount: Int

    if (remoteUpsertedBuiltPokemon.isEmpty() && remoteDeletedBuiltPokemonIds.isEmpty()) {
        finalBuiltCount = localBuiltList.count { it.id.isNotBlank() && it.id !in localDelBuilt }
    } else {
        val builtMap = LinkedHashMap<String, BuiltPokemonEntry>(localBuiltList.size + remoteUpsertedBuiltPokemon.size)
        for (b in localBuiltList) {
            if (b.id.isNotBlank() && b.id !in localDelBuilt) {
                builtMap[b.id] = b
            }
        }
        for (delBid in remoteDeletedBuiltPokemonIds) {
            if (delBid.isNotBlank()) {
                if (localDelBuilt.add(delBid)) delBuiltMutated = true
                if (builtMap.remove(delBid) != null) builtMutated = true
            }
        }
        for (r in remoteUpsertedBuiltPokemon) {
            if (r.id.isBlank()) continue
            if (localDelBuilt.remove(r.id)) delBuiltMutated = true
            val existing = builtMap[r.id]
            if (existing == null) {
                builtMap[r.id] = r
                newOrUpdatedBuilt++
                builtMutated = true
            } else {
                val lUpd = if (existing.updatedAt > 0L) existing.updatedAt else 1L
                val rUpd = if (r.updatedAt > 0L) r.updatedAt else 1L
                if (rUpd > lUpd) {
                    builtMap[r.id] = r
                    newOrUpdatedBuilt++
                    builtMutated = true
                }
            }
        }
        val mergedBuilt = builtMap.values.sortedByDescending { it.updatedAt }
        finalBuiltCount = mergedBuilt.size
        if (builtMutated) {
            prefs.edit().putString(PREFS_KEY_BUILT_POKEMON_ROSTER, gson.toJson(mergedBuilt)).apply()
        }
    }

    val delLogsList = if (delLogsMutated) localDelLogs.toList() else localPayload.deletedLogIds
    val delTeamsList = if (delTeamsMutated) localDelTeams.toList() else localPayload.deletedTeamIds
    val delBuiltList = if (delBuiltMutated) localDelBuilt.toList() else localPayload.deletedBuiltPokemonIds.orEmpty()

    if (delLogsMutated || delTeamsMutated || delBuiltMutated) {
        val tombEditor = prefs.edit()
        if (delLogsMutated) tombEditor.putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(delLogsList))
        if (delTeamsMutated) tombEditor.putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(delTeamsList))
        if (delBuiltMutated) tombEditor.putString(PREFS_KEY_DELETED_BUILT_POKEMON_IDS, gson.toJson(delBuiltList))
        tombEditor.apply()
    }

    var settingsMutated = false
    val localSettingsUpdAt = prefs.getLong(PREFS_KEY_USER_SETTINGS_UPDATED_AT, 0L)
    if (!remoteSettings.isNullOrEmpty() && (localSettingsUpdAt == 0L || remoteSettingsUpdatedAt > localSettingsUpdAt)) {
        OverlayService.applySyncedSettingsMapStatic(prefs, remoteSettings, remoteSettingsUpdatedAt)
        settingsMutated = true
    }

    return AppliedVaultDeltaStats(
        totalLogs = finalLogsCount,
        totalTeams = finalTeamsCount,
        totalBuiltPokemon = finalBuiltCount,
        newOrUpdatedLogs = newOrUpdatedLogs,
        newOrUpdatedTeams = newOrUpdatedTeams,
        newOrUpdatedBuiltPokemon = newOrUpdatedBuilt,
        deletedLogIdsList = delLogsList,
        deletedTeamIdsList = delTeamsList,
        deletedBuiltPokemonIdsList = delBuiltList,
        mutatedLocally = logsMutated || teamsMutated || builtMutated || settingsMutated
    )
}

internal fun OverlayService.Companion.syncWithCloudflareVaultBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    forceFullPull: Boolean = false,
    forceFullPush: Boolean = false
): Pair<Boolean, String> {
    lastCloudVaultSyncMutatedLocally = false
    val rawName = getRequiredScreenNameStatic(prefs)
    val safeUser = sanitizeScreenNameStatic(rawName)
    if (!isValidScreenNameStatic(safeUser)) {
        return false to "Choose a Trainer ID in Settings first to enable SilphScope Cloud Vault sync."
    }

    val alreadyMigrated = prefs.getBoolean(OverlayService.PREFS_KEY_D1_VAULT_MIGRATED_V731, false)
    val legacyGhToken = getEffectiveSyncToken(prefs)

    // One-time passwordless read-only pull from legacy GitHub vault before permanently retiring GitHub sync
    if (!alreadyMigrated && legacyGhToken.isNotEmpty()) {
        try {
            pullLegacyGitHubVaultReadOnlyOnce(prefs, gson, legacyGhToken)
        } catch (_: Exception) {}
    }

    val isInitialMigration = !alreadyMigrated
    val localPayload = buildLocalSyncVaultPayload(prefs, gson, isGitHubAuthenticatedSync = false)
    val savedCursorMs = prefs.getLong(OverlayService.PREFS_KEY_CLOUD_SYNC_CURSOR_MS, 0L)
    // Auto-recover full history from Cloud if local battle logs were cleared while a cursor was cached
    val cursorMs = if (isInitialMigration || forceFullPull || (localPayload.battleLogs.isEmpty() && savedCursorMs > 0L)) {
        0L
    } else {
        savedCursorMs
    }
    val lastPushedMs = if (isInitialMigration || forceFullPush) 0L else prefs.getLong(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_MS, 0L)
    val lastPushedSettingsMs = if (isInitialMigration || forceFullPush) 0L else prefs.getLong(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_SETTINGS_MS, 0L)

    val tombstonesSig = (
        localPayload.deletedLogIds.sorted().joinToString(",") + "|" +
            localPayload.deletedTeamIds.sorted().joinToString(",") + "|" +
            localPayload.deletedBuiltPokemonIds.orEmpty().sorted().joinToString(",")
        ).hashCode().toString()
    val prevTombstonesSig = prefs.getString(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_TOMBSTONES_SIG, "") ?: ""
    val tombstonesChanged = isInitialMigration || forceFullPush ||
        (
            tombstonesSig != prevTombstonesSig && (
                localPayload.deletedLogIds.isNotEmpty() ||
                    localPayload.deletedTeamIds.isNotEmpty() ||
                    !localPayload.deletedBuiltPokemonIds.isNullOrEmpty()
                )
            )

    val logsToPush = if (isInitialMigration || forceFullPush) {
        localPayload.battleLogs
    } else {
        localPayload.battleLogs.filter { max(it.updatedAt, it.timestampMs) > lastPushedMs }
    }
    val teamsToPush = if (isInitialMigration || forceFullPush) {
        localPayload.teamPresets
    } else {
        localPayload.teamPresets.filter { it.updatedAt > lastPushedMs }
    }
    val builtListLocal = localPayload.builtPokemon.orEmpty()
    val builtToPush = if (isInitialMigration || forceFullPush) {
        builtListLocal
    } else {
        builtListLocal.filter { it.updatedAt > lastPushedMs }
    }
    val delLogsToPush = if (tombstonesChanged) localPayload.deletedLogIds else emptyList()
    val delTeamsToPush = if (tombstonesChanged) localPayload.deletedTeamIds else emptyList()
    val delBuiltToPush = if (tombstonesChanged) localPayload.deletedBuiltPokemonIds.orEmpty() else emptyList()
    val shouldPushSettings = isInitialMigration || forceFullPush ||
        (localPayload.settingsUpdatedAt > lastPushedSettingsMs && localPayload.userSettings.isNotEmpty())

    val pushStartedAtMs = System.currentTimeMillis()
    val devHash = getDeviceTelemetryHashStatic(prefs)
    val unlockKey = getEffectiveReplayUnlockKey(prefs)
    val vaultSession = getVaultSessionTokenStatic(prefs)
    val httpClient = buildTelemetryHttpClientStatic(15L, 30L, 25L)

    return try {
        val reqMap = LinkedHashMap<String, Any?>()
        reqMap["screenName"] = safeUser
        reqMap["deviceHash"] = devHash
        if (unlockKey.isNotBlank()) reqMap["unlockKey"] = unlockKey
        if (vaultSession.isNotBlank()) reqMap["sessionToken"] = vaultSession
        reqMap["sinceServerMs"] = cursorMs
        reqMap["isInitialMigration"] = isInitialMigration
        reqMap["migratedFromGithub"] = isInitialMigration && legacyGhToken.isNotEmpty()
        reqMap["battleLogs"] = logsToPush
        reqMap["teamPresets"] = teamsToPush
        reqMap["builtPokemon"] = builtToPush
        reqMap["deletedLogIds"] = delLogsToPush
        reqMap["deletedTeamIds"] = delTeamsToPush
        reqMap["deletedBuiltPokemonIds"] = delBuiltToPush
        if (shouldPushSettings) {
            reqMap["userSettings"] = localPayload.userSettings
            reqMap["settingsUpdatedAt"] = max(localPayload.settingsUpdatedAt, 1L)
        }

        val reqBody = gson.toJson(reqMap)
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val reqBuilder = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/sync/vault")
                .post(reqBody),
            prefs,
            safeUser,
            devHash
        )
        if (unlockKey.isNotBlank()) {
            reqBuilder.header("X-SilphScope-Unlock-Key", unlockKey)
        }
        val req = reqBuilder.build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            val root = try { JsonParser.parseString(bodyStr).asJsonObject } catch (_: Exception) { null }
            val ok = resp.isSuccessful && (root?.get("ok")?.asBoolean == true)
            if (!ok) {
                val hasPw = root?.get("hasPassword")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
                val reqPw = root?.get("requiresPassword")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
                if (reqPw || hasPw) {
                    prefs.edit()
                        .putBoolean(OverlayService.PREFS_KEY_VAULT_HAS_PASSWORD, hasPw || reqPw)
                        .putBoolean(OverlayService.PREFS_KEY_VAULT_REQUIRES_PASSWORD, reqPw)
                        .apply()
                }
                val err = root?.get("error")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                if (reqPw) {
                    return false to "🔑 Vault @$safeUser is password-protected. Tap '🔑 Sign In with Vault Password' in Settings to sync."
                }
                return false to (err.ifBlank { "Cloud sync error (HTTP ${resp.code})" })
            }

            val rObj = root!!
            val devToken = rObj.get("deviceIngestToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (devToken.isNotBlank()) {
                setDeviceIngestTokenStatic(prefs, devToken)
            }
            val retSession = rObj.get("sessionToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (retSession.isNotBlank()) {
                setVaultSessionTokenStatic(prefs, retSession)
            }
            val hasPassword = rObj.get("hasPassword")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
            val serverSyncMs = rObj.get("serverSyncMs")?.takeIf { !it.isJsonNull }?.asLong ?: 0L

            // Sync down verified membership tier & Unlock Key if active/everPaid on server
            val rawTier = rObj.get("tier")?.takeIf { !it.isJsonNull }?.asString?.lowercase() ?: "free"
            val normTier = if (rawTier == "base") "supporter" else rawTier
            val active = rObj.get("active")?.takeIf { !it.isJsonNull }?.asBoolean ?: false
            val everPaid = rObj.get("everPaid")?.takeIf { !it.isJsonNull }?.asBoolean ?: (active && normTier != "free")
            if (active || everPaid) {
                val sig = rObj.get("signature")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val licObj = rObj.get("license")?.takeIf { it.isJsonObject }?.asJsonObject
                val resolvedKey = licObj?.get("key")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val expiresAt = licObj?.get("expiresAt")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val licEditor = prefs.edit()
                    .putString(OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER, if (active) normTier else "supporter")
                    .putBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, everPaid)
                if (sig.isNotBlank()) licEditor.putString(OverlayService.PREFS_KEY_REPLAY_OFFLINE_SIG, sig)
                if (expiresAt.isNotBlank()) licEditor.putString(OverlayService.PREFS_KEY_REPLAY_EXPIRES_AT, expiresAt)
                if (resolvedKey.isNotBlank()) {
                    licEditor.putString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, encryptSecretWithKeystore(resolvedKey))
                }
                licEditor.apply()
            }

            val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
            val teamsType = object : TypeToken<List<SyncTeamPresetRecord>>() {}.type
            val builtType = object : TypeToken<List<BuiltPokemonEntry>>() {}.type
            val strListType = object : TypeToken<List<String>>() {}.type
            val mapType = object : TypeToken<Map<String, String>>() {}.type

            val upsertedLogs: List<SyncBattleLogRecord> = try {
                rObj.get("battleLogs")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, logsType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val deletedLogs: List<String> = try {
                rObj.get("deletedLogIds")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, strListType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val upsertedTeams: List<SyncTeamPresetRecord> = try {
                rObj.get("teamPresets")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, teamsType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val deletedTeams: List<String> = try {
                rObj.get("deletedTeamIds")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, strListType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val upsertedBuilt: List<BuiltPokemonEntry> = try {
                rObj.get("builtPokemon")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, builtType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val deletedBuilt: List<String> = try {
                rObj.get("deletedBuiltPokemonIds")?.takeIf { it.isJsonArray }?.let { gson.fromJson(it, strListType) } ?: emptyList()
            } catch (_: Exception) { emptyList() }
            val pulledSettings: Map<String, String>? = try {
                rObj.get("userSettings")?.takeIf { it.isJsonObject }?.let { gson.fromJson(it, mapType) }
            } catch (_: Exception) { null }
            val pulledSettingsUpdAt = rObj.get("settingsUpdatedAt")?.takeIf { !it.isJsonNull }?.asLong ?: 0L

            val applied = applyCloudflareVaultDeltasLocally(
                prefs = prefs,
                gson = gson,
                localPayload = localPayload,
                remoteUpsertedLogs = upsertedLogs,
                remoteDeletedLogIds = deletedLogs,
                remoteUpsertedTeams = upsertedTeams,
                remoteDeletedTeamIds = deletedTeams,
                remoteUpsertedBuiltPokemon = upsertedBuilt,
                remoteDeletedBuiltPokemonIds = deletedBuilt,
                remoteSettings = pulledSettings,
                remoteSettingsUpdatedAt = pulledSettingsUpdAt
            )
            lastCloudVaultSyncMutatedLocally = applied.mutatedLocally

            val updatedTombstonesSig = (
                applied.deletedLogIdsList.sorted().joinToString(",") + "|" +
                    applied.deletedTeamIdsList.sorted().joinToString(",") + "|" +
                    applied.deletedBuiltPokemonIdsList.sorted().joinToString(",")
                ).hashCode().toString()

            val stateEditor = prefs.edit()
                .putBoolean(OverlayService.PREFS_KEY_D1_VAULT_MIGRATED_V731, true)
                .putBoolean(OverlayService.PREFS_KEY_VAULT_HAS_PASSWORD, hasPassword)
                .putBoolean(OverlayService.PREFS_KEY_VAULT_REQUIRES_PASSWORD, false)
                .putLong(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_MS, pushStartedAtMs)
                .putString(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_TOMBSTONES_SIG, updatedTombstonesSig)
                .putLong(PREFS_KEY_SYNC_LAST_AT, System.currentTimeMillis())

            if (serverSyncMs > 0L) {
                stateEditor.putLong(OverlayService.PREFS_KEY_CLOUD_SYNC_CURSOR_MS, serverSyncMs)
            }
            if (shouldPushSettings) {
                stateEditor.putLong(
                    OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_SETTINGS_MS,
                    max(localPayload.settingsUpdatedAt, pushStartedAtMs)
                )
            }
            // Permanently retire & purge legacy GitHub sync credentials once migrated to Cloudflare D1
            if (legacyGhToken.isNotEmpty() || !alreadyMigrated) {
                stateEditor
                    .remove(PREFS_KEY_SYNC_GITHUB_TOKEN)
                    .remove(PREFS_KEY_SYNC_GIST_ID)
                    .remove(PREFS_KEY_SYNC_GITHUB_USERNAME)
                    .remove(OverlayService.PREFS_KEY_SYNC_GITHUB_USER_ID)
                    .remove("pending_github_device_code")
                    .remove("pending_github_device_expires_at")
            }
            stateEditor.apply()

            val pwBadge = if (hasPassword) "🔒 Password-Secured" else "⚠️ Set Vault Password in Settings"
            true to "Delta Synced (@$safeUser)! (${applied.totalLogs} battles, +${applied.newOrUpdatedLogs} from other devices, ${logsToPush.size} pushed · ${applied.totalTeams} teams, +${applied.newOrUpdatedTeams} updated · ${applied.totalBuiltPokemon} built, +${applied.newOrUpdatedBuiltPokemon} updated · $pwBadge)"
        }
    } catch (e: Exception) {
        false to "Cloud sync failed: ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.syncWithGitHubGistBlocking(
    prefs: SharedPreferences,
    gson: Gson
): Pair<Boolean, String> {
    return syncWithCloudflareVaultBlocking(prefs, gson)
}

internal fun OverlayService.Companion.getDeviceTelemetryHashStatic(prefs: SharedPreferences): String {
    val existing = prefs.getString(PREFS_KEY_DEVICE_TELEMETRY_HASH, null)?.trim().orEmpty()
    if (existing.length >= 8) return existing
    val randomBytes = ByteArray(16)
    java.security.SecureRandom().nextBytes(randomBytes)
    val hash = randomBytes.joinToString("") { "%02x".format(it) }
    prefs.edit().putString(PREFS_KEY_DEVICE_TELEMETRY_HASH, hash).apply()
    return hash
}

/**
 * v5.13 / v6.02: Builds a comprehensive snapshot of all user-configurable debounce filters, tolerances,
 * proactive lead windows, swap-and-throw rollback window, alt fast move strictness, shield chip tolerance,
 * and active post-cutscene / KO settling delay constants.
 */
internal fun OverlayService.Companion.buildDebounceAndSettlingSettingsMapStatic(
    prefs: SharedPreferences,
    scanHzMode: String = "10HZ_HP",
    scanTurnOffsetMs: Long = 0L
): Map<String, Any> {
    runV602ScannerDefaultsMigrationStatic(prefs)
    val hpSamples = prefs.getInt(PREFS_KEY_HP_DEBOUNCE_SAMPLES, DEFAULT_HP_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val energySamples = prefs.getInt(PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, DEFAULT_ENERGY_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val tolPct = prefs.getInt(PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, DEFAULT_DEBOUNCE_TOLERANCE_PCT).coerceIn(0, 3)
    val leadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).coerceIn(0, 450)
    val guiHapticLeadMs = prefs.getInt(PREFS_KEY_PREDICTIVE_GUI_HAPTIC_LEAD_MS, DEFAULT_PREDICTIVE_GUI_HAPTIC_LEAD_MS).coerceIn(100, 500)
    val circlePriority = prefs.getString("charge_circle_priority_mode", "smart_hybrid") ?: "smart_hybrid"
    val altFastDetect = prefs.getBoolean("enable_alt_fast_move_detect", true)
    val fastTurnOffset = prefs.getInt("fast_detect_turn_offset", DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
    val hpTracking = prefs.getBoolean("enable_hp_tracking", DEFAULT_ENABLE_HP_TRACKING)
    val energyTracking = prefs.getBoolean("enable_energy_tracking", DEFAULT_ENABLE_ENERGY_TRACKING)
    val swapRollbackMs = prefs.getInt(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS).let {
        if (it in listOf(0, 3000, 4000, 5000)) it else DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
    }
    val altFastStrictness = (prefs.getString(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, DEFAULT_ALT_FAST_DETECT_STRICTNESS) ?: DEFAULT_ALT_FAST_DETECT_STRICTNESS)
        .lowercase().let { if (it in listOf("strict", "balanced", "aggressive")) it else DEFAULT_ALT_FAST_DETECT_STRICTNESS }
    val shieldChipTolPct = prefs.getInt(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, DEFAULT_SHIELD_CHIP_TOLERANCE_PCT).let {
        if (it in listOf(6, 10, 14)) it else DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
    }
    return mapOf(
        "appVersion" to APP_VERSION,
        "versionCode" to APP_VERSION_CODE,
        "scanHzMode" to scanHzMode,
        "turnOffsetMs" to scanTurnOffsetMs,
        "hpTrackingEnabled" to hpTracking,
        "energyTrackingEnabled" to energyTracking,
        "hpDebounceSamples" to hpSamples,
        "hpDebounceWindowMs" to (hpSamples * 100),
        "energyDebounceSamples" to energySamples,
        "energyDebounceWindowMs" to (energySamples * 100),
        "debounceTolerancePct" to tolPct,
        "proactiveEnergyLeadMs" to leadMs,
        "predictiveGuiHapticLeadMs" to guiHapticLeadMs,
        "chargeCirclePriorityMode" to circlePriority,
        "altFastMoveDetectEnabled" to altFastDetect,
        "fastDetectTurnOffset" to fastTurnOffset,
        "swapThrowRollbackWindowMs" to swapRollbackMs,
        "altFastDetectStrictness" to altFastStrictness,
        "shieldChipTolerancePct" to shieldChipTolPct,
        "postChargeReturnSettleMinMs" to 1800,
        "postCutsceneHpSettleWindowMs" to 4500,
        "koConfirmFrames" to 6,
        "koConfirmSettlingDelayMs" to 600,
        "topCountdownConfirmFrames" to 2,
        "topCountdownClearFrames" to 3,
        "faintSyncWindowSec" to 25.0
    )
}

internal fun OverlayService.Companion.computeDebounceSettingsProfileSignatureStatic(prefs: SharedPreferences): String {
    runV602ScannerDefaultsMigrationStatic(prefs)
    val hpSamples = prefs.getInt(PREFS_KEY_HP_DEBOUNCE_SAMPLES, DEFAULT_HP_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val energySamples = prefs.getInt(PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, DEFAULT_ENERGY_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val tolPct = prefs.getInt(PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, DEFAULT_DEBOUNCE_TOLERANCE_PCT).coerceIn(0, 3)
    val leadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).let {
        if (it in listOf(0, 200, 300, 400)) it else DEFAULT_PROACTIVE_ENERGY_LEAD_MS
    }
    val circlePriority = (prefs.getString("charge_circle_priority_mode", "smart_hybrid") ?: "smart_hybrid").uppercase()
    val altFastDetect = if (prefs.getBoolean("enable_alt_fast_move_detect", true)) 1 else 0
    val fastTurnOffset = prefs.getInt("fast_detect_turn_offset", DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
    val swapRollbackMs = prefs.getInt(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS)
    val altFastStrictness = (prefs.getString(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, DEFAULT_ALT_FAST_DETECT_STRICTNESS) ?: DEFAULT_ALT_FAST_DETECT_STRICTNESS).uppercase()
    val shieldChipTolPct = prefs.getInt(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, DEFAULT_SHIELD_CHIP_TOLERANCE_PCT)
    return "HP${hpSamples}_E${energySamples}_TOL${tolPct}_LEAD${leadMs}_${circlePriority}_ALT${altFastDetect}_${altFastStrictness}_OFF${fastTurnOffset}_SWAP${swapRollbackMs}_CHIP${shieldChipTolPct}_FAINT25"
}

internal fun OverlayService.Companion.loadPendingSettingsChangesStatic(prefs: SharedPreferences, gson: Gson): List<AiTelemetrySettingsChangeEvent> {
    val raw = prefs.getString(PREFS_KEY_PENDING_SETTINGS_CHANGES_V513, null) ?: return emptyList()
    return try {
        val type = object : TypeToken<List<AiTelemetrySettingsChangeEvent>>() {}.type
        val parsed: List<AiTelemetrySettingsChangeEvent> = gson.fromJson(raw, type) ?: emptyList()
        parsed.distinctBy { it.id }.sortedBy { it.timestampMs }
    } catch (_: Exception) {
        emptyList()
    }
}

internal fun OverlayService.Companion.loadSettingsChangeHistoryStatic(prefs: SharedPreferences, gson: Gson): List<AiTelemetrySettingsChangeEvent> {
    val raw = prefs.getString(PREFS_KEY_SETTINGS_CHANGE_HISTORY_V513, null) ?: return emptyList()
    return try {
        val type = object : TypeToken<List<AiTelemetrySettingsChangeEvent>>() {}.type
        val parsed: List<AiTelemetrySettingsChangeEvent> = gson.fromJson(raw, type) ?: emptyList()
        parsed.distinctBy { it.id }.sortedBy { it.timestampMs }
    } catch (_: Exception) {
        emptyList()
    }
}

/**
 * v5.13: Detects any change to user settings that pertain to debounce filters, error tolerances,
 * proactive energy lead windows, circle priority mode, or fast-move turn offset, records a timestamped
 * `AiTelemetrySettingsChangeEvent`, queues it for inclusion with the next battle log & telemetry batch,
 * and optionally uploads `users/<safeUser>/settings_changes.jsonl` immediately in the background.
 */
internal fun OverlayService.Companion.recordDebounceSettingsChangeIfNeededStatic(
    prefs: SharedPreferences,
    gson: Gson,
    triggerSource: String = "settings_ui",
    triggerImmediateUpload: Boolean = false
): AiTelemetrySettingsChangeEvent? {
    return try {
        val currentFullMap = buildDebounceAndSettlingSettingsMapStatic(prefs)
        val trackedKeys = listOf(
            "hpTrackingEnabled",
            "energyTrackingEnabled",
            "hpDebounceSamples",
            "hpDebounceWindowMs",
            "energyDebounceSamples",
            "energyDebounceWindowMs",
            "debounceTolerancePct",
            "proactiveEnergyLeadMs",
            "chargeCirclePriorityMode",
            "altFastMoveDetectEnabled",
            "fastDetectTurnOffset",
            "swapThrowRollbackWindowMs",
            "altFastDetectStrictness",
            "shieldChipTolerancePct",
            "postChargeReturnSettleMinMs",
            "postCutsceneHpSettleWindowMs",
            "koConfirmFrames",
            "koConfirmSettlingDelayMs",
            "topCountdownConfirmFrames",
            "topCountdownClearFrames",
            "faintSyncWindowSec"
        )
        val currentTracked = trackedKeys.associateWith { k -> currentFullMap[k] ?: "" }
        val prevRaw = prefs.getString(PREFS_KEY_LAST_DEBOUNCE_SETTINGS_SNAPSHOT_V513, null)
        if (prevRaw.isNullOrBlank()) {
            prefs.edit().putString(PREFS_KEY_LAST_DEBOUNCE_SETTINGS_SNAPSHOT_V513, gson.toJson(currentTracked)).apply()
            return null
        }
        val mapType = object : TypeToken<Map<String, Any>>() {}.type
        val prevMap: Map<String, Any> = try {
            gson.fromJson(prevRaw, mapType) ?: emptyMap()
        } catch (_: Exception) {
            emptyMap()
        }
        val changedKeys = mutableListOf<String>()
        val prevDiff = mutableMapOf<String, Any>()
        val newDiff = mutableMapOf<String, Any>()
        for (k in trackedKeys) {
            val oldVal = prevMap[k]?.toString()?.removeSuffix(".0") ?: ""
            val newVal = currentTracked[k]?.toString()?.removeSuffix(".0") ?: ""
            if (oldVal != newVal) {
                changedKeys.add(k)
                prevDiff[k] = prevMap[k] ?: oldVal
                newDiff[k] = currentTracked[k] ?: newVal
            }
        }
        if (changedKeys.isEmpty()) return null

        val nowMs = System.currentTimeMillis()
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val screenName = getRequiredScreenNameStatic(prefs).ifEmpty { "trainer_$devHash" }
        val sig = computeDebounceSettingsProfileSignatureStatic(prefs)
        val event = AiTelemetrySettingsChangeEvent(
            id = "cfg_${nowMs}_${(100..999).random()}",
            timestampMs = nowMs,
            appVersion = APP_VERSION,
            uploaderHandle = screenName,
            deviceHash = devHash,
            triggerSource = triggerSource,
            changedKeys = changedKeys,
            previousSettings = prevDiff,
            newSettings = newDiff,
            settingsProfileSignature = sig,
            activeDebouncesAndDelays = currentTracked
        )
        val pendingList = (loadPendingSettingsChangesStatic(prefs, gson) + event).distinctBy { it.id }.takeLast(100)
        val historyList = (loadSettingsChangeHistoryStatic(prefs, gson) + event).distinctBy { it.id }.takeLast(200)
        prefs.edit()
            .putString(PREFS_KEY_LAST_DEBOUNCE_SETTINGS_SNAPSHOT_V513, gson.toJson(currentTracked))
            .putString(PREFS_KEY_PENDING_SETTINGS_CHANGES_V513, gson.toJson(pendingList))
            .putString(PREFS_KEY_SETTINGS_CHANGE_HISTORY_V513, gson.toJson(historyList))
            .putLong(PREFS_KEY_USER_SETTINGS_UPDATED_AT, nowMs)
            .apply()

        if (triggerImmediateUpload && prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, DEFAULT_AUTO_UPLOAD_AI_LOGS)) {
            kotlinx.coroutines.CoroutineScope(Dispatchers.IO + kotlinx.coroutines.SupervisorJob()).launch {
                try {
                    uploadSettingsChangeHistoryBlocking(prefs, gson)
                } catch (_: Exception) {}
            }
        }
        event
    } catch (_: Exception) {
        null
    }
}

internal fun OverlayService.Companion.uploadSettingsChangeHistoryBlocking(prefs: SharedPreferences, gson: Gson): Boolean {
    val pendingChanges = loadPendingSettingsChangesStatic(prefs, gson)
    if (pendingChanges.isEmpty()) return true
    val historyChanges = loadSettingsChangeHistoryStatic(prefs, gson).ifEmpty { pendingChanges }
    val devHash = getDeviceTelemetryHashStatic(prefs)
    val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
    val jsonlContent = historyChanges.joinToString("\n") { ev ->
        val savedVer = ev.appVersion.takeIf { it.isNotBlank() && it != "5.13" && it != "6.02" } ?: APP_VERSION
        val enriched = if (ev.uploaderHandle.isBlank() || ev.uploaderHandle == "anonymous" || ev.uploaderHandle.startsWith("trainer_")) {
            ev.copy(uploaderHandle = safeUser, deviceHash = devHash, appVersion = savedVer)
        } else {
            ev.copy(appVersion = savedVer)
        }
        gson.toJson(enriched)
    } + "\n"

    val httpClient = buildTelemetryHttpClientStatic(20L, 45L, 30L)
    val payloadJson = gson.toJson(
        mapOf(
            "appVersion" to APP_VERSION,
            "versionCode" to APP_VERSION_CODE,
            "deviceId" to devHash,
            "jsonl" to jsonlContent
        )
    )
    val req = applyWorkerClientAuthHeaders(
        Request.Builder()
            .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/settings-changes")
            .post(payloadJson.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())),
        prefs,
        safeUser,
        devHash
    ).build()

    val ok = try {
        httpClient.newCall(req).execute().use { resp -> resp.isSuccessful }
    } catch (_: Exception) {
        false
    }
    if (ok) {
        val uploadedIds = pendingChanges.map { it.id }.toSet()
        val remaining = loadPendingSettingsChangesStatic(prefs, gson).filter { it.id !in uploadedIds }
        prefs.edit().putString(PREFS_KEY_PENDING_SETTINGS_CHANGES_V513, gson.toJson(remaining)).apply()
    }
    return ok
}

/**
 * v5.10 / v6.27 One-Time Migration: Wipes legacy pre-5.10 AI training logs (`gbl_ai_training_logs_v1`)
 * and enables Always-On Cloudflare Telemetry (`PREFS_KEY_AUTO_UPLOAD_AI_LOGS = true`) by default.
 */
internal fun OverlayService.Companion.runV510AiTelemetryMigrationAndWipeStatic(prefs: SharedPreferences) {
    val v627Migrated = prefs.getBoolean("gbl_cloudflare_telemetry_v627_migrated", false)
    if (prefs.getBoolean(PREFS_KEY_AI_TELEMETRY_V510_MIGRATED, false) && v627Migrated) return
    val editor = prefs.edit()
        .remove(PREFS_KEY_AI_TRAINING_LOGS)
        .putBoolean(PREFS_KEY_AI_TELEMETRY_V510_MIGRATED, true)
        .putBoolean("gbl_cloudflare_telemetry_v627_migrated", true)
        .putBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, true)
    // Auto-seed Screen Name from existing GitHub username if valid and not yet set
    if (prefs.getString(PREFS_KEY_USER_SCREEN_NAME, "").isNullOrBlank()) {
        val ghUser = OverlayService.sanitizeScreenNameStatic(prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, null))
        if (ghUser.isNotEmpty()) {
            editor.putString(PREFS_KEY_USER_SCREEN_NAME, ghUser)
        }
    }
    editor.apply()
}

@Volatile
private var cachedPendingAiRawRef: String? = null
@Volatile
private var cachedPendingAiBattlesCount: Int = 0
@Volatile
private var cachedPendingAiAnomaliesCount: Int = 0

internal fun OverlayService.Companion.getPendingAiTelemetryCountsFastStatic(
    prefs: SharedPreferences,
    gson: Gson
): Pair<Int, Int> {
    val raw = prefs.getString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, null)
    if (raw.isNullOrBlank() || raw == "[]") {
        cachedPendingAiRawRef = raw
        cachedPendingAiBattlesCount = 0
        cachedPendingAiAnomaliesCount = 0
        return 0 to 0
    }
    if (raw === cachedPendingAiRawRef) {
        return cachedPendingAiBattlesCount to cachedPendingAiAnomaliesCount
    }
    val parsed = loadPendingAiTelemetryLogsStatic(prefs, gson)
    val bCount = parsed.size
    val aCount = parsed.sumOf { it.anomalies.size }
    cachedPendingAiRawRef = raw
    cachedPendingAiBattlesCount = bCount
    cachedPendingAiAnomaliesCount = aCount
    return bCount to aCount
}

internal fun OverlayService.Companion.loadPendingAiTelemetryLogsStatic(prefs: SharedPreferences, gson: Gson): List<AiTelemetryBattleRecordV510> {
    val raw = prefs.getString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, null) ?: return emptyList()
    return try {
        val type = object : TypeToken<List<AiTelemetryBattleRecordV510>>() {}.type
        val parsed: List<AiTelemetryBattleRecordV510> = gson.fromJson(raw, type) ?: emptyList()
        val deduped = parsed.distinctBy { it.battleId }.sortedBy { it.timestampMs }
        cachedPendingAiRawRef = raw
        cachedPendingAiBattlesCount = deduped.size
        cachedPendingAiAnomaliesCount = deduped.sumOf { it.anomalies.size }
        deduped
    } catch (_: Exception) {
        emptyList()
    }
}

internal fun OverlayService.Companion.savePendingAiTelemetryLogsStatic(
    prefs: SharedPreferences,
    gson: Gson,
    logs: List<AiTelemetryBattleRecordV510>
) {
    val capped = logs.distinctBy { it.battleId }.sortedBy { it.timestampMs }.takeLast(200)
    val jsonStr = gson.toJson(capped)
    cachedPendingAiRawRef = jsonStr
    cachedPendingAiBattlesCount = capped.size
    cachedPendingAiAnomaliesCount = capped.sumOf { it.anomalies.size }
    prefs.edit().putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, jsonStr).apply()
}

/**
 * Inspects a completed battle's timeline events, slot specs, and move/energy/HP/shield states
 * to automatically detect anomalies (e.g. charged move thrown with less energy tracked than move cost
 * like the Xerneas fast-move energy issue, unexpected HP drops vs PvPoke damage, shield desyncs,
 * circle-fill drift, or fallback species/moves).
 * v5.13: Attaches lightweight cropped WebP HUD thumbnails (`screenshotWebpBase64`) to up to 3 `HIGH` severity anomalies.
 */
internal fun OverlayService.Companion.detectBattleAnomaliesStatic(
    league: String,
    userTeamSpecs: List<AiTelemetrySlotSpec>,
    oppTeamSpecs: List<AiTelemetryOppSlotSpec>,
    timelineEvents: List<BattleTimelineEvent>
): List<BattleAnomalyRecord> {
    val anomalies = mutableListOf<BattleAnomalyRecord>()
    var attachedHighScreenshots = 0

    // 1. Check species & move specs for fallback / missing GameMaster entries
    for (u in userTeamSpecs) {
        if (u.species.isBlank() || u.fastMove.equals("Fast Attack", ignoreCase = true) ||
            u.chargedMove1.equals("Charged Move 1", ignoreCase = true) ||
            u.chargedMove1.equals("Struggle", ignoreCase = true)
        ) {
            anomalies.add(
                BattleAnomalyRecord(
                    type = "FALLBACK_SPECIES_OR_MOVE",
                    severity = "HIGH",
                    tSec = 0.0,
                    actor = "user",
                    species = u.species,
                    fastMove = u.fastMove,
                    moveName = u.chargedMove1,
                    detail = "User slot #${u.slotIndex + 1} (${u.species}) resolved to fallback move (${u.fastMove} / ${u.chargedMove1})"
                )
            )
        }
    }
    for (o in oppTeamSpecs) {
        if (o.species.equals("Waiting...", ignoreCase = true) ||
            o.inferredFastMove.equals("Fast Attack", ignoreCase = true)
        ) {
            anomalies.add(
                BattleAnomalyRecord(
                    type = "FALLBACK_SPECIES_OR_MOVE",
                    severity = "HIGH",
                    tSec = 0.0,
                    actor = "opp",
                    species = o.species,
                    fastMove = o.inferredFastMove,
                    detail = "Opponent slot #${o.slotIndex + 1} (${o.species}) resolved to fallback fast move (${o.inferredFastMove})"
                )
            )
        }
    }

    var prevUserShields = 2
    var prevOppShields = 2
    var lastActiveUserSpecies = userTeamSpecs.firstOrNull()?.species.orEmpty()
    var lastActiveOppSpecies = oppTeamSpecs.firstOrNull()?.species.orEmpty()
    var prevActiveUserHp = 100
    var prevActiveOppHp = 100

    val sortedEvents = timelineEvents.sortedBy { it.t }
    for (ev in sortedEvents) {
        if (ev.type.equals("SWAP", ignoreCase = true) || ev.type.equals("FAINT", ignoreCase = true)) {
            if (ev.actor.equals("user", ignoreCase = true) && !ev.pokemonIn.isNullOrBlank()) {
                lastActiveUserSpecies = ev.pokemonIn
                prevActiveUserHp = 100
            } else if (ev.actor.equals("opp", ignoreCase = true) && !ev.pokemonIn.isNullOrBlank()) {
                lastActiveOppSpecies = ev.pokemonIn
                prevActiveOppHp = 100
            }
        }

        if (ev.type.equals("CHARGED_ATTACK", ignoreCase = true)) {
            val isUser = ev.actor.equals("user", ignoreCase = true)
            val attackerSpecies = ev.activePokemon?.takeIf { it.isNotBlank() }
                ?: (if (isUser) lastActiveUserSpecies else lastActiveOppSpecies)
            val moveName = ev.inferredMoveName.orEmpty()
            val userSpec = userTeamSpecs.find { it.species.equals(attackerSpecies, ignoreCase = true) }
            val oppSpec = oppTeamSpecs.find {
                it.species.equals(attackerSpecies, ignoreCase = true) ||
                    it.species.equals(attackerSpecies.removePrefix("Shadow ").trim(), ignoreCase = true)
            }
            val fastMoveName = if (isUser) userSpec?.fastMove else oppSpec?.inferredFastMove
            val fastTurns = if (isUser) userSpec?.fastTurns else oppSpec?.fastTurns
            val fastEnergy = if (isUser) userSpec?.fastEnergy else oppSpec?.fastEnergy

            val reqEnergy = ev.requiredMoveEnergy ?: if (moveName.isNotBlank()) {
                val mStats = resolveChargedMoveStatsStatic(moveName, "normal")
                (mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 45).coerceIn(35, 100)
            } else null
            val preEnergy = ev.preThrowEnergy
            val deficit = ev.energyDeficit ?: if (preEnergy != null && reqEnergy != null && preEnergy < reqEnergy) {
                reqEnergy - preEnergy
            } else 0

            // A. ENERGY_DEFICIT_THROW: Move thrown when tracked energy < required move energy (e.g. Xerneas Geomancy / fast move EPT mismatch)
            if (deficit > 0 && preEnergy != null && reqEnergy != null) {
                val sev = if (deficit >= 8) "HIGH" else "WARN"
                val thumb = if (sev == "HIGH" && attachedHighScreenshots < 3 && !ev.hudThumbnailWebpBase64.isNullOrBlank()) {
                    attachedHighScreenshots++
                    ev.hudThumbnailWebpBase64
                } else null
                anomalies.add(
                    BattleAnomalyRecord(
                        type = "ENERGY_DEFICIT_THROW",
                        severity = sev,
                        tSec = ev.t,
                        actor = ev.actor,
                        species = attackerSpecies,
                        fastMove = fastMoveName,
                        moveName = moveName,
                        moveResolutionSource = ev.moveResolutionSource,
                        detectedEnergyBefore = preEnergy,
                        requiredMoveEnergy = reqEnergy,
                        energyDeficit = deficit,
                        residualEnergyAfter = if (isUser) ev.userEnergy else ev.oppEnergy,
                        leftCircleFillPct = ev.leftCircleFillBeforePct,
                        rightCircleFillPct = ev.rightCircleFillBeforePct,
                        detail = "${ev.actor.uppercase()} $attackerSpecies threw $moveName (${reqEnergy}E) with only ${preEnergy}E tracked (deficit -${deficit}E; fast=${fastMoveName ?: "?"} ${fastTurns ?: "?"}t/${fastEnergy ?: "?"}e, src=${ev.moveResolutionSource ?: "?"})",
                        screenshotWebpBase64 = thumb
                    )
                )
            }

            // B. ENERGY_CAP_DRIFT: User threw charged move confirmed by OCR/HP, but pre-throw circle fills were both < 85%
            // v6.02: Suppress false ENERGY_CAP_DRIFT when tracked energy (preEnergy) already proves the move was ready (>= reqEnergy)
            val trackedEnergyReady = preEnergy != null && reqEnergy != null && preEnergy >= reqEnergy
            if (isUser &&
                !trackedEnergyReady &&
                (ev.moveResolutionSource == "BANNER_OCR" || ev.moveResolutionSource == "HP_DELTA") &&
                ev.leftCircleFillBeforePct != null &&
                ev.rightCircleFillBeforePct != null &&
                ev.leftCircleFillBeforePct in 1..84 &&
                ev.rightCircleFillBeforePct in 0..84
            ) {
                anomalies.add(
                    BattleAnomalyRecord(
                        type = "ENERGY_CAP_DRIFT",
                        severity = "WARN",
                        tSec = ev.t,
                        actor = "user",
                        species = attackerSpecies,
                        fastMove = fastMoveName,
                        moveName = moveName,
                        moveResolutionSource = ev.moveResolutionSource,
                        detectedEnergyBefore = preEnergy,
                        requiredMoveEnergy = reqEnergy,
                        leftCircleFillPct = ev.leftCircleFillBeforePct,
                        rightCircleFillPct = ev.rightCircleFillBeforePct,
                        detail = "User $attackerSpecies threw $moveName (${ev.moveResolutionSource}) while pre-throw circle fills read L=${ev.leftCircleFillBeforePct}% / R=${ev.rightCircleFillBeforePct}% (<85% ready gate)"
                    )
                )
            }

            // C. SHIELD_DESYNC & UNEXPECTED_HP_DELTA
            val hpBefore = ev.hpBeforePct
            val hpAfter = ev.hpAfterPct
            val actualDrop = ev.hpDeltaPct ?: if (hpBefore != null && hpAfter != null) max(0, hpBefore - hpAfter) else null
            val expectedDmg = ev.expectedMoveDmgPct
            val wasShielded = ev.shielded == true

            if (hpBefore != null && hpAfter != null && actualDrop != null) {
                if (!wasShielded && hpBefore >= 20 && (expectedDmg == null || expectedDmg >= 15) && actualDrop <= 2) {
                    val thumb = if (attachedHighScreenshots < 3 && !ev.hudThumbnailWebpBase64.isNullOrBlank()) {
                        attachedHighScreenshots++
                        ev.hudThumbnailWebpBase64
                    } else null
                    anomalies.add(
                        BattleAnomalyRecord(
                            type = "SHIELD_DESYNC",
                            severity = "HIGH",
                            tSec = ev.t,
                            actor = ev.actor,
                            species = attackerSpecies,
                            moveName = moveName,
                            hpBeforePct = hpBefore,
                            hpAfterPct = hpAfter,
                            actualHpDropPct = actualDrop,
                            expectedDmgPct = expectedDmg,
                            shieldsBefore = if (isUser) prevOppShields else prevUserShields,
                            shieldsAfter = if (isUser) ev.oppShieldsRemaining else ev.userShieldsRemaining,
                            detail = "Unshielded $moveName from ${ev.actor.uppercase()} $attackerSpecies caused only ${actualDrop}% HP drop (${hpBefore}% -> ${hpAfter}%, expected ~${expectedDmg ?: "?"}%) without shield decrement",
                            screenshotWebpBase64 = thumb
                        )
                    )
                } else if (wasShielded && actualDrop >= 12 && hpAfter > 0) {
                    anomalies.add(
                        BattleAnomalyRecord(
                            type = "SHIELD_DESYNC",
                            severity = "WARN",
                            tSec = ev.t,
                            actor = ev.actor,
                            species = attackerSpecies,
                            moveName = moveName,
                            hpBeforePct = hpBefore,
                            hpAfterPct = hpAfter,
                            actualHpDropPct = actualDrop,
                            expectedDmgPct = expectedDmg,
                            shieldsBefore = if (isUser) prevOppShields else prevUserShields,
                            shieldsAfter = if (isUser) ev.oppShieldsRemaining else ev.userShieldsRemaining,
                            detail = "Charged move $moveName from ${ev.actor.uppercase()} $attackerSpecies was marked shielded, but defender HP dropped ${actualDrop}% (${hpBefore}% -> ${hpAfter}%)"
                        )
                    )
                } else if (!wasShielded && hpAfter > 0 && expectedDmg != null && kotlin.math.abs(actualDrop - expectedDmg) >= 20) {
                    val diff = kotlin.math.abs(actualDrop - expectedDmg)
                    val sev = if (diff >= 32) "HIGH" else "WARN"
                    val thumb = if (sev == "HIGH" && attachedHighScreenshots < 3 && !ev.hudThumbnailWebpBase64.isNullOrBlank()) {
                        attachedHighScreenshots++
                        ev.hudThumbnailWebpBase64
                    } else null
                    anomalies.add(
                        BattleAnomalyRecord(
                            type = "UNEXPECTED_HP_DELTA",
                            severity = sev,
                            tSec = ev.t,
                            actor = ev.actor,
                            species = attackerSpecies,
                            moveName = moveName,
                            moveResolutionSource = ev.moveResolutionSource,
                            hpBeforePct = hpBefore,
                            hpAfterPct = hpAfter,
                            actualHpDropPct = actualDrop,
                            expectedDmgPct = expectedDmg,
                            detail = "Unshielded $moveName from ${ev.actor.uppercase()} $attackerSpecies dropped defender HP by ${actualDrop}% (${hpBefore}% -> ${hpAfter}%) vs expected PvPoke ${expectedDmg}% (diff ${diff}%)",
                            screenshotWebpBase64 = thumb
                        )
                    )
                }
            }
        }

        prevUserShields = ev.userShieldsRemaining
        prevOppShields = ev.oppShieldsRemaining
    }

    return anomalies
}

/**
 * v6.02: Zero-Lag Post-Battle Multi-Profile Shadow Telemetry Engine.
 * Runs AFTER battle completion on the compact 10Hz scalar sensor trace (`sensorTicks`) and timeline checkpoints
 * so live combat runs at 0% extra CPU overhead while telemetry benchmarks all candidate settings profiles
 * and single-parameter variations on the exact same battle.
 */
internal fun OverlayService.Companion.evaluateShadowSettingsProfilesStatic(
    prefs: SharedPreferences,
    league: String,
    userTeamSpecs: List<AiTelemetrySlotSpec>,
    oppTeamSpecs: List<AiTelemetryOppSlotSpec>,
    timelineEvents: List<BattleTimelineEvent>,
    sensorTicks: List<BattleSensorTick>
): Map<String, Any> {
    val startNs = System.nanoTime()
    data class ShadowProfileSpec(
        val id: String,
        val hpSamples: Int,
        val energySamples: Int,
        val tolPct: Int,
        val leadMs: Int,
        val circlePriority: String,
        val altFastStrictness: String,
        val fastTurnOffset: Int,
        val swapRollbackWindowMs: Int,
        val shieldChipTolPct: Int
    )

    val userHpSamples = prefs.getInt(PREFS_KEY_HP_DEBOUNCE_SAMPLES, DEFAULT_HP_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val userEnergySamples = prefs.getInt(PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, DEFAULT_ENERGY_DEBOUNCE_SAMPLES).coerceIn(2, 4)
    val userTolPct = prefs.getInt(PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, DEFAULT_DEBOUNCE_TOLERANCE_PCT).coerceIn(0, 3)
    val userLeadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).coerceIn(0, 400)
    val userCirclePriority = prefs.getString("charge_circle_priority_mode", "smart_hybrid") ?: "smart_hybrid"
    val userFastOffset = prefs.getInt("fast_detect_turn_offset", DEFAULT_FAST_DETECT_TURN_OFFSET).coerceIn(0, 3)
    val userSwapRollbackMs = prefs.getInt(PREFS_KEY_SWAP_THROW_ROLLBACK_WINDOW_MS, DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS).let {
        if (it in listOf(0, 3000, 4000, 5000)) it else DEFAULT_SWAP_THROW_ROLLBACK_WINDOW_MS
    }
    val userAltStrictness = (prefs.getString(PREFS_KEY_ALT_FAST_DETECT_STRICTNESS, DEFAULT_ALT_FAST_DETECT_STRICTNESS) ?: DEFAULT_ALT_FAST_DETECT_STRICTNESS)
        .lowercase().let { if (it in listOf("strict", "balanced", "aggressive")) it else DEFAULT_ALT_FAST_DETECT_STRICTNESS }
    val userShieldChipTol = prefs.getInt(PREFS_KEY_SHIELD_CHIP_TOLERANCE_PCT, DEFAULT_SHIELD_CHIP_TOLERANCE_PCT).let {
        if (it in listOf(6, 10, 14)) it else DEFAULT_SHIELD_CHIP_TOLERANCE_PCT
    }

    fun evalSingleProfile(spec: ShadowProfileSpec): Map<String, Any> {
        // 1. Evaluate 10Hz sensor trace debounce stability & false-glitch count under (hpSamples, energySamples, tolPct, leadMs)
        var hpConfirmations = 0
        var hpGlitchReversals = 0
        var energyConfirmations = 0
        var proactiveRollbacks = 0
        var candHp = -1
        var candHpCount = 0
        var confirmedHp = 100
        var prevConfirmedHp = 100
        var candFill = -1
        var candFillCount = 0
        var lastFillConfirmMs = 0L

        for (tick in sensorTicks) {
            if (tick.isCutsceneActive) {
                candHpCount = 0
                candFillCount = 0
                continue
            }
            if (tick.playerHpPct in 1..100) {
                if (candHp in 1..100 && kotlin.math.abs(tick.playerHpPct - candHp) <= spec.tolPct) {
                    candHpCount++
                    candHp = ((candHp + tick.playerHpPct) / 2.0).roundToInt()
                } else {
                    candHp = tick.playerHpPct
                    candHpCount = 1
                }
                if (candHpCount == spec.hpSamples) {
                    hpConfirmations++
                    if (candHp > confirmedHp + 3 && confirmedHp < prevConfirmedHp - 3) {
                        hpGlitchReversals++
                    }
                    prevConfirmedHp = confirmedHp
                    confirmedHp = candHp
                }
            }
            val fill = max(tick.leftFillPct, tick.rightFillPct)
            if (fill in 1..300) {
                if (candFill in 1..300 && kotlin.math.abs(fill - candFill) <= spec.tolPct) {
                    candFillCount++
                    candFill = ((candFill + fill) / 2.0).roundToInt()
                } else {
                    candFill = fill
                    candFillCount = 1
                }
                if (candFillCount == spec.energySamples) {
                    energyConfirmations++
                    if (spec.leadMs > 0 && lastFillConfirmMs > 0L) {
                        val dt = tick.tMs - lastFillConfirmMs
                        if (dt in (1500L - spec.leadMs)..2400L && dt > 1500L + 500L - spec.leadMs) {
                            proactiveRollbacks++
                        }
                    }
                    lastFillConfirmMs = tick.tMs
                }
            }
        }

        // 2. Transform timelineEvents according to profile's (swapRollbackWindowMs, shieldChipTolPct, altFastStrictness, fastTurnOffset)
        var swapThrowRollbacks = 0
        var shieldChipSaves = 0
        val simEvents = timelineEvents.mapIndexed { idx, ev ->
            if (!ev.type.equals("CHARGED_ATTACK", ignoreCase = true)) {
                ev
            } else {
                var modEv = ev
                // Evaluate swap-and-throw rollback window effect
                if (ev.moveResolutionSource == "POST_THROW_SWAP_ROLLBACK") {
                    if (spec.swapRollbackWindowMs <= 0) {
                        // Without swap rollback, restore pre-rollback deficit/mismatch
                        modEv = modEv.copy(
                            energyDeficit = max(8, modEv.energyDeficit ?: 0),
                            moveResolutionSource = "DEFAULT_FALLBACK"
                        )
                    } else {
                        swapThrowRollbacks++
                    }
                } else if (spec.swapRollbackWindowMs > 0) {
                    val nextSwap = timelineEvents.drop(idx + 1).firstOrNull {
                        (it.type == "SWAP" || it.type == "FAINT") &&
                            it.actor.equals(ev.actor, ignoreCase = true) &&
                            ((it.t - ev.t) * 1000.0) in 0.0..spec.swapRollbackWindowMs.toDouble()
                    }
                    if (nextSwap != null && ((modEv.energyDeficit ?: 0) > 0 || (modEv.expectedMoveDmgPct != null && modEv.hpDeltaPct != null && kotlin.math.abs(modEv.expectedMoveDmgPct - modEv.hpDeltaPct) >= 20))) {
                        swapThrowRollbacks++
                        modEv = modEv.copy(
                            energyDeficit = 0,
                            expectedMoveDmgPct = modEv.hpDeltaPct,
                            moveResolutionSource = "POST_THROW_SWAP_ROLLBACK"
                        )
                    }
                }
                // Evaluate shieldChipTolerancePct effect on unshielded 1-fast-move pre-zoom chip
                val actualDrop = modEv.hpDeltaPct ?: 0
                val expDmg = modEv.expectedMoveDmgPct ?: 0
                val preShields = if (modEv.actor.equals("user", ignoreCase = true)) modEv.oppShieldsRemaining else modEv.userShieldsRemaining
                if (modEv.shielded != true && actualDrop in 1..spec.shieldChipTolPct && expDmg >= 35 && preShields > 0) {
                    shieldChipSaves++
                    modEv = modEv.copy(
                        shielded = true,
                        hpDeltaPct = 1,
                        hpAfterPct = max(1, (modEv.hpBeforePct ?: 100) - 1)
                    )
                } else if (modEv.shielded == true && actualDrop > spec.shieldChipTolPct && actualDrop <= 14) {
                    modEv = modEv.copy(shielded = false)
                }
                modEv
            }
        }

        // Evaluate altFastDetectStrictness & fastTurnOffset false-override risk on oppTeamSpecs
        val simOppSpecs = oppTeamSpecs.map { oSpec ->
            val isNonStd = oSpec.fastMoveStatus.equals("confirmed_non_standard", ignoreCase = true) ||
                oSpec.inferredFastMove.startsWith("Hidden Power", ignoreCase = true)
            if (isNonStd && spec.altFastStrictness == "strict" && oSpec.inferredFastMove.startsWith("Hidden Power", ignoreCase = true)) {
                val spNorm = oSpec.species.lowercase()
                val stdFast = when {
                    spNorm.contains("ho-oh") || spNorm.contains("ho oh") || spNorm.contains("skeledirge") || spNorm.contains("talonflame") -> "Incinerate"
                    spNorm.contains("gastrodon") || spNorm.contains("rhyperior") -> "Mud Slap"
                    spNorm.contains("togekiss") -> "Charm"
                    spNorm.contains("suicune") -> "Snarl"
                    spNorm.contains("regigigas") -> "Lock On"
                    else -> "Tackle"
                }
                val stdTurns = resolveFastTurnsStatic(stdFast, 2).coerceIn(1, 5)
                val stdE = resolveFastEnergyStatic(stdFast, stdTurns).coerceIn(2, 20)
                oSpec.copy(
                    inferredFastMove = stdFast,
                    fastMoveStatus = "confirmed_standard",
                    fastTurns = stdTurns,
                    fastEnergy = stdE
                )
            } else {
                oSpec
            }
        }

        val simAnomalies = detectBattleAnomaliesStatic(
            league = league,
            userTeamSpecs = userTeamSpecs,
            oppTeamSpecs = simOppSpecs,
            timelineEvents = simEvents
        )
        val highCount = simAnomalies.count { it.severity == "HIGH" }
        val warnCount = simAnomalies.count { it.severity == "WARN" }
        val byType = simAnomalies.groupingBy { it.type }.eachCount()
        val totalDeficit = simEvents.filter { it.type == "CHARGED_ATTACK" }.sumOf { (it.energyDeficit ?: 0).coerceAtLeast(0) }
        val unshieldedCharged = simEvents.filter { it.type == "CHARGED_ATTACK" && it.shielded != true && it.hpDeltaPct != null && it.expectedMoveDmgPct != null }
        val meanHpError = if (unshieldedCharged.isNotEmpty()) {
            ((unshieldedCharged.sumOf { kotlin.math.abs((it.hpDeltaPct ?: 0) - (it.expectedMoveDmgPct ?: 0)) }.toDouble() / unshieldedCharged.size) * 10.0).roundToInt() / 10.0
        } else 0.0
        val qualityScore = (100.0 - highCount * 22.0 - warnCount * 8.0 - hpGlitchReversals * 4.0 - proactiveRollbacks * 1.5 - meanHpError * 0.5).coerceIn(0.0, 100.0)
        val roundedScore = (qualityScore * 10.0).roundToInt() / 10.0

        return mapOf(
            "profileId" to spec.id,
            "qualityScore" to roundedScore,
            "anomalyCount" to simAnomalies.size,
            "highSeverityCount" to highCount,
            "warnSeverityCount" to warnCount,
            "anomaliesByType" to byType,
            "totalEnergyDeficit" to totalDeficit,
            "meanUnshieldedHpErrorPct" to meanHpError,
            "swapThrowRollbacksTriggered" to swapThrowRollbacks,
            "shieldChipSavesTriggered" to shieldChipSaves,
            "hpConfirmations" to hpConfirmations,
            "hpGlitchReversals" to hpGlitchReversals,
            "energyConfirmations" to energyConfirmations,
            "proactiveRollbacks" to proactiveRollbacks
        )
    }

    val baseSpec = ShadowProfileSpec(
        id = "user_selected",
        hpSamples = userHpSamples,
        energySamples = userEnergySamples,
        tolPct = userTolPct,
        leadMs = userLeadMs,
        circlePriority = userCirclePriority,
        altFastStrictness = userAltStrictness,
        fastTurnOffset = userFastOffset,
        swapRollbackWindowMs = userSwapRollbackMs,
        shieldChipTolPct = userShieldChipTol
    )

    val namedProfiles = listOf(
        baseSpec,
        ShadowProfileSpec("v715_ai_tuned_default", 2, 2, 1, 300, "smart_hybrid", "aggressive", 1, 4000, 10),
        ShadowProfileSpec("v602_recommended_default", 2, 2, 1, 300, "smart_hybrid", "strict", 1, 4000, 10),
        ShadowProfileSpec("low_latency_fast", 2, 2, 2, 400, "smart_hybrid", "balanced", 0, 3000, 10),
        ShadowProfileSpec("high_stability_strict", 3, 3, 1, 200, "highest_contrast", "strict", 2, 5000, 14),
        ShadowProfileSpec("balanced_alt_fast", 2, 2, 1, 250, "smart_hybrid", "balanced", 1, 4000, 10),
        ShadowProfileSpec("no_swap_rollback_baseline", 2, 2, 1, 300, "smart_hybrid", "aggressive", 0, 0, 6)
    )

    val profileResults = namedProfiles.associate { it.id to evalSingleProfile(it) }

    // Single-parameter sensitivity sweeps (holding v715_ai_tuned_default fixed while varying 1 parameter at a time, @ 100ms/10fps scan basis)
    val recDefault = namedProfiles[1]
    val paramSweeps = mapOf(
        "hpDebounceSamples" to listOf(2, 3, 4).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "hp_$v", hpSamples = v))["qualityScore"]!!
        },
        "energyDebounceSamples" to listOf(2, 3, 4).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "en_$v", energySamples = v))["qualityScore"]!!
        },
        "debounceTolerancePct" to listOf(0, 1, 2, 3).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "tol_$v", tolPct = v))["qualityScore"]!!
        },
        "proactiveEnergyLeadMs" to listOf(0, 100, 150, 200, 250, 300, 350, 400).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "lead_$v", leadMs = v))["qualityScore"]!!
        },
        "predictiveGuiHapticLeadMs" to listOf(100, 200, 250, 300, 350, 400, 450).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "guilead_$v", leadMs = v))["qualityScore"]!!
        },
        "hpDebounceWindowMs" to listOf(200, 300, 400).associate { v ->
            val equivSamples = (v / 100).coerceIn(2, 4)
            v.toString() to evalSingleProfile(recDefault.copy(id = "hpw_$v", hpSamples = equivSamples))["qualityScore"]!!
        },
        "energyDebounceWindowMs" to listOf(200, 300, 400).associate { v ->
            val equivSamples = (v / 100).coerceIn(2, 4)
            v.toString() to evalSingleProfile(recDefault.copy(id = "enw_$v", energySamples = equivSamples))["qualityScore"]!!
        },
        "swapThrowRollbackWindowMs" to listOf(0, 3000, 4000, 5000).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "swap_$v", swapRollbackWindowMs = v))["qualityScore"]!!
        },
        "altFastDetectStrictness" to listOf("strict", "balanced", "aggressive").associate { v ->
            v to evalSingleProfile(recDefault.copy(id = "alt_$v", altFastStrictness = v))["qualityScore"]!!
        },
        "shieldChipTolerancePct" to listOf(6, 10, 14).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "chip_$v", shieldChipTolPct = v))["qualityScore"]!!
        },
        "fastDetectTurnOffset" to listOf(0, 1, 2, 3).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "off_$v", fastTurnOffset = v))["qualityScore"]!!
        }
    )

    val bestProfileEntry = profileResults.entries.maxByOrNull {
        (it.value["qualityScore"] as? Number)?.toDouble() ?: 0.0
    }
    val elapsedMs = ((System.nanoTime() - startNs) / 100_000L) / 10.0

    return mapOf(
        "evalDurationMs" to elapsedMs,
        "sensorTickCount" to sensorTicks.size,
        "bestProfileId" to (bestProfileEntry?.key ?: "v602_recommended_default"),
        "bestProfileScore" to (bestProfileEntry?.value?.get("qualityScore") ?: 100.0),
        "userSelectedScore" to (profileResults["user_selected"]?.get("qualityScore") ?: 100.0),
        "profiles" to profileResults,
        "parameterSensitivitySweeps" to paramSweeps
    )
}

/**
 * v6.07: Builds Post-Cutscene Dual-HP Rescan Audits (+220ms / +650ms / +1200ms),
 * Turn-by-Turn Energy Mutation Ledger entries, and HP/Energy diagnostic summary metrics
 * from the 10Hz scalar sensor trace (`sensorTicks`) and timeline checkpoints.
 */
internal fun OverlayService.Companion.buildEnhancedHpAndEnergyDiagnosticsStatic(
    userTeamSpecs: List<AiTelemetrySlotSpec>,
    oppTeamSpecs: List<AiTelemetryOppSlotSpec>,
    timelineEvents: List<BattleTimelineEvent>,
    sensorTicks: List<BattleSensorTick>
): Triple<List<PostCutsceneHpAuditRecord>, List<EnergyLedgerEntry>, Map<String, Any>> {
    if (sensorTicks.isEmpty()) {
        return Triple(emptyList(), emptyList(), emptyMap())
    }
    val t0Ms = sensorTicks.first().tMs
    val audits = mutableListOf<PostCutsceneHpAuditRecord>()
    for (ev in timelineEvents) {
        if (!ev.type.equals("CHARGED_ATTACK", ignoreCase = true)) continue
        val evRelMs = (ev.t * 1000.0).toLong()
        val evAbsMs = t0Ms + evRelMs
        val cutsceneTickAfterInit = sensorTicks.firstOrNull { it.tMs in (evAbsMs - 500L)..(evAbsMs + 6000L) && it.isCutsceneActive }
        val postCutsceneAnchorMs = if (cutsceneTickAfterInit != null) {
            sensorTicks.firstOrNull { it.tMs > cutsceneTickAfterInit.tMs && !it.isCutsceneActive && it.tMs <= evAbsMs + 14000L }?.tMs
                ?: evAbsMs
        } else {
            sensorTicks.firstOrNull { it.tMs >= evAbsMs && !it.isCutsceneActive && it.tMs <= evAbsMs + 4000L }?.tMs
                ?: evAbsMs
        }
        val preCutsceneEndMs = cutsceneTickAfterInit?.tMs ?: evAbsMs
        val preTick = sensorTicks.lastOrNull { it.tMs <= preCutsceneEndMs - 400L && !it.isCutsceneActive }
            ?: sensorTicks.lastOrNull { it.tMs <= preCutsceneEndMs && !it.isCutsceneActive }
            ?: sensorTicks.lastOrNull { it.tMs <= evAbsMs }
        val tick220 = sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 100L)..(postCutsceneAnchorMs + 420L) && !it.isCutsceneActive }
            ?: sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 100L)..(postCutsceneAnchorMs + 420L) }
        val tick650 = sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 430L)..(postCutsceneAnchorMs + 920L) && !it.isCutsceneActive }
            ?: sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 430L)..(postCutsceneAnchorMs + 920L) }
        val tick1200 = sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 930L)..(postCutsceneAnchorMs + 1750L) && !it.isCutsceneActive }
            ?: sensorTicks.firstOrNull { it.tMs in (postCutsceneAnchorMs + 930L)..(postCutsceneAnchorMs + 1750L) }
        val postCommittedTick = tick1200 ?: tick650 ?: tick220 ?: sensorTicks.firstOrNull { it.tMs >= postCutsceneAnchorMs && !it.isCutsceneActive }
            ?: sensorTicks.firstOrNull { it.tMs >= postCutsceneAnchorMs }

        val isUserAtk = ev.actor.equals("user", ignoreCase = true)
        val atkSpecies = ev.activePokemon.orEmpty()
        val defSpecies = if (isUserAtk) {
            oppTeamSpecs.getOrNull(postCommittedTick?.activeOppIdx ?: 0)?.species.orEmpty()
        } else {
            userTeamSpecs.getOrNull(postCommittedTick?.activeUserIdx ?: 0)?.species.orEmpty()
        }
        val userPre = if (!isUserAtk && ev.hpBeforePct != null) ev.hpBeforePct else (preTick?.committedPlayerHpPct ?: 100)
        val oppPre = if (isUserAtk && ev.hpBeforePct != null) ev.hpBeforePct else (preTick?.committedOppHpPct ?: 100)
        val userAfter = if (!isUserAtk && ev.hpAfterPct != null) ev.hpAfterPct else (postCommittedTick?.committedPlayerHpPct ?: userPre)
        val oppAfter = if (isUserAtk && ev.hpAfterPct != null) ev.hpAfterPct else (postCommittedTick?.committedOppHpPct ?: oppPre)

        audits.add(
            PostCutsceneHpAuditRecord(
                tSec = ev.t,
                actor = ev.actor,
                attackerSpecies = atkSpecies,
                defenderSpecies = defSpecies,
                moveName = ev.inferredMoveName.orEmpty(),
                shielded = ev.shielded == true,
                expectedDmgPct = ev.expectedMoveDmgPct,
                userHpPre = userPre,
                userHpScan220ms = tick220?.playerHpPct ?: -1,
                userHpScan650ms = tick650?.playerHpPct ?: -1,
                userHpScan1200ms = tick1200?.playerHpPct ?: -1,
                userHpCommittedAfter = userAfter,
                userHpRowY = postCommittedTick?.playerHpRowY ?: -1,
                oppHpPre = oppPre,
                oppHpScan220ms = tick220?.oppHpPct ?: -1,
                oppHpScan650ms = tick650?.oppHpPct ?: -1,
                oppHpScan1200ms = tick1200?.oppHpPct ?: -1,
                oppHpCommittedAfter = oppAfter,
                oppHpRowY = postCommittedTick?.oppHpRowY ?: -1
            )
        )
    }

    val ledger = mutableListOf<EnergyLedgerEntry>()
    val sourceCounts = mutableMapOf<String, Int>()
    var prevUserE = sensorTicks.first().userEnergy
    var prevOppE = sensorTicks.first().oppEnergy
    var prevUserIdx = sensorTicks.first().activeUserIdx
    var prevOppIdx = sensorTicks.first().activeOppIdx
    var turnsSinceCutscene = 0
    var lastTurnStepMs = t0Ms

    var rawVsCommittedUserDiffFrames = 0
    var rawVsCommittedOppDiffFrames = 0
    val validUserYs = mutableListOf<Int>()
    val validOppYs = mutableListOf<Int>()

    for (tick in sensorTicks) {
        if (tick.isCutsceneActive) {
            turnsSinceCutscene = 0
            lastTurnStepMs = tick.tMs
        } else {
            if (tick.tMs - lastTurnStepMs >= 500L) {
                turnsSinceCutscene += ((tick.tMs - lastTurnStepMs) / 500L).toInt().coerceIn(1, 4)
                lastTurnStepMs = tick.tMs
            }
            if (tick.playerHpPct in 1..100 && kotlin.math.abs(tick.playerHpPct - tick.committedPlayerHpPct) >= 5) {
                rawVsCommittedUserDiffFrames++
            }
            if (tick.oppHpPct in 1..100 && kotlin.math.abs(tick.oppHpPct - tick.committedOppHpPct) >= 5) {
                rawVsCommittedOppDiffFrames++
            }
            if (tick.playerHpRowY > 0) validUserYs.add(tick.playerHpRowY)
            if (tick.oppHpRowY > 0) validOppYs.add(tick.oppHpRowY)
        }

        val relSec = ((tick.tMs - t0Ms).coerceAtLeast(0L) / 100.0).roundToInt() / 10.0
        if (tick.userEnergy != prevUserE || tick.activeUserIdx != prevUserIdx) {
            val src = when {
                tick.activeUserIdx != prevUserIdx -> "SWAP_BANK"
                tick.energyMutationSource.isNotBlank() && tick.energyMutationSource != "NONE" -> tick.energyMutationSource
                tick.userEnergy < prevUserE -> "POST_THROW_DEDUCT"
                tick.leftFillPct in 1..300 || tick.rightFillPct in 1..300 -> "CIRCLE_FILL_SYNC"
                else -> "FAST_CADENCE"
            }
            sourceCounts[src] = (sourceCounts[src] ?: 0) + 1
            if (ledger.size < 250) {
                ledger.add(
                    EnergyLedgerEntry(
                        tSec = relSec,
                        actor = "user",
                        slotIdx = tick.activeUserIdx,
                        species = userTeamSpecs.getOrNull(tick.activeUserIdx)?.species.orEmpty(),
                        energyBefore = prevUserE,
                        energyAfter = tick.userEnergy,
                        deltaEnergy = tick.userEnergy - prevUserE,
                        source = src,
                        turnsSinceLastCutscene = turnsSinceCutscene,
                        leftCircleFillPct = tick.leftFillPct,
                        rightCircleFillPct = tick.rightFillPct
                    )
                )
            }
            prevUserE = tick.userEnergy
            prevUserIdx = tick.activeUserIdx
        }
        if (tick.oppEnergy != prevOppE || tick.activeOppIdx != prevOppIdx) {
            val src = when {
                tick.activeOppIdx != prevOppIdx -> "SWAP_BANK"
                tick.oppEnergy < prevOppE -> "POST_THROW_DEDUCT"
                else -> "FAST_CADENCE"
            }
            sourceCounts["OPP_$src"] = (sourceCounts["OPP_$src"] ?: 0) + 1
            if (ledger.size < 250) {
                ledger.add(
                    EnergyLedgerEntry(
                        tSec = relSec,
                        actor = "opp",
                        slotIdx = tick.activeOppIdx,
                        species = oppTeamSpecs.getOrNull(tick.activeOppIdx)?.species.orEmpty(),
                        energyBefore = prevOppE,
                        energyAfter = tick.oppEnergy,
                        deltaEnergy = tick.oppEnergy - prevOppE,
                        source = src,
                        turnsSinceLastCutscene = turnsSinceCutscene,
                        leftCircleFillPct = -1,
                        rightCircleFillPct = -1
                    )
                )
            }
            prevOppE = tick.oppEnergy
            prevOppIdx = tick.activeOppIdx
        }
    }

    val userYMin = validUserYs.minOrNull() ?: -1
    val userYMax = validUserYs.maxOrNull() ?: -1
    val oppYMin = validOppYs.minOrNull() ?: -1
    val oppYMax = validOppYs.maxOrNull() ?: -1
    val summary = mapOf<String, Any>(
        "rawVsCommittedUserHpDivergenceFrames" to rawVsCommittedUserDiffFrames,
        "rawVsCommittedOppHpDivergenceFrames" to rawVsCommittedOppDiffFrames,
        "userHpRowYMin" to userYMin,
        "userHpRowYMax" to userYMax,
        "userHpRowYSpanPx" to if (userYMin > 0 && userYMax >= userYMin) (userYMax - userYMin) else 0,
        "oppHpRowYMin" to oppYMin,
        "oppHpRowYMax" to oppYMax,
        "oppHpRowYSpanPx" to if (oppYMin > 0 && oppYMax >= oppYMin) (oppYMax - oppYMin) else 0,
        "postCutsceneAuditCount" to audits.size,
        "energyLedgerCount" to ledger.size,
        "energyMutationsBySource" to sourceCounts
    )
    return Triple(audits, ledger, summary)
}

/**
 * v6.29: Resilient DNS resolver for `silphscope-telemetry.silphscope-pvp.workers.dev`.
 * - Filters out unspecified/sinkholed IPv6/IPv4 records (`::`, `0:0:0:0:0:0:0:0`, `0.0.0.0`, `127.0.0.1`)
 *   that cause Android's `Dns.SYSTEM` to attempt connecting to `[::]:443` (localhost) and fail with
 *   `ConnectException: Failed to connect to silphscope-telemetry.silphscope-pvp.workers.dev/0:0:0:0:0:0:0:0:443`.
 * - Prioritizes IPv4 (`Inet4Address`) over IPv6 (`Inet6Address`).
 * - Falls back to Cloudflare DoH (`1.1.1.1`) and verified Cloudflare anycast IPv4 edge routes
 *   (`104.21.76.162`, `172.67.197.119`) if router/ISP/Private DNS blocks `*.workers.dev`.
 */
private val TELEMETRY_RESILIENT_DNS = object : okhttp3.Dns {
    override fun lookup(hostname: String): List<java.net.InetAddress> {
        val result = ArrayList<java.net.InetAddress>()
        try {
            val sysAddrs = okhttp3.Dns.SYSTEM.lookup(hostname)
            for (addr in sysAddrs) {
                val hostAddr = addr.hostAddress.orEmpty()
                val isBogus = addr.isAnyLocalAddress ||
                    addr.isLoopbackAddress ||
                    addr.isLinkLocalAddress ||
                    addr.isMulticastAddress ||
                    hostAddr == "::" ||
                    hostAddr == "0:0:0:0:0:0:0:0" ||
                    hostAddr == "0.0.0.0" ||
                    hostAddr.startsWith("127.") ||
                    hostAddr == "::1"
                if (!isBogus) {
                    result.add(addr)
                }
            }
        } catch (_: Exception) {
        }

        // Prioritize IPv4 (Inet4Address) before IPv6 (Inet6Address) to avoid broken IPv6 tunnels / :: sinkholes
        result.sortWith(compareBy { if (it is java.net.Inet4Address) 0 else 1 })

        if (hostname.equals("silphscope-telemetry.silphscope-pvp.workers.dev", ignoreCase = true) ||
            hostname.endsWith("silphscopepvp.com", ignoreCase = true)
        ) {
            if (result.none { it is java.net.Inet4Address }) {
                try {
                    val dohUrl = java.net.URL("https://1.1.1.1/dns-query?name=$hostname&type=A")
                    val conn = (dohUrl.openConnection() as java.net.HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 4000
                        readTimeout = 4000
                        setRequestProperty("Accept", "application/dns-json")
                    }
                    if (conn.responseCode in 200..299) {
                        val body = conn.inputStream.bufferedReader().use { it.readText() }
                        val ipRegex = Regex(""""data"\s*:\s*"(\d{1,3}(?:\.\d{1,3}){3})"""")
                        for (m in ipRegex.findAll(body)) {
                            val ipStr = m.groupValues[1]
                            val parts = ipStr.split(".").mapNotNull { it.toIntOrNull() }
                            if (parts.size == 4 && parts.all { it in 0..255 } && parts[0] != 0 && parts[0] != 127) {
                                val bytes = ByteArray(4) { idx -> parts[idx].toByte() }
                                result.add(0, java.net.InetAddress.getByAddress(hostname, bytes))
                            }
                        }
                    }
                } catch (_: Exception) {
                }
            }
            // Append verified Cloudflare anycast IPv4 edge addresses as guaranteed fallback routes
            try {
                val edgeIps = listOf(
                    byteArrayOf(104.toByte(), 21.toByte(), 56.toByte(), 111.toByte()),
                    byteArrayOf(172.toByte(), 67.toByte(), 184.toByte(), 167.toByte()),
                    byteArrayOf(104.toByte(), 21.toByte(), 76.toByte(), 162.toByte()),
                    byteArrayOf(172.toByte(), 67.toByte(), 197.toByte(), 119.toByte())
                )
                for (ipBytes in edgeIps) {
                    val cfAddr = java.net.InetAddress.getByAddress(hostname, ipBytes)
                    if (result.none { it.hostAddress == cfAddr.hostAddress }) {
                        result.add(cfAddr)
                    }
                }
            } catch (_: Exception) {
            }
        }

        if (result.isEmpty()) {
            return okhttp3.Dns.SYSTEM.lookup(hostname)
        }
        return result
    }
}

private val CLOUDFLARE_INGEST_BASE_URLS = listOf(
    OverlayService.CLOUDFLARE_TELEMETRY_WORKER_URL,
    OverlayService.CLOUDFLARE_DVR_VAULT_URL,
    "https://silphscope-telemetry.silphscope-pvp.workers.dev"
)

internal fun OverlayService.Companion.buildTelemetryHttpClientStatic(
    connectTimeoutSec: Long = 30L,
    writeTimeoutSec: Long = 180L,
    readTimeoutSec: Long = 90L
): OkHttpClient {
    return OkHttpClient.Builder()
        .dns(TELEMETRY_RESILIENT_DNS)
        .retryOnConnectionFailure(true)
        .protocols(listOf(okhttp3.Protocol.HTTP_1_1))
        .connectTimeout(connectTimeoutSec, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(writeTimeoutSec, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(readTimeoutSec, java.util.concurrent.TimeUnit.SECONDS)
        .build()
}

internal fun OverlayService.Companion.isDvrUploadAllowedOnCurrentNetworkStatic(prefs: SharedPreferences): Boolean {
    val allowMobile = prefs.getBoolean(OverlayService.PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD, OverlayService.DEFAULT_ALLOW_MOBILE_DATA_DVR_UPLOAD)
    if (allowMobile) return true
    val ctx = OverlayService.appContext ?: return true
    return try {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as? android.net.ConnectivityManager ?: return true
        val activeNet = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(activeNet) ?: return false
        val isWifiOrEthernet = caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI) ||
            caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_ETHERNET)
        if (isWifiOrEthernet) return true
        val isCellular = caps.hasTransport(android.net.NetworkCapabilities.TRANSPORT_CELLULAR)
        if (isCellular) return false
        val isUnmetered = caps.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
        isUnmetered || !cm.isActiveNetworkMetered
    } catch (_: Exception) {
        true
    }
}

internal fun OverlayService.Companion.countPendingCachedDvrBundlesStatic(cacheDir: File): Int {
    val files = cacheDir.listFiles() ?: return 0
    return files.count { f ->
        f.isFile && f.name.endsWith("_video.mp4") && f.name != "dvr_live_battle.mp4" && f.length() > 0L
    }
}

internal fun OverlayService.Companion.retryPendingCachedDvrBundlesBlocking(
    cacheDir: File,
    prefs: SharedPreferences,
    gson: Gson
): Pair<Int, String> {
    if (!isDvrUploadAllowedOnCurrentNetworkStatic(prefs)) {
        return 0 to "📶 Waiting for Wi-Fi to upload cached DVR videos"
    }
    if (OverlayService.isDvrUploadInFlight) {
        return 0 to ""
    }
    val mp4Files = (cacheDir.listFiles() ?: emptyArray())
        .filter { f -> f.isFile && f.name.endsWith("_video.mp4") && f.name != "dvr_live_battle.mp4" && f.length() > 0L }
        .sortedBy { it.lastModified() }
    if (mp4Files.isEmpty()) {
        return 0 to ""
    }

    val pendingLogs = loadPendingAiTelemetryLogsStatic(prefs, gson)
    val devHash = getDeviceTelemetryHashStatic(prefs)
    val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
        .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)

    var uploadedCount = 0
    var lastMsg = ""
    for (mp4File in mp4Files) {
        val cleanId = mp4File.name.removeSuffix("_video.mp4")
        val traceFile = File(cacheDir, "${cleanId}_deep_trace.jsonl")
        var summaryRecord = pendingLogs.firstOrNull {
            it.battleId.replace(Regex("[^a-zA-Z0-9_-]"), "") == cleanId
        }
        if (summaryRecord == null && traceFile.exists()) {
            try {
                val firstLine = traceFile.bufferedReader(Charsets.UTF_8).use { it.readLine() }.orEmpty()
                if (firstLine.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")) {
                    val obj = JsonParser.parseString(firstLine).asJsonObject
                    if (obj.has("battleSummary") && obj.get("battleSummary").isJsonObject) {
                        summaryRecord = gson.fromJson(obj.get("battleSummary"), AiTelemetryBattleRecordV510::class.java)
                    }
                }
            } catch (_: Exception) {}
        }
        if (summaryRecord == null) {
            var inferredUserLead = ""
            var inferredOppLead = ""
            if (traceFile.exists()) {
                try {
                    val lines = traceFile.readLines(Charsets.UTF_8).filter { it.isNotBlank() && !it.startsWith("{\"recordType\":") }
                    val lastFrameJson = lines.lastOrNull()
                    if (!lastFrameJson.isNullOrBlank()) {
                        val fObj = JsonParser.parseString(lastFrameJson).asJsonObject
                        inferredUserLead = fObj.get("userSpecies")?.asString.orEmpty()
                        inferredOppLead = fObj.get("oppSpecies")?.asString.orEmpty()
                    }
                } catch (_: Exception) {}
            }
            summaryRecord = AiTelemetryBattleRecordV510(
                schemaVersion = APP_VERSION,
                battleId = cleanId,
                timestampMs = mp4File.lastModified().takeIf { it > 0L } ?: System.currentTimeMillis(),
                appVersion = APP_VERSION,
                uploaderHandle = safeUser,
                deviceHash = devHash,
                teamName = "Recovered DVR Battle",
                result = "UNKNOWN",
                settingsProfileSignature = computeDebounceSettingsProfileSignatureStatic(prefs),
                userTeamSpecs = if (inferredUserLead.isNotBlank()) listOf(AiTelemetrySlotSpec(slotIndex = 0, species = inferredUserLead)) else emptyList(),
                oppTeamSpecs = if (inferredOppLead.isNotBlank()) listOf(AiTelemetryOppSlotSpec(slotIndex = 0, species = inferredOppLead)) else emptyList(),
                dvrVideoPath = "recordings/$safeUser/${cleanId}_video.mp4",
                dvrDeepTracePath = "recordings/$safeUser/${cleanId}_deep_trace.jsonl"
            )
        }
        val (ok, msg) = uploadBattleDvrBundleToGitHubBlocking(
            prefs = prefs,
            gson = gson,
            battleId = summaryRecord.battleId,
            summaryRecord = summaryRecord,
            mp4File = mp4File,
            traceFile = traceFile,
            deleteFilesOnSuccess = false
        )
        lastMsg = msg
        if (ok) {
            val tier = getEffectiveReplayTierStatic(prefs)
            var vaultOk = (tier == "free" || tier == "supporter")
            if (!vaultOk) {
                try {
                    val (vOk, _, _) = uploadBattleReplayToR2VaultIfUnlockedBlocking(
                        prefs = prefs,
                        gson = gson,
                        battleId = summaryRecord.battleId,
                        summaryRecord = summaryRecord,
                        mp4File = mp4File,
                        traceFile = traceFile
                    )
                    vaultOk = vOk
                } catch (_: Exception) {}
            }
            if (vaultOk) {
                try { mp4File.delete() } catch (_: Exception) {}
                try { traceFile.delete() } catch (_: Exception) {}
                uploadedCount++
            }
        }
    }
    return uploadedCount to lastMsg
}

/**
 * v6.29: Auto-uploads the 1-Battle Full-Screen DVR `.mp4` video and its frame-synced `_deep_trace.jsonl`
 * in a single multipart request to the SilphScope Cloudflare Worker (`POST /v1/dvr`), which stores both
 * in Cloudflare Storage (`recordings/<screenName>/<battleId>_video.mp4` & `_deep_trace.jsonl`).
 */
internal fun OverlayService.Companion.uploadBattleDvrBundleToGitHubBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510,
    mp4File: File,
    traceFile: File,
    deleteFilesOnSuccess: Boolean = true,
    userIssueNote: String = "",
    uploadReason: String = "",
    wasExplicitlyFlagged: Boolean = false
): Pair<Boolean, String> {
    OverlayService.isDvrUploadInFlight = true
    return try {
        if (!isDvrUploadAllowedOnCurrentNetworkStatic(prefs)) {
            return false to "📶 DVR queued for Wi-Fi (enable 'Upload Over Mobile Data' in Settings to upload on cellular)"
        }
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val cleanBattleId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val videoRepoPath = "recordings/$safeUser/${cleanBattleId}_video.mp4"
        val traceRepoPath = "recordings/$safeUser/${cleanBattleId}_deep_trace.jsonl"

        val httpClient = buildTelemetryHttpClientStatic(30L, 180L, 90L)

        // Prepend Battle Summary Header Line 0 to deep_trace.jsonl
        val resolvedDvrVer = summaryRecord.appVersion.takeIf { it.isNotBlank() && it != "5.10" } ?: APP_VERSION
        val cleanNote = userIssueNote.trim()
        val enrichedAnomalies = if (wasExplicitlyFlagged && summaryRecord.anomalies.none { it.type == "USER_MANUAL_ISSUE_REPORT" }) {
            summaryRecord.anomalies + BattleAnomalyRecord(
                type = "USER_MANUAL_ISSUE_REPORT",
                severity = "HIGH",
                tSec = 0.0,
                actor = "user",
                species = summaryRecord.userTeamSpecs.firstOrNull()?.species.orEmpty(),
                detail = if (cleanNote.isNotEmpty()) "User-flagged DVR issue report: $cleanNote" else "User manually flagged this battle for diagnostic review."
            )
        } else {
            summaryRecord.anomalies
        }
        val enrichedSummary = summaryRecord.copy(
            appVersion = resolvedDvrVer,
            schemaVersion = resolvedDvrVer,
            uploaderHandle = safeUser,
            anomalies = enrichedAnomalies,
            anomalyCount = enrichedAnomalies.size,
            hasHighSeverityAnomaly = summaryRecord.hasHighSeverityAnomaly || wasExplicitlyFlagged
        )
        val headerJson = gson.toJson(
            mapOf(
                "recordType" to "BATTLE_DVR_SUMMARY_HEADER",
                "appVersion" to resolvedDvrVer,
                "versionCode" to APP_VERSION_CODE,
                "battleId" to battleId,
                "screenName" to safeUser,
                "videoRepoPath" to videoRepoPath,
                "traceRepoPath" to traceRepoPath,
                "manuallyFlagged" to wasExplicitlyFlagged,
                "userIssueNote" to cleanNote,
                "uploadReason" to uploadReason,
                "battleSummary" to enrichedSummary
            )
        ) + "\n"
        val traceBodyText = if (traceFile.exists()) traceFile.readText(Charsets.UTF_8) else ""
        val alreadyHasHeader = traceBodyText.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")
        val combinedTraceText = if (alreadyHasHeader) {
            if (wasExplicitlyFlagged || cleanNote.isNotEmpty()) {
                val nlIdx = traceBodyText.indexOf('\n')
                if (nlIdx >= 0) headerJson + traceBodyText.substring(nlIdx + 1) else headerJson
            } else {
                traceBodyText
            }
        } else {
            headerJson + traceBodyText
        }
        if ((!alreadyHasHeader || wasExplicitlyFlagged || cleanNote.isNotEmpty()) && traceFile.exists()) {
            try {
                traceFile.writeText(combinedTraceText, Charsets.UTF_8)
            } catch (_: Exception) {}
        }
        val frameCount = combinedTraceText.lineSequence().count {
            it.isNotBlank() && !it.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")
        }

        val userList = summaryRecord.userTeamSpecs.map { it.species }.filter { it.isNotBlank() }.joinToString(", ")
        val oppList = summaryRecord.oppTeamSpecs.map { it.species }.filter { it.isNotBlank() }.joinToString(", ")
        val matchupSummary = buildString {
            if (userList.isNotBlank()) append("$userList vs ")
            append(oppList.ifBlank { "Opponent" })
            if (summaryRecord.anomalyCount > 0) {
                append(" • ${summaryRecord.anomalyCount} anomalies")
            }
        }

        val metadataJson = gson.toJson(
            mapOf(
                "battleId" to cleanBattleId,
                "screenName" to safeUser,
                "deviceId" to devHash,
                "appVersion" to resolvedDvrVer,
                "versionCode" to APP_VERSION_CODE,
                "league" to summaryRecord.league,
                "result" to summaryRecord.result,
                "matchupSummary" to matchupSummary,
                "frameCount" to frameCount,
                "userIssueNote" to userIssueNote,
                "uploadReason" to uploadReason,
                "manuallyFlagged" to wasExplicitlyFlagged,
                "wasExplicitlyFlagged" to wasExplicitlyFlagged
            )
        )

        val hasVideo = mp4File.exists() && mp4File.length() > 0L
        var uploadOk = false
        var httpCode = 0
        var lastErrorMsg = ""

        for (attempt in 1..3) {
            val baseUrl = CLOUDFLARE_INGEST_BASE_URLS.getOrElse(attempt - 1) { CLOUDFLARE_TELEMETRY_WORKER_URL }
            try {
                val multipartBuilder = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("metadata", metadataJson)
                    .addFormDataPart(
                        "deep_trace",
                        "${cleanBattleId}_deep_trace.jsonl",
                        combinedTraceText.toRequestBody("application/x-ndjson; charset=utf-8".toMediaTypeOrNull())
                    )
                if (hasVideo) {
                    multipartBuilder.addFormDataPart(
                        "video",
                        "${cleanBattleId}_video.mp4",
                        mp4File.asRequestBody("video/mp4".toMediaTypeOrNull())
                    )
                }
                val req = applyWorkerClientAuthHeaders(
                    Request.Builder()
                        .url("$baseUrl/v1/dvr")
                        .post(multipartBuilder.build()),
                    prefs,
                    safeUser,
                    devHash
                ).build()

                httpClient.newCall(req).execute().use { resp ->
                    httpCode = resp.code
                    uploadOk = resp.isSuccessful
                    if (!uploadOk) {
                        val errBody = try { resp.body?.string().orEmpty() } catch (_: Exception) { "" }
                        val parsedErr = try { JsonParser.parseString(errBody).asJsonObject.get("error")?.asString.orEmpty() } catch (_: Exception) { "" }
                        if (parsedErr.isNotBlank()) lastErrorMsg = parsedErr
                    }
                }
                if (uploadOk || (httpCode in 400..499 && httpCode != 404 && httpCode != 429)) {
                    break
                }
            } catch (e: Exception) {
                lastErrorMsg = e.localizedMessage ?: e.javaClass.simpleName
            }
            if (attempt < 3) {
                try { Thread.sleep(1500L * attempt) } catch (_: Exception) {}
            }
        }

        val nowMs = System.currentTimeMillis()
        if (uploadOk) {
            val prevCount = prefs.getInt(PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT, 0)
            prefs.edit()
                .putLong(PREFS_KEY_LAST_DVR_UPLOAD_MS, nowMs)
                .putString(PREFS_KEY_LAST_DVR_UPLOAD_PATH, videoRepoPath)
                .putInt(PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT, prevCount + 1)
                .apply()
            val prevMap = loadReplayVaultMapStatic(prefs, gson)
            val prevEntry = prevMap[cleanBattleId]
            if (prevEntry != null || wasExplicitlyFlagged) {
                prevMap[cleanBattleId] = (prevEntry ?: OverlayService.Companion.ReplayVaultEntryMeta(battleId = cleanBattleId)).copy(
                    manuallyFlagged = wasExplicitlyFlagged,
                    userIssueNote = if (wasExplicitlyFlagged) cleanNote else ""
                )
                saveReplayVaultMapStatic(prefs, gson, prevMap)
            }
            if (deleteFilesOnSuccess) {
                try { mp4File.delete() } catch (_: Exception) {}
                try { traceFile.delete() } catch (_: Exception) {}
            }
            true to "🎥 Uploaded 1-Battle Video & Deep Trace ($cleanBattleId) as @$safeUser!"
        } else if (httpCode > 0) {
            val errSuffix = if (lastErrorMsg.isNotBlank()) ": $lastErrorMsg" else ""
            false to "⚠️ 1-Battle DVR upload queued for retry (HTTP $httpCode$errSuffix)"
        } else {
            false to "⚠️ DVR upload queued for retry (${lastErrorMsg.ifBlank { "Network error" }})"
        }
    } catch (e: Exception) {
        false to "⚠️ DVR upload queued for retry: ${e.localizedMessage ?: "Network error"}"
    } finally {
        OverlayService.isDvrUploadInFlight = false
    }
}

internal fun OverlayService.Companion.prependDvrSummaryHeaderIfNeededStatic(
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510,
    traceFile: File,
    manuallyFlagged: Boolean = false,
    userIssueNote: String = ""
) {
    if (!traceFile.exists()) return
    try {
        val text = traceFile.readText(Charsets.UTF_8)
        val alreadyHasHeader = text.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")
        val cleanNote = userIssueNote.trim()
        if (alreadyHasHeader && !manuallyFlagged && cleanNote.isEmpty()) return
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val resolvedVer = summaryRecord.appVersion.takeIf { it.isNotBlank() && it != "5.10" } ?: APP_VERSION
        val enrichedAnomalies = if (manuallyFlagged && summaryRecord.anomalies.none { it.type == "USER_MANUAL_ISSUE_REPORT" }) {
            summaryRecord.anomalies + BattleAnomalyRecord(
                type = "USER_MANUAL_ISSUE_REPORT",
                severity = "HIGH",
                tSec = 0.0,
                actor = "user",
                species = summaryRecord.userTeamSpecs.firstOrNull()?.species.orEmpty(),
                detail = if (cleanNote.isNotEmpty()) "User-flagged DVR issue report: $cleanNote" else "User manually flagged this battle for diagnostic review."
            )
        } else {
            summaryRecord.anomalies
        }
        val headerJson = gson.toJson(
            mapOf(
                "recordType" to "BATTLE_DVR_SUMMARY_HEADER",
                "appVersion" to resolvedVer,
                "versionCode" to APP_VERSION_CODE,
                "battleId" to battleId,
                "screenName" to safeUser,
                "videoRepoPath" to "recordings/$safeUser/${cleanId}_video.mp4",
                "traceRepoPath" to "recordings/$safeUser/${cleanId}_deep_trace.jsonl",
                "manuallyFlagged" to manuallyFlagged,
                "userIssueNote" to cleanNote,
                "battleSummary" to summaryRecord.copy(
                    appVersion = resolvedVer,
                    schemaVersion = resolvedVer,
                    uploaderHandle = safeUser,
                    anomalies = enrichedAnomalies,
                    anomalyCount = enrichedAnomalies.size,
                    hasHighSeverityAnomaly = summaryRecord.hasHighSeverityAnomaly || manuallyFlagged
                )
            )
        ) + "\n"
        val updatedText = if (alreadyHasHeader) {
            val nlIdx = text.indexOf('\n')
            if (nlIdx >= 0) headerJson + text.substring(nlIdx + 1) else headerJson
        } else {
            headerJson + text
        }
        traceFile.writeText(updatedText, Charsets.UTF_8)
    } catch (_: Exception) {}
}

@Volatile
private var cachedReplayVaultMapRawRef: String? = null
@Volatile
private var cachedReplayVaultMapSnapshot: Map<String, OverlayService.Companion.ReplayVaultEntryMeta> = emptyMap()

internal fun OverlayService.Companion.loadReplayVaultMapStatic(
    prefs: SharedPreferences,
    gson: Gson
): MutableMap<String, OverlayService.Companion.ReplayVaultEntryMeta> {
    val rawPref = prefs.getString(OverlayService.PREFS_KEY_REPLAY_VAULT_MAP_JSON, null)
    if (rawPref.isNullOrBlank() || rawPref == "{}") {
        cachedReplayVaultMapRawRef = rawPref
        cachedReplayVaultMapSnapshot = emptyMap()
        return LinkedHashMap()
    }
    if (rawPref === cachedReplayVaultMapRawRef) {
        return LinkedHashMap(cachedReplayVaultMapSnapshot)
    }
    val raw = rawPref.trim()
    if (raw.isEmpty()) return LinkedHashMap()
    return try {
        val type = object : TypeToken<MutableMap<String, OverlayService.Companion.ReplayVaultEntryMeta>>() {}.type
        val parsed = gson.fromJson<MutableMap<String, OverlayService.Companion.ReplayVaultEntryMeta>>(raw, type) ?: LinkedHashMap()
        cachedReplayVaultMapRawRef = rawPref
        cachedReplayVaultMapSnapshot = LinkedHashMap(parsed)
        parsed
    } catch (_: Exception) {
        LinkedHashMap()
    }
}

internal fun OverlayService.Companion.saveReplayVaultMapStatic(
    prefs: SharedPreferences,
    gson: Gson,
    map: Map<String, OverlayService.Companion.ReplayVaultEntryMeta>
) {
    val jsonStr = gson.toJson(map)
    cachedReplayVaultMapRawRef = jsonStr
    cachedReplayVaultMapSnapshot = LinkedHashMap(map)
    prefs.edit().putString(OverlayService.PREFS_KEY_REPLAY_VAULT_MAP_JSON, jsonStr).apply()
}

internal fun OverlayService.Companion.getEffectiveReplayTierStatic(prefs: SharedPreferences): String {
    val unlockKey = getEffectiveReplayUnlockKey(prefs)
    val rawTier = (prefs.getString(OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER, "free") ?: "free").lowercase()
    val everPaid = prefs.getBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, false)
    val offlineSig = prefs.getString(OverlayService.PREFS_KEY_REPLAY_OFFLINE_SIG, "")?.trim().orEmpty()
    val vaultSession = getVaultSessionTokenStatic(prefs)
    val expiresAtStr = prefs.getString(OverlayService.PREFS_KEY_REPLAY_EXPIRES_AT, "")?.trim().orEmpty()

    // Anti-Spoofing: If no unlock key, offline sig, or authenticated vault session and never verified via key/claim, default to free
    if (unlockKey.isEmpty() && !everPaid && offlineSig.isEmpty() && vaultSession.isEmpty() && rawTier != "free") {
        return "free"
    }

    // Check offline expiration: if Pro/VIP expired locally, automatically graduate to "supporter" (Alumni)
    if (expiresAtStr.isNotEmpty() && (rawTier == "pro" || rawTier == "vip")) {
        try {
            val expMs = java.time.Instant.parse(expiresAtStr).toEpochMilli()
            if (expMs < System.currentTimeMillis()) {
                return "supporter"
            }
        } catch (_: Exception) {}
    }

    return when (rawTier) {
        "vip" -> "vip"
        "pro" -> "pro"
        "supporter", "base" -> "supporter"
        else -> if (everPaid) "supporter" else "free"
    }
}

internal fun OverlayService.Companion.getMaxLocalDvrBattlesForTierStatic(prefs: SharedPreferences): Int {
    return when (getEffectiveReplayTierStatic(prefs)) {
        "vip" -> prefs.getInt(OverlayService.PREFS_KEY_VIP_LOCAL_DVR_LIMIT, OverlayService.DEFAULT_VIP_LOCAL_DVR_LIMIT).coerceIn(25, 100)
        "pro" -> 25
        "supporter" -> 5
        else -> 1
    }
}

internal fun OverlayService.Companion.getEffectiveDvrFpsForTierStatic(prefs: SharedPreferences): Int {
    if (prefs.contains(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE) &&
        prefs.getInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, OverlayService.DEFAULT_VIP_DVR_FPS_MODE) != 30
    ) {
        prefs.edit().putInt(OverlayService.PREFS_KEY_VIP_DVR_FPS_MODE, 30).apply()
    }
    return if (getEffectiveReplayTierStatic(prefs) == "vip") 30 else 15
}

internal fun OverlayService.Companion.enforceLocalDvrReplaysQuotaStatic(
    filesDir: File,
    prefs: SharedPreferences,
    gson: Gson
) {
    val replaysDir = File(filesDir, "dvr_replays")
    if (!replaysDir.exists()) return
    val tier = getEffectiveReplayTierStatic(prefs)
    val maxUnpinnedLocal = getMaxLocalDvrBattlesForTierStatic(prefs)
    val maxLocalBytes = when (tier) {
        "vip" -> 3000L * 1024L * 1024L
        "pro" -> 800L * 1024L * 1024L
        "supporter" -> 200L * 1024L * 1024L
        else -> 60L * 1024L * 1024L
    }
    val vaultMap = loadReplayVaultMapStatic(prefs, gson)

    val mp4Files = (replaysDir.listFiles { f -> f.isFile && f.name.endsWith("_video.mp4") }?.toList() ?: emptyList())
        .sortedByDescending { it.lastModified() }

    var unpinnedCount = 0
    val keptMp4 = mutableListOf<File>()
    for (mp4 in mp4Files) {
        val cleanId = mp4.name.removeSuffix("_video.mp4")
        val meta = vaultMap[cleanId]
        val isPinned = meta?.isPinned == true && tier != "free"
        if (isPinned) {
            keptMp4.add(mp4)
        } else {
            unpinnedCount++
            if (unpinnedCount > maxUnpinnedLocal) {
                try { mp4.delete() } catch (_: Exception) {}
                try { File(replaysDir, "${cleanId}_deep_trace.jsonl").delete() } catch (_: Exception) {}
            } else {
                keptMp4.add(mp4)
            }
        }
    }

    var totalBytes = keptMp4.sumOf { mp4 ->
        val cleanId = mp4.name.removeSuffix("_video.mp4")
        val tr = File(replaysDir, "${cleanId}_deep_trace.jsonl")
        mp4.length() + (if (tr.exists()) tr.length() else 0L)
    }
    for (i in keptMp4.indices.reversed()) {
        if (totalBytes <= maxLocalBytes) break
        val mp4 = keptMp4[i]
        val cleanId = mp4.name.removeSuffix("_video.mp4")
        val isPinned = vaultMap[cleanId]?.isPinned == true && tier != "free"
        if (!isPinned && keptMp4.size > 1) {
            val tr = File(replaysDir, "${cleanId}_deep_trace.jsonl")
            val freed = mp4.length() + (if (tr.exists()) tr.length() else 0L)
            try { mp4.delete() } catch (_: Exception) {}
            try { tr.delete() } catch (_: Exception) {}
            totalBytes = (totalBytes - freed).coerceAtLeast(0L)
        }
    }
}

internal fun OverlayService.Companion.registerUniqueScreenNameBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    desiredScreenName: String,
    email: String = ""
): Pair<Boolean, String> {
    return try {
        val cleanName = sanitizeScreenNameStatic(desiredScreenName)
        if (cleanName.isEmpty()) {
            return false to "⚠️ Enter a valid Trainer ID (3–24 letters/numbers, not 'anonymous')."
        }
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val ghToken = getEffectiveSyncToken(prefs)
        val ghId = if (ghToken.isNotEmpty()) prefs.getString(PREFS_KEY_SYNC_GITHUB_USER_ID, "")?.trim().orEmpty() else ""
        val httpClient = buildTelemetryHttpClientStatic(12L, 20L, 15L)
        val reqBody = gson.toJson(
            mapOf(
                "screenName" to cleanName,
                "deviceHash" to devHash,
                "githubToken" to ghToken,
                "githubUserId" to ghId,
                "email" to email.trim()
            )
        ).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val reqBuilder = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/users/register-name")
                .post(reqBody),
            prefs,
            cleanName,
            devHash
        )
        if (ghToken.isNotEmpty()) reqBuilder.header("X-GitHub-Token", ghToken)
        val req = reqBuilder.build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful && bodyStr.isBlank()) {
                return false to "⚠️ Registration check failed (HTTP ${resp.code})"
            }
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val devToken = root.get("deviceIngestToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (devToken.isNotBlank()) {
                setDeviceIngestTokenStatic(prefs, devToken)
            }
            val available = root.get("available")?.asBoolean ?: false
            val err = root.get("error")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (!available) {
                return false to (err.ifBlank { "⚠️ '@$cleanName' is already registered by another player." })
            }
            prefs.edit()
                .putString(PREFS_KEY_USER_SCREEN_NAME, cleanName)
                .putBoolean(PREFS_KEY_IS_RANDOM_SCREEN_NAME, false)
                .putString(PREFS_KEY_SCREEN_NAME_REGISTERED_V700, cleanName)
                .apply {
                    if (email.isNotBlank()) putString(PREFS_KEY_CLAIM_EMAIL, email.trim())
                }
                .apply()

            val promoObj = root.get("seasonPromo")?.takeIf { it.isJsonObject }?.asJsonObject
            val introEligible = promoObj?.get("introPromoEligible")?.asBoolean ?: false
            val daysLeft = promoObj?.get("daysRemaining")?.asInt ?: 0
            val promoNote = if (introEligible) {
                " • 🎉 Eligible for Day 15+ First-Season Promo ($3 Pro / $5 VIP for remaining ${daysLeft}d of season)!"
            } else {
                " • Ready for Season Pass / Supporter checkout."
            }
            true to "✅ '@$cleanName' verified & locked to your device!$promoNote"
        }
    } catch (e: Exception) {
        false to "⚠️ Name check error: ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.verifyReplayUnlockKeyBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    inputKey: String = "",
    claimEmail: String = ""
): Pair<Boolean, String> {
    return try {
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val keyToUse = inputKey.trim().ifEmpty {
            getEffectiveReplayUnlockKey(prefs)
        }
        val ghToken = getEffectiveSyncToken(prefs)
        val ghUser = if (ghToken.isNotEmpty()) prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty() else ""
        val ghId = if (ghToken.isNotEmpty()) prefs.getString(OverlayService.PREFS_KEY_SYNC_GITHUB_USER_ID, "")?.trim().orEmpty() else ""
        val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)
        val emailToUse = claimEmail.trim().ifEmpty {
            prefs.getString(OverlayService.PREFS_KEY_CLAIM_EMAIL, "")?.trim().orEmpty()
        }
        val reqMap = mutableMapOf<String, Any>(
            "unlockKey" to keyToUse,
            "deviceHash" to devHash
        )
        if (emailToUse.isNotEmpty()) reqMap["claimEmail"] = emailToUse
        if (ghToken.isNotEmpty()) reqMap["githubToken"] = ghToken
        if (ghUser.isNotEmpty()) reqMap["githubUsername"] = ghUser
        if (ghId.isNotEmpty()) reqMap["githubUserId"] = ghId
        val reqBody = gson.toJson(reqMap)
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val reqBuilder = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/license/verify")
                .post(reqBody)
                .header("X-SilphScope-Unlock-Key", keyToUse),
            prefs,
            safeUser,
            devHash
        )
        if (emailToUse.isNotEmpty()) reqBuilder.header("X-Claim-Email", emailToUse)
        if (ghToken.isNotEmpty()) reqBuilder.header("X-GitHub-Token", ghToken)
        if (ghUser.isNotEmpty()) reqBuilder.header("X-GitHub-Username", ghUser)
        if (ghId.isNotEmpty()) reqBuilder.header("X-GitHub-User-Id", ghId)
        val req = reqBuilder.build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                return false to "Verification failed (HTTP ${resp.code})"
            }
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val devToken = root.get("deviceIngestToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (devToken.isNotBlank()) {
                setDeviceIngestTokenStatic(prefs, devToken)
            }
            val rawTier = root.get("tier")?.asString?.lowercase() ?: "free"
            val tier = if (rawTier == "base") "supporter" else rawTier
            val active = root.get("active")?.asBoolean ?: false
            val everPaid = root.get("everPaid")?.asBoolean ?: (active && tier != "free")
            val sig = root.get("signature")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            val err = root.get("error")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            val licObj = root.get("license")?.takeIf { it.isJsonObject }?.asJsonObject
            val resolvedKey = licObj?.get("key")?.takeIf { !it.isJsonNull }?.asString?.ifBlank { keyToUse } ?: keyToUse
            val expiresAt = licObj?.get("expiresAt")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            val label = licObj?.get("label")?.takeIf { !it.isJsonNull }?.asString ?: tier.uppercase()

            val prevKey = getEffectiveReplayUnlockKey(prefs)
            val newKeyVal = if (active) resolvedKey else keyToUse
            val editor = prefs.edit()
                .putString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, encryptSecretWithKeystore(newKeyVal))
                .putString(OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER, if (active) tier else if (everPaid) "supporter" else "free")
                .putBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, everPaid)
                .putString(OverlayService.PREFS_KEY_REPLAY_EXPIRES_AT, expiresAt)
                .putString(OverlayService.PREFS_KEY_REPLAY_OFFLINE_SIG, sig)
                .putString(OverlayService.PREFS_KEY_REPLAY_LICENSE_JSON, bodyStr)
                .putLong(OverlayService.PREFS_KEY_LAST_LICENSE_BG_VERIFY_MS, System.currentTimeMillis())
            if (emailToUse.isNotEmpty()) {
                editor.putString(OverlayService.PREFS_KEY_CLAIM_EMAIL, emailToUse)
            }
            if (newKeyVal.isNotEmpty() && newKeyVal != prevKey) {
                editor.putLong(PREFS_KEY_USER_SETTINGS_UPDATED_AT, System.currentTimeMillis())
            }
            editor.apply()

            if (active && tier != "free") {
                if (tier == "pro" || tier == "vip") {
                    syncCloudReplayListBlocking(prefs, gson)
                }
                val syncNote = if (ghUser.isNotEmpty()) " • 🔒 Synced via @$ghUser" else " • 📴 Offline-Ready"
                true to "✅ Active Tier: $label (@$safeUser$syncNote)"
            } else if (err.isNotBlank()) {
                false to "⚠️ $err"
            } else {
                true to "ℹ️ Free Tier active (1 Local Replay + GL/ML 1-Team Anti-Meta)"
            }
        }
    } catch (e: Exception) {
        val cachedTier = getEffectiveReplayTierStatic(prefs)
        if (cachedTier != "free") {
            true to "📴 Offline Mode — Cached ${cachedTier.uppercase()} tier active"
        } else {
            false to "⚠️ License check failed: ${e.localizedMessage ?: "Network error"}"
        }
    }
}

internal fun OverlayService.Companion.setOrLoginVaultPasswordBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    passwordInput: String,
    isSettingNewPassword: Boolean,
    currentPassword: String = "",
    targetScreenName: String = ""
): Pair<Boolean, String> {
    return try {
        val cleanPw = passwordInput.trim()
        if (isSettingNewPassword && (cleanPw.length < 8 || cleanPw.length > 128)) {
            return false to "⚠️ Vault Password must be between 8 and 128 characters."
        }
        if (!isSettingNewPassword && cleanPw.isEmpty()) {
            return false to "⚠️ Enter your Vault Password to sign in."
        }

        val devHash = getDeviceTelemetryHashStatic(prefs)
        val prevUser = sanitizeScreenNameStatic(getRequiredScreenNameStatic(prefs))
        val desiredUser = if (targetScreenName.isNotBlank()) {
            sanitizeScreenNameStatic(targetScreenName)
        } else {
            prevUser
        }
        if (!isValidScreenNameStatic(desiredUser)) {
            return false to "⚠️ Choose a custom Trainer ID (3–24 letters/numbers) first."
        }

        val unlockKey = getEffectiveReplayUnlockKey(prefs)
        val vaultSession = getVaultSessionTokenStatic(prefs)
        val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)

        val endpoint = if (isSettingNewPassword) "/v1/auth/set-password" else "/v1/auth/login"
        val reqMap = mutableMapOf<String, Any>(
            "screenName" to desiredUser,
            "deviceHash" to devHash
        )
        if (unlockKey.isNotBlank()) reqMap["unlockKey"] = unlockKey
        if (vaultSession.isNotBlank()) reqMap["sessionToken"] = vaultSession
        if (isSettingNewPassword) {
            reqMap["newPassword"] = cleanPw
            if (currentPassword.isNotBlank()) {
                reqMap["currentPassword"] = currentPassword.trim()
            }
        } else {
            reqMap["password"] = cleanPw
        }

        val reqBody = gson.toJson(reqMap)
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val reqBuilder = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL$endpoint")
                .post(reqBody),
            prefs,
            desiredUser,
            devHash
        )
        if (unlockKey.isNotBlank()) {
            reqBuilder.header("X-SilphScope-Unlock-Key", unlockKey)
        }
        val req = reqBuilder.build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            val root = try { JsonParser.parseString(bodyStr).asJsonObject } catch (_: Exception) { null }
            val ok = resp.isSuccessful && (root?.get("ok")?.asBoolean == true)
            if (!ok) {
                val err = root?.get("error")?.takeIf { !it.isJsonNull }?.asString ?: "HTTP ${resp.code}"
                return false to "⚠️ $err"
            }

            val resolvedName = root?.get("screenName")?.takeIf { !it.isJsonNull }?.asString
                ?.let { sanitizeScreenNameStatic(it) }
                ?.takeIf { isValidScreenNameStatic(it) }
                ?: desiredUser
            val sessionTok = root?.get("sessionToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (sessionTok.isNotBlank()) {
                setVaultSessionTokenStatic(prefs, sessionTok)
            }

            val editor = prefs.edit()
                .putBoolean(OverlayService.PREFS_KEY_VAULT_HAS_PASSWORD, true)
                .putBoolean(OverlayService.PREFS_KEY_VAULT_REQUIRES_PASSWORD, false)
                .putLong(OverlayService.PREFS_KEY_VAULT_PW_PROMPT_SNOOZED_UNTIL, 0L)

            if (!resolvedName.equals(prevUser, ignoreCase = true)) {
                editor
                    .putString(PREFS_KEY_USER_SCREEN_NAME, resolvedName)
                    .putBoolean(OverlayService.PREFS_KEY_IS_RANDOM_SCREEN_NAME, OverlayService.isRandomScreenNameFormatStatic(resolvedName))
                    .putLong(OverlayService.PREFS_KEY_CLOUD_SYNC_CURSOR_MS, 0L)
                    .putLong(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_MS, 0L)
                    .putLong(OverlayService.PREFS_KEY_CLOUD_LAST_PUSHED_SETTINGS_MS, 0L)
            }

            if (!isSettingNewPassword && root != null) {
                val rawTier = root.get("tier")?.asString?.lowercase() ?: "free"
                val tier = if (rawTier == "base") "supporter" else rawTier
                val active = root.get("active")?.asBoolean ?: false
                val everPaid = root.get("everPaid")?.asBoolean ?: (active && tier != "free")
                val sig = root.get("signature")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val licObj = root.get("license")?.takeIf { it.isJsonObject }?.asJsonObject
                val resolvedKey = licObj?.get("key")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                val expiresAt = licObj?.get("expiresAt")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                editor
                    .putString(OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER, if (active) tier else if (everPaid) "supporter" else "free")
                    .putBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, everPaid)
                    .putString(OverlayService.PREFS_KEY_REPLAY_OFFLINE_SIG, sig)
                if (expiresAt.isNotBlank()) {
                    editor.putString(OverlayService.PREFS_KEY_REPLAY_EXPIRES_AT, expiresAt)
                }
                if (resolvedKey.isNotBlank()) {
                    editor.putString(OverlayService.PREFS_KEY_REPLAY_UNLOCK_KEY, encryptSecretWithKeystore(resolvedKey))
                }
                editor.apply()
                return true to "✅ Signed in to @$resolvedName Cloud Vault (${tier.uppercase()})!"
            }

            editor.apply()
            true to "🔐 Vault Password saved for @$resolvedName! Your Cloud Sync Vault is now locked & ready across devices and the Web Simulator."
        }
    } catch (e: Exception) {
        false to "⚠️ ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.updateVaultVisibilitySettingBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    publicVisibility: String
): Pair<Boolean, String> {
    return try {
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val unlockKey = getEffectiveReplayUnlockKey(prefs)
        val ghToken = getEffectiveSyncToken(prefs)
        val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)
        val reqMap = mutableMapOf<String, Any>(
            "publicVisibility" to publicVisibility,
            "unlockKey" to unlockKey,
            "deviceHash" to devHash
        )
        if (ghToken.isNotEmpty()) reqMap["githubToken"] = ghToken
        val reqBody = gson.toJson(reqMap)
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val req = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/settings")
                .post(reqBody)
                .header("X-SilphScope-Unlock-Key", unlockKey),
            prefs,
            safeUser,
            devHash
        ).build()
        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            val root = try { JsonParser.parseString(bodyStr).asJsonObject } catch (_: Exception) { null }
            val ok = resp.isSuccessful && (root?.get("ok")?.asBoolean == true)
            if (!ok) {
                val err = root?.get("error")?.takeIf { !it.isJsonNull }?.asString ?: "HTTP ${resp.code}"
                return false to "⚠️ $err"
            }
            prefs.edit().putString("gbl_vault_public_visibility_v701", publicVisibility).apply()
            true to "✅ Updated @$safeUser's DVR Vault visibility to: $publicVisibility"
        }
    } catch (e: Exception) {
        false to "⚠️ ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.syncCloudReplayListBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    forceFullPull: Boolean = false
): Pair<Boolean, String> {
    return try {
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val unlockKey = getEffectiveReplayUnlockKey(prefs)
        val ghToken = getEffectiveSyncToken(prefs)
        val ghUser = if (ghToken.isNotEmpty()) prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty() else ""
        val ghId = if (ghToken.isNotEmpty()) prefs.getString(OverlayService.PREFS_KEY_SYNC_GITHUB_USER_ID, "")?.trim().orEmpty() else ""
        val existingMap = loadReplayVaultMapStatic(prefs, gson)
        val savedReplayUser = prefs.getString(OverlayService.PREFS_KEY_REPLAY_LIST_SYNC_USER, "") ?: ""
        val savedReplayCursorMs = if (!forceFullPull &&
            savedReplayUser.equals(safeUser, ignoreCase = true) &&
            existingMap.isNotEmpty()
        ) {
            prefs.getLong(OverlayService.PREFS_KEY_REPLAY_LIST_SYNC_CURSOR_MS, 0L)
        } else {
            0L
        }
        val listUrl = if (savedReplayCursorMs > 0L) {
            "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/list?since=$savedReplayCursorMs&delta=1"
        } else {
            "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/list"
        }
        val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)
        val reqBuilder = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url(listUrl)
                .get()
                .header("X-SilphScope-Unlock-Key", unlockKey),
            prefs,
            safeUser,
            devHash
        )
        if (ghToken.isNotEmpty()) reqBuilder.header("X-GitHub-Token", ghToken)
        if (ghUser.isNotEmpty()) reqBuilder.header("X-GitHub-Username", ghUser)
        if (ghId.isNotEmpty()) reqBuilder.header("X-GitHub-User-Id", ghId)
        val req = reqBuilder.build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                return false to "HTTP ${resp.code}"
            }
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val devToken = root.get("deviceIngestToken")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (devToken.isNotBlank()) {
                setDeviceIngestTokenStatic(prefs, devToken)
            }
            val tier = root.get("tier")?.asString?.lowercase() ?: "free"
            val active = root.get("active")?.asBoolean ?: false
            val updatedAtMs = root.get("updatedAtMs")?.takeIf { !it.isJsonNull }?.asLong ?: 0L
            val metaEditor = prefs.edit()
                .putString(OverlayService.PREFS_KEY_REPLAY_LIST_SYNC_USER, safeUser)
            if (updatedAtMs > 0L) {
                metaEditor.putLong(OverlayService.PREFS_KEY_REPLAY_LIST_SYNC_CURSOR_MS, updatedAtMs)
            }
            if (active) {
                metaEditor.putString(OverlayService.PREFS_KEY_REPLAY_LICENSE_TIER, tier)
                if (tier != "free") {
                    metaEditor.putBoolean(OverlayService.PREFS_KEY_REPLAY_EVER_PAID, true)
                }
            }
            metaEditor.apply()

            if (root.get("unchanged")?.takeIf { !it.isJsonNull }?.asBoolean == true) {
                return true to "Cloud replays up to date (${existingMap.size} cached)"
            }

            val isDelta = root.get("delta")?.takeIf { !it.isJsonNull }?.asBoolean == true
            val map = if (isDelta) existingMap else LinkedHashMap()

            if (isDelta) {
                root.getAsJsonArray("deletedBattleIds")?.forEach { el ->
                    val bId = el?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                    if (bId.isNotBlank()) map.remove(bId)
                }
                val activeShares = root.getAsJsonArray("activeShareIds")?.mapNotNull { el ->
                    el?.takeIf { !it.isJsonNull }?.asString?.takeIf { it.isNotBlank() }
                }?.toSet()
                if (activeShares != null) {
                    val toRemove = map.entries.filter { (_, v) -> v.shareId.isNotBlank() && v.shareId !in activeShares }.map { it.key }
                    for (k in toRemove) map.remove(k)
                }
            }

            val itemsArr = (if (isDelta) root.getAsJsonArray("upsertedItems") else root.getAsJsonArray("items")) ?: JsonArray()
            for (el in itemsArr) {
                if (!el.isJsonObject) continue
                val obj = el.asJsonObject
                val bId = obj.get("battleId")?.asString.orEmpty()
                val sId = obj.get("shareId")?.asString.orEmpty()
                if (bId.isBlank() || sId.isBlank()) continue
                val issueNoteStr = obj.get("userIssueNote")?.takeIf { !it.isJsonNull }?.asString?.trim().orEmpty()
                val isFlaggedBool = (obj.get("manuallyFlagged")?.takeIf { !it.isJsonNull }?.asBoolean ?: false) || issueNoteStr.isNotEmpty()
                map[bId] = OverlayService.Companion.ReplayVaultEntryMeta(
                    battleId = bId,
                    shareId = sId,
                    shareUrl = obj.get("shareUrl")?.asString ?: "$CLOUDFLARE_TELEMETRY_WORKER_URL/watch/$sId",
                    videoStreamUrl = obj.get("videoStreamUrl")?.asString ?: "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/stream/$sId/video.mp4",
                    traceStreamUrl = obj.get("traceStreamUrl")?.asString ?: "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/stream/$sId/trace.jsonl",
                    isPinned = obj.get("isPinned")?.asBoolean ?: false,
                    isPublic = obj.get("isPublic")?.asBoolean ?: false,
                    hideNames = obj.get("hideNames")?.asBoolean ?: false,
                    manuallyFlagged = isFlaggedBool,
                    userIssueNote = issueNoteStr,
                    uploadedAtMs = System.currentTimeMillis()
                )
            }
            saveReplayVaultMapStatic(prefs, gson, map)
            true to if (isDelta) {
                "Delta synced +${itemsArr.size()} cloud replays (${map.size} total)"
            } else {
                "Synced ${itemsArr.size()} cloud replays"
            }
        }
    } catch (e: Exception) {
        false to (e.localizedMessage ?: "Sync error")
    }
}

internal fun OverlayService.Companion.uploadBattleReplayToR2VaultIfUnlockedBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510?,
    mp4File: File,
    traceFile: File,
    isPinned: Boolean = false
): Triple<Boolean, String, OverlayService.Companion.ReplayVaultEntryMeta?> {
    return try {
        val tier = getEffectiveReplayTierStatic(prefs)
        if (tier == "free" || tier == "supporter") {
            return Triple(
                false,
                if (tier == "supporter") "Supporter tier (5 local replays + 365d pinned retention)" else "Free tier (1 local replay only)",
                null
            )
        }
        if (!isDvrUploadAllowedOnCurrentNetworkStatic(prefs)) {
            return Triple(false, "📶 DVR saved locally (Wi-Fi Only mode — enable Mobile Data Upload in Settings to upload on cellular)", null)
        }
        if (!mp4File.exists() || mp4File.length() <= 0L) {
            return Triple(false, "Local MP4 file not found", null)
        }
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val cleanBattleId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val unlockKey = getEffectiveReplayUnlockKey(prefs)
        val traceText = if (traceFile.exists()) traceFile.readText(Charsets.UTF_8) else ""
        val frameCount = traceText.lineSequence().count {
            it.isNotBlank() && !it.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")
        }

        val userList = summaryRecord?.userTeamSpecs?.map { it.species }?.filter { it.isNotBlank() }?.joinToString(", ").orEmpty()
        val oppList = summaryRecord?.oppTeamSpecs?.map { it.species }?.filter { it.isNotBlank() }?.joinToString(", ").orEmpty()
        val matchupSummary = buildString {
            if (userList.isNotBlank()) append("$userList vs ")
            append(oppList.ifBlank { "Opponent" })
        }

        val metadataJson = gson.toJson(
            mapOf(
                "battleId" to cleanBattleId,
                "screenName" to safeUser,
                "deviceId" to devHash,
                "deviceHash" to devHash,
                "unlockKey" to unlockKey,
                "appVersion" to APP_VERSION,
                "versionCode" to APP_VERSION_CODE,
                "league" to (summaryRecord?.league ?: "GBL"),
                "result" to (summaryRecord?.result ?: "BATTLE"),
                "matchupSummary" to matchupSummary,
                "frameCount" to frameCount,
                "isPinned" to isPinned
            )
        )

        val httpClient = buildTelemetryHttpClientStatic(30L, 180L, 90L)
        var lastCode = 0
        var lastErr = ""
        for (attempt in 1..3) {
            val baseUrl = CLOUDFLARE_INGEST_BASE_URLS.getOrElse(attempt - 1) { CLOUDFLARE_TELEMETRY_WORKER_URL }
            try {
                val multipart = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("metadata", metadataJson)
                    .addFormDataPart(
                        "video",
                        "${cleanBattleId}_video.mp4",
                        mp4File.asRequestBody("video/mp4".toMediaTypeOrNull())
                    )
                    .apply {
                        if (traceText.isNotBlank()) {
                            addFormDataPart(
                                "deep_trace",
                                "${cleanBattleId}_deep_trace.jsonl",
                                traceText.toRequestBody("application/x-ndjson; charset=utf-8".toMediaTypeOrNull())
                            )
                        }
                    }
                    .build()

                val vaultSession = getVaultSessionTokenStatic(prefs)
                val req = applyWorkerClientAuthHeaders(
                    Request.Builder()
                        .url("$baseUrl/v1/replays/upload")
                        .post(multipart)
                        .header("X-SilphScope-Unlock-Key", unlockKey)
                        .apply {
                            if (vaultSession.isNotBlank()) header("X-Vault-Session", vaultSession)
                        },
                    prefs,
                    safeUser,
                    devHash
                ).build()

                httpClient.newCall(req).execute().use { resp ->
                    lastCode = resp.code
                    val bodyStr = resp.body?.string().orEmpty()
                    if (resp.isSuccessful) {
                        val root = JsonParser.parseString(bodyStr).asJsonObject
                        val shareId = root.get("shareId")?.asString.orEmpty()
                        val shareUrl = root.get("shareUrl")?.asString ?: "${OverlayService.CLOUDFLARE_DVR_VAULT_URL}/watch/$shareId"
                        val map = loadReplayVaultMapStatic(prefs, gson)
                        val prevEntry = map[cleanBattleId]
                        val entry = OverlayService.Companion.ReplayVaultEntryMeta(
                            battleId = cleanBattleId,
                            shareId = shareId,
                            shareUrl = shareUrl,
                            videoStreamUrl = "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/stream/$shareId/video.mp4",
                            traceStreamUrl = "$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/stream/$shareId/trace.jsonl",
                            isPinned = root.get("isPinned")?.asBoolean ?: isPinned,
                            isPublic = root.get("isPublic")?.asBoolean ?: false,
                            hideNames = false,
                            manuallyFlagged = prevEntry?.manuallyFlagged ?: false,
                            userIssueNote = prevEntry?.userIssueNote.orEmpty(),
                            uploadedAtMs = System.currentTimeMillis()
                        )
                        map[cleanBattleId] = entry
                        saveReplayVaultMapStatic(prefs, gson, map)
                        return Triple(true, "☁️ Saved to Cloud Replay Vault ($cleanBattleId)", entry)
                    } else {
                        val parsedErr = try { JsonParser.parseString(bodyStr).asJsonObject.get("error")?.asString.orEmpty() } catch (_: Exception) { "" }
                        if (parsedErr.isNotBlank()) lastErr = parsedErr
                    }
                }
                if (lastCode in 400..499 && lastCode != 404 && lastCode != 429) {
                    break
                }
            } catch (e: Exception) {
                lastErr = e.localizedMessage ?: e.javaClass.simpleName
            }
            if (attempt < 3) {
                try { Thread.sleep(1500L * attempt) } catch (_: Exception) {}
            }
        }
        val detail = if (lastCode > 0) {
            if (lastErr.isNotBlank()) "HTTP $lastCode: $lastErr" else "HTTP $lastCode"
        } else {
            lastErr.ifBlank { "Network error" }
        }
        Triple(false, "⚠️ Cloud Replay Vault upload failed ($detail)", null)
    } catch (e: Exception) {
        Triple(false, "⚠️ Vault upload error: ${e.localizedMessage ?: "Network error"}", null)
    }
}

internal fun OverlayService.Companion.retryUnuploadedLocalDvrReplaysBlocking(
    filesDir: File,
    prefs: SharedPreferences,
    gson: Gson,
    battleLogs: List<BattleLogEntry> = emptyList()
): Int {
    val tier = getEffectiveReplayTierStatic(prefs)
    if (tier == "free" || tier == "supporter") return 0
    if (!isDvrUploadAllowedOnCurrentNetworkStatic(prefs)) return 0
    val replaysDir = File(filesDir, "dvr_replays")
    if (!replaysDir.exists()) return 0
    val mp4Files = (replaysDir.listFiles() ?: emptyArray())
        .filter { f -> f.isFile && f.name.endsWith("_video.mp4") && f.length() > 0L }
        .sortedBy { it.lastModified() }
    if (mp4Files.isEmpty()) return 0

    val vaultMap = loadReplayVaultMapStatic(prefs, gson)
    val battleLogsById = battleLogs.associateBy {
        it.id.replace(Regex("[^a-zA-Z0-9_-]"), "")
    }

    var uploaded = 0
    for (mp4File in mp4Files) {
        val cleanId = mp4File.name.removeSuffix("_video.mp4")
        val existing = vaultMap[cleanId]
        if (existing != null && existing.shareId.isNotBlank()) continue
        val traceFile = File(replaysDir, "${cleanId}_deep_trace.jsonl")
        var summaryRecord: AiTelemetryBattleRecordV510? = null
        if (traceFile.exists()) {
            try {
                val firstLine = traceFile.bufferedReader(Charsets.UTF_8).use { it.readLine() }.orEmpty()
                if (firstLine.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")) {
                    val obj = JsonParser.parseString(firstLine).asJsonObject
                    if (obj.has("battleSummary") && obj.get("battleSummary").isJsonObject) {
                        summaryRecord = gson.fromJson(obj.get("battleSummary"), AiTelemetryBattleRecordV510::class.java)
                    }
                }
            } catch (_: Exception) {}
        }
        if (summaryRecord == null) {
            val logEntry = battleLogsById[cleanId]
            if (logEntry != null) {
                summaryRecord = AiTelemetryBattleRecordV510(
                    schemaVersion = APP_VERSION,
                    battleId = cleanId,
                    timestampMs = logEntry.timestampMs,
                    appVersion = APP_VERSION,
                    league = logEntry.league,
                    result = logEntry.result,
                    teamName = logEntry.userTeamName,
                    userTeamSpecs = logEntry.userPokemon.filter { it.isNotBlank() }
                        .mapIndexed { idx, sp -> AiTelemetrySlotSpec(slotIndex = idx, species = sp) },
                    oppTeamSpecs = logEntry.opponents.filter { it.isNotBlank() }
                        .mapIndexed { idx, sp -> AiTelemetryOppSlotSpec(slotIndex = idx, species = sp) }
                )
            }
        }
        val (ok, _, _) = uploadBattleReplayToR2VaultIfUnlockedBlocking(
            prefs = prefs,
            gson = gson,
            battleId = cleanId,
            summaryRecord = summaryRecord,
            mp4File = mp4File,
            traceFile = traceFile
        )
        if (ok) uploaded++
    }
    return uploaded
}

internal fun OverlayService.Companion.togglePinOrPrivacyReplayBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    isPinned: Boolean? = null,
    isPublic: Boolean? = null,
    hideNames: Boolean? = null
): Pair<Boolean, String> {
    val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
    val map = loadReplayVaultMapStatic(prefs, gson)
    val existing = map[cleanId] ?: OverlayService.Companion.ReplayVaultEntryMeta(battleId = cleanId)
    val nextPinned = isPinned ?: existing.isPinned
    val nextPublic = isPublic ?: existing.isPublic
    val nextHide = hideNames ?: existing.hideNames
    map[cleanId] = existing.copy(isPinned = nextPinned, isPublic = nextPublic, hideNames = nextHide)
    saveReplayVaultMapStatic(prefs, gson, map)

    if (existing.shareId.isBlank()) {
        return true to when {
            isPinned != null -> if (nextPinned) "⭐ Starred locally" else "Unstarred locally"
            isPublic != null -> if (nextPublic) "🌐 Marked Public locally" else "🔒 Marked Private locally"
            else -> "Updated locally"
        }
    }

    return try {
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val unlockKey = getEffectiveReplayUnlockKey(prefs)
        val payload = mutableMapOf<String, Any>(
            "battleId" to cleanId,
            "shareId" to existing.shareId,
            "unlockKey" to unlockKey
        )
        if (isPinned != null) payload["isPinned"] = isPinned
        if (isPublic != null) payload["isPublic"] = isPublic
        if (hideNames != null) payload["hideNames"] = hideNames

        val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)
        val req = applyWorkerClientAuthHeaders(
            Request.Builder()
                .url("$CLOUDFLARE_TELEMETRY_WORKER_URL/v1/replays/pin")
                .post(gson.toJson(payload).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
                .header("X-SilphScope-Unlock-Key", unlockKey),
            prefs,
            safeUser,
            devHash
        ).build()

        httpClient.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                val errObj = try { JsonParser.parseString(bodyStr).asJsonObject.get("error")?.asString } catch (_: Exception) { null }
                return false to "⚠️ ${errObj ?: "HTTP ${resp.code}"}"
            }
            true to when {
                isPinned != null -> if (nextPinned) "⭐ Starred in Cloud Replay Vault!" else "☆ Unstarred in Cloud Replay Vault"
                isPublic != null -> if (nextPublic) "🌐 Video set to Public in Cloud Vault!" else "🔒 Video set to Private in Cloud Vault"
                else -> if (nextHide) "🕵️ Trainer Names Hidden on Share Link" else "👤 Trainer Names Visible on Share Link"
            }
        }
    } catch (e: Exception) {
        false to "⚠️ ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.deleteBattleDvrRecordingStatic(
    filesDir: File,
    cacheDir: File,
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String
) {
    val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
    if (cleanId.isBlank()) return
    try {
        val replaysDir = File(filesDir, "dvr_replays")
        File(replaysDir, "${cleanId}_video.mp4").delete()
        File(replaysDir, "${cleanId}_deep_trace.jsonl").delete()
        File(cacheDir, "${cleanId}_video.mp4").delete()
        File(cacheDir, "${cleanId}_deep_trace.jsonl").delete()
    } catch (_: Exception) {}
    try {
        val pendingQueue = loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        val pIdx = pendingQueue.indexOfFirst { it.battleId == cleanId }
        if (pIdx >= 0) {
            pendingQueue[pIdx] = pendingQueue[pIdx].copy(dvrVideoPath = null, dvrDeepTracePath = null)
            prefs.edit().putString(OverlayService.PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue)).apply()
        }
    } catch (_: Exception) {}
}

internal fun OverlayService.Companion.submitManualDvrIssueReportBlocking(
    filesDir: File,
    cacheDir: File,
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    league: String = "Great League",
    result: String = "UNKNOWN",
    userTeamNames: List<String> = emptyList(),
    oppTeamNames: List<String> = emptyList(),
    userIssueNote: String = ""
): Pair<Boolean, String> {
    val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
    val replaysDir = File(filesDir, "dvr_replays")
    var mp4File = File(replaysDir, "${cleanId}_video.mp4")
    var traceFile = File(replaysDir, "${cleanId}_deep_trace.jsonl")

    // If not in local ring buffer anymore, check if it's in Cloud R2 Vault and download to temp files
    if (!mp4File.exists()) {
        val vaultMeta = loadReplayVaultMapStatic(prefs, gson)[cleanId]
        if (vaultMeta != null && vaultMeta.videoStreamUrl.isNotBlank()) {
            try {
                val httpClient = buildTelemetryHttpClientStatic(20L, 90L, 60L)
                val tmpMp4 = File(cacheDir, "issue_${cleanId}_video.mp4")
                val tmpTrace = File(cacheDir, "issue_${cleanId}_deep_trace.jsonl")
                httpClient.newCall(Request.Builder().url(vaultMeta.videoStreamUrl).get().build()).execute().use { r ->
                    if (r.isSuccessful) {
                        r.body?.byteStream()?.use { input ->
                            tmpMp4.outputStream().use { out -> input.copyTo(out) }
                        }
                    }
                }
                if (vaultMeta.traceStreamUrl.isNotBlank()) {
                    httpClient.newCall(Request.Builder().url(vaultMeta.traceStreamUrl).get().build()).execute().use { r ->
                        if (r.isSuccessful) {
                            tmpTrace.writeText(r.body?.string().orEmpty(), Charsets.UTF_8)
                        }
                    }
                }
                if (tmpMp4.exists() && tmpMp4.length() > 0L) {
                    mp4File = tmpMp4
                    traceFile = tmpTrace
                }
            } catch (_: Exception) {}
        }
    }

    if (!mp4File.exists() && !traceFile.exists()) {
        return false to "⚠️ No DVR video or trace found for this battle."
    }

    val devHash = getDeviceTelemetryHashStatic(prefs)
    val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
        .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)

    val pendingLogs = loadPendingAiTelemetryLogsStatic(prefs, gson)
    var existingSummary = pendingLogs.firstOrNull {
        it.battleId.replace(Regex("[^a-zA-Z0-9_-]"), "") == cleanId
    }
    if (existingSummary == null && traceFile.exists()) {
        try {
            val firstLine = traceFile.bufferedReader(Charsets.UTF_8).use { it.readLine() }.orEmpty()
            if (firstLine.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")) {
                val obj = JsonParser.parseString(firstLine).asJsonObject
                if (obj.has("battleSummary") && obj.get("battleSummary").isJsonObject) {
                    existingSummary = gson.fromJson(obj.get("battleSummary"), AiTelemetryBattleRecordV510::class.java)
                }
            }
        } catch (_: Exception) {}
    }

    val summaryRecord = existingSummary?.copy(
        schemaVersion = APP_VERSION,
        appVersion = APP_VERSION,
        uploaderHandle = safeUser,
        deviceHash = devHash,
        league = league.ifBlank { existingSummary.league },
        result = if (result != "UNKNOWN" && result.isNotBlank()) result else existingSummary.result,
        userTeamSpecs = if (existingSummary.userTeamSpecs.isNotEmpty()) existingSummary.userTeamSpecs else userTeamNames.mapIndexed { idx, s -> AiTelemetrySlotSpec(slotIndex = idx, species = s) },
        oppTeamSpecs = if (existingSummary.oppTeamSpecs.isNotEmpty()) existingSummary.oppTeamSpecs else oppTeamNames.mapIndexed { idx, s -> AiTelemetryOppSlotSpec(slotIndex = idx, species = s) },
        dvrVideoPath = "recordings/$safeUser/${cleanId}_video.mp4",
        dvrDeepTracePath = "recordings/$safeUser/${cleanId}_deep_trace.jsonl"
    ) ?: AiTelemetryBattleRecordV510(
        schemaVersion = APP_VERSION,
        battleId = cleanId,
        timestampMs = System.currentTimeMillis(),
        appVersion = APP_VERSION,
        uploaderHandle = safeUser,
        deviceHash = devHash,
        league = league,
        teamName = "Manual Issue Report",
        result = result,
        settingsProfileSignature = computeDebounceSettingsProfileSignatureStatic(prefs),
        userTeamSpecs = userTeamNames.mapIndexed { idx, s -> AiTelemetrySlotSpec(slotIndex = idx, species = s) },
        oppTeamSpecs = oppTeamNames.mapIndexed { idx, s -> AiTelemetryOppSlotSpec(slotIndex = idx, species = s) },
        dvrVideoPath = "recordings/$safeUser/${cleanId}_video.mp4",
        dvrDeepTracePath = "recordings/$safeUser/${cleanId}_deep_trace.jsonl"
    )

    return uploadBattleDvrBundleToGitHubBlocking(
        prefs = prefs,
        gson = gson,
        battleId = cleanId,
        summaryRecord = summaryRecord,
        mp4File = mp4File,
        traceFile = traceFile,
        deleteFilesOnSuccess = mp4File.parentFile == cacheDir,
        userIssueNote = userIssueNote.trim(),
        uploadReason = "Manual Replay Issue Report",
        wasExplicitlyFlagged = userIssueNote.trim().isNotEmpty()
    )
}

internal fun OverlayService.Companion.unflagDvrIssueReportBlocking(
    filesDir: File,
    cacheDir: File,
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String
): Pair<Boolean, String> {
    val cleanId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
    if (cleanId.isBlank()) {
        return false to "⚠️ Invalid battle ID."
    }

    val devHash = getDeviceTelemetryHashStatic(prefs)
    val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
        .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)

    // 1. Strip manual flag & USER_MANUAL_ISSUE_REPORT anomaly from local & cached deep_trace.jsonl files
    val candidateTraceFiles = listOf(
        File(File(filesDir, "dvr_replays"), "${cleanId}_deep_trace.jsonl"),
        File(cacheDir, "${cleanId}_deep_trace.jsonl"),
        File(cacheDir, "issue_${cleanId}_deep_trace.jsonl")
    )
    for (tf in candidateTraceFiles) {
        if (!tf.exists()) continue
        try {
            val text = tf.readText(Charsets.UTF_8)
            if (text.startsWith("{\"recordType\":\"BATTLE_DVR_SUMMARY_HEADER\"")) {
                val nlIdx = text.indexOf('\n')
                val firstLine = if (nlIdx >= 0) text.substring(0, nlIdx) else text
                val rest = if (nlIdx >= 0) text.substring(nlIdx) else "\n"
                val obj = JsonParser.parseString(firstLine).asJsonObject
                obj.addProperty("manuallyFlagged", false)
                obj.addProperty("userIssueNote", "")
                obj.addProperty("uploadReason", "Unflagged by User")
                if (obj.has("battleSummary") && obj.get("battleSummary").isJsonObject) {
                    val sumObj = obj.getAsJsonObject("battleSummary")
                    val parsedSum = gson.fromJson(sumObj, AiTelemetryBattleRecordV510::class.java)
                    if (parsedSum != null) {
                        val cleanedAnoms = parsedSum.anomalies.filter { it.type != "USER_MANUAL_ISSUE_REPORT" }
                        val updatedSum = parsedSum.copy(
                            anomalies = cleanedAnoms,
                            anomalyCount = cleanedAnoms.size,
                            hasHighSeverityAnomaly = cleanedAnoms.any { it.severity == "HIGH" }
                        )
                        obj.add("battleSummary", JsonParser.parseString(gson.toJson(updatedSum)))
                    }
                }
                tf.writeText(gson.toJson(obj) + rest, Charsets.UTF_8)
            }
        } catch (_: Exception) {}
    }

    // 2. Strip USER_MANUAL_ISSUE_REPORT from pending AI telemetry queue in SharedPreferences
    try {
        val pendingQueue = loadPendingAiTelemetryLogsStatic(prefs, gson).toMutableList()
        var changed = false
        for (i in pendingQueue.indices) {
            val rec = pendingQueue[i]
            if (rec.battleId.replace(Regex("[^a-zA-Z0-9_-]"), "") == cleanId &&
                rec.anomalies.any { it.type == "USER_MANUAL_ISSUE_REPORT" }
            ) {
                val cleanedAnoms = rec.anomalies.filter { it.type != "USER_MANUAL_ISSUE_REPORT" }
                pendingQueue[i] = rec.copy(
                    anomalies = cleanedAnoms,
                    anomalyCount = cleanedAnoms.size,
                    hasHighSeverityAnomaly = cleanedAnoms.any { it.severity == "HIGH" }
                )
                changed = true
            }
        }
        if (changed) {
            prefs.edit()
                .putString(OverlayService.PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(pendingQueue.takeLast(200)))
                .apply()
        }
    } catch (_: Exception) {}

    // 3. Clear manuallyFlagged & userIssueNote in local ReplayVaultMap and notify Cloudflare Telemetry Worker (`POST /v1/dvr/unflag`)
    val vaultMap = try { loadReplayVaultMapStatic(prefs, gson) } catch (_: Exception) { mutableMapOf() }
    val vaultMeta = vaultMap[cleanId]
    if (vaultMeta != null && (vaultMeta.manuallyFlagged || vaultMeta.userIssueNote.isNotEmpty())) {
        vaultMap[cleanId] = vaultMeta.copy(manuallyFlagged = false, userIssueNote = "")
        saveReplayVaultMapStatic(prefs, gson, vaultMap)
    }
    val shareId = vaultMeta?.shareId.orEmpty()
    val unlockKey = getEffectiveReplayUnlockKey(prefs)
    val payloadJson = gson.toJson(
        mapOf(
            "battleId" to cleanId,
            "shareId" to shareId,
            "screenName" to safeUser,
            "deviceHash" to devHash,
            "unlockKey" to unlockKey
        )
    )
    val httpClient = buildTelemetryHttpClientStatic(15L, 25L, 20L)
    var remoteOk = false
    for (attempt in 1..2) {
        val baseUrl = CLOUDFLARE_INGEST_BASE_URLS.getOrElse(attempt - 1) { CLOUDFLARE_TELEMETRY_WORKER_URL }
        try {
            val req = applyWorkerClientAuthHeaders(
                Request.Builder()
                    .url("$baseUrl/v1/dvr/unflag")
                    .post(payloadJson.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())),
                prefs,
                safeUser,
                devHash
            ).build()
            httpClient.newCall(req).execute().use { resp ->
                if (resp.isSuccessful) {
                    remoteOk = true
                }
            }
            if (remoteOk) break
        } catch (_: Exception) {}
    }

    return if (remoteOk) {
        true to "⚪ Issue report unflagged & retracted."
    } else {
        true to "⚪ Issue report unflagged locally (offline)."
    }
}

/**
 * v6.29: Uploads pending Always-On lower-resolution AI training & anomaly battle records
 * directly to the SilphScope Cloudflare Worker (`POST /v1/telemetry`) attributed to the user's
 * mandatory Unique Debug ID (zero GitHub login required).
 */
internal fun OverlayService.Companion.uploadPendingAiTelemetryBatchBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    forceUpload: Boolean = false,
    minBattlesRequired: Int = 1
): Pair<Boolean, String> {
    if (isAiTelemetryUploadInFlight) {
        return false to "AI Telemetry upload already in progress..."
    }
    recordDebounceSettingsChangeIfNeededStatic(prefs, gson, "telemetry_upload_check", triggerImmediateUpload = false)
    val pending = loadPendingAiTelemetryLogsStatic(prefs, gson)
    val pendingSettingsChanges = loadPendingSettingsChangesStatic(prefs, gson)
    if (pending.isEmpty()) {
        if (pendingSettingsChanges.isNotEmpty()) {
            val cfgOk = try { uploadSettingsChangeHistoryBlocking(prefs, gson) } catch (_: Exception) { false }
            if (cfgOk) {
                return true to "Uploaded ${pendingSettingsChanges.size} debounce/settling settings change${if (pendingSettingsChanges.size == 1) "" else "s"} to Cloudflare"
            }
        }
        return true to "No pending AI telemetry battles to upload (0 queued)."
    }
    if (!forceUpload && pending.size < minBattlesRequired) {
        return false to "Waiting for $minBattlesRequired battles (${pending.size}/$minBattlesRequired queued)."
    }

    isAiTelemetryUploadInFlight = true
    try {
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = getRequiredScreenNameStatic(prefs).ifBlank { "trainer_$devHash" }
            .replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val nowMs = System.currentTimeMillis()

        val currentProfileSig = computeDebounceSettingsProfileSignatureStatic(prefs)
        val allRecentChanges = loadSettingsChangeHistoryStatic(prefs, gson).takeLast(20)
        val enrichedPending = pending.mapIndexed { idx, rec ->
            val recordedVer = rec.appVersion.takeIf { it.isNotBlank() && it != "5.10" } ?: APP_VERSION
            val baseRec = rec.copy(
                uploaderHandle = safeUser,
                deviceHash = devHash,
                appVersion = recordedVer,
                schemaVersion = recordedVer
            )
            val withSig = if (baseRec.settingsProfileSignature.isBlank()) {
                baseRec.copy(settingsProfileSignature = currentProfileSig)
            } else baseRec
            if (idx == pending.lastIndex && withSig.settingsChanges.isEmpty() && allRecentChanges.isNotEmpty()) {
                withSig.copy(settingsChanges = allRecentChanges)
            } else withSig
        }

        val batchId = "batch_${nowMs}_${safeUser}_${devHash}"
        val jsonlContent = enrichedPending.joinToString("\n") { gson.toJson(it) } + "\n"
        val totalAnomalies = enrichedPending.sumOf { it.anomalyCount }
        val highSevCount = enrichedPending.count { it.hasHighSeverityAnomaly }
        val anomalySummary = if (totalAnomalies > 0) {
            "$totalAnomalies anomalies ($highSevCount HIGH) across ${enrichedPending.size} battles"
        } else ""

        val payloadJson = gson.toJson(
            mapOf(
                "batchId" to batchId,
                "recordCount" to enrichedPending.size,
                "appVersion" to APP_VERSION,
                "versionCode" to APP_VERSION_CODE,
                "deviceId" to devHash,
                "anomalySummary" to anomalySummary,
                "jsonl" to jsonlContent
            )
        )

        val httpClient = buildTelemetryHttpClientStatic(25L, 60L, 45L)

        var uploadedOk = false
        var httpCode = 0
        var lastErr = ""
        for (attempt in 1..3) {
            val baseUrl = CLOUDFLARE_INGEST_BASE_URLS.getOrElse(attempt - 1) { CLOUDFLARE_TELEMETRY_WORKER_URL }
            try {
                val req = applyWorkerClientAuthHeaders(
                    Request.Builder()
                        .url("$baseUrl/v1/telemetry")
                        .post(payloadJson.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())),
                    prefs,
                    safeUser,
                    devHash
                ).build()

                httpClient.newCall(req).execute().use { resp ->
                    httpCode = resp.code
                    uploadedOk = resp.isSuccessful
                    val respBodyStr = try { resp.body?.string().orEmpty() } catch (_: Exception) { "" }
                    if (uploadedOk && respBodyStr.isNotBlank()) {
                        applyRemoteDailyTuningConfigStatic(prefs, gson, respBodyStr)
                    } else if (!uploadedOk && respBodyStr.isNotBlank()) {
                        val parsedErr = try { JsonParser.parseString(respBodyStr).asJsonObject.get("error")?.asString.orEmpty() } catch (_: Exception) { "" }
                        if (parsedErr.isNotBlank()) lastErr = parsedErr
                    }
                }
                if (uploadedOk || (httpCode in 400..499 && httpCode != 404 && httpCode != 429)) {
                    break
                }
            } catch (e: Exception) {
                lastErr = e.localizedMessage ?: e.javaClass.simpleName
            }
            if (attempt < 3) {
                try { Thread.sleep(1500L * attempt) } catch (_: Exception) {}
            }
        }

        if (!uploadedOk) {
            val detail = if (httpCode > 0) {
                if (lastErr.isNotBlank()) "HTTP $httpCode: $lastErr" else "HTTP $httpCode"
            } else {
                lastErr.ifBlank { "Network error" }
            }
            return false to "Telemetry upload failed ($detail). Queued for automatic retry."
        }

        try {
            uploadSettingsChangeHistoryBlocking(prefs, gson)
        } catch (_: Exception) {}

        val uploadedIds = enrichedPending.map { it.battleId }.toSet()
        val uploadedCount = enrichedPending.size
        val remaining = loadPendingAiTelemetryLogsStatic(prefs, gson).filter { it.battleId !in uploadedIds }
        val totalUploadedSoFar = prefs.getInt(PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT, 0) + uploadedCount
        val statusMsg = "Uploaded $uploadedCount battle${if (uploadedCount == 1) "" else "s"} ($totalAnomalies anomal${if (totalAnomalies == 1) "y" else "ies"}) as @$safeUser to Cloudflare" +
            if (remaining.isNotEmpty()) " — ${remaining.size} still queued" else ""
        prefs.edit()
            .putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(remaining))
            .remove(PREFS_KEY_PENDING_SETTINGS_CHANGES_V513)
            .putLong(PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_MS, nowMs)
            .putInt(PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT, totalUploadedSoFar)
            .putString(PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_STATUS, statusMsg)
            .apply()

        return true to statusMsg
    } catch (e: Exception) {
        return false to "Telemetry upload error: ${e.localizedMessage ?: "Network error"}"
    } finally {
        isAiTelemetryUploadInFlight = false
    }
}

/**
 * v7.23: Applies the remote Daily AI Auto-Tuned Settings & Post-Battle Survey Question Pool
 * returned by `GET /v1/tuning-config` or embedded inside `POST /v1/telemetry` responses.
 */
internal fun OverlayService.Companion.applyRemoteDailyTuningConfigStatic(
    prefs: SharedPreferences,
    gson: Gson,
    rawJsonString: String
): Boolean {
    return try {
        val rootObj = JsonParser.parseString(rawJsonString).asJsonObject
        val cfgObj = if (rootObj.has("dailyTuningConfig") && rootObj.get("dailyTuningConfig").isJsonObject) {
            rootObj.getAsJsonObject("dailyTuningConfig")
        } else {
            rootObj
        }
        val editor = prefs.edit()
        var changed = false

        if (cfgObj.has("tunedSettings") && cfgObj.get("tunedSettings").isJsonObject) {
            val ts = cfgObj.getAsJsonObject("tunedSettings")
            if (ts.has("proactiveEnergyLeadMs")) {
                val v = ts.get("proactiveEnergyLeadMs").asInt.coerceIn(0, 450)
                editor.putInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, v)
                changed = true
            }
            if (ts.has("predictiveGuiHapticLeadMs")) {
                val v = ts.get("predictiveGuiHapticLeadMs").asInt.coerceIn(100, 500)
                editor.putInt(OverlayService.PREFS_KEY_PREDICTIVE_GUI_HAPTIC_LEAD_MS, v)
                changed = true
            }
            if (ts.has("hpDebounceSamples")) {
                val v = ts.get("hpDebounceSamples").asInt.coerceIn(2, 4)
                editor.putInt(PREFS_KEY_HP_DEBOUNCE_SAMPLES, v)
                editor.putInt(OverlayService.PREFS_KEY_HP_DEBOUNCE_WINDOW_MS, v * 100)
                changed = true
            }
            if (ts.has("hpDebounceTolerancePct")) {
                val v = ts.get("hpDebounceTolerancePct").asInt.coerceIn(0, 3)
                editor.putInt(PREFS_KEY_DEBOUNCE_TOLERANCE_PCT, v)
                editor.putFloat(OverlayService.PREFS_KEY_HP_DEBOUNCE_TOLERANCE_PCT_F, v.toFloat().coerceAtLeast(1.0f))
                changed = true
            }
            if (ts.has("energyDebounceSamples")) {
                val v = ts.get("energyDebounceSamples").asInt.coerceIn(2, 4)
                editor.putInt(PREFS_KEY_ENERGY_DEBOUNCE_SAMPLES, v)
                editor.putInt(OverlayService.PREFS_KEY_ENERGY_DEBOUNCE_WINDOW_MS, v * 100)
                changed = true
            }
        }

        if (cfgObj.has("questions") && cfgObj.get("questions").isJsonArray) {
            val qArr = cfgObj.getAsJsonArray("questions")
            if (qArr.size() > 0) {
                editor.putString(OverlayService.PREFS_KEY_DYNAMIC_TUNING_QUESTIONS_JSON, gson.toJson(qArr))
                changed = true
            }
        }

        if (changed) {
            editor.putLong(OverlayService.PREFS_KEY_LAST_TUNING_CONFIG_SYNC_MS, System.currentTimeMillis()).apply()
            OverlayService.syncTierThresholdsFromPrefs(prefs)
        }
        changed
    } catch (_: Exception) {
        false
    }
}

internal fun OverlayService.Companion.syncDailyTuningAndQuestionPoolAsync(
    prefs: SharedPreferences,
    gson: Gson,
    forceSync: Boolean = false
) {
    val nowMs = System.currentTimeMillis()
    val lastSyncMs = prefs.getLong(OverlayService.PREFS_KEY_LAST_TUNING_CONFIG_SYNC_MS, 0L)
    if (!forceSync && (nowMs - lastSyncMs) < 6L * 60L * 60L * 1000L) return

    kotlinx.coroutines.CoroutineScope(Dispatchers.IO + kotlinx.coroutines.SupervisorJob()).launch {
        try {
            val httpClient = buildTelemetryHttpClientStatic(10L, 15L, 15L)
            for (baseUrl in CLOUDFLARE_INGEST_BASE_URLS) {
                try {
                    val req = Request.Builder()
                        .url("$baseUrl/v1/tuning-config")
                        .get()
                        .build()
                    var ok = false
                    httpClient.newCall(req).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val bodyStr = resp.body?.string().orEmpty()
                            if (bodyStr.isNotBlank()) {
                                applyRemoteDailyTuningConfigStatic(prefs, gson, bodyStr)
                                ok = true
                            }
                        }
                    }
                    if (ok) break
                } catch (_: Exception) {}
            }
        } catch (_: Exception) {}
    }
}

/**
 * Trigger #1 (Once Daily on App Launch):
 * Runs in background on app launch if `autoUploadEnabled`,
 * at least 1 battle is pending, and `nowMs - lastUploadMs >= 24h` (or `>= 5` battles pending).
 */
internal fun OverlayService.Companion.triggerAutoUploadOnAppLaunchAsync(
    prefs: SharedPreferences,
    gson: Gson,
    onComplete: ((Boolean, String) -> Unit)? = null
) {
    syncDailyTuningAndQuestionPoolAsync(prefs, gson, forceSync = false)
    val autoEnabled = prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, DEFAULT_AUTO_UPLOAD_AI_LOGS)
    if (!autoEnabled) return
    val pending = loadPendingAiTelemetryLogsStatic(prefs, gson)
    if (pending.isEmpty()) return
    val nowMs = System.currentTimeMillis()
    val lastUploadMs = prefs.getLong(PREFS_KEY_LAST_AI_TELEMETRY_UPLOAD_MS, 0L)
    val isDailyDue = (nowMs - lastUploadMs) >= AI_TELEMETRY_DAILY_INTERVAL_MS
    val hasFiveReady = pending.size >= AI_TELEMETRY_MIN_BATTLES_ON_STOP
    if (!isDailyDue && !hasFiveReady) return

    kotlinx.coroutines.CoroutineScope(Dispatchers.IO + kotlinx.coroutines.SupervisorJob()).launch {
        val (ok, msg) = uploadPendingAiTelemetryBatchBlocking(
            prefs = prefs,
            gson = gson,
            forceUpload = true,
            minBattlesRequired = 1
        )
        if (onComplete != null) {
            Handler(Looper.getMainLooper()).post {
                try {
                    onComplete.invoke(ok, msg)
                } catch (_: Exception) {}
            }
        }
    }
}

/**
 * Trigger #2 (On Overlay Stop if >= 5 Battles Ready Since Last Upload):
 * Runs in background whenever the floating overlay is stopped and at least 5 battles are queued.
 */
internal fun OverlayService.Companion.triggerAutoUploadOnOverlayStopAsync(
    prefs: SharedPreferences,
    gson: Gson,
    onComplete: ((Boolean, String) -> Unit)? = null
) {
    val autoEnabled = prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, DEFAULT_AUTO_UPLOAD_AI_LOGS)
    if (!autoEnabled) return
    val pending = loadPendingAiTelemetryLogsStatic(prefs, gson)
    if (pending.size < AI_TELEMETRY_MIN_BATTLES_ON_STOP) return

    kotlinx.coroutines.CoroutineScope(Dispatchers.IO + kotlinx.coroutines.SupervisorJob()).launch {
        val (ok, msg) = uploadPendingAiTelemetryBatchBlocking(
            prefs = prefs,
            gson = gson,
            forceUpload = false,
            minBattlesRequired = AI_TELEMETRY_MIN_BATTLES_ON_STOP
        )
        if (onComplete != null) {
            Handler(Looper.getMainLooper()).post {
                try {
                    onComplete.invoke(ok, msg)
                } catch (_: Exception) {}
            }
        }
    }
}
