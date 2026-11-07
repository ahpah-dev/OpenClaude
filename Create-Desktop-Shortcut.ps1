$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ExePath = Join-Path $AppDir "OpenClaude.exe"
$IconPath = Join-Path $AppDir "assets\openclaude.ico"

# Automatically build OpenClaude.exe & openclaude.ico if not yet compiled
if ((-not (Test-Path $ExePath)) -or (-not (Test-Path $IconPath))) {
    $BuildScript = Join-Path $AppDir "scripts\build-desktop.ps1"
    if (Test-Path $BuildScript) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $BuildScript
    }
}

$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "OpenClaude.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
if (Test-Path $ExePath) {
    $Shortcut.TargetPath = $ExePath
} else {
    $Shortcut.TargetPath = Join-Path $AppDir "OpenClaude-DesktopApp.vbs"
}
$Shortcut.WorkingDirectory = $AppDir
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}
$Shortcut.Description = "OpenClaude - Local Claude.ai Interface, 9Router, Ollama & PC Vibe Coding Toolkit"
$Shortcut.Save()

Write-Host "[OK] Desktop shortcut created at: $ShortcutPath" -ForegroundColor Green
