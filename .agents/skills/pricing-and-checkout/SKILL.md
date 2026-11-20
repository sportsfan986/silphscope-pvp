---
name: pricing-and-checkout
description: >-
  Official SilphScope PvP 4-tier membership pricing, Alumni and Day 15+ First-Season Promo rules,
  live Stripe Payment Links, Buy Me a Coffee links, and Cloudflare Worker checkout/auth/vault API
  endpoints. Use when modifying pricing, membership tiers, checkout links, Stripe/BMC webhooks,
  MarketingWebsite.tsx tier cards, or license verification.
---

# SilphScope PvP — Pricing, Checkout Links & API Reference

> **Single Source of Truth**: Use the exact finalized pricing, Stripe Payment Links, Buy Me a Coffee URLs, and Cloudflare Worker API endpoints below across the Android app, Web Simulator, Marketing Website (`src/components/MarketingWebsite.tsx`), and Cloudflare Worker (`cloudflare/telemetry-worker/worker.mjs`).

## 1. 4-Tier Membership Structure & Feature Matrix

| Feature / Capability | 🆓 Free Community (`$0`) | 🏅 Lifetime Supporter (`$2` One-Time or Alumni*) | 🏆 Legend Pro (`$3/mo` or `$6/Season`**) | 👑 VIP / Coach (`$5/mo` or `$10/Season`**) |
| :--- | :---: | :---: | :---: | :---: |
| **Price & Billing** | **$0 Forever** | **$2 One-Time** *(or Free forever after any Pro/VIP sub)* | **$3/mo** or **$3 First-Season Intro** / **$6 per 90d GBL Season** (`$2/mo` eff.) | **$5/mo** or **$5 First-Season Intro** / **$10 per 90d GBL Season** (`$3.33/mo` eff.) |
| **Live In-Game HUD, 9-Shield Matrix & Haptics** | ✅ **100% Free** | ✅ **100% Free** | ✅ **100% Free** | ✅ **100% Free** |
| **🛡️ Attack Incoming! Shield Decision HUD & 🧠 Compact AI Coach** | — | ✅ **Unlocked Forever** | ✅ **Unlocked Forever** | ✅ **Unlocked Forever** |
| **Battle Log History & Multi-Device Cloudflare D1 Sync** | Current Season (+14d grace) | **Unlimited Lifetime** | **Unlimited Lifetime** | **Unlimited Lifetime** |
| **Local On-Device DVR Ring Buffer** | **5 Battles (1 Set)** | **25 Battles (5 Sets / 1 Day)** | **50 Battles (10 Sets / 2 Days)** | **25–200 Battles (Slider)** |
| **Local On-Device Pinned (⭐) Replays** | **2 Pinned** | **5 Pinned** | **10 Pinned** | **25 Pinned** |
| **Hardware H.264 DVR Video Framerate** | 15 FPS (`720 kbps`) | 15 FPS (`720 kbps`) | **15 FPS (`720 kbps` • ~14 MB)** | **🎥 30 FPS Smooth (`900 kbps` • ≤30 MB max)** |
| **Cloud R2 Video & Frame Trace Vault** | — | Keeps Pinned 365d | **50 Rolling (30d) + 10 Pinned (365d) • 2 GB** | **150 Rolling (365d) + 25 Pinned (365d) • 4 GB** |
| **Anti-Meta Team Generator Leagues** | Great & Master League | **Core 3 (GL + UL + ML)** | **All Leagues + Limited/Mega/Specialty Cups** | **All Leagues + Limited/Mega/Specialty Cups** |
| **Anti-Meta Teams & ⚡ Alt Moveset Synthesis** | 1 / Archetype (Std Moves) | 2 / Archetype (Std Moves) | **Top 5 / Arch (15+ Teams) + ⚡ Alt Movesets** | **Top 5 / Arch (15+ Teams) + ⚡ Alt Movesets** |
| **🎯 Nemesis Analyzer & 🌿 What-If Branching** | Preview | Preview | ✅ **Full Access** | ✅ **Full Access + Priority Review** |

- **\*Alumni Rule (`everPaid`)**: Subscribing to **Legend Pro** or **VIP** even once sets `everPaid = true` on the trainer's license and permanently unlocks **🏅 Lifetime Supporter (Alumni)** benefits forever (including the **🛡️ Attack Incoming! Shield Decision Overlay**, **🧠 Compact AI Coach**, Unlimited Lifetime Battle Logs, 25 Local DVR Videos + 5 ⭐ Local Pins, Core 3 Open Leagues, and 365d Pinned Cloud Replay retention) even if their seasonal pass later expires.
- **\*\*Day 15+ First-Season Intro Promo**: GBL seasons run 90 days starting `Dec 1`, `Mar 1`, `Jun 1`, and `Sep 1` at `21:00 UTC`. During the **first 14 days** of a season, a Season Pass is full price (`$6` Legend Pro / `$10` VIP). Starting on **Day 15+** of a season, first-time subscribers (`!introPromoAlreadyUsed`) unlock the **entire remainder of the current GBL season** at the 1-month rate (`$3` Legend Pro / `$5` VIP).
- **Internal Non-Paid Comp DVR Tier (`comp`, Admin-Only via `manage-keys.mjs`)**: Temporary 30-day complimentary DVR pass (`everPaid = false`, `isPaidOrAlumni = false`) mintable via `node scripts/manage-keys.mjs create --tier comp [--local 25] [--cloud 15] [--days 30]`. Grants expanded local DVR (`25` rolling + `5 ⭐` local pins default), optional rolling Cloud R2 slots (`15` rolling default, `0` cloud pins), and **all leagues & Limited/Mega/Specialty Metas** in Anti-Meta Generator and IV Lab starting from first activation, with **zero** paid/Alumni unlocks (Shield HUD, Compact AI Coach, Lifetime Logs, Top 2/5 Teams, Alt Movesets, Blended ELO Meta, Nemesis, What-If, and 30 FPS stay gated to paid tiers; drops cleanly back to `free` on expiry).

## 2. Official Live Stripe Payment Links

Append `?client_reference_id=<urlEncodedTrainerScreenName>` to any Stripe URL when the user's Trainer Screen Name is known so the Stripe webhook (`POST /v1/webhooks/stripe`) automatically binds the license key to their handle:

- **🏅 Lifetime Supporter (`$2` One-Time)**: `https://buy.stripe.com/4gM3cwf3r8JG7XLamm1Jm07`
- **🏆 Legend Pro — 90-Day GBL Season Pass (`$6` / 3 months)**: `https://buy.stripe.com/8x2aEY8F33pma5TgKK1Jm08`
- **🏆 Legend Pro — Day 15+ First-Season Intro Promo (`$3` One-Time for Remainder of Season)**: `https://buy.stripe.com/14A4gAcVjf8491P8ee1Jm09`
- **🏆 Legend Pro — Monthly Pass (`$3` / month)**: `https://buy.stripe.com/4gM3cw7AZ0dab9XeCC1Jm0a`
- **👑 VIP / Coach — 90-Day GBL Season Pass (`$10` / 3 months)**: `https://buy.stripe.com/9B6fZi3kJ6By4Lzamm1Jm0b`
- **👑 VIP / Coach — Day 15+ First-Season Intro Promo (`$5` One-Time for Remainder of Season)**: `https://buy.stripe.com/4gM7sM5sR5xudi5amm1Jm0c`
- **👑 VIP / Coach — Monthly Pass (`$5` / month)**: `https://buy.stripe.com/28E00k2gFaRO5PD2TU1Jm0d`

## 3. Official Buy Me a Coffee Links (`$1` per PokéCoin)

- **Creator Page**: `https://buymeacoffee.com/silphscopepvp`
- **Memberships (`$3/mo` Legend Pro • `$5/mo` VIP / Coach)**: `https://buymeacoffee.com/silphscopepvp/membership`
- **Shop Extra `595787` — 🏅 Lifetime Supporter (`$2` One-Time)**: `https://buymeacoffee.com/silphscopepvp/e/595787`
- **Shop Extra `595788` — 🏆 Legend Pro 90-Day Season Pass (`$6`)**: `https://buymeacoffee.com/silphscopepvp/e/595788`
- **Shop Extra `595789` — 👑 VIP / Coach 90-Day Season Pass (`$10`)**: `https://buymeacoffee.com/silphscopepvp/e/595789`

## 4. Official Domain Architecture & API Endpoints (`silphscopepvp.com`)

- **Marketing Website, HUD Guide, Comparison Page & Web Simulator (`https://silphscopepvp.com` / `https://www.silphscopepvp.com`)**:
  - `/` (`?view=home`): Shiny Origin Forme Dialga Midnight (`dialga_shiny_midnight`) marketing landing page with interactive 4-battle Hero Phone (defaulting to Shiny Origin Dialga firing Roar of Time), 3 clickable `@Featured` 50% HUD battle GIF cards, ELO-Adaptive Anti-Meta + 3-Way Meta Fusion showcase, Hybrid Backline Predictor callout, Free 1-Click GOBattleLog Export highlight, and 4-Tier Membership Matrix.
  - `/?view=guide`: Visual 50% Translucent HUD Field Manual (6-zone anatomy, color-coded turn pacing states, 5-step quickstart).
  - `/?view=compare`: Honest side-by-side comparison vs. PvPoke and GOBattleLog.
  - `/?view=app`: Interactive 3v3 Matchup Simulator, Custom Team Builder, IV Lab, and Battle Log Dashboard.
- **Instant 1-Click Android APK Download (`https://dl.silphscopepvp.com`)**: Automatically redirects (`302`) to the latest signed `.apk` asset on GitHub Releases.
- **Cloud DVR Replay Vault & Replay Theater (`https://dvr.silphscopepvp.com`)**:
  - `/vault` & `/u/:screenName`: Browser DVR Replay Vault defaulting to persistent `@Featured` (`replays/_featured/`) when opened without a user query; 1-click **`🌟 Promote to Featured`** admin button when signed in as `@sportsfan986`.
  - `/watch/:shareId?t=<seconds>`: Frame-synced H.264 video + live 50% translucent `overlay.html` HUD replay player with `?t=` auto-seek (`f_ml_closer?t=18`, `f_ul_aura_nidoking?t=5`, `f_ul_bp_skeledirge?t=134`, `f_ul_catch_cobalion?t=79`).
- **Backend API, Auth, Sync & Webhooks (`https://api.silphscopepvp.com`)**:
  - **Pre-Checkout Unique Trainer ID Registration (`POST /v1/users/register-name`)**: Checks availability and locks `screenName` to `deviceHash` / `email`; returns `seasonPromo` (`isDay15Plus`, `introPromoEligible`, `daysRemaining`) and `paymentLinks`.
  - **Dynamic Checkout Quote (`GET/POST /v1/users/checkout-quote?screenName=<id>&email=<email>`)**: Returns `introPromoEligible` and pre-populated `recommendedLinks.supporter` (`$2`), `recommendedLinks.pro` (`$3` Intro or `$6` Season), and `recommendedLinks.vip` (`$5` Intro or `$10` Season) with `?client_reference_id=` attached.
  - **Stripe & BMC Webhooks (`POST /v1/webhooks/stripe`, `POST /v1/webhooks/bmc`)**: HMAC-verified automated key minting, renewal extensions, and Telegram notifications.
  - **License & Tier Verification (`POST /v1/users/verify-key`)**: Accepts `{ key, screenName, email, password }` and returns `{ ok, active, tier, label, limits, sessionToken }`.
  - **Multi-Device Cloudflare D1 Vault Sync (`GET/POST/PUT /v1/sync/vault`)**: Incremental cursor-based (`sinceServerMs`) delta synchronization of `battle_logs`, `team_presets`, `built_pokemon`, and `user_vault_state` in D1 (`silphscope-sync-db`) with 0 KV writes and PBKDF2-HMAC-SHA256 Vault Password + `X-Vault-Session` protection.
  - **3-Way Crowd ELO Meta & Latest Release (`GET /v1/meta/crowd-elo`, `GET /v1/version/latest`)**: Returns ELO-weighted D1 crowd meta & movesets and GitHub latest APK release version/highlights (`v7.41+`).
  - **Persistent Featured Replay Cloner (`POST /v1/replays/feature` & `GET /v1/replays/featured`)**: Copies any replay's `.mp4` and `_deep_trace.jsonl` into `replays/_featured/` (never auto-pruned) and scrubs personal screenName to `@Featured`.
  - **Marketing & Battle Showcase Assets (`public/screenshots/` & `docs/screenshots/`)**: `silphscope_tiers_infographic.jpg`, `elo_adaptive_anti_meta_engine.jpg`, `silphscope_vs_pvpoke_teambuilder.jpg`, `silphscope_vs_gobattlelog_analytics.jpg`, `featured_hero_shiny_dialga` (`.mp4`/`.gif`/`_poster.png`), `featured_ul_aura_nidoking` (`.mp4`/`.gif`/`_poster.png`), `featured_ul_bp_skeledirge` (`.mp4`/`.gif`/`_poster.png`), `featured_ul_catch_cobalion` (`.mp4`/`.gif`/`_poster.png`).
