#!/usr/bin/env node
/**
 * SilphScope PvP v6.27 — Cloudflare Multi-User AI Telemetry, Local Video/Trace Preprocessor & On-Demand Reporter
 *
 * Modes:
 *   1. Background Sync + Local Preprocess (runs every 5m via Windows Task Scheduler — ZERO AI tokens):
 *      node scripts/ingest-telemetry.mjs --sync-only --prune-remote
 *
 *   2. On-Demand Report Generation (when requested by user):
 *      node scripts/ingest-telemetry.mjs --report
 *
 *   3. Re-run Local Video/Trace Preprocessing across existing cached DVR bundles (after tuning config):
 *      node scripts/ingest-telemetry.mjs --reprocess-local
 *
 *   4. Continuous Live Watch Mode (polls manifest every 30s):
 *      node scripts/ingest-telemetry.mjs --watch
 *
 * Configuration:
 *   Edit `scripts/telemetry-preprocess-config.json` to tune screenshot capture rules, frame windows,
 *   contact-sheet grid dimensions, and the 1 GB local storage cap.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_WORKER_URL =
  process.env.SILPHSCOPE_TELEMETRY_WORKER_URL ||
  "https://silphscope-telemetry.silphscope-pvp.workers.dev";
const ADMIN_API_KEY =
  process.env.SILPHSCOPE_TELEMETRY_ADMIN_KEY ||
  "sspvp_admin_a1b2c3d4e5f60718293a4b5c6d7e8f90";

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const SYNC_ONLY = args.has("--sync-only");
const REPORT_ONLY = args.has("--report-only");
const REPROCESS_LOCAL = args.has("--reprocess-local");
const WATCH_MODE = args.has("--watch");
const PRUNE_REMOTE =
  args.has("--prune-remote") ||
  SYNC_ONLY ||
  process.env.PRUNE_REMOTE === "true";
const SKIP_VIDEOS = args.has("--skip-videos");

const ROOT_DIR = process.cwd();
const CONFIG_PATH = path.resolve(ROOT_DIR, "scripts", "telemetry-preprocess-config.json");
const CACHE_DIR = path.resolve(ROOT_DIR, ".aistudio", "telemetry_cache");
const BATCHES_DIR = path.join(CACHE_DIR, "batches");
const SETTINGS_DIR = path.join(CACHE_DIR, "settings_changes");
const RECORDINGS_DIR = path.join(CACHE_DIR, "recordings");
const PREPROCESSED_DIR = path.join(CACHE_DIR, "preprocessed");
const STATE_FILE = path.join(CACHE_DIR, "ingested_batches.json");
const SUMMARY_FILE = path.join(CACHE_DIR, "latest_anomaly_report.json");
const SYNC_LOG_FILE = path.join(CACHE_DIR, "background_sync.log");

for (const dir of [CACHE_DIR, BATCHES_DIR, SETTINGS_DIR, RECORDINGS_DIR, PREPROCESSED_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadPreprocessConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (err) {
    console.warn(`[WARN] Failed to parse ${CONFIG_PATH}, using defaults:`, err.message);
  }
  return {
    version: "1.0.0",
    storage: {
      maxLocalStorageMb: 1024,
      pruneTargetStorageMb: 950,
      keepRawMp4Videos: true,
      evictOldestRawMp4FirstWhenOverQuota: true,
    },
    contactSheet: {
      enabled: true,
      gridCols: 6,
      gridRows: 4,
      tileWidthPx: 272,
      tileHeightPx: 592,
      jpegQuality: 4,
    },
    individualKeyframes: {
      enabled: true,
      jpegQuality: 3,
      saveBeforeTriggerFrames: 4,
      saveAfterTriggerFrames: 6,
      sampleStepFrames: 2,
    },
    captureRules: {
      battleStart: {
        enabled: true,
        startFrameIdx: 0,
        frameCount: 24,
        sampleEveryNFrames: 2,
        alsoCaptureAroundFirstSpeciesLock: true,
        preLockFrames: 8,
        postLockFrames: 16,
      },
      chargedMoveTransitions: {
        enabled: true,
        entryPreFrames: 12,
        entryPostFrames: 12,
        entrySampleEveryNFrames: 1,
        exitPreFrames: 8,
        exitPostFrames: 16,
        exitSampleEveryNFrames: 1,
        mergeWindowFrames: 10,
      },
      largeHpChangesAndAnimations: {
        enabled: true,
        minCommittedHpDeltaPct: 12,
        minRawVsCommittedDiscrepancyPct: 10,
        preAnimationFrames: 10,
        postSettlingFrames: 14,
        sampleEveryNFrames: 1,
        cooldownFrames: 12,
      },
      speciesSwapsAndFaints: {
        enabled: true,
        preSwapFrames: 10,
        postSwapFrames: 14,
        sampleEveryNFrames: 1,
        cooldownFrames: 12,
      },
      energyAnomaliesAndJumps: {
        enabled: true,
        minSingleStepEnergyJump: 20,
        minUnexplainedCircleDropPct: 18,
        preFrames: 8,
        postFrames: 16,
        sampleEveryNFrames: 1,
        cooldownFrames: 15,
      },
      battleEnd: {
        enabled: true,
        tailFrameCount: 24,
        sampleEveryNFrames: 2,
      },
    },
  };
}

function appendSyncLog(line) {
  try {
    const stamped = `[${new Date().toISOString()}] ${line}\n`;
    fs.appendFileSync(SYNC_LOG_FILE, stamped, "utf8");
  } catch {}
}

function resolveFfmpegBin() {
  const candidates = [
    process.env.FFMPEG_PATH,
    "C:\\Users\\Chris\\scoop\\shims\\ffmpeg.exe",
    "ffmpeg",
  ].filter(Boolean);
  for (const bin of candidates) {
    try {
      const res = spawnSync(bin, ["-version"], { encoding: "utf8", windowsHide: true });
      if (res.status === 0) return bin;
    } catch {}
  }
  return null;
}

const FFMPEG_BIN = resolveFfmpegBin();

function loadCacheState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return {
        ingestedBatchIds: parsed.ingestedBatchIds || {},
        ingestedKeys: parsed.ingestedKeys || {},
        records: Array.isArray(parsed.records) ? parsed.records : [],
        settingsChanges: Array.isArray(parsed.settingsChanges) ? parsed.settingsChanges : [],
        dvrBundles: parsed.dvrBundles || {},
      };
    }
  } catch {}
  return {
    ingestedBatchIds: {},
    ingestedKeys: {},
    records: [],
    settingsChanges: [],
    dvrBundles: {},
  };
}

function saveCacheState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function fetchWithRetry(url, options, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, attempt * 600));
      }
    }
  }
  throw lastErr;
}

async function adminFetchJson(endpointPath) {
  const res = await fetchWithRetry(`${DEFAULT_WORKER_URL}${endpointPath}`, {
    headers: {
      Authorization: `Bearer ${ADMIN_API_KEY}`,
      "User-Agent": "SilphScopePvP-CloudflareIngest/6.27",
    },
  });
  if (!res.ok) {
    throw new Error(`Admin API ${endpointPath} failed (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

async function adminFetchText(key) {
  const res = await fetchWithRetry(
    `${DEFAULT_WORKER_URL}/v1/admin/object?key=${encodeURIComponent(key)}`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_API_KEY}`,
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.27",
      },
    }
  );
  if (!res.ok) return null;
  return await res.text();
}

async function adminFetchBytes(key) {
  const res = await fetchWithRetry(
    `${DEFAULT_WORKER_URL}/v1/admin/object?key=${encodeURIComponent(key)}`,
    {
      headers: {
        Authorization: `Bearer ${ADMIN_API_KEY}`,
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.27",
      },
    }
  );
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function adminDeleteObject(key) {
  const res = await fetchWithRetry(
    `${DEFAULT_WORKER_URL}/v1/admin/object?key=${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${ADMIN_API_KEY}`,
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.27",
      },
    }
  );
  return res.ok;
}

async function listAllObjectsByPrefix(prefix) {
  const all = [];
  let cursor = null;
  do {
    const q = new URLSearchParams({ prefix, limit: "500" });
    if (cursor) q.set("cursor", cursor);
    const page = await adminFetchJson(`/v1/admin/list?${q.toString()}`);
    if (Array.isArray(page.objects)) {
      all.push(...page.objects);
    }
    cursor = page.truncated ? page.cursor : null;
  } while (cursor);
  return all;
}

// ============================================================================
// LOCAL DEEP-TRACE + FFMPEG VIDEO PREPROCESSOR (ZERO AI TOKENS)
// ============================================================================

/**
 * Analyzes `_deep_trace.jsonl` according to `scripts/telemetry-preprocess-config.json`
 * and identifies all battle start, charged-move transition, large HP change/animation,
 * species swap, energy jump, and battle end windows.
 */
function analyzeDeepTraceEvents(frames, config) {
  const rules = config.captureRules || {};
  const events = [];
  if (!Array.isArray(frames) || frames.length === 0) return events;

  const totalFrames = frames.length;
  const clampIdx = (idx) => Math.max(0, Math.min(totalFrames - 1, idx));

  const addEvent = (type, category, triggerIdx, startIdx, endIdx, step, summary, details = {}) => {
    const sIdx = clampIdx(startIdx);
    const eIdx = clampIdx(endIdx);
    const tIdx = clampIdx(triggerIdx);
    const fTrigger = frames[tIdx] || frames[sIdx];
    const fStart = frames[sIdx];
    const fEnd = frames[eIdx];
    events.push({
      id: `${category}_F${String(fTrigger.frameIdx ?? tIdx).padStart(4, "0")}_${type}`,
      type,
      category,
      triggerArrayIdx: tIdx,
      startArrayIdx: sIdx,
      endArrayIdx: eIdx,
      sampleEveryNFrames: Math.max(1, step || 1),
      triggerFrameIdx: fTrigger.frameIdx ?? tIdx,
      startFrameIdx: fStart.frameIdx ?? sIdx,
      endFrameIdx: fEnd.frameIdx ?? eIdx,
      triggerBattleSec: Number(((fTrigger.battleElapsedMs || 0) / 1000).toFixed(2)),
      startVideoSec: Number(((fStart.videoElapsedMs || sIdx * 100) / 1000).toFixed(2)),
      endVideoSec: Number(((fEnd.videoElapsedMs || eIdx * 100) / 1000).toFixed(2)),
      summary,
      details,
      frameSnapshots: frames.slice(sIdx, eIdx + 1).map((f) => ({
        f: f.frameIdx,
        tSec: Number(((f.battleElapsedMs || 0) / 1000).toFixed(2)),
        uHp: `${f.committedUserHpPct}%(${f.rawUserHpPct}%)`,
        oHp: `${f.committedOppHpPct}%(${f.rawOppHpPct}%)`,
        uE: f.userEnergy,
        oE: f.oppEnergy,
        lFill: f.leftCircleFillPct,
        rFill: f.rightCircleFillPct,
        uMon: f.activeUserSpecies,
        oMon: f.activeOppSpecies,
        cutscene: f.isCutsceneActive,
        actor: f.pendingChargeActor,
        banner: f.ocrMidBannerText,
      })),
    });
  };

  // 1. Start of Battle + First Lead Lock-In
  if (rules.battleStart?.enabled !== false) {
    const r = rules.battleStart || {};
    const step = r.sampleEveryNFrames || 2;
    const count = r.frameCount || 24;
    addEvent(
      "BATTLE_OPENING",
      "01_start",
      0,
      0,
      Math.min(totalFrames - 1, count * step - 1),
      step,
      "Battle start countdown and opening HUD initialization"
    );

    if (r.alsoCaptureAroundFirstSpeciesLock !== false) {
      const firstLockIdx = frames.findIndex(
        (f) =>
          (f.activeUserSpecies && f.activeUserSpecies.trim() !== "") ||
          (f.activeOppSpecies && f.activeOppSpecies.trim() !== "")
      );
      if (firstLockIdx > 6) {
        const fLock = frames[firstLockIdx];
        addEvent(
          "OPENING_SPECIES_LOCK",
          "01_start",
          firstLockIdx,
          firstLockIdx - (r.preLockFrames ?? 8),
          firstLockIdx + (r.postLockFrames ?? 16),
          1,
          `Opening lead locked: User=${fLock.activeUserSpecies || "?"} vs Opp=${fLock.activeOppSpecies || "?"}`,
          {
            userSpecies: fLock.activeUserSpecies,
            oppSpecies: fLock.activeOppSpecies,
            userHp: fLock.committedUserHpPct,
            oppHp: fLock.committedOppHpPct,
          }
        );
      }
    }
  }

  // 2. All Transitions IN and OUT of Charged Moves
  if (rules.chargedMoveTransitions?.enabled !== false) {
    const r = rules.chargedMoveTransitions || {};
    let inCutscene = false;
    let lastEntryIdx = -999;
    let lastExitIdx = -999;

    for (let i = 1; i < totalFrames; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      const prevActive = Boolean(
        prev.isCutsceneActive ||
          (prev.pendingChargeActor && prev.pendingChargeActor !== "") ||
          (prev.ocrMidBannerText && /used\s+/i.test(prev.ocrMidBannerText))
      );
      const currActive = Boolean(
        curr.isCutsceneActive ||
          (curr.pendingChargeActor && curr.pendingChargeActor !== "") ||
          (curr.ocrMidBannerText && /used\s+/i.test(curr.ocrMidBannerText))
      );

      if (!inCutscene && currActive && !prevActive) {
        inCutscene = true;
        if (i - lastEntryIdx >= (r.mergeWindowFrames ?? 10)) {
          lastEntryIdx = i;
          const actor = curr.pendingChargeActor || "unknown";
          const banner = curr.ocrMidBannerText || "";
          addEvent(
            `CHARGE_ENTER_${actor.toUpperCase()}`,
            "02_charge_in",
            i,
            i - (r.entryPreFrames ?? 12),
            i + (r.entryPostFrames ?? 12),
            r.entrySampleEveryNFrames ?? 1,
            `Transition IN to charged move (actor=${actor}, banner="${banner}", U:${prev.committedUserHpPct}%/${prev.userEnergy}E, O:${prev.committedOppHpPct}%/${prev.oppEnergy}E)`,
            {
              actor,
              banner,
              preUserHp: prev.committedUserHpPct,
              preOppHp: prev.committedOppHpPct,
              preUserEnergy: prev.userEnergy,
              preOppEnergy: prev.oppEnergy,
              preLeftFill: prev.leftCircleFillPct,
              preRightFill: prev.rightCircleFillPct,
            }
          );
        }
      } else if (inCutscene && !currActive && prevActive) {
        inCutscene = false;
        if (i - lastExitIdx >= (r.mergeWindowFrames ?? 10)) {
          lastExitIdx = i;
          const postSettled = frames[clampIdx(i + 8)] || curr;
          addEvent(
            "CHARGE_EXIT_SETTLE",
            "03_charge_out",
            i,
            i - (r.exitPreFrames ?? 8),
            i + (r.exitPostFrames ?? 16),
            r.exitSampleEveryNFrames ?? 1,
            `Transition OUT of charged move & HP settling (Exit U:${curr.committedUserHpPct}%->${postSettled.committedUserHpPct}%, O:${curr.committedOppHpPct}%->${postSettled.committedOppHpPct}%, Shields U:${curr.userShields} O:${curr.oppShields})`,
            {
              exitUserHp: curr.committedUserHpPct,
              settledUserHp: postSettled.committedUserHpPct,
              exitOppHp: curr.committedOppHpPct,
              settledOppHp: postSettled.committedOppHpPct,
              userEnergy: curr.userEnergy,
              oppEnergy: curr.oppEnergy,
              userShields: curr.userShields,
              oppShields: curr.oppShields,
            }
          );
        }
      }
    }
  }

  // 3. All Large HP Changes & Animation Periods (Drops, Upward Resets, or Raw vs Committed Divergence)
  if (rules.largeHpChangesAndAnimations?.enabled !== false) {
    const r = rules.largeHpChangesAndAnimations || {};
    const minDelta = r.minCommittedHpDeltaPct ?? 12;
    const minDiscrepancy = r.minRawVsCommittedDiscrepancyPct ?? 10;
    const cooldown = r.cooldownFrames ?? 12;
    let lastUserHpEventIdx = -999;
    let lastOppHpEventIdx = -999;

    for (let i = 1; i < totalFrames; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      // User HP change or large raw discrepancy
      const userDelta = curr.committedUserHpPct - prev.committedUserHpPct;
      const userRawDiff =
        curr.rawUserHpPct >= 0 && curr.committedUserHpPct >= 0
          ? Math.abs(curr.rawUserHpPct - curr.committedUserHpPct)
          : 0;

      if (
        i - lastUserHpEventIdx >= cooldown &&
        (Math.abs(userDelta) >= minDelta || userRawDiff >= minDiscrepancy)
      ) {
        lastUserHpEventIdx = i;
        const kind =
          Math.abs(userDelta) >= minDelta
            ? userDelta < 0
              ? "USER_HP_DROP"
              : "USER_HP_RISE"
            : "USER_HP_RAW_DIVERGENCE";
        addEvent(
          kind,
          "04_hp_change",
          i,
          i - (r.preAnimationFrames ?? 10),
          i + (r.postSettlingFrames ?? 14),
          r.sampleEveryNFrames ?? 1,
          `User HP ${kind}: committed ${prev.committedUserHpPct}% -> ${curr.committedUserHpPct}% (raw=${curr.rawUserHpPct}%, rowY=${curr.userHpRowY})`,
          {
            side: "user",
            prevCommittedHp: prev.committedUserHpPct,
            currCommittedHp: curr.committedUserHpPct,
            currRawHp: curr.rawUserHpPct,
            hpRowY: curr.userHpRowY,
            delta: userDelta,
          }
        );
      }

      // Opponent HP change or large raw discrepancy
      const oppDelta = curr.committedOppHpPct - prev.committedOppHpPct;
      const oppRawDiff =
        curr.rawOppHpPct >= 0 && curr.committedOppHpPct >= 0
          ? Math.abs(curr.rawOppHpPct - curr.committedOppHpPct)
          : 0;

      if (
        i - lastOppHpEventIdx >= cooldown &&
        (Math.abs(oppDelta) >= minDelta || oppRawDiff >= minDiscrepancy)
      ) {
        lastOppHpEventIdx = i;
        const kind =
          Math.abs(oppDelta) >= minDelta
            ? oppDelta < 0
              ? "OPP_HP_DROP"
              : "OPP_HP_RISE"
            : "OPP_HP_RAW_DIVERGENCE";
        addEvent(
          kind,
          "04_hp_change",
          i,
          i - (r.preAnimationFrames ?? 10),
          i + (r.postSettlingFrames ?? 14),
          r.sampleEveryNFrames ?? 1,
          `Opponent HP ${kind}: committed ${prev.committedOppHpPct}% -> ${curr.committedOppHpPct}% (raw=${curr.rawOppHpPct}%, rowY=${curr.oppHpRowY})`,
          {
            side: "opp",
            prevCommittedHp: prev.committedOppHpPct,
            currCommittedHp: curr.committedOppHpPct,
            currRawHp: curr.rawOppHpPct,
            hpRowY: curr.oppHpRowY,
            delta: oppDelta,
          }
        );
      }
    }
  }

  // 4. Species Swaps & Faints
  if (rules.speciesSwapsAndFaints?.enabled !== false) {
    const r = rules.speciesSwapsAndFaints || {};
    let lastSwapIdx = -999;
    for (let i = 1; i < totalFrames; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      const userSwapped =
        prev.activeUserSpecies &&
        curr.activeUserSpecies &&
        prev.activeUserSpecies !== curr.activeUserSpecies;
      const oppSwapped =
        prev.activeOppSpecies &&
        curr.activeOppSpecies &&
        prev.activeOppSpecies !== curr.activeOppSpecies;

      if ((userSwapped || oppSwapped) && i - lastSwapIdx >= (r.cooldownFrames ?? 12)) {
        lastSwapIdx = i;
        const who = userSwapped && oppSwapped ? "BOTH" : userSwapped ? "USER" : "OPP";
        addEvent(
          `SPECIES_SWAP_${who}`,
          "05_swap",
          i,
          i - (r.preSwapFrames ?? 10),
          i + (r.postSwapFrames ?? 14),
          r.sampleEveryNFrames ?? 1,
          `Species transition (${who}): User ${prev.activeUserSpecies || "?"}->${curr.activeUserSpecies || "?"}, Opp ${prev.activeOppSpecies || "?"}->${curr.activeOppSpecies || "?"}`,
          {
            prevUser: prev.activeUserSpecies,
            currUser: curr.activeUserSpecies,
            prevOpp: prev.activeOppSpecies,
            currOpp: curr.activeOppSpecies,
          }
        );
      }
    }
  }

  // 5. Energy Jumps & Unexplained Circle Drops
  if (rules.energyAnomaliesAndJumps?.enabled !== false) {
    const r = rules.energyAnomaliesAndJumps || {};
    const minJump = r.minSingleStepEnergyJump ?? 20;
    const minCircleDrop = r.minUnexplainedCircleDropPct ?? 18;
    let lastEnergyIdx = -999;

    for (let i = 1; i < totalFrames; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      const uJump = curr.userEnergy - prev.userEnergy;
      const oJump = curr.oppEnergy - prev.oppEnergy;
      const lDrop =
        prev.leftCircleFillPct >= 0 && curr.leftCircleFillPct >= 0 && !curr.isCutsceneActive
          ? prev.leftCircleFillPct - curr.leftCircleFillPct
          : 0;

      if (
        i - lastEnergyIdx >= (r.cooldownFrames ?? 15) &&
        (uJump >= minJump || oJump >= minJump || (lDrop >= minCircleDrop && uJump >= 0))
      ) {
        lastEnergyIdx = i;
        addEvent(
          "ENERGY_OR_CIRCLE_SHIFT",
          "06_energy",
          i,
          i - (r.preFrames ?? 8),
          i + (r.postFrames ?? 16),
          r.sampleEveryNFrames ?? 1,
          `Energy/Circle shift: U_E ${prev.userEnergy}->${curr.userEnergy}, O_E ${prev.oppEnergy}->${curr.oppEnergy}, L_Fill ${prev.leftCircleFillPct}%->${curr.leftCircleFillPct}%`,
          {
            prevUserE: prev.userEnergy,
            currUserE: curr.userEnergy,
            prevOppE: prev.oppEnergy,
            currOppE: curr.oppEnergy,
            prevLeftFill: prev.leftCircleFillPct,
            currLeftFill: curr.leftCircleFillPct,
          }
        );
      }
    }
  }

  // 6. Battle End Window
  if (rules.battleEnd?.enabled !== false && totalFrames > 10) {
    const r = rules.battleEnd || {};
    const step = r.sampleEveryNFrames || 2;
    const count = r.tailFrameCount || 24;
    const startIdx = Math.max(0, totalFrames - count * step);
    addEvent(
      "BATTLE_END_WINDOW",
      "07_end",
      totalFrames - 1,
      startIdx,
      totalFrames - 1,
      step,
      "End of battle KO / banner detection window"
    );
  }

  return events;
}

/**
 * Uses local `ffmpeg` to extract:
 *   1. A tiled contact sheet (`contact_sheet_<event.id>.jpg`) covering the full 24-frame window.
 *   2. Individual full-resolution screenshots around the trigger frame (`keyframes/<event.id>_F####.jpg`).
 */
function extractEventScreenshotsWithFfmpeg(videoPath, outDir, events, config) {
  if (!FFMPEG_BIN || !fs.existsSync(videoPath)) return { extractedSheets: 0, extractedKeyframes: 0 };

  const sheetCfg = config.contactSheet || {};
  const kfCfg = config.individualKeyframes || {};
  const sheetsDir = path.join(outDir, "contact_sheets");
  const keyframesDir = path.join(outDir, "keyframes");
  fs.mkdirSync(sheetsDir, { recursive: true });
  fs.mkdirSync(keyframesDir, { recursive: true });

  let extractedSheets = 0;
  let extractedKeyframes = 0;

  for (const ev of events) {
    // 1. Tiled Contact Sheet covering [startArrayIdx .. endArrayIdx]
    if (sheetCfg.enabled !== false) {
      const cols = sheetCfg.gridCols || 6;
      const rows = sheetCfg.gridRows || 4;
      const maxTiles = cols * rows;
      const step = Math.max(1, ev.sampleEveryNFrames || 1);
      const startFrame = ev.startArrayIdx;
      const endFrame = Math.min(ev.endArrayIdx, startFrame + maxTiles * step - 1);

      const sheetPath = path.join(sheetsDir, `${ev.id}.jpg`);
      if (!fs.existsSync(sheetPath)) {
        const tileW = sheetCfg.tileWidthPx || 272;
        const tileH = sheetCfg.tileHeightPx || 592;
        const vf =
          `select='between(n\\,${startFrame}\\,${endFrame})*not(mod(n-${startFrame}\\,${step}))',` +
          `scale=${tileW}:${tileH},` +
          `tile=${cols}x${rows}:padding=4:margin=2:color=0x0f172a`;
        const res = spawnSync(
          FFMPEG_BIN,
          [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            videoPath,
            "-vf",
            vf,
            "-frames:v",
            "1",
            "-q:v",
            String(sheetCfg.jpegQuality || 4),
            sheetPath,
          ],
          { windowsHide: true }
        );
        if (res.status === 0 && fs.existsSync(sheetPath)) {
          ev.contactSheetPath = sheetPath;
          extractedSheets++;
        }
      } else {
        ev.contactSheetPath = sheetPath;
      }
    }

    // 2. Full-Resolution Individual Screenshots across the animation/transition window
    if (kfCfg.enabled !== false) {
      const before = kfCfg.saveBeforeTriggerFrames ?? 4;
      const after = kfCfg.saveAfterTriggerFrames ?? 6;
      const step = Math.max(1, kfCfg.sampleStepFrames ?? 2);
      const kfStart = Math.max(ev.startArrayIdx, ev.triggerArrayIdx - before);
      const kfEnd = Math.min(ev.endArrayIdx, ev.triggerArrayIdx + after);
      ev.keyframePaths = [];

      for (let fIdx = kfStart; fIdx <= kfEnd; fIdx += step) {
        const outImg = path.join(
          keyframesDir,
          `${ev.id}_n${String(fIdx).padStart(4, "0")}.jpg`
        );
        if (!fs.existsSync(outImg)) {
          const vf = `select='eq(n\\,${fIdx})'`;
          const res = spawnSync(
            FFMPEG_BIN,
            [
              "-hide_banner",
              "-loglevel",
              "error",
              "-y",
              "-i",
              videoPath,
              "-vf",
              vf,
              "-frames:v",
              "1",
              "-q:v",
              String(kfCfg.jpegQuality || 3),
              outImg,
            ],
            { windowsHide: true }
          );
          if (res.status === 0 && fs.existsSync(outImg)) {
            ev.keyframePaths.push(outImg);
            extractedKeyframes++;
          }
        } else {
          ev.keyframePaths.push(outImg);
        }
      }
    }
  }

  return { extractedSheets, extractedKeyframes };
}

function preprocessDvrBundle(bundle, config, forceReprocess = false) {
  if (!bundle || !bundle.battleId) return false;
  const outDir = path.join(PREPROCESSED_DIR, bundle.battleId);
  const digestPath = path.join(outDir, "digest.json");

  if (!forceReprocess && fs.existsSync(digestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(digestPath, "utf8"));
      if (existing.configVersion === config.version && (!bundle.videoPath || existing.hasVideoScreenshots)) {
        bundle.preprocessedDigestPath = digestPath;
        return false;
      }
    } catch {}
  }

  if (!bundle.tracePath || !fs.existsSync(bundle.tracePath)) {
    return false;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const rawLines = fs
    .readFileSync(bundle.tracePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const frames = [];
  for (const line of rawLines) {
    try {
      frames.push(JSON.parse(line));
    } catch {}
  }
  if (frames.length === 0) return false;

  const events = analyzeDeepTraceEvents(frames, config);
  let screenshotStats = { extractedSheets: 0, extractedKeyframes: 0 };
  const hasVideo = Boolean(bundle.videoPath && fs.existsSync(bundle.videoPath));
  if (hasVideo) {
    screenshotStats = extractEventScreenshotsWithFfmpeg(bundle.videoPath, outDir, events, config);
  }

  const firstFrame = frames[0];
  const lastFrame = frames[frames.length - 1];
  const distinctUserSpecies = [
    ...new Set(frames.map((f) => f.activeUserSpecies).filter(Boolean)),
  ];
  const distinctOppSpecies = [
    ...new Set(frames.map((f) => f.activeOppSpecies).filter(Boolean)),
  ];

  const digest = {
    battleId: bundle.battleId,
    screenName: bundle.screenName,
    appVersion: bundle.appVersion,
    league: bundle.league,
    result: bundle.result,
    preprocessedAt: new Date().toISOString(),
    configVersion: config.version,
    totalFrames: frames.length,
    durationSec: Number(((lastFrame.videoElapsedMs || frames.length * 100) / 1000).toFixed(2)),
    distinctUserSpecies,
    distinctOppSpecies,
    hasVideoScreenshots: hasVideo && FFMPEG_BIN !== null,
    extractedContactSheetsCount: screenshotStats.extractedSheets,
    extractedKeyframesCount: screenshotStats.extractedKeyframes,
    rawVideoPath: bundle.videoPath || null,
    rawTracePath: bundle.tracePath,
    eventCountsByCategory: events.reduce((acc, ev) => {
      acc[ev.category] = (acc[ev.category] || 0) + 1;
      return acc;
    }, {}),
    events,
  };

  fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2), "utf8");
  bundle.preprocessedDigestPath = digestPath;
  bundle.preprocessedEventCount = events.length;
  return true;
}

// ============================================================================
// LOCAL 1.0 GB STORAGE QUOTA ENFORCER
// ============================================================================

function collectFilesRecursive(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, list);
    } else if (entry.isFile()) {
      try {
        const st = fs.statSync(full);
        list.push({ path: full, size: st.size, mtimeMs: st.mtimeMs });
      } catch {}
    }
  }
  return list;
}

function enforceLocalStorageQuota(config) {
  const maxMb = config.storage?.maxLocalStorageMb ?? 1024;
  const targetMb = config.storage?.pruneTargetStorageMb ?? 950;
  const maxBytes = maxMb * 1024 * 1024;
  const targetBytes = targetMb * 1024 * 1024;

  const allFiles = collectFilesRecursive(CACHE_DIR);
  let totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes <= maxBytes) {
    return { totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)), evictedFiles: 0 };
  }

  // Never delete state metadata or latest report
  const protectedPaths = new Set([STATE_FILE, SUMMARY_FILE, SYNC_LOG_FILE]);
  const candidates = allFiles.filter((f) => !protectedPaths.has(f.path));

  // Sort: oldest raw .mp4 files first (if configured), then oldest remaining files
  candidates.sort((a, b) => {
    const aIsMp4 = a.path.endsWith(".mp4") ? 0 : 1;
    const bIsMp4 = b.path.endsWith(".mp4") ? 0 : 1;
    if (config.storage?.evictOldestRawMp4FirstWhenOverQuota !== false && aIsMp4 !== bIsMp4) {
      return aIsMp4 - bIsMp4;
    }
    return a.mtimeMs - b.mtimeMs;
  });

  let evictedFiles = 0;
  for (const file of candidates) {
    if (totalBytes <= targetBytes) break;
    try {
      fs.unlinkSync(file.path);
      totalBytes -= file.size;
      evictedFiles++;
    } catch {}
  }

  return {
    totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)),
    evictedFiles,
  };
}

// ============================================================================
// MAIN SYNC, PREPROCESS & ON-DEMAND REPORT ENGINE
// ============================================================================

async function runOnce() {
  const config = loadPreprocessConfig();
  const state = loadCacheState();
  let newBatchesCount = 0;
  let newBattlesCount = 0;
  let newSettingsLogsCount = 0;
  let newDvrFilesCount = 0;
  let preprocessedBundlesCount = 0;
  let prunedRemoteKeys = 0;

  if (!REPORT_ONLY && !REPROCESS_LOCAL) {
    // 1. Ingest Always-On Lower-Resolution Battle Telemetry Batches (`batches/...`)
    const batchObjects = await listAllObjectsByPrefix("batches/");
    for (const obj of batchObjects) {
      const key = obj.key;
      if (!key || !key.endsWith(".jsonl")) continue;
      const batchId = path.basename(key, ".jsonl");

      if (state.ingestedBatchIds[batchId] || state.ingestedKeys[key]) {
        if (PRUNE_REMOTE) {
          if (await adminDeleteObject(key)) prunedRemoteKeys++;
        }
        continue;
      }

      const rawJsonl = await adminFetchText(key);
      if (!rawJsonl) continue;

      const localBatchPath = path.join(BATCHES_DIR, `${batchId}.jsonl`);
      fs.writeFileSync(localBatchPath, rawJsonl, "utf8");

      const lines = rawJsonl
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const metaScreenName = obj.customMetadata?.screenName || "unknown";
      const metaAppVer = obj.customMetadata?.appVersion || "unknown";

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (!parsed.screenName && metaScreenName !== "unknown") {
            parsed.screenName = metaScreenName;
          }
          if (!parsed.appVersion && metaAppVer !== "unknown") {
            parsed.appVersion = metaAppVer;
          }
          state.records.push(parsed);
          newBattlesCount++;
        } catch {}
      }

      state.ingestedBatchIds[batchId] = {
        source: "cloudflare",
        key,
        screenName: metaScreenName,
        appVersion: metaAppVer,
        ingestedAt: new Date().toISOString(),
        battleCount: lines.length,
      };
      state.ingestedKeys[key] = true;
      newBatchesCount++;

      if (PRUNE_REMOTE) {
        if (await adminDeleteObject(key)) prunedRemoteKeys++;
        const userMirrorKey = `users/${metaScreenName}/batches/${batchId}.jsonl`;
        await adminDeleteObject(userMirrorKey);
      }
    }

    // 2. Ingest Settings Change Audit Logs (`users/<screenName>/settings_changes/...`)
    const userObjects = await listAllObjectsByPrefix("users/");
    for (const obj of userObjects) {
      const key = obj.key;
      if (!key || !key.includes("/settings_changes/") || !key.endsWith(".jsonl")) continue;
      if (state.ingestedKeys[key]) {
        if (PRUNE_REMOTE && (await adminDeleteObject(key))) prunedRemoteKeys++;
        continue;
      }

      const rawJsonl = await adminFetchText(key);
      if (!rawJsonl) continue;

      const screenName = obj.customMetadata?.screenName || key.split("/")[1] || "unknown";
      const safeFile = key.replace(/[^A-Za-z0-9_.-]/g, "_");
      fs.writeFileSync(path.join(SETTINGS_DIR, safeFile), rawJsonl, "utf8");

      const lines = rawJsonl
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          state.settingsChanges.push({ screenName, ...parsed });
        } catch {}
      }

      state.ingestedKeys[key] = true;
      newSettingsLogsCount++;

      if (PRUNE_REMOTE && (await adminDeleteObject(key))) {
        prunedRemoteKeys++;
      }
    }

    // 3. Ingest 1-Battle DVR Bundles (`recordings/<screenName>/<battleId>_video.mp4` & `_deep_trace.jsonl`)
    const recordingObjects = await listAllObjectsByPrefix("recordings/");
    for (const obj of recordingObjects) {
      const key = obj.key;
      if (!key) continue;
      const isVideo = key.endsWith("_video.mp4");
      const isTrace = key.endsWith("_deep_trace.jsonl");
      if (!isVideo && !isTrace) continue;
      if (isVideo && SKIP_VIDEOS) continue;

      const parts = key.split("/");
      const screenName = obj.customMetadata?.screenName || parts[1] || "unknown";
      const fileName = parts.slice(2).join("_");
      const userRecDir = path.join(RECORDINGS_DIR, screenName);
      fs.mkdirSync(userRecDir, { recursive: true });
      const localFilePath = path.join(userRecDir, fileName);

      if (state.ingestedKeys[key] && fs.existsSync(localFilePath)) {
        if (PRUNE_REMOTE && (await adminDeleteObject(key))) prunedRemoteKeys++;
        continue;
      }

      if (isTrace) {
        const text = await adminFetchText(key);
        if (text === null) continue;
        fs.writeFileSync(localFilePath, text, "utf8");
      } else if (isVideo) {
        const bytes = await adminFetchBytes(key);
        if (!bytes) continue;
        fs.writeFileSync(localFilePath, bytes);
      }

      const battleId =
        obj.customMetadata?.battleId ||
        fileName.replace(/_(video\.mp4|deep_trace\.jsonl)$/, "");
      const bundle = state.dvrBundles[battleId] || {
        battleId,
        screenName,
        appVersion: obj.customMetadata?.appVersion || "unknown",
        league: obj.customMetadata?.league || "Unknown",
        result: obj.customMetadata?.result || "UNKNOWN",
        uploadedAt: obj.customMetadata?.uploadedAt || obj.uploaded,
      };
      if (isVideo) bundle.videoPath = localFilePath;
      if (isTrace) bundle.tracePath = localFilePath;
      state.dvrBundles[battleId] = bundle;

      state.ingestedKeys[key] = true;
      newDvrFilesCount++;

      if (PRUNE_REMOTE && (await adminDeleteObject(key))) {
        prunedRemoteKeys++;
      }
    }
  }

  // 4. Local CPU + ffmpeg Preprocessing of DVR Bundles (Start, Charged In/Out, Large HP Animations, Swaps, End)
  for (const bundle of Object.values(state.dvrBundles)) {
    if (preprocessDvrBundle(bundle, config, REPROCESS_LOCAL)) {
      preprocessedBundlesCount++;
    }
  }

  saveCacheState(state);

  // 5. Enforce 1.0 GB Local Storage Cap
  const quotaStatus = enforceLocalStorageQuota(config);

  if (SYNC_ONLY) {
    const syncLine = `batches=+${newBatchesCount} battles=+${newBattlesCount} dvrFiles=+${newDvrFilesCount} preprocessed=+${preprocessedBundlesCount} prunedRemote=${prunedRemoteKeys} localMb=${quotaStatus.totalMb}MB evictedLocal=${quotaStatus.evictedFiles}`;
    appendSyncLog(syncLine);
    console.log(`[SYNC-ONLY] ${syncLine}`);
    return;
  }

  // 6. On-Demand Anomaly & DVR Preprocessed Report Generation
  const allAnomalies = state.records.flatMap((r) => {
    const appVer = r.appVersion || r.scannerSettings?.appVersion || r.schemaVersion || "unknown";
    const trainer = r.screenName || r.uploaderHandle || r.githubUser || "unknown";
    return (r.anomalies || []).map((a) => ({
      battleId: r.battleId,
      screenName: trainer,
      appVersion: appVer,
      league: r.league,
      teamName: r.teamName,
      result: r.result,
      userPokemon: r.userPokemon,
      opponentsSeenOrder: r.opponentsSeenOrder,
      userTeamSpecs: r.userTeamSpecs,
      oppTeamSpecs: r.oppTeamSpecs,
      ...a,
    }));
  });

  const battlesByAppVersion = {};
  const anomaliesByAppVersion = {};
  const battlesByTrainer = {};
  for (const r of state.records) {
    const ver = r.appVersion || r.scannerSettings?.appVersion || r.schemaVersion || "unknown";
    const trainer = r.screenName || r.uploaderHandle || r.githubUser || "unknown";
    battlesByAppVersion[ver] = (battlesByAppVersion[ver] || 0) + 1;
    battlesByTrainer[trainer] = (battlesByTrainer[trainer] || 0) + 1;
    const aCount = Array.isArray(r.anomalies) ? r.anomalies.length : 0;
    anomaliesByAppVersion[ver] = (anomaliesByAppVersion[ver] || 0) + aCount;
  }

  const summary = {
    updatedAt: new Date().toISOString(),
    workerUrl: DEFAULT_WORKER_URL,
    ffmpegPath: FFMPEG_BIN,
    preprocessConfigPath: CONFIG_PATH,
    localStorageMb: quotaStatus.totalMb,
    maxLocalStorageMb: config.storage?.maxLocalStorageMb ?? 1024,
    newlyIngestedBatches: newBatchesCount,
    newlyIngestedBattles: newBattlesCount,
    newlyIngestedSettingsLogs: newSettingsLogsCount,
    newlyIngestedDvrFiles: newDvrFilesCount,
    newlyPreprocessedDvrBundles: preprocessedBundlesCount,
    prunedRemoteKeys,
    totalCachedBatches: Object.keys(state.ingestedBatchIds).length,
    totalCachedBattles: state.records.length,
    totalCachedDvrBundles: Object.keys(state.dvrBundles).length,
    totalAnomalies: allAnomalies.length,
    battlesByTrainer,
    battlesByAppVersion,
    anomaliesByAppVersion,
    recentDvrBundles: Object.values(state.dvrBundles).slice(-15),
    recentAnomalies: allAnomalies.slice(-25),
  };
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  if (WATCH_MODE) {
    console.log(`[WATCH] Polling ${DEFAULT_WORKER_URL} every 30s (local CPU + ffmpeg preprocessing)...`);
    while (true) {
      try {
        await runOnce();
      } catch (err) {
        console.error("[WATCH ERROR]", err.message || err);
      }
      await new Promise((r) => setTimeout(r, 30_000));
    }
  } else {
    await runOnce();
  }
}

main().catch((err) => {
  appendSyncLog(`ERROR: ${err.message || err}`);
  console.error(err);
  process.exit(1);
});
