#!/usr/bin/env node
/**
 * SilphScope PvP — Userbase-Wide Meta Analytics & Incremental Battle Logs Exporter (Cloudflare D1)
 *
 * Usage:
 *   npm run meta:summary
 *   node scripts/query-global-meta.mjs --league="GREAT LEAGUE" --days=30
 *   npm run meta:dump                # Incrementally pulls new D1 battle logs (?sinceMs=...) to .aistudio/global_meta_logs.jsonl
 *   node scripts/query-global-meta.mjs --dump --full   # Full refresh of local .aistudio/global_meta_logs.jsonl
 */
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';

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

function parseArg(prefix) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`${prefix}=`));
  return hit ? hit.slice(prefix.length + 1).replace(/^["']|["']$/g, '') : '';
}

async function main() {
  const adminKey = loadAdminKey();
  const headers = { Authorization: `Bearer ${adminKey}` };
  const args = new Set(process.argv.slice(2));
  const isDump = args.has('--dump');
  const isFull = args.has('--full');
  const league = parseArg('--league');
  const seasonId = parseArg('--season');
  const user = parseArg('--user');
  const days = parseArg('--days');

  // 1. Always fetch live userbase-wide meta summary
  const qs = new URLSearchParams();
  if (league) qs.set('league', league);
  if (seasonId) qs.set('seasonId', seasonId);
  if (days) qs.set('sinceDays', days);
  const sumRes = await fetch(`${WORKER_URL}/v1/admin/meta-summary?${qs.toString()}`, { headers });
  const summary = await sumRes.json();
  if (!sumRes.ok || !summary.ok) {
    throw new Error(`Meta summary failed: ${JSON.stringify(summary)}`);
  }

  const outDir = path.resolve(process.cwd(), '.aistudio');
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'global_meta_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('====================================================================');
  console.log(' SilphScope PvP — Userbase-Wide Meta Summary (Cloudflare D1)');
  console.log('====================================================================');
  console.log(
    `Trainers: ${summary.totals.uniqueTrainers} | Active Battles: ${summary.totals.totalBattles} | Avg Win Rate: ${summary.totals.avgUserWinRatePct}% | Avg BMF: ${summary.totals.avgBmfScore ?? 'n/a'} | Avg WAE: ${summary.totals.avgExecWae ?? 'n/a'}`
  );
  console.log('\nBy League & Season:');
  for (const row of summary.byLeagueAndSeason || []) {
    console.log(`  • ${row.league} (${row.seasonId}): ${row.battles} battles across ${row.trainers} trainer(s)`);
  }
  console.log('\nTop 15 Opponent Leads:');
  for (const r of (summary.opponentLeads || []).slice(0, 15)) {
    console.log(`  • ${r.species.padEnd(26)} ${String(r.count).padStart(4)} leads (${r.usagePct}%) • Opp Win%: ${r.oppWinRatePct}%`);
  }
  console.log('\nTop 15 Overall Opponent Species (All 3 Slots):');
  for (const r of (summary.opponentOverallUsage || []).slice(0, 15)) {
    console.log(`  • ${r.species.padEnd(26)} ${String(r.appearances).padStart(4)} teams (${r.teamPresencePct}%)`);
  }
  console.log('\nTop 10 Empirical Opponent Lead -> Backline Cores:');
  for (const c of (summary.empiricalLeadBacklineCores || []).slice(0, 10)) {
    console.log(`  • ${c.leadSpecies}  -->  ${c.backSpecies} (${c.count}x)`);
  }
  console.log(`\nSaved JSON summary -> ${summaryPath}`);

  if (!isDump) return;

  // 2. Incremental cursor-based dump of raw battle logs across all users (consumes 0 reads when caught up!)
  const statePath = path.join(outDir, 'global_meta_cursor.json');
  const dumpPath = path.join(outDir, 'global_meta_logs.jsonl');
  let cursorMs = 0;
  const existingMap = new Map();

  if (!isFull && fs.existsSync(statePath) && fs.existsSync(dumpPath)) {
    try {
      cursorMs = Number(JSON.parse(fs.readFileSync(statePath, 'utf8')).sinceMs) || 0;
      for (const line of fs.readFileSync(dumpPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
        const obj = JSON.parse(line);
        existingMap.set(`${obj.screenName}:${obj.logId}`, obj);
      }
    } catch {
      cursorMs = 0;
    }
  }

  let offset = 0;
  let maxNextSince = cursorMs;
  let fetchedNew = 0;
  while (true) {
    const lqs = new URLSearchParams({
      sinceMs: String(cursorMs),
      limit: '500',
      offset: String(offset),
      includePayload: '1',
    });
    if (user) lqs.set('user', user);
    if (league) lqs.set('league', league);
    const lRes = await fetch(`${WORKER_URL}/v1/admin/battle-logs?${lqs.toString()}`, { headers });
    const page = await lRes.json();
    if (!lRes.ok || !page.ok) {
      throw new Error(`Battle logs dump failed: ${JSON.stringify(page)}`);
    }
    for (const row of page.logs || []) {
      existingMap.set(`${row.screenName}:${row.logId}`, row);
      fetchedNew++;
    }
    if (Number(page.nextSinceMs) > maxNextSince) {
      maxNextSince = Number(page.nextSinceMs);
    }
    if (!page.hasMore || (page.logs || []).length === 0) break;
    offset += page.logs.length;
  }

  const sortedAll = Array.from(existingMap.values()).sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0));
  fs.writeFileSync(dumpPath, sortedAll.map((r) => JSON.stringify(r)).join('\n') + (sortedAll.length ? '\n' : ''));
  fs.writeFileSync(statePath, JSON.stringify({ sinceMs: maxNextSince, updatedAt: new Date().toISOString(), totalCached: sortedAll.length }, null, 2));
  console.log(`\n[DUMP OK] Pulled ${fetchedNew} new/updated battle log(s) -> ${dumpPath} (${sortedAll.length} total cached locally).`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
