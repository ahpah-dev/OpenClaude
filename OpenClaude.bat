@echo off
setlocal
title OpenClaude — Automated 9Router + Ollama Launcher
cd /d "%~dp0"

echo.
echo  ============================================================
echo   ✦ OpenClaude — 9Router ^& Local Ollama Desktop Suite
echo  ============================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is required. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/4] Installing OpenClaude packages...
    call npm install --no-fund --no-audit
)

where 9router >nul 2>nul
if %errorlevel% neq 0 (
    echo [2/4] Downloading ^& installing 9Router globally...
    call npm install -g 9router@latest --no-fund --no-audit
) else (
    echo [2/4] 9Router CLI detected.
)

if not exist "dist\index.html" (
    echo [3/4] Building OpenClaude production interface...
    call npm run build
)

echo [4/4] Bootstrapping 9Router Dashboard (:20128), Local Ollama (:11434) ^& OpenClaude (:3099)...
call node server/cli-setup.js

REM Open both 9Router Dashboard and OpenClaude UI
start "" "http://localhost:20128/dashboard"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3099"

echo.
echo  OpenClaude is running at:        http://localhost:3099
echo  9Router Dashboard is running at: http://localhost:20128/dashboard
echo.
node server/index.js
