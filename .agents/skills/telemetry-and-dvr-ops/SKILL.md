---
name: telemetry-and-dvr-ops
description: >-
  Operational runbook for SilphScope PvP Cloudflare telemetry sync, DVR replay/keyframe inspection,
  5:00 AM nightly audit pipeline, and D1 userbase meta SQL CLI. Use when syncing or diagnosing
  telemetry logs, inspecting DVR contact sheets or _deep_trace.jsonl files, editing
  ingest-telemetry.mjs or nightly-telemetry-audit.mjs, or running global meta queries.
---

# SilphScope PvP — Telemetry, DVR Diagnostics & Nightly Audit Runbook

## 1. Ingestion Architecture & Local Cache
- **Upload Endpoints**: Android clients upload telemetry batches (`POST /v1/telemetry`), settings audits (`POST /v1/settings-changes`), and 1-Battle DVR bundles (`.mp4` + `_deep_trace.jsonl`, `POST /v1/dvr`) to the Cloudflare Worker (`https://api.silphscopepvp.com` / `https://silphscope-telemetry.silphscope-pvp.workers.dev`, backed by R2 bucket `silphscope-replays` and KV `TELEMETRY_KV`). User-flagged diagnostic videos (non-blank issue description required) mirror to the `SilphScope DVR` Telegram channel with a `https://dvr.silphscopepvp.com/watch/:shareId` player link.
- **3-Hour Background Sync (`SilphScope-Telemetry-Sync`)**: A Windows Scheduled Task runs `node scripts/ingest-telemetry.mjs --sync-only --prune-remote` every 3 hours using local Node 22 + `ffmpeg.exe` (**0 AI tokens**, 0 KV list ops via direct R2 listing). It downloads new batches and DVR `.mp4` videos into `.aistudio/telemetry_cache/`, deletes safely saved items from Cloudflare, enforces a **1.0 GB local storage cap** (~70–80 videos kept on disk for regression checks while protecting `_deep_trace.jsonl`, `digest.json`, and manual bug reports), and pre-renders `digest.json`, `4x6` (24-frame) tiled contact sheets, and keyframes under `.aistudio/telemetry_cache/preprocessed/<battleId>/`.
- **On-Demand CLI Commands** (prepend Node 22 to `PATH` on Windows: `C:\Users\Chris\.nodejs\node-v22.14.0-win-x64`):
  - `npm run telemetry:sync` (or `scripts/sync-telemetry-now.cmd`): Sync new telemetry/DVRs locally and prune remote.
  - `npm run telemetry:report`: Generate local ingestion + anomaly report (`latest_anomaly_report.json`) when requested.
  - `npm run telemetry:reprocess`: Re-extract frames/contact sheets using [`scripts/telemetry-preprocess-config.json`](../../../scripts/telemetry-preprocess-config.json).

## 2. Paid-First Triage Priority (`P1`–`P4`) & Local Root-Cause Classifier
- `scripts/ingest-telemetry.mjs` joins trainer handles against `/v1/admin/keys` (`VIP` > `Pro` > `Supporter` > `Free`) and sorts all issues strictly by:
  1. `P1_PAID_MANUAL`: Paid-tier manually flagged issues (`VIP` > `Pro` > `Supporter`).
  2. `P2_FREE_MANUAL`: Free-tier manually flagged issues.
  3. `P3_PAID_AUTO`: Paid-tier auto-flagged issues (`VIP` > `Pro` > `Supporter`, then `HIGH` > `WARN`).
  4. `P4_FREE_AUTO`: Free-tier auto-flagged issues (`HIGH` > `WARN`).
- Zero-token deterministic root-cause classification (`classifyAnomalyLocally`, `backlinePredictorAudit`, `dvrTraceIntegrityAudit`, plus `v7.40`/`v7.42` retroactive fix verification) runs locally before any AI model reads the digest.

## 3. 5:00 AM Nightly Audit & Daily Chat Launch
- **Scheduled Entrypoint**: `scripts/run-nightly-telemetry.cmd` invokes `scripts/trigger-daily-telemetry-plan.mjs` + `scripts/nightly-telemetry-audit.mjs`.
- **Tier 0 (`0 AI Tokens` — Local Node.js + `ffmpeg` + `detectFloatingHpBarPctV708`)**: Runs 100% of ingestion, 24h/7d trainer summaries, version regression matrices, 7-day retroactive fix verification, paid-player full-frame pixel re-scans, 5:00–5:52 AM late-arrival watch, and 6:00 AM Telegram summary locally.
- **Tier 1 (`flash` / `flash_lite` Subagent — MANDATORY for All Visual OCR / Frame Checks)**: Whenever visual OCR, `4x6` contact-sheet inspection, or DVR keyframe verification is required, **ALWAYS** delegate via `invoke_subagent(TypeName: "research", Model: "flash")`. Never inspect video frames or images directly on Pro/Carbon.
- **Tier 2 (`Orchestrator (Carbon)` — `gemini-pro-orchestrator`)**: Launches a fresh dated Antigravity chat (`📊 [YYYY-MM-DD] Daily Telemetry Audit & Plan — SilphScope PvP`), reads cached `morning_briefing.md` + `nightly_audit_digest.json`, diagnoses unresolved `P1`–`P3` items, and writes `morning_telemetry_action_plan_YYYY-MM-DD.md` before asking clarifying questions.

## 4. Userbase-Wide Cloudflare D1 Meta CLI
- **Admin Endpoints**: `GET /v1/admin/meta-summary`, `GET /v1/admin/battle-logs`, `POST /v1/admin/sync/import` (protected by `ADMIN_API_KEY` stored only in gitignored `.env.admin`).
- **Local Commands** (`scripts/query-global-meta.mjs`):
  - `npm run meta:summary` (or `node scripts/query-global-meta.mjs --league="GREAT LEAGUE" --days=30`): SQL meta aggregation across structured `battle_logs` columns (`league`, `elo_band`, `opp_lead`, `opp_p2`, `opp_p3`, `my_lead`, `my_p2`, `my_p3`, `result`, `bmf`, `wae`).
  - `npm run meta:dump`: Incrementally exports D1 battle logs to `.aistudio/global_meta_logs.jsonl`.
