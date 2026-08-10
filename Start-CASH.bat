@echo off
REM Serves the already-built app. Install-CASH.bat / Update-CASH.bat do the
REM building, so this starts in about a second and needs no interaction.
REM CASH.vbs runs this same file with no visible window.
setlocal
title CASH - Count All Spending Habits
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required, but it is not installed.
  echo Get the LTS installer from https://nodejs.org then run Install-CASH.bat
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" goto needsetup
if not exist "dist\index.html" goto needsetup

REM --strictPort matters: your data is stored per web address, so if CASH ever
REM started on a different port it would look empty. Better to fail loudly.
call npm run preview -- --port 4173 --strictPort --open
if errorlevel 1 goto portbusy
goto end

:needsetup
echo CASH has not been set up in this folder yet.
echo.
echo Double-click Install-CASH.bat first - it only takes a minute.
echo.
pause
exit /b 1

:portbusy
echo.
echo -----------------------------------------------
echo   Could not start on port 4173.
echo.
echo   CASH is probably already running. Look for it
echo   at http://localhost:4173 - or run Stop-CASH.bat
echo   and try again.
echo.
echo   CASH always uses port 4173 on purpose: your
echo   ledger is saved against that exact address, so
echo   starting elsewhere would look like your data
echo   had vanished. It has not.
echo -----------------------------------------------
echo.
pause
exit /b 1

:end
endlocal
