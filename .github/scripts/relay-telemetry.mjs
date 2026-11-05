#!/usr/bin/env node
/**
 * SilphScope PvP — Telemetry Issue Relay validator / archiver.
 *
 * Invoked by `.github/workflows/telemetry-relay.yml` for `[AI-TELEMETRY-BATCH]` issues. The issue is
 * authored by a real (signed-in) GitHub account, so the issue author is the *only* identity trusted:
 * every record is re-attributed to that login, the archive path is generated server-side, and the
 * payload is schema-checked and sanitized before it is written to the `ai-telemetry-logs` checkout
 * in the current working directory.
 *
 * Inputs (env): ISSUE_BODY, ISSUE_USER, ISSUE_USER_ID, ISSUE_NUMBER, ISSUE_CREATED_AT, RUNNER_TEMP
 * Outputs: `$RUNNER_TEMP/relay_status` ("accepted" | "rejected") and `$RUNNER_TEMP/relay_message`.
 *
 * Limits must stay compatible with the Android client (GitHubCloudSync.kt, ISSUE_RELAY_* constants).
 */
import fs from "node:fs";
import path from "node:path";

const LIMITS = {
  maxBodyChars: 65_536, // GitHub's own issue body cap
  maxRecordsPerIssue: 25,
  maxLineChars: 60_000,
  maxIssuesPerUserPerDay: 10,
  maxManifestEntries: 1500,
  maxDepth: 8,
  maxArrayItems: 5000,
  maxStringChars: 1000,
  maxBase64Chars: 60_000,
};

/** Top-level fields of `AiTelemetryBattleRecordV510` (OverlayService.kt) plus client compaction flag. */
const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "schemaVersion", "battleId", "timestampMs", "appVersion", "uploaderHandle", "deviceHash", "deviceModel",
  "combatMode", "league", "teamName", "teamArchetype", "result", "leadMatchup", "battleDurationSec",
  "bmfScore", "execWae", "adherenceRatePct", "recommendationsIssuedCount", "recommendationsFollowedCount",
  "firstSwapActor", "switchAdvantage", "userShieldsRemaining", "oppShieldsRemaining", "userFaints",
  "oppFaints", "scannerSettings", "settingsProfileSignature", "settingsChanges", "userTeamSpecs",
  "oppTeamSpecs", "anomalies", "anomalyCount", "hasHighSeverityAnomaly", "timelineEvents",
  "shadowProfileBenchmark", "postCutsceneHpAudits", "energyLedger", "hpAndEnergyDiagnosticsSummary",
  "dvrVideoPath", "dvrDeepTracePath", "relayCompacted",
]);
const ARRAY_KEYS = ["settingsChanges", "userTeamSpecs", "oppTeamSpecs", "anomalies", "timelineEvents", "postCutsceneHpAudits", "energyLedger"];
const OBJECT_KEYS = ["scannerSettings", "shadowProfileBenchmark", "hpAndEnergyDiagnosticsSummary"];
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const BASE64_RE = /^[A-Za-z0-9+/=]+$/;
const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// Strip C0/C1 control chars (keep \t) and Unicode bidi overrides that can disguise text.
const UNSAFE_CHARS_RE = /[\u0000-\u0008\u000A-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

const runnerTemp = process.env.RUNNER_TEMP || ".";
function finish(status, message) {
  fs.writeFileSync(path.join(runnerTemp, "relay_status"), status, "utf8");
  fs.writeFileSync(path.join(runnerTemp, "relay_message"), message, "utf8");
  console.log(`[relay] ${status}: ${message}`);
  process.exit(0);
}
const reject = (reason) => finish("rejected", reason);

function sanitizeValue(value, key, depth) {
  if (value === null) return null;
  switch (typeof value) {
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : undefined;
    case "string":
      if (key.endsWith("Base64")) {
        return value.length <= LIMITS.maxBase64Chars && BASE64_RE.test(value) ? value : undefined;
      }
      return value.replace(UNSAFE_CHARS_RE, " ").slice(0, LIMITS.maxStringChars);
    case "object": {
      if (depth >= LIMITS.maxDepth) return undefined;
      if (Array.isArray(value)) {
        return value
          .slice(0, LIMITS.maxArrayItems)
          .map((v) => sanitizeValue(v, key, depth + 1))
          .filter((v) => v !== undefined);
      }
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.has(k) || !KEY_RE.test(k)) continue;
        const clean = sanitizeValue(v, k, depth + 1);
        if (clean !== undefined) out[k] = clean;
      }
      return out;
    }
    default:
      return undefined;
  }
}

function validateRecord(raw, idx) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`line ${idx + 1}: record must be a JSON object`);
  }
  if (typeof raw.battleId !== "string" || raw.battleId.length < 1 || raw.battleId.length > 128) {
    throw new Error(`line ${idx + 1}: missing or invalid battleId`);
  }
  if (typeof raw.timestampMs !== "number" || !Number.isFinite(raw.timestampMs)) {
    throw new Error(`line ${idx + 1}: missing or invalid timestampMs`);
  }
  for (const k of ARRAY_KEYS) {
    if (k in raw && !Array.isArray(raw[k])) throw new Error(`line ${idx + 1}: ${k} must be an array`);
  }
  for (const k of OBJECT_KEYS) {
    if (k in raw && (raw[k] === null || typeof raw[k] !== "object" || Array.isArray(raw[k]))) {
      throw new Error(`line ${idx + 1}: ${k} must be an object`);
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(k)) continue;
    const clean = sanitizeValue(v, k, 1);
    if (clean !== undefined) out[k] = clean;
  }
  return out;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// ── Identity (from the GitHub event, never from the payload) ──────────────────────────────────
const login = process.env.ISSUE_USER || "";
const userId = Number(process.env.ISSUE_USER_ID || 0);
const issueNumber = Number(process.env.ISSUE_NUMBER || 0);
if (!GITHUB_LOGIN_RE.test(login) || !Number.isInteger(issueNumber) || issueNumber <= 0) {
  reject("could not verify the issue author.");
}

// ── Payload extraction ────────────────────────────────────────────────────────────────────────
const body = process.env.ISSUE_BODY || "";
if (body.length > LIMITS.maxBodyChars) reject("issue body is too large.");
const fenceStart = body.indexOf("```jsonl");
const fenceEnd = body.lastIndexOf("```");
if (fenceStart < 0 || fenceEnd <= fenceStart) reject("no ```jsonl payload block found.");
const lines = body
  .slice(fenceStart + "```jsonl".length, fenceEnd)
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
if (lines.length === 0) reject("payload block is empty.");
if (lines.length > LIMITS.maxRecordsPerIssue) reject(`too many records (${lines.length} > ${LIMITS.maxRecordsPerIssue}).`);

const nowMs = Date.now();
const records = [];
try {
  lines.forEach((line, idx) => {
    if (line.length > LIMITS.maxLineChars) throw new Error(`line ${idx + 1}: record exceeds ${LIMITS.maxLineChars} chars`);
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`line ${idx + 1}: invalid JSON`);
    }
    const rec = validateRecord(parsed, idx);
    rec.uploaderHandle = login; // authoritative attribution
    rec.relay = { verifiedGithubLogin: login, verifiedGithubUserId: userId, issueNumber, relayedAtMs: nowMs };
    records.push(rec);
  });
} catch (err) {
  reject(err.message);
}

// ── Rate limit (per verified GitHub account, rolling 24h) ─────────────────────────────────────
const manifest = readJson("manifest.json", {});
const batches = Array.isArray(manifest.batches) ? manifest.batches : [];
const batchId = `relay_issue${issueNumber}_${login}`;
const recentFromUser = batches.filter(
  (b) => b && b.source === "issue-relay" && b.uploader === login && b.batchId !== batchId &&
    typeof b.uploadedAtMs === "number" && nowMs - b.uploadedAtMs < 24 * 60 * 60 * 1000
).length;
if (recentFromUser >= LIMITS.maxIssuesPerUserPerDay) {
  reject(`rate limit reached (${LIMITS.maxIssuesPerUserPerDay} relayed batches per 24h). Your app will retry later.`);
}

// ── Archive ───────────────────────────────────────────────────────────────────────────────────
const createdAt = new Date(process.env.ISSUE_CREATED_AT || nowMs);
const dayFolder = (Number.isNaN(createdAt.getTime()) ? new Date(nowMs) : createdAt).toISOString().slice(0, 10);
const batchPath = path.posix.join("batches", dayFolder, `${batchId}.jsonl`);
const userBatchPath = path.posix.join("users", login, `${batchId}.jsonl`);
const jsonl = records.map((r) => JSON.stringify(r)).join("\n") + "\n";
for (const p of [batchPath, userBatchPath]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, jsonl, "utf8");
}

const first = records[0];
const entry = {
  batchId,
  path: batchPath,
  userPath: userBatchPath,
  uploadedAtMs: nowMs,
  uploader: login,
  deviceHash: typeof first.deviceHash === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(first.deviceHash) ? first.deviceHash : "",
  appVersion: typeof first.appVersion === "string" ? first.appVersion.slice(0, 16) : "",
  battleCount: records.length,
  anomalyCount: records.reduce((n, r) => n + (Array.isArray(r.anomalies) ? r.anomalies.length : 0), 0),
  highSeverityCount: records.filter((r) => r.hasHighSeverityAnomaly === true).length,
  source: "issue-relay",
  issueNumber,
};
const updated = [...batches.filter((b) => b?.batchId !== batchId), entry].slice(-LIMITS.maxManifestEntries);
const nextManifest = {
  ...manifest,
  schemaVersion: manifest.schemaVersion ?? "1",
  updatedAtMs: nowMs,
  totalBatches: updated.length,
  totalBattles: updated.reduce((n, b) => n + (Number(b?.battleCount) || 0), 0),
  totalAnomalies: updated.reduce((n, b) => n + (Number(b?.anomalyCount) || 0), 0),
  batches: updated,
};
fs.writeFileSync("manifest.json", JSON.stringify(nextManifest, null, 2) + "\n", "utf8");

finish(
  "accepted",
  `Archived ${records.length} battle${records.length === 1 ? "" : "s"} from @${login} to \`ai-telemetry-logs\` as \`${batchPath}\`.`
);
