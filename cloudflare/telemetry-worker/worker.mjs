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
    return {
      backend: 'kv',
      async put(key, value, { contentType = 'application/octet-stream', metadata = {} } = {}) {
        const size =
          typeof value === 'string'
            ? new TextEncoder().encode(value).byteLength
            : value.byteLength || 0;
        const uploadedAt = metadata.uploadedAt || new Date().toISOString();
        await kv.put(key, value, {
          metadata: { ...metadata, contentType, size, uploadedAt },
        });
      },
      async getText(key) {
        return await kv.get(key, { type: 'text' });
      },
      async getResponse(key) {
        const { value, metadata } = await kv.getWithMetadata(key, { type: 'stream' });
        if (!value) return null;
        const headers = new Headers();
        headers.set(
          'Content-Type',
          (metadata && metadata.contentType) || 'application/octet-stream'
        );
        return new Response(value, { status: 200, headers });
      },
      async list({ prefix = '', cursor = undefined, limit = 500 } = {}) {
        const listed = await kv.list({ prefix, cursor, limit });
        return {
          objects: listed.keys.map((k) => ({
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
        await kv.delete(key);
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
            'Content-Type, Authorization, X-SilphScope-Client-Key, X-Trainer-Screen-Name',
        },
      });
    }

    const store = getStorageAdapter(env);

    // 1. Public Health Check
    if (request.method === 'GET' && path === '/v1/health') {
      return jsonResponse({
        ok: true,
        service: 'silphscope-telemetry-worker',
        version: env.WORKER_VERSION || '1.0.0',
        storageBackend: store.backend,
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

          if (env.TELEGRAM_NOTIFY_TELEMETRY_BATCHES === 'true' && anomalySummary) {
            const msg =
              `📊 <b>SilphScope Telemetry Batch</b>\n` +
              `👤 <b>Trainer:</b> <code>${escapeHtml(screenName)}</code>\n` +
              `📱 <b>Version:</b> <code>v${escapeHtml(appVersion)} (${versionCode})</code>\n` +
              `📦 <b>Battles:</b> ${recordCount}\n` +
              `⚠️ <b>Summary:</b> ${escapeHtml(anomalySummary)}`;
            await sendTelegramMessage(env, msg);
          }
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

      if (!videoBytes || videoBytes.byteLength === 0) {
        return jsonResponse({ ok: false, error: 'Missing DVR video payload.' }, 400);
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
      const matchupSummary = String(metadata.matchupSummary || '');
      const frameCount = Number(metadata.frameCount) || 0;

      const videoKey = `recordings/${screenName}/${battleId}_video.mp4`;
      const traceKey = `recordings/${screenName}/${battleId}_deep_trace.jsonl`;

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

      const writes = [
        store.put(videoKey, videoBytes, {
          contentType: 'video/mp4',
          metadata: storeMeta,
        }),
      ];

      if (deepTraceText && deepTraceText.trim().length > 0) {
        writes.push(
          store.put(traceKey, deepTraceText.trim() + '\n', {
            contentType: 'application/x-ndjson',
            metadata: storeMeta,
          })
        );
      }

      await Promise.all(writes);

      ctx.waitUntil(
        (async () => {
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
              videoKey,
              traceKey: deepTraceText ? traceKey : null,
              videoBytes: videoBytes.byteLength,
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

          const caption =
            `🎬 <b>SilphScope 1-Battle DVR</b>\n` +
            `👤 <b>Trainer:</b> <code>${escapeHtml(screenName)}</code>\n` +
            `🏆 <b>League:</b> ${escapeHtml(league)} (${escapeHtml(result)})\n` +
            (matchupSummary ? `⚔️ <b>Matchup:</b> ${escapeHtml(matchupSummary)}\n` : '') +
            `🎞️ <b>Frames:</b> ${frameCount} | <b>Size:</b> ${(videoBytes.byteLength / (1024 * 1024)).toFixed(2)} MB\n` +
            `📱 <b>App:</b> <code>v${escapeHtml(appVersion)} (${versionCode})</code>\n` +
            `🆔 <code>${escapeHtml(battleId)}</code>`;

          await sendTelegramVideo(env, videoBytes, `${screenName}_${battleId}.mp4`, caption);
        })()
      );

      return jsonResponse({
        ok: true,
        screenName,
        battleId,
        videoKey,
        traceKey: deepTraceText ? traceKey : null,
        videoBytes: videoBytes.byteLength,
      });
    }

    // 5. Admin Endpoints for PC Ingestion Script (`scripts/ingest-telemetry.mjs`)
    if (path.startsWith('/v1/admin/')) {
      const adminAuth = verifyAdminAuth(request, env);
      if (!adminAuth.ok) return jsonResponse({ ok: false, error: adminAuth.error }, adminAuth.status);

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
