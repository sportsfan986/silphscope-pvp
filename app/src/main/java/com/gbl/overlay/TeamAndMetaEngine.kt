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
import com.gbl.overlay.OverlayService.Companion.activeGblMetaDecayFactor
import com.gbl.overlay.OverlayService.Companion.activeGblMetaLogWeightPct
import com.gbl.overlay.OverlayService.Companion.activeLimitedStdBlendPctGbl
import com.gbl.overlay.OverlayService.Companion.activeLimitedStdDecayGbl
import com.gbl.overlay.OverlayService.Companion.activeShow6MetaDecayFactor
import com.gbl.overlay.OverlayService.Companion.activeShow6MetaLogWeightPct
import com.gbl.overlay.OverlayService.Companion.activeShow6UsageWeightPct
import com.gbl.overlay.OverlayService.Companion.ALL_18_TYPES
import com.gbl.overlay.OverlayService.Companion.AntiMetaAltMovesetInfo
import com.gbl.overlay.OverlayService.Companion.AntiMetaTeamBuilderResult
import com.gbl.overlay.OverlayService.Companion.AntiMetaTeamOption
import com.gbl.overlay.OverlayService.Companion.BacklineCandidatePrediction
import com.gbl.overlay.OverlayService.Companion.BacklinePredictionResult
import com.gbl.overlay.OverlayService.Companion.BATTLE_FRONTIER_CORES_MAP
import com.gbl.overlay.OverlayService.Companion.BlendedMetaCoreEntry
import com.gbl.overlay.OverlayService.Companion.BlendedMetaPokemonEntry
import com.gbl.overlay.OverlayService.Companion.BlendedSeasonMetaDistribution
import com.gbl.overlay.OverlayService.Companion.CACHED_GBL_STD_SEASON_LOGS
import com.gbl.overlay.OverlayService.Companion.CRITICAL_META_TYPES
import com.gbl.overlay.OverlayService.Companion.DYNAMIC_POKEMON_DATABASE
import com.gbl.overlay.OverlayService.Companion.FeaturedRankRangeSpec
import com.gbl.overlay.OverlayService.Companion.FormResolver
import com.gbl.overlay.OverlayService.Companion.getLeagueCpCapStatic
import com.gbl.overlay.OverlayService.Companion.isBattleFrontierLeagueStatic
import com.gbl.overlay.OverlayService.Companion.isMegaAllowedInLeagueStatic
import com.gbl.overlay.OverlayService.Companion.lastPrecomputedTeamSignature
import com.gbl.overlay.OverlayService.Companion.LIVE_RANKINGS_MAP
import com.gbl.overlay.OverlayService.Companion.MovesetUpgradeSuggestion
import com.gbl.overlay.OverlayService.Companion.normalizeLeagueKeyStatic
import com.gbl.overlay.OverlayService.Companion.POKEMON_META_DATABASE
import com.gbl.overlay.OverlayService.Companion.PRECOMPUTED_TOP200_9X9_CACHE
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_BATTLE_LOGS
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_GBL_SEASONS_JSON
import com.gbl.overlay.OverlayService.Companion.PREFS_KEY_SHOW6_BATTLE_LOGS
import com.gbl.overlay.OverlayService.Companion.remapLegacyLeagueForModeStatic
import com.gbl.overlay.OverlayService.Companion.resolveCachedSameCpStandardLogsForCupStatic
import com.gbl.overlay.OverlayService.Companion.RoleUpgradeSuggestion
import com.gbl.overlay.OverlayService.Companion.RoleWeightedTop100MetaDist
import com.gbl.overlay.OverlayService.Companion.SilphScopeTopMetaEntry
import com.gbl.overlay.OverlayService.Companion.SyncBattleLogRecord
import com.gbl.overlay.OverlayService.Companion.TeamArchetypeEvaluationResult
import com.gbl.overlay.OverlayService.Companion.TeamMovesetRecommendationsResult
import com.gbl.overlay.OverlayService.Companion.TeamRoleRecommendationsResult
import com.gbl.overlay.OverlayService.Companion.TOP_30_RANKED_POOL_CACHE

// =============================================================================
// TeamAndMetaEngine.kt - Precomputed 9x9 Matrix, BMF/WAE Battle Quality,
// Blended Season Meta, Backline Predictor, Role/Moveset Upgraders & Anti-Meta Builder
// =============================================================================

internal fun OverlayService.Companion.getTop200MetaPoolForLeagueStatic(league: String): List<String> {
    val normLeague = normalizeLeagueKeyStatic(league)
    val candidates = getTop100MetaCandidatesForLeagueStatic(normLeague, 200).map { it.name }.distinct()
    if (candidates.isNotEmpty()) return candidates
    return getTopMetaPoolForLeagueStatic(league)
}

internal fun OverlayService.Companion.buildUserSlotCacheKey(
    league: String,
    userName: String,
    fastMove: String?,
    charged1: String?,
    charged2: String?,
    cp: Int?,
    ivs: String?,
    oppName: String,
    plusMoveLevel: Int? = 4
): String {
    val normLeague = getLeagueAbbreviationStatic(league)
    val pLvl = (plusMoveLevel ?: 4).coerceIn(0, 4)
    val uSig = "${userName.lowercase().trim()}|${fastMove.orEmpty().lowercase().trim()}|${charged1.orEmpty().lowercase().trim()}|${charged2.orEmpty().lowercase().trim()}|${cp ?: 0}|${ivs.orEmpty().trim()}|+$pLvl"
    val oSig = oppName.lowercase().trim()
    return "$normLeague||$uSig||$oSig"
}

/**
 * Fast single-moveset rough shield rating used in real time ONLY for non-Top-200 spice opponents
 * that were not in the precomputed Top-200 9x9 matrix cache.
 */
internal fun OverlayService.Companion.calculateFastRoughMatchupRatingStatic(
    myName: String,
    oppName: String,
    userShields: Int,
    oppShields: Int,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): Int {
    val sUser = userShields.coerceIn(0, 2)
    val sOpp = oppShields.coerceIn(0, 2)
    val effectiveUserPlusLvl = (myPlusMoveLevel ?: 4).coerceIn(0, 4)
    val myShadow = myName.trim().startsWith("Shadow ", ignoreCase = true) || myName.contains("(Shadow)", ignoreCase = true)
    val oppShadow = oppName.trim().startsWith("Shadow ", ignoreCase = true) || oppName.contains("(Shadow)", ignoreCase = true)

    val myMeta = resolveRecommendedMovesForSpecies(myName, league, myCp, myIvs)
        ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league, myCp, myIvs) }
    val oppMeta = resolveRecommendedMovesForSpecies(oppName, league)
        ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league) }

    val uFast = myFastMove?.takeIf { it.isNotBlank() } ?: myMeta.defaultFastMove
    val uC1 = myCharged1?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove1
    val uC2 = myCharged2?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove2

    val userC1Stats = resolveChargedMoveStatsStatic(uC1, myMeta.types.firstOrNull() ?: "normal")
    val userC2Stats = resolveChargedMoveStatsStatic(uC2, myMeta.types.firstOrNull() ?: "normal")
    val userC1Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC1, myShadow, oppShadow)
    val userC2Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC2, myShadow, oppShadow)
    val userPlusMove = if (effectiveUserPlusLvl <= 0) {
        null
    } else {
        resolveMegaPlusMoveStatic(myMeta.name, league) ?: resolveMegaPlusMoveStatic(myName, league)
    }
    val oppPlusMove = resolveMegaPlusMoveStatic(oppMeta.name, league) ?: resolveMegaPlusMoveStatic(oppName, league)
    val userC3Stats = userPlusMove?.let { resolveChargedMoveStatsStatic(it, myMeta.types.firstOrNull() ?: "normal") }
    val userC3Pct = userPlusMove?.let { calculateChargedMoveDamagePctStatic(myMeta, oppMeta, it, myShadow, oppShadow, plusMoveLevel = effectiveUserPlusLvl) } ?: 0
    val bestUserCharged = max(max(userC1Pct, userC2Pct), userC3Pct)

    val oppC1Stats = resolveChargedMoveStatsStatic(oppMeta.chargedMove1, oppMeta.types.firstOrNull() ?: "normal")
    val oppC2Stats = resolveChargedMoveStatsStatic(oppMeta.chargedMove2, oppMeta.types.firstOrNull() ?: "normal")
    val oppC1Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oppMeta.chargedMove1, oppShadow, myShadow)
    val oppC2Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oppMeta.chargedMove2, oppShadow, myShadow)
    val oppC3Stats = oppPlusMove?.let { resolveChargedMoveStatsStatic(it, oppMeta.types.firstOrNull() ?: "normal") }
    val oppC3Pct = oppPlusMove?.let { calculateChargedMoveDamagePctStatic(oppMeta, myMeta, it, oppShadow, myShadow, plusMoveLevel = 4) } ?: 0
    val bestOppCharged = max(max(oppC1Pct, oppC2Pct), oppC3Pct)

    val uFastKey = uFast.lowercase().trim()
    val userFastType = resolveFastTypeStatic(uFastKey, myMeta.types.firstOrNull() ?: "normal")
    val userFastTurns = resolveFastTurnsStatic(uFastKey, myMeta.fastTurns).coerceAtLeast(1)
    val userFastEnergy = resolveFastEnergyStatic(uFastKey, userFastTurns).coerceAtLeast(1)
    val userFastEpt = userFastEnergy.toDouble() / userFastTurns.toDouble()

    val oFastKey = oppMeta.defaultFastMove.lowercase().trim()
    val oppFastType = resolveFastTypeStatic(oFastKey, oppMeta.types.firstOrNull() ?: "normal")
    val oppFastTurns = resolveFastTurnsStatic(oFastKey, oppMeta.fastTurns).coerceAtLeast(1)
    val oppFastEnergy = resolveFastEnergyStatic(oFastKey, oppFastTurns).coerceAtLeast(1)
    val oppFastEpt = oppFastEnergy.toDouble() / oppFastTurns.toDouble()

    val userFastEff = getTypeEffectivenessStatic(userFastType, oppMeta.types)
    val oppFastEff = getTypeEffectivenessStatic(oppFastType, myMeta.types)

    val userSim = simulateTurnByTurnChargedCycleStatic(
        c1Name = uC1,
        c1Pct = userC1Pct,
        c1Stats = userC1Stats,
        c2Name = uC2,
        c2Pct = userC2Pct,
        c2Stats = userC2Stats,
        fastEpt = userFastEpt,
        defShields = sOpp,
        attackerTypes = myMeta.types,
        c3Name = userPlusMove,
        c3Pct = userC3Pct,
        c3Stats = userC3Stats
    )
    val oppSim = simulateTurnByTurnChargedCycleStatic(
        c1Name = oppMeta.chargedMove1,
        c1Pct = oppC1Pct,
        c1Stats = oppC1Stats,
        c2Name = oppMeta.chargedMove2,
        c2Pct = oppC2Pct,
        c2Stats = oppC2Stats,
        fastEpt = oppFastEpt,
        defShields = sUser,
        attackerTypes = oppMeta.types,
        c3Name = oppPlusMove,
        c3Pct = oppC3Pct,
        c3Stats = oppC3Stats
    )
    val userRawPressure = userSim.effectivePressure * userSim.effectiveFreqMult
    val oppRawPressure = oppSim.effectivePressure * oppSim.effectiveFreqMult

    val avgShields = (sUser + sOpp) * 0.5
    val fastWeight = if (avgShields <= 1.0) 95.0 + avgShields * 25.0 else 120.0 + (avgShields - 1.0) * 35.0
    val shadowBulkDelta = ((if (myShadow) -12 else 0) + (if (oppShadow) 12 else 0)) * (if (avgShields <= 1.0) 1.0 else avgShields)
    val shieldDiff = (sUser - sOpp).toDouble()
    val shieldAdvantageDelta = shieldDiff * (85.0 + 0.65 * ((bestOppCharged + bestUserCharged) * 0.5))

    val totalDelta = 2.0 * (userRawPressure - oppRawPressure) + (userFastEff - oppFastEff) * fastWeight + shadowBulkDelta + shieldAdvantageDelta
    return (500.0 + totalDelta).roundToInt().coerceIn(150, 850)
}

/**
 * Precomputes the full 9x9 weighted move-combo shield matrix for the 3 members of the active team
 * against the Top 200 League Meta so the overlay serves accurate 9x9 battle ratings in O(1) time.
 */
internal fun OverlayService.Companion.precomputeActiveTeamTop200MatrixStatic(preset: OverlayService.TeamPreset?) {
    if (preset == null || preset.pokemon.isEmpty()) return
    val sig = "${preset.league}|" + preset.pokemon.joinToString(";") {
        "${it.name}|${it.fastMove}|${it.chargedMove1}|${it.chargedMove2}|${it.cp}|${it.ivs}|${(it.plusMoveLevel ?: 4).coerceIn(0, 4)}"
    }
    if (sig == lastPrecomputedTeamSignature && PRECOMPUTED_TOP200_9X9_CACHE.isNotEmpty()) return

    val top200List = getTop200MetaPoolForLeagueStatic(preset.league)
    for (slot in preset.pokemon.take(3)) {
        for (oppName in top200List) {
            val key = buildUserSlotCacheKey(
                league = preset.league,
                userName = slot.name,
                fastMove = slot.fastMove,
                charged1 = slot.chargedMove1,
                charged2 = slot.chargedMove2,
                cp = slot.cp,
                ivs = slot.ivs,
                oppName = oppName,
                plusMoveLevel = slot.plusMoveLevel
            )
            if (!PRECOMPUTED_TOP200_9X9_CACHE.containsKey(key)) {
                PRECOMPUTED_TOP200_9X9_CACHE[key] = calculateAllShieldPermutationsStatic(
                    myName = slot.name,
                    oppName = oppName,
                    league = preset.league,
                    myFastMove = slot.fastMove,
                    myCharged1 = slot.chargedMove1,
                    myCharged2 = slot.chargedMove2,
                    myCp = slot.cp,
                    myIvs = slot.ivs,
                    myPlusMoveLevel = slot.plusMoveLevel
                )
            }
            // Also precompute Shadow counterpart if opponent is non-Shadow and Shadow-eligible
            if (!oppName.startsWith("Shadow ", ignoreCase = true)) {
                val shadowOppName = "Shadow $oppName"
                val shadKey = buildUserSlotCacheKey(
                    league = preset.league,
                    userName = slot.name,
                    fastMove = slot.fastMove,
                    charged1 = slot.chargedMove1,
                    charged2 = slot.chargedMove2,
                    cp = slot.cp,
                    ivs = slot.ivs,
                    oppName = shadowOppName,
                    plusMoveLevel = slot.plusMoveLevel
                )
                if (!PRECOMPUTED_TOP200_9X9_CACHE.containsKey(shadKey)) {
                    PRECOMPUTED_TOP200_9X9_CACHE[shadKey] = calculateAllShieldPermutationsStatic(
                        myName = slot.name,
                        oppName = shadowOppName,
                        league = preset.league,
                        myFastMove = slot.fastMove,
                        myCharged1 = slot.chargedMove1,
                        myCharged2 = slot.chargedMove2,
                        myCp = slot.cp,
                        myIvs = slot.ivs,
                        myPlusMoveLevel = slot.plusMoveLevel
                    )
                }
            }
        }
    }
    lastPrecomputedTeamSignature = sig
}

/**
 * O(1) lookup from the precomputed Top-200 9x9 shield matrix cache, with fast real-time rough math fallback
 * for non-Top-200 opponents.
 */
internal fun OverlayService.Companion.getOverlayRealtimeMatchupRatingStatic(
    myName: String,
    oppName: String,
    userShields: Int,
    oppShields: Int,
    league: String,
    myFastMove: String? = null,
    myCharged1: String? = null,
    myCharged2: String? = null,
    myCp: Int? = null,
    myIvs: String? = null,
    myPlusMoveLevel: Int? = 4
): Int {
    val sUser = userShields.coerceIn(0, 2)
    val sOpp = oppShields.coerceIn(0, 2)
    val code = "${sUser}v${sOpp}"
    val key = buildUserSlotCacheKey(league, myName, myFastMove, myCharged1, myCharged2, myCp, myIvs, oppName, myPlusMoveLevel)
    PRECOMPUTED_TOP200_9X9_CACHE[key]?.get(code)?.let { return it }

    return calculateFastRoughMatchupRatingStatic(
        myName = myName,
        oppName = oppName,
        userShields = sUser,
        oppShields = sOpp,
        league = league,
        myFastMove = myFastMove,
        myCharged1 = myCharged1,
        myCharged2 = myCharged2,
        myCp = myCp,
        myIvs = myIvs,
        myPlusMoveLevel = myPlusMoveLevel
    )
}

/**
 * Phase 1: Blind Matchup Favorability (BMF / Pre-Match Expectation):
 * - If oppTeam.firstSwap is null/missing -> returns { bmf = null, pPre = null, bmfPercentage = null, weight = 0.0 }
 * - If oppTeam.finalSeen is null/missing (unrevealed 3rd) -> weight w = 0.75 + meta-average prior (R_bar_swap, R_bar_close)
 * - If all 3 resolved -> weight w = 1.0
 * - S_lead = 0.50 * Rating_1v1(lead, oppLead) + 0.50 * Rating_2v2(lead, oppLead)
 * - S_back = 0.70 * max(Score_A, Score_B) + 0.30 * min(Score_A, Score_B)
 * - M = 0.40 * S_lead + 0.60 * S_back
 * - P_pre = 1 / (1 + exp(-0.006 * (M - 500)))
 */
internal fun OverlayService.Companion.calculateBlindMatchupFavorabilityStatic(
    myTeam: List<String>,
    oppTeam: List<String>,
    league: String,
    myTeamSlots: List<TeamMember>? = null,
    metaPool: List<String>? = null
): BlindMatchupFavorabilityResult {
    val oppLead = oppTeam.getOrNull(0)?.trim().orEmpty()
    val oppSwap = oppTeam.getOrNull(1)?.trim().orEmpty()
    val oppClose = oppTeam.getOrNull(2)?.trim().orEmpty()

    if (oppLead.isEmpty() || oppSwap.isEmpty()) {
        return BlindMatchupFavorabilityResult(
            bmf = null,
            pPre = null,
            bmfPercentage = null,
            weight = 0.0,
            sLead = null,
            sBack = null,
            compositeM = null,
            isUnrevealedThird = false
        )
    }

    val fallbackMons = getTopMetaPoolForLeagueStatic(league).take(3)
    val myLead = myTeam.getOrNull(0)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(0) { "Azumarill" }
    val mySwap = myTeam.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(1) { "Clodsire" }
    val myClose = myTeam.getOrNull(2)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(2) { "Feraligatr" }

    val slot0 = myTeamSlots?.getOrNull(0)
    val slot1 = myTeamSlots?.getOrNull(1)
    val slot2 = myTeamSlots?.getOrNull(2)

    val unrevealedThird = oppClose.isEmpty()
    val weight = if (unrevealedThird) 0.75 else 1.0

    val (lead1v1, lead2v2) = calculate1v1And2v2RatingsStatic(
        myLead, oppLead, league, slot0?.fastMove, slot0?.chargedMove1, slot0?.chargedMove2, slot0?.cp, slot0?.ivs, slot0?.plusMoveLevel
    )
    val sLead = 0.50 * lead1v1.toDouble() + 0.50 * lead2v2.toDouble()

    val scoreA: Double
    val scoreB: Double
    if (!unrevealedThird) {
        val rSwapVsOppSwap = calculateMatchupRatingStatic(
            mySwap, oppSwap, 1, 1, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs, slot1?.plusMoveLevel
        ).toDouble()
        val rCloseVsOppClose = calculateMatchupRatingStatic(
            myClose, oppClose, 1, 1, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs, slot2?.plusMoveLevel
        ).toDouble()
        val rSwapVsOppClose = calculateMatchupRatingStatic(
            mySwap, oppClose, 1, 1, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs, slot1?.plusMoveLevel
        ).toDouble()
        val rCloseVsOppSwap = calculateMatchupRatingStatic(
            myClose, oppSwap, 1, 1, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs, slot2?.plusMoveLevel
        ).toDouble()

        scoreA = (rSwapVsOppSwap + rCloseVsOppClose) / 2.0
        scoreB = (rSwapVsOppClose + rCloseVsOppSwap) / 2.0
    } else {
        val rBarSwap = computeMetaAverage1v1RatingStatic(
            mySwap, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs, metaPool, slot1?.plusMoveLevel
        )
        val rBarClose = computeMetaAverage1v1RatingStatic(
            myClose, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs, metaPool, slot2?.plusMoveLevel
        )
        val rSwapVsOppSwap = calculateMatchupRatingStatic(
            mySwap, oppSwap, 1, 1, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs, slot1?.plusMoveLevel
        ).toDouble()
        val rCloseVsOppSwap = calculateMatchupRatingStatic(
            myClose, oppSwap, 1, 1, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs, slot2?.plusMoveLevel
        ).toDouble()

        scoreA = (rSwapVsOppSwap + rBarClose) / 2.0
        scoreB = (rCloseVsOppSwap + rBarSwap) / 2.0
    }

    val sBack = 0.70 * max(scoreA, scoreB) + 0.30 * min(scoreA, scoreB)
    val mScore = 0.40 * sLead + 0.60 * sBack
    val pPre = 1.0 / (1.0 + kotlin.math.exp(-0.006 * (mScore - 500.0)))
    val roundedPPre = (pPre * 10000.0).roundToInt() / 10000.0
    val bmfPct = (pPre * 1000.0).roundToInt() / 10.0

    return BlindMatchupFavorabilityResult(
        bmf = roundedPPre,
        pPre = roundedPPre,
        bmfPercentage = bmfPct,
        weight = weight,
        sLead = (sLead * 10.0).roundToInt() / 10.0,
        sBack = (sBack * 10.0).roundToInt() / 10.0,
        compositeM = (mScore * 10.0).roundToInt() / 10.0,
        isUnrevealedThird = unrevealedThird
    )
}

/**
 * Phase 2: Dynamic Execution WAE Engine
 *
 * - If event timeline data is absent (e.g., manual entries or legacy matches), sets P_exec = P_pre.
 * - If timeline events exist:
 *   - Partitions the battle duration into active head-to-head intervals k bounded by swap and faint timestamps.
 *   - For each interval, resolves the active pairing's asymmetric shield rating
 *     R_k = Rating_{s_user v s_opp}(userActive, oppActive) using discrete shield counts at that timestamp.
 *   - Weights each interval by its fractional duration tau_k = Delta_t_k / t_total:
 *       S_actual = sum(tau_k * R_k)
 *       P_exec = 1 / (1 + exp(-0.006 * (S_actual - 500)))
 * - Execution Residual (Delta Q):
 *   - Base: Delta Q = Result - P_exec (Result in {0.0, 1.0}).
 *   - Faint Margin Scaling: If Result == 1 and (oppFaints - userFaints) >= 2, scale Delta Q * 1.10.
 *   - Shield in Pocket Penalty: If Result == 0 and userShieldsRemaining > 0:
 *       Delta Q_final = Delta Q - (0.15 * userShieldsRemaining)
 * - Returns { execWae: Delta_Q_final, weightedResidual: Delta_Q_final * weight }.
 */
internal fun OverlayService.Companion.calculateDynamicExecutionWAEStatic(
    myTeam: List<String>,
    oppTeam: List<String>,
    league: String,
    result: String = "WIN",
    timelineEvents: List<BattleTimelineEvent>? = null,
    totalDurationSec: Double? = null,
    explicitUserFaints: Int? = null,
    explicitOppFaints: Int? = null,
    explicitUserShieldsRemaining: Int? = null,
    explicitOppShieldsRemaining: Int? = null,
    myTeamSlots: List<TeamMember>? = null,
    metaPool: List<String>? = null
): DynamicExecutionWAEResult? {
    val bmfRes = calculateBlindMatchupFavorabilityStatic(
        myTeam = myTeam,
        oppTeam = oppTeam,
        league = league,
        myTeamSlots = myTeamSlots,
        metaPool = metaPool
    )
    val pPre = bmfRes.pPre ?: return null
    val weight = bmfRes.weight
    if (weight <= 0.0) return null

    val fallbackMons = getTopMetaPoolForLeagueStatic(league).take(3)
    val myLead = myTeam.getOrNull(0)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(0) { "Azumarill" }
    val mySwap = myTeam.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(1) { "Clodsire" }
    val myClose = myTeam.getOrNull(2)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(2) { "Feraligatr" }
    val myRoster = listOf(myLead, mySwap, myClose).filter { it.isNotEmpty() }

    val oppLead = oppTeam.getOrNull(0)?.trim().orEmpty()
    val oppSwap = oppTeam.getOrNull(1)?.trim().orEmpty()
    val oppClose = oppTeam.getOrNull(2)?.trim().orEmpty()
    val oppRoster = listOf(oppLead, oppSwap, oppClose).filter { it.isNotEmpty() }

    fun resolveUserSlotOverrides(monName: String): TeamMember? {
        val base = FormResolver.extractBaseSpecies(monName)
        return myTeamSlots?.find {
            it.name.equals(monName, ignoreCase = true) ||
                FormResolver.extractBaseSpecies(it.name).equals(base, ignoreCase = true)
        }
    }

    val hasTimeline = !timelineEvents.isNullOrEmpty()
    val rawIntervals = mutableListOf<ExecutionIntervalSegment>()

    var sActual: Double? = null
    var pExec = pPre

    var derivedUserFaints = 0
    var derivedOppFaints = 0
    var runningUserShields = 2
    var runningOppShields = 2

    if (!timelineEvents.isNullOrEmpty()) {
        val sortedEvents = timelineEvents.sortedBy { max(0.0, it.t) }

        var userActive = myLead
        var oppActive = oppLead
        var intervalStartT = 0.0
        var intervalUserShields = 2
        var intervalOppShields = 2

        val userFaintedNames = mutableSetOf<String>()
        val oppFaintedNames = mutableSetOf<String>()

        for (ev in sortedEvents) {
            val evT = max(0.0, ev.t)
            val evType = ev.type.uppercase()
            val evActor = ev.actor.lowercase()

            if (evType == "SHIELD") {
                runningUserShields = ev.userShieldsRemaining.coerceIn(0, 2)
                runningOppShields = ev.oppShieldsRemaining.coerceIn(0, 2)
                val activeMon = (ev.activePokemon ?: ev.pokemonShielded)?.trim().orEmpty()
                if (activeMon.isNotEmpty()) {
                    if (evActor == "user") userActive = activeMon
                    else if (evActor == "opp") oppActive = activeMon
                }
                if (kotlin.math.abs(evT - intervalStartT) < 1e-6) {
                    intervalUserShields = runningUserShields
                    intervalOppShields = runningOppShields
                }
                continue
            }

            if (evType == "SWAP" || evType == "FAINT") {
                if (evT > intervalStartT) {
                    val duration = evT - intervalStartT
                    val uSlot = resolveUserSlotOverrides(userActive)
                    val rVal = calculateMatchupRatingStatic(
                        myName = userActive,
                        oppName = oppActive,
                        userShields = intervalUserShields,
                        oppShields = intervalOppShields,
                        league = league,
                        myFastMove = uSlot?.fastMove,
                        myCharged1 = uSlot?.chargedMove1,
                        myCharged2 = uSlot?.chargedMove2,
                        myCp = uSlot?.cp,
                        myIvs = uSlot?.ivs,
                        myPlusMoveLevel = uSlot?.plusMoveLevel
                    ).toDouble()
                    rawIntervals.add(
                        ExecutionIntervalSegment(
                            tStart = intervalStartT,
                            tEnd = evT,
                            duration = duration,
                            tau = 0.0,
                            userActive = userActive,
                            oppActive = oppActive,
                            userShields = intervalUserShields,
                            oppShields = intervalOppShields,
                            rating = rVal
                        )
                    )
                }

                runningUserShields = ev.userShieldsRemaining.coerceIn(0, 2)
                runningOppShields = ev.oppShieldsRemaining.coerceIn(0, 2)

                if (evType == "FAINT") {
                    if (evActor == "user") {
                        derivedUserFaints++
                        val faintedMon = (ev.pokemonFainted ?: ev.pokemonOut ?: userActive).trim()
                        if (faintedMon.isNotEmpty()) userFaintedNames.add(faintedMon.lowercase())
                        val explicitIn = ev.pokemonIn?.trim().orEmpty()
                        if (explicitIn.isNotEmpty()) {
                            userActive = explicitIn
                        } else {
                            val replacement = myRoster.find { !userFaintedNames.contains(it.lowercase()) }
                            if (replacement != null) userActive = replacement
                        }
                    } else {
                        derivedOppFaints++
                        val faintedMon = (ev.pokemonFainted ?: ev.pokemonOut ?: oppActive).trim()
                        if (faintedMon.isNotEmpty()) oppFaintedNames.add(faintedMon.lowercase())
                        val explicitIn = ev.pokemonIn?.trim().orEmpty()
                        if (explicitIn.isNotEmpty()) {
                            oppActive = explicitIn
                        } else {
                            val replacement = oppRoster.find { !oppFaintedNames.contains(it.lowercase()) }
                            if (replacement != null) oppActive = replacement
                        }
                    }
                } else if (evType == "SWAP") {
                    val nextMon = ev.pokemonIn?.trim().orEmpty()
                    if (nextMon.isNotEmpty()) {
                        if (evActor == "user") userActive = nextMon
                        else oppActive = nextMon
                    }
                }

                intervalStartT = evT
                intervalUserShields = runningUserShields
                intervalOppShields = runningOppShields
            }
        }

        val maxEventT = sortedEvents.maxOfOrNull { max(0.0, it.t) } ?: 0.0
        val resolvedTotalDuration = if (totalDurationSec != null && totalDurationSec > maxEventT) {
            totalDurationSec
        } else {
            maxEventT
        }

        if (resolvedTotalDuration > intervalStartT) {
            val duration = resolvedTotalDuration - intervalStartT
            val uSlot = resolveUserSlotOverrides(userActive)
            val rVal = calculateMatchupRatingStatic(
                myName = userActive,
                oppName = oppActive,
                userShields = intervalUserShields,
                oppShields = intervalOppShields,
                league = league,
                myFastMove = uSlot?.fastMove,
                myCharged1 = uSlot?.chargedMove1,
                myCharged2 = uSlot?.chargedMove2,
                myCp = uSlot?.cp,
                myIvs = uSlot?.ivs,
                myPlusMoveLevel = uSlot?.plusMoveLevel
            ).toDouble()
            rawIntervals.add(
                ExecutionIntervalSegment(
                    tStart = intervalStartT,
                    tEnd = resolvedTotalDuration,
                    duration = duration,
                    tau = 0.0,
                    userActive = userActive,
                    oppActive = oppActive,
                    userShields = intervalUserShields,
                    oppShields = intervalOppShields,
                    rating = rVal
                )
            )
        }

        val totalPartitionDuration = rawIntervals.sumOf { it.duration }
        if (totalPartitionDuration > 0.0 && rawIntervals.isNotEmpty()) {
            val computedSActual = rawIntervals.sumOf { iv ->
                val tau = iv.duration / totalPartitionDuration
                tau * iv.rating
            }
            sActual = (computedSActual * 100.0).roundToInt() / 100.0
            pExec = 1.0 / (1.0 + kotlin.math.exp(-0.006 * (computedSActual - 500.0)))
        }
    }

    val totalPartitionDuration = rawIntervals.sumOf { it.duration }
    val finalIntervals = rawIntervals.map { iv ->
        iv.copy(tau = if (totalPartitionDuration > 0.0) iv.duration / totalPartitionDuration else 0.0)
    }

    val userFaints = (explicitUserFaints ?: derivedUserFaints).coerceIn(0, 3)
    val oppFaints = (explicitOppFaints ?: derivedOppFaints).coerceIn(0, 3)
    val userShieldsRemaining = (explicitUserShieldsRemaining ?: if (hasTimeline) runningUserShields else 0).coerceIn(0, 2)
    val oppShieldsRemaining = (explicitOppShieldsRemaining ?: if (hasTimeline) runningOppShields else 0).coerceIn(0, 2)

    val isWin = result.equals("WIN", ignoreCase = true)
    val numericResult = if (isWin) 1.0 else 0.0
    val deltaQBase = numericResult - pExec
    var deltaQFinal = deltaQBase
    var faintMarginScaled = false
    var shieldPenalty = 0.0

    // Faint Margin Scaling: If Result == 1 and (oppFaints - userFaints) >= 2, scale Delta Q * 1.10
    if (isWin && (oppFaints - userFaints) >= 2) {
        deltaQFinal *= 1.10
        faintMarginScaled = true
    }

    // Shield in Pocket Penalty: If Result == 0 and userShieldsRemaining > 0: Delta Q_final = Delta Q - (0.15 * userShieldsRemaining)
    if (!isWin && userShieldsRemaining > 0) {
        shieldPenalty = 0.15 * userShieldsRemaining
        deltaQFinal -= shieldPenalty
    }

    val roundedPExec = (pExec * 10000.0).roundToInt() / 10000.0
    val roundedExecWae = (deltaQFinal * 10000.0).roundToInt() / 10000.0
    val roundedWeightedResidual = ((deltaQFinal * weight) * 10000.0).roundToInt() / 10000.0

    return DynamicExecutionWAEResult(
        execWae = roundedExecWae,
        weightedResidual = roundedWeightedResidual,
        pExec = roundedPExec,
        pPre = pPre,
        sActual = sActual,
        deltaQBase = (deltaQBase * 10000.0).roundToInt() / 10000.0,
        deltaQFinal = roundedExecWae,
        weight = weight,
        faintMarginScaled = faintMarginScaled,
        shieldPenaltyApplied = (shieldPenalty * 10000.0).roundToInt() / 10000.0,
        userFaints = userFaints,
        oppFaints = oppFaints,
        userShieldsRemaining = userShieldsRemaining,
        oppShieldsRemaining = oppShieldsRemaining,
        intervals = finalIntervals
    )
}

internal fun OverlayService.Companion.computeContextualEventFlagsStatic(
    result: String,
    userShieldsRemaining: Int?,
    oppShieldsRemaining: Int?,
    userFaints: Int?,
    isUnrevealedThird: Boolean
): List<String> {
    val isWin = result.equals("WIN", ignoreCase = true)
    val flags = mutableListOf<String>()

    if (!isWin) {
        if (userShieldsRemaining == 2) {
            flags.add("⚠️ Double Shield Pocket")
        } else if (userShieldsRemaining == 1) {
            flags.add("⚠️ Shield in Pocket")
        }
    } else {
        if (userFaints == 0) {
            flags.add("🧹 Clean Sweep")
        }
        if (userShieldsRemaining != null && oppShieldsRemaining != null && userShieldsRemaining > oppShieldsRemaining) {
            flags.add("🛡️ Shield Advantage")
        }
    }

    if (isUnrevealedThird) {
        flags.add("⚡ 75% Conf")
    }

    return flags
}

internal fun OverlayService.Companion.calculateBattleQuality(
    myTeam: List<String>,
    oppTeam: List<String>,
    league: String,
    result: String = "WIN",
    myTeamSlots: List<TeamMember>? = null,
    metaPool: List<String>? = null,
    timelineEvents: List<BattleTimelineEvent>? = null,
    totalDurationSec: Double? = null,
    explicitUserFaints: Int? = null,
    explicitOppFaints: Int? = null,
    explicitUserShieldsRemaining: Int? = null,
    explicitOppShieldsRemaining: Int? = null
): BattleQualityMetadata? {
    val bmfRes = calculateBlindMatchupFavorabilityStatic(
        myTeam = myTeam,
        oppTeam = oppTeam,
        league = league,
        myTeamSlots = myTeamSlots,
        metaPool = metaPool
    )
    val pPre = bmfRes.pPre ?: return null
    val bmfPct = bmfRes.bmfPercentage ?: return null
    val sLead = bmfRes.sLead ?: return null
    val sBack = bmfRes.sBack ?: return null
    val mScore = bmfRes.compositeM ?: return null
    if (bmfRes.weight <= 0.0) return null

    val execRes = calculateDynamicExecutionWAEStatic(
        myTeam = myTeam,
        oppTeam = oppTeam,
        league = league,
        result = result,
        timelineEvents = timelineEvents,
        totalDurationSec = totalDurationSec,
        explicitUserFaints = explicitUserFaints,
        explicitOppFaints = explicitOppFaints,
        explicitUserShieldsRemaining = explicitUserShieldsRemaining,
        explicitOppShieldsRemaining = explicitOppShieldsRemaining,
        myTeamSlots = myTeamSlots,
        metaPool = metaPool
    ) ?: return null

    val pWin = execRes.pExec
    val isWin = result.equals("WIN", ignoreCase = true)

    // Phase 3: Primary Performance Badges derived from P_pre (BMF)
    val (badgeLabel, badgeColorHex) = if (isWin) {
        when {
            pPre < 0.40 -> "Clutch Win" to "#22d3ee"
            pPre <= 0.60 -> "Skill Win" to "#4ade80"
            else -> "Expected Win" to "#94a3b8"
        }
    } else {
        when {
            pPre > 0.60 -> "Blunder Loss" to "#f43f5e"
            pPre >= 0.40 -> "Tough Loss" to "#fb923c"
            else -> "Expected Loss" to "#94a3b8"
        }
    }

    val hasTimeline = !timelineEvents.isNullOrEmpty()
    val hasExplicitFaints = explicitUserFaints != null
    val hasExplicitShields = explicitUserShieldsRemaining != null || explicitOppShieldsRemaining != null

    val contextualFlags = computeContextualEventFlagsStatic(
        result = result,
        userShieldsRemaining = if (hasTimeline || hasExplicitShields) execRes.userShieldsRemaining else null,
        oppShieldsRemaining = if (hasTimeline || hasExplicitShields) execRes.oppShieldsRemaining else null,
        userFaints = if (hasTimeline || hasExplicitFaints) execRes.userFaints else null,
        isUnrevealedThird = bmfRes.isUnrevealedThird
    )

    return BattleQualityMetadata(
        bmfScore = pPre,
        pPre = pPre,
        bmfPercentage = bmfPct,
        sActual = execRes.sActual,
        pExec = execRes.pExec,
        execWae = execRes.execWae,
        pWin = pWin,
        expWinPct = (pWin * 100.0).roundToInt(),
        deltaQ = execRes.execWae,
        weight = bmfRes.weight,
        weightedResidual = execRes.weightedResidual,
        badgeLabel = badgeLabel,
        badgeColorHex = badgeColorHex,
        badges = listOf(badgeLabel),
        contextualFlags = contextualFlags,
        flags = contextualFlags,
        unrevealedThird = bmfRes.isUnrevealedThird,
        sLead = sLead,
        sBack = sBack,
        compositeScore = mScore,
        faintMarginScaled = execRes.faintMarginScaled,
        shieldPenaltyApplied = execRes.shieldPenaltyApplied,
        userFaints = execRes.userFaints,
        oppFaints = execRes.oppFaints,
        userShieldsRemaining = execRes.userShieldsRemaining,
        oppShieldsRemaining = execRes.oppShieldsRemaining
    )
}

internal fun OverlayService.Companion.calculateAggregateWAEStatic(qualities: List<BattleQualityMetadata?>): AggregateWAEResult {
    var weightedWaeSum = 0.0
    var weightedLuckSum = 0.0
    var totalWeight = 0.0
    var rankedCount = 0

    for (q in qualities) {
        if (q == null || q.weight <= 0.0) continue
        weightedWaeSum += q.weight * q.deltaQ
        weightedLuckSum += q.weight * q.pPre
        totalWeight += q.weight
        rankedCount++
    }

    if (totalWeight <= 0.0 || rankedCount == 0) {
        return AggregateWAEResult(
            waePct = 0.0,
            formatted = "—%",
            isPositive = true,
            luckPct = 50.0,
            luckFormatted = "—%",
            rankedCount = 0,
            totalWeight = 0.0
        )
    }

    val rawWaePct = (weightedWaeSum / totalWeight) * 100.0
    val roundedWae = (rawWaePct * 10.0).roundToInt() / 10.0
    val isPositive = roundedWae >= 0.0
    val sign = if (roundedWae >= 0.0) "+" else "-"
    val formatted = String.format(java.util.Locale.US, "%s%.1f%%", sign, kotlin.math.abs(roundedWae))

    val rawLuckPct = (weightedLuckSum / totalWeight) * 100.0
    val roundedLuck = (rawLuckPct * 10.0).roundToInt() / 10.0
    val luckFormatted = String.format(java.util.Locale.US, "%.1f%%", roundedLuck)

    return AggregateWAEResult(
        waePct = roundedWae,
        formatted = formatted,
        isPositive = isPositive,
        luckPct = roundedLuck,
        luckFormatted = luckFormatted,
        rankedCount = rankedCount,
        totalWeight = totalWeight
    )
}

internal fun OverlayService.Companion.isLimitedCupFormatStatic(league: String): Boolean {
    val u = league.trim().uppercase()
    if (u == "GREAT LEAGUE" || u == "ULTRA LEAGUE" || u == "MASTER LEAGUE") return false
    if (u == "GREAT LEAGUE (1500)" || u == "ULTRA LEAGUE (2500)" || u == "MASTER LEAGUE (10000)") return false
    if (u.startsWith("BATTLE FRONTIER")) return false
    return true
}

internal fun OverlayService.Companion.getSameCpStandardLeagueKeyStatic(league: String): String {
    val cpCap = getLeagueCpCapStatic(league)
    return when {
        cpCap <= 1500 -> "GREAT LEAGUE"
        cpCap == 2500 -> "ULTRA LEAGUE"
        else -> "MASTER LEAGUE"
    }
}

internal fun OverlayService.Companion.loadCurrentSeasonStartMsStatic(prefs: SharedPreferences?): Long {
    val defaultStartMs = 1772571600000L // GBL Season 26 start fallback
    if (prefs == null) return defaultStartMs
    val raw = prefs.getString(PREFS_KEY_GBL_SEASONS_JSON, null) ?: return defaultStartMs
    return try {
        val arr = JsonParser.parseString(raw).asJsonArray
        val nowMs = System.currentTimeMillis()
        var latestStart = defaultStartMs
        for (el in arr) {
            if (!el.isJsonObject) continue
            val sMs = el.asJsonObject.get("startMs")?.takeIf { !it.isJsonNull }?.asLong ?: continue
            if (sMs in 1000000000000L..nowMs && sMs >= latestStart) {
                latestStart = sMs
            }
        }
        latestStart
    } catch (_: Exception) {
        defaultStartMs
    }
}

internal fun OverlayService.Companion.loadSeasonLogsForLeagueStatic(
    prefs: SharedPreferences?,
    gson: Gson,
    league: String,
    isShow6: Boolean = false,
    empiricalLimit: Int? = null
): List<Pair<Long, List<String>>> {
    if (prefs == null) return emptyList()
    val prefKey = if (isShow6) PREFS_KEY_SHOW6_BATTLE_LOGS else PREFS_KEY_BATTLE_LOGS
    val rawJson = prefs.getString(prefKey, "[]") ?: "[]"
    val records: List<SyncBattleLogRecord> = try {
        gson.fromJson(rawJson, object : TypeToken<List<SyncBattleLogRecord>>() {}.type) ?: emptyList()
    } catch (_: Exception) {
        emptyList()
    }
    if (records.isEmpty()) return emptyList()
    val targetNorm = normalizeLeagueKeyStatic(league)
    val targetRemapped = remapLegacyLeagueForModeStatic(league, isShow6)
    val seasonStartMs = loadCurrentSeasonStartMsStatic(prefs)

    val matching = records.filter { rec ->
        val recNorm = normalizeLeagueKeyStatic(rec.league)
        val recRemap = remapLegacyLeagueForModeStatic(rec.league, isShow6)
        val leagueMatches = rec.league.equals(league, ignoreCase = true) ||
            recNorm.equals(targetNorm, ignoreCase = true) ||
            recRemap.equals(targetRemapped, ignoreCase = true)
        val validOpps = rec.opponents.any { it.isNotBlank() && !it.equals("Waiting...", ignoreCase = true) }
        val inSeason = if (empiricalLimit != null) true else rec.timestampMs >= seasonStartMs
        leagueMatches && validOpps && inSeason
    }.sortedByDescending { it.timestampMs }

    val sliced = if (empiricalLimit != null && empiricalLimit > 0) matching.take(empiricalLimit) else matching
    return sliced.map { it.timestampMs to it.opponents }
}

internal fun OverlayService.Companion.loadSameCpStandardSeasonLogsForLimitedCupStatic(
    prefs: SharedPreferences?,
    gson: Gson,
    league: String,
    isShow6: Boolean = false
): List<Pair<Long, List<String>>> {
    if (prefs == null || isShow6 || !isLimitedCupFormatStatic(league)) return emptyList()
    val stdLeague = getSameCpStandardLeagueKeyStatic(league)
    val rawStdLogs = loadSeasonLogsForLeagueStatic(prefs, gson, stdLeague, isShow6 = false, empiricalLimit = null)
    CACHED_GBL_STD_SEASON_LOGS[stdLeague] = rawStdLogs
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

internal fun OverlayService.Companion.computePositionWeightedBrStatic(
    slot: TeamMember,
    oppName: String,
    league: String,
    role: String // "LEAD" | "SWAP" | "CLOSER"
): Double {
    fun br(sU: Int, sO: Int): Double = calculateMatchupRatingStatic(
        myName = slot.name,
        oppName = oppName,
        userShields = sU,
        oppShields = sO,
        league = league,
        myFastMove = slot.fastMove,
        myCharged1 = slot.chargedMove1,
        myCharged2 = slot.chargedMove2,
        myCp = slot.cp,
        myIvs = slot.ivs
    ).toDouble()

    return when (role.uppercase()) {
        "LEAD" -> 0.45 * br(1, 1) + 0.35 * br(2, 2) + 0.10 * br(0, 0) + 0.05 * br(1, 2) + 0.05 * br(2, 1)
        "SWAP" -> 0.40 * br(1, 1) + 0.20 * br(1, 0) + 0.20 * br(0, 1) + 0.10 * br(2, 1) + 0.10 * br(0, 0)
        else -> 0.50 * br(0, 0) + 0.20 * br(1, 0) + 0.15 * br(0, 1) + 0.15 * br(1, 1)
    }
}

internal fun OverlayService.Companion.computeBlendedSeasonMetaStatic(
    league: String,
    seasonLogs: List<Pair<Long, List<String>>>,
    isShow6: Boolean = false,
    customLogWeightPct: Int? = null,
    customDecayFactor: Double? = null,
    sameCpStandardLogs: List<Pair<Long, List<String>>> = emptyList(),
    customLimitedStdBlendPct: Int? = null,
    customLimitedStdDecay: Double? = null,
    customSheetWeightPct: Int? = null,
    empiricalOnlyLimit: Int? = null
): BlendedSeasonMetaDistribution {
    val normKey = normalizeLeagueKeyStatic(league)
    val rankedPool = TOP_30_RANKED_POOL_CACHE[normKey] ?: run {
        val computed = getTop100MetaCandidatesForLeagueStatic(normKey, 120)
            .map { it.name }
            .ifEmpty { getTopMetaPoolForLeagueStatic(league) }
        if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
            TOP_30_RANKED_POOL_CACHE[normKey] = computed
        }
        computed
    }

    val pvpokeRankMap = LinkedHashMap<String, Int>()
    rankedPool.forEachIndexed { idx, name ->
        pvpokeRankMap.putIfAbsent(name, idx + 1)
    }
    val eligibleLowerMap = rankedPool.associateBy { it.lowercase() }
    val eligibleBaseMap = rankedPool.associateBy { FormResolver.extractBaseSpecies(it).lowercase() }

    val rawMeta = LinkedHashMap<String, Double>()
    var rawMetaSum = 0.0
    rankedPool.forEachIndexed { idx, name ->
        val w = kotlin.math.exp(-0.045 * idx.toDouble())
        rawMeta[name] = (rawMeta[name] ?: 0.0) + w
        rawMetaSum += w
    }
    val pMeta = rawMeta.mapValues { (_, v) -> if (rawMetaSum > 0.0) v / rawMetaSum else 0.0 }

    // Sort current-season logs newest-first
    val sortedAllLogs = seasonLogs
        .filter { it.second.any { opp -> opp.isNotBlank() && !opp.equals("Waiting...", ignoreCase = true) } }
        .sortedByDescending { it.first }
    val sortedLogs = if (empiricalOnlyLimit != null && empiricalOnlyLimit > 0) {
        sortedAllLogs.take(empiricalOnlyLimit)
    } else {
        sortedAllLogs
    }

    val nMatches = sortedLogs.size
    val lambda = (customDecayFactor ?: (if (isShow6) activeShow6MetaDecayFactor.toDouble() else activeGblMetaDecayFactor.toDouble()))
        .coerceIn(0.0, 0.25)

    val rawHistLead = LinkedHashMap<String, Double>()
    var rawHistLeadSum = 0.0
    val rawHistBack = LinkedHashMap<String, Double>()
    var rawHistBackSum = 0.0
    val rawHistField = LinkedHashMap<String, Double>()
    var rawHistFieldSum = 0.0
    val rawSeenCounts = LinkedHashMap<String, Int>()

    sortedLogs.forEachIndexed { idx, (_, opps) ->
        val recencyWeight = if (empiricalOnlyLimit != null) 1.0 else kotlin.math.exp(-lambda * idx.toDouble())
        val cleanedOpps = opps.map { it.trim() }.filter { it.isNotEmpty() && !it.equals("Waiting...", ignoreCase = true) }
        cleanedOpps.firstOrNull()?.let { leadName ->
            val canonical = eligibleLowerMap[leadName.lowercase()] ?: leadName
            rawHistLead[canonical] = (rawHistLead[canonical] ?: 0.0) + recencyWeight
            rawHistLeadSum += recencyWeight
        }
        cleanedOpps.drop(1).forEach { backName ->
            val canonical = eligibleLowerMap[backName.lowercase()] ?: backName
            rawHistBack[canonical] = (rawHistBack[canonical] ?: 0.0) + recencyWeight
            rawHistBackSum += recencyWeight
        }
        cleanedOpps.forEach { oppRaw ->
            val canonical = eligibleLowerMap[oppRaw.lowercase()] ?: oppRaw
            rawHistField[canonical] = (rawHistField[canonical] ?: 0.0) + recencyWeight
            rawHistFieldSum += recencyWeight
            rawSeenCounts[canonical] = (rawSeenCounts[canonical] ?: 0) + 1
        }
    }

    // GBL Blind 3 Limited Cup Same-CP Standard League Blending (eligible species only, starts at 50% default and fades out as cup logs grow)
    val isLimitedCup = !isShow6 && isLimitedCupFormatStatic(league)
    val resolvedStdLogs = if (isLimitedCup) {
        sameCpStandardLogs.ifEmpty { resolveCachedSameCpStandardLogsForCupStatic(league) }
    } else emptyList()
    val sortedStdLogs = if (empiricalOnlyLimit == null && isLimitedCup && resolvedStdLogs.isNotEmpty()) {
        resolvedStdLogs
            .filter { it.second.any { opp -> opp.isNotBlank() && !opp.equals("Waiting...", ignoreCase = true) } }
            .sortedByDescending { it.first }
    } else emptyList()

    val rawStdLead = LinkedHashMap<String, Double>()
    var rawStdLeadSum = 0.0
    val rawStdBack = LinkedHashMap<String, Double>()
    var rawStdBackSum = 0.0
    val rawStdField = LinkedHashMap<String, Double>()
    var rawStdFieldSum = 0.0

    sortedStdLogs.forEachIndexed { idx, (_, opps) ->
        val recW = kotlin.math.exp(-lambda * idx.toDouble())
        val cleaned = opps.mapNotNull { raw ->
            val tr = raw.trim()
            if (tr.isEmpty() || tr.equals("Waiting...", ignoreCase = true)) null
            else eligibleLowerMap[tr.lowercase()] ?: eligibleBaseMap[FormResolver.extractBaseSpecies(tr).lowercase()]
        }
        cleaned.firstOrNull()?.let { lName ->
            rawStdLead[lName] = (rawStdLead[lName] ?: 0.0) + recW
            rawStdLeadSum += recW
        }
        cleaned.drop(1).forEach { bName ->
            rawStdBack[bName] = (rawStdBack[bName] ?: 0.0) + recW
            rawStdBackSum += recW
        }
        cleaned.forEach { fName ->
            rawStdField[fName] = (rawStdField[fName] ?: 0.0) + recW
            rawStdFieldSum += recW
        }
    }

    // Show 6 Battle Frontier Google Spreadsheet usage distribution
    val rawSheetField = LinkedHashMap<String, Double>()
    var rawSheetSum = 0.0
    if (isShow6 && empiricalOnlyLimit == null) {
        for (sp in rankedPool) {
            val uPct = getShow6UsagePctStatic(normKey, sp)
            if (uPct > 0.0) {
                rawSheetField[sp] = uPct
                rawSheetSum += uPct
            }
        }
    }

    val maxLogW = ((customLogWeightPct ?: if (isShow6) activeShow6MetaLogWeightPct else activeGblMetaLogWeightPct).coerceIn(0, 100)) / 100.0
    val stdBlendMaxW = ((customLimitedStdBlendPct ?: activeLimitedStdBlendPctGbl).coerceIn(0, 100)) / 100.0
    val stdDecayBeta = (customLimitedStdDecay ?: activeLimitedStdDecayGbl.toDouble()).coerceIn(0.01, 0.30)
    val sheetPrefW = ((customSheetWeightPct ?: activeShow6UsageWeightPct).coerceIn(0, 100)) / 100.0

    val wHist: Double
    val wStdCup: Double
    val wSheet: Double
    val wMeta: Double

    if (empiricalOnlyLimit != null) {
        wHist = if (nMatches > 0) 1.0 else 0.0
        wStdCup = 0.0
        wSheet = 0.0
        wMeta = if (nMatches > 0) 0.0 else 1.0
    } else {
        val rawWHist = if (nMatches > 0) maxLogW * min(1.0, nMatches.toDouble() / 50.0) else 0.0
        val remAfterHist = (1.0 - rawWHist).coerceAtLeast(0.0)
        val rawWStd = if (isLimitedCup && rawStdFieldSum > 0.0) {
            min(remAfterHist, stdBlendMaxW * kotlin.math.exp(-stdDecayBeta * nMatches.toDouble()))
        } else 0.0
        val remAfterStd = (remAfterHist - rawWStd).coerceAtLeast(0.0)
        val rawWSheet = if (isShow6 && rawSheetSum > 0.0) {
            remAfterStd * sheetPrefW
        } else 0.0
        val rawWMeta = (remAfterStd - rawWSheet).coerceAtLeast(0.0)
        val sumW = (rawWHist + rawWStd + rawWSheet + rawWMeta).takeIf { it > 0.0 } ?: 1.0
        wHist = rawWHist / sumW
        wStdCup = rawWStd / sumW
        wSheet = rawWSheet / sumW
        wMeta = rawWMeta / sumW
    }

    val allSpecies = if (empiricalOnlyLimit != null && nMatches > 0) {
        (rawHistField.keys + rawHistLead.keys + rawHistBack.keys).distinct()
    } else {
        (pMeta.keys + rawHistLead.keys + rawHistField.keys + rawStdField.keys + rawSheetField.keys).distinct()
    }

    val leadWeights = LinkedHashMap<String, Double>()
    val fieldWeights = LinkedHashMap<String, Double>()
    val backWeights = LinkedHashMap<String, Double>()

    for (sp in allSpecies) {
        val mProb = pMeta[sp] ?: 0.0
        val sProb = if (rawSheetSum > 0.0) (rawSheetField[sp] ?: 0.0) / rawSheetSum else mProb
        val lHistProb = if (rawHistLeadSum > 0.0) (rawHistLead[sp] ?: 0.0) / rawHistLeadSum else mProb
        val fHistProb = if (rawHistFieldSum > 0.0) (rawHistField[sp] ?: 0.0) / rawHistFieldSum else mProb
        val bHistProb = if (rawHistBackSum > 0.0) (rawHistBack[sp] ?: 0.0) / rawHistBackSum else fHistProb

        val lStdProb = if (rawStdLeadSum > 0.0) (rawStdLead[sp] ?: 0.0) / rawStdLeadSum else mProb
        val fStdProb = if (rawStdFieldSum > 0.0) (rawStdField[sp] ?: 0.0) / rawStdFieldSum else mProb
        val bStdProb = if (rawStdBackSum > 0.0) (rawStdBack[sp] ?: 0.0) / rawStdBackSum else fStdProb

        leadWeights[sp] = wHist * lHistProb + wStdCup * lStdProb + wSheet * sProb + wMeta * mProb
        fieldWeights[sp] = wHist * fHistProb + wStdCup * fStdProb + wSheet * sProb + wMeta * mProb
        backWeights[sp] = wHist * bHistProb + wStdCup * bStdProb + wSheet * sProb + wMeta * mProb
    }

    val lTotal = leadWeights.values.sum().takeIf { it > 0.0 } ?: 1.0
    val fTotal = fieldWeights.values.sum().takeIf { it > 0.0 } ?: 1.0
    val bTotal = backWeights.values.sum().takeIf { it > 0.0 } ?: 1.0

    return BlendedSeasonMetaDistribution(
        leadWeights = leadWeights.mapValues { it.value / lTotal },
        fieldWeights = fieldWeights.mapValues { it.value / fTotal },
        backWeights = backWeights.mapValues { it.value / bTotal },
        seasonMatchCount = nMatches,
        sameCpStdMatchCount = sortedStdLogs.size,
        histWeightPct = (wHist * 100.0).roundToInt(),
        stdCupWeightPct = (wStdCup * 100.0).roundToInt(),
        sheetWeightPct = (wSheet * 100.0).roundToInt(),
        metaWeightPct = (wMeta * 100.0).roundToInt(),
        rawSeenCounts = rawSeenCounts,
        pvpokeRankMap = pvpokeRankMap
    )
}

internal fun OverlayService.Companion.buildTopMetaPokemonEntriesStatic(
    dist: BlendedSeasonMetaDistribution,
    limit: Int = 35
): List<BlendedMetaPokemonEntry> {
    return dist.fieldWeights.entries
        .filter { it.value > 0.0005 }
        .sortedByDescending { it.value }
        .take(limit)
        .mapIndexed { idx, (name, fProb) ->
            val lProb = dist.leadWeights[name] ?: 0.0
            val bProb = dist.backWeights[name] ?: fProb
            BlendedMetaPokemonEntry(
                rank = idx + 1,
                name = name,
                blendedSharePct = ((fProb * 1000.0).roundToInt() / 10.0),
                leadSharePct = ((lProb * 1000.0).roundToInt() / 10.0),
                backSharePct = ((bProb * 1000.0).roundToInt() / 10.0),
                logSeenCount = dist.rawSeenCounts[name] ?: 0,
                pvpokeRank = dist.pvpokeRankMap[name]
            )
        }
}

/**
 * v6.00: In-App Personalized & Blended Top Meta Cores Engine.
 * Combines:
 * 1. Recency-weighted empirical pair co-occurrence from current-season battle logs,
 * 2. Same-CP Standard League eligible pair co-occurrence (for Limited Cups),
 * 3. In-app PvPoke defensive type-coverage & role synergy pairs from the Top 36 league candidates, and
 * 4. Imported Battle Frontier Google Spreadsheet Core usage (when in Show 6 mode).
 */
internal fun OverlayService.Companion.computeBlendedSeasonMetaCoresStatic(
    league: String,
    seasonLogs: List<Pair<Long, List<String>>>,
    isShow6: Boolean = false,
    customLogWeightPct: Int? = null,
    customDecayFactor: Double? = null,
    sameCpStandardLogs: List<Pair<Long, List<String>>> = emptyList(),
    customLimitedStdBlendPct: Int? = null,
    customLimitedStdDecay: Double? = null,
    customSheetWeightPct: Int? = null,
    empiricalOnlyLimit: Int? = null,
    maxCores: Int = 20
): List<BlendedMetaCoreEntry> {
    val dist = computeBlendedSeasonMetaStatic(
        league = league,
        seasonLogs = seasonLogs,
        isShow6 = isShow6,
        customLogWeightPct = customLogWeightPct,
        customDecayFactor = customDecayFactor,
        sameCpStandardLogs = sameCpStandardLogs,
        customLimitedStdBlendPct = customLimitedStdBlendPct,
        customLimitedStdDecay = customLimitedStdDecay,
        customSheetWeightPct = customSheetWeightPct,
        empiricalOnlyLimit = empiricalOnlyLimit
    )
    val normKey = normalizeLeagueKeyStatic(league)
    val lambda = (customDecayFactor ?: (if (isShow6) activeShow6MetaDecayFactor.toDouble() else activeGblMetaDecayFactor.toDouble()))
        .coerceIn(0.0, 0.25)

    fun canonicalPairKey(a: String, b: String): Pair<String, String> {
        return if (a.compareTo(b, ignoreCase = true) <= 0) a to b else b to a
    }

    val topSpecies = dist.fieldWeights.entries.sortedByDescending { it.value }.map { it.key }.take(40)
    val canonicalByBase = LinkedHashMap<String, String>()
    for (sp in topSpecies) {
        canonicalByBase.putIfAbsent(FormResolver.extractBaseSpecies(sp).lowercase(), sp)
    }

    fun resolveCanonicalSpecies(raw: String): String {
        val tr = raw.trim()
        val b = FormResolver.extractBaseSpecies(tr).lowercase()
        return canonicalByBase[b] ?: tr
    }

    // 1. Empirical pair weights & raw counts from season logs
    val sortedAll = seasonLogs
        .filter { it.second.size >= 2 }
        .sortedByDescending { it.first }
    val sortedLogs = if (empiricalOnlyLimit != null && empiricalOnlyLimit > 0) sortedAll.take(empiricalOnlyLimit) else sortedAll

    val histPairWeights = LinkedHashMap<Pair<String, String>, Double>()
    val histPairCounts = LinkedHashMap<Pair<String, String>, Int>()
    var histPairSum = 0.0

    sortedLogs.forEachIndexed { idx, (_, opps) ->
        val recW = if (empiricalOnlyLimit != null) 1.0 else kotlin.math.exp(-lambda * idx.toDouble())
        val distinctOpps = opps.map { resolveCanonicalSpecies(it) }
            .filter { it.isNotBlank() && !it.equals("Waiting...", ignoreCase = true) }
            .distinctBy { FormResolver.extractBaseSpecies(it).lowercase() }
        for (i in 0 until distinctOpps.size) {
            for (j in (i + 1) until distinctOpps.size) {
                val pk = canonicalPairKey(distinctOpps[i], distinctOpps[j])
                histPairWeights[pk] = (histPairWeights[pk] ?: 0.0) + recW
                histPairCounts[pk] = (histPairCounts[pk] ?: 0) + 1
                histPairSum += recW
            }
        }
    }

    if (empiricalOnlyLimit != null && histPairCounts.isNotEmpty()) {
        val totalMatches = max(1, sortedLogs.size)
        return histPairWeights.entries
            .sortedByDescending { it.value }
            .take(maxCores)
            .mapIndexed { idx, (pair, _) ->
                val cnt = histPairCounts[pair] ?: 1
                val pct = ((cnt * 1000.0) / totalMatches.toDouble()).roundToInt() / 10.0
                BlendedMetaCoreEntry(
                    rank = idx + 1,
                    monA = pair.first,
                    monB = pair.second,
                    blendedPairPct = pct,
                    logPairCount = cnt,
                    synergyScore = 82,
                    roleArchetype = "Logged Core"
                )
            }
    }

    // 2. Same-CP Standard League eligible pair weights for GBL Blind 3 Limited Cups
    val stdPairWeights = LinkedHashMap<Pair<String, String>, Double>()
    var stdPairSum = 0.0
    val resolvedCoreStdLogs = if (!isShow6 && isLimitedCupFormatStatic(league)) {
        sameCpStandardLogs.ifEmpty { resolveCachedSameCpStandardLogsForCupStatic(league) }
    } else emptyList()
    if (empiricalOnlyLimit == null && !isShow6 && isLimitedCupFormatStatic(league) && resolvedCoreStdLogs.isNotEmpty()) {
        resolvedCoreStdLogs.sortedByDescending { it.first }.forEachIndexed { idx, (_, opps) ->
            val recW = kotlin.math.exp(-lambda * idx.toDouble())
            val distinctOpps = opps.map { resolveCanonicalSpecies(it) }
                .filter { it.isNotBlank() && !it.equals("Waiting...", ignoreCase = true) }
                .distinctBy { FormResolver.extractBaseSpecies(it).lowercase() }
            for (i in 0 until distinctOpps.size) {
                for (j in (i + 1) until distinctOpps.size) {
                    val pk = canonicalPairKey(distinctOpps[i], distinctOpps[j])
                    stdPairWeights[pk] = (stdPairWeights[pk] ?: 0.0) + recW
                    stdPairSum += recW
                }
            }
        }
    }

    // 3. Show 6 Battle Frontier Spreadsheet Core weights
    val sheetPairWeights = LinkedHashMap<Pair<String, String>, Double>()
    var sheetPairSum = 0.0
    if (isShow6 && empiricalOnlyLimit == null) {
        val bfCores = BATTLE_FRONTIER_CORES_MAP[normKey] ?: BATTLE_FRONTIER_CORES_MAP["GREAT LEAGUE"].orEmpty()
        for (c in bfCores) {
            val pk = canonicalPairKey(resolveCanonicalSpecies(c.monA), resolveCanonicalSpecies(c.monB))
            if (!FormResolver.extractBaseSpecies(pk.first).equals(FormResolver.extractBaseSpecies(pk.second), ignoreCase = true)) {
                sheetPairWeights[pk] = (sheetPairWeights[pk] ?: 0.0) + c.usagePct
                sheetPairSum += c.usagePct
            }
        }
    }

    // 4. In-App Synthetic Defensive & Role Synergy Core Priors across top 26 field species
    val synPairWeights = LinkedHashMap<Pair<String, String>, Double>()
    val synPairSynergyScore = LinkedHashMap<Pair<String, String>, Int>()
    var synPairSum = 0.0
    val topPoolForCores = topSpecies.take(26)
    val metaTypesMap = HashMap<String, List<String>>()
    val weaksMap = HashMap<String, Set<String>>()
    val resistsMap = HashMap<String, Set<String>>()
    for (sp in topPoolForCores) {
        val m = resolveRecommendedMovesForSpecies(sp, normKey)
        val tList = m?.types ?: listOf("normal")
        metaTypesMap[sp] = tList
        val wks = ALL_18_TYPES.filter { atkT -> getTypeEffectivenessStatic(atkT, tList) >= 1.4 }.toSet()
        val rss = ALL_18_TYPES.filter { atkT -> getTypeEffectivenessStatic(atkT, tList) <= 0.7 }.toSet()
        weaksMap[sp] = wks
        resistsMap[sp] = rss
    }

    for (i in 0 until topPoolForCores.size) {
        for (j in (i + 1) until topPoolForCores.size) {
            val a = topPoolForCores[i]
            val b = topPoolForCores[j]
            if (FormResolver.extractBaseSpecies(a).equals(FormResolver.extractBaseSpecies(b), ignoreCase = true)) continue
            val wA = weaksMap[a] ?: emptySet()
            val rA = resistsMap[a] ?: emptySet()
            val wB = weaksMap[b] ?: emptySet()
            val rB = resistsMap[b] ?: emptySet()
            val sharedWeak = wA.intersect(wB).size
            if (sharedWeak >= 2) continue
            val aCoversB = wB.count { it in rA }
            val bCoversA = wA.count { it in rB }
            val coverageFactor = 1.0 + 0.32 * (aCoversB + bCoversA) - 0.38 * sharedWeak
            if (coverageFactor <= 0.65) continue
            val pA = dist.fieldWeights[a] ?: 0.01
            val pB = dist.fieldWeights[b] ?: 0.01
            val synW = kotlin.math.sqrt(pA * pB) * coverageFactor
            val pk = canonicalPairKey(a, b)
            synPairWeights[pk] = synW
            synPairSum += synW
            val synScore = (68 + (aCoversB + bCoversA) * 7 - sharedWeak * 9).coerceIn(50, 99)
            synPairSynergyScore[pk] = synScore
        }
    }

    val wHist = dist.histWeightPct / 100.0
    val wStd = dist.stdCupWeightPct / 100.0
    val wSheet = dist.sheetWeightPct / 100.0
    val wMeta = dist.metaWeightPct / 100.0

    val allPairs = (histPairWeights.keys + stdPairWeights.keys + sheetPairWeights.keys + synPairWeights.keys).distinct()
    val combined = LinkedHashMap<Pair<String, String>, Double>()
    for (pk in allPairs) {
        val hP = if (histPairSum > 0.0) (histPairWeights[pk] ?: 0.0) / histPairSum else 0.0
        val stP = if (stdPairSum > 0.0) (stdPairWeights[pk] ?: 0.0) / stdPairSum else 0.0
        val shP = if (sheetPairSum > 0.0) (sheetPairWeights[pk] ?: 0.0) / sheetPairSum else 0.0
        val syP = if (synPairSum > 0.0) (synPairWeights[pk] ?: 0.0) / synPairSum else 0.0
        val score = wHist * hP + wStd * stP + wSheet * shP + wMeta * syP
        if (score > 0.0) {
            combined[pk] = score
        }
    }

    val totalScore = combined.values.sum().takeIf { it > 0.0 } ?: 1.0
    return combined.entries
        .sortedByDescending { it.value }
        .take(maxCores)
        .mapIndexed { idx, (pair, rawVal) ->
            val normPct = ((rawVal / totalScore) * 240.0).coerceIn(0.8, 68.0)
            val roundedPct = (normPct * 10.0).roundToInt() / 10.0
            val cnt = histPairCounts[pair] ?: 0
            val synScore = synPairSynergyScore[pair] ?: if (cnt > 0) min(96, 78 + cnt * 3) else 76
            val archLabel = when {
                cnt >= 2 -> "Personal Core (${cnt}x)"
                isShow6 && sheetPairWeights.containsKey(pair) -> "Frontier Core"
                synScore >= 85 -> "Synergy Core"
                else -> "Meta Core"
            }
            BlendedMetaCoreEntry(
                rank = idx + 1,
                monA = pair.first,
                monB = pair.second,
                blendedPairPct = roundedPct,
                logPairCount = cnt,
                synergyScore = synScore,
                roleArchetype = archLabel
            )
        }
}

/**
 * v6.00 Pillar 1 & Pillar 2: Live Opponent Backline Predictor & Swap Hard-Counter Risk Evaluator.
 */
internal fun OverlayService.Companion.predictOpponentBacklineStatic(
    league: String,
    revealedOpponents: List<String>,
    myTeamSlots: List<TeamMember>,
    myActiveSlotIdx: Int,
    playerFaintedSlots: BooleanArray,
    isShow6: Boolean,
    knownShow6UnrevealedPool: List<String>,
    seasonLogs: List<Pair<Long, List<String>>>,
    sameCpStandardLogs: List<Pair<Long, List<String>>>
): BacklinePredictionResult {
    val cleanRevealed = revealedOpponents
        .map { it.trim() }
        .filter { it.isNotEmpty() && !it.equals("Waiting...", ignoreCase = true) }
        .distinctBy { FormResolver.extractBaseSpecies(it).lowercase() }

    if (cleanRevealed.isEmpty() || cleanRevealed.size >= 3) {
        return BacklinePredictionResult(
            candidates = emptyList(),
            swapPunishRiskPct = 0,
            swapPunishThreatCode = "NONE",
            hudLine2Text = ""
        )
    }

    val dist = computeBlendedSeasonMetaStatic(
        league = league,
        seasonLogs = seasonLogs,
        isShow6 = isShow6,
        sameCpStandardLogs = sameCpStandardLogs
    )
    val cores = computeBlendedSeasonMetaCoresStatic(
        league = league,
        seasonLogs = seasonLogs,
        isShow6 = isShow6,
        sameCpStandardLogs = sameCpStandardLogs,
        maxCores = 30
    )

    val revealedBases = cleanRevealed.map { FormResolver.extractBaseSpecies(it).lowercase() }.toSet()
    val candidatePool = if (isShow6 && knownShow6UnrevealedPool.isNotEmpty()) {
        knownShow6UnrevealedPool.filter { FormResolver.extractBaseSpecies(it).lowercase() !in revealedBases }
    } else {
        dist.backWeights.entries
            .sortedByDescending { it.value }
            .map { it.key }
            .filter { FormResolver.extractBaseSpecies(it).lowercase() !in revealedBases }
            .take(24)
    }

    if (candidatePool.isEmpty()) {
        return BacklinePredictionResult(
            candidates = emptyList(),
            swapPunishRiskPct = 0,
            swapPunishThreatCode = "NONE",
            hudLine2Text = ""
        )
    }

    val normLeague = normalizeLeagueKeyStatic(league)
    // Compute weakness types of revealed opponents so we can boost backline candidates that cover them
    val revealedWeaknesses = HashSet<String>()
    for (rev in cleanRevealed) {
        val rMeta = resolveRecommendedMovesForSpecies(rev, normLeague)
        val rTypes = rMeta?.types ?: listOf("normal")
        for (t in ALL_18_TYPES) {
            if (getTypeEffectivenessStatic(t, rTypes) >= 1.4) {
                revealedWeaknesses.add(t)
            }
        }
    }

    // Identify user's primary bench swap slot
    val aliveBenchIdx = (0..2).filter { !playerFaintedSlots.getOrElse(it) { false } && it != myActiveSlotIdx }
    val primarySwapSlot = aliveBenchIdx.firstOrNull()?.let { myTeamSlots.getOrNull(it) } ?: myTeamSlots.getOrNull(1)

    val rawScores = LinkedHashMap<String, Double>()
    val hardCountersSwapMap = HashMap<String, Boolean>()

    for (cand in candidatePool) {
        val candBase = FormResolver.extractBaseSpecies(cand).lowercase()
        var corePartnerBoost = 0.0
        for (rev in cleanRevealed) {
            val revBase = FormResolver.extractBaseSpecies(rev).lowercase()
            val matchedCore = cores.firstOrNull { c ->
                val aB = FormResolver.extractBaseSpecies(c.monA).lowercase()
                val bB = FormResolver.extractBaseSpecies(c.monB).lowercase()
                (aB == candBase && bB == revBase) || (aB == revBase && bB == candBase)
            }
            if (matchedCore != null) {
                corePartnerBoost += matchedCore.blendedPairPct * 0.035 + matchedCore.logPairCount * 0.18
            }
        }

        val candMeta = resolveRecommendedMovesForSpecies(cand, normLeague)
        val candTypes = candMeta?.types ?: listOf("normal")
        val coveredCount = revealedWeaknesses.count { wk -> getTypeEffectivenessStatic(wk, candTypes) <= 0.7 }
        val coverageBoost = 1.0 + coveredCount * 0.22
        val fieldPrior = (dist.backWeights[cand] ?: dist.fieldWeights[cand] ?: 0.02).coerceAtLeast(0.008)

        val score = (0.55 * corePartnerBoost + 0.45 * (fieldPrior * 12.0)) * coverageBoost
        rawScores[cand] = score.coerceAtLeast(0.01)

        if (primarySwapSlot != null) {
            val swapBrVsCand = getOverlayRealtimeMatchupRatingStatic(
                myName = primarySwapSlot.name,
                oppName = cand,
                userShields = 1,
                oppShields = 1,
                league = normLeague,
                myFastMove = primarySwapSlot.fastMove,
                myCharged1 = primarySwapSlot.chargedMove1,
                myCharged2 = primarySwapSlot.chargedMove2,
                myCp = primarySwapSlot.cp,
                myIvs = primarySwapSlot.ivs
            )
            hardCountersSwapMap[cand] = swapBrVsCand <= 375
        } else {
            hardCountersSwapMap[cand] = false
        }
    }

    val totalRaw = rawScores.values.sum().takeIf { it > 0.0 } ?: 1.0
    val unrevealedSlotsCount = (3 - cleanRevealed.size).coerceIn(1, 2)
    val sortedCands = rawScores.entries.sortedByDescending { it.value }

    var swapPunishProbSum = 0.0
    var topPunishThreatCode = ""
    for ((cand, sc) in sortedCands.take(6)) {
        val p = sc / totalRaw
        if (hardCountersSwapMap[cand] == true) {
            swapPunishProbSum += p
            if (topPunishThreatCode.isEmpty()) {
                topPunishThreatCode = abbrPokeCompactStatic(cand)
            }
        }
    }
    val swapPunishRiskPct = (swapPunishProbSum * 100.0 * (if (unrevealedSlotsCount == 2) 1.35 else 1.0))
        .roundToInt()
        .coerceIn(5, 95)

    val topPredictions = sortedCands.take(3).mapIndexed { i, (cand, sc) ->
        val rawShare = (sc / totalRaw)
        val scaledPct = (rawShare * (if (unrevealedSlotsCount == 2) 155.0 else 115.0))
            .roundToInt()
            .coerceIn(12, 89)
        BacklineCandidatePrediction(
            name = cand,
            code = abbrPokeCompactStatic(cand),
            likelihoodPct = scaledPct,
            hardCountersMySwap = hardCountersSwapMap[cand] == true,
            bestRoleVsMe = if (i == 0) "Core" else "Cover"
        )
    }

    val top2Str = topPredictions.take(2).joinToString(" · ") { "${it.code} ${it.likelihoodPct}%" }
    val riskTag = when {
        swapPunishRiskPct >= 55 -> "Rsk:HI"
        swapPunishRiskPct >= 35 -> "Rsk:MD"
        else -> "Rsk:LO"
    }
    val prefix = if (cleanRevealed.size == 1) "🔮 Back:" else "🔮 3rd:"
    val hudLine2 = "$prefix $top2Str | $riskTag"

    return BacklinePredictionResult(
        candidates = topPredictions,
        swapPunishRiskPct = swapPunishRiskPct,
        swapPunishThreatCode = topPunishThreatCode.ifEmpty { topPredictions.firstOrNull()?.code ?: "BACK" },
        hudLine2Text = hudLine2
    )
}

internal fun OverlayService.Companion.abbrPokeCompactStatic(name: String, isShadow: Boolean = false): String {
    if (name.isBlank() || name.equals("Waiting...", ignoreCase = true)) return "OPP"
    val sh = isShadow || name.startsWith("Shadow ", ignoreCase = true) || name.contains("(Shadow)", ignoreCase = true)
    val clean = name
        .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
        .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
        .trim()
    val lower = clean.lowercase()
    val mapped = when {
        lower.contains("palkia") && lower.contains("origin") -> "PAL-O"
        lower.contains("dialga") && lower.contains("origin") -> "DIA-O"
        lower.contains("giratina") && lower.contains("origin") -> "GIR-O"
        lower.contains("giratina") && lower.contains("altered") -> "GIR-A"
        lower.contains("zacian") && lower.contains("crowned") -> "ZAC-C"
        lower.contains("zamazenta") && lower.contains("crowned") -> "ZAM-C"
        lower.contains("necrozma") && lower.contains("dusk") -> "NDM"
        lower.contains("necrozma") && lower.contains("dawn") -> "NDW"
        lower.contains("kyurem") && lower.contains("white") -> "KYU-W"
        lower.contains("kyurem") && lower.contains("black") -> "KYU-B"
        lower.contains("landorus") && lower.contains("therian") -> "LND-T"
        lower.contains("enamorus") && lower.contains("therian") -> "ENM-T"
        lower.contains("keldeo") -> "KELD"
        lower.contains("ho-oh") || lower == "ho oh" -> "HO-OH"
        lower.contains("zygarde") -> "ZYG"
        lower.contains("xerneas") -> "XERN"
        lower.contains("yveltal") -> "YVEL"
        lower.contains("solgaleo") -> "SOLG"
        lower.contains("lunala") -> "LUNA"
        lower.contains("mewtwo") -> "M2"
        lower.contains("kyogre") -> "KYOG"
        lower.contains("groudon") -> "GROU"
        lower.contains("rhyperior") -> "RHYP"
        lower.contains("florges") -> "FLRG"
        lower.contains("primarina") -> "PRIM"
        lower.contains("feraligatr") -> "FERAL"
        lower.contains("clodsire") -> "CLOD"
        lower.contains("mandibuzz") -> "MANDI"
        lower.contains("annihilape") -> "APE"
        lower.contains("azumarill") -> "AZU"
        lower.contains("bastiodon") -> "BASTI"
        lower.contains("wigglytuff") -> "WIGG"
        lower.contains("talonflame") -> "TALON"
        lower.contains("weezing") && lower.contains("galar") -> "GWEEZ"
        lower.contains("corsola") && lower.contains("galar") -> "GCORS"
        lower.contains("moltres") && lower.contains("galar") -> "GMOLT"
        lower.contains("stunfisk") && lower.contains("galar") -> "GFISK"
        lower.contains("ninetales") && lower.contains("alola") -> "A9T"
        lower.contains("sandslash") && lower.contains("alola") -> "ASAND"
        lower.contains("muk") && lower.contains("alola") -> "AMUK"
        lower.contains("marowak") && lower.contains("alola") -> "AWAK"
        lower.contains("deoxys") && lower.contains("defense") -> "DD"
        lower.contains("urshifu") && lower.contains("single") -> "URS-S"
        lower.contains("urshifu") && lower.contains("rapid") -> "URS-R"
        else -> {
            val base = clean
                .replace(Regex("^(Kanto|Alolan|Galarian|Hisuian|Paldean|Mega|Primal)\\s+", RegexOption.IGNORE_CASE), "")
                .split(Regex("[\\s(]+"))
                .firstOrNull()
                ?.uppercase() ?: "MON"
            base.take(5)
        }
    }
    return if (sh && !mapped.startsWith("S-")) {
        "S${mapped.replace("-", "").take(4)}"
    } else {
        mapped.take(5)
    }
}

internal fun OverlayService.Companion.abbrMoveCompactStatic(moveName: String): String {
    if (moveName.isBlank()) return "Move"
    val lower = moveName.trim().lowercase()
    return when (lower) {
        "spacial rend" -> "SpRend"
        "aqua tail" -> "AqTail"
        "roar of time" -> "RoTime"
        "iron head" -> "IrHead"
        "draco meteor" -> "DrMet"
        "close combat" -> "ClsCmb"
        "wild charge" -> "WldChg"
        "play rough" -> "PlyRgh"
        "behemoth blade" -> "BhBlde"
        "behemoth bash" -> "BhBash"
        "sacred fire" -> "SacFir"
        "brave bird" -> "BrvBrd"
        "sunsteel strike" -> "SunStk"
        "moongeist beam" -> "MnBeam"
        "dark pulse" -> "DrkPls"
        "outrage" -> "Outrg"
        "fusion bolt" -> "FsBolt"
        "fusion flare" -> "FsFlar"
        "glaciate" -> "Glciat"
        "freeze shock" -> "FrzShk"
        "ice burn" -> "IceBrn"
        "secret sword" -> "SecSw"
        "sacred sword" -> "SacSw"
        "sandsear storm" -> "SndStm"
        "stone edge" -> "StnEdg"
        "superpower" -> "SprPwr"
        "rock slide" -> "RckSld"
        "mud bomb" -> "MdBomb"
        "rock wrecker" -> "RckWrk"
        "breaking swipe" -> "BrkSwp"
        "surf" -> "Surf"
        "crunch" -> "Crunch"
        "earthquake" -> "Eq"
        "moonblast" -> "Mnblst"
        "geomancy" -> "Geomn"
        "oblivion wing" -> "ObWing"
        "focus blast" -> "FocBls"
        "psystrike" -> "Psystk"
        "shadow ball" -> "ShBall"
        "origin pulse" -> "OrPuls"
        "precipice blades" -> "PrBlde"
        "fire punch" -> "FirPnc"
        "ice punch" -> "IcePnc"
        "thunder punch" -> "ThdPnc"
        "dynamic punch" -> "DynPnc"
        "hydro cannon" -> "HydCan"
        "ice beam" -> "IceBm"
        "foul play" -> "FlPlay"
        "aerial ace" -> "AerAce"
        "night slash" -> "NgtSlh"
        "icy wind" -> "IcyWnd"
        "swift" -> "Swift"
        "body slam" -> "BdySlm"
        "disarming voice" -> "DisVc"
        "psyshock" -> "Psysck"
        "meteor mash" -> "MetMsh"
        "nature's madness" -> "NatMad"
        "dazzling gleam" -> "DazGlm"
        "sludge wave" -> "SlgWav"
        "sludge bomb" -> "SlgBmb"
        "overheat" -> "OvrHt"
        "blast burn" -> "BlsBrn"
        "frenzy plant" -> "FrzPlt"
        "leaf blade" -> "LfBlde"
        "drill run" -> "DrlRun"
        "high horsepower" -> "HiHors"
        "scald" -> "Scald"
        "liquidation" -> "Liquid"
        "rage fist" -> "RgFist"
        "aura wheel" -> "AuWhl"
        "brutal swing" -> "BrtSwg"
        "trailblaze" -> "Trlblz"
        "flame charge" -> "FlmChg"
        else -> {
            val clean = moveName.replace(Regex("[()\\-]"), " ").trim()
            val words = clean.split(Regex("\\s+")).filter { it.isNotEmpty() }
            if (words.size >= 2) {
                (words[0].take(3) + words[1].take(3)).take(6)
            } else {
                clean.take(6)
            }
        }
    }
}

internal fun OverlayService.Companion.evaluateOrAutoOrderTeamStatic(
    slots: List<TeamMember>,
    league: String,
    seasonLogs: List<Pair<Long, List<String>>>,
    autoReorder: Boolean,
    manualArchetypeOverride: String? = null
): TeamArchetypeEvaluationResult {
    val padded = if (slots.size >= 3) slots.take(3) else {
        val top = getTopMetaPoolForLeagueStatic(league)
        (slots + listOf(
            TeamMember(top.getOrElse(0) { "Clodsire" }, 1500, "Poison Sting", "Earthquake", "Stone Edge"),
            TeamMember(top.getOrElse(1) { "Feraligatr" }, 1500, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
            TeamMember(top.getOrElse(2) { "Mandibuzz" }, 1500, "Snarl", "Dark Pulse", "Aerial Ace")
        )).take(3)
    }

    val dist = computeBlendedSeasonMetaStatic(league, seasonLogs)

    fun getTypesFor(slot: TeamMember): List<String> {
        val meta = resolveRecommendedMovesForSpecies(slot.name, league)
        return meta?.types?.map { it.lowercase() }?.ifEmpty { listOf("normal") } ?: listOf("normal")
    }

    fun getWeaknesses(types: List<String>): Set<String> {
        return ALL_18_TYPES.filter { atkType ->
            getTypeEffectivenessStatic(atkType, types) > 1.05
        }.toSet()
    }

    fun resistsAll(types: List<String>, sharedWeaknesses: Set<String>): Boolean {
        if (sharedWeaknesses.isEmpty()) return false
        val resistedCount = sharedWeaknesses.count { wType ->
            getTypeEffectivenessStatic(wType, types) < 0.95
        }
        val notWeakToAny = sharedWeaknesses.all { wType ->
            getTypeEffectivenessStatic(wType, types) <= 1.05
        }
        return resistedCount == sharedWeaknesses.size || (resistedCount >= 1 && notWeakToAny && sharedWeaknesses.size >= 2)
    }

    // Single-pass per-slot role BR precomputation against all opponents in dist
    val allOpps = (dist.leadWeights.keys + dist.fieldWeights.keys).distinct()
    val slotLeadBrMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val slotSwapBrMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val slotCloserBrMap = Array(3) { HashMap<String, Double>(allOpps.size) }

    for (i in 0 until 3) {
        val slot = padded[i]
        for (opp in allOpps) {
            val b00 = calculateMatchupRatingStatic(slot.name, opp, 0, 0, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b01 = calculateMatchupRatingStatic(slot.name, opp, 0, 1, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b10 = calculateMatchupRatingStatic(slot.name, opp, 1, 0, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b11 = calculateMatchupRatingStatic(slot.name, opp, 1, 1, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b12 = calculateMatchupRatingStatic(slot.name, opp, 1, 2, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b21 = calculateMatchupRatingStatic(slot.name, opp, 2, 1, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()
            val b22 = calculateMatchupRatingStatic(slot.name, opp, 2, 2, league, slot.fastMove, slot.chargedMove1, slot.chargedMove2, slot.cp, slot.ivs, slot.plusMoveLevel).toDouble()

            slotLeadBrMap[i][opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
            slotSwapBrMap[i][opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
            slotCloserBrMap[i][opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
        }
    }

    fun computeSwapStatsForIndex(idx: Int): Pair<Double, Double> {
        var mu = 0.0
        val map = slotSwapBrMap[idx]
        for ((opp, prob) in dist.fieldWeights) {
            if (prob <= 0.0) continue
            mu += prob * (map[opp] ?: 500.0)
        }
        var variance = 0.0
        for ((opp, prob) in dist.fieldWeights) {
            if (prob <= 0.0) continue
            val diff = (map[opp] ?: mu) - mu
            variance += prob * diff * diff
        }
        val sigma = kotlin.math.sqrt(max(0.0, variance))
        return (mu - 0.5 * sigma) to mu
    }

    fun computeCloserStatsForIndex(idx: Int): Double {
        var mu = 0.0
        val map = slotCloserBrMap[idx]
        for ((opp, prob) in dist.fieldWeights) {
            if (prob <= 0.0) continue
            mu += prob * (map[opp] ?: 500.0)
        }
        return mu
    }

    fun computeBaitVsSweeperScore(slot: TeamMember, swapSafeScore: Double, closerMean: Double): Pair<Double, Double> {
        val c1Stats = resolveChargedMoveStatsStatic(slot.chargedMove1)
        val c2Stats = resolveChargedMoveStatsStatic(slot.chargedMove2)
        val plusMove = resolveMegaPlusMoveStatic(slot.name, league)
        val c3Stats = plusMove?.let { resolveChargedMoveStatsStatic(it) }
        val minEnergy = min(min(c1Stats.energyCost, c2Stats.energyCost), c3Stats?.energyCost ?: Int.MAX_VALUE).toDouble()
        val maxPower = max(max(c1Stats.power, c2Stats.power), c3Stats?.power ?: 0).toDouble()
        val isShadow = slot.name.contains("Shadow", ignoreCase = true)
        val baitScore = swapSafeScore + (55.0 - minEnergy) * 1.4 - (if (isShadow) 8.0 else 0.0)
        val sweeperScore = closerMean + (maxPower - 80.0) * 0.45 + (if (isShadow) 14.0 else 0.0)
        return baitScore to sweeperScore
    }

    val typesList = padded.map { getTypesFor(it) }
    val weakList = padded.indices.map { getWeaknesses(typesList[it]) }

    // Check candidate B-pairs: (1,2) with Lead 0, (0,2) with Lead 1, (0,1) with Lead 2
    val candidatePairs = listOf(
        Triple(0, 1, 2),
        Triple(1, 0, 2),
        Triple(2, 0, 1)
    )

    var detectedAbbTriplet: Triple<Int, Int, Int>? = null
    var detectedSharedWeaknesses: List<String> = emptyList()
    var bestSharedScore = -1

    for ((aIdx, b1Idx, b2Idx) in candidatePairs) {
        val shared = weakList[b1Idx].intersect(weakList[b2Idx])
        val hasCritical = shared.any { it in CRITICAL_META_TYPES }
        if ((shared.size >= 2 || (shared.size == 1 && hasCritical)) && resistsAll(typesList[aIdx], shared)) {
            val score = shared.size * 10 + (if (aIdx == 0) 3 else 0)
            if (score > bestSharedScore) {
                bestSharedScore = score
                detectedAbbTriplet = Triple(aIdx, b1Idx, b2Idx)
                detectedSharedWeaknesses = shared.map { it.replaceFirstChar { c -> c.uppercase() } }
            }
        }
    }

    // Detect Symmetric Yin-Yang Duo-Core: Core 1 and Core 2 cover each other's weaknesses while Pivot acts as Safe Swap
    fun countCoveredWeaknesses(defenderTypes: List<String>, partnerWeaknesses: Set<String>): Int {
        return partnerWeaknesses.count { wType ->
            getTypeEffectivenessStatic(wType, defenderTypes) < 0.95
        }
    }

    fun hasSharedUnresistedWeakness(typesA: List<String>, typesB: List<String>): Boolean {
        val wA = getWeaknesses(typesA)
        val wB = getWeaknesses(typesB)
        return wA.intersect(wB).isNotEmpty()
    }

    val swapScores = (0 until 3).map { computeSwapStatsForIndex(it).first }
    val closerMeans = (0 until 3).map { computeCloserStatsForIndex(it) }

    var detectedDuoTriplet: Triple<Int, Int, Int>? = null // (core1Idx, pivotIdx, core2Idx)
    var detectedDuoCoveredTypes: List<String> = emptyList()
    var bestDuoScore = -1.0

    val duoPairs = listOf(
        Triple(0, 1, 2), // Core (0, 2) + Pivot 1
        Triple(0, 2, 1), // Core (0, 1) + Pivot 2
        Triple(1, 0, 2)  // Core (1, 2) + Pivot 0
    )
    for ((cA, piv, cB) in duoPairs) {
        if (hasSharedUnresistedWeakness(typesList[cA], typesList[cB])) continue
        val aCoversB = countCoveredWeaknesses(typesList[cA], weakList[cB])
        val bCoversA = countCoveredWeaknesses(typesList[cB], weakList[cA])
        if (aCoversB >= 1 && bCoversA >= 1 && (aCoversB + bCoversA) >= 3) {
            val symScore = (aCoversB + bCoversA) * 18.0 + swapScores[piv] * 0.12 + (if (piv == 1) 8.0 else 0.0)
            if (symScore > bestDuoScore) {
                bestDuoScore = symScore
                detectedDuoTriplet = Triple(cA, piv, cB)
                val mutCovered = (weakList[cB].filter { getTypeEffectivenessStatic(it, typesList[cA]) < 0.95 } +
                    weakList[cA].filter { getTypeEffectivenessStatic(it, typesList[cB]) < 0.95 })
                    .distinct()
                    .map { it.replaceFirstChar { c -> c.uppercase() } }
                detectedDuoCoveredTypes = mutCovered
            }
        }
    }

    val cleanOverride = manualArchetypeOverride?.trim()?.uppercase()?.takeIf { it == "ABB" || it == "ABC" || it == "DUO" }
    val archetype: String = cleanOverride ?: when {
        detectedAbbTriplet != null -> "ABB"
        detectedDuoTriplet != null -> "DUO"
        else -> "ABC"
    }

    if (archetype == "ABB" && detectedSharedWeaknesses.isEmpty()) {
        val backShared = weakList[1].intersect(weakList[2])
        detectedSharedWeaknesses = backShared.map { it.replaceFirstChar { c -> c.uppercase() } }
    } else if (archetype == "DUO") {
        if (detectedDuoCoveredTypes.isEmpty()) {
            val mutCovered = (weakList[2].filter { getTypeEffectivenessStatic(it, typesList[0]) < 0.95 } +
                weakList[0].filter { getTypeEffectivenessStatic(it, typesList[2]) < 0.95 })
                .distinct()
                .map { it.replaceFirstChar { c -> c.uppercase() } }
            detectedDuoCoveredTypes = mutCovered
        }
        detectedSharedWeaknesses = detectedDuoCoveredTypes
    }

    val finalOrderIndices: List<Int>
    if (archetype == "ABB") {
        if (autoReorder) {
            val (aIdx, bA, bB) = detectedAbbTriplet ?: Triple(0, 1, 2)
            val (baitA, sweepA) = computeBaitVsSweeperScore(padded[bA], swapScores[bA], closerMeans[bA])
            val (baitB, sweepB) = computeBaitVsSweeperScore(padded[bB], swapScores[bB], closerMeans[bB])
            val b1First = (baitA + sweepB) >= (baitB + sweepA)
            finalOrderIndices = if (b1First) listOf(aIdx, bA, bB) else listOf(aIdx, bB, bA)
        } else {
            finalOrderIndices = listOf(0, 1, 2)
        }
    } else if (archetype == "DUO") {
        if (autoReorder) {
            val (cA, piv, cB) = detectedDuoTriplet ?: run {
                // Pick highest Swap BR member as Pivot (Slot 2) and place the 2 core partners at Slots 1 & 3
                val bestPiv = (0..2).maxByOrNull { swapScores[it] } ?: 1
                val others = (0..2).filter { it != bestPiv }
                Triple(others[0], bestPiv, others[1])
            }
            var leadA = 0.0
            var leadB = 0.0
            for ((opp, prob) in dist.leadWeights) {
                if (prob <= 0.0) continue
                leadA += prob * (slotLeadBrMap[cA][opp] ?: 500.0)
                leadB += prob * (slotLeadBrMap[cB][opp] ?: 500.0)
            }
            finalOrderIndices = if (leadA >= leadB) listOf(cA, piv, cB) else listOf(cB, piv, cA)
        } else {
            finalOrderIndices = listOf(0, 1, 2)
        }
    } else {
        if (autoReorder) {
            // Keep Slot 1 (index 0) fixed; place higher Swap BR backline member in Slot 2
            finalOrderIndices = if (swapScores[1] >= swapScores[2]) listOf(0, 1, 2) else listOf(0, 2, 1)
        } else {
            finalOrderIndices = listOf(0, 1, 2)
        }
    }

    val i1 = finalOrderIndices[0]
    val i2 = finalOrderIndices[1]
    val i3 = finalOrderIndices[2]
    val ordered = finalOrderIndices.map { padded[it] }
    val slot1 = ordered[0]
    val slot2 = ordered[1]
    val slot3 = ordered[2]

    var leadAgg = 0.0
    for ((opp, prob) in dist.leadWeights) {
        if (prob <= 0.0) continue
        leadAgg += prob * (slotLeadBrMap[i1][opp] ?: 500.0)
    }

    var machAgg = 0.0
    for ((opp, prob) in dist.fieldWeights) {
        if (prob <= 0.0) continue
        val r1 = slotLeadBrMap[i1][opp] ?: 500.0
        val r2 = slotSwapBrMap[i2][opp] ?: 500.0
        val r3 = slotCloserBrMap[i3][opp] ?: 500.0
        machAgg += prob * max(r1, max(r2, r3))
    }

    val leadAggVal = leadAgg.roundToInt().coerceIn(150, 850)
    val machAggVal = machAgg.roundToInt().coerceIn(150, 850)
    val safeSwapBrVal = swapScores[i2].roundToInt().coerceIn(150, 850)
    val closerSwapBrVal = swapScores[i3].roundToInt().coerceIn(150, 850)
    val closerBrVal = closerMeans[i3].roundToInt().coerceIn(150, 850)

    // Audit Top 50 Meta Targets for Key Wins, Key Threats (with BR1/BR2/BR3), and Core Breakers (with BR1/BR2/BR3)
    val top50MetaThreats = dist.fieldWeights.entries
        .sortedByDescending { it.value }
        .map { it.key }
        .take(50)
        .ifEmpty { getTopMetaPoolForLeagueStatic(league).take(50) }
    val targetAuditTotal = top50MetaThreats.size.takeIf { it > 0 } ?: 50

    fun formatThreatWithMemberBrs(threatName: String): String {
        val r0 = slotLeadBrMap[i1][threatName] ?: 500.0
        val r1 = slotSwapBrMap[i2][threatName] ?: 500.0
        val r2 = slotCloserBrMap[i3][threatName] ?: 500.0
        val oppBr0 = (1000.0 - r0).roundToInt().coerceIn(100, 900)
        val oppBr1 = (1000.0 - r1).roundToInt().coerceIn(100, 900)
        val oppBr2 = (1000.0 - r2).roundToInt().coerceIn(100, 900)
        return "$threatName($oppBr0/$oppBr1/$oppBr2)"
    }

    val beatenTargets = ArrayList<String>()
    val coreBreakersRaw = ArrayList<String>()
    val keyThreatsRaw = ArrayList<String>()

    for (threat in top50MetaThreats) {
        val r0 = slotLeadBrMap[i1][threat] ?: 500.0
        val r1 = slotSwapBrMap[i2][threat] ?: 500.0
        val r2 = slotCloserBrMap[i3][threat] ?: 500.0
        val maxBr = max(r0, max(r1, r2))
        val minBackBr = min(r1, r2)

        if (maxBr >= 525.0) {
            beatenTargets.add(threat)
        }

        if (r0 < 495.0 && r1 < 495.0 && r2 < 495.0) {
            coreBreakersRaw.add(threat)
        } else if ((r0 < 475.0 && minBackBr < 485.0) || maxBr < 512.0) {
            keyThreatsRaw.add(threat)
        }
    }

    if (keyThreatsRaw.isEmpty()) {
        val sortedTough = top50MetaThreats
            .filter { it !in coreBreakersRaw }
            .map { t ->
                val r0 = slotLeadBrMap[i1][t] ?: 500.0
                val r1 = slotSwapBrMap[i2][t] ?: 500.0
                val r2 = slotCloserBrMap[i3][t] ?: 500.0
                t to (min(r0, (r1 + r2) / 2.0) + max(r0, max(r1, r2)) * 0.35)
            }
            .sortedBy { it.second }
        for ((tName, _) in sortedTough.take(3)) {
            keyThreatsRaw.add(tName)
        }
    }

    val keyThreatsFormatted = keyThreatsRaw.take(6).map { formatThreatWithMemberBrs(it) }
    val coreBreakersFormatted = coreBreakersRaw.take(6).map { formatThreatWithMemberBrs(it) }

    val roleLabels = when (archetype) {
        "ABB" -> listOf("Lead (A)", "Bait Swap (B1)", "Sweeper (B2)")
        "DUO" -> listOf("Lead (Core 1)", "Pivot (Swap)", "Co-Core (Core 2)")
        else -> listOf("Lead", "Safe Swap", "Closer")
    }

    val altMovesetSlots = ordered.mapIndexed { sIdx, m ->
        val stdMeta = resolveRecommendedMovesForSpecies(m.name, league, m.cp, m.ivs)
        val stdFast = stdMeta?.defaultFastMove ?: m.fastMove
        val stdC1 = stdMeta?.chargedMove1 ?: m.chargedMove1
        val stdC2 = stdMeta?.chargedMove2 ?: m.chargedMove2
        val stdPair = listOf(stdC1.lowercase(), stdC2.lowercase()).sorted().joinToString("+")
        val curPair = listOf(m.chargedMove1.lowercase(), m.chargedMove2.lowercase()).sorted().joinToString("+")
        val isAlt = !stdFast.equals(m.fastMove, ignoreCase = true) || stdPair != curPair
        AntiMetaAltMovesetInfo(
            slotIndex = sIdx,
            roleLabel = roleLabels[sIdx],
            pokemonName = m.name,
            isAltMoveset = isAlt,
            standardFastMove = stdFast,
            standardCharged1 = stdC1,
            standardCharged2 = stdC2,
            fastMove = m.fastMove,
            chargedMove1 = m.chargedMove1,
            chargedMove2 = m.chargedMove2,
            roleBrDelta = 0,
            coreBrDelta = 0
        )
    }

    val winsPreview = beatenTargets.take(5).joinToString(", ").ifEmpty { "Broad neutral coverage" }
    val threatsPreview = keyThreatsFormatted.take(4).joinToString(", ").ifEmpty { "None prominent" }
    val breakersPreview = if (coreBreakersFormatted.isNotEmpty()) {
        coreBreakersFormatted.take(4).joinToString(", ")
    } else {
        "None (0 hard core breakers in Top 50)"
    }
    val altNotes = altMovesetSlots
        .filter { it.isAltMoveset }
        .map {
            val plusMove = resolveMegaPlusMoveStatic(it.pokemonName, league)
            val plusTag = if (plusMove != null) " + $plusMove [Mega4]" else ""
            "${it.pokemonName} (${it.fastMove} + ${it.chargedMove1}/${it.chargedMove2}$plusTag)"
        }
    val altSuffix = if (altNotes.isNotEmpty()) " • Alt Moveset Tech: ${altNotes.joinToString("; ")}." else ""

    val synergySummary = when (archetype) {
        "ABB" -> {
            val sharedStr = if (detectedSharedWeaknesses.isNotEmpty()) detectedSharedWeaknesses.joinToString("/").uppercase() else "BACKLINE"
            "ABB Lineup: ${slot1.name} (Lead A) covers backline $sharedStr weakness for ${slot2.name} (Bait B1) & ${slot3.name} (Sweeper B2). Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
        }
        "DUO" -> {
            val covStr = if (detectedSharedWeaknesses.isNotEmpty()) " (${detectedSharedWeaknesses.joinToString("/")} covered)" else ""
            "Duo-Core (Yin-Yang 1⇄3): ${slot1.name} (Core 1 Lead, $leadAggVal BR) & ${slot3.name} (Core 2 Co-Core, $closerBrVal BR) mutually cover each other's weaknesses$covStr, with ${slot2.name} ($safeSwapBrVal BR) as the Safe Swap Pivot. Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
        }
        else -> {
            "ABC Balanced Core: ${slot1.name} Lead ($leadAggVal BR) + ${slot2.name} Safe Swap ($safeSwapBrVal BR) + ${slot3.name} Closer ($closerBrVal BR). Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
        }
    }

    val reasonSummary = when (archetype) {
        "ABB" -> {
            val sharedStr = if (detectedSharedWeaknesses.isNotEmpty()) detectedSharedWeaknesses.joinToString("/") else "Backline"
            "⚡ Auto-Detected ABB Lineup (Shared $sharedStr weakness covered by ${slot1.name}) → #1 Lead (A): ${slot1.name} (Lead BR $leadAggVal) • #2 Bait Swap (B1): ${slot2.name} (Swap BR $safeSwapBrVal) • #3 Sweeper (B2): ${slot3.name} (Closer BR $closerBrVal) • $synergySummary"
        }
        "DUO" -> {
            "☯️ Auto-Detected Duo-Core Lineup (Yin-Yang 1st & 3rd Core) → #1 Core 1 Lead: ${slot1.name} (Lead BR $leadAggVal) • #2 Safe Swap Pivot: ${slot2.name} (Swap BR $safeSwapBrVal) • #3 Core 2 Co-Core: ${slot3.name} (Closer BR $closerBrVal) • $synergySummary"
        }
        else -> {
            "⚡ Auto-Detected ABC Balanced Core → #1 Lead kept: ${slot1.name} (Lead BR $leadAggVal) • #2 Safe Swap moved to Slot 2: ${slot2.name} (Swap BR $safeSwapBrVal) • #3 Closer: ${slot3.name} (Closer BR $closerBrVal) • $synergySummary"
        }
    }

    return TeamArchetypeEvaluationResult(
        orderedSlots = ordered,
        archetype = archetype,
        leadAggBr = leadAggVal,
        machineAggBr = machAggVal,
        safeSwapBr = safeSwapBrVal,
        closerSwapBr = closerSwapBrVal,
        closerBr = closerBrVal,
        sharedWeaknesses = detectedSharedWeaknesses,
        histWeightPct = dist.histWeightPct,
        seasonMatchCount = dist.seasonMatchCount,
        reasonSummary = reasonSummary,
        topMetaTargetsTotal = targetAuditTotal,
        topMetaWinsCount = beatenTargets.size,
        keyMetaTargetsBeaten = beatenTargets.take(6),
        keyThreats = keyThreatsFormatted,
        coreBreakers = coreBreakersFormatted,
        altMovesetSlots = altMovesetSlots,
        synergySummary = synergySummary
    )
}

internal fun OverlayService.Companion.getTop100MetaCandidatesForLeagueStatic(league: String, maxLimit: Int = 200): List<TeamMember> {
    val normLeague = normalizeLeagueKeyStatic(league)
    val isBfCup = isBattleFrontierLeagueStatic(normLeague)
    val allowMega = isMegaAllowedInLeagueStatic(normLeague)
    val cpCap = getLeagueCpCapStatic(normLeague)
    val isGreat = cpCap <= 1500
    val isUltra = cpCap == 2500

    val allMeta = getAllPokemonMeta()
    val bySpeciesId = allMeta.associateBy { it.speciesId.lowercase() }
    val result = ArrayList<TeamMember>(maxLimit)
    val seenNames = HashSet<String>()
    val rankingsMap = LIVE_RANKINGS_MAP[normLeague]

    fun isMegaOrPrimal(name: String, speciesId: String): Boolean {
        return isMegaOrPrimalSpeciesStatic(name) || isMegaOrPrimalSpeciesStatic(speciesId)
    }

    fun addCandidateFromName(candidateName: String) {
        if (result.size >= maxLimit) return
        val cleanKey = candidateName.trim().lowercase()
        if (cleanKey.isEmpty() || !seenNames.add(cleanKey)) return
        val resolved = resolveRecommendedMovesForSpecies(candidateName, normLeague) ?: return
        val baseId = resolved.speciesId.lowercase().removeSuffix("_shadow")
        val inCupRankings = rankingsMap?.containsKey(baseId) == true || rankingsMap?.containsKey("${baseId}_shadow") == true
        if (!allowMega && !inCupRankings && isMegaOrPrimal(resolved.name, resolved.speciesId)) {
            seenNames.remove(cleanKey)
            return
        }
        val scaled = computeEffectiveCombatStats(resolved, normLeague)
        val finalDisplayName = if (candidateName.startsWith("Shadow ", ignoreCase = true) && !scaled.name.startsWith("Shadow ", ignoreCase = true)) {
            "Shadow ${scaled.name}"
        } else {
            scaled.name
        }
        val ivDefault = when {
            isGreat -> scaled.defaultIvsGl
            isUltra -> scaled.defaultIvsUl
            else -> "15/15/15"
        }
        result.add(
            TeamMember(
                name = finalDisplayName,
                cp = scaled.defaultCp,
                fastMove = scaled.defaultFastMove,
                chargedMove1 = scaled.chargedMove1,
                chargedMove2 = scaled.chargedMove2,
                ivs = ivDefault
            )
        )
    }

    if (rankingsMap != null && rankingsMap.isNotEmpty()) {
        val sortedEntries = rankingsMap.values.sortedBy { it.rank }
        for (entry in sortedEntries) {
            if (result.size >= maxLimit) break
            val rawId = entry.speciesId.lowercase()
            val isShad = rawId.endsWith("_shadow")
            val baseId = rawId.removeSuffix("_shadow")
            val meta = bySpeciesId[rawId] ?: bySpeciesId[baseId]
            if (meta != null) {
                if (isShad && !FormResolver.isShadowEligibleVariant(meta)) continue
                val displayName = if (isShad && !meta.name.startsWith("Shadow ", ignoreCase = true)) {
                    "Shadow ${meta.name}"
                } else {
                    meta.name
                }
                addCandidateFromName(displayName)
            }
        }
        if (isBfCup && result.size >= 15) {
            return result.take(maxLimit)
        }
    }

    if (isBfCup && result.isEmpty()) {
        val bfSeed = when (normLeague) {
            "BATTLE FRONTIER (SPECTRAL)" -> listOf(
                "Ninetales (Alolan)", "Weezing (Galarian)", "Dewgong", "Piloswine", "Shadow Piloswine",
                "Ledian", "Jellicent", "Arctibax", "Talonflame", "Shadow Scizor", "Scizor",
                "Shadowcharizard", "Swalot", "Golisopod", "Shadow Gligar", "Gligar", "Drifblim",
                "Shadow Drifblim", "Sandslash (Alolan)", "Shadow Sandslash (Alolan)"
            )
            "BATTLE FRONTIER (CAULDRON)" -> listOf(
                "Weezing (Galarian)", "Guzzlord", "Drapion", "Shadow Drapion", "Tentacruel",
                "Skuntank", "Shadow Skuntank", "Dragalge", "Overqwil", "Nidoqueen", "Shadow Nidoqueen",
                "Qwilfish (Hisuian)", "Venusaur", "Shadow Venusaur", "Muk (Alolan)", "Toxicroak",
                "Swalot", "Salazzle", "Golbat", "Crobat"
            )
            else -> listOf(
                "Rhyperior", "Shadow Rhyperior", "Florges", "Zacian", "Kyurem", "Gyarados",
                "Shadow Gyarados", "Dragonite", "Shadow Dragonite", "Landorus (Therian)", "Garchomp",
                "Shadow Garchomp", "Primarina", "Mamoswine", "Shadow Mamoswine", "Metagross",
                "Togekiss", "Excadrill", "Ursaluna", "Goodra"
            )
        }
        for (name in bfSeed) {
            if (result.size >= maxLimit) break
            addCandidateFromName(name)
        }
        return result.take(maxLimit)
    }

    if (result.size < maxLimit) {
        val sortedFallback = allMeta
            .filter { !it.speciesId.endsWith("_shadow", ignoreCase = true) && !it.name.startsWith("Shadow ", ignoreCase = true) }
            .sortedBy {
                when {
                    isGreat -> it.glRank
                    isUltra -> it.ulRank
                    else -> it.mlRank
                }
            }
        for (meta in sortedFallback) {
            if (result.size >= maxLimit) break
            val (_, shadowPreferred) = FormResolver.getEffectiveRankAndShadowForVariant(meta, normLeague)
            if (shadowPreferred && FormResolver.isShadowEligibleVariant(meta)) {
                addCandidateFromName("Shadow ${meta.name}")
                if (result.size < maxLimit) addCandidateFromName(meta.name)
            } else {
                addCandidateFromName(meta.name)
                if (result.size < maxLimit && FormResolver.isShadowEligibleVariant(meta)) {
                    addCandidateFromName("Shadow ${meta.name}")
                }
            }
        }
    }

    if (result.size < maxLimit) {
        for (meta in allMeta) {
            if (result.size >= maxLimit) break
            if (!allowMega && isMegaOrPrimal(meta.name, meta.speciesId)) continue
            addCandidateFromName(meta.name)
            if (result.size < maxLimit && !meta.name.startsWith("Shadow ", ignoreCase = true)) {
                addCandidateFromName("Shadow ${meta.name}")
            }
        }
    }

    return result.take(maxLimit)
}

/**
 * Simulates the Top 200 Meta Pokémon for the active league across all 3 team roles
 * (#1 Lead, #2 Safe Swap, #3 Closer) against the Top 100 blended season meta and returns
 * the top 5 upgrades per role ranked by full team synergy (ΔCore BR + defensive weakness coverage)
 * and role rating delta (ΔRole BR), while enforcing the GBL Species Clause and including Shadow variants.
 */
internal fun OverlayService.Companion.recommendTop3UpgradesPerRoleStatic(
    slots: List<TeamMember>,
    league: String,
    seasonLogs: List<Pair<Long, List<String>>>,
    manualArchetypeOverride: String? = null
): TeamRoleRecommendationsResult {
    val baselineEval = evaluateOrAutoOrderTeamStatic(
        slots = slots,
        league = league,
        seasonLogs = seasonLogs,
        autoReorder = false,
        manualArchetypeOverride = manualArchetypeOverride
    )
    val currentSlots = baselineEval.orderedSlots
    val dist = computeBlendedSeasonMetaStatic(league, seasonLogs)
    val allOpps = (dist.leadWeights.keys + dist.fieldWeights.keys).distinct()

    fun getTypesFor(name: String): List<String> {
        val meta = resolveRecommendedMovesForSpecies(name, league)
        return meta?.types?.map { it.lowercase() }?.ifEmpty { listOf("normal") } ?: listOf("normal")
    }

    fun getWeaknesses(types: List<String>): Set<String> {
        return ALL_18_TYPES.filter { atkType ->
            getTypeEffectivenessStatic(atkType, types) > 1.05
        }.toSet()
    }

    fun getResistances(types: List<String>): Set<String> {
        return ALL_18_TYPES.filter { atkType ->
            getTypeEffectivenessStatic(atkType, types) < 0.95
        }.toSet()
    }

    // Precompute current 3 slots' per-opponent BR maps and type profiles
    val curLeadMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val curSwapMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val curCloserMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val curTypes = currentSlots.map { getTypesFor(it.name) }
    val curWeaks = curTypes.map { getWeaknesses(it) }
    val curResists = curTypes.map { getResistances(it) }

    for (i in 0 until 3) {
        val s = currentSlots[i]
        for (opp in allOpps) {
            val b00 = calculateMatchupRatingStatic(s.name, opp, 0, 0, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b01 = calculateMatchupRatingStatic(s.name, opp, 0, 1, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b10 = calculateMatchupRatingStatic(s.name, opp, 1, 0, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b11 = calculateMatchupRatingStatic(s.name, opp, 1, 1, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b12 = calculateMatchupRatingStatic(s.name, opp, 1, 2, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b21 = calculateMatchupRatingStatic(s.name, opp, 2, 1, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()
            val b22 = calculateMatchupRatingStatic(s.name, opp, 2, 2, league, s.fastMove, s.chargedMove1, s.chargedMove2, s.cp, s.ivs, s.plusMoveLevel).toDouble()

            curLeadMap[i][opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
            curSwapMap[i][opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
            curCloserMap[i][opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
        }
    }

    val candidates = getTop100MetaCandidatesForLeagueStatic(league, 200)

    data class PrecomputedCandidate(
        val member: TeamMember,
        val baseSpecies: String,
        val isMega: Boolean,
        val types: List<String>,
        val weaknesses: Set<String>,
        val resistances: Set<String>,
        val leadMap: Map<String, Double>,
        val swapMap: Map<String, Double>,
        val closerMap: Map<String, Double>,
        val leadAggBr: Int,
        val safeSwapBr: Int,
        val closerMeanBr: Int
    )

    val precomputedPool = candidates.map { cand ->
        val lMap = HashMap<String, Double>(allOpps.size)
        val sMap = HashMap<String, Double>(allOpps.size)
        val cMap = HashMap<String, Double>(allOpps.size)

        for (opp in allOpps) {
            val b00 = calculateMatchupRatingStatic(cand.name, opp, 0, 0, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b01 = calculateMatchupRatingStatic(cand.name, opp, 0, 1, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b10 = calculateMatchupRatingStatic(cand.name, opp, 1, 0, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b11 = calculateMatchupRatingStatic(cand.name, opp, 1, 1, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b12 = calculateMatchupRatingStatic(cand.name, opp, 1, 2, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b21 = calculateMatchupRatingStatic(cand.name, opp, 2, 1, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b22 = calculateMatchupRatingStatic(cand.name, opp, 2, 2, league, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()

            lMap[opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
            sMap[opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
            cMap[opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
        }

        var lMean = 0.0
        for ((opp, prob) in dist.leadWeights) {
            if (prob > 0.0) lMean += prob * (lMap[opp] ?: 500.0)
        }

        var sMean = 0.0
        var cMean = 0.0
        for ((opp, prob) in dist.fieldWeights) {
            if (prob > 0.0) {
                sMean += prob * (sMap[opp] ?: 500.0)
                cMean += prob * (cMap[opp] ?: 500.0)
            }
        }
        var sVar = 0.0
        for ((opp, prob) in dist.fieldWeights) {
            if (prob > 0.0) {
                val d = (sMap[opp] ?: sMean) - sMean
                sVar += prob * d * d
            }
        }
        val sSigma = kotlin.math.sqrt(max(0.0, sVar))
        val safeSwapVal = (sMean - 0.5 * sSigma).roundToInt().coerceIn(150, 850)

        val cTypes = getTypesFor(cand.name)
        PrecomputedCandidate(
            member = cand,
            baseSpecies = FormResolver.extractBaseSpecies(cand.name),
            isMega = isMegaOrPrimalSpeciesStatic(cand.name),
            types = cTypes,
            weaknesses = getWeaknesses(cTypes),
            resistances = getResistances(cTypes),
            leadMap = lMap,
            swapMap = sMap,
            closerMap = cMap,
            leadAggBr = lMean.roundToInt().coerceIn(150, 850),
            safeSwapBr = safeSwapVal,
            closerMeanBr = cMean.roundToInt().coerceIn(150, 850)
        )
    }

    fun rankUpgradesForSlot(slotIdx: Int): List<RoleUpgradeSuggestion> {
        val otherIdx1 = (slotIdx + 1) % 3
        val otherIdx2 = (slotIdx + 2) % 3
        val otherBase1 = FormResolver.extractBaseSpecies(currentSlots[otherIdx1].name)
        val otherBase2 = FormResolver.extractBaseSpecies(currentSlots[otherIdx2].name)
        val otherHasMega = listOf(currentSlots[otherIdx1].name, currentSlots[otherIdx2].name).any {
            isMegaOrPrimalSpeciesStatic(it)
        }
        val currentSlotMember = currentSlots[slotIdx]
        val isAbb = baselineEval.archetype == "ABB"
        val roleTitle = when (slotIdx) {
            0 -> if (isAbb) "Lead (A)" else "Lead"
            1 -> if (isAbb) "Bait Swap (B1)" else "Safe Swap"
            else -> if (isAbb) "Sweeper (B2)" else "Closer"
        }
        val baselineRoleBr = when (slotIdx) {
            0 -> baselineEval.leadAggBr
            1 -> baselineEval.safeSwapBr
            else -> baselineEval.closerSwapBr
        }

        val scored = ArrayList<RoleUpgradeSuggestion>()

        for (cand in precomputedPool) {
            // Enforce GBL Species Clause against the other 2 slots
            if (cand.baseSpecies.equals(otherBase1, ignoreCase = true) ||
                cand.baseSpecies.equals(otherBase2, ignoreCase = true)
            ) continue
            // Exclude identical Pokemon already in this slot
            if (cand.member.name.equals(currentSlotMember.name, ignoreCase = true)) continue
            // Enforce 1-Mega limit
            if (cand.isMega && otherHasMega) continue

            val newRoleBr = when (slotIdx) {
                0 -> cand.leadAggBr
                1 -> cand.safeSwapBr
                else -> ((cand.safeSwapBr * 0.55) + (cand.closerMeanBr * 0.45)).roundToInt()
            }
            val roleDelta = newRoleBr - baselineRoleBr

            var newMachSum = 0.0
            for ((opp, prob) in dist.fieldWeights) {
                if (prob <= 0.0) continue
                val r0 = if (slotIdx == 0) (cand.leadMap[opp] ?: 500.0) else (curLeadMap[0][opp] ?: 500.0)
                val r1 = if (slotIdx == 1) (cand.swapMap[opp] ?: 500.0) else (curSwapMap[1][opp] ?: 500.0)
                val r2 = if (slotIdx == 2) (cand.closerMap[opp] ?: 500.0) else (curCloserMap[2][opp] ?: 500.0)
                newMachSum += prob * max(r0, max(r1, r2))
            }
            val newMachBr = newMachSum.roundToInt().coerceIn(150, 850)
            val machDelta = newMachBr - baselineEval.machineAggBr
            val newLeadBr = if (slotIdx == 0) cand.leadAggBr else baselineEval.leadAggBr

            // Evaluate defensive coverage synergy with the other two teammates
            val otherWeaksUnion = curWeaks[otherIdx1].union(curWeaks[otherIdx2])
            val otherWeaksShared = curWeaks[otherIdx1].intersect(curWeaks[otherIdx2])
            val coveredSharedCount = otherWeaksShared.count { it in cand.resistances }
            val coveredUnionCount = otherWeaksUnion.count { it in cand.resistances }
            val tripleWeakCount = cand.weaknesses.intersect(otherWeaksShared).size

            val (synergyBonus, synergyTag) = when {
                slotIdx == 0 && otherWeaksShared.isNotEmpty() && coveredSharedCount == otherWeaksShared.size ->
                    12.0 to "Covers ${otherWeaksShared.take(2).joinToString("/").uppercase()} Core"
                slotIdx != 0 && curWeaks[0].any { it in cand.resistances } && tripleWeakCount == 0 -> {
                    val coveredLeadTypes = curWeaks[0].filter { it in cand.resistances }.take(2).joinToString("/").uppercase()
                    9.0 to "Covers $coveredLeadTypes"
                }
                coveredUnionCount >= 2 && tripleWeakCount == 0 ->
                    6.0 to "Strong Core Synergy"
                tripleWeakCount > 0 ->
                    (-14.0 * tripleWeakCount) to "Shared Weakness Risk"
                else ->
                    0.0 to "Meta Upgrade"
            }

            val composite = 0.55 * machDelta.toDouble() + 0.45 * roleDelta.toDouble() + synergyBonus
            val newArch = if (slotIdx == 0 && otherWeaksShared.isNotEmpty() && coveredSharedCount == otherWeaksShared.size) {
                "ABB"
            } else {
                baselineEval.archetype
            }

            scored.add(
                RoleUpgradeSuggestion(
                    slotIndex = slotIdx,
                    roleTitle = roleTitle,
                    candidate = cand.member,
                    newRoleBr = newRoleBr,
                    roleBrDelta = roleDelta,
                    newMachineAggBr = newMachBr,
                    machineBrDelta = machDelta,
                    newLeadAggBr = newLeadBr,
                    newArchetype = newArch,
                    compositeScore = composite,
                    synergyTag = synergyTag
                )
            )
        }

        scored.sortByDescending { it.compositeScore }

        // Pick top 5 distinct baseSpecies so the 5 chips give diverse species options
        val picked = ArrayList<RoleUpgradeSuggestion>(5)
        val usedBase = HashSet<String>()
        for (item in scored) {
            val b = FormResolver.extractBaseSpecies(item.candidate.name)
            if (usedBase.add(b)) {
                picked.add(item)
                if (picked.size >= 5) break
            }
        }
        if (picked.size < 5) {
            for (item in scored) {
                if (picked.none { it.candidate.name.equals(item.candidate.name, ignoreCase = true) }) {
                    picked.add(item)
                    if (picked.size >= 5) break
                }
            }
        }
        return picked
    }

    return TeamRoleRecommendationsResult(
        baselineEval = baselineEval,
        candidatePoolSize = precomputedPool.size,
        leadUpgrades = rankUpgradesForSlot(0),
        safeSwapUpgrades = rankUpgradesForSlot(1),
        closerUpgrades = rankUpgradesForSlot(2)
    )
}

internal fun OverlayService.Companion.recommendTop3MovesetsForTeamStatic(
    slots: List<TeamMember>,
    league: String,
    seasonLogs: List<Pair<Long, List<String>>>,
    manualArchetypeOverride: String? = null
): TeamMovesetRecommendationsResult {
    val baselineEval = evaluateOrAutoOrderTeamStatic(
        slots = slots,
        league = league,
        seasonLogs = seasonLogs,
        autoReorder = false,
        manualArchetypeOverride = manualArchetypeOverride
    )
    val curSlots = baselineEval.orderedSlots
    val dist = computeBlendedSeasonMetaStatic(league, seasonLogs)
    val allOpps = (dist.leadWeights.keys + dist.fieldWeights.keys).distinct()
    val isAbb = baselineEval.archetype.equals("ABB", ignoreCase = true)

    val curLeadMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val curSwapMap = Array(3) { HashMap<String, Double>(allOpps.size) }
    val curCloserMap = Array(3) { HashMap<String, Double>(allOpps.size) }

    for (i in 0..2) {
        val m = curSlots.getOrNull(i) ?: continue
        for (opp in allOpps) {
            val b00 = calculateMatchupRatingStatic(m.name, opp, 0, 0, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b01 = calculateMatchupRatingStatic(m.name, opp, 0, 1, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b10 = calculateMatchupRatingStatic(m.name, opp, 1, 0, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b11 = calculateMatchupRatingStatic(m.name, opp, 1, 1, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b12 = calculateMatchupRatingStatic(m.name, opp, 1, 2, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b21 = calculateMatchupRatingStatic(m.name, opp, 2, 1, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()
            val b22 = calculateMatchupRatingStatic(m.name, opp, 2, 2, league, m.fastMove, m.chargedMove1, m.chargedMove2, m.cp, m.ivs, m.plusMoveLevel).toDouble()

            curLeadMap[i][opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
            curSwapMap[i][opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
            curCloserMap[i][opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
        }
    }

    var totalCombosEvaluated = 0

    fun evaluateSlotMovesets(slotIdx: Int): List<MovesetUpgradeSuggestion> {
        val m = curSlots.getOrNull(slotIdx) ?: return emptyList()
        val roleTitle = when (slotIdx) {
            0 -> if (isAbb) "Lead (A)" else "Lead"
            1 -> if (isAbb) "Bait Swap (B1)" else "Safe Swap"
            else -> if (isAbb) "Sweeper (B2)" else "Closer"
        }
        val baselineRoleBr = when (slotIdx) {
            0 -> baselineEval.leadAggBr
            1 -> baselineEval.safeSwapBr
            else -> baselineEval.closerSwapBr
        }

        val (rawFastPool, rawChargedPool) = getAvailableMovePoolForSpeciesStatic(m.name, league)
        val fastPool = rawFastPool
            .filter { it.isNotBlank() && !it.equals("Struggle", ignoreCase = true) }
            .distinctBy { it.lowercase() }
            .take(4)
            .ifEmpty { listOf(m.fastMove) }
        val chargedPool = rawChargedPool
            .filter {
                it.isNotBlank() &&
                    !it.equals("Struggle", ignoreCase = true) &&
                    !it.equals("Frustration", ignoreCase = true)
            }
            .distinctBy { it.lowercase() }
            .take(6)
            .ifEmpty {
                listOfNotNull(
                    m.chargedMove1.takeIf { it.isNotBlank() },
                    m.chargedMove2.takeIf { it.isNotBlank() }
                ).distinctBy { it.lowercase() }
            }

        val slotMeta = resolveRecommendedMovesForSpecies(m.name, league, m.cp, m.ivs)
        val slotTypes = slotMeta?.types ?: emptyList()
        val rawPairs = mutableListOf<Pair<String, String>>()
        if (chargedPool.size <= 1) {
            val only = chargedPool.firstOrNull() ?: m.chargedMove1
            rawPairs.add(only to only)
        } else {
            for (i in 0 until chargedPool.size) {
                for (j in (i + 1) until chargedPool.size) {
                    rawPairs.add(chargedPool[i] to chargedPool[j])
                }
            }
        }
        val nonDominatedPairs = rawPairs.filterNot { (c1, c2) ->
            isDominatedSameTypeChargedPairStatic(c1, c2, slotTypes)
        }
        val cPairs = if (nonDominatedPairs.isNotEmpty()) nonDominatedPairs else rawPairs
        val hasDualTypeOption = cPairs.any { (c1, c2) ->
            val t1 = resolveChargedMoveStatsStatic(c1, slotTypes.firstOrNull() ?: "normal").type
            val t2 = resolveChargedMoveStatsStatic(c2, slotTypes.firstOrNull() ?: "normal").type
            !t1.equals(t2, ignoreCase = true)
        }

        val curFastNorm = m.fastMove.trim().lowercase()
        val curChargedSet = setOf(m.chargedMove1.trim().lowercase(), m.chargedMove2.trim().lowercase())
        val scored = mutableListOf<MovesetUpgradeSuggestion>()

        for (fMove in fastPool) {
            for ((c1Move, c2Move) in cPairs) {
                val propFastNorm = fMove.trim().lowercase()
                val propChargedSet = setOf(c1Move.trim().lowercase(), c2Move.trim().lowercase())
                if (propFastNorm == curFastNorm && propChargedSet == curChargedSet) {
                    continue
                }
                totalCombosEvaluated++

                val candLeadMap = HashMap<String, Double>(allOpps.size)
                val candSwapMap = HashMap<String, Double>(allOpps.size)
                val candCloserMap = HashMap<String, Double>(allOpps.size)

                for (opp in allOpps) {
                    val b00 = calculateMatchupRatingStatic(m.name, opp, 0, 0, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b01 = calculateMatchupRatingStatic(m.name, opp, 0, 1, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b10 = calculateMatchupRatingStatic(m.name, opp, 1, 0, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b11 = calculateMatchupRatingStatic(m.name, opp, 1, 1, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b12 = calculateMatchupRatingStatic(m.name, opp, 1, 2, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b21 = calculateMatchupRatingStatic(m.name, opp, 2, 1, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()
                    val b22 = calculateMatchupRatingStatic(m.name, opp, 2, 2, league, fMove, c1Move, c2Move, m.cp, m.ivs, m.plusMoveLevel).toDouble()

                    candLeadMap[opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
                    candSwapMap[opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
                    candCloserMap[opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
                }

                var leadSum = 0.0
                for ((opp, prob) in dist.leadWeights) {
                    if (prob > 0.0) leadSum += prob * (candLeadMap[opp] ?: 500.0)
                }

                var swapSum = 0.0
                var closerSum = 0.0
                for ((opp, prob) in dist.fieldWeights) {
                    if (prob > 0.0) {
                        swapSum += prob * (candSwapMap[opp] ?: 500.0)
                        closerSum += prob * (candCloserMap[opp] ?: 500.0)
                    }
                }
                var swapVarianceSum = 0.0
                for ((opp, prob) in dist.fieldWeights) {
                    if (prob > 0.0) {
                        val diff = (candSwapMap[opp] ?: swapSum) - swapSum
                        swapVarianceSum += prob * diff * diff
                    }
                }
                val swapStdDev = kotlin.math.sqrt(max(0.0, swapVarianceSum))
                val candSafeSwapBr = (swapSum - 0.5 * swapStdDev).roundToInt().coerceIn(150, 850)
                val candLeadAggBr = leadSum.roundToInt().coerceIn(150, 850)
                val candCloserBr = closerSum.roundToInt().coerceIn(150, 850)
                val candCloserSwapBr = ((candSafeSwapBr * 0.55) + (candCloserBr * 0.45)).roundToInt().coerceIn(150, 850)

                val newRoleBr = when (slotIdx) {
                    0 -> candLeadAggBr
                    1 -> candSafeSwapBr
                    else -> candCloserSwapBr
                }
                val roleDelta = newRoleBr - baselineRoleBr

                var newMachSum = 0.0
                for ((opp, prob) in dist.fieldWeights) {
                    if (prob <= 0.0) continue
                    val r0 = if (slotIdx == 0) (candLeadMap[opp] ?: 500.0) else (curLeadMap[0][opp] ?: 500.0)
                    val r1 = if (slotIdx == 1) (candSwapMap[opp] ?: 500.0) else (curSwapMap[1][opp] ?: 500.0)
                    val r2 = if (slotIdx == 2) (candCloserMap[opp] ?: 500.0) else (curCloserMap[2][opp] ?: 500.0)
                    newMachSum += prob * max(r0, max(r1, r2))
                }
                val newMachBr = newMachSum.roundToInt().coerceIn(150, 850)
                val machDelta = newMachBr - baselineEval.machineAggBr
                val newLeadBr = if (slotIdx == 0) candLeadAggBr else baselineEval.leadAggBr
                val leadDelta = newLeadBr - baselineEval.leadAggBr

                val c1S = resolveChargedMoveStatsStatic(c1Move, slotTypes.firstOrNull() ?: "normal")
                val c2S = resolveChargedMoveStatsStatic(c2Move, slotTypes.firstOrNull() ?: "normal")
                val isSameTypePair = !c1Move.equals(c2Move, ignoreCase = true) && c1S.type.equals(c2S.type, ignoreCase = true)
                val roleCoverageAdj = when {
                    !isSameTypePair -> 0.0
                    slotIdx == 1 && hasDualTypeOption -> -2.2 // Safe Swap prefers dual-type coverage when available
                    else -> 0.0
                }

                val composite = 0.55 * machDelta.toDouble() + 0.45 * roleDelta.toDouble() + roleCoverageAdj
                scored.add(
                    MovesetUpgradeSuggestion(
                        slotIndex = slotIdx,
                        roleTitle = roleTitle,
                        pokemonName = m.name,
                        currentFastMove = m.fastMove,
                        currentCharged1 = m.chargedMove1,
                        currentCharged2 = m.chargedMove2,
                        proposedFastMove = fMove,
                        proposedCharged1 = c1Move,
                        proposedCharged2 = c2Move,
                        currentRoleBr = baselineRoleBr,
                        newRoleBr = newRoleBr,
                        roleBrDelta = roleDelta,
                        currentMachineAggBr = baselineEval.machineAggBr,
                        newMachineAggBr = newMachBr,
                        machineBrDelta = machDelta,
                        currentLeadAggBr = baselineEval.leadAggBr,
                        newLeadAggBr = newLeadBr,
                        leadBrDelta = leadDelta,
                        compositeScore = composite
                    )
                )
            }
        }

        scored.sortByDescending { it.compositeScore }
        return scored.take(3)
    }

    val s1Moves = evaluateSlotMovesets(0)
    val s2Moves = evaluateSlotMovesets(1)
    val s3Moves = evaluateSlotMovesets(2)
    val top3Overall = (s1Moves + s2Moves + s3Moves)
        .sortedByDescending { it.compositeScore }
        .take(3)

    return TeamMovesetRecommendationsResult(
        baselineEval = baselineEval,
        combosEvaluated = totalCombosEvaluated,
        slot1Movesets = s1Moves,
        slot2Movesets = s2Moves,
        slot3Movesets = s3Moves,
        top3OverallMovesets = top3Overall
    )
}

internal fun OverlayService.Companion.parseFeaturedRankRangeQueryStatic(rawInput: String): FeaturedRankRangeSpec? {
    val cleaned = rawInput.trim()
        .replace(Regex("^(rank|ranked|#)\\s*", RegexOption.IGNORE_CASE), "")
        .trim()
    if (cleaned.isEmpty()) return null

    // Pattern 1: "200-" or "200+" => #200 or lower
    Regex("^(\\d{1,3})\\s*[-+]$").matchEntire(cleaned)?.let { m ->
        val minR = (m.groupValues[1].toIntOrNull() ?: 1).coerceIn(1, 500)
        return FeaturedRankRangeSpec(
            raw = rawInput.trim(),
            minRank = minR,
            maxRank = 999,
            label = "Rank #$minR+"
        )
    }

    // Pattern 2: "-10" or "<=10" => Top N (#1 to #N)
    Regex("^(?:[-]|<=?)\\s*(\\d{1,3})$").matchEntire(cleaned)?.let { m ->
        val maxR = (m.groupValues[1].toIntOrNull() ?: 10).coerceIn(1, 500)
        return FeaturedRankRangeSpec(
            raw = rawInput.trim(),
            minRank = 1,
            maxRank = maxR,
            label = "Top $maxR (#1–#$maxR)"
        )
    }

    // Pattern 3: "100-200" => #100 to #200
    Regex("^(\\d{1,3})\\s*-\\s*(\\d{1,3})$").matchEntire(cleaned)?.let { m ->
        val a = (m.groupValues[1].toIntOrNull() ?: 1).coerceIn(1, 500)
        val b = (m.groupValues[2].toIntOrNull() ?: 500).coerceIn(1, 500)
        val minR = min(a, b)
        val maxR = max(a, b)
        return FeaturedRankRangeSpec(
            raw = rawInput.trim(),
            minRank = minR,
            maxRank = maxR,
            label = "Rank #$minR–#$maxR"
        )
    }

    return null
}

internal fun OverlayService.Companion.getLeagueAbbreviationStatic(league: String): String {
    return when {
        league.contains("SPECTRAL", ignoreCase = true) -> "BF-Spec"
        league.contains("CAULDRON", ignoreCase = true) -> "BF-Caul"
        league.contains("FRONTIER", ignoreCase = true) -> "BF-ML"
        league.contains("MEGA", ignoreCase = true) -> "MML"
        league.contains("GREAT", ignoreCase = true) -> "GL"
        league.contains("ULTRA", ignoreCase = true) -> "UL"
        else -> "ML"
    }
}

internal fun OverlayService.Companion.formatAntiMetaDefaultTeamNameStatic(league: String, timestampMs: Long = System.currentTimeMillis()): String {
    val abbr = getLeagueAbbreviationStatic(league)
    val dateStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date(timestampMs))
    return "$abbr Anti-Meta $dateStr"
}

internal fun OverlayService.Companion.computeRoleWeightedTop100MetaStatic(
    normLeague: String,
    seasonLogs: List<Pair<Long, List<String>>>
): RoleWeightedTop100MetaDist {
    val top100Candidates = getTop100MetaCandidatesForLeagueStatic(normLeague, 100)
    val top100Species = ArrayList<String>(100)
    val seenLower = HashSet<String>()
    for (cand in top100Candidates) {
        val n = cand.name.trim()
        if (n.isNotEmpty() && seenLower.add(n.lowercase())) {
            top100Species.add(n)
        }
    }
    if (top100Species.size < 50) {
        for (fallbackName in getTopMetaPoolForLeagueStatic(normLeague)) {
            if (seenLower.add(fallbackName.lowercase())) {
                top100Species.add(fallbackName)
            }
        }
    }

    val fastGeneralistMoves = setOf(
        "shadow claw", "lick", "rollout", "psywave", "snarl",
        "dragon breath", "counter", "karate chop", "poison sting",
        "mud shot", "water shuriken", "sand attack", "lock-on",
        "thunder shock", "fairy wind"
    )

    val synLead = LinkedHashMap<String, Double>()
    val synSwap = LinkedHashMap<String, Double>()
    val synCloser = LinkedHashMap<String, Double>()
    val synField = LinkedHashMap<String, Double>()
    var sumSynL = 0.0
    var sumSynS = 0.0
    var sumSynC = 0.0
    var sumSynF = 0.0

    val candidateByName = top100Candidates.associateBy { it.name.lowercase() }

    top100Species.forEachIndexed { idx, monName ->
        val rankTierBoost = when {
            idx < 15 -> 1.35
            idx < 35 -> 1.20
            idx < 55 -> 1.08
            else -> 0.85
        }
        val baseW = kotlin.math.exp(-0.022 * idx.toDouble()) * rankTierBoost
        val candMember = candidateByName[monName.lowercase()]
        val fastLower = candMember?.fastMove?.lowercase() ?: ""
        val c1Stats = resolveChargedMoveStatsStatic(candMember?.chargedMove1 ?: "")
        val c2Stats = resolveChargedMoveStatsStatic(candMember?.chargedMove2 ?: "")
        val plusMove = resolveMegaPlusMoveStatic(monName, normLeague)
        val c3Stats = plusMove?.let { resolveChargedMoveStatsStatic(it) }
        val minEnergy = min(min(c1Stats.energyCost, c2Stats.energyCost), c3Stats?.energyCost ?: Int.MAX_VALUE)
        val maxPower = max(max(c1Stats.power, c2Stats.power), c3Stats?.power ?: 0)
        val isShadow = monName.startsWith("Shadow ", ignoreCase = true)

        val leadMult = (if (minEnergy <= 45) 1.22 else 1.0) *
            (if (idx < 25) 1.18 else 1.0) *
            (if (!isShadow) 1.06 else 0.96)
        val swapMult = (if (fastLower in fastGeneralistMoves) 1.28 else 1.0) *
            (if (minEnergy <= 45) 1.12 else 0.95) *
            (if (idx < 40) 1.12 else 1.0)
        val closerMult = (if (maxPower >= 95) 1.26 else 1.0) *
            (if (isShadow) 1.16 else 1.0) *
            (if (idx < 35) 1.12 else 1.0)

        val wL = baseW * leadMult
        val wS = baseW * swapMult
        val wC = baseW * closerMult
        val wF = baseW * ((leadMult + swapMult + closerMult) / 3.0)

        synLead[monName] = (synLead[monName] ?: 0.0) + wL
        synSwap[monName] = (synSwap[monName] ?: 0.0) + wS
        synCloser[monName] = (synCloser[monName] ?: 0.0) + wC
        synField[monName] = (synField[monName] ?: 0.0) + wF

        sumSynL += wL
        sumSynS += wS
        sumSynC += wC
        sumSynF += wF
    }

    val pSynL = synLead.mapValues { (_, v) -> if (sumSynL > 0.0) v / sumSynL else 0.0 }
    val pSynS = synSwap.mapValues { (_, v) -> if (sumSynS > 0.0) v / sumSynS else 0.0 }
    val pSynC = synCloser.mapValues { (_, v) -> if (sumSynC > 0.0) v / sumSynC else 0.0 }
    val pSynF = synField.mapValues { (_, v) -> if (sumSynF > 0.0) v / sumSynF else 0.0 }

    val sortedLogs = seasonLogs
        .filter { it.second.any { opp -> opp.isNotBlank() && !opp.equals("Waiting...", ignoreCase = true) } }
        .sortedByDescending { it.first }

    val nMatches = sortedLogs.size
    val lambda = activeGblMetaDecayFactor.toDouble().coerceIn(0.0, 0.25)
    val maxLogW = (activeGblMetaLogWeightPct.coerceIn(0, 100)) / 100.0
    val isLimCup = isLimitedCupFormatStatic(normLeague)
    val stdLogsForCup = if (isLimCup) resolveCachedSameCpStandardLogsForCupStatic(normLeague) else emptyList()

    val histLead = LinkedHashMap<String, Double>()
    val histSwap = LinkedHashMap<String, Double>()
    val histCloser = LinkedHashMap<String, Double>()
    val histField = LinkedHashMap<String, Double>()
    var sumHL = 0.0
    var sumHS = 0.0
    var sumHC = 0.0
    var sumHF = 0.0

    sortedLogs.forEachIndexed { idx, (_, opps) ->
        val recW = kotlin.math.exp(-lambda * idx.toDouble())
        val cleaned = opps.take(3).map { it.trim() }.filter { it.isNotEmpty() && !it.equals("Waiting...", ignoreCase = true) }
        cleaned.getOrNull(0)?.let { o0 ->
            histLead[o0] = (histLead[o0] ?: 0.0) + recW
            sumHL += recW
        }
        cleaned.getOrNull(1)?.let { o1 ->
            histSwap[o1] = (histSwap[o1] ?: 0.0) + recW
            sumHS += recW
        }
        cleaned.getOrNull(2)?.let { o2 ->
            histCloser[o2] = (histCloser[o2] ?: 0.0) + recW
            sumHC += recW
        }
        cleaned.forEach { op ->
            histField[op] = (histField[op] ?: 0.0) + recW
            sumHF += recW
        }
    }

    val stdLead = LinkedHashMap<String, Double>()
    val stdSwap = LinkedHashMap<String, Double>()
    val stdCloser = LinkedHashMap<String, Double>()
    val stdField = LinkedHashMap<String, Double>()
    var sumSL = 0.0
    var sumSS = 0.0
    var sumSC = 0.0
    var sumSF = 0.0

    val eligibleByBase = top100Species.associateBy { FormResolver.extractBaseSpecies(it).lowercase() }
    stdLogsForCup.sortedByDescending { it.first }.forEachIndexed { idx, (_, opps) ->
        val recW = kotlin.math.exp(-lambda * idx.toDouble())
        val cleaned = opps.take(3).mapNotNull { raw ->
            val tr = raw.trim()
            if (tr.isEmpty() || tr.equals("Waiting...", ignoreCase = true)) null
            else candidateByName[tr.lowercase()]?.name ?: eligibleByBase[FormResolver.extractBaseSpecies(tr).lowercase()]
        }
        cleaned.getOrNull(0)?.let { o0 ->
            stdLead[o0] = (stdLead[o0] ?: 0.0) + recW
            sumSL += recW
        }
        cleaned.getOrNull(1)?.let { o1 ->
            stdSwap[o1] = (stdSwap[o1] ?: 0.0) + recW
            sumSS += recW
        }
        cleaned.getOrNull(2)?.let { o2 ->
            stdCloser[o2] = (stdCloser[o2] ?: 0.0) + recW
            sumSC += recW
        }
        cleaned.forEach { op ->
            stdField[op] = (stdField[op] ?: 0.0) + recW
            sumSF += recW
        }
    }

    val rawWHist = if (nMatches > 0) maxLogW * min(1.0, nMatches.toDouble() / 50.0) else 0.0
    val remAfterHist = (1.0 - rawWHist).coerceAtLeast(0.0)
    val stdBlendMaxW = (activeLimitedStdBlendPctGbl.coerceIn(0, 100)) / 100.0
    val stdDecayBeta = activeLimitedStdDecayGbl.toDouble().coerceIn(0.01, 0.30)
    val rawWStd = if (isLimCup && sumSF > 0.0) {
        min(remAfterHist, stdBlendMaxW * kotlin.math.exp(-stdDecayBeta * nMatches.toDouble()))
    } else 0.0
    val rawWMeta = (remAfterHist - rawWStd).coerceAtLeast(0.0)
    val sumWeights = (rawWHist + rawWStd + rawWMeta).takeIf { it > 0.0 } ?: 1.0
    val wHist = rawWHist / sumWeights
    val wStd = rawWStd / sumWeights
    val wMeta = rawWMeta / sumWeights

    val allSpecies = (top100Species + histField.keys + histLead.keys + stdField.keys).distinct()

    fun blendRoleMap(
        synMap: Map<String, Double>,
        hMap: Map<String, Double>,
        hSum: Double,
        sMap: Map<String, Double>,
        sSum: Double
    ): Map<String, Double> {
        val out = LinkedHashMap<String, Double>()
        var total = 0.0
        for (sp in allSpecies) {
            val mP = synMap[sp] ?: 0.0
            val hP = when {
                hSum > 0.0 -> (hMap[sp] ?: 0.0) / hSum
                sumHF > 0.0 -> (histField[sp] ?: 0.0) / sumHF
                else -> mP
            }
            val sP = when {
                sSum > 0.0 -> (sMap[sp] ?: 0.0) / sSum
                sumSF > 0.0 -> (stdField[sp] ?: 0.0) / sumSF
                else -> mP
            }
            val v = wHist * hP + wStd * sP + wMeta * mP
            if (v > 0.0) {
                out[sp] = v
                total += v
            }
        }
        val denom = if (total > 0.0) total else 1.0
        return out.mapValues { it.value / denom }
    }

    val leadWeights = blendRoleMap(pSynL, histLead, sumHL, stdLead, sumSL)
    val swapWeights = blendRoleMap(pSynS, histSwap, sumHS, stdSwap, sumSS)
    val closerWeights = blendRoleMap(pSynC, histCloser, sumHC, stdCloser, sumSC)
    val fieldWeights = blendRoleMap(pSynF, histField, sumHF, stdField, sumSF)

    val sortedField = fieldWeights.entries.sortedByDescending { it.value }.map { it.key }
    val top50Threats = sortedField.take(50).ifEmpty { top100Species.take(50) }
    val top25Threats = top50Threats.take(25).ifEmpty { top100Species.take(25) }
    val refOpps = top25Threats.take(12).ifEmpty { top100Species.take(12) }

    val top50MetaList = top50Threats.mapIndexed { i, name ->
        val pct = ((fieldWeights[name] ?: 0.0) * 1000.0).roundToInt() / 10.0
        val cand = candidateByName[name.lowercase()]
        var sumBr = 0.0
        var wSum = 0.0
        for (opp in refOpps) {
            if (opp.equals(name, ignoreCase = true)) continue
            val w = fieldWeights[opp] ?: 0.04
            val b11 = calculateMatchupRatingStatic(
                name, opp, 1, 1, normLeague,
                cand?.fastMove, cand?.chargedMove1, cand?.chargedMove2,
                cand?.cp, cand?.ivs
            ).toDouble()
            sumBr += w * b11
            wSum += w
        }
        val rawAvgBr = if (wSum > 0.0) sumBr / wSum else (542.0 - i * 1.1)
        val rankPrior = 548.0 - i * 1.05
        val metaBr = (0.60 * rawAvgBr + 0.40 * rankPrior).roundToInt().coerceIn(420, 650)
        SilphScopeTopMetaEntry(rank = i + 1, name = name, weightPct = pct, metaBr = metaBr)
    }
    val top25MetaList = top50MetaList.take(25)

    return RoleWeightedTop100MetaDist(
        leadWeights = leadWeights,
        swapWeights = swapWeights,
        closerWeights = closerWeights,
        fieldWeights = fieldWeights,
        top25Threats = top25Threats,
        top25MetaList = top25MetaList,
        top50Threats = top50Threats,
        top50MetaList = top50MetaList,
        top100Species = top100Species,
        wHistPct = (wHist * 100.0).roundToInt(),
        wMetaPct = (wMeta * 100.0).roundToInt(),
        seasonMatchCount = nMatches
    )
}

/**
 * Generates the Best 5 ABB and Best 5 ABC Anti-Meta team options for the selected league
 * that MUST include the 0, 1, or 2 user-selected featured Pokémon (or rank-range queries
 * such as `200-`, `-10`, `100-200`), building around performance against the Top-100
 * role-weighted synthetic meta blended with season logs, auditing Beats X/25 Top Meta
 * (plus Key Wins, Key Threats & Core Breakers with per-slot BRs in parentheses), and
 * simulating alternate Fast + Charged movesets for all 3 team members on top candidate lineups.
 */
internal fun OverlayService.Companion.generateAntiMetaTeamOptionsStatic(
    league: String,
    featuredPokemonNames: List<String>,
    seasonLogs: List<Pair<Long, List<String>>> = emptyList()
): AntiMetaTeamBuilderResult {
    val t0 = System.currentTimeMillis()
    val normLeague = normalizeLeagueKeyStatic(league)
    val allowMega = isMegaAllowedInLeagueStatic(normLeague)
    val cpCap = getLeagueCpCapStatic(normLeague)
    val isGreat = cpCap <= 1500
    val isUltra = cpCap == 2500

    val roleMeta = computeRoleWeightedTop100MetaStatic(normLeague, seasonLogs)
    val extendedRankedPool = getTop100MetaCandidatesForLeagueStatic(normLeague, 360)
    val rankByNameLower = HashMap<String, Int>(extendedRankedPool.size)
    extendedRankedPool.forEachIndexed { index, member ->
        rankByNameLower.putIfAbsent(member.name.lowercase(), index + 1)
    }
    val topMetaPool = extendedRankedPool.take(60)
    val top25MetaThreats = roleMeta.top25Threats
    val top50MetaThreats = roleMeta.top50Threats
    val targetAuditTotal = top50MetaThreats.size.takeIf { it > 0 } ?: 50

    fun isMegaOrPrimal(name: String, speciesId: String = ""): Boolean {
        return isMegaOrPrimalSpeciesStatic(name) || isMegaOrPrimalSpeciesStatic(speciesId)
    }

    fun buildMemberFromName(rawName: String): TeamMember? {
        val trimmed = rawName.trim()
        if (trimmed.isEmpty()) return null
        val resolved = resolveRecommendedMovesForSpecies(trimmed, normLeague) ?: return null
        if (!allowMega && isMegaOrPrimal(resolved.name, resolved.speciesId)) return null
        val scaled = computeEffectiveCombatStats(resolved, normLeague)
        val finalDisplayName = if (trimmed.startsWith("Shadow ", ignoreCase = true) && !scaled.name.startsWith("Shadow ", ignoreCase = true)) {
            "Shadow ${scaled.name}"
        } else {
            scaled.name
        }
        val ivDefault = when {
            isGreat -> scaled.defaultIvsGl
            isUltra -> scaled.defaultIvsUl
            else -> "15/15/15"
        }
        return TeamMember(
            name = finalDisplayName,
            cp = scaled.defaultCp,
            fastMove = scaled.defaultFastMove,
            chargedMove1 = scaled.chargedMove1,
            chargedMove2 = scaled.chargedMove2,
            ivs = ivDefault
        )
    }

    data class ResolvedFeaturedSlotConstraint(
        val isRange: Boolean,
        val displayLabel: String,
        val fixedMember: TeamMember? = null,
        val rangeSpec: FeaturedRankRangeSpec? = null,
        val rangePool: List<TeamMember> = emptyList()
    )

    val slotConstraints = ArrayList<ResolvedFeaturedSlotConstraint>(2)
    val featuredBaseSet = HashSet<String>()
    var featuredHasMega = false

    for (raw in featuredPokemonNames.take(2)) {
        val trimmed = raw.trim()
        if (trimmed.isEmpty()) continue
        val parsedRange = parseFeaturedRankRangeQueryStatic(trimmed)
        if (parsedRange != null) {
            val minIdx = (parsedRange.minRank - 1).coerceAtLeast(0)
            val maxIdx = min(extendedRankedPool.size - 1, parsedRange.maxRank - 1)
            val subList = if (minIdx <= maxIdx && extendedRankedPool.isNotEmpty()) {
                extendedRankedPool.subList(minIdx, maxIdx + 1)
            } else {
                extendedRankedPool.takeLast(min(20, extendedRankedPool.size))
            }
            val pickedRangeMembers = subList.take(18)
            if (pickedRangeMembers.isNotEmpty()) {
                slotConstraints.add(
                    ResolvedFeaturedSlotConstraint(
                        isRange = true,
                        displayLabel = parsedRange.label,
                        rangeSpec = parsedRange,
                        rangePool = pickedRangeMembers
                    )
                )
            }
            continue
        }

        val member = buildMemberFromName(trimmed) ?: continue
        val baseSp = FormResolver.extractBaseSpecies(member.name).lowercase()
        if (!featuredBaseSet.add(baseSp)) continue
        val memberIsMega = isMegaOrPrimal(member.name)
        if (memberIsMega && featuredHasMega) {
            featuredBaseSet.remove(baseSp)
            continue
        }
        if (memberIsMega) featuredHasMega = true
        slotConstraints.add(
            ResolvedFeaturedSlotConstraint(
                isRange = false,
                displayLabel = member.name,
                fixedMember = member
            )
        )
    }

    val resolvedFeatured = slotConstraints.mapNotNull { it.fixedMember }
    val rangeCandidates = slotConstraints.flatMap { it.rangePool }

    val candidatePool = ArrayList<TeamMember>(84)
    val seenNames = HashSet<String>()
    for (c in (resolvedFeatured + rangeCandidates + topMetaPool)) {
        val k = c.name.lowercase()
        if (seenNames.add(k)) {
            candidatePool.add(c)
        }
    }

    val allOpps = (roleMeta.leadWeights.keys + roleMeta.fieldWeights.keys + top50MetaThreats).distinct()

    data class CandidateSlotEval(
        val member: TeamMember,
        val baseSpecies: String,
        val isMega: Boolean,
        val weaknesses: List<String>,
        val doubleWeaknesses: List<String>,
        val resistances: List<String>,
        val leadBr: Int,
        val swapBr: Int,
        val closerBr: Int,
        val leadByOpp: Map<String, Double>,
        val swapByOpp: Map<String, Double>,
        val closerByOpp: Map<String, Double>
    )

    fun evaluateCandidateAgainstRoleMeta(
        cand: TeamMember,
        baseSpecies: String,
        isMega: Boolean,
        weaknesses: List<String>,
        doubleWeaknesses: List<String>,
        resistances: List<String>
    ): CandidateSlotEval {
        val leadByOpp = HashMap<String, Double>(allOpps.size)
        val swapByOpp = HashMap<String, Double>(allOpps.size)
        val closerByOpp = HashMap<String, Double>(allOpps.size)

        for (opp in allOpps) {
            val b00 = calculateMatchupRatingStatic(cand.name, opp, 0, 0, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b01 = calculateMatchupRatingStatic(cand.name, opp, 0, 1, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b10 = calculateMatchupRatingStatic(cand.name, opp, 1, 0, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b11 = calculateMatchupRatingStatic(cand.name, opp, 1, 1, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b12 = calculateMatchupRatingStatic(cand.name, opp, 1, 2, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b21 = calculateMatchupRatingStatic(cand.name, opp, 2, 1, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()
            val b22 = calculateMatchupRatingStatic(cand.name, opp, 2, 2, normLeague, cand.fastMove, cand.chargedMove1, cand.chargedMove2, cand.cp, cand.ivs).toDouble()

            leadByOpp[opp] = 0.45 * b11 + 0.35 * b22 + 0.10 * b00 + 0.05 * b12 + 0.05 * b21
            swapByOpp[opp] = 0.40 * b11 + 0.20 * b10 + 0.20 * b01 + 0.10 * b21 + 0.10 * b00
            closerByOpp[opp] = 0.50 * b00 + 0.20 * b10 + 0.15 * b01 + 0.15 * b11
        }

        var leadSum = 0.0
        for ((oppName, prob) in roleMeta.leadWeights) {
            if (prob > 0.0) leadSum += prob * (leadByOpp[oppName] ?: 500.0)
        }
        var swapMean = 0.0
        for ((oppName, prob) in roleMeta.swapWeights) {
            if (prob > 0.0) swapMean += prob * (swapByOpp[oppName] ?: 500.0)
        }
        var swapVar = 0.0
        for ((oppName, prob) in roleMeta.swapWeights) {
            if (prob > 0.0) {
                val d = (swapByOpp[oppName] ?: swapMean) - swapMean
                swapVar += prob * d * d
            }
        }
        val swapSigma = kotlin.math.sqrt(max(0.0, swapVar))
        val safeSwapVal = (swapMean - 0.35 * swapSigma).roundToInt().coerceIn(150, 850)

        var closerSum = 0.0
        for ((oppName, prob) in roleMeta.closerWeights) {
            if (prob > 0.0) closerSum += prob * (closerByOpp[oppName] ?: 500.0)
        }

        return CandidateSlotEval(
            member = cand,
            baseSpecies = baseSpecies,
            isMega = isMega,
            weaknesses = weaknesses,
            doubleWeaknesses = doubleWeaknesses,
            resistances = resistances,
            leadBr = leadSum.roundToInt().coerceIn(150, 850),
            swapBr = safeSwapVal,
            closerBr = closerSum.roundToInt().coerceIn(150, 850),
            leadByOpp = leadByOpp,
            swapByOpp = swapByOpp,
            closerByOpp = closerByOpp
        )
    }

    val slotEvalCache = HashMap<String, CandidateSlotEval>(candidatePool.size)

    for (cand in candidatePool) {
        val key = cand.name.lowercase()
        val baseSpecies = FormResolver.extractBaseSpecies(cand.name).lowercase()
        val meta = resolveRecommendedMovesForSpecies(cand.name, normLeague)
        val types = meta?.types?.map { it.lowercase() }?.ifEmpty { listOf("normal") } ?: listOf("normal")

        val weaknesses = ArrayList<String>()
        val doubleWeaknesses = ArrayList<String>()
        val resistances = ArrayList<String>()
        for (atkType in ALL_18_TYPES) {
            val m = getTypeEffectivenessStatic(atkType, types)
            if (m > 1.9) {
                weaknesses.add(atkType)
                doubleWeaknesses.add(atkType)
            } else if (m > 1.05) {
                weaknesses.add(atkType)
            } else if (m < 0.95) {
                resistances.add(atkType)
            }
        }

        slotEvalCache[key] = evaluateCandidateAgainstRoleMeta(
            cand = cand,
            baseSpecies = baseSpecies,
            isMega = isMegaOrPrimal(cand.name),
            weaknesses = weaknesses,
            doubleWeaknesses = doubleWeaknesses,
            resistances = resistances
        )
    }

    fun buildTeamOptionFromEvals(
        m0: CandidateSlotEval,
        m1: CandidateSlotEval,
        m2: CandidateSlotEval,
        archetype: String,
        sharedWeaks: List<String>,
        idPrefix: String,
        sig: String,
        altMovesetSlots: List<AntiMetaAltMovesetInfo> = emptyList()
    ): AntiMetaTeamOption {
        var coreSum = 0.0
        for ((oppName, prob) in roleMeta.fieldWeights) {
            if (prob <= 0.0) continue
            val r0 = m0.leadByOpp[oppName] ?: 500.0
            val r1 = m1.swapByOpp[oppName] ?: 500.0
            val r2 = m2.closerByOpp[oppName] ?: 500.0
            coreSum += prob * max(r0, max(r1, r2))
        }
        val machineAggBr = coreSum.roundToInt().coerceIn(150, 850)

        val beatenTargets = ArrayList<String>()
        val coreBreakers = ArrayList<String>()
        val coreBreakerSpecies = HashSet<String>()
        val keyThreats = ArrayList<String>()

        fun formatThreatWithSlotBrs(threatName: String, r0: Double, r1: Double, r2: Double): String {
            val oppBr0 = (1000.0 - r0).roundToInt().coerceIn(100, 900)
            val oppBr1 = (1000.0 - r1).roundToInt().coerceIn(100, 900)
            val oppBr2 = (1000.0 - r2).roundToInt().coerceIn(100, 900)
            return "$threatName($oppBr0/$oppBr1/$oppBr2)"
        }

        for (threat in top50MetaThreats) {
            val r0 = m0.leadByOpp[threat] ?: 500.0
            val r1 = m1.swapByOpp[threat] ?: 500.0
            val r2 = m2.closerByOpp[threat] ?: 500.0
            val maxBr = max(r0, max(r1, r2))
            val minBackBr = min(r1, r2)
            val formattedThreat = formatThreatWithSlotBrs(threat, r0, r1, r2)

            if (maxBr >= 525.0) {
                beatenTargets.add(threat)
            }

            if (r0 < 495.0 && r1 < 495.0 && r2 < 495.0) {
                coreBreakers.add(formattedThreat)
                coreBreakerSpecies.add(threat)
            } else if ((r0 < 475.0 && minBackBr < 485.0) || maxBr < 512.0) {
                keyThreats.add(formattedThreat)
            }
        }

        if (keyThreats.isEmpty()) {
            val sortedTough = top50MetaThreats
                .filter { it !in coreBreakerSpecies }
                .map { t ->
                    val r0 = m0.leadByOpp[t] ?: 500.0
                    val r1 = m1.swapByOpp[t] ?: 500.0
                    val r2 = m2.closerByOpp[t] ?: 500.0
                    formatThreatWithSlotBrs(t, r0, r1, r2) to (min(r0, (r1 + r2) / 2.0) + max(r0, max(r1, r2)) * 0.35)
                }
                .sortedBy { it.second }
            for ((formatted, _) in sortedTough.take(3)) {
                keyThreats.add(formatted)
            }
        }

        var unresistedTripleWeakPenalty = 0.0
        for (atkType in ALL_18_TYPES) {
            val weakCount = listOf(m0, m1, m2).count { atkType in it.weaknesses }
            val resistCount = listOf(m0, m1, m2).count { atkType in it.resistances }
            if (weakCount >= 2 && resistCount == 0) {
                unresistedTripleWeakPenalty += if (weakCount == 3) 35.0 else 14.0
            }
        }

        val duoSymmetryBonus = if (archetype == "DUO") sharedWeaks.size * 4.5 else 0.0
        val rawComposite = 0.48 * machineAggBr.toDouble() +
            0.20 * m0.leadBr.toDouble() +
            0.16 * m1.swapBr.toDouble() +
            0.16 * m2.closerBr.toDouble() +
            beatenTargets.size * 1.65 +
            duoSymmetryBonus -
            coreBreakers.size * 7.5 -
            keyThreats.size * 1.8 -
            (if (archetype == "ABC" || archetype == "DUO") unresistedTripleWeakPenalty else 0.0)
        val compositeAntiMetaScore = (rawComposite * 10.0).roundToInt() / 10.0

        val winsPreview = beatenTargets.take(5).joinToString(", ").ifEmpty { "Broad neutral coverage" }
        val threatsPreview = keyThreats.take(4).joinToString(", ").ifEmpty { "None prominent" }
        val breakersPreview = if (coreBreakers.isNotEmpty()) {
            coreBreakers.take(4).joinToString(", ")
        } else {
            "None (0 hard core breakers in Top 50)"
        }
        val altNotes = altMovesetSlots
            .filter { it.isAltMoveset }
            .map {
            val plusMove = resolveMegaPlusMoveStatic(it.pokemonName, league)
            val plusTag = if (plusMove != null) " + $plusMove [Mega4]" else ""
            "${it.pokemonName} (${it.fastMove} + ${it.chargedMove1}/${it.chargedMove2}$plusTag)"
        }
        val altSuffix = if (altNotes.isNotEmpty()) " • Alt Moveset Tech: ${altNotes.joinToString("; ")}." else ""

        val teamMembers = listOf(m0.member, m1.member, m2.member)
        val matchedFeaturedNames = ArrayList<String>()
        val matchedFeaturedRanks = LinkedHashMap<String, Int>()
        for (constraint in slotConstraints) {
            if (!constraint.isRange && constraint.fixedMember != null) {
                val fn = constraint.fixedMember.name
                if (teamMembers.any { it.name.equals(fn, ignoreCase = true) }) {
                    matchedFeaturedNames.add(fn)
                    rankByNameLower[fn.lowercase()]?.let { r -> matchedFeaturedRanks[fn] = r }
                }
            } else if (constraint.isRange && constraint.rangeSpec != null) {
                val rangeNamesLower = constraint.rangePool.map { it.name.lowercase() }.toSet()
                val matched = teamMembers.firstOrNull { it.name.lowercase() in rangeNamesLower }
                if (matched != null && matched.name !in matchedFeaturedNames) {
                    matchedFeaturedNames.add(matched.name)
                    rankByNameLower[matched.name.lowercase()]?.let { r -> matchedFeaturedRanks[matched.name] = r }
                }
            }
        }

        val synergySummary = when (archetype) {
            "ABB" -> "ABB Lineup: ${m0.member.name} (Lead A) covers backline ${sharedWeaks.joinToString("/") { it.uppercase() }} weakness for ${m1.member.name} (Bait B1) & ${m2.member.name} (Sweeper B2). Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
            "DUO" -> {
                val covStr = if (sharedWeaks.isNotEmpty()) " (${sharedWeaks.joinToString("/") { it.uppercase() }} covered)" else ""
                "Duo-Core (Yin-Yang 1⇄3): ${m0.member.name} (Core 1 Lead, ${m0.leadBr} BR) & ${m2.member.name} (Core 2 Co-Core, ${m2.closerBr} BR) mutually cover each other's weaknesses$covStr, with ${m1.member.name} (${m1.swapBr} BR) as the Safe Swap Pivot. Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
            }
            else -> "ABC Balanced Core: ${m0.member.name} Lead (${m0.leadBr} BR) + ${m1.member.name} Safe Swap (${m1.swapBr} BR) + ${m2.member.name} Closer (${m2.closerBr} BR). Beats ${beatenTargets.size}/$targetAuditTotal Top Meta. Key Wins: $winsPreview. Key Threats: $threatsPreview. Core Breakers: $breakersPreview.$altSuffix"
        }

        return AntiMetaTeamOption(
            id = "$idPrefix-$sig",
            archetype = archetype,
            rank = 0,
            league = normLeague,
            pokemon = teamMembers,
            featuredNamesIncluded = matchedFeaturedNames,
            featuredRankMap = matchedFeaturedRanks,
            leadAggBr = m0.leadBr,
            machineAggBr = machineAggBr,
            safeSwapBr = m1.swapBr,
            closerSwapBr = m2.swapBr,
            closerBr = m2.closerBr,
            sharedWeaknesses = sharedWeaks,
            compositeAntiMetaScore = compositeAntiMetaScore,
            topMetaTargetsTotal = targetAuditTotal,
            topMetaWinsCount = beatenTargets.size,
            keyMetaTargetsBeaten = beatenTargets.take(6),
            keyThreats = keyThreats.take(5),
            coreBreakers = coreBreakers.take(5),
            altMovesetSlots = altMovesetSlots,
            synergySummary = synergySummary
        )
    }

    val abbCandidates = ArrayList<AntiMetaTeamOption>()
    val abcCandidates = ArrayList<AntiMetaTeamOption>()
    val duoCandidates = ArrayList<AntiMetaTeamOption>()
    val seenTrios = HashSet<String>()
    var candidatesEvaluated = 0

    val triosToEvaluate = ArrayList<Triple<TeamMember, TeamMember, TeamMember>>()
    val topStandardPool = topMetaPool.take(40)

    fun addValidTrioIfLegal(c1: TeamMember, c2: TeamMember, c3: TeamMember) {
        val e1 = slotEvalCache[c1.name.lowercase()] ?: return
        val e2 = slotEvalCache[c2.name.lowercase()] ?: return
        val e3 = slotEvalCache[c3.name.lowercase()] ?: return
        if (e1.baseSpecies == e2.baseSpecies || e1.baseSpecies == e3.baseSpecies || e2.baseSpecies == e3.baseSpecies) return
        val megaCount = (if (e1.isMega) 1 else 0) + (if (e2.isMega) 1 else 0) + (if (e3.isMega) 1 else 0)
        if (megaCount > 1) return
        triosToEvaluate.add(Triple(c1, c2, c3))
    }

    when (slotConstraints.size) {
        2 -> {
            val poolA = if (slotConstraints[0].isRange) slotConstraints[0].rangePool.take(12) else listOfNotNull(slotConstraints[0].fixedMember)
            val poolB = if (slotConstraints[1].isRange) slotConstraints[1].rangePool.take(12) else listOfNotNull(slotConstraints[1].fixedMember)
            val thirdPool = if (slotConstraints[0].isRange && slotConstraints[1].isRange) topStandardPool.take(18) else candidatePool.take(45)
            for (f1 in poolA) {
                for (f2 in poolB) {
                    for (c3 in thirdPool) {
                        addValidTrioIfLegal(f1, f2, c3)
                    }
                }
            }
        }
        1 -> {
            val c0 = slotConstraints[0]
            val poolA = if (c0.isRange) c0.rangePool.take(14) else listOfNotNull(c0.fixedMember)
            val partnerLimit = if (c0.isRange) min(22, topStandardPool.size) else min(48, candidatePool.size)
            val partnerPool = if (c0.isRange) topStandardPool else candidatePool
            for (f1 in poolA) {
                for (i in 0 until partnerLimit) {
                    val c2 = partnerPool[i]
                    for (j in (i + 1) until partnerLimit) {
                        val c3 = partnerPool[j]
                        addValidTrioIfLegal(f1, c2, c3)
                    }
                }
            }
        }
        else -> {
            val poolLimit = min(32, candidatePool.size)
            for (i in 0 until poolLimit) {
                val c1 = candidatePool[i]
                for (j in (i + 1) until poolLimit) {
                    val c2 = candidatePool[j]
                    val maxK = if (i < 10) min(50, candidatePool.size) else poolLimit
                    for (k in (j + 1) until maxK) {
                        val c3 = candidatePool[k]
                        addValidTrioIfLegal(c1, c2, c3)
                    }
                }
            }
        }
    }

    val indexPermutations = listOf(
        Triple(0, 1, 2),
        Triple(1, 0, 2),
        Triple(2, 0, 1)
    )
    val all6Perms = listOf(
        Triple(0, 1, 2),
        Triple(0, 2, 1),
        Triple(1, 0, 2),
        Triple(1, 2, 0),
        Triple(2, 0, 1),
        Triple(2, 1, 0)
    )

    for (trio in triosToEvaluate) {
        val list3 = listOf(trio.first, trio.second, trio.third)
        val sig = list3.map { it.name.lowercase() }.sorted().joinToString("||")
        if (!seenTrios.add(sig)) continue
        candidatesEvaluated++

        val e0 = slotEvalCache[list3[0].name.lowercase()] ?: continue
        val e1 = slotEvalCache[list3[1].name.lowercase()] ?: continue
        val e2 = slotEvalCache[list3[2].name.lowercase()] ?: continue
        val evals = listOf(e0, e1, e2)

        var bestAbbOrder: Triple<Int, Int, Int>? = null
        var bestAbbShared: List<String> = emptyList()
        var bestAbbStructureScore = Double.NEGATIVE_INFINITY

        for ((leadIdx, bI, bJ) in indexPermutations) {
            val wI = evals[bI].weaknesses.toSet()
            val shared = evals[bJ].weaknesses.filter { it in wI }
            if (shared.isEmpty()) continue

            val hasSharedDouble = shared.any { w ->
                w in evals[bI].doubleWeaknesses || w in evals[bJ].doubleWeaknesses
            }
            val hasCritical = shared.any { it in CRITICAL_META_TYPES }
            val qualifiesOverlap = shared.size >= 2 || (shared.size >= 1 && (hasSharedDouble || hasCritical))
            if (!qualifiesOverlap) continue

            val leadResists = evals[leadIdx].resistances.toSet()
            val leadWeaks = evals[leadIdx].weaknesses.toSet()
            val resistedByLead = shared.filter { it in leadResists }
            val leadNotWeak = shared.all { it !in leadWeaks }

            if (resistedByLead.isNotEmpty() && leadNotWeak) {
                val b1First = evals[bI].swapBr >= evals[bJ].swapBr
                val ordered = if (b1First) Triple(leadIdx, bI, bJ) else Triple(leadIdx, bJ, bI)
                val sScore = resistedByLead.size * 40.0 +
                    shared.size * 25.0 +
                    evals[ordered.first].leadBr * 0.40 +
                    evals[ordered.second].swapBr * 0.35 +
                    evals[ordered.third].closerBr * 0.25
                if (sScore > bestAbbStructureScore) {
                    bestAbbStructureScore = sScore
                    bestAbbOrder = ordered
                    bestAbbShared = shared
                }
            }
        }

        var bestAbcOrder = Triple(0, 1, 2)
        var bestAbcRoleSum = Double.NEGATIVE_INFINITY
        for ((lIdx, sIdx, cIdx) in all6Perms) {
            val roleSum = 0.40 * evals[lIdx].leadBr + 0.32 * evals[sIdx].swapBr + 0.28 * evals[cIdx].closerBr
            if (roleSum > bestAbcRoleSum) {
                bestAbcRoleSum = roleSum
                bestAbcOrder = Triple(lIdx, sIdx, cIdx)
            }
        }

        // Evaluate Symmetric Yin-Yang Duo-Core (1st & 3rd cover each other's weaknesses; 2nd is Safe Swap Pivot)
        var bestDuoOrder: Triple<Int, Int, Int>? = null
        var bestDuoCovered: List<String> = emptyList()
        var bestDuoStructureScore = Double.NEGATIVE_INFINITY

        for ((pivotIdx, cI, cJ) in indexPermutations) {
            val wI = evals[cI].weaknesses.toSet()
            val wJ = evals[cJ].weaknesses.toSet()
            if (wI.intersect(wJ).isNotEmpty()) continue // Core partners cannot share an unresisted weakness
            val rI = evals[cI].resistances.toSet()
            val rJ = evals[cJ].resistances.toSet()
            val coveredByI = wJ.filter { it in rI }
            val coveredByJ = wI.filter { it in rJ }
            if (coveredByI.isNotEmpty() && coveredByJ.isNotEmpty() && (coveredByI.size + coveredByJ.size) >= 3) {
                val c1First = (evals[cI].leadBr + evals[cJ].closerBr) >= (evals[cJ].leadBr + evals[cI].closerBr)
                val ordered = if (c1First) Triple(cI, pivotIdx, cJ) else Triple(cJ, pivotIdx, cI)
                val dScore = (coveredByI.size + coveredByJ.size) * 32.0 +
                    evals[ordered.first].leadBr * 0.35 +
                    evals[ordered.second].swapBr * 0.38 +
                    evals[ordered.third].closerBr * 0.27
                if (dScore > bestDuoStructureScore) {
                    bestDuoStructureScore = dScore
                    bestDuoOrder = ordered
                    bestDuoCovered = (coveredByI + coveredByJ).distinct()
                }
            }
        }

        if (bestDuoOrder != null) {
            duoCandidates.add(
                buildTeamOptionFromEvals(
                    evals[bestDuoOrder.first],
                    evals[bestDuoOrder.second],
                    evals[bestDuoOrder.third],
                    "DUO",
                    bestDuoCovered,
                    "anti-meta-duo",
                    sig
                )
            )
        }

        if (bestAbbOrder != null) {
            abbCandidates.add(
                buildTeamOptionFromEvals(
                    evals[bestAbbOrder.first],
                    evals[bestAbbOrder.second],
                    evals[bestAbbOrder.third],
                    "ABB",
                    bestAbbShared,
                    "anti-meta-abb",
                    sig
                )
            )
        } else {
            abcCandidates.add(
                buildTeamOptionFromEvals(
                    evals[bestAbcOrder.first],
                    evals[bestAbcOrder.second],
                    evals[bestAbcOrder.third],
                    "ABC",
                    emptyList(),
                    "anti-meta-abc",
                    sig
                )
            )
        }
    }

    if (abbCandidates.size < 8 || abcCandidates.size < 8 || duoCandidates.size < 8) {
        for (trio in triosToEvaluate.take(90)) {
            val list3 = listOf(trio.first, trio.second, trio.third)
            val e0 = slotEvalCache[list3[0].name.lowercase()] ?: continue
            val e1 = slotEvalCache[list3[1].name.lowercase()] ?: continue
            val e2 = slotEvalCache[list3[2].name.lowercase()] ?: continue
            val evals = listOf(e0, e1, e2)
            val sig = list3.map { it.name.lowercase() }.sorted().joinToString("||")

            if (abbCandidates.size < 8 && abbCandidates.none { it.id.endsWith(sig) }) {
                for ((leadIdx, bI, bJ) in indexPermutations) {
                    val wI = evals[bI].weaknesses.toSet()
                    val shared = evals[bJ].weaknesses.filter { it in wI }
                    if (shared.isNotEmpty()) {
                        val ordered = if (evals[bI].swapBr >= evals[bJ].swapBr) Triple(leadIdx, bI, bJ) else Triple(leadIdx, bJ, bI)
                        abbCandidates.add(
                            buildTeamOptionFromEvals(
                                evals[ordered.first],
                                evals[ordered.second],
                                evals[ordered.third],
                                "ABB",
                                shared,
                                "anti-meta-abb-fallback",
                                sig
                            )
                        )
                        break
                    }
                }
            }

            if (duoCandidates.size < 8 && duoCandidates.none { it.id.endsWith(sig) }) {
                for ((pivotIdx, cI, cJ) in indexPermutations) {
                    val wI = evals[cI].weaknesses.toSet()
                    val wJ = evals[cJ].weaknesses.toSet()
                    val rI = evals[cI].resistances.toSet()
                    val rJ = evals[cJ].resistances.toSet()
                    val covered = (wJ.filter { it in rI } + wI.filter { it in rJ }).distinct()
                    if (covered.size >= 2 && wI.intersect(wJ).size <= 1) {
                        val ordered = if (evals[cI].leadBr >= evals[cJ].leadBr) Triple(cI, pivotIdx, cJ) else Triple(cJ, pivotIdx, cI)
                        duoCandidates.add(
                            buildTeamOptionFromEvals(
                                evals[ordered.first],
                                evals[ordered.second],
                                evals[ordered.third],
                                "DUO",
                                covered,
                                "anti-meta-duo-fallback",
                                sig
                            )
                        )
                        break
                    }
                }
            }

            if (abcCandidates.size < 8 && abcCandidates.none { it.id.endsWith(sig) }) {
                val m0 = e0
                val m1 = if (e1.swapBr >= e2.swapBr) e1 else e2
                val m2 = if (e1.swapBr >= e2.swapBr) e2 else e1
                abcCandidates.add(
                    buildTeamOptionFromEvals(m0, m1, m2, "ABC", emptyList(), "anti-meta-abc-fallback", sig)
                )
            }
        }
    }

    abbCandidates.sortByDescending { it.compositeAntiMetaScore }
    abcCandidates.sortByDescending { it.compositeAntiMetaScore }
    duoCandidates.sortByDescending { it.compositeAntiMetaScore }

    fun pickTopDiverseFinalists(list: List<AntiMetaTeamOption>, maxCount: Int): List<AntiMetaTeamOption> {
        val picked = ArrayList<AntiMetaTeamOption>(maxCount)
        val memberUsage = HashMap<String, Int>()
        val nonFeaturedLimit = if (slotConstraints.size == 2 && slotConstraints.none { it.isRange }) maxCount else 2

        for (item in list) {
            if (picked.size >= maxCount) break
            val nonFeaturedNames = item.pokemon
                .map { it.name.lowercase() }
                .filter { n -> resolvedFeatured.none { f -> f.name.equals(n, ignoreCase = true) } }
            val overused = nonFeaturedNames.any { n -> (memberUsage[n] ?: 0) >= nonFeaturedLimit }
            if (overused && list.size - picked.size > maxCount) continue
            for (n in nonFeaturedNames) {
                memberUsage[n] = (memberUsage[n] ?: 0) + 1
            }
            picked.add(item)
        }

        if (picked.size < maxCount) {
            for (item in list) {
                if (picked.size >= maxCount) break
                if (picked.any { it.id == item.id }) continue
                picked.add(item)
            }
        }
        return picked
    }

    // Stage 2: 3-Slot Alternate Moveset Simulation & Optimizer on top finalists
    var movesetCombosSimulated = 0
    val movesetVariantCache = HashMap<String, CandidateSlotEval>()

    fun getOrComputeMovesetVariantEval(
        baseEval: CandidateSlotEval,
        fMove: String,
        c1Move: String,
        c2Move: String
    ): CandidateSlotEval {
        val cPairKey = listOf(c1Move.lowercase(), c2Move.lowercase()).sorted().joinToString("+")
        val stdPairKey = listOf(
            baseEval.member.chargedMove1.lowercase(),
            baseEval.member.chargedMove2.lowercase()
        ).sorted().joinToString("+")
        if (fMove.equals(baseEval.member.fastMove, ignoreCase = true) && cPairKey == stdPairKey) {
            return baseEval
        }
        val cacheKey = "${baseEval.member.name.lowercase()}|${fMove.lowercase()}|$cPairKey"
        movesetVariantCache[cacheKey]?.let { return it }

        movesetCombosSimulated++
        val variantMember = baseEval.member.copy(
            fastMove = fMove,
            chargedMove1 = c1Move,
            chargedMove2 = c2Move
        )
        val computed = evaluateCandidateAgainstRoleMeta(
            cand = variantMember,
            baseSpecies = baseEval.baseSpecies,
            isMega = baseEval.isMega,
            weaknesses = baseEval.weaknesses,
            doubleWeaknesses = baseEval.doubleWeaknesses,
            resistances = baseEval.resistances
        )
        movesetVariantCache[cacheKey] = computed
        return computed
    }

    fun optimizeTeamOptionMovesets(option: AntiMetaTeamOption): AntiMetaTeamOption {
        val b0 = slotEvalCache[option.pokemon.getOrNull(0)?.name?.lowercase() ?: ""] ?: return option
        val b1 = slotEvalCache[option.pokemon.getOrNull(1)?.name?.lowercase() ?: ""] ?: return option
        val b2 = slotEvalCache[option.pokemon.getOrNull(2)?.name?.lowercase() ?: ""] ?: return option
        val baseEvals = listOf(b0, b1, b2)
        val curEvals = mutableListOf(b0, b1, b2)
        val roleLabels = when (option.archetype) {
            "ABB" -> listOf("Lead (A)", "Bait Swap (B1)", "Sweeper (B2)")
            "DUO" -> listOf("Lead (Core 1)", "Pivot (Swap)", "Co-Core (Core 2)")
            else -> listOf("Lead", "Safe Swap", "Closer")
        }

        for (slotIdx in 0..2) {
            val stdEval = baseEvals[slotIdx]
            val (rawFast, rawCharged) = getAvailableMovePoolForSpeciesStatic(stdEval.member.name, normLeague)
            val fastPool = rawFast
                .filter { it.isNotBlank() && !it.equals("Struggle", ignoreCase = true) }
                .distinctBy { it.lowercase() }
                .take(3)
                .ifEmpty { listOf(stdEval.member.fastMove) }
            val chargedPool = rawCharged
                .filter {
                    it.isNotBlank() &&
                        !it.equals("Struggle", ignoreCase = true) &&
                        !it.equals("Frustration", ignoreCase = true)
                }
                .distinctBy { it.lowercase() }
                .take(5)
                .ifEmpty { listOf(stdEval.member.chargedMove1, stdEval.member.chargedMove2).distinctBy { it.lowercase() } }

            val rawChargedPairs = ArrayList<Pair<String, String>>()
            if (chargedPool.size <= 1) {
                val only = chargedPool.firstOrNull() ?: stdEval.member.chargedMove1
                rawChargedPairs.add(only to only)
            } else {
                for (i in 0 until chargedPool.size) {
                    for (j in (i + 1) until chargedPool.size) {
                        rawChargedPairs.add(chargedPool[i] to chargedPool[j])
                    }
                }
            }
            val stdTypes = resolveRecommendedMovesForSpecies(stdEval.member.name, normLeague)?.types ?: emptyList()
            val nonDomPairs = rawChargedPairs.filterNot { (c1, c2) ->
                isDominatedSameTypeChargedPairStatic(c1, c2, stdTypes)
            }
            val chargedPairs = if (nonDomPairs.isNotEmpty()) nonDomPairs else rawChargedPairs
            val hasDualTypeOption = chargedPairs.any { (c1, c2) ->
                val t1 = resolveChargedMoveStatsStatic(c1, stdTypes.firstOrNull() ?: "normal").type
                val t2 = resolveChargedMoveStatsStatic(c2, stdTypes.firstOrNull() ?: "normal").type
                !t1.equals(t2, ignoreCase = true)
            }

            var bestSlotEval = curEvals[slotIdx]
            val baselineTeam = buildTeamOptionFromEvals(
                curEvals[0],
                curEvals[1],
                curEvals[2],
                option.archetype,
                option.sharedWeaknesses,
                option.id,
                "opt"
            )
            var bestScore = baselineTeam.compositeAntiMetaScore

            for (fMove in fastPool) {
                for ((c1, c2) in chargedPairs) {
                    val candEval = getOrComputeMovesetVariantEval(stdEval, fMove, c1, c2)
                    if (candEval === stdEval) continue

                    val t0Eval = if (slotIdx == 0) candEval else curEvals[0]
                    val t1Eval = if (slotIdx == 1) candEval else curEvals[1]
                    val t2Eval = if (slotIdx == 2) candEval else curEvals[2]
                    val trialTeam = buildTeamOptionFromEvals(
                        t0Eval,
                        t1Eval,
                        t2Eval,
                        option.archetype,
                        option.sharedWeaknesses,
                        option.id,
                        "opt"
                    )
                    val c1S = resolveChargedMoveStatsStatic(c1, stdTypes.firstOrNull() ?: "normal")
                    val c2S = resolveChargedMoveStatsStatic(c2, stdTypes.firstOrNull() ?: "normal")
                    val isSameTypePair = !c1.equals(c2, ignoreCase = true) && c1S.type.equals(c2S.type, ignoreCase = true)
                    val roleAdj = if (isSameTypePair && slotIdx == 1 && hasDualTypeOption) -1.2 else 0.0
                    val effectiveTrialScore = trialTeam.compositeAntiMetaScore + roleAdj
                    if (effectiveTrialScore > bestScore + 0.4) {
                        bestScore = effectiveTrialScore
                        bestSlotEval = candEval
                    }
                }
            }
            curEvals[slotIdx] = bestSlotEval
        }

        val baseTeam = buildTeamOptionFromEvals(
            baseEvals[0],
            baseEvals[1],
            baseEvals[2],
            option.archetype,
            option.sharedWeaknesses,
            option.id,
            "base"
        )

        val altSlots = (0..2).map { sIdx ->
            val stdM = baseEvals[sIdx].member
            val optM = curEvals[sIdx].member
            val stdPair = listOf(stdM.chargedMove1.lowercase(), stdM.chargedMove2.lowercase()).sorted().joinToString("+")
            val optPair = listOf(optM.chargedMove1.lowercase(), optM.chargedMove2.lowercase()).sorted().joinToString("+")
            val isAlt = !stdM.fastMove.equals(optM.fastMove, ignoreCase = true) || stdPair != optPair
            val stdRoleBr = when (sIdx) {
                0 -> baseEvals[0].leadBr
                1 -> baseEvals[1].swapBr
                else -> baseEvals[2].closerBr
            }
            val optRoleBr = when (sIdx) {
                0 -> curEvals[0].leadBr
                1 -> curEvals[1].swapBr
                else -> curEvals[2].closerBr
            }
            AntiMetaAltMovesetInfo(
                slotIndex = sIdx,
                roleLabel = roleLabels[sIdx],
                pokemonName = optM.name,
                isAltMoveset = isAlt,
                standardFastMove = stdM.fastMove,
                standardCharged1 = stdM.chargedMove1,
                standardCharged2 = stdM.chargedMove2,
                fastMove = optM.fastMove,
                chargedMove1 = optM.chargedMove1,
                chargedMove2 = optM.chargedMove2,
                roleBrDelta = optRoleBr - stdRoleBr,
                coreBrDelta = 0
            )
        }

        val finalTeam = buildTeamOptionFromEvals(
            curEvals[0],
            curEvals[1],
            curEvals[2],
            option.archetype,
            option.sharedWeaknesses,
            option.id,
            "final",
            altSlots
        )
        val coreDelta = finalTeam.machineAggBr - baseTeam.machineAggBr
        return finalTeam.copy(
            id = option.id,
            altMovesetSlots = altSlots.map { a ->
                if (a.isAltMoveset) a.copy(coreBrDelta = coreDelta) else a
            }
        )
    }

    val abbFinalists = pickTopDiverseFinalists(abbCandidates, 6).map { optimizeTeamOptionMovesets(it) }
        .sortedByDescending { it.compositeAntiMetaScore }
    val abcFinalists = pickTopDiverseFinalists(abcCandidates, 6).map { optimizeTeamOptionMovesets(it) }
        .sortedByDescending { it.compositeAntiMetaScore }
    val duoFinalists = pickTopDiverseFinalists(duoCandidates, 6).map { optimizeTeamOptionMovesets(it) }
        .sortedByDescending { it.compositeAntiMetaScore }

    val top5Abb = abbFinalists.take(5).mapIndexed { idx, item -> item.copy(rank = idx + 1) }
    val top5Abc = abcFinalists.take(5).mapIndexed { idx, item -> item.copy(rank = idx + 1) }
    val top5Duo = duoFinalists.take(5).mapIndexed { idx, item -> item.copy(rank = idx + 1) }
    val elapsed = max(1L, System.currentTimeMillis() - t0)

    return AntiMetaTeamBuilderResult(
        league = normLeague,
        leagueAbbr = getLeagueAbbreviationStatic(normLeague),
        featuredPokemon = slotConstraints.map { it.displayLabel },
        top5AbbTeams = top5Abb,
        top5AbcTeams = top5Abc,
        top5DuoTeams = top5Duo,
        candidatesEvaluated = candidatesEvaluated,
        movesetCombosSimulated = movesetCombosSimulated,
        metaTargetCount = targetAuditTotal,
        top25MetaNames = roleMeta.top25Threats,
        top25MetaList = roleMeta.top25MetaList,
        top50MetaList = roleMeta.top50MetaList,
        metaSummaryLabel = "Top-100 Flattened Role-Weighted Synthetic Meta (${roleMeta.wMetaPct}% PvPoke Role Meta / ${roleMeta.wHistPct}% Season Logs • Auditing Top $targetAuditTotal Threats)",
        elapsedMs = elapsed
    )
}
