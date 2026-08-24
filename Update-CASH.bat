@echo off
REM Fetches the newest version and rebuilds. Your ledger is untouched.
setlocal
title Update CASH
cd /d "%~dp0"
set "LOG=%~dp0update-log.txt"
echo CASH update started %DATE% %TIME% > "%LOG%"

echo ===============================================
echo   CASH - Update
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Run Install-CASH.bat first.
  goto done
)

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "OLDVER=%%v"
echo Currently installed: v%OLDVER%
echo.
echo Your ledger lives in your browser, not in this folder,
echo so updating cannot affect it.
echo.

REM CASH holds files open while it runs, which makes npm fail partway through.
echo [1/4] Stopping CASH if it is running...
call "%~dp0Stop-CASH.bat" >nul 2>&1
echo       done.
echo.

if not exist ".git\" goto nogit
where git >nul 2>nul
if errorlevel 1 goto nogitcmd

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
  goto done
)

echo [2/4] Fetching the latest version...
git pull --ff-only >> "%LOG%" 2>&1
if errorlevel 1 (
  echo       could not fetch - see update-log.txt
  echo       nothing was changed.
  goto done
)
for /f "usebackq delims=" %%c in (`git log -1 --format^=%%s 2^>nul`) do set "TIP=%%c"
echo       now at: %TIP%
echo.

echo [3/4] Updating dependencies...
call npm install --no-fund --no-audit >> "%LOG%" 2>&1
if errorlevel 1 (
  echo       FAILED - see update-log.txt
  goto done
)
echo       done.
echo.

echo [4/4] Rebuilding the app...
call npm run build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo       FAILED - see update-log.txt
  goto done
)
echo       done.
echo.

for /f "usebackq delims=" %%v in (`node -p "require('./package.json').version" 2^>nul`) do set "NEWVER=%%v"
echo ===============================================
if "%OLDVER%"=="%NEWVER%" (
  echo   Already on the latest version - v%NEWVER%
) else (
  echo   Updated: v%OLDVER%  to  v%NEWVER%
)
echo.
echo   A full log is in update-log.txt
echo ===============================================
echo.

choice /c YN /n /m "Start CASH now? [Y/N] "
if errorlevel 2 goto done
start "" "%~dp0CASH.vbs"
echo.
echo Starting CASH...
goto done

:nogit
echo -----------------------------------------------
echo   This copy was not downloaded with git, so it
echo   cannot update itself automatically.
echo.
echo   To update:
echo     1. Download the latest ZIP from
echo        https://github.com/rhc52980/CASH_Budget_Tracker
echo     2. Extract it, then run Install-CASH.bat
echo.
echo   Your ledger stays put either way - it is stored
echo   in your browser, not in these files.
echo -----------------------------------------------
goto done

:nogitcmd
echo Git is not installed, so this copy cannot pull updates.
echo Install it from https://git-scm.com or download the
echo latest ZIP from the project page instead.
goto done

:done
echo.
echo -----------------------------------------------
echo   Finished. This window stays open so you can
echo   read what happened above.
echo -----------------------------------------------
echo.
pause
endlocal
