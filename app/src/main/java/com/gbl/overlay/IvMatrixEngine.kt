package com.gbl.overlay

import com.gbl.overlay.OverlayService.Companion.CPM_TABLE
import com.gbl.overlay.OverlayService.Companion.PokemonMeta
import com.gbl.overlay.OverlayService.Companion.getLeagueCpCapStatic
import com.gbl.overlay.OverlayService.Companion.normalizeLeagueKeyStatic
import java.util.UUID
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * IvMatrixEngine.kt — Roadmap #6 & #7 Shared Math Engine
 * Evaluates 4,096 IV spreads, Ranks, Stat Products, Multi-IV Matrix comparisons vs.
 * Rank #1 Stat Product & Candidate IVs, Breakpoints, Bulkpoints, CMP tie flips,
 * and Built Pokémon Roster matching helpers.
 */
object IvMatrixEngine {

    const val PINNED_RANK1_CANDIDATE_ID: String = "__RANK_1_BENCHMARK__"

    enum class IvPresetMode {
        RANK_1,
        PVPOKE_DEFAULT,
        HUNDO,
        MAX_ATK
    }

    enum class OppMetaPoolMode {
        PVPOKE_TOP_100,
        BLENDED_ELO_META
    }

    enum class OppIvBaselineMode {
        RANK_1,
        PVPOKE_DEFAULT,
        MAX_ATK
    }

    enum class ShieldScopeMode {
        REALISTIC_7,
        EVEN_3
    }

    val EVEN_3_SHIELD_KEYS: List<String> = listOf("0v0", "1v1", "2v2")
    val REALISTIC_7_SHIELD_KEYS: List<String> = listOf("0v0", "1v1", "2v2", "1v0", "0v1", "2v1", "1v2")

    data class IvSpreadEvalDetails(
        val atkIv: Int,
        val defIv: Int,
        val staIv: Int,
        val ivs: String,
        val cp: Int,
        val level: Double,
        val cpm: Double,
        val effAtk: Double,
        val effDef: Double,
        val effHp: Int,
        val statProduct: Double,
        val rank: Int,
        val pctOfRank1: Double
    )

    private data class CachedSpeciesRankTable(
        val byIndex: Array<IvSpreadEvalDetails>,
        val rank1: IvSpreadEvalDetails,
        val maxAtk: IvSpreadEvalDetails,
        val hundo: IvSpreadEvalDetails
    )

    private val rankTableLock: Any = Any()
    private val ivRankTableCache: LinkedHashMap<String, CachedSpeciesRankTable> =
        object : LinkedHashMap<String, CachedSpeciesRankTable>(64, 0.75f, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedSpeciesRankTable>?): Boolean {
                return size > 120
            }
        }

    fun cleanSpeciesNameWithoutShadow(rawName: String): Pair<String, Boolean> {
        val trimmed = rawName.trim()
        val isShadow = trimmed.startsWith("Shadow ", ignoreCase = true) ||
            trimmed.contains("(Shadow)", ignoreCase = true)
        val clean = trimmed
            .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
            .trim()
        return clean to isShadow
    }

    fun formatSpeciesDisplayName(cleanName: String, isShadow: Boolean): String {
        val (base, _) = cleanSpeciesNameWithoutShadow(cleanName)
        return if (isShadow) "Shadow $base" else base
    }

    private fun resolveRawSpeciesMeta(rawName: String): PokemonMeta? {
        val (cleanName, _) = cleanSpeciesNameWithoutShadow(rawName)
        if (cleanName.isBlank()) return null
        val allMeta: List<PokemonMeta> = OverlayService.getAllPokemonMeta()
        val exact = allMeta.firstOrNull {
            it.name.equals(cleanName, ignoreCase = true) ||
                it.speciesId.equals(cleanName.replace(" ", "_"), ignoreCase = true)
        }
        if (exact != null) return exact
        val partial = allMeta.firstOrNull {
            it.name.contains(cleanName, ignoreCase = true) ||
                it.baseSpecies.equals(cleanName, ignoreCase = true)
        }
        return partial
    }

    private fun getOrBuildIvRankTable(
        meta: PokemonMeta,
        league: String,
        isBestBuddy: Boolean
    ): CachedSpeciesRankTable {
        val cpCap = OverlayService.getLeagueCpCapStatic(league)
        val leagueCap = when {
            cpCap <= 500 -> 500
            cpCap <= 1500 -> 1500
            cpCap == 2500 -> 2500
            else -> 10000
        }
        val maxLvl = if (isBestBuddy) 51.0 else 50.0
        val cacheKey = "${meta.speciesId}|$leagueCap|${if (isBestBuddy) 1 else 0}"
        synchronized(rankTableLock) {
            ivRankTableCache[cacheKey]?.let { return it }
        }

        val rawBase: PokemonMeta = if (meta.isRawBaseStats) meta else resolveRawSpeciesMeta(meta.name) ?: meta
        val tempList: ArrayList<IvSpreadEvalDetails> = ArrayList(4096)

        for (a in 0..15) {
            val uAtk = (rawBase.atk + a).coerceAtLeast(20.0)
            for (d in 0..15) {
                val uDef = (rawBase.def + d).coerceAtLeast(20.0)
                for (s in 0..15) {
                    val uHp = (rawBase.hp.toDouble() + s).coerceAtLeast(20.0)
                    val (lvl, cpm, cp) = OverlayService.solveLeagueLevelAndCpm(uAtk, uDef, uHp, leagueCap, maxLvl)
                    val effAtk = uAtk * cpm
                    val effDef = uDef * cpm
                    val effHp = floor(uHp * cpm).toInt().coerceAtLeast(10)
                    val sp = effAtk * effDef * effHp.toDouble()
                    tempList.add(
                        IvSpreadEvalDetails(
                            atkIv = a,
                            defIv = d,
                            staIv = s,
                            ivs = "$a/$d/$s",
                            cp = cp,
                            level = lvl,
                            cpm = cpm,
                            effAtk = (effAtk * 100.0).roundToInt() / 100.0,
                            effDef = (effDef * 100.0).roundToInt() / 100.0,
                            effHp = effHp,
                            statProduct = (sp * 100.0).roundToInt() / 100.0,
                            rank = 1,
                            pctOfRank1 = 100.0
                        )
                    )
                }
            }
        }

        val sorted = tempList.sortedWith { x, y ->
            when {
                kotlin.math.abs(y.statProduct - x.statProduct) > 1e-6 -> y.statProduct.compareTo(x.statProduct)
                y.cp != x.cp -> y.cp.compareTo(x.cp)
                else -> y.effAtk.compareTo(x.effAtk)
            }
        }

        val bestSp = sorted.firstOrNull()?.statProduct?.coerceAtLeast(1e-6) ?: 1.0
        val rankedArr: Array<IvSpreadEvalDetails> = Array(4096) { sorted[0] }
        var maxAtkItem = sorted[0]

        for (i in sorted.indices) {
            val item = sorted[i]
            val rankedItem = item.copy(
                rank = i + 1,
                pctOfRank1 = ((item.statProduct / bestSp) * 10000.0).roundToInt() / 100.0
            )
            rankedArr[rankedItem.atkIv * 256 + rankedItem.defIv * 16 + rankedItem.staIv] = rankedItem
            if (rankedItem.effAtk > maxAtkItem.effAtk + 1e-6 ||
                (kotlin.math.abs(rankedItem.effAtk - maxAtkItem.effAtk) <= 1e-6 && rankedItem.statProduct > maxAtkItem.statProduct)
            ) {
                maxAtkItem = rankedItem
            }
        }

        val hundoItem = rankedArr[15 * 256 + 15 * 16 + 15]
        val table = CachedSpeciesRankTable(
            byIndex = rankedArr,
            rank1 = rankedArr[sorted[0].atkIv * 256 + sorted[0].defIv * 16 + sorted[0].staIv],
            maxAtk = maxAtkItem,
            hundo = hundoItem
        )
        synchronized(rankTableLock) {
            ivRankTableCache[cacheKey] = table
        }
        return table
    }

    fun evaluateIvSpreadDetails(
        speciesName: String,
        atkIv: Int,
        defIv: Int,
        staIv: Int,
        league: String = "GREAT LEAGUE",
        isBestBuddy: Boolean = false
    ): IvSpreadEvalDetails? {
        val meta = resolveRawSpeciesMeta(speciesName) ?: return null
        val a = atkIv.coerceIn(0, 15)
        val d = defIv.coerceIn(0, 15)
        val s = staIv.coerceIn(0, 15)
        val table = getOrBuildIvRankTable(meta, league, isBestBuddy)
        return table.byIndex[a * 256 + d * 16 + s]
    }

    fun getPresetIvSpread(
        speciesName: String,
        league: String = "GREAT LEAGUE",
        preset: IvPresetMode = IvPresetMode.RANK_1,
        isBestBuddy: Boolean = false
    ): IvSpreadEvalDetails? {
        val meta = resolveRawSpeciesMeta(speciesName) ?: return null
        if (preset == IvPresetMode.PVPOKE_DEFAULT) {
            val (a, d, s) = OverlayService.parseIvTriplet(null, league, meta)
            return evaluateIvSpreadDetails(meta.name, a, d, s, league, isBestBuddy)
        }
        val table = getOrBuildIvRankTable(meta, league, isBestBuddy)
        return when (preset) {
            IvPresetMode.RANK_1 -> table.rank1
            IvPresetMode.HUNDO -> table.hundo
            IvPresetMode.MAX_ATK -> table.maxAtk
            IvPresetMode.PVPOKE_DEFAULT -> table.rank1
        }
    }

    fun findMatchingBuiltPokemon(
        roster: List<BuiltPokemonEntry>,
        rawSpeciesName: String,
        league: String,
        preferredShadow: Boolean? = null
    ): List<BuiltPokemonEntry> {
        if (roster.isEmpty() || rawSpeciesName.isBlank()) return emptyList()
        val (cleanName, detectedShadow) = cleanSpeciesNameWithoutShadow(rawSpeciesName)
        val targetShadow = preferredShadow ?: detectedShadow
        val targetCap = OverlayService.getLeagueCpCapStatic(league)
        val resolvedMeta = resolveRawSpeciesMeta(cleanName)
        val normTarget = (resolvedMeta?.name ?: cleanName).lowercase()

        return roster.filter { entry ->
            if (entry.speciesName.isBlank()) return@filter false
            if (entry.isShadow != targetShadow) return@filter false
            if (OverlayService.getLeagueCpCapStatic(entry.league) != targetCap) return@filter false
            val entryClean = cleanSpeciesNameWithoutShadow(entry.speciesName).first.lowercase()
            entryClean == normTarget || entryClean == cleanName.lowercase()
        }.sortedByDescending { it.updatedAt }
    }

    fun builtPokemonToSlot(entry: BuiltPokemonEntry): PokemonSlot {
        val display = formatSpeciesDisplayName(entry.speciesName, entry.isShadow)
        return PokemonSlot(
            name = display,
            cp = entry.cp,
            fastMove = entry.fastMove,
            chargedMove1 = entry.chargedMove1,
            chargedMove2 = entry.chargedMove2,
            ivs = entry.ivs.ifBlank { "${entry.atkIv}/${entry.defIv}/${entry.staIv}" },
            plusMoveLevel = entry.plusMoveLevel ?: 4,
            isBestBuddy = entry.isBestBuddy,
            builtPokemonId = entry.id
        )
    }

    fun slotToBuiltPokemon(
        slot: PokemonSlot,
        league: String,
        label: String? = null,
        existingId: String? = null
    ): BuiltPokemonEntry? {
        val (cleanName, isShadow) = cleanSpeciesNameWithoutShadow(slot.name)
        if (cleanName.isBlank()) return null
        val meta = resolveRawSpeciesMeta(cleanName)
        val canonicalClean = meta?.name ?: cleanName
        val normLeague = OverlayService.normalizeLeagueKeyStatic(league)
        val (a, d, s) = if (meta != null) {
            OverlayService.parseIvTriplet(slot.ivs, normLeague, meta)
        } else {
            val cpCap = OverlayService.getLeagueCpCapStatic(normLeague)
            if (cpCap > 2500) Triple(15, 15, 15) else Triple(1, 15, 15)
        }
        val isBb = slot.isBestBuddy == true
        val details = evaluateIvSpreadDetails(canonicalClean, a, d, s, normLeague, isBb)
        val rec = OverlayService.resolveRecommendedMovesForSpecies(
            formatSpeciesDisplayName(canonicalClean, isShadow),
            normLeague,
            null,
            "$a/$d/$s",
            isBb
        )
        return BuiltPokemonEntry(
            id = existingId?.ifBlank { null }
                ?: slot.builtPokemonId?.ifBlank { null }
                ?: "bp_${UUID.randomUUID().toString().take(12)}",
            speciesName = canonicalClean,
            isShadow = isShadow,
            atkIv = a,
            defIv = d,
            staIv = s,
            ivs = "$a/$d/$s",
            league = normLeague,
            cpCap = OverlayService.getLeagueCpCapStatic(normLeague),
            cp = details?.cp ?: slot.cp.takeIf { it > 0 } ?: rec?.defaultCp ?: 1500,
            level = details?.level ?: 40.0,
            isBestBuddy = isBb,
            fastMove = slot.fastMove.ifBlank { rec?.defaultFastMove ?: "" },
            chargedMove1 = slot.chargedMove1.ifBlank { rec?.chargedMove1 ?: "" },
            chargedMove2 = slot.chargedMove2.ifBlank { rec?.chargedMove2 ?: "" },
            plusMoveLevel = slot.plusMoveLevel ?: 4,
            label = label?.trim()?.takeIf { it.isNotEmpty() },
            statProductRank = details?.rank,
            statProductPct = details?.pctOfRank1,
            updatedAt = System.currentTimeMillis()
        )
    }

    // =========================================================================
    // MULTI-IV MATRIX EVALUATION (ROADMAP #6)
    // =========================================================================

    data class IvCandidateConfig(
        val id: String,
        val label: String,
        val speciesName: String,
        val isShadow: Boolean,
        val atkIv: Int,
        val defIv: Int,
        val staIv: Int,
        val isBestBuddy: Boolean = false,
        val fastMove: String = "",
        val chargedMove1: String = "",
        val chargedMove2: String = "",
        val plusMoveLevel: Int = 4,
        val isPinnedRank1: Boolean = false
    )

    data class ShieldRecordSummary(
        val wins: Int,
        val losses: Int,
        val ties: Int,
        val avgBr: Int,
        val weightedWinPct: Double
    )

    data class ScenarioFlipDetail(
        val scenario: String,
        val flipCode: String,
        val beforeBr: Int,
        val afterBr: Int,
        val deltaBr: Int,
        val isGain: Boolean
    )

    data class ScenarioOutlierDetail(
        val scenario: String,
        val beforeBr: Int,
        val afterBr: Int,
        val deltaBr: Int,
        val beforeTierLabel: String,
        val afterTierLabel: String,
        val isUpgrade: Boolean
    )

    data class IvOpponentBreakdown(
        val oppName: String,
        val oppIvs: String,
        val oppCp: Int,
        val oppWeight: Double,
        val br0v0: Int,
        val br1v1: Int,
        val br2v2: Int,
        val baselineBr0v0: Int,
        val baselineBr1v1: Int,
        val baselineBr2v2: Int,
        val flip0v0: String, // "L->W" | "W->L" | "T->W" | "W->T" | "L->T" | "T->L" | "NONE"
        val flip1v1: String,
        val flip2v2: String,
        val brByShield: Map<String, Int>,
        val baselineBrByShield: Map<String, Int>,
        val flipsByShield: Map<String, String>,
        val userFastMoveName: String,
        val oppFastMoveName: String,
        val fastDmgDealt: Int,
        val baselineFastDmgDealt: Int,
        val fastBreakpointDelta: Int,
        val fastDmgTaken: Int,
        val baselineFastDmgTaken: Int,
        val fastBulkpointDelta: Int,
        val survivesExtraChargedCycle: Boolean,
        val losesExtraChargedCycle: Boolean,
        val userEffectiveAtk: Double,
        val baselineUserEffectiveAtk: Double,
        val oppEffectiveAtk: Double,
        val cmpStatus: String, // "WIN" | "TIE" | "LOSS"
        val baselineCmpStatus: String, // "WIN" | "TIE" | "LOSS"
        val cmpFlip: String // "GAINED" | "LOST" | "NONE"
    )

    data class IvCandidateLeagueResult(
        val candidateId: String,
        val label: String,
        val speciesName: String,
        val displayName: String,
        val isShadow: Boolean,
        val isBestBuddy: Boolean,
        val isPinnedRank1: Boolean,
        val atkIv: Int,
        val defIv: Int,
        val staIv: Int,
        val ivs: String,
        val cp: Int,
        val level: Double,
        val effAtk: Double,
        val effDef: Double,
        val effHp: Int,
        val statProduct: Double,
        val rank: Int,
        val pctOfRank1: Double,
        val league: String,
        val fastMove: String,
        val chargedMove1: String,
        val chargedMove2: String,
        val rec0v0: ShieldRecordSummary,
        val rec1v1: ShieldRecordSummary,
        val rec2v2: ShieldRecordSummary,
        val deltaWinsVsRank1: Int,
        val deltaBr1v1VsRank1: Int,
        val deltaWinsVsBaseline: Int,
        val deltaBr1v1VsBaseline: Int,
        val breakpointsGainedCount: Int,
        val breakpointsLostCount: Int,
        val bulkpointsGainedCount: Int,
        val bulkpointsLostCount: Int,
        val cmpFlipsGainedCount: Int,
        val cmpFlipsLostCount: Int,
        val extraCycleSurvivedCount: Int,
        val opponents: List<IvOpponentBreakdown>
    )

    data class MultiIvLeagueMatrix(
        val league: String,
        val oppMetaPool: OppMetaPoolMode,
        val oppIvBaseline: OppIvBaselineMode,
        val opponentCount: Int,
        val baselineComparisonId: String,
        val baselineLabel: String,
        val candidateResults: List<IvCandidateLeagueResult>
    )

    data class MultiIvMatrixResult(
        val leagues: List<MultiIvLeagueMatrix>,
        val computedAtMs: Long
    )

    private fun calculateFastDmgRaw(
        atkMeta: PokemonMeta,
        defMeta: PokemonMeta,
        fastMoveName: String,
        isAtkShadow: Boolean,
        isDefShadow: Boolean
    ): Int {
        val (cleanName, _) = cleanSpeciesNameWithoutShadow(atkMeta.name)
        val isShieldAegislash = cleanName.contains("aegislash", ignoreCase = true) && atkMeta.atk < atkMeta.def
        if (isShieldAegislash) return 1
        val key = fastMoveName.lowercase().trim()
        val power = OverlayService.resolveFastPowerStatic(key, atkMeta.fastTurns)
        val moveType = OverlayService.resolveFastTypeStatic(key, atkMeta.types.firstOrNull() ?: "normal")
        val stab = if (atkMeta.types.any { it.equals(moveType, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = OverlayService.getTypeEffectivenessStatic(moveType, defMeta.types)
        val atk = atkMeta.atk * (if (isAtkShadow) 1.2 else 1.0)
        val def = defMeta.def * (if (isDefShadow) 0.8333333 else 1.0)
        return floor(0.5 * power * (atk / def) * stab * typeEff * 1.3).toInt() + 1
    }

    private fun calculateChargedDmgRaw(
        atkMeta: PokemonMeta,
        defMeta: PokemonMeta,
        moveName: String,
        isAtkShadow: Boolean,
        isDefShadow: Boolean
    ): Int {
        val stats = OverlayService.resolveChargedMoveStatsStatic(moveName, atkMeta.types.firstOrNull() ?: "normal")
        val stab = if (atkMeta.types.any { it.equals(stats.type, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = OverlayService.getTypeEffectivenessStatic(stats.type, defMeta.types)
        val atk = atkMeta.atk * (if (isAtkShadow) 1.2 else 1.0)
        val def = defMeta.def * (if (isDefShadow) 0.8333333 else 1.0)
        return floor(0.5 * stats.power * (atk / def) * stab * typeEff * 1.3).toInt() + 1
    }

    private fun classifyFlip(curBr: Int, baseBr: Int): String {
        val curSign = when {
            curBr > 500 -> 1
            curBr < 500 -> -1
            else -> 0
        }
        val baseSign = when {
            baseBr > 500 -> 1
            baseBr < 500 -> -1
            else -> 0
        }
        if (curSign == baseSign) return "NONE"
        return when {
            baseSign < 0 && curSign > 0 -> "L->W"
            baseSign > 0 && curSign < 0 -> "W->L"
            baseSign == 0 && curSign > 0 -> "T->W"
            baseSign < 0 && curSign == 0 -> "L->T"
            baseSign > 0 && curSign == 0 -> "W->T"
            else -> "T->L"
        }
    }

    fun isPositiveFlip(code: String): Boolean {
        return code == "L->W" || code == "T->W" || code == "L->T"
    }

    fun isNegativeFlip(code: String): Boolean {
        return code == "W->L" || code == "W->T" || code == "T->L"
    }

    fun formatFlipCode(code: String): String {
        return code.replace("->", "→")
    }

    fun getShieldKeysForScope(scope: ShieldScopeMode): List<String> {
        return if (scope == ShieldScopeMode.EVEN_3) EVEN_3_SHIELD_KEYS else REALISTIC_7_SHIELD_KEYS
    }

    fun classifyMatchupSubTier(
        br: Int,
        swMin: Int = 620,
        wMin: Int = 530,
        lMax: Int = 470,
        slMax: Int = 380
    ): Pair<Int, String> {
        val effWMin = max(502, wMin)
        val effSwMin = max(effWMin + 1, swMin)
        val effLMax = min(498, lMax)
        val effSlMax = min(effLMax - 1, slMax)
        return when {
            br >= effSwMin -> 3 to "Strong W"
            br >= effWMin -> 2 to "Solid W"
            br >= 501 -> 1 to "Soft W"
            br == 500 -> 0 to "Tie"
            br > effLMax -> -1 to "Close L"
            br > effSlMax -> -2 to "Solid L"
            else -> -3 to "Strong L"
        }
    }

    fun getOpponentShieldFlips(
        opp: IvOpponentBreakdown,
        scope: ShieldScopeMode
    ): List<ScenarioFlipDetail> {
        val keys = getShieldKeysForScope(scope)
        val out = ArrayList<ScenarioFlipDetail>(keys.size)
        for (sc in keys) {
            val code = opp.flipsByShield[sc] ?: "NONE"
            if (code == "NONE") continue
            val beforeBr = opp.baselineBrByShield[sc] ?: opp.baselineBr1v1
            val afterBr = opp.brByShield[sc] ?: opp.br1v1
            out.add(
                ScenarioFlipDetail(
                    scenario = sc,
                    flipCode = code,
                    beforeBr = beforeBr,
                    afterBr = afterBr,
                    deltaBr = afterBr - beforeBr,
                    isGain = isPositiveFlip(code)
                )
            )
        }
        return out
    }

    fun getOpponentTierOutliers(
        opp: IvOpponentBreakdown,
        scope: ShieldScopeMode,
        minDeltaBr: Int = 40,
        swMin: Int = 620,
        wMin: Int = 530,
        lMax: Int = 470,
        slMax: Int = 380
    ): List<ScenarioOutlierDetail> {
        val keys = getShieldKeysForScope(scope)
        val out = ArrayList<ScenarioOutlierDetail>(keys.size)
        for (sc in keys) {
            val beforeBr = opp.baselineBrByShield[sc] ?: opp.baselineBr1v1
            val afterBr = opp.brByShield[sc] ?: opp.br1v1
            val sameBinarySide = (beforeBr > 500 && afterBr > 500) || (beforeBr < 500 && afterBr < 500)
            if (!sameBinarySide) continue
            val deltaBr = afterBr - beforeBr
            if (abs(deltaBr) < minDeltaBr) continue
            val (beforeBand, beforeLabel) = classifyMatchupSubTier(beforeBr, swMin, wMin, lMax, slMax)
            val (afterBand, afterLabel) = classifyMatchupSubTier(afterBr, swMin, wMin, lMax, slMax)
            if (beforeBand == afterBand) continue
            out.add(
                ScenarioOutlierDetail(
                    scenario = sc,
                    beforeBr = beforeBr,
                    afterBr = afterBr,
                    deltaBr = deltaBr,
                    beforeTierLabel = beforeLabel,
                    afterTierLabel = afterLabel,
                    isUpgrade = afterBand > beforeBand
                )
            )
        }
        return out
    }

    private data class PreparedOpp(
        val name: String,
        val ivs: String,
        val cp: Int,
        val isShadow: Boolean,
        val weight: Double,
        val meta: PokemonMeta,
        val primaryChargedMove: String
    )

    private data class PerOppCandSim(
        val brByShield: Map<String, Int>,
        val fastDmgDealt: Int,
        val fastDmgTaken: Int,
        val userFastMoveName: String,
        val oppFastMoveName: String,
        val userEffAtk: Double,
        val oppEffAtk: Double,
        val cmpStatus: String,
        val hpAfter1Charge: Int,
        val survives1ChargePlusFastCount: Int
    )

    private data class RawCandEval(
        val config: IvCandidateConfig,
        val details: IvSpreadEvalDetails,
        val displayName: String,
        val effMeta: PokemonMeta,
        val fastMove: String,
        val c1: String,
        val c2: String,
        val perOpp: List<PerOppCandSim>
    )

    fun runMultiIvMatrixEvaluation(
        speciesName: String,
        leagues: List<String>,
        candidates: List<IvCandidateConfig>,
        oppMetaPool: OppMetaPoolMode = OppMetaPoolMode.PVPOKE_TOP_100,
        oppIvBaseline: OppIvBaselineMode = OppIvBaselineMode.PVPOKE_DEFAULT,
        baselineComparisonId: String = PINNED_RANK1_CANDIDATE_ID,
        seasonLogs: List<Pair<Long, List<String>>> = emptyList(),
        maxOpponents: Int = 100
    ): MultiIvMatrixResult {
        val (speciesClean, defaultShadow) = cleanSpeciesNameWithoutShadow(speciesName)
        val uniqueLeagues = leagues.ifEmpty { listOf("GREAT LEAGUE") }
            .map { OverlayService.normalizeLeagueKeyStatic(it) }
            .distinct()
        val oppCap = maxOpponents.coerceIn(10, 100)
        val primaryCand = candidates.firstOrNull()
        val rank1Shadow = primaryCand?.isShadow ?: defaultShadow

        val leagueMatrices: List<MultiIvLeagueMatrix> = uniqueLeagues.map { league ->
            val topOpps = OverlayService.getTop100MetaCandidatesForLeagueStatic(league, oppCap)
            val blendedWeights: Map<String, Double> = if (oppMetaPool == OppMetaPoolMode.BLENDED_ELO_META) {
                OverlayService.computeBlendedSeasonMetaStatic(league, seasonLogs).fieldWeights
            } else {
                emptyMap()
            }

            var totalW = 0.0
            val rawOpps = topOpps.map { oppSlot ->
                val (oppClean, oppShad) = cleanSpeciesNameWithoutShadow(oppSlot.name)
                val ivPreset = when (oppIvBaseline) {
                    OppIvBaselineMode.RANK_1 -> IvPresetMode.RANK_1
                    OppIvBaselineMode.MAX_ATK -> IvPresetMode.MAX_ATK
                    OppIvBaselineMode.PVPOKE_DEFAULT -> IvPresetMode.PVPOKE_DEFAULT
                }
                val oppIvDet = getPresetIvSpread(oppClean, league, ivPreset, false)
                val oppIvs = oppIvDet?.ivs ?: oppSlot.ivs ?: "1/15/15"
                val oppCp = oppIvDet?.cp ?: oppSlot.cp
                val oppMeta = OverlayService.resolveRecommendedMovesForSpecies(
                    oppSlot.name,
                    league,
                    oppCp,
                    oppIvs,
                    false
                ) ?: OverlayService.computeEffectiveCombatStats(
                    resolveRawSpeciesMeta(oppClean) ?: OverlayService.getAllPokemonMeta().first(),
                    league,
                    oppCp,
                    oppIvs,
                    false
                )
                val c1Power = OverlayService.resolveChargedMoveStatsStatic(oppMeta.chargedMove1).power
                val c2Power = OverlayService.resolveChargedMoveStatsStatic(oppMeta.chargedMove2).power
                val primaryC = if (c1Power >= c2Power) oppMeta.chargedMove1 else oppMeta.chargedMove2
                val wRaw = if (oppMetaPool == OppMetaPoolMode.BLENDED_ELO_META) {
                    (blendedWeights[oppSlot.name]
                        ?: blendedWeights.entries.firstOrNull { it.key.equals(oppSlot.name, ignoreCase = true) || it.key.equals(oppClean, ignoreCase = true) }?.value
                        ?: 0.0005).coerceAtLeast(1e-5)
                } else {
                    1.0 / max(1, topOpps.size).toDouble()
                }
                totalW += wRaw
                PreparedOpp(
                    name = oppSlot.name,
                    ivs = oppIvs,
                    cp = oppCp,
                    isShadow = oppShad,
                    weight = wRaw,
                    meta = oppMeta,
                    primaryChargedMove = primaryC
                )
            }
            val preparedOpps = rawOpps.map { o ->
                if (totalW > 0.0) o.copy(weight = o.weight / totalW) else o
            }.let { list ->
                if (oppMetaPool == OppMetaPoolMode.BLENDED_ELO_META) list.sortedByDescending { it.weight } else list
            }

            val rank1Det = getPresetIvSpread(speciesClean, league, IvPresetMode.RANK_1, false)
                ?: evaluateIvSpreadDetails(speciesClean, 0, 15, 15, league, false)

            val pinnedRank1Cfg = IvCandidateConfig(
                id = PINNED_RANK1_CANDIDATE_ID,
                label = "🏆 Rank #1 Stat Product",
                speciesName = speciesClean,
                isShadow = rank1Shadow,
                atkIv = rank1Det?.atkIv ?: 0,
                defIv = rank1Det?.defIv ?: 15,
                staIv = rank1Det?.staIv ?: 15,
                isBestBuddy = false,
                fastMove = primaryCand?.fastMove.orEmpty(),
                chargedMove1 = primaryCand?.chargedMove1.orEmpty(),
                chargedMove2 = primaryCand?.chargedMove2.orEmpty(),
                plusMoveLevel = primaryCand?.plusMoveLevel ?: 4,
                isPinnedRank1 = true
            )

            val orderedCands = listOf(pinnedRank1Cfg) + candidates.filter { it.id != PINNED_RANK1_CANDIDATE_ID }

            val evals: List<RawCandEval> = orderedCands.mapNotNull { cfg ->
                val (cfgClean, _) = cleanSpeciesNameWithoutShadow(cfg.speciesName.ifBlank { speciesClean })
                val details = evaluateIvSpreadDetails(
                    cfgClean,
                    cfg.atkIv,
                    cfg.defIv,
                    cfg.staIv,
                    league,
                    cfg.isBestBuddy
                ) ?: return@mapNotNull null

                val display = formatSpeciesDisplayName(cfgClean, cfg.isShadow)
                val recMeta = OverlayService.resolveRecommendedMovesForSpecies(
                    display,
                    league,
                    details.cp,
                    details.ivs,
                    cfg.isBestBuddy
                ) ?: return@mapNotNull null

                val fastMove = cfg.fastMove.ifBlank { recMeta.defaultFastMove }
                val c1 = cfg.chargedMove1.ifBlank { recMeta.chargedMove1 }
                val c2 = cfg.chargedMove2.ifBlank { recMeta.chargedMove2 }

                val shieldPairs = listOf(
                    Triple("0v0", 0, 0),
                    Triple("1v1", 1, 1),
                    Triple("2v2", 2, 2),
                    Triple("1v0", 1, 0),
                    Triple("0v1", 0, 1),
                    Triple("2v1", 2, 1),
                    Triple("1v2", 1, 2)
                )

                val perOpp = preparedOpps.map { opp ->
                    val brByShield = LinkedHashMap<String, Int>(7)
                    for ((scKey, su, so) in shieldPairs) {
                        brByShield[scKey] = OverlayService.calculateMatchupRatingStatic(
                            myName = display,
                            oppName = opp.name,
                            userShields = su,
                            oppShields = so,
                            league = league,
                            myFastMove = fastMove,
                            myCharged1 = c1,
                            myCharged2 = c2,
                            myCp = details.cp,
                            myIvs = details.ivs,
                            myPlusMoveLevel = cfg.plusMoveLevel,
                            myIsBestBuddy = cfg.isBestBuddy,
                            oppIvs = opp.ivs,
                            oppCp = opp.cp
                        )
                    }

                    val fastDealt = calculateFastDmgRaw(recMeta, opp.meta, fastMove, cfg.isShadow, opp.isShadow)
                    val fastTaken = calculateFastDmgRaw(opp.meta, recMeta, opp.meta.defaultFastMove, opp.isShadow, cfg.isShadow)
                    val oppChargedDmg = calculateChargedDmgRaw(opp.meta, recMeta, opp.primaryChargedMove, opp.isShadow, cfg.isShadow)
                    val hpAfter1C = recMeta.hp - oppChargedDmg
                    val fastTurns = OverlayService.resolveFastTurnsStatic(opp.meta.defaultFastMove.lowercase(), opp.meta.fastTurns).coerceAtLeast(1)
                    val postCyc = if (hpAfter1C > 0) (hpAfter1C / max(1, fastTaken)) * fastTurns else 0

                    val cmpStatus = when {
                        recMeta.atk > opp.meta.atk + 0.05 -> "WIN"
                        recMeta.atk < opp.meta.atk - 0.05 -> "LOSS"
                        else -> "TIE"
                    }
                    PerOppCandSim(
                        brByShield = brByShield,
                        fastDmgDealt = fastDealt,
                        fastDmgTaken = fastTaken,
                        userFastMoveName = fastMove,
                        oppFastMoveName = opp.meta.defaultFastMove,
                        userEffAtk = (recMeta.atk * 100.0).roundToInt() / 100.0,
                        oppEffAtk = (opp.meta.atk * 100.0).roundToInt() / 100.0,
                        cmpStatus = cmpStatus,
                        hpAfter1Charge = hpAfter1C,
                        survives1ChargePlusFastCount = postCyc
                    )
                }

                RawCandEval(
                    config = cfg,
                    details = details,
                    displayName = display,
                    effMeta = recMeta,
                    fastMove = fastMove,
                    c1 = c1,
                    c2 = c2,
                    perOpp = perOpp
                )
            }

            val rank1Eval = evals.firstOrNull()
            val baseEval = evals.firstOrNull { it.config.id == baselineComparisonId } ?: rank1Eval

            fun summarize(list: List<PerOppCandSim>, selector: (PerOppCandSim) -> Int): ShieldRecordSummary {
                var w = 0
                var l = 0
                var t = 0
                var sum = 0
                var wPct = 0.0
                for (i in list.indices) {
                    val br = selector(list[i])
                    val weight = preparedOpps.getOrNull(i)?.weight ?: 0.0
                    sum += br
                    when {
                        br > 500 -> {
                            w += 1
                            wPct += weight
                        }
                        br < 500 -> l += 1
                        else -> {
                            t += 1
                            wPct += 0.5 * weight
                        }
                    }
                }
                val cnt = max(1, list.size)
                return ShieldRecordSummary(
                    wins = w,
                    losses = l,
                    ties = t,
                    avgBr = (sum.toDouble() / cnt).roundToInt(),
                    weightedWinPct = (wPct * 1000.0).roundToInt() / 10.0
                )
            }

            val rank1Summary1v1 = rank1Eval?.let { r1 -> summarize(r1.perOpp) { it.brByShield["1v1"] ?: 500 } }
            val baseSummary1v1 = baseEval?.let { b -> summarize(b.perOpp) { it.brByShield["1v1"] ?: 500 } }

            val results: List<IvCandidateLeagueResult> = evals.map { ev ->
                var brkGain = 0
                var brkLoss = 0
                var blkGain = 0
                var blkLoss = 0
                var cmpGain = 0
                var cmpLoss = 0
                var extraSurv = 0

                val oppList = preparedOpps.mapIndexed { idx, opp ->
                    val cur = ev.perOpp[idx]
                    val base = baseEval?.perOpp?.getOrNull(idx) ?: cur
                    val flipsByShield = LinkedHashMap<String, String>(7)
                    for (scKey in REALISTIC_7_SHIELD_KEYS) {
                        val cBr = cur.brByShield[scKey] ?: 500
                        val bBr = base.brByShield[scKey] ?: 500
                        flipsByShield[scKey] = classifyFlip(cBr, bBr)
                    }
                    val flip0 = flipsByShield["0v0"] ?: "NONE"
                    val flip1 = flipsByShield["1v1"] ?: "NONE"
                    val flip2 = flipsByShield["2v2"] ?: "NONE"

                    val brkDelta = cur.fastDmgDealt - base.fastDmgDealt
                    if (brkDelta > 0) brkGain += 1 else if (brkDelta < 0) brkLoss += 1

                    val blkDelta = base.fastDmgTaken - cur.fastDmgTaken
                    if (blkDelta > 0) blkGain += 1 else if (blkDelta < 0) blkLoss += 1

                    val cmpScore = { s: String -> when (s) { "WIN" -> 2; "TIE" -> 1; else -> 0 } }
                    val cmpDiff = cmpScore(cur.cmpStatus) - cmpScore(base.cmpStatus)
                    val cmpFlip = when {
                        cmpDiff > 0 -> "GAINED"
                        cmpDiff < 0 -> "LOST"
                        else -> "NONE"
                    }
                    if (cmpFlip == "GAINED") cmpGain += 1 else if (cmpFlip == "LOST") cmpLoss += 1

                    val baseHp = baseEval?.effMeta?.hp ?: ev.effMeta.hp
                    val curExtra = (cur.hpAfter1Charge > 0 && base.hpAfter1Charge <= 0) ||
                        (cur.hpAfter1Charge > 0 && base.hpAfter1Charge > 0 && cur.survives1ChargePlusFastCount > base.survives1ChargePlusFastCount) ||
                        (cur.fastDmgTaken < base.fastDmgTaken && ceil(ev.effMeta.hp / max(1, cur.fastDmgTaken).toDouble()) > ceil(baseHp / max(1, base.fastDmgTaken).toDouble()))
                    val baseExtra = !curExtra && ((base.hpAfter1Charge > 0 && cur.hpAfter1Charge <= 0) ||
                        (base.hpAfter1Charge > 0 && cur.hpAfter1Charge > 0 && base.survives1ChargePlusFastCount > cur.survives1ChargePlusFastCount) ||
                        (cur.fastDmgTaken > base.fastDmgTaken && ceil(baseHp / max(1, base.fastDmgTaken).toDouble()) > ceil(ev.effMeta.hp / max(1, cur.fastDmgTaken).toDouble())))
                    if (curExtra) extraSurv += 1

                    IvOpponentBreakdown(
                        oppName = opp.name,
                        oppIvs = opp.ivs,
                        oppCp = opp.cp,
                        oppWeight = opp.weight,
                        br0v0 = cur.brByShield["0v0"] ?: 500,
                        br1v1 = cur.brByShield["1v1"] ?: 500,
                        br2v2 = cur.brByShield["2v2"] ?: 500,
                        baselineBr0v0 = base.brByShield["0v0"] ?: 500,
                        baselineBr1v1 = base.brByShield["1v1"] ?: 500,
                        baselineBr2v2 = base.brByShield["2v2"] ?: 500,
                        flip0v0 = flip0,
                        flip1v1 = flip1,
                        flip2v2 = flip2,
                        brByShield = cur.brByShield,
                        baselineBrByShield = base.brByShield,
                        flipsByShield = flipsByShield,
                        userFastMoveName = cur.userFastMoveName,
                        oppFastMoveName = cur.oppFastMoveName,
                        fastDmgDealt = cur.fastDmgDealt,
                        baselineFastDmgDealt = base.fastDmgDealt,
                        fastBreakpointDelta = brkDelta,
                        fastDmgTaken = cur.fastDmgTaken,
                        baselineFastDmgTaken = base.fastDmgTaken,
                        fastBulkpointDelta = blkDelta,
                        survivesExtraChargedCycle = curExtra,
                        losesExtraChargedCycle = baseExtra,
                        userEffectiveAtk = cur.userEffAtk,
                        baselineUserEffectiveAtk = base.userEffAtk,
                        oppEffectiveAtk = cur.oppEffAtk,
                        cmpStatus = cur.cmpStatus,
                        baselineCmpStatus = base.cmpStatus,
                        cmpFlip = cmpFlip
                    )
                }

                val r0 = summarize(ev.perOpp) { it.brByShield["0v0"] ?: 500 }
                val r1 = summarize(ev.perOpp) { it.brByShield["1v1"] ?: 500 }
                val r2 = summarize(ev.perOpp) { it.brByShield["2v2"] ?: 500 }

                IvCandidateLeagueResult(
                    candidateId = ev.config.id,
                    label = ev.config.label,
                    speciesName = ev.config.speciesName,
                    displayName = ev.displayName,
                    isShadow = ev.config.isShadow,
                    isBestBuddy = ev.config.isBestBuddy,
                    isPinnedRank1 = ev.config.isPinnedRank1,
                    atkIv = ev.details.atkIv,
                    defIv = ev.details.defIv,
                    staIv = ev.details.staIv,
                    ivs = ev.details.ivs,
                    cp = ev.details.cp,
                    level = ev.details.level,
                    effAtk = (ev.effMeta.atk * 100.0).roundToInt() / 100.0,
                    effDef = (ev.effMeta.def * 100.0).roundToInt() / 100.0,
                    effHp = ev.effMeta.hp,
                    statProduct = ev.details.statProduct,
                    rank = ev.details.rank,
                    pctOfRank1 = ev.details.pctOfRank1,
                    league = league,
                    fastMove = ev.fastMove,
                    chargedMove1 = ev.c1,
                    chargedMove2 = ev.c2,
                    rec0v0 = r0,
                    rec1v1 = r1,
                    rec2v2 = r2,
                    deltaWinsVsRank1 = r1.wins - (rank1Summary1v1?.wins ?: r1.wins),
                    deltaBr1v1VsRank1 = r1.avgBr - (rank1Summary1v1?.avgBr ?: r1.avgBr),
                    deltaWinsVsBaseline = r1.wins - (baseSummary1v1?.wins ?: r1.wins),
                    deltaBr1v1VsBaseline = r1.avgBr - (baseSummary1v1?.avgBr ?: r1.avgBr),
                    breakpointsGainedCount = brkGain,
                    breakpointsLostCount = brkLoss,
                    bulkpointsGainedCount = blkGain,
                    bulkpointsLostCount = blkLoss,
                    cmpFlipsGainedCount = cmpGain,
                    cmpFlipsLostCount = cmpLoss,
                    extraCycleSurvivedCount = extraSurv,
                    opponents = oppList
                )
            }

            MultiIvLeagueMatrix(
                league = league,
                oppMetaPool = oppMetaPool,
                oppIvBaseline = oppIvBaseline,
                opponentCount = preparedOpps.size,
                baselineComparisonId = baseEval?.config?.id ?: PINNED_RANK1_CANDIDATE_ID,
                baselineLabel = baseEval?.config?.label ?: "🏆 Rank #1 Stat Product",
                candidateResults = results
            )
        }

        return MultiIvMatrixResult(
            leagues = leagueMatrices,
            computedAtMs = System.currentTimeMillis()
        )
    }
}
