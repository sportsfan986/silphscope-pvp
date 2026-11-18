@echo off
if not exist "P:\AntiGravity\SilphScope PvP\scripts\trigger-daily-telemetry-plan.mjs" (
  net use P: \\192.168.10.25\Personal /persistent:yes >nul 2>&1
)
cd /d "P:\AntiGravity\SilphScope PvP"
"C:\Users\Chris\.nodejs\node-v22.14.0-win-x64\node.exe" "P:\AntiGravity\SilphScope PvP\scripts\trigger-daily-telemetry-plan.mjs" --telegram-only
