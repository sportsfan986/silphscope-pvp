package com.gbl.overlay

import android.content.res.ColorStateList
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Interactive per-delta team conflict resolution dialog shown whenever Cloud Vault sync detects
 * deletion mismatches, concurrent two-sided edits, ambiguous upgrade diffs, or duplicate lineups.
 */
internal fun MainActivity.showTeamSyncConflictResolutionDialog(
    conflicts: List<TeamSyncReconciler.TeamSyncDeltaConflict>,
    onApplyResolutions: (Map<String, TeamSyncReconciler.TeamDeltaResolutionChoice>) -> Unit,
    onDecideLater: () -> Unit
): AlertDialog {
    val density: Float = resources.displayMetrics.density
    fun dp(v: Int): Int = (v * density).roundToInt()

    val rootScroll = ScrollView(this).apply {
        setBackgroundColor(0xFF0F172A.toInt())
        layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }
    val container = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(12), dp(14), dp(12))
    }
    rootScroll.addView(container)

    val subtitleTv = TextView(this).apply {
        text = "Choose how to resolve each difference so all your devices stay identical. Clean non-conflicting updates were already merged."
        textSize = 12f
        setTextColor(0xFFCBD5E1.toInt())
        setPadding(0, 0, 0, dp(10))
    }
    container.addView(subtitleTv)

    val selectedMap: LinkedHashMap<String, TeamSyncReconciler.TeamDeltaResolutionChoice> = LinkedHashMap()
    val radioGroupsByKey: LinkedHashMap<String, Pair<RadioGroup, Map<TeamSyncReconciler.TeamDeltaResolutionChoice, Int>>> = LinkedHashMap()
    val dateFmt = SimpleDateFormat("MMM d, h:mm a", Locale.US)

    fun formatTs(ms: Long): String {
        return if (ms > 1_000_000_000_000L) dateFmt.format(Date(ms)) else "Unknown time"
    }

    fun formatChoiceLabel(
        conflict: TeamSyncReconciler.TeamSyncDeltaConflict,
        choice: TeamSyncReconciler.TeamDeltaResolutionChoice
    ): String {
        val localName: String = TeamSyncReconciler.safeStr(conflict.localTeam?.name).trim().ifEmpty { "This Device" }
        val remoteName: String = TeamSyncReconciler.safeStr(conflict.remoteTeam?.name).trim().ifEmpty { "Cloud" }
        return when (choice) {
            TeamSyncReconciler.TeamDeltaResolutionChoice.USE_CLOUD ->
                "☁️ Use Cloud Version (\"$remoteName\")"
            TeamSyncReconciler.TeamDeltaResolutionChoice.USE_LOCAL ->
                "📱 Use This Device's Version (\"$localName\")"
            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_CLOUD_NAME_LOCAL_BODY ->
                "🔀 Merge: Cloud Name (\"$remoteName\") + Local Team/Moves/IVs"
            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_LOCAL_NAME_CLOUD_BODY ->
                "🔀 Merge: Local Name (\"$localName\") + Cloud Team/Moves/IVs"
            TeamSyncReconciler.TeamDeltaResolutionChoice.KEEP_BOTH ->
                "📋 Keep Both as Separate Teams"
            TeamSyncReconciler.TeamDeltaResolutionChoice.CONFIRM_DELETE ->
                if (conflict.kind == TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE) {
                    "🗑️ Delete on This Device (Match Cloud)"
                } else {
                    "🗑️ Confirm Delete on All Devices"
                }
            TeamSyncReconciler.TeamDeltaResolutionChoice.RESTORE_KEEP ->
                if (conflict.kind == TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE) {
                    "♻️ Keep & Restore on All Devices"
                } else {
                    "☁️ Restore Cloud Team on All Devices"
                }
            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_CLOUD_NAME ->
                "☁️ Merge into Cloud Team (Keep \"$remoteName\")"
            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME ->
                "📱 Merge into Cloud Team (Rename to \"$localName\")"
        }
    }

    if (conflicts.size >= 2) {
        val quickRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, 0, 0, dp(10))
        }
        val btnAllCloud = Button(this).apply {
            text = "☁️ Cloud for All"
            textSize = 11f
            isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt())
            backgroundTintList = ColorStateList.valueOf(0xFF0284C7.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginEnd = dp(6)
            }
            setOnClickListener {
                for (c in conflicts) {
                    val prefChoice = when (c.kind) {
                        TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.CONFIRM_DELETE
                        TeamSyncReconciler.TeamDeltaConflictKind.LOCAL_DELETED_REMOTE_ACTIVE ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.RESTORE_KEEP
                        TeamSyncReconciler.TeamDeltaConflictKind.DUPLICATE_LINEUP_DIFF_ID ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_CLOUD_NAME
                        else -> TeamSyncReconciler.TeamDeltaResolutionChoice.USE_CLOUD
                    }
                    selectedMap[c.conflictKey] = prefChoice
                    val pair = radioGroupsByKey[c.conflictKey]
                    val targetId = pair?.second?.get(prefChoice)
                    if (pair != null && targetId != null) {
                        pair.first.check(targetId)
                    }
                }
            }
        }
        val btnAllLocal = Button(this).apply {
            text = "📱 This Device for All"
            textSize = 11f
            isAllCaps = false
            setTextColor(0xFFFFFFFF.toInt())
            backgroundTintList = ColorStateList.valueOf(0xFF475569.toInt())
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            setOnClickListener {
                for (c in conflicts) {
                    val prefChoice = when (c.kind) {
                        TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.RESTORE_KEEP
                        TeamSyncReconciler.TeamDeltaConflictKind.LOCAL_DELETED_REMOTE_ACTIVE ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.CONFIRM_DELETE
                        TeamSyncReconciler.TeamDeltaConflictKind.DUPLICATE_LINEUP_DIFF_ID ->
                            TeamSyncReconciler.TeamDeltaResolutionChoice.MERGE_INTO_CLOUD_KEEP_LOCAL_NAME
                        else -> TeamSyncReconciler.TeamDeltaResolutionChoice.USE_LOCAL
                    }
                    selectedMap[c.conflictKey] = prefChoice
                    val pair = radioGroupsByKey[c.conflictKey]
                    val targetId = pair?.second?.get(prefChoice)
                    if (pair != null && targetId != null) {
                        pair.first.check(targetId)
                    }
                }
            }
        }
        quickRow.addView(btnAllCloud)
        quickRow.addView(btnAllLocal)
        container.addView(quickRow)
    }

    for (conflict in conflicts) {
        selectedMap[conflict.conflictKey] = conflict.recommendedChoice

        val cardBg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(10).toFloat()
            setColor(0xFF1E293B.toInt())
            setStroke(dp(1).coerceAtLeast(1), 0xFF334155.toInt())
        }
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = cardBg
            setPadding(dp(12), dp(10), dp(12), dp(10))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                bottomMargin = dp(10)
            }
        }

        val modeBadgeText: String = if (conflict.combatMode == "show6") "SHOW 6" else "GBL"
        val kindBadgeText: String = when (conflict.kind) {
            TeamSyncReconciler.TeamDeltaConflictKind.CONCURRENT_EDIT -> "Renamed / Edited on Both"
            TeamSyncReconciler.TeamDeltaConflictKind.AMBIGUOUS_DIFF -> "Version Upgrade / Tied Diff"
            TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE -> "Deleted on Another Device"
            TeamSyncReconciler.TeamDeltaConflictKind.LOCAL_DELETED_REMOTE_ACTIVE -> "Deleted Locally vs Cloud"
            TeamSyncReconciler.TeamDeltaConflictKind.DUPLICATE_LINEUP_DIFF_ID -> "Duplicate Lineup (2 IDs)"
        }
        val badgeColor: Int = when (conflict.kind) {
            TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE,
            TeamSyncReconciler.TeamDeltaConflictKind.LOCAL_DELETED_REMOTE_ACTIVE -> 0xFFF87171.toInt()
            TeamSyncReconciler.TeamDeltaConflictKind.DUPLICATE_LINEUP_DIFF_ID -> 0xFFFBBF24.toInt()
            else -> 0xFF38BDF8.toInt()
        }

        val headerTv = TextView(this).apply {
            val teamTitle: String = TeamSyncReconciler.safeStr(
                conflict.remoteTeam?.name ?: conflict.localTeam?.name ?: conflict.deletedMeta?.name,
                "Unnamed Team"
            )
            val leagueLabel: String = TeamSyncReconciler.safeStr(
                conflict.remoteTeam?.league ?: conflict.localTeam?.league ?: conflict.deletedMeta?.league,
                "GREAT LEAGUE"
            )
            text = "[$modeBadgeText • $kindBadgeText]\n$teamTitle • ${OverlayService.formatShortMetaBadgeStatic(leagueLabel)}"
            textSize = 13f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(badgeColor)
        }
        card.addView(headerTv)

        val metaBuilder = StringBuilder()
        if (conflict.localTeam != null) {
            metaBuilder.append("📱 Local (${formatTs(conflict.localTeam.updatedAt)}): \"${conflict.localTeam.name}\"")
            metaBuilder.append("\n   ${conflict.localTeam.pokemon.take(3).joinToString(" / ") { TeamSyncReconciler.safeStr(it.name) }}")
        } else if (conflict.deletedMeta != null) {
            metaBuilder.append("📱 Local: Deleted (${formatTs(conflict.deletedMeta.updatedAt)})")
        }
        if (conflict.remoteTeam != null) {
            if (metaBuilder.isNotEmpty()) metaBuilder.append("\n")
            metaBuilder.append("☁️ Cloud (${formatTs(conflict.remoteTeam.updatedAt)}): \"${conflict.remoteTeam.name}\"")
            metaBuilder.append("\n   ${conflict.remoteTeam.pokemon.take(3).joinToString(" / ") { TeamSyncReconciler.safeStr(it.name) }}")
        } else if (conflict.kind == TeamSyncReconciler.TeamDeltaConflictKind.REMOTE_DELETED_LOCAL_ACTIVE) {
            if (metaBuilder.isNotEmpty()) metaBuilder.append("\n")
            metaBuilder.append("☁️ Cloud: Deleted (${formatTs(conflict.deletedMeta?.updatedAt ?: 0L)})")
        }
        val summaryTv = TextView(this).apply {
            text = metaBuilder.toString()
            textSize = 11.5f
            setTextColor(0xFFE2E8F0.toInt())
            setPadding(0, dp(6), 0, dp(4))
        }
        card.addView(summaryTv)

        if (conflict.diffLines.isNotEmpty()) {
            val diffsTv = TextView(this).apply {
                text = conflict.diffLines.joinToString("\n") { "• $it" }
                textSize = 11f
                setTextColor(0xFF94A3B8.toInt())
                setPadding(0, 0, 0, dp(6))
            }
            card.addView(diffsTv)
        }

        val rg = RadioGroup(this).apply {
            orientation = RadioGroup.VERTICAL
            gravity = Gravity.START
        }
        val choiceIdMap: LinkedHashMap<TeamSyncReconciler.TeamDeltaResolutionChoice, Int> = LinkedHashMap()
        val idToChoiceMap: HashMap<Int, TeamSyncReconciler.TeamDeltaResolutionChoice> = HashMap()
        for (choice in conflict.availableChoices) {
            val rbId = android.view.View.generateViewId()
            choiceIdMap[choice] = rbId
            idToChoiceMap[rbId] = choice
            val rb = RadioButton(this).apply {
                id = rbId
                text = formatChoiceLabel(conflict, choice)
                textSize = 12f
                setTextColor(0xFFF8FAFC.toInt())
                buttonTintList = ColorStateList.valueOf(0xFF38BDF8.toInt())
                setPadding(dp(4), dp(4), dp(4), dp(4))
            }
            rg.addView(rb)
        }
        choiceIdMap[conflict.recommendedChoice]?.let { rg.check(it) }
        rg.setOnCheckedChangeListener { _, checkedId ->
            val picked = idToChoiceMap[checkedId]
            if (picked != null) {
                selectedMap[conflict.conflictKey] = picked
            }
        }
        radioGroupsByKey[conflict.conflictKey] = rg to choiceIdMap
        card.addView(rg)
        container.addView(card)
    }

    val dialog = AlertDialog.Builder(this)
        .setTitle("🔄 Resolve Team Sync Deltas (${conflicts.size})")
        .setView(rootScroll)
        .setPositiveButton("✅ Apply & Sync All Devices") { _, _ ->
            onApplyResolutions(LinkedHashMap(selectedMap))
        }
        .setNegativeButton("Decide Later") { _, _ ->
            onDecideLater()
        }
        .create()

    dialog.setOnCancelListener {
        onDecideLater()
    }
    dialog.show()
    return dialog
}
