@echo off
title PHMC Discord Bot
cd /d "%~dp0"

:loop
echo [START.BAT] Starting bot...
node index.js

rem Exit code 42 = legacy restart signal (keep for backwards compat)
if %errorlevel% equ 42 (
    echo [START.BAT] Restart requested (exit code 42). Re-launching...
    goto loop
)

if %errorlevel% neq 0 (
    echo [START.BAT] Bot crashed with exit code %errorlevel%.
    echo [START.BAT] Waiting 5 seconds before restart...
    timeout /t 5 /nobreak >nul
    goto loop
)

echo [START.BAT] Bot exited normally.
echo [START.BAT] The /restart command now spawns a new process automatically,
echo [START.BAT] so the bot keeps running even without start.bat.
pause