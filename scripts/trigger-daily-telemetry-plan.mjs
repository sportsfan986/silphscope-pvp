#!/usr/bin/env node
/**
 * SilphScope PvP — Cost-Optimized Daily Orchestrator (5:00 AM -> 6:00 AM Central)
 *
 * Clean 2-stage split between zero-token local Stage 0 and Antigravity Desktop sidebar chats:
 *
 *   Stage 0 (`--stage0-only`, 0 AI Tokens — 5:00 AM to 5:55 AM Windows Task Scheduler):
 *     - Runs `scripts/nightly-telemetry-audit.mjs` locally at 5:00 AM (Node 22 + ffmpeg + v7.08 scanner).
 *     - Sleeps locally in Node.js until 5:52 AM Central (0 AI tokens, no LLM context open),
 *       then runs a final delta check and dispatches the 6:00 AM Telegram summary.
 *
 *   Stage 1–4 (`--launch-chat-only`, 5:56 AM Antigravity Desktop Daemon / 5:58 AM Automation Backup):
 *     - Reads the fresh (<2h) local `nightly_audit_digest.json` (or runs Stage 0 if stale/missing).
 *     - Launches a BRAND-NEW dated Desktop sidebar conversation via `language_server.exe agentapi`:
 *       `📊 [YYYY-MM-DD] Daily Telemetry Audit & Plan — SilphScope PvP` on `gemini-pro-orchestrator`.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = "P:/AntiGravity/SilphScope PvP";
const LANGUAGE_SERVER_EXE =
  process.env.ANTIGRAVITY_AGENTAPI_EXE ||
  "C:/Users/Chris/AppData/Local/Programs/antigravity/resources/bin/language_server.exe";

const ORCHESTRATOR_MODEL = "gemini-pro-orchestrator";
const DIGEST_FRESH_MS = 2 * 60 * 60 * 1000;

const CACHE_DIR = path.resolve(ROOT_DIR, ".aistudio", "telemetry_cache");
const THREAD_FILE = path.join(CACHE_DIR, "daily_plan_conversation.json");
const HISTORY_FILE = path.join(CACHE_DIR, "daily_plan_history.json");
const DAILY_LOCK_FILE = path.join(CACHE_DIR, "daily_plan.lock");
const STAGE0_LOCK_FILE = path.join(CACHE_DIR, "daily_stage0.lock");
const RUN_LOG_FILE = path.join(CACHE_DIR, "nightly_run.log");
const DIGEST_FILE = path.join(CACHE_DIR, "nightly_audit_digest.json");
const AUDIT_SCRIPT = path.resolve(ROOT_DIR, "scripts", "nightly-telemetry-audit.mjs");

const rawArgs = process.argv.slice(2);
const STAGE0_ONLY = rawArgs.includes("--stage0-only");
const LAUNCH_CHAT_ONLY = rawArgs.includes("--launch-chat-only");
const IMMEDIATE_MODE = rawArgs.includes("--immediate");
const NO_TELEGRAM = rawArgs.includes("--no-telegram");
const FORCE_RUN = rawArgs.includes("--force");

fs.mkdirSync(CACHE_DIR, { recursive: true });

function logLine(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try {
    fs.appendFileSync(RUN_LOG_FILE, `${line}\n`, "utf8");
  } catch {}
}

function getTodayCentralDateStr(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function readJsonSafe(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {}
  return fallback;
}

function acquireLock(lockFilePath, lockKey, label) {
  try {
    if (!FORCE_RUN && fs.existsSync(lockFilePath)) {
      const existing = readJsonSafe(lockFilePath, null);
      const st = fs.statSync(lockFilePath);
      const ageMs = Date.now() - st.mtimeMs;
      if (existing?.key === lockKey && ageMs < 75 * 60 * 1000) {
        logLine(`[SKIP] Another ${label} instance (pid=${existing.pid || "?"}) is already running for ${lockKey}.`);
        return false;
      }
    }
    fs.writeFileSync(
      lockFilePath,
      JSON.stringify({ pid: process.pid, key: lockKey, startedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
    return true;
  } catch (err) {
    logLine(`[WARN] Could not inspect/write ${label} lock file: ${err?.message || err}`);
    return true;
  }
}

function releaseLock(lockFilePath) {
  try {
    if (!fs.existsSync(lockFilePath)) return;
    const current = readJsonSafe(lockFilePath, null);
    if (!current || current.pid === process.pid) {
      fs.unlinkSync(lockFilePath);
    }
  } catch {}
}

function runLocalAudit(extraArgs = []) {
  logLine(`[AUDIT] Running nightly-telemetry-audit.mjs ${extraArgs.join(" ")}`.trim());
  const res = spawnSync(process.execPath, [AUDIT_SCRIPT, ...extraArgs], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  const stderrText = String(res.stderr || "").trim();
  if (stderrText) {
    for (const errLine of stderrText.split(/\r?\n/)) {
      if (errLine.trim()) logLine(`[AUDIT] ${errLine.trim()}`);
    }
  }
  if (res.status !== 0) {
    logLine(`[WARN] nightly-telemetry-audit.mjs exited with status=${res.status} (${res.error?.message || ""})`);
  }
  return readJsonSafe(DIGEST_FILE, null);
}

function getMsUntil552AmLocal() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(5, 52, 0, 0);
  const diff = target.getTime() - now.getTime();
  // Wait only during the scheduled 4:50 AM - 5:51 AM local watch window
  if (diff > 0 && diff <= 65 * 60 * 1000) {
    return diff;
  }
  return 0;
}

function buildDailyNewChatPrompt(digest, todayDate) {
  const modelPolicy = digest?.modelRoutingPolicy || {};
  const stage2Count = modelPolicy.stage2SupporterAndFreeHighTier?.queuedTodayCount ?? 0;
  const stage2Cap = modelPolicy.stage2SupporterAndFreeHighTier?.dailyCapX ?? 3;
  const stage3Count = modelPolicy.stage3ProAndVipCriticalTier?.queuedTodayCount ?? 0;
  const lateCount = digest?.totals?.lateArrivalsCount ?? 0;
  const totalBattles = digest?.totals?.totalBattles ?? 0;
  const totalDvrs = digest?.totals?.totalDvrBundles ?? 0;
  const currentRepoVersion = digest?.currentRepoVersion || "unknown";
  const openManualReports = (digest?.manualIssuesRetroactiveAudit || []).filter(
    (m) => m?.retroactiveAudit?.status !== "RESOLVED_BY_LATEST_RELEASE"
  );

  const manualPreview =
    openManualReports.length > 0
      ? openManualReports
          .slice(0, 6)
          .map(
            (m) =>
              `- @${m.screenName} (${m.battleId}, v${m.appVersion}, ${m.league}): "${m.userIssueNote}"`
          )
          .join("\n")
      : "- None (all manual DVR issue reports resolved).";

  const unreleased = digest?.unreleasedCommitsAudit;
  const unreleasedText = unreleased?.hasUnreleasedCommits
    ? `UNRELEASED COMMITS DETECTED ON MAIN: ${unreleased.unreleasedCommitsCount} commit(s) ahead of ${unreleased.latestReleaseTag} (${unreleased.commits
        .map((c) => `[${c.hash}] ${c.subject}`)
        .slice(0, 3)
        .join("; ")}). Ask via \`ask_question\` whether to build and release ${unreleased.suggestedNextVersion} today and include it in \`morning_telemetry_action_plan_${todayDate}.md\`.`
    : `NO UNRELEASED COMMITS: \`main\` matches latest release tag ${unreleased?.latestReleaseTag || "HEAD"}.`;

  return [
    `# Daily Telemetry Audit & Interactive Action Plan — ${todayDate}`,
    ``,
    `## Executive Summary (Stage 0 Pre-Computed Locally — 0 AI Tokens)`,
    `- **Date (America/Chicago)**: \`${todayDate}\``,
    `- **Latest Repo Version**: \`${currentRepoVersion}\``,
    `- **Dataset Totals**: \`${totalBattles}\` battles • \`${totalDvrs}\` DVR bundles • Late 5:00–5:52 AM arrivals: \`${lateCount}\``,
    `- **Queues**: Stage 3 (Pro/VIP Critical & Manual) = \`${stage3Count}\` | Stage 2 (Supporter/Free, cap ${stage2Cap}/day) = \`${stage2Count}\``,
    `- **Open User-Flagged DVR Reports (${openManualReports.length})**:`,
    manualPreview,
    `- **Release Status**: ${unreleasedText}`,
    ``,
    `## Mandatory Orchestrator Instructions (${ORCHESTRATOR_MODEL} — Orchestrator Carbon)`,
    `1. **Read Cached Audit Outputs Only First**: Read \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/morning_briefing.md\` and inspect targeted sections of \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/nightly_audit_digest.json\`. Stage 0 has already synced Cloudflare, run the 7-day retroactive fix verification, executed paid-tier pixel rescans, and sent the morning Telegram summary—do **NOT** re-run telemetry sync scripts or dump whole raw \`.mp4\` files.`,
    `2. **Delegate All Visual Image / Contact-Sheet OCR to Flash**: If any pre-rendered contact sheets or keyframes in \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/preprocessed/<battleId>/\` need visual inspection or text confirmation, delegate via \`invoke_subagent(TypeName: "research", Model: "flash")\`. Never inspect raw images directly in the planning context.`,
    `3. **Focused Root-Cause Diagnosis**: Diagnose open Stage 3 (\`Pro\`/\`VIP\` critical & user-flagged reports) plus up to \`${stage2Cap}\` Stage 2 items, reading only targeted preprocessed \`digest.json\`, frame windows of \`_deep_trace.jsonl\`, or specific Kotlin/TS functions needed to verify each root cause.`,
    `4. **Create Today's Action Plan Artifact**: Write the user-facing interactive artifact \`morning_telemetry_action_plan_${todayDate}.md\` (\`UserFacing: true\`, \`RequestFeedback: true\`) containing:`,
    `   - 24h / 7d Trainer Submission Summary`,
    `   - Version-over-Version Regression Matrix`,
    `   - 7-Day Retroactive Fix Verification & Paid-Tier Pixel Rescans`,
    `   - Root-Cause Diagnosis & Proposed Fix Options per Open Area`,
    `   - Unreleased Commits Check (if any)`,
    `5. **Interactive Q&A Before Any Edits**: Output a concise executive summary in this chat and ask the user clarifying / prioritization questions per open area (using \`ask_question\` where appropriate) **before** making any code modifications or cutting a release.`,
  ].join("\n");
}

function tryAgentApiNewConversation(dailyTitle, prompt) {
  if (!process.env.ANTIGRAVITY_LS_ADDRESS) {
    logLine("[ERROR] ANTIGRAVITY_LS_ADDRESS is unset; Desktop sidebar chat creation requires running inside Antigravity (`schedule` daemon or Automation sidecar).");
    return null;
  }
  if (!fs.existsSync(LANGUAGE_SERVER_EXE)) {
    logLine(`[ERROR] language_server.exe not found at ${LANGUAGE_SERVER_EXE}`);
    return null;
  }
  logLine(`[LAUNCH] Calling language_server.exe agentapi new-conversation --model=${ORCHESTRATOR_MODEL} ...`);
  const res = spawnSync(
    LANGUAGE_SERVER_EXE,
    ["agentapi", "new-conversation", `--model=${ORCHESTRATOR_MODEL}`, `--title=${dailyTitle}`, "--", prompt],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      windowsHide: true,
      timeout: 120000,
    }
  );
  const combinedOut = `${res.stdout || ""}\n${res.stderr || ""}`.trim();
  const uuidMatch = combinedOut.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (res.status === 0 && uuidMatch) {
    return {
      conversationId: uuidMatch[0],
      model: ORCHESTRATOR_MODEL,
      launcher: "agentapi",
      rawOutput: combinedOut,
    };
  }
  logLine(
    `[WARN] agentapi new-conversation failed (status=${res.status}, err=${res.error?.message || "none"}): ${combinedOut.slice(0, 400)}`
  );
  return null;
}

function persistDailyConversationRecord(record) {
  fs.writeFileSync(THREAD_FILE, JSON.stringify(record, null, 2), "utf8");
  const historyRaw = readJsonSafe(HISTORY_FILE, []);
  const history = Array.isArray(historyRaw) ? historyRaw : [];
  const filtered = history.filter((item) => item && item.date !== record.date);
  filtered.push(record);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(filtered.slice(-90), null, 2), "utf8");
}

function readFreshDigestIfRecent() {
  try {
    if (!fs.existsSync(DIGEST_FILE)) return null;
    const st = fs.statSync(DIGEST_FILE);
    const ageMs = Date.now() - st.mtimeMs;
    if (ageMs > DIGEST_FRESH_MS) return null;
    return readJsonSafe(DIGEST_FILE, null);
  } catch {
    return null;
  }
}

async function runStage0Pipeline(todayDate) {
  const lockKey = `${todayDate}-stage0`;
  if (!acquireLock(STAGE0_LOCK_FILE, lockKey, "Stage 0")) {
    return;
  }
  try {
    const initialStartIso = new Date().toISOString();
    logLine(`[5:00 AM STAGE 0] Running 100% local zero-token audit (${initialStartIso})...`);
    runLocalAudit([]);

    const waitMs = IMMEDIATE_MODE ? 0 : getMsUntil552AmLocal();
    if (waitMs > 0) {
      logLine(
        `[5:00-5:52 AM WATCH] Sleeping locally in Node.js for ${Math.round(
          waitMs / 60000
        )}m (0 AI tokens) until 5:52 AM delta check...`
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }

    logLine(`[5:52 AM STAGE 0] Running final delta check & dispatching 6:00 AM Telegram summary...`);
    const deltaArgs = ["--check-delta-since", initialStartIso];
    if (!NO_TELEGRAM) deltaArgs.push("--send-telegram");
    runLocalAudit(deltaArgs);
    logLine(`[OK] Stage 0 local audit & Telegram dispatch completed for ${todayDate} (0 AI tokens).`);
  } finally {
    releaseLock(STAGE0_LOCK_FILE);
  }
}

async function main() {
  const todayDate = getTodayCentralDateStr();

  if (STAGE0_ONLY) {
    await runStage0Pipeline(todayDate);
    return;
  }

  const dailyTitle = `📊 [${todayDate}] Daily Telemetry Audit & Plan — SilphScope PvP`;

  if (!FORCE_RUN) {
    const history = readJsonSafe(HISTORY_FILE, []);
    const existingToday = Array.isArray(history)
      ? history.find((item) => item && item.date === todayDate && item.conversationCreated === true)
      : null;
    if (existingToday?.conversationId) {
      logLine(
        `[SKIP] Today's new daily telemetry chat (${todayDate}) already exists: ${existingToday.conversationId}`
      );
      return;
    }
  }

  if (!acquireLock(DAILY_LOCK_FILE, todayDate, "daily orchestrator")) {
    return;
  }

  try {
    const initialStartIso = new Date().toISOString();
    let digest = null;

    if (LAUNCH_CHAT_ONLY) {
      digest = readFreshDigestIfRecent();
      if (digest) {
        logLine(`[LAUNCH-ONLY] Using fresh local nightly_audit_digest.json for ${todayDate} (<2h old).`);
      } else {
        logLine(`[LAUNCH-ONLY] Local audit digest missing or >2h stale; running Stage 0 audit now...`);
        digest = runLocalAudit(NO_TELEGRAM ? [] : ["--send-telegram"]);
      }
    } else if (IMMEDIATE_MODE) {
      logLine(`[IMMEDIATE STAGE] Running 100% local zero-token audit (${todayDate})...`);
      digest = runLocalAudit(NO_TELEGRAM ? [] : ["--send-telegram"]);
    } else {
      logLine(`[5:00 AM STAGE] Running 100% local zero-token audit (${initialStartIso})...`);
      digest = runLocalAudit([]);

      const waitMs = getMsUntil552AmLocal();
      if (waitMs > 0) {
        logLine(
          `[5:00-5:52 AM WATCH] Sleeping locally in Node.js for ${Math.round(
            waitMs / 60000
          )}m (0 AI tokens) until 5:52 AM delta check...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }

      logLine(`[5:52 AM STAGE] Running final delta check & dispatching 6:00 AM Telegram summary...`);
      const deltaArgs = ["--check-delta-since", initialStartIso];
      if (!NO_TELEGRAM) deltaArgs.push("--send-telegram");
      digest = runLocalAudit(deltaArgs) || digest;
    }

    const prompt = buildDailyNewChatPrompt(digest, todayDate);
    const launchResult = tryAgentApiNewConversation(dailyTitle, prompt);

    if (!launchResult || !launchResult.conversationId) {
      persistDailyConversationRecord({
        date: todayDate,
        conversationId: null,
        title: dailyTitle,
        model: ORCHESTRATOR_MODEL,
        launcher: "failed",
        createdAt: new Date().toISOString(),
        conversationCreated: false,
      });
      throw new Error(`Failed to launch new daily telemetry chat for ${todayDate}.`);
    }

    const record = {
      date: todayDate,
      conversationId: launchResult.conversationId,
      title: dailyTitle,
      model: launchResult.model,
      launcher: launchResult.launcher,
      createdAt: new Date().toISOString(),
      conversationCreated: true,
    };
    persistDailyConversationRecord(record);
    logLine(
      `[OK] Created new daily telemetry chat: ${record.conversationId} (model=${record.model}, launcher=${record.launcher})`
    );
  } finally {
    releaseLock(DAILY_LOCK_FILE);
  }
}

main().catch((err) => {
  logLine(`[TRIGGER ERROR] ${err?.stack || err?.message || err}`);
  process.exit(1);
});
