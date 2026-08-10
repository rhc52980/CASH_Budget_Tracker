@echo off
REM Fetches the newest version and rebuilds. Your ledger is untouched.
setlocal
title Update CASH
cd /d "%~dp0"

echo ===============================================
echo   CASH - Update
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Run Install-CASH.bat first.
  echo.
  pause
  exit /b 1
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "OLDVER=%%v"
echo Currently installed: v%OLDVER%
echo.
echo Your ledger lives in your browser, not in this folder,
echo so updating cannot affect it.
echo.

if not exist ".git\" goto nogit

where git >nul 2>nul
if errorlevel 1 goto nogitcmd

REM Refuse to pull over local edits rather than clobbering them
for /f "usebackq delims=" %%s in (`git status --porcelain 2^>nul`) do set "DIRTY=1"
if defined DIRTY (
  echo -----------------------------------------------
  echo   This folder has local changes, so the update
  echo   was stopped rather than overwriting them.
  echo.
  echo   If you did not change anything on purpose,
  echo   run:  git checkout .
  echo   then run this updater again.
  echo -----------------------------------------------
  echo.
  pause
  exit /b 1
)

echo [1/3] Fetching the latest version...
call git pull --ff-only
if errorlevel 1 goto pullfailed
echo.

goto rebuild

:rebuild
echo [2/3] Updating dependencies...
call npm install --no-fund --no-audit
if errorlevel 1 goto failed
echo.

echo [3/3] Rebuilding...
call npm run build
if errorlevel 1 goto failed
echo.

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "NEWVER=%%v"

echo ===============================================
if "%OLDVER%"=="%NEWVER%" (
  echo   Already on the latest version - v%NEWVER%
) else (
  echo   Updated: v%OLDVER%  ^-^>  v%NEWVER%
)
echo.
echo   Start CASH as usual. If the app still looks
echo   like the old version, it will offer a Refresh
echo   button - click it, or reload the page once.
echo ===============================================
echo.
choice /c YN /n /m "Start CASH now? [Y/N] "
if errorlevel 2 goto bye
start "" "%~dp0CASH.vbs"
goto bye

:nogit
echo -----------------------------------------------
echo   This copy was not downloaded with git, so it
echo   cannot update itself automatically.
echo.
echo   To update:
echo     1. Download the latest ZIP from
echo        https://github.com/rhc52980/CASH_Budget_Tracker
echo     2. Extract it over this folder, or into a new
echo        one and run Install-CASH.bat there
echo.
echo   Either way your ledger stays put - it is stored
echo   in your browser, not in these files.
echo -----------------------------------------------
echo.
pause
exit /b 0

:nogitcmd
echo Git is not installed, so this copy cannot pull updates.
echo Install it from https://git-scm.com or download the
echo latest ZIP from the project page instead.
echo.
pause
exit /b 1

:pullfailed
echo.
echo Could not fetch updates - the error is above.
echo A network problem or a change to the remote is most likely.
echo Nothing was modified.
echo.
pause
exit /b 1

:failed
echo.
echo Update failed - the error is above.
echo Your previous build is still in place.
echo.
pause
exit /b 1

:bye
echo.
pause
endlocal
