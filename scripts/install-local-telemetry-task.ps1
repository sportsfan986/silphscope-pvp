param(
    [switch]$Uninstall
)

$TaskName = "SilphScope-Telemetry-Sync"
$RootDir = Split-Path -Parent $PSScriptRoot
$VbsPath = Join-Path $PSScriptRoot "run-telemetry-sync-hidden.vbs"

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Uninstalled Windows Scheduled Task '$TaskName'."
    exit 0
}

$Action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "//B //NoLogo `"$VbsPath`"" `
    -WorkingDirectory $RootDir

$Trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 4)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Pulls SilphScope PvP telemetry and 1-Battle DVR videos from Cloudflare every 5 minutes using local Node.js + ffmpeg (0 AI tokens), pre-extracts event screenshots, prunes Cloudflare storage, and enforces a 1 GB local disk cap." `
    -Force | Out-Null

Write-Host "[OK] Installed Windows Scheduled Task '$TaskName' (runs every 5 minutes in background, 0 AI tokens)."
