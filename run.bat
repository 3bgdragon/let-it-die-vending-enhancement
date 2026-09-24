@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.5 or later is required.
  pause
  exit /b 1
)
node --no-warnings "%~dp0tool.js" %*
pause
