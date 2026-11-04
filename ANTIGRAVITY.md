# ANTIGRAVITY.md — Comprehensive Project Knowledge, Architecture & Historical Decisions

> **Target Audience**: Antigravity agents, Claude/Gemini coding assistants, and core developers maintaining or extending **SilphScope PvP**.  
> **Repository**: `https://github.com/sportsfan986/silphscope-pvp`  
> **Current Version**: `v6.07` (`versionCode = 1607`)  
> **Primary Branches**: `main` (source code & releases), `ai-telemetry-logs` (isolated telemetry, DVR recordings & anomaly traces).

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
- **Clarification Round 1**:
  - *Q1 (Vibration Pattern)*: Distinct short pulses (80ms single, 80ms double) vs continuous? $\to$ **User selected: Distinct short pulses (80ms single, 80ms double)**.
  - *Q2 (Configuration Location)*: Dedicated Haptics section in Settings with sliders vs in-overlay menu? $\to$ **User selected: Dedicated Haptics section in Settings with threshold sliders**.
  - *Q3 (Display Placement)*: Summary banner in Battle Log vs separate tab? $\to$ **User selected: Summary banner showing Lead Won, Lead Lost, and Safe-Swap MVP**.
- **Implementation (v6.06)**: Shipped synchronized vibration triggers, threshold sliders in `activity_main.xml` and `MainActivity.kt`, and the Lead-Loss summary banner in `MainActivity.kt` and `src/App.tsx`.

### Turn 4 — Deep Diagnostics & 1-Battle Video Recording Request
- **User Request**:
  1. Is there additional logging to better analyze energy and HP for future updates?
  2. Would an option to record video of the battle used for OCR and pixel analysis (1 battle at a time, with detailed overlay logs) be too CPU-intensive, or can it be done with zero impact?
- **Analysis & Feasibility**:
  - Confirmed hardware H.264 encoding (`MediaCodec` `video/avc`) offloads compression to the hardware video encoder DSP.
  - By reusing the in-memory bitmap from `captureCleanScreenBitmap()` on a background thread (`GBLBattleDvrThread`), there are **zero additional screen captures**, no extra virtual displays (abiding by Android 14+ rules), and $< 0.5\%$ CPU overhead.
  - Proposed full-screen clean video with burned-in frame/timestamp header and companion `_deep_trace.jsonl`.
- **Clarification Round 2**:
  - *Q1 (Video Format)*: Clean video with burned-in timestamp header or raw video? $\to$ **User selected: Clean video + burned-in timestamp to correlate with logs**.
  - *Q2 (Arming UX)*: Automatic on all battles vs armed only when setting is enabled in app? $\to$ **User selected: Only when setting is enabled in app, arming 1 battle at a time**.
  - *Q3 (Upload Pipeline)*: Save to gallery vs auto-upload to GitHub? $\to$ **User selected: Auto-upload directly to GitHub telemetry repo immediately after battle**.

### Turn 5 — Implementation Plan & Delivery (v6.07)
- **Implementation Plan Approved**: Created and executed implementation plan for `v6.07`.
- **Delivered Changes**:
  - `OverlayService.kt`: Added `PostCutsceneHpAuditRecord`, `EnergyLedgerEntry`, `BattleDeepTraceFrame`, `startDvrEncoderLocked`, `recordOneBattleDvrFrameAndTraceAsync`, `finalizeAndUploadOneBattleDvrAsync`, and `uploadBattleDvrBundleToGitHubBlocking`.
  - `overlay.html`: Added `.hud-btn.btn-dvr` styles, `#btn-dvr-rec-one` toolbar button, `toggleArmOneBattleDvr()` bridge function, and live frame count status badge (`REC F#...`).
  - `activity_main.xml` & `MainActivity.kt`: Added `btn_toggle_show_one_battle_dvr`, `btn_arm_one_battle_dvr_now`, and `text_one_battle_dvr_status` with live status updates.
  - `app/build.gradle.kts` & `app_build.gradle.kts`: Bumped `versionCode = 1607`, `versionName = "6.07"`.
  - `src/App.tsx`: Added Card 3B for 1-Battle DVR and Energy/HP diagnostic telemetry preview in Settings.
  - **CI Verification**: GitHub Actions run `41898378954` succeeded cleanly, publishing `silphscope-pvp-v6.07.apk`.

---

## 5. Antigravity Agent Operational Runbook

When working on this repository inside Antigravity:

### 5.1. Always Enforce the Mirror File Invariant
Whenever modifying core Android logic, layout, or HUD assets, you **must synchronize both root and submodule copies**:
```bash
cp OverlayService.kt app/src/main/java/com/gbl/overlay/OverlayService.kt && \
cp MainActivity.kt app/src/main/java/com/gbl/overlay/MainActivity.kt && \
cp activity_main.xml app/src/main/res/layout/activity_main.xml && \
cp overlay.html app/src/main/assets/overlay.html && \
cp overlay.html public/overlay.html && \
cp app_build.gradle.kts app/build.gradle.kts
```

### 5.2. Local Verification Commands
1. **Web Build Verification**:
   ```bash
   npm run build
   ```
2. **Android APK Compilation (if Android SDK installed)**:
   ```bash
   ./gradlew assembleRelease
   ```
3. **Checking Telemetry Branch**:
   To inspect live telemetry batches or DVR uploads from actual user battles:
   ```bash
   git fetch origin ai-telemetry-logs:ai-telemetry-logs
   git log origin/ai-telemetry-logs -n 10
   ```

### 5.3. Version Bumping Checklist
When publishing a new release:
1. `app/build.gradle.kts` and `app_build.gradle.kts`: Increment `versionCode` (e.g., `1607` $\to$ `1608`) and update `versionName` (e.g., `"6.07"` $\to$ `"6.08"`).
2. `VERSION`: Update version string.
3. `README.md`, `CHANGELOG.md`, and `src/App.tsx`: Update version references.
4. Push to `main` branch to trigger `.github/workflows/android.yml`.

### 5.4. Common Pitfalls & Guardrails
- **DO NOT** attempt to create a second `VirtualDisplay` from `MediaProjection`.
- **DO NOT** commit GitHub Personal Access Tokens or API keys into any file.
- **DO NOT** block the main UI thread in `OverlayService.kt`. All image compression, OCR, and disk/network operations must run on `dvrThread`, `ocrExecutor`, or coroutine scopes.
- **DO NOT** remove or alter the `#btn-minimize-sword` hold-to-exit handler in `overlay.html`, as players rely on it to safely exit the overlay without switching apps.
