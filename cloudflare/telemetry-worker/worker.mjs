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

async function verifyClientAuth(request, env, allowBlankScreenName = false, allowWebClientKey = false) {
  const expectedKey = (env.CLIENT_INGEST_KEY || '').trim();
  if (!expectedKey) {
    return { ok: false, status: 500, error: 'Worker CLIENT_INGEST_KEY secret is not configured.' };
  }
  const providedKey = (request.headers.get('X-SilphScope-Client-Key') || '').trim();
  const isValidPrimary = providedKey && timingSafeEqualStr(providedKey, expectedKey);
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

async function loadUserAuthRecord(kv, screenName) {
  if (!kv || !screenName) return null;
  const clean = sanitizeScreenName(screenName).toLowerCase();
  try {
    const raw = await kv.get(`user_auth/${clean}`, { type: 'text' });
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

async function saveUserAuthRecord(kv, screenName, authObj) {
  if (!kv || !screenName || !authObj) return;
  const clean = sanitizeScreenName(screenName);
  authObj.screenName = clean;
  authObj.updatedAt = new Date().toISOString();
  await kv.put(`user_auth/${clean.toLowerCase()}`, JSON.stringify(authObj, null, 2));
  if (authObj.githubUsername) {
    await kv.put(`gh_user_map/${String(authObj.githubUsername).toLowerCase()}`, clean);
  }
  if (authObj.githubUserId) {
    await kv.put(`gh_id_map/${String(authObj.githubUserId).trim()}`, clean);
  }
}

async function createVaultSessionToken(env, screenName, tier = 'free', ttlDays = 14, sessionEpoch = 1) {
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
        String(lic.boundDeviceHash).toLowerCase() === cleanDev);
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
    body.deviceHash || request.headers.get('X-Device-Hash') || ''
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
      const lic = mappedKey ? await loadLicenseByKey(kv, mappedKey) : null;
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
          14,
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
        14,
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
        14,
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
      14,
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
      --bg: #050b16;
      --card: #0e1b2e;
      --border: #19304e;
      --accent: #2dd4bf;
      --cyan: #67e8f9;
      --amber: #facc15;
      --rose: #f43f5e;
      --text: #ecfeff;
      --muted: #99f6e4;
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
      ${shareInfo.isPinned ? '<span class="badge" style="background:rgba(245,158,11,0.18);color:#fbbf24;border-color:rgba(245,158,11,0.45)">⭐ Starred</span>' : ''}
    </div>
    <div class="header-actions">
      <a class="btn-link" href="/vault?user=${encodeURIComponent(shareInfo.screenName || 'Featured')}">☁️ @${trainerDisplay}'s Vault</a>
      <button id="btn-privacy" onclick="togglePrivacy()">🕵️ ${hideNamesDefault ? 'Names Hidden' : 'Hide Names'}</button>
      <button id="btn-layout" onclick="toggleLayout()">📐 Side-by-Side: OFF</button>
      <button id="btn-export" onclick="exportWithHud()">💾 Export Video + HUD</button>
      <a class="btn-link" href="https://silphscopepvp.com/" target="_blank" rel="noopener">🌐 SilphScopePvP.com</a>
      <a class="btn-link" href="https://dl.silphscopepvp.com" target="_blank" rel="noopener">📱 Download APK</a>
    </div>
  </header>

  <main>
    <div style="font-size:13px;font-weight:700;color:#cbd5e1;text-align:center">${matchup}</div>
    ${
      shareInfo.userIssueNote
        ? `<div style="width:100%;max-width:860px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);border-radius:10px;padding:10px 14px;font-size:12.5px;color:#fef3c7;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px">
            <div>🚩 <strong>Reported Diagnostic Issue:</strong> ${escapeHtml(shareInfo.userIssueNote)}</div>
            ${shareInfo.userTierBadge ? `<span class="badge" style="background:rgba(168,85,247,0.2);color:#e9d5ff;border-color:rgba(168,85,247,0.45)">${escapeHtml(shareInfo.userTierBadge)}</span>` : ''}
          </div>`
        : ''
    }
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
          <button onclick="toggleShieldHud()" id="btn-shield-hud" class="${shareInfo.userTier && shareInfo.userTier !== 'free' ? 'active' : ''}">${shareInfo.userTier && shareInfo.userTier !== 'free' ? '🛡️ Shield: ON' : '🔒 Shield ($2 Supporter)'}</button>
          <button onclick="toggleHudPos()" id="btn-pos">⬆️ Pos: Top</button>
          <input type="range" id="hud-opacity" min="25" max="100" value="50" style="width:65px" title="HUD Opacity (50% Default)" oninput="updateOpacity(this.value)" />
        </div>
      </div>
      <div class="chips-row" id="event-chips"></div>
    </div>
  </main>

  <script>
    const TRACE_URL = ${safeJsonForScript(traceUrl)};
    const PVP_DB = ${safeJsonForScript(COMPACT_PVP_DB)};
    const SHARE_LEAGUE = ${safeJsonForScript(shareInfo.league || 'GREAT LEAGUE')};
    const SHARE_MATCHUP = ${safeJsonForScript(shareInfo.matchup || '')};
    const SHARE_USER_TIER = ${safeJsonForScript(shareInfo.userTier || 'pro')};
    const IS_SHIELD_HUD_UNLOCKED = SHARE_USER_TIER !== 'free';
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

      // v6.42 / v6.50: Reconstruct Shield Decision Overlay (Evaluates ALL possible legal moves until 2 locked + Overflow Guard)
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

    video.addEventListener('loadedmetadata', () => {
      recalcMp4TimeCompression();
      const dispDur = (video.duration || 0) * mp4TimeCompressionRatio;
      document.getElementById('time-readout').textContent = '0.0s / ' + dispDur.toFixed(1) + 's';
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
        recalcMp4TimeCompression();
        applyInitialUrlSeekIfNeeded();
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
        video.currentTime = jumpSec / mp4TimeCompressionRatio;
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
      --bg: #050b16;
      --card: #0e1b2e;
      --border: #19304e;
      --accent: #2dd4bf;
      --cyan: #67e8f9;
      --amber: #facc15;
      --rose: #f43f5e;
      --text: #ecfeff;
      --muted: #99f6e4;
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
      gap: 14px;
    }
    .login-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    input, select {
      background: #020617;
      color: var(--text);
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 9px 12px;
      font-size: 13px;
      flex: 1;
      min-width: 170px;
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
      transition: all 0.15s ease;
    }
    button.primary {
      background: #059669;
      border-color: #10b981;
    }
    button.tab-btn {
      background: #0f172a;
      color: #94a3b8;
      border: 1px solid #334155;
      padding: 7px 12px;
      font-size: 12px;
    }
    button.tab-btn.active {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      border-color: #10b981;
    }
    button:hover, .btn-link:hover {
      filter: brightness(1.12);
    }
    .stats-bar {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
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
      border-color: rgba(245, 158, 11, 0.65);
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.15);
    }
    .pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }
    .pill-win { background: rgba(16, 185, 129, 0.18); color: #34d399; }
    .pill-loss { background: rgba(244, 63, 94, 0.18); color: #fb7185; }
    .pill-star { background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🛡️ SilphScope PvP • Cloud DVR Replay Vault</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="document.getElementById('inp-user').value='Featured';loadVault()" style="background:rgba(250,204,21,0.16);border-color:#facc15;color:#fde047">🌟 Official Featured Showcase</button>
      <a class="btn-link" href="https://silphscopepvp.com/" target="_blank" rel="noopener">🌐 SilphScopePvP.com</a>
      <a class="btn-link" href="https://silphscopepvp.com/?view=app" target="_blank" rel="noopener">🧮 Web Battle Simulator</a>
      <a class="btn-link" href="https://dl.silphscopepvp.com" target="_blank" rel="noopener">📱 Download Android APK</a>
    </div>
  </header>

  <div class="container">
    <!-- Top Bar: Public Trainer Lookup + Owner Login Toggle -->
    <div class="login-card" style="justify-content:space-between">
      <div style="display:flex;gap:8px;flex:1;flex-wrap:wrap;align-items:center">
        <span style="font-size:13px;font-weight:800;color:#cbd5e1">👤 Trainer Vault:</span>
        <input id="inp-user" type="text" placeholder="Enter Trainer ID (or Featured)" style="max-width:260px" onkeydown="if(event.key==='Enter')loadVault()" />
        <button class="primary" onclick="loadVault()">👁️ View DVR Vault</button>
        <button onclick="document.getElementById('inp-user').value='Featured';loadVault()" style="border-color:#facc15;color:#fde047">🌟 @Featured</button>
        <button onclick="copyVaultShareUrl()" title="Copy link to this trainer's DVR page">🔗 Share Vault Page</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center" id="auth-header-controls">
        <button id="btn-toggle-login" onclick="toggleLoginPanel()" style="border-color:#38bdf8;color:#38bdf8">🔐 Owner Login</button>
        <button id="btn-logout" onclick="logoutVault()" style="display:none;border-color:#f43f5e;color:#fb7185">🚪 Log Out</button>
      </div>
    </div>

    <!-- Collapsible Owner Login Card (3 Methods: Username/Token, Username/Password, GitHub OAuth) -->
    <div class="login-card" id="owner-login-panel" style="display:none;flex-direction:column;align-items:stretch;gap:12px;border-color:#334155">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="tab-btn active" id="tab-token" onclick="setAuthTab('token')">🔑 Username + Token</button>
          <button class="tab-btn" id="tab-password" onclick="setAuthTab('password')">🔒 Username + Password</button>
          <button class="tab-btn" id="tab-github" onclick="setAuthTab('github')">🐙 GitHub Login</button>
        </div>
        <span style="font-size:11.5px;color:#94a3b8">Log in as the vault owner to view unstarred rolling battles, ⭐ Star/Pin battles, or change visibility.</span>
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
        <span style="font-size:11px;color:#94a3b8;width:100%">Tip: First log in with your Unlock Key or GitHub (or use the Android App Settings) to set your password.</span>
      </div>

      <!-- Tab 3: GitHub OAuth Device Flow / Token -->
      <div id="pane-github" style="display:none;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="primary" style="background:#24292f;border-color:#6e7681" onclick="startGitHubDeviceLogin()">🐙 1-Click Sign In with GitHub</button>
          <span style="font-size:12px;color:#94a3b8">or paste a GitHub token:</span>
          <input id="inp-gh-token" type="password" placeholder="gho_... / ghp_... (optional)" style="max-width:220px" />
          <button onclick="loginWithGitHubToken()">Verify Token</button>
        </div>
        <div id="gh-device-box" style="display:none;background:#020617;border:1px solid #38bdf8;border-radius:8px;padding:10px 14px;font-size:13px"></div>
      </div>
    </div>

    <!-- Set / Change Password Modal Box (Owner Only) -->
    <div class="login-card" id="password-setup-box" style="display:none;border-color:#f59e0b;background:rgba(15,23,42,0.95)">
      <strong style="font-size:13px;color:#fbbf24">🔒 Set / Update Password for @<span id="pw-target-user"></span>:</strong>
      <input id="inp-new-password" type="password" placeholder="New Password (min 8 characters)" style="max-width:240px" />
      <button class="primary" onclick="saveNewPassword()">💾 Save Password</button>
      <button onclick="document.getElementById('password-setup-box').style.display='none'">Cancel</button>
    </div>

    <div class="login-card" style="justify-content:space-between;background:rgba(15,23,42,0.65);font-size:12px;color:#cbd5e1">
      <div>
        <strong>⚡ Upgrade or Renew Season Pass:</strong>
        <span style="color:#94a3b8;margin-left:6px">First 14 days of GBL Season = Full Season ($6 Pro / $10 VIP). Day 15+ First-Time Promo = 1-Month Rate ($3 Pro / $5 VIP) for the entire remainder of the season!</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <a class="btn-link" style="background:#0284c7;border-color:#38bdf8" href="${STRIPE_PAYMENT_LINKS.supporter}" target="_blank" rel="noopener">🏅 Supporter ($2)</a>
        <a class="btn-link" style="background:#059669;border-color:#10b981" href="${STRIPE_PAYMENT_LINKS.pro_season}" target="_blank" rel="noopener">💳 Stripe Pro Pass</a>
        <a class="btn-link" style="background:#7c3aed;border-color:#a78bfa" href="${STRIPE_PAYMENT_LINKS.vip_season}" target="_blank" rel="noopener">👑 Stripe VIP Pass</a>
        <a class="btn-link" style="background:#d97706;border-color:#f59e0b" href="${BMC_LINKS.page}" target="_blank" rel="noopener">☕ Buy Me a Coffee</a>
      </div>
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

    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const pathUser = (pathParts[0] === 'u' || pathParts[0] === 'vault') && pathParts[1] ? decodeURIComponent(pathParts[1]) : '';
    const savedUser = params.get('user') || pathUser || localStorage.getItem('sspvp_vault_user') || '';
    const savedKey = params.get('key') || localStorage.getItem('sspvp_vault_key') || '';
    const savedEmail = params.get('email') || localStorage.getItem('sspvp_vault_email') || '';
    let sessionToken = localStorage.getItem('sspvp_vault_session') || '';
    let pendingGhLinkToken = '';
    let currentVaultData = null;
    let currentFilter = 'all'; // 'all' | 'starred'
    let ghPollTimer = null;
    let activeGhDeviceCode = '';
    let ghPollDelayMs = 6500;
    let lastGhPollMs = 0;

    // Clean up any legacy stored GitHub OAuth token from localStorage
    try { localStorage.removeItem('sspvp_github_token'); } catch (_) {}

    document.getElementById('inp-user').value = savedUser;
    document.getElementById('inp-key').value = savedKey;
    document.getElementById('inp-email').value = savedEmail;

    function toggleLoginPanel() {
      const el = document.getElementById('owner-login-panel');
      el.style.display = el.style.display === 'none' ? 'flex' : 'none';
    }

    function setAuthTab(tab) {
      ['token', 'password', 'github'].forEach(t => {
        document.getElementById('tab-' + t).classList.toggle('active', t === tab);
        document.getElementById('pane-' + t).style.display = t === tab ? 'flex' : 'none';
      });
    }

    function logoutVault() {
      sessionToken = '';
      pendingGhLinkToken = '';
      localStorage.removeItem('sspvp_vault_session');
      localStorage.removeItem('sspvp_vault_key');
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
      await performOwnerLogin({ screenName: user, unlockKey: key, claimEmail: email, pendingGhLinkToken });
    }

    async function loginWithPassword() {
      const user = document.getElementById('inp-user').value.trim();
      const password = document.getElementById('inp-password').value.trim();
      if (!user) return alert('Enter your Trainer ID first.');
      if (!password) return alert('Enter your Password.');
      await performOwnerLogin({ screenName: user, password, pendingGhLinkToken });
    }

    async function loginWithGitHubToken() {
      const user = document.getElementById('inp-user').value.trim();
      const githubToken = document.getElementById('inp-gh-token').value.trim();
      if (!githubToken && !pendingGhLinkToken) return alert('Paste a GitHub token or click 1-Click Sign In with GitHub.');
      const key = document.getElementById('inp-key').value.trim();
      await performOwnerLogin({ screenName: user, githubToken, pendingGhLinkToken, unlockKey: key });
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
        }
        if (payload.unlockKey) localStorage.setItem('sspvp_vault_key', payload.unlockKey);
        if (payload.claimEmail) localStorage.setItem('sspvp_vault_email', payload.claimEmail);
        document.getElementById('owner-login-panel').style.display = 'none';
        await loadVault();
      } catch (e) {
        alert('Login error: ' + e.message);
      }
    }

    async function pollGitHubDeviceNow(isManualClick) {
      if (!activeGhDeviceCode) return;
      const now = Date.now();
      if (!isManualClick && now - lastGhPollMs < 5200) return;
      lastGhPollMs = now;
      const statusEl = document.getElementById('gh-poll-status');
      if (statusEl && isManualClick) {
        statusEl.textContent = '🔄 Checking GitHub authorization status...';
      }
      try {
        const prefUser = document.getElementById('inp-user').value.trim();
        const key = document.getElementById('inp-key').value.trim();
        const pollRes = await fetch('/v1/auth/github/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-SilphScope-Client-Key': CLIENT_KEY },
          body: JSON.stringify({
            device_code: activeGhDeviceCode,
            screenName: prefUser,
            unlockKey: key
          })
        });
        const pollData = await pollRes.json();
        if (pollData.status === 'pending') {
          if (pollData.slowDown || pollData.interval) {
            ghPollDelayMs = (Math.max(10, Number(pollData.interval) || 10) + 2) * 1000;
          }
          if (statusEl && isManualClick) {
            statusEl.textContent = '⏳ Still waiting for authorization on GitHub. Make sure you clicked "Authorize" in the GitHub tab, then wait 5s and click Finish Sign-In again.';
          }
          if (activeGhDeviceCode) {
            if (ghPollTimer) clearTimeout(ghPollTimer);
            ghPollTimer = setTimeout(() => pollGitHubDeviceNow(false), ghPollDelayMs);
          }
          return;
        }
        if (ghPollTimer) clearTimeout(ghPollTimer);
        ghPollTimer = null;
        activeGhDeviceCode = '';
        const box = document.getElementById('gh-device-box');
        if (pollData.pendingGhLinkToken) {
          pendingGhLinkToken = pollData.pendingGhLinkToken;
        }
        if (pollData.ok && pollData.sessionToken) {
          sessionToken = pollData.sessionToken;
          localStorage.setItem('sspvp_vault_session', sessionToken);
          if (pollData.screenName) {
            document.getElementById('inp-user').value = pollData.screenName;
            localStorage.setItem('sspvp_vault_user', pollData.screenName);
          }
          if (box) box.style.display = 'none';
          document.getElementById('owner-login-panel').style.display = 'none';
          await loadVault();
        } else if (box) {
          box.innerHTML = '<span style="color:#fb7185">' + esc(pollData.error || 'GitHub login did not match an account.') + '</span>';
        }
      } catch (_) {
        if (activeGhDeviceCode) {
          if (ghPollTimer) clearTimeout(ghPollTimer);
          ghPollTimer = setTimeout(() => pollGitHubDeviceNow(false), ghPollDelayMs);
        }
      }
    }

    window.addEventListener('focus', () => {
      if (activeGhDeviceCode) {
        const elapsed = Date.now() - lastGhPollMs;
        const waitMs = Math.max(400, 5500 - elapsed);
        if (ghPollTimer) clearTimeout(ghPollTimer);
        ghPollTimer = setTimeout(() => pollGitHubDeviceNow(false), waitMs);
      }
    });

    async function startGitHubDeviceLogin() {
      const box = document.getElementById('gh-device-box');
      box.style.display = 'block';
      box.textContent = '⏳ Requesting GitHub Device Code...';
      if (ghPollTimer) clearTimeout(ghPollTimer);
      activeGhDeviceCode = '';
      try {
        const res = await fetch('/v1/auth/github/device-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-SilphScope-Client-Key': CLIENT_KEY }
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          box.innerHTML = '<span style="color:#fb7185">' + esc(data.error || 'Failed to start GitHub login.') + '</span>';
          return;
        }
        activeGhDeviceCode = data.device_code;
        ghPollDelayMs = (Math.max(5, Number(data.interval) || 5) + 1.5) * 1000;
        lastGhPollMs = Date.now();
        const safeUri = /^https:\\/\\/github\\.com\\//i.test(String(data.verification_uri || ''))
          ? data.verification_uri
          : 'https://github.com/login/device';
        box.innerHTML =
          '<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px">' +
            '<div>1. Copy one-time code: <strong style="font-size:16px;color:#38bdf8;letter-spacing:1px;padding:2px 8px;background:#0f172a;border-radius:6px">' + esc(data.user_code) + '</strong></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<a class="btn-link" style="background:#059669;border-color:#10b981" href="' + esc(safeUri) + '" target="_blank" rel="noopener">2. Open GitHub & Authorize ↗</a>' +
              '<button onclick="pollGitHubDeviceNow(true)" style="background:#0284c7;border-color:#38bdf8;color:#fff">✅ 3. I\\'ve Authorized — Finish Sign-In</button>' +
            '</div>' +
          '</div>' +
          '<div style="margin-top:6px;font-size:11.5px;color:#94a3b8" id="gh-poll-status">Waiting for authorization on GitHub (auto-unlocks when you return to this tab)...</div>';
        try { navigator.clipboard.writeText(data.user_code); } catch (_) {}
        window.open(safeUri, '_blank', 'noopener');

        ghPollTimer = setTimeout(() => pollGitHubDeviceNow(false), ghPollDelayMs);
      } catch (e) {
        box.innerHTML = '<span style="color:#fb7185">Error: ' + esc(e.message) + '</span>';
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
          '<div style="color:#94a3b8;padding:24px;grid-column:1/-1;text-align:center;background:#0f172a;border:1px solid #1e293b;border-radius:12px">' +
            '<div style="font-size:15px;font-weight:800;color:#f8fafc;margin-bottom:6px">🔍 Enter a Trainer ID above to view their Public DVR Replay Vault</div>' +
            '<div style="font-size:12.5px;color:#94a3b8">Starred replays are viewable by anyone by default, or click <strong>🔐 Owner Login</strong> to sign in with your Token, Password, or GitHub account.</div>' +
          '</div>';
        return;
      }
      localStorage.setItem('sspvp_vault_user', user);
      if (key) localStorage.setItem('sspvp_vault_key', key);
      if (email) localStorage.setItem('sspvp_vault_email', email);

      const grid = document.getElementById('replays-grid');
      grid.innerHTML = '<div style="color:#94a3b8;padding:20px">Loading Cloud Replay Vault for @' + esc(user) + '...</div>';

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
          grid.innerHTML = '<div style="color:#fb7185;padding:20px;grid-column:1/-1;background:#0f172a;border:1px solid #334155;border-radius:12px">' + esc(data.error || 'Failed to load vault') + '</div>';
          return;
        }

        currentVaultData = data;
        if (data.sessionToken) {
          sessionToken = data.sessionToken;
          localStorage.setItem('sspvp_vault_session', sessionToken);
        }

        const isOwner = Boolean(data.isOwner);
        document.getElementById('btn-logout').style.display = isOwner ? 'inline-flex' : 'none';
        document.getElementById('btn-toggle-login').textContent = isOwner ? '⚙️ Account / Login' : '🔐 Owner Login';

        const sb = document.getElementById('stats-bar');
        sb.style.display = 'flex';
        const lim = data.limits || {};
        const usg = data.usage || {};
        const vis = (data.settings && data.settings.publicVisibility) || data.visibility || 'public_only';

        if (isOwner) {
          const ghBadge = data.githubUsername
            ? '<span style="color:#34d399;font-size:12px">🐙 GitHub: @' + esc(data.githubUsername) + '</span>'
            : '<button onclick="toggleLoginPanel();setAuthTab(\\'github\\')" style="padding:4px 9px;font-size:11.5px">🐙 Link GitHub</button>';
          const pwBtn = '<button onclick="openPasswordSetup()" style="padding:4px 9px;font-size:11.5px">' + (data.hasPassword ? '🔒 Change Password' : '🔒 Set Password') + '</button>';

          sb.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
              '<div><strong>👤 @' + esc(data.screenName) + ' (Owner)</strong> • <span style="color:#38bdf8;font-weight:700">' + esc(lim.label || (data.tier || 'FREE').toUpperCase()) + '</span></div>' +
              '<div style="color:#cbd5e1">☁️ Storage: <strong>' + esc(usg.usedMb || 0) + ' MB</strong> / ' + esc(lim.maxStorageMb || 0) + ' MB • Rolling: <strong>' + esc(usg.rollingCount || 0) + '/' + esc(lim.maxRollingBattles || 0) + '</strong> • ⭐ Starred: <strong>' + esc(usg.pinnedCount || 0) + '/' + esc(lim.maxPinnedBattles || 0) + '</strong> • 🌐 Public: <strong>' + esc(usg.publicCount || 0) + '</strong></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:8px;border-top:1px solid #1e293b">' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                '<span style="font-size:12px;color:#94a3b8;font-weight:700">🌐 Public Vault Visibility:</span>' +
                '<select onchange="updateVaultVisibility(this.value)" style="min-width:265px;padding:5px 10px;font-size:12px">' +
                  '<option value="public_only"' + (vis === 'public_only' ? ' selected' : '') + '>🔒 Private (Only shows ones manually made public)</option>' +
                  '<option value="starred_only"' + (vis === 'starred_only' ? ' selected' : '') + '>⭐ Starred only</option>' +
                  '<option value="starred_and_public"' + (vis === 'starred_and_public' || vis === 'starred_and_private' ? ' selected' : '') + '>⭐+🌐 Starred + Private (Starred or manually made public)</option>' +
                  '<option value="all"' + (vis === 'all' ? ' selected' : '') + '>🌐 All videos shared (Overrides per-video private)</option>' +
                  '<option value="none"' + (vis === 'none' || vis === 'private' ? ' selected' : '') + '>🚫 No videos shared without login</option>' +
                '</select>' +
                '<span style="font-size:11px;color:#64748b">(All videos default to 🔒 Private unless toggled 🌐 Public or overridden)</span>' +
              '</div>' +
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + pwBtn + ghBadge + '</div>' +
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
              '<div><strong>👤 @' + esc(data.screenName) + '</strong> • <span style="color:#fbbf24;font-weight:700">' + visLabel + '</span>' + hiddenNote + '</div>' +
              '<button onclick="toggleLoginPanel()" style="padding:5px 10px;font-size:11.5px;border-color:#38bdf8;color:#38bdf8">🔐 Are you @' + esc(data.screenName) + '? Log In to Manage & Star</button>' +
            '</div>';
        }

        renderReplayGrid();
      } catch (e) {
        grid.innerHTML = '<div style="color:#fb7185;padding:20px">Error: ' + esc(e.message) + '</div>';
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
        grid.innerHTML = '<div style="color:#94a3b8;padding:20px;grid-column:1/-1">' + emptyMsg + '</div>';
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
          ? '<button onclick="togglePin(\\'' + safeBattleIdJs + '\\', ' + (!item.isPinned) + ')" style="padding:7px 10px;font-size:12px;border-color:' + (item.isPinned ? '#f59e0b' : '#334155') + ';color:' + (item.isPinned ? '#fbbf24' : '#e2e8f0') + '" title="Starred replays are kept for 365 days">' + (item.isPinned ? '⭐ Starred' : '☆ Star') + '</button>'
          : '<button disabled style="padding:7px 10px;font-size:12px;opacity:0.85;cursor:default;border-color:' + (item.isPinned ? '#f59e0b' : '#334155') + ';color:' + (item.isPinned ? '#fbbf24' : '#94a3b8') + '">' + (item.isPinned ? '⭐ Starred' : '☆ Star') + '</button>';
        const pubControl = isOwner
          ? '<button onclick="toggleVideoPublic(\\'' + safeBattleIdJs + '\\', ' + (!isPub) + ')" style="padding:7px 10px;font-size:12px;border-color:' + (isPub ? '#38bdf8' : '#334155') + ';color:' + (isPub ? '#38bdf8' : '#94a3b8') + ';background:' + (isPub ? 'rgba(56,189,248,0.12)' : '#1e293b') + '" title="' + (isOverriddenPublic ? 'Per-video setting is Private (currently overridden because Vault Visibility is set to All Videos Shared)' : 'Toggle whether this video is Public or Private (Default: Private)') + '">' + (isPub ? '🌐 Public' : (isOverriddenPublic ? '🔒 Private (All)' : '🔒 Private')) + '</button>'
          : '<button disabled style="padding:7px 10px;font-size:12px;opacity:0.85;cursor:default;border-color:' + (isPub || isOverriddenPublic ? '#38bdf8' : '#334155') + ';color:' + (isPub || isOverriddenPublic ? '#38bdf8' : '#94a3b8') + '">' + (isPub ? '🌐 Public' : (isOverriddenPublic ? '🌐 Shared (All)' : '🔒 Private')) + '</button>';
        const isAdminOwner = isOwner && String(currentVaultData.screenName || '').toLowerCase() === 'sportsfan986';
        const featControl = isAdminOwner
          ? '<button onclick="promoteToFeatured(\\'' + safeShareIdJs + '\\')" style="padding:7px 10px;font-size:12px;border-color:' + (item.featuredShareId ? '#facc15' : '#2dd4bf') + ';color:' + (item.featuredShareId ? '#fde047' : '#2dd4bf') + ';background:rgba(45,212,191,0.12)" title="Clone this battle into persistent @Featured Official Showcase storage">' + (item.featuredShareId ? '🌟 Featured (' + esc(item.featuredShareId) + ')' : '🌟 Promote to Featured') + '</button>'
          : '';
        return '<div class="replay-card ' + (item.isPinned ? 'pinned' : '') + '">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">' +
            '<span class="pill ' + (isWin ? 'pill-win' : 'pill-loss') + '">' + esc(item.result || 'BATTLE') + ' • ' + esc(item.league || 'GBL') + '</span>' +
            '<span style="font-size:11px;color:#94a3b8">' + esc(mb) + ' MB • ' + esc(Number(item.durationSec) || 0) + 's</span>' +
          '</div>' +
          '<div style="font-weight:800;font-size:13.5px;color:#f1f5f9">' + esc(item.showcaseTitle || item.matchupSummary || item.battleId) + '</div>' +
          '<div style="font-size:11px;color:#64748b">' + esc(dateStr) + ' • ID: ' + esc(item.battleId) + (highlightSecNum ? ' • ⚡ Highlight @ ' + highlightSecNum + 's' : '') + '</div>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center">' +
            '<a class="btn-link" style="background:#059669;border-color:#10b981;padding:7px 10px;font-size:12px;flex:1;justify-content:center" href="' + safeShareUrl + '">▶️ Watch + HUD</a>' +
            (highlightSecNum ? '<a class="btn-link" style="background:rgba(250,204,21,0.18);border-color:#facc15;color:#fde047;padding:7px 10px;font-size:12px" href="' + safeShareUrl + '?t=' + highlightSecNum + '" title="Jump directly to the key highlight moment">⚡ Key Moment (' + highlightSecNum + 's)</a>' : '') +
            starControl +
            pubControl +
            featControl +
            '<button onclick="copyLink(\\'' + safeShareUrlJs + '\\')" style="padding:7px 10px;font-size:12px" title="Anyone with this direct link can watch this replay">🔗 Copy Link</button>' +
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
      navigator.clipboard.writeText(url);
      alert('Copied Direct Share URL (viewable by anyone with the link): ' + url);
    }

    if (savedUser) {
      loadVault();
    } else {
      document.getElementById('inp-user').value = 'Featured';
      loadVault();
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
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers':
            'Content-Type, Authorization, X-SilphScope-Client-Key, X-Trainer-Screen-Name, X-SilphScope-Unlock-Key, X-Vault-Session, X-Vault-Password, X-GitHub-Token, X-Device-Hash, X-Claim-Email, X-GitHub-Username, X-GitHub-User-Id, Range',
          'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
        }),
      });
    }

    const store = getStorageAdapter(env);

    // 0a. Instant 1-Click APK Download Subdomain (`dl.silphscopepvp.com` or `/download` / `/apk`)
    const isGetOrHead = request.method === 'GET' || request.method === 'HEAD';
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
      const secHeaders = buildSecurityHeaders({}, isHtmlRoute);
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
          version: env.WORKER_VERSION || '7.1.3',
          timestamp: new Date().toISOString(),
        });
      }
      const r2Stats = await getGlobalR2Stats(env.TELEMETRY_KV);
      const maxGb = Number(env.GLOBAL_MAX_R2_STORAGE_GB) || 9.0;
      return jsonResponse({
        ok: true,
        service: 'silphscope-telemetry-worker',
        version: env.WORKER_VERSION || '7.1.3',
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
      if (jsonlPayload.length > 1024 * 1024) {
        return jsonResponse({ ok: false, error: 'Telemetry batch exceeds 1 MiB limit.' }, 413);
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
      if (jsonlPayload.length > 256 * 1024) {
        return jsonResponse({ ok: false, error: 'Settings payload exceeds 256 KiB limit.' }, 413);
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

        const MAX_VIDEO_BYTES = 36 * 1024 * 1024;
        const MAX_TRACE_BYTES = 3 * 1024 * 1024;

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
              return jsonResponse({ ok: false, error: 'DVR video exceeds 36 MiB limit.' }, 413);
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
              return jsonResponse({ ok: false, error: 'DVR video payload exceeds 36 MiB limit.' }, 413);
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
          return jsonResponse({ ok: false, error: 'DVR video exceeds 36 MiB limit.' }, 413);
        }
        if (deepTraceText && deepTraceText.length > MAX_TRACE_BYTES) {
          return jsonResponse({ ok: false, error: 'DVR trace exceeds 3 MiB limit.' }, 413);
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

        if (isFlaggedWithIssueDescription && hasVideo && env.TELEMETRY_KV) {
          try {
            diagShareId =
              canUpdateExisting && existingItem && existingItem.shareId
                ? existingItem.shareId
                : generateShareId();
            diagWatchOverlayUrl = `${url.origin}/watch/${diagShareId}`;

            let r2VideoKey = videoKey;
            let r2TraceKey = hasTrace ? traceKey : null;
            if (env.REPLAY_BUCKET) {
              // Store diagnostic R2 objects under a dedicated recordings/ prefix unless caller is verified owner
              const r2Prefix = ownerAuth.isOwner ? `replays/${screenName}` : `recordings/${screenName}`;
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

            const diagShareRecord = {
              battleId,
              shareId: diagShareId,
              screenName,
              videoKey: r2VideoKey,
              fallbackKvVideoKey: videoKey,
              traceKey: r2TraceKey,
              fallbackKvTraceKey: hasTrace ? traceKey : null,
              videoBytes: videoByteLen,
              traceBytes: hasTrace ? new TextEncoder().encode(deepTraceText).byteLength : 0,
              totalBytes: videoByteLen,
              league,
              result,
              matchupSummary,
              frameCount,
              durationSec: Math.max(1, Math.round(frameCount / 10)),
              appVersion,
              userIssueNote: userIssueNoteClean,
              userTier: resolvedUserTier,
              userTierBadge: tierSummary.badge,
              isPinned: Boolean(canUpdateExisting && existingItem && existingItem.isPinned),
              isPublic: Boolean(canUpdateExisting && existingItem && existingItem.isPublic),
              hideNames: Boolean(canUpdateExisting && existingItem && existingItem.hideNames),
              createdAt:
                canUpdateExisting && existingItem && existingItem.createdAt
                  ? existingItem.createdAt
                  : now.toISOString(),
              uploadedAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
            await env.TELEMETRY_KV.put(`share_lookup/${diagShareId}`, JSON.stringify(diagShareRecord));
          } catch (e) {
            console.error('Diag share link creation error:', e);
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

        const MAX_VIDEO_BYTES = 36 * 1024 * 1024;
        const MAX_TRACE_BYTES = 3 * 1024 * 1024;

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
              return jsonResponse({ ok: false, error: 'Replay video exceeds 36 MiB limit.' }, 413);
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
              return jsonResponse({ ok: false, error: 'Replay video payload exceeds 36 MiB limit.' }, 413);
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
          return jsonResponse({ ok: false, error: 'Replay video exceeds 36 MiB limit.' }, 413);
        }
        if (deepTraceText && deepTraceText.length > MAX_TRACE_BYTES) {
          return jsonResponse({ ok: false, error: 'Replay trace exceeds 3 MiB limit.' }, 413);
        }

        const inputKey = String(
          metadata.unlockKey || request.headers.get('X-SilphScope-Unlock-Key') || ''
        ).trim();
        const devHash = String(
          metadata.deviceHash || request.headers.get('X-Device-Hash') || ''
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

      return jsonResponse(
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
        // Only allow first-time password creation without ownerAuth if caller proves ownership via previously registered non-web deviceHash
        const chk = await checkScreenNameRegistration(env.TELEMETRY_KV, targetName, devHash, '');
        if (chk.ownedByCaller) {
          authorizedToSet = true;
        }
      }

      if (!authorizedToSet) {
        return jsonResponse(
          {
            ok: false,
            error:
              'Authenticate with your Unlock Key, GitHub account, or current password before setting or changing your password.',
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
        updatedAuth.sessionEpoch
      );
      return jsonResponse(
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
      try {
        const ghRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SilphScope-PvP-Worker/7.13',
          },
          body:
            `client_id=${encodeURIComponent(GITHUB_OAUTH_CLIENT_ID)}` +
            `&device_code=${encodeURIComponent(deviceCode)}` +
            `&grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code`,
        });
        const ghData = await ghRes.json();
        if (ghData.error === 'authorization_pending') {
          return jsonResponse(
            { ok: true, status: 'pending', interval: Number(ghData.interval) || 5 },
            200,
            request,
            true
          );
        }
        if (ghData.error === 'slow_down') {
          return jsonResponse(
            {
              ok: true,
              status: 'pending',
              slowDown: true,
              interval: Number(ghData.interval) || 10,
            },
            200,
            request,
            true
          );
        }
        if (!ghData.access_token) {
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
        return jsonResponse(
          {
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
          },
          200,
          request,
          true
        );
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

    // 10. Delete a Cloud Replay (`DELETE /v1/replays/delete`) — Strictly Owner-Only
    if (request.method === 'DELETE' && path === '/v1/replays/delete') {
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

      const ownerAuth = await authenticateVaultOwner(
        request,
        env,
        env.TELEMETRY_KV,
        screenName
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
      const targetBattleId = url.searchParams.get('battleId') || '';
      const targetShareId = url.searchParams.get('shareId') || '';
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
          `<!DOCTYPE html><html><body style="background:#070b14;color:#f8fafc;font-family:sans-serif;padding:40px;text-align:center"><h2>🛡️ SilphScope PvP Replay Expired or Not Found</h2><p>This replay link (<code>${escapeHtml(shareId)}</code>) has expired or was removed by the trainer.</p></body></html>`,
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
      return new Response(renderWatchSharePage(url.origin, shareInfo), {
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
    }

    return jsonResponse({ ok: false, error: `Route not found: ${request.method} ${path}` }, 404);
  },
};
