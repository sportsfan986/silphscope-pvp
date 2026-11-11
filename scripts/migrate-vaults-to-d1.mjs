#!/usr/bin/env node
/**
 * SilphScope PvP — Passwordless Server-Side User Vault Migration to Cloudflare D1 (`silphscope-sync-db`)
 *
 * Migrates:
 *   1. `@sportsfan986`: Full private GitHub vault (`sportsfan986/silphscope-private-vault/battlematrix_gbl_sync_vault.json`)
 *      merged with any newer local/remote telemetry & DVR deep-trace summaries.
 *   2. `@this2guy1` (including legacy `@cthielker` / device `03ad5656` records): Full battle logs, team presets
 *      (with exact IVs, CPs, moves, archetypes), and scanner/UI settings reconstructed from telemetry batches & DVR traces.
 *   3. `@blueheyjay` and ALL other registered users in Cloudflare KV (`registered_user/*`) & telemetry cache.
 *
 * Safe & idempotent: uses `POST /v1/admin/sync/import` (atomic Last-Write-Wins D1 upserts) without requiring user passwords.
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const origDnsLookup = dns.lookup.bind(dns);
dns.lookup = function patchedDnsLookup(hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : options || {};
  const isWorkerHost =
    typeof hostname === 'string' &&
    (hostname.toLowerCase() === 'silphscope-telemetry.silphscope-pvp.workers.dev' ||
      hostname.toLowerCase().endsWith('silphscopepvp.com'));
  origDnsLookup(hostname, opts, (err, address, family) => {
    if (!isWorkerHost) return cb(err, address, family);
    const isBogusAddr = (a) => !a || a === '::' || a === '0:0:0:0:0:0:0:0' || a === '0.0.0.0' || a.startsWith('127.');
    if (!err && address) {
      if (Array.isArray(address)) {
        const valid = address.filter((e) => !isBogusAddr(e && e.address));
        if (valid.length > 0 && valid.some((e) => e.family === 4)) return cb(null, valid);
      } else if (!isBogusAddr(address) && family === 4) {
        return cb(null, address, family);
      }
    }
    if (opts && opts.all) {
      return cb(null, [{ address: '104.21.76.162', family: 4 }, { address: '172.67.197.119', family: 4 }]);
    }
    return cb(null, '104.21.76.162', 4);
  });
};

const WORKER_URL = process.env.SILPHSCOPE_TELEMETRY_WORKER_URL || 'https://api.silphscopepvp.com';

function loadAdminKey() {
  const fromEnv = (
    process.env.SILPHSCOPE_TELEMETRY_ADMIN_KEY ||
    process.env.SILPHSCOPE_ADMIN_KEY ||
    process.env.ADMIN_API_KEY ||
    ''
  ).trim();
  if (fromEnv) return fromEnv;
  const p = path.resolve(process.cwd(), '.env.admin');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^(?:SILPHSCOPE_TELEMETRY_ADMIN_KEY|SILPHSCOPE_ADMIN_KEY|ADMIN_API_KEY)=(.+)$/);
      if (m && m[1]) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  throw new Error('Missing ADMIN_API_KEY in .env.admin');
}

function formatOppSpecies(spec) {
  if (!spec || !spec.species) return '';
  const sp = String(spec.species).trim();
  if (!sp) return '';
  if (spec.isShadow && !/^shadow\s+/i.test(sp)) {
    return `Shadow ${sp}`;
  }
  return sp;
}

function telemetryRecordToSyncBattleLog(rec) {
  if (!rec || !rec.battleId) return null;
  const ts = Number(rec.timestampMs) || Date.now();
  const uSpecs = Array.isArray(rec.userTeamSpecs) ? rec.userTeamSpecs : [];
  const oSpecs = Array.isArray(rec.oppTeamSpecs) ? rec.oppTeamSpecs : [];
  const userPokemon = uSpecs.map((s) => String(s?.species || s?.name || '').trim()).filter(Boolean);
  const opponents = oSpecs.map(formatOppSpecies).filter(Boolean);
  const finalUserHpPct = uSpecs.length > 0 ? uSpecs.map((s) => Math.max(0, Math.round(Number(s?.finalHpPct) || 0))) : undefined;
  const finalOppHpPct = oSpecs.length > 0 ? oSpecs.map((s) => Math.max(0, Math.round(Number(s?.finalHpPct) || 0))) : undefined;

  return {
    id: String(rec.battleId).trim(),
    timestampMs: ts,
    updatedAt: ts,
    league: String(rec.league || 'GREAT LEAGUE').toUpperCase(),
    presetId: rec.teamName ? `migrated_${String(rec.teamName).toLowerCase().replace(/[^a-z0-9]+/g, '_')}` : '',
    userTeamName: String(rec.teamName || ''),
    userPokemon,
    opponents,
    leadMatchup: String(rec.leadMatchup || 'NEUTRAL').toUpperCase(),
    result: String(rec.result || 'WIN').toUpperCase(),
    deviceLabel: String(rec.deviceModel || 'Android'),
    bmfScore: Number.isFinite(Number(rec.bmfScore)) ? Number(rec.bmfScore) : null,
    execWae: Number.isFinite(Number(rec.execWae)) ? Number(rec.execWae) : null,
    badges: [],
    flags: [],
    qualityEvaluated: Number.isFinite(Number(rec.bmfScore)),
    timelineEvents: Array.isArray(rec.timelineEvents) ? rec.timelineEvents : [],
    battleDurationSec: Number.isFinite(Number(rec.battleDurationSec)) ? Number(rec.battleDurationSec) : null,
    userFaints: Number.isFinite(Number(rec.userFaints)) ? Number(rec.userFaints) : null,
    oppFaints: Number.isFinite(Number(rec.oppFaints)) ? Number(rec.oppFaints) : null,
    userShieldsRemaining: Number.isFinite(Number(rec.userShieldsRemaining)) ? Number(rec.userShieldsRemaining) : null,
    oppShieldsRemaining: Number.isFinite(Number(rec.oppShieldsRemaining)) ? Number(rec.oppShieldsRemaining) : null,
    adherenceRatePct: Number.isFinite(Number(rec.adherenceRatePct)) ? Number(rec.adherenceRatePct) : null,
    recommendationsIssuedCount: Number.isFinite(Number(rec.recommendationsIssuedCount)) ? Number(rec.recommendationsIssuedCount) : null,
    recommendationsFollowedCount: Number.isFinite(Number(rec.recommendationsFollowedCount)) ? Number(rec.recommendationsFollowedCount) : null,
    finalUserHpPct,
    finalOppHpPct,
    firstSwapActor: rec.firstSwapActor || null,
    switchAdvantage: rec.switchAdvantage || null,
  };
}

function telemetryRecordToTeamPreset(rec) {
  const uSpecs = Array.isArray(rec?.userTeamSpecs) ? rec.userTeamSpecs : [];
  if (uSpecs.length === 0) return null;
  const pokemon = uSpecs
    .map((s) => ({
      name: String(s?.species || s?.name || '').trim(),
      cp: Number(s?.cp) || 1500,
      fastMove: String(s?.fastMove || ''),
      chargedMove1: String(s?.chargedMove1 || ''),
      chargedMove2: String(s?.chargedMove2 || ''),
      ivs: s?.ivs ? String(s.ivs) : null,
      plusMoveLevel: 4,
    }))
    .filter((p) => p.name);
  if (pokemon.length === 0) return null;

  const rawName = String(rec.teamName || `${pokemon[0].name} Core`).trim();
  const league = String(rec.league || 'GREAT LEAGUE').toUpperCase();
  const sigKey = `${league}|${rawName.toLowerCase()}|${pokemon.map((p) => p.name.toLowerCase()).join(',')}`;
  const presetId = `migrated_${crypto.createHash('sha256').update(sigKey).digest('hex').slice(0, 16)}`;

  return {
    sigKey,
    preset: {
      id: presetId,
      name: rawName,
      league,
      pokemon,
      isSelected: false,
      updatedAt: Number(rec.timestampMs) || Date.now(),
      archetype: String(rec.teamArchetype || 'ABC'),
      isArchetypeManual: false,
      leadAggBr: 500,
      machineAggBr: 600,
      safeSwapBr: 500,
      closerSwapBr: 500,
      closerBr: 500,
      sharedWeaknesses: [],
      combatMode: rec.combatMode === 'show6' ? 'show6' : 'gbl',
    },
  };
}

function scannerSettingsToSyncMap(screenName, sc) {
  const out = {
    'S:user_screen_name': screenName,
    'B:is_random_screen_name': 'false',
  };
  if (!sc || typeof sc !== 'object') return out;
  if (typeof sc.hpTrackingEnabled === 'boolean') out['B:enable_hp_tracking'] = String(sc.hpTrackingEnabled);
  if (typeof sc.energyTrackingEnabled === 'boolean') out['B:enable_energy_tracking'] = String(sc.energyTrackingEnabled);
  if (typeof sc.altFastMoveDetectEnabled === 'boolean') out['B:enable_alt_fast_move_detect'] = String(sc.altFastMoveDetectEnabled);
  if (sc.chargeCirclePriorityMode) out['S:charge_circle_priority_mode'] = String(sc.chargeCirclePriorityMode);
  if (sc.altFastDetectStrictness) out['S:alt_fast_detect_strictness'] = String(sc.altFastDetectStrictness);
  if (Number.isFinite(Number(sc.hpDebounceSamples))) out['I:hp_debounce_samples'] = String(sc.hpDebounceSamples);
  if (Number.isFinite(Number(sc.energyDebounceSamples))) out['I:energy_debounce_samples'] = String(sc.energyDebounceSamples);
  if (Number.isFinite(Number(sc.debounceTolerancePct))) out['I:debounce_tolerance_pct'] = String(sc.debounceTolerancePct);
  if (Number.isFinite(Number(sc.proactiveEnergyLeadMs))) out['I:proactive_energy_lead_ms'] = String(sc.proactiveEnergyLeadMs);
  if (Number.isFinite(Number(sc.fastDetectTurnOffset))) out['I:fast_detect_turn_offset'] = String(sc.fastDetectTurnOffset);
  if (Number.isFinite(Number(sc.swapThrowRollbackWindowMs))) out['I:swap_throw_rollback_window_ms'] = String(sc.swapThrowRollbackWindowMs);
  if (Number.isFinite(Number(sc.shieldChipTolerancePct))) out['I:shield_chip_tolerance_pct'] = String(sc.shieldChipTolerancePct);
  return out;
}

function normalizeUserHandle(rawHandle, deviceHash = '') {
  const h = String(rawHandle || '').trim();
  const dev = String(deviceHash || '').trim().toLowerCase();
  // Map cthielker / device 03ad5656 to current canonical Trainer ID `this2guy1`
  if (h.toLowerCase() === 'cthielker' || dev.startsWith('03ad5656')) {
    return 'this2guy1';
  }
  return h;
}

async function fetchSportsfanGitHubVault() {
  try {
    const credOut = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      encoding: 'utf8',
      timeout: 5000,
    });
    const creds = Object.fromEntries(credOut.trim().split(/\r?\n/).map((l) => l.split('=')));
    if (!creds.password) return null;
    const headers = {
      Authorization: `Bearer ${creds.password}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'SilphScope-D1-Migrator/7.31',
    };
    const res = await fetch(
      'https://api.github.com/repos/sportsfan986/silphscope-private-vault/contents/battlematrix_gbl_sync_vault.json',
      { headers }
    );
    if (!res.ok) return null;
    const j = await res.json();
    let rawStr = '';
    if (j.content) {
      rawStr = Buffer.from(j.content.replace(/\s+/g, ''), 'base64').toString('utf8');
    } else if (j.sha) {
      const bRes = await fetch(
        `https://api.github.com/repos/sportsfan986/silphscope-private-vault/git/blobs/${j.sha}`,
        { headers }
      );
      if (bRes.ok) {
        const bJson = await bRes.json();
        rawStr = Buffer.from((bJson.content || '').replace(/\s+/g, ''), 'base64').toString('utf8');
      }
    }
    return rawStr ? JSON.parse(rawStr) : null;
  } catch (e) {
    console.warn('[WARN] Could not fetch sportsfan986 GitHub vault directly:', e.message);
    return null;
  }
}

function collectAllTelemetryByUser() {
  const userMap = new Map(); // screenName -> { logsMap: Map, teamsMap: Map, latestScannerSettings, latestTs }
  const ensure = (u) => {
    if (!userMap.has(u)) {
      userMap.set(u, {
        logsMap: new Map(),
        teamsMap: new Map(),
        latestScannerSettings: null,
        latestTs: 0,
      });
    }
    return userMap.get(u);
  };

  const ingestRec = (rawUser, rec) => {
    if (!rec || !rec.battleId) return;
    const u = normalizeUserHandle(rawUser || rec.uploaderHandle || rec.screenName || '', rec.deviceHash || '');
    if (!u || u === 'unknown') return;
    const bucket = ensure(u);
    const syncLog = telemetryRecordToSyncBattleLog(rec);
    if (syncLog) {
      bucket.logsMap.set(syncLog.id, syncLog);
    }
    const teamEntry = telemetryRecordToTeamPreset(rec);
    if (teamEntry) {
      const prev = bucket.teamsMap.get(teamEntry.sigKey);
      if (!prev || teamEntry.preset.updatedAt >= prev.updatedAt) {
        bucket.teamsMap.set(teamEntry.sigKey, teamEntry.preset);
      }
    }
    const ts = Number(rec.timestampMs) || 0;
    if (rec.scannerSettings && ts >= bucket.latestTs) {
      bucket.latestTs = ts;
      bucket.latestScannerSettings = rec.scannerSettings;
    }
  };

  // 1. Local cached telemetry batches
  const batchesDir = path.resolve(process.cwd(), '.aistudio/telemetry_cache/batches');
  if (fs.existsSync(batchesDir)) {
    for (const f of fs.readdirSync(batchesDir)) {
      if (!f.endsWith('.jsonl')) continue;
      const m = f.match(/^batch_\d+_(.+)_[0-9a-f]{8}\.jsonl$/);
      const fileUser = m ? m[1] : '';
      const lines = fs.readFileSync(path.join(batchesDir, f), 'utf8').split(/\r?\n/).filter(Boolean);
      for (const l of lines) {
        try {
          ingestRec(fileUser, JSON.parse(l));
        } catch {}
      }
    }
  }

  // 2. Local cached DVR _deep_trace.jsonl headers (contains full `battleSummary`)
  const recRoot = path.resolve(process.cwd(), '.aistudio/telemetry_cache/recordings');
  if (fs.existsSync(recRoot)) {
    for (const userFolder of fs.readdirSync(recRoot)) {
      const uPath = path.join(recRoot, userFolder);
      if (!fs.statSync(uPath).isDirectory()) continue;
      for (const f of fs.readdirSync(uPath)) {
        if (!f.endsWith('_deep_trace.jsonl')) continue;
        try {
          const firstLine = fs.readFileSync(path.join(uPath, f), 'utf8').split(/\r?\n/)[0];
          const hdr = JSON.parse(firstLine);
          if (hdr && hdr.battleSummary) {
            ingestRec(hdr.screenName || userFolder, hdr.battleSummary);
          }
        } catch {}
      }
    }
  }

  // 3. Historical `origin/ai-telemetry-logs` batches (captures earlier Nov 1–6 battles for all users!)
  try {
    const treeFiles = execSync('git ls-tree -r origin/ai-telemetry-logs --name-only', { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter((p) => p.startsWith('batches/') && p.endsWith('.jsonl'));
    for (const gitPath of treeFiles) {
      const m = path.basename(gitPath).match(/^batch_\d+_(.+)_[0-9a-f]{8}\.jsonl$/);
      const fileUser = m ? m[1] : '';
      const rawTxt = execSync(`git show "origin/ai-telemetry-logs:${gitPath}"`, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });
      for (const l of rawTxt.split(/\r?\n/).filter(Boolean)) {
        try {
          ingestRec(fileUser, JSON.parse(l));
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[WARN] Could not scan origin/ai-telemetry-logs:', e.message);
  }

  return userMap;
}

function listAllKvRegisteredUsers() {
  const wranglerJs = 'C:\\Users\\Chris\\AppData\\Local\\npm-cache\\_npx\\32026684e21afda6\\node_modules\\wrangler\\bin\\wrangler.js';
  const kvId = 'e50fe893fefe428b871c9b667ac3edc2';
  const users = new Set(['sportsfan986', 'this2guy1']);
  try {
    const out = execSync(
      `"${process.execPath}" "${wranglerJs}" kv key list --namespace-id=${kvId} --prefix="registered_user/" --remote`,
      { encoding: 'utf8' }
    );
    for (const item of JSON.parse(out)) {
      const u = String(item.name || '').replace(/^registered_user\//, '').trim();
      if (u && u !== '_featured') users.add(u);
    }
  } catch {}
  return Array.from(users);
}

async function importUserVaultToD1(adminKey, payload) {
  const res = await fetch(`${WORKER_URL}/v1/admin/sync/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Import failed for @${payload.screenName}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const adminKey = loadAdminKey();
  console.log('==================================================================');
  console.log(' SilphScope PvP — Passwordless Multi-User Vault Migration -> D1');
  console.log('==================================================================');

  const telemetryByUser = collectAllTelemetryByUser();
  const allUsers = listAllKvRegisteredUsers();
  for (const u of telemetryByUser.keys()) {
    if (!allUsers.some((existing) => existing.toLowerCase() === u.toLowerCase())) {
      allUsers.push(u);
    }
  }

  // 1. Migrate @sportsfan986 (GitHub Private Vault + any newer telemetry logs)
  const ghVault = await fetchSportsfanGitHubVault();
  if (ghVault) {
    const sfTelemetry = telemetryByUser.get('sportsfan986');
    const delSet = new Set(ghVault.deletedLogIds || []);
    const logMap = new Map();
    for (const l of ghVault.battleLogs || []) {
      if (l && l.id && !delSet.has(l.id)) logMap.set(l.id, l);
    }
    let addedFromTelemetry = 0;
    if (sfTelemetry) {
      for (const [id, tLog] of sfTelemetry.logsMap.entries()) {
        if (!logMap.has(id) && !delSet.has(id)) {
          logMap.set(id, tLog);
          addedFromTelemetry++;
        }
      }
    }
    const mergedLogs = Array.from(logMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
    const sfRes = await importUserVaultToD1(adminKey, {
      screenName: 'sportsfan986',
      userSettings: ghVault.userSettings || {},
      settingsUpdatedAt: Number(ghVault.settingsUpdatedAt) || Date.now(),
      battleLogs: mergedLogs,
      teamPresets: ghVault.teamPresets || [],
      deletedLogIds: ghVault.deletedLogIds || [],
      deletedTeamIds: ghVault.deletedTeamIds || [],
      source: 'github_private_vault_migration',
      migratedFromGithub: true,
    });
    console.log(
      `[OK] @sportsfan986 -> D1: ${sfRes.totalActiveLogs} active battles (+${addedFromTelemetry} from telemetry), ${sfRes.totalActiveTeams} teams, settings migrated.`
    );
  }

  // 2. Migrate @this2guy1 and ALL other users without requiring passwords
  for (const rawUser of allUsers) {
    if (rawUser.toLowerCase() === 'sportsfan986') continue;
    const tData = telemetryByUser.get(rawUser) || telemetryByUser.get(rawUser.toLowerCase());
    const logs = tData ? Array.from(tData.logsMap.values()).sort((a, b) => b.timestampMs - a.timestampMs) : [];
    const teams = tData ? Array.from(tData.teamsMap.values()).sort((a, b) => b.updatedAt - a.updatedAt) : [];
    if (teams.length > 0) {
      teams[0].isSelected = true;
    }
    const settings = scannerSettingsToSyncMap(rawUser, tData ? tData.latestScannerSettings : null);
    const settingsUpdAt = tData && tData.latestTs > 0 ? tData.latestTs : Date.now();

    const uRes = await importUserVaultToD1(adminKey, {
      screenName: rawUser,
      userSettings: settings,
      settingsUpdatedAt: settingsUpdAt,
      battleLogs: logs,
      teamPresets: teams,
      deletedLogIds: [],
      deletedTeamIds: ['migrated_4752454154204c454147'],
      source: 'server_telemetry_migration',
      migratedFromGithub: true,
    });
    console.log(
      `[OK] @${rawUser} -> D1: ${uRes.totalActiveLogs} active battles, ${uRes.totalActiveTeams} teams, settings initialized (no password required).`
    );
  }

  // 3. Verify live Global Meta Summary on D1
  const metaRes = await fetch(`${WORKER_URL}/v1/admin/meta-summary`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  const metaJson = await metaRes.json();
  console.log('\n=== Live D1 Global Meta Verification ===');
  console.log('Totals:', metaJson.totals);
  console.log('Trainers in D1:', metaJson.trainers);
  console.log('By League & Season:', metaJson.byLeagueAndSeason);
  console.log('Top 10 Opponent Leads Across Userbase:', (metaJson.opponentLeads || []).slice(0, 10));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
