#!/usr/bin/env node
/**
 * SilphScope PvP v6.27 — Cloudflare Multi-User AI Telemetry, Settings Audit & 1-Battle DVR Ingestion Script
 *
 * Pulls all telemetry exclusively from the SilphScope Cloudflare Worker Admin API:
 * - Always-on lower-resolution battle telemetry (`batches/<date>/<batchId>.jsonl`)
 * - User settings change audits (`users/<screenName>/settings_changes/*.jsonl`)
 * - 1-Battle DVR bundles (`recordings/<screenName>/<battleId>_video.mp4` & `_deep_trace.jsonl`)
 *
 * Telegram is used strictly for live video/summary viewing; this script never reads from Telegram or GitHub.
 *
 * Usage:
 *   node scripts/ingest-telemetry.mjs [--prune-remote] [--skip-videos]
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_WORKER_URL =
  process.env.SILPHSCOPE_TELEMETRY_WORKER_URL ||
  "https://silphscope-telemetry.silphscope-pvp.workers.dev";
const ADMIN_API_KEY =
  process.env.SILPHSCOPE_TELEMETRY_ADMIN_KEY ||
  "sspvp_admin_a1b2c3d4e5f60718293a4b5c6d7e8f90";

const args = new Set(process.argv.slice(2));
const PRUNE_REMOTE = args.has("--prune-remote") || process.env.PRUNE_REMOTE === "true";
const SKIP_VIDEOS = args.has("--skip-videos");

const CACHE_DIR = path.resolve(process.cwd(), ".aistudio", "telemetry_cache");
const BATCHES_DIR = path.join(CACHE_DIR, "batches");
const SETTINGS_DIR = path.join(CACHE_DIR, "settings_changes");
const RECORDINGS_DIR = path.join(CACHE_DIR, "recordings");
const STATE_FILE = path.join(CACHE_DIR, "ingested_batches.json");
const SUMMARY_FILE = path.join(CACHE_DIR, "latest_anomaly_report.json");

for (const dir of [CACHE_DIR, BATCHES_DIR, SETTINGS_DIR, RECORDINGS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

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

async function adminFetchJson(endpointPath) {
  const res = await fetch(`${DEFAULT_WORKER_URL}${endpointPath}`, {
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
  const res = await fetch(
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
  const res = await fetch(
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
  const res = await fetch(
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

async function main() {
  const state = loadCacheState();
  let newBatchesCount = 0;
  let newBattlesCount = 0;
  let newSettingsLogsCount = 0;
  let newDvrFilesCount = 0;
  let prunedRemoteKeys = 0;

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

    // Save raw batch file locally
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

  saveCacheState(state);

  const allAnomalies = state.records.flatMap((r) => {
    const appVer = r.appVersion || r.scannerSettings?.appVersion || r.schemaVersion || "unknown";
    const trainer = r.screenName || r.githubUser || "unknown";
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
    const trainer = r.screenName || r.githubUser || "unknown";
    battlesByAppVersion[ver] = (battlesByAppVersion[ver] || 0) + 1;
    battlesByTrainer[trainer] = (battlesByTrainer[trainer] || 0) + 1;
    const aCount = Array.isArray(r.anomalies) ? r.anomalies.length : 0;
    anomaliesByAppVersion[ver] = (anomaliesByAppVersion[ver] || 0) + aCount;
  }

  const summary = {
    updatedAt: new Date().toISOString(),
    workerUrl: DEFAULT_WORKER_URL,
    newlyIngestedBatches: newBatchesCount,
    newlyIngestedBattles: newBattlesCount,
    newlyIngestedSettingsLogs: newSettingsLogsCount,
    newlyIngestedDvrFiles: newDvrFilesCount,
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
