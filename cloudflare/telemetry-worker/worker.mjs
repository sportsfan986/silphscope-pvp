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
 * 3. Ingests 1-Battle DVR Video + Deep Trace Bundles (`POST /v1/dvr`) -> Storage + async Telegram Channel video post (only for manually flagged battles)
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

const ALLOWED_CORS_ORIGINS = new Set([
  'https://silphscopepvp.com',
  'https://www.silphscopepvp.com',
  'https://dvr.silphscopepvp.com',
  'https://api.silphscopepvp.com',
  'https://dl.silphscopepvp.com',
]);

function resolveAllowedCorsOrigin(request, restrictOrigin = false) {
  if (!request) return '*';
  const origin = (request.headers.get('Origin') || '').trim();
  if (!origin) {
    return restrictOrigin ? 'https://silphscopepvp.com' : '*';
  }
  if (
    ALLOWED_CORS_ORIGINS.has(origin) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    return origin;
  }
  return restrictOrigin ? 'https://silphscopepvp.com' : '*';
}

const DEFAULT_CSP_HEADER =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' data: https://fonts.gstatic.com; " +
  "img-src 'self' data: blob: https:; " +
  "media-src 'self' blob: https:; " +
  "connect-src 'self' https://api.silphscopepvp.com https://dvr.silphscopepvp.com https://silphscopepvp.com https://www.silphscopepvp.com https://*.silphscopepvp.com https://silphscope-telemetry.silphscope-pvp.workers.dev https://api.github.com https://raw.githubusercontent.com https://docs.google.com https://*.googleusercontent.com; " +
  "frame-src 'self' https://*.silphscopepvp.com https://silphscopepvp.com; " +
  "frame-ancestors 'self' https://*.silphscopepvp.com https://silphscopepvp.com; " +
  "object-src 'none'; " +
  "base-uri 'self'";

function buildSecurityHeaders(extraHeaders = {}, isHtml = false) {
  const h = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    ...extraHeaders,
  };
  if (isHtml && !h['Content-Security-Policy']) {
    h['Content-Security-Policy'] = DEFAULT_CSP_HEADER;
  }
  return h;
}

function jsonResponse(data, status = 200, request = null, restrictCors = false) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: buildSecurityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': resolveAllowedCorsOrigin(request, restrictCors),
      Vary: 'Origin',
    }),
  });
}

function timingSafeEqualStr(a, b) {
  const strA = typeof a === 'string' ? a : '';
  const strB = typeof b === 'string' ? b : '';
  const enc = new TextEncoder();
  const bufA = enc.encode(strA);
  const bufB = enc.encode(strB);
  const len = Math.max(bufA.byteLength, bufB.byteLength);
  let diff = bufA.byteLength ^ bufB.byteLength;
  for (let i = 0; i < len; i++) {
    diff |= (bufA[i] || 0) ^ (bufB[i] || 0);
  }
  return diff === 0 && strA.length > 0;
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
  const cleaned = raw
    .trim()
    .replace(/\.\.+/g, '_')
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 96);
  return cleaned || fallback;
}

function sanitizeEmailKey(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string') return '';
  return rawEmail
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._+-]/g, '')
    .slice(0, 120);
}

function maskSecretKey(rawKey) {
  const s = String(rawKey || '').trim();
  if (!s) return '';
  if (s.length <= 8) return '****';
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

/**
 * Unified storage adapter supporting Cloudflare R2 (`TELEMETRY_BUCKET`) or Workers KV (`TELEMETRY_KV`).
 */
function getStorageAdapter(env) {
  const bucket = env.REPLAY_BUCKET || env.TELEMETRY_BUCKET;
  if (bucket) {
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
      async getBytes(key) {
        const obj = await bucket.get(key);
        return obj ? await obj.arrayBuffer() : null;
      },
      async getResponse(key) {
        const obj = await bucket.get(key);
        if (!obj) return null;
        const headers = new Headers();
        obj.writeHttpMetadata(headers);
        return new Response(obj.body, { status: 200, headers });
      },
      async list({ prefix = '', cursor = undefined, limit = 500 } = {}) {
        const opts = { limit: Math.min(Number(limit) || 500, 1000) };
        if (prefix) opts.prefix = prefix;
        if (cursor) opts.cursor = cursor;
        opts.include = ['customMetadata'];
        const listed = await bucket.list(opts);
        const objs = Array.isArray(listed?.objects) ? listed.objects : [];
        return {
          objects: objs.map((o) => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded,
            customMetadata: o.customMetadata || {},
          })),
          truncated: Boolean(listed?.truncated),
          cursor: listed?.truncated ? (listed?.cursor || null) : null,
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
      async getBytes(key) {
        const { value, metadata } = await kv.getWithMetadata(key, { type: 'arrayBuffer' });
        if (!value) return null;
        const chunkCount = Number((metadata && metadata.chunkCount) || 1);
        if (chunkCount <= 1) return value;
        const chunks = [new Uint8Array(value)];
        let totalLen = chunks[0].byteLength;
        for (let i = 1; i < chunkCount; i++) {
          const partBuf = await kv.get(`${key}.__part${i}`, { type: 'arrayBuffer' });
          if (partBuf) {
            const u8 = new Uint8Array(partBuf);
            chunks.push(u8);
            totalLen += u8.byteLength;
          }
        }
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        return merged.buffer;
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
        const opts = { limit: Math.min(Number(limit) || 500, 1000) };
        if (prefix) opts.prefix = prefix;
        if (cursor) opts.cursor = cursor;
        const listed = await kv.list(opts);
        const keys = Array.isArray(listed?.keys) ? listed.keys : [];
        return {
          objects: keys
            .filter((k) => k && k.name && !k.name.includes('.__part'))
            .map((k) => ({
              key: k.name,
              size: Number((k.metadata && k.metadata.size) || 0),
              uploaded: (k.metadata && k.metadata.uploadedAt) || null,
              customMetadata: k.metadata || {},
            })),
          truncated: !Boolean(listed?.list_complete),
          cursor: !Boolean(listed?.list_complete) ? (listed?.cursor || null) : null,
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

  throw new Error('Neither REPLAY_BUCKET/TELEMETRY_BUCKET (R2) nor TELEMETRY_KV (KV) is bound.');
}

async function computeDeviceIngestToken(env, deviceHash) {
  const cleanDev = String(deviceHash || '').trim().toLowerCase();
  if (cleanDev.length < 8) return '';
  try {
    const secret = getSessionHmacSecret(env);
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const payload = `device_ingest_v1|${cleanDev}`;
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
    const sigHex = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `dit1_${sigHex}`;
  } catch (_) {
    return '';
  }
}

async function verifyClientAuth(request, env, allowBlankScreenName = false, allowWebClientKey = true) {
  const expectedKey = (env.CLIENT_INGEST_KEY || '').trim();
  if (!expectedKey) {
    return { ok: false, status: 500, error: 'Worker CLIENT_INGEST_KEY secret is not configured.' };
  }
  const providedKey = (request.headers.get('X-SilphScope-Client-Key') || '').trim();
  const isValidPrimary =
    providedKey &&
    (timingSafeEqualStr(providedKey, expectedKey) ||
      timingSafeEqualStr(providedKey, 'sspvp_client_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c') ||
      timingSafeEqualStr(providedKey, 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c'));
  const isValidWebKey =
    allowWebClientKey &&
    providedKey &&
    timingSafeEqualStr(providedKey, 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c');

  let isValidDeviceToken = false;
  const providedDevToken = (request.headers.get('X-Device-Ingest-Token') || '').trim();
  const providedDevHash = (request.headers.get('X-Device-Hash') || '').trim();
  if (providedDevToken && providedDevHash.length >= 8) {
    const expectedDevToken = await computeDeviceIngestToken(env, providedDevHash);
    if (expectedDevToken && timingSafeEqualStr(providedDevToken, expectedDevToken)) {
      isValidDeviceToken = true;
    }
  }

  if (!isValidPrimary && !isValidWebKey && !isValidDeviceToken) {
    return { ok: false, status: 401, error: 'Invalid or missing X-SilphScope-Client-Key header.' };
  }
  const rawScreenName =
    request.headers.get('X-Trainer-Screen-Name') ||
    request.headers.get('X-SilphScope-Screen-Name') ||
    '';
  const screenName = sanitizeScreenName(rawScreenName);
  if (!screenName && !allowBlankScreenName) {
    return {
      ok: false,
      status: 400,
      error: 'Valid X-Trainer-Screen-Name header (3-24 alphanumeric/underscore chars) is required.',
    };
  }
  return { ok: true, screenName, isValidDeviceToken };
}

function verifyAdminAuth(request, env) {
  const expectedAdmin = (env.ADMIN_API_KEY || '').trim();
  if (!expectedAdmin) {
    return { ok: false, status: 500, error: 'Worker ADMIN_API_KEY secret is not configured.' };
  }
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !timingSafeEqualStr(token, expectedAdmin)) {
    return { ok: false, status: 401, error: 'Unauthorized: invalid ADMIN_API_KEY.' };
  }
  return { ok: true };
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() ||
    '0.0.0.0'
  );
}

async function checkAndIncrementRateLimit(kv, bucketName, subjectKey, maxHits = 10, windowSec = 600) {
  if (!kv) return { allowed: true, remaining: maxHits };
  const cleanSub = String(subjectKey || 'anon')
    .toLowerCase()
    .replace(/[^a-z0-9._:-]/g, '_')
    .slice(0, 80);
  const slot = Math.floor(Date.now() / (windowSec * 1000));
  const kvKey = `ratelimit/${bucketName}/${cleanSub}/${slot}`;
  try {
    const raw = await kv.get(kvKey, { type: 'text' });
    const count = (Number(raw) || 0) + 1;
    if (count > maxHits) {
      return { allowed: false, remaining: 0, retryAfterSec: windowSec };
    }
    await kv.put(kvKey, String(count), { expirationTtl: Math.max(60, windowSec + 30) });
    return { allowed: true, remaining: Math.max(0, maxHits - count) };
  } catch (_) {
    return { allowed: true, remaining: maxHits };
  }
}

function isValidMp4Bytes(bytes) {
  if (!bytes || bytes.byteLength < 12) return false;
  // Standard ISO BMFF / MP4 boxes contain 'ftyp', 'moov', 'mdat', 'wide', or 'free' at bytes 4..7
  const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  return tag === 'ftyp' || tag === 'moov' || tag === 'mdat' || tag === 'free' || tag === 'wide';
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
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScript(val) {
  return JSON.stringify(val)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// ============================================================================
// SUBSCRIPTION TIERS, UNLOCK KEYS & R2 REPLAY VAULT HELPERS (v2.0.0)
// ============================================================================

const TIER_PRESETS = {
  free: {
    tier: 'free',
    label: 'Free / Community (1 Local Video (15 FPS) • GL & ML 1-Team Anti-Meta)',
    maxLocalBattles: 1,
    maxRollingBattles: 0,
    maxPinnedBattles: 0,
    retentionDays: 0,
    pinnedRetentionDays: 0,
    maxStorageMb: 0,
    allowedLeagues: ['GREAT LEAGUE', 'MASTER LEAGUE'],
    teamsPerArchetype: 1,
    allowAltMovesets: false,
    shieldDecisionOverlay: false,
    lifetimeHistory: false,
    seasonGraceDays: 14,
  },
  supporter: {
    tier: 'supporter',
    label: 'Lifetime Supporter (Alumni • 🛡️ Shield Decision HUD • 5 Local Videos (15 FPS) • Core 3 Leagues • Lifetime Logs)',
    maxLocalBattles: 5,
    maxRollingBattles: 0,
    maxPinnedBattles: 0,
    retentionDays: 0,
    pinnedRetentionDays: 365,
    maxStorageMb: 2000,
    allowedLeagues: ['GREAT LEAGUE', 'ULTRA LEAGUE', 'MASTER LEAGUE'],
    teamsPerArchetype: 2,
    allowAltMovesets: false,
    shieldDecisionOverlay: true,
    lifetimeHistory: true,
    seasonGraceDays: 36500,
  },
  base: {
    tier: 'supporter',
    label: 'Lifetime Supporter (Alumni • 🛡️ Shield Decision HUD • 5 Local Videos (15 FPS) • Core 3 Leagues • Lifetime Logs)',
    maxLocalBattles: 5,
    maxRollingBattles: 0,
    maxPinnedBattles: 0,
    retentionDays: 0,
    pinnedRetentionDays: 365,
    maxStorageMb: 2000,
    allowedLeagues: ['GREAT LEAGUE', 'ULTRA LEAGUE', 'MASTER LEAGUE'],
    teamsPerArchetype: 2,
    allowAltMovesets: false,
    shieldDecisionOverlay: true,
    lifetimeHistory: true,
    seasonGraceDays: 36500,
  },
  pro: {
    tier: 'pro',
    label: 'Legend Pro Pass ($3/mo or $6/season • 🛡️ Shield Decision HUD • 15 FPS DVR • 25 Local • 50 Cloud / 10 Pinned • All Cups + Alt Moves)',
    maxLocalBattles: 25,
    maxRollingBattles: 50,
    maxPinnedBattles: 10,
    retentionDays: 30,
    pinnedRetentionDays: 365,
    maxStorageMb: 2000,
    allowedLeagues: ['ALL'],
    teamsPerArchetype: 5,
    allowAltMovesets: true,
    shieldDecisionOverlay: true,
    lifetimeHistory: true,
    seasonGraceDays: 36500,
  },
  vip: {
    tier: 'vip',
    label: 'VIP / Coach Pass ($5/mo or $10/season • 🎥 30 FPS Smooth DVR (+ 15 FPS Storage Saver) • 🛡️ Shield Decision HUD • 100 Local Slider • 150 Cloud / 25 Pinned • 365d Vault)',
    maxLocalBattles: 100,
    maxRollingBattles: 150,
    maxPinnedBattles: 25,
    retentionDays: 365,
    pinnedRetentionDays: 365,
    maxStorageMb: 4000,
    allowedLeagues: ['ALL'],
    teamsPerArchetype: 5,
    allowAltMovesets: true,
    shieldDecisionOverlay: true,
    lifetimeHistory: true,
    seasonGraceDays: 36500,
  },
};

const STRIPE_PAYMENT_LINKS = {
  supporter: 'https://buy.stripe.com/4gM3cwf3r8JG7XLamm1Jm07',
  pro_season: 'https://buy.stripe.com/8x2aEY8F33pma5TgKK1Jm08',
  pro_intro: 'https://buy.stripe.com/14A4gAcVjf8491P8ee1Jm09',
  pro_monthly: 'https://buy.stripe.com/4gM3cw7AZ0dab9XeCC1Jm0a',
  vip_season: 'https://buy.stripe.com/9B6fZi3kJ6By4Lzamm1Jm0b',
  vip_intro: 'https://buy.stripe.com/4gM7sM5sR5xudi5amm1Jm0c',
  vip_monthly: 'https://buy.stripe.com/28E00k2gFaRO5PD2TU1Jm0d',
};

const BMC_LINKS = {
  page: 'https://buymeacoffee.com/silphscopepvp',
  membership: 'https://buymeacoffee.com/silphscopepvp/membership',
  supporter: 'https://buymeacoffee.com/silphscopepvp/e/595787',
  pro_season: 'https://buymeacoffee.com/silphscopepvp/e/595788',
  vip_season: 'https://buymeacoffee.com/silphscopepvp/e/595789',
};

function getActiveGblSeasonWindow(nowMs = Date.now()) {
  // Standard GBL seasons start on Dec 1, Mar 1, Jun 1, Sep 1 at 21:00 UTC (90 days each)
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const anchors = [
    Date.UTC(year - 1, 11, 1, 21, 0, 0),
    Date.UTC(year, 2, 1, 21, 0, 0),
    Date.UTC(year, 5, 1, 21, 0, 0),
    Date.UTC(year, 8, 1, 21, 0, 0),
    Date.UTC(year, 11, 1, 21, 0, 0),
    Date.UTC(year + 1, 2, 1, 21, 0, 0),
  ];
  let startMs = anchors[0];
  let endMs = anchors[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    if (nowMs >= anchors[i] && nowMs < anchors[i + 1]) {
      startMs = anchors[i];
      endMs = anchors[i + 1];
      break;
    }
  }
  const daysElapsed = Math.max(0, Math.floor((nowMs - startMs) / 86400000));
  const daysRemaining = Math.max(1, Math.ceil((endMs - nowMs) / 86400000));
  const isDay15Plus = daysElapsed >= 14;
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
    daysElapsed,
    daysRemaining,
    isDay15Plus,
  };
}

function getLicenseHmacSecret(env) {
  const sec = String(env.LICENSE_HMAC_KEY || env.ADMIN_API_KEY || '').trim();
  if (!sec) {
    throw new Error('Server cryptographic secret (LICENSE_HMAC_KEY / ADMIN_API_KEY) is not configured.');
  }
  return `${sec}:license_hmac_v2`;
}

function getSessionHmacSecret(env) {
  const sec = String(env.SESSION_HMAC_KEY || env.ADMIN_API_KEY || '').trim();
  if (!sec) {
    throw new Error('Server cryptographic secret (SESSION_HMAC_KEY / ADMIN_API_KEY) is not configured.');
  }
  return `${sec}:vault_session_v2`;
}

function getPasswordPepperSecret(env) {
  const sec = String(env.PASSWORD_PEPPER || env.ADMIN_API_KEY || '').trim();
  if (!sec) {
    throw new Error('Server cryptographic secret (PASSWORD_PEPPER / ADMIN_API_KEY) is not configured.');
  }
  return sec;
}

function randomCharsFromAlphabet(len, alphabet) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateSecureSaltHex(byteLen = 16) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signLicensePayloadHmac(env, screenName, tier, expiresAt, everPaid) {
  const secret = getLicenseHmacSecret(env);
  const msg = `${String(screenName || '').toLowerCase()}|${String(tier || 'free').toLowerCase()}|${String(expiresAt || 'never')}|${Boolean(everPaid)}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(msg));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hasUserUsedIntroPromo(kv, { screenName = '', email = '', deviceHash = '', githubUserId = '' }) {
  if (!kv) return false;
  const checks = [];
  const cleanEmail = sanitizeEmailKey(email);
  const cleanDev = sanitizeId(deviceHash, '');
  const cleanGh = sanitizeId(githubUserId, '');
  if (screenName) checks.push(kv.get(`promo_used/user/${screenName.toLowerCase()}`, { type: 'text' }));
  if (cleanEmail) checks.push(kv.get(`promo_used/email/${cleanEmail}`, { type: 'text' }));
  if (cleanDev) checks.push(kv.get(`promo_used/dev/${cleanDev.toLowerCase()}`, { type: 'text' }));
  if (cleanGh) checks.push(kv.get(`promo_used/gh/${cleanGh}`, { type: 'text' }));
  const results = await Promise.all(checks);
  return results.some(Boolean);
}

async function markUserIntroPromoUsed(kv, { screenName = '', email = '', deviceHash = '', githubUserId = '', key = '' }) {
  if (!kv) return;
  const cleanEmail = sanitizeEmailKey(email);
  const cleanDev = sanitizeId(deviceHash, '');
  const cleanGh = sanitizeId(githubUserId, '');
  const stamp = JSON.stringify({ usedAt: new Date().toISOString(), key, screenName, email: cleanEmail });
  const puts = [];
  if (screenName) puts.push(kv.put(`promo_used/user/${screenName.toLowerCase()}`, stamp));
  if (cleanEmail) puts.push(kv.put(`promo_used/email/${cleanEmail}`, stamp));
  if (cleanDev) puts.push(kv.put(`promo_used/dev/${cleanDev.toLowerCase()}`, stamp));
  if (cleanGh) puts.push(kv.put(`promo_used/gh/${cleanGh}`, stamp));
  await Promise.all(puts);
}

async function checkScreenNameRegistration(kv, screenName, deviceHash = '', verifiedGitHubUserId = '') {
  if (!kv || !screenName) return { available: false, ownedByCaller: false, record: null };
  const cleanName = sanitizeScreenName(screenName);
  if (!cleanName) return { available: false, ownedByCaller: false, record: null };
  const rawReg = await kv.get(`registered_user/${cleanName.toLowerCase()}`, { type: 'text' });
  const existingLicKey = await kv.get(`user_license/${cleanName}`, { type: 'text' }) ||
    await kv.get(`user_license/${cleanName.toLowerCase()}`, { type: 'text' });
  const lic = existingLicKey ? await loadLicenseByKey(kv, existingLicKey) : null;

  if (!rawReg && !lic) {
    return { available: true, ownedByCaller: false, record: null };
  }
  let reg = null;
  try {
    if (rawReg) reg = JSON.parse(rawReg);
  } catch (_) {}

  const cleanDev = String(deviceHash || '').trim().toLowerCase();
  const cleanGhId = String(verifiedGitHubUserId || '').trim();

  // Require a non-trivial deviceHash (not a predictable 'web-...' placeholder) when matching device ownership
  const isValidDevToken = cleanDev.length >= 8 && !cleanDev.startsWith('web-');

  const matchesRegDev =
    isValidDevToken && reg && reg.deviceHash && String(reg.deviceHash).toLowerCase() === cleanDev;
  const matchesRegGh =
    cleanGhId && reg && reg.githubUserId && String(reg.githubUserId) === cleanGhId;
  const matchesLicDev =
    isValidDevToken && lic && lic.boundDeviceHash && String(lic.boundDeviceHash).toLowerCase() === cleanDev;
  const matchesLicGh =
    cleanGhId && lic && lic.boundGitHubUserId && String(lic.boundGitHubUserId) === cleanGhId;

  const ownedByCaller = Boolean(matchesRegDev || matchesRegGh || matchesLicDev || matchesLicGh);
  return {
    available: ownedByCaller,
    ownedByCaller,
    record: reg || (lic ? { screenName: lic.boundScreenName, boundKey: lic.key } : null),
  };
}

function generateUnlockKey(tier = 'base', prefix = 'SSPVP') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `${prefix}-${String(tier).toUpperCase().slice(0, 4)}-${randomCharsFromAlphabet(4, chars)}-${randomCharsFromAlphabet(4, chars)}-${randomCharsFromAlphabet(4, chars)}`;
}

function generateShareId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return `r_${randomCharsFromAlphabet(16, chars)}`;
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

async function updateLicensesManifest(kv, newOrUpdatedLic) {
  if (!kv || !newOrUpdatedLic || !newOrUpdatedLic.key) return;
  try {
    const raw = await kv.get('licenses_manifest.json', { type: 'text' });
    let list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (_) {}
    }
    if (!Array.isArray(list)) list = [];
    const idx = list.findIndex((k) => k && k.key === newOrUpdatedLic.key);
    if (idx >= 0) {
      list[idx] = newOrUpdatedLic;
    } else {
      list.push(newOrUpdatedLic);
    }
    await kv.put('licenses_manifest.json', JSON.stringify(list, null, 2));
  } catch (_) {}
}

async function saveLicenseRecord(kv, lic) {
  if (!kv || !lic || !lic.key) return;
  const cleanKey = String(lic.key).trim().toUpperCase();
  lic.key = cleanKey;
  await kv.put(`licenses/${cleanKey}`, JSON.stringify(lic, null, 2));
  if (lic.boundScreenName && !lic.screenNameConflict) {
    await kv.put(`user_license/${lic.boundScreenName}`, cleanKey);
    await kv.put(`user_license/${lic.boundScreenName.toLowerCase()}`, cleanKey);
  }
  if (lic.boundGitHubUsername) {
    await kv.put(`gh_license/${String(lic.boundGitHubUsername).toLowerCase()}`, cleanKey);
  }
  if (lic.boundGitHubUserId) {
    await kv.put(`gh_id_license/${String(lic.boundGitHubUserId).trim()}`, cleanKey);
  }
  if (lic.supporterEmail) {
    const cleanEmail = sanitizeEmailKey(lic.supporterEmail);
    if (cleanEmail) {
      await kv.put(`email_license/${cleanEmail}`, cleanKey);
    }
  }
  await updateLicensesManifest(kv, lic);
}

const GITHUB_OAUTH_CLIENT_ID = '178c6fc778ccc68e1d6a';
const PBKDF2_ITERATIONS = 100000;

async function hashUserPassword(env, password, salt) {
  const secret = getPasswordPepperSecret(env);
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${secret}:${String(password || '')}`),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(`sspvp_pw_v2:${salt}`),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256
  );
  const hex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `pbkdf2_${PBKDF2_ITERATIONS}$${hex}`;
}

async function hashLegacyHmacPassword(env, password, salt) {
  const secret = String(env.ADMIN_API_KEY || '').trim();
  if (!secret) return '';
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${secret}:${salt}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(String(password || '')));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyUserPassword(env, password, salt, storedHash) {
  if (!storedHash || !salt) return { valid: false, needsUpgrade: false };
  if (storedHash.startsWith('pbkdf2_')) {
    const computed = await hashUserPassword(env, password, salt);
    return { valid: timingSafeEqualStr(computed, storedHash), needsUpgrade: false };
  }
  const legacyHash = await hashLegacyHmacPassword(env, password, salt);
  if (legacyHash && timingSafeEqualStr(legacyHash, storedHash)) {
    return { valid: true, needsUpgrade: true };
  }
  return { valid: false, needsUpgrade: false };
}

const USER_AUTH_MEM_CACHE = new Map();
const SYNC_MEM_RATE_LIMIT = new Map();

function checkMemoryRateLimit(bucketName, subjectKey, maxHits = 90, windowSec = 600) {
  const now = Date.now();
  const slot = Math.floor(now / (windowSec * 1000));
  const k = `${bucketName}:${String(subjectKey || 'anon').toLowerCase().slice(0, 80)}:${slot}`;
  if (SYNC_MEM_RATE_LIMIT.size > 4000) {
    SYNC_MEM_RATE_LIMIT.clear();
  }
  const count = (SYNC_MEM_RATE_LIMIT.get(k) || 0) + 1;
  SYNC_MEM_RATE_LIMIT.set(k, count);
  return { allowed: count <= maxHits, remaining: Math.max(0, maxHits - count) };
}

async function loadUserAuthRecord(kv, screenName) {
  if (!kv || !screenName) return null;
  const clean = sanitizeScreenName(screenName).toLowerCase();
  if (!clean) return null;
  const now = Date.now();
  const cached = USER_AUTH_MEM_CACHE.get(clean);
  if (cached && cached.expiresAt > now) {
    return cached.value ? { ...cached.value } : null;
  }
  try {
    const raw = await kv.get(`user_auth/${clean}`, { type: 'text' });
    const parsed = raw ? JSON.parse(raw) : null;
    if (USER_AUTH_MEM_CACHE.size > 2000) USER_AUTH_MEM_CACHE.clear();
    USER_AUTH_MEM_CACHE.set(clean, { value: parsed, expiresAt: now + 60000 });
    return parsed ? { ...parsed } : null;
  } catch (_) {}
  return null;
}

async function saveUserAuthRecord(kv, screenName, authObj) {
  if (!kv || !screenName || !authObj) return;
  const clean = sanitizeScreenName(screenName);
  authObj.screenName = clean;
  authObj.updatedAt = new Date().toISOString();
  await kv.put(`user_auth/${clean.toLowerCase()}`, JSON.stringify(authObj, null, 2));
  USER_AUTH_MEM_CACHE.set(clean.toLowerCase(), {
    value: { ...authObj },
    expiresAt: Date.now() + 60000,
  });
  if (authObj.githubUsername) {
    await kv.put(`gh_user_map/${String(authObj.githubUsername).toLowerCase()}`, clean);
  }
  if (authObj.githubUserId) {
    await kv.put(`gh_id_map/${String(authObj.githubUserId).trim()}`, clean);
  }
}

async function createVaultSessionToken(env, screenName, tier = 'free', ttlDays = 365, sessionEpoch = 1) {
  const cleanName = sanitizeScreenName(screenName);
  const cleanTier = String(tier || 'free').toLowerCase();
  const epoch = Math.max(1, Number(sessionEpoch) || 1);
  const expiresMs = Date.now() + ttlDays * 86400000;
  const payload = `${cleanName}.${cleanTier}.${expiresMs}.${epoch}`;
  const secret = getSessionHmacSecret(env);
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}.${sigHex}`;
}

async function verifyVaultSessionToken(env, token, kv = null) {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.trim().split('.');
  if (parts.length !== 4 && parts.length !== 5) return { valid: false };
  const isV2 = parts.length === 5;
  const screenName = parts[0];
  const tier = parts[1];
  const expiresStr = parts[2];
  const epochStr = isV2 ? parts[3] : '1';
  const sigHex = isV2 ? parts[4] : parts[3];

  const expiresMs = Number(expiresStr) || 0;
  if (expiresMs < Date.now()) return { valid: false, expired: true };
  const payload = isV2
    ? `${screenName}.${tier}.${expiresStr}.${epochStr}`
    : `${screenName}.${tier}.${expiresStr}`;
  let secret;
  try {
    secret = isV2
      ? getSessionHmacSecret(env)
      : `${String(env.ADMIN_API_KEY || '').trim()}:vault_session_v1`;
  } catch (_) {
    return { valid: false };
  }
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload));
  const expectedHex = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!timingSafeEqualStr(expectedHex, sigHex.toLowerCase())) return { valid: false };

  if (kv) {
    const authRec = await loadUserAuthRecord(kv, screenName);
    const requiredEpoch = Number(authRec && authRec.sessionEpoch) || 1;
    if ((Number(epochStr) || 1) < requiredEpoch) {
      return { valid: false, expired: true };
    }
  }
  return { valid: true, screenName, tier, expiresMs, sessionEpoch: Number(epochStr) || 1 };
}

async function verifyGitHubTokenIdentity(githubToken) {
  if (!githubToken || typeof githubToken !== 'string') return { ok: false, error: 'Missing GitHub token.' };
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${githubToken.trim()}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SilphScope-PvP-Worker/7.0',
      },
    });
    if (!res.ok) {
      return { ok: false, error: `GitHub token verification failed (HTTP ${res.status}).` };
    }
    const data = await res.json();
    if (!data || !data.login || !data.id) {
      return { ok: false, error: 'Invalid GitHub user profile response.' };
    }
    return {
      ok: true,
      githubUsername: String(data.login).trim(),
      githubUserId: String(data.id).trim(),
      avatarUrl: String(data.avatar_url || ''),
    };
  } catch (e) {
    return { ok: false, error: `GitHub API error: ${e.message}` };
  }
}

async function loadLicenseByGitHubFallback(kv, githubUsername, githubUserId) {
  if (!kv) return null;
  const cleanLogin = String(githubUsername || '').trim();
  const cleanId = String(githubUserId || '').trim();
  try {
    const rawManifest = await kv.get('licenses_manifest.json', { type: 'text' });
    if (rawManifest) {
      const list = JSON.parse(rawManifest);
      if (Array.isArray(list)) {
        const matchedLic = list.find(
          (k) =>
            k &&
            !k.revoked &&
            ((cleanId && k.boundGitHubUserId && String(k.boundGitHubUserId) === cleanId) ||
              (cleanLogin &&
                k.boundGitHubUsername &&
                String(k.boundGitHubUsername).toLowerCase() === cleanLogin.toLowerCase()))
        );
        if (matchedLic) {
          await saveLicenseRecord(kv, matchedLic);
          return matchedLic;
        }
      }
    }
  } catch (_) {}
  return null;
}

async function resolveScreenNameFromGitHub(kv, githubUsername, githubUserId, preferredScreenName = '') {
  const cleanLogin = String(githubUsername || '').trim();
  const cleanId = String(githubUserId || '').trim();
  const cleanPref = preferredScreenName ? sanitizeScreenName(preferredScreenName) : '';
  if (!kv) return cleanPref || sanitizeScreenName(cleanLogin);

  if (cleanId) {
    const licKeyById = await kv.get(`gh_id_license/${cleanId}`, { type: 'text' });
    if (licKeyById) {
      const lic = await loadLicenseByKey(kv, licKeyById);
      if (lic && lic.boundScreenName) return lic.boundScreenName;
    }
    const mappedById = await kv.get(`gh_id_map/${cleanId}`, { type: 'text' });
    if (mappedById) return mappedById;
  }
  if (cleanLogin) {
    const licKeyByLogin = await kv.get(`gh_license/${cleanLogin.toLowerCase()}`, { type: 'text' });
    if (licKeyByLogin) {
      const lic = await loadLicenseByKey(kv, licKeyByLogin);
      if (lic && lic.boundScreenName) return lic.boundScreenName;
    }
    const mappedByLogin = await kv.get(`gh_user_map/${cleanLogin.toLowerCase()}`, { type: 'text' });
    if (mappedByLogin) return mappedByLogin;
  }

  // Fallback scan of licenses_manifest.json if secondary KV index keys were missing or out of sync, and self-heal them!
  try {
    const rawManifest = await kv.get('licenses_manifest.json', { type: 'text' });
    if (rawManifest) {
      const list = JSON.parse(rawManifest);
      if (Array.isArray(list)) {
        const matchedLic = list.find(
          (k) =>
            k &&
            !k.revoked &&
            k.boundScreenName &&
            ((cleanId && k.boundGitHubUserId && String(k.boundGitHubUserId) === cleanId) ||
              (cleanLogin &&
                k.boundGitHubUsername &&
                String(k.boundGitHubUsername).toLowerCase() === cleanLogin.toLowerCase()))
        );
        if (matchedLic) {
          await saveLicenseRecord(kv, matchedLic);
          return matchedLic.boundScreenName;
        }
      }
    }
  } catch (_) {}

  return cleanPref || sanitizeScreenName(cleanLogin);
}

async function resolveUserLicense(
  env,
  kv,
  screenName,
  providedKey = '',
  githubUsername = '',
  githubUserId = '',
  deviceHash = '',
  claimEmail = '',
  options = {}
) {
  const isServerVerifiedGh = Boolean(options && options.isServerVerifiedGh);
  const revealFullKey = Boolean(options && options.revealFullKey);
  if (!kv) {
    const sig = await signLicensePayloadHmac(env, screenName, 'free', null, false);
    return { ...TIER_PRESETS.free, active: false, key: '', everPaid: false, signature: sig };
  }
  let lic = null;
  const cleanProvided = String(providedKey || '').trim().toUpperCase();
  const cleanGhUser = isServerVerifiedGh ? String(githubUsername || '').trim().toLowerCase() : '';
  const cleanGhId = isServerVerifiedGh ? String(githubUserId || '').trim() : '';
  const cleanDev = String(deviceHash || '').trim().toLowerCase();
  const isValidDevToken = cleanDev.length >= 8 && !cleanDev.startsWith('web-');
  const cleanEmail = sanitizeEmailKey(claimEmail);

  // 1. Explicit Unlock Key provided
  if (cleanProvided) {
    lic = await loadLicenseByKey(kv, cleanProvided);
    if (!lic) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        everPaid: false,
        error: 'Invalid Unlock Key. Check the key and try again.',
      };
    }
  } else {
    // 2. Anti-Spoofing: NEVER look up by screenName alone or unverified GitHub headers when providedKey is blank!
    // Only allow lookup by server-verified GitHub identity OR first-time unactivated Checkout Email claim.
    if (isServerVerifiedGh && cleanGhId) {
      const ghIdKey = await kv.get(`gh_id_license/${cleanGhId}`, { type: 'text' });
      if (ghIdKey) {
        lic = await loadLicenseByKey(kv, ghIdKey);
      }
    }
    if (!lic && isServerVerifiedGh && cleanGhUser) {
      const ghMappedKey = await kv.get(`gh_license/${cleanGhUser}`, { type: 'text' });
      if (ghMappedKey) {
        lic = await loadLicenseByKey(kv, ghMappedKey);
      }
    }
    if (!lic && isServerVerifiedGh && (cleanGhId || cleanGhUser)) {
      lic = await loadLicenseByGitHubFallback(kv, cleanGhUser, cleanGhId);
    }
    if (!lic && cleanEmail) {
      const emailMappedKey = await kv.get(`email_license/${cleanEmail}`, { type: 'text' });
      if (emailMappedKey) {
        const candidate = await loadLicenseByKey(kv, emailMappedKey);
        // Only allow email-only claim if the license has not yet been bound/activated to a different device,
        // or if the buyer is resolving an initial checkout screenNameConflict prior to activation.
        if (candidate && !candidate.revoked && !candidate.activatedAt) {
          const chk = await checkScreenNameRegistration(kv, screenName, cleanDev, cleanGhId);
          if (
            !candidate.boundScreenName ||
            candidate.boundScreenName.toLowerCase() === String(screenName || '').toLowerCase() ||
            (candidate.screenNameConflict && chk.available)
          ) {
            candidate.boundScreenName = screenName;
            candidate.screenNameConflict = false;
            lic = candidate;
          }
        }
      }
    }
    // 3. Also allow lookup if screenName is bound AND caller proves ownership via boundDeviceHash or server-verified boundGitHubUserId
    if (!lic && screenName && (isValidDevToken || cleanGhId)) {
      const mappedKey =
        (await kv.get(`user_license/${screenName}`, { type: 'text' })) ||
        (await kv.get(`user_license/${screenName.toLowerCase()}`, { type: 'text' }));
      if (mappedKey) {
        const candidate = await loadLicenseByKey(kv, mappedKey);
        if (
          candidate &&
          ((isValidDevToken &&
            candidate.boundDeviceHash &&
            String(candidate.boundDeviceHash).toLowerCase() === cleanDev) ||
            (cleanGhId &&
              candidate.boundGitHubUserId &&
              String(candidate.boundGitHubUserId) === cleanGhId))
        ) {
          lic = candidate;
        }
      }
    }
  }

  if (!lic) {
    const sig = await signLicensePayloadHmac(env, screenName, 'free', null, false);
    return { ...TIER_PRESETS.free, active: false, key: '', everPaid: false, signature: sig };
  }

  if (lic.revoked) {
    // Seamless key rotation: if this key was rotated (`lic.rotatedTo`) AND the caller is the verified bound owner
    // (same GitHub account or same bound deviceHash), transparently migrate them to the new rotated key!
    const isVerifiedBoundOwner =
      (isServerVerifiedGh &&
        ((cleanGhId && lic.boundGitHubUserId && String(lic.boundGitHubUserId) === cleanGhId) ||
          (cleanGhUser &&
            lic.boundGitHubUsername &&
            String(lic.boundGitHubUsername).toLowerCase() === cleanGhUser))) ||
      (isValidDevToken &&
        lic.boundDeviceHash &&
        String(lic.boundDeviceHash).toLowerCase() === cleanDev) ||
      Boolean(
        screenName &&
          lic.boundScreenName &&
          String(lic.boundScreenName).toLowerCase() === String(screenName).toLowerCase()
      );
    if (lic.rotatedTo && isVerifiedBoundOwner) {
      const rotatedLic = await loadLicenseByKey(kv, lic.rotatedTo);
      if (rotatedLic && !rotatedLic.revoked) {
        lic = rotatedLic;
      }
    }
    if (lic.revoked) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        everPaid: false,
        error: 'This Unlock Key has been revoked.',
      };
    }
  }

  const isSameGhOwner =
    isServerVerifiedGh &&
    ((cleanGhId && lic.boundGitHubUserId && String(lic.boundGitHubUserId) === cleanGhId) ||
      (cleanGhUser && lic.boundGitHubUsername && String(lic.boundGitHubUsername).toLowerCase() === cleanGhUser));
  const isSameEmailOwner =
    Boolean(cleanProvided) &&
    cleanEmail &&
    lic.supporterEmail &&
    sanitizeEmailKey(lic.supporterEmail) === cleanEmail;
  const isSameDeviceOwner =
    isValidDevToken && lic.boundDeviceHash && String(lic.boundDeviceHash).toLowerCase() === cleanDev;

  if (
    lic.boundGitHubUsername &&
    cleanGhUser &&
    String(lic.boundGitHubUsername).toLowerCase() !== cleanGhUser &&
    (!cleanGhId || !lic.boundGitHubUserId || String(lic.boundGitHubUserId) !== cleanGhId) &&
    !isSameEmailOwner
  ) {
    return {
      ...TIER_PRESETS.free,
      active: false,
      key: '',
      everPaid: false,
      error: `This Unlock Key is bound to another GitHub account (@${lic.boundGitHubUsername}).`,
    };
  }

  if (
    !isSameGhOwner &&
    !isSameEmailOwner &&
    !isSameDeviceOwner &&
    lic.boundScreenName &&
    screenName &&
    lic.boundScreenName.toLowerCase() !== screenName.toLowerCase()
  ) {
    // Allow if the key had a screenNameConflict and the user is supplying the key to claim a new available screenName
    const chk = await checkScreenNameRegistration(kv, screenName, cleanDev, cleanGhId);
    if (cleanProvided && lic.screenNameConflict && chk.available) {
      lic.boundScreenName = screenName;
      lic.screenNameConflict = false;
    } else {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: '',
        everPaid: false,
        error: `This Unlock Key is already bound to another Trainer ID (@${lic.boundScreenName}). Enter your Unlock Key + Checkout Email if resolving a duplicate name.`,
      };
    }
  }

  // If the key's boundScreenName had a conflict at checkout, require the user to pick an available screenName before binding
  if (lic.screenNameConflict && screenName) {
    const chk = await checkScreenNameRegistration(kv, screenName, cleanDev, cleanGhId);
    if (!chk.available) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: cleanProvided ? lic.key : '',
        screenNameConflict: true,
        error: `Trainer ID '@${screenName}' is already registered by another device. Please change your Trainer ID in Settings to a unique name and tap Verify again.`,
      };
    }
    lic.boundScreenName = screenName;
    lic.screenNameConflict = false;
  }

  let updatedBinding = false;
  const wasNeverActivated = !lic.activatedAt;
  const callerProvedKeyOrGh = Boolean(cleanProvided || isSameGhOwner || wasNeverActivated);

  if (screenName && !lic.boundScreenName && callerProvedKeyOrGh) {
    const chk = await checkScreenNameRegistration(kv, screenName, cleanDev, cleanGhId);
    if (!chk.available) {
      return {
        ...TIER_PRESETS.free,
        active: false,
        key: cleanProvided ? lic.key : '',
        screenNameConflict: true,
        error: `Trainer ID '@${screenName}' is already taken by another player. Choose a unique Trainer ID first.`,
      };
    }
    lic.boundScreenName = screenName;
    lic.activatedAt = lic.activatedAt || new Date().toISOString();
    updatedBinding = true;
  }
  if (!lic.activatedAt && callerProvedKeyOrGh) {
    lic.activatedAt = new Date().toISOString();
    updatedBinding = true;
  }
  if (isServerVerifiedGh && cleanGhUser && !lic.boundGitHubUsername && callerProvedKeyOrGh) {
    lic.boundGitHubUsername = cleanGhUser;
    updatedBinding = true;
  }
  if (isServerVerifiedGh && cleanGhId && !lic.boundGitHubUserId && callerProvedKeyOrGh) {
    lic.boundGitHubUserId = cleanGhId;
    updatedBinding = true;
  }
  if (isValidDevToken && !lic.boundDeviceHash && callerProvedKeyOrGh) {
    lic.boundDeviceHash = cleanDev;
    updatedBinding = true;
  }
  if (!lic.everPaid) {
    lic.everPaid = true;
    updatedBinding = true;
  }

  if (updatedBinding) {
    lic.lastActivatedAt = new Date().toISOString();
    await saveLicenseRecord(kv, lic);
    if (screenName && lic.boundScreenName && lic.boundScreenName.toLowerCase() === screenName.toLowerCase()) {
      await kv.put(
        `registered_user/${screenName.toLowerCase()}`,
        JSON.stringify({
          screenName,
          deviceHash: (isValidDevToken ? cleanDev : '') || lic.boundDeviceHash || '',
          githubUserId: cleanGhId || lic.boundGitHubUserId || '',
          boundKey: lic.key,
          registeredAt: new Date().toISOString(),
        })
      );
    }

    // Send Telegram notification upon membership activation or new device/GitHub binding
    try {
      const actTier = lic.tier === 'base' ? 'supporter' : lic.tier || 'supporter';
      const actPreset = TIER_PRESETS[actTier] || TIER_PRESETS.supporter;
      const actUser = lic.boundScreenName || screenName || 'Unknown';
      const actHeader = wasNeverActivated
        ? '✅ <b>Membership Activated!</b>'
        : '🔗 <b>Membership Linked to New Device / Account!</b>';
      await sendTelegramMessage(
        env,
        `${actHeader}\n` +
          `👤 <b>Trainer ID:</b> <code>@${escapeHtml(actUser)}</code>\n` +
          `🏅 <b>Paid Tier:</b> <code>${escapeHtml(actPreset.label)} (${actTier.toUpperCase()})</code>\n` +
          `🔑 <b>Unlock Key:</b> <code>${escapeHtml(maskSecretKey(lic.key))}</code>\n` +
          (lic.boundGitHubUsername
            ? `🐙 <b>GitHub:</b> <code>@${escapeHtml(lic.boundGitHubUsername)}</code>\n`
            : '') +
          `⏳ <b>Expires:</b> <code>${escapeHtml(lic.expiresAt ? lic.expiresAt.slice(0, 10) : 'LIFETIME')}</code>\n` +
          `☁️ <b>Vault:</b> https://dvr.silphscopepvp.com/vault?user=${encodeURIComponent(actUser)}`
      );
    } catch (_) {}
  }

  const exposedKey =
    cleanProvided || revealFullKey || isSameGhOwner || isSameDeviceOwner ? lic.key : '';

  // Check if Pro/VIP subscription expired -> Graduate to Lifetime Supporter (Alumni) instead of Free!
  const isExpired = Boolean(lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now());
  if (isExpired && lic.tier !== 'supporter' && lic.tier !== 'base') {
    const alumniPreset = TIER_PRESETS.supporter;
    const sig = await signLicensePayloadHmac(env, lic.boundScreenName || screenName, 'supporter', null, true);
    return {
      ...alumniPreset,
      tier: 'supporter',
      label: alumniPreset.label,
      key: exposedKey,
      active: true,
      everPaid: true,
      alumniFromTier: lic.tier,
      expired: true,
      expiresAt: lic.expiresAt,
      boundScreenName: lic.boundScreenName || screenName || '',
      signature: sig,
    };
  }

  const normalizedTier = lic.tier === 'base' ? 'supporter' : lic.tier || 'supporter';
  const preset = TIER_PRESETS[normalizedTier] || TIER_PRESETS.supporter;
  const sig = await signLicensePayloadHmac(
    env,
    lic.boundScreenName || screenName,
    preset.tier,
    lic.expiresAt || null,
    true
  );

  return {
    ...preset,
    tier: preset.tier,
    label: lic.label || preset.label,
    key: exposedKey,
    active: true,
    everPaid: true,
    boundScreenName: lic.boundScreenName || screenName || '',
    maxLocalBattles: Number(lic.maxLocalBattles ?? preset.maxLocalBattles),
    maxRollingBattles: Number(lic.maxRollingBattles ?? preset.maxRollingBattles),
    maxPinnedBattles: Number(lic.maxPinnedBattles ?? preset.maxPinnedBattles),
    retentionDays: Number(lic.retentionDays ?? preset.retentionDays),
    pinnedRetentionDays: Number(lic.pinnedRetentionDays ?? preset.pinnedRetentionDays ?? 365),
    maxStorageMb: Number(lic.maxStorageMb ?? preset.maxStorageMb),
    expiresAt: lic.expiresAt || null,
    signature: sig,
  };
}

function normalizeVaultSettings(rawSettings) {
  const s = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const rawVis = String(s.publicVisibility || 'public_only').toLowerCase().trim();
  let vis = rawVis;
  if (rawVis === 'private' || rawVis === 'no_videos') {
    vis = 'none';
  } else if (rawVis === 'starred_and_private' || rawVis === 'starred_plus_private') {
    vis = 'starred_and_public';
  }
  const allowed = ['public_only', 'starred_only', 'starred_and_public', 'all', 'none'];
  return {
    publicVisibility: allowed.includes(vis) ? vis : 'public_only',
    hideNamesPublic: Boolean(s.hideNamesPublic),
  };
}

async function loadUserReplayIndex(kv, screenName) {
  const defaultObj = {
    screenName,
    settings: normalizeVaultSettings(null),
    items: [],
  };
  if (!kv || !screenName) return defaultObj;
  try {
    let raw = await kv.get(`replay_index/${screenName}`, { type: 'text' });
    if (!raw && screenName !== screenName.toLowerCase()) {
      raw = await kv.get(`replay_index/${screenName.toLowerCase()}`, { type: 'text' });
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        parsed.settings = normalizeVaultSettings(parsed.settings);
        return parsed;
      }
    }
  } catch (_) {}
  return defaultObj;
}

async function saveUserReplayIndex(kv, screenName, indexObj) {
  if (!kv || !screenName) return;
  indexObj.settings = normalizeVaultSettings(indexObj.settings);
  indexObj.updatedAt = new Date().toISOString();
  await kv.put(`replay_index/${screenName}`, JSON.stringify(indexObj, null, 2));
  if (screenName !== screenName.toLowerCase()) {
    await kv.put(`replay_index/${screenName.toLowerCase()}`, JSON.stringify(indexObj, null, 2));
  }
}

async function authenticateVaultOwner(request, env, kv, targetScreenName, body = {}) {
  const sessionToken = String(
    body.sessionToken || request.headers.get('X-Vault-Session') || ''
  ).trim();
  const unlockKey = String(
    body.unlockKey || body.key || request.headers.get('X-SilphScope-Unlock-Key') || ''
  ).trim();
  const password = String(
    body.password || request.headers.get('X-Vault-Password') || ''
  ).trim();
  const githubToken = String(
    body.githubToken || request.headers.get('X-GitHub-Token') || ''
  ).trim();
  const pendingGhLinkToken = String(
    body.pendingGhLinkToken || request.headers.get('X-GitHub-Link-Token') || ''
  ).trim();
  const claimEmail = String(
    body.claimEmail || body.email || request.headers.get('X-Claim-Email') || ''
  ).trim();
  const devHash = String(
    body.deviceHash || body.deviceId || request.headers.get('X-Device-Hash') || ''
  ).trim();

  let screenName = targetScreenName ? sanitizeScreenName(targetScreenName) : '';

  // 1. Check Session Token (`X-Vault-Session`)
  if (sessionToken) {
    const ver = await verifyVaultSessionToken(env, sessionToken, kv);
    if (
      ver.valid &&
      (!screenName || screenName === 'anonymous' || ver.screenName.toLowerCase() === screenName.toLowerCase())
    ) {
      const resolvedUser = ver.screenName;
      const mappedKey =
        (kv && (await kv.get(`user_license/${resolvedUser}`, { type: 'text' }))) ||
        (kv && (await kv.get(`user_license/${resolvedUser.toLowerCase()}`, { type: 'text' }))) ||
        '';
      const licInfo = await resolveUserLicense(
        env,
        kv,
        resolvedUser,
        mappedKey,
        '',
        '',
        devHash,
        '',
        { revealFullKey: false }
      );
      const authRec = await loadUserAuthRecord(kv, resolvedUser);
      return {
        isOwner: true,
        authMethod: 'session',
        screenName: resolvedUser,
        licenseInfo: licInfo,
        authRecord: authRec,
        sessionToken,
      };
    }
  }

  // 2. Check GitHub OAuth Token (`X-GitHub-Token`, `body.githubToken`, or server-side `pendingGhLinkToken`)
  let verifiedGh = null;
  if (pendingGhLinkToken && kv) {
    try {
      const rawPending = await kv.get(`gh_pending_link/${sanitizeId(pendingGhLinkToken)}`, { type: 'text' });
      if (rawPending) {
        const parsedPending = JSON.parse(rawPending);
        if (parsedPending && parsedPending.githubUserId && parsedPending.githubUsername) {
          verifiedGh = {
            ok: true,
            githubUsername: String(parsedPending.githubUsername).trim(),
            githubUserId: String(parsedPending.githubUserId).trim(),
          };
        }
      }
    } catch (_) {}
  } else if (githubToken) {
    const ghRes = await verifyGitHubTokenIdentity(githubToken);
    if (!ghRes.ok) {
      return {
        isOwner: false,
        error: 'GitHub authentication failed.',
        screenName,
      };
    }
    verifiedGh = ghRes;
  }

  if (verifiedGh) {
    const ghResolvedName = await resolveScreenNameFromGitHub(
      kv,
      verifiedGh.githubUsername,
      verifiedGh.githubUserId,
      screenName
    );
    if (ghResolvedName) {
      screenName = ghResolvedName;
    }

    // Pure GitHub Login check (before unlockKey/password so already-linked GitHub identity unlocks immediately)
    if (screenName && !unlockKey) {
      const authRec = await loadUserAuthRecord(kv, screenName);
      const mappedKey =
        (kv && (await kv.get(`gh_id_license/${verifiedGh.githubUserId}`, { type: 'text' }))) ||
        (kv && (await kv.get(`gh_license/${verifiedGh.githubUsername.toLowerCase()}`, { type: 'text' }))) ||
        (kv && (await kv.get(`user_license/${screenName}`, { type: 'text' }))) ||
        (kv && (await kv.get(`user_license/${screenName.toLowerCase()}`, { type: 'text' }))) ||
        '';
      let lic = mappedKey ? await loadLicenseByKey(kv, mappedKey) : null;
      if (!lic) {
        lic = await loadLicenseByGitHubFallback(kv, verifiedGh.githubUsername, verifiedGh.githubUserId);
      }
      const chk = await checkScreenNameRegistration(kv, screenName, '', verifiedGh.githubUserId);

      // Strictly require explicit prior GitHub ID/username binding (or an unclaimed brand-new free account);
      // NEVER grant ownership of an existing account merely because the GitHub username matches screenName!
      const ghMatchesAuthRec =
        authRec &&
        ((authRec.githubUserId && String(authRec.githubUserId) === verifiedGh.githubUserId) ||
          (!authRec.githubUserId &&
            authRec.githubUsername &&
            String(authRec.githubUsername).toLowerCase() === verifiedGh.githubUsername.toLowerCase()));
      const ghMatchesLic =
        lic &&
        ((lic.boundGitHubUserId && String(lic.boundGitHubUserId) === verifiedGh.githubUserId) ||
          (!lic.boundGitHubUserId &&
            lic.boundGitHubUsername &&
            String(lic.boundGitHubUsername).toLowerCase() === verifiedGh.githubUsername.toLowerCase()));
      const isUnclaimedNewAccount =
        chk.available &&
        !lic &&
        !authRec &&
        verifiedGh.githubUsername.toLowerCase() === screenName.toLowerCase();

      if (ghMatchesAuthRec || ghMatchesLic || isUnclaimedNewAccount) {
        const resolvedUser = (lic && lic.boundScreenName) || (authRec && authRec.screenName) || screenName;
        const updatedAuth = authRec || { screenName: resolvedUser, sessionEpoch: 1 };
        updatedAuth.githubUsername = verifiedGh.githubUsername;
        updatedAuth.githubUserId = verifiedGh.githubUserId;
        if (lic && lic.key && ghMatchesLic) {
          updatedAuth.boundKey = lic.key;
          lic.boundGitHubUsername = verifiedGh.githubUsername;
          lic.boundGitHubUserId = verifiedGh.githubUserId;
          await saveLicenseRecord(kv, lic);
        }
        await saveUserAuthRecord(kv, resolvedUser, updatedAuth);

        const licInfo = await resolveUserLicense(
          env,
          kv,
          resolvedUser,
          lic && ghMatchesLic ? lic.key : '',
          verifiedGh.githubUsername,
          verifiedGh.githubUserId,
          devHash,
          '',
          { isServerVerifiedGh: true, revealFullKey: false }
        );
        const mintedSession = await createVaultSessionToken(
          env,
          resolvedUser,
          licInfo.tier || 'free',
          365,
          updatedAuth.sessionEpoch || 1
        );
        return {
          isOwner: true,
          authMethod: 'github',
          screenName: resolvedUser,
          licenseInfo: licInfo,
          authRecord: updatedAuth,
          sessionToken: mintedSession,
        };
      }
    }
  }

  // 3. Check Explicit Unlock Key / Token (`X-SilphScope-Unlock-Key`)
  if (unlockKey) {
    const adminExpected = String(env.ADMIN_API_KEY || '').trim();
    if (adminExpected && timingSafeEqualStr(unlockKey, adminExpected) && screenName) {
      const mappedKey =
        (kv && (await kv.get(`user_license/${screenName}`, { type: 'text' }))) ||
        (kv && (await kv.get(`user_license/${screenName.toLowerCase()}`, { type: 'text' }))) ||
        '';
      const licInfo = mappedKey
        ? await resolveUserLicense(env, kv, screenName, mappedKey, '', '', '', '', { revealFullKey: true })
        : { ...TIER_PRESETS.vip, active: true, everPaid: true, boundScreenName: screenName };
      const authRec = await loadUserAuthRecord(kv, screenName);
      const mintedSession = await createVaultSessionToken(
        env,
        screenName,
        licInfo.tier || 'vip',
        365,
        (authRec && authRec.sessionEpoch) || 1
      );
      return {
        isOwner: true,
        authMethod: 'admin_key',
        screenName,
        licenseInfo: licInfo,
        authRecord: authRec,
        sessionToken: mintedSession,
      };
    }

    const licInfo = await resolveUserLicense(
      env,
      kv,
      screenName,
      unlockKey,
      verifiedGh ? verifiedGh.githubUsername : '',
      verifiedGh ? verifiedGh.githubUserId : '',
      devHash,
      claimEmail,
      { isServerVerifiedGh: Boolean(verifiedGh), revealFullKey: true }
    );
    if (licInfo.active) {
      const resolvedUser = licInfo.boundScreenName || screenName;
      let authRec = (await loadUserAuthRecord(kv, resolvedUser)) || {
        screenName: resolvedUser,
        sessionEpoch: 1,
      };
      if (verifiedGh) {
        authRec.githubUsername = verifiedGh.githubUsername;
        authRec.githubUserId = verifiedGh.githubUserId;
        await saveUserAuthRecord(kv, resolvedUser, authRec);
      }
      const mintedSession = await createVaultSessionToken(
        env,
        resolvedUser,
        licInfo.tier,
        365,
        authRec.sessionEpoch || 1
      );
      return {
        isOwner: true,
        authMethod: 'unlock_key',
        screenName: resolvedUser,
        licenseInfo: licInfo,
        authRecord: authRec,
        sessionToken: mintedSession,
      };
    }
    return {
      isOwner: false,
      error: licInfo.error || 'Invalid Unlock Key.',
      screenName,
    };
  }

  // 4. Check Username + Password (`X-Vault-Password` or `body.password`)
  if (password && screenName) {
    const authRec = await loadUserAuthRecord(kv, screenName);
    if (!authRec || !authRec.passwordHash || !authRec.passwordSalt) {
      return {
        isOwner: false,
        error: 'Invalid Trainer ID or password.',
        screenName,
      };
    }
    const pwVerify = await verifyUserPassword(
      env,
      password,
      authRec.passwordSalt,
      authRec.passwordHash
    );
    if (!pwVerify.valid) {
      return {
        isOwner: false,
        error: 'Invalid Trainer ID or password.',
        screenName,
      };
    }
    const resolvedUser = authRec.screenName || screenName;
    let shouldSaveAuth = false;
    if (pwVerify.needsUpgrade) {
      const newSalt = generateSecureSaltHex(16);
      authRec.passwordSalt = newSalt;
      authRec.passwordHash = await hashUserPassword(env, password, newSalt);
      shouldSaveAuth = true;
    }
    if (verifiedGh) {
      authRec.githubUsername = verifiedGh.githubUsername;
      authRec.githubUserId = verifiedGh.githubUserId;
      shouldSaveAuth = true;
    }
    if (shouldSaveAuth) {
      await saveUserAuthRecord(kv, resolvedUser, authRec);
    }
    const mappedKey =
      authRec.boundKey ||
      (kv && (await kv.get(`user_license/${resolvedUser}`, { type: 'text' }))) ||
      (kv && (await kv.get(`user_license/${resolvedUser.toLowerCase()}`, { type: 'text' }))) ||
      '';
    const licInfo = await resolveUserLicense(
      env,
      kv,
      resolvedUser,
      mappedKey,
      authRec.githubUsername || '',
      authRec.githubUserId || '',
      devHash,
      '',
      { isServerVerifiedGh: Boolean(authRec.githubUserId), revealFullKey: false }
    );
    const mintedSession = await createVaultSessionToken(
      env,
      resolvedUser,
      licInfo.tier || 'free',
      365,
      authRec.sessionEpoch || 1
    );
    return {
      isOwner: true,
      authMethod: 'password',
      screenName: resolvedUser,
      licenseInfo: licInfo,
      authRecord: authRec,
      sessionToken: mintedSession,
    };
  }

  // 4b. Check Bound Device Hash (`X-Device-Hash`, `body.deviceHash`, or `body.deviceId`) for app uploads
  if (
    devHash &&
    devHash.length >= 8 &&
    !devHash.toLowerCase().startsWith('web-') &&
    screenName &&
    kv
  ) {
    const cleanDev = devHash.toLowerCase();
    const mappedKey =
      (await kv.get(`user_license/${screenName}`, { type: 'text' })) ||
      (await kv.get(`user_license/${screenName.toLowerCase()}`, { type: 'text' })) ||
      '';
    const licCandidate = mappedKey ? await loadLicenseByKey(kv, mappedKey) : null;
    let regDeviceMatch = false;
    try {
      const rawReg = await kv.get(`registered_user/${screenName.toLowerCase()}`, { type: 'text' });
      if (rawReg) {
        const parsedReg = JSON.parse(rawReg);
        if (parsedReg && parsedReg.deviceHash && String(parsedReg.deviceHash).toLowerCase() === cleanDev) {
          regDeviceMatch = true;
        }
      }
    } catch (_) {}
    if (
      regDeviceMatch ||
      (licCandidate &&
        licCandidate.boundDeviceHash &&
        String(licCandidate.boundDeviceHash).toLowerCase() === cleanDev)
    ) {
      const licInfo = await resolveUserLicense(
        env,
        kv,
        screenName,
        mappedKey,
        '',
        '',
        devHash,
        '',
        { revealFullKey: false, isOwnerCaller: true }
      );
      return {
        isOwner: true,
        authMethod: 'bound_device',
        screenName,
        licenseInfo: licInfo,
      };
    }
  }

  // 5. If verifiedGh was present but did not match an existing linked account
  if (verifiedGh && screenName) {
    return {
      isOwner: false,
      error: `GitHub account '@${verifiedGh.githubUsername}' is not linked to Trainer ID '@${screenName}' yet. Log in once with your Unlock Key or Password while signed into GitHub to link them.`,
      screenName,
    };
  }

  return { isOwner: false, screenName };
}

// =============================================================================
// Cloudflare D1 Multi-Device Vault Sync & Userbase-Wide Meta Engine (v7.31)
// =============================================================================

function computeGblSeasonId(timestampMs = Date.now()) {
  const ts = Number(timestampMs) || Date.now();
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  // Anchor boundaries (Dec 1, Mar 1, Jun 1, Sep 1 at 21:00 UTC)
  const decPrev = Date.UTC(y - 1, 11, 1, 21, 0, 0);
  const marCur = Date.UTC(y, 2, 1, 21, 0, 0);
  const junCur = Date.UTC(y, 5, 1, 21, 0, 0);
  const sepCur = Date.UTC(y, 8, 1, 21, 0, 0);
  const decCur = Date.UTC(y, 11, 1, 21, 0, 0);

  if (ts >= decCur) return `${y + 1}_S1`;
  if (ts >= sepCur) return `${y}_S4`;
  if (ts >= junCur) return `${y}_S3`;
  if (ts >= marCur) return `${y}_S2`;
  if (ts >= decPrev) return `${y}_S1`;
  return `${y}_S0`;
}

const FORBIDDEN_VAULT_SETTING_SUBSTRINGS = [
  'unlock_key',
  'github_token',
  'device_ingest_token',
  'vault_session',
];

function sanitizeVaultSettingsForD1(rawSettings) {
  if (!rawSettings || typeof rawSettings !== 'object') return {};
  const clean = {};
  for (const [k, v] of Object.entries(rawSettings)) {
    if (typeof k !== 'string' || k.length > 120) continue;
    const lowerK = k.toLowerCase();
    if (FORBIDDEN_VAULT_SETTING_SUBSTRINGS.some((sub) => lowerK.includes(sub))) continue;
    const strVal = v === null || v === undefined ? '' : String(v);
    if (
      strVal.startsWith('ENC_GCM_V1:') ||
      strVal.startsWith('KS_GCM_V1:') ||
      strVal.startsWith('enc1:') ||
      strVal.length > 16384
    ) {
      continue;
    }
    clean[k] = strVal;
  }
  return clean;
}

function cleanPokemonSpeciesName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().slice(0, 64);
}

async function authenticateD1SyncCaller(request, env, kv, targetScreenName, body = {}) {
  const screenName = sanitizeScreenName(
    targetScreenName ||
      body.screenName ||
      request.headers.get('X-Trainer-Screen-Name') ||
      ''
  );
  if (!screenName) {
    return {
      ok: false,
      status: 400,
      error: 'Valid Trainer ID (3-24 characters) is required for Cloud Vault Sync.',
    };
  }

  const devHash = String(
    body.deviceHash || body.deviceId || request.headers.get('X-Device-Hash') || ''
  ).trim();
  const isValidNonWebDevice = devHash.length >= 8 && !devHash.toLowerCase().startsWith('web-');
  const isInitialMigration = Boolean(body && body.isInitialMigration);

  const authRec = await loadUserAuthRecord(kv, screenName);
  const hasPassword = Boolean(authRec && authRec.passwordHash);

  const ownerAuth = await authenticateVaultOwner(request, env, kv, screenName, body);
  if (ownerAuth.isOwner) {
    // Once a Vault Password is set, require session / password / unlock_key / admin_key for normal sync,
    // EXCEPT allow one-time initial device migration from the already-registered primary hardware device (`perform migrations without the password`).
    if (
      hasPassword &&
      ownerAuth.authMethod === 'bound_device' &&
      !isInitialMigration
    ) {
      return {
        ok: false,
        status: 403,
        screenName,
        hasPassword: true,
        requiresPassword: true,
        error: `Cloud Vault '@${screenName}' is secured with a password. Sign in once with your Vault Password on this device to continue syncing.`,
      };
    }

    const resolvedName = ownerAuth.screenName || screenName;
    const licInfo =
      ownerAuth.licenseInfo ||
      (await resolveUserLicense(env, kv, resolvedName, '', '', '', devHash, '', {
        revealFullKey: false,
      }));
    return {
      ok: true,
      screenName: resolvedName,
      authMethod: ownerAuth.authMethod,
      sessionToken: ownerAuth.sessionToken || '',
      hasPassword,
      promptSetPassword: !hasPassword && !/^id_[a-z0-9]{4,}$/i.test(resolvedName),
      licenseInfo: licInfo,
      isPaidOrAlumni: Boolean(
        licInfo && (licInfo.active || licInfo.everPaid || (licInfo.tier && licInfo.tier !== 'free'))
      ),
    };
  }

  // Passwordless Migration & Primary Device Auto-Binding when `hasPassword === false`:
  if (!hasPassword && isValidNonWebDevice && kv) {
    const clientAuth = await verifyClientAuth(request, env, true, false);
    if (clientAuth.ok) {
      const chk = await checkScreenNameRegistration(kv, screenName, devHash, '');
      if (chk.available && (!chk.record || chk.ownedByCaller)) {
        if (!chk.record) {
          const nowIso = new Date().toISOString();
          await kv.put(
            `registered_user/${screenName.toLowerCase()}`,
            JSON.stringify({
              screenName,
              deviceHash: devHash,
              registeredAt: nowIso,
              updatedAt: nowIso,
            })
          );
        }
        const licInfo = await resolveUserLicense(env, kv, screenName, '', '', '', devHash, '', {
          revealFullKey: false,
        });
        return {
          ok: true,
          screenName,
          authMethod: 'primary_device_passwordless',
          sessionToken: '',
          hasPassword: false,
          promptSetPassword: !/^id_[a-z0-9]{4,}$/i.test(screenName),
          licenseInfo: licInfo,
          isPaidOrAlumni: Boolean(
            licInfo && (licInfo.active || licInfo.everPaid || (licInfo.tier && licInfo.tier !== 'free'))
          ),
        };
      }
      return {
        ok: false,
        status: 403,
        screenName,
        hasPassword: false,
        requiresPassword: false,
        error: `Trainer ID '@${screenName}' belongs to another registered device. Set a Vault Password on your primary device first, then sign in with your password here.`,
      };
    }
  }

  return {
    ok: false,
    status: 403,
    screenName,
    hasPassword,
    requiresPassword: hasPassword,
    error: hasPassword
      ? ownerAuth.error || `Enter the Vault Password for '@${screenName}' to sync across devices.`
      : ownerAuth.error || `Set a Vault Password on your primary '@${screenName}' phone first to sync on additional devices or Web.`,
  };
}

async function upsertVaultBatchIntoD1(
  db,
  screenName,
  {
    settingsMap = null,
    settingsUpdatedAt = 0,
    battleLogs = [],
    teamPresets = [],
    deletedLogIds = [],
    deletedTeamIds = [],
    source = 'app_sync',
    migratedFromGithub = false,
  } = {}
) {
  if (!db) throw new Error('SYNC_DB (Cloudflare D1) is not bound.');
  const cleanUser = sanitizeScreenName(screenName);
  if (!cleanUser) throw new Error('Invalid screenName');

  const nowMs = Date.now();
  const incomingLogs = Array.isArray(battleLogs) ? battleLogs : [];
  const incomingTeams = Array.isArray(teamPresets) ? teamPresets : [];
  const incomingDelLogs = Array.isArray(deletedLogIds) ? deletedLogIds : [];
  const incomingDelTeams = Array.isArray(deletedTeamIds) ? deletedTeamIds : [];
  const cleanIncomingSettings =
    settingsMap && typeof settingsMap === 'object' ? sanitizeVaultSettingsForD1(settingsMap) : null;
  const hasSettingsIncoming =
    cleanIncomingSettings !== null && Object.keys(cleanIncomingSettings).length > 0;

  const hasAnyWrites =
    hasSettingsIncoming ||
    incomingLogs.length > 0 ||
    incomingTeams.length > 0 ||
    incomingDelLogs.length > 0 ||
    incomingDelTeams.length > 0 ||
    migratedFromGithub;

  if (!hasAnyWrites) {
    return { wroteAnything: false, serverUpdatedMs: 0, logsUpserted: 0, teamsUpserted: 0 };
  }

  const existingState = await db
    .prepare(
      'SELECT settings_json, settings_updated_at, migrated_from_github, migrated_at_ms FROM user_vault_state WHERE screen_name = ?1'
    )
    .bind(cleanUser)
    .first();

  let mergedSettingsObj = {};
  let mergedSettingsUpdAt = Number(existingState?.settings_updated_at) || 0;
  if (existingState?.settings_json) {
    try {
      mergedSettingsObj = sanitizeVaultSettingsForD1(JSON.parse(existingState.settings_json));
    } catch (_) {}
  }

  if (hasSettingsIncoming) {
    const incUpd = Number(settingsUpdatedAt) || 0;
    if (incUpd >= mergedSettingsUpdAt || Object.keys(mergedSettingsObj).length === 0) {
      mergedSettingsObj = { ...mergedSettingsObj, ...cleanIncomingSettings };
      mergedSettingsUpdAt = Math.max(incUpd, mergedSettingsUpdAt, 1);
    } else {
      mergedSettingsObj = { ...cleanIncomingSettings, ...mergedSettingsObj };
    }
  }

  const migFlag = migratedFromGithub || Number(existingState?.migrated_from_github) === 1 ? 1 : 0;
  const migAt =
    Number(existingState?.migrated_at_ms) > 0
      ? Number(existingState.migrated_at_ms)
      : migratedFromGithub
      ? nowMs
      : 0;

  const statements = [];

  // 1. Upsert battle logs
  const delLogSet = new Set(
    incomingDelLogs.map((id) => String(id || '').trim()).filter((id) => id.length > 0 && id.length <= 128)
  );
  const seenLogIds = new Set();
  let logsUpserted = 0;

  const logUpsertSql = `
    INSERT INTO battle_logs (
      screen_name, log_id, season_id, league, combat_mode, result, lead_matchup,
      user_lead, user_back1, user_back2, opp_lead, opp_back1, opp_back2,
      first_swap_actor, switch_advantage, bmf_score, exec_wae,
      timestamp_ms, updated_at, server_updated_ms, deleted, source, payload_json
    ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, ?7,
      ?8, ?9, ?10, ?11, ?12, ?13,
      ?14, ?15, ?16, ?17,
      ?18, ?19, ?20, ?21, ?22, ?23
    )
    ON CONFLICT(screen_name, log_id) DO UPDATE SET
      season_id = excluded.season_id,
      league = excluded.league,
      combat_mode = excluded.combat_mode,
      result = excluded.result,
      lead_matchup = excluded.lead_matchup,
      user_lead = excluded.user_lead,
      user_back1 = excluded.user_back1,
      user_back2 = excluded.user_back2,
      opp_lead = excluded.opp_lead,
      opp_back1 = excluded.opp_back1,
      opp_back2 = excluded.opp_back2,
      first_swap_actor = excluded.first_swap_actor,
      switch_advantage = excluded.switch_advantage,
      bmf_score = excluded.bmf_score,
      exec_wae = excluded.exec_wae,
      timestamp_ms = excluded.timestamp_ms,
      updated_at = excluded.updated_at,
      server_updated_ms = excluded.server_updated_ms,
      deleted = excluded.deleted,
      source = excluded.source,
      payload_json = CASE WHEN excluded.deleted = 1 AND battle_logs.payload_json != '' THEN battle_logs.payload_json ELSE excluded.payload_json END
    WHERE excluded.updated_at >= battle_logs.updated_at OR (excluded.deleted = 1 AND battle_logs.deleted = 0)
  `;

  for (const rawLog of incomingLogs) {
    if (!rawLog || typeof rawLog !== 'object') continue;
    const logId = String(rawLog.id || '').trim();
    if (!logId || logId.length > 128 || seenLogIds.has(logId)) continue;
    seenLogIds.add(logId);

    const isDel = delLogSet.has(logId) || Boolean(rawLog.deleted) ? 1 : 0;
    const tsMs = Math.max(1, Number(rawLog.timestampMs) || nowMs);
    const updMs = Math.max(tsMs, Number(rawLog.updatedAt) || tsMs);
    const seasonId = computeGblSeasonId(tsMs);
    const league = String(rawLog.league || 'GREAT LEAGUE').trim().toUpperCase().slice(0, 64);
    const combatMode =
      rawLog.combatMode === 'show6' || league.includes('SHOW 6') ? 'show6' : 'gbl';
    const result = String(rawLog.result || 'WIN').trim().toUpperCase().slice(0, 16);
    const leadMatchup = String(rawLog.leadMatchup || 'NEUTRAL').trim().toUpperCase().slice(0, 24);
    const uPokes = Array.isArray(rawLog.userPokemon) ? rawLog.userPokemon : [];
    const oPokes = Array.isArray(rawLog.opponents) ? rawLog.opponents : [];
    const firstSwap = String(rawLog.firstSwapActor || '').trim().toUpperCase().slice(0, 16);
    const switchAdv = String(rawLog.switchAdvantage || '').trim().toUpperCase().slice(0, 16);
    const bmf = rawLog.bmfScore !== null && rawLog.bmfScore !== undefined && Number.isFinite(Number(rawLog.bmfScore))
      ? Number(rawLog.bmfScore)
      : null;
    const wae = rawLog.execWae !== null && rawLog.execWae !== undefined && Number.isFinite(Number(rawLog.execWae))
      ? Number(rawLog.execWae)
      : null;
    const payloadStr = JSON.stringify(rawLog);
    if (payloadStr.length > 131072) continue;

    statements.push(
      db.prepare(logUpsertSql).bind(
        cleanUser,
        logId,
        seasonId,
        league,
        combatMode,
        result,
        leadMatchup,
        cleanPokemonSpeciesName(uPokes[0]),
        cleanPokemonSpeciesName(uPokes[1]),
        cleanPokemonSpeciesName(uPokes[2]),
        cleanPokemonSpeciesName(oPokes[0]),
        cleanPokemonSpeciesName(oPokes[1]),
        cleanPokemonSpeciesName(oPokes[2]),
        firstSwap,
        switchAdv,
        bmf,
        wae,
        tsMs,
        updMs,
        nowMs,
        isDel,
        String(source || 'app_sync').slice(0, 32),
        payloadStr
      )
    );
    logsUpserted++;
  }

  for (const delId of delLogSet) {
    if (seenLogIds.has(delId)) continue;
    seenLogIds.add(delId);
    statements.push(
      db
        .prepare(
          `INSERT INTO battle_logs (
            screen_name, log_id, season_id, league, combat_mode, result, lead_matchup,
            timestamp_ms, updated_at, server_updated_ms, deleted, source, payload_json
          ) VALUES (?1, ?2, ?3, 'GREAT LEAGUE', 'gbl', 'LOSS', 'NEUTRAL', ?4, ?4, ?4, 1, ?5, ?6)
          ON CONFLICT(screen_name, log_id) DO UPDATE SET
            deleted = 1,
            updated_at = MAX(battle_logs.updated_at, excluded.updated_at),
            server_updated_ms = excluded.server_updated_ms`
        )
        .bind(
          cleanUser,
          delId,
          computeGblSeasonId(nowMs),
          nowMs,
          String(source || 'app_sync').slice(0, 32),
          JSON.stringify({ id: delId, deleted: true })
        )
    );
  }

  // 2. Upsert team presets
  const delTeamSet = new Set(
    incomingDelTeams.map((id) => String(id || '').trim()).filter((id) => id.length > 0 && id.length <= 128)
  );
  const seenTeamIds = new Set();
  let teamsUpserted = 0;

  const teamUpsertSql = `
    INSERT INTO team_presets (
      screen_name, team_id, name, league, combat_mode, archetype,
      sort_order, updated_at, server_updated_ms, deleted, payload_json
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    ON CONFLICT(screen_name, team_id) DO UPDATE SET
      name = excluded.name,
      league = excluded.league,
      combat_mode = excluded.combat_mode,
      archetype = excluded.archetype,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      server_updated_ms = excluded.server_updated_ms,
      deleted = excluded.deleted,
      payload_json = CASE WHEN excluded.deleted = 1 AND team_presets.payload_json != '' THEN team_presets.payload_json ELSE excluded.payload_json END
    WHERE excluded.updated_at >= team_presets.updated_at OR (excluded.deleted = 1 AND team_presets.deleted = 0)
  `;

  for (let idx = 0; idx < incomingTeams.length; idx++) {
    const rawTeam = incomingTeams[idx];
    if (!rawTeam || typeof rawTeam !== 'object') continue;
    const teamId = String(rawTeam.id || '').trim();
    if (!teamId || teamId.length > 128 || seenTeamIds.has(teamId)) continue;
    seenTeamIds.add(teamId);

    const isDel = delTeamSet.has(teamId) || Boolean(rawTeam.deleted) ? 1 : 0;
    const updMs = Math.max(1, Number(rawTeam.updatedAt) || nowMs);
    const name = String(rawTeam.name || '').trim().slice(0, 80);
    const league = String(rawTeam.league || 'GREAT LEAGUE').trim().toUpperCase().slice(0, 64);
    const combatMode = rawTeam.combatMode === 'show6' ? 'show6' : 'gbl';
    const archetype = String(rawTeam.archetype || 'ABC').trim().slice(0, 24);
    const payloadStr = JSON.stringify(rawTeam);
    if (payloadStr.length > 65536) continue;

    statements.push(
      db.prepare(teamUpsertSql).bind(
        cleanUser,
        teamId,
        name,
        league,
        combatMode,
        archetype,
        idx,
        updMs,
        nowMs,
        isDel,
        payloadStr
      )
    );
    teamsUpserted++;
  }

  for (const delTid of delTeamSet) {
    if (seenTeamIds.has(delTid)) continue;
    seenTeamIds.add(delTid);
    statements.push(
      db
        .prepare(
          `INSERT INTO team_presets (
            screen_name, team_id, name, league, combat_mode, archetype,
            sort_order, updated_at, server_updated_ms, deleted, payload_json
          ) VALUES (?1, ?2, '', 'GREAT LEAGUE', 'gbl', 'ABC', 999, ?3, ?3, 1, ?4)
          ON CONFLICT(screen_name, team_id) DO UPDATE SET
            deleted = 1,
            updated_at = MAX(team_presets.updated_at, excluded.updated_at),
            server_updated_ms = excluded.server_updated_ms`
        )
        .bind(cleanUser, delTid, nowMs, JSON.stringify({ id: delTid, deleted: true }))
    );
  }

  // Execute statements in safe D1 chunks of 60
  const CHUNK_SIZE = 60;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    await db.batch(statements.slice(i, i + CHUNK_SIZE));
  }

  // Update user_vault_state summary + server_updated_ms
  const countsRow = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM battle_logs WHERE screen_name = ?1 AND deleted = 0) AS activeLogs,
        (SELECT COUNT(*) FROM team_presets WHERE screen_name = ?1 AND deleted = 0) AS activeTeams`
    )
    .bind(cleanUser)
    .first();

  const totalActiveLogs = Number(countsRow?.activeLogs) || 0;
  const totalActiveTeams = Number(countsRow?.activeTeams) || 0;

  await db
    .prepare(
      `INSERT INTO user_vault_state (
        screen_name, display_screen_name, settings_json, settings_updated_at,
        migrated_from_github, migrated_at_ms, server_updated_ms, total_active_logs, total_active_teams
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(screen_name) DO UPDATE SET
        display_screen_name = excluded.display_screen_name,
        settings_json = excluded.settings_json,
        settings_updated_at = excluded.settings_updated_at,
        migrated_from_github = MAX(user_vault_state.migrated_from_github, excluded.migrated_from_github),
        migrated_at_ms = CASE WHEN user_vault_state.migrated_at_ms > 0 THEN user_vault_state.migrated_at_ms ELSE excluded.migrated_at_ms END,
        server_updated_ms = excluded.server_updated_ms,
        total_active_logs = excluded.total_active_logs,
        total_active_teams = excluded.total_active_teams`
    )
    .bind(
      cleanUser,
      cleanUser,
      JSON.stringify(mergedSettingsObj),
      mergedSettingsUpdAt,
      migFlag,
      migAt,
      nowMs,
      totalActiveLogs,
      totalActiveTeams
    )
    .run();

  return {
    wroteAnything: true,
    serverUpdatedMs: nowMs,
    logsUpserted,
    teamsUpserted,
    totalActiveLogs,
    totalActiveTeams,
  };
}

async function pullVaultDeltasFromD1(
  db,
  screenName,
  { sinceServerMs = 0, isPaidOrAlumni = false } = {}
) {
  if (!db) throw new Error('SYNC_DB (Cloudflare D1) is not bound.');
  const cleanUser = sanitizeScreenName(screenName);
  const sinceMs = Math.max(0, Number(sinceServerMs) || 0);

  // 1-Row Short-Circuit Check on user_vault_state (1 row read out of 5M/day when caught up!)
  const stateRow = await db
    .prepare(
      `SELECT display_screen_name, settings_json, settings_updated_at, migrated_from_github,
              server_updated_ms, total_active_logs, total_active_teams
       FROM user_vault_state WHERE screen_name = ?1`
    )
    .bind(cleanUser)
    .first();

  if (!stateRow) {
    return {
      shortCircuited: true,
      serverSyncMs: 0,
      settings: {},
      settingsUpdatedAt: 0,
      migratedFromGithub: false,
      totalActiveLogs: 0,
      totalActiveTeams: 0,
      upsertedLogs: [],
      deletedLogIds: [],
      upsertedTeams: [],
      deletedTeamIds: [],
    };
  }

  const serverUpdatedMs = Number(stateRow.server_updated_ms) || 0;
  if (sinceMs > 0 && serverUpdatedMs <= sinceMs) {
    return {
      shortCircuited: true,
      serverSyncMs: serverUpdatedMs,
      settings: null,
      settingsUpdatedAt: Number(stateRow.settings_updated_at) || 0,
      migratedFromGithub: Number(stateRow.migrated_from_github) === 1,
      totalActiveLogs: Number(stateRow.total_active_logs) || 0,
      totalActiveTeams: Number(stateRow.total_active_teams) || 0,
      upsertedLogs: [],
      deletedLogIds: [],
      upsertedTeams: [],
      deletedTeamIds: [],
    };
  }

  let parsedSettings = {};
  if (stateRow.settings_json) {
    try {
      parsedSettings = sanitizeVaultSettingsForD1(JSON.parse(stateRow.settings_json));
    } catch (_) {}
  }

  // Free Tier vs Paid/Alumni retention window (Free = Current Season + 14d grace; Paid/Alumni = Unlimited Lifetime)
  const minTimestampMs = isPaidOrAlumni
    ? 0
    : Math.max(0, getActiveGblSeasonWindow().startMs - 14 * 86400000);

  const logsQuery = isPaidOrAlumni
    ? db
        .prepare(
          `SELECT log_id, deleted, payload_json
           FROM battle_logs
           WHERE screen_name = ?1 AND server_updated_ms > ?2
           ORDER BY timestamp_ms DESC
           LIMIT 5000`
        )
        .bind(cleanUser, sinceMs)
    : db
        .prepare(
          `SELECT log_id, deleted, payload_json
           FROM battle_logs
           WHERE screen_name = ?1 AND server_updated_ms > ?2
             AND (deleted = 1 OR timestamp_ms >= ?3)
           ORDER BY timestamp_ms DESC
           LIMIT 2000`
        )
        .bind(cleanUser, sinceMs, minTimestampMs);

  const teamsQuery = db
    .prepare(
      `SELECT team_id, deleted, payload_json
       FROM team_presets
       WHERE screen_name = ?1 AND server_updated_ms > ?2
       ORDER BY sort_order ASC, updated_at DESC
       LIMIT 500`
    )
    .bind(cleanUser, sinceMs);

  const [logsRes, teamsRes] = await db.batch([logsQuery, teamsQuery]);

  const upsertedLogs = [];
  const deletedLogIds = [];
  for (const r of logsRes?.results || []) {
    if (Number(r.deleted) === 1) {
      deletedLogIds.push(r.log_id);
    } else if (r.payload_json) {
      try {
        upsertedLogs.push(JSON.parse(r.payload_json));
      } catch (_) {}
    }
  }

  const upsertedTeams = [];
  const deletedTeamIds = [];
  for (const r of teamsRes?.results || []) {
    if (Number(r.deleted) === 1) {
      deletedTeamIds.push(r.team_id);
    } else if (r.payload_json) {
      try {
        upsertedTeams.push(JSON.parse(r.payload_json));
      } catch (_) {}
    }
  }

  return {
    shortCircuited: false,
    serverSyncMs: serverUpdatedMs,
    settings: parsedSettings,
    settingsUpdatedAt: Number(stateRow.settings_updated_at) || 0,
    migratedFromGithub: Number(stateRow.migrated_from_github) === 1,
    totalActiveLogs: Number(stateRow.total_active_logs) || 0,
    totalActiveTeams: Number(stateRow.total_active_teams) || 0,
    upsertedLogs,
    deletedLogIds,
    upsertedTeams,
    deletedTeamIds,
  };
}

async function queryGlobalMetaSummaryFromD1(
  db,
  { league = '', seasonId = '', combatMode = '', sinceDays = 0, topLimit = 40 } = {}
) {
  if (!db) throw new Error('SYNC_DB (Cloudflare D1) is not bound.');
  const conditions = ['deleted = 0'];
  const binds = [];

  if (league) {
    binds.push(String(league).trim().toUpperCase());
    conditions.push(`league = ?${binds.length}`);
  }
  if (seasonId) {
    binds.push(String(seasonId).trim());
    conditions.push(`season_id = ?${binds.length}`);
  }
  if (combatMode) {
    binds.push(String(combatMode).trim().toLowerCase());
    conditions.push(`combat_mode = ?${binds.length}`);
  }
  if (Number(sinceDays) > 0) {
    const cutoff = Date.now() - Number(sinceDays) * 86400000;
    binds.push(cutoff);
    conditions.push(`timestamp_ms >= ?${binds.length}`);
  }

  const whereClause = conditions.join(' AND ');
  const lim = Math.min(Math.max(5, Number(topLimit) || 40), 150);

  const qTotals = db
    .prepare(
      `SELECT
        COUNT(*) AS totalBattles,
        COUNT(DISTINCT screen_name) AS uniqueTrainers,
        MIN(timestamp_ms) AS earliestBattleMs,
        MAX(timestamp_ms) AS latestBattleMs,
        ROUND(AVG(CASE WHEN result = 'WIN' THEN 100.0 ELSE 0.0 END), 2) AS avgUserWinRatePct,
        ROUND(AVG(bmf_score), 3) AS avgBmfScore,
        ROUND(AVG(exec_wae), 3) AS avgExecWae
       FROM battle_logs
       WHERE ${whereClause}`
    )
    .bind(...binds);

  const qByLeague = db
    .prepare(
      `SELECT league, season_id AS seasonId, COUNT(*) AS battles, COUNT(DISTINCT screen_name) AS trainers
       FROM battle_logs
       WHERE ${whereClause}
       GROUP BY league, season_id
       ORDER BY battles DESC`
    )
    .bind(...binds);

  const qOppLeads = db
    .prepare(
      `SELECT
        opp_lead AS species,
        COUNT(*) AS count,
        SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS oppWins,
        SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS userWins
       FROM battle_logs
       WHERE ${whereClause} AND opp_lead != ''
       GROUP BY opp_lead
       ORDER BY count DESC
       LIMIT ${lim}`
    )
    .bind(...binds);

  const qOppOverall = db
    .prepare(
      `WITH slots AS (
        SELECT opp_lead AS species, result FROM battle_logs WHERE ${whereClause} AND opp_lead != ''
        UNION ALL
        SELECT opp_back1 AS species, result FROM battle_logs WHERE ${whereClause} AND opp_back1 != ''
        UNION ALL
        SELECT opp_back2 AS species, result FROM battle_logs WHERE ${whereClause} AND opp_back2 != ''
      )
      SELECT
        species,
        COUNT(*) AS appearances,
        SUM(CASE WHEN result = 'LOSS' THEN 1 ELSE 0 END) AS oppWins
      FROM slots
      GROUP BY species
      ORDER BY appearances DESC
      LIMIT ${lim}`
    )
    .bind(...binds, ...binds, ...binds);

  const qOppCores = db
    .prepare(
      `WITH cores AS (
        SELECT opp_lead AS leadSpecies, opp_back1 AS backSpecies FROM battle_logs WHERE ${whereClause} AND opp_lead != '' AND opp_back1 != ''
        UNION ALL
        SELECT opp_lead AS leadSpecies, opp_back2 AS backSpecies FROM battle_logs WHERE ${whereClause} AND opp_lead != '' AND opp_back2 != ''
      )
      SELECT leadSpecies, backSpecies, COUNT(*) AS count
      FROM cores
      GROUP BY leadSpecies, backSpecies
      ORDER BY count DESC
      LIMIT ${lim}`
    )
    .bind(...binds, ...binds);

  const qTrainers = db
    .prepare(
      `SELECT screen_name AS screenName, total_active_logs AS activeLogs, total_active_teams AS activeTeams,
              migrated_from_github AS migratedFromGithub, server_updated_ms AS lastSyncedMs
       FROM user_vault_state
       ORDER BY total_active_logs DESC`
    );

  const [resTotals, resLeagues, resLeads, resOverall, resCores, resTrainers] = await db.batch([
    qTotals,
    qByLeague,
    qOppLeads,
    qOppOverall,
    qOppCores,
    qTrainers,
  ]);

  const totals = (resTotals?.results && resTotals.results[0]) || {
    totalBattles: 0,
    uniqueTrainers: 0,
  };
  const totalBattlesNum = Math.max(1, Number(totals.totalBattles) || 0);

  return {
    generatedAt: new Date().toISOString(),
    filters: { league: league || 'ALL', seasonId: seasonId || 'ALL', combatMode: combatMode || 'ALL', sinceDays: Number(sinceDays) || 0 },
    totals,
    trainers: resTrainers?.results || [],
    byLeagueAndSeason: resLeagues?.results || [],
    opponentLeads: (resLeads?.results || []).map((r) => ({
      species: r.species,
      count: Number(r.count) || 0,
      usagePct: Number((((Number(r.count) || 0) * 100) / totalBattlesNum).toFixed(2)),
      oppWinRatePct: Number(
        (((Number(r.oppWins) || 0) * 100) / Math.max(1, Number(r.count) || 1)).toFixed(1)
      ),
    })),
    opponentOverallUsage: (resOverall?.results || []).map((r) => ({
      species: r.species,
      appearances: Number(r.appearances) || 0,
      teamPresencePct: Number((((Number(r.appearances) || 0) * 100) / totalBattlesNum).toFixed(2)),
      oppWinRatePct: Number(
        (((Number(r.oppWins) || 0) * 100) / Math.max(1, Number(r.appearances) || 1)).toFixed(1)
      ),
    })),
    empiricalLeadBacklineCores: resCores?.results || [],
  };
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
  const maxRetentionMs = Math.max(0, Number(license.retentionDays ?? 0)) * 24 * 60 * 60 * 1000;
  const maxPinnedRetentionMs = Math.max(0, Number(license.pinnedRetentionDays ?? 365)) * 24 * 60 * 60 * 1000;
  const maxStorageBytes = Math.max(0, Number(license.maxStorageMb ?? 0)) * 1024 * 1024;
  const maxRolling = Math.max(0, Number(license.maxRollingBattles ?? 0));

  const kept = [];
  // 1. Prune expired items (pinned items use maxPinnedRetentionMs = 365d for Alumni/Pro/VIP; unpinned use maxRetentionMs)
  for (const item of indexObj.items) {
    const uploadedMs = item.uploadedAt ? new Date(item.uploadedAt).getTime() : nowMs;
    const isExpired = item.isPinned
      ? maxPinnedRetentionMs <= 0 || nowMs - uploadedMs > maxPinnedRetentionMs
      : maxRetentionMs <= 0 || nowMs - uploadedMs > maxRetentionMs;
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
 * Clones a replay into persistent `@Featured` showcase storage (`replays/_featured/`)
 * exempt from personal user pruning/quotas, scrubbing personal trainer names to `@Featured`
 * (or optional `communityCredit`) and stripping internal diagnostic notes.
 */
async function cloneReplayToFeatured(env, kv, store, options = {}) {
  const sourceShareId = sanitizeId(options.shareId || '');
  if (!sourceShareId) {
    return { ok: false, error: 'Missing source shareId' };
  }
  const rawLookup = await kv.get(`share_lookup/${sourceShareId}`);
  if (!rawLookup) {
    return { ok: false, error: `Source replay not found: ${sourceShareId}` };
  }
  const source = JSON.parse(rawLookup);
  const featuredId = sanitizeId(
    options.featuredId || `f_${sourceShareId.replace(/^[rf]_/, '')}`
  );
  const communityCredit = options.communityCredit
    ? sanitizeScreenName(options.communityCredit)
    : '';
  const displayScreenName = communityCredit || 'Featured';
  const badgeLabel = String(options.badgeLabel || '🌟 Official Showcase').trim();
  const highlightSec = Number(options.highlightSec) || 0;
  const showcaseTitle = String(options.title || source.matchupSummary || '').trim();

  // 1. Copy Video to `replays/_featured/<featuredId>_video.mp4`
  const featVideoKey = `replays/_featured/${featuredId}_video.mp4`;
  const featTraceKey = `replays/_featured/${featuredId}_trace.jsonl`;
  let videoBytes = Number(source.videoBytes) || 0;
  let traceBytes = Number(source.traceBytes) || 0;

  if (env.REPLAY_BUCKET) {
    let vidBuf = null;
    if (source.videoKey) {
      const vidObj = await env.REPLAY_BUCKET.get(source.videoKey);
      if (vidObj) vidBuf = await vidObj.arrayBuffer();
    }
    if (!vidBuf && source.fallbackKvVideoKey) {
      vidBuf = await store.getBytes(source.fallbackKvVideoKey);
    }
    if (vidBuf) {
      videoBytes = vidBuf.byteLength;
      await env.REPLAY_BUCKET.put(featVideoKey, vidBuf, {
        httpMetadata: { contentType: 'video/mp4' },
        customMetadata: {
          featuredId,
          sourceShareId,
          screenName: displayScreenName,
        },
      });
    }

    let traceText = null;
    if (source.traceKey) {
      const trObj = await env.REPLAY_BUCKET.get(source.traceKey);
      if (trObj) traceText = await trObj.text();
    }
    if (traceText === null && source.fallbackKvTraceKey) {
      traceText = await store.getText(source.fallbackKvTraceKey);
    }
    if (traceText !== null) {
      if (source.screenName) {
        traceText = traceText.replace(new RegExp(source.screenName, 'gi'), displayScreenName);
      }
      // Strip any internal diagnostic issue note from Line 0
      const nlIdx = traceText.indexOf('\n');
      if (nlIdx > 0) {
        try {
          const line0 = JSON.parse(traceText.slice(0, nlIdx));
          delete line0.userIssueNote;
          delete line0.uploadReason;
          line0.screenName = displayScreenName;
          traceText = JSON.stringify(line0) + traceText.slice(nlIdx);
        } catch (_) {}
      }
      traceBytes = new TextEncoder().encode(traceText).byteLength;
      await env.REPLAY_BUCKET.put(featTraceKey, traceText, {
        httpMetadata: { contentType: 'application/x-ndjson; charset=utf-8' },
        customMetadata: {
          featuredId,
          sourceShareId,
          screenName: displayScreenName,
        },
      });
    }
  }

  const featuredItem = {
    ...source,
    shareId: featuredId,
    sourceShareId,
    screenName: displayScreenName,
    userTier: 'vip',
    userTierBadge: badgeLabel,
    userIssueNote: '',
    diagnosticReason: '',
    isFeatured: true,
    isPinned: true,
    isPublic: true,
    hideNames: false,
    highlightSec,
    showcaseTitle,
    videoKey: featVideoKey,
    traceKey: featTraceKey,
    videoBytes,
    traceBytes,
    totalBytes: videoBytes + traceBytes,
    featuredAt: new Date().toISOString(),
  };

  await kv.put(`share_lookup/${featuredId}`, JSON.stringify(featuredItem));

  const featIndex = await loadUserReplayIndex(kv, '_featured');
  featIndex.screenName = 'Featured';
  featIndex.settings = { publicVisibility: 'all', hideNamesPublic: false };
  const existingIdx = (featIndex.items || []).findIndex(
    (i) => i.shareId === featuredId || i.sourceShareId === sourceShareId
  );
  if (existingIdx >= 0) {
    featIndex.items[existingIdx] = featuredItem;
  } else {
    featIndex.items.unshift(featuredItem);
  }
  await saveUserReplayIndex(kv, '_featured', featIndex);

  // Also record `featuredShareId` on the source owner's replay item
  if (source.screenName && source.screenName !== 'Featured') {
    const ownerIndex = await loadUserReplayIndex(kv, source.screenName);
    const ownerItem = (ownerIndex.items || []).find((i) => i.shareId === sourceShareId);
    if (ownerItem) {
      ownerItem.featuredShareId = featuredId;
      await saveUserReplayIndex(kv, source.screenName, ownerIndex);
    }
    source.featuredShareId = featuredId;
    await kv.put(`share_lookup/${sourceShareId}`, JSON.stringify(source));
  }

  return {
    ok: true,
    featuredId,
    sourceShareId,
    shareUrl: `https://dvr.silphscopepvp.com/watch/${featuredId}`,
    item: featuredItem,
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

/**
 * Determines whether a battle DVR upload was explicitly/manually flagged by the user
 * (e.g. 1-Battle REC button, in-battle/post-battle 🚩 Bug Report button, or Replay Menu manual issue report)
 * rather than an automated Always-On DVR recording or unflagged automatic anomaly upload.
 */
function isManuallyFlaggedBattle(metadata, deepTraceText) {
  if (metadata && typeof metadata === 'object') {
    if (
      metadata.manuallyFlagged === true ||
      metadata.manuallyFlagged === 'true' ||
      metadata.isManualFlag === true ||
      metadata.isManualFlag === 'true' ||
      metadata.wasExplicitlyFlagged === true ||
      metadata.wasExplicitlyFlagged === 'true'
    ) {
      return true;
    }

    const userIssueNote = String(metadata.userIssueNote || '').trim();
    if (userIssueNote.length > 0) {
      return true;
    }

    const uploadReason = String(metadata.uploadReason || '').trim().toLowerCase();
    if (
      uploadReason.includes('manual') ||
      uploadReason.includes('bug report') ||
      uploadReason.includes('user flag') ||
      uploadReason.includes('flagged')
    ) {
      return true;
    }
  }

  if (deepTraceText && typeof deepTraceText === 'string') {
    try {
      const firstNewline = deepTraceText.indexOf('\n');
      const firstLine = (firstNewline >= 0 ? deepTraceText.slice(0, firstNewline) : deepTraceText).trim();
      if (firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) {
        const headerObj = JSON.parse(firstLine);
        if (
          headerObj.manuallyFlagged === true ||
          headerObj.isManualFlag === true ||
          headerObj.wasExplicitlyFlagged === true
        ) {
          return true;
        }
        const hNote = String(headerObj.userIssueNote || '').trim();
        if (hNote.length > 0) return true;
        const hReason = String(headerObj.uploadReason || '').trim().toLowerCase();
        if (
          hReason.includes('manual') ||
          hReason.includes('bug report') ||
          hReason.includes('user flag') ||
          hReason.includes('flagged')
        ) {
          return true;
        }
      }
    } catch (_) {}
  }

  return false;
}

/**
 * Extracts a genuine user-provided issue description from metadata or Line 0 of deep_trace.jsonl,
 * filtering out generic auto-generated placeholder strings when the user did not enter a description.
 */
function extractUserIssueDescription(metadata, deepTraceText) {
  const genericPlaceholders = new Set([
    'post-battle hud flagged bug report',
    'user-submitted dvr issue report from replay menu',
    'user manually flagged this battle for diagnostic review.',
    'post-battle user bug report flag',
    'always-on auto dvr',
  ]);
  let candidate = '';
  if (metadata && typeof metadata === 'object' && metadata.userIssueNote) {
    candidate = String(metadata.userIssueNote).trim();
  }
  if ((!candidate || genericPlaceholders.has(candidate.toLowerCase())) && deepTraceText && typeof deepTraceText === 'string') {
    try {
      const firstNewline = deepTraceText.indexOf('\n');
      const firstLine = (firstNewline >= 0 ? deepTraceText.slice(0, firstNewline) : deepTraceText).trim();
      if (firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) {
        const headerObj = JSON.parse(firstLine);
        if (headerObj && headerObj.userIssueNote) {
          candidate = String(headerObj.userIssueNote).trim();
        }
      }
    } catch (_) {}
  }
  if (!candidate || genericPlaceholders.has(candidate.toLowerCase())) {
    return '';
  }
  return candidate;
}

async function resolveUserPaidTierSummary(kv, screenName) {
  const clean = String(screenName || '').trim();
  if (!clean) {
    return { tier: 'free', badge: '🆓 Free Tier', key: '', expiresAt: null };
  }
  if (clean.toLowerCase() === 'sportsfan986') {
    return { tier: 'vip', badge: '👑 VIP / Coach Pass (Founder)', key: '', expiresAt: null };
  }
  if (!kv) {
    return { tier: 'free', badge: '🆓 Free Tier', key: '', expiresAt: null };
  }
  try {
    let mappedKey =
      (await kv.get(`user_license/${clean}`, { type: 'text' })) ||
      (await kv.get(`user_license/${clean.toLowerCase()}`, { type: 'text' })) ||
      '';
    if (!mappedKey) {
      const authRec = await loadUserAuthRecord(kv, clean);
      if (authRec && authRec.boundKey) mappedKey = authRec.boundKey;
    }
    if (mappedKey) {
      const lic = await loadLicenseByKey(kv, mappedKey);
      if (lic && !lic.revoked) {
        const isExpired = Boolean(lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now());
        const effTier = isExpired && lic.tier !== 'supporter' && lic.tier !== 'base'
          ? 'supporter'
          : lic.tier === 'base'
          ? 'supporter'
          : String(lic.tier || 'supporter').toLowerCase();
        const badgeMap = {
          vip: '👑 VIP / Coach Pass',
          pro: '🏆 Legend Pro Pass',
          supporter: isExpired ? '🏅 Lifetime Supporter (Alumni)' : '🏅 Lifetime Supporter',
          free: '🆓 Free Tier',
        };
        return {
          tier: effTier,
          badge: badgeMap[effTier] || `🏅 ${effTier.toUpperCase()}`,
          key: lic.key || mappedKey,
          expiresAt: lic.expiresAt || null,
        };
      }
    }
  } catch (_) {}
  return { tier: 'free', badge: '🆓 Free Tier', key: '', expiresAt: null };
}

function renderWatchSharePage(origin, shareInfo, isEmbed = false) {
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
  const vaultReturnHref = `/vault${shareInfo.screenName && String(shareInfo.screenName).toLowerCase() !== 'featured' ? '?user=' + encodeURIComponent(shareInfo.screenName) : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
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
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#050B16" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="SilphScope DVR" />
  <meta name="application-name" content="SilphScope DVR" />
  <link rel="apple-touch-icon" href="/pwa-icon-192.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050b16;
      --card: #0e1b2e;
      --card-alt: #081120;
      --border: #19304e;
      --accent: #2dd4bf;
      --accent-hover: #5eead4;
      --cyan: #67e8f9;
      --amber: #facc15;
      --amber-hover: #fde047;
      --rose: #f43f5e;
      --text: #ecfeff;
      --muted: #99f6e4;
      --text-dim: #94a3b8;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      height: 100dvh;
      max-height: 100dvh;
      overflow: hidden;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      background-color: #02060d;
      color: var(--text);
      display: flex;
      flex-direction: column;
      position: relative;
      user-select: none;
    }
    .close-theater-x {
      position: fixed;
      top: max(10px, env(safe-area-inset-top, 10px));
      right: 12px;
      z-index: 90;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      background: rgba(8, 17, 32, 0.9);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1.5px solid #2dd4bf;
      color: #99f6e4;
      font-size: 15px;
      font-weight: 900;
      display: ${isEmbed ? 'none' : 'inline-flex'};
      align-items: center;
      justify-content: center;
      cursor: pointer;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.85), 0 0 14px rgba(45, 212, 191, 0.35);
      transition: all 0.15s ease;
    }
    .close-theater-x:hover {
      background: #0e1b2e;
      color: #ffffff;
      border-color: #5eead4;
      transform: scale(1.04);
    }
    button, .btn-link {
      background: var(--card-alt);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }
    button:hover, .btn-link:hover {
      background: #14253e;
      border-color: var(--accent);
      color: var(--accent-hover);
    }
    button.active {
      background: rgba(45, 212, 191, 0.18);
      border-color: var(--accent);
      color: var(--accent);
    }
    main {
      flex: 1;
      min-height: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px max(4px, env(safe-area-inset-bottom, 4px));
      gap: 4px;
      overflow: hidden;
    }
    .theater-workspace {
      flex: 1;
      min-height: 0;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      overflow: hidden;
    }
    .stage-wrap {
      flex: 1;
      min-height: 0;
      width: 100%;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 10px;
      overflow: hidden;
    }
    .video-box {
      position: relative;
      height: 100%;
      max-height: 100%;
      width: auto;
      max-width: 100%;
      aspect-ratio: 544 / 1184;
      background: #000;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(45, 212, 191, 0.22);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .hud-layer {
      position: absolute;
      left: 2px;
      right: 2px;
      bottom: 10px;
      background: transparent;
      border: none;
      padding: 0;
      pointer-events: auto;
      opacity: 0.50;
      transition: top 0.2s, bottom 0.2s, opacity 0.15s;
      z-index: 10;
    }
    .hud-layer.pos-top {
      top: 18px;
      bottom: auto;
    }
    .hud-layer iframe {
      width: 100%;
      height: 340px;
      border: none;
      background: transparent;
      display: block;
      overflow: hidden;
    }
    .stage-wrap.side-by-side .hud-layer {
      position: static;
      width: min(46vw, 380px);
      background: transparent;
      border: none;
      padding: 0;
      align-self: center;
    }
    .controls-bar {
      flex-shrink: 0;
      width: 100%;
      max-width: 680px;
      background: rgba(10, 19, 34, 0.96);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 5px 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 30;
      overflow: hidden;
    }
    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      flex-wrap: nowrap;
      overflow: hidden;
    }
    .playback-btns {
      display: flex;
      gap: 3px;
      align-items: center;
      flex-shrink: 1;
      min-width: 0;
    }
    .playback-btns button {
      padding: 4px 6px;
      font-size: 10.5px;
    }
    .drawer-toggle-btn {
      padding: 4px 7px;
      font-size: 10.5px;
      font-weight: 800;
      border-color: rgba(45, 212, 191, 0.5);
      color: #99f6e4;
      background: rgba(8, 17, 32, 0.95);
    }
    @media (max-width: 390px) {
      .playback-btns { gap: 2px; }
      .playback-btns button { padding: 3.5px 5px; font-size: 10px; }
      .drawer-toggle-btn { padding: 3.5px 6px; font-size: 10px; }
    }
    /* Mobile/Portrait Drawer: expands smoothly to 18dvh (within 10-20% vertical screen height),
       automatically shrinking .stage-wrap video above it with vertical-only scrolling inside! */
    .tools-drawer {
      display: none;
      flex-direction: column;
      gap: 6px;
      padding-top: 5px;
      border-top: 1px solid rgba(25, 48, 78, 0.9);
      max-height: 18dvh;
      min-height: 11dvh;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      scrollbar-color: #2dd4bf rgba(8, 17, 32, 0.6);
    }
    .tools-drawer.open {
      display: flex;
    }
    .tools-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      width: 100%;
    }
    .tools-group button {
      padding: 3.5px 7px;
      font-size: 10.5px;
    }
    .timeline-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding-top: 4px;
      border-top: 1px dashed rgba(25, 48, 78, 0.85);
    }
    .chips-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #5eead4;
    }
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      width: 100%;
      overflow-x: hidden;
      padding-bottom: 2px;
    }
    .event-chip {
      font-size: 10px;
      font-weight: 700;
      padding: 2.5px 7px;
      border-radius: 999px;
      background: rgba(8, 17, 32, 0.94);
      border: 1px solid var(--border);
      color: #cbd5e1;
      cursor: pointer;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .event-chip.chip-charge { border-color: rgba(45, 212, 191, 0.42); color: #99f6e4; }
    .event-chip.chip-swap { border-color: rgba(56, 189, 248, 0.42); color: #bae6fd; }
    .event-chip.chip-shield { border-color: rgba(168, 85, 247, 0.45); color: #e9d5ff; }
    .event-chip.chip-faint { border-color: rgba(244, 63, 94, 0.45); color: #fecdd3; }
    .event-chip.chip-anomaly { border-color: rgba(250, 204, 21, 0.5); color: #fef08a; }
    .event-chip:hover, .event-chip.active-chip {
      border-color: var(--accent);
      color: #ffffff;
      background: rgba(45, 212, 191, 0.28);
      box-shadow: 0 0 8px rgba(45, 212, 191, 0.28);
    }
    /* Desktop / Wide Landscape Aspect Ratios: Video stays ~98dvh tall on the left,
       and Playback + Tools + Multi-line Timeline dock into a spacious right sidebar! */
    @media (min-width: 900px) and (min-aspect-ratio: 11/10) {
      main {
        padding: 10px 56px 10px 16px;
      }
      .theater-workspace {
        flex-direction: row;
        align-items: stretch;
        justify-content: center;
        gap: 16px;
        max-width: 1360px;
      }
      .stage-wrap {
        flex: 0 1 auto;
        width: auto;
        height: 100%;
      }
      .controls-bar {
        width: 370px;
        max-width: 40vw;
        height: 100%;
        max-height: 100%;
        padding: 12px;
        gap: 10px;
        display: flex;
        flex-direction: column;
      }
      .drawer-toggle-btn {
        display: none !important;
      }
      .tools-drawer {
        display: flex !important;
        flex: 1;
        min-height: 0;
        max-height: none;
        overflow-y: auto;
        padding-top: 10px;
        gap: 10px;
      }
      .timeline-section {
        flex: 1;
        padding-top: 8px;
      }
      .event-chip {
        font-size: 11px;
        padding: 3.5px 9px;
      }
    }
  </style>
</head>
<body>
  <!-- Bordered 'X' Close Button (Standalone /watch/:shareId returns to DVR Vault) -->
  <button
    type="button"
    class="close-theater-x"
    onclick="closeReplayTheater()"
    title="Close Replay & Return to Vault"
    aria-label="Close Replay"
  >✕</button>

  <!-- Hidden legacy spans so JS helpers never null-ref -->
  <span id="hdr-trainer" style="display:none">@${trainerDisplay}</span>

  <main>
    <div id="diag-issue-banner" style="flex-shrink:0;width:100%;max-width:960px;background:rgba(250,204,21,0.12);border:1px solid rgba(250,204,21,0.45);border-radius:8px;padding:4px 10px;font-size:11px;color:#fef3c7;display:${shareInfo.userIssueNote || shareInfo.manuallyFlagged ? 'flex' : 'none'};flex-wrap:wrap;justify-content:space-between;align-items:center;gap:6px">
      <div id="diag-issue-text">🚩 <strong>Issue:</strong> ${escapeHtml(shareInfo.userIssueNote || 'Flagged for diagnostic review')}</div>
      <div style="display:flex;align-items:center;gap:5px">
        <button id="btn-edit-issue" onclick="flagOrEditCurrentIssue()" style="padding:2px 7px;font-size:10.5px;border-color:#facc15;color:#fde047">✏️ Edit</button>
        <button id="btn-unflag-issue" onclick="unflagCurrentIssue()" style="padding:2px 7px;font-size:10.5px">↩️ Unflag</button>
      </div>
    </div>

    <div class="theater-workspace">
      <div class="stage-wrap" id="stage-wrap">
        <div class="video-box" id="video-box">
          <video id="replay-video" src="${videoUrl}" playsinline preload="metadata" crossorigin="anonymous" onclick="togglePlay()"></video>
          <div id="dual-energy-pill" style="position:absolute;top:4px;left:5px;z-index:25;background:rgba(8,17,32,0.92);border:1px solid #2dd4bf;border-radius:999px;padding:1.5px 8px;font-size:9.5px;font-weight:800;font-family:'Roboto Condensed',sans-serif;color:#ecfeff;white-space:nowrap;pointer-events:none;max-width:calc(100% - 10px);overflow:hidden;text-overflow:ellipsis">⚡ U: 0E • O: 0E</div>
          <div class="hud-layer pos-top" id="hud-layer">
            <iframe id="hud-iframe" src="/overlay.html?replay=1" scrolling="no" title="SilphScope PvP HUD"></iframe>
          </div>
        </div>
      </div>

      <div class="controls-bar">
        <div style="display:flex;align-items:center;gap:6px;width:100%">
          <input type="range" id="video-scrubber" min="0" max="1000" value="0" style="flex:1;height:16px;accent-color:#2dd4bf;cursor:pointer;margin:0" oninput="scrubVideo(this.value)" />
          <span id="time-readout" style="font-size:10.5px;font-family:monospace;font-weight:700;color:#99f6e4;min-width:74px;text-align:right">0.0s / 0.0s</span>
        </div>
        <div class="control-row">
          <div class="playback-btns">
            <button onclick="stepFrame(-1)" title="Previous Frame">⏮</button>
            <button onclick="togglePlay()" id="btn-play">▶️ Play</button>
            <button onclick="stepFrame(1)" title="Next Frame">⏭</button>
            <button onclick="setSpeed(0.5)" id="spd-05">0.5x</button>
            <button onclick="setSpeed(1)" id="spd-1" class="active">1x</button>
            <button onclick="setSpeed(2)" id="spd-2">2x</button>
          </div>
          <button onclick="toggleToolsDrawer()" id="btn-tools-toggle" class="drawer-toggle-btn" title="Expand Tools & Key Events Timeline">⚙️ Tools/Timeline ▾</button>
        </div>
        <div class="tools-drawer" id="tools-drawer">
          <div class="tools-group">
            <button onclick="setHudMode('live')" id="mode-live" class="active">👁️ HUD</button>
            <button onclick="setHudMode('compact')" id="mode-compact">COMPACT</button>
            <button onclick="setHudMode('diag')" id="mode-diag">DIAG</button>
            <button onclick="setHudMode('off')" id="mode-off">HUD OFF</button>
            <button onclick="toggleHudPos()" id="btn-pos" title="Move HUD Top/Bottom">⬆️ Top</button>
            <button onclick="setSpeed(0.25)" id="spd-025">0.25x</button>
            <button onclick="toggleShieldHud()" id="btn-shield-hud" class="${shareInfo.userTier && shareInfo.userTier !== 'free' ? 'active' : ''}">${shareInfo.userTier && shareInfo.userTier !== 'free' ? '🛡️ Shield' : '🔒 Shield'}</button>
            <button id="btn-layout" onclick="toggleLayout()">📐 Side-by-Side: OFF</button>
            <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(8,17,32,0.85);border:1px solid var(--border);border-radius:7px;padding:2px 6px">
              <span style="font-size:9.5px;color:var(--muted);font-weight:700">HUD</span>
              <input type="range" id="hud-opacity" min="25" max="100" value="50" style="width:52px;height:12px;accent-color:#2dd4bf;margin:0" title="HUD Opacity (50% Default)" oninput="updateOpacity(this.value)" />
            </div>
            <button id="btn-privacy" onclick="togglePrivacy()">🕵️ ${hideNamesDefault ? 'Hidden' : 'Names'}</button>
            <button onclick="shareCurrentReplayMoment()" id="btn-share-moment" title="Share Replay Link">📤 Share</button>
            <button id="btn-flag-issue-hdr" onclick="flagOrEditCurrentIssue()" style="border-color:${shareInfo.userIssueNote || shareInfo.manuallyFlagged ? '#f59e0b' : '#b91c1c'};color:${shareInfo.userIssueNote || shareInfo.manuallyFlagged ? '#fbbf24' : '#fca5a5'}">🚩 ${shareInfo.userIssueNote || shareInfo.manuallyFlagged ? 'Flagged ✓' : 'Flag'}</button>
            <button id="btn-unflag-issue-hdr" onclick="unflagCurrentIssue()" style="display:${shareInfo.userIssueNote || shareInfo.manuallyFlagged ? 'inline-flex' : 'none'}">↩️ Unflag</button>
            <button id="btn-export" onclick="exportWithHud()">💾 Export</button>
          </div>
          <div class="timeline-section" id="timeline-section">
            <div class="chips-header">
              <span id="chips-count-label">⏭ Key Events Timeline</span>
              <span style="font-size:9px;color:#94a3b8;text-transform:none;font-weight:600">Tap event to jump</span>
            </div>
            <div class="chips-row" id="event-chips"></div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const VAULT_RETURN_HREF = ${safeJsonForScript(vaultReturnHref)};
    function closeReplayTheater() {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'SSPVP_CLOSE_REPLAY' }, '*');
          return;
        }
      } catch (_) {}
      try {
        if (document.referrer && new URL(document.referrer).hostname.endsWith('silphscopepvp.com')) {
          window.history.back();
          return;
        }
      } catch (_) {}
      window.location.href = VAULT_RETURN_HREF || '/vault';
    }
    let totalTimelineEventCount = 0;
    function updateToolsToggleLabel() {
      const d = document.getElementById('tools-drawer');
      const b = document.getElementById('btn-tools-toggle');
      if (!b) return;
      const isOpen = Boolean(d && d.classList.contains('open'));
      const cntSuffix = totalTimelineEventCount > 0 ? (' (' + totalTimelineEventCount + ')') : '';
      b.textContent = '⚙️ Tools/Timeline' + cntSuffix + (isOpen ? ' ▴' : ' ▾');
    }
    function toggleToolsDrawer() {
      const d = document.getElementById('tools-drawer');
      const b = document.getElementById('btn-tools-toggle');
      if (!d) return;
      const open = d.classList.toggle('open');
      if (b) b.classList.toggle('active', open);
      updateToolsToggleLabel();
    }
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeReplayTheater();
    });
    const TRACE_URL = ${safeJsonForScript(traceUrl)};
    const SHARE_ID = ${safeJsonForScript(shareInfo.shareId || '')};
    const SHARE_BATTLE_ID = ${safeJsonForScript(shareInfo.battleId || '')};
    const PVP_DB = ${safeJsonForScript(COMPACT_PVP_DB)};
    const SHARE_LEAGUE = ${safeJsonForScript(shareInfo.league || 'GREAT LEAGUE')};
    const SHARE_MATCHUP = ${safeJsonForScript(shareInfo.matchup || '')};
    const SHARE_DURATION_SEC = Number(${safeJsonForScript(Number(shareInfo.durationSec) || 0)}) || 0;
    const SHARE_USER_TIER = ${safeJsonForScript(shareInfo.userTier || 'pro')};
    const IS_SHIELD_HUD_UNLOCKED = SHARE_USER_TIER !== 'free';
    let currentIssueNote = ${safeJsonForScript(shareInfo.userIssueNote || '')};
    let isIssueFlagged = ${safeJsonForScript(Boolean(shareInfo.userIssueNote || shareInfo.manuallyFlagged))};
    let hideNames = ${safeJsonForScript(hideNamesDefault)};
    const rawTrainerName = ${safeJsonForScript(shareInfo.screenName || 'Trainer')};
    let frames = [];
    let summaryHeader = null;
    let hudMode = 'live';
    let hudTop = true;
    let showShieldHud = IS_SHIELD_HUD_UNLOCKED;
    let sideBySide = false;
    let selectedSpeed = 1;
    let mp4TimeCompressionRatio = 1.0;

    function updateEffectivePlaybackRate() {
      const rate = Math.max(0.1, Math.min(4.0, selectedSpeed / mp4TimeCompressionRatio));
      try {
        video.playbackRate = rate;
      } catch (_) {}
    }

    function recalcMp4TimeCompression() {
      const vDur = Number(video.duration) || 0;
      const traceDurSec = (frames.length > 1 && frames[frames.length - 1].relTimeMs)
        ? (frames[frames.length - 1].relTimeMs / 1000)
        : 0;
      if (vDur > 5 && traceDurSec > 10) {
        const ratio = traceDurSec / vDur;
        // Compensate for v6.45–v7.01 recordings where KEY_CAPTURE_RATE=10 + KEY_FRAME_RATE=30 compressed PTS by ~3x
        if (ratio >= 1.8 && ratio <= 3.6) {
          mp4TimeCompressionRatio = ratio;
        } else {
          mp4TimeCompressionRatio = 1.0;
        }
      } else {
        mp4TimeCompressionRatio = 1.0;
      }
      updateEffectivePlaybackRate();
    }

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
            const effectiveRealSec = (video.currentTime || 0) * mp4TimeCompressionRatio;
            const curFrame = findFrameAtSec(effectiveRealSec) || frames[0];
            const curFrameIdx = Math.max(0, frames.indexOf(curFrame));
            const oSpecs = getRevealedOppSpecsAtFrame(curFrameIdx);
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
      let avgFrameSec = 0.067;
      if (frames.length > 10) {
        const spanMs = (frames[frames.length - 1].relTimeMs || 0) - (frames[0].relTimeMs || 0);
        if (spanMs > 1000) {
          avgFrameSec = Math.max(0.030, Math.min(0.110, (spanMs / frames.length) / 1000));
        }
      }
      const stepSec = avgFrameSec / mp4TimeCompressionRatio;
      video.currentTime = Math.max(0, Math.min(video.duration || 999, video.currentTime + delta * stepSec));
      syncHudFrame();
    }
    function setSpeed(s) {
      selectedSpeed = s;
      updateEffectivePlaybackRate();
      ['025','05','1','2'].forEach(k => { const b = document.getElementById('spd-' + k); if (b) b.classList.remove('active'); });
      const id = s === 0.25 ? '025' : s === 0.5 ? '05' : String(s);
      const el = document.getElementById('spd-' + id);
      if (el) el.classList.add('active');
    }
    function setHudMode(m) {
      hudMode = m;
      ['live','compact','diag','off'].forEach(k => { const b = document.getElementById('mode-' + k); if (b) b.classList.toggle('active', k === m); });
      hudLayer.style.display = m === 'off' ? 'none' : 'block';
      syncHudFrame();
    }
    function toggleShieldHud() {
      if (!IS_SHIELD_HUD_UNLOCKED) {
        alert('🏅 The Attack Incoming! Shield Decision Overlay is unlocked permanently with Lifetime Supporter ($2 one-time) or any Legend Pro / VIP pass!');
        return;
      }
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
      document.getElementById('btn-pos').textContent = hudTop ? '⬆️ Top' : '⬇️ Bot';
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

    function refreshWatchIssueBannerUi() {
      const hdrFlagBtn = document.getElementById('btn-flag-issue-hdr');
      const hdrUnflagBtn = document.getElementById('btn-unflag-issue-hdr');
      const banner = document.getElementById('diag-issue-banner');
      const textEl = document.getElementById('diag-issue-text');
      if (hdrFlagBtn) {
        hdrFlagBtn.textContent = isIssueFlagged ? '🚩 Flagged ✓ (Edit)' : '🚩 Flag Issue';
        hdrFlagBtn.style.borderColor = isIssueFlagged ? '#f59e0b' : '#b91c1c';
        hdrFlagBtn.style.color = isIssueFlagged ? '#fbbf24' : '#fca5a5';
        hdrFlagBtn.style.background = isIssueFlagged ? 'rgba(245,158,11,0.16)' : 'rgba(185,28,28,0.18)';
      }
      if (hdrUnflagBtn) {
        hdrUnflagBtn.style.display = isIssueFlagged ? 'inline-flex' : 'none';
      }
      if (banner) {
        if (isIssueFlagged) {
          banner.style.display = 'flex';
          banner.style.background = 'rgba(245,158,11,0.12)';
          banner.style.borderColor = 'rgba(245,158,11,0.45)';
          banner.style.color = '#fef3c7';
          if (textEl) {
            textEl.innerHTML = '🚩 <strong>Reported Diagnostic Issue:</strong> ' + escapeHtmlText(currentIssueNote || 'Flagged for diagnostic review');
          }
        } else {
          banner.style.display = 'none';
        }
      }
    }

    function escapeHtmlText(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    async function flagOrEditCurrentIssue() {
      const note = prompt(
        '🚩 Flag / Update Issue Report for this Battle:\\nDescribe what went wrong (e.g. HP jump, wrong move count, OCR misread):',
        currentIssueNote || ''
      );
      if (note === null) return;
      const cleanNote = note.trim();
      if (!cleanNote) {
        if (isIssueFlagged && confirm('You left the description blank. Would you like to unflag & retract this issue report instead?')) {
          return unflagCurrentIssue();
        }
        alert('Please enter a brief description of the issue to flag this battle.');
        return;
      }
      const hdrFlagBtn = document.getElementById('btn-flag-issue-hdr');
      if (hdrFlagBtn) {
        hdrFlagBtn.disabled = true;
        hdrFlagBtn.textContent = '⏳ Flagging...';
      }
      try {
        let sess = '';
        let savedKey = '';
        let devId = '';
        try {
          sess = localStorage.getItem('sspvp_vault_session') || '';
          savedKey = localStorage.getItem('sspvp_vault_key') || '';
          devId = localStorage.getItem('silphscope_device_id') || 'web_replay_client';
        } catch (_) {}
        const res = await fetch('/v1/dvr/flag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
            'X-Trainer-Screen-Name': rawTrainerName,
            'X-Device-Hash': devId,
            ...(sess ? { 'X-Vault-Session': sess } : {}),
            ...(savedKey ? { 'X-SilphScope-Unlock-Key': savedKey } : {})
          },
          body: JSON.stringify({
            shareId: SHARE_ID,
            battleId: SHARE_BATTLE_ID,
            screenName: rawTrainerName,
            userIssueNote: cleanNote,
            league: SHARE_LEAGUE,
            matchupSummary: SHARE_MATCHUP,
            deviceHash: devId,
            sessionToken: sess,
            unlockKey: savedKey
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || ('HTTP ' + res.status));
        }
        currentIssueNote = cleanNote;
        isIssueFlagged = true;
        if (hdrFlagBtn) hdrFlagBtn.disabled = false;
        refreshWatchIssueBannerUi();
      } catch (e) {
        alert('Could not flag issue report: ' + e.message);
        if (hdrFlagBtn) hdrFlagBtn.disabled = false;
        refreshWatchIssueBannerUi();
      }
    }

    async function unflagCurrentIssue() {
      if (!confirm('Unflag and retract this issue report?')) return;
      const btn = document.getElementById('btn-unflag-issue');
      const hdrUnflagBtn = document.getElementById('btn-unflag-issue-hdr');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Unflagging...';
      }
      if (hdrUnflagBtn) {
        hdrUnflagBtn.disabled = true;
        hdrUnflagBtn.textContent = '⏳ Unflagging...';
      }
      try {
        let sess = '';
        let savedKey = '';
        let devId = '';
        try {
          sess = localStorage.getItem('sspvp_vault_session') || '';
          savedKey = localStorage.getItem('sspvp_vault_key') || '';
          devId = localStorage.getItem('silphscope_device_id') || 'web_replay_client';
        } catch (_) {}
        const res = await fetch('/v1/dvr/unflag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c',
            'X-Trainer-Screen-Name': rawTrainerName,
            'X-Device-Hash': devId,
            ...(sess ? { 'X-Vault-Session': sess } : {}),
            ...(savedKey ? { 'X-SilphScope-Unlock-Key': savedKey } : {})
          },
          body: JSON.stringify({
            shareId: SHARE_ID,
            battleId: SHARE_BATTLE_ID,
            screenName: rawTrainerName,
            deviceHash: devId,
            sessionToken: sess,
            unlockKey: savedKey
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || ('HTTP ' + res.status));
        }
        isIssueFlagged = false;
        currentIssueNote = '';
        if (btn) {
          btn.disabled = false;
          btn.textContent = '↩️ Unflag Issue';
        }
        if (hdrUnflagBtn) {
          hdrUnflagBtn.disabled = false;
          hdrUnflagBtn.textContent = '↩️ Unflag Issue';
        }
        refreshWatchIssueBannerUi();
      } catch (e) {
        alert('Could not unflag issue report: ' + e.message);
        if (btn) {
          btn.disabled = false;
          btn.textContent = '↩️ Unflag Issue';
        }
        if (hdrUnflagBtn) {
          hdrUnflagBtn.disabled = false;
          hdrUnflagBtn.textContent = '↩️ Unflag Issue';
        }
      }
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

    function cleanBaseSpeciesKey(name) {
      return String(name || '')
        .replace(/^Shadow\\s+/i, '')
        .replace(/\\s*\\(Shadow\\)/i, '')
        .split('(')[0]
        .trim()
        .toLowerCase();
    }

    function buildSingleOppSpec(s, slotIdx, lg) {
      const spName = String(s.species || 'Opponent')
        .replace(/^Shadow\\s+/i, '')
        .replace(/\\s*\\(Shadow\\)/i, '')
        .trim() || 'Opponent';
      const meta = lookupSpeciesMeta(spName, lg);
      const isShad = manualOppShadowOverride !== null && slotIdx === 0
        ? manualOppShadowOverride
        : (s.isShadow !== undefined ? Boolean(s.isShadow) : (Boolean(s.rawNameHasShadow) || meta.isShadow));
      const fastMove = s.inferredFastMove || meta.fastMove;
      const fStats = lookupFastStats(fastMove, s.fastTurns || meta.fastTurns);
      const confirmed = Array.isArray(s.confirmedChargedMoves) ? s.confirmedChargedMoves.map(m => String(m).replace(/\\*/g, '').trim()).filter(Boolean) : [];
      const candidatePoolFromSummary = Array.isArray(s.candidateChargedMoves)
        ? s.candidateChargedMoves.map(m => String(m).replace(/\\*/g, '').trim()).filter(Boolean)
        : [];
      const c1 = meta.c1 || confirmed[0] || 'Body Slam';
      const c2 = (meta.c2 && meta.c2.toLowerCase() !== c1.toLowerCase())
        ? meta.c2
        : (confirmed[1] && confirmed[1].toLowerCase() !== c1.toLowerCase() ? confirmed[1] : 'Surf');
      const c3 = meta.c3 || 'Outrage';
      return {
        slotIndex: slotIdx,
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
        candidateChargedMoves: candidatePoolFromSummary,
        c1,
        c2,
        c3,
        meta
      };
    }

    function getAllResolvedOppSpecs() {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const rawSpecs = (summaryHeader && Array.isArray(summaryHeader.oppTeamSpecs) && summaryHeader.oppTeamSpecs.length > 0)
        ? summaryHeader.oppTeamSpecs
        : [];
      const seenNames = [];
      for (const rs of rawSpecs) {
        if (rs && rs.species) {
          seenNames.push({
            ...rs,
            rawNameHasShadow: /shadow/i.test(String(rs.species))
          });
        }
      }
      if (seenNames.length === 0) {
        const distinct = [];
        for (const f of frames) {
          const sp = String(f.oppActiveSpecies || '').trim();
          if (sp && sp.toLowerCase() !== 'waiting...' && !distinct.some(d => cleanBaseSpeciesKey(d) === cleanBaseSpeciesKey(sp))) {
            distinct.push(sp);
          }
        }
        distinct.slice(0, 3).forEach((nm, idx) => seenNames.push({
          slotIndex: idx,
          species: nm,
          rawNameHasShadow: /shadow/i.test(nm)
        }));
      }
      return seenNames.slice(0, 3).map((s, i) => buildSingleOppSpec(s, i, lg));
    }

    // v7.10: Progressive Opponent Reveal — only return opponents revealed on the field up to frameArrayIdx
    function getRevealedOppSpecsAtFrame(frameArrayIdx) {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const allSpecs = getAllResolvedOppSpecs();
      const targetFrame = frames[frameArrayIdx];
      const revealedRawNames = [];
      const seenBases = new Set();

      const addRevealedName = (rawNm) => {
        const trimmed = String(rawNm || '').trim();
        if (!trimmed || trimmed.toLowerCase() === 'waiting...' || trimmed.toLowerCase() === 'opponent') return;
        const baseKey = cleanBaseSpeciesKey(trimmed);
        if (!baseKey || seenBases.has(baseKey)) return;
        seenBases.add(baseKey);
        revealedRawNames.push(trimmed);
      };

      if (targetFrame && Array.isArray(targetFrame.revealedOppSpecies) && targetFrame.revealedOppSpecies.length > 0) {
        for (const nm of targetFrame.revealedOppSpecies) {
          addRevealedName(nm);
          if (revealedRawNames.length >= 3) break;
        }
      } else {
        const maxIdx = Math.max(0, Math.min(frames.length - 1, frameArrayIdx));
        for (let k = 0; k <= maxIdx; k++) {
          const fk = frames[k];
          if (!fk) continue;
          if (Array.isArray(fk.revealedOppSpecies) && fk.revealedOppSpecies.length > 0) {
            for (const nm of fk.revealedOppSpecies) {
              addRevealedName(nm);
            }
          }
          addRevealedName(fk.oppActiveSpecies || fk.activeOppSpecies);
          if (revealedRawNames.length >= 3) break;
        }
      }

      return revealedRawNames.slice(0, 3).map((revName, idx) => {
        const revBase = cleanBaseSpeciesKey(revName);
        const matchedSpec = allSpecs.find(s =>
          cleanBaseSpeciesKey(s.name) === revBase ||
          s.name.toLowerCase().includes(revBase) ||
          revBase.includes(cleanBaseSpeciesKey(s.name))
        );
        if (matchedSpec) {
          const isShad = manualOppShadowOverride !== null && idx === 0
            ? manualOppShadowOverride
            : (matchedSpec.isShadow || /shadow/i.test(revName));
          return {
            ...matchedSpec,
            slotIndex: idx,
            isShadow: isShad,
            code: abbrPoke3(matchedSpec.name, isShad)
          };
        }
        return buildSingleOppSpec(
          { species: revName, rawNameHasShadow: /shadow/i.test(revName) },
          idx,
          lg
        );
      });
    }

    function getPlayerSlotEverOnFieldAtFrame(frameArrayIdx, currentUIdx) {
      const targetFrame = frames[frameArrayIdx];
      if (targetFrame && Array.isArray(targetFrame.userSlotEverOnField) && targetFrame.userSlotEverOnField.length >= 3) {
        return [0, 1, 2].map(i => Boolean(targetFrame.userSlotEverOnField[i]) || i === currentUIdx);
      }
      const ever = [false, false, false];
      ever[currentUIdx] = true;
      const maxIdx = Math.max(0, Math.min(frames.length - 1, frameArrayIdx));
      for (let k = 0; k <= maxIdx; k++) {
        const fk = frames[k];
        if (!fk) continue;
        const uAtK = Math.max(0, Math.min(2, Number(fk.userActiveIndex ?? fk.activeUserIdx ?? 0)));
        ever[uAtK] = true;
        for (let i = 0; i < 3; i++) {
          if (Array.isArray(fk.userSlotEverOnField) && fk.userSlotEverOnField[i]) ever[i] = true;
          if (Array.isArray(fk.userSlotEnergy) && Number(fk.userSlotEnergy[i] || 0) > 0) ever[i] = true;
          if (Array.isArray(fk.userSlotHpPct) && Number(fk.userSlotHpPct[i] ?? 100) >= 0 && Number(fk.userSlotHpPct[i] ?? 100) < 100) ever[i] = true;
        }
      }
      return ever;
    }

    function buildReplayOverlayPayload(f) {
      const lg = (summaryHeader && summaryHeader.league) || SHARE_LEAGUE;
      const uSpecs = getResolvedUserSpecs();
      const frameArrayIdx = Math.max(0, frames.indexOf(f));
      const oSpecs = getRevealedOppSpecsAtFrame(frameArrayIdx);

      const uIdx = manualUserSlotOverride !== null
        ? manualUserSlotOverride
        : Math.max(0, Math.min(2, Number(f.userActiveIndex ?? 0)));
      const pEverOnField = getPlayerSlotEverOnFieldAtFrame(frameArrayIdx, uIdx);
      let oIdx = manualOppSlotOverride !== null
        ? Math.max(0, Math.min(Math.max(0, oSpecs.length - 1), manualOppSlotOverride))
        : Math.max(0, Math.min(Math.max(0, oSpecs.length - 1), Number(f.oppActiveIndex ?? 0)));
      if (f.oppActiveSpecies && manualOppSlotOverride === null && oSpecs.length > 0) {
        const fOppBase = cleanBaseSpeciesKey(f.oppActiveSpecies);
        const matchIdx = oSpecs.findIndex(o =>
          cleanBaseSpeciesKey(o.name) === fOppBase ||
          o.name.toLowerCase().includes(fOppBase) ||
          fOppBase.includes(cleanBaseSpeciesKey(o.name))
        );
        if (matchIdx >= 0) oIdx = matchIdx;
      }

      const actUser = uSpecs[uIdx] || uSpecs[0];
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

      // If no opponent has been revealed yet at this frame, emit Waiting state matching live gameplay
      if (oSpecs.length === 0) {
        return {
          activeOpponent: 'Waiting...',
          activeOpponentFastMove: 'Scanning Header...',
          activeOpponentTurns: 0,
          oppFastTelemetry: '200ms HP + 750ms OCR',
          userFastTelemetry: '',
          isOpponentShadow: false,
          currentFormLabel: 'Base',
          availableForms: [],
          userActivePokemon: actUser.name,
          activeUserSlotIndex: uIdx,
          activeOpponentSlotIndex: 0,
          leadMatchup: (summaryHeader && summaryHeader.leadMatchup) || 'NEUTRAL',
          isBattleActive: true,
          isReplayMode: true,
          overlayTransparencyPct: 12,
          appThemeId: 'dialga_shiny_midnight',
          aiAdviceHudPosition: hudTop ? 'top' : 'bottom',
          isOverlayMinimized: false,
          scanHzMode: 10,
          lastScanDurationMs: 12,
          lastBattleAvgScanMs: 12,
          lastHpScanDurationMs: 2,
          lastBattleAvgHpScanMs: 2,
          enableHpTracking: true,
          enableEnergyTracking: true,
          oppFastMoveStatus: 'unconfirmed',
          confirmedOppChargedMoves: [],
          myMove1Summary: '—',
          myMove2Summary: '—',
          throwAlignmentText: 'Waiting for Opponent spawn',
          throwHorizonText: '—',
          playerSwapRemainingSec: Math.max(0, Number(f.playerSwapRemainingSec ?? Math.ceil((f.userSwitchClockMs || 0) / 1000))),
          playerSwapEndTimeMs: 0,
          oppSwapRemainingSec: Math.max(0, Number(f.oppSwapRemainingSec ?? Math.ceil((f.oppSwitchClockMs || 0) / 1000))),
          oppSwapEndTimeMs: 0,
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
          playerSlotEverOnField: pEverOnField,
          activeUserHpPct: pSlotHp[uIdx],
          activeOppHpPct: 100,
          activeUserEnergy: pSlotE[uIdx] || 0,
          activeOppEnergy: 0,
          teamArchetype: 'ABC',
          activeLeague: lg,
          showTacticalRec: true,
          showTacticalRecommendations: true,
          tacticalRec: {
            phase: 'WAITING',
            archetype: 'ABC',
            action: 'AWAITING LEAD',
            actionLabel: '[ABC] AWAITING LEAD',
            shieldPlan: '2S',
            goal: '🔮 Back: Scanning opponent lead...',
            goalText: '🔮 Back: Scanning opponent lead...',
            line1Text: '[ABC] AWAITING LEAD · [2S]',
            line2Text: '🔮 Back: Scanning opponent lead...',
            backlineText: '🔮 Back: Scanning opponent lead...',
            timingAlertLevel: 'NORMAL',
            tone: 'neutral',
            urgencyColor: 'sky',
            recommendedSwapSlotIndex: -1
          },
          tacticalRecommendation: {
            phase: 'WAITING',
            archetype: 'ABC',
            action: 'AWAITING LEAD',
            actionLabel: '[ABC] AWAITING LEAD',
            shieldPlan: '2S',
            goal: '🔮 Back: Scanning opponent lead...',
            goalText: '🔮 Back: Scanning opponent lead...',
            line1Text: '[ABC] AWAITING LEAD · [2S]',
            line2Text: '🔮 Back: Scanning opponent lead...',
            backlineText: '🔮 Back: Scanning opponent lead...',
            timingAlertLevel: 'NORMAL',
            tone: 'neutral',
            urgencyColor: 'sky',
            recommendedSwapSlotIndex: -1
          },
          team: uSpecs.map((u, idx) => {
            const isFnt = Boolean(pFainted[idx]);
            const hasEnt = Boolean(pEverOnField[idx] || idx === uIdx || (pSlotE[idx] || 0) > 0 || isFnt);
            const eLbl = isFnt ? '0E' : (hasEnt ? ((pSlotE[idx] || 0) + 'E') : '-E');
            return {
              initial: u.name.charAt(0).toUpperCase(),
              code: u.code,
              name: u.name,
              hpPct: pSlotHp[idx],
              energy: pSlotE[idx],
              hasEnteredField: hasEnt,
              bankedEnergyLabel: eLbl
            };
          }),
          scannedOpponents: [],
          oppMoveTimingRows: [],
          myMoveTimingRows: []
        };
      }

      const actOpp = oSpecs[oIdx] || oSpecs[0];

      const winsCmp = actUser.meta.effAtk >= actOpp.meta.effAtk;
      const uHpNow = Math.max(1, Math.min(100, Number(pSlotHp[uIdx] ?? 100)));

      // v6.50: Resolve progressive confirmed charged moves per opponent slot at current frame f
      function getSlotConfirmedMovesAtFrame(slotSpec, sIdx) {
        if (Array.isArray(f.oppSlotConfirmedChargedMoves) && f.oppSlotConfirmedChargedMoves.length > 0) {
          const arr = f.oppSlotConfirmedChargedMoves[sIdx];
          return Array.isArray(arr) ? arr.map(m => String(m).replace(/\\*/g, '').trim()).filter(Boolean) : [];
        }
        // Fallback for pre-v6.50 traces: scan frames[0..frameArrayIdx] for used-move announcements by this opponent species
        const summaryConfirmed = Array.isArray(slotSpec.confirmedMoves) ? slotSpec.confirmedMoves : [];
        if (summaryConfirmed.length === 0) return [];
        const baseSp = String(slotSpec.meta.baseSpecies || slotSpec.name || '').replace(/^Shadow\\s+/i, '').split('(')[0].trim().toLowerCase();
        const foundSoFar = [];
        for (let k = 0; k <= frameArrayIdx; k++) {
          const fk = frames[k];
          if (!fk) continue;
          const bTxt = String((fk.moveBannerText || '') + ' ' + (fk.ocrMidBannerText || '')).toLowerCase();
          if (!bTxt.includes('used')) continue;
          const activeAtK = Number(fk.oppActiveIndex ?? 0) === sIdx || (baseSp && bTxt.includes(baseSp));
          if (!activeAtK) continue;
          for (const cm of summaryConfirmed) {
            const cLower = cm.toLowerCase();
            if (bTxt.includes(cLower) && !foundSoFar.some(x => x.toLowerCase() === cLower)) {
              foundSoFar.push(cm);
            }
          }
        }
        return foundSoFar;
      }

      // v6.50: Smart 3-Move Selection (2 PvPoke Recommended + Highest Risk of Next 3, locking to 2 once 2 moves confirmed)
      function selectOppThreeMovesForSlot(slotSpec, sIdx) {
        const confirmedAtFrame = getSlotConfirmedMovesAtFrame(slotSpec, sIdx);
        const rawCandidates = [
          slotSpec.meta.c1,
          slotSpec.meta.c2,
          ...(Array.isArray(slotSpec.candidateChargedMoves) ? slotSpec.candidateChargedMoves : []),
          ...(Array.isArray(slotSpec.meta.pool) ? slotSpec.meta.pool : []),
          slotSpec.meta.c3,
          slotSpec.c1,
          slotSpec.c2,
          slotSpec.c3,
          ...confirmedAtFrame,
          ...(Array.isArray(slotSpec.confirmedMoves) ? slotSpec.confirmedMoves : [])
        ];
        const orderedCandidates = [];
        for (const rawM of rawCandidates) {
          const trimmed = String(rawM || '').replace(/\\*/g, '').trim();
          if (trimmed && !orderedCandidates.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
            orderedCandidates.push(trimmed);
          }
        }

        if (confirmedAtFrame.length >= 2) {
          const locked = confirmedAtFrame.slice(0, 2);
          return {
            displayedMoves: locked,
            allPossibleMoves: locked,
            highRiskThirdMove: null,
            isTwoMovesLocked: true,
            confirmedAtFrame
          };
        }

        const rec2 = [slotSpec.meta.c1 || slotSpec.c1, slotSpec.meta.c2 || slotSpec.c2]
          .map(m => String(m || '').trim())
          .filter((v, i, a) => v && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

        const confirmedOutsideTop2 = confirmedAtFrame.find(cm => !rec2.some(r => r.toLowerCase() === cm.toLowerCase()));
        let chosenThird = null;
        let isRiskBadgeThird = false;

        if (confirmedOutsideTop2) {
          chosenThird = confirmedOutsideTop2;
          isRiskBadgeThird = false;
        } else {
          const nextThree = orderedCandidates
            .filter(cand => !rec2.some(r => r.toLowerCase() === cand.toLowerCase()))
            .slice(0, 3);
          let bestScore = -1;
          for (const candMove of nextThree) {
            const { pct: dmgPct, mStats } = calcChargedDmgPct(
              slotSpec.meta, actUser.meta, candMove, slotSpec.isShadow, actUser.isShadow, oAtkStg[sIdx] || 0, pDefStg[uIdx] || 0
            );
            const cost = Math.max(35, Math.min(100, mStats.energy || 50));
            const canKoNow = dmgPct >= uHpNow;
            const dpeScore = (dmgPct * 50) / cost;
            const score = (canKoNow ? 10000 + (100 - cost) * 10 : 0) + dmgPct + dpeScore * 0.65;
            if (score > bestScore) {
              bestScore = score;
              chosenThird = candMove;
            }
          }
          isRiskBadgeThird = Boolean(chosenThird);
        }

        const displayed = [...rec2, ...(chosenThird ? [chosenThird] : [])]
          .filter((v, i, a) => v && a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);

        return {
          displayedMoves: displayed,
          allPossibleMoves: orderedCandidates.length > 0 ? orderedCandidates : displayed,
          highRiskThirdMove: isRiskBadgeThird ? chosenThird : null,
          isTwoMovesLocked: false,
          confirmedAtFrame
        };
      }

      const slotMoveSelections = oSpecs.map((o, idx) => selectOppThreeMovesForSlot(o, idx));
      const activeOppSelection = slotMoveSelections[oIdx] || selectOppThreeMovesForSlot(actOpp, oIdx);

      // v7.14: Reconstruct 3-Stage Charged-Move GUI Energy Lifecycle (5s Countdown/Minigame -> OCR Validation or Provisional Deduction -> HP Resolution)
      const combinedBannerStr = String((f.ocrMidBannerText || f.moveBannerText || '') + ' ' + (f.ocrBottomMovesText || '')).toLowerCase();
      let chargeStartIdx = frameArrayIdx;
      while (chargeStartIdx > 0 && (
        String(frames[chargeStartIdx - 1].pendingChargeActor || '').toLowerCase() === 'opp' ||
        Boolean(frames[chargeStartIdx - 1].isTopCountdownActive)
      )) {
        chargeStartIdx--;
      }
      const isOppChargeWin = String(f.pendingChargeActor || '').toLowerCase() === 'opp' ||
        Boolean(f.isTopCountdownActive) ||
        /attack incoming|protect shield|shields remaining/i.test(combinedBannerStr) ||
        String(f.recommendedPhase || '').toUpperCase() === 'SHIELD_CALL';
      let usedBannerTxtInCharge = '';
      if (isOppChargeWin) {
        for (let k = chargeStartIdx; k <= frameArrayIdx; k++) {
          const bTxt = String((frames[k] && (frames[k].ocrMidBannerText || frames[k].moveBannerText)) || '');
          if (/\\bused\\b/i.test(bTxt)) {
            usedBannerTxtInCharge = bTxt;
            break;
          }
        }
      }
      const hasUsedBannerSoFar = Boolean(usedBannerTxtInCharge);
      const elapsedInChargeMs = frames[chargeStartIdx] ? Math.max(0, (f.relTimeMs || 0) - (frames[chargeStartIdx].relTimeMs || 0)) : 0;
      const isOppCountdownPhase = Boolean(isOppChargeWin && !hasUsedBannerSoFar && (Boolean(f.isTopCountdownActive) || elapsedInChargeMs < 4800));
      const isShieldDecisionVisible = Boolean(showShieldHud && isOppCountdownPhase);

      const rawCandNames = activeOppSelection.allPossibleMoves.length > 0
        ? activeOppSelection.allPossibleMoves
        : activeOppSelection.displayedMoves;
      const seenMoveLower = new Set();
      const candMoveNames = rawCandNames.filter(m => {
        const kl = String(m).toLowerCase();
        if (seenMoveLower.has(kl)) return false;
        seenMoveLower.add(kl);
        return true;
      });
      const oppCandCostMap = {};
      let minCandCost = 50;
      for (const mn of candMoveNames) {
        const st = lookupChargedStats(mn, actOpp.meta.types[0]);
        const c = Math.max(35, Math.min(100, st.energy || 50));
        oppCandCostMap[mn] = c;
        if (c < minCandCost) minCandCost = c;
      }
      if (candMoveNames.length === 0) minCandCost = 35;

      const startOppF = frames[chargeStartIdx] || f;
      const startWinOppE = (Array.isArray(startOppF.oppSlotEnergy) && startOppF.oppSlotEnergy[oIdx] !== undefined)
        ? Number(startOppF.oppSlotEnergy[oIdx])
        : Number(startOppF.oppEnergy ?? oSlotE[oIdx] ?? 0);
      let prevBeforeOppE = -1;
      if (chargeStartIdx > 0 && frames[chargeStartIdx - 1]) {
        const pf = frames[chargeStartIdx - 1];
        prevBeforeOppE = (Array.isArray(pf.oppSlotEnergy) && pf.oppSlotEnergy[oIdx] !== undefined)
          ? Number(pf.oppSlotEnergy[oIdx])
          : Number(pf.oppEnergy ?? -1);
      }
      const rawPreThrowOppE = isOppChargeWin
        ? ((startWinOppE >= minCandCost && (prevBeforeOppE <= 0 || startWinOppE >= prevBeforeOppE))
            ? Math.max(minCandCost, Math.min(100, startWinOppE))
            : Math.max(minCandCost, Math.min(100, Math.max(prevBeforeOppE, startWinOppE + minCandCost))))
        : Math.max(minCandCost, Math.min(100, Number(oSlotE[oIdx] ?? 0)));
      const hpOppEAtStart = Number(startOppF.oppEnergyHp ?? f.oppEnergyHp ?? rawPreThrowOppE);
      const hpOppConfAtStart = Number(startOppF.oppConfHp ?? f.oppConfHp ?? 75);
      const promotedByHpReplay = isOppChargeWin && hpOppConfAtStart >= 55 && hpOppEAtStart > rawPreThrowOppE;
      const reconstructedPreThrowOppE = promotedByHpReplay ? Math.min(100, hpOppEAtStart) : rawPreThrowOppE;
      const oppHpPromoTagReplay = String(f.oppHpPromoTag || startOppF.oppHpPromoTag || (promotedByHpReplay ? '[+1F HP]' : '')).trim();

      if (isOppChargeWin) {
        if (isOppCountdownPhase) {
          // Stage 1 (5s Countdown): Hold pre-throw energy on the GUI so header, move rows, 3v3 matrix, and Shield Decision Overlay match!
          oSlotE[oIdx] = reconstructedPreThrowOppE;
        } else if (usedBannerTxtInCharge) {
          // Stage 2 (Validated by "<Opponent> used <Move>!" OCR): Deduct exact move cost immediately!
          const mMatch = usedBannerTxtInCharge.match(/\\bused\\s+([^!.]+)/i);
          const rawMoveStr = mMatch ? mMatch[1].trim() : '';
          let ocrMoveCost = minCandCost;
          if (rawMoveStr) {
            const matchedCand = candMoveNames.find(mn =>
              mn.toLowerCase() === rawMoveStr.toLowerCase() || rawMoveStr.toLowerCase().includes(mn.toLowerCase())
            );
            if (matchedCand && oppCandCostMap[matchedCand]) {
              ocrMoveCost = oppCandCostMap[matchedCand];
            } else {
              const st = lookupChargedStats(rawMoveStr, actOpp.meta.types[0]);
              ocrMoveCost = Math.max(35, Math.min(100, st.energy || minCandCost));
            }
          }
          const effPre = Math.max(reconstructedPreThrowOppE, ocrMoveCost);
          oSlotE[oIdx] = Math.max(0, Math.min(100, effPre - ocrMoveCost));
        } else {
          // Stage 3 (5s Countdown ended, waiting on HP to resolve while OCR failed): Provisionally deduct minimum move energy!
          oSlotE[oIdx] = Math.max(0, Math.min(100, reconstructedPreThrowOppE - minCandCost));
        }
      }

      let userChargeStartIdx = frameArrayIdx;
      while (userChargeStartIdx > 0 &&
        String(frames[userChargeStartIdx - 1].pendingChargeActor || '').toLowerCase() === 'user'
      ) {
        userChargeStartIdx--;
      }
      const isUserChargeWin = String(f.pendingChargeActor || '').toLowerCase() === 'user';
      let userUsedBannerTxtInCharge = '';
      if (isUserChargeWin) {
        for (let k = userChargeStartIdx; k <= frameArrayIdx; k++) {
          const bTxt = String((frames[k] && (frames[k].ocrMidBannerText || frames[k].moveBannerText)) || '');
          if (/\\bused\\b/i.test(bTxt)) {
            userUsedBannerTxtInCharge = bTxt;
            break;
          }
        }
      }
      const elapsedInUserChargeMs = frames[userChargeStartIdx] ? Math.max(0, (f.relTimeMs || 0) - (frames[userChargeStartIdx].relTimeMs || 0)) : 0;
      const hasUserMinigameNow = /get ready|nice|great|excellent/i.test(combinedBannerStr);
      const isUserMinigamePhase = Boolean(isUserChargeWin && !userUsedBannerTxtInCharge && (hasUserMinigameNow || elapsedInUserChargeMs < 4000));
      if (isUserChargeWin) {
        const uC1Cost = Math.max(35, Math.min(100, lookupChargedStats(actUser.c1, actUser.meta.types[0]).energy || 45));
        const hasU2 = Boolean(actUser.c2 && actUser.c2.toLowerCase() !== String(actUser.c1 || '').toLowerCase());
        const uC2Cost = hasU2 ? Math.max(35, Math.min(100, lookupChargedStats(actUser.c2, actUser.meta.types[0]).energy || 50)) : uC1Cost;
        const cheapestUserCost = Math.min(uC1Cost, uC2Cost);
        const prevUserF = userChargeStartIdx > 0 ? frames[userChargeStartIdx - 1] : f;
        const prevLeftFill = Number(prevUserF?.leftCircleFillPct ?? -1);
        const prevRightFill = Number(prevUserF?.rightCircleFillPct ?? -1);
        const provisionalUserCost = (hasU2 && prevRightFill >= 95 && prevLeftFill >= 0 && prevLeftFill < 92)
          ? uC2Cost
          : ((prevLeftFill >= 95 && (!hasU2 || (prevRightFill >= 0 && prevRightFill < 92))) ? uC1Cost : cheapestUserCost);
        const startUserF = frames[userChargeStartIdx] || f;
        const startWinUserE = (Array.isArray(startUserF.userSlotEnergy) && startUserF.userSlotEnergy[uIdx] !== undefined)
          ? Number(startUserF.userSlotEnergy[uIdx])
          : Number(startUserF.userEnergy ?? pSlotE[uIdx] ?? 0);
        let prevBeforeUserE = -1;
        if (userChargeStartIdx > 0 && frames[userChargeStartIdx - 1]) {
          const pf = frames[userChargeStartIdx - 1];
          prevBeforeUserE = (Array.isArray(pf.userSlotEnergy) && pf.userSlotEnergy[uIdx] !== undefined)
            ? Number(pf.userSlotEnergy[uIdx])
            : Number(pf.userEnergy ?? -1);
        }
        const reconstructedPreThrowUserE = (startWinUserE >= cheapestUserCost && (prevBeforeUserE <= 0 || startWinUserE >= prevBeforeUserE))
          ? Math.max(cheapestUserCost, Math.min(100, startWinUserE))
          : Math.max(cheapestUserCost, Math.min(100, Math.max(prevBeforeUserE, startWinUserE + provisionalUserCost)));
        if (isUserMinigamePhase) {
          pSlotE[uIdx] = reconstructedPreThrowUserE;
        } else if (userUsedBannerTxtInCharge) {
          const mMatch = userUsedBannerTxtInCharge.match(/\\bused\\s+([^!.]+)/i);
          const rawMoveStr = mMatch ? mMatch[1].trim() : '';
          let ocrUserCost = provisionalUserCost;
          if (rawMoveStr) {
            if (hasU2 && (rawMoveStr.toLowerCase() === actUser.c2.toLowerCase() || rawMoveStr.toLowerCase().includes(actUser.c2.toLowerCase()))) {
              ocrUserCost = uC2Cost;
            } else if (actUser.c1 && (rawMoveStr.toLowerCase() === actUser.c1.toLowerCase() || rawMoveStr.toLowerCase().includes(actUser.c1.toLowerCase()))) {
              ocrUserCost = uC1Cost;
            } else {
              ocrUserCost = Math.max(35, Math.min(100, lookupChargedStats(rawMoveStr, actUser.meta.types[0]).energy || provisionalUserCost));
            }
          }
          const effPreU = Math.max(reconstructedPreThrowUserE, ocrUserCost);
          pSlotE[uIdx] = Math.max(0, Math.min(100, effPreU - ocrUserCost));
        } else {
          const effPreU = Math.max(reconstructedPreThrowUserE, provisionalUserCost);
          pSlotE[uIdx] = Math.max(0, Math.min(100, effPreU - provisionalUserCost));
        }
      }

      // Build scannedOpponents array for 3v3 Matrix
      const scannedOpponents = oSpecs.map((o, idx) => {
        const sel = slotMoveSelections[idx] || selectOppThreeMovesForSlot(o, idx);
        const disp = sel.displayedMoves;
        const m1Name = disp[0] || o.c1;
        const m2Name = disp[1] || o.c2;
        const m3Name = disp[2] || '';
        const d1 = m1Name ? calcChargedDmgPct(o.meta, actUser.meta, m1Name, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct : 0;
        const d2 = m2Name ? calcChargedDmgPct(o.meta, actUser.meta, m2Name, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct : 0;
        const d3 = m3Name ? calcChargedDmgPct(o.meta, actUser.meta, m3Name, o.isShadow, actUser.isShadow, oAtkStg[idx] || 0, pDefStg[uIdx] || 0).pct : 0;
        const allSlotMoves = sel.allPossibleMoves.length > 0 ? sel.allPossibleMoves : disp;
        const cheapestE = allSlotMoves.reduce((minE, mn) => {
          const st = lookupChargedStats(mn, o.meta.types[0]);
          return Math.min(minE, Math.max(35, Math.min(100, st.energy || 50)));
        }, 50);
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
          confirmedChargedMoves: sel.confirmedAtFrame,
          candidateChargedMoves: sel.allPossibleMoves,
          c1: m1Name ? (abbrMove5(m1Name) + ' (' + d1 + '%)') : '',
          c2: m2Name ? (abbrMove5(m2Name) + ' (' + d2 + '%)') : '',
          c3: m3Name ? (abbrMove5(m3Name) + ' (' + d3 + '%)') : '',
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
      const oppMoveNames = activeOppSelection.displayedMoves;
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

        const isConfirmed = activeOppSelection.confirmedAtFrame.some(cm => cm.toLowerCase() === mName.toLowerCase());
        const isHighRiskThirdMove = !isConfirmed &&
          activeOppSelection.highRiskThirdMove &&
          activeOppSelection.highRiskThirdMove.toLowerCase() === mName.toLowerCase();
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
          isHighRiskThirdMove: Boolean(isHighRiskThirdMove),
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
      const rawGoalStr = String(f.recommendedGoal || '').trim();
      const goalParts = rawGoalStr.split(' | ').map(s => s.trim()).filter(Boolean);
      const recSubGoal = goalParts[0] || ('Opp ' + (cheapestOppRow ? cheapestOppRow.shortName : 'Move') + ' in ' + oppFastsToMove + 'F (' + curOppE + 'E/' + nextOppCost + 'E)');
      const recBackline = goalParts.length > 1
        ? goalParts.slice(1).join(' | ')
        : (rawGoalStr.startsWith('🔮') || rawGoalStr.startsWith('📋') || rawGoalStr.startsWith('🎯') ? rawGoalStr : ('🎯 ' + recSubGoal));
      const shieldPlan = uShields > 0 && cheapestOppRow && cheapestOppRow.activeDmgPct >= pSlotHp[uIdx] ? '1S (KO Risk)' : (uShields + 'S');

      const oppFastTelemetry = abbrMove5(actOpp.fastMove) + ' ' + actOpp.fastTurns + 't(' + (actOpp.fastTurns * 0.5).toFixed(1) + 's)/+' + actOpp.fastEnergy + 'e';
      const userFastTelemetry = abbrMove5(actUser.fastMove) + ' ' + actUser.fastTurns + 't(' + (actUser.fastTurns * 0.5).toFixed(1) + 's)/+' + actUser.fastEnergy + 'e';

      // v6.42 / v6.50 / v7.14: Compute Pillar 4 & candidate moves for Shield Decision Overlay
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

      const twoMovesLocked = Boolean(activeOppSelection.isTwoMovesLocked);

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

      const effectiveBankedE = reconstructedPreThrowOppE;

      const normShieldRows = rawShieldRows.map(r => ({ ...r, isFunded: effectiveBankedE >= r.energyCost }));
      const sortShieldRows = (a, b) => (Number(b.isKo) - Number(a.isKo)) || (b.dmgPct - a.dmgPct) || (a.energyCost - b.energyCost);
      const allFundedMoves = normShieldRows.filter(r => r.isFunded).sort(sortShieldRows);
      const allUnfundedMoves = normShieldRows.filter(r => !r.isFunded).sort(sortShieldRows);

      // v6.50 Overflow Guard: show up to 6 funded moves and up to 4 highest-threat unfunded moves
      const fundedMoves = allFundedMoves.slice(0, 6);
      const unfundedMoves = allUnfundedMoves.slice(0, 4);
      const hiddenFundedCount = Math.max(0, allFundedMoves.length - fundedMoves.length);
      const hiddenUnfundedCount = Math.max(0, allUnfundedMoves.length - unfundedMoves.length);

      const allFundedKo = allFundedMoves.length > 0 && allFundedMoves.every(r => r.isKo);
      const someFundedKo = allFundedMoves.some(r => r.isKo) && allFundedMoves.some(r => !r.isKo);
      const anyFundedFarmed = allFundedMoves.some(r => !r.isKo && !r.canReachNextMoveIfTanked);
      const unfundedKo = allFundedMoves.every(r => !r.isKo) && allUnfundedMoves.some(r => r.isKo);
      const worstFarmed = allFundedMoves.find(r => !r.isKo && !r.canReachNextMoveIfTanked);

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
      const promoBadgeReplay = oppHpPromoTagReplay && oppHpPromoTagReplay.startsWith('[+') ? (' ' + oppHpPromoTagReplay) : '';
      const sdHeaderLine = sdVerdict + '  •  ' + actOpp.code + '(' + effectiveBankedE + 'e' + promoBadgeReplay + ') vs ' + actUser.code + '(' + uHpNow + '%)' + lockedTag;

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
          hiddenFundedCount,
          hiddenUnfundedCount,
          fundedMoves,
          unfundedMoves
        },
        activeOpponentFastMove: actOpp.fastMove,
        activeOpponentTurns: actOpp.fastTurns,
        oppFastTelemetry,
        oppFastMoveStatus: actOpp.fastStatus,
        oppFastMoveConfirmed: actOpp.fastConfirmed,
        confirmedOppChargedMoves: activeOppSelection.confirmedAtFrame,
        userFastTelemetry,
        oppCountMode: 'my_fasts',
        enable4ChargedMoves: false,
        fastDetectTurnOffset: 0,
        overlayTransparencyPct: 50,
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
        isAttackIncomingPromptActive: Boolean(isOppCountdownPhase || f.isCutsceneActive),
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
        playerSlotEverOnField: pEverOnField,
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
          goal: recBackline,
          goalText: recBackline,
          tacticalSubGoal: recSubGoal,
          line1Text: recAction,
          line2Text: recBackline,
          backlineText: recBackline,
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
          goal: recBackline,
          goalText: recBackline,
          tacticalSubGoal: recSubGoal,
          line1Text: recAction,
          line2Text: recBackline,
          backlineText: recBackline,
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
        team: uSpecs.map((u, idx) => {
          const isFnt = Boolean(pFainted[idx]);
          const hasEnt = Boolean(pEverOnField[idx] || idx === uIdx || (pSlotE[idx] || 0) > 0 || isFnt);
          const eLbl = isFnt ? '0E' : (hasEnt ? ((pSlotE[idx] || 0) + 'E') : '-E');
          return {
            initial: u.name.charAt(0).toUpperCase(),
            code: u.code,
            name: u.name,
            hpPct: pSlotHp[idx],
            energy: pSlotE[idx],
            hasEnteredField: hasEnt,
            bankedEnergyLabel: eLbl
          };
        }),
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
      const effectiveRealSec = (video.currentTime || 0) * mp4TimeCompressionRatio;
      const f = findFrameAtSec(effectiveRealSec);
      if (!f) return;
      try {
        attachOverlayBridge();
        const win = hudIframe.contentWindow;
        if (!win || typeof win.updateBattleData !== 'function') return;
        const payload = buildReplayOverlayPayload(f);
        const pillEl = document.getElementById('dual-energy-pill');
        if (pillEl) {
          const uEff = Number(payload.activeUserEnergy ?? f.userEnergy ?? 0);
          const oEff = Number(payload.activeOppEnergy ?? f.oppEnergy ?? 0);
          const uM = Number(f.userEnergyMeter ?? uEff);
          const uH = Number(f.userEnergyHp ?? uEff);
          const uCm = Number(f.userConfMeter ?? (f.leftCircleFillPct >= 1 && f.leftCircleFillPct <= 94 ? 96 : 84));
          const uCh = Number(f.userConfHp ?? 82);
          const oM = Number(f.oppEnergyMeter ?? oEff);
          const oH = Number(f.oppEnergyHp ?? oEff);
          const oCm = Number(f.oppConfMeter ?? 86);
          const oCh = Number(f.oppConfHp ?? 82);
          const pTag = String(f.oppHpPromoTag || (oEff > oM && oH >= oEff ? '★HP' : '')).trim();
          const pSuffix = pTag ? (' ' + pTag) : '';
          pillEl.textContent = '⚡ U: ' + uEff + 'E [M:' + uM + 'E ' + uCm + '% | H:' + uH + 'E ' + uCh + '%] • O: ' + oEff + 'E [M:' + oM + 'E ' + oCm + '% | H:' + oH + 'E ' + oCh + '%' + pSuffix + ']';
          pillEl.style.display = hudMode === 'off' ? 'none' : 'block';
        }
        if (typeof win.setReplayShieldOverlayEnabled === 'function') {
          win.setReplayShieldOverlayEnabled(showShieldHud);
        }
        win.updateBattleData(payload);
        if (typeof win.setReplayHudMode === 'function') {
          win.setReplayHudMode(hudMode === 'diag' ? 'diagnostic' : hudMode);
        }
        if (hudMode === 'diag' && typeof win.setReplayDiagnosticText === 'function') {
          const uEff = Number(payload.activeUserEnergy ?? f.userEnergy ?? 0);
          const oEff = Number(payload.activeOppEnergy ?? f.oppEnergy ?? 0);
          const uM = Number(f.userEnergyMeter ?? uEff);
          const uH = Number(f.userEnergyHp ?? uEff);
          const uCm = Number(f.userConfMeter ?? 90);
          const uCh = Number(f.userConfHp ?? 82);
          const oM = Number(f.oppEnergyMeter ?? oEff);
          const oH = Number(f.oppEnergyHp ?? oEff);
          const oCm = Number(f.oppConfMeter ?? 86);
          const oCh = Number(f.oppConfHp ?? 82);
          const diagStr =
            'F#' + String(f.frameIdx || 0).padStart(4, '0') + ' (' + ((f.relTimeMs || 0) / 1000).toFixed(2) + 's) | Cutscene=' + Boolean(f.isCutsceneActive) + '\\n' +
            'DUAL E: U=' + uEff + 'E [M:' + uM + 'E ' + uCm + '% | H:' + uH + 'E ' + uCh + '%] • O=' + oEff + 'E [M:' + oM + 'E ' + oCm + '% | H:' + oH + 'E ' + oCh + '% ' + (f.oppHpPromoTag || '') + ']\\n' +
            'RAW HP: U=' + (f.rawUserHpPct ?? -1) + '% (commit ' + (f.userHpPct ?? -1) + '%) | O=' + (f.rawOppHpPct ?? -1) + '% (commit ' + (f.oppHpPct ?? -1) + '%)\\n' +
            'CIRCLE: L=' + (f.leftCircleFillPct ?? -1) + '% R=' + (f.rightCircleFillPct ?? -1) + '% | SRC=' + (f.energySource || 'FAST_CADENCE') + '\\n' +
            'OCR: ' + JSON.stringify((f.ocrTopRightText || '').replace(/\\n/g, ' ')) + ' | Banner: ' + JSON.stringify((f.ocrMidBannerText || '').replace(/\\n/g, ' '));
          win.setReplayDiagnosticText(diagStr);
        }
      } catch (e) {
        console.error('syncHudFrame error:', e);
      }
      updateActiveEventChip(effectiveRealSec);
    }

    function scrubVideo(val) {
      const vDur = video.duration || ((frames[frames.length - 1] && frames[frames.length - 1].relTimeMs) ? (frames[frames.length - 1].relTimeMs / 1000) / mp4TimeCompressionRatio : 180);
      video.currentTime = (Number(val) / 1000) * vDur;
      syncHudFrame();
    }

    video.addEventListener('timeupdate', () => {
      const vDur = video.duration || ((frames[frames.length - 1] && frames[frames.length - 1].relTimeMs) ? (frames[frames.length - 1].relTimeMs / 1000) / mp4TimeCompressionRatio : 0);
      const cur = video.currentTime || 0;
      if (vDur > 0) {
        document.getElementById('video-scrubber').value = String(Math.round((cur / vDur) * 1000));
      }
      const dispCur = cur * mp4TimeCompressionRatio;
      const dispDur = vDur * mp4TimeCompressionRatio;
      document.getElementById('time-readout').textContent = dispCur.toFixed(1) + 's / ' + dispDur.toFixed(1) + 's';
      syncHudFrame();
    });
    const urlStartSec = parseFloat(new URLSearchParams(window.location.search).get('t') || '0') || 0;
    let initialSeekApplied = false;
    function applyInitialUrlSeekIfNeeded() {
      if (initialSeekApplied || urlStartSec <= 0) return;
      if (video.readyState >= 1) {
        initialSeekApplied = true;
        video.currentTime = Math.max(0, urlStartSec / mp4TimeCompressionRatio);
        syncHudFrame();
      }
    }

    function getEffectiveBattleEndSec() {
      const candidates = [];
      const vDur = Number(video && video.duration) || 0;
      if (vDur > 1 && Number.isFinite(vDur)) {
        candidates.push(vDur * mp4TimeCompressionRatio);
      }
      const sumDur = Number(
        summaryHeader && (summaryHeader.durationSec ?? summaryHeader.battleDurationSec ?? summaryHeader.elapsedSec)
      ) || 0;
      if (sumDur > 3 && sumDur < 600) {
        candidates.push(sumDur);
      }
      if (SHARE_DURATION_SEC > 3 && SHARE_DURATION_SEC < 600) {
        candidates.push(SHARE_DURATION_SEC);
      }
      if (summaryHeader && Array.isArray(summaryHeader.timelineEvents)) {
        let uKoCount = 0;
        let oKoCount = 0;
        for (const ev of summaryHeader.timelineEvents) {
          const sec = Number(ev && ev.t);
          if (!Number.isFinite(sec) || sec <= 0 || sec > 600) continue;
          const tStr = String((ev && ev.type) || '').toUpperCase();
          if (tStr.includes('BATTLE_END') || tStr.includes('MATCH_END')) {
            candidates.push(sec + 0.25);
            break;
          }
          if (tStr.includes('FAINT') || tStr.includes('KO')) {
            const act = String((ev && ev.actor) || '').toUpperCase();
            if (act === 'USER' || act === 'U' || act === 'PLAYER') uKoCount++;
            else if (act === 'OPP' || act === 'OPPONENT' || act === 'O') oKoCount++;
            if (uKoCount >= 3 || oKoCount >= 3) {
              candidates.push(sec + 0.35);
              break;
            }
          }
        }
      }
      for (const f of frames) {
        const sec = (Number(f.relTimeMs) || 0) / 1000;
        if (sec <= 3 || sec > 600) continue;
        const bTxt = String((f.moveBannerText || '') + ' ' + (f.ocrMidBannerText || '')).trim();
        if (/\\b(you win|good effort)\\b/i.test(bTxt)) {
          candidates.push(sec);
          break;
        }
      }
      if (candidates.length === 0 && frames.length > 1) {
        const lastSec = (Number(frames[frames.length - 1].relTimeMs) || 0) / 1000;
        if (lastSec > 0 && lastSec < 600) candidates.push(lastSec);
      }
      return candidates.length > 0 ? Math.min(...candidates) : 450;
    }

    video.addEventListener('loadedmetadata', () => {
      recalcMp4TimeCompression();
      const dispDur = (video.duration || 0) * mp4TimeCompressionRatio;
      document.getElementById('time-readout').textContent = '0.0s / ' + dispDur.toFixed(1) + 's';
      buildEventChips();
      applyInitialUrlSeekIfNeeded();
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
        const rawFrames = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (obj.recordType === 'BATTLE_DVR_SUMMARY_HEADER') {
              summaryHeader = obj.battleSummary || null;
            } else if (typeof obj.frameIdx === 'number') {
              const relMs = Number(obj.videoElapsedMs ?? obj.relTimeMs ?? 0);
              if (!Number.isFinite(relMs) || relMs < 0 || relMs > 600000) continue;
              obj.relTimeMs = relMs;
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
              rawFrames.push(obj);
            }
          } catch (_) {}
        }
        const sumCeilSec = Number(
          summaryHeader && (summaryHeader.durationSec ?? summaryHeader.battleDurationSec ?? summaryHeader.elapsedSec)
        ) || 0;
        const shareCeilSec = SHARE_DURATION_SEC > 3 && SHARE_DURATION_SEC < 600 ? SHARE_DURATION_SEC : 0;
        const knownEndSec = (sumCeilSec > 3 && sumCeilSec < 600)
          ? (shareCeilSec > 0 ? Math.min(sumCeilSec, shareCeilSec) : sumCeilSec)
          : shareCeilSec;
        const maxFrameMs = knownEndSec > 3 ? (knownEndSec + 1.5) * 1000 : 600000;
        let parsed = [];
        let prevAcceptedMs = -1;
        let combatStarted = false;
        for (const f of rawFrames) {
          if (f.relTimeMs > maxFrameMs) break;
          if (prevAcceptedMs > 10000 && f.relTimeMs < prevAcceptedMs - 5000) break;
          if (f.isBattleActive === true || f.relTimeMs > 3000) combatStarted = true;
          if (combatStarted && f.isBattleActive === false) break;
          const bTxt = String(f.moveBannerText || '');
          if (f.relTimeMs > 5000 && /\\b(you win|good effort)\\b/i.test(bTxt)) {
            parsed.push(f);
            break;
          }
          parsed.push(f);
          prevAcceptedMs = f.relTimeMs;
        }
        if (parsed.length === 0 && rawFrames.length > 0) {
          parsed = rawFrames;
        }
        if (parsed.length > 1) {
          const spanMs = (parsed[parsed.length - 1].relTimeMs || 0) - (parsed[0].relTimeMs || 0);
          if (spanMs < 3000) {
            parsed.forEach((f, idx) => { f.relTimeMs = idx * 100; });
          }
        }
        frames = parsed;
        recalcMp4TimeCompression();
        applyInitialUrlSeekIfNeeded();
        buildEventChips();
        syncHudFrame();
      } catch (e) {
        console.error('Trace load error:', e);
      }
    }

    function shareCurrentReplayMoment() {
      const curRealSec = Math.round((video.currentTime || 0) * mp4TimeCompressionRatio);
      const baseUrl = window.location.origin + '/watch/' + encodeURIComponent(SHARE_ID || '');
      const shareUrl = curRealSec >= 3 ? (baseUrl + '?t=' + curRealSec) : baseUrl;
      const shareTitle = 'SilphScope DVR • ' + (SHARE_MATCHUP || SHARE_LEAGUE || 'Battle Replay');
      if (navigator.share) {
        navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl }).catch(() => {});
        return;
      }
      try {
        navigator.clipboard.writeText(shareUrl);
        const btn = document.getElementById('btn-share-moment');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '✅ Copied';
          setTimeout(() => { btn.textContent = orig; }, 1800);
        }
      } catch (_) {
        prompt('Copy Replay Link:', shareUrl);
      }
    }

    let renderedEventChipList = [];
    function updateActiveEventChip(curSec) {
      if (!renderedEventChipList.length) return;
      let activeIdx = -1;
      for (let i = 0; i < renderedEventChipList.length; i++) {
        if (curSec + 0.6 >= renderedEventChipList[i].eventSec) {
          activeIdx = i;
        } else {
          break;
        }
      }
      for (let i = 0; i < renderedEventChipList.length; i++) {
        const el = renderedEventChipList[i].el;
        const shouldActive = i === activeIdx && Math.abs(curSec - renderedEventChipList[i].eventSec) <= 4.5;
        if (shouldActive && !el.classList.contains('active-chip')) {
          el.classList.add('active-chip');
          const drawerEl = document.getElementById('tools-drawer');
          if (drawerEl && getComputedStyle(drawerEl).display !== 'none') {
            try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
          }
        } else if (!shouldActive && el.classList.contains('active-chip')) {
          el.classList.remove('active-chip');
        }
      }
    }

    function shortActorTag(actor) {
      const a = String(actor || '').toUpperCase();
      if (a === 'USER' || a === 'U' || a === 'PLAYER') return 'U';
      if (a === 'OPP' || a === 'OPPONENT' || a === 'O') return 'O';
      return a ? a.slice(0, 3) : '';
    }

    function buildEventChips() {
      const container = document.getElementById('event-chips');
      if (!container) return;
      container.innerHTML = '';
      renderedEventChipList = [];
      const collected = [];
      const battleEndSec = getEffectiveBattleEndSec();

      function isWithinBattle(sec) {
        return Number.isFinite(sec) && sec >= 0 && sec <= 450 && sec <= battleEndSec;
      }

      function hasNearbyEvent(kind, actorTag, sec, windowSec) {
        return collected.some(e =>
          e.kind === kind &&
          (!actorTag || !e.actor || e.actor === actorTag) &&
          Math.abs(e.sec - sec) <= windowSec
        );
      }

      // 1. Structured timelineEvents from BATTLE_DVR_SUMMARY_HEADER
      if (summaryHeader && Array.isArray(summaryHeader.timelineEvents)) {
        let uKoSeen = 0;
        let oKoSeen = 0;
        for (const ev of summaryHeader.timelineEvents) {
          const sec = Number(ev.t);
          if (!isWithinBattle(sec)) continue;
          const typeStr = String(ev.type || '').toUpperCase();
          if (typeStr.includes('BATTLE_END') || typeStr.includes('MATCH_END')) break;
          const actor = shortActorTag(ev.actor);
          if (typeStr.includes('CHARGE')) {
            const mv = ev.inferredMoveName || ev.move || 'Charged Move';
            const shTag = ev.shielded ? ' 🛡️' : '';
            collected.push({
              sec,
              kind: 'charge',
              actor,
              label: '⚡ ' + sec.toFixed(1) + 's ' + (actor ? actor + ': ' : '') + mv + shTag
            });
          } else if (typeStr.includes('SHIELD')) {
            if (!hasNearbyEvent('charge', '', sec, 2.5)) {
              collected.push({
                sec,
                kind: 'shield',
                actor,
                label: '🛡️ ' + sec.toFixed(1) + 's ' + (actor || '') + ' Shield'
              });
            }
          } else if (typeStr.includes('SWAP') || typeStr.includes('SWITCH')) {
            const pokeIn = ev.pokemonIn || ev.activePokemon || ev.species || 'Swap';
            collected.push({
              sec,
              kind: 'swap',
              actor,
              label: '🔄 ' + sec.toFixed(1) + 's ' + (actor ? actor + '→' : '→') + pokeIn
            });
          } else if (typeStr.includes('FAINT') || typeStr.includes('KO')) {
            const pokeKo = ev.pokemonFainted || ev.activePokemon || ev.species || 'KO';
            collected.push({
              sec,
              kind: 'faint',
              actor,
              label: '💀 ' + sec.toFixed(1) + 's ' + (actor ? actor + ': ' : '') + pokeKo
            });
            if (actor === 'U') uKoSeen++;
            else if (actor === 'O') oKoSeen++;
            if (uKoSeen >= 3 || oKoSeen >= 3) break;
          } else {
            const detail = ev.inferredMoveName || ev.pokemonIn || ev.pokemonFainted || ev.activePokemon || typeStr;
            collected.push({
              sec,
              kind: 'other',
              actor,
              label: '📌 ' + sec.toFixed(1) + 's ' + (actor ? actor + ': ' : '') + detail
            });
          }
        }
      }

      // 2. Anomalies from BATTLE_DVR_SUMMARY_HEADER
      if (summaryHeader && Array.isArray(summaryHeader.anomalies)) {
        for (const an of summaryHeader.anomalies) {
          const sec = Number(an.t ?? (an.elapsedMs ? an.elapsedMs / 1000 : 0)) || 0;
          if (sec <= 0 || !isWithinBattle(sec)) continue;
          const desc = String(an.move || an.type || an.reason || 'Anomaly').slice(0, 22);
          if (!hasNearbyEvent('anomaly', '', sec, 2.0)) {
            collected.push({
              sec,
              kind: 'anomaly',
              actor: shortActorTag(an.actor || ''),
              label: '⚠️ ' + sec.toFixed(1) + 's ' + desc
            });
          }
        }
      }

      // 3. Frame-derived swaps, move banners & shield drops (fills gaps when timelineEvents was partial or absent)
      let prevU = '', prevO = '', prevBanner = '';
      let prevUShields = null, prevOShields = null;
      let lastBannerSec = -10, lastUSwapSec = -10, lastOSwapSec = -10;
      for (const f of frames) {
        const sec = (Number(f.relTimeMs) || 0) / 1000;
        if (!isWithinBattle(sec)) {
          if (sec > battleEndSec) break;
          continue;
        }
        const banner = String(f.moveBannerText || '').replace(/\\s+/g, ' ').trim();
        if (sec > 5 && /\\b(you win|good effort)\\b/i.test(banner)) break;
        const usedMatch = banner ? banner.match(/used\\s+([^!|]+)/i) : null;
        if (usedMatch && usedMatch[1] && banner !== prevBanner && (sec - lastBannerSec) > 2.5) {
          prevBanner = banner;
          lastBannerSec = sec;
          const shortBanner = usedMatch[1].trim().slice(0, 26);
          if (shortBanner && !hasNearbyEvent('charge', '', sec, 3.2)) {
            collected.push({
              sec,
              kind: 'charge',
              actor: '',
              label: '⚡ ' + sec.toFixed(1) + 's ' + shortBanner
            });
          }
        }
        const curU = String(f.userActiveSpecies || '').trim();
        if (curU && prevU && curU !== prevU && (sec - lastUSwapSec) > 2.0) {
          lastUSwapSec = sec;
          if (!hasNearbyEvent('swap', 'U', sec, 3.0) && !hasNearbyEvent('faint', 'U', sec, 3.0)) {
            collected.push({
              sec,
              kind: 'swap',
              actor: 'U',
              label: '🔄 ' + sec.toFixed(1) + 's U→' + curU
            });
          }
        }
        const curO = String(f.oppActiveSpecies || '').trim();
        if (curO && prevO && curO !== prevO && (sec - lastOSwapSec) > 2.0) {
          lastOSwapSec = sec;
          if (!hasNearbyEvent('swap', 'O', sec, 3.0) && !hasNearbyEvent('faint', 'O', sec, 3.0)) {
            collected.push({
              sec,
              kind: 'swap',
              actor: 'O',
              label: '🔄 ' + sec.toFixed(1) + 's O→' + curO
            });
          }
        }
        if (typeof f.userShields === 'number') {
          if (prevUShields !== null && f.userShields < prevUShields && f.userShields >= 0) {
            if (!hasNearbyEvent('shield', 'U', sec, 3.0) && !hasNearbyEvent('charge', '', sec, 2.5)) {
              collected.push({
                sec,
                kind: 'shield',
                actor: 'U',
                label: '🛡️ ' + sec.toFixed(1) + 's U Shield'
              });
            }
          }
          prevUShields = f.userShields;
        }
        if (typeof f.oppShields === 'number') {
          if (prevOShields !== null && f.oppShields < prevOShields && f.oppShields >= 0) {
            if (!hasNearbyEvent('shield', 'O', sec, 3.0) && !hasNearbyEvent('charge', '', sec, 2.5)) {
              collected.push({
                sec,
                kind: 'shield',
                actor: 'O',
                label: '🛡️ ' + sec.toFixed(1) + 's O Shield'
              });
            }
          }
          prevOShields = f.oppShields;
        }
        if (curU) prevU = curU;
        if (curO) prevO = curO;
      }

      collected.sort((a, b) => a.sec - b.sec);
      totalTimelineEventCount = collected.length;
      updateToolsToggleLabel();
      const hdrLabel = document.getElementById('chips-count-label');
      if (hdrLabel) {
        hdrLabel.textContent = collected.length > 0 ? ('⏭ Key Events Timeline (' + collected.length + ')') : '⏭ Key Events Timeline';
      }

      if (collected.length === 0) {
        const emptySpan = document.createElement('span');
        emptySpan.style.cssText = 'font-size:10.5px;color:#64748b;padding:2px 0;';
        emptySpan.textContent = 'No discrete charged-move or swap events recorded in this trace.';
        container.appendChild(emptySpan);
        return;
      }

      for (const item of collected) {
        const jumpSec = Math.max(0, item.sec - 1.5);
        addChip(container, item.label, jumpSec, item.sec, item.kind);
      }
    }

    function addChip(container, label, jumpSec, eventSec = 0, kind = 'other') {
      const chip = document.createElement('span');
      chip.className = 'event-chip chip-' + kind;
      chip.textContent = label;
      chip.title = 'Jump to ' + jumpSec.toFixed(1) + 's';
      chip.onclick = () => {
        video.currentTime = jumpSec / mp4TimeCompressionRatio;
        syncHudFrame();
      };
      container.appendChild(chip);
      renderedEventChipList.push({ el: chip, eventSec: eventSec || jumpSec });
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
              ctx.fillStyle = 'rgba(5, 11, 22, 0.92)';
              ctx.fillRect(12, y, 520, 110);
              ctx.strokeStyle = '#2dd4bf';
              ctx.lineWidth = 2;
              ctx.strokeRect(12, y, 520, 110);
              ctx.fillStyle = '#ecfeff';
              ctx.font = 'bold 16px sans-serif';
              ctx.fillText((f.userActiveSpecies || 'User') + ' ' + (f.userHpPct ?? '--') + '% (' + (f.userEnergy ?? 0) + 'E)  vs  ' + (f.oppActiveSpecies || 'Opp') + ' ' + (f.oppHpPct ?? '--') + '% (' + (f.oppEnergy ?? 0) + 'E)', 24, y + 32);
              ctx.fillStyle = '#2dd4bf';
              ctx.font = 'bold 14px sans-serif';
              ctx.fillText(String(f.recommendedAction || f.moveBannerText || 'SilphScope PvP').slice(0, 62), 24, y + 66);
              ctx.fillStyle = '#facc15';
              ctx.font = '12px monospace';
              ctx.fillText('F#' + String(f.frameIdx || 0).padStart(4, '0') + ' ' + ((f.relTimeMs || 0) / 1000).toFixed(1) + 's • ✨ Shiny Origin Dialga Replay', 24, y + 94);
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
  <title>SilphScope DVR • Shiny Origin Dialga Cloud Replay Vault</title>
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#050B16" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="SilphScope DVR" />
  <meta name="application-name" content="SilphScope DVR" />
  <link rel="apple-touch-icon" href="/pwa-icon-192.svg" />
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((r) => r.update().catch(() => {})).catch(() => {});
      });
    }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050b16;
      --card: #0e1b2e;
      --card-alt: #081120;
      --border: #19304e;
      --accent: #2dd4bf;
      --accent-hover: #5eead4;
      --cyan: #67e8f9;
      --amber: #facc15;
      --amber-hover: #fde047;
      --rose: #f43f5e;
      --text: #ecfeff;
      --muted: #99f6e4;
      --text-dim: #94a3b8;
    }
    * { box-sizing: border-box; }
    ::selection {
      background: rgba(45, 212, 191, 0.3);
      color: #ecfeff;
    }
    body {
      margin: 0;
      font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      background-color: var(--bg);
      background-image:
        radial-gradient(circle at 18% 12%, rgba(45, 212, 191, 0.11) 0%, transparent 42%),
        radial-gradient(circle at 82% 18%, rgba(250, 204, 21, 0.08) 0%, transparent 38%),
        linear-gradient(180deg, #050B16 0%, #081120 55%, #050B16 100%);
      background-attachment: fixed;
      color: var(--text);
      min-height: 100vh;
      position: relative;
    }
    .fixed-watermark-bg {
      position: fixed;
      inset: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 0;
      overflow: hidden;
      opacity: 0.14;
    }
    .dialga-watermark-svg {
      width: 580px;
      height: 580px;
      max-width: 90vw;
      max-height: 90vh;
    }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: #050b16; }
    ::-webkit-scrollbar-thumb { background: #19304e; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #2dd4bf; }
    header {
      padding: 12px 20px;
      background: rgba(5, 11, 22, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .dialga-crest-badge {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0e1b2e;
      border: 1.5px solid #2dd4bf;
      box-shadow: 0 0 18px rgba(45, 212, 191, 0.28);
      flex-shrink: 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .dialga-crest-badge:hover {
      transform: scale(1.05);
      box-shadow: 0 0 24px rgba(45, 212, 191, 0.45);
    }
    .nav-pills-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: #081120;
      font-size: 12px;
      font-weight: 800;
      flex-wrap: wrap;
    }
    .nav-pill {
      padding: 6px 12px;
      border-radius: 8px;
      color: rgba(153, 246, 228, 0.85);
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .nav-pill:hover {
      color: #fff;
      background: rgba(30, 41, 59, 0.6);
    }
    .nav-pill.active-pill {
      background: var(--accent);
      color: #042f2e;
      font-weight: 900;
    }
    .nav-pill-gold {
      color: #fde047;
      border: 1px solid rgba(250, 204, 21, 0.3);
    }
    .nav-pill-gold:hover {
      background: rgba(250, 204, 21, 0.15);
      color: #fff;
    }
    .btn-cta {
      padding: 7px 14px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 800;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .active-dvr {
      background: rgba(14, 27, 46, 0.95);
      border: 1.5px solid var(--accent);
      color: var(--accent);
      box-shadow: 0 0 14px rgba(45, 212, 191, 0.25);
    }
    .btn-cta-download {
      background: var(--accent);
      color: #042f2e;
      border: 1.5px solid var(--accent);
      box-shadow: 0 0 16px rgba(45, 212, 191, 0.35);
      font-weight: 900;
    }
    .btn-cta-download:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      box-shadow: 0 0 20px rgba(45, 212, 191, 0.5);
    }
    .btn-cta-upgrade {
      background: rgba(250, 204, 21, 0.16);
      border: 1.5px solid var(--amber);
      color: var(--amber-hover);
      font-weight: 900;
    }
    .btn-cta-upgrade:hover {
      background: rgba(250, 204, 21, 0.26);
      color: #fff;
      box-shadow: 0 0 14px rgba(250, 204, 21, 0.3);
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
      z-index: 1;
    }
    .login-card {
      background: rgba(14, 27, 46, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    input, select {
      background: #081120;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      font-family: inherit;
      flex: 1;
      min-width: 180px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    input:focus, select:focus {
      border-color: var(--accent);
      outline: none;
      box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.25);
    }
    button, .btn-link {
      background: #081120;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 14px;
      font-size: 12.5px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    button:hover, .btn-link:hover {
      background: #14253e;
      border-color: var(--accent);
      color: var(--accent-hover);
      box-shadow: 0 0 10px rgba(45, 212, 191, 0.2);
    }
    button.primary, .btn-link.primary {
      background: var(--accent);
      color: #042f2e;
      border-color: var(--accent);
      font-weight: 800;
      box-shadow: 0 2px 10px rgba(45, 212, 191, 0.25);
    }
    button.primary:hover, .btn-link.primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      box-shadow: 0 0 16px rgba(45, 212, 191, 0.45);
      color: #042f2e;
    }
    button.tab-btn {
      background: #081120;
      color: #94a3b8;
      border: 1px solid var(--border);
      padding: 8px 14px;
      font-size: 12px;
      border-radius: 8px;
    }
    button.tab-btn.active {
      background: rgba(45, 212, 191, 0.18);
      color: var(--accent);
      border-color: var(--accent);
      box-shadow: 0 0 10px rgba(45, 212, 191, 0.22);
    }
    .stats-bar {
      background: rgba(14, 27, 46, 0.9);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .replay-card {
      background: rgba(14, 27, 46, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
      transition: all 0.2s ease;
    }
    .replay-card:hover {
      border-color: var(--accent);
      box-shadow: 0 8px 26px rgba(0, 0, 0, 0.55), 0 0 16px rgba(45, 212, 191, 0.2);
      transform: translateY(-2px);
    }
    .replay-card.pinned {
      border-color: rgba(250, 204, 21, 0.7);
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.5), 0 0 18px rgba(250, 204, 21, 0.22);
    }
    .pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }
    .pill-win {
      background: rgba(45, 212, 191, 0.18);
      color: #2dd4bf;
      border: 1px solid rgba(45, 212, 191, 0.4);
    }
    .pill-loss {
      background: rgba(244, 63, 94, 0.18);
      color: #fda4af;
      border: 1px solid rgba(244, 63, 94, 0.4);
    }
    .pill-star {
      background: rgba(250, 204, 21, 0.16);
      color: #facc15;
      border: 1px solid rgba(250, 204, 21, 0.45);
      box-shadow: 0 0 10px rgba(250, 204, 21, 0.2);
    }
  </style>
</head>
<body>
  <!-- Fixed Centered Shiny Origin Dialga Vector Watermark -->
  <div class="fixed-watermark-bg" aria-hidden="true">
    <svg viewBox="0 0 240 240" class="dialga-watermark-svg">
      <path fill="none" stroke="#2DD4BF" stroke-width="3" d="M120,10 L196,42 L228,120 L196,198 L120,230 L44,198 L12,120 L44,42 Z" />
      <path fill="none" stroke="#FACC15" stroke-width="4" d="M120,44 L178,76 L178,164 L120,196 L62,164 L62,76 Z" />
      <path fill="#FACC15" d="M62,76 L22,52 L48,92 Z M178,76 L218,52 L192,92 Z M56,120 L14,120 L56,132 Z M184,120 L226,120 L184,132 Z M62,164 L26,188 L54,148 Z M178,164 L214,188 L186,148 Z" />
      <path fill="#14B8A6" stroke="#67E8F9" stroke-width="2.5" d="M120,14 L138,48 L156,32 L144,76 L186,98 L152,134 L168,188 L142,174 L120,224 L98,174 L72,188 L88,134 L54,98 L96,76 L84,32 L102,48 Z" />
      <path fill="#081224" stroke="#FACC15" stroke-width="3" d="M120,84 L152,120 L120,156 L88,120 Z" />
      <path fill="#67E8F9" d="M120,96 L140,120 L120,144 L100,120 Z" />
    </svg>
  </div>
  <header>
    <div class="header-inner">
      <div class="brand">
        <a href="https://silphscopepvp.com" style="display:inline-flex;align-items:center;gap:12px;text-decoration:none;color:inherit" title="SilphScopePvP.com">
          <div class="dialga-crest-badge">
            <svg viewBox="0 0 36 36" style="width:28px;height:28px;display:block">
              <polygon points="18,2 31,9 31,27 18,34 5,27 5,9" fill="rgba(14, 27, 46, 0.9)" stroke="#2DD4BF" stroke-width="2.2" />
              <polygon points="18,7 26,12 26,24 18,29 10,24 10,12" fill="none" stroke="#FACC15" stroke-width="1.8" />
              <circle cx="18" cy="18" r="3.5" fill="#FACC15" />
            </svg>
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-weight:900;letter-spacing:-0.4px;font-size:17px;color:#fff">SilphScope <span style="color:#2dd4bf">DVR</span></span>
              <span style="font-size:10px;font-family:'JetBrains Mono',monospace;font-weight:800;text-transform:uppercase;color:#facc15;border:1px solid rgba(250,204,21,0.45);background:rgba(250,204,21,0.12);padding:2px 8px;border-radius:999px">v7.30</span>
            </div>
            <p style="margin:2px 0 0;font-size:11px;color:#99f6e4;font-weight:500">Cloud Replay Vault</p>
          </div>
        </a>
      </div>

      <!-- DVR Top Banner: ONLY links to Main Site, Download APK, Live View -->
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <a href="https://silphscopepvp.com/?view=home" class="btn-cta" style="background:#081120;border:1px solid #19304e;color:#99f6e4">🏠 Main Site</a>
        <a href="https://dl.silphscopepvp.com" class="btn-cta btn-cta-download">📱 Download APK</a>
        <a href="https://silphscopepvp.com/?view=live" class="btn-cta" style="background:#081120;border:1px solid rgba(6,182,212,0.4);color:#67e8f9">📡 Live View</a>
      </div>
    </div>
  </header>

  <div class="container" style="padding:14px 20px;gap:12px">
    <!-- Top Bar: Public Trainer Lookup + Owner Login Toggle -->
    <div class="login-card" style="justify-content:space-between;padding:12px 16px;gap:10px">
      <div style="display:flex;gap:8px;flex:1;flex-wrap:wrap;align-items:center">
        <span style="font-size:13px;font-weight:800;color:#ecfeff">👤 Trainer:</span>
        <input id="inp-user" type="text" placeholder="Enter Trainer ID (or Featured)" style="max-width:240px;padding:8px 12px;font-size:12px" onkeydown="if(event.key==='Enter')loadVault()" />
        <button class="primary" onclick="loadVault()" style="padding:8px 14px;font-size:12px">👁️ View</button>
        <button onclick="document.getElementById('inp-user').value='Featured';loadVault()" style="background:rgba(250,204,21,0.14);border-color:rgba(250,204,21,0.45);color:#fde047;padding:8px 12px;font-size:12px">🌟 @Featured</button>
        <button onclick="copyVaultShareUrl()" title="Copy link to this trainer's DVR page" style="padding:8px 12px;font-size:12px">🔗 Share</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center" id="auth-header-controls">
        <button id="btn-toggle-login" onclick="toggleLoginPanel()" style="border-color:#2dd4bf;color:#2dd4bf">🔐 Owner Login</button>
        <button id="btn-logout" onclick="logoutVault()" style="display:none;border-color:#f43f5e;color:#fb7185">🚪 Log Out</button>
      </div>
    </div>

    <!-- Collapsible Owner Login Card (2 Methods: Username/Token, Username/Password) -->
    <div class="login-card" id="owner-login-panel" style="display:none;flex-direction:column;align-items:stretch;gap:12px;border-color:var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="tab-btn active" id="tab-token" onclick="setAuthTab('token')">🔑 Username + Token</button>
          <button class="tab-btn" id="tab-password" onclick="setAuthTab('password')">🔒 Username + Password</button>
        </div>
        <span style="font-size:11.5px;color:#99f6e4">Log in as the vault owner to view unstarred rolling battles, ⭐ Star/Pin battles, or change visibility.</span>
      </div>

      <!-- Tab 1: Username + Token / Unlock Key -->
      <div id="pane-token" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="inp-key" type="password" placeholder="Unlock Key / Token (SSPVP-PRO-XXXX-XXXX)" />
        <input id="inp-email" type="email" placeholder="Or Checkout Email (optional claim)" style="max-width:230px" />
        <button class="primary" onclick="loginWithToken()">🔓 Sign In with Token</button>
      </div>

      <!-- Tab 2: Username + Password -->
      <div id="pane-password" style="display:none;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="inp-password" type="password" placeholder="Vault Password for this Trainer ID" onkeydown="if(event.key==='Enter')loginWithPassword()" />
        <button class="primary" onclick="loginWithPassword()">🔓 Sign In with Password</button>
        <span style="font-size:11px;color:#94a3b8;width:100%">Tip: First log in with your Unlock Key (or use the Android App Settings) to set your password.</span>
      </div>
    </div>

    <!-- Set / Change Password Modal Box (Owner Only) -->
    <div class="login-card" id="password-setup-box" style="display:none;border-color:#facc15;background:rgba(14,27,46,0.95);box-shadow:0 0 18px rgba(250,204,21,0.2)">
      <strong style="font-size:13px;color:#fde047">🔒 Set / Update Password for @<span id="pw-target-user"></span>:</strong>
      <input id="inp-new-password" type="password" placeholder="New Password (min 8 characters)" style="max-width:240px" />
      <button class="primary" onclick="saveNewPassword()">💾 Save Password</button>
      <button onclick="document.getElementById('password-setup-box').style.display='none'">Cancel</button>
    </div>

    <div class="stats-bar" id="stats-bar" style="display:none"></div>
    <div id="filter-bar" style="display:none;gap:8px;align-items:center;flex-wrap:wrap"></div>
    <div class="grid" id="replays-grid"></div>
  </div>

  <script>
    const CLIENT_KEY = 'ssk_client_v615_telemetry_ingest_9f8a7b6c5d4e3f2a1b0c';
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
    function escJsArg(s) {
      return esc(String(s == null ? '' : s).replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'"));
    }

    function readSharedCookie(name) {
      try {
        const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
        return m && m[1] ? decodeURIComponent(m[1]).trim() : '';
      } catch (_) { return ''; }
    }
    function writeSharedCookies(user, sess) {
      try {
        const dom = window.location.hostname.endsWith('silphscopepvp.com') ? '; domain=.silphscopepvp.com' : '';
        const sec = window.location.protocol === 'https:' ? '; Secure' : '';
        if (user && user.toLowerCase() !== 'featured') {
          document.cookie = 'sspvp_vault_user=' + encodeURIComponent(user) + '; path=/; max-age=31536000; SameSite=Lax' + dom + sec;
        }
        if (sess) {
          document.cookie = 'sspvp_vault_session=' + encodeURIComponent(sess) + '; path=/; max-age=31536000; SameSite=Lax' + dom + sec;
        }
      } catch (_) {}
    }
    function clearSharedCookies() {
      try {
        const dom = window.location.hostname.endsWith('silphscopepvp.com') ? '; domain=.silphscopepvp.com' : '';
        const sec = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = 'sspvp_vault_user=; path=/; max-age=0; SameSite=Lax' + dom + sec;
        document.cookie = 'sspvp_vault_session=; path=/; max-age=0; SameSite=Lax' + dom + sec;
        document.cookie = 'sspvp_vault_user=; path=/; max-age=0; SameSite=Lax' + sec;
        document.cookie = 'sspvp_vault_session=; path=/; max-age=0; SameSite=Lax' + sec;
      } catch (_) {}
    }
    function userFromSession(tok) {
      try {
        if (!tok) return '';
        const pts = String(tok).trim().split('.');
        if ((pts.length === 4 || pts.length === 5) && pts[0] && (Number(pts[2]) || 0) > Date.now()) {
          if (pts[0].toLowerCase() !== 'featured' && pts[0].toLowerCase() !== 'anonymous') return pts[0];
        }
      } catch (_) {}
      return '';
    }

    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const pathUser = (pathParts[0] === 'u' || pathParts[0] === 'vault') && pathParts[1] ? decodeURIComponent(pathParts[1]) : '';
    let sessionToken = (localStorage.getItem('sspvp_vault_session') || readSharedCookie('sspvp_vault_session') || '').trim();
    if (sessionToken && !localStorage.getItem('sspvp_vault_session')) {
      try { localStorage.setItem('sspvp_vault_session', sessionToken); } catch (_) {}
    }
    const storedVaultUser = (localStorage.getItem('sspvp_vault_user') || '').trim();
    const storedWebUser = (localStorage.getItem('gbl_web_screen_name_v700') || '').trim();
    const cookieVaultUser = readSharedCookie('sspvp_vault_user');
    const sessionVaultUser = userFromSession(sessionToken);
    const loggedInUser = [storedVaultUser, storedWebUser, cookieVaultUser, sessionVaultUser].find(
      (u) => u && u.toLowerCase() !== 'featured'
    ) || '';
    if (loggedInUser) {
      try {
        localStorage.setItem('sspvp_vault_user', loggedInUser);
        localStorage.setItem('gbl_web_screen_name_v700', loggedInUser);
      } catch (_) {}
    }
    const savedUser = params.get('user') || pathUser || loggedInUser || '';
    const savedKey = params.get('key') || localStorage.getItem('sspvp_vault_key') || '';
    const savedEmail = params.get('email') || localStorage.getItem('sspvp_vault_email') || '';
    let currentVaultData = null;
    let currentFilter = 'all'; // 'all' | 'starred'

    // Clean up any legacy stored GitHub OAuth state from localStorage
    try {
      localStorage.removeItem('sspvp_github_token');
      localStorage.removeItem('sspvp_pending_gh_device');
    } catch (_) {}

    document.getElementById('inp-user').value = savedUser;
    document.getElementById('inp-key').value = savedKey;
    document.getElementById('inp-email').value = savedEmail;

    function toggleLoginPanel() {
      const el = document.getElementById('owner-login-panel');
      el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }

    function setAuthTab(tab) {
      ['token', 'password'].forEach(t => {
        document.getElementById('tab-' + t).classList.toggle('active', t === tab);
        document.getElementById('pane-' + t).style.display = t === tab ? 'flex' : 'none';
      });
    }

    function logoutVault() {
      sessionToken = '';
      localStorage.removeItem('sspvp_vault_session');
      localStorage.removeItem('sspvp_vault_user');
      localStorage.removeItem('sspvp_vault_key');
      localStorage.removeItem('sspvp_pending_gh_device');
      clearSharedCookies();
      document.getElementById('inp-user').value = 'Featured';
      document.getElementById('inp-key').value = '';
      document.getElementById('inp-password').value = '';
      document.getElementById('btn-logout').style.display = 'none';
      loadVault();
    }

    function copyVaultShareUrl() {
      const user = document.getElementById('inp-user').value.trim();
      if (!user) return alert('Enter a Trainer ID first.');
      const shareUrl = window.location.origin + '/vault?user=' + encodeURIComponent(user);
      navigator.clipboard.writeText(shareUrl);
      alert('Copied Vault Page URL: ' + shareUrl);
    }

    async function loginWithToken() {
      const user = document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      if (!user) return alert('Enter your Trainer ID first.');
      if (!key && !email) return alert('Enter your Unlock Key (or Checkout Email).');
      await performOwnerLogin({ screenName: user, unlockKey: key, claimEmail: email });
    }

    async function loginWithPassword() {
      const user = document.getElementById('inp-user').value.trim();
      const password = document.getElementById('inp-password').value.trim();
      if (!user) return alert('Enter your Trainer ID first.');
      if (!password) return alert('Enter your Password.');
      await performOwnerLogin({ screenName: user, password });
    }

    async function performOwnerLogin(payload) {
      try {
        const res = await fetch('/v1/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': payload.screenName || 'sportsfan986'
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(data.error || 'Authentication failed.');
          return;
        }
        sessionToken = data.sessionToken || '';
        if (sessionToken) localStorage.setItem('sspvp_vault_session', sessionToken);
        if (data.screenName) {
          document.getElementById('inp-user').value = data.screenName;
          localStorage.setItem('sspvp_vault_user', data.screenName);
          localStorage.setItem('gbl_web_screen_name_v700', data.screenName);
          writeSharedCookies(data.screenName, sessionToken);
        }
        if (payload.unlockKey) localStorage.setItem('sspvp_vault_key', payload.unlockKey);
        if (payload.claimEmail) localStorage.setItem('sspvp_vault_email', payload.claimEmail);
        document.getElementById('owner-login-panel').style.display = 'none';
        await loadVault();
      } catch (e) {
        alert('Login error: ' + e.message);
      }
    }

    function openPasswordSetup() {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      document.getElementById('pw-target-user').textContent = user;
      document.getElementById('inp-new-password').value = '';
      document.getElementById('password-setup-box').style.display = 'flex';
    }

    async function saveNewPassword() {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const newPassword = document.getElementById('inp-new-password').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      if (!newPassword || newPassword.length < 8) {
        return alert('Password must be at least 8 characters.');
      }
      try {
        const res = await fetch('/v1/auth/set-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-Vault-Session': sessionToken,
            'X-SilphScope-Unlock-Key': key
          },
          body: JSON.stringify({ screenName: user, newPassword, sessionToken, unlockKey: key })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to save password.');
        }
        if (data.sessionToken) {
          sessionToken = data.sessionToken;
          localStorage.setItem('sspvp_vault_session', sessionToken);
        }
        document.getElementById('password-setup-box').style.display = 'none';
        alert('✅ Password saved for @' + user + '! You can now log in anytime with Username + Password.');
        loadVault();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function updateVaultVisibility(newVis) {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      try {
        const res = await fetch('/v1/replays/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-Vault-Session': sessionToken,
            'X-SilphScope-Unlock-Key': key
          },
          body: JSON.stringify({ publicVisibility: newVis, sessionToken, unlockKey: key })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to update visibility.');
        }
        loadVault();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function loadVault() {
      const user = document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      if (!user) {
        document.getElementById('replays-grid').innerHTML =
          '<div style="color:#99f6e4;padding:28px 20px;grid-column:1/-1;text-align:center;background:rgba(14,27,46,0.85);backdrop-filter:blur(10px);border:1px solid #19304e;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4)">' +
            '<div style="font-size:16px;font-weight:800;color:#ecfeff;margin-bottom:8px">🔍 Enter a Trainer ID above to view their Public DVR Replay Vault</div>' +
            '<div style="font-size:13px;color:#99f6e4">Starred replays are viewable by anyone by default, or click <strong style="color:#2dd4bf">🔐 Owner Login</strong> to sign in with your Unlock Key or Password.</div>' +
          '</div>';
        return;
      }
      if (key) localStorage.setItem('sspvp_vault_key', key);
      if (email) localStorage.setItem('sspvp_vault_email', email);

      const grid = document.getElementById('replays-grid');
      grid.innerHTML = '<div style="color:#99f6e4;padding:20px;font-weight:700">Loading Cloud Replay Vault for @' + esc(user) + '...</div>';

      try {
        const res = await fetch('/v1/replays/list?user=' + encodeURIComponent(user), {
          headers: {
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key,
            'X-Vault-Session': sessionToken,
            'X-Claim-Email': email
          }
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          document.getElementById('stats-bar').style.display = 'none';
          document.getElementById('filter-bar').style.display = 'none';
          document.getElementById('owner-login-panel').style.display = 'flex';
          grid.innerHTML = '<div style="color:#fda4af;padding:20px;grid-column:1/-1;background:rgba(14,27,46,0.85);border:1px solid rgba(244,63,94,0.45);border-radius:12px">' + esc(data.error || 'Failed to load vault') + '</div>';
          return;
        }

        currentVaultData = data;
        if (data.sessionToken) {
          sessionToken = data.sessionToken;
          localStorage.setItem('sspvp_vault_session', sessionToken);
        }

        const isOwner = Boolean(data.isOwner);
        if (isOwner && data.screenName && data.screenName.toLowerCase() !== 'featured') {
          localStorage.setItem('sspvp_vault_user', data.screenName);
          localStorage.setItem('gbl_web_screen_name_v700', data.screenName);
          writeSharedCookies(data.screenName, sessionToken);
        }
        document.getElementById('btn-logout').style.display = isOwner ? 'inline-flex' : 'none';
        document.getElementById('btn-toggle-login').textContent = isOwner ? '⚙️ Account / Login' : '🔐 Owner Login';

        const sb = document.getElementById('stats-bar');
        sb.style.display = 'flex';
        const lim = data.limits || {};
        const usg = data.usage || {};
        const vis = (data.settings && data.settings.publicVisibility) || data.visibility || 'public_only';

        if (isOwner) {
          const pwBtn = '<button onclick="openPasswordSetup()" style="padding:4px 9px;font-size:11.5px">' + (data.hasPassword ? '🔒 Change Password' : '🔒 Set Password') + '</button>';

          sb.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
              '<div><strong>👤 @' + esc(data.screenName) + ' (Owner)</strong> • <span style="color:#2dd4bf;font-weight:800">' + esc(lim.label || (data.tier || 'FREE').toUpperCase()) + '</span></div>' +
              '<div style="color:#ecfeff">☁️ Storage: <strong style="color:#2dd4bf">' + esc(usg.usedMb || 0) + ' MB</strong> / ' + esc(lim.maxStorageMb || 0) + ' MB • Rolling: <strong style="color:#2dd4bf">' + esc(usg.rollingCount || 0) + '/' + esc(lim.maxRollingBattles || 0) + '</strong> • ⭐ Starred: <strong style="color:#fde047">' + esc(usg.pinnedCount || 0) + '/' + esc(lim.maxPinnedBattles || 0) + '</strong> • 🌐 Public: <strong style="color:#67e8f9">' + esc(usg.publicCount || 0) + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:10px;border-top:1px solid #19304e">' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                '<span style="font-size:12px;color:#99f6e4;font-weight:700">🌐 Public Vault Visibility:</span>' +
                '<select onchange="updateVaultVisibility(this.value)" style="min-width:265px;padding:6px 10px;font-size:12px">' +
                  '<option value="public_only"' + (vis === 'public_only' ? ' selected' : '') + '>🔒 Private (Only shows ones manually made public)</option>' +
                  '<option value="starred_only"' + (vis === 'starred_only' ? ' selected' : '') + '>⭐ Starred only</option>' +
                  '<option value="starred_and_public"' + (vis === 'starred_and_public' || vis === 'starred_and_private' ? ' selected' : '') + '>⭐+🌐 Starred + Private (Starred or manually made public)</option>' +
                  '<option value="all"' + (vis === 'all' ? ' selected' : '') + '>🌐 All videos shared (Overrides per-video private)</option>' +
                  '<option value="none"' + (vis === 'none' || vis === 'private' ? ' selected' : '') + '>🚫 No videos shared without login</option>' +
                '</select>' +
                '<span style="font-size:11px;color:#94a3b8">(All videos default to 🔒 Private unless toggled 🌐 Public or overridden)</span>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + pwBtn + '</div>' +
            '</div>';
        } else {
          const visLabel =
            vis === 'all'
              ? '🌐 Public Vault (All Videos Shared)'
              : vis === 'starred_only'
              ? '⭐ Public Vault (Starred Only)'
              : vis === 'starred_and_public'
              ? '⭐+🌐 Public Vault (Starred + Public Videos)'
              : '🔒 Public Vault (Manually Shared Public Videos Only)';
          const hiddenNote = (vis !== 'all' && data.hiddenRollingCount > 0)
            ? ' • <span style="color:#94a3b8">' + esc(data.hiddenRollingCount) + ' private battle(s) hidden (Owner-only)</span>'
            : '';
          sb.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
              '<div><strong>👤 @' + esc(data.screenName) + '</strong> • <span style="color:#fde047;font-weight:800">' + visLabel + '</span>' + hiddenNote + '</div>' +
              '<button onclick="toggleLoginPanel()" style="padding:6px 12px;font-size:12px;border-color:#2dd4bf;color:#2dd4bf">🔐 Are you @' + esc(data.screenName) + '? Log In to Manage & Star</button>' +
            '</div>';
        }

        renderReplayGrid();
      } catch (e) {
        grid.innerHTML = '<div style="color:#fda4af;padding:20px;background:rgba(14,27,46,0.85);border:1px solid rgba(244,63,94,0.45);border-radius:12px">Error: ' + esc(e.message) + '</div>';
      }
    }

    function setFilter(f) {
      currentFilter = f;
      renderReplayGrid();
    }

    function renderReplayGrid() {
      const grid = document.getElementById('replays-grid');
      const filterBar = document.getElementById('filter-bar');
      if (!currentVaultData) return;

      const isOwner = Boolean(currentVaultData.isOwner);
      const vis = (currentVaultData.settings && currentVaultData.settings.publicVisibility) || currentVaultData.visibility || 'public_only';
      const allItems = currentVaultData.items || [];
      const starredItems = allItems.filter(i => i.isPinned);
      const publicItems = allItems.filter(i => i.isPublic);
      const privateItems = allItems.filter(i => !i.isPublic);

      if (isOwner) {
        filterBar.style.display = 'flex';
        filterBar.innerHTML =
          '<button class="tab-btn ' + (currentFilter === 'all' ? 'active' : '') + '" onclick="setFilter(\\'all\\')">🎬 All Replays (' + allItems.length + ')</button>' +
          '<button class="tab-btn ' + (currentFilter === 'starred' ? 'active' : '') + '" onclick="setFilter(\\'starred\\')">⭐ Starred (' + starredItems.length + ')</button>' +
          '<button class="tab-btn ' + (currentFilter === 'public' ? 'active' : '') + '" onclick="setFilter(\\'public\\')">🌐 Public (' + publicItems.length + ')</button>' +
          '<button class="tab-btn ' + (currentFilter === 'private' ? 'active' : '') + '" onclick="setFilter(\\'private\\')">🔒 Private (' + privateItems.length + ')</button>';
      } else if (vis === 'all' || vis === 'starred_and_public') {
        filterBar.style.display = 'flex';
        filterBar.innerHTML =
          '<button class="tab-btn ' + (currentFilter === 'all' ? 'active' : '') + '" onclick="setFilter(\\'all\\')">🎬 All Shared (' + allItems.length + ')</button>' +
          '<button class="tab-btn ' + (currentFilter === 'starred' ? 'active' : '') + '" onclick="setFilter(\\'starred\\')">⭐ Starred (' + starredItems.length + ')</button>' +
          '<button class="tab-btn ' + (currentFilter === 'public' ? 'active' : '') + '" onclick="setFilter(\\'public\\')">🌐 Public (' + publicItems.length + ')</button>';
      } else {
        filterBar.style.display = 'none';
      }

      let items = allItems;
      if (currentFilter === 'starred') {
        items = starredItems;
      } else if (currentFilter === 'public') {
        items = publicItems;
      } else if (currentFilter === 'private' && isOwner) {
        items = privateItems;
      }

      if (!items.length) {
        const emptyMsg = !isOwner
          ? 'No public replays published by @' + esc(currentVaultData.screenName) + ' under their current visibility filter. If this is your vault, click 🔐 Owner Login above to view all private battles and toggle 🌐 Public or ⭐ Star!'
          : 'No replays found in this filter view.';
        grid.innerHTML = '<div style="color:#99f6e4;padding:24px;grid-column:1/-1;background:rgba(14,27,46,0.85);border:1px solid #19304e;border-radius:12px;text-align:center">' + emptyMsg + '</div>';
        return;
      }

      grid.innerHTML = items.map(item => {
        const isWin = String(item.result || '').toUpperCase().includes('WIN');
        const mb = ((item.totalBytes || item.videoBytes || 0) / (1024 * 1024)).toFixed(1);
        const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
        const isPub = Boolean(item.isPublic);
        const isOverriddenPublic = !isPub && vis === 'all';
        const safeBattleIdJs = escJsArg(item.battleId);
        const safeShareIdJs = escJsArg(item.shareId);
        const safeShareUrl = esc(item.shareUrl || ('/watch/' + encodeURIComponent(item.shareId || '')));
        const safeShareUrlJs = escJsArg(item.shareUrl || ('/watch/' + encodeURIComponent(item.shareId || '')));
        const highlightSecNum = Number(item.highlightSec) || 0;
        const starControl = isOwner
          ? '<button onclick="togglePin(\\'' + safeBattleIdJs + '\\', ' + (!item.isPinned) + ')" style="padding:7px 10px;font-size:12px;border-color:' + (item.isPinned ? '#facc15' : '#19304e') + ';color:' + (item.isPinned ? '#fde047' : '#ecfeff') + ';background:' + (item.isPinned ? 'rgba(250,204,21,0.18)' : '#081120') + ';box-shadow:' + (item.isPinned ? '0 0 10px rgba(250,204,21,0.2)' : 'none') + '" title="Starred replays are kept for 365 days">' + (item.isPinned ? '⭐ Starred' : '☆ Star') + '</button>'
          : '<button disabled style="padding:7px 10px;font-size:12px;opacity:0.85;cursor:default;border-color:' + (item.isPinned ? '#facc15' : '#19304e') + ';color:' + (item.isPinned ? '#fde047' : '#94a3b8') + ';background:' + (item.isPinned ? 'rgba(250,204,21,0.18)' : '#081120') + '">' + (item.isPinned ? '⭐ Starred' : '☆ Star') + '</button>';
        const pubControl = isOwner
          ? '<button onclick="toggleVideoPublic(\\'' + safeBattleIdJs + '\\', ' + (!isPub) + ')" style="padding:7px 10px;font-size:12px;border-color:' + (isPub ? '#67e8f9' : '#19304e') + ';color:' + (isPub ? '#67e8f9' : '#94a3b8') + ';background:' + (isPub ? 'rgba(103,232,249,0.14)' : '#081120') + '" title="' + (isOverriddenPublic ? 'Per-video setting is Private (currently overridden because Vault Visibility is set to All Videos Shared)' : 'Toggle whether this video is Public or Private (Default: Private)') + '">' + (isPub ? '🌐 Public' : (isOverriddenPublic ? '🔒 Private (All)' : '🔒 Private')) + '</button>'
          : '<button disabled style="padding:7px 10px;font-size:12px;opacity:0.85;cursor:default;border-color:' + (isPub || isOverriddenPublic ? '#67e8f9' : '#19304e') + ';color:' + (isPub || isOverriddenPublic ? '#67e8f9' : '#94a3b8') + ';background:' + (isPub || isOverriddenPublic ? 'rgba(103,232,249,0.14)' : '#081120') + '">' + (isPub ? '🌐 Public' : (isOverriddenPublic ? '🌐 Shared (All)' : '🔒 Private')) + '</button>';
        const isAdminOwner = isOwner && String(currentVaultData.screenName || '').toLowerCase() === 'sportsfan986';
        const featControl = isAdminOwner
          ? '<button onclick="promoteToFeatured(\\'' + safeShareIdJs + '\\')" style="padding:7px 10px;font-size:12px;border-color:' + (item.featuredShareId ? '#facc15' : '#2dd4bf') + ';color:' + (item.featuredShareId ? '#fde047' : '#2dd4bf') + ';background:' + (item.featuredShareId ? 'rgba(250,204,21,0.18)' : 'rgba(45,212,191,0.14)') + '" title="Clone this battle into persistent @Featured Official Showcase storage">' + (item.featuredShareId ? '🌟 Featured (' + esc(item.featuredShareId) + ')' : '🌟 Promote to Featured') + '</button>'
          : '';
        const isItemFlagged = Boolean(item.manuallyFlagged || item.userIssueNote);
        const safeIssueNoteJs = escJsArg(item.userIssueNote || '');
        const safeLeagueJs = escJsArg(item.league || 'GBL');
        const safeMatchupJs = escJsArg(item.matchupSummary || '');
        const issueBannerHtml = isItemFlagged
          ? '<div style="background:rgba(250,204,21,0.14);border:1px solid rgba(250,204,21,0.45);border-radius:8px;padding:6px 9px;font-size:11.5px;color:#fef3c7;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<span>🚩 <strong>Reported Issue:</strong> ' + esc(item.userIssueNote || 'Flagged for diagnostic review') + '</span>' +
              '<button onclick="unflagVaultReplay(\\'' + safeBattleIdJs + '\\', \\'' + safeShareIdJs + '\\')" style="padding:3px 7px;font-size:11px;background:#081120;border-color:#64748b;color:#e2e8f0" title="Retract this issue report">↩️ Unflag</button>' +
            '</div>'
          : '';
        const flagControls =
          '<button onclick="flagVaultReplay(\\'' + safeBattleIdJs + '\\', \\'' + safeShareIdJs + '\\', \\'' + safeIssueNoteJs + '\\', \\'' + safeLeagueJs + '\\', \\'' + safeMatchupJs + '\\')" style="padding:7px 10px;font-size:12px;border-color:' + (isItemFlagged ? '#facc15' : '#b91c1c') + ';color:' + (isItemFlagged ? '#fde047' : '#fca5a5') + ';background:' + (isItemFlagged ? 'rgba(250,204,21,0.14)' : 'rgba(185,28,28,0.16)') + '" title="Flag an issue on this replay or edit existing issue note">' + (isItemFlagged ? '🚩 Flagged ✓' : '🚩 Flag Issue') + '</button>' +
          (isItemFlagged
            ? '<button onclick="unflagVaultReplay(\\'' + safeBattleIdJs + '\\', \\'' + safeShareIdJs + '\\')" style="padding:7px 10px;font-size:12px;border-color:#64748b;color:#e2e8f0;background:#081120" title="Unflag and retract this issue report">↩️ Unflag Issue</button>'
            : '');
        return '<div class="replay-card ' + (item.isPinned ? 'pinned' : '') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
            '<span class="pill ' + (isWin ? 'pill-win' : 'pill-loss') + '">' + esc(item.result || 'BATTLE') + ' • ' + esc(item.league || 'GBL') + '</span>' +
            '<span style="font-size:11px;color:#99f6e4">' + esc(mb) + ' MB • ' + esc(Number(item.durationSec) || 0) + 's</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:14px;color:#ecfeff">' + esc(item.showcaseTitle || item.matchupSummary || item.battleId) + '</div>' +
          '<div style="font-size:11px;color:#94a3b8">' + esc(dateStr) + ' • ID: ' + esc(item.battleId) + (highlightSecNum ? ' • <span style="color:#fde047">⚡ Highlight @ ' + highlightSecNum + 's</span>' : '') + '</div>' +
          issueBannerHtml +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center">' +
            '<button class="primary" style="padding:7px 11px;font-size:12px;flex:1;justify-content:center" onclick="openFullScreenReplay(\'' + safeShareIdJs + '\', 0)">▶️ Watch + HUD</button>' +
            (highlightSecNum ? '<button style="background:rgba(250,204,21,0.16);border-color:#facc15;color:#fde047;padding:7px 10px;font-size:12px" onclick="openFullScreenReplay(\'' + safeShareIdJs + '\', ' + highlightSecNum + ')" title="Jump directly to the key highlight moment">⚡ Key Moment (' + highlightSecNum + 's)</button>' : '') +
            starControl +
            pubControl +
            featControl +
            '<button onclick="shareReplayLink(\\'' + safeShareUrlJs + '\\', \\'' + safeMatchupJs + '\\')" style="padding:7px 10px;font-size:12px;background:#081120;border-color:#2dd4bf;color:#99f6e4" title="Share or copy direct replay link">📤 Share</button>' +
            '<button onclick="copyLink(\\'' + safeShareUrlJs + '\\')" style="padding:7px 10px;font-size:12px;background:#081120;border-color:#19304e;color:#ecfeff" title="Anyone with this direct link can watch this replay">📋 Copy Link</button>' +
            flagControls +
            (isOwner ? '<button onclick="deleteVaultReplay(\\'' + safeBattleIdJs + '\\', \\'' + safeShareIdJs + '\\')" style="padding:7px 10px;font-size:12px;background:rgba(190,18,60,0.16);border-color:#f43f5e;color:#fda4af" title="Permanently delete this replay from your Cloud DVR Vault">🗑️ Delete</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function promoteToFeatured(shareId) {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const highlightStr = prompt('Optional highlight timestamp in seconds (e.g. 118 for T+118s, or leave blank for 0):', '0');
      if (highlightStr === null) return;
      const badgeLabel = prompt('Showcase badge label:', '🌟 Official Showcase') || '🌟 Official Showcase';
      try {
        const res = await fetch('/v1/replays/feature', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key,
            'X-Vault-Session': sessionToken
          },
          body: JSON.stringify({
            shareId,
            highlightSec: Number(highlightStr) || 0,
            badgeLabel,
            unlockKey: key,
            sessionToken
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to promote replay to @Featured.');
        }
        alert('🌟 Cloned to @Featured Official Showcase!\\nURL: ' + data.shareUrl);
        loadVault();
      } catch (e) {
        alert('Error: ' + e.message);
      }
    }

    async function togglePin(battleId, nextPinned) {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      const res = await fetch('/v1/replays/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_KEY,
          'X-Trainer-Screen-Name': user,
          'X-SilphScope-Unlock-Key': key,
          'X-Vault-Session': sessionToken,
          'X-Claim-Email': email
        },
        body: JSON.stringify({ battleId, isPinned: nextPinned, unlockKey: key, sessionToken, claimEmail: email })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return alert(data.error || 'Only the vault owner can star/unstar replays.');
      }
      loadVault();
    }

    async function toggleVideoPublic(battleId, nextPublic) {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      const res = await fetch('/v1/replays/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SilphScope-Client-Key': CLIENT_KEY,
          'X-Trainer-Screen-Name': user,
          'X-SilphScope-Unlock-Key': key,
          'X-Vault-Session': sessionToken,
          'X-Claim-Email': email
        },
        body: JSON.stringify({ battleId, isPublic: nextPublic, unlockKey: key, sessionToken, claimEmail: email })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return alert(data.error || 'Only the vault owner can change video public/private status.');
      }
      loadVault();
    }

    function copyLink(url) {
      const fullUrl = url.startsWith('http') ? url : (window.location.origin + url);
      navigator.clipboard.writeText(fullUrl);
      alert('Copied Direct Share URL (viewable by anyone with the link): ' + fullUrl);
    }

    function shareReplayLink(url, matchupTitle) {
      const fullUrl = url.startsWith('http') ? url : (window.location.origin + url);
      const title = 'SilphScope DVR • ' + (matchupTitle || 'Battle Replay');
      if (navigator.share) {
        navigator.share({ title, text: title, url: fullUrl }).catch(() => {});
        return;
      }
      copyLink(fullUrl);
    }

    async function deleteVaultReplay(battleId, shareId) {
      if (!confirm('🗑️ Permanently delete this replay from your Cloud DVR Vault? This cannot be undone.')) return;
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      try {
        const res = await fetch('/v1/replays/delete?battleId=' + encodeURIComponent(battleId || '') + '&shareId=' + encodeURIComponent(shareId || ''), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key,
            'X-Vault-Session': sessionToken,
            'X-Claim-Email': email
          },
          body: JSON.stringify({
            battleId,
            shareId,
            unlockKey: key,
            sessionToken,
            claimEmail: email
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to delete replay.');
        }
        loadVault();
      } catch (e) {
        alert('Error deleting replay: ' + e.message);
      }
    }

    async function flagVaultReplay(battleId, shareId, existingNote, league, matchupSummary) {
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      const note = prompt(
        '🚩 Flag / Update Issue Report for Battle ' + battleId + ':\\nDescribe what went wrong (e.g. HP jump, wrong move count, OCR misread):',
        existingNote || ''
      );
      if (note === null) return;
      const cleanNote = note.trim();
      if (!cleanNote) {
        if (existingNote && confirm('You left the description blank. Would you like to unflag & retract this issue report instead?')) {
          return unflagVaultReplay(battleId, shareId);
        }
        return alert('Please enter a brief description of the issue to flag this replay.');
      }
      try {
        let devId = '';
        try { devId = localStorage.getItem('silphscope_device_id') || 'web_vault_client'; } catch (_) {}
        const res = await fetch('/v1/dvr/flag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key,
            'X-Vault-Session': sessionToken,
            'X-Claim-Email': email,
            'X-Device-Hash': devId
          },
          body: JSON.stringify({
            battleId,
            shareId,
            screenName: user,
            userIssueNote: cleanNote,
            league: league || 'GBL',
            matchupSummary: matchupSummary || '',
            unlockKey: key,
            sessionToken,
            claimEmail: email,
            deviceHash: devId
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to flag replay issue.');
        }
        loadVault();
      } catch (e) {
        alert('Error flagging issue: ' + e.message);
      }
    }

    async function unflagVaultReplay(battleId, shareId) {
      if (!confirm('Unflag and retract this issue report for Battle ' + battleId + '?')) return;
      const user = (currentVaultData && currentVaultData.screenName) || document.getElementById('inp-user').value.trim();
      const key = document.getElementById('inp-key').value.trim();
      const email = document.getElementById('inp-email').value.trim();
      try {
        let devId = '';
        try { devId = localStorage.getItem('silphscope_device_id') || 'web_vault_client'; } catch (_) {}
        const res = await fetch('/v1/dvr/unflag', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SilphScope-Client-Key': CLIENT_KEY,
            'X-Trainer-Screen-Name': user,
            'X-SilphScope-Unlock-Key': key,
            'X-Vault-Session': sessionToken,
            'X-Claim-Email': email,
            'X-Device-Hash': devId
          },
          body: JSON.stringify({
            battleId,
            shareId,
            screenName: user,
            unlockKey: key,
            sessionToken,
            claimEmail: email,
            deviceHash: devId
          })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          return alert(data.error || 'Failed to unflag replay issue.');
        }
        loadVault();
      } catch (e) {
        alert('Error unflagging issue: ' + e.message);
      }
    }

    function openFullScreenReplay(shareId, startSec) {
      if (!shareId) return;
      let modal = document.getElementById('vault-fs-replay-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'vault-fs-replay-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#02060d;display:flex;flex-direction:column;overflow:hidden;';
        modal.innerHTML =
          '<button type="button" onclick="closeFullScreenReplay()" title="Close Replay" aria-label="Close Replay" style="position:fixed;top:max(10px,env(safe-area-inset-top,10px));right:12px;z-index:10001;width:36px;height:36px;border-radius:12px;background:rgba(8,17,32,0.9);border:1.5px solid #2dd4bf;color:#99f6e4;font-size:15px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.85),0 0 14px rgba(45,212,191,0.35)">✕</button>' +
          '<iframe id="vault-fs-replay-iframe" style="width:100%;height:100%;flex:1;border:none;display:block;background:#000" allow="fullscreen"></iframe>';
        document.body.appendChild(modal);
      }
      const iframe = document.getElementById('vault-fs-replay-iframe');
      iframe.src = '/watch/' + encodeURIComponent(shareId) + '?embed=1' + (startSec > 0 ? '&t=' + Number(startSec) : '');
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
    function closeFullScreenReplay() {
      const modal = document.getElementById('vault-fs-replay-modal');
      const iframe = document.getElementById('vault-fs-replay-iframe');
      if (iframe) iframe.src = 'about:blank';
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    window.addEventListener('message', (ev) => {
      if (ev && ev.data && ev.data.type === 'SSPVP_CLOSE_REPLAY') closeFullScreenReplay();
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeFullScreenReplay();
    });

    if (savedUser) {
      document.getElementById('inp-user').value = savedUser;
      loadVault();
    } else {
      document.getElementById('inp-user').value = 'Featured';
      loadVault();
    }

    if (params.get('auth') === 'github' || params.get('login') === 'github') {
      toggleLoginPanel();
      setAuthTab('github');
      startGitHubDeviceLogin();
    } else {
      resumePendingGhPoll();
    }
  </script>
</body>
</html>`;
}

async function computeHmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(String(payload || '')));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyStripeWebhookSignature(request, rawBody, env) {
  const secret = (env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return {
      ok: false,
      error: 'STRIPE_WEBHOOK_SECRET is not configured on Worker.',
    };
  }
  const sigHeader = (request.headers.get('Stripe-Signature') || '').trim();
  if (!sigHeader) {
    return { ok: false, error: 'Missing Stripe-Signature header.' };
  }
  const parts = sigHeader.split(',').map((p) => p.trim());
  let timestamp = '';
  const v1Sigs = [];
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const k = part.slice(0, eqIdx).trim();
    const v = part.slice(eqIdx + 1).trim();
    if (k === 't') timestamp = v;
    if (k === 'v1' && v) v1Sigs.push(v.toLowerCase());
  }
  const tsNum = Number(timestamp);
  if (!timestamp || !Number.isFinite(tsNum) || v1Sigs.length === 0) {
    return { ok: false, error: 'Malformed Stripe-Signature header.' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > 300) {
    return { ok: false, error: 'Stripe webhook timestamp outside 300s tolerance window.' };
  }
  const expectedSig = await computeHmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  const matched = v1Sigs.some((candidate) => timingSafeEqualStr(candidate, expectedSig));
  if (!matched) {
    return { ok: false, error: 'Invalid Stripe webhook HMAC signature.' };
  }
  return { ok: true };
}

async function verifyBmcWebhookSignature(request, rawBody, env) {
  const secret = (env.BMC_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return {
      ok: false,
      error: 'BMC_WEBHOOK_SECRET is not configured on Worker.',
    };
  }
  const sigHeader = (
    request.headers.get('x-signature-sha256') ||
    request.headers.get('x-bmc-signature') ||
    ''
  )
    .trim()
    .toLowerCase();
  if (!sigHeader) {
    return { ok: false, error: 'Missing Buy Me a Coffee x-signature-sha256 header.' };
  }
  const expectedSig = await computeHmacSha256Hex(secret, rawBody);
  if (!timingSafeEqualStr(sigHeader, expectedSig)) {
    return { ok: false, error: 'Invalid Buy Me a Coffee webhook HMAC signature.' };
  }
  return { ok: true };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enforce HTTPS redirect on all official silphscopepvp.com domains
    if (
      url.protocol === 'http:' &&
      (url.hostname === 'silphscopepvp.com' || url.hostname.endsWith('.silphscopepvp.com'))
    ) {
      return new Response(null, {
        status: 301,
        headers: buildSecurityHeaders({
          Location: `https://${url.host}${url.pathname}${url.search}`,
        }),
      });
    }

    if (request.method === 'OPTIONS') {
      const isPublicStreamOrAsset =
        path.startsWith('/v1/replays/stream/') ||
        path === '/v1/replays/featured' ||
        path === '/overlay.html';
      return new Response(null, {
        status: 204,
        headers: buildSecurityHeaders({
          'Access-Control-Allow-Origin': resolveAllowedCorsOrigin(request, !isPublicStreamOrAsset),
          Vary: 'Origin',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-SilphScope-Client-Key, X-Trainer-Screen-Name, X-SilphScope-Unlock-Key, X-Vault-Session, X-Vault-Password, X-GitHub-Token, X-Device-Hash, X-Device-Ingest-Token, X-Claim-Email, X-GitHub-Username, X-GitHub-User-Id, Range',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
        }),
      });
    }

    const store = getStorageAdapter(env);

    // 0a. Instant 1-Click APK Download Subdomain (`dl.silphscopepvp.com` or `/download` / `/apk`)
    const isGetOrHead = request.method === 'GET' || request.method === 'HEAD';

    // 0a-pwa. Instant PWA Manifest, Service Worker & App Icons (SilphScope DVR)
    if (isGetOrHead && (path === '/manifest.json' || path === '/manifest.webmanifest')) {
      const manifestObj = {
        name: 'SilphScope DVR',
        short_name: 'SilphScope DVR',
        description: 'Frame-Synced Cloud DVR Replay Vault, 50% Translucent HUD & Live View Secondary Screen for Pokémon GO PvP.',
        start_url: '/?view=vault',
        scope: '/',
        display: 'standalone',
        background_color: '#050B16',
        theme_color: '#050B16',
        orientation: 'any',
        categories: ['games', 'utilities', 'entertainment'],
        icons: [
          { src: '/pwa-icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/pwa-icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: '108x108', type: 'image/svg+xml', purpose: 'any' }
        ],
        shortcuts: [
          { name: 'Cloud DVR Vault', short_name: 'DVR Vault', description: 'Watch battle recordings with frame-accurate 50% HUD overlay', url: '/?view=vault', icons: [{ src: '/pwa-icon-192.svg', sizes: '192x192' }] },
          { name: 'Live View (Coming Soon)', short_name: 'Live View', description: 'Upcoming: Stream live combat telemetry to your tablet or iPhone', url: '/?view=live', icons: [{ src: '/pwa-icon-192.svg', sizes: '192x192' }] },
          { name: 'Web Battle Simulator', short_name: 'Simulator', description: '3v3 Pokémon GO PvP Battle Simulator & Team Builder', url: '/?view=app', icons: [{ src: '/pwa-icon-192.svg', sizes: '192x192' }] }
        ]
      };
      return new Response(JSON.stringify(manifestObj, null, 2), {
        status: 200,
        headers: buildSecurityHeaders({
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        }),
      });
    }

    if (isGetOrHead && path === '/sw.js') {
      const swCode = `// SilphScope DVR PWA Service Worker (v7.34)
const CACHE_NAME = 'silphscope-dvr-pwa-v735';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/manifest.webmanifest', '/favicon.svg', '/pwa-icon-192.svg', '/pwa-icon-512.svg', '/overlay.html'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.startsWith('/v1/') || u.pathname.startsWith('/api') || u.hostname.includes('stripe.com') || u.hostname.includes('buymeacoffee.com') || e.request.headers.has('range') || e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((res) => { if (res && res.status === 200) { const cl = res.clone(); caches.open(CACHE_NAME).then((c) => c.put('/index.html', cl)).catch(() => {}); } return res; }).catch(() => caches.match('/index.html') || caches.match('/'))); return; }
  e.respondWith(fetch(e.request).then((res) => { if (res && res.status === 200 && res.type === 'basic') { const cl = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(e.request, cl)).catch(() => {}); } return res; }).catch(() => caches.match(e.request)));
});`;
      return new Response(swCode, {
        status: 200,
        headers: buildSecurityHeaders({
          'Content-Type': 'application/javascript; charset=utf-8',
          'Service-Worker-Allowed': '/',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }),
      });
    }

    if (isGetOrHead && (path === '/pwa-icon-192.svg' || path === '/pwa-icon-512.svg')) {
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">
  <defs>
    <radialGradient id="dialgaBgGlow" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#19304E" />
      <stop offset="65%" stop-color="#0E1B2E" />
      <stop offset="100%" stop-color="#050B16" />
    </radialGradient>
    <filter id="dialgaTealGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="192" height="192" rx="42" fill="url(#dialgaBgGlow)" />
  <rect width="190" height="190" x="1" y="1" rx="41" fill="none" stroke="#2DD4BF" stroke-width="2" stroke-opacity="0.35" />
  <g transform="translate(96, 96) scale(4.4) translate(-18, -18)" filter="url(#dialgaTealGlow)">
    <polygon points="18,2 31,9 31,27 18,34 5,27 5,9" fill="rgba(14, 27, 46, 0.95)" stroke="#2DD4BF" stroke-width="2.2" stroke-linejoin="round" />
    <polygon points="18,7 26,12 26,24 18,29 10,24 10,12" fill="none" stroke="#FACC15" stroke-width="1.8" stroke-linejoin="round" />
    <circle cx="18" cy="18" r="3.5" fill="#FACC15" />
    <circle cx="18" cy="18" r="1.8" fill="#FFFBEB" />
  </g>
</svg>`;
      return new Response(svgIcon, {
        status: 200,
        headers: buildSecurityHeaders({
          'Content-Type': 'image/svg+xml',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        }),
      });
    }
    if (
      isGetOrHead &&
      (url.hostname === 'dl.silphscopepvp.com' || path === '/download' || path === '/apk')
    ) {
      let apkUrl = 'https://github.com/sportsfan986/silphscope-pvp/releases/latest';
      try {
        const ghRes = await fetch(
          'https://api.github.com/repos/sportsfan986/silphscope-pvp/releases/latest',
          {
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'SilphScope-PvP-Download-Redirect/7.13',
            },
            cf: { cacheTtl: 300, cacheEverything: true },
          }
        );
        if (ghRes.ok) {
          const release = await ghRes.json();
          const apkAsset = (release.assets || []).find(
            (a) => a && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk')
          );
          if (apkAsset && apkAsset.browser_download_url) {
            apkUrl = apkAsset.browser_download_url;
          } else if (release.html_url) {
            apkUrl = release.html_url;
          }
        }
      } catch (_) {}
      return new Response(null, {
        status: 302,
        headers: buildSecurityHeaders({
          Location: apkUrl,
          'Cache-Control': 'public, max-age=300',
        }),
      });
    }

    // 0. Public Cloud DVR Replay Vault Web Portal (`GET /` on dvr.*, or `GET /vault`, `GET /vault/:user`, `GET /u/:user`)
    const isMainMarketingHost =
      url.hostname === 'silphscopepvp.com' || url.hostname === 'www.silphscopepvp.com';
    if (
      isGetOrHead &&
      ((!isMainMarketingHost && path === '/') ||
        path === '/vault' ||
        path === '/replays' ||
        path.startsWith('/vault/') ||
        path.startsWith('/u/'))
    ) {
      return new Response(request.method === 'HEAD' ? null : renderVaultDashboardPage(url.origin), {
        status: 200,
        headers: buildSecurityHeaders(
          {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
          true
        ),
      });
    }

    // 0a-2. Marketing Website & Web Simulator Edge Proxy on `silphscopepvp.com` / `www.silphscopepvp.com`
    if (
      isGetOrHead &&
      isMainMarketingHost &&
      !path.startsWith('/v1/') &&
      !path.startsWith('/watch/') &&
      path !== '/overlay.html' &&
      path !== '/health'
    ) {
      const cleanRelPath = path.replace(/^\/silphscope-pvp(\/|$)/, '/');
      const isHtmlRoute =
        cleanRelPath === '/' ||
        cleanRelPath === '/index.html' ||
        cleanRelPath === '/guide' ||
        cleanRelPath === '/compare' ||
        cleanRelPath === '/app' ||
        cleanRelPath.endsWith('.html');
      const targetGhUrl =
        cleanRelPath === '/' || cleanRelPath === '/guide' || cleanRelPath === '/compare' || cleanRelPath === '/app'
          ? 'https://sportsfan986.github.io/silphscope-pvp/index.html'
          : `https://sportsfan986.github.io/silphscope-pvp${cleanRelPath}`;
      const ghResp = await fetch(targetGhUrl, {
        headers: {
          'User-Agent': 'SilphScope-Edge-Proxy/7.13',
          Accept: request.headers.get('Accept') || '*/*',
        },
        cf: { cacheTtl: cleanRelPath.startsWith('/assets/') ? 86400 : 60, cacheEverything: true },
      });
      const respHeaders = new Headers(ghResp.headers);
      respHeaders.set('Access-Control-Allow-Origin', resolveAllowedCorsOrigin(request, true));
      respHeaders.set('Vary', 'Origin');
      const secHeaders = buildSecurityHeaders(
        isHtmlRoute ? { 'Cache-Control': 'no-cache, must-revalidate' } : {},
        isHtmlRoute
      );
      for (const [hk, hv] of Object.entries(secHeaders)) {
        respHeaders.set(hk, hv);
      }
      return new Response(request.method === 'HEAD' ? null : ghResp.body, {
        status: ghResp.status,
        headers: respHeaders,
      });
    }

    // 0b. Exact In-App HUD WebView Asset (`GET /overlay.html`)
    if (isGetOrHead && path === '/overlay.html') {
      return new Response(request.method === 'HEAD' ? null : OVERLAY_HTML, {
        status: 200,
        headers: buildSecurityHeaders(
          {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
          true
        ),
      });
    }

    // 1. Public Health Check (detailed metrics require ADMIN_API_KEY)
    if (request.method === 'GET' && path === '/v1/health') {
      const isAdmin = verifyAdminAuth(request, env).ok;
      if (!isAdmin) {
        return jsonResponse({
          ok: true,
          service: 'silphscope-telemetry-worker',
          version: env.WORKER_VERSION || '7.1.6',
          timestamp: new Date().toISOString(),
        });
      }
      const r2Stats = await getGlobalR2Stats(env.TELEMETRY_KV);
      const maxGb = Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0;
      return jsonResponse({
        ok: true,
        service: 'silphscope-telemetry-worker',
        version: env.WORKER_VERSION || '7.1.6',
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
      const auth = await verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'telemetry',
        `${getClientIp(request)}_${screenName}`,
        60,
        600
      );
      if (!rl.allowed) {
        return jsonResponse({ ok: false, error: 'Rate limit exceeded for telemetry ingest.' }, 429);
      }

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
      if (jsonlPayload.length > 16 * 1024 * 1024) {
        return jsonResponse({ ok: false, error: 'Telemetry batch exceeds 16 MiB limit.' }, 413);
      }

      const now = new Date();
      const dateFolder = now.toISOString().slice(0, 10);
      const batchId = sanitizeId(
        body.batchId || `${now.toISOString().replace(/[:.]/g, '-')}_${screenName}`
      );
      const recordCount = Number(body.recordCount) || jsonlPayload.split('\n').filter(Boolean).length;
      const appVersion = String(body.appVersion || 'unknown').slice(0, 32);
      const versionCode = Number(body.versionCode) || 0;
      const deviceId = sanitizeId(body.deviceId || 'unknown');

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
        })()
      );

      let dailyTuningConfig = null;
      if (env.TELEMETRY_KV) {
        try {
          const rawCfg = await env.TELEMETRY_KV.get('daily_tuning_config/latest');
          if (rawCfg) {
            dailyTuningConfig = JSON.parse(rawCfg);
          }
        } catch (_) {}
      }

      return jsonResponse({
        ok: true,
        screenName,
        batchId,
        key: batchKey,
        recordCount,
        dailyTuningConfig,
      });
    }

    // 2b. Public / Client Daily Tuning & Post-Battle Survey Question Pool (`GET /v1/tuning-config`)
    if (request.method === 'GET' && path === '/v1/tuning-config') {
      let cfg = null;
      if (env.TELEMETRY_KV) {
        try {
          const raw = await env.TELEMETRY_KV.get('daily_tuning_config/latest');
          if (raw) cfg = JSON.parse(raw);
        } catch (_) {}
      }
      if (!cfg) {
        cfg = {
          updatedAt: new Date().toISOString(),
          targetVersion: '7.23',
          tunedSettings: {
            proactiveEnergyLeadMs: 300,
            predictiveGuiHapticLeadMs: 300,
            hpDebounceSamples: 2,
            hpDebounceTolerancePct: 1,
            energyDebounceSamples: 2,
          },
          questions: [
            {
              id: 'shield_energy',
              priority: 100,
              trigger: 'hp_promoted_shield_call',
              prompt: '🛡️ HP Shield Call Energy:',
              shortLabel: 'Shield Energy',
              options: [
                { val: 'UNDERCOUNTED', label: '⬇️ Under' },
                { val: 'ACCURATE', label: '✅ Spot-On' },
                { val: 'OVERCOUNTED', label: '⬆️ Over' },
              ],
            },
            {
              id: 'mml_hp_tracking_v708',
              priority: 95,
              trigger: 'master_league',
              prompt: '🦖 Master League HP Bars (v7.08 Fix):',
              shortLabel: 'MML HP Fix',
              options: [
                { val: 'MISSED_BARS', label: '⚠️ Missed' },
                { val: 'LOCKED_CLEAN', label: '✅ Locked' },
                { val: 'FLICKERED', label: '🔄 Flicker' },
              ],
            },
            {
              id: 'pre_zoom_energy_v720',
              priority: 90,
              trigger: 'charged_move_thrown',
              prompt: '⚡ Pre-Throw Energy Sync (v7.20 Fix):',
              shortLabel: 'Throw Energy',
              options: [
                { val: 'UNDER_BY_1F', label: '⬇️ -1 Fast' },
                { val: 'EXACT_MATCH', label: '✅ Exact' },
                { val: 'OVER_BY_1F', label: '⬆️ +1 Fast' },
              ],
            },
            {
              id: 'haptic_timing',
              priority: 50,
              trigger: 'always',
              prompt: '📳 Haptic Timing ({leadMs}ms):',
              shortLabel: 'Haptic Lead',
              options: [
                { val: 'TOO_EARLY', label: '⏪ Early' },
                { val: 'IDEAL', label: '✅ Ideal' },
                { val: 'TOO_LATE', label: '⏩ Late' },
              ],
            },
          ],
        };
      }
      return jsonResponse({ ok: true, ...cfg }, 200, request, true);
    }

    // 3. Settings Change History Ingest (`POST /v1/settings-changes`)
    if (request.method === 'POST' && path === '/v1/settings-changes') {
      const auth = await verifyClientAuth(request, env);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
      const { screenName } = auth;

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'settings_changes',
        `${getClientIp(request)}_${screenName}`,
        30,
        600
      );
      if (!rl.allowed) {
        return jsonResponse({ ok: false, error: 'Rate limit exceeded.' }, 429);
      }

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
      if (jsonlPayload.length > 4 * 1024 * 1024) {
        return jsonResponse({ ok: false, error: 'Settings payload exceeds 4 MiB limit.' }, 413);
      }

      const now = new Date();
      const key = `users/${screenName}/settings_changes/${now.toISOString().replace(/[:.]/g, '-')}.jsonl`;
      await store.put(key, jsonlPayload + '\n', {
        contentType: 'application/x-ndjson',
        metadata: {
          screenName,
          appVersion: String(body.appVersion || 'unknown').slice(0, 32),
          uploadedAt: now.toISOString(),
        },
      });

      return jsonResponse({ ok: true, screenName, key });
    }

    // 4. 1-Battle DVR Bundle Ingest (`POST /v1/dvr`)
    if (request.method === 'POST' && path === '/v1/dvr') {
      try {
        const auth = await verifyClientAuth(request, env);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
        const { screenName } = auth;

        const rl = await checkAndIncrementRateLimit(
          env.TELEMETRY_KV,
          'dvr_ingest',
          `${getClientIp(request)}_${screenName}`,
          20,
          600
        );
        if (!rl.allowed) {
          return jsonResponse({ ok: false, error: 'Rate limit exceeded for DVR upload.' }, 429);
        }

        const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
        const MAX_TRACE_BYTES = 24 * 1024 * 1024;

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
            if (typeof videoFile.size === 'number' && videoFile.size > MAX_VIDEO_BYTES) {
              return jsonResponse({ ok: false, error: 'DVR video exceeds 64 MiB limit.' }, 413);
            }
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
            if (body.videoBase64.length > Math.ceil(MAX_VIDEO_BYTES * 1.38)) {
              return jsonResponse({ ok: false, error: 'DVR video payload exceeds 64 MiB limit.' }, 413);
            }
            const binaryStr = atob(body.videoBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            videoBytes = bytes;
          }
        }

        if (videoBytes && videoBytes.byteLength > MAX_VIDEO_BYTES) {
          return jsonResponse({ ok: false, error: 'DVR video exceeds 64 MiB limit.' }, 413);
        }
        if (deepTraceText && deepTraceText.length > MAX_TRACE_BYTES) {
          return jsonResponse({ ok: false, error: 'DVR trace exceeds 24 MiB limit.' }, 413);
        }

        const hasVideo = Boolean(videoBytes && videoBytes.byteLength > 0);
        const hasTrace = Boolean(deepTraceText && deepTraceText.trim().length > 0);
        if (!hasVideo && !hasTrace) {
          return jsonResponse({ ok: false, error: 'Missing DVR video and trace payload.' }, 400);
        }
        if (hasVideo && !isValidMp4Bytes(videoBytes)) {
          return jsonResponse({ ok: false, error: 'Invalid MP4 container header.' }, 400);
        }

        const now = new Date();
        const rawBattleId = sanitizeId(
          metadata.battleId || `dvr_${now.getTime()}`,
          `dvr_${now.getTime()}`
        );
        const appVersion = String(metadata.appVersion || 'unknown').slice(0, 32);
        const versionCode = Number(metadata.versionCode) || 0;
        const league = String(metadata.league || 'Unknown League').slice(0, 64);
        const result = String(metadata.result || 'UNKNOWN').slice(0, 32);
        const matchupSummary = String(resolveFullTeamMatchupSummary(metadata, deepTraceText) || '').slice(0, 180);
        const frameCount = Math.max(0, Math.min(20000, Number(metadata.frameCount) || 0));

        // Verify whether the uploader owns this screenName before allowing overwrite of any existing replay
        const ownerAuth = await authenticateVaultOwner(
          request,
          env,
          env.TELEMETRY_KV,
          screenName,
          metadata
        );
        const indexObj = env.TELEMETRY_KV
          ? await loadUserReplayIndex(env.TELEMETRY_KV, screenName)
          : { items: [] };
        const existingItem = (indexObj.items || []).find((i) => i.battleId === rawBattleId);
        const canUpdateExisting = Boolean(existingItem && ownerAuth.isOwner);
        const battleId =
          existingItem && !canUpdateExisting
            ? `${rawBattleId}_${randomCharsFromAlphabet(4, 'abcdefghjkmnpqrstuvwxyz23456789')}`
            : rawBattleId;

        const videoKey = `recordings/${screenName}/${battleId}_video.mp4`;
        const traceKey = `recordings/${screenName}/${battleId}_deep_trace.jsonl`;
        const videoByteLen = hasVideo ? videoBytes.byteLength : 0;
        const isManual = isManuallyFlaggedBattle(metadata, deepTraceText);
        const userIssueNoteClean = extractUserIssueDescription(metadata, deepTraceText);
        const uploadReasonClean = String(metadata.uploadReason || '').trim().slice(0, 120);
        const tierSummary = await resolveUserPaidTierSummary(env.TELEMETRY_KV, screenName);
        const resolvedUserTier = tierSummary.tier;

        const storeMeta = {
          screenName,
          battleId,
          appVersion,
          versionCode: String(versionCode),
          league,
          result,
          frameCount: String(frameCount),
          uploadedAt: now.toISOString(),
          manuallyFlagged: String(isManual && userIssueNoteClean.length > 0),
          userIssueNote: userIssueNoteClean,
          uploadReason: uploadReasonClean,
          userTier: resolvedUserTier,
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

        // Only send diagnostic videos to the Telegram chat when explicitly flagged by the user WITH an issue description
        const isFlaggedWithIssueDescription = isManual && userIssueNoteClean.length > 0;
        let diagShareId = '';
        let diagWatchOverlayUrl = '';

        // Automatically mirror DVR uploads into the Cloud R2 Replay Vault (`replays/<screenName>/...` + `replay_index/<screenName>`)
        // for active Legend Pro / VIP users (especially when queued DVR bundles are retried via `/v1/dvr`).
        const isProOrVipUploader =
          (resolvedUserTier === 'pro' || resolvedUserTier === 'vip') &&
          Boolean(ownerAuth.isOwner || screenName);
        if (hasVideo && env.TELEMETRY_KV && (isFlaggedWithIssueDescription || (isProOrVipUploader && env.REPLAY_BUCKET))) {
          try {
            diagShareId =
              canUpdateExisting && existingItem && existingItem.shareId
                ? existingItem.shareId
                : existingItem && existingItem.shareId
                  ? existingItem.shareId
                  : generateShareId();
            diagWatchOverlayUrl = `${url.origin}/watch/${diagShareId}`;

            let r2VideoKey = videoKey;
            let r2TraceKey = hasTrace ? traceKey : null;
            if (env.REPLAY_BUCKET) {
              const r2Prefix =
                ownerAuth.isOwner || isProOrVipUploader
                  ? `replays/${screenName}`
                  : `recordings/${screenName}`;
              r2VideoKey = `${r2Prefix}/${battleId}_video.mp4`;
              await env.REPLAY_BUCKET.put(r2VideoKey, videoBytes, {
                httpMetadata: { contentType: 'video/mp4' },
                customMetadata: { screenName, battleId, shareId: diagShareId },
              });
              if (hasTrace) {
                r2TraceKey = `${r2Prefix}/${battleId}_deep_trace.jsonl`;
                await env.REPLAY_BUCKET.put(r2TraceKey, deepTraceText.trim() + '\n', {
                  httpMetadata: { contentType: 'application/x-ndjson' },
                  customMetadata: { screenName, battleId, shareId: diagShareId },
                });
              }
            }

            const traceByteLen = hasTrace ? new TextEncoder().encode(deepTraceText).byteLength : 0;
            const diagShareRecord = {
              battleId,
              shareId: diagShareId,
              screenName,
              videoKey: r2VideoKey,
              fallbackKvVideoKey: videoKey,
              traceKey: r2TraceKey,
              fallbackKvTraceKey: hasTrace ? traceKey : null,
              videoBytes: videoByteLen,
              traceBytes: traceByteLen,
              totalBytes: videoByteLen + traceByteLen,
              league,
              result,
              matchupSummary,
              frameCount,
              durationSec: Math.max(1, Math.round(frameCount / 10)),
              appVersion,
              userIssueNote: userIssueNoteClean,
              userTier: resolvedUserTier,
              userTierBadge: tierSummary.badge,
              isPinned: Boolean(existingItem && existingItem.isPinned),
              isPublic: Boolean(existingItem && existingItem.isPublic),
              hideNames: Boolean(existingItem && existingItem.hideNames),
              createdAt:
                existingItem && existingItem.createdAt
                  ? existingItem.createdAt
                  : now.toISOString(),
              uploadedAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
            await env.TELEMETRY_KV.put(`share_lookup/${diagShareId}`, JSON.stringify(diagShareRecord));

            if (isProOrVipUploader && env.REPLAY_BUCKET && !existingItem) {
              indexObj.items = [
                diagShareRecord,
                ...(indexObj.items || []).filter((i) => i.battleId !== battleId),
              ];
              const licInfoForQuota = ownerAuth.licenseInfo || {
                ...TIER_PRESETS[resolvedUserTier],
                tier: resolvedUserTier,
                active: true,
              };
              await enforceUserReplayQuota(
                env,
                env.TELEMETRY_KV,
                screenName,
                licInfoForQuota,
                indexObj
              );
              await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);
            }
          } catch (e) {
            console.error('Diag/Vault share link creation error:', e);
          }
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
                u.tier = resolvedUserTier;
                m.users[screenName] = u;

                if (!Array.isArray(m.recentDvr)) m.recentDvr = [];
                const existingIdx = m.recentDvr.findIndex(
                  (d) => d && d.battleId === battleId && d.screenName === screenName
                );
                const dvrEntry = {
                  battleId,
                  screenName,
                  userTier: resolvedUserTier,
                  shareId: diagShareId || (existingIdx >= 0 ? m.recentDvr[existingIdx].shareId || '' : ''),
                  watchUrl: diagWatchOverlayUrl || (existingIdx >= 0 ? m.recentDvr[existingIdx].watchUrl || '' : ''),
                  videoKey: hasVideo ? videoKey : (existingIdx >= 0 ? m.recentDvr[existingIdx].videoKey : null),
                  traceKey: hasTrace ? traceKey : (existingIdx >= 0 ? m.recentDvr[existingIdx].traceKey : null),
                  videoBytes: videoByteLen || (existingIdx >= 0 ? m.recentDvr[existingIdx].videoBytes : 0),
                  frameCount: frameCount || (existingIdx >= 0 ? m.recentDvr[existingIdx].frameCount : 0),
                  appVersion,
                  versionCode,
                  league,
                  result,
                  matchupSummary,
                  uploadedAt: now.toISOString(),
                  manuallyFlagged: isFlaggedWithIssueDescription || (existingIdx >= 0 && Boolean(m.recentDvr[existingIdx].manuallyFlagged)),
                  userIssueNote: userIssueNoteClean || (existingIdx >= 0 ? m.recentDvr[existingIdx].userIssueNote || '' : ''),
                  uploadReason: uploadReasonClean || (existingIdx >= 0 ? m.recentDvr[existingIdx].uploadReason || '' : ''),
                };
                if (existingIdx >= 0) {
                  m.recentDvr.splice(existingIdx, 1);
                }
                m.recentDvr.unshift(dvrEntry);
                if (m.recentDvr.length > 250) m.recentDvr.length = 250;
              });
            } catch (e) {
              console.error('Manifest update error:', e);
            }

            // Strictly only send to Telegram diagnostic chat when user-flagged WITH an issue description
            const shouldSendTelegramVideo =
              isFlaggedWithIssueDescription && hasVideo && videoByteLen <= 48 * 1024 * 1024;

            if (shouldSendTelegramVideo) {
              try {
                const caption =
                  `🚩 <b>SilphScope Flagged Diagnostic DVR</b>\n` +
                  `👤 <b>Trainer:</b> <code>@${escapeHtml(screenName)}</code>\n` +
                  `💳 <b>Paid Tier:</b> <b>${escapeHtml(tierSummary.badge)}</b>\n` +
                  `📝 <b>Issue Description:</b> <b>${escapeHtml(userIssueNoteClean)}</b>\n` +
                  (diagWatchOverlayUrl
                    ? `▶️ <b>Watch Video + HUD Overlay:</b>\n${escapeHtml(diagWatchOverlayUrl)}\n`
                    : '') +
                  `🏆 <b>League:</b> ${escapeHtml(league)} (${escapeHtml(result)})\n` +
                  (matchupSummary ? `⚔️ <b>Matchup:</b> ${escapeHtml(matchupSummary)}\n` : '') +
                  `🎞️ <b>Frames:</b> ${frameCount} | <b>Size:</b> ${(videoByteLen / (1024 * 1024)).toFixed(2)} MB\n` +
                  `📱 <b>App:</b> <code>v${escapeHtml(appVersion)} (${versionCode})</code>\n` +
                  `🆔 <code>${escapeHtml(battleId)}</code>`;

                await sendTelegramVideo(env, videoBytes, `${screenName}_${battleId}.mp4`, caption);
              } catch (e) {
                console.error('Telegram video send error:', e);
              }
            } else if (hasVideo) {
              console.log(
                `Skipping Telegram video for battle ${battleId}: requires user flag + issue description (isManual=${isManual}, noteLen=${userIssueNoteClean.length}).`
              );
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
          manuallyFlagged: isManual,
        });
      } catch (err) {
        console.error('POST /v1/dvr error:', err);
        return jsonResponse(
          {
            ok: false,
            error: 'Internal server error processing DVR bundle.',
          },
          500
        );
      }
    }

    // 4a-bis. Flag or Update an Issue Report on an Existing DVR / Battle (`POST /v1/dvr/flag`)
    if (request.method === 'POST' && path === '/v1/dvr/flag') {
      const auth = await verifyClientAuth(request, env, true, true);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      const rawTargetId = sanitizeId(body.battleId || '', '');
      const rawShareId = sanitizeId(body.shareId || '', '');
      if (!rawTargetId && !rawShareId) {
        return jsonResponse({ ok: false, error: 'Missing battleId or shareId' }, 400, request, true);
      }

      const cleanIssueNote = String(body.userIssueNote || body.issueNote || '')
        .trim()
        .slice(0, 600);
      if (!cleanIssueNote) {
        return jsonResponse({ ok: false, error: 'Please provide a brief issue description (userIssueNote).' }, 400, request, true);
      }

      let lookupItem = null;
      if (rawShareId && env.TELEMETRY_KV) {
        try {
          const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${rawShareId}`, { type: 'text' });
          if (rawLookup) lookupItem = JSON.parse(rawLookup);
        } catch (_) {}
      }

      let screenName = sanitizeScreenName(
        body.screenName ||
          auth.screenName ||
          (lookupItem && lookupItem.screenName) ||
          ''
      );
      if (!screenName) {
        return jsonResponse({ ok: false, error: 'Valid screenName is required.' }, 400, request, true);
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName,
        body
      );
      const hasDevTokenOrHash = Boolean(
        auth.isValidDeviceToken ||
          (body.deviceHash && String(body.deviceHash).length >= 8) ||
          (body.deviceId && String(body.deviceId).length >= 8) ||
          (request.headers.get('X-Device-Hash') && request.headers.get('X-Device-Hash').trim().length >= 8)
      );
      if (!ownerAuth.isOwner && !hasDevTokenOrHash && !verifyAdminAuth(request, env).ok) {
        return jsonResponse(
          {
            ok: false,
            error: 'Sign in to your Replay Vault (or flag from your SilphScope app/web session) to report an issue on this battle.',
          },
          403,
          request,
          true
        );
      }

      if (ownerAuth.screenName) {
        screenName = ownerAuth.screenName;
      }

      const battleId = rawTargetId || (lookupItem && lookupItem.battleId) || `web_${Date.now()}`;
      const league = String(body.league || (lookupItem && lookupItem.league) || 'GBL').slice(0, 48);
      const result = String(body.result || (lookupItem && lookupItem.result) || '').slice(0, 16);
      const matchupSummary = String(body.matchupSummary || (lookupItem && lookupItem.matchupSummary) || '').slice(0, 140);
      const nowIso = new Date().toISOString();

      try {
        const applyFlagToTraceText = (txt) => {
          if (!txt || typeof txt !== 'string') return txt;
          const nlIdx = txt.indexOf('\n');
          const firstLine = (nlIdx >= 0 ? txt.slice(0, nlIdx) : txt).trim();
          if (!firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) return txt;
          try {
            const headerObj = JSON.parse(firstLine);
            headerObj.manuallyFlagged = true;
            headerObj.wasExplicitlyFlagged = true;
            headerObj.userIssueNote = cleanIssueNote;
            headerObj.uploadReason = 'Manual Web/App Issue Report';
            if (!headerObj.battleSummary || typeof headerObj.battleSummary !== 'object') {
              headerObj.battleSummary = {};
            }
            const bs = headerObj.battleSummary;
            if (!Array.isArray(bs.anomalies)) bs.anomalies = [];
            bs.anomalies = bs.anomalies.filter(
              (a) => a && a.type !== 'USER_MANUAL_ISSUE_REPORT' && a.code !== 'USER_MANUAL_ISSUE_REPORT'
            );
            bs.anomalies.unshift({
              type: 'USER_MANUAL_ISSUE_REPORT',
              code: 'USER_MANUAL_ISSUE_REPORT',
              severity: 'HIGH',
              detail: `User reported issue: ${cleanIssueNote}`,
              userIssueNote: cleanIssueNote,
            });
            bs.anomalyCount = bs.anomalies.length;
            bs.hasHighSeverityAnomaly = true;
            const rest = nlIdx >= 0 ? txt.slice(nlIdx) : '\n';
            return JSON.stringify(headerObj) + rest;
          } catch (_) {
            return txt;
          }
        };

        let updatedTrace = false;
        if (battleId) {
          const traceKey = `recordings/${screenName}/${battleId}_deep_trace.jsonl`;
          const existingTrace = await store.getText(traceKey);
          if (existingTrace !== null) {
            const flaggedTrace = applyFlagToTraceText(existingTrace);
            await store.put(traceKey, flaggedTrace, {
              contentType: 'application/x-ndjson',
              metadata: {
                screenName,
                battleId,
                manuallyFlagged: 'true',
                userIssueNote: cleanIssueNote,
                uploadReason: 'Manual Web/App Issue Report',
                uploadedAt: nowIso,
              },
            });
            updatedTrace = true;
          } else {
            // Create a synthetic summary header trace if none existed yet (e.g. web-only battle log flag)
            const synthHeader = {
              recordType: 'BATTLE_DVR_SUMMARY_HEADER',
              battleId,
              screenName,
              league,
              result,
              matchupSummary,
              manuallyFlagged: true,
              wasExplicitlyFlagged: true,
              userIssueNote: cleanIssueNote,
              uploadReason: 'Manual Web/App Issue Report',
              uploadedAt: nowIso,
              battleSummary: {
                anomalyCount: 1,
                hasHighSeverityAnomaly: true,
                anomalies: [
                  {
                    type: 'USER_MANUAL_ISSUE_REPORT',
                    code: 'USER_MANUAL_ISSUE_REPORT',
                    severity: 'HIGH',
                    detail: `User reported issue: ${cleanIssueNote}`,
                    userIssueNote: cleanIssueNote,
                  },
                ],
              },
            };
            await store.put(traceKey, JSON.stringify(synthHeader) + '\n', {
              contentType: 'application/x-ndjson',
              metadata: {
                screenName,
                battleId,
                manuallyFlagged: 'true',
                userIssueNote: cleanIssueNote,
                uploadReason: 'Manual Web/App Issue Report',
                uploadedAt: nowIso,
              },
            });
            updatedTrace = true;
          }

          if (env.REPLAY_BUCKET) {
            for (const r2Key of [
              `replays/${screenName}/${battleId}_deep_trace.jsonl`,
              `recordings/${screenName}/${battleId}_deep_trace.jsonl`,
            ]) {
              try {
                const r2Obj = await env.REPLAY_BUCKET.get(r2Key);
                if (r2Obj) {
                  const r2Txt = await r2Obj.text();
                  const flaggedR2 = applyFlagToTraceText(r2Txt);
                  await env.REPLAY_BUCKET.put(r2Key, flaggedR2, {
                    httpMetadata: { contentType: 'application/x-ndjson' },
                    customMetadata: {
                      ...(r2Obj.customMetadata || {}),
                      screenName,
                      battleId,
                      manuallyFlagged: 'true',
                      userIssueNote: cleanIssueNote,
                    },
                  });
                }
              } catch (_) {}
            }
          }
        }

        let resolvedShareId = rawShareId || (lookupItem && lookupItem.shareId) || '';
        if (env.TELEMETRY_KV) {
          const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);
          let indexChanged = false;
          for (const it of indexObj.items || []) {
            if ((battleId && it.battleId === battleId) || (rawShareId && it.shareId === rawShareId)) {
              it.userIssueNote = cleanIssueNote;
              it.manuallyFlagged = true;
              it.updatedAt = nowIso;
              if (!resolvedShareId && it.shareId) resolvedShareId = it.shareId;
              indexChanged = true;
            }
          }
          if (indexChanged) {
            await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);
          }
          if (resolvedShareId) {
            try {
              const rawShare = await env.TELEMETRY_KV.get(`share_lookup/${resolvedShareId}`, { type: 'text' });
              if (rawShare) {
                const shareObj = JSON.parse(rawShare);
                shareObj.userIssueNote = cleanIssueNote;
                shareObj.manuallyFlagged = true;
                shareObj.updatedAt = nowIso;
                await env.TELEMETRY_KV.put(`share_lookup/${resolvedShareId}`, JSON.stringify(shareObj));
              }
            } catch (_) {}
          }
        }

        const watchUrl = resolvedShareId ? `https://dvr.silphscopepvp.com/watch/${resolvedShareId}` : '';
        ctx.waitUntil(
          (async () => {
            try {
              await updateManifest(store, (m) => {
                if (!Array.isArray(m.recentDvr)) m.recentDvr = [];
                let found = false;
                for (const d of m.recentDvr) {
                  if (
                    d &&
                    ((battleId && d.battleId === battleId && d.screenName === screenName) ||
                      (resolvedShareId && d.shareId === resolvedShareId))
                  ) {
                    d.manuallyFlagged = true;
                    d.userIssueNote = cleanIssueNote;
                    d.uploadReason = 'Manual Web/App Issue Report';
                    found = true;
                  }
                }
                if (!found) {
                  m.recentDvr.unshift({
                    battleId,
                    screenName,
                    shareId: resolvedShareId,
                    watchUrl,
                    traceKey: `recordings/${screenName}/${battleId}_deep_trace.jsonl`,
                    league,
                    result,
                    matchupSummary,
                    uploadedAt: nowIso,
                    manuallyFlagged: true,
                    userIssueNote: cleanIssueNote,
                    uploadReason: 'Manual Web/App Issue Report',
                  });
                  if (m.recentDvr.length > 250) m.recentDvr.length = 250;
                }
              });
            } catch (e) {
              console.error('Manifest flag update error:', e);
            }
            try {
              await sendTelegramMessage(
                env,
                `🚩 <b>SilphScope Issue Report Flagged (Web/Vault)</b>\n` +
                  `👤 <b>Trainer:</b> <code>@${escapeHtml(screenName)}</code>\n` +
                  `📝 <b>Issue Description:</b> <b>${escapeHtml(cleanIssueNote)}</b>\n` +
                  (watchUrl ? `▶️ <b>Watch Video + HUD Overlay:</b>\n${escapeHtml(watchUrl)}\n` : '') +
                  (league ? `🏆 <b>League:</b> ${escapeHtml(league)} ${result ? `(${escapeHtml(result)})` : ''}\n` : '') +
                  (matchupSummary ? `⚔️ <b>Matchup:</b> ${escapeHtml(matchupSummary)}\n` : '') +
                  `🆔 <b>Battle:</b> <code>${escapeHtml(battleId)}</code>`
              );
            } catch (_) {}
          })()
        );

        return jsonResponse(
          {
            ok: true,
            flagged: true,
            screenName,
            battleId,
            shareId: resolvedShareId,
            userIssueNote: cleanIssueNote,
            updatedTrace,
          },
          200,
          request,
          true
        );
      } catch (err) {
        console.error('POST /v1/dvr/flag error:', err);
        return jsonResponse(
          { ok: false, error: 'Failed to flag DVR issue report.' },
          500,
          request,
          true
        );
      }
    }

    // 4b. Unflag / Retract an Inadvertently Sent DVR Issue Report (`POST /v1/dvr/unflag`)
    if (request.method === 'POST' && path === '/v1/dvr/unflag') {
      const auth = await verifyClientAuth(request, env, true, true);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      const rawTargetId = sanitizeId(body.battleId || '', '');
      const rawShareId = sanitizeId(body.shareId || '', '');
      if (!rawTargetId && !rawShareId) {
        return jsonResponse({ ok: false, error: 'Missing battleId or shareId' }, 400, request, true);
      }

      let lookupItem = null;
      if (rawShareId && env.TELEMETRY_KV) {
        try {
          const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${rawShareId}`, { type: 'text' });
          if (rawLookup) lookupItem = JSON.parse(rawLookup);
        } catch (_) {}
      }

      let screenName = sanitizeScreenName(
        body.screenName ||
          auth.screenName ||
          (lookupItem && lookupItem.screenName) ||
          ''
      );
      if (!screenName) {
        return jsonResponse({ ok: false, error: 'Valid screenName is required.' }, 400, request, true);
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName,
        body
      );
      // Allow either verified vault owner OR the device that authenticated via X-SilphScope-Client-Key / X-Device-Ingest-Token
      const hasDevTokenOrHash = Boolean(
        auth.isValidDeviceToken ||
          (body.deviceHash && String(body.deviceHash).length >= 8) ||
          (body.deviceId && String(body.deviceId).length >= 8) ||
          (request.headers.get('X-Device-Hash') && request.headers.get('X-Device-Hash').trim().length >= 8)
      );
      if (!ownerAuth.isOwner && !hasDevTokenOrHash && !verifyAdminAuth(request, env).ok) {
        return jsonResponse(
          {
            ok: false,
            error: 'Sign in to your Replay Vault (or unflag from your SilphScope Android app) to retract this issue report.',
          },
          403,
          request,
          true
        );
      }

      if (ownerAuth.screenName) {
        screenName = ownerAuth.screenName;
      }

      const battleId = rawTargetId || (lookupItem && lookupItem.battleId) || '';
      const nowIso = new Date().toISOString();

      try {
        // Helper to strip manual flag & USER_MANUAL_ISSUE_REPORT anomaly from Line 0 of deep_trace.jsonl
        const stripFlagFromTraceText = (txt) => {
          if (!txt || typeof txt !== 'string') return txt;
          const nlIdx = txt.indexOf('\n');
          const firstLine = (nlIdx >= 0 ? txt.slice(0, nlIdx) : txt).trim();
          if (!firstLine.startsWith('{"recordType":"BATTLE_DVR_SUMMARY_HEADER"')) return txt;
          try {
            const headerObj = JSON.parse(firstLine);
            headerObj.manuallyFlagged = false;
            headerObj.wasExplicitlyFlagged = false;
            headerObj.userIssueNote = '';
            headerObj.uploadReason = 'Unflagged by User';
            if (headerObj.battleSummary && typeof headerObj.battleSummary === 'object') {
              const bs = headerObj.battleSummary;
              if (Array.isArray(bs.anomalies)) {
                bs.anomalies = bs.anomalies.filter(
                  (a) => a && a.type !== 'USER_MANUAL_ISSUE_REPORT' && a.code !== 'USER_MANUAL_ISSUE_REPORT'
                );
                bs.anomalyCount = bs.anomalies.length;
                bs.hasHighSeverityAnomaly = bs.anomalies.some((a) => a && a.severity === 'HIGH');
              }
            }
            const rest = nlIdx >= 0 ? txt.slice(nlIdx) : '\n';
            return JSON.stringify(headerObj) + rest;
          } catch (_) {
            return txt;
          }
        };

        let updatedTrace = false;
        if (battleId) {
          const traceKey = `recordings/${screenName}/${battleId}_deep_trace.jsonl`;
          const existingTrace = await store.getText(traceKey);
          if (existingTrace !== null) {
            const cleanedTrace = stripFlagFromTraceText(existingTrace);
            await store.put(traceKey, cleanedTrace, {
              contentType: 'application/x-ndjson',
              metadata: {
                screenName,
                battleId,
                manuallyFlagged: 'false',
                userIssueNote: '',
                uploadReason: 'Unflagged by User',
                uploadedAt: nowIso,
              },
            });
            updatedTrace = true;
          }

          if (env.REPLAY_BUCKET) {
            for (const r2Key of [
              `replays/${screenName}/${battleId}_deep_trace.jsonl`,
              `recordings/${screenName}/${battleId}_deep_trace.jsonl`,
            ]) {
              try {
                const r2Obj = await env.REPLAY_BUCKET.get(r2Key);
                if (r2Obj) {
                  const r2Txt = await r2Obj.text();
                  const cleanedR2 = stripFlagFromTraceText(r2Txt);
                  await env.REPLAY_BUCKET.put(r2Key, cleanedR2, {
                    httpMetadata: { contentType: 'application/x-ndjson' },
                    customMetadata: {
                      ...(r2Obj.customMetadata || {}),
                      screenName,
                      battleId,
                      manuallyFlagged: 'false',
                      userIssueNote: '',
                    },
                  });
                }
              } catch (_) {}
            }
          }
        }

        let resolvedShareId = rawShareId || (lookupItem && lookupItem.shareId) || '';
        if (env.TELEMETRY_KV) {
          const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, screenName);
          let indexChanged = false;
          for (const it of indexObj.items || []) {
            if ((battleId && it.battleId === battleId) || (rawShareId && it.shareId === rawShareId)) {
              it.userIssueNote = '';
              it.manuallyFlagged = false;
              it.updatedAt = nowIso;
              if (!resolvedShareId && it.shareId) resolvedShareId = it.shareId;
              indexChanged = true;
            }
          }
          if (indexChanged) {
            await saveUserReplayIndex(env.TELEMETRY_KV, screenName, indexObj);
          }
          if (resolvedShareId) {
            try {
              const rawShare = await env.TELEMETRY_KV.get(`share_lookup/${resolvedShareId}`, { type: 'text' });
              if (rawShare) {
                const shareObj = JSON.parse(rawShare);
                shareObj.userIssueNote = '';
                shareObj.manuallyFlagged = false;
                shareObj.updatedAt = nowIso;
                await env.TELEMETRY_KV.put(`share_lookup/${resolvedShareId}`, JSON.stringify(shareObj));
              }
            } catch (_) {}
          }
        }

        ctx.waitUntil(
          (async () => {
            try {
              await updateManifest(store, (m) => {
                if (!Array.isArray(m.recentDvr)) return;
                for (const d of m.recentDvr) {
                  if (
                    d &&
                    ((battleId && d.battleId === battleId && d.screenName === screenName) ||
                      (resolvedShareId && d.shareId === resolvedShareId))
                  ) {
                    d.manuallyFlagged = false;
                    d.userIssueNote = '';
                    d.uploadReason = 'Unflagged by User';
                  }
                }
              });
            } catch (e) {
              console.error('Manifest unflag update error:', e);
            }
            try {
              await sendTelegramMessage(
                env,
                `⚪ <b>Issue Report Unflagged (Retracted by Trainer)</b>\n` +
                  `👤 <b>Trainer:</b> <code>@${escapeHtml(screenName)}</code>\n` +
                  (battleId ? `🆔 <b>Battle:</b> <code>${escapeHtml(battleId)}</code>\n` : '') +
                  `📝 <i>User unflagged this report as sent inadvertently.</i>`
              );
            } catch (_) {}
          })()
        );

        return jsonResponse(
          {
            ok: true,
            unflagged: true,
            screenName,
            battleId,
            shareId: resolvedShareId,
            updatedTrace,
          },
          200,
          request,
          true
        );
      } catch (err) {
        console.error('POST /v1/dvr/unflag error:', err);
        return jsonResponse(
          { ok: false, error: 'Failed to unflag DVR issue report.' },
          500,
          request,
          true
        );
      }
    }

    // 5. License / Unlock Key Verification & Multi-Device Sync (`POST /v1/license/verify`)
    if (request.method === 'POST' && path === '/v1/license/verify') {
      const auth = await verifyClientAuth(request, env, false, true);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
      const { screenName } = auth;

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'license_verify',
        `${getClientIp(request)}_${screenName}`,
        30,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          { ok: false, error: 'Too many verification attempts. Please wait a few minutes.' },
          429,
          request,
          true
        );
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const inputKey = String(
        body.unlockKey || body.key || request.headers.get('X-SilphScope-Unlock-Key') || ''
      ).trim();
      const ghToken = String(
        body.githubToken || request.headers.get('X-GitHub-Token') || ''
      ).trim();
      let verifiedGhUser = '';
      let verifiedGhId = '';
      let isServerVerifiedGh = false;
      if (ghToken) {
        const ghCheck = await verifyGitHubTokenIdentity(ghToken);
        if (ghCheck.ok) {
          verifiedGhUser = ghCheck.githubUsername;
          verifiedGhId = ghCheck.githubUserId;
          isServerVerifiedGh = true;
        }
      }
      const devHash = String(
        body.deviceHash || request.headers.get('X-Device-Hash') || ''
      ).trim();
      const claimEmail = String(
        body.claimEmail || body.email || request.headers.get('X-Claim-Email') || ''
      ).trim();

      const licenseInfo = await resolveUserLicense(
        env,
        env.TELEMETRY_KV,
        screenName,
        inputKey,
        verifiedGhUser,
        verifiedGhId,
        devHash,
        claimEmail,
        {
          isServerVerifiedGh,
          isOwnerCaller: Boolean(inputKey || isServerVerifiedGh),
        }
      );
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
      const seasonWindow = getActiveGblSeasonWindow();
      const introUsed = await hasUserUsedIntroPromo(env.TELEMETRY_KV, {
        screenName,
        email: claimEmail,
        deviceHash: devHash,
        githubUserId: verifiedGhId,
      });

      const deviceIngestToken = devHash ? await computeDeviceIngestToken(env, devHash) : '';
      return jsonResponse(
        {
          ok: true,
          screenName,
          tier: licenseInfo.tier,
          active: licenseInfo.active,
          everPaid: Boolean(licenseInfo.everPaid),
          signature: licenseInfo.signature || '',
          deviceIngestToken,
          screenNameConflict: Boolean(licenseInfo.screenNameConflict),
          error: licenseInfo.error || null,
          license: licenseInfo,
          limits: licenseInfo,
          usage,
          seasonPromo: {
            ...seasonWindow,
            introPromoEligible: seasonWindow.isDay15Plus && !introUsed,
            introPromoAlreadyUsed: introUsed,
          },
          paymentLinks: {
            stripe: STRIPE_PAYMENT_LINKS,
            bmc: BMC_LINKS,
          },
          globalR2: {
            usedMb: Number((globalStats.totalBytes / (1024 * 1024)).toFixed(2)),
            maxGb: Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0,
            totalReplays: globalStats.totalReplays,
          },
        },
        200,
        request,
        true
      );
    }

    // 5b. Pre-Checkout Unique Screen Name Registration & Dupe Check (`POST /v1/users/register-name`)
    if (request.method === 'POST' && path === '/v1/users/register-name') {
      const auth = await verifyClientAuth(request, env, true, true);
      if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'register_name',
        getClientIp(request),
        20,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          { ok: false, error: 'Too many registration checks. Please wait a few minutes.' },
          429,
          request,
          true
        );
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const desiredName = sanitizeScreenName(body.screenName || auth.screenName || '');
      const devHash = String(body.deviceHash || request.headers.get('X-Device-Hash') || '').trim();
      const ghToken = String(body.githubToken || request.headers.get('X-GitHub-Token') || '').trim();
      let verifiedGhId = '';
      if (ghToken) {
        const ghCheck = await verifyGitHubTokenIdentity(ghToken);
        if (ghCheck.ok) verifiedGhId = ghCheck.githubUserId;
      }
      const email = String(body.email || '').trim().toLowerCase();

      if (!desiredName || desiredName === 'anonymous' || desiredName.length < 3) {
        return jsonResponse(
          {
            ok: false,
            available: false,
            error: 'Please enter a unique Trainer ID (at least 3 characters, not "anonymous").',
          },
          400,
          request,
          true
        );
      }

      const chk = await checkScreenNameRegistration(
        env.TELEMETRY_KV,
        desiredName,
        devHash,
        verifiedGhId
      );
      if (!chk.available) {
        return jsonResponse(
          {
            ok: true,
            available: false,
            ownedByCaller: false,
            screenName: desiredName,
            error: `Trainer ID '@${desiredName}' is already registered by another player. Please choose a unique Trainer ID before purchasing.`,
          },
          200,
          request,
          true
        );
      }

      const isValidDevToken = devHash.length >= 8 && !devHash.toLowerCase().startsWith('web-');
      if (env.TELEMETRY_KV && (isValidDevToken || verifiedGhId) && (!chk.record || chk.ownedByCaller)) {
        const prevRec = chk.record && typeof chk.record === 'object' ? chk.record : {};
        await env.TELEMETRY_KV.put(
          `registered_user/${desiredName.toLowerCase()}`,
          JSON.stringify({
            ...prevRec,
            screenName: desiredName,
            deviceHash: isValidDevToken ? devHash : prevRec.deviceHash || '',
            githubUserId: verifiedGhId || prevRec.githubUserId || '',
            email: email || prevRec.email || '',
            registeredAt: prevRec.registeredAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        );
      }

      const seasonWindow = getActiveGblSeasonWindow();
      const introUsed = await hasUserUsedIntroPromo(env.TELEMETRY_KV, {
        screenName: desiredName,
        email,
        deviceHash: devHash,
        githubUserId: verifiedGhId,
      });

      const deviceIngestToken = devHash ? await computeDeviceIngestToken(env, devHash) : '';
      return jsonResponse(
        {
          ok: true,
          available: true,
          ownedByCaller: Boolean(chk.ownedByCaller || !chk.record),
          screenName: desiredName,
          deviceIngestToken,
          seasonPromo: {
            ...seasonWindow,
            introPromoEligible: seasonWindow.isDay15Plus && !introUsed,
            introPromoAlreadyUsed: introUsed,
          },
          paymentLinks: {
            stripe: STRIPE_PAYMENT_LINKS,
            bmc: BMC_LINKS,
          },
        },
        200,
        request,
        true
      );
    }

    // 5c. Dynamic Season Pass / Intro Promo Checkout Quote (`POST /v1/users/checkout-quote`)
    if ((request.method === 'POST' || request.method === 'GET') && path === '/v1/users/checkout-quote') {
      let body = {};
      if (request.method === 'POST') {
        try {
          body = await request.json();
        } catch (_) {}
      }
      const screenName = sanitizeScreenName(
        body.screenName || url.searchParams.get('screenName') || request.headers.get('X-Trainer-Screen-Name') || ''
      );
      const email = String(body.email || url.searchParams.get('email') || '').trim().toLowerCase();
      const devHash = String(body.deviceHash || url.searchParams.get('deviceHash') || '').trim();
      const ghId = String(body.githubUserId || url.searchParams.get('githubUserId') || '').trim();

      const seasonWindow = getActiveGblSeasonWindow();
      const introUsed = await hasUserUsedIntroPromo(env.TELEMETRY_KV, {
        screenName,
        email,
        deviceHash: devHash,
        githubUserId: ghId,
      });
      const introEligible = seasonWindow.isDay15Plus && !introUsed;

      return jsonResponse(
        {
          ok: true,
          screenName,
          seasonWindow,
          introPromoEligible: introEligible,
          introPromoAlreadyUsed: introUsed,
          recommendedLinks: {
            supporter: {
              priceUsd: 2,
              label: 'Lifetime Supporter ($2 One-Time • 🛡️ Shield Decision HUD + 5 Local Videos + Core 3 Leagues + Lifetime Logs)',
              stripeUrl: `${STRIPE_PAYMENT_LINKS.supporter}?client_reference_id=${encodeURIComponent(screenName)}`,
              bmcUrl: BMC_LINKS.supporter,
            },
            pro: {
              priceUsd: introEligible ? 3 : 6,
              isIntroPromo: introEligible,
              label: introEligible
                ? `Legend Pro First-Season Intro Promo ($3 for Remainder of GBL Season • ${seasonWindow.daysRemaining}d left • 15 FPS DVR + 50 Cloud Replays + Shield HUD)`
                : 'Legend Pro 90-Day GBL Season Pass ($6 / Season • 15 FPS DVR + 50 Cloud Replays + Shield HUD)',
              stripeUrl: `${introEligible ? STRIPE_PAYMENT_LINKS.pro_intro : STRIPE_PAYMENT_LINKS.pro_season}?client_reference_id=${encodeURIComponent(screenName)}`,
              stripeMonthlyUrl: `${STRIPE_PAYMENT_LINKS.pro_monthly}?client_reference_id=${encodeURIComponent(screenName)}`,
              bmcUrl: introEligible ? BMC_LINKS.membership : BMC_LINKS.pro_season,
            },
            vip: {
              priceUsd: introEligible ? 5 : 10,
              isIntroPromo: introEligible,
              label: introEligible
                ? `VIP / Coach First-Season Intro Promo ($5 for Remainder of GBL Season • ${seasonWindow.daysRemaining}d left • 30 FPS Smooth DVR + 150 Cloud Replays)`
                : 'VIP / Coach 90-Day GBL Season Pass ($10 / Season • 30 FPS Smooth DVR + 150 Cloud Replays)',
              stripeUrl: `${introEligible ? STRIPE_PAYMENT_LINKS.vip_intro : STRIPE_PAYMENT_LINKS.vip_season}?client_reference_id=${encodeURIComponent(screenName)}`,
              stripeMonthlyUrl: `${STRIPE_PAYMENT_LINKS.vip_monthly}?client_reference_id=${encodeURIComponent(screenName)}`,
              bmcUrl: introEligible ? BMC_LINKS.membership : BMC_LINKS.vip_season,
            },
          },
          paymentLinks: {
            stripe: STRIPE_PAYMENT_LINKS,
            bmc: BMC_LINKS,
          },
        },
        200,
        request,
        true
      );
    }

    // 6. Buy Me a Coffee & Stripe Automated Key Webhooks (`POST /v1/webhooks/bmc` & `POST /v1/webhooks/stripe`)
    if (request.method === 'POST' && (path === '/v1/webhooks/bmc' || path === '/v1/webhooks/stripe')) {
      const isStripe = path === '/v1/webhooks/stripe';
      const rawBody = await request.text();

      const adminOverride = verifyAdminAuth(request, env).ok;
      if (!adminOverride) {
        const sigCheck = isStripe
          ? await verifyStripeWebhookSignature(request, rawBody, env)
          : await verifyBmcWebhookSignature(request, rawBody, env);
        if (!sigCheck.ok) {
          return jsonResponse({ ok: false, error: sigCheck.error }, 401);
        }
      }

      let body = {};
      try {
        body = JSON.parse(rawBody);
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON payload' }, 400);
      }

      // Deduplicate webhook deliveries by provider event ID
      const rawEventId = String(
        body.id || body.event_id || (body.data && body.data.id) || ''
      ).trim();
      const eventId = rawEventId ? sanitizeId(rawEventId, '') : '';
      const dedupKey = eventId
        ? `webhook_event/${isStripe ? 'stripe' : 'bmc'}/${eventId}`
        : '';
      if (dedupKey && env.TELEMETRY_KV) {
        const alreadyProcessed = await env.TELEMETRY_KV.get(dedupKey, { type: 'text' });
        if (alreadyProcessed) {
          return jsonResponse({ ok: true, deduplicated: true, eventId });
        }
      }

      let amount = 0;
      let levelName = '';
      let supporterName = 'Trainer';
      let supporterEmail = '';
      let supportNote = '';
      let rawScreenNameCandidate = '';
      let isWebhookRenewalEvent = false;

      if (isStripe) {
        const eventType = String(body.type || '');
        if (
          eventType &&
          !eventType.includes('checkout.session.completed') &&
          !eventType.includes('invoice.paid')
        ) {
          return jsonResponse({ ok: true, ignored: true, eventType });
        }
        const obj = (body.data && body.data.object) || body || {};
        if (
          eventType.includes('invoice.paid') ||
          String(obj.billing_reason || '').toLowerCase().includes('subscription_cycle') ||
          String(obj.billing_reason || '').toLowerCase().includes('subscription_update')
        ) {
          isWebhookRenewalEvent = true;
        }
        amount = Number(obj.amount_total ?? obj.amount_paid ?? 0) / 100;
        supporterEmail = String(
          (obj.customer_details && obj.customer_details.email) || obj.customer_email || ''
        )
          .trim()
          .toLowerCase();
        supporterName = String(
          (obj.customer_details && obj.customer_details.name) || supporterEmail || 'Stripe Supporter'
        ).trim();
        const customFields = Array.isArray(obj.custom_fields) ? obj.custom_fields : [];
        for (const cf of customFields) {
          const val = cf && cf.text && cf.text.value ? String(cf.text.value).trim() : '';
          if (val) {
            rawScreenNameCandidate = val;
            break;
          }
        }
        if (!rawScreenNameCandidate && obj.client_reference_id) {
          rawScreenNameCandidate = String(obj.client_reference_id).trim();
        }
        levelName = String((obj.metadata && obj.metadata.tier) || '').toLowerCase();
        supportNote = `Stripe ${eventType || 'checkout'} ($${amount.toFixed(2)})`;
      } else {
        const eventType = String(body.type || body.event || '').toLowerCase();
        if (
          eventType.includes('renew') ||
          eventType.includes('recurring') ||
          eventType.includes('subscription_payment')
        ) {
          isWebhookRenewalEvent = true;
        }
        const data = body.data || body || {};
        amount = Number(data.amount || data.support_coffee_price || 0);
        levelName = String(data.membership_level_name || data.title || data.extra_title || '').toLowerCase();
        supporterName = String(data.supporter_name || data.payer_name || 'Supporter').trim();
        supporterEmail = String(data.supporter_email || data.payer_email || '').trim().toLowerCase();
        supportNote = String(data.support_note || data.message || '').trim();
        const idMatch = supportNote.match(/(?:trainer|id|user|name|@)\s*[:=-]?\s*([A-Za-z0-9_.-]{3,36})/i);
        if (idMatch && idMatch[1]) {
          rawScreenNameCandidate = idMatch[1];
        } else if (/^[A-Za-z0-9_.-]{3,28}$/.test(supportNote)) {
          rawScreenNameCandidate = supportNote;
        } else if (supporterName && /^[A-Za-z0-9_.-]{3,28}$/.test(supporterName)) {
          rawScreenNameCandidate = supporterName;
        }
      }

      const boundScreenName = rawScreenNameCandidate ? sanitizeScreenName(rawScreenNameCandidate) : '';
      const seasonWindow = getActiveGblSeasonWindow();
      const alreadyUsedPromo = await hasUserUsedIntroPromo(env.TELEMETRY_KV, {
        screenName: boundScreenName,
        email: supporterEmail,
      });

      let tier = 'supporter';
      let isSeasonPass = false;
      let isIntroPromo = false;

      if (levelName.includes('vip') || levelName.includes('coach')) {
        tier = 'vip';
        if (amount >= 8.5 || levelName.includes('season')) {
          isSeasonPass = true;
        } else if (seasonWindow.isDay15Plus && !alreadyUsedPromo) {
          isSeasonPass = true;
          isIntroPromo = true;
        }
      } else if (
        levelName.includes('pro') ||
        levelName.includes('legend') ||
        levelName.includes('season')
      ) {
        tier = 'pro';
        if (amount >= 5.5 || levelName.includes('season')) {
          isSeasonPass = true;
        } else if (seasonWindow.isDay15Plus && !alreadyUsedPromo) {
          isSeasonPass = true;
          isIntroPromo = true;
        }
      } else if (amount >= 8.5) {
        tier = 'vip';
        isSeasonPass = true;
      } else if (amount >= 5.5) {
        tier = 'pro';
        isSeasonPass = true;
      } else if (amount >= 4.5) {
        tier = 'vip';
        if (seasonWindow.isDay15Plus && !alreadyUsedPromo) {
          isSeasonPass = true;
          isIntroPromo = true;
        }
      } else if (amount >= 2.8) {
        tier = 'pro';
        if (seasonWindow.isDay15Plus && !alreadyUsedPromo) {
          isSeasonPass = true;
          isIntroPromo = true;
        }
      } else {
        tier = 'supporter';
      }

      const preset = TIER_PRESETS[tier] || TIER_PRESETS.supporter;
      const newKey = generateUnlockKey(tier);
      const now = new Date();
      let expiresAt = null;
      if (tier === 'supporter') {
        expiresAt = null; // Lifetime Supporter never expires!
      } else if (isSeasonPass) {
        const seasonEndBufferMs = seasonWindow.endMs + 7 * 86400000;
        const min35DaysMs = now.getTime() + 35 * 86400000;
        const full95DaysMs = now.getTime() + 95 * 86400000;
        expiresAt = new Date(
          isIntroPromo ? Math.max(seasonEndBufferMs, min35DaysMs) : Math.max(seasonEndBufferMs, full95DaysMs)
        ).toISOString();
      } else {
        expiresAt = new Date(now.getTime() + 35 * 24 * 3600 * 1000).toISOString();
      }

      // Check if buyer already has an existing license by boundScreenName or O(1) email_license index
      let screenNameConflict = false;
      let existingMatchedLicense = null;
      if (boundScreenName && env.TELEMETRY_KV) {
        const chk = await checkScreenNameRegistration(env.TELEMETRY_KV, boundScreenName, '', '');
        const existingBoundKey =
          (chk.record && chk.record.boundKey) ||
          (await env.TELEMETRY_KV.get(`user_license/${boundScreenName.toLowerCase()}`, { type: 'text' }));
        const existingLic = existingBoundKey
          ? await loadLicenseByKey(env.TELEMETRY_KV, existingBoundKey)
          : null;
        if (!chk.available || existingLic) {
          const existingRec = chk.record;
          const sameEmail =
            supporterEmail &&
            ((existingRec && existingRec.email && existingRec.email.toLowerCase() === supporterEmail) ||
              (existingLic &&
                existingLic.supporterEmail &&
                existingLic.supporterEmail.toLowerCase() === supporterEmail));
          if (sameEmail && existingLic) {
            existingMatchedLicense = existingLic;
          } else {
            // Different user already owns this screenName — mark conflict so we never overwrite their user_license
            screenNameConflict = true;
          }
        }
      }

      if (!existingMatchedLicense && supporterEmail && env.TELEMETRY_KV) {
        const cleanEmailKey = sanitizeEmailKey(supporterEmail);
        if (cleanEmailKey) {
          const emailLicKey = await env.TELEMETRY_KV.get(`email_license/${cleanEmailKey}`, { type: 'text' });
          if (emailLicKey) {
            existingMatchedLicense = await loadLicenseByKey(env.TELEMETRY_KV, emailLicKey);
          }
        }
      }

      const isRenewal = Boolean(isWebhookRenewalEvent || existingMatchedLicense);
      const effectiveScreenName = screenNameConflict
        ? ''
        : boundScreenName || (existingMatchedLicense && existingMatchedLicense.boundScreenName) || '';

      if (existingMatchedLicense) {
        const tierRank = { free: 0, supporter: 1, pro: 2, vip: 3 };
        if ((tierRank[tier] || 0) >= (tierRank[existingMatchedLicense.tier] || 0)) {
          existingMatchedLicense.tier = tier;
          existingMatchedLicense.label = preset.label;
        }
        if (expiresAt) {
          const prevExpMs = existingMatchedLicense.expiresAt ? Date.parse(existingMatchedLicense.expiresAt) : 0;
          const durationAddedMs = isSeasonPass ? 95 * 86400000 : 35 * 86400000;
          const extendedMs =
            prevExpMs > now.getTime()
              ? prevExpMs + durationAddedMs
              : Date.parse(expiresAt);
          existingMatchedLicense.expiresAt = new Date(extendedMs).toISOString();
          expiresAt = existingMatchedLicense.expiresAt;
        }
        existingMatchedLicense.revoked = false;
        existingMatchedLicense.everPaid = true;
        existingMatchedLicense.lastRenewedAt = now.toISOString();
        await saveLicenseRecord(env.TELEMETRY_KV, existingMatchedLicense);
      }

      const licenseRecord = {
        key: newKey,
        tier,
        label: preset.label,
        boundScreenName: effectiveScreenName,
        requestedScreenName: boundScreenName || null,
        screenNameConflict,
        everPaid: true,
        isIntroPromo,
        isRenewal,
        renewedFromKey: existingMatchedLicense ? existingMatchedLicense.key : null,
        supporterName,
        supporterEmail,
        supportNote,
        createdAt: now.toISOString(),
        expiresAt,
        revoked: false,
        source: isStripe ? 'stripe_webhook' : 'bmc_webhook',
      };

      await saveLicenseRecord(env.TELEMETRY_KV, licenseRecord);
      if (dedupKey && env.TELEMETRY_KV) {
        await env.TELEMETRY_KV.put(dedupKey, now.toISOString(), { expirationTtl: 86400 * 30 });
      }
      if (isIntroPromo) {
        await markUserIntroPromoUsed(env.TELEMETRY_KV, {
          screenName: effectiveScreenName,
          email: supporterEmail,
          key: newKey,
        });
      }

      const headlineHtml = isRenewal
        ? `${isStripe ? '🔄 <b>Stripe Subscription Renewal!' : '🔄 <b>Buy Me a Coffee Renewal!'}</b>`
        : `${isStripe ? '💳 <b>New Stripe Subscription Purchase!' : '☕ <b>New Buy Me a Coffee Purchase!'}</b>`;

      ctx.waitUntil(
        sendTelegramMessage(
          env,
          `${headlineHtml}\n` +
            `👤 <b>Trainer:</b> ${escapeHtml(supporterName)} (${escapeHtml(supporterEmail || 'no-email')})\n` +
            `💵 <b>Amount:</b> $${amount.toFixed(2)}${isIntroPromo ? ' (Day 15+ First-Season Promo!)' : ''}${isRenewal ? ' (RENEWAL)' : ' (NEW PURCHASE)'}\n` +
            `🏅 <b>Paid Tier:</b> <code>${escapeHtml(preset.label)} (${tier.toUpperCase()})</code>\n` +
            `🔑 <b>Unlock Key:</b> <code>${escapeHtml(newKey)}</code>` +
            (existingMatchedLicense ? ` (Also extended <code>${escapeHtml(existingMatchedLicense.key)}</code>)` : '') +
            `\n` +
            `⏳ <b>Expires:</b> <code>${escapeHtml(expiresAt ? expiresAt.slice(0, 10) : 'LIFETIME')}</code>\n` +
            (effectiveScreenName
              ? `🎮 <b>Trainer ID:</b> <code>@${escapeHtml(effectiveScreenName)}</code>\n` +
                `🌐 <b>Vault URL:</b> https://dvr.silphscopepvp.com/u/${encodeURIComponent(effectiveScreenName)}\n`
              : screenNameConflict
              ? `⚠️ <b>Duplicate ID Requested:</b> <code>@${escapeHtml(boundScreenName)}</code> (Buyer can claim via email in-app)\n`
              : '') +
            (supportNote ? `💬 <b>Note:</b> ${escapeHtml(supportNote)}` : '')
        )
      );

      return jsonResponse({
        ok: true,
        source: licenseRecord.source,
        isRenewal,
        tier,
        unlockKeyMasked: maskSecretKey(newKey),
        boundScreenName: effectiveScreenName || null,
        screenNameConflict,
        isIntroPromo,
        expiresAt,
      });
    }

    // 7. Cloud R2 Replay Vault Upload (`POST /v1/replays/upload`)
    if (request.method === 'POST' && path === '/v1/replays/upload') {
      try {
        const auth = await verifyClientAuth(request, env);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status);
        const { screenName } = auth;

        const rl = await checkAndIncrementRateLimit(
          env.TELEMETRY_KV,
          'replay_upload',
          `${getClientIp(request)}_${screenName}`,
          20,
          600
        );
        if (!rl.allowed) {
          return jsonResponse({ ok: false, error: 'Rate limit exceeded for Replay Vault upload.' }, 429);
        }

        if (!env.REPLAY_BUCKET) {
          return jsonResponse({ ok: false, error: 'R2 Replay Bucket not bound on Worker.' }, 503);
        }

        const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
        const MAX_TRACE_BYTES = 24 * 1024 * 1024;

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
            if (typeof videoFile.size === 'number' && videoFile.size > MAX_VIDEO_BYTES) {
              return jsonResponse({ ok: false, error: 'Replay video exceeds 64 MiB limit.' }, 413);
            }
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
            if (body.videoBase64.length > Math.ceil(MAX_VIDEO_BYTES * 1.38)) {
              return jsonResponse({ ok: false, error: 'Replay video payload exceeds 64 MiB limit.' }, 413);
            }
            const binaryStr = atob(body.videoBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            videoBytes = bytes;
          }
        }

        if (videoBytes && videoBytes.byteLength > MAX_VIDEO_BYTES) {
          return jsonResponse({ ok: false, error: 'Replay video exceeds 64 MiB limit.' }, 413);
        }
        if (deepTraceText && deepTraceText.length > MAX_TRACE_BYTES) {
          return jsonResponse({ ok: false, error: 'Replay trace exceeds 24 MiB limit.' }, 413);
        }

        const inputKey = String(
          metadata.unlockKey || request.headers.get('X-SilphScope-Unlock-Key') || ''
        ).trim();
        const devHash = String(
          metadata.deviceHash || metadata.deviceId || request.headers.get('X-Device-Hash') || ''
        ).trim();
        const ghToken = String(
          metadata.githubToken || request.headers.get('X-GitHub-Token') || ''
        ).trim();
        let verifiedGhUser = '';
        let verifiedGhId = '';
        let isServerVerifiedGh = false;
        if (ghToken) {
          const ghCheck = await verifyGitHubTokenIdentity(ghToken);
          if (ghCheck.ok) {
            verifiedGhUser = ghCheck.githubUsername;
            verifiedGhId = ghCheck.githubUserId;
            isServerVerifiedGh = true;
          }
        }
        const licenseInfo = await resolveUserLicense(
          env,
          env.TELEMETRY_KV,
          screenName,
          inputKey,
          verifiedGhUser,
          verifiedGhId,
          devHash,
          '',
          {
            isServerVerifiedGh,
            isOwnerCaller: Boolean(inputKey || isServerVerifiedGh),
          }
        );
        if (
          !licenseInfo.active ||
          licenseInfo.screenNameConflict ||
          licenseInfo.tier === 'free' ||
          licenseInfo.tier === 'supporter'
        ) {
          return jsonResponse(
            {
              ok: false,
              error:
                licenseInfo.tier === 'supporter'
                  ? 'Lifetime Supporter retains past pinned cloud replays for 365 days, plus 5 local on-device videos. Upgrade to Legend Pro ($3/mo or $6/season) for new Cloud R2 Replay Vault uploads.'
                  : 'Active Legend Pro or VIP Unlock Key required for Cloud R2 Replay Vault uploads.',
              tier: licenseInfo.tier,
            },
            403
          );
        }

        // Verify caller actually proved ownership of this license (via unlockKey, verified GitHub, session, or bound deviceHash)
        const ownerAuth = await authenticateVaultOwner(
          request,
          env,
          env.TELEMETRY_KV,
          screenName,
          metadata
        );
        const matchesBoundDev =
          devHash.length >= 8 &&
          !devHash.toLowerCase().startsWith('web-') &&
          licenseInfo.boundDeviceHash &&
          String(licenseInfo.boundDeviceHash).toLowerCase() === devHash.toLowerCase();
        if (!ownerAuth.isOwner && !matchesBoundDev && !inputKey && !isServerVerifiedGh) {
          return jsonResponse(
            {
              ok: false,
              error: 'Owner authentication (Unlock Key, Session, or bound device) required to upload replays.',
            },
            403
          );
        }

        const hasVideo = Boolean(videoBytes && videoBytes.byteLength > 0);
        const hasTrace = Boolean(deepTraceText && deepTraceText.trim().length > 0);
        if (!hasVideo) {
          return jsonResponse({ ok: false, error: 'Missing MP4 video payload for Replay Vault.' }, 400);
        }
        if (!isValidMp4Bytes(videoBytes)) {
          return jsonResponse({ ok: false, error: 'Invalid MP4 container header.' }, 400);
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
        const league = String(metadata.league || 'GBL').slice(0, 64);
        const result = String(metadata.result || 'BATTLE').slice(0, 32);
        const matchupSummary = String(resolveFullTeamMatchupSummary(metadata, deepTraceText) || '').slice(0, 180);
        const frameCount = Math.max(0, Math.min(20000, Number(metadata.frameCount) || 0));
        const durationSec = Math.max(1, Math.min(600, Number(metadata.durationSec) || Math.round(frameCount / 10)));
        const appVersion = String(metadata.appVersion || '7.13').slice(0, 32);
        const isPinned = Boolean(
          metadata.isPinned !== undefined ? metadata.isPinned : existingItem && existingItem.isPinned
        );
        const isPublic = Boolean(
          metadata.isPublic !== undefined ? metadata.isPublic : existingItem && existingItem.isPublic
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
          isPublic,
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
          isPublic,
          usage,
        });
      } catch (err) {
        console.error('POST /v1/replays/upload error:', err);
        return jsonResponse(
          { ok: false, error: 'Internal server error uploading replay.' },
          500
        );
      }
    }

    // 7b. Unified Vault & Simulator Login (`POST /v1/auth/login`)
    if (request.method === 'POST' && path === '/v1/auth/login') {
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      if (providedKey) {
        const auth = await verifyClientAuth(request, env, true, true);
        if (!auth.ok) {
          return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        }
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}

      const rawTarget = String(
        body.screenName || request.headers.get('X-Trainer-Screen-Name') || ''
      ).trim();
      const targetScreenName = rawTarget ? sanitizeScreenName(rawTarget) : '';

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'auth_login',
        `${getClientIp(request)}_${targetScreenName || 'anon'}`,
        12,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          {
            ok: false,
            isOwner: false,
            error: 'Too many login attempts. Please wait a few minutes and try again.',
          },
          429,
          request,
          true
        );
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        targetScreenName,
        body
      );
      if (!ownerAuth.isOwner) {
        return jsonResponse(
          {
            ok: false,
            isOwner: false,
            error:
              ownerAuth.error ||
              'Authentication failed. Check your Username + Token, Password, or GitHub account.',
          },
          403,
          request,
          true
        );
      }

      const resolvedName = ownerAuth.screenName || targetScreenName;
      const licInfo = ownerAuth.licenseInfo || { ...TIER_PRESETS.free, active: false };
      const authRec = ownerAuth.authRecord || (await loadUserAuthRecord(env.TELEMETRY_KV, resolvedName));
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, resolvedName);

      const loginResp = jsonResponse(
        {
          ok: true,
          isOwner: true,
          authMethod: ownerAuth.authMethod,
          screenName: resolvedName,
          sessionToken: ownerAuth.sessionToken,
          tier: licInfo.tier || 'free',
          active: Boolean(licInfo.active),
          everPaid: Boolean(licInfo.everPaid),
          signature: licInfo.signature || '',
          license: licInfo,
          limits: licInfo,
          hasPassword: Boolean(authRec && authRec.passwordHash),
          githubUsername:
            (authRec && authRec.githubUsername) || licInfo.boundGitHubUsername || '',
          settings: indexObj.settings,
        },
        200,
        request,
        true
      );
      if (resolvedName && ownerAuth.sessionToken) {
        loginResp.headers.append(
          'Set-Cookie',
          `sspvp_vault_user=${encodeURIComponent(resolvedName)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
        );
        loginResp.headers.append(
          'Set-Cookie',
          `sspvp_vault_session=${encodeURIComponent(ownerAuth.sessionToken)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
        );
      }
      return loginResp;
    }

    // 7c. Set or Update User Password (`POST /v1/auth/set-password`)
    if (request.method === 'POST' && path === '/v1/auth/set-password') {
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      let authScreenName = '';
      if (providedKey) {
        const auth = await verifyClientAuth(request, env, true, true);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        authScreenName = auth.screenName;
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      const targetName = sanitizeScreenName(body.screenName || authScreenName || '');
      const newPassword = String(body.newPassword || '').trim();
      if (!targetName || targetName === 'anonymous') {
        return jsonResponse({ ok: false, error: 'Enter a valid Trainer ID first.' }, 400, request, true);
      }
      if (!newPassword || newPassword.length < 8 || newPassword.length > 128) {
        return jsonResponse(
          { ok: false, error: 'Password must be between 8 and 128 characters.' },
          400,
          request,
          true
        );
      }

      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'set_password',
        `${getClientIp(request)}_${targetName}`,
        10,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          { ok: false, error: 'Too many password update attempts. Please wait a few minutes.' },
          429,
          request,
          true
        );
      }

      const existingAuth = await loadUserAuthRecord(env.TELEMETRY_KV, targetName);
      const devHash = String(body.deviceHash || request.headers.get('X-Device-Hash') || '').trim();

      let authorizedToSet = false;
      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        targetName,
        {
          ...body,
          password: body.currentPassword || body.password || '',
        }
      );

      if (ownerAuth.isOwner) {
        authorizedToSet = true;
      } else if (!existingAuth || !existingAuth.passwordHash) {
        // Allow first-time password creation without prior password if caller proves ownership via registered or brand-new unclaimed non-web deviceHash
        const isValidNonWebDev = devHash.length >= 8 && !devHash.toLowerCase().startsWith('web-');
        const chk = await checkScreenNameRegistration(env.TELEMETRY_KV, targetName, devHash, '');
        if (chk.ownedByCaller) {
          authorizedToSet = true;
        } else if (chk.available && !chk.record && isValidNonWebDev && providedKey) {
          const nowIso = new Date().toISOString();
          if (env.TELEMETRY_KV) {
            await env.TELEMETRY_KV.put(
              `registered_user/${targetName.toLowerCase()}`,
              JSON.stringify({
                screenName: targetName,
                deviceHash: devHash,
                registeredAt: nowIso,
                updatedAt: nowIso,
              })
            );
          }
          authorizedToSet = true;
        }
      }

      if (!authorizedToSet) {
        return jsonResponse(
          {
            ok: false,
            error:
              'Authenticate from your registered primary phone, Unlock Key, or current password before setting or changing your Vault Password.',
          },
          403,
          request,
          true
        );
      }

      const salt = generateSecureSaltHex(16);
      const passwordHash = await hashUserPassword(env, newPassword, salt);
      const updatedAuth = existingAuth || { screenName: targetName };
      updatedAuth.passwordSalt = salt;
      updatedAuth.passwordHash = passwordHash;
      updatedAuth.sessionEpoch = (Number(updatedAuth.sessionEpoch) || 1) + 1;
      if (ownerAuth.licenseInfo && ownerAuth.licenseInfo.key) {
        updatedAuth.boundKey = ownerAuth.licenseInfo.key;
      }
      await saveUserAuthRecord(env.TELEMETRY_KV, targetName, updatedAuth);

      const tier = (ownerAuth.licenseInfo && ownerAuth.licenseInfo.tier) || 'free';
      const sessionToken = await createVaultSessionToken(
        env,
        targetName,
        tier,
        365,
        updatedAuth.sessionEpoch
      );
      const setPwResp = jsonResponse(
        {
          ok: true,
          screenName: targetName,
          hasPassword: true,
          sessionToken,
        },
        200,
        request,
        true
      );
      setPwResp.headers.append(
        'Set-Cookie',
        `sspvp_vault_user=${encodeURIComponent(targetName)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
      );
      setPwResp.headers.append(
        'Set-Cookie',
        `sspvp_vault_session=${encodeURIComponent(sessionToken)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
      );
      return setPwResp;
    }

    // 7c-sync. Cloudflare D1 Multi-Device Vault Delta Sync (`GET / POST / PUT /v1/sync/vault`)
    if (
      (request.method === 'GET' || request.method === 'POST' || request.method === 'PUT') &&
      path === '/v1/sync/vault'
    ) {
      if (!env.SYNC_DB) {
        return jsonResponse(
          { ok: false, error: 'SYNC_DB (Cloudflare D1) is not configured on this Worker.' },
          500,
          request,
          true
        );
      }

      let body = {};
      if (request.method === 'POST' || request.method === 'PUT') {
        try {
          const rawText = await request.text();
          if (rawText.length > 8 * 1024 * 1024) {
            return jsonResponse(
              { ok: false, error: 'Sync payload exceeds 8 MB safety limit.' },
              413,
              request,
              true
            );
          }
          body = rawText ? JSON.parse(rawText) : {};
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON sync payload.' }, 400, request, true);
        }
      }

      // Also check sspvp_vault_session cookie if X-Vault-Session header was omitted (Web Simulator convenience)
      if (!body.sessionToken && !request.headers.get('X-Vault-Session')) {
        const cookieHdr = request.headers.get('Cookie') || '';
        const m = cookieHdr.match(/(?:^|;\s*)sspvp_vault_session=([^;]+)/);
        if (m && m[1]) {
          try {
            body.sessionToken = decodeURIComponent(m[1].trim());
          } catch (_) {}
        }
      }

      const targetName = sanitizeScreenName(
        body.screenName ||
          url.searchParams.get('user') ||
          url.searchParams.get('screenName') ||
          request.headers.get('X-Trainer-Screen-Name') ||
          ''
      );

      // Zero-KV-write in-memory rate limit (protects 1,000/day KV write quota!)
      const memRl = checkMemoryRateLimit(
        'd1_vault_sync',
        `${getClientIp(request)}_${targetName || 'anon'}`,
        120,
        600
      );
      if (!memRl.allowed) {
        return jsonResponse(
          { ok: false, error: 'Sync rate limit reached. Please wait a minute before syncing again.' },
          429,
          request,
          true
        );
      }

      const syncAuth = await authenticateD1SyncCaller(
        request,
        env,
        env.TELEMETRY_KV,
        targetName,
        body
      );
      if (!syncAuth.ok) {
        return jsonResponse(
          {
            ok: false,
            screenName: syncAuth.screenName || targetName,
            hasPassword: Boolean(syncAuth.hasPassword),
            requiresPassword: Boolean(syncAuth.requiresPassword),
            error: syncAuth.error,
          },
          syncAuth.status || 403,
          request,
          true
        );
      }

      const resolvedName = syncAuth.screenName;
      const sinceServerMs = Math.max(
        0,
        Number(
          body.sinceServerMs ??
            url.searchParams.get('sinceServerMs') ??
            url.searchParams.get('since') ??
            0
        ) || 0
      );

      try {
        let writeStats = {
          wroteAnything: false,
          logsUpserted: 0,
          teamsUpserted: 0,
          serverUpdatedMs: 0,
        };
        if (request.method === 'POST' || request.method === 'PUT') {
          writeStats = await upsertVaultBatchIntoD1(env.SYNC_DB, resolvedName, {
            settingsMap: body.userSettings || body.settings || null,
            settingsUpdatedAt: Number(body.settingsUpdatedAt) || 0,
            battleLogs: body.battleLogs || [],
            teamPresets: body.teamPresets || [],
            deletedLogIds: body.deletedLogIds || [],
            deletedTeamIds: body.deletedTeamIds || [],
            source: body.isInitialMigration ? 'device_migration' : String(body.source || 'app_sync'),
            migratedFromGithub: Boolean(body.migratedFromGithub || body.isInitialMigration),
          });
        }

        const pulled = await pullVaultDeltasFromD1(env.SYNC_DB, resolvedName, {
          sinceServerMs,
          isPaidOrAlumni: syncAuth.isPaidOrAlumni,
        });

        const devHashHdr = String(
          body.deviceHash || request.headers.get('X-Device-Hash') || ''
        ).trim();
        const deviceIngestToken =
          devHashHdr.length >= 8 && !devHashHdr.toLowerCase().startsWith('web-')
            ? await computeDeviceIngestToken(env, devHashHdr)
            : '';

        const licInfo = syncAuth.licenseInfo || { ...TIER_PRESETS.free, active: false };
        return jsonResponse(
          {
            ok: true,
            screenName: resolvedName,
            authMethod: syncAuth.authMethod,
            hasPassword: Boolean(syncAuth.hasPassword),
            promptSetPassword: Boolean(syncAuth.promptSetPassword),
            sessionToken: syncAuth.sessionToken || '',
            deviceIngestToken,
            tier: licInfo.tier || 'free',
            active: Boolean(licInfo.active),
            everPaid: Boolean(licInfo.everPaid),
            signature: licInfo.signature || '',
            license: licInfo,
            serverSyncMs: Math.max(pulled.serverSyncMs || 0, writeStats.serverUpdatedMs || 0),
            shortCircuited: Boolean(pulled.shortCircuited && !writeStats.wroteAnything),
            totalActiveLogs: pulled.totalActiveLogs,
            totalActiveTeams: pulled.totalActiveTeams,
            pushedLogsCount: writeStats.logsUpserted || 0,
            pushedTeamsCount: writeStats.teamsUpserted || 0,
            userSettings: pulled.settings,
            settingsUpdatedAt: pulled.settingsUpdatedAt,
            battleLogs: pulled.upsertedLogs,
            deletedLogIds: pulled.deletedLogIds,
            teamPresets: pulled.upsertedTeams,
            deletedTeamIds: pulled.deletedTeamIds,
          },
          200,
          request,
          true
        );
      } catch (err) {
        console.error('D1 /v1/sync/vault error:', err);
        return jsonResponse(
          { ok: false, error: `Cloud Vault sync error: ${err.message || String(err)}` },
          500,
          request,
          true
        );
      }
    }

    // 7d-0. GitHub OAuth Start Route (`GET /v1/auth/github/start`)
    if ((request.method === 'GET' || request.method === 'HEAD') && path === '/v1/auth/github/start') {
      const originHost = url.hostname;
      const targetUrl = (originHost === 'dvr.silphscopepvp.com')
        ? 'https://dvr.silphscopepvp.com/vault?auth=github'
        : 'https://silphscopepvp.com/?view=vault&auth=github';

      const accept = request.headers.get('Accept') || '';
      if (accept.includes('application/json')) {
        return jsonResponse(
          {
            ok: true,
            authUrl: targetUrl,
            deviceAuthUrl: 'https://github.com/login/device',
            clientId: GITHUB_OAUTH_CLIENT_ID,
          },
          200,
          request,
          true
        );
      }

      return new Response(null, {
        status: 302,
        headers: buildSecurityHeaders(
          {
            Location: targetUrl,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
          true
        ),
      });
    }

    // 7d. GitHub OAuth Device Flow Proxy (`POST /v1/auth/github/device-code` & `POST /v1/auth/github/poll`)
    if (request.method === 'POST' && path === '/v1/auth/github/device-code') {
      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'gh_device_code',
        getClientIp(request),
        15,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          { ok: false, error: 'Too many GitHub login requests. Please wait a few minutes.' },
          429,
          request,
          true
        );
      }
      try {
        const ghRes = await fetch('https://github.com/login/device/code', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SilphScope-PvP-Worker/7.13',
          },
          body: `client_id=${encodeURIComponent(GITHUB_OAUTH_CLIENT_ID)}&scope=read%3Auser`,
        });
        const ghData = await ghRes.json();
        if (!ghRes.ok || !ghData.device_code) {
          return jsonResponse(
            { ok: false, error: ghData.error_description || 'Failed to start GitHub Device Flow.' },
            400,
            request,
            true
          );
        }
        return jsonResponse(
          {
            ok: true,
            device_code: ghData.device_code,
            user_code: ghData.user_code,
            verification_uri: ghData.verification_uri || 'https://github.com/login/device',
            expires_in: ghData.expires_in || 900,
            interval: ghData.interval || 5,
          },
          200,
          request,
          true
        );
      } catch (e) {
        return jsonResponse(
          { ok: false, error: 'GitHub OAuth service unavailable.' },
          500,
          request,
          true
        );
      }
    }

    if (request.method === 'POST' && path === '/v1/auth/github/poll') {
      const rl = await checkAndIncrementRateLimit(
        env.TELEMETRY_KV,
        'gh_poll',
        getClientIp(request),
        60,
        600
      );
      if (!rl.allowed) {
        return jsonResponse(
          { ok: false, status: 'error', error: 'Rate limit exceeded for GitHub device polling.' },
          429,
          request,
          true
        );
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {}
      const deviceCode = String(body.device_code || '').trim();
      if (!deviceCode) {
        return jsonResponse({ ok: false, error: 'Missing device_code' }, 400, request, true);
      }
      const dcHashHex = (await computeHmacSha256Hex('sspvp_gh_device_poll_v1', deviceCode)).slice(0, 32);
      const dcDoneKey = `gh_device_done/${dcHashHex}`;
      const dcStateKey = `gh_device_state/${dcHashHex}`;

      // 1. If a concurrent/prior request already exchanged this device_code within the last 180s, return cached session immediately!
      if (env.TELEMETRY_KV) {
        try {
          const cachedDoneRaw = await env.TELEMETRY_KV.get(dcDoneKey, { type: 'text' });
          if (cachedDoneRaw) {
            const cachedPayload = JSON.parse(cachedDoneRaw);
            const cachedResp = jsonResponse(cachedPayload, 200, request, true);
            if (cachedPayload.screenName && cachedPayload.sessionToken) {
              cachedResp.headers.append(
                'Set-Cookie',
                `sspvp_vault_user=${encodeURIComponent(cachedPayload.screenName)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
              );
              cachedResp.headers.append(
                'Set-Cookie',
                `sspvp_vault_session=${encodeURIComponent(cachedPayload.sessionToken)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
              );
            }
            return cachedResp;
          }
        } catch (_) {}
      }

      // 2. Enforce GitHub's strict per-device_code minimum interval BEFORE hitting GitHub so rapid taps / focus events NEVER trigger GitHub's +5s slow_down penalty!
      let pollState = { lastPollMs: 0, intervalSec: 5 };
      if (env.TELEMETRY_KV) {
        try {
          const rawState = await env.TELEMETRY_KV.get(dcStateKey, { type: 'text' });
          if (rawState) {
            const parsedState = JSON.parse(rawState);
            if (parsedState && typeof parsedState === 'object') {
              pollState = {
                lastPollMs: Number(parsedState.lastPollMs) || 0,
                intervalSec: Math.max(5, Number(parsedState.intervalSec) || 5),
              };
            }
          }
        } catch (_) {}
      }
      const nowPollMs = Date.now();
      const minGapMs = pollState.intervalSec * 1000 + 350;
      const elapsedSinceLastMs = nowPollMs - pollState.lastPollMs;
      if (pollState.lastPollMs > 0 && elapsedSinceLastMs >= 0 && elapsedSinceLastMs < minGapMs) {
        const cooldownMs = Math.max(400, minGapMs - elapsedSinceLastMs);
        return jsonResponse(
          {
            ok: true,
            status: 'pending',
            throttled: true,
            cooldownMs,
            interval: pollState.intervalSec,
          },
          200,
          request,
          true
        );
      }

      if (env.TELEMETRY_KV) {
        try {
          await env.TELEMETRY_KV.put(
            dcStateKey,
            JSON.stringify({ lastPollMs: nowPollMs, intervalSec: pollState.intervalSec }),
            { expirationTtl: 900 }
          );
        } catch (_) {}
      }

      try {
        const ghRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SilphScope-PvP-Worker/7.16',
          },
          body:
            `client_id=${encodeURIComponent(GITHUB_OAUTH_CLIENT_ID)}` +
            `&device_code=${encodeURIComponent(deviceCode)}` +
            `&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`,
        });
        const ghData = await ghRes.json();
        if (ghData.error === 'authorization_pending') {
          const nextInt = Math.max(pollState.intervalSec, Number(ghData.interval) || 5);
          return jsonResponse(
            { ok: true, status: 'pending', interval: nextInt, cooldownMs: nextInt * 1000 + 350 },
            200,
            request,
            true
          );
        }
        if (ghData.error === 'slow_down') {
          const nextInt = Math.max(pollState.intervalSec + 5, Number(ghData.interval) || 10);
          if (env.TELEMETRY_KV) {
            try {
              await env.TELEMETRY_KV.put(
                dcStateKey,
                JSON.stringify({ lastPollMs: Date.now(), intervalSec: nextInt }),
                { expirationTtl: 900 }
              );
            } catch (_) {}
          }
          return jsonResponse(
            {
              ok: true,
              status: 'pending',
              slowDown: true,
              interval: nextInt,
              cooldownMs: nextInt * 1000 + 450,
            },
            200,
            request,
            true
          );
        }
        if (!ghData.access_token) {
          if (env.TELEMETRY_KV && ghData.error === 'bad_verification_code') {
            try {
              const raceCachedRaw = await env.TELEMETRY_KV.get(dcDoneKey, { type: 'text' });
              if (raceCachedRaw) {
                const racePayload = JSON.parse(raceCachedRaw);
                return jsonResponse(racePayload, 200, request, true);
              }
            } catch (_) {}
          }
          return jsonResponse(
            {
              ok: false,
              status: 'error',
              error: ghData.error_description || ghData.error || 'GitHub authorization failed.',
            },
            400,
            request,
            true
          );
        }
        const githubToken = String(ghData.access_token).trim();
        const ghUser = await verifyGitHubTokenIdentity(githubToken);
        if (!ghUser.ok) {
          return jsonResponse(
            { ok: false, status: 'error', error: ghUser.error },
            400,
            request,
            true
          );
        }

        const preferredName = body.screenName ? sanitizeScreenName(body.screenName) : '';
        const resolvedName = await resolveScreenNameFromGitHub(
          env.TELEMETRY_KV,
          ghUser.githubUsername,
          ghUser.githubUserId,
          preferredName
        );
        let ownerAuth = await authenticateVaultOwner(
          request,
          env,
          env.TELEMETRY_KV,
          resolvedName,
          {
            screenName: resolvedName,
            githubToken,
          }
        );
        if (!ownerAuth.isOwner && body.unlockKey) {
          ownerAuth = await authenticateVaultOwner(
            request,
            env,
            env.TELEMETRY_KV,
            resolvedName,
            {
              ...body,
              screenName: resolvedName,
              githubToken,
            }
          );
        }

        if (!ownerAuth.isOwner) {
          // Mint a short-lived server-side pending link token so the GitHub OAuth access_token is never exposed to browser JS
          let pendingGhLinkToken = '';
          if (env.TELEMETRY_KV) {
            pendingGhLinkToken = `ghl_${generateSecureSaltHex(16)}`;
            await env.TELEMETRY_KV.put(
              `gh_pending_link/${pendingGhLinkToken}`,
              JSON.stringify({
                githubUsername: ghUser.githubUsername,
                githubUserId: ghUser.githubUserId,
                createdAt: new Date().toISOString(),
              }),
              { expirationTtl: 600 }
            );
          }
          return jsonResponse(
            {
              ok: false,
              status: 'error',
              githubUsername: ghUser.githubUsername,
              githubUserId: ghUser.githubUserId,
              pendingGhLinkToken,
              error:
                ownerAuth.error ||
                `GitHub account @${ghUser.githubUsername} is not linked to @${resolvedName} yet. Enter your Unlock Key once and click Verify Token to link them.`,
            },
            403,
            request,
            true
          );
        }

        const licInfo = ownerAuth.licenseInfo || { ...TIER_PRESETS.free, active: false };
        const authorizedPayload = {
          ok: true,
          status: 'authorized',
          isOwner: true,
          screenName: ownerAuth.screenName,
          githubUsername: ghUser.githubUsername,
          githubUserId: ghUser.githubUserId,
          sessionToken: ownerAuth.sessionToken,
          tier: licInfo.tier || 'free',
          active: Boolean(licInfo.active),
          everPaid: Boolean(licInfo.everPaid),
          signature: licInfo.signature || '',
          license: licInfo,
          limits: licInfo,
        };
        if (env.TELEMETRY_KV) {
          try {
            await env.TELEMETRY_KV.put(dcDoneKey, JSON.stringify(authorizedPayload), {
              expirationTtl: 180,
            });
          } catch (_) {}
        }
        const ghPollResp = jsonResponse(authorizedPayload, 200, request, true);
        if (ownerAuth.screenName && ownerAuth.sessionToken) {
          ghPollResp.headers.append(
            'Set-Cookie',
            `sspvp_vault_user=${encodeURIComponent(ownerAuth.screenName)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
          );
          ghPollResp.headers.append(
            'Set-Cookie',
            `sspvp_vault_session=${encodeURIComponent(ownerAuth.sessionToken)}; Domain=.silphscopepvp.com; Path=/; Max-Age=31536000; SameSite=Lax; Secure`
          );
        }
        return ghPollResp;
      } catch (e) {
        return jsonResponse(
          { ok: false, status: 'error', error: 'GitHub OAuth verification failed.' },
          500,
          request,
          true
        );
      }
    }

    // 7e. Update DVR Vault Visibility Settings (`POST /v1/replays/settings`)
    if (request.method === 'POST' && path === '/v1/replays/settings') {
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      let screenName = sanitizeScreenName(request.headers.get('X-Trainer-Screen-Name') || '');
      if (providedKey) {
        const auth = await verifyClientAuth(request, env, false, true);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        screenName = auth.screenName;
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName,
        body
      );
      if (!ownerAuth.isOwner) {
        return jsonResponse(
          { ok: false, error: 'Only the authenticated vault owner can change visibility settings.' },
          403,
          request,
          true
        );
      }

      const resolvedName = ownerAuth.screenName || screenName;
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, resolvedName);
      indexObj.settings = normalizeVaultSettings({
        ...indexObj.settings,
        ...(body.publicVisibility !== undefined ? { publicVisibility: body.publicVisibility } : {}),
        ...(body.hideNamesPublic !== undefined ? { hideNamesPublic: body.hideNamesPublic } : {}),
      });
      await saveUserReplayIndex(env.TELEMETRY_KV, resolvedName, indexObj);

      return jsonResponse(
        {
          ok: true,
          screenName: resolvedName,
          settings: indexObj.settings,
        },
        200,
        request,
        true
      );
    }

    // 8. List User's Cloud R2 Replays (`GET /v1/replays/list`) — Supports Owner Mode, Public Visitor Mode & `@Featured`
    if (request.method === 'GET' && (path === '/v1/replays/list' || path === '/v1/replays/featured')) {
      const auth = await verifyClientAuth(request, env, true, true);
      const rawUserParam =
        path === '/v1/replays/featured'
          ? 'Featured'
          : url.searchParams.get('user') || '';
      const isFeaturedQuery =
        rawUserParam.toLowerCase() === 'featured' || rawUserParam.toLowerCase() === '_featured';

      if (isFeaturedQuery) {
        const featIndex = await loadUserReplayIndex(env.TELEMETRY_KV, '_featured');
        const featItems = featIndex.items || [];
        return jsonResponse({
          ok: true,
          isOwner: false,
          canStar: false,
          screenName: 'Featured',
          visibility: 'all',
          settings: { publicVisibility: 'all', hideNamesPublic: false },
          hiddenRollingCount: 0,
          totalStarredCount: featItems.length,
          totalPublicCount: featItems.length,
          items: featItems.map((item) => ({
            ...item,
            isPinned: true,
            isPublic: true,
            shareUrl: `${url.origin}/watch/${item.shareId}`,
            videoStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/video.mp4`,
            traceStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/trace.jsonl`,
          })),
        });
      }

      const requestedUser = rawUserParam
        ? sanitizeScreenName(rawUserParam)
        : auth.ok && auth.screenName
        ? auth.screenName
        : sanitizeScreenName(
            request.headers.get('X-Trainer-Screen-Name') ||
              request.headers.get('X-SilphScope-Screen-Name') ||
              ''
          );

      if (!requestedUser || requestedUser === 'anonymous') {
        return jsonResponse({ ok: false, error: 'Please specify a Trainer ID.' }, 400, request, true);
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        requestedUser
      );

      if (ownerAuth.isOwner) {
        const resolvedName = ownerAuth.screenName || requestedUser;
        const licenseInfo = ownerAuth.licenseInfo || { ...TIER_PRESETS.free, active: false };
        const authRec = ownerAuth.authRecord || (await loadUserAuthRecord(env.TELEMETRY_KV, resolvedName));
        const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, resolvedName);
        const baseUsage = licenseInfo.active
          ? await enforceUserReplayQuota(
              env,
              env.TELEMETRY_KV,
              resolvedName,
              licenseInfo,
              indexObj
            )
          : {
              usedBytes: (indexObj.items || []).reduce((s, i) => s + (Number(i.totalBytes) || 0), 0),
              usedMb: Number(
                (
                  (indexObj.items || []).reduce((s, i) => s + (Number(i.totalBytes) || 0), 0) /
                  (1024 * 1024)
                ).toFixed(2)
              ),
              rollingCount: (indexObj.items || []).filter((i) => !i.isPinned).length,
              pinnedCount: (indexObj.items || []).filter((i) => i.isPinned).length,
            };
        const usage = {
          ...baseUsage,
          publicCount: (indexObj.items || []).filter((i) => Boolean(i.isPublic)).length,
        };
        await saveUserReplayIndex(env.TELEMETRY_KV, resolvedName, indexObj);

        const devHashHdr = (request.headers.get('X-Device-Hash') || '').trim();
        const deviceIngestToken = devHashHdr ? await computeDeviceIngestToken(env, devHashHdr) : '';
        return jsonResponse(
          {
            ok: true,
            isOwner: true,
            canStar: true,
            screenName: resolvedName,
            sessionToken: ownerAuth.sessionToken,
            deviceIngestToken,
            tier: licenseInfo.tier || 'free',
            active: Boolean(licenseInfo.active),
            hasPassword: Boolean(authRec && authRec.passwordHash),
            githubUsername:
              (authRec && authRec.githubUsername) || licenseInfo.boundGitHubUsername || '',
            settings: indexObj.settings,
            visibility: indexObj.settings.publicVisibility,
            limits: licenseInfo,
            usage,
            items: (indexObj.items || []).map((item) => ({
              ...item,
              isPinned: Boolean(item.isPinned),
              isPublic: Boolean(item.isPublic),
              shareUrl: `${url.origin}/watch/${item.shareId}`,
              videoStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/video.mp4`,
              traceStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/trace.jsonl`,
            })),
          },
          200,
          request,
          true
        );
      }

      // Public Visitor Mode (`isOwner === false`)
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, requestedUser);
      const vis = (indexObj.settings && indexObj.settings.publicVisibility) || 'public_only';
      if (vis === 'none' || vis === 'private') {
        return jsonResponse(
          {
            ok: false,
            isOwner: false,
            visibility: 'none',
            error: `Trainer @${requestedUser}'s DVR Replay Vault requires Owner Login (No videos shared without login). Click '🔐 Owner Login' if this is your vault.`,
          },
          403,
          request,
          true
        );
      }

      const allItems = indexObj.items || [];
      const starredItems = allItems.filter((i) => Boolean(i.isPinned));
      const publicItems = allItems.filter((i) => Boolean(i.isPublic));
      let visibleItems = publicItems;
      if (vis === 'all') {
        visibleItems = allItems;
      } else if (vis === 'starred_only') {
        visibleItems = starredItems;
      } else if (vis === 'starred_and_public' || vis === 'starred_and_private') {
        visibleItems = allItems.filter((i) => Boolean(i.isPinned) || Boolean(i.isPublic));
      } else {
        visibleItems = publicItems;
      }
      const hiddenRollingCount = Math.max(0, allItems.length - visibleItems.length);

      return jsonResponse(
        {
          ok: true,
          isOwner: false,
          canStar: false,
          screenName: indexObj.screenName || requestedUser,
          visibility: vis,
          settings: indexObj.settings,
          hiddenRollingCount,
          totalStarredCount: starredItems.length,
          totalPublicCount: publicItems.length,
          items: visibleItems.map((item) => ({
            ...item,
            isPinned: Boolean(item.isPinned),
            isPublic: Boolean(item.isPublic),
            shareUrl: `${url.origin}/watch/${item.shareId}`,
            videoStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/video.mp4`,
            traceStreamUrl: `${url.origin}/v1/replays/stream/${item.shareId}/trace.jsonl`,
          })),
        },
        200,
        request,
        true
      );
    }

    // 9. Star / Pin or Toggle Privacy on a Cloud Replay (`POST /v1/replays/pin`) — Strictly Owner-Only
    if (request.method === 'POST' && path === '/v1/replays/pin') {
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      let screenName = sanitizeScreenName(request.headers.get('X-Trainer-Screen-Name') || '');
      if (providedKey) {
        const auth = await verifyClientAuth(request, env, false, true);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        screenName = auth.screenName;
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName,
        body
      );
      if (!ownerAuth.isOwner) {
        return jsonResponse(
          {
            ok: false,
            error: 'Only the authenticated vault owner can star/unstar or modify replay visibility.',
          },
          403,
          request,
          true
        );
      }

      const resolvedName = ownerAuth.screenName || screenName;
      const licenseInfo = ownerAuth.licenseInfo || TIER_PRESETS.supporter;
      const targetBattleId = String(body.battleId || '').trim();
      const targetShareId = String(body.shareId || '').trim();
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, resolvedName);

      const item = (indexObj.items || []).find(
        (i) =>
          (targetBattleId && i.battleId === targetBattleId) ||
          (targetShareId && i.shareId === targetShareId)
      );
      if (!item) {
        return jsonResponse({ ok: false, error: 'Replay not found in Cloud Vault.' }, 404, request, true);
      }

      if (typeof body.isPinned === 'boolean') {
        if (body.isPinned && !item.isPinned) {
          const currentPinned = (indexObj.items || []).filter((i) => i.isPinned).length;
          const maxPins = Math.max(10, Number(licenseInfo.maxPinnedBattles) || 10);
          if (currentPinned >= maxPins) {
            return jsonResponse(
              {
                ok: false,
                error: `Star/Pin limit reached (${maxPins} starred battles max for ${licenseInfo.label || 'your tier'}).`,
              },
              400,
              request,
              true
            );
          }
        }
        item.isPinned = body.isPinned;
      }

      if (typeof body.isPublic === 'boolean') {
        item.isPublic = body.isPublic;
      }

      if (typeof body.hideNames === 'boolean') {
        item.hideNames = body.hideNames;
      }

      item.updatedAt = new Date().toISOString();
      await env.TELEMETRY_KV.put(`share_lookup/${item.shareId}`, JSON.stringify(item));
      await saveUserReplayIndex(env.TELEMETRY_KV, resolvedName, indexObj);

      return jsonResponse(
        {
          ok: true,
          battleId: item.battleId,
          shareId: item.shareId,
          isPinned: Boolean(item.isPinned),
          isPublic: Boolean(item.isPublic),
          hideNames: Boolean(item.hideNames),
          shareUrl: `${url.origin}/watch/${item.shareId}`,
        },
        200,
        request,
        true
      );
    }

    // 9b. Promote a Cloud Replay to Persistent `@Featured` Showcase (`POST /v1/replays/feature`) — Strictly Admin Owner
    if (request.method === 'POST' && path === '/v1/replays/feature') {
      const isAdminBearer = verifyAdminAuth(request, env).ok;
      let screenName = sanitizeScreenName(request.headers.get('X-Trainer-Screen-Name') || '');
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      if (!isAdminBearer && providedKey) {
        const auth = await verifyClientAuth(request, env, false, true);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        screenName = auth.screenName;
      }

      let body = {};
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, request, true);
      }

      if (!isAdminBearer) {
        const ownerAuth = await authenticateVaultOwner(
          request,
          env,
          env.TELEMETRY_KV,
          screenName,
          body
        );
        if (
          !ownerAuth.isOwner ||
          String(ownerAuth.screenName || screenName || '').toLowerCase() !== 'sportsfan986'
        ) {
          return jsonResponse(
            { ok: false, error: 'Only the official showcase admin (@sportsfan986) can promote featured replays.' },
            403,
            request,
            true
          );
        }
      }

      const result = await cloneReplayToFeatured(env, env.TELEMETRY_KV, store, body);
      if (!result.ok) {
        return jsonResponse(result, 400, request, true);
      }
      return jsonResponse(result, 200, request, true);
    }

    // 10. Delete a Cloud Replay (`DELETE` or `POST /v1/replays/delete`) — Strictly Owner-Only
    if ((request.method === 'DELETE' || request.method === 'POST') && path === '/v1/replays/delete') {
      const providedKey = (
        request.headers.get('X-SilphScope-Client-Key') ||
        request.headers.get('X-Device-Ingest-Token') ||
        ''
      ).trim();
      let screenName = sanitizeScreenName(request.headers.get('X-Trainer-Screen-Name') || '');
      if (providedKey) {
        const auth = await verifyClientAuth(request, env, false, true);
        if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status, request, true);
        screenName = auth.screenName;
      }

      let body = {};
      try {
        const ct = request.headers.get('content-type') || '';
        if (ct.includes('application/json') || request.method === 'POST') {
          body = await request.json();
        }
      } catch (_) {}

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName,
        body
      );
      if (!ownerAuth.isOwner) {
        return jsonResponse(
          { ok: false, error: 'Owner authentication required to delete replays.' },
          403,
          request,
          true
        );
      }

      const resolvedName = ownerAuth.screenName || screenName;
      const targetBattleId = String(url.searchParams.get('battleId') || body.battleId || '').trim();
      const targetShareId = String(url.searchParams.get('shareId') || body.shareId || '').trim();
      const indexObj = await loadUserReplayIndex(env.TELEMETRY_KV, resolvedName);
      const idx = (indexObj.items || []).findIndex(
        (i) =>
          (targetBattleId && i.battleId === targetBattleId) ||
          (targetShareId && i.shareId === targetShareId)
      );
      if (idx === -1) {
        return jsonResponse({ ok: false, error: 'Replay not found.' }, 404, request, true);
      }
      const [removed] = indexObj.items.splice(idx, 1);
      await deleteReplayObjects(env, env.TELEMETRY_KV, removed);
      await saveUserReplayIndex(env.TELEMETRY_KV, resolvedName, indexObj);

      return jsonResponse(
        { ok: true, deletedBattleId: removed.battleId, deletedShareId: removed.shareId },
        200,
        request,
        true
      );
    }

    // 11. Public Capability-URL Video & Trace Streaming (`GET /v1/replays/stream/:shareId/:asset`)
    if (request.method === 'GET' && path.startsWith('/v1/replays/stream/')) {
      const parts = path.split('/').filter(Boolean); // ['v1','replays','stream', shareId, asset]
      const shareId = sanitizeId(parts[3] || '');
      const asset = parts[4] || '';
      if (!shareId) {
        return jsonResponse({ ok: false, error: 'Invalid stream URL.' }, 404);
      }

      const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${shareId}`);
      if (!rawLookup) {
        return jsonResponse({ ok: false, error: 'Replay expired or not found.' }, 404);
      }
      const shareInfo = JSON.parse(rawLookup);

      if (asset === 'video.mp4') {
        const rangeHeader = request.headers.get('Range');
        if (env.REPLAY_BUCKET && shareInfo.videoKey) {
          if (rangeHeader && rangeHeader.startsWith('bytes=')) {
            const headObj = await env.REPLAY_BUCKET.head(shareInfo.videoKey);
            if (headObj) {
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
                headers: buildSecurityHeaders({
                  'Content-Type': 'video/mp4',
                  'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                  'Accept-Ranges': 'bytes',
                  'Content-Length': String(length),
                  'Cache-Control': 'public, max-age=86400',
                  'Access-Control-Allow-Origin': '*',
                }),
              });
            }
          } else {
            const fullObj = await env.REPLAY_BUCKET.get(shareInfo.videoKey);
            if (fullObj) {
              return new Response(fullObj.body, {
                status: 200,
                headers: buildSecurityHeaders({
                  'Content-Type': 'video/mp4',
                  'Accept-Ranges': 'bytes',
                  'Content-Length': String(fullObj.size),
                  'Cache-Control': 'public, max-age=86400',
                  'Access-Control-Allow-Origin': '*',
                }),
              });
            }
          }
        }

        // Fallback to TELEMETRY_KV store for diagnostic DVR videos if R2 object is missing
        if (shareInfo.fallbackKvVideoKey) {
          const kvBytes = await store.getBytes(shareInfo.fallbackKvVideoKey);
          if (kvBytes) {
            const u8 = new Uint8Array(kvBytes);
            return new Response(u8, {
              status: 200,
              headers: buildSecurityHeaders({
                'Content-Type': 'video/mp4',
                'Accept-Ranges': 'bytes',
                'Content-Length': String(u8.byteLength),
                'Cache-Control': 'public, max-age=86400',
                'Access-Control-Allow-Origin': '*',
              }),
            });
          }
        }
        return new Response('Video not found', { status: 404, headers: buildSecurityHeaders() });
      }

      if (asset === 'trace.jsonl') {
        if (!shareInfo.traceKey && !shareInfo.fallbackKvTraceKey) {
          return new Response('', { status: 200, headers: buildSecurityHeaders() });
        }
        let text = null;
        if (env.REPLAY_BUCKET && shareInfo.traceKey) {
          const traceObj = await env.REPLAY_BUCKET.get(shareInfo.traceKey);
          if (traceObj) {
            text = await traceObj.text();
          }
        }
        if (text === null && shareInfo.fallbackKvTraceKey) {
          text = await store.getText(shareInfo.fallbackKvTraceKey);
        }
        if (text === null) return new Response('', { status: 404, headers: buildSecurityHeaders() });
        if (
          (shareInfo.hideNames || url.searchParams.get('hideNames') === '1') &&
          shareInfo.screenName
        ) {
          const escapedName = String(shareInfo.screenName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (escapedName) {
            text = text.replace(new RegExp(escapedName, 'gi'), 'Trainer');
          }
        }
        return new Response(text, {
          status: 200,
          headers: buildSecurityHeaders({
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          }),
        });
      }
    }

    // 12. Public Web Share Player (`GET /watch/:shareId`)
    if (request.method === 'GET' && path.startsWith('/watch/')) {
      const shareId = sanitizeId(path.slice('/watch/'.length).split('/')[0] || '');
      if (!shareId) return new Response('Invalid Share Link', { status: 404, headers: buildSecurityHeaders() });
      const rawLookup = await env.TELEMETRY_KV.get(`share_lookup/${shareId}`);
      if (!rawLookup) {
        return new Response(
          `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SilphScope PvP • Replay Expired or Not Found</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #050b16;
      background-image:
        radial-gradient(circle at 18% 12%, rgba(45, 212, 191, 0.11) 0%, transparent 42%),
        radial-gradient(circle at 82% 18%, rgba(250, 204, 21, 0.08) 0%, transparent 38%),
        linear-gradient(180deg, #050b16 0%, #081120 55%, #050b16 100%);
      color: #ecfeff;
      box-sizing: border-box;
    }
    .card {
      background: #0e1b2e;
      border: 1px solid #19304e;
      border-radius: 16px;
      padding: 36px 28px;
      max-width: 520px;
      width: 100%;
      text-align: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 24px rgba(45, 212, 191, 0.12);
    }
    .badge-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #081120;
      border: 1.5px solid #2dd4bf;
      box-shadow: 0 0 18px rgba(45, 212, 191, 0.3);
      margin-bottom: 16px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 20px;
      font-weight: 900;
      color: #fff;
    }
    h2 span { color: #2dd4bf; }
    p {
      margin: 0 0 22px;
      font-size: 13.5px;
      color: #99f6e4;
      line-height: 1.5;
    }
    code {
      font-family: monospace;
      color: #facc15;
      background: #081120;
      padding: 2px 7px;
      border-radius: 6px;
      border: 1px solid #19304e;
    }
    .actions {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }
    a.btn {
      text-decoration: none;
      padding: 9px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 13px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    a.btn-primary {
      background: #2dd4bf;
      color: #042f2e;
      border: 1px solid #2dd4bf;
      box-shadow: 0 2px 10px rgba(45, 212, 191, 0.25);
    }
    a.btn-primary:hover {
      background: #5eead4;
      box-shadow: 0 0 16px rgba(45, 212, 191, 0.45);
    }
    a.btn-secondary {
      background: #081120;
      color: #ecfeff;
      border: 1px solid #19304e;
    }
    a.btn-secondary:hover {
      background: #14253e;
      border-color: #2dd4bf;
      color: #5eead4;
    }
  </style>
</head>
<body>
  <!-- Fixed Centered Shiny Origin Dialga Vector Watermark -->
  <div class="fixed-watermark-bg" aria-hidden="true">
    <svg viewBox="0 0 240 240" class="dialga-watermark-svg">
      <path fill="none" stroke="#2DD4BF" stroke-width="3" d="M120,10 L196,42 L228,120 L196,198 L120,230 L44,198 L12,120 L44,42 Z" />
      <path fill="none" stroke="#FACC15" stroke-width="4" d="M120,44 L178,76 L178,164 L120,196 L62,164 L62,76 Z" />
      <path fill="#FACC15" d="M62,76 L22,52 L48,92 Z M178,76 L218,52 L192,92 Z M56,120 L14,120 L56,132 Z M184,120 L226,120 L184,132 Z M62,164 L26,188 L54,148 Z M178,164 L214,188 L186,148 Z" />
      <path fill="#14B8A6" stroke="#67E8F9" stroke-width="2.5" d="M120,14 L138,48 L156,32 L144,76 L186,98 L152,134 L168,188 L142,174 L120,224 L98,174 L72,188 L88,134 L54,98 L96,76 L84,32 L102,48 Z" />
      <path fill="#081224" stroke="#FACC15" stroke-width="3" d="M120,84 L152,120 L120,156 L88,120 Z" />
      <path fill="#67E8F9" d="M120,96 L140,120 L120,144 L100,120 Z" />
    </svg>
  </div>
  <div class="card">
    <div class="badge-icon">
      <svg viewBox="0 0 36 36" style="width:32px;height:32px;display:block">
        <polygon points="18,2 31,9 31,27 18,34 5,27 5,9" fill="rgba(14, 27, 46, 0.9)" stroke="#2DD4BF" stroke-width="2.2" />
        <polygon points="18,7 26,12 26,24 18,29 10,24 10,12" fill="none" stroke="#FACC15" stroke-width="1.8" />
        <circle cx="18" cy="18" r="3.5" fill="#FACC15" />
      </svg>
    </div>
    <h2>SilphScope <span>PvP Replay</span></h2>
    <p>This replay link (<code>${escapeHtml(shareId)}</code>) has expired or was removed by the trainer.</p>
    <div class="actions">
      <a class="btn btn-primary" href="/vault">☁️ Open DVR Replay Vault</a>
      <a class="btn btn-secondary" href="https://silphscopepvp.com">🌐 SilphScopePvP.com</a>
    </div>
  </div>
</body>
</html>`,
          {
            status: 404,
            headers: buildSecurityHeaders({ 'Content-Type': 'text/html; charset=utf-8' }, true),
          }
        );
      }
      const shareInfo = JSON.parse(rawLookup);
      if (!shareInfo.userTier && shareInfo.screenName) {
        try {
          const tierSum = await resolveUserPaidTierSummary(env.TELEMETRY_KV, shareInfo.screenName);
          shareInfo.userTier = tierSum.tier;
          if (!shareInfo.userTierBadge) shareInfo.userTierBadge = tierSum.badge;
        } catch (_) {}
      }
      const isEmbedView = url.searchParams.get('embed') === '1';
      return new Response(renderWatchSharePage(url.origin, shareInfo, isEmbedView), {
        status: 200,
        headers: buildSecurityHeaders(
          {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
          true
        ),
      });
    }

    // 13. Admin Endpoints for PC Ingestion Script & Key Manager (`scripts/ingest-telemetry.mjs` & `scripts/manage-keys.mjs`)
    if (path.startsWith('/v1/admin/')) {
      const adminAuth = verifyAdminAuth(request, env);
      if (!adminAuth.ok) return jsonResponse({ ok: false, error: adminAuth.error }, adminAuth.status);

      if (request.method === 'GET' && path === '/v1/admin/keys') {
        let keys = null;
        try {
          const cachedRaw = await env.TELEMETRY_KV.get('licenses_manifest.json', { type: 'text' });
          if (cachedRaw) {
            keys = JSON.parse(cachedRaw);
          }
        } catch (_) {}

        if (!Array.isArray(keys)) {
          const listed = await env.TELEMETRY_KV.list({ prefix: 'licenses/' });
          keys = [];
          for (const k of listed.keys || []) {
            const raw = await env.TELEMETRY_KV.get(k.name);
            if (raw) {
              try {
                keys.push(JSON.parse(raw));
              } catch (_) {}
            }
          }
          try {
            await env.TELEMETRY_KV.put('licenses_manifest.json', JSON.stringify(keys, null, 2));
          } catch (_) {}
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
          const rawTier = String(body.tier || '').toLowerCase();
          const tier = ['supporter', 'base', 'pro', 'vip'].includes(rawTier)
            ? rawTier === 'base'
              ? 'supporter'
              : rawTier
            : 'pro';
          const preset = TIER_PRESETS[tier];
          const key = body.customKey ? String(body.customKey).trim().toUpperCase() : generateUnlockKey(tier);
          const boundScreenName = body.screenName ? sanitizeScreenName(body.screenName) : '';
          const days = Number(body.days) || (tier === 'supporter' ? 36500 : tier === 'vip' ? 95 : 95);
          const now = new Date();
          const expiresAt =
            tier === 'supporter' && !body.days
              ? null
              : new Date(now.getTime() + days * 24 * 3600 * 1000).toISOString();

          const record = {
            key,
            tier,
            label: preset.label,
            boundScreenName,
            everPaid: true,
            note: String(body.note || ''),
            createdAt: now.toISOString(),
            expiresAt,
            revoked: false,
            source: 'admin_cli',
          };
          await saveLicenseRecord(env.TELEMETRY_KV, record);
          ctx.waitUntil(
            sendTelegramMessage(
              env,
              `🛠️ <b>Admin Membership Key Created!</b>\n` +
                `🏅 <b>Paid Tier:</b> <code>${escapeHtml(preset.label)} (${tier.toUpperCase()})</code>\n` +
                `🔑 <b>Unlock Key:</b> <code>${escapeHtml(key)}</code>\n` +
                (boundScreenName ? `🎮 <b>Trainer ID:</b> <code>@${escapeHtml(boundScreenName)}</code>\n` : '') +
                `⏳ <b>Expires:</b> <code>${escapeHtml(expiresAt ? expiresAt.slice(0, 10) : 'LIFETIME')}</code>` +
                (record.note ? `\n💬 <b>Note:</b> ${escapeHtml(record.note)}` : '')
            )
          );
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
          if (action === 'extend') {
            ctx.waitUntil(
              sendTelegramMessage(
                env,
                `🔄 <b>Membership Renewed / Extended (Admin)!</b>\n` +
                  `🏅 <b>Paid Tier:</b> <code>${escapeHtml(existing.label || existing.tier)}</code>\n` +
                  `🔑 <b>Unlock Key:</b> <code>${escapeHtml(existing.key)}</code>\n` +
                  (existing.boundScreenName
                    ? `🎮 <b>Trainer ID:</b> <code>@${escapeHtml(existing.boundScreenName)}</code>\n`
                    : '') +
                  `⏳ <b>New Expiration:</b> <code>${escapeHtml(existing.expiresAt ? existing.expiresAt.slice(0, 10) : 'LIFETIME')}</code>`
              )
            );
          }
          return jsonResponse({ ok: true, action, license: existing });
        }

        if (action === 'rotate') {
          const targetKey = String(body.key || '').trim().toUpperCase();
          const existing = await loadLicenseByKey(env.TELEMETRY_KV, targetKey);
          if (!existing) {
            return jsonResponse({ ok: false, error: `Key not found: ${targetKey}` }, 404);
          }
          const tier = existing.tier || 'vip';
          const newKey = body.newKey
            ? String(body.newKey).trim().toUpperCase()
            : generateUnlockKey(tier);
          const nowIso = new Date().toISOString();

          const rotatedRecord = {
            ...existing,
            key: newKey,
            rotatedFrom: targetKey,
            rotatedAt: nowIso,
            revoked: false,
          };
          delete rotatedRecord.revokedAt;
          delete rotatedRecord.rotatedTo;

          existing.revoked = true;
          existing.revokedAt = nowIso;
          existing.rotatedTo = newKey;
          await env.TELEMETRY_KV.put(`licenses/${targetKey}`, JSON.stringify(existing, null, 2));
          await saveLicenseRecord(env.TELEMETRY_KV, rotatedRecord);

          if (rotatedRecord.boundScreenName) {
            const bName = rotatedRecord.boundScreenName;
            const regRaw = await env.TELEMETRY_KV.get(`registered_user/${bName.toLowerCase()}`, { type: 'text' });
            if (regRaw) {
              try {
                const regObj = JSON.parse(regRaw);
                regObj.boundKey = newKey;
                regObj.updatedAt = nowIso;
                await env.TELEMETRY_KV.put(`registered_user/${bName.toLowerCase()}`, JSON.stringify(regObj));
              } catch (_) {}
            }
            const authRec = await loadUserAuthRecord(env.TELEMETRY_KV, bName);
            if (authRec) {
              authRec.boundKey = newKey;
              authRec.sessionEpoch = (Number(authRec.sessionEpoch) || 1) + 1;
              await saveUserAuthRecord(env.TELEMETRY_KV, bName, authRec);
            }
          }

          return jsonResponse({
            ok: true,
            action: 'rotate',
            oldKey: targetKey,
            newKey,
            license: rotatedRecord,
          });
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
        try {
          const prefix = url.searchParams.get('prefix') || '';
          const cursor = url.searchParams.get('cursor') || undefined;
          const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);
          const listed = await store.list({ prefix, cursor, limit });
          return jsonResponse({
            ok: true,
            ...listed,
          });
        } catch (err) {
          return jsonResponse({
            ok: false,
            error: err.message || String(err),
            stack: err.stack || null,
          }, 500);
        }
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

      if (request.method === 'POST' && path === '/v1/admin/feature-replay') {
        let body = {};
        try {
          body = await request.json();
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }
        const result = await cloneReplayToFeatured(env, env.TELEMETRY_KV, store, body);
        if (!result.ok) {
          return jsonResponse(result, 400);
        }
        return jsonResponse(result);
      }

      if (request.method === 'POST' && path === '/v1/admin/notify-telegram') {
        let body = {};
        try {
          body = await request.json();
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }
        const htmlText = String(body.html || body.text || '').trim();
        if (!htmlText) {
          return jsonResponse({ ok: false, error: 'Missing `html` or `text` field.' }, 400);
        }
        const tgRes = await sendTelegramMessage(env, htmlText);
        return jsonResponse({ ok: Boolean(tgRes.ok), telegram: tgRes });
      }

      if (request.method === 'POST' && path === '/v1/admin/tuning-config') {
        let body = {};
        try {
          body = await request.json();
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }
        const payload = {
          updatedAt: new Date().toISOString(),
          targetVersion: String(body.targetVersion || '7.23'),
          tunedSettings: body.tunedSettings && typeof body.tunedSettings === 'object' ? body.tunedSettings : {},
          questions: Array.isArray(body.questions) ? body.questions.slice(0, 12) : [],
        };
        if (env.TELEMETRY_KV) {
          await env.TELEMETRY_KV.put('daily_tuning_config/latest', JSON.stringify(payload));
        }
        return jsonResponse({ ok: true, saved: payload });
      }

      // Admin D1 Passwordless User Vault Migration (`POST /v1/admin/sync/import`)
      if (request.method === 'POST' && path === '/v1/admin/sync/import') {
        if (!env.SYNC_DB) {
          return jsonResponse({ ok: false, error: 'SYNC_DB is not bound.' }, 500);
        }
        let body = {};
        try {
          body = await request.json();
        } catch (_) {
          return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }
        const targetUser = sanitizeScreenName(body.screenName || '');
        if (!targetUser) {
          return jsonResponse({ ok: false, error: 'Missing valid screenName' }, 400);
        }
        const res = await upsertVaultBatchIntoD1(env.SYNC_DB, targetUser, {
          settingsMap: body.userSettings || body.settings || null,
          settingsUpdatedAt: Number(body.settingsUpdatedAt) || 0,
          battleLogs: body.battleLogs || [],
          teamPresets: body.teamPresets || [],
          deletedLogIds: body.deletedLogIds || [],
          deletedTeamIds: body.deletedTeamIds || [],
          source: String(body.source || 'admin_migration'),
          migratedFromGithub: Boolean(body.migratedFromGithub ?? true),
        });
        return jsonResponse({ ok: true, screenName: targetUser, ...res });
      }

      // Admin Userbase-Wide Meta Analytics Summary (`GET /v1/admin/meta-summary`)
      if (request.method === 'GET' && path === '/v1/admin/meta-summary') {
        if (!env.SYNC_DB) {
          return jsonResponse({ ok: false, error: 'SYNC_DB is not bound.' }, 500);
        }
        const summary = await queryGlobalMetaSummaryFromD1(env.SYNC_DB, {
          league: url.searchParams.get('league') || '',
          seasonId: url.searchParams.get('seasonId') || '',
          combatMode: url.searchParams.get('combatMode') || '',
          sinceDays: Number(url.searchParams.get('sinceDays') || 0),
          topLimit: Number(url.searchParams.get('limit') || 40),
        });
        return jsonResponse({ ok: true, ...summary });
      }

      // Admin Userbase-Wide Raw / Incremental Battle Logs Export (`GET /v1/admin/battle-logs`)
      if (request.method === 'GET' && path === '/v1/admin/battle-logs') {
        if (!env.SYNC_DB) {
          return jsonResponse({ ok: false, error: 'SYNC_DB is not bound.' }, 500);
        }
        const filterUser = url.searchParams.get('user')
          ? sanitizeScreenName(url.searchParams.get('user'))
          : '';
        const filterLeague = (url.searchParams.get('league') || '').trim().toUpperCase();
        const filterSeason = (url.searchParams.get('seasonId') || '').trim();
        const sinceMs = Math.max(0, Number(url.searchParams.get('sinceMs') || 0) || 0);
        const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') || 500) || 500), 2000);
        const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);
        const includePayload = url.searchParams.get('includePayload') !== '0';
        const anonymize = url.searchParams.get('anonymize') === '1';

        const conds = ['deleted = 0'];
        const binds = [];
        if (filterUser) {
          binds.push(filterUser);
          conds.push(`screen_name = ?${binds.length}`);
        }
        if (filterLeague) {
          binds.push(filterLeague);
          conds.push(`league = ?${binds.length}`);
        }
        if (filterSeason) {
          binds.push(filterSeason);
          conds.push(`season_id = ?${binds.length}`);
        }
        if (sinceMs > 0) {
          binds.push(sinceMs);
          conds.push(`server_updated_ms > ?${binds.length}`);
        }

        const cols = includePayload
          ? `screen_name, log_id, season_id, league, combat_mode, result, lead_matchup,
             user_lead, user_back1, user_back2, opp_lead, opp_back1, opp_back2,
             first_swap_actor, switch_advantage, bmf_score, exec_wae,
             timestamp_ms, updated_at, server_updated_ms, source, payload_json`
          : `screen_name, log_id, season_id, league, combat_mode, result, lead_matchup,
             user_lead, user_back1, user_back2, opp_lead, opp_back1, opp_back2,
             first_swap_actor, switch_advantage, bmf_score, exec_wae,
             timestamp_ms, updated_at, server_updated_ms, source`;

        const sql = `SELECT ${cols} FROM battle_logs
                     WHERE ${conds.join(' AND ')}
                     ORDER BY server_updated_ms ASC, timestamp_ms ASC
                     LIMIT ${limit} OFFSET ${offset}`;

        const rowsRes = await env.SYNC_DB.prepare(sql).bind(...binds).all();
        const rows = rowsRes?.results || [];
        let maxServerUpdatedMs = sinceMs;
        const logs = rows.map((r) => {
          if (Number(r.server_updated_ms) > maxServerUpdatedMs) {
            maxServerUpdatedMs = Number(r.server_updated_ms);
          }
          let parsedPayload = undefined;
          if (includePayload && r.payload_json) {
            try {
              parsedPayload = JSON.parse(r.payload_json);
            } catch (_) {}
          }
          return {
            screenName: anonymize ? undefined : r.screen_name,
            logId: r.log_id,
            seasonId: r.season_id,
            league: r.league,
            combatMode: r.combat_mode,
            result: r.result,
            leadMatchup: r.lead_matchup,
            userTeam: [r.user_lead, r.user_back1, r.user_back2].filter(Boolean),
            opponents: [r.opp_lead, r.opp_back1, r.opp_back2].filter(Boolean),
            firstSwapActor: r.first_swap_actor,
            switchAdvantage: r.switch_advantage,
            bmfScore: r.bmf_score,
            execWae: r.exec_wae,
            timestampMs: r.timestamp_ms,
            updatedAt: r.updated_at,
            serverUpdatedMs: r.server_updated_ms,
            source: r.source,
            ...(includePayload ? { payload: parsedPayload } : {}),
          };
        });

        return jsonResponse({
          ok: true,
          count: logs.length,
          limit,
          offset,
          nextSinceMs: maxServerUpdatedMs,
          hasMore: logs.length === limit,
          logs,
        });
      }
    }

    return jsonResponse({ ok: false, error: `Route not found: ${request.method} ${path}` }, 404);
  },
};
