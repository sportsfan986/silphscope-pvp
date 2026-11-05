import { type TeamMember, type LeagueType, type TeamArchetype, type LimitedMetaLifecycleStatus, FOUR_WEEKS_MS, type LimitedMetaFormat, DEFAULT_LIMITED_META_CATALOG, LIMITED_META_CATALOG_STORAGE_KEY, LIMITED_META_RANKINGS_CACHE_KEY, isExpiredLimitedMeta, DYNAMIC_LIMITED_META_CATALOG, setDynamicLimitedMetaCatalog, toPvPokeTitleCase, isBattleFrontierCupTitle, isCurrentBattleFrontierCup, getForcedShow6Leagues, getPinnedGblLimitedMetas, getPinnedShow6LimitedMetas, getLimitedMetaCatalog, getEnabledShow6Leagues, getLeagueCpCap, isMegaOrPrimalSpecies, hasMultipleMegas, normalizeLeagueName, type PokemonRankingEntry, PVPOKE_ENDPOINTS, type TeamPreset, getTypeMultiplier, POKEMON_DATABASE, LIVE_RANKINGS_LIST, LIVE_RANKINGS_MAP, isDominatedSameTypeChargedPair, parseRankingsJsonArray, extractBaseSpeciesKey, getPokemonAutocompleteSuggestions, getRecommendedMovesForPokemon, getLeagueTop3Template } from "./pokemonDb";
import { ALL_18_TYPES, getAvailableMovePoolForPokemon, type PositionWeightedMatchupRatings, evaluatePositionWeightedBr } from "./combatSimulator";
import { type BattleFrontierCoreEntry, getShow6UsageAndCoreWeightPct, getShow6CoresForLeague, findShow6CommonCoreEntry, getShow6WeightedMetaList, getLeagueTopMetaSpeciesNames, canonicalizeMetaPokemonName, recalculateAllPresetsMetrics, getTop100MetaCandidatesForLeague, getLeagueAbbreviation } from "./teamAndMetaEngine";

// ============================================================================
// SHOW 6 BATTLE FRONTIER MODE — ENGINE, ROSTER STORAGE & LIVE AI PREDICTOR
// ============================================================================

export type AppCombatMode = "gbl" | "show6";

export interface Show6RosterOf6Preset {
  id: string;
  name: string;
  league: LeagueType;
  isSelected?: boolean;
  pokemon: TeamMember[]; // 6 Pokémon slots
  notes?: string;
  updatedAt?: number;
}

export interface Show6OpponentViableLineup {
  id: string;
  rank: number;
  archetype: "ABB" | "ABC" | "DUO";
  names: [string, string, string];
  lead: string;
  swap: string;
  closer: string;
  viabilityScore: number;
  viabilityWeightPct: number;
  sharedWeaknesses: string[];
  rationale: string;
}

export interface Show6VsOpponentLineupBreakdown {
  oppLineupLabel: string;
  oppLead: string;
  oppSwap: string;
  oppCloser: string;
  oppArchetype: "ABB" | "ABC" | "DUO";
  oppViabilityPct: number;
  matchupBr: number;
  leadBr: number;
}

export interface Show6RecommendedLineup {
  id: string;
  archetype: TeamArchetype;
  rankInArchetype: number; // 1, 2, or 3
  overallRank: number;
  league: LeagueType;
  pokemon: [TeamMember, TeamMember, TeamMember]; // [Lead, Safe Swap, Closer] with simulated best movesets
  members: [TeamMember, TeamMember, TeamMember];
  viabilityWeightedBr: number;
  expectedWeightedBr: number;
  rawAverageBr: number;
  leadWinPct: number;
  safeSwapScore: number;
  closerScore: number;
  worstCaseTop5Br: number;
  worstCaseBr: number;
  compositeShow6Score: number;
  sharedWeaknesses: string[];
  altMovesetNotes: string[];
  synergySummary: string;
  strongestAgainst: string[];
  dangerLineups: string[];
  vsTopOpponentTeams: Show6VsOpponentLineupBreakdown[];
}

export interface Show6Pick3MatchupResult {
  league: LeagueType;
  leagueAbbr: string;
  myOptimized6: TeamMember[];
  my6SimulatedBestMoves: TeamMember[];
  opp6Names: string[];
  top3AbbTeams: Show6RecommendedLineup[];
  top3AbcTeams: Show6RecommendedLineup[];
  top3DuoTeams: Show6RecommendedLineup[];
  topAbbLineups: Show6RecommendedLineup[];
  topAbcLineups: Show6RecommendedLineup[];
  topDuoLineups: Show6RecommendedLineup[];
  topOpponentViableTeams: Show6OpponentViableLineup[];
  topOpponentViableLineups: Show6OpponentViableLineup[];
  oppTop3AbbTeams: Show6OpponentViableLineup[];
  oppTop3AbcTeams: Show6OpponentViableLineup[];
  oppTop3DuoTeams: Show6OpponentViableLineup[];
  totalOrderedPairsEvaluated: number; // 120 x 120 = 14,400
  totalMatchupsSimulated: number;
  movesetsSimulated: number;
  elapsedMs: number;
}

export interface MostLikelyFormatOpponent6Info {
  league: LeagueType;
  shortLabel: string;
  pokemonNames: string[];
  members: TeamMember[];
  featuredCores: string[];
  avgUsagePct: number;
  summaryLabel: string;
}

export interface BlindShow6RosterSlotEval {
  slotIndex: number;
  member: TeamMember;
  isLocked: boolean;
  roleBadge: string;
  leadBr: number;
  swapBr: number;
  closerBr: number;
  overallBr: number;
  blendedBr: number;
  metaBr: number;
  historicalBr: number;
  topWins: string[];
}

export interface BlindShow6RosterResult {
  league: LeagueType;
  leagueAbbr: string;
  filterMode: "OPEN" | "WHITELIST" | "BANLIST";
  filterCount: number;
  historicalCount: number;
  historicalWeightPct: number;
  metaWeightPct: number;
  roster6: TeamMember[];
  slotEvals: BlindShow6RosterSlotEval[];
  roster: BlindShow6RosterSlotEval[];
  fieldCoveragePct: number;
  avgRosterBr: number;
  overallBlendedScore: number;
  eligiblePoolCount: number;
  beatenThreatsCount: number;
  totalThreatsAudited: number;
  embeddedPick3Preview: Show6Pick3MatchupResult;
  topBlendedThreats: Array<{ rank: number; name: string; weightPct: number }>;
  synergySummary: string;
  elapsedMs: number;
}

export interface Show6LiveBacklinePredictionItem {
  names: string[]; // 2 names if 1 revealed; 1 name if 2 revealed; 3 names if 0 revealed
  backlineNames: string[];
  fullLineup: [string, string, string];
  archetype: "ABB" | "ABC" | "DUO";
  probabilityPct: number;
  viabilityScore: number;
  rationale: string;
}

export interface Show6LiveBacklinePredictionResult {
  knownOpponent6: string[];
  revealedOpponents: string[];
  unrevealedPool: string[];
  predictions: Show6LiveBacklinePredictionItem[];
  mostLikelyPairs: Show6LiveBacklinePredictionItem[];
  criticalPreserveCallout: string;
  tacticalSummary: string;
}


/**
 * Parses comma- or newline-separated Pokémon names (from Text Paste Mode or Chip Picker)
 * into canonical Pokémon names in the database.
 */
export function parsePokemonListInput(rawInput: string | string[], league: string = "GREAT LEAGUE"): string[] {
  const tokens = Array.isArray(rawInput)
    ? rawInput
    : (rawInput || "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const tok of tokens) {
    const cleaned = tok.replace(/^\d+[\.\)\s-]+/, "").trim();
    if (!cleaned) continue;
    const canon = canonicalizeMetaPokemonName(cleaned);
    if (!canon) continue;
    // Verify it resolves in database or autocomplete
    const dbMatch =
      POKEMON_DATABASE[canon] ||
      POKEMON_DATABASE[canon.replace(/^Shadow\s+/i, "")] ||
      getRecommendedMovesForPokemon(canon, league);
    const finalName = dbMatch ? canon : getPokemonAutocompleteSuggestions(cleaned, league, 1)[0]?.name || canon;
    const lower = finalName.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(finalName);
    }
  }
  return out;
}

export function getTypesAndWeaknessesForSpecies(name: string, league: string) {
  const clean = (name || "").replace(/^Shadow\s+/i, "").trim();
  const dbEntry =
    POKEMON_DATABASE[name] ||
    POKEMON_DATABASE[clean] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === clean.toLowerCase());
  const baseSpecies = extractBaseSpeciesKey(name, dbEntry?.speciesId, dbEntry?.baseSpecies);
  const types = dbEntry?.types || ["normal"];

  const weaknesses: string[] = [];
  const doubleWeaknesses: string[] = [];
  const resistances: string[] = [];
  for (const atkType of ALL_18_TYPES) {
    const m = getTypeMultiplier(atkType, types);
    if (m > 1.9) {
      weaknesses.push(atkType);
      doubleWeaknesses.push(atkType);
    } else if (m > 1.2) {
      weaknesses.push(atkType);
    } else if (m < 0.85) {
      resistances.push(atkType);
    }
  }
  return { baseSpecies, types, weaknesses, doubleWeaknesses, resistances };
}

/**
 * Classifies an ordered 3-Pokémon lineup [m0, m1, m2] into ABB, DUO, or ABC and computes structural coherence.
 */
export function classifyOrderedTrioStructure(
  t0: { weaknesses: string[]; doubleWeaknesses: string[]; resistances: string[]; leadBr: number; swapBr: number; closerBr: number },
  t1: { weaknesses: string[]; doubleWeaknesses: string[]; resistances: string[]; leadBr: number; swapBr: number; closerBr: number },
  t2: { weaknesses: string[]; doubleWeaknesses: string[]; resistances: string[]; leadBr: number; swapBr: number; closerBr: number }
): {
  primaryArchetype: "ABB" | "ABC" | "DUO";
  abbScore: number;
  duoScore: number;
  abcScore: number;
  sharedWeaknesses: string[];
  structureBonus: number;
} {
  const w0 = new Set(t0.weaknesses);
  const w1 = new Set(t1.weaknesses);
  const r0 = new Set(t0.resistances);
  const r1 = new Set(t1.resistances);
  const r2 = new Set(t2.resistances);

  // Backline shared weaknesses (t1 & t2)
  const backShared = t2.weaknesses.filter((w) => w1.has(w));
  const hasSharedDouble = backShared.some(
    (w) => t1.doubleWeaknesses.includes(w) || t2.doubleWeaknesses.includes(w)
  );
  const leadResistsBack = backShared.filter((w) => r0.has(w));
  const leadNotWeakBack = backShared.every((w) => !w0.has(w));

  const isStrictAbb =
    (backShared.length >= 2 || (backShared.length >= 1 && hasSharedDouble)) &&
    leadResistsBack.length >= 1 &&
    leadNotWeakBack;

  const abbScore =
    (isStrictAbb ? 75 : backShared.length >= 1 && leadResistsBack.length >= 1 ? 35 : 0) +
    leadResistsBack.length * 22 +
    backShared.length * 14 +
    0.38 * t0.leadBr +
    0.34 * t1.swapBr +
    0.28 * t2.closerBr;

  // Duo-Core check: t0 (Core 1) and t2 (Core 2) cover each other's weaknesses; t1 is Safe Swap Pivot
  const c0Covers2 =
    t2.weaknesses.length > 0
      ? t2.weaknesses.filter((w) => r0.has(w)).length / t2.weaknesses.length
      : 0.4;
  const c2Covers0 =
    t0.weaknesses.length > 0
      ? t0.weaknesses.filter((w) => r2.has(w)).length / t0.weaknesses.length
      : 0.4;
  const avgRecip = (c0Covers2 + c2Covers0) / 2;
  const isStrictDuo = backShared.length <= 1 && c0Covers2 >= 0.4 && c2Covers0 >= 0.4 && avgRecip >= 0.5 && t1.swapBr >= 480;

  const duoScore =
    (isStrictDuo ? 65 : 0) +
    avgRecip * 95 +
    0.42 * t1.swapBr +
    0.30 * t0.leadBr +
    0.28 * t2.closerBr;

  // ABC triangular coverage: t1 and t2 cover t0's weaknesses without heavy backline overlap
  const backCoversLead =
    t0.weaknesses.length > 0
      ? t0.weaknesses.filter((w) => r1.has(w) || r2.has(w)).length / t0.weaknesses.length
      : 0.5;
  let tripleWeakPenalty = 0;
  for (const atkT of ALL_18_TYPES) {
    const wc = [t0, t1, t2].filter((x) => x.weaknesses.includes(atkT)).length;
    const rc = [t0, t1, t2].filter((x) => x.resistances.includes(atkT)).length;
    if (wc >= 2 && rc === 0) tripleWeakPenalty += wc === 3 ? 40 : 14;
  }

  const abcScore =
    backCoversLead * 65 -
    tripleWeakPenalty +
    0.40 * t0.leadBr +
    0.32 * t1.swapBr +
    0.28 * t2.closerBr;

  const primaryArchetype: "ABB" | "ABC" | "DUO" = isStrictAbb
    ? "ABB"
    : isStrictDuo
    ? "DUO"
    : "ABC";

  const structureBonus = Math.max(
    isStrictAbb ? 28 + leadResistsBack.length * 8 : 0,
    isStrictDuo ? 24 + Math.round(avgRecip * 20) : 0,
    Math.round(backCoversLead * 22) - tripleWeakPenalty * 0.5
  );

  return {
    primaryArchetype,
    abbScore,
    duoScore,
    abcScore,
    sharedWeaknesses: backShared,
    structureBonus
  };
}

/**
 * Evaluates all 120 ordered 3-Pokémon lineups from Your 6 against all 120 ordered 3-Pokémon lineups
 * from Opponent's 6:
 * - Opponent movesets are treated as unknown and weighted using the exact Team Builder moveset distribution
 *   (75% primary PvPoke moveset + 25% alternate movesets).
 * - Simulates all legal Fast + Charged move combinations for Your 6 Pokémon against the Opponent's 6
 *   to recommend/equip the optimal moveset for Your Team.
 * - Weights Opponent 3-Pokémon lineups by Team Viability (coverage, archetype coherence, meta strength).
 * - Returns the Top 3 ABB, Top 3 ABC, and Top 3 Duo-Core 3-Pokémon lineups for Your Team.
 */
export function evaluateShow6Pick3Matchup(
  league: string = "Battle Frontier (Spectral)",
  my6Raw: Array<TeamMember | string> = [],
  opp6Raw: Array<TeamMember | string> = []
): Show6Pick3MatchupResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const normLeague: LeagueType = normalizeLeagueName(league || "Battle Frontier (Spectral)");

  const defaultTop = getLeagueTopMetaSpeciesNames(normLeague, 12);
  const safeMy6 = Array.isArray(my6Raw) ? my6Raw : [];
  const safeOpp6 = Array.isArray(opp6Raw) ? opp6Raw : [];

  // Resolve 6 user Pokémon and 6 opponent Pokémon species names
  const buildBaseUserMember = (input: TeamMember | string | undefined, idx: number): TeamMember => {
    const rawName = typeof input === "string" ? input : input?.name || "";
    const fallbackName = defaultTop[idx] || "Azumarill";
    const resolvedName = canonicalizeMetaPokemonName(rawName) || fallbackName;
    const rec = getRecommendedMovesForPokemon(resolvedName, normLeague);
    if (typeof input === "object" && input && input.name) {
      return {
        id: input.id || `s6-my-${idx + 1}`,
        name: rec?.name || resolvedName,
        cp: input.cp || rec?.cp || 1500,
        fastMove: input.fastMove || rec?.fastMove || "Fast",
        chargedMove1: input.chargedMove1 || rec?.chargedMove1 || "Body Slam",
        chargedMove2: input.chargedMove2 || rec?.chargedMove2 || "Surf",
        ivs: input.ivs || rec?.defaultIvs
      };
    }
    return {
      id: `s6-my-${idx + 1}`,
      name: rec?.name || resolvedName,
      cp: rec?.cp || 1500,
      fastMove: rec?.fastMove || "Fast",
      chargedMove1: rec?.chargedMove1 || "Body Slam",
      chargedMove2: rec?.chargedMove2 || "Surf",
      ivs: rec?.defaultIvs
    };
  };

  const myBase6: TeamMember[] = [0, 1, 2, 3, 4, 5].map((i) => buildBaseUserMember(safeMy6[i], i));
  const opp6Names: string[] = [0, 1, 2, 3, 4, 5].map((i) => {
    const input = safeOpp6[i];
    const rawName = typeof input === "string" ? input : input?.name || "";
    const fallbackName = defaultTop[i + 6] || defaultTop[i] || "Clodsire";
    const canon = canonicalizeMetaPokemonName(rawName) || fallbackName;
    const rec = getRecommendedMovesForPokemon(canon, normLeague);
    return rec?.name || canon;
  });

  // =========================================================================
  // STEP 1: SIMULATE BEST MOVESETS FOR MY 6 AGAINST OPPONENT'S UNKNOWN-MOVE 6
  // =========================================================================
  let movesetsSimulated = 0;
  const altNoteByMyIdx = new Map<number, string>();

  const myOptimized6: TeamMember[] = myBase6.map((baseMember, mIdx) => {
    const rec = getRecommendedMovesForPokemon(baseMember.name, normLeague, baseMember.ivs);
    const stdFast = rec?.fastMove || baseMember.fastMove;
    const stdC1 = rec?.chargedMove1 || baseMember.chargedMove1;
    const stdC2 = rec?.chargedMove2 || baseMember.chargedMove2;

    const pool = getAvailableMovePoolForPokemon(baseMember.name, normLeague);
    const fastPool = pool.fastMoves
      .map((f) => f.name.trim())
      .filter((f) => f && f.toLowerCase() !== "struggle")
      .slice(0, 3);
    if (fastPool.length === 0) fastPool.push(stdFast);

    const chargedPool = pool.chargedMoves
      .map((c) => c.name.trim())
      .filter((c) => c && c.toLowerCase() !== "struggle" && c.toLowerCase() !== "frustration")
      .slice(0, 5);
    if (chargedPool.length === 0) chargedPool.push(stdC1, stdC2);

    const typeInfo = getTypesAndWeaknessesForSpecies(baseMember.name, normLeague);
    const rawPairs: Array<[string, string]> = [];
    if (chargedPool.length <= 1) {
      const single = chargedPool[0] || stdC1;
      rawPairs.push([single, single]);
    } else {
      for (let i = 0; i < chargedPool.length; i++) {
        for (let j = i + 1; j < chargedPool.length; j++) {
          rawPairs.push([chargedPool[i], chargedPool[j]]);
        }
      }
    }
    const nonDom = rawPairs.filter(([c1, c2]) => !isDominatedSameTypeChargedPair(c1, c2, typeInfo.types));
    const chargedPairs = nonDom.length > 0 ? nonDom : rawPairs;

    const scoreCandidateMoveset = (cand: TeamMember): number => {
      let sum = 0;
      for (const oppName of opp6Names) {
        // Passing oppName as string triggers the 75% default + 25% alternate moveset weighting!
        const pw = evaluatePositionWeightedBr(cand, oppName, normLeague);
        sum += 0.38 * pw.leadBr + 0.32 * pw.swapBr + 0.30 * pw.closerBr;
      }
      return sum / opp6Names.length;
    };

    const stdMember: TeamMember = {
      ...baseMember,
      fastMove: stdFast,
      chargedMove1: stdC1,
      chargedMove2: stdC2
    };
    let bestMember = stdMember;
    let bestAvgScore = scoreCandidateMoveset(stdMember);
    const stdAvgScore = bestAvgScore;

    for (const fMove of fastPool) {
      for (const [c1, c2] of chargedPairs) {
        movesetsSimulated++;
        const cand: TeamMember = {
          ...baseMember,
          fastMove: fMove,
          chargedMove1: c1,
          chargedMove2: c2
        };
        const s = scoreCandidateMoveset(cand);
        if (s > bestAvgScore + 1.5) {
          bestAvgScore = s;
          bestMember = cand;
        }
      }
    }

    const stdPairKey = [stdC1.toLowerCase(), stdC2.toLowerCase()].sort().join("+");
    const bestPairKey = [bestMember.chargedMove1.toLowerCase(), bestMember.chargedMove2.toLowerCase()].sort().join("+");
    if (bestMember.fastMove.toLowerCase() !== stdFast.toLowerCase() || stdPairKey !== bestPairKey) {
      const gain = Math.round(bestAvgScore - stdAvgScore);
      altNoteByMyIdx.set(
        mIdx,
        `${bestMember.name}: ${bestMember.fastMove} + ${bestMember.chargedMove1}/${bestMember.chargedMove2} (+${Math.max(1, gain)} BR vs Opp 6)`
      );
    }

    return bestMember;
  });

  // =========================================================================
  // STEP 2: PRECOMPUTE 6x6 POSITION-WEIGHTED MATCHUP MATRIX
  // =========================================================================
  const pwMatrix: PositionWeightedMatchupRatings[][] = [];
  for (let i = 0; i < 6; i++) {
    const row: PositionWeightedMatchupRatings[] = [];
    for (let j = 0; j < 6; j++) {
      // Opponent moveset is passed as species string so it uses the 75%/25% weighted unknown moveset model
      row.push(evaluatePositionWeightedBr(myOptimized6[i], opp6Names[j], normLeague));
    }
    pwMatrix.push(row);
  }

  // Compute species typing & individual role metrics for My 6 and Opponent 6
  const mySlotStats = myOptimized6.map((m, i) => {
    const tInfo = getTypesAndWeaknessesForSpecies(m.name, normLeague);
    let lSum = 0;
    let sSum = 0;
    let cSum = 0;
    for (let j = 0; j < 6; j++) {
      lSum += pwMatrix[i][j].leadBr;
      sSum += pwMatrix[i][j].swapBr;
      cSum += pwMatrix[i][j].closerBr;
    }
    return {
      ...tInfo,
      leadBr: Math.round(lSum / 6),
      swapBr: Math.round(sSum / 6),
      closerBr: Math.round(cSum / 6)
    };
  });

  // Opponent slot metrics (evaluated against the fused Battle Frontier Usage + PvPoke league meta + internal synergy)
  const effectiveUsageWeightPct = getShow6UsageAndCoreWeightPct();
  const wUsage = effectiveUsageWeightPct / 100;
  const fusedMetaList = getShow6WeightedMetaList(normLeague, effectiveUsageWeightPct, 100);
  const fusedWeightByClean = new Map<string, { rank: number; weight: number; usagePct: number }>();
  for (const item of fusedMetaList) {
    const clean = item.name.replace(/^Shadow\s+/i, "").trim().toLowerCase();
    if (!fusedWeightByClean.has(clean)) {
      fusedWeightByClean.set(clean, { rank: item.rank, weight: item.weight, usagePct: item.usagePct });
    }
  }

  const oppSlotStats = opp6Names.map((oppName, j) => {
    const tInfo = getTypesAndWeaknessesForSpecies(oppName, normLeague);
    const cleanOpp = oppName.replace(/^Shadow\s+/i, "").trim().toLowerCase();
    const fusedInfo = fusedWeightByClean.get(cleanOpp);
    const metaIdx = fusedInfo ? fusedInfo.rank - 1 : 45;
    const rankBonus = Math.max(0, 32 - metaIdx * 0.42);
    const usageBonus = fusedInfo ? Math.min(26, fusedInfo.usagePct * 0.42) * wUsage : 0;
    const metaBonus = rankBonus * (1 - 0.35 * wUsage) + usageBonus;
    let lSum = 0;
    let sSum = 0;
    let cSum = 0;
    for (let i = 0; i < 6; i++) {
      lSum += 1000 - pwMatrix[i][j].leadBr;
      sSum += 1000 - pwMatrix[i][j].swapBr;
      cSum += 1000 - pwMatrix[i][j].closerBr;
    }
    return {
      ...tInfo,
      metaBonus,
      leadBr: Math.round(lSum / 6 + metaBonus * 0.5),
      swapBr: Math.round(sSum / 6 + metaBonus * 0.5),
      closerBr: Math.round(cSum / 6 + metaBonus * 0.5)
    };
  });

  // Generate all 120 ordered permutations of 3 indices from [0..5]
  const perms120: Array<[number, number, number]> = [];
  for (let a = 0; a < 6; a++) {
    for (let b = 0; b < 6; b++) {
      if (b === a) continue;
      for (let c = 0; c < 6; c++) {
        if (c === a || c === b) continue;
        perms120.push([a, b, c]);
      }
    }
  }

  // =========================================================================
  // STEP 3: SCORE ALL 120 ORDERED OPPONENT LINEUPS FOR VIABILITY WEIGHTING
  // (Fuses Fused Meta Rank + Common Core Multiplier + 1-Mega Rule)
  // =========================================================================
  interface InternalOppLineup {
    permIdx: number;
    indices: [number, number, number];
    trioKey: string;
    lead: string;
    swap: string;
    closer: string;
    archetype: "ABB" | "ABC" | "DUO";
    abbScore: number;
    abcScore: number;
    duoScore: number;
    oppMegaCount: number;
    coreNote: string;
    sharedWeaknesses: string[];
    viabilityScore: number;
    rawWeight: number;
    normWeight: number;
    rationale: string;
  }

  const oppLineups120: InternalOppLineup[] = perms120.map(([j0, j1, j2], permIdx) => {
    const s0 = oppSlotStats[j0];
    const s1 = oppSlotStats[j1];
    const s2 = oppSlotStats[j2];

    // Penalize duplicate base species or >1 Mega in a 3-mon team
    const dupPenalty =
      s0.baseSpecies === s1.baseSpecies || s0.baseSpecies === s2.baseSpecies || s1.baseSpecies === s2.baseSpecies
        ? -140
        : 0;
    const oppMegaCount =
      (isMegaOrPrimalSpecies(opp6Names[j0]) ? 1 : 0) +
      (isMegaOrPrimalSpecies(opp6Names[j1]) ? 1 : 0) +
      (isMegaOrPrimalSpecies(opp6Names[j2]) ? 1 : 0);
    const megaPenalty = oppMegaCount > 1 ? -260 : 0;

    // Check if opponent trio features any Most-Used Core(s) from the Battle Frontier Core sheet
    const c01 = findShow6CommonCoreEntry(normLeague, opp6Names[j0], opp6Names[j1]);
    const c02 = findShow6CommonCoreEntry(normLeague, opp6Names[j0], opp6Names[j2]);
    const c12 = findShow6CommonCoreEntry(normLeague, opp6Names[j1], opp6Names[j2]);
    const matchedCores = [c01, c02, c12].filter((x): x is BattleFrontierCoreEntry => x !== null);
    matchedCores.sort((a, b) => b.usagePct - a.usagePct);
    const topCore = matchedCores[0] || null;
    const secondCore = matchedCores[1] || null;
    const commonCoreBonus = topCore
      ? Math.round((0.35 + 0.65 * wUsage) * (18 + topCore.usagePct * 0.85 + (secondCore ? secondCore.usagePct * 0.35 : 0)))
      : 0;

    const struct = classifyOrderedTrioStructure(s0, s1, s2);
    const roleAvg = 0.40 * s0.leadBr + 0.32 * s1.swapBr + 0.28 * s2.closerBr;
    const metaStrength = (s0.metaBonus + s1.metaBonus + s2.metaBonus) * 0.75;
    const viabilityScore = Math.max(
      100,
      Math.round(roleAvg + struct.structureBonus + metaStrength + commonCoreBonus + dupPenalty + megaPenalty)
    );

    // Power-exponential weighting so opponent teams with high rank/usage + Common Cores carry the highest simulation weight
    const rawWeight = Math.exp((viabilityScore - 500) / 34);

    const coreNote = topCore ? ` • 🔥 Core: ${topCore.monA}+${topCore.monB} (${topCore.usagePct.toFixed(1)}%)` : "";
    const rationale =
      (struct.primaryArchetype === "ABB"
        ? `ABB Lineup: ${opp6Names[j0]} protects ${opp6Names[j1]} & ${opp6Names[j2]} (${
            struct.sharedWeaknesses.slice(0, 2).map((w) => w.toUpperCase()).join("/") || "Shared"
          } bait)`
        : struct.primaryArchetype === "DUO"
        ? `Duo-Core: ${opp6Names[j0]} + ${opp6Names[j2]} core w/ ${opp6Names[j1]} Safe Swap`
        : `ABC Balanced: ${opp6Names[j0]} Lead, ${opp6Names[j1]} Swap, ${opp6Names[j2]} Closer`) + coreNote;

    return {
      permIdx,
      indices: [j0, j1, j2],
      trioKey: [j0, j1, j2].slice().sort().join("-"),
      lead: opp6Names[j0],
      swap: opp6Names[j1],
      closer: opp6Names[j2],
      archetype: struct.primaryArchetype,
      abbScore: struct.abbScore,
      abcScore: struct.abcScore,
      duoScore: struct.duoScore,
      oppMegaCount,
      coreNote,
      sharedWeaknesses: struct.sharedWeaknesses,
      viabilityScore,
      rawWeight,
      normWeight: 0,
      rationale
    };
  });

  const totalOppRawWeight = oppLineups120.reduce((acc, x) => acc + x.rawWeight, 0) || 1;
  for (const ol of oppLineups120) {
    ol.normWeight = ol.rawWeight / totalOppRawWeight;
  }

  const sortedOppByViability = [...oppLineups120].sort((a, b) => b.viabilityScore - a.viabilityScore);
  // Deduplicate top opponent teams by unordered trio set for cleaner display while preserving top ordered permutation
  const topOpponentViableTeams: Show6OpponentViableLineup[] = [];
  const seenOppSets = new Set<string>();
  for (const ol of sortedOppByViability) {
    const setKey = [...ol.indices].sort().join("-");
    if (seenOppSets.has(setKey) && topOpponentViableTeams.length >= 6) continue;
    seenOppSets.add(setKey);
    topOpponentViableTeams.push({
      id: `opp-viable-${ol.permIdx}`,
      rank: topOpponentViableTeams.length + 1,
      archetype: ol.archetype,
      names: [ol.lead, ol.swap, ol.closer],
      lead: ol.lead,
      swap: ol.swap,
      closer: ol.closer,
      viabilityScore: ol.viabilityScore,
      viabilityWeightPct: Number((ol.normWeight * 100).toFixed(1)),
      sharedWeaknesses: ol.sharedWeaknesses,
      rationale: ol.rationale
    });
    if (topOpponentViableTeams.length >= 8) break;
  }

  // Pick Top 3 Opponent Lineups per Archetype (ABB, ABC, DUO)
  const pickOppTop3ForArchetype = (
    targetArch: "ABB" | "ABC" | "DUO",
    archScoreGetter: (o: InternalOppLineup) => number
  ): Show6OpponentViableLineup[] => {
    const validMegaPool = oppLineups120.filter((o) => o.oppMegaCount <= 1);
    const basePool = validMegaPool.length >= 3 ? validMegaPool : oppLineups120;
    const compositeScore = (o: InternalOppLineup) => o.viabilityScore * 0.65 + archScoreGetter(o) * 0.35;
    const primaryPool = basePool.filter((o) => o.archetype === targetArch);
    const sortedPrimary = [...primaryPool].sort((a, b) => compositeScore(b) - compositeScore(a));
    const sortedAll = [...basePool].sort((a, b) => compositeScore(b) - compositeScore(a));

    const picked: InternalOppLineup[] = [];
    const usedPerm = new Set<number>();
    const usedTrioKeys = new Set<string>();

    for (const cand of [...sortedPrimary, ...sortedAll]) {
      if (picked.length >= 3) break;
      if (usedPerm.has(cand.permIdx)) continue;
      if (usedTrioKeys.has(cand.trioKey) && picked.length < 2) continue;
      usedPerm.add(cand.permIdx);
      usedTrioKeys.add(cand.trioKey);
      picked.push(cand);
    }

    return picked.slice(0, 3).map((ol, idx) => {
      const archRationale =
        (targetArch === "ABB"
          ? `ABB Lineup: ${ol.lead} covers ${ol.swap} & ${ol.closer} (${
              ol.sharedWeaknesses.slice(0, 2).map((w) => w.toUpperCase()).join("/") || "Shared"
            } bait)`
          : targetArch === "DUO"
          ? `Duo-Core: ${ol.lead} + ${ol.closer} reciprocal core w/ ${ol.swap} Safe Swap`
          : `ABC Balanced: ${ol.lead} Lead, ${ol.swap} Swap, ${ol.closer} Closer`) + ol.coreNote;
      return {
        id: `opp-${targetArch.toLowerCase()}-${idx + 1}-${ol.permIdx}`,
        rank: idx + 1,
        archetype: targetArch,
        names: [ol.lead, ol.swap, ol.closer],
        lead: ol.lead,
        swap: ol.swap,
        closer: ol.closer,
        viabilityScore: ol.viabilityScore,
        viabilityWeightPct: Number((ol.normWeight * 100).toFixed(1)),
        sharedWeaknesses: ol.sharedWeaknesses,
        rationale: archRationale
      };
    });
  };

  const oppTop3AbbTeams = pickOppTop3ForArchetype("ABB", (o) => o.abbScore);
  const oppTop3AbcTeams = pickOppTop3ForArchetype("ABC", (o) => o.abcScore);
  const oppTop3DuoTeams = pickOppTop3ForArchetype("DUO", (o) => o.duoScore);

  const top5OppPermIndices = sortedOppByViability.slice(0, 5).map((o) => o.permIdx);

  // =========================================================================
  // STEP 4: EVALUATE 120 USER LINEUPS x 120 OPPONENT LINEUPS (14,400 MATCHUPS)
  // =========================================================================
  const evaluate3v3OrderedBattleRating = (
    uIdx: [number, number, number],
    oIdx: [number, number, number]
  ): { br3v3: number; leadBr: number } => {
    const [u0, u1, u2] = uIdx;
    const [o0, o1, o2] = oIdx;

    const leadBr = pwMatrix[u0][o0].leadBr;

    if (leadBr >= 530) {
      // Winning Lead: Opponent swaps to o1 (or o2); we align our best counter from {u1, u2} or stay in
      const counterSwap1 = Math.max(pwMatrix[u1][o1].swapBr, pwMatrix[u2][o1].swapBr, pwMatrix[u0][o1].leadBr);
      const closerAlign =
        pwMatrix[u1][o1].swapBr >= pwMatrix[u2][o1].swapBr
          ? 0.55 * pwMatrix[u2][o2].closerBr + 0.45 * pwMatrix[u0][o2].closerBr
          : 0.55 * pwMatrix[u1][o2].closerBr + 0.45 * pwMatrix[u0][o2].closerBr;
      const br3v3 = Math.round(0.42 * leadBr + 0.31 * counterSwap1 + 0.27 * closerAlign);
      return { br3v3, leadBr };
    }

    if (leadBr <= 470) {
      // Losing Lead: We pivot to our Safe Swap u1; opponent answers with their best of {o0, o1, o2}
      const u1VsOppBestAnswer = Math.min(
        pwMatrix[u1][o0].swapBr,
        0.55 * pwMatrix[u1][o1].swapBr + 0.45 * pwMatrix[u1][o2].swapBr
      );
      // After swap phase, u0 and u2 attempt to farm down & close against opponent's remaining core
      const recoveryAndClose =
        0.45 * Math.max(pwMatrix[u0][o1].closerBr, pwMatrix[u2][o1].closerBr) +
        0.55 * Math.max(pwMatrix[u2][o2].closerBr, pwMatrix[u2][o0].closerBr);
      const br3v3 = Math.round(0.28 * leadBr + 0.36 * u1VsOppBestAnswer + 0.36 * recoveryAndClose);
      return { br3v3, leadBr };
    }

    // Neutral Lead (471..529): Balanced playout across Lead, Swap, and Backline
    const midSwap = 0.5 * pwMatrix[u1][o1].swapBr + 0.5 * Math.max(pwMatrix[u1][o2].swapBr, pwMatrix[u2][o1].swapBr);
    const endCloser = 0.55 * pwMatrix[u2][o2].closerBr + 0.45 * Math.max(pwMatrix[u2][o1].closerBr, pwMatrix[u0][o2].closerBr);
    const br3v3 = Math.round(0.38 * leadBr + 0.32 * midSwap + 0.30 * endCloser);
    return { br3v3, leadBr };
  };

  interface EvaluatedUserLineup {
    permIdx: number;
    indices: [number, number, number];
    trioKey: string;
    primaryArchetype: "ABB" | "ABC" | "DUO";
    abbEligibilityScore: number;
    duoEligibilityScore: number;
    abcEligibilityScore: number;
    sharedWeaknesses: string[];
    viabilityWeightedBr: number;
    rawAverageBr: number;
    leadWinPct: number;
    safeSwapScore: number;
    closerScore: number;
    worstCaseTop5Br: number;
    userCoreNote: string;
    vsTopOpponentTeams: Show6VsOpponentLineupBreakdown[];
  }

  const evaluatedUserLineups: EvaluatedUserLineup[] = perms120.map(([u0, u1, u2], permIdx) => {
    const ms0 = mySlotStats[u0];
    const ms1 = mySlotStats[u1];
    const ms2 = mySlotStats[u2];

    const struct = classifyOrderedTrioStructure(ms0, ms1, ms2);

    // Enforce 1-Mega limit & species clause on user Pick-3 lineup
    const userMegaCount =
      (isMegaOrPrimalSpecies(myOptimized6[u0].name) ? 1 : 0) +
      (isMegaOrPrimalSpecies(myOptimized6[u1].name) ? 1 : 0) +
      (isMegaOrPrimalSpecies(myOptimized6[u2].name) ? 1 : 0);
    const userMegaPenalty = userMegaCount > 1 ? -450 : 0;
    const userDupPenalty =
      ms0.baseSpecies === ms1.baseSpecies || ms0.baseSpecies === ms2.baseSpecies || ms1.baseSpecies === ms2.baseSpecies
        ? -250
        : 0;

    // Check if user trio features a Most-Used Core
    const uc01 = findShow6CommonCoreEntry(normLeague, myOptimized6[u0].name, myOptimized6[u1].name);
    const uc02 = findShow6CommonCoreEntry(normLeague, myOptimized6[u0].name, myOptimized6[u2].name);
    const uc12 = findShow6CommonCoreEntry(normLeague, myOptimized6[u1].name, myOptimized6[u2].name);
    const userCores = [uc01, uc02, uc12].filter((x): x is BattleFrontierCoreEntry => x !== null);
    userCores.sort((a, b) => b.usagePct - a.usagePct);
    const bestUserCore = userCores[0] || null;
    const userCoreBonus = bestUserCore ? Math.round(wUsage * (10 + bestUserCore.usagePct * 0.45)) : 0;
    const userCoreNote = bestUserCore
      ? ` • 🔥 Features ${bestUserCore.monA}+${bestUserCore.monB} Core (${bestUserCore.usagePct.toFixed(1)}% usage)`
      : "";

    let weightedBrSum = 0;
    let rawBrSum = 0;
    let weightedLeadWinSum = 0;
    const brByOppPerm: number[] = new Array(120);
    const leadBrByOppPerm: number[] = new Array(120);

    for (let oPerm = 0; oPerm < 120; oPerm++) {
      const oppL = oppLineups120[oPerm];
      const { br3v3, leadBr } = evaluate3v3OrderedBattleRating([u0, u1, u2], oppL.indices);
      brByOppPerm[oPerm] = br3v3;
      leadBrByOppPerm[oPerm] = leadBr;
      weightedBrSum += oppL.normWeight * br3v3;
      rawBrSum += br3v3;
      if (leadBr >= 500) {
        weightedLeadWinSum += oppL.normWeight * (leadBr >= 525 ? 1.0 : 0.65);
      }
    }

    const viabilityWeightedBr = Math.round(weightedBrSum);
    const rawAverageBr = Math.round(rawBrSum / 120);
    const leadWinPct = Math.round(weightedLeadWinSum * 100);
    const worstCaseTop5Br = Math.min(...top5OppPermIndices.map((pIdx) => brByOppPerm[pIdx]));
    const totalAdjust = userCoreBonus + userMegaPenalty + userDupPenalty;

    const vsTopOpponentTeams: Show6VsOpponentLineupBreakdown[] = sortedOppByViability.slice(0, 6).map((ol) => ({
      oppLineupLabel: `${ol.lead} / ${ol.swap} / ${ol.closer}`,
      oppLead: ol.lead,
      oppSwap: ol.swap,
      oppCloser: ol.closer,
      oppArchetype: ol.archetype,
      oppViabilityPct: Number((ol.normWeight * 100).toFixed(1)),
      matchupBr: brByOppPerm[ol.permIdx],
      leadBr: leadBrByOppPerm[ol.permIdx]
    }));

    return {
      permIdx,
      indices: [u0, u1, u2],
      trioKey: [u0, u1, u2].slice().sort().join("-"),
      primaryArchetype: struct.primaryArchetype,
      abbEligibilityScore: viabilityWeightedBr * 0.65 + struct.abbScore * 0.35 + worstCaseTop5Br * 0.15 + totalAdjust,
      duoEligibilityScore: viabilityWeightedBr * 0.65 + struct.duoScore * 0.35 + worstCaseTop5Br * 0.15 + totalAdjust,
      abcEligibilityScore: viabilityWeightedBr * 0.65 + struct.abcScore * 0.35 + worstCaseTop5Br * 0.15 + totalAdjust,
      sharedWeaknesses: struct.sharedWeaknesses,
      viabilityWeightedBr,
      rawAverageBr,
      leadWinPct,
      safeSwapScore: ms1.swapBr,
      closerScore: ms2.closerBr,
      worstCaseTop5Br,
      userCoreNote,
      vsTopOpponentTeams
    };
  });

  // Sort overall to assign overallRank
  const overallSorted = [...evaluatedUserLineups].sort(
    (a, b) => b.viabilityWeightedBr * 0.75 + b.worstCaseTop5Br * 0.25 - (a.viabilityWeightedBr * 0.75 + a.worstCaseTop5Br * 0.25)
  );
  const overallRankByPerm = new Map<number, number>();
  overallSorted.forEach((item, idx) => overallRankByPerm.set(item.permIdx, idx + 1));

  const toRecommendedLineup = (
    ev: EvaluatedUserLineup,
    archetype: "ABB" | "ABC" | "DUO",
    rankInArchetype: number
  ): Show6RecommendedLineup => {
    const [u0, u1, u2] = ev.indices;
    const p0 = myOptimized6[u0];
    const p1 = myOptimized6[u1];
    const p2 = myOptimized6[u2];

    const altNotes = [u0, u1, u2]
      .map((idx) => altNoteByMyIdx.get(idx))
      .filter((n): n is string => Boolean(n));

    const compositeShow6Score = Number(
      (0.65 * ev.viabilityWeightedBr + 0.20 * ev.worstCaseTop5Br + 0.15 * (500 + (ev.leadWinPct - 50) * 3)).toFixed(1)
    );

    const winsVsTop = ev.vsTopOpponentTeams.filter((x) => x.matchupBr >= 505).length;
    const sharedStr =
      ev.sharedWeaknesses.length > 0
        ? ev.sharedWeaknesses.slice(0, 2).map((w) => w.toUpperCase()).join("/")
        : "neutral";

    const synergySummary =
      (archetype === "ABB"
        ? `ABB Pick-3: ${p0.name} (Lead A) protects ${p1.name} (Bait B1) & ${p2.name} (Sweeper B2) across ${sharedStr} threats. Wins ${winsVsTop}/${ev.vsTopOpponentTeams.length} vs Opponent's most viable 3-mon lineups (${ev.viabilityWeightedBr} Weighted BR • ${ev.leadWinPct}% Lead Win)`
        : archetype === "DUO"
        ? `Duo-Core Pick-3: ${p0.name} (Core 1) + ${p2.name} (Core 2) cover each other's weaknesses with ${p1.name} (${ev.safeSwapScore} Swap BR) as Safe Switch. Wins ${winsVsTop}/${ev.vsTopOpponentTeams.length} vs Opponent's top viable teams (${ev.viabilityWeightedBr} Weighted BR)`
        : `ABC Balanced Pick-3: ${p0.name} Lead + ${p1.name} Safe Swap + ${p2.name} Closer. Wins ${winsVsTop}/${ev.vsTopOpponentTeams.length} vs Opponent's top viable teams (${ev.viabilityWeightedBr} Weighted BR • Floor ${ev.worstCaseTop5Br} BR)`) +
      `${ev.userCoreNote}.`;

    const orderedMembers: [TeamMember, TeamMember, TeamMember] = [
      { ...p0, id: "s6-slot-1" },
      { ...p1, id: "s6-slot-2" },
      { ...p2, id: "s6-slot-3" }
    ];

    const sortedVsOppDesc = [...ev.vsTopOpponentTeams].sort((a, b) => b.matchupBr - a.matchupBr);
    const strongestAgainst = sortedVsOppDesc
      .slice(0, 2)
      .map((x) => `${x.oppLead.split(" ")[0]}/${x.oppSwap.split(" ")[0]}/${x.oppCloser.split(" ")[0]} (${x.matchupBr})`);
    const dangerLineups = [...ev.vsTopOpponentTeams]
      .sort((a, b) => a.matchupBr - b.matchupBr)
      .slice(0, 2)
      .map((x) => `${x.oppLead.split(" ")[0]}/${x.oppSwap.split(" ")[0]}/${x.oppCloser.split(" ")[0]} (${x.matchupBr})`);

    return {
      id: `show6-rec-${archetype.toLowerCase()}-${rankInArchetype}-${ev.permIdx}`,
      archetype,
      rankInArchetype,
      overallRank: overallRankByPerm.get(ev.permIdx) || 1,
      league: normLeague,
      pokemon: orderedMembers,
      members: orderedMembers,
      viabilityWeightedBr: ev.viabilityWeightedBr,
      expectedWeightedBr: ev.viabilityWeightedBr,
      rawAverageBr: ev.rawAverageBr,
      leadWinPct: ev.leadWinPct,
      safeSwapScore: ev.safeSwapScore,
      closerScore: ev.closerScore,
      worstCaseTop5Br: ev.worstCaseTop5Br,
      worstCaseBr: ev.worstCaseTop5Br,
      compositeShow6Score,
      sharedWeaknesses: ev.sharedWeaknesses,
      altMovesetNotes: altNotes,
      synergySummary,
      strongestAgainst,
      dangerLineups,
      vsTopOpponentTeams: ev.vsTopOpponentTeams
    };
  };

  // Pick Top 3 diverse lineups for each archetype (ABB, ABC, DUO), strictly avoiding >1 Mega if valid options exist
  const pickTop3ForArchetype = (
    archetype: "ABB" | "ABC" | "DUO",
    scoreGetter: (e: EvaluatedUserLineup) => number
  ): Show6RecommendedLineup[] => {
    const validSingleMegaPool = evaluatedUserLineups.filter((e) => {
      const [u0, u1, u2] = e.indices;
      return !hasMultipleMegas([myOptimized6[u0], myOptimized6[u1], myOptimized6[u2]]);
    });
    const basePool = validSingleMegaPool.length >= 3 ? validSingleMegaPool : evaluatedUserLineups;
    const primaryPool = basePool.filter((e) => e.primaryArchetype === archetype);
    const sortedPrimary = [...primaryPool].sort((a, b) => scoreGetter(b) - scoreGetter(a));
    const sortedAll = [...basePool].sort((a, b) => scoreGetter(b) - scoreGetter(a));

    const picked: EvaluatedUserLineup[] = [];
    const usedPerm = new Set<number>();
    const usedTrioKeys = new Set<string>();

    for (const cand of [...sortedPrimary, ...sortedAll]) {
      if (picked.length >= 3) break;
      if (usedPerm.has(cand.permIdx)) continue;
      if (usedTrioKeys.has(cand.trioKey) && picked.length < 2) continue;
      usedPerm.add(cand.permIdx);
      usedTrioKeys.add(cand.trioKey);
      picked.push(cand);
    }

    return picked.slice(0, 3).map((ev, idx) => toRecommendedLineup(ev, archetype, idx + 1));
  };

  const top3AbbTeams = pickTop3ForArchetype("ABB", (e) => e.abbEligibilityScore);
  const top3AbcTeams = pickTop3ForArchetype("ABC", (e) => e.abcEligibilityScore);
  const top3DuoTeams = pickTop3ForArchetype("DUO", (e) => e.duoEligibilityScore);

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    league: normLeague,
    leagueAbbr: getLeagueAbbreviation(normLeague),
    myOptimized6,
    my6SimulatedBestMoves: myOptimized6,
    opp6Names,
    top3AbbTeams,
    top3AbcTeams,
    top3DuoTeams,
    topAbbLineups: top3AbbTeams,
    topAbcLineups: top3AbcTeams,
    topDuoLineups: top3DuoTeams,
    topOpponentViableTeams,
    topOpponentViableLineups: topOpponentViableTeams,
    oppTop3AbbTeams,
    oppTop3AbcTeams,
    oppTop3DuoTeams,
    totalOrderedPairsEvaluated: 14400,
    totalMatchupsSimulated: 14400,
    movesetsSimulated,
    elapsedMs: Math.max(1, Math.round(t1 - t0))
  };
}

/**
 * Mode 2 — Blind Show 6 Optimal Roster Builder (Pre-Match Pick-6 against Fused Usage/Core Meta + Historical):
 * Builds a synergistic 6-Pokémon tournament roster (supporting 0–5 lockable core slots)
 * against the fused Battle Frontier Usage & Cores + PvPoke Rankings + Expected Historical distribution,
 * enforcing the 1-Mega limit and rewarding Most-Used Cores.
 */
export function generateBlindShow6Roster(params: {
  league: string;
  lockedPokemonNames?: string[];
  lockedCoreNames?: string[];
  filterMode?: "OPEN" | "WHITELIST" | "BANLIST";
  metaFilterMode?: "OPEN" | "WHITELIST" | "BANLIST";
  filterPokemonInput?: string | string[];
  whitelistNames?: string | string[];
  banlistNames?: string | string[];
  historicalPokemonInput?: string | string[];
  historicalExpectedNames?: string | string[];
  historicalWeightPct?: number; // 0..100
  usageWeightPct?: number; // 0..100 (default 65% Usage & Cores / 35% PvPoke)
}): BlindShow6RosterResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const normLeague: LeagueType = normalizeLeagueName(params.league || "Battle Frontier (Spectral)");
  const usageWeightPct = Math.max(
    0,
    Math.min(100, Math.round(params.usageWeightPct ?? getShow6UsageAndCoreWeightPct()))
  );
  const wUsage = usageWeightPct / 100;

  const filterMode = params.metaFilterMode || params.filterMode || "OPEN";
  const rawFilterInput =
    params.filterPokemonInput ??
    (filterMode === "WHITELIST"
      ? params.whitelistNames
      : filterMode === "BANLIST"
      ? params.banlistNames
      : []);
  const parsedFilterList = parsePokemonListInput(rawFilterInput || [], normLeague);
  const filterLowerSet = new Set(parsedFilterList.map((n) => n.toLowerCase()));
  const filterBaseSet = new Set(
    parsedFilterList.map((n) => getTypesAndWeaknessesForSpecies(n, normLeague).baseSpecies)
  );

  // Parse Historical Expected Pokémon (allowing duplicates in raw input to weight frequency!)
  const rawHistSource = params.historicalExpectedNames ?? params.historicalPokemonInput ?? [];
  const rawHistTokens = Array.isArray(rawHistSource)
    ? rawHistSource
    : (rawHistSource || "")
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

  const histFreqMap = new Map<string, number>();
  let totalHistCount = 0;
  for (const tok of rawHistTokens) {
    const parsed = parsePokemonListInput([tok], normLeague);
    if (parsed[0]) {
      const name = parsed[0];
      histFreqMap.set(name, (histFreqMap.get(name) || 0) + 1);
      totalHistCount++;
    }
  }

  const rawSliderPct = Math.max(0, Math.min(100, Math.round(params.historicalWeightPct ?? 35)));
  const effectiveHistPct = totalHistCount > 0 ? rawSliderPct : 0;
  const effectiveMetaPct = 100 - effectiveHistPct;
  const wHist = effectiveHistPct / 100;
  const wMeta = effectiveMetaPct / 100;

  // Build eligible candidate pool from Fused Usage+PvPoke Meta + Top 120 League Meta + Whitelist/Historical
  const fusedMeta = getShow6WeightedMetaList(normLeague, usageWeightPct, 70);
  const baseCandidates = getTop100MetaCandidatesForLeague(normLeague, 120);
  const isEligibleSpecies = (name: string): boolean => {
    const low = name.toLowerCase();
    const base = getTypesAndWeaknessesForSpecies(name, normLeague).baseSpecies;
    if (filterMode === "WHITELIST" && parsedFilterList.length > 0) {
      return filterLowerSet.has(low) || filterBaseSet.has(base);
    }
    if (filterMode === "BANLIST" && parsedFilterList.length > 0) {
      return !filterLowerSet.has(low) && !filterBaseSet.has(base);
    }
    return true;
  };

  const eligiblePool: TeamMember[] = [];
  const seenEligible = new Set<string>();

  const addEligible = (rawName: string) => {
    const rec = getRecommendedMovesForPokemon(rawName, normLeague);
    if (!rec) return;
    if (!isEligibleSpecies(rec.name)) return;
    const low = rec.name.toLowerCase();
    if (seenEligible.has(low)) return;
    seenEligible.add(low);
    eligiblePool.push({
      id: `blind-cand-${eligiblePool.length + 1}`,
      name: rec.name,
      cp: rec.cp,
      fastMove: rec.fastMove,
      chargedMove1: rec.chargedMove1,
      chargedMove2: rec.chargedMove2,
      ivs: rec.defaultIvs
    });
  };

  if (filterMode === "WHITELIST" && parsedFilterList.length > 0) {
    for (const wName of parsedFilterList) {
      addEligible(wName);
    }
  }
  for (const fItem of fusedMeta) {
    addEligible(fItem.name);
    if (eligiblePool.length >= 65) break;
  }
  for (const c of baseCandidates) {
    if (eligiblePool.length >= 70) break;
    addEligible(c.name);
  }
  for (const hName of histFreqMap.keys()) {
    addEligible(hName);
  }

  // Fallback if whitelist was too small (< 6)
  if (eligiblePool.length < 6) {
    for (const c of baseCandidates) {
      const low = c.name.toLowerCase();
      if (!seenEligible.has(low)) {
        seenEligible.add(low);
        eligiblePool.push(c);
      }
      if (eligiblePool.length >= 12) break;
    }
  }

  // Build Blended Threat Weight Distribution across Top 32 eligible threats using Fused Usage + PvPoke weights
  const metaWeightMap = new Map<string, number>();
  let metaSum = 0;
  for (const fItem of fusedMeta) {
    const rec = getRecommendedMovesForPokemon(fItem.name, normLeague);
    const resolvedName = rec?.name || fItem.name;
    if (isEligibleSpecies(resolvedName)) {
      metaWeightMap.set(resolvedName, (metaWeightMap.get(resolvedName) || 0) + fItem.weight);
      metaSum += fItem.weight;
    }
  }
  if (metaWeightMap.size < 10) {
    eligiblePool.slice(0, 40).forEach((m, idx) => {
      if (!metaWeightMap.has(m.name)) {
        const w = Math.exp(-0.045 * idx) * 0.25;
        metaWeightMap.set(m.name, w);
        metaSum += w;
      }
    });
  }
  if (metaSum > 0) {
    for (const [k, v] of metaWeightMap.entries()) metaWeightMap.set(k, v / metaSum);
  }

  const histWeightMap = new Map<string, number>();
  if (totalHistCount > 0) {
    for (const [k, cnt] of histFreqMap.entries()) {
      if (isEligibleSpecies(k)) {
        histWeightMap.set(k, cnt / totalHistCount);
      }
    }
  }

  const blendedThreatMap = new Map<string, number>();
  const allThreatNames = new Set<string>([...metaWeightMap.keys(), ...histWeightMap.keys()]);
  let totalBlended = 0;
  for (const tName of allThreatNames) {
    const mW = metaWeightMap.get(tName) || 0;
    const hW = histWeightMap.get(tName) || 0;
    const combined = wMeta * mW + wHist * hW;
    if (combined > 0) {
      blendedThreatMap.set(tName, combined);
      totalBlended += combined;
    }
  }
  if (totalBlended > 0) {
    for (const [k, v] of blendedThreatMap.entries()) blendedThreatMap.set(k, v / totalBlended);
  }

  const sortedThreats = Array.from(blendedThreatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 28);
  const topThreatNames = sortedThreats.map((e) => e[0]);

  // Evaluate each candidate in eligiblePool against topThreatNames
  interface BlindCandEval {
    member: TeamMember;
    baseSpecies: string;
    types: string[];
    weaknesses: string[];
    resistances: string[];
    leadBr: number;
    swapBr: number;
    closerBr: number;
    overallBr: number;
    byThreat: Map<string, number>;
    topWins: string[];
  }

  const candEvals: BlindCandEval[] = eligiblePool.map((cand) => {
    const tInfo = getTypesAndWeaknessesForSpecies(cand.name, normLeague);
    const byThreat = new Map<string, number>();
    let lSum = 0;
    let sSum = 0;
    let cSum = 0;
    let wTotal = 0;
    const wins: Array<{ name: string; br: number }> = [];

    for (const [tName, weight] of sortedThreats) {
      const pw = evaluatePositionWeightedBr(cand, tName, normLeague);
      const avgRoleBr = Math.round(0.38 * pw.leadBr + 0.34 * pw.swapBr + 0.28 * pw.closerBr);
      byThreat.set(tName, avgRoleBr);
      lSum += weight * pw.leadBr;
      sSum += weight * pw.swapBr;
      cSum += weight * pw.closerBr;
      wTotal += weight;
      if (avgRoleBr >= 520) wins.push({ name: tName, br: avgRoleBr });
    }
    wins.sort((a, b) => b.br - a.br);
    const norm = wTotal > 0 ? wTotal : 1;
    const leadBr = Math.round(lSum / norm);
    const swapBr = Math.round(sSum / norm);
    const closerBr = Math.round(cSum / norm);
    const overallBr = Math.round(0.36 * leadBr + 0.34 * swapBr + 0.30 * closerBr);

    return {
      member: cand,
      baseSpecies: tInfo.baseSpecies,
      types: tInfo.types,
      weaknesses: tInfo.weaknesses,
      resistances: tInfo.resistances,
      leadBr,
      swapBr,
      closerBr,
      overallBr,
      byThreat,
      topWins: wins.slice(0, 4).map((w) => w.name)
    };
  });

  // Resolve user's 0-5 locked core Pokémon (enforcing 1-Mega limit & species clause)
  const selected6: Array<{ eval: BlindCandEval; isLocked: boolean }> = [];
  const usedBaseSpecies = new Set<string>();

  const rawLocksList = params.lockedCoreNames ?? params.lockedPokemonNames ?? [];
  for (const rawLock of rawLocksList.slice(0, 6)) {
    const parsed = parsePokemonListInput([rawLock], normLeague);
    if (!parsed[0]) continue;
    const lockName = parsed[0];
    let matchedEval = candEvals.find((c) => c.member.name.toLowerCase() === lockName.toLowerCase());
    if (!matchedEval) {
      const rec = getRecommendedMovesForPokemon(lockName, normLeague);
      if (rec) {
        const tInfo = getTypesAndWeaknessesForSpecies(rec.name, normLeague);
        const byThreat = new Map<string, number>();
        for (const [tName] of sortedThreats) {
          const pw = evaluatePositionWeightedBr(rec.name, tName, normLeague);
          byThreat.set(tName, Math.round(0.38 * pw.leadBr + 0.34 * pw.swapBr + 0.28 * pw.closerBr));
        }
        matchedEval = {
          member: {
            id: `blind-lock-${selected6.length + 1}`,
            name: rec.name,
            cp: rec.cp,
            fastMove: rec.fastMove,
            chargedMove1: rec.chargedMove1,
            chargedMove2: rec.chargedMove2,
            ivs: rec.defaultIvs
          },
          baseSpecies: tInfo.baseSpecies,
          types: tInfo.types,
          weaknesses: tInfo.weaknesses,
          resistances: tInfo.resistances,
          leadBr: 525,
          swapBr: 520,
          closerBr: 525,
          overallBr: 523,
          byThreat,
          topWins: topThreatNames.slice(0, 3)
        };
      }
    }
    if (matchedEval && !usedBaseSpecies.has(matchedEval.baseSpecies)) {
      if (
        isMegaOrPrimalSpecies(matchedEval.member.name) &&
        selected6.some((s) => isMegaOrPrimalSpecies(s.eval.member.name))
      ) {
        continue;
      }
      usedBaseSpecies.add(matchedEval.baseSpecies);
      selected6.push({ eval: matchedEval, isLocked: true });
    }
  }

  // Iteratively fill remaining slots up to 6 to maximize complementary threat coverage + Common Core synergy + role diversity
  while (selected6.length < 6) {
    let bestCand: BlindCandEval | null = null;
    let bestMarginalScore = -Infinity;

    for (const cand of candEvals) {
      if (usedBaseSpecies.has(cand.baseSpecies)) continue;
      // Strict 1-Mega rule per team of 6
      if (
        isMegaOrPrimalSpecies(cand.member.name) &&
        selected6.some((s) => isMegaOrPrimalSpecies(s.eval.member.name))
      ) {
        continue;
      }

      const trialRoster = [...selected6.map((s) => s.eval), cand];

      // 1. Threat coverage across top blended threats: reward covering threats that current roster struggles with
      let coverageScore = 0;
      for (const [tName, weight] of sortedThreats) {
        const brs = trialRoster.map((r) => r.byThreat.get(tName) ?? 500).sort((a, b) => b - a);
        const bestBr = brs[0] ?? 500;
        const secondBestBr = brs[1] ?? bestBr;
        coverageScore += weight * (0.55 * bestBr + 0.45 * secondBestBr);
      }

      // 2. Shared weakness penalty: avoid 3+ Pokémon in the 6 sharing an unresisted weakness
      let sharedWeakPenalty = 0;
      for (const atkT of ALL_18_TYPES) {
        const weakCount = trialRoster.filter((r) => r.weaknesses.includes(atkT)).length;
        const resistCount = trialRoster.filter((r) => r.resistances.includes(atkT)).length;
        if (weakCount >= 3 && resistCount <= 1) {
          sharedWeakPenalty += (weakCount - 2) * 28;
        } else if (weakCount >= 4) {
          sharedWeakPenalty += (weakCount - 3) * 22;
        }
      }

      // 3. Role balance bonus (ensure flexible Leads, Safe Swaps, and Closers)
      const slotIdx = selected6.length;
      const roleEmphasis =
        slotIdx === 0 || slotIdx === 1
          ? 0.45 * cand.leadBr + 0.30 * cand.swapBr + 0.25 * cand.closerBr
          : slotIdx === 2 || slotIdx === 3
          ? 0.25 * cand.leadBr + 0.50 * cand.swapBr + 0.25 * cand.closerBr
          : 0.25 * cand.leadBr + 0.25 * cand.swapBr + 0.50 * cand.closerBr;

      // 4. Yin-Yang & ABB synergy + Battle Frontier Most-Used Core bonus with existing roster members
      let pairwiseSynergy = 0;
      for (const existing of selected6) {
        const exR = new Set(existing.eval.resistances);
        const caR = new Set(cand.resistances);
        const cov1 = cand.weaknesses.filter((w) => exR.has(w)).length;
        const cov2 = existing.eval.weaknesses.filter((w) => caR.has(w)).length;
        pairwiseSynergy += (cov1 + cov2) * 3.2;

        const coreMatch = findShow6CommonCoreEntry(normLeague, existing.eval.member.name, cand.member.name);
        if (coreMatch) {
          pairwiseSynergy += (14 + coreMatch.usagePct * 0.65) * (0.35 + 0.65 * wUsage);
        }
      }

      const totalScore = coverageScore * 1.35 + roleEmphasis * 0.45 + pairwiseSynergy - sharedWeakPenalty;
      if (totalScore > bestMarginalScore) {
        bestMarginalScore = totalScore;
        bestCand = cand;
      }
    }

    if (!bestCand) break;
    usedBaseSpecies.add(bestCand.baseSpecies);
    selected6.push({ eval: bestCand, isLocked: false });
  }

  // Evaluate embedded Pick-3 combinations against the Top 6 blended threats (ensuring <=1 Mega in top6ThreatsForSim)
  const rawTopThreats = [
    ...topThreatNames,
    ...getLeagueTopMetaSpeciesNames(normLeague, 12)
  ];
  const top6ThreatsForSim: string[] = [];
  let simHasMega = false;
  for (const t of rawTopThreats) {
    if (top6ThreatsForSim.length >= 6) break;
    if (top6ThreatsForSim.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    if (isMegaOrPrimalSpecies(t)) {
      if (simHasMega) continue;
      simHasMega = true;
    }
    top6ThreatsForSim.push(t);
  }

  const rawRoster6 = selected6.map((s, idx) => ({
    ...s.eval.member,
    id: `blind-slot-${idx + 1}`
  }));

  const embeddedPick3Preview = evaluateShow6Pick3Matchup(normLeague, rawRoster6, top6ThreatsForSim);
  const optimizedRoster6 = embeddedPick3Preview.myOptimized6;

  // Audit overall field coverage across topThreatNames
  let beatenThreatsCount = 0;
  for (const tName of topThreatNames) {
    const best2 = selected6
      .map((s) => s.eval.byThreat.get(tName) ?? 500)
      .sort((a, b) => b - a);
    if ((best2[0] ?? 500) >= 520 && (best2[1] ?? 500) >= 500) {
      beatenThreatsCount++;
    }
  }
  const totalThreatsAudited = Math.max(1, topThreatNames.length);
  const fieldCoveragePct = Math.min(99, Math.max(55, Math.round((beatenThreatsCount / totalThreatsAudited) * 100)));

  const roleBadges = [
    "FLEX LEAD / CORE 1",
    "SAFE PIVOT / SWAP 1",
    "ANTI-META CORE 2",
    "BAIT / SAFE SWAP 2",
    "CLOSER / SWEEPER 1",
    "CORE BREAKER / ANCHOR"
  ];

  const slotEvals: BlindShow6RosterSlotEval[] = selected6.map((s, idx) => {
    let metaSumBr = 0;
    let metaW = 0;
    let histSumBr = 0;
    let histW = 0;
    for (const [tName, mWeight] of metaWeightMap.entries()) {
      const brVal = s.eval.byThreat.get(tName) ?? s.eval.overallBr;
      metaSumBr += mWeight * brVal;
      metaW += mWeight;
    }
    for (const [tName, hWeight] of histWeightMap.entries()) {
      const brVal = s.eval.byThreat.get(tName) ?? s.eval.overallBr;
      histSumBr += hWeight * brVal;
      histW += hWeight;
    }
    const metaBr = metaW > 0 ? Math.round(metaSumBr / metaW) : s.eval.overallBr;
    const historicalBr = histW > 0 ? Math.round(histSumBr / histW) : s.eval.overallBr;
    return {
      slotIndex: idx,
      member: optimizedRoster6[idx] || s.eval.member,
      isLocked: s.isLocked,
      roleBadge: roleBadges[idx] || `SLOT ${idx + 1}`,
      leadBr: s.eval.leadBr,
      swapBr: s.eval.swapBr,
      closerBr: s.eval.closerBr,
      overallBr: s.eval.overallBr,
      blendedBr: s.eval.overallBr,
      metaBr,
      historicalBr,
      topWins: s.eval.topWins
    };
  });

  const avgRosterBr = Math.round(
    slotEvals.reduce((acc, s) => acc + s.overallBr, 0) / Math.max(1, slotEvals.length)
  );

  const topBlendedThreats = sortedThreats.slice(0, 12).map(([name, w], idx) => ({
    rank: idx + 1,
    name,
    weightPct: Number((w * 100).toFixed(1))
  }));

  const filterDesc =
    filterMode === "WHITELIST"
      ? `Whitelist Cup (${parsedFilterList.length} eligible)`
      : filterMode === "BANLIST"
      ? `Remixed Banlist (${parsedFilterList.length} banned)`
      : `Fused Meta (${usageWeightPct}% Usage+Cores / ${100 - usageWeightPct}% PvPoke)`;

  const synergySummary = `Synergistic Show-6 Roster (${filterDesc} • ${effectiveMetaPct}% Meta / ${effectiveHistPct}% Custom): Covers ${beatenThreatsCount}/${totalThreatsAudited} top weighted threats (${fieldCoveragePct}% Multi-Counter Field Coverage) with built-in ABB (${embeddedPick3Preview.top3AbbTeams[0]?.pokemon.map((p) => p.name).join("/") || "Ready"}), ABC, and Duo-Core Pick-3 trios.`;

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    league: normLeague,
    leagueAbbr: getLeagueAbbreviation(normLeague),
    filterMode,
    filterCount: parsedFilterList.length,
    historicalCount: totalHistCount,
    historicalWeightPct: effectiveHistPct,
    metaWeightPct: effectiveMetaPct,
    roster6: optimizedRoster6,
    slotEvals,
    roster: slotEvals,
    fieldCoveragePct,
    avgRosterBr,
    overallBlendedScore: avgRosterBr,
    eligiblePoolCount: eligiblePool.length,
    beatenThreatsCount,
    totalThreatsAudited,
    embeddedPick3Preview,
    topBlendedThreats,
    synergySummary,
    elapsedMs: Math.max(1, Math.round(t1 - t0))
  };
}

/**
 * Live Show 6 AI Backline Predictor:
 * Strictly constrains candidate hidden backline Pokémon and tactical warnings to the
 * unrevealed Pokémon remaining in the Opponent's known 6-Pokémon roster, and boosts
 * unrevealed Pokémon that form a Most-Used Core with the opponent's revealed Pokémon!
 */
export function predictShow6UnrevealedBackline(
  league: string,
  knownOpponent6: string[],
  revealedOpponents: string[],
  userTeam: TeamMember[] = []
): Show6LiveBacklinePredictionResult {
  const normLeague = normalizeLeagueName(league || "Battle Frontier (Spectral)");
  const wUsage = getShow6UsageAndCoreWeightPct() / 100;

  const cleanOpp6 = (knownOpponent6 || [])
    .map((n) => canonicalizeMetaPokemonName(n))
    .filter(Boolean)
    .slice(0, 6);

  const cleanRevealed: string[] = [];
  const revSet = new Set<string>();
  for (const r of revealedOpponents || []) {
    const c = canonicalizeMetaPokemonName(r);
    if (c && !revSet.has(c.toLowerCase())) {
      revSet.add(c.toLowerCase());
      cleanRevealed.push(c);
    }
  }

  const unrevealedPool = cleanOpp6.filter((p) => !revSet.has(p.toLowerCase()));

  if (cleanOpp6.length === 0) {
    const emptyMsg = "Enter Opponent's 6 in Show 6 Teams to constrain AI backline predictions.";
    return {
      knownOpponent6: [],
      revealedOpponents: cleanRevealed,
      unrevealedPool: [],
      predictions: [],
      mostLikelyPairs: [],
      criticalPreserveCallout: emptyMsg,
      tacticalSummary: emptyMsg
    };
  }

  // Helper to evaluate a 3-mon opponent lineup's structural, Common Core & meta viability
  const scoreOppTrio = (a: string, b: string, c: string) => {
    const sa = getTypesAndWeaknessesForSpecies(a, normLeague);
    const sb = getTypesAndWeaknessesForSpecies(b, normLeague);
    const sc = getTypesAndWeaknessesForSpecies(c, normLeague);
    const struct = classifyOrderedTrioStructure(
      { ...sa, leadBr: 520, swapBr: 515, closerBr: 515 },
      { ...sb, leadBr: 515, swapBr: 525, closerBr: 515 },
      { ...sc, leadBr: 515, swapBr: 515, closerBr: 525 }
    );
    const megaPenalty = hasMultipleMegas([a, b, c]) ? -250 : 0;
    const cAB = findShow6CommonCoreEntry(normLeague, a, b);
    const cAC = findShow6CommonCoreEntry(normLeague, a, c);
    const cBC = findShow6CommonCoreEntry(normLeague, b, c);
    const matchedCores = [cAB, cAC, cBC].filter((x): x is BattleFrontierCoreEntry => x !== null);
    matchedCores.sort((x, y) => y.usagePct - x.usagePct);
    const topCore = matchedCores[0] || null;
    const secondCore = matchedCores[1] || null;
    const coreBonus = topCore
      ? Math.round((0.45 + 0.55 * wUsage) * (24 + topCore.usagePct * 0.95 + (secondCore ? secondCore.usagePct * 0.4 : 0)))
      : 0;
    const coreNote = topCore ? ` • 🔥 Common Core: ${topCore.monA}+${topCore.monB} (${topCore.usagePct.toFixed(1)}%)` : "";

    const rawScore = 500 + struct.structureBonus + coreBonus + megaPenalty;
    return {
      archetype: struct.primaryArchetype,
      score: rawScore,
      sharedWeaknesses: struct.sharedWeaknesses,
      coreNote,
      topCore
    };
  };

  const rawPreds: Array<{
    names: string[];
    fullLineup: [string, string, string];
    archetype: "ABB" | "ABC" | "DUO";
    viabilityScore: number;
    rawWeight: number;
    rationale: string;
  }> = [];

  if (cleanRevealed.length === 1) {
    // 1 Revealed (Lead): Evaluate all pairs from unrevealedPool (up to 5 choose 2 = 10 pairs)
    const lead = cleanRevealed[0];
    for (let i = 0; i < unrevealedPool.length; i++) {
      for (let j = i + 1; j < unrevealedPool.length; j++) {
        const pA = unrevealedPool[i];
        const pB = unrevealedPool[j];
        const e1 = scoreOppTrio(lead, pA, pB);
        const e2 = scoreOppTrio(lead, pB, pA);
        const best = e1.score >= e2.score ? { swap: pA, closer: pB, ...e1 } : { swap: pB, closer: pA, ...e2 };
        rawPreds.push({
          names: [best.swap, best.closer],
          fullLineup: [lead, best.swap, best.closer],
          archetype: best.archetype,
          viabilityScore: best.score,
          rawWeight: Math.exp((best.score - 500) / 22),
          rationale:
            (best.archetype === "ABB"
              ? `ABB Backline (${best.sharedWeaknesses.slice(0, 2).map((w) => w.toUpperCase()).join("/") || "Bait"} pair covered by ${lead})`
              : best.archetype === "DUO"
              ? `Duo-Core w/ ${lead} + ${best.closer} & ${best.swap} Pivot`
              : `ABC Balanced Coverage behind ${lead}`) + best.coreNote
        });
      }
    }
  } else if (cleanRevealed.length === 2) {
    // 2 Revealed (Lead + Swap): Evaluate each remaining Pokémon in unrevealedPool (up to 4 candidates) as Closer
    const [lead, swap] = cleanRevealed;
    for (const candCloser of unrevealedPool) {
      const ev = scoreOppTrio(lead, swap, candCloser);
      rawPreds.push({
        names: [candCloser],
        fullLineup: [lead, swap, candCloser],
        archetype: ev.archetype,
        viabilityScore: ev.score,
        rawWeight: Math.exp((ev.score - 500) / 20),
        rationale:
          (ev.archetype === "ABB"
            ? `Completes ABB Backline w/ ${swap} behind ${lead}`
            : ev.archetype === "DUO"
            ? `Completes Duo-Core w/ ${lead} (${swap} Pivot)`
            : `Covers ${lead} + ${swap} weaknesses as ABC Closer`) + ev.coreNote
      });
    }
  } else if (cleanRevealed.length >= 3) {
    const [l, s, c] = cleanRevealed;
    const ev = scoreOppTrio(l, s, c);
    rawPreds.push({
      names: [],
      fullLineup: [l, s, c],
      archetype: ev.archetype,
      viabilityScore: ev.score,
      rawWeight: 1,
      rationale: `All 3 Opponent Pokémon Revealed (${l} / ${s} / ${c})${ev.coreNote}`
    });
  } else {
    // 0 Revealed: Top viable 3-mon lineups from Opponent's 6
    for (let i = 0; i < cleanOpp6.length; i++) {
      for (let j = 0; j < cleanOpp6.length; j++) {
        if (j === i) continue;
        for (let k = j + 1; k < cleanOpp6.length; k++) {
          if (k === i) continue;
          const l = cleanOpp6[i];
          const s = cleanOpp6[j];
          const c = cleanOpp6[k];
          const ev = scoreOppTrio(l, s, c);
          rawPreds.push({
            names: [l, s, c],
            fullLineup: [l, s, c],
            archetype: ev.archetype,
            viabilityScore: ev.score,
            rawWeight: Math.exp((ev.score - 500) / 22),
            rationale: `Pre-Match Predicted ${ev.archetype} Lineup${ev.coreNote}`
          });
        }
      }
    }
  }

  rawPreds.sort((a, b) => b.viabilityScore - a.viabilityScore);
  const topSlice = rawPreds.slice(0, 5);
  const weightSum = topSlice.reduce((acc, x) => acc + x.rawWeight, 0) || 1;

  const predictions: Show6LiveBacklinePredictionItem[] = topSlice.map((p) => ({
    names: p.names,
    backlineNames: p.names.length > 0 ? p.names : p.fullLineup,
    fullLineup: p.fullLineup,
    archetype: p.archetype,
    probabilityPct: Math.round((p.rawWeight / weightSum) * 100),
    viabilityScore: p.viabilityScore,
    rationale: p.rationale
  }));

  // Compute critical preserve callout: which user Pokémon is our best/only answer to the top unrevealed threats in Opponent's 6?
  let criticalPreserveCallout = "All 3 opponent Pokémon revealed — play standard endgame alignment.";
  if (unrevealedPool.length > 0 && userTeam.length >= 3) {
    const topUnseen = predictions[0]?.names?.[0] || unrevealedPool[0];
    const leadCoreCheck = cleanRevealed[0] ? findShow6CommonCoreEntry(normLeague, cleanRevealed[0], topUnseen) : null;
    const coreAlert = leadCoreCheck ? ` [🔥 Core w/ ${cleanRevealed[0]} (${leadCoreCheck.usagePct.toFixed(1)}%)]` : "";
    const brs = userTeam.map((m) => ({
      name: m.name,
      br: evaluatePositionWeightedBr(m, topUnseen, normLeague).closerBr
    }));
    brs.sort((a, b) => b.br - a.br);
    if (brs[0]) {
      criticalPreserveCallout = `Preserve ${brs[0].name} (${brs[0].br} BR) or 1S for unrevealed ${topUnseen}${coreAlert} in Opponent's 6.`;
    }
  } else if (unrevealedPool.length > 0) {
    criticalPreserveCallout = `Unrevealed Opponent 6 Pool (${unrevealedPool.length} left): ${unrevealedPool.join(", ")}`;
  }

  return {
    knownOpponent6: cleanOpp6,
    revealedOpponents: cleanRevealed,
    unrevealedPool,
    predictions,
    mostLikelyPairs: predictions,
    criticalPreserveCallout,
    tacticalSummary: criticalPreserveCallout
  };
}

/**
 * Pick-6 Team Editor — Slot Replacement Recommendation:
 * Recommends up to `maxSuggestions` (default 5) alternate Pokémon for a specific slot (0..5)
 * of a stored My 6 or Opponent 6 roster, enforcing the Species Clause and 1-Mega Limit,
 * and ranking candidates by Fused Meta Coverage + Common Core Synergy + Slot BR delta.
 */
export interface Show6SlotUpgradeSuggestion {
  slotIndex: number;
  candidate: TeamMember;
  replacement: TeamMember;
  newSlotBr: number;
  newBr: number;
  deltaSlotBr: number;
  deltaBr: number;
  usagePct: number;
  newRosterCoveragePct: number;
  deltaCoveragePct: number;
  corePartnersInRoster: string[];
  synergyNote: string;
  synergyReason: string;
  summaryBadge: string;
}

export function recommendShow6RosterSlotUpgrades(
  roster6: TeamMember[],
  leagueOrSlotIndex: string | number,
  slotIndexOrLeague: number | string,
  maxSuggestions: number = 5
): Show6SlotUpgradeSuggestion[] {
  const slotIndex = typeof leagueOrSlotIndex === "number" ? leagueOrSlotIndex : Number(slotIndexOrLeague) || 0;
  const rawLeague = typeof leagueOrSlotIndex === "string" ? leagueOrSlotIndex : String(slotIndexOrLeague || "Battle Frontier (Spectral)");
  const normLeague = normalizeLeagueName(rawLeague || "Battle Frontier (Spectral)");
  const safeRoster = (roster6 || []).slice(0, 6);
  if (safeRoster.length === 0 || slotIndex < 0 || slotIndex >= safeRoster.length) return [];

  const currentMember = safeRoster[slotIndex];
  const otherMembers = safeRoster.filter((_, idx) => idx !== slotIndex);
  const otherBaseSpecies = new Set(
    otherMembers.map((m) => getTypesAndWeaknessesForSpecies(m.name, normLeague).baseSpecies)
  );
  const otherHasMega = otherMembers.some((m) => isMegaOrPrimalSpecies(m.name));

  const usageWeightPct = getShow6UsageAndCoreWeightPct();
  const wUsage = usageWeightPct / 100;
  const fusedThreats = getShow6WeightedMetaList(normLeague, usageWeightPct, 28);
  const usagePctMap = new Map<string, number>();
  for (const ft of fusedThreats) {
    usagePctMap.set(ft.name.toLowerCase(), ft.usagePct);
    usagePctMap.set(ft.name.replace(/^Shadow\s+/i, "").trim().toLowerCase(), ft.usagePct);
  }

  const scoreMemberAgainstThreats = (m: TeamMember) => {
    const byThreat = new Map<string, number>();
    let wSum = 0;
    let totalW = 0;
    for (const t of fusedThreats) {
      const pw = evaluatePositionWeightedBr(m, t.name, normLeague);
      const avg = Math.round(0.36 * pw.leadBr + 0.34 * pw.swapBr + 0.30 * pw.closerBr);
      byThreat.set(t.name, avg);
      wSum += t.weight * avg;
      totalW += t.weight;
    }
    return {
      overallBr: totalW > 0 ? Math.round(wSum / totalW) : 500,
      byThreat
    };
  };

  const currentEval = scoreMemberAgainstThreats(currentMember);
  const otherEvals = otherMembers.map((m) => scoreMemberAgainstThreats(m));

  const computeRosterCoverage = (slotEval: { byThreat: Map<string, number> }) => {
    const all6 = [...otherEvals, slotEval];
    let covered = 0;
    for (const t of fusedThreats) {
      const brs = all6.map((e) => e.byThreat.get(t.name) ?? 500).sort((a, b) => b - a);
      if ((brs[0] ?? 500) >= 520 && (brs[1] ?? 500) >= 500) covered++;
    }
    return Math.min(99, Math.max(50, Math.round((covered / Math.max(1, fusedThreats.length)) * 100)));
  };

  const baselineCoveragePct = computeRosterCoverage(currentEval);
  const candidatePool = getTop100MetaCandidatesForLeague(normLeague, 90);
  for (const f of fusedThreats) {
    const rec = getRecommendedMovesForPokemon(f.name, normLeague);
    if (rec && !candidatePool.some((c) => c.name.toLowerCase() === rec.name.toLowerCase())) {
      candidatePool.push({
        id: `s6-up-cand-${candidatePool.length + 1}`,
        name: rec.name,
        cp: rec.cp,
        fastMove: rec.fastMove,
        chargedMove1: rec.chargedMove1,
        chargedMove2: rec.chargedMove2,
        ivs: rec.defaultIvs
      });
    }
  }

  const scored: Array<Show6SlotUpgradeSuggestion & { sortScore: number; baseSpecies: string }> = [];

  for (const cand of candidatePool) {
    if (cand.name.toLowerCase() === currentMember.name.toLowerCase()) continue;
    const candInfo = getTypesAndWeaknessesForSpecies(cand.name, normLeague);
    if (otherBaseSpecies.has(candInfo.baseSpecies)) continue;
    if (otherHasMega && isMegaOrPrimalSpecies(cand.name)) continue;

    const candEval = scoreMemberAgainstThreats(cand);
    const newSlotBr = candEval.overallBr;
    const deltaSlotBr = newSlotBr - currentEval.overallBr;
    const newRosterCoveragePct = computeRosterCoverage(candEval);
    const deltaCoveragePct = newRosterCoveragePct - baselineCoveragePct;
    const candUsagePct =
      usagePctMap.get(cand.name.toLowerCase()) ??
      usagePctMap.get(cand.name.replace(/^Shadow\s+/i, "").trim().toLowerCase()) ??
      0;

    const corePartners: string[] = [];
    let coreBonus = 0;
    for (const om of otherMembers) {
      const coreMatch = findShow6CommonCoreEntry(normLeague, om.name, cand.name);
      if (coreMatch) {
        corePartners.push(`${om.name} (${coreMatch.usagePct.toFixed(1)}%)`);
        coreBonus += (12 + coreMatch.usagePct * 0.55) * (0.4 + 0.6 * wUsage);
      }
    }

    const sortScore = deltaSlotBr * 0.65 + deltaCoveragePct * 2.4 + coreBonus;
    const fmtDeltaBr = deltaSlotBr >= 0 ? `+${deltaSlotBr}` : `${deltaSlotBr}`;
    const fmtDeltaCov = deltaCoveragePct >= 0 ? `+${deltaCoveragePct}%` : `${deltaCoveragePct}%`;
    const synergyNote =
      corePartners.length > 0
        ? `🔥 Forms Most-Used Core w/ ${corePartners.slice(0, 2).join(", ")}`
        : deltaCoveragePct > 0
        ? `Boosts 6-mon multi-counter field coverage by ${fmtDeltaCov}`
        : `Higher individual meta rating (${newSlotBr} BR)`;

    const resolvedCandidate: TeamMember = {
      ...cand,
      id: currentMember.id || `s6-slot-${slotIndex + 1}`
    };

    scored.push({
      slotIndex,
      candidate: resolvedCandidate,
      replacement: resolvedCandidate,
      newSlotBr,
      newBr: newSlotBr,
      deltaSlotBr,
      deltaBr: deltaSlotBr,
      usagePct: candUsagePct,
      newRosterCoveragePct,
      deltaCoveragePct,
      corePartnersInRoster: corePartners,
      synergyNote,
      synergyReason: synergyNote,
      summaryBadge: `BR ${newSlotBr} (${fmtDeltaBr}) • Cov ${newRosterCoveragePct}% (${fmtDeltaCov})`,
      sortScore,
      baseSpecies: candInfo.baseSpecies
    });
  }

  scored.sort((a, b) => b.sortScore - a.sortScore);
  const picked: Show6SlotUpgradeSuggestion[] = [];
  const seenBases = new Set<string>();
  for (const item of scored) {
    if (seenBases.has(item.baseSpecies)) continue;
    seenBases.add(item.baseSpecies);
    picked.push(item);
    if (picked.length >= maxSuggestions) break;
  }
  return picked;
}

/**
 * Pick-6 Team Editor — Alternate Moveset Optimizer per Slot:
 * Simulates legal Fast + Charged move combinations for a Pokémon in a Show 6 roster
 * against the fused Show 6 Meta Threat distribution and returns the top moveset options.
 */
export interface Show6MovesetSuggestion {
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  blendedBr: number;
  projectedBr: number;
  deltaBr: number;
  leadBr: number;
  swapBr: number;
  closerBr: number;
  isCurrent: boolean;
  isStandard: boolean;
  badgeText: string;
  reason: string;
}

export function recommendShow6RosterSlotMovesets(
  memberOrRoster: TeamMember | TeamMember[],
  leagueOrSlotIndex: string | number,
  slotIndexOrLeague?: number | string,
  maxSuggestionsArg: number = 4
): Show6MovesetSuggestion[] {
  const member: TeamMember | undefined = Array.isArray(memberOrRoster)
    ? memberOrRoster[typeof leagueOrSlotIndex === "number" ? leagueOrSlotIndex : 0]
    : memberOrRoster;
  const rawLeague =
    typeof leagueOrSlotIndex === "string"
      ? leagueOrSlotIndex
      : typeof slotIndexOrLeague === "string"
      ? slotIndexOrLeague
      : "Battle Frontier (Spectral)";
  const maxSuggestions =
    typeof slotIndexOrLeague === "number" ? slotIndexOrLeague : maxSuggestionsArg;
  const normLeague = normalizeLeagueName(rawLeague || "Battle Frontier (Spectral)");
  if (!member || !member.name) return [];

  const rec = getRecommendedMovesForPokemon(member.name, normLeague, member.ivs);
  const stdFast = rec?.fastMove || member.fastMove;
  const stdC1 = rec?.chargedMove1 || member.chargedMove1;
  const stdC2 = rec?.chargedMove2 || member.chargedMove2;

  const pool = getAvailableMovePoolForPokemon(member.name, normLeague);
  const fastPool = pool.fastMoves
    .map((f) => f.name.trim())
    .filter((f) => f && f.toLowerCase() !== "struggle")
    .slice(0, 3);
  if (!fastPool.some((f) => f.toLowerCase() === stdFast.toLowerCase())) fastPool.unshift(stdFast);
  if (member.fastMove && !fastPool.some((f) => f.toLowerCase() === member.fastMove.toLowerCase())) {
    fastPool.push(member.fastMove);
  }

  const chargedPool = pool.chargedMoves
    .map((c) => c.name.trim())
    .filter((c) => c && c.toLowerCase() !== "struggle" && c.toLowerCase() !== "frustration")
    .slice(0, 5);
  for (const m of [stdC1, stdC2, member.chargedMove1, member.chargedMove2]) {
    if (m && !chargedPool.some((c) => c.toLowerCase() === m.toLowerCase())) chargedPool.push(m);
  }

  const typeInfo = getTypesAndWeaknessesForSpecies(member.name, normLeague);
  const rawPairs: Array<[string, string]> = [];
  if (chargedPool.length <= 1) {
    const single = chargedPool[0] || stdC1;
    rawPairs.push([single, single]);
  } else {
    for (let i = 0; i < chargedPool.length; i++) {
      for (let j = i + 1; j < chargedPool.length; j++) {
        rawPairs.push([chargedPool[i], chargedPool[j]]);
      }
    }
  }
  const nonDom = rawPairs.filter(([c1, c2]) => !isDominatedSameTypeChargedPair(c1, c2, typeInfo.types));
  const chargedPairs = nonDom.length > 0 ? nonDom : rawPairs;

  const fusedThreats = getShow6WeightedMetaList(normLeague, getShow6UsageAndCoreWeightPct(), 24);
  const evalMoveset = (fMove: string, c1: string, c2: string) => {
    const cand: TeamMember = {
      ...member,
      fastMove: fMove,
      chargedMove1: c1,
      chargedMove2: c2
    };
    let lSum = 0;
    let sSum = 0;
    let cSum = 0;
    let wTotal = 0;
    for (const t of fusedThreats) {
      const pw = evaluatePositionWeightedBr(cand, t.name, normLeague);
      lSum += t.weight * pw.leadBr;
      sSum += t.weight * pw.swapBr;
      cSum += t.weight * pw.closerBr;
      wTotal += t.weight;
    }
    const norm = wTotal > 0 ? wTotal : 1;
    const leadBr = Math.round(lSum / norm);
    const swapBr = Math.round(sSum / norm);
    const closerBr = Math.round(cSum / norm);
    const blendedBr = Math.round(0.36 * leadBr + 0.34 * swapBr + 0.30 * closerBr);
    return { leadBr, swapBr, closerBr, blendedBr };
  };

  const curMetrics = evalMoveset(member.fastMove, member.chargedMove1, member.chargedMove2);
  const curKey = `${member.fastMove.toLowerCase()}|${[member.chargedMove1.toLowerCase(), member.chargedMove2.toLowerCase()].sort().join("+")}`;
  const stdKey = `${stdFast.toLowerCase()}|${[stdC1.toLowerCase(), stdC2.toLowerCase()].sort().join("+")}`;

  const results: Show6MovesetSuggestion[] = [];
  const seenKeys = new Set<string>();

  for (const fMove of fastPool) {
    for (const [c1, c2] of chargedPairs) {
      const key = `${fMove.toLowerCase()}|${[c1.toLowerCase(), c2.toLowerCase()].sort().join("+")}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const m = evalMoveset(fMove, c1, c2);
      const isCurrent = key === curKey;
      const isStandard = key === stdKey;
      const deltaBr = m.blendedBr - curMetrics.blendedBr;
      const fmtDelta = deltaBr >= 0 ? `+${deltaBr}` : `${deltaBr}`;
      const badgeText = `${m.blendedBr} BR (${fmtDelta}) • L:${m.leadBr}/S:${m.swapBr}/C:${m.closerBr}`;
      results.push({
        fastMove: fMove,
        chargedMove1: c1,
        chargedMove2: c2,
        blendedBr: m.blendedBr,
        projectedBr: m.blendedBr,
        deltaBr,
        leadBr: m.leadBr,
        swapBr: m.swapBr,
        closerBr: m.closerBr,
        isCurrent,
        isStandard,
        badgeText,
        reason: `L:${m.leadBr} / S:${m.swapBr} / C:${m.closerBr}`
      });
    }
  }

  results.sort((a, b) => b.blendedBr - a.blendedBr);
  return results.slice(0, maxSuggestions);
}

export type DefaultShow6RosterResult = string[] & { my6: string[]; opp6: string[] };

export function getDefaultShow6RosterNames(
  league: string = "Battle Frontier (Spectral)",
  isOpponent: boolean = false
): DefaultShow6RosterResult {
  const normLeague = normalizeLeagueName(league || "Battle Frontier (Spectral)");
  const topPool = getLeagueTopMetaSpeciesNames(normLeague, 20);
  const pick6SingleMega = (startIndices: number[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    let hasMega = false;
    for (const idx of startIndices) {
      const cand = topPool[idx];
      if (!cand) continue;
      const low = cand.toLowerCase();
      if (seen.has(low)) continue;
      if (isMegaOrPrimalSpecies(cand)) {
        if (hasMega) continue;
        hasMega = true;
      }
      seen.add(low);
      out.push(cand);
      if (out.length >= 6) break;
    }
    for (const cand of topPool) {
      if (out.length >= 6) break;
      const low = cand.toLowerCase();
      if (seen.has(low)) continue;
      if (isMegaOrPrimalSpecies(cand)) {
        if (hasMega) continue;
        hasMega = true;
      }
      seen.add(low);
      out.push(cand);
    }
    return out;
  };
  const my6 = pick6SingleMega([0, 1, 2, 3, 4, 5, 6, 7]);
  const opp6 = pick6SingleMega([1, 3, 4, 6, 7, 9, 2, 5, 8, 10]);
  const primaryList = isOpponent ? [...opp6] : [...my6];
  return Object.assign(primaryList, { my6, opp6 });
}

/**
 * Rescales an array of TeamMember (3 or 6 slots) when changing league format,
 * updating CP and default IVs while keeping valid custom moves or recommended moves.
 */
export function rescaleTeamMembersForLeague(
  members: TeamMember[],
  targetLeague: string
): TeamMember[] {
  const normLeague = normalizeLeagueName(targetLeague || "GREAT LEAGUE");
  const cap = getLeagueCpCap(normLeague);
  const defaultCp = cap === 500 ? 500 : cap === 2500 ? 2500 : cap === 10000 ? 4200 : 1500;

  return (members || []).map((m, idx) => {
    const rec = getRecommendedMovesForPokemon(m.name, normLeague);
    if (!rec) {
      return {
        ...m,
        id: m.id || `p${idx + 1}`,
        cp: defaultCp
      };
    }
    return {
      ...m,
      id: m.id || `p${idx + 1}`,
      name: rec.name || m.name,
      cp: rec.cp || defaultCp,
      fastMove: m.fastMove?.trim() || rec.fastMove,
      chargedMove1: m.chargedMove1?.trim() || rec.chargedMove1,
      chargedMove2: m.chargedMove2?.trim() || rec.chargedMove2,
      ivs: rec.defaultIvs || m.ivs
    };
  });
}

/**
 * Computes the Most Likely 6-Pokémon Meta Opponent Roster for a given Show 6 format
 * by combining the highest-usage Battle Frontier Common Cores with the highest-weighted
 * tournament usage + PvPoke meta species (strictly enforcing Species Clause & ≤1 Mega).
 */
export function getMostLikelyMetaOpponent6ForFormat(
  league: string = "Battle Frontier (Spectral)"
): MostLikelyFormatOpponent6Info {
  const normLeague = normalizeLeagueName(league || "Battle Frontier (Spectral)");
  const shortLabel =
    normLeague === "Battle Frontier (Spectral)"
      ? "BF Spectral (1500)"
      : normLeague === "Battle Frontier (Cauldron)"
      ? "BF Cauldron (2500)"
      : normLeague === "Battle Frontier (Master)"
      ? "BF Master (Uncapped)"
      : normLeague === "GREAT LEAGUE"
      ? "Open GL (1500)"
      : normLeague;

  const cores = getShow6CoresForLeague(normLeague);
  const weightedMeta = getShow6WeightedMetaList(normLeague, getShow6UsageAndCoreWeightPct(), 45);
  const usageMap = new Map<string, number>();
  for (const wm of weightedMeta) {
    usageMap.set(wm.name.replace(/^Shadow\s+/i, "").trim().toLowerCase(), wm.usagePct);
    usageMap.set(wm.name.toLowerCase(), wm.usagePct);
  }

  const pickedNames: string[] = [];
  const usedBaseSpecies = new Set<string>();
  let hasMega = false;

  const tryAddSpecies = (rawName: string): boolean => {
    if (pickedNames.length >= 6) return false;
    const canon = canonicalizeMetaPokemonName(rawName);
    if (!canon) return false;
    const rec = getRecommendedMovesForPokemon(canon, normLeague);
    const resolvedName = rec?.name || canon;
    const baseKey = getTypesAndWeaknessesForSpecies(resolvedName, normLeague).baseSpecies;
    if (usedBaseSpecies.has(baseKey)) return false;
    const isMega = isMegaOrPrimalSpecies(resolvedName);
    if (isMega && hasMega) return false;
    usedBaseSpecies.add(baseKey);
    if (isMega) hasMega = true;
    pickedNames.push(resolvedName);
    return true;
  };

  // Step 1: Seed from top 2 non-overlapping Most-Used Cores in this format
  const featuredCores: string[] = [];
  for (const core of cores) {
    if (pickedNames.length >= 4) break;
    const cA = canonicalizeMetaPokemonName(core.monA);
    const cB = canonicalizeMetaPokemonName(core.monB);
    const baseA = getTypesAndWeaknessesForSpecies(cA, normLeague).baseSpecies;
    const baseB = getTypesAndWeaknessesForSpecies(cB, normLeague).baseSpecies;
    if (baseA === baseB) continue;
    const aAlready = usedBaseSpecies.has(baseA);
    const bAlready = usedBaseSpecies.has(baseB);
    if (!aAlready && !bAlready && pickedNames.length <= 4) {
      const addedA = tryAddSpecies(cA);
      const addedB = tryAddSpecies(cB);
      if (addedA && addedB) {
        featuredCores.push(`${core.monA} + ${core.monB} (${core.usagePct.toFixed(1)}%)`);
      }
    }
  }

  // Step 2: Fill remaining slots up to 6 from highest-weighted meta species (prioritizing core partners)
  for (const wm of weightedMeta) {
    if (pickedNames.length >= 6) break;
    tryAddSpecies(wm.name);
  }

  // Fallback if still < 6
  if (pickedNames.length < 6) {
    const fallback = getDefaultShow6RosterNames(normLeague, true);
    for (const fb of fallback) {
      if (pickedNames.length >= 6) break;
      tryAddSpecies(fb);
    }
  }

  // Check all cores present in the final 6
  for (let i = 0; i < pickedNames.length; i++) {
    for (let j = i + 1; j < pickedNames.length; j++) {
      const c = findShow6CommonCoreEntry(normLeague, pickedNames[i], pickedNames[j]);
      if (c) {
        const label = `${c.monA} + ${c.monB} (${c.usagePct.toFixed(1)}%)`;
        if (!featuredCores.includes(label) && featuredCores.length < 3) {
          featuredCores.push(label);
        }
      }
    }
  }

  const members: TeamMember[] = pickedNames.slice(0, 6).map((name, idx) => {
    const rec = getRecommendedMovesForPokemon(name, normLeague);
    return {
      id: `meta-opp6-${idx + 1}`,
      name: rec?.name || name,
      cp: rec?.cp || (normLeague === "Battle Frontier (Cauldron)" ? 2500 : normLeague === "Battle Frontier (Master)" ? 4200 : 1500),
      fastMove: rec?.fastMove || "Tackle",
      chargedMove1: rec?.chargedMove1 || "Body Slam",
      chargedMove2: rec?.chargedMove2 || "Surf",
      ivs: rec?.defaultIvs
    };
  });

  const usageSum = pickedNames.reduce((acc, n) => {
    const u = usageMap.get(n.toLowerCase()) ?? usageMap.get(n.replace(/^Shadow\s+/i, "").trim().toLowerCase()) ?? 12;
    return acc + u;
  }, 0);
  const avgUsagePct = Number((usageSum / Math.max(1, pickedNames.length)).toFixed(1));

  return {
    league: normLeague,
    shortLabel,
    pokemonNames: pickedNames.slice(0, 6),
    members,
    featuredCores,
    avgUsagePct,
    summaryLabel: `${shortLabel}: ${pickedNames.slice(0, 6).join(" / ")}`
  };
}

export function getAllFormatsMostLikelyMetaOpponent6(): MostLikelyFormatOpponent6Info[] {
  const formats: LeagueType[] = getEnabledShow6Leagues();
  return formats.map((lg) => getMostLikelyMetaOpponent6ForFormat(lg));
}

export const INITIAL_SHOW6_ROSTERS_OF_6: Show6RosterOf6Preset[] = [
  {
    id: "show6-roster6-spectral-1",
    name: "Spectral Frontier 6: Golisopod / G-Weezing / Cofagrigus / Arctibax / Charjabug / Glalie",
    league: "BATTLE FRONTIER (SPECTRAL)",
    isSelected: true,
    pokemon: getDefaultShow6RosterNames("BATTLE FRONTIER (SPECTRAL)", false).map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (SPECTRAL)");
      return {
        id: `s6-spec-m-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 1500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  },
  {
    id: "show6-roster6-cauldron-1",
    name: "Cauldron Frontier 6: Greedent / A-Muk / Ursaluna / G-Weezing / Jellicent / Talonflame",
    league: "BATTLE FRONTIER (CAULDRON)",
    isSelected: false,
    pokemon: getDefaultShow6RosterNames("BATTLE FRONTIER (CAULDRON)", false).map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (CAULDRON)");
      return {
        id: `s6-caul-m-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 2500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  },
  {
    id: "show6-roster6-bfmaster-1",
    name: "BF Master 6: Zamazenta-C / Ursaluna / Dialga-O / Zacian-C / Reshiram / Blastoise (Mega)",
    league: "BATTLE FRONTIER (MASTER)",
    isSelected: false,
    pokemon: [
      "Zamazenta (Crowned)",
      "Ursaluna",
      "Dialga (Origin)",
      "Zacian (Crowned)",
      "Reshiram",
      "Blastoise (Mega)"
    ].map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (MASTER)");
      return {
        id: `s6-bfm-m-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 4500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  }
];

export const INITIAL_SHOW6_OPPONENT_ROSTERS_OF_6: Show6RosterOf6Preset[] = [
  {
    id: "show6-opp-roster6-spectral-1",
    name: "Opp Spectral Core 6: G-Weezing / Golisopod / Cofagrigus / Glalie / Hypno / Tentacruel",
    league: "BATTLE FRONTIER (SPECTRAL)",
    isSelected: true,
    pokemon: [
      "Weezing (Galarian)",
      "Golisopod",
      "Cofagrigus",
      "Glalie",
      "Hypno",
      "Tentacruel"
    ].map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (SPECTRAL)");
      return {
        id: `s6-opp-spec-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 1500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  },
  {
    id: "show6-opp-roster6-cauldron-1",
    name: "Opp Cauldron Core 6: A-Muk / Greedent / Ursaluna / G-Weezing / Jellicent / Greninja",
    league: "BATTLE FRONTIER (CAULDRON)",
    isSelected: false,
    pokemon: [
      "Muk (Alolan)",
      "Greedent",
      "Ursaluna",
      "Weezing (Galarian)",
      "Jellicent",
      "Greninja"
    ].map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (CAULDRON)");
      return {
        id: `s6-opp-caul-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 2500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  },
  {
    id: "show6-opp-roster6-bfmaster-1",
    name: "Opp BF Master Core 6: Keldeo-R / Dialga-O / Landorus-T / Florges / Zamazenta-C / Scizor (Mega)",
    league: "BATTLE FRONTIER (MASTER)",
    isSelected: false,
    pokemon: [
      "Keldeo (Resolute)",
      "Dialga (Origin)",
      "Landorus (Therian)",
      "Florges",
      "Zamazenta (Crowned)",
      "Scizor (Mega)"
    ].map((name, i) => {
      const rec = getRecommendedMovesForPokemon(name, "BATTLE FRONTIER (MASTER)");
      return {
        id: `s6-opp-bfm-${i + 1}`,
        name: rec?.name || name,
        cp: rec?.cp || 4500,
        fastMove: rec?.fastMove || "Fast",
        chargedMove1: rec?.chargedMove1 || "Body Slam",
        chargedMove2: rec?.chargedMove2 || "Surf",
        ivs: rec?.defaultIvs
      };
    })
  }
];

export const INITIAL_SHOW6_PRESETS_OF_3: TeamPreset[] = recalculateAllPresetsMetrics([
  {
    id: "show6-preset3-spectral-1",
    name: "[BF Spectral] Golisopod / Weezing (Galarian) / Cofagrigus",
    league: "BATTLE FRONTIER (SPECTRAL)",
    combatMode: "show6",
    isSelected: true,
    pokemon: getLeagueTop3Template("BATTLE FRONTIER (SPECTRAL)")
  },
  {
    id: "show6-preset3-cauldron-1",
    name: "[BF Cauldron] Greedent / Muk (Alolan) / Ursaluna",
    league: "BATTLE FRONTIER (CAULDRON)",
    combatMode: "show6",
    isSelected: false,
    pokemon: getLeagueTop3Template("BATTLE FRONTIER (CAULDRON)")
  },
  {
    id: "show6-preset3-bfmaster-1",
    name: "[BF Master] Zamazenta (Crowned) / Ursaluna / Dialga (Origin)",
    league: "BATTLE FRONTIER (MASTER)",
    combatMode: "show6",
    isSelected: false,
    pokemon: getLeagueTop3Template("BATTLE FRONTIER (MASTER)")
  }
]);

/**
 * Fetches and syncs PvPoke Limited Meta rankings JSON (`rankings-{cp}.json`) for one or more LimitedMetaFormat entries,
 * storing the parsed rankings into `LIVE_RANKINGS_MAP[meta.label]`, `LIVE_RANKINGS_LIST[meta.label]`, and `localStorage`.
 */
export async function syncLimitedMetaRankings(
  formatsToSync?: LimitedMetaFormat[] | string
): Promise<number> {
  const catalog = getLimitedMetaCatalog();
  const pinnedSet = new Set([
    ...getForcedShow6Leagues().map((s) => s.toLowerCase()),
    ...getPinnedGblLimitedMetas().map((s) => s.toLowerCase()),
    ...getPinnedShow6LimitedMetas().map((s) => s.toLowerCase())
  ]);
  const targets: LimitedMetaFormat[] =
    typeof formatsToSync === "string"
      ? catalog.filter(
          (m) =>
            m.label.toLowerCase() === formatsToSync.toLowerCase() ||
            m.id.toLowerCase() === formatsToSync.toLowerCase()
        )
      : Array.isArray(formatsToSync) && formatsToSync.length > 0
      ? formatsToSync
      : catalog.filter((m) => pinnedSet.has(m.label.toLowerCase()));

  const entriesByFormat: Record<string, number> = {};
  let cachedObj: Record<string, PokemonRankingEntry[]> = {};
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LIMITED_META_RANKINGS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") cachedObj = parsed;
      }
    }
  } catch {
    // ignore
  }

  await Promise.all(
    targets.map(async (fmt) => {
      try {
        const res = await fetch(fmt.rankingsUrl);
        if (!res.ok) return;
        const json = await res.json();
        const parsed = parseRankingsJsonArray(json);
        if (parsed.length > 0) {
          if (!LIVE_RANKINGS_MAP[fmt.label]) {
            LIVE_RANKINGS_MAP[fmt.label] = new Map();
          }
          const map = LIVE_RANKINGS_MAP[fmt.label];
          map.clear();
          parsed.forEach((entry) => map.set(entry.speciesId.toLowerCase(), entry));
          LIVE_RANKINGS_MAP[fmt.label.toUpperCase()] = map;
          (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)[fmt.label] = parsed;
          if (fmt.label === "Mega Master League (10000)") {
            LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"] = map;
            (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["MEGA MASTER LEAGUE"] = parsed;
          }
          cachedObj[fmt.label] = parsed.slice(0, 220);
          entriesByFormat[fmt.label] = parsed.length;
          fmt.verifiedRankingsCount = parsed.length;
          fmt.allowMegas = parsed.some((e) => isMegaOrPrimalSpecies(e.speciesId));
        }
      } catch {
        // ignore network errors
      }
    })
  );

  try {
    if (typeof localStorage !== "undefined" && Object.keys(cachedObj).length > 0) {
      localStorage.setItem(LIMITED_META_RANKINGS_CACHE_KEY, JSON.stringify(cachedObj));
    }
  } catch {
    // ignore quota errors
  }

  if (typeof formatsToSync === "string") {
    return entriesByFormat[formatsToSync] || Object.values(entriesByFormat)[0] || 0;
  }
  return Object.keys(entriesByFormat).length;
}

/**
 * Discovers Current, Upcoming, and Recent Limited Metas directly from the PvPoke GitHub repository:
 * 1. Fetches compiled `src/data/gamemaster.json` (`formats` and `cups` arrays) to match the live pvpoke.com dropdown
 * 2. Checks recently updated branches & commit dates for `UPCOMING` and `RECENT` metas
 * 3. Verifies `src/data/rankings/{cup}/overall/rankings-{cp}.json` exists and dynamically detects `allowMegas` from ranked species
 * 4. Enforces the 4-week (`lastSeenAt`) expiration rule (retaining expired RECENT formats only while pinned).
 */
export async function fetchPvPokeLimitedMetasFromGitHub(): Promise<{
  catalog: LimitedMetaFormat[];
  formats: LimitedMetaFormat[];
  currentCount: number;
  upcomingCount: number;
  recentCount: number;
  summary: string;
  statusMessage: string;
}> {
  const nowMs = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const excludedBaseCups = new Set(["overall", "classic", "premierclassic", "custom"]);

  const pinnedLower = new Set([
    ...getForcedShow6Leagues().map((s) => s.toLowerCase()),
    ...getPinnedGblLimitedMetas().map((s) => s.toLowerCase()),
    ...getPinnedShow6LimitedMetas().map((s) => s.toLowerCase())
  ]);

  const previousByLabel = new Map<string, LimitedMetaFormat>();
  for (const d of DEFAULT_LIMITED_META_CATALOG) {
    previousByLabel.set(d.label, { ...d });
  }
  for (const existing of DYNAMIC_LIMITED_META_CATALOG) {
    previousByLabel.set(existing.label, { ...existing });
  }

  // Demote previous CURRENT entries to RECENT (preserving lastSeenAt) until re-confirmed in live gamemaster.json["formats"]
  const discoveredByLabel = new Map<string, LimitedMetaFormat>();
  for (const [lbl, prev] of previousByLabel.entries()) {
    const isStandardOpen = prev.cup === "all";
    const isCurrentBF = isCurrentBattleFrontierCup(prev.title || prev.label, prev.cup);
    const nextStatus: LimitedMetaLifecycleStatus =
      isStandardOpen || isCurrentBF || prev.cup === "mega"
        ? "CURRENT"
        : prev.status === "CURRENT"
        ? "RECENT"
        : prev.status;
    discoveredByLabel.set(lbl, {
      ...prev,
      status: nextStatus,
      lifecycle: nextStatus
    });
  }

  const fetchCupLastCommitMs = async (cupSlug: string): Promise<number | null> => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/pvpoke/pvpoke/commits?path=src/data/rankings/${cupSlug}&per_page=1`
      );
      if (!res.ok) return null;
      const arr = await res.json();
      if (Array.isArray(arr) && arr.length > 0) {
        const dateStr = arr[0]?.commit?.committer?.date;
        if (typeof dateStr === "string") {
          const parsedMs = Date.parse(dateStr);
          if (!Number.isNaN(parsedMs)) return parsedMs;
        }
      }
    } catch {
      // ignore
    }
    return null;
  };

  try {
    const gmRes = await fetch(PVPOKE_ENDPOINTS.GAMEMASTER)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

    const candidateList: Array<{
      cup: string;
      cp: 500 | 1500 | 2500 | 10000;
      title: string;
      status: LimitedMetaLifecycleStatus;
      isShow6Native?: boolean;
      lastSeenAt: number;
      rankingsUrl?: string;
    }> = [];

    const liveCupCpSet = new Set<string>();

    if (gmRes && typeof gmRes === "object") {
      const formatsArr = Array.isArray((gmRes as Record<string, unknown>).formats)
        ? ((gmRes as Record<string, unknown>).formats as Array<Record<string, unknown>>)
        : [];
      for (const f of formatsArr) {
        if (!f || f.hideRankings === true) continue;
        const cup = typeof f.cup === "string" ? f.cup.trim().toLowerCase() : "";
        const cpRaw = Number(f.cp) || 1500;
        const cp: 500 | 1500 | 2500 | 10000 =
          cpRaw <= 500 ? 500 : cpRaw <= 1500 ? 1500 : cpRaw <= 2500 ? 2500 : 10000;
        if (!cup || excludedBaseCups.has(cup)) continue;
        if (cup === "all") continue;

        const rawTitle =
          typeof f.title === "string" && f.title.trim()
            ? f.title.trim()
            : `${cup.charAt(0).toUpperCase() + cup.slice(1)} Cup`;
        const isBF = isBattleFrontierCupTitle(rawTitle, cup);
        const title = isBF
          ? rawTitle.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase()
          : toPvPokeTitleCase(rawTitle);

        liveCupCpSet.add(`${cup}_${cp}`);
        const status: LimitedMetaLifecycleStatus = f.showFormat === false ? "UPCOMING" : "CURRENT";
        candidateList.push({
          cup,
          cp,
          title,
          status,
          isShow6Native:
            isBF ||
            title.toLowerCase().includes("championship") ||
            title.toLowerCase().includes("devon") ||
            title.toLowerCase().includes("gymbreakers") ||
            cup.includes("frontier"),
          lastSeenAt: nowMs
        });
      }

      const cupsArr = Array.isArray((gmRes as Record<string, unknown>).cups)
        ? ((gmRes as Record<string, unknown>).cups as Array<Record<string, unknown>>)
        : [];
      for (const cObj of cupsArr) {
        if (!cObj) continue;
        const cup = typeof cObj.name === "string" ? cObj.name.trim().toLowerCase() : "";
        const rawTitle = typeof cObj.title === "string" ? cObj.title.trim() : "";
        const cpRaw = Number(cObj.league) || 1500;
        const cp: 500 | 1500 | 2500 | 10000 =
          cpRaw <= 500 ? 500 : cpRaw <= 1500 ? 1500 : cpRaw <= 2500 ? 2500 : 10000;
        if (!cup || !rawTitle || excludedBaseCups.has(cup) || cup === "all") continue;
        if (liveCupCpSet.has(`${cup}_${cp}`)) continue;

        const isBF = isBattleFrontierCupTitle(rawTitle, cup);
        const isCurrentBF = isCurrentBattleFrontierCup(rawTitle, cup);
        const cleanTitle = isBF
          ? rawTitle.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase()
          : toPvPokeTitleCase(rawTitle);
        const label = isBF ? cleanTitle : `${cleanTitle} (${cp})`;
        const prev = previousByLabel.get(label);
        const commitMs = (await fetchCupLastCommitMs(cup)) ?? prev?.lastSeenAt ?? nowMs - 21 * 86400_000;
        const ageMs = nowMs - commitMs;
        const isPinned = pinnedLower.has(label.toLowerCase()) || isCurrentBF;
        if (ageMs > FOUR_WEEKS_MS && !isPinned) continue;

        const status: LimitedMetaLifecycleStatus =
          isCurrentBF ? "CURRENT" : ageMs <= sevenDaysMs && !prev ? "UPCOMING" : "RECENT";
        candidateList.push({
          cup,
          cp,
          title: cleanTitle,
          status,
          isShow6Native: isBF || prev?.isShow6Native,
          lastSeenAt: commitMs
        });
      }
    }

    await Promise.all(
      candidateList.slice(0, 32).map(async (cand) => {
        const isBF = isBattleFrontierCupTitle(cand.title, cand.cup);
        const cleanTitle = isBF
          ? cand.title.replace(/\s*\(\d+\)\s*$/, "").trim().toUpperCase()
          : toPvPokeTitleCase(cand.title);
        const label = isBF ? cleanTitle : `${cleanTitle} (${cand.cp})`;
        const rankingsUrl =
          cand.rankingsUrl ||
          `https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/${cand.cup}/overall/rankings-${cand.cp}.json`;
        try {
          const res = await fetch(rankingsUrl);
          if (!res.ok) return;
          const arr = await res.json();
          if (!Array.isArray(arr) || arr.length === 0) return;

          const parsed = parseRankingsJsonArray(arr);
          const detectedMega = parsed.some((e) => isMegaOrPrimalSpecies(e.speciesId));
          const fmt: LimitedMetaFormat = {
            id: label,
            label,
            cup: cand.cup,
            cupKey: cand.cup,
            cp: cand.cp,
            title: cleanTitle,
            status: cand.status,
            lifecycle: cand.status,
            rankingsUrl,
            isShow6Native: isBF || cand.isShow6Native,
            allowMegas: detectedMega,
            verifiedRankingsCount: arr.length,
            lastSeenAt: cand.lastSeenAt
          };
          discoveredByLabel.set(label, fmt);

          if ((isBF || pinnedLower.has(label.toLowerCase())) && parsed.length > 0) {
            if (!LIVE_RANKINGS_MAP[label]) LIVE_RANKINGS_MAP[label] = new Map();
            const map = LIVE_RANKINGS_MAP[label];
            map.clear();
            parsed.forEach((e) => map.set(e.speciesId.toLowerCase(), e));
            LIVE_RANKINGS_MAP[label.toUpperCase()] = map;
            (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)[label] = parsed;
            if (label === "Mega Master League (10000)") {
              LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"] = map;
              (LIVE_RANKINGS_LIST as Record<string, PokemonRankingEntry[]>)["MEGA MASTER LEAGUE"] = parsed;
            }
          }
        } catch {
          // ignore unranked cups
        }
      })
    );
  } catch {
    // fallback to cached / default catalog
  }

  const nextCatalog = Array.from(discoveredByLabel.values()).filter((item) => {
    const isPinned = pinnedLower.has(item.label.toLowerCase()) || pinnedLower.has(item.id.toLowerCase());
    return !isExpiredLimitedMeta(item, nowMs) || isPinned;
  });
  setDynamicLimitedMetaCatalog(nextCatalog);

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LIMITED_META_CATALOG_STORAGE_KEY, JSON.stringify(DYNAMIC_LIMITED_META_CATALOG));
    }
  } catch {
    // ignore
  }

  const sorted = getLimitedMetaCatalog();
  const currentCount = sorted.filter((m) => m.status === "CURRENT").length;
  const upcomingCount = sorted.filter((m) => m.status === "UPCOMING").length;
  const recentCount = sorted.filter((m) => m.status === "RECENT").length;
  const summary = `✅ Synced ${sorted.length} Ranked PvPoke Metas (🟢 ${currentCount} Current • 🔜 ${upcomingCount} Upcoming • 🕒 ${recentCount} Recent ≤4w)`;
  return {
    catalog: sorted,
    formats: sorted,
    currentCount,
    upcomingCount,
    recentCount,
    summary,
    statusMessage: summary
  };
}


