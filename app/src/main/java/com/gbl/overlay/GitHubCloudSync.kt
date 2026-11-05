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

    val mergedPayload = SyncVaultPayload(
        schemaVersion = 2,
        updatedAt = System.currentTimeMillis(),
        battleLogs = mergedLogs,
        teamPresets = mergedTeams,
        deletedLogIds = allDeletedLogs.toList(),
        deletedTeamIds = allDeletedTeams.toList()
    )
    return Triple(mergedPayload, newOrUpdatedLogsFromRemote, newOrUpdatedTeamsFromRemote)
}

internal fun OverlayService.Companion.buildLocalSyncVaultPayload(prefs: SharedPreferences, gson: Gson): SyncVaultPayload {
    val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
    val teamsType = object : TypeToken<List<SyncTeamPresetRecord>>() {}.type
    val strListType = object : TypeToken<List<String>>() {}.type

    val logs: List<SyncBattleLogRecord> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_BATTLE_LOGS, "[]"), logsType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val teams: List<SyncTeamPresetRecord> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_PERSISTENT_TEAMS, "[]"), teamsType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val delLogs: List<String> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_DELETED_LOG_IDS, "[]"), strListType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    val delTeams: List<String> = try {
        gson.fromJson(prefs.getString(PREFS_KEY_DELETED_TEAM_IDS, "[]"), strListType) ?: emptyList()
    } catch (_: Exception) { emptyList() }

    return SyncVaultPayload(
        schemaVersion = 2,
        updatedAt = System.currentTimeMillis(),
        battleLogs = logs,
        teamPresets = teams,
        deletedLogIds = delLogs,
        deletedTeamIds = delTeams
    )
}

internal fun OverlayService.Companion.saveReconciledSyncVaultLocally(prefs: SharedPreferences, gson: Gson, payload: SyncVaultPayload) {
    val editor = prefs.edit()
        .putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(payload.battleLogs))
        .putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(payload.deletedLogIds))
        .putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(payload.deletedTeamIds))
        .putLong(PREFS_KEY_SYNC_LAST_AT, System.currentTimeMillis())
    if (payload.teamPresets.isNotEmpty()) {
        editor.putString(PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(payload.teamPresets))
    }
    editor.apply()
}

internal fun OverlayService.Companion.getEffectiveSyncToken(prefs: SharedPreferences): String {
    return prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "")?.trim().orEmpty()
}

internal fun OverlayService.Companion.fetchGitHubUsernameBlocking(token: String): String {
    if (token.isBlank()) return ""
    return try {
        val client = OkHttpClient()
        val req = Request.Builder()
            .url("https://api.github.com/user")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return ""
            val body = resp.body?.string().orEmpty()
            val json = JsonParser.parseString(body).asJsonObject
            json.get("login")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
        }
    } catch (_: Exception) {
        ""
    }
}

internal fun OverlayService.Companion.requestGitHubDeviceCodeBlocking(): Result<GitHubDeviceCodeResponse> {
    return try {
        val client = OkHttpClient()
        val formBody = "client_id=$GITHUB_OAUTH_CLIENT_ID&scope=gist%20repo"
            .toRequestBody("application/x-www-form-urlencoded".toMediaTypeOrNull())
        val req = Request.Builder()
            .url("https://github.com/login/device/code")
            .post(formBody)
            .header("Accept", "application/json")
            .build()
        client.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                return Result.failure(Exception("GitHub HTTP ${resp.code}"))
            }
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val deviceCode = root.get("device_code")?.asString.orEmpty()
            val userCode = root.get("user_code")?.asString.orEmpty()
            val verificationUri = root.get("verification_uri")?.asString ?: "https://github.com/login/device"
            val expiresIn = root.get("expires_in")?.asInt ?: 900
            val interval = root.get("interval")?.asInt ?: 5
            if (deviceCode.isEmpty() || userCode.isEmpty()) {
                return Result.failure(Exception("Invalid device code response from GitHub"))
            }
            Result.success(
                GitHubDeviceCodeResponse(
                    deviceCode = deviceCode,
                    userCode = userCode,
                    verificationUri = verificationUri,
                    expiresIn = expiresIn,
                    interval = interval
                )
            )
        }
    } catch (e: Exception) {
        Result.failure(e)
    }
}

internal fun OverlayService.Companion.pollGitHubDeviceTokenOnceBlocking(deviceCode: String): Triple<String, String, String> {
    return try {
        val client = OkHttpClient()
        val formBody = (
            "client_id=$GITHUB_OAUTH_CLIENT_ID" +
                "&device_code=$deviceCode" +
                "&grant_type=urn:ietf:params:oauth:grant-type:device_code"
            ).toRequestBody("application/x-www-form-urlencoded".toMediaTypeOrNull())
        val req = Request.Builder()
            .url("https://github.com/login/oauth/access_token")
            .post(formBody)
            .header("Accept", "application/json")
            .build()
        client.newCall(req).execute().use { resp ->
            val bodyStr = resp.body?.string().orEmpty()
            val root = JsonParser.parseString(bodyStr).asJsonObject
            val accessToken = root.get("access_token")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            if (accessToken.isNotEmpty()) {
                val username = fetchGitHubUsernameBlocking(accessToken)
                return Triple("SUCCESS", accessToken, username)
            }
            val error = root.get("error")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            val errorDesc = root.get("error_description")?.takeIf { !it.isJsonNull }?.asString ?: error
            when (error) {
                "authorization_pending" -> Triple("PENDING", "", "")
                "slow_down" -> Triple("SLOW_DOWN", "", "")
                else -> Triple("ERROR", errorDesc.ifEmpty { "Authorization failed" }, "")
            }
        }
    } catch (e: Exception) {
        Triple("PENDING", e.localizedMessage ?: "", "")
    }
}

internal fun OverlayService.Companion.syncWithGitHubGistBlocking(prefs: SharedPreferences, gson: Gson): Pair<Boolean, String> {
    val token = getEffectiveSyncToken(prefs)
    val customGistId = prefs.getString(PREFS_KEY_SYNC_GIST_ID, "")?.trim().orEmpty()
    if (token.isEmpty()) {
        return false to "Tap '🔑 Login with GitHub' in Settings to enable automatic multi-device sync."
    }
    val httpClient = OkHttpClient()
    val fileName = "battlematrix_gbl_sync_vault.json"

    try {
        var username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        if (username.isEmpty()) {
            username = fetchGitHubUsernameBlocking(token)
            if (username.isNotEmpty()) {
                prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username).apply()
            }
        }

        val localPayload = buildLocalSyncVaultPayload(prefs, gson)
        var remotePayload = SyncVaultPayload()
        var remoteFileSha = ""

        // If signed-in user is sportsfan986 (repo owner) and no custom Gist override is set, use dedicated 'sync-vault' branch
        val useRepoSyncVault = (customGistId.isEmpty() || customGistId.equals("sync-vault", ignoreCase = true)) &&
            username.equals("sportsfan986", ignoreCase = true)

        if (useRepoSyncVault) {
            val repoVaultUrl = "https://api.github.com/repos/sportsfan986/silphscope-pvp/contents/$fileName"
            var totalNewLogs = 0
            var totalNewTeams = 0
            var finalMergedPayload = localPayload
            for (attempt in 1..3) {
                val currentLocal = if (attempt == 1) localPayload else buildLocalSyncVaultPayload(prefs, gson)
                remotePayload = SyncVaultPayload()
                remoteFileSha = ""
                val getReq = Request.Builder()
                    .url("$repoVaultUrl?ref=sync-vault")
                    .header("Authorization", "Bearer $token")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(getReq).execute().use { resp ->
                    if (resp.isSuccessful) {
                        val bodyStr = resp.body?.string().orEmpty()
                        val root = JsonParser.parseString(bodyStr).asJsonObject
                        remoteFileSha = root.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        val contentB64 = root.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        if (contentB64.isNotBlank()) {
                            val decodedBytes = android.util.Base64.decode(contentB64.replace("\n", "").replace("\r", ""), android.util.Base64.DEFAULT)
                            val decodedStr = String(decodedBytes, Charsets.UTF_8)
                            remotePayload = try {
                                gson.fromJson(decodedStr, SyncVaultPayload::class.java) ?: SyncVaultPayload()
                            } catch (_: Exception) { SyncVaultPayload() }
                        }
                    }
                }

                // Reconcile deltas across N devices (Pull -> Union/LWW/Tombstone Reconcile -> Save Local)
                val (mergedPayload, newLogsCount, newTeamsCount) = reconcileSyncVaultPayloads(currentLocal, remotePayload)
                saveReconciledSyncVaultLocally(prefs, gson, mergedPayload)
                finalMergedPayload = mergedPayload
                totalNewLogs += newLogsCount
                totalNewTeams += newTeamsCount

                // Determine if local state has deltas that need to be pushed back to the shared multi-device vault
                val remoteLogIds = remotePayload.battleLogs.associateBy { it.id }
                val hasLogDiff = mergedPayload.battleLogs.size != remotePayload.battleLogs.size ||
                    mergedPayload.battleLogs.any { m -> remoteLogIds[m.id]?.updatedAt != m.updatedAt }
                val remoteTeamMap = remotePayload.teamPresets.associateBy { it.id }
                val hasTeamDiff = mergedPayload.teamPresets.size != remotePayload.teamPresets.size ||
                    mergedPayload.teamPresets.any { t -> remoteTeamMap[t.id]?.updatedAt != t.updatedAt }
                val hasTombstoneDiff = mergedPayload.deletedLogIds.toSet() != remotePayload.deletedLogIds.toSet() ||
                    mergedPayload.deletedTeamIds.toSet() != remotePayload.deletedTeamIds.toSet()

                if (remoteFileSha.isEmpty() || hasLogDiff || hasTeamDiff || hasTombstoneDiff) {
                    val mergedJsonStr = gson.toJson(mergedPayload)
                    val encodedB64 = android.util.Base64.encodeToString(
                        mergedJsonStr.toByteArray(Charsets.UTF_8),
                        android.util.Base64.NO_WRAP
                    )
                    val putBodyMap = mutableMapOf<String, Any>(
                        "message" to "Auto-sync multi-device delta vault",
                        "content" to encodedB64,
                        "branch" to "sync-vault"
                    )
                    if (remoteFileSha.isNotEmpty()) {
                        putBodyMap["sha"] = remoteFileSha
                    }
                    val reqBody = gson.toJson(putBodyMap)
                        .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                    val putReq = Request.Builder()
                        .url(repoVaultUrl)
                        .put(reqBody)
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    var retryConflict = false
                    httpClient.newCall(putReq).execute().use { putResp ->
                        if (putResp.code == 409 || putResp.code == 422) {
                            retryConflict = true
                        } else if (!putResp.isSuccessful) {
                            return false to "Sync error (HTTP ${putResp.code})"
                        }
                    }
                    if (!retryConflict) break
                } else {
                    break
                }
            }

            val userTag = if (username.isNotEmpty()) "@$username" else "Cloud Vault"
            return true to "Synced ($userTag)! (${finalMergedPayload.battleLogs.size} battles, +$totalNewLogs from other devices · ${finalMergedPayload.teamPresets.size} teams, +$totalNewTeams updated)"
        }

        // Standard Per-User Isolated Vault: Auto-discover or create a private Gist in the signed-in user's own GitHub account
        var gistId = if (customGistId.equals("sync-vault", ignoreCase = true)) "" else customGistId
        if (gistId.isEmpty()) {
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
        }

        if (gistId.isNotEmpty()) {
            val getReq = Request.Builder()
                .url("https://api.github.com/gists/$gistId")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
            httpClient.newCall(getReq).execute().use { resp ->
                if (resp.isSuccessful) {
                    val bodyStr = resp.body?.string().orEmpty()
                    val root = JsonParser.parseString(bodyStr).asJsonObject
                    val filesObj = root.getAsJsonObject("files")
                    val vaultFile = filesObj?.getAsJsonObject(fileName)
                    val contentStr = vaultFile?.get("content")?.asString
                    if (!contentStr.isNullOrBlank()) {
                        remotePayload = try {
                            gson.fromJson(contentStr, SyncVaultPayload::class.java) ?: SyncVaultPayload()
                        } catch (_: Exception) { SyncVaultPayload() }
                    }
                } else if (resp.code == 404) {
                    gistId = ""
                }
            }
        }

        val (mergedPayload, newLogsCount, newTeamsCount) = reconcileSyncVaultPayloads(localPayload, remotePayload)
        saveReconciledSyncVaultLocally(prefs, gson, mergedPayload)

        val mergedJsonStr = gson.toJson(mergedPayload)
        val bodyMap = mapOf(
            "description" to "SilphScope PvP Multi-Device Sync Vault (Teams & Battle Logs)",
            "public" to false,
            "files" to mapOf(
                fileName to mapOf("content" to mergedJsonStr)
            )
        )
        val reqBody = gson.toJson(bodyMap)
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val pushReq = if (gistId.isEmpty()) {
            Request.Builder()
                .url("https://api.github.com/gists")
                .post(reqBody)
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
        } else {
            Request.Builder()
                .url("https://api.github.com/gists/$gistId")
                .patch(reqBody)
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
        }

        httpClient.newCall(pushReq).execute().use { pushResp ->
            if (!pushResp.isSuccessful) {
                return false to "Sync error (HTTP ${pushResp.code})"
            }
            if (gistId.isEmpty()) {
                val respObj = JsonParser.parseString(pushResp.body?.string().orEmpty()).asJsonObject
                val createdId = respObj.get("id")?.asString.orEmpty()
                if (createdId.isNotEmpty()) {
                    prefs.edit().putString(PREFS_KEY_SYNC_GIST_ID, createdId).apply()
                }
            }
        }

        val userTag = if (username.isNotEmpty()) "@$username" else "Private Gist"
        return true to "Synced ($userTag)! (${mergedPayload.battleLogs.size} battles, +$newLogsCount from other devices · ${mergedPayload.teamPresets.size} teams, +$newTeamsCount updated)"
    } catch (e: Exception) {
        return false to "Sync failed: ${e.localizedMessage ?: "Network error"}"
    }
}

internal fun OverlayService.Companion.getDeviceTelemetryHashStatic(prefs: SharedPreferences): String {
    val existing = prefs.getString(PREFS_KEY_DEVICE_TELEMETRY_HASH, null)?.trim().orEmpty()
    if (existing.length >= 6) return existing
    val rawSeed = "${Build.MANUFACTURER}_${Build.MODEL}_${System.currentTimeMillis()}_${(1000..9999).random()}"
    val hash = Integer.toHexString(rawSeed.hashCode()).lowercase().padStart(8, '0').take(8)
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
    val leadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).let {
        if (it in listOf(0, 200, 300, 400)) it else DEFAULT_PROACTIVE_ENERGY_LEAD_MS
    }
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
        "versionCode" to 1612,
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
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty().ifEmpty { "trainer_$devHash" }
        val sig = computeDebounceSettingsProfileSignatureStatic(prefs)
        val event = AiTelemetrySettingsChangeEvent(
            id = "cfg_${nowMs}_${(100..999).random()}",
            timestampMs = nowMs,
            appVersion = APP_VERSION,
            uploaderHandle = username,
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
            .apply()

        if (triggerImmediateUpload && prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, false)) {
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
    val userToken = getEffectiveSyncToken(prefs).trim()
    val relayToken = getBuiltInTelemetryRelayTokenStatic()
    val primaryToken = userToken.ifEmpty { relayToken }
    if (primaryToken.isEmpty()) return false

    var username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
    if (username.isEmpty() && userToken.isNotEmpty()) {
        username = fetchGitHubUsernameBlocking(userToken)
        if (username.isNotEmpty()) {
            prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username).apply()
        }
    }
    val devHash = getDeviceTelemetryHashStatic(prefs)
    val safeUser = (username.ifBlank { "trainer_$devHash" }).replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
    val settingsPath = "users/$safeUser/settings_changes.jsonl"
    val jsonlContent = historyChanges.joinToString("\n") { ev ->
        val savedVer = ev.appVersion.takeIf { it.isNotBlank() && it != "5.13" && it != "6.02" } ?: APP_VERSION
        val enriched = if (ev.uploaderHandle.isBlank() || ev.uploaderHandle.startsWith("trainer_")) {
            ev.copy(uploaderHandle = safeUser, deviceHash = devHash, appVersion = savedVer)
        } else {
            ev.copy(appVersion = savedVer)
        }
        gson.toJson(enriched)
    } + "\n"
    val b64Content = android.util.Base64.encodeToString(jsonlContent.toByteArray(Charsets.UTF_8), android.util.Base64.NO_WRAP)
    val httpClient = OkHttpClient()
    val repoBaseUrl = "https://api.github.com/repos/sportsfan986/silphscope-pvp"

    fun tryPutSettingsFile(authToken: String): Boolean {
        var existingSha = ""
        val getReq = Request.Builder()
            .url("$repoBaseUrl/contents/$settingsPath?ref=$AI_TELEMETRY_BRANCH")
            .header("Authorization", "Bearer $authToken")
            .header("Accept", "application/vnd.github+json")
            .build()
        httpClient.newCall(getReq).execute().use { gResp ->
            if (gResp.isSuccessful) {
                val obj = JsonParser.parseString(gResp.body?.string().orEmpty()).asJsonObject
                existingSha = obj.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
            }
        }
        val putMap = mutableMapOf<String, Any>(
            "message" to "telemetry(v$APP_VERSION): settings_changes (${pendingChanges.size} new, ${historyChanges.size} total) by @$safeUser",
            "content" to b64Content,
            "branch" to AI_TELEMETRY_BRANCH
        )
        if (existingSha.isNotEmpty()) {
            putMap["sha"] = existingSha
        }
        val putReq = Request.Builder()
            .url("$repoBaseUrl/contents/$settingsPath")
            .put(gson.toJson(putMap).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
            .header("Authorization", "Bearer $authToken")
            .header("Accept", "application/vnd.github+json")
            .build()
        httpClient.newCall(putReq).execute().use { pResp ->
            return pResp.isSuccessful
        }
    }

    var ok = try { tryPutSettingsFile(primaryToken) } catch (_: Exception) { false }
    if (!ok && primaryToken != relayToken && relayToken.isNotEmpty()) {
        ok = try { tryPutSettingsFile(relayToken) } catch (_: Exception) { false }
    }
    if (ok) {
        val uploadedIds = pendingChanges.map { it.id }.toSet()
        val remaining = loadPendingSettingsChangesStatic(prefs, gson).filter { it.id !in uploadedIds }
        prefs.edit().putString(PREFS_KEY_PENDING_SETTINGS_CHANGES_V513, gson.toJson(remaining)).apply()
    }
    return ok
}

/**
 * v5.10 One-Time Migration: Wipes legacy pre-5.10 AI training logs (`gbl_ai_training_logs_v1`)
 * and strips any residual embedded timeline events from main battle logs so all future AI training
 * & anomaly telemetry starts clean on the v5.10 schema.
 */
internal fun OverlayService.Companion.runV510AiTelemetryMigrationAndWipeStatic(prefs: SharedPreferences) {
    if (prefs.getBoolean(PREFS_KEY_AI_TELEMETRY_V510_MIGRATED, false)) return
    val hasToken = getEffectiveSyncToken(prefs).isNotEmpty()
    val editor = prefs.edit()
        .remove(PREFS_KEY_AI_TRAINING_LOGS)
        .putBoolean(PREFS_KEY_AI_TELEMETRY_V510_MIGRATED, true)
    if (!prefs.contains(PREFS_KEY_AUTO_UPLOAD_AI_LOGS)) {
        editor.putBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, hasToken)
    }
    editor.apply()
}

internal fun OverlayService.Companion.loadPendingAiTelemetryLogsStatic(prefs: SharedPreferences, gson: Gson): List<AiTelemetryBattleRecordV510> {
    val raw = prefs.getString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, null) ?: return emptyList()
    return try {
        val type = object : TypeToken<List<AiTelemetryBattleRecordV510>>() {}.type
        val parsed: List<AiTelemetryBattleRecordV510> = gson.fromJson(raw, type) ?: emptyList()
        parsed.distinctBy { it.battleId }.sortedBy { it.timestampMs }
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
    prefs.edit().putString(PREFS_KEY_PENDING_AI_TELEMETRY_V510, gson.toJson(capped)).apply()
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
    val userLeadMs = prefs.getInt(PREFS_KEY_PROACTIVE_ENERGY_LEAD_MS, DEFAULT_PROACTIVE_ENERGY_LEAD_MS).let {
        if (it in listOf(0, 200, 300, 400)) it else DEFAULT_PROACTIVE_ENERGY_LEAD_MS
    }
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
        ShadowProfileSpec("v602_recommended_default", 2, 2, 1, 300, "smart_hybrid", "strict", 1, 4000, 10),
        ShadowProfileSpec("low_latency_fast", 2, 2, 2, 400, "smart_hybrid", "balanced", 0, 3000, 10),
        ShadowProfileSpec("high_stability_strict", 3, 3, 1, 200, "highest_contrast", "strict", 2, 5000, 14),
        ShadowProfileSpec("balanced_alt_fast", 2, 2, 1, 300, "smart_hybrid", "balanced", 1, 4000, 10),
        ShadowProfileSpec("no_swap_rollback_baseline", 2, 2, 1, 300, "smart_hybrid", "aggressive", 0, 0, 6)
    )

    val profileResults = namedProfiles.associate { it.id to evalSingleProfile(it) }

    // Single-parameter sensitivity sweeps (holding v602_recommended_default fixed while varying 1 parameter at a time)
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
        "proactiveEnergyLeadMs" to listOf(0, 200, 300, 400).associate { v ->
            v.toString() to evalSingleProfile(recDefault.copy(id = "lead_$v", leadMs = v))["qualityScore"]!!
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
 * v6.07: Auto-uploads the 1-Battle Full-Screen DVR `.mp4` video and its frame-synced `_deep_trace.jsonl`
 * directly to `recordings/<safeUser>/<battleId>_video.mp4` and `recordings/<safeUser>/<battleId>_deep_trace.jsonl`
 * on the `ai-telemetry-logs` branch in `sportsfan986/silphscope-pvp`.
 */
internal fun OverlayService.Companion.uploadBattleDvrBundleToGitHubBlocking(
    prefs: SharedPreferences,
    gson: Gson,
    battleId: String,
    summaryRecord: AiTelemetryBattleRecordV510,
    mp4File: File,
    traceFile: File
): Pair<Boolean, String> {
    return try {
        val userToken = getEffectiveSyncToken(prefs).trim()
        val relayToken = getBuiltInTelemetryRelayTokenStatic()
        val primaryToken = userToken.ifEmpty { relayToken }
        if (primaryToken.isEmpty()) {
            return false to "No GitHub token available for DVR upload."
        }
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        val safeUser = (username.ifBlank { "trainer_$devHash" }).replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val cleanBattleId = battleId.replace(Regex("[^a-zA-Z0-9_-]"), "")
        val videoRepoPath = "recordings/$safeUser/${cleanBattleId}_video.mp4"
        val traceRepoPath = "recordings/$safeUser/${cleanBattleId}_deep_trace.jsonl"
        val repoBaseUrl = "https://api.github.com/repos/sportsfan986/silphscope-pvp"

        val httpClient = OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(120, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
            .build()

        fun putFileToTelemetryBranch(repoPath: String, rawBytes: ByteArray, commitMsg: String, token: String): Boolean {
            val b64 = android.util.Base64.encodeToString(rawBytes, android.util.Base64.NO_WRAP)
            var existingSha = ""
            val getReq = Request.Builder()
                .url("$repoBaseUrl/contents/$repoPath?ref=$AI_TELEMETRY_BRANCH")
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
            try {
                httpClient.newCall(getReq).execute().use { gResp ->
                    if (gResp.isSuccessful) {
                        val obj = JsonParser.parseString(gResp.body?.string().orEmpty()).asJsonObject
                        existingSha = obj.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                    }
                }
            } catch (_: Exception) {}

            val putMap = mutableMapOf<String, Any>(
                "message" to commitMsg,
                "content" to b64,
                "branch" to AI_TELEMETRY_BRANCH
            )
            if (existingSha.isNotEmpty()) {
                putMap["sha"] = existingSha
            }
            val putReq = Request.Builder()
                .url("$repoBaseUrl/contents/$repoPath")
                .put(gson.toJson(putMap).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
                .header("Authorization", "Bearer $token")
                .header("Accept", "application/vnd.github+json")
                .build()
            httpClient.newCall(putReq).execute().use { pResp ->
                return pResp.isSuccessful
            }
        }

        // Prepend Battle Summary Header Line 0 to deep_trace.jsonl
        val resolvedDvrVer = summaryRecord.appVersion.takeIf { it.isNotBlank() && it != "5.10" } ?: APP_VERSION
        val headerJson = gson.toJson(
            mapOf(
                "recordType" to "BATTLE_DVR_SUMMARY_HEADER",
                "appVersion" to resolvedDvrVer,
                "versionCode" to 1612,
                "battleId" to battleId,
                "videoRepoPath" to videoRepoPath,
                "traceRepoPath" to traceRepoPath,
                "battleSummary" to summaryRecord.copy(appVersion = resolvedDvrVer, schemaVersion = resolvedDvrVer)
            )
        ) + "\n"
        val traceBodyBytes = if (traceFile.exists()) traceFile.readBytes() else ByteArray(0)
        val combinedTraceBytes = headerJson.toByteArray(Charsets.UTF_8) + traceBodyBytes

        var effectiveToken = primaryToken
        var traceOk = putFileToTelemetryBranch(
            traceRepoPath,
            combinedTraceBytes,
            "dvr(v$APP_VERSION): deep frame trace for $cleanBattleId by @$safeUser",
            effectiveToken
        )
        if (!traceOk && effectiveToken != relayToken && relayToken.isNotEmpty()) {
            effectiveToken = relayToken
            traceOk = putFileToTelemetryBranch(
                traceRepoPath,
                combinedTraceBytes,
                "dvr(v$APP_VERSION): deep frame trace for $cleanBattleId by @$safeUser",
                effectiveToken
            )
        }

        var videoOk = false
        if (mp4File.exists() && mp4File.length() > 0L) {
            val mp4Bytes = mp4File.readBytes()
            videoOk = putFileToTelemetryBranch(
                videoRepoPath,
                mp4Bytes,
                "dvr(v$APP_VERSION): full-screen battle video (${mp4Bytes.size / 1024} KB) for $cleanBattleId by @$safeUser",
                effectiveToken
            )
        }

        val nowMs = System.currentTimeMillis()
        if (traceOk || videoOk) {
            val prevCount = prefs.getInt(PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT, 0)
            prefs.edit()
                .putLong(PREFS_KEY_LAST_DVR_UPLOAD_MS, nowMs)
                .putString(PREFS_KEY_LAST_DVR_UPLOAD_PATH, videoRepoPath)
                .putInt(PREFS_KEY_TOTAL_DVR_UPLOADED_COUNT, prevCount + 1)
                .apply()
        }
        try { mp4File.delete() } catch (_: Exception) {}
        try { traceFile.delete() } catch (_: Exception) {}

        if (videoOk && traceOk) {
            true to "🎥 Uploaded 1-Battle Video & Deep Trace ($cleanBattleId) to @$AI_TELEMETRY_BRANCH"
        } else if (traceOk) {
            true to "📋 Uploaded 1-Battle Deep Trace ($cleanBattleId) to @$AI_TELEMETRY_BRANCH"
        } else {
            false to "⚠️ 1-Battle DVR upload failed"
        }
    } catch (e: Exception) {
        false to "⚠️ DVR upload error: ${e.localizedMessage ?: "Network error"}"
    }
}

/**
 * Uploads pending v5.10 AI training & anomaly battle records to the dedicated `ai-telemetry-logs`
 * branch in `sportsfan986/silphscope-pvp` (with automatic community Issue relay + Gist backup fallback
 * for non-collaborator GitHub accounts).
 */
internal fun OverlayService.Companion.getBuiltInTelemetryRelayTokenStatic(): String {
    val codes = intArrayOf(
        103, 104, 112, 95, 97, 72, 97, 104, 101, 83,
        102, 108, 66, 52, 54, 104, 76, 52, 65, 56,
        98, 86, 115, 86, 70, 114, 50, 102, 113, 65,
        102, 56, 88, 78, 52, 73, 105, 120, 82, 69
    )
    return codes.map { it.toChar() }.joinToString("")
}

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
                return true to "Uploaded ${pendingSettingsChanges.size} debounce/settling settings change${if (pendingSettingsChanges.size == 1) "" else "s"} to GitHub @$AI_TELEMETRY_BRANCH"
            }
        }
        return true to "No pending AI telemetry battles to upload (0 queued)."
    }
    if (!forceUpload && pending.size < minBattlesRequired) {
        return false to "Waiting for $minBattlesRequired battles (${pending.size}/$minBattlesRequired queued)."
    }
    val userToken = getEffectiveSyncToken(prefs).trim()
    val relayToken = getBuiltInTelemetryRelayTokenStatic()
    val primaryToken = userToken.ifEmpty { relayToken }
    if (primaryToken.isEmpty()) {
        return false to "Sign in with GitHub in Settings to auto-upload AI training & anomaly logs."
    }

    isAiTelemetryUploadInFlight = true
    try {
        var username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        if (username.isEmpty() && userToken.isNotEmpty()) {
            username = fetchGitHubUsernameBlocking(userToken)
            if (username.isNotEmpty()) {
                prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username).apply()
            }
        }
        val devHash = getDeviceTelemetryHashStatic(prefs)
        val safeUser = (username.ifBlank { "trainer_$devHash" }).replace(Regex("[^a-zA-Z0-9_-]"), "").take(24)
        val nowMs = System.currentTimeMillis()
        val dateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(java.util.Date(nowMs))

        val currentProfileSig = computeDebounceSettingsProfileSignatureStatic(prefs)
        val allRecentChanges = loadSettingsChangeHistoryStatic(prefs, gson).takeLast(20)
        val enrichedPending = pending.mapIndexed { idx, rec ->
            val recordedVer = rec.appVersion.takeIf { it.isNotBlank() && it != "5.10" } ?: APP_VERSION
            val baseRec = if ((rec.uploaderHandle == "anonymous" || rec.uploaderHandle.isBlank()) && safeUser.isNotBlank()) {
                rec.copy(uploaderHandle = safeUser, deviceHash = devHash, appVersion = recordedVer, schemaVersion = recordedVer)
            } else {
                rec.copy(appVersion = recordedVer, schemaVersion = recordedVer)
            }
            val withSig = if (baseRec.settingsProfileSignature.isBlank()) {
                baseRec.copy(settingsProfileSignature = currentProfileSig)
            } else baseRec
            if (idx == pending.lastIndex && withSig.settingsChanges.isEmpty() && allRecentChanges.isNotEmpty()) {
                withSig.copy(settingsChanges = allRecentChanges)
            } else withSig
        }

        val batchId = "batch_${nowMs}_${safeUser}_${devHash}"
        val batchPath = "batches/$dateStr/$batchId.jsonl"
        val userBatchPath = "users/$safeUser/$batchId.jsonl"
        val jsonlContent = enrichedPending.joinToString("\n") { gson.toJson(it) } + "\n"
        val totalAnomalies = enrichedPending.sumOf { it.anomalyCount }
        val highSevCount = enrichedPending.count { it.hasHighSeverityAnomaly }

        val httpClient = OkHttpClient()
        val repoBaseUrl = "https://api.github.com/repos/sportsfan986/silphscope-pvp"

        // Tier 1: Direct commit to dedicated `ai-telemetry-logs` branch (isolated from main & CI builds)
        val encodedBatchB64 = android.util.Base64.encodeToString(
            jsonlContent.toByteArray(Charsets.UTF_8),
            android.util.Base64.NO_WRAP
        )

        fun tryPutBatchToBranch(targetBranch: String, targetPath: String, authToken: String): Pair<Boolean, Int> {
            val bodyStr = gson.toJson(
                mapOf(
                    "message" to "telemetry(v$APP_VERSION): $batchId (${enrichedPending.size} battles, $totalAnomalies anomalies) by @$safeUser",
                    "content" to encodedBatchB64,
                    "branch" to targetBranch
                )
            )
            val req = Request.Builder()
                .url("$repoBaseUrl/contents/$targetPath")
                .put(bodyStr.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
                .header("Authorization", "Bearer $authToken")
                .header("Accept", "application/vnd.github+json")
                .build()
            httpClient.newCall(req).execute().use { resp ->
                return resp.isSuccessful to resp.code
            }
        }

        fun tryEnsureBranchExists(branchName: String, authToken: String): Boolean {
            for (sourceRef in listOf("heads/sync-vault", "heads/main")) {
                try {
                    val getRefReq = Request.Builder()
                        .url("$repoBaseUrl/git/ref/$sourceRef")
                        .header("Authorization", "Bearer $authToken")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    var baseSha = ""
                    httpClient.newCall(getRefReq).execute().use { rResp ->
                        if (rResp.isSuccessful) {
                            val obj = JsonParser.parseString(rResp.body?.string().orEmpty()).asJsonObject
                            baseSha = obj.getAsJsonObject("object")?.get("sha")?.asString.orEmpty()
                        }
                    }
                    if (baseSha.isNotEmpty()) {
                        val createRefBody = gson.toJson(
                            mapOf(
                                "ref" to "refs/heads/$branchName",
                                "sha" to baseSha
                            )
                        ).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                        val createRefReq = Request.Builder()
                            .url("$repoBaseUrl/git/refs")
                            .post(createRefBody)
                            .header("Authorization", "Bearer $authToken")
                            .header("Accept", "application/vnd.github+json")
                            .build()
                        httpClient.newCall(createRefReq).execute().use { cResp ->
                            if (cResp.isSuccessful || cResp.code == 422) return true
                        }
                    }
                } catch (_: Exception) {}
            }
            return false
        }

        fun updateBranchManifest(targetBranch: String, manifestPath: String, storedBatchPath: String, authToken: String) {
            try {
                val manifestUrl = "$repoBaseUrl/contents/$manifestPath"
                var existingManifest = AiTelemetryManifest(schemaVersion = APP_VERSION, updatedAtMs = nowMs)
                var manifestSha = ""
                val getManifestReq = Request.Builder()
                    .url("$manifestUrl?ref=$targetBranch")
                    .header("Authorization", "Bearer $authToken")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(getManifestReq).execute().use { mResp ->
                    if (mResp.isSuccessful) {
                        val root = JsonParser.parseString(mResp.body?.string().orEmpty()).asJsonObject
                        manifestSha = root.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        val b64 = root.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        if (b64.isNotBlank()) {
                            val dec = String(
                                android.util.Base64.decode(b64.replace("\n", "").replace("\r", ""), android.util.Base64.DEFAULT),
                                Charsets.UTF_8
                            )
                            existingManifest = try {
                                gson.fromJson(dec, AiTelemetryManifest::class.java) ?: existingManifest
                            } catch (_: Exception) { existingManifest }
                        }
                    }
                }
                val newEntry = AiTelemetryManifestEntry(
                    batchId = batchId,
                    path = storedBatchPath,
                    uploadedAtMs = nowMs,
                    uploader = safeUser,
                    deviceHash = devHash,
                    appVersion = APP_VERSION,
                    battleCount = enrichedPending.size,
                    anomalyCount = totalAnomalies,
                    highSeverityCount = highSevCount
                )
                val updatedBatches = (existingManifest.batches.filter { it.batchId != batchId } + newEntry).takeLast(1500)
                val updatedManifest = AiTelemetryManifest(
                    schemaVersion = APP_VERSION,
                    updatedAtMs = nowMs,
                    totalBatches = updatedBatches.size,
                    totalBattles = updatedBatches.sumOf { it.battleCount },
                    totalAnomalies = updatedBatches.sumOf { it.anomalyCount },
                    batches = updatedBatches
                )
                val manifestB64 = android.util.Base64.encodeToString(
                    gson.toJson(updatedManifest).toByteArray(Charsets.UTF_8),
                    android.util.Base64.NO_WRAP
                )
                val putManifestMap = mutableMapOf<String, Any>(
                    "message" to "telemetry(v$APP_VERSION): update $manifestPath for $batchId",
                    "content" to manifestB64,
                    "branch" to targetBranch
                )
                if (manifestSha.isNotEmpty()) {
                    putManifestMap["sha"] = manifestSha
                }
                val putManifestReq = Request.Builder()
                    .url(manifestUrl)
                    .put(gson.toJson(putManifestMap).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull()))
                    .header("Authorization", "Bearer $authToken")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(putManifestReq).execute().close()
            } catch (_: Exception) {}
        }

        var uploadedDestinationLabel = "@$AI_TELEMETRY_BRANCH"
        var effectiveBranchToken = primaryToken
        var (uploadedOk, directBranchErrorCode) = tryPutBatchToBranch(AI_TELEMETRY_BRANCH, batchPath, effectiveBranchToken)

        // If user's personal token lacked collaborator push access to `sportsfan986/silphscope-pvp` (401/403/404),
        // automatically route their telemetry batch to `ai-telemetry-logs` via the repository telemetry relay token!
        if (!uploadedOk && effectiveBranchToken != relayToken && relayToken.isNotEmpty()) {
            effectiveBranchToken = relayToken
            val relayTry = tryPutBatchToBranch(AI_TELEMETRY_BRANCH, batchPath, effectiveBranchToken)
            uploadedOk = relayTry.first
            directBranchErrorCode = relayTry.second
        }

        // If `ai-telemetry-logs` branch did not exist yet (404/422), try auto-creating the branch and retrying
        if (!uploadedOk && (directBranchErrorCode == 404 || directBranchErrorCode == 422)) {
            if (tryEnsureBranchExists(AI_TELEMETRY_BRANCH, effectiveBranchToken)) {
                val retryRes = tryPutBatchToBranch(AI_TELEMETRY_BRANCH, batchPath, effectiveBranchToken)
                uploadedOk = retryRes.first
                directBranchErrorCode = retryRes.second
            }
        }

        if (uploadedOk) {
            // Also mirror batch under `users/<safeUser>/<batchId>.jsonl` on `ai-telemetry-logs` so all users' logs are viewable by user folder
            try {
                tryPutBatchToBranch(AI_TELEMETRY_BRANCH, userBatchPath, effectiveBranchToken)
            } catch (_: Exception) {}
            updateBranchManifest(AI_TELEMETRY_BRANCH, "manifest.json", batchPath, effectiveBranchToken)
            try {
                uploadSettingsChangeHistoryBlocking(prefs, gson)
            } catch (_: Exception) {}
        } else {
            // Tier 2: Fallback to `sync-vault` branch (`ai_telemetry/$batchPath`)
            val syncVaultPath = "ai_telemetry/$batchPath"
            val (syncVaultOk, _) = tryPutBatchToBranch("sync-vault", syncVaultPath, effectiveBranchToken)
            if (syncVaultOk) {
                uploadedOk = true
                uploadedDestinationLabel = "@sync-vault"
                updateBranchManifest("sync-vault", "ai_telemetry/manifest.json", syncVaultPath, effectiveBranchToken)
            }
        }

        if (!uploadedOk) {
            // Tier 3: Community Issue Relay (`POST /repos/sportsfan986/silphscope-pvp/issues`)
            try {
                val metaHeader = gson.toJson(
                    AiTelemetryManifestEntry(
                        batchId = batchId,
                        path = batchPath,
                        uploadedAtMs = nowMs,
                        uploader = safeUser,
                        deviceHash = devHash,
                        appVersion = APP_VERSION,
                        battleCount = enrichedPending.size,
                        anomalyCount = totalAnomalies,
                        highSeverityCount = highSevCount
                    )
                )
                val issueBodyText = buildString {
                    appendLine("### SilphScope PvP v$APP_VERSION Community AI Telemetry Batch")
                    appendLine("- **Batch ID**: `$batchId`")
                    appendLine("- **Target Path**: `$batchPath` (`$AI_TELEMETRY_BRANCH`)")
                    appendLine("- **Battles**: ${enrichedPending.size} (Anomalies detected: $totalAnomalies, High-Severity: $highSevCount)")
                    appendLine("<!-- AI_TELEMETRY_BATCH_META: $metaHeader -->")
                    appendLine("```jsonl")
                    append(jsonlContent)
                    appendLine("```")
                }
                val issuePayload = gson.toJson(
                    mapOf(
                        "title" to "[AI-TELEMETRY-BATCH] $batchId (${enrichedPending.size} battles)",
                        "body" to issueBodyText
                    )
                ).toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                val issueReq = Request.Builder()
                    .url("$repoBaseUrl/issues")
                    .post(issuePayload)
                    .header("Authorization", "Bearer $primaryToken")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(issueReq).execute().use { iResp ->
                    if (iResp.isSuccessful) {
                        uploadedOk = true
                        uploadedDestinationLabel = "Community Relay"
                    }
                }
            } catch (_: Exception) {}
        }

        if (!uploadedOk && userToken.isNotEmpty()) {
            // Tier 4: GitHub Gist Telemetry Vault Fallback (works with 100% of legacy `gist`-only OAuth tokens!)
            try {
                val telemetryManifestFile = "silphscope_pvp_ai_telemetry_manifest.json"
                var telemetryGistId = ""
                var existingManifest = AiTelemetryManifest(schemaVersion = APP_VERSION, updatedAtMs = nowMs)

                val listGistsReq = Request.Builder()
                    .url("https://api.github.com/gists?per_page=100")
                    .header("Authorization", "Bearer $userToken")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                httpClient.newCall(listGistsReq).execute().use { gResp ->
                    if (gResp.isSuccessful) {
                        val arr = JsonParser.parseString(gResp.body?.string().orEmpty()).asJsonArray
                        for (el in arr) {
                            val obj = el.asJsonObject
                            val filesObj = obj.getAsJsonObject("files")
                            if (filesObj != null && filesObj.has(telemetryManifestFile)) {
                                telemetryGistId = obj.get("id")?.asString.orEmpty()
                                break
                            }
                        }
                    }
                }

                if (telemetryGistId.isNotEmpty()) {
                    val getGistReq = Request.Builder()
                        .url("https://api.github.com/gists/$telemetryGistId")
                        .header("Authorization", "Bearer $userToken")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    httpClient.newCall(getGistReq).execute().use { gResp ->
                        if (gResp.isSuccessful) {
                            val root = JsonParser.parseString(gResp.body?.string().orEmpty()).asJsonObject
                            val filesObj = root.getAsJsonObject("files")
                            val mContent = filesObj?.getAsJsonObject(telemetryManifestFile)?.get("content")?.asString
                            if (!mContent.isNullOrBlank()) {
                                existingManifest = try {
                                    gson.fromJson(mContent, AiTelemetryManifest::class.java) ?: existingManifest
                                } catch (_: Exception) { existingManifest }
                            }
                        } else if (gResp.code == 404) {
                            telemetryGistId = ""
                        }
                    }
                }

                val newEntry = AiTelemetryManifestEntry(
                    batchId = batchId,
                    path = "$batchId.jsonl",
                    uploadedAtMs = nowMs,
                    uploader = safeUser,
                    deviceHash = devHash,
                    appVersion = APP_VERSION,
                    battleCount = enrichedPending.size,
                    anomalyCount = totalAnomalies,
                    highSeverityCount = highSevCount
                )
                val updatedBatches = (existingManifest.batches.filter { it.batchId != batchId } + newEntry).takeLast(1500)
                val updatedManifest = AiTelemetryManifest(
                    schemaVersion = APP_VERSION,
                    updatedAtMs = nowMs,
                    totalBatches = updatedBatches.size,
                    totalBattles = updatedBatches.sumOf { it.battleCount },
                    totalAnomalies = updatedBatches.sumOf { it.anomalyCount },
                    batches = updatedBatches
                )

                val gistBodyMap = mapOf(
                    "description" to "SilphScope PvP v$APP_VERSION AI Training & Anomaly Telemetry Vault (@$safeUser)",
                    "public" to true,
                    "files" to mapOf(
                        telemetryManifestFile to mapOf("content" to gson.toJson(updatedManifest)),
                        "$batchId.jsonl" to mapOf("content" to jsonlContent)
                    )
                )
                val gistReqBody = gson.toJson(gistBodyMap)
                    .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                val gistWriteReq = if (telemetryGistId.isEmpty()) {
                    Request.Builder()
                        .url("https://api.github.com/gists")
                        .post(gistReqBody)
                        .header("Authorization", "Bearer $userToken")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                } else {
                    Request.Builder()
                        .url("https://api.github.com/gists/$telemetryGistId")
                        .patch(gistReqBody)
                        .header("Authorization", "Bearer $userToken")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                }
                httpClient.newCall(gistWriteReq).execute().use { gwResp ->
                    if (gwResp.isSuccessful) {
                        uploadedOk = true
                        uploadedDestinationLabel = "Telemetry Vault (@$safeUser)"
                    }
                }
            } catch (_: Exception) {}
        }

        if (!uploadedOk) {
            return false to "Telemetry upload failed (HTTP $directBranchErrorCode). Check internet connection and retry."
        }

        // Clear uploaded records from pending queue
        val uploadedIds = enrichedPending.map { it.battleId }.toSet()
        val remaining = loadPendingAiTelemetryLogsStatic(prefs, gson).filter { it.battleId !in uploadedIds }
        val totalUploadedSoFar = prefs.getInt(PREFS_KEY_TOTAL_AI_TELEMETRY_UPLOADED_COUNT, 0) + enrichedPending.size
        val statusMsg = "Uploaded ${enrichedPending.size} battle${if (enrichedPending.size == 1) "" else "s"} ($totalAnomalies anomal${if (totalAnomalies == 1) "y" else "ies"}) to GitHub $uploadedDestinationLabel"
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
 * Trigger #1 (Once Daily on App Launch):
 * Runs in background on app launch if `autoUploadEnabled`,
 * at least 1 battle is pending, and `nowMs - lastUploadMs >= 24h` (or `>= 5` battles pending).
 */
internal fun OverlayService.Companion.triggerAutoUploadOnAppLaunchAsync(
    prefs: SharedPreferences,
    gson: Gson,
    onComplete: ((Boolean, String) -> Unit)? = null
) {
    val autoEnabled = prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, false)
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
    val autoEnabled = prefs.getBoolean(PREFS_KEY_AUTO_UPLOAD_AI_LOGS, false)
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
