' SilphScope PvP — Hidden Background Launcher for 5-Minute Local Telemetry Sync + ffmpeg Preprocessor
' Runs strictly with local resources (Node 22 + local ffmpeg) with zero console window popups and zero AI tokens.

Option Explicit
Dim shell, fso, scriptDir, rootDir, nodeExe, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)
shell.CurrentDirectory = rootDir

nodeExe = "C:\Users\Chris\.nodejs\node-v22.14.0-win-x64\node.exe"
If Not fso.FileExists(nodeExe) Then
    nodeExe = "node.exe"
End If

cmd = """" & nodeExe & """ """ & rootDir & "\scripts\ingest-telemetry.mjs"" --sync-only --prune-remote"
shell.Run cmd, 0, True
