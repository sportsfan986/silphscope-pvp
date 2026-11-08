# SilphScope PvP - Deploy Cloudflare Telemetry Worker (v7.0.4+)
# Forces Node 22 ahead of system Node 12 and provides step-by-step console progress.

$ErrorActionPreference = "Stop"
$Node22Dir = "C:\Users\Chris\.nodejs\node-v22.14.0-win-x64"
$Node22Exe = Join-Path $Node22Dir "node.exe"
$WranglerJs = "C:\Users\Chris\AppData\Local\npm-cache\_npx\32026684e21afda6\node_modules\wrangler\bin\wrangler.js"
$WorkerDir = Join-Path (Split-Path -Parent $PSScriptRoot) "cloudflare\telemetry-worker"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " SilphScope PvP - Cloudflare Telemetry Worker Deployer" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (Test-Path $Node22Exe) {
    $env:Path = "$Node22Dir;$env:Path"
    $ver = & $Node22Exe -v
    Write-Host "[1/3] Using Node.js $ver at $Node22Exe" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node 22 not found at $Node22Exe" -ForegroundColor Red
    exit 1
}

Set-Location $WorkerDir
Write-Host "[2/3] Working directory: $WorkerDir" -ForegroundColor Gray
Write-Host "[3/3] Running wrangler deploy..." -ForegroundColor Yellow

if (Test-Path $WranglerJs) {
    & $Node22Exe $WranglerJs deploy
} else {
    & (Join-Path $Node22Dir "npx.cmd") wrangler deploy
}

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Cloudflare Worker deployed!" -ForegroundColor Green
} else {
    Write-Host "`n[FAILED] Wrangler exited with code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
