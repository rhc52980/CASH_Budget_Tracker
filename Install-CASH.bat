@echo off
REM First-time setup. Run this once, then use the desktop icon or Start-CASH.bat.
setlocal
title Install CASH
cd /d "%~dp0"

echo ===============================================
echo   CASH - Count All Spending Habits
echo   First-time setup
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required, but it is not installed.
  echo.
  echo   1. Go to https://nodejs.org
  echo   2. Download the "LTS" installer and run it
  echo   3. Accept all the defaults
  echo   4. Run this file again
  echo.
  choice /c YN /n /m "Open the download page now? [Y/N] "
  if errorlevel 2 goto bye
  start "" "https://nodejs.org"
  goto bye
)

for /f "usebackq delims=" %%v in (`node -v 2^>nul`) do set "NODEVER=%%v"
echo Node.js %NODEVER% found.
echo.

echo [1/3] Downloading what the app needs...
echo       This takes a minute or two and only happens once.
call npm install --no-fund --no-audit
if errorlevel 1 goto failed
echo.

echo [2/3] Building CASH...
call npm run build
if errorlevel 1 goto failed
echo.

echo [3/3] Putting a CASH icon on your desktop...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$here = $PWD.Path;" ^
  "$sh = New-Object -ComObject WScript.Shell;" ^
  "$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'CASH.lnk';" ^
  "$s = $sh.CreateShortcut($lnk);" ^
  "$s.TargetPath = (Join-Path $here 'Start-CASH.bat');" ^
  "$s.WorkingDirectory = $here;" ^
  "$s.IconLocation = ((Join-Path $here 'cash.ico') + ',0');" ^
  "$s.Description = 'CASH - Count All Spending Habits';" ^
  "$s.WindowStyle = 7; $s.Save();" ^
  "Write-Host ('      Created: ' + $lnk)"
if errorlevel 1 echo       (Could not create the shortcut - use Start-CASH.bat instead.)
echo.

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "CASHVER=%%v"

echo ===============================================
echo   Setup complete - CASH v%CASHVER%
echo.
echo   From now on, start CASH with the desktop icon
echo   or by double-clicking Start-CASH.bat.
echo.
echo   Your ledger is saved in your browser on this
echo   PC. It is not uploaded anywhere, and updating
echo   the app never touches it.
echo ===============================================
echo.

choice /c YN /n /m "Start CASH now? [Y/N] "
if errorlevel 2 goto bye
start "" "%~dp0Start-CASH.bat"
goto bye

:failed
echo.
echo Setup failed - the error is above.
echo.
pause
exit /b 1

:bye
echo.
pause
endlocal
