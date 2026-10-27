# SilphScope PvP Changelog

## [v3.85] — 2026-10-27 — 2-Channel Kalman Filter Energy Meter Smoothing, 3rd-Fill Cycle Confidence Reduction & Slower Charge Move Meter Prioritization
- **2-Channel Kalman Filter Energy Meter Smoothing (`OverlayService.kt`)**:
  - Replaced the fixed `300ms` charge circle debounce with a state-space Kalman Filter (`updatePlayerEnergyKalmanFilter`) that fuses predicted fast-move turn timestamp energy deltas (`+fastEnergy` at each `500ms * fastMoveTurns` boundary) with observed Left (`Move 1`) and Right (`Move 2`) charge circle fill percentages (`0..200%`).
  - **Animation Lag Compensation**: Within `0..340ms` after a fast move turn boundary, inflates measurement noise covariance $R$ (`4.5x`) for negative innovations (`innov < -2.0`) so rising fill animation lag never drags tracked energy backward while immediately accepting corroborated upward steps with low latency.
  - **Transient OCR & Meniscus Noise Suppression**: Dynamically inflates $R$ in the central move-type icon crossing band (`43..57%` and `143..157%`) and applies a quadratic Huber outlier penalty (`(absInnov / 18.0)^2`) to uncorroborated single-frame spikes while tightening $R$ (`0.45x`) when both meters step in agreement.
  - **Zero-Drop Immunity**: Never allows disappearing (`-1`) or `0%` circles during Charged Move animations or camera transitions to pull non-zero combat energy down to zero.
- **3rd-Fill Cycle Confidence Reduction & Slower Charge Move Prioritization (`OverlayService.kt`)**:
  - Tracks per-slot double-fill latches (`leftMeterFilledTwiceLatched`, `rightMeterFilledTwiceLatched`) once a charge move meter has filled twice (`>= 2 * cost` or `>= 188%` on its second cycle) and enters a 3rd fill cycle.
  - Once a faster meter has filled twice and is filling a 3rd time (`leftInThirdFill` / `rightInThirdFill`), its confidence weight is reduced (`0.15x..0.25x`, measurement variance $R$ inflated `~5.5x`) and the **slower (higher-energy-cost) charge move meter** is elevated as higher value (`1.65x..2.25x` confidence weight) across `updatePlayerEnergyKalmanFilter`, `computeAuthoritativeCircleEnergy`, and `evaluateTwoOutOfThreePllVote` (including a Slower-Meter High-Value Override when the faster meter saturates in its 3rd fill).

## [v3.83] — 2026-10-27 — 2-out-of-3 Majority-Vote PLL (Integrated Opponent HP + Charge Move 1 + Charge Move 2), 3-Sample / 300ms Meter Debounce, Phase-Locked Fast-Move Auto-Increment & Wider Tinkaton HP Bounds
- **2-out-of-3 Majority-Vote PLL (Phase-Locked Loop) Sensor Fusion (`OverlayService.kt`)**:
  - Combines 3 independent sources of truth for player fast moves and energy:
    1. **Opponent Fast-Move HP Integrator**: Integrates confirmed fast-move HP drops (`1..maxFastSingleDrop%`) over turns within each combat stint (`playerStintOppFastDmgPct / userExactDmgPct`) to eliminate single-turn integer `%` quantization jitter while strictly ignoring Charged Move damage (`> 25%` drops and active charged move windows).
    2. **Charge Move 1 Circle (Left Button)**: 3-sample and `>= 300ms` debounced fill reading (`1..92%` primary fill, `100%` ready ring, and `101..200%` overcharge ring).
    3. **Charge Move 2 Circle (Right Button)**: 3-sample and `>= 300ms` debounced fill reading (`1..92%` primary fill, `100%` ready ring, and `101..200%` overcharge ring).
  - Evaluates both direct 2-out-of-3 directional votes and the closest-agreeing pair (including saturated `100%` ready-ring compatibility when one move is full and the second move + Opponent HP track overcharge up to `100E`), adjusting energy by at most `±1` fast move per fast-move duration (`500ms * fastMoveTurns`) while preserving leftover charged move energy deltas.
  - **Shield Choice Delay Validation**: Validates settled Opponent fast-move HP drops alongside pre-prompt Charge Move 1 & 2 circle readings right at the start of Opponent (`"Attack incoming!"` / `"No Protect Shields remaining!"`) and Player shield choice delays before charged move damage is applied.
- **3-Sample & `>= 300ms` Charge Circle Debounce + Zero-Drop Protection (`OverlayService.kt`)**:
  - Requires at least 3 consecutive consistent samples and `>= 300ms` stability before accepting a Charge Move meter reading.
  - Prevents disappearing or dimmed Charge Move circles (`-1` or `0%`) during Charged Move animations or camera cuts from ever resetting or dropping combat energy to zero.
- **Phase-Locked End-of-Fast-Move Auto-Increment & Opponent Turn Mapping (`OverlayService.kt`)**:
  - Anchors the fast-move auto-increment oscillator (`500ms * fastMoveTurns`) to the start timestamp of the last successful `300ms` meter debounce so player energy increments in phase with the meter moving at the end of each fast move duration (not every 0.5s turn unless using a 1-turn move).
  - Maps confirmed player fast-move energy increments directly to battle turns (`phasePlayerTurns`) for counting opponent fast moves and energy.
- **Expanded Floating HP Bar Vertical Corridors & Tinkaton Border Classifier (`OverlayService.kt`)**:
  - Widened floating HP bar vertical scan corridors (`0.055h..0.14h` for tall opponents and `0.60h..0.88h` for small/low player Pokémon) and relaxed capsule border chroma tolerances to reliably detect Tinkaton's floating HP bar across devices.
- **0-Shield Prompt Attribution (`"No Protect Shields remaining!"`) & Adaptive 3-2-1-GO Circle Calibration (`OverlayService.kt`)**:
  - Treats `"No Protect Shields remaining!"` (and the 0-shield hidden-bottom-circles + visible-opponent-HP visual signature) as an incoming opponent Charged Attack targeting the player.
  - Added adaptive 3-2-1-GO prescan circle geometry and empty-interior luma/saturation baseline calibration across multi-device aspect ratios.

## [v3.64] — 2026-10-26 — 200ms Pixel HP + 750ms Async OCR Dual-Rate Loop, Pending-Damage Sliver Latch, 3-Tier PID Energy Observer & Compact Right-Aligned Header Row
- **Dual-Rate Screen Sampling Architecture (`200ms` Pixel HP Loop + `~750ms` Async ML Kit OCR Loop) (`OverlayService.kt`)**:
  - Decoupled lightweight pixel-only HUD scanning (`detectFloatingHpBarPct` + pending-damage sliver extraction + `detectActivePokeballCount` + `detectActiveShieldCount`) onto a dedicated **`200ms` (`5 Hz`)** loop so every `0.5s` Pokémon GO PvP turn is sampled ~2.5 times per turn with `<5ms` frame-read overhead.
  - Moved heavy ML Kit Text Recognition (`textRecognizer.process()`) onto an asynchronous **`~750ms`** background cadence with an `@Volatile var isOcrPassInFlight` guard so OCR never blocks the 200ms HP/energy loop.
- **Pending-Damage Sliver Latch-and-Lock State Machine (`OverlayService.kt`)**:
  - For 2-turn and 3–5-turn fast moves, the energy state machine immediately credits **+1 fast move's energy** as soon as a valid orange pending-damage sliver appears while `ARMED`, and locks into `LOCKED_UNTIL_HP_DROP` (`playerSliverLockedUntilDrop` / `oppSliverLockedUntilDrop`) until the solid HP bar physically drops—eliminating multi-frame double-counting while auto-rolling back if interrupted by a charged move or swap.
- **Three-Tier Closed-Loop PID Energy Observer (`OverlayService.kt`)**:
  - **Tier 1 (Per-Turn PID Micro-Adjustments)**: Integrates floating-point expected vs. observed HP damage on every confirmed HP drop and applies bounded `±1 move` micro-adjustments, clamping single-step increments to at most `+1 move` unless 2 full move cooldowns elapsed (fixing the v3.53 Mimikyu Shadow Claw `+16E` double-count bug).
  - **Tier 2 (Cross-Pacing Against 3T+ Opponent Fast Moves)**: When the opponent uses a 3T/4T/5T fast move (`oppFastTurns >= 3`), uses confirmed opponent fast-move turn counts (`oppCreditedMoves * oppFastTurns`) as an authoritative turn clock to reconcile missed 1T/2T player fast moves.
  - **Tier 3 (Charged-Move Stable HP Window Reconciliation)**: Reconciles cumulative fast-move energy in the preceding combat window against settled pre-charged-move HP loss during the ~10s Charged Move camera zoom / shield prompt window, while preserving strict freeze gates during swaps and faints.
- **Temporary Setting to Enable/Disable Damage PID Loop (Default Enabled) (`MainActivity.kt`, `activity_main.xml`, `OverlayService.kt`, `src/App.tsx`)**:
  - Added a toggle in Settings (**`🎯 Damage PID Loop: ENABLED (Default)`** / **`DISABLED (200ms Scan Only)`**) so the 3-tier PID loop can be toggled on or off to isolate and test whether the `200ms` pixel HP scan + pending sliver latch alone resolves energy resolution.
- **Top Overlay Header Row Enhancements (`overlay.html`, `OverlayService.kt`, `src/App.tsx`)**:
  - **Dual Scan Rate Badge**: Updated `#sky-ocr-ms-badge` to display **`HP:xxxms/OCR:xxxms`** (with `HP:---ms/OCR:---ms` before the first scan and last-battle averages between battles).
  - **Dark Charged-Move Row Background**: Styled `.header-row` with `background: rgba(2, 6, 23, var(--row-bg-alpha)); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 4px;` matching the charged move rows for crisp readability.
  - **Right-Aligned Player & Opponent Badges with `|` Separator**: Right-aligned both My (`HP%`, `E`, `🛡️`) and Opponent (`🛡️`, `HP%`, `E`) badge groups in `.header-badges-cluster` separated by a compact vertical bar (`|`) so all live combat telemetry can be read in a single glance.

## [v3.63] — 2026-10-26 — Minimize Button Fix, Pre-Sync OCR Performance & ANR Fix, Expanded Battle Matrix Replay & Dynamic OCR Rate Badge
- **Minimize Overlay Button Fix (`overlay.html`, `OverlayService.kt`)**:
  - Fixed a touch-event race where tapping the top-left overlay emblem (`#btn-minimize-sword`) immediately triggered a synthetic click on `#minimized-bubble` at `(0, 0)`, causing the overlay to instantly restore while `WindowManager` was resizing the view to `48dp` (leaving the overlay clipped/shrunk at 45% scale).
  - Added a `400ms` minimize-to-restore debounce guard, disabled pointer events on `#minimized-bubble` during the transition frame, locked `applyProportionalScale()` against transient `<120px` bubble viewports, and removed premature `onpointerleave` cancellation so single taps reliably minimize into the floating bubble and pause OCR.
- **First-Run / Pre-PvPoke-Sync Performance & ANR Elimination (`OverlayService.kt`, `MainActivity.kt`)**:
  - Eliminated per-call `Regex` compilation and linear `.entries.firstOrNull` / `.find` table scans inside `resolveChargedMoveStatsStatic`, `resolveFastTurnsStatic`, `resolveFastEnergyStatic`, `resolveFastPowerStatic`, `resolveFastTypeStatic`, and `FormResolver.extractBaseSpecies` by introducing pre-indexed $O(1)$ lookup maps (`STATIC_MOVE_DATABASE_LOOKUP`, `STATIC_MOVE_ENERGY_LOOKUP`, `STATIC_EXACT_BASE_SPECIES_MAP`, and `BASE_SPECIES_CACHE`).
  - Removed synchronous main-thread JSON file I/O (`loadCachedRankingsSynchronously()`) from `OverlayService.onCreate()` and sequenced `MainActivity` startup preset recalculation to run on background threads after Gamemaster cache checks, preventing `"SilphScope PvP isn't responding"` ANRs and pre-sync frame rate slowdowns.
- **Expanded Battle Matrix Replay Container (`MainActivity.kt`, `overlay.html`)**:
  - Wired `ReplayJavascriptBridge.updateContentHeight(heightDp)` to dynamically size the replay `WebView` to the full rendered height of the overlay and wrapped the replay dialog in a smooth vertical `ScrollView`, ensuring all rows of `MY ATTACKS` are completely visible without being clipped or stuck behind a non-scrolling inner scrollbar.
- **Dynamic OCR Frame Rate Badge (`--- ms` Initial & Between-Battle Average) (`OverlayService.kt`, `overlay.html`, `src/App.tsx`)**:
  - Replaced the hardcoded `220ms` startup default with `--- ms` until the first real OCR scan completes.
  - Added per-battle scan duration tracking (`lastBattleAvgScanMs`) so that between battles (after stopping or logging a battle and while waiting for the next battle), the header badge displays the average frame rate of the last scanned battle until live OCR scans resume.

## [v3.62] — 2026-10-25 — Codebase Cleanup & Regression Testing Build
- **Codebase Cleanup & Self-Healing (Chat History Recovery)**:
  - Cleaned up syntax and typing inconsistencies caused by corrupt chat history in AI Studio.
  - Restored React `useRef` import in `src/App.tsx`.
  - Harmonized `TeamPreset.archetype` type definition with `TeamArchetype` (`"ABB" | "ABC" | "DUO"`), resolving type checks across presets, modal forms, and tactical playbooks.
  - Restored and exported `findPokemonByName` utility in `src/data/gblData.ts` for species and shadow lookups.
  - Added species typing metadata to `SlotCandidateEval` and candidate moveset evaluation loops in `src/data/gblData.ts`.
  - Aligned simulated fast-move damage lookup (`oppFastInfo.percentage`) and archetype playbook tactics (`pb.proTactics`) in `src/App.tsx`.
  - Resolved `PokemonStats` before calling `resolveFastMove` in post-game replay inspector.
- **Regression Testing**:
  - Validated 100% clean TypeScript type check (`npm run lint` / `tsc --noEmit`).
  - Validated clean Vite production bundle compilation (`npm run build`).

## [v3.61] — 2026-10-25 — Authoritative PvPoke GameMaster Fast & Charged Move Precedence, Scratch Energy Fix (`1t/4e`) & Full Move Discrepancy Audit
- **Comprehensive Charged Move Validation & Discrepancy Fixes (`OverlayService.kt`, `src/data/gblData.ts`, `src/App.tsx`)**:
  - Validated all 251 PvPoke charged moves against internal code tables; identified and resolved the same static fallback discrepancy issue that affected fast moves:
    - **`MOVE_ENERGY_COST` in `OverlayService.kt`**: Corrected 29 outdated energy values to 100% align with live PvPoke `gamemaster.json` (Bulldoze: `45` → **`55`**, Body Slam: `35` → **`40`**, Aura Sphere: `55` → **`40`**, Rage Fist: `35` → **`40`**, Dynamic Punch: `50` → **`45`**, Dazzling Gleam: `70` → **`55`**, Aerial Ace: `40` → **`45`**, Shadow Sneak: `45` → **`50`**, Energy Ball: `55` → **`45`**, Seed Bomb: `45` → **`40`**, Discharge: `45` → **`40`**, Scald: `55` → **`50`**, Sand Tomb: `40` → **`45`**, Rock Tomb: `60` → **`50`**, Gyro Ball: `60` → **`50`**, Bubble Beam: `40` → **`50`**, Brine: `50` → **`60`**, Foul Play: `45` → **`40`**, Hurricane: `65` → **`60`**, Psyshock: `45` → **`40`**, Night Shade: `55` → **`45`**, Dragon Pulse: `60` → **`55`**, Brutal Swing: `40` → **`35`**, Flash Cannon: `70` → **`65`**, Magnet Bomb: `45` → **`40`**, Water Pulse: `55` → **`50`**, Twister: `45` → **`40`**, Air Cutter: `45` → **`40`**).
    - **`MOVE_DATABASE` in `OverlayService.kt`**: Corrected Bulldoze (`45p / 45e` → **`80p / 55e`**), Dive (`80p / 45e` → **`50p / 40e`**), and Springtide Storm (`60p / 50e` → **`60p / 45e`**).
    - **`CHARGED_MOVE_FALLBACK_STATS` in `src/data/gblData.ts`**: Corrected Bulldoze (`80p / 55e`) and Dive (`50p / 40e`).
    - **`POKEMON_DATABASE` static entries in `src/data/gblData.ts`**: Corrected Earthquake (`110p` → **`120p / 65e`** on Armored Mewtwo), Dynamic Punch (`85p` → **`90p / 45e`** on Armored Mewtwo), Gyro Ball (`60e` → **`50e / 80p`** on Aegislash), Double Iron Bash (`50p` → **`70p / 35e`** on Melmetal), Psyshock (`45e` → **`40e / 70p`** on Mew), and Surf (`65p / 40e` → **`75p / 45e`** on Mew).
  - **Dynamic Charged Move Ingestion & Multi-Key Normalization**:
    - `DYNAMIC_MOVE_DATABASE` in `OverlayService.kt` and `DYNAMIC_CHARGED_MOVE_MAP` in `src/data/gblData.ts` now index all normalized key representations (`nameKey`, `idKey`, `spaceKey`, `hyphenKey`, `underscoreKey`), guaranteeing dynamic PvPoke GameMaster precedence over static tables regardless of casing, hyphens, or underscores.
    - Updated `resolveChargedMoveStatsStatic` in `OverlayService.kt` and `buildChargedMoveFromName` in `src/data/gblData.ts` to query dynamic tables across all normalized key variations before falling back to static tables.
    - Exported `resolveChargedMove` in `src/data/gblData.ts` and integrated it across `src/App.tsx` for shield deductions, unshielded damage inferences, and telemetry badges.
    - `syncPvPokeDataAndRankings` now actively refreshes all charged moves on `POKEMON_DATABASE` entries with live GameMaster data.
  - Automated verification script confirmed **0 discrepancies** across all 251 charged moves against live PvPoke `gamemaster.json`.
- **Authoritative Dynamic GameMaster Lookup Precedence for Fast Moves (`OverlayService.kt`, `src/data/gblData.ts`, `src/App.tsx`)**:
  - Fixed fast-move resolution in `OverlayService.kt` (`updateLiveHpAndEnergyFromFrame`, `captureAndRecognize`, `buildBattlePayloadJson`) and `src/App.tsx` / `src/data/gblData.ts` where static fallback maps (`FAST_MOVE_ENERGY`, `FAST_MOVE_TURNS`, `FAST_MOVE_TURN_LOOKUP`) were evaluated before the downloaded PvPoke `gamemaster.json` tables (`DYNAMIC_FAST_ENERGY`, `DYNAMIC_FAST_TURNS`, `FAST_MOVE_STATS`).
  - Added `resolveFastTurnsStatic`, `resolveFastEnergyStatic`, `resolveFastPowerStatic`, and `resolveFastTypeStatic` so live downloaded `gamemaster.json` values always take top priority across all battle simulations, move-timing horizons, and live OCR energy loops.
- **Aegislash Shield-Forme Move Collision Guard & Hyphen/Space Normalization (`OverlayService.kt`, `src/data/gblData.ts`)**:
  - Prevented `AEGISLASH_CHARGE_AIR_SLASH` and `AEGISLASH_CHARGE_PSYCHO_CUT` (`0p / 6e` at the end of PvPoke's `gamemaster.json`) from overwriting canonical `Air Slash` (`3t / 9p / 9e`) and `Psycho Cut` (`2t / 4p / 9e`), and normalized hyphen/space keys (`Lock-On` / `Lock On`, `Mud-Slap` / `Mud Slap`).
  - Also ensured `syncPvPokeDataAndRankings` refreshes `defaultFastMove` on all existing `POKEMON_DATABASE` entries after syncing `gamemaster.json`.
- **Full Fast-Move Discrepancy Audit & Sync Against Latest PvPoke `gamemaster.json`**:
  - **Scratch** (e.g. Rillaboom): `1t / 4p / 2e` → **`1t / 3p / 4e`**
  - **Dragon Breath**: `1t / 4p / 3e` → **`1t / 3p / 4e`**
  - **Bite**: `1t / 4p / 2e` → **`1t / 2p / 4e`**
  - **Quick Attack**: `1t / 5p / 7e` → **`2t / 5p / 8e`**
  - **Fury Cutter**: `1t / 2p / 4e` → **`1t / 3p / 4e`**
  - **Bug Bite**: `1t / 3p / 3e` → **`1t / 4p / 3e`**
  - **Psycho Cut**: `2t / 3p / 9e` → **`2t / 4p / 9e`**
  - **Mud Shot**: `2t / 4p / 8e` → **`2t / 3p / 9e`**
  - **Powder Snow**: `2t / 5p / 8e` → **`2t / 6p / 8e`**
  - **Wing Attack**: `2t / 5p / 7e` → **`2t / 5p / 8e`**
  - **Peck**: `2t / 6p / 6e` → **`2t / 6p / 8e`**
  - **Thunder Shock**: `2t / 3p / 9e` → **`2t / 4p / 9e`**
  - **Bullet Punch**: `2t / 6–8p / 7e` → **`2t / 7p / 7e`**
  - **Low Kick**: `2t / 4p / 7e` → **`2t / 6p / 8e`**
  - **Metal Claw**: `2t / 6p / 7e` → **`2t / 5p / 7e`**
  - **Leafage**: `2t / 6p / 7e` → **`2t / 6p / 8e`**
  - **Steel Wing**: `2t / 7p / 6e` → **`2t / 7p / 5e`**
  - **Ember**: `2t / 7p / 6e` → **`2t / 4p / 9e`**
  - **Dragon Tail**: `3t / 13p / 9e` → **`3t / 9p / 12e`**
  - **Waterfall**: `3t / 12p / 8e` → **`3t / 11p / 10e`**
  - **Geomancy**: `3t / 4p / 13e` → **`3t / 8p / 13e`**
  - **Mud-Slap**: `3t / 12p / 10e` → **`3t / 11p / 10e`**
  - **Charm**: `3t / 15p / 6e` → **`3t / 12p / 8e`**
  - **Bubble**: `3t / 7p / 11e` → **`3t / 8p / 11e`**
  - **Rollout**: `3t / 8p / 13e` → **`3t / 7p / 13e`**
  - **Hex**: `3t / 8p / 12e` → **`3t / 7p / 13e`**
  - **Gust**: `4t / 16p / 12e` → **`4t / 16p / 14e`**
  - **Confusion**: `4t / 16p / 12e` → **`4t / 16p / 14e`**
  - **Volt Switch**: `4t / 12p / 16e` → **`4t / 14p / 16e`**

## [v3.60] — 2026-10-25 — Predictive + Self-Correcting Bias-Error Energy Loop, Opt-In HP/Energy Settings, Streamlined Header Row & 2s Hold to Battle Log
- **Opt-In HP & Energy Tracking (Disabled by Default)**: Added separate settings in **⚙️ Settings** to enable or disable **❤️ Live HP Bar Tracking** and **⚡ Live Energy & Fast-Move Counting** (defaulting to **OFF** for any user who has not installed `v3.40` or higher).
- **Predictive + Self-Correcting Bias-Error Fast-Move & Energy Loop**: Combines zero-lag feed-forward turn prediction with an online EMA per-move damage estimator ($\hat{d}$) and damped $\pm 1$ move residual self-correction.
- **Streamlined Overlay Header Row & 2s Hold to Battle Log**: Displays only Minimize/Pause OCR icon, OCR update rate in `ms`, My Health/Energy/Shield badges, and Opp Shields/Health/Energy badges; holding the minimize icon for 2 seconds stops the overlay and opens the Battle Log.

## [v3.23] — 2026-10-22 — Key Threats/Core Breakers Per-Slot BRs, Anti-Meta Summary on Existing Teams & Editor, Top-50 Meta List with Meta BR, and Featured Rank Range Queries (`200-`, `-10`, `100-200`)
- **Key Threats & Core Breakers Per-Slot Battle Ratings (`OverlayService.kt`, `gblData.ts`, `MainActivity.kt`, `App.tsx`)**:
  - Formatted every entry in **Key Threats** and **Core Breakers** with its Battle Rating against each of your 3 team slots in parentheses — e.g. `Key Threats: Corviknight(700/500/400), ...` (`Slot 1 Lead / Slot 2 Safe Swap / Slot 3 Closer`).
- **Anti-Meta Generator Look & Feel + Team Summary on Existing Teams (Viewer & Editor) & Auto-Detect Refresh (`MainActivity.kt`, `OverlayService.kt`, `App.tsx`, `gblData.ts`)**:
  - Unified the **Team Presets Viewer** and **Edit Team Screen/Modal** with the Anti-Meta Generator card look and feel (`Core BR`, `Lead BR`, `Swap BR`, `Closer BR`, `Beats X/25 Top Meta`, `⚡ Alt Moveset` badges, and the 3-box `✅ Key Wins` / `⚠️ Key Threats (Slot 1/2/3 BR)` / `🚨 Core Breakers (Slot 1/2/3 BR)` breakdown + full `synergySummary`), while preserving all controls to edit Pokémon, moves, IVs, and CP.
  - Automatically computes the full summary for existing teams and refreshes it whenever you click **`⚡ Auto-Detect Style & Order Swap`**.
- **Expanded Bottom SilphScope Meta List from Top 25 to Top 50 with Meta Battle Ranking in Parentheses**:
  - Expanded the SilphScope meta reference list at the bottom of the Anti-Meta Team Builder card to the **Top 50 Meta Pokémon** (`#1` to `#50`) and included each Pokémon's **Meta Battle Ranking (`BR`)** in parentheses alongside its field usage share (e.g. `#1 Clodsire (548 BR • 3.2%)`).
- **Rank Range Option in Featured Pokémon Slots (`200-`, `-10`, `100-200`)**:
  - Added rank-range constraint support in Featured Pokémon #1 and #2:
    - `200-` — requires a spice Pokémon ranked **`#200` or lower**
    - `-10` — requires a Pokémon ranked in the **Top 10 (`#1–#10`)**
    - `100-200` — requires a Pokémon ranked **between `#100` and `#200`**

## [v3.22] — 2026-10-22 — Top-100 Role-Weighted Anti-Meta Team Builder, 3-Slot Alternate Moveset Simulation, Key Wins / Key Threats / Core Breakers & Top-25 SilphScope Meta Audit
- **Top-100 Flattened Role-Weighted Synthetic Meta Blended with Season Logs (`gblData.ts`, `OverlayService.kt`)**:
  - Upgraded the Anti-Meta Team Builder (`ABB` / `ABC`) to build and score all candidate lineups (`Core BR`, `Lead BR`, `Swap BR`, `Closer BR`) against a **Top-100 flattened synthetic meta** ($\exp(-0.022 \cdot i)$) weighted heaviest on the most common Pokémon for each role (`Lead`, `Safe Swap`, `Closer`) and blended with your current-season battle logs (`wHist` + `wMeta`).
  - Expanded the candidate team generation pool to the **Top 60+ Meta Pokémon** per league while enforcing GBL species-clause and Mega Master League constraints.
- **`Beats X/25 Top Meta` Target Depth & Bottom Top 25 SilphScope Meta Reference Card (`App.tsx`, `MainActivity.kt`, `gblData.ts`, `OverlayService.kt`)**:
  - Increased the Top Meta target audit depth displayed on each generated ABB and ABC team card from `/15` to **`/25` (`Beats X/25 Top Meta`)**.
  - Added a **"🎯 Top 25 <League> Meta Determined by SilphScope (Target Audit Pool for /25 Wins)"** reference section at the bottom of the Anti-Meta Team Builder card listing `#1` through `#25` with species name and field weight percentage (`%`).
- **3-Slot Alternate Moveset Simulation & `⚡ Alt Moveset` Highlighting**:
  - Simulates legal Fast + Charged move combinations across all 3 team members on top ABB and ABC candidate lineups against the Top-100 role-weighted meta.
  - Highlights any non-standard moveset on generated team cards with an **`⚡ Alt Moveset (+X BR)`** badge, violet move name styling, and a comparison to the standard PvPoke moveset, and carries those optimized moves directly into the Edit Team modal on selection.
- **Key Wins, Key Threats & Core Breakers Breakdown**:
  - Every generated ABB and ABC team card now displays **`✅ Key Wins`**, **`⚠️ Key Threats`** (Top-25 Pokémon that beat your Lead and pressure your backline), and **`🚨 Core Breakers`** (Top-25 Pokémon that beat all 3 team members `BR < 490`) in both the visual breakdown badges and the team synergy description.

## [v3.21] — 2026-10-22 — Native Android & Web Anti-Meta Team Builder (`ABB` / `ABC`) on Team Presets Page
- **Anti-Meta Team Builder on Team Presets Page (`MainActivity.kt`, `OverlayService.kt`, `activity_main.xml`, `App.tsx`, `gblData.ts`)**:
  - **2a — League & Featured Pokémon Selection**: Added an **Anti-Meta Team Builder (`ABB` / `ABC`)** panel and header button (`🧪 Anti-Meta`) directly on the **Team Presets** page where you can select any **League** (`GREAT LEAGUE`, `ULTRA LEAGUE`, `MASTER LEAGUE`, `MEGA MASTER LEAGUE`) and enter **0, 1, or 2 Featured Pokémon** with live autocomplete and GBL species-clause checks.
  - **2b — Best 5 ABB & Best 5 ABC Team Options**: Generates and ranks the **Best 5 ABB** and **Best 5 ABC** anti-meta team options that must include your selected Featured Pokémon, displaying `Core BR`, `Lead BR`, `Swap BR`, `Closer BR`, and key Top-Meta targets countered.
  - **2c — One-Tap Team Creation & Immediate Edit Screen**: Selecting any generated ABB or ABC option creates the team with the default name **`<LeagueAbbreviation> Anti-Meta <YYYY-MM-DD>`** (e.g., `GL Anti-Meta 2026-10-22`) and immediately opens the **Edit Team** screen (`showPresetEditorDialog` / `openEditPresetModal`) so you can customize moves, IVs, or role upgrades like any other team.

## [v3.20] — 2026-10-22 — Top-200 Precomputed 9x9 Overlay Shield Matrix, Anti-Meta Team Builder (ABB/ABC) & Special Mechanics Validator Audit
- **Precomputed 9x9 Shield Matrix for Active Team vs. Top-200 League Meta (`gblData.ts`, `App.tsx`, `OverlayService.kt`)**:
  - Precomputes the full 9x9 weighted move-combo shield matrix (`0v0` through `2v2`) for the 3 members of the active team against the **Top 200 League Meta** before launching the overlay (and automatically on team/league switch).
  - Real-time overlay battling now serves Top-200 meta matchups in **O(1) time** from the precomputed 9x9 matrix cache, while falling back to fast single-moveset real-time rough math (`evaluateFastRoughShieldBattleRating` / `calculateFastRoughMatchupRatingStatic`) for non-Top-200 spice matchups.
- **Anti-Meta Team Builder on Team Presets Page (`generateAntiMetaTeamOptions` & `App.tsx`)**:
  - **2a**: Select any **League** and enter **0, 1, or 2 Featured Pokémon** (with live autocomplete and GBL species-clause validation).
  - **2b**: Generates and ranks the **Best 5 ABB** and **Best 5 ABC** anti-meta team options that must include your selected Featured Pokémon, displaying `Core BR`, `Lead BR`, `Swap BR`, `Closer BR`, and key Top-Meta targets countered.
  - **2c**: Selecting any generated ABB or ABC team option creates the preset with default name **`<LeagueAbbreviation> Anti-Meta <YYYY-MM-DD>`** (e.g., `GL Anti-Meta 2026-10-22`) and immediately opens the **Edit Team** modal so you can customize moves, IVs, or role upgrades like any other team.
- **Special Mechanics Math Validator & Double-Bonus Elimination (`FORM_CHANGE_SPECIAL_POKEMON`, `gblData.ts`, `OverlayService.kt`)**:
  - Scoped the Special Mechanics Math Validator exclusively to Pokémon with **in-battle special mechanics**: **Morpeko** (`Hunger Switch` + `Aura Wheel`), **Cramorant** (`Gulp Missile` Gulping/Gorging forms), **Aegislash** (`Stance Change` Shield ⇄ Blade Forme), and **Mimikyu** (`Disguise` + Busted Form). Removed static pre-battle form Pokémon (`Zygarde`, `Giratina`, `Palkia`, `Dialga`, `Zacian`, `Zamazenta`, `Necrozma`, `Kyurem`, `Mewtwo`, `Deoxys`).
  - Eliminated double-bonus multipliers (`Aegislash` `2.85x -> 1.22x` Stance Change factor and duplicate flat BR deltas) so Aegislash Shield Forme is no longer artificially inflated in Team Builder or Overlay matrices.
  - Strictly sourced all Top-Meta pools and Top-5 DB Scores from live PvPoke rankings (`1500` / `2500` / `10000`) rather than static Gamemaster order.

## [v3.16] — 2026-10-22 — Strict Legal Move Pool Enforcement & Dynamic Alternate Move-Combo Matrix Normalization
- **Strict Legal Move Pool Enforcement & Audit (`OverlayService.kt` & `gblData.ts`)**:
  - Eliminated illegal moves from species pools (e.g. Mimikyu only learns `Play Rough`, `Shadow Sneak`, `Thunder` in Pokémon GO — fixed invalid `Shadow Ball` recommendations; Cramorant fast moves are `Peck` / `Water Gun` and charged moves `Surf` / `Fly` / `Dive` / `Hydro Pump`; Tinkaton charged moves are `Gigaton Hammer` / `Play Rough` / `Bulldoze` / `Heavy Slam` / `Flash Cannon`; Kyogre fast move is only `Waterfall`; Melmetal fast move is only `Thunder Shock`).
  - Purged illegal type fallbacks (`Tackle`, `Struggle`, `Frustration`, generic type placeholders) and enforced strict validation against authoritative Gamemaster and curated fallback pools across rankings ingestion, battle rating calculations, and autocomplete suggestions.
- **Dynamic 9x9 Shield Matrix Move-Combo Normalization (`calculateMatchupRatingStatic` & `evaluateDiscreteShieldBattleRating`)**:
  - Replaced hardcoded 5-combo weighting with dynamic alternate combo filtering for Pokémon lacking a 4th charged move, 3rd charged move, or 2nd fast move.
  - The 25% alternate weight is now distributed equally across all valid, distinct alternate combinations that actually exist for the species (`fast1/charge1/charge3`, `fast1/charge1/charge4`, `fast1/charge2/charge3`, `fast1/charge2/charge4`, `fast2/charge1/charge2`). If no alternate combos exist (e.g. single fast move and <= 2 charged moves), 100% of the rating is assigned to the base combo, eliminating skewed weights and duplicate simulation overhead.
- **Team Moveset Optimizer Robustness (`recommendTop3MovesetsForTeamStatic` & `recommendTop3AlternateMovesetsForTeam`)**:
  - Moveset simulation now strictly pairs legal charged moves ($\binom{N}{2}$ combinations or single pair if $N \le 1$) and evaluates only legal fast moves, preventing phantom recommendations for constrained-move Pokémon.

## [v3.15] — 2026-10-22 — Weighted Move-Combo 9x9 Shield Matrix Math (75% Default + 25% Alternate Combos) & Team Moveset Optimizer (Best 3 Alternate Movesets)
- **Weighted Move-Combo 9x9 Shield Matrix Math (`calculateMatchupRatingStatic` & `evaluateDiscreteShieldBattleRating`)**:
  - Updated all 9 shield conditions (`0v0`, `0v1`, `0v2`, `1v0`, `1v1`, `1v2`, `2v0`, `2v1`, `2v2`) to simulate and compute a weighted average across opponent PvPoke move combinations:
    - **1a (`75%` weight)**: Default PvPoke moveset (`fast1 / charge1 / charge2`).
    - **1b (`25%` weight split equally = `5%` each)**: Alternate PvPoke move combinations (`fast1 / charge1 / charge3`, `fast1 / charge1 / charge4`, `fast1 / charge2 / charge3`, `fast1 / charge2 / charge4`, and `fast2 / charge1 / charge2`).
  - Unified live overlay win/loss/neutral determination (`SW`, `W`, `N`, `L`, `SL` in `calculate3v3Matrix` and `calculateShieldMatrix`) and all team-building / battle-quality `0–1000` (`500` neutral) Battle Rating (`BR`) calculations to use the new weighted move-combo math.
- **Current Team Moveset Optimizer (`🎯 Simulate Moves & Propose Best 3 Alternate Movesets`)**:
  - Added a new button to the Team Edit page/dialog (Android & Web) right alongside the Role Upgrades button that keeps your current 3 Pokémon fixed, simulates all legal Fast + Charged move combinations for your team against the blended meta, and proposes the **Best 3 Alternate Movesets** (per slot and top 3 overall) with exact **Team Rating (`Core BR` & `Lead Agg BR` deltas)** and **Positional Ranking (`Lead BR`, `Safe Swap BR`, `Closer BR` deltas)** plus one-tap apply buttons.

## [v3.14] — 2026-10-22 — Single-Screen Scanner Mode Unmasked Capture, Best-Match-Across-Team Player Switch OCR & Single-Tap Stop Overlay Button Fix
- **Single-Screen Scanner Mode Unmasked Capture (`captureAndProcessBattleRegions`)**:
  - Removed all black-rectangle screen masking (`overlayView` and `statusToastView`) and overlay chip-bar filtering so single-screen (single-app) scanner mode never masks out Pokémon GO HUD or move button pixels underneath the floating overlay or status toasts.
- **Best-Match-Across-Team Player Switch OCR (`scoreTeamMemberOnLine` & `handlePlayerSwitchLines`)**:
  - Replaced sequential slot-order matching (which checked Slot 0 / Lead first and immediately returned on any fuzzy edit-distance-2 or shared-CP match such as `Tinkaton` 2499 & `Swampert` 2499) with simultaneous scoring across all 3 team Pokémon to select the strictly best match (`score 0` exact/confusable-normalized > `score 1` 1-edit/5+ char prefix > `score 2` 2-edit) regardless of team order (`Tinkaton / Mimikyu / Swampert` or `Swampert / Mimikyu / Tinkaton`).
  - Added High-Contrast B&W nameplate extraction (`createHighContrastWhiteTextBitmap`) for the top-left player nameplate (`srcPlayer`) alongside 5-variant OCR confusable normalization (`rn -> m`, `1 -> i/l`, `0 -> o`, `v -> y`, `vv -> w`) so `"Swarnpert"` normalizes directly to `"swampert"` (exact match, score `0`).
  - Updated CP and bottom Charged Move button fallbacks to require a strictly unique match across all 3 team members so shared CPs (`2499`) or shared moves never default to Slot 0 (Lead).
- **Single-Tap "Stop Battle Overlay" Button Restoration (`MainActivity` & `OverlayService`)**:
  - Fixed `stopOverlayService()` where `syncOverlayRunningUiState()` read `OverlayService.isInstanceRunning` before the asynchronous stop intent was processed, requiring two taps on **Stop Battle Overlay** to restore **Start Battle Overlay**.

## [v3.13] — 2026-10-22 — Best-Match-Across-Team Player Switch OCR Fix & Single-Tap Stop Overlay Button Fix
- **Best-Match-Across-Team Player Switch OCR (`scoreTeamMemberOnLine` & `handlePlayerSwitchLines`)**:
  - Replaced sequential slot-order matching (which checked Slot 0 / Lead first and immediately returned on any fuzzy edit-distance-2 or shared-CP match) with simultaneous scoring across all 3 team Pokémon to select the strictly best match (`score 0` exact/confusable-normalized > `score 1` 1-edit/7+ char prefix > `score 2` 2-edit) regardless of team order (`Tinkaton / Mimikyu / Swampert` or `Swampert / Mimikyu / Tinkaton`).
  - Added High-Contrast B&W nameplate extraction (`createHighContrastWhiteTextBitmap`) for the top-left player nameplate (`srcPlayer`) alongside 5-variant OCR confusable normalization (`rn -> m`, `1 -> i/l`, `0 -> o`, `v -> y`, `vv -> w`) so `"Swarnpert"` normalizes directly to `"swampert"` (exact match, score `0`).
  - Added horizontal team-chip-bar rejection and length guards so 6-character overlay team chips (`Tinkat`, `Mimiky`, `Swampe`) or shared default CPs (`1500` / `2500`) never pull the active Pokémon back to Slot 0 (Lead).
  - Updated bottom Charged Move button fallback to require a strictly unique best score across all 3 team members (`bestScore >= 3 && bestScore > secondBestScore`) so shared moves (e.g., `Play Rough`) or ties never default to Lead.
- **Single-Tap "Stop Battle Overlay" Button Restoration (`MainActivity` & `OverlayService`)**:
  - Fixed `stopOverlayService()` where `syncOverlayRunningUiState()` read `OverlayService.isInstanceRunning` before the asynchronous stop intent was processed, requiring two taps on **Stop Battle Overlay** to restore **Start Battle Overlay**.

## [v3.12] — 2026-10-21 — Top-5 Role Upgrades (Top-200 Candidates vs. Top-100 Meta), Core Coverage BR (Core BR), Enhanced Mimikyu 2-Strategy Disguise Math & Aegislash Shield/Sword Energy + Damage Shift
- **Top-5 Role Upgrade Recommendations (`Top-200` Candidate Pool vs. `Top-100` Blended Meta)**:
  - Expanded role upgrade recommendations in both the Android and Web Team Editors to display the **Top 5 distinct-species alternatives per role** (`#1 Lead`, `#2 Safe Swap`, `#3 Closer`) with one-tap replacement chips.
  - Increased candidate simulation depth to the **Top 200 Meta Pokémon** for the active league (including eligible Shadow variants and enforcing the GBL species clause) evaluated against the **Top 100** blended current-season meta distribution.
- **Renamed `Mach BR` (`Machine Aggregate BR`) → `Core BR` (`Core Coverage BR`)**:
  - Renamed unclear `Mach BR` / `Machine Aggregate BR` labels to **`Core BR`** / **`Core Coverage BR (Core BR — 3-Mon Team Ceiling)`** across all team preset cards, Team Editor badges, role upgrade chips, and Settings threshold scales while preserving backward-compatible preference keys.
- **Enhanced Mimikyu `Disguise` Simulation (Two-Strategy Shield Ordering Average + Opponent Fastest Charged Move Baiting)**:
  - Updated Mimikyu's discrete shield battle rating math (`0v0` through `2v2`) to compute the exact average of **(a) using all Protect Shields before busting Disguise** (preserving `100%` Defense longer) and **(b) busting Disguise first before using Protect Shields** (absorbing the first throw for `0 HP` and dropping to Busted Form `-1 Defense` stage / `1.20x` incoming damage).
  - Models intelligent opponent baiting: while Mimikyu's Disguise is intact, the opponent always throws their **fastest (lowest-energy) Charged Attack** knowing it will be negated by either a Protect Shield or Disguise.
- **Enhanced Aegislash `Stance Change` Simulation (Shield ⇄ Sword Forme Damage AND Energy Generation Shift)**:
  - Explicitly models the shift in **both Fast/Charged Move damage AND Fast Move energy generation** between **Shield Forme** (`97 Atk / 291 Def`, `1 HP` fast damage, boosted `1.28x` high energy generation) and **Sword/Blade Forme** (`291 Atk / 97 Def`, full `291 Atk` fast & charged damage, `0.78x` lower energy generation rate and `97 Def` vulnerability until reverting to Shield Forme via a Protect Shield).

## [v3.11] — 2026-10-21 — Top-100 Role Upgrade Recommendations, Unique Ability Battle Ranking Math (Morpeko / Mimikyu / Aegislash / Cramorant), ABB/ABC Auto-Detection & Position-Weighted Shield Ratings
- **Top-100 Role Upgrade Recommendation Engine (`#1 Lead`, `#2 Safe Swap`, `#3 Closer`)**:
  - Added an on-demand **`✨ Suggest Top-100 Role Upgrades (3 Per Role)`** button inside the Create Team and Edit Team dialogs (Android & Web) with **3 one-tap replacement chips** beneath Slot 1, Slot 2, and Slot 3.
  - Simulates the **Top 100 Meta Pokémon** for the selected league (including eligible Shadow variants) against your blended current-season meta distribution while enforcing the **GBL species clause** (no duplicate base species across your 3 slots and at most 1 Mega in Mega Master League).
  - Ranks candidates for each slot by combining **Full Team Synergy (`ΔTeamMachBR`)** and **Role Rating Delta (`ΔRoleBR`)** plus defensive coverage bonuses ($0.55 \cdot \Delta\text{MachBR} + 0.45 \cdot \Delta\text{RoleBR} + \text{CoverageBonus}$), and immediately populates the Pokémon, PvPoke recommended moveset, CP, and updated team ratings on a single tap.
- **Unique Form-Change & Signature Ability Battle Ranking Math (`Morpeko`, `Mimikyu`, `Aegislash`, `Cramorant`)**:
  - **Morpeko (`Hunger Switch` + `Aura Wheel`)**: Models alternating Full Belly (Electric) and Hangry (Dark) STAB `Aura Wheel` cycles with its guaranteed `+1 Attack` stage self-buff (`1.25x` compounding up to `+4` stages / `2.0x`) across every charged move cycle.
  - **Mimikyu (`Disguise`)**: Models the intact Disguise absorbing the first unshielded incoming Charged Attack for `1 HP` (acting as a free extra shield in 0s/1s/2s scenarios), followed by the Busted Form `-1 Defense` stage drop (`0.8x` Defense multiplier).
  - **Aegislash (`Stance Change: Shield Forme ⇄ Blade Forme`)**: Models Shield Forme (`97 Atk / 291 Def`) tanking incoming damage while generating energy with 1-damage fast moves, transforming into Blade Forme (`291 Atk / 97 Def`, ~`2.98x` Attack) right before executing Charged Attacks (`Shadow Ball` / `Flash Cannon` / `Gyro Ball`), and reverting to Shield Forme when spending a Protect Shield.
  - **Cramorant (`Gulp Missile: Gulping / Gorging Form`)**: Models `Surf` loading Arrokuda (`> 50% HP`) or Pikachu (`≤ 50% HP`), dealing automatic `12.5%` max-HP retaliation counter-damage when attacked and inflicting a guaranteed `-1 Defense` stage drop (`0.8x` Defense) in Gulping Form or `-1 Attack` stage drop (`0.8x` Attack) in Gorging Form.
- **Non-Blocking Background Evaluation & Instant Team Switching**:
  - Eliminated UI thread stalls and redundant recalculation loops when switching teams or editing presets by moving heavy team evaluation and Top-100 recommendation simulations onto background worker threads (`Dispatchers.Default`) and memoizing per-preset battle rating metrics.
  - Restricted manual slot reordering buttons (`#1 ⇄ #2`, `#2 ⇄ #3`) and `⚡ Auto-Detect Style & Order Swap` exclusively to the **Team Editor** modal so the main Team Select screen stays fast and uncluttered.
- **Auto Team Style Classification (`ABB` vs. `ABC`) & Smart Slot Reordering**:
  - Evaluates pairwise defensive type vulnerabilities across all 3 team members and tests whether the candidate Lead resists shared backline weaknesses (`≥ 2` shared weaknesses or `1` critical meta weakness):
    - **`ABB` Lineups**: Automatically moves the resisting `A` Pokémon to **Slot 1 (Lead)**, places the higher bait-pressure / faster energy `B` Pokémon into **Slot 2 (`Bait Swap B1`)**, and places the higher closing-power `B` Pokémon into **Slot 3 (`Sweeper B2`)**.
    - **`ABC` Lineups**: Keeps **Slot 1 (Lead)** fixed, places the backline Pokémon with the highest volatility-adjusted `Swap BR` ($\mu - 0.5\sigma$) into **Slot 2 (`Safe Swap`)**, and places the remaining Pokémon into **Slot 3 (`Closer`)**.
- **Current-Season Blended Meta & Exponential Recency Decay (`0–50` Match Ramp)**:
  - Calculates expected opponent probability distributions $P_{\text{lead}}(p)$ (from opponent leads) and $P_{\text{field}}(p)$ (from all 3 opponent Pokémon) strictly from **current GBL season** battle logs blended with active league PvPoke rankings.
  - Scales historical battle log weight linearly from `0%` at `0` matches up to `70%` at `50+` current-season matches ($w_{\text{hist}} = 0.70 \times \min(1, N / 50)$, $w_{\text{meta}} = 1 - w_{\text{hist}}$) and weights more recent logs exponentially higher ($W(k) = e^{-0.05 \cdot (k - 1)}$).
- **Position-Weighted Shield Scenario Ratings & Per-Slot Battle Rating Badges**:
  - **Slot 1 (`Lead`)**: $0.50 \cdot BR_{2v2} + 0.50 \cdot BR_{1v1}$ (`Lead Agg BR` color-coded by `SW / W / N / L / SL` thresholds).
  - **Slot 2 (`Safe Swap / Pivot`)**: $0.60 \cdot BR_{1v1} + 0.25 \cdot BR_{2v1} + 0.15 \cdot BR_{1v0}$ with volatility penalty $\mu_{\text{Swap}} - 0.5\sigma_{\text{Swap}}$.
  - **Slot 3 (`Closer / Sweeper`)**: $0.60 \cdot BR_{0v0} + 0.25 \cdot BR_{1v0} + 0.15 \cdot BR_{0v1}$, plus side-by-side **Swap BR** badges on both Slot 2 and Slot 3 and customizable **Machine Aggregate BR (`Mach BR`)** 5-tier thresholds in **⚙️ Settings**.
