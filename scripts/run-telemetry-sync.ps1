# SilphScope PvP - Manual Local Telemetry Sync & Zero-Token Root-Cause Preprocessor
# Forces Node 22 and prints live progress in the terminal.

$ErrorActionPreference = "Stop"
$Node22Dir = "C:\Users\Chris\.nodejs\node-v22.14.0-win-x64"
$Node22Exe = Join-Path $Node22Dir "node.exe"
$RootDir = Split-Path -Parent $PSScriptRoot
$IngestScript = Join-Path $PSScriptRoot "ingest-telemetry.mjs"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " SilphScope PvP - Local Telemetry Ingestion (Zero AI Tokens)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (Test-Path $Node22Exe) {
    $env:Path = "$Node22Dir;$env:Path"
    $ver = & $Node22Exe -v
    Write-Host "[1/2] Using Node.js $ver" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node 22 not found at $Node22Exe" -ForegroundColor Red
    exit 1
}

Set-Location $RootDir
Write-Host "[2/2] Running ingest-telemetry.mjs..." -ForegroundColor Yellow
& $Node22Exe $IngestScript @args

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Telemetry sync and local root-cause report complete!" -ForegroundColor Green
} else {
    Write-Host "`n[FAILED] Ingest script exited with code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
