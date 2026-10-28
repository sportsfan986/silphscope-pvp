# SilphScope PvP — Complete Release Changelog (`v1.00` – `v4.00`)

---

## v4.00 (2026-10-28) — Fast-Move Energy Increment Snapping & 4-Tier "Attack Incoming!" Shield Decision Overlay
*Major milestone release adding fast-move turn increment snapping with post-throw discharge anchoring on the player energy tracker and a dedicated 4-tier color-coded (Red / Orange / Yellow / Green) "Attack incoming!" Shield Decision Overlay positioned directly above the shield prompt.*

- **v4.00 — Key Feature: Fast-Move Energy Increment Snapping (`snapPlayerEnergyToValidStep`) & 4-Tier "Attack Incoming!" Shield Decision Overlay (`showOrUpdateShieldDecisionOverlay`)**:
  - **Fast-Move Energy Increment & Post-Throw Discharge Snapping (`snapPlayerEnergyToValidStep`)**:
    - Snaps raw pixel-measured player energy values (from the slower charged move meter) to the nearest valid fast-move turn step (`anchorE + k * fastMoveEnergy`, capped at `100E`) relative to the slot's post-throw residual anchor (`playerSlotEnergyAnchor`).
    - Eliminates `1–2E` pixel width and rounding offsets (e.g., `53E` snapping cleanly to `54E` on `9E Ember`) and updates `playerSlotEnergyAnchor` whenever a charged move is thrown (`preThrowE - moveCost`).
  - **New Themed "Attack Incoming!" Shield Decision Overlay (`showOrUpdateShieldDecisionOverlay` & `hideShieldDecisionOverlay`)**:
    - Renders a dedicated tactical card directly above `"Attack incoming! Use a Protect Shield?"` (`Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL`, `y = 29.5%` screen height) while the shield prompt is on screen (and player has `>= 1` shield), and auto-hides immediately as soon as the text disappears or after `5.0s`, whichever comes first.
    - **2a (Funded Moves)**: Lists all charged move candidates that the opponent has enough banked energy to throw (`preThrowOppEnergy >= moveCost`) individually, displaying whether each move will **KO** your active Pokémon or what your **remaining HP%** will be if you don't shield.
    - **2b (Unfunded Moves)**: Lists all remaining candidate moves (`preThrowOppEnergy < moveCost`) in *italics and muted font*, showing move name, `${bankedE}e/${moveCost}e` (e.g., `30e/40e`), and KO / remaining HP% impact.
    - **2c (4-Tier Color-Coded Background)**:
      - **RED**: **All** funded moves in **2a** will KO your active Pokémon (`fundedMoves.all { it.isKo }`).
      - **ORANGE**: **At least one** funded move in **2a** will KO and **at least one** funded move in **2a** will **not** KO (`fundedMoves.any { it.isKo } && fundedMoves.any { !it.isKo }`).
      - **YELLOW**: **No** move in **2a** KOs, **but at least one** unfunded move in **2b** would KO your active Pokémon (`fundedMoves.none { it.isKo } && unfundedMoves.any { it.isKo }`).
      - **GREEN**: **No** moves in **2a** or **2b** will KO your active Pokémon (`fundedMoves.none { it.isKo } && unfundedMoves.none { it.isKo }`).
    - **2d (Confirmed 2-Move Filtering)**: Automatically excludes Moves 3 and 4 from the Shield Decision Overlay and its color calculation once Charged Moves 1 and 2 are determined and locked for that opponent Pokémon.
    - **2f (Settings Toggle)**: Added `"🛡️ Attack Incoming! Shield Decision Overlay"` toggle in **Settings -> Overlay** (`PREFS_KEY_SHOW_SHIELD_DECISION_OVERLAY`, default enabled) with full Tasker intent support (`EXTRA_SHOW_SHIELD_DECISION_OVERLAY`).

---

## v3.95 – v3.99 (2026-10-28) — Sub-50E Multi-Round Energy Tracking up to 100E, Three-Ring Visual Charge Meter Detection & Zero Assumed Energy Gains
*Functionally grouped release series introducing multi-round (`0–100E`) energy tracking for Pokémon with `<50E` charged moves, single-bar slower-move authority, and three-ring visual charge circle detection.*

- **v3.99 — Key Feature: Three-Ring Visual Charge Meter Detection (`0%..300%`) & Zero Assumed Energy Gains**:
  - **Three-Ring Visual Charge Meter Detection (`detectSingleChargeButtonFillPct`)**: Detects 1st fill (`0%..100%`, thin border), 2nd fill (`100%..200%`, solid filled white border at `r = 0.90R..1.05R`), and 3rd fill (`200%..300%`, second concentric outer white ring at `r = 1.11R..1.25R` outside a darker annular gap at `r = 1.04R..1.11R`), reading the interior liquid meniscus directly across all three fills.
  - **Zero Assumed Energy Gains (`resolveSub50AndMultiRoundEnergy`)**: Removed all assumed fast-move cadence stepping (`overchargeSaturationStepAnchorMs`), wrap-around latches, and top-cap darkening heuristics; keys strictly off the slower, higher-cost charge move meter (`round(slowPct / 100.0 * slowCost).coerceIn(0, 100)`).
- **v3.98 — Key Feature: Single-Bar Slower Charge Meter Authority, Unrestricted Top-Cap Scan Above `169%` (`76E`) & 3rd-Fill Detection via Top-Cap Darkening Memory + Wrap-Around + Turn Cadence**:
  - **Single-Bar Authority (Undo Dual-Bar Fusion in `resolveSub50AndMultiRoundEnergy`)**: Keys player energy tracking strictly off the single slower, higher-cost charge move bar (e.g., `45E Energy Ball` on Ninetales), eliminating cross-bar wrap-around clamping that previously stalled Ninetales at `76E`.
  - **Unrestricted Top-Cap Chord Geometry Above `169%` (`detectSingleChargeButtonFillPct`)**: Scales the horizontal chord sample width above the center move-type icon (`minSafeDx = 4px` outside `inIconBand`) up to `91%` circle radius so upper-cap meniscuses (`170%..196%`, i.e., `77E..88E` on `45E` moves) are scanned cleanly without cutting off at `169%` (`76E`).
  - **Top-Cap Darkening Memory (`firstFillTopCapLuma` & `secondFillBotCapLuma`)**: Calibrates the bright 1st-fill top-cap luminance (`78..86%` height) and darker 2nd-fill bottom-cap luminance (`12..20%` height) per Pokémon slot/button so a saturated `200%` 2nd-fill circle (`90E` on `45E`) is immediately distinguished from a `100%` 1st-fill circle (`45E`).
  - **Meniscus Wrap-Around Latch & Fast-Move Turn Cadence (`90E -> 100E`)**: Latches `[3rd Fill]` on meniscus wrap-around (`101%..(peak - 18)%` after `>= 165%` 2nd-fill peak) and steps energy by `+userFastEnergy` every `userMoveDurationMs` during active fast combat whenever the meniscus enters the narrow upper cap (`>= 165%`) or saturates at `>= 2 * slowCost` up to `100E`.
- **v3.97 — Key Feature: Unmatched `<50E` Joint Dual-Bar Sensor Fusion (`0–100E`), Matched `<50E` Dual-Bar Consensus, 2-Layer Reference Band Overcharge Verification & Post-Shield Energy Floor Lock**:
  - **Unmatched `<50E` Joint Dual-Bar Sensor Fusion Across All `0–100E` Rounds (`resolveSub50AndMultiRoundEnergy`)**: Fuses both `<50E` charge meters across Rounds 1, 2, and 3 (e.g., Ninetales `45E Energy Ball` + `35E Weather Ball`) so whenever one bar's meniscus crosses the central move-type icon (`40..58%`, `73..81%`, `140..169%`) or misses a softer 2nd-fill step, the companion bar outside the icon zone drives player energy (`54E -> 63E -> 72E -> 81E -> 90E -> 99E`) with a cross-bar saturation floor (`fastSaturatedFloor = 2 * fastCost`).
  - **Matched `<50E` Dual-Bar Consensus & Initial Turn-0 Step Clamp (`resolveSub50AndMultiRoundEnergy`)**: Enforces dual-bar consensus for equal-cost `<50E` moves (e.g., Fearow `40E Drill Run + 40E Drill Peck`), rejecting single-bar `>= 100%` white-ring outliers when the companion bar is `< 92%` and clamping initial `0E` step jumps (`maxAllowedSingleJumpE`) so a single noisy frame never spikes a fresh Pokémon from `0E` to `40E`.
  - **White-Ring Upper-Arc & Colored Top-Cap Gating, 2-Layer Reference Band Overcharge Verification & Lower-Flank Continuity (`detectSingleChargeButtonFillPct`)**: Requires upper-half white ring arcs (`upperWhiteRingArcs >= 2`) and genuine colored top-cap liquid (`isTopCapFilled`) before classifying `>= 100%` ready state; verifies 2nd-fill (`105%..195%`) meniscuses against unobstructed Top (`78..86%`) and Bottom (`12..20%`) Reference Bands (`hasTwoLayerCapSeparation`); and verifies lower-quarter liquid continuity (`isLowerQuarterFilled`) in Round 1 (`1%..97%`).
  - **Post-Opponent-Charged-Move Player Energy Floor Lock**: Locks player banked overcharge energy across opponent charged attacks and shield prompts (`max(curE, rawMeasuredEnergy)`) so player energy never drops backwards after shielding or taking an opponent charged move.
- **v3.96 — Key Feature: Strict 3rd-Ring Energy Prerequisite, Inner-Liquid Meniscus Geometry Fix & Dual-Bar Round 2 Cross-Check**:
  - **Inner-Liquid Meniscus Geometry Fix (`detectSingleChargeButtonFillPct`)**: Constrained the `100%–199%` overcharge meniscus scan strictly inside the calibrated circle interior (`halfSpanPx * 0.88`), avoided the central move-type icon and outer drop-shadow/battlefield lines, and required genuine colored liquid pixels on both sides of the meniscus so a uniform `100%` 1st ring (e.g., Ninetales's `45E Energy Ball` at `45E`) never produces false `122%..200%` readings.
  - **Mandatory Tracked Energy Prerequisite (`canEnterSlowThirdFill`)**: A `<50E` charge move bar can **never** latch into `[3rd Fill]` unless tracked energy (`clampedCurE`) is already within one fast-move step of `2 * slowCost` (`>= 2 * slowCost - maxFastStep`), and wrap-around detection now requires **`&&` (AND)** across `canEnterSlowThirdFill`, step-validated `peakSecondFillPct >= 168%`, and a `>= 20%` meniscus drop.
  - **Unmatched `<50E` Dual-Bar Round 2 Consistency & Single-Step Jump Guard (`resolveSub50AndMultiRoundEnergy`)**: Cross-checks both `<50E` bars against the single shared energy pool `E` in Round 2 (e.g., `35E Weather Ball` + `45E Energy Ball` on Ninetales) before allowing any Round 3 transition, and caps single-update energy/turn jumps so an early ring never spikes player or opponent energy to `100E`.
- **v3.95 — Key Feature: Sub-50E Multi-Round Energy Tracking up to 100E (Matched & Unmatched Charged Moves) & Post-Throw Round Resync**:
  - **Dual-Bar N-Sample (`±2%`) Circle Debounce (`OverlayService.kt`)**:
    - Debounces both the slower (higher-energy) and faster (lower-energy) charge move circles independently using the configurable N-sample (`default 2`, `±2%` fill tolerance) rolling confirmation filter (`candidateFastestFillPct`, `fastestFillDebounceCount`, `confirmedFastestFillPct`).
  - **Unmatched Sub-50E Moves (`cost1 != cost2`, both `<50E`, e.g., `35E + 45E`, `35E + 40E`, `40E + 45E`)**:
    - Tracks player energy directly from the **slower charge move meter** during Round 1 (`0 .. slowCost`) and Round 2 (`slowCost .. 2 * slowCost`), then switches to a **Dual-Bar Percentage Match Solver** across both bars up to `100E` in Round 3.
  - **Matched Sub-50E Moves (`cost1 == cost2 < 50E` or Single `<50E` Move, e.g., `35E + 35E`, `40E + 40E`, `45E + 45E`)**:
    - Combines a **Wrap-Around State Latch** (`peakSecondFillPct` drop detection at the 2nd-to-3rd fill boundary) with turn-monotonic fast-move progression up to `100E`.
  - **Post-Throw Energy Deduction, Dual-Bar Move Disambiguation & Fill-Round Resync (`resolvePostThrowCircleEnergyAndResyncRound` & `scorePostThrowCircleFit`)**:
    - Deducts the thrown charged move's energy cost (`preThrowEnergy - thrownMoveCost`), scores both post-throw charge meters via `scorePostThrowCircleFit` to disambiguate Move 1 vs. Move 2 throws, and resyncs the active fill round (`Round 1`, `Round 2`, or `Round 3`) and per-slot wrap latches to the observed post-throw bars.

---

## v3.91 – v3.94 (2026-10-27 – 2026-10-28) — Shield & Pokéball HUD Debouncing, All-HUD-Gone Lockout, Pre-KO Faint Attribution & Charged Move Catch Accounting
*Functionally grouped release series hardening top-corner HUD (Pokéball & Protect Shield) tracking, charged-move camera zoom immunity, and opponent faint/move attribution.*

- **v3.94 — Key Feature: Symmetric Shield & Pokéball Debouncing, All-HUD-Gone Camera-Zoom Lockout & `-1` Shield Drop Cap per Charged Attack**:
  - Added N-frame confirmation debouncing (`>= 2` frames normal combat, `>= 3` frames post-charged-attack cooldown) for both player and opponent Pokéball and Protect Shield counts.
  - Added an **All-HUD-Gone Lockout** (`userHudGone || oppHudGone`) when Pokémon GO hides the top-corner status bars during charged attack camera zooms, suppressing any shield decrement or faint registration while the HUD is absent and capping shield usage to at most `-1` shield per charged attack.
- **v3.93 — Key Feature: Used Charged Move Marking Fix, Resilient `<Name> used <Move>!` Banner Fallback & 2-Pokéball Faint Invariant**:
  - Clears `pendingChargedAttackOppSlotIdx` / `pendingChargedAttackUserSlotIdx` after each charged attack reconciliation, allows clipped `"used <Move>!"` banners to fall back to the pre-charge active opponent slot, confirms unshielded HP-delta moves in `confirmedOppChargedMoves`, and enforces a continuous **2-Pokéball invariant** so at most 1 opponent Pokémon can ever be marked fainted while 2 Pokéballs remain visible.
- **v3.92 — Key Feature: Pre-Throw Attacker Slot Lock, Bidirectional Charged Move Catch Accounting & Pre-KO Faint Slot Lock**:
  - Locks `pendingChargedAttackOppSlotIdx` at the start of every charged attack so post-move swaps never credit the charged move to the incoming Pokémon; detects **Player and Opponent Charged Move Catches** (preserving swapped-out HP and starting the 50s swap clock on the catching side); and cross-checks pre-KO active slot + lowest-HP history in `resolveFaintedOpponentSlotIdx`.
- **v3.91 — Key Feature: Top-Corner Overlay Missing Shield Decrement Guard**:
  - Suppresses shield drop processing and resets drop frame counters whenever top-corner Pokéball and shield icons fade out (`shields <= 0` and `balls <= 0`) during charged move animations.

---

## v3.89 – v3.90 (2026-10-27) — Low-Latency HP Bar Debouncing, Upward HP Self-Correction & Solgaleo Body False-Bar Rejection
*Functionally grouped release series upgrading floating HP bar pixel accuracy and debounce filtering.*

- **v3.90 — Key Feature: Solgaleo Body Anti-False-Trigger (`detectFloatingHpBarPct`), Candidate Proximity Ranking & Configurable Debounce Tolerance (`0 / 1 / 2 / 3%`)**:
  - Rejects bright Pokémon body parts (such as Solgaleo's white mane/chest) by requiring genuine dark depleted-track interior pixels matching `(100% - HP%) ± 10%` and minimum width `w >= 0.245 * screenWidth`, ranks multi-candidate HP bar clusters by proximity to the prior confirmed HP%, and adds a `Debounce Error Tolerance (±0% / ±1% / ±2% / ±3%)` setting.
- **v3.89 — Key Feature: Independent HP Bar Meter Debounce Setting (`2 / 3 / 4 Samples`) & Upward HP Self-Correction During Shield Prompts**:
  - Replaced rigid exact-integer HP frame matching with a dedicated N-sample (`default 2`, `±2%` tolerance) rolling HP confirmation window that immediately self-corrects upward on clean readings and updates pre-impact HP during `"Attack incoming!"` shield prompts.

---

## v3.86 – v3.88 (2026-10-27) — Low-Latency N-Sample Charge Circle Debounce, Curved Inner-Track 100–200% Meniscus Scanner & Turn-Indexed Opponent Energy
*Functionally grouped release series replacing complex filter state with direct N-sample charge circle debouncing, 3-2-1-GO ring calibration, and player-turn-indexed opponent energy.*

- **v3.88 — Key Feature: Player Energy-to-Turns Conversion, 500ms Sub-Turn Interpolation & Shield Matrix Top Banked Energy Row**:
  - Converts confirmed player energy gains into fast-move turns (`confirmedPhasePlayerTurns`) to index opponent energy directly to player turns (with `500ms` sub-turn interpolation on multi-turn player fast moves and optimal-timing ceiling credit), and adds a top Banked Energy header row (`D:60E | L:0E | K:-E`) above the 3x3 Shield Matrix.
- **v3.87 — Key Feature: 6-Cycle Dark-Grey Border `3-2-1-GO` Calibration, White Screen Flash Guard & Curved Inner-Track `100%–200%` Meniscus Detector**:
  - Rejects pre-battle white screen flashes (`isWhiteScreenFlash`), calibrates empty `0%` circle geometry across 6 countdown cycles, and samples strictly inside the curved inner liquid flanks (`100%–200%`) so moves like Aeroblast (`75E -> 133%`) and Roar of Time (`65E -> 154%`) read up to `100E` without outer white-ring clipping.
- **v3.86 — Key Feature: Kalman Filter Removal, N-Sample (`2 / 3 / 4`) Circle Debounce, Banked Post-Throw Deduction & Live Energy Toasts**:
  - Replaced the Kalman filter with a low-latency N-sample (`±2%`) circle debounce on the slowest charge move, added outer white border + advancing white meniscus `100%–200%` detection, preserved banked pre-throw energy across charged move animations, and added toggleable live energy toast notifications.

---

## v3.80 – v3.85 (2026-10-27) — Charge Move Circle Turn Detection, 3-Tier Banner Move Depletion, Non-Standard Fast Move Detector & Sensor Fusion Experiments
*Functionally grouped release series introducing circular charge move meter energy tracking, mid-screen attack banner OCR, and experimental PLL / Kalman sensor fusion.*

- **v3.84 – v3.85 — Key Feature: 2-Channel Kalman Filter Energy Smoothing, 3rd-Fill Confidence Reduction & Slower Charge Meter Prioritization**:
  - **v3.85**: Decoupled HP & energy loops, prioritized the highest-energy (slower) charge move meter (`1.65x..2.25x` weight) while reducing confidence on faster meters in their 3rd fill cycle, and added filter tuning controls in Settings.
  - **v3.84**: Introduced the 2-channel state-space Kalman filter fusing fast-move turn predictions with Left/Right charge circle fill percentages and zero-drop animation immunity.
- **v3.83 — Key Feature: 2-out-of-3 Majority-Vote PLL (Opponent HP Integrator + Charge Move 1 + Charge Move 2) & 300ms Meter Debounce**:
  - Combined integrated opponent fast-move HP drops with 3-sample / `>= 300ms` debounced Left and Right charge move circles in a 2-out-of-3 phase-locked loop, plus phase-locked end-of-fast-move auto-increment and wider Tinkaton HP bar scan corridors.
- **v3.81 – v3.82 — Key Feature: `3-2-1-GO` Prescan Circle Calibration, Full-Range `0..100E` Overcharge Self-Biasing & Expanded Tall/Small Pokémon HP Windows**:
  - **v3.82**: Expanded vertical floating HP bar scan corridors for tall and small Pokémon, improved low-sliver red HP detection, and added `>25%` HP resync.
  - **v3.81**: Added `3-2-1-GO` countdown prescan circle calibration, outer-annulus meniscus detection for `0..100E` overcharge self-biasing, and 0-shield `"No Protect Shields remaining!"` incoming attack prompt detection.
- **v3.80 — Key Feature: Static Charge Move Circle Turn Detection, `"<Pokemon> used <Move>!"` Banner Recognition & Non-Standard Opponent Fast Move Detector**:
  - Locked Charge Move 1 & 2 circular gauges at pre-battle coordinates, introduced **Charge Move Energy Circle Only Mode**, added white-text `"<Pokemon> used <Move>!"` banner OCR for 3-tier charged move energy depletion + confirmed move badges, and added the **Non-Standard Opponent Fast Move Detector** (`>= 10%` damage threshold with `0 / +1 / +2` turn offset).

---

## v3.64 – v3.70 (2026-10-26 – 2026-10-27) — High-Frequency 100ms–200ms Pixel HP Loop, 750ms Async OCR Split & Charge Bar Second Source of Truth
*Functionally grouped release series decoupling fast pixel HUD scanning (`5Hz–10Hz`) from asynchronous ML Kit text recognition and introducing dual HP + Charge Bar verification.*

- **v3.69 – v3.70 — Key Feature: Countdown Move 1 `0%` Baseline Anchor, Grass Stadium Saturation Immunity & `96% vs 100%` Meniscus Priority**:
  - **v3.70**: Added grass-stadium background saturation immunity, `96% vs 100%` meniscus priority so near-full bars never prematurely snap to `100%`, and a `600ms` charged attack deduction window.
  - **v3.69**: Fixed Move 1 `0%` empty-button baseline during countdown, resolved the `48E -> 52E` (`96% -> 104%`) central icon mask wrap-around, and enforced Turn-0 charged move resets.
- **v3.67 – v3.68 — Key Feature: PID Loop Removal, Type-Agnostic Charge Move Bar 2nd Source of Truth & NVE/SE Text Occlusion Immunity**:
  - **v3.68**: Removed sliver auto-rollback and PID window state, hardened Charge Move Bar scanning under `"Not very effective..."` / `"Super effective!"` text occlusion, and calibrated 10Hz HUD thresholds.
  - **v3.67**: Replaced the 3-tier PID loop with a type-agnostic Charge Move Bar 2nd source of truth (with overcharge wrap) and synced `<3%` damage opponent fast moves at the optimal `500ms/turn` rate.
- **v3.65 – v3.66 — Key Feature: `100ms` (`10Hz`) Pixel HP Sampling, Turn-Scaled Debounce & Unified `1T–5T` Fast Move Engine**:
  - **v3.66**: Added turn-scaled debounce windows, `3T+` pending-damage sliver latching, adaptive damage filtering, and low-damage move multi-credit.
  - **v3.65**: Accelerated lightweight pixel HP/ball/shield scanning to `100ms` (`10Hz`) with a 2-successive-sample debounce across all `1T–5T` fast moves.
- **v3.64 — Key Feature: Dual-Rate `200ms` Pixel HP + `750ms` Async ML Kit OCR Architecture & Compact Right-Aligned Header Badges**:
  - Decoupled pixel HUD scanning (`200ms`) from asynchronous ML Kit OCR (`~750ms`), added the dual `HP:xxxms/OCR:xxxms` scan-rate badge, and right-aligned player and opponent telemetry badges (`HP%`, `E`, `🛡️`) separated by `|`.

---

## v3.60 – v3.63 (2026-10-25 – 2026-10-26) — Full PvPoke GameMaster Move Audit (251 Charged & All Fast Moves), Minimize & Pre-Sync ANR Fixes, and Opt-In Live HP/Energy Settings
*Functionally grouped release series auditing every fast and charged move against live PvPoke `gamemaster.json`, eliminating startup ANRs, and streamlining the overlay header.*

- **v3.63 — Key Feature: Minimize Bubble Touch-Race Fix, Pre-Indexed $O(1)$ Move Lookup Tables (ANR Fix) & Expanded Battle Matrix Replay**:
  - Fixed the top-left emblem minimize-to-restore touch race (`400ms` debounce guard), eliminated pre-sync ANRs via pre-indexed $O(1)$ static move/species maps and background thread cache loading, expanded the post-game Battle Matrix Replay `ScrollView`, and added the dynamic `--- ms` / last-battle average OCR badge.
- **v3.62 — Key Feature: Codebase Self-Healing & TypeScript/Kotlin Regression Verification Build**:
  - Restored strict type alignment across `TeamPreset.archetype`, `SlotCandidateEval`, `findPokemonByName`, and replay fast-move resolution with full TypeScript and Vite production build verification.
- **v3.61 — Key Feature: Authoritative PvPoke `gamemaster.json` Precedence & Zero-Discrepancy Fast/Charged Move Audit**:
  - Corrected 29 outdated charged move energy costs in `MOVE_ENERGY_COST` (including Body Slam `40e`, Rage Fist `40e`, Dynamic Punch `45e`, Aura Sphere `40e`, Brutal Swing `35e`, Surf `75p/45e`) and 29 fast moves (including Scratch `1t/3p/4e`, Dragon Breath `1t/3p/4e`, Mud Shot `2t/3p/9e`, Dragon Tail `3t/9p/12e`, Rollout `3t/7p/13e`, Hex `3t/7p/13e`), gave downloaded `gamemaster.json` top lookup priority, and guarded against `AEGISLASH_CHARGE_*` move collisions.
- **v3.60 — Key Feature: Opt-In Live HP & Energy Toggles (Default OFF), Predictive Bias-Error Energy Loop & 2s Hold Minimize to Battle Log**:
  - Added independent opt-in Settings toggles for **❤️ Live HP Bar Tracking** and **⚡ Live Energy & Fast-Move Counting**, streamlined the top overlay header row, and added a **2-second long-press** on the top-left minimize icon to stop the overlay and open the Battle Log.

---

## v3.40 – v3.55 (2026-10-24 – 2026-10-25) — Real-Time Floating HP Bar Scanner, 3-Slot Bench HP Memory, Symmetric Attack Headers & 7-Day AI Training Log Split
*Functionally grouped release series introducing in-memory floating HP bar pixel detection, per-slot bench HP persistence, live KO-threshold shield callouts, and turn-indexed energy.*

- **v3.54 – v3.55 — Key Feature: Overlay-Occluded & Shifted Pokémon HP Bar Detection + Post-KO Faint Energy Freeze**:
  - **v3.55**: Expanded floating HP bar detection corridors under overlay/text occlusion for smaller or laterally shifted Pokémon (e.g., Solgaleo and Mimikyu) and added a `2T+` move-duration cooldown.
  - **v3.54**: Added pending-damage-verified Turn-T fast move prediction, multi-move damage integration, turn-phased OCR capture, and post-KO faint energy freeze.
- **v3.51 – v3.53 — Key Feature: Symmetric `OPP ATTACKS` / `MY ATTACKS` Headers with Live Badges, `CMP✓/CMP✗` Indicators & Full Top-of-Screen Overlay Slide**:
  - **v3.53**: Added live HP/shield/energy badges to the `OPP ATTACKS` and `MY ATTACKS` section headers and 2-row Pokémon column headers with live `HP%`.
  - **v3.52**: Allowed the floating overlay to slide all the way to the top edge of the screen and locked 3-column matrix alignment.
  - **v3.51**: Introduced the damage-verified fast-move energy engine, symmetric attack headers, `CMP✓/CMP✗` tie indicators, and live swap countdown timers.
- **v3.50 — Key Feature: 2Hz/1Hz Turn-Indexed HP & Energy Engine, Shield Matrix Opponent Energy Readout & 7-Day AI Training Log Split**:
  - Introduced the turn-indexed HP & energy loop, added opponent energy readouts to the Shield Matrix, depleted player/opponent energy on charged moves, and split detailed AI training logs into a self-pruning 7-day store so permanent Battle Logs stay lightweight.
- **v3.43 – v3.46 — Key Feature: Full 4-Sided Outer Border Rectangle HP Scanner, Fuzzy Green/Yellow/Red Matching & Top-2 Shield Callouts with `M3/M4` KO Warnings**:
  - **v3.46**: Tightened HP bar border/color matching and fixed-height rectangle geometry to reject exterior color bleed from moving Pokémon models.
  - **v3.45**: Added fuzzy Green/Yellow/Red HP fill matching, left-border-keyed leftmost fill locking, and orange pending-damage sliver rejection.
  - **v3.44**: Added the 2-row top toolbar, 3-anchor HP tracking, fast-attack switch confirmation, charged-zoom guard, and top-2 shield callouts with `M3/M4` KO warnings.
  - **v3.43**: Implemented full 4-sided outer border rectangle HP bar measurement, expanded the player HP vertical corridor (`0.24h..0.69h`), and enabled bi-directional HP gauge updates on every scan.
- **v3.40 – v3.42 — Key Feature: Real-Time Floating HP Bar Scanner, Persistent 3-Slot HP Memory & KO-Threshold Shield Logic**:
  - **v3.42**: Kept the visual 3x3 shield matrix unscaled by HP while using live HP for active Pokémon selection and low-HP swap persistence.
  - **v3.41**: Calibrated floating HP bar scanner, added live My/Opp HP HUD pills, enforced `0%` HP on faints, and wired KO-threshold shield logic.
  - **v3.40**: Introduced the initial real-time floating HP bar scanner, persistent 3-slot bench HP memory, and charged attack tracking.

---

## v3.30 – v3.34 (2026-10-23 – 2026-10-24) — Duo-Core Team Builder, Turn-by-Turn Energy Cycle Simulator & Live Tactical Lead/Swap/Post-Faint Recommendations
*Functionally grouped release series adding real-time tactical battle recommendations (Lead, Swap, Counter-Swap Minimax, Post-Faint), Duo-Core team building, and turn-by-turn energy cycle simulation.*

- **v3.34 — Key Feature: Post-Faint Switch Recommendations, Counter-Swap Minimax, Midpoint Swap Clock & AI Training Log Export**:
  - Added post-faint optimal switch-in recommendations, Counter-Swap Minimax evaluation when the opponent swaps first, a 1st-frame midpoint swap clock with 2nd-frame validity latch, endgame shield/energy awareness, and AI training log export.
- **v3.33 — Key Feature: Turn-by-Turn Energy Cycle Battle Rating Simulator, Dynamic GameMaster Buff/Debuff Tables & Dominated Move Pruning**:
  - Replaced static DPS approximations in the BR engine with a turn-by-turn energy cycle simulator, ingested dynamic GameMaster move buff/debuff probabilities and stages (e.g., 100% Bulldoze `-1 DEF`), and pruned strictly dominated same-type moves.
- **v3.31 – v3.32 — Key Feature: Top-50 Core Breaker/Threat Analysis Depth, Streamlined Team Summary Cards & 2-Line Recommendation Row**:
  - **v3.32**: Added dynamic font resizing and intelligent 2-line wrapping for the live Battle Recommendation row on the floating overlay.
  - **v3.31**: Expanded Core Breaker and Key Threat analysis depth to the Top 50 Meta Pokémon, streamlined Team Summary cards, and fixed the Overlay Battle Recommendation row layout.
- **v3.30 — Key Feature: `DUO` (Duo-Core + Safe Pivot) Team Builder & Auto-Detection, Live Lead/Swap Tactical Recommendations Module & 2-Frame Shield Restoration Fix**:
  - Added `DUO` archetype classification and generation alongside `ABB` and `ABC`, introduced the live Lead & Swap Tactical Recommendations banner on the overlay, and fixed 2-frame false shield restoration.

---

## v3.10 – v3.23 (2026-10-21 – 2026-10-22) — Anti-Meta Team Builder (`ABB` / `ABC`), Top-200 Precomputed 9x9 Shield Matrix, Role Upgrades & Signature Form-Change Math
*Functionally grouped release series introducing the Anti-Meta Team Builder, O(1) precomputed Top-200 9x9 overlay shield matrix, Top-200 Role Upgrade engine, and special mechanics math (`Morpeko`, `Mimikyu`, `Aegislash`, `Cramorant`).*

- **v3.20 – v3.23 — Key Feature: Native Android & Web Anti-Meta Team Builder (`ABB` / `ABC`), Top-200 Precomputed 9x9 Shield Matrix & Featured Rank-Range Queries**:
  - **v3.23**: Added per-slot Battle Ratings (`Slot 1/2/3 BR`) on every Key Threat and Core Breaker, unified the Anti-Meta summary card across existing teams and the Team Editor, expanded the bottom SilphScope Meta reference list to the **Top 50** with Meta BR in parentheses, and added rank-range queries (`200-`, `-10`, `100-200`) in Featured Pokémon slots.
  - **v3.22**: Upgraded the Anti-Meta Team Builder to score against a **Top-100 role-weighted synthetic meta** blended with season battle logs, added 3-slot alternate moveset simulation (`⚡ Alt Moveset (+X BR)`), and added `✅ Key Wins` / `⚠️ Key Threats` / `🚨 Core Breakers` (`Beats X/25 Top Meta`).
  - **v3.21**: Brought the full interactive **Anti-Meta Team Builder (`ABB` / `ABC`)** to the native Android Team Presets page with one-tap team creation (`<League> Anti-Meta <YYYY-MM-DD>`).
  - **v3.20**: Precomputed the 9x9 weighted move-combo shield matrix for the active 3-Pokémon team against the **Top 200 League Meta** for $O(1)$ real-time overlay lookups, and scoped the Special Mechanics Math Validator strictly to in-battle form-changing Pokémon (`Morpeko`, `Cramorant`, `Aegislash`, `Mimikyu`).
- **v3.15 – v3.16 — Key Feature: Weighted Move-Combo 9x9 Shield Matrix Math (`75%` Default + `25%` Alternate Combos), Strict Legal Move Pool Audit & Team Moveset Optimizer**:
  - **v3.16**: Enforced strict legal move pools per species (fixing Mimikyu, Cramorant, Tinkaton, Kyogre, and Melmetal move pools) and dynamically normalized the 25% alternate move-combo weight across valid existing combos.
  - **v3.15**: Updated all 9 shield states (`0v0`–`2v2`) to weight `75%` default PvPoke moveset and `25%` across up to 5 alternate move combinations, and added the **`🎯 Simulate Moves & Propose Best 3 Alternate Movesets`** button in the Team Editor.
- **v3.13 – v3.14 — Key Feature: Single-Screen Unmasked Capture, Simultaneous Best-Match-Across-Team Player Switch OCR & Single-Tap Stop Overlay Fix**:
  - **v3.14**: Removed black-rectangle overlay/toast screen masking in single-screen scanner mode so HUD pixels underneath the floating overlay are never occluded.
  - **v3.13**: Replaced sequential Slot-0-first player switch matching with simultaneous best-match scoring across all 3 team members (with High-Contrast B&W nameplate extraction and `rn -> m` normalization so `"Swarnpert"` matches `"Swampert"` over `"Tinkaton"`), and fixed the **Stop Battle Overlay** button to restore on a single tap.
- **v3.10 – v3.12 — Key Feature: Top-5 Role Upgrade Recommendations (`Top-200` vs. `Top-100`), `Core BR` Rating Engine, `ABB`/`ABC` Auto-Detection & Signature Ability Math**:
  - **v3.12**: Expanded role upgrade suggestions to the **Top 5 per role** from the Top 200 candidate pool, renamed `Mach BR` to **`Core BR` (`Core Coverage BR`)**, and refined Mimikyu 2-strategy Disguise math and Aegislash Shield/Blade energy + damage shifts.
  - **v3.11**: Added the on-demand **`✨ Suggest Top-100 Role Upgrades`** engine in the Team Editor and implemented signature ability battle math for **Morpeko** (`Hunger Switch` + `Aura Wheel`), **Mimikyu** (`Disguise`), **Aegislash** (`Stance Change`), and **Cramorant** (`Gulp Missile`).
  - **v3.10**: Introduced automatic **`ABB` vs. `ABC`** team style classification with smart slot reordering, current-season blended meta weighting with exponential recency decay, and position-weighted Lead/Swap/Closer shield ratings.

---

## v3.02 – v3.08 (2026-10-19 – 2026-10-20) — 10-Theme Visual Engine, Interactive Overlay Shield Counters, League-Rated Form Autocomplete & Compact Battle Log Summaries
*Functionally grouped release series introducing the 10-theme customizer with Pokémon GO faction watermarks, interactive live shield counters on the overlay, and Battle Log usability refinements.*

- **v3.07 – v3.08 — Key Feature: League-Rated Default Form/Shadow Autocomplete, Strict Mew/Mewtwo Disambiguation, Repeated Daily Lead Highlighting & Compact Lead Matchup Box**:
  - **v3.08**: Added the compact `#+ / #o / #- / #u` Lead Matchups summary box and tightened daily summary row spacing in the Battle Log.
  - **v3.07**: Ordered Pokémon autocomplete suggestions by active-league PvPoke rating (automatically selecting the highest-rated form/Shadow variant), enforced strict word-boundary disambiguation between `Mew` and `Mewtwo`, highlighted repeated same-day opponent leads with unique lead counts, and added the **Yesterday** Battle Log filter.
- **v3.05 – v3.06 — Key Feature: Interactive Overlay Header Shield Counters (`0–2`) & Dual-Accent Themes (Including Shiny Origin Dialga Midnight)**:
  - **v3.06**: Added dual-accent theme tokens, the **Shiny Origin Dialga Midnight** theme, full modal/button/replay theming, and configurable page card transparency.
  - **v3.05**: Made the player and opponent shield badges in the floating overlay header interactive (`tap to cycle 2 -> 1 -> 0 -> 2`) with instant live 3x3 matrix recalculation.
- **v3.02 – v3.03 — Key Feature: 10-Theme Visual Engine with Faction/Sylveon Emblem Watermarks & Dynamic Floating Overlay Emblem Icons**:
  - **v3.03**: Extended theme styling across all modals, cards, and floating overlay headers, and added dynamic per-theme emblem icons on the minimized and expanded floating overlay.
  - **v3.02**: Introduced the 10-theme customization engine (Mystic, Valor, Instinct, Harmony, Sylveon Pink/Shiny, Origin Dialga, Dark/Light Slate) with watermark emblems and reorganized Settings.

---

## v2.90 – v3.01 (2026-10-17 – 2026-10-19) — SilphScope PvP v3.00 Milestone: Asymmetric 9-Shield Matrix (`0v0`–`2v2`), Blind Matchup Favorability (BMF), Dynamic Execution WAE & In-App Help Guide
*Functionally grouped 4-phase milestone series culminating in the `v3.00`/`v3.01` analytics release.*

- **v3.00 – v3.01 — Key Feature: Official `v3.00` Analytics Consolidation, Dedicated In-App `❓ Help & Metric Guide` Tab & Overlay HUD Help Modal**:
  - **v3.01**: Added the dedicated **❓ Help** navigation tab (`Teams / Battle Logs / Settings / Help`) and an interactive Help button/modal for the Overlay HUD.
  - **v3.00**: Consolidated Phases 1–4 of the v3.00 analytics architecture, added the in-app **Help & Metric Guide**, updated the standardized Share row format, and published the complete BMF & Dynamic Execution WAE documentation.
- **v2.96 – v2.97 — Key Feature: Standardized Go Battle Log Name Formatting, Tasker Automation Intent Hooks & Battle Recap Stability Fixes**:
  - **v2.97**: Standardized exported Pokémon names to match Go Battle Log conventions and added Android **Tasker** broadcast/activity intent hooks (`START_OVERLAY`, `STOP_OVERLAY`, `SET_TEAM_PRESET`).
  - **v2.96**: Resolved `UninitializedPropertyAccessException` on `prefs` when launching the post-game Battle Recap dialog and hardened replay bridge callback typing.
- **v2.94 – v2.95 — Key Feature: Top Status-Bar Battle Toasts, Reliable Opponent Faint Detection & Swap Clock Preservation on Faint**:
  - **v2.95**: Moved live battle toast notifications into the top status-bar/clock strip so they never cover bottom Charged Move buttons.
  - **v2.94**: Improved opponent faint detection accuracy, preserved the active 50s swap clock when a replacement Pokémon enters after a faint, and added shield/faint-swap toast alerts.
- **v2.90 – v2.93 — Key Feature: Phases 1–3 of v3.00 (Asymmetric 9-Shield Matrix, Timeline-Weighted Dynamic Execution WAE & 5-Stat Analytics Dashboard)**:
  - **v2.93 (Phase 3/4)**: Added the 5-stat Battle Log Analytics Dashboard (`WIN RATE`, `EXEC WAE`, `MATCHUP LUCK`, `CLUTCH WINS`, `BLUNDER LOSS`), 6 Primary Performance Badges, 5 Contextual Event Pills, and historical log migration.
  - **v2.91 (Phase 2/4)**: Added in-battle timeline event recording (`SWAP`, `SHIELD`, `FAINT`) and the duration-weighted **Dynamic Execution WAE** engine ($\sum \tau_k \cdot R_k$, faint margin scaling, and shield-in-pocket penalties).
  - **v2.90 (Phase 1/4)**: Introduced the **Asymmetric 9-Shield Matrix** (`0v0` through `2v2`), **Blind Matchup Favorability (BMF)** ($M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}$), and 75%-confidence meta-prior handling for unrevealed 3rd opponent Pokémon.

---

## v2.30 – v2.36 (2026-10-15 – 2026-10-17) — Swap Clock Timers, Pokéball Lobe Faint Detection, Shield Tracking & Configurable 5-Tier Matchup Thresholds
*Functionally grouped release series introducing live 50-second swap timers, top-corner Pokéball & shield pixel detection, and customizable 5-tier rating thresholds.*

- **v2.36 — Key Feature: Per-Team Daily Log Share Format, `Copy GBL` Clipboard Export & Configurable 5-Tier Matchup Thresholds (`SW / W / N / L / SL`)**:
  - Added per-team grouped daily log sharing, one-tap `Copy GBL` clipboard export, and user-configurable 5-tier matchup rating thresholds in Settings.
- **v2.34 – v2.35 — Key Feature: 36px Pokéball Lobe Segmentation, Dual Red+Grey Faint Verification & Faint Resurrection Guard**:
  - **v2.35**: Calibrated 36px Pokéball upper/lower lobe sampling, dual red+grey faint verification, and swap clock preservation across faints.
  - **v2.34**: Added Pokéball lobe segmentation, 3-Pokémon swap clock reset at battle start, and a faint resurrection guard.
- **v2.32 – v2.33 — Key Feature: 50s Swap Clock Timers, Live Protect Shield Tracking & Fainted Column Dimming**:
  - **v2.33**: Integrated live swap clock timers, automatic shield icon tracking, and fainted Pokémon column dimming on the floating overlay.
  - **v2.32**: Introduced initial swap clock countdown timers, dynamic threshold alerts, and faint state visual dimming.
- **v2.30 – v2.31 — Key Feature: Battle Toast Notification Toggle & Clean v2.15 Re-Baseline**:
  - Added a Settings toggle to enable or disable on-screen Battle Toast messages and re-baselined the clean release pipeline.

---

## v2.00 – v2.27 (2026-10-12 – 2026-10-15) — SilphScope PvP Rebrand, Per-League Battle Logging, Multi-Device GitHub Cloud Delta Sync, Battle Quality WAE & Post-Game Interactive Replay
*Functionally grouped release series introducing the Battle Log system, N-device GitHub Cloud Delta Sync, interactive post-game overlay replay, and the rebrand to SilphScope PvP.*

- **v2.20 – v2.27 — Key Feature: Experimental HUD Telemetry Prototypes (Subsequently Re-Baselined in `v2.31`)**:
  - Explored early experimental HUD layout and OCR prototypes between `v2.20` and `v2.27` before re-baselining cleanly onto the stable `v2.15` core in `v2.31`.
- **v2.13 – v2.15 — Key Feature: Dual-Type Effectiveness & CP/IV Stat Scaling Fix, Ice Punch Damage Calibration & Reparse Completed Battles Tool**:
  - **v2.15**: Fixed Ultra League Zygarde / Shadow Annihilape charged move damage scaling, removed stale root-file overwrites in CI, and added a Settings action to **Reparse All Completed Battles**.
  - **v2.13**: Resolved dual-type effectiveness multiplication, CP/IV combat stat scaling, and Shadow status persistence across battles.
- **v2.10 – v2.12 — Key Feature: Initial Battle Quality (WAE) Metrics, Streamlined `W/L(ExpectedWin%)` Log Sharing & Post-Stop Battle Logging Prompt**:
  - **v2.12**: Unified the Start/Stop Battle button with an optional prompt to log the battle when stopping the overlay.
  - **v2.11**: Streamlined text log sharing into a summary header plus `W/L(ExpectedWin%) MyTeam vs. Opp1,Opp2,Opp3` rows.
  - **v2.10**: Introduced initial Battle Quality (WAE) metrics, performance badges, and retroactive battle log migration.
- **v2.03 – v2.05 — Key Feature: Official Rebrand to `SilphScope PvP`, Deleted Battle Log Trash Bin + Undo Restoration, Go Battle Log Export & Instant Start-Battle Reset**:
  - **v2.05**: Immediately resets the detected opponent list and 3x3 matrix when tapping **Start Battle**.
  - **v2.04**: Rebranded the GitHub repository and GitHub Pages simulator to **SilphScope PvP** and fixed Battle Log header wrapping.
  - **v2.03**: Renamed the app from *BattleMatrix GBL* to **SilphScope PvP**, blocked menu words (`Battle` / `Party`) from triggering OCR, added a **Trash Bin + Undo** restoration modal for deleted logs, and added **Go Battle Log** CSV/JSON export.
- **v2.00 – v2.02 — Key Feature: Per-League & Per-Team Battle Logging, Interactive Post-Game Overlay Replay & In-App GitHub OAuth Multi-Device Cloud Delta Sync**:
  - **v2.02**: Added in-app **GitHub OAuth Device Login** for isolated per-user cloud sync without hardcoded tokens.
  - **v2.01**: Upgraded cloud sync to automatic **N-device multi-device delta sync** on app open with optimistic concurrency retry.
  - **v2.00**: Introduced per-league/per-team Battle Logging, lead matchup tracking, ScrapedDuck GBL season integration, log edit/delete controls, **Interactive Post-Game Overlay Replay**, and 2-device cloud delta sync.

---

## v1.00 – v1.30 (2026-10-08 – 2026-10-12) — Foundation Releases: 3x3 Damage Matrix Overlay, Live PvPoke Rankings Sync, 4-League Team Builder & Floating Minimize Bubble
*Functionally grouped foundational release series establishing the Android floating overlay, ML Kit OCR pipeline, PvPoke GameMaster/rankings sync, and interactive Web Simulator.*

- **v1.30 — Key Feature: 3-Page Main App Navigation (`Teams / Settings / Battle Log`), Background Transparency Slider & Draggable App-Icon Minimize Bubble**:
  - Split the main Android app into dedicated `Teams`, `Settings`, and `Battle Log` pages, added the floating overlay background glass transparency slider, and added the draggable app-icon minimize bubble.
- **v1.20 – v1.23 — Key Feature: Live PvPoke League Rankings Sync (`1500 / 2500 / 10000 / Mega`), Regional/Alternate Form Autocomplete & 4-Charged-Move Overlay Option**:
  - **v1.23**: Added the optional 4-Charged-Move overlay display mode, 4-league pre-flight gate, live GameMaster/rankings sync telemetry, and fixed null move-usage parsing in GL/UL rankings.
  - **v1.21 – v1.22**: Applied live PvPoke league rankings movesets (primary moveset + top-usage 3rd charged move) to OCR-detected opponents and fixed regional form moveset resolution (e.g., Alolan Ninetales, UL Snorlax, Greninja, Skeledirge).
  - **v1.20**: Added live PvPoke rankings synchronization, Mega Master League support, Team Builder regional/alternate/Shadow form autocomplete, and drag-and-drop team presets.
- **v1.00 – v1.11 — Key Feature: Initial Public Release, Turn-Aligned Multi-Cycle Move Bars, `50%–100%` Overlay Scale Slider & Persistent League Teams**:
  - **v1.11**: Added persistent team presets across app updates, PvPoke Top-3 default league teams, auto-filled moves, and League CP/IV stat scaling.
  - **v1.10**: Added the custom app icon, status bar inset alignment, Buy Me a Coffee support link, and the `50%–100%` overlay width scale slider (`78%` default tick).
  - **v1.00**: Initial release featuring the real-time 3x3 damage matrix floating overlay, turn-aligned multi-cycle move timing bars, `My Fasts` vs. `Their Fasts` move count basis toggle, and automated GitHub Release APK publishing.
