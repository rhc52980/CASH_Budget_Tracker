@echo off
REM Stops the CASH server running in the background on port 4173.
setlocal enabledelayedexpansion
title Stop CASH

set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4173" ^| findstr LISTENING') do (
  if not "%%p"=="0" (
    taskkill /PID %%p /F >nul 2>nul
    if not errorlevel 1 set "FOUND=1"
  )
)

echo.
if defined FOUND (
  echo CASH has been stopped.
) else (
  echo CASH does not appear to be running.
)
echo.
echo Your ledger is saved in your browser and is unaffected.
echo.
REM ping, not timeout: timeout errors out when input is redirected
ping -n 4 127.0.0.1 >nul 2>nul
endlocal
