$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "OpenClaude.lnk"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = Join-Path $AppDir "OpenClaude-DesktopApp.vbs"
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.Description = "OpenClaude — 9Router & Local Ollama AI Workspace"
$Shortcut.Save()

Write-Host "✅ Desktop shortcut created at: $ShortcutPath" -ForegroundColor Green
