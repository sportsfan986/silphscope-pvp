import React from 'react';
import { Info } from 'lucide-react';

export interface DocumentationModalsProps {
  showHelpMetricGuideModal: boolean;
  setShowHelpMetricGuideModal: React.Dispatch<React.SetStateAction<boolean>>;
  helpMetricGuideTopic: 'wae' | 'bmf' | 'badges';
  setHelpMetricGuideTopic: React.Dispatch<React.SetStateAction<'wae' | 'bmf' | 'badges'>>;
  showOverlayQuickHelpModal: boolean;
  setShowOverlayQuickHelpModal: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTab: (tab: 'simulator' | 'presets' | 'battle_log' | 'settings' | 'meta' | 'help' | 'math_validator') => void;
}

export function DocumentationModals({
  showHelpMetricGuideModal,
  setShowHelpMetricGuideModal,
  helpMetricGuideTopic,
  setHelpMetricGuideTopic,
  showOverlayQuickHelpModal,
  setShowOverlayQuickHelpModal,
  setActiveTab
}: DocumentationModalsProps) {
  return (
    <>
        {showHelpMetricGuideModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Info className="w-4 h-4 text-sky-400" />
                    <span>Help &amp; Metric Guide (v3.31 Analytics Reference)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    How SilphScope PvP separates micro-execution skill from matchmaking alignment RNG
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpMetricGuideModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              {/* Section Filter Tabs inside Modal */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('wae')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'wae'
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1. Execution WAE
                </button>
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('bmf')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'bmf'
                      ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2. Matchup Luck (BMF)
                </button>
                <button
                  type="button"
                  onClick={() => setHelpMetricGuideTopic('badges')}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    helpMetricGuideTopic === 'badges'
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3. Badge Glossary
                </button>
              </div>

              <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed text-slate-300">
                {/* SECTION 1: EXECUTION WAE */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    helpMetricGuideTopic === 'wae'
                      ? 'bg-slate-950 border-emerald-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-emerald-400">
                      1. Execution WAE (Wins Above Expected)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      Aggregate: Σ(w_i · ΔQ_final,i) / Σ(w_i)
                    </span>
                  </div>
                  <p>
                    <strong>Execution WAE</strong> isolates your in-battle micro-execution — <strong>energy farming</strong>,{' '}
                    <strong>fast move denial (sneak prevention)</strong>, <strong>sacrificial catch management</strong>,{' '}
                    <strong>CMP timing</strong>, and <strong>shield discipline</strong> — from blind 3v3 team-composition RNG.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
                    <div>
                      <span className="text-emerald-400 font-bold">Timeline Duration Weighting:</span> S_actual = Σ (τ_k · R_k) where τ_k = Δt_k / t_total
                    </div>
                    <div>
                      <span className="text-sky-400 font-bold">Asymmetric 9-Shield Matrix:</span> R_k = Rating_&#123;s_user v s_opp&#125;(userActive, oppActive) ∈ &#123;0v0 .. 2v2&#125;
                    </div>
                    <div>
                      <span className="text-amber-300 font-bold">Execution Win Probability:</span> P_exec = 1 / (1 + e^(-0.006 · (S_actual - 500)))
                    </div>
                    <div>
                      <span className="text-purple-300 font-bold">Base Residual &amp; Modifiers:</span> ΔQ_base = Result - P_exec (Win = 1.0, Loss = 0.0)
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Faint Margin Scaling (×1.10):</strong> When you win with a <code>≥ 2</code> Pokémon faint margin (e.g., 2-0 or 3-0 sweep), positive execution credit is scaled by <code>1.10×</code>.
                    </li>
                    <li>
                      <strong>Shield-in-Pocket Penalty (-0.15 per unused shield):</strong> Losing a match while holding 1 or 2 unused shields applies <code>ΔQ_final = ΔQ_base - 0.15 × userShieldsRemaining</code> to penalize unspent defensive resources.
                    </li>
                    <li>
                      <strong>Interpretation:</strong> A positive <code>EXEC WAE</code> (e.g., <code>+8.4%</code>) means your micro-decisions are converting more wins than the active on-field alignments and shield states predict.
                    </li>
                  </ul>
                </div>

                {/* SECTION 2: MATCHUP LUCK (BMF) */}
                <div
                  className={`p-4 rounded-xl border space-y-2.5 ${
                    helpMetricGuideTopic === 'bmf'
                      ? 'bg-slate-950 border-sky-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-sky-400">
                      2. Matchup Luck (Blind Matchup Favorability — BMF)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      M = 0.40 · S_lead + 0.60 · S_back
                    </span>
                  </div>
                  <p>
                    <strong>Matchup Luck (BMF / P_pre)</strong> measures whether matchmaking is handing you favorable team alignments (<code>&gt;50%</code>) or hard-counter RPS lineups (<code>&lt;50%</code>) purely from the 3v3 rosters before any swaps, catches, or baits occur.
                  </p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 space-y-1">
                    <div>
                      <span className="text-sky-400 font-bold">Lead Score (50/50 1v1 &amp; 2v2):</span> S_lead = 0.50 · R_1v1(lead) + 0.50 · R_2v2(lead)
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold">Backline Score (70/30 Optimal Alignment):</span> S_back = 0.70 · max(Score_A, Score_B) + 0.30 · min(Score_A, Score_B)
                    </div>
                    <div>
                      <span className="text-amber-300 font-bold">Composite &amp; Logistic BMF:</span> M = 0.40 · S_lead + 0.60 · S_back  ⇒  P_pre = 1 / (1 + e^(-0.006 · (M - 500)))
                    </div>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    <li>
                      <strong>Early Forfeits (&lt;2 Opponents Revealed, w = 0.00):</strong> Matches where the opponent&apos;s first switch is never revealed are dropped from ranked WAE and Matchup Luck calculations.
                    </li>
                    <li>
                      <strong>Unrevealed 3rd Closer (2 Opponents Revealed, w = 0.75):</strong> When an opponent forfeits or gets swept before revealing their 3rd Pokémon, SilphScope substitutes the active league&apos;s <strong>Meta-Average 1v1 Prior</strong> (<code>R̄_swap</code>, <code>R̄_close</code>) at <code>75%</code> confidence weight (tagged <code>⚡ 75% Conf</code>).
                    </li>
                    <li>
                      <strong>Full 3v3 Revealed (w = 1.00):</strong> Exact pairwise 1v1 backline matrix evaluation at <code>100%</code> confidence weight.
                    </li>
                  </ul>
                </div>

                {/* SECTION 3: BADGE GLOSSARY */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    helpMetricGuideTopic === 'badges'
                      ? 'bg-slate-950 border-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm text-amber-400">
                      3. Badge Glossary (6 Primary Badges &amp; 5 Contextual Event Pills)
                    </h4>
                    <span className="font-mono text-[11px] text-slate-400">
                      Derived from Pre-Match BMF (P_pre) &amp; Timeline
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-cyan-400">Clutch Win • WIN (P_pre &lt; 40%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Flipped a heavily unfavorable team alignment (&lt;40% pre-match win equity) through superior catches, energy management, or shield baiting.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-emerald-400">Skill Win • WIN (40% ≤ P_pre ≤ 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Out-executed the opponent in a balanced, neutral 3v3 matchup.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-slate-300">Expected Win • WIN (P_pre &gt; 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Cleanly converted a favorable team-composition advantage into a win without throwing alignment.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-rose-400">Blunder Loss • LOSS (P_pre &gt; 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Dropped a favorable matchup where your 3v3 lineup held over 60% expected win equity.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-orange-400">Tough Loss • LOSS (40% ≤ P_pre ≤ 60%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Narrow defeat in a competitive 50/50 matchup decided by micro-timing or CMP.
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="font-bold text-slate-400">Expected Loss • LOSS (P_pre &lt; 40%)</div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Hard-countered team alignment (&lt;40% win equity); carries minimal negative impact on WAE.
                      </p>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-800 space-y-1.5">
                    <div className="font-bold text-xs text-slate-200">
                      Contextual Event Flags (Timeline &amp; End-State Pills):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-rose-300">⚠️ Double Shield Pocket:</span> Loss finished with 2 unused shields remaining (<code>-0.30</code> ΔQ penalty).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-amber-300">⚠️ Shield in Pocket:</span> Loss finished with 1 unused shield remaining (<code>-0.15</code> ΔQ penalty).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-emerald-300">🧹 Clean Sweep:</span> Win achieved with <code>0</code> user faints (all 3 Pokémon surviving).
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800">
                        <span className="font-bold text-sky-300">🛡️ Shield Advantage:</span> Win achieved while ending with more shields remaining than the opponent.
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800 sm:col-span-2">
                        <span className="font-bold text-purple-300">⚡ 75% Conf:</span> Opponent&apos;s 3rd Pokémon was unrevealed; evaluated at <code>w = 0.75</code> confidence weight using the league&apos;s Meta-Average 1v1 Prior.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpMetricGuideModal(false);
                    setActiveTab('help');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📖 Open Full Help Page
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelpMetricGuideModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay HUD & Battle Flow Quick Help Modal (Opened from Start Battle Overlay Region Help Button) */}
        {showOverlayQuickHelpModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>🎯 Overlay HUD &amp; Battle Flow Guide (v3.31)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    How to interact with the floating overlay, read 3x3 damage % &amp; shield dots, track 50s swap clocks, and log battles
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOverlayQuickHelpModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto space-y-3.5 pr-1 text-xs leading-relaxed text-slate-300">
                <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-sky-400">
                    1. General Battle Flow &amp; Interacting with the Overlay
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Select or Switch Teams (Main App):</strong> Choose your active team preset in the main app&apos;s <strong>⚔️ Teams</strong> page before or between sets. To switch teams, return to the main app and select another preset (it pushes immediately to the running overlay).
                    </li>
                    <li>
                      <strong>Launch, Drag &amp; HUD Emblem Controls (v7.30):</strong> Tap <strong>Start Battle Overlay</strong> to launch the HUD. Drag the header bar to reposition it anywhere. Single-tap the top-left theme emblem to alternate between <code>Full HUD ↔ Compact HUD</code>. Press and hold the emblem for <code>2.0s</code> to toggle <strong>Log-Only Stealth Mode</strong> (100% invisible HUD &amp; silenced haptics with headless auto-logging &amp; DVR for official Play! Pokémon tournament play). In the post-battle summary, tap the <strong>📊 Battle Log</strong> shortcut button to stop the overlay and open Battle Logs.
                    </li>
                    <li>
                      <strong>Interactive Header Shield Counters (🛡️ You &amp; 🛡️ Opp):</strong> Tap either shield icon in the overlay header to cycle remaining shields (<code>2→1→0→2</code>) mid-battle. Instantly recalculates the 9-scenario PvPoke matrix rating and adjusts all combat threat thresholds in real-time.
                    </li>
                    <li>
                      <strong>Manual Opponent Override (&apos;Opponents (Tap to Edit)&apos;):</strong> Tap the <strong>Opponents (Tap to Edit)</strong> header bar inside the overlay if OCR misreads a name or form to manually override any of the 3 opponent slots (with Shadow &amp; Regional/Form support).
                    </li>
                    <li>
                      <strong>Start Battle (⚔️ Start Battle):</strong> Tap when a GBL match begins. This clears the previous opponent lineup, resets both 50s swap clocks, resets shields (2v2) and Pokéballs (3v3), anchors the timeline clock (<code>t=0s</code>), and switches the button to <strong>🛑 Stop Battle</strong>.
                    </li>
                    <li>
                      <strong>Stop &amp; Log (🛑 Stop Battle):</strong> Tap when the match finishes. Verify or tap the Lead Matchup chip (<strong>Fav / Neu / Neg</strong>) and tap <strong>🏆 Win</strong> or <strong>💀 Loss</strong> (or <strong>✕ Skip</strong>).
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-amber-400">
                    2. The 3x3 Matchup &amp; Shield Matrix (PvPoke Ratings, Dots &amp; 0S/1S/2S Tags)
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>3x3 Grid Structure:</strong> Columns = Opponent&apos;s 3 Pokémon in the exact order revealed (<code>[1st Lead, 2nd First Swap, 3rd Closer]</code>). Rows = Your 3 Pokémon.
                    </li>
                    <li>
                      <strong>Single-Number PvPoke Rating &amp; Colored Tier Dot:</strong> Each cell shows the exact PvPoke 500-centered matchup rating for the current shield state:
                      <span className="block ml-4 mt-1 text-[11px] text-slate-300">
                        • <strong className="text-emerald-400">[+] Bright Emerald (SW ≥ 620):</strong> Strong Win / hard counter.<br />
                        • <strong className="text-green-400">[●] Green (W 530–619):</strong> Favorable Win.<br />
                        • <strong className="text-slate-300">[●] Slate Grey (N 471–529):</strong> Neutral 50/50 matchup.<br />
                        • <strong className="text-rose-400">[●] Red (L 381–470):</strong> Unfavorable Loss.<br />
                        • <strong className="text-red-400">[×] Dark Crimson (SL ≤ 380):</strong> Strong Loss — swap or catch immediately.
                      </span>
                    </li>
                    <li>
                      <strong>0S / 1S / 2S Shield Scenario Tags:</strong> Below the rating number, cells display compact tags (e.g., <code>1S 2S✓</code> or <code>0S✗ 1S✓</code>) when spending or saving shields flips the matchup outcome.
                    </li>
                    <li>
                      <strong>Dynamic 9-State Asymmetric Matrix (0v0–2v2):</strong> Automatically updates ratings across all 9 shield combinations as shields are spent.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-emerald-400">
                    3. How to Use Battle Damage Numbers (Bottom 3-Column Damage Grid)
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Bottom Opponent Attacks Section:</strong> Displays a 3-column grid aligned with Opponent 1, Opponent 2, and Opponent 3 against your currently active Pokémon.
                    </li>
                    <li>
                      <strong>Live Charged Move Damage % &amp; KO! Badge:</strong> Every opponent charged move shows its move-type color dot, energy cost, fast move count, and exact HP damage percentage (e.g., <code>42%</code> or <code>88% KO!</code>) accounting for League CP stat scaling, dual-type effectiveness up to <code>2.56x</code>, STAB <code>1.2x</code>, and Shadow <code>+20% ATK / -16.7% DEF</code>.
                    </li>
                    <li>
                      <strong>Tank vs. Shield Decisions:</strong> Check the damage % before committing a shield — if a move deals <code>36%</code> you can safely tank it, whereas <code>84% KO!</code> warns you to shield.
                    </li>
                    <li>
                      <strong>Multi-Cycle Fast Move Counts (C1-C2-C3) &amp; Sneak Prevention:</strong> Shows exact fast moves required across 3 consecutive cycles (accounting for residual energy) plus optimal throw timing (<code>Throw on: 1, 4, 7</code> or <code>Aligned (Any)</code>) to deny free opponent fast move sneaks.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/30 space-y-1.5">
                  <h4 className="font-bold text-sm text-purple-400">
                    4. Dual 50s Swap Timers, Faint Preservation &amp; Statusbar Toasts
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <strong>Independent 50s Swap Clocks (&apos;You&apos; &amp; &apos;Opp&apos;):</strong> Tracks both your switch timer and the opponent&apos;s switch timer (<strong className="text-rose-400">Red 50s–16s</strong> locked, <strong className="text-amber-300">Amber 15s–1s</strong> window opening soon, <strong className="text-emerald-400">Green RDY</strong> switch available).
                    </li>
                    <li>
                      <strong>Smart Faint Swap-In Preservation:</strong> Detects Pokéball drops (<code>3→2→1</code>) when a Pokémon faints so a replacement entering after a KO preserves the running swap timer instead of falsely resetting to 50s.
                    </li>
                    <li>
                      <strong>Shield (2→1→0) &amp; Faint Column Dimming:</strong> Tracks remaining shields and automatically dims fainted opponent columns in the 3x3 matrix.
                    </li>
                    <li>
                      <strong>Top Statusbar / Clock Strip Toasts:</strong> Non-intrusive alerts for Swaps, Faint Swaps, and Shields Used rendered at the top statusbar so charged move buttons are never blocked.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowOverlayQuickHelpModal(false);
                    setActiveTab('help');
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📖 Open Full Help Page
                </button>
                <button
                  type="button"
                  onClick={() => setShowOverlayQuickHelpModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
