@echo off
echo ========================================
echo   RESTART BACKEND - ScheduFlow
echo ========================================
echo.
echo Questo script ferma e riavvia il backend correttamente.
echo.
pause

echo.
echo [1/3] Fermando processi Node.js...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo [2/3] Applicando modifiche database...
cd backend
call npx prisma generate
timeout /t 2 >nul

echo [3/3] Riavviando backend...
echo.
echo Il backend si sta avviando...
echo Premi Ctrl+C per fermarlo quando necessario.
echo.
call npm run dev
