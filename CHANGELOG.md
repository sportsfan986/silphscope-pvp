# SilphScope PvP — Release Changelog (`v7.00` – Present)

---

## v7.54 (2026-11-17) — Persistent Idle & Post-Set "📊 Battle Log" Controls, 120s Post-Battle Bar & Non-DVR Stop Guard
*Usability & overlay navigation polish release (`v7.54`, `versionCode = 1754`) restoring always-accessible 1-tap exit from the floating overlay straight into SilphScope's Battle Log.*

- **Idle Toolbar & Horizon Belt `📊 Battle Log` Button (`overlay.html`, `overlay-asset.mjs`)**: Swaps the inactive `Form: Base` slot in `.toolbar-left-group` with a dedicated `📊 Battle Log` button (`#btn-idle-battle-log`, calling `stopOverlayAndGoToBattleLog()`) whenever `!isBattleActive && !isReplay`, plus `#btn-horizon-battle-log` on the Horizon Belt layout while automatically restoring `#btn-cycle-form` during live battles and keeping `#btn-minimize-sword` single-tap/2.0s hold behavior unchanged.
- **ELO Set Banners & Compact Hidden-Toolbar Fallback (`overlay.html`, `OverlayService.kt`)**: Adds `📊 Battle Log` / `📊 Log` actions directly inside the `✅ ELO Locked` confirmation banner (extended from `4s` -> `12s`) and `5/5 Set Complete` prompt, plus a compact `📊 LOG` badge inside `#sky-idle-team-banner` when `toolbarMode === "hidden"`.
- **120s Post-Battle Auto-Logged Bar & Non-DVR `stopCurrentBattle()` Guard (`OverlayService.kt`)**: Extends the `#auto-logged-banner` display window from `45s` to `120s` so GBL set-reward encounters don't hide the post-battle controls prematurely, and updates `stopCurrentBattle()` to clear opponents only on `< 10s` or unconfirmed empty sessions (`stopBattleDurSec < 10.0 || (!leadConfirmedByGoBanner && battleTimelineEvents.isEmpty())`) instead of clearing legitimate non-DVR battles.

---

## v7.53 (2026-11-17) — Automatic Multi-Form Disambiguation & Raw HP-Pulse Turn-Cadence Engine
*Feature & accuracy milestone (`v7.53`, `versionCode = 1753`) completing automatic mid-battle multi-form disambiguation (`OBS_CP`, `BANNER_OCR` signature moves & EPT, joint stats/cadence) paired with an assumption-free raw HP-pulse turn-cadence engine for rapid Non-Standard Fast Move and Shadow confirmation.*

- **Form-Isolated Move Pools & Observed-CP / League Variant Filtering (`PokemonDatabase.kt`, `OverlayService.kt`)**: Isolates form-specific move pools (`isBaseOrKantoForm` guard + `urshifu_single_strike` / `urshifu_rapid_strike` / `_shield` / `_full_belly` keys), filters illegal Mega/Primal variants in non-Mega leagues, and eliminates sibling forms whose Level-51 `15/15/15` max CP (`+15 CP` OCR margin) cannot reach `oppSlotObservedCp`.
- **`BANNER_OCR` Charged-Move & EPT Form Disambiguation (`OverlayService.kt`)**: Pools candidate charged moves across eligible sibling forms in `BANNER_OCR` and automatically flips to the true form on signature `BANNER_OCR` moves or EPT-infeasible throws (never on noisy `HP_DELTA` guesses alone), re-validating Shadow eligibility (`isShadowEligibleVariant`) and retroactively syncing `battleTimelineEvents` & `detectedOpponents`.
- **Manual Lock vs. Auto-Verified Form HUD Provenance (`OverlayService.kt`, `overlay.html`, `overlay-asset.mjs`)**: Separates manual `#btn-cycle-form` taps (`🔒` permanent match lock) from auto-verified forms (`✓` with `OBS_CP`, `CHARGED_MOVE`, `CHARGED_EPT`, `FAST_CADENCE`, `FAST_MOVE_DHP` provenance) and emits `🔄 Form Corrected` toasts (muted in Log-Only Stealth Mode).
- **Assumption-Free Raw HP-Pulse Turn-Cadence Engine & Joint `(Form × FastMove × ShadowState)` Evaluator (`OverlayService.kt`)**: Replaces circular `expectedIntervalMs` interval gating with a `380ms`-debounced raw HP-drop pulse ring buffer (`oppRawPulseTimestampsMs` / `oppRawPulseDropsPct`), enabling cadence-led Non-Standard Fast Move & Form confirmation (`wonByCadence`), breaking `(2t+Shadow)` vs `(3t+Normal)` ties while preserving clock-turn `completedMoves` for Shadow `ΔHP` math, and enforcing asymmetric `1t` vs `2t` double-tick guards (`sub720Count` & median single-pulse drop).

---

## v7.52 (2026-11-17) — Hybrid OTA Shadow Eligibility Catalog, Corroborated Charged ΔHP & Settle-Window Latch
*Targeted Shadow accuracy & live-combat hardening release (`v7.52`, `versionCode = 1752`) resolving false Shadow detections reported on unreleased / under-leveled opponents (`log-1794925674297-366`).*

- **Hybrid Compiled + Live In-App OTA Shadow Eligibility Catalog (`PokemonDatabase.kt`, `OverlayService.kt`, `MainActivity.kt`)**: Replaces the minimal 14-species denylist in `FormResolver.isShadowEligibleVariant` with a compiled baseline (`STATIC_RELEASED_SHADOW_KEYS`, 511 keys from PvPoke `gamemaster.json`) unioned dynamically at runtime with `DYNAMIC_SHADOW_ELIGIBLE_KEYS` parsed from `_shadow` and `"shadoweligible"` entries in `gamemaster.json` + league rankings JSONs, backed by automatic 24-hour background OTA staleness refreshes (`PVPOKE_OTA_REFRESH_TTL_MS`) so future Team GO Rocket Shadow releases unlock in-app without an APK rebuild.
- **Shadow-Ineligible HUD Lock (`OverlayService.kt`, `overlay.html`, `overlay-asset.mjs`)**: Locks species with no released Shadow form (e.g., *Tinkaton*, *Giratina (Origin)*, *Palkia (Origin)*, *Dialga (Origin)*, *Moltres (Galarian)*) to Normal across auto-detection, PvPoke priors, and Compact HUD pills while disabling `#btn-toggle-shadow` (`Shadow: N/A`).
- **Post-Charge Settle-Window Latch & CP-Aware Charged ΔHP (`OverlayService.kt`)**: Latches `IN_CHG_DHP` and `OUT_CHG_DHP` retroactive settle windows (`lastOppChargeHpSettleLatched` / `lastUserChargeHpSettleLatched`) once combat HUD circles stabilize for 2 frames or subsequent fast moves land (preventing trailing fast-move drain from inflating charged `ΔHP`), bounds CMP intervention lookback to `+6500ms`, and passes `oppSlotObservedCp` IV-narrowed stats into `IN_CHG_DHP` and `OUT_CHG_DHP`.
- **Corroborated Single-Charge Flips & Clean Entry Aura Sampling (`OverlayService.kt`, `PixelScannerEngine.kt`)**: Blocks single unshielded charged moves from flipping `Normal -> Shadow` unless corroborated by `>= 1` positive 3D Aura frame or an early multi-hit Fast `ΔHP` Shadow trend (`oppSlotFastShadowTrend`), tightens single-charge demotion margins when Aura is non-negative, and lets `scanOpponent3dShadowAura` sample clean opponent switch-in frames before Ghost/purple fast-move VFX land.

---

## v7.51 (2026-11-17) — Shield Carryover & Mimikyu Disguise Hardening, Non-GBL Screen Exclusion, Shadow Aura Lock & Minigame Timeout Fix
*Targeted live-battle hardening & telemetry accuracy release (`v7.51`, `versionCode = 1751`) resolving all open user-flagged DVR reports (`-668`, `-787`, `-289`) and auto-flagged edge cases (`-261`).*

- **Stale Outgoing `"BLOCKED!"` Carryover Suppression & Charge-Entry Reset (`OverlayService.kt`)**: Added continuous `"BLOCKED!"` / Disguise OCR burst tracking (`currentBlockedBurstStartMs`) plus an incoming `"Attack incoming!"` countdown guard (`< 1600ms` prior to banner confirmation) and removed the `-1000ms` pre-charge lookback window (`blockedByBanner` / `oppBlockedByBanner`), resetting `"BLOCKED!"` / Disguise timestamps cleanly on each fresh charge entry so fading outgoing shields never deduct your Protect Shield on an immediate incoming attack.
- **0–3% Protect Shield & Post-Finalization `"BLOCKED!"` Deadlock Fix (`OverlayService.kt`)**: Captured provisional-shield flags (`wasProvisionalUserShieldBeforeClear` / `wasProvisionalOppShieldBeforeClear`) before clearing on late `"BLOCKED!"` banners and aligned user chip-shield decrements (`0..userShieldChipCap`) with opponent shield logic, eliminating the 26.6s shield decrement delay when `"BLOCKED!"` arrives 100ms after charge exit.
- **Mimikyu Disguise `-1 DEF` Deduplication & Shield-Used Self-Heal (`OverlayService.kt`)**: Always refreshes Disguise callout deduplication epochs (`lastOcrStatCalloutWallMs[1/3]`) on confirmed Disguise busts, suppresses trailing `"DEFENSE FELL!"` banners within `6.5s` of `"Mimikyu's disguise is busted!"` (`-2 DEF` fix), holds unbusted `0–3%` Mimikyu charge exits with intact shields (`ambiguousUserMimikyuHold` / `ambiguousOppMimikyuHold`) even when `"BLOCKED!"` arrives 1–2 frames late, and heals provisional opp Disguise busts when top-HUD shield pixels drop cleanly.
- **Pokédex / Storage / Catch Card Exclusion & Clean Aborted-Stop / `3-2-1` Reset (`OverlayService.kt`)**: Blocks non-combat Pokémon UI screens (`POKÉDEX`, `POWER UP`, `NEW ATTACK`, `APPRAISE`, `TRANSFER`, `XL CANDY`, `PURIFY`, `STARDUST`, `EVOLVE`) prior to HP-bar checks, requires corroborating countdown/ball/CP cues on dimmed circles, clears stray detections when stopping `< 10s` or unconfirmed empty sessions, and forces a clean `startNewBattle()` reset when `3-2-1` starts over an unconfirmed false trigger.
- **Shadow Aura Lock, Victory-Fade Duplicate Guard & Extended Minigame Window (`OverlayService.kt`, `nightly-telemetry-audit.mjs`)**: Prevents single-charge `IN_CHG_DHP`/`OUT_CHG_DHP` fluctuations from flipping zero-aura non-Shadow opponents to `Shadow` (and lets `AURA_CLEAR` recover non-aura single-charge flips), blocks black-victory-screen duplicate user KO triggers (`awaitingCombatReturnAfterLastUserCharge` + `finalizePendingChargedAttackOnMatchEnd`), extends `isWithinUserMinigameWindow` during active swipe banners (`~6.2–7.0s`), and adds `v7.51` retroactive resolution rules to `nightly-telemetry-audit.mjs`.

---

## v7.50 (2026-11-16) — 3D HSV Shadow Aura Detection, Bidirectional ΔHP & Joint Fast-Move Verification, Observed-CP Best-Guess IVs & Live Breakpoints/Bulkpoints
*Major Android APK, Web Simulator & Cloudflare Edge milestone (`v7.50`, `versionCode = 1750`) completing Roadmap Features #1 (`shadow-detect`) and #2 (`fast-move-damage`) with zero-allocation 3D battlefield Shadow aura detection, bidirectional fast/charged ΔHP & turn-cadence verification, observed-CP opponent IV narrowing, and live Breakpoint/Bulkpoint surfacing.*

### Highlights
- **3D Battlefield HSV Shadow Aura Detection & 3-Confounder Filtering (`PixelScannerEngine.kt`, `OverlayService.kt`)**: Samples a zero-allocation `24×16` opponent sprite ROI (`0.520w..0.855w`, `oppHpRowY`-anchored) with per-pixel temporal RGB motion (`movingAuraDensity`) on the Vision thread, enforcing stricter thresholds on purple-palette species, blocking foreground player Shadow / *Moltres (Galarian)* bleed (metadata + `12×8` lower-left motion probe), and gating out active Ghost/purple attack VFX (*Shadow Claw*, *Hex*, etc.) and post-faint switch cards.
- **Manual Lock vs. Auto-Verified Shadow Provenance & Retroactive Sync**: Separates true user HUD Shadow taps (`🔒` permanent match lock) from PvPoke priors and auto-verified states (`✓` via `AURA`, `OUT_FAST_DHP`, `IN_FAST_DHP`, `IN_CHG_DHP`, `OUT_CHG_DHP`), retroactively syncing active battle timeline events and suppressing routine `< 2.8s` entry toasts while emitting concise reason-tagged toasts on mid-battle flips (always muted in Log-Only Stealth Mode).
- **Stat-Stage-Aware Joint `(FastMove × ShadowState)` & Turn-Cadence (`dtMs`) Evaluator**: Fixes missing Attack/Defense stat stages in Section `1E`, combines incoming/outgoing fast & unshielded charged `ΔHP` (`14–95%`) with observed `1t–5t` HP-step intervals, and requires non-standard fast move overrides to beat the standard fast move across unresolved Shadow hypotheses.
- **Observed-CP Best-Guess Opponent IVs & Option A Live Breakpoints/Bulkpoints (`IvMatrixEngine.kt`, `overlay.html`)**: Narrows opponent 4,096 IV spreads by captured nameplate CP and live `ΔHP` to drive live charged-move `ivDeltaPct` (`↑`/`↓`), CMP ties, KO turn counts, and Shield Decision Overlay survival math, while flagging integer `±1 HP/hit` fast-move Breakpoints/Bulkpoints (`⚡BP+1`, `🛡️BLK-1`, `⚠️BP+1`) strictly from opponent IV variance across Full and Compact HUD modes with zero added vertical height.
- **Settings, D1 Sync & DVR Replay Parity (`MainActivity.kt`, `BattleDvrEngine.kt`, `worker.mjs`)**: Added a D1-synced `🟣 Auto Shadow & IV Breakpoint Detection` toggle in ⚙️ Settings (sharing Strict / Balanced / Aggressive sensitivity) and extended `BattleDeepTraceFrame`, `OpponentObservedMoves`, In-App DVR Replay, and `/watch/:shareId` Web Replay Theater.

---

## v7.45 (2026-11-16) — Passive Scroll-Down ELO Auto-OCR Fix, Live GBL Set Counter Sync & Split HUD Touch Keypad
*Live Android APK, Web Simulator & Cloudflare Edge release (`v7.45`, `versionCode = 1745`) fixing passive scroll-down ELO auto-capture blockers, syncing set battle progress directly from Pokémon GO's on-screen `X/5 battles played` readout, and splitting HUD ELO scan and zero-IME manual keypad controls.*

### Highlights
- **Fixed Passive Scroll-Down ELO Auto-OCR Lockouts**: Stopped `isWakeTransitionActive` bright-screen detection from blocking `maybeTriggerIdleGblEloOcr()` whenever the white GBL lobby card is scrolled up, added a scroll-sensitive `6×12` card luma hash + faster `950ms` passive cadence, parsed token-level `line.elements` with strict `"CURRENT SEASON"` header anchoring so adjacent battery overlays (e.g. `-1247 mA`) never poison `2,307`, and surfaced a once-per-lobby verification indicator even when rating is unchanged (`±0`).
- **Live GBL Set Progress Sync (`0/5–5/5 battles played`)**: Extracts Pokémon GO's `([0-5])/5 battles played` label directly during idle lobby OCR to keep the HUD pill accurately synced (e.g. `3/5` instead of local-only drift), preserving real set counts across ELO confirmations and triggering ELO prompts cleanly at `5/5` or set wrap (`3–5/5 -> 0/5`).
- **Split Idle HUD Pill (`[🎯 ELO (X/5)][✏️]`) & Zero-IME Touch Keypad**: Separated `[✏️]` right beside the Scan pill so tapping `✏️` opens an in-overlay `0–9` touch numeric keypad with `-30/-15/-5/+5/+15/+30` quick steppers and `< R20` without fighting Android OS keyboard focus over Pokémon GO.

---

## v7.44 (2026-11-16) — Guided Idle HUD ELO Scanner, 5-Battle Set Reprompt & Passive GBL Lobby/Modal OCR Fix
*Live Android APK, Web Simulator & Cloudflare Edge release (`v7.44`, `versionCode = 1744`) fixing 4 blockers in idle ELO auto-capture and introducing an in-HUD guided scroll-to-scan workflow prompted once every 5 GBL battles.*

### Highlights
- **Fixed Passive End-of-Set & Scrolled Lobby ELO Auto-OCR**: Allowed idle ELO scanning while the HUD displays `WAITING FOR OPPONENT...` (`isWaitingForOpponent && !hasBattleStarted`), widened `evaluateIdleGblCardPixelGate` for Pokémon GO's mint/teal GBL lobby gradient, prevented the `4.5s` visual-signature cooldown from blocking the 2nd confirmation read on steady scrolled frames, and added adjacent-line `Rating` + same-row stat-exclusion guards.
- **Guided `📷 Scan ELO` Scroll-to-Scan Mode (`250ms` Live OCR)**: Tapping **`🎯`** or **`📷 Scan ELO`** temporarily collapses idle attack tables to leave the screen clear, runs an unthrottled `250ms` ML Kit OCR loop for `15s` until the scrolled `"CURRENT SEASON"` card or modal locks on 2 frames (`~0.5s`), fires a haptic pulse, displays your set delta (`+Delta` / `±0`), and syncs `S:gbl_current_user_elo` to Cloudflare D1.
- **5-Battle GBL Set Cadence & Native `⌨️ Type` Overlay Modal**: Displays a compact `🎯 <ELO> (N/5)` chip during sets 1–4, shows `[📷 Scan ELO] [✓ Same] [⌨️ Type] [✕ Snooze]` after every 5th logged GBL battle (auto-cleared when passive End-of-Set OCR catches it first or when `3-2-1` starts), applies updated ratings forward to upcoming sets (preserving 120s null backfill on first Rank-20 reveal), and supports `< R20` unranked prompt snoozing.

---

## v7.43 (2026-11-16) — BF Label Streamlining, 2-Row Multi-Cup Anti-Meta & IV Lab Cup Rankings + Overall W-L-T
*Live Android APK, Web Simulator & Cloudflare DVR release (`v7.43`, `versionCode = 1743`) adding 2-row multi-cup Anti-Meta and IV Lab league filters with strict Row 2 pruning, Shadow-aware IV Lab Cup `#Rank` + Overall `W-L-T` metrics, `BF` label streamlining across every surface, and streamlined workspace documentation & release-verification guardrails.*

### Highlights
- **2-Row Multi-Cup Anti-Meta & IV Lab Filters (`GL | UL | ML | ALL` → `Open + Limited Metas`)**: Upgraded both Android (`MainActivity.kt`) and Web (`src/App.tsx`, `IvLabTab.tsx`) with Row 1 CP tier tabs (`GL`, `UL`, `ML`, `ALL`) and an always-visible Row 2 multi-select cup bar (`Open GL` / `Open UL` / `Open ML` + active limited metas) featuring strict Row 2 visibility pruning when switching tiers and multi-cup results filtering.
- **IV Lab Cup `#Rank` & Overall `W-L-T` Records Across All Selected Cups**: Added Shadow-aware PvPoke/cup ranking (`#Rank` + score, or `Unranked`) before simulation, per-candidate `🏅 Cup #Rank` and `Overall (7-Shield / Even 3)` `W-L-T` + `±ΔW vs R1` summary bars on every result card, and a Combined Multi-Cup Summary card aggregating overall records across 2+ cups in `IvMatrixEngine.kt`, `ivMatrixEngine.ts`, `MainActivity.kt`, and `IvLabTab.tsx`.
- **Unified `BF` Abbreviation Across App, HUD, Web & DVR**: Abbreviated `"Battle Frontier"` display labels to `"BF"` (`BF (Spectral)`, `BF (Cauldron)`, `BF (Master)`) across Android UI/spinners, floating HUD (`overlay.html` / `overlay-asset.mjs`), Web Simulator & Marketing cards, and Cloudflare DVR pages while preserving canonical stored league keys for D1 Vault sync and Google Sheets/PvPoke parsing.
- **Streamlined Workspace Rules & Automated Pre-Commit Release Gate**: Consolidated workspace docs into a slim `AGENTS.md`, extracted modular pricing/telemetry skills and `docs/ARCHITECTURE.md`, archived `v1.00–v6.51` history to `docs/CHANGELOG_ARCHIVE_v1_v6.md`, and added `npm run release:check` (`verify-release-ready.mjs`) + `.git/hooks/pre-commit`.

---

## v7.42 (2026-11-16) — Mimikyu Disguise vs. Shield Latch, Post-Charge Lethal KO & Morpeko Sync, Early `3-2-1` Countdown Wake-Up & Clean League Labels
*Live Android APK, Web Simulator & Cloudflare DVR release (`v7.42`, `versionCode = 1742`) resolving all combat telemetry issues identified in the `2026-11-16` Daily Telemetry Audit alongside unified CP-free league and cup labeling.*

### Highlights
- **Mimikyu Disguise vs. `"BLOCKED!"` Two-Way Ambiguous-Block Latch & Shield Refund**: Holds ambiguous `"BLOCKED!"` announcements on unbusted Mimikyu without prematurely burning a shield or breaking Disguise; resolves deterministically via pixel shield telemetry and `"Mimikyu's disguise is busted!"` / `StatStageChange` callouts, with an unconditional `+1` shield / `confirmed*BlockedShieldCount` refund safety net if Disguise bust is confirmed after a real-shield guess.
- **Post-Charge Lethal KO, Immediate Send-Out `0%` HP Sync & Morpeko Form-Shift Hold**: Commits 2-frame debounced opponent HP drains immediately after user charge moves even during exit fades, prevents already-fainted defenders from being misattributed as switch-catches to incoming replacements, gates `oppClockLocked` / post-user-charge faint replacements accurately, and holds HP sampling briefly during Morpeko Hangry/Full Belly form transitions.
- **Earlier `3-2-1` Countdown Wake-Up & Burst OCR**: Wakes battle countdown detection on `"go,"`/`"go "` tokens and full `3v3` opening Pokéball or explicit-CP nameplate availability during `"3"`/`"2"` before floating HP bars appear at `"1"`, backed by `150ms` idle burst OCR.
- **Clean League & Cup Labels Across Android, Web & DVR (`fc628ee`)**: Removed redundant CP limit suffixes from league and cup display labels consistently across `MainActivity.kt`, `OverlayService.kt`, `PokemonDatabase.kt`, `overlay.html`, `App.tsx`, `MarketingWebsite.tsx`, `pokemonDb.ts`, and `cloudflare/telemetry-worker/worker.mjs`.
- **Nightly Telemetry Audit Classifier Precision (`nightly-telemetry-audit.mjs`)**: Added `v7.40` and `v7.42` retroactive fix verification rules (`-175`, `-693`, `-783`, `-641`, `-151`, `-490`, `-803`, `-701`, `-155`) and scoped legacy `v7.37`–`v7.39` backline reveal-race telemetry alerts to `v7.40+`.

---

## v7.41 (2026-11-15) — 3-Way ELO-Weighted Crowd Meta Fusion, Non-Standard Moveset Spice Detection & In-App APK Update Notifier
*Live Android APK, Web Simulator & Cloudflare Edge release (`v7.41`, `versionCode = 1741`) introducing 3-way ELO-weighted crowd meta and moveset blending, idle-only GBL ELO Auto-OCR, non-standard Spice moveset badges, and in-app APK update notifications.*

### Highlights
- **Idle-Only GBL ELO Auto-OCR & Cross-Device Sync**: Automatically captures your GBL rating strictly outside active combat (`>= 1500ms` throttle, zero battle CPU overhead) from both End-of-Set `"Rating: X,XXX"` modals and scrolled `"CURRENT SEASON"` lobby cards (with 120s Rank-20 reveal backfill), plus manual ELO override (`300–3800` or `Unranked < R20`) synced via Cloudflare D1 `userSettings`.
- **3-Way Meta & Moveset Fusion (`GET /v1/meta/crowd-elo`)**: Blends recency-weighted personal season logs (`exp(-λ·idx)`), Gaussian ELO-weighted Cloudflare D1 crowd telemetry across all trainers (including your own uploaded logs, with smooth all-ELO fallback when unranked or low sample size), and PvPoke baseline priors into the Anti-Meta Team Generator, Meta Tab, Live HUD expected movesets, and Shield Decision Overlay.
- **Observed Opponent Movesets & Clean `🌶️ Spice` Badges**: Persists confirmed opponent fast and charged moves on `BattleLogEntry` / D1 `battle_logs` and highlights **only** confirmed non-standard moves (`🌶️ Spice: <Species> (<Move>)`) on Battle Log cards with zero clutter for standard or unrevealed moves.
- **In-App APK Update Notifier (`GET /v1/version/latest`)**: Displays a dismissible update banner in `MainActivity` with release changelog highlights, a manual `🔄 Check for App Update` button in ⚙️ Settings, and 1-tap browser download via `https://dl.silphscopepvp.com` with zero new Android manifest permissions.

---

## v7.40 (2026-11-14) — 45s Switch Clock, 15Hz High-Perf Burst Vision, Instant Shield OCR, Cutscene Swap-Catch & Back-to-Back Charge HP Sync
*Live Android APK & Web Simulator release (`v7.40`, `versionCode = 1740`) upgrading live battle engine responsiveness and fixing all 5 root-cause areas diagnosed in the `2026-11-14` Daily Telemetry Audit.*

### Highlights
- **45s GBL Switch Cooldown Everywhere (`GBL_SWITCH_COOLDOWN_MS = 45_000L`)**: Updated all Android swap timers, Web Simulator countdowns, guide tooltips, and haptic clock copy from 50s to GO Battle League's current 45s switch cooldown, plus unlocked **Cutscene Swap-Catches** via confirmed `"Go, <Species>!"` / `"sent out"` banners or 2-frame debounced nameplate matches and preserved outgoing HP on swap-catch throws.
- **High-Perf 15Hz Vision + 150ms Burst OCR (`⚡ Vision & OCR Performance Profile`)**: Upgraded default vision cadence to `66ms` (`15 Hz`) pixel sampling with automatic `150ms` OCR bursts across charge cutscenes, `3-2-1` countdowns, waiting-for-lead, swaps, `>=12%` HP jumps, Pokéball transitions, and unlatched switches (`500ms` steady state), with an optional cloud-synced **Battery Saver** toggle in ⚙️ Settings (`100ms` / `10 Hz` + `250ms`/`300ms`/`750ms` OCR).
- **3-2-1 Countdown Early Lead Lock & Turn-0 Swap Preservation**: Locks the opening lead during `3-2-1` as soon as nameplate text + explicit `CP` appear, and tightens opening-lead self-correction (`<= 1.2s`, no Go-banner confirmation, matching CP, `<2` confirm frames) so Turn-0 switches are never erased.
- **Instant Mid-Cutscene `"BLOCKED!"` Shield Decrement & Switch-Fade Guard**: Decrements shield counts immediately on the exact OCR frame `"BLOCKED!"` renders (idempotent across post-charge finalization, skipping unbusted Mimikyu Disguise) and suppresses spurious pixel shield drops while HP bars fade during switch animations.
- **Back-to-Back Charge HP Commit, Match-Ending KO Sync & Atomic Backline Prediction**: Commits 2-frame Row-Y-validated player HP drains during rapid opponent->player charge chains, finalizes pending closer KOs at auto-end (`0% HP`), and synchronously updates backline predictions (`lastRecommendedGoal`) as each opponent species is revealed (including in Log-Only Stealth Mode).

---

## v7.39 (2026-11-14) — 7-Scenario Asymmetric Shield Flips, Fast Move Breakpoint/Bulkpoint Lists & Matchup Tier Outliers
*Live Android APK & Web Simulator release (`v7.39`, `versionCode = 1739`) refining the **⚖️ IV Lab Multi-IV Matrix** breakdown to surface actionable fast-move damage breakpoints/bulkpoints, asymmetric shield-tree outcome flips, and sub-tier matchup swings while eliminating noisy non-flipping BR drift rows.*

### Highlights
- **4-Category Segmented Breakdown (`Fast BP/Bulk` • `Shield Flips` • `Tier Outliers` • `CMP`)**: Replaced the noisy `"Key Shifts"` list and generic non-flipping BR drift rows across Android (`MainActivity.kt`) and Web (`IvLabTab.tsx`) with dedicated category pills showing only meaningful matchups.
- **Fast Move Breakpoints & Bulkpoints Split by Pokémon**: Displays explicit fast-move damage changes (`+1 Dmg Dealt` / `-1 Dmg Taken ✅` green vs `+1 Dmg Taken ⚠️` red) organized separately for Breakpoints and Bulkpoints (also fixed Android's inverted damage-taken sign and coloring).
- **7-Scenario Asymmetric Shielding Tree (`0v0`, `1v1`, `2v2`, `1v0`, `0v1`, `2v1`, `1v2`)**: Evaluates realistic shielding trees beyond even shields with a 2-way scope toggle (`7 Realistic` vs `Even 3`), expandable per-opponent shield-tree deltas (`before → after BR`), and symmetric crossing classification at `BR 500`.
- **Matchup Tier Outliers (`≥35 / ≥40 / ≥50 / ≥75 BR`, default `≥40`)**: Surfaces non-flipping binary outcomes that cross meaningful sub-tier boundaries (`Strong W / Solid W / Soft W` and `Close L / Solid L / Strong L`) synchronized with the user's configured tier thresholds.

---

## v7.38 (2026-11-14) — Multi-IV Matrix Evaluator, Universal 3-Box IV Controls & Built Pokémon Roster Sync
*Live Android APK & Web Simulator release (`v7.38`, `versionCode = 1738`) introducing the top-level **⚖️ IV Lab** tab (**Multi-IV Matrix Evaluator** + **📦 My Built Pokémon Roster**), universal 3-box `[ATK] [DEF] [STA]` IV controls with real-time auto-CP recalculation, and Cloudflare D1 multi-device Built Roster delta sync.*

- **⚖️ Multi-IV Matrix Evaluator (`IvMatrixEngine.kt`, `ivMatrixEngine.ts`, `IvLabTab.tsx`, `MainActivity.kt`)**:
  - Added a dedicated top-level **⚖️ IV Lab** / **⚖️ IVs** navigation tab right next to **📊 Meta** across both the Web Simulator and Android Native App.
  - Compares **🏆 Rank #1 Stat Product** (auto-pinned) and user-added IV spreads head-to-head across multi-selected leagues (`Great League`, `Ultra League`, `Master League`, and Supporter+ active Specialty/Limited Cups) and shield scenarios (`0v0`, `1v1`, `2v2`).
  - Evaluates against **PvPoke Top 100** or **🎯 Blended ELO Meta** (Legend Pro/VIP) using selectable **PvPoke Default**, **Rank #1 Stat Product**, or **Max Atk** opponent IV baselines, with 1-tap `Compare vs.` baseline switching (Rank #1 or any candidate).
  - Surfaces exact **Net Matchup Flips** (`L→W`, `W→L`), **+1 Fast Move Breakpoints**, **-1 Fast Move Bulkpoints**, **CMP Tie Flips**, and **Extra Charged Cycle Survivals**.
- **🔢 Universal 3-Box `[ATK] [DEF] [STA]` IV Input & Real-Time Auto-CP (`IvTripletInput.tsx`, `MainActivity.kt`, `PokemonDatabase.kt`, `pokemonDb.ts`)**:
  - Replaced legacy `"1/15/15"` string inputs across IV Lab, 3v3 Team Editor, Show 6 Editor, and Built Roster with separate `0–15` numeric inputs (auto-advance + `0–15` quick dropdown) and a **`🎀 Lv51` Best Buddy** toggle that solves optimal league Level/CPM (`Lv 1.0–51.0`) and updates CP in real time.
- **📦 My Built Pokémon Roster & Cloudflare D1 Delta Sync (`worker.mjs`, `schema.sql`, `GitHubCloudSync.kt`, `src/App.tsx`)**:
  - Save unlimited built specimens per species (`ATK/DEF/STA`, moveset, Shadow flag, `Lv51` flag, optional label) from IV Lab or team editors.
  - Selecting a Pokémon in Team Builder (`3v3` or `Show 6`) automatically fills unique built specimens for that league/Shadow variant or lets you pick from multiple saved copies via `📦 Pick Built`, feeding exact IV-derived stats into 9×9 team matrices, CMP tie checks, and battle math.
  - Backed by a dedicated `built_pokemon` table in Cloudflare D1 (`silphscope-sync-db`) with LWW conflict resolution and tombstone deletion syncing via `/v1/sync/vault`.

---

## v7.36 (2026-11-12) — True 1.0x Real-Time 30 FPS DVR Playback & Trace Serialization Fix
*Live Android APK & Web Simulator release (`v7.36`, `versionCode = 1736`) resolving a deep trace JSON serialization substring slicing bug causing trailing videoElapsedMs:0 keys and slow-motion replay playback, locking 1.0x real-time playback for modern MP4s, and adding nightly DVR trace integrity auditing.*

- **True 1.0x Real-Time DVR Playback Fix (`BattleDvrEngine.kt` & `MainActivity.kt`)**: Fixed a `v7.35` trace serialization bug where Android ART's alphabetical field ordering caused string-sliced `_deep_trace.jsonl` lines to carry a trailing `"videoElapsedMs":0`, triggering the legacy `mp4TimeCompressionRatio` fallback (~0.35x–0.5x slow-motion playback in In-App and Web Replay players despite a true 1.0x 30 FPS MP4). Replaced substring slicing with full `gson.toJson(finalTrace)` serialization on the decoupled `GBLBattleDvrThread`, locked `mp4TimeCompressionRatio = 1.0f` for all modern `v7.02+` (`versionCode >= 1702`) recordings in `MainActivity.kt`, and added `dvrTraceIntegrityAudit` to `scripts/nightly-telemetry-audit.mjs`.

---

## v7.35 (2026-11-12) — Decoupled 30 FPS VIP & 15 FPS Standard Hardware DVR Ticker
*Live Android APK, Web Simulator & Cloudflare Edge release (`v7.35`, `versionCode = 1735`) decoupling the hardware H.264 DVR encoder thread from the vision coroutine loop and strictly locking VIP Battle DVR to constant 30 FPS Smooth.*

- **Locked 30 FPS Smooth VIP DVR**: Locked VIP / Coach Pass Battle DVR strictly to **30 FPS Smooth (`900 kbps` CBR, `QP 27–38`)**, removed the `15 FPS Storage Saver` toggle, auto-reset any legacy `15 FPS` preference to `30 FPS`, and hardened Cloud Vault / Replay List tier persistence (`PREFS_KEY_REPLAY_EVER_PAID` + session/signature checks) so VIP devices never fall back to 15 FPS.
- **Decoupled Hardware DVR & 10 Hz Vision Pipeline**: Decoupled `GBLBattleDvrThread` (`Process.THREAD_PRIORITY_DEFAULT`, drift-free `Handler.postAtTime` fractional pacing) from the `100ms` (10 Hz) `battleLoopJob` vision/OCR coroutine while sharing the single 1-pass `MediaProjection` / triple-buffered `ImageReader` (`captureLock` with dedicated `reusableVisionScreenBitmap` + `dvrScaledBitmap` and cached-tail `_deep_trace.jsonl` serialization). Delivers true, constant-frame-rate **30.0 FPS** video for VIP and true **15.0 FPS** (`66.67ms`) video for Free / Supporter / Legend Pro with zero VFR stutter during OCR/vision ticks.

---

## v7.34 (2026-11-12) — Older-Phone CPU & Memory Optimization Engine, Species-Clause Backline Predictor Hardening & Daily Semi-Dynamic Audit
*Live Android APK & Web Simulator release (`v7.34`, `versionCode = 1734`) substantially reducing active-battle CPU load, GC allocation churn, and GPU compositor cost on older and mid-range Android phones while preserving exact active scan cadences (`100ms` / `67ms` / `33ms` & `750ms` / `250ms` OCR) and native screen capture resolution, hardening the Live Backline Predictor against Species-Clause duplicate variants, and adding a daily zero-token Semi-Dynamic & Species-Clause audit.*

- **v7.34 — Feature 1: Zero-Allocation Vision, OCR Sub-Crop Packing & Hardware DVR Frame Reuse (`OverlayService.kt`, `PixelScannerEngine.kt`, `BattleDvrEngine.kt`)**:
  - Eliminated per-tick `Bitmap.createBitmap()` allocations in `captureCleanScreenBitmap()` and active-battle ML Kit OCR sub-crop packing via pre-allocated reusable ARGB_8888 buffers (`reusableScreenBitmap`, `reusableOcrRawPackBitmap`, and `reusableOcrCompositeBitmap`) and batch `getPixels()` ROI scratch arrays (`drawBinarizedWhiteTextCropOnto`, `ensureVisionScratch*`).
  - Added 2-stage Floating HP Row-Lock corridor windowing (`±14px` fast lock scan with immediate same-tick full-corridor fallback if unlocked) so older phones scan ~85% fewer pixels per frame without losing a single frame on camera zooms or giant Master League sprites.
  - Added `Smart Idle Overworld Gate` (skipping ML Kit OCR ticks between matches unless intro countdown visual cues appear) and reusable `544×1184` DVR scaling canvas + frame sequence deduplication (`lastDvrEncodedFrameSeq`) in `BattleDvrEngine.kt`.
- **v7.34 — Feature 2: WebView GPU Compositor Relief, IPC Payload Coalescing & Stealth Pause (`OverlayService.kt`, `overlay.html`, `overlay-asset.mjs`)**:
  - Removed expensive real-time `backdrop-filter: blur(...)` passes over live 60 FPS Pokémon GO video, converted `@keyframes` `box-shadow` repaints to static compositor-friendly opacity transitions, and added DOM innerHTML diffing (`setHtmlIfChanged`), `requestAnimationFrame`-coalesced height/touch-zone updates (`TouchZoneAppliedSpec`), and `refreshSwapClocks()` state-key short-circuiting.
  - Coalesces nested `recalculateAndPushBattleData()` calls (`runWithCoalescedBattlePush` + JSON payload diffing) and pauses floating `WebView` timers/JS rendering while **Competitive Log-Only Stealth Mode** is active.
- **v7.34 — Feature 3: Semi-Dynamic Backline Predictor Memoization, Species-Clause Consolidation & Daily Audit (`TeamAndMetaEngine.kt`, `PokemonDatabase.kt`, `Show6Engine.kt`, `scripts/nightly-telemetry-audit.mjs`)**:
  - Memoized 3v3 Matchup Matrix (`cached3v3MatrixMap`), non-Top-200 rough matchup fallbacks (`FALLBACK_ROUGH_MATCHUP_CACHE`), season battle-log parsing (`SEASON_LEAGUE_LOGS_CACHE`), and live backline predictions (`BACKLINE_PREDICTION_CACHE`) with instant `simulationCacheEpoch` invalidation whenever Gamemaster, PvPoke rankings, Battle Frontier sheets, or Battle Logs update.
  - Fixed a GBL Species-Clause edge case where Shadow + Normal or regional variants of the same Pokédex family (e.g. `SFERA · FERAL`, `CORVI · SCORV`, `SNINE · NINET`) could occupy both HUD backline prediction slots simultaneously; `predictOpponentBacklineStatic` now consolidates family priors before candidate selection while preserving semi-dynamic blending (`wHist` capped $\le 65\%$, `wMeta` $\ge 35\%$ PvPoke + defensive synergy cores + live revealed-weakness `coverageBoost`, dynamic `🔮 Back:` $\to$ `🔮 3rd:` mid-battle transitions, and live bench swap punish risk).
  - Added an automated zero-token daily validator (`backlinePredictorAudit` in `scripts/nightly-telemetry-audit.mjs`) auditing live DVR `_deep_trace.jsonl` HUD frames and verifying all 4 semi-dynamic engine scenarios every morning.

---

## v7.33 (2026-11-11) — True O(Δ) Vault & DVR Replay Delta Sync, Zero-Echo D1 Short-Circuit & Instant Cold-Start Launch
*Live Android APK, Cloudflare Worker & Web Simulator release (`v7.33`, `versionCode = 1733`) upgrading Cloudflare D1 Multi-Device Vault Sync and Cloud R2 DVR Replay Vault listing to true end-to-end $O(\Delta)$ delta sync with zero-echo D1 short-circuiting, instant local cache hydration, and Main-thread startup optimizations.*

- **v7.33 — Feature 1: End-to-End O(Δ) Cloudflare D1 Vault Sync (`worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`, `OverlayService.kt`, `src/App.tsx`, `src/data/pokemonDb.ts`)**:
  - Updated manual sync on Android (`triggerTwoDeviceCloudSync`) to execute fast cursor-based delta syncs instead of resetting push/pull cursors to `0`, while adding an explicit **`🔁 Force Full Vault Resync (Troubleshooting)`** action in Cloud Vault Security settings.
  - Replaced Web Simulator's 200-log/all-teams push with cursor- and signature-tracked delta pushes (`gbl_d1_last_pushed_ms_v1`, tombstone signatures, and per-team content signatures), and tightened SQLite `ON CONFLICT DO UPDATE` in `upsertVaultBatchIntoD1` from `>=` to strict `>` (or payload/tombstone mutation) so unchanged rows never bump `server_updated_ms`.
  - Added server-side zero-echo filtering and `0`-query D1 short-circuiting in `pullVaultDeltasFromD1` when no other device wrote since `sinceServerMs`, plus `0`-allocation local merge short-circuiting (`lastCloudVaultSyncMutatedLocally`) on Android so `MainActivity` and `OverlayService` skip redundant JSON re-serialization and UI/WebView rebuilds on `0`-delta syncs.
- **v7.33 — Feature 2: Cloud R2 DVR Replay Vault Delta Sync & Instant Cache Hydration (`worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`, `src/components/MarketingWebsite.tsx`)**:
  - Added `?since=<ms>&delta=1` support and tombstone tracking (`deletedReplays`) to `GET /v1/replays/list`, returning `unchanged: true` in $O(1)$ when unmodified and eliminating KV writes (`saveUserReplayIndex`) on read requests unless quota pruning evicted expired items.
  - Hydrates DVR Replay Vault views immediately from local cache across Android (`syncCloudReplayListBlocking`), `silphscopepvp.com`, and `dvr.silphscopepvp.com/vault`, and throttles background license/replay checks on app resume to once per 15 minutes.
- **v7.33 — Fix 1: Android Cold-Start & Resume Main-Thread Bottlenecks (`MainActivity.kt`, `GitHubCloudSync.kt`)**:
  - Fixed a missing early `return` in `runV511LeagueRemapAndCleanup()` that caused all GBL logs, Show 6 logs, teams, and rosters to be deserialized via Gson on the Main UI Thread on every cold start.
  - Added self-invalidating in-memory reference caches for `loadBattleLogs()`, `getPendingAiTelemetryCountsFastStatic()`, and `loadReplayVaultMapStatic()`, moved local `dvr_replays` directory size scanning off the UI thread (`refreshLocalDvrStatsAsyncIfStale`), and deduplicated startup `onCreate` vs. initial `onResume` passes.

---

## v7.32 (2026-11-11) — Modular Compact HUD Customizer, CMP-Tie Post-Charge HP Commit Precision, DVR Timeline Pruning & Retroactive Telemetry Classifier
*Live Android APK, Cloudflare Worker & Web Simulator release (`v7.32`, `versionCode = 1732`) introducing the Modular Compact HUD Customizer across Live Overlay, In-App/Web DVR Replay Theater, and Cloudflare D1 Multi-Device Sync, fixing 1-frame CMP-tie post-charge HP commits during upward camera-zoom shifts, pruning post-battle DVR timeline noise, and updating the local nightly telemetry retroactive classifier.*

- **v7.32 — Feature 1: Modular Compact HUD Customizer (`overlay.html`, `OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`, `GitHubCloudSync.kt`, `worker.mjs`)**:
  - Replaced the single Compact Matrix toggle in Settings with **🧩 Modular Compact HUD Customizer** featuring **3 1-Tap Presets** (`Minimal (Def)`, `Coach + Opp`, `Full-Lite`) and **6 Independent Multi-Select Element Chips** (`⚔️ Opp Attacks`, `⚡ My Attacks`, `🧠 2-Line Coach`, `📊 3x3 Matrix`, `⏱️ Move Pacing`, and `🎥 DVR / Action Bar: Auto / On / Off`).
  - Added a mirrored 1-line **Compact Move Pacing Strip** (`#sky-compact-pacing-strip`: live Player/Opponent Swap Clocks + CMP badges) in Compact HUD whenever `Move Pacing` is enabled and either attack table is hidden, while suppressing tactical border blink animations when `Move Pacing` is turned off.
  - Broadcasts changes immediately to the live floating `WebView` (`setCompactHudConfig`) with zero service restart, injects into In-App & Web DVR Replay Theater (`/watch/:shareId`), and syncs all 6 preferences across devices via **Cloudflare D1 Multi-Device Vault Sync**.
- **v7.32 — Fix 1: CMP-Tie 1-Frame Post-Charge HP Commit Precision (`OverlayService.kt` — `log-1794376642078-231`)**:
  - Fixed an edge case where an unshielded charged move (e.g. Mimikyu Shadow Sneak dropping Virizion `42% -> 9%`) immediately followed by an opponent CMP-tie `Attack incoming!` prompt left `oppHpRowY` camera-zoom shifted after `pendingChargedAttackActor` cleared on the 1-frame transition, holding committed HP frozen during the shield prompt.
  - Post-charge HP drops (`>= 8%` corroborated by `>= 3` consecutive frames within `3.5s` of charged move completion) now bypass `isPreCutsceneZoomOppDip` / `isPreCutsceneZoomUserDip` symmetrically on both sides and reconcile timeline `CHARGED_ATTACK` events across intervening CMP throws (`12.0s` window).
- **v7.32 — Fix 2: Post-Battle DVR Timeline Pruning, Web/PWA Auth Cleanup & Nightly Audit Classifier (`worker.mjs`, `HelpTab.tsx`, `MarketingWebsite.tsx`, `scripts/nightly-telemetry-audit.mjs`)**:
  - Bundled commit `f9a5fb3`: prunes redundant post-battle timeline events in DVR Replay Theater and removes legacy GitHub login UI across Web & PWA in favor of Vault Passwords.
  - Extended `evaluateRetroactiveResolution()` in `scripts/nightly-telemetry-audit.mjs` through `v7.28`–`v7.32` and aligned model-routing metadata to the **Carbon 5-Tier** hierarchy.

---

## v7.31 (2026-11-10) — Cloudflare D1 Multi-Device Vault Sync, Passwordless Migration, Vault Password Security & Global Meta SQL Analytics
*Live Android APK, Cloudflare Worker & Web Simulator release (`v7.31`, `versionCode = 1731`) moving multi-device Battle Log, Team Preset, and App Settings delta synchronization off GitHub onto Cloudflare D1 (`silphscope-sync-db`), performing passwordless initial migrations, retiring GitHub OAuth/PAT sync in favor of PBKDF2-SHA256 Vault Password security, and adding structured SQL userbase-wide meta analytics.*

- **v7.31 — Feature 1: Cloudflare D1 Multi-Device Delta Sync Engine (`schema.sql`, `wrangler.toml`, `worker.mjs`)**:
  - Provisioned Cloudflare D1 database **`silphscope-sync-db`** (`user_vault_state`, `battle_logs`, `team_presets` + composite `idx_battle_logs_user_updated`, `idx_battle_logs_meta`, `idx_battle_logs_opp_lead`, and `idx_team_presets_user_updated` indexes) and implemented `GET/POST/PUT /v1/sync/vault` on `api.silphscopepvp.com`.
  - Uses incremental `sinceServerMs` delta cursors, server-side secret-key sanitization (`sanitizeSyncSettingsJson`), and zero Cloudflare KV writes during sync to stay comfortably inside Cloudflare Free Tier limits (`5 GB` D1 storage, `5M` row reads/day, `100k` row writes/day).
- **v7.31 — Feature 2: Passwordless Initial Migration & Salted PBKDF2 Vault Password Lock (`GitHubCloudSync.kt`, `MainActivity.kt`, `OverlayService.kt`, `activity_main.xml`, `src/App.tsx`)**:
  - Completed passwordless D1 vault migrations for existing trainers (`@sportsfan986`, `@this2guy1`, `@blueheyjay`) and added automatic passwordless first-sync migration on Android and Web (performing a one-time read-only pull of any legacy GitHub vault if present, pushing to D1, and permanently purging stored GitHub sync tokens).
  - Retired GitHub OAuth Device Flow & PAT sync from Android Settings and the Web Simulator; replaced with **SilphScope Cloud Vault Sync** and an automatic post-migration prompt to set an `8–128` character **Vault Password** (`POST /v1/auth/set-password`, PBKDF2-HMAC-SHA256 `100k` iterations) with Android Hardware Keystore AES-256-GCM encrypted `X-Vault-Session` persistence.
- **v7.31 — Feature 3: Structured Userbase-Wide Meta SQL Columns & Admin CLI (`worker.mjs`, `scripts/query-global-meta.mjs`, `package.json`)**:
  - Extracted indexed structured columns on every synced battle (`league`, `combat_mode`, `season_id`, `result`, `elo`, `elo_band`, `my_lead`, `my_p2`, `my_p3`, `opp_lead`, `opp_p2`, `opp_p3`, `bmf`, `wae`, `duration_sec`) alongside lossless `raw_json`.
  - Added Admin Bearer-authenticated endpoints (`GET /v1/admin/meta-summary`, `GET /v1/admin/battle-logs`, `POST /v1/admin/sync/import`) and local CLI commands (`npm run meta:summary`, `npm run meta:dump`) to aggregate global league/ELO usage and export full cross-user battle logs to `.aistudio/global_meta_logs.jsonl`.

---

## v7.30 (2026-11-10) — Competitive Log-Only Stealth Mode, HUD Logo Interaction Redesign & Post-Battle Log Navigation
*Live Android APK & Web Simulator release (`v7.30`, `versionCode = 1730`) shipping tournament-compliant Competitive Log-Only Stealth Mode for Play! Pokémon & Show 6 tournaments, streamlining the HUD emblem toggle to strictly alternate Full ↔ Compact HUD on tap and toggle Stealth Mode on a 2.0s hold, and adding a dedicated Go to Battle Log button in the post-battle summary.*

- **v7.30 — Feature 1: Competitive Mode: Log-Only Stealth Mode (`OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`)**:
  - Added **🔕 Competitive Mode: Log-Only** (`gbl_log_only_stealth_mode`) in Settings and via a `2.0s` press-and-hold on the HUD emblem (`#btn-minimize-sword`).
  - Completely hides the floating HUD (`overlayView.visibility = View.GONE`), status-bar toasts (`showBattleToast` / `showStatusBarToast`), and suppresses all 4 tactile haptic vibration patterns (`triggerSingleHapticPulseStatic`, `triggerDoubleHapticPulseStatic`, `triggerTripleHapticPulseStatic`, `triggerUnlockBuzzHapticStatic`) for zero live mid-battle assistance in regulated tournaments.
  - Keeps the single-pass `MediaProjection` vision loop, ML Kit OCR, pixel HP/energy tracking, and hardware H.264 DVR running headlessly in the background; automatically commits completed matches to the Battle Log, writes `_deep_trace.jsonl` + `_video.mp4`, and executes cloud delta sync as normal.
  - Provides three instant ways to exit Stealth Mode: `2.0s` hold on the transparent `32dp × 32dp` emblem spot, **Exit Stealth** action on the Foreground Service notification, or the **Competitive Mode: Log-Only** toggle in Settings.
- **v7.30 — Feature 2: HUD Logo Interaction Redesign & Post-Battle Summary Navigation (`overlay.html`, `public/overlay.html`, `src/App.tsx`)**:
  - Removed the legacy Minimized (Sword Bubble) state (`#minimized-bubble`) from the overlay emblem toggle.
  - Single-tapping `#btn-minimize-sword` now strictly alternates between **Full HUD** and **Compact HUD** only.
  - Replaced the legacy `2.0s` press-and-hold stop-and-open-log shortcut on `#btn-minimize-sword` with `2.0s` hold to activate/deactivate **Log-Only Stealth Mode**, and added a dedicated **`📊 Battle Log`** button directly inside the post-battle summary (`#auto-logged-banner` and `#start-battle-menu`).
- **v7.30 — Website, Field Manual & Roadmap Synchronization (`MarketingWebsite.tsx`, `DocumentationModals.tsx`, `roadmapData.ts`)**:
  - Highlighted **Competitive Mode: Log-Only** for tournament compliance across the landing page, Field Manual (`/?view=guide`), and competitor comparison matrix (`/?view=compare`).
  - Graduated `log-only-competitive` from `ACTIVE_ROADMAP_ITEMS` into `VERSION_EVOLUTION_HISTORY` (`v7.30`).

---

## v7.29 (2026-11-10) — Tactical Catch Significance Gate, 4-Tier Tactile Haptics Architecture & Debug Target Elimination
*Live Android APK & Web Simulator release (`v7.29`, `versionCode = 1729`) eliminating premature and false bench catch tactical recommendations on trivial opponent chip attacks, introducing a complete 4-tier tactile haptic vibration system (Single 2F, Double Move, Triple Urgent Catch, Smooth 220ms Unlock Buzz) with in-app test controls, re-arming move warning vibrations on multi-window cadence, and permanently deprecating debug build targets from all release CI/CD and local build routines.*

- **v7.29 — Feature 1: Refined Tactical Catch Damage Significance & Bench Eligibility Gate (`OverlayService.kt`)**:
  - Gated tactical bench catch recommendations (`isTankCatch` and `isSacrificialCatch`) behind composite active threat criteria: incoming move deals $\ge 35\%$ absolute damage, OR leaves active Pokémon at $\le 25\%$ resultant end HP, OR post-hit fast move chip prevents active from getting off its next charged attack (when active has $\ge 15$E or within 4 fast moves).
  - Enforced strict bench qualification: for Tank Catches, bench must take strictly less damage than active ($bDmgPct < activeDmgPct$), maintain $\ge 50\%$ resultant end HP ($bHp - bDmgPct \ge 50$), and take neutral/resisted damage ($\le 1.0\times$ and $\le 30\%$); for Sacrificial Catches, low-health bench teammates ($\le 15\%$ HP) absorb significant incoming nukes to preserve healthy active Pokémon ($\ge 35\%$ HP).
- **v7.29 — Feature 2: 4-Tier Tactile Haptic Vibration Hierarchy & Live Test Controls (`OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`)**:
  - Implemented 4 distinct tactile vibration patterns:
    - **🟢 Single Pulse (`80ms`)**: 2 Fast Moves Warning (`WARN_2_FASTS`) cadence cue.
    - **🟡 Double Pulse (`80ms-60ms-80ms`)**: Opponent Move Imminent / Throw Window (`BLINK_1_FAST` / `IMMEDIATE_0_FAST`).
    - **🔴 Triple Pulse (`80ms-50ms-80ms-50ms-120ms`)**: 🚨 Urgent Tactical Catch Alert when damage significance is met and a bench catch is ready.
    - **⏱️ Smooth Unlock Buzz (`220ms sustained`)**: Opponent Switch Clock expiring alert, feeling like an unlatching lock and completely distinct from fast-move clicks.
  - Added Settings UI controls: independent toggles for all 4 patterns, Catch Sensitivity selector (`Strict` vs `All Catches`), Vibration Intensity selector (`Short` 50ms / `Normal` 80ms / `Long` 110ms), and 4 interactive `[Test]` buttons.
- **v7.29 — Fix 3: Over-Farm Haptic Re-Arming On Multi-Window Cadence (`OverlayService.kt`)**:
  - Added physical cadence tracking for move-imminent haptic pulses (`lastChargeWarnHapticFiredWallMs` and `lastChargeWarnHapticFiredOppTurns`).
  - Automatically resets `lastChargeWarnHapticKey = ""` when an opponent over-farms past their throw window without throwing (`curOppTurns > lastChargeWarnHapticFiredOppTurns && (nowMs - lastChargeWarnHapticFiredWallMs) >= (oppFastTurns * 500L)`), ensuring that double/triple pulse haptic alerts reliably re-arm for subsequent windows instead of freezing in a single-shot state.
- **v7.29 — Policy & Architecture: Debug Build Elimination (`AGENTS.md`, `.github/workflows/android.yml`)**:
  - Deprecated and removed all debug build targets (`assembleDebug`) from GitHub Actions CI/CD workflows and developer build scripts, enforcing signed release APK outputs exclusively (`assembleRelease`) across all environments.

---

## v7.28 (2026-11-09) — Continuous Inter-Battle Auto-Start Vision Loop, Clean Match State Initialization & Manual Swap Latency Energy Catch-Up
*Live Android APK & Web Simulator release (`v7.28`, `versionCode = 1728`) resolving auto-start failures between consecutive battles when tuning feedback is unsubmitted, eliminating compact HUD layout offsets on hands-free start, fixing opponent shield desyncs on unshielded minimal-damage charged moves, and adding physical-cadence fast-move catch-up for manual opponent swaps with OCR recognition latency (Tinkaton).*

- **v7.28 — Fix 1: Continuous Inter-Battle Auto-Start Vision Loop & Clean Match State Initialization (`OverlayService.kt`)**:
  - Prevented `stopBattleOcrLoop()` from terminating the background OCR vision loop when `stopCurrentBattle()` or `logBattleResultFromOverlay()` complete if Auto-Start DVR (`DVR_MODE_VIP_AUTO`) or Always-On DVR is active, keeping the 750ms intro countdown detector running in standby between battles.
  - Replaced the direct `isBattleActive = true` flag set in `checkAndTriggerBattleIntroCountdown(...)` with a full invocation of `startNewBattle()`, guaranteeing that `lastLoggedBattleId` is cleared (instantly dismissing the post-battle feedback prompt and previous win/loss banner), residual HP/energy are reset to 100%/0E, previous opponents are purged, and the HUD layout starts clean in both Full and Compact modes.
  - Ensured `restoreOverlayFromBubble()` resumes the OCR loop whenever `mediaProjection != null`, regardless of active combat state.
- **v7.28 — Fix 2: Manual Opponent Swap Latency Energy Catch-Up (`OverlayService.kt`)**:
  - Added physical elapsed-time fast move credit in `handleOpponentSwitch` for manual opponent swaps (matching the existing post-KO replacement catch-up), computing `missedFasts = (swapElapsedMs / (newFastTurns * 500L)).toInt().coerceIn(0, 4)` from the physical midpoint swap start (`swapStartMs`) to OCR nameplate confirmation (`currentFrameTimestampMs`), eliminating Tinkaton/Fairy Wind undercounting.
- **v7.28 — Fix 3: Opponent Shield Desync Resolution on Minimal Damage & Heavy Moves (`OverlayService.kt`)**:
  - Refactored `updateLiveHpAndChargedAttackState` to remove the restrictive `hpDelta in 4..oppShieldChipCap` check in favor of `isOppChipShielded`, ensuring that when an opponent shields a charged attack and takes 0..3% damage (or when visual icon drop OCR misses the frame), `oppShieldsRemaining` is reliably decremented.

---

## v7.27 (2026-11-09) — 1-Tap Issue Report Flagging & Unflagging Across App/Vault/Web + 2-Row Replay Toolbar
*Live Android APK, Cloudflare Worker & Web Simulator release (`v7.27`, `versionCode = 1727`) adding 1-tap diagnostic issue report retraction (`↩️ Unflag Issue`) across the Android app, floating HUD, Cloud DVR Replay Vault, Web Replay Theater, and React Web App, and refactoring the in-app Battle Replay dialog toolbar into a responsive 2-row layout so action buttons never clip off-screen on phone form factors.*

- **v7.27 — Feature 1: 2-Row In-App Replay Toolbar & Persistent Issue Flag Metadata (`MainActivity.kt`, `OverlayService.kt`, `GitHubCloudSync.kt`)**:
  - Split `topToolbar` in the Android `Battle Replay & DVR Vault` modal into two responsive rows (`Row 1`: `[📊 Matrix View] [☆ Star] [🔒 Private] [🔗 Copy Link]`; `Row 2`: `[🚩 Report Issue / 🚩 Flagged ✓] [↩️ Unflag Issue] ... [🗑️ Delete]`) so `[🚩 Report Issue]` never wraps or clips off the right screen edge on phone displays.
  - Added `manuallyFlagged` and `userIssueNote` to `ReplayVaultEntryMeta` and `unflagDvrIssueReportBlocking(...)` so battles can be unflagged even after local `_deep_trace.jsonl` files have been uploaded and purged from device storage.
  - Updated `#btn-auto-flag-bug` and `#btn-stopped-flag-bug` in `overlay.html` to toggle to `↩️ Unflag Bug` when a battle has been flagged, allowing immediate 1-tap retraction from the post-battle HUD banner.
- **v7.27 — Feature 2: Web Replay Theater, Cloud DVR Vault & React Web App Flag / Unflag Controls (`cloudflare/telemetry-worker/worker.mjs`, `src/App.tsx`, `scripts/ingest-telemetry.mjs`)**:
  - Added `POST /v1/dvr/flag` and `POST /v1/dvr/unflag` to `cloudflare/telemetry-worker/worker.mjs` to update or strip `manuallyFlagged`, `userIssueNote`, and `USER_MANUAL_ISSUE_REPORT` across KV, R2 (`replays/` & `recordings/`), `replay_index`, `share_lookup`, and `manifest.recentDvr`.
  - Added `🚩 Flag Issue` / `🚩 Flagged ✓` and `↩️ Unflag Issue` buttons to every replay card on `/vault`, the top header bar and diagnostic banner on `/watch/:shareId`, and each logged battle row & Post-Game Interactive Overlay Replay modal in `src/App.tsx`.

---

## v7.26 (2026-11-09) — Auto-Start Battle DVR (Hands-Free Intro Countdown Detection) & 3-Way Recording Mode
*Live Android APK & Web Simulator release (`v7.26`, `versionCode = 1726`) introducing universal hands-free Auto-Start Battle DVR on confirmed `"3... 2... 1... BATTLE!"` intro countdown detection across all membership tiers (for diagnostic issue recording and replay capture), 3-way DVR recording mode configuration, and opening battle entrance capture.*

- **v7.26 — Feature 1: Multi-Modal Battle Intro Countdown Detector (`OverlayService.kt`, `BattleDvrEngine.kt`)**:
  - Added `checkAndTriggerBattleIntroCountdown(...)` combining pixel-dimmed charge circle detection (`isCountdownDimmedState`), central-banner ML Kit OCR countdown tokens (`"3"`, `"2"`, `"1"`, `"BATTLE!"`, `"GO!"`, `"VS"`), and opening 3v3 Pokéball indicator lock with a 2-frame debounce (`1` frame when both dimmed circles and OCR token agree).
  - Expanded `isDvrRecordingWindow` to `((isBattleActive && !isWaitingForOpponent) || isBattleIntroCountdownActive)` so the hardware H.264 encoder and `_deep_trace.jsonl` capture the full opening entrance and lead reveal from Frame #1.
  - Added `isIntroCountdownActive: Boolean = false` to `BattleDeepTraceFrame`.
- **v7.26 — Feature 2: Universal Hands-Free Auto-Start DVR & 3-Way Mode Selector (`OverlayService.kt`, `MainActivity.kt`, `overlay.html`, `GitHubCloudSync.kt`)**:
  - Enabled **🎥 Auto-Start DVR: ON (Hands-Free)** (`DVR_MODE_VIP_AUTO`) by default across **all tiers** so diagnostic video and frame-trace recording is always active without requiring manual pre-battle taps.
  - Added 3-way DVR mode cycling in **⚙️ Settings** (`🎥 Auto-Start DVR: ON (Hands-Free)` $\to$ `🔘 Battle DVR: Manual 1-Tap Button` $\to$ `⚪ Battle DVR: OFF`) synced via `PREFS_KEY_DVR_RECORDING_MODE`.
  - Updated the floating HUD `#btn-dvr-rec-one` indicator to display live `🔴 REC F#...` frame counters during active recording and allow 1-tap mid-battle diagnostic bug flagging while preserving the 12-second post-battle delete/review window.

---

## v7.25 (2026-11-08) — Post-Cutscene Circle Catch-Up Decoupling, Universal Phase-Elapsed Turn Cap & HP Energy Drift / Shield-Call Promo Clamps
*Live Android APK & Nightly Audit release (`v7.25`, `versionCode = 1725`) resolving all over-tracked opponent energy failure modes in `log-1794174324740-267` (Closer Feraligatr `60E` via `+28E [+3F HP]` promo) and `log-1794193824203-433` (Virizion `+36E` and Tinkaton `+27E` post-cutscene circle catch-up bursts).*

- **v7.25 — Fix 1: Universal Phase-Elapsed Turn Cap (`Section 1D`) & Post-Cutscene Player Circle Catch-Up Decoupling (`Section 1C`)**:
  - Extended the Section 1D physical elapsed-time turn cap (`totalCompletedOppMovesInPhase`) from only `lastOppSwitchTimeMs` to the universal start of the current combat phase (`phaseStartAnchorMs = maxOf(lastChargedAttackLoggedMs, lastOppSwitchTimeMs, lastPlayerSwitchTimeMs, battleClockAnchorMs)`).
  - Updated Section 1C so when a player's charge circle resyncs right after a charged move cutscene or switch (`elapsedInPhaseMs <= 6000L`), any circle energy above what could physically have been generated since `phaseAnchorMs` (`preCutsceneCatchupEnergy`) shifts `phaseStartPlayerEnergy` instead of inflating `confirmedPhasePlayerTurns` and crediting phantom post-cutscene `makeupOppMoves` (`+36E` on Virizion after 1st Leaf Blade and `+27E` on Tinkaton after 2nd Bulldoze eliminated).
- **v7.25 — Fix 2: Minimum Cadence Gate, `+1F` Drift Clamp & Post-Player-Throw Re-Anchoring on HP-Derived Energy (`Section 1A` & `Section 4`)**:
  - Enforced a minimum cadence gate (`(expectedIntervalMs - 250L).coerceAtLeast(350L)`) on `oppSlotLastHpStepMs` in Section 1A and clamped `oppSlotEnergyHp[activeOppIdx]` to at most `+1` fast move (`baseMeterE + oppFastEnergyForStats`) above the meter baseline, preventing rapid multi-frame HP drops from ratcheting `oppSlotEnergyHp` up to `100E`.
  - Re-anchored `oppSlotEnergyHp[activeOppIdx]` and `oppSlotEnergyMeter[activeOppIdx]` to `oppSlotEnergy[activeOppIdx]` after every player charged move in Section 4 (unless a snuck fast move across the player's throw is explicitly detected), preventing stale pre-cutscene `oppSlotEnergyHp` values from surviving across a player charged move.
- **v7.25 — Fix 3: Single-Fast-Move Cap (`[+1F HP]`) & No Double-Counting on `SHIELD_CALL_HP_PROMO` (`Section 2`)**:
  - Capped `SHIELD_CALL_HP_PROMO` in Section 2 to at most `+1` fast move above the pre-roundup meter baseline (`preMissingMeterOppE + oppFastEnergyForStats`) so `missingFullOppMoves` and `SHIELD_CALL_HP_PROMO` can never double-count the same in-flight turn or promote by `+2F`/`+3F` (`+28E` on closer Feraligatr eliminated), and required the HP step to have occurred in the current combat phase (`oppSlotLastHpStepMs > lastNonCmpChargeLoggedMs`).

---

## v7.24 (2026-11-08) — Swap-and-Immediate-Throw Pre-Floor Energy Restoration, Post-KO Re-Entry Turn Cap & Auto-Retiring Survey Verification
*Live Android APK & Nightly Audit release (`v7.24`, `versionCode = 1724`) resolving the closer Feraligatr `60E` phantom energy bug (`log-1794174324740-267`) where an opponent swapping out at low energy (`8E`) into an immediate bench throw refunded the provisional minimum-cost floor (`40E`) instead of true pre-cutscene energy (`8E`), and clamping post-KO replacement re-entry fast-move catch-up to physical elapsed field time.*

- **v7.24 — Fix 1: True Pre-Cutscene Energy Restoration on Swap-and-Immediate-Throw Rollback (`OverlayService.kt`)**:
  - Snapshots `pendingChargedAttackRawPreFloorOppEnergy` and `lastOppChargeRawPreFloorEnergySnapshot` (`oppSlotEnergy[throwerOppIdx]`) **before** `Attack incoming!` applies `missingFullOppMoves` or floors the slot up to `cheapestOppEnergy` (`40E`).
  - When Layer 1 Banner OCR (`"<NewPokemon> used <Move>!"`) or Layer 2 Post-Throw Nameplate Rollback (`tryRollbackRecentSwapAndImmediateThrow`) transfers the throw to the newly switched-in opponent, the prior slot (`oldSlot` / `prevSlotIdx`) is restored to its true pre-cutscene energy (`8E`) instead of refunding the `40E` provisional floor (`+32E` phantom bench energy eliminated).
- **v7.24 — Fix 2: Post-KO Replacement Re-Entry Physical Turn Cap & Either-Circle Post-Throw Sync (`OverlayService.kt`)**:
  - Updated Section 1D (`makeupOppMoves`) so within `5000ms` of an opponent switch or faint replacement (`lastOppSwitchTimeMs`), `totalCompletedOppMovesInPhase` is capped by `((elapsedSinceOppEntryMs + 350L) / (oppFastTurnsForStats * 500L))`, preventing a post-KO player circle resync from crediting multi-second catch-up bursts (`+24E` / `3x Shadow Claw` in `0.76s`) to a newly entered replacement Pokémon.
  - Updated `awaitingPostUserChargeCircleSync` to trigger as soon as either debounced circle (`debouncedFillPct` or `debouncedFasterPct`) is ready and never force-expire across an intervening opponent faint/switch (`lastOppSwitchTimeMs > lastUserChargedAttackLoggedMs`).
- **v7.24 — Feature 3: `swap_throw_reentry_energy_v724` Survey Poll & `>= 10` Positive Confirmation Auto-Retirement (`scripts/nightly-telemetry-audit.mjs`)**:
  - Added `swap_throw_reentry_energy_v724` (`priority: 96`, *"🔄 Bench Swap / Closer Energy (v7.24 Fix):"*) to the daily post-battle question pool and added automatic retirement once any fix-verification poll accumulates `>= 10` positive taps with `0` negative taps.

---

## v7.23 (2026-11-08) — Dynamic Daily Post-Battle Survey Question Pool, Contextual Fix Verification & Remote AI-Tuned Settings Sync
*Live Android APK, Cloudflare Worker & Nightly Audit release (`v7.23`, `versionCode = 1723`) introducing remote over-the-air synchronization for the Daily Prioritized Post-Battle Survey Question Pool and AI-Tuned Hidden Settings (`GET /v1/tuning-config` + piggybacked `POST /v1/telemetry` response), enabling recent fixes and open issues from the nightly 5:00 AM audit to be verified directly in the post-battle `#auto-logged-banner` micro-poll.*

- **v7.23 — Feature 1: Dynamic Daily Post-Battle Survey Question Pool (`OverlayService.kt`, `overlay.html`, `GitHubCloudSync.kt`)**:
  - Added `DynamicSurveyQuestion` & `DynamicSurveyOption` schema (`id`, `priority`, `trigger`, `prompt`, `shortLabel`, and 3-button `options[]`) synced into `SharedPreferences` (`PREFS_KEY_DYNAMIC_TUNING_QUESTIONS_JSON`).
  - Added `selectHighestPriorityPostBattleQuestion(...)` in `OverlayService.kt` to evaluate the completed battle's context (`hp_promoted_shield_call`, `energy_deficit_anomaly`, `master_league`, `great_league`, `ultra_league`, `charged_move_thrown`, `always`) and pick the highest-priority matching question from the daily pool (rotating ties via `battleSurveyRotationCounter`).
  - Updated `#auto-logged-tuning-feedback-row` in `overlay.html` to dynamically render any remote survey question prompt (with `{leadMs}` interpolation) and 3-option buttons while logging responses to both `POST_BATTLE_TUNING_FEEDBACK` telemetry events and the local device EMA tuning loop.
- **v7.23 — Feature 2: Remote AI-Tuned Settings & Question Pool Sync (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `scripts/nightly-telemetry-audit.mjs`)**:
  - Added `GET /v1/tuning-config` and `POST /v1/admin/tuning-config` to `cloudflare/telemetry-worker/worker.mjs` backed by `TELEMETRY_KV` (`daily_tuning_config/latest`), and piggybacked `dailyTuningConfig` onto every `POST /v1/telemetry` response so active APKs receive the latest question pool and tuned millisecond settings with zero extra HTTP requests.
  - Updated `scripts/nightly-telemetry-audit.mjs` to automatically construct the prioritized `dailySurveyQuestionPool` (combining fix-verification polls for `v7.08` Master League HP bars, `v7.15` HP-promoted shield calls, `v7.20` pre-zoom throw energy, and dynamic priority-98 polls for any active open action items) and publish it alongside `aiAutoTunedSettingsRecommendation` to `https://api.silphscopepvp.com/v1/admin/tuning-config`.

---

## v7.22 (2026-11-08) — Expanded 24 MiB Deep-Trace / 64 MiB Video Ingest Limits, Automatic DVR-to-Vault Mirroring & Battle Log Sync Queue Flush
*Live Cloudflare Worker & Android sync reliability release (`v7.22`, `versionCode = 1722`) resolving the `HTTP 413: DVR trace exceeds 3 MiB limit` error on `v7.20+` dual-source energy traces, automatically mirroring recovered `/v1/dvr` uploads into the Cloud R2 Replay Vault (`/vault`) for Pro/VIP users, and flushing queued DVR bundles + AI telemetry logs whenever `☁️ Sync` is tapped in the Battle Log.*

- **v7.22 — Fix 1: Expanded Deep-Trace & Video Payload Limits on Live Cloudflare Worker (`cloudflare/telemetry-worker/worker.mjs`)**:
  - Identified that `v7.20+` `_deep_trace.jsonl` files with dual-source energy fields (`userEnergyMeter`, `userEnergyHp`, `oppEnergyMeter`, `oppEnergyHp`, confidence scores, and promo tags) average **4.0–6.5 MB** per battle, exceeding the `3 MiB` (`MAX_TRACE_BYTES`) cap introduced in `v7.13` and causing `/v1/dvr` and `/v1/replays/upload` to return `HTTP 413`.
  - Increased `MAX_TRACE_BYTES` from `3 MiB` to **`24 MiB`** and `MAX_VIDEO_BYTES` from `36 MiB` to **`64 MiB`** on both `POST /v1/dvr` and `POST /v1/replays/upload`, and increased `POST /v1/telemetry` batch size cap to `16 MiB` and `POST /v1/settings-changes` to `4 MiB`.
- **v7.22 — Fix 2: Automatic `/v1/dvr` → Cloud R2 Replay Vault Mirroring & Bound-Device Auth (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`)**:
  - Updated `POST /v1/dvr` on the Cloudflare Worker so DVR uploads from active Legend Pro / VIP users (including queued DVR bundles retried from `cacheDir`) are automatically mirrored into `replays/<screenName>/<battleId>_video.mp4` and indexed in `replay_index/<screenName>` and `share_lookup/<shareId>`.
  - Updated `authenticateVaultOwner` and `resolveUserLicense` to accept `metadata.deviceId` / `X-Device-Hash` bound-device authentication and seamlessly follow rotated keys (`rotatedTo`) for matching `boundScreenName`.
  - Updated `retryPendingCachedDvrBundlesBlocking` in `GitHubCloudSync.kt` to also invoke `uploadBattleReplayToR2VaultIfUnlockedBlocking` (with 3-host failover) before deleting cached files.
- **v7.22 — Fix 3: Unified Battle Log `☁️ Sync` Queue Flush & GitHub Large-Vault Blob Fallback (`MainActivity.kt`, `GitHubCloudSync.kt`)**:
  - Updated `triggerTwoDeviceCloudSync` (`☁️ Sync` button in the Battle Log and Settings) to also flush any queued cached DVR bundles and pending AI telemetry batches in the same sync pass.
  - Added Git Blobs API (`GET /repos/:owner/:repo/git/blobs/:sha`) fallback in `syncWithGitHubGistBlocking` when `battlematrix_gbl_sync_vault.json` exceeds GitHub's 1 MB `/contents/` inline limit, and surfaced exact DVR upload status details in `triggerManualAiTelemetryUpload`.

---

## v7.21 (2026-11-08) — Multi-Host DVR/Telemetry Upload Failover, Backward-Compatible `v7.x` Ingest & Fast Mobile Web Simulator / Anti-Meta Engine
*Cloud reliability & mobile web performance release (`v7.21`, `versionCode = 1721`) restoring live DVR and telemetry uploads across all `v7.x` builds (`v7.00`–`v7.21`), adding 3-host automatic failover with Cloudflare edge IP fallback in `GitHubCloudSync.kt`, and eliminating the mobile browser startup / Anti-Meta Team Builder hang.*

- **v7.21 — Fix 1: Live DVR & Telemetry Ingest Restoration Across All `v7.x` Builds (`cloudflare/telemetry-worker/wrangler.toml`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - Re-enabled `workers_dev = true` on `silphscope-telemetry` so `https://silphscope-telemetry.silphscope-pvp.workers.dev` remains active alongside `https://api.silphscopepvp.com` and `https://dvr.silphscopepvp.com`.
  - Updated `verifyClientAuth` in `worker.mjs` to accept both `v7.13+` (`sspvp_client_...`) and `v7.00`–`v7.12` (`ssk_client_v615_telemetry_ingest_...`) client ingest tokens across `/v1/dvr`, `/v1/telemetry`, `/v1/settings-changes`, and `/v1/replays/upload`.
- **v7.21 — Fix 2: Multi-Host Automatic Upload Failover & Updated Cloudflare Edge IPs (`GitHubCloudSync.kt`)**:
  - Added `CLOUDFLARE_INGEST_BASE_URLS` (`https://api.silphscopepvp.com`, `https://dvr.silphscopepvp.com`, `https://silphscope-telemetry.silphscope-pvp.workers.dev`) so `uploadBattleDvrBundleToGitHubBlocking` and `uploadPendingAiTelemetryBatchBlocking` automatically cycle across all three endpoints on retry.
  - Updated `TELEMETRY_RESILIENT_DNS` with the primary Cloudflare edge IPs for `*.silphscopepvp.com` (`104.21.56.111`, `172.67.184.167`).
- **v7.21 — Fix 3: Mobile Web Startup & Anti-Meta Team Builder Performance (`src/data/teamAndMetaEngine.ts`, `src/data/show6Engine.ts`, `src/App.tsx`)**:
  - Removed synchronous module-import `recalculateAllPresetsMetrics` execution from `INITIAL_PRESETS` and `INITIAL_SHOW6_PRESETS_OF_3` so initial page load on mobile browsers renders immediately without blocking the main thread.
  - Deferred `precomputed9x9State`, `mostLikelyOpponent6ByFormat`, and `modalLiveEvaluation` when viewing the marketing showcase or when the Team Editor modal is closed.
  - Streamlined `generateAntiMetaTeamOptions` candidate/moveset sweeps on mobile while preserving full Top-50 Role-Weighted Meta auditing (`Beats X/50 Top Meta`, `Key Wins`, `Key Threats`, and `Core Breakers`).

---

## v7.20 (2026-11-08) — Dual-Source Energy Tracking (`E_meter` vs. `E_hp`), Two-Stage Predictive GUI & Haptic Lead Time with Asymmetric Fast-Move Duration Physics, 4 Hidden 10-FPS AI-Tunable Settings & Post-Battle Tuning Micro-Poll
*Combat intelligence & AI telemetry calibration release (`v7.20`, `versionCode = 1720`) introducing Dual-Source Energy Tracking (`E_meter` / `C_meter` vs. `E_hp` / `C_hp`), asymmetric Shield Call (`[+NF HP]`) vs. Normal Combat (`★HP`) promotion rules, Two-Stage Compensated Predictive GUI & Haptic Lead Time accounting for asymmetric fast-move durations (`U` turns vs. `O` turns) and 10 FPS (`200ms`) pixel debounce lag, 4 hidden AI-tunable parameters continuously evaluated across shadow profiles, and a smart 1-question Post-Battle Tuning Feedback micro-poll.*

- **v7.20 — Feature 1: Dual-Source Energy Tracking & Asymmetric Promotion Policy (`OverlayService.kt`, `BattleDvrEngine.kt`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - Simultaneously tracks player and opponent energy via **Circle/Turn-Cadence Meter (`E_meter`, `C_meter`)** and **HP-Drop Fast-Move Cadence (`E_hp`, `C_hp`)**, using player fast-move circle steps vs. opponent HP drops as an in-battle symmetric calibration loop.
  - **Shield Call Overlay (`Attack incoming!`)**: Promotes opponent energy to `max(E_meter, E_hp)` whenever `C_hp >= 55%` and appends a `[+NF HP]` badge on the Shield Decision Overlay so nukes are never undercounted when a fast move snuck in before camera zoom.
  - **Normal Combat (Catch/Swap Safety)**: Requires `>= 2` consecutive phase-aligned HP drops and `C_hp >= C_meter + 10%` (or player charge circle saturated `>= 95%`), capped at `+1` fast move (`★HP`) to prevent premature catch-swaps.
  - **Post-Player-Throw Snuck Fast-Move Audit**: Compares player HP before vs. after firing a charged move (`userHpPre` vs. `userHpPost`) to detect if the opponent snuck a fast move in before the camera zoom cut in.
- **v7.20 — Feature 2: Two-Stage Compensated Predictive GUI & Haptic Lead Time + Asymmetric Fast-Move Duration Physics (`OverlayService.kt`)**:
  - Accounts for the `200ms` 2-sample pixel debounce lag on the 10 FPS (`100ms`) scan loop and compares `turnsFromCurrentPlayerMoveStart` against `userFastTurns`.
  - When a slow player fast move (`3T`/`4T`/`5T`) would animation-lock the player past the opponent's charged move turn, `BLINK_1_FAST` and the double haptic vibration fire `300ms` (`predictiveGuiHapticLeadMs`) before the end of the player's **last safe** fast move (`T_action_boundary - 300ms`), locked to a single alert per opponent charge cycle (`chargeCycleKey`).
- **v7.20 — Feature 3: 10 FPS (`100ms`) Scan Basis & 4 Hidden AI-Tunable Settings (`activity_main.xml`, `MainActivity.kt`, `GitHubCloudSync.kt`, `scripts/nightly-telemetry-audit.mjs`)**:
  - Hid `HP Bar Meter Debounce & Upward Self-Correction`, `3-Ring Energy Meter, Proactive Lead & 100E Opp Clock`, `Proactive Fast-Move Energy Lead Time`, and `Predictive GUI & Haptic Lead Time` from the UI, locking starting defaults to `@sportsfan986`'s active telemetry baseline (`hpDebounceSamples = 2` / `200ms`, `energyDebounceSamples = 2` / `200ms`, `debounceTolerancePct = 1%`, `chargeCirclePriorityMode = "smart_hybrid"`, `proactiveEnergyLeadMs = 300ms`, `predictiveGuiHapticLeadMs = 300ms`) and evaluating 6 continuous shadow profiles on every battle.
- **v7.20 — Feature 4: Post-Battle Tuning Feedback Smart Micro-Poll & Admin Persistent Dual-Source Toast (`activity_main.xml`, `MainActivity.kt`, `overlay.html`, `OverlayService.kt`, `scripts/nightly-telemetry-audit.mjs`)**:
  - Added `Provide Post-Battle Tuning Feedback` in **Settings → Haptics** (default **ON** for `@sportsfan986`, **OFF** for all other users), rendering 1 smart micro-poll question per battle in `#auto-logged-banner`: **Haptic Catch/Throw Timing (`⏪ Early` / `✅ Ideal` / `⏩ Late`)** by default, automatically swapping to **HP Shield Call Energy (`⬇️ Under` / `✅ Spot-On` / `⬆️ Over`)** whenever `[+NF HP]` triggered in that battle.
  - Gated `Live Energy & Circle % Battle Toasts` strictly to `@sportsfan986` and upgraded it to a persistent top-left pill (`⚡ U: M:..E(..%) H:..E(..%) | O: M:..E(..%) H:..E(..%)`) mirrored in `/watch/:shareId`.

---

## v7.14 (2026-11-08) — 3-Stage Charged-Move GUI Energy Deduction Lifecycle Across Live Overlay, In-App Replay & Web Replay Theater
*Combat HUD & Replay parity release (`v7.14`, `versionCode = 1714`, Cloudflare Worker `v7.1.4`) eliminating premature minimum charged-move energy deduction during the 5-second countdown/minigame so the HUD header, move timing rows, 3v3 matrix, and Shield Decision Overlay remain 100% consistent across Live Overlay, In-App DVR Replay, and Web Replay Theater (for both newly recorded and historical replays).*

- **v7.14 — Fix 1: Hold Pre-Throw Energy During the 5s Countdown & Swipe Minigame (`OverlayService.kt`)**:
  - **Opponent Incoming Charged Move**: Holds `oppSlotEnergy[throwerOppIdx] = pendingChargedAttackPreOppEnergy` (`pendingChargedAttackDeductedEnergy = 0`) throughout the 5s countdown so the HUD header, move timing rows, 3v3 matrix, and Shield Decision Overlay all display the pre-throw banked energy. Formats the initial toast with banked energy (`"⚡ Attack Incoming! (50E)"` / `"⚡ Attack Incoming (No Shields)! (50E)"`).
  - **Player Charged Move Minigame**: Holds `playerSlotEnergy[activeUserIdx] = preChargeUserEnergy` (`pendingChargedAttackDeductedEnergy = 0`) during the 5s swipe minigame.
- **v7.14 — Fix 2: Immediate OCR-Validated Move Deduction & Post-Countdown Provisional Fallback (`OverlayService.kt`)**:
  - **Stage 2 (Banner OCR Validated)**: As soon as `"<Pokemon> used <Move>!"` is validated by OCR in `handleMidBannerUsedMoveLines`, immediately deducts the move's exact energy cost (`bannerMoveCost` / `trueCost`) on the GUI, closes the Shield Decision Overlay, and pushes the updated HUD state.
  - **Stage 3 (Post-Countdown Provisional Deduction While Waiting on HP)**: If the 5s countdown/minigame ends and Banner OCR has not validated the move yet while waiting on post-cutscene HP to resolve, provisionally deducts the minimum charged move energy (`OPP_CHARGE_PROVISIONAL` / `USER_CHARGE_PROVISIONAL`) on the GUI before reconciling to the final move energy in Section 4.
  - Updated `shieldDecisionOverlayPayload` to use `activeOppEnergyNow + pendingChargedAttackDeductedEnergy.coerceAtLeast(0)` instead of unconditionally adding `+ minCost`.
- **v7.14 — Fix 3: 100% Parity & Historical Replay Reconstruction in In-App Replay & Web Replay (`MainActivity.kt`, `BattleDvrEngine.kt`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - Updated `syncFrameAtMs`, `applyDeepTraceFrameForReplay`, and `buildReplayOverlayPayload` to reconstruct pre-throw energy across both new and existing `_deep_trace.jsonl` recordings and apply the exact same 3-stage GUI energy lifecycle for opponent and player charged moves.

---

## v7.13 (2026-11-08) — Full Web, Worker & Android APK Security Audit Remediation, Keystore AES-256-GCM Pref Encryption, Active Key UI Masking & R8 Shrinking
*Security & performance release (`v7.13`, `versionCode = 1713`, Cloudflare Worker `v7.1.3`) hardening `silphscopepvp.com`, `dvr.silphscopepvp.com`, `api.silphscopepvp.com`, `dl.silphscopepvp.com`, and the Android APK with domain-separated cryptographic secrets, Android Keystore AES-256-GCM secret storage, masked active keys in the UI, R8 code shrinking, and deferred Simulator boot computations.*

---

## v7.12 (2026-11-07) — Official `silphscopepvp.com` 5-Host Domain Migration, Shiny Origin Dialga Midnight Marketing Website, Persistent `@Featured` Replay Vault, `?t=` Timestamp Deep-Linking & 50% HUD Animated Battle GIFs
*Official domain & website release (`v7.12`, `versionCode = 1712`, Cloudflare Worker `v7.1.2`) migrating all Android, Web, Cloudflare Worker, and GitHub endpoints to **`silphscopepvp.com`**, **`dvr.silphscopepvp.com`**, **`api.silphscopepvp.com`**, and **`dl.silphscopepvp.com`**, launching the **Shiny Origin Forme Dialga Midnight (`dialga_shiny_midnight`)** marketing website (`/`), visual HUD field manual (`/?view=guide`), side-by-side comparison subpage (`/?view=compare`), persistent R2 `@Featured` showcase vault (`replays/_featured/`), `?t=<seconds>` timestamp deep-linking on `/watch/:shareId`, and high-resolution 50% translucent HUD battle GIFs + comparison graphics.*

- **v7.12 — Enhancement 1: 5-Host Domain & Subdomain Architecture (`cloudflare/telemetry-worker/wrangler.toml`, `worker.mjs`, `OverlayService.kt`, `GitHubCloudSync.kt`, `MainActivity.kt`, `src/App.tsx`, `scripts/ingest-telemetry.mjs`)**:
  - Provisioned Cloudflare Custom Domains with SSL across `silphscopepvp.com`, `www.silphscopepvp.com`, `dvr.silphscopepvp.com`, `api.silphscopepvp.com`, and `dl.silphscopepvp.com`.
  - Added `dl.silphscopepvp.com` (and `/download` / `/apk`) instant 1-click redirect (`302`) to the latest signed `.apk` asset on GitHub Releases.
  - Updated `OverlayService.CLOUDFLARE_TELEMETRY_WORKER_URL` (`https://api.silphscopepvp.com`), `CLOUDFLARE_DVR_VAULT_URL` (`https://dvr.silphscopepvp.com`), `OFFICIAL_WEBSITE_URL` (`https://silphscopepvp.com`), `TELEMETRY_RESILIENT_DNS` in `GitHubCloudSync.kt`, `MainActivity.kt` Web Vault launcher, `src/App.tsx`, and `scripts/ingest-telemetry.mjs`.
- **v7.12 — Enhancement 2: Shiny Origin Forme Dialga Midnight Marketing Website, Visual HUD Guide & Comparison Subpages (`src/components/MarketingWebsite.tsx`, `src/App.tsx`)**:
  - Built `src/components/MarketingWebsite.tsx` styled in the **Shiny Origin Forme Dialga Midnight** palette (`#050C14` cosmic dark slate, `#134E4A` teal-emerald armor accents, `#F59E0B` Temporal Gold core highlights, `#67E8F9` Roar of Time cyan glow).
  - **Hero Phone Showcase**: Features the user's **Shiny Origin Forme Dialga** firing **Roar of Time** on Zekrom (`featured_hero_shiny_dialga.gif`, `T+16.5s–21.5s` from `f_ml_closer`) with the 50% translucent HUD (`ROT 65E READY - Safe Throw 100%`, `1 LAST FAST -> THROW RoTime NOW!`, `Back: ZAC-C 22% PAL-O 15%`) and a 4-battle interactive switcher bar.
  - **Subpages**: Added `/?view=guide` (**Visual 50% Translucent HUD Field Manual** with 6-zone breakdown, turn-pacing color states, and 5-step quickstart), `/?view=compare` (**SilphScope vs. PvPoke & GOBattleLog** side-by-side comparison), and `/?view=app` (direct entry into the 3v3 Web Simulator & Team Builder).
- **v7.12 — Enhancement 3: High-Resolution Feature/Comparison Graphics & 50% Translucent HUD Animated Battle GIFs (`public/screenshots/`, `docs/screenshots/`)**:
  - Generated 3 high-resolution 16:9 graphics: `elo_adaptive_anti_meta_engine.jpg` (Personal Meta + PvPoke Weighted Fusion + Community ELO Meta), `silphscope_vs_pvpoke_teambuilder.jpg`, and `silphscope_vs_gobattlelog_analytics.jpg` (highlighting `$2/mo` effective cost vs `$4.99–$10/mo` and **Free 1-Click GOBattleLog Export** in all tiers).
  - Generated 4 real-battle 50% translucent HUD animated GIFs (`featured_hero_shiny_dialga.gif`, `featured_gl_debuff_math.gif`, `featured_ml_closer_align.gif`, `featured_ul_disguise_shield.gif`) with clickable `?t=` chapter pills.
- **v7.12 — Enhancement 4: Persistent `@Featured` Showcase Vault (`replays/_featured/`) & `?t=` Timestamp Auto-Seek (`cloudflare/telemetry-worker/worker.mjs`, `scripts/manage-keys.mjs`)**:
  - Added `cloneReplayToFeatured()`, `POST /v1/replays/feature`, `GET /v1/replays/featured`, and a 1-click **`🌟 Promote to Featured`** button on `dvr.silphscopepvp.com/vault` (when signed in as `@sportsfan986`) that copies any replay's `.mp4` and `_deep_trace.jsonl` into persistent R2 storage (`replays/_featured/`) and scrubs the trainer handle to `@Featured` (`f_gl_debuff`, `f_ml_closer`, `f_ul_shield`).
  - Added `?t=<seconds>` URL query parameter auto-seek (`applyInitialUrlSeekIfNeeded()`) on `dvr.silphscopepvp.com/watch/:shareId` with `50%` default HUD transparency.

---

## v7.11 (2026-11-07) — Competitive `$2 / $3-$6 / $5-$10` Pricing Alignment Across Stripe, Buy Me a Coffee, Infographic, App, Web Simulator, Cloudflare Worker & Shared Knowledgebase
*Competitive pricing update (`v7.11`, `versionCode = 1711`, Cloudflare Worker `v7.1.1`) lowering and aligning membership pricing across all platforms to **`$2` Lifetime Supporter (One-Time or Alumni)**, **`$3/mo` or `$3` Day 15+ First-Season Intro / `$6` 90-Day Season Pass (`$2/mo` effective) Legend Pro**, and **`$5/mo` or `$5` Day 15+ First-Season Intro / `$10` 90-Day Season Pass (`$3.33/mo` effective) VIP / Coach**.*

- **v7.11 — Enhancement 1: Live Stripe Payment Links, Buy Me a Coffee (`$1/PokéCoin`) & 4-Tier Infographic (`docs/screenshots/silphscope_tiers_infographic.jpg`)**:
  - Provisioned 7 new live Stripe prices and Payment Links (`$2` Supporter `4gM3cwf3r8JG7XLamm1Jm07`, `$6` Pro Season `8x2aEY8F33pma5TgKK1Jm08`, `$3` Pro Intro `14A4gAcVjf8491P8ee1Jm09`, `$3/mo` Pro Monthly `4gM3cw7AZ0dab9XeCC1Jm0a`, `$10` VIP Season `9B6fZi3kJ6By4Lzamm1Jm0b`, `$5` VIP Intro `4gM7sM5sR5xudi5amm1Jm0c`, `$5/mo` VIP Monthly `28E00k2gFaRO5PD2TU1Jm0d`) and deactivated the old payment links.
  - Updated Buy Me a Coffee Memberships (`$3/mo` Legend Pro, `$5/mo` VIP / Coach), Shop Extras (`595787` `$2` Supporter, `595788` `$6` Pro Season Pass, `595789` `$10` VIP Season Pass), Gallery post, and Page Bio (`$1` per PokéCoin).
  - Regenerated `docs/screenshots/silphscope_tiers_infographic.jpg` with the new `$2 / $3-$6 / $5-$10` pricing, **🛡️ Attack Incoming! Shield Decision Overlay** in Paid-Once / Alumni + Pro + VIP, and **🎥 30 FPS Smooth DVR** in VIP.
- **v7.11 — Enhancement 2: App, Web Simulator, Cloudflare Worker Webhooks & Shared Website Knowledgebase (`OverlayService.kt`, `MainActivity.kt`, `GitHubCloudSync.kt`, `activity_main.xml`, `src/App.tsx`, `cloudflare/telemetry-worker/worker.mjs`, `README.md`, `ANTIGRAVITY.md`)**:
  - Updated `STRIPE_PAYMENT_LINKS`, `TIER_PRESETS`, `/v1/users/checkout-quote`, `/vault`, `/watch/:shareId`, and Stripe/BMC webhook tier amount thresholds (`POST /v1/webhooks/stripe` & `POST /v1/webhooks/bmc`) in `worker.mjs` to match `$2` Supporter, `$3`/`$6` Pro, and `$5`/`$10` VIP.
  - Updated all checkout URLs and pricing badges across `OverlayService.kt`, `MainActivity.kt`, `GitHubCloudSync.kt`, `activity_main.xml`, `src/App.tsx`, and `README.md`.
  - Added Section 3.7 (**Membership Tiers, Pricing, Payment Links & Website Integration Spec**) in `ANTIGRAVITY.md` & `AGENTS.md` so other chats and upcoming website builds share the exact URLs, tier matrix, and API endpoints.

---

## v7.10 (2026-11-07) — Progressive Opponent Reveal & Field-Entry Banked Energy in Web & Android DVR Replays
*Replay HUD parity update (`v7.10`, `versionCode = 1710`, Cloudflare Worker `v7.1.0`) ensuring that both the **Cloudflare Web Replay Theater (`/watch/:shareId`)** and the **Android In-App DVR Video Player** reveal opponent Pokémon progressively as they enter the battlefield rather than showing all 3 opponent Pokémon from the start of the video.*

- **v7.10 — Fix 1: Progressive Opponent Reveal in Web Replay Player (`cloudflare/telemetry-worker/worker.mjs`)**:
  - Added `getRevealedOppSpecsAtFrame(frameArrayIdx)` to reconstruct the exact list of opponent Pokémon seen on the field up to frame $t$ (`[0 .. frameArrayIdx]`), preserving full fast/charged move metadata and Shadow status from `summaryHeader.oppTeamSpecs`.
  - While the opponent is still on their 1st Pokémon (or 1st + 2nd), the 3x3 Matchup Matrix renders only the revealed opponent row(s) and the `MY ATTACKS` 3-column damage header shows `—` for unrevealed opponent slots, matching live in-battle HUD behavior 1:1. Before the lead nameplate is scanned at the start of a clip, the HUD displays the `WAITING FOR OPPONENT...` state.
- **v7.10 — Fix 2: Progressive Opponent Reveal in Android App DVR Video Replay (`MainActivity.kt`, `BattleDvrEngine.kt`, `OverlayService.kt`)**:
  - Added `revealedOppSpecies` and `userSlotEverOnField` snapshots to `BattleDeepTraceFrame` (`_deep_trace.jsonl`) and updated `applyDeepTraceFrameForReplay` + `syncFrameAtMs` to rebuild `detectedOpponents` strictly from opponent species revealed up to the current video timestamp (supporting both forward playback and backward scrubbing), while keeping the full 3v3 post-game summary when toggled to static **📊 Matrix View**.
- **v7.10 — Fix 3: Accurate Player Bench `-E` Field-Entry State & Line-2 Backline Prediction in Replay (`cloudflare/telemetry-worker/worker.mjs`, `MainActivity.kt`, `BattleDvrEngine.kt`)**:
  - Reconstructed `playerSlotEverOnField` / `hasEnteredField` across `frames[0 .. frameArrayIdx]` so player bench Pokémon that have not yet entered the field display `-E` in the `OPP / MY BANKED E` matrix header instead of `0E`.
  - Parsed `recommendedGoal` (`"subGoal | backlineText"`) in `worker.mjs` so Line 2 of the Tactical Coach displays the live backline prediction (`🔮 [ABC] Back: ...`) during replay.

---

## v7.09 (2026-11-07) — Shield Decision Overlay Moved to Paid-Once / Alumni (`Lifetime Supporter` / `Pro` / `VIP`) Tier & Updated Infographic / Stripe / Buy Me a Coffee Perks
*Membership tier alignment & marketing update (`v7.09`, `versionCode = 1709`, Cloudflare Worker `v7.0.9`) moving the **🛡️ Attack Incoming! Shield Decision Overlay** (Red/Orange/Yellow/Green KO & Tank/Farm Verdict Card) into the **🏅 Lifetime Supporter (`$3` One-Time or Alumni)** / **🏆 Legend Pro** / **👑 VIP** tiers (and out of Free tier), and updating the 4-tier comparison infographic (`docs/screenshots/silphscope_tiers_infographic.jpg`), Stripe Payment Link product descriptions, Buy Me a Coffee Memberships/Shop/Gallery/Bio, Web Simulator, `/vault`, and `README.md` with this change and the VIP **`30 FPS Smooth`** DVR recording feature.*

- **v7.09 — Enhancement 1: Shield Decision Overlay Gated to Paid-Once / Alumni (`Lifetime Supporter`, `Legend Pro`, `VIP`) (`OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - **Live HUD & In-App Replay Gating (`isShieldDecisionOverlayUnlockedByTier`)**: Gates `showOrUpdateShieldDecisionOverlay` and `shieldDecisionOverlayPayload.isVisible` on `OverlayService.getEffectiveReplayTierStatic(prefs) != "free"`, unlocking the **🛡️ Attack Incoming! Shield Decision Overlay** permanently with **Lifetime Supporter (`$3` one-time)** or automatically forever when subscribing to **Legend Pro** or **VIP** even once.
  - **Settings Toggle & Prompt (`MainActivity.kt`, `activity_main.xml`)**: In Free tier, the **🛡️ Attack Incoming! Shield Decision Overlay** button displays `🔒 Supporter ($3)` and opens a 1-tap unlock prompt explaining that any `$3` Lifetime Supporter purchase or Pro/VIP subscription permanently unlocks the Shield Decision HUD forever.
  - **Cloudflare Worker `/watch/:shareId` Replay Gating**: Gates the Shield Decision Overlay toggle on `/watch/:shareId` by the uploader's resolved paid tier (`SHARE_USER_TIER !== 'free'`).
- **v7.09 — Enhancement 2: Updated 4-Tier Infographic, Stripe Products, Buy Me a Coffee & Tier Comparisons (`docs/screenshots/silphscope_tiers_infographic.jpg`, `README.md`, `src/App.tsx`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - Regenerated `docs/screenshots/silphscope_tiers_infographic.jpg` and updated all 7 live Stripe products, Buy Me a Coffee Memberships/Shop/Gallery/Bio, `README.md`, `src/App.tsx`, and `TIER_PRESETS` in `worker.mjs` to reflect **🛡️ Attack Incoming! Shield Decision Overlay** in **Lifetime Supporter (`$3` once / Alumni)** + **Pro** + **VIP**, and **`🎥 30 FPS Smooth DVR Default (+ 💾 15 FPS Storage Saver)`** in **VIP / Coach Pass**.

---

## v7.08 (2026-11-07) — Mega Master League Floating HP Bar Tracking Fix (Giant/Flying Sprites & Pulled-Back Camera Geometry)
*Vision pipeline & floating HP bar scanner hotfix (`v7.08`, `versionCode = 1708`) resolving missing player and opponent HP tracking in **Mega Master League** when giant/flying Pokémon (**Primal Kyogre**, **Lugia**, **Dialga-Origin**) pull the battle camera back (`log-1794102269182-295`).*

- **v7.08 — Fix 1: Upper-Battlefield Player HP Corridor Expansion for Giant & Flying Pokémon (`OverlayService.kt`, `PixelScannerEngine.kt`)**:
  - Expanded `playerHpCorridorRect.top` from `0.45h` up to **`0.18h`** (safely below the `0.125h` nameplate and `0.165h` Run button) and `playerHpCorridorRect.right` to `0.560w`, capturing tall and high-altitude floating player Pokémon whose HP bars sit in the upper-left battlefield (`Primal Kyogre` at `0.25h`, `Lugia` at `0.26h`, `Dialga-Origin` at `0.31h`).
  - Expanded player left-border X anchor (`absAnchorMaxX`) from `0.220w` to **`0.260w`** so wide Primal/Mega models whose HP bars start near `0.228w` are never clipped.
- **v7.08 — Fix 2: Pulled-Back Camera Opponent X-Anchor & Tall Opponent Row-Y Baseline (`PixelScannerEngine.kt`, `OverlayService.kt`)**:
  - Expanded opponent left-border X anchor (`absAnchorMaxX`) from `0.585w` to **`0.715w`** so opponent Pokémon shifted rightward by the pulled-back Mega Master League camera (e.g. `Keldeo` starting at `0.656w..0.664w` opposite `Dialga-Origin` / `Lugia`) are tracked across 100% of normal combat frames.
  - Lowered `minValidOppHpRowY` from `0.31h` to **`0.22h`** so tall opponent bosses (`Primal Kyogre` at `0.285h`) lock in their normal-combat baseline row Y and commit HP drops without triggering false camera-zoom upward-shift suppression.
- **v7.08 — Fix 3: Translucent Capsule Border over Blue Models/Night Sky & `94%–98%` Anti-Aliased Cap Handling (`PixelScannerEngine.kt`)**:
  - Updated `isBorderPixel` to accept semi-translucent white capsule borders (`luma 95..174`, `luma - refDarkLuma >= 18`) rendered over the indigo night sky or royal-blue Pokémon bodies (`Primal Kyogre`, `Lugia`).
  - Skipped up to `3px` of yellow-green anti-aliased right-tip transition pixels immediately after `xEnd` before measuring `darkTrackStartX` so `94%–98%` green HP bars pass dark-track verification cleanly.

---

## v7.07 (2026-11-07) — VIP Tier Full `30 FPS Smooth` DVR Recording + `15 FPS Storage Saver` Mode
*DVR video quality & VIP tier release (`v7.07`, `versionCode = 1707`, Cloudflare Worker `v7.0.7`) upgrading **👑 VIP / Coach Pass** users to **full `30 FPS Smooth` (`33ms`) hardware H.264 DVR recording** by default (`544x1184 @ 30 FPS`, `900 kbps` CBR, strictly $\le 30\text{ MB}$ at the 240s PvP timeout) while keeping `15 FPS` (`720 kbps` CBR) as the standard across Free / Supporter / Legend Pro tiers and offering VIP users a 1-tap **`15 FPS Storage Saver`** toggle to save ~30% local and Cloud R2 storage.*

- **v7.07 — Enhancement 1: VIP Tier Full `30 FPS Smooth` Hardware H.264 DVR + `15 FPS Storage Saver` Selector (`BattleDvrEngine.kt`, `OverlayService.kt`, `GitHubCloudSync.kt`, `MainActivity.kt`)**:
  - **VIP `30 FPS Smooth` Default (`544x1184 @ 30 FPS`, `900 kbps` CBR, `QP 27–38`)**: VIP users now record at a true `30 FPS` (`33ms` frame cadence) by default (~20 MB for a 150s average battle; strictly $\le 30\text{ MB}$ including `_deep_trace.jsonl` at the 240s max PvP timeout).
  - **1-Tap `15 FPS Storage Saver` Option (`gbl_vip_dvr_fps_mode`)**: Added a **👑 VIP Battle DVR Framerate Mode** selector in **Settings → Membership Tier & Replay Vault** allowing VIP users to switch between **`🎥 30 FPS Smooth (VIP Default • 900 kbps CBR)`** and **`💾 15 FPS Storage Saver (Pro Mode • 720 kbps CBR • saves ~30% local & cloud storage)`**, synced across devices via GitHub Cloud Delta Sync.
  - **Zero-Impact Decoupled Vision Cadence (`startBattleOcrLoop`)**: During `30 FPS` VIP recording, full combat vision/pixel HP/energy scanning continues on its calibrated `~67ms` cadence while intermediate `33ms` ticks capture lightweight DVR-only frames, preserving 100% identical HP/energy debounce behavior and near-zero CPU overhead.
- **v7.07 — Enhancement 2: Dynamic `30 FPS` / `15 FPS` Frame-Stepping (`-1F` / `+1F`) & Updated Tier Comparisons (`MainActivity.kt`, `cloudflare/telemetry-worker/worker.mjs`, `src/App.tsx`, `README.md`, `ANTIGRAVITY.md`)**:
  - Updated `-1F` / `+1F` frame-step buttons in both the Android in-app DVR player and the `/watch/:shareId` web replay theater to dynamically compute the per-frame step interval from the trace (`~33ms` for 30 FPS VIP recordings, `~67ms` for 15 FPS recordings).
  - Updated membership tier cards and documentation across the Android App, Web Simulator, Cloudflare `/vault`, `README.md`, and `ANTIGRAVITY.md`.

---

## v7.06 (2026-11-07) — Telegram Subscription Purchase/Renewal/Activation Alerts, Diagnostic Video `/watch/:shareId` Overlay Links & Required Issue Description Gate
*Telegram diagnostic channel & membership notification release (`v7.06`, `versionCode = 1706`, Cloudflare Worker `v7.0.6`) adding instant Telegram notifications on every Stripe/Buy Me a Coffee subscription purchase, renewal (with automatic in-place license extension), and membership activation/device link, enriching user-flagged diagnostic video alerts with a direct `/watch/:shareId` synchronized HUD overlay player link, user issue description, and resolved paid tier badge, and strictly gating diagnostic video chat uploads to user-flagged videos with a non-blank issue description.*

- **v7.06 — Enhancement 1: Telegram Alerts on Subscription Purchase, Renewal & Membership Activation (`cloudflare/telemetry-worker/worker.mjs`)**:
  - **Purchase & Renewal Alerts (`POST /v1/webhooks/stripe`, `POST /v1/webhooks/bmc`, `POST /v1/admin/keys`)**: Detects whether a payment event is a **New Subscription Purchase** (`💳 New Stripe Subscription Purchase!` / `☕ New Buy Me a Coffee Purchase!`) or a **Subscription Renewal** (`🔄 Stripe Subscription Renewal!` / `🔄 Buy Me a Coffee Renewal!`), automatically extends/upgrades any existing license key for that buyer's `boundScreenName` or `supporterEmail` in-place in KV, and sends a Telegram message with Trainer ID, Paid Tier, Unlock Key, Expiration, and Vault URL.
  - **Membership Activation & Device Link Alerts (`resolveUserLicense`)**: Sends an instant Telegram notification (`✅ Membership Activated!` or `🔗 Membership Linked to New Device / Account!`) whenever a trainer activates their key for the first time or links a new Trainer ID, GitHub account, or Android device hash.
- **v7.06 — Enhancement 2: Diagnostic Video Chat with Synchronized HUD Overlay Link, Issue Description & Paid Tier (`cloudflare/telemetry-worker/worker.mjs`, `OverlayService.kt`, `MainActivity.kt`, `GitHubCloudSync.kt`)**:
  - **Strict Flagged + Issue Description Filter (`POST /v1/dvr`)**: Only sends DVR videos to the Telegram diagnostic video chat when the battle was explicitly flagged by the user **and** includes a genuine user-written issue description (`isManual && userIssueNoteClean.length > 0`).
  - **Mandatory Issue Description in App (`OverlayService.kt`, `MainActivity.kt`, `GitHubCloudSync.kt`)**: Requires a non-blank issue description when submitting a DVR bug report from the post-battle HUD or Battle Log replay dialog and removes generic auto-filled placeholder strings.
  - **Synchronized HUD Overlay Player Link (`/watch/:shareId`), Issue Banner & Paid Tier Badge**: Automatically mints a capability share link (`https://silphscope-telemetry.silphscope-pvp.workers.dev/watch/<shareId>`) backed by R2 + KV fallback for every user-flagged diagnostic report, includes `💳 Paid Tier`, `📝 Issue Description`, and `▶️ Watch Video + HUD Overlay` directly in the Telegram video caption, and renders a prominent `🚩 Reported Diagnostic Issue` + `Paid Tier` banner at the top of `/watch/:shareId`.

---

## v7.05 (2026-11-07) — Live Compact HUD Mode, 3-State Emblem Button Cycle (`Full → Compact → Minimized`), Optional 3×3 Matrix in Compact Mode & Idle Team/League Banner
*Live floating HUD ergonomics and customization release (`v7.05`, `versionCode = 1705`) bringing the streamlined **Compact HUD** mode from the DVR Video Replay viewer to the live Android floating overlay and Web Simulator, introducing a 3-state top-left emblem button cycle (`Full → Compact → Minimized → Full`), an in-app setting to toggle 3×3 Matchup Matrix visibility in Compact mode, and an Idle (`Waiting...`) Team Pokémon & League banner across all HUD variants.*

- **v7.05 — Enhancement 1: Live Compact HUD Mode & 3-State Emblem Cycle (`Full → Compact → Minimized → Full`) (`overlay.html`, `OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`, `src/App.tsx`)**:
  - **Compact HUD Mode (`gbl_overlay_hud_mode`: `"full"` default vs. `"compact"`)**: Streamlines the active-combat HUD down to the Mirrored Top Header (`[Stat, HP%, E, 🛡️] | [🛡️, E, HP%, Stat]`), the 2-Line 4-Pillar AI Tactical Coach (`#sky-tactical-rec-row` with 2F/1F/0F throw & catch blink alerts and `Swap ➔` / `Send ➔` button), the incoming charged-attack Shield Decision Card (`#sky-shield-decision-card`), and the Post-Battle Win/Loss Log & Auto-Logged banners (`#start-battle-menu` / `#auto-logged-banner`).
  - **3-State Top-Left Emblem Cycle (`#btn-minimize-sword`)**: Tapping the top-left SilphScope emblem in `Full` mode switches to `Compact` mode; tapping it in `Compact` mode minimizes the overlay to the floating bubble (pausing OCR); tapping `#minimized-bubble` restores back to `Full` mode. Holding `#btn-minimize-sword` for 2 seconds continues to stop the overlay and open the Battle Log.
  - **100% Pass-Through Shield Decision Card in Compact Mode (`notifyHeight`)**: When `.timing-rows-container` is hidden in Compact mode, `topZoneHeightDp` stops at the top of `#sky-shield-decision-card` when visible so the Shield Decision Card remains 100% pass-through (`FLAG_NOT_TOUCHABLE`).
- **v7.05 — Enhancement 2: Optional 3×3 Matchup Matrix Visibility in Compact HUD (`overlay.html`, `OverlayService.kt`, `MainActivity.kt`, `activity_main.xml`, `src/App.tsx`)**:
  - Added **📊 3×3 Matchup Matrix in Compact HUD** (`gbl_compact_hud_show_matrix`, default `false` / hidden in Compact mode) in **Settings → Section 2 (Overlay HUD Behavior)** and the Web Simulator Settings tab, allowing players to optionally keep the 3×3 Matchup Matrix (`#sky-matrix-body`) visible in Compact mode once opponents are scanned while keeping the attack timing tables hidden.
- **v7.05 — Enhancement 3: Idle (`Waiting...`) Team Pokémon & League Banner + Auto-Hide Action Toolbar in Compact Combat (`overlay.html`, `OverlayService.kt`, `src/App.tsx`)**:
  - **Selected Team Pokémon & League in `Waiting...` Across All HUD Variants**: Added `#sky-idle-team-banner` in the idle `Waiting...` state across `Full` and `Compact` HUD modes (plus active League and 3 Team Pokémon in Option 2 `#mode-horizon-belt`), displaying the active League pill, Team Name / Archetype, a clickable `📐 FULL HUD` / `⚡ COMPACT HUD` toggle badge, and 3 clickable Team Pokémon pills (`#1`, `#2`, `#3` with CP).
  - **Idle-Only Action Toolbar in Compact Mode**: In Compact HUD mode, `.action-toolbar` (`Start Battle`, `Shadow`, `Form`, 3-letter team chips) remains visible while idle (`Waiting...` and `!isBattleActive`) so players can switch leads or manually start a battle, and automatically hides as soon as active combat begins.

---

## v7.04 (2026-11-07) — Paid-First Telemetry Priority (`P1`–`P4`), Zero-Token Local Root-Cause Classifier, Manual Bug Report Ingestion Fixes & 5 Combat/Vision Engine Fixes
*Telemetry pipeline, manual bug report ingestion, and combat/vision engine accuracy release (`v7.04`, `versionCode = 1704`, Cloudflare Worker `v7.0.4`) introducing Paid-First issue prioritization (`P1: Paid Manual` > `P2: Free Manual` > `P3: Paid Auto` [`VIP` > `Pro` > `Supporter`] > `P4: Free Auto`), a zero-token local root-cause classifier in `scripts/ingest-telemetry.mjs`, end-to-end preservation of manual DVR bug report flags and notes across Android/Cloudflare/Local Ingestion, and 5 precision fixes for CMP tie dual-charge transitions, swap-during-cutscene move banner retention, post-cutscene camera-zoom `oppHpRowY` spikes, energy-feasible `HP_DELTA` move inference, and updated `Air Cutter` (`45p/35E`) move stats.*

- **v7.04 — Enhancement 1: Paid-First Issue Priority Ordering (`P1` > `P2` > `P3` > `P4`) & Zero-Token Local Root-Cause Classifier (`scripts/ingest-telemetry.mjs`, `scripts/telemetry-preprocess-config.json`)**:
  - **Paid-First Priority Buckets**: Joins trainer screen names against `/v1/admin/keys` (`VIP` > `Pro` > `Supporter` > `Free`) and sorts all anomalies and DVR bundles in `latest_anomaly_report.json` by:
    1. **`P1_PAID_MANUAL`**: Paid-tier manually flagged issues (`VIP` > `Pro` > `Supporter`).
    2. **`P2_FREE_MANUAL`**: Free-tier manually flagged issues.
    3. **`P3_PAID_AUTO`**: Paid-tier auto-flagged issues (`VIP` > `Pro` > `Supporter`, then `HIGH` > `WARN`).
    4. **`P4_FREE_AUTO`**: Free-tier auto-flagged issues (`HIGH` > `WARN`).
  - **Zero-Token Local Root-Cause Classifier (`classifyAnomalyLocally`)**: Deterministically cross-references `timelineEvents`, `postCutsceneHpAudits`, and `energyMutationLedger` locally in Node.js to classify known combat/vision patterns (`CMP_TIE_DUAL_CHARGE_TRANSITION`, `SWAP_DURING_CUTSCENE_BANNER_CLEARED`, `POST_CUTSCENE_CAMERA_ZOOM_ROW_Y_SPIKE`, `HP_DELTA_RETROACTIVE_ENERGY_MISMATCH`, `LEGACY_STATIC_MOVE_STATS_OVERESTIMATE`, `DELAYED_POST_KO_REPLACEMENT_OCR`, `ONE_FAST_MOVE_TURN_BOUNDARY_VARIANCE`) with zero AI token usage.
  - **Storage Quota & Preprocessor Hardening**: Added process lockfile (`ingest.lock`) and atomic state merging, fixed the evicted `.mp4` re-preprocess check (`videoExistsOnDisk`), capped `04_hp_change` keyframe extraction (`maxEventsPerBattle: 25`, `cooldownFrames: 25`), and protected `_deep_trace.jsonl`, `digest.json`, and manually flagged bundles from 1 GB quota eviction.
- **v7.04 — Enhancement 2: End-to-End Manual Bug Report Ingestion Fixes (`BattleDvrEngine.kt`, `GitHubCloudSync.kt`, `cloudflare/telemetry-worker/worker.mjs`, `scripts/ingest-telemetry.mjs`)**:
  - **In-Place Header Update (`prependDvrSummaryHeaderIfNeededStatic` & `uploadBattleDvrBundleToGitHubBlocking`)**: Replaces Line 0 (`BATTLE_DVR_SUMMARY_HEADER`) in `_deep_trace.jsonl` whenever `manuallyFlagged == true` or `userIssueNote` is provided, and attaches a `HIGH`-severity `USER_MANUAL_ISSUE_REPORT` anomaly so post-battle and replay-menu bug reports are never lost when a header was already prepended.
  - **Full Summary Preservation (`submitManualDvrIssueReportBlocking`)**: Preserves the existing `AiTelemetryBattleRecordV510` from Line 0 of `traceFile` (or pending telemetry logs) instead of overwriting it with an empty summary record.
  - **Cloudflare Worker Metadata & Manifest Persistence (`POST /v1/dvr`)**: Persists `userIssueNote`, `uploadReason`, `manuallyFlagged`, and resolved `userTier` on R2/KV object metadata and `manifest.recentDvr`, and re-ingests manual flag upgrades in `scripts/ingest-telemetry.mjs` even if the initial auto-DVR was already ingested.
- **v7.04 — Enhancement 3: 5 Combat & Vision Engine Accuracy Fixes (`OverlayService.kt`, `PokemonDatabase.kt`)**:
  - **CMP Tie Dual `CHARGED_ATTACK` Timestamp & Post-Minigame HP Drain Fix**: Uses `getElapsedBattleSeconds(pendingChargedAttackStartMs)` in `Case 2: Genuine CMP Tie Transition` (eliminating the `0.02s–0.08s` timestamp collision with the 2nd CMP throw), enables `isPostUserMinigameOppDrainWindow` in `canSampleOppHpBars` so opponent HP drain is captured before the 2nd CMP throw starts, and extends Section 1B's retroactive player `CHARGED_ATTACK` HP settle window to `12000ms` when an opponent charged move intervenes.
  - **Swap-During-Cutscene Move Banner Retention**: Preserves `lastDetectedBannerMoveName` / `lastDetectedBannerMoveActor` across `executePlayerSwitch` and `handleOpponentLines` while `pendingChargedAttackActor.isNotEmpty()`, falls back to `lastUserChargeResolvedMoveName` in Section 4, and updates `battleTimelineEvents` in `handleMidBannerUsedMoveLines`'s retroactive user branch.
  - **Post-Cutscene Camera-Zoom `oppHpRowY` Guard**: Tracks `oppSlotBaselineHpRowY` in Section 1B, rejects upward camera-zoom row-Y distortion dips (`sampledOppHpRowY < 0.31h` or `>= 0.038h` above baseline), and fast-recovers (`>= 2` frames) from `<= 15%` false locks.
  - **Energy-Feasible `HP_DELTA` Move Inference & Retroactive Cost Sync**: Filters `HP_DELTA` candidate moves by `preThrowEnergy + oppFastEnergy` when a feasible move matches within `18%`, and recalculates `requiredMoveEnergy`, `energyDeficit`, and `expectedMoveDmgPct` when Section 1A retroactively updates `inferredMoveName`.
  - **Updated `Air Cutter` Stats & Post-KO Replacement Fast-Move Catch-Up**: Updated `Air Cutter` in `PokemonDatabase.kt` from legacy `60 power / 40E` to `45 power / 35E` (and added `Air Cutter` to `Charizard`'s fallback pool), and credited elapsed post-KO fast-move turns in `handleOpponentLines` when a replacement opponent's nameplate OCR resolves after an immediate charged move.

---

## v7.03 (2026-11-07) — 4-Button Replay Cards (`Watch + HUD`, `Star/Starred`, `Private/Public`, `Copy Link`), Per-Video Private Default & 5 Public Vault Visibility Modes
*Cloud DVR Replay Vault privacy & sharing controls release (`v7.03`, `versionCode = 1703`, Cloudflare Worker `v7.0.3`) adding a 4th per-video `🔒 Private` / `🌐 Public` toggle button to every replay card (defaulting all videos to `🔒 Private`), introducing 5 granular Public Vault Visibility modes on `/vault`, the Web Simulator, and Android App, and supporting vault-wide override when set to `All videos shared`.*

- **v7.03 — Enhancement 1: 4 Action Buttons per Replay Card & Per-Video `🔒 Private` Default (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`, `OverlayService.kt`)**:
  - Every replay card on `/vault` (and in the Android in-app DVR Replay toolbar) now provides 4 action buttons:
    1. **`▶️ Watch + HUD`**: Opens the interactive frame-synced `/watch/<shareId>` theater with live SilphScope HUD overlay.
    2. **`☆ Star` / `⭐ Starred`**: Toggles 365-day starred retention and starred showcase status (strictly owner-only).
    3. **`🔒 Private` / `🌐 Public` (New Button — Default `🔒 Private`)**: Toggles individual video public visibility (`isPublic: false` by default on all uploaded videos; strictly owner-only).
    4. **`🔗 Copy Link`**: Copies the direct `/watch/<shareId>` share URL to clipboard.
  - Added owner filter tabs on `/vault` for `🎬 All Replays`, `⭐ Starred`, `🌐 Public`, and `🔒 Private`.
- **v7.03 — Enhancement 2: 5 Public Vault Visibility Modes & `All Videos Shared` Override (`cloudflare/telemetry-worker/worker.mjs`, `src/App.tsx`, `MainActivity.kt`, `GitHubCloudSync.kt`)**:
  - Vault owners can now choose from **5 Public Vault Visibility modes** across `/vault`, the Web Simulator Membership & Vault modal, and Android App Settings:
    1. **`🔒 Private (Only shows ones manually made public)` (`public_only` — Default)**: Visitors without login only see videos manually toggled to `🌐 Public`.
    2. **`⭐ Starred only` (`starred_only`)**: Visitors without login only see `⭐ Starred` videos.
    3. **`⭐+🌐 Starred + Private (Starred or manually made public)` (`starred_and_public`)**: Visitors without login see any video that is either `⭐ Starred` OR manually toggled to `🌐 Public`.
    4. **`🌐 All videos shared (Overrides per-video private)` (`all`)**: Overrides individual per-video `🔒 Private` settings so all videos in the vault are shared publicly on the vault page.
    5. **`🚫 No videos shared without login` (`none`)**: Blocks unauthenticated access to the public vault page (`403` Owner Login required).

---

## v7.02 (2026-11-07) — Crisp 15 FPS 1.0x Real-Time H.264 DVR Encoding ($\le 30\text{ MB}$ at 240s), Legacy 3x Speed Auto-Compensation & 50% Default Overlay/Replay Opacity
*DVR video quality, real-time playback smoothness, and HUD visual ergonomics release (`v7.02`, `versionCode = 1702`, Cloudflare Worker `v7.0.2`) restoring crisp `544x1184` hardware H.264 recording at `15 FPS` (`720 kbps` CBR, `QP 27–38`, strictly $\le 30\text{ MB}$ for a full 240-second PvP timeout battle), eliminating 3.0× time-lapse MP4 compression while automatically compensating legacy `v6.45`–`v7.01` shared replays back to `1.0x` real-time speed, and standardizing default HUD opacity/transparency to `50%` across the live Android overlay, Web Simulator, in-app DVR replay player, and Cloud Replay `/watch` theater.*

- **v7.02 — Enhancement 1: Crisp `544x1184 @ 15 FPS` Real-Time Hardware H.264 DVR Encoding ($\le 30\text{ MB}$ for 240s Max Battle) (`BattleDvrEngine.kt`, `OverlayService.kt`)**:
  - **1:1 Wall-Clock MP4 Presentation Timestamps (`1.0x` Real-Time Speed)**: Removed `KEY_CAPTURE_RATE = 10` + `KEY_FRAME_RATE = 30` from `startDvrEncoderLocked` (which caused hardware AVC encoders to divide Surface presentation timestamps by `3.0` and play back 170s battles in 56.8s at `3.0x` speed). Recorded MP4 files now preserve exact 1:1 wall-clock duration and stay 100% frame-locked with `_deep_trace.jsonl`.
  - **Smooth `15 FPS` (`67ms`) Active DVR Capture Cadence**: Increased active battle DVR frame capture in `OverlayService.kt` from `100ms` (`~9.4 fps`) to `67ms` (`~15 fps`) while keeping ML Kit OCR throttled on its independent `250ms`/`750ms` cadence, eliminating `1.0x` playback stutter with zero game frame drops.
  - **Optimal Crispness vs. File Size (`544x1184`, `720 kbps` CBR, `QP 27–38`, $\le 30\text{ MB}$ at 240s)**: Restored `544x1184` vertical resolution with `KEY_BIT_RATE = 720_000` (`720 kbps` CBR) and hardware QP bounds `27–36 (I)` / `29–38 (P)`, delivering razor-sharp nameplate/damage text for bug analysis while keeping typical 170s battles at **~12–15 MB** and a maximum **240-second timeout battle at ~18–21.6 MB (strictly $\le 30\text{ MB}$)**.
- **v7.02 — Enhancement 2: Automatic `1.0x` Real-Time Speed Compensation for Legacy `v6.45`–`v7.01` Replays (`cloudflare/telemetry-worker/worker.mjs`, `MainActivity.kt`)**:
  - Both the Cloud Replay `/watch/<shareId>` web theater and the Android in-app DVR Replay Dialog automatically compare `_deep_trace.jsonl` wall-clock span against `video.duration` (`mp4TimeCompressionRatio = traceDur / videoDur`), scaling `video.playbackRate = selectedSpeed / mp4TimeCompressionRatio` so previously uploaded `v6.45`–`v7.01` replays automatically play back at true `1.0x` real-time speed with synchronized HUD overlays.
  - Changed the Android in-app DVR Replay Dialog default playback speed from `2.0x` to `1.0x`.
- **v7.02 — Enhancement 3: Standardized `50%` Default Opacity & Top-Left Below-Status-Bar Launch Position (`OverlayService.kt`, `MainActivity.kt`, `TaskerIntegration.kt`, `activity_main.xml`, `overlay.html`, `src/App.tsx`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - **Default Top-Left Overlay Position Below Status Bar (`getDefaultOverlayTopYOffsetPx`)**: On launch, the floating overlay now positions at `x = 0` and `y = statusBarHeight + 4dp` (using `WindowInsets.Type.statusBars() or displayCutout()` and `status_bar_height`), sitting flush at the top-left directly below the Android status bar so the top-left SilphScope minimize/exit icon is immediately touchable without dragging.
  - **Standardized `50%` Opacity Default**: Updated default Overlay Background Transparency/Opacity to **`50%`** across the Android floating overlay (`DEFAULT_OVERLAY_TRANSPARENCY_PCT = 50`, with one-time `v7.02` migration from untouched `72%` defaults), Web Simulator live HUD & Settings (`50% (Default)`), Android in-app DVR Replay (`50%`), and Cloud Replay `/watch/<shareId>` web player (`HUD 50%` default).

---

## v7.01 (2026-11-07) — Public & Starred-Only DVR Replay Vault Visibility, Strictly Owner-Only Star/Pin Controls & 3-Method Owner Login (`Username + Token`, `Username + Password`, `GitHub OAuth`)
*Cloud Replay Vault & Authentication release (`v7.01`, `versionCode = 1701`, Cloudflare Worker `v7.0.1`) introducing configurable Public / Starred-Only / Private DVR Vault visibility on `/vault?user=<username>` (and `/u/<username>`), strictly owner-only `⭐ Star / Pin` controls, and 3 owner login methods (`🔑 Username + Token`, `🔒 Username + Password`, and `🐙 GitHub OAuth Login`) across the Cloud DVR Vault, Web Simulator, and Android App.*

- **v7.01 — Enhancement 1: Configurable DVR Vault Visibility (`⭐ Starred Only` Default, `🌐 Public: All Replays`, `🔒 Private`) (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`, `src/App.tsx`)**:
  - **⭐ Starred Only (`starred_only` — Default)**: By default on `/vault?user=<username>` (or `/u/<username>`), anyone can view your **⭐ Starred (Pinned)** highlight battles without logging in, while your unstarred rolling battles remain private to you (preventing opponents from scouting all recent battles/teams).
  - **🌐 Public — All Replays (`all`)**: When enabled by the vault owner, anyone visiting `/vault?user=<username>` can browse both rolling and starred replays with `🎬 All Replays` and `⭐ Starred Only` filter tabs.
  - **🔒 Private — Owner Login Only (`private`)**: Visitors cannot view the `/vault?user=<username>` replay list without logging in as the owner.
  - **Direct Share Link (`/watch/<shareId>`) Always Viewable**: Any individual video whose direct `/watch/<shareId>` link you share is always viewable by anyone with the link, regardless of whether the video is starred or whether your vault page is set to `starred_only` or `private`.
- **v7.01 — Enhancement 2: Strictly Owner-Only `⭐ Star / Pin` & Vault Management (`cloudflare/telemetry-worker/worker.mjs`)**:
  - Public visitors (`isOwner === false`) can watch replays and inspect synchronized frame-by-frame telemetry traces, but can **never** star/unstar (`POST /v1/replays/pin`), change vault visibility (`POST /v1/replays/settings`), or delete replays (`DELETE /v1/replays/delete`).
- **v7.01 — Enhancement 3: 3-Method Owner Login (`🔑 Username + Token`, `🔒 Username + Password`, `🐙 GitHub Login`) (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`, `src/App.tsx`)**:
  - **`🔑 Username + Token`**: Sign in with Trainer Screen Name + `SSPVP-...` Unlock Key (plus optional Checkout Email claim).
  - **`🔒 Username + Password`**: Owners can set or update a password (`POST /v1/auth/set-password`, stored with salted HMAC-SHA256 in KV) from the Cloud Replay Vault, Web Simulator, or Android App Settings (`🔒 Web Password / Login`) and sign in with `Username + Password` on any device.
  - **`🐙 GitHub OAuth Login`**: 1-click GitHub OAuth Device Flow (`POST /v1/auth/github/device-code` & `POST /v1/auth/github/poll`) matching the Android app's GitHub OAuth identity (`178c6fc778ccc68e1d6a`).

---

## v7.00 (2026-11-07) — 4-Tier Membership & Cloud Replay Vault System, Stripe & Buy Me a Coffee Automated Webhooks, Day 15+ First-Season Promo, Anti-Spoofing Trainer ID Verification, Nemesis Meta Analyzer & APK Signing Key Capability Hardening
*Major milestone release (`v7.00`, `versionCode = 1700`) introducing the 4-tier Membership & Cloud Replay Vault ecosystem (`Free`, `Lifetime Supporter / Alumni`, `Legend Pro`, `VIP / Coach`), automated Stripe & Buy Me a Coffee (`💰 pokécoin`) webhook provisioning with Day 15+ first-season promotional pricing, anti-spoofing Trainer Screen Name pre-registration and HMAC-SHA256 offline license verification, Personal Nemesis & Blind-Spot Meta Analyzer + "What-If" Mid-Battle Simulator Branching, updated real gameplay DVR HUD screenshots, and Android APK Signing Key Rotation lineage hardening.*

- **v7.00 — Enhancement 1: 4-Tier Membership Ecosystem & Permanent Alumni Graduation (`cloudflare/telemetry-worker/worker.mjs`, `OverlayService.kt`, `GitHubCloudSync.kt`, `MainActivity.kt`, `src/App.tsx`)**:
  - **🆓 Free Community (`$0`)**: 100% full real-time combat HUD overlay, 9-shield matrix, fast-move turn cadence, and haptics forever; Current Season Battle Logs (+ 14-day post-season grace period & unlimited CSV/JSON export); 1 local DVR battle; Open Great League & Master League Anti-Meta Generator (1 team per archetype, standard movesets with `🔒 ⚡ Pro Alt Moveset` teaser badges).
  - **🏅 Lifetime Supporter / Alumni (`$3` One-Time or Automatic Graduation)**: Unlocks **Unlimited Lifetime Battle Log History & Multi-Device Sync** across all seasons, **5 local DVR battles**, **Open Ultra League** (Core 3: GL + UL + ML) with **2 teams per archetype**, and **365-day retention on pinned Cloud R2 replays**. Automatically granted forever whenever a user subscribes to Legend Pro or VIP even once!
  - **🏆 Legend Pro Pass (`$5/mo` or `$10/Season [90d]`)**: Unlocks **50 rolling Cloud R2 replays + 10 pinned replays**, **25 local DVR battles (5 full GBL sets)**, **All Limited/Mega/Retro/Battle Frontier Cups**, **Top 5 teams per archetype (15+ teams)**, **⚡ Alternate Moveset Role Synthesis (+BR Deltas)**, **🎯 Personal Nemesis & Blind-Spot Team Builder**, and **🌿 "What-If" Mid-Battle Simulator Branching**.
  - **👑 VIP / Coach Pass (`$10/mo` or `$20/Season [90d]`)**: Unlocks **150 rolling Cloud R2 replays (365-day retention) + 25 pinned replays**, **configurable 25–100 local DVR battle ring buffer slider**, and priority cloud processing.
- **v7.00 — Enhancement 2: Stripe & Buy Me a Coffee Automated Webhooks + Day 15+ First-Season Promo (`cloudflare/telemetry-worker/worker.mjs`, `MainActivity.kt`)**:
  - **Day 15+ First-Season Promotional Pricing (`/v1/users/checkout-quote`)**: Joining on Days 1–14 of a GBL Season (or renewing) charges the standard 90-day Season Pass (`$10` Pro / `$20` VIP). First-time buyers joining on **Day 15 or later** of a GBL Season pay only the **1-month rate (`$5` Pro / `$10` VIP)** to unlock the **entire remainder of the current GBL season** (strictly once per unique Trainer ID / Device / Email / GitHub ID).
  - **Automated Key Minting (`/v1/webhooks/stripe` & `/v1/webhooks/bmc`)**: Automatically mints and binds `SSPVP-<TIER>-XXXX-XXXX` keys upon Stripe Payment Link or Buy Me a Coffee checkout completion.
- **v7.00 — Enhancement 3: Anti-Spoofing Trainer ID Pre-Registration & 100% Offline HMAC License Cache (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `MainActivity.kt`)**:
  - **Pre-Payment Screen Name Verification (`/v1/users/register-name`)**: Prevents spoofing by never returning a paid license from a bare `screenName` alone, binding licenses to `deviceHash` / `githubUserId` / `claimEmail`, and allowing collision-safe activation via Checkout Email + Screen Name proof.
  - **One-Time Online Unlock $\to$ 100% Offline Operation**: Caches an HMAC-SHA256 verification token (`signature`) locally in `SharedPreferences` so all local features work 100% offline after a single verification.
- **v7.00 — Enhancement 4: Personal Nemesis & Blind-Spot Analyzer, Cloud DVR Theater & APK Lineage Hardening (`MainActivity.kt`, `src/components/MetaTab.tsx`, `src/App.tsx`)**:
  - **🎯 Personal Nemesis & Blind-Spot Analyzer**: Automatically identifies your top 3 highest-loss-rate opponent species in the Meta Tab with a 1-click **`🎯 Build Anti-Nemesis Team`** button.
  - **🎥 Cloud DVR Theater & 🌿 "What-If" Simulator Branching**: Added direct Cloud DVR Theater launch and 1-click mid-battle state branching into the interactive Web Simulator from any Battle Log row.
  - **Signing Key Rotation Capability Hardening**: Revoked `auth`, `permission`, `shared-uid`, and `rollback` capabilities on legacy `Signer #1` (`CN=GBL Battle Matrix`) in `silphscope-rotation.lineage` while preserving `--set-installed-data true` for seamless in-place APK upgrades.

---

> 📚 **Historical Releases (`v1.00` – `v6.51`)**: See [docs/CHANGELOG_ARCHIVE_v1_v6.md](./docs/CHANGELOG_ARCHIVE_v1_v6.md).
