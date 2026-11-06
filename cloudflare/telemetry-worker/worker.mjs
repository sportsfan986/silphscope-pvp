/**
 * SilphScope PvP — Multi-User Cloudflare Telemetry & 1-Battle DVR Worker
 *
 * Supports dual storage backends transparently:
 * - Cloudflare R2 (`env.TELEMETRY_BUCKET`) if bound
 * - Cloudflare Workers KV (`env.TELEMETRY_KV`, supports up to 25 MB per object) out of the box
 *
 * Responsibilities:
 * 1. Ingests Always-On Lower-Resolution Battle Telemetry (`POST /v1/telemetry`) -> Storage + optional Telegram alert
 * 2. Ingests User Settings Change Audits (`POST /v1/settings-changes`) -> Storage
 * 3. Ingests 1-Battle DVR Video + Deep Trace Bundles (`POST /v1/dvr`) -> Storage + async Telegram Channel video post
 * 4. Serves Admin Ingestion Endpoints (`GET/DELETE /v1/admin/*`) for `scripts/ingest-telemetry.mjs`
 */

import { OVERLAY_HTML, COMPACT_PVP_DB } from './overlay-asset.mjs';

const RESERVED_SCREEN_NAMES = new Set([
  'anonymous',
  'anon',
  'user',
  'player',
  'trainer',
  'test',
  'null',
  'undefined',
  'none',
  'unknown',
  'admin',
]);

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function sanitizeScreenName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (cleaned.length < 3 || cleaned.length > 24) return '';
  if (RESERVED_SCREEN_NAMES.has(cleaned.toLowerCase())) return '';
  return cleaned;
}

function sanitizeId(raw, fallback = 'id') {
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
  return cleaned || fallback;
}

/**
 * Unified storage adapter supporting Cloudflare R2 (`TELEMETRY_BUCKET`) or Workers KV (`TELEMETRY_KV`).
 */
function getStorageAdapter(env) {
  if (env.TELEMETRY_BUCKET) {
    const bucket = env.TELEMETRY_BUCKET;
    return {
      backend: 'r2',
      async put(key, value, { contentType = 'application/octet-stream', metadata = {} } = {}) {
        const size =
          typeof value === 'string'
            ? new TextEncoder().encode(value).byteLength
            : value.byteLength || 0;
        await bucket.put(key, value, {
          httpMetadata: { contentType },
          customMetadata: { ...metadata, contentType, size: String(size) },
        });
      },
      async getText(key) {
        const obj = await bucket.get(key);
        return obj ? await obj.text() : null;
      },
      async getResponse(key) {
        const obj = await bucket.get(key);
        if (!obj) return null;
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        return new Response(obj.body, { status: 200, headers });
      },
      async list({ prefix = '', cursor = undefined, limit = 500 } = {}) {
        const listed = await bucket.list({
          prefix,
          cursor,
          limit,
          include: ['customMetadata'],
        });
        return {
          objects: listed.objects.map((o) => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded,
            customMetadata: o.customMetadata || {},
          })),
          truncated: listed.truncated,
          cursor: listed.truncated ? listed.cursor : null,
        };
      },
      async delete(key) {
        await bucket.delete(key);
      },
    };
  }

  if (env.TELEMETRY_KV) {
    const kv = env.TELEMETRY_KV;
    // Cloudflare Workers KV has a hard 25 MiB (26,214,400 bytes) per-key limit.
    // Long 1-Battle DVR MP4 videos (e.g. 200s+ Mega Ultra League battles) can reach 26–35 MB.
    // We transparently split binary values > 24 MiB across `<key>` (chunk 0) and `<key>.__part1..N`.
    const KV_MAX_CHUNK_BYTES = 24 * 1024 * 1024; // 24 MiB (25,165,824 bytes)
    const MAX_PARTS_TO_CLEAN = 6;
    return {
      backend: 'kv',
      async put(key, value, { contentType = 'application/octet-stream', metadata = {} } = {}) {
        const uploadedAt = metadata.uploadedAt || new Date().toISOString();
        if (typeof value === 'string') {
          const size = new TextEncoder().encode(value).byteLength;
          await kv.put(key, value, {
            metadata: { ...metadata, contentType, size, chunkCount: 1, uploadedAt },
          });
          return;
        }
        const bytes =
          value instanceof Uint8Array
            ? value
            : value instanceof ArrayBuffer
            ? new Uint8Array(value)
            : new Uint8Array(value.buffer || value);
        const totalSize = bytes.byteLength || 0;
        if (totalSize <= KV_MAX_CHUNK_BYTES) {
          await kv.put(key, bytes, {
            metadata: { ...metadata, contentType, size: totalSize, chunkCount: 1, uploadedAt },
          });
          return;
        }
        const chunkCount = Math.ceil(totalSize / KV_MAX_CHUNK_BYTES);
        const puts = [];
        for (let i = 0; i < chunkCount; i++) {
          const start = i * KV_MAX_CHUNK_BYTES;
          const end = Math.min((i + 1) * KV_MAX_CHUNK_BYTES, totalSize);
          const slice = bytes.subarray(start, end);
          if (i === 0) {
            puts.push(
              kv.put(key, slice, {
                metadata: {
                  ...metadata,
                  contentType,
                  size: totalSize,
                  chunkCount,
                  uploadedAt,
                },
              })
            );
          } else {
            puts.push(
              kv.put(`${key}.__part${i}`, slice, {
                metadata: {
                  parentKey: key,
                  partIndex: i,
                  chunkCount,
                  size: slice.byteLength,
                  uploadedAt,
                },
              })
            );
          }
        }
        await Promise.all(puts);
      },
      async getText(key) {
        return await kv.get(key, { type: 'text' });
      },
      async getResponse(key) {
        const { value, metadata } = await kv.getWithMetadata(key, { type: 'arrayBuffer' });
        if (!value) return null;
        const chunkCount = Number((metadata && metadata.chunkCount) || 1);
        const headers = new Headers();
        headers.set(
          'Content-Type',
          (metadata && metadata.contentType) || 'application/octet-stream'
        );
        if (metadata && metadata.size) {
          headers.set('Content-Length', String(metadata.size));
        }
        if (chunkCount <= 1) {
          return new Response(value, { status: 200, headers });
        }
        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(new Uint8Array(value));
              for (let i = 1; i < chunkCount; i++) {
                const partBuf = await kv.get(`${key}.__part${i}`, { type: 'arrayBuffer' });
                if (partBuf) {
                  controller.enqueue(new Uint8Array(partBuf));
                }
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });
        return new Response(stream, { status: 200, headers });
      },
      async list({ prefix = '', cursor = undefined, limit = 500 } = {}) {
        const listed = await kv.list({ prefix, cursor, limit });
        return {
          objects: listed.keys
            .filter((k) => !k.name.includes('.__part'))
            .map((k) => ({
              key: k.name,
              size: Number((k.metadata && k.metadata.size) || 0),
              uploaded: (k.metadata && k.metadata.uploadedAt) || null,
              customMetadata: k.metadata || {},
            })),
          truncated: !listed.list_complete,
          cursor: !listed.list_complete ? listed.cursor : null,
        };
      },
      async delete(key) {
        const deletes = [kv.delete(key)];
        for (let i = 1; i < MAX_PARTS_TO_CLEAN; i++) {
          deletes.push(kv.delete(`${key}.__part${i}`));
        }
        await Promise.all(deletes);
      },
    };
  }

  throw new Error('Neither TELEMETRY_BUCKET (R2) nor TELEMETRY_KV (KV) is bound.');
}

function verifyClientAuth(request, env) {
  const expectedKey = (env.CLIENT_INGEST_KEY || '').trim();
  if (!expectedKey) {
    return { ok: false, status: 500, error: 'Worker CLIENT_INGEST_KEY secret is not configured.' };
  }
  const providedKey = (request.headers.get('X-SilphScope-Client-Key') || '').trim();
  if (!providedKey || providedKey !== expectedKey) {
    return { ok: false, status: 401, error: 'Invalid or missing X-SilphScope-Client-Key header.' };
  }
  const rawScreenName = request.headers.get('X-Trainer-Screen-Name') || '';
  const screenName = sanitizeScreenName(rawScreenName);
  if (!screenName) {
    return {
      ok: false,
      status: 400,
      error: 'Valid X-Trainer-Screen-Name header (3-24 alphanumeric/underscore chars) is required.',
    };
  }
  return { ok: true, screenName };
}

function verifyAdminAuth(request, env) {
  const expectedAdmin = (env.ADMIN_API_KEY || '').trim();
  if (!expectedAdmin) {
    return { ok: false, status: 500, error: 'Worker ADMIN_API_KEY secret is not configured.' };
  }
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== expectedAdmin) {
    return { ok: false, status: 401, error: 'Unauthorized: invalid ADMIN_API_KEY.' };
  }
  return { ok: true };
}

async function updateManifest(store, updater) {
  let manifest = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    totalBatches: 0,
    totalRecords: 0,
    totalDvrRecordings: 0,
    users: {},
    recentBatches: [],
    recentDvr: [],
  };
  try {
    const existingText = await store.getText('manifest.json');
    if (existingText) {
      const parsed = JSON.parse(existingText);
      if (parsed && typeof parsed === 'object') {
        manifest = { ...manifest, ...parsed };
      }
    }
  } catch (_) {
    // Start fresh manifest on parse error
  }
  updater(manifest);
  manifest.updatedAt = new Date().toISOString();
  await store.put('manifest.json', JSON.stringify(manifest, null, 2), {
    contentType: 'application/json',
  });
}

async function sendTelegramMessage(env, text) {
  const botToken = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (env.TELEGRAM_CHAT_ID || '').trim();
  if (!botToken || !chatId) return { skipped: true, reason: 'Telegram secrets not set' };

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  return { ok: resp.ok, status: resp.status };
}

async function sendTelegramVideo(env, videoBytes, filename, captionText) {
  const botToken = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (env.TELEGRAM_CHAT_ID || '').trim();
  if (!botToken || !chatId) return { skipped: true, reason: 'Telegram secrets not set' };

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('caption', captionText.slice(0, 1020));
  form.append('parse_mode', 'HTML');
  form.append('supports_streaming', 'true');
  form.append('video', new Blob([videoBytes], { type: 'video/mp4' }), filename);

  const url = `https://api.telegram.org/bot${botToken}/sendVideo`;
  const resp = await fetch(url, {
    method: 'POST',
    body: form,
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error(`Telegram sendVideo failed (${resp.status}): ${errText}`);
  }
  return { ok: resp.ok, status: resp.status };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================================
// SUBSCRIPTION TIERS, UNLOCK KEYS & R2 REPLAY VAULT HELPERS (v2.0.0)
// ============================================================================

const TIER_PRESETS = {
  free: {
    tier: 'free',
    label: 'Free Tier (1 Local Video)',
    maxLocalBattles: 1,
    maxRollingBattles: 0,
    maxPinnedBattles: 0,
    retentionDays: 0,
    maxStorageMb: 0,
  },
  base: {
    tier: 'base',
    label: 'Trainer Tier (10 Battles / 7d / 500 MB + 5 Pinned)',
    maxLocalBattles: 10,
    maxRollingBattles: 10,
    maxPinnedBattles: 5,
    retentionDays: 7,
    maxStorageMb: 500,
  },
  pro: {
    tier: 'pro',
    label: 'Legend Tier (50 Battles / 30d / 2 GB + 10 Pinned)',
    maxLocalBattles: 10,
    maxRollingBattles: 50,
    maxPinnedBattles: 10,
    retentionDays: 30,
    maxStorageMb: 2000,
  },
  vip: {
    tier: 'vip',
    label: 'VIP / Admin Tier (150 Battles / 365d / 4 GB + 25 Pinned)',
    maxLocalBattles: 20,
    maxRollingBattles: 150,
    maxPinnedBattles: 25,
    retentionDays: 365,
    maxStorageMb: 4000,
  },
};

function generateUnlockKey(tier = 'base', prefix = 'SSPVP') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${prefix}-${String(tier).toUpperCase().slice(0, 4)}-${seg(4)}-${seg(4)}`;
}

function generateShareId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const seg = Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `r_${seg}`;
}

async function getGlobalR2Stats(kv) {
  if (!kv) return { totalBytes: 0, totalReplays: 0, updatedAt: new Date().toISOString() };
  try {
    const raw = await kv.get('replays_global_stats.json', { type: 'text' });
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          totalBytes: Math.max(0, Number(parsed.totalBytes) || 0),
          totalReplays: Math.max(0, Number(parsed.totalReplays) || 0),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch (_) {}
  return { totalBytes: 0, totalReplays: 0, updatedAt: new Date().toISOString() };
}

async function adjustGlobalR2Stats(kv, deltaBytes, deltaReplays) {
  if (!kv) return;
  const stats = await getGlobalR2Stats(kv);
  stats.totalBytes = Math.max(0, stats.totalBytes + (Number(deltaBytes) || 0));
  stats.totalReplays = Math.max(0, stats.totalReplays + (Number(deltaReplays) || 0));
  stats.updatedAt = new Date().toISOString();
  await kv.put('replays_global_stats.json', JSON.stringify(stats, null, 2));
  return stats;
}

async function loadLicenseByKey(kv, rawKey) {
  if (!kv || !rawKey) return null;
  const cleanKey = String(rawKey).trim().toUpperCase();
  if (!cleanKey) return null;
  try {
    const raw = await kv.get(`licenses/${cleanKey}`, { type: 'text' });
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

async function saveLicenseRecord(kv, lic) {
  if (!kv || !lic || !lic.key) return;
  const cleanKey = String(lic.key).trim().toUpperCase();
  lic.key = cleanKey;
  await kv.put(`licenses/${cleanKey}`, JSON.stringify(lic, null, 2));
  if (lic.boundScreenName) {
    await kv.put(`user_license/${lic.boundScreenName}`, cleanKey);
  }
}

async function resolveUserLicense(kv, screenName, providedKey = '') {
  if (!kv) return { ...TIER_PRESETS.free, active: false, key: '' };
  let lic = null;
  const cleanProvided = String(providedKey || '').trim().toUpperCase();
  if (cleanProvided) {
    lic = await loadLicenseByKey(kv, cleanProvided);
    if (!lic) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        error: 'Invalid Unlock Key. Check the key and try again.',
      };
    }
    if (lic.revoked) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        error: 'This Unlock Key has been revoked.',
      };
    }
    if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: lic.key,
        expired: true,
        expiresAt: lic.expiresAt,
        error: `This Unlock Key expired on ${lic.expiresAt.slice(0, 10)}.`,
      };
    }
    if (
      lic.boundScreenName &&
      screenName &&
      lic.boundScreenName.toLowerCase() !== screenName.toLowerCase()
    ) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        error: `This Unlock Key is already bound to another Debug ID (@${lic.boundScreenName}).`,
      };
    }
    if (screenName && !lic.boundScreenName) {
      lic.boundScreenName = screenName;
      lic.activatedAt = new Date().toISOString();
      await saveLicenseRecord(kv, lic);
    } else if (screenName) {
      await kv.put(`user_license/${screenName}`, lic.key);
    }
  } else if (screenName) {
    const mappedKey = await kv.get(`user_license/${screenName}`, { type: 'text' });
    if (mappedKey) {
      lic = await loadLicenseByKey(kv, mappedKey);
    }
  }

  if (!lic || lic.revoked) {
    return { ...TIER_PRESETS.free, active: false, key: '' };
  }
  if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
    return {
      ...TIER_PRESETS.free,
      active: false,
      key: lic.key,
      expired: true,
      expiresAt: lic.expiresAt,
    };
  }

  const preset = TIER_PRESETS[lic.tier] || TIER_PRESETS.base;
  return {
    tier: lic.tier || preset.tier,
    label: lic.label || preset.label,
    key: lic.key,
    active: true,
    boundScreenName: lic.boundScreenName || screenName || '',
    maxLocalBattles: Number(lic.maxLocalBattles ?? preset.maxLocalBattles),
    maxRollingBattles: Number(lic.maxRollingBattles ?? preset.maxRollingBattles),
    maxPinnedBattles: Number(lic.maxPinnedBattles ?? preset.maxPinnedBattles),
    retentionDays: Number(lic.retentionDays ?? preset.retentionDays),
    maxStorageMb: Number(lic.maxStorageMb ?? preset.maxStorageMb),
    expiresAt: lic.expiresAt || null,
  };
}

async function loadUserReplayIndex(kv, screenName) {
  if (!kv || !screenName) return { screenName, items: [] };
  try {
    const raw = await kv.get(`replay_index/${screenName}`, { type: 'text' });
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  } catch (_) {}
  return { screenName, items: [] };
}

async function saveUserReplayIndex(kv, screenName, indexObj) {
  if (!kv || !screenName) return;
  indexObj.updatedAt = new Date().toISOString();
  await kv.put(`replay_index/${screenName}`, JSON.stringify(indexObj, null, 2));
}

async function deleteReplayObjects(env, kv, item) {
  if (!item) return 0;
  let freedBytes = (Number(item.videoBytes) || 0) + (Number(item.traceBytes) || 0);
  if (env.REPLAY_BUCKET) {
    try {
      if (item.videoKey) await env.REPLAY_BUCKET.delete(item.videoKey);
    } catch (_) {}
    try {
      if (item.traceKey) await env.REPLAY_BUCKET.delete(item.traceKey);
    } catch (_) {}
  }
  if (kv && item.shareId) {
    try {
      await kv.delete(`share_map/${item.shareId}`);
      await kv.delete(`share_lookup/${item.shareId}`);
    } catch (_) {}
  }
  if (kv && freedBytes > 0) {
    await adjustGlobalR2Stats(kv, -freedBytes, -1);
  }
  return freedBytes;
}

async function enforceUserReplayQuota(env, kv, screenName, license, indexObj, incomingBytes = 0) {
  const nowMs = Date.now();
  const maxRetentionMs = (Number(license.retentionDays) || 7) * 24 * 60 * 60 * 1000;
  const maxStorageBytes = (Number(license.maxStorageMb) || 500) * 1024 * 1024;
  const maxRolling = Number(license.maxRollingBattles) || 10;

  const kept = [];
  // 1. Prune expired unpinned items
  for (const item of indexObj.items) {
    const uploadedMs = item.uploadedAt ? new Date(item.uploadedAt).getTime() : nowMs;
    const isExpired = !item.isPinned && nowMs - uploadedMs > maxRetentionMs;
    if (isExpired) {
      await deleteReplayObjects(env, kv, item);
    } else {
      kept.push(item);
    }
  }

  // Sort newest first
  kept.sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());

  // 2. Enforce rolling count limit (unpinned items beyond maxRolling)
  let rollingSeen = 0;
  const afterCount = [];
  for (const item of kept) {
    if (item.isPinned) {
      afterCount.push(item);
    } else {
      rollingSeen++;
      if (rollingSeen > maxRolling) {
        await deleteReplayObjects(env, kv, item);
      } else {
        afterCount.push(item);
      }
    }
  }

  // 3. Enforce maxStorageBytes (evict oldest unpinned first if over storage cap)
  let currentBytes = afterCount.reduce(
    (sum, it) => sum + (Number(it.videoBytes) || 0) + (Number(it.traceBytes) || 0),
    0
  );
  while (currentBytes + incomingBytes > maxStorageBytes) {
    // Find oldest unpinned
    let oldestUnpinnedIdx = -1;
    for (let i = afterCount.length - 1; i >= 0; i--) {
      if (!afterCount[i].isPinned) {
        oldestUnpinnedIdx = i;
        break;
      }
    }
    if (oldestUnpinnedIdx === -1) break; // Only pinned items remain
    const [evicted] = afterCount.splice(oldestUnpinnedIdx, 1);
    const freed = await deleteReplayObjects(env, kv, evicted);
    currentBytes = Math.max(0, currentBytes - freed);
  }

  indexObj.items = afterCount;
  return {
    usedBytes: currentBytes,
    usedMb: Number((currentBytes / (1024 * 1024)).toFixed(2)),
    rollingCount: afterCount.filter((i) => !i.isPinned).length,
    pinnedCount: afterCount.filter((i) => i.isPinned).length,
  };
}

/**
 * Builds a full 3v3 team matchup string (`User1, User2, User3 vs Opp1, Opp2, Opp3 • N anomalies`)
 * by inspecting the BATTLE_DVR_SUMMARY_HEADER line (and frame trace fallback) in `deepTraceText`
 * so the full user team is always printed, not just the lead Pokémon.
 */
function resolveFullTeamMatchupSummary(metadata, deepTraceText) {
  let rawSummary = String((metadata && metadata.matchupSummary) || '').trim();
  if (!deepTraceText || typeof deepTraceText !== 'string') {
    return rawSummary;
  }
  try {
    const firstNewline = deepTraceText.indexOf('\n');
    const firstLine = (firstNewline >= 0 ? deepTraceText.slice(0, firstNewline) : deepTraceText).trim();
    if (firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) {
      const headerObj = JSON.parse(firstLine);
      const summary = headerObj && headerObj.battleSummary;
      if (summary && typeof summary === 'object') {
        const userList = Array.isArray(summary.userTeamSpecs)
          ? summary.userTeamSpecs.map((s) => (s && s.species ? String(s.species).trim() : '')).filter(Boolean)
          : [];
        const oppList = Array.isArray(summary.oppTeamSpecs)
          ? summary.oppTeamSpecs.map((s) => (s && s.species ? String(s.species).trim() : '')).filter(Boolean)
          : [];
        const anomalyCount = Number(summary.anomalyCount) || 0;
        if (userList.length > 0 || oppList.length > 0) {
          const userPart = userList.length > 0 ? userList.join(', ') : 'Player';
          const oppPart = oppList.length > 0 ? oppList.join(', ') : 'Opponent';
          const anomSuffix =
            anomalyCount > 0
              ? ` • ${anomalyCount} ${anomalyCount === 1 ? 'anomaly' : 'anomalies'}`
              : '';
          return `${userPart} vs ${oppPart}${anomSuffix}`;
        }
      }
    }
  } catch (_) {
    // Fallback to rawSummary on parse error
  }
  return rawSummary;
}

function renderWatchSharePage(origin, shareInfo) {
  const shareId = escapeHtml(shareInfo.shareId || '');
  const hideNamesDefault = Boolean(shareInfo.hideNames);
  const trainerDisplay = hideNamesDefault ? 'Trainer' : escapeHtml(shareInfo.screenName || 'Trainer');
  const league = escapeHtml(shareInfo.league || 'GBL');
  const result = escapeHtml(shareInfo.result || 'BATTLE');
  const matchup = escapeHtml(shareInfo.matchupSummary || 'Pokémon GO PvP Replay');
  const videoUrl = `${origin}/v1/replays/stream/${encodeURIComponent(shareInfo.shareId)}/video.mp4`;
  const traceUrl = `${origin}/v1/replays/stream/${encodeURIComponent(shareInfo.shareId)}/trace.jsonl`;
  const pageTitle = `SilphScope PvP Replay • ${matchup}`;
  const pageDesc = `${trainerDisplay} • ${league} (${result}) — Watch with interactive Live HUD, 3x3 Matrix, Move Pacing & Frame-Step Controls.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>${pageTitle}</title>
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${pageDesc}" />
  <meta property="og:video" content="${videoUrl}" />
  <meta property="og:video:secure_url" content="${videoUrl}" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="544" />
  <meta property="og:video:height" content="1184" />
  <meta name="twitter:card" content="player" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${pageDesc}" />
  <style>
    :root {
      --bg: #070b14;
      --card: #0f172a;
      --border: #1e293b;
      --accent: #10b981;
      --cyan: #06b6d4;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 10px 16px;
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: 0.3px;
    }
    .badge {
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.16);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    button, .btn-link {
      background: #1e293b;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
    }
    button:hover, .btn-link:hover {
      background: #334155;
      border-color: #475569;
    }
    button.active {
      background: rgba(16, 185, 129, 0.22);
      border-color: var(--accent);
      color: #34d399;
    }
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
      gap: 12px;
      max-width: 1200px;
      width: 100%;
      margin: 0 auto;
    }
    .stage-wrap {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      justify-content: center;
      gap: 16px;
      width: 100%;
      flex-wrap: wrap;
    }
    .video-box {
      position: relative;
      width: min(100%, 420px);
      aspect-ratio: 544 / 1184;
      background: #000;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .hud-layer {
      position: absolute;
      left: 3px;
      right: 3px;
      bottom: 14px;
      background: transparent;
      border: none;
      padding: 0;
      pointer-events: auto;
      transition: top 0.2s, bottom 0.2s, opacity 0.15s;
      z-index: 10;
    }
    .hud-layer.pos-top {
      top: 18px;
      bottom: auto;
    }
    .hud-layer iframe {
      width: 100%;
      height: 360px;
      border: none;
      background: transparent;
      display: block;
      overflow: hidden;
    }
    .stage-wrap.side-by-side .hud-layer {
      position: static;
      width: min(100%, 420px);
      background: transparent;
      border: none;
      padding: 0;
      align-self: flex-start;
    }
    .controls-bar {
      width: 100%;
      max-width: 860px;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .control-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-height: 88px;
      overflow-y: auto;
    }
    .event-chip {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 999px;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid #334155;
      cursor: pointer;
    }
    .event-chip:hover {
      border-color: var(--cyan);
      color: #38bdf8;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🛡️ SilphScope PvP Replay</span>
      <span class="badge" id="hdr-trainer">${trainerDisplay}</span>
      <span class="badge" style="background:rgba(6,182,212,0.15);color:#38bdf8;border-color:rgba(6,182,212,0.35)">${league} • ${result}</span>
    </div>
    <div class="header-actions">
      <a class="btn-link" href="/vault">☁️ My Replay Vault</a>
      <button id="btn-privacy" onclick="togglePrivacy()">🕵️ ${hideNamesDefault ? 'Names Hidden' : 'Hide Names'}</button>
      <button id="btn-layout" onclick="toggleLayout()">📐 Side-by-Side: OFF</button>
      <button id="btn-export" onclick="exportWithHud()">💾 Export Video + HUD</button>
      <a class="btn-link" href="https://sportsfan986.github.io/silphscope-pvp/" target="_blank" rel="noopener">🚀 Open Full Simulator</a>
    </div>
  </header>

  <main>
    <div style="font-size:13px;font-weight:700;color:#cbd5e1;text-align:center">${matchup}</div>
    <div class="stage-wrap" id="stage-wrap">
      <div class="video-box" id="video-box">
        <video id="replay-video" src="${videoUrl}" playsinline preload="metadata" crossorigin="anonymous"></video>
        <div class="hud-layer pos-top" id="hud-layer">
          <iframe id="hud-iframe" src="/overlay.html?replay=1" scrolling="no" title="SilphScope PvP HUD"></iframe>
        </div>
      </div>
    </div>

    <div class="controls-bar">
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <input type="range" id="video-scrubber" min="0" max="1000" value="0" style="flex:1;accent-color:#10b981;cursor:pointer" oninput="scrubVideo(this.value)" />
        <span id="time-readout" style="font-size:11px;font-family:monospace;color:#94a3b8;min-width:82px;text-align:right">0.0s / 0.0s</span>
      </div>
      <div class="control-row">
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button onclick="stepFrame(-1)">⏮ -1F</button>
          <button onclick="togglePlay()" id="btn-play">▶️ Play</button>
          <button onclick="stepFrame(1)">⏭ +1F</button>
          <button onclick="setSpeed(0.25)" id="spd-025">0.25x</button>
          <button onclick="setSpeed(0.5)" id="spd-05">0.5x</button>
          <button onclick="setSpeed(1)" id="spd-1" class="active">1x</button>
          <button onclick="setSpeed(2)" id="spd-2">2x</button>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">
          <button onclick="setHudMode('live')" id="mode-live" class="active">👁️ HUD: LIVE</button>
          <button onclick="setHudMode('compact')" id="mode-compact">COMPACT</button>
          <button onclick="setHudMode('diag')" id="mode-diag">DIAG</button>
          <button onclick="setHudMode('off')" id="mode-off">OFF</button>
          <button onclick="toggleShieldHud()" id="btn-shield-hud" class="active">🛡️ Shield: ON</button>
          <button onclick="toggleHudPos()" id="btn-pos">⬆️ Pos: Top</button>
          <input type="range" id="hud-opacity" min="30" max="100" value="95" style="width:65px" title="HUD Opacity" oninput="updateOpacity(this.value)" />
        </div>
      </div>
      <div class="chips-row" id="event-chips"></div>
    </div>
  </main>

  <script>
    const TRACE_URL = ${JSON.stringify(traceUrl)};
    const PVP_DB = ${JSON.stringify(COMPACT_PVP_DB)};
    const SHARE_LEAGUE = ${JSON.stringify(shareInfo.league || 'GREAT LEAGUE')};
    const SHARE_MATCHUP = ${JSON.stringify(shareInfo.matchup || '')};
    let hideNames = ${JSON.stringify(hideNamesDefault)};
    const rawTrainerName = ${JSON.stringify(shareInfo.screenName || 'Trainer')};
    let frames = [];
    let summaryHeader = null;
    let hudMode = 'live';
    let hudTop = true;
    let showShieldHud = true;
    let sideBySide = false;

    // Interactive HUD manual overrides (matching Android ReplayJavascriptBridge)
    let manualUserSlotOverride = null;
    let manualOppSlotOverride = null;
    let manualOppShadowOverride = null;
    let manualUserShieldsOverride = null;
    let manualOppShieldsOverride = null;

    const video = document.getElementById('replay-video');
    const hudLayer = document.getElementById('hud-layer');
    const hudIframe = document.getElementById('hud-iframe');
    const stageWrap = document.getElementById('stage-wrap');

    function attachOverlayBridge() {
      try {
        const win = hudIframe.contentWindow;
        if (!win) return;
        win.AndroidOverlay = {
          updateContentHeight(h) {
            const px = Math.max(48, Math.ceil(Number(h) || 340));
            hudIframe.style.height = px + 'px';
          },
          selectActiveUserPokemon(name) {
            const uSpecs = getResolvedUserSpecs();
            const idx = uSpecs.findIndex(s => s.name.toLowerCase() === String(name || '').toLowerCase());
            if (idx >= 0) {
              manualUserSlotOverride = idx;
              syncHudFrame();
            }
          },
          swapActiveOpponent(name) {
            const oSpecs = getResolvedOppSpecs();
            const idx = oSpecs.findIndex(s => s.name.toLowerCase() === String(name || '').toLowerCase());
            if (idx >= 0) {
              manualOppSlotOverride = idx;
              syncHudFrame();
            }
          },
          toggleOpponentShadow() {
            manualOppShadowOverride = manualOppShadowOverride === null ? true : !manualOppShadowOverride;
            syncHudFrame();
          },
          setPlayerShields(n) {
            manualUserShieldsOverride = Number(n);
            syncHudFrame();
          },
          setOpponentShields(n) {
            manualOppShieldsOverride = Number(n);
            syncHudFrame();
          },
          onOverlayReady() {
            syncHudFrame();
          }
        };
      } catch (err) {
        console.warn('Bridge attach warning:', err);
      }
    }

    hudIframe.addEventListener('load', () => {
      attachOverlayBridge();
      syncHudFrame();
    });

    video.addEventListener('play', () => {
      manualUserSlotOverride = null;
      manualOppSlotOverride = null;
      manualUserShieldsOverride = null;
      manualOppShieldsOverride = null;
      document.getElementById('btn-play').textContent = '⏸ Pause';
    });
    video.addEventListener('pause', () => { document.getElementById('btn-play').textContent = '▶️ Play'; });

    function togglePlay() {
      if (video.paused) video.play(); else video.pause();
    }
    function stepFrame(delta) {
      video.pause();
      video.currentTime = Math.max(0, Math.min(video.duration || 999, video.currentTime + delta * 0.1));
      syncHudFrame();
    }
    function setSpeed(s) {
      video.playbackRate = s;
      ['025','05','1','2'].forEach(k => document.getElementById('spd-' + k).classList.remove('active'));
      const id = s === 0.25 ? '025' : s === 0.5 ? '05' : String(s);
      const el = document.getElementById('spd-' + id);
      if (el) el.classList.add('active');
    }
    function setHudMode(m) {
      hudMode = m;
      ['live','compact','diag','off'].forEach(k => document.getElementById('mode-' + k).classList.toggle('active', k === m));
      hudLayer.style.display = m === 'off' ? 'none' : 'block';
      syncHudFrame();
    }
    function toggleShieldHud() {
      showShieldHud = !showShieldHud;
      const btn = document.getElementById('btn-shield-hud');
      if (btn) {
        btn.classList.toggle('active', showShieldHud);
        btn.textContent = showShieldHud ? '🛡️ Shield: ON' : '🛡️ Shield: OFF';
      }
      try {
        if (hudIframe.contentWindow && hudIframe.contentWindow.setReplayShieldOverlayEnabled) {
          hudIframe.contentWindow.setReplayShieldOverlayEnabled(showShieldHud);
        }
      } catch (_) {}
      syncHudFrame();
    }
    function toggleHudPos() {
      hudTop = !hudTop;
      hudLayer.classList.toggle('pos-top', hudTop);
      document.getElementById('btn-pos').textContent = hudTop ? '⬆️ Pos: Top' : '⬇️ Pos: Bottom';
    }
    function updateOpacity(val) {
      hudLayer.style.opacity = (Number(val) / 100).toFixed(2);
    }
    function togglePrivacy() {
      hideNames = !hideNames;
      document.getElementById('hdr-trainer').textContent = hideNames ? 'Trainer' : rawTrainerName;
      document.getElementById('btn-privacy').textContent = hideNames ? '🕵️ Names Hidden' : '🕵️ Hide Names';
      syncHudFrame();
    }
    function toggleLayout() {
      sideBySide = !sideBySide;
      stageWrap.classList.toggle('side-by-side', sideBySide);
      if (sideBySide) {
        stageWrap.appendChild(hudLayer);
      } else {
        document.getElementById('video-box').appendChild(hudLayer);
      }
      document.getElementById('btn-layout').textContent = sideBySide ? '📐 Side-by-Side: ON' : '📐 Side-by-Side: OFF';
      setTimeout(syncHudFrame, 60);
    }

    function abbrPoke3(name, isShadow) {
      if (!name || name === 'Waiting...') return 'OPP';
      const clean = String(name)
        .replace(/^Shadow\\s+/i, '')
        .replace(/^Mega\\s+/i, '')
        .replace(/^(Kanto|Alolan|Galarian|Hisuian|Paldean)\\s+/i, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .trim()
        .substring(0, 3)
        .toUpperCase() || 'POK';
      const pref = (isShadow || /^Shadow\\s+/i.test(name)) ? 'S' : '';
      return (pref + clean).substring(0, 4);
    }

    function abbrMove5(move) {
      if (!move || move === '—') return '—';
      const s = String(move).replace(/\\*/g, '').trim();
      const words = s.split(/[\\s-]+/).filter(Boolean);
      if (words.length >= 2 && s.length > 5) {
        return words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
      }
      return s.substring(0, 5);
    }

    function lookupSpeciesMeta(rawName, leagueStr) {
      const s = String(rawName || '').trim();
      const isShad = /^Shadow\\s+/i.test(s) || /\\(Shadow\\)/i.test(s);
      const clean = s.replace(/^Shadow\\s+/i, '').replace(/\\s*\\(Shadow\\)/i, '').trim();
      const lower = clean.toLowerCase();
      const base = lower.replace(/\\s*\\([^)]*\\)/g, '').trim().replace(/\\s+/g, '_');
      const dbEntry =
        PVP_DB.species[lower] ||
        PVP_DB.species[lower.replace(/\\s+/g, '_')] ||
        PVP_DB.species[base] ||
        {
          name: clean || 'Pokemon',
          speciesId: base || 'pokemon',
          baseSpecies: base || 'pokemon',
          formLabel: 'Base',
          types: ['normal'],
          defaultCp: 1500,
          fastMove: 'Tackle',
          fastTurns: 1,
          c1: 'Body Slam',
          c2: 'Surf',
          c3: 'Earthquake',
          atk: 175,
          def: 175,
          hp: 180
        };
      const uLg = String(leagueStr || SHARE_LEAGUE || 'GREAT LEAGUE').toUpperCase();
      const cpCap = (uLg.includes('MASTER') || uLg.includes('10000')) ? 4500 : (uLg.includes('ULTRA') || uLg.includes('2500') || uLg.includes('CAULDRON')) ? 2500 : 1500;
      const uAtk = (dbEntry.atk || 175) + 7;
      const uDef = (dbEntry.def || 175) + 14;
      const uHp = (dbEntry.hp || 180) + 14;
      const cpm = Math.min(0.8403, Math.max(0.45, Math.sqrt((cpCap * 10.0) / (uAtk * Math.sqrt(uDef * uHp)))));
      const effCp = Math.min(cpCap, Math.max(100, Math.floor(uAtk * Math.sqrt(uDef * uHp) * cpm * cpm / 10.0)));
      return {
        ...dbEntry,
        name: clean || dbEntry.name,
        isShadow: isShad,
        effCp,
        effAtk: uAtk * cpm,
        effDef: uDef * cpm,
        effHp: Math.max(20, Math.floor(uHp * cpm))
      };
    }

    function lookupFastStats(moveName, fallbackTurns) {
      const k = String(moveName || '').replace(/\\*/g, '').trim().toLowerCase();
      const spaceK = k.replace(/-/g, ' ');
      const found = PVP_DB.fastMoves[k] || PVP_DB.fastMoves[spaceK];
      const turns = (found && found.turns) || fallbackTurns || 2;
      return {
        name: String(moveName || 'Fast'),
        turns,
        energy: (found && found.energy) || Math.max(3, turns * 4),
        power: (found && found.power !== undefined) ? found.power : Math.max(3, turns * 3),
        type: (found && found.type) || 'normal'
      };
    }

    function lookupChargedStats(moveName, fallbackType, fallbackEnergy) {
      const k = String(moveName || '').replace(/\\*/g, '').trim().toLowerCase();
      const spaceK = k.replace(/-/g, ' ');
      const found = PVP_DB.chargedMoves[k] || PVP_DB.chargedMoves[spaceK];
      return {
        name: String(moveName || 'Charged').replace(/\\*/g, '').trim(),
        type: (found && found.type) || fallbackType || 'normal',
        power: (found && found.power) || 80,
        energy: (found && found.energy) || fallbackEnergy || 50
      };
    }

    function getTypeEff(moveType, defTypes) {
      const atk = String(moveType || 'normal').toLowerCase().trim();
      const chart = {
        normal: { rock: 0.625, steel: 0.625, ghost: 0.390625 },
        fire: { grass: 1.6, ice: 1.6, bug: 1.6, steel: 1.6, fire: 0.625, water: 0.625, rock: 0.625, dragon: 0.625 },
        water: { fire: 1.6, ground: 1.6, rock: 1.6, water: 0.625, grass: 0.625, dragon: 0.625 },
        electric: { water: 1.6, flying: 1.6, electric: 0.625, grass: 0.625, dragon: 0.625, ground: 0.390625 },
        grass: { water: 1.6, ground: 1.6, rock: 1.6, fire: 0.625, grass: 0.625, poison: 0.625, flying: 0.625, bug: 0.625, dragon: 0.625, steel: 0.625 },
        ice: { grass: 1.6, ground: 1.6, flying: 1.6, dragon: 1.6, fire: 0.625, water: 0.625, ice: 0.625, steel: 0.625 },
        fighting: { normal: 1.6, ice: 1.6, rock: 1.6, dark: 1.6, steel: 1.6, poison: 0.625, flying: 0.625, psychic: 0.625, bug: 0.625, fairy: 0.625, ghost: 0.390625 },
        poison: { grass: 1.6, fairy: 1.6, poison: 0.625, ground: 0.625, rock: 0.625, ghost: 0.625, steel: 0.390625 },
        ground: { fire: 1.6, electric: 1.6, poison: 1.6, rock: 1.6, steel: 1.6, grass: 0.625, bug: 0.625, flying: 0.390625 },
        flying: { grass: 1.6, fighting: 1.6, bug: 1.6, electric: 0.625, rock: 0.625, steel: 0.625 },
        psychic: { fighting: 1.6, poison: 1.6, psychic: 0.625, steel: 0.625, dark: 0.390625 },
        bug: { grass: 1.6, psychic: 1.6, dark: 1.6, fire: 0.625, fighting: 0.625, poison: 0.625, flying: 0.625, ghost: 0.625, steel: 0.625, fairy: 0.625 },
        rock: { fire: 1.6, ice: 1.6, flying: 1.6, bug: 1.6, fighting: 0.625, ground: 0.625, steel: 0.625 },
        ghost: { psychic: 1.6, ghost: 1.6, dark: 0.625, normal: 0.390625 },
        dragon: { dragon: 1.6, steel: 0.625, fairy: 0.390625 },
        dark: { psychic: 1.6, ghost: 1.6, fighting: 0.625, dark: 0.625, fairy: 0.625 },
        steel: { ice: 1.6, rock: 1.6, fairy: 1.6, fire: 0.625, water: 0.625, electric: 0.625, steel: 0.625 },
        fairy: { fighting: 1.6, dragon: 1.6, dark: 1.6, fire: 0.625, poison: 0.625, steel: 0.625 }
      };
      let mult = 1.0;
      const row = chart[atk] || {};
      for (const dt of (defTypes || ['normal'])) {
        const d = String(dt || 'normal').toLowerCase().trim();
        if (row[d] !== undefined) mult *= row[d];
      }
      return mult;
    }

    function stageMult(stg) {
      const s = Math.max(-4, Math.min(4, Number(stg) || 0));
      return s >= 0 ? (4 + s) / 4 : 4 / (4 - s);
    }

    function calcChargedDmgPct(atkMeta, defMeta, moveName, isAtkShadow, isDefShadow, atkStg, defStg) {
      const mStats = lookupChargedStats(moveName, atkMeta.types[0]);
      const stab = atkMeta.types.includes(mStats.type) ? 1.2 : 1.0;
      const eff = getTypeEff(mStats.type, defMeta.types);
      const eAtk = atkMeta.effAtk * (isAtkShadow ? 1.2 : 1.0) * stageMult(atkStg || 0);
      const eDef = defMeta.effDef * (isDefShadow ? 0.8333333 : 1.0) * stageMult(defStg || 0);
      const raw = Math.floor(0.5 * mStats.power * (eAtk / Math.max(10, eDef)) * stab * eff * 1.3) + 1;
      const pct = Math.round((raw / Math.max(20, defMeta.effHp)) * 100);
      return { pct: Math.max(5, Math.min(100, pct)), eff, mStats };
    }

    function calc3DotMatrixString(uSpec, oSpec) {
      const uFast = lookupFastStats(uSpec.fastMove, uSpec.fastTurns);
      const oFast = lookupFastStats(oSpec.fastMove, oSpec.fastTurns);
      const uFastEff = getTypeEff(uFast.type, oSpec.meta.types);
      const oFastEff = getTypeEff(oFast.type, uSpec.meta.types);
      const uC1 = calcChargedDmgPct(uSpec.meta, oSpec.meta, uSpec.c1, uSpec.isShadow, oSpec.isShadow, 0, 0).pct;
      const uC2 = calcChargedDmgPct(uSpec.meta, oSpec.meta, uSpec.c2, uSpec.isShadow, oSpec.isShadow, 0, 0).pct;
      const oC1 = calcChargedDmgPct(oSpec.meta, uSpec.meta, oSpec.c1, oSpec.isShadow, uSpec.isShadow, 0, 0).pct;
      const oC2 = calcChargedDmgPct(oSpec.meta, uSpec.meta, oSpec.c2, oSpec.isShadow, uSpec.isShadow, 0, 0).pct;
      const uBest = Math.max(uC1, uC2);
      const oBest = Math.max(oC1, oC2);
      const uEpt = uFast.energy / Math.max(1, uFast.turns);
      const oEpt = oFast.energy / Math.max(1, oFast.turns);

      const codes = [0, 1, 2].map(sh => {
        const cWeight = sh === 0 ? 1.8 : sh === 1 ? 1.3 : 0.85;
        const fWeight = sh === 0 ? 95 : sh === 1 ? 120 : 155;
        const delta = (uBest * (uEpt / 3.5) - oBest * (oEpt / 3.5)) * cWeight + (uFastEff - oFastEff) * fWeight;
        const r = Math.max(150, Math.min(850, Math.round(500 + delta)));
        if (r >= 620) return 'SW';
        if (r >= 530) return 'W';
        if (r > 470) return 'N';
        if (r > 380) return 'L';
        return 'SL';
      });
      return { str: codes.join(','), r1s: codes[1] };
    }

    function getResolvedUserSpecs() {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const rawSpecs = (summaryHeader && Array.isArray(summaryHeader.userTeamSpecs) && summaryHeader.userTeamSpecs.length > 0)
        ? summaryHeader.userTeamSpecs
        : [];
      const out = [];
      for (let i = 0; i < 3; i++) {
        const s = rawSpecs[i] || {};
        const spName = s.species || (i === 0 && frames[0] && frames[0].userActiveSpecies) || ['Feraligatr', 'Clodsire', 'Mandibuzz'][i];
        const meta = lookupSpeciesMeta(spName, lg);
        const fastMove = s.fastMove || meta.fastMove;
        const fStats = lookupFastStats(fastMove, s.fastTurns || meta.fastTurns);
        const c1 = s.chargedMove1 || meta.c1;
        const c2 = s.chargedMove2 || meta.c2;
        const c1Stats = lookupChargedStats(c1, meta.types[0], s.chargedMove1Energy);
        const c2Stats = lookupChargedStats(c2, meta.types[0], s.chargedMove2Energy);
        out.push({
          slotIndex: i,
          name: spName,
          code: abbrPoke3(spName, meta.isShadow),
          isShadow: meta.isShadow,
          cp: s.cp || meta.effCp,
          fastMove,
          fastTurns: fStats.turns,
          fastEnergy: s.fastEnergy || fStats.energy,
          c1,
          c1Energy: c1Stats.energy,
          c2,
          c2Energy: c2Stats.energy,
          meta
        });
      }
      return out;
    }

    function getResolvedOppSpecs() {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const rawSpecs = (summaryHeader && Array.isArray(summaryHeader.oppTeamSpecs) && summaryHeader.oppTeamSpecs.length > 0)
        ? summaryHeader.oppTeamSpecs
        : [];
      const seenNames = [];
      for (const rs of rawSpecs) {
        if (rs && rs.species) seenNames.push(rs);
      }
      if (seenNames.length === 0) {
        const distinct = [];
        for (const f of frames) {
          if (f.oppActiveSpecies && !distinct.includes(f.oppActiveSpecies)) {
            distinct.push(f.oppActiveSpecies);
          }
        }
        distinct.slice(0, 3).forEach((nm, idx) => seenNames.push({ slotIndex: idx, species: nm }));
      }
      return seenNames.slice(0, 3).map((s, i) => {
        const spName = s.species || 'Opponent';
        const meta = lookupSpeciesMeta(spName, lg);
        const isShad = manualOppShadowOverride !== null && i === 0
          ? manualOppShadowOverride
          : (s.isShadow !== undefined ? Boolean(s.isShadow) : meta.isShadow);
        const fastMove = s.inferredFastMove || meta.fastMove;
        const fStats = lookupFastStats(fastMove, s.fastTurns || meta.fastTurns);
        const confirmed = Array.isArray(s.confirmedChargedMoves) ? s.confirmedChargedMoves.map(m => String(m).replace(/\\*/g, '').trim()).filter(Boolean) : [];
        const c1 = confirmed[0] || meta.c1 || 'Body Slam';
        const c2 = (confirmed[1] && confirmed[1].toLowerCase() !== c1.toLowerCase()) ? confirmed[1] : (meta.c2 && meta.c2.toLowerCase() !== c1.toLowerCase() ? meta.c2 : 'Surf');
        const c3 = meta.c3 || 'Outrage';
        return {
          slotIndex: i,
          name: spName,
          code: abbrPoke3(spName, isShad),
          isShadow: isShad,
          cp: meta.effCp,
          fastMove,
          fastTurns: fStats.turns,
          fastEnergy: s.fastEnergy || fStats.energy,
          fastStatus: s.fastMoveStatus || (s.fastMoveConfirmed ? 'confirmed' : 'default'),
          fastConfirmed: Boolean(s.fastMoveConfirmed),
          confirmedMoves: confirmed,
          c1,
          c2,
          c3,
          meta
        };
      });
    }

    function buildReplayOverlayPayload(f) {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const uSpecs = getResolvedUserSpecs();
      const oSpecs = getResolvedOppSpecs();

      const uIdx = manualUserSlotOverride !== null
        ? manualUserSlotOverride
        : Math.max(0, Math.min(2, Number(f.userActiveIndex ?? 0)));
      let oIdx = manualOppSlotOverride !== null
        ? manualOppSlotOverride
        : Math.max(0, Math.min(Math.max(0, oSpecs.length - 1), Number(f.oppActiveIndex ?? 0)));
      if (f.oppActiveSpecies && manualOppSlotOverride === null) {
        const matchIdx = oSpecs.findIndex(o => o.name.toLowerCase().includes(f.oppActiveSpecies.toLowerCase()) || f.oppActiveSpecies.toLowerCase().includes(o.name.toLowerCase()));
        if (matchIdx >= 0) oIdx = matchIdx;
      }

      const actUser = uSpecs[uIdx] || uSpecs[0];
      const actOpp = oSpecs[oIdx] || oSpecs[0] || {
        slotIndex: 0,
        name: f.oppActiveSpecies || 'Opponent',
        code: abbrPoke3(f.oppActiveSpecies || 'OPP', false),
        isShadow: false,
        cp: 1500,
        fastMove: 'Tackle',
        fastTurns: 2,
        fastEnergy: 8,
        fastStatus: 'default',
        fastConfirmed: false,
        confirmedMoves: [],
        c1: 'Body Slam',
        c2: 'Surf',
        c3: 'Earthquake',
        meta: lookupSpeciesMeta(f.oppActiveSpecies || 'Opponent', lg)
      };

      const pSlotHp = [0, 1, 2].map(i => {
        const raw = (f.userSlotHpPct && f.userSlotHpPct[i] !== undefined) ? f.userSlotHpPct[i] : (i === uIdx ? f.userHpPct : 100);
        return raw >= 0 ? raw : 100;
      });
      const oSlotHp = [0, 1, 2].map(i => {
        const raw = (f.oppSlotHpPct && f.oppSlotHpPct[i] !== undefined) ? f.oppSlotHpPct[i] : (i === oIdx ? f.oppHpPct : 100);
        return raw >= 0 ? raw : 100;
      });
      const pSlotE = [0, 1, 2].map(i => (f.userSlotEnergy && f.userSlotEnergy[i] !== undefined) ? f.userSlotEnergy[i] : (i === uIdx ? (f.userEnergy || 0) : 0));
      const oSlotE = [0, 1, 2].map(i => (f.oppSlotEnergy && f.oppSlotEnergy[i] !== undefined) ? f.oppSlotEnergy[i] : (i === oIdx ? (f.oppEnergy || 0) : 0));

      const pFainted = pSlotHp.map((hp, i) => hp <= 0 && i !== uIdx);
      const oFainted = oSlotHp.map((hp, i) => hp <= 0 && i !== oIdx);

      const uShields = manualUserShieldsOverride !== null ? manualUserShieldsOverride : (f.userShields ?? 2);
      const oShields = manualOppShieldsOverride !== null ? manualOppShieldsOverride : (f.oppShields ?? 2);

      const pAtkStg = f.userSlotAtkStage || [0, 0, 0];
      const pDefStg = f.userSlotDefStage || [0, 0, 0];
      const oAtkStg = f.oppSlotAtkStage || [0, 0, 0];
      const oDefStg = f.oppSlotDefStage || [0, 0, 0];

      const winsCmp = actUser.meta.effAtk >= actOpp.meta.effAtk;

      // Build scannedOpponents array for 3v3 Matrix
      const scannedOpponents = oSpecs.map((o, idx) => {
        const d1 = calcChargedDmgPct(o.meta, actUser.meta, o.c1, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct;
        const d2 = calcChargedDmgPct(o.meta, actUser.meta, o.c2, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct;
        const d3 = calcChargedDmgPct(o.meta, actUser.meta, o.c3, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct;
        const m1 = lookupChargedStats(o.c1, o.meta.types[0]);
        const m2 = lookupChargedStats(o.c2, o.meta.types[0]);
        const m3 = lookupChargedStats(o.c3, o.meta.types[0]);
        const cheapestE = Math.min(m1.energy, m2.energy, m3.energy);
        const curHp = oSlotHp[idx];
        const curE = oSlotE[idx];
        const isReady = curHp > 0 && curE >= cheapestE;
        return {
          name: o.name,
          code: o.code,
          slotOrder: idx + 1,
          isActive: idx === oIdx,
          isShadow: o.isShadow,
          hpPct: curHp,
          energy: curE,
          cheapestMoveEnergy: cheapestE,
          isMoveReady: isReady,
          energyLabel: isReady ? (curE + 'E READY') : (curE + 'E'),
          turns: o.fastTurns,
          fastMove: o.fastMove,
          oppFastMoveStatus: o.fastStatus,
          confirmedChargedMoves: o.confirmedMoves,
          c1: abbrMove5(o.c1) + ' (' + d1 + '%)',
          c2: abbrMove5(o.c2) + ' (' + d2 + '%)',
          c3: abbrMove5(o.c3) + ' (' + d3 + '%)',
          c4: '',
          atkStage: oAtkStg[idx] || 0,
          defStage: oDefStg[idx] || 0,
          disguiseBusted: Boolean(idx === oIdx && f.oppDisguiseBusted),
          matrix: {
            p1: calc3DotMatrixString(uSpecs[0], o).str,
            p2: calc3DotMatrixString(uSpecs[1], o).str,
            p3: calc3DotMatrixString(uSpecs[2], o).str
          }
        };
      });

      // Compute shared horizon turns
      const oppMoveNames = [actOpp.c1, actOpp.c2, actOpp.c3].filter((v, i, a) => v && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
      const myMoveNames = [actUser.c1, actUser.c2].filter((v, i, a) => v && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

      let maxHorizonTurns = 12;
      const oppReadyTurnsSet = new Set();
      for (const mName of oppMoveNames) {
        const mStats = lookupChargedStats(mName, actOpp.meta.types[0]);
        const t1 = Math.max(1, Math.ceil(mStats.energy / actOpp.fastEnergy)) * actOpp.fastTurns;
        if (t1 > maxHorizonTurns) maxHorizonTurns = t1;
        let leftE = 0, cumF = 0;
        for (let c = 1; c <= 3; c++) {
          const needE = Math.max(1, mStats.energy - leftE);
          const fCnt = Math.max(1, Math.ceil(needE / actOpp.fastEnergy));
          leftE = leftE + fCnt * actOpp.fastEnergy - mStats.energy;
          cumF += fCnt;
          oppReadyTurnsSet.add(cumF * actOpp.fastTurns);
        }
      }
      for (const mName of myMoveNames) {
        const mStats = lookupChargedStats(mName, actUser.meta.types[0]);
        const t1 = Math.max(1, Math.ceil(mStats.energy / actUser.fastEnergy)) * actUser.fastTurns;
        if (t1 > maxHorizonTurns) maxHorizonTurns = t1;
      }

      // Build oppMoveTimingRows
      const oppMoveTimingRows = oppMoveNames.map(mName => {
        const { pct: activeDmgPct, eff: activeEff, mStats } = calcChargedDmgPct(
          actOpp.meta, actUser.meta, mName, actOpp.isShadow, actUser.isShadow, oAtkStg[oIdx] || 0, pDefStg[uIdx] || 0
        );
        const mEnergy = mStats.energy;
        const oppFasts = Math.max(1, Math.ceil(mEnergy / actOpp.fastEnergy));
        const oppReadyTurn = oppFasts * actOpp.fastTurns;
        const myTapAtReady = Math.max(1, Math.ceil(oppReadyTurn / actUser.fastTurns));
        const displayReadyCount = myTapAtReady;

        const cycles = [];
        let leftE = 0, cumOppFasts = 0, prevTurn = 0, prevTap = 0;
        for (let cIdx = 1; cIdx <= 3; cIdx++) {
          const needE = Math.max(1, mEnergy - leftE);
          const fInCycle = Math.max(1, Math.ceil(needE / actOpp.fastEnergy));
          leftE = leftE + fInCycle * actOpp.fastEnergy - mEnergy;
          cumOppFasts += fInCycle;
          const rTurn = cumOppFasts * actOpp.fastTurns;
          if (cIdx > 1 && rTurn > maxHorizonTurns) break;
          const tSpan = Math.max(1, rTurn - prevTurn);
          const wPct = Math.max(8, Math.min(100, (tSpan / maxHorizonTurns) * 100));
          const rTap = Math.max(prevTap + 1, Math.ceil(rTurn / actUser.fastTurns));
          const sTap = prevTap + 1;
          const rEnd = rTap - 1;
          const rangeLabel = rTap <= sTap ? '' : (rEnd === sTap ? String(sTap) : (sTap + '–' + rEnd));
          cycles.push({
            cycleIndex: cIdx,
            startTurn: prevTurn,
            readyTurn: rTurn,
            turnSpan: tSpan,
            widthPct: wPct,
            startTap: sTap,
            readyTap: rTap,
            rangeLabel,
            readyLabel: '#' + rTap,
            hasZeroSneak: false,
            readyState: winsCmp ? 'cmp' : 'catch'
          });
          prevTurn = rTurn;
          prevTap = rTap;
        }

        const teamDamages = uSpecs.map((u, tIdx) => {
          const { pct: tDmg, eff: tEff } = calcChargedDmgPct(
            actOpp.meta, u.meta, mName, actOpp.isShadow, u.isShadow, oAtkStg[oIdx] || 0, pDefStg[tIdx] || 0
          );
          const tier = tDmg <= 35 ? 'resist' : (tDmg >= 65 || tEff >= 1.5 ? 'weak' : 'neutral');
          return {
            name: u.name,
            code: u.code,
            dmgPct: tDmg,
            eff: tEff,
            tier,
            isActive: tIdx === uIdx
          };
        });

        const isConfirmed = actOpp.confirmedMoves.some(cm => cm.toLowerCase() === mName.toLowerCase());
        return {
          name: mName,
          shortName: abbrMove5(mName),
          energy: mEnergy,
          oppFasts,
          oppReadyTurn,
          myTapAtReady,
          displayReadyCount,
          winsCmp,
          isConfirmedMove: isConfirmed,
          activeName: actUser.name,
          activeDmgPct,
          activeEff,
          safeRangeLabel: displayReadyCount <= 1 ? '1' : ('1–' + (displayReadyCount - 1)),
          maxHorizonTurns,
          cycles,
          teamDamages
        };
      });

      const oppFirstReadyTaps = new Set(oppMoveTimingRows.map(r => r.myTapAtReady));

      // Build myMoveTimingRows
      const myMoveTimingRows = myMoveNames.map(mName => {
        const { pct: dmgPct, eff, mStats } = calcChargedDmgPct(
          actUser.meta, actOpp.meta, mName, actUser.isShadow, actOpp.isShadow, pAtkStg[uIdx] || 0, oDefStg[oIdx] || 0
        );
        const mEnergy = mStats.energy;
        const myTapsNeeded = Math.max(1, Math.ceil(mEnergy / actUser.fastEnergy));
        const myReadyTurn = myTapsNeeded * actUser.fastTurns;

        const cycles = [];
        let leftE = 0, cumMyFasts = 0, prevTurn = 0, prevTap = 0;
        for (let cIdx = 1; cIdx <= 3; cIdx++) {
          const needE = Math.max(1, mEnergy - leftE);
          const fInCycle = Math.max(1, Math.ceil(needE / actUser.fastEnergy));
          leftE = leftE + fInCycle * actUser.fastEnergy - mEnergy;
          cumMyFasts += fInCycle;
          const rTurn = cumMyFasts * actUser.fastTurns;
          if (cIdx > 1 && rTurn > maxHorizonTurns) break;
          const tSpan = Math.max(1, rTurn - prevTurn);
          const wPct = Math.max(8, Math.min(100, (tSpan / maxHorizonTurns) * 100));
          const rTap = cumMyFasts;
          const sTap = prevTap + 1;
          const rEnd = rTap - 1;
          const safeTaps = [];
          for (let k = sTap; k <= rEnd; k++) {
            if ((k * actUser.fastTurns) % actOpp.fastTurns !== 0) safeTaps.push(k);
          }
          const hasZeroSneak = safeTaps.length > 0;
          const rangeLabel = rTap <= sTap ? '' : (hasZeroSneak ? ('Safe ' + safeTaps.slice(0, 3).join(',')) : (rEnd === sTap ? String(sTap) : (sTap + '–' + rEnd)));
          const isCmp = oppReadyTurnsSet.has(rTurn) || oppFirstReadyTaps.has(rTap);
          const readyState = isCmp ? (winsCmp ? 'cmp' : 'cmp-loss') : 'safe';
          cycles.push({
            cycleIndex: cIdx,
            startTurn: prevTurn,
            readyTurn: rTurn,
            turnSpan: tSpan,
            widthPct: wPct,
            startTap: sTap,
            readyTap: rTap,
            rangeLabel,
            readyLabel: '#' + rTap,
            hasZeroSneak,
            readyState
          });
          prevTurn = rTurn;
          prevTap = rTap;
        }

        const oppDamages = [0, 1, 2].map(sIdx => {
          const o = oSpecs[sIdx];
          if (!o) return { name: '—', code: '—', dmgPct: null, eff: 1.0, tier: 'empty', isActive: false };
          const { pct: oDmg, eff: oEff } = calcChargedDmgPct(
            actUser.meta, o.meta, mName, actUser.isShadow, o.isShadow, pAtkStg[uIdx] || 0, oDefStg[sIdx] || 0
          );
          const tier = (oDmg >= 65 || oEff >= 1.5) ? 'high' : (oDmg <= 35 || oEff <= 0.65 ? 'low' : 'neutral');
          return {
            name: o.name,
            code: o.code,
            dmgPct: oDmg,
            eff: oEff,
            tier,
            isActive: sIdx === oIdx
          };
        });

        const firstCycle = cycles[0] || {};
        return {
          name: mName,
          shortName: abbrMove5(mName),
          energy: mEnergy,
          myTapsNeeded,
          myReadyTurn,
          dmgPct,
          eff,
          state: firstCycle.readyState || 'safe',
          safeThrowLabel: firstCycle.rangeLabel || (myTapsNeeded <= 1 ? '1' : ('1–' + (myTapsNeeded - 1))),
          hasZeroSneak: Boolean(firstCycle.hasZeroSneak),
          maxHorizonTurns,
          cycles,
          oppDamages
        };
      });

      // Build 2-Line 4-Pillar AI Tactical Coach
      const cheapestOppRow = oppMoveTimingRows.reduce((best, r) => (!best || r.energy < best.energy ? r : best), null);
      const nextOppCost = cheapestOppRow ? cheapestOppRow.energy : 45;
      const curOppE = oSlotE[oIdx] || 0;
      const oppFastsToMove = curOppE >= nextOppCost ? 0 : Math.ceil((nextOppCost - curOppE) / Math.max(1, actOpp.fastEnergy));
      const timingAlertLevel = oppFastsToMove === 0 ? 'IMMEDIATE_0_FAST' : oppFastsToMove === 1 ? 'BLINK_1_FAST' : oppFastsToMove === 2 ? 'WARN_2_FASTS' : 'NORMAL';

      const recAction = f.recommendedAction || (f.moveBannerText ? ('⚡ ' + f.moveBannerText) : 'STAY IN · PACE');
      const recGoal = f.recommendedGoal || ('Opp ' + (cheapestOppRow ? cheapestOppRow.shortName : 'Move') + ' in ' + oppFastsToMove + 'F (' + curOppE + 'E/' + nextOppCost + 'E)');
      const shieldPlan = uShields > 0 && cheapestOppRow && cheapestOppRow.activeDmgPct >= pSlotHp[uIdx] ? '1S (KO Risk)' : (uShields + 'S');

      const oppFastTelemetry = abbrMove5(actOpp.fastMove) + ' ' + actOpp.fastTurns + 't(' + (actOpp.fastTurns * 0.5).toFixed(1) + 's)/+' + actOpp.fastEnergy + 'e';
      const userFastTelemetry = abbrMove5(actUser.fastMove) + ' ' + actUser.fastTurns + 't(' + (actUser.fastTurns * 0.5).toFixed(1) + 's)/+' + actUser.fastEnergy + 'e';

      // v6.42: Reconstruct Shield Decision Overlay (Red/Orange/Yellow/Green KO & HP summary above Attack incoming!)
      const frameArrayIdx = Math.max(0, frames.indexOf(f));
      let chargeStartIdx = frameArrayIdx;
      while (chargeStartIdx > 0 && (
        String(frames[chargeStartIdx - 1].pendingChargeActor || '').toLowerCase() === 'opp' ||
        Boolean(frames[chargeStartIdx - 1].isTopCountdownActive)
      )) {
        chargeStartIdx--;
      }
      const combinedBannerStr = String((f.ocrMidBannerText || f.moveBannerText || '') + ' ' + (f.ocrBottomMovesText || '')).toLowerCase();
      const isOppChargeWin = String(f.pendingChargeActor || '').toLowerCase() === 'opp' ||
        Boolean(f.isTopCountdownActive) ||
        /attack incoming|protect shield|shields remaining/i.test(combinedBannerStr) ||
        String(f.recommendedPhase || '').toUpperCase() === 'SHIELD_CALL';
      let hasUsedBannerSoFar = /\\bused\\b/i.test(combinedBannerStr);
      if (isOppChargeWin && !hasUsedBannerSoFar) {
        for (let k = chargeStartIdx; k <= frameArrayIdx; k++) {
          const bTxt = String((frames[k] && (frames[k].ocrMidBannerText || frames[k].moveBannerText)) || '');
          if (/\\bused\\b/i.test(bTxt)) {
            hasUsedBannerSoFar = true;
            break;
          }
        }
      }
      const elapsedInChargeMs = frames[chargeStartIdx] ? Math.max(0, (f.relTimeMs || 0) - (frames[chargeStartIdx].relTimeMs || 0)) : 0;
      const isShieldDecisionVisible = Boolean(showShieldHud && isOppChargeWin && !hasUsedBannerSoFar && elapsedInChargeMs <= 5500);

      // Compute Pillar 4 & candidate moves for Shield Decision Overlay
      const uHpNow = Math.max(1, Math.min(100, Number(pSlotHp[uIdx] ?? 100)));
      const uEnergyNow = Math.max(0, Math.min(100, Number(pSlotE[uIdx] ?? 0)));
      const bestUserRow = myMoveTimingRows[0] || { name: actUser.c1, shortName: abbrMove5(actUser.c1), energy: actUser.c1Energy || 45 };
      const myTargetMoveShort = bestUserRow.shortName || abbrMove5(bestUserRow.name);
      const myTargetMoveCost = bestUserRow.energy || 45;
      const myFastsNeededForNext = uEnergyNow >= myTargetMoveCost ? 0 : Math.max(1, Math.ceil((myTargetMoveCost - uEnergyNow) / Math.max(1, actUser.fastEnergy)));

      const oFastStats = lookupFastStats(actOpp.fastMove, actOpp.fastTurns);
      const oFastStab = actOpp.meta.types.includes(oFastStats.type) ? 1.2 : 1.0;
      const oFastEff = getTypeEff(oFastStats.type, actUser.meta.types);
      const oFastRaw = Math.floor(0.5 * oFastStats.power * ((actOpp.meta.effAtk * (actOpp.isShadow ? 1.2 : 1.0) * stageMult(oAtkStg[oIdx] || 0)) / Math.max(10, actUser.meta.effDef * (actUser.isShadow ? 0.8333333 : 1.0) * stageMult(pDefStg[uIdx] || 0))) * oFastStab * oFastEff * 1.3) + 1;
      const oppFastExactDmgPct = Math.max(0.5, (oFastRaw / Math.max(20, actUser.meta.effHp)) * 100);

      const twoMovesLocked = Array.isArray(actOpp.confirmedMoves) && actOpp.confirmedMoves.length >= 2;
      const rawCandNames = twoMovesLocked
        ? actOpp.confirmedMoves.slice(0, 2)
        : [actOpp.c1, actOpp.c2, actOpp.c3].filter(Boolean);
      const seenMoveLower = new Set();
      const candMoveNames = rawCandNames.filter(m => {
        const kl = String(m).toLowerCase();
        if (seenMoveLower.has(kl)) return false;
        seenMoveLower.add(kl);
        return true;
      });

      const rawShieldRows = candMoveNames.map(mName => {
        const res = calcChargedDmgPct(actOpp.meta, actUser.meta, mName, actOpp.isShadow, actUser.isShadow, oAtkStg[oIdx] || 0, pDefStg[uIdx] || 0);
        const cost = Math.max(35, Math.min(100, res.mStats.energy || 50));
        const dmg = res.pct;
        const remHp = Math.max(0, uHpNow - dmg);
        const isKo = dmg >= uHpNow;
        const oppFastsSurv = (isKo || remHp <= 1) ? 0 : Math.max(0, Math.floor((remHp - 1) / oppFastExactDmgPct));
        const turnsSurv = oppFastsSurv * Math.max(1, actOpp.fastTurns);
        const myTurnsNeed = myFastsNeededForNext * Math.max(1, actUser.fastTurns);
        const canReach = !isKo && (myFastsNeededForNext === 0 || turnsSurv >= myTurnsNeed);
        const fastsShort = (canReach || isKo) ? 0 : Math.max(1, Math.ceil((myTurnsNeed - turnsSurv) / Math.max(1, actUser.fastTurns)));
        return {
          moveName: mName,
          shortName: abbrMove5(mName),
          energyCost: cost,
          dmgPct: dmg,
          remHpPct: remHp,
          isKo,
          isFunded: false,
          canReachNextMoveIfTanked: canReach,
          fastsToNextMoveIfTanked: myFastsNeededForNext,
          fastsShortIfTanked: fastsShort,
          userTargetMoveShort: myTargetMoveShort
        };
      });

      const minCandCost = rawShieldRows.reduce((minC, r) => Math.min(minC, r.energyCost), 35);
      let preWindowOppE = curOppE;
      if (chargeStartIdx > 0 && frames[chargeStartIdx - 1]) {
        const pf = frames[chargeStartIdx - 1];
        preWindowOppE = (Array.isArray(pf.oppSlotEnergy) && pf.oppSlotEnergy[oIdx] !== undefined)
          ? Number(pf.oppSlotEnergy[oIdx])
          : Number(pf.oppEnergy ?? curOppE);
      }
      const postDeductPlusMin = String(f.pendingChargeActor || '').toLowerCase() === 'opp' ? (curOppE + minCandCost) : curOppE;
      const effectiveBankedE = Math.max(minCandCost, Math.min(100, Math.max(preWindowOppE, postDeductPlusMin)));

      const normShieldRows = rawShieldRows.map(r => ({ ...r, isFunded: effectiveBankedE >= r.energyCost }));
      const fundedMoves = normShieldRows.filter(r => r.isFunded).sort((a, b) => b.dmgPct - a.dmgPct);
      const unfundedMoves = normShieldRows.filter(r => !r.isFunded).sort((a, b) => a.energyCost - b.energyCost);

      const allFundedKo = fundedMoves.length > 0 && fundedMoves.every(r => r.isKo);
      const someFundedKo = fundedMoves.some(r => r.isKo) && fundedMoves.some(r => !r.isKo);
      const anyFundedFarmed = fundedMoves.some(r => !r.isKo && !r.canReachNextMoveIfTanked);
      const unfundedKo = fundedMoves.every(r => !r.isKo) && unfundedMoves.some(r => r.isKo);
      const worstFarmed = fundedMoves.find(r => !r.isKo && !r.canReachNextMoveIfTanked);

      let sdBgHex = 'rgba(6, 78, 59, 0.95)';
      let sdStrokeHex = '#10B981';
      let sdVerdict = myFastsNeededForNext === 0
        ? ('🛡️ TANK (0S): ' + myTargetMoveShort + ' READY!')
        : ('🛡️ TANK (0S) -> REACH ' + myTargetMoveShort + ' IN ' + myFastsNeededForNext + 'F!');
      if (allFundedKo) {
        sdBgHex = 'rgba(127, 29, 29, 0.95)';
        sdStrokeHex = '#EF4444';
        sdVerdict = '🛡️ SHIELD (1S): ALL FUNDED KO!';
      } else if (someFundedKo) {
        sdBgHex = 'rgba(124, 45, 18, 0.95)';
        sdStrokeHex = '#F97316';
        sdVerdict = '🛡️ SHIELD / BAIT MIX: NUKE KOs!';
      } else if (anyFundedFarmed) {
        sdBgHex = 'rgba(124, 45, 18, 0.95)';
        sdStrokeHex = '#FB923C';
        sdVerdict = '🛡️ SHIELD (1S): TANK DIES ' + (worstFarmed ? worstFarmed.fastsShortIfTanked : 1) + 'F SHORT OF ' + myTargetMoveShort + '!';
      } else if (unfundedKo) {
        sdBgHex = 'rgba(113, 63, 18, 0.95)';
        sdStrokeHex = '#EAB308';
        sdVerdict = '🛡️ TANK (0S) -> ' + myTargetMoveShort + ' IN ' + myFastsNeededForNext + 'F (Unfunded KO)';
      }
      const lockedTag = twoMovesLocked ? ' • 2M' : '';
      const sdHeaderLine = sdVerdict + '  •  ' + actOpp.code + '(' + effectiveBankedE + 'e) vs ' + actUser.code + '(' + uHpNow + '%)' + lockedTag;

      return {
        activeOpponent: actOpp.name,
        shieldDecisionOverlay: {
          visible: isShieldDecisionVisible,
          bgColorHex: sdBgHex,
          strokeColorHex: sdStrokeHex,
          headerLineText: sdHeaderLine,
          verdictText: sdVerdict,
          effectiveBankedEnergy: effectiveBankedE,
          userHpPct: uHpNow,
          fundedMoves,
          unfundedMoves
        },
        activeOpponentFastMove: actOpp.fastMove,
        activeOpponentTurns: actOpp.fastTurns,
        oppFastTelemetry,
        oppFastMoveStatus: actOpp.fastStatus,
        oppFastMoveConfirmed: actOpp.fastConfirmed,
        confirmedOppChargedMoves: actOpp.confirmedMoves,
        userFastTelemetry,
        oppCountMode: 'my_fasts',
        enable4ChargedMoves: false,
        fastDetectTurnOffset: 0,
        overlayTransparencyPct: 12,
        appThemeId: 'dialga_shiny_midnight',
        aiAdviceHudPosition: hudTop ? 'top' : 'bottom',
        isOverlayMinimized: false,
        maxHorizonTurns,
        isOpponentShadow: actOpp.isShadow,
        currentFormLabel: actOpp.meta.formLabel || 'Base',
        availableForms: [actOpp.meta.formLabel || 'Base'],
        userActivePokemon: actUser.name,
        activeUserSlotIndex: uIdx,
        activeOpponentSlotIndex: oIdx,
        leadMatchup: (summaryHeader && summaryHeader.leadMatchup) || 'NEUTRAL',
        isBattleActive: true,
        isReplayMode: true,
        userFastMoveName: actUser.fastMove,
        userFastMoveTurns: actUser.fastTurns,
        winsCmp,
        myMove1Summary: myMoveTimingRows[0] ? (myMoveTimingRows[0].shortName + ' (' + myMoveTimingRows[0].dmgPct + '%)') : '—',
        myMove2Summary: myMoveTimingRows[1] ? (myMoveTimingRows[1].shortName + ' (' + myMoveTimingRows[1].dmgPct + '%)') : '—',
        throwAlignmentText: '1st, 3rd, 5th',
        throwHorizonText: '1st, 3rd, 5th',
        playerSwapRemainingSec: Math.max(0, Number(f.playerSwapRemainingSec ?? Math.ceil((f.userSwitchClockMs || 0) / 1000))),
        playerSwapEndTimeMs: 0,
        oppSwapRemainingSec: Math.max(0, Number(f.oppSwapRemainingSec ?? Math.ceil((f.oppSwitchClockMs || 0) / 1000))),
        oppSwapEndTimeMs: 0,
        hapticOppSwapWarnSec: 5,
        hapticChargeTimingFasts: 1,
        showOneBattleDvrBtn: false,
        isOneBattleDvrArmed: false,
        isOneBattleDvrRecording: false,
        oneBattleDvrFrames: f.frameIdx || 0,
        playerSwitchValidityLatched: true,
        oppSwitchValidityLatched: true,
        isPostFaintSwitchPromptActive: false,
        isAttackIncomingPromptActive: Boolean(f.isCutsceneActive),
        playerPokeballs: f.userBalls ?? 3,
        oppPokeballs: f.oppBalls ?? 3,
        playerShields: uShields,
        oppShields: oShields,
        player_shields_remaining: uShields,
        opponent_shields_remaining: oShields,
        playerFaintedSlots: pFainted,
        oppFaintedSlots: oFainted,
        playerSlotHpPct: pSlotHp,
        oppSlotHpPct: oSlotHp,
        playerSlotEnergy: pSlotE,
        oppSlotEnergy: oSlotE,
        playerSlotEverOnField: [true, true, true],
        activeUserHpPct: pSlotHp[uIdx],
        activeOppHpPct: oSlotHp[oIdx],
        activeUserAtkStage: pAtkStg[uIdx] || 0,
        activeUserDefStage: pDefStg[uIdx] || 0,
        activeUserDisguiseBusted: Boolean(f.userDisguiseBusted),
        activeOppAtkStage: oAtkStg[oIdx] || 0,
        activeOppDefStage: oDefStg[oIdx] || 0,
        activeOppDisguiseBusted: Boolean(f.oppDisguiseBusted),
        playerSlotAtkStage: pAtkStg,
        playerSlotDefStage: pDefStg,
        playerSlotDisguiseBusted: [false, false, false],
        oppSlotAtkStage: oAtkStg,
        oppSlotDefStage: oDefStg,
        oppSlotDisguiseBusted: [false, false, false],
        activeUserEnergy: pSlotE[uIdx] || 0,
        activeOppEnergy: oSlotE[oIdx] || 0,
        activeOppMoveReady: Boolean(scannedOpponents[oIdx] && scannedOpponents[oIdx].isMoveReady),
        activeOppEnergyLabel: (scannedOpponents[oIdx] && scannedOpponents[oIdx].energyLabel) || '0E',
        scanHzMode: 10,
        lastScanDurationMs: 12,
        lastBattleAvgScanMs: 12,
        lastHpScanDurationMs: 2,
        lastBattleAvgHpScanMs: 2,
        scanTurnOffsetMs: 0,
        battleTurnIndex: Math.floor((f.relTimeMs || 0) / 500),
        teamArchetype: 'ABC',
        showTacticalRec: true,
        showTacticalRecommendations: true,
        enableHpTracking: true,
        enableEnergyTracking: true,
        tacticalRec: {
          phase: f.recommendedPhase || 'MIDGAME',
          archetype: 'ABC',
          action: recAction,
          actionLabel: recAction,
          shieldPlan,
          goal: recGoal,
          goalText: recGoal,
          tacticalSubGoal: recGoal,
          line1Text: recAction,
          line2Text: '🎯 ' + recGoal,
          backlineText: '🎯 ' + recGoal,
          timingAlertLevel,
          swapPunishRiskPct: 25,
          tone: timingAlertLevel === 'BLINK_1_FAST' || timingAlertLevel === 'IMMEDIATE_0_FAST' ? 'shield' : 'stay',
          recommendedSwapSlotIndex: -1,
          activeBr: 500,
          activeUserHpPct: pSlotHp[uIdx],
          confirmedUserHpPct: pSlotHp[uIdx],
          isHpExtraFrameConfirmed: true,
          altMoveKoWarning: '',
          activeOppHpPct: oSlotHp[oIdx]
        },
        tacticalRecommendation: {
          phase: f.recommendedPhase || 'MIDGAME',
          archetype: 'ABC',
          action: recAction,
          actionLabel: recAction,
          shieldPlan,
          goal: recGoal,
          goalText: recGoal,
          tacticalSubGoal: recGoal,
          line1Text: recAction,
          line2Text: '🎯 ' + recGoal,
          backlineText: '🎯 ' + recGoal,
          timingAlertLevel,
          swapPunishRiskPct: 25,
          tone: timingAlertLevel === 'BLINK_1_FAST' || timingAlertLevel === 'IMMEDIATE_0_FAST' ? 'shield' : 'stay',
          recommendedSwapSlotIndex: -1,
          activeBr: 500,
          activeUserHpPct: pSlotHp[uIdx],
          confirmedUserHpPct: pSlotHp[uIdx],
          isHpExtraFrameConfirmed: true,
          altMoveKoWarning: '',
          activeOppHpPct: oSlotHp[oIdx]
        },
        team: uSpecs.map((u, idx) => ({
          initial: u.name.charAt(0).toUpperCase(),
          code: u.code,
          name: u.name,
          hpPct: pSlotHp[idx],
          energy: pSlotE[idx]
        })),
        scannedOpponents,
        oppMoveTimingRows,
        myMoveTimingRows
      };
    }

    function findFrameAtSec(sec) {
      if (!frames.length) return null;
      const targetMs = sec * 1000;
      let lo = 0, hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if ((frames[mid].relTimeMs || 0) <= targetMs) lo = mid;
        else hi = mid - 1;
      }
      return frames[lo];
    }

    function syncHudFrame() {
      const f = findFrameAtSec(video.currentTime || 0);
      if (!f) return;
      try {
        attachOverlayBridge();
        const win = hudIframe.contentWindow;
        if (!win || typeof win.updateBattleData !== 'function') return;
        const payload = buildReplayOverlayPayload(f);
        if (typeof win.setReplayShieldOverlayEnabled === 'function') {
          win.setReplayShieldOverlayEnabled(showShieldHud);
        }
        win.updateBattleData(payload);
        if (typeof win.setReplayHudMode === 'function') {
          win.setReplayHudMode(hudMode === 'diag' ? 'diagnostic' : hudMode);
        }
        if (hudMode === 'diag' && typeof win.setReplayDiagnosticText === 'function') {
          const diagStr =
            'F#' + String(f.frameIdx || 0).padStart(4, '0') + ' (' + ((f.relTimeMs || 0) / 1000).toFixed(2) + 's) | Cutscene=' + Boolean(f.isCutsceneActive) + '\\n' +
            'RAW HP: U=' + (f.rawUserHpPct ?? -1) + '% (commit ' + (f.userHpPct ?? -1) + '%) | O=' + (f.rawOppHpPct ?? -1) + '% (commit ' + (f.oppHpPct ?? -1) + '%)\\n' +
            'CIRCLE: L=' + (f.leftCircleFillPct ?? -1) + '% R=' + (f.rightCircleFillPct ?? -1) + '% | SRC=' + (f.energySource || 'FAST_CADENCE') + '\\n' +
            'OCR: ' + JSON.stringify((f.ocrTopRightText || '').replace(/\\n/g, ' ')) + ' | Banner: ' + JSON.stringify((f.ocrMidBannerText || '').replace(/\\n/g, ' '));
          win.setReplayDiagnosticText(diagStr);
        }
      } catch (e) {
        console.error('syncHudFrame error:', e);
      }
    }

    function scrubVideo(val) {
      const dur = video.duration || ((frames[frames.length - 1] && frames[frames.length - 1].relTimeMs) ? frames[frames.length - 1].relTimeMs / 1000 : 180);
      video.currentTime = (Number(val) / 1000) * dur;
      syncHudFrame();
    }

    video.addEventListener('timeupdate', () => {
      const dur = video.duration || ((frames[frames.length - 1] && frames[frames.length - 1].relTimeMs) ? frames[frames.length - 1].relTimeMs / 1000 : 0);
      const cur = video.currentTime || 0;
      if (dur > 0) {
        document.getElementById('video-scrubber').value = String(Math.round((cur / dur) * 1000));
      }
      document.getElementById('time-readout').textContent = cur.toFixed(1) + 's / ' + dur.toFixed(1) + 's';
      syncHudFrame();
    });
    video.addEventListener('loadedmetadata', () => {
      const dur = video.duration || 0;
      document.getElementById('time-readout').textContent = '0.0s / ' + dur.toFixed(1) + 's';
    });
    video.addEventListener('seeked', syncHudFrame);

    async function loadTrace() {
      try {
        const res = await fetch(TRACE_URL);
        if (!res.ok) {
          console.error('Trace HTTP ' + res.status);
          return;
        }
        const text = await res.text();
        const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
        const parsed = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.recordType === 'BATTLE_DVR_SUMMARY_HEADER') {
              summaryHeader = obj.battleSummary || null;
            } else if (typeof obj.frameIdx === 'number') {
              obj.relTimeMs = obj.videoElapsedMs ?? obj.relTimeMs ?? 0;
              obj.userActiveSpecies = obj.activeUserSpecies || obj.userActiveSpecies || '';
              obj.oppActiveSpecies = obj.activeOppSpecies || obj.oppActiveSpecies || '';
              obj.userHpPct = obj.committedUserHpPct ?? obj.userHpPct ?? -1;
              obj.oppHpPct = obj.committedOppHpPct ?? obj.oppHpPct ?? -1;
              obj.userActiveIndex = obj.activeUserIdx ?? obj.userActiveIndex ?? 0;
              obj.oppActiveIndex = obj.activeOppIdx ?? obj.oppActiveIndex ?? 0;
              obj.moveBannerText = obj.ocrMidBannerText || obj.moveBannerText || '';
              obj.circleFillPct = obj.leftCircleFillPct ?? obj.circleFillPct ?? -1;
              obj.ocrTopLeftText = obj.ocrUserTopText || obj.ocrTopLeftText || '';
              obj.ocrTopRightText = obj.ocrOppTopText || obj.ocrTopRightText || '';
              obj.userSwitchClockMs = (obj.playerSwapRemainingSec || 0) * 1000;
              obj.oppSwitchClockMs = (obj.oppSwapRemainingSec || 0) * 1000;
              parsed.push(obj);
            }
          } catch (_) {}
        }
        if (parsed.length > 1) {
          const spanMs = (parsed[parsed.length - 1].relTimeMs || 0) - (parsed[0].relTimeMs || 0);
          if (spanMs < 3000) {
            parsed.forEach((f, idx) => { f.relTimeMs = idx * 100; });
          }
        }
        frames = parsed;
        buildEventChips();
        syncHudFrame();
      } catch (e) {
        console.error('Trace load error:', e);
      }
    }

    function buildEventChips() {
      const container = document.getElementById('event-chips');
      container.innerHTML = '';
      if (summaryHeader && Array.isArray(summaryHeader.timelineEvents) && summaryHeader.timelineEvents.length > 0) {
        for (const ev of summaryHeader.timelineEvents) {
          const sec = Number(ev.t) || 0;
          const jumpSec = Math.max(0, sec - 2.0);
          const typeStr = String(ev.type || '');
          const icon = typeStr.includes('CHARGE') ? '⚡' : typeStr.includes('SWAP') ? '🔄' : (typeStr.includes('FAINT') || typeStr.includes('KO')) ? '💀' : '📌';
          const detail = ev.inferredMoveName || ev.pokemonIn || ev.pokemonFainted || ev.activePokemon || ev.move || ev.species || typeStr;
          const label = icon + ' ' + sec.toFixed(1) + 's ' + String(ev.actor || '').toUpperCase() + ': ' + detail;
          addChip(container, label, jumpSec);
        }
        return;
      }
      let prevU = '', prevO = '', prevBanner = '';
      for (const f of frames) {
        const sec = (f.relTimeMs || 0) / 1000;
        const jumpSec = Math.max(0, sec - 2.0);
        if (f.moveBannerText && f.moveBannerText !== prevBanner) {
          prevBanner = f.moveBannerText;
          addChip(container, '⚡ ' + sec.toFixed(1) + 's ' + f.moveBannerText.slice(0, 26), jumpSec);
        }
        if (f.userActiveSpecies && prevU && f.userActiveSpecies !== prevU) {
          addChip(container, '🔄 ' + sec.toFixed(1) + 's U→' + f.userActiveSpecies, jumpSec);
        }
        if (f.oppActiveSpecies && prevO && f.oppActiveSpecies !== prevO) {
          addChip(container, '🔄 ' + sec.toFixed(1) + 's O→' + f.oppActiveSpecies, jumpSec);
        }
        if (f.userActiveSpecies) prevU = f.userActiveSpecies;
        if (f.oppActiveSpecies) prevO = f.oppActiveSpecies;
      }
    }

    function addChip(container, label, jumpSec) {
      const chip = document.createElement('span');
      chip.className = 'event-chip';
      chip.textContent = label;
      chip.onclick = () => {
        video.currentTime = jumpSec;
        syncHudFrame();
      };
      container.appendChild(chip);
    }

    async function exportWithHud() {
      const btn = document.getElementById('btn-export');
      btn.textContent = '⏳ Recording Export...';
      btn.disabled = true;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 544;
        canvas.height = 1184;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(15);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'silphscope_replay_${shareId}.webm';
          a.click();
          btn.textContent = '💾 Export Video + HUD';
          btn.disabled = false;
        };
        video.currentTime = 0;
        await video.play();
        recorder.start();
        const drawTick = () => {
          if (video.paused || video.ended) {
            if (recorder.state === 'recording') recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, 544, 1184);
          if (hudMode !== 'off') {
            const f = findFrameAtSec(video.currentTime || 0);
            if (f) {
              const y = hudTop ? 36 : 1020;
              ctx.fillStyle = 'rgba(8, 12, 22, 0.88)';
              ctx.fillRect(12, y, 520, 110);
              ctx.strokeStyle = '#10b981';
              ctx.strokeRect(12, y, 520, 110);
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 16px sans-serif';
              ctx.fillText((f.userActiveSpecies || 'User') + ' ' + (f.userHpPct ?? '--') + '% (' + (f.userEnergy ?? 0) + 'E)  vs  ' + (f.oppActiveSpecies || 'Opp') + ' ' + (f.oppHpPct ?? '--') + '% (' + (f.oppEnergy ?? 0) + 'E)', 24, y + 32);
              ctx.fillStyle = '#34d399';
              ctx.font = 'bold 14px sans-serif';
              ctx.fillText(String(f.recommendedAction || f.moveBannerText || 'SilphScope PvP').slice(0, 62), 24, y + 66);
              ctx.fillStyle = '#94a3b8';
              ctx.font = '12px monospace';
              ctx.fillText('F#' + String(f.frameIdx || 0).padStart(4, '0') + ' ' + ((f.relTimeMs || 0) / 1000).toFixed(1) + 's • SilphScope PvP', 24, y + 94);
            }
          }
          requestAnimationFrame(drawTick);
        };
        drawTick();
      } catch (e) {
        alert('Export requires a desktop/modern browser supporting Canvas MediaRecorder: ' + e.message);
        btn.textContent = '💾 Export Video + HUD';
        btn.disabled = false;
      }
    }

    loadTrace();
  </script>
</body>
</html>`;
}

function renderVaultDashboardPage(origin, clientIngestKey) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SilphScope PvP • Cloud DVR Replay Vault</title>
  <style>
    :root {
      --bg: #070b14;
      --card: #0f172a;
      --border: #1e293b;
      --accent: #10b981;
      --cyan: #06b6d4;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    header {
      padding: 14px 20px;
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 16px;
    }
    .container {
      max-width: 1080px;
      margin: 0 auto;
      padding: 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .login-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    input {
      background: #020617;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 13px;
      flex: 1;
      min-width: 180px;
    }
    button, .btn-link {
      background: #1e293b;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 8px 13px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    button.primary {
      background: #059669;
      border-color: #10b981;
    }
    button:hover, .btn-link:hover {
      filter: brightness(1.12);
    }
    .stats-bar {
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 14px;
    }
    .replay-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .replay-card.pinned {
      border-color: rgba(245, 158, 11, 0.55);
    }
    .pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }
    .pill-win { background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .pill-loss { background: rgba(244, 63, 94, 0.18); color: #fb7185; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🛡️ SilphScope PvP • Cloud DVR Replay Vault</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn-link" href="https://sportsfan986.github.io/silphscope-pvp/" target="_blank" rel="noopener">🌐 Web Battle Simulator</a>
      <a class="btn-link" href="https://github.com/sportsfan986/silphscope-pvp/releases" target="_blank" rel="noopener">📱 Download Android APK</a>
    </div>
  </header>

  <div class="container">
    <div class="login-card">
      <input id="inp-user" type="text" placeholder="Trainer / Debug ID (e.g. sportsfan986)" />
      <input id="inp-key" type="password" placeholder="Optional Unlock Key (auto-bound if already verified)" />
      <button class="primary" onclick="loadVault()">🔓 Load My Cloud Replays</button>
    </div>

    <div class="stats-bar" id="stats-bar" style="display:none"></div>
    <div class="grid" id="replays-grid"></div>
  </div>

  <script>
    const CLIENT_KEY = ${JSON.stringify(clientIngestKey || '')};
    const params = new URLSearchParams(window.location.search);
    const savedUser = params.get('user') || localStorage.getItem('sspvp_vault_user') || 'sportsfan986';
    const savedKey = params.get('key') || localStorage.getItem('sspvp_vault_key') || '';
    document.getElementById('inp-user').value = savedUser;
    document.getElementById('inp-key').value = savedKey;

    async function loadVault() {
      const user = document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      if (!user) return alert('Enter your Trainer / Debug ID first.');
      localStorage.setItem('sspvp_vault_user', user);
      if (key) localStorage.setItem('sspvp_vault_key', key);

      const grid = document.getElementById('replays-grid');
      grid.innerHTML = '<div style="color:#94a3b8;padding:20px">Loading Cloud Replay Vault...</div>';

      try {
        const res = await fetch('/v1/replays/list', {
          headers: {
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key
          }
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          grid.innerHTML = '<div style="color:#fb7185;padding:20px">' + (data.error || 'Failed to load vault') + '</div>';
          return;
        }
        const sb = document.getElementById('stats-bar');
        sb.style.display = 'flex';
        const lim = data.limits || {};
        const usg = data.usage || {};
        sb.innerHTML =
          '<div><strong>👤 @' + data.screenName + '</strong> • <span style="color:#38bdf8;font-weight:700">' + (lim.label || data.tier.toUpperCase()) + '</span></div>' +
          '<div style="color:#cbd5e1">☁️ Storage: <strong>' + (usg.usedMb || 0) + ' MB</strong> / ' + (lim.maxStorageMb || 0) + ' MB • Rolling: <strong>' + (usg.rollingCount || 0) + '/' + (lim.maxRollingBattles || 0) + '</strong> • ⭐ Pinned: <strong>' + (usg.pinnedCount || 0) + '/' + (lim.maxPinnedBattles || 0) + '</strong></div>';

        const items = data.items || [];
        if (!items.length) {
          grid.innerHTML = '<div style="color:#94a3b8;padding:20px">No replays stored in your Cloud Vault yet. Record a battle in SilphScope PvP v6.42+ with Auto-DVR enabled!</div>';
          return;
        }
        grid.innerHTML = items.map(item => {
          const isWin = String(item.result || '').toUpperCase().includes('WIN');
          const mb = ((item.totalBytes || item.videoBytes || 0) / (1024 * 1024)).toFixed(1);
          const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
          return '<div class="replay-card ' + (item.isPinned ? 'pinned' : '') + '">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
              '<span class="pill ' + (isWin ? 'pill-win' : 'pill-loss') + '">' + (item.result || 'BATTLE') + ' • ' + (item.league || 'GBL') + '</span>' +
              '<span style="font-size:11px;color:#94a3b8">' + mb + ' MB • ' + (item.durationSec || 0) + 's</span>' +
            '</div>' +
            '<div style="font-weight:800;font-size:13.5px;color:#f1f5f9">' + (item.matchupSummary || item.battleId) + '</div>' +
            '<div style="font-size:11px;color:#64748b">' + dateStr + ' • ID: ' + item.battleId + '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">' +
              '<a class="btn-link" style="background:#059669;border-color:#10b981;flex:1;justify-content:center" href="' + item.shareUrl + '">▶️ Watch + HUD</a>' +
              '<button onclick="togglePin(\\'' + item.battleId + '\\', ' + (!item.isPinned) + ')">' + (item.isPinned ? '⭐ Pinned' : '☆ Pin') + '</button>' +
              '<button onclick="copyLink(\\'' + item.shareUrl + '\\')">🔗 Copy Link</button>' +
            '</div>' +
          '</div>';
        }).join('');
      } catch (e) {
        grid.innerHTML = '<div style="color:#fb7185;padding:20px">Error: ' + e.message + '</div>';
      }
    }

    async function togglePin(battleId, nextPinned) {
      const user = document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      await fetch('/v1/replays/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_KEY,
          'X-Trainer-Screen-Name': user,
          'X-SilphScope-Unlock-Key': key
        },
        body: JSON.stringify({ battleId, isPinned: nextPinned, unlockKey: key })
      });
      loadVault();
    }

    function copyLink(url) {
      navigator.clipboard.writeText(url);
      alert('Copied Share URL: ' + url);
    }

    if (savedUser) loadVault();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-SilphScope-Client-Key, X-Trainer-Screen-Name, X-SilphScope-Unlock-Key, Range',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
        },
      });
    }

    const store = getStorageAdapter(env);

    // 0. Public Cloud DVR Replay Vault Web Portal (`GET /` or `GET /vault`)
    if (request.method === 'GET' && (path === '/' || path === '/vault' || path === '/replays')) {
      return new Response(
        renderVaultDashboardPage(url.origin, (env.CLIENT_INGEST_KEY || '').trim()),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    // 0b. Exact In-App HUD WebView Asset (`GET /overlay.html`)
    if (request.method === 'GET' && path === '/overlay.html') {
      return new Response(OVERLAY_HTML, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 1. Public Health Check
    if (request.method === 'GET' && path === '/v1/health') {
      const r2Stats = await getGlobalR2Stats(env.TELEMETRY_KV);
      const maxGb = Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0;
      return jsonResponse({
        ok: true,
        service: 'silphscope-telemetry-worker',
        version: env.WORKER_VERSION || '2.0.0',
        storageBackend: store.backend,
        r2ReplayBucketBound: Boolean(env.REPLAY_BUCKET),
        r2GlobalUsedMb: Number((r2Stats.totalBytes / (1024 * 1024)).toFixed(2)),
        r2GlobalMaxGb: maxGb,
        r2TotalReplays: r2Stats.totalReplays,
        clientKeyConfigured: Boolean((env.CLIENT_INGEST_KEY || '').trim()),
        adminKeyConfigured: Boolean((env.ADMIN_API_KEY || '').trim()),
        telegramConfigured: Boolean(
          (env.TELEGRAM_BOT_TOKEN || '').trim() && (env.TELEGRAM_CHAT_ID || '').trim()
        ),
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Always-On Lower-Resolution Battle Telemetry Ingest (`POST /v1/telemetry`)
    if (request.method === 'POST' && path === '/v1/telemetry') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      let body;
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON request body.' }, 400);
      }

      const jsonlPayload = typeof body.jsonl === 'string' ? body.jsonl.trim() : '';
      if (!jsonlPayload) {
        return jsonResponse({ ok: false, error: 'Missing or empty `jsonl` field.' }, 400);
      }

      const now = new Date();
      const dateFolder = now.toISOString().slice(0, 10);
      const batchId = sanitizeId(
        body.batchId || `${now.toISOString().replace(/[:.]/g, '-')}_${screenName}`
      );
      const recordCount = Number(body.recordCount) || jsonlPayload.split('\n').filter(Boolean).length;
      const appVersion = String(body.appVersion || 'unknown');
      const versionCode = Number(body.versionCode) || 0;
      const deviceId = sanitizeId(body.deviceId || 'unknown');
      const anomalySummary = String(body.anomalySummary || '');

      const batchKey = `batches/${dateFolder}/${batchId}.jsonl`;
      const userBatchKey = `users/${screenName}/batches/${batchId}.jsonl`;

      const metadata = {
        screenName,
        deviceId,
        appVersion,
        versionCode: String(versionCode),
        recordCount: String(recordCount),
        uploadedAt: now.toISOString(),
      };

      await Promise.all([
        store.put(batchKey, jsonlPayload + '\n', {
          contentType: 'application/x-ndjson',
          metadata,
        }),
        store.put(userBatchKey, jsonlPayload + '\n', {
          contentType: 'application/x-ndjson',
          metadata,
        }),
      ]);

      ctx.waitUntil(
        (async () => {
          await updateManifest(store, (m) => {
            m.totalBatches = (m.totalBatches || 0) + 1;
            m.totalRecords = (m.totalRecords || 0) + recordCount;
            if (!m.users) m.users = {};
            const u = m.users[screenName] || {
              screenName,
              batches: 0,
              records: 0,
              dvrCount: 0,
              lastAppVersion: appVersion,
              lastSeenAt: now.toISOString(),
            };
            u.batches += 1;
            u.records += recordCount;
            u.lastAppVersion = appVersion;
            u.lastSeenAt = now.toISOString();
            m.users[screenName] = u;

            if (!Array.isArray(m.recentBatches)) m.recentBatches = [];
            m.recentBatches.unshift({
              batchId,
              key: batchKey,
              screenName,
              appVersion,
              versionCode,
              recordCount,
              uploadedAt: now.toISOString(),
            });
            if (m.recentBatches.length > 250) m.recentBatches.length = 250;
          });
          // Generic battle telemetry batches do not send Telegram notifications (only 1-Battle DVR videos post to Telegram).
        })()
      );

      return jsonResponse({
        ok: true,
        screenName,
        batchId,
        key: batchKey,
        recordCount,
      });
    }

    // 3. Settings Change History Ingest (`POST /v1/settings-changes`)
    if (request.method === 'POST' && path === '/v1/settings-changes') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      let body;
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON request body.' }, 400);
      }

      const jsonlPayload = typeof body.jsonl === 'string' ? body.jsonl.trim() : '';
      if (!jsonlPayload) {
        return jsonResponse({ ok: false, error: 'Missing or empty `jsonl` field.' }, 400);
      }

      const now = new Date();
      const key = `users/${screenName}/settings_changes/${now.toISOString().replace(/[:.]/g, '-')}.jsonl`;
      await store.put(key, jsonlPayload + '\n', {
        contentType: 'application/x-ndjson',
        metadata: {
          screenName,
          appVersion: String(body.appVersion || 'unknown'),
          uploadedAt: now.toISOString(),
        },
      });

      return jsonResponse({ ok: true, screenName, key });
    }

    // 4. 1-Battle DVR Bundle Ingest (`POST /v1/dvr`)
    if (request.method === 'POST' && path === '/v1/dvr') {
      try {
        const auth = verifyClientAuth(request, env);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
        const { screenName } = auth;

        const contentType = request.headers.get('Content-Type') || '';
        let videoBytes = null;
        let deepTraceText = '';
        let metadata = {};

        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          const videoFile = form.get('video');
          const tracePart = form.get('deep_trace');
          const metaPart = form.get('metadata');

          if (videoFile && typeof videoFile.arrayBuffer === 'function') {
            videoBytes = new Uint8Array(await videoFile.arrayBuffer());
          }
          if (tracePart) {
            deepTraceText =
              typeof tracePart === 'string' ? tracePart : await tracePart.text();
          }
          if (metaPart) {
            const metaStr = typeof metaPart === 'string' ? metaPart : await metaPart.text();
            try {
              metadata = JSON.parse(metaStr);
            } catch (_) {
              metadata = {};
            }
          }
        } else {
          let body;
          try {
            body = await request.json();
          } catch (_) {
            return jsonResponse({ ok: false, error: 'Invalid DVR request payload.' }, 400);
          }
          metadata = body.metadata || {};
          deepTraceText = String(body.deepTraceJsonl || '');
          if (typeof body.videoBase64 === 'string' && body.videoBase64.length > 0) {
            const binaryStr = atob(body.videoBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            videoBytes = bytes;
          }
        }

        const hasVideo = Boolean(videoBytes && videoBytes.byteLength > 0);
        const hasTrace = Boolean(deepTraceText && deepTraceText.trim().length > 0);
        if (!hasVideo && !hasTrace) {
          return jsonResponse({ ok: false, error: 'Missing DVR video and trace payload.' }, 400);
        }

        const now = new Date();
        const battleId = sanitizeId(
          metadata.battleId || `dvr_${now.getTime()}`,
          `dvr_${now.getTime()}`
        );
        const appVersion = String(metadata.appVersion || 'unknown');
        const versionCode = Number(metadata.versionCode) || 0;
        const league = String(metadata.league || 'Unknown League');
        const result = String(metadata.result || 'UNKNOWN');
        const matchupSummary = resolveFullTeamMatchupSummary(metadata, deepTraceText);
        const frameCount = Number(metadata.frameCount) || 0;

        const videoKey = `recordings/${screenName}/${battleId}_video.mp4`;
        const traceKey = `recordings/${screenName}/${battleId}_deep_trace.jsonl`;
        const videoByteLen = hasVideo ? videoBytes.byteLength : 0;

        const storeMeta = {
          screenName,
          battleId,
          appVersion,
          versionCode: String(versionCode),
          league,
          result,
          frameCount: String(frameCount),
          uploadedAt: now.toISOString(),
        };

        if (hasTrace) {
          await store.put(traceKey, deepTraceText.trim() + '\n', {
            contentType: 'application/x-ndjson',
            metadata: storeMeta,
          });
        }

        if (hasVideo) {
          await store.put(videoKey, videoBytes, {
            contentType: 'video/mp4',
            metadata: storeMeta,
          });
        }

        ctx.waitUntil(
          (async () => {
            try {
              await updateManifest(store, (m) => {
                m.totalDvrRecordings = (m.totalDvrRecordings || 0) + 1;
                if (!m.users) m.users = {};
                const u = m.users[screenName] || {
                  screenName,
                  batches: 0,
                  records: 0,
                  dvrCount: 0,
                  lastAppVersion: appVersion,
                  lastSeenAt: now.toISOString(),
                };
                u.dvrCount = (u.dvrCount || 0) + 1;
                u.lastAppVersion = appVersion;
                u.lastSeenAt = now.toISOString();
                m.users[screenName] = u;

                if (!Array.isArray(m.recentDvr)) m.recentDvr = [];
                m.recentDvr.unshift({
                  battleId,
                  screenName,
                  videoKey: hasVideo ? videoKey : null,
                  traceKey: hasTrace ? traceKey : null,
                  videoBytes: videoByteLen,
                  frameCount,
                  appVersion,
                  versionCode,
                  league,
                  result,
                  matchupSummary,
                  uploadedAt: now.toISOString(),
                });
                if (m.recentDvr.length > 250) m.recentDvr.length = 250;
              });
            } catch (e) {
              console.error('Manifest update error:', e);
            }

            if (hasVideo && videoByteLen <= 48 * 1024 * 1024) {
              try {
                const userIssueNote = String(metadata.userIssueNote || '').trim();
                const uploadReason = String(metadata.uploadReason || '').trim();
                const caption =
                  `🎬 <b>SilphScope 1-Battle DVR</b>\n` +
                  `👤 <b>Trainer:</b> <code>${escapeHtml(screenName)}</code>\n` +
                  `🏆 <b>League:</b> ${escapeHtml(league)} (${escapeHtml(result)})\n` +
                  (matchupSummary ? `⚔️ <b>Matchup:</b> ${escapeHtml(matchupSummary)}\n` : '') +
                  (userIssueNote ? `🚩 <b>Issue Report:</b> ${escapeHtml(userIssueNote)}\n` : '') +
                  (uploadReason ? `📌 <b>Trigger:</b> ${escapeHtml(uploadReason)}\n` : '') +
                  `🎞️ <b>Frames:</b> ${frameCount} | <b>Size:</b> ${(videoByteLen / (1024 * 1024)).toFixed(2)} MB\n` +
                  `📱 <b>App:</b> <code>v${escapeHtml(appVersion)} (${versionCode})</code>\n` +
                  `🆔 <code>${escapeHtml(battleId)}</code>`;

                await sendTelegramVideo(env, videoBytes, `${screenName}_${battleId}.mp4`, caption);
              } catch (e) {
                console.error('Telegram video send error:', e);
              }
            }
          })()
        );

        return jsonResponse({
          ok: true,
          screenName,
          battleId,
          videoKey: hasVideo ? videoKey : null,
          traceKey: hasTrace ? traceKey : null,
          videoBytes: videoByteLen,
        });
      } catch (err) {
        console.error('POST /v1/dvr error:', err);
        return jsonResponse(
          {
            ok: false,
            error: String((err && err.message) || err || 'Internal Worker Error'),
          },
          500
        );
      }
    }

    // 5. License / Unlock Key Verification & Multi-Device Sync (`POST /v1/license/verify`)
    if (request.method === 'POST' && path === '/v1/license/verify') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const inputKey = String(
        body.unlockKey || body.key || request.headers.get('X-SilphScope-Unlock-Key') || ''
      ).trim();

      const licenseInfo = await resolveUserLicense(env.TELEMETRY_KV, screenName, inputKey);
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);
      const usage = await enforceUserReplayQuota(
        env,
        env.TELEMETRY_KV,
        screenName,
        licenseInfo,
        indexObj
      );
      await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);
      const globalStats = await getGlobalR2Stats(env.TELEMETRY_KV);

      return jsonResponse({
        ok: true,
        screenName,
        tier: licenseInfo.tier,
        active: licenseInfo.active,
        error: licenseInfo.error || null,
        license: licenseInfo,
        limits: licenseInfo,
        usage,
        globalR2: {
          usedMb: Number((globalStats.totalBytes / (1024 * 1024)).toFixed(2)),
          maxGb: Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0,
          totalReplays: globalStats.totalReplays,
        },
      });
    }

    // 6. Buy Me a Coffee Automated Key Webhook (`POST /v1/webhooks/bmc`)
    if (request.method === 'POST' && path === '/v1/webhooks/bmc') {
      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
      }

      const data = body.data || body || {};
      const amount = Number(data.amount || data.support_coffee_price || 0);
      const levelName = String(data.membership_level_name || data.title || '').toLowerCase();
      const supporterName = String(data.supporter_name || data.payer_name || 'Supporter').trim();
      const supporterEmail = String(data.supporter_email || data.payer_email || '').trim();
      const supportNote = String(data.support_note || data.message || '').trim();

      const tier =
        amount >= 8 || levelName.includes('pro') || levelName.includes('legend') ? 'pro' : 'base';
      const preset = TIER_PRESETS[tier];
      const newKey = generateUnlockKey(tier);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 35 * 24 * 3600 * 1000).toISOString();

      let boundScreenName = '';
      const idMatch = supportNote.match(/(?:trainer|id|user|name)\s*[:=-]?\s*([A-Za-z0-9_.-]{3,36})/i);
      if (idMatch && idMatch[1]) {
        boundScreenName = sanitizeScreenName(idMatch[1]);
      }

      const licenseRecord = {
        key: newKey,
        tier,
        label: preset.label,
        boundScreenName,
        supporterName,
        supporterEmail,
        supportNote,
        createdAt: now.toISOString(),
        expiresAt,
        revoked: false,
        source: 'bmc_webhook',
      };

      await saveLicenseRecord(env.TELEMETRY_KV, licenseRecord);

      ctx.waitUntil(
        sendTelegramMessage(
          env,
          `☕ <b>New Buy Me a Coffee Replay Key Minted!</b>\n` +
            `👤 <b>Supporter:</b> ${escapeHtml(supporterName)} (${escapeHtml(supporterEmail || 'no-email')})\n` +
            `🏅 <b>Tier:</b> <code>${escapeHtml(preset.label)} (${tier.toUpperCase()})</code>\n` +
            `🔑 <b>Unlock Key:</b> <code>${escapeHtml(newKey)}</code>\n` +
            (boundScreenName ? `🎮 <b>Auto-Bound Trainer ID:</b> <code>${escapeHtml(boundScreenName)}</code>\n` : '') +
            (supportNote ? `💬 <b>Note:</b> ${escapeHtml(supportNote)}` : '')
        )
      );

      return jsonResponse({
        ok: true,
        tier,
        unlockKey: newKey,
        boundScreenName: boundScreenName || null,
        expiresAt,
      });
    }

    // 7. Cloud R2 Replay Vault Upload (`POST /v1/replays/upload`)
    if (request.method === 'POST' && path === '/v1/replays/upload') {
      try {
        const auth = verifyClientAuth(request, env);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
        const { screenName } = auth;

        if (!env.REPLAY_BUCKET) {
          return jsonResponse({ ok: false, error: 'R2 Replay Bucket not bound on Worker.' }, 503);
        }

        const contentType = request.headers.get('Content-Type') || '';
        let videoBytes = null;
        let deepTraceText = '';
        let metadata = {};

        if (contentType.includes('multipart/form-data')) {
          const form = await request.formData();
          const videoFile = form.get('video');
          const tracePart = form.get('deep_trace');
          const metaPart = form.get('metadata');

          if (videoFile && typeof videoFile.arrayBuffer === 'function') {
            videoBytes = new Uint8Array(await videoFile.arrayBuffer());
          }
          if (tracePart) {
            deepTraceText = typeof tracePart === 'string' ? tracePart : await tracePart.text();
          }
          if (metaPart) {
            const metaStr = typeof metaPart === 'string' ? metaPart : await metaPart.text();
            try {
              metadata = JSON.parse(metaStr);
            } catch (_) {
              metadata = {};
            }
          }
        } else {
          let body;
          try {
            body = await request.json();
          } catch (_) {
            return jsonResponse({ ok: false, error: 'Invalid Replay request payload.' }, 400);
          }
          metadata = body.metadata || {};
          deepTraceText = String(body.deepTraceJsonl || '');
          if (typeof body.videoBase64 === 'string' && body.videoBase64.length > 0) {
            const binaryStr = atob(body.videoBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            videoBytes = bytes;
          }
        }

        const inputKey = String(
          metadata.unlockKey || request.headers.get('X-SilphScope-Unlock-Key') || ''
        ).trim();
        const licenseInfo = await resolveUserLicense(env.TELEMETRY_KV, screenName, inputKey);
        if (!licenseInfo.active || licenseInfo.tier === 'free') {
          return jsonResponse(
            {
              ok: false,
              error: 'Active Replay Unlock Key required for Cloud R2 Replay Vault storage.',
              tier: 'free',
            },
            403
          );
        }

        const hasVideo = Boolean(videoBytes && videoBytes.byteLength > 0);
        const hasTrace = Boolean(deepTraceText && deepTraceText.trim().length > 0);
        if (!hasVideo) {
          return jsonResponse({ ok: false, error: 'Missing MP4 video payload for Replay Vault.' }, 400);
        }

        const traceBytesLen = hasTrace ? new TextEncoder().encode(deepTraceText).byteLength : 0;
        const incomingBytes = videoBytes.byteLength + traceBytesLen;

        // Enforce 9.0 GB Global R2 Hard Cap so Cloudflare costs remain $0.00
        const maxGlobalGb = Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0;
        const maxGlobalBytes = maxGlobalGb * 1024 * 1024 * 1024;
        const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);

        let globalStats = await getGlobalR2Stats(env.TELEMETRY_KV);
        if (globalStats.totalBytes + incomingBytes > maxGlobalBytes) {
          return jsonResponse(
            {
              ok: false,
              error: `Global Cloud Replay Vault safety cap (${maxGlobalGb} GB) reached. Zero-overage guard active.`,
            },
            507
          );
        }

        const now = new Date();
        const battleId = sanitizeId(
          metadata.battleId || `dvr_${now.getTime()}`,
          `dvr_${now.getTime()}`
        );
        const existingItem = (indexObj.items || []).find((i) => i.battleId === battleId);
        const shareId = existingItem && existingItem.shareId ? existingItem.shareId : generateShareId();

        const videoKey = `replays/${screenName}/${battleId}_video.mp4`;
        const traceKey = `replays/${screenName}/${battleId}_deep_trace.jsonl`;
        const league = String(metadata.league || 'GBL');
        const result = String(metadata.result || 'BATTLE');
        const matchupSummary = resolveFullTeamMatchupSummary(metadata, deepTraceText);
        const frameCount = Number(metadata.frameCount) || 0;
        const durationSec = Number(metadata.durationSec) || Math.round(frameCount / 10);
        const appVersion = String(metadata.appVersion || '6.42');
        const isPinned = Boolean(
          metadata.isPinned !== undefined ? metadata.isPinned : existingItem && existingItem.isPinned
        );
        const hideNames = Boolean(
          metadata.hideNames !== undefined ? metadata.hideNames : existingItem && existingItem.hideNames
        );

        await env.REPLAY_BUCKET.put(videoKey, videoBytes, {
          httpMetadata: { contentType: 'video/mp4' },
          customMetadata: { screenName, battleId, shareId },
        });
        if (hasTrace) {
          await env.REPLAY_BUCKET.put(traceKey, deepTraceText.trim() + '\n', {
            httpMetadata: { contentType: 'application/x-ndjson' },
            customMetadata: { screenName, battleId, shareId },
          });
        }

        const prevBytes = existingItem ? Number(existingItem.totalBytes) || 0 : 0;
        const prevCountDelta = existingItem ? 0 : 1;

        const replayEntry = {
          battleId,
          shareId,
          screenName,
          videoKey,
          traceKey: hasTrace ? traceKey : null,
          videoBytes: videoBytes.byteLength,
          traceBytes: traceBytesLen,
          totalBytes: incomingBytes,
          league,
          result,
          matchupSummary,
          frameCount,
          durationSec,
          appVersion,
          isPinned,
          hideNames,
          createdAt: existingItem && existingItem.createdAt ? existingItem.createdAt : now.toISOString(),
          uploadedAt: existingItem && existingItem.uploadedAt ? existingItem.uploadedAt : now.toISOString(),
          updatedAt: now.toISOString(),
        };

        indexObj.items = [
          replayEntry,
          ...(indexObj.items || []).filter((i) => i.battleId !== battleId),
        ];

        await adjustGlobalR2Stats(
          env.TELEMETRY_KV,
          incomingBytes - prevBytes,
          prevCountDelta
        );

        await env.TELEMETRY_KV.put(`share_lookup/${shareId}`, JSON.stringify(replayEntry));

        const usage = await enforceUserReplayQuota(
          env,
          env.TELEMETRY_KV,
          screenName,
          licenseInfo,
          indexObj
        );
        await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);

        return jsonResponse({
          ok: true,
          screenName,
          battleId,
          shareId,
          shareUrl: `${url.origin}/watch/${shareId}`,
          tier: licenseInfo.tier,
          isPinned,
          usage,
        });
      } catch (err) {
        console.error('POST /v1/replays/upload error:', err);
        return jsonResponse(
          { ok: false, error: String((err && err.message) || err || 'Upload error') },
          500
        );
      }
    }

    // 8. List User's Cloud R2 Replays (`GET /v1/replays/list`)
    if (request.method === 'GET' && path === '/v1/replays/list') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      const inputKey = String(request.headers.get('X-SilphScope-Unlock-Key') || '').trim();
      const licenseInfo = await resolveUserLicense(env.TELEMETRY_KV, screenName, inputKey);
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);
      const usage = await enforceUserReplayQuota(
        env,
        env.TELEMETRY_KV,
        screenName,
        licenseInfo,
        indexObj
      );
      await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);

      return jsonResponse({
        ok: true,
        screenName,
        tier: licenseInfo.tier,
        active: licenseInfo.active,
        limits: licenseInfo,
        usage,
        items: (indexObj.items || []).map((item) => ({
          ...item,
          shareUrl: `${url.origin}/watch/${item.shareId}`,
          videoStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/video.mp4`,
          traceStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/trace.jsonl`,
        })),
      });
    }

    // 9. Pin / Unpin or Toggle Privacy on a Cloud Replay (`POST /v1/replays/pin`)
    if (request.method === 'POST' && path === '/v1/replays/pin') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
      }

      const targetBattleId = String(body.battleId || '').trim();
      const targetShareId = String(body.shareId || '').trim();
      const licenseInfo = await resolveUserLicense(env.TELEMETRY_KV, screenName, body.unlockKey || '');
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);

      const item = (indexObj.items || []).find(
        (i) =>
          (targetBattleId && i.battleId === targetBattleId) ||
          (targetShareId && i.shareId === targetShareId)
      );
      if (!item) {
        return jsonResponse({ ok: false, error: 'Replay not found in Cloud Vault.' }, 404);
      }

      if (typeof body.isPinned === 'boolean') {
        if (body.isPinned && !item.isPinned) {
          const currentPinned = (indexObj.items || []).filter((i) => i.isPinned).length;
          if (currentPinned >= licenseInfo.maxPinnedBattles) {
            return jsonResponse(
              {
                ok: false,
                error: `Pin limit reached (${licenseInfo.maxPinnedBattles} pinned battles max for ${licenseInfo.label}).`,
              },
              400
            );
          }
        }
        item.isPinned = body.isPinned;
      }

      if (typeof body.hideNames === 'boolean') {
        item.hideNames = body.hideNames;
      }

      item.updatedAt = new Date().toISOString();
      await env.TELEMETRY_KV.put(`share_lookup/${item.shareId}`, JSON.stringify(item));
      await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);

      return jsonResponse({
        ok: true,
        battleId: item.battleId,
        shareId: item.shareId,
        isPinned: item.isPinned,
        hideNames: item.hideNames,
        shareUrl: `${url.origin}/watch/${item.shareId}`,
      });
    }

    // 10. Delete a Cloud Replay (`DELETE /v1/replays/delete`)
    if (request.method === 'DELETE' && path === '/v1/replays/delete') {
      const auth = verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      const targetBattleId = url.searchParams.get('battleId') || '';
      const targetShareId = url.searchParams.get('shareId') || '';
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);
      const idx = (indexObj.items || []).findIndex(
        (i) =>
          (targetBattleId && i.battleId === targetBattleId) ||
          (targetShareId && i.shareId === targetShareId)
      );
      if (idx === -1) {
        return jsonResponse({ ok: false, error: 'Replay not found.' }, 404);
      }
      const [removed] = indexObj.items.splice(idx, 1);
      await deleteReplayObjects(env, env.TELEMETRY_KV, removed);
      await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);

      return jsonResponse({ ok: true, deletedBattleId: removed.battleId, deletedShareId: removed.shareId });
    }

    // 11. Public Capability-URL Video & Trace Streaming (`GET /v1/replays/stream/:shareId/:asset`)
    if (request.method === 'GET' && path.startsWith('/v1/replays/stream/')) {
      const parts = path.split('/').filter(Boolean); // ['v1','replays','stream', shareId, asset]
      const shareId = sanitizeId(parts[3] || '');
      const asset = parts[4] || '';
      if (!shareId || !env.REPLAY_BUCKET) {
        return jsonResponse({ ok: false, error: 'Invalid stream URL.' }, 404);
      }

      const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${shareId}`);
      if (!rawLookup) {
        return jsonResponse({ ok: false, error: 'Replay expired or not found.' }, 404);
      }
      const shareInfo = JSON.parse(rawLookup);

      if (asset === 'video.mp4') {
        const rangeHeader = request.headers.get('Range');
        if (rangeHeader && rangeHeader.startsWith('bytes=')) {
          const headObj = await env.REPLAY_BUCKET.head(shareInfo.videoKey);
          if (!headObj) return new Response('Video not found', { status: 404 });
          const totalSize = headObj.size;
          const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
          const start = Math.max(0, parseInt(startStr, 10) || 0);
          const end = endStr ? Math.min(totalSize - 1, parseInt(endStr, 10)) : totalSize - 1;
          const length = Math.max(0, end - start + 1);

          const rangedObj = await env.REPLAY_BUCKET.get(shareInfo.videoKey, {
            range: { offset: start, length },
          });
          if (!rangedObj) return new Response('Range not satisfiable', { status: 416 });

          return new Response(rangedObj.body, {
            status: 206,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(length),
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        const fullObj = await env.REPLAY_BUCKET.get(shareInfo.videoKey);
        if (!fullObj) return new Response('Video not found', { status: 404 });
        return new Response(fullObj.body, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Accept-Ranges': 'bytes',
            'Content-Length': String(fullObj.size),
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      if (asset === 'trace.jsonl') {
        if (!shareInfo.traceKey) return new Response('', { status: 200 });
        const traceObj = await env.REPLAY_BUCKET.get(shareInfo.traceKey);
        if (!traceObj) return new Response('', { status: 404 });
        let text = await traceObj.text();
        if (shareInfo.hideNames || url.searchParams.get('hideNames') === '1') {
          text = text.replace(new RegExp(shareInfo.screenName, 'gi'), 'Trainer');
        }
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // 12. Public Web Share Player (`GET /watch/:shareId`)
    if (request.method === 'GET' && path.startsWith('/watch/')) {
      const shareId = sanitizeId(path.slice('/watch/'.length).split('/')[0] || '');
      if (!shareId) return new Response('Invalid Share Link', { status: 404 });
      const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${shareId}`);
      if (!rawLookup) {
        return new Response(
          `<!DOCTYPE html><html><body style="background:#070b14;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center"><h2>🛡️ SilphScope PvP Replay Expired or Not Found</h2><p>This replay link (<code>${escapeHtml(shareId)}</code>) has expired or was removed by the trainer.</p></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
      const shareInfo = JSON.parse(rawLookup);
      return new Response(renderWatchSharePage(url.origin, shareInfo), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 13. Admin Endpoints for PC Ingestion Script & Key Manager (`scripts/ingest-telemetry.mjs` & `scripts/manage-keys.mjs`)
    if (path.startsWith('/v1/admin/')) {
      const adminAuth = verifyAdminAuth(request, env);
      if (!adminAuth.ok) return jsonResponse({ ok: false, error: adminAuth.error }, adminAuth.status);

      if (request.method === 'GET' && path === '/v1/admin/keys') {
        const listed = await env.TELEMETRY_KV.list({ prefix: 'licenses/' });
        const keys = [];
        for (const k of listed.keys || []) {
          const raw = await env.TELEMETRY_KV.get(k.name);
          if (raw) {
            try {
              keys.push(JSON.parse(raw));
            } catch (_) {}
          }
        }
        const globalR2 = await getGlobalR2Stats(env.TELEMETRY_KV);
        return jsonResponse({
          ok: true,
          count: keys.length,
          globalR2: {
            ...globalR2,
            usedMb: Number((globalR2.totalBytes / (1024 * 1024)).toFixed(2)),
            maxGb: Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0,
          },
          keys,
        });
      }

      if (request.method === 'POST' && path === '/v1/admin/keys') {
        let body = {};
        try {
          body = await request.json();
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }
        const action = String(body.action || 'create').toLowerCase();

        if (action === 'create') {
          const tier = ['base', 'pro', 'vip'].includes(String(body.tier || '').toLowerCase())
            ? String(body.tier).toLowerCase()
            : 'pro';
          const preset = TIER_PRESETS[tier];
          const key = body.customKey ? String(body.customKey).trim().toUpperCase() : generateUnlockKey(tier);
          const boundScreenName = body.screenName ? sanitizeScreenName(body.screenName) : '';
          const days = Number(body.days) || (tier === 'vip' ? 3650 : 35);
          const now = new Date();
          const expiresAt = new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();

          const record = {
            key,
            tier,
            label: preset.label,
            boundScreenName,
            note: String(body.note || ''),
            createdAt: now.toISOString(),
            expiresAt,
            revoked: false,
            source: 'admin_cli',
          };
          await saveLicenseRecord(env.TELEMETRY_KV, record);
          return jsonResponse({ ok: true, action: 'create', license: record, limits: preset });
        }

        if (action === 'revoke' || action === 'extend') {
          const targetKey = String(body.key || '').trim().toUpperCase();
          const existing = await loadLicenseByKey(env.TELEMETRY_KV, targetKey);
          if (!existing) {
            return jsonResponse({ ok: false, error: `Key not found: ${targetKey}` }, 404);
          }
          if (action === 'revoke') {
            existing.revoked = true;
            existing.revokedAt = new Date().toISOString();
          } else if (action === 'extend') {
            const extraDays = Number(body.days) || 30;
            const baseTime = existing.expiresAt ? Math.max(Date.now(), Date.parse(existing.expiresAt)) : Date.now();
            existing.expiresAt = new Date(baseTime + extraDays * 24 * 3600 * 1000).toISOString();
            existing.revoked = false;
          }
          if (body.tier && TIER_PRESETS[body.tier]) {
            existing.tier = body.tier;
            existing.label = TIER_PRESETS[body.tier].label;
          }
          if (body.screenName) {
            existing.boundScreenName = sanitizeScreenName(body.screenName);
          }
          await saveLicenseRecord(env.TELEMETRY_KV, existing);
          return jsonResponse({ ok: true, action, license: existing });
        }

        return jsonResponse({ ok: false, error: `Unknown action: ${action}` }, 400);
      }

      if (request.method === 'GET' && path === '/v1/admin/manifest') {
        const text = await store.getText('manifest.json');
        if (!text) {
          return jsonResponse({
            schemaVersion: 2,
            totalBatches: 0,
            totalRecords: 0,
            totalDvrRecordings: 0,
            users: {},
            recentBatches: [],
            recentDvr: [],
          });
        }
        return new Response(text, {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
      }

      if (request.method === 'GET' && path === '/v1/admin/list') {
        const prefix = url.searchParams.get('prefix') || '';
        const cursor = url.searchParams.get('cursor') || undefined;
        const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);
        const listed = await store.list({ prefix, cursor, limit });
        return jsonResponse({
          ok: true,
          ...listed,
        });
      }

      if (request.method === 'GET' && path === '/v1/admin/object') {
        const key = url.searchParams.get('key') || '';
        if (!key) return jsonResponse({ ok: false, error: 'Missing `key` query parameter.' }, 400);
        const resp = await store.getResponse(key);
        if (!resp) return jsonResponse({ ok: false, error: `Object not found: ${key}` }, 404);
        return resp;
      }

      if (request.method === 'DELETE' && path === '/v1/admin/object') {
        const key = url.searchParams.get('key') || '';
        if (!key) return jsonResponse({ ok: false, error: 'Missing `key` query parameter.' }, 400);
        await store.delete(key);
        return jsonResponse({ ok: true, deleted: key });
      }
    }

    return jsonResponse({ ok: false, error: `Route not found: ${request.method} ${path}` }, 404);
  },
};
