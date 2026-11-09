@echo off
cd /d "P:\AntiGravity\SilphScope PvP"
echo [%date% %time%] Starting SilphScope PvP Nightly Telemetry Run >> ".aistudio\telemetry_cache\nightly_run.log" 2>&1
"C:\Users\Chris\.nodejs\node-v22.14.0-win-x64\node.exe" "scripts\trigger-daily-telemetry-plan.mjs" >> ".aistudio\telemetry_cache\nightly_run.log" 2>&1
echo [%date% %time%] Finished SilphScope PvP Nightly Telemetry Run >> ".aistudio\telemetry_cache\nightly_run.log" 2>&1
