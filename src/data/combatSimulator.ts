import { type FastMove, type ChargedMove, type PokemonStats, type TeamMember, normalizeLeagueName, getTypeMultiplier, POKEMON_DATABASE, abbrMove5, resolveFastMove, calculateChargedDamage, computeEffectiveStatsForLeague, LIVE_RANKINGS_MAP, simulateTurnByTurnChargedCycle, SPECIES_FAST_MOVES_POOL, SPECIES_CHARGED_MOVES_POOL, formatMoveIdToDisplayName, buildChargedMoveFromName, applyRankingMovesToPokemonStats } from "./pokemonDb";
import { canonicalizeMetaPokemonName, ACTIVE_PRECOMPUTED_TEAM_9X9_STATE, buildPrecomputedTeamSignature, evaluateFastRoughShieldBattleRating } from "./teamAndMetaEngine";

export type OppCountMode = "my_fasts" | "opp_fasts";

export interface TapNodeInfo {
  tap: number;
  label: string;
  state: "safe" | "leak" | "catch" | "cmp" | "uncharged" | "cmp-loss";
  isCatchOrCmp: boolean;
}

export interface BenchThreatInfo {
  name: string;
  dmgPct: number;
  eff: number;
  tier: "resist" | "neutral" | "weak";
}

export interface TeamDamageCell {
  name: string;
  code: string;
  dmgPct: number;
  eff: number;
  tier: "resist" | "neutral" | "weak";
  isActive: boolean;
  isEmpty?: boolean;
}

export interface MoveCycleSegment {
  cycleIndex: number;
  startTurn: number;
  readyTurn: number;
  turnSpan: number;
  widthPct: number;
  startTap: number;
  readyTap: number;
  rangeLabel: string;
  readyLabel: string;
  hasZeroSneak: boolean;
  readyState: "cmp" | "catch" | "cmp-loss" | "safe";
}

export interface OpponentMoveTimingRow {
  name: string;
  shortName: string;
  code: string;
  energy: number;
  oppFasts: number;
  oppReadyTurn: number;
  myTapAtReady: number;
  displayReadyCount: number;
  myCapTap: number;
  coAligned: boolean;
  winsCmp: boolean;
  activeName: string;
  activeDmgPct: number;
  activeEff: number;
  safeRangeLabel: string;
  maxHorizonTurns: number;
  cycles: MoveCycleSegment[];
  tapNodes: TapNodeInfo[];
  bench: BenchThreatInfo[];
  teamDamages: TeamDamageCell[];
}

export interface MyMoveTimingRow {
  name: string;
  shortName: string;
  energy: number;
  myTapsNeeded: number;
  myReadyTurn: number;
  dmgPct: number;
  eff: number;
  state: "safe" | "cmp" | "cmp-loss" | "catch";
  safeThrowLabel: string;
  hasZeroSneak: boolean;
  maxHorizonTurns: number;
  cycles: MoveCycleSegment[];
  tapNodes: TapNodeInfo[];
  oppDamages: TeamDamageCell[];
}

export function abbrPokeCode3(name: string): string {
  if (!name) return "---";
  return name
    .replace(/^Shadow\s+/i, "")
    .replace(/^Kanto\s+/i, "")
    .replace(/^Alolan\s+/i, "")
    .replace(/^Galarian\s+/i, "")
    .replace(/^Hisuian\s+/i, "")
    .split(" ")[0]
    .slice(0, 3)
    .toUpperCase();
}

/**
 * Helper to compute the shared maximum 1st-throw turn horizon across all 5 moves (Opponent's 3 + Player's 2)
 */
export function computeSharedHorizonTurns(
  oppStats: PokemonStats,
  userStats: PokemonStats,
  userCustomChargedMoves: string[] | undefined,
  userFastMove: FastMove,
  enable4ChargedMoves: boolean = false
): number {
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;

  const userFastTurns = userFastMove.turns || 2;
  const userFastEnergy = userFastMove.energyGain || userFastTurns * 4;

  const oppFirstReadyTurns = oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).map((cm) => {
    const mEnergy = cm.energyCost || 50;
    const fasts = Math.max(1, Math.ceil(mEnergy / oppFastEnergy));
    return fasts * oppFastTurns;
  });

  const userMovesList =
    userCustomChargedMoves && userCustomChargedMoves.length > 0
      ? userCustomChargedMoves
      : userStats.chargedMoves.slice(0, 2).map((m) => m.name);

  const userFirstReadyTurns = userMovesList.map((mName, idx) => {
    const existing =
      userStats.chargedMoves.find((m) => m.name.toLowerCase() === mName.toLowerCase()) ||
      userStats.chargedMoves[idx];
    const mEnergy = existing?.energyCost || 50;
    const fasts = Math.max(1, Math.ceil(mEnergy / userFastEnergy));
    return fasts * userFastTurns;
  });

  return Math.max(4, ...oppFirstReadyTurns, ...userFirstReadyTurns);
}

/**
 * Computes per-move timing, catch/CMP windows, turn-aligned multi-cycle segments,
 * and 3-column team threat rows.
 */
export function calculateOpponentMoveTimingRows(
  oppStatsRaw: PokemonStats,
  userLeadName: string,
  teamNames: string[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number,
  userFastMoveNameOverride?: string,
  userCustomChargedMoves?: string[],
  oppCountMode: OppCountMode = "my_fasts",
  league: string = "MASTER LEAGUE",
  teamMembers?: TeamMember[],
  enable4ChargedMoves: boolean = false
): { rows: OpponentMoveTimingRow[]; winsCmp: boolean; userFastTurns: number; maxHorizonTurns: number } {
  const oppStats = computeEffectiveStatsForLeague(oppStatsRaw, league);
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const rawUserStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];
  const activeMember = teamMembers?.find((m) => m.name.toLowerCase() === userLeadName.toLowerCase());
  const userStats = computeEffectiveStatsForLeague(rawUserStats, league, activeMember?.cp, activeMember?.ivs);

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const resolvedUserFast = resolveFastMove(userStats, userFastMoveNameOverride);
  const userFastTurns = userFastTurnsOverride || resolvedUserFast.turns || 2;
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;

  const maxHorizonTurns = computeSharedHorizonTurns(
    oppStats,
    userStats,
    userCustomChargedMoves,
    {
      ...resolvedUserFast,
      turns: userFastTurns
    },
    enable4ChargedMoves
  );

  const benchNames = teamNames.filter((n) => n.toLowerCase() !== userLeadName.toLowerCase()).slice(0, 2);

  const rows: OpponentMoveTimingRow[] = oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).map((cm) => {
    const mEnergy = cm.energyCost || 50;
    const oppFasts = Math.max(1, Math.ceil(mEnergy / oppFastEnergy));
    const oppReadyTurn = oppFasts * oppFastTurns;

    const myTapAtReady = Math.max(1, Math.ceil(oppReadyTurn / userFastTurns));
    const displayReadyCount = oppCountMode === "opp_fasts" ? oppFasts : myTapAtReady;
    const myCapTap = Math.max(myTapAtReady + 1, Math.ceil((oppReadyTurn * 2) / userFastTurns));
    const coAligned = oppReadyTurn % userFastTurns === 0;

    // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
    const cycles: MoveCycleSegment[] = [];
    let leftoverEnergy = 0;
    let cumOppFasts = 0;
    let prevTurn = 0;
    let prevDisplayTap = 0;

    for (let cycleIdx = 1; cycleIdx <= 3; cycleIdx++) {
      const energyNeeded = Math.max(1, mEnergy - leftoverEnergy);
      const fastsInCycle = Math.max(1, Math.ceil(energyNeeded / oppFastEnergy));
      leftoverEnergy = leftoverEnergy + fastsInCycle * oppFastEnergy - mEnergy;
      cumOppFasts += fastsInCycle;
      const readyTurn = cumOppFasts * oppFastTurns;

      if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
        break;
      }

      const turnSpan = Math.max(1, readyTurn - prevTurn);
      const widthPct = Math.min(100, Math.max(8, Number(((turnSpan / maxHorizonTurns) * 100).toFixed(2))));

      const readyTap =
        oppCountMode === "opp_fasts"
          ? cumOppFasts
          : Math.max(prevDisplayTap + 1, Math.ceil(readyTurn / userFastTurns));
      const startTap = prevDisplayTap + 1;
      const rangeEnd = readyTap - 1;

      let rangeLabel = "";
      if (readyTap > startTap) {
        rangeLabel = rangeEnd === startTap ? `${startTap}` : `${startTap}–${rangeEnd}`;
      }

      cycles.push({
        cycleIndex: cycleIdx,
        startTurn: prevTurn,
        readyTurn,
        turnSpan,
        widthPct,
        startTap,
        readyTap,
        rangeLabel,
        readyLabel: `#${readyTap}`,
        hasZeroSneak: false,
        readyState: winsCmp ? "cmp" : "catch"
      });

      prevTurn = readyTurn;
      prevDisplayTap = readyTap;
    }

    const actvDmg = calculateChargedDamage(oppStats, userStats, cm, isOppShadow, isUserShadow);
    const activeDmgPct = actvDmg.percentage;
    const activeEff = actvDmg.mult;

    // All 3 team Pokemon in fixed team slot order [0, 1, 2]
    const teamDamages: TeamDamageCell[] = [0, 1, 2].map((slotIdx) => {
      const tName = teamNames[slotIdx] || "";
      if (!tName) {
        return {
          name: "—",
          code: "—",
          dmgPct: 0,
          eff: 1.0,
          tier: "neutral",
          isActive: false,
          isEmpty: true
        };
      }
      const cleanT = tName.replace(/^Shadow\s+/i, "").trim();
      const rawTStats =
        POKEMON_DATABASE[tName] ||
        POKEMON_DATABASE[cleanT] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanT.toLowerCase()) ||
        Object.values(POKEMON_DATABASE)[0];
      const slotMember = teamMembers?.[slotIdx];
      const tStats = computeEffectiveStatsForLeague(rawTStats, league, slotMember?.cp, slotMember?.ivs);
      const isTShadow = tName.toLowerCase().startsWith("shadow ");
      const tDmg = calculateChargedDamage(oppStats, tStats, cm, isOppShadow, isTShadow);
      const tier: "resist" | "neutral" | "weak" =
        tDmg.percentage <= 35 ? "resist" : tDmg.percentage >= 60 || tDmg.mult >= 1.5 ? "weak" : "neutral";
      const isActive = tName.toLowerCase() === userLeadName.toLowerCase();
      return {
        name: tName,
        code: abbrPokeCode3(tName),
        dmgPct: tDmg.percentage,
        eff: tDmg.mult,
        tier,
        isActive
      };
    });

    const bench: BenchThreatInfo[] = benchNames.map((bName) => {
      const cleanB = bName.replace(/^Shadow\s+/i, "").trim();
      const rawBStats =
        POKEMON_DATABASE[bName] ||
        POKEMON_DATABASE[cleanB] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanB.toLowerCase()) ||
        Object.values(POKEMON_DATABASE)[0];
      const benchMember = teamMembers?.find((m) => m.name.toLowerCase() === bName.toLowerCase());
      const bStats = computeEffectiveStatsForLeague(rawBStats, league, benchMember?.cp, benchMember?.ivs);
      const isBShadow = bName.toLowerCase().startsWith("shadow ");
      const bDmg = calculateChargedDamage(oppStats, bStats, cm, isOppShadow, isBShadow);
      const tier: "resist" | "neutral" | "weak" =
        bDmg.percentage <= 35 ? "resist" : bDmg.percentage >= 65 || bDmg.mult >= 1.5 ? "weak" : "neutral";
      return {
        name: bName,
        dmgPct: bDmg.percentage,
        eff: bDmg.mult,
        tier
      };
    });

    const maxNode = displayReadyCount;
    const tapNodes: TapNodeInfo[] = [];
    for (let k = 1; k <= maxNode; k++) {
      let state: "safe" | "leak" | "catch" | "cmp";
      if (k === maxNode) {
        state = winsCmp ? "cmp" : "catch";
      } else if ((k * userFastTurns) % oppFastTurns !== 0) {
        state = "safe";
      } else {
        state = "leak";
      }
      tapNodes.push({
        tap: k,
        label: `${k}`,
        state,
        isCatchOrCmp: k === maxNode
      });
    }

    const safeEnd = Math.max(1, displayReadyCount - 1);
    const safeRangeLabel = safeEnd <= 1 ? "1" : `1–${safeEnd}`;

    return {
      name: cm.name,
      shortName: abbrMove5(cm.name),
      code: cm.code,
      energy: mEnergy,
      oppFasts,
      oppReadyTurn,
      myTapAtReady,
      displayReadyCount,
      myCapTap,
      coAligned,
      winsCmp,
      activeName: userLeadName,
      activeDmgPct,
      activeEff,
      safeRangeLabel,
      maxHorizonTurns,
      cycles,
      tapNodes,
      bench,
      teamDamages
    };
  });

  return { rows, winsCmp, userFastTurns, maxHorizonTurns };
}

/**
 * Computes player's charged move timing rows with turn-aligned multi-cycle segments,
 * leak-free safe throw numbers, and 3-column opponent damage matrix.
 */
export function calculateMyMoveTimingRows(
  userLeadName: string,
  oppStatsRaw: PokemonStats,
  customMoves: string[],
  oppReadyTaps: number[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number,
  userFastMoveNameOverride?: string,
  scannedOpponentNames: string[] = [],
  sharedHorizonTurnsOverride?: number,
  league: string = "MASTER LEAGUE",
  activeUserMember?: TeamMember,
  enable4ChargedMoves: boolean = false
): MyMoveTimingRow[] {
  const oppStats = computeEffectiveStatsForLeague(oppStatsRaw, league);
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const rawUserStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];
  const userStats = computeEffectiveStatsForLeague(
    rawUserStats,
    league,
    activeUserMember?.cp,
    activeUserMember?.ivs
  );

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const resolvedUserFast = resolveFastMove(userStats, userFastMoveNameOverride);
  const userFastTurns = userFastTurnsOverride || resolvedUserFast.turns || 2;
  const userFastEnergy = resolvedUserFast.energyGain || userFastTurns * 4;
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;
  const maxOppTap = oppReadyTaps.length > 0 ? Math.max(...oppReadyTaps) : 4;

  const maxHorizonTurns =
    sharedHorizonTurnsOverride ||
    computeSharedHorizonTurns(
      oppStats,
      userStats,
      customMoves,
      {
        ...resolvedUserFast,
        turns: userFastTurns
      },
      enable4ChargedMoves
    );

  // Compute all opponent ready turns (across up to 3 cycles) for CMP tie detection
  const oppReadyTurnsSet = new Set<number>();
  oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).forEach((cm) => {
    const mE = cm.energyCost || 50;
    let leftE = 0;
    let cumF = 0;
    for (let c = 1; c <= 3; c++) {
      const needE = Math.max(1, mE - leftE);
      const f = Math.max(1, Math.ceil(needE / oppFastEnergy));
      leftE = leftE + f * oppFastEnergy - mE;
      cumF += f;
      oppReadyTurnsSet.add(cumF * oppFastTurns);
    }
  });

  const oppSlots = scannedOpponentNames.length > 0 ? scannedOpponentNames : [oppStats.name];

  return customMoves.map((mName) => {
    const existing = buildChargedMoveFromName(mName, userStats.types[0], userStats.chargedMoves);

    const mEnergy = existing.energyCost || 50;
    const myTapsNeeded = Math.max(1, Math.ceil(mEnergy / userFastEnergy));
    const myReadyTurn = myTapsNeeded * userFastTurns;
    const actvDmg = calculateChargedDamage(userStats, oppStats, existing, isUserShadow, isOppShadow);

    // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
    const cycles: MoveCycleSegment[] = [];
    let leftoverEnergy = 0;
    let cumMyFasts = 0;
    let prevTurn = 0;
    let prevDisplayTap = 0;

    for (let cycleIdx = 1; cycleIdx <= 3; cycleIdx++) {
      const energyNeeded = Math.max(1, mEnergy - leftoverEnergy);
      const fastsInCycle = Math.max(1, Math.ceil(energyNeeded / userFastEnergy));
      leftoverEnergy = leftoverEnergy + fastsInCycle * userFastEnergy - mEnergy;
      cumMyFasts += fastsInCycle;
      const readyTurn = cumMyFasts * userFastTurns;

      if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
        break;
      }

      const turnSpan = Math.max(1, readyTurn - prevTurn);
      const widthPct = Math.min(100, Math.max(8, Number(((turnSpan / maxHorizonTurns) * 100).toFixed(2))));

      const readyTap = cumMyFasts;
      const startTap = prevDisplayTap + 1;
      const rangeEnd = readyTap - 1;

      const cycleSafeTaps: number[] = [];
      for (let k = startTap; k <= rangeEnd; k++) {
        if ((k * userFastTurns) % oppFastTurns !== 0) {
          cycleSafeTaps.push(k);
        }
      }
      const cycleHasZeroSneak = cycleSafeTaps.length > 0;

      let rangeLabel = "";
      if (readyTap > startTap) {
        if (cycleHasZeroSneak) {
          rangeLabel = `Safe ${cycleSafeTaps.slice(0, 3).join(",")}`;
        } else {
          rangeLabel = rangeEnd === startTap ? `${startTap}` : `${startTap}–${rangeEnd}`;
        }
      }

      const isCmpTurn = oppReadyTurnsSet.has(readyTurn) || oppReadyTaps.includes(readyTap);
      const cycleReadyState: "safe" | "cmp" | "cmp-loss" = isCmpTurn
        ? winsCmp
          ? "cmp"
          : "cmp-loss"
        : "safe";

      cycles.push({
        cycleIndex: cycleIdx,
        startTurn: prevTurn,
        readyTurn,
        turnSpan,
        widthPct,
        startTap,
        readyTap,
        rangeLabel,
        readyLabel: `#${readyTap}`,
        hasZeroSneak: cycleHasZeroSneak,
        readyState: cycleReadyState
      });

      prevTurn = readyTurn;
      prevDisplayTap = readyTap;
    }

    const oppDamages: TeamDamageCell[] = [0, 1, 2].map((slotIdx) => {
      const oName = oppSlots[slotIdx] || "";
      if (!oName) {
        return {
          name: "—",
          code: "—",
          dmgPct: 0,
          eff: 1.0,
          tier: "neutral",
          isActive: slotIdx === 0,
          isEmpty: true
        };
      }
      const cleanO = oName.replace(/^Shadow\s+/i, "").trim();
      const rawOStats =
        POKEMON_DATABASE[oName] ||
        POKEMON_DATABASE[cleanO] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanO.toLowerCase()) ||
        oppStats;
      const oStats = computeEffectiveStatsForLeague(rawOStats, league);
      const isOShadow = (slotIdx === 0 && isOppShadow) || oName.toLowerCase().startsWith("shadow ");
      const oDmg = calculateChargedDamage(userStats, oStats, existing, isUserShadow, isOShadow);
      const tier: "resist" | "neutral" | "weak" =
        oDmg.percentage >= 60 || oDmg.mult >= 1.5
          ? "resist"
          : oDmg.percentage <= 35
          ? "weak"
          : "neutral";
      return {
        name: oName,
        code: abbrPokeCode3(oName),
        dmgPct: oDmg.percentage,
        eff: oDmg.mult,
        tier,
        isActive: slotIdx === 0
      };
    });

    const maxNode = Math.min(7, Math.max(myTapsNeeded, maxOppTap));
    const tapNodes: TapNodeInfo[] = [];
    for (let k = 1; k <= maxNode; k++) {
      let state: "safe" | "cmp" | "cmp-loss" | "uncharged";
      if (k < myTapsNeeded) {
        state = "uncharged";
      } else if (oppReadyTaps.includes(k)) {
        state = winsCmp ? "cmp" : "cmp-loss";
      } else {
        state = "safe";
      }
      tapNodes.push({
        tap: k,
        label: `${k}`,
        state,
        isCatchOrCmp: k === myTapsNeeded
      });
    }

    const firstCycle = cycles[0];
    const readyState = firstCycle ? firstCycle.readyState : "safe";
    const hasZeroSneak = firstCycle ? firstCycle.hasZeroSneak : false;
    const safeThrowLabel = firstCycle ? firstCycle.rangeLabel : myTapsNeeded <= 1 ? "1" : `1–${myTapsNeeded - 1}`;

    return {
      name: mName,
      shortName: abbrMove5(mName),
      energy: mEnergy,
      myTapsNeeded,
      myReadyTurn,
      dmgPct: actvDmg.percentage,
      eff: actvDmg.mult,
      state: readyState,
      safeThrowLabel,
      hasZeroSneak,
      maxHorizonTurns,
      cycles,
      tapNodes,
      oppDamages
    };
  });
}

export interface MatchupTierThresholds {
  swMin: number;
  wMin: number;
  lMax: number;
  slMax: number;
}

export const DEFAULT_MATCHUP_TIER_THRESHOLDS: MatchupTierThresholds = {
  swMin: 620,
  wMin: 530,
  lMax: 470,
  slMax: 380
};

export const MATCHUP_TIER_THRESHOLDS_STORAGE_KEY = "gbl_matchup_tier_thresholds_v1";

export function getStoredMatchupTierThresholds(): MatchupTierThresholds {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
    }
    const raw = window.localStorage.getItem(MATCHUP_TIER_THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const slMax = Math.max(100, Math.min(800, Number(parsed?.slMax) || DEFAULT_MATCHUP_TIER_THRESHOLDS.slMax));
    const lMax = Math.max(slMax + 1, Math.min(850, Number(parsed?.lMax) || DEFAULT_MATCHUP_TIER_THRESHOLDS.lMax));
    const wMin = Math.max(lMax + 1, Math.min(900, Number(parsed?.wMin) || DEFAULT_MATCHUP_TIER_THRESHOLDS.wMin));
    const swMin = Math.max(wMin + 1, Math.min(950, Number(parsed?.swMin) || DEFAULT_MATCHUP_TIER_THRESHOLDS.swMin));
    return { swMin, wMin, lMax, slMax };
  } catch {
    return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
  }
}

/**
 * Computes 5-tier 0s/1s/2s matchup codes ("SW,W,N,L,SL"):
 * - SW = Strong Win (rating >= swMin, default 620)
 * - W  = Win (wMin <= rating < swMin, default 530 <= rating < 620)
 * - N  = Neutral / Grey (lMax < rating < wMin, default 470 < rating < 530)
 * - L  = Loss (slMax < rating <= lMax, default 380 < rating <= 470)
 * - SL = Strong Loss (rating <= slMax, default <= 380)
 */
export function calculateShieldMatrix(
  oppName: string,
  teamMembers: Array<TeamMember | string>,
  isOppShadow: boolean = false,
  league: string = "MASTER LEAGUE",
  customThresholds?: MatchupTierThresholds
): Record<string, string> {
  const thresholds = customThresholds || getStoredMatchupTierThresholds();
  const result: Record<string, string> = {};
  const effectiveOppShadow = isOppShadow || /^Shadow\s+/i.test(oppName) || oppName.toLowerCase().includes("(shadow)");
  const cleanOppName = oppName.replace(/^Shadow\s+/i, "").replace(/\s*\(Shadow\)/i, "").trim();
  const oppTarget = effectiveOppShadow ? `Shadow ${cleanOppName}` : cleanOppName;
  const oppLookupKey = oppTarget.toLowerCase();

  const toTier = (r: number): string => {
    if (r >= thresholds.swMin) return "SW";
    if (r >= thresholds.wMin) return "W";
    if (r > thresholds.lMax) return "N";
    if (r > thresholds.slMax) return "L";
    return "SL";
  };

  // O(1) Precomputed Top-200 League Meta Lookup (when active team's 9x9 matrix was precomputed before overlay launch)
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const teamSig = buildPrecomputedTeamSignature(teamMembers, normLg);
  if (
    ACTIVE_PRECOMPUTED_TEAM_9X9_STATE &&
    ACTIVE_PRECOMPUTED_TEAM_9X9_STATE.teamSignature === teamSig
  ) {
    const preEntry =
      ACTIVE_PRECOMPUTED_TEAM_9X9_STATE.opponentsMap.get(oppLookupKey) ||
      ACTIVE_PRECOMPUTED_TEAM_9X9_STATE.opponentsMap.get(
        (canonicalizeMetaPokemonName(oppTarget) || oppTarget).toLowerCase()
      );
    if (preEntry) {
      teamMembers.forEach((_, idx) => {
        const key = `p${idx + 1}`;
        const slotGrid = preEntry.slotGrids[idx];
        if (slotGrid) {
          const r0s = slotGrid[0][0];
          const r1s = slotGrid[1][1];
          const r2s = slotGrid[2][2];
          result[key] = `${toTier(r0s)},${toTier(r1s)},${toTier(r2s)}`;
        } else {
          result[key] = "N,N,N";
        }
      });
      return result;
    }
    // Non-Top-200 Opponent Fallback during active overlay session: use ultra-fast real-time single-moveset rough math
    teamMembers.forEach((member, idx) => {
      const key = `p${idx + 1}`;
      const rating0s = evaluateFastRoughShieldBattleRating(member, oppTarget, 0, 0, league);
      const rating1s = evaluateFastRoughShieldBattleRating(member, oppTarget, 1, 1, league);
      const rating2s = evaluateFastRoughShieldBattleRating(member, oppTarget, 2, 2, league);
      result[key] = `${toTier(rating0s)},${toTier(rating1s)},${toTier(rating2s)}`;
    });
    return result;
  }

  teamMembers.forEach((member, idx) => {
    const key = `p${idx + 1}`;
    const rating0s = evaluateDiscreteShieldBattleRating(member, oppTarget, 0, 0, league);
    const rating1s = evaluateDiscreteShieldBattleRating(member, oppTarget, 1, 1, league);
    const rating2s = evaluateDiscreteShieldBattleRating(member, oppTarget, 2, 2, league);

    result[key] = `${toTier(rating0s)},${toTier(rating1s)},${toTier(rating2s)}`;
  });

  return result;
}

export interface MachineBrThresholds {
  eliteMin: number;
  solidMin: number;
  playableMin: number;
  riskyMin: number;
}

export const DEFAULT_MACHINE_BR_THRESHOLDS: MachineBrThresholds = {
  eliteMin: 650,
  solidMin: 610,
  playableMin: 580,
  riskyMin: 540
};

export const MACHINE_BR_THRESHOLDS_STORAGE_KEY = "gbl_machine_br_thresholds_v1";

export function getStoredMachineBrThresholds(): MachineBrThresholds {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
    }
    const raw = window.localStorage.getItem(MACHINE_BR_THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const riskyMin = Math.max(350, Math.min(800, Number(parsed?.riskyMin) || DEFAULT_MACHINE_BR_THRESHOLDS.riskyMin));
    const playableMin = Math.max(riskyMin + 1, Math.min(850, Number(parsed?.playableMin) || DEFAULT_MACHINE_BR_THRESHOLDS.playableMin));
    const solidMin = Math.max(playableMin + 1, Math.min(900, Number(parsed?.solidMin) || DEFAULT_MACHINE_BR_THRESHOLDS.solidMin));
    const eliteMin = Math.max(solidMin + 1, Math.min(950, Number(parsed?.eliteMin) || DEFAULT_MACHINE_BR_THRESHOLDS.eliteMin));
    return { eliteMin, solidMin, playableMin, riskyMin };
  } catch {
    return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
  }
}

export interface BrTierBadgeStyle {
  tier: string;
  label: string;
  colorHex: string;
  colorClass: string;
  badgeClass: string;
  textClass: string;
}

/**
 * Color codes single-slot aggregate ratings (Lead Agg BR, Safe Swap BR, Closer Swap BR)
 * using the 5-Tier Matchup Thresholds (SW / W / N / L / SL) configured in Settings.
 */
export function getSingleSlotBrTierInfo(
  rating: number,
  customThresholds?: MatchupTierThresholds
): BrTierBadgeStyle {
  const t = customThresholds || getStoredMatchupTierThresholds();
  const r = Math.round(Number.isFinite(rating) ? rating : 500);
  if (r >= t.swMin) {
    return {
      tier: "SW",
      label: "Strong Win",
      colorHex: "#10b981",
      colorClass: "text-emerald-300 bg-emerald-500/20 border-emerald-500/50",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      textClass: "text-emerald-400"
    };
  }
  if (r >= t.wMin) {
    return {
      tier: "W",
      label: "Favorable",
      colorHex: "#4ade80",
      colorClass: "text-green-300 bg-green-500/20 border-green-500/40",
      badgeClass: "bg-green-500/20 text-green-300 border-green-500/40",
      textClass: "text-green-400"
    };
  }
  if (r > t.lMax) {
    return {
      tier: "N",
      label: "Neutral",
      colorHex: "#94a3b8",
      colorClass: "text-slate-200 bg-slate-700/60 border-slate-500/40",
      badgeClass: "bg-slate-700/60 text-slate-200 border-slate-500/40",
      textClass: "text-slate-300"
    };
  }
  if (r > t.slMax) {
    return {
      tier: "L",
      label: "Unfavorable",
      colorHex: "#f87171",
      colorClass: "text-red-300 bg-red-500/20 border-red-500/40",
      badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
      textClass: "text-red-400"
    };
  }
  return {
    tier: "SL",
    label: "Strong Loss",
    colorHex: "#f43f5e",
    colorClass: "text-rose-300 bg-rose-600/25 border-rose-500/50",
    badgeClass: "bg-rose-600/25 text-rose-300 border-rose-500/50",
    textClass: "text-rose-400"
  };
}

/**
 * Color codes 3-Pokemon Machine Aggregate BR (theoretical alignment ceiling)
 * using the dedicated Machine Aggregate BR Thresholds from Settings.
 */
export function getMachineBrTierInfo(
  rating: number,
  customThresholds?: MachineBrThresholds
): BrTierBadgeStyle {
  const t = customThresholds || getStoredMachineBrThresholds();
  const r = Math.round(Number.isFinite(rating) ? rating : 600);
  if (r >= t.eliteMin) {
    return {
      tier: "ELITE",
      label: "Well-Rounded Core",
      colorHex: "#10b981",
      colorClass: "text-emerald-300 bg-emerald-500/20 border-emerald-500/50",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      textClass: "text-emerald-400"
    };
  }
  if (r >= t.solidMin) {
    return {
      tier: "SOLID",
      label: "Solid Coverage",
      colorHex: "#4ade80",
      colorClass: "text-green-300 bg-green-500/20 border-green-500/40",
      badgeClass: "bg-green-500/20 text-green-300 border-green-500/40",
      textClass: "text-green-400"
    };
  }
  if (r >= t.playableMin) {
    return {
      tier: "PLAYABLE",
      label: "Playable / Moderate Gaps",
      colorHex: "#fbbf24",
      colorClass: "text-amber-300 bg-amber-500/20 border-amber-500/45",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/45",
      textClass: "text-amber-300"
    };
  }
  if (r >= t.riskyMin) {
    return {
      tier: "VULNERABLE",
      label: "Core Vulnerability",
      colorHex: "#fb923c",
      colorClass: "text-orange-300 bg-orange-500/20 border-orange-500/45",
      badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/45",
      textClass: "text-orange-400"
    };
  }
  return {
    tier: "BLINDSPOT",
    label: "Severe Blindspot",
    colorHex: "#f43f5e",
    colorClass: "text-rose-300 bg-rose-600/25 border-rose-500/50",
    badgeClass: "bg-rose-600/25 text-rose-300 border-rose-500/50",
    textClass: "text-rose-400"
  };
}

export const ALL_18_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy"
] as const;

export function resolveCombatPokemonForEngine(
  input: TeamMember | string,
  league: string = "GREAT LEAGUE"
): {
  stats: PokemonStats & { resolvedCp: number };
  isShadow: boolean;
  fastMove: FastMove;
  chargedMoves: ChargedMove[];
} {
  const rawName = typeof input === "string" ? input : input.name;
  const customCp = typeof input === "object" ? input.cp : undefined;
  const customIvs = typeof input === "object" ? input.ivs : undefined;
  const isShadow =
    /^Shadow\s+/i.test(rawName || "") ||
    (rawName || "").toLowerCase().includes("(shadow)");
  const cleanName = (rawName || "")
    .replace(/^Shadow\s+/i, "")
    .replace(/\s*\(Shadow\)/i, "")
    .trim();

  const dbValues = Object.values(POKEMON_DATABASE);
  const rawBase =
    POKEMON_DATABASE[rawName] ||
    POKEMON_DATABASE[cleanName] ||
    dbValues.find(
      (p) =>
        p.name.toLowerCase() === (rawName || "").toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")
    ) ||
    dbValues.find((p) => p.name.toLowerCase().includes(cleanName.toLowerCase())) ||
    dbValues[0];

  const rankedStats = applyRankingMovesToPokemonStats(rawBase, league, isShadow);
  const effectiveStats = computeEffectiveStatsForLeague(
    rankedStats,
    league,
    customCp,
    customIvs,
    isShadow
  );

  const customFastName = typeof input === "object" ? input.fastMove : undefined;
  const fastMove = resolveFastMove(effectiveStats, customFastName);

  let chargedMoves = effectiveStats.chargedMoves.slice(0, 2);
  if (typeof input === "object") {
    const customNames = [input.chargedMove1, input.chargedMove2].filter(
      (m): m is string => Boolean(m && m.trim())
    );
    if (customNames.length > 0) {
      chargedMoves = customNames.map((mName) =>
        buildChargedMoveFromName(mName, effectiveStats.types[0], effectiveStats.chargedMoves)
      );
    }
  }
  if (chargedMoves.length === 0) {
    chargedMoves = [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 }
    ];
  }

  return {
    stats: effectiveStats,
    isShadow,
    fastMove,
    chargedMoves
  };
}

export const DISCRETE_SHIELD_BR_CACHE = new Map<string, number>();
export const POSITION_WEIGHTED_BR_CACHE = new Map<string, PositionWeightedMatchupRatings>();

export function buildCombatantCacheKey(input: TeamMember | string): string {
  if (typeof input === "string") return input.trim().toLowerCase();
  return `${(input.name || "").trim().toLowerCase()}|${input.cp || ""}|${input.ivs || ""}|${input.fastMove || ""}|${input.chargedMove1 || ""}|${input.chargedMove2 || ""}`;
}

/**
 * Evaluates a discrete head-to-head Battle Rating (150..850, 500 neutral)
 * for any shield combination (userShields in 0..2, oppShields in 0..2).
 *
 * Includes explicit PvP battle math for:
 * 1. Mimikyu (Disguise):
 *    - Until Mimikyu's Disguise is busted, the opponent always throws their fastest (lowest-energy)
 *      Charged Attack knowing it must be absorbed by either a Protect Shield or Disguise.
 *    - Takes the exact average of:
 *      (a) Using all Protect Shields before busting Disguise (delays Busted Form -1 Defense drop
 *          and forces opponent to throw fastest/cheapest charged attacks across s + 1 cycles), and
 *      (b) Using Disguise first on the opponent's 1st fastest Charged Attack before using Protect Shields
 *          (triggers Busted Form -1 Defense / +25% incoming fast & unshielded damage early while
 *          allowing opponent to threaten heavier charged moves against remaining shields).
 * 2. Aegislash (Stance Change: Shield Forme ⇄ Sword/Blade Forme):
 *    - Models both the damage shift AND energy generation shift between Shield Forme (97 Atk / 291 Def:
 *      1-damage fast moves with boosted 1.28x high energy generation) and Sword/Blade Forme (291 Atk / 97 Def:
 *      2.85x Attack on Charged & Fast moves, 0.78x lower fast energy generation rate, and 0.34x Defense
 *      until reverting to Shield Forme by spending a Protect Shield).
 * 3. Morpeko (Hunger Switch + Aura Wheel):
 *    - Alternating Electric/Dark STAB Aura Wheel cycles with guaranteed +1 Attack stage self-buff.
 * 4. Cramorant (Gulp Missile: Gulping / Gorging Form):
 *    - Surf loads Arrokuda (-1 Def stage on target) or Pikachu (-1 Atk stage on target) + 12.5% HP retaliation.
 */
export function getAvailableMovePoolForPokemon(
  input: PokemonStats | string,
  league: string = "GREAT LEAGUE"
): {
  fastMoves: FastMove[];
  chargedMoves: ChargedMove[];
} {
  const normLeague = normalizeLeagueName(league);

  let stats: PokemonStats;
  let isShadow = false;
  if (typeof input === "string") {
    isShadow = /^Shadow\s+/i.test(input) || input.toLowerCase().includes("(shadow)");
    const clean = input.replace(/^Shadow\s+/i, "").replace(/\s*\(Shadow\)/i, "").trim();
    const dbValues = Object.values(POKEMON_DATABASE);
    const rawBase =
      POKEMON_DATABASE[input] ||
      POKEMON_DATABASE[clean] ||
      dbValues.find(
        (p) =>
          p.name.toLowerCase() === input.toLowerCase() ||
          p.name.toLowerCase() === clean.toLowerCase() ||
          p.speciesId.toLowerCase() === clean.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      ) ||
      dbValues[0];
    stats = applyRankingMovesToPokemonStats(rawBase, normLeague, isShadow);
  } else {
    isShadow =
      input.name.toLowerCase().startsWith("shadow ") ||
      input.speciesId.toLowerCase().endsWith("_shadow");
    stats = applyRankingMovesToPokemonStats(input, normLeague, isShadow);
  }

  const baseKey = stats.speciesId.toLowerCase().replace(/_shadow$/i, "");
  const shortBase = (stats.baseSpecies || baseKey.split("_")[0]).toLowerCase();
  const map = LIVE_RANKINGS_MAP[normLeague];
  const entry = map
    ? isShadow
      ? map.get(`${baseKey}_shadow`) || map.get(baseKey)
      : map.get(baseKey) || map.get(`${baseKey}_shadow`)
    : undefined;

  const poolFast =
    SPECIES_FAST_MOVES_POOL[baseKey] ||
    SPECIES_FAST_MOVES_POOL[shortBase] ||
    SPECIES_FAST_MOVES_POOL[stats.name.toLowerCase()] ||
    SPECIES_FAST_MOVES_POOL[`${baseKey}_shield`] ||
    SPECIES_FAST_MOVES_POOL[`${baseKey}_full_belly`] ||
    [];

  const fastNames: string[] = [];
  const addFastName = (raw?: string) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === "struggle") return;
    if (poolFast.length > 0 && !poolFast.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    if (!fastNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      fastNames.push(trimmed);
    }
  };

  if (entry?.moveset?.[0]) {
    addFastName(formatMoveIdToDisplayName(entry.moveset[0]));
  }
  addFastName(stats.defaultFastMove?.name);
  if (entry?.moves?.fastMoves) {
    for (const fm of entry.moves.fastMoves) {
      addFastName(formatMoveIdToDisplayName(fm.moveId));
    }
  }
  for (const fn of poolFast) {
    addFastName(fn);
  }

  const resolvedFastMoves: FastMove[] = fastNames.map((fn) => resolveFastMove(stats, fn));
  if (resolvedFastMoves.length === 0) {
    resolvedFastMoves.push(resolveFastMove(stats));
  }

  const poolCharged =
    SPECIES_CHARGED_MOVES_POOL[baseKey] ||
    SPECIES_CHARGED_MOVES_POOL[shortBase] ||
    SPECIES_CHARGED_MOVES_POOL[stats.name.toLowerCase()] ||
    SPECIES_CHARGED_MOVES_POOL[`${baseKey}_shield`] ||
    SPECIES_CHARGED_MOVES_POOL[`${baseKey}_full_belly`] ||
    [];

  const chargedNames: string[] = [];
  const addChargedName = (raw?: string) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === "struggle" ||
      trimmed.toLowerCase() === "frustration"
    ) {
      return;
    }
    if (
      poolCharged.length > 0 &&
      !poolCharged.some((p) => p.toLowerCase() === trimmed.toLowerCase())
    ) {
      return;
    }
    if (!chargedNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      chargedNames.push(trimmed);
    }
  };

  if (entry?.moveset && entry.moveset.length > 1) {
    for (const mId of entry.moveset.slice(1)) {
      addChargedName(formatMoveIdToDisplayName(mId));
    }
  }
  for (const cm of stats.chargedMoves) {
    addChargedName(cm.name);
  }
  if (entry?.moves?.chargedMoves) {
    for (const cm of entry.moves.chargedMoves) {
      addChargedName(formatMoveIdToDisplayName(cm.moveId));
    }
  }
  for (const cn of poolCharged) {
    addChargedName(cn);
  }

  const resolvedChargedMoves: ChargedMove[] = chargedNames.map((cn) =>
    buildChargedMoveFromName(cn, stats.types[0], stats.chargedMoves)
  );
  if (resolvedChargedMoves.length === 0) {
    resolvedChargedMoves.push(
      stats.chargedMoves[0] || { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 }
    );
  }

  return {
    fastMoves: resolvedFastMoves,
    chargedMoves: resolvedChargedMoves
  };
}

/**
 * Evaluates a discrete head-to-head Battle Rating (150..850, 500 neutral)
 * for any shield combination (userShields in 0..2, oppShields in 0..2) in the 9-scenario shield matrix.
 *
 * Uses the v3.15 Weighted Move Combo Math across all 9 shield conditions:
 * - Case 1a (75% weight): Default PvPoke moveset (fast1 / charge1 / charge2)
 * - Case 1b (25% weight split equally = 5% each across 5 alternate PvPoke move combinations):
 *   1. fast1 / charge1 / charge3 (5%)
 *   2. fast1 / charge1 / charge4 (5%)
 *   3. fast1 / charge2 / charge3 (5%)
 *   4. fast1 / charge2 / charge4 (5%)
 *   5. fast2 / charge1 / charge2 (5%)
 */
export function evaluateDiscreteShieldBattleRating(
  userInput: TeamMember | string,
  oppInput: TeamMember | string,
  userShields: number,
  oppShields: number,
  league: string = "GREAT LEAGUE"
): number {
  const sUser = Math.max(0, Math.min(2, Math.round(userShields)));
  const sOpp = Math.max(0, Math.min(2, Math.round(oppShields)));
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const cacheKey = `${normLg}||${buildCombatantCacheKey(userInput)}||${buildCombatantCacheKey(oppInput)}||${sUser}v${sOpp}`;
  const cached = DISCRETE_SHIELD_BR_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const userResolved = resolveCombatPokemonForEngine(userInput, league);
  const oppResolved = resolveCombatPokemonForEngine(oppInput, league);

  const myStats = userResolved.stats;
  const oppStats = oppResolved.stats;

  const userSpeciesLower = (myStats.baseSpecies || myStats.speciesId || myStats.name).toLowerCase();
  const oppSpeciesLower = (oppStats.baseSpecies || oppStats.speciesId || oppStats.name).toLowerCase();

  const isUserMorpeko = userSpeciesLower.includes("morpeko");
  const isOppMorpeko = oppSpeciesLower.includes("morpeko");
  const isUserMimikyu = userSpeciesLower.includes("mimikyu");
  const isOppMimikyu = oppSpeciesLower.includes("mimikyu");
  const isUserAegislash = userSpeciesLower.includes("aegislash");
  const isOppAegislash = oppSpeciesLower.includes("aegislash");
  const isUserCramorant = userSpeciesLower.includes("cramorant");
  const isOppCramorant = oppSpeciesLower.includes("cramorant");

  // Standardized fast move factors matching PvPoke mechanics (no artificial multiplier compounding)
  const computeFastMoveFactors = (
    fm: FastMove,
    attackerTypes: string[],
    defenderTypes: string[]
  ): { fastEff: number; energyMult: number } => {
    const turns = Math.max(1, fm.turns || 2);
    const power = fm.power || turns * 2.5;
    const energyGain = fm.energyGain || turns * 3.5;
    const stab = attackerTypes.some((t) => t.toLowerCase() === (fm.type || "").toLowerCase()) ? 1.2 : 1.0;
    const dptNorm = Math.max(0.60, Math.min(1.50, (power * stab) / (turns * 3.0)));
    const ept = energyGain / turns;
    const eptFactor = Math.max(0.80, Math.min(1.24, 0.84 + 0.16 * (ept / 3.5)));
    const fastEff = getTypeMultiplier(fm.type, defenderTypes) * (0.72 + 0.28 * dptNorm);
    const energyMult = 1.0 * eptFactor;
    return { fastEff, energyMult };
  };

  const userFastFactors = computeFastMoveFactors(
    userResolved.fastMove,
    myStats.types,
    oppStats.types
  );

  const evalChargedMoveAgainst = (
    attacker: PokemonStats,
    defender: PokemonStats,
    cm: ChargedMove,
    atkShadow: boolean,
    defShadow: boolean
  ): { pct: number; energy: number } => {
    const rawPct = calculateChargedDamage(attacker, defender, cm, atkShadow, defShadow).percentage;
    const energy = Math.max(35, cm.energyCost || 50);
    const paceFactor = Math.max(0.86, Math.min(1.18, Math.pow(50.0 / energy, 0.26)));
    return {
      pct: rawPct * paceFactor,
      energy
    };
  };

  const userC1Move = userResolved.chargedMoves[0] || {
    name: "Body Slam",
    code: "BS",
    type: myStats.types[0] || "normal",
    power: 55,
    energyCost: 35
  };
  const userC2Move = userResolved.chargedMoves[1] || userC1Move;
  const userC1RawPct = calculateChargedDamage(
    myStats,
    oppStats,
    userC1Move,
    userResolved.isShadow,
    oppResolved.isShadow
  ).percentage;
  const userC2RawPct = calculateChargedDamage(
    myStats,
    oppStats,
    userC2Move,
    userResolved.isShadow,
    oppResolved.isShadow
  ).percentage;
  const userFastTurns = Math.max(1, userResolved.fastMove.turns || 2);
  const userFastEnergy = userResolved.fastMove.energyGain || userFastTurns * 3.5;
  const userFastEpt = userFastEnergy / userFastTurns;

  const userCycleSim = simulateTurnByTurnChargedCycle(
    userC1Move,
    userC1RawPct,
    userC2Move,
    userC2RawPct,
    userFastEpt,
    sOpp,
    myStats.types
  );

  const userChargedEval = userResolved.chargedMoves.slice(0, 2).map((cm) =>
    evalChargedMoveAgainst(myStats, oppStats, cm, userResolved.isShadow, oppResolved.isShadow)
  );
  const bestUserCharged = userChargedEval.length ? Math.max(...userChargedEval.map((c) => c.pct)) : 45;
  const minUserCharged = userChargedEval.length ? Math.min(...userChargedEval.map((c) => c.pct)) : 35;
  const fastestUserMove = userChargedEval.length
    ? userChargedEval.reduce((prev, curr) => (curr.energy < prev.energy ? curr : prev), userChargedEval[0])
    : { pct: minUserCharged, energy: 45 };

  const shadowBulkDelta = (userResolved.isShadow ? -12 : 0) + (oppResolved.isShadow ? 12 : 0);
  const avgShields = (sUser + sOpp) * 0.5;
  const fastWeight = avgShields <= 1 ? 95 + avgShields * 25 : 120 + (avgShields - 1) * 35;
  const shadowMultiplier = avgShields <= 1 ? 1 : avgShields;
  const effectiveShadowDelta = shadowBulkDelta * shadowMultiplier;
  const shieldDiff = sUser - sOpp;

  const computeMimikyuIncomingEvaluation = (
    attackerBestPct: number,
    attackerMinPct: number,
    attackerFastestPct: number,
    attackerFastestEnergy: number,
    attackerFastEff: number,
    mimikyuShields: number
  ): { avgIncomingChargedPressure: number; avgMimikyuNetBonus: number } => {
    const fastestPaceFactor = Math.min(1.25, Math.max(0.95, 48.0 / Math.max(35, attackerFastestEnergy)));
    const totalBlocks = mimikyuShields + 1;

    const residualUnblockedAfterA =
      totalBlocks === 1
        ? (attackerBestPct * 0.65 + attackerFastestPct * 0.35) * 1.12
        : totalBlocks === 2
        ? attackerFastestPct * 0.85 * fastestPaceFactor
        : attackerFastestPct * 0.58 * fastestPaceFactor;
    const lateBustedDefPenaltyA =
      (mimikyuShields === 0 ? 14 : mimikyuShields === 1 ? 7 : 3) * (0.85 + 0.3 * attackerFastEff);
    const disguiseSavedValueA = attackerFastestPct * 0.42 + (mimikyuShields === 0 ? 24 : 16);
    const netBonusA = disguiseSavedValueA - lateBustedDefPenaltyA;

    const postDisguisePressureB =
      mimikyuShields === 0
        ? attackerBestPct * 1.22
        : mimikyuShields === 1
        ? ((attackerBestPct + attackerMinPct) * 0.5) * 1.02 * 1.15
        : attackerMinPct * 0.72 * 1.15;
    const earlyBustedDefPenaltyB =
      (mimikyuShields === 0 ? 14 : mimikyuShields === 1 ? 19 : 23) * (0.85 + 0.35 * attackerFastEff);
    const disguiseSavedValueB = attackerFastestPct * 0.38 + (mimikyuShields === 0 ? 24 : 14);
    const netBonusB = disguiseSavedValueB - earlyBustedDefPenaltyB;

    return {
      avgIncomingChargedPressure: 0.5 * (residualUnblockedAfterA + postDisguisePressureB),
      avgMimikyuNetBonus: 0.5 * (netBonusA + netBonusB)
    };
  };

  let userChargedImpact: number;
  let oppMimikyuBonus = 0;
  if (isOppMimikyu) {
    const evalOppMimi = computeMimikyuIncomingEvaluation(
      bestUserCharged,
      minUserCharged,
      fastestUserMove.pct,
      fastestUserMove.energy,
      userFastFactors.fastEff,
      sOpp
    );
    userChargedImpact = evalOppMimi.avgIncomingChargedPressure * userFastFactors.energyMult;
    oppMimikyuBonus = evalOppMimi.avgMimikyuNetBonus;
  } else {
    userChargedImpact = userCycleSim.effectivePressure * userCycleSim.effectiveFreqMult;
  }

  // Evaluate single opponent move combination (oppFast, oppC1, oppC2)
  const evalSingleOpponentMovesetBr = (oppFast: FastMove, oppC1: ChargedMove, oppC2: ChargedMove): number => {
    const oppFastFactors = computeFastMoveFactors(
      oppFast,
      oppStats.types,
      myStats.types
    );
    const oppFastTurns = Math.max(1, oppFast.turns || 2);
    const oppFastEnergy = oppFast.energyGain || oppFastTurns * 3.5;
    const oppFastEpt = oppFastEnergy / oppFastTurns;

    const oppC1RawPct = calculateChargedDamage(
      oppStats,
      myStats,
      oppC1,
      oppResolved.isShadow,
      userResolved.isShadow
    ).percentage;
    const oppC2RawPct = calculateChargedDamage(
      oppStats,
      myStats,
      oppC2,
      oppResolved.isShadow,
      userResolved.isShadow
    ).percentage;

    const oppCycleSim = simulateTurnByTurnChargedCycle(
      oppC1,
      oppC1RawPct,
      oppC2,
      oppC2RawPct,
      oppFastEpt,
      sUser,
      oppStats.types
    );

    const c1Eval = evalChargedMoveAgainst(oppStats, myStats, oppC1, oppResolved.isShadow, userResolved.isShadow);
    const c2Eval = evalChargedMoveAgainst(oppStats, myStats, oppC2, oppResolved.isShadow, userResolved.isShadow);
    const bestOppCharged = Math.max(c1Eval.pct, c2Eval.pct);
    const minOppCharged = Math.min(c1Eval.pct, c2Eval.pct);
    const fastestOppMove = c1Eval.energy <= c2Eval.energy ? c1Eval : c2Eval;

    let oppChargedImpact: number;
    let userMimikyuBonus = 0;
    if (isUserMimikyu) {
      const evalUserMimi = computeMimikyuIncomingEvaluation(
        bestOppCharged,
        minOppCharged,
        fastestOppMove.pct,
        fastestOppMove.energy,
        oppFastFactors.fastEff,
        sUser
      );
      oppChargedImpact = evalUserMimi.avgIncomingChargedPressure * oppFastFactors.energyMult;
      userMimikyuBonus = evalUserMimi.avgMimikyuNetBonus;
    } else {
      oppChargedImpact = oppCycleSim.effectivePressure * oppCycleSim.effectiveFreqMult;
    }

    const chargedDelta = 2.0 * (userChargedImpact - oppChargedImpact);
    const fastDelta = (userFastFactors.fastEff - oppFastFactors.fastEff) * fastWeight;
    const shieldAdvantageDelta =
      shieldDiff * (85 + 0.65 * ((bestOppCharged + bestUserCharged) * 0.5));

    // Special mechanics are modeled once in their physical damage/absorption paths:
    // - Mimikyu Disguise: Path A vs Path B 50/50 shield absorption vs Busted -1 DEF penalty (userMimikyuBonus - oppMimikyuBonus)
    // - Morpeko Aura Wheel: 1.15x +1 ATK buff + Electric/Dark rotation already applied in calculateChargedDamage (zero flat double-bonus)
    // - Cramorant Gulp Missile: 1.14x Surf catch debuff/retaliation already applied in calculateChargedDamage (zero flat double-bonus)
    // - Aegislash Stance Change: True 97 ATK / 291 DEF Shield Forme stats used without +28/+12 flat rating inflation
    const specialMechanicsDelta = userMimikyuBonus - oppMimikyuBonus;

    const raw = Math.round(
      500 + chargedDelta + fastDelta + effectiveShadowDelta + shieldAdvantageDelta + specialMechanicsDelta
    );
    return Math.max(150, Math.min(850, raw));
  };

  // Resolve opponent's legal PvPoke move pool: fast1, optional fast2, charge1, optional charge2, charge3, charge4
  const oppMovePool = getAvailableMovePoolForPokemon(oppStats, league);
  const fast1 = oppMovePool.fastMoves[0] || oppResolved.fastMove;
  const fast2 =
    oppMovePool.fastMoves.length >= 2 &&
    oppMovePool.fastMoves[1].name.toLowerCase() !== fast1.name.toLowerCase()
      ? oppMovePool.fastMoves[1]
      : undefined;

  const charge1 = oppMovePool.chargedMoves[0] || oppResolved.chargedMoves[0];
  const charge2 =
    oppMovePool.chargedMoves.length >= 2 &&
    oppMovePool.chargedMoves[1].name.toLowerCase() !== charge1.name.toLowerCase()
      ? oppMovePool.chargedMoves[1]
      : undefined;
  const charge3 =
    oppMovePool.chargedMoves.length >= 3 &&
    oppMovePool.chargedMoves[2].name.toLowerCase() !== charge1.name.toLowerCase() &&
    (!charge2 || oppMovePool.chargedMoves[2].name.toLowerCase() !== charge2.name.toLowerCase())
      ? oppMovePool.chargedMoves[2]
      : undefined;
  const charge4 =
    oppMovePool.chargedMoves.length >= 4 &&
    oppMovePool.chargedMoves[3].name.toLowerCase() !== charge1.name.toLowerCase() &&
    (!charge2 || oppMovePool.chargedMoves[3].name.toLowerCase() !== charge2.name.toLowerCase()) &&
    (!charge3 || oppMovePool.chargedMoves[3].name.toLowerCase() !== charge3.name.toLowerCase())
      ? oppMovePool.chargedMoves[3]
      : undefined;

  const effectiveCharge2 = charge2 || charge1;

  // 1a. 75% weight to default PvPoke moveset (fast1 / charge1 / charge2)
  const brDefault = evalSingleOpponentMovesetBr(fast1, charge1, effectiveCharge2);

  // 1b. Equally weight the valid alternate PvPoke move combinations that actually exist for this species:
  //     fast1/charge1/charge3, fast1/charge1/charge4, fast1/charge2/charge3, fast1/charge2/charge4, fast2/charge1/charge2
  const altCombos1b: number[] = [];
  if (charge3) {
    altCombos1b.push(evalSingleOpponentMovesetBr(fast1, charge1, charge3));
  }
  if (charge4) {
    altCombos1b.push(evalSingleOpponentMovesetBr(fast1, charge1, charge4));
  }
  if (charge2 && charge3) {
    altCombos1b.push(evalSingleOpponentMovesetBr(fast1, charge2, charge3));
  }
  if (charge2 && charge4) {
    altCombos1b.push(evalSingleOpponentMovesetBr(fast1, charge2, charge4));
  }
  if (fast2) {
    altCombos1b.push(evalSingleOpponentMovesetBr(fast2, charge1, effectiveCharge2));
  }

  const weightedRating =
    altCombos1b.length > 0
      ? Math.round(
          0.75 * brDefault +
            0.25 * (altCombos1b.reduce((acc, v) => acc + v, 0) / altCombos1b.length)
        )
      : brDefault;

  const finalRating = Math.max(150, Math.min(850, weightedRating));
  if (DISCRETE_SHIELD_BR_CACHE.size > 40000) {
    DISCRETE_SHIELD_BR_CACHE.clear();
  }
  DISCRETE_SHIELD_BR_CACHE.set(cacheKey, finalRating);
  return finalRating;
}

export interface PositionWeightedMatchupRatings {
  leadBr: number;
  swapBr: number;
  closerBr: number;
}

/**
 * Computes Position-Weighted Shield Scenario Ratings for a single matchup (User vs Opponent):
 * - Slot 1 (Lead): 0.45 * 1v1 + 0.35 * 2v2 + 0.10 * 0v0 + 0.05 * 1v2 + 0.05 * 2v1
 * - Slot 2 (Safe Swap / Bait): 0.40 * 1v1 + 0.20 * 1v0 + 0.20 * 0v1 + 0.10 * 2v1 + 0.10 * 0v0
 * - Slot 3 (Closer / Sweeper): 0.50 * 0v0 + 0.20 * 1v0 + 0.15 * 0v1 + 0.15 * 1v1
 */
export function evaluatePositionWeightedBr(
  userInput: TeamMember | string,
  oppInput: TeamMember | string,
  league: string = "GREAT LEAGUE"
): PositionWeightedMatchupRatings {
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const pwKey = `${normLg}||${buildCombatantCacheKey(userInput)}||${buildCombatantCacheKey(oppInput)}`;
  const cached = POSITION_WEIGHTED_BR_CACHE.get(pwKey);
  if (cached) return cached;

  const r0v0 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 0, 0, league);
  const r0v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 0, 1, league);
  const r1v0 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 0, league);
  const r1v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 1, league);
  const r1v2 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 2, league);
  const r2v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 2, 1, league);
  const r2v2 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 2, 2, league);

  const leadBr =
    0.45 * r1v1 +
    0.35 * r2v2 +
    0.10 * r0v0 +
    0.05 * r1v2 +
    0.05 * r2v1;

  const swapBr =
    0.40 * r1v1 +
    0.20 * r1v0 +
    0.20 * r0v1 +
    0.10 * r2v1 +
    0.10 * r0v0;

  const closerBr =
    0.50 * r0v0 +
    0.20 * r1v0 +
    0.15 * r0v1 +
    0.15 * r1v1;

  const res = { leadBr, swapBr, closerBr };
  if (POSITION_WEIGHTED_BR_CACHE.size > 40000) {
    POSITION_WEIGHTED_BR_CACHE.clear();
  }
  POSITION_WEIGHTED_BR_CACHE.set(pwKey, res);
  return res;
}

