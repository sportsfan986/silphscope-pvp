# SilphScope PvP — Real-Time 3x3 Matchup Matrix, Damage Calculations, Turn Pacing HUD & Battle Log Overlay for Pokémon GO PvP (v3.64)

[![Live Web Simulator](https://img.shields.io/badge/🌐%20Live%20Web%20Simulator-Try%20in%20Browser-0284c7?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sportsfan986.github.io/silphscope-pvp/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sportsfan986)
[![Latest Release](https://img.shields.io/github/v/release/sportsfan986/silphscope-pvp?style=for-the-badge&color=10b981&label=Latest%20APK)](https://github.com/sportsfan986/silphscope-pvp/releases)

---

![SilphScope PvP Full Color Real Gameplay HUD Overlay — Dialga Origin vs Mewtwo](./docs/screenshots/featured_real_gameplay.png)

**SilphScope PvP** is a standalone Android application and client-side web battle simulator for **Pokémon GO Battle League (GBL)**. Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame analysis (zero disk writes), PvPoke `gamemaster.json` + official league rankings JSON synchronization, offline Google ML Kit Text Recognition, Battle Quality & Wins Above Expected (WAE) micro-skill analytics, multi-device GitHub Cloud Delta Sync, and an interactive React web dashboard.

---

## 📸 Real Android Application Screenshots & In-Game HUD

| Main App & Presets Manager | Master League HUD (Kyogre vs Zacian) | Ultra League HUD (Mimikyu vs Ampharos) |
| :---: | :---: | :---: |
| ![Main App & Presets](./docs/screenshots/real_app_main_menu.png) | ![Master League HUD](./docs/screenshots/real_hud_master_league.png) | ![Ultra League HUD](./docs/screenshots/real_hud_ultra_league.png) |

- **Main App & Presets Manager (Left)**: Floating overlay controller, PvPoke + Rankings sync status, move count basis toggles, `50%–100%` overlay scaler, background glass transparency slider, and drag-and-drop persistent league team presets.
- **Master League In-Game HUD (Center)**: Real-time damage calculations for Kyogre vs Zacian (Crowned), shield scenarios, move energy cycles, and CMP tie alerts.
- **Ultra League In-Game HUD (Right)**: Turn pacing, safe move timing windows, catch point recommendations, and team switch damage previews.

---

## 🎮 Try the Live Web Simulator (No Install Needed)

Experience **SilphScope PvP** instantly in your web browser — completely free, client-side, and consuming **0 personal API tokens**:

👉 **[Launch Live Web Simulator — https://sportsfan986.github.io/silphscope-pvp/](https://sportsfan986.github.io/silphscope-pvp/)**

- **Explore 3v3 Matchup Matrices**: Compare damage percentages, 0S / 1S / 2S shield scenarios, and CMP tie outcomes for any team.
- **Custom Team Builder with Live Autocomplete**: Pre-populated with the **PvPoke Top 3 rated Pokémon** for Great League, Ultra League, Master League, and Mega Master League. Typing a base Pokémon name automatically surfaces all Base, Shadow, Regional (Alolan/Galarian/Hisuian/Paldean), and Alternate/Mega forms in a live pop-down menu.
- **Official PvPoke Rankings Move Engine**: Synchronizes `gamemaster.json` alongside official PvPoke league rankings JSONs (`1500`, `2500`, `10000`, and `mega/10000`) to automatically assign meta-recommended Fast and Charged moves by usage.
- **Battle Quality & Wins Above Expected (WAE) Analytics**: Evaluates your micro-execution skill independent of team-composition counter-luck with Expected Win Probability ($P_{\text{win}}$), Residual Quality Delta ($\Delta Q$), 6 performance badges, and filter-reactive WAE summary metrics.

---

## Advanced Analytics & Quality Metrics (v3.00)

Raw win rate in GO Battle League is heavily influenced by matchmaking alignment and blind 3v3 team-composition luck (RPS). **SilphScope PvP v3.00** separates **Matchup Luck (Blind Matchup Favorability — BMF)** from **Dynamic Execution WAE (Wins Above Expected)** so you can track both matchmaking favorability and your in-battle micro-execution skill (energy farming, fast move denial, sacrificial catches, shield discipline, and CMP timing).

### 1. Asymmetric Shield Matrix Evaluation ($0\text{v}0$ through $2\text{v}2$)

For any active head-to-head pairing $(\text{userActive}, \text{oppActive})$, `evaluatePvPokeMatchupRating(myMon, oppMon, sUser, sOpp, league)` computes a PvPoke-calibrated $0\text{–}1000$ battle rating ($500 = \text{Neutral}$, $>500 = \text{Favorable}$, $<500 = \text{Negative}$) across all **9 discrete shield permutations** $(s_{\text{user}}, s_{\text{opp}}) \in \{0, 1, 2\}^2$:

$$\mathcal{S} = \{0\text{v}0,\; 0\text{v}1,\; 0\text{v}2,\; 1\text{v}0,\; 1\text{v}1,\; 1\text{v}2,\; 2\text{v}0,\; 2\text{v}1,\; 2\text{v}2\}$$

Each state models unblocked charged-move pressure against the defender's remaining shields ($s_{\text{def}} \in \{0, 1, 2\}$), fast-move effectiveness weighted by average shield depth, Shadow bulk adjustments, and a direct asymmetric shield-advantage delta when $s_{\text{user}} \neq s_{\text{opp}}$.

### 2. Blind Matchup Favorability ($M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}$)

**Blind Matchup Favorability (BMF / $P_{\text{pre}}$)** measures pre-match 3v3 lineup favorability before any swaps, catches, or baits occur:

- **Lead Score ($S_{\text{lead}}$ — $50/50$ $1\text{v}1$ & $2\text{v}2$ Split)**:
  Blends the symmetric $1\text{v}1$ and $2\text{v}2$ shield scenarios equally to prevent bait-tree distortions and reflect standard lead gameplay:
  $$S_{\text{lead}} = 0.50 \cdot \text{Rating}_{1\text{v}1}(\text{myLead}, \text{oppLead}) + 0.50 \cdot \text{Rating}_{2\text{v}2}(\text{myLead}, \text{oppLead})$$
- **Backline Score ($S_{\text{back}}$ — $70/30$ Optimal Alignment Weighting)**:
  Evaluates the two possible $1\text{v}1$ backline pairings ($\text{Score}_A$ and $\text{Score}_B$) and weights the stronger alignment at $70\%$ and the weaker alignment at $30\%$:
  $$S_{\text{back}} = 0.70 \cdot \max(\text{Score}_A, \text{Score}_B) + 0.30 \cdot \min(\text{Score}_A, \text{Score}_B)$$
- **Composite Score ($M$) & Logistic Pre-Match Win Probability ($P_{\text{pre}}$ / Matchup Luck)**:
  $$M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}, \qquad P_{\text{pre}} = \frac{1}{1 + e^{-0.006 \cdot (M - 500)}}$$
- **Aggregate Matchup Luck**:
  $$\text{Matchup Luck} = \frac{\sum_{i \in \text{Filtered}} w_i \cdot P_{\text{pre}, i}}{\sum_{i \in \text{Filtered}} w_i} \times 100\%$$

### 3. Dynamic Execution WAE with Timeline Duration Weighting ($\sum \tau_k \cdot R_k$)

When a match has recorded timeline events (`SWAP`, `SHIELD`, `FAINT`), `calculateDynamicExecutionWAE` partitions the battle into active head-to-head intervals $k$ bounded by swap and faint timestamps:

- **Duration-Weighted Execution Rating ($S_{\text{actual}}$)**:
  For each interval $k$ with duration $\Delta t_k$ and fractional weight $\tau_k = \frac{\Delta t_k}{t_{\text{total}}}$, the engine resolves the asymmetric shield rating $R_k = \text{Rating}_{s_{\text{user},k}\text{v}s_{\text{opp},k}}(\text{userActive}_k, \text{oppActive}_k)$ using the live shield counts at that moment:
  $$S_{\text{actual}} = \sum_{k} \tau_k \cdot R_k, \qquad P_{\text{exec}} = \frac{1}{1 + e^{-0.006 \cdot (S_{\text{actual}} - 500)}}$$
  *(If timeline events are absent, such as manual or legacy entries, $P_{\text{exec}}$ gracefully falls back to $P_{\text{pre}}$.)*
- **Base Execution Residual ($\Delta Q_{\text{base}}$)**:
  $$\Delta Q_{\text{base}} = \text{Result} - P_{\text{exec}}, \qquad \text{Result} \in \{0.0, 1.0\}$$
- **Faint Margin Scaling ($\times 1.10$)**:
  If $\text{Result} = 1.0$ and $(\text{oppFaints} - \text{userFaints}) \ge 2$, positive execution credit is scaled by $1.10\times$:
  $$\Delta Q_{\text{scaled}} = 1.10 \cdot \Delta Q_{\text{base}}$$
- **Shield-in-Pocket Penalty ($-0.15$ per unused shield)**:
  If $\text{Result} = 0.0$ and $\text{userShieldsRemaining} > 0$, unspent defensive resources are penalized:
  $$\Delta Q_{\text{final}} = \Delta Q_{\text{scaled}} - 0.15 \cdot \text{userShieldsRemaining}$$
- **Aggregate Execution WAE**:
  $$\text{EXEC WAE} = \frac{\sum_{i \in \text{Filtered}} w_i \cdot \Delta Q_{\text{final}, i}}{\sum_{i \in \text{Filtered}} w_i} \times 100\%$$

### 4. Handling of Unrevealed Pokémon (Early Forfeits & Sweeps)

| Opponent Lineup Seen | Confidence Weight ($w$) | Evaluation Behavior |
| :--- | :---: | :--- |
| **Missing 2nd Slot (`firstSwap` null/missing)** | $w = 0.00$ | **Dropped / Unranked (`quality: null`)**: Early forfeits or incomplete scans where the opponent's switch was never revealed are excluded from ranked `EXEC WAE` and `MATCHUP LUCK`. |
| **Unrevealed 3rd Slot (`finalSeen` null/missing)** | $w = 0.75$ | **75% Confidence Meta-Prior (`⚡ 75% Conf`)**: Substitutes the unweighted average $1\text{v}1$ ratings of `mySwap` ($\bar{R}_{\text{swap}}$) and `myClose` ($\bar{R}_{\text{close}}$) against the active league's top meta pool: $\text{Score}_A = \frac{R_{1\text{v}1}(\text{mySwap}, \text{oppSwap}) + \bar{R}_{\text{close}}}{2}$, $\text{Score}_B = \frac{R_{1\text{v}1}(\text{myClose}, \text{oppSwap}) + \bar{R}_{\text{swap}}}{2}$. |
| **All 3 Opponents Revealed** | $w = 1.00$ | **Full 3v3 Evaluation**: Exact pairwise $1\text{v}1$ backline matrix evaluation at $100\%$ confidence weight. |

### 5. Badge Glossary (6 Primary Performance Badges & 5 Contextual Event Pills)

Primary performance badges are derived from Pre-Match BMF ($P_{\text{pre}}$) and the match outcome, accompanied by contextual timeline/end-state pills:

| Outcome | Pre-Match BMF ($P_{\text{pre}}$) | Primary Badge | Color Hex | Tactical Meaning |
| :---: | :---: | :--- | :---: | :--- |
| **WIN** | $P_{\text{pre}} < 0.40$ | **`Clutch Win`** | Cyan `#22d3ee` | Flipped a heavily unfavorable team alignment via superior micro-execution (catches, energy lead, or shield baiting). |
| **WIN** | $0.40 \le P_{\text{pre}} \le 0.60$ | **`Skill Win`** | Bright Green `#4ade80` | Out-executed the opponent in an even/neutral 3v3 matchup. |
| **WIN** | $P_{\text{pre}} > 0.60$ | **`Expected Win`** | Muted Slate `#94a3b8` | Cleanly converted a favorable team-composition advantage into a win. |
| **LOSS** | $P_{\text{pre}} > 0.60$ | **`Blunder Loss`** | Rose Red `#f43f5e` | Dropped a favorable matchup where your 3v3 lineup had $>60\%$ pre-match win equity. |
| **LOSS** | $0.40 \le P_{\text{pre}} \le 0.60$ | **`Tough Loss`** | Orange `#fb923c` | Narrow loss in a competitive 50/50 matchup. |
| **LOSS** | $P_{\text{pre}} < 0.40$ | **`Expected Loss`** | Muted Slate `#94a3b8` | Hard-countered team composition ($<40\%$ win equity); minimal negative impact on WAE. |

**Contextual Event Pills**:
- **`⚠️ Double Shield Pocket`**: Loss with 2 unused shields remaining ($-0.30$ $\Delta Q$ penalty).
- **`⚠️ Shield in Pocket`**: Loss with 1 unused shield remaining ($-0.15$ $\Delta Q$ penalty).
- **`🧹 Clean Sweep`**: Win achieved with 0 user faints (all 3 Pokémon surviving).
- **`🛡️ Shield Advantage`**: Win ending with more shields remaining than the opponent.
- **`⚡ 75% Conf`**: Opponent's 3rd Pokémon was unrevealed; evaluated at $w = 0.75$ confidence weight using the league meta-average prior.

---

## 🖼️ HUD & Feature Overview

![Floating HUD Overlay Diagram](./docs/images/hud_overlay_preview.svg)

---

## ☕ Support Continued Development

If **SilphScope PvP** helps you count fast moves, win CMP ties, and climb Elo in GO Battle League, consider supporting continued updates and new feature releases:

👉 **[Buy Me a Coffee — https://buymeacoffee.com/sportsfan986](https://buymeacoffee.com/sportsfan986)**

---

## 📥 Download & Install Native Android APK (v3.63)

> **⚠️ Note on Live HP & Energy Counting (Disabled by Default — Opt-In via Settings)**:
> By default, **❤️ Live HP Bar Tracking** and **⚡ Live Energy & Fast-Move Counting** are **DISABLED (OFF)** for all new installs and any user upgrading from a version prior to `v3.40`. To enable live HP% and/or live fast-move energy counting on the floating overlay, open **⚙️ Settings** in the app and toggle **Live HP Bar Tracking** and/or **Live Energy & Fast-Move Counting** to **ON**.

1. Visit the **[Official GitHub Releases Page](https://github.com/sportsfan986/silphscope-pvp/releases)**.
2. Download **`silphscope-pvp-v3.63.apk`** directly to your Android device.
3. Tap the downloaded APK file to install (grant *"Install unknown apps"* permission if prompted).
4. Launch **SilphScope PvP**:
   - Select, reorder, or customize your **GBL Team Presets**, set **Opponent Move Count Basis** (`My Fasts` vs. `Their Fasts`), adjust **Overlay Size** (`50%–100%` screen width slider) and **Background Transparency**, and optionally opt in to **Live HP Bar Tracking** and **Live Energy & Fast-Move Counting** in **⚙️ Settings**.
   - Grant **"Display over other apps"** (Floating Window permission) and **Screen Capture** permission (used strictly in-memory for ML Kit OCR).
   - Tap **"Start Battle Overlay"** (or trigger via Tasker intent hooks) and launch Pokémon GO!
   - **Tip**: Tap the top-left overlay icon to minimize/pause OCR, or **press and hold the top-left icon for 2 seconds** when expanded to immediately stop the overlay and open the **📜 Battle Log** in the main app.

---

## ✨ Changelog — What's New in v3.63

- **v3.63 — Minimize Button Fix, Pre-Sync OCR Performance & ANR Fix, Expanded Battle Matrix Replay & Dynamic OCR Rate Badge**:
  - **Minimize Overlay Button Fix**: Resolved a synthetic click / resize race when tapping the top-left overlay emblem so the overlay cleanly minimizes into the floating bubble (and pauses OCR) without immediately restoring or shrinking/clipping the panel.
  - **First-Run / Pre-PvPoke-Sync Performance & ANR Fix**: Pre-indexed $O(1)$ static move and base-species lookup tables (`STATIC_MOVE_DATABASE_LOOKUP`, `STATIC_MOVE_ENERGY_LOOKUP`, `BASE_SPECIES_CACHE`) and moved startup ranking/gamemaster cache parsing off the main UI thread, eliminating pre-sync OCR frame slowdowns and `"SilphScope PvP isn't responding"` ANRs.
  - **Expanded Battle Matrix Replay Container**: Dynamically expands the post-game Battle Matrix Replay `WebView` height and wraps the dialog in a smooth `ScrollView` so all rows of `MY ATTACKS` are visible without cutoff.
  - **Dynamic OCR Frame Rate Badge (`--- ms` Initial & Between-Battle Average)**: Displays `--- ms` on initial launch before OCR has measured a real frame rate, and displays the average frame rate of the last scanned battle between matches until live OCR scanning resumes.

- **v3.62 — Codebase Cleanup & Regression Testing Build**:
  - **Codebase Cleanup & Self-Healing**: Cleaned up syntax and typing issues caused by corrupt chat history in AI Studio; restored React `useRef` import in `src/App.tsx`; synchronized `TeamPreset.archetype` type definition with `TeamArchetype` (`"ABB" | "ABC" | "DUO"`); restored `findPokemonByName` utility in `src/data/gblData.ts`; added species typing to `SlotCandidateEval` and moveset evaluation variants; aligned fast-move damage lookup (`oppFastInfo.percentage`) and archetype playbook tactics (`pb.proTactics`); and corrected `resolveFastMove` argument typing in the post-game replay inspector.
  - **Regression Testing**: Passed complete TypeScript check (`tsc --noEmit`) and Vite bundle compilation (`npm run build`).

- **v3.61 — Authoritative PvPoke GameMaster Fast & Charged Move Precedence, Scratch Energy Fix (`1t/4e`) & Full Move Discrepancy Audit**:
  - **Comprehensive Charged Move Audit & Synchronization**: Validated all 251 PvPoke charged moves against internal code tables; corrected 29 outdated energy values in `MOVE_ENERGY_COST` (including Bulldoze `45` → `55`, Body Slam `35` → `40`, Aura Sphere `55` → `40`, Rage Fist `35` → `40`, Dynamic Punch `50` → `45`, Dazzling Gleam `70` → `55`, Aerial Ace `40` → `45`, Shadow Sneak `45` → `50`, Energy Ball `55` → `45`, Seed Bomb `45` → `40`, Discharge `45` → `40`, Scald `55` → `50`, Sand Tomb `40` → `45`, Rock Tomb `60` → `50`, Gyro Ball `60` → `50`, Bubble Beam `40` → `50`, Brine `50` → `60`, Foul Play `45` → `40`, Hurricane `65` → `60`, Psyshock `45` → `40`), corrected `MOVE_DATABASE` (Bulldoze `80p/55e`, Dive `50p/40e`, Springtide Storm `60p/45e`), corrected static `POKEMON_DATABASE` entries (Earthquake `120p`, Dynamic Punch `90p`, Gyro Ball `50e`, Double Iron Bash `70p`, Psyshock `40e`, Surf `75p/45e`), and normalized dynamic lookup across all key variants (`nameKey`, `idKey`, `spaceKey`, `hyphenKey`, `underscoreKey`). Automated comparison confirms 0 discrepancies against live PvPoke `gamemaster.json`.
  - **Authoritative Dynamic GameMaster Lookup Precedence for Fast Moves**: Fixed fast-move resolution in `OverlayService.kt` (`updateLiveHpAndEnergyFromFrame`, `captureAndRecognize`, `buildBattlePayloadJson`) and `src/App.tsx` / `src/data/gblData.ts` where static fallback maps (`FAST_MOVE_ENERGY`, `FAST_MOVE_TURNS`, `FAST_MOVE_TURN_LOOKUP`) were evaluated before the downloaded PvPoke `gamemaster.json` tables (`DYNAMIC_FAST_ENERGY`, `DYNAMIC_FAST_TURNS`, `FAST_MOVE_STATS`). Live downloaded `gamemaster.json` values now always take top priority across all battle simulations, move-timing horizons, and live OCR energy loops.
  - **Aegislash Shield-Forme Move Collision Guard & Hyphen/Space Normalization**: Prevented `AEGISLASH_CHARGE_AIR_SLASH` and `AEGISLASH_CHARGE_PSYCHO_CUT` (`0p / 6e` at the end of PvPoke's `gamemaster.json`) from overwriting canonical `Air Slash` (`3t / 9p / 9e`) and `Psycho Cut` (`2t / 4p / 9e`), and normalized hyphen/space keys (`Lock-On` / `Lock On`, `Mud-Slap` / `Mud Slap`).
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
- **v3.60 — Predictive + Self-Correcting Bias-Error Energy Loop, Opt-In HP/Energy Settings, Streamlined Header Row & 2s Hold to Battle Log**:
  - **Opt-In HP & Energy Tracking (Disabled by Default)**: Added separate settings in **⚙️ Settings** to enable or disable **❤️ Live HP Bar Tracking** and **⚡ Live Energy & Fast-Move Counting**. Both settings default to **OFF (Disabled)** for any user who has not installed `v3.40` or higher — opt in anytime via **⚙️ Settings**.
  - **Predictive + Self-Correcting Bias-Error Fast-Move & Energy Loop**: Combines zero-lag feed-forward turn prediction (with pending-damage flash phase locking on 2T+ fast moves and automatic rollback if HP does not drop after `fastTurns * 500ms + 420ms`) with an online EMA per-move damage estimator ($\hat{d}$) and damped $\pm 1$ move residual self-correction to eliminate energy lag, overcounting, undercounting, and loop oscillation.
  - **Streamlined Overlay Header Row**: Updated the top header row to display **only** the **Minimize / Pause OCR icon**, **OCR update rate in `ms`** (e.g. `220ms`), **My Health, Energy & Shield badges**, and **Opp Shields, Health & Energy badges**.
  - **2-Second Long-Press on Minimize Icon to Stop Overlay & Open Battle Log**: Pressing and holding the top-left minimize icon for **2 seconds** when the overlay is expanded stops the overlay service and navigates directly to the **📜 Battle Log** page in the main app (a short tap minimizes to the floating bubble and pauses OCR as before).
- **v3.50–v3.55 — Expanded Floating HP Bar Detection, 2Hz Capture Phasing & 7-Day AI Log Split**:
  - Expanded floating HP bar detection corridors and overlay-occluded/text-overlapped bar scanning so smaller or laterally shifted Pokémon (such as Solgaleo and Mimikyu) are reliably tracked.
  - Added 7-day AI training log split & automatic cleanup to keep permanent Battle Logs fast and lightweight.
- **Phase 1–4 (v2.90–v3.01) — Asymmetric 9-Shield Matrix, Blind Matchup Favorability (BMF), Dynamic Execution WAE & In-App Help Guide**:
  - Evaluates all 9 discrete shield permutations ($0\text{v}0$ through $2\text{v}2$), computes Pre-Match Blind Matchup Favorability ($P_{\text{pre}}$) and duration-weighted Dynamic Execution WAE ($\Delta Q$), and provides a 5-stat analytics dashboard, 6 Primary Performance Badges, 5 Contextual Event Pills, Interactive Post-Game Replay, standardized Go Battle Log exports, Tasker automation intents, and an in-app **❓ Help & Metric Guide**.

---

## 🚀 Automated CI/CD & Version Bump Script

Every push to `main` triggers `.github/workflows/android.yml` (builds signed release APK `silphscope-pvp-vX.XX.apk`) and `.github/workflows/deploy-pages.yml` (deploys Web Simulator to GitHub Pages).

To increment the version for future releases:
```bash
./scripts/bump_version.sh        # increments sub-version by +0.01 (e.g. v3.00 -> v3.01)
./scripts/bump_version.sh v3.00  # sets an explicit version
```

---

## 💻 Building Locally from Source

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sportsfan986/silphscope-pvp.git
   cd silphscope-pvp
   ```
2. **Build Web Simulator**:
   ```bash
   npm install
   npm run build
   ```
3. **Build Android APK in Android Studio**:
   ```bash
   ./gradlew assembleRelease
   ```
   Output APK location: `app/build/outputs/apk/release/app-release.apk`
