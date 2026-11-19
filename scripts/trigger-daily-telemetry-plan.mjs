#!/usr/bin/env node
/**
 * SilphScope PvP — Cost-Optimized Daily Orchestrator (4:00 AM -> 5:15 AM -> 6:00 AM Central)
 *
 * Clean 3-stage split between zero-token local Stage 0, Antigravity Desktop sidebar chats, and delayed Telegram delivery:
 *
 *   Stage 0 (`--stage0-only`, 0 AI Tokens — 4:00 AM Windows Task Scheduler `SilphScopeNightlyTelemetry`):
 *     - Runs `scripts/nightly-telemetry-audit.mjs` once at 4:00 AM (Node 22 + ffmpeg + v7.08 scanner) and exits cleanly
 *       with fresh `morning_briefing.md` and `nightly_audit_digest.json` ready on disk (no standby wait, no Telegram).
 *
 *   Stage 1–4 (5:15 AM Native Antigravity Automation / `--launch-chat-only` 5:20 AM Backup):
 *     - Reads the fresh (<4h) local `nightly_audit_digest.json` (or runs Stage 0 if stale/missing).
 *     - Launches a BRAND-NEW dated Desktop sidebar conversation via `language_server.exe agentapi`:
 *       `📊 [YYYY-MM-DD] Daily Telemetry Audit & Plan — SilphScope PvP` on `gemini-pro-orchestrator-neon` (Orchestrator Neon).
 *
 *   Delayed Telegram Alert (`--telegram-only`, 0 AI Tokens — 6:00 AM Windows Task Scheduler `SilphScopeMorningTelegram`):
 *     - Reads the 4:00 AM local `nightly_audit_digest.json` and dispatches the formatted morning Telegram summary at 6:00 AM.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = "P:/AntiGravity/SilphScope PvP";
const LANGUAGE_SERVER_EXE =
  process.env.ANTIGRAVITY_AGENTAPI_EXE ||
  "C:/Users/Chris/AppData/Local/Programs/antigravity/resources/bin/language_server.exe";

const ORCHESTRATOR_MODEL = "gemini-pro-orchestrator-neon";
const DIGEST_FRESH_MS = 4 * 60 * 60 * 1000;

const CACHE_DIR = path.resolve(ROOT_DIR, ".aistudio", "telemetry_cache");
const THREAD_FILE = path.join(CACHE_DIR, "daily_plan_conversation.json");
const HISTORY_FILE = path.join(CACHE_DIR, "daily_plan_history.json");
const TELEGRAM_HISTORY_FILE = path.join(CACHE_DIR, "daily_telegram_history.json");
const DAILY_LOCK_FILE = path.join(CACHE_DIR, "daily_plan.lock");
const STAGE0_LOCK_FILE = path.join(CACHE_DIR, "daily_stage0.lock");
const TELEGRAM_LOCK_FILE = path.join(CACHE_DIR, "daily_telegram.lock");
const RUN_LOG_FILE = path.join(CACHE_DIR, "nightly_run.log");
const DIGEST_FILE = path.join(CACHE_DIR, "nightly_audit_digest.json");
const AUDIT_SCRIPT = path.resolve(ROOT_DIR, "scripts", "nightly-telemetry-audit.mjs");

const rawArgs = process.argv.slice(2);
const STAGE0_ONLY = rawArgs.includes("--stage0-only");
const TELEGRAM_ONLY = rawArgs.includes("--telegram-only");
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

function buildDailyNewChatPrompt(digest, todayDate) {
  const modelPolicy = digest?.modelRoutingPolicy || {};
  const stage2Count = modelPolicy.stage2SupporterAndFreeHighTier?.queuedTodayCount ?? 0;
  const stage2Cap = modelPolicy.stage2SupporterAndFreeHighTier?.dailyCapX ?? 3;
  const stage3Count = modelPolicy.stage3ProAndVipCriticalTier?.queuedTodayCount ?? 0;
  const stage0Time = digest?.generatedAt || "04:00 AM Local";
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
    `## Executive Summary (4:00 AM Stage 0 Pre-Computed Locally — 0 AI Tokens)`,
    `- **Date (America/Chicago)**: \`${todayDate}\``,
    `- **Latest Repo Version**: \`${currentRepoVersion}\``,
    `- **Dataset Totals**: \`${totalBattles}\` battles • \`${totalDvrs}\` DVR bundles • 4:00 AM Stage 0 digest generated: \`${stage0Time}\``,
    `- **Queues**: Stage 3 (Pro/VIP Critical & Manual) = \`${stage3Count}\` | Stage 2 (Supporter/Free, cap ${stage2Cap}/day) = \`${stage2Count}\``,
    `- **Open User-Flagged DVR Reports (${openManualReports.length})**:`,
    manualPreview,
    `- **Release Status**: ${unreleasedText}`,
    ``,
    `## Mandatory Orchestrator Instructions (${ORCHESTRATOR_MODEL} — Orchestrator Neon)`,
    `1. **Read Cached Audit Outputs Only First (Plan Mode Read-Only)**: Read \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/morning_briefing.md\` and inspect targeted sections of \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/nightly_audit_digest.json\`. The 4:00 AM Stage 0 task has already synced Cloudflare, run the 7-day retroactive fix verification, and executed paid-tier pixel rescans (and the delayed Telegram summary sends separately at 6:00 AM)—do **NOT** re-run telemetry sync scripts or dump whole raw \`.mp4\` files. Note: \`write_file\` is blocked while Plan Mode is on—complete all read-only diagnosis first, then call \`exit_plan_mode\` so the execution model writes the issue document and runs Q&A.`,
    `2. **Delegate All Visual Image / Contact-Sheet OCR to Flash**: If any pre-rendered contact sheets or keyframes in \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/preprocessed/<battleId>/\` need visual inspection or text confirmation, delegate via \`invoke_subagent(TypeName: "research", Model: "flash")\`. Never inspect raw images directly in the planning context.`,
    `3. **Focused Root-Cause Diagnosis**: Diagnose open Stage 3 (\`Pro\`/\`VIP\` critical & user-flagged reports) plus up to \`${stage2Cap}\` Stage 2 items, reading only targeted preprocessed \`digest.json\`, frame windows of \`_deep_trace.jsonl\`, or specific Kotlin/TS functions needed to verify each root cause. Proactively suggest escalating to \`Orchestrator (Carbon)\` / \`Carbon High\` via \`ask_question\` only for deep architecture, \`ImageReader\`/\`captureLock\`, 3D HSV scanner, or combat math engine overhauls per \`AGENTS.md\`.`,
    `4. **EXECUTION STEP A — Write the Full Issue Document FIRST (ALONE, Never Batched with \`ask_question\`!)**: Immediately after \`exit_plan_mode\`, your FIRST execution tool call MUST be \`write_file\` **by itself** (do NOT call \`ask_question\` in the same step!) to create \`morning_telemetry_action_plan_${todayDate}.md\` (\`UserFacing: true\`, \`RequestFeedback: false\`) in this conversation's artifact directory. Put **"## 1. Plain-English Open Issues & Decision Guide"** at the VERY TOP of the document (before the summary tables), with one clearly numbered section per open issue (\`Issue 1\`, \`Issue 2\`, ...) explaining in plain English: (a) Battle ID, app version, league & player note / anomaly; (b) what actually happened on screen vs in the HUD/telemetry; (c) exact root cause; and (d) what each proposed fix option changes. Follow Section 1 with the 24h/7d Trainer Summary, Version Regression Matrix, 7-Day Retroactive Fix Proof & Pixel Rescans, and Unreleased Commits Check.`,
    `5. **EXECUTION STEP B — Output Visible Issue Guide + Clickable Document Link BEFORE / WITH \`ask_question\`**: ONLY AFTER \`write_file\` completes (\`Created file.\`), make a second response that **MUST include non-empty visible Markdown chat text (\`content\`)** containing: (a) a prominent clickable link \`[morning_telemetry_action_plan_${todayDate}.md](file:///...)\` at the top, and (b) a concise plain-English numbered summary of every open issue (\`Issue 1\`, \`Issue 2\`, ...) and its options right in the chat message so the user can read everything on desktop or mobile before answering. In that step's \`ask_question\` call, map questions 1-to-1 to \`Issue 1\`, \`Issue 2\`, ..., set explicit \`is_multi_select: false\` (or \`true\`) on every item, and make every \`question\` string self-explanatory in plain English (1–2 sentences describing the actual symptom/issue—NEVER use bare labels like "Area E" without explaining what the issue is!). CRITICAL INTERACTIVE QUESTION RULE: Every question you ask the user anywhere in this conversation—including Step B issue decisions, follow-up clarifications, and the post-implementation vX.XX release/commit confirmation gate—MUST invoke the \`ask_question\` tool with explicit \`is_multi_select\` booleans (NEVER output prose-only questions without calling \`ask_question\`), and every \`exit_plan_mode\` plan that stops for user input MUST explicitly include the \`ask_question\` tool call. If the host immediately aborts \`ask_question\` with an error (e.g. \`user cancelled ask_question\` in \`<2s\`), immediately report the exact host error and render the full numbered questions and A/B/C options cleanly in chat.`,
    `6. **HARD PRE-INTERACTION & RELEASE GATES (ZERO EXCEPTIONS)**:`,
    `   - **Phase 1 (Before the user replies in this chat)**: Operate strictly **READ-ONLY** against the repository and cloud. ONLY read telemetry/DVR/source files, run read-only inspection commands or Flash OCR subagents, write the brain artifact \`morning_telemetry_action_plan_${todayDate}.md\`, and emit Step B's visible summary + \`ask_question\`. Execute **ZERO** repository file edits (\`edit_file\`/\`write_file\` inside \`P:/AntiGravity/SilphScope PvP\`), **ZERO** mutating \`npm\`/\`bash\`/\`git\`/\`wrangler\` commands, **ZERO** version bumps, **ZERO** deploys, and **ZERO** commits/pushes until the user has interacted in this chat and explicitly approved specific fixes. Stop and wait after Step B.`,
    `   - **Phase 2 (After user interaction)**: Implement ONLY the user-approved items, verify Web/TS locally (\`npm run lint && npm run build\`), and **NEVER** run \`./gradlew assembleDebug\` or \`./gradlew assembleRelease\` locally (\`AGENTS.md\` Gate #2).`,
    `   - **Phase 3 (Versioning & Release Gate)**: **NEVER** run \`scripts/bump_version.sh\`, \`npx wrangler deploy\`, \`git commit\`, or \`git push\` (especially when \`VERSION\` / \`app/build.gradle.kts\` still matches an already-published git tag/release) without first passing the \`AGENTS.md\` Section 1 Stop-and-Confirm Versioning & Release Gate via \`ask_question\` (\`is_multi_select: false\`).`,
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
    logLine(`[4:00 AM STAGE 0] Running single-pass 100% local zero-token scan (${initialStartIso})...`);
    runLocalAudit([]);
    logLine(`[OK] 4:00 AM local scan completed for ${todayDate} (0 AI tokens; output ready for 5:15 AM automation & 6:00 AM Telegram).`);
  } finally {
    releaseLock(STAGE0_LOCK_FILE);
  }
}

async function runTelegramOnlyPipeline(todayDate) {
  if (!FORCE_RUN) {
    const tgHistory = readJsonSafe(TELEGRAM_HISTORY_FILE, []);
    const existing = Array.isArray(tgHistory)
      ? tgHistory.find((item) => item && item.date === todayDate && item.sent === true)
      : null;
    if (existing) {
      logLine(`[SKIP] 6:00 AM Telegram summary already sent for ${todayDate}.`);
      return;
    }
  }
  const lockKey = `${todayDate}-telegram`;
  if (!acquireLock(TELEGRAM_LOCK_FILE, lockKey, "Telegram dispatch")) {
    return;
  }
  try {
    logLine(`[6:00 AM TELEGRAM] Dispatching morning summary from 4:00 AM audit digest (${todayDate})...`);
    const res = spawnSync(process.execPath, [AUDIT_SCRIPT, "--send-telegram-only"], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    const stderrText = String(res.stderr || "").trim();
    if (stderrText) {
      for (const errLine of stderrText.split(/\r?\n/)) {
        if (errLine.trim()) logLine(`[TELEGRAM] ${errLine.trim()}`);
      }
    }
    if (res.status !== 0) {
      throw new Error(
        `nightly-telemetry-audit.mjs --send-telegram-only exited with status=${res.status} (${res.error?.message || "unknown"})`
      );
    }
    const tgHistoryRaw = readJsonSafe(TELEGRAM_HISTORY_FILE, []);
    const tgHistory = Array.isArray(tgHistoryRaw) ? tgHistoryRaw : [];
    const filtered = tgHistory.filter((item) => item && item.date !== todayDate);
    filtered.push({ date: todayDate, sent: true, sentAt: new Date().toISOString() });
    fs.writeFileSync(TELEGRAM_HISTORY_FILE, JSON.stringify(filtered.slice(-90), null, 2), "utf8");
    logLine(`[OK] 6:00 AM Telegram summary dispatched for ${todayDate}.`);
  } finally {
    releaseLock(TELEGRAM_LOCK_FILE);
  }
}

async function main() {
  const todayDate = getTodayCentralDateStr();

  if (STAGE0_ONLY) {
    await runStage0Pipeline(todayDate);
    return;
  }

  if (TELEGRAM_ONLY) {
    await runTelegramOnlyPipeline(todayDate);
    return;
  }

  const dailyTitle = `📊 [${todayDate}] Daily Telemetry Audit & Plan — SilphScope PvP`;

  if (LAUNCH_CHAT_ONLY && !FORCE_RUN) {
    const agyCfg = readJsonSafe("C:/Users/Chris/.gemini/config/config.json", null);
    if (
      agyCfg?.sidecars?.["silphscope-nightly-telemetry"] &&
      agyCfg.sidecars["silphscope-nightly-telemetry"].enabled !== false
    ) {
      logLine(
        "[SKIP] Native Antigravity Automation 'silphscope-nightly-telemetry' is enabled; skipping backup launcher."
      );
      return;
    }
  }

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
        logLine(`[LAUNCH-ONLY] Using fresh local nightly_audit_digest.json for ${todayDate} (<4h old).`);
      } else {
        logLine(`[LAUNCH-ONLY] Local audit digest missing or >4h stale; running Stage 0 audit now (Telegram deferred to 6:00 AM)...`);
        digest = runLocalAudit([]);
      }
    } else if (IMMEDIATE_MODE) {
      logLine(`[IMMEDIATE STAGE] Running 100% local zero-token audit (${todayDate})...`);
      digest = runLocalAudit(NO_TELEGRAM ? [] : ["--send-telegram"]);
    } else {
      logLine(`[STAGE 0] Running single-pass 100% local zero-token audit (${initialStartIso})...`);
      digest = runLocalAudit([]);
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
