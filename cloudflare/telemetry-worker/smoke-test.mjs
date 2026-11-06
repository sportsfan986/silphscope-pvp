#!/usr/bin/env node
/**
 * End-to-End Smoke Test for the SilphScope Cloudflare Telemetry + Telegram Worker.
 *
 * Usage:
 *   node cloudflare/telemetry-worker/smoke-test.mjs <WORKER_URL> <CLIENT_INGEST_KEY> [ADMIN_API_KEY]
 */

const [workerUrlRaw, clientKey, adminKey] = process.argv.slice(2);

if (!workerUrlRaw || !clientKey) {
  console.error(
    'Usage: node cloudflare/telemetry-worker/smoke-test.mjs <WORKER_URL> <CLIENT_INGEST_KEY> [ADMIN_API_KEY]'
  );
  process.exit(1);
}

const workerUrl = workerUrlRaw.replace(/\/+$/, '');
const testScreenName = 'SmokeTestTrainer';

async function run() {
  console.log(`1. Checking /v1/health on ${workerUrl} ...`);
  const healthRes = await fetch(`${workerUrl}/v1/health`);
  const health = await healthRes.json();
  console.log('   Health:', JSON.stringify(health));
  if (!health.ok) {
    throw new Error('Health check failed');
  }

  console.log('\n2. Testing Always-On Lower-Res Telemetry upload (POST /v1/telemetry) ...');
  const sampleRecord = {
    schema: 'silphscope.ai_telemetry.v510',
    battleId: `smoke_${Date.now()}`,
    timestamp: Date.now(),
    githubUser: testScreenName,
    appVersion: '6.26',
    versionCode: 1626,
    league: 'Great League',
    result: 'WIN',
  };
  const telemetryRes = await fetch(`${workerUrl}/v1/telemetry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SilphScope-Client-Key': clientKey,
      'X-Trainer-Screen-Name': testScreenName,
    },
    body: JSON.stringify({
      batchId: `smoke_batch_${Date.now()}`,
      recordCount: 1,
      appVersion: '6.26',
      versionCode: 1626,
      deviceId: 'smoke_pc',
      anomalySummary: 'Smoke test verify Cloudflare R2 + Telegram pipeline',
      jsonl: JSON.stringify(sampleRecord),
    }),
  });
  const telemetryJson = await telemetryRes.json();
  console.log('   Telemetry response:', JSON.stringify(telemetryJson));
  if (!telemetryJson.ok) {
    throw new Error(`Telemetry upload failed: ${JSON.stringify(telemetryJson)}`);
  }

  if (adminKey) {
    console.log('\n3. Testing Admin Manifest & Object Listing (GET /v1/admin/manifest) ...');
    const manifestRes = await fetch(`${workerUrl}/v1/admin/manifest`, {
      headers: { Authorization: `Bearer ${adminKey}` },
    });
    const manifestJson = await manifestRes.json();
    console.log(
      `   Manifest: totalBatches=${manifestJson.totalBatches}, totalRecords=${manifestJson.totalRecords}, users=${Object.keys(manifestJson.users || {}).join(', ')}`
    );
  }

  console.log('\n✅ Smoke test passed!');
}

run().catch((err) => {
  console.error('\n❌ Smoke test failed:', err.message || err);
  process.exit(1);
});
