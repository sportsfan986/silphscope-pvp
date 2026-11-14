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
  formatSpeciesDisplayName,
  getAvailableMovePoolForPokemon,
  getLeagueCpCap,
  getPokemonAutocompleteSuggestions,
  getPresetIvSpread,
  getRecommendedMovesForPokemon,
  normalizeLeagueName,
  PINNED_RANK1_CANDIDATE_ID,
  runMultiIvMatrixEvaluation,
  teamMemberToBuiltPokemon,
  type IvCandidateConfig,
  type IvCandidateLeagueResult,
  type OppIvBaselineMode,
  type OppMetaPoolMode,
  type ShieldScenarioKey
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

type OppTableFilterMode =
  | "ALL"
  | "FLIPS"
  | "BREAKPOINTS"
  | "BULKPOINTS"
  | "CMP"
  | "SURVIVAL";

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
  const [oppFilter, setOppFilter] = useState<OppTableFilterMode>("ALL");
  const [oppSearch, setOppSearch] = useState<string>("");
  const [shieldFocus, setShieldFocus] = useState<ShieldScenarioKey>("1v1");

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
                lgMatrix.candidateResults.find((r) => !r.isPinnedRank1) ||
                lgMatrix.candidateResults[0];

              const filteredOpps = (inspected?.opponents || []).filter((opp) => {
                const q = oppSearch.trim().toLowerCase();
                if (q && !opp.oppName.toLowerCase().includes(q)) return false;
                if (oppFilter === "FLIPS") {
                  return (
                    opp.flip0v0 !== "NONE" ||
                    opp.flip1v1 !== "NONE" ||
                    opp.flip2v2 !== "NONE"
                  );
                }
                if (oppFilter === "BREAKPOINTS") return opp.fastBreakpointDelta !== 0;
                if (oppFilter === "BULKPOINTS") return opp.fastBulkpointDelta !== 0;
                if (oppFilter === "CMP") return opp.cmpFlip !== "NONE";
                if (oppFilter === "SURVIVAL") {
                  return opp.survivesExtraChargedCycle || opp.losesExtraChargedCycle;
                }
                return true;
              });

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
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-200">
                                ⚔️ +{res.cmpFlipsGainedCount}/-{res.cmpFlipsLostCount} CMP
                              </span>
                              {res.extraCycleSurvivedCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">
                                  💪 +{res.extraCycleSurvivedCount} Cycle
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Opponent-by-Opponent Matchup Flip & Breakpoint Table */}
                  {inspected && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-800">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-cyan-300">
                            Inspecting: {inspected.label} ({inspected.ivs}) vs. {lgMatrix.baselineLabel}
                          </span>
                          {(["0v0", "1v1", "2v2"] as const).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setShieldFocus(s)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                shieldFocus === s
                                  ? "border-cyan-400 bg-cyan-500/25 text-white"
                                  : "border-slate-700 bg-slate-950 text-slate-400"
                              }`}
                            >
                              {s} Focus
                            </button>
                          ))}
                        </div>

                        <div className="relative w-full md:w-56">
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

                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            { id: "ALL", label: `All (${inspected.opponents.length})` },
                            { id: "FLIPS", label: "🔄 Matchup Flips" },
                            { id: "BREAKPOINTS", label: "⚡ Fast Breakpoints (+1)" },
                            { id: "BULKPOINTS", label: "🛡️ Fast Bulkpoints (-1)" },
                            { id: "CMP", label: "⚔️ CMP Tie Flips" },
                            { id: "SURVIVAL", label: "💪 Extra Cycle Survival" }
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setOppFilter(tab.id)}
                            className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold transition ${
                              oppFilter === tab.id
                                ? "border-cyan-400/70 bg-cyan-500/20 text-cyan-100"
                                : "border-slate-700 bg-slate-950 text-slate-400 hover:text-white"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-800">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-950 text-slate-400 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="px-2.5 py-2">Opponent</th>
                              <th className="px-2 py-2 text-center">{shieldFocus} BR (vs Base)</th>
                              <th className="px-2 py-2 text-center">Flip</th>
                              <th className="px-2 py-2 text-center">Fast Dealt</th>
                              <th className="px-2 py-2 text-center">Fast Taken</th>
                              <th className="px-2 py-2 text-center">CMP</th>
                              <th className="px-2 py-2 text-center">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {filteredOpps.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-3 py-4 text-center text-xs text-slate-400"
                                >
                                  No opponents match this filter. Try switching filter or compare against a different spread.
                                </td>
                              </tr>
                            ) : (
                              filteredOpps.map((opp) => {
                                const curBr =
                                  shieldFocus === "0v0"
                                    ? opp.br0v0
                                    : shieldFocus === "1v1"
                                    ? opp.br1v1
                                    : opp.br2v2;
                                const baseBr =
                                  shieldFocus === "0v0"
                                    ? opp.baselineBr0v0
                                    : shieldFocus === "1v1"
                                    ? opp.baselineBr1v1
                                    : opp.baselineBr2v2;
                                const curFlip =
                                  shieldFocus === "0v0"
                                    ? opp.flip0v0
                                    : shieldFocus === "1v1"
                                    ? opp.flip1v1
                                    : opp.flip2v2;
                                const anyFlip =
                                  curFlip !== "NONE"
                                    ? curFlip
                                    : opp.flip1v1 !== "NONE"
                                    ? opp.flip1v1
                                    : opp.flip0v0 !== "NONE"
                                    ? opp.flip0v0
                                    : opp.flip2v2;

                                return (
                                  <tr
                                    key={opp.oppName}
                                    className="hover:bg-slate-800/40 transition-colors"
                                  >
                                    <td className="px-2.5 py-1.5">
                                      <div className="font-bold text-white">{opp.oppName}</div>
                                      <div className="text-[9.5px] font-mono text-slate-400">
                                        {opp.oppIvs} • CP {opp.oppCp}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono">
                                      <span
                                        className={`font-bold ${
                                          curBr > 500
                                            ? "text-emerald-300"
                                            : curBr < 500
                                            ? "text-rose-300"
                                            : "text-amber-300"
                                        }`}
                                      >
                                        {curBr}
                                      </span>
                                      <span className="text-slate-500 text-[10px]">
                                        {" "}
                                        / {baseBr}
                                      </span>
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono font-bold">
                                      {anyFlip === "L->W" ? (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                                          L → W
                                        </span>
                                      ) : anyFlip === "W->L" ? (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/40">
                                          W → L
                                        </span>
                                      ) : (
                                        <span className="text-slate-600">—</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono">
                                      <span className="text-white font-bold">
                                        {opp.fastDmgDealt}
                                      </span>
                                      {opp.fastBreakpointDelta !== 0 && (
                                        <span
                                          className={`ml-1 px-1 rounded text-[9.5px] font-bold ${
                                            opp.fastBreakpointDelta > 0
                                              ? "bg-amber-500/25 text-amber-200"
                                              : "bg-rose-500/25 text-rose-200"
                                          }`}
                                        >
                                          {opp.fastBreakpointDelta > 0
                                            ? `+${opp.fastBreakpointDelta}⚡`
                                            : `${opp.fastBreakpointDelta}`}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono">
                                      <span className="text-white font-bold">
                                        {opp.fastDmgTaken}
                                      </span>
                                      {opp.fastBulkpointDelta !== 0 && (
                                        <span
                                          className={`ml-1 px-1 rounded text-[9.5px] font-bold ${
                                            opp.fastBulkpointDelta > 0
                                              ? "bg-sky-500/25 text-sky-200"
                                              : "bg-rose-500/25 text-rose-200"
                                          }`}
                                        >
                                          {opp.fastBulkpointDelta > 0
                                            ? `-${opp.fastBulkpointDelta}🛡️`
                                            : `+${Math.abs(opp.fastBulkpointDelta)}`}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono text-[10px]">
                                      <span
                                        className={`font-bold ${
                                          opp.cmpStatus === "WIN"
                                            ? "text-emerald-300"
                                            : opp.cmpStatus === "LOSS"
                                            ? "text-rose-300"
                                            : "text-amber-300"
                                        }`}
                                      >
                                        {opp.cmpStatus}
                                      </span>
                                      {opp.cmpFlip !== "NONE" && (
                                        <span
                                          className={`block text-[9px] font-bold ${
                                            opp.cmpFlip === "GAINED"
                                              ? "text-purple-300"
                                              : "text-rose-400"
                                          }`}
                                        >
                                          {opp.cmpFlip === "GAINED" ? "↑ FLIP" : "↓ LOST"}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-center text-[10px]">
                                      {opp.survivesExtraChargedCycle && (
                                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                                          💪 +Cycle
                                        </span>
                                      )}
                                      {opp.losesExtraChargedCycle && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                          -Cycle
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
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
