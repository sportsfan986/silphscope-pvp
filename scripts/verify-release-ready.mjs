#!/usr/bin/env node
/**
 * SilphScope PvP — Zero-Token Release Parity & Stop-and-Confirm Tag-Collision Gate
 *
 * Usage:
 *   node scripts/verify-release-ready.mjs                   # Full parity + tag-collision check
 *   node scripts/verify-release-ready.mjs --allow-existing-tag  # Parity check without tag collision failure
 *   node scripts/verify-release-ready.mjs --install-hook        # Install .git/hooks/pre-commit guard
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const allowExistingTag =
  args.has('--allow-existing-tag') || process.env.ALLOW_TAG_OVERWRITE === '1';

if (args.has('--install-hook')) {
  const hookDir = path.join(ROOT, '.git', 'hooks');
  const hookPath = path.join(hookDir, 'pre-commit');
  const hookScript = [
    '#!/bin/sh',
    '# SilphScope PvP — Mechanical Stop-and-Confirm Versioning Gate',
    'export PATH="/c/Users/Chris/.nodejs/node-v22.14.0-win-x64:$PATH"',
    '',
    'BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")',
    'if [ "$BRANCH" = "main" ] && [ "${ALLOW_TAG_OVERWRITE:-0}" != "1" ]; then',
    '  if command -v node >/dev/null 2>&1; then',
    '    node scripts/verify-release-ready.mjs || exit 1',
    '  elif [ -x "/c/Users/Chris/.nodejs/node-v22.14.0-win-x64/node.exe" ]; then',
    '    "/c/Users/Chris/.nodejs/node-v22.14.0-win-x64/node.exe" scripts/verify-release-ready.mjs || exit 1',
    '  else',
    '    TAG=$(tr -d "[:space:]" < VERSION 2>/dev/null || echo "")',
    '    if [ -n "$TAG" ] && [ -n "$(git tag -l "$TAG")" ]; then',
    '      echo "[STOP-AND-CONFIRM GATE] VERSION ($TAG) already exists in git tags. Bump version before committing on main." >&2',
    '      exit 1',
    '    fi',
    '  fi',
    'fi',
    'exit 0',
    '',
  ].join('\n');

  fs.mkdirSync(hookDir, { recursive: true });
  fs.writeFileSync(hookPath, hookScript, { encoding: 'utf8' });
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {
    // Ignore chmod error on non-POSIX filesystems
  }
  console.log(`[OK] Installed pre-commit hook at ${hookPath}`);
  process.exit(0);
}

const errors = [];
const read = (relPath) =>
  fs.readFileSync(path.join(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 1. Parse VERSION
let tag = '';
let num = '';
let versionCode = 0;

try {
  tag = read('VERSION').trim();
  const m = tag.match(/^v(\d+)\.(\d+)$/);
  if (!m) {
    errors.push(`VERSION ("${tag}") must match ^v<major>.<minor>$ (e.g. v7.42).`);
  } else {
    const major = Number.parseInt(m[1], 10);
    const minor = Number.parseInt(m[2], 10);
    num = `${m[1]}.${m[2]}`;
    versionCode = 1000 + major * 100 + minor;
  }
} catch (err) {
  errors.push(`Failed to read VERSION: ${err.message}`);
}

if (errors.length === 0) {
  // 2. Git tag collision gate
  if (!allowExistingTag) {
    try {
      const existingTag = execFileSync('git', ['tag', '-l', tag], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim();
      if (existingTag === tag) {
        errors.push(
          `[STOP-AND-CONFIRM GATE] Tag "${tag}" already exists in local git tags. ` +
            `Committing/pushing to main without bumping will overwrite silphscope-pvp-${tag}.apk on GitHub Releases. ` +
            `Bump version first (bash scripts/bump_version.sh) or pass --allow-existing-tag only for local parity verification.`
        );
      }
    } catch (err) {
      errors.push(`Failed to check git tags: ${err.message}`);
    }
  }

  // 3. Cross-file sync parity
  const checkContains = (relPath, needle, label) => {
    const content = read(relPath);
    if (!content.includes(needle)) {
      errors.push(`${relPath}: missing expected ${label} (${needle})`);
    }
  };

  const gradle = read('app/build.gradle.kts');
  if (!new RegExp(`versionCode\\s*=\\s*${versionCode}\\b`).test(gradle)) {
    errors.push(`app/build.gradle.kts: expected versionCode = ${versionCode}`);
  }
  if (!new RegExp(`versionName\\s*=\\s*"${escapeRegex(num)}"`).test(gradle)) {
    errors.push(`app/build.gradle.kts: expected versionName = "${num}"`);
  }

  const overlayKt = read('app/src/main/java/com/gbl/overlay/OverlayService.kt');
  if (!new RegExp(`const\\s+val\\s+APP_VERSION\\s*=\\s*"${escapeRegex(num)}"`).test(overlayKt)) {
    errors.push(`OverlayService.kt: expected const val APP_VERSION = "${num}"`);
  }
  if (!new RegExp(`const\\s+val\\s+APP_VERSION_CODE\\s*=\\s*${versionCode}\\b`).test(overlayKt)) {
    errors.push(`OverlayService.kt: expected const val APP_VERSION_CODE = ${versionCode}`);
  }

  try {
    const pkg = JSON.parse(read('package.json'));
    if (pkg.version !== `${num}.0`) {
      errors.push(`package.json: expected "version": "${num}.0", got "${pkg.version}"`);
    }
  } catch (err) {
    errors.push(`package.json: failed to parse JSON (${err.message})`);
  }

  checkContains('src/App.tsx', `${tag} • Android Native Overlay`, 'header version badge');
  checkContains('src/App.tsx', `SilphScope PvP ${tag} Overlay`, 'footer version label');
  checkContains('src/components/MarketingWebsite.tsx', `${tag} • Latest Release`, 'website header release badge');
  checkContains(
    'src/components/MarketingWebsite.tsx',
    `Instant 1-Click Direct Release (${tag})`,
    'website direct download release label'
  );
  checkContains(
    'src/components/VersionRoadmapInfographic.tsx',
    `VERSION_EVOLUTION_HISTORY[0]?.version || '${tag}'`,
    'roadmap infographic fallback version'
  );
  checkContains(
    'cloudflare/telemetry-worker/wrangler.toml',
    `WORKER_VERSION = "${num}.0"`,
    'WORKER_VERSION'
  );
  checkContains(
    'cloudflare/telemetry-worker/worker.mjs',
    `SilphScope-PvP-Version-Check/${num}`,
    'worker version check User-Agent'
  );
  checkContains('README.md', `(${tag})`, 'README version heading');
  checkContains('README.md', `silphscope-pvp-${tag}.apk`, 'README APK filename');
  checkContains(
    'AGENTS.md',
    `**Current Version**: \`${tag}\` (\`versionCode = ${versionCode}\`)`,
    'AGENTS.md header version'
  );

  // 4. CHANGELOG.md section & highlight gate
  const changelog = read('CHANGELOG.md');
  const clHeaderRe = new RegExp(`^## ${escapeRegex(tag)}(?:\\s|$).*$`, 'm');
  const clMatch = clHeaderRe.exec(changelog);
  if (!clMatch) {
    errors.push(
      `CHANGELOG.md: missing unbracketed release section header starting with "## ${tag} "`
    );
  } else {
    const afterHeader = changelog.slice(clMatch.index + clMatch[0].length);
    const sepIdx = afterHeader.search(/^---$/m);
    const sectionBody = sepIdx === -1 ? afterHeader : afterHeader.slice(0, sepIdx);
    if (!/^\s*-\s+\S+/m.test(sectionBody)) {
      errors.push(`CHANGELOG.md: section for ${tag} must include at least one "- " bullet highlight.`);
    }
  }

  // 5. roadmapData.ts top entry gate
  const roadmap = read('src/data/roadmapData.ts');
  const histIdx = roadmap.indexOf('export const VERSION_EVOLUTION_HISTORY');
  if (histIdx === -1) {
    errors.push('src/data/roadmapData.ts: missing VERSION_EVOLUTION_HISTORY');
  } else {
    const firstVerMatch = roadmap.slice(histIdx).match(/version:\s*'([^']+)'/);
    if (!firstVerMatch || firstVerMatch[1] !== tag) {
      errors.push(
        `src/data/roadmapData.ts: top VERSION_EVOLUTION_HISTORY entry must be "${tag}", found "${firstVerMatch ? firstVerMatch[1] : 'none'}"`
      );
    }
  }

  // 6. AGENTS.md byte cap gate (20,000 bytes < 24,000 byte Antigravity cap)
  const agentsBytes = fs.readFileSync(path.join(ROOT, 'AGENTS.md')).length;
  if (agentsBytes > 20000) {
    errors.push(
      `AGENTS.md is ${agentsBytes} bytes (> 20,000 byte safety limit for Antigravity's 24 KB rule cap).`
    );
  }
}

if (errors.length > 0) {
  console.error('Release readiness check FAILED:\n');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

const agentsSize = fs.readFileSync(path.join(ROOT, 'AGENTS.md')).length;
console.log(
  `[OK] Release check passed for ${tag} (versionCode=${versionCode}, AGENTS.md=${agentsSize} bytes${allowExistingTag ? ', --allow-existing-tag' : ''}).`
);
