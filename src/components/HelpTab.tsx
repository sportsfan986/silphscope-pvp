import React from 'react';
import { Info } from 'lucide-react';

export interface HelpTabProps {
  setActiveTab: (tab: 'simulator' | 'presets' | 'battle_log' | 'settings' | 'meta' | 'iv_lab' | 'help' | 'math_validator') => void;
  setShowOverlayQuickHelpModal: (show: boolean) => void;
  setShowHelpMetricGuideModal: (show: boolean) => void;
  setHelpMetricGuideTopic: React.Dispatch<React.SetStateAction<'wae' | 'bmf' | 'badges'>>;
}

export function HelpTab({ setActiveTab, setShowOverlayQuickHelpModal, setShowHelpMetricGuideModal, setHelpMetricGuideTopic }: HelpTabProps) {
  return (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* 3-Page Quick Switcher Banner (Teams • Battle Log • Settings) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info className="w-5 h-5 text-sky-400" />
                  <span>📖 Complete Help, HUD Instructions, Tips &amp; Tactics Guide (v3.20)</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Everything you need to master the floating PvP overlay, 3x3 matchup &amp; shield matrix, bottom 3-column damage grid, 50s swap clocks, move pacing, Battle Log analytics, and Tasker automation.
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
                <button
                  onClick={() => setActiveTab('presets')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ⚔️ Teams
                </button>
                <button
                  onClick={() => setActiveTab('battle_log')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  📜 Battle Log
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ⚙️ Settings
                </button>
              </div>
            </div>

            {/* Quick Popup Guide Launchers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowOverlayQuickHelpModal(true)}
                className="p-3.5 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-left flex items-center justify-between transition shadow-lg"
              >
                <div>
                  <div className="text-xs font-extrabold text-sky-300">🎯 Open Overlay Flow &amp; HUD Popup Guide</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Quick reference for Shield Matrix, Bottom Damage Grid, 50s Swap Clocks &amp; Battle Flow
                  </div>
                </div>
                <span className="text-sky-400 font-bold text-xs">Open →</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHelpMetricGuideTopic('wae');
                  setShowHelpMetricGuideModal(true);
                }}
                className="p-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-left flex items-center justify-between transition shadow-lg"
              >
                <div>
                  <div className="text-xs font-extrabold text-emerald-300">📊 Open Execution WAE, BMF &amp; Badge Glossary</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mathematical breakdown of Wins Above Expected, Matchup Luck &amp; 11 Badges/Pills
                  </div>
                </div>
                <span className="text-emerald-400 font-bold text-xs">Open →</span>
              </button>
            </div>

            {/* Section 1: General Battle Flow & How to Interact with the Overlay */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-sky-400">
                1. General Battle Flow &amp; How to Interact with the Overlay
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Step 1 — Select or Switch Your Active Team (Main App):</strong> On the <strong>⚔️ Teams</strong> page in the main app, tap any team preset to make it active (or create a custom Great, Ultra, Master, or Mega Master League trio with auto-filled PvPoke recommended moves and IV/CP stat scaling). <em>To switch teams between sets, return to the main app and select another preset on the ⚔️ Teams page — it pushes immediately to the running overlay.</em>
                </li>
                <li>
                  <strong className="text-white">Step 2 — Launch the Overlay:</strong> Tap <strong>Start Battle Overlay</strong> in the top status bar. Grant <em>Display over other apps</em> and <em>Screen Capture</em> (used strictly in-memory at 1 Hz for ML Kit OCR — zero screenshots are ever saved to disk).
                </li>
                <li>
                  <strong className="text-white">Step 3 — Reposition or Minimize Anytime (⚔️ Icon):</strong> Drag the overlay header bar to position it anywhere on screen. Between battles or while walking/catching Pokémon, tap the <strong>⚔️</strong> icon in the top-left of the overlay to collapse it into a tiny floating bubble and pause OCR scanning.
                </li>
                <li>
                  <strong className="text-white">Step 4 — Manual Opponent Override (&apos;Opponents (Tap to Edit)&apos;):</strong> If OCR misreads an opponent&apos;s name or form, tap the <strong>Opponents (Tap to Edit)</strong> header bar inside the overlay to open the Opponent Team Editor and manually override Opponent 1 (Lead), Opponent 2 (Swap), or Opponent 3 (Closer) with Shadow and Regional/Alternate form support.
                </li>
                <li>
                  <strong className="text-white">Step 5 — Start Battle (⚔️ Start Battle):</strong> When a GBL match begins, tap <strong>⚔️ Start Battle</strong> on the overlay. This clears the previous opponent lineup, resets both 50s swap timers, resets shields (2v2) and Pokéballs (3v3), anchors the battle timeline clock (<code>t = 0s</code>), and turns the button into <strong>🛑 Stop Battle</strong>.
                </li>
                <li>
                  <strong className="text-white">Step 6 — Stop &amp; Log (🛑 Stop Battle):</strong> When the match ends, tap <strong>🛑 Stop Battle</strong>. OCR pauses and the quick-log prompt appears: verify or tap the Lead Matchup chip (<strong>Fav / Neu / Neg</strong>) and tap <strong>🏆 Win</strong> or <strong>💀 Loss</strong> (or <strong>✕ Skip</strong>).
                </li>
              </ul>
            </div>

            {/* Section 2: The 3x3 Matchup & Shield Matrix */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-amber-400">
                2. The 3x3 Matchup &amp; Shield Matrix (PvPoke Ratings, Colored Dots &amp; 0S/1S/2S Tags)
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">3x3 Grid Layout:</strong> The 3 columns represent the opponent&apos;s 3 Pokémon in the exact order revealed (<code>[1st Lead, 2nd First Swap, 3rd Closer]</code>). The 3 rows represent your 3 Pokémon.
                </li>
                <li>
                  <strong className="text-white">Single-Number PvPoke Rating &amp; Colored Tier Dot:</strong> Every cell in the 3x3 matrix displays the exact PvPoke 500-centered matchup rating for the current shield state along with a color-coded border and tier indicator dot:
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-950 border border-emerald-500/40">
                      <strong className="text-emerald-400 block">[+] Strong Win (SW)</strong>
                      <span className="text-slate-400">Rating ≥ 620 • Dominant wall</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-green-500/30">
                      <strong className="text-green-400 block">[●] Win (W)</strong>
                      <span className="text-slate-400">530–619 • Favorable win</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-slate-700">
                      <strong className="text-slate-300 block">[●] Neutral (N)</strong>
                      <span className="text-slate-400">471–529 • Even 50/50</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-rose-500/30">
                      <strong className="text-rose-400 block">[●] Loss (L)</strong>
                      <span className="text-slate-400">381–470 • Unfavorable</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950 border border-red-600/40">
                      <strong className="text-red-400 block">[×] Strong Loss (SL)</strong>
                      <span className="text-slate-400">≤ 380 • Hard counter</span>
                    </div>
                  </div>
                </li>
                <li>
                  <strong className="text-white">0S / 1S / 2S Shield Scenario Flip Tags:</strong> Below the rating number, each cell displays compact shield-scenario tags (e.g., <code>1S 2S✓</code> or <code>0S✗ 1S✓</code>) whenever spending or saving shields flips the matchup outcome between 0-Shield, 1-Shield, and 2-Shield scenarios.
                </li>
                <li>
                  <strong className="text-white">Customizing Thresholds &amp; 9-State Engine:</strong> Customize the exact SW / W / L / SL rating cutoffs anytime in <strong>⚙️ Settings → 5-Tier Matchup Rating Thresholds</strong>. Under the hood, SilphScope evaluates all 9 discrete shield permutations (<code>0v0</code> through <code>2v2</code>) as shields are spent.
                </li>
              </ul>
            </div>

            {/* Section 3: How to Read Battle Damage Numbers (Bottom 3-Column Damage Grid) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-emerald-400">
                3. How to Use Battle Damage Numbers (Bottom 3-Column Opponent Attacks Grid)
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Bottom 3-Column Opponent Attacks Grid:</strong> Below the 3x3 matchup matrix, the <strong>Opponent Attacks (vs Active Pokémon)</strong> section displays a 3-column grid aligned with Opponent 1, Opponent 2, and Opponent 3 against your currently active on-field Pokémon.
                </li>
                <li>
                  <strong className="text-white">Exact Charged Move Damage % &amp; KO! Badge:</strong> Each opponent column lists their Fast Move (with turn duration) and their Charged Moves (2 moves by default, or up to 4 when <strong>4 Charged Moves</strong> mode is enabled in Settings). Each charged move row shows its move-type color dot, abbreviated name, energy cost, fast move count, and the <strong>exact percentage of HP it deals to your active Pokémon</strong> (e.g., <code>42%</code> or <code>88% KO!</code>), accounting for League CP stat scaling, dual-type effectiveness (up to <code>2.56x</code>), STAB (<code>1.2x</code>), and Shadow modifiers (<code>+20% ATK / -16.7% DEF</code>).
                </li>
                <li>
                  <strong className="text-white">Tactical Tank vs. Shield Decisions:</strong> Glance at the damage percentage in the active opponent&apos;s column before committing a shield — if a charged move deals <code>36%</code>, you know you can comfortably tank it and farm energy; if it shows <code>84% KO!</code>, you know immediately that you must shield.
                </li>
              </ul>
            </div>

            {/* Section 4: Swap Clocks, Faint Preservation, Shield/Faint Tracking & Statusbar Toasts */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-purple-400">
                4. Dual 50s Swap Clocks, Faint Swap Preservation &amp; Top Statusbar Toasts
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Dual Independent 50s Swap Timers (&apos;You&apos; &amp; &apos;Opp&apos;):</strong> Automatically starts a 50-second countdown whenever you or the opponent switches Pokémon:
                  <span className="block ml-4 mt-1 text-slate-300">
                    • <strong className="text-rose-400">Red (50s–16s):</strong> Switch locked on cooldown.<br />
                    • <strong className="text-amber-300">Orange/Amber (15s–1s):</strong> Switch window opening soon — prepare to throw energy or time a catch.<br />
                    • <strong className="text-emerald-400">Green (RDY):</strong> Switch available immediately.
                  </span>
                </li>
                <li>
                  <strong className="text-white">Smart Faint Swap-In Clock Preservation:</strong> When a Pokémon faints and a replacement enters, SilphScope detects the Pokéball drop (<code>3 → 2 → 1</code>) and preserves the existing running swap timer instead of falsely resetting it to 50s.
                </li>
                <li>
                  <strong className="text-white">Automatic Pokéball (3→2→1) &amp; Shield (2→1→0) Tracking:</strong> Samples the top HUD lobes to track remaining Pokémon and shields for both players. When an opponent Pokémon faints, its column in the 3x3 matrix automatically dims so you can focus on surviving threats.
                </li>
                <li>
                  <strong className="text-white">Top Statusbar / Clock Strip Battle Toasts:</strong> Real-time alerts for Swaps, Faint Swaps, and Shields Used appear in the top statusbar/clock area of the phone so they never block your charged move buttons (toggleable in <strong>⚙️ Settings</strong>).
                </li>
              </ul>
            </div>

            {/* Section 5: Move Counting, Cycle Pacing, Sneak Prevention & Customizing HUD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-pink-400">
                5. Fast Move Counting, Cycle Pacing (C1-C2-C3), Sneak Prevention &amp; HUD Settings
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Multi-Cycle Move Counts (C1-C2-C3):</strong> Each charged move row in the bottom damage grid shows the exact fast moves required across 3 consecutive cycles, automatically accounting for leftover residual energy (e.g., <code>7-6-7</code>).
                </li>
                <li>
                  <strong className="text-white">Count Basis (&apos;My Fasts&apos; vs. &apos;Their Fasts&apos;):</strong> In <strong>⚙️ Settings</strong>, choose whether opponent move counts are displayed in units of your own fast move taps (<strong>My Fasts</strong>) or the opponent&apos;s fast move animations (<strong>Their Fasts</strong>).
                </li>
                <li>
                  <strong className="text-white">Optimal Throw Timing (Sneak Prevention):</strong> At the bottom of each opponent&apos;s attack column, the HUD shows <code>Throw on: 1, 4, 7</code> (or <code>Aligned (Any)</code> when fast move durations match) so you can throw your charged move without giving the opponent a free fast move sneak.
                </li>
                <li>
                  <strong className="text-white">4 Charged Moves Mode, Scale &amp; Transparency:</strong> Enable 4 Charged Moves in <strong>⚙️ Settings</strong> for unpredictable move-roulette opponents, and fine-tune Overlay Size (50%–100%) and Background Transparency (0%–100%).
                </li>
              </ul>
            </div>

            {/* Section 6: Battle Logs, Interactive Replay, WAE / Luck & Standardized Exports */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-sky-400">
                6. Battle Logs, Interactive Replay, WAE / Luck &amp; Standardized GBL Exports
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">5-Stat Analytics Grid:</strong> Tracks Record (W-L), Lead Matchups (Fav/Neu/Neg), Win Rate %, <strong>EXEC WAE</strong> (Wins Above Expected micro-execution skill), and <strong>MATCHUP LUCK</strong> (Blind Matchup Favorability BMF). Tap the <code>i</code> icon next to EXEC WAE or MATCHUP LUCK anytime for the full mathematical breakdown and Badge Glossary.
                </li>
                <li>
                  <strong className="text-white">Interactive Battle Recap &amp; Replay:</strong> Tap any logged battle card in <strong>📜 Battle Logs</strong> to open the full 3v3 Matchup Matrix &amp; Timeline Replay for that battle.
                </li>
                <li>
                  <strong className="text-white">Standardized Copy GBL &amp; Share Summary:</strong> Use <strong>📋 Copy GBL</strong> for Go Battle Log format (<code>[pokemon1 pokemon2 pokemon3]</code> + opponent rows) or <strong>📤 Share Log Summary</strong> for daily/season summaries with <code>W/L (L-&gt;F/N/U, M-&gt;F/N/U) opponent1 opponent2 opponent3</code> rows and standardized Pokémon naming (e.g., <code>ninetales_alolanS</code>, <code>laprasS</code>, <code>giratina_altered</code>, <code>charizard_MEGA_Y</code>).
                </li>
              </ul>
            </div>

            {/* Section 7: Multi-Device Cloud Sync, Trash Bin & Tasker Automation */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <h3 className="text-sm font-bold text-emerald-400">
                7. Multi-Device Cloud Sync, Trash Bin &amp; Tasker Automation Hooks
              </h3>
              <ul className="list-disc list-inside space-y-1.5">
                <li>
                  <strong className="text-white">Multi-Device Cloudflare D1 Vault Sync:</strong> Sign in with your Trainer ID and Vault Password (or License Key) under <strong>⚙️ Settings → Multi-Device Cloud Sync</strong>. Your Team Presets, App Settings, and Battle Logs automatically reconcile across devices on app open and after every logged battle.
                </li>
                <li>
                  <strong className="text-white">Trash Bin &amp; Instant Undo:</strong> Deleted teams or battles move to the <strong>🗑️ Trash Bin</strong> with an instant <strong>♻️ UNDO</strong> toast so nothing is ever lost by accident.
                </li>
                <li>
                  <strong className="text-white">Tasker Automation Hooks:</strong> Start or stop the overlay from Tasker without switching apps using <code>com.gbl.overlay.ACTION_START_OVERLAY</code> and <code>com.gbl.overlay.ACTION_STOP_OVERLAY</code>, or launch straight to <strong>📜 Battle Logs</strong> with <code>com.gbl.overlay.ACTION_OPEN_BATTLE_LOG</code> (1-tap copy buttons available in <strong>⚙️ Settings</strong>).
                </li>
              </ul>
            </div>
          </div>
  );
}
