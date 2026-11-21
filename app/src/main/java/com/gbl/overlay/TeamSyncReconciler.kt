package com.gbl.overlay

import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.Locale
import java.util.UUID
import kotlin.math.max

/**
 * Shared 3-way team reconciliation engine and cross-platform canonical digest calculator.
 * Ensures Standard GBL Teams and Show 6 Trios stay 100% in sync across Android, Web, and Cloudflare D1,
 * auto-merging clean one-sided changes while surfacing deletions and concurrent/ambiguous diffs to the user.
 */
internal object TeamSyncReconciler {

    private val FACTORY_DEFAULT_TEAM_IDS: Set<String> = setOf(
        "preset-ml-1",
        "preset-ul-1",
        "preset-gl-1",
        "preset-mega-1",
        "show6-preset3-spectral-1",
        "show6-preset3-cauldron-1",
        "show6-preset3-master-1",
        "show6-preset3-bfmaster-1"
    )

    data class TeamSyncBaselineRecord(
        val id: String = "",
        val sig: String = "",
        val name: String = "",
        val combatMode: String = "gbl",
        val updatedAt: Long = 0L
    )

    data class DeletedTeamMetaRecord(
        val id: String = "",
        val name: String = "",
        val league: String = "GREAT LEAGUE",
        val combatMode: String = "gbl",
        val updatedAt: Long = 0L
    )

    enum class TeamDeltaConflictKind {
        CONCURRENT_EDIT,
        AMBIGUOUS_DIFF,
        REMOTE_DELETED_LOCAL_ACTIVE,
        LOCAL_DELETED_REMOTE_ACTIVE,
        DUPLICATE_LINEUP_DIFF_ID
    }

    enum class TeamDeltaResolutionChoice {
        USE_CLOUD,
        USE_LOCAL,
        MERGE_CLOUD_NAME_LOCAL_BODY,
        MERGE_LOCAL_NAME_CLOUD_BODY,
        KEEP_BOTH,
        CONFIRM_DELETE,
        RESTORE_KEEP,
        MERGE_INTO_CLOUD_KEEP_CLOUD_NAME,
        MERGE_INTO_CLOUD_KEEP_LOCAL_NAME
    }

    data class TeamSyncDeltaConflict(
        val conflictKey: String,
        val kind: TeamDeltaConflictKind,
        val combatMode: String,
        val localTeam: OverlayService.Companion.SyncTeamPresetRecord?,
        val remoteTeam: OverlayService.Companion.SyncTeamPresetRecord?,
        val deletedMeta: DeletedTeamMetaRecord?,
        val diffLines: List<String>,
        val availableChoices: List<TeamDeltaResolutionChoice>,
        val recommendedChoice: TeamDeltaResolutionChoice
    )

    data class TeamReconcileResult(
        val gblTeams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        val show6Teams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        val gblDeletedIds: List<String>,
        val show6DeletedIds: List<String>,
        val updatedBaselines: Map<String, TeamSyncBaselineRecord>,
        val updatedDeletedMeta: Map<String, DeletedTeamMetaRecord>,
        val newOrUpdatedCount: Int,
        val mutatedLocally: Boolean,
        val autoPushLocalTeams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        val conflicts: List<TeamSyncDeltaConflict>
    )

    data class ResolvedTeamPushBatch(
        val teamsToPush: List<OverlayService.Companion.SyncTeamPresetRecord>,
        val deletedTeamIds: List<String>,
        val deletedTeamTimestamps: Map<String, Long>
    )

    @Suppress("USELESS_ELVIS")
    internal fun safeStr(value: String?, fallback: String = ""): String {
        return value ?: fallback
    }

    internal fun normLeagueForTeamSig(league: String?): String {
        val cleaned: String = safeStr(league)
            .trim()
            .replace(Regex("\\s*\\(\\d+\\)\\s*$"), "")
            .trim()
            .uppercase(Locale.US)
        return cleaned.ifEmpty { "GREAT LEAGUE" }
    }

    internal fun normTeamCombatMode(mode: String?, id: String?, league: String?): String {
        val m: String = safeStr(mode).trim().lowercase(Locale.US)
        val tid: String = safeStr(id).trim()
        val lg: String = safeStr(league).trim().uppercase(Locale.US)
        return if (m == "show6" || tid.startsWith("show6-preset3-") || lg.contains("SHOW 6")) {
            "show6"
        } else {
            "gbl"
        }
    }

    @Suppress("USELESS_ELVIS")
    internal fun safePokemonList(team: OverlayService.Companion.SyncTeamPresetRecord): List<OverlayService.Companion.SyncTeamSlot> {
        return team.pokemon ?: emptyList()
    }

    @Suppress("USELESS_ELVIS")
    internal fun computeCanonicalTeamContentSig(team: OverlayService.Companion.SyncTeamPresetRecord): String {
        val mode: String = normTeamCombatMode(team.combatMode, team.id, team.league)
        val name: String = safeStr(team.name).trim()
        val league: String = normLeagueForTeamSig(team.league)
        val assignedSet: LinkedHashSet<String> = LinkedHashSet()
        assignedSet.add(league)
        val extraAssigned: List<String> = team.assignedLeagues ?: emptyList()
        for (al in extraAssigned) {
            val norm: String = normLeagueForTeamSig(al)
            if (norm.isNotEmpty()) assignedSet.add(norm)
        }
        val assigned: String = assignedSet.sorted().joinToString(",")
        val archetype: String = safeStr(team.archetype, "ABC").trim().uppercase(Locale.US).ifEmpty { "ABC" }
        val slots: String = safePokemonList(team).take(3).joinToString("||") { s ->
            val sName: String = safeStr(s.name).trim()
            val fast: String = safeStr(s.fastMove).trim()
            val c1: String = safeStr(s.chargedMove1).trim()
            val c2: String = safeStr(s.chargedMove2).trim()
            val ivs: String = safeStr(s.ivs).trim()
            val plusLvl: Int = s.plusMoveLevel ?: 4
            val bb: Int = if (s.isBestBuddy == true) 1 else 0
            val mega: String = safeStr(s.megaFormName).trim()
            "$sName~${s.cp}~$fast~$c1~$c2~$ivs~$plusLvl~$bb~$mega"
        }
        return "$mode|$name|$league|$assigned|$archetype|$slots"
    }

    internal fun computeLineupCpCap(rawLeague: String?): Int {
        val u: String = safeStr(rawLeague).trim().uppercase(Locale.US)
        return when {
            u.contains("LITTLE") || u.contains("500") -> 500
            u.contains("MASTER") || u.contains("10000") -> 10000
            u.contains("ULTRA") || u.contains("CAULDRON") || u.contains("2500") -> 2500
            else -> 1500
        }
    }

    internal fun computeLineupMergeKey(team: OverlayService.Companion.SyncTeamPresetRecord): String? {
        val pokes: List<OverlayService.Companion.SyncTeamSlot> = safePokemonList(team)
        if (pokes.size < 3) return null
        val mode: String = normTeamCombatMode(team.combatMode, team.id, team.league)
        val cpCap: Int = computeLineupCpCap(team.league)
        val slotKey: String = pokes.take(3).joinToString("||") { s ->
            val n: String = safeStr(s.name).trim().lowercase(Locale.US).replace(Regex("\\s+"), " ")
            val f: String = safeStr(s.fastMove).trim().lowercase(Locale.US)
            val c1: String = safeStr(s.chargedMove1).trim().lowercase(Locale.US)
            val c2: String = safeStr(s.chargedMove2).trim().lowercase(Locale.US)
            "$n|$f|$c1|$c2"
        }
        return "$mode|$cpCap|$slotKey"
    }

    internal fun computeVaultTeamsDigest(activeTeams: List<OverlayService.Companion.SyncTeamPresetRecord>): String {
        val entries: List<Pair<String, String>> = activeTeams
            .mapNotNull { t ->
                val id: String = safeStr(t.id).trim()
                if (id.isEmpty()) null else id to "$id:${computeCanonicalTeamContentSig(t)}"
            }
            .sortedBy { it.first }
        val payload: String = entries.joinToString("\n") { it.second }
        var h1: Int = 0x811c9dc5.toInt()
        var h2: Int = 0x9e3779b9.toInt()
        for (i in 0 until payload.length) {
            val ch: Int = payload[i].code
            h1 = (h1 xor ch) * 0x01000193
            h2 = (h2 xor (ch + 1)) * 0x85ebca6b.toInt()
        }
        val hex1: String = String.format(Locale.US, "%08x", h1)
        val hex2: String = String.format(Locale.US, "%08x", h2)
        return "${entries.size}:$hex1$hex2"
    }

    internal fun isUntouchedFactoryPreset(team: OverlayService.Companion.SyncTeamPresetRecord): Boolean {
        val id: String = safeStr(team.id).trim()
        return id in FACTORY_DEFAULT_TEAM_IDS && team.updatedAt <= 1L
    }

    internal fun describeTeamFieldDiffs(
        local: OverlayService.Companion.SyncTeamPresetRecord,
        remote: OverlayService.Companion.SyncTeamPresetRecord
    ): List<String> {
        val lines: MutableList<String> = ArrayList()
        val lName: String = safeStr(local.name).trim()
        val rName: String = safeStr(remote.name).trim()
        if (lName != rName) {
            lines.add("Name: Local \"$lName\" vs Cloud \"$rName\"")
        }
        val lAssigned: String = (listOf(normLeagueForTeamSig(local.league)) + local.assignedLeagues.orEmpty().map { normLeagueForTeamSig(it) })
            .distinct().sorted().joinToString(", ")
        val rAssigned: String = (listOf(normLeagueForTeamSig(remote.league)) + remote.assignedLeagues.orEmpty().map { normLeagueForTeamSig(it) })
            .distinct().sorted().joinToString(", ")
        if (lAssigned != rAssigned || normLeagueForTeamSig(local.league) != normLeagueForTeamSig(remote.league)) {
            lines.add("Leagues: Local [$lAssigned] vs Cloud [$rAssigned]")
        }
        val lArch: String = safeStr(local.archetype, "ABC").trim().uppercase(Locale.US)
        val rArch: String = safeStr(remote.archetype, "ABC").trim().uppercase(Locale.US)
        if (lArch != rArch) {
            lines.add("Archetype: Local $lArch vs Cloud $rArch")
        }
        val lPokes: List<OverlayService.Companion.SyncTeamSlot> = safePokemonList(local)
        val rPokes: List<OverlayService.Companion.SyncTeamSlot> = safePokemonList(remote)
        val maxSlots: Int = max(lPokes.size, rPokes.size).coerceAtMost(3)
        for (i in 0 until maxSlots) {
            val ls: OverlayService.Companion.SyncTeamSlot? = lPokes.getOrNull(i)
            val rs: OverlayService.Companion.SyncTeamSlot? = rPokes.getOrNull(i)
            val lDesc: String = formatSlotBrief(ls)
            val rDesc: String = formatSlotBrief(rs)
            if (lDesc != rDesc) {
                lines.add("Slot ${i + 1}: Local [$lDesc] vs Cloud [$rDesc]")
            }
        }
        if (lines.isEmpty()) {
            lines.add("Metadata updated (${lName.ifEmpty { rName }})")
        }
        return lines
    }

    private fun formatSlotBrief(slot: OverlayService.Companion.SyncTeamSlot?): String {
        if (slot == null) return "Empty"
        val name: String = safeStr(slot.name).trim()
        val fast: String = safeStr(slot.fastMove).trim()
        val c1: String = safeStr(slot.chargedMove1).trim()
        val c2: String = safeStr(slot.chargedMove2).trim()
        val ivs: String = safeStr(slot.ivs).trim()
        val mega: String = safeStr(slot.megaFormName).trim()
        val extras: MutableList<String> = ArrayList()
        if (slot.cp > 0) extras.add("${slot.cp}CP")
        if (ivs.isNotEmpty()) extras.add(ivs)
        if (mega.isNotEmpty()) extras.add("Mega:$mega")
        if (slot.isBestBuddy == true) extras.add("BB")
        val movesStr: String = listOf(fast, c1, c2).filter { it.isNotEmpty() }.joinToString("/")
        val suffix: String = if (extras.isNotEmpty()) " (${extras.joinToString(", ")})" else ""
        return if (movesStr.isNotEmpty()) "$name — $movesStr$suffix" else "$name$suffix"
    }

    @Suppress("USELESS_ELVIS")
    internal fun normalizeRecordMode(
        team: OverlayService.Companion.SyncTeamPresetRecord
    ): OverlayService.Companion.SyncTeamPresetRecord {
        val cleanId: String = safeStr(team.id).trim()
        val mode: String = normTeamCombatMode(team.combatMode, cleanId, team.league)
        return team.copy(
            id = cleanId,
            name = safeStr(team.name),
            league = safeStr(team.league, "GREAT LEAGUE"),
            combatMode = mode,
            archetype = safeStr(team.archetype, "ABC").ifBlank { "ABC" },
            pokemon = safePokemonList(team),
            sharedWeaknesses = team.sharedWeaknesses ?: emptyList(),
            keyMetaTargetsBeaten = team.keyMetaTargetsBeaten ?: emptyList(),
            keyThreats = team.keyThreats ?: emptyList(),
            coreBreakers = team.coreBreakers ?: emptyList(),
            altMovesetSlots = team.altMovesetSlots ?: emptyList(),
            synergySummary = safeStr(team.synergySummary)
        )
    }

    private fun mergeMetricsPreserveSelected(
        preferred: OverlayService.Companion.SyncTeamPresetRecord,
        other: OverlayService.Companion.SyncTeamPresetRecord,
        preserveSelected: Boolean
    ): OverlayService.Companion.SyncTeamPresetRecord {
        val richMeta = if ((preferred.metaPoolMetrics?.size ?: 0) >= (other.metaPoolMetrics?.size ?: 0)) {
            preferred.metaPoolMetrics ?: other.metaPoolMetrics
        } else {
            other.metaPoolMetrics
        }
        val richSynergy = safeStr(preferred.synergySummary).ifBlank { safeStr(other.synergySummary) }
        return preferred.copy(
            isSelected = preserveSelected,
            metaPoolMetrics = richMeta,
            synergySummary = richSynergy,
            leadAggBr = if (preferred.leadAggBr > 0) preferred.leadAggBr else other.leadAggBr,
            machineAggBr = if (preferred.machineAggBr > 0) preferred.machineAggBr else other.machineAggBr,
            safeSwapBr = if (preferred.safeSwapBr > 0) preferred.safeSwapBr else other.safeSwapBr,
            closerSwapBr = if (preferred.closerSwapBr > 0) preferred.closerSwapBr else other.closerSwapBr,
            closerBr = if (preferred.closerBr > 0) preferred.closerBr else other.closerBr
        )
    }

    private fun buildConcurrentEditChoices(
        local: OverlayService.Companion.SyncTeamPresetRecord,
        remote: OverlayService.Companion.SyncTeamPresetRecord
    ): Pair<List<TeamDeltaResolutionChoice>, Boolean> {
        val nameDiffers: Boolean = safeStr(local.name).trim() != safeStr(remote.name).trim()
        val localBodySig: String = computeCanonicalTeamContentSig(local.copy(name = ""))
        val remoteBodySig: String = computeCanonicalTeamContentSig(remote.copy(name = ""))
        val bodyDiffers: Boolean = localBodySig != remoteBodySig
        val choices: MutableList<TeamDeltaResolutionChoice> = mutableListOf(
            TeamDeltaResolutionChoice.USE_CLOUD,
            TeamDeltaResolutionChoice.USE_LOCAL
        )
        if (nameDiffers && bodyDiffers) {
            choices.add(TeamDeltaResolutionChoice.MERGE_CLOUD_NAME_LOCAL_BODY)
            choices.add(TeamDeltaResolutionChoice.MERGE_LOCAL_NAME_CLOUD_BODY)
        }
        choices.add(TeamDeltaResolutionChoice.KEEP_BOTH)
        return choices to (remote.updatedAt >= local.updatedAt)
    }

    fun reconcileAllTeamsThreeWay(
        localGblTeams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        localShow6Teams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        localGblDelIds: List<String>,
        localShow6DelIds: List<String>,
        localDeletedMeta: Map<String, DeletedTeamMetaRecord>,
        baselines: Map<String, TeamSyncBaselineRecord>,
        hasExistingBaseline: Boolean,
        remoteUpsertedTeams: List<OverlayService.Companion.SyncTeamPresetRecord>,
        remoteDeletedTeamIds: List<String>,
        remoteDeletedMeta: Map<String, DeletedTeamMetaRecord>,
        isFullRemoteSnapshot: Boolean
    ): TeamReconcileResult {
        val normLocalAll: LinkedHashMap<String, OverlayService.Companion.SyncTeamPresetRecord> = LinkedHashMap()
        val localOrderIds: MutableList<String> = ArrayList()
        for (raw in localGblTeams) {
            val t = normalizeRecordMode(raw.copy(combatMode = "gbl"))
            if (t.id.isNotBlank() && !normLocalAll.containsKey(t.id)) {
                normLocalAll[t.id] = t
                localOrderIds.add(t.id)
            }
        }
        for (raw in localShow6Teams) {
            val t = normalizeRecordMode(raw.copy(combatMode = "show6"))
            if (t.id.isNotBlank() && !normLocalAll.containsKey(t.id)) {
                normLocalAll[t.id] = t
                localOrderIds.add(t.id)
            }
        }

        val normRemoteAll: LinkedHashMap<String, OverlayService.Companion.SyncTeamPresetRecord> = LinkedHashMap()
        val remoteOrderIds: MutableList<String> = ArrayList()
        for (raw in remoteUpsertedTeams) {
            val t = normalizeRecordMode(raw)
            if (t.id.isNotBlank() && !normRemoteAll.containsKey(t.id)) {
                normRemoteAll[t.id] = t
                remoteOrderIds.add(t.id)
            }
        }

        val localGblDelSet: LinkedHashSet<String> = localGblDelIds.filter { it.isNotBlank() }.toCollection(LinkedHashSet())
        val localShow6DelSet: LinkedHashSet<String> = localShow6DelIds.filter { it.isNotBlank() }.toCollection(LinkedHashSet())
        val localAllDelSet: Set<String> = localGblDelSet + localShow6DelSet
        val remoteDelSet: LinkedHashSet<String> = remoteDeletedTeamIds.filter { it.isNotBlank() }.toCollection(LinkedHashSet())

        // Remove active teams from localDeletedSets only if not genuinely deleted
        val nextBaselines: LinkedHashMap<String, TeamSyncBaselineRecord> = LinkedHashMap(baselines)
        val nextDeletedMeta: LinkedHashMap<String, DeletedTeamMetaRecord> = LinkedHashMap(localDeletedMeta)
        for ((k, v) in remoteDeletedMeta) {
            val prev = nextDeletedMeta[k]
            if (prev == null || v.updatedAt > prev.updatedAt) {
                nextDeletedMeta[k] = v
            }
        }

        // Detect whether Cloud already has real teams per combat mode so untouched factory defaults on a secondary device auto-drop
        val remoteRealCountByMode: HashMap<String, Int> = HashMap()
        for (rt in normRemoteAll.values) {
            if (!isUntouchedFactoryPreset(rt)) {
                remoteRealCountByMode[rt.combatMode] = (remoteRealCountByMode[rt.combatMode] ?: 0) + 1
            }
        }

        val finalTeamsMap: LinkedHashMap<String, OverlayService.Companion.SyncTeamPresetRecord> = LinkedHashMap()
        val autoPushTeams: MutableList<OverlayService.Companion.SyncTeamPresetRecord> = ArrayList()
        val conflicts: MutableList<TeamSyncDeltaConflict> = ArrayList()
        var newOrUpdatedCount = 0
        var mutatedLocally = false

        // Index remote-only non-deleted teams by lineup key so we can pair same-lineup different-ID duplicates
        val remoteOnlyByLineupKey: LinkedHashMap<String, MutableList<OverlayService.Companion.SyncTeamPresetRecord>> = LinkedHashMap()
        for (rid in remoteOrderIds) {
            if (rid in remoteDelSet || rid in localAllDelSet || normLocalAll.containsKey(rid)) continue
            val rt = normRemoteAll[rid] ?: continue
            val lk = computeLineupMergeKey(rt)
            if (lk != null) {
                remoteOnlyByLineupKey.getOrPut(lk) { ArrayList() }.add(rt)
            }
        }
        val pairedRemoteDuplicateIds: HashSet<String> = HashSet()
        val handledLocalIds: HashSet<String> = HashSet()

        // 1. Process all teams present locally (in order)
        for (id in localOrderIds) {
            val local = normLocalAll[id] ?: continue
            if (id in localAllDelSet) {
                // Active entry shouldn't be in local delete set; treat local active as overriding stale local tombstone unless remote deleted
                if (local.combatMode == "show6") localShow6DelSet.remove(id) else localGblDelSet.remove(id)
            }
            val remote = normRemoteAll[id]
            val isRemoteDeleted = id in remoteDelSet

            if (isRemoteDeleted) {
                handledLocalIds.add(id)
                if (isUntouchedFactoryPreset(local)) {
                    if (local.combatMode == "show6") localShow6DelSet.add(id) else localGblDelSet.add(id)
                    nextBaselines.remove(id)
                    mutatedLocally = true
                    continue
                }
                finalTeamsMap[id] = local
                val rMeta = remoteDeletedMeta[id] ?: DeletedTeamMetaRecord(
                    id = id,
                    name = safeStr(local.name),
                    league = safeStr(local.league, "GREAT LEAGUE"),
                    combatMode = local.combatMode,
                    updatedAt = 0L
                )
                val base = baselines[id]
                val editedAfterBaseline = base != null && computeCanonicalTeamContentSig(local) != base.sig
                val recChoice = if (editedAfterBaseline || (rMeta.updatedAt > 0L && local.updatedAt > rMeta.updatedAt + 5000L)) {
                    TeamDeltaResolutionChoice.RESTORE_KEEP
                } else {
                    TeamDeltaResolutionChoice.CONFIRM_DELETE
                }
                conflicts.add(
                    TeamSyncDeltaConflict(
                        conflictKey = "remote_del|$id",
                        kind = TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE,
                        combatMode = local.combatMode,
                        localTeam = local,
                        remoteTeam = null,
                        deletedMeta = rMeta,
                        diffLines = listOf(
                            "Team \"${local.name}\" was deleted on another device (${local.pokemon.take(3).joinToString(" / ") { safeStr(it.name) }}).",
                            if (editedAfterBaseline) "This device also has unsynced local edits." else "Still active on this device."
                        ),
                        availableChoices = listOf(
                            TeamDeltaResolutionChoice.CONFIRM_DELETE,
                            TeamDeltaResolutionChoice.RESTORE_KEEP
                        ),
                        recommendedChoice = recChoice
                    )
                )
                continue
            }

            if (remote != null) {
                handledLocalIds.add(id)
                val localSig = computeCanonicalTeamContentSig(local)
                val remoteSig = computeCanonicalTeamContentSig(remote)
                val base = baselines[id]

                if (localSig == remoteSig) {
                    val merged = if (remote.updatedAt > local.updatedAt) {
                        mergeMetricsPreserveSelected(remote, local, preserveSelected = local.isSelected)
                    } else {
                        mergeMetricsPreserveSelected(local, remote, preserveSelected = local.isSelected)
                    }
                    finalTeamsMap[id] = merged
                    nextBaselines[id] = TeamSyncBaselineRecord(
                        id = id,
                        sig = remoteSig,
                        name = safeStr(merged.name),
                        combatMode = merged.combatMode,
                        updatedAt = max(local.updatedAt, remote.updatedAt)
                    )
                    if (merged != local) mutatedLocally = true
                    continue
                }

                if (isUntouchedFactoryPreset(local)) {
                    val applied = remote.copy(isSelected = local.isSelected)
                    finalTeamsMap[id] = applied
                    nextBaselines[id] = TeamSyncBaselineRecord(
                        id = id,
                        sig = remoteSig,
                        name = safeStr(applied.name),
                        combatMode = applied.combatMode,
                        updatedAt = remote.updatedAt
                    )
                    newOrUpdatedCount++
                    mutatedLocally = true
                    continue
                }

                if (base != null) {
                    val localChanged = localSig != base.sig
                    val remoteChanged = remoteSig != base.sig
                    when {
                        !localChanged && remoteChanged -> {
                            val applied = remote.copy(isSelected = local.isSelected)
                            finalTeamsMap[id] = applied
                            nextBaselines[id] = TeamSyncBaselineRecord(
                                id = id,
                                sig = remoteSig,
                                name = safeStr(applied.name),
                                combatMode = applied.combatMode,
                                updatedAt = remote.updatedAt
                            )
                            newOrUpdatedCount++
                            mutatedLocally = true
                        }
                        localChanged && !remoteChanged -> {
                            finalTeamsMap[id] = local
                            autoPushTeams.add(local)
                        }
                        else -> {
                            // Both changed independently since baseline -> Concurrent Conflict!
                            finalTeamsMap[id] = local
                            val (choices, preferCloud) = buildConcurrentEditChoices(local, remote)
                            conflicts.add(
                                TeamSyncDeltaConflict(
                                    conflictKey = "concurrent|$id",
                                    kind = TeamDeltaConflictKind.CONCURRENT_EDIT,
                                    combatMode = local.combatMode,
                                    localTeam = local,
                                    remoteTeam = remote,
                                    deletedMeta = null,
                                    diffLines = describeTeamFieldDiffs(local, remote),
                                    availableChoices = choices,
                                    recommendedChoice = if (preferCloud) TeamDeltaResolutionChoice.USE_CLOUD else TeamDeltaResolutionChoice.USE_LOCAL
                                )
                            )
                        }
                    }
                } else {
                    // First baseline sync / upgrade from older version
                    if (remote.updatedAt > local.updatedAt + 5000L) {
                        val applied = remote.copy(isSelected = local.isSelected)
                        finalTeamsMap[id] = applied
                        nextBaselines[id] = TeamSyncBaselineRecord(
                            id = id,
                            sig = remoteSig,
                            name = safeStr(applied.name),
                            combatMode = applied.combatMode,
                            updatedAt = remote.updatedAt
                        )
                        newOrUpdatedCount++
                        mutatedLocally = true
                    } else {
                        finalTeamsMap[id] = local
                        val (choices, preferCloud) = buildConcurrentEditChoices(local, remote)
                        conflicts.add(
                            TeamSyncDeltaConflict(
                                conflictKey = "ambiguous|$id",
                                kind = TeamDeltaConflictKind.AMBIGUOUS_DIFF,
                                combatMode = local.combatMode,
                                localTeam = local,
                                remoteTeam = remote,
                                deletedMeta = null,
                                diffLines = describeTeamFieldDiffs(local, remote),
                                availableChoices = choices,
                                recommendedChoice = if (preferCloud) TeamDeltaResolutionChoice.USE_CLOUD else TeamDeltaResolutionChoice.USE_LOCAL
                            )
                        )
                    }
                }
                continue
            }

            // Local-only active team (`remote == null && !isRemoteDeleted`)
            if (isFullRemoteSnapshot) {
                handledLocalIds.add(id)
                if (isUntouchedFactoryPreset(local) && (remoteRealCountByMode[local.combatMode] ?: 0) > 0) {
                    if (local.combatMode == "show6") localShow6DelSet.add(id) else localGblDelSet.add(id)
                    nextBaselines.remove(id)
                    mutatedLocally = true
                    continue
                }
                val lKey = computeLineupMergeKey(local)
                val matchedRemotes = if (lKey != null) remoteOnlyByLineupKey[lKey]?.filter { it.id !in pairedRemoteDuplicateIds } else null
                val dupRemote = matchedRemotes?.firstOrNull()
                if (dupRemote != null) {
                    pairedRemoteDuplicateIds.add(dupRemote.id)
                    finalTeamsMap[id] = local
                    val preferCloudName = dupRemote.updatedAt > local.updatedAt
                    val recDupChoice = if (preferCloudName) {
                        TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_CLOUD_NAME
                    } else {
                        TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME
                    }
                    conflicts.add(
                        TeamSyncDeltaConflict(
                            conflictKey = "duplineup|${local.id}|${dupRemote.id}",
                            kind = TeamDeltaConflictKind.DUPLICATE_LINEUP_DIFF_ID,
                            combatMode = local.combatMode,
                            localTeam = local,
                            remoteTeam = dupRemote,
                            deletedMeta = null,
                            diffLines = listOf(
                                "Identical 3-Pokémon lineup exists under two separate Team IDs:",
                                "Local: \"${local.name}\" vs Cloud: \"${dupRemote.name}\""
                            ),
                            availableChoices = listOf(
                                TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_CLOUD_NAME,
                                TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME,
                                TeamDeltaResolutionChoice.KEEP_BOTH
                            ),
                            recommendedChoice = recDupChoice
                        )
                    )
                } else {
                    finalTeamsMap[id] = local
                    if (!hasExistingBaseline || baselines[id] == null) {
                        autoPushTeams.add(local)
                    }
                }
            } else {
                // Partial delta response didn't touch this team -> keep it & preserve baseline
                handledLocalIds.add(id)
                finalTeamsMap[id] = local
            }
        }

        // 2. Process teams present in Remote (that were not active locally)
        for (rid in remoteOrderIds) {
            if (rid in handledLocalIds) continue
            val remote = normRemoteAll[rid] ?: continue
            if (rid in remoteDelSet) continue

            if (rid in localAllDelSet) {
                val localDelMeta = nextDeletedMeta[rid]
                val localDelAt = localDelMeta?.updatedAt ?: 0L
                val base = baselines[rid]
                // If user just deleted this untouched team locally on this device and hasn't pushed yet, honor local delete silently
                val isCleanUnpushedLocalDelete = base != null &&
                    localDelAt > 0L &&
                    localDelAt > remote.updatedAt &&
                    remote.updatedAt <= base.updatedAt
                if (!isCleanUnpushedLocalDelete) {
                    val delMeta = DeletedTeamMetaRecord(
                        id = rid,
                        name = safeStr(localDelMeta?.name).ifBlank { safeStr(remote.name) },
                        league = safeStr(localDelMeta?.league).ifBlank { safeStr(remote.league, "GREAT LEAGUE") },
                        combatMode = remote.combatMode,
                        updatedAt = localDelAt
                    )
                    val rec = if (remote.updatedAt > localDelAt) {
                        TeamDeltaResolutionChoice.RESTORE_KEEP
                    } else {
                        TeamDeltaResolutionChoice.CONFIRM_DELETE
                    }
                    conflicts.add(
                        TeamSyncDeltaConflict(
                            conflictKey = "local_del|$rid",
                            kind = TeamDeltaConflictKind.LOCAL_DELETED_REMOTE_ACTIVE,
                            combatMode = remote.combatMode,
                            localTeam = null,
                            remoteTeam = remote,
                            deletedMeta = delMeta,
                            diffLines = listOf(
                                "This device deleted \"${remote.name}\", while Cloud still has it active (${remote.pokemon.take(3).joinToString(" / ") { safeStr(it.name) }})."
                            ),
                            availableChoices = listOf(
                                TeamDeltaResolutionChoice.RESTORE_KEEP,
                                TeamDeltaResolutionChoice.CONFIRM_DELETE
                            ),
                            recommendedChoice = rec
                        )
                    )
                }
                continue
            }

            if (rid in pairedRemoteDuplicateIds) {
                // Held until user chooses how to merge/keep duplicate lineup
                continue
            }

            // Clean remote addition!
            val cleanRemote = remote.copy(isSelected = false)
            finalTeamsMap[rid] = cleanRemote
            nextBaselines[rid] = TeamSyncBaselineRecord(
                id = rid,
                sig = computeCanonicalTeamContentSig(cleanRemote),
                name = safeStr(cleanRemote.name),
                combatMode = cleanRemote.combatMode,
                updatedAt = cleanRemote.updatedAt
            )
            newOrUpdatedCount++
            mutatedLocally = true
        }

        // 3. Record any remote tombstones we saw for deleted teams not active locally
        for (delId in remoteDelSet) {
            if (!finalTeamsMap.containsKey(delId)) {
                val rMeta = remoteDeletedMeta[delId]
                val mode = rMeta?.combatMode ?: normTeamCombatMode(null, delId, null)
                val added = if (mode == "show6") localShow6DelSet.add(delId) else localGblDelSet.add(delId)
                if (added) mutatedLocally = true
                nextBaselines.remove(delId)
            }
        }

        // Prune baselines for teams that no longer exist in snapshot
        if (isFullRemoteSnapshot) {
            val conflictIds = conflicts.mapNotNull { it.localTeam?.id ?: it.remoteTeam?.id }.toSet()
            val iter = nextBaselines.keys.iterator()
            while (iter.hasNext()) {
                val bid = iter.next()
                if (!finalTeamsMap.containsKey(bid) && bid !in conflictIds) {
                    iter.remove()
                }
            }
        }

        val finalGbl = finalTeamsMap.values.filter { it.combatMode != "show6" }
        val finalShow6 = finalTeamsMap.values.filter { it.combatMode == "show6" }

        return TeamReconcileResult(
            gblTeams = finalGbl,
            show6Teams = finalShow6,
            gblDeletedIds = localGblDelSet.toList(),
            show6DeletedIds = localShow6DelSet.toList(),
            updatedBaselines = nextBaselines,
            updatedDeletedMeta = nextDeletedMeta,
            newOrUpdatedCount = newOrUpdatedCount,
            mutatedLocally = mutatedLocally,
            autoPushLocalTeams = autoPushTeams.distinctBy { it.id },
            conflicts = conflicts
        )
    }

    internal fun loadTeamBaselines(prefs: SharedPreferences, gson: Gson): MutableMap<String, TeamSyncBaselineRecord> {
        val raw = prefs.getString(OverlayService.PREFS_KEY_CLOUD_TEAM_BASELINES_V794, null) ?: return LinkedHashMap()
        return try {
            val mapType = object : TypeToken<LinkedHashMap<String, TeamSyncBaselineRecord>>() {}.type
            gson.fromJson<LinkedHashMap<String, TeamSyncBaselineRecord>>(raw, mapType) ?: LinkedHashMap()
        } catch (_: Exception) {
            LinkedHashMap()
        }
    }

    internal fun saveTeamBaselines(
        editor: SharedPreferences.Editor,
        gson: Gson,
        baselines: Map<String, TeamSyncBaselineRecord>
    ) {
        editor.putString(OverlayService.PREFS_KEY_CLOUD_TEAM_BASELINES_V794, gson.toJson(baselines))
    }

    internal fun loadDeletedTeamMeta(prefs: SharedPreferences, gson: Gson): MutableMap<String, DeletedTeamMetaRecord> {
        val raw = prefs.getString(OverlayService.PREFS_KEY_DELETED_TEAM_META_V794, null) ?: return LinkedHashMap()
        return try {
            val mapType = object : TypeToken<LinkedHashMap<String, DeletedTeamMetaRecord>>() {}.type
            gson.fromJson<LinkedHashMap<String, DeletedTeamMetaRecord>>(raw, mapType) ?: LinkedHashMap()
        } catch (_: Exception) {
            LinkedHashMap()
        }
    }

    internal fun saveDeletedTeamMeta(
        editor: SharedPreferences.Editor,
        gson: Gson,
        metaMap: Map<String, DeletedTeamMetaRecord>
    ) {
        val trimmed = if (metaMap.size > 400) {
            metaMap.values.sortedByDescending { it.updatedAt }.take(400).associateBy { it.id }
        } else {
            metaMap
        }
        editor.putString(OverlayService.PREFS_KEY_DELETED_TEAM_META_V794, gson.toJson(trimmed))
    }

    internal fun recordLocalTeamDeletionMetaStatic(
        prefs: SharedPreferences,
        gson: Gson,
        id: String,
        name: String,
        league: String,
        combatMode: String,
        deletedAtMs: Long = System.currentTimeMillis()
    ) {
        val cleanId = id.trim()
        if (cleanId.isEmpty()) return
        val map = loadDeletedTeamMeta(prefs, gson)
        map[cleanId] = DeletedTeamMetaRecord(
            id = cleanId,
            name = name.trim(),
            league = league.trim().ifEmpty { "GREAT LEAGUE" },
            combatMode = normTeamCombatMode(combatMode, cleanId, league),
            updatedAt = deletedAtMs
        )
        val ed = prefs.edit()
        saveDeletedTeamMeta(ed, gson, map)
        ed.apply()
    }

    internal fun removeLocalTeamDeletionMetaStatic(
        prefs: SharedPreferences,
        gson: Gson,
        id: String
    ) {
        val cleanId = id.trim()
        if (cleanId.isEmpty()) return
        val map = loadDeletedTeamMeta(prefs, gson)
        if (map.remove(cleanId) != null) {
            val ed = prefs.edit()
            saveDeletedTeamMeta(ed, gson, map)
            ed.apply()
        }
    }

    fun applyTeamSyncConflictResolutions(
        prefs: SharedPreferences,
        gson: Gson,
        conflicts: List<TeamSyncDeltaConflict>,
        chosenMap: Map<String, TeamDeltaResolutionChoice>
    ): ResolvedTeamPushBatch {
        val nowMs: Long = System.currentTimeMillis()
        val syncTeamsType = object : TypeToken<List<OverlayService.Companion.SyncTeamPresetRecord>>() {}.type
        val strListType = object : TypeToken<List<String>>() {}.type
        val logListType = object : TypeToken<List<OverlayService.Companion.SyncBattleLogRecord>>() {}.type

        fun readTeams(key: String, mode: String): MutableList<OverlayService.Companion.SyncTeamPresetRecord> {
            val raw = prefs.getString(key, null)
            val parsed: List<OverlayService.Companion.SyncTeamPresetRecord> = if (!raw.isNullOrBlank()) {
                try { gson.fromJson(raw, syncTeamsType) ?: emptyList() } catch (_: Exception) { emptyList() }
            } else emptyList()
            return parsed.map { normalizeRecordMode(it.copy(combatMode = mode)) }.toMutableList()
        }

        fun readIds(key: String): MutableSet<String> {
            val raw = prefs.getString(key, null)
            val parsed: List<String> = if (!raw.isNullOrBlank()) {
                try { gson.fromJson(raw, strListType) ?: emptyList() } catch (_: Exception) { emptyList() }
            } else emptyList()
            return parsed.filter { it.isNotBlank() }.toCollection(LinkedHashSet())
        }

        val gblTeams: MutableList<OverlayService.Companion.SyncTeamPresetRecord> = readTeams(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, "gbl")
        val show6Teams: MutableList<OverlayService.Companion.SyncTeamPresetRecord> = readTeams(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, "show6")
        val gblDelIds: MutableSet<String> = readIds(OverlayService.PREFS_KEY_DELETED_TEAM_IDS)
        val show6DelIds: MutableSet<String> = readIds(OverlayService.PREFS_KEY_SHOW6_DELETED_TEAM_IDS)
        val baselines: MutableMap<String, TeamSyncBaselineRecord> = loadTeamBaselines(prefs, gson)
        val delMetaMap: MutableMap<String, DeletedTeamMetaRecord> = loadDeletedTeamMeta(prefs, gson)

        val teamsToPush: MutableList<OverlayService.Companion.SyncTeamPresetRecord> = ArrayList()
        val deletedIdsToPush: LinkedHashSet<String> = LinkedHashSet()
        val deletedTimestampsToPush: LinkedHashMap<String, Long> = LinkedHashMap()
        val redirectLogsByMode: HashMap<String, HashMap<String, String>> = HashMap()
        val trashedTeamsByMode: HashMap<String, MutableList<OverlayService.Companion.SyncTeamPresetRecord>> = HashMap()

        fun listFor(mode: String) = if (mode == "show6") show6Teams else gblTeams
        fun delSetFor(mode: String) = if (mode == "show6") show6DelIds else gblDelIds

        fun upsertInto(list: MutableList<OverlayService.Companion.SyncTeamPresetRecord>, rec: OverlayService.Companion.SyncTeamPresetRecord) {
            val idx = list.indexOfFirst { it.id == rec.id }
            if (idx >= 0) {
                list[idx] = rec.copy(isSelected = list[idx].isSelected)
            } else {
                list.add(0, rec)
            }
        }

        for (c in conflicts) {
            val choice = chosenMap[c.conflictKey] ?: c.recommendedChoice
            val mode = normTeamCombatMode(c.combatMode, c.localTeam?.id ?: c.remoteTeam?.id ?: c.deletedMeta?.id, c.localTeam?.league ?: c.remoteTeam?.league)
            val targetList = listFor(mode)
            val targetDelSet = delSetFor(mode)
            val local = c.localTeam
            val remote = c.remoteTeam

            when (choice) {
                TeamDeltaResolutionChoice.USE_CLOUD -> {
                    if (remote != null) {
                        val normRemote = normalizeRecordMode(remote.copy(combatMode = mode))
                        upsertInto(targetList, normRemote)
                        targetDelSet.remove(normRemote.id)
                        delMetaMap.remove(normRemote.id)
                        baselines[normRemote.id] = TeamSyncBaselineRecord(
                            id = normRemote.id,
                            sig = computeCanonicalTeamContentSig(normRemote),
                            name = safeStr(normRemote.name),
                            combatMode = mode,
                            updatedAt = normRemote.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.USE_LOCAL -> {
                    if (local != null) {
                        val bumpTs = max(nowMs, (remote?.updatedAt ?: 0L) + 1L)
                        val bumped = normalizeRecordMode(local.copy(combatMode = mode, updatedAt = bumpTs))
                        upsertInto(targetList, bumped)
                        targetDelSet.remove(bumped.id)
                        delMetaMap.remove(bumped.id)
                        teamsToPush.add(bumped)
                        baselines[bumped.id] = TeamSyncBaselineRecord(
                            id = bumped.id,
                            sig = computeCanonicalTeamContentSig(bumped),
                            name = safeStr(bumped.name),
                            combatMode = mode,
                            updatedAt = bumped.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.MERGE_CLOUD_NAME_LOCAL_BODY -> {
                    if (local != null && remote != null) {
                        val bumpTs = max(nowMs, max(local.updatedAt, remote.updatedAt) + 1L)
                        val merged = normalizeRecordMode(local.copy(name = remote.name, combatMode = mode, updatedAt = bumpTs))
                        upsertInto(targetList, merged)
                        targetDelSet.remove(merged.id)
                        delMetaMap.remove(merged.id)
                        teamsToPush.add(merged)
                        baselines[merged.id] = TeamSyncBaselineRecord(
                            id = merged.id,
                            sig = computeCanonicalTeamContentSig(merged),
                            name = safeStr(merged.name),
                            combatMode = mode,
                            updatedAt = merged.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.MERGE_LOCAL_NAME_CLOUD_BODY -> {
                    if (local != null && remote != null) {
                        val bumpTs = max(nowMs, max(local.updatedAt, remote.updatedAt) + 1L)
                        val merged = normalizeRecordMode(remote.copy(name = local.name, combatMode = mode, updatedAt = bumpTs, isSelected = local.isSelected))
                        upsertInto(targetList, merged)
                        targetDelSet.remove(merged.id)
                        delMetaMap.remove(merged.id)
                        teamsToPush.add(merged)
                        baselines[merged.id] = TeamSyncBaselineRecord(
                            id = merged.id,
                            sig = computeCanonicalTeamContentSig(merged),
                            name = safeStr(merged.name),
                            combatMode = mode,
                            updatedAt = merged.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.KEEP_BOTH -> {
                    if (remote != null) {
                        val normRemote = normalizeRecordMode(remote.copy(combatMode = mode))
                        upsertInto(targetList, normRemote)
                        targetDelSet.remove(normRemote.id)
                        baselines[normRemote.id] = TeamSyncBaselineRecord(
                            id = normRemote.id,
                            sig = computeCanonicalTeamContentSig(normRemote),
                            name = safeStr(normRemote.name),
                            combatMode = mode,
                            updatedAt = normRemote.updatedAt
                        )
                    }
                    if (local != null) {
                        val sameId = remote != null && local.id == remote.id
                        val newId = if (sameId) UUID.randomUUID().toString() else local.id
                        val baseName = safeStr(local.name).trim().ifEmpty { "Team" }
                        val cloneName = if (remote != null && baseName.equals(safeStr(remote.name).trim(), ignoreCase = true)) {
                            "$baseName (Device Copy)"
                        } else {
                            baseName
                        }
                        val cloned = normalizeRecordMode(
                            local.copy(
                                id = newId,
                                name = cloneName,
                                combatMode = mode,
                                isSelected = false,
                                updatedAt = nowMs
                            )
                        )
                        targetList.add(0, cloned)
                        targetDelSet.remove(cloned.id)
                        teamsToPush.add(cloned)
                        baselines[cloned.id] = TeamSyncBaselineRecord(
                            id = cloned.id,
                            sig = computeCanonicalTeamContentSig(cloned),
                            name = safeStr(cloned.name),
                            combatMode = mode,
                            updatedAt = cloned.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.CONFIRM_DELETE -> {
                    val targetId = local?.id ?: remote?.id ?: c.deletedMeta?.id.orEmpty()
                    if (targetId.isNotEmpty()) {
                        if (local != null) {
                            trashedTeamsByMode.getOrPut(mode) { ArrayList() }.add(local)
                        }
                        targetList.removeAll { it.id == targetId }
                        targetDelSet.add(targetId)
                        baselines.remove(targetId)
                        val delTs = max(nowMs, max(remote?.updatedAt ?: 0L, local?.updatedAt ?: 0L) + 1L)
                        delMetaMap[targetId] = DeletedTeamMetaRecord(
                            id = targetId,
                            name = safeStr(local?.name ?: remote?.name ?: c.deletedMeta?.name),
                            league = safeStr(local?.league ?: remote?.league ?: c.deletedMeta?.league, "GREAT LEAGUE"),
                            combatMode = mode,
                            updatedAt = delTs
                        )
                        deletedIdsToPush.add(targetId)
                        deletedTimestampsToPush[targetId] = delTs
                    }
                }
                TeamDeltaResolutionChoice.RESTORE_KEEP -> {
                    val candidate = local ?: remote
                    if (candidate != null) {
                        val bumpTs = max(nowMs, max(c.deletedMeta?.updatedAt ?: 0L, candidate.updatedAt) + 1L)
                        val restored = normalizeRecordMode(candidate.copy(combatMode = mode, updatedAt = bumpTs))
                        upsertInto(targetList, restored)
                        targetDelSet.remove(restored.id)
                        delMetaMap.remove(restored.id)
                        teamsToPush.add(restored)
                        baselines[restored.id] = TeamSyncBaselineRecord(
                            id = restored.id,
                            sig = computeCanonicalTeamContentSig(restored),
                            name = safeStr(restored.name),
                            combatMode = mode,
                            updatedAt = restored.updatedAt
                        )
                    }
                }
                TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_CLOUD_NAME,
                TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME -> {
                    if (local != null && remote != null) {
                        val keepLocalName = (choice == TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME)
                        val merged = if (keepLocalName) {
                            val bumpTs = max(nowMs, max(local.updatedAt, remote.updatedAt) + 1L)
                            normalizeRecordMode(remote.copy(name = local.name, combatMode = mode, updatedAt = bumpTs, isSelected = local.isSelected))
                        } else {
                            normalizeRecordMode(remote.copy(combatMode = mode, isSelected = local.isSelected))
                        }
                        targetList.removeAll { it.id == local.id }
                        upsertInto(targetList, merged)
                        targetDelSet.remove(merged.id)
                        if (local.id != merged.id) {
                            targetDelSet.add(local.id)
                            baselines.remove(local.id)
                            delMetaMap[local.id] = DeletedTeamMetaRecord(
                                id = local.id,
                                name = safeStr(local.name),
                                league = safeStr(local.league, "GREAT LEAGUE"),
                                combatMode = mode,
                                updatedAt = nowMs
                            )
                            deletedIdsToPush.add(local.id)
                            deletedTimestampsToPush[local.id] = nowMs
                            redirectLogsByMode.getOrPut(mode) { HashMap() }[local.id] = merged.id
                        }
                        if (keepLocalName) {
                            teamsToPush.add(merged)
                        }
                        baselines[merged.id] = TeamSyncBaselineRecord(
                            id = merged.id,
                            sig = computeCanonicalTeamContentSig(merged),
                            name = safeStr(merged.name),
                            combatMode = mode,
                            updatedAt = merged.updatedAt
                        )
                    }
                }
            }
        }

        val editor = prefs.edit()
        editor.putString(OverlayService.PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(gblTeams))
        editor.putString(OverlayService.PREFS_KEY_SHOW6_PRESETS_OF_3, gson.toJson(show6Teams))
        editor.putString(OverlayService.PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(gblDelIds.toList()))
        editor.putString(OverlayService.PREFS_KEY_SHOW6_DELETED_TEAM_IDS, gson.toJson(show6DelIds.toList()))

        // Update selected preset IDs if the currently selected preset was deleted or merged
        val curGblSel = prefs.getString("gbl_selected_preset_id", null).orEmpty()
        val gblRedirect = redirectLogsByMode["gbl"].orEmpty()
        if (gblRedirect.containsKey(curGblSel)) {
            editor.putString("gbl_selected_preset_id", gblRedirect[curGblSel])
        } else if (curGblSel.isNotEmpty() && gblTeams.none { it.id == curGblSel } && gblTeams.isNotEmpty()) {
            editor.putString("gbl_selected_preset_id", gblTeams.first().id)
        }
        val curShow6Sel = prefs.getString(OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID, null).orEmpty()
        val s6Redirect = redirectLogsByMode["show6"].orEmpty()
        if (s6Redirect.containsKey(curShow6Sel)) {
            editor.putString(OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID, s6Redirect[curShow6Sel])
        } else if (curShow6Sel.isNotEmpty() && show6Teams.none { it.id == curShow6Sel } && show6Teams.isNotEmpty()) {
            editor.putString(OverlayService.PREFS_KEY_SHOW6_SELECTED_PRESET_ID, show6Teams.first().id)
        }

        // Redirect BattleLogEntry.presetId for any merged duplicate IDs
        for ((mode, rMap) in redirectLogsByMode) {
            if (rMap.isEmpty()) continue
            val logKey = if (mode == "show6") OverlayService.PREFS_KEY_SHOW6_BATTLE_LOGS else OverlayService.PREFS_KEY_BATTLE_LOGS
            val rawLogs = prefs.getString(logKey, null) ?: continue
            val logs: MutableList<OverlayService.Companion.SyncBattleLogRecord> = try {
                (gson.fromJson<List<OverlayService.Companion.SyncBattleLogRecord>>(rawLogs, logListType) ?: emptyList()).toMutableList()
            } catch (_: Exception) {
                continue
            }
            var mutatedLogs = false
            for (i in logs.indices) {
                val oldPid = logs[i].presetId
                val newPid = rMap[oldPid]
                if (newPid != null) {
                    logs[i] = logs[i].copy(presetId = newPid, updatedAt = max(logs[i].updatedAt, nowMs))
                    mutatedLogs = true
                }
            }
            if (mutatedLogs) {
                editor.putString(logKey, gson.toJson(logs))
            }
        }

        // Preserve any locally confirmed-deleted teams inside local Trash Bin for safety
        for ((mode, trashed) in trashedTeamsByMode) {
            if (trashed.isEmpty()) continue
            val trashKey = if (mode == "show6") OverlayService.PREFS_KEY_SHOW6_DELETED_TEAMS_TRASH else OverlayService.PREFS_KEY_DELETED_TEAMS_TRASH
            val rawTrash = prefs.getString(trashKey, null)
            val existingTrash: MutableList<OverlayService.Companion.SyncTeamPresetRecord> = if (!rawTrash.isNullOrBlank()) {
                try { (gson.fromJson<List<OverlayService.Companion.SyncTeamPresetRecord>>(rawTrash, syncTeamsType) ?: emptyList()).toMutableList() } catch (_: Exception) { ArrayList() }
            } else ArrayList()
            for (t in trashed) {
                existingTrash.removeAll { it.id == t.id }
                existingTrash.add(0, t)
            }
            editor.putString(trashKey, gson.toJson(existingTrash.take(100)))
        }

        saveTeamBaselines(editor, gson, baselines)
        saveDeletedTeamMeta(editor, gson, delMetaMap)
        editor.apply()

        return ResolvedTeamPushBatch(
            teamsToPush = teamsToPush.distinctBy { it.id },
            deletedTeamIds = deletedIdsToPush.toList(),
            deletedTeamTimestamps = deletedTimestampsToPush
        )
    }
}
