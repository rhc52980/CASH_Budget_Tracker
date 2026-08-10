@echo off
setlocal
title CASH - Count All Spending Habits
cd /d "%~dp0"

echo ===============================================
echo   CASH - Count All Spending Habits
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

call npm run preview -- --port 4173 --open
goto end

:failed
echo.
echo Something went wrong - the error is above.
echo.
pause
exit /b 1

:end
endlocal
