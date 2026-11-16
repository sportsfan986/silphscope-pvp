# SilphScope PvP — System Architecture & Subsystem Specifications (`v7.43`)

> **Scope**: Deep technical specification for **SilphScope PvP** (`com.gbl.overlay` Android overlay + React/Vite Web Simulator + Cloudflare Edge). For daily agent rules, hard gates, and release checklists, see [../AGENTS.md](../AGENTS.md). For complete version-by-version history, see [../CHANGELOG.md](../CHANGELOG.md).

---

## 1. Runtime Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Android Runtime Environment                            │
│                                                                                        │
│  ┌────────────────────────────┐   MediaProjection   ┌───────────────────────────────┐  │
│  │        Pokémon GO          │ ──────────────────> │    VirtualDisplay (1-Pass)    │  │
│  │ (com.nianticlabs.pokemongo)│                     │    ImageReader (RGBA_8888)    │  │
│  └────────────────────────────┘                     └──────────────┬────────────────┘  │
│                                                                    │                   │
│                                            ┌───────────────────────┴────────────────┐  │
│                                            │   captureCleanScreenBitmap() [Memory]  │  │
│                                            └───────┬────────────────────────┬───────┘  │
│                                                    │                        │          │
│                               ┌────────────────────┘                        │          │
│                               ▼                                             ▼          │
│  ┌───────────────────────────────────────────────────┐    ┌─────────────────────────┐  │
│  │             OverlayService.kt Workers             │    │  GBLBattleDvrThread     │  │
│  │  • 15Hz High-Perf Vision / 10Hz Battery Saver     │    │  • MediaCodec (H.264)   │  │
│  │  • Pixel HP Scanner (Full-Corridor + Row Lock)    │    │  • 30 FPS VIP / 15 Std  │  │
│  │  • 2- & 3-Button Circle Energy Fill Detector      │    │  • 544×1184 HW Surface  │  │
│  │  • ML Kit Text Recognition (150ms Burst OCR)      │    │  • Burned-in Watermark  │  │
│  │  • Fast-Move Cadence, Mimikyu Latch & Swap-Catch  │    │  • MediaMuxer (MP4 1.0x)│  │
│  │  • 4-Pillar Coach & 4-Tier Synchronized Haptics   │    │  • _deep_trace.jsonl    │  │
│  └──────────────────────────┬────────────────────────┘    └────────────┬────────────┘  │
│                             │ JSON IPC via AndroidBridge               │               │
│                             ▼                                          │               │
│  ┌───────────────────────────────────────────────────┐                 │               │
│  │     Floating WebView HUD (overlay.html)           │                 │               │
│  │  • Mirrored Header: [CP, HP, E, 🛡️] | [🛡️, E, HP, CP]│                 │               │
│  │  • 3×3 Matchup & Asymmetric 9-Shield Matrix       │                 │               │
│  │  • Full HUD ↔ Compact HUD (6 Chips) ↔ Stealth     │                 │               │
│  │  • Auto-Start (3-2-1) / Manual DVR Badge          │                 │               │
│  └───────────────────────────────────────────────────┘                 │               │
│                                                                        │               │
│  ┌───────────────────────────────────────────────────┐                 │               │
│  │       MainActivity.kt (Settings, Meta & IVs)      │                 │               │
│  │  • 3v3 & Show 6 Teams, Anti-Meta & 3-Way Fusion   │                 │               │
│  │  • IV Lab (Multi-IV Matrix & Built Roster)        │                 │               │
│  │  • Idle-Only GBL ELO Auto-OCR & Update Notifier   │                 │               │
│  │  • Cloudflare D1 Vault Delta Sync + In-App DVR    │                 │               │
│  └──────────────────────────┬────────────────────────┘                 │               │
└─────────────────────────────┼──────────────────────────────────────────┼───────────────┘
                              │                                          │
                              ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       Cloudflare Edge (D1 + R2 + KV) & GitHub CI/CD                    │
│                                                                                        │
│   • Cloudflare D1 (silphscope-sync-db): battle_logs, team_presets, built_pokemon,      │
│     user_vault_state & global ELO crowd meta SQL (/v1/sync/vault, /v1/meta/crowd-elo)  │
│   • Cloudflare R2 (silphscope-replays): DVR MP4s, _deep_trace.jsonl & @Featured clips  │
│   • Cloudflare KV (TELEMETRY_KV): Licenses, sessions, telemetry manifests & rate limits│
│   • GitHub Actions (main): Web Simulator (silphscopepvp.com) & v3-Signed Release APKs  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Vision Pipeline, Energy Cadence & Combat State Engine

- **Single-Pass Screen Capture (Android 14+ Invariant)**:
  - Android 14+ prohibits multiple `VirtualDisplay` instances from one `MediaProjection` token. `captureCleanScreenBitmap()` acquires a single `ImageReader` frame into pre-allocated reusable buffers (`reusableVisionScreenBitmap`, `reusableOcrCompositeBitmap`, `dvrScaledBitmap`) shared under `captureLock` across Vision and `GBLBattleDvrThread`.
  - **Cadence Profiles**: Default **High-Perf 15 Hz** (`66ms` pixel polling + automatic `150ms` OCR bursts during `3-2-1` countdowns, charge cutscenes, swaps, `>= 12%` HP jumps, Pokéball transitions, and `500ms` steady state); optional cloud-synced **Battery Saver** (`100ms` / `10 Hz` + `250ms`/`300ms`/`750ms` OCR).
  - **Idle Overworld & ELO Auto-OCR**: Outside active combat, lightweight `6x6` dim/white-flash checks and early `3-2-1` countdown detection (`"go,"` / `"go "` tokens + full `3v3` Pokéballs or explicit-CP nameplates) wake combat cleanly at `"3"`/`"2"`, while an idle-only `>= 1500ms`-throttled OCR pass reads End-of-Set `"Rating: X,XXX"` and scrolled `"CURRENT SEASON"` ELO badges.
- **ML Kit OCR Regions**:
  - `srcTopLeft` (`0.02w..0.45w, 0.05h..0.12h`): Player Pokémon name and CP.
  - `srcTopRight` (`0.55w..0.98w, 0.05h..0.12h`): Opponent Pokémon name and CP.
  - `srcMidBanner` (`0.08w..0.92w, 0.15h..0.52h`): Used-move announcements (`"<Pokemon> used <Move>!"`), `"BLOCKED!"`, `"Mimikyu's disguise is busted!"`, and `"Go, <Species>!"` / `"sent out"`.
  - `srcMoves` (`0.68h..0.97h`): Bottom charge circle labels (skipped during active combat to save CPU).
- **Floating Pixel HP Bar Scanner (`PixelScannerEngine.kt`)**:
  - Full-corridor zero-allocation `IntArray` scanning with Row-Y locking, Pokémon GO HP shader color-to-percentage calibration (`green/yellow/red`), translucent capsule-border support over dark skies/blue Mega models (`0.18h..0.78h` player corridor, `<= 0.715w` pulled-back opponent anchor), 2-sample rolling debounce (`±2%` tolerance), Morpeko Hangry/Full Belly transition hold, and post-user-charge 2-frame lethal KO commit even during exit fades.
  - Suppresses spurious HP reads during opponent charge zooms, faint animations, and switch fades while allowing upward HP resets on confirmed switches/faints.
- **Charge Circle Energy, Super Mega `+` Moves & Shield State**:
  - **Fast-Move Clocks**: 1 turn = `0.5s` (`1–5` turns); `GBL_SWITCH_COOLDOWN_MS = 45_000L` (`45s`).
  - **2- & 3-Button Circle Fill Scanner**: Measures circular charge fill (`0%–100%`) across 2 buttons or 3 Super Mega `+` buttons (`cx = 0.215w, 0.500w [raised cy=0.8375h], 0.782w`), holding `max(lastStable, prevStable)` to survive charge-zoom distortion.
  - **Super Mega `+` Moves**: `Lv1 (1.0x)`–`Lv4 (1.3x)` / `Off` configurable per player slot (`PokemonSlot.plusMoveLevel`) while always assuming `Lv4 (1.3x)` for opponents in Mega-eligible leagues.
  - **Mimikyu Disguise vs. `"BLOCKED!"` Latch (`v7.42`)**: Holds ambiguous `"BLOCKED!"` banners on unbusted Mimikyu without prematurely burning a shield or busting Disguise; resolves deterministically via pixel shield telemetry and `"disguise is busted!"` / `StatStageChange`, with an unconditional `+1` shield refund safety net if Disguise bust confirms afterward.
  - **3-Layer Swap-and-Immediate-Throw Attribution**: (1) announcement banner matching + unrevealed slot energy refund, (2) 4.0s post-throw nameplate rollback (`tryRollbackRecentSwapAndImmediateThrow`), and (3) `>= 15%` pre-throw HP jump detection, plus cutscene swap-catch handling (`Go, <Species>!` / 2-frame nameplate match).

---

## 3. Combat Math, Analytics, 3-Way Meta Fusion & IV Lab

- **Asymmetric 9-Shield Matrix**: Evaluates matchup rating $R \in [0, 1000]$ ($500 = \text{Neutral}$) across all $(s_{\text{user}}, s_{\text{opp}}) \in \{0, 1, 2\}^2$ using role-agnostic multi-throw turn simulation (`simulateTurnByTurnChargedCycleStatic` / `simulateTurnByTurnChargedCycle`).
- **Blind Matchup Favorability (BMF / $P_{\text{pre}}$)**:
  $$S_{\text{lead}} = 0.50 \cdot R_{1\text{v}1}(\text{lead}) + 0.50 \cdot R_{2\text{v}2}(\text{lead})$$
  $$S_{\text{back}} = 0.70 \cdot \max(A, B) + 0.30 \cdot \min(A, B)$$
  $$M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}, \quad P_{\text{pre}} = \frac{1}{1 + e^{-0.006 \cdot (M - 500)}}$$
- **Dynamic Execution WAE**:
  $$S_{\text{actual}} = \sum \tau_k \cdot R_k, \quad P_{\text{exec}} = \frac{1}{1 + e^{-0.006 \cdot (S_{\text{actual}} - 500)}}$$
  $$\Delta Q = \text{Result} - P_{\text{exec}} \quad (\times 1.10\text{ on clean sweeps}, -0.15\text{ per unused shield on loss})$$
- **Lead-Loss Recovery Rate**: Tracks `Lead Won Conversion` vs. `Lead Lost Recovery Rate` (grades `S >= 45%`, `A >= 35%`, `B >= 25%`, `C >= 15%`, `D < 15%`) and derives `Safe-Swap MVP`.
- **3-Way ELO Meta & Moveset Fusion (`v7.41`)**: Combines recency-weighted personal season logs (`exp(-λ·idx)`), Gaussian ELO-weighted Cloudflare D1 crowd telemetry (`GET /v1/meta/crowd-elo`), and PvPoke baselines across Anti-Meta Team Generation, Meta Tab, and HUD expected movesets, with confirmed non-standard moves persisted and highlighted via clean `🌶️ Spice` badges.
- **Multi-IV Matrix & Built Roster (`v7.38`–`v7.39`)**:
  - `IvMatrixEngine.kt` / `ivMatrixEngine.ts` compares auto-pinned `🏆 Rank #1 Stat Product` and custom `[ATK][DEF][STA]` spreads (`🎀 Lv51` Best Buddy CPM solver) against PvPoke Top 100 or Blended ELO Meta across multi-selected leagues.
  - Segmented into 4 breakdown views: `Fast BP/Bulk`, `Shield Flips` (`7 Realistic`: `0v0, 1v1, 2v2, 1v0, 0v1, 2v1, 1v2` vs `Even 3`), `Tier Outliers` (`>=35/40/50/75 BR`), and `CMP`.
  - Built specimens sync across devices via Cloudflare D1 `built_pokemon` table and auto-populate `3v3` / `Show 6` editors.

---

## 4. 4-Pillar Coach, HUD Modes, Haptics & Hardware DVR

- **4-Pillar AI Tactical Coach (`#sky-tactical-rec-row`)**:
  1. *Backline Prediction*: Species-Clause family-consolidated semi-dynamic predictor (`wHist <= 65%`, `wMeta >= 35%` + live weakness `coverageBoost`; transitions `🔮 Back:` -> `🔮 3rd:` as slots reveal).
  2. *Lead Alignment Risk*: Stay/chip vs. safe-swap advice considering predicted backline hard-counters.
  3. *Move Pacing & Visual Alerts*: `FARM DOWN: NF TO KO` (Emerald), `WARN_2_FASTS` (Solid Amber), `BLINK_1_FAST` (Blinking Crimson/Amber), `IMMEDIATE_0_FAST` (Rapid Blink).
  4. *Incoming Survival Math*: Evaluates unshielded tank survival vs. reaching own charged move (`TANK -> MOVE IN 2F` vs `SHIELD -> DIES 1F SHORT`); Shield Decision Overlay card unlocked for Lifetime Supporter (Alumni) / Pro / VIP.
- **HUD Modes & Emblem Gestures (`overlay.html`)**:
  - Single-tap `#btn-minimize-sword`: strictly toggles `Full HUD` ↔ `Compact HUD` (6 customizable chips + 3 presets).
  - 2.0s press-and-hold `#btn-minimize-sword`: toggles tournament-compliant **Log-Only Stealth Mode** (pauses visible WebView rendering while continuing headless combat logging).
  - Post-battle `📊 Battle Log` button stops the overlay and opens the Battle Log.
- **4-Tier Synchronized Haptics & Catch Gate (`v7.29`)**:
  - Evaluates in the exact tick cycle as HUD blink alerts with independent toggles/sliders for the `45s` opponent swap clock (`< 5s` default single 80ms pulse) and opponent charged-move readiness (double 80ms pulse), gated by tactical catch significance thresholds (absolute damage + resultant HP%).
- **1-Battle Hardware H.264 DVR (`BattleDvrEngine.kt`)**:
  - Decoupled `GBLBattleDvrThread` encodes `544×1184` baseline AVC onto `MediaCodec.createInputSurface()` (`1.0x` real-time timestamps, burned-in `F#` + timestamp + HP/E watermark matching `_deep_trace.jsonl`):
    - **Free / Supporter / Legend Pro**: Constant `15 FPS` (`66.67ms`), `720 kbps` CBR (`QP 27–38`), ~14 MB/battle.
    - **VIP / Coach Pass**: Locked `30 FPS Smooth` (`33.33ms`), `900 kbps` CBR (`QP 27–38`), ~20 MB avg / `<= 30 MB` max.
  - **3-Way Recording Mode**: `Auto-Start Hands-Free` (triggers on confirmed `3-2-1` intro countdown), `Manual 1-Tap` (`REC 1`), or `Off`.
  - Web (`/watch/:shareId`) and Android replay players reconstruct progressive opponent field reveals (`—` until seen) and `-E` unentered bench energy directly from `_deep_trace.jsonl`.
