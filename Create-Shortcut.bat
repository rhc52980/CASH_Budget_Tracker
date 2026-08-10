@echo off
REM Puts a CASH icon on the desktop pointing at Start-CASH.bat
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$sh = New-Object -ComObject WScript.Shell;" ^
  "$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'CASH.lnk';" ^
  "$s = $sh.CreateShortcut($lnk);" ^
  "$s.TargetPath = Join-Path $PWD 'Start-CASH.bat';" ^
  "$s.WorkingDirectory = $PWD;" ^
  "$s.IconLocation = (Join-Path $PWD 'cash.ico') + ',0';" ^
  "$s.Description = 'CASH - Count All Spending Habits';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Save();" ^
  "Write-Host ('Shortcut created: ' + $lnk)"

echo.
pause
endlocal
