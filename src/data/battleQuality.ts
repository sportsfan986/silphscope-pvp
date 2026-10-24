import {
  POKEMON_DATABASE,
  PVPOKE_TOP_OPPONENTS,
  PokemonStats,
  TeamPreset,
  calculateChargedDamage,
  computeEffectiveStatsForLeague,
  evaluateDiscreteShieldBattleRating,
  getLeagueTopMetaSpeciesNames,
  getStoredMatchupTierThresholds,
  getTypeMultiplier
} from './gblData';

export type ShieldCount = 0 | 1 | 2;

export type ShieldScenarioCode =
  | '0v0'
  | '0v1'
  | '0v2'
  | '1v0'
  | '1v1'
  | '1v2'
  | '2v0'
  | '2v1'
  | '2v2';

export const ALL_SHIELD_PERMUTATIONS: ReadonlyArray<{
  userShields: ShieldCount;
  oppShields: ShieldCount;
  code: ShieldScenarioCode;
}> = [
  { userShields: 0, oppShields: 0, code: '0v0' },
  { userShields: 0, oppShields: 1, code: '0v1' },
  { userShields: 0, oppShields: 2, code: '0v2' },
  { userShields: 1, oppShields: 0, code: '1v0' },
  { userShields: 1, oppShields: 1, code: '1v1' },
  { userShields: 1, oppShields: 2, code: '1v2' },
  { userShields: 2, oppShields: 0, code: '2v0' },
  { userShields: 2, oppShields: 1, code: '2v1' },
  { userShields: 2, oppShields: 2, code: '2v2' }
];

export type BattleQualityBadgeLabel =
  | 'Clutch Win'
  | 'Skill Win'
  | 'Expected Win'
  | 'Blunder Loss'
  | 'Tough Loss'
  | 'Expected Loss';

export type ContextualEventFlag =
  | '⚠️ Double Shield Pocket'
  | '⚠️ Shield in Pocket'
  | '🧹 Clean Sweep'
  | '🛡️ Shield Advantage'
  | '⚡ 75% Conf';

export type TimelineEventActor = 'user' | 'opp';

export type TimelineEventType =
  | 'SWAP'
  | 'SHIELD'
  | 'FAINT'
  | 'POST_FAINT_PROMPT'
  | 'DECISION_SNAPSHOT'
  | 'CHARGED_ATTACK';

export interface BattleTimelineEvent {
  type: TimelineEventType;
  actor: TimelineEventActor;
  t: number; // Relative elapsed seconds (Date.now() - t0) / 1000
  pokemonIn?: string | null;
  pokemonOut?: string | null;
  pokemonFainted?: string | null;
  shieldNumber?: 1 | 2 | number | null;
  activePokemon?: string | null;
  pokemonShielded?: string | null;
  userShieldsRemaining: number;
  oppShieldsRemaining: number;
  recommendedAction?: string | null;
  recommendedGoal?: string | null;
  decisionPhase?: string | null;
  recommendedTargetPokemon?: string | null;
  playerSwapRemainingSec?: number | null;
  oppSwapRemainingSec?: number | null;
  userAliveCount?: number | null;
  oppAliveCount?: number | null;
  lastPlayerSwitchWasFaint?: boolean | null;
  lastOppSwitchWasFaint?: boolean | null;
  activeMatchupBr?: number | null;
  candidateScores?: Record<string, number> | null;
  followedRecommendation?: boolean | null;
  validityLatched?: boolean | null;
  shielded?: boolean | null;
  hpBeforePct?: number | null;
  hpAfterPct?: number | null;
  hpDeltaPct?: number | null;
  inferredMoveName?: string | null;
  userSlotHpPct?: number[] | null;
  oppSlotHpPct?: number[] | null;
}

export interface ExecutionIntervalSegment {
  tStart: number;
  tEnd: number;
  duration: number;
  tau: number;
  userActive: string;
  oppActive: string;
  userShields: ShieldCount;
  oppShields: ShieldCount;
  rating: number;
}

export interface DynamicExecutionWAEOptions {
  totalDurationSec?: number | null;
  userFaints?: number | null;
  oppFaints?: number | null;
  userShieldsRemaining?: number | null;
  oppShieldsRemaining?: number | null;
  ratingsDb?: RatingsLookupDb;
  metaPool?: string[];
}

export interface DynamicExecutionWAEResult {
  execWae: number;
  weightedResidual: number;
  pExec: number;
  pPre: number;
  sActual: number | null;
  deltaQBase: number;
  deltaQFinal: number;
  weight: number;
  faintMarginScaled: boolean;
  shieldPenaltyApplied: number;
  userFaints: number;
  oppFaints: number;
  userShieldsRemaining: number;
  oppShieldsRemaining: number;
  intervals: ExecutionIntervalSegment[];
}

export interface BlindMatchupFavorabilityResult {
  bmf: number | null;
  pPre: number | null;
  bmfPercentage: number | null;
  weight: number;
  sLead: number | null;
  sBack: number | null;
  compositeM: number | null;
  isUnrevealedThird: boolean;
}

export interface BattleQualityMetadata {
  sLead: number;
  sBack: number;
  compositeM: number;
  bmfScore: number; // Pre-Match Expected Win Probability P_pre in [0, 1]
  pPre: number; // Pre-Match Expected Win Probability in [0, 1] (BMF)
  bmfPercentage: number; // Pre-Match BMF in [0, 100]
  sActual?: number | null; // Phase 2: Time-weighted execution rating S_actual
  pExec?: number; // Phase 2: Dynamic Execution Win Probability in [0, 1]
  execWae: number; // Phase 2: Final Execution Residual Delta_Q_final
  pWin: number; // Expected Win Probability in [0, 1] (P_exec when timeline present, else P_pre)
  deltaQ: number; // Final Execution Residual Delta_Q_final
  weight: number; // 1.0 (all 3 seen), 0.75 (unrevealed 3rd), or 0 (incomplete <2 seen)
  weightedResidual: number; // weight * deltaQ
  badgeLabel: BattleQualityBadgeLabel; // Phase 3: Primary Performance Badge derived from P_pre
  badgeColor: string; // Hex color (#22d3ee, #4ade80, #94a3b8, #f43f5e, #fb923c)
  badges: BattleQualityBadgeLabel[];
  contextualFlags: ContextualEventFlag[];
  flags: ContextualEventFlag[];
  isUnrevealedThird: boolean;
  faintMarginScaled?: boolean;
  shieldPenaltyApplied?: number;
  userFaints?: number;
  oppFaints?: number;
  userShieldsRemaining?: number;
  oppShieldsRemaining?: number;
}

export interface BattleQualityTeamInput {
  lead?: string | null;
  swap?: string | null;
  close?: string | null;
  firstSwap?: string | null;
  finalSeen?: string | null;
}

export type RatingsLookupDb =
  | Record<string, number>
  | ((
      myMon: string,
      oppMon: string,
      userShields: ShieldCount,
      oppShieldsOrLeague?: ShieldCount | string,
      league?: string
    ) => number);

export function normalizeLeagueKey(league?: string): string {
  const upper = (league || 'GREAT LEAGUE').toUpperCase();
  if (upper.includes('MEGA')) return 'MEGA MASTER LEAGUE';
  if (upper.includes('ULTRA')) return 'ULTRA LEAGUE';
  if (upper.includes('MASTER')) return 'MASTER LEAGUE';
  return 'GREAT LEAGUE';
}

function resolvePokemonStats(rawName: string, league: string): { stats: PokemonStats; isShadow: boolean } {
  const trimmed = (rawName || '').trim();
  const isShadow = /^Shadow\s+/i.test(trimmed) || trimmed.toLowerCase().includes('(shadow)');
  const cleanName = trimmed
    .replace(/^Shadow\s+/i, '')
    .replace(/\s*\(Shadow\)/i, '')
    .trim();

  const allEntries = Object.values(POKEMON_DATABASE);
  const rawMatch =
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[cleanName] ||
    allEntries.find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/\s+/g, '_')
    ) ||
    allEntries.find((p) => p.name.toLowerCase().includes(cleanName.toLowerCase())) ||
    allEntries[0];

  const scaled = computeEffectiveStatsForLeague(rawMatch, league, undefined, undefined, isShadow);
  return { stats: scaled, isShadow };
}

function clampShieldCount(s: number): ShieldCount {
  if (s <= 0) return 0;
  if (s >= 2) return 2;
  return 1;
}

/**
 * Computes a PvPoke-calibrated 0–1000 battle rating (500 = Neutral, >500 = Favorable, <500 = Negative)
 * across all 9 discrete shield permutations (s_user v s_opp in {0, 1, 2}^2):
 *   0v0, 0v1, 0v2, 1v0, 1v1, 1v2, 2v0, 2v1, 2v2.
 *
 * Supports both:
 * - Asymmetric signature: evaluatePvPokeMatchupRating(myMon, oppMon, userShields, oppShields, league, ratingsDb)
 * - Symmetric signature:  evaluatePvPokeMatchupRating(myMon, oppMon, shields, league, ratingsDb)
 */
export function evaluatePvPokeMatchupRating(
  myMonName: string,
  oppMonName: string,
  userShields: ShieldCount = 1,
  oppShieldsOrLeague?: ShieldCount | string,
  leagueOrRatingsDb?: string | RatingsLookupDb,
  maybeRatingsDb?: RatingsLookupDb
): number {
  const sUser: ShieldCount = clampShieldCount(Number(userShields));
  let sOpp: ShieldCount = sUser;
  let rawLeague: string | undefined = 'GREAT LEAGUE';
  let ratingsDb: RatingsLookupDb | undefined;

  if (typeof oppShieldsOrLeague === 'number') {
    sOpp = clampShieldCount(oppShieldsOrLeague);
    if (typeof leagueOrRatingsDb === 'string' || leagueOrRatingsDb === undefined) {
      rawLeague = leagueOrRatingsDb;
      ratingsDb = maybeRatingsDb;
    } else {
      ratingsDb = leagueOrRatingsDb;
    }
  } else {
    rawLeague = oppShieldsOrLeague;
    ratingsDb = leagueOrRatingsDb as RatingsLookupDb | undefined;
  }

  const normLeague = normalizeLeagueKey(rawLeague);
  const scenarioCode = `${sUser}v${sOpp}` as ShieldScenarioCode;

  if (typeof ratingsDb === 'function') {
    const custom =
      ratingsDb.length >= 5
        ? ratingsDb(myMonName, oppMonName, sUser, sOpp, normLeague)
        : ratingsDb(myMonName, oppMonName, sUser, normLeague);
    if (typeof custom === 'number' && !Number.isNaN(custom)) {
      return Math.max(100, Math.min(900, custom));
    }
  } else if (ratingsDb && typeof ratingsDb === 'object') {
    const keyAsymExact = `${normLeague}:${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${scenarioCode}`;
    const keyAsymShort = `${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${scenarioCode}`;
    if (typeof ratingsDb[keyAsymExact] === 'number') return ratingsDb[keyAsymExact];
    if (typeof ratingsDb[keyAsymShort] === 'number') return ratingsDb[keyAsymShort];
    if (sUser === sOpp) {
      const keySymExact = `${normLeague}:${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${sUser}s`;
      const keySymShort = `${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${sUser}s`;
      if (typeof ratingsDb[keySymExact] === 'number') return ratingsDb[keySymExact];
      if (typeof ratingsDb[keySymShort] === 'number') return ratingsDb[keySymShort];
    }
  }

  return evaluateDiscreteShieldBattleRating(myMonName, oppMonName, sUser, sOpp, normLeague);
}

/**
 * Evaluates all 9 shield permutations (0v0, 0v1, 0v2, 1v0, 1v1, 1v2, 2v0, 2v1, 2v2)
 * for a given pair of combatants.
 */
export function evaluateAllShieldPermutations(
  myMonName: string,
  oppMonName: string,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb
): Record<ShieldScenarioCode, number> {
  const result = {} as Record<ShieldScenarioCode, number>;
  for (const perm of ALL_SHIELD_PERMUTATIONS) {
    result[perm.code] = evaluatePvPokeMatchupRating(
      myMonName,
      oppMonName,
      perm.userShields,
      perm.oppShields,
      league,
      ratingsDb
    );
  }
  return result;
}

/**
 * Computes the unweighted average 1v1 battle rating (R_bar) of a given Pokémon
 * against the active league's Top-100 meta list.
 */
export function computeMetaAverage1v1Rating(
  pokemonName: string,
  league: string = 'GREAT LEAGUE',
  metaPool?: string[],
  ratingsDb?: RatingsLookupDb
): number {
  const normLeague = normalizeLeagueKey(league);
  const activeMetaPool =
    metaPool && metaPool.length > 0
      ? metaPool
      : getLeagueTopMetaSpeciesNames(normLeague, 100);

  if (activeMetaPool.length === 0) return 500.0;
  const sum = activeMetaPool.reduce(
    (acc, metaMon) => acc + evaluatePvPokeMatchupRating(pokemonName, metaMon, 1, 1, normLeague, ratingsDb),
    0
  );
  return sum / activeMetaPool.length;
}

/**
 * Computes the unweighted average 1v1 battle ratings for the user's backline
 * (R_bar_swap and R_bar_close) against the active league's top meta list.
 */
export function computeBacklineMetaAverages(
  mySwap: string,
  myClose: string,
  league: string = 'GREAT LEAGUE',
  metaPool?: string[],
  ratingsDb?: RatingsLookupDb
): { rBarSwap: number; rBarClose: number } {
  return {
    rBarSwap: computeMetaAverage1v1Rating(mySwap, league, metaPool, ratingsDb),
    rBarClose: computeMetaAverage1v1Rating(myClose, league, metaPool, ratingsDb)
  };
}

export function calculateAutoLeadMatchup(
  myLead: string,
  oppLead: string,
  league: string = 'GREAT LEAGUE'
): 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' {
  if (!myLead?.trim() || !oppLead?.trim()) return 'NEUTRAL';
  const r1s = evaluatePvPokeMatchupRating(myLead, oppLead, 1, 1, league);
  const thresholds = getStoredMatchupTierThresholds();
  if (r1s >= thresholds.wMin) return 'FAVORABLE';
  if (r1s <= thresholds.lMax) return 'NEGATIVE';
  return 'NEUTRAL';
}

export function getBadgeCategorization(
  pWin: number,
  result: 'WIN' | 'LOSS' | number
): {
  badgeLabel: BattleQualityBadgeLabel;
  badgeColor: string;
} {
  const isWin = result === 'WIN' || result === 1 || result === 1.0;
  if (isWin) {
    if (pWin < 0.4) {
      return { badgeLabel: 'Clutch Win', badgeColor: '#22d3ee' };
    }
    if (pWin <= 0.6) {
      return { badgeLabel: 'Skill Win', badgeColor: '#4ade80' };
    }
    return { badgeLabel: 'Expected Win', badgeColor: '#94a3b8' };
  } else {
    if (pWin > 0.6) {
      return { badgeLabel: 'Blunder Loss', badgeColor: '#f43f5e' };
    }
    if (pWin >= 0.4) {
      return { badgeLabel: 'Tough Loss', badgeColor: '#fb923c' };
    }
    return { badgeLabel: 'Expected Loss', badgeColor: '#94a3b8' };
  }
}

function extractTeamTriplet(team: string[] | BattleQualityTeamInput): {
  lead: string;
  swap: string;
  close: string;
} {
  if (Array.isArray(team)) {
    const lead = (team[0] || '').trim();
    const swap = (team[1] || '').trim();
    const close = (team[2] || '').trim();
    return { lead, swap, close };
  }
  const lead = (team.lead || '').trim();
  const swap = (team.firstSwap || team.swap || '').trim();
  const close = (team.finalSeen || team.close || '').trim();
  return { lead, swap, close };
}

/**
 * Phase 1: Blind Matchup Favorability (BMF / Pre-Match Expectation)
 */
export function calculateBlindMatchupFavorability(
  myTeam: string[] | BattleQualityTeamInput,
  oppTeam: string[] | BattleQualityTeamInput,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[]
): BlindMatchupFavorabilityResult {
  const normLeague = normalizeLeagueKey(league);

  const myParsed = extractTeamTriplet(myTeam);
  const myLead = myParsed.lead;
  const mySwap = myParsed.swap || myLead;
  const myClose = myParsed.close || mySwap || myLead;

  const oppParsed = extractTeamTriplet(oppTeam);
  const oppLead = oppParsed.lead;
  const oppSwap = oppParsed.swap;
  const oppClose = oppParsed.close;

  // Match Validity Rule 1: If oppTeam.firstSwap is null or missing -> return { bmf: null, weight: 0.0 }
  if (!myLead || !oppLead || !oppSwap) {
    return {
      bmf: null,
      pPre: null,
      bmfPercentage: null,
      weight: 0.0,
      sLead: null,
      sBack: null,
      compositeM: null,
      isUnrevealedThird: false
    };
  }

  const isUnrevealedThird = !oppClose;
  const weight = isUnrevealedThird ? 0.75 : 1.0;

  // Lead Score (S_lead): 50% 1v1 + 50% 2v2
  const ratingLead1v1 = evaluatePvPokeMatchupRating(myLead, oppLead, 1, 1, normLeague, ratingsDb);
  const ratingLead2v2 = evaluatePvPokeMatchupRating(myLead, oppLead, 2, 2, normLeague, ratingsDb);
  const sLead = 0.5 * ratingLead1v1 + 0.5 * ratingLead2v2;

  // Backline Score (S_back):
  let scoreA: number;
  let scoreB: number;

  if (!isUnrevealedThird) {
    // Known 3rd (w = 1.0)
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppClose = evaluatePvPokeMatchupRating(myClose, oppClose, 1, 1, normLeague, ratingsDb);
    const rSwapVsOppClose = evaluatePvPokeMatchupRating(mySwap, oppClose, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rCloseVsOppClose) / 2.0;
    scoreB = (rSwapVsOppClose + rCloseVsOppSwap) / 2.0;
  } else {
    // Unrevealed 3rd (w = 0.75) -> Meta-Average Prior
    const { rBarSwap, rBarClose } = computeBacklineMetaAverages(
      mySwap,
      myClose,
      normLeague,
      metaPool,
      ratingsDb
    );
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rBarClose) / 2.0;
    scoreB = (rCloseVsOppSwap + rBarSwap) / 2.0;
  }

  const sBack = 0.7 * Math.max(scoreA, scoreB) + 0.3 * Math.min(scoreA, scoreB);

  // Composite Score & Pre-Match Win Probability (P_pre):
  const compositeM = 0.4 * sLead + 0.6 * sBack;
  const pPre = 1.0 / (1.0 + Math.exp(-0.006 * (compositeM - 500.0)));

  return {
    bmf: Number(pPre.toFixed(4)),
    pPre: Number(pPre.toFixed(4)),
    bmfPercentage: Number((pPre * 100.0).toFixed(1)),
    weight,
    sLead: Number(sLead.toFixed(2)),
    sBack: Number(sBack.toFixed(2)),
    compositeM: Number(compositeM.toFixed(2)),
    isUnrevealedThird
  };
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
 * - Returns { execWae: Delta_Q_final, weightedResidual: Delta_Q_final * weight, ... }.
 */
export function calculateDynamicExecutionWAE(
  myTeam: string[] | BattleQualityTeamInput,
  oppTeam: string[] | BattleQualityTeamInput,
  league: string = 'GREAT LEAGUE',
  result: 'WIN' | 'LOSS' | number = 'WIN',
  timelineEvents?: BattleTimelineEvent[] | null,
  options?: DynamicExecutionWAEOptions
): DynamicExecutionWAEResult | null {
  const normLeague = normalizeLeagueKey(league);
  const ratingsDb = options?.ratingsDb;
  const metaPool = options?.metaPool;

  const bmfResult = calculateBlindMatchupFavorability(myTeam, oppTeam, normLeague, ratingsDb, metaPool);
  if (bmfResult.pPre === null || bmfResult.weight <= 0) {
    return null;
  }

  const pPre = bmfResult.pPre;
  const weight = bmfResult.weight;

  const myParsed = extractTeamTriplet(myTeam);
  const myLead = myParsed.lead;
  const mySwap = myParsed.swap || myLead;
  const myClose = myParsed.close || mySwap || myLead;
  const myRoster = [myLead, mySwap, myClose].filter(Boolean);

  const oppParsed = extractTeamTriplet(oppTeam);
  const oppLead = oppParsed.lead;
  const oppSwap = oppParsed.swap;
  const oppClose = oppParsed.close;
  const oppRoster = [oppLead, oppSwap, oppClose].filter(Boolean);

  const hasTimeline = Array.isArray(timelineEvents) && timelineEvents.length > 0;
  const rawIntervals: Array<Omit<ExecutionIntervalSegment, 'tau'>> = [];

  let sActual: number | null = null;
  let pExec = pPre;

  let derivedUserFaints = 0;
  let derivedOppFaints = 0;
  let runningUserShields: ShieldCount = 2;
  let runningOppShields: ShieldCount = 2;

  if (hasTimeline && timelineEvents) {
    const sortedEvents = [...timelineEvents].sort((a, b) => Math.max(0, a.t) - Math.max(0, b.t));

    let userActive = myLead;
    let oppActive = oppLead;
    let intervalStartT = 0.0;
    let intervalUserShields: ShieldCount = 2;
    let intervalOppShields: ShieldCount = 2;

    const userFaintedNames = new Set<string>();
    const oppFaintedNames = new Set<string>();

    for (const ev of sortedEvents) {
      const evT = Math.max(0, Number(ev.t) || 0);

      if (ev.type === 'SHIELD') {
        if (typeof ev.userShieldsRemaining === 'number') {
          runningUserShields = clampShieldCount(ev.userShieldsRemaining);
        } else if (ev.actor === 'user') {
          runningUserShields = clampShieldCount(runningUserShields - 1);
        }
        if (typeof ev.oppShieldsRemaining === 'number') {
          runningOppShields = clampShieldCount(ev.oppShieldsRemaining);
        } else if (ev.actor === 'opp') {
          runningOppShields = clampShieldCount(runningOppShields - 1);
        }

        const activeMon = (ev.activePokemon || ev.pokemonShielded || '').trim();
        if (activeMon) {
          if (ev.actor === 'user') userActive = activeMon;
          else if (ev.actor === 'opp') oppActive = activeMon;
        }

        if (Math.abs(evT - intervalStartT) < 1e-6) {
          intervalUserShields = runningUserShields;
          intervalOppShields = runningOppShields;
        }
        continue;
      }

      if (ev.type === 'SWAP' || ev.type === 'FAINT') {
        // Close active head-to-head interval [intervalStartT, evT] if duration > 0
        if (evT > intervalStartT) {
          const duration = evT - intervalStartT;
          const rating = evaluatePvPokeMatchupRating(
            userActive,
            oppActive,
            intervalUserShields,
            intervalOppShields,
            normLeague,
            ratingsDb
          );
          rawIntervals.push({
            tStart: intervalStartT,
            tEnd: evT,
            duration,
            userActive,
            oppActive,
            userShields: intervalUserShields,
            oppShields: intervalOppShields,
            rating
          });
        }

        if (typeof ev.userShieldsRemaining === 'number') {
          runningUserShields = clampShieldCount(ev.userShieldsRemaining);
        }
        if (typeof ev.oppShieldsRemaining === 'number') {
          runningOppShields = clampShieldCount(ev.oppShieldsRemaining);
        }

        if (ev.type === 'FAINT') {
          if (ev.actor === 'user') {
            derivedUserFaints++;
            const faintedMon = (ev.pokemonFainted || ev.pokemonOut || userActive).trim();
            if (faintedMon) userFaintedNames.add(faintedMon.toLowerCase());
            const explicitIn = (ev.pokemonIn || '').trim();
            if (explicitIn) {
              userActive = explicitIn;
            } else {
              const replacement = myRoster.find((m) => !userFaintedNames.has(m.toLowerCase()));
              if (replacement) userActive = replacement;
            }
          } else {
            derivedOppFaints++;
            const faintedMon = (ev.pokemonFainted || ev.pokemonOut || oppActive).trim();
            if (faintedMon) oppFaintedNames.add(faintedMon.toLowerCase());
            const explicitIn = (ev.pokemonIn || '').trim();
            if (explicitIn) {
              oppActive = explicitIn;
            } else {
              const replacement = oppRoster.find((m) => !oppFaintedNames.has(m.toLowerCase()));
              if (replacement) oppActive = replacement;
            }
          }
        } else if (ev.type === 'SWAP') {
          if (ev.actor === 'user') {
            const nextMon = (ev.pokemonIn || '').trim();
            if (nextMon) userActive = nextMon;
          } else {
            const nextMon = (ev.pokemonIn || '').trim();
            if (nextMon) oppActive = nextMon;
          }
        }

        intervalStartT = evT;
        intervalUserShields = runningUserShields;
        intervalOppShields = runningOppShields;
      }
    }

    const maxEventT = sortedEvents.reduce((maxT, e) => Math.max(maxT, Math.max(0, Number(e.t) || 0)), 0);
    const totalDurationSec =
      typeof options?.totalDurationSec === 'number' && options.totalDurationSec > maxEventT
        ? options.totalDurationSec
        : maxEventT;

    if (totalDurationSec > intervalStartT) {
      const duration = totalDurationSec - intervalStartT;
      const rating = evaluatePvPokeMatchupRating(
        userActive,
        oppActive,
        intervalUserShields,
        intervalOppShields,
        normLeague,
        ratingsDb
      );
      rawIntervals.push({
        tStart: intervalStartT,
        tEnd: totalDurationSec,
        duration,
        userActive,
        oppActive,
        userShields: intervalUserShields,
        oppShields: intervalOppShields,
        rating
      });
    }

    const totalPartitionDuration = rawIntervals.reduce((acc, iv) => acc + iv.duration, 0);
    if (totalPartitionDuration > 0 && rawIntervals.length > 0) {
      sActual = rawIntervals.reduce((acc, iv) => {
        const tau = iv.duration / totalPartitionDuration;
        return acc + tau * iv.rating;
      }, 0);
      pExec = 1.0 / (1.0 + Math.exp(-0.006 * (sActual - 500.0)));
    }
  }

  const totalPartitionDuration = rawIntervals.reduce((acc, iv) => acc + iv.duration, 0);
  const intervals: ExecutionIntervalSegment[] = rawIntervals.map((iv) => ({
    ...iv,
    tau: totalPartitionDuration > 0 ? iv.duration / totalPartitionDuration : 0
  }));

  const userFaints =
    typeof options?.userFaints === 'number'
      ? Math.max(0, Math.min(3, options.userFaints))
      : Math.max(0, Math.min(3, derivedUserFaints));

  const oppFaints =
    typeof options?.oppFaints === 'number'
      ? Math.max(0, Math.min(3, options.oppFaints))
      : Math.max(0, Math.min(3, derivedOppFaints));

  const userShieldsRemaining =
    typeof options?.userShieldsRemaining === 'number'
      ? clampShieldCount(options.userShieldsRemaining)
      : hasTimeline
      ? runningUserShields
      : 0;

  const oppShieldsRemaining =
    typeof options?.oppShieldsRemaining === 'number'
      ? clampShieldCount(options.oppShieldsRemaining)
      : hasTimeline
      ? runningOppShields
      : 0;

  const numericResult = result === 'WIN' || result === 1 || result === 1.0 ? 1.0 : 0.0;
  const deltaQBase = numericResult - pExec;
  let deltaQScaled = deltaQBase;
  let faintMarginScaled = false;
  let shieldPenalty = 0.0;

  // Faint Margin Scaling: If Result == 1 and (oppFaints - userFaints) >= 2, scale Delta Q * 1.10
  if (numericResult === 1.0 && oppFaints - userFaints >= 2) {
    deltaQScaled = deltaQScaled * 1.1;
    faintMarginScaled = true;
  }

  // Shield in Pocket Penalty: If Result == 0 and userShieldsRemaining > 0: Delta Q_final = Delta Q - (0.15 * userShieldsRemaining)
  if (numericResult === 0.0 && userShieldsRemaining > 0) {
    shieldPenalty = 0.15 * userShieldsRemaining;
    deltaQScaled = deltaQScaled - shieldPenalty;
  }

  const deltaQFinal = deltaQScaled;
  const weightedResidual = deltaQFinal * weight;

  return {
    execWae: Number(deltaQFinal.toFixed(4)),
    weightedResidual: Number(weightedResidual.toFixed(4)),
    pExec: Number(pExec.toFixed(4)),
    pPre: Number(pPre.toFixed(4)),
    sActual: sActual !== null ? Number(sActual.toFixed(2)) : null,
    deltaQBase: Number(deltaQBase.toFixed(4)),
    deltaQFinal: Number(deltaQFinal.toFixed(4)),
    weight,
    faintMarginScaled,
    shieldPenaltyApplied: Number(shieldPenalty.toFixed(4)),
    userFaints,
    oppFaints,
    userShieldsRemaining,
    oppShieldsRemaining,
    intervals
  };
}

/**
 * Phase 3: Contextual Event Flags (Pills)
 * - `⚠️ Double Shield Pocket`: Loss with 2 shields remaining.
 * - `⚠️ Shield in Pocket`: Loss with 1 shield remaining.
 * - `🧹 Clean Sweep`: Win with 0 user faints.
 * - `🛡️ Shield Advantage`: Win ending with user shields > opp shields.
 * - `⚡ 75% Conf`: Opponent 3rd Pokémon unrevealed.
 */
export function computeContextualEventFlags(params: {
  result: 'WIN' | 'LOSS' | string | number;
  userShieldsRemaining?: number | null;
  oppShieldsRemaining?: number | null;
  userFaints?: number | null;
  isUnrevealedThird?: boolean;
}): ContextualEventFlag[] {
  const isWin =
    params.result === 'WIN' ||
    (typeof params.result === 'string' && params.result.toUpperCase() === 'WIN') ||
    params.result === 1 ||
    params.result === 1.0;

  const flags: ContextualEventFlag[] = [];

  if (!isWin) {
    if (params.userShieldsRemaining === 2) {
      flags.push('⚠️ Double Shield Pocket');
    } else if (params.userShieldsRemaining === 1) {
      flags.push('⚠️ Shield in Pocket');
    }
  } else {
    if (params.userFaints === 0) {
      flags.push('🧹 Clean Sweep');
    }
    if (
      typeof params.userShieldsRemaining === 'number' &&
      typeof params.oppShieldsRemaining === 'number' &&
      params.userShieldsRemaining > params.oppShieldsRemaining
    ) {
      flags.push('🛡️ Shield Advantage');
    }
  }

  if (params.isUnrevealedThird) {
    flags.push('⚡ 75% Conf');
  }

  return flags;
}

/**
 * Core Mathematical Pipeline:
 * Evaluates Battle Quality & Wins Above Expected (WAE) for a logged GBL match,
 * combining Phase 1 Blind Matchup Favorability (BMF / P_pre),
 * Phase 2 Dynamic Execution WAE Engine (P_exec & Delta_Q_final), and
 * Phase 3 Primary Performance Badges (derived from P_pre) & Contextual Event Flags.
 *
 * Returns `null` if `oppTeam.firstSwap` is null/missing (incomplete match, weight = 0).
 */
export function calculateBattleQuality(
  myTeam: string[] | BattleQualityTeamInput,
  oppTeam: string[] | BattleQualityTeamInput,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[],
  result: 'WIN' | 'LOSS' | number = 'WIN',
  timelineEvents?: BattleTimelineEvent[] | null,
  execOptions?: Omit<DynamicExecutionWAEOptions, 'ratingsDb' | 'metaPool'>
): BattleQualityMetadata | null {
  const bmfResult = calculateBlindMatchupFavorability(myTeam, oppTeam, league, ratingsDb, metaPool);
  if (
    bmfResult.bmf === null ||
    bmfResult.pPre === null ||
    bmfResult.bmfPercentage === null ||
    bmfResult.sLead === null ||
    bmfResult.sBack === null ||
    bmfResult.compositeM === null ||
    bmfResult.weight <= 0
  ) {
    return null;
  }

  const execRes = calculateDynamicExecutionWAE(myTeam, oppTeam, league, result, timelineEvents, {
    ...execOptions,
    ratingsDb,
    metaPool
  });

  if (!execRes) {
    return null;
  }

  const pWin = execRes.pExec;
  // Phase 3: Primary Performance Badges are derived from P_pre (BMF)
  const { badgeLabel, badgeColor } = getBadgeCategorization(bmfResult.pPre, result);

  const hasTimeline = Array.isArray(timelineEvents) && timelineEvents.length > 0;
  const hasExplicitFaints = typeof execOptions?.userFaints === 'number';
  const hasExplicitShields =
    typeof execOptions?.userShieldsRemaining === 'number' ||
    typeof execOptions?.oppShieldsRemaining === 'number';

  const contextualFlags = computeContextualEventFlags({
    result,
    userShieldsRemaining: hasTimeline || hasExplicitShields ? execRes.userShieldsRemaining : null,
    oppShieldsRemaining: hasTimeline || hasExplicitShields ? execRes.oppShieldsRemaining : null,
    userFaints: hasTimeline || hasExplicitFaints ? execRes.userFaints : null,
    isUnrevealedThird: bmfResult.isUnrevealedThird
  });

  return {
    sLead: bmfResult.sLead,
    sBack: bmfResult.sBack,
    compositeM: bmfResult.compositeM,
    bmfScore: bmfResult.pPre,
    pPre: bmfResult.pPre,
    bmfPercentage: bmfResult.bmfPercentage,
    sActual: execRes.sActual,
    pExec: execRes.pExec,
    execWae: execRes.execWae,
    pWin,
    deltaQ: execRes.execWae,
    weight: bmfResult.weight,
    weightedResidual: execRes.weightedResidual,
    badgeLabel,
    badgeColor,
    badges: [badgeLabel],
    contextualFlags,
    flags: contextualFlags,
    isUnrevealedThird: bmfResult.isUnrevealedThird,
    faintMarginScaled: execRes.faintMarginScaled,
    shieldPenaltyApplied: execRes.shieldPenaltyApplied,
    userFaints: execRes.userFaints,
    oppFaints: execRes.oppFaints,
    userShieldsRemaining: execRes.userShieldsRemaining,
    oppShieldsRemaining: execRes.oppShieldsRemaining
  };
}

/**
 * Resolves a logged match's BattleQualityMetadata, using cached `entry.quality` if present
 * or computing it on-the-fly from `userPokemon` / `presets`, `opponents`, and `timelineEvents`.
 */
export function resolveLogEntryQuality(
  entry: {
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS' | string;
    quality?: BattleQualityMetadata | null;
    timelineEvents?: BattleTimelineEvent[] | null;
    battleDurationSec?: number | null;
    userFaints?: number | null;
    oppFaints?: number | null;
    userShieldsRemaining?: number | null;
    oppShieldsRemaining?: number | null;
  },
  presets: TeamPreset[] = [],
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[]
): BattleQualityMetadata | null {
  if (entry.quality !== undefined) {
    if (entry.quality === null) return null;
    const numericResult = entry.result === 'WIN' ? 1.0 : 0.0;
    const wasCachedWin = entry.quality.deltaQ >= 0;
    const isNowWin = numericResult === 1.0;
    const hasPhase3Flags = Array.isArray(entry.quality.contextualFlags);
    if (wasCachedWin !== isNowWin || !hasPhase3Flags) {
      let myMonsForToggle = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
      if (myMonsForToggle.length < 3) {
        const matchedPreset = presets.find(
          (p) =>
            (entry.presetId && p.id === entry.presetId) ||
            (entry.userTeamName && p.name.toLowerCase() === entry.userTeamName.toLowerCase())
        );
        if (matchedPreset && matchedPreset.pokemon.length > 0) {
          myMonsForToggle = matchedPreset.pokemon.map((p) => p.name);
        }
      }
      if (myMonsForToggle.length > 0 && (entry.opponents || []).length >= 2) {
        const hasTimeline = Array.isArray(entry.timelineEvents) && entry.timelineEvents.length > 0;
        return calculateBattleQuality(
          myMonsForToggle,
          entry.opponents || [],
          entry.league,
          ratingsDb,
          metaPool,
          entry.result === 'LOSS' ? 'LOSS' : 'WIN',
          entry.timelineEvents,
          {
            totalDurationSec: entry.battleDurationSec,
            userFaints: entry.userFaints ?? (hasTimeline ? entry.quality.userFaints : null),
            oppFaints: entry.oppFaints ?? (hasTimeline ? entry.quality.oppFaints : null),
            userShieldsRemaining:
              entry.userShieldsRemaining ?? (hasTimeline ? entry.quality.userShieldsRemaining : null),
            oppShieldsRemaining:
              entry.oppShieldsRemaining ?? (hasTimeline ? entry.quality.oppShieldsRemaining : null)
          }
        );
      }
    }
    return entry.quality;
  }

  let myMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
  if (myMons.length < 3) {
    const matchedPreset = presets.find(
      (p) =>
        (entry.presetId && p.id === entry.presetId) ||
        (entry.userTeamName && p.name.toLowerCase() === entry.userTeamName.toLowerCase())
    );
    if (matchedPreset && matchedPreset.pokemon.length > 0) {
      myMons = matchedPreset.pokemon.map((p) => p.name);
    }
  }
  if (myMons.length === 0) {
    const normLeague = normalizeLeagueKey(entry.league);
    myMons = (PVPOKE_TOP_OPPONENTS[normLeague] || PVPOKE_TOP_OPPONENTS['GREAT LEAGUE'])
      .slice(0, 3)
      .map((p) => p.name);
  }

  return calculateBattleQuality(
    myMons,
    entry.opponents || [],
    entry.league,
    ratingsDb,
    metaPool,
    entry.result === 'LOSS' ? 'LOSS' : 'WIN',
    entry.timelineEvents,
    {
      totalDurationSec: entry.battleDurationSec,
      userFaints: entry.userFaints,
      oppFaints: entry.oppFaints,
      userShieldsRemaining: entry.userShieldsRemaining,
      oppShieldsRemaining: entry.oppShieldsRemaining
    }
  );
}

/**
 * Computes Aggregate Execution WAE (`execWae`) and Aggregate Matchup Luck (`pPre` / BMF)
 * across a filtered list of battle logs:
 *   EXEC WAE     = ( sum(w_i * Delta_Q_final,i) / sum(w_i) ) * 100%  (signed +XX.X%)
 *   MATCHUP LUCK = ( sum(w_i * P_pre,i) / sum(w_i) ) * 100%          (unsigned XX.X%)
 */
export function calculateAggregateWAE(
  entries: Array<{
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS' | string;
    quality?: BattleQualityMetadata | null;
    timelineEvents?: BattleTimelineEvent[] | null;
    battleDurationSec?: number | null;
    userFaints?: number | null;
    oppFaints?: number | null;
    userShieldsRemaining?: number | null;
    oppShieldsRemaining?: number | null;
  }>,
  presets: TeamPreset[] = []
): {
  waePct: number | null;
  formatted: string;
  luckPct: number | null;
  luckFormatted: string;
  totalWeight: number;
  rankedCount: number;
} {
  let weightedWaeSum = 0.0;
  let weightedLuckSum = 0.0;
  let totalWeight = 0.0;
  let rankedCount = 0;

  for (const entry of entries) {
    const q = resolveLogEntryQuality(entry, presets);
    if (!q || q.weight <= 0) continue;
    const delta = typeof q.execWae === 'number' ? q.execWae : q.deltaQ;
    const bmf = typeof q.pPre === 'number' ? q.pPre : q.pWin;
    weightedWaeSum += q.weight * delta;
    weightedLuckSum += q.weight * bmf;
    totalWeight += q.weight;
    rankedCount++;
  }

  if (totalWeight <= 0) {
    return {
      waePct: null,
      formatted: '—%',
      luckPct: null,
      luckFormatted: '—%',
      totalWeight: 0,
      rankedCount: 0
    };
  }

  const waePct = (weightedWaeSum / totalWeight) * 100.0;
  const luckPct = (weightedLuckSum / totalWeight) * 100.0;
  const sign = waePct >= 0 ? '+' : '';
  return {
    waePct,
    formatted: `${sign}${waePct.toFixed(1)}%`,
    luckPct,
    luckFormatted: `${luckPct.toFixed(1)}%`,
    totalWeight,
    rankedCount
  };
}

/**
 * Helper to compute Aggregate Matchup Luck (weighted average BMF / P_pre) directly.
 */
export function calculateAggregateMatchupLuck(
  entries: Parameters<typeof calculateAggregateWAE>[0],
  presets: TeamPreset[] = []
): {
  luckPct: number | null;
  formatted: string;
  totalWeight: number;
  rankedCount: number;
} {
  const res = calculateAggregateWAE(entries, presets);
  return {
    luckPct: res.luckPct,
    formatted: res.luckFormatted,
    totalWeight: res.totalWeight,
    rankedCount: res.rankedCount
  };
}

/**
 * Phase 3 Retroactive Data Migration (`migrateExistingBattleLogs()`):
 * - Processes existing logged battles:
 *   - If `oppTeam.firstSwap` is missing, marks as unranked (`bmfScore: null`, `execWae: null`, `quality: null`).
 *   - If team data exists, calculates BMF ($P_{\text{pre}}$), Dynamic Execution WAE ($\Delta Q_{\text{final}}$),
 *     and attaches applicable primary performance badges and contextual event flags.
 *   - Persists updated records back to storage without data loss.
 */
export function migrateExistingBattleLogs<
  T extends {
    id: string;
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS';
    bmfScore?: number | null;
    execWae?: number | null;
    badges?: string[];
    flags?: string[];
    quality?: BattleQualityMetadata | null;
    timelineEvents?: BattleTimelineEvent[] | null;
    battleDurationSec?: number | null;
    userFaints?: number | null;
    oppFaints?: number | null;
    userShieldsRemaining?: number | null;
    oppShieldsRemaining?: number | null;
  }
>(logs: T[], presets: TeamPreset[] = [], storageKey: string = 'gbl_battle_logs_v1'): { logs: T[]; didMigrate: boolean } {
  let didMigrate = false;
  const migrated = logs.map((entry): T => {
    const opps = (entry.opponents || []).map((o) => o.trim()).filter(Boolean);
    const isMissingFirstSwap = opps.length < 2;

    const alreadyMigratedUnranked =
      isMissingFirstSwap &&
      entry.quality === null &&
      entry.bmfScore === null &&
      entry.execWae === null &&
      Array.isArray(entry.badges) &&
      Array.isArray(entry.flags);

    const alreadyMigratedRanked =
      !isMissingFirstSwap &&
      entry.quality !== undefined &&
      entry.quality !== null &&
      typeof entry.bmfScore === 'number' &&
      typeof entry.execWae === 'number' &&
      Array.isArray(entry.badges) &&
      Array.isArray(entry.flags) &&
      Array.isArray(entry.quality.contextualFlags);

    if (alreadyMigratedUnranked || alreadyMigratedRanked) {
      return entry;
    }

    didMigrate = true;
    if (isMissingFirstSwap) {
      return {
        ...entry,
        bmfScore: null,
        execWae: null,
        badges: [],
        flags: [],
        quality: null
      };
    }

    const computedQuality = resolveLogEntryQuality(
      { ...entry, opponents: opps, quality: undefined },
      presets
    );
    return {
      ...entry,
      bmfScore: computedQuality ? computedQuality.pPre : null,
      execWae: computedQuality ? computedQuality.execWae : null,
      badges: computedQuality ? [computedQuality.badgeLabel] : [],
      flags: computedQuality ? computedQuality.contextualFlags : [],
      quality: computedQuality
    };
  });

  if (didMigrate && storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(migrated));
    } catch {}
  }

  return { logs: migrated, didMigrate };
}

/**
 * Re-evaluates all completed battle logs from scratch using the latest damage multipliers
 * and recalculates Lead Matchup (FAVORABLE / NEUTRAL / NEGATIVE), BMF (P_pre),
 * Dynamic Execution WAE (Delta_Q_final), Primary Performance Badges, and Contextual Flags.
 */
export function reparseAllCompletedBattleLogs<
  T extends {
    id: string;
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS';
    leadMatchup?: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE';
    bmfScore?: number | null;
    execWae?: number | null;
    badges?: string[];
    flags?: string[];
    quality?: BattleQualityMetadata | null;
    timelineEvents?: BattleTimelineEvent[] | null;
    battleDurationSec?: number | null;
    userFaints?: number | null;
    oppFaints?: number | null;
    userShieldsRemaining?: number | null;
    oppShieldsRemaining?: number | null;
    updatedAt?: number;
  }
>(logs: T[], presets: TeamPreset[] = [], storageKey: string = 'gbl_battle_logs_v1'): T[] {
  const now = Date.now();
  const reparsed = logs.map((entry): T => {
    const matchedPreset = presets.find(
      (p) =>
        (entry.presetId && p.id === entry.presetId) ||
        (entry.userTeamName && p.name.toLowerCase() === entry.userTeamName.toLowerCase())
    );
    let myMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
    if (myMons.length < 3 && matchedPreset && matchedPreset.pokemon.length > 0) {
      myMons = matchedPreset.pokemon.map((p) => p.name);
    }
    const opps = (entry.opponents || []).map((o) => o.trim()).filter(Boolean);
    const updatedLead =
      myMons.length > 0 && opps.length > 0
        ? calculateAutoLeadMatchup(myMons[0], opps[0], entry.league)
        : entry.leadMatchup || 'NEUTRAL';

    const freshQuality =
      opps.length < 2
        ? null
        : resolveLogEntryQuality(
            { ...entry, userPokemon: myMons, opponents: opps, quality: undefined },
            presets
          );

    return {
      ...entry,
      userPokemon: myMons.length > 0 ? myMons : entry.userPokemon,
      leadMatchup: updatedLead,
      bmfScore: freshQuality ? freshQuality.pPre : null,
      execWae: freshQuality ? freshQuality.execWae : null,
      badges: freshQuality ? [freshQuality.badgeLabel] : [],
      flags: freshQuality ? freshQuality.contextualFlags : [],
      quality: freshQuality,
      updatedAt: now
    };
  });

  if (storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reparsed));
    } catch {}
  }
  return reparsed;
}


