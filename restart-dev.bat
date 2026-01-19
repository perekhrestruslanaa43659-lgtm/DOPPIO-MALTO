@echo off
echo Stopping all npm processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo Starting fresh dev server...
cd /d "c:\scheduling\scheduling-nextjs"
npm run dev
