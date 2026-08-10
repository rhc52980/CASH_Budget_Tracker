@echo off
REM First-time setup. Can be run from anywhere - Downloads, a USB stick,
REM wherever the ZIP was extracted. It installs CASH to C:\CASH and continues
REM from there. Pass a path to install somewhere else:  Install-CASH.bat D:\Apps\CASH
setlocal
title Install CASH
cd /d "%~dp0"

set "TARGET=C:\CASH"
if not "%~1"=="" set "TARGET=%~1"

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

REM Already living at the install location? Then just set up in place.
if /i "%CD%"=="%TARGET%" goto setup

echo Installing CASH to %TARGET%
echo   (copying from %CD%)
echo.
robocopy "%CD%" "%TARGET%" /E /XD node_modules dist .vite /XF *.log >nul
if errorlevel 8 goto copyfailed
echo Files copied.
echo.
echo Continuing setup in %TARGET% ...
echo.
call "%TARGET%\Install-CASH.bat"
exit /b %errorlevel%

:setup
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
  "$s.TargetPath = (Join-Path $here 'CASH.vbs');" ^
  "$s.WorkingDirectory = $here;" ^
  "$s.IconLocation = ((Join-Path $here 'cash.ico') + ',0');" ^
  "$s.Description = 'CASH - Count All Spending Habits';" ^
  "$s.WindowStyle = 7; $s.Save();" ^
  "Write-Host ('      Created: ' + $lnk)"
if errorlevel 1 echo       (Could not create the shortcut - use CASH.vbs instead.)
echo.

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "CASHVER=%%v"

echo ===============================================
echo   Setup complete - CASH v%CASHVER%
echo   Installed at: %CD%
echo.
echo   Start it with the CASH icon on your desktop.
echo   It runs silently - no window.
echo   Stop-CASH.bat shuts it down.
echo.
echo   You can now delete the folder you downloaded.
echo.
echo   Your ledger is saved in your browser on this
echo   PC. It is not uploaded anywhere, and updating
echo   the app never touches it.
echo ===============================================
echo.

choice /c YN /n /m "Start CASH now? [Y/N] "
if errorlevel 2 goto bye
start "" "%CD%\CASH.vbs"
goto bye

:copyfailed
echo.
echo Could not copy the files to %TARGET%.
echo.
echo   If that folder is protected, try installing somewhere
echo   you own, for example:
echo     Install-CASH.bat "%LOCALAPPDATA%\CASH"
echo.
pause
exit /b 1

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
