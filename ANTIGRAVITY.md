# ANTIGRAVITY.md — Comprehensive Project Knowledge, Architecture & Historical Decisions

> **Target Audience**: Antigravity agents, Claude/Gemini coding assistants, and core developers maintaining or extending **SilphScope PvP**.  
> **Repository**: `https://github.com/sportsfan986/silphscope-pvp`  
> **Current Version**: `v6.50` (`versionCode = 1650`)  
> **Primary Branches**: `main` (source code & releases) | **Telemetry & DVR Endpoint**: `https://silphscope-telemetry.silphscope-pvp.workers.dev` (Cloudflare Worker + KV/R2 + Telegram Channel `SilphScope DVR`).

---

## 1. Executive Summary & Mission

**SilphScope PvP** is a real-time battle intelligence HUD and predictive decision engine for **Pokémon GO Battle League (GBL)** and **Show 6 (Battle Frontier)** tournament play. It operates as an unobtrusive Android floating overlay (`WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY`) rendered over the Pokémon GO game client, backed by an interactive React web dashboard and PvP simulator.

### Core Mission
1. **Real-Time Combat Math**: Compute exact charged-move damage percentages, shield-dependent PvPoke battle ratings, fast-move turn pacing, and sneak-prevention timing without disrupting player focus.
2. **Zero Game Impact**: Achieve zero latency overhead, zero Pokémon GO game frame drops, and <0.5% CPU overhead through in-memory frame processing, single-pass virtual display projection, and hardware H.264 offloading.
3. **Objective Skill Analytics**: Separate blind team-composition matchmaking luck (Blind Matchup Favorability / BMF) from in-battle micro-execution skill (Wins Above Expected / WAE) and lead-loss recovery performance.
4. **Data Privacy & Open Telemetry**: Transmit zero private data or telemetry to third-party tracking services. All cloud delta synchronization and diagnostic recordings upload exclusively to the user's private GitHub vault or the dedicated `ai-telemetry-logs` branch.

---

## 2. System Architecture & Component Interactions

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Android Runtime Environment                            │
│                                                                                        │
│  ┌────────────────────────┐      MediaProjection      ┌─────────────────────────────┐  │
│  │   Pokémon GO Client    │ ────────────────────────> │   VirtualDisplay (1-Pass)   │  │
│  │ (com.nianticlabs.pokemongo)│                       │   ImageReader (RGBA_8888)   │  │
│  └────────────────────────┘                           └──────────────┬──────────────┘  │
│                                                                      │                 │
│                                              ┌───────────────────────┴──────────────┐  │
│                                              │  captureCleanScreenBitmap() [Memory] │  │
│                                              └───────┬──────────────────────┬───────┘  │
│                                                      │                      │          │
│                                 ┌────────────────────┘                      │          │
│                                 ▼                                           ▼          │
│  ┌───────────────────────────────────────────────────┐    ┌─────────────────────────┐  │
│  │             OverlayService.kt Workers             │    │  GBLBattleDvrThread     │  │
│  │  • Pixel HP Scanner (Row Lock, Y-Sampling, Clamps)│    │  • MediaCodec (AVC)     │  │
│  │  • Circle Energy Fill Detector                    │    │  • 544x1184 Surface     │  │
│  │  • ML Kit Text Recognition (Nameplates, Banners)  │    │  • Burned-in Watermark  │  │
│  │  • Fast-Move Cadence Tracker & Swap Rollback      │    │  • MediaMuxer (MP4)     │  │
│  │  • 4-Pillar Tactical Recommendations Engine       │    │  • _deep_trace.jsonl    │  │
│  │  • Synchronized Haptics Engine (Android Vibrator) │    └────────────┬────────────┘  │
│  └──────────────────────────┬────────────────────────┘                 │               │
│                             │ JSON IPC via AndroidBridge               │               │
│                             ▼                                          │               │
│  ┌───────────────────────────────────────────────────┐                 │               │
│  │     Floating WebView HUD (overlay.html)           │                 │               │
│  │  • Mirrored Header: [CP, HP, E, 🛡️] | [🛡️, E, HP, CP]│                 │               │
│  │  • 3x3 Matchup & Asymmetric 9-Shield Matrix       │                 │               │
│  │  • 2-Line Tactical Coach (Top or Bottom HUD)      │                 │               │
│  │  • 1-Battle DVR Arm/Rec Button & State            │                 │               │
│  └───────────────────────────────────────────────────┘                 │               │
│                                                                        │               │
│  ┌───────────────────────────────────────────────────┐                 │               │
│  │       MainActivity.kt (Settings & Battle Log)     │                 │               │
│  │  • Teams Manager, Anti-Meta Builder & Meta Tab    │                 │               │
│  │  • Multi-Device GitHub Cloud Delta Sync           │                 │               │
│  │  • Lead-Loss Recovery Rate & Safe-Swap MVP        │                 │               │
│  │  • Haptics Tuning Sliders & DVR Master Switch     │                 │               │
│  └──────────────────────────┬────────────────────────┘                 │               │
└─────────────────────────────┼──────────────────────────────────────────┼───────────────┘
                              │                                          │
                              ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Cloud Services & CI/CD                             │
│                                                                                        │
│   • main Branch: Source code, Web Simulator (GitHub Pages), and Release APK builds     │
│   • ai-telemetry-logs Branch: Anomaly telemetry batches, deep traces, and DVR MP4s     │
│   • GitHub Gist / Repo API: Private N-device delta sync vault (Teams + Battle Logs)     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Specifications & Technical Invariants

### 3.1. Vision Pipeline & Single-Pass Screen Capture
- **Android 14+ Token Invariant**: Android 14+ strictly enforces that a `MediaProjection` token cannot create more than one `VirtualDisplay`. Attempting a second virtual display crashes the service.
- **Bitmap Reuse**: `captureCleanScreenBitmap()` captures a single frame into memory. This single bitmap is cropped for OCR, evaluated for pixel HP/energy fill, and passed to the hardware video encoder.
- **ML Kit OCR Regions**:
  - `srcTopLeft` (`0.02w..0.45w, 0.05h..0.12h`): Player Pokémon name and active CP.
  - `srcTopRight` (`0.55w..0.98w, 0.05h..0.12h`): Opponent Pokémon name and active CP.
  - `srcMidBanner` (`0.08w..0.92w, 0.15h..0.52h`): Used-move announcements (`"<Pokemon> used <Move>!"`).
  - `srcMoves` (`0.68h..0.97h`): Bottom charge circle labels (omitted during active combat to save CPU).
- **Pixel HP Bar Scanner**:
  - Scans horizontal pixel row lines across the green/yellow/red health bars (`playerHpRowY` and `oppHpRowY`).
  - Locks to the specific vertical Y coordinate where the bar boundary is sharpest.
  - Applies a rolling debounce filter (default: 2 samples, $\pm 2\%$ tolerance) to reject single-frame compression artifacts while allowing legitimate damage drops to commit instantly.
  - Enforces monotonic HP decrease during normal combat, but allows a controlled upward reset on confirmed switch-ins and faints.

### 3.2. Live Energy Cadence & Swap-Throw Attribution
- **Fast-Move Turn Clocks**: Fast moves advance in discrete turns (1 turn = 0.5s; range: 1 to 5 turns).
- **Circle Fill Snapshot**: Samples the circular energy button fill percentage (`0%–100%`). To prevent camera zoom-in pixel distortion from wiping out banked energy, the system holds the peak of the last 2 stable frames (`max(lastStable, prevStable)`).
- **3-Layer Swap-and-Immediate-Throw Attribution**:
  - *Layer 1 (Banner Matching)*: Matches `<Pokemon>` in the announcement banner against the active slot, known bench slots, and full database. If an unrevealed bench Pokémon threw immediately upon entry, it registers the slot and refunds energy to the prior slot.
  - *Layer 2 (Post-Throw Nameplate Rollback)*: If top nameplate OCR identifies a newly switched Pokémon within the 4.0s rollback window, `tryRollbackRecentSwapAndImmediateThrow` transfers the energy deduction and move history to the new slot.
  - *Layer 3 (Pre-Throw HP Jump Hint)*: Detects an HP jump $\ge 15\%$ within 1200ms before zoom as evidence of a switch.

### 3.3. Asymmetric 9-Shield Matrix & Battle Analytics
- **9-Shield Combat Matrix**: Evaluates matchup rating $R \in [0, 1000]$ ($500 = \text{Neutral}$) across all $(s_{\text{user}}, s_{\text{opp}}) \in \{0, 1, 2\}^2$.
- **Blind Matchup Favorability (BMF / $P_{\text{pre}}$)**:
  $$S_{\text{lead}} = 0.50 \cdot R_{1\text{v}1}(\text{lead}) + 0.50 \cdot R_{2\text{v}2}(\text{lead})$$
  $$S_{\text{back}} = 0.70 \cdot \max(A, B) + 0.30 \cdot \min(A, B)$$
  $$M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}, \quad P_{\text{pre}} = \frac{1}{1 + e^{-0.006 \cdot (M - 500)}}$$
- **Dynamic Execution WAE**:
  $$S_{\text{actual}} = \sum \tau_k \cdot R_k, \quad P_{\text{exec}} = \frac{1}{1 + e^{-0.006 \cdot (S_{\text{actual}} - 500)}}$$
  $$\Delta Q = \text{Result} - P_{\text{exec}} \quad (\times 1.10\text{ on clean sweeps}, -0.15\text{ per unused shield on loss})$$
- **Lead-Loss Recovery Rate (Safe-Swap Efficiency)**:
  - Tracks `Lead Won Conversion` ($W/(W+L)$ when lead is Favorable).
  - Tracks `Lead Lost Recovery Rate` ($W/(W+L)$ when lead is Negative) with qualitative grades ($S \ge 45\%$, $A \ge 35\%$, $B \ge 25\%$, $C \ge 15\%$, $D < 15\%$).
  - Derives `Safe-Swap MVP`: The specific bench Pokémon with the highest win conversion when swapped into negative leads.

### 3.4. 4-Pillar AI Tactical Coach
The HUD displays a compact, high-contrast 2-line tactical recommendation banner (`#sky-tactical-rec-row`), placed at the **Bottom** of the HUD by default (configurable to **Top**):
- **Pillar 1 (Backline Prediction)**: Probability breakdown of unrevealed opponent slots based on current-season empirical meta cores.
- **Pillar 2 (Lead Alignment Risk)**: Recommends whether to swap or stay/chip based on whether the opponent's predicted backline hard-counters your bench.
- **Pillar 3 (Move Pacing & Visual Warning Alerts)**:
  - `FARM DOWN: NF TO KO` (Emerald): Opponent will faint to fast moves before reaching a charged attack.
  - `WARN_2_FASTS` (Solid Amber): 2 fast moves remaining before throw or catch window.
  - `BLINK_1_FAST` (Blinking Crimson/Amber): Exactly 1 fast move left before opponent reaches charged move or window closes.
  - `IMMEDIATE_0_FAST` (Rapid Blink): Window open now.
- **Pillar 4 (Incoming Attack Survival Math)**: Computes whether active Pokémon can safely tank unshielded and reach its own move before fainting (`TANK -> MOVE IN 2F` vs `SHIELD -> DIES 1F SHORT`).

### 3.5. Synchronized Haptics & Vibration Engine
- **Opponent Swap Clock Alert**: When the opponent's 50s switch clock drops below the warning threshold (default: $< 5\text{s}$), triggers a distinct **single 80ms vibration pulse**.
- **Opponent Move Imminent Alert**: When the opponent is within 1 fast move of reaching a charged attack, triggers a distinct **double 80ms vibration pulse** (`80ms on, 60ms off, 80ms on`).
- **Synchronization**: The haptic trigger evaluates in the exact same tick cycle as the visual HUD blinking badges (`BLINK_1_FAST`).
- **Customization**: Dedicated Haptics section in Settings allows independent toggles and slider threshold adjustments for both alerts.

### 3.6. 1-Battle Full-Screen H.264 DVR + Deep Frame Trace
- **Zero-Impact Hardware Encoding**:
  - Uses `MediaCodec.createEncoderByType("video/avc")` configured at $544 \times 1184$, $1.2\text{ Mbps}$, $30\text{ fps}$, baseline profile.
  - Feeds scaled frames onto `MediaCodec.createInputSurface()` from the background `GBLBattleDvrThread`.
  - Runs at `Process.THREAD_PRIORITY_BACKGROUND`, offloading all compression to the hardware DSP with $< 0.5\%$ CPU load.
- **Burned-In Watermark**: Draws a high-contrast top banner onto the video frame (`F#0042 T+14.35s U:88%(88%)/35E O:23%(23%)/7E`) ensuring that every frame in the video matches the timestamp and frame index in the companion `_deep_trace.jsonl` exactly.
- **Arming Flow**:
  - Setting: `Show 1-Battle DVR Button in Overlay` enables/disables the `REC 1` HUD button.
  - Overlay: Tapping `REC 1` arms recording for **exactly 1 battle** (`OFF` $\to$ `ARMED` $\to$ `REC F#...`).
  - Auto-Disarm: Automatically disarms immediately upon battle stop/completion.
- **Auto-Upload Engine**:
  - Automatically commits and uploads `recordings/<safeUser>/<battleId>_video.mp4` and `recordings/<safeUser>/<battleId>_deep_trace.jsonl` to the `ai-telemetry-logs` branch using the GitHub Contents API.
  - Deletes temporary local files immediately after successful transmission to maintain minimal storage footprint.

---

## 4. Comprehensive Chronological History of User Requests & Design Decisions

### Turn 1 — Initial Inquiry
- **User Request**: "build failed on github"
- **Investigation**: Inspected GitHub Actions run logs. Build failed due to missing execute permissions on `gradlew` and Kotlin type signature mismatches on recent UI bindings.
- **Action**: Ran `chmod +x gradlew`, aligned type signatures, verified successful build and released `v6.05`.

### Turn 2 — Exploratory Recommendations
- **User Request**: "suggestions to add or change"
- **Analysis**: Proposed 6 high-value tactical enhancements:
  1. Synchronized Haptic vibration alerts for opponent swap timer and move readiness.
  2. Lead-Loss Recovery Rate (Safe-Swap Efficiency) analytics in Battle Log.
  3. Pre-cutscene and post-cutscene dual-HP settling audit telemetry.
  4. 1-Battle zero-lag full-screen DVR with burned-in frame timestamps.
  5. Multi-cycle energy mutation ledger.
  6. Dedicated Haptics tuning controls.

### Turn 3 — Feature Selection & Clarifying Questions
- **User Request**:
  1. Vibration when opponent swap clock is $< 5\text{s}$.
  2. Double vibration when opponent is 1 fast move from charged move.
  3. Tie alerts to the same warning time as the blinking HUD indicators.
  4. Allow option to enable/disable each vibration and tune thresholds.
  5. Lead-Loss Recovery Rate (Safe-Swap Efficiency) display.
  6. Review telemetry logs for critical issues.
- **Implementation (v6.06)**: Shipped synchronized vibration triggers, threshold sliders in `activity_main.xml` and `MainActivity.kt`, and the Lead-Loss summary banner in `MainActivity.kt` and `src/App.tsx`.

### Turn 4 & 5 — Deep Diagnostics & 1-Battle Video Recording (v6.07)
- **User Request**: Add enhanced energy/HP logging and zero-impact 1-battle full-screen DVR with burned-in timestamps auto-uploaded to GitHub.
- **Delivered Changes (v6.07)**:
  - `OverlayService.kt`: Added `PostCutsceneHpAuditRecord`, `EnergyLedgerEntry`, `BattleDeepTraceFrame`, `startDvrEncoderLocked`, `recordOneBattleDvrFrameAndTraceAsync`, `finalizeAndUploadOneBattleDvrAsync`, and `uploadBattleDvrBundleToGitHubBlocking`.
  - `overlay.html`, `activity_main.xml`, `MainActivity.kt`, `src/App.tsx`: Added 1-Battle DVR controls and status indicators.

### Turn 6 — Platform Migration to Antigravity & Parity Release (v6.10)
- **Toolchain Setup & Verification**:
  - Configured local Eclipse Temurin JDK 17 (`17.0.21+9`) and Android SDK 35 (`build-tools;35.0.0`, `platforms;android-35`, `platform-tools`).
  - Verified with `apksigner` that the local keystore (`app/release.keystore`) signing certificate matches the official GitHub release build 100% bit-for-bit.
  - Bumped version to `v6.10` (`versionCode = 1610`).

### Turn 7 — Full Codebase Audit & Phases 1–4 De-Fragmentation & Modularization (v6.11)
- **User Request**: Audit entire codebase for fragmentation or major issues due to being created in AI Studio, present an action plan, and execute all 4 phases.
- **Delivered Changes**:
  - **Phase 1 (Retired Root Mirror Duplicates & Web Bundle Bloat)**: Removed 14 duplicate/stale/orphan items (root-level `MainActivity.kt`, `OverlayService.kt`, `activity_main.xml`, `MainActivity.xml`, `AndroidManifest.xml`, `app_build.gradle.kts`, `overlay.html`, `res/`, `public/overlay.html`, `public/GBL_Overlay_Source.zip`, `src/data/androidFiles.ts`, `metadata.json`, `.env.example`, `bun.lock`). Removed the legacy AI Studio `Kotlin & Android Code` tab (`android_code`) and dead `turn_matrix` tab from `src/App.tsx`, reducing the client-side JS bundle from ~4 MB down to 1.15 MB (281 kB gzip).
  - **Phase 2 (Single Source of Truth, Telemetry Bug Fix & CI Tooling)**: Added `OverlayService.APP_VERSION = "6.10"` as the single source of truth (fixing `uploadPendingAiTelemetryBatchBlocking` overwriting records with `"5.13"`/`"6.06"`), passed `SharedPreferences` into `configureReplayState` for Replay Mode parity, added `app/proguard-rules.pro`, fixed `scripts/bump_version.sh` (`versionCode = 1000 + MAJOR * 100 + MINOR`), consolidated `scripts/ingest-telemetry.mjs`, and updated `.github/workflows/android.yml` to dynamically extract release notes from `CHANGELOG.md`.
  - **Phase 3 (Android Kotlin Modularization inside `com.gbl.overlay`)**: Reduced `OverlayService.kt` by 47.9% (`28,677` → `14,948` lines) and `MainActivity.kt` (`12,487` → `12,085` lines) by extracting 8 cohesive domain files in `app/src/main/java/com/gbl/overlay/`:
    - `AppModels.kt` (`PokemonSlot`, `TeamPreset`, `BattleLogEntry`, `GblSeasonInfo`, `AppThemePalette`)
    - `TaskerIntegration.kt` (`TaskerOverlayActivity`, `TaskerBroadcastReceiver`)
    - `PokemonDatabase.kt` (`PokemonStaticData`, static/dynamic species & move databases, Gamemaster & rankings JSON parsers, and 1v1/2v2 turn-by-turn combat simulator)
    - `GitHubCloudSync.kt` (GitHub OAuth Device Flow, Gist/Repo Cloud Delta Sync, and AI Telemetry & 1-Battle DVR Auto-Upload Engine)
    - `TeamAndMetaEngine.kt` (Precomputed Top-200 9x9 matrix, BMF/WAE Battle Quality engine, Blended Season Meta, Backline Predictor, Role/Moveset upgraders & Anti-Meta Team Builder)
    - `Show6Engine.kt` (`Show6StaticData`, Show 6 Pick 3 120x120 minimax optimizer, PvPoke Limited Meta sync, Google Sheets sync & roster upgraders)
    - `PixelScannerEngine.kt` (10Hz real-time pixel/CV scanners for Pokéballs, Shields, Charge Circles, Prescan Calibration & Floating HP Bars)
    - `BattleDvrEngine.kt` (1-Battle hardware H.264 `MediaCodec` + `MediaMuxer` DVR & frame-synced `_deep_trace.jsonl` engine)
  - **Phase 4 (Web React/TypeScript Modularization)**:
    - Split `src/data/gblData.ts` (`16,285` lines) into 4 domain modules (`src/data/pokemonDb.ts`, `src/data/combatSimulator.ts`, `src/data/teamAndMetaEngine.ts`, `src/data/show6Engine.ts`) with `src/data/gblData.ts` preserved as a barrel re-export.
    - Extracted 6 UI/model modules from `src/App.tsx` (`18,428` → `15,807` lines) into `src/components/`: `AppThemeAndModels.tsx`, `MetaTab.tsx`, `HelpTab.tsx`, `MathValidatorTab.tsx`, `TrashBinModals.tsx`, and `DocumentationModals.tsx`.

### Turn 8 — 1-Battle DVR Video Telemetry Root-Cause Analysis & v6.12 Fixes
- **User Request**: Pull in telemetry logs, prioritize issues found in the two 1-Battle DVR video logs (`log-1793840570834-275` and `log-1793854631467-245`), increment build number to `v6.12`, log `appVersion` across all telemetry going forward, build locally first, and push to GitHub.
- **Delivered Changes (v6.12)**:
  - `PixelScannerEngine.kt` & `OverlayService.kt`: Enforced Pokémon GO's HP shader color-to-percentage law (`leftBand` 1/2/3 vs `%`), tightened `oppHpCorridorRect` (`<= 0.50h`) and `playerHpCorridorRect` (`<= 0.65h`), disabled `canSampleOppHpBars` during opponent charged-move zoom, and blocked post-KO active-slot resurrection during faint animations.
  - `OverlayService.kt` & `PokemonDatabase.kt`: Protected `BANNER_OCR` move names from being overwritten by post-cutscene Section 1A HP-delta inference, added `resolveRankingsMapForLeagueStatic` fallback to same-CP standard league rankings for custom/Mega cups, fixed `"MEGA ULTRA LEAGUE"` routing, and added `Dusknoir`/`Dusclops`/`Zygarde` to static fallback move tables.
  - `OverlayService.kt`: Prevented pre-minigame circle-shrink energy loss via 5-frame downward border confirmation + `recentStableReadyEnergy` high-water retention, added `"BLOCKED!"` & `"disguise is busted!"` mid-banner OCR, and gated HUD shield drops on active/recent charged attacks.
  - `GitHubCloudSync.kt`, `BattleDvrEngine.kt`, `scripts/ingest-telemetry.mjs`: Anchored `postCutsceneHpAudits` to post-cutscene exit and added `appVersion` (`"6.12"`) + `versionCode` (`1612`) tracking across all telemetry headers, DVR watermarks, and ingestion reports.

### Turn 9 — Mega Level 4 (`Super Mega`) 3rd Fixed `+` Charged Moves, 3-Button Energy Scanner & Role-Agnostic Combat Simulator (v6.20)
- **User Request**: Implement support for the 3rd fixed special `+` Charged Move on Pokémon that have a Mega Level 4 (`supermega`) form strictly in Mega-eligible leagues; calibrate the 3-button charge move pixel scanner from the in-game Mega Mewtwo Y screenshot (where the `+` move is in the center and raised slightly); update the simulator to flexibly simulate multi-throw sequences without relegating moves strictly to closer, bait, or coverage roles (e.g., two `35E` moves back-to-back vs. a single nuke); and release as `v6.20`.
- **Delivered Changes (v6.20)**:
  - `PokemonDatabase.kt`, `OverlayService.kt`, `src/data/pokemonDb.ts`: Added all 18 `*_PLUS` moves (`Fell Stinger+`, `Volt Tackle+`, `Zap Cannon+`, `Acid Spray+`, `Liquidation+`, `Outrage+`, `Dynamic Punch+`, `Future Sight+`, `Drill Peck+`, `Dark Pulse+`, `Night Shade+`, `Brave Bird+`, `Ominous Wind+`, `Seed Bomb+`, `Mystical Fire+`, `Surf+`, `Psybeam+`, `Brick Break+`), all 18 Super Mega species base stats, `SUPER_MEGA_PLUS_MOVES` / `DYNAMIC_SUPER_MEGA_PLUS_MOVES` (`extraChargedMoves` ingestion), and `resolveMegaPlusMoveStatic` / `resolveMegaPlusMove` gated strictly on `isMegaAllowedInLeague`.
  - `PokemonDatabase.kt`, `TeamAndMetaEngine.kt`, `src/data/pokemonDb.ts`, `src/data/combatSimulator.ts`, `src/data/teamAndMetaEngine.ts`: Upgraded `simulateTurnByTurnChargedCycleStatic` / `simulateTurnByTurnChargedCycle` to accept an optional 3rd `+` move (`c3`) and evaluate role-agnostic single throws, back-to-back spam pairs ($m_a \to m_a$, such as $35\text{E} \to 35\text{E}$ vs. $75\text{E}$ nukes), and 1S/2S multi-throw sequences across all available moves.
  - `PixelScannerEngine.kt`, `OverlayService.kt`, `overlay.html`, `MainActivity.kt`, `src/App.tsx`: Added 3-button charge circle pixel scanning (`cx = 0.2150w, cy = 0.8930h` Left Move 1, `cx = 0.5000w, cy = 0.8375h` Center-Raised `+` Move, `cx = 0.7820w, cy = 0.8930h` Right Move 2) with 2-button fallback, 3-move post-throw energy deduction, 3rd player move HUD row, and `[+ <PlusMove>]` / `[Mega4]` badges in Presets, Autocomplete, Anti-Meta Builder, and Team Editor.

### Turn 10 — Security Audit Remediation, APK Signature Scheme v3 Key Rotation & Toolchain Hardening (v6.21)
- **User Request**: Perform full security/performance/toolchain audit, raise `minSdk` to Android 12 (`31`), implement APK Signature Scheme v3 key rotation with a 4096-bit RSA key stored in GitHub Actions Secrets so existing installations update seamlessly in-place while revoking the old key's capabilities, apply all remaining security/performance fixes, and release as `v6.21` via GitHub Actions CI/CD.
- **Delivered Changes (v6.21)**:
  - `app/build.gradle.kts`, `.github/workflows/android.yml`, `.gitignore`: Raised `minSdk = 31` (Android 12), removed `app/release.keystore` from Git, provisioned encrypted GitHub Actions secrets (`RELEASE_KEYSTORE_B64`, `RELEASE_LINEAGE_B64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_PASSWORD`, `RELEASE_KEY_ALIAS`), and configured `apksigner` APK Signature Scheme v3 key rotation with capabilities revoked on the prior signer.
  - `AndroidManifest.xml`, `OverlayService.kt`, `MainActivity.kt`, `BattleDvrEngine.kt`, `TaskerIntegration.kt`, `overlay.html`: Set `android:allowBackup="false"`, added `escapeHtml()` across HUD dynamic strings, marshaled all `@JavascriptInterface` mutations onto the main Looper, closed `textRecognizer` and destroyed WebViews on teardown, switched DVR rendering to `lockHardwareCanvas()` with `AtomicBoolean` backpressure, and guarded `startForegroundService` in `TaskerBroadcastReceiver`.
  - `src/App.tsx`, `index.html`, `tsconfig.json`, `package.json`, `.github/workflows/deploy-pages.yml`: Fixed Show 6 vs. GBL trash/migration storage keys, gated swap countdown interval ticks so idle tabs consume zero re-renders, narrowed web PAT link scope to `gist`, added a strict `Content-Security-Policy`, enabled TypeScript `"strict": true`, and upgraded GitHub Pages CI to Node 22 + `npm ci` + `npm run lint`.

---

## 5. Antigravity Agent Operational Runbook

When working on this repository inside Antigravity:

### 5.1. Single Source of Truth Paths
- **Android Application (`app/src/main/java/com/gbl/overlay/`)**:
  - `MainActivity.kt`, `OverlayService.kt`, `AppModels.kt`, `TaskerIntegration.kt`, `PokemonDatabase.kt`, `GitHubCloudSync.kt`, `TeamAndMetaEngine.kt`, `Show6Engine.kt`, `PixelScannerEngine.kt`, `BattleDvrEngine.kt`.
  - Resources & HUD: `app/src/main/res/`, `app/src/main/assets/overlay.html`, and `app/build.gradle.kts`. Do **not** create duplicate mirror copies in the repository root.
- **Web Simulator (`src/`)**:
  - Entry & Core UI: `src/App.tsx`, `src/components/AppThemeAndModels.tsx`, `src/components/MetaTab.tsx`, `src/components/HelpTab.tsx`, `src/components/MathValidatorTab.tsx`, `src/components/TrashBinModals.tsx`, `src/components/DocumentationModals.tsx`.
  - Data & Math Engine: `src/data/gblData.ts` (barrel), `src/data/pokemonDb.ts`, `src/data/combatSimulator.ts`, `src/data/teamAndMetaEngine.ts`, `src/data/show6Engine.ts`, `src/data/battleQuality.ts`.

### 5.2. Default Release Workflow (GitHub Actions CI/CD First)
> **Default Policy**: Do **not** run full local Android APK builds (`./gradlew assembleRelease`) on Windows unless explicitly requested. Instead, validate TypeScript/Web locally (`npm run lint && npm run build`), commit and push to `main`, and monitor the GitHub Actions workflows (`Build Android APK` and `Deploy Web Simulator to GitHub Pages`) until completion, addressing any failures immediately.

1. **Web TypeScript & Bundle Verification (Fast Local Gate)**:
   - On Windows, always prepend Node 22 (`C:\Users\Chris\.nodejs\node-v22.14.0-win-x64`) and JDK 17 (`C:\Users\Chris\.jdks\jdk-17.0.21+9\bin`) to `PATH` before invoking `node`/`npm`/`keytool`:
   ```bash
   npm run lint
   npm run build
   ```
2. **Optimized GitHub Actions Android Build Configuration (~2.5 min CI Build)**:
   - **7 GB Runner JVM Sizing (`gradle.properties`)**: Keep `org.gradle.jvmargs=-Xmx2560m -XX:MaxMetaspaceSize=768m -XX:+UseParallelGC` and `kotlin.daemon.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=768m -XX:+UseParallelGC` (`kotlin.incremental=true`) so combined Gradle + Kotlin compiler memory never exceeds the 7 GB physical RAM on `ubuntu-latest` (preventing 22-minute swap thrashing).
   - **Kotlin K2 Compiler & Explicit Collection Types**: Use Kotlin `2.0.21+` in `build.gradle.kts` and **always annotate explicit return types** (`: List<T>`, `: Map<K, V>`) on large static `listOf(...)` / `mapOf(...)` properties in `PokemonDatabase.kt`, `OverlayService.kt`, and `MainActivity.kt` so K2 skips global return-type inference.
   - **Gradle Build Cache & Lint Vital (`app/build.gradle.kts` & `.github/workflows/android.yml`)**: Keep `lint { checkReleaseBuilds = false; abortOnError = false }` and invoke `./gradlew assembleRelease --build-cache --no-daemon --stacktrace` in CI.
3. **APK Signature Scheme v3 Key Rotation & In-Place Upgrade Invariants**:
   - Release signing uses the 4096-bit RSA key (`alias = silphscope`) and rotation lineage stored in GitHub Actions secrets (`RELEASE_KEYSTORE_B64`, `RELEASE_LINEAGE_B64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_PASSWORD`, `RELEASE_KEY_ALIAS`) with `minSdk = 31` (`--v1-signing-enabled false --v2-signing-enabled false --v3-signing-enabled true --rotation-min-sdk-version 31`).
   - **CRITICAL**: In `RELEASE_LINEAGE_B64`, the prior signer (`gblkey`) **must** retain `--set-installed-data true` and `--set-rollback false`. Setting `--set-installed-data false` causes Android `PackageManager` to reject in-place upgrades (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) and triggers Google Play Protect developer blocks.
4. **Checking & Ingesting Cloudflare Telemetry & 1-Battle DVR Videos**:
   - All telemetry batches (`POST /v1/telemetry`), settings change audits (`POST /v1/settings-changes`), and 1-Battle DVR recordings (`POST /v1/dvr`) upload directly to the Cloudflare Worker (`https://silphscope-telemetry.silphscope-pvp.workers.dev`) and mirror DVR videos to the `SilphScope DVR` Telegram channel.
   - **5-Minute Local Background Sync (`SilphScope-Telemetry-Sync`)**: A native Windows Scheduled Task runs `node scripts/ingest-telemetry.mjs --sync-only --prune-remote` every 5 minutes using local Node 22 + `ffmpeg.exe` (0 AI tokens). It downloads new batches and DVR `.mp4` videos into `.aistudio/telemetry_cache/`, deletes them from Cloudflare once safely saved locally, enforces a **1.0 GB local storage cap** (keeping ~70–80 full `.mp4` videos on disk for regression testing), and pre-renders `digest.json`, `4x6` (24-frame) tiled contact sheets, and individual keyframes into `.aistudio/telemetry_cache/preprocessed/<battleId>/`.
   - **Tunable Preprocessing Config**: Edit [`scripts/telemetry-preprocess-config.json`](./scripts/telemetry-preprocess-config.json) and run `npm run telemetry:reprocess` to adjust screenshot rules (Battle Start, Charged Move In/Out transitions, Large HP Changes & Animation windows, Swaps, Energy Shifts, Battle End).
   - **On-Demand Reporting**: Only generate or analyze telemetry reports when requested by the user:
   ```bash
   npm run telemetry:report
   ```

### 5.3. Version Bumping & Default Release Checklist
When publishing a new release:
1. **Auto-Increment by `+0.01` (Default)**: Unless the user specifies an explicit target version, increment the current version in `VERSION` by `+0.01` (e.g., `v6.21` -> `v6.22`, `versionCode = 1000 + MAJOR * 100 + MINOR`) by running `./scripts/bump_version.sh` (with no arguments, or `./scripts/bump_version.sh vX.XX` if specified) and syncing `VERSION`, `app/build.gradle.kts`, `OverlayService.APP_VERSION`, `MainActivity.kt`, `GitHubCloudSync.kt`, `activity_main.xml`, `overlay.html`, `package.json`, `src/App.tsx`, `README.md`, and `ANTIGRAVITY.md`.
2. Add the new version entry at the top of `CHANGELOG.md`.
3. Run fast local Web verification (`npm run lint && npm run build`).
4. Commit and push to `origin main` to trigger `.github/workflows/android.yml` (`Build Android APK`, ~2–3 min) and `.github/workflows/deploy-pages.yml` (`Deploy Web Simulator to GitHub Pages`, ~45s).
5. **Monitor GitHub Actions Run Until Completion**: Use the `schedule` tool (~2 min timer) to check the workflow run status via the GitHub Actions API (`https://api.github.com/repos/sportsfan986/silphscope-pvp/actions/runs`), verify that `silphscope-pvp-vX.XX.apk` is published to GitHub Releases and notify the user when complete, or automatically fetch job logs, fix, and re-push if any step fails.

### 5.4. Common Pitfalls & Guardrails
- **DO NOT** attempt to create a second `VirtualDisplay` from `MediaProjection`.
- **DO NOT** commit GitHub Personal Access Tokens or API keys into any file.
- **DO NOT** block the main UI thread in `OverlayService.kt`. All image compression, OCR, and disk/network operations must run on `dvrThread`, `ocrExecutor`, or coroutine scopes.
- **DO NOT** remove or alter the `#btn-minimize-sword` hold-to-exit handler in `app/src/main/assets/overlay.html`, as players rely on it to safely exit the overlay without switching apps.
