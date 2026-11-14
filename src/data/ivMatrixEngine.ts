import {
  type BuiltPokemonEntry,
  type IvSpreadEvalDetails,
  type TeamMember,
  calculateChargedDamage,
  calculateFastDamage,
  evaluateIvSpreadDetails,
  findPokemonByName,
  getLeagueCpCap,
  getPresetIvSpread,
  getRecommendedMovesForPokemon,
  normalizeLeagueName,
  parseIvTriplet
} from "./pokemonDb";
import {
  DEFAULT_MATCHUP_TIER_THRESHOLDS,
  type MatchupTierThresholds,
  evaluateDiscreteShieldBattleRating,
  resolveCombatPokemonForEngine
} from "./combatSimulator";
import {
  computeBlendedSeasonMeta,
  getTop100MetaCandidatesForLeague
} from "./teamAndMetaEngine";

export type OppMetaPoolMode = "PVPOKE_TOP_100" | "BLENDED_ELO_META";
export type OppIvBaselineMode = "RANK_1" | "PVPOKE_DEFAULT" | "MAX_ATK";
export type EvenShieldScenarioKey = "0v0" | "1v1" | "2v2";
export type ShieldScenarioKey = "0v0" | "1v1" | "2v2" | "1v0" | "0v1" | "2v1" | "1v2";
export type ShieldScopeMode = "REALISTIC_7" | "EVEN_3";
export type FlipCode = "L->W" | "W->L" | "T->W" | "W->T" | "L->T" | "T->L" | "NONE";

export const EVEN_3_SHIELD_KEYS: EvenShieldScenarioKey[] = ["0v0", "1v1", "2v2"];
export const REALISTIC_7_SHIELD_KEYS: ShieldScenarioKey[] = [
  "0v0",
  "1v1",
  "2v2",
  "1v0",
  "0v1",
  "2v1",
  "1v2"
];

export const PINNED_RANK1_CANDIDATE_ID = "__RANK_1_BENCHMARK__";

export interface IvCandidateConfig {
  id: string;
  label: string;
  speciesName: string;
  isShadow: boolean;
  atkIv: number;
  defIv: number;
  staIv: number;
  isBestBuddy: boolean;
  fastMove?: string;
  chargedMove1?: string;
  chargedMove2?: string;
  plusMoveLevel?: number;
  isPinnedRank1?: boolean;
}

export interface IvScenarioFlipDetail {
  scenario: ShieldScenarioKey;
  flipCode: FlipCode;
  beforeBr: number;
  afterBr: number;
  deltaBr: number;
  isGain: boolean;
}

export interface IvScenarioOutlierDetail {
  scenario: ShieldScenarioKey;
  beforeBr: number;
  afterBr: number;
  deltaBr: number;
  beforeTierLabel: string;
  afterTierLabel: string;
  isUpgrade: boolean;
}

export interface IvOpponentBreakdown {
  oppName: string;
  oppIvs: string;
  oppCp: number;
  oppWeight: number;
  br0v0: number;
  br1v1: number;
  br2v2: number;
  baselineBr0v0: number;
  baselineBr1v1: number;
  baselineBr2v2: number;
  rank1Br0v0: number;
  rank1Br1v1: number;
  rank1Br2v2: number;
  flip0v0: FlipCode;
  flip1v1: FlipCode;
  flip2v2: FlipCode;
  brByShield: Record<ShieldScenarioKey, number>;
  baselineBrByShield: Record<ShieldScenarioKey, number>;
  rank1BrByShield: Record<ShieldScenarioKey, number>;
  flipsByShield: Record<ShieldScenarioKey, FlipCode>;
  fastMoveName: string;
  oppFastMoveName: string;
  fastDmgDealt: number;
  baselineFastDmgDealt: number;
  fastBreakpointDelta: number;
  fastDmgTaken: number;
  baselineFastDmgTaken: number;
  fastBulkpointDelta: number;
  survivesExtraChargedCycle: boolean;
  losesExtraChargedCycle: boolean;
  userEffectiveAtk: number;
  baselineUserEffectiveAtk: number;
  oppEffectiveAtk: number;
  cmpStatus: "WIN" | "TIE" | "LOSS";
  baselineCmpStatus: "WIN" | "TIE" | "LOSS";
  cmpFlip: "GAINED" | "LOST" | "NONE";
}

export interface ShieldRecordSummary {
  wins: number;
  losses: number;
  ties: number;
  avgBr: number;
  weightedWinPct: number;
}

export interface IvCandidateLeagueResult {
  candidateId: string;
  label: string;
  speciesName: string;
  displayName: string;
  isShadow: boolean;
  isBestBuddy: boolean;
  isPinnedRank1: boolean;
  atkIv: number;
  defIv: number;
  staIv: number;
  ivs: string;
  cp: number;
  level: number;
  effAtk: number;
  effDef: number;
  effHp: number;
  statProduct: number;
  rank: number;
  pctOfRank1: number;
  league: string;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  records: Record<ShieldScenarioKey, ShieldRecordSummary>;
  deltaVsRank1: {
    br0v0: number;
    br1v1: number;
    br2v2: number;
    wins1v1: number;
    netFlips1v1: number;
  };
  deltaVsBaseline: {
    br0v0: number;
    br1v1: number;
    br2v2: number;
    wins1v1: number;
    netFlips1v1: number;
  };
  breakpointsGainedCount: number;
  breakpointsLostCount: number;
  bulkpointsGainedCount: number;
  bulkpointsLostCount: number;
  cmpFlipsGainedCount: number;
  cmpFlipsLostCount: number;
  extraCycleSurvivedCount: number;
  opponents: IvOpponentBreakdown[];
}

export interface MultiIvLeagueMatrix {
  league: string;
  oppMetaPool: OppMetaPoolMode;
  oppIvBaseline: OppIvBaselineMode;
  opponentCount: number;
  baselineComparisonId: string;
  baselineLabel: string;
  rank1CandidateId: string;
  candidateResults: IvCandidateLeagueResult[];
}

export interface MultiIvMatrixResult {
  leagues: MultiIvLeagueMatrix[];
  computedAtMs: number;
}

export interface RunMultiIvMatrixParams {
  speciesName: string;
  leagues: string[];
  candidates: IvCandidateConfig[];
  oppMetaPool?: OppMetaPoolMode;
  oppIvBaseline?: OppIvBaselineMode;
  baselineComparisonId?: string;
  rank1IsShadow?: boolean;
  seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>;
  currentSeason?: { startMs: number; endMs: number } | number;
  maxOpponents?: number;
}

export function cleanSpeciesNameWithoutShadow(rawName: string): {
  cleanName: string;
  isShadow: boolean;
} {
  const trimmed = (rawName || "").trim();
  const isShadow =
    /^Shadow\s+/i.test(trimmed) || trimmed.toLowerCase().includes("(shadow)");
  const cleanName = trimmed
    .replace(/^Shadow\s+/i, "")
    .replace(/\s*\(Shadow\)/gi, "")
    .trim();
  return { cleanName, isShadow };
}

export function formatSpeciesDisplayName(cleanName: string, isShadow: boolean): string {
  const base = cleanSpeciesNameWithoutShadow(cleanName).cleanName;
  return isShadow ? `Shadow ${base}` : base;
}

/**
 * Finds all saved Built Pokemon entries matching the given species, Shadow state, and league CP cap.
 */
export function findMatchingBuiltPokemon(
  roster: BuiltPokemonEntry[],
  rawSpeciesName: string,
  league: string,
  preferredShadow?: boolean
): BuiltPokemonEntry[] {
  if (!Array.isArray(roster) || roster.length === 0 || !rawSpeciesName.trim()) {
    return [];
  }
  const { cleanName, isShadow: detectedShadow } = cleanSpeciesNameWithoutShadow(rawSpeciesName);
  const targetShadow = preferredShadow ?? detectedShadow;
  const targetCap = getLeagueCpCap(league);
  const dbMatch = findPokemonByName(cleanName);
  const normTarget = (dbMatch?.name || cleanName).toLowerCase();

  return roster
    .filter((entry) => {
      if (!entry || !entry.speciesName) return false;
      if (Boolean(entry.isShadow) !== targetShadow) return false;
      if (getLeagueCpCap(entry.league) !== targetCap) return false;
      const entryClean = cleanSpeciesNameWithoutShadow(entry.speciesName).cleanName.toLowerCase();
      return (
        entryClean === normTarget ||
        entryClean === cleanName.toLowerCase()
      );
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function builtPokemonToTeamMember(
  entry: BuiltPokemonEntry,
  slotId: string = "slot-1"
): TeamMember {
  const displayName = formatSpeciesDisplayName(entry.speciesName, entry.isShadow);
  return {
    id: slotId,
    name: displayName,
    cp: entry.cp,
    fastMove: entry.fastMove,
    chargedMove1: entry.chargedMove1,
    chargedMove2: entry.chargedMove2,
    ivs: entry.ivs || `${entry.atkIv}/${entry.defIv}/${entry.staIv}`,
    plusMoveLevel: entry.plusMoveLevel ?? 4,
    isBestBuddy: Boolean(entry.isBestBuddy),
    builtPokemonId: entry.id
  };
}

export function teamMemberToBuiltPokemon(
  member: TeamMember,
  league: string,
  label?: string,
  existingId?: string
): BuiltPokemonEntry | null {
  const { cleanName, isShadow } = cleanSpeciesNameWithoutShadow(member.name);
  if (!cleanName) return null;
  const dbMon = findPokemonByName(cleanName);
  const canonicalClean = dbMon?.name || cleanName;
  const normLeague = normalizeLeagueName(league);
  const [a, d, s] = parseIvTriplet(member.ivs, normLeague, dbMon);
  const isBb = Boolean(member.isBestBuddy);
  const details = evaluateIvSpreadDetails(canonicalClean, a, d, s, normLeague, isBb);
  const rec = getRecommendedMovesForPokemon(
    formatSpeciesDisplayName(canonicalClean, isShadow),
    normLeague,
    `${a}/${d}/${s}`,
    isBb
  );

  return {
    id:
      existingId ||
      member.builtPokemonId ||
      `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    speciesName: canonicalClean,
    isShadow,
    atkIv: a,
    defIv: d,
    staIv: s,
    ivs: `${a}/${d}/${s}`,
    league: normLeague,
    cpCap: getLeagueCpCap(normLeague),
    cp: details?.cp ?? member.cp ?? rec?.cp ?? 1500,
    level: details?.level ?? rec?.level ?? 40,
    isBestBuddy: isBb,
    fastMove: (member.fastMove || rec?.fastMove || "").trim(),
    chargedMove1: (member.chargedMove1 || rec?.chargedMove1 || "").trim(),
    chargedMove2: (member.chargedMove2 || rec?.chargedMove2 || "").trim(),
    plusMoveLevel: member.plusMoveLevel ?? 4,
    label: label?.trim() || undefined,
    statProductRank: details?.rank,
    statProductPct: details?.pctOfRank1,
    updatedAt: Date.now()
  };
}

interface PreparedOpponent {
  member: TeamMember;
  weight: number;
  resolved: ReturnType<typeof resolveCombatPokemonForEngine>;
  primaryChargedPowerMove: ReturnType<typeof resolveCombatPokemonForEngine>["chargedMoves"][number];
}

function buildLeagueOpponentPool(
  league: string,
  oppMetaPool: OppMetaPoolMode,
  oppIvBaseline: OppIvBaselineMode,
  seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>,
  currentSeason?: { startMs: number; endMs: number } | number,
  maxOpponents: number = 100
): PreparedOpponent[] {
  const normLeague = normalizeLeagueName(league);
  const topCandidates = getTop100MetaCandidatesForLeague(normLeague, maxOpponents);

  const weightByLowerName = new Map<string, number>();
  if (oppMetaPool === "BLENDED_ELO_META") {
    const blended = computeBlendedSeasonMeta(normLeague, seasonBattleLogs, currentSeason);
    for (const [monName, w] of blended.fieldProbabilities.entries()) {
      weightByLowerName.set(monName.toLowerCase(), Math.max(0, w));
    }
  }

  const rawList = topCandidates.slice(0, maxOpponents);
  const n = Math.max(1, rawList.length);
  let totalWeight = 0;

  const prepared = rawList.map((rawOpp) => {
    const { cleanName, isShadow } = cleanSpeciesNameWithoutShadow(rawOpp.name);
    let ivDetails: IvSpreadEvalDetails | null = null;
    if (oppIvBaseline === "RANK_1") {
      ivDetails = getPresetIvSpread(cleanName, normLeague, "RANK_1", false);
    } else if (oppIvBaseline === "MAX_ATK") {
      ivDetails = getPresetIvSpread(cleanName, normLeague, "MAX_ATK", false);
    } else {
      ivDetails = getPresetIvSpread(cleanName, normLeague, "PVPOKE_DEFAULT", false);
    }

    const oppMember: TeamMember = {
      ...rawOpp,
      ivs: ivDetails?.ivs || rawOpp.ivs,
      cp: ivDetails?.cp || rawOpp.cp,
      isBestBuddy: false
    };

    const resolved = resolveCombatPokemonForEngine(oppMember, normLeague);
    const primaryCharged =
      resolved.chargedMoves.reduce((best, cur) =>
        (cur.power || 0) >= (best.power || 0) ? cur : best
      , resolved.chargedMoves[0]) || {
        name: "Body Slam",
        code: "BS",
        type: "normal",
        power: 65,
        energyCost: 40
      };

    const rawW =
      oppMetaPool === "BLENDED_ELO_META"
        ? weightByLowerName.get(rawOpp.name.toLowerCase()) ??
          weightByLowerName.get(cleanName.toLowerCase()) ??
          0.0005
        : 1 / n;
    const clampedW = Math.max(1e-5, rawW);
    totalWeight += clampedW;

    return {
      member: oppMember,
      weight: clampedW,
      resolved,
      primaryChargedPowerMove: primaryCharged,
      _sortIsShadowWeight: isShadow ? 0 : 1
    };
  });

  if (totalWeight > 0) {
    for (const item of prepared) {
      item.weight = item.weight / totalWeight;
    }
  }
  if (oppMetaPool === "BLENDED_ELO_META") {
    prepared.sort((a, b) => b.weight - a.weight);
  }
  return prepared;
}

function classifyFlip(curBr: number, baseBr: number): FlipCode {
  const curSign = curBr > 500 ? 1 : curBr < 500 ? -1 : 0;
  const baseSign = baseBr > 500 ? 1 : baseBr < 500 ? -1 : 0;
  if (curSign === baseSign) return "NONE";
  if (baseSign < 0 && curSign > 0) return "L->W";
  if (baseSign > 0 && curSign < 0) return "W->L";
  if (baseSign === 0 && curSign > 0) return "T->W";
  if (baseSign < 0 && curSign === 0) return "L->T";
  if (baseSign > 0 && curSign === 0) return "W->T";
  return "T->L";
}

export function isPositiveFlip(code: FlipCode): boolean {
  return code === "L->W" || code === "T->W" || code === "L->T";
}

export function isNegativeFlip(code: FlipCode): boolean {
  return code === "W->L" || code === "W->T" || code === "T->L";
}

export function formatFlipCode(code: FlipCode): string {
  return code.replace("->", "→");
}

export function getShieldKeysForScope(scope: ShieldScopeMode): ShieldScenarioKey[] {
  return scope === "EVEN_3" ? [...EVEN_3_SHIELD_KEYS] : [...REALISTIC_7_SHIELD_KEYS];
}

export function classifyMatchupSubTier(
  br: number,
  thresholds: MatchupTierThresholds = DEFAULT_MATCHUP_TIER_THRESHOLDS
): {
  code: "SW" | "W" | "SOFT_W" | "TIE" | "CLOSE_L" | "L" | "SL";
  label: string;
  band: number;
} {
  const effWMin = Math.max(502, thresholds.wMin);
  const effSwMin = Math.max(effWMin + 1, thresholds.swMin);
  const effLMax = Math.min(498, thresholds.lMax);
  const effSlMax = Math.min(effLMax - 1, thresholds.slMax);

  if (br >= effSwMin) return { code: "SW", label: "Strong W", band: 3 };
  if (br >= effWMin) return { code: "W", label: "Solid W", band: 2 };
  if (br >= 501) return { code: "SOFT_W", label: "Soft W", band: 1 };
  if (br === 500) return { code: "TIE", label: "Tie", band: 0 };
  if (br > effLMax) return { code: "CLOSE_L", label: "Close L", band: -1 };
  if (br > effSlMax) return { code: "L", label: "Solid L", band: -2 };
  return { code: "SL", label: "Strong L", band: -3 };
}

export function getOpponentShieldFlips(
  opp: IvOpponentBreakdown,
  scope: ShieldScopeMode
): IvScenarioFlipDetail[] {
  const keys = getShieldKeysForScope(scope);
  const out: IvScenarioFlipDetail[] = [];
  for (const sc of keys) {
    const flipCode = opp.flipsByShield[sc] ?? "NONE";
    if (flipCode === "NONE") continue;
    const beforeBr = opp.baselineBrByShield[sc] ?? opp.baselineBr1v1;
    const afterBr = opp.brByShield[sc] ?? opp.br1v1;
    out.push({
      scenario: sc,
      flipCode,
      beforeBr,
      afterBr,
      deltaBr: afterBr - beforeBr,
      isGain: isPositiveFlip(flipCode)
    });
  }
  return out;
}

export function getOpponentTierOutliers(
  opp: IvOpponentBreakdown,
  scope: ShieldScopeMode,
  minDeltaBr: number = 40,
  thresholds: MatchupTierThresholds = DEFAULT_MATCHUP_TIER_THRESHOLDS
): IvScenarioOutlierDetail[] {
  const keys = getShieldKeysForScope(scope);
  const out: IvScenarioOutlierDetail[] = [];
  for (const sc of keys) {
    const beforeBr = opp.baselineBrByShield[sc] ?? opp.baselineBr1v1;
    const afterBr = opp.brByShield[sc] ?? opp.br1v1;
    const sameBinarySide =
      (beforeBr > 500 && afterBr > 500) || (beforeBr < 500 && afterBr < 500);
    if (!sameBinarySide) continue;
    const deltaBr = afterBr - beforeBr;
    if (Math.abs(deltaBr) < minDeltaBr) continue;
    const beforeTier = classifyMatchupSubTier(beforeBr, thresholds);
    const afterTier = classifyMatchupSubTier(afterBr, thresholds);
    if (beforeTier.band === afterTier.band) continue;
    out.push({
      scenario: sc,
      beforeBr,
      afterBr,
      deltaBr,
      beforeTierLabel: beforeTier.label,
      afterTierLabel: afterTier.label,
      isUpgrade: afterTier.band > beforeTier.band
    });
  }
  return out;
}

function summarizeRecord(
  opponents: IvOpponentBreakdown[],
  weights: number[],
  key: ShieldScenarioKey
): ShieldRecordSummary {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let sumBr = 0;
  let weightedWin = 0;

  for (let i = 0; i < opponents.length; i++) {
    const opp = opponents[i];
    const br = opp.brByShield[key] ?? opp.br1v1;
    const w = weights[i] ?? 0;
    sumBr += br;
    if (br > 500) {
      wins += 1;
      weightedWin += w;
    } else if (br < 500) {
      losses += 1;
    } else {
      ties += 1;
      weightedWin += 0.5 * w;
    }
  }

  const count = Math.max(1, opponents.length);
  return {
    wins,
    losses,
    ties,
    avgBr: Math.round(sumBr / count),
    weightedWinPct: Number((weightedWin * 100).toFixed(1))
  };
}

interface RawCandEval {
  config: IvCandidateConfig;
  details: IvSpreadEvalDetails;
  member: TeamMember;
  resolved: ReturnType<typeof resolveCombatPokemonForEngine>;
  perOpp: Array<{
    brByShield: Record<ShieldScenarioKey, number>;
    fastDmgDealt: number;
    fastDmgTaken: number;
    fastMoveName: string;
    oppFastMoveName: string;
    userEffectiveAtk: number;
    oppEffectiveAtk: number;
    cmpStatus: "WIN" | "TIE" | "LOSS";
    survives1ChargePlusFastCount: number;
    hpAfter1Charge: number;
  }>;
}

/**
 * Evaluates multiple IV candidate spreads against the selected league(s) and opponent meta,
 * automatically pinning 🏆 Rank #1 Stat Product per league and computing side-by-side deltas,
 * matchup flips, Fast Move Breakpoints (+1), Bulkpoints (-1), CMP Tie flips, and Extra Cycle survival.
 */
export function runMultiIvMatrixEvaluation(params: RunMultiIvMatrixParams): MultiIvMatrixResult {
  const { cleanName: speciesClean, isShadow: defaultSpeciesShadow } =
    cleanSpeciesNameWithoutShadow(params.speciesName);
  const oppMetaPool: OppMetaPoolMode = params.oppMetaPool ?? "PVPOKE_TOP_100";
  const oppIvBaseline: OppIvBaselineMode = params.oppIvBaseline ?? "PVPOKE_DEFAULT";
  const maxOpponents = Math.max(10, Math.min(100, params.maxOpponents ?? 100));
  const uniqueLeagues = Array.from(
    new Set(
      (params.leagues.length > 0 ? params.leagues : ["GREAT LEAGUE"]).map((l) =>
        normalizeLeagueName(l)
      )
    )
  );

  const primaryCand = params.candidates[0];
  const rank1Shadow = params.rank1IsShadow ?? primaryCand?.isShadow ?? defaultSpeciesShadow;

  const leagueMatrices: MultiIvLeagueMatrix[] = uniqueLeagues.map((league) => {
    const opponents = buildLeagueOpponentPool(
      league,
      oppMetaPool,
      oppIvBaseline,
      params.seasonBattleLogs,
      params.currentSeason,
      maxOpponents
    );
    const weights = opponents.map((o) => o.weight);

    const rank1Details =
      getPresetIvSpread(speciesClean, league, "RANK_1", false) ||
      evaluateIvSpreadDetails(speciesClean, 0, 15, 15, league, false);

    const pinnedRank1Config: IvCandidateConfig = {
      id: PINNED_RANK1_CANDIDATE_ID,
      label: "🏆 Rank #1 Stat Product",
      speciesName: speciesClean,
      isShadow: rank1Shadow,
      atkIv: rank1Details?.atkIv ?? 0,
      defIv: rank1Details?.defIv ?? 15,
      staIv: rank1Details?.staIv ?? 15,
      isBestBuddy: false,
      fastMove: primaryCand?.fastMove,
      chargedMove1: primaryCand?.chargedMove1,
      chargedMove2: primaryCand?.chargedMove2,
      plusMoveLevel: primaryCand?.plusMoveLevel ?? 4,
      isPinnedRank1: true
    };

    const userCandidates = params.candidates.filter(
      (c) => c.id !== PINNED_RANK1_CANDIDATE_ID
    );
    const orderedConfigs = [pinnedRank1Config, ...userCandidates];

    const evalOne = (cfg: IvCandidateConfig): RawCandEval | null => {
      const cfgClean = cleanSpeciesNameWithoutShadow(cfg.speciesName || speciesClean).cleanName;
      const details = evaluateIvSpreadDetails(
        cfgClean,
        cfg.atkIv,
        cfg.defIv,
        cfg.staIv,
        league,
        Boolean(cfg.isBestBuddy)
      );
      if (!details) return null;

      const fullDisplay = formatSpeciesDisplayName(cfgClean, cfg.isShadow);
      const recMoves = getRecommendedMovesForPokemon(
        fullDisplay,
        league,
        details.ivs,
        Boolean(cfg.isBestBuddy)
      );
      const fastMove = (cfg.fastMove || recMoves?.fastMove || "").trim();
      const chargedMove1 = (cfg.chargedMove1 || recMoves?.chargedMove1 || "").trim();
      const chargedMove2 = (cfg.chargedMove2 || recMoves?.chargedMove2 || "").trim();

      const member: TeamMember = {
        id: cfg.id,
        name: fullDisplay,
        cp: details.cp,
        fastMove,
        chargedMove1,
        chargedMove2,
        ivs: details.ivs,
        plusMoveLevel: cfg.plusMoveLevel ?? 4,
        isBestBuddy: Boolean(cfg.isBestBuddy)
      };

      const resolved = resolveCombatPokemonForEngine(member, league);

      const SHIELD_PAIRS: Array<[ShieldScenarioKey, number, number]> = [
        ["0v0", 0, 0],
        ["1v1", 1, 1],
        ["2v2", 2, 2],
        ["1v0", 1, 0],
        ["0v1", 0, 1],
        ["2v1", 2, 1],
        ["1v2", 1, 2]
      ];

      const perOpp = opponents.map((opp) => {
        const brByShield = {} as Record<ShieldScenarioKey, number>;
        for (const [key, su, so] of SHIELD_PAIRS) {
          brByShield[key] = evaluateDiscreteShieldBattleRating(member, opp.member, su, so, league);
        }

        const dealt = calculateFastDamage(
          resolved.stats,
          opp.resolved.stats,
          resolved.fastMove.name,
          resolved.isShadow,
          opp.resolved.isShadow
        );
        const taken = calculateFastDamage(
          opp.resolved.stats,
          resolved.stats,
          opp.resolved.fastMove.name,
          opp.resolved.isShadow,
          resolved.isShadow
        );

        const oppChargedDmg = calculateChargedDamage(
          opp.resolved.stats,
          resolved.stats,
          opp.primaryChargedPowerMove,
          opp.resolved.isShadow,
          resolved.isShadow
        ).damage;

        const userHp = Math.max(10, resolved.stats.baseStats.hp);
        const hpAfter1Charge = userHp - oppChargedDmg;
        const fastTakenSafe = Math.max(1, taken.damage);
        const fastTurns = Math.max(1, opp.resolved.fastMove.turns || 2);
        const survives1ChargePlusFastCount =
          hpAfter1Charge > 0 ? Math.floor(hpAfter1Charge / fastTakenSafe) * fastTurns : 0;

        // CMP always uses un-shadowed effective Attack stat
        const userEffAtk = resolved.stats.baseStats.atk;
        const oppEffAtk = opp.resolved.stats.baseStats.atk;
        const cmpStatus: "WIN" | "TIE" | "LOSS" =
          userEffAtk > oppEffAtk + 0.05
            ? "WIN"
            : userEffAtk < oppEffAtk - 0.05
            ? "LOSS"
            : "TIE";

        return {
          brByShield,
          fastDmgDealt: dealt.damage,
          fastDmgTaken: taken.damage,
          fastMoveName: dealt.move.name,
          oppFastMoveName: taken.move.name,
          userEffectiveAtk: Number(userEffAtk.toFixed(2)),
          oppEffectiveAtk: Number(oppEffAtk.toFixed(2)),
          cmpStatus,
          survives1ChargePlusFastCount,
          hpAfter1Charge
        };
      });

      return { config: cfg, details, member, resolved, perOpp };
    };

    const evaluated = orderedConfigs
      .map(evalOne)
      .filter((x): x is RawCandEval => x !== null);

    const rank1Eval = evaluated[0];
    const requestedBaseId = params.baselineComparisonId || PINNED_RANK1_CANDIDATE_ID;
    const baseEval =
      evaluated.find((e) => e.config.id === requestedBaseId) || rank1Eval;

    const rank1Wins1v1 = rank1Eval
      ? rank1Eval.perOpp.filter((p) => p.brByShield["1v1"] > 500).length
      : 0;

    const candidateResults: IvCandidateLeagueResult[] = evaluated.map((ev) => {
      let breakpointsGainedCount = 0;
      let breakpointsLostCount = 0;
      let bulkpointsGainedCount = 0;
      let bulkpointsLostCount = 0;
      let cmpFlipsGainedCount = 0;
      let cmpFlipsLostCount = 0;
      let extraCycleSurvivedCount = 0;
      let netFlipsVsBase1v1 = 0;
      let netFlipsVsRank11v1 = 0;

      const oppBreakdowns: IvOpponentBreakdown[] = opponents.map((opp, idx) => {
        const cur = ev.perOpp[idx];
        const base = baseEval ? baseEval.perOpp[idx] : cur;
        const r1 = rank1Eval ? rank1Eval.perOpp[idx] : cur;

        const flipsByShield = {} as Record<ShieldScenarioKey, FlipCode>;
        for (const sc of REALISTIC_7_SHIELD_KEYS) {
          flipsByShield[sc] = classifyFlip(cur.brByShield[sc], base.brByShield[sc]);
        }
        const flip0v0 = flipsByShield["0v0"];
        const flip1v1 = flipsByShield["1v1"];
        const flip2v2 = flipsByShield["2v2"];
        if (isPositiveFlip(flip1v1)) netFlipsVsBase1v1 += 1;
        else if (isNegativeFlip(flip1v1)) netFlipsVsBase1v1 -= 1;

        const r1Flip1v1 = classifyFlip(cur.brByShield["1v1"], r1.brByShield["1v1"]);
        if (isPositiveFlip(r1Flip1v1)) netFlipsVsRank11v1 += 1;
        else if (isNegativeFlip(r1Flip1v1)) netFlipsVsRank11v1 -= 1;

        const fastBreakpointDelta = cur.fastDmgDealt - base.fastDmgDealt;
        if (fastBreakpointDelta > 0) breakpointsGainedCount += 1;
        else if (fastBreakpointDelta < 0) breakpointsLostCount += 1;

        const fastBulkpointDelta = base.fastDmgTaken - cur.fastDmgTaken;
        if (fastBulkpointDelta > 0) bulkpointsGainedCount += 1;
        else if (fastBulkpointDelta < 0) bulkpointsLostCount += 1;

        const cmpScore = (s: "WIN" | "TIE" | "LOSS") => (s === "WIN" ? 2 : s === "TIE" ? 1 : 0);
        const cmpDiff = cmpScore(cur.cmpStatus) - cmpScore(base.cmpStatus);
        const cmpFlip: "GAINED" | "LOST" | "NONE" =
          cmpDiff > 0 ? "GAINED" : cmpDiff < 0 ? "LOST" : "NONE";
        if (cmpFlip === "GAINED") cmpFlipsGainedCount += 1;
        else if (cmpFlip === "LOST") cmpFlipsLostCount += 1;

        const curTankedCharge = cur.hpAfter1Charge > 0 && base.hpAfter1Charge <= 0;
        const baseTankedCharge = base.hpAfter1Charge > 0 && cur.hpAfter1Charge <= 0;
        const curExtraFastKOs =
          Math.ceil(ev.resolved.stats.baseStats.hp / Math.max(1, cur.fastDmgTaken)) >
          Math.ceil((baseEval?.resolved.stats.baseStats.hp ?? ev.resolved.stats.baseStats.hp) / Math.max(1, base.fastDmgTaken));
        const baseExtraFastKOs =
          Math.ceil((baseEval?.resolved.stats.baseStats.hp ?? ev.resolved.stats.baseStats.hp) / Math.max(1, base.fastDmgTaken)) >
          Math.ceil(ev.resolved.stats.baseStats.hp / Math.max(1, cur.fastDmgTaken));
        const curExtraPostCharge =
          cur.hpAfter1Charge > 0 &&
          base.hpAfter1Charge > 0 &&
          cur.survives1ChargePlusFastCount > base.survives1ChargePlusFastCount;
        const baseExtraPostCharge =
          cur.hpAfter1Charge > 0 &&
          base.hpAfter1Charge > 0 &&
          base.survives1ChargePlusFastCount > cur.survives1ChargePlusFastCount;

        const survivesExtraChargedCycle =
          curTankedCharge || curExtraPostCharge || (cur.fastDmgTaken < base.fastDmgTaken && curExtraFastKOs);
        const losesExtraChargedCycle =
          !survivesExtraChargedCycle &&
          (baseTankedCharge || baseExtraPostCharge || (cur.fastDmgTaken > base.fastDmgTaken && baseExtraFastKOs));

        if (survivesExtraChargedCycle) extraCycleSurvivedCount += 1;

        return {
          oppName: opp.member.name,
          oppIvs: opp.member.ivs || "",
          oppCp: opp.resolved.stats.resolvedCp,
          oppWeight: opp.weight,
          br0v0: cur.brByShield["0v0"],
          br1v1: cur.brByShield["1v1"],
          br2v2: cur.brByShield["2v2"],
          baselineBr0v0: base.brByShield["0v0"],
          baselineBr1v1: base.brByShield["1v1"],
          baselineBr2v2: base.brByShield["2v2"],
          rank1Br0v0: r1.brByShield["0v0"],
          rank1Br1v1: r1.brByShield["1v1"],
          rank1Br2v2: r1.brByShield["2v2"],
          flip0v0,
          flip1v1,
          flip2v2,
          brByShield: { ...cur.brByShield },
          baselineBrByShield: { ...base.brByShield },
          rank1BrByShield: { ...r1.brByShield },
          flipsByShield,
          fastMoveName: cur.fastMoveName,
          oppFastMoveName: cur.oppFastMoveName,
          fastDmgDealt: cur.fastDmgDealt,
          baselineFastDmgDealt: base.fastDmgDealt,
          fastBreakpointDelta,
          fastDmgTaken: cur.fastDmgTaken,
          baselineFastDmgTaken: base.fastDmgTaken,
          fastBulkpointDelta,
          survivesExtraChargedCycle,
          losesExtraChargedCycle,
          userEffectiveAtk: cur.userEffectiveAtk,
          baselineUserEffectiveAtk: base.userEffectiveAtk,
          oppEffectiveAtk: cur.oppEffectiveAtk,
          cmpStatus: cur.cmpStatus,
          baselineCmpStatus: base.cmpStatus,
          cmpFlip
        };
      });

      const records = {} as Record<ShieldScenarioKey, ShieldRecordSummary>;
      for (const sc of REALISTIC_7_SHIELD_KEYS) {
        records[sc] = summarizeRecord(oppBreakdowns, weights, sc);
      }
      const rec1v1 = records["1v1"];

      return {
        candidateId: ev.config.id,
        label: ev.config.label,
        speciesName: ev.member.name,
        displayName: ev.member.name,
        isShadow: Boolean(ev.config.isShadow),
        isBestBuddy: Boolean(ev.config.isBestBuddy),
        isPinnedRank1: Boolean(ev.config.isPinnedRank1),
        atkIv: ev.details.atkIv,
        defIv: ev.details.defIv,
        staIv: ev.details.staIv,
        ivs: ev.details.ivs,
        cp: ev.details.cp,
        level: ev.details.level,
        effAtk: Number(ev.resolved.stats.baseStats.atk.toFixed(2)),
        effDef: Number(ev.resolved.stats.baseStats.def.toFixed(2)),
        effHp: ev.resolved.stats.baseStats.hp,
        statProduct: ev.details.statProduct,
        rank: ev.details.rank,
        pctOfRank1: ev.details.pctOfRank1,
        league,
        fastMove: ev.resolved.fastMove.name,
        chargedMove1: ev.resolved.chargedMoves[0]?.name || "",
        chargedMove2: ev.resolved.chargedMoves[1]?.name || "",
        records,
        deltaVsRank1: {
          br0v0: 0,
          br1v1: 0,
          br2v2: 0,
          wins1v1: rec1v1.wins - rank1Wins1v1,
          netFlips1v1: netFlipsVsRank11v1
        },
        deltaVsBaseline: {
          br0v0: 0,
          br1v1: 0,
          br2v2: 0,
          wins1v1: 0,
          netFlips1v1: netFlipsVsBase1v1
        },
        breakpointsGainedCount,
        breakpointsLostCount,
        bulkpointsGainedCount,
        bulkpointsLostCount,
        cmpFlipsGainedCount,
        cmpFlipsLostCount,
        extraCycleSurvivedCount,
        opponents: oppBreakdowns
      };
    });

    const rank1Res = candidateResults[0];
    const baseRes =
      candidateResults.find((r) => r.candidateId === (baseEval?.config.id ?? PINNED_RANK1_CANDIDATE_ID)) ||
      rank1Res;

    for (const res of candidateResults) {
      if (rank1Res) {
        res.deltaVsRank1 = {
          br0v0: res.records["0v0"].avgBr - rank1Res.records["0v0"].avgBr,
          br1v1: res.records["1v1"].avgBr - rank1Res.records["1v1"].avgBr,
          br2v2: res.records["2v2"].avgBr - rank1Res.records["2v2"].avgBr,
          wins1v1: res.records["1v1"].wins - rank1Res.records["1v1"].wins,
          netFlips1v1: res.deltaVsRank1.netFlips1v1
        };
      }
      if (baseRes) {
        res.deltaVsBaseline = {
          br0v0: res.records["0v0"].avgBr - baseRes.records["0v0"].avgBr,
          br1v1: res.records["1v1"].avgBr - baseRes.records["1v1"].avgBr,
          br2v2: res.records["2v2"].avgBr - baseRes.records["2v2"].avgBr,
          wins1v1: res.records["1v1"].wins - baseRes.records["1v1"].wins,
          netFlips1v1: res.deltaVsBaseline.netFlips1v1
        };
      }
    }

    return {
      league,
      oppMetaPool,
      oppIvBaseline,
      opponentCount: opponents.length,
      baselineComparisonId: baseRes?.candidateId || PINNED_RANK1_CANDIDATE_ID,
      baselineLabel: baseRes?.label || "🏆 Rank #1 Stat Product",
      rank1CandidateId: PINNED_RANK1_CANDIDATE_ID,
      candidateResults
    };
  });

  return {
    leagues: leagueMatrices,
    computedAtMs: Date.now()
  };
}
