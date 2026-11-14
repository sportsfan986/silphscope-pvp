import React, { useMemo, useState } from "react";
import {
  Scale,
  Plus,
  Trash2,
  Trophy,
  Search,
  Lock,
  Edit3,
  CheckCircle2
} from "lucide-react";
import {
  type AppCombatMode,
  type BuiltPokemonEntry,
  type LeagueType,
  type PokemonAutocompleteOption,
  type TeamMember,
  cleanSpeciesNameWithoutShadow,
  evaluateIvSpreadDetails,
  findPokemonByName,
  formatFlipCode,
  formatSpeciesDisplayName,
  getAvailableMovePoolForPokemon,
  getLeagueCpCap,
  getOpponentShieldFlips,
  getOpponentTierOutliers,
  getPokemonAutocompleteSuggestions,
  getPresetIvSpread,
  getRecommendedMovesForPokemon,
  getStoredMatchupTierThresholds,
  normalizeLeagueName,
  PINNED_RANK1_CANDIDATE_ID,
  REALISTIC_7_SHIELD_KEYS,
  runMultiIvMatrixEvaluation,
  teamMemberToBuiltPokemon,
  type IvCandidateConfig,
  type IvCandidateLeagueResult,
  type IvScenarioFlipDetail,
  type IvScenarioOutlierDetail,
  type OppIvBaselineMode,
  type OppMetaPoolMode,
  type ShieldScopeMode
} from "../data/gblData";
import type { GblSeasonInfo, WebBattleLogEntry } from "./AppThemeAndModels";
import { IvTripletInput, type IvTripletChangePayload } from "./IvTripletInput";

export interface IvLabTabProps {
  appCombatMode: AppCombatMode;
  enabledGblLeagues: LeagueType[];
  enabledShow6Leagues: LeagueType[];
  battleLogs: WebBattleLogEntry[];
  activeSeasonBounds: GblSeasonInfo;
  webMembershipTier: "free" | "supporter" | "pro" | "vip";
  onOpenMembershipModal: () => void;
  builtPokemonRoster: BuiltPokemonEntry[];
  onSaveBuiltPokemon: (entry: BuiltPokemonEntry) => void;
  onDeleteBuiltPokemon: (id: string) => void;
}

type BreakdownCategory = "BP_BULK" | "FLIPS" | "OUTLIERS" | "CMP";
type OutlierDeltaThreshold = 35 | 40 | 50 | 75;

const OPEN_CORE_LEAGUES = new Set([
  "GREAT LEAGUE",
  "ULTRA LEAGUE",
  "MASTER LEAGUE"
]);

function makeDefaultCandidates(speciesName: string, league: string): IvCandidateConfig[] {
  const { cleanName, isShadow } = cleanSpeciesNameWithoutShadow(speciesName);
  const pvpDef = getPresetIvSpread(cleanName, league, "PVPOKE_DEFAULT", false);
  const maxAtk = getPresetIvSpread(cleanName, league, "MAX_ATK", false);
  const rec = getRecommendedMovesForPokemon(
    formatSpeciesDisplayName(cleanName, isShadow),
    league,
    pvpDef?.ivs,
    false
  );
  return [
    {
      id: "cand-1",
      label: "Candidate #1 (PvPoke Default)",
      speciesName: cleanName,
      isShadow,
      atkIv: pvpDef?.atkIv ?? 4,
      defIv: pvpDef?.defIv ?? 14,
      staIv: pvpDef?.staIv ?? 15,
      isBestBuddy: false,
      fastMove: rec?.fastMove,
      chargedMove1: rec?.chargedMove1,
      chargedMove2: rec?.chargedMove2
    },
    {
      id: "cand-2",
      label: "Candidate #2 (Attack Weight)",
      speciesName: cleanName,
      isShadow,
      atkIv: maxAtk?.atkIv ?? 12,
      defIv: maxAtk?.defIv ?? 10,
      staIv: maxAtk?.staIv ?? 10,
      isBestBuddy: false,
      fastMove: rec?.fastMove,
      chargedMove1: rec?.chargedMove1,
      chargedMove2: rec?.chargedMove2
    }
  ];
}

export function IvLabTab({
  appCombatMode,
  enabledGblLeagues,
  enabledShow6Leagues,
  battleLogs,
  activeSeasonBounds,
  webMembershipTier,
  onOpenMembershipModal,
  builtPokemonRoster,
  onSaveBuiltPokemon,
  onDeleteBuiltPokemon
}: IvLabTabProps) {
  const isProOrVip = webMembershipTier === "pro" || webMembershipTier === "vip";
  const isFree = webMembershipTier === "free";

  const [subTab, setSubTab] = useState<"matrix" | "built">("matrix");

  // =========================================================================
  // SUB-TAB 1: MULTI-IV MATRIX STATE
  // =========================================================================
  const [speciesQuery, setSpeciesQuery] = useState<string>("Feraligatr");
  const [committedSpecies, setCommittedSpecies] = useState<string>("Feraligatr");
  const [showSpeciesSuggestions, setShowSpeciesSuggestions] = useState<boolean>(false);

  const [selectedLeagues, setSelectedLeagues] = useState<LeagueType[]>(["GREAT LEAGUE"]);
  const [oppMetaPool, setOppMetaPool] = useState<OppMetaPoolMode>("PVPOKE_TOP_100");
  const [oppIvBaseline, setOppIvBaseline] = useState<OppIvBaselineMode>("PVPOKE_DEFAULT");
  const [baselineComparisonId, setBaselineComparisonId] = useState<string>(
    PINNED_RANK1_CANDIDATE_ID
  );

  const [candidates, setCandidates] = useState<IvCandidateConfig[]>(() =>
    makeDefaultCandidates("Feraligatr", "GREAT LEAGUE")
  );
  const [savedNoticeId, setSavedNoticeId] = useState<string | null>(null);

  // Per-result inspection filters
  const [inspectedCandidateId, setInspectedCandidateId] = useState<string>("cand-1");
  const [breakdownCategory, setBreakdownCategory] = useState<BreakdownCategory>("BP_BULK");
  const [shieldScopeMode, setShieldScopeMode] = useState<ShieldScopeMode>("REALISTIC_7");
  const [outlierMinDelta, setOutlierMinDelta] = useState<OutlierDeltaThreshold>(40);
  const [oppSearch, setOppSearch] = useState<string>("");
  const [expandedFlipOppKey, setExpandedFlipOppKey] = useState<string | null>(null);
  const tierThresholds = useMemo(() => getStoredMatchupTierThresholds(), []);

  const primaryLeague = selectedLeagues[0] || "GREAT LEAGUE";

  const availableLeaguesList = useMemo(() => {
    const raw =
      appCombatMode === "show6" ? enabledShow6Leagues : enabledGblLeagues;
    const merged = Array.from(
      new Set<LeagueType>([
        "GREAT LEAGUE",
        "ULTRA LEAGUE",
        "MASTER LEAGUE",
        ...(raw || [])
      ])
    );
    return merged;
  }, [appCombatMode, enabledGblLeagues, enabledShow6Leagues]);

  const speciesSuggestions = useMemo<PokemonAutocompleteOption[]>(() => {
    if (!showSpeciesSuggestions) return [];
    return getPokemonAutocompleteSuggestions(speciesQuery, primaryLeague, 16);
  }, [showSpeciesSuggestions, speciesQuery, primaryLeague]);

  const movePool = useMemo(() => {
    const display = formatSpeciesDisplayName(
      committedSpecies,
      candidates[0]?.isShadow ?? false
    );
    return getAvailableMovePoolForPokemon(display, primaryLeague);
  }, [committedSpecies, candidates, primaryLeague]);

  const selectSpeciesForMatrix = (rawName: string) => {
    const { cleanName, isShadow } = cleanSpeciesNameWithoutShadow(rawName);
    const hit = findPokemonByName(cleanName);
    const canonical = hit?.name || cleanName;
    if (!canonical) return;

    setSpeciesQuery(canonical);
    setCommittedSpecies(canonical);
    setShowSpeciesSuggestions(false);
    setBaselineComparisonId(PINNED_RANK1_CANDIDATE_ID);

    const nextCands = makeDefaultCandidates(
      formatSpeciesDisplayName(canonical, isShadow),
      primaryLeague
    );
    // Auto-inject matching Built Pokemon specimens into Candidate #1 if owned
    const matchingBuilt = builtPokemonRoster.filter(
      (b) =>
        b.speciesName.toLowerCase() === canonical.toLowerCase() &&
        b.cpCap === getLeagueCpCap(primaryLeague)
    );
    if (matchingBuilt.length > 0) {
      const b0 = matchingBuilt[0];
      nextCands[0] = {
        id: "cand-1",
        label: b0.label || `Built (${b0.ivs})`,
        speciesName: b0.speciesName,
        isShadow: b0.isShadow,
        atkIv: b0.atkIv,
        defIv: b0.defIv,
        staIv: b0.staIv,
        isBestBuddy: b0.isBestBuddy,
        fastMove: b0.fastMove,
        chargedMove1: b0.chargedMove1,
        chargedMove2: b0.chargedMove2
      };
    }
    setCandidates(nextCands);
    setInspectedCandidateId(nextCands[0].id);
  };

  const toggleLeagueSelection = (lg: LeagueType) => {
    const norm = normalizeLeagueName(lg);
    const isLimitedOrCup = !OPEN_CORE_LEAGUES.has(norm);
    if (isLimitedOrCup && isFree) {
      onOpenMembershipModal();
      return;
    }
    setSelectedLeagues((prev) => {
      const exists = prev.some((p) => normalizeLeagueName(p) === norm);
      if (exists) {
        if (prev.length <= 1) return prev; // Keep at least 1 league
        return prev.filter((p) => normalizeLeagueName(p) !== norm);
      }
      return [...prev, lg];
    });
  };

  const handleAddCandidate = () => {
    const idx = candidates.length + 1;
    const hundo = getPresetIvSpread(committedSpecies, primaryLeague, "PVPOKE_DEFAULT", false);
    const rec = getRecommendedMovesForPokemon(committedSpecies, primaryLeague);
    const newId = `cand-${Date.now().toString(36)}`;
    setCandidates((prev) => [
      ...prev,
      {
        id: newId,
        label: `Candidate #${idx}`,
        speciesName: committedSpecies,
        isShadow: prev[0]?.isShadow ?? false,
        atkIv: hundo?.atkIv ?? 4,
        defIv: hundo?.defIv ?? 14,
        staIv: hundo?.staIv ?? 15,
        isBestBuddy: false,
        fastMove: prev[0]?.fastMove || rec?.fastMove,
        chargedMove1: prev[0]?.chargedMove1 || rec?.chargedMove1,
        chargedMove2: prev[0]?.chargedMove2 || rec?.chargedMove2
      }
    ]);
  };

  const handleLoadBuiltIntoMatrix = (entry: BuiltPokemonEntry) => {
    const isSameSpecies =
      entry.speciesName.toLowerCase() === committedSpecies.toLowerCase();
    const newId = `cand-built-${entry.id.slice(0, 8)}-${Date.now().toString(36).slice(-3)}`;
    if (!isSameSpecies) {
      setSpeciesQuery(entry.speciesName);
      setCommittedSpecies(entry.speciesName);
      const matchingLg = availableLeaguesList.find(
        (l) => getLeagueCpCap(l) === entry.cpCap
      );
      if (matchingLg) setSelectedLeagues([matchingLg]);
      setCandidates([
        {
          id: newId,
          label: entry.label || `📦 ${entry.ivs}`,
          speciesName: entry.speciesName,
          isShadow: entry.isShadow,
          atkIv: entry.atkIv,
          defIv: entry.defIv,
          staIv: entry.staIv,
          isBestBuddy: entry.isBestBuddy,
          fastMove: entry.fastMove,
          chargedMove1: entry.chargedMove1,
          chargedMove2: entry.chargedMove2,
          plusMoveLevel: entry.plusMoveLevel
        }
      ]);
      setInspectedCandidateId(newId);
      setBaselineComparisonId(PINNED_RANK1_CANDIDATE_ID);
    } else {
      setCandidates((prev) => [
        ...prev,
        {
          id: newId,
          label: entry.label || `📦 ${entry.ivs}`,
          speciesName: entry.speciesName,
          isShadow: entry.isShadow,
          atkIv: entry.atkIv,
          defIv: entry.defIv,
          staIv: entry.staIv,
          isBestBuddy: entry.isBestBuddy,
          fastMove: entry.fastMove,
          chargedMove1: entry.chargedMove1,
          chargedMove2: entry.chargedMove2,
          plusMoveLevel: entry.plusMoveLevel
        }
      ]);
      setInspectedCandidateId(newId);
    }
    setSubTab("matrix");
  };

  const handleSaveCandidateToBuilt = (
    cand: IvCandidateConfig | IvCandidateLeagueResult,
    targetLeague: string
  ) => {
    const isRes = "candidateId" in cand;
    const speciesName = cand.speciesName;
    const isShadow = cand.isShadow;
    const atkIv = cand.atkIv;
    const defIv = cand.defIv;
    const staIv = cand.staIv;
    const isBestBuddy = cand.isBestBuddy;
    const member: TeamMember = {
      id: "save-tmp",
      name: formatSpeciesDisplayName(speciesName, isShadow),
      cp: isRes ? cand.cp : evaluateIvSpreadDetails(speciesName, atkIv, defIv, staIv, targetLeague, isBestBuddy)?.cp ?? 1500,
      ivs: `${atkIv}/${defIv}/${staIv}`,
      isBestBuddy,
      fastMove: cand.fastMove || "",
      chargedMove1: cand.chargedMove1 || "",
      chargedMove2: cand.chargedMove2 || ""
    };
    const labelText = isRes
      ? cand.isPinnedRank1
        ? "Rank #1"
        : cand.label
      : cand.label;
    const built = teamMemberToBuiltPokemon(
      member,
      targetLeague,
      labelText.startsWith("Candidate #") ? undefined : labelText
    );
    if (!built) return;
    onSaveBuiltPokemon(built);
    const notifyKey = isRes ? `${cand.candidateId}_${targetLeague}` : cand.id;
    setSavedNoticeId(notifyKey);
    setTimeout(() => {
      setSavedNoticeId((prev) => (prev === notifyKey ? null : prev));
    }, 2000);
  };

  const matrixResult = useMemo(() => {
    const valid = findPokemonByName(committedSpecies);
    if (!valid) return null;
    return runMultiIvMatrixEvaluation({
      speciesName: valid.name,
      leagues: selectedLeagues,
      candidates,
      oppMetaPool,
      oppIvBaseline,
      baselineComparisonId,
      rank1IsShadow: candidates[0]?.isShadow ?? false,
      seasonBattleLogs: battleLogs,
      currentSeason: activeSeasonBounds,
      maxOpponents: 100
    });
  }, [
    committedSpecies,
    selectedLeagues,
    candidates,
    oppMetaPool,
    oppIvBaseline,
    baselineComparisonId,
    battleLogs,
    activeSeasonBounds
  ]);

  // =========================================================================
  // SUB-TAB 2: BUILT POKÉMON ROSTER STATE
  // =========================================================================
  const [builtEditingId, setBuiltEditingId] = useState<string | null>(null);
  const [builtSpeciesInput, setBuiltSpeciesInput] = useState<string>("Azumarill");
  const [showBuiltSuggestions, setShowBuiltSuggestions] = useState<boolean>(false);
  const [builtIsShadow, setBuiltIsShadow] = useState<boolean>(false);
  const [builtLeague, setBuiltLeague] = useState<LeagueType>("GREAT LEAGUE");
  const [builtIvs, setBuiltIvs] = useState<string>("0/15/15");
  const [builtIsBb, setBuiltIsBb] = useState<boolean>(false);
  const [builtFastMove, setBuiltFastMove] = useState<string>("Bubble");
  const [builtC1Move, setBuiltC1Move] = useState<string>("Ice Beam");
  const [builtC2Move, setBuiltC2Move] = useState<string>("Play Rough");
  const [builtLabel, setBuiltLabel] = useState<string>("");
  const [builtSaveFlash, setBuiltSaveFlash] = useState<boolean>(false);

  const [rosterSearch, setRosterSearch] = useState<string>("");
  const [rosterLeagueFilter, setRosterLeagueFilter] = useState<string>("ALL");
  const [rosterShadowFilter, setRosterShadowFilter] = useState<"ALL" | "NORMAL" | "SHADOW">("ALL");

  const builtSuggestions = useMemo(() => {
    if (!showBuiltSuggestions) return [];
    return getPokemonAutocompleteSuggestions(builtSpeciesInput, builtLeague, 14);
  }, [showBuiltSuggestions, builtSpeciesInput, builtLeague]);

  const builtMovePool = useMemo(() => {
    return getAvailableMovePoolForPokemon(
      formatSpeciesDisplayName(builtSpeciesInput, builtIsShadow),
      builtLeague
    );
  }, [builtSpeciesInput, builtIsShadow, builtLeague]);

  const applyBuiltSpeciesChoice = (rawName: string) => {
    const { cleanName, isShadow } = cleanSpeciesNameWithoutShadow(rawName);
    const dbMon = findPokemonByName(cleanName);
    const canonical = dbMon?.name || cleanName;
    setBuiltSpeciesInput(canonical);
    setBuiltIsShadow(isShadow);
    setShowBuiltSuggestions(false);
    const rec = getRecommendedMovesForPokemon(
      formatSpeciesDisplayName(canonical, isShadow),
      builtLeague,
      undefined,
      builtIsBb
    );
    if (rec) {
      setBuiltIvs(rec.defaultIvs);
      setBuiltFastMove(rec.fastMove);
      setBuiltC1Move(rec.chargedMove1);
      setBuiltC2Move(rec.chargedMove2);
    }
  };

  const handleSubmitBuiltForm = (e: React.FormEvent) => {
    e.preventDefault();
    const { cleanName } = cleanSpeciesNameWithoutShadow(builtSpeciesInput);
    const dbMon = findPokemonByName(cleanName);
    const canonical = dbMon?.name || cleanName;
    if (!canonical) return;
    const member: TeamMember = {
      id: builtEditingId || "tmp",
      name: formatSpeciesDisplayName(canonical, builtIsShadow),
      cp: 1500,
      ivs: builtIvs,
      isBestBuddy: builtIsBb,
      fastMove: builtFastMove,
      chargedMove1: builtC1Move,
      chargedMove2: builtC2Move
    };
    const entry = teamMemberToBuiltPokemon(
      member,
      builtLeague,
      builtLabel,
      builtEditingId || undefined
    );
    if (!entry) return;
    onSaveBuiltPokemon(entry);
    setBuiltEditingId(null);
    setBuiltLabel("");
    setBuiltSaveFlash(true);
    setTimeout(() => setBuiltSaveFlash(false), 1800);
  };

  const startEditingBuiltEntry = (entry: BuiltPokemonEntry) => {
    setBuiltEditingId(entry.id);
    setBuiltSpeciesInput(entry.speciesName);
    setBuiltIsShadow(entry.isShadow);
    setBuiltLeague((normalizeLeagueName(entry.league) as LeagueType) || "GREAT LEAGUE");
    setBuiltIvs(entry.ivs);
    setBuiltIsBb(entry.isBestBuddy);
    setBuiltFastMove(entry.fastMove);
    setBuiltC1Move(entry.chargedMove1);
    setBuiltC2Move(entry.chargedMove2);
    setBuiltLabel(entry.label || "");
  };

  const filteredBuiltRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return [...builtPokemonRoster]
      .filter((item) => {
        if (rosterShadowFilter === "NORMAL" && item.isShadow) return false;
        if (rosterShadowFilter === "SHADOW" && !item.isShadow) return false;
        if (rosterLeagueFilter !== "ALL") {
          const cap = getLeagueCpCap(item.league);
          if (rosterLeagueFilter === "GL" && cap !== 1500) return false;
          if (rosterLeagueFilter === "UL" && cap !== 2500) return false;
          if (rosterLeagueFilter === "ML" && cap !== 10000) return false;
          if (rosterLeagueFilter === "LC" && cap !== 500) return false;
        }
        if (q) {
          const hay = `${item.speciesName} ${item.label || ""} ${item.ivs} ${item.fastMove} ${item.chargedMove1} ${item.chargedMove2}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [builtPokemonRoster, rosterSearch, rosterLeagueFilter, rosterShadowFilter]);

  const builtCountSameSpecies = useMemo(() => {
    return builtPokemonRoster.filter(
      (b) => b.speciesName.toLowerCase() === committedSpecies.toLowerCase()
    );
  }, [builtPokemonRoster, committedSpecies]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header + Sub-Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-cyan-400" />
            <span>⚖️ IV Lab — Multi-IV Matrix &amp; Built Roster</span>
          </h2>
          <p className="text-xs text-slate-400">
            Compare IV spreads head-to-head against <strong className="text-amber-300">🏆 Rank #1 Stat Product</strong> or any candidate across Breakpoints, Bulkpoints, CMP ties &amp; save your built Pokémon for 1-tap Team Builder linking &amp; D1 cloud sync.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab("matrix")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              subTab === "matrix"
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            ⚖️ Multi-IV Matrix
          </button>
          <button
            type="button"
            onClick={() => setSubTab("built")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              subTab === "built"
                ? "bg-indigo-500/20 text-indigo-200 border border-indigo-400/50"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📦 My Built Pokémon ({builtPokemonRoster.length})
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SUB-TAB 1: MULTI-IV MATRIX EVALUATOR                               */}
      {/* =================================================================== */}
      {subTab === "matrix" && (
        <div className="space-y-4">
          {/* Config Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Species Search */}
              <div className="lg:col-span-5 relative">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Target Species (Auto-Pins 🏆 Rank #1 Benchmark)
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={speciesQuery}
                      onFocus={() => setShowSpeciesSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSpeciesSuggestions(false), 180)}
                      onChange={(e) => {
                        setSpeciesQuery(e.target.value);
                        setShowSpeciesSuggestions(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (speciesSuggestions[0]) {
                            selectSpeciesForMatrix(speciesSuggestions[0].name);
                          } else {
                            selectSpeciesForMatrix(speciesQuery);
                          }
                        }
                      }}
                      placeholder="Search Pokémon (e.g. Azumarill, Feraligatr)..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:border-cyan-400 focus:outline-none"
                    />
                    {showSpeciesSuggestions && speciesSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-64 overflow-y-auto rounded-xl bg-slate-900 border border-cyan-500/40 shadow-2xl divide-y divide-slate-800">
                        {speciesSuggestions.map((opt) => (
                          <button
                            key={opt.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectSpeciesForMatrix(opt.name);
                            }}
                            className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs font-bold text-white">{opt.name}</span>
                            <span className="text-[10px] font-mono text-cyan-300">
                              CP {opt.cp} • {opt.formBadge}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => selectSpeciesForMatrix(speciesQuery)}
                    className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-3 py-2 text-xs font-bold text-white shrink-0"
                  >
                    Evaluate
                  </button>
                </div>

                {builtCountSameSpecies.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-indigo-300">
                      📦 Owned Built Copies:
                    </span>
                    {builtCountSameSpecies.slice(0, 4).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleLoadBuiltIntoMatrix(b)}
                        className="rounded border border-indigo-400/50 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-200 hover:bg-indigo-500/25"
                      >
                        + {b.isShadow ? "Shadow " : ""}
                        {b.ivs} ({b.cp} CP{b.label ? ` • ${b.label}` : ""})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Opponent Pool & IV Baseline */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Opponent Meta Pool
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOppMetaPool("PVPOKE_TOP_100")}
                      className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition ${
                        oppMetaPool === "PVPOKE_TOP_100"
                          ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                          : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      📊 PvPoke Top 100
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isProOrVip) {
                          onOpenMembershipModal();
                          return;
                        }
                        setOppMetaPool("BLENDED_ELO_META");
                      }}
                      className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                        oppMetaPool === "BLENDED_ELO_META"
                          ? "border-purple-400/70 bg-purple-500/20 text-purple-100"
                          : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                      }`}
                    >
                      {!isProOrVip && <Lock className="w-3 h-3 text-amber-400" />}
                      🎯 Blended ELO Meta
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Opponent IV Baseline
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: "RANK_1", label: "🏆 Rank #1" },
                        { id: "PVPOKE_DEFAULT", label: "📊 PvPoke Def" },
                        { id: "MAX_ATK", label: "⚔️ Max Atk" }
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setOppIvBaseline(opt.id)}
                        className={`px-2 py-2 rounded-xl border text-[10.5px] font-bold transition ${
                          oppIvBaseline === opt.id
                            ? "border-amber-400/70 bg-amber-500/20 text-amber-100"
                            : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Select Leagues */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Multi-Select Leagues to Evaluate (Run GL + UL + ML Side-by-Side)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableLeaguesList.map((lg) => {
                  const norm = normalizeLeagueName(lg);
                  const isActive = selectedLeagues.some(
                    (s) => normalizeLeagueName(s) === norm
                  );
                  const isCup = !OPEN_CORE_LEAGUES.has(norm);
                  const locked = isCup && isFree;
                  return (
                    <button
                      key={lg}
                      type="button"
                      onClick={() => toggleLeagueSelection(lg)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1 ${
                        isActive
                          ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                          : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {locked && <Lock className="w-3 h-3 text-amber-400" />}
                      <span>{isActive ? "✓ " : ""}{lg}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Candidate Spreads Builder */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-amber-300 flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" />
                    Pinned Benchmark: 🏆 Rank #1 Stat Product
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Auto-computed for every selected league so you always see how your IVs stack up against Rank #1 &amp; each other.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCandidate}
                  className="flex items-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-2.5 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Candidate IV Spread
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {candidates.map((cand, idx) => {
                  const updateCand = (patch: Partial<IvCandidateConfig>) => {
                    setCandidates((prev) =>
                      prev.map((c) => (c.id === cand.id ? { ...c, ...patch } : c))
                    );
                  };
                  const candIvs = `${cand.atkIv}/${cand.defIv}/${cand.staIv}`;
                  const matchingBuilt = builtPokemonRoster.filter(
                    (b) =>
                      b.speciesName.toLowerCase() === committedSpecies.toLowerCase() &&
                      b.isShadow === cand.isShadow &&
                      b.cpCap === getLeagueCpCap(primaryLeague)
                  );
                  return (
                    <div
                      key={cand.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/75 p-3 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                          <span className="text-[11px] font-mono font-bold text-cyan-300 shrink-0">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={cand.label}
                            onChange={(e) => updateCand({ label: e.target.value })}
                            placeholder={`Candidate #${idx + 1} Label`}
                            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCand({ isShadow: !cand.isShadow })}
                            className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition ${
                              cand.isShadow
                                ? "border-purple-400/70 bg-purple-500/25 text-purple-200"
                                : "border-slate-700 bg-slate-900 text-slate-400"
                            }`}
                          >
                            🟣 Shadow
                          </button>
                          {candidates.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCandidates((prev) => prev.filter((c) => c.id !== cand.id))
                              }
                              className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-1 text-rose-300 hover:bg-rose-500/20"
                              title="Remove candidate spread"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <IvTripletInput
                        speciesName={formatSpeciesDisplayName(committedSpecies, cand.isShadow)}
                        league={primaryLeague}
                        ivs={candIvs}
                        isBestBuddy={cand.isBestBuddy}
                        showBestBuddyToggle
                        showPresets
                        matchingBuilt={matchingBuilt}
                        onPickBuilt={(entry) =>
                          updateCand({
                            label: entry.label || cand.label,
                            isShadow: entry.isShadow,
                            atkIv: entry.atkIv,
                            defIv: entry.defIv,
                            staIv: entry.staIv,
                            isBestBuddy: entry.isBestBuddy,
                            fastMove: entry.fastMove || cand.fastMove,
                            chargedMove1: entry.chargedMove1 || cand.chargedMove1,
                            chargedMove2: entry.chargedMove2 || cand.chargedMove2
                          })
                        }
                        savedHighlight={savedNoticeId === cand.id}
                        onSaveToBuilt={() => handleSaveCandidateToBuilt(cand, primaryLeague)}
                        onChange={(next: IvTripletChangePayload) =>
                          updateCand({
                            atkIv: next.atkIv,
                            defIv: next.defIv,
                            staIv: next.staIv,
                            isBestBuddy: next.isBestBuddy
                          })
                        }
                      />

                      {/* Candidate Moveset */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <select
                          aria-label="Fast Move"
                          value={cand.fastMove || ""}
                          onChange={(e) => updateCand({ fastMove: e.target.value })}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none"
                        >
                          {movePool.fastMoves.map((fm) => (
                            <option key={fm.name} value={fm.name}>
                              {fm.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Charged Move 1"
                          value={cand.chargedMove1 || ""}
                          onChange={(e) => updateCand({ chargedMove1: e.target.value })}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none"
                        >
                          {movePool.chargedMoves.map((cm) => (
                            <option key={cm.name} value={cm.name}>
                              {cm.name}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Charged Move 2"
                          value={cand.chargedMove2 || ""}
                          onChange={(e) => updateCand({ chargedMove2: e.target.value })}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-slate-200 focus:outline-none"
                        >
                          {movePool.chargedMoves.map((cm) => (
                            <option key={cm.name} value={cm.name}>
                              {cm.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Matrix Results Per League */}
          {matrixResult &&
            matrixResult.leagues.map((lgMatrix) => {
              const inspected =
                lgMatrix.candidateResults.find(
                  (r) => r.candidateId === inspectedCandidateId
                ) ||
                lgMatrix.candidateResults.find(
                  (r) => r.candidateId !== lgMatrix.baselineComparisonId
                ) ||
                lgMatrix.candidateResults[0];

              const inspectedIsBase =
                Boolean(inspected) &&
                inspected.candidateId === lgMatrix.baselineComparisonId;

              const q = oppSearch.trim().toLowerCase();
              const searchedOpps = (inspected?.opponents || []).filter(
                (opp) => !q || opp.oppName.toLowerCase().includes(q)
              );

              const bpOpps = searchedOpps
                .filter((o) => o.fastBreakpointDelta !== 0)
                .sort(
                  (a, b) =>
                    b.fastBreakpointDelta - a.fastBreakpointDelta ||
                    a.oppName.localeCompare(b.oppName)
                );
              const bulkOpps = searchedOpps
                .filter((o) => o.fastBulkpointDelta !== 0)
                .sort(
                  (a, b) =>
                    b.fastBulkpointDelta - a.fastBulkpointDelta ||
                    a.oppName.localeCompare(b.oppName)
                );
              const bpBulkTotalCount = searchedOpps.filter(
                (o) => o.fastBreakpointDelta !== 0 || o.fastBulkpointDelta !== 0
              ).length;

              const flipRows: Array<{
                opp: (typeof searchedOpps)[number];
                flips: IvScenarioFlipDetail[];
                netScore: number;
                maxDelta: number;
              }> = searchedOpps
                .map((opp) => {
                  const flips = getOpponentShieldFlips(opp, shieldScopeMode);
                  const gains = flips.filter((f) => f.isGain).length;
                  const losses = flips.length - gains;
                  const maxDelta = flips.reduce(
                    (m, f) => Math.max(m, Math.abs(f.deltaBr)),
                    0
                  );
                  return { opp, flips, netScore: gains - losses, maxDelta };
                })
                .filter((item) => item.flips.length > 0)
                .sort(
                  (a, b) =>
                    b.netScore - a.netScore ||
                    b.maxDelta - a.maxDelta ||
                    a.opp.oppName.localeCompare(b.opp.oppName)
                );

              const outlierRows: Array<{
                opp: (typeof searchedOpps)[number];
                outliers: IvScenarioOutlierDetail[];
                maxAbsDelta: number;
              }> = searchedOpps
                .map((opp) => {
                  const outliers = getOpponentTierOutliers(
                    opp,
                    shieldScopeMode,
                    outlierMinDelta,
                    tierThresholds
                  );
                  const maxAbsDelta = outliers.reduce(
                    (m, o) => Math.max(m, Math.abs(o.deltaBr)),
                    0
                  );
                  return { opp, outliers, maxAbsDelta };
                })
                .filter((item) => item.outliers.length > 0)
                .sort(
                  (a, b) =>
                    b.maxAbsDelta - a.maxAbsDelta ||
                    a.opp.oppName.localeCompare(b.opp.oppName)
                );

              const cmpOpps = searchedOpps
                .filter((o) => o.cmpFlip !== "NONE")
                .sort((a, b) => {
                  if (a.cmpFlip !== b.cmpFlip) {
                    return a.cmpFlip === "GAINED" ? -1 : 1;
                  }
                  return a.oppName.localeCompare(b.oppName);
                });

              const effWMin = Math.max(502, tierThresholds.wMin);
              const effSwMin = Math.max(effWMin + 1, tierThresholds.swMin);
              const effLMax = Math.min(498, tierThresholds.lMax);
              const effSlMax = Math.min(effLMax - 1, tierThresholds.slMax);

              return (
                <div
                  key={lgMatrix.league}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl"
                >
                  {/* League Matrix Header & Baseline Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>{lgMatrix.league}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                          {lgMatrix.opponentCount} Meta Opponents • Opp IVs: {lgMatrix.oppIvBaseline}
                        </span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-400">
                        Compare vs.:
                      </span>
                      {lgMatrix.candidateResults.map((res) => (
                        <button
                          key={res.candidateId}
                          type="button"
                          onClick={() => setBaselineComparisonId(res.candidateId)}
                          className={`px-2 py-1 rounded-lg border text-[10.5px] font-bold transition ${
                            lgMatrix.baselineComparisonId === res.candidateId
                              ? "border-amber-400 bg-amber-500/20 text-amber-200"
                              : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                          }`}
                        >
                          {res.isPinnedRank1 ? "🏆 Rank #1" : res.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Side-by-Side Candidate Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {lgMatrix.candidateResults.map((res) => {
                      const isBase = res.candidateId === lgMatrix.baselineComparisonId;
                      const isInspected = res.candidateId === inspected?.candidateId;
                      const cardFlipGainOpps = isBase
                        ? 0
                        : res.opponents.filter((o) =>
                            getOpponentShieldFlips(o, shieldScopeMode).some((f) => f.isGain)
                          ).length;
                      const cardFlipLossOpps = isBase
                        ? 0
                        : res.opponents.filter((o) =>
                            getOpponentShieldFlips(o, shieldScopeMode).some((f) => !f.isGain)
                          ).length;
                      const cardOutlierCount = isBase
                        ? 0
                        : res.opponents.filter(
                            (o) =>
                              getOpponentTierOutliers(
                                o,
                                shieldScopeMode,
                                outlierMinDelta,
                                tierThresholds
                              ).length > 0
                          ).length;

                      return (
                        <div
                          key={res.candidateId}
                          onClick={() => setInspectedCandidateId(res.candidateId)}
                          className={`cursor-pointer rounded-xl border p-3 space-y-2 transition ${
                            isInspected
                              ? "border-cyan-400/80 bg-cyan-950/20 ring-1 ring-cyan-400/40"
                              : res.isPinnedRank1
                              ? "border-amber-500/50 bg-amber-950/15"
                              : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-extrabold text-white truncate">
                                  {res.label}
                                </span>
                                {isBase && (
                                  <span className="rounded bg-amber-500/25 border border-amber-400/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">
                                    BASELINE
                                  </span>
                                )}
                                {res.isBestBuddy && (
                                  <span className="rounded bg-pink-500/20 border border-pink-400/50 px-1.5 py-0.5 text-[9px] font-bold text-pink-200">
                                    🎀 Lv51
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
                                {res.ivs} • CP {res.cp} • Lv {res.level} • #{res.rank} ({res.pctOfRank1.toFixed(1)}%)
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Atk {res.effAtk.toFixed(1)} • Def {res.effDef.toFixed(1)} • HP {res.effHp}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveCandidateToBuilt(res, lgMatrix.league);
                              }}
                              className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold ${
                                savedNoticeId === `${res.candidateId}_${lgMatrix.league}`
                                  ? "border-emerald-400 bg-emerald-500/25 text-emerald-200"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                              }`}
                            >
                              {savedNoticeId === `${res.candidateId}_${lgMatrix.league}`
                                ? "✅ Saved"
                                : "💾 Save"}
                            </button>
                          </div>

                          {/* 0v0 / 1v1 / 2v2 Record Grid */}
                          <div className="grid grid-cols-3 gap-1.5 text-center">
                            {(["0v0", "1v1", "2v2"] as const).map((sc) => {
                              const rec = res.records[sc];
                              return (
                                <div
                                  key={sc}
                                  className="rounded-lg border border-slate-800 bg-slate-900/90 px-1.5 py-1"
                                >
                                  <div className="text-[9px] font-bold text-slate-400">
                                    {sc} Shields
                                  </div>
                                  <div className="text-[11px] font-mono font-extrabold text-white">
                                    {rec.wins}-{rec.losses}-{rec.ties}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-cyan-300">
                                    Avg BR {rec.avgBr}
                                    {lgMatrix.oppMetaPool === "BLENDED_ELO_META"
                                      ? ` (${rec.weightedWinPct}%)`
                                      : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Deltas & Highlight Counters */}
                          {!isBase && (
                            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800/80 text-[10px] font-mono font-bold">
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  res.deltaVsRank1.wins1v1 > 0
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : res.deltaVsRank1.wins1v1 < 0
                                    ? "bg-rose-500/20 text-rose-300"
                                    : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                vs R1: {res.deltaVsRank1.wins1v1 >= 0 ? "+" : ""}
                                {res.deltaVsRank1.wins1v1}W ({res.deltaVsRank1.br1v1 >= 0 ? "+" : ""}
                                {res.deltaVsRank1.br1v1} BR)
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-200">
                                🔄 +{cardFlipGainOpps}/-{cardFlipLossOpps}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  res.breakpointsGainedCount > 0
                                    ? "bg-amber-500/20 text-amber-200"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                ⚡ +{res.breakpointsGainedCount}/-{res.breakpointsLostCount} Brk
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  res.bulkpointsGainedCount > 0
                                    ? "bg-sky-500/20 text-sky-200"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                🛡️ +{res.bulkpointsGainedCount}/-{res.bulkpointsLostCount} Blk
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded ${
                                  cardOutlierCount > 0
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                ⚠️ {cardOutlierCount} Out
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-200">
                                ⚔️ +{res.cmpFlipsGainedCount}/-{res.cmpFlipsLostCount} CMP
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Opponent-by-Opponent Segmented Category Breakdown */}
                  {inspected && inspectedIsBase && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 px-3.5 py-3 text-xs text-amber-200">
                      📌 <strong className="text-white">{inspected.label}</strong> ({inspected.ivs}) is currently selected as the comparison baseline. Select another candidate card above or change <strong>Compare vs.</strong> to inspect Fast Breakpoints/Bulkpoints, 7-Shield Flips, Tier Outliers, and CMP changes.
                    </div>
                  )}

                  {inspected && !inspectedIsBase && (
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-cyan-300">
                            Inspecting: {inspected.label} ({inspected.ivs}) vs. {lgMatrix.baselineLabel}
                          </span>
                          {/* 2-Way Shield Scope Toggle */}
                          <div className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5">
                            <button
                              type="button"
                              onClick={() => setShieldScopeMode("REALISTIC_7")}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                shieldScopeMode === "REALISTIC_7"
                                  ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/50"
                                  : "text-slate-400 hover:text-white border border-transparent"
                              }`}
                            >
                              🎯 7 Realistic (Even + ±1🛡️)
                            </button>
                            <button
                              type="button"
                              onClick={() => setShieldScopeMode("EVEN_3")}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                shieldScopeMode === "EVEN_3"
                                  ? "bg-cyan-500/25 text-cyan-100 border border-cyan-400/50"
                                  : "text-slate-400 hover:text-white border border-transparent"
                              }`}
                            >
                              ⚖️ Even 3 (0v0/1v1/2v2)
                            </button>
                          </div>
                        </div>

                        <div className="relative w-full lg:w-56">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                          <input
                            type="text"
                            value={oppSearch}
                            onChange={(e) => setOppSearch(e.target.value)}
                            placeholder="Filter opponent..."
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-2.5 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* 4 Segmented Category Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            {
                              id: "BP_BULK",
                              label: `⚔️ Fast BP/Bulk (${bpBulkTotalCount})`
                            },
                            {
                              id: "FLIPS",
                              label: `🔄 Shield Flips (${flipRows.length})`
                            },
                            {
                              id: "OUTLIERS",
                              label: `⚠️ Tier Outliers (${outlierRows.length})`
                            },
                            {
                              id: "CMP",
                              label: `⚡ CMP (${cmpOpps.length})`
                            }
                          ] as const
                        ).map((cat) => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setBreakdownCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-lg border text-[11px] font-bold transition ${
                              breakdownCategory === cat.id
                                ? "border-cyan-400/80 bg-cyan-500/20 text-cyan-100 shadow-sm"
                                : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Category 1: Fast Breakpoints & Fast Bulkpoints */}
                      {breakdownCategory === "BP_BULK" && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          {/* Fast Move Breakpoints (Dealt) */}
                          <div className="rounded-xl border border-slate-800 bg-slate-950/75 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                              <span className="text-xs font-extrabold text-amber-200">
                                ⚔️ Fast Move Breakpoints (Damage Dealt)
                              </span>
                              <span className="text-[10.5px] font-mono font-bold text-slate-300">
                                +{bpOpps.filter((o) => o.fastBreakpointDelta > 0).length} / -
                                {bpOpps.filter((o) => o.fastBreakpointDelta < 0).length}
                              </span>
                            </div>
                            <div className="divide-y divide-slate-800/70 max-h-96 overflow-y-auto">
                              {bpOpps.length === 0 ? (
                                <div className="px-3 py-5 text-center text-xs text-slate-400">
                                  No Fast Move Breakpoint changes vs. {lgMatrix.baselineLabel}.
                                </div>
                              ) : (
                                bpOpps.map((opp) => {
                                  const gained = opp.fastBreakpointDelta > 0;
                                  return (
                                    <div
                                      key={`bp_${opp.oppName}`}
                                      className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-bold text-white truncate">
                                          {opp.oppName}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-400">
                                          Your {opp.fastMoveName}:{" "}
                                          <span className="text-slate-200 font-bold">
                                            {opp.baselineFastDmgDealt} → {opp.fastDmgDealt}
                                          </span>{" "}
                                          • 1v1 BR {opp.baselineBr1v1} → {opp.br1v1}
                                        </div>
                                      </div>
                                      <span
                                        className={`shrink-0 px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${
                                          gained
                                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                                            : "bg-rose-500/20 text-rose-300 border-rose-400/40"
                                        }`}
                                      >
                                        {gained
                                          ? `+${opp.fastBreakpointDelta} dmg ⚡`
                                          : `${opp.fastBreakpointDelta} dmg ⚠️`}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Fast Move Bulkpoints (Taken) */}
                          <div className="rounded-xl border border-slate-800 bg-slate-950/75 overflow-hidden">
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border-b border-slate-800">
                              <span className="text-xs font-extrabold text-sky-200">
                                🛡️ Fast Move Bulkpoints (Damage Taken)
                              </span>
                              <span className="text-[10.5px] font-mono font-bold text-slate-300">
                                +{bulkOpps.filter((o) => o.fastBulkpointDelta > 0).length} Gained / -
                                {bulkOpps.filter((o) => o.fastBulkpointDelta < 0).length} Lost
                              </span>
                            </div>
                            <div className="divide-y divide-slate-800/70 max-h-96 overflow-y-auto">
                              {bulkOpps.length === 0 ? (
                                <div className="px-3 py-5 text-center text-xs text-slate-400">
                                  No Fast Move Bulkpoint changes vs. {lgMatrix.baselineLabel}.
                                </div>
                              ) : (
                                bulkOpps.map((opp) => {
                                  const gainedBulk = opp.fastBulkpointDelta > 0;
                                  const deltaTakenSigned = opp.fastDmgTaken - opp.baselineFastDmgTaken;
                                  return (
                                    <div
                                      key={`blk_${opp.oppName}`}
                                      className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="min-w-0">
                                        <div className="font-bold text-white truncate">
                                          {opp.oppName}
                                          {opp.survivesExtraChargedCycle && (
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                              💪 +Cycle
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-400">
                                          Opp {opp.oppFastMoveName} taken:{" "}
                                          <span className="text-slate-200 font-bold">
                                            {opp.baselineFastDmgTaken} → {opp.fastDmgTaken}
                                          </span>{" "}
                                          • 1v1 BR {opp.baselineBr1v1} → {opp.br1v1}
                                        </div>
                                      </div>
                                      <span
                                        className={`shrink-0 px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${
                                          gainedBulk
                                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                                            : "bg-rose-500/20 text-rose-300 border-rose-400/40"
                                        }`}
                                      >
                                        {gainedBulk
                                          ? `${deltaTakenSigned} taken ✅`
                                          : `+${deltaTakenSigned} taken ⚠️`}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Category 2: Asymmetric Shielding Tree Win/Loss Flips */}
                      {breakdownCategory === "FLIPS" && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/75 overflow-hidden">
                          {flipRows.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400">
                              No Win/Loss outcome flips vs. {lgMatrix.baselineLabel} across{" "}
                              {shieldScopeMode === "REALISTIC_7"
                                ? "the 7 realistic shield scenarios (0v0, 1v1, 2v2, 1v0, 0v1, 2v1, 1v2)"
                                : "the 3 even shield scenarios (0v0, 1v1, 2v2)"}
                              .
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800/70">
                              {flipRows.map(({ opp, flips }) => {
                                const rowExpandKey = `${lgMatrix.league}|${inspected.candidateId}|${opp.oppName}`;
                                const isExpandedRow = expandedFlipOppKey === rowExpandKey;
                                return (
                                  <div
                                    key={`flip_${opp.oppName}`}
                                    onClick={() =>
                                      setExpandedFlipOppKey((prev) =>
                                        prev === rowExpandKey ? null : rowExpandKey
                                      )
                                    }
                                    className="px-3 py-2.5 hover:bg-slate-800/40 transition-colors cursor-pointer space-y-1.5"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div>
                                        <span className="text-xs font-extrabold text-white">
                                          {opp.oppName}
                                        </span>
                                        <span className="ml-2 text-[10px] font-mono text-slate-400">
                                          {opp.oppIvs} • CP {opp.oppCp} • tap to{" "}
                                          {isExpandedRow ? "hide" : "show"} full tree
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {flips.map((f) => (
                                          <span
                                            key={f.scenario}
                                            className={`px-2 py-0.5 rounded-md border text-[10.5px] font-mono font-bold ${
                                              f.isGain
                                                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                                                : "border-rose-400/50 bg-rose-500/20 text-rose-200"
                                            }`}
                                          >
                                            [{f.scenario}] {formatFlipCode(f.flipCode)}:{" "}
                                            {f.beforeBr} → {f.afterBr} (
                                            {f.deltaBr >= 0 ? "+" : ""}
                                            {f.deltaBr})
                                          </span>
                                        ))}
                                      </div>
                                    </div>

                                    {isExpandedRow && (
                                      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                                        {REALISTIC_7_SHIELD_KEYS.map((scKey) => {
                                          const bBr = opp.baselineBrByShield[scKey];
                                          const aBr = opp.brByShield[scKey];
                                          const scFlip = opp.flipsByShield[scKey];
                                          return (
                                            <div
                                              key={scKey}
                                              className={`rounded border px-1.5 py-1 text-center font-mono text-[10px] ${
                                                scFlip !== "NONE"
                                                  ? "border-cyan-400/60 bg-cyan-950/40"
                                                  : "border-slate-800 bg-slate-900/90"
                                              }`}
                                            >
                                              <div className="text-[9px] font-bold text-slate-400">
                                                {scKey}
                                              </div>
                                              <div
                                                className={`font-bold ${
                                                  aBr > 500
                                                    ? "text-emerald-300"
                                                    : aBr < 500
                                                    ? "text-rose-300"
                                                    : "text-amber-300"
                                                }`}
                                              >
                                                {bBr} → {aBr}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Category 3: Non-Flipping Tier Outliers */}
                      {breakdownCategory === "OUTLIERS" && (
                        <div className="space-y-2.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2">
                            <div className="text-[10.5px] text-slate-300">
                              Non-flipping matchups that cross a SilphScope sub-tier (
                              <span className="font-mono text-slate-400">
                                Strong W ≥{effSwMin} • Solid W ≥{effWMin} • Soft W 501–
                                {effWMin - 1} | Close L {effLMax + 1}–499 • Solid L{" "}
                                {effSlMax + 1}–{effLMax} • Strong L ≤{effSlMax}
                              </span>
                              )
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 mr-1">
                                Swing:
                              </span>
                              {([35, 40, 50, 75] as const).map((th) => (
                                <button
                                  key={th}
                                  type="button"
                                  onClick={() => setOutlierMinDelta(th)}
                                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition ${
                                    outlierMinDelta === th
                                      ? "border-amber-400 bg-amber-500/20 text-amber-200"
                                      : "border-slate-700 bg-slate-900 text-slate-400 hover:text-white"
                                  }`}
                                >
                                  ≥{th} BR
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-950/75 overflow-hidden">
                            {outlierRows.length === 0 ? (
                              <div className="px-4 py-6 text-center text-xs text-slate-400">
                                No non-flipping sub-tier crossings ≥ {outlierMinDelta} BR vs.{" "}
                                {lgMatrix.baselineLabel} in{" "}
                                {shieldScopeMode === "REALISTIC_7"
                                  ? "7 Realistic"
                                  : "Even 3"}{" "}
                                scenarios. Try ≥35 BR to widen detection.
                              </div>
                            ) : (
                              <div className="divide-y divide-slate-800/70">
                                {outlierRows.map(({ opp, outliers }) => (
                                  <div
                                    key={`out_${opp.oppName}`}
                                    className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                  >
                                    <div>
                                      <span className="text-xs font-extrabold text-white">
                                        {opp.oppName}
                                      </span>
                                      <span className="ml-2 text-[10px] font-mono text-slate-400">
                                        {opp.oppIvs} • CP {opp.oppCp}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {outliers.map((o) => (
                                        <span
                                          key={o.scenario}
                                          className={`px-2 py-0.5 rounded-md border text-[10.5px] font-mono font-bold ${
                                            o.isUpgrade
                                              ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                                              : "border-amber-400/50 bg-amber-500/15 text-amber-200"
                                          }`}
                                        >
                                          [{o.scenario}] {o.beforeTierLabel} →{" "}
                                          {o.afterTierLabel}: {o.beforeBr} → {o.afterBr} (
                                          {o.deltaBr >= 0 ? "+" : ""}
                                          {o.deltaBr} BR)
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Category 4: CMP Tie Flips */}
                      {breakdownCategory === "CMP" && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/75 overflow-hidden">
                          {cmpOpps.length === 0 ? (
                            <div className="px-4 py-6 text-center text-xs text-slate-400">
                              No Charge Move Priority (CMP) flips vs. {lgMatrix.baselineLabel}.
                            </div>
                          ) : (
                            <div className="divide-y divide-slate-800/70">
                              {cmpOpps.map((opp) => {
                                const gained = opp.cmpFlip === "GAINED";
                                return (
                                  <div
                                    key={`cmp_${opp.oppName}`}
                                    className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                                  >
                                    <div>
                                      <div className="font-bold text-white">
                                        {opp.oppName}
                                        <span className="ml-2 text-[10px] font-mono text-slate-400">
                                          {opp.oppIvs} • CP {opp.oppCp}
                                        </span>
                                      </div>
                                      <div className="text-[10px] font-mono text-slate-400">
                                        Effective Atk:{" "}
                                        <span className="text-slate-200 font-bold">
                                          {opp.baselineUserEffectiveAtk.toFixed(2)} →{" "}
                                          {opp.userEffectiveAtk.toFixed(2)}
                                        </span>{" "}
                                        vs Opp {opp.oppEffectiveAtk.toFixed(2)} • 1v1 BR{" "}
                                        {opp.baselineBr1v1} → {opp.br1v1}
                                      </div>
                                    </div>
                                    <span
                                      className={`shrink-0 px-2.5 py-0.5 rounded-md border font-mono font-bold text-[10.5px] ${
                                        gained
                                          ? "border-purple-400/50 bg-purple-500/20 text-purple-200"
                                          : "border-rose-400/50 bg-rose-500/20 text-rose-200"
                                      }`}
                                    >
                                      ⚡ CMP {opp.cmpFlip} ({opp.baselineCmpStatus} →{" "}
                                      {opp.cmpStatus})
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: MY BUILT POKÉMON ROSTER                                 */}
      {/* =================================================================== */}
      {subTab === "built" && (
        <div className="space-y-4">
          {/* Add / Edit Specimen Form */}
          <form
            onSubmit={handleSubmitBuiltForm}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                {builtEditingId ? (
                  <>
                    <Edit3 className="w-4 h-4 text-amber-400" />
                    <span>Edit Built Pokémon Specimen</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <span>Add Built Pokémon to Personal Vault Roster</span>
                  </>
                )}
              </h3>
              {builtSaveFlash && (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved &amp; Queued for D1 Cloud Sync!
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Species */}
              <div className="md:col-span-4 relative">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Species
                </label>
                <input
                  type="text"
                  value={builtSpeciesInput}
                  onFocus={() => setShowBuiltSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowBuiltSuggestions(false), 180)}
                  onChange={(e) => {
                    setBuiltSpeciesInput(e.target.value);
                    setShowBuiltSuggestions(true);
                  }}
                  placeholder="Pokémon name..."
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white focus:border-indigo-400 focus:outline-none"
                />
                {showBuiltSuggestions && builtSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-indigo-500/40 shadow-2xl divide-y divide-slate-800">
                    {builtSuggestions.map((opt) => (
                      <button
                        key={opt.name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyBuiltSpeciesChoice(opt.name);
                        }}
                        className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-bold text-white">{opt.name}</span>
                        <span className="text-[10px] font-mono text-indigo-300">
                          CP {opt.cp}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* League + Shadow */}
              <div className="md:col-span-4 flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    League
                  </label>
                  <select
                    value={builtLeague}
                    onChange={(e) => setBuiltLeague(e.target.value as LeagueType)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none"
                  >
                    {availableLeaguesList.map((lg) => (
                      <option key={lg} value={lg}>
                        {lg}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => setBuiltIsShadow((prev) => !prev)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                    builtIsShadow
                      ? "border-purple-400/70 bg-purple-500/25 text-purple-200"
                      : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  🟣 Shadow
                </button>
              </div>

              {/* Custom Multi-Copy Label */}
              <div className="md:col-span-4">
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Specimen Label (Multi-Copy Tag, Optional)
                </label>
                <input
                  type="text"
                  value={builtLabel}
                  onChange={(e) => setBuiltLabel(e.target.value)}
                  placeholder="e.g. Rank 1 • Shiny • Atk Weight"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>

            <IvTripletInput
              speciesName={formatSpeciesDisplayName(builtSpeciesInput, builtIsShadow)}
              league={builtLeague}
              ivs={builtIvs}
              isBestBuddy={builtIsBb}
              showBestBuddyToggle
              showPresets
              onChange={(next) => {
                setBuiltIvs(next.ivs);
                setBuiltIsBb(next.isBestBuddy);
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <select
                aria-label="Built Fast Move"
                value={builtFastMove}
                onChange={(e) => setBuiltFastMove(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                {builtMovePool.fastMoves.map((fm) => (
                  <option key={fm.name} value={fm.name}>
                    {fm.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Built Charged Move 1"
                value={builtC1Move}
                onChange={(e) => setBuiltC1Move(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                {builtMovePool.chargedMoves.map((cm) => (
                  <option key={cm.name} value={cm.name}>
                    {cm.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Built Charged Move 2"
                value={builtC2Move}
                onChange={(e) => setBuiltC2Move(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-white"
              >
                {builtMovePool.chargedMoves.map((cm) => (
                  <option key={cm.name} value={cm.name}>
                    {cm.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {builtEditingId ? "💾 Update Built Pokémon" : "📦 Save to Roster"}
                </button>
                {builtEditingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuiltEditingId(null);
                      setBuiltLabel("");
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["ALL", "GL", "UL", "ML", "LC"] as const).map((lgF) => (
                <button
                  key={lgF}
                  type="button"
                  onClick={() => setRosterLeagueFilter(lgF)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                    rosterLeagueFilter === lgF
                      ? "border-indigo-400 bg-indigo-500/25 text-indigo-100"
                      : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  {lgF === "ALL" ? "All Leagues" : lgF}
                </button>
              ))}
              {(["ALL", "NORMAL", "SHADOW"] as const).map((shF) => (
                <button
                  key={shF}
                  type="button"
                  onClick={() => setRosterShadowFilter(shF)}
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                    rosterShadowFilter === shF
                      ? "border-purple-400 bg-purple-500/20 text-purple-200"
                      : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  {shF === "ALL" ? "Any Form" : shF === "SHADOW" ? "🟣 Shadow" : "Non-Shadow"}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search built Pokémon..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 pl-8 pr-2.5 py-1 text-xs text-white focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Specimen Grid */}
          {filteredBuiltRoster.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-8 text-center text-xs text-slate-400">
              No saved Built Pokémon match your filter yet. Add your GL/UL/ML Pokémon above or click <strong className="text-emerald-300">💾 Save Built</strong> anywhere in IV Lab or Team Builder!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredBuiltRoster.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-3.5 space-y-2.5 shadow-lg"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-extrabold text-white truncate">
                          {formatSpeciesDisplayName(item.speciesName, item.isShadow)}
                        </span>
                        {item.isBestBuddy && (
                          <span className="rounded bg-pink-500/20 border border-pink-400/50 px-1.5 py-0.5 text-[9px] font-bold text-pink-200">
                            🎀 Lv51
                          </span>
                        )}
                        {item.label && (
                          <span className="rounded bg-indigo-500/20 border border-indigo-400/50 px-1.5 py-0.5 text-[9.5px] font-bold text-indigo-200">
                            {item.label}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300 mt-0.5">
                        {item.league} • CP {item.cp} • Lv {item.level}
                      </div>
                      <div className="text-[11px] font-mono text-slate-300">
                        IVs: <strong className="text-white">{item.ivs}</strong>
                        {item.statProductRank ? (
                          <span className="text-amber-300">
                            {" "}
                            • #{item.statProductRank}
                            {item.statProductPct ? ` (${item.statProductPct.toFixed(1)}%)` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="text-[10.5px] text-slate-400 font-mono truncate">
                    {item.fastMove} • {item.chargedMove1}
                    {item.chargedMove2 ? ` / ${item.chargedMove2}` : ""}
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleLoadBuiltIntoMatrix(item)}
                      className="flex-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10.5px] font-bold text-cyan-200 hover:bg-cyan-500/20"
                    >
                      ⚖️ Compare in IV Matrix
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingBuiltEntry(item)}
                      className="rounded-lg border border-slate-700 bg-slate-950 p-1.5 text-slate-300 hover:text-white"
                      title="Edit Built Specimen"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBuiltPokemon(item.id)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                      title="Delete from Built Roster"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
