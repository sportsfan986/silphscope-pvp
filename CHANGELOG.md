# SilphScope PvP — Complete Release Changelog (`v1.00` – `v6.11`)

---

## v6.11 (2026-11-04) — Full Codebase De-Fragmentation, AI Studio Artifact Cleanup, Single-Source-of-Truth Telemetry Fix & Android/Web Modularization
*Architecture, maintainability, bundle size optimization, and telemetry integrity release (`v6.11`, `versionCode = 1611`) eliminating legacy Google AI Studio structural duplication, fixing a telemetry batch version-stamp overwrite bug, reducing the client-side Web Simulator JavaScript bundle by **71%** (`~4.0 MB` → `1.15 MB` / `281 kB` gzipped), and modularizing both the Android Kotlin (`app/src/main/java/com/gbl/overlay/`) and Web React/TypeScript (`src/data/`, `src/components/`) codebases into clean domain modules while preserving 100% functional, mathematical, and SharedPreferences/Gson serialization compatibility.*

- **v6.11 — Phase 1: Repository De-Duplication & AI Studio Artifact Cleanup**:
  - **Retired Root-Level & Mirror Duplicates**: Removed 14 duplicate, stale, or orphaned files left over from Google AI Studio's flat-directory export workflow (`MainActivity.kt`, `OverlayService.kt`, `activity_main.xml`, `MainActivity.xml`, `AndroidManifest.xml`, `app_build.gradle.kts`, `overlay.html`, `res/layout/*`, `public/overlay.html`, `public/GBL_Overlay_Source.zip`, `src/data/androidFiles.ts`, `metadata.json`, `.env.example`, and `bun.lock`). Established `app/src/main/` and `app/build.gradle.kts` as the single canonical source of truth.
  - **71% Web Bundle Reduction**: Removed `src/data/androidFiles.ts` (`2.8 MB` of embedded raw Kotlin/XML source strings), the legacy `Kotlin & Android Code` tab (`android_code`), and the unreachable `turn_matrix` dead code block from `src/App.tsx`, cutting the production Vite JS bundle from `~4.0 MB` down to `1.15 MB` (`281.60 kB` gzipped).
  - **Cleaned `package.json` & Added ProGuard Rules**: Renamed package from `"react-example"` to `"silphscope-pvp"`, pruned unused AI Studio template dependencies (`@google/genai`, `better-sqlite3`, `express`, `motion`, `dotenv`), and added `app/proguard-rules.pro` with `@JavascriptInterface`, Gson, and ML Kit keep rules.

- **v6.11 — Phase 2: Version Single-Source-of-Truth, Telemetry Bug Fix & CI/CD**:
  - **Fixed Telemetry Version Overwrite Bug**: Added `OverlayService.APP_VERSION = "6.11"` as the single canonical version constant across Android telemetry, manifest entries, and commit messages. Fixed `uploadPendingAiTelemetryBatchBlocking` in `GitHubCloudSync.kt`, which previously overwrote queued `AiTelemetryBattleRecordV510` records with hardcoded `appVersion = "5.13"` and `schemaVersion = "6.06"`.
  - **Replay Mode Custom Cup CP Cap Parity**: Updated `OverlayService.configureReplayState` and `MainActivity.showInteractiveBattleReplayDialog` to pass `sharedPrefs = prefs` so custom limited-cup CP caps resolve identically during battle replays.
  - **CI/CD & Script Unification**: Fixed `VERSION_CODE` arithmetic in `scripts/bump_version.sh` (`1000 + MAJOR * 100 + MINOR`), updated `.github/workflows/android.yml` to dynamically extract release notes from `CHANGELOG.md`, and consolidated telemetry ingestion into `scripts/ingest-telemetry.mjs`.

- **v6.11 — Phase 3: Android Kotlin Modularization (`app/src/main/java/com/gbl/overlay/`)**:
  - Split the monolithic `OverlayService.kt` (`28,677` → `14,943` lines, **-47.9%**) and `MainActivity.kt` (`12,487` → `12,085` lines) into **10 focused Kotlin files** inside package `com.gbl.overlay` with zero changes to Gson schemas, SharedPreferences keys, or Android Intent actions:
    - `OverlayService.kt` (`14,943` lines): Core foreground lifecycle service, MediaProjection pipeline, OCR/combat state machine, and `AndroidBridge` WebView IPC.
    - `MainActivity.kt` (`12,085` lines): Native Android dashboard, Team Presets manager, Battle Log analytics UI, Interactive Battle Replay dialog, and Settings controller.
    - `TeamAndMetaEngine.kt` (`4,124` lines): Precomputed Top-200 9×9 matchup matrix, BMF/WAE Battle Quality engine, Blended Season Meta, Backline Predictor, Role/Moveset upgraders, and 3-Slot Anti-Meta Team Builder.
    - `PokemonDatabase.kt` (`3,329` lines): `PokemonStaticData`, Gamemaster & PvPoke rankings JSON parsers, and Turn-by-Turn 1v1/2v2 PvPoke Combat Math Simulator.
    - `PixelScannerEngine.kt` (`2,689` lines): 10 Hz real-time pixel & computer vision scanners (Pokéballs, Shields, Charge Circles, Prescan Calibration, and Floating HP Bars).
    - `GitHubCloudSync.kt` (`2,277` lines): GitHub OAuth Device Flow, Gist/Repo Cloud Delta Sync, and AI Telemetry & 1-Battle DVR Auto-Upload Engine.
    - `Show6Engine.kt` (`1,703` lines): `Show6StaticData`, Show 6 Pick 3 Battle Frontier 120×120 minimax optimizer, PvPoke Limited Meta sync, Google Sheets sync, and roster upgraders.
    - `BattleDvrEngine.kt` (`445` lines): 1-Battle Hardware H.264 DVR (`MediaCodec` `video/avc`) & frame-synced `_deep_trace.jsonl` recorder.
    - `TaskerIntegration.kt` (`314` lines): `TaskerActionActivity` & `TaskerCommandReceiver` automation intent hooks.
    - `AppModels.kt` (`101` lines): Shared activity/UI data models (`BattleHistoryEntry`, `DeletedTeamTrashEntry`, `DeletedRosterTrashEntry`, `DeletedBattleTrashEntry`, `GblSeasonInfo`, `AppThemePalette`).

- **v6.11 — Phase 4: Web React / TypeScript Modularization (`src/`)**:
  - **Domain Engine Split (`src/data/`)**: Split `src/data/gblData.ts` (`16,285` lines) into `pokemonDb.ts` (`6,331` lines), `teamAndMetaEngine.ts` (`5,704` lines), `show6Engine.ts` (`2,760` lines), and `combatSimulator.ts` (`1,509` lines), with `gblData.ts` preserved as a clean barrel re-export.
  - **Component & Modal Extraction (`src/components/`)**: Extracted `AppThemeAndModels.tsx` (`509` lines), `MetaTab.tsx` (`477` lines), `HelpTab.tsx` (`252` lines), `MathValidatorTab.tsx` (`840` lines), `TrashBinModals.tsx` (`314` lines), and `DocumentationModals.tsx` (`421` lines) from `src/App.tsx`.

---

## v6.10 (2026-11-04) — Platform Migration: Google AI Studio to Google Antigravity
*Platform lifecycle and developer tooling release (`v6.10`, `versionCode = 1610`) commemorating the official transition of the SilphScope PvP project development environment from Google AI Studio to Google Antigravity. Preserves strict 1:1 functional, mathematical, and algorithmic parity with v6.07—retaining all real-time 3x3 matchup calculations, hardware H.264 1-Battle DVR with burned-in frame watermarks, ML Kit OCR, synchronized tactical haptics, and telemetry synchronization pipelines without alterations.*

- **v6.10 — Development Environment & Maintenance**:
  - **Toolchain Migration**: Development workflow, repository management, and agent-assisted coding migrated from Google AI Studio to Google Antigravity.
  - **Zero Functional Delta**: No behavioral, visual, or algorithmic changes from v6.07. Full operational parity maintained for Android overlay services, Web simulator HUD, and diagnostic telemetry.
  - **Local Build Toolchain Establishment**: Standardized local JDK 17 (Temurin 17.0.21+9) and Android SDK Platform 35 build configurations with verified release keystore signing parity against official GitHub release builds.

---

## v6.07 (2026-11-04) — Zero-Impact 1-Battle Full-Screen H.264 DVR + Burned-In Frame Correlation, Frame-Synced Deep Trace JSONL, Post-Cutscene Dual-HP Audit, & Energy Mutation Ledger
*Diagnostics, hardware video encoding, and root-cause telemetry release (`v6.07`, `versionCode = 1607`) adding a zero-impact hardware-accelerated 1-Battle Full-Screen H.264 DVR (`MediaCodec` `video/avc` at 544×1184, 1.2 Mbps) with a high-contrast burned-in frame & timestamp watermark (`F#0042 T+14.35s U:88%(88%)/35E O:23%(23%)/7E`), a companion frame-synced `_deep_trace.jsonl` audit file, post-cutscene dual-HP settling progression tracking (`+220ms`, `+650ms`, `+1200ms`), an energy mutation ledger with explicit attribution (`FAST_CADENCE`, `CIRCLE_FILL_SYNC`, `POST_THROW_DEDUCT`, `SWAP_BANK`, `RETRO_SWAP_OR_MOVE_FIX`), an overlay `REC 1` button with auto-disarm after 1 battle, and auto-upload of `.mp4` + `.jsonl` bundles to the `ai-telemetry-logs` branch on GitHub.*

- **v6.07 — Key Features & Root-Cause Logging**:
  - **Zero-Impact 1-Battle Full-Screen H.264 DVR (`BattleDvrRecorder`)**:
    - Reuses the in-memory screen capture bitmap from `captureCleanScreenBitmap()` on a dedicated `GBLBattleDvrThread` running at `Process.THREAD_PRIORITY_BACKGROUND`, rendering to a `MediaCodec` input surface. Reuses the existing single `VirtualDisplay` to strictly comply with Android 14+ projection token constraints while keeping CPU impact under 0.5% with zero Pokémon GO game frame drops.
    - Draws a clean, high-contrast monospace timestamp strip on every frame (`F#<frameIdx> T+<elapsedSec>s U:<rawHp>%(<committedHp>%)/<energy>E O:<rawHp>%(<committedHp>%)/<energy>E`).
    - Accompanied by a frame-by-frame `_deep_trace.jsonl` containing full OCR detections, pixel scan outputs, circle fills, and overlay state.
  - **Post-Battle Background Upload to GitHub (`uploadBattleDvrBundleToGitHubBlocking`)**:
    - Immediately upon logging or stopping the battle, bundles the `.mp4` and `_deep_trace.jsonl` files and commits them to `recordings/<safeUser>/<battleId>_video.mp4` and `recordings/<safeUser>/<battleId>_deep_trace.jsonl` on the `ai-telemetry-logs` branch.
    - Automatically deletes temporary files from phone storage after upload.
  - **Enhanced Always-On Root-Cause Telemetry**:
    - Expands `BattleSensorTick` to log `committedPlayerHpPct`, `committedOppHpPct`, `playerHpRowY`, `oppHpRowY`, `userEnergy`, `oppEnergy`, and `energyMutationSource`.
    - Emits a structured `PostCutsceneHpAuditRecord` on every charged move capturing pre-cutscene HP and `+220ms`, `+650ms`, and `+1200ms` post-cutscene rescans for both players.
    - Tracks an explicit turn-by-turn `EnergyLedgerEntry` recording exact source attribution (`FAST_CADENCE`, `CIRCLE_FILL_SYNC`, `POST_THROW_DEDUCT`, `SWAP_BANK`, `RETRO_SWAP_OR_MOVE_FIX`).

---

## v6.06 (2026-11-04) — Synchronized Haptics & Tactical Vibration Alerts, Lead-Loss Recovery Rate & Safe-Swap MVP Summary
*Tactical awareness and battle analytics release (`v6.06`, `versionCode = 1606`) introducing hardware vibration alerts synchronized 1:1 with overlay visual warnings, customizable haptic threshold sliders in Settings, and the Lead-Loss Recovery Rate banner in Battle Log.*

- **v6.06 — Key Features**:
  - **Synchronized Haptic & Tactical Vibration Alerts**:
    - **Opponent Swap Clock Alert**: Distinct single 80ms pulse when opponent swap clock drops below `< 5s`.
    - **Opponent Move Imminent Alert**: Distinct double 80ms pulse (`80ms on, 60ms off, 80ms on`) when opponent is within 1 fast move of reaching a charged attack.
    - Visual-Haptic Synchronization: Evaluates on the exact same cycle as the `BLINK_1_FAST` visual alerts.
    - Dedicated Haptics Section in Settings: Master enable/disable switches and threshold adjustment sliders for both alert types.
  - **Lead-Loss Recovery Rate & Safe-Swap MVP**:
    - **Lead Won Conversion**: Tracks conversion percentage when opening with a Favorable lead.
    - **Lead Lost Recovery Rate**: Measures resilience when opening with a Negative lead, graded from S ( $\ge 45\%$ ) to D ( $< 15\%$ ).
    - **Safe-Swap MVP**: Identifies the specific bench Pokémon that yields the highest win conversion when safe-swapped into bad leads.

---

## v6.05 (2026-11-04) — Battle Frontier Forced Metas, 2-Tier CP + Cup Filter, & Charged Attack Dual-HP Rescan
*Filter refinement and HP stability release (`v6.05`, `versionCode = 1605`) restricting Show 6 modes to official Battle Frontier tournaments, introducing 2-tier CP Range and Cup filtering, and enforcing dual-player HP rescans on opponent charged attacks.*

- **v6.05 — Key Features**:
  - **2-Tier CP Range + Format Filter**: Filters Battle Log and Team Presets by broad CP tier (`ALL`, `GREAT ≤1500`, `ULTRA ≤2500`, `MASTER >2500`) followed by specific league/cup selection.
  - **Forced Active Battle Frontier Metas**: Locks Show 6 league selector to official metas: `GREAT LEAGUE`, `Battle Frontier (Spectral)`, `Battle Frontier (Cauldron)`, and `Battle Frontier (Master)`.
  - **Always Rescan Both HP Sets on Opponent Charged Attack**: Reconciles health bar pixel samples for both players following cutscenes to eliminate asymmetric drain artifacts.

---

## v6.04 (2026-11-03) — Charged-Attack HP Tracking Stability, Post-Cutscene Drain Settle, & Dynamic League PvPoke Sync
*Stability and data freshness release (`v6.04`, `versionCode = 1604`) hardening pre-charge HP debounced locks, post-cutscene drain settling, KO HUD return gating, and dynamic selected-league PvPoke rankings synchronization.*

- **v6.04 — Key Features**:
  - **Pre-Charge Debounced HP Lock**: Prevents intermediate camera zoom-in frames from corrupting pre-attack HP snapshots.
  - **Post-Cutscene Drain Settle & Unshielded Override**: Awaits settled health bar animations before committing damage deduction.
  - **KO HUD Return Gating**: Blocks premature combat resume loops if the fainted Pokémon has not yet been replaced.
  - **Dynamic League PvPoke Sync**: Synchronizes rankings specifically for user-enabled leagues to minimize network payload.

---

## v6.03 (2026-11-03) — Automatic End-of-Battle Win/Loss Detection, Auto-Catcher Telemetry Exclusion, & Mirrored Top Header
*Usability and HUD symmetry release (`v6.03`, `versionCode = 1603`) adding automated match outcome detection, ignoring external PoGO Auto-Catcher notification text in OCR regions, and mirroring top header status badges.*

- **v6.03 — Key Features**:
  - **Auto End-of-Battle Win/Loss Detection**: Automatically detects match end and infers Win or Loss based on `"YOU WIN"` / `"YOU LOSE"` OCR text and final faint state.
  - **Auto-Catcher Notification Filter**: Filters out Pokémon GO Plus / Auto-Catcher overlay popups (`"Pokémon caught"`, `"Bag full"`) from triggering false Pokémon nameplate OCR overrides.
  - **Mirrored Top Header Cluster**: Symmetrically arranges live metrics: `[CP, HP, E, 🛡️] | [🛡️, E, HP, CP]` with real-time `OCR:hp/ocr ms` latency indicator.

---

## v6.02 (2026-11-03) — Swap-and-Immediate-Throw Attribution & Rollback, Strict Multi-Cycle Fast-Move Detector, 25s Faint KO Sync, Optimal Scanner Defaults Migration, & Zero-Lag 5-Profile Post-Battle Shadow Telemetry
*Accuracy, anomaly-elimination, and telemetry benchmark release (`v6.02`, `versionCode = 1602`) resolving swap-and-immediate-throw attribution via banner Pokémon name matching + conditional post-throw rollback (`tryRollbackRecentSwapAndImmediateThrow`), hardening non-standard opponent fast-move overrides with strict multi-cycle proof, fixing match-ending 0% HP KO drops and 25s faint-to-throw retroactive sync, crediting 1 in-flight fast move on 2nd-move tap lag, migrating existing installs to optimal scanner defaults (`HP = ON`, `Energy = ON`, `2` samples, `±2%` tolerance, `200ms` lead, `+1t` offset), and adding a zero-lag 5-profile post-battle shadow telemetry evaluator.*

- **v6.02 — Key Features & Anomaly Fixes**:
  - **3-Layer Swap-and-Immediate-Throw Attribution & Conditional Rollback**:
    - **Layer 1 (Banner Pokémon Name Attribution & Unseen Backline Registration)**: Matches `<Pokemon>` in `"<Pokemon> used <Move>!"` against all 3 user slots (`0..2`), all known opponent bench slots (`0..2`), and the full PvPoke database (`findPokemonInText`) when an unseen 2nd/3rd opponent Pokémon swaps in and immediately throws before top-right nameplate OCR runs. Automatically registers the unseen opponent slot, switches the active index, and refunds any provisional energy deduction on the previous slot.
    - **Layer 2 (Post-Throw Nameplate Swap Rollback — `tryRollbackRecentSwapAndImmediateThrow`)**: Records a `PendingChargedMoveAttributionSnapshot` on every charged attack. If top nameplate OCR detects a new Pokémon within the configurable rollback window (default **`4.0s`**) and the thrown move belongs to the newly detected Pokémon's moveset (or the previous slot lacked energy/moveset compatibility), SilphScope rolls back the energy deduction and move lock from the old slot and applies them to the newly swapped Pokémon.
    - **Layer 3 (Pre-Throw HP Jump Hint)**: Flags `preThrowLikelySwapFromHpJump = true` when either side's active HP jumps by `>= 15%` within `1200ms` prior to camera zoom.
  - **Strict Multi-Turn & Multi-Cycle Non-Standard Opponent Fast-Move Detector (Section 1E)**:
    - Requires **`>= 10` opponent turns**, **`>= 3` completed cycles** of both standard and candidate fast moves, **`>= 12.0%` cumulative fast-move damage**, **`>= 0.25` confidence advantage**, and **`>= 4.0%` per-turn error improvement** in `Strict` mode (default), and blocks un-inferable `Hidden Power (*)` moves from being auto-assigned via HP drops alone (eliminating false overrides on Ho-Oh, Dawn Wings Necrozma, and Ursaluna).
  - **Remaining `v5.13` Anomaly Fixes**:
    - **Pre-Zoom 1-Fast-Move Chip Shield Heuristic (`<= 8%` Default)**: Treats post-cutscene HP drops `<= max(8%, 1 opp fast move + 2%)` when `expectedUnshieldedDmg >= 18%` as a **Shielded Charged Attack (`0S -> 1S`) + 1 pre-zoom opponent fast move** instead of an unshielded bait move.
    - **Retroactive Delayed `[SHIELD]` Debounce Sync (`<= 4.0s`)**: Automatically updates a recent opposing `CHARGED_ATTACK` (`<= 4.0s`) from `shielded = false` to `shielded = true` if shield icon pixel debounce finishes slightly after Section 4.
    - **Lethal Disappearing HP Bar KO Detection & 25s Faint Sync Window**: Forces `0%` HP when a Pokémon's HP bar vanishes from a lethal hit (`1..55%` pre-cutscene HP) and widens `syncRecentUnshieldedChargedAttackOnFaintInList` from `12s` to **`25s`**.
    - **Player 2nd-Move Tap Lag 1-Fast-Move Credit & `ENERGY_CAP_DRIFT` Suppression**: Credits `+1` in-flight player fast move when throwing a higher-cost 2nd charged move within 1 fast move of the pre-throw circle peak, and suppresses false `ENERGY_CAP_DRIFT` logs when `userEnergy` already covers `deductedCost`.
  - **One-Time `v6.02` Optimal Scanner Defaults Migration & New Tuning Controls**:
    - Migrates existing and new installs once (`PREFS_KEY_V602_SCANNER_DEFAULTS_MIGRATED`) to optimal defaults: `HP Tracking = ON`, `Energy Counting = ON`, `2 Samples`, `±2% Tolerance`, `200ms Proactive Lead`, `+1 Turn Fast Detect Offset` (supporting `0..3` turns), `Strict Alt Fast Detector`, `<= 8% Shield Chip Tolerance`, and `4.0s Swap-Throw Rollback Window`.
  - **Zero-Lag Post-Battle 5-Profile Shadow Telemetry (`shadowProfileBenchmark`)**:
    - Records a compact scalar `BattleSensorTick` ring buffer at 10Hz during combat (`0%` active combat CPU/OCR overhead) and evaluates **5 scanner profiles** (`ACTIVE_USER`, `V602_RECOMMENDED`, `ULTRA_FAST_150MS`, `CONSERVATIVE_3_SAMPLE`, `AGGRESSIVE_ALT_FAST`) once after battle ends so AI telemetry can rank which parameter combination achieves the lowest anomaly count.

---

## v6.01 (2026-11-03) — GBL Blind 3 Limited Cup Same-CP Standard League Blend Visibility, `50%` Default Fade Start & 1500 CP Cup Mapping Fix
*Hotfix release (`v6.01`, `versionCode = 1601`) fixing the Limited Cup Same-CP Standard League Blend setting so it is always visible in **GBL Blind 3** mode (and hidden in Show 6 mode), enforcing the **`50%` default starting point of the fade** (at `0` cup battles with `Fast` `0.10` decay), fixing 1500 CP Limited Cup mapping (e.g., Halloween Cup, Mega Great League $\to$ Great League), and automatically resolving Same-CP Standard League logs across Team Builder, Live AI Backline Prediction, and the `📊 Meta` dashboard.*

- **v6.01 — Key Fixes**:
  - **Always-Visible in GBL Blind 3 Mode (Hidden in Show 6 Mode)**: Fixed `layout_limited_cup_blend_section` visibility in `📊 Meta -> Meta Tuning` so it is always visible when in **GBL Blind 3** mode (even while viewing Open Great/Ultra/Master League) and hidden in Show 6 mode.
  - **`50%` Default Starting Point of Fade (`Fast` `0.10` Decay)**: Enforces `50%` as the default starting weight of the fade at `0` Limited Cup battles (`PREFS_KEY_LIMITED_STD_BLEND_PCT_GBL = 50`, `DEFAULT_LIMITED_STD_DECAY_GBL = 0.10f`), decaying exponentially as cup-specific logs accumulate.
  - **1500 CP Limited Cup Resolution & Unified Team Builder / AI Blending**: Fixed `getLeagueCpCapStatic` so 1500 CP cups without `"Great"` in their title (such as `Halloween Cup`, `Sunshine Cup`, `Fantasy Cup`, `Spring Cup`, `Love Cup`) map to `1500` (`GREAT LEAGUE`) rather than falling through to `10000`, and automatically caches/injects Same-CP Standard League logs into `computeBlendedSeasonMetaStatic`, `computeBlendedSeasonMetaCoresStatic`, and `computeRoleWeightedTop100MetaStatic` (Team Builder).

---

## v6.00 (2026-11-02) — 4-Pillar Condensed 2-Line AI Tactical Coach, Unified Throw & Catch Timing Alerts, Bottom Default HUD Position, Personalized Blended Meta & Cores Engine, Limited Cup Same-CP Standard League Blending (`50%` / `Fast` Default), & New `📊 Meta` Dashboard Tab
*Major milestone release (`v6.00`, `versionCode = 1600`) overhauling the live in-battle AI recommendation banner into a high-contrast, ultra-condensed 2-line Tactical Coach positioned at the **Bottom** of the HUD by default (configurable to **Top** in Settings), integrating unified Fast-Move Farm Down + Throw & Catch Timing visual alerts (`WARN_2_FASTS` solid highlight, `BLINK_1_FAST` blinking last-fast warning, `IMMEDIATE_0_FAST`), Tank-to-Reach-Move post-hit survival math, in-app Personalized Meta & Meta Core derivation, Limited Cup Same-CP Standard League blending (`50%` weight & `Fast` `0.10` decay default for GBL Blind 3), and a dedicated 4th **`📊 Meta`** navigation tab with a default-collapsed Meta Settings drawer.*

- **v6.00 — Key Features & Architecture**:
  - **4-Pillar Condensed 2-Line AI Tactical Coach (`#sky-tactical-rec-row`)**:
    - **Condensed Names & Strict Width Budget**: Abbreviates Pokémon (`PAL-O`, `ZAC-C`, `HO-OH`, `NDM`, $\le 5$ chars) and Charged Moves (`SecSw`, `AqTail`, `ClsCmb`, `MetMsh`, $\le 6$ chars) so neither line ever overruns the floating overlay window ($\le 38$ chars/line).
    - **Configurable HUD Placement (`Bottom` [New Default] vs. `Top`)**: Defaults to the **Bottom** of the floating HUD (directly below `My Attacks`) for maximum mid-battle visibility, with a one-tap toggle in `⚙️ Settings -> Overlay` (`PREFS_KEY_AI_ADVICE_HUD_POSITION`, Tasker extra `EXTRA_AI_ADVICE_HUD_POSITION`) to place it at the `Top`.
    - **Pillar 1 (Line 2 — Live Opponent Backline Prediction)**: Predicts the opponent's unrevealed backline in Blind 3 GBL using your personalized current-season blended meta cores + type-coverage synergy when 1 (`🔮 Back: PAL-O 68% · HO-OH 52% | Rsk:HI`) or 2 (`🔮 3rd: HO-OH 74% · KYU-W 48%`) opponents are revealed.
    - **Pillar 2 (Line 1 — Lead Swap / Stay Advice Based on Backline Hard-Counter Risk)**: Audits whether the opponent's predicted backline holds a hard counter (`BR <= 375`) to your bench swap. Recommends `STAY · CHIP (SwpRsk: HO-OH)` or `CHIP -> CATCH ON ...` when swap punish risk is high ($\ge 45\%$), and `SWAP -> XERN` when swap punish risk is low ($< 45\%$) in a bad lead.
    - **Pillar 3 (Line 1 — Exact Fast-Move Farm Down vs. Unified Throw & Catch Timing)**:
      - **Safe Farm Down**: Displays `FARM DOWN: ${N}F TO KO` (Emerald) when your fast moves KO the opponent before they reach their next charged move.
      - **2 Fast Moves Before Throw or Catch (`WARN_2_FASTS`)**: Solid High-Contrast Amber Highlight (`⚠️ 2F -> THROW ${MyMv} (Pre-${OppMv})` or `⚠️ 2F -> CATCH ${OppMv} ON ${CatchMon}`).
      - **1 Fast Move Before Last Chance (`BLINK_1_FAST`)**: Blinking Crimson/Amber Alert (`🚨 1 LAST FAST -> THROW ${MyMv} NOW!` or `🚨 1 LAST FAST -> CATCH ON ${CatchMon}!`) so you know to throw 1 final fast move and immediately fire your charged move or swap to catch without over-tapping.
      - **0 Fast Moves Left (`IMMEDIATE_0_FAST`)**: Rapid Crimson Blink (`🛑 0F LEFT -> THROW ${MyMv} NOW!` or `🛑 0F LEFT -> CATCH ${OppMv} ON ${CatchMon}!`).
    - **Pillar 4 (Incoming Charged Move — Tank & Farm to Next Charged Move Before Fainting)**: Computes exact post-hit HP and fast-move survival turns on both the `"Attack incoming!"` Shield Decision Overlay and Line 1 (`TANK (0S) -> ${MyMv} IN ${N}F` vs. `SHIELD (1S) -> DIES ${K}F SHORT OF ${MyMv}!`).
  - **Unified Mode-Independent Blended Meta & Core Engine + Limited Cup Same-CP Standard League Blending**:
    - Unifies **Team Builder**, **Live AI Backline Prediction**, and the **`📊 Meta` tab's `Current Season` view** on the same seasonal blending algorithm (`computeBlendedSeasonMetaStatic` & `computeBlendedSeasonMetaCoresStatic`), auto-resetting each GBL season.
    - **Mode-Independent Settings**: Blind 3 (GBL Mode) and Show 6 (Battle Frontier Mode) maintain independent League Selectors, Log Weight %, and Recency Decay $\lambda$.
    - **Limited Cup Same-CP Standard League Blending**: Blends eligible species from your larger-sample Standard Open League logs of the same CP cap (`1500` $\to$ Great, `2500` $\to$ Ultra, `>2500` $\to$ Master) into Limited Cups, defaulting to **`50%` Standard League weight** and **`Fast` (`0.10`) fade** for GBL Blind 3 Limited Metas (and `25%` / `Std` `0.06` for Show 6), with user-adjustable Blend % (`0%–75%`) and Decay (`Slow`, `Std`, `Fast`).
  - **New 4th Navigation Tab (`📊 Meta`) & Decluttered `⚙️ Settings`**:
    - Added **`📊 Meta`** after `⚙️ Settings` (`⚔️ Teams | 📜 Battle Log | ⚙️ Settings | 📊 Meta`) with **Top Meta Cores** and **Top Meta Pokémon** tables visible immediately on open.
    - **View Scope Toggle**: Switch between **`Current Season`** (drives AI & Team Builder) and **`Last 25` / `Last 50` Battles** (purely empirical personal meta inspection without altering AI or Team Builder weights).
    - **Default-Collapsed Meta Settings Drawer**: Moved all purely meta-related settings (Season Blending sliders, Limited Cup Standard League Blending controls, Show 6 Battle Frontier Google Spreadsheet Importer & Weighting, PvPoke GitHub Limited Metas Selector, and PvPoke Live Database Sync) out of `⚙️ Settings` into a collapsible drawer inside `📊 Meta` that defaults to collapsed on open.

---

## v5.13 (2026-11-02) — Active Battle OCR Frame Rate Throttling, In-Flight Fast Move Preservation, Pre-Throw Tap Zoom Snapshots, Post-Cutscene HP Settle, & Debounce Telemetry Tracking
*Performance, telemetry, and battle state engine release introducing configurable active battle OCR frame rate throttling (5, 7.5, 10, 15 FPS) to eliminate thermal throttling and frame drops on prolonged tournament sets, in-flight fast move preservation during opponent charged moves, pre-throw circle snapshot stabilization against tap zoom-in frames, post-cutscene HP drop synchronization on OCR moves, faint-switch timer lockouts, and telemetry upload of debounce/settling filter configurations alongside cropped WebP thumbnails on HIGH anomalies.*

- **v5.13 — Key Features & Fixes**:
  - **Active Battle OCR Frame Rate Throttling (`ocrFpsThrottle`)**:
    - Adds customizable OCR throttle options (5 FPS, 7.5 FPS, 10 FPS, 15 FPS) in MainActivity and Settings with Tasker intent support.
    - Prevents device overheating, battery drain, and frame drop during long battle sessions while maintaining precise turn registration.
  - **In-Flight Fast Move Preservation (`preserveInFlightFastMoveOnOpponentThrow`)**:
    - Preserves registered fast move damage and energy progression if the opponent initiates a charged move during the fast move's active window, preventing lost fast move attribution.
  - **Pre-Throw Circle Snapshot Freeze on Tap Zoom (`preThrowCircleSnapshotStabilization`)**:
    - Uses a 2-frame stable circle fill peak (`max(lastStable, prevStable)`) before charged attack animation triggers, preventing camera zoom-in pixel drain artifacts from overwriting banked energy snapshots.
  - **Post-Cutscene HP Drop Synchronization on OCR Moves (`postCutsceneHpSettle`)**:
    - Ensures post-cutscene HP drops are reliably sampled after the health bar animation fully settles, eliminating false intermediate damage reads and improving shield/bait deduction accuracy.
  - **Faint Switch Timer Attack Lockout**:
    - Blocks faint switch countdown timers from inadvertently advancing opponent turn counters or triggering phantom opponent attack events before Pokémon enters active combat.
  - **Debounce & Settling Filter Telemetry Correlation**:
    - Automatically captures user debounce filter and settling delay configurations whenever modified, bundling settings into telemetry anomaly payloads to correlate filter parameters with anomaly frequency.
  - **Cropped WebP Thumbnails on High-Severity Anomalies**:
    - Stores lightweight cropped WebP thumbnail captures exclusively for HIGH-severity telemetry anomalies, ensuring fast log ingestion without log bloat.

---

## v5.00 – v5.01 (2026-10-30) — Show 6 Mode (Battle Frontier), Pick-6 Team Editor with AI Pokémon & Moveset Suggestions, Saved Opponent Pick-6 Rosters, Separate Mode Trash, 1-Mega Limit & Battle Frontier Usage + Core Weighting
*Major milestone release series introducing Show 6 Mode (Pick-6 Bring-3) for Battle Frontier formats (`GREAT LEAGUE`, `Battle Frontier (Spectral)`, `Battle Frontier (Cauldron)`, `Battle Frontier (Master)`), Pick-6 Team Editor with per-slot Alternate Pokémon & Alternate Moveset suggestions, Saved Opponent Pick-6 Rosters, separate Trash bins for Show 6 vs. GBL modes, 1-Mega limit enforcement, Google Sheets import for Battle Frontier Meta Usage (`Week - All`) & Most-Used Cores with 65%/35% Usage+Core vs. PvPoke weighting slider, and Live Overlay Common Core unrevealed backline prediction boost.*

- **v5.01 — Key Feature: Pick-6 Team Editor (My 6 & Opponent 6) with AI Slot & Moveset Suggestions, Saved Opponent Rosters, Separate Trash, 4 Battle Frontier Leagues, 1-Mega Limit & Imported Usage/Core Fusion**:
  - **Pick-6 Team Editor Modal (`showEditShow6RosterDialog` / Web Pick-6 Editor)**: Edit any stored **My 6** or **Opponent 6** roster with per-slot **Suggest Alternate Pokémon (Top 5 Upgrades)** and **Suggest Alternate Moves (Top 3–4 Movesets)**.
  - **Saved Opponent Pick-6 Rosters**: Store, load, edit, and delete multiple Opponent Pick-6 rosters alongside My Pick-6 rosters.
  - **Separate Trash for Show 6 vs. GBL Modes**: Independent Deleted Teams Trash (including Pick-6 rosters and Pick-3 presets) and Deleted Battles Trash per mode, requiring only 1 stored team minimum across the app.
  - **4 Battle Frontier Show 6 Leagues & 1-Mega Rule**: Supports `GREAT LEAGUE`, `Battle Frontier (Spectral)`, `Battle Frontier (Cauldron)`, and `Battle Frontier (Master)`, and enforces at most **1 Mega/Primal Pokémon** per team of 6 or 3 across Show 6 and Blind 3 PvP Mega Master League.
  - **Battle Frontier Meta Usage (`Week - All`) & Most-Used Cores Sync + 65%/35% Weighting**: Pre-seeded Season 3 Cycle 1 Usage % and Most-Used Cores with editable Google Sheet URLs in Settings, one-tap **"Save Links & Import Battle Frontier Usage + Cores"**, a customizable **Usage & Cores vs. PvPoke Rankings** slider (default **65% Usage & Cores / 35% PvPoke**), and a **Live Overlay AI Common Core Boost** (`🔥 Core Watch`) for unrevealed opponent backline Pokémon.

---

## v4.00 – v4.03 (2026-10-28) — Fast-Move Energy Increment Snapping, 100E Ceiling Step Latch, Cutscene-Gated 4-Tier "Attack Incoming!" Shield Decision Overlay & Focused Cross-Device Used-Move Recognition
*Major milestone release series adding fast-move turn increment snapping with post-throw discharge anchoring, 100E ceiling step latching after 1 fast-move duration, the 4-tier color-coded (Red / Orange / Yellow / Green) "Attack incoming!" Shield Decision Overlay with a pure 5s timer / combat-return lifecycle and strict cutscene HUD gating, widened cross-device used-move banner OCR (`0.15h..0.52h`), pre-attack HP ratchet lock against mid-drain HP overwrites, and full restoration of `v3.93` opponent used charged move badges.*

- **v4.03 — Key Feature: Cutscene-Gated Shield Call Overlay, Player Charged Move Suppression, 3-Part Protect-Shield + `"NOT NOW"` Verification & Mirror-Safe Move Attribution**:
  - **Strict Cutscene HUD Gate (`isCutsceneHudHiddenForShieldPrompt` & `isHudHiddenForOpponentPrompt`)**:
    - Prevents `sampledShieldHexagonVisible`, `hasAttackIncomingText`, and `isOpponentChargedScreen` from evaluating or triggering while top Pokéballs (`sampledPlayerBalls in 1..3 || sampledOppBalls in 1..3`) or bottom charge circles (`sampledLeftChargeBtnFillPct in 0..300 || sampledRightChargeBtnFillPct in 0..300`) are visible on screen, making false triggers during normal combat with pink/violet Pokémon (such as Tinkaton) impossible.
  - **3-Part Protect-Shield Hexagon + `"NOT NOW"` Signature (`detectAttackIncomingShieldHexagonPixels`)**:
    - Requires 2 consecutive `100ms` cutscene frames verifying (1) left-right symmetric violet/magenta Protect Shield pixels in the center (`0.43w..0.57w, 0.79h..0.88h`), (2) zero pink/purple sprite bleed in the outer left/right wings (`0.20w..0.34w` & `0.66w..0.80w`), and (3) the crisp white `"NOT NOW"` pill/text signature directly beneath the shield hexagon (`0.41w..0.59w, 0.905h..0.955h`).
  - **Player Charged Move Minigame Suppression, Cutscene-Only Bottom Prompt OCR & Mirror-Safe Actor Attribution**:
    - Removes generic `missingTopBallsWithHpBarsFrames` from triggering `isOpponentChargedScreen` when `playerShieldsRemaining > 0` so camera zooms during player charged moves never trigger the Shield Decision Overlay.
    - Includes a compact bottom prompt OCR strip (`0.71h..0.96h`) **only** when the normal combat HUD is hidden and `pendingChargedAttackActor.isEmpty()` (keeping bottom OCR completely disabled during normal combat and during `"<Pokemon> used <Move>!"` banners), and immediately rolls back any tentative opponent prompt and hides the Shield Decision Overlay if player minigame text (`"Get ready!"`, `"Swipe!"`, `"NICE!"`, `"GREAT!"`, `"EXCELLENT!"`) appears.
    - Ensures `"<Pokemon> used <Move>!"` never guesses *who* threw the charged move in mirror matchups (`isMirrorMatch`), relying strictly on the pre-move cutscene state (`hasRecentShieldPrompt` vs `hasRecentUserPrompt`) for actor attribution.
- **v4.02 — Key Feature: 5.0s Timer / Combat-Return Shield Decision Overlay (Zero OCR Dependency), Widened Cross-Device Used-Move Banner OCR (`0.15h..0.52h`) & Pre-Attack HP Ratchet Lock**:
  - **5.0s Timer / Combat-Return Shield Decision Overlay (`showOrUpdateShieldDecisionOverlay` & `hideShieldDecisionOverlay`)**:
    - Triggers the Shield Decision Overlay purely from 100ms pixel detection when an opponent charged move begins and keeps it visible until **5.0 seconds elapse or normal combat circles return (`hasReturnedCombatCircles`)**, whichever comes first.
    - Eliminates all OCR checks for `"Attack incoming!"` / `"NOT NOW"` disappearing so 100% of ML Kit OCR bandwidth is dedicated to reading `"<Pokemon> used <Move>!"` and top Pokémon nameplates.
  - **Focused & Widened Cross-Device Used-Move Banner OCR (`0.15h..0.52h` at `1.35x` Scale) & Removal of In-Battle Bottom Move-Button OCR (`srcMoves`)**:
    - Widens `srcMidBanner` vertically from `0.24h..0.54h` to **`0.15h..0.52h`** and horizontally to **`0.08w..0.92w`** at `1.35x` scale to account for per-device variance in `"<Pokemon> used <Move>!"` placement across tall phones (`18%–27%` screen height) and shorter/wider phones (`28%–52%` screen height).
    - Omits `srcMoves` (`0.68h..0.97h`) from `compositeForOcr` during active battles (`isBattleActive && !isWaitingForOpponent`) so ML Kit OCR focuses exclusively on the top Pokémon nameplates and the used-move banner and never scans the bottom overlay's `OPP ATTACKS` / `MY ATTACKS` table.
  - **Pre-Attack HP Ratchet Lock (`pendingChargedAttackPreUserHp`) & Retroactive Move Upgrade**:
    - Locks `pendingChargedAttackPreUserHp` as an upward-only ratchet during the pre-impact shield window and removes downward overwrites from `Section 1A`'s `realUserDrop` branches so intermediate HP drain frames (e.g., Shadow Pangoro's `37%` Iron Head draining Tinkaton `97% -> 81% -> 65%`) never overwrite `pendingChargedAttackPreUserHp` downward and misclassify a heavy hit (`32%` drop) as a smaller bait move (`16%` Night Slash).
    - Waits for `!sampledPlayerHasPendingDmg` before reconciling `Section 4`, and upgrades any intermediate HP-inferred move badge in `confirmedOppChargedMoves` if a larger settled HP drop or banner OCR confirmation arrives immediately after Section 4.
- **v4.01 — Key Feature: Restored `v3.93` Opponent Used Charged Move Badges (`✓` Badge & 2-Move Lock) Across Shielded & Unshielded Moves + `100E` Ceiling Step Latch**:
  - **Restored `v3.93` Opponent Used Charged Move Marking (`confirmedOppChargedMoves`)**:
    - **100ms Pixel Shield-Prompt Dismissal (`detectAttackIncomingShieldHexagonPixels`)**: Samples the bright purple/magenta Protect Shield hexagon (`x = 0.42w..0.58w`, `y = 0.78h..0.89h`) at `100ms` (10 Hz) so the Shield Decision Overlay hides within `<100ms` the instant the player taps Shield or `"NOT NOW"`—well before the `"<Opponent> used <Move>!"` banner appears and is captured by ML Kit OCR—and keeps the card below `srcMidBanner` (`0.24h..0.54h`) with tinted text ignored by `isWhiteGlyph`.
    - **Debounced Post-Charge HP Sync & Retroactive Unshielded HP-Delta Move Confirmation**: Prevents `hasReturnedCombatCircles` from prematurely reconciling Section 4 on Frame 1 before Frame 2 confirms the player's post-hit HP drop (`hpDelta > 0`), and adds retroactive unshielded HP-delta move confirmation (`strictHpMove ?: bestGuessHpMove`) if a player HP drop is debounced within `2.8s` after Section 4.
    - **Canonicalized Banner Move Matching (`handleMidBannerUsedMoveLines`)**: Scans both `midBannerLines` and `playerMoveLines` for `"<Opponent> used <Move>!"`, falls back to the pre-charge active opponent slot when `<Opponent>` is clipped, canonicalizes the matched move against the slot's 4 displayed moves, and updates `confirmedOppChargedMoves` both during and up to `4.5s` after Section 4 reconciliation.
  - **`100E` vs `99E` Energy Ceiling Latch After 1 Fast-Move Duration (`snapPlayerEnergyToValidStep` & `nearCeilingStepStartMs`)**:
    - Removes the unconditional `100E` tie-break candidate from `snapPlayerEnergyToValidStep` when uncapped fast-move steps land at `96–99E` (e.g., `99E` on `9E Ember` where step 12 would be `108E`), snapping cleanly to `99E` first and latching to `100E` after `1` fast-move duration (`userMoveDurationMs`) of active combat if no energy has been deducted.
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
