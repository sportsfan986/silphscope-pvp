@echo off
cd /d "P:\AntiGravity\SilphScope PvP"
echo ============================================================
echo  SilphScope PvP - Instant On-Demand Telemetry Sync
echo ============================================================
"C:\Users\Chris\.nodejs\node-v22.14.0-win-x64\node.exe" "scripts\ingest-telemetry.mjs" --prune-remote
pause
