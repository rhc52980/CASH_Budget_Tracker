@echo off
setlocal
title CASH - Count All Spending Habits
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 (
  for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "CASHVER=%%v"
)
if not defined CASHVER set "CASHVER=?"

echo ===============================================
echo   CASH - Count All Spending Habits   v%CASHVER%
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required, but it is not installed.
  echo.
  echo   1. Go to https://nodejs.org
  echo   2. Download the "LTS" installer and run it
  echo   3. Accept the defaults
  echo   4. Double-click this file again
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run - downloading what the app needs.
  echo This takes a minute or two, and only happens once.
  echo.
  call npm install --no-fund --no-audit
  if errorlevel 1 goto failed
  echo.
)

echo Preparing the app...
call npm run build
if errorlevel 1 goto failed

echo.
echo -----------------------------------------------
echo   CASH is running at http://localhost:4173
echo.
echo   Your browser should open automatically.
echo   KEEP THIS WINDOW OPEN while you use the app.
echo   Close it when you are finished.
echo -----------------------------------------------
echo.

REM --strictPort matters: your data is stored per web address, so if CASH ever
REM started on a different port it would look empty. Better to fail loudly.
call npm run preview -- --port 4173 --strictPort --open
if errorlevel 1 goto portbusy
goto end

:portbusy
echo.
echo -----------------------------------------------
echo   Could not start on port 4173.
echo.
echo   Something else on this PC is already using it -
echo   most likely another copy of CASH that is still
echo   running. Close the other window and try again.
echo.
echo   CASH always uses port 4173 on purpose: your
echo   ledger is saved against that exact address, so
echo   starting elsewhere would look like your data
echo   had vanished. It has not.
echo -----------------------------------------------
echo.
pause
exit /b 1

:failed
echo.
echo Something went wrong - the error is above.
echo.
pause
exit /b 1

:end
endlocal
