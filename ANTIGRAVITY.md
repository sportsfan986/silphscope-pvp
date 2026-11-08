# ANTIGRAVITY.md — Comprehensive Project Knowledge, Architecture & Historical Decisions

> **Target Audience**: Antigravity agents, Claude/Gemini coding assistants, and core developers maintaining or extending **SilphScope PvP**.  
> **Repository**: `https://github.com/sportsfan986/silphscope-pvp`  
> **Current Version**: `v7.21` (`versionCode = 1721`)  
> **Official Domains**: `https://silphscopepvp.com` (Website & Web Simulator) • `https://dvr.silphscopepvp.com` (Cloud DVR Vault & `/watch/:shareId`) • `https://api.silphscopepvp.com` (Telemetry, Auth & Webhooks API) • `https://dl.silphscopepvp.com` (1-Click APK Download).

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
  - Uses `MediaCodec.createEncoderByType("video/avc")` configured at $544 \times 1184$, baseline profile:
    - **Free / Supporter / Legend Pro**: $15\text{ fps}$, $720\text{ kbps}$ CBR (`QP 27–38`), ~14 MB per battle.
    - **VIP / Coach Pass (`30 FPS Smooth` Default)**: $30\text{ fps}$, $900\text{ kbps}$ CBR (`QP 27–38`), ~20 MB avg / strictly $\le 30\text{ MB}$ at 240s max battle length (with a 1-tap `15 FPS Storage Saver` toggle).
  - Feeds scaled frames onto `MediaCodec.createInputSurface()` from the background `GBLBattleDvrThread`.
  - Runs at `Process.THREAD_PRIORITY_BACKGROUND`, offloading all compression to the hardware DSP with $< 0.5\%$ CPU load.
- **Burned-In Watermark**: Draws a high-contrast top banner onto the video frame (`F#0042 T+14.35s U:88%(88%)/35E O:23%(23%)/7E`) ensuring that every frame in the video matches the timestamp and frame index in the companion `_deep_trace.jsonl` exactly.
- **Arming Flow**:
  - Setting: `Show 1-Battle DVR Button in Overlay` enables/disables the `REC 1` HUD button.
  - Overlay: Tapping `REC 1` arms recording for **exactly 1 battle** (`OFF` $\to$ `ARMED` $\to$ `REC F#...`).
  - Auto-Disarm: Automatically disarms immediately upon battle stop/completion.
- **Cloudflare R2 Replay Vault & Diagnostic Engine**:
  - Uploads DVR `.mp4` videos and `_deep_trace.jsonl` traces to the Cloudflare Worker (`https://api.silphscopepvp.com/v1/dvr` & `https://dvr.silphscopepvp.com`) backed by R2 bucket `silphscope-replays` and KV namespace `TELEMETRY_KV`.
  - User-flagged diagnostic videos (requiring a non-blank user issue description) also mirror to the `SilphScope DVR` Telegram channel with a direct `https://dvr.silphscopepvp.com/watch/:shareId` synchronized HUD overlay player link, issue description, and paid tier badge.

### 3.7. Membership Tiers, Pricing, Payment Links & Website Integration Spec (`v7.12`)
> **Shared Knowledgebase for Website & Other Chats**: When building the official SilphScope PvP marketing website, landing pages, or checkout flows in any other chat/workspace, use the exact finalized pricing, Stripe Payment Links, Buy Me a Coffee URLs, and Cloudflare Worker API endpoints below.

#### 4-Tier Membership Structure & Feature Matrix
| Feature / Capability | 🆓 Free Community (`$0`) | 🏅 Lifetime Supporter (`$2` One-Time or Alumni*) | 🏆 Legend Pro (`$3/mo` or `$6/Season`**) | 👑 VIP / Coach (`$5/mo` or `$10/Season`**) |
| :--- | :---: | :---: | :---: | :---: |
| **Price & Billing** | **$0 Forever** | **$2 One-Time** *(or Free forever after any Pro/VIP sub)* | **$3/mo** or **$3 First-Season Intro** / **$6 per 90d GBL Season** (`$2/mo` eff.) | **$5/mo** or **$5 First-Season Intro** / **$10 per 90d GBL Season** (`$3.33/mo` eff.) |
| **Live In-Game HUD, 9-Shield Matrix & Haptics** | ✅ **100% Free** | ✅ **100% Free** | ✅ **100% Free** | ✅ **100% Free** |
| **🛡️ Attack Incoming! Shield Decision Overlay** | — | ✅ **Unlocked Forever** | ✅ **Unlocked Forever** | ✅ **Unlocked Forever** |
| **Battle Log History & Multi-Device GitHub Sync** | Current Season (+14d grace) | **Unlimited Lifetime** | **Unlimited Lifetime** | **Unlimited Lifetime** |
| **Local On-Device DVR Ring Buffer** | **1 Battle** | **5 Battles** | **25 Battles (5 Sets)** | **25–100 Battles (Slider)** |
| **Hardware H.264 DVR Video Framerate** | 15 FPS (`720 kbps`) | 15 FPS (`720 kbps`) | **15 FPS (`720 kbps` • ~14 MB)** | **🎥 30 FPS Smooth (`900 kbps` • <=30 MB max) + 💾 15 FPS Storage Saver** |
| **Cloud R2 Video & Frame Trace Vault** | — | Keeps Pinned 365d | **50 Rolling (30d) + 10 Pinned (365d) • 2 GB** | **150 Rolling (365d) + 25 Pinned (365d) • 4 GB** |
| **Anti-Meta Team Generator Leagues** | Great & Master League | **Core 3 (GL + UL + ML)** | **All Leagues + Limited/Mega/Specialty Cups** | **All Leagues + Limited/Mega/Specialty Cups** |
| **Anti-Meta Teams & ⚡ Alt Moveset Synthesis** | 1 / Archetype (Std Moves) | 2 / Archetype (Std Moves) | **Top 5 / Arch (15+ Teams) + ⚡ Alt Movesets** | **Top 5 / Arch (15+ Teams) + ⚡ Alt Movesets** |
| **🎯 Nemesis Analyzer & 🌿 What-If Branching** | Preview | Preview | ✅ **Full Access** | ✅ **Full Access + Priority Review** |

- **\*Alumni Rule (`everPaid`)**: Subscribing to **Legend Pro** or **VIP** even once sets `everPaid = true` on the trainer's license and permanently unlocks **🏅 Lifetime Supporter (Alumni)** benefits forever (including the **🛡️ Attack Incoming! Shield Decision Overlay**, Unlimited Lifetime Battle Logs, 5 Local DVR Videos, Core 3 Open Leagues, and 365d Pinned Cloud Replay retention) even if their seasonal pass later expires.
- **\*\*Day 15+ First-Season Intro Promo**: GBL seasons run 90 days starting `Dec 1`, `Mar 1`, `Jun 1`, and `Sep 1` at `21:00 UTC`. During the **first 14 days** of a season, a Season Pass is full price (`$6` Legend Pro / `$10` VIP). Starting on **Day 15+** of a season, first-time subscribers (`!introPromoAlreadyUsed`) unlock the **entire remainder of the current GBL season** at the 1-month rate (`$3` Legend Pro / `$5` VIP).

#### Official Live Stripe Payment Links
Append `?client_reference_id=<urlEncodedTrainerScreenName>` to any Stripe URL when the user's Trainer Screen Name is known so the Stripe webhook (`POST /v1/webhooks/stripe`) automatically binds the license key to their handle:
- **🏅 Lifetime Supporter (`$2` One-Time)**: `https://buy.stripe.com/4gM3cwf3r8JG7XLamm1Jm07`
- **🏆 Legend Pro — 90-Day GBL Season Pass (`$6` / 3 months)**: `https://buy.stripe.com/8x2aEY8F33pma5TgKK1Jm08`
- **🏆 Legend Pro — Day 15+ First-Season Intro Promo (`$3` One-Time for Remainder of Season)**: `https://buy.stripe.com/14A4gAcVjf8491P8ee1Jm09`
- **🏆 Legend Pro — Monthly Pass (`$3` / month)**: `https://buy.stripe.com/4gM3cw7AZ0dab9XeCC1Jm0a`
- **👑 VIP / Coach — 90-Day GBL Season Pass (`$10` / 3 months)**: `https://buy.stripe.com/9B6fZi3kJ6By4Lzamm1Jm0b`
- **👑 VIP / Coach — Day 15+ First-Season Intro Promo (`$5` One-Time for Remainder of Season)**: `https://buy.stripe.com/4gM7sM5sR5xudi5amm1Jm0c`
- **👑 VIP / Coach — Monthly Pass (`$5` / month)**: `https://buy.stripe.com/28E00k2gFaRO5PD2TU1Jm0d`

#### Official Buy Me a Coffee Links (`$1` per PokéCoin)
- **Creator Page**: `https://buymeacoffee.com/silphscopepvp`
- **Memberships (`$3/mo` Legend Pro • `$5/mo` VIP / Coach)**: `https://buymeacoffee.com/silphscopepvp/membership`
- **Shop Extra `595787` — 🏅 Lifetime Supporter (`$2` One-Time)**: `https://buymeacoffee.com/silphscopepvp/e/595787`
- **Shop Extra `595788` — 🏆 Legend Pro 90-Day Season Pass (`$6`)**: `https://buymeacoffee.com/silphscopepvp/e/595788`
- **Shop Extra `595789` — 👑 VIP / Coach 90-Day Season Pass (`$10`)**: `https://buymeacoffee.com/silphscopepvp/e/595789`

#### Official Domain Architecture & API Endpoints (`silphscopepvp.com`)
- **Marketing Website, HUD Guide, Comparison Page & Web Simulator (`https://silphscopepvp.com` / `https://www.silphscopepvp.com`)**:
  - `/` (`?view=home`): Shiny Origin Forme Dialga Midnight (`dialga_shiny_midnight`) marketing landing page with interactive 4-battle Hero Phone (defaulting to Shiny Origin Dialga firing Roar of Time), 3 clickable `@Featured` 50% HUD battle GIF cards, ELO-Adaptive Anti-Meta + 3-Way Meta Fusion showcase, Hybrid Backline Predictor callout, Free 1-Click GOBattleLog Export highlight, and 4-Tier Membership Matrix.
  - `/?view=guide`: Visual 50% Translucent HUD Field Manual (6-zone anatomy, color-coded turn pacing states, and 5-step quickstart).
  - `/?view=compare`: Honest side-by-side comparison vs. PvPoke and GOBattleLog.
  - `/?view=app`: Interactive 3v3 Matchup Simulator, Custom Team Builder, and Battle Log Dashboard.
- **Instant 1-Click Android APK Download (`https://dl.silphscopepvp.com`)**: Automatically redirects (`302`) to the latest signed `.apk` asset on GitHub Releases.
- **Cloud DVR Replay Vault & Replay Theater (`https://dvr.silphscopepvp.com`)**:
  - `/vault` & `/u/:screenName`: Interactive browser DVR Replay Vault in Shiny Origin Dialga Midnight theme, defaulting to the persistent `@Featured` showcase (`replays/_featured/`) when opened without a user query, with a 1-click **`🌟 Promote to Featured`** admin button when signed in as `@sportsfan986`.
  - `/watch/:shareId?t=<seconds>`: Frame-synced H.264 video + live 50% translucent `overlay.html` HUD replay player with `?t=` timestamp auto-seek (`f_gl_debuff?t=118`, `f_ml_closer?t=18`, `f_ml_closer?t=100`, `f_ul_shield?t=44`).
- **Backend API, Auth & Webhooks (`https://api.silphscopepvp.com`)**:
  - **Pre-Checkout Unique Trainer ID Registration (`POST /v1/users/register-name`)**: Checks availability and locks `screenName` to `deviceHash` / `email` / `githubUserId`; returns `seasonPromo` (`isDay15Plus`, `introPromoEligible`, `daysRemaining`) and `paymentLinks`.
  - **Dynamic Checkout Quote (`GET/POST /v1/users/checkout-quote?screenName=<id>&email=<email>`)**: Returns `introPromoEligible` and pre-populated `recommendedLinks.supporter` (`$2`), `recommendedLinks.pro` (`$3` Intro or `$6` Season), and `recommendedLinks.vip` (`$5` Intro or `$10` Season) with `?client_reference_id=` attached.
  - **License & Tier Verification (`POST /v1/users/verify-key`)**: Accepts `{ key, screenName, email, password, githubAccessToken }` (supporting 3 sign-in methods: `Username + Token`, `Username + Password`, and `1-Click GitHub OAuth`) and returns `{ ok, active, tier, label, limits, sessionToken }`.
  - **Persistent Featured Replay Cloner (`POST /v1/replays/feature` & `GET /v1/replays/featured`)**: Copies any replay's `.mp4` and `_deep_trace.jsonl` into `replays/_featured/` (never auto-pruned) and scrubs personal screenName to `@Featured`.
- **High-Resolution Graphics & Animated 50% HUD GIF Assets (`public/screenshots/` & `docs/screenshots/`)**:
  - `silphscope_tiers_infographic.jpg`, `elo_adaptive_anti_meta_engine.jpg`, `silphscope_vs_pvpoke_teambuilder.jpg`, `silphscope_vs_gobattlelog_analytics.jpg`, `featured_hero_shiny_dialga.gif`, `featured_gl_debuff_math.gif`, `featured_ml_closer_align.gif`, `featured_ul_disguise_shield.gif`.

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

### Turn 11 — Membership Tiers (`Free`, `Lifetime Supporter`, `Legend Pro`, `VIP`), Stripe & Buy Me a Coffee Webhooks, Cloud R2 DVR Replay Vault, Compact HUD & v7.02–v7.11 Enhancements
- **Delivered Changes (`v7.00` – `v7.11`)**:
  - **`v7.00`–`v7.01` (4-Tier Membership & Cloud R2 Replay Vault)**: Added 4-tier membership system, automated Stripe + Buy Me a Coffee webhooks (`POST /v1/webhooks/stripe`, `POST /v1/webhooks/bmc`), 3-method `/vault` & Web Simulator sign-in (`Username + Token`, `Username + Password`, `1-Click GitHub OAuth`), and synchronized `/watch/:shareId` web replay theater.
  - **`v7.02` (15 FPS / 720 kbps CBR DVR Optimization, 3.0x Timestamp Fix, 50% Default HUD Opacity & Top-Left Default Launch)**: Restored `544x1184 @ 15 FPS` (`720 kbps` CBR, `QP 27–38`, strictly $\le 30\text{ MB}$ at 240s max battle length), replaced `eglPresentationTimeANDROID` overriding with real wall-clock timestamps + legacy `1.0x` auto-speed compensation, standardized `50%` default HUD opacity across Android overlay, Web Simulator, and `/watch/`, and set default overlay launch position to top-left below the status bar (`x=0`, `y = statusBarHeight + 4dp`).
  - **`v7.03` (4-Button Replay Cards, Default Per-Video Private & 5 Public Vault Visibility Modes)**: Updated `/vault` replay cards to 4 action buttons (`▶️ Watch + HUD`, `☆ Star / ⭐ Starred`, `🔒 Private / 🌐 Public` defaulting to `Private`, `🔗 Copy Link`) and added 5 Public Vault Visibility modes (`🔒 Private (Only shows ones manually made public)`, `⭐ Starred only`, `⭐+🌐 Starred + Private`, `🌐 All videos shared`, `🚫 No videos shared without login`).
  - **`v7.04` (Paid-First Telemetry Priority `P1`–`P4`, Local Root-Cause Classifier & 5 Combat/Vision Fixes)**: Added `P1`–`P4` paid-first anomaly sorting, zero-token local root-cause classifier in `scripts/ingest-telemetry.mjs`, end-to-end manual bug report header preservation, and 5 combat/vision fixes (CMP tie dual-charge transitions, swap-during-cutscene move banner retention, post-cutscene camera-zoom `oppHpRowY` spikes, energy-feasible `HP_DELTA` move inference, and `Air Cutter` `45p/35E` stats).
  - **`v7.05` (Live Compact HUD Mode, 3-State Emblem Cycle `Full → Compact → Minimized`, Optional 3x3 Matrix in Compact Mode & Idle Team/League Banner)**: Added live `Compact HUD` mode (`gbl_overlay_hud_mode`), 3-state top-left emblem cycle, optional 3x3 Matchup Matrix visibility in Compact mode (`gbl_compact_hud_show_matrix`), and idle `Waiting...` Team Pokémon & League banner.
  - **`v7.06` (Telegram Subscription Purchase/Renewal/Activation Alerts & Diagnostic Video `/watch/:shareId` Overlay Links)**: Added instant Telegram alerts on Stripe/BMC purchases, renewals, and device activations, required non-blank issue descriptions for diagnostic DVR uploads, and added `/watch/:shareId` HUD overlay links + paid tier badges to Telegram diagnostic video captions.
  - **`v7.07` (VIP Tier `30 FPS Smooth` DVR + `15 FPS Storage Saver` Mode)**: Added **👑 VIP / Coach Pass** `30 FPS Smooth` hardware H.264 DVR recording by default (`544x1184 @ 30 FPS`, `900 kbps` CBR, `QP 27–38`, ~20 MB avg / $\le 30\text{ MB}$ at 240s max battle length) with an in-app **👑 VIP Battle DVR Framerate Mode** selector (`gbl_vip_dvr_fps_mode`: `🎥 30 FPS Smooth` vs `💾 15 FPS Storage Saver` at `720 kbps` CBR saving ~30% local & cloud R2 storage), while keeping combat pixel/HP/energy vision scanning on its calibrated `~67ms` cadence via lightweight intermediate `33ms` DVR frame ticks.
  - **`v7.08` (Mega Master League Giant/Flying Floating HP Bar Scanner Fix)**: Expanded player upper-battlefield HP corridor (`0.18h..0.78h`), opponent pulled-back camera X anchor (`<= 0.715w`), tall opponent row-Y baseline (`>= 0.22h`), and translucent capsule border detection over blue sprites/night sky.
  - **`v7.09` (Shield Decision Overlay Moved to Paid-Once / Alumni Tier & Full Tier Sync)**: Moved the **🛡️ Attack Incoming! Shield Decision Overlay** (KO & Tank/Farm Verdict Card) out of Free tier and into **🏅 Lifetime Supporter (One-Time or Alumni)**, **🏆 Legend Pro**, and **👑 VIP**.
  - **`v7.10` (Progressive Opponent Reveal & Field-Entry Banked Energy in Web & Android DVR Replays)**: Updated the Cloudflare Worker `/watch/:shareId` Web Replay Player (`worker.mjs`) and Android App DVR Video Replay (`MainActivity.kt`, `BattleDvrEngine.kt`, `OverlayService.kt`) so that only opponent Pokémon revealed on the field up to the current playback timestamp $t$ appear in the 3x3 Matchup Matrix and `MY ATTACKS` damage columns (with unrevealed slots showing `—`), while unrevealed player bench Pokémon show `-E` until they enter the field, matching real live gameplay.
  - **`v7.11` (Competitive `$2 / $3-$6 / $5-$10` Pricing Alignment Across Stripe, Buy Me a Coffee, Infographic, App, Web Simulator, Cloudflare Worker & Shared Knowledgebase)**: Updated membership pricing to **`$2` Lifetime Supporter** (one-time or Alumni), **`$3/mo` or `$3` Day 15+ First-Season Intro / `$6` 90-Day Season Pass (`$2/mo` eff.) Legend Pro**, and **`$5/mo` or `$5` Day 15+ First-Season Intro / `$10` 90-Day Season Pass (`$3.33/mo` eff.) VIP / Coach** across all 7 live Stripe Payment Links, Buy Me a Coffee Memberships/Shop/Gallery/Bio (`$1` per PokéCoin), `docs/screenshots/silphscope_tiers_infographic.jpg`, Cloudflare Worker webhooks & `/vault`, Android App, Web Simulator, `README.md`, and Section 3.7 of `ANTIGRAVITY.md` (serving as the single source of truth for other chats and the upcoming website).
  - **`v7.12` (Official `silphscopepvp.com` 5-Host Domain Migration, Shiny Origin Dialga Midnight Marketing Website, Persistent `@Featured` Replay Vault, `?t=` Timestamp Deep-Linking & 50% HUD Animated Battle GIFs)**: Migrated all Android, Web, Cloudflare Worker, and GitHub endpoints to `silphscopepvp.com`, `dvr.silphscopepvp.com`, `api.silphscopepvp.com`, and `dl.silphscopepvp.com`. Built `src/components/MarketingWebsite.tsx` in the Shiny Origin Forme Dialga Midnight (`dialga_shiny_midnight`) palette featuring the Hero Phone with the user's Shiny Origin Dialga firing Roar of Time (`featured_hero_shiny_dialga.gif`), 3 clickable `@Featured` 50% HUD battle GIF cards (`featured_gl_debuff_math.gif`, `featured_ml_closer_align.gif`, `featured_ul_disguise_shield.gif`), 3 high-res 16:9 feature & comparison graphics (`elo_adaptive_anti_meta_engine.jpg`, `silphscope_vs_pvpoke_teambuilder.jpg`, `silphscope_vs_gobattlelog_analytics.jpg`), visual HUD field manual (`/?view=guide`), side-by-side comparison subpage (`/?view=compare`), persistent R2 `@Featured` replay cloning (`replays/_featured/`) with 1-click admin promotion, and `?t=<seconds>` auto-seek on `/watch/:shareId`.

---

## 5. Antigravity Agent Operational Runbook

When working on this repository inside Antigravity:

### 5.1. Single Source of Truth Paths
- **Android Application (`app/src/main/java/com/gbl/overlay/`)**:
  - `MainActivity.kt`, `OverlayService.kt`, `AppModels.kt`, `TaskerIntegration.kt`, `PokemonDatabase.kt`, `GitHubCloudSync.kt`, `TeamAndMetaEngine.kt`, `Show6Engine.kt`, `PixelScannerEngine.kt`, `BattleDvrEngine.kt`.
  - Resources & HUD: `app/src/main/res/`, `app/src/main/assets/overlay.html`, and `app/build.gradle.kts`. Do **not** create duplicate mirror copies in the repository root.
- **Web Marketing Website & Simulator (`src/`)**:
  - Entry & Core UI: `src/App.tsx`, `src/components/MarketingWebsite.tsx`, `src/components/AppThemeAndModels.tsx`, `src/components/MetaTab.tsx`, `src/components/HelpTab.tsx`, `src/components/MathValidatorTab.tsx`, `src/components/TrashBinModals.tsx`, `src/components/DocumentationModals.tsx`.
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
