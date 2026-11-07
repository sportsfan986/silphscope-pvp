#!/usr/bin/env node
/**
 * SilphScope PvP v6.40 — Cloudflare Multi-User AI Telemetry, Local Video/Trace Preprocessor & On-Demand Reporter
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
import dns from "node:dns";
import { spawnSync } from "node:child_process";

// Resilient DNS lookup override for `silphscope-telemetry.silphscope-pvp.workers.dev`
// Bypasses Windows/router DNS `ENOENT` or `AAAA ::` sinkholes by falling back to Cloudflare IPv4 edge IPs.
const origDnsLookup = dns.lookup.bind(dns);
dns.lookup = function patchedDnsLookup(hostname, options, callback) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "function" ? {} : options || {};
  const isWorkerHost =
    typeof hostname === "string" &&
    hostname.toLowerCase() === "silphscope-telemetry.silphscope-pvp.workers.dev";

  origDnsLookup(hostname, opts, (err, address, family) => {
    if (!isWorkerHost) {
      return cb(err, address, family);
    }
    const isBogusAddr = (a) =>
      !a || a === "::" || a === "0:0:0:0:0:0:0:0" || a === "0.0.0.0" || a.startsWith("127.");
    if (!err && address) {
      if (Array.isArray(address)) {
        const valid = address.filter((entry) => !isBogusAddr(entry && entry.address));
        valid.sort((a, b) => (a.family === 4 ? -1 : 1) - (b.family === 4 ? -1 : 1));
        if (valid.length > 0 && valid.some((e) => e.family === 4)) {
          return cb(null, valid);
        }
      } else if (!isBogusAddr(address) && family === 4) {
        return cb(null, address, family);
      }
    }
    if (opts && opts.all) {
      return cb(null, [
        { address: "104.21.76.162", family: 4 },
        { address: "172.67.197.119", family: 4 },
      ]);
    }
    return cb(null, "104.21.76.162", 4);
  });
};

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
const LOCK_FILE = path.join(CACHE_DIR, "ingest.lock");

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
        exitPostFrames: 24,
        exitSampleEveryNFrames: 1,
        postExitKeyframeFrames: 18,
        postExitKeyframeStep: 1,
        mergeWindowFrames: 10,
      },
      buffsAndDebuffs: {
        enabled: true,
        preFrames: 8,
        postFrames: 16,
        sampleEveryNFrames: 1,
        cooldownFrames: 8,
        saveEveryFrameKeyframe: true,
      },
      largeHpChangesAndAnimations: {
        enabled: true,
        minCommittedHpDeltaPct: 12,
        minRawVsCommittedDiscrepancyPct: 10,
        preAnimationFrames: 10,
        postSettlingFrames: 14,
        sampleEveryNFrames: 1,
        cooldownFrames: 25,
        maxEventsPerBattle: 25,
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

function acquireIngestLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const st = fs.statSync(LOCK_FILE);
      const ageMs = Date.now() - st.mtimeMs;
      // Stale lock recovery after 8 minutes
      if (ageMs < 8 * 60 * 1000) {
        return false;
      }
    }
    fs.writeFileSync(
      LOCK_FILE,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), argv: rawArgs }),
      "utf8"
    );
    return true;
  } catch {
    return true;
  }
}

function releaseIngestLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {}
}

function loadCacheState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      return {
        ingestedBatchIds: parsed.ingestedBatchIds || {},
        ingestedKeys: parsed.ingestedKeys || {},
        userTiers: parsed.userTiers || { sportsfan986: "vip" },
        records: Array.isArray(parsed.records) ? parsed.records : [],
        settingsChanges: Array.isArray(parsed.settingsChanges) ? parsed.settingsChanges : [],
        dvrBundles: parsed.dvrBundles || {},
      };
    }
  } catch {}
  return {
    ingestedBatchIds: {},
    ingestedKeys: {},
    userTiers: { sportsfan986: "vip" },
    records: [],
    settingsChanges: [],
    dvrBundles: {},
  };
}

function saveCacheState(state) {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const onDisk = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      state.ingestedBatchIds = { ...(onDisk.ingestedBatchIds || {}), ...(state.ingestedBatchIds || {}) };
      state.ingestedKeys = { ...(onDisk.ingestedKeys || {}), ...(state.ingestedKeys || {}) };
      state.userTiers = { ...(onDisk.userTiers || {}), ...(state.userTiers || {}) };
      const mergedBundles = { ...(onDisk.dvrBundles || {}) };
      for (const [bId, bVal] of Object.entries(state.dvrBundles || {})) {
        mergedBundles[bId] = { ...(mergedBundles[bId] || {}), ...bVal };
      }
      state.dvrBundles = mergedBundles;
      const byBattleId = new Map();
      for (const r of [...(onDisk.records || []), ...(state.records || [])]) {
        if (!r || !r.battleId) continue;
        const prev = byBattleId.get(r.battleId);
        if (!prev || (Array.isArray(r.anomalies) && r.anomalies.length >= (prev.anomalies?.length || 0))) {
          byBattleId.set(r.battleId, { ...(prev || {}), ...r });
        }
      }
      state.records = [...byBattleId.values()];
    }
  } catch {}
  const tmpFile = `${STATE_FILE}.tmp.${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpFile, STATE_FILE);
}

const TIER_RANK_MAP = {
  vip: 4,
  pro: 3,
  supporter: 2,
  base: 2,
  alumni: 2,
  free: 1,
};

function normalizeTier(rawTier, screenName = "") {
  if (String(screenName || "").toLowerCase() === "sportsfan986") return "vip";
  const t = String(rawTier || "free").toLowerCase().trim();
  if (t === "vip") return "vip";
  if (t === "pro") return "pro";
  if (t === "supporter" || t === "base" || t === "alumni") return "supporter";
  return "free";
}

function resolveUserTier(screenName, userTiers = {}) {
  const clean = String(screenName || "").trim();
  if (!clean) return "free";
  if (clean.toLowerCase() === "sportsfan986") return "vip";
  const direct = userTiers[clean] || userTiers[clean.toLowerCase()];
  return normalizeTier(direct, clean);
}

function computePriorityMetadata({ manuallyFlagged, userTier, severity }) {
  const tier = normalizeTier(userTier);
  const tierRank = TIER_RANK_MAP[tier] || 1;
  const isPaid = tierRank >= 2;
  const isManual = Boolean(manuallyFlagged);
  const sevUpper = String(severity || "WARN").toUpperCase();
  const severityRank = sevUpper === "HIGH" || sevUpper === "CRITICAL" ? 2 : 1;

  let priorityBucket = "P4_FREE_AUTO";
  let priorityGroupRank = 1;
  if (isManual && isPaid) {
    priorityBucket = "P1_PAID_MANUAL";
    priorityGroupRank = 4;
  } else if (isManual && !isPaid) {
    priorityBucket = "P2_FREE_MANUAL";
    priorityGroupRank = 3;
  } else if (!isManual && isPaid) {
    priorityBucket = "P3_PAID_AUTO";
    priorityGroupRank = 2;
  }

  const compositePriorityScore =
    priorityGroupRank * 1000 + tierRank * 100 + severityRank * 10;

  return {
    priorityBucket,
    priorityGroupRank,
    userTier: tier,
    userTierLabel: tier.toUpperCase(),
    tierRank,
    isPaidTier: isPaid,
    manuallyFlagged: isManual,
    severityRank,
    compositePriorityScore,
  };
}

/**
 * Zero-Token Local Root-Cause Classifier:
 * Cross-references battle timeline events, post-cutscene HP audits, and energy mutation ledgers
 * to automatically classify known engine/vision patterns without spending AI tokens.
 */
function classifyAnomalyLocally(anomaly, record) {
  const code = String(anomaly?.type || anomaly?.code || "");
  const detail = String(anomaly?.detail || anomaly?.message || "");
  const t = Number(anomaly?.tSec ?? anomaly?.t ?? 0);
  const events = Array.isArray(record?.timelineEvents) ? record.timelineEvents : [];
  const audits = Array.isArray(record?.postCutsceneHpAudits) ? record.postCutsceneHpAudits : [];
  const chargedEvents = events.filter((e) => e && e.type === "CHARGED_ATTACK");

  if (code === "USER_MANUAL_ISSUE_REPORT") {
    return {
      category: "USER_MANUAL_BUG_REPORT",
      confidence: "HIGH",
      isFalsePositive: false,
      rootCause: detail || "User explicitly flagged this battle for developer review.",
      suggestedFix: "Inspect userIssueNote and associated contact sheets / deep trace around reported timestamp.",
    };
  }

  // 1. Check for CMP Tie Dual CHARGED_ATTACK collision (two charged moves within <= 0.35s)
  const nearbyCharged = chargedEvents.filter((e) => Math.abs(Number(e.t ?? e.tSec ?? 0) - t) <= 0.35);
  if (nearbyCharged.length >= 2) {
    return {
      category: "CMP_TIE_DUAL_CHARGE_TRANSITION",
      confidence: "HIGH",
      isFalsePositive: code === "SHIELD_DESYNC",
      rootCause:
        "Genuine CMP tie transition where 1st charged move finalized as 2nd charged move prompt began; defender HP drain finished during/after 2nd cutscene.",
      suggestedFix:
        "Resolved in v7.04 (Case 2 CMP uses pendingChargedAttackStartMs, samples post-minigame HP drain, and extends retroactive HP settle window to 12s).",
    };
  }

  // 2. Check for Swap-During-Cutscene Banner Clear (POST_CIRCLE_FIT when banner OCR matched a different move)
  const matchingEv = chargedEvents.find((e) => Math.abs(Number(e.t ?? e.tSec ?? 0) - t) <= 1.0);
  const moveResSrc = anomaly?.moveResolutionSource || matchingEv?.moveResolutionSource || "";
  if (
    (code === "UNEXPECTED_HP_DELTA" || code === "UNSHIELDED_DAMAGE_MISMATCH") &&
    moveResSrc === "POST_CIRCLE_FIT"
  ) {
    return {
      category: "SWAP_DURING_CUTSCENE_BANNER_CLEARED",
      confidence: "HIGH",
      isFalsePositive: false,
      rootCause:
        "Player queued a switch during the charged move cutscene, clearing lastDetectedBannerMoveName before Section 4 reconciled the move and falling back to POST_CIRCLE_FIT.",
      suggestedFix:
        "Resolved in v7.04 (preserve lastDetectedBannerMoveName while pendingChargedAttackActor is active and fall back to lastUserChargeResolvedMoveName).",
    };
  }

  // 3. Check for Legacy Air Cutter (60p/40E) Overestimate on Charizard
  if (
    (code === "UNEXPECTED_HP_DELTA" || code === "UNSHIELDED_DAMAGE_MISMATCH") &&
    (/Air Cutter/i.test(detail) || /^Air Cutter$/i.test(String(anomaly?.moveName || "")))
  ) {
    return {
      category: "LEGACY_STATIC_MOVE_STATS_OVERESTIMATE",
      confidence: "HIGH",
      isFalsePositive: true,
      rootCause:
        "Static fallback table had legacy Air Cutter stats (60 power / 40E instead of PvPoke's updated 45 power / 35E), inflating expectedDmgPct to 59%.",
      suggestedFix: "Resolved in v7.04 (Air Cutter updated to 45 power / 35E in PokemonDatabase.kt).",
    };
  }

  // 4. Check for Post-Cutscene Camera Zoom Upward Row-Y Spike (oppHpRowY < 750)
  const matchingAudit = audits.find((a) => Math.abs(Number(a.tSec || 0) - t) <= 12.0);
  const auditOppRowY = Number(matchingAudit?.oppHpRowY ?? matchingAudit?.oppHpRowYAtExit ?? 999);
  if (
    (code === "UNEXPECTED_HP_DELTA" || code === "UNSHIELDED_DAMAGE_MISMATCH") &&
    matchingAudit &&
    auditOppRowY > 0 &&
    auditOppRowY < 750
  ) {
    return {
      category: "POST_CUTSCENE_CAMERA_ZOOM_ROW_Y_SPIKE",
      confidence: "HIGH",
      isFalsePositive: false,
      rootCause: `Post-cutscene camera zoom shifted oppHpRowY upward to y=${auditOppRowY}px, latching a transient low HP% before settling.`,
      suggestedFix:
        "Resolved in v7.04 (Section 1B guards against upward oppHpRowY shifts < 0.31h and fast-recovers from <=15% false locks).",
    };
  }

  // 5. Check for HP_DELTA Retroactive Move Inference Energy Mismatch
  if (
    (code === "ENERGY_DEFICIT_THROW" || code === "ENERGY_DEFICIT_AT_THROW") &&
    (moveResSrc === "HP_DELTA" || /src=HP_DELTA/i.test(detail))
  ) {
    return {
      category: "HP_DELTA_RETROACTIVE_ENERGY_MISMATCH",
      confidence: "HIGH",
      isFalsePositive: true,
      rootCause:
        "Section 1A/4 HP_DELTA move inference either initially selected a higher-cost move before HP finished draining or updated inferredMoveName without recalculating requiredMoveEnergy/energyDeficit.",
      suggestedFix:
        "Resolved in v7.04 (filter HP_DELTA candidates by preThrowEnergy feasibility and recalculate requiredMoveEnergy & energyDeficit in Section 1A).",
    };
  }

  // 6. Check for 1-Fast-Move Turn Boundary Variance (deficit <= 14E)
  const deficitMatch = detail.match(/deficit\s*-?(\d+)E/i);
  const deficitVal = Number(anomaly?.energyDeficit ?? (deficitMatch ? deficitMatch[1] : 999));
  if ((code === "ENERGY_DEFICIT_THROW" || code === "ENERGY_DEFICIT_AT_THROW") && deficitVal <= 14) {
    return {
      category: "ONE_FAST_MOVE_TURN_BOUNDARY_VARIANCE",
      confidence: "HIGH",
      isFalsePositive: true,
      rootCause: `Minor 1-fast-move turn boundary timing variance (deficit=${deficitVal}E) during simultaneous tap/zoom transition.`,
      suggestedFix: "Benign 1-turn cadence boundary variance; no action required.",
    };
  }

  // 7. Check for Delayed Post-KO Replacement Nameplate OCR
  if ((code === "ENERGY_DEFICIT_THROW" || code === "ENERGY_DEFICIT_AT_THROW") && deficitVal > 14) {
    return {
      category: "DELAYED_POST_KO_REPLACEMENT_OCR",
      confidence: "MEDIUM",
      isFalsePositive: false,
      rootCause: `Replacement opponent nameplate OCR arrived late after previous opponent KO + immediate charged attack/BLOCKED! banner (deficit=${deficitVal}E).`,
      suggestedFix:
        "Resolved in v7.04 (handleOpponentLines credits elapsed post-KO fast-move turns from lastSlotKoTimeMs when replacement species is first recognized).",
    };
  }

  if (code === "ENERGY_CAP_DRIFT") {
    return {
      category: "CIRCLE_SHRINK_PRE_THROW_CAPTURE",
      confidence: "MEDIUM",
      isFalsePositive: true,
      rootCause: "Charge button circle began shrinking on the tap frame right as the minigame started.",
      suggestedFix: "Benign pre-minigame circle shrink artifact; tracked energy was already sufficient.",
    };
  }

  return {
    category: "LEGACY_PRE_V704_ANOMALY",
    confidence: "LOW",
    isFalsePositive: false,
    rootCause: detail,
    suggestedFix: "Inspect preprocessed contact sheets and _deep_trace.jsonl around timestamp.",
  };
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
      "User-Agent": "SilphScopePvP-CloudflareIngest/6.40",
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
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.40",
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
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.40",
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
        "User-Agent": "SilphScopePvP-CloudflareIngest/6.40",
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

  const addEvent = (type, category, triggerIdx, startIdx, endIdx, step, summary, details = {}, kfOverrides = null) => {
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
      saveBeforeTriggerFramesOverride: kfOverrides?.before,
      saveAfterTriggerFramesOverride: kfOverrides?.after,
      sampleStepFramesOverride: kfOverrides?.step,
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
        uAtk: f.userAtkStage ?? 0,
        uDef: f.userDefStage ?? 0,
        uDisg: Boolean(f.userDisguiseBusted),
        oAtk: f.oppAtkStage ?? 0,
        oDef: f.oppDefStage ?? 0,
        oDisg: Boolean(f.oppDisguiseBusted),
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
          const exitPost = r.exitPostFrames ?? 24;
          const postSettled = frames[clampIdx(i + 8)] || curr;
          const postWindowFrames = frames.slice(Math.max(0, i - 2), clampIdx(i + exitPost) + 1);
          const detectedBuffDebuffBanners = [
            ...new Set(
              postWindowFrames
                .map((f) => [f.ocrMidBannerText, f.ocrOppTopText, f.ocrUserTopText].filter(Boolean).join(" | "))
                .filter((txt) =>
                  /(attack|defense|attacco|difesa|ataque|defensa|angriff|verteidigung|attaque|d[eé]fense)\s+(rose|fell|harshly|sharply|severely|drastically)/i.test(
                    txt
                  ) || /disguise\s+is\s+busted/i.test(txt)
                )
            ),
          ];
          addEvent(
            "CHARGE_EXIT_SETTLE",
            "03_charge_out",
            i,
            i - (r.exitPreFrames ?? 8),
            i + exitPost,
            r.exitSampleEveryNFrames ?? 1,
            `Transition OUT of charged move, HP settling & buff/debuff validation (Exit U:${curr.committedUserHpPct}%->${postSettled.committedUserHpPct}%, O:${curr.committedOppHpPct}%->${postSettled.committedOppHpPct}%, Shields U:${curr.userShields} O:${curr.oppShields}${detectedBuffDebuffBanners.length > 0 ? `, BuffCallout="${detectedBuffDebuffBanners.join("; ")}"` : ""})`,
            {
              exitUserHp: curr.committedUserHpPct,
              settledUserHp: postSettled.committedUserHpPct,
              exitOppHp: curr.committedOppHpPct,
              settledOppHp: postSettled.committedOppHpPct,
              userEnergy: curr.userEnergy,
              oppEnergy: curr.oppEnergy,
              userShields: curr.userShields,
              oppShields: curr.oppShields,
              userAtkStage: postSettled.userAtkStage ?? curr.userAtkStage ?? 0,
              userDefStage: postSettled.userDefStage ?? curr.userDefStage ?? 0,
              oppAtkStage: postSettled.oppAtkStage ?? curr.oppAtkStage ?? 0,
              oppDefStage: postSettled.oppDefStage ?? curr.oppDefStage ?? 0,
              detectedBuffDebuffBanners,
            },
            {
              before: 4,
              after: r.postExitKeyframeFrames ?? 18,
              step: r.postExitKeyframeStep ?? 1,
            }
          );
        }
      }
    }
  }

  // 2b. Buffs, Debuffs & Mimikyu Disguise Events (OCR Callouts + Stage Transitions)
  if (rules.buffsAndDebuffs?.enabled !== false) {
    const r = rules.buffsAndDebuffs || {};
    const cooldown = r.cooldownFrames ?? 8;
    let lastBuffEventIdx = -999;
    const buffRe =
      /(attack|defense|attacco|difesa|ataque|defensa|angriff|verteidigung|attaque|d[eé]fense)\s+(sharply\s+rose|drastically\s+rose|rose|harshly\s+fell|severely\s+fell|fell)/i;
    const disguiseRe = /disguise\s+is\s+busted/i;

    for (let i = 1; i < totalFrames; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];
      const combinedOcr = [curr.ocrMidBannerText, curr.ocrOppTopText, curr.ocrUserTopText]
        .filter(Boolean)
        .join(" | ");
      const prevOcr = [prev.ocrMidBannerText, prev.ocrOppTopText, prev.ocrUserTopText]
        .filter(Boolean)
        .join(" | ");

      const hasBuffCallout =
        (buffRe.test(combinedOcr) && !buffRe.test(prevOcr)) ||
        (disguiseRe.test(combinedOcr) && !disguiseRe.test(prevOcr));
      const stageChanged =
        (curr.userAtkStage ?? 0) !== (prev.userAtkStage ?? 0) ||
        (curr.userDefStage ?? 0) !== (prev.userDefStage ?? 0) ||
        (curr.oppAtkStage ?? 0) !== (prev.oppAtkStage ?? 0) ||
        (curr.oppDefStage ?? 0) !== (prev.oppDefStage ?? 0) ||
        Boolean(curr.userDisguiseBusted) !== Boolean(prev.userDisguiseBusted) ||
        Boolean(curr.oppDisguiseBusted) !== Boolean(prev.oppDisguiseBusted);

      if ((hasBuffCallout || stageChanged) && i - lastBuffEventIdx >= cooldown) {
        lastBuffEventIdx = i;
        const kind = disguiseRe.test(combinedOcr)
          ? "MIMIKYU_DISGUISE_BUST"
          : hasBuffCallout
          ? "OCR_BUFF_DEBUFF_CALLOUT"
          : "STAT_STAGE_CHANGE";
        addEvent(
          kind,
          "03b_buff_debuff",
          i,
          i - (r.preFrames ?? 8),
          i + (r.postFrames ?? 16),
          r.sampleEveryNFrames ?? 1,
          `Buff/Debuff (${kind}): OCR="${combinedOcr}", U_Stage=[A:${prev.userAtkStage ?? 0}->${curr.userAtkStage ?? 0}, D:${prev.userDefStage ?? 0}->${curr.userDefStage ?? 0}], O_Stage=[A:${prev.oppAtkStage ?? 0}->${curr.oppAtkStage ?? 0}, D:${prev.oppDefStage ?? 0}->${curr.oppDefStage ?? 0}]`,
          {
            kind,
            ocrText: combinedOcr,
            userSpecies: curr.activeUserSpecies,
            oppSpecies: curr.activeOppSpecies,
            prevUserAtkStage: prev.userAtkStage ?? 0,
            currUserAtkStage: curr.userAtkStage ?? 0,
            prevUserDefStage: prev.userDefStage ?? 0,
            currUserDefStage: curr.userDefStage ?? 0,
            prevOppAtkStage: prev.oppAtkStage ?? 0,
            currOppAtkStage: curr.oppAtkStage ?? 0,
            prevOppDefStage: prev.oppDefStage ?? 0,
            currOppDefStage: curr.oppDefStage ?? 0,
            userDisguiseBusted: Boolean(curr.userDisguiseBusted),
            oppDisguiseBusted: Boolean(curr.oppDisguiseBusted),
          },
          r.saveEveryFrameKeyframe !== false ? { before: 4, after: 10, step: 1 } : null
        );
      }
    }
  }

  // 3. All Large HP Changes & Animation Periods (Drops, Upward Resets, or Raw vs Committed Divergence)
  if (rules.largeHpChangesAndAnimations?.enabled !== false) {
    const r = rules.largeHpChangesAndAnimations || {};
    const minDelta = r.minCommittedHpDeltaPct ?? 12;
    const minDiscrepancy = r.minRawVsCommittedDiscrepancyPct ?? 10;
    const cooldown = r.cooldownFrames ?? 25;
    const maxHpEvents = r.maxEventsPerBattle ?? 25;
    let hpEventsAdded = 0;
    let lastUserHpEventIdx = -999;
    let lastOppHpEventIdx = -999;

    for (let i = 1; i < totalFrames; i++) {
      if (hpEventsAdded >= maxHpEvents) break;
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
        hpEventsAdded++;
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

      if (hpEventsAdded >= maxHpEvents) break;

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
        hpEventsAdded++;
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

function formatAssTimeFromIndex(idx) {
  const totalCs = Math.max(0, Math.round(idx * 10)); // 0.10s per frame slot (paired with setpts=N/(10*TB))
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hr = Math.floor(totalMin / 60);
  return `${hr}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatStageTag(atkStage, defStage, disguiseBusted) {
  const parts = [];
  const a = Number(atkStage) || 0;
  const d = Number(defStage) || 0;
  if (a !== 0) parts.push(a > 0 ? `A+${a}` : `A${a}`);
  if (d !== 0) parts.push(d > 0 ? `D+${d}` : `D${d}`);
  if (disguiseBusted) parts.push("BUST");
  return parts.length > 0 ? `[${parts.join(",")}]` : "";
}

/**
 * Generates an Advanced SubStation Alpha (`telemetry_hud.ass`) subtitle file where each frame `N`
 * spans `[N * 0.10s, (N + 1) * 0.10s)`. When paired with FFmpeg `-vf "setpts=N/(10*TB),drawbox=...,ass=..."`,
 * every video frame `N` receives its exact frame-synced telemetry HUD banner burned back in locally.
 */
function generateTelemetryHudAssFile(frames, appVersion, outDir, config) {
  const hudCfg = config.hudBurnIn || {};
  if (hudCfg.enabled === false) return null;
  const assPath = path.join(outDir, "telemetry_hud.ass");
  const fontName = hudCfg.fontName || "Consolas";
  const fontSize = hudCfg.fontSize || 13;
  const verStr = String(appVersion || "6.41").replace(/^v/i, "");

  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 544",
    "PlayResY: 1168",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: HudTop,${fontName},${fontSize},&H00FFFFFF,&H0000FFFF,&H00090D16,&H00090D16,-1,0,0,0,100,100,0,0,1,1.2,0,8,6,6,6,1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] || {};
    const fNum = Number(f.frameIdx) || i + 1;
    const tSec = ((Number(f.battleElapsedMs) || 0) / 1000).toFixed(2).padStart(5, "0");
    const uHp = f.committedUserHpPct ?? 100;
    const uRaw = f.rawUserHpPct ?? -1;
    const uE = f.userEnergy ?? 0;
    const uStage = formatStageTag(f.userAtkStage, f.userDefStage, f.userDisguiseBusted);
    const oHp = f.committedOppHpPct ?? 100;
    const oRaw = f.rawOppHpPct ?? -1;
    const oE = f.oppEnergy ?? 0;
    const oStage = formatStageTag(f.oppAtkStage, f.oppDefStage, f.oppDisguiseBusted);

    const stamp = `v${verStr} F#${String(fNum).padStart(4, "0")} T+${tSec}s U:${uHp}%(${uRaw}%)/${uE}E${uStage} O:${oHp}%(${oRaw}%)/${oE}E${oStage}`;
    const startStr = formatAssTimeFromIndex(i);
    const endStr = formatAssTimeFromIndex(i + 1);
    lines.push(`Dialogue: 0,${startStr},${endStr},HudTop,,0,0,0,,${stamp}`);
  }

  fs.writeFileSync(assPath, lines.join("\n") + "\n", "utf8");
  return assPath;
}

/**
 * Uses local `ffmpeg` to extract:
 *   1. A tiled contact sheet (`contact_sheets/<event.id>.jpg`) covering the full 24-frame window.
 *   2. Individual full-resolution screenshots around the trigger frame (`keyframes/<event.id>_n####.jpg`).
 * Automatically burns the full telemetry HUD banner back onto extracted frames via FFmpeg (`drawbox` + `ass`).
 */
function extractEventScreenshotsWithFfmpeg(videoPath, outDir, events, frames, appVersion, config) {
  if (!FFMPEG_BIN || !fs.existsSync(videoPath)) return { extractedSheets: 0, extractedKeyframes: 0 };

  const hudCfg = config.hudBurnIn || {};
  const sheetCfg = config.contactSheet || {};
  const kfCfg = config.individualKeyframes || {};
  const sheetsDir = path.join(outDir, "contact_sheets");
  const keyframesDir = path.join(outDir, "keyframes");
  fs.mkdirSync(sheetsDir, { recursive: true });
  fs.mkdirSync(keyframesDir, { recursive: true });

  const assPath = generateTelemetryHudAssFile(frames, appVersion, outDir, config);
  const escapedAss = assPath ? assPath.replace(/\\/g, "/").replace(/:/g, "\\:") : null;
  const bannerH = hudCfg.bannerHeightPx || 26;
  const bannerBg = hudCfg.bannerBgColor || "0x090d16@0.94";
  const hudPrefixFilter =
    escapedAss && hudCfg.enabled !== false
      ? `setpts=N/(10*TB),drawbox=x=0:y=0:w=iw:h=${bannerH}:color=${bannerBg}:t=fill,ass='${escapedAss}',`
      : "";

  let extractedSheets = 0;
  let extractedKeyframes = 0;

  // 1. Tiled Contact Sheets
  for (const ev of events) {
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
        const sheetHudPrefix = hudCfg.burnOntoContactSheets !== false ? hudPrefixFilter : "";
        const vf =
          `${sheetHudPrefix}select='between(n\\,${startFrame}\\,${endFrame})*not(mod(n-${startFrame}\\,${step}))',` +
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
  }

  // 2. Full-Resolution Individual Screenshots (Batched FFmpeg extraction for ~30x speedup)
  if (kfCfg.enabled !== false) {
    const neededFramesMap = new Map(); // fIdx -> Array<{ ev, outImg }>
    for (const ev of events) {
      const before = ev.saveBeforeTriggerFramesOverride ?? kfCfg.saveBeforeTriggerFrames ?? 4;
      const after = ev.saveAfterTriggerFramesOverride ?? kfCfg.saveAfterTriggerFrames ?? 6;
      const step = Math.max(1, ev.sampleStepFramesOverride ?? kfCfg.sampleStepFrames ?? 2);
      const kfStart = Math.max(ev.startArrayIdx, ev.triggerArrayIdx - before);
      const kfEnd = Math.min(ev.endArrayIdx, ev.triggerArrayIdx + after);
      ev.keyframePaths = [];

      for (let fIdx = kfStart; fIdx <= kfEnd; fIdx += step) {
        const outImg = path.join(
          keyframesDir,
          `${ev.id}_n${String(fIdx).padStart(4, "0")}.jpg`
        );
        if (fs.existsSync(outImg)) {
          ev.keyframePaths.push(outImg);
        } else {
          if (!neededFramesMap.has(fIdx)) neededFramesMap.set(fIdx, []);
          neededFramesMap.get(fIdx).push({ ev, outImg });
        }
      }
    }

    const sortedUniqueIndices = [...neededFramesMap.keys()].sort((a, b) => a - b);
    const BATCH_SIZE = 60;
    const kfHudPrefix = hudCfg.burnOntoKeyframes !== false ? hudPrefixFilter : "";

    for (let bStart = 0; bStart < sortedUniqueIndices.length; bStart += BATCH_SIZE) {
      const chunk = sortedUniqueIndices.slice(bStart, bStart + BATCH_SIZE);
      const selectExpr = chunk.map((idx) => `eq(n\\,${idx})`).join("+");
      const tmpPrefix = path.join(keyframesDir, `__batch_${bStart}_`);
      const vf = `${kfHudPrefix}select='${selectExpr}'`;

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
          "-fps_mode",
          "passthrough",
          "-q:v",
          String(kfCfg.jpegQuality || 3),
          `${tmpPrefix}%04d.jpg`,
        ],
        { windowsHide: true }
      );

      if (res.status === 0) {
        for (let i = 0; i < chunk.length; i++) {
          const fIdx = chunk[i];
          const tmpFile = `${tmpPrefix}${String(i + 1).padStart(4, "0")}.jpg`;
          if (!fs.existsSync(tmpFile)) continue;
          const targets = neededFramesMap.get(fIdx) || [];
          for (let t = 0; t < targets.length; t++) {
            const { ev, outImg } = targets[t];
            try {
              if (t === targets.length - 1) {
                fs.renameSync(tmpFile, outImg);
              } else {
                fs.copyFileSync(tmpFile, outImg);
              }
              ev.keyframePaths.push(outImg);
              extractedKeyframes++;
            } catch {}
          }
          try {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
          } catch {}
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
  const videoExistsOnDisk = Boolean(bundle.videoPath && fs.existsSync(bundle.videoPath));

  if (!forceReprocess && fs.existsSync(digestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(digestPath, "utf8"));
      if ((!videoExistsOnDisk || existing.hasVideoScreenshots) && existing.totalFrames > 0) {
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
      const parsed = JSON.parse(line);
      if (parsed && parsed.recordType === "BATTLE_DVR_SUMMARY_HEADER") continue;
      frames.push(parsed);
    } catch {}
  }
  if (frames.length === 0) return false;

  const events = analyzeDeepTraceEvents(frames, config);
  let screenshotStats = { extractedSheets: 0, extractedKeyframes: 0 };
  const hasVideo = videoExistsOnDisk;
  if (hasVideo) {
    screenshotStats = extractEventScreenshotsWithFfmpeg(
      bundle.videoPath,
      outDir,
      events,
      frames,
      bundle.appVersion || "6.41",
      config
    );
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

function enforceLocalStorageQuota(config, state = null) {
  const maxMb = config.storage?.maxLocalStorageMb ?? 1024;
  const targetMb = config.storage?.pruneTargetStorageMb ?? 950;
  const maxBytes = maxMb * 1024 * 1024;
  const targetBytes = targetMb * 1024 * 1024;

  const allFiles = collectFilesRecursive(CACHE_DIR);
  let totalBytes = allFiles.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes <= maxBytes) {
    return { totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2)), evictedFiles: 0 };
  }

  // Never delete state metadata, latest report, .jsonl traces, or digest.json files
  const protectedPaths = new Set([STATE_FILE, SUMMARY_FILE, SYNC_LOG_FILE, LOCK_FILE]);
  const manuallyFlaggedBattleIds = new Set(
    Object.values(state?.dvrBundles || {})
      .filter((b) => b && b.manuallyFlagged)
      .map((b) => b.battleId)
  );

  const candidates = allFiles.filter((f) => {
    if (protectedPaths.has(f.path)) return false;
    if (config.storage?.protectDeepTraceJsonl !== false && f.path.endsWith(".jsonl")) return false;
    if (config.storage?.protectDigestJson !== false && f.path.endsWith("digest.json")) return false;
    if (f.path.endsWith("telemetry_hud.ass")) return false;
    if (config.storage?.protectPaidAndFlaggedBundles !== false) {
      for (const flagId of manuallyFlaggedBattleIds) {
        if (flagId && f.path.includes(flagId)) return false;
      }
    }
    return true;
  });

  // Sort: oldest raw .mp4 files first ( once screenshots are extracted ), then oldest keyframes
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

/**
 * Scans all local `_deep_trace.jsonl` files in `RECORDINGS_DIR` and extracts Line 0
 * (`BATTLE_DVR_SUMMARY_HEADER`) so any DVR bundle whose summary record or manual bug report flag
 * arrived via `/v1/dvr` is synchronized into `state.records` and `state.dvrBundles`.
 */
function syncLocalDeepTraceHeadersIntoState(state) {
  if (!fs.existsSync(RECORDINGS_DIR)) return;
  const byBattleId = new Map();
  for (const r of state.records || []) {
    if (r && r.battleId) byBattleId.set(r.battleId, r);
  }

  for (const userEntry of fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })) {
    if (!userEntry.isDirectory()) continue;
    const userDir = path.join(RECORDINGS_DIR, userEntry.name);
    for (const fEntry of fs.readdirSync(userDir, { withFileTypes: true })) {
      if (!fEntry.isFile() || !fEntry.name.endsWith("_deep_trace.jsonl")) continue;
      const tracePath = path.join(userDir, fEntry.name);
      const battleId = fEntry.name.replace(/_deep_trace\.jsonl$/, "");
      const videoPath = path.join(userDir, `${battleId}_video.mp4`);
      try {
        const fd = fs.openSync(tracePath, "r");
        const buf = Buffer.alloc(65536);
        const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
        fs.closeSync(fd);
        const firstLine = buf.toString("utf8", 0, bytesRead).split(/\r?\n/)[0] || "";
        if (!firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) continue;
        const header = JSON.parse(firstLine);
        const screenName = header.screenName || userEntry.name;
        const isManual =
          Boolean(header.manuallyFlagged) ||
          Boolean(header.userIssueNote && String(header.userIssueNote).trim() !== "");
        const issueNote = String(header.userIssueNote || "").trim();

        const bundle = state.dvrBundles[battleId] || {
          battleId,
          screenName,
          appVersion: header.appVersion || header.battleSummary?.appVersion || "unknown",
          league: header.battleSummary?.league || "Unknown",
          result: header.battleSummary?.result || "UNKNOWN",
        };
        bundle.tracePath = tracePath;
        if (fs.existsSync(videoPath)) {
          bundle.videoPath = videoPath;
        }
        if (isManual) bundle.manuallyFlagged = true;
        if (issueNote) bundle.userIssueNote = issueNote;
        if (header.uploadReason) bundle.uploadReason = header.uploadReason;
        state.dvrBundles[battleId] = bundle;

        if (header.battleSummary && typeof header.battleSummary === "object") {
          const summaryRec = {
            ...header.battleSummary,
            screenName,
            appVersion: header.appVersion || header.battleSummary.appVersion || "unknown",
            manuallyFlagged: Boolean(bundle.manuallyFlagged),
            userIssueNote: bundle.userIssueNote || "",
          };
          if (
            summaryRec.manuallyFlagged &&
            Array.isArray(summaryRec.anomalies) &&
            !summaryRec.anomalies.some((a) => a && (a.type === "USER_MANUAL_ISSUE_REPORT" || a.code === "USER_MANUAL_ISSUE_REPORT"))
          ) {
            summaryRec.anomalies = [
              {
                tSec: 0.0,
                severity: "HIGH",
                type: "USER_MANUAL_ISSUE_REPORT",
                actor: "user",
                species: summaryRec.userTeamSpecs?.[0]?.species || summaryRec.userPokemon || "",
                detail: summaryRec.userIssueNote
                  ? `User-flagged DVR issue report: ${summaryRec.userIssueNote}`
                  : "User manually flagged this battle for diagnostic review.",
              },
              ...summaryRec.anomalies,
            ];
            summaryRec.anomalyCount = summaryRec.anomalies.length;
            summaryRec.hasHighSeverityAnomaly = true;
          }
          const existingRec = byBattleId.get(battleId);
          if (!existingRec || summaryRec.manuallyFlagged || (summaryRec.anomalies?.length || 0) >= (existingRec.anomalies?.length || 0)) {
            byBattleId.set(battleId, { ...(existingRec || {}), ...summaryRec });
          }
        }
      } catch {}
    }
  }
  state.records = [...byBattleId.values()];
}

// ============================================================================
// MAIN SYNC, PREPROCESS & ON-DEMAND REPORT ENGINE
// ============================================================================

async function runOnce() {
  if (!acquireIngestLock()) {
    console.log("[SKIP] Another ingest-telemetry.mjs instance is currently active.");
    return;
  }
  try {
    const config = loadPreprocessConfig();
    const state = loadCacheState();
    let newBatchesCount = 0;
    let newBattlesCount = 0;
    let newSettingsLogsCount = 0;
    let newDvrFilesCount = 0;
    let preprocessedBundlesCount = 0;
    let prunedRemoteKeys = 0;

    if (!REPORT_ONLY && !REPROCESS_LOCAL) {
      // 0. Sync User License Tiers from `/v1/admin/keys` & `/v1/admin/manifest`
      try {
        const keysData = await adminFetchJson("/v1/admin/keys");
        const keysList = Array.isArray(keysData?.keys) ? keysData.keys : [];
        for (const lic of keysList) {
          if (!lic) continue;
          const tier = normalizeTier(lic.tier);
          for (const candidateName of [lic.boundScreenName, lic.screenName]) {
            if (candidateName) {
              state.userTiers[candidateName] = tier;
              state.userTiers[String(candidateName).toLowerCase()] = tier;
            }
          }
          if (Array.isArray(lic.claimedScreenNames)) {
            for (const cName of lic.claimedScreenNames) {
              if (cName) {
                state.userTiers[cName] = tier;
                state.userTiers[String(cName).toLowerCase()] = tier;
              }
            }
          }
        }
      } catch {}
      state.userTiers.sportsfan986 = "vip";

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
        const battleId =
          obj.customMetadata?.battleId ||
          fileName.replace(/_(video\.mp4|deep_trace\.jsonl)$/, "");
        const existingBundle = state.dvrBundles[battleId];
        const remoteManuallyFlagged =
          obj.customMetadata?.manuallyFlagged === "true" ||
          obj.customMetadata?.manuallyFlagged === true ||
          Boolean(obj.customMetadata?.userIssueNote && String(obj.customMetadata.userIssueNote).trim() !== "");
        const remoteIssueNote = String(obj.customMetadata?.userIssueNote || "").trim();
        const isNewManualFlagUpgrade =
          (remoteManuallyFlagged && !existingBundle?.manuallyFlagged) ||
          (remoteIssueNote && remoteIssueNote !== (existingBundle?.userIssueNote || ""));

        if (state.ingestedKeys[key] && fs.existsSync(localFilePath) && !isNewManualFlagUpgrade) {
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

        const resolvedTier = resolveUserTier(screenName, state.userTiers);
        const bundle = existingBundle || {
          battleId,
          screenName,
          userTier: resolvedTier,
          appVersion: obj.customMetadata?.appVersion || "unknown",
          league: obj.customMetadata?.league || "Unknown",
          result: obj.customMetadata?.result || "UNKNOWN",
          uploadedAt: obj.customMetadata?.uploadedAt || obj.uploaded,
        };
        bundle.userTier = resolvedTier;
        if (isVideo) bundle.videoPath = localFilePath;
        if (isTrace) bundle.tracePath = localFilePath;
        if (remoteManuallyFlagged) bundle.manuallyFlagged = true;
        if (remoteIssueNote) bundle.userIssueNote = remoteIssueNote;
        if (obj.customMetadata?.uploadReason) bundle.uploadReason = obj.customMetadata.uploadReason;
        state.dvrBundles[battleId] = bundle;

        state.ingestedKeys[key] = true;
        newDvrFilesCount++;

        if (PRUNE_REMOTE && (await adminDeleteObject(key))) {
          prunedRemoteKeys++;
        }
      }
    }

    // 3b. Synchronize Line 0 BATTLE_DVR_SUMMARY_HEADER from all local _deep_trace.jsonl files
    syncLocalDeepTraceHeadersIntoState(state);

    // 4. Enrich DVR Bundles with Tier + Priority Metadata & Run Local CPU + ffmpeg Preprocessing
    for (const bundle of Object.values(state.dvrBundles)) {
      const tier = resolveUserTier(bundle.screenName, state.userTiers);
      bundle.userTier = tier;
      const prio = computePriorityMetadata({
        manuallyFlagged: Boolean(bundle.manuallyFlagged),
        userTier: tier,
        severity: bundle.manuallyFlagged ? "HIGH" : "WARN",
      });
      bundle.priorityBucket = prio.priorityBucket;
      bundle.compositePriorityScore = prio.compositePriorityScore;
      if (preprocessDvrBundle(bundle, config, REPROCESS_LOCAL)) {
        preprocessedBundlesCount++;
      }
    }

    saveCacheState(state);

    // 5. Enforce 1.0 GB Local Storage Cap
    const quotaStatus = enforceLocalStorageQuota(config, state);

    if (SYNC_ONLY) {
      const syncLine = `batches=+${newBatchesCount} battles=+${newBattlesCount} dvrFiles=+${newDvrFilesCount} preprocessed=+${preprocessedBundlesCount} prunedRemote=${prunedRemoteKeys} localMb=${quotaStatus.totalMb}MB evictedLocal=${quotaStatus.evictedFiles}`;
      appendSyncLog(syncLine);
      console.log(`[SYNC-ONLY] ${syncLine}`);
      return;
    }

    // 6. On-Demand Anomaly & DVR Preprocessed Report Generation (Sorted by Paid-First Priority P1 > P2 > P3 > P4)
    const allAnomalies = state.records.flatMap((r) => {
      const appVer = r.appVersion || r.scannerSettings?.appVersion || r.schemaVersion || "unknown";
      const trainer = r.screenName || r.uploaderHandle || r.githubUser || "unknown";
      const bundle = state.dvrBundles[r.battleId] || null;
      const isManuallyFlagged = Boolean(r.manuallyFlagged || bundle?.manuallyFlagged);
      const userIssueNote = r.userIssueNote || bundle?.userIssueNote || "";
      const tier = resolveUserTier(trainer, state.userTiers);
      return (r.anomalies || []).map((a) => {
        const prio = computePriorityMetadata({
          manuallyFlagged: isManuallyFlagged || a.code === "USER_MANUAL_ISSUE_REPORT",
          userTier: tier,
          severity: a.severity,
        });
        const localDiagnosis = classifyAnomalyLocally(a, r);
        return {
          priorityBucket: prio.priorityBucket,
          compositePriorityScore: prio.compositePriorityScore,
          userTier: prio.userTier,
          userTierLabel: prio.userTierLabel,
          isPaidTier: prio.isPaidTier,
          manuallyFlagged: prio.manuallyFlagged,
          userIssueNote: userIssueNote || undefined,
          battleId: r.battleId,
          timestampMs: r.timestampMs || 0,
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
          localDiagnosis,
        };
      });
    });

    // Sort all anomalies by Paid-First Priority:
    // P1 (Paid Manual: VIP > Pro > Supporter) -> P2 (Free Manual) -> P3 (Paid Auto: VIP > Pro > Supporter, HIGH > WARN) -> P4 (Free Auto: HIGH > WARN)
    allAnomalies.sort((a, b) => {
      if (b.compositePriorityScore !== a.compositePriorityScore) {
        return b.compositePriorityScore - a.compositePriorityScore;
      }
      return (b.timestampMs || 0) - (a.timestampMs || 0);
    });

    const sortedDvrBundles = Object.values(state.dvrBundles).sort((a, b) => {
      if ((b.compositePriorityScore || 0) !== (a.compositePriorityScore || 0)) {
        return (b.compositePriorityScore || 0) - (a.compositePriorityScore || 0);
      }
      return String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || ""));
    });

    const battlesByAppVersion = {};
    const anomaliesByAppVersion = {};
    const battlesByTrainer = {};
    const anomaliesByPriorityBucket = {
      P1_PAID_MANUAL: 0,
      P2_FREE_MANUAL: 0,
      P3_PAID_AUTO: 0,
      P4_FREE_AUTO: 0,
    };
    const anomaliesByLocalDiagnosis = {};

    for (const r of state.records) {
      const ver = r.appVersion || r.scannerSettings?.appVersion || r.schemaVersion || "unknown";
      const trainer = r.screenName || r.uploaderHandle || r.githubUser || "unknown";
      battlesByAppVersion[ver] = (battlesByAppVersion[ver] || 0) + 1;
      battlesByTrainer[trainer] = (battlesByTrainer[trainer] || 0) + 1;
      const aCount = Array.isArray(r.anomalies) ? r.anomalies.length : 0;
      anomaliesByAppVersion[ver] = (anomaliesByAppVersion[ver] || 0) + aCount;
    }
    for (const a of allAnomalies) {
      anomaliesByPriorityBucket[a.priorityBucket] =
        (anomaliesByPriorityBucket[a.priorityBucket] || 0) + 1;
      const cat = a.localDiagnosis?.category || "UNCLASSIFIED";
      anomaliesByLocalDiagnosis[cat] = (anomaliesByLocalDiagnosis[cat] || 0) + 1;
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
      userTiers: state.userTiers,
      anomaliesByPriorityBucket,
      anomaliesByLocalDiagnosis,
      battlesByTrainer,
      battlesByAppVersion,
      anomaliesByAppVersion,
      prioritizedDvrBundles: sortedDvrBundles.slice(0, 25),
      prioritizedAnomalies: allAnomalies.slice(0, 40),
      recentDvrBundles: sortedDvrBundles.slice(0, 15),
      recentAnomalies: allAnomalies.slice(0, 25),
    };
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), "utf8");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    releaseIngestLock();
  }
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
