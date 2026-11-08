#!/usr/bin/env node
/**
 * SilphScope PvP — Admin CLI for DVR Replay Vault Unlock Keys (`scripts/manage-keys.mjs`)
 *
 * Usage:
 *   node scripts/manage-keys.mjs list
 *   node scripts/manage-keys.mjs create --tier vip --user sportsfan986 --note "Founder VIP Key"
 *   node scripts/manage-keys.mjs create --tier pro --user some_friend --days 90 --note "Beta tester"
 *   node scripts/manage-keys.mjs create --tier base --days 35
 *   node scripts/manage-keys.mjs extend --key SSPVP-PRO-XXXX-XXXX --days 30
 *   node scripts/manage-keys.mjs revoke --key SSPVP-PRO-XXXX-XXXX
 *   node scripts/manage-keys.mjs feature --shareId r_evn6nvp6f --featuredId f_gl_debuff --highlight 118 --badge "🌟 Official Showcase"
 */

import dns from 'node:dns';

const WORKER_URL = (
  process.env.SILPHSCOPE_TELEMETRY_URL || 'https://api.silphscopepvp.com'
).replace(/\/+$/, '');

// Resilient DNS fallback for *.workers.dev / silphscopepvp.com on routers/ISPs that sinkhole or drop AAAA/A lookups
const origLookup = dns.lookup.bind(dns);
dns.lookup = function (hostname, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const opts = typeof options === 'function' ? {} : options || {};
  origLookup(hostname, opts, (err, address, family) => {
    const isInvalid =
      err ||
      !address ||
      (typeof address === 'string' && (address === '::' || address === '0.0.0.0')) ||
      (Array.isArray(address) &&
        (address.length === 0 ||
          address.every((a) => a.address === '::' || a.address === '0.0.0.0')));
    if (
      isInvalid &&
      (String(hostname).endsWith('.workers.dev') || String(hostname).endsWith('silphscopepvp.com'))
    ) {
      if (opts && opts.all) {
        return cb(null, [
          { address: '104.21.76.162', family: 4 },
          { address: '172.67.197.119', family: 4 },
        ]);
      }
      return cb(null, '104.21.76.162', 4);
    }
    return cb(err, address, family);
  });
};

const ADMIN_KEY =
  process.env.SILPHSCOPE_ADMIN_KEY || 'sspvp_admin_a1b2c3d4e5f60718293a4b5c6d7e8f90';

function parseArgs(argv) {
  const args = { command: argv[2] || 'list' };
  for (let i = 3; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const k = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[k] = next;
        i++;
      } else {
        args[k] = true;
      }
    }
  }
  return args;
}

async function callAdminKeys(method, payload = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (payload) {
    opts.body = JSON.stringify(payload);
  }
  const res = await fetch(`${WORKER_URL}/v1/admin/keys`, opts);
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function main() {
  const args = parseArgs(process.argv);
  const cmd = String(args.command).toLowerCase();

  if (cmd === 'list') {
    const data = await callAdminKeys('GET');
    console.log(`\n=== SilphScope PvP Cloud Replay Vault & Unlock Keys ===`);
    console.log(
      `Global R2 Usage: ${data.globalR2.usedMb} MB / ${(data.globalR2.maxGb * 1024).toFixed(0)} MB (${data.globalR2.maxGb} GB Free-Tier Guard) • Total Stored Replays: ${data.globalR2.totalReplays}`
    );
    console.log(`Total Keys Issued: ${data.count}\n`);
    for (const k of data.keys || []) {
      const status = k.revoked ? 'REVOKED' : 'ACTIVE';
      console.log(
        `  [${status}] ${k.key} | Tier: ${(k.tier || '').toUpperCase()} (${k.label || ''}) | Bound Trainer: ${k.boundScreenName || '(unbound)'} | Expires: ${k.expiresAt || 'never'}${k.note ? ` | Note: ${k.note}` : ''}`
      );
    }
    console.log('');
    return;
  }

  if (cmd === 'create') {
    const tier = String(args.tier || 'pro').toLowerCase();
    const screenName = args.user || args.screenName || '';
    const days = args.days ? Number(args.days) : tier === 'vip' ? 3650 : 35;
    const note = args.note || '';
    const customKey = args.key || '';

    const data = await callAdminKeys('POST', {
      action: 'create',
      tier,
      screenName,
      days,
      note,
      customKey,
    });
    console.log(`\n✅ Minted ${data.license.label} (${data.license.tier.toUpperCase()}) Unlock Key:`);
    console.log(`   Key:           ${data.license.key}`);
    console.log(`   Bound Trainer: ${data.license.boundScreenName || '(binds on first verify)'}`);
    console.log(`   Expires At:    ${data.license.expiresAt}`);
    console.log(
      `   Cloud Quota:   ${data.limits.maxRollingBattles} rolling + ${data.limits.maxPinnedBattles} pinned (${data.limits.retentionDays}d retention, ${data.limits.maxStorageMb} MB cap)\n`
    );
    return;
  }

  if (cmd === 'revoke' || cmd === 'extend') {
    const key = args.key;
    if (!key) {
      throw new Error(`Missing --key <SSPVP-...> for '${cmd}' command.`);
    }
    const data = await callAdminKeys('POST', {
      action: cmd,
      key,
      days: args.days ? Number(args.days) : 30,
      tier: args.tier || undefined,
      screenName: args.user || args.screenName || undefined,
    });
    console.log(`\n✅ Updated Key (${cmd.toUpperCase()}):`, JSON.stringify(data.license, null, 2));
    return;
  }

  if (cmd === 'feature') {
    const shareId = args.shareId || args.id;
    if (!shareId) {
      throw new Error(`Missing --shareId <r_...> for 'feature' command.`);
    }
    const res = await fetch(`${WORKER_URL}/v1/admin/feature-replay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ADMIN_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        shareId,
        featuredId: args.featuredId || undefined,
        highlightSec: args.highlight ? Number(args.highlight) : 0,
        badgeLabel: args.badge || '🌟 Official Showcase',
        title: args.title || '',
        communityCredit: args.credit || '',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    console.log(`\n🌟 Promoted Replay to @Featured Official Showcase:`);
    console.log(`   Source Share ID:   ${data.sourceShareId}`);
    console.log(`   Featured Share ID: ${data.featuredId}`);
    console.log(`   Watch URL:         ${data.shareUrl}\n`);
    return;
  }

  console.error(`Unknown command '${cmd}'. Supported: list, create, extend, revoke, feature`);
  process.exit(1);
}

main().catch((err) => {
  console.error(`❌ Error: ${err.message}`);
  process.exit(1);
});
