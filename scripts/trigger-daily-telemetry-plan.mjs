#!/usr/bin/env node
/**
 * SilphScope PvP — Cost-Optimized Nightly Orchestrator (5:00 AM -> 6:00 AM Central)
 *
 * Implements strict Dynamic Model Tiering to minimize AI token spend:
 *
 *   Tier 0 (0 AI Tokens — 5:00 AM to 5:55 AM Local CPU Daemon):
 *     - Runs `scripts/nightly-telemetry-audit.mjs` locally at 5:00 AM (Node 22 + ffmpeg + local v7.08 pixel scanner).
 *     - Sleeps locally in Node.js (0 AI tokens, no LLM context open!) and runs a final delta check at 5:52 AM
 *       to catch any late-arriving P1/P2/HIGH issues before 6:00 AM and send the 6:00 AM Telegram summary.
 *
 *   Tier 1 (`flash` / `flash_lite` — OCR & Routine Summaries):
 *     - All visual OCR / contact-sheet / keyframe inspections MUST be delegated to `invoke_subagent` with `Model: "flash"`.
 *     - When `openActionItemsCount === 0` or only low-severity P4 items exist, uses `flash` to post the concise morning update.
 *
 *   Tier 2 (`pro` / Argon Med-Pro — High-Severity Architectural Action Plans Only):
 *     - Reserved strictly for mornings where `nightly_audit_digest.json` has unresolved `P1_PAID_MANUAL`,
 *       `P2_FREE_MANUAL`, or `P3_PAID_AUTO` HIGH-severity issues (`recommendedPlanningModel === "pro"`).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT_DIR = "P:/AntiGravity/SilphScope PvP";
const CACHE_DIR = path.resolve(ROOT_DIR, ".aistudio", "telemetry_cache");
const THREAD_FILE = path.join(CACHE_DIR, "daily_plan_conversation.json");
const DIGEST_FILE = path.join(CACHE_DIR, "nightly_audit_digest.json");
const AUDIT_SCRIPT = path.resolve(ROOT_DIR, "scripts", "nightly-telemetry-audit.mjs");
const AGENTAPI_BIN = "C:/Users/Chris/.gemini/antigravity/bin/agentapi.bat";
const PINNED_TITLE = "📌 [DAILY TELEMETRY AUDIT & PLAN] — SilphScope PvP";

const rawArgs = process.argv.slice(2);
const IMMEDIATE_MODE = rawArgs.includes("--immediate");

function runLocalAudit(extraArgs = []) {
  spawnSync(process.execPath, [AUDIT_SCRIPT, ...extraArgs], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    windowsHide: true,
  });
  if (fs.existsSync(DIGEST_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DIGEST_FILE, "utf8"));
    } catch {}
  }
  return null;
}

function getMsUntil552AmLocal() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(5, 52, 0, 0);
  const diff = target.getTime() - now.getTime();
  // Only wait if we are currently between 4:50 AM and 5:51 AM
  if (diff > 0 && diff <= 65 * 60 * 1000) {
    return diff;
  }
  return 0;
}

function buildDynamicPrompt(digest) {
  const modelPolicy = digest?.modelRoutingPolicy || {};
  const recModel = modelPolicy.recommendedPlanningModel || "flash";
  const stage2Count = modelPolicy.stage2SupporterAndFreeHighTier?.queuedTodayCount ?? 0;
  const stage2Cap = modelPolicy.stage2SupporterAndFreeHighTier?.dailyCapX ?? 3;
  const stage3Count = modelPolicy.stage3ProAndVipCriticalTier?.queuedTodayCount ?? 0;
  const lateCount = digest?.totals?.lateArrivalsCount ?? 0;

  const unreleased = digest?.unreleasedCommitsAudit;
  const unreleasedText = unreleased?.hasUnreleasedCommits
    ? `6. UNRELEASED COMMITS DETECTED ON MAIN: There are ${unreleased.unreleasedCommitsCount} unreleased commit(s) ahead of ${unreleased.latestReleaseTag} (including ${unreleased.commits.map((c) => `[${c.hash}] ${c.subject}`).slice(0, 3).join("; ")}). You MUST ask the user directly via ask_question whether they want to build and release ${unreleased.suggestedNextVersion} today, and include this release decision in morning_telemetry_action_plan.md with RequestFeedback: true.`
    : `6. NO UNRELEASED COMMITS: Main is in sync with latest release tag ${unreleased?.latestReleaseTag || "HEAD"}.`;

  return [
    `[5-STAGE MODEL & EFFORT BUDGET PYRAMID: Stage 3 (Argon Medium Pro/VIP) = ${stage3Count} | Stage 2 (Argon Low Supporter/Free, Cap X=${stage2Cap}/day) = ${stage2Count} | Late 5:00–5:52 AM Arrivals = ${lateCount}]`,
    `STRICT TOKEN-MINIMIZATION & EFFORT TIERING PROTOCOL:`,
    `1. STAGE 0 (0 AI Tokens — Already Completed Locally): \`scripts/nightly-telemetry-audit.mjs\` has already synced Cloudflare, built the 24h/7d Trainer Summary, Version Regression Matrix, 7-day Retroactive Fix Audit, Paid-Player Full-Frame Pixel Re-Scans, and sent the 6:00 AM Telegram summary. Do NOT re-run shell scripts or read raw \`.mp4\` / \`.jsonl\` files.`,
    `2. STAGE 1 (Flash Subagent Only for OCR / Video Frames): If any contact-sheet or keyframe image requires visual OCR or frame verification, you MUST delegate it via \`invoke_subagent(TypeName: "research", Model: "flash")\`. Never inspect images directly in the main planning context.`,
    `3. STAGE 2 (Argon Low — Supporter Forever Tier & Free High/Manual Issues, Capped at X=${stage2Cap}/day): Process at most ${stage2Cap} unresolved Supporter/Free issues from \`stage2SupporterAndFreeHighTier.items\` using concise, low-effort triage.`,
    `4. STAGE 3 (Argon Medium — Pro & VIP Critical / Manually Reported Issues): For any unresolved Pro/VIP issues in \`stage3ProVipMediumQueue\`, perform focused medium-effort root-cause diagnosis using the pre-sliced audit summary.`,
    `5. STAGE 4 (1x Final High-Level Thinking Synthesis on Cached Data Only): Read \`P:/AntiGravity/SilphScope PvP/.aistudio/telemetry_cache/morning_briefing.md\` and \`nightly_audit_digest.json\`, perform ONE single high-level synthesis pass over the cached digest (< 8 KB text), and update the interactive artifact \`morning_telemetry_action_plan.md\` (\`UserFacing: true, RequestFeedback: true\`) with the 24h/7d Trainer Summary, Version Regression Matrix, 7-Day Retroactive Fix Proof, and interactive Q&A options for 6:00 AM review.`,
    unreleasedText,
  ].join("\n");
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const initialStartIso = new Date().toISOString();

  // Step 1 (5:00 AM): Run 100% local zero-token sync, preprocessing, and retroactive audit
  console.log(`[5:00 AM STAGE] Running 100% local zero-token audit (${initialStartIso})...`);
  let digest = runLocalAudit([]);

  // Step 2 (5:00 AM -> 5:52 AM): Wait in local Node.js (0 AI tokens!) for any late arrivals before 6:00 AM
  const waitMs = IMMEDIATE_MODE ? 0 : getMsUntil552AmLocal();
  if (waitMs > 0) {
    console.log(
      `[5:00–5:52 AM WATCH] Sleeping locally in Node.js for ${Math.round(
        waitMs / 60000
      )}m (0 AI tokens) to catch any late P1/P2/HIGH issues before 6:00 AM...`
    );
    await new Promise((r) => setTimeout(r, waitMs));
  }

  // Step 3 (5:52 AM): Run final delta sync + send 6:00 AM Telegram high-level summary
  console.log(`[5:52 AM STAGE] Running final delta check & dispatching 6:00 AM Telegram summary...`);
  digest = runLocalAudit(["--check-delta-since", initialStartIso, "--send-telegram"]) || digest;

  const recModel = digest?.modelRoutingPolicy?.recommendedPlanningModel || "flash";
  const prompt = buildDynamicPrompt(digest);

  // Step 4: Wake the persistent pinned conversation thread (`📌 [DAILY TELEMETRY AUDIT & PLAN] — SilphScope PvP`)
  let existingConvId = null;
  if (fs.existsSync(THREAD_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(THREAD_FILE, "utf8"));
      if (data && data.conversationId) {
        existingConvId = String(data.conversationId).trim();
      }
    } catch {}
  }

  if (existingConvId) {
    const check = spawnSync(AGENTAPI_BIN, ["get-conversation-metadata", existingConvId], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (check.status === 0) {
      const sendRes = spawnSync(
        AGENTAPI_BIN,
        ["send-message", `--title=${PINNED_TITLE}`, existingConvId, prompt],
        { encoding: "utf8", windowsHide: true }
      );
      if (sendRes.status === 0) {
        console.log(
          `[OK] Updated persistent pinned daily plan thread (${existingConvId}) [recommendedModel=${recModel}].`
        );
        return;
      }
    }
  }

  // If creating the persistent thread for the first time, launch with `--model=<flash|pro>` dynamically!
  const agentModelFlag = recModel === "pro" ? "pro" : "flash";
  const createRes = spawnSync(
    AGENTAPI_BIN,
    ["new-conversation", `--model=${agentModelFlag}`, `--title=${PINNED_TITLE}`, "--", prompt],
    { encoding: "utf8", windowsHide: true }
  );
  const out = `${createRes.stdout || ""}\n${createRes.stderr || ""}`.trim();
  const uuidMatch = out.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch) {
    fs.writeFileSync(
      THREAD_FILE,
      JSON.stringify(
        {
          conversationId: uuidMatch[0],
          title: PINNED_TITLE,
          initialModel: agentModelFlag,
          updatedAt: new Date().toISOString(),
        },
        2
      ),
      "utf8"
    );
    console.log(
      `[OK] Created and pinned persistent daily plan thread: ${uuidMatch[0]} (model=${agentModelFlag})`
    );
  } else {
    console.log(out);
  }
}

main().catch((err) => {
  console.error("[TRIGGER ERROR]", err);
  process.exit(1);
});
