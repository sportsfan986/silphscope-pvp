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
      left: 6px;
      right: 6px;
      bottom: 44px;
      background: rgba(8, 12, 22, 0.88);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 10px;
      padding: 6px;
      pointer-events: auto;
      backdrop-filter: blur(4px);
      transition: top 0.2s, bottom 0.2s, opacity 0.15s;
      font-size: 11px;
    }
    .hud-layer.pos-top {
      top: 26px;
      bottom: auto;
    }
    .stage-wrap.side-by-side .hud-layer {
      position: static;
      width: min(100%, 420px);
      background: var(--card);
      border-color: var(--border);
      padding: 12px;
      align-self: stretch;
    }
    .hud-header {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 6px;
      padding-bottom: 5px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }
    .side-stat {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      font-weight: 700;
    }
    .hp-pill {
      padding: 1px 5px;
      border-radius: 4px;
      font-weight: 800;
      font-size: 11px;
    }
    .coach-box {
      margin-top: 5px;
      padding: 5px 7px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.9);
      border-left: 3px solid var(--accent);
      font-weight: 700;
      line-height: 1.35;
    }
    .matrix-grid {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .matrix-cell {
      background: rgba(30, 41, 59, 0.75);
      border: 1px solid rgba(71, 85, 105, 0.5);
      border-radius: 5px;
      padding: 4px;
      text-align: center;
    }
    .matrix-cell.active-pair {
      border-color: var(--cyan);
      background: rgba(6, 182, 212, 0.16);
    }
    .diag-box {
      margin-top: 5px;
      padding: 5px;
      border-radius: 5px;
      background: rgba(2, 6, 23, 0.92);
      border: 1px dashed #64748b;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: #cbd5e1;
      white-space: pre-wrap;
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
        <div class="hud-layer" id="hud-layer">
          <div class="hud-header" id="hud-header">
            <div class="side-stat">
              <span id="u-name">User</span>
              <span class="hp-pill" id="u-hp" style="background:#065f46;color:#6ee7b7">100%</span>
              <span id="u-e" style="color:#38bdf8">0E</span>
              <span id="u-sh">🛡️2</span>
            </div>
            <div style="font-size:10px;color:#94a3b8;font-weight:800" id="f-clock">F#0000 0.0s</div>
            <div class="side-stat" style="justify-content:flex-end">
              <span id="o-sh">2🛡️</span>
              <span id="o-e" style="color:#f59e0b">0E</span>
              <span class="hp-pill" id="o-hp" style="background:#065f46;color:#6ee7b7">100%</span>
              <span id="o-name">Opponent</span>
            </div>
          </div>
          <div class="coach-box" id="hud-coach">Loading frame-synced battle telemetry...</div>
          <div class="matrix-grid" id="hud-matrix"></div>
          <div class="diag-box" id="hud-diag" style="display:none"></div>
        </div>
      </div>
    </div>

    <div class="controls-bar">
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
          <button onclick="toggleHudPos()" id="btn-pos">⬇️ Bottom</button>
          <input type="range" id="hud-opacity" min="30" max="100" value="90" style="width:65px" title="HUD Opacity" oninput="updateOpacity(this.value)" />
        </div>
      </div>
      <div class="chips-row" id="event-chips"></div>
    </div>
  </main>

  <script>
    const TRACE_URL = ${JSON.stringify(traceUrl)};
    let hideNames = ${JSON.stringify(hideNamesDefault)};
    const rawTrainerName = ${JSON.stringify(shareInfo.screenName || 'Trainer')};
    let frames = [];
    let summaryHeader = null;
    let hudMode = 'live';
    let hudTop = false;
    let sideBySide = false;

    const video = document.getElementById('replay-video');
    const hudLayer = document.getElementById('hud-layer');
    const stageWrap = document.getElementById('stage-wrap');

    video.addEventListener('play', () => { document.getElementById('btn-play').textContent = '⏸ Pause'; });
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
      document.getElementById('hud-matrix').style.display = m === 'live' ? 'grid' : 'none';
      document.getElementById('hud-diag').style.display = m === 'diag' ? 'block' : 'none';
      syncHudFrame();
    }
    function toggleHudPos() {
      hudTop = !hudTop;
      hudLayer.classList.toggle('pos-top', hudTop);
      document.getElementById('btn-pos').textContent = hudTop ? '⬆️ Top' : '⬇️ Bottom';
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
    }

    function hpStyle(pct) {
      if (pct < 0) return { bg: '#334155', fg: '#94a3b8', txt: '--%' };
      if (pct > 50) return { bg: '#065f46', fg: '#6ee7b7', txt: pct + '%' };
      if (pct >= 20) return { bg: '#78350f', fg: '#fde68a', txt: pct + '%' };
      return { bg: '#7f1d1d', fg: '#fecaca', txt: pct + '%' };
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
      document.getElementById('f-clock').textContent = 'F#' + String(f.frameIdx || 0).padStart(4, '0') + ' ' + ((f.relTimeMs || 0) / 1000).toFixed(1) + 's';
      document.getElementById('u-name').textContent = (f.userActiveSpecies || 'User').slice(0, 14);
      document.getElementById('o-name').textContent = (f.oppActiveSpecies || 'Opponent').slice(0, 14);
      const uHp = hpStyle(f.userHpPct ?? -1);
      const oHp = hpStyle(f.oppHpPct ?? -1);
      const uEl = document.getElementById('u-hp');
      uEl.style.background = uEl.style.backgroundColor = uHp.bg;
      uEl.style.color = uHp.fg;
      uEl.textContent = uHp.txt;
      const oEl = document.getElementById('o-hp');
      oEl.style.background = oEl.style.backgroundColor = oHp.bg;
      oEl.style.color = oHp.fg;
      oEl.textContent = oHp.txt;
      document.getElementById('u-e').textContent = (f.userEnergy ?? 0) + 'E';
      document.getElementById('o-e').textContent = (f.oppEnergy ?? 0) + 'E';
      document.getElementById('u-sh').textContent = '🛡️' + (f.userShields ?? 2);
      document.getElementById('o-sh').textContent = (f.oppShields ?? 2) + '🛡️';

      const coach = document.getElementById('hud-coach');
      if (f.moveBannerText) {
        coach.style.borderLeftColor = '#f59e0b';
        coach.textContent = '⚡ ' + f.moveBannerText;
      } else if (f.zoomPhase && f.zoomPhase !== 'NONE') {
        coach.style.borderLeftColor = '#f43f5e';
        coach.textContent = '🎬 Cutscene / Zoom Phase: ' + f.zoomPhase;
      } else {
        coach.style.borderLeftColor = '#10b981';
        coach.textContent = '⚔️ ' + (f.userActiveSpecies || 'User') + ' (' + (f.userEnergy || 0) + 'E) vs ' + (f.oppActiveSpecies || 'Opponent') + ' (' + (f.oppEnergy || 0) + 'E) • Swap: U ' + Math.ceil((f.userSwitchClockMs || 0)/1000) + 's / O ' + Math.ceil((f.oppSwitchClockMs || 0)/1000) + 's';
      }

      if (hudMode === 'live') {
        const uSpecs = (summaryHeader && summaryHeader.userTeamSpecs) || [];
        const oSpecs = (summaryHeader && summaryHeader.oppTeamSpecs) || [];
        const uSlotHp = f.userSlotHpPct || [];
        const oSlotHp = f.oppSlotHpPct || [];
        const uSlotE = f.userSlotEnergy || [];
        const oSlotE = f.oppSlotEnergy || [];
        let html = '';
        for (let i = 0; i < 3; i++) {
          const uSp = (uSpecs[i] && uSpecs[i].species) || (i === f.userActiveIndex ? f.userActiveSpecies : 'Slot ' + (i+1));
          const oSp = (oSpecs[i] && oSpecs[i].species) || (i === f.oppActiveIndex ? f.oppActiveSpecies : 'Opp ' + (i+1));
          const uH = uSlotHp[i] !== undefined ? uSlotHp[i] : (i === f.userActiveIndex ? f.userHpPct : -1);
          const oH = oSlotHp[i] !== undefined ? oSlotHp[i] : (i === f.oppActiveIndex ? f.oppHpPct : -1);
          const uEn = uSlotE[i] !== undefined ? uSlotE[i] : (i === f.userActiveIndex ? f.userEnergy : 0);
          const oEn = oSlotE[i] !== undefined ? oSlotE[i] : (i === f.oppActiveIndex ? f.oppEnergy : 0);
          const isAct = i === f.userActiveIndex;
          html += '<div class="matrix-cell ' + (isAct ? 'active-pair' : '') + '">' +
            '<div style="font-weight:800;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + uSp + '</div>' +
            '<div style="font-size:10px;color:#94a3b8">HP: ' + (uH >= 0 ? uH + '%' : '--') + ' • ' + uEn + 'E</div>' +
            '<div style="margin-top:3px;border-top:1px solid #334155;padding-top:2px;font-weight:700;color:#fca5a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">vs ' + oSp + '</div>' +
            '<div style="font-size:10px;color:#94a3b8">HP: ' + (oH >= 0 ? oH + '%' : '--') + ' • ' + oEn + 'E</div>' +
            '</div>';
        }
        document.getElementById('hud-matrix').innerHTML = html;
      }

      if (hudMode === 'diag') {
        document.getElementById('hud-diag').textContent =
          'RAW HP: U=' + (f.rawUserHpPct ?? -1) + '% (commit ' + (f.userHpPct ?? -1) + '%) | O=' + (f.rawOppHpPct ?? -1) + '% (commit ' + (f.oppHpPct ?? -1) + '%)\n' +
          'CIRCLE: ' + (f.circleFillPct ?? -1) + '% | ZOOM: ' + (f.zoomPhase || 'NONE') + ' | SampledHP=' + Boolean(f.hpSampledThisTick) + '\n' +
          'OCR TL: ' + JSON.stringify((f.ocrTopLeftText || '').replace(/\n/g, ' ')) + ' | TR: ' + JSON.stringify((f.ocrTopRightText || '').replace(/\n/g, ' '));
      }
    }

    video.addEventListener('timeupdate', syncHudFrame);
    video.addEventListener('seeked', syncHudFrame);

    async function loadTrace() {
      try {
        const res = await fetch(TRACE_URL);
        if (!res.ok) return;
        const text = await res.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const parsed = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.recordType === 'BATTLE_DVR_SUMMARY_HEADER') {
              summaryHeader = obj.battleSummary || null;
            } else if (typeof obj.frameIdx === 'number') {
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
              ctx.fillText(document.getElementById('hud-coach').textContent.slice(0, 62), 24, y + 66);
              ctx.fillStyle = '#94a3b8';
              ctx.font = '12px monospace';
              ctx.fillText(document.getElementById('f-clock').textContent + ' • SilphScope PvP', 24, y + 94);
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
