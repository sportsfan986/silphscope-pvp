#!/usr/bin/env node
/**
 * SilphScope PvP — Automated Cloudflare Worker Secret Generator & Provisioner (`scripts/setup-worker-secrets.mjs`)
 *
 * Automatically generates cryptographically secure 256-bit secrets for:
 *   - ADMIN_API_KEY        (also saved as SILPHSCOPE_ADMIN_KEY in gitignored `.env.admin` for local CLI scripts)
 *   - SESSION_HMAC_KEY     (signs web/app session tokens)
 *   - LICENSE_HMAC_KEY     (signs & verifies offline/online license tokens)
 *   - PASSWORD_PEPPER      (server-side pepper for PBKDF2-SHA256 password hashes)
 *
 * And optionally uploads external webhook signing secrets if provided in `.env.admin` or CLI flags:
 *   - STRIPE_WEBHOOK_SECRET (from Stripe Dashboard -> Developers -> Webhooks -> Signing secret `whsec_...`)
 *   - BMC_WEBHOOK_SECRET    (from Buy Me a Coffee -> Webhooks)
 *
 * Usage:
 *   node scripts/setup-worker-secrets.mjs
 *   node scripts/setup-worker-secrets.mjs --deploy
 *   node scripts/setup-worker-secrets.mjs --stripe-secret whsec_xxx --bmc-secret yyy --deploy
 *   node scripts/setup-worker-secrets.mjs --rotate
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT_DIR = process.cwd();
const WORKER_DIR = path.resolve(ROOT_DIR, "cloudflare", "telemetry-worker");
const ENV_ADMIN_PATH = path.resolve(ROOT_DIR, ".env.admin");

const argv = process.argv.slice(2);
const shouldRotate = argv.includes("--rotate");
const shouldDeploy = argv.includes("--deploy");
const dryRun = argv.includes("--dry-run");

function getArgValue(flag) {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && argv[idx + 1] && !argv[idx + 1].startsWith("--")) {
    return argv[idx + 1].trim();
  }
  return "";
}

function parseEnvFile(filePath) {
  const map = {};
  if (!fs.existsSync(filePath)) return map;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key) map[key] = val;
  }
  return map;
}

const existing = parseEnvFile(ENV_ADMIN_PATH);

const adminApiKey =
  !shouldRotate && (process.env.ADMIN_API_KEY || existing.ADMIN_API_KEY || existing.SILPHSCOPE_ADMIN_KEY)
    ? process.env.ADMIN_API_KEY || existing.ADMIN_API_KEY || existing.SILPHSCOPE_ADMIN_KEY
    : `sspvp_admin_${crypto.randomBytes(32).toString("hex")}`;

const sessionHmacKey =
  !shouldRotate && (process.env.SESSION_HMAC_KEY || existing.SESSION_HMAC_KEY)
    ? process.env.SESSION_HMAC_KEY || existing.SESSION_HMAC_KEY
    : crypto.randomBytes(32).toString("hex");

const licenseHmacKey =
  !shouldRotate && (process.env.LICENSE_HMAC_KEY || existing.LICENSE_HMAC_KEY)
    ? process.env.LICENSE_HMAC_KEY || existing.LICENSE_HMAC_KEY
    : crypto.randomBytes(32).toString("hex");

const passwordPepper =
  !shouldRotate && (process.env.PASSWORD_PEPPER || existing.PASSWORD_PEPPER)
    ? process.env.PASSWORD_PEPPER || existing.PASSWORD_PEPPER
    : crypto.randomBytes(32).toString("hex");

const stripeWebhookSecret =
  getArgValue("--stripe-secret") ||
  process.env.STRIPE_WEBHOOK_SECRET ||
  existing.STRIPE_WEBHOOK_SECRET ||
  "";

const bmcWebhookSecret =
  getArgValue("--bmc-secret") ||
  process.env.BMC_WEBHOOK_SECRET ||
  existing.BMC_WEBHOOK_SECRET ||
  "";

// Save to gitignored `.env.admin` so local CLI tools (`manage-keys.mjs`, `ingest-telemetry.mjs`) load it automatically
const envLines = [
  "# SilphScope PvP — Auto-Generated Admin & Worker Cryptographic Secrets (GITIGNORED - DO NOT COMMIT)",
  `# Generated/Updated: ${new Date().toISOString()}`,
  `ADMIN_API_KEY=${adminApiKey}`,
  `SILPHSCOPE_ADMIN_KEY=${adminApiKey}`,
  `SILPHSCOPE_TELEMETRY_ADMIN_KEY=${adminApiKey}`,
  `SESSION_HMAC_KEY=${sessionHmacKey}`,
  `LICENSE_HMAC_KEY=${licenseHmacKey}`,
  `PASSWORD_PEPPER=${passwordPepper}`,
];
if (stripeWebhookSecret) {
  envLines.push(`STRIPE_WEBHOOK_SECRET=${stripeWebhookSecret}`);
}
if (bmcWebhookSecret) {
  envLines.push(`BMC_WEBHOOK_SECRET=${bmcWebhookSecret}`);
}
fs.writeFileSync(ENV_ADMIN_PATH, envLines.join("\n") + "\n", { mode: 0o600 });
console.log(`✅ Saved generated secrets locally to gitignored ${ENV_ADMIN_PATH}`);

const secretsToPush = [
  ["ADMIN_API_KEY", adminApiKey],
  ["SESSION_HMAC_KEY", sessionHmacKey],
  ["LICENSE_HMAC_KEY", licenseHmacKey],
  ["PASSWORD_PEPPER", passwordPepper],
];

if (stripeWebhookSecret) {
  secretsToPush.push(["STRIPE_WEBHOOK_SECRET", stripeWebhookSecret]);
} else {
  console.log(
    "ℹ️  STRIPE_WEBHOOK_SECRET not provided yet (get `whsec_...` from Stripe Dashboard -> Developers -> Webhooks, then pass `--stripe-secret whsec_...` or run `npx wrangler secret put STRIPE_WEBHOOK_SECRET`)."
  );
}

if (bmcWebhookSecret) {
  secretsToPush.push(["BMC_WEBHOOK_SECRET", bmcWebhookSecret]);
} else {
  console.log(
    "ℹ️  BMC_WEBHOOK_SECRET not provided yet (get from Buy Me a Coffee -> Webhooks, then pass `--bmc-secret ...` or run `npx wrangler secret put BMC_WEBHOOK_SECRET`)."
  );
}

if (dryRun) {
  console.log("Dry-run complete. Skipping `wrangler secret put`.");
  process.exit(0);
}

for (const [secretName, secretValue] of secretsToPush) {
  console.log(`🔒 Uploading ${secretName} to Cloudflare Worker...`);
  const res = spawnSync("npx", ["wrangler", "secret", "put", secretName], {
    cwd: WORKER_DIR,
    input: secretValue,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (res.status !== 0) {
    console.error(`❌ Failed to upload ${secretName} (exit code ${res.status}).`);
    process.exit(res.status || 1);
  }
}

console.log("✅ All configured secrets uploaded to Cloudflare Worker!");

if (shouldDeploy) {
  console.log("🚀 Deploying Cloudflare Worker (`npx wrangler deploy`)...");
  const dep = spawnSync("npx", ["wrangler", "deploy"], {
    cwd: WORKER_DIR,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  process.exit(dep.status || 0);
}
