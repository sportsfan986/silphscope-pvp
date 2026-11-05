import React from 'react';
import { BarChart2 } from 'lucide-react';
import {
  type AppCombatMode,
  type LeagueType,
  normalizeLeagueName,
  getLeagueCpCap,
  computeBlendedSeasonMeta
} from '../data/gblData';
import type { WebBattleLogEntry, GblSeasonInfo } from './AppThemeAndModels';

export interface MetaTabProps {
  appCombatMode: AppCombatMode;
  metaTabShow6League: LeagueType;
  setMetaTabShow6League: React.Dispatch<React.SetStateAction<LeagueType>>;
  metaTabGblLeague: LeagueType;
  setMetaTabGblLeague: React.Dispatch<React.SetStateAction<LeagueType>>;
  enabledShow6Leagues: LeagueType[];
  enabledGblLeagues: LeagueType[];
  limitedStdBlendPctGbl: number;
  setLimitedStdBlendPctGbl: React.Dispatch<React.SetStateAction<number>>;
  limitedStdDecayGbl: 0.03 | 0.06 | 0.10;
  setLimitedStdDecayGbl: React.Dispatch<React.SetStateAction<0.03 | 0.06 | 0.10>>;
  battleLogs: WebBattleLogEntry[];
  activeSeasonBounds: GblSeasonInfo;
  metaTabScope: 'season' | 'last25' | 'last50';
  setMetaTabScope: React.Dispatch<React.SetStateAction<'season' | 'last25' | 'last50'>>;
  show6RecencyDecay: 0.02 | 0.04 | 0.07;
  setShow6RecencyDecay: React.Dispatch<React.SetStateAction<0.02 | 0.04 | 0.07>>;
  gblRecencyDecay: 0.02 | 0.04 | 0.07;
  setGblRecencyDecay: React.Dispatch<React.SetStateAction<0.02 | 0.04 | 0.07>>;
  isMetaSettingsOpen: boolean;
  setIsMetaSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  show6UsageWeightPct: number;
  handleChangeShow6UsageWeightPct: (val: number) => void;
  gblLogWeightCapPct: number;
  setGblLogWeightCapPct: React.Dispatch<React.SetStateAction<number>>;
}

export function MetaTab(props: MetaTabProps) {
  const {
    appCombatMode,
    metaTabShow6League,
    setMetaTabShow6League,
    metaTabGblLeague,
    setMetaTabGblLeague,
    enabledShow6Leagues,
    enabledGblLeagues,
    limitedStdBlendPctGbl,
    setLimitedStdBlendPctGbl,
    limitedStdDecayGbl,
    setLimitedStdDecayGbl,
    battleLogs,
    activeSeasonBounds,
    metaTabScope,
    setMetaTabScope,
    show6RecencyDecay,
    setShow6RecencyDecay,
    gblRecencyDecay,
    setGblRecencyDecay,
    isMetaSettingsOpen,
    setIsMetaSettingsOpen,
    show6UsageWeightPct,
    handleChangeShow6UsageWeightPct,
    gblLogWeightCapPct,
    setGblLogWeightCapPct
  } = props;
          const activeMetaLg = appCombatMode === 'show6' ? metaTabShow6League : metaTabGblLeague;
          const setActiveMetaLg = (lg: LeagueType) => {
            if (appCombatMode === 'show6') {
              setMetaTabShow6League(lg);
              try {
                localStorage.setItem('gbl_meta_tab_league_show6', lg);
              } catch {}
            } else {
              setMetaTabGblLeague(lg);
              try {
                localStorage.setItem('gbl_meta_tab_league_gbl', lg);
              } catch {}
            }
          };
          const availableMetaLeagues = appCombatMode === 'show6' ? enabledShow6Leagues : enabledGblLeagues;
          const isLimitedCup =
            appCombatMode !== 'show6' &&
            !['GREAT LEAGUE', 'ULTRA LEAGUE', 'MASTER LEAGUE'].includes(normalizeLeagueName(activeMetaLg));
          const cpCap = getLeagueCpCap(activeMetaLg);
          const sameCpStdLeague = cpCap <= 1500 ? 'GREAT LEAGUE' : cpCap <= 2500 ? 'ULTRA LEAGUE' : 'MASTER LEAGUE';
          const activeStdBlendPct = limitedStdBlendPctGbl;
          const activeStdDecay = limitedStdDecayGbl;

          const seasonLogsForLg = battleLogs.filter(
            (b) =>
              b.timestampMs >= activeSeasonBounds.startMs &&
              b.timestampMs <= activeSeasonBounds.endMs &&
              (!b.league || normalizeLeagueName(b.league) === normalizeLeagueName(activeMetaLg))
          );
          const scopedLogs =
            metaTabScope === 'last25'
              ? seasonLogsForLg.slice(0, 25)
              : metaTabScope === 'last50'
              ? seasonLogsForLg.slice(0, 50)
              : seasonLogsForLg;

          const blendedDist = computeBlendedSeasonMeta(
            activeMetaLg,
            metaTabScope === 'season' ? battleLogs : scopedLogs,
            activeSeasonBounds
          );
          const blendedMetaList = Array.from(blendedDist.fieldProbabilities.entries())
            .map(([name, weight]) => ({ name, weight }))
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 25);

          // Derive Top Personalized Meta Cores (2-Pokemon Synergistic Pairs) from logs + blended meta
          const pairMap = new Map<string, { monA: string; monB: string; count: number; wins: number; score: number }>();
          scopedLogs.forEach((b, idx) => {
            const opps = Array.from(new Set((b.opponents || []).filter(Boolean)));
            const decayW = Math.exp(-(appCombatMode === 'show6' ? show6RecencyDecay : gblRecencyDecay) * idx);
            for (let i = 0; i < opps.length; i++) {
              for (let j = i + 1; j < opps.length; j++) {
                const [mA, mB] = [opps[i], opps[j]].sort();
                const key = `${mA}|||${mB}`;
                const prev = pairMap.get(key) || { monA: mA, monB: mB, count: 0, wins: 0, score: 0 };
                prev.count += 1;
                if (b.result === 'LOSS') prev.wins += 1;
                prev.score += decayW * 12;
                pairMap.set(key, prev);
              }
            }
          });
          // Seed from top blended meta pairs so Current Season always displays rich cores even with few logs
          if (metaTabScope === 'season' && blendedMetaList.length >= 6) {
            for (let i = 0; i < Math.min(8, blendedMetaList.length); i++) {
              for (let j = i + 1; j < Math.min(9, blendedMetaList.length); j++) {
                const [mA, mB] = [blendedMetaList[i].name, blendedMetaList[j].name].sort();
                const key = `${mA}|||${mB}`;
                const prev = pairMap.get(key) || { monA: mA, monB: mB, count: 0, wins: 0, score: 0 };
                prev.score += (blendedMetaList[i].weight + blendedMetaList[j].weight) * 180;
                pairMap.set(key, prev);
              }
            }
          }
          const topCores = Array.from(pairMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 12);

          return (
            <div className="max-w-5xl mx-auto space-y-5">
              {/* Header & Mode-Independent League + Scope Bar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-sky-400" />
                      <span>
                        📊 Personalized Meta &amp; Top Cores ({appCombatMode === 'show6' ? 'Show 6 Mode' : 'GBL Blind 3 Mode'})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-300 text-[10px] font-mono">
                        v6.12
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <strong>Current Season</strong> drives both the Team Builder and Live AI Backline Predictor. Switch to <strong>Last 25</strong> or <strong>Last 50</strong> for personal micro-meta inspection.
                    </p>
                  </div>

                  {/* Collapsible Meta Settings Toggle Button (Default Collapsed on Open) */}
                  <button
                    type="button"
                    onClick={() => setIsMetaSettingsOpen((prev) => !prev)}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-sky-500/40 text-sky-300 text-xs font-extrabold transition shrink-0 flex items-center gap-1.5"
                  >
                    <span>{isMetaSettingsOpen ? '▼' : '▶'}</span>
                    <span>⚙️ Meta Tuning, Limited Cups &amp; Sheet Importer</span>
                  </button>
                </div>

                {/* Filter Controls: Mode-Independent League Dropdown + Scope Pills */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-300">
                      {appCombatMode === 'show6' ? '🏛️ Show 6 Format:' : '🛡️ GBL Format:'}
                    </span>
                    <select
                      value={activeMetaLg}
                      onChange={(e) => setActiveMetaLg(e.target.value as LeagueType)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
                    >
                      {availableMetaLeagues.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                    {appCombatMode !== 'show6' && (
                      <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-400/40 text-purple-200 text-[10.5px] font-mono">
                        🔗 Limited Cup Same-CP Start Fade: {activeStdBlendPct}% {sameCpStdLeague} • Decay λ={activeStdDecay} ({activeStdDecay === 0.10 ? 'Fast' : activeStdDecay === 0.06 ? 'Std' : 'Slow'})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMetaTabScope('season')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        metaTabScope === 'season'
                          ? 'bg-sky-500 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🌐 Current Season (AI &amp; Builder)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetaTabScope('last25')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        metaTabScope === 'last25'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🔬 Last 25
                    </button>
                    <button
                      type="button"
                      onClick={() => setMetaTabScope('last50')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        metaTabScope === 'last50'
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🔬 Last 50
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsible Meta Tuning Drawer (Default Collapsed so Meta Cores & Pokemon are immediately visible) */}
              {isMetaSettingsOpen && (
                <div className="bg-slate-900 border border-sky-500/40 rounded-2xl p-5 shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-extrabold text-sky-300">
                        ⚙️ Mode-Independent Meta Weighting &amp; GBL Blind 3 Limited Cup Standard-League Blend
                      </h3>
                      <p className="text-xs text-slate-400">
                        Tune how heavily Battle Logs, PvPoke Rankings, GBL Blind 3 Same-CP Standard League Logs, and Show 6 Spreadsheets weight into your Current Season meta.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Mode-Specific Log Cap & Recency Decay */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">
                          {appCombatMode === 'show6'
                            ? `🏛️ Show 6 Sheet Weight: ${show6UsageWeightPct}%`
                            : `🛡️ GBL Max Battle Log Weight Cap: ${gblLogWeightCapPct}%`}
                        </span>
                        <span className="text-[10px] font-mono text-sky-400">
                          {appCombatMode === 'show6' ? 'Sheet vs PvPoke' : `PvPoke Floor: ${100 - gblLogWeightCapPct}%`}
                        </span>
                      </div>
                      {appCombatMode === 'show6' ? (
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={show6UsageWeightPct}
                          onChange={(e) => handleChangeShow6UsageWeightPct(Number(e.target.value))}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      ) : (
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={gblLogWeightCapPct}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setGblLogWeightCapPct(v);
                            try {
                              localStorage.setItem('gbl_meta_log_weight_cap_pct', String(v));
                            } catch {}
                          }}
                          className="w-full accent-sky-400 cursor-pointer"
                        />
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-slate-300">Recent vs. Old Battle Decay:</span>
                        <div className="flex items-center gap-1">
                          {([0.02, 0.04, 0.07] as const).map((lam) => {
                            const curLam = appCombatMode === 'show6' ? show6RecencyDecay : gblRecencyDecay;
                            return (
                              <button
                                key={lam}
                                type="button"
                                onClick={() => {
                                  if (appCombatMode === 'show6') {
                                    setShow6RecencyDecay(lam);
                                    try {
                                      localStorage.setItem('gbl_show6_recency_decay_lambda', String(lam));
                                    } catch {}
                                  } else {
                                    setGblRecencyDecay(lam);
                                    try {
                                      localStorage.setItem('gbl_meta_recency_decay_lambda', String(lam));
                                    } catch {}
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  curLam === lam
                                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {lam === 0.02 ? 'Slow (0.02)' : lam === 0.04 ? 'Std (0.04)' : 'Fast (0.07)'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* GBL Blind 3 Only: Limited Cup Same-CP Standard League Blending (Default 50% Start Fade & Fast 0.10 Decay) */}
                    {appCombatMode !== 'show6' ? (
                      <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-purple-300">
                            🏆 GBL Blind 3: Limited Cup Same-CP Std Blend ({activeStdBlendPct}% Start Fade)
                          </span>
                          <span className="text-[10px] font-mono text-purple-200">
                            GBL3 Def: 50% Start / Fast
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Gives you a head start in GBL Limited Cups (e.g., Halloween Cup or Mega Great vs. regular <strong>{sameCpStdLeague}</strong>) by blending eligible species from your Standard League logs starting at <strong>{activeStdBlendPct}%</strong> (at 0 cup battles) and fading out as cup logs accumulate.
                        </p>
                        <input
                          type="range"
                          min={0}
                          max={75}
                          step={5}
                          value={activeStdBlendPct}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setLimitedStdBlendPctGbl(v);
                            try {
                              localStorage.setItem('gbl_limited_std_blend_pct_gbl_v601', String(v));
                            } catch {}
                          }}
                          className="w-full accent-purple-400 cursor-pointer"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-slate-300">Standard League Blend Fade-Out Speed:</span>
                          <div className="flex items-center gap-1">
                            {([0.03, 0.06, 0.10] as const).map((kVal) => (
                              <button
                                key={kVal}
                                type="button"
                                onClick={() => {
                                  setLimitedStdDecayGbl(kVal);
                                  try {
                                    localStorage.setItem('gbl_limited_std_decay_gbl_v601', String(kVal));
                                  } catch {}
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                                  activeStdDecay === kVal
                                    ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {kVal === 0.03 ? 'Slow (0.03)' : kVal === 0.06 ? 'Std (0.06)' : 'Fast (0.10 Def)'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-amber-300">
                            🏛️ Show 6 Battle Frontier Usage &amp; Cores Blend
                          </span>
                          <span className="text-[10px] font-mono text-amber-200">
                            {show6UsageWeightPct}% Sheet / {100 - show6UsageWeightPct}% PvPoke
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Show 6 mode blends your Show 6 battle logs with imported Battle Frontier Google Spreadsheet Usage &amp; Most-Used Cores. (Limited Cup Same-CP Standard League Blend is a GBL Blind 3 setting.)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Side-by-Side: Top Personalized Meta Cores & Top Personalized Meta Pokémon */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left 5 Cols: Top Personalized Meta Cores */}
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-300">
                        🔥 Top Personalized Meta Cores ({activeMetaLg})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {metaTabScope === 'season'
                          ? 'Drives Live AI Backline Prediction & Team Builder Core Breakers'
                          : `Empirical Opponent Pairs in ${metaTabScope === 'last25' ? 'Last 25' : 'Last 50'} Battles`}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200">
                      {topCores.length} Cores
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {topCores.map((core, idx) => (
                      <div
                        key={`${core.monA}-${core.monB}`}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-amber-400">#{idx + 1}</span>
                          <span className="font-extrabold text-white truncate">
                            {core.monA} + {core.monB}
                          </span>
                        </div>
                        <span className="text-[10.5px] font-mono text-sky-300 shrink-0">
                          {core.count > 0 ? `Seen ${core.count}×` : 'Blended Core'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right 7 Cols: Top Personalized Meta Pokémon */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <h3 className="text-sm font-extrabold text-sky-300">
                        👑 Top Personalized Meta Pokémon ({activeMetaLg})
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Ranked by {metaTabScope === 'season' ? 'Current Season Blended Meta Share (Logs + Same-CP Std + PvPoke)' : 'Empirical Appearance Frequency'}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-sky-200">
                      {scopedLogs.length} Logged Battles
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[520px] overflow-y-auto pr-1">
                    {blendedMetaList.map((entry, idx) => (
                      <div
                        key={entry.name}
                        className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-sky-400">#{idx + 1}</span>
                          <span className="font-extrabold text-white truncate">{entry.name}</span>
                        </div>
                        <span className="text-[10.5px] font-mono text-emerald-300 shrink-0">
                          {(entry.weight * 100).toFixed(1)}% Share
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
}
