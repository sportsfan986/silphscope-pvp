# SilphScope PvP — Complete Release Changelog (`v1.00` – `v6.51`)

---

## v6.51 (2026-11-06) — Super Mega Plus Move Level (`Off`, `Lv1..Lv4`) Selector, Asymmetric Player vs. Opponent Plus-Move Scaling & 9-Shield Matrix Integration
*Super Mega Plus Move Level release (`v6.51`, `versionCode = 1651`) adding per-slot Plus Move Level (`0 = Off/Not Unlocked`, `Lv1 = 1.0x`, `Lv2 = 1.1x`, `Lv3 = 1.2x`, `Lv4 = 1.3x`, default `Lv4`) across Android and Web Team Presets, applying your configured Plus Move Level to all player Charged Move damage calculations, 3x3 / 9-Shield Matchup Matrices, and Team Builder evaluations while always assuming opponents are at Plus Move Level 4 (`1.3x`).*

- **v6.51 — Enhancement 1: Per-Slot Super Mega Plus Move Level (`Off`, `Lv1`, `Lv2`, `Lv3`, `Lv4`) (`AppModels.kt`, `OverlayService.kt`, `dialog_create_preset.xml`, `MainActivity.kt`, `pokemonDb.ts`, `App.tsx`)**:
  - **Auto-Detected Plus Move Level Selector**: Whenever a Super Mega / Primal Pokémon with a fixed 3rd `+` move is selected in any Team Preset slot (Android Edit Team dialog or Web Edit Team modal), an interactive `[Off | Lv1 (1.0x) | Lv2 (1.1x) | Lv3 (1.2x) | Lv4 (1.3x)]` selector row automatically appears beneath that slot's moveset inputs with live effective power readout (e.g., `Volt Tackle+ • Lv4 (130p / 1.3x • 55E)`), defaulting to `Lv4`.
  - **Backward-Compatible Cloud Sync & Persistence**: Stored in `PokemonSlot.plusMoveLevel` (`Int? = 4`), `TeamMember.plusMoveLevel`, and `SyncTeamSlot.plusMoveLevel` so existing presets seamlessly default to `Lv4` while syncing across devices via GitHub Cloud Delta Sync.

- **v6.51 — Enhancement 2: Asymmetric Player vs. Opponent Plus Move Damage & 9-Shield Matrix Scaling (`PokemonDatabase.kt`, `TeamAndMetaEngine.kt`, `OverlayService.kt`, `combatSimulator.ts`)**:
  - **Player Plus Move Level Applied to Damage & Shield Matrix**: Scales your Super Mega `+` move base power by `getPlusMovePowerMultiplierStatic(plusMoveLevel)` (`Lv1 = 1.00x`, `Lv2 = 1.10x`, `Lv3 = 1.20x`, `Lv4 = 1.30x`) across live HUD `My Attacks` damage percentages, the 3x3 Matchup Matrix, the Top-200 9-Shield Matrix cache (`buildUserSlotCacheKey`), BMF/WAE analytics, and Team Builder / Role Upgrader / Moveset Optimizer simulations. Setting `Off (0)` completely excludes the 3rd `+` move from your simulations and HUD rows.
  - **Opponent Always Assumed Level 4 (`1.30x`)**: All opponent Super Mega / Primal Pokémon are always evaluated at maximum **Plus Move Level 4 (`1.30x`)** across incoming Charged Move damage math, Pillar 4 survival / Shield Call math, and 9-Shield Matrix ratings.

---

## v6.50 (2026-11-06) — Smart 3-Move Opponent Display (2 PvPoke + Highest-Risk Coverage), All-Possible-Moves Merged Shield Call HUD & Non-Blocking Bottom Overlay Touch Pass-Through
*Combat HUD, Shield Decision, and touch-ergonomics release (`v6.50`, `versionCode = 1650`) standardizing the Opponent Attacks HUD to 3 dynamically prioritized charged moves (PvPoke's 2 recommended moves + the highest KO/threat move among the next 3 most likely coverage moves at your live HP%, locking to 2 moves once 2 regular moves are confirmed), expanding the Shield Call HUD to evaluate all possible legal moves for that Pokémon until 2 moves are locked, merging the Shield Decision Card into the bottom of the main overlay, and making the bottom half of the overlay non-blocking (`FLAG_NOT_TOUCHABLE`) so taps pass straight through to Pokémon GO while keeping the 3-column Pokémon selector headers interactive.*

- **v6.50 — Enhancement 1: Smart 3-Move Opponent Display & Removal of Quantity Setting (`OverlayService.kt`, `PokemonDatabase.kt`, `overlay.html`, `activity_main.xml`, `combatSimulator.ts`)**:
  - **2 PvPoke Recommended + Highest-Risk 3rd Coverage Move (`selectOpponentThreeDisplayedMoves`)**: Always displays PvPoke's 2 recommended charged moves (`c1` & `c2`) plus the **1 move with the highest KO/threat score at your active Pokémon's live HP%** out of the next 3 most likely moves (`#3, #4, #5`), automatically re-evaluating when you swap Pokémon or your active HP% drops into KO range of a faster coverage move.
  - **Subtle Coverage Risk Badge (`.move-high-risk-badge` / `⚠️`)**: Highlights the 3rd dynamically selected coverage move so you can distinguish PvPoke's 2 recommended moves from the high-risk coverage move at a glance.
  - **1-Confirmed & 2-Confirmed Lock-In**: If 1 move outside the top 2 is confirmed in battle, displays that confirmed move alongside PvPoke's 2 recommended moves (3 moves total); once 2 regular moves are confirmed, locks to those 2 confirmed moves (plus any fixed Super Mega `+` move).
  - **Removed Charged Move Quantity Setting**: Retired the `3 vs 4 Charged Moves` toggle in Settings in favor of the unified smart 3-move display.

- **v6.50 — Enhancement 2: All-Possible-Moves Merged Shield Call HUD with Overflow Guard (`OverlayService.kt`, `overlay.html`, `BattleDvrEngine.kt`)**:
  - **Evaluates All Possible Legal Moves Until 2 Locked**: Until 2 regular moves are confirmed for the active opponent Pokémon, the Shield Call HUD evaluates **all legal charged moves** in that species' movepool (sorted by KO threat, damage %, and energy cost), locking to the 2 confirmed moves once known.
  - **Overflow Guard for Deep Movepools**: Displays up to 6 funded moves and up to 4 highest-threat unfunded moves, collapsing any additional lower-risk unfunded moves on deep-movepool Pokémon (e.g., Mew, Snorlax) into a compact `+N lower-risk unfunded moves in pool` summary row.
  - **Merged Bottom-of-Overlay Shield Call Card (`#sky-shield-decision-card`)**: Merged the Shield Call overlay directly into the bottom of the main overlay (`#mode-sky-trench`, stacked below the Tactical Coach) when an incoming opponent charged move is detected, retiring the separate floating `shieldDecisionOverlayView` window.
  - **Enhanced Telemetry & Deep Trace Logging (`AiTelemetryOppSlotSpec.candidateChargedMoves`, `BattleDeepTraceFrame.oppSlotConfirmedChargedMoves`)**: Records each opponent slot's candidate charged move pool and per-frame confirmed charged moves for 1:1 Web Replay Viewer parity.

- **v6.50 — Enhancement 3: Non-Blocking Bottom Half of Overlay with Selective Header Touch Forwarding (`OverlayService.kt`, `overlay.html`)**:
  - **Game-Safe Touch Pass-Through (`FLAG_NOT_TOUCHABLE` on `overlayView`)**: The entire bottom half of the overlay (`Opp Attacks` move rows, `My Attacks` move rows, Bottom Tactical Coach, and the merged Shield Call Card) now passes touches directly through to Pokémon GO so fast attacks, charge minigames, and Protect Shield taps are never blocked.
  - **Precision Touch-Forwarding Proxies (`topTouchZoneView`, `oppHeadersTouchView`, `myHeadersTouchView`)**: Keeps the top header/toolbar/3x3 matrix and the **3-column Pokémon selector headers** (`#sky-opp-dmg-headers` and `#sky-my-dmg-headers`) in the attack sections fully interactive and synchronized via `AndroidOverlay.updateInteractiveRegions(...)`.

---

## v6.46 (2026-11-06) — Post-Battle Bug Report Input Modal & Cancel Option in Floating HUD
*UX enhancement (`v6.46`, `versionCode = 1646`) adding a focusable `🚩 Submit DVR Issue Report` input modal with `Cancel Report` and `🚀 Submit Report` / `🚩 Flag Report` buttons whenever `🚩 Bug Report` is tapped in the post-battle HUD, matching the Battle Log issue-reporting workflow.*

- **v6.46 — Enhancement: Post-Battle HUD Bug Report Issue Note Input & Cancel Dialog (`OverlayService.kt`, `BattleDvrEngine.kt`, `overlay.html`)**:
  - **Focusable `🚩 Submit DVR Issue Report` Overlay Modal**: Tapping `🚩 Bug Report` in the post-battle HUD banner (`#auto-logged-banner`) or stopped-battle menu (`#start-battle-menu`) now opens a focusable native overlay dialog with an `EditText` input box (`"Describe what happened (e.g., missed opponent swap at 40s, HP spike, wrong move)"`), automatically pausing the 12-second background upload timer while typing.
  - **`🚀 Submit Report` / `🚩 Flag Report` & `Cancel Report` Actions**: Submitting attaches the custom issue description to the diagnostic DVR bundle (`submitManualDvrIssueReportBlocking` and `finalizeAndUploadOneBattleDvrAsync`), while tapping **`Cancel Report`** cleanly closes the modal without flagging the recording (and resumes normal background auto-upload if pending).

---

## v6.45 (2026-11-06) — Hardware H.264 QP & Rate-Control Encoder Tuning (~70% Smaller DVR Videos) & In-App Replay Defaults (`50%` Opacity, Full HUD, Top Position, `2.0x` Speed)
*DVR compression and in-app Replay UX update (`v6.45`, `versionCode = 1645`) tuning Android's hardware H.264 `MediaCodec` encoder (`KEY_VIDEO_QP_*`, `BITRATE_MODE_CBR`, `30fps` rate-control alignment with `10fps` capture rate, `4s` keyframe interval, and `480×1040` canvas) to reduce 3-minute battle MP4 sizes from `~26 MB` (`QP 23–27`) down to `~5–8 MB` (`QP 30–36`), and setting the in-app Replay player defaults to `50%` HUD opacity, Full HUD (`LIVE`), Top position, and `2.0x` playback speed.*

- **v6.45 — Enhancement 1: Android Hardware H.264 `MediaCodec` QP & Rate-Control Tuning (`BattleDvrEngine.kt`)**:
  - **Hardware QP Bounds (`KEY_VIDEO_QP_I_MIN = 30`, `KEY_VIDEO_QP_P_MIN = 32` + Qualcomm `vendor.qti-ext-enc-qp-range.*`)**: Prevents Android hardware encoders (`c2.qti.avc.encoder`) from locking at Blu-ray `QP 23–27` (`1.14 Mbps`) on smooth Pokémon GO frames, cutting P-frame byte size by ~70%.
  - **Surface Rate-Control & Keyframe Optimization**: Configured `KEY_BITRATE_MODE = BITRATE_MODE_CBR` (with automatic fallback), `KEY_BIT_RATE = 200_000`, `KEY_FRAME_RATE = 30`, `KEY_CAPTURE_RATE = 10`, `KEY_OPERATING_RATE = 10`, `KEY_I_FRAME_INTERVAL = 4`, and a `480×1040` canvas to eliminate the 3× 10fps/30fps hardware bit-budget multiplier.

- **v6.45 — Enhancement 2: Updated In-App Replay Defaults (`MainActivity.kt`)**:
  - **`50%` HUD Opacity (`🔆 50%`)**: Defaulted `hudAlphaPct = 50` (`alphaSteps = [50, 75, 92, 35]`) so the battle video remains clearly visible underneath the live HUD.
  - **Full HUD (`👁️ HUD: LIVE`) & Top Position (`⬆️ Pos: Top`)**: Defaulted video replay mode to the full interactive `LIVE` HUD positioned at the top of the screen (`isHudTop = true`).
  - **`2.0x` Default Playback Speed (`2.0x`)**: Defaulted `speedIdx = 3` (`2.0f`) and automatically applied `PlaybackParams().setSpeed(2.0f)` upon starting playback.

---

## v6.44 (2026-11-06) — Always-On DVR Frame Recording Gate Fix, Persistent Upload Coroutine Scope, Post-Battle Delete Banner & Wi-Fi/VPN Network Detection Fix
*Critical hotfix release (`v6.44`, `versionCode = 1644`) resolving why `v6.43` did not record or upload battle DVR videos.*

- **v6.44 — Fix 1: Always-On DVR Frame Recording Gate (`OverlayService.kt`)**:
  - **Root Cause**: The 10Hz frame capture loop (`OverlayService.kt:5445`) checked `(activeOneBattleDvrArmed || (activeShowOneBattleDvrBtn && hasCustomScreenNameForVideoLoggingStatic(prefs)))`. Because `v6.43` retired the manual start/stop DVR button (`activeShowOneBattleDvrBtn = false`) in favor of `activeAlwaysOnDvrEnabled = true`, that condition evaluated to `false` on every frame and no video frames were encoded.
  - **Fix**: Updated the frame capture condition to `(activeAlwaysOnDvrEnabled || activeOneBattleDvrArmed) && !isWaitingForOpponent && activeOpponentName != "Waiting..."` and ensured `startNewBattle()` cleanly resets any stale unlogged DVR state before a new match begins.

- **v6.44 — Fix 2: Always-On DVR Auto-Upload & Persistent Upload Coroutine Scope (`BattleDvrEngine.kt`, `OverlayService.kt`, `GitHubCloudSync.kt`)**:
  - **Always-On DVR Auto-Upload**: Updated `finalizeAndUploadOneBattleDvrAsync()` so `shouldUploadDiag` triggers automatically on all valid `>= 10s` battles when `activeAlwaysOnDvrEnabled` is enabled (`diagReason = "Always-On Auto DVR"`), as well as on manual `🚩 Bug Report` flags and R2 Replay Vault uploads.
  - **Persistent `dvrUploadScope` Across Service Lifecycle**: Moved the 12-second pre-upload delete-window coroutine and manual `flagLastBattleDvrBugReportFromOverlay` job from `lifecycleScope` to a persistent `OverlayService.dvrUploadScope` (`SupervisorJob() + Dispatchers.IO`), and deferred `dvrThread.quitSafely()` in `onDestroy()` until queued `dvrHandler` finalization tasks finish—ensuring uploads are never cancelled if the player stops the overlay or switches to the Battle Log within 12 seconds of battle end.
  - **Post-Battle Delete / Bug Report HUD Banner (`waitingPayload`)**: Added `"hasDvr"`, `"dvrDeleted"`, `"dvrBugReported"`, `"dvrUploadStatus"`, and `"stoppedBattleHasDvr"` to `waitingPayload` in `buildBattlePayloadJson()` so the post-battle `🗑️ Delete Video` / `🚩 Bug Report` prompt renders immediately when a battle is logged and the HUD returns to `"Waiting..."`.
  - **Wi-Fi + VPN Network Detection (`isDvrUploadAllowedOnCurrentNetworkStatic`)**: Prioritized `TRANSPORT_WIFI` / `TRANSPORT_ETHERNET` ahead of `TRANSPORT_CELLULAR` so active VPN tunnels over Wi-Fi are never falsely treated as metered cellular connections.

---

## v6.43 (2026-11-06) — Always-On DVR by Default, `<10s` / Non-Battle Clip Filter, Post-Battle Delete & Bug Report Prompt, Wi-Fi Default Upload & Private AES-256-GCM Encrypted Unlock Key Sync
*DVR workflow, Replay parity, and multi-device security release (`v6.43`, `versionCode = 1643`) enabling Always-On DVR by default (with no start/stop HUD button required), automatically discarding short (`<10s`) or non-battle clips, adding a post-battle prompt to delete recordings before upload or flag a bug report, defaulting DVR uploads to Wi-Fi with an opt-in Mobile Data toggle, aligning the Web Share viewer HUD (`overlay.html?replay=1`) 1:1 with the in-app HUD (with Top default position and Shield Decision Overlay enabled by default), and securing multi-device Unlock Key sync inside a private per-user GitHub vault (`silphscope-private-vault`, `"private": true`) encrypted with AES-256-GCM bound to the logged-in GitHub account.*

- **v6.43 — Enhancement 1: Always-On Battle DVR by Default & Automatic `<10s` / Non-Battle Discard (`OverlayService.kt`, `BattleDvrEngine.kt`, `MainActivity.kt`, `activity_main.xml`)**:
  - **Always-On DVR by Default (`PREFS_KEY_ALWAYS_ON_DVR_ENABLED = true`)**: Automatically records battles in the background unless disabled in Settings (`🎥 Always-On Battle DVR: ON/OFF`), removing the manual in-overlay start/stop/arm DVR button.
  - **Automatic `<10s` & Non-Battle Clip Filter**: Immediately aborts and deletes any recording shorter than `10 seconds`, with fewer than `15` frames, or without actual combat activity (`oppTeamSpecs.isEmpty()` and no HP/move/turn changes) so non-battle clips are never saved or uploaded.

- **v6.43 — Enhancement 2: Post-Battle Delete Prompt, `🚩 Bug Report` Flag & Wi-Fi Default Upload (`OverlayService.kt`, `BattleDvrEngine.kt`, `GitHubCloudSync.kt`, `overlay.html`, `MainActivity.kt`)**:
  - **Post-Battle HUD Prompt (`🗑️ Delete Video` & `🚩 Bug Report`)**: Displays a post-battle DVR bar with a 12-second pre-upload window allowing the player to delete a recording before upload (`deleteLastBattleDvrFromOverlay`) or immediately flag and submit a diagnostic bug report (`flagLastBattleDvrBugReportFromOverlay`), plus a `🗑️ Delete` button in the Replay viewer toolbar.
  - **Wi-Fi Default Upload + Opt-In Mobile Data Toggle (`PREFS_KEY_ALLOW_MOBILE_DATA_DVR_UPLOAD = false`)**: Enforces unmetered/Wi-Fi connectivity (`ConnectivityManager`) for DVR video uploads by default, with an opt-in `📡 Mobile Data Upload: OFF (Wi-Fi)` / `📶 Mobile Data Upload: ON` toggle in Settings.

- **v6.43 — Enhancement 3: Private GitHub Vault & AES-256-GCM Encrypted Multi-Device Unlock Key Sync (`GitHubCloudSync.kt`, `MainActivity.kt`, `cloudflare/telemetry-worker/worker.mjs`)**:
  - **Strictly Private Per-User GitHub Vault (`<username>/silphscope-private-vault`, `"private": true`)**: Stores multi-device sync vaults in a private GitHub repository (with verified `"private": true` enforcement and automatic migration/cleanup of legacy `sync-vault` branches) or a verified private Gist (`"public": false`).
  - **Authenticated AES-256-GCM Unlock Key Encryption (Logged-In Users Only)**: Encrypts `PREFS_KEY_REPLAY_UNLOCK_KEY`, license tier, and R2 Replay Vault metadata using `PBKDF2WithHmacSHA256` + `AES/GCM/NoPadding` (`ENC_GCM_V1:...`) bound to the logged-in user's immutable GitHub User ID and username as AAD, and binds the Unlock Key to the owner's GitHub identity on the Cloudflare Worker (`/v1/license/verify`) so no other user can decrypt or use a synced key.
  - **1:1 Web Share Viewer & In-App Replay HUD Parity (`overlay.html`, `cloudflare/telemetry-worker/worker.mjs`, `scripts/generate-worker-overlay.mjs`)**: Replaced the custom web canvas HUD with the exact `overlay.html?replay=1` HUD in `/watch/<shareId>`, added a 3.5s safety fallback for trace loading, and enabled the Shield Decision Overlay and Top HUD position by default across both in-app Replay and Web Share Player.

---

## v6.42 (2026-11-06) — In-App DVR Video + 4-Mode Live HUD Replay Player, Cloudflare R2 Replay Vault (`9.0 GB` Free-Tier Guard), Tiered Unlock Keys & Web Share Site (`/watch/<shareId>`)
*Full-stack DVR Video Replay, Cloud R2 Vault, and Web Sharing release (`v6.42`, `versionCode = 1642`) introducing an in-app DVR Video + 4-Mode Interactive HUD Replay player in the Battle Log, automatic `420 kbps` (`~10–12 MB/battle`) local ring-buffer recording, manual `🚩 Submit Issue Report` on any recorded battle, Cloudflare R2 Replay Vault with a strict `9.0 GB` zero-cost hard cap, tiered Replay Unlock Keys (`Free`, `Base / Trainer`, `Pro / Legend`, `VIP / Admin`) with Buy Me a Coffee webhook + Admin CLI (`scripts/manage-keys.mjs`), and a standalone Web Share Player (`/watch/<shareId>`) with Discord/Telegram OpenGraph video embeds and client-side HUD video export.*

- **v6.42 — Enhancement 1: In-App DVR Video + 4-Mode Live HUD Replay Player (`MainActivity.kt`, `BattleDvrEngine.kt`, `OverlayService.kt`, `overlay.html`)**:
  - **Synchronized Video + Live HUD Stage**: Added **`🎥 Watch DVR Video`** mode directly inside the Battle Log Replay modal (`showInteractiveBattleReplayDialog`), rendering the recorded battle `.mp4` (from local device storage or streamed via Cloudflare R2 `HTTP 206` Range requests) underneath a transparent `overlay.html?replay=1` WebView driven by `applyDeepTraceFrameForReplay(frame)`.
  - **4 Live-Toggleable HUD Modes (`👁️ HUD: LIVE | COMPACT | DIAG | OFF`)**:
    - `LIVE`: Full interactive 3x3 Matchup Matrix, 9-Shield badge, Fast-Move Pacing bars, Stat Stage pills, and 2-Line AI Tactical Coach.
    - `COMPACT`: Top Mirrored Header (`[Stat, HP, E, 🛡️] | [🛡️, E, HP, Stat]`) + 2-Line AI Coach only, keeping 85%+ of the battle video unobstructed.
    - `DIAG`: Displays live Raw vs. Committed HP %, Charge Circle Fill %, Energy Source, and OCR text lines for frame-accurate debugging.
    - `OFF`: Clean unobstructed gameplay video.
  - **Frame-Step, Speed, Scrubber, Event Jump Chips & "What-If" Pause Inspection**: Includes `⏮ -1F` / `⏭ +1F` frame-step buttons, `0.25x / 0.5x / 1.0x / 2.0x` playback speed selector, timeline `SeekBar`, clickable event jump chips (`⚡ Charged Moves`, `🔄 Swaps`, `💀 KOs` seeking to `t - 2.0s`), `⬇️ Bottom / ⬆️ Top` HUD position toggle, live Opacity cycler (`92% / 75% / 55% / 35%`), and interactive **"What-If" Matrix inspection while paused**.

- **v6.42 — Enhancement 2: Auto-DVR Local Ring Buffer (`420 kbps`), `🚩 Submit Issue Report` & Smart Diagnostic Uploads (`BattleDvrEngine.kt`, `GitHubCloudSync.kt`, `MainActivity.kt`)**:
  - **Crisp `420 kbps` (`~10–12 MB/battle`) Auto-DVR**: Tuned `MediaFormat.KEY_BIT_RATE` to `420_000` at `544p` `10fps` and automatically records every battle when DVR is enabled into `filesDir/dvr_replays/` (`1` rolling battle for Free Tier; `10` rolling battles + ⭐ Pinned battles up to `300 MB` for Unlocked Tiers).
  - **Smart Diagnostic Upload + Manual `🚩 Report Issue` Button**: Auto-uploads to the diagnostic Telegram pipeline (`/v1/dvr`) when a `HIGH`-severity anomaly is detected or when manually flagged in-battle, and adds a **`🚩 Report Issue`** button in the Replay modal (available on all tiers, including Free Tier) so users can attach a custom note and submit any recorded battle video + trace to Telegram on demand.

- **v6.42 — Enhancement 3: Cloudflare R2 Replay Vault (`9.0 GB` Hard Cap), Tiered Unlock Keys & Web Share Site (`cloudflare/telemetry-worker/worker.mjs`, `scripts/manage-keys.mjs`)**:
  - **Cloudflare R2 Replay Vault (`silphscope-replays`) & `9.0 GB` Zero-Cost Hard Cap**: Stores user replay videos and traces in Standard R2 with a strict `9.0 GB` global hard cap (`GLOBAL_MAX_R2_STORAGE_GB = "9.0"`) so storage never exceeds Cloudflare's `10 GB/mo` free tier (`$0.00` egress).
  - **Subscription Tiers, Buy Me a Coffee Webhook & Admin Key CLI**: Added `Free` (`1` local), `Base / Trainer` (`10` rolling + `5` ⭐ Pinned, `7d`, `500 MB`), `Pro / Legend` (`50` rolling + `10` ⭐ Pinned, `30d`, `2 GB`), and `VIP / Admin` (`150` rolling + `25` ⭐ Pinned, `365d`, `4 GB`) tiers, multi-device Debug ID binding (`/v1/license/verify`), automated Buy Me a Coffee webhook key minting (`/v1/webhooks/bmc`), and the `scripts/manage-keys.mjs` CLI.
  - **Public Web Share Player (`GET /watch/<shareId>`)**: Added `🔗 Share` in the Replay modal producing capability URLs (`https://silphscope-telemetry.silphscope-pvp.workers.dev/watch/<shareId>`) with Discord/Telegram `og:video` embeds, Side-by-Side vs. Overlaid HUD toggle, `🕵️ Hide Names` privacy mode, client-side `💾 Export Video + HUD`, and a direct `🚀 Open Full Simulator` link.

---

## v6.41 (2026-11-06) — Minimal Corner Frame-Index DVR Pill (`#0042`), Local FFmpeg ASS HUD Re-Burn & Multi-Part (`>24 MiB`) Cloudflare Worker KV Chunking
*Video playback clarity, local FFmpeg preprocessing speed (~30x faster), and large-video upload reliability release (`v6.41`, `versionCode = 1641`) replacing the full-width top DVR video watermark with a tiny `42px × 14px` top-left corner frame-index pill (`#0042`) for clean Telegram playback while burning the full telemetry HUD banner back into local diagnostic keyframes/contact sheets via FFmpeg ASS subtitles.*

---

## v6.40 (2026-11-06) — Real-Time Attack/Defense Stat Stage Tracking (`[-4..+4]`), Spatial ML Kit OCR Buff/Debuff Parser, Mimikyu Busted-Form Persistence & Swap-In Reminder Guard, Stat Stage HUD Pills & Post-Charge Screenshot Validation
*Major combat-math and computer-vision upgrade (`v6.40`, `versionCode = 1640`) introducing a dual-layer Attack/Defense stat stage tracking engine (`[-4..+4]`), live stage-adjusted damage/KO/shield-call math, Pokémon GO switch-out stage clearing with Mimikyu Busted-Form `-1 Defense` persistence and swap-in GUI reminder protection, compact Stat Stage HUD pills replacing CP pills, and automated post-charge screenshot extraction in the telemetry preprocessor.*

- **v6.40 — Enhancement 1: Dual-Layer Real-Time Attack & Defense Stat Stage Engine (`[-4..+4]`) (`OverlayService.kt`, `PokemonDatabase.kt`, `src/data/pokemonDb.ts`)**:
  - **Layer 1 (Deterministic `100%`-Chance Moves + Mimikyu Disguise Bust)**: Expanded `BASELINE_MOVE_BUFF_EFFECTS` across all guaranteed (`chance >= 0.99`) and probabilistic (`0.10..0.66`) PvP moves (`Icy Wind`, `Feather Dance`, `Lunge`, `Chilling Water`, `Rock Tomb`, `Sand Tomb`, `Bulldoze`, `Poison Fang`, `Psychic Fangs`, `Acid Spray`, `Glaciate`, `Mystical Fire`, `Brick Break`, `Bubble Beam`, `Memento`, `Obstruct`, `Rage Fist`, `Power-Up Punch`, `Flame Charge`, `Trailblaze`, `Triple Axel`, `Torch Song`, `Aura Wheel`, `Fell Stinger`, `Drain Punch`, `Parabolic Charge`, `Skull Bash`, `Iron Defense`, `Acid Armor`, `Geomancy`, `Close Combat`, `Wild Charge`, `Brave Bird`, `Superpower`, `Overheat`, `Draco Meteor`, `Psycho Boost`, `Leaf Storm`, `V-create`, `Dragon Ascent`, `Clanging Scales`, `Volt Tackle`, plus all probabilistic moves). Automatically applies guaranteed stage deltas when a charged move resolves (shielded or unshielded) and applies `-1 Defense` when an intact Mimikyu's Disguise is busted.
  - **Layer 2 (Spatial ML Kit OCR Buff/Debuff Callout Parser)**: Expanded `srcMidBanner` bottom from `0.53h` to `0.66h` so both the Opponent (`screenYNorm < 0.46f`) and Player (`screenYNorm >= 0.47f`) floating HP bar callout zones (`"ATTACK ROSE!"`, `"DEFENSE FELL!"`, `"ATTACK HARSHLY FELL!"`, `"DEFENSE SHARPLY ROSE!"`, etc., across EN/IT/ES/PT/FR/DE) are scanned on every OCR frame, capturing all probabilistic (`10%–66%`) buff/debuff procs and reconciling with Layer 1 via per-side/per-stat epoch deduplication.

- **v6.40 — Enhancement 2: Pokémon GO Switch-Out Clearing & Mimikyu Busted-Form Persistence + Swap-In GUI Reminder Guard (`OverlayService.kt`, `PokemonDatabase.kt`, `src/data/combatSimulator.ts`)**:
  - **Standard Switch-Out Stage Clearing**: Switching a Pokémon out or fainting resets its `atkStage` and `defStage` to `0`.
  - **Mimikyu Busted-Form `-1 Defense` Persistence**: When an alive Mimikyu with `disguiseBusted == true` switches out, its `-1 Defense` stage (`0.80x` Defense / `1.25x` incoming damage) persists across switches (`atkStage = 0, defStage = -1`).
  - **Mimikyu Swap-In GUI Reminder Guard**: Validated against telemetry video `log-1793968715431-556` (`F#1115–1128`), when a Busted-Form Mimikyu swaps back in and Pokémon GO displays the `"DEFENSE FELL!"` visual reminder above its HP bar within `6.0s` of switch-in (with no charged move resolved since switch-in), the engine recognizes it as the Busted-Form status reminder (`disguiseBusted = true`, `defStage = min(defStage, -1)`) and prevents double-decrementing Defense from `-1` to `-2`.

- **v6.40 — Enhancement 3: Stage-Aware Damage/KO Indicators, Shield Call Math & Floating HUD Stat Stage Pills (`OverlayService.kt`, `overlay.html`, `BattleDvrEngine.kt`, `scripts/ingest-telemetry.mjs`, `scripts/telemetry-preprocess-config.json`)**:
  - **Live Damage, KO & Pillar 3/4 Shield Call Math**: Wired `getPvpStageMultiplierStatic(stage)` (`(4+s)/4` for $s \ge 0$, `4/(4-s)` for $s < 0$) into `calculateChargedMoveDamagePercent`, `calculateFastMoveExactDamagePercent`, `calculateFastMoveDamagePercent`, `ShieldOverlayMoveRow`, Pillar 3 (`myFastsToKoOpp`, `oppFastsToKoMe`, `canFarmDownBeforeOppMove`), Pillar 4 (`SHIELD_CALL`, `oppBaitKosActive`, `oppNukeKosActive`, `safeToTankAllMoves`, `postHitHpAfterPrimaryMove`, `canTankAndReachNextMove`), and live `slotBrAgainst` matchup ratings.
  - **Floating HUD Stat Stage Pills (`#sky-player-stat-pill` & `#sky-opp-stat-pill`)**: Removed live OCR CP detection and replaced the top-header CP pills with compact, color-coded Stat Stage badges (`A+1`, `D-1`, `🎭D-1`, `A+1 D-1`) in the mirrored header (`[Stat, HP, E, 🛡️] | [🛡️, E, HP, Stat]`).
  - **DVR Trace & Post-Charge Screenshot Validation (`scripts/ingest-telemetry.mjs`, `scripts/telemetry-preprocess-config.json`)**: Added `userAtkStage`, `userDefStage`, `userDisguiseBusted`, `oppAtkStage`, `oppDefStage`, `oppDisguiseBusted` to `BattleDeepTraceFrame` and the burned-in DVR watermark, extended `chargedMoveTransitions.exitPostFrames` to `24` with full-resolution post-cutscene keyframes around every charged move, and added the dedicated `03b_buff_debuff` capture rule.

---

## v6.29 (2026-11-06) — Resilient DVR & Telemetry DNS Resolver (`AAAA ::` Sinkhole Bypass, DoH + Edge IPv4 Fallback) & Automatic Queued DVR Video Recovery
*Network resilience and DVR upload recovery release (`v6.29`, `versionCode = 1629`, branched from `v6.28`) fixing `"Unable to connect to silphscope-telemetry.silphscope-pvp.workers.dev"` errors caused by router/ISP/Private DNS returning unspecified `AAAA ::` (`0:0:0:0:0:0:0:0`) IPv6 sinkholes for `*.workers.dev`, and automatically recovering/uploading any queued 1-Battle DVR recordings stored in `cacheDir`.*

- **v6.29 — Fix 1: `TELEMETRY_RESILIENT_DNS` Resolver (`AAAA ::` Filtering, IPv4 Priority, `1.1.1.1` DoH & Cloudflare Anycast IPv4 Edge Fallbacks) (`GitHubCloudSync.kt`)**:
  - **Root Cause**: Router/ISP and Private DNS servers that disable IPv6 or filter `*.workers.dev` return `AAAA ::` (`0:0:0:0:0:0:0:0`, TTL 2) alongside valid `A` records (`104.21.76.162`, `172.67.197.119`). On Android dual-stack interfaces, `Dns.SYSTEM` placed `::` first, causing OkHttp to attempt connecting to `[::]:443` (localhost) and fail with `ConnectException: Failed to connect to silphscope-telemetry.silphscope-pvp.workers.dev/0:0:0:0:0:0:0:0:443`.
  - **Fix**: Added `TELEMETRY_RESILIENT_DNS` and `buildTelemetryHttpClientStatic()` across all 3 telemetry endpoints (`/v1/dvr`, `/v1/telemetry`, `/v1/settings-changes`) to strip unspecified/loopback addresses (`::`, `0.0.0.0`, `127.0.0.1`), sort `Inet4Address` ahead of `Inet6Address`, query Cloudflare DoH (`https://1.1.1.1/dns-query`) if system DNS is blocked, and append verified Cloudflare anycast IPv4 edge routes (`104.21.76.162`, `172.67.197.119`) with a 3-attempt backoff retry loop (`HTTP/1.1`).

- **v6.29 — Fix 2: Automatic Recovery & Upload of Queued 1-Battle DVR Videos in `cacheDir` (`GitHubCloudSync.kt`, `BattleDvrEngine.kt`, `MainActivity.kt`, `OverlayService.kt`)**:
  - **Persistent DVR Header & Auto-Recovery (`retryPendingCachedDvrBundlesBlocking`)**: Persists the `BATTLE_DVR_SUMMARY_HEADER` inside `*_deep_trace.jsonl` before upload and scans `cacheDir` for any un-uploaded `*_video.mp4` + `*_deep_trace.jsonl` pairs (including DVR recordings from `v6.28` that failed to connect), automatically uploading them on app launch/resume, on `☁️ Upload AI Logs` tap, and after subsequent DVR battles.

---

## v6.28 (2026-11-06) — Pre-Battle Overlay DVR Button Visibility, Unique Debug ID (Random vs. Custom ID for Video Logging) & 5-Minute Local FFmpeg Telemetry Preprocessor
*UX, privacy, and local telemetry preprocessing upgrade (`v6.28`, `versionCode = 1628`) ensuring the 1-Battle DVR button is visible immediately upon overlay startup and `Start Battle` press (before the opponent Pokémon spawns), updating the Trainer / Debug ID flow with a 1-tap Random Unique ID generator while requiring a custom (non-random) ID for 1-Battle DVR video logging, removing all UI mentions of Telegram, and adding a 5-minute zero-token local Windows background sync + FFmpeg keyframe/contact-sheet preprocessor.*

- **v6.28 — Fix 1: Overlay 1-Battle DVR Button Visible Immediately on Startup & `Start Battle` Press (`OverlayService.kt`, `overlay.html`)**:
  - **Root Cause**: When `isWaitingForOpponent || activeOpponentName == "Waiting..."` was true (both when the overlay first launched and after pressing `⚔️ Start Battle` during matchmaking/countdown before the opponent Pokémon spawned), `buildBattlePayloadJson()` returned `waitingPayload` without `"showOneBattleDvrBtn"`, `"isOneBattleDvrArmed"`, `"isOneBattleDvrRecording"`, or `"oneBattleDvrFrames"`, causing `#btn-dvr-rec-one` to remain hidden until the opponent Pokémon was detected mid-battle.
  - **Fix**: Added `"showOneBattleDvrBtn"`, `"isOneBattleDvrArmed"`, `"isOneBattleDvrRecording"`, and `"oneBattleDvrFrames"` to `waitingPayload`, synced preferences on `startNewBattle()`, and preserved DVR state in `overlay.html` so players can arm 1-Battle DVR before combat begins without interfering with fast-move taps.

- **v6.28 — Enhancement 2: Unique Debug ID Subtext, 1-Tap Random ID Generator & Custom ID Requirement for Video Logging (`OverlayService.kt`, `MainActivity.kt`, `BattleDvrEngine.kt`, `GitHubCloudSync.kt`, `activity_main.xml`, `src/App.tsx`)**:
  - **Clarified Unique Debug ID & Removed Telegram References**: Updated all UI cards, prompts, and status labels to clarify that the ID is a unique identifier for diagnostic debug logs (not required to be the user's actual Pokémon GO screen name) and removed all mentions of Telegram from the app UI.
  - **1-Tap Random Unique ID Generator (`🎲 Random ID`)**: Added a `🎲 Random ID` button in both the first-run setup dialog and the Settings `Trainer / Debug ID` card (`generateRandomDebugIdStatic()`, e.g., `ID_7K4M9P`), allowing instant anonymous setup for standard app/overlay usage and debug log uploads.
  - **Custom (Non-Random) ID Required for 1-Battle DVR Video Logging**: Gated `Show 1-Battle DVR Button in Overlay`, `Arm 1-Battle DVR`, and `toggleArmOneBattleDvrFromOverlay()` on `hasCustomScreenNameForVideoLoggingStatic(prefs)`, prompting users on a random ID to enter a custom handle if they wish to enable 1-Battle DVR video recording.

- **v6.28 — Enhancement 3: 5-Minute Zero-Token Local Background Telemetry & FFmpeg Video Preprocessor (`scripts/ingest-telemetry.mjs`, `scripts/telemetry-preprocess-config.json`, `scripts/install-local-telemetry-task.ps1`)**:
  - **5-Minute Scheduled Sync (`SilphScope-Telemetry-Sync`)**: Added a hidden Windows Scheduled Task running `node scripts/ingest-telemetry.mjs --sync-only --prune-remote` every 5 minutes using 100% local PC resources (`0` AI tokens) with a `1.0 GB` local cache auto-pruner.
  - **Configurable FFmpeg Event Keyframes & Contact Sheets (`scripts/telemetry-preprocess-config.json`)**: Automatically generates `6x4` (`24`-frame) tiled contact sheets plus individual annotated JPEG keyframes for Battle Start, Charged Move In/Out transitions, Large HP Changes & Animations, Swaps, Energy Shifts, and Battle End while preserving full `.mp4` videos locally for deep analysis.

---

## v6.27 (2026-11-06) — Cloudflare Worker + Telegram Telemetry & 1-Battle DVR Architecture, Required Trainer Screen Name & Full Settings Cloud Sync
*Architecture and multi-user telemetry upgrade (`v6.27`, `versionCode = 1627`) replacing GitHub for all telemetry and 1-Battle DVR video uploads with a dedicated Cloudflare Worker + Cloudflare Storage + Telegram Channel (`SilphScope DVR`) pipeline, requiring a Trainer Screen Name before overlay startup, and expanding GitHub Cloud Sync to include App Settings alongside Battle Logs and Teams.*

- **v6.27 — Enhancement 1: Cloudflare Worker + Cloudflare Storage + Telegram Channel (`SilphScope DVR`) Pipeline (`cloudflare/telemetry-worker/worker.mjs`, `GitHubCloudSync.kt`, `BattleDvrEngine.kt`, `scripts/ingest-telemetry.mjs`)**:
  - **Single-Upload Multi-User Telemetry & DVR Ingestion**: Deployed `https://silphscope-telemetry.silphscope-pvp.workers.dev` backed by Cloudflare storage (`TELEMETRY_KV` / R2 adapter). The Android app uploads Always-On AI Telemetry batches (`POST /v1/telemetry`), Settings Change History (`POST /v1/settings-changes`), and 1-Battle DVR bundles (`POST /v1/dvr`: `_video.mp4` + `_deep_trace.jsonl`) directly to Cloudflare in a single request with zero GitHub authentication required.
  - **Asynchronous Telegram DVR & Anomaly Mirroring**: On every 1-Battle DVR upload and high-anomaly batch, the Cloudflare Worker asynchronously forwards the playable H.264 MP4 video, formatted match summary caption, and `_deep_trace.jsonl` document directly to the private `SilphScope DVR` Telegram channel (`@silphscope_pvp_bot`) for instant mobile/desktop viewing.
  - **Cloudflare-Native PC Ingestion Script**: Updated `scripts/ingest-telemetry.mjs` to pull all telemetry batches, settings change logs, and 1-Battle DVR recordings exclusively from the Cloudflare Worker Admin API (`/v1/admin/*`) with `--prune-remote` support.

- **v6.27 — Enhancement 2: Required Trainer Screen Name & Full Settings Multi-Device Sync (`OverlayService.kt`, `MainActivity.kt`, `TaskerIntegration.kt`, `GitHubCloudSync.kt`, `activity_main.xml`)**:
  - **Mandatory Trainer Screen Name (`PREFS_KEY_USER_SCREEN_NAME`)**: Added a required Trainer Screen Name profile (`3–24` characters: letters, numbers, `_`, or `-`) enforced via a first-run setup prompt and Settings card before starting the overlay (`MainActivity` and `TaskerIntegration`), tagging all telemetry and DVR uploads by trainer without requiring GitHub sign-in.
  - **GitHub Cloud Sync Scoped to Battle Logs, Teams & App Settings**: Removed all GitHub telemetry/DVR/Issue-relay code from `GitHubCloudSync.kt` and upgraded `SyncVaultPayload` (`schemaVersion = 3`) with `exportSyncableSettingsMapStatic()` and `applySyncedSettingsMapStatic()` so optional GitHub Cloud Sync reconciles Battle Logs, Teams, and App Settings across a user's devices.

---

## v6.26 (2026-11-06) — 1-Battle DVR Video Telemetry Fixes: `GOOD EFFORT!` Auto-Loss Line Order, Async OCR Pixel-Frame Deduplication, `Tinkaton` Yellow HP & Depleted-Track Pink-Bow Classification, `0.45h` Player HP Corridor & Pre-Charge Zoom Sag Guard
*Precision combat-vision and state-machine release (`v6.26`, `versionCode = 1626`) resolving all root causes identified in the `v6.24` 1-Battle DVR video recordings (`log-1793968715431-556`, `log-1793968208598-642`, and `log-1793939224890-209`) and companion telemetry batches.*

- **v6.26 — Fix 1: Auto-End-of-Battle (`GOOD EFFORT!` / `YOU WIN!`) Vertical OCR Line Ordering & Stale `pendingChargedAttackActor` Expiry (`OverlayService.kt`)**:
  - **Root Cause**: On the `GOOD EFFORT!` screen (`F#1874..1929`), `"GOOD"` sits in `midBannerLines` (`< 0.53h`) while `"EFFORT!"` and `"NEXT BATTLE"` sit in `playerMoveLines` (`> 0.53h`). Because `checkAndHandleAutoEndOfBattle()` concatenated `playerMoveLines` before `midBannerLines`, `combinedNorm` became `"effokt next battle effort next battle good good"`, causing `combinedNorm.contains("good effort")` to evaluate to `false` on all 55 frames. Simultaneously, `pendingChargedAttackActor` remained `"opp"` after the match-ending charged attack (`Swampert used Hydro Cannon!`), blocking the structural 3-KO fallback.
  - **Fix**: Ordered `allLines = oppLines + playerTopLines + midBannerLines + playerMoveLines` top-to-bottom, added split-banner token & OCR typo matching (`"good"` + `"effort"` / `"effokt"` / `"efort"` / `"next battle"` when combat HUD is hidden), and expired stale `pendingChargedAttackActor` after `8500ms` when combat circles do not return.

- **v6.26 — Fix 2: Deduplicated Pixel-Frame Debounce Processing Across Async ML Kit OCR Callbacks (`OverlayService.kt`)**:
  - **Root Cause**: `updateLiveHpAndChargedAttackState()` ran once per 10Hz pixel scan (`line 4965`) and a second time on `Dispatchers.Main` whenever async ML Kit OCR completed (`line 5153`) using the same `currentFrameTimestampMs` pixel sample, allowing a 1-frame pixel glitch (`F#0814`) to increment `oppSlotHpConfirmFrames` from `0 -> 1 -> 2` on a single frame.
  - **Fix**: Added `lastHpEnergyProcessedFrameTimestampMs` (`isNewPixelFrame`) so `currentBattleSensorTicks`, `Section 1A`, `Section 1B`, and `Section 1C` pixel debounce counters advance strictly once per unique pixel scan while OCR-completion callbacks still immediately evaluate banner/prompt OCR (`hasAttackIncomingText`, `hasUserChargedBannerText`, `handleMidBannerUsedMoveLines`).

- **v6.26 — Fix 3: `Tinkaton` Yellow HP & Depleted-Track Pink-Bow Classification, `0.45h` Player Corridor, Half-Bar Hit-Spark Rejection & Pre-Charge Camera-Zoom Sag Guard (`PixelScannerEngine.kt`, `OverlayService.kt`, `GitHubCloudSync.kt`)**:
  - **`Tinkaton` Pink Hair Bow Behind Yellow HP Bar & Depleted Track**: Relaxed Yellow (`band 2`) blue ceiling in `classifyHpPixel()` from `b <= 130` to `b <= 148` while keeping `(r - b) >= 82 && (g - b) >= 62` (accommodating `Tinkaton`'s pink hair bow blending through the semi-transparent Yellow fill at `B = 131..144`), and allowed low-chroma translucent-dimmed sprite pixels (`pLuma <= 112 && chroma <= 36` when `borderLuma >= 175`) in `isDarkTrack`.
  - **Eliminated `6%–9%` Sky/Tree False Locks (`y = 758..762`)**: Raised `playerHpCorridorRect.top` from `0.055h` to `0.45h` (and `playerHpBottomFrac` during shield prompts from `0.665h` to `0.72h`), raised the dim border floor in `isBorderPixel()` to `luma >= 95` (`borderLuma in 125..184` in `classifyHpPixel()`), and prioritized bright white-bordered clusters (`medBorderLuma >= 180 && cluster.size >= 3`) over dim candidates in `detectFloatingHpBarPct()` so `prevStableHp` never latches onto background artifacts.
  - **Half-Bar Hit-Spark Rejection (`F#0814`) & Resilient Upward Glitch Recovery (`6% -> 48%`)**: Tightened opponent `absAnchorMaxX` from `0.700w` to `0.585w`, required `>= 55%` overall top/bottom border coverage plus `>= 40%` in both the left half and right half of `[lb + 6 .. rb - 6]`, expanded upward glitch recovery tolerance (`max(tol, 4)`) with `4` confirmation frames when recovering from `<= 12%` to `>= 25%`, and preserved upward recovery counters across 1-frame `!canSample` pauses.
  - **Pre-Charge Camera-Zoom Vertical Y-Shift Sag Guard & `APP_VERSION_CODE` Telemetry Fix**: Tracked per-slot baseline combat `hpRowY` (`playerSlotBaselineHpRowY`) to reject perspective HP sag (`realUserDrop in 2..20`) when the camera zooms in and shifts `playerHpRowY` upward by `>= 0.035h` (`Swampert` `70% -> 59%` at `F#0921..0930`), and wired `OverlayService.APP_VERSION_CODE` (`1626`) into `buildDebounceAndSettlingSettingsMapStatic()`.

---

## v6.25 (2026-11-06) — Super Mega 3rd `+` Charged Move Display & Simulation Across All Team Builders, Role Upgraders & Moveset Optimizers
*Precision Team Builder, Role Upgrader, and Super Mega simulation release (`v6.25`, `versionCode = 1625`) ensuring that Super Mega 3rd `+` charged moves (such as `Mega Raichu X`'s `Volt Tackle+`, `Mega Mewtwo Y`'s `Psystrike+`, `Mega Dragonite`'s `Draco Meteor+`, etc.) are unconditionally simulated across all combat/role evaluators and explicitly displayed on every Team Builder, Role Upgrade chip, Alternate Moveset chip, Autocomplete row, and Show 6 card across Android and Web.*

- **v6.25 — Enhancement 1: Unconditional Super Mega `+` Move Resolution & Role-Weighting Integration (`OverlayService.kt`, `PokemonDatabase.kt`, `TeamAndMetaEngine.kt`, `src/data/pokemonDb.ts`)**:
  - **League-String-Independent `+` Move Lookup**: Updated `resolveMegaPlusMoveStatic()` (`OverlayService.kt`) and `resolveMegaPlusMove()` (`src/data/pokemonDb.ts`) to resolve the 3rd fixed `+` move whenever the species is a Mega/Primal entry in `SUPER_MEGA_PLUS_MOVES` / `DYNAMIC_SUPER_MEGA_PLUS_MOVES` (`isMegaOrPrimalSpeciesStatic(trimmed)`), eliminating edge cases where `prefs == null` or custom cup strings prevented `calculateMatchupRatingStatic` or UI formatters from resolving `Volt Tackle+` on `Mega Raichu X`.
  - **Role-Weighting & Bait/Sweeper Credit for 3rd `+` Move**: Updated `computeBaitVsSweeperScore()` and `computeRoleWeightedTop100MetaStatic()` (`TeamAndMetaEngine.kt`) to include the 3rd `+` move's energy cost and power when computing `minEnergy` and `maxPower`, ensuring low-energy `+` moves (`Volt Tackle+` at 35E) and high-power `+` nukes (`Psystrike+`, `Draco Meteor+`) receive full Lead, Safe Swap, and Closer role weighting.
  - **Mega League Rankings & Non-Plus Regular Slot Filtering**: Updated `resolveRecommendedMovesForSpecies()` (`PokemonDatabase.kt`) to use `normalizeLeagueKeyStatic(league)` so Mega Great/Ultra/Master rankings are preserved, and filtered `_PLUS` / `+` moves out of `orderedChargedNames` in `getRecommendedMovesForPokemon()` (`src/data/pokemonDb.ts`) so `chargedMove1` and `chargedMove2` always hold the 2 regular charged moves while the `+` move occupies slot 3.

- **v6.25 — Enhancement 2: Explicit 3rd `+` Move Display Across All Team Builder & Recommendation Surfaces (`MainActivity.kt`, `TeamAndMetaEngine.kt`, `Show6Engine.kt`, `PokemonDatabase.kt`, `src/App.tsx`, `src/data/teamAndMetaEngine.ts`)**:
  - **Top 5 Role Upgrade Chips & Best 3 Alternate Moveset Chips**: Added `+ <PlusMove> [Mega4]` (e.g., `+ Volt Tackle+ [Mega4]`) to all Top-200 Role Upgrade recommendation chips and Best 3 Alternate Moveset chips in the Edit Team dialog on both Android (`MainActivity.kt`) and Web (`src/App.tsx`).
  - **My Teams Cards, Anti-Meta Synergy Summaries, Autocomplete & Show 6 Builders**: Added explicit `+ <PlusMove> [Mega4]` display to My Teams preset rows, Anti-Meta `altNotes` / `synergySummary` strings, Pokémon Autocomplete badges (`Mega • +Volt Tackle+`), Show 6 6v6 Pick-3 Optimizer lineups, Blind Show 6 Roster Builder cards, and Show 6 Roster Editor upgrade/moveset rows.

---

## v6.24 (2026-11-05) — Critical Hotfix: Opening Pokémon Lock-In, Dark-Nameplate Switch Detection & Premature Auto-End Prevention
*Hotfix release (`v6.24`, `versionCode = 1624`) resolving the `v6.23` regression where battles failed to lock onto the opening Pokémon and auto-ended prematurely.*

- **v6.24 — Fix 1: Removed `!sampledTopRightNameplateVisible` Lockout & Added Pre-Battle Combat Evidence + Opening Lead Self-Correction (`OverlayService.kt`)**:
  - **Root Cause**: `detectTopRightOpponentNameplate()` (`sampledTopRightNameplateVisible`) checks for a solid white rectangle (`luma >= 204, sat <= 26`), which evaluates to `false` during normal combat on Pokémon GO's dark translucent nameplate. Gating `handleOpponentLines()` on `!sampledTopRightNameplateVisible` in `v6.23` caused `handleOpponentLines()` to return early on 100% of frames after `isWaitingForOpponent` flipped to `false` on the first OCR frame.
  - **Fix**: Replaced `!sampledTopRightNameplateVisible` in `handleOpponentLines()` with `isChargedPromptOrCutsceneActive || isAllCombatHudGone`, required combat HUD evidence (`CP` indicator, live HP bar, or Pokéballs) while `isWaitingForOpponent == true` (preventing pre-battle VS screen trainer names from locking in as the opening Pokémon), added `<= 3.5s` opening-lead self-correction on slot 0, and moved the clipped-suffix guard (`"katon"` $\to$ `Tinkaton`) after Step 3 prefix matching in `findPokemonInText()`.

- **v6.24 — Fix 2: Pre-OCR `isWaitingForOpponent` Live-HP Gate & Premature Auto-End Prevention (`OverlayService.kt`)**:
  - **Live-HP Gate on Pre-OCR Energy**: Gated the `isWaitingForOpponent` pre-OCR circle energy scanner on `sampledPlayerHpPct in 1..100 && sampledOppHpPct in 1..100 && sampledPlayerBalls in 1..3 && sampledOppBalls in 1..3` and anchored `battleClockAnchorMs = System.currentTimeMillis() - (phasePlayerTurns * 500L)` when the lead is locked in, preventing lobby/matchmaking frames from prematurely latching `hasBattleStarted = true` with a stale `battleClockAnchorMs`.
  - **Hardened `checkAndHandleAutoEndOfBattle()`**: Stripped `"battle till you win"` / `"till you win"` before checking `"you win"`, required 2 consecutive OCR frames (`requiredFrames = 2`), and gated `structuralResult` on `pendingChargedAttackActor.isEmpty() && !isAttackIncomingPromptActive && !isTopCountdownCircleActive && missingBothHpBarsFrames >= 8` with `0%` HP KO (`<= 0` instead of `<= 18%`), preventing mid-battle charged-move cutscenes from ever auto-ending a match early.

---

## v6.23 (2026-11-05) — 1-Battle DVR Video Telemetry Fixes: Clipped-Nameplate & Auto-Catcher Guard (`Aron`), 1st-Round Meniscus Energy Calibration, Pre-OCR Lead Turn Sync & Turn-of-Throw Confirmation
*Precision combat-vision and state-machine release (`v6.23`, `versionCode = 1623`) resolving all root causes identified in the `v6.22` 1-Battle DVR video recording (`log-1793933121234-670`) and companion telemetry batch.*

- **v6.23 — Fix 1: Clipped-Nameplate Substring Guard (`"katon"` $\to$ `Tinkaton` vs `Aron`), Cutscene Switch Lock & Auto-Catcher Filter (`OverlayService.kt`)**:
  - **Active/Known Opponent Clipped-Substring Guard**: Added Step 2.5 in `findPokemonInText()` so that when the top-right nameplate slides off-screen at the start of a charged-move zoom (`F#0056`), any clipped suffix/substring of the active or already-detected opponent species (such as `"katon"` from `"Tinkaton"`) immediately resolves back to the active species instead of falling through to short-word Levenshtein matching (`levenshteinDistance("katon", "aron") == 2`).
  - **Tightened Short-Word Levenshtein Matching & Auto-Catcher Ignore List**: Capped edit distance at `1` (and required matching first character) whenever either token or species name has length `<= 5`, and added Pokémon GO Plus / auto-catcher notification words (`caught`, `fled`, `ran`, `pokeball`, `stardust`, `candy`, `xp`, `accessory`, `connected`, `disconnected`) to `OCR_MENU_IGNORED_WORDS`.
  - **Cutscene Nameplate Visibility & Truncated-CP Guard**: Blocked mid-battle opponent species switches in `handleOpponentLines()` whenever a charged-move prompt/cutscene is active, `!sampledTopRightNameplateVisible`, or the scanned CP is a truncated prefix/suffix of the active opponent's CP (e.g., `CP 249` clipped from `CP 2499`), and required `sampledTopRightNameplateVisible` before auto-latching any provisional swap after `1400ms`.

- **v6.23 — Fix 2: 1st-Round Circle Meniscus Offset, Grid-Aligned Post-Throw Jump Clamp & Pre-OCR Lead Turn Sync (`PixelScannerEngine.kt`, `OverlayService.kt`)**:
  - **1st-Round Meniscus & Bottom-Chord Offset (`-3%` in `22..84%`)**: Compensated for Pokémon GO's circular charge button bottom-chord geometry and `+3%` bright liquid meniscus ridge (`L=51..53%` at `45%` true energy on `60E` `Gigaton Hammer`), preventing `27E` (3 `Fairy Wind`s) from rounding up to `36E` (4 `Fairy Wind`s) and eliminating the `+1 move` (`+9E`) inflation and subsequent rollback flicker.
  - **Grid-Aligned `maxAllowedSingleJumpE` & `awaitingPostUserChargeCircleSync` Expiry**: Removed the off-grid `+4E` jump allowance in `resolveSub50AndMultiRoundEnergy()` (which clamped post-throw energy to `3 + 18 + 4 = 25E` instead of `21E = 3 + 2*9E`), enforced a single-move step cap during steady fast-move windows, and expired `awaitingPostUserChargeCircleSync` if delayed past 1 fast move duration with circle fill `>= 28%`.
  - **Pre-OCR `isWaitingForOpponent` Multi-Move Turn Sync & Turn-of-Throw 1-Frame Confirmation**: Derived `earlyMoves` (`1..4`) from `measuredEarly / userFastEnergyForStats` during `isWaitingForOpponent`, anchored `battleClockAnchorMs` only once on initial battle start, synced `confirmedPhasePlayerTurns` and `confirmedMoveOppEnergy` on lead discovery, and immediately confirmed `proactiveStepPending` on the first frame a circle crosses the `100%` white ring or jumps `>= +6%` so turn-of-throw cutscenes never roll back a completed fast move (`63E -> 54E`).

- **v6.23 — Fix 3: Post-Charge 1-Frame Pokéball Flicker Guard (`OverlayService.kt`)**:
  - Gated the `debouncedPlayerBalls in 1..2` / `debouncedOppBalls in 1..2` faint-inference branches in `updateSteadyFrameBallAndShieldState()` on `(frameTimeMs - lastChargedAttackLoggedMs) > 1500L`, preventing a 1-frame HUD slide-in ball-count flicker immediately after a charged attack (`F#0259`) from momentarily marking the active Pokémon fainted.

---

## v6.22 (2026-11-05) — 1-Battle DVR Video Telemetry Fixes: Shielded Move False-KO Guard, Resurrection Deadlock Fix, Switch-In Unconfirmed Charge Rollback, Short-Sprite HP Corridor & Shield Cooldown
*Precision combat-vision and state-machine release (`v6.22`, `versionCode = 1622`) resolving 7 root causes identified in the `v6.21` 1-Battle DVR video recordings (`log-1793927871187-318` and `log-1793918420904-448`) and companion telemetry batches.*

- **v6.22 — Fix 1: Shielded Move False-KO Guard, Pre-Faint Energy Preservation & Resurrection Deadlock Fix (`OverlayService.kt`)**:
  - **Pre-KO `BLOCKED!` / Disguise Evaluation & `sampledHpPct == -1` Requirement**: Evaluated `blockedByBanner` / `disguiseBustedEarly` (`"BLOCKED!"` and `"disguise is busted!"` OCR banners) *before* `isLethalDisappearingPlayerHpBar` and `isLethalDisappearingOppHpBar`, and strictly required `sampledPlayerHpPct == -1` / `sampledOppHpPct == -1` across all sub-conditions (including the `sampledBalls in 1 until pendingChargedAttackPreBalls` sub-branch). Prevents shielded attacks (such as `Togekiss` shielding `Play Rough` at `68% HP, 85E` or `Tinkaton` shielding `Hydro Cannon` at `34% HP, 35E`) from falsely marking the defender fainted (`0% HP, 0E`).
  - **Broke the Catch-22 Resurrection Deadlock**: Previously, `canResurrectActiveOpp` / `canResurrectActiveUser` required `slotHpConfirmFrames >= 2` when `< 3` Pokéballs remained, which was only incremented inside Sections 1A/1B when `!faintedSlots[activeIdx]` — locking any falsely fainted active slot at `0% HP, 0E` and disabling fast-move and circle energy scanning (`canAccumulateFastEnergy` / Section 1C). Added `faintedUserLiveHpFrames` and `faintedOppLiveHpFrames` tracking directly in `updateSteadyFrameBallAndShieldState()` along with `playerSlotPreFaintEnergy` / `oppSlotPreFaintEnergy` restoration so any active slot with `>= 2` frames of visible HP bar is immediately resurrected with its pre-faint HP and energy intact.

- **v6.22 — Fix 2: Switch-In Camera Pan Guard & Provisional Unconfirmed Player Charge Rollback (`OverlayService.kt`)**:
  - **Switch-In Camera Pan Guard**: Prevented `missingBothHpBarsFrames` and `isPlayerChargedScreen` from latching an unconfirmed HUD-missing player charged move during or within `2500ms` of any player/opponent switch (`"Go, <Pokemon>!"` / `"Come back!"` or `sampledTopRightNameplateVisible`).
  - **Unconfirmed Player Charge Rollback**: When `pendingChargedAttackActor == "user"` was latched solely by `missingBothHpBarsFrames >= 14` without minigame or move-banner OCR and normal combat circles return without having drained (`sampledFill >= preChargeFill - 8`), the service now aborts the false alarm and restores `preChargeUserEnergy` instead of logging a phantom charged attack.

- **v6.22 — Fix 3: Dynamic Short-Sprite Player HP Corridor & 0-Shield Pre-Charge HP Lock (`OverlayService.kt`)**:
  - **Short-Sprite (`Mimikyu`) HP Corridor Clearance**: Expanded `playerHpCorridorRect.bottom` to `0.78h` during normal combat and only tightened to `0.665h` while `isShieldDecisionOverlayVisible` is actually `true`, preventing `0.65h` (`y = 1522`) from slicing through `Mimikyu`'s bottom white capsule border (`y = 1524..1548`).
  - **0-Shield Post-Hit `pendingChargedAttackPreUserHp` Lock**: Capped `isShieldCallWindowEarly`'s 0-shield branch and `isOpponentThrowingHpRescanWindow` at `(nowMs - pendingChargedAttackStartMs) <= 3500L && lastDetectedBannerMoveActor != "opp"`, preventing post-hit HP bars at the end of an opponent cutscene from overwriting `pendingChargedAttackPreUserHp` (fixing `Swampert` `95% -> 75%` pre-charge overwrite on `Brick Break`).

- **v6.22 — Fix 4: Wall-Clock Shield Cooldown, Monotonic Mid-Combat HP Guard & Sub-Turn Flicker Debounce (`OverlayService.kt`, `PixelScannerEngine.kt`)**:
  - **6.5s Wall-Clock Shield Decrement Cooldown**: Added `lastPlayerShieldDecrementWallMs` and `lastOppShieldDecrementWallMs` across all shield decrement sites (`handleMidBannerUsedMoveLines`, Section 4, and `updateSteadyFrameBallAndShieldState`) to prevent double shield decrements (`2 -> 1 -> 0` 500ms apart) when `"BLOCKED!"` OCR and HUD shield pixel scanning fire on the same attack.
  - **Dark-Track Tip Glare & Mid-Combat Upward HP Guard**: Lowered the `>= 75%` dark-track density check threshold in `PixelScannerEngine.kt` from `darkTrackSpan > 10` to `darkTrackSpan >= 4`, required `>= 6` consecutive stable frames before allowing upward HP changes after `3.0s` (`>= 4` turns) on field, and debounced `rollbackPendingProactiveStep()` across `>= 3` consecutive missing-circle frames.

---

## v6.21 (2026-11-05) — APK Signature Scheme v3 Key Rotation (`minSdk 31`), Security Audit Hardening, DVR `lockHardwareCanvas` Backpressure & Strict TypeScript Toolchain
*Security, stability, performance, and build-pipeline release (`v6.21`, `versionCode = 1621`) migrating APK release signing to a 4096-bit RSA key in encrypted GitHub Actions Secrets with APK Signature Scheme v3 Key Rotation Lineage (preserving seamless in-place updates for existing installations while revoking the legacy key's capabilities), hardening Android WebView & service lifecycles, fixing Web Show 6 vs. GBL storage key isolation and idle re-render overhead, and enabling strict TypeScript verification in CI.*

- **v6.21 — Security 1: APK Signature Scheme v3 Key Rotation & GitHub Secrets Signing Pipeline (`app/build.gradle.kts`, `.github/workflows/android.yml`, `.gitignore`)**:
  - **Seamless In-Place Upgrade via v3 Signing Lineage**: Raised `minSdk` to `31` (Android 12) and generated a cryptographic APK Signature Scheme v3 rotation lineage (`apksigner rotate`) chaining the original certificate (`CN=GBL Battle Matrix`) to a new 4096-bit RSA release key (`CN=SilphScope PvP`, `SHA384withRSA`) with all capabilities (`rollback`, `installed-data`, `permission`, `shared-uid`, `auth`) revoked on the legacy key. Existing installations upgrade in-place without uninstalling or losing battle logs, and permanently reject the legacy key afterward.
  - **Zero-Keystore Repository & Hardened CI**: Removed `app/release.keystore` from Git, added `*.keystore`/`*.jks`/`*.lineage`/`keystore.properties` to `.gitignore`, moved signing credentials into encrypted GitHub Actions Secrets (`RELEASE_KEYSTORE_B64`, `RELEASE_LINEAGE_B64`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_PASSWORD`, `RELEASE_KEY_ALIAS`), and eliminated shell interpolation of workflow inputs in `.github/workflows/android.yml`.

- **v6.21 — Security & Stability 2: Android WebView Hardening, Main-Thread IPC & Lifecycle Teardown (`AndroidManifest.xml`, `OverlayService.kt`, `MainActivity.kt`, `BattleDvrEngine.kt`, `TaskerIntegration.kt`, `overlay.html`)**:
  - **WebView XSS Prevention & Teardown**: Added `escapeHtml()` across dynamic team/opponent names and titles in `overlay.html`, disabled content access (`allowContentAccess = false`) and mixed-content overrides, closed ML Kit `textRecognizer` and called `overlayView.destroy()` in `OverlayService.onDestroy()`, and destroyed `replayWebView` on replay dialog dismiss in `MainActivity.kt`.
  - **Main-Looper `@JavascriptInterface` Marshaling & Idle Loop Throttling**: Wrapped `onSelectPreset`, `triggerSwapClockHapticIfNeeded`, and `updateContentHeight` in `Handler(Looper.getMainLooper()).post` to prevent off-thread `WindowManager` and state races, throttled `startBattleOcrLoop` when `mediaProjection == null` or the HUD is minimized, and set `android:allowBackup="false"` in `AndroidManifest.xml`.
  - **Hardware DVR `lockHardwareCanvas()` & Frame Backpressure**: Switched `BattleDvrEngine.kt` surface rendering from `lockCanvas(null)` to `lockHardwareCanvas()`, hoisted banner `Paint`/`Typeface` instances, added an `AtomicBoolean` in-flight guard so slow frames drop cleanly without queueing scaled bitmaps, and wrapped `TaskerBroadcastReceiver`'s `startForegroundService` in a safe fallback.

- **v6.21 — Performance & Toolchain 3: Web Storage Key Isolation, Idle Timer Gating, CSP & Strict TypeScript (`src/App.tsx`, `index.html`, `tsconfig.json`, `package.json`, `.github/workflows/deploy-pages.yml`)**:
  - **Mode-Aware Storage Keys & One-Time Migration Gate**: Fixed `handleReparseAllCompletedBattles` and `migrateExistingBattleLogs` in `src/App.tsx` to use `activeBattleLogStorageKey` and `activeDeletedBattlesTrashStorageKey` (preventing Show 6 mode from overwriting GBL battle logs/trash) and gated `runOneTimeAiLogSplitAndCleanup` on `gbl_ai_logs_split_v350_done`.
  - **Eliminated Idle 5Hz Root Re-Renders**: Gated the swap clock `setInterval` in `src/App.tsx` so it runs only while `playerSwapEndTimeMs > now` or `oppSwapEndTimeMs > now`, reducing idle CPU usage to 0%.
  - **Content-Security-Policy, Least-Privilege PAT Scope & Strict CI**: Added a `Content-Security-Policy` meta header in `index.html`, narrowed the web GitHub token creation link to `scopes=gist`, enabled `"strict": true` in `tsconfig.json`, moved build tools to `devDependencies`, and upgraded `.github/workflows/deploy-pages.yml` to Node 22 + `npm ci` + `npm run lint`.

---

## v6.20 (2026-11-05) — Mega Level 4 (`Super Mega`) 3rd Fixed `+` Charged Moves, 3-Button Energy Scanner & Role-Agnostic Multi-Throw Combat Simulator
*Semi-major feature release (`v6.20`, `versionCode = 1620`) introducing full support for Pokémon GO's Mega Level 4 (`Super Mega`) 3rd Fixed Special `+` Charged Moves in Mega-eligible leagues, 3-button raised-center charge circle pixel scanning, and a flexible, role-agnostic multi-throw sequence combat simulator across both the native Android Overlay and the Web Simulator.*

- **v6.20 — Feature 1: All 18 `*_PLUS` Moves & `"supermega"` Species Database (`PokemonDatabase.kt`, `OverlayService.kt`, `src/data/pokemonDb.ts`)**:
  - **Static & Dynamic `*_PLUS` Move Support**: Added all 18 official PvPoke `*_PLUS` Charged Moves (`Fell Stinger+` 40p/35e +1 ATK, `Volt Tackle+` 65p/35e -1 Self DEF, `Zap Cannon+` 70p/45e -1 Opp ATK, `Acid Spray+` 20p/40e -2 Opp DEF, `Liquidation+` 55p/40e 30% -1 Opp DEF, `Outrage+` 80p/50e, `Dynamic Punch+` 130p/80e, `Future Sight+` 130p/80e, `Drill Peck+` 60p/35e, `Dark Pulse+` 60p/40e, `Night Shade+` 55p/45e, `Brave Bird+` 70p/40e -3 Self DEF, `Ominous Wind+` 50p/40e 10% +1 ATK/DEF, `Seed Bomb+` 60p/40e, `Mystical Fire+` 50p/40e -1 Opp ATK, `Surf+` 55p/35e, `Psybeam+` 60p/45e, `Brick Break+` 40p/35e -1 Opp DEF) along with all 18 Super Mega species base stats and dynamic `extraChargedMoves` ingestion from `gamemaster.json`.
  - **Strict Eligibility Gating (`resolveMegaPlusMoveStatic` / `resolveMegaPlusMove`)**: Enforced the two-gate rule so a Pokémon receives its 3rd `+` move **only** if (1) it is a Mega species that possesses a `+` move (`SUPER_MEGA_PLUS_MOVES` / `DYNAMIC_SUPER_MEGA_PLUS_MOVES`) **and** (2) the active league allows Mega Pokémon (`isMegaAllowedInLeagueStatic` / `isMegaAllowedInLeague` — e.g., *Mega Master League*, *Mega Great League*, *Mega Ultra League*, *Battle Frontier (Cauldron)*, *Battle Frontier (Master)*). Filtered `_PLUS` / `+` moves out of regular 2-move dropdowns so slots 1 and 2 remain standard selectable Charged Moves.

- **v6.20 — Feature 2: Flexible, Role-Agnostic Multi-Throw Combat Simulator (`PokemonDatabase.kt`, `TeamAndMetaEngine.kt`, `src/data/pokemonDb.ts`, `src/data/combatSimulator.ts`, `src/data/teamAndMetaEngine.ts`)**:
  - **Role-Agnostic Sequence Evaluation**: Upgraded `simulateTurnByTurnChargedCycleStatic` (Kotlin) and `simulateTurnByTurnChargedCycle` (TypeScript) to accept an optional 3rd `+` move (`c3`) and evaluate single throws, back-to-back spam pairs ($m_a \to m_a$, such as two $35\text{E}$ moves back-to-back for $70\text{E}$ vs. a single $75\text{E}\text{–}80\text{E}$ nuke), and mixed $1\text{S}$ / $2\text{S}$ sequences across all available moves $\mathcal{M} = \{m_1, m_2, [m_3]\}$ without pigeonholing moves into fixed bait, closer, or coverage roles.
  - **End-to-End Matchup & Team Builder Integration**: Wired 3-move Super Mega simulation into `calculateMatchupRatingStatic`, `calculateFastRoughMatchupRatingStatic`, `evaluateDiscreteShieldBattleRating`, and `evaluateFastRoughShieldBattleRating`, automatically propagating 3-move Super Mega coverage into the 9x9 Shield Matrix, Anti-Meta Team Builder (`ABB` / `ABC` / `DUO`), Role Upgraders, and Show 6 Optimizer in Mega leagues.

- **v6.20 — Feature 3: 3-Button Charge Circle Pixel Scanner & Live Overlay HUD (`PixelScannerEngine.kt`, `OverlayService.kt`, `overlay.html`, `MainActivity.kt`, `src/App.tsx`)**:
  - **Calibrated 3-Button Pixel Scanner**: Calibrated `detectChargedMoveButtonFillLevels` from 472×1024 in-game telemetry where the `+` move sits in the center and raised (`cx = 0.5000w, cy = 0.8375h`, `r = 0.068w`) while Move 1 (`cx = 0.2150w, cy = 0.8930h`) and Move 2 (`cx = 0.7820w, cy = 0.8930h`) shift outward, with automatic fallback to standard 2-button coordinates if all 3 circles return `-1` (e.g., if a player brings a Mega Level 1–3 Pokémon).
  - **3-Move Post-Throw Energy Deduction, Banner OCR & HUD**: Added `sampledCenterChargeBtnFillPct` (`btnSlotKey = 6 + activeUserIdx`), 3-circle `POST_THROW_CIRCLE_FIT` energy deduction (`userPlusMoveEarly`), `"<Pokemon> used <Move>+!"` mid-banner OCR, 3rd player move row in `pushHudStateToWebView`, and `[+ <PlusMove>]` / `[Mega4]` badges across Presets, Autocomplete, Anti-Meta Builder, and Team Editor.

---

## v6.12 (2026-11-05) — 1-Battle DVR Video Telemetry Fixes: Shader-Band HP Validation, `BANNER_OCR` Move Preservation, Limited/Mega Cup Move Fallbacks, Pre-Minigame Energy Retention & `"BLOCKED!"` Banner OCR
*Precision computer-vision, combat state machine, and telemetry tracking release (`v6.12`, `versionCode = 1612`) driven by frame-by-frame analysis of the first two 1-Battle H.264 DVR + Deep Trace recordings (`log-1793840570834-275` and `log-1793854631467-245`) and 71 multi-user telemetry battles.*

- **v6.12 — Fix 1: Floating HP Bar Shader-Band Color Law & Corridor Tightening (`PixelScannerEngine.kt`, `OverlayService.kt`)**:
  - **Enforced Pokémon GO HP Shader Color-to-Percentage Law**: In `detectFloatingHpBarPct`, enforced strict consistency between the detected left-side fill color band and the resulting fill percentage (`leftBand == 1` Green requires `46%–100%`, `leftBand == 2` Yellow requires `16%–56%`, `leftBand == 3` Coral Red requires `1%–25%`). Eliminates false HP locks on pink/red sprites (Tinkaton's hammer at `59%–88%`), Shield Decision Overlay red `KO` badges (`43%–44%`), and green sprite scales (Zygarde Complete at `11%–27%`).
  - **Tightened Vertical HP Scan Corridors & Attack-Incoming Lockout**: Clamped `oppHpCorridorRect` bottom from `0.84h` to `0.50h` (preventing `O_HP` from scanning lower-screen sprites) and `playerHpCorridorRect` bottom from `0.88h` to `0.65h` (excluding Shield Decision Overlay remaining-HP badges at `>= 0.67h`). Disabled opponent HP rescanning (`canSampleOppHpBars = false`) while the camera zooms in on an attacking opponent during `"Attack incoming!"`.
  - **Eliminated Post-KO Active-Slot Resurrection**: Recorded `lastSlotKoTimeMs` / `lastUserSlotKoTimeMs` on lethal charged-attack KOs and gated `updateSteadyFrameBallAndShieldState` active-slot un-fainting so a fainting Pokémon is never resurrected to its pre-faint HP (`48%`) during its 1.5–2.5s fainting animation before the replacement Pokémon's nameplate appears.

- **v6.12 — Fix 2: Preserve `BANNER_OCR` Charged Moves & Limited/Mega Cup Move Pool Fallbacks (`OverlayService.kt`, `PokemonDatabase.kt`)**:
  - **Protected `BANNER_OCR` Move Identity Across Post-Cutscene HP Settling**: Fixed Section 1A (`canUpgradeHpGuess`) in `OverlayService.kt` so that when `canOverrideProvisionalUserShield` flips a provisionally-shielded opponent move to unshielded after the post-hit HP drop finishes debouncing, it never overwrites a move name already confirmed by `"<Opponent> used <Move>!"` (`moveResolutionSource == "BANNER_OCR"`).
  - **Added Same-CP Standard League Ranking Fallback (`resolveRankingsMapForLeagueStatic`)**: When the active league is a limited/custom cup or Mega Ultra/Great cup not present in `LIVE_RANKINGS_MAP`, `applyRankingMovesForLeague` and `getAvailableMovePoolForSpeciesStatic` now automatically fall back to the same-CP standard league rankings (`GREAT LEAGUE` for 1500 CP, `ULTRA LEAGUE` for 2500 CP, `MASTER LEAGUE` for 10000 CP) and `applyRecommendedMoves`, eliminating fallback `Crunch` / `Shadow Ball` assignments in limited cups.
  - **Fixed Mega Ultra/Great Routing & Expanded Dusknoir/Dusclops/Zygarde Pools**: Checked `"GREAT"` and `"ULTRA"` before `"MEGA"` in `resolveRecommendedMovesForSpecies` and added `Dusknoir` (`Shadow Punch`, `Dynamic Punch`, `Shadow Ball`), `Dusclops`, and `Zygarde` to `RECOMMENDED_CHARGED_MOVES` and `FALLBACK_SPECIES_CHARGED_POOL`.

- **v6.12 — Fix 3: Pre-Minigame Circle Shrink Energy Retention (`OverlayService.kt`)**:
  - **Prevented False Downward Energy Snap Before Minigame**: Gated downward circle-border self-correction (`primaryProvesBelowCost` / `secondaryProvesBelowCost`) on both charge circles remaining visible, no rapid pre-minigame shrink/fade drop (`>18%` drop from `lastStableChargeFillPct`), and `>= 5` consecutive stable normal-combat frames. Added a 2.5s `recentStableReadyEnergy` high-water mark so pre-throw energy is preserved when charge circles shrink into the charged-attack minigame.

- **v6.12 — Fix 4: `"BLOCKED!"` & `"disguise is busted!"` Mid-Banner OCR + Shield Reconciliation (`OverlayService.kt`)**:
  - **Mid-Banner `"BLOCKED!"` OCR**: Added detection for `"BLOCKED!"` and Mimikyu's `"disguise is busted!"` in `handleMidBannerUsedMoveLines` and Section 4 charged-attack reconciliation, ensuring shielded attacks are marked `shielded = true` and decrement the defender's shield count (unless blocked by Mimikyu's Disguise) even when top-HUD purple shield icons are covered by camera zoom or banners.
  - **Charged-Attack Gate on HUD Shield Decrements**: Gated `updateSteadyFrameBallAndShieldState` shield drops on an active or recent charged attack (`<= 8.0s–12.0s`) and widened the retroactive `CHARGED_ATTACK` shield-sync window from `4.0s` to `10.0s`.

- **v6.12 — Fix 5: Post-Cutscene HP Settling Audit Anchor & Comprehensive `appVersion` Telemetry Tagging (`GitHubCloudSync.kt`, `BattleDvrEngine.kt`, `scripts/ingest-telemetry.mjs`)**:
  - **Fixed `postCutsceneHpAudits` Timestamp Anchor**: Anchored `+220ms`, `+650ms`, and `+1200ms` post-cutscene settling ticks to the first frame after `isCutsceneActive` exits rather than cutscene initiation.
  - **End-to-End `appVersion` Logging**: Included `appVersion = "6.12"` and `versionCode = 1612` in `scannerSettings`, `settings_changes.jsonl`, `BATTLE_DVR_SUMMARY_HEADER`, the burned-in DVR video watermark (`v6.12 F#...`), and `scripts/ingest-telemetry.mjs` (`battlesByAppVersion` and `anomaliesByAppVersion`), while preserving the recorded `appVersion` of any pre-upgrade queued battles.

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
