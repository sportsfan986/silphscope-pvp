package com.gbl.overlay

import android.os.Build
import java.util.UUID

/**
 * Shared data models for GBL & Show 6 Team Presets, Battle Log Entries, Seasons, and Theme Palettes.
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
    val synergySummary: String = "",
    val combatMode: String = "gbl"
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
